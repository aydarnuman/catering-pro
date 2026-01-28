/**
 * Log & Error Analysis Check
 * Error tracking ve log pattern analizi
 */

import { SEVERITY, createFinding, determineStatus } from '../../lib/severity.js';
import { findFiles, readFileContent, listDirectory, getFileSizeMB } from '../../lib/utils.js';
import path from 'path';

export async function checkLogAnalysis(context) {
  const { projectRoot, config, verbose } = context;
  const findings = [];

  // Log dosyaları analizi
  const logFileFindings = await analyzeLogFiles(projectRoot, config);
  findings.push(...logFileFindings);

  // Logging library kontrolü
  const loggingFindings = await checkLoggingSetup(projectRoot, config);
  findings.push(...loggingFindings);

  // Error handling pattern kontrolü
  const errorHandlingFindings = await checkErrorHandling(projectRoot, config);
  findings.push(...errorHandlingFindings);

  const errorCount = findings.filter((f) => f.severity === SEVERITY.ERROR).length;
  const warningCount = findings.filter((f) => f.severity === SEVERITY.WARNING).length;

  return {
    id: 'log-analysis',
    name: 'Log & Hata Analizi',
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
 * Log dosyaları analizi
 */
async function analyzeLogFiles(projectRoot, config) {
  const findings = [];
  const logsPath = path.join(projectRoot, config.paths.logs);

  const files = await listDirectory(logsPath);

  if (files.length === 0) {
    findings.push(
      createFinding({
        severity: SEVERITY.INFO,
        message: 'Log dizininde dosya bulunamadı',
        file: config.paths.logs,
      })
    );
    return findings;
  }

  const logFiles = files.filter((f) => f.endsWith('.log') || f.endsWith('.json'));
  const maxLogSize = config.infrastructure.logs?.maxLogFileSizeMB || 100;

  for (const file of logFiles) {
    const filePath = path.join(logsPath, file);
    const sizeMB = await getFileSizeMB(filePath);

    // Büyük log dosyası
    if (sizeMB > maxLogSize) {
      findings.push(
        createFinding({
          severity: SEVERITY.WARNING,
          message: `Log dosyası çok büyük: ${file} (${sizeMB.toFixed(1)} MB)`,
          file: `${config.paths.logs}/${file}`,
          suggestion: 'Log rotation ayarlayın',
        })
      );
    }

    // JSON log dosyası ise içeriği analiz et
    if (file.endsWith('.json') && sizeMB < 10) {
      const content = await readFileContent(filePath);
      if (content) {
        try {
          // Satır satır JSON log
          const lines = content.split('\n').filter(Boolean);
          let errorCount = 0;
          let recentErrors = [];

          for (const line of lines.slice(-100)) {
            // Son 100 satır
            try {
              const logEntry = JSON.parse(line);
              if (logEntry.level === 'error' || logEntry.type === 'error') {
                errorCount++;
                if (recentErrors.length < 3) {
                  recentErrors.push(logEntry.message || logEntry.error || 'Unknown error');
                }
              }
            } catch {
              // Parse hatası, devam et
            }
          }

          if (errorCount > 10) {
            findings.push(
              createFinding({
                severity: SEVERITY.WARNING,
                message: `Son 100 log satırında ${errorCount} hata`,
                file: `${config.paths.logs}/${file}`,
                suggestion: `Son hatalar: ${recentErrors.join(', ').substring(0, 100)}`,
              })
            );
          }
        } catch {
          // JSON parse hatası
        }
      }
    }
  }

  return findings;
}

/**
 * Logging setup kontrolü
 */
async function checkLoggingSetup(projectRoot, config) {
  const findings = [];
  const backendSrc = path.join(projectRoot, config.paths.backend, 'src');

  const files = await findFiles('**/*.js', backendSrc, ['node_modules']);

  let hasStructuredLogging = false;
  let hasLogLevel = false;
  let hasErrorTracking = false;

  for (const file of files) {
    const content = await readFileContent(path.join(backendSrc, file));
    if (!content) continue;

    // Structured logging library
    if (content.includes('winston') || content.includes('pino') || content.includes('bunyan')) {
      hasStructuredLogging = true;
    }

    // Log level kullanımı
    if (content.includes('log.info') || content.includes('log.error') || content.includes('logger.info')) {
      hasLogLevel = true;
    }

    // Error tracking service
    if (content.includes('Sentry') || content.includes('Bugsnag') || content.includes('Rollbar')) {
      hasErrorTracking = true;
    }

    // console.log kullanımı (production'da olmamalı)
    const consoleLogCount = (content.match(/console\.(log|info|debug)/g) || []).length;
    if (consoleLogCount > 5 && !file.includes('test') && !file.includes('seed')) {
      findings.push(
        createFinding({
          severity: SEVERITY.INFO,
          message: `Çok sayıda console.log kullanımı (${consoleLogCount})`,
          file: `backend/src/${file}`,
          suggestion: 'Structured logging library kullanın',
        })
      );
    }
  }

  if (!hasStructuredLogging) {
    findings.push(
      createFinding({
        severity: SEVERITY.INFO,
        message: 'Structured logging library tespit edilemedi',
        file: 'backend/src/',
        suggestion: 'winston veya pino kullanın',
      })
    );
  }

  if (!hasErrorTracking) {
    findings.push(
      createFinding({
        severity: SEVERITY.INFO,
        message: 'Error tracking service tespit edilemedi',
        file: 'backend/src/',
        suggestion: 'Production için Sentry veya benzeri servis kullanın',
      })
    );
  }

  return findings;
}

/**
 * Error handling pattern kontrolü
 */
async function checkErrorHandling(projectRoot, config) {
  const findings = [];
  const routesPath = path.join(projectRoot, config.paths.routes);

  const files = await findFiles('**/*.js', routesPath, []);

  let routesWithErrorHandler = 0;
  let routesWithoutErrorHandler = 0;

  for (const file of files) {
    const content = await readFileContent(path.join(routesPath, file));
    if (!content) continue;

    // Async handler'larda try-catch
    const asyncHandlers = (content.match(/async\s*\([^)]*\)\s*=>/g) || []).length;
    const tryCatchBlocks = (content.match(/try\s*\{/g) || []).length;

    if (asyncHandlers > 0) {
      if (tryCatchBlocks >= asyncHandlers / 2) {
        routesWithErrorHandler++;
      } else {
        routesWithoutErrorHandler++;
      }
    }

    // Unhandled promise rejection riski
    if (content.includes('await') && !content.includes('catch') && !content.includes('try')) {
      findings.push(
        createFinding({
          severity: SEVERITY.WARNING,
          message: 'Async handler\'da error handling eksik',
          file: `backend/src/routes/${file}`,
          suggestion: 'try-catch veya asyncHandler middleware kullanın',
        })
      );
    }

    // Error response tutarlılığı
    const errorResponsePatterns = [
      content.includes('res.status(4') || content.includes('res.status(5'),
      content.includes('error:') || content.includes('message:'),
    ];

    if (errorResponsePatterns[0] && !errorResponsePatterns[1]) {
      findings.push(
        createFinding({
          severity: SEVERITY.INFO,
          message: 'Error response formatı tutarsız olabilir',
          file: `backend/src/routes/${file}`,
          suggestion: 'Standart error response formatı kullanın: { success: false, error: message }',
        })
      );
    }
  }

  // Global error handler kontrolü
  const serverPath = path.join(projectRoot, config.paths.backend, 'src', 'server.js');
  const serverContent = await readFileContent(serverPath);

  if (serverContent) {
    // Express error middleware (4 parametre)
    if (!serverContent.includes('(err, req, res, next)') && !serverContent.includes('(error, req, res, next)')) {
      findings.push(
        createFinding({
          severity: SEVERITY.WARNING,
          message: 'Global error handler middleware tespit edilemedi',
          file: 'backend/src/server.js',
          suggestion: 'app.use((err, req, res, next) => { ... }) ekleyin',
        })
      );
    }

    // Uncaught exception handler
    if (!serverContent.includes('uncaughtException') && !serverContent.includes('unhandledRejection')) {
      findings.push(
        createFinding({
          severity: SEVERITY.WARNING,
          message: 'Process error handler eksik',
          file: 'backend/src/server.js',
          suggestion: "process.on('uncaughtException') ve 'unhandledRejection' ekleyin",
        })
      );
    }
  }

  return findings;
}
