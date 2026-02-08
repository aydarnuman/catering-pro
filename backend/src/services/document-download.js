import fetch from 'node-fetch';
import sessionManager from '../scraper/shared/ihalebul-cookie.js';
import browserManager from '../scraper/shared/browser.js';
import loginService from '../scraper/shared/ihalebul-login.js';
import logger from '../utils/logger.js';

/**
 * Authenticated döküman indirme servisi
 * Session cookie'leri kullanarak ihalebul.com'dan dosya indirir
 * Session expire olursa otomatik re-login yapar
 */
class DocumentDownloadService {
  constructor() {
    this.downloadTimeout = 30000; // 30 saniye
    this._refreshingSession = false; // Re-login sırasında tekrar tetiklenmesini önle
  }

  /**
   * Dökümanı indir ve buffer olarak döndür
   * Session expire olursa otomatik re-login yapıp tekrar dener
   * @param {string} documentUrl - İndirilecek URL
   * @param {number} _retryCount - İç retry sayacı (dışarıdan kullanılmaz)
   * @returns {Buffer} - İndirilen dosya buffer'ı
   */
  async downloadDocument(documentUrl, _retryCount = 0) {
    logger.info(`Döküman indiriliyor: ${documentUrl}`);

    try {
      // Session cookie'lerini al (varsa)
      const headers = {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Referer: 'https://www.ihalebul.com/',
        Accept: '*/*',
        'Accept-Encoding': 'gzip, deflate, br',
        Connection: 'keep-alive',
      };

      try {
        const session = await sessionManager.loadSession();
        if (session?.cookies && session.cookies.length > 0) {
          // Cookie'leri header formatına çevir
          const cookieHeader = session.cookies.map((c) => `${c.name}=${c.value}`).join('; ');

          headers['Cookie'] = cookieHeader;
          logger.debug(`${session.cookies.length} cookie kullanılıyor`);
        } else {
          logger.warn('Session bulunamadı, cookie olmadan deneniyor');
        }
      } catch (sessionError) {
        logger.warn(`Session yüklenemedi: ${sessionError.message}, cookie olmadan deneniyor`);
      }

      // Fetch ile indir (cookie ile veya olmadan)
      const response = await fetch(documentUrl, {
        headers,
        timeout: this.downloadTimeout,
        redirect: 'follow',
      });

      // === SESSION EXPIRE ALGILAMA ===
      // 401/403 durumunda otomatik re-login
      if (response.status === 401 || response.status === 403) {
        if (_retryCount === 0) {
          logger.warn(`Session expired (HTTP ${response.status}), re-login yapılıyor...`, { url: documentUrl });
          await this.refreshSession();
          return this.downloadDocument(documentUrl, 1);
        }
        throw new Error(`Auth failed after re-login: HTTP ${response.status}: ${response.statusText}`);
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const buffer = await response.buffer();

      // === LOGIN REDIRECT ALGILAMA ===
      // HTML içerik döndüyse ve login sayfası gibi görünüyorsa re-login
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/html') && buffer.length < 50000) {
        const htmlSnippet = buffer.toString('utf8').substring(0, 1000).toLowerCase();
        const isLoginPage = htmlSnippet.includes('giriş') ||
          htmlSnippet.includes('login') ||
          htmlSnippet.includes('signin') ||
          htmlSnippet.includes('kullanıcı adı') ||
          htmlSnippet.includes('input type="password"');

        if (isLoginPage && _retryCount === 0) {
          logger.warn('Login sayfasına yönlendirildi, re-login yapılıyor...', { url: documentUrl });
          await this.refreshSession();
          return this.downloadDocument(documentUrl, 1);
        }
      }

      logger.info(`Döküman indirildi: ${buffer.length} bytes`);
      return buffer;
    } catch (error) {
      logger.error('Döküman indirme hatası', { error: error.message, url: documentUrl });
      throw error;
    }
  }

  /**
   * Puppeteer ile fresh login yaparak session'ı yeniler
   * Eşzamanlı çağrılarda tek seferde çalışır (lock mekanizması)
   */
  async refreshSession() {
    // Zaten re-login devam ediyorsa bekle
    if (this._refreshingSession) {
      logger.debug('Session refresh zaten devam ediyor, bekleniyor...');
      // Basit polling ile bekle (max 30 saniye)
      for (let i = 0; i < 30; i++) {
        await this.sleep(1000);
        if (!this._refreshingSession) return;
      }
      return;
    }

    this._refreshingSession = true;
    let page = null;

    try {
      logger.info('Session yenileniyor (Puppeteer re-login)...');
      sessionManager.clearSession();

      page = await browserManager.createPage();
      const success = await loginService.forceRelogin(page);

      if (success) {
        logger.info('Session başarıyla yenilendi');
      } else {
        logger.error('Session yenileme başarısız');
      }
    } catch (error) {
      logger.error('Session yenileme hatası', { error: error.message });
    } finally {
      if (page) {
        try {
          await page.close();
        } catch (_e) {}
      }
      this._refreshingSession = false;
    }
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export default new DocumentDownloadService();
