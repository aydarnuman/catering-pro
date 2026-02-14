/**
 * Circuit Breaker - API ve DB çağrıları için koruma mekanizması
 *
 * 1. API (Claude): "credit balance too low" hatasında anında trip → tüm çağrılar skip
 * 2. DB: 3 ardışık timeout sonrası 30sn pause → otomatik recovery
 */

import logger from './logger.js';

// ═══════════════════════════════════════════════════════════════════════════
// API CIRCUIT BREAKER (Claude / Anthropic)
// ═══════════════════════════════════════════════════════════════════════════

const apiState = {
  tripped: false,
  reason: null,
  trippedAt: null,
  skippedCalls: 0,
};

// Fatal hata pattern'leri — bu hatalar ilk görüldüğünde pipeline durmalı
const FATAL_API_PATTERNS = [
  'credit balance is too low',
  'insufficient_quota',
  'billing_not_active',
  'account_suspended',
];

/**
 * API çağrısı öncesi kontrol.
 * Tripped durumda ise çağrıyı engeller.
 * @returns {{ allowed: boolean, reason?: string }}
 */
export function checkApiCircuit() {
  if (!apiState.tripped) {
    return { allowed: true };
  }

  apiState.skippedCalls++;
  return {
    allowed: false,
    reason: apiState.reason,
  };
}

/**
 * API hatasını değerlendir. Fatal ise circuit'i trip et.
 * @param {Error} error - Anthropic SDK hatası
 * @returns {boolean} Fatal hata mı (true = pipeline durmalı)
 */
export function reportApiError(error) {
  const message = (error?.message || '').toLowerCase();
  const statusMessage = (error?.error?.message || '').toLowerCase();
  const combined = `${message} ${statusMessage}`;

  const isFatal = FATAL_API_PATTERNS.some((pattern) => combined.includes(pattern));

  if (isFatal && !apiState.tripped) {
    apiState.tripped = true;
    apiState.reason = error.message || 'Unknown fatal API error';
    apiState.trippedAt = new Date();
    apiState.skippedCalls = 0;

    logger.error('⛔ API Circuit Breaker TRIPPED — tüm Claude çağrıları durduruldu', {
      module: 'circuit-breaker',
      reason: apiState.reason,
      timestamp: apiState.trippedAt.toISOString(),
    });
  }

  return isFatal;
}

/**
 * API circuit durumunu döndür (monitoring / health-check için)
 */
export function getApiCircuitStatus() {
  return { ...apiState };
}

/**
 * API circuit'i sıfırla (manuel recovery, restart sonrası)
 */
export function resetApiCircuit() {
  const wasTripped = apiState.tripped;
  apiState.tripped = false;
  apiState.reason = null;
  apiState.trippedAt = null;
  apiState.skippedCalls = 0;

  if (wasTripped) {
    logger.info('API Circuit Breaker sıfırlandı', { module: 'circuit-breaker' });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DB CIRCUIT BREAKER
// ═══════════════════════════════════════════════════════════════════════════

const DB_BREAKER_CONFIG = {
  FAILURE_THRESHOLD: 3, // 3 ardışık timeout sonrası trip
  PAUSE_DURATION_MS: 30_000, // 30sn bekleme
};

const dbState = {
  consecutiveTimeouts: 0,
  pausedUntil: null,
  totalPauses: 0,
  skippedQueries: 0,
};

// DB timeout pattern'leri
const DB_TIMEOUT_PATTERNS = [
  'connection terminated due to connection timeout',
  'connection terminated unexpectedly',
  'timeout expired',
  'ETIMEDOUT',
  'ECONNRESET',
  'ECONNREFUSED',
  '57P01', // admin_shutdown
  '57P03', // cannot_connect_now
];

/**
 * DB sorgusu öncesi kontrol.
 * Pause durumunda ise sorguyu engeller.
 * @returns {{ allowed: boolean, reason?: string }}
 */
export function checkDbCircuit() {
  if (!dbState.pausedUntil) {
    return { allowed: true };
  }

  // Pause süresi doldu mu?
  if (Date.now() >= dbState.pausedUntil) {
    dbState.pausedUntil = null;
    dbState.consecutiveTimeouts = 0;
    logger.info('DB Circuit Breaker pause süresi doldu — sorgular yeniden aktif', {
      module: 'circuit-breaker',
      totalPauses: dbState.totalPauses,
    });
    return { allowed: true };
  }

  dbState.skippedQueries++;
  const remainingMs = dbState.pausedUntil - Date.now();
  return {
    allowed: false,
    reason: `DB bağlantı timeout — ${Math.ceil(remainingMs / 1000)}sn sonra tekrar denenecek`,
  };
}

/**
 * DB hatasını değerlendir. Timeout ise sayacı artır, threshold aşılırsa pause.
 * @param {Error} error - pg hatası
 * @returns {boolean} Circuit tripped mi (true = pause başladı)
 */
export function reportDbError(error) {
  const message = (error?.message || '').toLowerCase();
  const code = error?.code || '';

  const isTimeout = DB_TIMEOUT_PATTERNS.some((pattern) => message.includes(pattern.toLowerCase()) || code === pattern);

  if (!isTimeout) {
    // Timeout değilse sayacı sıfırla (farklı hata tipi)
    dbState.consecutiveTimeouts = 0;
    return false;
  }

  dbState.consecutiveTimeouts++;

  if (dbState.consecutiveTimeouts >= DB_BREAKER_CONFIG.FAILURE_THRESHOLD) {
    dbState.pausedUntil = Date.now() + DB_BREAKER_CONFIG.PAUSE_DURATION_MS;
    dbState.totalPauses++;
    dbState.skippedQueries = 0;

    logger.error(`⛔ DB Circuit Breaker TRIPPED — ${DB_BREAKER_CONFIG.PAUSE_DURATION_MS / 1000}sn pause başladı`, {
      module: 'circuit-breaker',
      consecutiveTimeouts: dbState.consecutiveTimeouts,
      totalPauses: dbState.totalPauses,
      resumeAt: new Date(dbState.pausedUntil).toISOString(),
    });

    return true;
  }

  logger.warn(`DB timeout ${dbState.consecutiveTimeouts}/${DB_BREAKER_CONFIG.FAILURE_THRESHOLD}`, {
    module: 'circuit-breaker',
    error: error.message,
  });

  return false;
}

/**
 * DB sorgusu başarılı olduğunda çağrılır — timeout sayacını sıfırlar.
 */
export function reportDbSuccess() {
  if (dbState.consecutiveTimeouts > 0) {
    dbState.consecutiveTimeouts = 0;
  }
}

/**
 * DB circuit durumunu döndür
 */
export function getDbCircuitStatus() {
  return {
    ...dbState,
    paused: dbState.pausedUntil ? Date.now() < dbState.pausedUntil : false,
    remainingPauseMs: dbState.pausedUntil ? Math.max(0, dbState.pausedUntil - Date.now()) : 0,
  };
}

/**
 * DB circuit'i sıfırla
 */
export function resetDbCircuit() {
  dbState.consecutiveTimeouts = 0;
  dbState.pausedUntil = null;
  dbState.skippedQueries = 0;
  logger.info('DB Circuit Breaker sıfırlandı', { module: 'circuit-breaker' });
}
