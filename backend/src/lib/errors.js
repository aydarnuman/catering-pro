/**
 * Custom Error Classes
 * Tüm modüller için standart hata sınıfları
 */

/**
 * Base Application Error
 * Tüm custom error'ların temel sınıfı
 */
export class AppError extends Error {
  constructor(message, code, context = {}) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.context = context;
    this.timestamp = new Date().toISOString();
    this.isOperational = true; // Beklenen hata, crash gerekmez

    // Stack trace'i düzgün yakala
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }
}

// ============================================
// SCRAPER ERRORS
// ============================================

/**
 * Scraper Error
 * Genel scraper hatası
 */
export class ScraperError extends AppError {
  constructor(message, code = 'SCRAPER_ERROR', context = {}) {
    super(message, code, context);
    this.name = 'ScraperError';
  }
}

/**
 * Session Expired Error
 * ihalebul.com session süresi dolduğunda
 */
export class SessionExpiredError extends ScraperError {
  constructor(context = {}) {
    super('Session expired, re-login required', 'SESSION_EXPIRED', context);
    this.name = 'SessionExpiredError';
  }
}

/**
 * Login Failed Error
 * Login işlemi başarısız olduğunda
 */
export class LoginFailedError extends ScraperError {
  constructor(reason, context = {}) {
    super(`Login failed: ${reason}`, 'LOGIN_FAILED', context);
    this.name = 'LoginFailedError';
  }
}

/**
 * Page Load Error
 * Sayfa yüklenemediğinde
 */
export class PageLoadError extends ScraperError {
  constructor(url, reason, context = {}) {
    super(`Page load failed for ${url}: ${reason}`, 'PAGE_LOAD_FAILED', { url, ...context });
    this.name = 'PageLoadError';
  }
}

/**
 * Element Not Found Error
 * Beklenen element bulunamadığında
 */
export class ElementNotFoundError extends ScraperError {
  constructor(selector, context = {}) {
    super(`Element not found: ${selector}`, 'ELEMENT_NOT_FOUND', { selector, ...context });
    this.name = 'ElementNotFoundError';
  }
}

/**
 * Masked Data Error
 * Maskelenmiş veri algılandığında (login sorunu)
 */
export class MaskedDataError extends ScraperError {
  constructor(maskedRatio, context = {}) {
    super(`Masked data detected (${Math.round(maskedRatio * 100)}%)`, 'MASKED_DATA', {
      maskedRatio,
      ...context,
    });
    this.name = 'MaskedDataError';
  }
}

// ============================================
// DOCUMENT ERRORS
// ============================================

/**
 * Document Error
 * Genel döküman hatası
 */
export class DocumentError extends AppError {
  constructor(message, code = 'DOCUMENT_ERROR', context = {}) {
    super(message, code, context);
    this.name = 'DocumentError';
  }
}

/**
 * Document Download Error
 * Döküman indirme hatası
 */
export class DocumentDownloadError extends DocumentError {
  constructor(url, reason, context = {}) {
    super(`Download failed: ${reason}`, 'DOWNLOAD_FAILED', { url, ...context });
    this.name = 'DocumentDownloadError';
  }
}

/**
 * Storage Upload Error
 * Supabase Storage yükleme hatası
 */
export class StorageUploadError extends DocumentError {
  constructor(path, reason, context = {}) {
    super(`Storage upload failed: ${reason}`, 'STORAGE_UPLOAD_FAILED', { path, ...context });
    this.name = 'StorageUploadError';
  }
}

/**
 * Extraction Error
 * ZIP/RAR açma hatası
 */
export class ExtractionError extends DocumentError {
  constructor(filename, reason, context = {}) {
    super(`Extraction failed for ${filename}: ${reason}`, 'EXTRACTION_FAILED', {
      filename,
      ...context,
    });
    this.name = 'ExtractionError';
  }
}

/**
 * File Type Error
 * Desteklenmeyen dosya türü
 */
export class FileTypeError extends DocumentError {
  constructor(fileType, context = {}) {
    super(`Unsupported file type: ${fileType}`, 'UNSUPPORTED_FILE_TYPE', { fileType, ...context });
    this.name = 'FileTypeError';
  }
}

