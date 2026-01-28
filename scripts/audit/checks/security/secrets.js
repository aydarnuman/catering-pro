/**
 * Hardcoded Secrets Detection Check
 * Kodda gizli anahtar (API key, password, token) tespiti
 */

import { SEVERITY, createFinding, determineStatus } from '../../lib/severity.js';
import { findFiles, readFileContent, getLineNumber, redactSecret } from '../../lib/utils.js';
import path from 'path';

export async function checkSecrets(context) {
  const { projectRoot, config, verbose } = context;
  const findings = [];

  const patterns = config.security.secretPatterns;
  const excludes = config.security.secretScanExcludes;

  // Taranacak dizinler
  const scanDirs = [
    { path: path.join(projectRoot, config.paths.backend, 'src'), label: 'backend/src' },
    { path: path.join(projectRoot, config.paths.frontend, 'src'), label: 'frontend/src' },
  ];

  let scannedFiles = 0;

  for (const dir of scanDirs) {
    const files = await findFiles('**/*.{js,ts,tsx,jsx,json}', dir.path, excludes);

    for (const file of files) {
      const filePath = path.join(dir.path, file);
      const content = await readFileContent(filePath);
      if (!content) continue;

      scannedFiles++;

      // Her pattern için kontrol
      for (const pattern of patterns) {
        const regex = new RegExp(pattern.source, pattern.flags);
        let match;

        while ((match = regex.exec(content)) !== null) {
          // False positive kontrolleri
          if (isFalsePositive(match[0], content, match.index)) {
            continue;
          }

          const lineNum = getLineNumber(content, match.index);
          const snippet = redactSecret(match[0]);

          findings.push(
            createFinding({
              severity: SEVERITY.ERROR,
              message: 'Potansiyel gizli anahtar tespit edildi',
              file: `${dir.label}/${file}`,
              line: lineNum,
              snippet: snippet,
              pattern: pattern.source.substring(0, 50),
              suggestion: 'Bu değeri environment variable\'a taşıyın',
            })
          );

          // Dosya başına limit
          if (findings.filter((f) => f.file === `${dir.label}/${file}`).length >= 5) {
            break;
          }
        }
      }
    }
  }

  // .env dosyalarının git'te olup olmadığını kontrol et
  const envFindings = await checkEnvInGit(projectRoot);
  findings.push(...envFindings);

  const errorCount = findings.filter((f) => f.severity === SEVERITY.ERROR).length;

  return {
    id: 'secrets',
    name: 'Gizli Anahtar Tespiti',
    status: errorCount > 0 ? 'error' : 'passed',
    severity: errorCount > 0 ? SEVERITY.ERROR : SEVERITY.INFO,
    fixable: false,
    findings,
    summary: {
      scannedFiles,
      potentialSecrets: findings.length,
    },
  };
}

/**
 * False positive kontrolü
 */
function isFalsePositive(matchText, content, matchIndex) {
  const lowerMatch = matchText.toLowerCase();

  // Placeholder değerler
  const placeholders = [
    'your_api_key',
    'your_secret',
    'xxx',
    'placeholder',
    'example',
    'test',
    'demo',
    'sample',
    'change_me',
    'replace_me',
    'env.',
    'process.env',
    '${',
    'undefined',
    'null',
  ];

  if (placeholders.some((p) => lowerMatch.includes(p))) {
    return true;
  }

  // Yorum satırı kontrolü
  const lineStart = content.lastIndexOf('\n', matchIndex) + 1;
  const lineContent = content.substring(lineStart, matchIndex);
  if (lineContent.trim().startsWith('//') || lineContent.trim().startsWith('*') || lineContent.trim().startsWith('#')) {
    return true;
  }

  // .example veya .sample dosyası
  if (content.includes('.example') || content.includes('.sample')) {
    return true;
  }

  // Çok kısa değerler (genelde placeholder)
  const valueMatch = matchText.match(/[:=]\s*['"]([^'"]*)['"]/);
  if (valueMatch && valueMatch[1].length < 8) {
    return true;
  }

  return false;
}

/**
 * .env dosyalarının git'te olup olmadığını kontrol et
 */
async function checkEnvInGit(projectRoot) {
  const findings = [];

  // .gitignore kontrolü
  const gitignorePath = path.join(projectRoot, '.gitignore');
  const gitignoreContent = await readFileContent(gitignorePath);

  if (gitignoreContent) {
    const envIgnored = gitignoreContent.includes('.env') || gitignoreContent.includes('*.env');

    if (!envIgnored) {
      findings.push(
        createFinding({
          severity: SEVERITY.ERROR,
          message: '.env dosyaları .gitignore\'da yok',
          file: '.gitignore',
          suggestion: '.gitignore dosyasına ".env" ve ".env.*" ekleyin',
        })
      );
    }
  }

  // .env dosyalarının varlığını kontrol et
  const envFiles = ['.env', '.env.local', '.env.production'];

  for (const envFile of envFiles) {
    const envPath = path.join(projectRoot, envFile);
    const backendEnvPath = path.join(projectRoot, 'backend', envFile);
    const frontendEnvPath = path.join(projectRoot, 'frontend', envFile);

    for (const checkPath of [envPath, backendEnvPath, frontendEnvPath]) {
      const content = await readFileContent(checkPath);
      if (content) {
        // Gerçek secret içeriyor mu?
        const hasRealSecrets =
          content.includes('sk-') ||
          content.includes('ghp_') ||
          (content.includes('SECRET') && !content.includes('your_secret'));

        if (hasRealSecrets) {
          const relativePath = path.relative(projectRoot, checkPath);
          findings.push(
            createFinding({
              severity: SEVERITY.WARNING,
              message: `${relativePath} gerçek secret değerleri içeriyor olabilir`,
              file: relativePath,
              suggestion: 'Bu dosyanın git\'e commit edilmediğinden emin olun',
            })
          );
        }
      }
    }
  }

  return findings;
}
