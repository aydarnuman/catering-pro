/**
 * AUTH MIDDLEWARE
 * Supabase JWT doğrulama + public.users profil eşlemesi
 */

import { createClient } from '@supabase/supabase-js';
import { query } from '../database.js';
import PermissionService from '../services/permission-service.js';
import AuditService from '../services/audit-service.js';
import logger from '../utils/logger.js';

// Supabase URL - önce NEXT_PUBLIC_SUPABASE_URL kontrol et (frontend ile tutarlılık için)
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

let supabase = null;
if (supabaseUrl && supabaseServiceKey) {
  supabase = createClient(supabaseUrl, supabaseServiceKey);
  logger.info('✅ Supabase auth middleware başlatıldı', {
    url: supabaseUrl,
    hasServiceKey: !!supabaseServiceKey,
    serviceKeyPreview: supabaseServiceKey.substring(0, 20) + '...'
  });
} else {
  logger.warn(
    'UYARI: SUPABASE_URL / SUPABASE_SERVICE_KEY tanımlı değil. Auth middleware çalışmayacak.',
    {
      hasUrl: !!supabaseUrl,
      hasServiceKey: !!supabaseServiceKey
    }
  );
}

/**
 * Token doğrulama middleware
 * Sadece Authorization: Bearer <token> kabul eder.
 * Supabase JWT doğrulanır, public.users'dan profil alınır.
 * req.user.id = integer (profile.id)
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn('Auth middleware: Token header eksik', {
        url: req.originalUrl,
        hasAuthHeader: !!authHeader,
        authHeaderPreview: authHeader?.substring(0, 30),
        authHeaderLength: authHeader?.length || 0
      });
      return res.status(401).json({ success: false, error: 'Token gerekli' });
    }

    // Token'ın boş olmadığını kontrol et
    const token = authHeader.substring(7).trim();
    if (!token || token.length === 0) {
      logger.warn('Auth middleware: Token boş', {
        url: req.originalUrl,
        authHeaderLength: authHeader.length
      });
      return res.status(401).json({ success: false, error: 'Token boş' });
    }

    // Token zaten yukarıda alındı (trim edilmiş)
    if (!supabase) {
      logger.error('Auth middleware: Supabase client yok');
      return res.status(500).json({
        success: false,
        error: 'Sunucu yapılandırma hatası',
      });
    }

    // Token'ı decode et (JWT format kontrolü)
    const tokenParts = token.split('.');
    if (tokenParts.length !== 3) {
      logger.warn('Auth middleware: Token formatı geçersiz (JWT 3 parça olmalı)', {
        url: req.originalUrl,
        tokenParts: tokenParts.length,
        tokenPreview: token.substring(0, 30) + '...'
      });
      return res.status(401).json({
        success: false,
        error: 'Geçersiz token formatı',
        details: 'Token JWT formatında değil'
      });
    }

    const {
      data: { user: authUser },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !authUser) {
      logger.warn('Auth middleware: Token doğrulama hatası', {
        url: req.originalUrl,
        error: error?.message,
        errorCode: error?.status,
        hasUser: !!authUser,
        tokenPreview: token.substring(0, 30) + '...',
        tokenLength: token.length,
        tokenParts: tokenParts.length
      });
      return res.status(401).json({
        success: false,
        error: 'Geçersiz token',
        details: error?.message || 'Token doğrulanamadı'
      });
    }

    const profileResult = await query(
      `SELECT id, email, name, user_type FROM users WHERE email = $1 AND is_active = true`,
      [authUser.email]
    );

    if (!profileResult.rows.length) {
      logger.warn('Auth middleware: Kullanıcı profil bulunamadı', {
        url: req.originalUrl,
        email: authUser.email,
        authUserId: authUser.id
      });
      return res.status(401).json({
        success: false,
        error: 'Kullanıcı bulunamadı',
        details: `public.users tablosunda ${authUser.email} için kayıt yok`
      });
    }

    const profile = profileResult.rows[0];
    const userType = profile.user_type || 'user';

    req.user = {
      id: profile.id,
      email: profile.email,
      name: profile.name,
      user_type: userType,
      userType,
      isSuperAdmin: userType === 'super_admin',
    };

    next();
  } catch (err) {
    logger.error('Auth middleware error', { error: err.message });
    return res.status(401).json({
      success: false,
      error: 'Kimlik doğrulama hatası',
    });
  }
};

/**
 * Opsiyonel token doğrulama (giriş yapmadan da çalışan sayfalar için)
 * Sadece Authorization: Bearer kabul eder.
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ') || !supabase) {
      return next();
    }

    const token = authHeader.substring(7);
    const {
      data: { user: authUser },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !authUser) return next();

    const profileResult = await query(
      `SELECT id, email, name, user_type FROM users WHERE email = $1 AND is_active = true`,
      [authUser.email]
    );

    if (!profileResult.rows.length) return next();

    const profile = profileResult.rows[0];
    const userType = profile.user_type || 'user';

    req.user = {
      id: profile.id,
      email: profile.email,
      name: profile.name,
      user_type: userType,
      userType,
      isSuperAdmin: userType === 'super_admin',
    };
  } catch {
    /* ignore */
  }
  next();
};

