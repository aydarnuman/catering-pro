import browserManager from './browser-manager.js';
import sessionManager from './session-manager.js';

const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_URL = 'https://www.ihalebul.com/signin';

/**
 * Login Service
 * ihalebul.com login mantığı
 */
class LoginService {
  /**
   * Login yap
   */
  async performLogin(page) {
    const username = process.env.IHALEBUL_USERNAME;
    const password = process.env.IHALEBUL_PASSWORD;

    if (!username || !password) {
      throw new Error('IHALEBUL_USERNAME ve IHALEBUL_PASSWORD gerekli!');
    }

    console.log('🔐 Login işlemi başlıyor...');

    for (let attempt = 1; attempt <= MAX_LOGIN_ATTEMPTS; attempt++) {
      try {
        console.log(`🔄 Deneme ${attempt}/${MAX_LOGIN_ATTEMPTS}`);

        // Login sayfasına git
        await page.goto(LOGIN_URL, {
          waitUntil: 'networkidle2',
          timeout: 30000
        });

        await this.delay(2000);

        // Form bul, doldur ve submit et - TEK İŞLEMDE!
        const formSuccess = await this.fillAndSubmitLoginForm(page, username, password);
        
        if (!formSuccess) {
          throw new Error('Login formu bulunamadı veya doldurulumadı!');
        }

        // Navigation bekle
        try {
          await page.waitForNavigation({
            waitUntil: 'networkidle2',
            timeout: 15000
          });
        } catch (navError) {
          console.log('⚠️ Navigation timeout, sayfa kontrol ediliyor...');
        }

        await this.delay(3000);

        // ÖNEMLİ: Kategori sayfasına git ve ORADA doğrula!
        console.log('🔍 Kategori sayfasında login kontrol ediliyor...');
        try {
          await page.goto('https://www.ihalebul.com/tenders/search?workcategory_in=15', {
            waitUntil: 'networkidle2',
            timeout: 30000
          });
          await this.delay(2000);
        } catch (e) {
          console.log('⚠️ Kategori sayfası yüklenemedi:', e.message);
        }

        // Kategori sayfasında login doğrula
        const isLoggedIn = await this.verifyLogin(page);

        if (isLoggedIn) {
          console.log('✅ Login başarılı! (Kategori erişimi OK)');

          // Cookie'leri kaydet
          const cookies = await page.cookies();
          await sessionManager.saveSession(cookies, username);

          return {
            success: true,
            cookies: cookies
          };
        }

        console.log(`❌ Login doğrulanamadı (deneme ${attempt}) - Kategori erişimi yok`);

        // Bir sonraki deneme için bekle (artan bekleme)
        if (attempt < MAX_LOGIN_ATTEMPTS) {
          const waitTime = attempt * 3000;
          console.log(`⏳ ${waitTime / 1000}s bekleniyor...`);
          await this.delay(waitTime);
        }

      } catch (error) {
        console.error(`❌ Login hatası (deneme ${attempt}):`, error.message);
        
        if (attempt < MAX_LOGIN_ATTEMPTS) {
          const waitTime = attempt * 3000;
          await this.delay(waitTime);
        }
      }
    }

    throw new Error(`LOGIN FAILED after ${MAX_LOGIN_ATTEMPTS} attempts`);
  }

  /**
   * Login formu bul, doldur ve submit et - TEK İŞLEMDE!
   */
  async fillAndSubmitLoginForm(page, username, password) {
    try {
      const result = await page.evaluate((user, pass) => {
        const forms = document.querySelectorAll('form');
        
        // 1. FORM BUL: Önce main içindeki, yoksa son form
        let targetForm = document.querySelector('main form');
        if (!targetForm && forms.length > 0) {
          targetForm = forms[forms.length - 1];
        }
        
        if (!targetForm) {
          return { success: false, error: 'Form bulunamadı' };
        }
        
        // 2. USERNAME INPUT BUL VE DOLDUR
        const userInputs = targetForm.querySelectorAll(
          'input[placeholder="Kullanıcı adı"], input[type="text"]:not([type="hidden"])'
        );
        const userInput = userInputs[0];
        
        if (userInput) {
          userInput.value = '';
          userInput.value = user;
          userInput.dispatchEvent(new Event('input', { bubbles: true }));
          userInput.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          return { success: false, error: 'Username input bulunamadı' };
        }
        
        // 3. PASSWORD INPUT BUL VE DOLDUR
        const passInputs = targetForm.querySelectorAll(
          'input[placeholder="Şifre"], input[type="password"]'
        );
        const passInput = passInputs[0];
        
        if (passInput) {
          passInput.value = '';
          passInput.value = pass;
          passInput.dispatchEvent(new Event('input', { bubbles: true }));
          passInput.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          return { success: false, error: 'Password input bulunamadı' };
        }
        
        // 4. SUBMIT - Sırayla dene
        // 4a. "Giriş" text'li buton
        const buttons = targetForm.querySelectorAll('button');
        for (const btn of buttons) {
          const text = btn.textContent || btn.innerText;
          if (text.includes('Giriş')) {
            btn.click();
            return { success: true, method: 'button-text-click' };
          }
        }
        
        // 4b. Submit tipi buton
        const submitBtn = targetForm.querySelector('button[type="submit"]');
        if (submitBtn) {
          submitBtn.click();
          return { success: true, method: 'submit-button-click' };
        }
        
        // 4c. Form submit
        targetForm.submit();
        return { success: true, method: 'form-submit' };
        
      }, username, password);
      
      if (result.success) {
        console.log(`✅ Form dolduruldu ve submit edildi (${result.method})`);
        return true;
      } else {
        console.error(`❌ Form hatası: ${result.error}`);
        return false;
      }
      
    } catch (error) {
      console.error('❌ Form işlemi hatası:', error.message);
      return false;
    }
  }

