/**
 * Mevcut admin kullanicilarini super_admin yap
 */
import { pool, query } from '../database.js';

async function setSuperAdmin() {
  try {
    // Ilk admin kullanicisini super_admin yap
    const result = await query(`
      UPDATE users 
      SET user_type = 'super_admin' 
      WHERE role = 'admin' 
      AND (user_type IS NULL OR user_type != 'super_admin')
      RETURNING id, name, email, user_type
    `);

    if (result.rows.length > 0) {
      result.rows.forEach((_u) => {});
    } else {
    }

    // Mevcut super_admin'leri goster
    const admins = await query(`
      SELECT id, name, email, user_type FROM users WHERE role = 'admin'
    `);
    admins.rows.forEach((_u) => {});

    await pool.end();
    process.exit(0);
  } catch (_error) {
    process.exit(1);
  }
}

setSuperAdmin();
