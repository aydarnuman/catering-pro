/**
 * Global Error Handler Middleware
 * Tüm hataları yakalar ve standart formatta döndürür
 */

import logger from '../utils/logger.js';

/**
 * Hassas alanları log'dan maskeler
 * Şifreler, tokenlar vb. [REDACTED] ile değiştirilir
 */
const SENSITIVE_FIELDS = ['password', 'sifre', 'parola', 'token', 'secret', 'refresh_token', 'access_token', 'credit_card', 'cvv', 'card_number'];

function sanitizeBody(body) {
  if (!body || typeof body !== 'object') return body;
  const sanitized = { ...body };
  for (const key of Object.keys(sanitized)) {
    if (SENSITIVE_FIELDS.includes(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
    }
  }
  return sanitized;
}

/**
 * Global error handler middleware
 * Production'da stack trace gizler, development'ta gösterir
 */
export const globalErrorHandler = (err, req, res, _next) => {
  // Hata logla (hassas veriler maskelenerek)
  logger.error('Unhandled Error', {
    error: err.message,
    stack: err.stack,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    body: sanitizeBody(req.body),
    query: req.query,
  });

  // Status code belirle
  let statusCode = err.statusCode || err.status || 500;

  // Production'da hassas bilgileri gizle
  const isProduction = process.env.NODE_ENV === 'production';

  // Error response oluştur
  const errorResponse = {
    success: false,
    error: err.message || 'Sunucu hatası',
    ...(isProduction
      ? {}
      : {
          // Development'ta ek bilgiler
          stack: err.stack,
          details: err.details,
        }),
  };

  // Özel hata tipleri için özel mesajlar
  if (err.name === 'ValidationError') {
    errorResponse.error = 'Geçersiz veri';
    errorResponse.details = err.details || err.message;
  } else if (err.name === 'UnauthorizedError' || err.name === 'JsonWebTokenError') {
    errorResponse.error = 'Yetkilendirme hatası';
    statusCode = 401;
  } else if (err.name === 'CastError') {
    errorResponse.error = 'Geçersiz ID formatı';
    statusCode = 400;
  }

  res.status(statusCode).json(errorResponse);
};

/**
 * 404 Not Found handler
 */
export const notFoundHandler = (req, res) => {
  logger.warn('404 Not Found', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
  });

  res.status(404).json({
    success: false,
    error: 'Endpoint bulunamadı',
    path: req.originalUrl,
  });
};

/**
 * Async handler wrapper
 * Async route handler'larındaki hataları yakalar
 */
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
