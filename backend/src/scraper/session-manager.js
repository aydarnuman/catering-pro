/**
 * Session Manager - Cookie Saklama
 * Login session'ını dosyada saklar
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SESSION_FILE = path.join(__dirname, '../../storage/session.json');

class SessionManager {
  constructor() {
    this.sessionTTL = parseInt(process.env.SESSION_TTL_HOURS || '8') * 60 * 60 * 1000; // 8 saat
  }

  /**
   * Session'ı kaydet
   */
  async saveSession(cookies, username) {
    const session = {
      id: `sess_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      cookies,
      username,
      createdAt: Date.now(),
      expiresAt: Date.now() + this.sessionTTL,
      lastUsedAt: Date.now()
    };

    // Klasörü oluştur
    const dir = path.dirname(SESSION_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2));
    console.log(`✅ Session kaydedildi: ${session.id}`);
    return session;
  }

  /**
   * Session'ı yükle
   */
  async loadSession() {
    try {
      if (!fs.existsSync(SESSION_FILE)) {
        return null;
      }

      const data = fs.readFileSync(SESSION_FILE, 'utf8');
      const session = JSON.parse(data);

      // Süre kontrolü
      if (Date.now() > session.expiresAt) {
        console.log('⚠️ Session süresi dolmuş');
        this.clearSession();
        return null;
      }

      // lastUsedAt güncelle
      session.lastUsedAt = Date.now();
      fs.writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2));

      return session;
    } catch (error) {
      console.error('❌ Session yükleme hatası:', error.message);
      return null;
    }
  }

  /**
   * Session'ı sil
   */
  clearSession() {
    try {
      if (fs.existsSync(SESSION_FILE)) {
        fs.unlinkSync(SESSION_FILE);
        console.log('🗑️ Session silindi');
      }
    } catch (error) {
      console.error('❌ Session silme hatası:', error.message);
    }
  }

  /**
   * Session geçerli mi?
   */
  async isSessionValid() {
    const session = await this.loadSession();
    return session !== null && session.cookies && session.cookies.length > 0;
  }

  /**
   * Cookie'leri sayfaya uygula
   */
  async applyCookies(page, cookies) {
    if (cookies && cookies.length > 0) {
      await page.setCookie(...cookies);
      console.log(`🍪 ${cookies.length} cookie uygulandı`);
    }
  }
}

export default new SessionManager();
