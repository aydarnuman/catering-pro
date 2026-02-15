#!/usr/bin/env node
/**
 * Şartname Bazlı Fiyat Anomali Tespit Scripti
 *
 * Her şartnamenin gramaj kurallarını alır, bağlı reçetelerin malzemelerini kontrol eder.
 * Şartname gramajı × birim fiyat ile reçete miktarı × birim fiyat karşılaştırılır.
 * Sapma oranı eşik değerini aşan ürünler listelenir.
 *
 * Kullanım: cd backend && node scripts/anomali-sartname-bazli.mjs [--esik 5]
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
});

async function query(text, params) {
  return pool.query(text, params);
}

// ── Eşik değeri (CLI argümanından veya varsayılan %5) ──
const args = process.argv.slice(2);
const esikIdx = args.indexOf('--esik');
const ESIK_YUZDE = esikIdx >= 0 && args[esikIdx + 1] ? Number(args[esikIdx + 1]) : 5;

// ── Birim dönüşüm sabitleri (DB'den alınamadığında fallback) ──
const FALLBACK_DONUSUM = {
  'g:kg': 0.001,
  'gr:kg': 0.001,
  'ml:lt': 0.001,
  'ml:l': 0.001,
  'kg:kg': 1,
  'lt:lt': 1,
  'l:l': 1,
  'g:g': 1,
  'gr:g': 1,
  'ml:ml': 1,
  'adet:adet': 1,
};

function normalizeBirim(birim, birimMap) {
  if (!birim) return 'g';
  const lower = birim.toLowerCase().trim();
  return birimMap.get(lower) || lower;
}

function getCarpan(kaynak, hedef, donusumMap) {
  if (kaynak === hedef) return 1;
  const key = `${kaynak}:${hedef}`;
  if (donusumMap.has(key)) return donusumMap.get(key);
  if (FALLBACK_DONUSUM[key]) return FALLBACK_DONUSUM[key];
  return null;
}

// ── Sözlük bazlı malzeme tipi eşleştirme (sartname-onizleme.js ile aynı mantık) ──
function malzemeTipiEslestirTumu(malzemeAdi, sozluk) {
  if (!malzemeAdi || !sozluk?.length) return [];
  const normalizedAd = String(malzemeAdi).toLowerCase().trim();
  const matches = [];
  for (const entry of sozluk) {
    const kelimeler = entry.eslesen_kelimeler || [];
    let bestKelimeLen = 0;
    for (const kelime of kelimeler) {
      if (!kelime) continue;
      const nk = String(kelime).toLowerCase().trim();
      if (nk && normalizedAd.includes(nk) && nk.length > bestKelimeLen) {
        bestKelimeLen = nk.length;
      }
    }
    if (bestKelimeLen > 0) {
      matches.push({ malzeme_tipi: entry.malzeme_tipi, score: bestKelimeLen });
    }
  }
  matches.sort((a, b) => b.score - a.score || b.malzeme_tipi.length - a.malzeme_tipi.length);
  return matches;
}

function dogrudan_isim_eslestir(malzemeAdi, kurallar) {
  if (!malzemeAdi || !kurallar?.length) return null;
  const ad = String(malzemeAdi).toLowerCase().trim();
  for (const k of kurallar) {
    if (k.malzeme_tipi && k.malzeme_tipi.toLowerCase().trim() === ad) return k;
  }
  let bestMatch = null;
  let bestLen = 0;
  for (const k of kurallar) {
    if (!k.malzeme_tipi) continue;
    const tip = k.malzeme_tipi.toLowerCase().trim();
    if (tip.length <= 3) {
      const regex = new RegExp(`\\b${tip.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (regex.test(ad) && tip.length > bestLen) {
        bestMatch = k;
        bestLen = tip.length;
      }
    } else if (ad.includes(tip) && tip.length > bestLen) {
      bestMatch = k;
      bestLen = tip.length;
    }
  }
  return bestMatch;
}

function kuralBul(malzemeAdi, sozluk, altTipKurallari, tumKurallar) {
  const eslesmeler = malzemeTipiEslestirTumu(malzemeAdi, sozluk);
  if (altTipKurallari.length > 0) {
    for (const eslesme of eslesmeler) {
      const kural = altTipKurallari.find((k) => k.malzeme_tipi === eslesme.malzeme_tipi);
      if (kural) return { kural, malzeme_tipi: eslesme.malzeme_tipi, kaynak: 'alt_tip' };
    }
  }
  if (altTipKurallari.length > 0) {
    const kural = dogrudan_isim_eslestir(malzemeAdi, altTipKurallari);
    if (kural) return { kural, malzeme_tipi: kural.malzeme_tipi, kaynak: 'alt_tip_direkt' };
  }
  for (const eslesme of eslesmeler) {
    const kural = tumKurallar.find((k) => k.malzeme_tipi === eslesme.malzeme_tipi);
    if (kural) return { kural, malzeme_tipi: eslesme.malzeme_tipi, kaynak: 'fallback' };
  }
  const kural = dogrudan_isim_eslestir(malzemeAdi, tumKurallar);
  if (kural) return { kural, malzeme_tipi: kural.malzeme_tipi, kaynak: 'fallback_direkt' };
  return null;
}

// ── Fiyat önceliklendirme ──
const FIYAT_GECERLILIK_GUN = 90;

function fiyatGuncelMi(tarih) {
  if (!tarih) return false;
  const gun = Math.floor((new Date() - new Date(tarih)) / (1000 * 60 * 60 * 24));
  return gun >= 0 && gun <= FIYAT_GECERLILIK_GUN;
}

function enIyiFiyatBelirle(m) {
  const urunBirim = (m.urun_standart_birim || m.urun_fiyat_birimi || 'kg').toLowerCase();
  const sonAlisGuncel = fiyatGuncelMi(m.urun_son_alis_tarihi);

  if (Number(m.urun_aktif_fiyat) > 0)
    return { birimFiyat: Number(m.urun_aktif_fiyat), fiyatBirimi: urunBirim, kaynak: 'aktif_fiyat' };
  if (sonAlisGuncel && Number(m.urun_son_alis) > 0)
    return { birimFiyat: Number(m.urun_son_alis), fiyatBirimi: urunBirim, kaynak: 'son_alis_guncel' };
  if (Number(m.piyasa_fiyat) > 0) {
    const pb = m.piyasa_birim_tipi ? m.piyasa_birim_tipi.toLowerCase() : urunBirim;
    return { birimFiyat: Number(m.piyasa_fiyat), fiyatBirimi: pb, kaynak: 'piyasa' };
  }
  if (Number(m.urun_son_alis) > 0)
    return { birimFiyat: Number(m.urun_son_alis), fiyatBirimi: urunBirim, kaynak: 'son_alis_eski' };
  if (Number(m.urun_manuel_fiyat) > 0)
    return { birimFiyat: Number(m.urun_manuel_fiyat), fiyatBirimi: urunBirim, kaynak: 'manuel' };
  if (Number(m.varyant_fiyat) > 0)
    return { birimFiyat: Number(m.varyant_fiyat), fiyatBirimi: urunBirim, kaynak: 'varyant' };
  return { birimFiyat: 0, fiyatBirimi: urunBirim, kaynak: 'yok' };
}

// ── Ana akış (optimize: tüm veri önceden yüklenir) ──
async function main() {
  console.log('=== SARTNAME BAZLI ANOMALi RAPORU ===');
  console.log(`Tarih: ${new Date().toISOString().slice(0, 10)}`);
  console.log(`Esik: %${ESIK_YUZDE}`);
  console.log('');

  // 1. Referans verilerini toplu yükle
  const [birimEslResult, donusumResult, sozlukResult] = await Promise.all([
    query('SELECT varyasyon, standart FROM birim_eslestirme'),
    query('SELECT kaynak_birim, hedef_birim, carpan FROM birim_donusumleri'),
    query('SELECT * FROM malzeme_tip_eslesmeleri WHERE aktif = true'),
  ]);

  const birimMap = new Map();
  for (const row of birimEslResult.rows) birimMap.set(row.varyasyon.toLowerCase(), row.standart.toLowerCase());
  const donusumMap = new Map();
  for (const row of donusumResult.rows)
    donusumMap.set(`${row.kaynak_birim.toLowerCase()}:${row.hedef_birim.toLowerCase()}`, Number(row.carpan));
  const sozluk = sozlukResult.rows;

  // 2. Aktif şartnameler (gramaj kuralı olanlar)
  const sartnameler = await query(`
    SELECT ps.id, ps.kod, ps.ad
    FROM proje_sartnameleri ps
    WHERE ps.aktif = true
      AND EXISTS (SELECT 1 FROM sartname_gramaj_kurallari sgk WHERE sgk.sartname_id = ps.id AND sgk.aktif = true)
    ORDER BY ps.id
  `);

  if (sartnameler.rows.length === 0) {
    console.log('Gramaj kurali olan aktif sartname bulunamadi.');
    pool.end();
    return;
  }

  // 3. Tüm gramaj kurallarını toplu yükle (sartname_id -> kurallar[])
  const tumKurallarResult = await query('SELECT * FROM sartname_gramaj_kurallari WHERE aktif = true');
  const kuralBySartname = new Map();
  for (const k of tumKurallarResult.rows) {
    if (!kuralBySartname.has(k.sartname_id)) kuralBySartname.set(k.sartname_id, []);
    kuralBySartname.get(k.sartname_id).push(k);
  }

  // 4. Tüm aktif, alt_tip_id'li reçeteler
  const recetelerResult = await query(`
    SELECT r.id, r.ad, r.kod, r.alt_tip_id, r.tahmini_maliyet, rk.ad as kategori_adi
    FROM receteler r
    LEFT JOIN recete_kategoriler rk ON rk.id = r.kategori_id
    WHERE r.aktif = true AND r.alt_tip_id IS NOT NULL
    ORDER BY r.ad
  `);

  // 5. Tüm reçete malzemelerini toplu yükle (recete_id -> malzemeler[])
  const malzemeResult = await query(`
    SELECT
      rm.recete_id, rm.id, rm.malzeme_adi, rm.miktar, rm.sef_miktar, rm.aktif_miktar_tipi,
      rm.birim, rm.urun_kart_id,
      urk.manuel_fiyat as urun_manuel_fiyat,
      urk.aktif_fiyat as urun_aktif_fiyat,
      urk.son_alis_fiyati as urun_son_alis,
      urk.son_alis_tarihi as urun_son_alis_tarihi,
      urk.fiyat_birimi as urun_fiyat_birimi,
      urk.birim as urun_standart_birim,
      COALESCE(
        ufo.birim_fiyat_ekonomik,
        (SELECT piyasa_fiyat_ort FROM piyasa_fiyat_gecmisi
         WHERE (urun_kart_id = rm.urun_kart_id AND rm.urun_kart_id IS NOT NULL)
            OR (stok_kart_id = rm.stok_kart_id AND rm.stok_kart_id IS NOT NULL)
         ORDER BY arastirma_tarihi DESC LIMIT 1)
      ) as piyasa_fiyat,
      ufo.birim_tipi as piyasa_birim_tipi,
      get_en_iyi_varyant_fiyat(rm.urun_kart_id) as varyant_fiyat
    FROM recete_malzemeler rm
    LEFT JOIN urun_kartlari urk ON urk.id = rm.urun_kart_id
    LEFT JOIN urun_fiyat_ozet ufo ON ufo.urun_kart_id = rm.urun_kart_id
    WHERE rm.recete_id = ANY($1)
    ORDER BY rm.recete_id, rm.sira
  `, [recetelerResult.rows.map((r) => r.id)]);

  const malzemeByRecete = new Map();
  for (const m of malzemeResult.rows) {
    if (!malzemeByRecete.has(m.recete_id)) malzemeByRecete.set(m.recete_id, []);
    malzemeByRecete.get(m.recete_id).push(m);
  }

  // 6. İşle: her şartname × her reçete × her malzeme
  const anomaliler = [];
  let toplamTaranan = 0;
  const ozetSayac = { GRAMAJ_SAPMASI: 0, EKSIK_FIYAT: 0, DONUSUM_HATASI: 0 };

  for (const sartname of sartnameler.rows) {
    const tumKurallar = kuralBySartname.get(sartname.id) || [];
    if (tumKurallar.length === 0) continue;

    for (const recete of recetelerResult.rows) {
      toplamTaranan++;

      const altTipKurallari = recete.alt_tip_id
        ? tumKurallar.filter((k) => Number(k.alt_tip_id) === Number(recete.alt_tip_id))
        : [];

      const malzemeler = malzemeByRecete.get(recete.id) || [];

      for (const m of malzemeler) {
        const receteMiktar =
          m.aktif_miktar_tipi === 'sef' && m.sef_miktar != null
            ? Number(m.sef_miktar)
            : Number(m.miktar) || 0;
        const receteBirim = normalizeBirim(m.birim, birimMap);

        // Kural eşleştirme
        const sonuc = kuralBul(m.malzeme_adi, sozluk, altTipKurallari, tumKurallar);
        if (!sonuc) continue; // Bu malzeme için gramaj kuralı yok

        const sartnameGramaj = Number(sonuc.kural.gramaj) || 0;
        const sartnameBirim = normalizeBirim(sonuc.kural.birim || 'g', birimMap);

        // Fiyat belirle
        const { birimFiyat, fiyatBirimi } = enIyiFiyatBelirle(m);

        if (birimFiyat === 0) {
          anomaliler.push({
            sartname: sartname.kod, recete: recete.ad, malzeme: m.malzeme_adi,
            sartname_gramaj: `${sartnameGramaj} ${sartnameBirim}`,
            recete_miktar: `${receteMiktar} ${receteBirim}`,
            birim_fiyat: 0, beklenen: 0, mevcut: 0, sapma: null,
            sorun: 'EKSIK_FIYAT',
          });
          ozetSayac.EKSIK_FIYAT++;
          continue;
        }

        // Birim dönüşümleri
        const sartnameCarpan = getCarpan(sartnameBirim, fiyatBirimi, donusumMap);
        if (sartnameCarpan === null) {
          anomaliler.push({
            sartname: sartname.kod, recete: recete.ad, malzeme: m.malzeme_adi,
            sartname_gramaj: `${sartnameGramaj} ${sartnameBirim}`,
            recete_miktar: `${receteMiktar} ${receteBirim}`,
            birim_fiyat: birimFiyat, beklenen: null, mevcut: null, sapma: null,
            sorun: `DONUSUM_HATASI (${sartnameBirim}->${fiyatBirimi})`,
          });
          ozetSayac.DONUSUM_HATASI++;
          continue;
        }

        const receteCarpan = getCarpan(receteBirim, fiyatBirimi, donusumMap);
        if (receteCarpan === null) {
          anomaliler.push({
            sartname: sartname.kod, recete: recete.ad, malzeme: m.malzeme_adi,
            sartname_gramaj: `${sartnameGramaj} ${sartnameBirim}`,
            recete_miktar: `${receteMiktar} ${receteBirim}`,
            birim_fiyat: birimFiyat, beklenen: null, mevcut: null, sapma: null,
            sorun: `DONUSUM_HATASI (${receteBirim}->${fiyatBirimi})`,
          });
          ozetSayac.DONUSUM_HATASI++;
          continue;
        }

        const beklenenMaliyet = sartnameGramaj * sartnameCarpan * birimFiyat;
        const mevcutMaliyet = receteMiktar * receteCarpan * birimFiyat;

        if (beklenenMaliyet === 0) continue;
        const sapmaYuzde = ((mevcutMaliyet - beklenenMaliyet) / beklenenMaliyet) * 100;

        if (Math.abs(sapmaYuzde) > ESIK_YUZDE) {
          anomaliler.push({
            sartname: sartname.kod, recete: recete.ad, malzeme: m.malzeme_adi,
            sartname_gramaj: `${sartnameGramaj} ${sartnameBirim}`,
            recete_miktar: `${receteMiktar} ${receteBirim}`,
            birim_fiyat: birimFiyat,
            beklenen: Math.round(beklenenMaliyet * 100) / 100,
            mevcut: Math.round(mevcutMaliyet * 100) / 100,
            sapma: Math.round(sapmaYuzde * 10) / 10,
            sorun: 'GRAMAJ_SAPMASI',
          });
          ozetSayac.GRAMAJ_SAPMASI++;
        }
      }
    }
  }

  // ── Çıktı ──
  console.log(`Toplam taranan recete-sartname cifti: ${toplamTaranan}`);
  console.log(`Anomali bulunan: ${anomaliler.length}`);
  console.log('');

  if (anomaliler.length === 0) {
    console.log('Anomali bulunamadi. Tum urunler esik degerin altinda.');
  } else {
    const header = [
      '#'.padStart(4),
      'Sartname'.padEnd(14),
      'Recete'.padEnd(28),
      'Malzeme'.padEnd(22),
      'Sartname Gramaj'.padEnd(16),
      'Recete Miktar'.padEnd(16),
      'B.Fiyat'.padStart(10),
      'Beklenen'.padStart(10),
      'Mevcut'.padStart(10),
      'Sapma %'.padStart(8),
      'Sorun',
    ].join(' | ');

    console.log(header);
    console.log('-'.repeat(header.length));

    for (let i = 0; i < anomaliler.length; i++) {
      const a = anomaliler[i];
      console.log(
        [
          String(i + 1).padStart(4),
          (a.sartname || '').slice(0, 14).padEnd(14),
          (a.recete || '').slice(0, 28).padEnd(28),
          (a.malzeme || '').slice(0, 22).padEnd(22),
          (a.sartname_gramaj || '').padEnd(16),
          (a.recete_miktar || '').padEnd(16),
          a.birim_fiyat != null && a.birim_fiyat > 0 ? `₺${a.birim_fiyat.toFixed(2)}`.padStart(10) : '—'.padStart(10),
          a.beklenen != null ? `₺${a.beklenen.toFixed(2)}`.padStart(10) : '—'.padStart(10),
          a.mevcut != null ? `₺${a.mevcut.toFixed(2)}`.padStart(10) : '—'.padStart(10),
          a.sapma != null ? `${a.sapma > 0 ? '+' : ''}${a.sapma}%`.padStart(8) : '—'.padStart(8),
          a.sorun || '',
        ].join(' | ')
      );
    }
    console.log('-'.repeat(header.length));
  }

  console.log('');
  console.log('OZET:');
  console.log(`  Gramaj sapmasi: ${ozetSayac.GRAMAJ_SAPMASI}`);
  console.log(`  Eksik fiyat: ${ozetSayac.EKSIK_FIYAT}`);
  console.log(`  Donusum hatasi: ${ozetSayac.DONUSUM_HATASI}`);

  pool.end();
  if (anomaliler.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error('HATA:', err);
  pool.end();
  process.exit(2);
});
