/**
 * Scraper Logger - Basit Loglama
 * Console + Opsiyonel DB loglama
 */

import { query } from '../../database.js';

const LOG_LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3, FATAL: 4 };
const LOG_TO_DB = process.env.LOG_TO_DB === 'true';

class Logger {
  constructor() {
    this.level = LOG_LEVELS[process.env.LOG_LEVEL?.toUpperCase()] ?? LOG_LEVELS.INFO;
  }

  setLevel(level) {
    this.level = LOG_LEVELS[level?.toUpperCase()] ?? LOG_LEVELS.INFO;
  }

  async log(level, module, message, data = {}) {
    if (LOG_LEVELS[level] < this.level) return;

    const timestamp = new Date().toISOString();
    const emoji = { DEBUG: '🔍', INFO: 'ℹ️', WARN: '⚠️', ERROR: '❌', FATAL: '💀' }[level] || '';

    // Konsola yaz
    const logFn = LOG_LEVELS[level] >= LOG_LEVELS.ERROR ? console.error
      : LOG_LEVELS[level] >= LOG_LEVELS.WARN ? console.warn
      : console.log;
    logFn(`${emoji} [${timestamp}] [${level}] [${module}] ${message}`, Object.keys(data).length > 0 ? data : '');

    // DB'ye kaydet
    if (LOG_TO_DB && LOG_LEVELS[level] >= LOG_LEVELS.WARN) {
      try {
        await query('INSERT INTO scraper_logs (level, module, message, data) VALUES ($1, $2, $3, $4)', [
          level,
          module,
          message,
          JSON.stringify(data),
        ]);
      } catch {}
    }
  }

  debug(module, message, data) {
    return this.log('DEBUG', module, message, data);
  }
  info(module, message, data) {
    return this.log('INFO', module, message, data);
  }
  warn(module, message, data) {
    return this.log('WARN', module, message, data);
  }
  error(module, message, data) {
    return this.log('ERROR', module, message, data);
  }
  fatal(module, message, data) {
    return this.log('FATAL', module, message, data);
  }

  /**
   * Session başlat (süre ölçümü için)
   */
  createSession(module) {
    const startTime = Date.now();
    return {
      info: (msg, data) => this.info(module, msg, data),
      warn: (msg, data) => this.warn(module, msg, data),
      error: (msg, data) => this.error(module, msg, data),
      end: (data = {}) => {
        const duration = Date.now() - startTime;
        this.info(module, 'Session tamamlandı', { ...data, duration_ms: duration });
        return { duration_ms: duration, ...data };
      },
    };
  }
}

export default new Logger();
