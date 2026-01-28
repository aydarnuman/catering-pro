/**
 * Rate Limiting Check
 * Rate limiting yapılandırma kontrolü
 */

import { SEVERITY, createFinding, determineStatus } from '../../lib/severity.js';
import { readFileContent, findFiles, readJsonFile } from '../../lib/utils.js';
import path from 'path';

export async function checkRateLimiting(context) {
  const { projectRoot, config, verbose } = context;
  const findings = [];

  // Rate limiter varlığı kontrolü
  const limiterFindings = await checkRateLimiterExists(projectRoot, config);
  findings.push(...limiterFindings);

  // Kritik endpoint'lerde rate limiting
  const endpointFindings = await checkCriticalEndpoints(projectRoot, config);
  findings.push(...endpointFindings);

  // Rate limit değerleri
  const configFindings = await checkRateLimitValues(projectRoot, config);
  findings.push(...configFindings);

  const errorCount = findings.filter((f) => f.severity === SEVERITY.ERROR).length;
  const warningCount = findings.filter((f) => f.severity === SEVERITY.WARNING).length;

  return {
    id: 'rate-limiting',
    name: 'Rate Limiting',
    status: determineStatus(findings),
    severity: errorCount > 0 ? SEVERITY.ERROR : warningCount > 0 ? SEVERITY.WARNING : SEVERITY.INFO,
    fixable: false,
    findings,
    summary: {
      issues: findings.length,
    },
  };
}

/**
 * Rate limiter varlığı kontrolü
 */
async function checkRateLimiterExists(projectRoot, config) {
  const findings = [];

  // package.json'da rate limiter kontrolü
  const packageJson = await readJsonFile(path.join(projectRoot, config.paths.backend, 'package.json'));

  if (!packageJson) {
    return findings;
  }

  const deps = { ...(packageJson.dependencies || {}), ...(packageJson.devDependencies || {}) };

  const rateLimitPackages = ['express-rate-limit', 'rate-limiter-flexible', 'express-slow-down', 'express-brute'];

  const hasRateLimiter = rateLimitPackages.some((pkg) => deps[pkg]);

  if (!hasRateLimiter) {
    findings.push(
      createFinding({
        severity: SEVERITY.ERROR,
        message: 'Rate limiting paketi bulunamadı',
        file: 'backend/package.json',
        suggestion: 'npm install express-rate-limit',
      })
    );
    return findings;
  }

  // Kullanımı kontrol et
  const backendSrc = path.join(projectRoot, config.paths.backend, 'src');
  const files = await findFiles('**/*.js', backendSrc, ['node_modules']);

  let rateLimiterUsed = false;

  for (const file of files) {
    const content = await readFileContent(path.join(backendSrc, file));
    if (!content) continue;

    if (content.includes('rateLimit') || content.includes('RateLimiter') || content.includes('slowDown')) {
      rateLimiterUsed = true;
      break;
    }
  }

  if (!rateLimiterUsed) {
    findings.push(
      createFinding({
        severity: SEVERITY.WARNING,
        message: 'Rate limiter paketi yüklü ama kullanılmıyor',
        file: 'backend/src/',
        suggestion: 'Rate limiter middleware\'i aktif edin',
      })
    );
  }

  return findings;
}

/**
 * Kritik endpoint'lerde rate limiting kontrolü
 */
async function checkCriticalEndpoints(projectRoot, config) {
  const findings = [];
  const requiredEndpoints = config.security.rateLimiting?.requiredEndpoints || [];

  const routesPath = path.join(projectRoot, config.paths.routes);
  const files = await findFiles('**/*.js', routesPath, []);

  for (const file of files) {
    const content = await readFileContent(path.join(routesPath, file));
    if (!content) continue;

    // Login endpoint kontrolü
    if (file.includes('auth') || content.includes('/login') || content.includes('/register')) {
      const hasRateLimit =
        content.includes('rateLimit') ||
        content.includes('limiter') ||
        content.includes('slowDown') ||
        content.includes('rateLimiter');

      if (!hasRateLimit) {
        findings.push(
          createFinding({
            severity: SEVERITY.ERROR,
            message: 'Auth endpoint\'lerinde rate limiting eksik',
            file: `backend/src/routes/${file}`,
            suggestion: 'Login/register endpoint\'lerine rate limiting ekleyin',
          })
        );
      }

      // Brute force koruması
      if (content.includes('/login') && !content.includes('failedAttempts') && !content.includes('lockout')) {
        findings.push(
          createFinding({
            severity: SEVERITY.WARNING,
            message: 'Login endpoint\'inde brute force koruması eksik olabilir',
            file: `backend/src/routes/${file}`,
            suggestion: 'Başarısız giriş denemelerini sayın ve hesabı geçici olarak kilitleyin',
          })
        );
      }
    }

    // Forgot password endpoint kontrolü
    if (content.includes('/forgot-password') || content.includes('/reset-password')) {
      const hasRateLimit = content.includes('rateLimit') || content.includes('limiter');

      if (!hasRateLimit) {
        findings.push(
          createFinding({
            severity: SEVERITY.WARNING,
            message: 'Password reset endpoint\'inde rate limiting eksik',
            file: `backend/src/routes/${file}`,
            suggestion: 'Email enumeration saldırılarını önlemek için rate limiting ekleyin',
          })
        );
      }
    }
  }

  return findings;
}

/**
 * Rate limit değerleri kontrolü
 */
async function checkRateLimitValues(projectRoot, config) {
  const findings = [];
  const backendSrc = path.join(projectRoot, config.paths.backend, 'src');
  const files = await findFiles('**/*.js', backendSrc, ['node_modules']);

  for (const file of files) {
    const content = await readFileContent(path.join(backendSrc, file));
    if (!content) continue;

    // Rate limit config analizi
    const rateLimitMatch = content.match(/rateLimit\s*\(\s*\{([^}]+)\}/s);
    if (rateLimitMatch) {
      const configStr = rateLimitMatch[1];

      // windowMs kontrolü
      const windowMatch = configStr.match(/windowMs\s*:\s*(\d+)/);
      if (windowMatch) {
        const windowMs = parseInt(windowMatch[1]);
        // Çok kısa window (1 dakikadan az)
        if (windowMs < 60000) {
          findings.push(
            createFinding({
              severity: SEVERITY.INFO,
              message: `Rate limit window çok kısa: ${windowMs}ms`,
              file: `backend/src/${file}`,
              suggestion: 'En az 1 dakika (60000ms) önerilir',
            })
          );
        }
      }

      // max kontrolü
      const maxMatch = configStr.match(/max\s*:\s*(\d+)/);
      if (maxMatch) {
        const max = parseInt(maxMatch[1]);
        // Çok yüksek limit
        if (max > 1000) {
          findings.push(
            createFinding({
              severity: SEVERITY.WARNING,
              message: `Rate limit çok yüksek: ${max} istek`,
              file: `backend/src/${file}`,
              suggestion: 'DDoS koruması için daha düşük bir değer düşünün',
            })
          );
        }
      }

      // Skip fail requests
      if (!configStr.includes('skipFailedRequests') && !configStr.includes('skipSuccessfulRequests')) {
        findings.push(
          createFinding({
            severity: SEVERITY.INFO,
            message: 'Rate limit skip options kullanılmıyor',
            file: `backend/src/${file}`,
            suggestion: 'Başarısız istekleri saymak için skipSuccessfulRequests: true düşünün',
          })
        );
      }
    }
  }

  return findings;
}
