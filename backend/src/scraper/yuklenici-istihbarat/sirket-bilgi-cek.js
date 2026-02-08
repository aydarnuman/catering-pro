/**
 * Şirket Bilgileri Modülü (MERSİS + Ticaret Sicil Gazetesi)
 * ──────────────────────────────────────────────────────────
 * İki kaynaktan firma bilgilerini çeker:
 *
 * 1. MERSİS (mersis.gtb.gov.tr) — Ticaret Bakanlığı Merkezi Sicil Kayıt Sistemi
 *    - Firma tescil bilgileri, MERSİS numarası
 *    - Kuruluş tarihi, faaliyet alanı, sermaye
 *
 * 2. Ticaret Sicil Gazetesi (ticaretsicil.gov.tr)
 *    - Şirket kuruluş/değişiklik ilanları
 *    - Ortaklık yapısı değişiklikleri
 *    - Sermaye artırımları
 *
 * Dönen veri formatı:
 * {
 *   mersis: { mersis_no, kuruluş_tarihi, faaliyet_alani, sermaye, adres, ... },
 *   ticaret_sicil: [ { ilan_tarihi, ilan_turu, ozet } ],
 *   sorgulama_tarihi: ISO string,
 *   kaynaklar: ["mersis.gtb.gov.tr", "ticaretsicil.gov.tr"]
 * }
 */

import logger from '../shared/scraper-logger.js';

const MODULE_NAME = 'Sirket-Bilgi';
const MERSIS_URL = 'https://mersis.gtb.gov.tr';
const TICARET_SICIL_URL = 'https://www.ticaretsicil.gov.tr/';

/**
 * MERSİS'ten firma bilgilerini çeker.
 */
async function scrapeMersis(page, firmaAdi) {
  logger.info(MODULE_NAME, `MERSİS sorgusu: "${firmaAdi}"`);

  try {
    await page.goto(MERSIS_URL, { waitUntil: 'networkidle2', timeout: 30000 });

    // MERSİS'in arama kutusunu bul
    const aramaKutusu = await page.$('input[id*="firmaAdi"], input[name*="firmaAdi"], input[placeholder*="firma"]');
    if (!aramaKutusu) {
      logger.warn(MODULE_NAME, 'MERSİS arama kutusu bulunamadı');
      return { basarili: false, not: 'MERSİS arama kutusu bulunamadı — sayfa yapısı değişmiş olabilir' };
    }

    await aramaKutusu.click({ clickCount: 3 });
    await aramaKutusu.type(firmaAdi, { delay: 30 });

    // Ara butonuna tıkla
    const araBtn = await page.$('button[type="submit"], input[type="submit"], button[id*="ara"]');
    if (araBtn) {
      await araBtn.click();
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
      await new Promise((r) => setTimeout(r, 2000));
    }

    // Sonuçları oku
    const sonuclar = await page.evaluate(() => {
      const data = {};

      // Tablo veya card yapısındaki bilgileri çek
      const rows = document.querySelectorAll('table tr, .firma-bilgi .row, .detail-row');
      for (const row of rows) {
        const label = row.querySelector('th, .label, td:first-child')?.textContent?.trim();
        const value = row.querySelector('td:last-child, .value, td:nth-child(2)')?.textContent?.trim();
        if (label && value && label !== value) {
          // Türkçe alanları normalleştir
          const key = label
            .toLowerCase()
            .replace(/[^a-zğüşıöç0-9\s]/g, '')
            .replace(/\s+/g, '_')
            .trim();
          if (key) data[key] = value;
        }
      }

      return data;
    });

    return {
      basarili: true,
      ...sonuclar,
    };
  } catch (error) {
    logger.error(MODULE_NAME, `MERSİS hatası: ${error.message}`);
    return { basarili: false, not: `MERSİS erişim hatası: ${error.message}` };
  }
}

/**
 * Ticaret Sicil Gazetesi'nden firma ilanlarını çeker.
 */
async function scrapeTicaretSicil(page, firmaAdi) {
  logger.info(MODULE_NAME, `Ticaret Sicil sorgusu: "${firmaAdi}"`);

  try {
    await page.goto(TICARET_SICIL_URL, { waitUntil: 'networkidle2', timeout: 30000 });

    // Arama kutusunu bul
    const aramaKutusu = await page.$('input[id*="arama"], input[name*="search"], input[type="text"]');
    if (!aramaKutusu) {
      logger.warn(MODULE_NAME, 'Ticaret Sicil arama kutusu bulunamadı');
      return { basarili: false, ilanlar: [], not: 'Ticaret Sicil arama kutusu bulunamadı' };
    }

    await aramaKutusu.click({ clickCount: 3 });
    await aramaKutusu.type(firmaAdi, { delay: 30 });

    // Ara
    const araBtn = await page.$('button[type="submit"], input[type="submit"]');
    if (araBtn) {
      await araBtn.click();
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
      await new Promise((r) => setTimeout(r, 2000));
    }

    // İlanları oku
    const ilanlar = await page.evaluate(() => {
      const results = [];
      const items = document.querySelectorAll('.ilan-item, .result-item, table tbody tr');

      for (const item of items) {
        const tarih = item.querySelector('.tarih, td:first-child, .date')?.textContent?.trim();
        const tur = item.querySelector('.tur, td:nth-child(2), .type')?.textContent?.trim();
        const ozet = item.querySelector('.ozet, td:nth-child(3), .summary, .content')?.textContent?.trim();
        const link = item.querySelector('a')?.href;

        if (tarih || ozet) {
          results.push({
            ilan_tarihi: tarih || '',
            ilan_turu: tur || '',
            ozet: ozet?.substring(0, 300) || '', // 300 karakter sınırı
            link: link || '',
          });
        }
      }

      return results.slice(0, 20); // Max 20 ilan
    });

    return {
      basarili: true,
      ilanlar,
      toplam: ilanlar.length,
    };
  } catch (error) {
    logger.error(MODULE_NAME, `Ticaret Sicil hatası: ${error.message}`);
    return { basarili: false, ilanlar: [], not: `Ticaret Sicil erişim hatası: ${error.message}` };
  }
}

/**
 * Ana fonksiyon: MERSİS + Ticaret Sicil verilerini birleştirerek döner.
 * @param {Object} yuklenici - { id, unvan, kisa_ad }
 * @returns {Object} Birleşik şirket bilgileri
 */
export async function scrapeSirketBilgileri(yuklenici) {
  const session = logger.createSession(MODULE_NAME);
  session.info(`Şirket bilgileri çekiliyor: "${yuklenici.unvan}"`);

  let page;
  try {
    const { default: browserManager } = await import('../shared/browser.js');
    page = await browserManager.createPage();

    const firmaAdi = yuklenici.kisa_ad || yuklenici.unvan;

    // İki kaynağı sırayla sorgula (aynı sayfa)
    const mersis = await scrapeMersis(page, firmaAdi);
    const ticaretSicil = await scrapeTicaretSicil(page, firmaAdi);

    const result = {
      mersis,
      ticaret_sicil: ticaretSicil,
      sorgulama_tarihi: new Date().toISOString(),
      kaynaklar: ['mersis.gtb.gov.tr', 'ticaretsicil.gov.tr'],
    };

    return session.end(result);
  } catch (error) {
    session.error(`Şirket bilgileri hatası: ${error.message}`);
    throw error;
  } finally {
    if (page && !page.isClosed()) await page.close().catch(() => {});
  }
}
