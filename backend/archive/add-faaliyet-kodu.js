// Migration: faaliyet_kodu kolonu ekle
import './src/env-loader.js';
import { pool } from './src/database.js';

async function migrate() {
  try {
    await pool.query(`
      ALTER TABLE firmalar 
      ADD COLUMN IF NOT EXISTS faaliyet_kodu VARCHAR(20)
    `);
    console.log('✅ faaliyet_kodu kolonu eklendi');
    
    // Kontrol
    const result = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'firmalar' AND column_name = 'faaliyet_kodu'
    `);
    console.log('Kolon mevcut:', result.rows.length > 0);
    
    process.exit(0);
  } catch (err) {
    console.error('Hata:', err.message);
    process.exit(1);
  }
}

migrate();
