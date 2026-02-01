/**
 * ⚠️ DEPRECATED - Bu dosya artık kullanılmıyor!
 * 
 * Migration sistemi Supabase CLI'a taşındı (2026-02-01).
 * server.js'deki import yorum satırına alındı.
 * 
 * Yeni sistem: supabase/migrations/ + Supabase CLI
 * Komutlar: supabase db push, supabase migration new
 * 
 * @deprecated 2026-02-01
 */

// Otomatik Migration Runner (DEPRECATED)
// - Startup'ta tüm migration'ları kontrol eder
// - Çalışmamış olanları sırayla çalıştırır
// - Her migration sadece bir kez çalışır

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { query } from '../database.js';
import logger from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Migration takip tablosunu oluştur
async function ensureMigrationTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMP DEFAULT NOW(),
      success BOOLEAN DEFAULT true,
      error_message TEXT
    );
  `;
  await query(sql);
}

// Çalışmış migration'ları al
async function getExecutedMigrations() {
  const result = await query('SELECT name FROM _migrations WHERE success = true');
  return new Set(result.rows.map((r) => r.name));
}

// "Already exists" hatalarını kontrol et (zararsız hatalar)
function isHarmlessError(error) {
  const errorMsg = error.message?.toLowerCase() || '';
  const harmlessPatterns = [
    'already exists',
    'duplicate key',
    'relation.*already exists',
    'constraint.*already exists',
    'trigger.*already exists',
    'index.*already exists',
    'cannot change name of',
    'does not exist', // DROP IF EXISTS sonrası oluşan hatalar
    'column.*does not exist', // ALTER TABLE IF EXISTS sonrası
  ];

  return harmlessPatterns.some((pattern) => {
    try {
      return new RegExp(pattern).test(errorMsg);
    } catch {
      return errorMsg.includes(pattern);
    }
  });
}

// Tek migration çalıştır
async function executeMigration(filePath, fileName) {
  const sql = fs.readFileSync(filePath, 'utf8');

  try {
    await query(sql);
    await query('INSERT INTO _migrations (name, success) VALUES ($1, true) ON CONFLICT (name) DO NOTHING', [fileName]);
    return { success: true };
  } catch (error) {
    // Zararsız hataları (already exists vb.) başarılı olarak işaretle
    if (isHarmlessError(error)) {
      logger.warn(`⚠️  Migration uyarısı (zararsız): ${fileName}`, {
        error: error.message,
        note: 'Bu hata genellikle zaten var olan objeler nedeniyle oluşur ve güvenlidir.',
      });

      // Zararsız hataları da başarılı olarak kaydet
      await query(
        'INSERT INTO _migrations (name, success, error_message) VALUES ($1, true, $2) ON CONFLICT (name) DO UPDATE SET success = true, error_message = $2',
        [fileName, `WARNING: ${error.message}`]
      );
      return { success: true, warning: error.message };
    }

    // Gerçek hataları kaydet
    logger.error(`❌ Migration hatası: ${fileName}`, { error: error.message });
    await query(
      'INSERT INTO _migrations (name, success, error_message) VALUES ($1, false, $2) ON CONFLICT (name) DO UPDATE SET error_message = $2, success = false',
      [fileName, error.message]
    );
    return { success: false, error: error.message };
  }
}

// Ana runner fonksiyonu
export async function runMigrations() {
  const migrationsDir = path.join(__dirname, '..', 'migrations');

  if (!fs.existsSync(migrationsDir)) {
    logger.warn('Migration klasörü bulunamadı');
    return { executed: 0, skipped: 0, failed: 0 };
  }

  try {
    // Migration tablosunu oluştur
    await ensureMigrationTable();

    // Çalışmış migration'ları al
    const executed = await getExecutedMigrations();

    // SQL dosyalarını al ve sırala
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort((a, b) => {
        // Dosya adındaki numaraya göre sırala (001_, 002_, vb.)
        const numA = parseInt(a.split('_')[0], 10) || 999;
        const numB = parseInt(b.split('_')[0], 10) || 999;
        return numA - numB;
      });

    const stats = { executed: 0, skipped: 0, failed: 0 };

    for (const file of files) {
      if (executed.has(file)) {
        stats.skipped++;
        continue;
      }

      const filePath = path.join(migrationsDir, file);
      logger.info(`📦 Migration çalıştırılıyor: ${file}`);

      const result = await executeMigration(filePath, file);

      if (result.success) {
        if (result.warning) {
          // Zararsız uyarı ile başarılı
          stats.executed++;
        } else {
          logger.info(`✅ Migration başarılı: ${file}`);
          stats.executed++;
        }
      } else {
        logger.error(`❌ Migration hatası: ${file}`, { error: result.error });
        stats.failed++;
        // Kritik migration hatası - devam etme
        // break; // İsterseniz hata durumunda durdurmak için aktif edin
      }
    }

    logger.info(`📊 Migration özeti: ${stats.executed} çalıştırıldı, ${stats.skipped} atlandı, ${stats.failed} hatalı`);

    if (stats.failed > 0) {
      logger.warn(`⚠️  ${stats.failed} migration hatalı - kontrol edin`);
    }

    return stats;
  } catch (error) {
    logger.error('Migration runner hatası', { error: error.message });
    return { executed: 0, skipped: 0, failed: 0, error: error.message };
  }
}

export default runMigrations;
