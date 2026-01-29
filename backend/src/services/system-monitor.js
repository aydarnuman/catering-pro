/**
 * Catering Pro - System Monitor Service
 * Sistem izleme ve scheduler durum takibi
 */

import os from 'node:os';
import { createClient } from '@supabase/supabase-js';

/**
 * System Monitor Class
 */
class SystemMonitor {
  constructor() {
    this.schedulerStats = new Map();
    this.lastHealthCheck = null;
    this.startTime = Date.now();

    // Supabase client (realtime kontrolü için)
    this.supabase = null;
    this.realtimeChannel = null;
    this.realtimeConnected = false;

    this.initSupabase();
  }

  /**
   * Supabase client'ı başlat
   */
  initSupabase() {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    // Realtime için anon key kullanılmalı (service role key realtime'da çalışmayabilir)
    const key =
      process.env.SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (url && key) {
      try {
        this.supabase = createClient(url, key, {
          realtime: {
            params: {
              eventsPerSecond: 10,
            },
          },
        });
        // Async başlat, hata olursa logla
        this.checkRealtimeConnection().catch((_err) => {});
      } catch (_error) {}
    } else {
    }
  }

  /**
   * Realtime bağlantı kontrolü
   */
  async checkRealtimeConnection() {
    if (!this.supabase) {
      return { connected: false, error: 'Supabase client yok' };
    }

    try {
      // Unique channel name to avoid conflicts
      const channelName = `system-monitor-test-${Date.now()}`;
      const testChannel = this.supabase.channel(channelName);

      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          try {
            this.supabase.removeChannel(testChannel);
          } catch {}
          this.realtimeConnected = false;
          resolve({ connected: false, error: "Timeout - Supabase Realtime'a bağlanılamadı" });
        }, 8000); // 8 saniye timeout

        testChannel
          .on('system', { event: '*' }, () => {})
          .subscribe((status, err) => {
            clearTimeout(timeout);

            // Cleanup
            setTimeout(() => {
              try {
                this.supabase.removeChannel(testChannel);
              } catch {}
            }, 100);

            if (err) {
              this.realtimeConnected = false;
              resolve({ connected: false, error: err.message, status });
            } else {
              this.realtimeConnected = status === 'SUBSCRIBED';
              resolve({
                connected: this.realtimeConnected,
                status,
              });
            }
          });
      });
    } catch (error) {
      this.realtimeConnected = false;
      return { connected: false, error: error.message };
    }
  }

  /**
   * Scheduler durumunu kaydet
   */
  registerScheduler(name, config = {}) {
    this.schedulerStats.set(name, {
      name,
      description: config.description || '',
      isRunning: false,
      lastRun: null,
      lastSuccess: null,
      lastError: null,
      nextRun: config.nextRun || null,
      stats: {
        successfulRuns: 0,
        failedRuns: 0,
        totalRuntime: 0,
        averageRuntime: 0,
      },
      config,
    });
  }

  /**
   * Scheduler başladığında çağır
   */
  schedulerStarted(name) {
    const scheduler = this.schedulerStats.get(name);
    if (scheduler) {
      scheduler.isRunning = true;
      scheduler.lastRun = new Date().toISOString();
      scheduler._startTime = Date.now();
    }
  }

  /**
   * Scheduler tamamlandığında çağır
   */
  schedulerCompleted(name, success = true, error = null) {
    const scheduler = this.schedulerStats.get(name);
    if (scheduler) {
      scheduler.isRunning = false;

      const runtime = scheduler._startTime ? Date.now() - scheduler._startTime : 0;

      if (success) {
        scheduler.lastSuccess = new Date().toISOString();
        scheduler.stats.successfulRuns++;
      } else {
        scheduler.lastError = {
          time: new Date().toISOString(),
          message: error?.message || error || 'Unknown error',
        };
        scheduler.stats.failedRuns++;
      }

      scheduler.stats.totalRuntime += runtime;
      const totalRuns = scheduler.stats.successfulRuns + scheduler.stats.failedRuns;
      scheduler.stats.averageRuntime = Math.round(scheduler.stats.totalRuntime / totalRuns);

      scheduler._startTime = undefined;
    }
  }

  /**
   * Scheduler durumunu al
   */
  getSchedulerStatus(name) {
    return this.schedulerStats.get(name) || null;
  }

  /**
   * Tüm scheduler durumlarını al
   */
  getAllSchedulerStatus() {
    const result = {};
    for (const [name, stats] of this.schedulerStats) {
      result[name] = { ...stats };
      result[name]._startTime = undefined;
    }
    return result;
  }

  /**
   * Sistem bilgilerini al
   */
  getSystemInfo() {
    const cpus = os.cpus();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    return {
      platform: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
      uptime: os.uptime(),
      nodeVersion: process.version,
      processUptime: Math.round((Date.now() - this.startTime) / 1000),
      cpu: {
        model: cpus[0]?.model,
        cores: cpus.length,
        usage: this.getCpuUsage(),
      },
      memory: {
        total: Math.round(totalMemory / 1024 / 1024),
        free: Math.round(freeMemory / 1024 / 1024),
        used: Math.round(usedMemory / 1024 / 1024),
        usagePercent: Math.round((usedMemory / totalMemory) * 100),
      },
      process: {
        pid: process.pid,
        memory: {
          heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
        },
      },
    };
  }

  /**
   * CPU kullanımını hesapla
   */
  getCpuUsage() {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    for (const cpu of cpus) {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    }

    return Math.round(100 - (100 * totalIdle) / totalTick);
  }

  /**
   * Realtime durumu
   */
  getRealtimeStatus() {
    return {
      enabled: process.env.NEXT_PUBLIC_ENABLE_REALTIME !== 'false',
      connected: this.realtimeConnected,
      supabaseConfigured: !!this.supabase,
      lastCheck: this.lastHealthCheck,
    };
  }

  /**
   * Realtime tabloları
   */
  getRealtimeTables() {
    return [
      'invoices',
      'cariler',
      'cari_hareketler',
      'stok',
      'stok_hareketler',
      'tenders',
      'notifications',
      'personel',
      'kasa_banka_hareketler',
      'bordro',
      'projeler',
      'demirbas',
      'urunler',
      'menu_items',
      'satin_alma',
    ];
  }

  /**
   * Detaylı health raporu
   */
  async getDetailedHealth() {
    this.lastHealthCheck = new Date().toISOString();

    const [realtimeCheck] = await Promise.all([this.checkRealtimeConnection()]);

    return {
      timestamp: this.lastHealthCheck,
      status: 'healthy',
      system: this.getSystemInfo(),
      schedulers: this.getAllSchedulerStatus(),
      realtime: {
        ...this.getRealtimeStatus(),
        connectionCheck: realtimeCheck,
      },
      tables: this.getRealtimeTables(),
    };
  }
}

// Singleton instance
const systemMonitor = new SystemMonitor();

export default systemMonitor;
export { SystemMonitor };
