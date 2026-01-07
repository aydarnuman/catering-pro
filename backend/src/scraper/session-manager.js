import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STORAGE_DIR = path.join(__dirname, '../../storage');
const SESSION_FILE = path.join(STORAGE_DIR, 'session.json');

// Storage klasörünü oluştur
if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

/**
 * Session Manager
 * Cookie'leri dosyaya kaydetme ve okuma
 */
class SessionManager {
  constructor() {
    this.sessionTTL = parseInt(process.env.SESSION_TTL_HOURS || '8') * 60 * 60 * 1000; // 8 saat
  }

  /**
   * Session kaydet
   */
  async saveSession(cookies, username) {
    try {
      const now = Date.now();
      const session = {
        id: `sess_${now}_${Math.random().toString(36).substring(7)}`,
        cookies: cookies,
        username: username,
        createdAt: now,
        expiresAt: now + this.sessionTTL,
        lastUsedAt: now
      };

      fs.writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2));
      console.log('💾 Session kaydedildi:', session.id);
      
      return session;
    } catch (error) {
      console.error('❌ Session kaydetme hatası:', error);
      throw error;
    }
  }

  /**
   * Session yükle
   */
  async loadSession() {
    try {
      if (!fs.existsSync(SESSION_FILE)) {
        console.log('ℹ️ Session dosyası bulunamadı');
        return null;
      }

      const data = fs.readFileSync(SESSION_FILE, 'utf8');
      const session = JSON.parse(data);

      // Expiry kontrolü
      const now = Date.now();
      if (now > session.expiresAt) {
        console.log('⏱️ Session süresi dolmuş');
        this.clearSession();
        return null;
      }

      // Son kullanım zamanını güncelle (sliding expiration)
      session.lastUsedAt = now;
      session.expiresAt = now + this.sessionTTL;
      fs.writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2));

      console.log('✅ Session yüklendi:', session.id);
      console.log(`   Kalan süre: ${Math.round((session.expiresAt - now) / (1000 * 60))} dakika`);
      
      return session;
    } catch (error) {
      console.error('❌ Session yükleme hatası:', error);
      return null;
    }
  }

  /**
   * Session sil
   */
  clearSession() {
    try {
      if (fs.existsSync(SESSION_FILE)) {
        fs.unlinkSync(SESSION_FILE);
        console.log('🗑️ Session silindi');
      }
    } catch (error) {
      console.error('❌ Session silme hatası:', error);
    }
  }

  /**
   * Session geçerli mi kontrol et
   */
  async isSessionValid() {
    const session = await this.loadSession();
    return session !== null;
  }

  /**
   * Session durumu
   */
  async getSessionStatus() {
    const session = await this.loadSession();
    
    if (!session) {
      return {
        valid: false,
        message: 'Session yok'
      };
    }

    const now = Date.now();
    const ageMinutes = Math.round((now - session.createdAt) / (1000 * 60));
    const remainingMinutes = Math.round((session.expiresAt - now) / (1000 * 60));

    return {
      valid: true,
      session: {
        id: session.id,
        username: session.username,
        ageMinutes,
        remainingMinutes,
        cookieCount: session.cookies.length
      }
    };
  }

  /**
   * Cookie'leri page'e uygula
   */
  async applyCookies(page, cookies) {
    try {
      // Önce base URL'e git (domain validation için)
      await page.goto('https://www.ihalebul.com', {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      // Cookie'leri ayarla
      await page.setCookie(...cookies);
      
      console.log(`🍪 ${cookies.length} cookie uygulandı`);
      
      return true;
    } catch (error) {
      console.error('❌ Cookie uygulama hatası:', error);
      return false;
    }
  }
}

// Singleton instance
const sessionManager = new SessionManager();

export default sessionManager;
