/**
 * Contractor Tender Scraper
 *
 * Belirli bir yüklenicinin ihalebul.com'daki tüm ihale geçmişini çeker.
 *
 * ihalebul.com URL yapısı:
 *   /tenders/search/contracted?contractortitle_in=X&workend=%3E0  → devam eden
 *   /tenders/search/contracted?contractortitle_in=X&workend=%3C0  → tamamlanan
 *   /tenders/search/contracted?participanttitle_in=X              → tüm katıldıkları
 *
 * NOT: /tenders/search?contractortitle_in=X (eski URL) boş döner!
 *
 * contractors.js route'undaki şu endpoint'ler tarafından kullanılır:
 *   - POST /:id/scrape-history (tek yüklenici)
 *   - POST /scrape/tender-history (batch)
 *   - POST /:id/toggle-istihbarat (otomatik)
 */

import { query } from '../../database.js';
import loginService from '../shared/ihalebul-login.js';

const BASE_URL = 'https://www.ihalebul.com/tenders/search';

/**
 * ihalebul.com alt-sayfaları:
 * - /contracted?workend=%3E0 → devam eden ihaleler (sözleşmeli, iş devam)
 * - /contracted?workend=%3C0 → tamamlanan ihaleler (sözleşmeli, iş bitti)
 * - /contracted?participanttitle_in= → tüm katıldığı ihaleler (yedek kaynak)
 */
const SEARCH_PHASES = [
  {
    path: '/contracted',
    paramKey: 'contractortitle_in',
    extraParams: '&workend=%3E0',
    defaultDurum: 'devam',
    defaultRol: 'yuklenici',
    label: 'devam eden',
  },
  {
    path: '/contracted',
    paramKey: 'contractortitle_in',
    extraParams: '&workend=%3C0',
    defaultDurum: 'tamamlandi',
    defaultRol: 'yuklenici',
    label: 'tamamlanan',
  },
  {
    path: '/contracted',
    paramKey: 'participanttitle_in',
    extraParams: '',
    defaultDurum: 'bilinmiyor',
    defaultRol: 'katilimci',
    label: 'katılım (tüm)',
  },
];

const PAGE_DELAY_MIN = 2000;
const PAGE_DELAY_MAX = 5000;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelay() {
  return delay(PAGE_DELAY_MIN + Math.random() * (PAGE_DELAY_MAX - PAGE_DELAY_MIN));
}

/**
 * Tek bir yüklenicinin ihale geçmişini scrape et
 *
 * Birden fazla URL path'i tarar (devam eden + tamamlanan)
 * ve her birini ayrı ayrı çeker.
 *
 * @param {import('puppeteer').Page} page
 * @param {Object} yuklenici - { id, unvan }
 * @param {Object} options
 * @param {number} options.maxPages - Her fazda maks sayfa (varsayılan: 15)
 * @param {Function} options.onPageComplete - Sayfa callback
 */
