/**
 * Unified Notification Service
 * Tüm bildirimleri tek merkezden yöneten servis
 * user, admin ve system bildirimlerini birleştirir
 */

import { query } from '../database.js';
import logger from '../utils/logger.js';

// Bildirim türleri
export const NotificationType = {
  INFO: 'info',
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'error'
};

// Bildirim kaynakları
export const NotificationSource = {
  USER: 'user',      // Normal kullanıcı bildirimleri
  ADMIN: 'admin',    // Admin bildirimleri (güvenlik, sistem)
  SYSTEM: 'system'   // Otomatik sistem bildirimleri
};

// Önem seviyeleri
export const NotificationSeverity = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical'
};

// Bildirim kategorileri
export const NotificationCategory = {
  // User categories
  TENDER: 'tender',
  INVOICE: 'invoice',
  STOCK: 'stock',
  PAYMENT: 'payment',
  // Scheduler categories (otomatik bildirimler)
  REMINDER: 'reminder',       // Not/Ajanda hatırlatıcıları
  CEK_SENET: 'cek_senet',     // Çek/Senet vade bildirimleri
  // Admin categories
  ACCOUNT_LOCKED: 'account_locked',
  SUSPICIOUS_ACTIVITY: 'suspicious_activity',
  SYSTEM_ERROR: 'system_error',
  HIGH_PRIORITY: 'high_priority',
  // System categories
  GENERAL: 'system'
};

class UnifiedNotificationService {
  /**
   * Yeni bildirim oluştur
   * @param {Object} notification - Bildirim verisi
   * @returns {Promise<number|null>} Bildirim ID
   */
  async createNotification({
    userId = null,
    title,
    message = null,
    type = NotificationType.INFO,
    category = NotificationCategory.GENERAL,
    link = null,
    severity = NotificationSeverity.INFO,
    source = NotificationSource.USER,
    metadata = {}
  }) {
    try {
      const result = await query(
        `INSERT INTO notifications
         (user_id, title, message, type, category, link, severity, source, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id`,
        [userId, title, message, type, category, link, severity, source, JSON.stringify(metadata)]
      );

      const notificationId = result.rows[0]?.id;

      logger.info('Notification created', {
        id: notificationId,
        source,
        type,
        severity,
        userId,
        category
      });

      return notificationId;
    } catch (error) {
      logger.error('Notification creation error', {
        error: error.message,
        type,
        severity
      });
      return null;
    }
  }

  // ========== USER NOTIFICATION HELPERS ==========

  /**
   * İhale bildirimi
   */
  async notifyTender(userId, title, message, link = '/tenders') {
    return this.createNotification({
      userId,
      title,
      message,
      type: NotificationType.INFO,
      category: NotificationCategory.TENDER,
      link,
      source: NotificationSource.USER
    });
  }

  /**
   * Fatura bildirimi
   */
  async notifyInvoice(userId, title, message, link = '/muhasebe/faturalar') {
    return this.createNotification({
      userId,
      title,
      message,
      type: NotificationType.WARNING,
      category: NotificationCategory.INVOICE,
      link,
      source: NotificationSource.USER
    });
  }

  /**
   * Stok bildirimi
   */
  async notifyStock(userId, title, message, link = '/muhasebe/stok') {
    return this.createNotification({
      userId,
      title,
      message,
      type: NotificationType.WARNING,
      category: NotificationCategory.STOCK,
      link,
      source: NotificationSource.USER
    });
  }

  // ========== SCHEDULER NOTIFICATION HELPERS ==========

  /**
   * Not/Ajanda hatırlatıcı bildirimi
   */
  async notifyReminder(userId, title, message, link = '/ayarlar?tab=notlar', metadata = {}) {
    return this.createNotification({
      userId,
      title,
      message,
      type: NotificationType.INFO,
      category: NotificationCategory.REMINDER,
      link,
      severity: NotificationSeverity.INFO,
      source: NotificationSource.SYSTEM,
      metadata
    });
  }

  /**
   * Çek/Senet vade bildirimi
   */
  async notifyCekSenet(title, message, link = '/muhasebe/kasa-banka?tab=cek-senet', severity = NotificationSeverity.WARNING, metadata = {}) {
    return this.createNotification({
      userId: null, // Sistem geneli - admin'ler görsün
      title,
      message,
      type: severity === NotificationSeverity.ERROR ? NotificationType.ERROR : NotificationType.WARNING,
      category: NotificationCategory.CEK_SENET,
      link,
      severity,
      source: NotificationSource.SYSTEM,
      metadata
    });
  }

