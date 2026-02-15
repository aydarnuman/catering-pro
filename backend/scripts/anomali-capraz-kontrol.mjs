#!/usr/bin/env node
/**
 * Çapraz Kontrol Anomali Tespit Scripti
 *
 * 1. Şartname maliyeti ile reçete maliyeti uyuşuyor mu?
 * 2. Fiyatı olmayan veya sıfır olan malzeme var mı?
 * 3. Birim dönüşümü yapılamayan malzeme var mı?
 * 4. Uyuşmayan ürünleri listeler.
 *
 * Kullanım: cd backend && node scripts/anomali-capraz-kontrol.mjs [--esik 10]
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

// ── CLI argümanları ──
const args = process.argv.slice(2);
const esikIdx = args.indexOf('--esik');
const ESIK_YUZDE = esikIdx >= 0 && args[esikIdx + 1] ? Number(args[esikIdx + 1]) : 10;

// ── Birim dönüşüm ──
const FALLBACK_DONUSUM = {
  'g:kg': 0.001, 'gr:kg': 0.001, 'ml:lt': 0.001, 'ml:l': 0.001,
  'kg:kg': 1, 'lt:lt': 1, 'l:l': 1, 'g:g': 1, 'gr:g': 1, 'ml:ml': 1, 'adet:adet': 1,
};

function normalizeBirim(birim, birimMap) {
  if (!birim) return 'g';
  const lower = birim.toLowerCase().trim();
  return birimMap.get(lower) || lower;
}

function getCarpan(kaynak, hedef, donusumMap, urunDonusumMap, urunKartId) {
  if (kaynak === hedef) return 1;
  if (urunKartId && urunDonusumMap) {
    const urunKey = `${urunKartId}:${kaynak}:${hedef}`;
    if (urunDonusumMap.has(urunKey)) return urunDonusumMap.get(urunKey);
  }
  const key = `${kaynak}:${hedef}`;
  if (donusumMap.has(key)) return donusumMap.get(key);
  if (FALLBACK_DONUSUM[key]) return FALLBACK_DONUSUM[key];
  return null;
}

// ── Malzeme tipi eşleştirme (sartname-onizleme.js ile aynı) ──
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
      if (regex.test(ad) && tip.length > bestLen) { bestMatch = k; bestLen = tip.length; }
    } else if (ad.includes(tip) && tip.length > bestLen) { bestMatch = k; bestLen = tip.length; }
  }
  return bestMatch;
}

function kuralBul(malzemeAdi, sozluk, altTipKurallari, tumKurallar) {
  const eslesmeler = malzemeTipiEslestirTumu(malzemeAdi, sozluk);
  if (altTipKurallari.length > 0) {
    for (const e of eslesmeler) {
      const k = altTipKurallari.find((x) => x.malzeme_tipi === e.malzeme_tipi);
      if (k) return { kural: k, malzeme_tipi: e.malzeme_tipi };
    }
    const k = dogrudan_isim_eslestir(malzemeAdi, altTipKurallari);
    if (k) return { kural: k, malzeme_tipi: k.malzeme_tipi };
  }
  for (const e of eslesmeler) {
    const k = tumKurallar.find((x) => x.malzeme_tipi === e.malzeme_tipi);
    if (k) return { kural: k, malzeme_tipi: e.malzeme_tipi };
  }
  const k = dogrudan_isim_eslestir(malzemeAdi, tumKurallar);
  if (k) return { kural: k, malzeme_tipi: k.malzeme_tipi };
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
    return { birimFiyat: Number(m.urun_aktif_fiyat), fiyatBirimi: urunBirim };
  if (sonAlisGuncel && Number(m.urun_son_alis) > 0)
    return { birimFiyat: Number(m.urun_son_alis), fiyatBirimi: urunBirim };
  if (Number(m.piyasa_fiyat) > 0) {
    const pb = m.piyasa_birim_tipi ? m.piyasa_birim_tipi.toLowerCase() : urunBirim;
    return { birimFiyat: Number(m.piyasa_fiyat), fiyatBirimi: pb };
  }
  if (Number(m.urun_son_alis) > 0)
    return { birimFiyat: Number(m.urun_son_alis), fiyatBirimi: urunBirim };
  if (Number(m.urun_manuel_fiyat) > 0)
    return { birimFiyat: Number(m.urun_manuel_fiyat), fiyatBirimi: urunBirim };
  if (Number(m.varyant_fiyat) > 0)
    return { birimFiyat: Number(m.varyant_fiyat), fiyatBirimi: urunBirim };
  return { birimFiyat: 0, fiyatBirimi: urunBirim };
}

// ── Ana akış ──
async function main() {
  console.log('=== CAPRAZ KONTROL ANOMALi RAPORU ===');
  console.log(`Tarih: ${new Date().toISOString().slice(0, 10)}`);
  console.log(`Maliyet karsilastirma esigi: %${ESIK_YUZDE}`);
  console.log('');

  // 1. Referans verilerini toplu yükle
  const [birimEslResult, donusumResult, urunDonusumResult, sozlukResult, kurallarResult] = await Promise.all([
    query('SELECT varyasyon, standart FROM birim_eslestirme'),
    query('SELECT kaynak_birim, hedef_birim, carpan FROM birim_donusumleri'),
    query('SELECT urun_kart_id, kaynak_birim, hedef_birim, carpan FROM urun_birim_donusumleri'),
    query('SELECT * FROM malzeme_tip_eslesmeleri WHERE aktif = true'),
    query('SELECT * FROM sartname_gramaj_kurallari WHERE aktif = true'),
  ]);

  const birimMap = new Map();
  for (const row of birimEslResult.rows) birimMap.set(row.varyasyon.toLowerCase(), row.standart.toLowerCase());
  const donusumMap = new Map();
  for (const row of donusumResult.rows)
    donusumMap.set(`${row.kaynak_birim.toLowerCase()}:${row.hedef_birim.toLowerCase()}`, Number(row.carpan));
  const urunDonusumMap = new Map();
  for (const row of urunDonusumResult.rows)
    urunDonusumMap.set(`${row.urun_kart_id}:${row.kaynak_birim.toLowerCase()}:${row.hedef_birim.toLowerCase()}`, Number(row.carpan));
  const sozluk = sozlukResult.rows;

  // Kurallar sartname_id bazlı
  const kuralBySartname = new Map();
  for (const k of kurallarResult.rows) {
    if (!kuralBySartname.has(k.sartname_id)) kuralBySartname.set(k.sartname_id, []);
    kuralBySartname.get(k.sartname_id).push(k);
  }

  // 2. Aktif şartnameler
  const sartnameler = await query(`
    SELECT ps.id, ps.kod, ps.ad
    FROM proje_sartnameleri ps
    WHERE ps.aktif = true
      AND EXISTS (SELECT 1 FROM sartname_gramaj_kurallari sgk WHERE sgk.sartname_id = ps.id AND sgk.aktif = true)
    ORDER BY ps.id
  `);

  // 3. Aktif reçeteler
  const recetelerResult = await query(`
    SELECT r.id, r.ad, r.kod, r.alt_tip_id, r.tahmini_maliyet, rk.ad as kategori_adi
    FROM receteler r
    LEFT JOIN recete_kategoriler rk ON rk.id = r.kategori_id
    WHERE r.aktif = true
    ORDER BY r.ad
  `);
  const receteler = recetelerResult.rows;

  // 4. Tüm malzemeleri toplu yükle
  const malzemeResult = await query(`
    SELECT
      rm.recete_id, rm.id, rm.malzeme_adi, rm.miktar, rm.sef_miktar, rm.aktif_miktar_tipi,
      rm.birim, rm.urun_kart_id,
      urk.ad as urun_adi,
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
    ORDER BY rm.recete_id, rm.sira
  `);

  const malzemeByRecete = new Map();
  for (const m of malzemeResult.rows) {
    if (!malzemeByRecete.has(m.recete_id)) malzemeByRecete.set(m.recete_id, []);
    malzemeByRecete.get(m.recete_id).push(m);
  }

  // ── BÖLÜM 1: Fiyatı olmayan / sıfır olan malzemeler ──
  console.log('--- BOLUM 1: FIYATI OLMAYAN VEYA SIFIR MALZEMELER ---');
  console.log('');

  const sifirFiyatlilar = [];
  const eksikUrunKartlilar = [];

  for (const recete of receteler) {
    const malzemeler = malzemeByRecete.get(recete.id) || [];
    for (const m of malzemeler) {
      if (!m.urun_kart_id) {
        eksikUrunKartlilar.push({
          recete: recete.ad,
          malzeme: m.malzeme_adi,
          sorun: 'EKSIK_URUN_KARTI',
          detay: 'urun_kart_id NULL — urune eslestirilmemis',
        });
        continue;
      }

      const { birimFiyat } = enIyiFiyatBelirle(m);
      if (birimFiyat === 0) {
        sifirFiyatlilar.push({
          recete: recete.ad,
          malzeme: m.malzeme_adi,
          urun: m.urun_adi || '—',
          sorun: 'SIFIR_FIYAT',
          detay: 'Hicbir kaynakta fiyat bulunamadi',
        });
      }
    }
  }

  if (sifirFiyatlilar.length === 0 && eksikUrunKartlilar.length === 0) {
    console.log('  Tum malzemelerin fiyati mevcut ve urun kartina bagli.');
  } else {
    if (sifirFiyatlilar.length > 0) {
      console.log(`  Sifir fiyatli malzeme: ${sifirFiyatlilar.length}`);
      for (const s of sifirFiyatlilar) {
        console.log(`    - [${s.recete}] ${s.malzeme} (${s.urun}) — ${s.detay}`);
      }
    }
    if (eksikUrunKartlilar.length > 0) {
      console.log(`  Eksik urun karti: ${eksikUrunKartlilar.length}`);
      for (const s of eksikUrunKartlilar) {
        console.log(`    - [${s.recete}] ${s.malzeme} — ${s.detay}`);
      }
    }
  }

  // ── BÖLÜM 2: Birim dönüşümü yapılamayan malzemeler ──
  console.log('');
  console.log('--- BOLUM 2: BIRIM DONUSUMU YAPILAMAYAN MALZEMELER ---');
  console.log('');

  const donusumHatalari = [];

  for (const recete of receteler) {
    const malzemeler = malzemeByRecete.get(recete.id) || [];
    for (const m of malzemeler) {
      if (!m.urun_kart_id) continue;
      const malzemeBirim = normalizeBirim(m.birim, birimMap);
      const { fiyatBirimi } = enIyiFiyatBelirle(m);
      const carpan = getCarpan(malzemeBirim, fiyatBirimi, donusumMap, urunDonusumMap, m.urun_kart_id);
      if (carpan === null) {
        donusumHatalari.push({
          recete: recete.ad,
          malzeme: m.malzeme_adi,
          kaynak_birim: malzemeBirim,
          hedef_birim: fiyatBirimi,
        });
      }
    }
  }

  if (donusumHatalari.length === 0) {
    console.log('  Tum birim donusumleri mevcut.');
  } else {
    console.log(`  Donusum hatasi: ${donusumHatalari.length}`);
    // Benzersiz birim çiftlerine göre grupla
    const birimCiftleri = new Map();
    for (const d of donusumHatalari) {
      const key = `${d.kaynak_birim}->${d.hedef_birim}`;
      if (!birimCiftleri.has(key)) birimCiftleri.set(key, []);
      birimCiftleri.get(key).push(d);
    }
    for (const [cift, hatalar] of birimCiftleri) {
      console.log(`    ${cift} (${hatalar.length} malzeme):`);
      const gosterilenler = hatalar.slice(0, 5);
      for (const h of gosterilenler) {
        console.log(`      - [${h.recete}] ${h.malzeme}`);
      }
      if (hatalar.length > 5) console.log(`      ... ve ${hatalar.length - 5} daha`);
    }
  }

  // ── BÖLÜM 3: Şartname maliyeti vs reçete maliyeti karşılaştırması ──
  console.log('');
  console.log('--- BOLUM 3: SARTNAME vs RECETE MALIYET KARSILASTIRMASI ---');
  console.log(`Esik: %${ESIK_YUZDE}`);
  console.log('');

  // Sadece alt_tip_id olan reçeteleri tara (şartname karşılaştırması yapılabilsin)
  const recetelerAltTipli = receteler.filter((r) => r.alt_tip_id != null);
  const caprazAnomaliler = [];

  for (const sartname of sartnameler.rows) {
    const tumKurallar = kuralBySartname.get(sartname.id) || [];
    if (tumKurallar.length === 0) continue;

    for (const recete of recetelerAltTipli) {
      const malzemeler = malzemeByRecete.get(recete.id) || [];
      if (malzemeler.length === 0) continue;

      const altTipKurallari = tumKurallar.filter((k) => Number(k.alt_tip_id) === Number(recete.alt_tip_id));

      let sartnameMaliyet = 0;
      let receteMaliyet = 0;
      let hesaplanabilir = true;

      for (const m of malzemeler) {
        if (!m.urun_kart_id) continue;

        const receteMiktar =
          m.aktif_miktar_tipi === 'sef' && m.sef_miktar != null
            ? Number(m.sef_miktar) : Number(m.miktar) || 0;
        const receteBirim = normalizeBirim(m.birim, birimMap);

        const { birimFiyat, fiyatBirimi } = enIyiFiyatBelirle(m);
        if (birimFiyat === 0) continue;

        // Reçete maliyeti
        const receteCarpan = getCarpan(receteBirim, fiyatBirimi, donusumMap, urunDonusumMap, m.urun_kart_id);
        if (receteCarpan === null) continue;
        receteMaliyet += receteMiktar * receteCarpan * birimFiyat;

        // Şartname maliyeti (eşleşen kural varsa o gramajla, yoksa reçete miktarıyla)
        const sonuc = kuralBul(m.malzeme_adi, sozluk, altTipKurallari, tumKurallar);
        if (sonuc) {
          const sartnameGramaj = Number(sonuc.kural.gramaj) || 0;
          const sartnameBirim = normalizeBirim(sonuc.kural.birim || 'g', birimMap);
          const sartnameCarpan = getCarpan(sartnameBirim, fiyatBirimi, donusumMap, urunDonusumMap, m.urun_kart_id);
          if (sartnameCarpan !== null) {
            sartnameMaliyet += sartnameGramaj * sartnameCarpan * birimFiyat;
          } else {
            sartnameMaliyet += receteMiktar * receteCarpan * birimFiyat; // fallback
          }
        } else {
          // Kural eşleşmedi → reçete miktarını kullan (şartname bu malzemeyi kontrol etmiyor)
          sartnameMaliyet += receteMiktar * receteCarpan * birimFiyat;
        }
      }

      sartnameMaliyet = Math.round(sartnameMaliyet * 100) / 100;
      receteMaliyet = Math.round(receteMaliyet * 100) / 100;

      if (sartnameMaliyet === 0 && receteMaliyet === 0) continue;

      const referans = Math.max(sartnameMaliyet, receteMaliyet);
      const sapma = referans > 0 ? ((receteMaliyet - sartnameMaliyet) / referans) * 100 : 0;

      if (Math.abs(sapma) > ESIK_YUZDE) {
        caprazAnomaliler.push({
          sartname: sartname.kod,
          recete: recete.ad,
          kategori: recete.kategori_adi || '—',
          sartname_maliyet: sartnameMaliyet,
          recete_maliyet: receteMaliyet,
          sapma: Math.round(sapma * 10) / 10,
        });
      }
    }
  }

  if (caprazAnomaliler.length === 0) {
    console.log(`  Esik degerin (%${ESIK_YUZDE}) ustunde capraz sapma bulunamadi.`);
  } else {
    console.log(`  Capraz sapma: ${caprazAnomaliler.length}`);
    console.log('');

    const header = [
      '#'.padStart(4),
      'Sartname'.padEnd(14),
      'Recete'.padEnd(28),
      'Kategori'.padEnd(16),
      'Sartname Mal.'.padStart(14),
      'Recete Mal.'.padStart(14),
      'Sapma %'.padStart(8),
    ].join(' | ');

    console.log(header);
    console.log('-'.repeat(header.length));

    for (let i = 0; i < caprazAnomaliler.length; i++) {
      const a = caprazAnomaliler[i];
      console.log(
        [
          String(i + 1).padStart(4),
          (a.sartname || '').slice(0, 14).padEnd(14),
          (a.recete || '').slice(0, 28).padEnd(28),
          (a.kategori || '').slice(0, 16).padEnd(16),
          `₺${a.sartname_maliyet.toFixed(2)}`.padStart(14),
          `₺${a.recete_maliyet.toFixed(2)}`.padStart(14),
          `${a.sapma > 0 ? '+' : ''}${a.sapma}%`.padStart(8),
        ].join(' | ')
      );
    }
    console.log('-'.repeat(header.length));
  }

  // ── GENEL ÖZET ──
  console.log('');
  console.log('=== GENEL OZET ===');
  console.log(`  Sifir fiyatli malzeme: ${sifirFiyatlilar.length}`);
  console.log(`  Eksik urun karti: ${eksikUrunKartlilar.length}`);
  console.log(`  Birim donusum hatasi: ${donusumHatalari.length}`);
  console.log(`  Capraz maliyet sapmasi: ${caprazAnomaliler.length}`);
  const toplamSorun = sifirFiyatlilar.length + eksikUrunKartlilar.length + donusumHatalari.length + caprazAnomaliler.length;
  console.log(`  TOPLAM SORUN: ${toplamSorun}`);

  pool.end();
  if (toplamSorun > 0) process.exit(1);
}

main().catch((err) => {
  console.error('HATA:', err);
  pool.end();
  process.exit(2);
});
