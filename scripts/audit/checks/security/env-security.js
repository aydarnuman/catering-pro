/**
 * Environment Variables Security Check
 * .env dosyaları ve environment variable güvenliği kontrolü
 */

import { SEVERITY, createFinding, determineStatus } from '../../lib/severity.js';
import { readFileContent, findFiles, fileExists } from '../../lib/utils.js';
import path from 'path';

export async function checkEnvSecurity(context) {
  const { projectRoot, config, verbose } = context;
  const findings = [];

  // .env dosyaları kontrolü
  const envFileFindings = await checkEnvFiles(projectRoot, config);
  findings.push(...envFileFindings);

  // .gitignore kontrolü
  const gitignoreFindings = await checkGitignore(projectRoot);
  findings.push(...gitignoreFindings);

  // Kodda env kullanımı kontrolü
  const codeEnvFindings = await checkEnvUsageInCode(projectRoot, config);
  findings.push(...codeEnvFindings);

  // Required env vars kontrolü
  const requiredEnvFindings = await checkRequiredEnvVars(projectRoot, config);
  findings.push(...requiredEnvFindings);

  const errorCount = findings.filter((f) => f.severity === SEVERITY.ERROR).length;
  const warningCount = findings.filter((f) => f.severity === SEVERITY.WARNING).length;

  return {
    id: 'env-security',
    name: 'Environment Güvenliği',
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
 * .env dosyaları kontrolü
 */
async function checkEnvFiles(projectRoot, config) {
  const findings = [];

  // .env.example varlığı
  const exampleEnvPaths = [
    path.join(projectRoot, '.env.example'),
    path.join(projectRoot, config.paths.backend, '.env.example'),
    path.join(projectRoot, config.paths.frontend, '.env.example'),
  ];

  let hasExample = false;
  for (const envPath of exampleEnvPaths) {
    if (await fileExists(envPath)) {
      hasExample = true;
      break;
    }
  }

  if (!hasExample) {
    findings.push(
      createFinding({
        severity: SEVERITY.INFO,
        message: '.env.example dosyası bulunamadı',
        file: '.env.example',
        suggestion: 'Gerekli environment variable\'ları belgeleyen .env.example oluşturun',
      })
    );
  }

  // .env dosyalarında hassas değerler
  const envPaths = [
    { path: path.join(projectRoot, '.env'), label: '.env' },
    { path: path.join(projectRoot, config.paths.backend, '.env'), label: 'backend/.env' },
    { path: path.join(projectRoot, config.paths.frontend, '.env'), label: 'frontend/.env' },
    { path: path.join(projectRoot, config.paths.frontend, '.env.local'), label: 'frontend/.env.local' },
  ];

  for (const { path: envPath, label } of envPaths) {
    const content = await readFileContent(envPath);
    if (!content) continue;

    // Boş veya placeholder değerler
    const lines = content.split('\n');
    for (const line of lines) {
      if (line.startsWith('#') || !line.includes('=')) continue;

      const [key, ...valueParts] = line.split('=');
      const value = valueParts.join('=').trim();

      // Boş değer
      if (!value || value === '""' || value === "''") {
        if (key.includes('SECRET') || key.includes('KEY') || key.includes('PASSWORD')) {
          findings.push(
            createFinding({
              severity: SEVERITY.WARNING,
              message: `${key} boş değere sahip`,
              file: label,
              suggestion: 'Güvenli bir değer atayın',
            })
          );
        }
      }

      // Zayıf secret değerler
      if (key.includes('SECRET') || key.includes('KEY')) {
        if (value.length < 32 && !value.includes('$') && !value.includes('{')) {
          findings.push(
            createFinding({
              severity: SEVERITY.WARNING,
              message: `${key} çok kısa olabilir (${value.length} karakter)`,
              file: label,
              suggestion: 'En az 32 karakterlik güçlü bir secret kullanın',
            })
          );
        }
      }

      // Default/örnek değerler
      const defaultValues = ['your_secret_here', 'changeme', 'password123', 'secret', 'test', 'demo'];
      if (defaultValues.some((dv) => value.toLowerCase().includes(dv))) {
        findings.push(
          createFinding({
            severity: SEVERITY.ERROR,
            message: `${key} varsayılan/örnek değer içeriyor`,
            file: label,
            suggestion: 'Gerçek bir değer atayın',
          })
        );
      }
    }
  }

  return findings;
}

/**
 * .gitignore kontrolü
 */
async function checkGitignore(projectRoot) {
  const findings = [];
  const gitignorePath = path.join(projectRoot, '.gitignore');
  const content = await readFileContent(gitignorePath);

  if (!content) {
    findings.push(
      createFinding({
        severity: SEVERITY.ERROR,
        message: '.gitignore dosyası bulunamadı',
        file: '.gitignore',
        suggestion: '.gitignore oluşturun ve .env dosyalarını ekleyin',
      })
    );
    return findings;
  }

  // .env dosyaları kontrolü
  const requiredIgnores = ['.env', '.env.local', '.env.*.local', '*.env'];

  for (const pattern of requiredIgnores) {
    if (!content.includes(pattern) && !content.includes('.env*')) {
      findings.push(
        createFinding({
          severity: SEVERITY.WARNING,
          message: `${pattern} .gitignore'da yok`,
          file: '.gitignore',
          suggestion: `${pattern} ekleyin`,
        })
      );
    }
  }

  // Diğer hassas dosyalar
  const sensitiveFiles = ['*.pem', '*.key', 'credentials.json', 'serviceAccount.json'];

  for (const file of sensitiveFiles) {
    if (!content.includes(file)) {
      findings.push(
        createFinding({
          severity: SEVERITY.INFO,
          message: `${file} .gitignore'da yok`,
          file: '.gitignore',
          suggestion: `${file} eklemeyi düşünün`,
        })
      );
    }
  }

  return findings;
}

/**
 * Kodda env kullanımı kontrolü
 */
async function checkEnvUsageInCode(projectRoot, config) {
  const findings = [];
  const disallowedInCode = config.security.env?.disallowedInCode || [];

  const backendSrc = path.join(projectRoot, config.paths.backend, 'src');
  const files = await findFiles('**/*.js', backendSrc, ['node_modules']);

  for (const file of files) {
    const content = await readFileContent(path.join(backendSrc, file));
    if (!content) continue;

    // Hardcoded env değerleri kontrolü (zaten secrets.js'de yapılıyor)

    // process.env kullanımı doğrudan fonksiyon içinde mi?
    // Best practice: config dosyasından import etmek
    const processEnvCount = (content.match(/process\.env\./g) || []).length;

    if (processEnvCount > 10 && !file.includes('config')) {
      findings.push(
        createFinding({
          severity: SEVERITY.INFO,
          message: `Çok sayıda doğrudan process.env kullanımı (${processEnvCount})`,
          file: `backend/src/${file}`,
          suggestion: 'Merkezi config dosyası kullanın',
        })
      );
    }

    // Undefined env kontrolü eksik
    for (const envVar of disallowedInCode) {
      if (content.includes(`process.env.${envVar}`) && !content.includes('||') && !content.includes('??')) {
        findings.push(
          createFinding({
            severity: SEVERITY.INFO,
            message: `${envVar} için fallback değer yok`,
            file: `backend/src/${file}`,
            suggestion: 'process.env.VAR || defaultValue kullanın',
          })
        );
      }
    }
  }

  return findings;
}

/**
 * Required env vars kontrolü
 */
async function checkRequiredEnvVars(projectRoot, config) {
  const findings = [];
  const requiredVars = config.security.env?.requiredEnvVars || [];

  // .env.example'dan required vars çıkar
  const examplePath = path.join(projectRoot, '.env.example');
  const exampleContent = await readFileContent(examplePath);

  if (exampleContent) {
    const exampleVars = exampleContent
      .split('\n')
      .filter((line) => line.includes('=') && !line.startsWith('#'))
      .map((line) => line.split('=')[0].trim());

    // Mevcut .env ile karşılaştır
    const envPath = path.join(projectRoot, '.env');
    const envContent = await readFileContent(envPath);

    if (envContent) {
      const envVars = envContent
        .split('\n')
        .filter((line) => line.includes('=') && !line.startsWith('#'))
        .map((line) => line.split('=')[0].trim());

      const missingVars = exampleVars.filter((v) => !envVars.includes(v));

      for (const missing of missingVars) {
        findings.push(
          createFinding({
            severity: SEVERITY.WARNING,
            message: `${missing} .env'de eksik (.env.example'da var)`,
            file: '.env',
            suggestion: `${missing} değerini ekleyin`,
          })
        );
      }
    }
  }

  return findings;
}
