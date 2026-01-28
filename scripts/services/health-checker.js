#!/usr/bin/env node
/**
 * Catering Pro - Health Checker
 * Servis sağlık kontrolü utilities
 */

import { execSync } from 'node:child_process';
import net from 'node:net';
import { colors, defaults, icons, ports, services } from './config.js';

const c = colors;

/**
 * Port'un kullanımda olup olmadığını kontrol et
 */
export async function checkPort(port, timeout = 1000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();

    socket.setTimeout(timeout);

    socket.on('connect', () => {
      socket.destroy();
      resolve({ open: true, port });
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve({ open: false, port, reason: 'timeout' });
    });

    socket.on('error', (err) => {
      socket.destroy();
      resolve({ open: false, port, reason: err.code });
    });

    socket.connect(port, 'localhost');
  });
}

/**
 * HTTP endpoint health check
 */
export async function checkHttpHealth(url, timeout = 5000) {
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    });

    clearTimeout(timeoutId);

    const responseTime = Date.now() - startTime;
    let data = null;
    const text = await response.text();
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    return {
      healthy: response.ok,
      status: response.status,
      statusText: response.statusText,
      responseTime,
      data,
      url,
    };
  } catch (error) {
    return {
      healthy: false,
      error: error.name === 'AbortError' ? 'Timeout' : error.message,
      responseTime: Date.now() - startTime,
      url,
    };
  }
}

/**
 * TCP port health check
 */
export async function checkTcpHealth(port, host = 'localhost', timeout = 5000) {
  const startTime = Date.now();

  return new Promise((resolve) => {
    const socket = new net.Socket();

    socket.setTimeout(timeout);

    socket.on('connect', () => {
      socket.destroy();
      resolve({
        healthy: true,
        port,
        host,
        responseTime: Date.now() - startTime,
      });
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve({
        healthy: false,
        port,
        host,
        error: 'Timeout',
        responseTime: Date.now() - startTime,
      });
    });

    socket.on('error', (err) => {
      socket.destroy();
      resolve({
        healthy: false,
        port,
        host,
        error: err.message,
        responseTime: Date.now() - startTime,
      });
    });

    socket.connect(port, host);
  });
}

/**
 * Port'u kullanan process'i bul
 */
