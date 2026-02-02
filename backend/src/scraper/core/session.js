/**
 * Session Manager - Async Cookie Management
 * ihalebul.com session yönetimi
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scraperConfig } from '../../config/scraper.config.js';
import { SessionExpiredError } from '../../lib/errors.js';
import logger from '../../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class SessionManager {
  constructor() {
    this.sessionPath = path.join(__dirname, '../../../', scraperConfig.session.storagePath);
    this.ttlMs = scraperConfig.session.ttlHours * 60 * 60 * 1000;
    this._session = null;
  }

  /**
   * Session'ı kaydet
   * @param {Array} cookies - Puppeteer cookies
   * @param {string} username - Kullanıcı adı
   * @returns {Promise<Object>} Kaydedilen session
   */
  async save(cookies, username) {
    const session = {
      id: `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      cookies,
      username,
      createdAt: Date.now(),
      expiresAt: Date.now() + this.ttlMs,
      lastUsedAt: Date.now(),
    };

    try {
      // Klasörü oluştur
      await fs.mkdir(path.dirname(this.sessionPath), { recursive: true });

      // Session'ı yaz
      await fs.writeFile(this.sessionPath, JSON.stringify(session, null, 2));

      // Cache'i güncelle
      this._session = session;

      logger.info('Session saved', {
        module: 'scraper',
        action: 'session.save',
        sessionId: session.id,
        username,
        expiresAt: new Date(session.expiresAt).toISOString(),
        cookieCount: cookies.length,
      });

      return session;
    } catch (error) {
      logger.error('Failed to save session', {
        module: 'scraper',
        action: 'session.save',
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Session'ı yükle
   * @returns {Promise<Object|null>} Session veya null
   * @throws {SessionExpiredError} Session süresi dolmuşsa
   */
  async load() {
    try {
      const content = await fs.readFile(this.sessionPath, 'utf-8');
      const session = JSON.parse(content);

      // Süre kontrolü
      if (Date.now() > session.expiresAt) {
        logger.warn('Session expired', {
          module: 'scraper',
          action: 'session.load',
          sessionId: session.id,
          expiredAt: new Date(session.expiresAt).toISOString(),
        });
        await this.clear();
        throw new SessionExpiredError({ sessionId: session.id });
      }

      // lastUsedAt güncelle
      session.lastUsedAt = Date.now();
      await fs.writeFile(this.sessionPath, JSON.stringify(session, null, 2));

      // Cache'i güncelle
      this._session = session;

      logger.debug('Session loaded', {
        module: 'scraper',
        action: 'session.load',
        sessionId: session.id,
        remainingHours: Math.round(((session.expiresAt - Date.now()) / (1000 * 60 * 60)) * 10) / 10,
      });

      return session;
    } catch (error) {
      if (error.code === 'ENOENT') {
        logger.debug('No session file found', {
          module: 'scraper',
          action: 'session.load',
        });
        return null;
      }

      if (error instanceof SessionExpiredError) {
        throw error;
      }

      logger.error('Failed to load session', {
        module: 'scraper',
        action: 'session.load',
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Session'ı sil
   * @returns {Promise<void>}
   */
  async clear() {
    try {
      await fs.unlink(this.sessionPath);
      this._session = null;

      logger.info('Session cleared', {
        module: 'scraper',
        action: 'session.clear',
      });
    } catch (error) {
      if (error.code !== 'ENOENT') {
        logger.error('Failed to clear session', {
          module: 'scraper',
          action: 'session.clear',
          error: error.message,
        });
        throw error;
      }
    }
  }

  /**
   * Session geçerli mi kontrol et
   * @returns {Promise<boolean>}
   */
  async isValid() {
    try {
      const session = await this.load();
      return session?.cookies && session.cookies.length > 0;
    } catch (error) {
      if (error instanceof SessionExpiredError) {
        return false;
      }
      return false;
    }
  }

  /**
   * Cookie'leri sayfaya uygula
   * @param {Page} page - Puppeteer page
   * @param {Array} cookies - Cookie array
   * @returns {Promise<void>}
   */
  async applyCookies(page, cookies) {
    if (!cookies || cookies.length === 0) {
      logger.debug('No cookies to apply', {
        module: 'scraper',
        action: 'session.applyCookies',
      });
      return;
    }

    try {
      await page.setCookie(...cookies);

      logger.debug('Cookies applied to page', {
        module: 'scraper',
        action: 'session.applyCookies',
        count: cookies.length,
      });
    } catch (error) {
      logger.error('Failed to apply cookies', {
        module: 'scraper',
        action: 'session.applyCookies',
        error: error.message,
        cookieCount: cookies.length,
      });
      throw error;
    }
  }

  /**
   * Mevcut session'ı al (cache'den veya dosyadan)
   * @returns {Promise<Object|null>}
   */
  async get() {
    if (this._session && Date.now() < this._session.expiresAt) {
      return this._session;
    }
    return this.load();
  }

  /**
   * Session cookie header'ı oluştur (fetch için)
   * @returns {Promise<string|null>}
   */
  async getCookieHeader() {
    const session = await this.get();
    if (!session?.cookies) return null;

    return session.cookies.map((c) => `${c.name}=${c.value}`).join('; ');
  }
}

// Singleton export
const sessionManager = new SessionManager();
export default sessionManager;
export { SessionManager };
