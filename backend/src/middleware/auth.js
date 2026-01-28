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
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

let supabase = null;
let supabaseAvailable = false;

// Lazy initialization - sadece gerektiğinde Supabase client oluştur
function getSupabaseClient() {
  if (supabase) return supabase;

  if (supabaseUrl && supabaseServiceKey) {
    try {
      supabase = createClient(supabaseUrl, supabaseServiceKey);
      supabaseAvailable = true;
      logger.info('✅ Supabase auth middleware başlatıldı', {
        url: supabaseUrl.substring(0, 30) + '...',
        hasServiceKey: !!supabaseServiceKey
      });
    } catch (error) {
      logger.error('Supabase client oluşturulamadı:', error.message);
      supabaseAvailable = false;
    }
  } else {
    logger.warn('⚠️ Supabase credentials eksik, fallback PostgreSQL auth kullanılacak', {
      hasUrl: !!supabaseUrl,
      hasServiceKey: !!supabaseServiceKey
    });
    supabaseAvailable = false;
  }

  return supabase;
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

    // Supabase client'ı başlat (lazy initialization)
    const supabaseClient = getSupabaseClient();

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

    let authUser = null;
    let authError = null;

    // Supabase kullanılabilirse token'ı Supabase ile doğrula
    if (supabaseClient && supabaseAvailable) {
      try {
        // Supabase getUser - 3 saniye timeout korumalı (5 saniyeden 3'e düşürüldü)
        const userPromise = supabaseClient.auth.getUser(token);
        const timeoutPromise = new Promise((resolve) =>
          setTimeout(
            () => resolve({ data: { user: null }, error: { message: 'Auth timeout (3s)' } }),
            3000
          )
        );
        const { data: { user }, error } = await Promise.race([userPromise, timeoutPromise]);

        if (error || !user) {
          logger.warn('Supabase token doğrulama başarısız, email fallback deneniyor', {
            url: req.originalUrl,
            error: error?.message,
            tokenPreview: token.substring(0, 30) + '...'
          });
        } else {
          authUser = user;
        }
      } catch (supabaseError) {
        logger.error('Supabase auth error, fallback kullanılacak:', supabaseError.message);
        authError = supabaseError;
      }
    }

    // Supabase başarısız veya kullanılamıyorsa: email extraction fallback
    if (!authUser) {
      // JWT token'dan email'i çıkar (base64 decode)
      try {
        const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
        if (payload.email) {
          // PostgreSQL'den direkt email ile kullanıcıyı ara
          const emailAuthResult = await query(
            `SELECT id, email, name, user_type FROM users WHERE email = $1 AND is_active = true`,
            [payload.email]
          );
          if (emailAuthResult.rows.length > 0) {
            // Email ile kullanıcı bulundu, devam et
            const profile = emailAuthResult.rows[0];
            const userType = profile.user_type || 'user';

            req.user = {
              id: profile.id,
              email: profile.email,
              name: profile.name,
              user_type: userType,
              userType,
              isSuperAdmin: userType === 'super_admin',
            };

            return next();
          }
        }
      } catch (decodeError) {
        logger.error('JWT decode error:', decodeError.message);
      }

      // Her iki yöntem de başarısız
      return res.status(401).json({
        success: false,
        error: 'Geçersiz token',
        details: authError?.message || 'Token doğrulanamadı'
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
    const supabaseClient = getSupabaseClient();

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7);

    let authUser = null;

    // Supabase mevcutsa token'ı doğrula
    if (supabaseClient && supabaseAvailable) {
      try {
        // Supabase getUser - 2 saniye timeout korumalı (optional auth için daha kısa)
        const userPromise = supabaseClient.auth.getUser(token);
        const timeoutPromise = new Promise((resolve) =>
          setTimeout(() => resolve({ data: { user: null }, error: { message: 'Auth timeout' } }), 2000)
        );
        const { data: { user }, error } = await Promise.race([userPromise, timeoutPromise]);

        if (!error && user) {
          authUser = user;
        }
      } catch {
        // Hata olsa bile next() - optional auth
      }
    }

    if (!authUser) return next();

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

/**
 * PUBLIC ROUTE - Auth gerektirmez
 * Token varsa kullanıcı bilgisini alır, yoksa da devam eder
 * Tüm public API'ler için kullan
 */
const publicRoute = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const supabaseClient = getSupabaseClient();

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      if (token && token.length > 0) {
        try {
          let authUser = null;

          // Supabase mevcutsa kullan
          if (supabaseClient && supabaseAvailable) {
            try {
              const { data: { user } } = await supabaseClient.auth.getUser(token);
              if (user) {
                authUser = user;
              }
            } catch {
              // Supabase hatası - fallback dene
            }
          }

          // Supabase başarısız ise JWT'den email çıkar
          if (!authUser) {
            const tokenParts = token.split('.');
            if (tokenParts.length === 3) {
              try {
                const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
                if (payload.email) {
                  authUser = { email: payload.email };
                }
              } catch {
                // Decode hatası - devam et
              }
            }
          }

          if (authUser && authUser.email) {
            const profileResult = await query(
              `SELECT id, email, name, user_type FROM users WHERE email = $1 AND is_active = true`,
              [authUser.email]
            );
            if (profileResult.rows.length) {
              const profile = profileResult.rows[0];
              req.user = {
                id: profile.id,
                email: profile.email,
                name: profile.name,
                user_type: profile.user_type || 'user',
                userType: profile.user_type || 'user',
                isSuperAdmin: profile.user_type === 'super_admin',
              };
            }
          }
        } catch {
          // Token hatası olsa bile devam et
        }
      }
    }
    // User yoksa bile devam et - public route
    if (!req.user) {
      req.user = null;
    }
  } catch {
    req.user = null;
  }
  next();
};

/**
 * NO AUTH - Hiç auth kontrolü yapmaz
 */
const noAuth = (req, res, next) => {
  req.user = null;
  next();
};

export {
  authenticate,
  optionalAuth,
  publicRoute,
  noAuth,
  requireAdmin,
  requireSuperAdmin,
  requirePermission,
  auditLog,
  addRequestInfo,
};
