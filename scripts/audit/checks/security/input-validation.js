/**
 * Input Validation Check
 * SQL injection ve XSS korunma kontrolü
 */

import { SEVERITY, createFinding, determineStatus } from '../../lib/severity.js';
import { findFiles, readFileContent, getLineNumber } from '../../lib/utils.js';
import path from 'path';

export async function checkInputValidation(context) {
  const { projectRoot, config, verbose } = context;
  const findings = [];

  // SQL Injection kontrolü
  const sqlFindings = await checkSqlInjection(projectRoot, config);
  findings.push(...sqlFindings);

  // XSS kontrolü
  const xssFindings = await checkXssProtection(projectRoot, config);
  findings.push(...xssFindings);

  // Input validation library kontrolü
  const validationFindings = await checkValidationLibrary(projectRoot, config);
  findings.push(...validationFindings);

  // Parametre sanitization kontrolü
  const sanitizeFindings = await checkSanitization(projectRoot, config);
  findings.push(...sanitizeFindings);

  const errorCount = findings.filter((f) => f.severity === SEVERITY.ERROR).length;
  const warningCount = findings.filter((f) => f.severity === SEVERITY.WARNING).length;

  return {
    id: 'input-validation',
    name: 'Input Validation',
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
 * SQL Injection kontrolü
 */
async function checkSqlInjection(projectRoot, config) {
  const findings = [];
  const backendSrc = path.join(projectRoot, config.paths.backend, 'src');
  const files = await findFiles('**/*.js', backendSrc, ['node_modules']);

  // Tehlikeli pattern'ler
  const dangerousPatterns = [
    {
      // String concatenation in query
      pattern: /query\s*\(\s*`[^`]*\$\{[^}]+\}[^`]*`/g,
      message: 'Template literal ile SQL query - SQL injection riski',
      severity: SEVERITY.ERROR,
    },
    {
      // String concatenation with +
      pattern: /query\s*\(\s*['"][^'"]*['"]\s*\+\s*(?:req\.|params\.|body\.)/g,
      message: 'String concatenation ile SQL query - SQL injection riski',
      severity: SEVERITY.ERROR,
    },
    {
      // Direct req.body/params in query without parameterization
      pattern: /(?:INSERT|UPDATE|DELETE|SELECT).*(?:req\.body|req\.params|req\.query)\./gi,
      message: 'Doğrudan request verisi SQL query\'de kullanılıyor',
      severity: SEVERITY.WARNING,
    },
  ];

  // Güvenli pattern'ler (parameterized queries)
  const safePatterns = [/\$\d+/g, /\?/g, /:\w+/g]; // $1, $2, ?, :param

  for (const file of files) {
    const content = await readFileContent(path.join(backendSrc, file));
    if (!content) continue;

    for (const { pattern, message, severity } of dangerousPatterns) {
      const regex = new RegExp(pattern.source, pattern.flags);
      let match;

      while ((match = regex.exec(content)) !== null) {
        const matchText = match[0];

        // Eğer parameterized query kullanılıyorsa atla
        const hasSafePattern = safePatterns.some((safe) => safe.test(matchText));
        if (hasSafePattern) continue;

        const lineNum = getLineNumber(content, match.index);

        findings.push(
          createFinding({
            severity,
            message,
            file: `backend/src/${file}`,
            line: lineNum,
            snippet: matchText.substring(0, 80),
            suggestion: 'Parameterized query kullanın ($1, $2 veya ?)',
          })
        );

        if (findings.length > 20) break;
      }
    }
  }

  return findings;
}

/**
 * XSS korunma kontrolü
 */
async function checkXssProtection(projectRoot, config) {
  const findings = [];

  // Frontend kontrolü
  const frontendSrc = path.join(projectRoot, config.paths.frontend, 'src');
  const frontendFiles = await findFiles('**/*.{tsx,jsx}', frontendSrc, ['node_modules']);

  for (const file of frontendFiles.slice(0, 30)) {
    const content = await readFileContent(path.join(frontendSrc, file));
    if (!content) continue;

    // dangerouslySetInnerHTML kullanımı
    if (content.includes('dangerouslySetInnerHTML')) {
      const lineNum = content.indexOf('dangerouslySetInnerHTML');

      findings.push(
        createFinding({
          severity: SEVERITY.WARNING,
          message: 'dangerouslySetInnerHTML kullanımı - XSS riski',
          file: `frontend/src/${file}`,
          line: getLineNumber(content, lineNum),
          suggestion: 'DOMPurify ile sanitize edin veya alternatif kullanın',
        })
      );
    }

    // innerHTML kullanımı
    if (content.includes('.innerHTML')) {
      const lineNum = content.indexOf('.innerHTML');

      findings.push(
        createFinding({
          severity: SEVERITY.WARNING,
          message: 'innerHTML kullanımı - XSS riski',
          file: `frontend/src/${file}`,
          line: getLineNumber(content, lineNum),
          suggestion: 'textContent veya React JSX kullanın',
        })
      );
    }
  }

  // Backend - response'da user input kontrolü
  const backendSrc = path.join(projectRoot, config.paths.backend, 'src');
  const backendFiles = await findFiles('**/*.js', backendSrc, ['node_modules']);

  for (const file of backendFiles) {
    const content = await readFileContent(path.join(backendSrc, file));
    if (!content) continue;

    // HTML response with user input
    if (content.includes('res.send') && content.includes('req.')) {
      // Basit kontrol - daha detaylı analiz gerekebilir
      if (content.includes('text/html') || content.includes('<html')) {
        findings.push(
          createFinding({
            severity: SEVERITY.WARNING,
            message: 'HTML response\'da user input kullanımı olabilir',
            file: `backend/src/${file}`,
            suggestion: 'HTML escape veya template engine kullanın',
          })
        );
      }
    }
  }

  return findings;
}

/**
 * Validation library kontrolü
 */
async function checkValidationLibrary(projectRoot, config) {
  const findings = [];
  const packageJson = await import('../../lib/utils.js').then((m) =>
    m.readJsonFile(path.join(projectRoot, config.paths.backend, 'package.json'))
  );

  if (!packageJson) return findings;

  const deps = { ...(packageJson.dependencies || {}), ...(packageJson.devDependencies || {}) };

  const validationLibraries = ['joi', 'yup', 'zod', 'express-validator', 'class-validator', 'ajv'];

  const hasValidation = validationLibraries.some((lib) => deps[lib]);

  if (!hasValidation) {
    findings.push(
      createFinding({
        severity: SEVERITY.WARNING,
        message: 'Input validation library bulunamadı',
        file: 'backend/package.json',
        suggestion: 'joi, zod veya express-validator kullanın',
      })
    );
  }

  return findings;
}

/**
 * Sanitization kontrolü
 */
async function checkSanitization(projectRoot, config) {
  const findings = [];
  const routesPath = path.join(projectRoot, config.paths.routes);
  const files = await findFiles('**/*.js', routesPath, []);

  let routesWithValidation = 0;
  let routesWithoutValidation = 0;

  for (const file of files) {
    const content = await readFileContent(path.join(routesPath, file));
    if (!content) continue;

    // Validation middleware kullanımı
    const hasValidation =
      content.includes('validate') ||
      content.includes('sanitize') ||
      content.includes('joi') ||
      content.includes('zod') ||
      content.includes('schema');

    // POST/PUT endpoint'leri
    const mutationEndpoints = (content.match(/router\.(post|put|patch)\s*\(/g) || []).length;

    if (mutationEndpoints > 0) {
      if (hasValidation) {
        routesWithValidation++;
      } else {
        routesWithoutValidation++;

        findings.push(
          createFinding({
            severity: SEVERITY.INFO,
            message: `Mutation endpoint'lerinde validation tespit edilemedi`,
            file: `backend/src/routes/${file}`,
            suggestion: 'Request body validation ekleyin',
          })
        );
      }
    }
  }

  // Genel özet
  if (routesWithoutValidation > routesWithValidation) {
    findings.push(
      createFinding({
        severity: SEVERITY.WARNING,
        message: `Route dosyalarının çoğunda input validation eksik (${routesWithoutValidation}/${routesWithValidation + routesWithoutValidation})`,
        file: 'backend/src/routes/',
        suggestion: 'Tüm mutation endpoint\'lerine validation ekleyin',
      })
    );
  }

  return findings;
}
