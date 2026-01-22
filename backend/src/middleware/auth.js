/**
 * AUTH MIDDLEWARE
 * JWT doğrulama ve yetki kontrolü
 */

import jwt from 'jsonwebtoken';
import PermissionService from '../services/permission-service.js';
import AuditService from '../services/audit-service.js';
import logger from '../utils/logger.js';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  logger.error('UYARI: JWT_SECRET tanımlanmamış! Bu güvenlik açığıdır.');
}

/**
 * Token doğrulama middleware
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Yetkilendirme gerekli' });
    }

    const token = authHeader.substring(7);
    
    if (!JWT_SECRET) {
      return res.status(500).json({ success: false, error: 'Sunucu yapılandırma hatası' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Request'e kullanıcı bilgilerini ekle
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role
    };

    // Kullanıcı tipini de ekle
    req.user.userType = await PermissionService.getUserType(decoded.id);
    req.user.isSuperAdmin = req.user.userType === 'super_admin';

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: 'Token süresi dolmuş' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, error: 'Geçersiz token' });
    }
    logger.error('Auth error', { error: error.message });
    return res.status(500).json({ success: false, error: 'Kimlik doğrulama hatası' });
  }
};

/**
 * Opsiyonel token doğrulama (giriş yapmadan da çalışan sayfalar için)
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ') && JWT_SECRET) {
      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role
      };
      req.user.userType = await PermissionService.getUserType(decoded.id);
      req.user.isSuperAdmin = req.user.userType === 'super_admin';
    }
  } catch (error) {
    // Hata olursa kullanıcı bilgisi olmadan devam et
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

  if (req.user.role !== 'admin' && req.user.userType !== 'super_admin' && req.user.userType !== 'admin') {
    return res.status(403).json({ success: false, error: 'Admin yetkisi gerekli' });
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
    return res.status(403).json({ success: false, error: 'Süper Admin yetkisi gerekli' });
  }

  next();
};

/**
 * Modül bazlı yetki kontrolü middleware factory
 * @param {string} moduleName - Modül adı (ihale, fatura, cari, etc.)
 * @param {string} action - İşlem (view, create, edit, delete, export)
 */
const requirePermission = (moduleName, action) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: 'Yetkilendirme gerekli' });
      }

      // Super admin her şeyi yapabilir
      if (req.user.isSuperAdmin) {
        return next();
      }

      const hasPermission = await PermissionService.check(req.user.id, moduleName, action);
      
      if (!hasPermission) {
        // Log the unauthorized access attempt
        await AuditService.log({
          userId: req.user.id,
          action: 'unauthorized_access',
          entityType: moduleName,
          description: `Yetkisiz erişim denemesi: ${moduleName} - ${action}`,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          requestPath: req.originalUrl
        });

        return res.status(403).json({ 
          success: false, 
          error: 'Bu işlem için yetkiniz bulunmamaktadır',
          module: moduleName,
          action: action
        });
      }

      next();
    } catch (error) {
      logger.error('Permission check error', { error: error.message });
      return res.status(500).json({ success: false, error: 'Yetki kontrolü hatası' });
    }
  };
};

/**
 * Audit log middleware - her istekte otomatik log tutar
 */
const auditLog = (entityType) => {
  return async (req, res, next) => {
    // Response'u intercept et
    const originalSend = res.send;
    
    res.send = async function(body) {
      // Sadece başarılı işlemleri logla
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          let action = 'view';
          if (req.method === 'POST') action = 'create';
          if (req.method === 'PUT' || req.method === 'PATCH') action = 'update';
          if (req.method === 'DELETE') action = 'delete';

          // GET isteklerini loglama (çok fazla log olur)
          if (action !== 'view') {
            await AuditService.log({
              userId: req.user?.id,
              action,
              entityType,
              entityId: req.params.id,
              newData: req.method !== 'DELETE' ? req.body : null,
              ipAddress: req.ip,
              userAgent: req.headers['user-agent'],
              requestPath: req.originalUrl
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

/**
 * IP ve request bilgilerini req'e ekle
 */
const addRequestInfo = (req, res, next) => {
  req.clientIp = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
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
  addRequestInfo
};
