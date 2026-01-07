/**
 * Mükerrer Fatura Kontrol API'si
 */

import express from 'express';
import duplicateDetector from '../services/duplicate-detector.js';
import { query } from '../database.js';

const router = express.Router();

/**
 * POST /api/duplicates/check
 * Tek fatura için mükerrer kontrolü
 */
router.post('/check', async (req, res) => {
  try {
    const { invoice } = req.body;
    
    if (!invoice || !invoice.sender_vkn || !invoice.payable_amount) {
      return res.status(400).json({
        success: false,
        error: 'Eksik fatura bilgisi'
      });
    }

    const result = await duplicateDetector.checkForDuplicates(invoice);
    
    // Yüksek riskli mükerrer varsa uyarı
    if (result.highRisk && result.highRisk.length > 0) {
      console.log(`⚠️ MÜKERRER TESPİT: ${invoice.invoice_no} - ${result.highRisk.length} adet yüksek risk`);
    }

    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('Mükerrer kontrol hatası:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/duplicates/check-batch
 * Toplu mükerrer kontrolü
 */
router.post('/check-batch', async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'Tarih aralığı gerekli'
      });
    }

    console.log(`📊 Toplu mükerrer kontrolü: ${startDate} - ${endDate}`);
    
    const report = await duplicateDetector.batchCheck(startDate, endDate);
    
    // İstatistikleri kaydet
    await query(`
      INSERT INTO duplicate_detection_stats (
        run_date, total_invoices, duplicates_found,
        high_confidence, potential_savings
      ) VALUES (
        CURRENT_DATE, $1, $2, $3, $4
      )
    `, [
      report.totalInvoices,
      report.totalDuplicates,
      report.duplicateGroups.length,
      report.savedAmount
    ]);

    res.json({
      success: true,
      report,
      message: `${report.totalDuplicates} mükerrer tespit edildi. Potansiyel tasarruf: ${report.savedAmount.toFixed(2)} TL`
    });

  } catch (error) {
    console.error('Toplu kontrol hatası:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/duplicates/list
 * Mükerrer faturaları listele
 */
router.get('/list', async (req, res) => {
  try {
    const { status = 'pending_review', limit = 50 } = req.query;
    
    const result = await query(`
      SELECT 
        d.*,
        o.invoice_no as original_invoice_no,
        o.invoice_date as original_date,
        o.sender_name as vendor_name,
        o.payable_amount as original_amount,
        dup.invoice_no as duplicate_invoice_no,
        dup.invoice_date as duplicate_date,
        dup.payable_amount as duplicate_amount
      FROM invoice_duplicates d
      JOIN uyumsoft_invoices o ON d.original_invoice_id = o.id
      JOIN uyumsoft_invoices dup ON d.duplicate_invoice_id = dup.id
      WHERE d.status = $1
      ORDER BY d.confidence DESC, d.detected_at DESC
      LIMIT $2
    `, [status, limit]);

    res.json({
      success: true,
      duplicates: result.rows,
      count: result.rows.length
    });

  } catch (error) {
    console.error('Liste hatası:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/duplicates/mark
 * Mükerrer olarak işaretle
 */
router.post('/mark', async (req, res) => {
  try {
    const { originalId, duplicateId, confidence } = req.body;
    
    const success = await duplicateDetector.markAsDuplicate(
      originalId, 
      duplicateId, 
      confidence
    );

    if (success) {
      res.json({
        success: true,
        message: 'Fatura mükerrer olarak işaretlendi'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'İşaretleme başarısız'
      });
    }

  } catch (error) {
    console.error('İşaretleme hatası:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/duplicates/:id/review
 * Mükerrer inceleme sonucunu kaydet
 */
router.put('/:id/review', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes, reviewedBy } = req.body;
    
    if (!['confirmed', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Geçersiz durum. confirmed veya rejected olmalı'
      });
    }

    // İnceleme sonucunu kaydet
    const result = await query(`
      UPDATE invoice_duplicates
      SET 
        status = $1,
        notes = $2,
        reviewed_by = $3,
        reviewed_at = NOW()
      WHERE id = $4
      RETURNING *
    `, [status, notes, reviewedBy || 'user', id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Kayıt bulunamadı'
      });
    }

    // Eğer onaylandıysa, duplicate faturayı reddet
    if (status === 'confirmed') {
      await query(`
        UPDATE uyumsoft_invoices
        SET 
          is_duplicate = true,
          is_rejected = true,
          rejection_reason = $1
        WHERE id = $2
      `, [
        `Mükerrer fatura - ${notes || 'İnceleme sonucu reddedildi'}`,
        result.rows[0].duplicate_invoice_id
      ]);
    }

    res.json({
      success: true,
      duplicate: result.rows[0],
      message: status === 'confirmed' 
        ? 'Mükerrer onaylandı ve fatura reddedildi' 
        : 'Mükerrer değil olarak işaretlendi'
    });

  } catch (error) {
    console.error('İnceleme hatası:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/duplicates/savings
 * Potansiyel tasarruf raporu
 */
router.get('/savings', async (req, res) => {
  try {
    const report = await duplicateDetector.getSavingsReport();
    
    // Aylık trend
    const monthlyTrend = await query(`
      SELECT 
        DATE_TRUNC('month', detected_at) as month,
        COUNT(*) as duplicate_count,
        SUM(amount_diff) as saved_amount
      FROM invoice_duplicates
      WHERE status IN ('confirmed', 'auto_rejected')
      GROUP BY DATE_TRUNC('month', detected_at)
      ORDER BY month DESC
      LIMIT 12
    `);

    // En çok mükerrer olan firmalar
    const topVendors = await query(`
      SELECT 
        u.sender_name,
        u.sender_vkn,
        COUNT(DISTINCT d.id) as duplicate_count,
        SUM(u.payable_amount) as total_duplicate_amount
      FROM invoice_duplicates d
      JOIN uyumsoft_invoices u ON d.duplicate_invoice_id = u.id
      WHERE d.status IN ('confirmed', 'auto_rejected')
      GROUP BY u.sender_name, u.sender_vkn
      ORDER BY duplicate_count DESC
      LIMIT 10
    `);

    res.json({
      success: true,
      summary: report,
      monthlyTrend: monthlyTrend.rows,
      topVendors: topVendors.rows
    });

  } catch (error) {
    console.error('Tasarruf raporu hatası:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/duplicates/auto-clean
 * Otomatik temizlik (yüksek güvenli mükerrerleri reddet)
 */
router.post('/auto-clean', async (req, res) => {
  try {
    const { confidenceThreshold = 95 } = req.body;
    
    // Yüksek güvenli mükerrerleri otomatik reddet
    const result = await query(`
      UPDATE invoice_duplicates
      SET 
        status = 'auto_rejected',
        reviewed_at = NOW(),
        reviewed_by = 'SYSTEM',
        notes = 'Otomatik temizlik - Yüksek güven skoru'
      WHERE status = 'pending_review'
        AND confidence >= $1
        AND amount_diff_percent < 1
      RETURNING *
    `, [confidenceThreshold]);

    // İlgili faturaları reddet
    if (result.rows.length > 0) {
      const duplicateIds = result.rows.map(r => r.duplicate_invoice_id);
      
      await query(`
        UPDATE uyumsoft_invoices
        SET 
          is_duplicate = true,
          is_rejected = true,
          rejection_reason = 'Mükerrer - Otomatik temizlik'
        WHERE id = ANY($1)
      `, [duplicateIds]);
    }

    res.json({
      success: true,
      cleanedCount: result.rows.length,
      message: `${result.rows.length} mükerrer fatura otomatik olarak temizlendi`
    });

  } catch (error) {
    console.error('Otomatik temizlik hatası:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