export async function scrapeContractorTenders(page, yuklenici, options = {}) {
  const { maxPages = 15, onPageComplete = null } = options;

  const stats = {
    pages_scraped: 0,
    tenders_found: 0,
    tenders_saved: 0,
    errors: 0,
    phases: [],
  };

  // Görülen externalId'leri takip et (tekrar kayıt önleme)
  const seenIds = new Set();

  try {
    await loginService.ensureLoggedIn(page);
    await delay(3000);

    // Türkçe locale ile büyük harfe çevir (i→İ, ı→I doğru olsun)
    // ve boşlukları + ile encode et (ihalebul.com + bekler, %20 değil)
    const upperName = yuklenici.unvan.toLocaleUpperCase('tr-TR');
    const encodedName = encodeURIComponent(upperName).replace(/%20/g, '+');

    // Her fazı sırayla tara
    for (const phase of SEARCH_PHASES) {
      const phaseStats = { label: phase.label, tenders: 0, pages: 0 };

      const searchUrl = `${BASE_URL}${phase.path}?workcategory_in=15&${phase.paramKey}=${encodedName}${phase.extraParams}`;

      await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      await randomDelay();

      let currentPage = 1;

      while (currentPage <= maxPages) {
        // Login kontrolü
        if (!(await loginService.isLoggedIn(page))) {
          await loginService.forceRelogin(page);
          await page.goto(`${searchUrl}&page=${currentPage}`, {
            waitUntil: 'networkidle2',
            timeout: 30000,
          });
          await randomDelay();
        }

        // Scroll
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await delay(1000);

        // İhaleleri çıkar
        const tenders = await extractTendersFromPage(page);

        if (tenders.length === 0) break;

        stats.tenders_found += tenders.length;
        phaseStats.tenders += tenders.length;

        // DB'ye kaydet
        for (const tender of tenders) {
          // Tekrar kontrol
          if (tender.externalId && seenIds.has(tender.externalId)) continue;
          if (tender.externalId) seenIds.add(tender.externalId);

          // Faz'dan gelen default durum bilgisini ekle
          if (phase.defaultDurum && !tender.tamamlandi && !tender.devamEdiyor && !tender.iptalEdildi) {
            if (phase.defaultDurum === 'devam') tender.devamEdiyor = true;
            if (phase.defaultDurum === 'tamamlandi') tender.tamamlandi = true;
          }

          try {
            await saveTenderHistory(yuklenici.id, tender, phase.defaultRol || 'yuklenici');
            stats.tenders_saved++;
          } catch (_e) {
            stats.errors++;
          }
        }

        stats.pages_scraped++;
        phaseStats.pages++;

        if (onPageComplete) {
          onPageComplete(currentPage, tenders, stats);
        }

        // Sonraki sayfa
        const hasNext = await page.evaluate((current) => {
          const select = document.querySelector('select[name="page"]');
          if (select) {
            const opts = Array.from(select.querySelectorAll('option'));
            return current < opts.length;
          }
          return false;
        }, currentPage);

        if (!hasNext) break;

        await page.goto(`${searchUrl}&page=${currentPage + 1}`, {
          waitUntil: 'networkidle2',
          timeout: 30000,
        });
        await randomDelay();
        currentPage++;
      }

      stats.phases.push(phaseStats);

      // Fazlar arası kısa bekleme
      await delay(2000);
    }

    // İstatistikleri güncelle
    await updateContractorStats(yuklenici.id);

    // Veri kaynağı kaydı
    await updateVeriKaynaklari(yuklenici.id, 'ihale_gecmisi');
  } catch (error) {
    stats.errors++;
    throw error;
  }

  return { success: true, stats };
}

/**
 * Batch: Birden fazla yüklenicinin ihale geçmişini sırayla çek
 *
 * @param {import('puppeteer').Page} page
 * @param {Object} options
 * @param {number} options.maxContractors
 * @param {number} options.maxPagesPerContractor
 * @param {Function} options.onProgress
 */
export async function batchScrapeContractorTenders(page, options = {}) {
  const { maxContractors = 10, maxPagesPerContractor = 5, onProgress = null } = options;

  // İstihbarat takibindeki yüklenicileri al (en eski scraped_at önce)
  const result = await query(
    `
    SELECT id, unvan FROM yukleniciler
    WHERE istihbarat_takibi = true
    ORDER BY scraped_at ASC NULLS FIRST
    LIMIT $1
  `,
    [maxContractors]
  );

  const yukleniciler = result.rows;
  const batchStats = {
    total: yukleniciler.length,
    processed: 0,
    total_tenders: 0,
    errors: 0,
  };

  for (const yk of yukleniciler) {
    try {
      const scrapeResult = await scrapeContractorTenders(page, yk, {
        maxPages: maxPagesPerContractor,
      });
      batchStats.total_tenders += scrapeResult.stats.tenders_saved;
    } catch (_error) {
      batchStats.errors++;
    }

    batchStats.processed++;

    if (onProgress) {
      onProgress(batchStats);
    }

    // İstekler arası bekleme
    await delay(3000 + Math.random() * 2000);
  }

  return { success: true, stats: batchStats };
}

/**
 * KİK kararları scraper
 *
 * ihalebul.com'daki "karar verilen" ihaleleri tarar:
 * URL: /tenders/search/decided?contractortitle_in=X&workcategory_in=15
 *
 * Aynı kart yapısını kullanır, extractTendersFromPage yeniden kullanılır.
 *
 * @param {import('puppeteer').Page} page
 * @param {Object} yuklenici - { id, unvan }
 * @param {Object} options
 * @param {number} options.maxPages - Maks sayfa (varsayılan: 3)
 * @param {Function} options.onProgress - İlerleme callback
 */
