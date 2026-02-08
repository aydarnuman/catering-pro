/**
 * Winston Logger Configuration
 * Catering Pro - Merkezi Loglama Sistemi
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Log klasörü
const logDir = path.join(__dirname, '../../logs');

// Log formatı
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;

    // Meta bilgileri ekle
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }

    // Stack trace ekle (hata durumunda)
    if (stack) {
      log += `\n${stack}`;
    }

    return log;
  })
);

// Console formatı (renkli)
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let log = `${timestamp} ${level}: ${message}`;
    if (Object.keys(meta).length > 0 && !meta.stack) {
      log += ` ${JSON.stringify(meta)}`;
    }
    return log;
  })
);

// Daily rotate transport - Genel loglar
const dailyRotateTransport = new DailyRotateFile({
  dirname: logDir,
  filename: 'app-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d', // 14 gün sakla
  format: logFormat,
});

// Daily rotate transport - Sadece hatalar
const errorRotateTransport = new DailyRotateFile({
  dirname: logDir,
  filename: 'error-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '30d', // 30 gün sakla
  level: 'error',
  format: logFormat,
});

// Logger oluştur
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'catering-api' },
  transports: [dailyRotateTransport, errorRotateTransport],
  // Uncaught exception handling
  exceptionHandlers: [
    new DailyRotateFile({
      dirname: logDir,
      filename: 'exceptions-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '30d',
    }),
  ],
  rejectionHandlers: [
    new DailyRotateFile({
      dirname: logDir,
      filename: 'rejections-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '30d',
    }),
  ],
});

// Development ortamında console'a da yaz
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: consoleFormat,
    })
  );
}

// Polling endpoint'leri — her birkaç saniyede çağrılıyor, loglama gereksiz
const QUIET_PATTERNS = [
  '/api/contractors/bildirimler/liste',
  '/api/notifications/unread-count',
  '/api/invoices/stats',
  '/istihbarat',       // polling status endpoint
];

// HTTP request logger middleware
export const httpLogger = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const url = req.originalUrl;
    const status = res.statusCode;

    // 304 Not Modified + polling endpoint → loglama (gürültü azaltma)
    const isQuiet = status === 304 ||
      (req.method === 'GET' && QUIET_PATTERNS.some(p => url.includes(p)));
    if (isQuiet && status < 400) return;

    const logData = {
      method: req.method,
      url,
      status,
      duration: `${duration}ms`,
      ip: req.ip || req.connection.remoteAddress,
    };

    // 4xx ve 5xx hataları warn/error olarak logla
    if (status >= 500) {
      logger.error('HTTP Request', logData);
    } else if (status >= 400) {
      logger.warn('HTTP Request', logData);
    } else {
      logger.info('HTTP Request', logData);
    }
  });

  next();
};

// Özel log fonksiyonları
export const logDB = (action, details) => {
  logger.info(`DB: ${action}`, { type: 'database', ...details });
};

export const logAuth = (action, userId, details = {}) => {
  logger.info(`Auth: ${action}`, { type: 'auth', userId, ...details });
};

export const logAPI = (endpoint, action, details = {}) => {
  logger.info(`API: ${endpoint} - ${action}`, { type: 'api', ...details });
};

export const logError = (context, error, details = {}) => {
  logger.error(`${context}: ${error.message}`, {
    type: 'error',
    stack: error.stack,
    ...details,
  });
};

export const logScraper = (action, details = {}) => {
  logger.info(`Scraper: ${action}`, { type: 'scraper', ...details });
};

export const logAI = (service, action, details = {}) => {
  logger.info(`AI [${service}]: ${action}`, { type: 'ai', ...details });
};

export default logger;
