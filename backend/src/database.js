import pg from 'pg';
import logger from './utils/logger.js';

// Not: .env dosyasi server.js icindeki env-loader.js tarafindan yukleniyor

const { Pool } = pg;

// ============================================================
// Timestamp Timezone Fix
// ============================================================
// Supabase PostgreSQL "timestamp without time zone" kolonlarini
// dondurur. pg driver'i bunlari Node.js'in yerel saati (UTC+3)
// olarak yorumlar, bu da 3 saatlik kaymaya neden olur.
// Bu fix, tum "timestamp without time zone" degerlerini UTC
// olarak parse eder — Supabase'in varsayilan timezone'u UTC'dir.
// ============================================================
const TIMESTAMP_WITHOUT_TZ_OID = 1114;
pg.types.setTypeParser(TIMESTAMP_WITHOUT_TZ_OID, (val) => {
  if (val === null) return null;
  // Sonuna '+00' ekleyerek UTC olarak parse et
  return new Date(`${val}+00`);
});

// ============================================================
// PostgreSQL Baglanti Havuzu (Connection Pool)
// ============================================================
// Supabase uzerinde barindirilan PostgreSQL veritabanina baglanir.
// SSL zorunlu, idle baglantilari 30 saniye sonra kapatilir.
// ============================================================

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 20, // Ayni anda en fazla 20 baglanti
  idleTimeoutMillis: 30000, // 30 saniye bos kalan baglanti kapatilir
  connectionTimeoutMillis: 5000, // 5 saniye icerisinde baglanamaz ise hata
});

// ============================================================
// Baglanti Hatasi Yonetimi
// ============================================================
// Pool'daki idle client'lar baglanti koparmasi durumunda (Supabase
// bakim, timeout vb.) bu event tetiklenir. Eski davranis: process
// crash oluyordu. Yeni davranis: hata loglenir, pool yeni baglanti
// acar, uygulama calismaya devam eder.
// ============================================================

pool.on('error', (err) => {
  logger.error('Veritabani pool hatasi - baglanti havuzda yeniden olusturulacak', {
    error: err.message,
    code: err.code,
  });
  // NOT: process.exit() YAPILMIYOR - pool otomatik yeni baglanti olusturur
});

// ============================================================
// Saglik Kontrolu (Health Check)
// ============================================================
// Her 60 saniyede bir SELECT 1 ile veritabani erisilebilirligini kontrol eder.
// Basarisiz olursa uyari loglar ama uygulamayi durdurmaz.
// ============================================================

let healthCheckTimer = null;
let healthCheckFailCount = 0;

function startHealthCheck() {
  if (healthCheckTimer) return;

  healthCheckTimer = setInterval(async () => {
    try {
      await pool.query('SELECT 1');
      if (healthCheckFailCount > 0) {
        logger.info('Veritabani baglantisi yeniden saglandi', {
          oncekiHataSayisi: healthCheckFailCount,
        });
        healthCheckFailCount = 0;
      }
    } catch (err) {
      healthCheckFailCount++;
      logger.warn('Veritabani saglik kontrolu basarisiz', {
        hata: err.message,
        ardisikHata: healthCheckFailCount,
      });
    }
  }, 60_000); // 60 saniye
}

// Uygulama basladiginda health check'i baslat
startHealthCheck();

// Yavas sorgu esigi (ms)
const SLOW_QUERY_THRESHOLD = parseInt(process.env.SLOW_QUERY_THRESHOLD || '1000', 10);

// ============================================================
// Sorgu Yardimcisi (Query Helper)
// ============================================================

export async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;

    // Yavas sorgu uyarisi (1000ms+ varsayilan)
    if (duration > SLOW_QUERY_THRESHOLD) {
      logger.warn('Yavas sorgu tespit edildi', {
        sure: duration,
        sorgu: text.substring(0, 200),
        paramSayisi: params ? params.length : 0,
        satirSayisi: res.rowCount,
      });
    }

    // Sadece debug modunda tum query log (cok fazla log olusturur)
    if (process.env.LOG_LEVEL === 'debug') {
      logger.debug('Sorgu calistirildi', { sorgu: text.substring(0, 100), sure: duration, satirSayisi: res.rowCount });
    }
    return res;
  } catch (error) {
    const duration = Date.now() - start;

    // Baglanti hatalarini ozel olarak logla
    const isConnectionError = ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EPIPE', '57P01', '57P03'].includes(
      error.code
    );

    if (isConnectionError) {
      logger.error('Veritabani baglanti hatasi - sorgu basarisiz', {
        hataKodu: error.code,
        hata: error.message,
        sure: duration,
        sorgu: text.substring(0, 100),
      });
    } else {
      logger.error('Sorgu hatasi', {
        sorgu: text.substring(0, 200),
        hata: error.message,
        sure: duration,
      });
    }
    throw error;
  }
}

// ============================================================
// Transaction Yardimcisi
// ============================================================

export async function transaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Temiz kapatma (graceful shutdown)
export function closePool() {
  if (healthCheckTimer) {
    clearInterval(healthCheckTimer);
    healthCheckTimer = null;
  }
  return pool.end();
}

export { pool };
export default pool;
