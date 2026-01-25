/**
 * Login Attempt Service
 * Başarısız login denemelerini takip ve hesap kilitleme
 */

import { query } from '../database.js';
import logger from '../utils/logger.js';
import adminNotificationService from './admin-notification-service.js';

class LoginAttemptService {
  /**
   * Başarısız login denemesini kaydet
   * @param {string} email - Kullanıcı email'i
   * @param {string} ipAddress - IP adresi
   * @param {string} userAgent - User agent
   * @returns {Promise<{isLocked: boolean, lockedUntil: Date | null, remainingAttempts: number}>}
   */
  async recordFailedLogin(email, ipAddress, userAgent) {
    try {
      const result = await query(
        `SELECT * FROM record_failed_login($1, $2, $3)`,
        [email, ipAddress || null, userAgent || null]
      );

      if (result.rows.length === 0) {
        // Kullanıcı bulunamadı
        return {
          isLocked: false,
          lockedUntil: null,
          remainingAttempts: 0
        };
      }

      const row = result.rows[0];
      const isLocked = row.is_locked || false;
      const lockedUntil = row.locked_until ? new Date(row.locked_until) : null;
      
      // Hesap kilitlendiyse admin'e bildirim gönder
      if (isLocked && lockedUntil) {
        try {
          // Kullanıcı ID'sini al
          const userResult = await query('SELECT id FROM users WHERE email = $1', [email]);
          if (userResult.rows.length > 0) {
            await adminNotificationService.notifyAccountLocked(
              userResult.rows[0].id,
              email,
              ipAddress || 'Bilinmiyor',
              lockedUntil
            );
          }
        } catch (notifError) {
          logger.error('Notification send error', { error: notifError.message, email });
          // Bildirim hatası login'i engellemez
        }
      }
      
      return {
        isLocked,
        lockedUntil,
        remainingAttempts: row.remaining_attempts || 0
      };
    } catch (error) {
      logger.error('Failed login recording error', { error: error.message, email });
      // Hata durumunda kilitleme yapma
      return {
        isLocked: false,
        lockedUntil: null,
        remainingAttempts: 0
      };
    }
  }

  /**
   * Başarılı login'de denemeleri sıfırla
   * @param {number} userId - Kullanıcı ID
   * @param {string} ipAddress - IP adresi
   * @param {string} userAgent - User agent
   */
  async recordSuccessfulLogin(userId, ipAddress, userAgent) {
    try {
      await query(`SELECT reset_login_attempts($1)`, [userId]);
      
      // Başarılı login'i de kaydet
      const userResult = await query('SELECT email FROM users WHERE id = $1', [userId]);
      if (userResult.rows.length > 0) {
        await query(
          `INSERT INTO login_attempts (user_id, email, ip_address, user_agent, success)
           VALUES ($1, $2, $3, $4, TRUE)`,
          [userId, userResult.rows[0].email, ipAddress || null, userAgent || null]
        );
      }
    } catch (error) {
      logger.error('Successful login recording error', { error: error.message, userId });
    }
  }

  /**
   * Kullanıcı kilitli mi kontrol et
   * @param {number} userId - Kullanıcı ID
   * @returns {Promise<{isLocked: boolean, lockedUntil: Date | null}>}
   */
  async checkLockStatus(userId) {
    try {
      const result = await query(
        `SELECT is_user_locked($1) as is_locked, locked_until 
         FROM users 
         WHERE id = $1`,
        [userId]
      );

      if (result.rows.length === 0) {
        return { isLocked: false, lockedUntil: null };
      }

      const row = result.rows[0];
      const isLocked = row.is_locked || false;
      const lockedUntil = row.locked_until ? new Date(row.locked_until) : null;

      return { isLocked, lockedUntil };
    } catch (error) {
      logger.error('Lock status check error', { error: error.message, userId });
      return { isLocked: false, lockedUntil: null };
    }
  }

