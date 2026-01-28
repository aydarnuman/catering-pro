/**
 * CORS & Security Headers Check
 * CORS yapılandırması ve güvenlik başlıkları kontrolü
 */

import { SEVERITY, createFinding, determineStatus } from '../../lib/severity.js';
import { readFileContent, findFiles } from '../../lib/utils.js';
import path from 'path';

export async function checkCorsHeaders(context) {
  const { projectRoot, config, verbose } = context;
  const findings = [];

  // Server.js kontrolü
  const serverFindings = await checkServerConfig(projectRoot, config);
  findings.push(...serverFindings);

  // Helmet kullanımı kontrolü
  const helmetFindings = await checkHelmetUsage(projectRoot, config);
  findings.push(...helmetFindings);

  // CORS yapılandırması
  const corsFindings = await checkCorsConfig(projectRoot, config);
  findings.push(...corsFindings);

  const errorCount = findings.filter((f) => f.severity === SEVERITY.ERROR).length;
  const warningCount = findings.filter((f) => f.severity === SEVERITY.WARNING).length;

  return {
    id: 'cors-headers',
    name: 'CORS & Security Headers',
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
 * Server yapılandırması kontrolü
 */
async function checkServerConfig(projectRoot, config) {
  const findings = [];
  const serverPath = path.join(projectRoot, config.paths.backend, 'src', 'server.js');
  const content = await readFileContent(serverPath);

  if (!content) {
    findings.push(
      createFinding({
        severity: SEVERITY.WARNING,
        message: 'server.js bulunamadı',
        file: 'backend/src/server.js',
      })
    );
    return findings;
  }

  // Helmet kullanımı
  if (!content.includes('helmet')) {
    findings.push(
      createFinding({
        severity: SEVERITY.ERROR,
        message: 'Helmet middleware kullanılmıyor',
        file: 'backend/src/server.js',
        suggestion: "npm install helmet && app.use(helmet())",
      })
    );
  }

  // CORS kullanımı
  if (!content.includes('cors')) {
    findings.push(
      createFinding({
        severity: SEVERITY.WARNING,
        message: 'CORS middleware tespit edilemedi',
        file: 'backend/src/server.js',
        suggestion: 'cors middleware ekleyin',
      })
    );
  }

  // Trust proxy (reverse proxy arkasındaysa)
  if (!content.includes('trust proxy')) {
    findings.push(
      createFinding({
        severity: SEVERITY.INFO,
        message: 'trust proxy ayarlanmamış',
        file: 'backend/src/server.js',
        suggestion: 'Reverse proxy arkasındaysanız app.set("trust proxy", 1) ekleyin',
      })
    );
  }

  return findings;
}

/**
 * Helmet yapılandırması kontrolü
 */
async function checkHelmetUsage(projectRoot, config) {
  const findings = [];
  const backendSrc = path.join(projectRoot, config.paths.backend, 'src');
  const files = await findFiles('**/*.js', backendSrc, ['node_modules']);

  let helmetFound = false;
  let helmetConfig = null;

  for (const file of files) {
    const content = await readFileContent(path.join(backendSrc, file));
    if (!content) continue;

    if (content.includes('helmet(')) {
      helmetFound = true;

      // Helmet config analizi
      const configMatch = content.match(/helmet\s*\(\s*(\{[^}]+\})\s*\)/s);
      if (configMatch) {
        helmetConfig = configMatch[1];
      }

      // CSP kontrolü
      if (content.includes('contentSecurityPolicy: false') || content.includes("contentSecurityPolicy: 'false'")) {
        findings.push(
          createFinding({
            severity: SEVERITY.WARNING,
            message: 'Content Security Policy devre dışı bırakılmış',
            file: `backend/src/${file}`,
            suggestion: 'CSP XSS saldırılarına karşı koruma sağlar',
          })
        );
      }

      // HSTS kontrolü
      if (content.includes('strictTransportSecurity: false')) {
        findings.push(
          createFinding({
            severity: SEVERITY.WARNING,
            message: 'HSTS devre dışı bırakılmış',
            file: `backend/src/${file}`,
            suggestion: 'Production\'da HSTS aktif olmalı',
          })
        );
      }
    }
  }

  if (!helmetFound) {
    findings.push(
      createFinding({
        severity: SEVERITY.ERROR,
        message: 'Helmet kullanımı tespit edilemedi',
        file: 'backend/src/',
        suggestion: 'Güvenlik başlıkları için Helmet kullanın',
      })
    );
  }

  return findings;
}

/**
 * CORS yapılandırması kontrolü
 */
async function checkCorsConfig(projectRoot, config) {
  const findings = [];
  const backendSrc = path.join(projectRoot, config.paths.backend, 'src');
  const files = await findFiles('**/*.js', backendSrc, ['node_modules']);

  for (const file of files) {
    const content = await readFileContent(path.join(backendSrc, file));
    if (!content) continue;

    // Wildcard origin kontrolü
    if (content.includes("origin: '*'") || content.includes('origin: "*"') || content.includes("Access-Control-Allow-Origin', '*'")) {
      findings.push(
        createFinding({
          severity: SEVERITY.WARNING,
          message: 'CORS wildcard (*) origin kullanılıyor',
          file: `backend/src/${file}`,
          suggestion: 'Production\'da spesifik origin\'ler belirtin',
        })
      );
    }

    // Credentials ile wildcard (güvenlik açığı)
    if (content.includes("credentials: true") && (content.includes("origin: '*'") || content.includes('origin: "*"'))) {
      findings.push(
        createFinding({
          severity: SEVERITY.ERROR,
          message: 'CORS credentials:true ile wildcard origin kullanılamaz',
          file: `backend/src/${file}`,
          suggestion: 'Spesifik origin belirtin veya credentials:false yapın',
        })
      );
    }

    // Origin doğrulaması
    if (content.includes('cors(') && !content.includes('origin:')) {
      findings.push(
        createFinding({
          severity: SEVERITY.INFO,
          message: 'CORS origin açıkça belirtilmemiş',
          file: `backend/src/${file}`,
          suggestion: 'İzin verilen origin\'leri belirtin',
        })
      );
    }

    // Preflight cache
    if (content.includes('cors(') && !content.includes('maxAge')) {
      findings.push(
        createFinding({
          severity: SEVERITY.INFO,
          message: 'CORS preflight cache (maxAge) ayarlanmamış',
          file: `backend/src/${file}`,
          suggestion: 'Performans için maxAge ekleyin (örn: 86400)',
        })
      );
    }
  }

  return findings;
}
