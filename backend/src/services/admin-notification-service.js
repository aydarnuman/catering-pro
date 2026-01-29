/**
 * Admin Notification Service
 * DEPRECATED: Bu servis geriye dönük uyumluluk için korunuyor.
 * Yeni kod için unified-notification-service kullanın.
 *
 * Bu servis artık unified-notification-service'e proxy olarak çalışır.
 */

import unifiedNotificationService, {
  NotificationSource,
  NotificationSeverity,
  NotificationCategory
} from './unified-notification-service.js';
import logger from '../utils/logger.js';

class AdminNotificationService {
  /**
   * Bildirim oluştur
   * @deprecated Use unifiedNotificationService.createNotification instead
   */
  async createNotification({ type, title, message, severity = 'info', userId = null, metadata = {} }) {
    logger.debug('AdminNotificationService.createNotification called - proxying to unified service');

    return unifiedNotificationService.createNotification({
      userId,
      title,
      message,
      type: severity === 'critical' || severity === 'error' ? 'error' : severity === 'warning' ? 'warning' : 'info',
      category: type, // account_locked, suspicious_activity, etc.
      severity,
      source: NotificationSource.ADMIN,
      metadata
    });
  }

  /**
   * Hesap kilitleme bildirimi
   * @deprecated Use unifiedNotificationService.notifyAccountLocked instead
   */
  async notifyAccountLocked(userId, email, ipAddress, lockedUntil) {
    return unifiedNotificationService.notifyAccountLocked(userId, email, ipAddress, lockedUntil);
  }

  /**
   * Şüpheli aktivite bildirimi
   * @deprecated Use unifiedNotificationService.notifySuspiciousActivity instead
   */
  async notifySuspiciousActivity(userId, activity, ipAddress, details = {}) {
    return unifiedNotificationService.notifySuspiciousActivity(userId, activity, ipAddress, details);
  }

  /**
   * Sistem hatası bildirimi
   * @deprecated Use unifiedNotificationService.notifySystemError instead
   */
  async notifySystemError(error, details = {}) {
    return unifiedNotificationService.notifySystemError(error, details);
  }

  /**
   * Yüksek öncelikli bildirim
   * @deprecated Use unifiedNotificationService.notifyHighPriority instead
   */
  async notifyHighPriority(title, message, metadata = {}) {
    return unifiedNotificationService.notifyHighPriority(title, message, metadata);
  }

  /**
   * Bildirimleri listele
   * @deprecated Use unifiedNotificationService.getNotifications instead
   */
  async getNotifications({ limit = 50, read = null, type = null, severity = null } = {}) {
    const notifications = await unifiedNotificationService.getNotifications({
      isAdmin: true,
      source: NotificationSource.ADMIN,
      category: type,
      severity,
      unreadOnly: read === false,
      limit
    });

    // Eski format için dönüştür
    return notifications.map(n => ({
      id: n.id,
      type: n.category,
      title: n.title,
      message: n.message,
      severity: n.severity,
      read: n.is_read,
      userId: n.userId,
      metadata: n.metadata,
      createdAt: n.created_at,
      readAt: n.read_at
    }));
  }

  /**
   * Okunmamış bildirim sayısı
   * @deprecated Use unifiedNotificationService.getUnreadCount instead
   */
  async getUnreadCount() {
    return unifiedNotificationService.getUnreadCount(null, true);
  }

  /**
   * Bildirimi okundu işaretle
   * @deprecated Use unifiedNotificationService.markAsRead instead
   */
  async markAsRead(notificationId) {
    const result = await unifiedNotificationService.markAsRead(notificationId, null, true);
    return result.success;
  }

  /**
   * Tüm bildirimleri okundu işaretle
   * @deprecated Use unifiedNotificationService.markAllAsRead instead
   */
  async markAllAsRead() {
    const result = await unifiedNotificationService.markAllAsRead(null, true, NotificationSource.ADMIN);
    return result.count;
  }

  /**
   * Bildirimi sil
   * @deprecated Use unifiedNotificationService.deleteNotification instead
   */
  async deleteNotification(notificationId) {
    const result = await unifiedNotificationService.deleteNotification(notificationId, null, true);
    return result.success;
  }

  /**
   * Bildirim detayı getir
   * @deprecated Use unifiedNotificationService.getNotification instead
   */
  async getNotification(notificationId) {
    const notification = await unifiedNotificationService.getNotification(notificationId, null, true);

    if (!notification) return null;

    // Eski format için dönüştür
    return {
      id: notification.id,
      type: notification.category,
      title: notification.title,
      message: notification.message,
      severity: notification.severity,
      read: notification.is_read,
      userId: notification.userId,
      metadata: notification.metadata,
      createdAt: notification.created_at,
      readAt: notification.read_at
    };
  }
}

// Singleton instance
const adminNotificationService = new AdminNotificationService();

export default adminNotificationService;
export { AdminNotificationService };
