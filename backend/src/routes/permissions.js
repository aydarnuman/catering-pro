/**
 * YETKİ YÖNETİMİ API
 * /api/permissions
 */

import express from 'express';
import { authenticate, requireAdmin, requireSuperAdmin } from '../middleware/auth.js';
import AuditService from '../services/audit-service.js';
import PermissionService from '../services/permission-service.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * GET /api/permissions/modules
 * Tüm modülleri listele
 */
router.get('/modules', authenticate, async (_req, res) => {
  try {
    const modules = await PermissionService.getModules();
    res.json({ success: true, data: modules });
  } catch (error) {
    logger.error('Permissions endpoint hatasi', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, error: 'Modüller alınamadı' });
  }
});

/**
 * GET /api/permissions/templates
 * Yetki şablonlarını listele
 */
router.get('/templates', authenticate, requireAdmin, async (_req, res) => {
  try {
    const templates = await PermissionService.getTemplates();
    res.json({ success: true, data: templates });
  } catch (error) {
    logger.error('Permissions endpoint hatasi', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, error: 'Şablonlar alınamadı' });
  }
});

/**
 * GET /api/permissions/templates/:id
 * Belirli bir şablonu getir
 */
router.get('/templates/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const template = await PermissionService.getTemplate(parseInt(id, 10));

    if (!template) {
      return res.status(404).json({ success: false, error: 'Şablon bulunamadı' });
    }

    res.json({ success: true, data: template });
  } catch (error) {
    logger.error('Permissions endpoint hatasi', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, error: 'Şablon alınamadı' });
  }
});

/**
 * POST /api/permissions/templates
 * Yeni şablon oluştur
 */
router.post('/templates', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { name, display_name, description, permissions } = req.body;

    if (!name || !display_name || !permissions) {
      return res.status(400).json({ success: false, error: 'name, display_name ve permissions gerekli' });
    }

    const template = await PermissionService.createTemplate({
      name,
      display_name,
      description: description || null,
      permissions,
    });

    // Audit log
    await AuditService.log({
      userId: req.user.id,
      action: 'create',
      entityType: 'permission_template',
      entityId: template.id,
      entityName: display_name,
      newData: { name, display_name, description, permissions },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      requestPath: req.originalUrl,
      description: `Yeni yetki şablonu oluşturuldu: ${display_name}`,
    });

    res.json({ success: true, data: template, message: 'Şablon oluşturuldu' });
  } catch (error) {
    if (error.message.includes('unique')) {
      return res.status(400).json({ success: false, error: 'Bu isimde bir şablon zaten var' });
    }
    res.status(500).json({ success: false, error: 'Şablon oluşturulamadı' });
  }
});

/**
 * PUT /api/permissions/templates/:id
 * Şablonu güncelle
 */
router.put('/templates/:id', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { display_name, description, permissions } = req.body;

    // Sistem şablonlarını güncellemeyi engelle
    const existing = await PermissionService.getTemplate(parseInt(id, 10));
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Şablon bulunamadı' });
    }

    if (existing.is_system) {
      return res.status(400).json({ success: false, error: 'Sistem şablonları düzenlenemez' });
    }

    // Eski verileri al (audit log için)
    const oldData = { ...existing };

    const template = await PermissionService.updateTemplate(parseInt(id, 10), {
      display_name,
      description,
      permissions,
    });

    // Audit log
    await AuditService.log({
      userId: req.user.id,
      action: 'update',
      entityType: 'permission_template',
      entityId: parseInt(id, 10),
      entityName: existing.display_name,
      oldData,
      newData: { display_name, description, permissions },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      requestPath: req.originalUrl,
      description: `Yetki şablonu güncellendi: ${display_name}`,
    });

    res.json({ success: true, data: template, message: 'Şablon güncellendi' });
  } catch (error) {
    logger.error('Permissions endpoint hatasi', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, error: 'Şablon güncellenemedi' });
  }
});

/**
 * DELETE /api/permissions/templates/:id
 * Şablonu sil
 */
