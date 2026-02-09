/**
 * Hal Kayıt Sistemi (hal.gov.tr) Scraper
 * T.C. Ticaret Bakanlığı günlük toptancı hal fiyatlarını çeker.
 * ~400 ürün: Tüm taze sebze, meyve, yaş gıda.
 *
 * Kullanım:
 *   import { syncHalFiyatlari, searchHalPrices } from './hal-scraper.js';
 *   await syncHalFiyatlari();            // Tüm verileri DB'ye yaz
 *   const r = await searchHalPrices('Armut'); // Fuzzy arama
 */

import * as cheerio from 'cheerio';
import { query } from '../database.js';
import logger from '../utils/logger.js';

// ─── CONSTANTS ───────────────────────────────────────────

const HAL_URL = 'https://www.hal.gov.tr/Sayfalar/FiyatDetaylari.aspx';
const TABLE_SELECTOR =
  '#ctl00_ctl37_g_7e86b8d6_3aea_47cf_b1c1_939799a091e0_gvFiyatlar';
const EVENT_TARGET =
  'ctl00$ctl37$g_7e86b8d6_3aea_47cf_b1c1_939799a091e0$gvFiyatlar';
const MAX_PAGES = 25; // Güvenlik sınırı
const REQUEST_TIMEOUT = 20_000;
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

// ─── SCRAPER ─────────────────────────────────────────────

/**
 * Tek bir HTML sayfasından ürün satırlarını parse et
 */
function parseHalPage($) {
  const rows = [];
  $(`${TABLE_SELECTOR} tr`).each((_i, row) => {
    const cells = $(row).find('td');
    if (cells.length < 6) return; // Header satırını atla

    const urunAdi = $(cells[0]).text().trim();
    const urunCinsi = $(cells[1]).text().trim();
    const urunTuru = $(cells[2]).text().trim();
    const ortFiyatStr = $(cells[3]).text().trim();
    const islemHacmiStr = $(cells[4]).text().trim();
    const birim = $(cells[5]).text().trim();

    // Fiyat parse: "23,85" → 23.85
    const ortFiyat = parseFloat(ortFiyatStr.replace('.', '').replace(',', '.'));
    const islemHacmi = parseInt(islemHacmiStr.replace('.', '').replace(',', ''), 10);

    if (!urunAdi || Number.isNaN(ortFiyat)) return;

    rows.push({
      urunAdi,
      urunCinsi: urunCinsi || urunAdi,
      urunTuru: urunTuru || 'Geleneksel(Konvansiyonel)',
      ortFiyat,
      islemHacmi: Number.isNaN(islemHacmi) ? 0 : islemHacmi,
      birim: birim || 'Kg',
    });
  });
  return rows;
}

/**
 * Bülten tarihini sayfadan çıkar
 * Örnek: "Bülten Tarihi : 28.04.2025 (27.04.2025 Tarihli Veriler...)"
 */
function parseBultenTarihi($) {
  const text = $.text();
  const match = text.match(
    /Bülten Tarihi\s*:\s*(\d{2})\.(\d{2})\.(\d{4})/
  );
  if (match) {
    return `${match[3]}-${match[2]}-${match[1]}`; // YYYY-MM-DD
  }
  // Fallback: bugün
  return new Date().toISOString().split('T')[0];
}

/**
 * ASP.NET ViewState bilgilerini çıkar (sayfalama için gerekli)
 */
function extractAspNetState($) {
  return {
    viewState: $('#__VIEWSTATE').val() || '',
    viewStateGen: $('#__VIEWSTATEGENERATOR').val() || '',
    eventValidation: $('#__EVENTVALIDATION').val() || '',
  };
}

/**
 * hal.gov.tr'den TÜM sayfaları çekerek ürün listesini oluştur
 * @returns {{ rows: Array, bultenTarihi: string }}
 */
async function fetchAllHalPages() {
  const allRows = [];

  // Sayfa 1 (GET)
  const res1 = await fetch(HAL_URL, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT),
  });

  if (!res1.ok) {
    throw new Error(`hal.gov.tr erişilemedi: ${res1.status}`);
  }

  let html = await res1.text();
  const cookies = (res1.headers.getSetCookie?.() || [])
    .map((c) => c.split(';')[0])
    .join('; ');

  let $ = cheerio.load(html);
  const bultenTarihi = parseBultenTarihi($);

  // Sayfa 1 parse
  const page1Rows = parseHalPage($);
  allRows.push(...page1Rows);

  if (page1Rows.length === 0) {
    return { rows: allRows, bultenTarihi };
  }

  // Sonraki sayfaları çek (ASP.NET PostBack ile)
  for (let page = 2; page <= MAX_PAGES; page++) {
    const state = extractAspNetState($);

    const body = new URLSearchParams({
      __VIEWSTATE: state.viewState,
      __VIEWSTATEGENERATOR: state.viewStateGen,
      __EVENTVALIDATION: state.eventValidation,
      __EVENTTARGET: EVENT_TARGET,
      __EVENTARGUMENT: `Page$${page}`,
    });

    const res = await fetch(HAL_URL, {
      method: 'POST',
      headers: {
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: cookies,
      },
      body: body.toString(),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    });

    if (!res.ok) break;

    html = await res.text();
    $ = cheerio.load(html);

    const pageRows = parseHalPage($);
    if (pageRows.length === 0) break; // Son sayfa

    allRows.push(...pageRows);
  }

  return { rows: allRows, bultenTarihi };
}

