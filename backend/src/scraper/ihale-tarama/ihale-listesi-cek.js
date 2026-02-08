/**
 * İhale Listesi Çekici - İhale Listesi Tarayıcı
 *
 * ihalebul.com kategori 15 (Hazır Yemek) sayfalarını tarar
 * ve ihaleleri veritabanına kaydeder.
 */

import { query } from '../../database.js';
import documentScraper from './ihale-icerik-cek.js';
import loginService from '../shared/ihalebul-login.js';

const CATEGORY_URL = 'https://www.ihalebul.com/tenders/search?workcategory_in=15';
const PAGE_DELAY = 2000;

/**
 * Ana liste scraping fonksiyonu
 */
export async function scrapeList(page, options = {}) {
  const { maxPages = 100, startPage = 1, includeDocuments = false, onPageComplete = null } = options;

  const stats = { pages_scraped: 0, tenders_found: 0, tenders_new: 0, tenders_updated: 0 };
  const MAX_MASKED_RETRIES = 3;
  let maskedRetryCount = 0;
  // Login kontrol
  await loginService.ensureLoggedIn(page);
  await delay(3000);

  // Başlangıç sayfasına git
  const startUrl = startPage > 1 ? `${CATEGORY_URL}&page=${startPage}` : CATEGORY_URL;
  await page.goto(startUrl, { waitUntil: 'networkidle2', timeout: 30000 });
  await delay(PAGE_DELAY);

  let currentPage = startPage;

  // Sayfa döngüsü
  while (currentPage <= maxPages) {
    // Login kontrolü
    if (!(await loginService.isLoggedIn(page))) {
      await loginService.forceRelogin(page);
      await page.goto(`${CATEGORY_URL}&page=${currentPage}`, { waitUntil: 'networkidle2', timeout: 30000 });
      await delay(PAGE_DELAY);
    }

    // Scroll (lazy load için)
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await delay(1000);

    // İhaleleri çıkar
    const tenders = await extractTenders(page);

    if (tenders.length === 0) {
      break;
    }

    // Maskelenmiş veri kontrolü
    const maskedCount = tenders.filter((t) => isMasked(t)).length;
    if (maskedCount > tenders.length * 0.3) {
      maskedRetryCount++;
      if (maskedRetryCount > MAX_MASKED_RETRIES) {
        console.error(`[ListScraper] Sayfa ${currentPage}: ${MAX_MASKED_RETRIES} re-login denemesinden sonra hâlâ maskelenmiş veri var, atlanıyor`);
        break;
      }
      console.warn(`[ListScraper] Sayfa ${currentPage}: Maskelenmiş veri tespit edildi, re-login deneniyor (${maskedRetryCount}/${MAX_MASKED_RETRIES})`);
      await loginService.forceRelogin(page);
      continue;
    }
    maskedRetryCount = 0; // Başarılı sayfada sayacı sıfırla

    // Döküman içerikleri çek (opsiyonel)
    if (includeDocuments) {
      for (const tender of tenders) {
        if (isMasked(tender)) continue;
        try {
          const content = await documentScraper.scrapeAllContent(page, tender.url);
          Object.assign(tender, {
            document_links: content.documentLinks,
            announcement_content: content.announcementContent,
            goods_services_content: content.goodsServicesList,
            zeyilname_content: content.zeyilnameContent,
            correction_notice_content: content.correctionNoticeContent,
            is_updated: !!(content.zeyilnameContent || content.correctionNoticeContent),
          });
          await delay(1000);
        } catch (_e) {}
      }
      // Liste sayfasına geri dön
      await page.goto(`${CATEGORY_URL}&page=${currentPage}`, { waitUntil: 'networkidle2', timeout: 30000 });
      await delay(1000);
    }

    // Veritabanına kaydet
    for (const tender of tenders) {
      if (isMasked(tender)) continue;
      try {
        const result = await saveTender(tender);
        if (result?.is_new) stats.tenders_new++;
        else stats.tenders_updated++;
      } catch (_e) {}
    }

    stats.pages_scraped++;
    stats.tenders_found += tenders.length;

    if (onPageComplete) onPageComplete(currentPage, tenders);

    // Sonraki sayfa
    const hasNext = await page.evaluate((current) => {
      const select = document.querySelector('select[name="page"]');
      if (select) {
        const options = Array.from(select.querySelectorAll('option'));
        return current < options.length;
      }
      return false;
    }, currentPage);

    if (!hasNext) {
      break;
    }

    await page.goto(`${CATEGORY_URL}&page=${currentPage + 1}`, { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(PAGE_DELAY);
    currentPage++;
  }
  return { success: true, stats };
}

/**
 * Sayfadan ihaleleri çıkar
 */
async function extractTenders(page) {
  return await page.evaluate(() => {
    const tenders = [];

    document.querySelectorAll('.card.border-secondary.my-2.mx-1').forEach((card) => {
      try {
        // Detay linki
        const detailLink = Array.from(card.querySelectorAll('a[href*="/tender/"]')).find((a) =>
          a.href.match(/\/tender\/\d+$/)
        );
        if (!detailLink) return;

        const url = detailLink.href;
        const id = url.match(/\/tender\/(\d+)$/)?.[1];
        const baslik = detailLink.textContent.trim();
        if (!id || baslik.length < 5) return;

        // Kayıt no
        const badge = card.querySelector('.badge.text-info');
        const kayitNo = badge?.textContent.trim().replace(/^#/, '');

        // Kaynak türü ve ihale usulü - önce tespit et (şehir filtrelemede lazım)
        const text = card.textContent;
        let kaynakTuru = null;
        let ihaleUsulu = null;
        const kaynaklar = ['Ekap', 'Gazete', 'İstihbarat', 'Özel Sektör'];
        for (const k of kaynaklar) {
          if (text.includes(k)) { kaynakTuru = k; break; }
        }
        const usuller = ['Açık ihale usulü', 'Belli istekliler arasında', 'Pazarlık usulü', 'Doğrudan temin'];
        for (const u of usuller) {
          if (text.includes(u)) { ihaleUsulu = u; break; }
        }

        // Şehir ve İlçe - .text-dark-emphasis elementlerinden kaynak türlerini filtrele
        const nonLocationTexts = ['Ekap', 'Gazete', 'İstihbarat', 'Özel Sektör', 'Açık ihale', 'Belli istekliler', 'Pazarlık', 'Doğrudan'];
        const locationDivs = Array.from(card.querySelectorAll('.text-dark-emphasis.fw-medium.text-nowrap'))
          .map(d => d.textContent.trim())
          .filter(t => t.length > 0 && t.length <= 30 && !nonLocationTexts.some(nl => t.includes(nl)));

        let sehir = null;
        let ilce = null;
        if (locationDivs.length >= 2) {
          // İlk eleman ilçe, ikinci eleman il
          ilce = locationDivs[0];
          sehir = locationDivs[1];
        } else if (locationDivs.length === 1) {
          sehir = locationDivs[0];
        }
        const extract = (labels) => {
          for (const label of labels) {
            const match = text.match(new RegExp(`${label}[:\\s]+([^\\n]+)`, 'i'));
            if (match) return match[1].trim();
          }
          return null;
        };

        // Döküman butonları - URL pattern'ine göre tip belirle (daha güvenilir)
        const documentButtons = {};
        card.querySelectorAll('a.btn[href*="/tender/"]').forEach((btn) => {
          const href = btn.href;
          const fullUrl = href.startsWith('http') ? href : 'https://ihalebul.com' + href;
          const originalText = btn.textContent.trim();

          // Muhtemel Katılımcılar: /tender/{id}/participants
          if (fullUrl.match(/\/tender\/\d+\/participants/)) {
            documentButtons['probable_participants'] = {
              name: originalText || 'Muhtemel Katılımcılar',
              url: fullUrl.split('?')[0],
            };
            return;
          }

          // Sözleşme Listesi: /tender/{id}/contracts
          if (fullUrl.match(/\/tender\/\d+\/contracts/)) {
            documentButtons['contract_list'] = {
              name: originalText || 'Sözleşme Listesi',
              url: fullUrl.split('?')[0],
            };
            return;
          }

          // URL pattern: /tender/{id}/{type_code}
          const match = fullUrl.match(/\/tender\/\d+\/(\d+)/);
          if (!match) return;

          const typeCode = match[1];

          // ihalebul.com URL kodları:
          // 2 = İhale İlanı
          // 3 = Düzeltme İlanı
          // 5 = Sonuç İlanı
          // 6 = Malzeme Listesi
          // 7 = İdari Şartname
          // 8 = Teknik Şartname
          // 9 = Zeyilname
          // 10 = İhale Dokümanı
          const typeMap = {
            2: { type: 'announcement', defaultName: 'İhale İlanı' },
            3: { type: 'correction_notice', defaultName: 'Düzeltme İlanı' },
            5: { type: 'result_announcement', defaultName: 'Sonuç İlanı' },
            6: { type: 'goods_list', defaultName: 'Malzeme Listesi' },
            7: { type: 'admin_spec', defaultName: 'İdari Şartname' },
            8: { type: 'tech_spec', defaultName: 'Teknik Şartname' },
            9: { type: 'zeyilname', defaultName: 'Zeyilname' },
            10: { type: 'tender_document', defaultName: 'İhale Dokümanı' },
          };

          const typeInfo = typeMap[typeCode];
          if (typeInfo) {
            documentButtons[typeInfo.type] = {
              name: originalText || typeInfo.defaultName,
              url: fullUrl.split('?')[0], // Query string'i temizle
            };
          } else {
            // Bilinmeyen tip kodunu buton metninden algıla
            if (originalText?.toLowerCase().includes('katılımcı')) {
              documentButtons['probable_participants'] = {
                name: originalText,
                url: fullUrl.split('?')[0],
              };
            }
          }
        });

        // === Sonuçlanan ihale bilgileri ===
        // Yüklenici adı
        const yukleniciMatch = text.match(/Yüklenici adı:\s*([^\n₺]+)/i);
        const yukleniciAdi = yukleniciMatch ? yukleniciMatch[1].trim() : null;

        // Yaklaşık maliyet (₺ sembolü ile)
        const maliyetMatch = text.match(/Yaklaşık maliyet:\s*₺?([\d.,]+)/i);
        const yaklasikMaliyet = maliyetMatch ? maliyetMatch[1].replace(/\./g, '').replace(',', '.') : null;

        // Sözleşme bedeli
        const sozlesmeBedeliMatch = text.match(/Sözleşme bedeli:\s*₺?([\d.,]+)/i);
        const sozlesmeBedeli = sozlesmeBedeliMatch ? sozlesmeBedeliMatch[1].replace(/\./g, '').replace(',', '.') : null;

        // İndirim oranı (% ile gösterilen badge)
        const indirimMatch = text.match(/%\s*([\d.,]+)/);
        const indirimOrani = indirimMatch ? indirimMatch[1].replace(',', '.') : null;

        // İş başlangıç tarihi
        const isBaslangicMatch = text.match(/İş başlangıç:\s*([\d.]+)/i);
        const isBaslangic = isBaslangicMatch ? isBaslangicMatch[1] : null;

        // İş bitiş tarihi
        const isBitisMatch = text.match(/İş bitiş:\s*([\d.]+)/i);
        const isBitis = isBitisMatch ? isBitisMatch[1] : null;

        // Sözleşme tarihi
        const sozlesmeTarihiMatch = text.match(/Sözleşme tarihi:\s*([\d.]+)/i);
        const sozlesmeTarihi = sozlesmeTarihiMatch ? sozlesmeTarihiMatch[1] : null;

        // Tamamlandı durumu
        const tamamlandi = text.includes('Tamamlandı');

        tenders.push({
          id,
          kayitNo,
          baslik,
          sehir: sehir?.trim() || null,
          ilce: ilce?.trim() || null,
          kurum: extract(['İdare adı', 'İdarenin adı']),
          teklifTarihi: extract(['Teklif tarihi', 'Son teklif']),
          tutar: yaklasikMaliyet || extract(['maliyet', 'bedel']),
          sure: extract(['İşin süresi']),
          url: url.startsWith('http') ? url : `https://www.ihalebul.com${url}`,
          documentButtons: Object.keys(documentButtons).length > 0 ? documentButtons : null,
          // Kaynak ve usul
          kaynakTuru,
          ihaleUsulu,
          // Sonuçlanan ihale bilgileri
          yukleniciAdi,
          sozlesmeBedeli: sozlesmeBedeli ? parseFloat(sozlesmeBedeli) : null,
          indirimOrani: indirimOrani ? parseFloat(indirimOrani) : null,
          isBaslangic,
          isBitis,
          sozlesmeTarihi,
          tamamlandi,
        });
      } catch {}
    });

    return tenders;
  });
}

/**
 * Maskelenmiş veri kontrolü
 */
function isMasked(tender) {
  return [tender.kurum, tender.baslik, tender.kayitNo].some((f) => f?.includes('***'));
}

/**
 * İhaleyi veritabanına kaydet (UPSERT)
 */
async function saveTender(tender) {
  // Normalize
  const data = {
    external_id: tender.id,
    ikn: tender.kayitNo,
    title: tender.baslik?.replace(/\s+/g, ' ').trim(),
    city: tender.sehir,
    location: tender.ilce || null,
    organization_name: tender.kurum?.replace(/\s+/g, ' ').trim(),
    tender_date: parseDate(tender.teklifTarihi),
    estimated_cost: parseAmount(tender.tutar),
    work_duration: tender.sure?.replace(/\s+/g, ' ').trim(),
    url: tender.url,
    tender_source: tender.kaynakTuru || 'ihalebul',
    tender_method: tender.ihaleUsulu || null,
    category_id: 15,
    category_name: 'Hazır Yemek - Lokantacılık',
    document_links: tender.document_links || tender.documentButtons || null,
    announcement_content: tender.announcement_content || null,
    goods_services_content: tender.goods_services_content || null,
    zeyilname_content: tender.zeyilname_content || null,
    correction_notice_content: tender.correction_notice_content || null,
    is_updated: tender.is_updated || false,
    // Sonuçlanan ihale bilgileri
    yuklenici_adi: tender.yukleniciAdi?.replace(/\s+/g, ' ').trim() || null,
    sozlesme_bedeli: tender.sozlesmeBedeli || null,
    indirim_orani: tender.indirimOrani || null,
    sozlesme_tarihi: parseDateOnly(tender.sozlesmeTarihi),
    work_start_date: parseDateOnly(tender.isBaslangic),
    is_bitis_tarihi: parseDateOnly(tender.isBitis),
    status: tender.tamamlandi ? 'completed' : 'active',
  };

  const result = await query(
    `
    INSERT INTO tenders (
      external_id, ikn, title, city, location, organization_name, tender_date, estimated_cost,
      work_duration, url, tender_source, tender_method, category_id, category_name,
      document_links, announcement_content, goods_services_content,
      zeyilname_content, correction_notice_content, is_updated,
      yuklenici_adi, sozlesme_bedeli, indirim_orani, sozlesme_tarihi,
      work_start_date, is_bitis_tarihi, status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27)
    ON CONFLICT (external_id) DO UPDATE SET
      title = EXCLUDED.title,
      city = COALESCE(EXCLUDED.city, tenders.city),
      location = COALESCE(EXCLUDED.location, tenders.location),
      organization_name = COALESCE(EXCLUDED.organization_name, tenders.organization_name),
      tender_date = COALESCE(EXCLUDED.tender_date, tenders.tender_date),
      estimated_cost = COALESCE(EXCLUDED.estimated_cost, tenders.estimated_cost),
      tender_source = COALESCE(EXCLUDED.tender_source, tenders.tender_source),
      tender_method = COALESCE(EXCLUDED.tender_method, tenders.tender_method),
      document_links = COALESCE(EXCLUDED.document_links, tenders.document_links),
      announcement_content = COALESCE(EXCLUDED.announcement_content, tenders.announcement_content),
      goods_services_content = COALESCE(EXCLUDED.goods_services_content, tenders.goods_services_content),
      zeyilname_content = COALESCE(EXCLUDED.zeyilname_content, tenders.zeyilname_content),
      correction_notice_content = COALESCE(EXCLUDED.correction_notice_content, tenders.correction_notice_content),
      is_updated = COALESCE(EXCLUDED.is_updated, tenders.is_updated),
      yuklenici_adi = COALESCE(EXCLUDED.yuklenici_adi, tenders.yuklenici_adi),
      sozlesme_bedeli = COALESCE(EXCLUDED.sozlesme_bedeli, tenders.sozlesme_bedeli),
      indirim_orani = COALESCE(EXCLUDED.indirim_orani, tenders.indirim_orani),
      sozlesme_tarihi = COALESCE(EXCLUDED.sozlesme_tarihi, tenders.sozlesme_tarihi),
      work_start_date = COALESCE(EXCLUDED.work_start_date, tenders.work_start_date),
      is_bitis_tarihi = COALESCE(EXCLUDED.is_bitis_tarihi, tenders.is_bitis_tarihi),
      status = CASE WHEN EXCLUDED.status = 'completed' THEN 'completed' ELSE tenders.status END,
      updated_at = NOW()
    RETURNING id, external_id, (xmax = 0) as is_new
  `,
    [
      data.external_id,
      data.ikn,
      data.title,
      data.city,
      data.location,
      data.organization_name,
      data.tender_date,
      data.estimated_cost,
      data.work_duration,
      data.url,
      data.tender_source,
      data.tender_method,
      data.category_id,
      data.category_name,
      data.document_links ? JSON.stringify(data.document_links) : null,
      data.announcement_content,
      data.goods_services_content ? JSON.stringify(data.goods_services_content) : null,
      data.zeyilname_content ? JSON.stringify(data.zeyilname_content) : null,
      data.correction_notice_content ? JSON.stringify(data.correction_notice_content) : null,
      data.is_updated,
      data.yuklenici_adi,
      data.sozlesme_bedeli,
      data.indirim_orani,
      data.sozlesme_tarihi,
      data.work_start_date,
      data.is_bitis_tarihi,
      data.status,
    ]
  );

  return result.rows[0];
}

/**
 * Tarih parse (DD.MM.YYYY HH:mm)
 */
function parseDate(str) {
  if (!str) return null;
  const match = str.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (match) {
    const [, d, m, y, h = '00', min = '00'] = match;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T${h.padStart(2, '0')}:${min}:00+03:00`;
  }
  return null;
}

/**
 * Sadece tarih parse (DD.MM.YYYY → YYYY-MM-DD)
 */
function parseDateOnly(str) {
  if (!str) return null;
  const match = str.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (match) {
    const [, d, m, y] = match;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return null;
}

/**
 * Tutar parse
 */
function parseAmount(str) {
  if (!str) return null;
  // Aralık: "100.000 ~ 500.000 TL"
  const rangeMatch = str.match(/([\d.]+(?:,\d+)?)\s*~\s*([\d.]+(?:,\d+)?)/);
  if (rangeMatch) {
    return parseFloat(rangeMatch[1].replace(/\./g, '').replace(',', '.'));
  }
  const clean = str
    .replace(/[^\d.,]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const amount = parseFloat(clean);
  return Number.isNaN(amount) ? null : amount;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default { scrapeList };
