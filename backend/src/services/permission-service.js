/**
 * YETKİ SERVİSİ
 * Rol bazlı erişim kontrolü (RBAC)
 */

import { pool } from '../database.js';

class PermissionService {
  /**
   * Kullanıcının belirli bir modüldeki yetkisini kontrol et
   * @param {number} userId
   * @param {string} moduleName - ihale, fatura, cari, stok, personel, bordro, etc.
   * @param {string} action - view, create, edit, delete, export
   * @returns {boolean}
   */
  static async check(userId, moduleName, action) {
    try {
      // Veritabanı fonksiyonunu çağır
      const result = await pool.query('SELECT check_user_permission($1, $2, $3) as has_permission', [
        userId,
        moduleName,
        action,
      ]);
      return result.rows[0]?.has_permission || false;
    } catch (_error) {
      return false;
    }
  }

  /**
   * Kullanıcının tüm yetkilerini getir
   */
  static async getUserPermissions(userId) {
    try {
      const result = await pool.query(
        `SELECT 
          m.name as module_name,
          m.display_name,
          m.icon,
          m.color,
          up.can_view,
          up.can_create,
          up.can_edit,
          up.can_delete,
          up.can_export
         FROM modules m
         LEFT JOIN user_permissions up ON up.module_id = m.id AND up.user_id = $1
         WHERE m.is_active = true
         ORDER BY m.sort_order`,
        [userId]
      );
      return result.rows;
    } catch (_error) {
      return [];
    }
  }

  /**
   * Kullanıcı tipini kontrol et
   */
  static async getUserType(userId) {
    try {
      const result = await pool.query('SELECT user_type FROM users WHERE id = $1 AND is_active = true', [userId]);
      return result.rows[0]?.user_type || 'user';
    } catch (_error) {
      return 'user';
    }
  }

  /**
   * Super admin mi kontrol et
   */
  static async isSuperAdmin(userId) {
    const userType = await PermissionService.getUserType(userId);
    return userType === 'super_admin';
  }

  /**
   * Kullanıcının yetkilerini güncelle
   * @param {number} userId
   * @param {Array} permissions - [{module_name, can_view, can_create, can_edit, can_delete, can_export}]
   */
  static async updateUserPermissions(userId, permissions) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const perm of permissions) {
        // Modül ID'sini bul
        const moduleResult = await client.query('SELECT id FROM modules WHERE name = $1', [perm.module_name]);

        if (moduleResult.rows.length === 0) continue;

        const moduleId = moduleResult.rows[0].id;

        await client.query(
          `INSERT INTO user_permissions (user_id, module_id, can_view, can_create, can_edit, can_delete, can_export)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (user_id, module_id) DO UPDATE SET
             can_view = EXCLUDED.can_view,
             can_create = EXCLUDED.can_create,
             can_edit = EXCLUDED.can_edit,
             can_delete = EXCLUDED.can_delete,
             can_export = EXCLUDED.can_export,
             updated_at = NOW()`,
          [
            userId,
            moduleId,
            perm.can_view || false,
            perm.can_create || false,
            perm.can_edit || false,
            perm.can_delete || false,
            perm.can_export || false,
          ]
        );
      }

      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Şablon uygula
   */
  static async applyTemplate(userId, templateName) {
    const result = await pool.query('SELECT apply_permission_template($1, $2) as count', [userId, templateName]);
    return result.rows[0]?.count || 0;
  }

  /**
   * Kullanıcı tipini güncelle
   */
  static async updateUserType(userId, userType) {
    await pool.query('UPDATE users SET user_type = $1 WHERE id = $2', [userType, userId]);
    return true;
  }

  /**
   * Tüm modülleri getir
   */
  static async getModules() {
    try {
      const result = await pool.query('SELECT * FROM modules WHERE is_active = true ORDER BY sort_order');
      return result.rows;
    } catch (_error) {
      return [];
    }
  }

  /**
   * Tüm şablonları getir
   */
  static async getTemplates() {
    try {
      const result = await pool.query('SELECT * FROM permission_templates ORDER BY is_system DESC, name');
      return result.rows;
    } catch (_error) {
      return [];
    }
  }

  /**
   * Belirli bir şablonu getir
   */
  static async getTemplate(id) {
    try {
      const result = await pool.query('SELECT * FROM permission_templates WHERE id = $1', [id]);
      return result.rows[0] || null;
    } catch (_error) {
      return null;
    }
  }

  /**
   * Yeni şablon oluştur
   */
  static async createTemplate({ name, display_name, description, permissions }) {
    const result = await pool.query(
      `INSERT INTO permission_templates (name, display_name, description, permissions, is_system)
         VALUES ($1, $2, $3, $4, false)
         RETURNING *`,
      [name, display_name, description, JSON.stringify(permissions)]
    );
    return result.rows[0];
  }

  /**
   * Şablonu güncelle
   */
  static async updateTemplate(id, { display_name, description, permissions }) {
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (display_name !== undefined) {
      updates.push(`display_name = $${paramCount++}`);
      values.push(display_name);
    }

    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description);
    }

    if (permissions !== undefined) {
      updates.push(`permissions = $${paramCount++}`);
      values.push(JSON.stringify(permissions));
    }

    if (updates.length === 0) {
      return await PermissionService.getTemplate(id);
    }

    values.push(id);
    const result = await pool.query(
      `UPDATE permission_templates 
         SET ${updates.join(', ')}
         WHERE id = $${paramCount}
         RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  /**
   * Şablonu sil
   */
  static async deleteTemplate(id) {
    await pool.query('DELETE FROM permission_templates WHERE id = $1 AND is_system = false', [id]);
    return true;
  }

  /**
   * Yetki özeti (tüm kullanıcılar için)
   */
  static async getAllUsersPermissions() {
    try {
      const result = await pool.query('SELECT * FROM user_permissions_summary ORDER BY user_name');
      return result.rows;
    } catch (_error) {
      return [];
    }
  }

  /**
   * Kullanıcının erişebileceği modülleri getir (sidebar için)
   */
  static async getAccessibleModules(userId) {
    try {
      // Kullanıcı tipini kontrol et
      const userType = await PermissionService.getUserType(userId);

      // Super admin tüm modüllere erişebilir
      if (userType === 'super_admin') {
        return await PermissionService.getModules();
      }

      // Diğerleri için yetki kontrolü
      const result = await pool.query(
        `SELECT m.*
         FROM modules m
         JOIN user_permissions up ON up.module_id = m.id
         WHERE up.user_id = $1 AND up.can_view = true AND m.is_active = true
         ORDER BY m.sort_order`,
        [userId]
      );
      return result.rows;
    } catch (_error) {
      return [];
    }
  }
}

export default PermissionService;