  // ========== ADMIN NOTIFICATION HELPERS ==========

  /**
   * Hesap kilitleme bildirimi
   */
  async notifyAccountLocked(userId, email, ipAddress, lockedUntil) {
    const minutesRemaining = Math.ceil((lockedUntil.getTime() - Date.now()) / 60000);

    return this.createNotification({
      userId,
      title: 'Hesap Kilitlendi',
      message: `${email} hesabı ${minutesRemaining} dakika süreyle kilitlendi. IP: ${ipAddress || 'Bilinmiyor'}`,
      type: NotificationType.WARNING,
      category: NotificationCategory.ACCOUNT_LOCKED,
      severity: NotificationSeverity.WARNING,
      source: NotificationSource.ADMIN,
      metadata: {
        email,
        ipAddress,
        lockedUntil: lockedUntil.toISOString(),
        minutesRemaining
      }
    });
  }

  /**
   * Şüpheli aktivite bildirimi
   */
  async notifySuspiciousActivity(userId, activity, ipAddress, details = {}) {
    return this.createNotification({
      userId,
      title: 'Şüpheli Aktivite Tespit Edildi',
      message: activity,
      type: NotificationType.ERROR,
      category: NotificationCategory.SUSPICIOUS_ACTIVITY,
      severity: NotificationSeverity.ERROR,
      source: NotificationSource.ADMIN,
      metadata: {
        ipAddress,
        ...details
      }
    });
  }

  /**
   * Sistem hatası bildirimi
   */
  async notifySystemError(error, details = {}) {
    return this.createNotification({
      userId: null,
      title: 'Sistem Hatası',
      message: error,
      type: NotificationType.ERROR,
      category: NotificationCategory.SYSTEM_ERROR,
      severity: NotificationSeverity.CRITICAL,
      source: NotificationSource.ADMIN,
      metadata: details
    });
  }

  /**
   * Yüksek öncelikli bildirim
   */
  async notifyHighPriority(title, message, metadata = {}) {
    return this.createNotification({
      userId: null,
      title,
      message,
      type: NotificationType.ERROR,
      category: NotificationCategory.HIGH_PRIORITY,
      severity: NotificationSeverity.ERROR,
      source: NotificationSource.ADMIN,
      metadata
    });
  }

  // ========== QUERY METHODS ==========