  /**
   * Login doğrula
   */
  async verifyLogin(page) {
    try {
      const url = page.url();
      const content = await page.content();

      // 1. URL kontrolü (login sayfasında değilse OK)
      if (!url.includes('/signin') && !url.includes('/login')) {
        console.log('✅ URL kontrolü başarılı');
      }

      // 2. Çıkış linki var mı?
      const hasLogout = content.match(/Çıkış|çıkış|cikis/i);
      if (hasLogout) {
        console.log('✅ Çıkış linki bulundu');
      }

      // 3. Kullanıcı menüsü var mı?
      const hasUserMenu = content.match(/Bildirimler|Bültenlerim/i);
      if (hasUserMenu) {
        console.log('✅ Kullanıcı menüsü bulundu');
      }

      // 4. Maskelenmiş veri YOK mu?
      const maskedPatterns = [
        /\*\*\* \*\*\* \*\*\*/,
        /Kayıt no[\s\n]*\d+\/\d*\*\*\*/,
        /İhale başlığı[\s\n]*\*\*\*/,
        /İşin adı[\s\n]*\*\*\*/,
        /İdare adı[\s\n]*\*\*\*/,
        /Bu bölüm sadece aktif üye kullanımına açıktır/
      ];

      const hasMaskedData = maskedPatterns.some(pattern => pattern.test(content));

      if (hasMaskedData) {
        console.log('❌ Maskelenmiş veri tespit edildi');
        
        // Aktif üye uyarısı varsa özel mesaj
        if (/Bu bölüm sadece aktif üye|AKTİF ÜYE/i.test(content)) {
          console.log('⚠️ AKTİF ÜYE UYARISI TESPİT EDİLDİ!');
          console.log('⚠️ Bu hesap aktif üye değil veya kategori erişimi yok');
        }
        
        return false;
      }

      console.log('✅ Maskelenmiş veri yok');

      // En az bir pozitif kontrol geçmişse başarılı
      if (hasLogout || hasUserMenu || !url.includes('/signin')) {
        return true;
      }

      return false;

    } catch (error) {
      console.error('❌ Login doğrulama hatası:', error);
      return false;
    }
  }

  /**
   * Sayfada login durumu kontrol et
   */
  async isLoggedIn(page) {
    try {
      return await this.verifyLogin(page);
    } catch (error) {
      return false;
    }
  }

  /**
   * Session restore veya login
   */
  async ensureLoggedIn(page) {
    console.log('🔍 Login durumu kontrol ediliyor...');

    // Önce session restore dene
    const session = await sessionManager.loadSession();

    if (session && session.cookies) {
      console.log('🔄 Session restore ediliyor...');

      // Cookie'leri uygula - AMA SAYFAYA GİTME!
      await sessionManager.applyCookies(page, session.cookies);

      console.log('✅ Session cookieleri yuklendi');
      return { success: true, method: 'session_restore' };
    }

    // Fresh login
    const result = await this.performLogin(page);
    return { ...result, method: 'fresh_login' };
  }

  /**
   * Force re-login
   */
  async forceRelogin(page) {
    console.log('🔄 Force re-login...');
    sessionManager.clearSession();
    return await this.performLogin(page);
  }

  /**
   * Delay helper
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
const loginService = new LoginService();

export default loginService;
