/**
 * Analyze Page Scraper
 *
 * ihalebul.com /analyze sayfasından yüklenici analiz verilerini çeker.
 * URL: /analyze?workcategory_in=15&contractortitle_in={FIRMA_ADI}
 *
 * contractors.js route'undaki POST /:id/scrape-analyze endpoint'i tarafından kullanılır.
 * Test: backend/scripts/test-analyze-scrape.mjs
 *
 * Çıktı yapısı: { ozet, yillik_trend, sektorler, idareler, yukleniciler_listesi,
 *                  ortak_girisimler, rakipler, sehirler, ihale_turleri, ihale_usulleri, teklif_turleri }
 */

import { query } from '../../database.js';
import loginService from '../shared/ihalebul-login.js';

const ANALYZE_URL = 'https://www.ihalebul.com/analyze';

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Bir yüklenicinin analiz sayfasını scrape et
 *
 * @param {import('puppeteer').Page} page
 * @param {Object} yuklenici - { id, unvan }
 * @param {Object} options
 * @param {Function} options.onProgress - İlerleme mesajı callback
 * @returns {Object} { success, data, stats, error }
 */
export async function scrapeAnalyzePage(page, yuklenici, options = {}) {
  const { onProgress = null } = options;

  const stats = {
    sections_scraped: 0,
    total_rows: 0,
    errors: [],
  };

  const progress = (msg) => {
    if (onProgress) onProgress(msg);
  };

  try {
    // Login
    progress('Giriş kontrol ediliyor...');
    await loginService.ensureLoggedIn(page);
    await delay(2000);

    // Analiz sayfasına git (Türkçe locale ile büyük harf + boşlukları + ile encode)
    const upperName = yuklenici.unvan.toLocaleUpperCase('tr-TR');
    const encodedName = encodeURIComponent(upperName).replace(/%20/g, '+');
    const url = `${ANALYZE_URL}?workcategory_in=15&contractortitle_in=${encodedName}`;
    progress(`Analiz sayfasına gidiliyor: ${yuklenici.unvan}`);

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
    await delay(3000);

    // Login kontrolü (analiz sayfası premium olabilir)
    if (!(await loginService.isLoggedIn(page))) {
      await loginService.forceRelogin(page);
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
      await delay(3000);
    }

    // Sayfa boş mu veya hata var mı kontrol
    const pageCheck = await page.evaluate(() => {
      const text = document.body.innerText;
      if (text.includes('Sonuç bulunamadı') || text.includes('Veri bulunamadı')) {
        return { empty: true };
      }
      if (text.includes('Premium') || text.includes('Üyelik')) {
        return { paywall: true };
      }
      return { ok: true };
    });

    if (pageCheck.empty) {
      return { success: false, data: null, stats, error: 'Analiz verisi bulunamadı' };
    }
    if (pageCheck.paywall) {
      return { success: false, data: null, stats, error: 'Premium içerik - erişim gerekli' };
    }

    // Sayfanın tam yüklenmesini bekle (grafikler/tablolar)
    progress('Sayfa yükleniyor, tablolar bekleniyor...');
    await delay(3000);

    // Scroll ile tüm bölümleri tetikle
    await page.evaluate(async () => {
      const distance = 500;
      const delay = 300;
      let total = 0;
      while (total < document.body.scrollHeight) {
        window.scrollBy(0, distance);
        total += distance;
        await new Promise((r) => setTimeout(r, delay));
      }
      window.scrollTo(0, 0);
    });
    await delay(2000);

    // === VERİ ÇIKARIM ===
    const data = {};

    // 1. Özet istatistikler
    progress('Özet bilgiler çıkarılıyor...');
    try {
      data.ozet = await extractSummary(page);
      if (data.ozet) stats.sections_scraped++;
    } catch (e) {
      stats.errors.push(`Özet: ${e.message}`);
    }

    // Debug: sayfadaki tablo sayısını kontrol et (tüm bölümler tek sayfada yükleniyor)
    const tableCount = await page.evaluate(() => document.querySelectorAll('table').length);
    progress(`Sayfa yüklendi: ${tableCount} tablo bulundu`);

    // 2. Yıllık trend — Frontend: { yil, ort_katilimci, ort_gecerli_teklif, tenzilat_yuzde, devam_eden, tamamlanan, toplam_sozlesme }
    progress('Yıllık trend çıkarılıyor...');
    try {
      data.yillik_trend = await extractTable(page, ['yıllık', 'yillik', 'yillara', 'trend'], 'auto');
      if (data.yillik_trend?.length > 0) {
        stats.sections_scraped++;
        stats.total_rows += data.yillik_trend.length;
      }
    } catch (e) {
      stats.errors.push(`Yıllık trend: ${e.message}`);
    }

    // 3. Sektörler — Frontend: { cpv_kodu, sektor_adi, guncel, gecmis, devam_eden, tamamlanan, toplam_sozlesme }
    progress('Sektör dağılımı çıkarılıyor...');
    try {
      data.sektorler = await extractTable(page, ['sektör', 'sektor', 'cpv'], 'auto');
      if (data.sektorler?.length > 0) {
        stats.sections_scraped++;
        stats.total_rows += data.sektorler.length;
      }
    } catch (e) {
      stats.errors.push(`Sektörler: ${e.message}`);
    }

    // 4. İdareler — Frontend: { idare_adi, guncel, gecmis, devam_eden, tamamlanan, toplam_sozlesme }
    progress('İdare listesi çıkarılıyor...');
    try {
      data.idareler = await extractTable(page, ['idare', 'kurum'], 'auto');
      if (data.idareler?.length > 0) {
        stats.sections_scraped++;
        stats.total_rows += data.idareler.length;
      }
    } catch (e) {
      stats.errors.push(`İdareler: ${e.message}`);
    }

    // 5. Yükleniciler listesi
    progress('Yüklenici listesi çıkarılıyor...');
    try {
      data.yukleniciler_listesi = await extractTable(page, ['yüklenici'], 'auto');
      if (data.yukleniciler_listesi?.length > 0) {
        stats.sections_scraped++;
        stats.total_rows += data.yukleniciler_listesi.length;
      }
    } catch (e) {
      stats.errors.push(`Yükleniciler: ${e.message}`);
    }

    // 6. Ortak girişimler
    progress('Ortak girişimler çıkarılıyor...');
    try {
      data.ortak_girisimler = await extractTable(page, ['ortak girişim', 'ortak'], 'auto');
      if (data.ortak_girisimler?.length > 0) {
        stats.sections_scraped++;
        stats.total_rows += data.ortak_girisimler.length;
      }
    } catch (e) {
      stats.errors.push(`Ortak girişimler: ${e.message}`);
    }

    // 7. Rakipler
    progress('Rakipler çıkarılıyor...');
    try {
      data.rakipler = await extractTable(page, ['rakip'], 'auto');
      if (data.rakipler?.length > 0) {
        stats.sections_scraped++;
        stats.total_rows += data.rakipler.length;
      }
    } catch (e) {
      stats.errors.push(`Rakipler: ${e.message}`);
    }

    // 8. Şehirler
    progress('Şehir dağılımı çıkarılıyor...');
    try {
      data.sehirler = await extractTable(page, ['şehir', 'sehir', 'il '], 'auto');
      if (data.sehirler?.length > 0) {
        stats.sections_scraped++;
        stats.total_rows += data.sehirler.length;
      }
    } catch (e) {
      stats.errors.push(`Şehirler: ${e.message}`);
    }

    // 9. İhale türleri
    progress('İhale türleri çıkarılıyor...');
    try {
      data.ihale_turleri = await extractTable(page, ['ihale tür', 'ihale türü'], 'auto');
      if (data.ihale_turleri?.length > 0) {
        stats.sections_scraped++;
        stats.total_rows += data.ihale_turleri.length;
      }
    } catch (e) {
      stats.errors.push(`İhale türleri: ${e.message}`);
    }

    // 10. İhale usulleri
    progress('İhale usulleri çıkarılıyor...');
    try {
      data.ihale_usulleri = await extractTable(page, ['usul', 'usulü'], 'auto');
      if (data.ihale_usulleri?.length > 0) {
        stats.sections_scraped++;
        stats.total_rows += data.ihale_usulleri.length;
      }
    } catch (e) {
      stats.errors.push(`İhale usulleri: ${e.message}`);
    }

    // 11. Teklif türleri
    progress('Teklif türleri çıkarılıyor...');
    try {
      data.teklif_turleri = await extractTable(page, ['teklif tür', 'teklif türü'], 'auto');
      if (data.teklif_turleri?.length > 0) {
        stats.sections_scraped++;
        stats.total_rows += data.teklif_turleri.length;
      }
    } catch (e) {
      stats.errors.push(`Teklif türleri: ${e.message}`);
    }

    // Veriyi frontend TypeScript tipleriyle uyumlu hale getir
    normalizeAnalyzData(data);

    // DB'ye kaydet
    progress('Veriler kaydediliyor...');
    
    // Analiz verisinden devam_eden_is_sayisi çıkar
    const devamEdenSayisi = data.ozet?.devam_eden?.sayi ?? data.ozet?.aktif_ihale ?? null;
    
    const veriKaynagi = JSON.stringify([{ kaynak: 'analiz_sayfasi', tarih: new Date().toISOString() }]);

    if (devamEdenSayisi !== null) {
      await query(
        `UPDATE yukleniciler SET 
          analiz_verisi = $1, 
          analiz_scraped_at = NOW(), 
          devam_eden_is_sayisi = $3,
          veri_kaynaklari = (
            SELECT jsonb_agg(DISTINCT elem)
            FROM jsonb_array_elements(
              COALESCE(veri_kaynaklari, '[]'::jsonb) || $4::jsonb
            ) AS elem
          ),
          updated_at = NOW() 
        WHERE id = $2`,
        [JSON.stringify(data), yuklenici.id, devamEdenSayisi, veriKaynagi]
      );
    } else {
      await query(
        `UPDATE yukleniciler SET 
          analiz_verisi = $1, 
          analiz_scraped_at = NOW(), 
          veri_kaynaklari = (
            SELECT jsonb_agg(DISTINCT elem)
            FROM jsonb_array_elements(
              COALESCE(veri_kaynaklari, '[]'::jsonb) || $3::jsonb
            ) AS elem
          ),
          updated_at = NOW() 
        WHERE id = $2`,
        [JSON.stringify(data), yuklenici.id, veriKaynagi]
      );
    }

    progress(`Tamamlandı: ${stats.sections_scraped} bölüm, ${stats.total_rows} satır`);

    return { success: true, data, stats };
  } catch (error) {
    stats.errors.push(error.message);
    return { success: false, data: null, stats, error: error.message };
  }
}