  /**
   * Bildirimleri listele
   * @param {Object} options - Filtreleme seçenekleri
   * @returns {Promise<Array>}
   */
  async getNotifications({
    userId = null,
    isAdmin = false,
    source = null,
    category = null,
    severity = null,
    unreadOnly = false,
    limit = 20,
    offset = 0
  } = {}) {
    try {
      let queryText = 'SELECT * FROM notifications WHERE 1=1';
      const params = [];
      let paramCount = 1;

      // Admin tüm admin bildirimlerini görebilir
      if (isAdmin) {
        if (source) {
          queryText += ` AND source = $${paramCount++}`;
          params.push(source);
        }
        // Admin değilse user_id zorunlu (kendi bildirimleri + genel sistem bildirimleri)
      } else if (userId) {
        queryText += ` AND (user_id = $${paramCount++} OR (user_id IS NULL AND source = 'system'))`;
        params.push(userId);
        // Admin bildirimleri normal kullanıcıya gösterilmez
        queryText += ` AND source != 'admin'`;
      }

      if (category) {
        queryText += ` AND category = $${paramCount++}`;
        params.push(category);
      }

      if (severity) {
        queryText += ` AND severity = $${paramCount++}`;
        params.push(severity);
      }

      if (unreadOnly) {
        queryText += ' AND is_read = FALSE';
      }

      queryText += ` ORDER BY created_at DESC LIMIT $${paramCount++} OFFSET $${paramCount++}`;
      params.push(limit, offset);

      const result = await query(queryText, params);

      return result.rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        title: row.title,
        message: row.message,
        type: row.type,
        category: row.category,
        link: row.link,
        is_read: row.is_read,
        severity: row.severity,
        source: row.source,
        metadata: row.metadata || {},
        created_at: row.created_at,
        read_at: row.read_at
      }));
    } catch (error) {
      logger.error('Get notifications error', { error: error.message });
      return [];
    }
  }

  /**
   * Okunmamış bildirim sayısı
   */
  async getUnreadCount(userId = null, isAdmin = false) {
    try {
      let queryText = 'SELECT COUNT(*) as count FROM notifications WHERE is_read = FALSE';
      const params = [];

      if (isAdmin) {
        // Admin tüm okunmamış bildirimleri sayar
      } else if (userId) {
        queryText += ' AND (user_id = $1 OR (user_id IS NULL AND source = \'system\'))';
        queryText += ' AND source != \'admin\'';
        params.push(userId);
      }

      const result = await query(queryText, params);
      return parseInt(result.rows[0]?.count || 0);
    } catch (error) {
      logger.error('Get unread count error', { error: error.message });
      return 0;
    }
  }

  /**
   * Bildirimi okundu işaretle
   */
  async markAsRead(notificationId, userId = null, isAdmin = false) {
    try {
      let queryText = `
        UPDATE notifications
        SET is_read = TRUE, read_at = NOW()
        WHERE id = $1
      `;
      const params = [notificationId];

      // Admin değilse sadece kendi bildirimini işaretleyebilir
      if (!isAdmin && userId) {
        queryText += ' AND user_id = $2';
        params.push(userId);
      }

      queryText += ' RETURNING id';

      const result = await query(queryText, params);

      if (result.rowCount === 0) {
        return { success: false, message: 'Bildirim bulunamadı veya yetki yok' };
      }

      logger.debug('Notification marked as read', { notificationId, userId });
      return { success: true };
    } catch (error) {
      logger.error('Mark as read error', { error: error.message, notificationId });
      return { success: false, message: error.message };
    }
  }

  /**
   * Tüm bildirimleri okundu işaretle
   */
  async markAllAsRead(userId = null, isAdmin = false, source = null) {
    try {
      let queryText = `
        UPDATE notifications
        SET is_read = TRUE, read_at = NOW()
        WHERE is_read = FALSE
      `;
      const params = [];
      let paramCount = 1;

      if (!isAdmin && userId) {
        queryText += ` AND (user_id = $${paramCount++} OR (user_id IS NULL AND source = 'system'))`;
        queryText += ` AND source != 'admin'`;
        params.push(userId);
      }

      if (source) {
        queryText += ` AND source = $${paramCount++}`;
        params.push(source);
      }

      queryText += ' RETURNING id';

      const result = await query(queryText, params);
      const count = result.rows.length;

      logger.info('All notifications marked as read', { count, userId, isAdmin });
      return { success: true, count };
    } catch (error) {
      logger.error('Mark all as read error', { error: error.message });
      return { success: false, count: 0, message: error.message };
    }
  }

  /**
   * Bildirimi sil
   */
  async deleteNotification(notificationId, userId = null, isAdmin = false) {
    try {
      let queryText = 'DELETE FROM notifications WHERE id = $1';
      const params = [notificationId];

      if (!isAdmin && userId) {
        queryText += ' AND user_id = $2';
        params.push(userId);
      }

      queryText += ' RETURNING id';

      const result = await query(queryText, params);

      if (result.rowCount === 0) {
        return { success: false, message: 'Bildirim bulunamadı veya yetki yok' };
      }

      logger.debug('Notification deleted', { notificationId });
      return { success: true };
    } catch (error) {
      logger.error('Delete notification error', { error: error.message, notificationId });
      return { success: false, message: error.message };
    }
  }

  /**
   * Tek bildirim detayı
   */
  async getNotification(notificationId, userId = null, isAdmin = false) {
    try {
      let queryText = 'SELECT * FROM notifications WHERE id = $1';
      const params = [notificationId];

      if (!isAdmin && userId) {
        queryText += ' AND (user_id = $2 OR (user_id IS NULL AND source = \'system\'))';
        queryText += ' AND source != \'admin\'';
        params.push(userId);
      }

      const result = await query(queryText, params);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        userId: row.user_id,
        title: row.title,
        message: row.message,
        type: row.type,
        category: row.category,
        link: row.link,
        is_read: row.is_read,
        severity: row.severity,
        source: row.source,
        metadata: row.metadata || {},
        created_at: row.created_at,
        read_at: row.read_at
      };
    } catch (error) {
      logger.error('Get notification error', { error: error.message, notificationId });
      return null;
    }
  }

  /**
   * Eski bildirimleri temizle (30 günden eski okunmuş)
   */
  async cleanupOldNotifications() {
    try {
      const result = await query(`
        DELETE FROM notifications
        WHERE is_read = TRUE
        AND created_at < NOW() - INTERVAL '30 days'
        RETURNING id
      `);

      const count = result.rows.length;
      logger.info('Old notifications cleaned up', { count });
      return count;
    } catch (error) {
      logger.error('Cleanup notifications error', { error: error.message });
      return 0;
    }
  }
}

// Singleton instance
const unifiedNotificationService = new UnifiedNotificationService();

export default unifiedNotificationService;
export { UnifiedNotificationService };
