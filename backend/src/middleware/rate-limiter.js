/**
 * Rate Limiting Middleware
 * API endpoint'lerini DDoS ve brute-force saldırılarına karşı korur
 */

import rateLimit from 'express-rate-limit';
import logger from '../utils/logger.js';

// Rate limit konfigürasyonu
const RATE_LIMITS = {
  API: { windowMs: 15 * 60 * 1000, prodMax: 300, devMax: 3000 },
  AUTH: { windowMs: 15 * 60 * 1000, prodMax: 10, devMax: 50 },
  ADMIN: { windowMs: 15 * 60 * 1000, prodMax: 50, devMax: 500 },
  GOD_MODE: { windowMs: 15 * 60 * 1000, prodMax: 10, devMax: 100 },
  SCRAPER: { windowMs: 60 * 60 * 1000, max: 5 },
};

const isProduction = process.env.NODE_ENV === 'production';

// Genel API rate limiter
// Production: 300 istek/15 dk (SPA çok endpoint çağırır). Development: yüksek limit (Strict Mode çift çağrı yapar)
export const apiLimiter = rateLimit({
  windowMs: RATE_LIMITS.API.windowMs,
  max: isProduction ? RATE_LIMITS.API.prodMax : RATE_LIMITS.API.devMax,
  message: {
    error: 'Çok fazla istek gönderildi. Lütfen 15 dakika sonra tekrar deneyin.',
  },
  standardHeaders: true, // Rate limit bilgilerini `RateLimit-*` header'larında döndür
  legacyHeaders: false, // `X-RateLimit-*` header'larını devre dışı bırak
  validate: false, // Trust proxy validasyonunu atla
  handler: (req, res) => {
    logger.warn('Rate limit aşıldı', {
      ip: req.ip,
      path: req.path,
      method: req.method,
    });
    res.status(429).json({
      error: 'Çok fazla istek gönderildi. Lütfen 15 dakika sonra tekrar deneyin.',
    });
  },
});

// Auth endpoint'leri için rate limiter
// Development: 50 istek / 15 dakika, Production: 10 istek / 15 dakika
export const authLimiter = rateLimit({
  windowMs: RATE_LIMITS.AUTH.windowMs,
  max: isProduction ? RATE_LIMITS.AUTH.prodMax : RATE_LIMITS.AUTH.devMax,
  message: {
    error: 'Çok fazla giriş denemesi. Lütfen 15 dakika sonra tekrar deneyin.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false, // Trust proxy validasyonunu atla
  skipSuccessfulRequests: true, // Başarılı istekleri sayma
  handler: (req, res) => {
    logger.warn('Auth rate limit aşıldı', {
      ip: req.ip,
      path: req.path,
      method: req.method,
    });
    res.status(429).json({
      error: 'Çok fazla giriş denemesi. Lütfen 15 dakika sonra tekrar deneyin.',
    });
  },
});

// Admin endpoint'leri için rate limiter (50 istek / 15 dk)
export const adminLimiter = rateLimit({
  windowMs: RATE_LIMITS.ADMIN.windowMs,
  max: isProduction ? RATE_LIMITS.ADMIN.prodMax : RATE_LIMITS.ADMIN.devMax,
  message: {
    error: 'Admin endpoint limiti aşıldı. Lütfen 15 dakika sonra tekrar deneyin.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  handler: (req, res) => {
    logger.warn('Admin rate limit aşıldı', {
      ip: req.ip,
      path: req.path,
      method: req.method,
      userId: req.user?.id,
    });
    res.status(429).json({
      error: 'Admin endpoint limiti aşıldı. Lütfen 15 dakika sonra tekrar deneyin.',
    });
  },
});

// God Mode terminal için katı rate limiter (10 istek / 15 dk)
export const godModeLimiter = rateLimit({
  windowMs: RATE_LIMITS.GOD_MODE.windowMs,
  max: isProduction ? RATE_LIMITS.GOD_MODE.prodMax : RATE_LIMITS.GOD_MODE.devMax,
  message: {
    error: 'God Mode limiti aşıldı. Lütfen 15 dakika sonra tekrar deneyin.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  handler: (req, res) => {
    logger.warn('God Mode rate limit aşıldı', {
      ip: req.ip,
      path: req.path,
      method: req.method,
      userId: req.user?.id,
    });
    res.status(429).json({
      error: 'God Mode limiti aşıldı. Lütfen 15 dakika sonra tekrar deneyin.',
    });
  },
});

// Scraper endpoint'leri için özel rate limiter (5 istek / saat)
export const scraperLimiter = rateLimit({
  windowMs: RATE_LIMITS.SCRAPER.windowMs,
  max: RATE_LIMITS.SCRAPER.max,
  message: {
    error: 'Scraper endpoint limiti aşıldı. Lütfen 1 saat sonra tekrar deneyin.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false, // Trust proxy validasyonunu atla
  handler: (req, res) => {
    logger.warn('Scraper rate limit aşıldı', {
      ip: req.ip,
      path: req.path,
      method: req.method,
    });
    res.status(429).json({
      error: 'Scraper endpoint limiti aşıldı. Lütfen 1 saat sonra tekrar deneyin.',
    });
  },
});