router.delete('/templates/:id', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Sistem şablonlarını silmeyi engelle
    const existing = await PermissionService.getTemplate(parseInt(id, 10));
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Şablon bulunamadı' });
    }

    if (existing.is_system) {
      return res.status(400).json({ success: false, error: 'Sistem şablonları silinemez' });
    }

    await PermissionService.deleteTemplate(parseInt(id, 10));

    // Audit log
    await AuditService.log({
      userId: req.user.id,
      action: 'delete',
      entityType: 'permission_template',
      entityId: parseInt(id, 10),
      entityName: existing.display_name,
      oldData: existing,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      requestPath: req.originalUrl,
      description: `Yetki şablonu silindi: ${existing.display_name}`,
    });

    res.json({ success: true, message: 'Şablon silindi' });
  } catch (error) {
    logger.error('Permissions endpoint hatasi', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, error: 'Şablon silinemedi' });
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
        permissions,
      },
    });
  } catch (error) {
    logger.error('Permissions endpoint hatasi', { error: error.message, stack: error.stack });
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
    logger.error('Permissions endpoint hatasi', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, error: 'Modüller alınamadı' });
  }
});

/**
 * GET /api/permissions/users
 * Tüm kullanıcıların yetkilerini listele (sadece super admin)
 */
router.get('/users', authenticate, requireSuperAdmin, async (_req, res) => {
  try {
    const users = await PermissionService.getAllUsersPermissions();
    res.json({ success: true, data: users });
  } catch (error) {
    logger.error('Permissions endpoint hatasi', { error: error.message, stack: error.stack });
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
    if (!req.user.isSuperAdmin && parseInt(userId, 10) !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Bu kullanıcının yetkilerini görme izniniz yok' });
    }

    const permissions = await PermissionService.getUserPermissions(parseInt(userId, 10));
    const userType = await PermissionService.getUserType(parseInt(userId, 10));

    res.json({
      success: true,
      data: {
        userId: parseInt(userId, 10),
        userType,
        permissions,
      },
    });
  } catch (error) {
    logger.error('Permissions endpoint hatasi', { error: error.message, stack: error.stack });
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
    if (parseInt(userId, 10) === req.user.id) {
      return res.status(400).json({ success: false, error: 'Kendi yetkinizi değiştiremezsiniz' });
    }

    // Eski yetkileri al (audit log için)
    const oldPermissions = await PermissionService.getUserPermissions(parseInt(userId, 10));
    const oldUserType = await PermissionService.getUserType(parseInt(userId, 10));

    // Kullanıcı tipini güncelle
    if (userType && userType !== oldUserType) {
      // super_admin yapılmasını engelle
      if (userType === 'super_admin') {
        return res.status(400).json({ success: false, error: 'Süper Admin ataması yapılamaz' });
      }
      await PermissionService.updateUserType(parseInt(userId, 10), userType);
    }

    // Yetkileri güncelle
    if (permissions && Array.isArray(permissions)) {
      await PermissionService.updateUserPermissions(parseInt(userId, 10), permissions);
    }

    // Audit log
    await AuditService.log({
      userId: req.user.id,
      action: 'update',
      entityType: 'permission',
      entityId: parseInt(userId, 10),
      entityName: `Kullanıcı #${userId} yetkileri`,
      oldData: { userType: oldUserType, permissions: oldPermissions },
      newData: { userType: userType || oldUserType, permissions },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      requestPath: req.originalUrl,
    });

    res.json({ success: true, message: 'Yetkiler güncellendi' });
  } catch (error) {
    logger.error('Permissions endpoint hatasi', { error: error.message, stack: error.stack });
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
    if (parseInt(userId, 10) === req.user.id) {
      return res.status(400).json({ success: false, error: 'Kendi yetkinize şablon uygulayamazsınız' });
    }

    const count = await PermissionService.applyTemplate(parseInt(userId, 10), templateName);

    // Audit log
    await AuditService.log({
      userId: req.user.id,
      action: 'update',
      entityType: 'permission',
      entityId: parseInt(userId, 10),
      entityName: `Kullanıcı #${userId} - Şablon: ${templateName}`,
      newData: { templateName, appliedModules: count },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      requestPath: req.originalUrl,
      description: `${templateName} şablonu uygulandı (${count} modül)`,
    });

    res.json({
      success: true,
      message: `${templateName} şablonu uygulandı`,
      appliedModules: count,
    });
  } catch (error) {
    logger.error('Permissions endpoint hatasi', { error: error.message, stack: error.stack });
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
    logger.error('Permissions endpoint hatasi', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, error: 'Yetki kontrolü yapılamadı' });
  }
});

export default router;
