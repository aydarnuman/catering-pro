/**
 * Build & Deploy Health Check
 * Build yapılandırması ve deployment hazırlığı kontrolü
 */

import { SEVERITY, createFinding, determineStatus } from '../../lib/severity.js';
import { readJsonFile, runCommand, fileExists, readFileContent } from '../../lib/utils.js';
import path from 'path';

export async function checkBuildHealth(context) {
  const { projectRoot, config, verbose } = context;
  const findings = [];

  // Package.json scripts kontrolü
  const scriptsFindings = await checkRequiredScripts(projectRoot, config);
  findings.push(...scriptsFindings);

  // Build test
  const buildFindings = await testBuild(projectRoot, config, verbose);
  findings.push(...buildFindings);

  // PM2/Docker config kontrolü
  const deployFindings = await checkDeployConfig(projectRoot);
  findings.push(...deployFindings);

  // Node version kontrolü
  const nodeFindings = await checkNodeVersion(projectRoot, config);
  findings.push(...nodeFindings);

  const errorCount = findings.filter((f) => f.severity === SEVERITY.ERROR).length;
  const warningCount = findings.filter((f) => f.severity === SEVERITY.WARNING).length;

  return {
    id: 'build-health',
    name: 'Build & Deploy Sağlığı',
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
 * Required scripts kontrolü
 */
async function checkRequiredScripts(projectRoot, config) {
  const findings = [];
  const requiredScripts = config.infrastructure.build?.requiredScripts || ['build', 'start', 'dev'];

  // Backend
  const backendPkg = await readJsonFile(path.join(projectRoot, config.paths.backend, 'package.json'));
  if (backendPkg) {
    const scripts = backendPkg.scripts || {};
    for (const script of requiredScripts) {
      if (!scripts[script]) {
        findings.push(
          createFinding({
            severity: SEVERITY.WARNING,
            message: `Backend'de "${script}" script eksik`,
            file: 'backend/package.json',
            suggestion: `"${script}" script ekleyin`,
          })
        );
      }
    }
  }

  // Frontend
  const frontendPkg = await readJsonFile(path.join(projectRoot, config.paths.frontend, 'package.json'));
  if (frontendPkg) {
    const scripts = frontendPkg.scripts || {};
    for (const script of requiredScripts) {
      if (!scripts[script]) {
        findings.push(
          createFinding({
            severity: SEVERITY.WARNING,
            message: `Frontend'de "${script}" script eksik`,
            file: 'frontend/package.json',
            suggestion: `"${script}" script ekleyin`,
          })
        );
      }
    }
  }

  return findings;
}

/**
 * Build test
 */
async function testBuild(projectRoot, config, verbose) {
  const findings = [];

  // Frontend build dry-run (sadece type check)
  const frontendPath = path.join(projectRoot, config.paths.frontend);

  if (verbose) console.log('      TypeScript type check çalıştırılıyor...');

  const tscResult = await runCommand(`cd "${frontendPath}" && npx tsc --noEmit 2>&1`, {
    timeout: 120000,
  });

  if (!tscResult.success) {
    const errorCount = (tscResult.stdout.match(/error TS/g) || []).length;

    if (errorCount > 0) {
      findings.push(
        createFinding({
          severity: SEVERITY.ERROR,
          message: `TypeScript type check başarısız (${errorCount} hata)`,
          file: 'frontend/',
          suggestion: 'Type hatalarını düzeltin: npx tsc --noEmit',
        })
      );
    }
  }

  // Next.js config kontrolü
  const nextConfigPath = path.join(frontendPath, 'next.config.js');
  const nextConfig = await readFileContent(nextConfigPath);

  if (nextConfig) {
    // Standalone output kontrolü (production için önemli)
    if (!nextConfig.includes("output: 'standalone'") && !nextConfig.includes('output: "standalone"')) {
      findings.push(
        createFinding({
          severity: SEVERITY.INFO,
          message: 'Next.js standalone output aktif değil',
          file: 'frontend/next.config.js',
          suggestion: "Docker deployment için output: 'standalone' ekleyin",
        })
      );
    }
  }

  return findings;
}

/**
 * Deploy config kontrolü
 */
async function checkDeployConfig(projectRoot) {
  const findings = [];

  // PM2 config
  const pm2ConfigPath = path.join(projectRoot, 'ecosystem.config.js');
  const hasPm2 = await fileExists(pm2ConfigPath);

  if (hasPm2) {
    const pm2Config = await readFileContent(pm2ConfigPath);

    if (pm2Config) {
      // Memory limit kontrolü
      if (!pm2Config.includes('max_memory_restart')) {
        findings.push(
          createFinding({
            severity: SEVERITY.INFO,
            message: 'PM2 memory limit ayarlanmamış',
            file: 'ecosystem.config.js',
            suggestion: 'max_memory_restart ekleyin',
          })
        );
      }

      // Cluster mode kontrolü
      if (!pm2Config.includes('cluster') && !pm2Config.includes('instances')) {
        findings.push(
          createFinding({
            severity: SEVERITY.INFO,
            message: 'PM2 cluster mode aktif değil',
            file: 'ecosystem.config.js',
            suggestion: 'Production için cluster mode düşünün',
          })
        );
      }

      // Log rotation
      if (!pm2Config.includes('log_date_format') && !pm2Config.includes('pm2-logrotate')) {
        findings.push(
          createFinding({
            severity: SEVERITY.INFO,
            message: 'PM2 log rotation ayarlanmamış',
            file: 'ecosystem.config.js',
            suggestion: 'pm2-logrotate modülü kurun',
          })
        );
      }
    }
  }

  // Docker config
  const dockerfilePath = path.join(projectRoot, 'Dockerfile');
  const hasDocker = await fileExists(dockerfilePath);

  if (!hasDocker && !hasPm2) {
    findings.push(
      createFinding({
        severity: SEVERITY.INFO,
        message: 'Deployment config (PM2/Docker) bulunamadı',
        file: projectRoot,
        suggestion: 'PM2 veya Docker yapılandırması ekleyin',
      })
    );
  }

  // Docker compose
  const dockerComposePath = path.join(projectRoot, 'docker-compose.yml');
  if (hasDocker && !(await fileExists(dockerComposePath))) {
    findings.push(
      createFinding({
        severity: SEVERITY.INFO,
        message: 'docker-compose.yml bulunamadı',
        file: projectRoot,
        suggestion: 'Multi-container orchestration için docker-compose ekleyin',
      })
    );
  }

  return findings;
}

/**
 * Node version kontrolü
 */
async function checkNodeVersion(projectRoot, config) {
  const findings = [];

  // .nvmrc kontrolü
  const nvmrcPath = path.join(projectRoot, '.nvmrc');
  const hasNvmrc = await fileExists(nvmrcPath);

  if (!hasNvmrc) {
    findings.push(
      createFinding({
        severity: SEVERITY.INFO,
        message: '.nvmrc dosyası bulunamadı',
        file: '.nvmrc',
        suggestion: 'Node version\'ı sabitlemek için .nvmrc ekleyin',
      })
    );
  }

  // package.json engines kontrolü
  const rootPkg = await readJsonFile(path.join(projectRoot, 'package.json'));
  const backendPkg = await readJsonFile(path.join(projectRoot, config.paths.backend, 'package.json'));

  const pkgToCheck = rootPkg || backendPkg;

  if (pkgToCheck && !pkgToCheck.engines?.node) {
    findings.push(
      createFinding({
        severity: SEVERITY.INFO,
        message: 'package.json engines.node belirtilmemiş',
        file: 'package.json',
        suggestion: '"engines": { "node": ">=18.0.0" } ekleyin',
      })
    );
  }

  // Mevcut Node version kontrolü
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

  if (majorVersion < 18) {
    findings.push(
      createFinding({
        severity: SEVERITY.WARNING,
        message: `Node.js version eski: ${nodeVersion}`,
        file: '',
        suggestion: 'Node.js 18 veya üstü önerilir',
      })
    );
  }

  return findings;
}
