/**
 * AUDIT LOG SERVİSİ
 * Tüm kullanıcı işlemlerini kayıt altına alır
 */

import { pool } from '../database.js';
import logger from '../utils/logger.js';

const AuditService = {
  /**
   * İşlem kaydı oluştur
   * @param {Object} params
   * @param {number} params.userId - Kullanıcı ID
   * @param {string} params.action - create, update, delete, login, logout, export, view
   * @param {string} params.entityType - user, invoice, tender, cari, personel, stok, etc.
   * @param {number} [params.entityId] - İlgili kaydın ID'si
   * @param {string} [params.entityName] - Kaydın adı/başlığı
   * @param {Object} [params.oldData] - Değişiklik öncesi veriler
   * @param {Object} [params.newData] - Değişiklik sonrası veriler
   * @param {string} [params.ipAddress] - IP adresi
   * @param {string} [params.userAgent] - Tarayıcı bilgisi
   * @param {string} [params.requestPath] - API endpoint
   * @param {string} [params.description] - Okunabilir açıklama
   */
  async log(params) {
    try {
      const {
        userId,
        action,
        entityType,
        entityId = null,
        entityName = null,
        oldData = null,
        newData = null,
        ipAddress = null,
        userAgent = null,
        requestPath = null,
        description = null,
      } = params;

      // Kullanıcı bilgilerini al
      let userName = null;
      let userEmail = null;

      if (userId) {
        const userResult = await pool.query('SELECT name, email FROM users WHERE id = $1', [userId]);
        if (userResult.rows.length > 0) {
          userName = userResult.rows[0].name;
          userEmail = userResult.rows[0].email;
        }
      }

      // Değişiklikleri hesapla
      let changes = null;
      if (oldData && newData) {
        changes = AuditService.calculateChanges(oldData, newData);
      }

      // Açıklama oluştur
      const finalDescription =
        description || AuditService.generateDescription(action, entityType, entityName, userName);

      const result = await pool.query(
        `INSERT INTO audit_logs 
         (user_id, user_name, user_email, action, entity_type, entity_id, entity_name, 
          old_data, new_data, changes, ip_address, user_agent, request_path, description)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         RETURNING id`,
        [
          userId,
          userName,
          userEmail,
          action,
          entityType,
          entityId,
          entityName,
          oldData ? JSON.stringify(oldData) : null,
          newData ? JSON.stringify(newData) : null,
          changes ? JSON.stringify(changes) : null,
          ipAddress,
          userAgent,
          requestPath,
          finalDescription,
        ]
      );

      return result.rows[0].id;
    } catch (error) {
      // Audit hataları uygulamayı durdurmamalı ama loglanmalı
      logger.error('Audit log yazma hatasi', {
        userId: params.userId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        error: error.message,
        stack: error.stack,
      });
      return null;
    }
  },

  /**
   * Değişiklikleri hesapla
   */
  calculateChanges(oldData, newData) {
    const changes = {};
    const allKeys = new Set([...Object.keys(oldData || {}), ...Object.keys(newData || {})]);

    for (const key of allKeys) {
      // Hassas alanları gizle
      if (['password', 'password_hash', 'token'].includes(key)) continue;

      const oldVal = oldData?.[key];
      const newVal = newData?.[key];

      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        changes[key] = {
          old: oldVal,
          new: newVal,
        };
      }
    }

    return Object.keys(changes).length > 0 ? changes : null;
  },

  /**
   * Okunabilir açıklama oluştur
   */
  generateDescription(action, entityType, entityName, userName) {
    const entityNames = {
      user: 'kullanıcı',
      invoice: 'fatura',
      tender: 'ihale',
      cari: 'cari hesap',
      personel: 'personel',
      stok: 'stok kartı',
      stok_hareket: 'stok hareketi',
      firma: 'firma',
      bordro: 'bordro',
      kasa_banka: 'kasa/banka',
      permission: 'yetki',
      menu: 'menü',
      recete: 'reçete',
      demirbas: 'demirbaş',
    };

    const actionNames = {
      create: 'oluşturdu',
      update: 'güncelledi',
      delete: 'sildi',
      login: 'giriş yaptı',
      logout: 'çıkış yaptı',
      export: 'dışa aktardı',
      view: 'görüntüledi',
    };

    const entity = entityNames[entityType] || entityType;
    const actionText = actionNames[action] || action;
    const name = entityName ? `"${entityName}"` : '';
    const user = userName || 'Kullanıcı';

    if (action === 'login') return `${user} sisteme giriş yaptı`;
    if (action === 'logout') return `${user} sistemden çıkış yaptı`;

    return `${user} ${name} ${entity} kaydını ${actionText}`;
  },

  /**
   * Logları getir (sayfalama ve filtreleme ile)
   */
  async getLogs(options = {}) {
    const {
      page = 1,
      limit = 50,
      userId = null,
      action = null,
      entityType = null,
      startDate = null,
      endDate = null,
      search = null,
    } = options;

    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (userId) {
      conditions.push(`user_id = $${paramIndex++}`);
      params.push(userId);
    }

    if (action) {
      conditions.push(`action = $${paramIndex++}`);
      params.push(action);
    }

    if (entityType) {
      conditions.push(`entity_type = $${paramIndex++}`);
      params.push(entityType);
    }

    if (startDate) {
      conditions.push(`created_at >= $${paramIndex++}`);
      params.push(startDate);
    }

    if (endDate) {
      conditions.push(`created_at <= $${paramIndex++}`);
      params.push(endDate);
    }

    if (search) {
      conditions.push(`(
        description ILIKE $${paramIndex} OR
        entity_name ILIKE $${paramIndex} OR
        user_name ILIKE $${paramIndex}
      )`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Toplam sayı
    const countResult = await pool.query(`SELECT COUNT(*) FROM audit_logs ${whereClause}`, params);
    const total = parseInt(countResult.rows[0].count, 10);

    // Loglar
    const result = await pool.query(
      `SELECT 
        id, user_id, user_name, user_email, action, entity_type, 
        entity_id, entity_name, changes, ip_address, description, created_at
       FROM audit_logs 
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...params, limit, offset]
    );

    return {
      logs: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  /**
   * Tek bir log detayını getir
   */
  async getLogById(id) {
    const result = await pool.query('SELECT * FROM audit_logs WHERE id = $1', [id]);
    return result.rows[0] || null;
  },

  /**
   * Kullanıcının son işlemlerini getir
   */
  async getUserActivity(userId, limit = 10) {
    const result = await pool.query(
      `SELECT action, entity_type, entity_name, description, created_at
       FROM audit_logs
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );
    return result.rows;
  },

  /**
   * İstatistikler
   */
  async getStats(days = 7) {
    const result = await pool.query(`
      SELECT 
        action,
        entity_type,
        COUNT(*) as count,
        DATE(created_at) as date
      FROM audit_logs
      WHERE created_at >= NOW() - INTERVAL '${days} days'
      GROUP BY action, entity_type, DATE(created_at)
      ORDER BY date DESC
    `);
    return result.rows;
  },
};

export default AuditService;
