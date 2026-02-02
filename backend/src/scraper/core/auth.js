/**
 * Auth Service - ihalebul.com Authentication
 * Session yönetimi ve login işlemleri
 */

import { scraperConfig } from '../../config/scraper.config.js';
import { ElementNotFoundError, LoginFailedError } from '../../lib/errors.js';
import { delay } from '../../lib/utils.js';
import logger from '../../utils/logger.js';
import sessionManager from './session.js';

class AuthService {
  constructor() {
    this.config = scraperConfig.ihalebul;
    this.timeouts = scraperConfig.timeouts;
  }

  /**
   * Login yap (session restore veya fresh login)
   * @param {Page} page - Puppeteer page
   * @returns {Promise<boolean>}
   */
  async login(page) {
    const startTime = Date.now();

    logger.info('Starting login process', {
      module: 'scraper',
      action: 'auth.login',
    });

    try {
      // 1. Mevcut session'ı dene
      const session = await sessionManager.load().catch(() => null);

      if (session?.cookies) {
        logger.debug('Trying existing session', {
          module: 'scraper',
          action: 'auth.login',
          sessionId: session.id,
        });

        await sessionManager.applyCookies(page, session.cookies);

        // Test sayfasına git
        const testUrl = `${this.config.baseUrl}${this.config.searchPath}?workcategory_in=${this.config.categoryId}`;
        await page.goto(testUrl, {
          waitUntil: 'networkidle2',
          timeout: this.timeouts.navigation,
        });
        await delay(this.timeouts.pageDelay);

        // Login kontrolü
        if (await this.isLoggedIn(page)) {
          const duration = Date.now() - startTime;
          logger.info('Login successful (session restored)', {
            module: 'scraper',
            action: 'auth.login',
            method: 'session',
            duration: `${duration}ms`,
          });
          return true;
        }

        logger.debug('Session invalid, will do fresh login', {
          module: 'scraper',
          action: 'auth.login',
        });
      }

      // 2. Fresh login
      return await this.freshLogin(page);
    } catch (error) {
      if (error instanceof LoginFailedError) {
        throw error;
      }

      logger.error('Login process failed', {
        module: 'scraper',
        action: 'auth.login',
        error: error.message,
        stack: error.stack,
      });

      throw new LoginFailedError(error.message, { originalError: error.message });
    }
  }

  /**
   * Sıfırdan login yap
   * @param {Page} page - Puppeteer page
   * @returns {Promise<boolean>}
   */
  async freshLogin(page) {
    const startTime = Date.now();
    const username = process.env.IHALEBUL_USERNAME;
    const password = process.env.IHALEBUL_PASSWORD;

    if (!username || !password) {
      throw new LoginFailedError('IHALEBUL_USERNAME ve IHALEBUL_PASSWORD env değişkenleri gerekli', {
        missingEnv: true,
      });
    }

    logger.info('Starting fresh login', {
      module: 'scraper',
      action: 'auth.freshLogin',
      username,
    });

    try {
      // Ana sayfaya git
      await page.goto(this.config.baseUrl, {
        waitUntil: 'networkidle2',
        timeout: this.timeouts.navigation,
      });
      await delay(this.timeouts.pageDelay);

      // Zaten login mi kontrol et
      if (await this.isLoggedIn(page)) {
        const cookies = await page.cookies();
        await sessionManager.save(cookies, username);

        logger.info('Already logged in', {
          module: 'scraper',
          action: 'auth.freshLogin',
        });
        return true;
      }

      // Login formunu bekle
      await this.waitForLoginForm(page);

      // Kullanıcı adı input'u
      const usernameInput = await this.findInput(page, 'username');
      if (!usernameInput) {
        throw new ElementNotFoundError('username input', { step: 'findUsernameInput' });
      }

      // Kullanıcı adını yaz
      await this.fillInput(page, usernameInput, username);
      await delay(300);

      // Şifre input'u
      const passwordInput = await this.findInput(page, 'password');
      if (!passwordInput) {
        throw new ElementNotFoundError('password input', { step: 'findPasswordInput' });
      }

      // Şifreyi yaz
      await this.fillInput(page, passwordInput, password);
      await delay(500);

      // Submit
      const submitted = await this.submitForm(page);
      if (!submitted) {
        throw new LoginFailedError('Giriş butonu bulunamadı veya tıklanamadı', {
          step: 'submitForm',
        });
      }

      // Navigation'ı bekle
      try {
        await page.waitForNavigation({
          waitUntil: 'networkidle2',
          timeout: this.timeouts.navigation,
        });
      } catch (_error) {
        // Navigation olmayabilir (SPA)
      }

      await delay(3000);

      // Login başarılı mı?
      if (await this.isLoggedIn(page)) {
        const cookies = await page.cookies();
        await sessionManager.save(cookies, username);

        const duration = Date.now() - startTime;
        logger.info('Login successful (fresh)', {
          module: 'scraper',
          action: 'auth.freshLogin',
          duration: `${duration}ms`,
        });
        return true;
      }

      throw new LoginFailedError('Login başarısız - kullanıcı adı veya şifre hatalı', {
        step: 'verifyLogin',
      });
    } catch (error) {
      if (error instanceof LoginFailedError || error instanceof ElementNotFoundError) {
        throw error;
      }

      logger.error('Fresh login failed', {
        module: 'scraper',
        action: 'auth.freshLogin',
        error: error.message,
        stack: error.stack,
      });

      throw new LoginFailedError(error.message, { originalError: error.message });
    }
  }

