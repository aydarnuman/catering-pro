/**
 * TypeScript Strict Mode Check
 * TypeScript strict mode uyumluluğu kontrolü
 */

import { SEVERITY, createFinding, determineStatus } from '../../lib/severity.js';
import { readJsonFile, runCommand, readFileContent, findFiles } from '../../lib/utils.js';
import path from 'path';

export async function checkTypeScriptStrict(context) {
  const { projectRoot, config, verbose } = context;
  const findings = [];

  const frontendPath = path.join(projectRoot, config.paths.frontend);

  // 1. tsconfig.json kontrolü
  const tsconfigFindings = await checkTsConfig(frontendPath);
  findings.push(...tsconfigFindings);

  // 2. TypeScript type check çalıştır
  const typeCheckFindings = await runTypeCheck(frontendPath, verbose);
  findings.push(...typeCheckFindings);

  // 3. 'any' kullanımı kontrolü
  const anyUsageFindings = await checkAnyUsage(frontendPath);
  findings.push(...anyUsageFindings);

  const errorCount = findings.filter((f) => f.severity === SEVERITY.ERROR).length;
  const warningCount = findings.filter((f) => f.severity === SEVERITY.WARNING).length;

  return {
    id: 'typescript-strict',
    name: 'TypeScript Strict Mode',
    status: determineStatus(findings),
    severity: errorCount > 0 ? SEVERITY.ERROR : warningCount > 0 ? SEVERITY.WARNING : SEVERITY.INFO,
    fixable: false,
    findings,
    summary: {
      total: findings.length,
      errors: errorCount,
      warnings: warningCount,
    },
  };
}

async function checkTsConfig(frontendPath) {
  const findings = [];
  const tsconfigPath = path.join(frontendPath, 'tsconfig.json');
  const tsconfig = await readJsonFile(tsconfigPath);

  if (!tsconfig) {
    findings.push(
      createFinding({
        severity: SEVERITY.ERROR,
        message: 'tsconfig.json bulunamadı',
        file: 'frontend/tsconfig.json',
      })
    );
    return findings;
  }

  const compilerOptions = tsconfig.compilerOptions || {};

  // Strict mode kontrolleri
  const strictChecks = [
    { option: 'strict', recommended: true, message: 'strict mode aktif değil' },
    { option: 'noImplicitAny', recommended: true, message: 'noImplicitAny aktif değil' },
    { option: 'strictNullChecks', recommended: true, message: 'strictNullChecks aktif değil' },
    { option: 'noUnusedLocals', recommended: true, message: 'noUnusedLocals aktif değil' },
    { option: 'noUnusedParameters', recommended: true, message: 'noUnusedParameters aktif değil' },
  ];

  for (const check of strictChecks) {
    // strict: true ise diğer strict kontroller otomatik aktif
    if (check.option !== 'strict' && compilerOptions.strict === true) {
      continue;
    }

    if (compilerOptions[check.option] !== check.recommended) {
      findings.push(
        createFinding({
          severity: SEVERITY.WARNING,
          message: `tsconfig.json: ${check.message}`,
          file: 'frontend/tsconfig.json',
          suggestion: `compilerOptions.${check.option}: ${check.recommended}`,
        })
      );
    }
  }

  return findings;
}

async function runTypeCheck(frontendPath, verbose) {
  const findings = [];

  const result = await runCommand(`cd "${frontendPath}" && npx tsc --noEmit 2>&1`, {
    timeout: 120000,
  });

  if (!result.success && result.stdout) {
    const lines = result.stdout.split('\n');

    for (const line of lines) {
      // TypeScript hata formatı: file.ts(line,col): error TSxxxx: message
      const match = line.match(/^(.+?)\((\d+),(\d+)\):\s*(error|warning)\s+(TS\d+):\s*(.+)$/);

      if (match) {
        const [, file, lineNum, col, severity, code, message] = match;

        findings.push(
          createFinding({
            severity: severity === 'error' ? SEVERITY.ERROR : SEVERITY.WARNING,
            message: message,
            file: `frontend/${file}`,
            line: parseInt(lineNum),
            column: parseInt(col),
            rule: code,
          })
        );

        if (findings.length > 100) break; // Limit
      }
    }
  }

  return findings;
}

async function checkAnyUsage(frontendPath) {
  const findings = [];
  const srcPath = path.join(frontendPath, 'src');

  const files = await findFiles('**/*.{ts,tsx}', srcPath, ['node_modules', '.git', '.d.ts']);

  for (const file of files.slice(0, 50)) {
    // İlk 50 dosya
    const content = await readFileContent(path.join(srcPath, file));
    if (!content) continue;

    // 'any' type kullanımı pattern'leri
    const anyPatterns = [
      { pattern: /:\s*any\b/g, message: 'Explicit "any" type kullanımı' },
      { pattern: /as\s+any\b/g, message: '"as any" type assertion kullanımı' },
      { pattern: /<any>/g, message: 'Generic "any" kullanımı' },
    ];

    for (const { pattern, message } of anyPatterns) {
      let match;
      const regex = new RegExp(pattern.source, pattern.flags);

      while ((match = regex.exec(content)) !== null) {
        const lineNum = content.substring(0, match.index).split('\n').length;

        findings.push(
          createFinding({
            severity: SEVERITY.WARNING,
            message: message,
            file: `frontend/src/${file}`,
            line: lineNum,
            snippet: content.split('\n')[lineNum - 1]?.trim().substring(0, 80),
            suggestion: 'Specific type tanımlayın',
          })
        );

        if (findings.length > 50) break;
      }
    }

    if (findings.length > 50) break;
  }

  return findings;
}
