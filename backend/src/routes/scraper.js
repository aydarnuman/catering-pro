/**
 * ============================================================================
 * SCRAPER API ROUTES
 * ============================================================================
 *
 * Admin panel için scraper yönetim endpoint'leri
 *
 * Endpoints:
 * - GET  /api/scraper/health     → Circuit breaker durumu
 * - GET  /api/scraper/stats      → Queue istatistikleri
 * - GET  /api/scraper/jobs       → Job listesi
 * - GET  /api/scraper/logs       → Son loglar
 * - POST /api/scraper/trigger    → Manuel scraping başlat
 * - POST /api/scraper/reset      → Circuit breaker sıfırla
 * - POST /api/scraper/retry      → Başarısız job'ları tekrar dene
 * - POST /api/scraper/cancel     → Bekleyen job'ları iptal et
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { query } from '../database.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Tüm scraper endpoint'leri için admin yetkisi gerekli
router.use(authenticate, requireAdmin);

// ============================================================================
// HEALTH & STATUS
// ============================================================================

/**
 * GET /api/scraper/health
 * Circuit breaker ve sistem durumu
 */
router.get('/health', async (_req, res) => {
  try {
    // scraper_health tablosundan durum al
    const healthResult = await query(`
      SELECT 
        status,
        failure_count,
        success_count,
        failure_threshold,
        last_success_at,
        last_failure_at,
        cooldown_until,
        stats,
        updated_at
      FROM scraper_health 
      WHERE source = 'ihalebul'
    `);

    const health = healthResult.rows[0] || {
      status: 'unknown',
      failure_count: 0,
      success_count: 0,
      failure_threshold: 5,
    };

    // Cooldown kalan süre hesapla
    let cooldownRemaining = null;
    if (health.cooldown_until) {
      const remaining = new Date(health.cooldown_until) - Date.now();
      if (remaining > 0) {
        cooldownRemaining = Math.ceil(remaining / 1000);
      }
    }

    res.json({
      success: true,
      data: {
        status: health.status || 'healthy',
        statusText: getStatusText(health.status || 'healthy'),
        failureCount: health.failure_count || 0,
        successCount: health.success_count || 0,
        failureThreshold: health.failure_threshold || 5,
        lastSuccess: health.last_success_at,
        lastFailure: health.last_failure_at,
        cooldownUntil: health.cooldown_until,
        cooldownRemaining,
        stats: health.stats,
        updatedAt: health.updated_at,
        isHealthy: health.status === 'healthy',
        canExecute: health.status !== 'open' || !cooldownRemaining,
      },
    });
  } catch (_error) {
    // Tablo yoksa default döndür
    res.json({
      success: true,
      data: {
        status: 'healthy',
        statusText: 'Sistem normal çalışıyor',
        failureCount: 0,
        successCount: 0,
        failureThreshold: 5,
        lastSuccess: null,
        lastFailure: null,
        cooldownUntil: null,
        cooldownRemaining: null,
        stats: null,
        updatedAt: null,
        isHealthy: true,
        canExecute: true,
      },
    });
  }
});

/**
 * GET /api/scraper/stats
 * Queue istatistikleri
 */
