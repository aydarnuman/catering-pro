import pg from 'pg';
import logger from './utils/logger.js';

// Note: .env is loaded by env-loader.js in server.js

const { Pool } = pg;

// Supabase için SSL gerekli
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Bağlantı hatası yönetimi
pool.on('error', (err) => {
  logger.error('Database pool error', { error: err.message, stack: err.stack });
});

// Slow query threshold (ms)
const SLOW_QUERY_THRESHOLD = parseInt(process.env.SLOW_QUERY_THRESHOLD || '1000', 10);

// Query helper
export async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;

    // Yavaş sorgu uyarısı (1000ms+ varsayılan)
    if (duration > SLOW_QUERY_THRESHOLD) {
      logger.warn('Slow query detected', {
        duration,
        query: text.substring(0, 200),
        params: params ? `${params.length} params` : 'none',
        rows: res.rowCount,
      });
    }

    // Sadece debug modunda tüm query log (çok fazla log oluşturur)
    if (process.env.LOG_LEVEL === 'debug') {
      logger.debug('Executed query', { text: text.substring(0, 100), duration, rows: res.rowCount });
    }
    return res;
  } catch (error) {
    const duration = Date.now() - start;
    logger.error('Query error', {
      query: text.substring(0, 200),
      error: error.message,
      duration,
    });
    throw error;
  }
}

// Transaction helper
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

export { pool };
export default pool;