// ─── DB SYNC ─────────────────────────────────────────────

/**
 * hal.gov.tr verilerini çekip hal_fiyatlari tablosuna yaz
 * Aynı tarih için tekrar çalışırsa UPSERT yapar.
 */
export async function syncHalFiyatlari() {
  try {
    logger.info('[hal-scraper] Senkronizasyon başlıyor...');

    const { rows, bultenTarihi } = await fetchAllHalPages();

    if (rows.length === 0) {
      logger.warn('[hal-scraper] Hiç veri bulunamadı');
      return { success: false, error: 'Veri yok' };
    }

    // Batch upsert (ON CONFLICT güncelle)
    let inserted = 0;
    let updated = 0;

    for (const row of rows) {
      const result = await query(
        `INSERT INTO hal_fiyatlari
           (urun_adi, urun_cinsi, urun_turu, ortalama_fiyat, islem_hacmi, birim, bulten_tarihi, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         ON CONFLICT (urun_adi, urun_cinsi, urun_turu, bulten_tarihi)
         DO UPDATE SET
           ortalama_fiyat = EXCLUDED.ortalama_fiyat,
           islem_hacmi = EXCLUDED.islem_hacmi,
           updated_at = NOW()
         RETURNING (xmax = 0) AS is_insert`,
        [
          row.urunAdi,
          row.urunCinsi,
          row.urunTuru,
          row.ortFiyat,
          row.islemHacmi,
          row.birim,
          bultenTarihi,
        ]
      );

      if (result.rows[0]?.is_insert) inserted++;
      else updated++;
    }

    logger.info(
      `[hal-scraper] Tamamlandı: ${rows.length} ürün, ${inserted} yeni, ${updated} güncelleme, tarih: ${bultenTarihi}`
    );

    return {
      success: true,
      toplam: rows.length,
      yeni: inserted,
      guncelleme: updated,
      bultenTarihi,
    };
  } catch (error) {
    logger.error(`[hal-scraper] Hata: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// ─── FUZZY SEARCH ────────────────────────────────────────

/**
 * Türkçe karakter normalize (büyük harf + I/İ düzeltme)
 */
function turkishUpper(str) {
  return str
    .replace(/i/g, 'İ')
    .replace(/ı/g, 'I')
    .toUpperCase();
}

/**
 * Basit Türkçe stem: sonundaki ekleri temizle
 * "Armut" → "ARMUT", "Domates" → "DOMATES", "Patlıcan" → "PATLICAN"
 */
function simpleStem(word) {
  let w = turkishUpper(word.trim());
  // Yaygın Türkçe ekleri sırayla çıkar
  const suffixes = ['LARI', 'LERİ', 'LARI', 'SI', 'Sİ', 'SU', 'SÜ', 'I', 'İ', 'U', 'Ü'];
  for (const s of suffixes) {
    if (w.length > 3 && w.endsWith(s)) {
      w = w.slice(0, -s.length);
      break;
    }
  }
  return w;
}

/**
 * Hal fiyatlarında ürün ara (fuzzy matching)
 *
 * @param {string} urunAdi - Aranan ürün adı ("Armut", "Domates" vb.)
 * @returns {{ success: boolean, sonuclar: Array, ozet: object }}
 */
export async function searchHalPrices(urunAdi) {
  if (!urunAdi || urunAdi.trim().length < 2) {
    return { success: false, error: 'Ürün adı çok kısa' };
  }

  const searchUpper = turkishUpper(urunAdi.trim());
  const searchStem = simpleStem(urunAdi);

  try {
    // 1. Önce tam eşleşme dene (en hızlı)
    let result = await query(
      `SELECT urun_adi, urun_cinsi, urun_turu, ortalama_fiyat, islem_hacmi, birim, bulten_tarihi
       FROM hal_fiyatlari
       WHERE UPPER(urun_adi) = $1
       ORDER BY bulten_tarihi DESC, islem_hacmi DESC
       LIMIT 20`,
      [searchUpper]
    );

    // 2. Tam eşleşme yoksa LIKE ile ara
    if (result.rows.length === 0) {
      result = await query(
        `SELECT urun_adi, urun_cinsi, urun_turu, ortalama_fiyat, islem_hacmi, birim, bulten_tarihi
         FROM hal_fiyatlari
         WHERE UPPER(urun_adi) LIKE $1 OR UPPER(urun_adi) LIKE $2
         ORDER BY bulten_tarihi DESC, islem_hacmi DESC
         LIMIT 20`,
        [`%${searchUpper}%`, `%${searchStem}%`]
      );
    }

    // 3. Hala yoksa trigram similarity ile fuzzy ara
    if (result.rows.length === 0) {
      result = await query(
        `SELECT urun_adi, urun_cinsi, urun_turu, ortalama_fiyat, islem_hacmi, birim, bulten_tarihi,
                similarity(urun_adi, $1) AS sim_score
         FROM hal_fiyatlari
         WHERE similarity(urun_adi, $1) > 0.2
         ORDER BY sim_score DESC, bulten_tarihi DESC
         LIMIT 20`,
        [searchUpper]
      );
    }

    if (result.rows.length === 0) {
      return { success: false, error: `Hal verilerinde "${urunAdi}" bulunamadı` };
    }

    // En güncel bülten tarihindeki verileri filtrele
    const latestDate = result.rows[0].bulten_tarihi;
    const latestRows = result.rows.filter(
      (r) =>
        new Date(r.bulten_tarihi).toISOString().split('T')[0] ===
        new Date(latestDate).toISOString().split('T')[0]
    );

    // Cinslere göre grupla
    const sonuclar = latestRows.map((r) => ({
      urunAdi: r.urun_adi,
      urunCinsi: r.urun_cinsi,
      urunTuru: r.urun_turu,
      fiyat: parseFloat(r.ortalama_fiyat),
      islemHacmi: parseInt(r.islem_hacmi, 10),
      birim: r.birim,
      tarih: r.bulten_tarihi,
    }));

    // İşlem hacmine göre ağırlıklı ortalama (daha çok satılan cins daha etkili)
    const totalHacim = sonuclar.reduce((s, r) => s + (r.islemHacmi || 1), 0);
    const agirlikliOrt =
      totalHacim > 0
        ? sonuclar.reduce(
            (s, r) => s + r.fiyat * ((r.islemHacmi || 1) / totalHacim),
            0
          )
        : sonuclar.reduce((s, r) => s + r.fiyat, 0) / sonuclar.length;

    const fiyatlar = sonuclar.map((r) => r.fiyat);
    const min = Math.min(...fiyatlar);
    const max = Math.max(...fiyatlar);

    return {
      success: true,
      kaynak: 'hal.gov.tr',
      kaynakTip: 'toptanci_hal',
      urun: urunAdi,
      birim: sonuclar[0]?.birim || 'Kg',
      bultenTarihi: latestRows[0]?.tarih,
      min: Math.round(min * 100) / 100,
      max: Math.round(max * 100) / 100,
      ortalama: Math.round(agirlikliOrt * 100) / 100,
      toplam_sonuc: sonuclar.length,
      sonuclar,
      // piyasa_fiyat_arastir uyumlu format
      fiyatlar: sonuclar.map((r) => ({
        market: `Toptancı Hal (${r.urunCinsi})`,
        urun: `${r.urunAdi} - ${r.urunCinsi} (${r.urunTuru})`,
        fiyat: r.fiyat,
        birimFiyat: r.fiyat,
        birimTipi: r.birim === 'Adet' ? 'adet' : 'kg',
        barkod: undefined,
        marka: r.urunCinsi,
        urunAdiTemiz: r.urunAdi,
        ambalajMiktar: 1,
        aramaTermi: urunAdi,
        alakaSkor: 100,
      })),
    };
  } catch (error) {
    logger.error(`[hal-scraper] Arama hatası: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Hal verisinde veri var mı ve ne kadar güncel kontrol et
 */
export async function getHalDataStatus() {
  try {
    const result = await query(
      `SELECT
         COUNT(*) as toplam_kayit,
         MAX(bulten_tarihi) as son_tarih,
         COUNT(DISTINCT urun_adi) as benzersiz_urun
       FROM hal_fiyatlari`
    );
    const row = result.rows[0];
    return {
      hasData: parseInt(row.toplam_kayit, 10) > 0,
      toplamKayit: parseInt(row.toplam_kayit, 10),
      sonTarih: row.son_tarih,
      benzersizUrun: parseInt(row.benzersiz_urun, 10),
    };
  } catch {
    return { hasData: false, toplamKayit: 0, sonTarih: null, benzersizUrun: 0 };
  }
}

export default {
  syncHalFiyatlari,
  searchHalPrices,
  getHalDataStatus,
};
