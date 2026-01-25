/**
 * CSRF Protection Middleware
 * Cross-Site Request Forgery koruması
 * 
 * Cookie-based CSRF token kullanır (SameSite=Strict)
 */

import crypto from 'crypto';
import logger from '../utils/logger.js';

// CSRF token'ları memory'de sakla (production'da Redis kullanılabilir)
const csrfTokens = new Map();

// Token temizleme (her 1 saatte bir)
setInterval(() => {
  const now = Date.now();
  for (const [token, data] of csrfTokens.entries()) {
    if (now - data.createdAt > 3600000) { // 1 saat
      csrfTokens.delete(token);
    }
  }
}, 3600000);

/**
 * CSRF token oluştur
 */
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * CSRF token'ı cookie'ye yaz
 */
function setCsrfCookie(res, token) {
  const isProduction = process.env.NODE_ENV === 'production';
  
  res.cookie('csrf-token', token, {
    httpOnly: false, // Frontend'den okunabilir olmalı
    secure: isProduction,
    sameSite: 'strict',
    maxAge: 3600000, // 1 saat
    path: '/'
  });
}

/**
 * CSRF token doğrula
 */
function verifyToken(token, cookieToken) {
  if (!token || !cookieToken) {
    return false;
  }
  
  // Token'lar eşleşmeli
  if (token !== cookieToken) {
    return false;
  }
  
  // Token memory'de var mı kontrol et
  if (!csrfTokens.has(token)) {
    return false;
  }
  
  // Token süresi dolmuş mu kontrol et
  const tokenData = csrfTokens.get(token);
  const now = Date.now();
  if (now - tokenData.createdAt > 3600000) { // 1 saat
    csrfTokens.delete(token);
    return false;
  }
  
  return true;
}

/**
 * CSRF koruması middleware
 * GET isteklerinde token oluşturur, POST/PUT/DELETE isteklerinde doğrular
 */
export const csrfProtection = (req, res, next) => {
  // Safe methods için token oluştur
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    const token = generateToken();
    
    // Token'ı memory'ye kaydet
    csrfTokens.set(token, {
      createdAt: Date.now(),
      ip: req.ip || req.headers['x-forwarded-for'] || 'unknown'
    });
    
    // Cookie'ye yaz
    setCsrfCookie(res, token);
    
    // Response header'a da ekle (frontend için)
    res.setHeader('X-CSRF-Token', token);
    
    return next();
  }
  
  // Unsafe methods için token doğrula
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    // Bearer token ile gelen istekler (Supabase Auth) CSRF atlanır
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return next();
    }

    // CSRF koruması olmayan endpoint'ler (login, register gibi)
    const excludedPaths = [
      '/api/auth/login',
      '/api/auth/register',
      '/api/auth/refresh',
      '/api/auth/logout'
    ];

    const isExcluded = excludedPaths.some(path => req.path.startsWith(path));

    if (isExcluded) {
      return next();
    }
    
    // Token'ı header'dan al
    const token = req.headers['x-csrf-token'] || req.body?._csrf;
    
    // Cookie'den token'ı al
    const cookieToken = req.cookies?.['csrf-token'];
    
    // Token yoksa hata
    if (!token) {
      logger.warn('CSRF token missing in request', {
        path: req.path,
        method: req.method,
        ip: req.ip
      });
      
      return res.status(403).json({
        success: false,
        error: 'CSRF token required',
        code: 'CSRF_ERROR'
      });
    }
    
    // Cookie token yoksa hata
    if (!cookieToken) {
      logger.warn('CSRF cookie token missing', {
        path: req.path,
        method: req.method,
        ip: req.ip
      });
      
      return res.status(403).json({
        success: false,
        error: 'CSRF cookie token required',
        code: 'CSRF_ERROR'
      });
    }
    
    // Token'lar eşleşmeli
    if (token !== cookieToken) {
      logger.warn('CSRF token mismatch', {
        path: req.path,
        method: req.method,
        ip: req.ip
      });
      
      return res.status(403).json({
        success: false,
        error: 'CSRF token mismatch',
        code: 'CSRF_ERROR'
      });
    }
    
    // Token doğrula (memory'de var mı, süresi dolmuş mu)
    if (!verifyToken(token, cookieToken)) {
      logger.warn('CSRF token validation failed', {
        path: req.path,
        method: req.method,
        ip: req.ip,
        hasHeaderToken: !!token,
        hasCookieToken: !!cookieToken
      });
      
      return res.status(403).json({
        success: false,
        error: 'CSRF token validation failed',
        code: 'CSRF_ERROR'
      });
    }
    
    // Token doğrulandı, devam et
    return next();
  }
  
  // Diğer method'lar için geç
  next();
};

/**
 * CSRF token'ı manuel olarak oluştur (özel durumlar için)
 */
export function generateCsrfToken() {
  const token = generateToken();
  csrfTokens.set(token, {
    createdAt: Date.now(),
    ip: 'manual'
  });
  return token;
}

/**
 * CSRF token'ı manuel olarak doğrula
 */
export function validateCsrfToken(token, cookieToken) {
  return verifyToken(token, cookieToken);
}
