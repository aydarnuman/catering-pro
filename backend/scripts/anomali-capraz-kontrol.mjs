#!/usr/bin/env node
/**
 * Çapraz Kontrol Anomali Tespit Scripti (v2)
 *
 * Tüm sorunları tek bir yerden özetler:
 * 1. Fiyatı olmayan veya sıfır olan malzemeler
 * 2. Birim dönüşümü yapılamayan malzemeler
 * 3. Ürün kartı eksik malzemeler
 * 4. Alt tipi atanmamış reçeteler
 * 5. Şartname-reçete maliyet uyumsuzlukları (reçete toplam bazlı)
 * 6. Fiyat güvenilirlik analizi (hangi fiyatlar eskimiş)
 *
 * Kullanım: cd backend && node scripts/anomali-capraz-kontrol.mjs [--esik 10] [--min-tl 1]
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
const ESIK_YUZDE = Number(argVal('--esik', '10'));
const MIN_TL_FARK = Number(argVal('--min-tl', '1'));

const FALLBACK = { 'g:kg': 0.001, 'gr:kg': 0.001, 'ml:lt': 0.001, 'ml:l': 0.001 };
function normBirim(b, map) { if (!b) return 'g'; const l = b.toLowerCase().trim(); return map.get(l) || l; }
function getCarpan(k, h, dMap, uMap, uid) {
  if (k === h) return 1;
  if (uid && uMap) { const uk = `${uid}:${k}:${h}`; if (uMap.has(uk)) return uMap.get(uk); }
  const key = `${k}:${h}`; return dMap.get(key) ?? FALLBACK[key] ?? null;
}

function malzemeTipiEslestirTumu(ad, sozluk) {
  if (!ad || !sozluk?.length) return [];
  const n = String(ad).toLowerCase().trim(); const m = [];
  for (const e of sozluk) { let best = 0; for (const k of (e.eslesen_kelimeler || [])) { if (!k) continue; const nk = String(k).toLowerCase().trim(); if (nk && n.includes(nk) && nk.length > best) best = nk.length; } if (best > 0) m.push({ malzeme_tipi: e.malzeme_tipi, score: best }); }
  m.sort((a, b) => b.score - a.score || b.malzeme_tipi.length - a.malzeme_tipi.length); return m;
}
function dogrudan_isim_eslestir(ad, kurallar) {
  if (!ad || !kurallar?.length) return null; const n = String(ad).toLowerCase().trim();
  for (const k of kurallar) if (k.malzeme_tipi?.toLowerCase().trim() === n) return k;
  let best = null, bestLen = 0;
  for (const k of kurallar) { if (!k.malzeme_tipi) continue; const t = k.malzeme_tipi.toLowerCase().trim(); if (t.length <= 3) { if (new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(n) && t.length > bestLen) { best = k; bestLen = t.length; } } else if (n.includes(t) && t.length > bestLen) { best = k; bestLen = t.length; } }
  return best;
}
function kuralBul(ad, sozluk, altK, tumK) {
  const esl = malzemeTipiEslestirTumu(ad, sozluk);
  if (altK.length > 0) { for (const e of esl) { const k = altK.find((x) => x.malzeme_tipi === e.malzeme_tipi); if (k) return k; } const k = dogrudan_isim_eslestir(ad, altK); if (k) return k; }
  for (const e of esl) { const k = tumK.find((x) => x.malzeme_tipi === e.malzeme_tipi); if (k) return k; }
  return dogrudan_isim_eslestir(ad, tumK);
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
  console.log('=== CAPRAZ KONTROL RAPORU (v2) ===');
  console.log(`Tarih: ${new Date().toISOString().slice(0, 10)}`);
  console.log(`Capraz sapma esigi: %${ESIK_YUZDE} | Min TL fark: ₺${MIN_TL_FARK.toFixed(2)}`);
  console.log('');

  // Veri yükle
  const [bE, dR, uD, sR, kR] = await Promise.all([
    query('SELECT varyasyon, standart FROM birim_eslestirme'),
    query('SELECT kaynak_birim, hedef_birim, carpan FROM birim_donusumleri'),
    query('SELECT urun_kart_id, kaynak_birim, hedef_birim, carpan FROM urun_birim_donusumleri'),
    query('SELECT * FROM malzeme_tip_eslesmeleri WHERE aktif = true'),
    query('SELECT * FROM sartname_gramaj_kurallari WHERE aktif = true'),
  ]);
  const birimMap = new Map(); for (const r of bE.rows) birimMap.set(r.varyasyon.toLowerCase(), r.standart.toLowerCase());
  const donusumMap = new Map(); for (const r of dR.rows) donusumMap.set(`${r.kaynak_birim.toLowerCase()}:${r.hedef_birim.toLowerCase()}`, Number(r.carpan));
  const urunDMap = new Map(); for (const r of uD.rows) urunDMap.set(`${r.urun_kart_id}:${r.kaynak_birim.toLowerCase()}:${r.hedef_birim.toLowerCase()}`, Number(r.carpan));
  const sozluk = sR.rows;
  const kuralBySart = new Map();
  for (const k of kR.rows) { if (!kuralBySart.has(k.sartname_id)) kuralBySart.set(k.sartname_id, []); kuralBySart.get(k.sartname_id).push(k); }

  const sartnameler = await query(`SELECT ps.id, ps.kod FROM proje_sartnameleri ps WHERE ps.aktif = true AND EXISTS (SELECT 1 FROM sartname_gramaj_kurallari sgk WHERE sgk.sartname_id = ps.id AND sgk.aktif = true) ORDER BY ps.id`);
  const recetelerR = await query(`SELECT r.id, r.ad, r.alt_tip_id, r.tahmini_maliyet, rk.ad as kategori FROM receteler r LEFT JOIN recete_kategoriler rk ON rk.id = r.kategori_id WHERE r.aktif = true ORDER BY r.ad`);
  const malzR = await query(`
    SELECT rm.recete_id, rm.malzeme_adi, rm.miktar, rm.sef_miktar, rm.aktif_miktar_tipi,
      rm.birim, rm.urun_kart_id, urk.ad as urun_adi,
      urk.manuel_fiyat as urun_manuel_fiyat, urk.aktif_fiyat as urun_aktif_fiyat,
      urk.son_alis_fiyati as urun_son_alis, urk.son_alis_tarihi as urun_son_alis_tarihi,
      urk.fiyat_birimi as urun_fiyat_birimi, urk.birim as urun_standart_birim,
      COALESCE(ufo.birim_fiyat_ekonomik, (SELECT piyasa_fiyat_ort FROM piyasa_fiyat_gecmisi WHERE urun_kart_id=rm.urun_kart_id AND rm.urun_kart_id IS NOT NULL ORDER BY arastirma_tarihi DESC LIMIT 1)) as piyasa_fiyat,
      ufo.birim_tipi as piyasa_birim_tipi, get_en_iyi_varyant_fiyat(rm.urun_kart_id) as varyant_fiyat
    FROM recete_malzemeler rm LEFT JOIN urun_kartlari urk ON urk.id = rm.urun_kart_id LEFT JOIN urun_fiyat_ozet ufo ON ufo.urun_kart_id = rm.urun_kart_id ORDER BY rm.recete_id, rm.sira
  `);
  const mByR = new Map();
  for (const m of malzR.rows) { if (!mByR.has(m.recete_id)) mByR.set(m.recete_id, []); mByR.get(m.recete_id).push(m); }

  // ── BÖLÜM 1: Malzeme seviyesi sorunlar ──
  const sifirFiyat = [], birimHata = [], eksikKart = [], eskiFiyat = [];
  const fiyatKaynakDagilim = { aktif: 0, son_alis: 0, piyasa: 0, eski_alis: 0, manuel: 0, varyant: 0, yok: 0 };

  for (const rec of recetelerR.rows) {
    for (const m of (mByR.get(rec.id) || [])) {
      if (!m.urun_kart_id) { eksikKart.push({ recete: rec.ad, malzeme: m.malzeme_adi }); continue; }
      const mb = normBirim(m.birim, birimMap);
      const { f, b, k } = enIyiFiyat(m);
      fiyatKaynakDagilim[k]++;
      if (f === 0) { sifirFiyat.push({ recete: rec.ad, malzeme: m.malzeme_adi, urun: m.urun_adi }); continue; }
      const c = getCarpan(mb, b, donusumMap, urunDMap, m.urun_kart_id);
      if (c === null) { birimHata.push({ recete: rec.ad, malzeme: m.malzeme_adi, kaynak: mb, hedef: b }); }
      if (k === 'eski_alis') { const gun = eskiGun(m.urun_son_alis_tarihi); eskiFiyat.push({ recete: rec.ad, malzeme: m.malzeme_adi, gun, fiyat: f }); }
    }
  }

  console.log('--- BOLUM 1: MALZEME SORUNLARI ---');
  if (sifirFiyat.length === 0 && birimHata.length === 0 && eksikKart.length === 0) {
    console.log('  Kritik malzeme sorunu yok.');
  } else {
    if (sifirFiyat.length > 0) {
      console.log(`  Sifir fiyat: ${sifirFiyat.length}`);
      for (const s of sifirFiyat) console.log(`    - [${s.recete}] ${s.malzeme} (${s.urun || '?'})`);
    }
    if (birimHata.length > 0) {
      const ciftler = new Map();
      for (const b of birimHata) { const k = `${b.kaynak}->${b.hedef}`; if (!ciftler.has(k)) ciftler.set(k, []); ciftler.get(k).push(b); }
      console.log(`  Birim donusum hatasi: ${birimHata.length} (${ciftler.size} benzersiz cift)`);
      for (const [c, list] of ciftler) {
        console.log(`    ${c}: ${list.map((l) => l.malzeme).slice(0, 3).join(', ')}${list.length > 3 ? ` +${list.length - 3}` : ''}`);
      }
    }
    if (eksikKart.length > 0) {
      console.log(`  Eksik urun karti: ${eksikKart.length}`);
      for (const s of eksikKart) console.log(`    - [${s.recete}] ${s.malzeme}`);
    }
  }
  console.log('');

  // ── BÖLÜM 2: Fiyat güvenilirlik ──
  console.log('--- BOLUM 2: FIYAT KAYNAK DAGILIMI ---');
  const toplam = Object.values(fiyatKaynakDagilim).reduce((a, b) => a + b, 0);
  for (const [k, v] of Object.entries(fiyatKaynakDagilim)) {
    if (v > 0) console.log(`  ${k}: ${v} malzeme (%${((v / toplam) * 100).toFixed(1)})`);
  }
  if (eskiFiyat.length > 0) {
    const enEski = eskiFiyat.sort((a, b) => b.gun - a.gun).slice(0, 5);
    console.log(`  Eski fiyat (>90 gun): ${eskiFiyat.length} malzeme`);
    for (const e of enEski) console.log(`    - [${e.recete}] ${e.malzeme}: ${e.gun} gun once`);
  }
  console.log('');

  // ── BÖLÜM 3: Alt tipi eksik reçeteler ──
  const altTipYok = recetelerR.rows.filter((r) => r.alt_tip_id == null);
  if (altTipYok.length > 0) {
    console.log(`--- BOLUM 3: ALT TIPI ATANMAMIS RECETELER (${altTipYok.length}) ---`);
    for (const r of altTipYok) console.log(`  ${r.ad} (${r.kategori || '?'})`);
    console.log('');
  }

  // ── BÖLÜM 4: Şartname vs Reçete çapraz maliyet ──
  console.log('--- BOLUM 4: SARTNAME vs RECETE MALIYET ---');
  const recAltTipli = recetelerR.rows.filter((r) => r.alt_tip_id != null);
  const capraz = [];

  for (const sart of sartnameler.rows) {
    const tumK = kuralBySart.get(sart.id) || [];
    if (tumK.length === 0) continue;
    for (const rec of recAltTipli) {
      const malz = mByR.get(rec.id) || [];
      if (malz.length === 0) continue;
      const altK = tumK.filter((k) => Number(k.alt_tip_id) === Number(rec.alt_tip_id));
      let sM = 0, rM = 0;
      for (const m of malz) {
        if (!m.urun_kart_id) continue;
        const am = m.aktif_miktar_tipi === 'sef' && m.sef_miktar != null ? Number(m.sef_miktar) : Number(m.miktar) || 0;
        const mb = normBirim(m.birim, birimMap);
        const { f, b } = enIyiFiyat(m);
        if (f === 0) continue;
        const rc = getCarpan(mb, b, donusumMap, urunDMap, m.urun_kart_id);
        if (rc === null) continue;
        rM += am * rc * f;
        const kural = kuralBul(m.malzeme_adi, sozluk, altK, tumK);
        if (kural) {
          const sg = Number(kural.gramaj) || 0;
          const sb = normBirim(kural.birim || 'g', birimMap);
          const sc = getCarpan(sb, b, donusumMap, urunDMap, m.urun_kart_id);
          sM += sc !== null ? sg * sc * f : am * rc * f;
        } else { sM += am * rc * f; }
      }
      sM = Math.round(sM * 100) / 100;
      rM = Math.round(rM * 100) / 100;
      if (sM === 0 && rM === 0) continue;
      const fark = rM - sM;
      const ref = Math.max(sM, rM);
      const sapma = ref > 0 ? (fark / ref) * 100 : 0;
      if (Math.abs(sapma) > ESIK_YUZDE && Math.abs(fark) >= MIN_TL_FARK) {
        capraz.push({ sartname: sart.kod, recete: rec.ad, kategori: rec.kategori || '—', sM, rM, fark: Math.round(fark * 100) / 100, sapma: Math.round(sapma * 10) / 10 });
      }
    }
  }

  if (capraz.length === 0) {
    console.log(`  Esik ustunde capraz sapma yok.`);
  } else {
    // Sartname bazlı grupla
    const bySart = new Map();
    for (const c of capraz) { if (!bySart.has(c.sartname)) bySart.set(c.sartname, []); bySart.get(c.sartname).push(c); }
    console.log(`  Toplam capraz sapma: ${capraz.length} (${bySart.size} sartname)`);
    console.log('');
    for (const [sart, items] of bySart) {
      const ciddi = items.filter((i) => Math.abs(i.fark) >= 20);
      const orta = items.filter((i) => Math.abs(i.fark) >= 5 && Math.abs(i.fark) < 20);
      const dusuk = items.filter((i) => Math.abs(i.fark) < 5);
      console.log(`  ${sart}: ${items.length} sapma (ciddi:${ciddi.length} orta:${orta.length} dusuk:${dusuk.length})`);
      // Sadece ciddi olanları göster
      for (const c of ciddi.sort((a, b) => Math.abs(b.fark) - Math.abs(a.fark)).slice(0, 10)) {
        console.log(`    ${c.recete.slice(0, 30).padEnd(30)} sart:₺${c.sM.toFixed(0).padStart(4)} rec:₺${c.rM.toFixed(0).padStart(4)} fark:${c.fark > 0 ? '+' : ''}₺${c.fark.toFixed(0).padStart(4)} (${c.sapma > 0 ? '+' : ''}${c.sapma}%)`);
      }
      if (ciddi.length > 10) console.log(`    ... ve ${ciddi.length - 10} ciddi sapma daha`);
    }
  }
  console.log('');

  // ── GENEL ÖZET ──
  const toplamSorun = sifirFiyat.length + birimHata.length + eksikKart.length;
  console.log('=== GENEL OZET ===');
  console.log(`  Kritik sorunlar: ${toplamSorun}`);
  console.log(`    Sifir fiyat: ${sifirFiyat.length}`);
  console.log(`    Birim hatasi: ${birimHata.length}`);
  console.log(`    Eksik urun karti: ${eksikKart.length}`);
  console.log(`  Uyarilar:`);
  console.log(`    Alt tip eksik: ${altTipYok.length} recete`);
  console.log(`    Eski fiyat: ${eskiFiyat.length} malzeme`);
  console.log(`  Capraz sapma: ${capraz.length}`);

  pool.end();
  if (toplamSorun > 0) process.exit(1);
}

main().catch((err) => { console.error('HATA:', err); pool.end(); process.exit(2); });
