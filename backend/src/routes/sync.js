/**
 * Senkronizasyon API Endpoint'leri
 * Manuel ve otomatik senkronizasyon kontrolü
 */

import express from 'express';
import { query } from '../database.js';
import scheduler from '../services/sync-scheduler.js';

const router = express.Router();

/**
 * Scheduler durumunu getir
 */
router.get('/status', (_req, res) => {
  try {
    const status = scheduler.getStatus();
    res.json({
      success: true,
      ...status,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Manuel senkronizasyon tetikle
 */
router.post('/manual', async (req, res) => {
  try {
    const { months = 3, maxInvoices = 500, category = null } = req.body;

    const result = await scheduler.triggerManualSync({
      months,
      maxInvoices,
      category,
    });

    res.json({
      success: result.success,
      message: result.success ? 'Senkronizasyon tamamlandı' : 'Senkronizasyon başarısız',
      stats: result.stats,
      error: result.error,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Tarih aralığına göre senkronizasyon
 */
router.post('/date-range', async (req, res) => {
  try {
    const { startDate, endDate, maxInvoices = 500 } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'startDate ve endDate zorunludur',
      });
    }

    const result = await scheduler.triggerManualSync({
      startDate,
      endDate,
      maxInvoices,
      syncType: 'date_range',
    });

    res.json({
      success: result.success,
      message: result.success ? 'Tarih aralığı senkronizasyonu tamamlandı' : 'Senkronizasyon başarısız',
      stats: result.stats,
      dateRange: { startDate, endDate },
      error: result.error,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Kategori bazlı senkronizasyon
 */
router.post('/category', async (req, res) => {
  try {
    const { category, months = 3 } = req.body;

    if (!category) {
      return res.status(400).json({
        success: false,
        error: 'Kategori belirtilmelidir',
      });
    }

    // Bu özellik backend'de implemente edilecek
    // Şimdilik tüm faturaları çekip kategori filtrelemesi yapılabilir
    const result = await scheduler.triggerManualSync({
      months,
      category,
      syncType: 'category',
    });

    res.json({
      success: result.success,
      message: `${category} kategorisi senkronizasyonu tamamlandı`,
      stats: result.stats,
      category,
      error: result.error,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Tedarikçi bazlı senkronizasyon
 */
router.post('/vendor', async (req, res) => {
  try {
    const { vendorVkn, vendorName, months = 3 } = req.body;

    if (!vendorVkn && !vendorName) {
      return res.status(400).json({
        success: false,
        error: 'VKN veya tedarikçi adı belirtilmelidir',
      });
    }

    const result = await scheduler.triggerManualSync({
      months,
      vendorVkn,
      vendorName,
      syncType: 'vendor',
    });

    res.json({
      success: result.success,
      message: `${vendorName || vendorVkn} tedarikçisi senkronizasyonu tamamlandı`,
      stats: result.stats,
      vendor: { vkn: vendorVkn, name: vendorName },
      error: result.error,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Duplicate temizleme
 */
router.post('/cleanup-duplicates', async (_req, res) => {
  try {
    // Duplicate ETTN'leri bul
    const duplicates = await query(`
      SELECT 
        ettn, 
        COUNT(*) as count,
        ARRAY_AGG(id ORDER BY created_at DESC) as ids
      FROM uyumsoft_invoices
      GROUP BY ettn
      HAVING COUNT(*) > 1
    `);

    let deletedCount = 0;

    for (const row of duplicates.rows) {
      // İlk kayıt hariç diğerlerini sil
      const idsToDelete = row.ids.slice(1);
      if (idsToDelete.length > 0) {
        await query('DELETE FROM uyumsoft_invoices WHERE id = ANY($1)', [idsToDelete]);
        deletedCount += idsToDelete.length;
      }
    }

    res.json({
      success: true,
      message: `${deletedCount} duplicate kayıt temizlendi`,
      stats: {
        totalDuplicates: duplicates.rows.length,
        deletedRecords: deletedCount,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Sync loglarını getir
 */
router.get('/logs', async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const logs = await scheduler.getSyncLogs(parseInt(limit, 10));

    res.json({
      success: true,
      logs,
      total: logs.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Sync ayarlarını getir
 */
router.get('/settings', async (_req, res) => {
  try {
    const settings = await query('SELECT * FROM sync_settings ORDER BY setting_key');

    const settingsObject = {};
    settings.rows.forEach((row) => {
      settingsObject[row.setting_key] = {
        value: row.setting_value,
        description: row.description,
      };
    });

    res.json({
      success: true,
      settings: settingsObject,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Sync ayarlarını güncelle
 */
router.put('/settings', async (req, res) => {
  try {
    const { key, value } = req.body;

    if (!key || value === undefined) {
      return res.status(400).json({
        success: false,
        error: 'key ve value zorunludur',
      });
    }

    await query(
      `
      UPDATE sync_settings 
      SET setting_value = $1, updated_at = NOW()
      WHERE setting_key = $2
    `,
      [JSON.stringify(value), key]
    );

    res.json({
      success: true,
      message: 'Ayar güncellendi',
      setting: { key, value },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Scheduler'ı başlat
 */
router.post('/start', (_req, res) => {
  try {
    scheduler.start();
    res.json({
      success: true,
      message: 'Scheduler başlatıldı',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Scheduler'ı durdur
 */
router.post('/stop', (_req, res) => {
  try {
    scheduler.stop();
    res.json({
      success: true,
      message: 'Scheduler durduruldu',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Haftalık rapor oluştur (manuel)
 */
router.post('/generate-report', async (_req, res) => {
  try {
    const report = await scheduler.generateWeeklyReport();

    res.json({
      success: true,
      message: 'Haftalık rapor oluşturuldu',
      report,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
