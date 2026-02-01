/**
 * Daily Audit API Routes
 * Günlük AI denetim sistemi API endpoint'leri
 */

import express from 'express';
import dailyAuditService from '../services/daily-audit.js';
import { query } from '../database.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * POST /api/daily-audit/run
 * Manuel denetim başlat
 */
router.post('/run', async (req, res) => {
  try {
    const { skipAI = false } = req.body || {};
    logger.info('[DailyAudit API] Manuel denetim başlatılıyor...', { skipAI });

    // Çalışan bir denetim var mı kontrol et
    const runningCheck = await query(`
      SELECT id FROM daily_audit_runs 
      WHERE durum = 'running' 
      AND baslangic_zamani > NOW() - INTERVAL '1 hour'
    `);

    if (runningCheck.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Zaten çalışan bir denetim var. Lütfen bekleyin.',
        runningId: runningCheck.rows[0].id,
      });
    }

    // Denetim kaydı oluştur, arka planda çalıştır (istek takılmaz)
    const runResult = await query(`
      INSERT INTO daily_audit_runs (durum) VALUES ('running')
      RETURNING id
    `);
    const runId = runResult.rows[0].id;

    dailyAuditService.runFullAudit({ skipAI, runId }).then((result) => {
      logger.info('[DailyAudit API] Arka plan denetimi tamamlandı', { runId, success: result?.success });
    }).catch((err) => {
      logger.error('[DailyAudit API] Arka plan denetimi hatası', { runId, error: err?.message });
    });

    res.json({
      success: true,
      runId,
      message: 'Denetim arka planda başlatıldı. Durum: GET /api/daily-audit/runs/' + runId,
    });
  } catch (error) {
    logger.error('[DailyAudit API] Denetim başlatma hatası', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/daily-audit/runs
 * Denetim geçmişi
 */
router.get('/runs', async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;

    const result = await query(`
      SELECT * FROM v_audit_dashboard
      LIMIT $1 OFFSET $2
    `, [parseInt(limit, 10), parseInt(offset, 10)]);

    const countResult = await query('SELECT COUNT(*) as total FROM daily_audit_runs');

    res.json({
      success: true,
      data: result.rows,
      total: parseInt(countResult.rows[0]?.total, 10) || 0,
    });
  } catch (error) {
    logger.error('[DailyAudit API] Denetim geçmişi hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/daily-audit/runs/:id
 * Tek denetim detayı
 */
router.get('/runs/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Denetim bilgisi
    const runResult = await query(`
      SELECT * FROM daily_audit_runs WHERE id = $1
    `, [id]);

    if (runResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Denetim bulunamadı' });
    }

    // Bulgular
    const findingsResult = await query(`
      SELECT * FROM daily_audit_findings
      WHERE audit_run_id = $1
      ORDER BY 
        CASE onem_seviyesi 
          WHEN 'kritik' THEN 1 
          WHEN 'orta' THEN 2 
          ELSE 3 
        END,
        kategori,
        created_at DESC
    `, [id]);

    // Düzeltmeler
    const fixesResult = await query(`
      SELECT 
        daf.*,
        u.email as onaylayan_email
      FROM daily_audit_fixes daf
      LEFT JOIN users u ON u.id = daf.onaylayan_kullanici_id
      WHERE daf.finding_id IN (
        SELECT id FROM daily_audit_findings WHERE audit_run_id = $1
      )
      ORDER BY daf.created_at DESC
    `, [id]);

    res.json({
      success: true,
      run: runResult.rows[0],
      findings: findingsResult.rows,
      fixes: fixesResult.rows,
    });
  } catch (error) {
    logger.error('[DailyAudit API] Denetim detay hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/daily-audit/findings
 * Tüm bulgular (filtrelenebilir)
 */
router.get('/findings', async (req, res) => {
  try {
    const {
      kategori,
      onem,
      durum,
      run_id,
      limit = 50,
      offset = 0,
    } = req.query;

    const whereConditions = [];
    const params = [];
    let paramIndex = 1;

    if (kategori) {
      whereConditions.push(`daf.kategori = $${paramIndex++}`);
      params.push(kategori);
    }

    if (onem) {
      whereConditions.push(`daf.onem_seviyesi = $${paramIndex++}`);
      params.push(onem);
    }

    if (durum) {
      whereConditions.push(`daf.durum = $${paramIndex++}`);
      params.push(durum);
    }

    if (run_id) {
      whereConditions.push(`daf.audit_run_id = $${paramIndex++}`);
      params.push(parseInt(run_id, 10));
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    params.push(parseInt(limit, 10), parseInt(offset, 10));

    const result = await query(`
      SELECT 
        daf.*,
        dar.baslangic_zamani as audit_tarihi,
        u.email as isleme_alan_email
      FROM daily_audit_findings daf
      JOIN daily_audit_runs dar ON dar.id = daf.audit_run_id
      LEFT JOIN users u ON u.id = daf.isleme_alan_kullanici_id
      ${whereClause}
      ORDER BY 
        daf.created_at DESC,
        CASE daf.onem_seviyesi 
          WHEN 'kritik' THEN 1 
          WHEN 'orta' THEN 2 
          ELSE 3 
        END
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, params);

    // Sayım
    const countParams = params.slice(0, -2);
    const countResult = await query(`
      SELECT COUNT(*) as total
      FROM daily_audit_findings daf
      ${whereClause}
    `, countParams);

    res.json({
      success: true,
      data: result.rows,
      total: parseInt(countResult.rows[0]?.total, 10) || 0,
    });
  } catch (error) {
    logger.error('[DailyAudit API] Bulgular hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/daily-audit/findings/:id
 * Tek bulgu detayı
 */
router.get('/findings/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(`
      SELECT 
        daf.*,
        dar.baslangic_zamani as audit_tarihi,
        u.email as isleme_alan_email
      FROM daily_audit_findings daf
      JOIN daily_audit_runs dar ON dar.id = daf.audit_run_id
      LEFT JOIN users u ON u.id = daf.isleme_alan_kullanici_id
      WHERE daf.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Bulgu bulunamadı' });
    }

    // Düzeltme geçmişi
    const fixesResult = await query(`
      SELECT 
        dafx.*,
        u.email as onaylayan_email
      FROM daily_audit_fixes dafx
      LEFT JOIN users u ON u.id = dafx.onaylayan_kullanici_id
      WHERE dafx.finding_id = $1
      ORDER BY dafx.created_at DESC
    `, [id]);

    res.json({
      success: true,
      finding: result.rows[0],
      fixes: fixesResult.rows,
    });
  } catch (error) {
    logger.error('[DailyAudit API] Bulgu detay hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/daily-audit/findings/:id/approve
 * Düzeltmeyi onayla
 */
router.post('/findings/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const kullaniciId = req.user?.id || null; // Auth middleware'den

    const result = await dailyAuditService.approveFinding(parseInt(id, 10), kullaniciId);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    logger.error('[DailyAudit API] Onay hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/daily-audit/findings/:id/reject
 * Düzeltmeyi reddet
 */
router.post('/findings/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const { neden } = req.body;
    const kullaniciId = req.user?.id || null;

    const result = await dailyAuditService.rejectFinding(parseInt(id, 10), kullaniciId, neden);

    res.json(result);
  } catch (error) {
    logger.error('[DailyAudit API] Red hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/daily-audit/stats
 * Dashboard istatistikleri
 */
router.get('/stats', async (req, res) => {
  try {
    const { days = 30 } = req.query;

    // Genel istatistikler
    const stats = await dailyAuditService.getStats(parseInt(days, 10));

    // Son denetim
    const latestRun = await dailyAuditService.getLatestRun();

    // Bekleyen onaylar sayısı
    const pendingResult = await query(`
      SELECT COUNT(*) as sayi FROM daily_audit_findings
      WHERE durum = 'beklemede'
    `);

    // Kategori dağılımı (son 30 gün)
    const kategoriResult = await query(`
      SELECT 
        kategori,
        COUNT(*) as sayi,
        COUNT(CASE WHEN onem_seviyesi = 'kritik' THEN 1 END) as kritik
      FROM daily_audit_findings
      WHERE created_at >= NOW() - ($1 || ' days')::INTERVAL
      GROUP BY kategori
    `, [days]);

    // Son 7 günlük trend
    const trendResult = await query(`
      SELECT 
        DATE(baslangic_zamani) as tarih,
        SUM(toplam_sorun) as sorun_sayisi,
        SUM(otomatik_duzeltilen) as otomatik,
        SUM(onay_bekleyen) as bekleyen
      FROM daily_audit_runs
      WHERE durum = 'completed'
        AND baslangic_zamani >= NOW() - INTERVAL '7 days'
      GROUP BY DATE(baslangic_zamani)
      ORDER BY tarih
    `);

    res.json({
      success: true,
      stats,
      latestRun,
      pendingCount: parseInt(pendingResult.rows[0]?.sayi, 10) || 0,
      kategoriDagilimi: kategoriResult.rows,
      trend: trendResult.rows,
    });
  } catch (error) {
    logger.error('[DailyAudit API] İstatistik hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/daily-audit/pending
 * Bekleyen onaylar listesi
 */
router.get('/pending', async (req, res) => {
  try {
    const { limit = 50 } = req.query;

    const result = await dailyAuditService.getPendingApprovals(parseInt(limit, 10));

    res.json({
      success: true,
      data: result,
      total: result.length,
    });
  } catch (error) {
    logger.error('[DailyAudit API] Bekleyen onaylar hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/daily-audit/config
 * Yapılandırma değerlerini getir
 */
router.get('/config', async (req, res) => {
  try {
    const result = await query('SELECT config_key, config_value, aciklama FROM daily_audit_config');

    const config = {};
    result.rows.forEach((row) => {
      config[row.config_key] = {
        value: JSON.parse(row.config_value),
        aciklama: row.aciklama,
      };
    });

    res.json({ success: true, config });
  } catch (error) {
    logger.error('[DailyAudit API] Config hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/daily-audit/config/:key
 * Yapılandırma değerini güncelle
 */
router.put('/config/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    await query(`
      UPDATE daily_audit_config 
      SET config_value = $1, updated_at = NOW()
      WHERE config_key = $2
    `, [JSON.stringify(value), key]);

    res.json({ success: true, message: 'Yapılandırma güncellendi' });
  } catch (error) {
    logger.error('[DailyAudit API] Config güncelleme hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
