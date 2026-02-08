/**
 * ihalebul.com Login Service - Authentication
 * Session yönetimi ve login işlemleri
 *
 * NOT: ihalebul.com login formu modal olarak açılıyor, ayrı sayfa yok
 */

import sessionManager from './ihalebul-cookie.js';

const HOME_URL = 'https://www.ihalebul.com/';
const TEST_URL = 'https://www.ihalebul.com/tenders/search?workcategory_in=15';

class LoginService {
  /**
   * Login yap (session restore veya fresh login)
   */
  async performLogin(page) {
    // 1. Mevcut session'ı dene
    const session = await sessionManager.loadSession();
    if (session?.cookies) {
      await sessionManager.applyCookies(page, session.cookies);

      // Test sayfasına git
      await page.goto(TEST_URL, { waitUntil: 'networkidle2', timeout: 30000 });
      await this.delay(2000);

      // Login kontrolü
      if (await this.isLoggedIn(page)) {
        return true;
      }
    }

    // 2. Fresh login
    return await this.freshLogin(page);
  }

  /**
   * Sıfırdan login yap
   * ihalebul.com'da login modal olarak açılıyor
   */
  async freshLogin(page) {
    const username = process.env.IHALEBUL_USERNAME;
    const password = process.env.IHALEBUL_PASSWORD;

    if (!username || !password) {
      throw new Error('IHALEBUL_USERNAME ve IHALEBUL_PASSWORD env değişkenleri gerekli');
    }

    // Ana sayfaya git
    await page.goto(HOME_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await this.delay(2000);

    // Login formunu bul - ihalebul.com'da form header dropdown içinde
    // Önce mevcut login durumunu kontrol et
    const alreadyLoggedIn = await this.isLoggedIn(page);
    if (alreadyLoggedIn) {
      const cookies = await page.cookies();
      await sessionManager.saveSession(cookies, username);
      return true;
    }

    // Kullanıcı adı input'u - doğrudan selector ile bekle
    try {
      await page.waitForSelector('input[placeholder="Kullanıcı adı"]', { timeout: 5000, visible: true });
    } catch (_e) {}

    // Kullanıcı adı input'u
    const usernameInput = await this.findInputByPlaceholder(
      page,
      ['Kullanıcı adı', 'E-posta', 'Username', 'kullanıcı'],
      false
    );
    if (!usernameInput) {
      throw new Error('Kullanıcı adı input alanı bulunamadı');
    }

    // Input'u focus yap ve yaz - evaluate ile doğrudan DOM'a eriş
    await page.evaluate(
      (el, val) => {
        el.focus();
        el.value = val;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      },
      usernameInput,
      username
    );

    await this.delay(300);

    // Şifre input'u
    const passwordInput = await this.findInputByPlaceholder(page, ['Şifre', 'Password', 'Parola'], true);
    if (!passwordInput) {
      throw new Error('Şifre input alanı bulunamadı');
    }

    // Şifreyi doğrudan DOM üzerinden yaz
    await page.evaluate(
      (el, val) => {
        el.focus();
        el.value = val;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      },
      passwordInput,
      password
    );

    await this.delay(500);

    // Önce butonu bul ve tıkla
    const submitClicked = await page.evaluate(() => {
      // Form içindeki Giriş butonunu bul
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        if (btn.textContent && btn.textContent.trim() === 'Giriş') {
          btn.click();
          return true;
        }
      }

      // Submit butonunu bul
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

    if (!submitClicked) {
      // Fallback: findSubmitButton ile dene
      const submitButton = await this.findSubmitButton(page);
      if (submitButton) {
        await submitButton.click();
      } else {
        throw new Error('Giriş butonu bulunamadı');
      }
    }

    // Navigation'ı bekle
    try {
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 });
    } catch (_e) {}

    await this.delay(3000);

    // Login başarılı mı?
    if (await this.isLoggedIn(page)) {
      // Cookie'leri kaydet
      const cookies = await page.cookies();
      await sessionManager.saveSession(cookies, username);
      return true;
    }

    throw new Error('Login başarısız - kullanıcı adı veya şifre hatalı');
  }

