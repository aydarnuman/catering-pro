/**
 * AUTH MIDDLEWARE - PostgreSQL Only (Simplified)
 * Supabase Auth KALDIRILDI - Sadece kendi JWT sistemimiz
 *
 * Avantajlar:
 * - Tek network call (timeout yok)
 * - Hızlı doğrulama (50-100ms)
 * - Tam kontrol
 */

import jwt from 'jsonwebtoken';
import { query } from '../database.js';
import AuditService from '../services/audit-service.js';
import PermissionService from '../services/permission-service.js';
import logger from '../utils/logger.js';

// JWT_SECRET kontrolü
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  logger.error('KRITIK: JWT_SECRET tanımlanmamış!');
  throw new Error('JWT_SECRET environment variable is required');
}

/**
 * Token doğrulama middleware (Ana middleware)
 * Sadece kendi JWT token'ımızı doğrular - Supabase YOK
 */
const authenticate = async (req, res, next) => {
  try {
    // Token'ı al: Cookie > Header
    let token = req.cookies?.access_token;
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.substring(7).trim();
      }
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Token gerekli',
        code: 'NO_TOKEN',
      });
    }

    // JWT doğrula
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          error: 'Token süresi dolmuş',
          code: 'TOKEN_EXPIRED',
        });
      }
      return res.status(401).json({
        success: false,
        error: 'Geçersiz token',
        code: 'INVALID_TOKEN',
      });
    }

    // Kullanıcıyı veritabanından al
    const profileResult = await query(
      `SELECT id, email, name, user_type, role FROM users WHERE id = $1 AND is_active = true`,
      [decoded.id]
    );

    if (!profileResult.rows.length) {
      return res.status(401).json({
        success: false,
        error: 'Kullanıcı bulunamadı',
        code: 'USER_NOT_FOUND',
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
      role: profile.role,
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
 * Opsiyonel token doğrulama
 * Token varsa kullanıcı bilgisi alır, yoksa da devam eder
 */
const optionalAuth = async (req, _res, next) => {
  try {
    let token = req.cookies?.access_token;
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.substring(7).trim();
      }
    }

    if (!token) {
      req.user = null;
      return next();
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);

      const profileResult = await query(
        `SELECT id, email, name, user_type, role FROM users WHERE id = $1 AND is_active = true`,
        [decoded.id]
      );

      if (profileResult.rows.length) {
        const profile = profileResult.rows[0];
        const userType = profile.user_type || 'user';

        req.user = {
          id: profile.id,
          email: profile.email,
          name: profile.name,
          user_type: userType,
          userType,
          role: profile.role,
          isSuperAdmin: userType === 'super_admin',
        };
      } else {
        req.user = null;
      }
    } catch {
      req.user = null;
    }
  } catch {
    req.user = null;
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
  if (req.user.userType !== 'admin' && req.user.userType !== 'super_admin') {
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

      const hasPermission = await PermissionService.check(req.user.id, moduleName, action);

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

const addRequestInfo = (req, _res, next) => {
  req.clientIp = req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress;
  req.userAgent = req.headers['user-agent'];
  next();
};

/**
 * PUBLIC ROUTE - Auth gerektirmez
 * Token varsa kullanıcı bilgisini alır, yoksa da devam eder
 */
const publicRoute = async (req, _res, next) => {
  try {
    let token = req.cookies?.access_token;
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.substring(7).trim();
      }
    }

    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);

        const profileResult = await query(
          `SELECT id, email, name, user_type, role FROM users WHERE id = $1 AND is_active = true`,
          [decoded.id]
        );

        if (profileResult.rows.length) {
          const profile = profileResult.rows[0];
          req.user = {
            id: profile.id,
            email: profile.email,
            name: profile.name,
            user_type: profile.user_type || 'user',
            userType: profile.user_type || 'user',
            role: profile.role,
            isSuperAdmin: profile.user_type === 'super_admin',
          };
        } else {
          req.user = null;
        }
      } catch {
        req.user = null;
      }
    } else {
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
const noAuth = (req, _res, next) => {
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
