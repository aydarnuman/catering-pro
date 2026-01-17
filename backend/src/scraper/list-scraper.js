/**
 * List Scraper - İhale Listesi Tarayıcı
 * 
 * ihalebul.com kategori 15 (Hazır Yemek) sayfalarını tarar
 * ve ihaleleri veritabanına kaydeder.
 */

import loginService from './login-service.js';
import documentScraper from './document-scraper.js';
import { query } from '../database.js';

const CATEGORY_URL = 'https://www.ihalebul.com/tenders/search?workcategory_in=15';
const PAGE_DELAY = 2000;

/**
 * Ana liste scraping fonksiyonu
 */
export async function scrapeList(page, options = {}) {
  const { maxPages = 100, startPage = 1, includeDocuments = false, onPageComplete = null } = options;

  console.log(`📋 Liste scraping başlıyor (sayfa ${startPage}-${maxPages})`);

  const stats = { pages_scraped: 0, tenders_found: 0, tenders_new: 0, tenders_updated: 0 };

  try {
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
      console.log(`📄 Sayfa ${currentPage} işleniyor...`);

      // Login kontrolü
      if (!await loginService.isLoggedIn(page)) {
        console.log('⚠️ Login gerekli, tekrar giriş yapılıyor...');
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
        console.log('⚠️ Hiç ihale bulunamadı - muhtemelen son sayfa');
        break;
      }

      console.log(`   ${tenders.length} ihale bulundu`);

      // Maskelenmiş veri kontrolü
      const maskedCount = tenders.filter(t => isMasked(t)).length;
      if (maskedCount > tenders.length * 0.3) {
        console.log('⚠️ Çok fazla maskelenmiş veri - login sorunu');
        await loginService.forceRelogin(page);
        continue;
      }

      // Döküman içerikleri çek (opsiyonel)
      if (includeDocuments) {
        console.log('   Döküman içerikleri çekiliyor...');
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
              is_updated: !!(content.zeyilnameContent || content.correctionNoticeContent)
            });
            await delay(1000);
          } catch (e) {
            console.log(`   ⚠️ ${tender.id} içerik hatası: ${e.message}`);
          }
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
        } catch (e) {
          console.log(`   ❌ Kayıt hatası: ${e.message}`);
        }
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
        console.log('✅ Son sayfaya ulaşıldı');
        break;
      }

      await page.goto(`${CATEGORY_URL}&page=${currentPage + 1}`, { waitUntil: 'networkidle2', timeout: 30000 });
      await delay(PAGE_DELAY);
      currentPage++;
    }

    console.log(`✅ Liste scraping tamamlandı: ${stats.pages_scraped} sayfa, ${stats.tenders_new} yeni, ${stats.tenders_updated} güncellenen`);
    return { success: true, stats };

  } catch (error) {
    console.error('❌ Liste scraping hatası:', error.message);
    throw error;
  }
}

/**
 * Sayfadan ihaleleri çıkar
 */
