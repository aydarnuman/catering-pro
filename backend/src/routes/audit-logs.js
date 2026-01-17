/**
 * AUDIT LOG API
 * İşlem geçmişi yönetimi
 * /api/audit-logs
 */

import express from 'express';
import AuditService from '../services/audit-service.js';
import { authenticate, requireAdmin, requireSuperAdmin } from '../middleware/auth.js';
import { pool } from '../database.js';

const router = express.Router();

/**
 * GET /api/audit-logs
 * İşlem geçmişini listele (filtreleme ve sayfalama ile)
 */
router.get('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      user_id,
      action,
      entity_type,
      start_date,
      end_date,
      search
    } = req.query;

    // Normal admin sadece kendi loglarını görebilir
    let userId = user_id ? parseInt(user_id) : null;
    if (!req.user.isSuperAdmin && userId && userId !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Sadece kendi işlem geçmişinizi görebilirsiniz' });
    }
    
    // Normal admin ise sadece kendi loglarını göster
    if (!req.user.isSuperAdmin) {
      userId = req.user.id;
    }

    const result = await AuditService.getLogs({
      page: parseInt(page),
      limit: parseInt(limit),
      userId,
      action,
      entityType: entity_type,
      startDate: start_date,
      endDate: end_date,
      search
    });

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({ success: false, error: 'İşlem geçmişi alınamadı' });
  }
});

/**
 * GET /api/audit-logs/stats
 * İşlem istatistikleri
 */
router.get('/stats', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const stats = await AuditService.getStats(parseInt(days));
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Get audit stats error:', error);
    res.status(500).json({ success: false, error: 'İstatistikler alınamadı' });
  }
});

/**
 * GET /api/audit-logs/summary
 * Özet bilgiler (dashboard için)
 */
router.get('/summary', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    // Bugünkü işlemler
    const todayResult = await pool.query(`
      SELECT COUNT(*) as count FROM audit_logs 
      WHERE DATE(created_at) = CURRENT_DATE
    `);

    // Son 7 gün
    const weekResult = await pool.query(`
      SELECT COUNT(*) as count FROM audit_logs 
      WHERE created_at >= NOW() - INTERVAL '7 days'
    `);

    // En aktif kullanıcılar (son 7 gün)
    const activeUsersResult = await pool.query(`
      SELECT user_name, COUNT(*) as action_count
      FROM audit_logs
      WHERE created_at >= NOW() - INTERVAL '7 days' AND user_name IS NOT NULL
      GROUP BY user_name
      ORDER BY action_count DESC
      LIMIT 5
    `);

    // İşlem dağılımı (son 7 gün)
    const actionDistResult = await pool.query(`
      SELECT action, COUNT(*) as count
      FROM audit_logs
      WHERE created_at >= NOW() - INTERVAL '7 days'
      GROUP BY action
      ORDER BY count DESC
    `);

    // Modül dağılımı (son 7 gün)
    const moduleDistResult = await pool.query(`
      SELECT entity_type, COUNT(*) as count
      FROM audit_logs
      WHERE created_at >= NOW() - INTERVAL '7 days'
      GROUP BY entity_type
      ORDER BY count DESC
      LIMIT 10
    `);

    res.json({
      success: true,
      data: {
        todayCount: parseInt(todayResult.rows[0].count),
        weekCount: parseInt(weekResult.rows[0].count),
        activeUsers: activeUsersResult.rows,
        actionDistribution: actionDistResult.rows,
        moduleDistribution: moduleDistResult.rows
      }
    });
  } catch (error) {
    console.error('Get audit summary error:', error);
    res.status(500).json({ success: false, error: 'Özet bilgiler alınamadı' });
  }
});

/**
 * GET /api/audit-logs/:id
 * Tek bir log detayı
 */
router.get('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const log = await AuditService.getLogById(parseInt(id));

    if (!log) {
      return res.status(404).json({ success: false, error: 'Log bulunamadı' });
    }

    // Normal admin sadece kendi loglarını görebilir
    if (!req.user.isSuperAdmin && log.user_id !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Bu log kaydını görme yetkiniz yok' });
    }

    res.json({ success: true, data: log });
  } catch (error) {
    console.error('Get audit log error:', error);
    res.status(500).json({ success: false, error: 'Log detayı alınamadı' });
  }
});

/**
 * GET /api/audit-logs/user/:userId/activity
 * Kullanıcının son aktiviteleri
 */
router.get('/user/:userId/activity', authenticate, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 10 } = req.query;

    // Normal admin sadece kendi aktivitesini görebilir
    if (!req.user.isSuperAdmin && parseInt(userId) !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Bu kullanıcının aktivitelerini görme yetkiniz yok' });
    }

    const activity = await AuditService.getUserActivity(parseInt(userId), parseInt(limit));
    res.json({ success: true, data: activity });
  } catch (error) {
    console.error('Get user activity error:', error);
    res.status(500).json({ success: false, error: 'Aktiviteler alınamadı' });
  }
});

/**
 * GET /api/audit-logs/entity/:entityType/:entityId
 * Belirli bir kaydın geçmişi
 */
router.get('/entity/:entityType/:entityId', authenticate, requireAdmin, async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    const { limit = 20 } = req.query;

    const result = await pool.query(
      `SELECT id, user_name, action, changes, description, created_at
       FROM audit_logs
       WHERE entity_type = $1 AND entity_id = $2
       ORDER BY created_at DESC
       LIMIT $3`,
      [entityType, parseInt(entityId), parseInt(limit)]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Get entity history error:', error);
    res.status(500).json({ success: false, error: 'Kayıt geçmişi alınamadı' });
  }
});

/**
 * GET /api/audit-logs/filters
 * Filtreleme seçeneklerini getir
 */
router.get('/meta/filters', authenticate, requireAdmin, async (req, res) => {
  try {
    // Kullanıcı listesi (süper admin için)
    let users = [];
    if (req.user.isSuperAdmin) {
      const usersResult = await pool.query(
        'SELECT DISTINCT user_id, user_name FROM audit_logs WHERE user_name IS NOT NULL ORDER BY user_name'
      );
      users = usersResult.rows;
    }

    // İşlem tipleri
    const actionsResult = await pool.query(
      'SELECT DISTINCT action FROM audit_logs ORDER BY action'
    );

    // Entity tipleri
    const entityTypesResult = await pool.query(
      'SELECT DISTINCT entity_type FROM audit_logs ORDER BY entity_type'
    );

    res.json({
      success: true,
      data: {
        users,
        actions: actionsResult.rows.map(r => r.action),
        entityTypes: entityTypesResult.rows.map(r => r.entity_type)
      }
    });
  } catch (error) {
    console.error('Get filters error:', error);
    res.status(500).json({ success: false, error: 'Filtre seçenekleri alınamadı' });
  }
});

export default router;
