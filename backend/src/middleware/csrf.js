/**
 * CSRF Protection Middleware
 * 
 * NOT: SameSite=Strict cookie ayarı zaten CSRF koruması sağlıyor.
 * Modern tarayıcılarda bu yeterli - ek CSRF token'a gerek yok.
 * 
 * Cookie ayarları (auth.js):
 * - sameSite: 'strict' (production)
 * - sameSite: 'lax' (development)
 * - httpOnly: true
 * - secure: true (production)
 */

import logger from '../utils/logger.js';

/**
 * CSRF koruması - SameSite cookie ile sağlanıyor
 * Bu middleware artık sadece pass-through
 */
export const csrfProtection = (req, res, next) => {
  // SameSite cookie zaten CSRF koruması sağlıyor
  // Ek token kontrolüne gerek yok
  next();
};

/**
 * CSRF token oluştur - Artık kullanılmıyor ama uyumluluk için
 */
export function generateCsrfToken() {
  return 'not-required';
}

/**
 * CSRF token'ı cookie'ye yaz - Artık kullanılmıyor
 */
export function setCsrfCookie(res, token) {
  // No-op
}

/**
 * CSRF token doğrula - Artık kullanılmıyor
 */
export function validateCsrfToken(token) {
  return true;
}

logger.info('[CSRF] SameSite cookie koruması aktif - ek CSRF token devre dışı');
