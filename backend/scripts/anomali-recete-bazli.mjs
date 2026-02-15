#!/usr/bin/env node
/**
 * Reçete Bazlı Fiyat Anomali Tespit Scripti (v2)
 *
 * İyileştirmeler:
 * - Ürün bazlı birim dönüşüm desteği (urun_birim_donusumleri)
 * - Fiyat kaynağı bilgisi (hangi fiyat kullanıldı)
 * - Malzeme bazlı detaylı sorun raporu
 * - Fiyatı eski (>90 gün) olan malzemeler için uyarı
 * - Ciddiyet sınıflandırması
 *
 * Kullanım: cd backend && node scripts/anomali-recete-bazli.mjs [--esik 5] [--min-tl 0.50]
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
async function query(text, params) { return pool.query(text, params); }

const args = process.argv.slice(2);
function argVal(name, def) { const i = args.indexOf(name); return i >= 0 && args[i + 1] ? args[i + 1] : def; }
const ESIK_YUZDE = Number(argVal('--esik', '5'));
const MIN_TL_FARK = Number(argVal('--min-tl', '0.50'));

const FALLBACK = { 'g:kg': 0.001, 'gr:kg': 0.001, 'ml:lt': 0.001, 'ml:l': 0.001 };
function normBirim(b, map) { if (!b) return 'g'; const l = b.toLowerCase().trim(); return map.get(l) || l; }
function getCarpan(k, h, dMap, uMap, uid) {
  if (k === h) return 1;
  if (uid && uMap) { const uk = `${uid}:${k}:${h}`; if (uMap.has(uk)) return uMap.get(uk); }
  const key = `${k}:${h}`; return dMap.get(key) ?? FALLBACK[key] ?? null;
}

const FIYAT_GUN = 90;
function fiyatGuncel(t) { if (!t) return false; const g = Math.floor((new Date() - new Date(t)) / 86400000); return g >= 0 && g <= FIYAT_GUN; }
function eskiGun(t) { if (!t) return null; return Math.floor((new Date() - new Date(t)) / 86400000); }

function enIyiFiyat(m) {
  const ub = (m.urun_standart_birim || m.urun_fiyat_birimi || 'kg').toLowerCase();
  const g = fiyatGuncel(m.urun_son_alis_tarihi);
  if (Number(m.urun_aktif_fiyat) > 0) return { f: Number(m.urun_aktif_fiyat), b: ub, k: 'aktif' };
  if (g && Number(m.urun_son_alis) > 0) return { f: Number(m.urun_son_alis), b: ub, k: 'son_alis' };
  if (Number(m.piyasa_fiyat) > 0) return { f: Number(m.piyasa_fiyat), b: m.piyasa_birim_tipi?.toLowerCase() || ub, k: 'piyasa' };
  if (Number(m.urun_son_alis) > 0) return { f: Number(m.urun_son_alis), b: ub, k: 'eski_alis' };
  if (Number(m.urun_manuel_fiyat) > 0) return { f: Number(m.urun_manuel_fiyat), b: ub, k: 'manuel' };
  if (Number(m.varyant_fiyat) > 0) return { f: Number(m.varyant_fiyat), b: ub, k: 'varyant' };
  return { f: 0, b: ub, k: 'yok' };
}

async function main() {
  console.log('=== RECETE BAZLI ANOMALi RAPORU (v2) ===');
  console.log(`Tarih: ${new Date().toISOString().slice(0, 10)}`);
  console.log(`Sapma esigi: %${ESIK_YUZDE} | Min TL fark: ₺${MIN_TL_FARK.toFixed(2)}`);
  console.log('');

  const [bE, dR, uD] = await Promise.all([
    query('SELECT varyasyon, standart FROM birim_eslestirme'),
    query('SELECT kaynak_birim, hedef_birim, carpan FROM birim_donusumleri'),
    query('SELECT urun_kart_id, kaynak_birim, hedef_birim, carpan FROM urun_birim_donusumleri'),
  ]);
  const birimMap = new Map(); for (const r of bE.rows) birimMap.set(r.varyasyon.toLowerCase(), r.standart.toLowerCase());
  const donusumMap = new Map(); for (const r of dR.rows) donusumMap.set(`${r.kaynak_birim.toLowerCase()}:${r.hedef_birim.toLowerCase()}`, Number(r.carpan));
  const urunDMap = new Map(); for (const r of uD.rows) urunDMap.set(`${r.urun_kart_id}:${r.kaynak_birim.toLowerCase()}:${r.hedef_birim.toLowerCase()}`, Number(r.carpan));

  const recetelerR = await query(`SELECT r.id, r.ad, r.tahmini_maliyet, rk.ad as kategori FROM receteler r LEFT JOIN recete_kategoriler rk ON rk.id = r.kategori_id WHERE r.aktif = true ORDER BY r.ad`);

  const malzR = await query(`
    SELECT rm.recete_id, rm.malzeme_adi, rm.miktar, rm.sef_miktar, rm.aktif_miktar_tipi,
      rm.birim, rm.urun_kart_id,
      urk.ad as urun_adi, urk.manuel_fiyat as urun_manuel_fiyat, urk.aktif_fiyat as urun_aktif_fiyat,
      urk.son_alis_fiyati as urun_son_alis, urk.son_alis_tarihi as urun_son_alis_tarihi,
      urk.fiyat_birimi as urun_fiyat_birimi, urk.birim as urun_standart_birim,
      COALESCE(ufo.birim_fiyat_ekonomik,
        (SELECT piyasa_fiyat_ort FROM piyasa_fiyat_gecmisi WHERE urun_kart_id=rm.urun_kart_id AND rm.urun_kart_id IS NOT NULL ORDER BY arastirma_tarihi DESC LIMIT 1)
      ) as piyasa_fiyat, ufo.birim_tipi as piyasa_birim_tipi,
      get_en_iyi_varyant_fiyat(rm.urun_kart_id) as varyant_fiyat
    FROM recete_malzemeler rm
    LEFT JOIN urun_kartlari urk ON urk.id = rm.urun_kart_id
    LEFT JOIN urun_fiyat_ozet ufo ON ufo.urun_kart_id = rm.urun_kart_id
    ORDER BY rm.recete_id, rm.sira
  `);
  const mByR = new Map();
  for (const m of malzR.rows) { if (!mByR.has(m.recete_id)) mByR.set(m.recete_id, []); mByR.get(m.recete_id).push(m); }

  const sorunlar = { sapma: [], birim: [], sifir: [], eksik: [], eski: [] };

  for (const rec of recetelerR.rows) {
    const malz = mByR.get(rec.id) || [];
    if (malz.length === 0) continue;

    let hesaplanan = 0;
    const recSorunlar = [];

    for (const m of malz) {
      if (!m.urun_kart_id) {
        recSorunlar.push({ tip: 'EKSIK_URUN_KARTI', malzeme: m.malzeme_adi, detay: 'Urun kartina eslestirilmemis' });
        sorunlar.eksik.push({ recete: rec.ad, malzeme: m.malzeme_adi });
        continue;
      }

      const am = m.aktif_miktar_tipi === 'sef' && m.sef_miktar != null ? Number(m.sef_miktar) : Number(m.miktar) || 0;
      const mb = normBirim(m.birim, birimMap);
      const { f, b, k: fKaynak } = enIyiFiyat(m);

      if (f === 0) {
        recSorunlar.push({ tip: 'SIFIR_FIYAT', malzeme: m.malzeme_adi, detay: `${m.urun_adi || '?'} — hicbir kaynakta fiyat yok` });
        sorunlar.sifir.push({ recete: rec.ad, malzeme: m.malzeme_adi, urun: m.urun_adi });
        continue;
      }

      const c = getCarpan(mb, b, donusumMap, urunDMap, m.urun_kart_id);
      if (c === null) {
        recSorunlar.push({ tip: 'BIRIM_HATASI', malzeme: m.malzeme_adi, detay: `${mb} -> ${b} donusumu yok` });
        sorunlar.birim.push({ recete: rec.ad, malzeme: m.malzeme_adi, kaynak: mb, hedef: b });
        continue;
      }

      hesaplanan += am * c * f;

      // Eski fiyat uyarısı
      if (fKaynak === 'eski_alis') {
        const gun = eskiGun(m.urun_son_alis_tarihi);
        sorunlar.eski.push({ recete: rec.ad, malzeme: m.malzeme_adi, gun, fiyat: f });
      }
    }

    hesaplanan = Math.round(hesaplanan * 100) / 100;
    const kayitli = Number(rec.tahmini_maliyet) || 0;
    const fark = kayitli - hesaplanan;
    let sapmaYuzde = hesaplanan > 0 ? (fark / hesaplanan) * 100 : (kayitli > 0 ? 100 : 0);
    sapmaYuzde = Math.round(sapmaYuzde * 10) / 10;

    if (Math.abs(sapmaYuzde) > ESIK_YUZDE && Math.abs(fark) >= MIN_TL_FARK) {
      sorunlar.sapma.push({
        recete: rec.ad, kategori: rec.kategori || '—',
        hesaplanan, kayitli, fark: Math.round(fark * 100) / 100, sapma: sapmaYuzde,
      });
    }
  }

  // ── Çıktı ──
  console.log(`Toplam aktif recete: ${recetelerR.rows.length}`);
  console.log('');

  // 1. Maliyet sapmaları
  if (sorunlar.sapma.length > 0) {
    console.log(`--- MALIYET SAPMASI (${sorunlar.sapma.length} recete) ---`);
    const hdr = ['#'.padStart(3), 'Recete'.padEnd(28), 'Kategori'.padEnd(16), 'Hesaplanan'.padStart(12), 'Kayitli'.padStart(12), 'Fark'.padStart(10), 'Sapma%'.padStart(8)].join(' | ');
    console.log(hdr);
    console.log('-'.repeat(hdr.length));
    for (let i = 0; i < sorunlar.sapma.length; i++) {
      const s = sorunlar.sapma[i];
      console.log([String(i + 1).padStart(3), s.recete.slice(0, 28).padEnd(28), s.kategori.slice(0, 16).padEnd(16),
        `₺${s.hesaplanan.toFixed(2)}`.padStart(12), `₺${s.kayitli.toFixed(2)}`.padStart(12),
        `${s.fark > 0 ? '+' : ''}₺${s.fark.toFixed(2)}`.padStart(10),
        `${s.sapma > 0 ? '+' : ''}${s.sapma}%`.padStart(8)].join(' | '));
    }
    console.log('');
  }

  // 2. Birim hataları (benzersiz çiftlere göre grupla)
  if (sorunlar.birim.length > 0) {
    const ciftler = new Map();
    for (const b of sorunlar.birim) {
      const key = `${b.kaynak}->${b.hedef}`;
      if (!ciftler.has(key)) ciftler.set(key, []);
      ciftler.get(key).push(b);
    }
    console.log(`--- BIRIM DONUSUM HATASI (${sorunlar.birim.length} malzeme, ${ciftler.size} benzersiz cift) ---`);
    for (const [cift, list] of ciftler) {
      console.log(`  ${cift}:`);
      for (const b of list.slice(0, 3)) console.log(`    - [${b.recete}] ${b.malzeme}`);
      if (list.length > 3) console.log(`    ... ve ${list.length - 3} daha`);
    }
    console.log('');
  }

  // 3. Sıfır fiyatlılar
  if (sorunlar.sifir.length > 0) {
    console.log(`--- SIFIR FIYATLI MALZEME (${sorunlar.sifir.length}) ---`);
    for (const s of sorunlar.sifir) console.log(`  [${s.recete}] ${s.malzeme} (${s.urun})`);
    console.log('');
  }

  // 4. Eksik ürün kartı
  if (sorunlar.eksik.length > 0) {
    console.log(`--- EKSIK URUN KARTI (${sorunlar.eksik.length}) ---`);
    for (const s of sorunlar.eksik) console.log(`  [${s.recete}] ${s.malzeme}`);
    console.log('');
  }

  // 5. Eski fiyatlar
  if (sorunlar.eski.length > 0) {
    console.log(`--- ESKI FIYAT UYARISI (>90 gun, ${sorunlar.eski.length} malzeme) ---`);
    const sorted = sorunlar.eski.sort((a, b) => b.gun - a.gun);
    for (const s of sorted.slice(0, 15)) console.log(`  [${s.recete}] ${s.malzeme}: ${s.gun} gun once, ₺${s.fiyat.toFixed(2)}/kg`);
    if (sorted.length > 15) console.log(`  ... ve ${sorted.length - 15} daha`);
    console.log('');
  }

  // Özet
  console.log('=== OZET ===');
  const toplam = sorunlar.sapma.length + sorunlar.birim.length + sorunlar.sifir.length + sorunlar.eksik.length;
  console.log(`  Maliyet sapmasi: ${sorunlar.sapma.length}`);
  console.log(`  Birim hatasi: ${sorunlar.birim.length}`);
  console.log(`  Sifir fiyat: ${sorunlar.sifir.length}`);
  console.log(`  Eksik urun karti: ${sorunlar.eksik.length}`);
  console.log(`  Eski fiyat uyarisi: ${sorunlar.eski.length}`);
  console.log(`  TOPLAM SORUN: ${toplam}`);

  pool.end();
  if (toplam > 0) process.exit(1);
}

main().catch((err) => { console.error('HATA:', err); pool.end(); process.exit(2); });
