/**
 * Mail API Routes
 * E-posta gönderimi ve hatırlatma yönetimi
 */

import express from 'express';
import { query } from '../database.js';
import {
  checkSertifikaHatirlatma,
  checkSozlesmeBitisHatirlatma,
  checkTeminatIadeHatirlatma,
  MAIL_TEMPLATES,
  runAllReminders,
  sendBulkMail,
  sendMail,
} from '../services/mail-service.js';
import { logAPI, logError } from '../utils/logger.js';

const router = express.Router();

// =====================================================
// MAIL GÖNDERME
// =====================================================

/**
 * POST /api/mail/send
 * Tek mail gönder
 */
router.post('/send', async (req, res) => {
  try {
    const { to, subject, html, text, template, data } = req.body;

    if (!to) {
      return res.status(400).json({ success: false, error: 'Alıcı (to) zorunludur' });
    }

    if (!template && !subject) {
      return res.status(400).json({ success: false, error: 'Konu (subject) veya şablon (template) zorunludur' });
    }

    const result = await sendMail({ to, subject, html, text, template, data });

    res.json(result);
  } catch (error) {
    logError('Mail Gönder', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/mail/send-bulk
 * Toplu mail gönder
 */
router.post('/send-bulk', async (req, res) => {
  try {
    const { recipients, subject, html, template, data } = req.body;

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ success: false, error: 'En az bir alıcı zorunludur' });
    }

    const results = await sendBulkMail(recipients, { subject, html, template, data });

    const basarili = results.filter((r) => r.success).length;
    const hatali = results.filter((r) => !r.success).length;

    res.json({
      success: true,
      toplam: recipients.length,
      basarili,
      hatali,
      detay: results,
    });
  } catch (error) {
    logError('Toplu Mail Gönder', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// ŞABLONLAR
// =====================================================

/**
 * GET /api/mail/templates
 * Mevcut şablonları listele
 */
router.get('/templates', async (_req, res) => {
  try {
    const templates = Object.entries(MAIL_TEMPLATES).map(([key, value]) => ({
      id: key,
      subject: value.subject,
      preview: value.html.substring(0, 200) + '...',
    }));

    res.json({ success: true, data: templates });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/mail/templates/:id
 * Tek şablon detayı
 */
router.get('/templates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const template = MAIL_TEMPLATES[id];

    if (!template) {
      return res.status(404).json({ success: false, error: 'Şablon bulunamadı' });
    }

    res.json({ success: true, data: { id, ...template } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/mail/templates/:id/preview
 * Şablon önizleme (verilerle doldurulmuş)
 */
router.post('/templates/:id/preview', async (req, res) => {
  try {
    const { id } = req.params;
    const { data } = req.body;
    const template = MAIL_TEMPLATES[id];

    if (!template) {
      return res.status(404).json({ success: false, error: 'Şablon bulunamadı' });
    }

    // Değişkenleri doldur
    let subject = template.subject;
    let html = template.html;

    if (data) {
      for (const [key, value] of Object.entries(data)) {
        const regex = new RegExp(`{{${key}}}`, 'g');
        subject = subject.replace(regex, value || '');
        html = html.replace(regex, value || '');
      }
    }

    res.json({ success: true, subject, html });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// HATIRLATMALAR
// =====================================================

/**
 * POST /api/mail/reminders/run
 * Tüm hatırlatmaları çalıştır
 */
router.post('/reminders/run', async (_req, res) => {
  try {
    const results = await runAllReminders();

    logAPI('Hatırlatmalar Çalıştırıldı', {
      sozlesme: results.sozlesme?.length || 0,
      teminat: results.teminat?.length || 0,
      sertifika: results.sertifika?.length || 0,
    });

    res.json({ success: true, data: results });
  } catch (error) {
    logError('Hatırlatmalar', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/mail/reminders/sozlesme
 * Sözleşme bitiş hatırlatmaları
 */
router.post('/reminders/sozlesme', async (req, res) => {
  try {
    const { gun_once = 30 } = req.body;
    const results = await checkSozlesmeBitisHatirlatma(gun_once);
    res.json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/mail/reminders/teminat
 * Teminat iade hatırlatmaları
 */
router.post('/reminders/teminat', async (req, res) => {
  try {
    const { gun_once = 30 } = req.body;
    const results = await checkTeminatIadeHatirlatma(gun_once);
    res.json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/mail/reminders/sertifika
 * Sertifika yenileme hatırlatmaları
 */
router.post('/reminders/sertifika', async (req, res) => {
  try {
    const { gun_once = 60 } = req.body;
    const results = await checkSertifikaHatirlatma(gun_once);
    res.json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/mail/reminders/upcoming
 * Yaklaşan hatırlatmaları listele (mail göndermeden)
 */
router.get('/reminders/upcoming', async (req, res) => {
  try {
    const { gun = 30 } = req.query;

    // Sözleşme bitişleri
    const sozlesmeler = await query(
      `
      SELECT 
        'sozlesme' as tip,
        p.ad as baslik,
        p.sozlesme_bitis_tarihi as tarih,
        (p.sozlesme_bitis_tarihi - CURRENT_DATE) as kalan_gun
      FROM projeler p
      WHERE p.aktif = TRUE 
        AND p.sozlesme_bitis_tarihi IS NOT NULL
        AND p.sozlesme_bitis_tarihi BETWEEN CURRENT_DATE AND (CURRENT_DATE + $1 * INTERVAL '1 day')
      ORDER BY p.sozlesme_bitis_tarihi
    `,
      [gun]
    );

    // Teminat iadeleri
    const teminatlar = await query(
      `
      SELECT 
        'teminat' as tip,
        p.ad as baslik,
        p.teminat_iade_tarihi as tarih,
        (p.teminat_iade_tarihi - CURRENT_DATE) as kalan_gun,
        p.teminat_mektubu_tutari as tutar
      FROM projeler p
      WHERE p.aktif = TRUE 
        AND p.teminat_iade_tarihi IS NOT NULL
        AND p.teminat_mektubu_tutari > 0
        AND p.teminat_iade_tarihi BETWEEN CURRENT_DATE AND (CURRENT_DATE + $1 * INTERVAL '1 day')
      ORDER BY p.teminat_iade_tarihi
    `,
      [gun]
    );

    // Tüm yaklaşanları birleştir ve sırala
    const tum = [...sozlesmeler.rows, ...teminatlar.rows].sort((a, b) => a.kalan_gun - b.kalan_gun);

    res.json({
      success: true,
      data: {
        sozlesme: sozlesmeler.rows,
        teminat: teminatlar.rows,
        tum,
        toplam: tum.length,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// LOGLAR
// =====================================================

/**
 * GET /api/mail/logs
 * Mail loglarını listele
 */
router.get('/logs', async (req, res) => {
  try {
    const { page = 1, limit = 50, durum } = req.query;
    const offset = (page - 1) * limit;

    let sql = 'SELECT * FROM mail_logs WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (durum) {
      sql += ` AND durum = $${paramIndex}`;
      params.push(durum);
      paramIndex++;
    }

    sql += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await query(sql, params);

    // Toplam sayı
    const countResult = await query(
      'SELECT COUNT(*) FROM mail_logs' + (durum ? ' WHERE durum = $1' : ''),
      durum ? [durum] : []
    );

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total: parseInt(countResult.rows[0].count, 10),
        totalPages: Math.ceil(countResult.rows[0].count / limit),
      },
    });
  } catch (error) {
    // Tablo yoksa boş dön
    if (error.message.includes('does not exist')) {
      return res.json({ success: true, data: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/mail/stats
 * Mail istatistikleri
 */
router.get('/stats', async (_req, res) => {
  try {
    const result = await query(`
      SELECT 
        COUNT(*) as toplam,
        COUNT(CASE WHEN durum = 'gonderildi' THEN 1 END) as basarili,
        COUNT(CASE WHEN durum = 'hata' THEN 1 END) as hatali,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '24 hours' THEN 1 END) as son_24_saat,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END) as son_7_gun
      FROM mail_logs
    `);

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    // Tablo yoksa boş istatistik dön
    if (error.message.includes('does not exist')) {
      return res.json({
        success: true,
        data: { toplam: 0, basarili: 0, hatali: 0, son_24_saat: 0, son_7_gun: 0 },
      });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// AYARLAR
// =====================================================

/**
 * GET /api/mail/settings
 * SMTP ayarlarını getir (hassas bilgiler gizli)
 */
router.get('/settings', async (_req, res) => {
  try {
    res.json({
      success: true,
      data: {
        host: process.env.SMTP_HOST || 'Ayarlanmamış',
        port: process.env.SMTP_PORT || 'Ayarlanmamış',
        user: process.env.SMTP_USER ? '***' + process.env.SMTP_USER.slice(-10) : 'Ayarlanmamış',
        secure: process.env.SMTP_SECURE === 'true',
        configured: !!(process.env.SMTP_USER && process.env.SMTP_PASS),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/mail/test
 * Test maili gönder
 */
router.post('/test', async (req, res) => {
  try {
    const { to } = req.body;

    if (!to) {
      return res.status(400).json({ success: false, error: 'Test alıcısı (to) zorunludur' });
    }

    const result = await sendMail({
      to,
      template: 'GENEL_BILDIRIM',
      data: {
        baslik: '🧪 Test E-postası',
        icerik: `
          <p>Bu bir test e-postasıdır.</p>
          <p>SMTP ayarlarınız doğru çalışıyor!</p>
          <p><strong>Gönderim Zamanı:</strong> ${new Date().toLocaleString('tr-TR')}</p>
        `,
      },
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
