/**
 * Login Service - ihalebul.com Authentication
 * Session yönetimi ve login işlemleri
 */

import sessionManager from './session-manager.js';

const LOGIN_URL = 'https://www.ihalebul.com/signin';
const TEST_URL = 'https://www.ihalebul.com/tenders/search?workcategory_in=15';

class LoginService {
  /**
   * Login yap (session restore veya fresh login)
   */
  async performLogin(page) {
    console.log('🔐 Login işlemi başlıyor...');

    // 1. Mevcut session'ı dene
    const session = await sessionManager.loadSession();
    if (session && session.cookies) {
      console.log('📦 Kayıtlı session deneniyor...');
      await sessionManager.applyCookies(page, session.cookies);

      // Test sayfasına git
      await page.goto(TEST_URL, { waitUntil: 'networkidle2', timeout: 30000 });
      await this.delay(2000);

      // Login kontrolü
      if (await this.isLoggedIn(page)) {
        console.log('✅ Session ile login başarılı');
        return true;
      }
      console.log('⚠️ Session geçersiz, fresh login yapılacak');
    }

    // 2. Fresh login
    return await this.freshLogin(page);
  }

  /**
   * Sıfırdan login yap
   */
  async freshLogin(page) {
    const username = process.env.IHALEBUL_USERNAME;
    const password = process.env.IHALEBUL_PASSWORD;

    if (!username || !password) {
      throw new Error('IHALEBUL_USERNAME ve IHALEBUL_PASSWORD env değişkenleri gerekli');
    }

    console.log('🔑 Fresh login yapılıyor...');

    // Login sayfasına git
    await page.goto(LOGIN_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await this.delay(2000);

    // Form doldur
    await page.type('input[name="username"], input[type="email"], #username, #email', username, { delay: 50 });
    await page.type('input[name="password"], input[type="password"], #password', password, { delay: 50 });

    // Submit
    await Promise.all([
      page.click('button[type="submit"], input[type="submit"], .btn-login, #login-btn'),
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 })
    ]);

    await this.delay(3000);

    // Login başarılı mı?
    if (await this.isLoggedIn(page)) {
      // Cookie'leri kaydet
      const cookies = await page.cookies();
      await sessionManager.saveSession(cookies, username);
      console.log('✅ Fresh login başarılı');
      return true;
    }

    throw new Error('Login başarısız - kullanıcı adı veya şifre hatalı');
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
    } catch (error) {
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
    console.log('🔄 Force re-login yapılıyor...');
    sessionManager.clearSession();
    return await this.freshLogin(page);
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default new LoginService();
