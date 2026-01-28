import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Şifreleme için anahtar (production'da env'den alınmalı)
const ENCRYPTION_KEY = process.env.UYUMSOFT_ENCRYPTION_KEY || 'uyumsoft-catering-secret-key32!!';
const IV_LENGTH = 16;

/**
 * Metni şifrele
 */
function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Şifrelenmiş metni çöz
 */
function decrypt(text) {
  try {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (_err) {
    return null;
  }
}

/**
 * Uyumsoft Session Yöneticisi
 * - Şifreli credentials
 * - Cookie yönetimi
 * - Sync takibi
 */
class UyumsoftSession {
  constructor(sessionPath) {
    this.sessionPath = sessionPath || path.join(__dirname, '../../../storage/uyumsoft-session.json');
    this.cookiePath = this.sessionPath.replace('.json', '-cookies.json');
    this.syncPath = this.sessionPath.replace('.json', '-sync.json');
    this.ensureStorageDir();
  }

  ensureStorageDir() {
    const dir = path.dirname(this.sessionPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  // ==================== CREDENTIALS ====================

  /**
   * Credentials kaydet (şifreli)
   */
  saveCredentials(username, password) {
    try {
      const data = {
        username: encrypt(username),
        password: encrypt(password),
        savedAt: new Date().toISOString(),
      };
      fs.writeFileSync(this.sessionPath, JSON.stringify(data, null, 2));
      console.log('💾 [UyumsoftSession] Credentials kaydedildi');
      return true;
    } catch (error) {
      console.error('❌ Credentials kaydetme hatası:', error.message);
      return false;
    }
  }

  /**
   * Credentials yükle
   * Öncelik: env (UYUMSOFT_USERNAME, UYUMSOFT_PASSWORD) → storage dosyası
   */
  loadCredentials() {
    const envUser = process.env.UYUMSOFT_USERNAME?.trim();
    const envPass = process.env.UYUMSOFT_PASSWORD;
    if (envUser && envPass) {
      return {
        username: envUser,
        password: envPass,
        savedAt: 'env',
      };
    }
    try {
      if (!fs.existsSync(this.sessionPath)) {
        return null;
      }
      const data = JSON.parse(fs.readFileSync(this.sessionPath, 'utf8'));
      const username = decrypt(data.username);
      const password = decrypt(data.password);
      if (!username || !password) {
        console.warn('⚠️ Credentials decrypt edilemedi');
        return null;
      }
      return {
        username,
        password,
        savedAt: data.savedAt,
      };
    } catch (error) {
      console.error('❌ Credentials yükleme hatası:', error.message);
      return null;
    }
  }

  /**
   * Credentials sil
   */
  deleteCredentials() {
    try {
      if (fs.existsSync(this.sessionPath)) {
        fs.unlinkSync(this.sessionPath);
        console.log('🗑️ [UyumsoftSession] Credentials silindi');
      }
      return true;
    } catch (error) {
      console.error('❌ Credentials silme hatası:', error.message);
      return false;
    }
  }

  /**
   * Credentials var mı kontrol et (env veya storage)
   */
  hasCredentials() {
    if (process.env.UYUMSOFT_USERNAME?.trim() && process.env.UYUMSOFT_PASSWORD) {
      return true;
    }
    return fs.existsSync(this.sessionPath);
  }

  // ==================== COOKIES ====================

  /**
   * Browser cookies kaydet
   */
  saveCookies(cookies) {
    try {
      const data = {
        cookies,
        savedAt: new Date().toISOString(),
        count: cookies.length,
      };
      fs.writeFileSync(this.cookiePath, JSON.stringify(data, null, 2));
      console.log(`💾 [UyumsoftSession] ${cookies.length} cookie kaydedildi`);
      return true;
    } catch (error) {
      console.error('❌ Cookie kaydetme hatası:', error.message);
      return false;
    }
  }

  /**
   * Browser cookies yükle
   */
  loadCookies() {
    try {
      if (!fs.existsSync(this.cookiePath)) {
        return null;
      }
      const data = JSON.parse(fs.readFileSync(this.cookiePath, 'utf8'));
      return data.cookies || null;
    } catch (error) {
      console.error('❌ Cookie yükleme hatası:', error.message);
      return null;
    }
  }

  /**
   * Cookie yaşını al (ms)
   */
  getCookieAge() {
    try {
      if (!fs.existsSync(this.cookiePath)) {
        return Infinity;
      }
      const data = JSON.parse(fs.readFileSync(this.cookiePath, 'utf8'));
      if (!data.savedAt) {
        return Infinity;
      }
      const savedDate = new Date(data.savedAt);
      return Date.now() - savedDate.getTime();
    } catch (_err) {
      return Infinity;
    }
  }

  /**
   * Cookie'ler geçerli mi (yaş kontrolü)
   * @param {number} maxAge - Maximum yaş (ms), varsayılan 24 saat
   */
  areCookiesValid(maxAge = 24 * 60 * 60 * 1000) {
    const age = this.getCookieAge();
    return age < maxAge;
  }

  /**
   * Cookie'leri sil
   */
  deleteCookies() {
    try {
      if (fs.existsSync(this.cookiePath)) {
        fs.unlinkSync(this.cookiePath);
        console.log('🗑️ [UyumsoftSession] Cookie\'ler silindi');
      }
      return true;
    } catch (error) {
      console.error('❌ Cookie silme hatası:', error.message);
      return false;
    }
  }

  // ==================== SYNC TRACKING ====================

  /**
   * Son sync tarihini kaydet
   */
  saveLastSync(date, faturaCount = 0) {
    try {
      const existingData = this.getSyncData();
      const data = {
        lastSync: date || new Date().toISOString(),
        syncCount: (existingData?.syncCount || 0) + 1,
        lastFaturaCount: faturaCount,
        history: [
          {
            date: new Date().toISOString(),
            faturaCount,
          },
          ...(existingData?.history || []).slice(0, 9), // Son 10 sync
        ],
      };
      fs.writeFileSync(this.syncPath, JSON.stringify(data, null, 2));
      console.log(`💾 [UyumsoftSession] Sync kaydedildi (#${data.syncCount})`);
      return true;
    } catch (error) {
      console.error('❌ Sync kaydetme hatası:', error.message);
      return false;
    }
  }

  /**
   * Sync verisini al
   */
  getSyncData() {
    try {
      if (!fs.existsSync(this.syncPath)) {
        return null;
      }
      return JSON.parse(fs.readFileSync(this.syncPath, 'utf8'));
    } catch (_err) {
      return null;
    }
  }

  /**
   * Son sync tarihini al
   */
  getLastSync() {
    const data = this.getSyncData();
    return data?.lastSync || null;
  }

  /**
   * Toplam sync sayısını al
   */
  getSyncCount() {
    const data = this.getSyncData();
    return data?.syncCount || 0;
  }

  // ==================== UTILITIES ====================

  /**
   * Tüm session verilerini temizle
   */
  clearAll() {
    this.deleteCredentials();
    this.deleteCookies();
    console.log('🗑️ [UyumsoftSession] Tüm veriler temizlendi');
  }

  /**
   * Session durumu özeti
   */
  getStatus() {
    const credentials = this.hasCredentials();
    const cookies = this.loadCookies();
    const cookieAge = this.getCookieAge();
    const lastSync = this.getLastSync();
    const syncCount = this.getSyncCount();

    return {
      hasCredentials: credentials,
      hasCookies: !!cookies,
      cookieCount: cookies?.length || 0,
      cookieAgeHours: Math.round(cookieAge / (60 * 60 * 1000) * 10) / 10,
      cookiesValid: this.areCookiesValid(),
      lastSync,
      syncCount,
    };
  }
}

export default UyumsoftSession;
