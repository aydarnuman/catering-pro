/**
 * Dependency Vulnerabilities Check
 * npm audit ile bağımlılık güvenlik kontrolü
 */

import { SEVERITY, createFinding, determineStatus } from '../../lib/severity.js';
import { runCommand } from '../../lib/utils.js';
import path from 'path';

export async function checkDependencies(context) {
  const { projectRoot, config, fix, verbose } = context;
  const findings = [];

  const severityLevels = config.security.auditSeverityLevels || ['critical', 'high', 'moderate'];

  // Backend audit
  const backendPath = path.join(projectRoot, config.paths.backend);
  const backendFindings = await runNpmAudit(backendPath, 'backend', severityLevels, fix, verbose);
  findings.push(...backendFindings);

  // Frontend audit
  const frontendPath = path.join(projectRoot, config.paths.frontend);
  const frontendFindings = await runNpmAudit(frontendPath, 'frontend', severityLevels, fix, verbose);
  findings.push(...frontendFindings);

  // Özet sayıları
  const summary = {
    critical: findings.filter((f) => f.vulnSeverity === 'critical').length,
    high: findings.filter((f) => f.vulnSeverity === 'high').length,
    moderate: findings.filter((f) => f.vulnSeverity === 'moderate').length,
    low: findings.filter((f) => f.vulnSeverity === 'low').length,
  };

  const errorCount = summary.critical + summary.high;
  const warningCount = summary.moderate;

  return {
    id: 'dependencies',
    name: 'Bağımlılık Güvenliği',
    status: errorCount > 0 ? 'error' : warningCount > 0 ? 'warning' : 'passed',
    severity: errorCount > 0 ? SEVERITY.ERROR : warningCount > 0 ? SEVERITY.WARNING : SEVERITY.INFO,
    fixable: true,
    findings,
    summary,
  };
}

async function runNpmAudit(projectPath, label, severityLevels, fix, verbose) {
  const findings = [];

  // Fix modu
  if (fix) {
    if (verbose) console.log(`   🔧 ${label}: npm audit fix çalıştırılıyor...`);
    await runCommand(`cd "${projectPath}" && npm audit fix`, { timeout: 120000 });
  }

  // Audit çalıştır
  const result = await runCommand(`cd "${projectPath}" && npm audit --json 2>&1`, {
    timeout: 60000,
  });

  try {
    const auditResult = JSON.parse(result.stdout);

    if (auditResult.vulnerabilities) {
      for (const [pkgName, vuln] of Object.entries(auditResult.vulnerabilities)) {
        const severity = vuln.severity;

        // Seviye filtreleme
        if (!severityLevels.includes(severity)) continue;

        findings.push(
          createFinding({
            severity: severity === 'critical' || severity === 'high' ? SEVERITY.ERROR : SEVERITY.WARNING,
            message: `${pkgName}: ${vuln.via?.[0]?.title || 'Güvenlik açığı tespit edildi'}`,
            package: pkgName,
            version: vuln.range,
            vulnSeverity: severity,
            fixAvailable: vuln.fixAvailable,
            suggestion: vuln.fixAvailable ? `npm audit fix veya npm update ${pkgName}` : 'Manuel güncelleme gerekli',
            file: `${label}/package.json`,
          })
        );
      }
    }

    // Metadata'dan özet
    if (auditResult.metadata?.vulnerabilities) {
      const meta = auditResult.metadata.vulnerabilities;
      if (verbose) {
        console.log(`      ${label}: ${meta.total || 0} güvenlik açığı (${meta.critical || 0} kritik, ${meta.high || 0} yüksek)`);
      }
    }
  } catch (parseError) {
    // JSON parse edilemezse text çıktısını analiz et
    if (result.stdout.includes('found 0 vulnerabilities')) {
      // Temiz
    } else if (result.stdout.includes('vulnerabilities')) {
      const match = result.stdout.match(/found (\d+) vulnerabilities/);
      if (match) {
        findings.push(
          createFinding({
            severity: SEVERITY.WARNING,
            message: `${label}: ${match[1]} güvenlik açığı tespit edildi`,
            file: `${label}/package.json`,
            suggestion: 'npm audit çalıştırarak detayları görün',
          })
        );
      }
    }
  }

  return findings;
}
