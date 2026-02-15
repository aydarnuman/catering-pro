#!/usr/bin/env node
/**
 * Şartname Bazlı Fiyat Anomali Tespit Scripti (v2)
 *
 * İyileştirmeler:
 * - TL cinsinden minimum fark eşiği (kuruş seviyesi sapmalar filtrelenir)
 * - Reçete bazlı toplam maliyet karşılaştırması (malzeme bazlı değil)
 * - Porsiyon bazlı maliyet özeti
 * - Ciddi/orta/düşük seviye anomali sınıflandırması
 * - Eşleşmeyen malzeme raporu (hangi malzemeler şartnamede tanımsız)
 *
 * Kullanım: cd backend && node scripts/anomali-sartname-bazli.mjs [--esik 10] [--min-tl 0.50] [--sartname KYK]
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

// ── CLI argümanları ──
const args = process.argv.slice(2);
function argVal(name, def) { const i = args.indexOf(name); return i >= 0 && args[i + 1] ? args[i + 1] : def; }
const ESIK_YUZDE = Number(argVal('--esik', '10'));
const MIN_TL_FARK = Number(argVal('--min-tl', '0.50'));
const FILTRE_SARTNAME = argVal('--sartname', null);

// ── Ortak yardımcılar ──
const FALLBACK = { 'g:kg': 0.001, 'gr:kg': 0.001, 'ml:lt': 0.001, 'ml:l': 0.001 };

function normBirim(b, map) { if (!b) return 'g'; const l = b.toLowerCase().trim(); return map.get(l) || l; }

function getCarpan(k, h, dMap, uMap, uid) {
  if (k === h) return 1;
  if (uid && uMap) { const uk = `${uid}:${k}:${h}`; if (uMap.has(uk)) return uMap.get(uk); }
  const key = `${k}:${h}`; return dMap.get(key) ?? FALLBACK[key] ?? null;
}

function malzemeTipiEslestirTumu(ad, sozluk) {
  if (!ad || !sozluk?.length) return [];
  const n = String(ad).toLowerCase().trim();
  const m = [];
  for (const e of sozluk) {
    let best = 0;
    for (const k of (e.eslesen_kelimeler || [])) {
      if (!k) continue; const nk = String(k).toLowerCase().trim();
      if (nk && n.includes(nk) && nk.length > best) best = nk.length;
    }
    if (best > 0) m.push({ malzeme_tipi: e.malzeme_tipi, score: best });
  }
  m.sort((a, b) => b.score - a.score || b.malzeme_tipi.length - a.malzeme_tipi.length);
  return m;
}

function dogrudan_isim_eslestir(ad, kurallar) {
  if (!ad || !kurallar?.length) return null;
  const n = String(ad).toLowerCase().trim();
  for (const k of kurallar) if (k.malzeme_tipi?.toLowerCase().trim() === n) return k;
  let best = null, bestLen = 0;
  for (const k of kurallar) {
    if (!k.malzeme_tipi) continue;
    const t = k.malzeme_tipi.toLowerCase().trim();
    if (t.length <= 3) { if (new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(n) && t.length > bestLen) { best = k; bestLen = t.length; } }
    else if (n.includes(t) && t.length > bestLen) { best = k; bestLen = t.length; }
  }
  return best;
}

function kuralBul(ad, sozluk, altK, tumK) {
  const esl = malzemeTipiEslestirTumu(ad, sozluk);
  if (altK.length > 0) {
    for (const e of esl) { const k = altK.find((x) => x.malzeme_tipi === e.malzeme_tipi); if (k) return k; }
    const k = dogrudan_isim_eslestir(ad, altK); if (k) return k;
  }
  for (const e of esl) { const k = tumK.find((x) => x.malzeme_tipi === e.malzeme_tipi); if (k) return k; }
  return dogrudan_isim_eslestir(ad, tumK);
}

const FIYAT_GUN = 90;
function fiyatGuncel(t) { if (!t) return false; const g = Math.floor((new Date() - new Date(t)) / 86400000); return g >= 0 && g <= FIYAT_GUN; }
function enIyiFiyat(m) {
  const ub = (m.urun_standart_birim || m.urun_fiyat_birimi || 'kg').toLowerCase();
  const g = fiyatGuncel(m.urun_son_alis_tarihi);
  if (Number(m.urun_aktif_fiyat) > 0) return { f: Number(m.urun_aktif_fiyat), b: ub };
  if (g && Number(m.urun_son_alis) > 0) return { f: Number(m.urun_son_alis), b: ub };
  if (Number(m.piyasa_fiyat) > 0) return { f: Number(m.piyasa_fiyat), b: m.piyasa_birim_tipi?.toLowerCase() || ub };
  if (Number(m.urun_son_alis) > 0) return { f: Number(m.urun_son_alis), b: ub };
  if (Number(m.urun_manuel_fiyat) > 0) return { f: Number(m.urun_manuel_fiyat), b: ub };
  if (Number(m.varyant_fiyat) > 0) return { f: Number(m.varyant_fiyat), b: ub };
  return { f: 0, b: ub };
}

// ── Ana akış ──
async function main() {
  console.log('=== SARTNAME BAZLI ANOMALi RAPORU (v2) ===');
  console.log(`Tarih: ${new Date().toISOString().slice(0, 10)}`);
  console.log(`Sapma esigi: %${ESIK_YUZDE} | Min TL fark: ₺${MIN_TL_FARK.toFixed(2)}${FILTRE_SARTNAME ? ` | Sartname: ${FILTRE_SARTNAME}` : ''}`);
  console.log('');

  const [bE, dR, uD, sR] = await Promise.all([
    query('SELECT varyasyon, standart FROM birim_eslestirme'),
    query('SELECT kaynak_birim, hedef_birim, carpan FROM birim_donusumleri'),
    query('SELECT urun_kart_id, kaynak_birim, hedef_birim, carpan FROM urun_birim_donusumleri'),
    query('SELECT * FROM malzeme_tip_eslesmeleri WHERE aktif = true'),
  ]);
  const birimMap = new Map(); for (const r of bE.rows) birimMap.set(r.varyasyon.toLowerCase(), r.standart.toLowerCase());
  const donusumMap = new Map(); for (const r of dR.rows) donusumMap.set(`${r.kaynak_birim.toLowerCase()}:${r.hedef_birim.toLowerCase()}`, Number(r.carpan));
  const urunDMap = new Map(); for (const r of uD.rows) urunDMap.set(`${r.urun_kart_id}:${r.kaynak_birim.toLowerCase()}:${r.hedef_birim.toLowerCase()}`, Number(r.carpan));
  const sozluk = sR.rows;

  // Şartnameler
  let sartnameSql = `SELECT ps.id, ps.kod, ps.ad FROM proje_sartnameleri ps
    WHERE ps.aktif = true AND EXISTS (SELECT 1 FROM sartname_gramaj_kurallari sgk WHERE sgk.sartname_id = ps.id AND sgk.aktif = true)`;
  const sartParams = [];
  if (FILTRE_SARTNAME) { sartnameSql += ' AND UPPER(ps.kod) = $1'; sartParams.push(FILTRE_SARTNAME.toUpperCase()); }
  sartnameSql += ' ORDER BY ps.id';
  const sartnameler = await query(sartnameSql, sartParams);

  // Tüm kurallar
  const tumKurallarR = await query('SELECT * FROM sartname_gramaj_kurallari WHERE aktif = true');
  const kuralBySart = new Map();
  for (const k of tumKurallarR.rows) { if (!kuralBySart.has(k.sartname_id)) kuralBySart.set(k.sartname_id, []); kuralBySart.get(k.sartname_id).push(k); }

  // Reçeteler (alt_tip_id'li)
  const recetelerR = await query(`SELECT r.id, r.ad, r.kod, r.alt_tip_id, r.tahmini_maliyet, rk.ad as kategori FROM receteler r LEFT JOIN recete_kategoriler rk ON rk.id = r.kategori_id WHERE r.aktif = true AND r.alt_tip_id IS NOT NULL ORDER BY r.ad`);

  // Malzemeler
  const malzR = await query(`
    SELECT rm.recete_id, rm.malzeme_adi, rm.miktar, rm.sef_miktar, rm.aktif_miktar_tipi,
      rm.birim, rm.urun_kart_id,
      urk.manuel_fiyat as urun_manuel_fiyat, urk.aktif_fiyat as urun_aktif_fiyat,
      urk.son_alis_fiyati as urun_son_alis, urk.son_alis_tarihi as urun_son_alis_tarihi,
      urk.fiyat_birimi as urun_fiyat_birimi, urk.birim as urun_standart_birim,
      COALESCE(ufo.birim_fiyat_ekonomik,
        (SELECT piyasa_fiyat_ort FROM piyasa_fiyat_gecmisi WHERE urun_kart_id=rm.urun_kart_id AND rm.urun_kart_id IS NOT NULL ORDER BY arastirma_tarihi DESC LIMIT 1)
      ) as piyasa_fiyat, ufo.birim_tipi as piyasa_birim_tipi,
      get_en_iyi_varyant_fiyat(rm.urun_kart_id) as varyant_fiyat
    FROM recete_malzemeler rm
    LEFT JOIN urun_kartlari urk ON urk.id = rm.urun_kart_id
    LEFT JOIN urun_fiyat_ozet ufo ON ufo.urun_kart_id = rm.urun_kart_id
    WHERE rm.recete_id = ANY($1)
    ORDER BY rm.recete_id, rm.sira
  `, [recetelerR.rows.map((r) => r.id)]);
  const mByR = new Map();
  for (const m of malzR.rows) { if (!mByR.has(m.recete_id)) mByR.set(m.recete_id, []); mByR.get(m.recete_id).push(m); }

  // ── İşleme: reçete toplam seviyesinde karşılaştırma ──
  const receteAnomalileri = []; // { sartname, recete, kategori, sartnameMaliyet, receteMaliyet, sapma, ciddiyet, detaylar[] }
  const eslesmeyenMalzemeler = new Map(); // malzeme_adi -> sayı

  for (const sart of sartnameler.rows) {
    const tumK = kuralBySart.get(sart.id) || [];
    if (tumK.length === 0) continue;

    for (const rec of recetelerR.rows) {
      const malzemeler = mByR.get(rec.id) || [];
      if (malzemeler.length === 0) continue;

      const altK = tumK.filter((k) => Number(k.alt_tip_id) === Number(rec.alt_tip_id));
      let sartMaliyet = 0, recMaliyet = 0;
      const detaylar = [];
      let eslesmeyenSayisi = 0;

      for (const m of malzemeler) {
        const recMiktar = m.aktif_miktar_tipi === 'sef' && m.sef_miktar != null ? Number(m.sef_miktar) : Number(m.miktar) || 0;
        const recBirim = normBirim(m.birim, birimMap);
        const { f: fiyat, b: fBirim } = enIyiFiyat(m);
        if (fiyat === 0) continue;

        const recCarpan = getCarpan(recBirim, fBirim, donusumMap, urunDMap, m.urun_kart_id);
        if (recCarpan === null) continue;
        const recMal = recMiktar * recCarpan * fiyat;
        recMaliyet += recMal;

        const kural = kuralBul(m.malzeme_adi, sozluk, altK, tumK);
        if (kural) {
          const sGramaj = Number(kural.gramaj) || 0;
          const sBirim = normBirim(kural.birim || 'g', birimMap);
          const sCarpan = getCarpan(sBirim, fBirim, donusumMap, urunDMap, m.urun_kart_id);
          if (sCarpan !== null) {
            const sMal = sGramaj * sCarpan * fiyat;
            sartMaliyet += sMal;
            const fark = recMal - sMal;
            if (Math.abs(fark) >= MIN_TL_FARK && sMal > 0) {
              const yuzde = (fark / sMal) * 100;
              if (Math.abs(yuzde) > ESIK_YUZDE) {
                detaylar.push({ malzeme: m.malzeme_adi, sGramaj: `${sGramaj}${sBirim}`, rMiktar: `${recMiktar}${recBirim}`, beklenen: sMal, mevcut: recMal, fark, yuzde });
              }
            }
          } else { sartMaliyet += recMal; } // dönüşüm yok → fallback
        } else {
          sartMaliyet += recMal; // kural yok → reçete değerini kullan
          eslesmeyenSayisi++;
          const key = m.malzeme_adi;
          eslesmeyenMalzemeler.set(key, (eslesmeyenMalzemeler.get(key) || 0) + 1);
        }
      }

      sartMaliyet = Math.round(sartMaliyet * 100) / 100;
      recMaliyet = Math.round(recMaliyet * 100) / 100;

      if (sartMaliyet === 0 && recMaliyet === 0) continue;
      const ref = Math.max(sartMaliyet, recMaliyet);
      const toplamSapma = ref > 0 ? ((recMaliyet - sartMaliyet) / ref) * 100 : 0;
      const toplamFark = recMaliyet - sartMaliyet;

      if (Math.abs(toplamSapma) > ESIK_YUZDE && Math.abs(toplamFark) >= MIN_TL_FARK) {
        let ciddiyet = 'DUSUK';
        if (Math.abs(toplamFark) >= 20) ciddiyet = 'CIDDI';
        else if (Math.abs(toplamFark) >= 5) ciddiyet = 'ORTA';

        receteAnomalileri.push({
          sartname: sart.kod, recete: rec.ad, kategori: rec.kategori || '—',
          sartMaliyet, recMaliyet, sapma: Math.round(toplamSapma * 10) / 10,
          fark: Math.round(toplamFark * 100) / 100, ciddiyet,
          detaylar: detaylar.sort((a, b) => Math.abs(b.fark) - Math.abs(a.fark)),
        });
      }
    }
  }

  // ── Sınıflandır ve yazdır ──
  const ciddi = receteAnomalileri.filter((a) => a.ciddiyet === 'CIDDI');
  const orta = receteAnomalileri.filter((a) => a.ciddiyet === 'ORTA');
  const dusuk = receteAnomalileri.filter((a) => a.ciddiyet === 'DUSUK');

  console.log(`Toplam taranan: ${recetelerR.rows.length} recete x ${sartnameler.rows.length} sartname`);
  console.log(`Anomali: ${receteAnomalileri.length} (ciddi: ${ciddi.length}, orta: ${orta.length}, dusuk: ${dusuk.length})`);
  console.log('');

  function printGroup(title, items) {
    if (items.length === 0) return;
    console.log(`--- ${title} (${items.length}) ---`);
    const hdr = ['#'.padStart(3), 'Sartname'.padEnd(12), 'Recete'.padEnd(28), 'Kategori'.padEnd(16),
      'Sart.Mal.'.padStart(10), 'Rec.Mal.'.padStart(10), 'Fark'.padStart(10), 'Sapma%'.padStart(8)].join(' | ');
    console.log(hdr);
    console.log('-'.repeat(hdr.length));
    for (let i = 0; i < items.length; i++) {
      const a = items[i];
      console.log([String(i + 1).padStart(3), a.sartname.slice(0, 12).padEnd(12), a.recete.slice(0, 28).padEnd(28),
        a.kategori.slice(0, 16).padEnd(16), `₺${a.sartMaliyet.toFixed(2)}`.padStart(10),
        `₺${a.recMaliyet.toFixed(2)}`.padStart(10),
        `${a.fark > 0 ? '+' : ''}₺${a.fark.toFixed(2)}`.padStart(10),
        `${a.sapma > 0 ? '+' : ''}${a.sapma}%`.padStart(8)].join(' | '));
      // En önemli 3 malzeme detayı
      for (const d of a.detaylar.slice(0, 3)) {
        console.log(`      └─ ${d.malzeme}: sart=${d.sGramaj} rec=${d.rMiktar} fark=${d.fark > 0 ? '+' : ''}₺${d.fark.toFixed(2)}`);
      }
      if (a.detaylar.length > 3) console.log(`      └─ ... ve ${a.detaylar.length - 3} malzeme daha`);
    }
    console.log('');
  }

  printGroup('CIDDI (fark >= ₺20)', ciddi);
  printGroup('ORTA (fark ₺5-20)', orta);
  if (dusuk.length > 0) console.log(`--- DUSUK (${dusuk.length} adet, fark < ₺5) --- (detay gosterilmiyor)\n`);

  // Eşleşmeyen malzemeler
  if (eslesmeyenMalzemeler.size > 0) {
    const sorted = [...eslesmeyenMalzemeler.entries()].sort((a, b) => b[1] - a[1]);
    console.log(`--- SARTNAMEDE TANIMSIZ MALZEMELER (${sorted.length} cesit) ---`);
    for (const [ad, cnt] of sorted.slice(0, 20)) {
      console.log(`  ${ad}: ${cnt} recete-sartname ciftinde esleşmiyor`);
    }
    if (sorted.length > 20) console.log(`  ... ve ${sorted.length - 20} daha`);
    console.log('');
  }

  // Alt tip'i olmayan reçeteler
  const altTipYokR = await query('SELECT id, ad FROM receteler WHERE aktif = true AND alt_tip_id IS NULL');
  if (altTipYokR.rows.length > 0) {
    console.log(`--- ALT TIPI ATANMAMIS RECETELER (${altTipYokR.rows.length}) ---`);
    for (const r of altTipYokR.rows) console.log(`  ID:${r.id} ${r.ad}`);
    console.log('');
  }

  pool.end();
  if (ciddi.length > 0) process.exit(1);
}

main().catch((err) => { console.error('HATA:', err); pool.end(); process.exit(2); });
