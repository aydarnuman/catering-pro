/**
 * Database Health Check
 * Migration tutarlılığı, index'ler, N+1 query tespiti
 */

import { SEVERITY, createFinding, determineStatus } from '../../lib/severity.js';
import { findFiles, readFileContent, listDirectory } from '../../lib/utils.js';
import path from 'path';

export async function checkDatabaseHealth(context) {
  const { projectRoot, config, verbose } = context;
  const findings = [];

  // Migration tutarlılığı
  const migrationFindings = await checkMigrations(projectRoot, config);
  findings.push(...migrationFindings);

  // Index kullanımı analizi
  const indexFindings = await checkIndexUsage(projectRoot, config);
  findings.push(...indexFindings);

  // N+1 query tespiti
  const n1Findings = await checkN1Queries(projectRoot, config);
  findings.push(...n1Findings);

  // Connection pool kontrolü
  const poolFindings = await checkConnectionPool(projectRoot, config);
  findings.push(...poolFindings);

  const errorCount = findings.filter((f) => f.severity === SEVERITY.ERROR).length;
  const warningCount = findings.filter((f) => f.severity === SEVERITY.WARNING).length;

  return {
    id: 'database-health',
    name: 'Database Sağlığı',
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
 * Migration tutarlılığı kontrolü
 */
async function checkMigrations(projectRoot, config) {
  const findings = [];
  const migrationsPath = path.join(projectRoot, config.paths.migrations);

  const files = await listDirectory(migrationsPath);
  const sqlFiles = files.filter((f) => f.endsWith('.sql')).sort();

  if (sqlFiles.length === 0) {
    findings.push(
      createFinding({
        severity: SEVERITY.WARNING,
        message: 'Migration dosyası bulunamadı',
        file: config.paths.migrations,
      })
    );
    return findings;
  }

  // Migration numaralandırma kontrolü
  const numbers = [];
  const invalidNames = [];

  for (const file of sqlFiles) {
    const match = file.match(/^(\d+)/);
    if (match) {
      numbers.push(parseInt(match[1]));
    } else {
      invalidNames.push(file);
    }
  }

  // Geçersiz isimlendirme
  if (invalidNames.length > 0) {
    findings.push(
      createFinding({
        severity: SEVERITY.WARNING,
        message: `Migration dosyaları standart isimlendirme kullanmıyor: ${invalidNames.slice(0, 3).join(', ')}`,
        file: config.paths.migrations,
        suggestion: 'Migration dosyaları numara ile başlamalı (örn: 001_initial.sql)',
      })
    );
  }

  // Eksik numara kontrolü
  if (numbers.length > 0) {
    numbers.sort((a, b) => a - b);
    const gaps = [];

    for (let i = 1; i < numbers.length; i++) {
      const expected = numbers[i - 1] + 1;
      if (numbers[i] !== expected && numbers[i] !== numbers[i - 1]) {
        // Bazı gap'ler normal olabilir (silinmiş migration)
        if (numbers[i] - numbers[i - 1] > 5) {
          gaps.push(`${numbers[i - 1]} -> ${numbers[i]}`);
        }
      }
    }

    if (gaps.length > 0) {
      findings.push(
        createFinding({
          severity: SEVERITY.INFO,
          message: `Migration numaralarında büyük boşluklar: ${gaps.join(', ')}`,
          file: config.paths.migrations,
          suggestion: 'Migration sıralamasını kontrol edin',
        })
      );
    }
  }

  // Migration içerik kontrolleri
  for (const file of sqlFiles.slice(-10)) {
    // Son 10 migration
    const content = await readFileContent(path.join(migrationsPath, file));
    if (!content) continue;

    // DROP TABLE without IF EXISTS
    if (content.includes('DROP TABLE') && !content.includes('IF EXISTS')) {
      findings.push(
        createFinding({
          severity: SEVERITY.WARNING,
          message: `DROP TABLE IF EXISTS kullanılmamış`,
          file: `${config.paths.migrations}/${file}`,
          suggestion: 'DROP TABLE IF EXISTS kullanın',
        })
      );
    }

    // Rollback yoksa uyarı
    if (content.includes('CREATE TABLE') && !content.includes('-- Rollback') && !content.includes('DROP TABLE')) {
      findings.push(
        createFinding({
          severity: SEVERITY.INFO,
          message: `Migration rollback içermiyor`,
          file: `${config.paths.migrations}/${file}`,
          suggestion: 'Rollback SQL\'i yorum olarak ekleyin',
        })
      );
    }
  }

  return findings;
}

/**
 * Index kullanımı analizi
 */
async function checkIndexUsage(projectRoot, config) {
  const findings = [];
  const migrationsPath = path.join(projectRoot, config.paths.migrations);

  const files = await listDirectory(migrationsPath);
  const sqlFiles = files.filter((f) => f.endsWith('.sql'));

  // Tüm migration'ları birleştir
  let allSql = '';
  for (const file of sqlFiles) {
    const content = await readFileContent(path.join(migrationsPath, file));
    if (content) allSql += content + '\n';
  }

  // Foreign key'leri bul
  const fkPattern = /REFERENCES\s+(\w+)\s*\((\w+)\)/gi;
  const foreignKeys = [];
  let match;

  while ((match = fkPattern.exec(allSql)) !== null) {
    foreignKeys.push({
      table: match[1],
      column: match[2],
    });
  }

  // Index'leri bul
  const indexPattern = /CREATE\s+INDEX[^;]+ON\s+(\w+)\s*\(([^)]+)\)/gi;
  const indexes = [];

  while ((match = indexPattern.exec(allSql)) !== null) {
    indexes.push({
      table: match[1],
      columns: match[2].split(',').map((c) => c.trim()),
    });
  }

  // FK'ler için index var mı kontrol et
  for (const fk of foreignKeys) {
    const hasIndex = indexes.some(
      (idx) =>
        idx.table.toLowerCase() === fk.table.toLowerCase() && idx.columns.some((c) => c.toLowerCase() === fk.column.toLowerCase())
    );

    if (!hasIndex) {
      // Primary key genelde index'li olur
      if (fk.column.toLowerCase() !== 'id') {
        findings.push(
          createFinding({
            severity: SEVERITY.INFO,
            message: `Foreign key için index eksik olabilir: ${fk.table}(${fk.column})`,
            file: config.paths.migrations,
            suggestion: `CREATE INDEX idx_${fk.table}_${fk.column} ON ${fk.table}(${fk.column})`,
          })
        );
      }
    }
  }

  return findings;
}

/**
 * N+1 query tespiti
 */
async function checkN1Queries(projectRoot, config) {
  const findings = [];
  const routesPath = path.join(projectRoot, config.paths.routes);

  const files = await findFiles('**/*.js', routesPath, []);

  for (const file of files) {
    const content = await readFileContent(path.join(routesPath, file));
    if (!content) continue;

    // Loop içinde query pattern'leri
    const loopQueryPatterns = [
      /for\s*\([^)]+\)\s*\{[^}]*(?:\.query|await\s+pool|SELECT)/gs,
      /\.forEach\s*\([^)]+\)\s*=>\s*\{[^}]*(?:\.query|await\s+pool|SELECT)/gs,
      /\.map\s*\([^)]+\)\s*=>\s*\{[^}]*(?:\.query|await\s+pool|SELECT)/gs,
      /while\s*\([^)]+\)\s*\{[^}]*(?:\.query|SELECT)/gs,
    ];

    for (const pattern of loopQueryPatterns) {
      if (pattern.test(content)) {
        findings.push(
          createFinding({
            severity: SEVERITY.WARNING,
            message: 'Potansiyel N+1 query tespit edildi (loop içinde query)',
            file: `backend/src/routes/${file}`,
            suggestion: 'JOIN veya batch query kullanın',
          })
        );
        break;
      }
    }

    // Promise.all içinde multiple query (genelde OK ama uyarı verelim)
    if (content.includes('Promise.all') && (content.match(/\.query/g) || []).length > 5) {
      findings.push(
        createFinding({
          severity: SEVERITY.INFO,
          message: 'Çok sayıda paralel query kullanımı',
          file: `backend/src/routes/${file}`,
          suggestion: 'Batch query veya transaction kullanmayı düşünün',
        })
      );
    }
  }

  return findings;
}

