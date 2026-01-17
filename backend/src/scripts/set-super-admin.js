/**
 * Mevcut admin kullanicilarini super_admin yap
 */
import { query, pool } from '../database.js';

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
      console.log('Super Admin olarak guncellenen kullanicilar:');
      result.rows.forEach(u => {
        console.log(`  - ${u.name} (${u.email}) -> super_admin`);
      });
    } else {
      console.log('Zaten super_admin olan kullanicilar mevcut veya guncellenecek admin yok');
    }

    // Mevcut super_admin'leri goster
    const admins = await query(`
      SELECT id, name, email, user_type FROM users WHERE role = 'admin'
    `);
    console.log('\nTum Admin Kullanicilari:');
    admins.rows.forEach(u => {
      console.log(`  - ${u.name} (${u.email}) [${u.user_type || 'user_type yok'}]`);
    });

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('Hata:', error);
    process.exit(1);
  }
}

setSuperAdmin();
