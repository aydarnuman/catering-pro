/**
 * Unified Notification System API
 * Tüm kullanıcı ve admin bildirimlerini tek endpoint'te yönetir
 */

import express from 'express';
import unifiedNotificationService from '../services/unified-notification-service.js';

const router = express.Router();

/**
 * Helper: Kullanıcı admin mi?
 */
const isUserAdmin = (req) => {
  const userType = req.user?.user_type || req.user?.role;
  return userType === 'admin' || userType === 'super_admin';
};

/**
 * @swagger
 * /api/notifications:
 *   get:
 *     summary: Bildirimleri listele
 *     tags: [Notifications]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *       - in: query
 *         name: unread_only
 *         schema:
 *           type: boolean
 *           default: false
 *       - in: query
 *         name: source
 *         schema:
 *           type: string
 *           enum: [user, admin, system]
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *       - in: query
 *         name: severity
 *         schema:
 *           type: string
 *           enum: [info, warning, error, critical]
 */
router.get('/', async (req, res) => {
  try {
    const { limit = 20, offset = 0, unread_only = false, source, category, severity } = req.query;

    const userId = req.user?.id;
    const isAdmin = isUserAdmin(req);

    const notifications = await unifiedNotificationService.getNotifications({
      userId,
      isAdmin,
      source: source || null,
      category: category || null,
      severity: severity || null,
      unreadOnly: unread_only === 'true' || unread_only === true,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
    });

    res.json({
      success: true,
      data: notifications,
      count: notifications.length,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/notifications/unread-count:
 *   get:
 *     summary: Okunmamış bildirim sayısı
 *     tags: [Notifications]
 */
router.get('/unread-count', async (req, res) => {
  try {
    const userId = req.user?.id;
    const isAdmin = isUserAdmin(req);

    const count = await unifiedNotificationService.getUnreadCount(userId, isAdmin);

    res.json({
      success: true,
      data: { count },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/notifications/{id}:
 *   get:
 *     summary: Tek bildirim detayı
 *     tags: [Notifications]
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const isAdmin = isUserAdmin(req);

    const notification = await unifiedNotificationService.getNotification(id, userId, isAdmin);

    if (!notification) {
      return res.status(404).json({ success: false, error: 'Bildirim bulunamadı' });
    }

    res.json({
      success: true,
      data: notification,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/notifications/{id}/read:
 *   patch:
 *     summary: Bildirimi okundu olarak işaretle
 *     tags: [Notifications]
 */
router.patch('/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const isAdmin = isUserAdmin(req);

    const result = await unifiedNotificationService.markAsRead(id, userId, isAdmin);

    if (!result.success) {
      return res.status(404).json({ success: false, error: result.message });
    }

    res.json({
      success: true,
      message: 'Bildirim okundu olarak işaretlendi',
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/notifications/read-all:
 *   patch:
 *     summary: Tüm bildirimleri okundu olarak işaretle
 *     tags: [Notifications]
 *     parameters:
 *       - in: query
 *         name: source
 *         schema:
 *           type: string
 *           enum: [user, admin, system]
 *         description: Sadece belirli kaynaktaki bildirimleri işaretle
 */
router.patch('/read-all', async (req, res) => {
  try {
    const { source } = req.query;
    const userId = req.user?.id;
    const isAdmin = isUserAdmin(req);

    const result = await unifiedNotificationService.markAllAsRead(userId, isAdmin, source || null);

    res.json({
      success: true,
      message: `${result.count} bildirim okundu olarak işaretlendi`,
      count: result.count,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/notifications:
 *   post:
 *     summary: Yeni bildirim oluştur (sistem kullanımı için)
 *     tags: [Notifications]
 */
router.post('/', async (req, res) => {
  try {
    const {
      user_id,
      title,
      message,
      type = 'info',
      category,
      link,
      severity = 'info',
      source = 'user',
      metadata = {},
    } = req.body;

    if (!title) {
      return res.status(400).json({
        success: false,
        error: 'title zorunludur',
      });
    }

    // Admin bildirimi oluşturmak için admin yetkisi gerekli
    if (source === 'admin' && !isUserAdmin(req)) {
      return res.status(403).json({
        success: false,
        error: 'Admin bildirimi oluşturmak için yetki gerekli',
      });
    }

    const notificationId = await unifiedNotificationService.createNotification({
      userId: user_id || null,
      title,
      message,
      type,
      category,
      link,
      severity,
      source,
      metadata,
    });

    if (!notificationId) {
      return res.status(500).json({
        success: false,
        error: 'Bildirim oluşturulamadı',
      });
    }

    res.status(201).json({
      success: true,
      data: { id: notificationId },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/notifications/{id}:
 *   delete:
 *     summary: Bildirimi sil
 *     tags: [Notifications]
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const isAdmin = isUserAdmin(req);

    const result = await unifiedNotificationService.deleteNotification(id, userId, isAdmin);

    if (!result.success) {
      return res.status(404).json({ success: false, error: result.message });
    }

    res.json({
      success: true,
      message: 'Bildirim silindi',
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/notifications/cleanup:
 *   post:
 *     summary: Eski bildirimleri temizle (admin only)
 *     tags: [Notifications]
 */
router.post('/cleanup', async (req, res) => {
  try {
    if (!isUserAdmin(req)) {
      return res.status(403).json({
        success: false,
        error: 'Bu işlem için admin yetkisi gerekli',
      });
    }

    const count = await unifiedNotificationService.cleanupOldNotifications();

    res.json({
      success: true,
      message: `${count} eski bildirim temizlendi`,
      count,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/notifications/scheduler-status:
 *   get:
 *     summary: Reminder scheduler durumu (admin only)
 *     tags: [Notifications]
 */
router.get('/scheduler-status', async (req, res) => {
  try {
    if (!isUserAdmin(req)) {
      return res.status(403).json({
        success: false,
        error: 'Bu işlem için admin yetkisi gerekli',
      });
    }

    const reminderScheduler = (await import('../services/reminder-notification-scheduler.js')).default;

    res.json({
      success: true,
      data: reminderScheduler.getStatus(),
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/notifications/trigger-reminders:
 *   post:
 *     summary: Reminder scheduler'ı manuel tetikle (admin only)
 *     tags: [Notifications]
 */
router.post('/trigger-reminders', async (req, res) => {
  try {
    if (!isUserAdmin(req)) {
      return res.status(403).json({
        success: false,
        error: 'Bu işlem için admin yetkisi gerekli',
      });
    }

    const reminderScheduler = (await import('../services/reminder-notification-scheduler.js')).default;
    const result = await reminderScheduler.processReminders();

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