  /**
   * Email ile kilit durumunu kontrol et
   * @param {string} email - Kullanıcı email'i
   * @returns {Promise<{isLocked: boolean, lockedUntil: Date | null, failedAttempts: number}>}
   */
  async checkLockStatusByEmail(email) {
    try {
      const result = await query(
        `SELECT id, is_user_locked(id) as is_locked, locked_until, failed_login_attempts
         FROM users 
         WHERE email = $1 AND is_active = TRUE`,
        [email]
      );

      if (result.rows.length === 0) {
        return { isLocked: false, lockedUntil: null, failedAttempts: 0 };
      }

      const row = result.rows[0];
      const isLocked = row.is_locked || false;
      const lockedUntil = row.locked_until ? new Date(row.locked_until) : null;
      const failedAttempts = row.failed_login_attempts || 0;

      return { isLocked, lockedUntil, failedAttempts };
    } catch (error) {
      logger.error('Lock status check by email error', { error: error.message, email });
      return { isLocked: false, lockedUntil: null, failedAttempts: 0 };
    }
  }

  /**
   * Hesabı manuel olarak kilitle (Admin)
   * @param {number} userId - Kullanıcı ID
   * @param {number} minutes - Kilit süresi (dakika)
   * @returns {Promise<boolean>}
   */
  async lockAccount(userId, minutes = 60) {
    try {
      const lockedUntil = new Date();
      lockedUntil.setMinutes(lockedUntil.getMinutes() + minutes);

      // Kullanıcı bilgilerini al
      const userResult = await query('SELECT email FROM users WHERE id = $1', [userId]);
      if (userResult.rows.length === 0) {
        return false;
      }

      await query(
        `UPDATE users 
         SET locked_until = $1, 
             lockout_count = lockout_count + 1
         WHERE id = $2`,
        [lockedUntil, userId]
      );

      // Admin'e bildirim gönder
      await adminNotificationService.notifyAccountLocked(
        userId,
        userResult.rows[0].email,
        'Admin',
        lockedUntil
      );

      logger.info('Account manually locked', { userId, lockedUntil, minutes });
      return true;
    } catch (error) {
      logger.error('Account lock error', { error: error.message, userId });
      return false;
    }
  }

  /**
   * Hesabı manuel olarak aç (Admin)
   * @param {number} userId - Kullanıcı ID
   * @returns {Promise<boolean>}
   */
  async unlockAccount(userId) {
    try {
      await query(
        `UPDATE users 
         SET locked_until = NULL, 
             failed_login_attempts = 0
         WHERE id = $1`,
        [userId]
      );

      logger.info('Account manually unlocked', { userId });
      return true;
    } catch (error) {
      logger.error('Account unlock error', { error: error.message, userId });
      return false;
    }
  }

  /**
   * Kullanıcının login attempt geçmişini getir
   * @param {number} userId - Kullanıcı ID
   * @param {number} limit - Maksimum kayıt sayısı
   * @returns {Promise<Array>}
   */
  async getLoginHistory(userId, limit = 50) {
    try {
      const result = await query(
        `SELECT id, email, ip_address, user_agent, success, attempted_at
         FROM login_attempts
         WHERE user_id = $1
         ORDER BY attempted_at DESC
         LIMIT $2`,
        [userId, limit]
      );

      return result.rows.map(row => ({
        id: row.id,
        email: row.email,
        ipAddress: row.ip_address,
        userAgent: row.user_agent,
        success: row.success,
        attemptedAt: row.attempted_at
      }));
    } catch (error) {
      logger.error('Login history fetch error', { error: error.message, userId });
      return [];
    }
  }

  /**
   * Kullanıcının mevcut durumunu getir
   * @param {number} userId - Kullanıcı ID
   * @returns {Promise<Object>}
   */
  async getUserStatus(userId) {
    try {
      const result = await query(
        `SELECT id, email, failed_login_attempts, locked_until, lockout_count, last_failed_login
         FROM users
         WHERE id = $1`,
        [userId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        email: row.email,
        failedAttempts: row.failed_login_attempts || 0,
        lockedUntil: row.locked_until ? new Date(row.locked_until) : null,
        lockoutCount: row.lockout_count || 0,
        lastFailedLogin: row.last_failed_login ? new Date(row.last_failed_login) : null
      };
    } catch (error) {
      logger.error('User status fetch error', { error: error.message, userId });
      return null;
    }
  }
}

// Singleton instance
const loginAttemptService = new LoginAttemptService();

export default loginAttemptService;
export { LoginAttemptService };