export async function scrapeKikDecisions(page, yuklenici, options = {}) {
  const { maxPages = 3, onProgress = null } = options;

  const stats = {
    pages_scraped: 0,
    tenders_found: 0,
    tenders_saved: 0,
    errors: 0,
  };

  try {
    await loginService.ensureLoggedIn(page);
    await delay(2000);

    const upperName = yuklenici.unvan.toLocaleUpperCase('tr-TR');
    const encodedName = encodeURIComponent(upperName).replace(/%20/g, '+');

    const searchUrl = `${BASE_URL}/decided?workcategory_in=15&contractortitle_in=${encodedName}`;

    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await randomDelay();

    let currentPage = 1;

    while (currentPage <= maxPages) {
      // Login kontrolü
      if (!(await loginService.isLoggedIn(page))) {
        await loginService.forceRelogin(page);
        await page.goto(`${searchUrl}&page=${currentPage}`, {
          waitUntil: 'networkidle2',
          timeout: 30000,
        });
        await randomDelay();
      }

      // Scroll
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await delay(1000);

      // İhaleleri çıkar (aynı kart yapısı)
      const tenders = await extractTendersFromPage(page);

      if (tenders.length === 0) break;

      stats.tenders_found += tenders.length;

      // DB'ye kaydet (rol = 'kik_karari' olarak)
      for (const tender of tenders) {
        try {
          await saveTenderHistory(yuklenici.id, tender, 'kik_karari');
          stats.tenders_saved++;
        } catch (_e) {
          stats.errors++;
        }
      }

      stats.pages_scraped++;

      if (onProgress) {
        onProgress(`Sayfa ${currentPage}: ${tenders.length} karar (toplam ${stats.tenders_saved})`);
      }

      // Sonraki sayfa
      const hasNext = await page.evaluate((current) => {
        const select = document.querySelector('select[name="page"]');
        if (select) {
          const opts = Array.from(select.querySelectorAll('option'));
          return current < opts.length;
        }
        return false;
      }, currentPage);

      if (!hasNext) break;

      await page.goto(`${searchUrl}&page=${currentPage + 1}`, {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });
      await randomDelay();
      currentPage++;
    }
  } catch (error) {
    stats.errors++;
    // KIK kararları opsiyonel — hata fırlatma
    if (onProgress) onProgress(`Hata: ${error.message}`);
  }

  // Veri kaynağı kaydı
  if (stats.tenders_saved > 0) {
    await updateVeriKaynaklari(yuklenici.id, 'kik_kararlari').catch(() => {});
  }

  return { success: true, stats };
}

/**
 * Sayfadaki ihale kartlarından bilgileri çıkar
 */
