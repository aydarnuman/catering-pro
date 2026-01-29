/**
 * Rate Limiting Middleware
 * API endpoint'lerini DDoS ve brute-force saldırılarına karşı korur
 */

import rateLimit from 'express-rate-limit';
import logger from '../utils/logger.js';

// Genel API rate limiter
// Production: 100 istek/15 dk. Development: yüksek limit (SPA + Strict Mode çok istek atar)
const apiMax = process.env.NODE_ENV === 'production' ? 100 : 3000;
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dakika
  max: apiMax, // Her IP için maksimum istek
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
  windowMs: 15 * 60 * 1000, // 15 dakika
  max: process.env.NODE_ENV === 'production' ? 10 : 50, // Brute-force koruması
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

// Scraper endpoint'leri için özel rate limiter (5 istek / saat)
export const scraperLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 saat
  max: 5, // Her IP için maksimum 5 istek
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
