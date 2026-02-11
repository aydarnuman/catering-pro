/**
 * Reports Route - Merkezi Rapor API
 * Tüm modüller için tek endpoint üzerinden rapor üretimi, önizleme, toplu indirme ve mail.
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { createBulkZip, sendMail } from '../services/export-service.js';
import reportRegistry from '../services/report-registry.js';
import logger from '../utils/logger.js';

const router = Router();

// Tüm endpoint'ler auth gerektirir
router.use(authenticate);

/**
 * GET /catalog - Tüm rapor kataloğu (modül gruplu)
 * GET /catalog/:module - Tek modül raporları
 */
router.get('/catalog/:module?', (req, res) => {
  try {
    const { module } = req.params;
    const catalog = reportRegistry.getCatalog(module || null);
    res.json({ success: true, data: catalog });
  } catch (error) {
    logger.error('[Reports] Catalog error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /generate - Tek rapor üret ve indir
 * Body: { reportId, format, context }
 */
router.post('/generate', async (req, res) => {
  try {
    const { reportId, format = 'pdf', context = {} } = req.body;

    if (!reportId) {
      return res.status(400).json({ success: false, error: 'reportId gerekli' });
    }

    const result = await reportRegistry.generateReport(reportId, format, {
      ...context,
      userId: req.user?.id,
    });

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(result.filename)}"`);
    res.send(result.buffer);
  } catch (error) {
    logger.error('[Reports] Generate error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /preview - Rapor önizleme
 * Body: { reportId, format, context }
 * PDF için blob döner, Excel için JSON tablo döner
 */
router.post('/preview', async (req, res) => {
  try {
    const { reportId, format = 'pdf', context = {} } = req.body;

    if (!reportId) {
      return res.status(400).json({ success: false, error: 'reportId gerekli' });
    }

    const result = await reportRegistry.previewReport(reportId, format, {
      ...context,
      userId: req.user?.id,
    });

    if (result.type === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.send(result.data);
    } else {
      // JSON tablo verisi
      res.json({ success: true, data: result.data });
    }
  } catch (error) {
    logger.error('[Reports] Preview error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /bulk - Seçilen raporları ZIP olarak indir
 * Body: { reports: [{ reportId, format, context }] }
 */
router.post('/bulk', async (req, res) => {
  try {
    const { reports = [] } = req.body;

    if (!reports.length) {
      return res.status(400).json({ success: false, error: 'En az bir rapor seçin' });
    }

    if (reports.length > 20) {
      return res.status(400).json({ success: false, error: 'Tek seferde en fazla 20 rapor indirilebilir' });
    }

    const files = [];
    const errors = [];

    for (const report of reports) {
      try {
        const result = await reportRegistry.generateReport(
          report.reportId,
          report.format || 'pdf',
          { ...report.context, userId: req.user?.id }
        );
        files.push({
          buffer: result.buffer,
          filename: result.filename,
        });
      } catch (err) {
        errors.push({ reportId: report.reportId, error: err.message });
      }
    }

    if (files.length === 0) {
      return res.status(500).json({ success: false, error: 'Hiçbir rapor üretilemedi', details: errors });
    }

    const zipBuffer = await createBulkZip(files);
    const timestamp = new Date().toISOString().split('T')[0];

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="raporlar-${timestamp}.zip"`);

    if (errors.length > 0) {
      res.setHeader('X-Report-Errors', JSON.stringify(errors));
    }

    res.send(zipBuffer);
  } catch (error) {
    logger.error('[Reports] Bulk error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /mail - Seçilen raporları mail ile gönder
 * Body: { reports: [{ reportId, format, context }], email, subject? }
 */
router.post('/mail', async (req, res) => {
  try {
    const { reports = [], email, subject } = req.body;

    if (!email || !email.includes('@')) {
      return res.status(400).json({ success: false, error: 'Geçerli e-posta adresi gerekli' });
    }

    if (!reports.length) {
      return res.status(400).json({ success: false, error: 'En az bir rapor seçin' });
    }

    // Tek rapor ise direkt ek olarak gönder
    if (reports.length === 1) {
      const result = await reportRegistry.generateReport(
        reports[0].reportId,
        reports[0].format || 'pdf',
        { ...reports[0].context, userId: req.user?.id }
      );

      await sendMail({
        to: email,
        subject: subject || `Rapor: ${result.filename}`,
        text: `İstediğiniz rapor ekte gönderilmiştir.\n\nRapor: ${result.filename}\nOluşturulma: ${new Date().toLocaleDateString('tr-TR')}`,
        attachmentName: result.filename,
        attachmentType: result.contentType,
      }, result.buffer);

      return res.json({ success: true, message: 'Rapor mail olarak gönderildi' });
    }

    // Birden fazla rapor - ZIP olarak gönder
    const files = [];
    for (const report of reports) {
      try {
        const result = await reportRegistry.generateReport(
          report.reportId,
          report.format || 'pdf',
          { ...report.context, userId: req.user?.id }
        );
        files.push({ buffer: result.buffer, filename: result.filename });
      } catch (_err) { /* skip failed */ }
    }

    if (files.length === 0) {
      return res.status(500).json({ success: false, error: 'Rapor üretilemedi' });
    }

    const zipBuffer = await createBulkZip(files);
    const timestamp = new Date().toISOString().split('T')[0];

    await sendMail({
      to: email,
      subject: subject || `Raporlar - ${timestamp}`,
      text: `İstediğiniz ${files.length} adet rapor ekte gönderilmiştir.\n\nOluşturulma: ${new Date().toLocaleDateString('tr-TR')}`,
      attachmentName: `raporlar-${timestamp}.zip`,
      attachmentType: 'application/zip',
    }, zipBuffer);

    res.json({ success: true, message: `${files.length} rapor mail olarak gönderildi` });
  } catch (error) {
    logger.error('[Reports] Mail error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
