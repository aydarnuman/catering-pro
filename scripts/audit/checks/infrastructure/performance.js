/**
 * Performance Audit Check
 * Bundle boyutu ve memory leak potansiyeli kontrolü
 */

import { SEVERITY, createFinding, determineStatus } from '../../lib/severity.js';
import { readJsonFile, runCommand, findFiles, readFileContent, fileExists, getFileSizeMB } from '../../lib/utils.js';
import path from 'path';

export async function checkPerformance(context) {
  const { projectRoot, config, verbose } = context;
  const findings = [];

  // Bundle boyutu analizi
  const bundleFindings = await checkBundleSize(projectRoot, config, verbose);
  findings.push(...bundleFindings);

  // Memory leak potansiyeli
  const memoryFindings = await checkMemoryLeaks(projectRoot, config);
  findings.push(...memoryFindings);

  // Dependency boyutu
  const depFindings = await checkDependencySize(projectRoot, config);
  findings.push(...depFindings);

  // Performance anti-patterns
  const patternFindings = await checkPerformancePatterns(projectRoot, config);
  findings.push(...patternFindings);

  const errorCount = findings.filter((f) => f.severity === SEVERITY.ERROR).length;
  const warningCount = findings.filter((f) => f.severity === SEVERITY.WARNING).length;

  return {
    id: 'performance',
    name: 'Performans Denetimi',
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
 * Bundle boyutu kontrolü
 */
async function checkBundleSize(projectRoot, config, verbose) {
  const findings = [];
  const frontendPath = path.join(projectRoot, config.paths.frontend);

  // .next dizini var mı?
  const nextBuildPath = path.join(frontendPath, '.next');
  const hasBuild = await fileExists(nextBuildPath);

  if (!hasBuild) {
    findings.push(
      createFinding({
        severity: SEVERITY.INFO,
        message: 'Frontend build bulunamadı, bundle analizi yapılamadı',
        file: 'frontend/.next',
        suggestion: 'npm run build çalıştırın',
      })
    );
    return findings;
  }

  // Static chunks boyutu
  const chunksPath = path.join(nextBuildPath, 'static', 'chunks');
  if (await fileExists(chunksPath)) {
    const { listDirectory } = await import('../../lib/utils.js');
    const chunks = await listDirectory(chunksPath);

    let totalSize = 0;
    const largeChunks = [];

    for (const chunk of chunks) {
      if (chunk.endsWith('.js')) {
        const size = await getFileSizeMB(path.join(chunksPath, chunk));
        totalSize += size;

        if (size > 0.5) {
          // 500KB üzeri chunk'lar
          largeChunks.push({ name: chunk, size: size.toFixed(2) });
        }
      }
    }

    const maxBundleSize = config.infrastructure.performance?.maxBundleSizeMB || 5;

    if (totalSize > maxBundleSize) {
      findings.push(
        createFinding({
          severity: SEVERITY.WARNING,
          message: `Toplam bundle boyutu büyük: ${totalSize.toFixed(2)} MB (max: ${maxBundleSize} MB)`,
          file: 'frontend/.next/static/chunks',
          suggestion: 'Code splitting ve lazy loading kullanın',
        })
      );
    }

    // Büyük chunk'lar
    for (const chunk of largeChunks.slice(0, 3)) {
      findings.push(
        createFinding({
          severity: SEVERITY.INFO,
          message: `Büyük chunk: ${chunk.name} (${chunk.size} MB)`,
          file: `frontend/.next/static/chunks/${chunk.name}`,
          suggestion: 'Dynamic import ile parçalayın',
        })
      );
    }
  }

  return findings;
}

/**
 * Memory leak potansiyeli kontrolü
 */
async function checkMemoryLeaks(projectRoot, config) {
  const findings = [];

  // Backend kontrolü
  const backendSrc = path.join(projectRoot, config.paths.backend, 'src');
  const backendFiles = await findFiles('**/*.js', backendSrc, ['node_modules']);

  for (const file of backendFiles) {
    const content = await readFileContent(path.join(backendSrc, file));
    if (!content) continue;

    // Event listener cleanup eksikliği
    if (content.includes('.on(') || content.includes('.addEventListener')) {
      if (!content.includes('.off(') && !content.includes('.removeEventListener') && !content.includes('.removeAllListeners')) {
        findings.push(
          createFinding({
            severity: SEVERITY.INFO,
            message: 'Event listener cleanup eksik olabilir',
            file: `backend/src/${file}`,
            suggestion: 'Event listener\'ları cleanup edin',
          })
        );
      }
    }

    // setInterval cleanup
    if (content.includes('setInterval') && !content.includes('clearInterval')) {
      findings.push(
        createFinding({
          severity: SEVERITY.WARNING,
          message: 'setInterval clearInterval olmadan kullanılıyor',
          file: `backend/src/${file}`,
          suggestion: 'Interval\'ı temizlemeyi unutmayın',
        })
      );
    }

    // Global değişkenler
    const globalVars = content.match(/^(let|var)\s+\w+\s*=/gm) || [];
    if (globalVars.length > 5 && !file.includes('config') && !file.includes('constant')) {
      findings.push(
        createFinding({
          severity: SEVERITY.INFO,
          message: `Çok sayıda modül seviyesi değişken (${globalVars.length})`,
          file: `backend/src/${file}`,
          suggestion: 'Gereksiz global state\'den kaçının',
        })
      );
    }
  }

  // Frontend kontrolü
  const frontendSrc = path.join(projectRoot, config.paths.frontend, 'src');
  const frontendFiles = await findFiles('**/*.{tsx,ts}', frontendSrc, ['node_modules']);

  for (const file of frontendFiles.slice(0, 30)) {
    const content = await readFileContent(path.join(frontendSrc, file));
    if (!content) continue;

    // useEffect cleanup
    if (content.includes('useEffect') && content.includes('subscribe')) {
      if (!content.includes('return ()') && !content.includes('return function')) {
        findings.push(
          createFinding({
            severity: SEVERITY.WARNING,
            message: 'useEffect subscription cleanup eksik olabilir',
            file: `frontend/src/${file}`,
            suggestion: 'useEffect içinde cleanup function döndürün',
          })
        );
      }
    }

    // AbortController kullanımı (fetch cleanup)
    if (content.includes('fetch(') && !content.includes('AbortController') && content.includes('useEffect')) {
      findings.push(
        createFinding({
          severity: SEVERITY.INFO,
          message: 'useEffect içinde fetch AbortController kullanmıyor',
          file: `frontend/src/${file}`,
          suggestion: 'Race condition önlemek için AbortController kullanın',
        })
      );
    }
  }

  return findings;
}

/**
 * Dependency boyutu kontrolü
 */
async function checkDependencySize(projectRoot, config) {
  const findings = [];

  // Büyük dependency'ler
  const largeDeps = [
    { name: 'moment', alternative: 'date-fns veya dayjs', size: '~300KB' },
    { name: 'lodash', alternative: 'lodash-es veya native', size: '~70KB' },
    { name: 'jquery', alternative: 'native DOM API', size: '~90KB' },
    { name: 'underscore', alternative: 'lodash-es veya native', size: '~60KB' },
  ];

  const frontendPkg = await readJsonFile(path.join(projectRoot, config.paths.frontend, 'package.json'));

  if (frontendPkg) {
    const deps = { ...(frontendPkg.dependencies || {}) };

    for (const { name, alternative, size } of largeDeps) {
      if (deps[name]) {
        findings.push(
          createFinding({
            severity: SEVERITY.INFO,
            message: `Büyük dependency: ${name} (${size})`,
            file: 'frontend/package.json',
            suggestion: `Alternatif: ${alternative}`,
          })
        );
      }
    }
  }

  return findings;
}

/**
 * Performance anti-pattern kontrolü
 */
async function checkPerformancePatterns(projectRoot, config) {
  const findings = [];

  // Frontend patterns
  const frontendSrc = path.join(projectRoot, config.paths.frontend, 'src');
  const frontendFiles = await findFiles('**/*.{tsx,ts}', frontendSrc, ['node_modules']);

  for (const file of frontendFiles.slice(0, 30)) {
    const content = await readFileContent(path.join(frontendSrc, file));
    if (!content) continue;

    // Inline function in render (re-render cause)
    if (content.includes('onClick={() =>') || content.includes('onChange={() =>')) {
      const inlineCount = (content.match(/on\w+\s*=\s*\{\s*\(\)\s*=>/g) || []).length;
      if (inlineCount > 5) {
        findings.push(
          createFinding({
            severity: SEVERITY.INFO,
            message: `Çok sayıda inline handler (${inlineCount})`,
            file: `frontend/src/${file}`,
            suggestion: 'useCallback ile memoize edin veya dışarı çıkarın',
          })
        );
      }
    }

    // Object/array literal in dependency array
    if (content.match(/useEffect\s*\([^,]+,\s*\[[^\]]*\{[^\}]*\}[^\]]*\]\)/)) {
      findings.push(
        createFinding({
          severity: SEVERITY.WARNING,
          message: 'useEffect dependency array\'de object literal',
          file: `frontend/src/${file}`,
          suggestion: 'Object literal yerine useMemo kullanın',
        })
      );
    }

    // Large state objects
    if (content.includes('useState') && content.match(/useState\s*\(\s*\{[^}]{500,}\}/)) {
      findings.push(
        createFinding({
          severity: SEVERITY.INFO,
          message: 'Büyük state object',
          file: `frontend/src/${file}`,
          suggestion: 'State\'i daha küçük parçalara bölün veya useReducer kullanın',
        })
      );
    }
  }

  // Backend patterns
  const backendSrc = path.join(projectRoot, config.paths.backend, 'src');
  const backendFiles = await findFiles('**/*.js', backendSrc, ['node_modules']);

  for (const file of backendFiles) {
    const content = await readFileContent(path.join(backendSrc, file));
    if (!content) continue;

    // Sync file operations
    const syncOps = ['readFileSync', 'writeFileSync', 'existsSync', 'readdirSync'];
    for (const op of syncOps) {
      if (content.includes(op) && !file.includes('config') && !file.includes('migrate')) {
        findings.push(
          createFinding({
            severity: SEVERITY.WARNING,
            message: `Sync file operation: ${op}`,
            file: `backend/src/${file}`,
            suggestion: 'Async alternatifi kullanın (readFile, writeFile)',
          })
        );
        break;
      }
    }

    // Blocking operations in hot path
    if (content.includes('router.') && content.includes('JSON.parse')) {
      const jsonParseCount = (content.match(/JSON\.parse/g) || []).length;
      if (jsonParseCount > 3) {
        findings.push(
          createFinding({
            severity: SEVERITY.INFO,
            message: `Route handler'da çok sayıda JSON.parse (${jsonParseCount})`,
            file: `backend/src/${file}`,
            suggestion: 'Body parsing middleware kullanın',
          })
        );
      }
    }
  }

  return findings;
}
