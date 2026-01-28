/**
 * Lint & Formatting Check
 * Biome ile lint ve formatting kontrolü
 */

import { SEVERITY, createFinding, determineStatus } from '../../lib/severity.js';
import { runCommand, fileExists } from '../../lib/utils.js';
import path from 'path';

export async function lintAndFormat(context) {
  const { projectRoot, config, verbose, fix } = context;
  const findings = [];

  // Frontend kontrolü
  const frontendPath = path.join(projectRoot, config.paths.frontend);
  const frontendBiomePath = path.join(frontendPath, 'node_modules', '.bin', 'biome');
  const frontendBiomeExists = await fileExists(frontendBiomePath);

  if (frontendBiomeExists) {
    const frontendFindings = await runBiomeCheck(frontendPath, 'frontend', fix, verbose);
    findings.push(...frontendFindings);
  } else {
    findings.push(
      createFinding({
        severity: SEVERITY.WARNING,
        message: 'Frontend için Biome bulunamadı. npm install @biomejs/biome çalıştırın.',
        file: 'frontend/package.json',
      })
    );
  }

  // Backend kontrolü
  const backendPath = path.join(projectRoot, config.paths.backend);
  const backendBiomePath = path.join(backendPath, 'node_modules', '.bin', 'biome');
  const backendBiomeExists = await fileExists(backendBiomePath);

  if (backendBiomeExists) {
    const backendFindings = await runBiomeCheck(backendPath, 'backend', fix, verbose);
    findings.push(...backendFindings);
  } else {
    // Backend için biome yoksa, basit lint kontrolü yap
    const backendSimpleFindings = await runSimpleLintCheck(backendPath, 'backend');
    findings.push(...backendSimpleFindings);
  }

  const errorCount = findings.filter((f) => f.severity === SEVERITY.ERROR).length;
  const warningCount = findings.filter((f) => f.severity === SEVERITY.WARNING).length;

  return {
    id: 'lint-format',
    name: 'Lint & Formatting',
    status: determineStatus(findings),
    severity: errorCount > 0 ? SEVERITY.ERROR : warningCount > 0 ? SEVERITY.WARNING : SEVERITY.INFO,
    fixable: true,
    findings,
    summary: {
      total: findings.length,
      errors: errorCount,
      warnings: warningCount,
    },
  };
}

async function runBiomeCheck(projectPath, label, fix, verbose) {
  const findings = [];

  const command = fix
    ? `cd "${projectPath}" && npx biome check --write src/ 2>&1`
    : `cd "${projectPath}" && npx biome check src/ --reporter=json 2>&1`;

  const result = await runCommand(command, { timeout: 120000 });

  if (!result.success && result.stdout) {
    try {
      // JSON çıktısını parse et
      const jsonOutput = JSON.parse(result.stdout);

      if (jsonOutput.diagnostics) {
        for (const diagnostic of jsonOutput.diagnostics) {
          findings.push(
            createFinding({
              severity: diagnostic.severity === 'error' ? SEVERITY.ERROR : SEVERITY.WARNING,
              message: diagnostic.message || diagnostic.description,
              file: `${label}/${diagnostic.path || 'unknown'}`,
              line: diagnostic.location?.span?.start?.line,
              column: diagnostic.location?.span?.start?.column,
              rule: diagnostic.category,
              suggestion: diagnostic.advices?.[0]?.message,
            })
          );
        }
      }
    } catch (parseError) {
      // JSON değilse text çıktısını analiz et
      const lines = result.stdout.split('\n');
      let currentFile = null;

      for (const line of lines) {
        // Dosya yolu pattern'i
        const fileMatch = line.match(/^(.*?\.[jt]sx?):(\d+):(\d+)/);
        if (fileMatch) {
          currentFile = fileMatch[1];
          const lineNum = parseInt(fileMatch[2]);
          const col = parseInt(fileMatch[3]);

          findings.push(
            createFinding({
              severity: line.includes('error') ? SEVERITY.ERROR : SEVERITY.WARNING,
              message: line.split(' ').slice(3).join(' ') || 'Lint/format sorunu',
              file: `${label}/${currentFile}`,
              line: lineNum,
              column: col,
            })
          );
        }
      }

      // Hiç bulgu yoksa genel mesaj ekle
      if (findings.length === 0 && result.stderr) {
        findings.push(
          createFinding({
            severity: SEVERITY.INFO,
            message: `${label}: Biome kontrolü tamamlandı`,
          })
        );
      }
    }
  }

  return findings;
}

async function runSimpleLintCheck(projectPath, label) {
  const findings = [];

  // Basit pattern kontrolleri
  const patterns = [
    { pattern: /console\.log\([^)]*\)/g, message: 'console.log kullanımı tespit edildi', severity: SEVERITY.WARNING },
    { pattern: /debugger;/g, message: 'debugger statement tespit edildi', severity: SEVERITY.ERROR },
    { pattern: /TODO:|FIXME:|HACK:/gi, message: 'TODO/FIXME/HACK yorum tespit edildi', severity: SEVERITY.INFO },
  ];

  // src/ dizinindeki dosyaları kontrol et
  const { findFiles, readFileContent, getLineNumber } = await import('../../lib/utils.js');
  const files = await findFiles('**/*.js', path.join(projectPath, 'src'), ['node_modules', '.git']);

  for (const file of files.slice(0, 50)) {
    // İlk 50 dosya
    const content = await readFileContent(path.join(projectPath, 'src', file));
    if (!content) continue;

    for (const { pattern, message, severity } of patterns) {
      let match;
      const regex = new RegExp(pattern.source, pattern.flags);

      while ((match = regex.exec(content)) !== null) {
        findings.push(
          createFinding({
            severity,
            message,
            file: `${label}/src/${file}`,
            line: getLineNumber(content, match.index),
            snippet: match[0].substring(0, 50),
          })
        );

        if (findings.length > 100) break; // Limit
      }
    }
  }

  return findings;
}