/**
 * File Size Error
 * Dosya boyutu limiti aşıldı
 */
export class FileSizeError extends DocumentError {
  constructor(size, maxSize, context = {}) {
    super(`File size ${size} exceeds limit ${maxSize}`, 'FILE_SIZE_EXCEEDED', {
      size,
      maxSize,
      ...context,
    });
    this.name = 'FileSizeError';
  }
}

// ============================================
// AI ANALYSIS ERRORS
// ============================================

/**
 * Analysis Error
 * Genel analiz hatası
 */
export class AnalysisError extends AppError {
  constructor(message, code = 'ANALYSIS_ERROR', context = {}) {
    super(message, code, context);
    this.name = 'AnalysisError';
  }
}

/**
 * AI API Error
 * Claude/Gemini API hatası
 */
export class AIApiError extends AnalysisError {
  constructor(provider, reason, context = {}) {
    super(`${provider} API error: ${reason}`, 'AI_API_ERROR', { provider, ...context });
    this.name = 'AIApiError';
  }
}

/**
 * Parse Error
 * AI yanıtı parse edilemedi
 */
export class AIParseError extends AnalysisError {
  constructor(reason, context = {}) {
    super(`Failed to parse AI response: ${reason}`, 'AI_PARSE_ERROR', context);
    this.name = 'AIParseError';
  }
}

/**
 * Queue Error
 * Analiz kuyruğu hatası
 */
export class QueueError extends AnalysisError {
  constructor(documentId, reason, context = {}) {
    super(`Queue processing failed for document ${documentId}: ${reason}`, 'QUEUE_ERROR', {
      documentId,
      ...context,
    });
    this.name = 'QueueError';
  }
}

// ============================================
// DATABASE ERRORS
// ============================================

/**
 * Database Error
 * Veritabanı hatası
 */
export class DatabaseError extends AppError {
  constructor(operation, reason, context = {}) {
    super(`Database ${operation} failed: ${reason}`, 'DATABASE_ERROR', { operation, ...context });
    this.name = 'DatabaseError';
  }
}

/**
 * Not Found Error
 * Kayıt bulunamadı
 */
export class NotFoundError extends AppError {
  constructor(entity, id, context = {}) {
    super(`${entity} not found: ${id}`, 'NOT_FOUND', { entity, id, ...context });
    this.name = 'NotFoundError';
  }
}

/**
 * Duplicate Error
 * Duplike kayıt
 */
export class DuplicateError extends AppError {
  constructor(entity, identifier, context = {}) {
    super(`Duplicate ${entity}: ${identifier}`, 'DUPLICATE', { entity, identifier, ...context });
    this.name = 'DuplicateError';
  }
}

// ============================================
// VALIDATION ERRORS
// ============================================

/**
 * Validation Error
 * Input validasyon hatası
 */
export class ValidationError extends AppError {
  constructor(field, reason, context = {}) {
    super(`Validation failed for ${field}: ${reason}`, 'VALIDATION_ERROR', { field, ...context });
    this.name = 'ValidationError';
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Error'ın operational olup olmadığını kontrol et
 * @param {Error} error
 * @returns {boolean}
 */
export function isOperationalError(error) {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
}

/**
 * Error'ı loglama için format'la
 * @param {Error} error
 * @returns {Object}
 */
export function formatErrorForLog(error) {
  if (error instanceof AppError) {
    return error.toJSON();
  }
  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
  };
}

/**
 * HTTP status code döndür
 * @param {Error} error
 * @returns {number}
 */
export function getHttpStatusCode(error) {
  const statusMap = {
    VALIDATION_ERROR: 400,
    NOT_FOUND: 404,
    DUPLICATE: 409,
    SESSION_EXPIRED: 401,
    LOGIN_FAILED: 401,
    UNSUPPORTED_FILE_TYPE: 400,
    FILE_SIZE_EXCEEDED: 413,
  };

  if (error instanceof AppError && statusMap[error.code]) {
    return statusMap[error.code];
  }

  return 500;
}