/**
 * Özet istatistikleri çıkar (sayfa üst kısmındaki sayısal bilgiler)
 *
 * ihalebul.com /analyze sayfası formatı:
 *   "Geçmiş ihaleler 97 İhale Listele"
 *   "Devam eden 13 İhale ₺3.316.994.233 Listele"
 *   "Tamamlanan 84 İhale ₺1.112.151.569 Listele"
 *   "Toplam iş bitirme (5 Yıl) 52 Sözleşme ₺1.054.483.492"
 *   "Toplam sözleşme 99 Sözleşme ₺4.429.145.802"
 *   "Ortalama tenzilat +12,16%"
 *   "Ortalama sözleşme süresi 209 Gün"
 */
async function extractSummary(page) {
  return await page.evaluate(() => {
    const text = document.body.innerText;
    const summary = {};

    // Geçmiş ihaleler
    const gecmisMatch = text.match(/Geçmiş ihaleler\s*(\d+)/i);
    if (gecmisMatch) summary.gecmis_ihale = parseInt(gecmisMatch[1], 10);

    // Devam eden
    const devamMatch = text.match(/Devam eden\s*(\d+)\s*İhale\s*₺?([\d.,]+)?/i);
    if (devamMatch) {
      summary.devam_eden = {
        sayi: parseInt(devamMatch[1], 10),
        bedel: devamMatch[2] || null,
      };
    }

    // Tamamlanan
    const tamMatch = text.match(/Tamamlanan\s*(\d+)\s*İhale\s*₺?([\d.,]+)?/i);
    if (tamMatch) {
      summary.tamamlanan = {
        sayi: parseInt(tamMatch[1], 10),
        bedel: tamMatch[2] || null,
      };
    }

    // Toplam iş bitirme
    const isBitirmeMatch = text.match(/Toplam iş bitirme[^₺]*?(\d+)\s*Sözleşme\s*₺?([\d.,]+)/i);
    if (isBitirmeMatch) {
      summary.is_bitirme = {
        sayi: parseInt(isBitirmeMatch[1], 10),
        bedel: isBitirmeMatch[2],
      };
    }

    // Toplam sözleşme
    const toplamSozMatch = text.match(/Toplam sözleşme\s*(\d+)\s*Sözleşme\s*₺?([\d.,]+)/i);
    if (toplamSozMatch) {
      summary.toplam_sozlesme = {
        sayi: parseInt(toplamSozMatch[1], 10),
        bedel: toplamSozMatch[2],
      };
    }

    // Yıllık ortalama
    const yillikMatch = text.match(/Yıllık ortalama\s*(\d+)\s*Sözleşme\s*₺?([\d.,]+)/i);
    if (yillikMatch) {
      summary.yillik_ortalama = {
        sayi: parseInt(yillikMatch[1], 10),
        bedel: yillikMatch[2],
      };
    }

    // Ortalama tenzilat
    const tenzilatMatch = text.match(/Ortalama tenzilat\s*\+?([\d.,]+)%/i);
    if (tenzilatMatch) summary.ortalama_tenzilat = parseFloat(tenzilatMatch[1].replace(',', '.'));

    // Ortalama sözleşme süresi
    const sureMatch = text.match(/Ortalama sözleşme süresi\s*(\d+)\s*Gün/i);
    if (sureMatch) summary.ortalama_sozlesme_suresi_gun = parseInt(sureMatch[1], 10);

    // İlk / son sözleşme tarihi
    const ilkTarihMatch = text.match(/İlk sözleşme tarihi\s*([\d.]+)/i);
    if (ilkTarihMatch) summary.ilk_sozlesme_tarihi = ilkTarihMatch[1];

    const sonTarihMatch = text.match(/Son sözleşme tarihi\s*([\d.]+)/i);
    if (sonTarihMatch) summary.son_sozlesme_tarihi = sonTarihMatch[1];

    // İptal ihaleler
    const iptalMatch = text.match(/İptal ihaleler?\s*(\d+)/i);
    if (iptalMatch) summary.iptal_ihale = parseInt(iptalMatch[1], 10);

    // KİK kararları
    const kikMatch = text.match(/KİK karar[ıl](?:ar[ıi])?\s*(\d+)/i);
    if (kikMatch) summary.kik_kararlari = parseInt(kikMatch[1], 10);

    // Eski format uyumluluğu
    if (summary.devam_eden) summary.aktif_ihale = summary.devam_eden.sayi;
    if (summary.gecmis_ihale) summary.toplam_ihale = summary.gecmis_ihale;

    return Object.keys(summary).length > 0 ? summary : null;
  });
}

