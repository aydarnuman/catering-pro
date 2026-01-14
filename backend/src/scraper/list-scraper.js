import loginService from './login-service.js';
import { query } from '../database.js';
import documentScraper from './document-scraper.js';

// Kategori 15 yerine tüm ihaleleri deneyelim (aktif üye sorunu)
const CATEGORY_URL = 'https://www.ihalebul.com/tenders/search?workcategory_in=15';
const PAGE_DELAY = 2000;
const SCROLL_DELAY = 1000;

/**
 * Liste Scraper
 * İhale listesi sayfalarını scrape eder
 */

/**
 * Ana scraping fonksiyonu
 */
export async function scrapeList(page, options = {}) {
  const {
    maxPages = 15,
    startPage = 1,
    onPageComplete = null,
    includeDocuments = false  // Yeni option
  } = options;

  console.log('📊 Liste scraping başlıyor...');
  console.log(`   Sayfa: ${startPage} → ${maxPages}`);

  const stats = {
    pages_scraped: 0,
    tenders_found: 0,
    tenders_new: 0,
    tenders_updated: 0
  };

  let currentPage = startPage;
  let consecutiveErrors = 0;
  const maxConsecutiveErrors = 3;
  let pageRetryCount = 0;
  const maxPageRetries = 2;

  try {
    // Login kontrol
    await loginService.ensureLoggedIn(page);
    
    console.log('🔄 Login sonrası 3 saniye bekleniyor...');
    await delay(3000);

    // Başlangıç sayfasına git
    const startUrl = startPage > 1 
      ? `${CATEGORY_URL}&page=${startPage}` 
      : CATEGORY_URL;

    console.log(`📂 Kategori sayfasına gidiliyor: ${startUrl}`);
    await page.goto(startUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    await delay(PAGE_DELAY);
    console.log('✅ Kategori sayfası yüklendi');

    // Ana döngü
    while (currentPage <= maxPages) {
      try {
        console.log(`\n📄 Sayfa ${currentPage}/${maxPages} işleniyor...`);

        // Login kontrolü
        const wasRelogged = await verifyLoginOnPage(page);
        if (wasRelogged) {
          console.log('🔄 Re-login yapıldı, sayfa yenileniyor...');
          await page.reload({ waitUntil: 'networkidle2' });
          await delay(PAGE_DELAY);
        }

        // Debug: URL ve selector kontrolü
        console.log(`🔍 URL: ${page.url()}`);
        const cardCount = await page.$$eval('.card', els => els.length);
        console.log(`   .card elemanları: ${cardCount}`);

        // Scroll (lazy load için)
        await scrollPage(page);

        // İhaleleri çıkar
        const tenders = await extractTendersFromPage(page);

        if (tenders.length === 0) {
          console.log('⚠️ Hiç kart bulunamadı - muhtemelen son sayfa');
          
          // Debug screenshot
          await page.screenshot({ path: `./debug_page_${currentPage}.png`, fullPage: false });
          console.log(`📸 Screenshot: debug_page_${currentPage}.png`);
          
          break;
        }

        console.log(`   ✅ ${tenders.length} ihale bulundu`);

        // Şehir temizleme (AI ile batch)
        await cleanCitiesInBatch(tenders);

        // Döküman linkleri çek (opsiyonel)
        if (includeDocuments) {
          console.log(`   📚 ${tenders.length} ihale için döküman linkleri çekiliyor...`);
          await extractDocumentLinksForTenders(page, tenders);
          
          // Debug: Kaç ihalede döküman var?
          const tendersWithDocs = tenders.filter(t => t.document_links && Object.keys(t.document_links).length > 0);
          console.log(`   ✅ ${tendersWithDocs.length}/${tenders.length} ihalede döküman linki bulundu`);
        }

        // Veritabanına kaydet - MASKELENMIŞ VERİLERİ ATLA!
        let savedCount = 0;
        let maskedCount = 0;
        
        for (const tender of tenders) {
          // ⛔ MASKELENMIŞ VERİ KONTROLÜ - Bu kaydı ATLA!
          if (isMaskedData(tender)) {
            maskedCount++;
            console.log(`⛔ MASKED DATA SKIPPED: ${tender.kayitNo} - ${tender.kurum}`);
            continue; // Kaydetme, bir sonrakine geç
          }
          
          // Normalize et
          const normalized = normalizeTenderData(tender);
          
          // DEBUG: Döküman var mı?
          if (normalized.document_links) {
            console.log(`🔍 DEBUG: ${normalized.external_id} - Döküman sayısı: ${Object.keys(normalized.document_links).length}`);
          }
          
          // Kaydet
          try {
            const result = await upsertTender(normalized);
            if (result?.is_new) {
              stats.tenders_new++;
              console.log(`✅ NEW: ${normalized.external_id}`);
            } else {
              stats.tenders_updated++;
            }
            savedCount++;
          } catch (dbError) {
            console.error(`❌ DB error: ${tender.kayitNo}`, dbError.message);
          }
        }
        
        console.log(`💾 Kaydedildi: ${savedCount}, Maskelenmiş: ${maskedCount}`);
        
        // ⛔ THRESHOLD KONTROLÜ - Çok fazla maskelenmiş varsa LOGIN SORUNU!
        if (maskedCount > tenders.length * 0.3) {
          console.log(`❌ CRITICAL: ${maskedCount}/${tenders.length} masked!`);
          console.log('❌ LOGIN PROBLEM - Re-login gerekli');
          
          await loginService.forceRelogin(page);
          await delay(2000);
          
          // Sayfayı yeniden yükle
          const retryUrl = currentPage > 1 
            ? `${CATEGORY_URL}&page=${currentPage}` 
            : CATEGORY_URL;
          
          console.log(`🔄 Sayfa ${currentPage} yeniden çekiliyor...`);
          await page.goto(retryUrl, {
            waitUntil: 'networkidle2',
            timeout: 30000
          });
          
          await delay(PAGE_DELAY);
          pageRetryCount++;
          continue; // Aynı sayfayı tekrar işle
        }
        
        // Başarılı sayfa - retry counter'ı sıfırla
        pageRetryCount = 0;
        stats.pages_scraped++;

        // Callback
        if (onPageComplete) {
          onPageComplete(currentPage, tenders);
        }

        // Başarılı oldu, error sayacını sıfırla
        consecutiveErrors = 0;

        // ⚠️ Liste sayfasına geri dön (döküman çekerken detay sayfalarına gidildi)
        const currentListUrl = currentPage > 1 
          ? `${CATEGORY_URL}&page=${currentPage}` 
          : CATEGORY_URL;
        
        console.log(`   ↩️ Liste sayfasına dönülüyor...`);
        await page.goto(currentListUrl, {
          waitUntil: 'networkidle2',
          timeout: 30000
        });
        await delay(1000);

        // Sonraki sayfa var mı?
        const nextPageInfo = await getNextPageInfo(page, currentPage);

        if (!nextPageInfo.hasNext || !nextPageInfo.nextUrl) {
          console.log('✅ Son sayfaya ulaşıldı');
          break;
        }

        console.log(`   → Sonraki sayfa: ${currentPage + 1}`);

        // Sonraki sayfaya git
        await page.goto(nextPageInfo.nextUrl, {
          waitUntil: 'networkidle2',
          timeout: 30000
        });

        await delay(PAGE_DELAY);
        currentPage++;

      } catch (pageError) {
        console.error(`❌ Sayfa ${currentPage} hatası:`, pageError.message);
        consecutiveErrors++;

        if (consecutiveErrors >= maxConsecutiveErrors) {
          console.error(`❌ ${maxConsecutiveErrors} ardışık hata - scraping durduruluyor`);
          break;
        }

        // Bir sonraki sayfayı dene
        try {
          const skipUrl = `${CATEGORY_URL}&page=${currentPage + 1}`;
          await page.goto(skipUrl, {
            waitUntil: 'networkidle2',
            timeout: 30000
          });
          currentPage++;
        } catch (skipError) {
          console.error('❌ Skip işlemi başarısız:', skipError.message);
          break;
        }
      }
    }

    console.log('\n✨ Liste scraping tamamlandı');
    console.log(`   Sayfa: ${stats.pages_scraped}`);
    console.log(`   Toplam: ${stats.tenders_found}`);
    console.log(`   Yeni: ${stats.tenders_new}`);
    console.log(`   Güncelleme: ${stats.tenders_updated}`);

    return {
      success: true,
      stats
    };

  } catch (error) {
    console.error('❌ Liste scraping hatası:', error);
    throw error;
  }
}

/**
 * Sayfadan ihaleleri çıkar
 */
async function extractTendersFromPage(page) {
  return await page.evaluate(() => {
    const cards = document.querySelectorAll('.card.border-secondary.my-2.mx-1');
    const tenders = [];

    cards.forEach(card => {
      try {
        // Detay linki bul
        const detailLink = Array.from(card.querySelectorAll('a[href*="/tender/"]'))
          .find(a => {
            const href = a.getAttribute('href') || '';
            return (
              !href.includes('follow') &&
              !href.includes('unread') &&
              !href.includes('notes') &&
              href.match(/\/tender\/\d+$/)
            );
          });

        if (!detailLink) return;

        const url = detailLink.getAttribute('href');
        const id = url.match(/\/tender\/(\d+)$/)?.[1];
        if (!id) return;

        const baslik = detailLink.textContent.trim();
        if (baslik.length < 5) return;

        // Kayıt no (badge)
        const badge = card.querySelector('.badge.text-info');
        const kayitNo = badge ? badge.textContent.trim().replace(/^#/, '') : null;

        // Şehir (primary selector)
        let sehir = null;
        const cityDiv = card.querySelector('.text-dark-emphasis.fw-medium.text-nowrap.d-inline-block.p-1');
        if (cityDiv) {
          sehir = cityDiv.textContent.trim();
          if (sehir.length > 30 || sehir.includes('📍') || sehir.includes(':')) {
            sehir = null;
          }
        }

        // Fallback: emoji pattern
        if (!sehir) {
          const emojiMatch = card.textContent.match(/📍[\s]*([A-ZÇĞİÖŞÜ][a-zçğıöşü]+)/);
          if (emojiMatch) {
            sehir = emojiMatch[1];
          }
        }

        // Diğer bilgiler (regex ile)
        const text = card.textContent;

        const extractField = (labels) => {
          for (const label of labels) {
            // Format 1: Label: Value
            let match = text.match(new RegExp(`${label}[:\\s]+([^\\n]+)`, 'i'));
            if (match) return match[1].trim();

            // Format 2: 📅 Label: Value
            match = text.match(new RegExp(`📅[\\s]*${label}[:\\s]+([^\\n]+)`, 'i'));
            if (match) return match[1].trim();

            // Format 3: 🏛️ Label: Value
            match = text.match(new RegExp(`🏛️[\\s]*${label}[:\\s]+([^\\n]+)`, 'i'));
            if (match) return match[1].trim();

            // Format 4: 📍 Label: Value
            match = text.match(new RegExp(`📍[\\s]*${label}[:\\s]+([^\\n]+)`, 'i'));
            if (match) return match[1].trim();
          }
          return null;
        };

        const tender = {
          id,
          kayitNo,
          baslik,
          teklifTarihi: extractField(['Teklif tarihi', 'Son teklif']),
          sure: extractField(['İşin süresi']),
          yer: extractField(['yapılacağı yer', 'Yer']),
          baslamaTarihi: extractField(['başlama']),
          sehir,
          kurum: extractField(['İdare adı', 'İdarenin adı']),
          tutar: extractField(['maliyet', 'bedel']),
          url
        };

        tenders.push(tender);

      } catch (error) {
        console.error('Kart parse hatası:', error);
      }
    });

    return tenders;
  });
}

/**
 * Şehirleri basit şekilde temizle (local)
 */
function cleanCitiesInBatch(tenders) {
  // Basit temizleme - "/" ile ayrılmışsa ilk kısmı al
  tenders.forEach(t => {
    if (t.sehir) {
      t.sehir = t.sehir.split('/')[0].trim();
    }
  });
}

/**
 * İhalelerin döküman linkleri + içeriklerini çek
 */
async function extractDocumentLinksForTenders(page, tenders) {
  let processedCount = 0;
  const batchSize = 3;
  
  for (let i = 0; i < tenders.length; i += batchSize) {
    const batch = tenders.slice(i, i + batchSize);
    
    for (const tender of batch) {
      try {
        await delay(1000); // Rate limiting
        
        // Tüm içerikleri çek (döküman linkleri + ilan + mal/hizmet + zeyilname + düzeltme)
        const content = await documentScraper.scrapeAllContent(page, tender.url);
        
        tender.document_links = content.documentLinks;
        tender.announcement_content = content.announcementContent;
        tender.goods_services_content = content.goodsServicesList;
        tender.zeyilname_content = content.zeyilnameContent;
        tender.correction_notice_content = content.correctionNoticeContent;
        
        // Güncellendi durumunu belirle
        tender.is_updated = !!(content.zeyilnameContent || content.correctionNoticeContent);
        
        processedCount++;
        
        const hasAnn = content.announcementContent ? '✓' : '✗';
        const hasGoods = content.goodsServicesList ? `✓(${content.goodsServicesList.length})` : '✗';
        const hasZeyil = content.zeyilnameContent ? '✓' : '✗';
        const hasCorr = content.correctionNoticeContent ? '✓' : '✗';
        console.log(`     📄 ${processedCount}/${tenders.length} - İhale ${tender.id} [İlan:${hasAnn} Mal/Hizmet:${hasGoods} Zeyil:${hasZeyil} Düzeltme:${hasCorr}]`);
        
      } catch (error) {
        console.error(`     ❌ İhale ${tender.id} içerik hatası:`, error.message);
        tender.document_links = {};
        tender.announcement_content = null;
        tender.goods_services_content = null;
        tender.zeyilname_content = null;
        tender.correction_notice_content = null;
        tender.is_updated = false;
      }
    }
    
    // Batch arası kısa bekleme
    if (i + batchSize < tenders.length) {
      await delay(500);
    }
  }
}

/**
 * Maskelenmiş veri kontrolü
 */
function isMaskedData(tender) {
  const maskedFields = [tender.kurum, tender.baslik, tender.kayitNo];
  return maskedFields.some(
    field => field && (field === '***' || field.includes('***'))
  );
}

/**
 * Veriyi normalize et
 */
function normalizeTenderData(tender) {
  // IKN çıkar
  const ikn = extractIkn(tender.baslik) || tender.kayitNo;

  // Tarihleri normalize et
  const tenderDate = normalizeDateStr(tender.teklifTarihi);
  const workStartDate = normalizeDateStr(tender.baslamaTarihi);

  // Tutar normalize et
  const { amount, min, max } = normalizeAmount(tender.tutar);

  return {
    external_id: tender.id,
    ikn,
    title: cleanText(tender.baslik),
    work_name: null,
    publish_date: null,
    tender_date: tenderDate,
    work_start_date: workStartDate,
    work_duration: cleanText(tender.sure),
    city: tender.sehir,
    city_raw: tender.sehir,
    location: cleanText(tender.yer),
    organization_name: cleanText(tender.kurum),
    organization_address: null,
    organization_phone: null,
    organization_email: null,
    estimated_cost: amount,
    estimated_cost_raw: tender.tutar,
    estimated_cost_min: min,
    estimated_cost_max: max,
    tender_type: null,
    tender_method: null,
    tender_source: 'ihalebul',
    bid_type: null,
    category_id: 15,
    category_name: 'Hazır Yemek - Lokantacılık',
    url: tender.url.startsWith('http') ? tender.url : `https://www.ihalebul.com${tender.url}`,
    document_links: tender.document_links || null,
    announcement_content: tender.announcement_content || null,
    goods_services_content: tender.goods_services_content || null,
    zeyilname_content: tender.zeyilname_content || null,
    correction_notice_content: tender.correction_notice_content || null,
    is_updated: tender.is_updated || false,
    raw_data: {
      original: tender,
      scraped_at: new Date().toISOString()
    }
  };
}

/**
 * Veritabanına kaydet (upsert)
 */
async function upsertTender(data) {
  const result = await query(`
    INSERT INTO tenders (
      external_id, ikn, title, work_name, publish_date, tender_date,
      work_start_date, work_duration, city, city_raw, location,
      organization_name, organization_address, organization_phone,
      organization_email, estimated_cost, estimated_cost_raw,
      estimated_cost_min, estimated_cost_max, tender_type, tender_method,
      tender_source, bid_type, category_id, category_name, url, raw_data, 
      document_links, announcement_content, goods_services_content,
      zeyilname_content, correction_notice_content, is_updated
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
      $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
      $31, $32, $33
    )
    ON CONFLICT (external_id)
    DO UPDATE SET
      ikn = COALESCE(EXCLUDED.ikn, tenders.ikn),
      title = EXCLUDED.title,
      tender_date = COALESCE(EXCLUDED.tender_date, tenders.tender_date),
      work_start_date = COALESCE(EXCLUDED.work_start_date, tenders.work_start_date),
      work_duration = COALESCE(EXCLUDED.work_duration, tenders.work_duration),
      city = COALESCE(EXCLUDED.city, tenders.city),
      location = COALESCE(EXCLUDED.location, tenders.location),
      organization_name = COALESCE(EXCLUDED.organization_name, tenders.organization_name),
      estimated_cost = COALESCE(EXCLUDED.estimated_cost, tenders.estimated_cost),
      estimated_cost_raw = COALESCE(EXCLUDED.estimated_cost_raw, tenders.estimated_cost_raw),
      url = EXCLUDED.url,
      raw_data = EXCLUDED.raw_data,
      document_links = COALESCE(EXCLUDED.document_links, tenders.document_links),
      announcement_content = COALESCE(EXCLUDED.announcement_content, tenders.announcement_content),
      goods_services_content = COALESCE(EXCLUDED.goods_services_content, tenders.goods_services_content),
      zeyilname_content = COALESCE(EXCLUDED.zeyilname_content, tenders.zeyilname_content),
      correction_notice_content = COALESCE(EXCLUDED.correction_notice_content, tenders.correction_notice_content),
      is_updated = COALESCE(EXCLUDED.is_updated, tenders.is_updated),
      last_update_date = CASE WHEN EXCLUDED.is_updated = true THEN NOW() ELSE tenders.last_update_date END,
      updated_at = NOW()
    RETURNING id, external_id, (xmax = 0) as is_new
  `, [
    data.external_id, data.ikn, data.title, data.work_name, data.publish_date,
    data.tender_date, data.work_start_date, data.work_duration, data.city,
    data.city_raw, data.location, data.organization_name, data.organization_address,
    data.organization_phone, data.organization_email, data.estimated_cost,
    data.estimated_cost_raw, data.estimated_cost_min, data.estimated_cost_max,
    data.tender_type, data.tender_method, data.tender_source, data.bid_type,
    data.category_id, data.category_name, data.url, JSON.stringify(data.raw_data),
    data.document_links ? JSON.stringify(data.document_links) : null,
    data.announcement_content,
    data.goods_services_content ? JSON.stringify(data.goods_services_content) : null,
    data.zeyilname_content ? JSON.stringify(data.zeyilname_content) : null,
    data.correction_notice_content ? JSON.stringify(data.correction_notice_content) : null,
    data.is_updated || false
  ]);

  return result.rows[0];
}

/**
 * Sonraki sayfa bilgisi
 */
async function getNextPageInfo(page, currentPage) {
  const paginationInfo = await page.evaluate((current) => {
    // select[name="page"] elementi - "1. Sayfa", "2. Sayfa" formatında
    const select = document.querySelector('select[name="page"]');
    
    if (select) {
      const options = Array.from(select.querySelectorAll('option'));
      const totalPages = options.length;
      
      console.log(`📄 Pagination: ${totalPages} sayfa bulundu, şu an ${current}. sayfa`);
      
      // Sonraki sayfa var mı?
      if (current < totalPages) {
        // Sonraki sayfanın URL'ini bul
        const nextOption = options[current]; // 0-indexed, current zaten 1'den başlıyor
        if (nextOption && nextOption.value) {
          return { 
            hasNext: true, 
            nextUrl: nextOption.value,
            totalPages 
          };
        }
      }
    }
    
    return { hasNext: false, nextUrl: null, totalPages: 0 };
  }, currentPage);
  
  console.log(`   → Pagination: ${paginationInfo.totalPages} sayfa, hasNext: ${paginationInfo.hasNext}`);
  
  return paginationInfo;
}

/**
 * Login doğrulama (sayfa üzerinde)
 * Eski projedeki gibi detaylı kontrol
 */
async function verifyLoginOnPage(page) {
  const isLoggedIn = await loginService.isLoggedIn(page);
  
  if (!isLoggedIn) {
    console.log('⛔ MASKED DATA DETECTED - Login required!');
    const currentUrl = page.url();
    
    // Force relogin
    console.log('🔐 Forcing re-login via LoginService...');
    await loginService.forceRelogin(page);
    
    // Login sonrası orijinal sayfaya geri dön
    if (!currentUrl.includes('/signin') && !currentUrl.includes('/login')) {
      console.log(`↩️ Returning to original page: ${currentUrl}`);
      await page.goto(currentUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      await delay(PAGE_DELAY);
      
      // Debug: Sayfa içeriğini logla
      const debugContent = await page.content();
      const hasActiveUserWarning = debugContent.includes('Bu bölüm sadece aktif üye kullanımına açıktır') || 
                                    debugContent.includes('aktif üye');
      
      if (hasActiveUserWarning) {
        console.log('⚠️ AKTİF ÜYE UYARISI TESPİT EDİLDİ!');
        console.log('⚠️ Bu hesap aktif üye değil veya kategori erişimi yok');
      }
      
      // Tekrar kontrol et
      const stillLoggedIn = await loginService.isLoggedIn(page);
      if (!stillLoggedIn) {
        // Debug için HTML'in bir kısmını logla
        const snippet = debugContent.substring(0, 500);
        console.log('🔍 HTML snippet:', snippet);
        throw new Error('⛔ LOGIN FAILED even after relogin attempt');
      }
      
      console.log('✅ Re-login successful!');
    }
    
    return true;
  }
  
  return false;
}

/**
 * Sayfa scroll
 */
async function scrollPage(page) {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await delay(SCROLL_DELAY);
  await page.evaluate(() => window.scrollTo(0, 0));
}

// ============ HELPER FUNCTIONS ============

function extractIkn(title) {
  if (!title) return null;
  const match = title.match(/^([A-Z0-9\/\-]+)\s*-/);
  return match ? match[1] : null;
}

function normalizeDateStr(dateStr) {
  if (!dateStr) return null;
  
  // D.MM.YYYY veya DD.MM.YYYY HH:mm (gün ve ay 1 veya 2 haneli olabilir)
  const match = dateStr.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (match) {
    const [, day, month, year, hour, minute] = match;
    // Gün ve ayı 2 haneli yap (padding)
    const dd = day.padStart(2, '0');
    const mm = month.padStart(2, '0');
    const hh = (hour || '00').padStart(2, '0');
    const min = minute || '00';
    
    // Türkiye saat dilimi (UTC+3)
    return `${year}-${mm}-${dd}T${hh}:${min}:00+03:00`;
  }
  
  return null;
}

function normalizeAmount(amountStr) {
  if (!amountStr) return { amount: null, min: null, max: null };
  
  // Aralık formatı: "33.791.911 ~ 253.439.417 TL"
  const rangeMatch = amountStr.match(/([\d.]+(?:,\d+)?)\s*~\s*([\d.]+(?:,\d+)?)/);
  if (rangeMatch) {
    const min = parseFloat(rangeMatch[1].replace(/\./g, '').replace(',', '.'));
    const max = parseFloat(rangeMatch[2].replace(/\./g, '').replace(',', '.'));
    return { amount: min, min, max };
  }
  
  // Tek değer
  const cleanAmount = amountStr.replace(/[^\d.,]/g, '').replace(/\./g, '').replace(',', '.');
  const amount = parseFloat(cleanAmount);
  
  return {
    amount: isNaN(amount) ? null : amount,
    min: null,
    max: null
  };
}

function cleanText(text) {
  if (!text) return null;
  return text.replace(/\s+/g, ' ').trim();
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
