/**
 * YETKİ YÖNETİMİ API
 * /api/permissions
 */

import express from 'express';
import PermissionService from '../services/permission-service.js';
import AuditService from '../services/audit-service.js';
import { authenticate, requireAdmin, requireSuperAdmin } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/permissions/modules
 * Tüm modülleri listele
 */
router.get('/modules', authenticate, async (req, res) => {
  try {
    const modules = await PermissionService.getModules();
    res.json({ success: true, data: modules });
  } catch (error) {
    console.error('Get modules error:', error);
    res.status(500).json({ success: false, error: 'Modüller alınamadı' });
  }
});

/**
 * GET /api/permissions/templates
 * Yetki şablonlarını listele
 */
router.get('/templates', authenticate, requireAdmin, async (req, res) => {
  try {
    const templates = await PermissionService.getTemplates();
    res.json({ success: true, data: templates });
  } catch (error) {
    console.error('Get templates error:', error);
    res.status(500).json({ success: false, error: 'Şablonlar alınamadı' });
  }
});

/**
 * GET /api/permissions/my
 * Giriş yapan kullanıcının yetkilerini getir
 */
router.get('/my', authenticate, async (req, res) => {
  try {
    const permissions = await PermissionService.getUserPermissions(req.user.id);
    const userType = await PermissionService.getUserType(req.user.id);
    
    res.json({ 
      success: true, 
      data: {
        userType,
        isSuperAdmin: userType === 'super_admin',
        permissions
      }
    });
  } catch (error) {
    console.error('Get my permissions error:', error);
    res.status(500).json({ success: false, error: 'Yetkiler alınamadı' });
  }
});

/**
 * GET /api/permissions/accessible-modules
 * Kullanıcının erişebileceği modülleri getir (sidebar için)
 */
router.get('/accessible-modules', authenticate, async (req, res) => {
  try {
    const modules = await PermissionService.getAccessibleModules(req.user.id);
    res.json({ success: true, data: modules });
  } catch (error) {
    console.error('Get accessible modules error:', error);
    res.status(500).json({ success: false, error: 'Modüller alınamadı' });
  }
});

/**
 * GET /api/permissions/users
 * Tüm kullanıcıların yetkilerini listele (sadece super admin)
 */
router.get('/users', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const users = await PermissionService.getAllUsersPermissions();
    res.json({ success: true, data: users });
  } catch (error) {
    console.error('Get users permissions error:', error);
    res.status(500).json({ success: false, error: 'Kullanıcı yetkileri alınamadı' });
  }
});

/**
 * GET /api/permissions/user/:userId
 * Belirli kullanıcının yetkilerini getir
 */
router.get('/user/:userId', authenticate, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Normal admin sadece kendi yetkilerini görebilir, süper admin herkesi görebilir
    if (!req.user.isSuperAdmin && parseInt(userId) !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Bu kullanıcının yetkilerini görme izniniz yok' });
    }

    const permissions = await PermissionService.getUserPermissions(parseInt(userId));
    const userType = await PermissionService.getUserType(parseInt(userId));
    
    res.json({ 
      success: true, 
      data: {
        userId: parseInt(userId),
        userType,
        permissions
      }
    });
  } catch (error) {
    console.error('Get user permissions error:', error);
    res.status(500).json({ success: false, error: 'Kullanıcı yetkileri alınamadı' });
  }
});

/**
 * PUT /api/permissions/user/:userId
 * Kullanıcının yetkilerini güncelle (sadece super admin)
 */
router.put('/user/:userId', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { permissions, userType } = req.body;

    // Süper admin'in kendi yetkilerini değiştirmesini engelle
    if (parseInt(userId) === req.user.id) {
      return res.status(400).json({ success: false, error: 'Kendi yetkinizi değiştiremezsiniz' });
    }

    // Eski yetkileri al (audit log için)
    const oldPermissions = await PermissionService.getUserPermissions(parseInt(userId));
    const oldUserType = await PermissionService.getUserType(parseInt(userId));

    // Kullanıcı tipini güncelle
    if (userType && userType !== oldUserType) {
      // super_admin yapılmasını engelle
      if (userType === 'super_admin') {
        return res.status(400).json({ success: false, error: 'Süper Admin ataması yapılamaz' });
      }
      await PermissionService.updateUserType(parseInt(userId), userType);
    }

    // Yetkileri güncelle
    if (permissions && Array.isArray(permissions)) {
      await PermissionService.updateUserPermissions(parseInt(userId), permissions);
    }

    // Audit log
    await AuditService.log({
      userId: req.user.id,
      action: 'update',
      entityType: 'permission',
      entityId: parseInt(userId),
      entityName: `Kullanıcı #${userId} yetkileri`,
      oldData: { userType: oldUserType, permissions: oldPermissions },
      newData: { userType: userType || oldUserType, permissions },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      requestPath: req.originalUrl
    });

    res.json({ success: true, message: 'Yetkiler güncellendi' });
  } catch (error) {
    console.error('Update permissions error:', error);
    res.status(500).json({ success: false, error: 'Yetkiler güncellenemedi' });
  }
});

/**
 * POST /api/permissions/user/:userId/apply-template
 * Kullanıcıya şablon uygula (sadece super admin)
 */
router.post('/user/:userId/apply-template', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { templateName } = req.body;

    if (!templateName) {
      return res.status(400).json({ success: false, error: 'Şablon adı gerekli' });
    }

    // Süper admin'e şablon uygulanamaz
    if (parseInt(userId) === req.user.id) {
      return res.status(400).json({ success: false, error: 'Kendi yetkinize şablon uygulayamazsınız' });
    }

    const count = await PermissionService.applyTemplate(parseInt(userId), templateName);

    // Audit log
    await AuditService.log({
      userId: req.user.id,
      action: 'update',
      entityType: 'permission',
      entityId: parseInt(userId),
      entityName: `Kullanıcı #${userId} - Şablon: ${templateName}`,
      newData: { templateName, appliedModules: count },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      requestPath: req.originalUrl,
      description: `${templateName} şablonu uygulandı (${count} modül)`
    });

    res.json({ 
      success: true, 
      message: `${templateName} şablonu uygulandı`,
      appliedModules: count
    });
  } catch (error) {
    console.error('Apply template error:', error);
    res.status(500).json({ success: false, error: 'Şablon uygulanamadı' });
  }
});

/**
 * GET /api/permissions/check
 * Yetki kontrolü (frontend için)
 */
router.get('/check', authenticate, async (req, res) => {
  try {
    const { module: moduleName, action } = req.query;
    
    if (!moduleName || !action) {
      return res.status(400).json({ success: false, error: 'module ve action parametreleri gerekli' });
    }

    // Super admin her şeyi yapabilir
    if (req.user.isSuperAdmin) {
      return res.json({ success: true, hasPermission: true });
    }

    const hasPermission = await PermissionService.check(req.user.id, moduleName, action);
    res.json({ success: true, hasPermission });
  } catch (error) {
    console.error('Check permission error:', error);
    res.status(500).json({ success: false, error: 'Yetki kontrolü yapılamadı' });
  }
});

export default router;