/**
 * Bedel string'ini (örn: "17.373.120" veya "3.316.994.233") sayıya çevir
 */
function parseBedel(bedelStr) {
  if (!bedelStr || typeof bedelStr !== 'string') return null;
  // Binlik ayracı "." kaldır, ondalık "," → "." çevir
  const cleaned = bedelStr.replace(/\./g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return Number.isNaN(num) ? null : num;
}

/**
 * Scraper'ın ham çıktısını frontend TS tiplerine dönüştür.
 *
 * Temel farklar:
 *   - ozet.*.bedel (string) → ozet.*.tutar (number)
 *   - ozet.ortalama_tenzilat (number) → ozet.ort_tenzilat.yuzde (number)
 *   - ozet.ortalama_sozlesme_suresi_gun → ozet.ort_sozlesme_suresi_gun
 *   - ozet.ilk_sozlesme_tarihi → ozet.ilk_sozlesme
 *   - ozet.son_sozlesme_tarihi → ozet.son_sozlesme
 *   - ozet.is_bitirme → ozet.is_bitirme_5yil
 *   - Tablo hücrelerindeki "Listele" / "ihale" metinleri temizlenir
 */
function normalizeAnalyzData(data) {
  if (!data) return;

  // ── Özet normalizasyonu ─────────────────────────────
  if (data.ozet) {
    const o = data.ozet;

    // bedel string → tutar number
    for (const key of ['devam_eden', 'tamamlanan', 'toplam_sozlesme', 'yillik_ortalama', 'is_bitirme']) {
      if (o[key] && typeof o[key] === 'object') {
        if (o[key].bedel !== undefined) {
          o[key].tutar = parseBedel(o[key].bedel);
          delete o[key].bedel;
        }
      }
    }

    // is_bitirme → is_bitirme_5yil
    if (o.is_bitirme && !o.is_bitirme_5yil) {
      o.is_bitirme_5yil = o.is_bitirme;
      delete o.is_bitirme;
    }

    // ortalama_tenzilat (number) → ort_tenzilat { yuzde, tutar }
    if (o.ortalama_tenzilat !== undefined && o.ort_tenzilat === undefined) {
      o.ort_tenzilat = {
        yuzde: typeof o.ortalama_tenzilat === 'number' ? o.ortalama_tenzilat : parseFloat(o.ortalama_tenzilat) || 0,
        tutar: null,
      };
      delete o.ortalama_tenzilat;
    }

    // ortalama_sozlesme_suresi_gun → ort_sozlesme_suresi_gun
    if (o.ortalama_sozlesme_suresi_gun !== undefined && o.ort_sozlesme_suresi_gun === undefined) {
      o.ort_sozlesme_suresi_gun = o.ortalama_sozlesme_suresi_gun;
      delete o.ortalama_sozlesme_suresi_gun;
    }

    // ilk/son_sozlesme_tarihi → ilk/son_sozlesme
    if (o.ilk_sozlesme_tarihi !== undefined && o.ilk_sozlesme === undefined) {
      o.ilk_sozlesme = o.ilk_sozlesme_tarihi;
      delete o.ilk_sozlesme_tarihi;
    }
    if (o.son_sozlesme_tarihi !== undefined && o.son_sozlesme === undefined) {
      o.son_sozlesme = o.son_sozlesme_tarihi;
      delete o.son_sozlesme_tarihi;
    }
  }

  // ── Tablo verisi normalizasyonu ─────────────────────
  // "ihale_sayisi" alanlarındaki "17 ihaleListele" → 17 (number) temizliği
  const cleanTableField = (val) => {
    if (typeof val === 'string') {
      // "17 ihaleListele" → "17"
      const cleaned = val.replace(/\s*(ihale)?\s*Listele\s*/gi, '').trim();
      const num = parseInt(cleaned, 10);
      return Number.isNaN(num) ? cleaned : num;
    }
    return val;
  };

  const tableKeys = [
    'yillik_trend',
    'rakipler', 'sehirler', 'idareler', 'sektorler',
    'ihale_usulleri', 'ihale_turleri', 'teklif_turleri',
    'yukleniciler_listesi', 'ortak_girisimler',
  ];

  // ── Tablo kolon isimlerini frontend TS tipleriyle eşleştir ──
  // extractTable() "auto" modunda Türkçe header → snake_case üretir,
  // ama frontend kısa isimler bekler (ör. guncel_ihale → guncel).
  const globalColumnRename = {
    'guncel_ihale': 'guncel',
    'gecmis_ihale': 'gecmis',
    'gecmis_ihaleler': 'gecmis',
    'toplam_sozlesme_bedeli': 'toplam_sozlesme',
    'tenzilat': 'tenzilat_yuzde',
    'tenzilat_tutari': 'tenzilat_tutar',
    'ortalama_katilimci': 'ort_katilimci',
    'ort_katilimci_sayisi': 'ort_katilimci',
    'ortalama_gecerli_teklif': 'ort_gecerli_teklif',
    'gecerli_teklif': 'ort_gecerli_teklif',
    'ort_gecerli_teklif_sayisi': 'ort_gecerli_teklif',
    'yillik_ortalama_bedeli': 'yillik_ortalama',
  };

  // İlk sütun: section'a göre beklenen alan adı (auto-detect farklı isim üretebilir)
  const sectionFirstCol = {
    'idareler': 'idare_adi',
    'rakipler': 'rakip_adi',
    'ortak_girisimler': 'partner_adi',
    'sehirler': 'sehir',
    'ihale_usulleri': 'ad',
    'ihale_turleri': 'ad',
    'teklif_turleri': 'ad',
    'yillik_trend': 'yil',
  };

  for (const key of tableKeys) {
    if (!Array.isArray(data[key]) || data[key].length === 0) continue;

    const expectedFirstCol = sectionFirstCol[key];

    data[key] = data[key].map((row) => {
      const newRow = {};
      const entries = Object.entries(row);

      for (let i = 0; i < entries.length; i++) {
        let [colName, value] = entries[i];

        // ihale_sayisi alanını temizle
        if (colName === 'ihale_sayisi') {
          value = cleanTableField(value);
        }

        // Global kolon ismi eşleştirmesi
        if (globalColumnRename[colName]) {
          colName = globalColumnRename[colName];
        }

        // İlk sütun: beklenen isimle eşleştir (auto-detect farklı isim üretmişse)
        if (i === 0 && expectedFirstCol && colName !== expectedFirstCol) {
          colName = expectedFirstCol;
        }

        newRow[colName] = value;
      }

      return newRow;
    });
  }
}

/**
 * Card-based tablo çıkarma fonksiyonu
 *
 * ihalebul.com /analyze sayfası yapısı:
 *   <div class="card">
 *     <div class="card-header">Yıllık</div>
 *     <div class="card-body">
 *       <table>...</table>
 *     </div>
 *   </div>
 *
 * Strateji:
 *   1. Tüm .card elementlerini tara
 *   2. Card başlığı keyword'lerden birini içeriyorsa eşleş
 *   3. Card içindeki tabloyu bul
 *   4. Sütun isimlerini thead'den otomatik çıkar ("auto" modu)
 *
 * @param {import('puppeteer').Page} page
 * @param {string[]} keywords - Card başlığında aranacak kelimeler
 * @param {string[]|'auto'} columnNames - 'auto' ise thead'den çıkarılır
 * @returns {Array|null}
 */
async function extractTable(page, keywords, columnNames) {
  return await page.evaluate(
    (kwList, colsParam) => {
      const results = [];

      // Türkçe İ/ı normalizasyonu: "İdareler".toLowerCase() → "i̇dareler" (combining dot)
      // Bu yüzden includes() çalışmıyor. Normalize edip düz ASCII-ish yapıyoruz.
      const normTR = (s) =>
        s
          .toLowerCase()
          .replace(/\u0130/g, 'i') // İ → i
          .replace(/\u0307/g, '') // combining dot above kaldır
          .replace(/ı/g, 'i') // dotless ı → i (opsiyonel, uyum için)
          .trim();

      // ── 1. Card-based strateji: .card elementlerini tara ──
      const cards = document.querySelectorAll('.card');
      let table = null;

      for (const card of cards) {
        const header = card.querySelector('.card-header, .card-title, h1, h2, h3, h4, h5, h6');
        if (!header) continue;

        const headerText = normTR(header.textContent);
        let matched = false;
        for (const kw of kwList) {
          if (headerText.includes(normTR(kw))) {
            matched = true;
            break;
          }
        }
        if (!matched) continue;

        // Card içindeki tabloyu bul
        table = card.querySelector('table');
        if (table) break;
      }

      // Fallback: Heading-based strateji (card bulunamazsa)
      if (!table) {
        const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6, .fw-bold, .fw-semibold');
        for (const heading of headings) {
          const headText = normTR(heading.textContent);
          let matched = false;
          for (const kw of kwList) {
            if (headText.includes(normTR(kw))) {
              matched = true;
              break;
            }
          }
          if (!matched) continue;

          // Sibling veya parent'ta tablo ara
          let el = heading;
          for (let i = 0; i < 5; i++) {
            el = el.nextElementSibling || el.parentElement;
            if (!el) break;
            const t = el.tagName === 'TABLE' ? el : el.querySelector('table');
            if (t) { table = t; break; }
          }
          if (table) break;
        }
      }

      if (!table) return null;

      // ── 2. Sütun isimlerini belirle ──────────────────
      let cols = colsParam;
      if (colsParam === 'auto') {
        const thCells = table.querySelectorAll('thead th, thead td');
        if (thCells.length > 0) {
          cols = [...thCells].map((th) => {
            let name = th.textContent.trim().toLowerCase();
            // Türkçe → ASCII key
            name = name
              .replace(/[₺%().]/g, '')
              .replace(/\s+/g, '_')
              .replace(/ı/g, 'i')
              .replace(/ö/g, 'o')
              .replace(/ü/g, 'u')
              .replace(/ç/g, 'c')
              .replace(/ş/g, 's')
              .replace(/ğ/g, 'g')
              .replace(/İ/gi, 'i')
              .replace(/[^a-z0-9_]/g, '')
              .replace(/_+/g, '_')
              .replace(/^_|_$/g, '');
            return name || `col_${Math.random().toString(36).slice(2, 6)}`;
          });
        } else {
          const firstRow = table.querySelector('tbody tr');
          if (!firstRow) return null;
          const cellCount = firstRow.querySelectorAll('td').length;
          cols = Array.from({ length: cellCount }, (_, i) => `col_${i}`);
        }
      }

      // ── 3. Tablo satırlarını parse et ────────────────
      const rows = table.querySelectorAll('tbody tr');
      rows.forEach((row) => {
        try {
          const cells = row.querySelectorAll('td');
          if (cells.length === 0) return;

          const rowData = {};
          cells.forEach((cell, i) => {
            if (i < cols.length) {
              let value = cell.textContent.trim();

              // "Listele" / "ihale" buton metinlerini temizle
              value = value.replace(/\s*(ihale)?\s*Listele\s*/gi, '').trim();

              // Sayısal değerleri temizle (ilk sütun genelde isim, diğerleri sayısal)
              if (i > 0) {
                const numStr = value.replace(/[₺%\s]/g, '').replace(/\./g, '').replace(',', '.');
                const num = parseFloat(numStr);
                if (!Number.isNaN(num) && /^[\d.,₺%\s+-]+$/.test(value)) {
                  value = num;
                }
              }

              rowData[cols[i]] = value;
            }
          });

          if (Object.keys(rowData).length > 0) {
            results.push(rowData);
          }
        } catch (_e) {}
      });

      return results.length > 0 ? results : null;
    },
    keywords,
    columnNames
  );
}

export { normalizeAnalyzData };
export default { scrapeAnalyzePage, normalizeAnalyzData };
