import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Root .env dosyasını yükle
dotenv.config({ path: path.join(process.cwd(), '../.env') });

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Supabase için gerekli
});

async function runMigrations() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Migration başlıyor...');
    
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
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();
    
    for (const file of files) {
      // Daha önce çalıştırıldı mı kontrol et
      const result = await client.query(
        'SELECT * FROM migrations WHERE filename = $1',
        [file]
      );
      
      if (result.rows.length > 0) {
        console.log(`⏭️  Atlandı: ${file} (zaten çalıştırılmış)`);
        continue;
      }
      
      // Migration'ı çalıştır
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      await client.query(sql);
      
      // Kaydet
      await client.query(
        'INSERT INTO migrations (filename) VALUES ($1)',
        [file]
      );
      
      console.log(`✅ Çalıştırıldı: ${file}`);
    }
    
    console.log('✨ Tüm migration\'lar başarıyla tamamlandı!');
    
  } catch (error) {
    console.error('❌ Migration hatası:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations();
