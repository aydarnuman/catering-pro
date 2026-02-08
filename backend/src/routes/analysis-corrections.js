import express from 'express';
import { query, transaction } from '../database.js';
import { authenticate } from '../middleware/auth.js';
import { syncCorrectionToBlob, syncPendingCorrections, getCorrectionStats } from '../services/correction-blob-sync.js';
import { checkRetrainThreshold, triggerManualTraining, getModelVersionInfo } from '../services/auto-retrain.js';
import { listCustomModels, getModelDetails, checkHealth as azureHealthCheck } from '../services/ai-analyzer/providers/azure-document-ai.js';
import logger from '../utils/logger.js';

const router = express.Router();

// ═══════════════════════════════════════════════════════════════
// GET /api/analysis-corrections/:tenderId
// Bir ihale için tüm düzeltmeleri getir
// ═══════════════════════════════════════════════════════════════
router.get('/:tenderId', authenticate, async (req, res) => {
  try {
    const { tenderId } = req.params;

    const result = await query(
      `SELECT ac.*, d.original_filename as document_name
       FROM analysis_corrections ac
       LEFT JOIN documents d ON d.id = ac.document_id
       WHERE ac.tender_id = $1
       ORDER BY ac.created_at DESC`,
      [tenderId]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Düzeltmeler getirilemedi', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// GET /api/analysis-corrections/stats/summary
// Eğitim için bekleyen düzeltme istatistikleri
// ═══════════════════════════════════════════════════════════════
router.get('/stats/summary', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT
         COUNT(*) as total_corrections,
         COUNT(*) FILTER (WHERE used_in_training = false) as pending_training,
         COUNT(*) FILTER (WHERE blob_synced = false) as pending_sync,
         COUNT(DISTINCT tender_id) as affected_tenders,
         COUNT(DISTINCT document_id) as affected_documents,
         MAX(created_at) as last_correction_at
       FROM analysis_corrections`
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error('Düzeltme istatistikleri alınamadı', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// POST /api/analysis-corrections
// Yeni düzeltme kaydet + analysis_result JSONB güncelle
// ═══════════════════════════════════════════════════════════════
router.post('/', authenticate, async (req, res) => {
  try {
    const { tender_id, document_id, field_path, old_value, new_value, correction_type = 'edit' } = req.body;

    if (!tender_id || !field_path) {
      return res.status(400).json({
        success: false,
        error: 'tender_id ve field_path zorunludur',
      });
    }

    const correctedBy = req.user?.username || req.user?.email || 'unknown';

    await transaction(async (client) => {
      // 1. Düzeltmeyi kaydet
      const insertResult = await client.query(
        `INSERT INTO analysis_corrections
           (tender_id, document_id, field_path, old_value, new_value, correction_type, corrected_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          tender_id,
          document_id || null,
          field_path,
          JSON.stringify(old_value),
          JSON.stringify(new_value),
          correction_type,
          correctedBy,
        ]
      );

      // 2. Eğer document_id varsa, documents.analysis_result'u güncelle (JSONB patch)
      if (document_id && correction_type !== 'confirm') {
        // field_path formatı: "servis_saatleri.kahvalti" veya "teknik_sartlar"
        // JSONB set yolu: analysis_result->'field_path' kısmını güncelle
        const pathParts = field_path.split('.');

        await client.query(
          `UPDATE documents
           SET analysis_result = jsonb_set(
             COALESCE(analysis_result, '{}'::jsonb),
             $1::text[],
             $2::jsonb,
             true
           ),
           updated_at = NOW()
           WHERE id = $3`,
          [pathParts, JSON.stringify(new_value), document_id]
        );
      }

      // 3. Ayrıca tender_tracking.analysis_summary'yi de güncelle (varsa)
      if (correction_type !== 'confirm') {
        const pathParts = field_path.split('.');
        await client.query(
          `UPDATE tender_tracking
           SET analysis_summary = jsonb_set(
             COALESCE(analysis_summary, '{}'::jsonb),
             $1::text[],
             $2::jsonb,
             true
           ),
           updated_at = NOW()
           WHERE tender_id = $3`,
          [pathParts, JSON.stringify(new_value), tender_id]
        );
      }

      const savedCorrection = insertResult.rows[0];

      res.json({
        success: true,
        data: savedCorrection,
        message: 'Düzeltme kaydedildi',
      });

      // Background: Blob sync (fire-and-forget)
      if (correction_type !== 'confirm') {
        syncCorrectionToBlob(savedCorrection.id).catch((err) => {
          logger.warn('Background blob sync başarısız', { id: savedCorrection.id, error: err.message });
        });
      }
    });
  } catch (error) {
    logger.error('Düzeltme kaydedilemedi', { error: error.message, body: req.body });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// POST /api/analysis-corrections/batch
// Toplu düzeltme kaydet (birden fazla alan düzeltilmişse)
// ═══════════════════════════════════════════════════════════════
router.post('/batch', authenticate, async (req, res) => {
  try {
    const { tender_id, document_id, corrections } = req.body;

    if (!tender_id || !corrections || !Array.isArray(corrections) || corrections.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'tender_id ve corrections dizisi zorunludur',
      });
    }

    const correctedBy = req.user?.username || req.user?.email || 'unknown';

    await transaction(async (client) => {
      const results = [];

      for (const correction of corrections) {
        const { field_path, old_value, new_value, correction_type = 'edit' } = correction;

        const insertResult = await client.query(
          `INSERT INTO analysis_corrections
             (tender_id, document_id, field_path, old_value, new_value, correction_type, corrected_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [
            tender_id,
            document_id || null,
            field_path,
            JSON.stringify(old_value),
            JSON.stringify(new_value),
            correction_type,
            correctedBy,
          ]
        );

        results.push(insertResult.rows[0]);

        // JSONB güncelleme
        if (correction_type !== 'confirm') {
          const pathParts = field_path.split('.');

          if (document_id) {
            await client.query(
              `UPDATE documents
               SET analysis_result = jsonb_set(
                 COALESCE(analysis_result, '{}'::jsonb),
                 $1::text[],
                 $2::jsonb,
                 true
               ),
               updated_at = NOW()
               WHERE id = $3`,
              [pathParts, JSON.stringify(new_value), document_id]
            );
          }

          await client.query(
            `UPDATE tender_tracking
             SET analysis_summary = jsonb_set(
               COALESCE(analysis_summary, '{}'::jsonb),
               $1::text[],
               $2::jsonb,
               true
             ),
             updated_at = NOW()
             WHERE tender_id = $3`,
            [pathParts, JSON.stringify(new_value), tender_id]
          );
        }
      }

      res.json({
        success: true,
        data: results,
        count: results.length,
        message: `${results.length} düzeltme kaydedildi`,
      });
    });
  } catch (error) {
    logger.error('Toplu düzeltme kaydedilemedi', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// POST /api/analysis-corrections/confirm
// Tüm analiz sonuçlarını doğru olarak onayla
// ═══════════════════════════════════════════════════════════════
router.post('/confirm', authenticate, async (req, res) => {
  try {
    const { tender_id, document_id } = req.body;

    if (!tender_id) {
      return res.status(400).json({ success: false, error: 'tender_id zorunludur' });
    }

    const correctedBy = req.user?.username || req.user?.email || 'unknown';

    const result = await query(
      `INSERT INTO analysis_corrections
         (tender_id, document_id, field_path, correction_type, corrected_by, new_value)
       VALUES ($1, $2, 'all', 'confirm', $3, '"confirmed"'::jsonb)
       RETURNING *`,
      [tender_id, document_id || null, correctedBy]
    );

    // tender_tracking'de onay flag'ini set et
    await query(
      `UPDATE tender_tracking
       SET analysis_summary = jsonb_set(
         COALESCE(analysis_summary, '{}'::jsonb),
         '{analysis_confirmed}',
         'true'::jsonb,
         true
       ),
       updated_at = NOW()
       WHERE tender_id = $1`,
      [tender_id]
    );

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Analiz onaylandı',
    });
  } catch (error) {
    logger.error('Analiz onaylanamadı', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// DELETE /api/analysis-corrections/:id
// Bir düzeltmeyi geri al
// ═══════════════════════════════════════════════════════════════
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // Önce düzeltmeyi al (geri almak için old_value lazım)
    const existing = await query('SELECT * FROM analysis_corrections WHERE id = $1', [id]);

    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Düzeltme bulunamadı' });
    }

    const correction = existing.rows[0];

    await transaction(async (client) => {
      // Düzeltmeyi sil
      await client.query('DELETE FROM analysis_corrections WHERE id = $1', [id]);

      // Eğer eski değer varsa geri yükle
      if (correction.old_value && correction.document_id) {
        const pathParts = correction.field_path.split('.');
        await client.query(
          `UPDATE documents
           SET analysis_result = jsonb_set(
             COALESCE(analysis_result, '{}'::jsonb),
             $1::text[],
             $2::jsonb,
             true
           ),
           updated_at = NOW()
           WHERE id = $3`,
          [pathParts, JSON.stringify(correction.old_value), correction.document_id]
        );
      }

      if (correction.old_value) {
        const pathParts = correction.field_path.split('.');
        await client.query(
          `UPDATE tender_tracking
           SET analysis_summary = jsonb_set(
             COALESCE(analysis_summary, '{}'::jsonb),
             $1::text[],
             $2::jsonb,
             true
           ),
           updated_at = NOW()
           WHERE tender_id = $3`,
          [pathParts, JSON.stringify(correction.old_value), correction.tender_id]
        );
      }
    });

    res.json({ success: true, message: 'Düzeltme geri alındı' });
  } catch (error) {
    logger.error('Düzeltme geri alınamadı', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// POST /api/analysis-corrections/sync
// Bekleyen düzeltmeleri Azure Blob'a sync et
// ═══════════════════════════════════════════════════════════════
router.post('/sync', authenticate, async (req, res) => {
  try {
    const result = await syncPendingCorrections();
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Blob sync hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// GET /api/analysis-corrections/stats/training
// Eğitim pipeline'ı için düzeltme istatistikleri
// ═══════════════════════════════════════════════════════════════
router.get('/stats/training', authenticate, async (req, res) => {
  try {
    const stats = await getCorrectionStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    logger.error('Eğitim istatistikleri alınamadı', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// GET /api/analysis-corrections/retrain/status
// Eğitim durumunu kontrol et: eşik, bekleyen düzeltmeler, model bilgisi
// ═══════════════════════════════════════════════════════════════
router.get('/retrain/status', authenticate, async (req, res) => {
  try {
    const [threshold, modelInfo] = await Promise.all([
      checkRetrainThreshold(),
      getModelVersionInfo(),
    ]);

    res.json({
      success: true,
      data: {
        ...threshold,
        model: modelInfo,
      },
    });
  } catch (error) {
    logger.error('Retrain durum kontrolü hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// POST /api/analysis-corrections/retrain/trigger
// Manuel eğitim tetikle (admin only)
// build-dataset.mjs --train-only child process olarak çalışır
// Düzeltmeler YALNIZCA başarılı eğitim sonrası işaretlenir
// ═══════════════════════════════════════════════════════════════
router.post('/retrain/trigger', authenticate, async (req, res) => {
  try {
    // Opsiyonel: custom model ID
    const { modelId } = req.body || {};
    const result = await triggerManualTraining({ modelId });

    if (result.success) {
      res.json({ success: true, data: result });
    } else {
      res.status(result.error?.includes('zaten devam') ? 409 : 400).json({
        success: false,
        error: result.error,
        data: result,
      });
    }
  } catch (error) {
    logger.error('Retrain tetikleme hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// GET /api/analysis-corrections/azure/models
// Azure'daki tüm custom modelleri listele
// ═══════════════════════════════════════════════════════════════
router.get('/azure/models', authenticate, async (_req, res) => {
  try {
    const result = await listCustomModels();
    res.json({ success: result.success, data: result });
  } catch (error) {
    logger.error('Azure model listesi alınamadı', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// GET /api/analysis-corrections/azure/models/:modelId
// Belirli bir modelin detayı (accuracy, field'lar, eğitim bilgisi)
// ═══════════════════════════════════════════════════════════════
router.get('/azure/models/:modelId', authenticate, async (req, res) => {
  try {
    const result = await getModelDetails(req.params.modelId);
    res.json({ success: result.success, data: result });
  } catch (error) {
    logger.error('Azure model detayı alınamadı', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// GET /api/analysis-corrections/azure/health
// Azure Document Intelligence sağlık durumu
// ═══════════════════════════════════════════════════════════════
router.get('/azure/health', authenticate, async (_req, res) => {
  try {
    const result = await azureHealthCheck();
    res.json({ success: result.healthy, data: result });
  } catch (error) {
    logger.error('Azure health check hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
