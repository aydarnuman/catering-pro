#!/usr/bin/env node
/**
 * Reçete Bazlı Fiyat Anomali Tespit Scripti
 *
 * Her reçetenin malzeme listesini alır, güncel birim fiyatlarla maliyeti yeniden hesaplar.
 * Hesaplanan maliyet ile kayıtlı tahmini_maliyet karşılaştırılır.
 * Birim dönüşüm hataları, sıfır fiyatlı ve eksik ürün kartlı malzemeler tespit edilir.
 *
 * Kullanım: cd backend && node scripts/anomali-recete-bazli.mjs [--esik 5]
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
const ESIK_YUZDE = esikIdx >= 0 && args[esikIdx + 1] ? Number(args[esikIdx + 1]) : 5;

// ── Birim dönüşüm sabitleri ──
const FALLBACK_DONUSUM = {
  'g:kg': 0.001, 'gr:kg': 0.001, 'ml:lt': 0.001, 'ml:l': 0.001,
  'kg:kg': 1, 'lt:lt': 1, 'l:l': 1, 'g:g': 1, 'gr:g': 1, 'ml:ml': 1, 'adet:adet': 1,
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

// ── Ana akış ──
async function main() {
  console.log('=== RECETE BAZLI ANOMALi RAPORU ===');
  console.log(`Tarih: ${new Date().toISOString().slice(0, 10)}`);
  console.log(`Esik: %${ESIK_YUZDE}`);
  console.log('');

  // 1. Referans verilerini toplu yükle
  const [birimEslResult, donusumResult] = await Promise.all([
    query('SELECT varyasyon, standart FROM birim_eslestirme'),
    query('SELECT kaynak_birim, hedef_birim, carpan FROM birim_donusumleri'),
  ]);

  const birimMap = new Map();
  for (const row of birimEslResult.rows) birimMap.set(row.varyasyon.toLowerCase(), row.standart.toLowerCase());
  const donusumMap = new Map();
  for (const row of donusumResult.rows)
    donusumMap.set(`${row.kaynak_birim.toLowerCase()}:${row.hedef_birim.toLowerCase()}`, Number(row.carpan));

  // 2. Tüm aktif reçeteleri al
  const recetelerResult = await query(`
    SELECT r.id, r.ad, r.kod, r.tahmini_maliyet, rk.ad as kategori_adi
    FROM receteler r
    LEFT JOIN recete_kategoriler rk ON rk.id = r.kategori_id
    WHERE r.aktif = true
    ORDER BY r.ad
  `);

  const receteler = recetelerResult.rows;
  console.log(`Toplam aktif recete: ${receteler.length}`);

  // 3. Tüm reçete malzemelerini toplu yükle
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

  // 4. Her reçetenin maliyetini yeniden hesapla ve karşılaştır
  const anomaliler = [];
  const ozetSayac = { FIYAT_SAPMASI: 0, SIFIR_FIYAT: 0, BIRIM_HATASI: 0, EKSIK_URUN_KARTI: 0 };
  let anomaliReceteSayisi = 0;

  for (const recete of receteler) {
    const malzemeler = malzemeByRecete.get(recete.id) || [];
    if (malzemeler.length === 0) continue;

    let hesaplananToplam = 0;
    const receteSorunlari = [];

    for (const m of malzemeler) {
      const aktifMiktar =
        m.aktif_miktar_tipi === 'sef' && m.sef_miktar != null
          ? Number(m.sef_miktar)
          : Number(m.miktar) || 0;
      const malzemeBirim = normalizeBirim(m.birim, birimMap);

      // Eksik ürün kartı kontrolü
      if (!m.urun_kart_id) {
        receteSorunlari.push({
          malzeme: m.malzeme_adi,
          sorun: 'EKSIK_URUN_KARTI',
          detay: 'urun_kart_id NULL',
          beklenen: null,
          mevcut: null,
        });
        ozetSayac.EKSIK_URUN_KARTI++;
        continue;
      }

      // Fiyat belirle
      const { birimFiyat, fiyatBirimi, kaynak: fiyatKaynagi } = enIyiFiyatBelirle(m);

      if (birimFiyat === 0) {
        receteSorunlari.push({
          malzeme: m.malzeme_adi,
          sorun: 'SIFIR_FIYAT',
          detay: `Hicbir kaynakta fiyat yok (${m.urun_adi || 'urun'})`,
          beklenen: null,
          mevcut: 0,
        });
        ozetSayac.SIFIR_FIYAT++;
        continue;
      }

      // Birim dönüşümü
      const carpan = getCarpan(malzemeBirim, fiyatBirimi, donusumMap);
      if (carpan === null) {
        receteSorunlari.push({
          malzeme: m.malzeme_adi,
          sorun: 'BIRIM_HATASI',
          detay: `${malzemeBirim} -> ${fiyatBirimi} donusumu bulunamadi`,
          beklenen: null,
          mevcut: null,
        });
        ozetSayac.BIRIM_HATASI++;
        continue;
      }

      const malzemeMaliyet = aktifMiktar * carpan * birimFiyat;
      hesaplananToplam += malzemeMaliyet;
    }

    hesaplananToplam = Math.round(hesaplananToplam * 100) / 100;
    const kayitliMaliyet = Number(recete.tahmini_maliyet) || 0;

    // Sapma hesapla
    let sapmaYuzde = null;
    if (hesaplananToplam > 0) {
      sapmaYuzde = ((kayitliMaliyet - hesaplananToplam) / hesaplananToplam) * 100;
      sapmaYuzde = Math.round(sapmaYuzde * 10) / 10;
    } else if (kayitliMaliyet > 0) {
      sapmaYuzde = 100; // hesaplanan 0 ama kayıtlı değer var
    }

    // Fiyat sapması varsa ekle
    const sapmaliMi = sapmaYuzde !== null && Math.abs(sapmaYuzde) > ESIK_YUZDE;

    if (sapmaliMi) {
      anomaliler.push({
        recete: recete.ad,
        kategori: recete.kategori_adi || '—',
        hesaplanan: hesaplananToplam,
        kayitli: kayitliMaliyet,
        sapma: sapmaYuzde,
        sorunlu_malzeme: null,
        sorun: 'FIYAT_SAPMASI',
      });
      ozetSayac.FIYAT_SAPMASI++;
    }

    // Malzeme seviyesi sorunları ekle
    for (const s of receteSorunlari) {
      anomaliler.push({
        recete: recete.ad,
        kategori: recete.kategori_adi || '—',
        hesaplanan: hesaplananToplam,
        kayitli: kayitliMaliyet,
        sapma: sapmaYuzde,
        sorunlu_malzeme: s.malzeme,
        sorun: s.sorun,
        detay: s.detay,
      });
    }

    if (sapmaliMi || receteSorunlari.length > 0) {
      anomaliReceteSayisi++;
    }
  }

  // ── Çıktı ──
  console.log(`Anomali bulunan recete: ${anomaliReceteSayisi}`);
  console.log(`Toplam anomali satiri: ${anomaliler.length}`);
  console.log('');

  if (anomaliler.length === 0) {
    console.log('Anomali bulunamadi. Tum receteler esik degerin altinda.');
  } else {
    const header = [
      '#'.padStart(4),
      'Recete'.padEnd(28),
      'Kategori'.padEnd(16),
      'Hesaplanan'.padStart(12),
      'Kayitli'.padStart(12),
      'Sapma %'.padStart(8),
      'Sorunlu Malzeme'.padEnd(22),
      'Sorun Tipi',
    ].join(' | ');

    console.log(header);
    console.log('-'.repeat(header.length));

    for (let i = 0; i < anomaliler.length; i++) {
      const a = anomaliler[i];
      console.log(
        [
          String(i + 1).padStart(4),
          (a.recete || '').slice(0, 28).padEnd(28),
          (a.kategori || '').slice(0, 16).padEnd(16),
          a.hesaplanan != null ? `₺${a.hesaplanan.toFixed(2)}`.padStart(12) : '—'.padStart(12),
          a.kayitli != null ? `₺${a.kayitli.toFixed(2)}`.padStart(12) : '—'.padStart(12),
          a.sapma != null ? `${a.sapma > 0 ? '+' : ''}${a.sapma}%`.padStart(8) : '—'.padStart(8),
          (a.sorunlu_malzeme || '—').slice(0, 22).padEnd(22),
          a.sorun || '',
        ].join(' | ')
      );
    }
    console.log('-'.repeat(header.length));
  }

  console.log('');
  console.log('OZET:');
  console.log(`  Fiyat sapmasi (recete toplam): ${ozetSayac.FIYAT_SAPMASI}`);
  console.log(`  Sifir fiyat (malzeme): ${ozetSayac.SIFIR_FIYAT}`);
  console.log(`  Birim hatasi (malzeme): ${ozetSayac.BIRIM_HATASI}`);
  console.log(`  Eksik urun karti (malzeme): ${ozetSayac.EKSIK_URUN_KARTI}`);

  pool.end();
  if (anomaliler.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error('HATA:', err);
  pool.end();
  process.exit(2);
});
