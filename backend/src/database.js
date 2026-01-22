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

// Query helper
export async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    // Sadece debug modunda query log (çok fazla log oluşturur)
    if (process.env.LOG_LEVEL === 'debug') {
      logger.debug('Executed query', { text: text.substring(0, 100), duration, rows: res.rowCount });
    }
    return res;
  } catch (error) {
    logger.error('Query error', { query: text.substring(0, 200), error: error.message });
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
