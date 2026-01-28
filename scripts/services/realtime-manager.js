#!/usr/bin/env node
/**
 * Catering Pro - Realtime Manager
 * Supabase realtime ve scheduler yönetimi
 */

import { ports, realtimeTables, schedulers, colors, icons } from './config.js';

const c = colors;

/**
 * Backend API'ye istek at
 */
async function fetchBackendApi(endpoint, options = {}) {
  try {
    const response = await fetch(`http://localhost:${ports.backend}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}`, data: null };
    }

    const data = await response.json();
    return { success: true, data, error: null };
  } catch (error) {
    return { success: false, error: error.message, data: null };
  }
}

/**
 * Backend'in çalışıp çalışmadığını kontrol et
 */
export async function isBackendRunning() {
  try {
    const response = await fetch(`http://localhost:${ports.backend}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Supabase realtime bağlantı durumunu kontrol et
 * (Backend health/detailed endpoint'inden - bu endpoint realtime check'i tetikler)
 */
export async function checkRealtimeStatus() {
  const result = {
    connected: false,
    enabled: false,
    tables: [],
    error: null,
  };

  // Backend health endpoint'inden kontrol et
  const backendRunning = await isBackendRunning();

  if (!backendRunning) {
    result.error = 'Backend çalışmıyor';
    return result;
  }

  // Detailed health endpoint'i kullan - bu realtime bağlantı testi yapar
  const { success, data, error } = await fetchBackendApi('/api/system/health/detailed');

  if (!success) {
    // Endpoint yoksa basit status endpoint'ini dene
    const simpleResult = await fetchBackendApi('/api/system/realtime/status');
    if (simpleResult.success) {
      return {
        connected: simpleResult.data?.connected ?? false,
        enabled: simpleResult.data?.enabled ?? true,
        tables: realtimeTables,
        lastCheck: new Date().toISOString(),
        error: null,
      };
    }

    result.enabled = true;
    result.tables = realtimeTables;
    result.error = error;
    return result;
  }

  // Detailed health'den realtime bilgisini al
  const realtimeInfo = data?.realtime || {};

  return {
    connected: realtimeInfo.connectionCheck?.connected ?? realtimeInfo.connected ?? false,
    enabled: realtimeInfo.enabled ?? true,
    tables: data?.tables ?? realtimeTables,
    lastCheck: data?.timestamp ?? new Date().toISOString(),
    status: realtimeInfo.connectionCheck?.status,
    error: null,
  };
}

/**
 * Realtime için konfigüre edilmiş tabloları listele
 */
export async function getRealtimeTables() {
  // Önce backend'den almaya çalış
  const { success, data } = await fetchBackendApi('/api/system/realtime/tables');

  if (success && data?.tables) {
    return data.tables;
  }

  // Backend'den alınamazsa config'den al
  return realtimeTables;
}

/**
 * Scheduler durumlarını al
 */
export async function getSchedulerStatus() {
  const result = {
    schedulers: {},
    error: null,
  };

  const backendRunning = await isBackendRunning();

  if (!backendRunning) {
    result.error = 'Backend çalışmıyor';
    return result;
  }

  // System endpoint'inden scheduler durumunu al
  const { success, data, error } = await fetchBackendApi('/api/system/schedulers');

  if (!success) {
    result.error = error;

    // Varsayılan scheduler bilgisi
    for (const [key, scheduler] of Object.entries(schedulers)) {
      result.schedulers[key] = {
        name: scheduler.name,
        description: scheduler.description,
        status: 'unknown',
        lastRun: null,
        nextRun: null,
      };
    }

    return result;
  }

  result.schedulers = data?.schedulers ?? {};
  return result;
}

/**
 * Manuel sync tetikle
 */
export async function triggerSync(schedulerName = 'sync') {
  const backendRunning = await isBackendRunning();

  if (!backendRunning) {
    return { success: false, error: 'Backend çalışmıyor' };
  }

  const endpoint = schedulerName === 'sync'
    ? '/api/system/schedulers/sync/trigger'
    : `/api/system/schedulers/${schedulerName}/trigger`;

  const { success, data, error } = await fetchBackendApi(endpoint, {
    method: 'POST',
  });

  if (!success) {
    return { success: false, error };
  }

  return { success: true, data };
}

/**
 * Document queue durumunu al
 */
export async function getQueueStatus() {
  const backendRunning = await isBackendRunning();

  if (!backendRunning) {
    return { error: 'Backend çalışmıyor', queue: null };
  }

  const { success, data, error } = await fetchBackendApi('/api/system/schedulers/document-queue');

  if (!success) {
    return { error, queue: null };
  }

  return { error: null, queue: data };
}

/**
 * Formatlanmış tarih
 */
function formatDate(dateStr) {
  if (!dateStr) return 'Hiç';

  try {
    const date = new Date(dateStr);
    return date.toLocaleString('tr-TR');
  } catch {
    return dateStr;
  }
}

/**
 * Realtime durumunu yazdır
 */
export async function printRealtimeStatus() {
  console.log(`\n${c.cyan}${c.bold}═══════════════════════════════════════════════════════════════${c.reset}`);
  console.log(`${c.cyan}${c.bold}            ${icons.realtime} REALTIME & SYNC DURUMU${c.reset}`);
  console.log(`${c.cyan}${c.bold}═══════════════════════════════════════════════════════════════${c.reset}\n`);

  // Backend durumu
  const backendRunning = await isBackendRunning();
  console.log(`${c.bold}Backend API:${c.reset}`);
  console.log(`  ${backendRunning ? icons.running : icons.stopped} Durum: ${backendRunning ? c.green + 'Çalışıyor' : c.red + 'Kapalı'}${c.reset}`);

  if (!backendRunning) {
    console.log(`\n${c.yellow}${icons.warning} Backend çalışmıyor. Scheduler ve realtime bilgileri alınamıyor.${c.reset}`);
    return;
  }

  // Realtime durumu
  console.log(`\n${c.bold}Supabase Realtime:${c.reset}`);
  const realtime = await checkRealtimeStatus();

  if (realtime.error) {
    console.log(`  ${icons.warning} ${c.yellow}Durum alınamadı: ${realtime.error}${c.reset}`);
  } else {
    console.log(`  ${realtime.enabled ? icons.success : icons.warning} Etkin: ${realtime.enabled ? c.green + 'Evet' : c.yellow + 'Hayır'}${c.reset}`);
    console.log(`  ${realtime.connected ? icons.running : icons.stopped} Bağlı: ${realtime.connected ? c.green + 'Evet' : c.yellow + 'Hayır'}${c.reset}`);
  }

  // Realtime tabloları
  console.log(`\n${c.bold}Realtime Tabloları (${realtime.tables?.length || 0}):${c.reset}`);
  const tables = realtime.tables || realtimeTables;

  const columns = 3;
  const tableRows = [];
  for (let i = 0; i < tables.length; i += columns) {
    const row = tables.slice(i, i + columns)
      .map(t => `  ${icons.database} ${t}`.padEnd(25))
      .join('');
    tableRows.push(row);
  }
  console.log(tableRows.join('\n'));

  // Scheduler durumları
  console.log(`\n${c.bold}Scheduler'lar:${c.reset}`);
  const schedulerStatus = await getSchedulerStatus();

  if (schedulerStatus.error) {
    console.log(`  ${icons.warning} ${c.yellow}Durum alınamadı: ${schedulerStatus.error}${c.reset}`);

    // Varsayılan scheduler listesi
    for (const [key, scheduler] of Object.entries(schedulers)) {
      console.log(`\n  ${icons.scheduler} ${c.bold}${scheduler.name}${c.reset}`);
      console.log(`     ${c.dim}${scheduler.description}${c.reset}`);
      console.log(`     Durum: ${c.yellow}Bilinmiyor${c.reset}`);
    }
  } else {
    for (const [key, status] of Object.entries(schedulerStatus.schedulers)) {
      const statusIcon = status.isRunning ? icons.running : icons.stopped;
      const statusColor = status.isRunning ? c.green : c.dim;

      console.log(`\n  ${icons.scheduler} ${c.bold}${status.name || key}${c.reset}`);

      if (status.description) {
        console.log(`     ${c.dim}${status.description}${c.reset}`);
      }

      console.log(`     ${statusIcon} Durum: ${statusColor}${status.isRunning ? 'Çalışıyor' : 'Hazır'}${c.reset}`);

      if (status.lastRun) {
        console.log(`     Son Çalışma: ${c.dim}${formatDate(status.lastRun)}${c.reset}`);
      }

      if (status.nextRun) {
        console.log(`     Sonraki: ${c.dim}${formatDate(status.nextRun)}${c.reset}`);
      }

      if (status.stats) {
        console.log(`     İstatistik: ${c.dim}${status.stats.successfulRuns || 0} başarılı, ${status.stats.failedRuns || 0} hatalı${c.reset}`);
      }
    }
  }

  // Queue durumu
  console.log(`\n${c.bold}Document Queue:${c.reset}`);
  const queueStatus = await getQueueStatus();

  if (queueStatus.error) {
    console.log(`  ${icons.warning} ${c.yellow}Durum alınamadı: ${queueStatus.error}${c.reset}`);
  } else if (queueStatus.queue) {
    const q = queueStatus.queue;
    console.log(`  ${icons.queue} Kuyrukta: ${q.totalInQueue || 0}`);
    console.log(`  ${q.isProcessing ? icons.running : icons.stopped} İşleniyor: ${q.isProcessing ? c.green + 'Evet' : c.dim + 'Hayır'}${c.reset}`);

    if (q.currentItem) {
      console.log(`  Mevcut: ${c.dim}${q.currentItem}${c.reset}`);
    }
  }

  console.log('');
}

/**
 * Realtime bilgisini JSON olarak al
 */
export async function getRealtimeInfo() {
  const [realtimeStatus, schedulerStatus, queueStatus] = await Promise.all([
    checkRealtimeStatus(),
    getSchedulerStatus(),
    getQueueStatus(),
  ]);

  return {
    backendRunning: await isBackendRunning(),
    realtime: realtimeStatus,
    schedulers: schedulerStatus,
    queue: queueStatus,
    tables: realtimeTables,
  };
}

// CLI olarak çalıştırıldığında
const isMain = process.argv[1]?.endsWith('realtime-manager.js');
if (isMain) {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'status':
      await printRealtimeStatus();
      break;

    case 'tables':
      const tables = await getRealtimeTables();
      console.log(`\n${c.cyan}${c.bold}Realtime Tabloları:${c.reset}\n`);
      tables.forEach(t => console.log(`  ${icons.database} ${t}`));
      console.log('');
      break;

    case 'schedulers':
      const schedulerStatus = await getSchedulerStatus();
      console.log(JSON.stringify(schedulerStatus, null, 2));
      break;

    case 'trigger':
      const schedulerName = args[1] || 'sync';
      console.log(`${icons.scheduler} ${schedulerName} tetikleniyor...`);
      const result = await triggerSync(schedulerName);
      if (result.success) {
        console.log(`${icons.success} Başarılı!`);
      } else {
        console.log(`${icons.error} Hata: ${result.error}`);
      }
      break;

    case 'queue':
      const queueStatus = await getQueueStatus();
      console.log(JSON.stringify(queueStatus, null, 2));
      break;

    case 'info':
      const info = await getRealtimeInfo();
      console.log(JSON.stringify(info, null, 2));
      break;

    default:
      await printRealtimeStatus();
      break;
  }
}

export default {
  isBackendRunning,
  checkRealtimeStatus,
  getRealtimeTables,
  getSchedulerStatus,
  triggerSync,
  getQueueStatus,
  printRealtimeStatus,
  getRealtimeInfo,
};
