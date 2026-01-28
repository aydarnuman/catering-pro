/**
 * API Consistency Check
 * Endpoint adlandırma ve response format tutarlılığı kontrolü
 */

import { SEVERITY, createFinding, determineStatus } from '../../lib/severity.js';
import { findFiles, readFileContent, getLineNumber } from '../../lib/utils.js';
import path from 'path';

export async function checkAPIConsistency(context) {
  const { projectRoot, config, verbose } = context;
  const findings = [];

  const routesPath = path.join(projectRoot, config.paths.routes);
  const routeFiles = await findFiles('**/*.js', routesPath, ['node_modules', '.git']);

  const endpoints = [];

  for (const file of routeFiles) {
    const filePath = path.join(routesPath, file);
    const content = await readFileContent(filePath);
    if (!content) continue;

    // Endpoint'leri analiz et
    const fileEndpoints = extractEndpoints(content, file);
    endpoints.push(...fileEndpoints);

    // Response format kontrolü
    const responseFindings = checkResponseFormat(content, file, config);
    findings.push(...responseFindings);
  }

  // Adlandırma tutarlılığı kontrolü
  const namingFindings = checkNamingConsistency(endpoints, config);
  findings.push(...namingFindings);

  // HTTP method tutarlılığı
  const methodFindings = checkMethodConsistency(endpoints);
  findings.push(...methodFindings);

  const errorCount = findings.filter((f) => f.severity === SEVERITY.ERROR).length;
  const warningCount = findings.filter((f) => f.severity === SEVERITY.WARNING).length;

  return {
    id: 'api-consistency',
    name: 'API Tutarlılığı',
    status: determineStatus(findings),
    severity: errorCount > 0 ? SEVERITY.ERROR : warningCount > 0 ? SEVERITY.WARNING : SEVERITY.INFO,
    fixable: false,
    findings,
    summary: {
      totalEndpoints: endpoints.length,
      issues: findings.length,
    },
  };
}

/**
 * Route dosyasından endpoint'leri çıkar
 */
function extractEndpoints(content, file) {
  const endpoints = [];

  // Express router patterns
  const patterns = [
    /router\.(get|post|put|patch|delete)\s*\(\s*['"]([^'"]+)['"]/gi,
    /app\.(get|post|put|patch|delete)\s*\(\s*['"]([^'"]+)['"]/gi,
  ];

  for (const pattern of patterns) {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);

    while ((match = regex.exec(content)) !== null) {
      endpoints.push({
        method: match[1].toUpperCase(),
        path: match[2],
        file: file,
        line: getLineNumber(content, match.index),
      });
    }
  }

  return endpoints;
}

/**
 * Response format kontrolü
 */
function checkResponseFormat(content, file, config) {
  const findings = [];
  const requirements = config.codeQuality.apiResponseRequirements;

  // res.json() kullanımlarını bul
  const jsonPattern = /res\.(?:json|send)\s*\(\s*(\{[^}]+\}|\w+)\s*\)/g;
  let match;

  while ((match = jsonPattern.exec(content)) !== null) {
    const responseContent = match[1];
    const lineNum = getLineNumber(content, match.index);

    // Object literal ise içeriği kontrol et
    if (responseContent.startsWith('{')) {
      // Success field kontrolü
      if (requirements.requireSuccessField && !responseContent.includes('success')) {
        findings.push(
          createFinding({
            severity: SEVERITY.INFO,
            message: 'Response "success" field içermiyor',
            file: `backend/src/routes/${file}`,
            line: lineNum,
            suggestion: 'Tüm response\'lara success: true/false ekleyin',
          })
        );
      }
    }
  }

  // Error handling pattern kontrolü
  const hasErrorHandler = content.includes('catch') && (content.includes('res.status(') || content.includes('next('));

  if (!hasErrorHandler && content.includes('async')) {
    findings.push(
      createFinding({
        severity: SEVERITY.WARNING,
        message: 'Async handler\'da hata yakalama eksik olabilir',
        file: `backend/src/routes/${file}`,
        suggestion: 'try-catch veya asyncHandler middleware kullanın',
      })
    );
  }

  return findings;
}

/**
 * Endpoint adlandırma tutarlılığı
 */
function checkNamingConsistency(endpoints, config) {
  const findings = [];

  for (const endpoint of endpoints) {
    const path = endpoint.path;

    // Kebab-case kontrolü (snake_case yerine kebab-case tercih edilmeli)
    if (path.includes('_') && !path.includes(':')) {
      findings.push(
        createFinding({
          severity: SEVERITY.INFO,
          message: `Endpoint snake_case kullanıyor: ${path}`,
          file: `backend/src/routes/${endpoint.file}`,
          line: endpoint.line,
          endpoint: path,
          suggestion: 'kebab-case kullanın: ' + path.replace(/_/g, '-'),
        })
      );
    }

    // Çoğul/tekil tutarlılık (RESTful)
    const pathParts = path.split('/').filter(Boolean);
    for (const part of pathParts) {
      if (part.startsWith(':')) continue; // Parameter

      // Tekil isimler uyarı
      const singularWords = ['user', 'product', 'invoice', 'order', 'item', 'cari', 'personel', 'stok'];
      if (singularWords.includes(part.toLowerCase())) {
        findings.push(
          createFinding({
            severity: SEVERITY.INFO,
            message: `RESTful: Collection endpoint tekil isim kullanıyor: /${part}`,
            file: `backend/src/routes/${endpoint.file}`,
            line: endpoint.line,
            endpoint: path,
            suggestion: `Çoğul form kullanın: /${part}s veya /${part}ler`,
          })
        );
      }
    }

    // Fiil kullanımı kontrolü (RESTful'da endpoint'ler isim olmalı)
    const verbPatterns = ['get', 'create', 'update', 'delete', 'fetch', 'list', 'add', 'remove'];
    for (const verb of verbPatterns) {
      if (path.toLowerCase().includes(`/${verb}`) || path.toLowerCase().includes(`${verb}-`)) {
        findings.push(
          createFinding({
            severity: SEVERITY.INFO,
            message: `RESTful: Endpoint fiil içeriyor: ${path}`,
            file: `backend/src/routes/${endpoint.file}`,
            line: endpoint.line,
            endpoint: path,
            suggestion: 'HTTP method fiili belirtir, endpoint isim olmalı',
          })
        );
      }
    }
  }

  return findings;
}

/**
 * HTTP method tutarlılığı
 */
function checkMethodConsistency(endpoints) {
  const findings = [];

  for (const endpoint of endpoints) {
    const { method, path } = endpoint;

    // GET with body warning (path'de create/update varsa)
    if (method === 'GET' && (path.includes('create') || path.includes('update'))) {
      findings.push(
        createFinding({
          severity: SEVERITY.WARNING,
          message: `GET method ile create/update işlemi: ${path}`,
          file: `backend/src/routes/${endpoint.file}`,
          line: endpoint.line,
          suggestion: 'POST/PUT/PATCH method kullanın',
        })
      );
    }

    // DELETE with :id kontrolü
    if (method === 'DELETE' && !path.includes(':')) {
      findings.push(
        createFinding({
          severity: SEVERITY.WARNING,
          message: `DELETE endpoint parametre içermiyor: ${path}`,
          file: `backend/src/routes/${endpoint.file}`,
          line: endpoint.line,
          suggestion: 'Bulk delete tehlikeli olabilir, :id parametresi ekleyin',
        })
      );
    }
  }

  return findings;
}