router.get('/stats', async (_req, res) => {
  try {
    // Genel istatistikler
    const summary = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      retry_pending: 0,
      cancelled: 0,
      total: 0,
    };

    try {
      const summaryResult = await query(`
        SELECT 
          status,
          COUNT(*) as count
        FROM scraper_jobs
        GROUP BY status
      `);

      for (const row of summaryResult.rows) {
        summary[row.status] = parseInt(row.count, 10);
        summary.total += parseInt(row.count, 10);
      }
    } catch (_e) {
      // Tablo yoksa varsayılan değerler
    }

    // Son 24 saat
    let last24h = { completed: 0, failed: 0, avgDuration: 0 };
    try {
      const last24hResult = await query(`
        SELECT 
          COUNT(*) FILTER (WHERE status = 'completed') as completed,
          COUNT(*) FILTER (WHERE status = 'failed') as failed,
          AVG(duration_ms) FILTER (WHERE status = 'completed') as avg_duration
        FROM scraper_jobs
        WHERE created_at > NOW() - INTERVAL '24 hours'
      `);

      const row = last24hResult.rows[0] || {};
      last24h = {
        completed: parseInt(row.completed, 10) || 0,
        failed: parseInt(row.failed, 10) || 0,
        avgDuration: Math.round(row.avg_duration) || 0,
      };
    } catch (_e) {
      // Tablo yoksa varsayılan değerler
    }

    // Son 7 gün trend
    let trend = [];
    try {
      const trendResult = await query(`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) FILTER (WHERE status = 'completed') as completed,
          COUNT(*) FILTER (WHERE status = 'failed') as failed
        FROM scraper_jobs
        WHERE created_at > NOW() - INTERVAL '7 days'
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `);
      trend = trendResult.rows;
    } catch (_e) {
      // Tablo yoksa boş
    }

    // Son scraping bilgisi (scraper_logs'dan)
    let lastRun = null;
    try {
      const lastRunResult = await query(`
        SELECT 
          created_at,
          context
        FROM scraper_logs
        WHERE module = 'Runner' AND message LIKE '%tamamlandı%'
        ORDER BY created_at DESC
        LIMIT 1
      `);

      if (lastRunResult.rows[0]) {
        lastRun = {
          created_at: lastRunResult.rows[0].created_at,
          completed_at: lastRunResult.rows[0].created_at,
          duration_ms: lastRunResult.rows[0].context?.duration || 0,
          result: lastRunResult.rows[0].context,
        };
      }
    } catch (_e) {
      // Tablo yoksa null
    }

    res.json({
      success: true,
      data: {
        summary,
        last24h,
        trend,
        lastRun,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// JOB LİSTESİ
// ============================================================================

/**
 * GET /api/scraper/jobs
 * Job listesi (filtrelenebilir)
 * Query params: status, limit, offset
 */
router.get('/jobs', async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;

    let sql = `
      SELECT 
        j.id,
        j.job_type,
        j.external_id,
        j.tender_url,
        j.status,
        j.priority,
        j.retry_count,
        j.max_retries,
        j.error_message,
        j.created_at,
        j.started_at,
        j.completed_at,
        j.duration_ms,
        t.title as tender_title
      FROM scraper_jobs j
      LEFT JOIN tenders t ON j.tender_id = t.id
    `;

    const params = [];

    if (status && status !== 'all') {
      params.push(status);
      sql += ` WHERE j.status = $${params.length}`;
    }

    sql += ` ORDER BY j.created_at DESC`;
    sql += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit, 10), parseInt(offset, 10));

    const result = await query(sql, params);

    // Toplam sayı
    let countSql = 'SELECT COUNT(*) FROM scraper_jobs';
    if (status && status !== 'all') {
      countSql += ` WHERE status = $1`;
    }
    const countResult = await query(countSql, status && status !== 'all' ? [status] : []);

    res.json({
      success: true,
      data: {
        jobs: result.rows,
        total: parseInt(countResult.rows[0].count, 10),
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
      },
    });
  } catch (_error) {
    // Tablo yoksa boş döndür
    res.json({
      success: true,
      data: {
        jobs: [],
        total: 0,
        limit: parseInt(req.query.limit, 10) || 50,
        offset: parseInt(req.query.offset, 10) || 0,
      },
    });
  }
});

// ============================================================================
// LOGLAR
// ============================================================================

/**
 * GET /api/scraper/logs
 * Son loglar
 * Query params: level, module, limit
 */
router.get('/logs', async (req, res) => {
  try {
    const { level, module, limit = 100 } = req.query;

    let sql = `
      SELECT 
        id,
        level,
        module,
        message,
        context,
        session_id,
        created_at
      FROM scraper_logs
      WHERE 1=1
    `;

    const params = [];

    if (level && level !== 'all') {
      params.push(level);
      sql += ` AND level = $${params.length}`;
    }

    if (module) {
      params.push(`%${module}%`);
      sql += ` AND module ILIKE $${params.length}`;
    }

    sql += ` ORDER BY created_at DESC`;
    sql += ` LIMIT $${params.length + 1}`;
    params.push(parseInt(limit, 10));

    const result = await query(sql, params);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (_error) {
    // Tablo yoksa boş döndür
    res.json({
      success: true,
      data: [],
    });
  }
});

// ============================================================================
// KONTROL İŞLEMLERİ
// ============================================================================

/**
 * POST /api/scraper/trigger
 * Manuel scraping başlat
 */
router.post('/trigger', async (req, res) => {
  try {
    const { mode = 'list', pages = 3, limit = 100 } = req.body;

    // Mode mapping (eski → yeni)
    const modeMap = {
      quick: 'list', // Hızlı = sadece liste
      full: 'full', // Tam = liste + döküman
      list: 'list', // Liste
      docs: 'docs', // Dökümanlar
      retry: 'retry', // Başarısızları tekrar dene
    };

    const actualMode = modeMap[mode] || 'list';

    // Runner'ı başlat
    const scraperPath = path.join(__dirname, '../scraper/runner.js');

    // Parametreleri oluştur
    const args = [`--mode=${actualMode}`];
    if (actualMode === 'list' || actualMode === 'full') {
      args.push(`--pages=${pages}`);
    }
    if (actualMode === 'docs' || actualMode === 'retry') {
      args.push(`--limit=${limit}`);
    }

    const child = spawn('node', [scraperPath, ...args], {
      cwd: path.join(__dirname, '..'),
      detached: true,
      stdio: 'ignore',
    });

    child.unref();

    // Log kaydet
    try {
      await query(
        `
        INSERT INTO scraper_logs (level, module, message, context)
        VALUES ('INFO', 'AdminPanel', 'Manuel scraping başlatıldı', $1)
      `,
        [JSON.stringify({ mode: actualMode, pages, limit, action: 'trigger' })]
      );
    } catch (_e) {
      // Log tablosu yoksa geç
    }

    res.json({
      success: true,
      message: `Scraping başlatıldı (${actualMode} mode${actualMode === 'list' || actualMode === 'full' ? `, ${pages} sayfa` : `, ${limit} limit`})`,
      pid: child.pid,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/scraper/reset
 * Circuit breaker'ı sıfırla
 */
router.post('/reset', async (_req, res) => {
  try {
    await query(`
      UPDATE scraper_health SET
        status = 'healthy',
        failure_count = 0,
        success_count = 0,
        cooldown_until = NULL,
        updated_at = NOW()
      WHERE source = 'ihalebul'
    `);

    // Log kaydet
    try {
      await query(
        `
        INSERT INTO scraper_logs (level, module, message, context)
        VALUES ('WARN', 'AdminPanel', 'Circuit breaker manuel olarak sıfırlandı', $1)
      `,
        [JSON.stringify({ action: 'reset', user: 'admin' })]
      );
    } catch (_e) {
      // Log tablosu yoksa geç
    }

    res.json({
      success: true,
      message: 'Circuit breaker sıfırlandı',
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/scraper/retry
 * Başarısız job'ları tekrar kuyruğa al
 */
router.post('/retry', async (req, res) => {
  try {
    const { limit = 50 } = req.body;

    const result = await query(
      `
      UPDATE scraper_jobs SET
        status = 'pending',
        retry_count = 0,
        next_retry_at = NULL,
        error_message = NULL,
        error_details = NULL,
        completed_at = NULL
      WHERE status = 'failed'
      AND id IN (
        SELECT id FROM scraper_jobs 
        WHERE status = 'failed'
        LIMIT $1
      )
    `,
      [limit]
    );

    // Log kaydet
    try {
      await query(
        `
        INSERT INTO scraper_logs (level, module, message, context)
        VALUES ('INFO', 'AdminPanel', 'Başarısız job''lar yeniden kuyruğa alındı', $1)
      `,
        [JSON.stringify({ count: result.rowCount, action: 'retry' })]
      );
    } catch (_e) {
      // Log tablosu yoksa geç
    }

    res.json({
      success: true,
      message: `${result.rowCount} job yeniden kuyruğa alındı`,
      count: result.rowCount,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/scraper/cancel
 * Bekleyen job'ları iptal et
 */
router.post('/cancel', async (_req, res) => {
  try {
    const result = await query(`
      UPDATE scraper_jobs SET
        status = 'cancelled',
        completed_at = NOW()
      WHERE status IN ('pending', 'retry_pending')
    `);

    res.json({
      success: true,
      message: `${result.rowCount} job iptal edildi`,
      count: result.rowCount,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/scraper/cleanup
 * Eski verileri temizle
 */
router.post('/cleanup', async (req, res) => {
  try {
    const { days = 7 } = req.body;

    let deletedJobs = 0;
    let deletedLogs = 0;

    // Eski job'ları sil
    try {
      const jobsResult = await query(`
        DELETE FROM scraper_jobs
        WHERE status IN ('completed', 'cancelled')
        AND completed_at < NOW() - INTERVAL '${days} days'
      `);
      deletedJobs = jobsResult.rowCount;
    } catch (_e) {
      // Tablo yoksa geç
    }

    // Eski logları sil
    try {
      const logsResult = await query(`
        DELETE FROM scraper_logs
        WHERE created_at < NOW() - INTERVAL '30 days'
      `);
      deletedLogs = logsResult.rowCount;
    } catch (_e) {
      // Tablo yoksa geç
    }

    res.json({
      success: true,
      message: 'Temizlik tamamlandı',
      deletedJobs,
      deletedLogs,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// İHALE DÖKÜMAN DURUMUNU KONTROL ET
// ============================================================================

/**
 * GET /api/scraper/check-documents/:tenderId
 * İhale döküman durumunu kontrol eder
 *
 * Dönen: { hasDocuments, needsUpdate, documentCount, lastUpdate }
 */
router.get('/check-documents/:tenderId', async (req, res) => {
  try {
    const { tenderId } = req.params;

    const result = await query(
      `
      SELECT 
        id,
        document_links,
        announcement_content,
        goods_services_content,
        zeyilname_content,
        correction_notice_content,
        updated_at
      FROM tenders 
      WHERE id = $1
    `,
      [tenderId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'İhale bulunamadı',
      });
    }

    const tender = result.rows[0];

    // Döküman sayısını hesapla
    const docLinks = tender.document_links || {};
    const documentCount = typeof docLinks === 'object' ? Object.keys(docLinks).length : 0;

    // Detay içerik kontrolü
    const hasAnnouncement = !!tender.announcement_content;
    const hasGoodsServices = !!tender.goods_services_content;
    const hasZeyilname = !!tender.zeyilname_content;
    const hasCorrectionNotice = !!tender.correction_notice_content;

    // Döküman var mı?
    const hasDocuments = documentCount > 0 || hasAnnouncement || hasGoodsServices;

    // Güncelleme gerekiyor mu? (12 saatten eskiyse)
    const lastUpdate = new Date(tender.updated_at);
    const now = new Date();
    const hoursSinceUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);
    const needsUpdate = !hasDocuments || hoursSinceUpdate > 12;

    res.json({
      success: true,
      data: {
        tenderId: parseInt(tenderId, 10),
        hasDocuments,
        needsUpdate,
        documentCount,
        hasAnnouncement,
        hasGoodsServices,
        hasZeyilname,
        hasCorrectionNotice,
        lastUpdate: tender.updated_at,
        hoursSinceUpdate: Math.round(hoursSinceUpdate * 10) / 10,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ============================================================================
// TEK İHALE İÇİN DÖKÜMAN LİNKLERİ ÇEK
// ============================================================================

/**
 * POST /api/scraper/fetch-documents/:tenderId
 * Tek bir ihale için ihalebul.com'dan döküman linklerini çeker
 */
router.post('/fetch-documents/:tenderId', async (req, res) => {
  try {
    const { tenderId } = req.params;

    // İhale bilgilerini al
    const tenderResult = await query(
      `
      SELECT id, external_id, url, title, document_links 
      FROM tenders 
      WHERE id = $1
    `,
      [tenderId]
    );

    if (tenderResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'İhale bulunamadı',
      });
    }

    const tender = tenderResult.rows[0];

    // Zaten döküman varsa bildir
    const _existingDocs =
      tender.document_links && typeof tender.document_links === 'object'
        ? Object.keys(tender.document_links).length
        : 0;

    // DocumentScraper ve browserManager'ı dinamik import et
    const browserManager = (await import('../scraper/browser-manager.js')).default;
    const documentScraper = (await import('../scraper/document-scraper.js')).default;
    const loginService = (await import('../scraper/login-service.js')).default;

    let page = null;

    try {
      // Browser başlat ve sayfa oluştur
      page = await browserManager.createPage();
      await loginService.ensureLoggedIn(page);
      const content = await documentScraper.scrapeAllContent(page, tender.url, false);

      const docCount = content.documentLinks ? Object.keys(content.documentLinks).length : 0;

      // Veritabanını güncelle
      if (docCount > 0 || content.announcementContent || content.goodsServicesList) {
        await query(
          `
          UPDATE tenders SET
            document_links = COALESCE($2, document_links),
            announcement_content = COALESCE($3, announcement_content),
            goods_services_content = COALESCE($4, goods_services_content),
            zeyilname_content = COALESCE($5, zeyilname_content),
            correction_notice_content = COALESCE($6, correction_notice_content),
            updated_at = NOW()
          WHERE id = $1
        `,
          [
            tenderId,
            docCount > 0 ? JSON.stringify(content.documentLinks) : null,
            content.announcementContent || null,
            content.goodsServicesList ? JSON.stringify(content.goodsServicesList) : null,
            content.zeyilnameContent ? JSON.stringify(content.zeyilnameContent) : null,
            content.correctionNoticeContent ? JSON.stringify(content.correctionNoticeContent) : null,
          ]
        );
      }

      // Log kaydet
      try {
        await query(
          `
          INSERT INTO scraper_logs (level, module, message, context)
          VALUES ('INFO', 'FetchDocuments', 'Döküman linkleri çekildi', $1)
        `,
          [
            JSON.stringify({
              tenderId,
              externalId: tender.external_id,
              docCount,
              hasAnnouncement: !!content.announcementContent,
              hasGoodsServices: !!content.goodsServicesList,
            }),
          ]
        );
      } catch (_e) {
        // Log hatası kritik değil
      }

      // hasZeyilname: content'ten veya document_links'ten kontrol et
      const docLinks = content.documentLinks || {};
      const hasZeyilnameInLinks = Object.keys(docLinks).some((k) => k.toLowerCase().includes('zeyilname'));

      res.json({
        success: true,
        data: {
          tenderId: parseInt(tenderId, 10),
          externalId: tender.external_id,
          documentLinks: docLinks,
          documentCount: docCount,
          hasAnnouncement: !!content.announcementContent,
          hasGoodsServices: !!content.goodsServicesList,
          hasZeyilname: !!content.zeyilnameContent || hasZeyilnameInLinks,
          hasCorrectionNotice: !!content.correctionNoticeContent,
        },
        message: docCount > 0 ? `${docCount} döküman linki bulundu` : 'Döküman linki bulunamadı',
      });
    } finally {
      // Sayfayı kapat (browser'ı kapatma, paylaşımlı olabilir)
      if (page) {
        try {
          await page.close();
        } catch (_e) {
          // Sayfa zaten kapalı olabilir
        }
      }
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ============================================================================
// URL İLE İHALE EKLEME
// ============================================================================

/**
 * POST /api/scraper/add-tender
 * URL ile yeni ihale ekler veya mevcut ihaleyi günceller
 *
 * Body: { url: "https://ihalebul.com/tender/123456" }
 *
 * Dönen: {
 *   success: true,
 *   data: { tenderId, externalId, title, city, documentCount, isNew },
 *   message: "..."
 * }
 */
router.post('/add-tender', async (req, res) => {
  const { url } = req.body;

  // Validasyon
  if (!url) {
    return res.status(400).json({ success: false, error: 'URL gerekli' });
  }

  const match = url.match(/\/tender\/(\d+)/);
  if (!match) {
    return res
      .status(400)
      .json({ success: false, error: 'Geçersiz URL formatı. Örnek: https://ihalebul.com/tender/123456' });
  }

  const externalId = match[1];

  let page = null;

  try {
    // Modülleri import et
    const browserManager = (await import('../scraper/browser-manager.js')).default;
    const documentScraper = (await import('../scraper/document-scraper.js')).default;
    const loginService = (await import('../scraper/login-service.js')).default;

    // Browser başlat ve login
    page = await browserManager.createPage();
    await loginService.ensureLoggedIn(page);

    // İhale detaylarını çek (yeni fonksiyon kullan)
    const details = await documentScraper.scrapeTenderDetails(page, url);

    // Tarih ve maliyet parse
    const parseTurkishDate = (str) => {
      if (!str) return null;
      // Format: "10 Şubat 2026" veya "10.02.2026"
      const months = {
        ocak: '01',
        şubat: '02',
        mart: '03',
        nisan: '04',
        mayıs: '05',
        haziran: '06',
        temmuz: '07',
        ağustos: '08',
        eylül: '09',
        ekim: '10',
        kasım: '11',
        aralık: '12',
      };

      // Türkçe format
      let m = str.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/i);
      if (m) {
        const day = m[1].padStart(2, '0');
        const month = months[m[2].toLowerCase()] || '01';
        return `${m[3]}-${month}-${day}`;
      }

      // Noktalı format
      m = str.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
      if (m) {
        return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
      }

      return null;
    };

    const parseCost = (str) => {
      if (!str) return null;
      const cleaned = str.replace(/\./g, '').replace(',', '.');
      const m = cleaned.match(/[\d.]+/);
      return m ? parseFloat(m[0]) : null;
    };

    // Mevcut ihale var mı kontrol et
    const existing = await query('SELECT id FROM tenders WHERE external_id = $1', [externalId]);

    let tenderId;
    let isNew = false;

    if (existing.rows.length > 0) {
      // GÜNCELLE
      tenderId = existing.rows[0].id;

      await query(
        `
        UPDATE tenders SET
          title = COALESCE($2, title),
          city = COALESCE($3, city),
          tender_date = COALESCE($4, tender_date),
          estimated_cost = COALESCE($5, estimated_cost),
          organization_name = COALESCE($6, organization_name),
          tender_type = COALESCE($7, tender_type),
          tender_method = COALESCE($8, tender_method),
          document_links = COALESCE($9, document_links),
          announcement_content = COALESCE($10, announcement_content),
          goods_services_content = COALESCE($11, goods_services_content),
          updated_at = NOW()
        WHERE id = $1
      `,
        [
          tenderId,
          details.title,
          details.city,
          parseTurkishDate(details.teklifTarihi),
          parseCost(details.yaklasikMaliyet),
          details.organization,
          details.ihaleTuru,
          details.ihaleUsulu,
          Object.keys(details.documentLinks || {}).length > 0 ? JSON.stringify(details.documentLinks) : null,
          details.announcementContent,
          details.goodsServicesList ? JSON.stringify(details.goodsServicesList) : null,
        ]
      );
    } else {
      // YENİ EKLE
      isNew = true;

      const result = await query(
        `
        INSERT INTO tenders (
          external_id, title, city, tender_date, estimated_cost, 
          organization_name, tender_type, tender_method,
          url, document_links, announcement_content, goods_services_content,
          tender_source, category_id, category_name
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'ihalebul.com', 15, 'Hazır Yemek - Lokantacılık')
        RETURNING id
      `,
        [
          externalId,
          details.title || 'İhale',
          details.city || 'Türkiye',
          parseTurkishDate(details.teklifTarihi),
          parseCost(details.yaklasikMaliyet),
          details.organization,
          details.ihaleTuru,
          details.ihaleUsulu,
          url,
          Object.keys(details.documentLinks || {}).length > 0 ? JSON.stringify(details.documentLinks) : null,
          details.announcementContent,
          details.goodsServicesList ? JSON.stringify(details.goodsServicesList) : null,
        ]
      );

      tenderId = result.rows[0].id;
    }

    // Döküman sayısı
    const docCount = Object.keys(details.documentLinks || {}).length;

    // Başarılı yanıt
    res.json({
      success: true,
      data: {
        tenderId,
        externalId,
        title: details.title,
        city: details.city,
        organization: details.organization,
        documentCount: docCount,
        isNew,
      },
      message: isNew ? `Yeni ihale eklendi (ID: ${tenderId})` : `Mevcut ihale güncellendi (ID: ${tenderId})`,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  } finally {
    // Sayfa kapat
    if (page) {
      try {
        await page.close();
      } catch (_e) {}
    }
  }
});

// ============================================================================
// HELPER
// ============================================================================

function getStatusText(status) {
  const texts = {
    healthy: 'Sistem normal çalışıyor',
    degraded: 'Sistem sorunlu ama çalışıyor',
    open: 'Devre açık - istekler engelleniyor',
    half_open: 'Test aşaması - tek istek deneniyor',
    unknown: 'Durum bilinmiyor',
  };
  return texts[status] || status;
}

// =============================================
// TAKİP EDİLEN İHALELERİ GÜNCELLE
// =============================================
router.post('/update-tracked', async (_req, res) => {
  try {
    // Takip edilen ihaleleri getir
    const trackedResult = await query(`
      SELECT DISTINCT t.id, t.external_id, t.url, t.title, t.updated_at
      FROM tender_tracking tt
      JOIN tenders t ON tt.tender_id = t.id
      WHERE tt.status = 'active'
      ORDER BY t.updated_at ASC
      LIMIT 50
    `);

    if (trackedResult.rows.length === 0) {
      return res.json({
        success: true,
        message: 'Takip edilen ihale yok',
        data: { updated: 0, total: 0 },
      });
    }

    const browserManager = (await import('../scraper/browser-manager.js')).default;
    const documentScraper = (await import('../scraper/document-scraper.js')).default;
    const loginService = (await import('../scraper/login-service.js')).default;

    let page = null;
    let updatedCount = 0;
    const errors = [];

    try {
      page = await browserManager.createPage();
      await loginService.ensureLoggedIn(page);

      for (const tender of trackedResult.rows) {
        try {
          const content = await documentScraper.scrapeAllContent(page, tender.url);

          const docCount = content.documentLinks ? Object.keys(content.documentLinks).length : 0;

          await query(
            `
            UPDATE tenders SET
              document_links = COALESCE($2, document_links),
              announcement_content = COALESCE($3, announcement_content),
              goods_services_content = COALESCE($4, goods_services_content),
              zeyilname_content = COALESCE($5, zeyilname_content),
              correction_notice_content = COALESCE($6, correction_notice_content),
              updated_at = NOW()
            WHERE id = $1
          `,
            [
              tender.id,
              docCount > 0 ? JSON.stringify(content.documentLinks) : null,
              content.announcementContent || null,
              content.goodsServicesList ? JSON.stringify(content.goodsServicesList) : null,
              content.zeyilnameContent ? JSON.stringify(content.zeyilnameContent) : null,
              content.correctionNoticeContent ? JSON.stringify(content.correctionNoticeContent) : null,
            ]
          );

          updatedCount++;

          // Rate limiting
          await new Promise((r) => setTimeout(r, 1500));
        } catch (err) {
          errors.push({ tenderId: tender.id, error: err.message });
        }
      }
    } finally {
      if (page) {
        try {
          await page.close();
        } catch (_e) {}
      }
    }

    res.json({
      success: true,
      data: {
        updated: updatedCount,
        total: trackedResult.rows.length,
        errors: errors.length > 0 ? errors : undefined,
      },
      message: `${updatedCount} takip edilen ihale güncellendi`,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
