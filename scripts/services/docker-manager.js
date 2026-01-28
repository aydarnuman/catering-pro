#!/usr/bin/env node
/**
 * Catering Pro - Docker Manager
 * Docker container yönetimi (opsiyonel)
 */

import { execSync, spawn } from 'child_process';
import { paths, colors, icons } from './config.js';

const c = colors;

/**
 * Docker'ın kurulu olup olmadığını kontrol et
 */
export function isDockerInstalled() {
  try {
    execSync('docker --version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Docker daemon'ın çalışıp çalışmadığını kontrol et
 */
export function isDockerRunning() {
  try {
    execSync('docker info', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Docker Compose'un kurulu olup olmadığını kontrol et
 */
export function isDockerComposeInstalled() {
  try {
    execSync('docker-compose --version', { stdio: 'pipe' });
    return true;
  } catch {
    // docker compose (v2) dene
    try {
      execSync('docker compose version', { stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Docker kullanılabilir mi kontrol et
 */
export function isDockerAvailable() {
  return isDockerInstalled() && isDockerRunning();
}

/**
 * Docker Compose komutunu al (v1 veya v2)
 */
export function getDockerComposeCommand() {
  try {
    execSync('docker-compose --version', { stdio: 'pipe' });
    return 'docker-compose';
  } catch {
    return 'docker compose';
  }
}

/**
 * Catering container'larını listele
 */
export function listContainers(all = false) {
  if (!isDockerAvailable()) {
    return { error: 'Docker kullanılamıyor', containers: [] };
  }

  try {
    const flag = all ? '-a' : '';
    const output = execSync(
      `docker ps ${flag} --filter "name=catering_" --format "{{.ID}}|{{.Names}}|{{.Status}}|{{.Ports}}"`,
      { encoding: 'utf-8', cwd: paths.root }
    );

    const containers = output
      .trim()
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        const [id, name, status, ports] = line.split('|');
        return {
          id,
          name,
          status,
          ports,
          running: status.toLowerCase().includes('up'),
        };
      });

    return { containers, error: null };
  } catch (error) {
    return { containers: [], error: error.message };
  }
}

/**
 * Container durumunu al
 */
export function getContainerStatus(containerName) {
  if (!isDockerAvailable()) {
    return { exists: false, running: false, error: 'Docker kullanılamıyor' };
  }

  try {
    const output = execSync(
      `docker inspect --format "{{.State.Status}}|{{.State.Running}}|{{.State.Health.Status}}" ${containerName} 2>/dev/null`,
      { encoding: 'utf-8' }
    );

    const [status, running, health] = output.trim().split('|');

    return {
      exists: true,
      status,
      running: running === 'true',
      health: health || 'none',
    };
  } catch {
    return { exists: false, running: false };
  }
}

/**
 * Container loglarını al
 */
export function getContainerLogs(containerName, lines = 50) {
  if (!isDockerAvailable()) {
    return { logs: null, error: 'Docker kullanılamıyor' };
  }

  try {
    const output = execSync(
      `docker logs --tail ${lines} ${containerName} 2>&1`,
      { encoding: 'utf-8' }
    );

    return { logs: output, error: null };
  } catch (error) {
    return { logs: null, error: error.message };
  }
}

/**
 * Container loglarını canlı takip et
 */
export function followContainerLogs(containerName, callback) {
  if (!isDockerAvailable()) {
    callback(null, 'Docker kullanılamıyor');
    return null;
  }

  const child = spawn('docker', ['logs', '-f', '--tail', '100', containerName], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (data) => {
    callback(data.toString(), null);
  });

  child.stderr.on('data', (data) => {
    callback(data.toString(), null);
  });

  child.on('error', (error) => {
    callback(null, error.message);
  });

  return child;
}

/**
 * Docker Compose up
 */
export async function composeUp(detach = true, services = []) {
  if (!isDockerAvailable()) {
    return { success: false, error: 'Docker kullanılamıyor' };
  }

  const composeCmd = getDockerComposeCommand();
  const detachFlag = detach ? '-d' : '';
  const serviceArgs = services.length > 0 ? services.join(' ') : '';

  try {
    const cmd = `${composeCmd} up ${detachFlag} ${serviceArgs}`.trim();
    execSync(cmd, { cwd: paths.root, stdio: 'inherit' });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Docker Compose down
 */
export async function composeDown(removeVolumes = false) {
  if (!isDockerAvailable()) {
    return { success: false, error: 'Docker kullanılamıyor' };
  }

  const composeCmd = getDockerComposeCommand();
  const volumeFlag = removeVolumes ? '-v' : '';

  try {
    execSync(`${composeCmd} down ${volumeFlag}`, { cwd: paths.root, stdio: 'inherit' });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Docker Compose restart
 */
export async function composeRestart(services = []) {
  if (!isDockerAvailable()) {
    return { success: false, error: 'Docker kullanılamıyor' };
  }

  const composeCmd = getDockerComposeCommand();
  const serviceArgs = services.length > 0 ? services.join(' ') : '';

  try {
    execSync(`${composeCmd} restart ${serviceArgs}`, { cwd: paths.root, stdio: 'inherit' });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Container başlat
 */
export function startContainer(containerName) {
  if (!isDockerAvailable()) {
    return { success: false, error: 'Docker kullanılamıyor' };
  }

  try {
    execSync(`docker start ${containerName}`, { stdio: 'pipe' });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Container durdur
 */
export function stopContainer(containerName) {
  if (!isDockerAvailable()) {
    return { success: false, error: 'Docker kullanılamıyor' };
  }

  try {
    execSync(`docker stop ${containerName}`, { stdio: 'pipe' });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Container restart
 */
export function restartContainer(containerName) {
  if (!isDockerAvailable()) {
    return { success: false, error: 'Docker kullanılamıyor' };
  }

  try {
    execSync(`docker restart ${containerName}`, { stdio: 'pipe' });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Docker durumunu yazdır
 */
export function printDockerStatus() {
  console.log(`\n${c.cyan}${c.bold}═══════════════════════════════════════════════════════════════${c.reset}`);
  console.log(`${c.cyan}${c.bold}              ${icons.docker} DOCKER DURUMU${c.reset}`);
  console.log(`${c.cyan}${c.bold}═══════════════════════════════════════════════════════════════${c.reset}\n`);

  // Docker durumu
  const dockerInstalled = isDockerInstalled();
  const dockerRunning = dockerInstalled && isDockerRunning();
  const composeInstalled = isDockerComposeInstalled();

  console.log(`${c.bold}Docker Engine:${c.reset}`);
  console.log(`  ${dockerInstalled ? icons.success : icons.error} Kurulu: ${dockerInstalled ? c.green + 'Evet' : c.red + 'Hayır'}${c.reset}`);
  console.log(`  ${dockerRunning ? icons.success : icons.error} Çalışıyor: ${dockerRunning ? c.green + 'Evet' : c.red + 'Hayır'}${c.reset}`);

  console.log(`\n${c.bold}Docker Compose:${c.reset}`);
  console.log(`  ${composeInstalled ? icons.success : icons.error} Kurulu: ${composeInstalled ? c.green + 'Evet' : c.red + 'Hayır'}${c.reset}`);

  if (!dockerRunning) {
    console.log(`\n${c.yellow}${icons.warning} Docker daemon çalışmıyor. Docker Desktop'ı başlatın.${c.reset}`);
    return;
  }

  // Container listesi
  const { containers, error } = listContainers(true);

  if (error) {
    console.log(`\n${c.red}${icons.error} Container listesi alınamadı: ${error}${c.reset}`);
    return;
  }

  console.log(`\n${c.bold}Catering Container'ları:${c.reset}`);

  if (containers.length === 0) {
    console.log(`  ${c.dim}Hiç container bulunamadı${c.reset}`);
    console.log(`  ${c.dim}Başlatmak için: docker-compose up -d${c.reset}`);
  } else {
    for (const container of containers) {
      const statusIcon = container.running ? icons.running : icons.stopped;
      const statusColor = container.running ? c.green : c.red;

      console.log(`\n  ${statusIcon} ${c.bold}${container.name}${c.reset}`);
      console.log(`     ID: ${c.dim}${container.id}${c.reset}`);
      console.log(`     Durum: ${statusColor}${container.status}${c.reset}`);

      if (container.ports) {
        console.log(`     Portlar: ${c.dim}${container.ports}${c.reset}`);
      }
    }
  }

  console.log('');
}

/**
 * Docker bilgisini JSON olarak al
 */
export function getDockerInfo() {
  return {
    installed: isDockerInstalled(),
    running: isDockerAvailable(),
    composeInstalled: isDockerComposeInstalled(),
    composeCommand: isDockerComposeInstalled() ? getDockerComposeCommand() : null,
    containers: listContainers(true).containers,
  };
}

// CLI olarak çalıştırıldığında
const isMain = process.argv[1]?.endsWith('docker-manager.js');
if (isMain) {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'status':
      printDockerStatus();
      break;

    case 'up':
      console.log(`${icons.docker} Docker Compose başlatılıyor...`);
      const upResult = await composeUp(true, args.slice(1));
      if (upResult.success) {
        console.log(`${icons.success} Başarılı!`);
      } else {
        console.log(`${icons.error} Hata: ${upResult.error}`);
      }
      break;

    case 'down':
      console.log(`${icons.docker} Docker Compose durduruluyor...`);
      const downResult = await composeDown(args.includes('-v'));
      if (downResult.success) {
        console.log(`${icons.success} Başarılı!`);
      } else {
        console.log(`${icons.error} Hata: ${downResult.error}`);
      }
      break;

    case 'restart':
      console.log(`${icons.docker} Docker Compose yeniden başlatılıyor...`);
      const restartResult = await composeRestart(args.slice(1));
      if (restartResult.success) {
        console.log(`${icons.success} Başarılı!`);
      } else {
        console.log(`${icons.error} Hata: ${restartResult.error}`);
      }
      break;

    case 'logs':
      const containerName = args[1];
      if (!containerName) {
        console.log(`${icons.error} Container adı belirtilmedi`);
        console.log(`Kullanım: node docker-manager.js logs <container-name>`);
        process.exit(1);
      }
      const { logs, error } = getContainerLogs(containerName, parseInt(args[2]) || 100);
      if (error) {
        console.log(`${icons.error} ${error}`);
      } else {
        console.log(logs);
      }
      break;

    case 'info':
      console.log(JSON.stringify(getDockerInfo(), null, 2));
      break;

    default:
      printDockerStatus();
      break;
  }
}

export default {
  isDockerInstalled,
  isDockerRunning,
  isDockerComposeInstalled,
  isDockerAvailable,
  getDockerComposeCommand,
  listContainers,
  getContainerStatus,
  getContainerLogs,
  followContainerLogs,
  composeUp,
  composeDown,
  composeRestart,
  startContainer,
  stopContainer,
  restartContainer,
  printDockerStatus,
  getDockerInfo,
};
