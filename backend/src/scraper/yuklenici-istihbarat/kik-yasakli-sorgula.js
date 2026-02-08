/**
 * KİK Yasaklılar Sorgusu
 * ───────────────────────
 * EKAP (Elektronik Kamu Alımları Platformu) üzerinden
 * bir yüklenicinin yasaklılar listesinde olup olmadığını sorgular.
 *
 * Kaynak: https://ekap.kik.gov.tr
 * Yöntem: Puppeteer ile yasaklı firma arama sayfasına gidip firma adıyla arar.
 *
 * Dönen veri formatı:
 * {
 *   yasakli_mi: boolean,
 *   sonuclar: [{ firma_adi, yasaklama_tarihi, yasaklama_suresi, yasaklama_nedeni, bitiş_tarihi }],
 *   sorgulama_tarihi: ISO string,
 *   kaynak: "ekap.kik.gov.tr"
 * }
 */

import logger from '../shared/scraper-logger.js';

const MODULE_NAME = 'KIK-Yasakli';
const EKAP_URL = 'https://ekap.kik.gov.tr/EKAP/Yasaklilar.aspx';

/**
 * EKAP yasaklılar sayfasını sorgular.
 * @param {Object} yuklenici - { id, unvan, kisa_ad }
 * @returns {Object} Sorgu sonucu
 */
export async function scrapeKikYasakli(yuklenici) {
  const session = logger.createSession(MODULE_NAME);
  session.info(`Yasaklı sorgusu başlıyor: "${yuklenici.unvan}"`);

  let page;
  try {
    // Puppeteer browser al
    const { default: browserManager } = await import('../shared/browser.js');
    page = await browserManager.createPage();

    // EKAP yasaklılar sayfasına git
    await page.goto(EKAP_URL, { waitUntil: 'networkidle2', timeout: 30000 });

    // Arama kutusunu bul ve firma adını yaz
    // EKAP'ın form yapısı: genelde bir TextBox + Button
    const aramaInput = await page.$('input[id*="txtFirmaAdi"], input[name*="FirmaAdi"], input[type="text"]');
    if (!aramaInput) {
      session.warn('EKAP arama kutusu bulunamadı — sayfa yapısı değişmiş olabilir');
      return {
        yasakli_mi: false,
        sonuclar: [],
        sorgulama_tarihi: new Date().toISOString(),
        kaynak: 'ekap.kik.gov.tr',
        not: 'EKAP arama kutusu bulunamadı. Sayfa yapısı güncellenmiş olabilir.',
      };
    }

    // Firma adını kısa ad varsa onu, yoksa ünvanı kullan
    const aramaMetni = yuklenici.kisa_ad || yuklenici.unvan;
    await aramaInput.click({ clickCount: 3 }); // Mevcut metni seç
    await aramaInput.type(aramaMetni, { delay: 50 });

    // Ara butonuna tıkla
    const araButton = await page.$('input[type="submit"][value*="Ara"], button[id*="btnAra"], input[id*="btnAra"]');
    if (araButton) {
      await araButton.click();
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
      // Bazı sayfalar AJAX kullanır, kısa bir bekleme ekle
      await new Promise((r) => setTimeout(r, 2000));
    }

    // Sonuçları oku
    const sonuclar = await page.evaluate(() => {
      const rows = [];
      // Tablo satırlarını bul (EKAP genelde GridView kullanır)
      const tableRows = document.querySelectorAll('table[id*="Grid"] tr, table.grid tr, .resultTable tr');

      for (const tr of tableRows) {
        const cells = tr.querySelectorAll('td');
        if (cells.length < 3) continue; // Başlık satırını atla

        rows.push({
          firma_adi: cells[0]?.textContent?.trim() || '',
          yasaklama_tarihi: cells[1]?.textContent?.trim() || '',
          yasaklama_suresi: cells[2]?.textContent?.trim() || '',
          yasaklama_nedeni: cells[3]?.textContent?.trim() || '',
          bitis_tarihi: cells[4]?.textContent?.trim() || '',
        });
      }
      return rows;
    });

    // Firma adı eşleşmesini kontrol et (kısmi eşleşme)
    const normalizedUnvan = yuklenici.unvan.toLowerCase().replace(/\s+/g, ' ').trim();
    const eslesen = sonuclar.filter(
      (s) => s.firma_adi.toLowerCase().includes(normalizedUnvan) || normalizedUnvan.includes(s.firma_adi.toLowerCase())
    );

    const result = {
      yasakli_mi: eslesen.length > 0,
      sonuclar: eslesen.length > 0 ? eslesen : sonuclar.slice(0, 5), // Eşleşme yoksa ilk 5'i göster
      tum_sonuc_sayisi: sonuclar.length,
      sorgulama_tarihi: new Date().toISOString(),
      kaynak: 'ekap.kik.gov.tr',
    };

    session.info(
      eslesen.length > 0
        ? `DİKKAT: "${yuklenici.unvan}" yasaklılar listesinde BULUNDU! (${eslesen.length} kayıt)`
        : `"${yuklenici.unvan}" yasaklılar listesinde bulunamadı (${sonuclar.length} genel sonuç)`
    );

    return session.end(result);
  } catch (error) {
    session.error(`Yasaklı sorgusu hatası: ${error.message}`);
    throw error;
  } finally {
    if (page && !page.isClosed()) await page.close().catch(() => {});
  }
}