/**
 * Connection pool kontrolü
 */
async function checkConnectionPool(projectRoot, config) {
  const findings = [];
  const backendSrc = path.join(projectRoot, config.paths.backend, 'src');

  const files = await findFiles('**/*.js', backendSrc, ['node_modules']);

  let hasPool = false;
  let poolConfig = null;

  for (const file of files) {
    const content = await readFileContent(path.join(backendSrc, file));
    if (!content) continue;

    // Pool kullanımı
    if (content.includes('new Pool') || content.includes('createPool')) {
      hasPool = true;

      // Pool config analizi
      const poolMatch = content.match(/new Pool\s*\(\s*\{([^}]+)\}/s);
      if (poolMatch) {
        poolConfig = poolMatch[1];
      }
    }

    // Connection leak potansiyeli
    if (content.includes('.connect()') && !content.includes('.release()') && !content.includes('finally')) {
      findings.push(
        createFinding({
          severity: SEVERITY.WARNING,
          message: 'Pool connection release eksik olabilir',
          file: `backend/src/${file}`,
          suggestion: 'try-finally ile client.release() kullanın veya pool.query() tercih edin',
        })
      );
    }
  }

  if (!hasPool) {
    findings.push(
      createFinding({
        severity: SEVERITY.WARNING,
        message: 'Database connection pool tespit edilemedi',
        file: 'backend/src/',
        suggestion: 'pg.Pool kullanarak connection pooling aktif edin',
      })
    );
  } else if (poolConfig) {
    // Pool size kontrolü
    if (!poolConfig.includes('max') && !poolConfig.includes('connectionLimit')) {
      findings.push(
        createFinding({
          severity: SEVERITY.INFO,
          message: 'Pool max connection sayısı belirtilmemiş',
          file: 'backend/src/',
          suggestion: 'max: 20 gibi bir limit belirleyin',
        })
      );
    }

    // Idle timeout
    if (!poolConfig.includes('idleTimeoutMillis')) {
      findings.push(
        createFinding({
          severity: SEVERITY.INFO,
          message: 'Pool idle timeout belirtilmemiş',
          file: 'backend/src/',
          suggestion: 'idleTimeoutMillis: 30000 ekleyin',
        })
      );
    }
  }

  return findings;
}