export function getProcessOnPort(port) {
  try {
    const output = execSync(`lsof -ti:${port} 2>/dev/null`, { encoding: 'utf-8' });
    const pid = output.trim();

    if (pid) {
      try {
        const processInfo = execSync(`ps -p ${pid} -o comm= 2>/dev/null`, { encoding: 'utf-8' });
        return {
          pid: parseInt(pid, 10),
          command: processInfo.trim(),
        };
      } catch {
        return { pid: parseInt(pid, 10), command: 'unknown' };
      }
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * Belirli bir servisi kontrol et
 */
export async function checkService(serviceName, _options = {}) {
  const service = services[serviceName];
  if (!service) {
    return {
      name: serviceName,
      healthy: false,
      error: 'Servis tanımı bulunamadı',
    };
  }

  const result = {
    name: serviceName,
    displayName: service.name,
    type: service.type,
    port: service.port,
    required: service.required,
    healthy: false,
    checks: {},
  };

  // Port kontrolü
  const portCheck = await checkPort(service.port);
  result.checks.port = portCheck;
  result.portOpen = portCheck.open;

  if (portCheck.open) {
    result.process = getProcessOnPort(service.port);
  }

  // Health check
  if (service.healthCheck) {
    const { type, url, timeout = defaults.healthCheckTimeout } = service.healthCheck;

    if (type === 'http' && url) {
      const httpCheck = await checkHttpHealth(url, timeout);
      result.checks.http = httpCheck;
      result.healthy = httpCheck.healthy;
      result.responseTime = httpCheck.responseTime;

      if (httpCheck.data && typeof httpCheck.data === 'object') {
        result.healthData = httpCheck.data;
      }
    } else if (type === 'tcp') {
      const tcpCheck = await checkTcpHealth(service.port, 'localhost', timeout);
      result.checks.tcp = tcpCheck;
      result.healthy = tcpCheck.healthy;
      result.responseTime = tcpCheck.responseTime;
    }
  } else {
    // Health check tanımlı değilse port açık = healthy
    result.healthy = portCheck.open;
  }

  return result;
}

/**
 * Tüm servisleri kontrol et
 */
export async function checkAllServices() {
  const results = {
    timestamp: new Date().toISOString(),
    services: {},
    summary: {
      total: 0,
      healthy: 0,
      unhealthy: 0,
      optional: 0,
    },
  };

  for (const [name, service] of Object.entries(services)) {
    const check = await checkService(name);
    results.services[name] = check;

    results.summary.total++;

    if (check.healthy) {
      results.summary.healthy++;
    } else if (!service.required) {
      results.summary.optional++;
    } else {
      results.summary.unhealthy++;
    }
  }

  results.allHealthy = results.summary.unhealthy === 0;

  return results;
}

/**
 * Belirli portların durumunu kontrol et
 */
export async function checkPorts(portList = Object.values(ports)) {
  const results = [];

  for (const port of portList) {
    const check = await checkPort(port);
    const process = check.open ? getProcessOnPort(port) : null;

    results.push({
      port,
      open: check.open,
      process,
    });
  }

  return results;
}

/**
 * Memory kullanımını al
 */
export function getMemoryUsage() {
  const used = process.memoryUsage();
  return {
    heapUsed: Math.round(used.heapUsed / 1024 / 1024),
    heapTotal: Math.round(used.heapTotal / 1024 / 1024),
    rss: Math.round(used.rss / 1024 / 1024),
    external: Math.round(used.external / 1024 / 1024),
  };
}

/**
 * Sistem bilgilerini al
 */
export function getSystemInfo() {
  return {
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.version,
    uptime: Math.round(process.uptime()),
    memory: getMemoryUsage(),
    pid: process.pid,
  };
}

/**
 * Health check sonuçlarını yazdır
 */
export function printHealthReport(results) {
  console.log(`\n${c.cyan}${c.bold}═══════════════════════════════════════════════════════════════${c.reset}`);
  console.log(`${c.cyan}${c.bold}              ${icons.info} SERVİS SAĞLIK RAPORU${c.reset}`);
  console.log(`${c.cyan}${c.bold}═══════════════════════════════════════════════════════════════${c.reset}\n`);

  console.log(`${c.dim}Tarih: ${results.timestamp}${c.reset}\n`);

  // Servis durumları
  for (const [, check] of Object.entries(results.services)) {
    const statusIcon = check.healthy ? icons.running : icons.stopped;
    const statusColor = check.healthy ? c.green : (check.required ? c.red : c.yellow);
    const typeIcon = check.type === 'docker' ? icons.docker : icons.node;
    const optionalTag = check.required ? '' : `${c.dim}(opsiyonel)${c.reset}`;

    console.log(`${statusIcon} ${typeIcon} ${statusColor}${c.bold}${check.displayName}${c.reset} ${optionalTag}`);
    console.log(`   Port: ${check.portOpen ? c.green : c.red}${check.port}${c.reset}`);

    if (check.responseTime) {
      const rtColor = check.responseTime < 100 ? c.green : (check.responseTime < 500 ? c.yellow : c.red);
      console.log(`   Yanıt: ${rtColor}${check.responseTime}ms${c.reset}`);
    }

    if (check.process) {
      console.log(`   PID: ${c.dim}${check.process.pid} (${check.process.command})${c.reset}`);
    }

    if (check.healthData) {
      if (check.healthData.status) {
        console.log(`   Status: ${c.dim}${check.healthData.status}${c.reset}`);
      }
      if (check.healthData.database) {
        const dbIcon = check.healthData.database === 'connected' ? icons.success : icons.error;
        console.log(`   DB: ${dbIcon} ${check.healthData.database}`);
      }
    }

    if (!check.healthy && check.checks.http?.error) {
      console.log(`   ${c.red}Hata: ${check.checks.http.error}${c.reset}`);
    }

    console.log('');
  }

  // Özet
  console.log(`${c.cyan}───────────────────────────────────────────────────────────────${c.reset}`);
  console.log(`${c.bold}Özet:${c.reset}`);
  console.log(`  Toplam: ${results.summary.total}`);
  console.log(`  ${icons.success} Sağlıklı: ${c.green}${results.summary.healthy}${c.reset}`);
  console.log(`  ${icons.error} Sorunlu: ${c.red}${results.summary.unhealthy}${c.reset}`);
  console.log(`  ${icons.warning} Opsiyonel (kapalı): ${c.yellow}${results.summary.optional}${c.reset}`);

  if (results.allHealthy) {
    console.log(`\n${icons.success} ${c.green}${c.bold}Tüm zorunlu servisler çalışıyor!${c.reset}`);
  } else {
    console.log(`\n${icons.error} ${c.red}${c.bold}Bazı servisler çalışmıyor!${c.reset}`);
  }

  console.log('');
}

/**
 * Port durumlarını yazdır
 */
export function printPortStatus(portResults) {
  console.log(`\n${c.cyan}${c.bold}Port Durumları:${c.reset}\n`);

  for (const { port, open, process } of portResults) {
    const icon = open ? icons.running : icons.stopped;
    const color = open ? c.green : c.dim;

    let info = `${icon} Port ${port}: ${color}${open ? 'AÇIK' : 'KAPALI'}${c.reset}`;

    if (process) {
      info += ` ${c.dim}(PID: ${process.pid}, ${process.command})${c.reset}`;
    }

    console.log(info);
  }

  console.log('');
}

/**
 * Retry mekanizması ile health check
 */
export async function checkServiceWithRetry(serviceName, options = {}) {
  const {
    retries = defaults.healthCheckRetries,
    retryDelay = defaults.healthCheckRetryDelay,
  } = options;

  let lastResult = null;

  for (let i = 0; i < retries; i++) {
    lastResult = await checkService(serviceName);

    if (lastResult.healthy) {
      return lastResult;
    }

    if (i < retries - 1) {
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }

  return lastResult;
}

// CLI olarak çalıştırıldığında
const isMain = process.argv[1]?.endsWith('health-checker.js');
if (isMain) {
  const args = process.argv.slice(2);

  if (args.includes('--ports')) {
    const portResults = await checkPorts();
    printPortStatus(portResults);
  } else if (args.includes('--service')) {
    const serviceName = args[args.indexOf('--service') + 1];
    if (serviceName) {
      const result = await checkService(serviceName);
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.error('Servis adı belirtilmedi');
      process.exit(1);
    }
  } else {
    const results = await checkAllServices();
    printHealthReport(results);
    process.exit(results.allHealthy ? 0 : 1);
  }
}

export default {
  checkPort,
  checkHttpHealth,
  checkTcpHealth,
  getProcessOnPort,
  checkService,
  checkAllServices,
  checkPorts,
  checkServiceWithRetry,
  getMemoryUsage,
  getSystemInfo,
  printHealthReport,
  printPortStatus,
};