async function extractTendersFromPage(page) {
  return await page.evaluate(() => {
    const results = [];

    document.querySelectorAll('.card.border-secondary.my-2.mx-1').forEach((card) => {
      try {
        const text = card.textContent;

        // Detay linki
        const detailLink = Array.from(card.querySelectorAll('a[href*="/tender/"]')).find((a) =>
          a.href.match(/\/tender\/\d+$/)
        );
        if (!detailLink) return;

        const url = detailLink.href;
        const externalId = url.match(/\/tender\/(\d+)$/)?.[1];
        const baslik = detailLink.textContent.trim();
        if (!externalId) return;

        // Kayıt no
        const badge = card.querySelector('.badge.text-info');
        const ikn = badge?.textContent.trim().replace(/^#/, '');

        // Kurum
        const kurumMatch = text.match(/(?:İdare adı|İdarenin adı)[:\s]+([^\n]+)/i);
        const kurum = kurumMatch ? kurumMatch[1].trim() : null;

        // Şehir
        const nonLocationTexts = [
          'Ekap', 'Gazete', 'İstihbarat', 'Özel Sektör',
          'Açık ihale', 'Belli istekliler', 'Pazarlık', 'Doğrudan',
        ];
        const locationDivs = Array.from(card.querySelectorAll('.text-dark-emphasis.fw-medium.text-nowrap'))
          .map((d) => d.textContent.trim())
          .filter((t) => t.length > 0 && t.length <= 30 && !nonLocationTexts.some((nl) => t.includes(nl)));
        const sehir = locationDivs.length >= 2 ? locationDivs[1] : locationDivs[0] || null;

        // Sözleşme bedeli
        const bedelMatch = text.match(/Sözleşme bedeli:\s*₺?([\d.,]+)/i);
        const sozlesmeBedeli = bedelMatch
          ? parseFloat(bedelMatch[1].replace(/\./g, '').replace(',', '.'))
          : null;

        // İndirim oranı
        const indirimMatch = text.match(/%\s*([\d.,]+)/);
        const indirimOrani = indirimMatch ? parseFloat(indirimMatch[1].replace(',', '.')) : null;

        // Sözleşme tarihi
        const tarihMatch = text.match(/Sözleşme tarihi:\s*([\d.]+)/i);
        const sozlesmeTarihi = tarihMatch ? tarihMatch[1] : null;

        // Tamamlandı mı?
        const tamamlandi = text.includes('Tamamlandı');

        // Devam ediyor mu?
        const devamEdiyor = text.includes('Devam Ediyor') || text.includes('Sözleşme Devam') || text.includes('İş Devam');

        // İptal mi?
        const iptalEdildi = text.includes('İptal') || text.includes('İptal Edildi');

        // Fesih durumu
        const fesihMatch = text.match(/Fesih[:\s]+([^\n]+)/i);
        const fesih = fesihMatch ? fesihMatch[1].trim() : null;

        // Yaklaşık maliyet
        const yaklasikMatch = text.match(/Yaklaşık maliyet:\s*₺?([\d.,]+)/i);
        const yaklasikMaliyet = yaklasikMatch
          ? parseFloat(yaklasikMatch[1].replace(/\./g, '').replace(',', '.'))
          : null;

        // İş başlangıç tarihi
        const basMatch = text.match(/İş başlangıç:\s*([\d.]+)/i);
        const isBaslangic = basMatch ? basMatch[1] : null;

        // İş bitiş tarihi
        const bitisMatch = text.match(/İş bitiş:\s*([\d.]+)/i);
        const isBitis = bitisMatch ? bitisMatch[1] : null;

        results.push({
          externalId,
          baslik,
          ikn,
          kurum,
          sehir,
          sozlesmeBedeli,
          indirimOrani,
          sozlesmeTarihi,
          yaklasikMaliyet,
          isBaslangic,
          isBitis,
          tamamlandi,
          devamEdiyor,
          iptalEdildi,
          fesih,
          url,
        });
      } catch (_e) {}
    });

    return results;
  });
}

/**
 * Yüklenici ihale geçmişini DB'ye kaydet
 *
 * NOT: UNIQUE(yuklenici_id, tender_id, rol) constraint'i tender_id NULL olunca
 * çalışmaz (PostgreSQL'de NULL != NULL). Bu yüzden iki strateji:
 *   1. tender_id NOT NULL → ON CONFLICT ile upsert
 *   2. tender_id NULL → IKN veya başlık ile manuel kontrol, sonra INSERT/UPDATE
 */
async function saveTenderHistory(yukleniciId, tender, rol = 'yuklenici') {
  // Tarih parse helper (DD.MM.YYYY -> YYYY-MM-DD)
  function parseDateDMY(dateStr) {
    if (!dateStr) return null;
    const parts = dateStr.split('.');
    if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
    return null;
  }

  const sozlesmeTarihi = parseDateDMY(tender.sozlesmeTarihi);
  const isBaslangic = parseDateDMY(tender.isBaslangic);
  const isBitis = parseDateDMY(tender.isBitis);

  // tenders tablosunda var mı?
  let tenderId = null;
  if (tender.externalId) {
    const tResult = await query('SELECT id FROM tenders WHERE external_id = $1', [tender.externalId]);
    if (tResult.rows.length > 0) {
      tenderId = tResult.rows[0].id;
    }
  }

  // Durum belirle (öncelik: fesih > iptal > tamamlandi > devam > bilinmiyor)
  let durum = 'bilinmiyor';
  if (tender.devamEdiyor) durum = 'devam';
  if (tender.tamamlandi) durum = 'tamamlandi';
  if (tender.iptalEdildi) durum = 'iptal';
  if (tender.fesih && tender.fesih.toLowerCase() !== 'yok') durum = 'iptal';
  
  // Sözleşme bedeli varsa ama ne tamamlanmış ne devam eden olarak işaretlenmemişse:
  // büyük ihtimalle tamamlanmıştır (ihalebul'da bazı kartlarda durum text'i yok olabiliyor)
  if (durum === 'bilinmiyor' && tender.sozlesmeBedeli) {
    durum = 'tamamlandi';
  }

  const params = [
    yukleniciId,       // $1
    tenderId,          // $2
    tender.baslik,     // $3
    tender.kurum,      // $4
    tender.sehir,      // $5
    tender.sozlesmeBedeli, // $6
    sozlesmeTarihi,    // $7
    tender.indirimOrani,   // $8
    durum,             // $9
    tender.fesih || null,  // $10
    tender.ikn,        // $11
    rol,               // $12
    tender.yaklasikMaliyet || null, // $13
    isBaslangic,       // $14
    isBitis,           // $15
  ];

  if (tenderId) {
    // Strateji 1: tender_id var → ON CONFLICT kullan
    await query(
      `
      INSERT INTO yuklenici_ihaleleri (
        yuklenici_id, tender_id, ihale_basligi, kurum_adi, sehir,
        sozlesme_bedeli, sozlesme_tarihi, indirim_orani, rol, durum, fesih_durumu, ikn,
        yaklasik_maliyet, is_baslangic, is_bitis
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $12, $9, $10, $11, $13, $14, $15)
      ON CONFLICT (yuklenici_id, tender_id, rol) DO UPDATE SET
        ihale_basligi = COALESCE(EXCLUDED.ihale_basligi, yuklenici_ihaleleri.ihale_basligi),
        kurum_adi = COALESCE(EXCLUDED.kurum_adi, yuklenici_ihaleleri.kurum_adi),
        sehir = COALESCE(EXCLUDED.sehir, yuklenici_ihaleleri.sehir),
        sozlesme_bedeli = COALESCE(EXCLUDED.sozlesme_bedeli, yuklenici_ihaleleri.sozlesme_bedeli),
        sozlesme_tarihi = COALESCE(EXCLUDED.sozlesme_tarihi, yuklenici_ihaleleri.sozlesme_tarihi),
        indirim_orani = COALESCE(EXCLUDED.indirim_orani, yuklenici_ihaleleri.indirim_orani),
        durum = EXCLUDED.durum,
        fesih_durumu = COALESCE(EXCLUDED.fesih_durumu, yuklenici_ihaleleri.fesih_durumu),
        yaklasik_maliyet = COALESCE(EXCLUDED.yaklasik_maliyet, yuklenici_ihaleleri.yaklasik_maliyet),
        is_baslangic = COALESCE(EXCLUDED.is_baslangic, yuklenici_ihaleleri.is_baslangic),
        is_bitis = COALESCE(EXCLUDED.is_bitis, yuklenici_ihaleleri.is_bitis)
    `,
      params
    );
  } else {
    // Strateji 2: tender_id NULL → IKN veya başlık ile kontrol et
    let existing = null;
    if (tender.ikn) {
      const r = await query(
        `SELECT id FROM yuklenici_ihaleleri WHERE yuklenici_id = $1 AND ikn = $2 AND rol = $3 LIMIT 1`,
        [yukleniciId, tender.ikn, rol]
      );
      existing = r.rows[0] || null;
    }
    if (!existing && tender.baslik) {
      const r = await query(
        `SELECT id FROM yuklenici_ihaleleri WHERE yuklenici_id = $1 AND ihale_basligi = $2 AND rol = $3 LIMIT 1`,
        [yukleniciId, tender.baslik, rol]
      );
      existing = r.rows[0] || null;
    }

    if (existing) {
      // Güncelle
      await query(
        `UPDATE yuklenici_ihaleleri SET
          ihale_basligi = COALESCE($1, ihale_basligi),
          kurum_adi = COALESCE($2, kurum_adi),
          sehir = COALESCE($3, sehir),
          sozlesme_bedeli = COALESCE($4, sozlesme_bedeli),
          sozlesme_tarihi = COALESCE($5, sozlesme_tarihi),
          indirim_orani = COALESCE($6, indirim_orani),
          durum = $7,
          fesih_durumu = COALESCE($8, fesih_durumu),
          ikn = COALESCE($9, ikn),
          yaklasik_maliyet = COALESCE($10, yaklasik_maliyet),
          is_baslangic = COALESCE($11, is_baslangic),
          is_bitis = COALESCE($12, is_bitis)
        WHERE id = $13`,
        [
          tender.baslik, tender.kurum, tender.sehir,
          tender.sozlesmeBedeli, sozlesmeTarihi, tender.indirimOrani,
          durum, tender.fesih || null, tender.ikn,
          tender.yaklasikMaliyet || null, isBaslangic, isBitis,
          existing.id,
        ]
      );
    } else {
      // Yeni kayıt
      await query(
        `INSERT INTO yuklenici_ihaleleri (
          yuklenici_id, tender_id, ihale_basligi, kurum_adi, sehir,
          sozlesme_bedeli, sozlesme_tarihi, indirim_orani, rol, durum, fesih_durumu, ikn,
          yaklasik_maliyet, is_baslangic, is_bitis
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $12, $9, $10, $11, $13, $14, $15)`,
        params
      );
    }
  }
}

/**
 * Yüklenici istatistiklerini güncelle
 */
async function updateContractorStats(yukleniciId) {
  await query(
    `
    UPDATE yukleniciler SET
      katildigi_ihale_sayisi = (
        SELECT COUNT(*) FROM yuklenici_ihaleleri WHERE yuklenici_id = $1
      ),
      tamamlanan_is_sayisi = (
        SELECT COUNT(*) FROM yuklenici_ihaleleri WHERE yuklenici_id = $1 AND rol = 'yuklenici' AND durum = 'tamamlandi'
      ),
      devam_eden_is_sayisi = (
        SELECT COUNT(*) FROM yuklenici_ihaleleri WHERE yuklenici_id = $1 AND rol = 'yuklenici' AND durum = 'devam'
      ),
      fesih_sayisi = (
        SELECT COUNT(*) FROM yuklenici_ihaleleri WHERE yuklenici_id = $1 AND durum = 'iptal'
      ),
      toplam_sozlesme_bedeli = COALESCE((
        SELECT SUM(sozlesme_bedeli) FROM yuklenici_ihaleleri WHERE yuklenici_id = $1 AND rol = 'yuklenici' AND sozlesme_bedeli IS NOT NULL
      ), 0),
      ortalama_indirim_orani = (
        SELECT AVG(indirim_orani) FROM yuklenici_ihaleleri WHERE yuklenici_id = $1 AND rol = 'yuklenici' AND indirim_orani IS NOT NULL
      ),
      aktif_sehirler = COALESCE((
        SELECT jsonb_agg(DISTINCT sehir) FROM yuklenici_ihaleleri WHERE yuklenici_id = $1 AND sehir IS NOT NULL
      ), '[]'::jsonb),
      son_ihale_tarihi = (
        SELECT MAX(sozlesme_tarihi) FROM yuklenici_ihaleleri WHERE yuklenici_id = $1
      ),
      scraped_at = NOW(),
      updated_at = NOW()
    WHERE id = $1
  `,
    [yukleniciId]
  );

  // Kazanma oranı: kazanılan (yuklenici rolü) / toplam katılım
  await query(
    `
    UPDATE yukleniciler SET
      kazanma_orani = CASE 
        WHEN katildigi_ihale_sayisi > 0 
        THEN ROUND(
          (SELECT COUNT(*)::numeric FROM yuklenici_ihaleleri WHERE yuklenici_id = $1 AND rol = 'yuklenici')
          / katildigi_ihale_sayisi * 100, 2
        )
        ELSE 0 
      END
    WHERE id = $1
  `,
    [yukleniciId]
  );
}

/**
 * Veri kaynağı kaydını güncelle (audit trail)
 */
async function updateVeriKaynaklari(yukleniciId, kaynak) {
  try {
    await query(
      `UPDATE yukleniciler SET veri_kaynaklari = (
        SELECT jsonb_agg(DISTINCT elem)
        FROM jsonb_array_elements(
          COALESCE(veri_kaynaklari, '[]'::jsonb) || $1::jsonb
        ) AS elem
      ) WHERE id = $2`,
      [JSON.stringify([{ kaynak, tarih: new Date().toISOString() }]), yukleniciId]
    );
  } catch (_e) {
    // Veri kaynağı kaydı opsiyonel — hata yutulur
  }
}

export default { scrapeContractorTenders, batchScrapeContractorTenders, scrapeKikDecisions };
