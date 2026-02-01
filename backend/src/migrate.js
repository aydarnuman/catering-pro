/**
 * ⚠️ DEPRECATED - Bu dosya artık kullanılmıyor!
 * 
 * Migration sistemi Supabase CLI'a taşındı.
 * Yeni komutlar:
 *   - supabase migration new <isim>
 *   - supabase db push
 *   - supabase migration list
 * 
 * Bu dosya referans için saklanıyor.
 * @deprecated 2026-02-01
 */

console.warn('⚠️  DEPRECATED: Bu migration sistemi artık kullanılmıyor.');
console.warn('📦 Supabase CLI kullanın: supabase db push');
process.exit(1);

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';

// Root .env dosyasını yükle
dotenv.config({ path: path.join(process.cwd(), '../.env') });

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
});

async function runMigrations() {
  const client = await pool.connect();

  try {
    // Migration tablosu oluştur
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Migration dosyalarını oku
    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      // Daha önce çalıştırıldı mı kontrol et
      const result = await client.query('SELECT * FROM migrations WHERE filename = $1', [file]);

      if (result.rows.length > 0) {
        continue;
      }

      // Migration'ı çalıştır
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      await client.query(sql);

      // Kaydet
      await client.query('INSERT INTO migrations (filename) VALUES ($1)', [file]);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations();
