/**
 * Code Complexity Check
 * Cyclomatic complexity ve kod karmaşıklığı analizi
 */

import { SEVERITY, createFinding, determineStatus } from '../../lib/severity.js';
import { findFiles, readFileContent, getLineNumber } from '../../lib/utils.js';
import path from 'path';

export async function checkComplexity(context) {
  const { projectRoot, config, verbose } = context;
  const findings = [];

  const maxComplexity = config.codeQuality.maxCyclomaticComplexity || 15;
  const maxLinesPerFile = config.codeQuality.maxLinesPerFile || 500;
  const maxLinesPerFunction = config.codeQuality.maxLinesPerFunction || 50;

  // Backend dosyaları
  const backendSrc = path.join(projectRoot, config.paths.backend, 'src');
  const backendFiles = await findFiles('**/*.js', backendSrc, ['node_modules', '.git']);

  for (const file of backendFiles) {
    const filePath = path.join(backendSrc, file);
    const content = await readFileContent(filePath);
    if (!content) continue;

    const fileFindings = await analyzeFileComplexity(content, `backend/src/${file}`, {
      maxComplexity,
      maxLinesPerFile,
      maxLinesPerFunction,
    });
    findings.push(...fileFindings);
  }

  // Frontend dosyaları
  const frontendSrc = path.join(projectRoot, config.paths.frontend, 'src');
  const frontendFiles = await findFiles('**/*.{ts,tsx}', frontendSrc, ['node_modules', '.git']);

  for (const file of frontendFiles.slice(0, 50)) {
    // İlk 50 dosya
    const filePath = path.join(frontendSrc, file);
    const content = await readFileContent(filePath);
    if (!content) continue;

    const fileFindings = await analyzeFileComplexity(content, `frontend/src/${file}`, {
      maxComplexity,
      maxLinesPerFile,
      maxLinesPerFunction,
    });
    findings.push(...fileFindings);
  }

  const errorCount = findings.filter((f) => f.severity === SEVERITY.ERROR).length;
  const warningCount = findings.filter((f) => f.severity === SEVERITY.WARNING).length;

  return {
    id: 'complexity',
    name: 'Kod Karmaşıklığı',
    status: determineStatus(findings),
    severity: errorCount > 0 ? SEVERITY.ERROR : warningCount > 0 ? SEVERITY.WARNING : SEVERITY.INFO,
    fixable: false,
    findings,
    summary: {
      total: findings.length,
      highComplexityFunctions: findings.filter((f) => f.complexity).length,
      largeFunctions: findings.filter((f) => f.functionLines).length,
      largeFiles: findings.filter((f) => f.fileLines).length,
    },
  };
}

async function analyzeFileComplexity(content, filePath, thresholds) {
  const findings = [];
  const lines = content.split('\n');

  // 1. Dosya boyutu kontrolü
  if (lines.length > thresholds.maxLinesPerFile) {
    findings.push(
      createFinding({
        severity: SEVERITY.WARNING,
        message: `Dosya çok uzun: ${lines.length} satır (max: ${thresholds.maxLinesPerFile})`,
        file: filePath,
        fileLines: lines.length,
        suggestion: 'Dosyayı daha küçük modüllere bölün',
      })
    );
  }

  // 2. Fonksiyon analizi
  const functions = extractFunctions(content);

  for (const func of functions) {
    // Fonksiyon uzunluğu
    if (func.lines > thresholds.maxLinesPerFunction) {
      findings.push(
        createFinding({
          severity: SEVERITY.WARNING,
          message: `Fonksiyon çok uzun: ${func.name} (${func.lines} satır, max: ${thresholds.maxLinesPerFunction})`,
          file: filePath,
          line: func.startLine,
          function: func.name,
          functionLines: func.lines,
          suggestion: 'Fonksiyonu daha küçük parçalara bölün',
        })
      );
    }

    // Cyclomatic complexity
    const complexity = calculateComplexity(func.body);
    if (complexity > thresholds.maxComplexity) {
      findings.push(
        createFinding({
          severity: complexity > thresholds.maxComplexity * 1.5 ? SEVERITY.ERROR : SEVERITY.WARNING,
          message: `Yüksek karmaşıklık: ${func.name} (${complexity}, max: ${thresholds.maxComplexity})`,
          file: filePath,
          line: func.startLine,
          function: func.name,
          complexity: complexity,
          threshold: thresholds.maxComplexity,
          suggestion: 'Koşulları ve döngüleri basitleştirin, helper fonksiyonlar kullanın',
        })
      );
    }
  }

  return findings;
}

/**
 * Fonksiyonları ayıkla (basit implementasyon)
 */
function extractFunctions(content) {
  const functions = [];
  const lines = content.split('\n');

  // Function/method patterns
  const patterns = [
    // function declaration
    /^(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/,
    // arrow function assignment
    /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/,
    // method in object/class
    /^\s*(?:async\s+)?(\w+)\s*\([^)]*\)\s*{/,
  ];

  let currentFunc = null;
  let braceCount = 0;
  let funcStartLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Yeni fonksiyon başlangıcı
    if (!currentFunc) {
      for (const pattern of patterns) {
        const match = line.match(pattern);
        if (match) {
          currentFunc = {
            name: match[1] || 'anonymous',
            startLine: i + 1,
            body: '',
          };
          funcStartLine = i;
          braceCount = 0;
          break;
        }
      }
    }

    // Fonksiyon içindeyken
    if (currentFunc) {
      currentFunc.body += line + '\n';

      // Brace sayımı
      for (const char of line) {
        if (char === '{') braceCount++;
        if (char === '}') braceCount--;
      }

      // Fonksiyon sonu
      if (braceCount <= 0 && currentFunc.body.includes('{')) {
        currentFunc.lines = i - funcStartLine + 1;
        functions.push(currentFunc);
        currentFunc = null;
      }
    }
  }

  return functions;
}

/**
 * Cyclomatic complexity hesapla
 */
function calculateComplexity(code) {
  if (!code) return 1;

  let complexity = 1; // Base complexity

  // Karar noktaları
  const decisionPoints = [
    /\bif\s*\(/g,
    /\belse\s+if\s*\(/g,
    /\bwhile\s*\(/g,
    /\bfor\s*\(/g,
    /\bcase\s+[^:]+:/g,
    /\bcatch\s*\(/g,
    /\?\s*[^:]+:/g, // Ternary
    /&&/g,
    /\|\|/g,
    /\?\?/g, // Nullish coalescing
  ];

  for (const pattern of decisionPoints) {
    const matches = code.match(pattern);
    if (matches) {
      complexity += matches.length;
    }
  }

  return complexity;
}
