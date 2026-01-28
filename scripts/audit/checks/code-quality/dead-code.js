/**
 * Dead Code Detection Check
 * Kullanılmayan import, değişken ve bağımlılık tespiti
 */

import { SEVERITY, createFinding, determineStatus } from '../../lib/severity.js';
import { readJsonFile, runCommand, findFiles, readFileContent } from '../../lib/utils.js';
import path from 'path';

export async function checkDeadCode(context) {
  const { projectRoot, config, verbose } = context;
  const findings = [];

  // 1. Kullanılmayan npm bağımlılıkları
  const unusedDeps = await checkUnusedDependencies(projectRoot, config);
  findings.push(...unusedDeps);

  // 2. Kullanılmayan import'lar (basit kontrol)
  const unusedImports = await checkUnusedImports(projectRoot, config);
  findings.push(...unusedImports);

  const errorCount = findings.filter((f) => f.severity === SEVERITY.ERROR).length;
  const warningCount = findings.filter((f) => f.severity === SEVERITY.WARNING).length;

  return {
    id: 'dead-code',
    name: 'Dead Code Tespiti',
    status: determineStatus(findings),
    severity: errorCount > 0 ? SEVERITY.ERROR : warningCount > 0 ? SEVERITY.WARNING : SEVERITY.INFO,
    fixable: true,
    findings,
    summary: {
      total: findings.length,
      unusedDependencies: unusedDeps.length,
      unusedImports: unusedImports.length,
    },
  };
}

async function checkUnusedDependencies(projectRoot, config) {
  const findings = [];

  // Backend dependencies
  const backendPkg = await readJsonFile(path.join(projectRoot, config.paths.backend, 'package.json'));
  if (backendPkg) {
    const backendUnused = await findUnusedDeps(
      path.join(projectRoot, config.paths.backend),
      backendPkg.dependencies || {},
      'backend'
    );
    findings.push(...backendUnused);
  }

  // Frontend dependencies
  const frontendPkg = await readJsonFile(path.join(projectRoot, config.paths.frontend, 'package.json'));
  if (frontendPkg) {
    const frontendUnused = await findUnusedDeps(
      path.join(projectRoot, config.paths.frontend),
      frontendPkg.dependencies || {},
      'frontend'
    );
    findings.push(...frontendUnused);
  }

  return findings;
}

async function findUnusedDeps(projectPath, dependencies, label) {
  const findings = [];
  const srcPath = path.join(projectPath, 'src');

  // Tüm kaynak dosyalarını oku
  const files = await findFiles('**/*.{js,ts,tsx,jsx}', srcPath, ['node_modules', '.git', 'dist']);
  let allContent = '';

  for (const file of files) {
    const content = await readFileContent(path.join(srcPath, file));
    if (content) {
      allContent += content + '\n';
    }
  }

  // Her bağımlılığı kontrol et
  const excludePackages = [
    // Framework/build araçları - genelde import edilmez
    'typescript',
    '@types/',
    'eslint',
    'prettier',
    'biome',
    'jest',
    'vitest',
    // Next.js internals
    'next',
    'react',
    'react-dom',
    // Dotenv gibi config paketleri
    'dotenv',
    'cross-env',
  ];

  for (const dep of Object.keys(dependencies)) {
    // Hariç tutulan paketleri atla
    if (excludePackages.some((exc) => dep.includes(exc))) continue;

    // Import/require kontrolü
    const importPatterns = [
      new RegExp(`from\\s+['"]${dep}['"]`, 'g'),
      new RegExp(`from\\s+['"]${dep}/`, 'g'),
      new RegExp(`require\\s*\\(\\s*['"]${dep}['"]\\)`, 'g'),
      new RegExp(`require\\s*\\(\\s*['"]${dep}/`, 'g'),
      new RegExp(`import\\s+['"]${dep}['"]`, 'g'),
    ];

    const isUsed = importPatterns.some((pattern) => pattern.test(allContent));

    if (!isUsed) {
      findings.push(
        createFinding({
          severity: SEVERITY.WARNING,
          message: `Kullanılmayan bağımlılık: ${dep}`,
          file: `${label}/package.json`,
          suggestion: `npm uninstall ${dep}`,
          package: dep,
        })
      );
    }
  }

  return findings;
}

async function checkUnusedImports(projectRoot, config) {
  const findings = [];

  // Frontend TypeScript dosyalarını kontrol et
  const frontendSrc = path.join(projectRoot, config.paths.frontend, 'src');
  const files = await findFiles('**/*.{ts,tsx}', frontendSrc, ['node_modules', '.git']);

  for (const file of files.slice(0, 30)) {
    // İlk 30 dosya
    const filePath = path.join(frontendSrc, file);
    const content = await readFileContent(filePath);
    if (!content) continue;

    // Import edilen isimleri bul
    const importRegex = /import\s+(?:{([^}]+)}|(\w+))\s+from/g;
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      const imports = match[1] || match[2];
      if (!imports) continue;

      // Named imports'ı parse et
      const names = imports.split(',').map((n) => n.trim().split(' as ')[0].trim());

      for (const name of names) {
        if (!name || name === 'type' || name.startsWith('type ')) continue;

        // Import sonrası kullanım kontrolü
        const afterImport = content.substring(match.index + match[0].length);
        const usageRegex = new RegExp(`\\b${name}\\b`, 'g');
        const usageCount = (afterImport.match(usageRegex) || []).length;

        if (usageCount === 0) {
          findings.push(
            createFinding({
              severity: SEVERITY.WARNING,
              message: `Kullanılmayan import: ${name}`,
              file: `frontend/src/${file}`,
              suggestion: `"${name}" import'unu kaldırın`,
            })
          );
        }
      }
    }

    if (findings.length > 50) break; // Limit
  }

  return findings;
}
