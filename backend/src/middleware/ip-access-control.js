/**
 * IP Access Control Middleware
 * IP whitelist ve blacklist kontrolü
 *
 * Öncelik sırası:
 * 1. Whitelist varsa → Sadece whitelist'teki IP'ler erişebilir
 * 2. Whitelist yoksa → Blacklist'teki IP'ler erişemez
 */

import { query } from '../database.js';
import logger from '../utils/logger.js';

/**
 * IP adresini parse et
 * @param {string} ip - IP adresi (x-forwarded-for header'ından gelebilir)
 * @returns {string} - Temizlenmiş IP adresi
 */
function parseIpAddress(ip) {
  if (!ip) return null;

  // x-forwarded-for birden fazla IP içerebilir (proxy chain)
  // İlk IP'yi al (gerçek client IP)
  const firstIp = ip.split(',')[0].trim();

  // IPv6 localhost kontrolü
  if (firstIp === '::1' || firstIp === '::ffff:127.0.0.1') {
    return '127.0.0.1';
  }

  return firstIp;
}

/**
 * IP erişim kontrolü middleware
 */
export const ipAccessControl = async (req, res, next) => {
  try {
    // IP adresini al
    const clientIp = parseIpAddress(
      req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.ip || req.connection.remoteAddress
    );

    if (!clientIp) {
      logger.warn('IP address could not be determined', {
        host: req.headers?.host,
        userAgent: req.headers?.['user-agent'],
        xForwardedFor: req.headers?.['x-forwarded-for'],
        xRealIp: req.headers?.['x-real-ip'],
        ip: req.ip,
      });
      // IP belirlenemezse erişim izni ver (güvenlik riski olabilir)
      return next();
    }

    // Localhost ve private IP'ler için kontrol atla (development için)
    const isLocalhost = clientIp === '127.0.0.1' || clientIp === 'localhost';
    const isPrivateIp = /^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.)/.test(clientIp);

    if (process.env.NODE_ENV === 'development' && (isLocalhost || isPrivateIp)) {
      return next();
    }

    // Veritabanında IP kontrolü yap
    const result = await query('SELECT check_ip_access($1) as allowed', [clientIp]);

    const allowed = result.rows[0]?.allowed || false;

    if (!allowed) {
      // Hangi kural nedeniyle reddedildiğini bul
      const ruleResult = await query('SELECT * FROM get_ip_rule($1)', [clientIp]);

      const rule = ruleResult.rows[0];

      logger.warn('IP access denied', {
        ip: clientIp,
        ruleType: rule?.rule_type,
        ruleId: rule?.rule_id,
        path: req.path,
        method: req.method,
      });

      return res.status(403).json({
        success: false,
        error: 'IP adresinizden erişim izni verilmedi',
        code: 'IP_ACCESS_DENIED',
        ip: clientIp,
      });
    }

    // Erişim izni var, devam et
    next();
  } catch (error) {
    logger.error('IP access control error', {
      error: error.message,
      stack: error.stack,
    });

    // Hata durumunda erişim izni ver (fail-open, güvenlik riski olabilir)
    // Production'da fail-closed yapılabilir
    if (process.env.NODE_ENV === 'production') {
      return res.status(500).json({
        success: false,
        error: 'Erişim kontrolü hatası',
      });
    }

    next();
  }
};

/**
 * IP kontrolünü atla (belirli route'lar için)
 */
export const skipIpControl = (_req, _res, next) => {
  next();
};
