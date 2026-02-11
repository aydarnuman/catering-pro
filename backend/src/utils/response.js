/**
 * API Response Helper
 * Tüm endpoint'lerde tutarlı response formatı sağlar.
 *
 * Standart format:
 *   Başarılı: { success: true, data: ..., message?: '...' }
 *   Hata:     { success: false, error: '...' }
 */

/**
 * Başarılı response döndürür
 * @param {object} res - Express response
 * @param {*} data - Döndürülecek veri
 * @param {string} [message] - Opsiyonel mesaj
 * @param {number} [status=200] - HTTP status kodu
 */
export function ok(res, data, message, status = 200) {
  const body = { success: true };
  if (data !== undefined) body.data = data;
  if (message) body.message = message;
  return res.status(status).json(body);
}

/**
 * Oluşturuldu response döndürür (201)
 * @param {object} res - Express response
 * @param {*} data - Döndürülecek veri
 * @param {string} [message] - Opsiyonel mesaj
 */
export function created(res, data, message) {
  return ok(res, data, message, 201);
}

/**
 * Hata response döndürür
 * @param {object} res - Express response
 * @param {string} error - Hata mesajı
 * @param {number} [status=400] - HTTP status kodu
 */
export function fail(res, error, status = 400) {
  return res.status(status).json({ success: false, error });
}

/**
 * Sunucu hatası response döndürür (500)
 * @param {object} res - Express response
 * @param {Error|string} error - Hata objesi veya mesajı
 */
export function serverError(res, error) {
  const message = error instanceof Error ? error.message : error;
  return res.status(500).json({ success: false, error: message });
}

/**
 * 404 Not Found response döndürür
 * @param {object} res - Express response
 * @param {string} [message='Bulunamadı'] - Hata mesajı
 */
export function notFound(res, message = 'Bulunamadı') {
  return res.status(404).json({ success: false, error: message });
}

/**
 * 401 Unauthorized response döndürür
 * @param {object} res - Express response
 * @param {string} [message='Yetkilendirme gerekli'] - Hata mesajı
 */
export function unauthorized(res, message = 'Yetkilendirme gerekli') {
  return res.status(401).json({ success: false, error: message });
}

/**
 * 403 Forbidden response döndürür
 * @param {object} res - Express response
 * @param {string} [message='Erişim reddedildi'] - Hata mesajı
 */
export function forbidden(res, message = 'Erişim reddedildi') {
  return res.status(403).json({ success: false, error: message });
}
