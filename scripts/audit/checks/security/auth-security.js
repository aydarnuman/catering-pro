/**
 * Auth & Permission Security Check
 * Authentication ve authorization güvenlik kontrolü
 */

import { SEVERITY, createFinding, determineStatus } from '../../lib/severity.js';
import { findFiles, readFileContent, getLineNumber } from '../../lib/utils.js';
import path from 'path';

export async function checkAuthSecurity(context) {
  const { projectRoot, config, verbose } = context;
  const findings = [];

  // Auth middleware kontrolü
  const authFindings = await checkAuthMiddleware(projectRoot, config);
  findings.push(...authFindings);

  // Route güvenliği kontrolü
  const routeFindings = await checkRouteProtection(projectRoot, config);
  findings.push(...routeFindings);

  // JWT güvenliği kontrolü
  const jwtFindings = await checkJwtSecurity(projectRoot, config);
  findings.push(...jwtFindings);

  // Password handling kontrolü
  const passwordFindings = await checkPasswordHandling(projectRoot, config);
  findings.push(...passwordFindings);

  const errorCount = findings.filter((f) => f.severity === SEVERITY.ERROR).length;
  const warningCount = findings.filter((f) => f.severity === SEVERITY.WARNING).length;

  return {
    id: 'auth-security',
    name: 'Auth & Permission Güvenliği',
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
 * Auth middleware kontrolü
 */
async function checkAuthMiddleware(projectRoot, config) {
  const findings = [];
  const middlewarePath = path.join(projectRoot, config.paths.backend, 'src', 'middleware');

  const files = await findFiles('**/*.js', middlewarePath, []);

  let hasAuthMiddleware = false;
  let hasRoleCheck = false;
  let hasTokenVerification = false;

  for (const file of files) {
    const content = await readFileContent(path.join(middlewarePath, file));
    if (!content) continue;

    // Auth middleware varlığı
    if (content.includes('authenticate') || content.includes('verifyToken') || content.includes('jwt.verify')) {
      hasAuthMiddleware = true;
    }

    // Role/permission kontrolü
    if (content.includes('role') || content.includes('permission') || content.includes('authorize')) {
      hasRoleCheck = true;
    }

    // Token verification
    if (content.includes('jwt.verify') || content.includes('verifyToken')) {
      hasTokenVerification = true;

      // Token expiry kontrolü
      if (!content.includes('expiresIn') && !content.includes('exp')) {
        findings.push(
          createFinding({
            severity: SEVERITY.WARNING,
            message: 'JWT token expiry kontrolü eksik olabilir',
            file: `backend/src/middleware/${file}`,
            suggestion: 'Token expiry süresini kontrol edin',
          })
        );
      }
    }

    // Güvensiz pattern'ler
    if (content.includes('req.headers.authorization') && !content.includes('Bearer')) {
      findings.push(
        createFinding({
          severity: SEVERITY.INFO,
          message: 'Authorization header Bearer prefix kontrolü önerilir',
          file: `backend/src/middleware/${file}`,
          suggestion: 'Bearer token formatını doğrulayın',
        })
      );
    }
  }

  if (!hasAuthMiddleware) {
    findings.push(
      createFinding({
        severity: SEVERITY.ERROR,
        message: 'Auth middleware bulunamadı',
        file: 'backend/src/middleware/',
        suggestion: 'JWT veya session tabanlı auth middleware ekleyin',
      })
    );
  }

  return findings;
}

/**
 * Route koruma kontrolü
 */
async function checkRouteProtection(projectRoot, config) {
  const findings = [];
  const routesPath = path.join(projectRoot, config.paths.routes);

  const files = await findFiles('**/*.js', routesPath, []);

  // Korunması gereken sensitive endpoint'ler
  const sensitivePatterns = [
    { pattern: /\/admin/i, name: 'admin' },
    { pattern: /\/users/i, name: 'users' },
    { pattern: /\/settings/i, name: 'settings' },
    { pattern: /\/delete/i, name: 'delete' },
    { pattern: /\/permissions/i, name: 'permissions' },
  ];

  for (const file of files) {
    const content = await readFileContent(path.join(routesPath, file));
    if (!content) continue;

    // Middleware kullanımı kontrolü
    const hasAuthMiddleware =
      content.includes('authenticate') ||
      content.includes('requireAuth') ||
      content.includes('verifyToken') ||
      content.includes('isAuthenticated');

    for (const { pattern, name } of sensitivePatterns) {
      if (pattern.test(content)) {
        if (!hasAuthMiddleware) {
          findings.push(
            createFinding({
              severity: SEVERITY.WARNING,
              message: `Sensitive endpoint (${name}) auth middleware olmadan tanımlanmış olabilir`,
              file: `backend/src/routes/${file}`,
              suggestion: 'Auth middleware ekleyin',
            })
          );
        }
      }
    }

    // Public endpoint'lerde tehlikeli işlemler
    const publicRouteMatch = content.match(/router\.(post|put|delete)\s*\(\s*['"][^'"]+['"]\s*,\s*(?!authenticate|requireAuth)/g);
    if (publicRouteMatch && publicRouteMatch.length > 0) {
      // Auth route'ları hariç
      if (!file.includes('auth')) {
        findings.push(
          createFinding({
            severity: SEVERITY.INFO,
            message: `Mutasyon endpoint'leri (POST/PUT/DELETE) auth kontrolü olmadan kullanılıyor`,
            file: `backend/src/routes/${file}`,
            suggestion: 'Bu endpoint\'lerin public olması gerektiğinden emin olun',
          })
        );
      }
    }
  }

  return findings;
}

/**
 * JWT güvenlik kontrolü
 */
async function checkJwtSecurity(projectRoot, config) {
  const findings = [];
  const backendSrc = path.join(projectRoot, config.paths.backend, 'src');

  const files = await findFiles('**/*.js', backendSrc, ['node_modules']);

  for (const file of files) {
    const content = await readFileContent(path.join(backendSrc, file));
    if (!content) continue;

    // Hardcoded JWT secret
    if (content.includes("jwt.sign") || content.includes("jwt.verify")) {
      // Secret'in environment'tan alınıp alınmadığını kontrol et
      const jwtSignMatch = content.match(/jwt\.(?:sign|verify)\s*\([^)]+,\s*['"]([^'"]+)['"]/);
      if (jwtSignMatch && !jwtSignMatch[1].includes('process.env')) {
        findings.push(
          createFinding({
            severity: SEVERITY.ERROR,
            message: 'JWT secret hardcoded olabilir',
            file: `backend/src/${file}`,
            suggestion: 'JWT secret\'ı environment variable\'dan alın',
          })
        );
      }

      // Algorithm belirtilmemiş
      if (content.includes('jwt.verify') && !content.includes('algorithms')) {
        findings.push(
          createFinding({
            severity: SEVERITY.WARNING,
            message: 'JWT verify\'da algorithm belirtilmemiş',
            file: `backend/src/${file}`,
            suggestion: 'algorithms: ["HS256"] gibi explicit algorithm belirtin',
          })
        );
      }
    }
  }

  return findings;
}

/**
 * Password handling kontrolü
 */
async function checkPasswordHandling(projectRoot, config) {
  const findings = [];
  const backendSrc = path.join(projectRoot, config.paths.backend, 'src');

  const files = await findFiles('**/*.js', backendSrc, ['node_modules']);

  let hasBcrypt = false;
  let hasArgon2 = false;

  for (const file of files) {
    const content = await readFileContent(path.join(backendSrc, file));
    if (!content) continue;

    // Password hashing library kullanımı
    if (content.includes('bcrypt') || content.includes('bcryptjs')) {
      hasBcrypt = true;
    }
    if (content.includes('argon2')) {
      hasArgon2 = true;
    }

    // Plain text password kontrolü
    if (content.includes('password') && content.includes('INSERT') && !content.includes('hash')) {
      findings.push(
        createFinding({
          severity: SEVERITY.ERROR,
          message: 'Password plain text olarak kaydediliyor olabilir',
          file: `backend/src/${file}`,
          suggestion: 'bcrypt veya argon2 ile hash\'leyin',
        })
      );
    }

    // Password logging kontrolü
    if (content.match(/console\.(log|info|debug)\s*\([^)]*password/i)) {
      findings.push(
        createFinding({
          severity: SEVERITY.ERROR,
          message: 'Password log\'lanıyor olabilir',
          file: `backend/src/${file}`,
          suggestion: 'Password\'ları asla log\'lamayın',
        })
      );
    }
  }

  if (!hasBcrypt && !hasArgon2) {
    findings.push(
      createFinding({
        severity: SEVERITY.WARNING,
        message: 'Password hashing library (bcrypt/argon2) tespit edilemedi',
        file: 'backend/src/',
        suggestion: 'bcryptjs veya argon2 kullanın',
      })
    );
  }

  return findings;
}