/**
 * Admin kontrolü middleware
 */
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Yetkilendirme gerekli' });
  }
  if (
    req.user.userType !== 'admin' &&
    req.user.userType !== 'super_admin'
  ) {
    return res.status(403).json({
      success: false,
      error: 'Admin yetkisi gerekli',
    });
  }
  next();
};

/**
 * Super Admin kontrolü middleware
 */
const requireSuperAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Yetkilendirme gerekli' });
  }
  if (req.user.userType !== 'super_admin') {
    return res.status(403).json({
      success: false,
      error: 'Süper Admin yetkisi gerekli',
    });
  }
  next();
};

/**
 * Modül bazlı yetki kontrolü middleware factory
 */
const requirePermission = (moduleName, action) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Yetkilendirme gerekli',
        });
      }
      if (req.user.isSuperAdmin) return next();

      const hasPermission = await PermissionService.check(
        req.user.id,
        moduleName,
        action
      );

      if (!hasPermission) {
        await AuditService.log({
          userId: req.user.id,
          action: 'unauthorized_access',
          entityType: moduleName,
          description: `Yetkisiz erişim denemesi: ${moduleName} - ${action}`,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          requestPath: req.originalUrl,
        });
        return res.status(403).json({
          success: false,
          error: 'Bu işlem için yetkiniz bulunmamaktadır',
          module: moduleName,
          action,
        });
      }
      next();
    } catch (error) {
      logger.error('Permission check error', { error: error.message });
      return res.status(500).json({
        success: false,
        error: 'Yetki kontrolü hatası',
      });
    }
  };
};

/**
 * Audit log middleware
 */
const auditLog = (entityType) => {
  return async (req, res, next) => {
    const originalSend = res.send;
    res.send = async function (body) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          let action = 'view';
          if (req.method === 'POST') action = 'create';
          if (req.method === 'PUT' || req.method === 'PATCH') action = 'update';
          if (req.method === 'DELETE') action = 'delete';
          if (action !== 'view') {
            await AuditService.log({
              userId: req.user?.id,
              action,
              entityType,
              entityId: req.params.id,
              newData: req.method !== 'DELETE' ? req.body : null,
              ipAddress: req.ip,
              userAgent: req.headers['user-agent'],
              requestPath: req.originalUrl,
            });
          }
        } catch (error) {
          logger.error('Audit log error', { error: error.message });
        }
      }
      return originalSend.call(this, body);
    };
    next();
  };
};

const addRequestInfo = (req, res, next) => {
  req.clientIp =
    req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress;
  req.userAgent = req.headers['user-agent'];
  next();
};

export {
  authenticate,
  optionalAuth,
  requireAdmin,
  requireSuperAdmin,
  requirePermission,
  auditLog,
  addRequestInfo,
};