async function extractTenders(page) {
  return await page.evaluate(() => {
    const tenders = [];

    document.querySelectorAll('.card.border-secondary.my-2.mx-1').forEach(card => {
      try {
        // Detay linki
        const detailLink = Array.from(card.querySelectorAll('a[href*="/tender/"]'))
          .find(a => a.href.match(/\/tender\/\d+$/));
        if (!detailLink) return;

        const url = detailLink.href;
        const id = url.match(/\/tender\/(\d+)$/)?.[1];
        const baslik = detailLink.textContent.trim();
        if (!id || baslik.length < 5) return;

        // Kayıt no
        const badge = card.querySelector('.badge.text-info');
        const kayitNo = badge?.textContent.trim().replace(/^#/, '');

        // Şehir
        const cityDiv = card.querySelector('.text-dark-emphasis.fw-medium.text-nowrap');
        let sehir = cityDiv?.textContent.trim();
        if (sehir && (sehir.length > 30 || sehir.includes('📍'))) sehir = null;

        // Metin içinden bilgi çıkar
        const text = card.textContent;
        const extract = (labels) => {
          for (const label of labels) {
            const match = text.match(new RegExp(`${label}[:\\s]+([^\\n]+)`, 'i'));
            if (match) return match[1].trim();
          }
          return null;
        };

        // Döküman butonları - URL pattern'ine göre tip belirle (daha güvenilir)
        const documentButtons = {};
        card.querySelectorAll('a.btn[href*="/tender/"]').forEach(btn => {
          const href = btn.href;
          const fullUrl = href.startsWith('http') ? href : 'https://ihalebul.com' + href;
          
          // URL pattern: /tender/{id}/{type_code}
          const match = fullUrl.match(/\/tender\/\d+\/(\d+)/);
          if (!match) return;
          
          const typeCode = match[1];
          const originalText = btn.textContent.trim();
          
          // ihalebul.com URL kodları:
          // 2 = İhale İlanı
          // 3 = Düzeltme İlanı
          // 6 = Malzeme Listesi
          // 7 = İdari Şartname
          // 8 = Teknik Şartname
          // 9 = Zeyilname
          const typeMap = {
            '2': { type: 'announcement', defaultName: 'İhale İlanı' },
            '3': { type: 'correction_notice', defaultName: 'Düzeltme İlanı' },
            '6': { type: 'goods_list', defaultName: 'Malzeme Listesi' },
            '7': { type: 'admin_spec', defaultName: 'İdari Şartname' },
            '8': { type: 'tech_spec', defaultName: 'Teknik Şartname' },
            '9': { type: 'zeyilname', defaultName: 'Zeyilname' }
          };
          
          const typeInfo = typeMap[typeCode];
          if (typeInfo) {
            documentButtons[typeInfo.type] = { 
              name: originalText || typeInfo.defaultName, 
              url: fullUrl.split('?')[0] // Query string'i temizle
            };
          }
        });

        tenders.push({
          id,
          kayitNo,
          baslik,
          sehir: sehir?.split('/')[0].trim(),
          kurum: extract(['İdare adı', 'İdarenin adı']),
          teklifTarihi: extract(['Teklif tarihi', 'Son teklif']),
          tutar: extract(['maliyet', 'bedel']),
          sure: extract(['İşin süresi']),
          url: url.startsWith('http') ? url : `https://www.ihalebul.com${url}`,
          documentButtons: Object.keys(documentButtons).length > 0 ? documentButtons : null
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
  return [tender.kurum, tender.baslik, tender.kayitNo].some(f => f?.includes('***'));
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
    organization_name: tender.kurum?.replace(/\s+/g, ' ').trim(),
    tender_date: parseDate(tender.teklifTarihi),
    estimated_cost: parseAmount(tender.tutar),
    work_duration: tender.sure?.replace(/\s+/g, ' ').trim(),
    url: tender.url,
    tender_source: 'ihalebul',
    category_id: 15,
    category_name: 'Hazır Yemek - Lokantacılık',
    document_links: tender.document_links || tender.documentButtons || null,
    announcement_content: tender.announcement_content || null,
    goods_services_content: tender.goods_services_content || null,
    zeyilname_content: tender.zeyilname_content || null,
    correction_notice_content: tender.correction_notice_content || null,
    is_updated: tender.is_updated || false
  };

  const result = await query(`
    INSERT INTO tenders (
      external_id, ikn, title, city, organization_name, tender_date, estimated_cost,
      work_duration, url, tender_source, category_id, category_name,
      document_links, announcement_content, goods_services_content,
      zeyilname_content, correction_notice_content, is_updated
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
    ON CONFLICT (external_id) DO UPDATE SET
      title = EXCLUDED.title,
      city = COALESCE(EXCLUDED.city, tenders.city),
      organization_name = COALESCE(EXCLUDED.organization_name, tenders.organization_name),
      tender_date = COALESCE(EXCLUDED.tender_date, tenders.tender_date),
      estimated_cost = COALESCE(EXCLUDED.estimated_cost, tenders.estimated_cost),
      document_links = COALESCE(EXCLUDED.document_links, tenders.document_links),
      announcement_content = COALESCE(EXCLUDED.announcement_content, tenders.announcement_content),
      goods_services_content = COALESCE(EXCLUDED.goods_services_content, tenders.goods_services_content),
      zeyilname_content = COALESCE(EXCLUDED.zeyilname_content, tenders.zeyilname_content),
      correction_notice_content = COALESCE(EXCLUDED.correction_notice_content, tenders.correction_notice_content),
      is_updated = COALESCE(EXCLUDED.is_updated, tenders.is_updated),
      updated_at = NOW()
    RETURNING id, external_id, (xmax = 0) as is_new
  `, [
    data.external_id, data.ikn, data.title, data.city, data.organization_name,
    data.tender_date, data.estimated_cost, data.work_duration, data.url,
    data.tender_source, data.category_id, data.category_name,
    data.document_links ? JSON.stringify(data.document_links) : null,
    data.announcement_content,
    data.goods_services_content ? JSON.stringify(data.goods_services_content) : null,
    data.zeyilname_content ? JSON.stringify(data.zeyilname_content) : null,
    data.correction_notice_content ? JSON.stringify(data.correction_notice_content) : null,
    data.is_updated
  ]);

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
 * Tutar parse
 */
function parseAmount(str) {
  if (!str) return null;
  // Aralık: "100.000 ~ 500.000 TL"
  const rangeMatch = str.match(/([\d.]+(?:,\d+)?)\s*~\s*([\d.]+(?:,\d+)?)/);
  if (rangeMatch) {
    return parseFloat(rangeMatch[1].replace(/\./g, '').replace(',', '.'));
  }
  const clean = str.replace(/[^\d.,]/g, '').replace(/\./g, '').replace(',', '.');
  const amount = parseFloat(clean);
  return isNaN(amount) ? null : amount;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default { scrapeList };
