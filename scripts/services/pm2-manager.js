#!/usr/bin/env node
/**
 * Catering Pro - PM2 Manager
 * PM2 process yönetimi
 */

import { execSync, spawn } from 'child_process';
import { paths, colors, icons } from './config.js';

const c = colors;

/**
 * PM2'nin kurulu olup olmadığını kontrol et
 */
export function isPm2Installed() {
  try {
    execSync('pm2 --version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * PM2 versiyonunu al
 */
export function getPm2Version() {
  try {
    const version = execSync('pm2 --version', { encoding: 'utf-8' }).trim();
    return version;
  } catch {
    return null;
  }
}

/**
 * PM2 process listesini al
 */
export function listProcesses() {
  if (!isPm2Installed()) {
    return { processes: [], error: 'PM2 kurulu değil' };
  }

  try {
    const output = execSync('pm2 jlist', { encoding: 'utf-8' });
    const processes = JSON.parse(output);

    return {
      processes: processes.map(p => ({
        name: p.name,
        pid: p.pid,
        status: p.pm2_env?.status,
        cpu: p.monit?.cpu,
        memory: p.monit?.memory,
        uptime: p.pm2_env?.pm_uptime,
        restarts: p.pm2_env?.restart_time,
        mode: p.pm2_env?.exec_mode,
      })),
      error: null,
    };
  } catch (error) {
    return { processes: [], error: error.message };
  }
}

/**
 * Belirli bir process'in durumunu al
 */
export function getProcessStatus(name) {
  if (!isPm2Installed()) {
    return { exists: false, error: 'PM2 kurulu değil' };
  }

  try {
    const output = execSync(`pm2 jlist`, { encoding: 'utf-8' });
    const processes = JSON.parse(output);
    const process = processes.find(p => p.name === name);

    if (!process) {
      return { exists: false, running: false };
    }

    return {
      exists: true,
      name: process.name,
      pid: process.pid,
      status: process.pm2_env?.status,
      running: process.pm2_env?.status === 'online',
      cpu: process.monit?.cpu,
      memory: process.monit?.memory,
      uptime: process.pm2_env?.pm_uptime,
      restarts: process.pm2_env?.restart_time,
    };
  } catch (error) {
    return { exists: false, error: error.message };
  }
}

/**
 * Ecosystem config ile başlat
 */
export async function startEcosystem() {
  if (!isPm2Installed()) {
    return { success: false, error: 'PM2 kurulu değil' };
  }

  try {
    execSync('pm2 start ecosystem.config.js', { cwd: paths.root, stdio: 'inherit' });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Tüm processleri durdur
 */
export async function stopAll() {
  if (!isPm2Installed()) {
    return { success: false, error: 'PM2 kurulu değil' };
  }

  try {
    execSync('pm2 stop all', { stdio: 'pipe' });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Belirli process'i durdur
 */
export function stopProcess(name) {
  if (!isPm2Installed()) {
    return { success: false, error: 'PM2 kurulu değil' };
  }

  try {
    execSync(`pm2 stop ${name}`, { stdio: 'pipe' });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Belirli process'i başlat
 */
export function startProcess(name) {
  if (!isPm2Installed()) {
    return { success: false, error: 'PM2 kurulu değil' };
  }

  try {
    execSync(`pm2 start ${name}`, { stdio: 'pipe' });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Belirli process'i yeniden başlat
 */
export function restartProcess(name) {
  if (!isPm2Installed()) {
    return { success: false, error: 'PM2 kurulu değil' };
  }

  try {
    execSync(`pm2 restart ${name}`, { stdio: 'pipe' });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Tüm processleri yeniden başlat
 */
export async function restartAll() {
  if (!isPm2Installed()) {
    return { success: false, error: 'PM2 kurulu değil' };
  }

  try {
    execSync('pm2 restart all', { stdio: 'pipe' });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Tüm processleri sil
 */
export async function deleteAll() {
  if (!isPm2Installed()) {
    return { success: false, error: 'PM2 kurulu değil' };
  }

  try {
    execSync('pm2 delete all', { stdio: 'pipe' });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Process loglarını al
 */
export function getProcessLogs(name, lines = 50) {
  if (!isPm2Installed()) {
    return { logs: null, error: 'PM2 kurulu değil' };
  }

  try {
    const output = execSync(`pm2 logs ${name} --nostream --lines ${lines}`, { encoding: 'utf-8' });
    return { logs: output, error: null };
  } catch (error) {
    return { logs: null, error: error.message };
  }
}

/**
 * Canlı log takibi
 */
export function followLogs(name, callback) {
  if (!isPm2Installed()) {
    callback(null, 'PM2 kurulu değil');
    return null;
  }

  const args = name ? ['logs', name] : ['logs'];
  const child = spawn('pm2', args, {
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
 * PM2 monit
 */
export function monit() {
  if (!isPm2Installed()) {
    console.log(`${icons.error} PM2 kurulu değil`);
    return;
  }

  spawn('pm2', ['monit'], {
    stdio: 'inherit',
  });
}

/**
 * PM2 flush (logları temizle)
 */
export function flushLogs() {
  if (!isPm2Installed()) {
    return { success: false, error: 'PM2 kurulu değil' };
  }

  try {
    execSync('pm2 flush', { stdio: 'pipe' });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * PM2 save (process listesini kaydet)
 */
export function save() {
  if (!isPm2Installed()) {
    return { success: false, error: 'PM2 kurulu değil' };
  }

  try {
    execSync('pm2 save', { stdio: 'pipe' });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Memory formatla
 */
function formatMemory(bytes) {
  if (!bytes) return 'N/A';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

/**
 * Uptime formatla
 */
function formatUptime(timestamp) {
  if (!timestamp) return 'N/A';
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

/**
 * PM2 durumunu yazdır
 */
export function printPm2Status() {
  console.log(`\n${c.cyan}${c.bold}═══════════════════════════════════════════════════════════════${c.reset}`);
  console.log(`${c.cyan}${c.bold}                    ${icons.node} PM2 DURUMU${c.reset}`);
  console.log(`${c.cyan}${c.bold}═══════════════════════════════════════════════════════════════${c.reset}\n`);

  const installed = isPm2Installed();
  const version = installed ? getPm2Version() : null;

  console.log(`${c.bold}PM2:${c.reset}`);
  console.log(`  ${installed ? icons.success : icons.error} Kurulu: ${installed ? c.green + 'Evet' : c.red + 'Hayır'}${c.reset}`);

  if (version) {
    console.log(`  ${icons.info} Versiyon: ${c.dim}${version}${c.reset}`);
  }

  if (!installed) {
    console.log(`\n${c.yellow}${icons.warning} PM2 kurulu değil.${c.reset}`);
    console.log(`${c.dim}Kurmak için: npm install -g pm2${c.reset}`);
    return;
  }

  // Process listesi
  const { processes, error } = listProcesses();

  if (error) {
    console.log(`\n${c.red}${icons.error} Process listesi alınamadı: ${error}${c.reset}`);
    return;
  }

  console.log(`\n${c.bold}Process Listesi:${c.reset}`);

  if (processes.length === 0) {
    console.log(`  ${c.dim}Çalışan process yok${c.reset}`);
    console.log(`  ${c.dim}Başlatmak için: pm2 start ecosystem.config.js${c.reset}`);
  } else {
    console.log(`\n  ${c.dim}┌─────────────────┬──────────┬────────┬───────────┬─────────┬──────────┐${c.reset}`);
    console.log(`  ${c.dim}│${c.reset} ${c.bold}İsim${c.reset}            ${c.dim}│${c.reset} ${c.bold}Durum${c.reset}    ${c.dim}│${c.reset} ${c.bold}CPU${c.reset}    ${c.dim}│${c.reset} ${c.bold}Memory${c.reset}    ${c.dim}│${c.reset} ${c.bold}Uptime${c.reset}  ${c.dim}│${c.reset} ${c.bold}Restarts${c.reset} ${c.dim}│${c.reset}`);
    console.log(`  ${c.dim}├─────────────────┼──────────┼────────┼───────────┼─────────┼──────────┤${c.reset}`);

    for (const p of processes) {
      const statusIcon = p.status === 'online' ? icons.running : icons.stopped;
      const statusColor = p.status === 'online' ? c.green : c.red;

      const name = p.name.padEnd(15);
      const status = p.status.padEnd(8);
      const cpu = `${p.cpu || 0}%`.padEnd(6);
      const memory = formatMemory(p.memory).padEnd(9);
      const uptime = formatUptime(p.uptime).padEnd(7);
      const restarts = String(p.restarts || 0).padEnd(8);

      console.log(`  ${c.dim}│${c.reset} ${statusIcon} ${name} ${c.dim}│${c.reset} ${statusColor}${status}${c.reset} ${c.dim}│${c.reset} ${cpu} ${c.dim}│${c.reset} ${memory} ${c.dim}│${c.reset} ${uptime} ${c.dim}│${c.reset} ${restarts} ${c.dim}│${c.reset}`);
    }

    console.log(`  ${c.dim}└─────────────────┴──────────┴────────┴───────────┴─────────┴──────────┘${c.reset}`);
  }

  console.log('');
}

/**
 * PM2 bilgisini JSON olarak al
 */
export function getPm2Info() {
  return {
    installed: isPm2Installed(),
    version: getPm2Version(),
    processes: listProcesses().processes,
  };
}

// CLI olarak çalıştırıldığında
const isMain = process.argv[1]?.endsWith('pm2-manager.js');
if (isMain) {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'status':
      printPm2Status();
      break;

    case 'start':
      if (args[1]) {
        console.log(`${icons.node} ${args[1]} başlatılıyor...`);
        const result = startProcess(args[1]);
        console.log(result.success ? `${icons.success} Başarılı!` : `${icons.error} ${result.error}`);
      } else {
        console.log(`${icons.node} Ecosystem başlatılıyor...`);
        const result = await startEcosystem();
        console.log(result.success ? `${icons.success} Başarılı!` : `${icons.error} ${result.error}`);
      }
      break;

    case 'stop':
      if (args[1]) {
        console.log(`${icons.node} ${args[1]} durduruluyor...`);
        const result = stopProcess(args[1]);
        console.log(result.success ? `${icons.success} Başarılı!` : `${icons.error} ${result.error}`);
      } else {
        console.log(`${icons.node} Tüm processler durduruluyor...`);
        const result = await stopAll();
        console.log(result.success ? `${icons.success} Başarılı!` : `${icons.error} ${result.error}`);
      }
      break;

    case 'restart':
      if (args[1]) {
        console.log(`${icons.node} ${args[1]} yeniden başlatılıyor...`);
        const result = restartProcess(args[1]);
        console.log(result.success ? `${icons.success} Başarılı!` : `${icons.error} ${result.error}`);
      } else {
        console.log(`${icons.node} Tüm processler yeniden başlatılıyor...`);
        const result = await restartAll();
        console.log(result.success ? `${icons.success} Başarılı!` : `${icons.error} ${result.error}`);
      }
      break;

    case 'logs':
      const processName = args[1];
      if (processName) {
        const { logs, error } = getProcessLogs(processName, parseInt(args[2]) || 100);
        if (error) {
          console.log(`${icons.error} ${error}`);
        } else {
          console.log(logs);
        }
      } else {
        followLogs(null, (data, error) => {
          if (error) console.error(error);
          else process.stdout.write(data);
        });
      }
      break;

    case 'monit':
      monit();
      break;

    case 'info':
      console.log(JSON.stringify(getPm2Info(), null, 2));
      break;

    default:
      printPm2Status();
      break;
  }
}

export default {
  isPm2Installed,
  getPm2Version,
  listProcesses,
  getProcessStatus,
  startEcosystem,
  stopAll,
  stopProcess,
  startProcess,
  restartProcess,
  restartAll,
  deleteAll,
  getProcessLogs,
  followLogs,
  monit,
  flushLogs,
  save,
  printPm2Status,
  getPm2Info,
};