  /**
   * Placeholder veya label ile input bul
   */
  async findInputByPlaceholder(page, placeholders, isPassword = false) {
    // Şifre alanı için doğrudan password type ara
    if (isPassword) {
      const pwdSelectors = ['form input[type="password"]', '.modal input[type="password"]', 'input[type="password"]'];
      for (const sel of pwdSelectors) {
        try {
          const input = await page.$(sel);
          if (input) {
            return input;
          }
        } catch (_e) {}
      }
    }

    // Placeholder ile ara
    for (const placeholder of placeholders) {
      try {
        // Case-insensitive placeholder match
        const selectors = [
          `input[placeholder="${placeholder}"]`,
          `input[placeholder*="${placeholder}"]`,
          `input[aria-label*="${placeholder}"]`,
        ];

        for (const sel of selectors) {
          try {
            const input = await page.$(sel);
            if (input) {
              return input;
            }
          } catch (_e) {}
        }
      } catch (_e) {}
    }

    // XPath ile ara (daha esnek)
    for (const placeholder of placeholders) {
      try {
        const [input] = await page.$x(`//input[contains(@placeholder, "${placeholder}")]`);
        if (input) {
          return input;
        }
      } catch (_e) {}
    }

    // Fallback: Form içindeki tüm text input'ları bul
    if (!isPassword) {
      const inputs = await page.$$(
        'form input[type="text"], form input:not([type]):not([type="hidden"]):not([type="password"])'
      );
      // Hidden olmayan ilk input'u döndür
      for (const input of inputs) {
        const isHidden = await page.evaluate((el) => {
          const style = window.getComputedStyle(el);
          return style.display === 'none' || style.visibility === 'hidden' || el.type === 'hidden';
        }, input);
        if (!isHidden) {
          return input;
        }
      }
    }

    return null;
  }

  /**
   * Giriş/Submit butonunu bul
   */
  async findSubmitButton(page) {
    const selectors = [
      'form button[type="submit"]',
      'form input[type="submit"]',
      'form button:has-text("Giriş")',
      '.modal-body button.btn-primary',
      '.modal button[type="submit"]',
      'button.login-btn',
      '#login-btn',
    ];

    for (const selector of selectors) {
      try {
        const element = await page.$(selector);
        if (element) return element;
      } catch (_e) {}
    }

    // Fallback: "Giriş" yazısı içeren butonu bul
    const button = await page.evaluateHandle(() => {
      const buttons = document.querySelectorAll('button, input[type="submit"]');
      for (const btn of buttons) {
        if (btn.textContent?.includes('Giriş')) {
          return btn;
        }
        if (btn.value?.includes('Giriş')) {
          return btn;
        }
      }
      return null;
    });

    if (button?.asElement()) {
      return button.asElement();
    }

    return null;
  }

  /**
   * Login durumunu kontrol et
   */
  async isLoggedIn(page) {
    try {
      // Maskelenmiş veri var mı kontrol et
      const hasMaskedData = await page.evaluate(() => {
        const text = document.body.innerText;
        return text.includes('***') || text.includes('Bu bölüm sadece aktif üye');
      });

      if (hasMaskedData) {
        return false;
      }

      // Logout butonu var mı?
      const hasLogoutBtn = await page.evaluate(() => {
        const text = document.body.innerHTML.toLowerCase();
        return text.includes('çıkış') || text.includes('logout') || text.includes('signout');
      });

      return hasLogoutBtn;
    } catch (_error) {
      return false;
    }
  }

  /**
   * Login'i garantile (gerekirse yeniden login yap)
   */
  async ensureLoggedIn(page) {
    if (await this.isLoggedIn(page)) {
      return true;
    }
    return await this.performLogin(page);
  }

  /**
   * Zorla yeniden login
   */
  async forceRelogin(page) {
    sessionManager.clearSession();
    return await this.freshLogin(page);
  }

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export default new LoginService();
