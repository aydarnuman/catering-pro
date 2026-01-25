/**
 * Admin Notification Service
 * Admin kullanıcılarına kritik olaylar için bildirim gönderme
 */

import { query } from '../database.js';
import logger from '../utils/logger.js';

class AdminNotificationService {
  /**
   * Bildirim oluştur
   * @param {Object} notification - Bildirim verisi
   * @param {string} notification.type - Bildirim türü
   * @param {string} notification.title - Başlık
   * @param {string} notification.message - Mesaj
   * @param {string} notification.severity - Önem seviyesi (info, warning, error, critical)
   * @param {number} notification.userId - İlgili kullanıcı ID (opsiyonel)
   * @param {Object} notification.metadata - Ek bilgiler (opsiyonel)
   * @returns {Promise<number>} Bildirim ID
   */
  async createNotification({ type, title, message, severity = 'info', userId = null, metadata = {} }) {
    try {
      const result = await query(
        `INSERT INTO admin_notifications (type, title, message, severity, user_id, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [type, title, message, severity, userId, JSON.stringify(metadata)]
      );

      const notificationId = result.rows[0]?.id;
      
      logger.info('Admin notification created', {
        id: notificationId,
        type,
        severity,
        userId
      });

      return notificationId;
    } catch (error) {
      logger.error('Admin notification creation error', {
        error: error.message,
        type,
        severity
      });
      return null;
    }
  }

  /**
   * Hesap kilitleme bildirimi
   * @param {number} userId - Kilitlenen kullanıcı ID
   * @param {string} email - Kullanıcı email
   * @param {string} ipAddress - IP adresi
   * @param {Date} lockedUntil - Kilit bitiş zamanı
   */
  async notifyAccountLocked(userId, email, ipAddress, lockedUntil) {
    const minutesRemaining = Math.ceil((lockedUntil.getTime() - Date.now()) / 60000);
    
    return await this.createNotification({
      type: 'account_locked',
      title: 'Hesap Kilitlendi',
      message: `${email} hesabı ${minutesRemaining} dakika süreyle kilitlendi. IP: ${ipAddress || 'Bilinmiyor'}`,
      severity: 'warning',
      userId,
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
   * @param {number} userId - Kullanıcı ID
   * @param {string} activity - Aktivite açıklaması
   * @param {string} ipAddress - IP adresi
   * @param {Object} details - Detaylar
   */
  async notifySuspiciousActivity(userId, activity, ipAddress, details = {}) {
    return await this.createNotification({
      type: 'suspicious_activity',
      title: 'Şüpheli Aktivite Tespit Edildi',
      message: activity,
      severity: 'error',
      userId,
      metadata: {
        ipAddress,
        ...details
      }
    });
  }

  /**
   * Sistem hatası bildirimi
   * @param {string} error - Hata mesajı
   * @param {Object} details - Detaylar
   */
  async notifySystemError(error, details = {}) {
    return await this.createNotification({
      type: 'system_error',
      title: 'Sistem Hatası',
      message: error,
      severity: 'critical',
      userId: null,
      metadata: details
    });
  }

  /**
   * Yüksek öncelikli bildirim
   * @param {string} title - Başlık
   * @param {string} message - Mesaj
   * @param {Object} metadata - Detaylar
   */
  async notifyHighPriority(title, message, metadata = {}) {
    return await this.createNotification({
      type: 'high_priority',
      title,
      message,
      severity: 'error',
      userId: null,
      metadata
    });
  }

  /**
   * Bildirimleri listele
   * @param {Object} options - Filtreleme seçenekleri
   * @returns {Promise<Array>}
   */
  async getNotifications({ limit = 50, read = null, type = null, severity = null } = {}) {
    try {
      let queryText = 'SELECT * FROM admin_notifications WHERE 1=1';
      const params = [];
      let paramCount = 1;

      if (read !== null) {
        queryText += ` AND read = $${paramCount++}`;
        params.push(read);
      }

      if (type) {
        queryText += ` AND type = $${paramCount++}`;
        params.push(type);
      }

      if (severity) {
        queryText += ` AND severity = $${paramCount++}`;
        params.push(severity);
      }

      queryText += ` ORDER BY created_at DESC LIMIT $${paramCount++}`;
      params.push(limit);

      const result = await query(queryText, params);

      return result.rows.map(row => ({
        id: row.id,
        type: row.type,
        title: row.title,
        message: row.message,
        severity: row.severity,
        read: row.read,
        userId: row.user_id,
        metadata: row.metadata || {},
        createdAt: row.created_at,
        readAt: row.read_at
      }));
    } catch (error) {
      logger.error('Get notifications error', { error: error.message });
      return [];
    }
  }

  /**
   * Okunmamış bildirim sayısı
   * @returns {Promise<number>}
   */
  async getUnreadCount() {
    try {
      const result = await query('SELECT get_unread_admin_notification_count() as count');
      return parseInt(result.rows[0]?.count || 0);
    } catch (error) {
      logger.error('Get unread count error', { error: error.message });
      return 0;
    }
  }

  /**
   * Bildirimi okundu işaretle
   * @param {number} notificationId - Bildirim ID
   * @returns {Promise<boolean>}
   */
  async markAsRead(notificationId) {
    try {
      await query(
        `UPDATE admin_notifications 
         SET read = TRUE, read_at = NOW()
         WHERE id = $1`,
        [notificationId]
      );

      logger.debug('Notification marked as read', { notificationId });
      return true;
    } catch (error) {
      logger.error('Mark as read error', { error: error.message, notificationId });
      return false;
    }
  }

  /**
   * Tüm bildirimleri okundu işaretle
   * @returns {Promise<number>} Güncellenen bildirim sayısı
   */
  async markAllAsRead() {
    try {
      const result = await query(
        `UPDATE admin_notifications 
         SET read = TRUE, read_at = NOW()
         WHERE read = FALSE
         RETURNING id`
      );

      const count = result.rows.length;
      logger.info('All notifications marked as read', { count });
      return count;
    } catch (error) {
      logger.error('Mark all as read error', { error: error.message });
      return 0;
    }
  }

  /**
   * Bildirimi sil
   * @param {number} notificationId - Bildirim ID
   * @returns {Promise<boolean>}
   */
  async deleteNotification(notificationId) {
    try {
      await query('DELETE FROM admin_notifications WHERE id = $1', [notificationId]);
      logger.debug('Notification deleted', { notificationId });
      return true;
    } catch (error) {
      logger.error('Delete notification error', { error: error.message, notificationId });
      return false;
    }
  }

  /**
   * Bildirim detayı getir
   * @param {number} notificationId - Bildirim ID
   * @returns {Promise<Object|null>}
   */
  async getNotification(notificationId) {
    try {
      const result = await query(
        'SELECT * FROM admin_notifications WHERE id = $1',
        [notificationId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        type: row.type,
        title: row.title,
        message: row.message,
        severity: row.severity,
        read: row.read,
        userId: row.user_id,
        metadata: row.metadata || {},
        createdAt: row.created_at,
        readAt: row.read_at
      };
    } catch (error) {
      logger.error('Get notification error', { error: error.message, notificationId });
      return null;
    }
  }
}

// Singleton instance
const adminNotificationService = new AdminNotificationService();

export default adminNotificationService;
export { AdminNotificationService };
