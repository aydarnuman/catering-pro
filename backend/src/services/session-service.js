/**
 * Session Service
 * Kullanıcı oturum yönetimi - eşzamanlı limit kontrolü
 */

import { query } from '../database.js';
import logger from '../utils/logger.js';

class SessionService {
  /**
   * Maksimum eşzamanlı oturum sayısı
   */
  MAX_CONCURRENT_SESSIONS = 3;

  /**
   * Yeni session oluştur
   * Limit aşıldıysa en eski session'ı sonlandırır
   * @param {number} userId - Kullanıcı ID
   * @param {string} refreshTokenHash - Refresh token hash
   * @param {string} ipAddress - IP adresi
   * @param {string} userAgent - User agent
   * @param {Object} deviceInfo - Cihaz bilgileri
   * @returns {Promise<number>} Session ID
   */
  async createSession(userId, refreshTokenHash, ipAddress, userAgent, deviceInfo = {}) {
    try {
      // Aktif session sayısını kontrol et
      const activeCountResult = await query('SELECT get_active_session_count($1) as count', [userId]);
      const activeCount = parseInt(activeCountResult.rows[0]?.count || 0, 10);

      // Limit aşıldıysa en eski session'ı sonlandır
      if (activeCount >= this.MAX_CONCURRENT_SESSIONS) {
        const oldestSessionResult = await query('SELECT get_oldest_active_session($1) as session_id', [userId]);
        const oldestSessionId = oldestSessionResult.rows[0]?.session_id;

        if (oldestSessionId) {
          await this.terminateSession(oldestSessionId);
          logger.info('Oldest session terminated due to limit', {
            userId,
            sessionId: oldestSessionId,
            maxSessions: this.MAX_CONCURRENT_SESSIONS,
          });
        }
      }

      // Yeni session oluştur
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30); // 30 gün

      const result = await query(
        `INSERT INTO user_sessions (user_id, refresh_token_hash, device_info, ip_address, user_agent, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [userId, refreshTokenHash, JSON.stringify(deviceInfo), ipAddress || null, userAgent || null, expiresAt]
      );

      const sessionId = result.rows[0]?.id;

      logger.debug('Session created', {
        sessionId,
        userId,
        activeCount: activeCount + 1,
      });

      return sessionId;
    } catch (error) {
      logger.error('Session creation error', {
        error: error.message,
        userId,
        refreshTokenHash: refreshTokenHash.substring(0, 10) + '...',
      });
      return null;
    }
  }

  /**
   * Session'ı güncelle (last_activity)
   * @param {string} refreshTokenHash - Refresh token hash
   * @returns {Promise<boolean>}
   */
  async updateSessionActivity(refreshTokenHash) {
    try {
      await query(
        `UPDATE user_sessions 
         SET last_activity = NOW()
         WHERE refresh_token_hash = $1 
           AND is_active = TRUE
           AND expires_at > NOW()`,
        [refreshTokenHash]
      );

      return true;
    } catch (error) {
      logger.error('Session activity update error', {
        error: error.message,
        refreshTokenHash: refreshTokenHash.substring(0, 10) + '...',
      });
      return false;
    }
  }

  /**
   * Kullanıcının aktif session'larını listele
   * @param {number} userId - Kullanıcı ID
   * @returns {Promise<Array>}
   */
  async getUserSessions(userId) {
    try {
      const result = await query(
        `SELECT id, refresh_token_hash, device_info, ip_address, user_agent, last_activity, created_at, expires_at, is_active
         FROM user_sessions
         WHERE user_id = $1
           AND expires_at > NOW() - INTERVAL '1 day'
         ORDER BY created_at DESC`,
        [userId]
      );

      return result.rows.map((row) => ({
        id: row.id,
        refreshTokenHash: row.refresh_token_hash,
        deviceInfo: row.device_info || {},
        ipAddress: row.ip_address,
        userAgent: row.user_agent,
        lastActivity: row.last_activity,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
        isActive: row.is_active,
      }));
    } catch (error) {
      logger.error('Get user sessions error', {
        error: error.message,
        userId,
      });
      return [];
    }
  }

  /**
   * Session'ı sonlandır
   * @param {number} sessionId - Session ID
   * @returns {Promise<boolean>}
   */
  async terminateSession(sessionId) {
    try {
      const result = await query('SELECT terminate_session($1) as success', [sessionId]);

      const success = result.rows[0]?.success || false;

      if (success) {
        logger.info('Session terminated', { sessionId });
      }

      return success;
    } catch (error) {
      logger.error('Terminate session error', {
        error: error.message,
        sessionId,
      });
      return false;
    }
  }

  /**
   * Kullanıcının diğer tüm session'larını sonlandır (mevcut hariç)
   * @param {number} userId - Kullanıcı ID
   * @param {string} currentTokenHash - Mevcut refresh token hash
   * @returns {Promise<number>} Sonlandırılan session sayısı
   */
  async terminateOtherSessions(userId, currentTokenHash) {
    try {
      const result = await query('SELECT terminate_other_sessions($1, $2) as count', [userId, currentTokenHash]);

      const count = parseInt(result.rows[0]?.count || 0, 10);

      logger.info('Other sessions terminated', {
        userId,
        count,
        currentTokenHash: currentTokenHash.substring(0, 10) + '...',
      });

      return count;
    } catch (error) {
      logger.error('Terminate other sessions error', {
        error: error.message,
        userId,
      });
      return 0;
    }
  }

  /**
   * Session'ı refresh token hash ile bul
   * @param {string} refreshTokenHash - Refresh token hash
   * @returns {Promise<Object|null>}
   */
  async getSessionByToken(refreshTokenHash) {
    try {
      const result = await query(
        `SELECT id, user_id, device_info, ip_address, user_agent, last_activity, created_at, expires_at, is_active
         FROM user_sessions
         WHERE refresh_token_hash = $1
           AND is_active = TRUE
           AND expires_at > NOW()`,
        [refreshTokenHash]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        userId: row.user_id,
        deviceInfo: row.device_info || {},
        ipAddress: row.ip_address,
        userAgent: row.user_agent,
        lastActivity: row.last_activity,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
        isActive: row.is_active,
      };
    } catch (error) {
      logger.error('Get session by token error', {
        error: error.message,
        refreshTokenHash: refreshTokenHash.substring(0, 10) + '...',
      });
      return null;
    }
  }

  /**
   * Device info parse et (user agent'dan)
   * @param {string} userAgent - User agent string
   * @returns {Object}
   */
  parseDeviceInfo(userAgent) {
    if (!userAgent) {
      return {
        device: 'Unknown',
        os: 'Unknown',
        browser: 'Unknown',
      };
    }

    // Basit parsing (daha gelişmiş için ua-parser-js kullanılabilir)
    const info = {
      device: 'Desktop',
      os: 'Unknown',
      browser: 'Unknown',
    };

    // OS detection
    if (userAgent.includes('Windows')) info.os = 'Windows';
    else if (userAgent.includes('Mac')) info.os = 'macOS';
    else if (userAgent.includes('Linux')) info.os = 'Linux';
    else if (userAgent.includes('Android')) {
      info.os = 'Android';
      info.device = 'Mobile';
    } else if (userAgent.includes('iOS') || userAgent.includes('iPhone') || userAgent.includes('iPad')) {
      info.os = 'iOS';
      info.device = 'Mobile';
    }

    // Browser detection
    if (userAgent.includes('Chrome')) info.browser = 'Chrome';
    else if (userAgent.includes('Firefox')) info.browser = 'Firefox';
    else if (userAgent.includes('Safari')) info.browser = 'Safari';
    else if (userAgent.includes('Edge')) info.browser = 'Edge';
    else if (userAgent.includes('Opera')) info.browser = 'Opera';

    return info;
  }
}

// Singleton instance
const sessionService = new SessionService();

export default sessionService;
export { SessionService };
