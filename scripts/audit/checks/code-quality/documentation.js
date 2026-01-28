/**
 * Documentation Coverage Check
 * JSDoc coverage ve README güncelliği kontrolü
 */

import { SEVERITY, createFinding, determineStatus } from '../../lib/severity.js';
import { findFiles, readFileContent, fileExists } from '../../lib/utils.js';
import fs from 'fs/promises';
import path from 'path';

export async function checkDocumentation(context) {
  const { projectRoot, config, verbose } = context;
  const findings = [];

  // 1. README kontrolü
  const readmeFindings = await checkReadme(projectRoot, config);
  findings.push(...readmeFindings);

  // 2. JSDoc coverage kontrolü
  const jsdocFindings = await checkJSDocCoverage(projectRoot, config);
  findings.push(...jsdocFindings);

  // 3. Kritik dosyalarda dokümantasyon kontrolü
  const criticalDocsFindings = await checkCriticalFileDocs(projectRoot, config);
  findings.push(...criticalDocsFindings);

  const errorCount = findings.filter((f) => f.severity === SEVERITY.ERROR).length;
  const warningCount = findings.filter((f) => f.severity === SEVERITY.WARNING).length;

  return {
    id: 'documentation',
    name: 'Dokümantasyon Kapsamı',
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
 * README dosyası kontrolü
 */
async function checkReadme(projectRoot, config) {
  const findings = [];
  const readmePaths = ['README.md', 'readme.md', 'Readme.md'];

  let readmeFound = false;
  let readmePath = null;

  for (const name of readmePaths) {
    const fullPath = path.join(projectRoot, name);
    if (await fileExists(fullPath)) {
      readmeFound = true;
      readmePath = fullPath;
      break;
    }
  }

  if (!readmeFound) {
    findings.push(
      createFinding({
        severity: SEVERITY.WARNING,
        message: 'README.md dosyası bulunamadı',
        file: 'README.md',
        suggestion: 'Proje için README.md oluşturun',
      })
    );
    return findings;
  }

  // README içeriği ve güncellik kontrolü
  try {
    const stats = await fs.stat(readmePath);
    const content = await readFileContent(readmePath);

    // Güncellik kontrolü
    const daysSinceUpdate = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);
    const freshnessThreshold = config.codeQuality.readmeFreshnessThresholdDays || 90;

    if (daysSinceUpdate > freshnessThreshold) {
      findings.push(
        createFinding({
          severity: SEVERITY.INFO,
          message: `README ${Math.round(daysSinceUpdate)} gündür güncellenmemiş (eşik: ${freshnessThreshold} gün)`,
          file: 'README.md',
          suggestion: 'README dosyasını güncelleyin',
        })
      );
    }

    // İçerik kontrolü
    const requiredSections = ['## Kurulum', '## Kullanım', 'Installation', 'Usage', 'Getting Started'];

    const hasSetupInfo = requiredSections.some((section) => content.toLowerCase().includes(section.toLowerCase()));

    if (!hasSetupInfo) {
      findings.push(
        createFinding({
          severity: SEVERITY.INFO,
          message: 'README kurulum/kullanım bilgisi içermiyor',
          file: 'README.md',
          suggestion: 'Kurulum ve kullanım talimatları ekleyin',
        })
      );
    }

    // Minimum uzunluk kontrolü
    if (content.length < 500) {
      findings.push(
        createFinding({
          severity: SEVERITY.INFO,
          message: 'README çok kısa (< 500 karakter)',
          file: 'README.md',
          suggestion: 'Daha detaylı proje açıklaması ekleyin',
        })
      );
    }
  } catch (error) {
    // Dosya okuma hatası
  }

  return findings;
}

/**
 * JSDoc coverage kontrolü
 */
async function checkJSDocCoverage(projectRoot, config) {
  const findings = [];
  const minCoverage = config.codeQuality.minJsDocCoverage || 30;

  // Backend fonksiyonları
  const backendSrc = path.join(projectRoot, config.paths.backend, 'src');
  const backendFiles = await findFiles('**/*.js', backendSrc, ['node_modules', '.git']);

  let totalFunctions = 0;
  let documentedFunctions = 0;
  const undocumentedFiles = [];

  for (const file of backendFiles) {
    const content = await readFileContent(path.join(backendSrc, file));
    if (!content) continue;

    const { total, documented, undocumented } = analyzeJSDoc(content);
    totalFunctions += total;
    documentedFunctions += documented;

    if (undocumented.length > 0 && total > 0) {
      const coverage = (documented / total) * 100;
      if (coverage < 20) {
        undocumentedFiles.push({
          file: `backend/src/${file}`,
          coverage: coverage.toFixed(1),
          undocumented: undocumented.slice(0, 3),
        });
      }
    }
  }

  const overallCoverage = totalFunctions > 0 ? (documentedFunctions / totalFunctions) * 100 : 0;

  if (overallCoverage < minCoverage) {
    findings.push(
      createFinding({
        severity: SEVERITY.INFO,
        message: `JSDoc coverage düşük: ${overallCoverage.toFixed(1)}% (min: ${minCoverage}%)`,
        suggestion: 'Fonksiyonlara JSDoc yorumları ekleyin',
        coverage: overallCoverage.toFixed(1),
        target: minCoverage,
      })
    );
  }

  // En düşük coverage'a sahip dosyalar
  for (const fileInfo of undocumentedFiles.slice(0, 5)) {
    findings.push(
      createFinding({
        severity: SEVERITY.INFO,
        message: `Düşük JSDoc coverage: ${fileInfo.file} (${fileInfo.coverage}%)`,
        file: fileInfo.file,
        suggestion: `Dokümante edilmemiş: ${fileInfo.undocumented.join(', ')}`,
      })
    );
  }

  return findings;
}

/**
 * JSDoc analizi
 */
function analyzeJSDoc(content) {
  const functions = [];
  const documented = [];

  // Fonksiyon tanımları
  const funcPatterns = [
    /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/g,
    /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/g,
  ];

  for (const pattern of funcPatterns) {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);

    while ((match = regex.exec(content)) !== null) {
      const funcName = match[1];
      functions.push(funcName);

      // Önceki satırlarda JSDoc var mı?
      const beforeFunc = content.substring(Math.max(0, match.index - 200), match.index);
      if (beforeFunc.includes('/**') && beforeFunc.includes('*/')) {
        documented.push(funcName);
      }
    }
  }

  return {
    total: functions.length,
    documented: documented.length,
    undocumented: functions.filter((f) => !documented.includes(f)),
  };
}

/**
 * Kritik dosyalarda dokümantasyon kontrolü
 */
async function checkCriticalFileDocs(projectRoot, config) {
  const findings = [];

  // Kritik dosyalar (config, middleware, utils)
  const criticalPaths = [
    path.join(projectRoot, config.paths.backend, 'src', 'middleware'),
    path.join(projectRoot, config.paths.backend, 'src', 'utils'),
  ];

  for (const dirPath of criticalPaths) {
    if (!(await fileExists(dirPath))) continue;

    const files = await findFiles('**/*.js', dirPath, []);

    for (const file of files) {
      const content = await readFileContent(path.join(dirPath, file));
      if (!content) continue;

      // Dosya başında açıklama var mı?
      const hasFileHeader = content.trimStart().startsWith('/**') || content.trimStart().startsWith('//');

      if (!hasFileHeader && content.length > 500) {
        const relativePath = path.relative(projectRoot, path.join(dirPath, file));
        findings.push(
          createFinding({
            severity: SEVERITY.INFO,
            message: `Kritik dosyada başlık yorumu eksik: ${relativePath}`,
            file: relativePath,
            suggestion: 'Dosya başına amaç ve kullanım açıklaması ekleyin',
          })
        );
      }
    }
  }

  return findings;
}