  /**
   * Login formunun yüklenmesini bekle
   * @param {Page} page - Puppeteer page
   * @returns {Promise<void>}
   */
  async waitForLoginForm(page) {
    const formSelectors = [
      'input[placeholder*="Kullanıcı"]',
      'input[placeholder*="kullanıcı"]',
      'input[type="password"]',
    ];

    for (let i = 0; i < 10; i++) {
      for (const selector of formSelectors) {
        try {
          const element = await page.$(selector);
          if (element) {
            logger.debug('Login form found', {
              module: 'scraper',
              action: 'auth.waitForLoginForm',
              selector,
            });
            return;
          }
        } catch (_error) {
          // Ignore
        }
      }
      await delay(500);
    }

    logger.warn('Login form wait timeout', {
      module: 'scraper',
      action: 'auth.waitForLoginForm',
    });
  }

  /**
   * Input alanı bul
   * @param {Page} page - Puppeteer page
   * @param {string} type - 'username' | 'password'
   * @returns {Promise<ElementHandle|null>}
   */
  async findInput(page, type) {
    if (type === 'password') {
      const selectors = ['form input[type="password"]', '.modal input[type="password"]', 'input[type="password"]'];

      for (const sel of selectors) {
        try {
          const input = await page.$(sel);
          if (input) return input;
        } catch (_error) {
          // Ignore
        }
      }
      return null;
    }

    // Username için
    const placeholders = ['Kullanıcı adı', 'E-posta', 'Username', 'kullanıcı'];
    for (const placeholder of placeholders) {
      const selectors = [`input[placeholder="${placeholder}"]`, `input[placeholder*="${placeholder}"]`];

      for (const sel of selectors) {
        try {
          const input = await page.$(sel);
          if (input) return input;
        } catch (_error) {
          // Ignore
        }
      }
    }

    // Fallback: İlk text input
    try {
      const inputs = await page.$$('form input[type="text"], form input:not([type])');
      for (const input of inputs) {
        const isHidden = await page.evaluate((el) => {
          const style = window.getComputedStyle(el);
          return style.display === 'none' || style.visibility === 'hidden' || el.type === 'hidden';
        }, input);
        if (!isHidden) return input;
      }
    } catch (_error) {
      // Ignore
    }

    return null;
  }

  /**
   * Input'a değer yaz (DOM üzerinden)
   * @param {Page} page - Puppeteer page
   * @param {ElementHandle} input - Input element
   * @param {string} value - Yazılacak değer
   * @returns {Promise<void>}
   */
  async fillInput(page, input, value) {
    await page.evaluate(
      (el, val) => {
        el.focus();
        el.value = val;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      },
      input,
      value
    );
  }

  /**
   * Login formunu submit et
   * @param {Page} page - Puppeteer page
   * @returns {Promise<boolean>}
   */
  async submitForm(page) {
    // Önce evaluate ile dene
    const clicked = await page.evaluate(() => {
      // "Giriş" yazılı butonu bul
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        if (btn.textContent?.trim() === 'Giriş') {
          btn.click();
          return true;
        }
      }

      // Submit butonu
      const submitBtns = document.querySelectorAll('button[type="submit"], input[type="submit"]');
      if (submitBtns.length > 0) {
        submitBtns[0].click();
        return true;
      }

      // Form submit
      const forms = document.querySelectorAll('form');
      for (const form of forms) {
        if (form.querySelector('input[type="password"]')) {
          form.submit();
          return true;
        }
      }

      return false;
    });

    if (clicked) return true;

    // Fallback: Selector ile dene
    const selectors = [
      'form button[type="submit"]',
      'form input[type="submit"]',
      '.modal-body button.btn-primary',
      '.modal button[type="submit"]',
    ];

    for (const sel of selectors) {
      try {
        const btn = await page.$(sel);
        if (btn) {
          await btn.click();
          return true;
        }
      } catch (_error) {
        // Ignore
      }
    }

    return false;
  }

  /**
   * Login durumunu kontrol et
   * @param {Page} page - Puppeteer page
   * @returns {Promise<boolean>}
   */
  async isLoggedIn(page) {
    try {
      const result = await page.evaluate(() => {
        const text = document.body.innerText || '';
        const html = document.body.innerHTML?.toLowerCase() || '';

        // Maskelenmiş veri kontrolü
        const hasMaskedData = text.includes('***') || text.includes('Bu bölüm sadece aktif üye');

        // Logout butonu kontrolü
        const hasLogoutBtn = html.includes('çıkış') || html.includes('logout');

        return { hasMaskedData, hasLogoutBtn };
      });

      const isLoggedIn = result.hasLogoutBtn && !result.hasMaskedData;

      logger.debug('Login check result', {
        module: 'scraper',
        action: 'auth.isLoggedIn',
        isLoggedIn,
        hasMaskedData: result.hasMaskedData,
        hasLogoutBtn: result.hasLogoutBtn,
      });

      return isLoggedIn;
    } catch (error) {
      logger.error('Error checking login status', {
        module: 'scraper',
        action: 'auth.isLoggedIn',
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Login'i garantile (gerekirse yeniden login yap)
   * @param {Page} page - Puppeteer page
   * @returns {Promise<boolean>}
   */
  async ensureLoggedIn(page) {
    if (await this.isLoggedIn(page)) {
      return true;
    }
    return await this.login(page);
  }

  /**
   * Zorla yeniden login
   * @param {Page} page - Puppeteer page
   * @returns {Promise<boolean>}
   */
  async forceRelogin(page) {
    logger.info('Forcing re-login', {
      module: 'scraper',
      action: 'auth.forceRelogin',
    });

    await sessionManager.clear();
    return await this.freshLogin(page);
  }
}

// Singleton export
const authService = new AuthService();
export default authService;
export { AuthService };
