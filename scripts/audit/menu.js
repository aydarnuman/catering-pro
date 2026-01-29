#!/usr/bin/env node
/**
 * Catering Pro - Gelişmiş İnteraktif Geliştirici Menüsü v3.0
 *
 * Özellikler:
 * - Ok tuşları ile navigasyon
 * - Favoriler (1-9 tuşları)
 * - Arama modu (/ tuşu)
 * - Komut geçmişi (h tuşu)
 * - Profiller (p tuşu)
 * - Watchdog modu (w tuşu)
 * - Bulk işlemler (b tuşu)
 * - Tema desteği (t tuşu)
 * - Performans metrikleri
 * - Gelişmiş log viewer
 */

import readline from 'readline';
import { spawn, execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import net from 'net';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

// ═══════════════════════════════════════════════════════════════════════════
// TEMA SİSTEMİ
// ═══════════════════════════════════════════════════════════════════════════

const themes = {
  dark: {
    name: 'Koyu',
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    bgBlue: '\x1b[44m',
    bgGreen: '\x1b[42m',
    bgRed: '\x1b[41m',
    bgYellow: '\x1b[43m',
    bgCyan: '\x1b[46m',
    bgMagenta: '\x1b[45m',
    primary: '\x1b[36m',
    secondary: '\x1b[34m',
    accent: '\x1b[33m',
    success: '\x1b[32m',
    error: '\x1b[31m',
    warning: '\x1b[33m',
  },
  light: {
    name: 'Açık',
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[91m',
    green: '\x1b[92m',
    yellow: '\x1b[93m',
    blue: '\x1b[94m',
    magenta: '\x1b[95m',
    cyan: '\x1b[96m',
    white: '\x1b[97m',
    bgBlue: '\x1b[104m',
    bgGreen: '\x1b[102m',
    bgRed: '\x1b[101m',
    bgYellow: '\x1b[103m',
    bgCyan: '\x1b[106m',
    bgMagenta: '\x1b[105m',
    primary: '\x1b[94m',
    secondary: '\x1b[96m',
    accent: '\x1b[93m',
    success: '\x1b[92m',
    error: '\x1b[91m',
    warning: '\x1b[93m',
  },
  ocean: {
    name: 'Okyanus',
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[38;5;203m',
    green: '\x1b[38;5;157m',
    yellow: '\x1b[38;5;229m',
    blue: '\x1b[38;5;39m',
    magenta: '\x1b[38;5;183m',
    cyan: '\x1b[38;5;87m',
    white: '\x1b[38;5;255m',
    bgBlue: '\x1b[48;5;24m',
    bgGreen: '\x1b[48;5;29m',
    bgRed: '\x1b[48;5;124m',
    bgYellow: '\x1b[48;5;136m',
    bgCyan: '\x1b[48;5;30m',
    bgMagenta: '\x1b[48;5;97m',
    primary: '\x1b[38;5;87m',
    secondary: '\x1b[38;5;39m',
    accent: '\x1b[38;5;229m',
    success: '\x1b[38;5;157m',
    error: '\x1b[38;5;203m',
    warning: '\x1b[38;5;229m',
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// PORT TANIMLARI
// ═══════════════════════════════════════════════════════════════════════════

const PORTS = {
  frontend: 3000,
  backend: 3001,
  whatsapp: 3002,
  postgres: 5432,
};

// ═══════════════════════════════════════════════════════════════════════════
// PROFİLLER
// ═══════════════════════════════════════════════════════════════════════════

const profiles = {
  dev: {
    name: '🔧 Development',
    description: 'Backend + Frontend (hot reload)',
    commands: [
      { cmd: ['./service.sh', 'start'], cwd: projectRoot },
    ],
  },
  prod: {
    name: '🚀 Production',
    description: 'Production build + PM2',
    commands: [
      { cmd: ['npm', 'run', 'build'], cwd: path.join(projectRoot, 'frontend') },
      { cmd: ['./service.sh', 'start'], cwd: projectRoot },
    ],
  },
  minimal: {
    name: '⚡ Minimal',
    description: 'Sadece backend',
    commands: [
      { cmd: ['npm', 'start'], cwd: path.join(projectRoot, 'backend') },
    ],
  },
  test: {
    name: '🧪 Test',
    description: 'Test ortamı',
    commands: [
      { cmd: ['npm', 'test'], cwd: path.join(projectRoot, 'backend') },
    ],
  },
  clean: {
    name: '🧹 Clean Start',
    description: 'Temizle + Başlat',
    commands: [
      { cmd: ['./service.sh', 'stop'], cwd: projectRoot },
      { cmd: ['./service.sh', 'clean'], cwd: projectRoot },
      { cmd: ['./service.sh', 'start'], cwd: projectRoot },
    ],
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// BULK İŞLEMLER (PİPELINES)
// ═══════════════════════════════════════════════════════════════════════════

const pipelines = {
  'deploy-ready': {
    name: '🚀 Deploy Hazırlık',
    description: 'Lint + Type Check + Build + Test',
    steps: [
      { label: 'Lint kontrolü', cmd: ['npm', 'run', 'lint'], cwd: path.join(projectRoot, 'frontend') },
      { label: 'Type check', cmd: ['npm', 'run', 'type-check'], cwd: path.join(projectRoot, 'frontend') },
      { label: 'Build', cmd: ['npm', 'run', 'build'], cwd: path.join(projectRoot, 'frontend') },
    ],
  },
  'fresh-start': {
    name: '🔄 Sıfırdan Başlat',
    description: 'Stop + Clean + Pull + Install + Start',
    steps: [
      { label: 'Servisleri durdur', cmd: ['./service.sh', 'stop'], cwd: projectRoot },
      { label: 'Cache temizle', cmd: ['./service.sh', 'clean'], cwd: projectRoot },
      { label: 'Git pull', cmd: ['git', 'pull'], cwd: projectRoot },
      { label: 'Servisleri başlat', cmd: ['./service.sh', 'start'], cwd: projectRoot },
    ],
  },
  'full-audit': {
    name: '🔍 Tam Denetim',
    description: 'Tüm denetimleri sırayla çalıştır',
    steps: [
      { label: 'Kod kalitesi', cmd: ['node', 'scripts/audit/audit.js', '--category=code-quality'], cwd: projectRoot },
      { label: 'Güvenlik', cmd: ['node', 'scripts/audit/audit.js', '--category=security'], cwd: projectRoot },
      { label: 'Altyapı', cmd: ['node', 'scripts/audit/audit.js', '--category=infrastructure'], cwd: projectRoot },
    ],
  },
  'update-deps': {
    name: '📦 Bağımlılık Güncelle',
    description: 'Tüm bağımlılıkları güncelle',
    steps: [
      { label: 'Backend npm update', cmd: ['npm', 'update'], cwd: path.join(projectRoot, 'backend') },
      { label: 'Frontend npm update', cmd: ['npm', 'update'], cwd: path.join(projectRoot, 'frontend') },
      { label: 'Güvenlik denetimi', cmd: ['npm', 'audit', '--audit-level=moderate'], cwd: projectRoot },
    ],
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// YARDIMCI FONKSİYONLAR
// ═══════════════════════════════════════════════════════════════════════════

function isDockerAvailable() {
  try {
    execSync('docker info 2>/dev/null', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

async function checkPort(port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(500);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, 'localhost');
  });
}

function getSystemMetrics() {
  const cpus = os.cpus();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;

  // CPU kullanımı (basit hesaplama)
  let totalIdle = 0;
  let totalTick = 0;
  for (const cpu of cpus) {
    for (const type in cpu.times) {
      totalTick += cpu.times[type];
    }
    totalIdle += cpu.times.idle;
  }
  const cpuUsage = Math.round((1 - totalIdle / totalTick) * 100);

  return {
    cpuUsage,
    memUsed: Math.round(usedMem / 1024 / 1024 / 1024 * 10) / 10,
    memTotal: Math.round(totalMem / 1024 / 1024 / 1024 * 10) / 10,
    memPercent: Math.round((usedMem / totalMem) * 100),
    platform: os.platform(),
    nodeVersion: process.version,
    uptime: Math.round(os.uptime() / 60),
  };
}

async function sendNotification(title, message) {
  // macOS bildirim
  if (process.platform === 'darwin') {
    try {
      execSync(`osascript -e 'display notification "${message}" with title "${title}"'`, { stdio: 'pipe' });
    } catch {}
  }
  // Linux bildirim
  else if (process.platform === 'linux') {
    try {
      execSync(`notify-send "${title}" "${message}"`, { stdio: 'pipe' });
    } catch {}
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// KATEGORİLER
// ═══════════════════════════════════════════════════════════════════════════

const baseCategories = [
  {
    name: '🔍 DENETİM',
    id: 'audit',
    items: [
      {
        id: 'audit-all',
        label: 'Tüm Denetimleri Çalıştır',
        icon: '🔍',
        description: 'Kod kalitesi, güvenlik ve altyapı kontrollerinin hepsi',
        command: ['node', 'scripts/audit/audit.js', '--verbose'],
        cwd: projectRoot,
        tags: ['audit', 'all', 'check'],
      },
      {
        id: 'audit-code',
        label: 'Kod Kalitesi',
        icon: '📝',
        description: 'Lint, dead code, complexity, API tutarlılığı',
        command: ['node', 'scripts/audit/audit.js', '--category=code-quality', '--verbose'],
        cwd: projectRoot,
        tags: ['audit', 'code', 'lint', 'quality'],
      },
      {
        id: 'audit-security',
        label: 'Güvenlik',
        icon: '🔒',
        description: 'Bağımlılıklar, gizli anahtarlar, auth, input validation',
        command: ['node', 'scripts/audit/audit.js', '--category=security', '--verbose'],
        cwd: projectRoot,
        tags: ['audit', 'security', 'vulnerability'],
      },
      {
        id: 'audit-infra',
        label: 'Altyapı',
        icon: '🏗️',
        description: 'Build, database, log analizi, performans',
        command: ['node', 'scripts/audit/audit.js', '--category=infrastructure', '--verbose'],
        cwd: projectRoot,
        tags: ['audit', 'infrastructure', 'build'],
      },
      {
        id: 'audit-secrets',
        label: 'Gizli Anahtar Taraması',
        icon: '🔑',
        description: 'Kodda hardcoded secret tespit et',
        command: ['node', 'scripts/audit/audit.js', '--check=secrets', '--verbose'],
        cwd: projectRoot,
        tags: ['audit', 'secrets', 'keys'],
      },
      {
        id: 'audit-sql',
        label: 'SQL Injection Kontrolü',
        icon: '💉',
        description: 'Input validation ve SQL injection riskleri',
        command: ['node', 'scripts/audit/audit.js', '--check=input-validation', '--verbose'],
        cwd: projectRoot,
        tags: ['audit', 'sql', 'injection', 'security'],
      },
      {
        id: 'audit-report',
        label: 'Son Raporu Görüntüle',
        icon: '📊',
        action: 'viewLastReport',
        tags: ['audit', 'report', 'view'],
      },
    ],
  },
  {
    name: '🚀 SERVİSLER',
    id: 'services',
    items: [
      {
        id: 'start-all',
        label: '🎯 HER ŞEYİ BAŞLAT',
        icon: '🚀',
        description: 'Pre-flight check + sıralı başlatma + health verify',
        action: 'startEverything',
        highlight: true,
        tags: ['start', 'all', 'boot'],
      },
      {
        id: 'restart-all',
        label: 'Tümünü Yeniden Başlat',
        icon: '🔄',
        description: 'stop → clean → start (temiz başlatma)',
        command: ['./service.sh', 'restart'],
        cwd: projectRoot,
        tags: ['restart', 'all'],
      },
      {
        id: 'start-services',
        label: 'Servisleri Başlat',
        icon: '▶️',
        description: 'Backend + Frontend başlat',
        command: ['./service.sh', 'start'],
        cwd: projectRoot,
        tags: ['start', 'services'],
      },
      {
        id: 'stop-services',
        label: 'Servisleri Durdur',
        icon: '⏹️',
        description: 'Tüm servisleri durdur',
        command: ['./service.sh', 'stop'],
        cwd: projectRoot,
        tags: ['stop', 'services'],
      },
      {
        id: 'status',
        label: 'Durum Kontrolü',
        icon: '📊',
        description: 'Servislerin çalışma durumu',
        action: 'serviceStatus',
        tags: ['status', 'check'],
      },
      {
        id: 'logs',
        label: 'Canlı Loglar',
        icon: '📜',
        description: 'Log takibi (Ctrl+C ile çık)',
        action: 'viewLogs',
        tags: ['logs', 'view', 'tail'],
      },
      {
        id: 'backend-restart',
        label: 'Sadece Backend Yenile',
        icon: '🔙',
        description: 'Backend servisini yeniden başlat',
        command: ['./service.sh', 'backend'],
        cwd: projectRoot,
        tags: ['backend', 'restart'],
      },
      {
        id: 'frontend-restart',
        label: 'Sadece Frontend Yenile',
        icon: '🖥️',
        description: 'Frontend servisini yeniden başlat',
        command: ['./service.sh', 'frontend'],
        cwd: projectRoot,
        tags: ['frontend', 'restart'],
      },
    ],
  },
  {
    name: '🔄 REALTIME',
    id: 'realtime',
    items: [
      {
        id: 'realtime-status',
        label: 'Realtime Durumu',
        icon: '📡',
        description: 'Supabase realtime bağlantı durumu',
        action: 'realtimeStatus',
        tags: ['realtime', 'supabase', 'status'],
      },
      {
        id: 'scheduler-status',
        label: 'Scheduler Durumu',
        icon: '⏱️',
        description: 'Sync ve tender scheduler durumları',
        action: 'schedulerStatus',
        tags: ['scheduler', 'cron', 'status'],
      },
      {
        id: 'manual-sync',
        label: 'Manuel Sync Tetikle',
        icon: '🔄',
        description: 'Uyumsoft fatura senkronizasyonu',
        action: 'triggerSync',
        dangerous: true,
        confirmMessage: 'Fatura senkronizasyonu başlatılacak.',
        tags: ['sync', 'uyumsoft', 'manual'],
      },
      {
        id: 'queue-status',
        label: 'Queue Durumu',
        icon: '📦',
        description: 'Döküman işleme kuyruğu',
        action: 'queueStatus',
        tags: ['queue', 'jobs', 'status'],
      },
      {
        id: 'health-detailed',
        label: 'Health Check (Detaylı)',
        icon: '🏥',
        description: 'Tüm sistemlerin detaylı sağlık kontrolü',
        action: 'detailedHealth',
        tags: ['health', 'check', 'detailed'],
      },
    ],
  },
  {
    name: '🧹 CACHE',
    id: 'cache',
    items: [
      {
        id: 'clean-fast',
        label: 'Hızlı Temizlik',
        icon: '🧹',
        description: 'Cache temizle (.next silmez)',
        command: ['./service.sh', 'clean'],
        cwd: projectRoot,
        tags: ['clean', 'cache', 'fast'],
      },
      {
        id: 'clean-hard',
        label: 'Hard Temizlik',
        icon: '💥',
        description: '.next + cache tamamen sil',
        command: ['bash', '-c', 'rm -rf frontend/.next && ./service.sh clean'],
        cwd: projectRoot,
        dangerous: true,
        confirmMessage: '.next klasörü silinecek. İlk build daha uzun sürecek.',
        tags: ['clean', 'hard', 'cache'],
      },
      {
        id: 'dev-clean',
        label: 'Temiz Dev Başlat',
        icon: '🚀',
        description: 'Clean + Dev mode başlat',
        command: ['npm', 'run', 'dev:clean'],
        cwd: path.join(projectRoot, 'frontend'),
        tags: ['dev', 'clean', 'start'],
      },
      {
        id: 'build-clean',
        label: 'Temiz Build',
        icon: '📦',
        description: 'Clean + Production build',
        command: ['npm', 'run', 'build:clean'],
        cwd: path.join(projectRoot, 'frontend'),
        tags: ['build', 'clean', 'production'],
      },
    ],
  },
  {
    name: '🗄️ DATABASE',
    id: 'database',
    items: [
      {
        id: 'db-status',
        label: 'Database Durumu',
        icon: '📊',
        description: 'Supabase bağlantı durumu',
        action: 'dbStatus',
        tags: ['database', 'status', 'supabase'],
      },
      {
        id: 'db-migrations',
        label: 'Migration Listesi',
        icon: '📋',
        description: 'Uygulanan migration\'ları listele',
        action: 'dbMigrations',
        tags: ['database', 'migrations', 'list'],
      },
      {
        id: 'db-backup',
        label: 'Database Backup',
        icon: '💾',
        description: 'Veritabanını yedekle (Supabase Dashboard)',
        action: 'dbBackup',
        tags: ['database', 'backup'],
      },
      {
        id: 'db-studio',
        label: 'Supabase Studio Aç',
        icon: '🖥️',
        description: 'Supabase Dashboard\'u tarayıcıda aç',
        action: 'openSupabaseStudio',
        tags: ['database', 'studio', 'supabase'],
      },
      {
        id: 'db-reset',
        label: 'Database Reset',
        icon: '⚠️',
        description: 'TÜM VERİLERİ SİL ve sıfırla',
        action: 'dbReset',
        dangerous: true,
        confirmMessage: 'TÜM VERİLER SİLİNECEK! Bu işlem geri alınamaz.',
        tags: ['database', 'reset', 'danger'],
      },
    ],
  },
  {
    name: '🧪 TEST',
    id: 'test',
    items: [
      {
        id: 'test-run',
        label: 'Testleri Çalıştır',
        icon: '🧪',
        description: 'Jest testlerini çalıştır',
        command: ['npm', 'test'],
        cwd: path.join(projectRoot, 'backend'),
        tags: ['test', 'jest', 'run'],
      },
      {
        id: 'test-coverage',
        label: 'Test Coverage',
        icon: '📈',
        description: 'Coverage raporu ile test',
        command: ['npm', 'run', 'test:coverage'],
        cwd: path.join(projectRoot, 'backend'),
        tags: ['test', 'coverage'],
      },
      {
        id: 'type-check',
        label: 'TypeScript Check',
        icon: '📘',
        description: 'Type hatalarını kontrol et',
        command: ['npm', 'run', 'type-check'],
        cwd: path.join(projectRoot, 'frontend'),
        tags: ['typescript', 'types', 'check'],
      },
      {
        id: 'build-prod',
        label: 'Production Build',
        icon: '📦',
        description: 'Next.js production build',
        command: ['npm', 'run', 'build'],
        cwd: path.join(projectRoot, 'frontend'),
        tags: ['build', 'production'],
      },
      {
        id: 'lint-backend',
        label: 'Lint (Backend)',
        icon: '🔧',
        description: 'Backend Biome lint',
        command: ['npm', 'run', 'lint'],
        cwd: path.join(projectRoot, 'backend'),
        tags: ['lint', 'backend', 'biome'],
      },
      {
        id: 'lint-frontend',
        label: 'Lint (Frontend)',
        icon: '🔧',
        description: 'Frontend Biome lint',
        command: ['npm', 'run', 'lint'],
        cwd: path.join(projectRoot, 'frontend'),
        tags: ['lint', 'frontend', 'biome'],
      },
      {
        id: 'lint-fix',
        label: 'Lint Fix (Tümü)',
        icon: '✨',
        description: 'Otomatik lint düzeltme',
        command: ['bash', '-c', 'cd frontend && npm run lint:fix && cd ../backend && npm run lint:fix'],
        cwd: projectRoot,
        tags: ['lint', 'fix', 'auto'],
      },
    ],
  },
  {
    name: '📂 GIT',
    id: 'git',
    items: [
      {
        id: 'git-status',
        label: 'Git Status',
        icon: '📋',
        description: 'Değişiklikleri göster',
        command: ['git', 'status'],
        cwd: projectRoot,
        tags: ['git', 'status'],
      },
      {
        id: 'git-diff',
        label: 'Git Diff',
        icon: '📝',
        description: 'Değişiklik detayları',
        command: ['git', 'diff', '--stat'],
        cwd: projectRoot,
        tags: ['git', 'diff'],
      },
      {
        id: 'git-pull',
        label: 'Git Pull',
        icon: '⬇️',
        description: 'Remote\'dan güncelle',
        command: ['git', 'pull'],
        cwd: projectRoot,
        tags: ['git', 'pull', 'update'],
      },
      {
        id: 'git-log',
        label: 'Git Log (Son 10)',
        icon: '📜',
        description: 'Son commit\'leri göster',
        command: ['git', 'log', '--oneline', '-10', '--graph'],
        cwd: projectRoot,
        tags: ['git', 'log', 'history'],
      },
      {
        id: 'git-branch',
        label: 'Branch Bilgisi',
        icon: '🌿',
        description: 'Mevcut branch ve remote',
        command: ['git', 'branch', '-vv'],
        cwd: projectRoot,
        tags: ['git', 'branch'],
      },
      {
        id: 'git-stash',
        label: 'Stash Değişiklikler',
        icon: '📥',
        description: 'Değişiklikleri sakla',
        command: ['git', 'stash'],
        cwd: projectRoot,
        tags: ['git', 'stash'],
      },
      {
        id: 'git-stash-pop',
        label: 'Stash Geri Yükle',
        icon: '📤',
        description: 'Saklanan değişiklikleri geri al',
        command: ['git', 'stash', 'pop'],
        cwd: projectRoot,
        tags: ['git', 'stash', 'pop'],
      },
    ],
  },
  {
    name: '📦 DEPS',
    id: 'deps',
    items: [
      {
        id: 'deps-check',
        label: 'Bağımlılık Kontrolü',
        icon: '🔍',
        description: 'Güncelleme bekleyen paketler',
        action: 'checkDependencies',
        tags: ['deps', 'check', 'outdated'],
      },
      {
        id: 'deps-audit',
        label: 'Güvenlik Denetimi',
        icon: '🔒',
        description: 'npm audit ile güvenlik kontrolü',
        command: ['npm', 'audit'],
        cwd: projectRoot,
        tags: ['deps', 'audit', 'security'],
      },
      {
        id: 'deps-audit-fix',
        label: 'Güvenlik Düzelt',
        icon: '🔧',
        description: 'Güvenlik açıklarını otomatik düzelt',
        command: ['npm', 'audit', 'fix'],
        cwd: projectRoot,
        dangerous: true,
        confirmMessage: 'Bağımlılıklar otomatik güncellenecek.',
        tags: ['deps', 'audit', 'fix'],
      },
      {
        id: 'deps-update-backend',
        label: 'Backend Güncelle',
        icon: '📦',
        description: 'Backend bağımlılıklarını güncelle',
        command: ['npm', 'update'],
        cwd: path.join(projectRoot, 'backend'),
        tags: ['deps', 'update', 'backend'],
      },
      {
        id: 'deps-update-frontend',
        label: 'Frontend Güncelle',
        icon: '📦',
        description: 'Frontend bağımlılıklarını güncelle',
        command: ['npm', 'update'],
        cwd: path.join(projectRoot, 'frontend'),
        tags: ['deps', 'update', 'frontend'],
      },
    ],
  },
  {
    name: '🆘 ACİL',
    id: 'emergency',
    items: [
      {
        id: 'kill-ports',
        label: 'Portları Temizle',
        icon: '🔌',
        description: '3000, 3001, 3002 portlarını zorla kapat',
        command: ['bash', '-c', 'lsof -ti:3000,3001,3002 | xargs kill -9 2>/dev/null || echo "Açık port yok"'],
        cwd: projectRoot,
        dangerous: true,
        confirmMessage: 'Portlar zorla kapatılacak. Çalışan servisler duracak.',
        tags: ['emergency', 'ports', 'kill'],
      },
      {
        id: 'full-reset',
        label: 'Tam Sıfırlama',
        icon: '🔥',
        description: 'Stop + Clean:hard + Start',
        command: ['bash', '-c', './service.sh stop && rm -rf frontend/.next && ./service.sh clean && ./service.sh start'],
        cwd: projectRoot,
        dangerous: true,
        confirmMessage: 'Tüm cache silinip servisler yeniden başlatılacak.',
        tags: ['emergency', 'reset', 'full'],
      },
      {
        id: 'reinstall-modules',
        label: 'Node Modules Yenile',
        icon: '📦',
        description: 'node_modules sil ve yeniden yükle',
        action: 'reinstallModules',
        dangerous: true,
        confirmMessage: 'node_modules silinip yeniden kurulacak. Bu uzun sürebilir.',
        tags: ['emergency', 'node_modules', 'reinstall'],
      },
      {
        id: 'env-check',
        label: 'Environment Kontrolü',
        icon: '🔐',
        description: 'Gerekli environment değişkenlerini kontrol et',
        action: 'envCheck',
        tags: ['env', 'check', 'config'],
      },
      {
        id: 'kill-node',
        label: 'Tüm Node Processleri Kapat',
        icon: '💀',
        description: 'Sistemdeki tüm node processlerini sonlandır',
        command: ['bash', '-c', 'pkill -f node || echo "Node process bulunamadı"'],
        cwd: projectRoot,
        dangerous: true,
        confirmMessage: 'TÜM node processleri kapatılacak!',
        tags: ['emergency', 'node', 'kill'],
      },
    ],
  },
];

// Docker kategorisi
const dockerCategory = {
  name: '🐳 DOCKER',
  id: 'docker',
  items: [
    {
      id: 'docker-status',
      label: 'Container Durumu',
      icon: '📦',
      description: 'Catering container\'larının durumu',
      action: 'dockerStatus',
      tags: ['docker', 'status', 'container'],
    },
    {
      id: 'docker-up',
      label: 'Compose Up',
      icon: '▶️',
      description: 'Tüm Docker servislerini başlat',
      command: ['docker-compose', 'up', '-d'],
      cwd: projectRoot,
      tags: ['docker', 'up', 'start'],
    },
    {
      id: 'docker-down',
      label: 'Compose Down',
      icon: '⏹️',
      description: 'Tüm Docker servislerini durdur',
      command: ['docker-compose', 'down'],
      cwd: projectRoot,
      tags: ['docker', 'down', 'stop'],
    },
    {
      id: 'docker-logs-postgres',
      label: 'PostgreSQL Logları',
      icon: '🗄️',
      description: 'PostgreSQL container logları',
      command: ['docker', 'logs', '-f', '--tail', '100', 'catering_postgres'],
      cwd: projectRoot,
      tags: ['docker', 'logs', 'postgres'],
    },
    {
      id: 'docker-logs-whatsapp',
      label: 'WhatsApp Logları',
      icon: '📱',
      description: 'WhatsApp container logları',
      command: ['docker', 'logs', '-f', '--tail', '100', 'catering_whatsapp'],
      cwd: projectRoot,
      tags: ['docker', 'logs', 'whatsapp'],
    },
    {
      id: 'docker-restart',
      label: 'Compose Restart',
      icon: '🔄',
      description: 'Tüm container\'ları yeniden başlat',
      command: ['docker-compose', 'restart'],
      cwd: projectRoot,
      dangerous: true,
      confirmMessage: 'Tüm Docker container\'ları yeniden başlatılacak.',
      tags: ['docker', 'restart'],
    },
    {
      id: 'docker-prune',
      label: 'Docker Temizle',
      icon: '🧹',
      description: 'Kullanılmayan image ve container\'ları sil',
      command: ['docker', 'system', 'prune', '-f'],
      cwd: projectRoot,
      dangerous: true,
      confirmMessage: 'Kullanılmayan Docker kaynakları silinecek.',
      tags: ['docker', 'prune', 'clean'],
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// ANA MENÜ SINIFI
// ═══════════════════════════════════════════════════════════════════════════

class InteractiveMenu {
  constructor() {
    this.categoryIndex = 0;
    this.itemIndex = 0;
    this.running = true;
    this.menuCategories = [...baseCategories];
    this.serviceStatus = {};
    this.currentTheme = 'dark';
    this.c = themes[this.currentTheme];
    this.searchMode = false;
    this.searchQuery = '';
    this.searchResults = [];
    this.showHelp = false;
    this.mode = 'normal'; // normal, search, history, profiles, pipelines, watchdog, logs
    this.commandHistory = [];
    this.historyIndex = 0;
    this.favorites = {};
    this.watchdogActive = false;
    this.watchdogInterval = null;
    this.logFilter = 'all'; // all, error, warn, info
    this.lastCommandTime = null;
    this.configPath = path.join(projectRoot, '.devmenu.json');
    this.metrics = null;

    // Docker varsa kategori ekle
    if (isDockerAvailable()) {
      this.menuCategories.splice(this.menuCategories.length - 1, 0, dockerCategory);
    }

    // Config yükle
    this.loadConfig();
  }

  async loadConfig() {
    try {
      const data = await fs.readFile(this.configPath, 'utf-8');
      const config = JSON.parse(data);
      this.favorites = config.favorites || {};
      this.commandHistory = config.history || [];
      this.currentTheme = config.theme || 'dark';
      this.c = themes[this.currentTheme];
    } catch {
      // Config dosyası yoksa varsayılanları kullan
    }
  }

  async saveConfig() {
    try {
      const config = {
        favorites: this.favorites,
        history: this.commandHistory.slice(-50), // Son 50 komut
        theme: this.currentTheme,
      };
      await fs.writeFile(this.configPath, JSON.stringify(config, null, 2));
    } catch {}
  }

  clearScreen() {
    process.stdout.write('\x1b[2J\x1b[H');
  }

  hideCursor() {
    process.stdout.write('\x1b[?25l');
  }

  showCursor() {
    process.stdout.write('\x1b[?25h');
  }

  getCurrentCategory() {
    return this.menuCategories[this.categoryIndex];
  }

  getCurrentItem() {
    const category = this.getCurrentCategory();
    return category.items[this.itemIndex];
  }

  async updateServiceStatus() {
    this.serviceStatus = {
      backend: await checkPort(PORTS.backend),
      frontend: await checkPort(PORTS.frontend),
      whatsapp: await checkPort(PORTS.whatsapp),
      postgres: await checkPort(PORTS.postgres),
    };
  }

  updateMetrics() {
    this.metrics = getSystemMetrics();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER FONKSİYONLARI
  // ═══════════════════════════════════════════════════════════════════════════

  renderStatusHeader() {
    const c = this.c;
    const indicators = [];

    for (const [name, isUp] of Object.entries(this.serviceStatus)) {
      const icon = isUp ? '●' : '○';
      const color = isUp ? c.success : c.error;
      indicators.push(`${color}${icon}${c.reset} ${name}`);
    }

    console.log(`${c.dim}┌─ SERVİS DURUMU ────────────────────────────────────────────────────────┐${c.reset}`);
    console.log(`${c.dim}│${c.reset}  ${indicators.join('  │  ')}  ${c.dim}│${c.reset}`);
    console.log(`${c.dim}└────────────────────────────────────────────────────────────────────────┘${c.reset}`);
  }

  renderMetricsBar() {
    const c = this.c;
    if (!this.metrics) return;

    const cpuBar = this.createProgressBar(this.metrics.cpuUsage, 10);
    const memBar = this.createProgressBar(this.metrics.memPercent, 10);

    console.log(`${c.dim}┌─ SİSTEM ───────────────────────────────────────────────────────────────┐${c.reset}`);
    console.log(`${c.dim}│${c.reset}  CPU: ${cpuBar} ${this.metrics.cpuUsage}%  │  RAM: ${memBar} ${this.metrics.memUsed}/${this.metrics.memTotal}GB  │  Uptime: ${this.metrics.uptime}m  ${c.dim}│${c.reset}`);
    console.log(`${c.dim}└────────────────────────────────────────────────────────────────────────┘${c.reset}`);
  }

  createProgressBar(percent, width) {
    const c = this.c;
    const filled = Math.round((percent / 100) * width);
    const empty = width - filled;
    const color = percent > 80 ? c.error : percent > 60 ? c.warning : c.success;
    return `${color}${'█'.repeat(filled)}${c.dim}${'░'.repeat(empty)}${c.reset}`;
  }

  renderBreadcrumb() {
    const c = this.c;
    const category = this.getCurrentCategory();
    const item = this.getCurrentItem();

    let modeIndicator = '';
    if (this.watchdogActive) modeIndicator = ` ${c.bgGreen}${c.white} WATCHDOG ${c.reset}`;
    if (this.searchMode) modeIndicator = ` ${c.bgYellow}${c.white} ARAMA ${c.reset}`;

    console.log(`${c.dim}📍 ${category.name} > ${c.reset}${c.bold}${item?.label || ''}${c.reset}${modeIndicator}`);
  }

  renderKeyboardShortcuts() {
    const c = this.c;

    const shortcuts = [
      '←→: Kategori',
      '↑↓: Öğe',
      'Enter: Çalıştır',
      '/: Ara',
      'h: Geçmiş',
      'p: Profil',
      'b: Pipeline',
      'w: Watchdog',
      't: Tema',
      '1-9: Favori',
      'f: Fav Ekle',
      '?: Yardım',
      'q: Çıkış',
    ];

    console.log(`${c.dim}  ${shortcuts.join('  │  ')}${c.reset}`);
  }

  async render() {
    this.clearScreen();
    const c = this.c;

    // Metrikleri güncelle
    this.updateMetrics();
    await this.updateServiceStatus();

    // Header
    console.log(`${c.bgBlue}${c.white}${c.bold}`);
    console.log('  ╔════════════════════════════════════════════════════════════════════════╗  ');
    console.log('  ║            🚀 CATERING PRO - GELİŞTİRİCİ ARAÇLARI v3.0 🚀              ║  ');
    console.log('  ╚════════════════════════════════════════════════════════════════════════╝  ');
    console.log(`${c.reset}\n`);

    // Durum header'ları
    this.renderStatusHeader();
    this.renderMetricsBar();

    // Breadcrumb
    console.log('');
    this.renderBreadcrumb();

    // Kısayol bilgisi
    console.log('');
    this.renderKeyboardShortcuts();
    console.log('');

    // Arama modu
    if (this.searchMode) {
      this.renderSearchMode();
      return;
    }

    // Yardım modu
    if (this.showHelp) {
      this.renderHelpScreen();
      return;
    }

    // Normal mod - Kategori tabları
    let tabLine = '  ';
    this.menuCategories.forEach((cat, idx) => {
      if (idx === this.categoryIndex) {
        tabLine += `${c.bgBlue}${c.white}${c.bold} ${cat.name} ${c.reset} `;
      } else {
        tabLine += `${c.dim} ${cat.name} ${c.reset} `;
      }
    });
    console.log(tabLine);
    console.log(`${c.dim}  ${'─'.repeat(75)}${c.reset}\n`);

    // Kategori öğeleri
    const category = this.getCurrentCategory();

    category.items.forEach((item, idx) => {
      const isSelected = idx === this.itemIndex;
      const dangerIcon = item.dangerous ? `${c.error}⚠️ ${c.reset}` : '';
      const highlightBg = item.highlight && isSelected ? c.bgGreen : '';

      // Favori göstergesi
      const favKey = Object.keys(this.favorites).find(k => this.favorites[k] === item.id);
      const favIndicator = favKey ? `${c.accent}[${favKey}]${c.reset} ` : '';

      if (isSelected) {
        console.log(`${highlightBg}${c.primary}  ❯ ${item.icon} ${c.bold}${item.label}${c.reset} ${favIndicator}${dangerIcon}`);
        if (item.description) {
          console.log(`${c.primary}      ${c.dim}${item.description}${c.reset}`);
        }
      } else {
        console.log(`${c.reset}    ${item.icon} ${item.label} ${favIndicator}${dangerIcon}`);
      }
    });

    // Footer
    console.log(`\n${c.dim}  ${'─'.repeat(75)}${c.reset}`);

    // Son komut bilgisi
    if (this.commandHistory.length > 0) {
      const last = this.commandHistory[this.commandHistory.length - 1];
      console.log(`${c.dim}  Son: ${last.label} (${last.time})${c.reset}`);
    }

    // Git branch
    try {
      const branch = execSync('git branch --show-current', { cwd: projectRoot, encoding: 'utf-8' }).trim();
      console.log(`${c.dim}  Git: ${c.success}${branch}${c.reset}`);
    } catch {}

    console.log(`${c.dim}  Tema: ${themes[this.currentTheme].name}${c.reset}`);
  }

  renderSearchMode() {
    const c = this.c;

    console.log(`${c.bgYellow}${c.white}${c.bold} 🔍 ARAMA MODU ${c.reset}`);
    console.log(`${c.dim}  ESC ile çık, Enter ile seç${c.reset}\n`);
    console.log(`  Arama: ${c.bold}${this.searchQuery}${c.reset}█\n`);

    if (this.searchResults.length === 0 && this.searchQuery.length > 0) {
      console.log(`${c.warning}  Sonuç bulunamadı${c.reset}`);
    } else {
      this.searchResults.slice(0, 10).forEach((result, idx) => {
        const isSelected = idx === this.itemIndex;
        const prefix = isSelected ? `${c.primary}❯ ` : '  ';
        console.log(`${prefix}${result.icon} ${result.label} ${c.dim}(${result.categoryName})${c.reset}`);
      });
    }
  }

  renderHelpScreen() {
    const c = this.c;

    console.log(`${c.bgBlue}${c.white}${c.bold} ❓ YARDIM ${c.reset}\n`);

    const helpSections = [
      {
        title: 'Navigasyon',
        items: [
          ['←/→', 'Kategori değiştir'],
          ['↑/↓', 'Öğe seç'],
          ['Enter', 'Seçili komutu çalıştır'],
          ['q', 'Çıkış'],
        ],
      },
      {
        title: 'Özel Modlar',
        items: [
          ['/', 'Arama modu'],
          ['h', 'Komut geçmişi'],
          ['p', 'Profil seç'],
          ['b', 'Pipeline (bulk işlem)'],
          ['w', 'Watchdog aç/kapat'],
          ['l', 'Log viewer'],
        ],
      },
      {
        title: 'Favoriler',
        items: [
          ['f', 'Mevcut öğeyi favoriye ekle'],
          ['1-9', 'Favoriye hızlı erişim'],
        ],
      },
      {
        title: 'Diğer',
        items: [
          ['t', 'Tema değiştir'],
          ['r', 'Ekranı yenile'],
          ['?', 'Bu yardım ekranı'],
        ],
      },
    ];

    for (const section of helpSections) {
      console.log(`${c.bold}${section.title}:${c.reset}`);
      for (const [key, desc] of section.items) {
        console.log(`  ${c.accent}${key.padEnd(10)}${c.reset} ${desc}`);
      }
      console.log('');
    }

    console.log(`${c.dim}Kapatmak için herhangi bir tuşa basın...${c.reset}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MOD RENDER FONKSİYONLARI
  // ═══════════════════════════════════════════════════════════════════════════

  async renderHistoryMode() {
    this.clearScreen();
    const c = this.c;

    console.log(`${c.bgMagenta}${c.white}${c.bold} 📜 KOMUT GEÇMİŞİ ${c.reset}\n`);
    console.log(`${c.dim}  ↑/↓: Seç, Enter: Çalıştır, ESC: Kapat${c.reset}\n`);

    if (this.commandHistory.length === 0) {
      console.log(`${c.warning}  Henüz komut geçmişi yok${c.reset}`);
    } else {
      const history = [...this.commandHistory].reverse().slice(0, 15);
      history.forEach((cmd, idx) => {
        const isSelected = idx === this.historyIndex;
        const prefix = isSelected ? `${c.primary}❯ ` : '  ';
        const status = cmd.success ? `${c.success}✓${c.reset}` : `${c.error}✗${c.reset}`;
        console.log(`${prefix}${status} ${cmd.label} ${c.dim}(${cmd.time})${c.reset}`);
      });
    }
  }

  async renderProfilesMode() {
    this.clearScreen();
    const c = this.c;

    console.log(`${c.bgCyan}${c.white}${c.bold} 👤 PROFİLLER ${c.reset}\n`);
    console.log(`${c.dim}  ↑/↓: Seç, Enter: Başlat, ESC: Kapat${c.reset}\n`);

    const profileKeys = Object.keys(profiles);
    profileKeys.forEach((key, idx) => {
      const profile = profiles[key];
      const isSelected = idx === this.itemIndex;
      const prefix = isSelected ? `${c.primary}❯ ` : '  ';
      console.log(`${prefix}${profile.name}`);
      if (isSelected) {
        console.log(`${c.dim}    ${profile.description}${c.reset}`);
        console.log(`${c.dim}    ${profile.commands.length} adım${c.reset}`);
      }
    });
  }

  async renderPipelinesMode() {
    this.clearScreen();
    const c = this.c;

    console.log(`${c.bgGreen}${c.white}${c.bold} 🔄 BULK İŞLEMLER (PIPELINES) ${c.reset}\n`);
    console.log(`${c.dim}  ↑/↓: Seç, Enter: Başlat, ESC: Kapat${c.reset}\n`);

    const pipelineKeys = Object.keys(pipelines);
    pipelineKeys.forEach((key, idx) => {
      const pipeline = pipelines[key];
      const isSelected = idx === this.itemIndex;
      const prefix = isSelected ? `${c.primary}❯ ` : '  ';
      console.log(`${prefix}${pipeline.name}`);
      if (isSelected) {
        console.log(`${c.dim}    ${pipeline.description}${c.reset}`);
        console.log(`${c.dim}    Adımlar:${c.reset}`);
        pipeline.steps.forEach((step, i) => {
          console.log(`${c.dim}      ${i + 1}. ${step.label}${c.reset}`);
        });
      }
    });
  }

  async renderLogsMode() {
    this.clearScreen();
    const c = this.c;

    console.log(`${c.bgBlue}${c.white}${c.bold} 📋 LOG VIEWER ${c.reset}\n`);
    console.log(`${c.dim}  Filtre: [a]ll [e]rror [w]arn [i]nfo | ESC: Kapat${c.reset}`);
    console.log(`${c.dim}  Aktif filtre: ${this.logFilter}${c.reset}\n`);

    // Log dosyasını oku
    const today = new Date().toISOString().split('T')[0];
    const logPath = path.join(projectRoot, 'backend', 'logs', `app-${today}.log`);

    try {
      const content = await fs.readFile(logPath, 'utf-8');
      const lines = content.split('\n').slice(-30);

      for (const line of lines) {
        if (!line.trim()) continue;

        let color = c.reset;
        let show = true;

        if (line.includes('ERROR') || line.includes('error')) {
          color = c.error;
          show = this.logFilter === 'all' || this.logFilter === 'error';
        } else if (line.includes('WARN') || line.includes('warn')) {
          color = c.warning;
          show = this.logFilter === 'all' || this.logFilter === 'warn';
        } else if (line.includes('INFO') || line.includes('info')) {
          color = c.primary;
          show = this.logFilter === 'all' || this.logFilter === 'info';
        } else {
          show = this.logFilter === 'all';
        }

        if (show) {
          console.log(`${color}${line.substring(0, 100)}${c.reset}`);
        }
      }
    } catch {
      console.log(`${c.warning}Log dosyası bulunamadı: ${logPath}${c.reset}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ARAMA FONKSİYONLARI
  // ═══════════════════════════════════════════════════════════════════════════

  performSearch() {
    if (!this.searchQuery) {
      this.searchResults = [];
      return;
    }

    const query = this.searchQuery.toLowerCase();
    const results = [];

    for (const category of this.menuCategories) {
      for (const item of category.items) {
        const matchLabel = item.label.toLowerCase().includes(query);
        const matchDesc = item.description?.toLowerCase().includes(query);
        const matchTags = item.tags?.some(tag => tag.includes(query));

        if (matchLabel || matchDesc || matchTags) {
          results.push({
            ...item,
            categoryName: category.name,
            categoryIndex: this.menuCategories.indexOf(category),
            itemIndex: category.items.indexOf(item),
          });
        }
      }
    }

    this.searchResults = results;
    this.itemIndex = 0;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FAVORİ FONKSİYONLARI
  // ═══════════════════════════════════════════════════════════════════════════

  async addToFavorites() {
    const c = this.c;
    const item = this.getCurrentItem();

    // Boş slot bul
    for (let i = 1; i <= 9; i++) {
      if (!this.favorites[i]) {
        this.favorites[i] = item.id;
        await this.saveConfig();
        console.log(`\n${c.success}✓ "${item.label}" favorilere eklendi [${i}]${c.reset}`);
        await new Promise(r => setTimeout(r, 1000));
        return;
      }
    }

    console.log(`\n${c.warning}Favori listesi dolu! Bir favoriyi silmek için shift+numara kullanın.${c.reset}`);
    await new Promise(r => setTimeout(r, 1500));
  }

  findItemById(id) {
    for (const category of this.menuCategories) {
      for (const item of category.items) {
        if (item.id === id) {
          return {
            item,
            categoryIndex: this.menuCategories.indexOf(category),
            itemIndex: category.items.indexOf(item),
          };
        }
      }
    }
    return null;
  }

  async executeFavorite(key) {
    const itemId = this.favorites[key];
    if (!itemId) return false;

    const found = this.findItemById(itemId);
    if (found) {
      this.categoryIndex = found.categoryIndex;
      this.itemIndex = found.itemIndex;
      await this.executeSelection(found.item);
      return true;
    }
    return false;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // WATCHDOG FONKSİYONLARI
  // ═══════════════════════════════════════════════════════════════════════════

  async toggleWatchdog() {
    const c = this.c;

    if (this.watchdogActive) {
      clearInterval(this.watchdogInterval);
      this.watchdogInterval = null;
      this.watchdogActive = false;
      console.log(`\n${c.warning}🐕 Watchdog devre dışı${c.reset}`);
    } else {
      this.watchdogActive = true;
      console.log(`\n${c.success}🐕 Watchdog aktif - Servisler izleniyor...${c.reset}`);

      this.watchdogInterval = setInterval(async () => {
        const backendUp = await checkPort(PORTS.backend);
        const frontendUp = await checkPort(PORTS.frontend);

        if (!backendUp) {
          await sendNotification('Catering Pro', 'Backend düştü! Yeniden başlatılıyor...');
          execSync('./service.sh backend', { cwd: projectRoot, stdio: 'pipe' });
        }

        if (!frontendUp) {
          await sendNotification('Catering Pro', 'Frontend düştü! Yeniden başlatılıyor...');
          execSync('./service.sh frontend', { cwd: projectRoot, stdio: 'pipe' });
        }
      }, 30000); // 30 saniyede bir kontrol
    }

    await new Promise(r => setTimeout(r, 1500));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEMA FONKSİYONLARI
  // ═══════════════════════════════════════════════════════════════════════════

  async cycleTheme() {
    const themeKeys = Object.keys(themes);
    const currentIdx = themeKeys.indexOf(this.currentTheme);
    const nextIdx = (currentIdx + 1) % themeKeys.length;
    this.currentTheme = themeKeys[nextIdx];
    this.c = themes[this.currentTheme];
    await this.saveConfig();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // KOMUT ÇALIŞTIRMA
  // ═══════════════════════════════════════════════════════════════════════════

  async run() {
    this.hideCursor();
    await this.render();

    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }

    return new Promise((resolve) => {
      process.stdin.on('keypress', async (str, key) => {
        if (!this.running) return;

        // ESC - Mod çıkışları
        if (key.name === 'escape') {
          if (this.searchMode) {
            this.searchMode = false;
            this.searchQuery = '';
            this.searchResults = [];
          }
          if (this.showHelp) {
            this.showHelp = false;
          }
          if (this.mode !== 'normal') {
            this.mode = 'normal';
            this.itemIndex = 0;
          }
          await this.render();
          return;
        }

        // Yardım modunda herhangi bir tuş kapat
        if (this.showHelp) {
          this.showHelp = false;
          await this.render();
          return;
        }

        // Arama modunda özel tuşlar
        if (this.searchMode) {
          if (key.name === 'return' && this.searchResults.length > 0) {
            const result = this.searchResults[this.itemIndex];
            this.categoryIndex = result.categoryIndex;
            this.itemIndex = result.itemIndex;
            this.searchMode = false;
            this.searchQuery = '';
            await this.executeSelection(this.getCurrentItem());
          } else if (key.name === 'up' && this.searchResults.length > 0) {
            this.itemIndex = (this.itemIndex - 1 + this.searchResults.length) % this.searchResults.length;
            await this.render();
          } else if (key.name === 'down' && this.searchResults.length > 0) {
            this.itemIndex = (this.itemIndex + 1) % this.searchResults.length;
            await this.render();
          } else if (key.name === 'backspace') {
            this.searchQuery = this.searchQuery.slice(0, -1);
            this.performSearch();
            await this.render();
          } else if (str && str.length === 1 && !key.ctrl) {
            this.searchQuery += str;
            this.performSearch();
            await this.render();
          }
          return;
        }

        // Mod özel tuşları
        if (this.mode === 'history') {
          if (key.name === 'up') {
            this.historyIndex = Math.max(0, this.historyIndex - 1);
            await this.renderHistoryMode();
          } else if (key.name === 'down') {
            this.historyIndex = Math.min(this.commandHistory.length - 1, this.historyIndex + 1);
            await this.renderHistoryMode();
          } else if (key.name === 'return' && this.commandHistory.length > 0) {
            const idx = this.commandHistory.length - 1 - this.historyIndex;
            const cmd = this.commandHistory[idx];
            const found = this.findItemById(cmd.id);
            if (found) {
              this.mode = 'normal';
              await this.executeSelection(found.item);
            }
          }
          return;
        }

        if (this.mode === 'profiles') {
          const profileKeys = Object.keys(profiles);
          if (key.name === 'up') {
            this.itemIndex = (this.itemIndex - 1 + profileKeys.length) % profileKeys.length;
            await this.renderProfilesMode();
          } else if (key.name === 'down') {
            this.itemIndex = (this.itemIndex + 1) % profileKeys.length;
            await this.renderProfilesMode();
          } else if (key.name === 'return') {
            await this.runProfile(profileKeys[this.itemIndex]);
          }
          return;
        }

        if (this.mode === 'pipelines') {
          const pipelineKeys = Object.keys(pipelines);
          if (key.name === 'up') {
            this.itemIndex = (this.itemIndex - 1 + pipelineKeys.length) % pipelineKeys.length;
            await this.renderPipelinesMode();
          } else if (key.name === 'down') {
            this.itemIndex = (this.itemIndex + 1) % pipelineKeys.length;
            await this.renderPipelinesMode();
          } else if (key.name === 'return') {
            await this.runPipeline(pipelineKeys[this.itemIndex]);
          }
          return;
        }

        if (this.mode === 'logs') {
          if (str === 'a') {
            this.logFilter = 'all';
            await this.renderLogsMode();
          } else if (str === 'e') {
            this.logFilter = 'error';
            await this.renderLogsMode();
          } else if (str === 'w') {
            this.logFilter = 'warn';
            await this.renderLogsMode();
          } else if (str === 'i') {
            this.logFilter = 'info';
            await this.renderLogsMode();
          }
          return;
        }

        // Normal mod tuşları
        const category = this.getCurrentCategory();

        if (key.name === 'left') {
          this.categoryIndex = (this.categoryIndex - 1 + this.menuCategories.length) % this.menuCategories.length;
          this.itemIndex = 0;
          await this.render();
        } else if (key.name === 'right') {
          this.categoryIndex = (this.categoryIndex + 1) % this.menuCategories.length;
          this.itemIndex = 0;
          await this.render();
        } else if (key.name === 'up') {
          this.itemIndex = (this.itemIndex - 1 + category.items.length) % category.items.length;
          await this.render();
        } else if (key.name === 'down') {
          this.itemIndex = (this.itemIndex + 1) % category.items.length;
          await this.render();
        } else if (key.name === 'return') {
          const selected = this.getCurrentItem();
          await this.executeSelection(selected);
        } else if (str === '/' || key.name === 'slash') {
          this.searchMode = true;
          this.searchQuery = '';
          this.itemIndex = 0;
          await this.render();
        } else if (str === 'h' || str === 'H') {
          this.mode = 'history';
          this.historyIndex = 0;
          await this.renderHistoryMode();
        } else if (str === 'p' || str === 'P') {
          this.mode = 'profiles';
          this.itemIndex = 0;
          await this.renderProfilesMode();
        } else if (str === 'b' || str === 'B') {
          this.mode = 'pipelines';
          this.itemIndex = 0;
          await this.renderPipelinesMode();
        } else if (str === 'w' || str === 'W') {
          await this.toggleWatchdog();
          await this.render();
        } else if (str === 'l' || str === 'L') {
          this.mode = 'logs';
          await this.renderLogsMode();
        } else if (str === 't' || str === 'T') {
          await this.cycleTheme();
          await this.render();
        } else if (str === 'f' || str === 'F') {
          await this.addToFavorites();
          await this.render();
        } else if (str === '?' || (key.shift && str === '/')) {
          this.showHelp = true;
          await this.render();
        } else if (str === 'r' || str === 'R') {
          await this.render();
        } else if (str >= '1' && str <= '9') {
          const executed = await this.executeFavorite(str);
          if (!executed) {
            await this.render();
          }
        } else if (key.name === 'q' || (key.ctrl && key.name === 'c')) {
          this.exit();
          resolve();
        }
      });
    });
  }

  async confirm(message) {
    const c = this.c;
    this.showCursor();
    console.log(`\n${c.bgYellow}${c.bold} ⚠️  UYARI ${c.reset}`);
    console.log(`${c.warning}${message}${c.reset}\n`);
    console.log(`${c.bold}Devam etmek istiyor musunuz? (e/h)${c.reset}`);

    return new Promise((resolve) => {
      const handler = (str, key) => {
        if (key.name === 'e' || str === 'e' || str === 'E' || str === 'y' || str === 'Y') {
          process.stdin.removeListener('keypress', handler);
          resolve(true);
        } else if (key.name === 'h' || str === 'h' || str === 'H' || key.name === 'n' || str === 'n' || str === 'N') {
          process.stdin.removeListener('keypress', handler);
          resolve(false);
        }
      };
      process.stdin.on('keypress', handler);
    });
  }

  async executeSelection(item) {
    const c = this.c;
    const startTime = Date.now();

    // Tehlikeli işlem kontrolü
    if (item.dangerous) {
      const confirmed = await this.confirm(item.confirmMessage || 'Bu işlem tehlikeli olabilir.');
      if (!confirmed) {
        this.hideCursor();
        await this.render();
        return;
      }
    }

    // Geçmişe ekle
    this.commandHistory.push({
      id: item.id,
      label: item.label,
      time: new Date().toLocaleTimeString('tr-TR'),
      success: true,
    });
    await this.saveConfig();

    // Özel action'lar
    if (item.action) {
      await this.handleAction(item.action);
      return;
    }

    this.showCursor();
    this.clearScreen();

    console.log(`${c.success}${c.bold}▶ ${item.icon} ${item.label}${c.reset}\n`);

    // Komutu çalıştır
    const child = spawn(item.command[0], item.command.slice(1), {
      cwd: item.cwd || projectRoot,
      stdio: 'inherit',
      shell: item.command[0] === 'bash',
    });

    child.on('close', async (code) => {
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);

      console.log(`\n${c.dim}─────────────────────────────────────────────${c.reset}`);
      const status = code === 0 ? `${c.success}✅ Başarılı${c.reset}` : `${c.error}❌ Hata (kod: ${code})${c.reset}`;
      console.log(`Sonuç: ${status} ${c.dim}(${duration}s)${c.reset}`);

      // Geçmişi güncelle
      if (this.commandHistory.length > 0) {
        this.commandHistory[this.commandHistory.length - 1].success = code === 0;
        await this.saveConfig();
      }

      // Bildirim gönder (uzun süren işlemler için)
      if (duration > 10) {
        await sendNotification('Catering Pro', `${item.label} tamamlandı (${duration}s)`);
      }

      console.log(`${c.dim}Menüye dönmek için Enter'a basın...${c.reset}`);

      const returnHandler = (str, key) => {
        if (key.name === 'return') {
          process.stdin.removeListener('keypress', returnHandler);
          this.hideCursor();
          this.render();
        }
      };
      process.stdin.on('keypress', returnHandler);
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ÖZEL ACTION'LAR
  // ═══════════════════════════════════════════════════════════════════════════

  async handleAction(action) {
    switch (action) {
      case 'viewLastReport':
        await this.viewLastReport();
        break;
      case 'dbBackup':
        await this.dbBackup();
        break;
      case 'dbReset':
        await this.dbReset();
        break;
      case 'dbStatus':
        await this.dbStatus();
        break;
      case 'dbMigrations':
        await this.dbMigrations();
        break;
      case 'openSupabaseStudio':
        await this.openSupabaseStudio();
        break;
      case 'reinstallModules':
        await this.reinstallModules();
        break;
      case 'startEverything':
        await this.startEverything();
        break;
      case 'serviceStatus':
        await this.showServiceStatus();
        break;
      case 'realtimeStatus':
        await this.showRealtimeStatus();
        break;
      case 'schedulerStatus':
        await this.showSchedulerStatus();
        break;
      case 'triggerSync':
        await this.triggerSync();
        break;
      case 'queueStatus':
        await this.showQueueStatus();
        break;
      case 'detailedHealth':
        await this.showDetailedHealth();
        break;
      case 'dockerStatus':
        await this.showDockerStatus();
        break;
      case 'envCheck':
        await this.checkEnvironment();
        break;
      case 'checkDependencies':
        await this.checkDependencies();
        break;
      case 'viewLogs':
        await this.viewLogs();
        break;
      default:
        console.log(`${this.c.error}Bilinmeyen action: ${action}${this.c.reset}`);
    }
  }

  async runProfile(profileKey) {
    const c = this.c;
    const profile = profiles[profileKey];

    this.showCursor();
    this.clearScreen();

    console.log(`${c.bgCyan}${c.white}${c.bold} 👤 PROFİL: ${profile.name} ${c.reset}\n`);
    console.log(`${c.dim}${profile.description}${c.reset}\n`);

    for (let i = 0; i < profile.commands.length; i++) {
      const cmd = profile.commands[i];
      console.log(`${c.primary}[${i + 1}/${profile.commands.length}] ${cmd.cmd.join(' ')}${c.reset}`);

      try {
        execSync(cmd.cmd.join(' '), { cwd: cmd.cwd, stdio: 'inherit' });
        console.log(`${c.success}✓ Tamamlandı${c.reset}\n`);
      } catch (error) {
        console.log(`${c.error}✗ Hata: ${error.message}${c.reset}\n`);
        break;
      }
    }

    this.mode = 'normal';
    this.waitForEnter();
  }

  async runPipeline(pipelineKey) {
    const c = this.c;
    const pipeline = pipelines[pipelineKey];

    this.showCursor();
    this.clearScreen();

    console.log(`${c.bgGreen}${c.white}${c.bold} 🔄 PIPELINE: ${pipeline.name} ${c.reset}\n`);
    console.log(`${c.dim}${pipeline.description}${c.reset}\n`);

    const results = [];

    for (let i = 0; i < pipeline.steps.length; i++) {
      const step = pipeline.steps[i];
      console.log(`${c.primary}[${i + 1}/${pipeline.steps.length}] ${step.label}${c.reset}`);
      console.log(`${c.dim}  > ${step.cmd.join(' ')}${c.reset}`);

      const startTime = Date.now();

      try {
        execSync(step.cmd.join(' '), { cwd: step.cwd, stdio: 'inherit' });
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`${c.success}✓ Tamamlandı (${duration}s)${c.reset}\n`);
        results.push({ step: step.label, success: true, duration });
      } catch (error) {
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`${c.error}✗ Hata (${duration}s)${c.reset}\n`);
        results.push({ step: step.label, success: false, duration });

        // Hata durumunda devam et mi sor
        const continueAnyway = await this.confirm('Hata oluştu. Devam etmek istiyor musunuz?');
        if (!continueAnyway) break;
      }
    }

    // Özet
    console.log(`\n${c.bold}═══ ÖZET ═══${c.reset}`);
    const successCount = results.filter(r => r.success).length;
    console.log(`${c.success}Başarılı: ${successCount}${c.reset} / ${c.dim}${results.length}${c.reset}`);

    this.mode = 'normal';
    this.waitForEnter();
  }

  async startEverything() {
    const c = this.c;
    this.showCursor();
    this.clearScreen();

    console.log(`${c.success}${c.bold}🎯 HER ŞEYİ BAŞLAT${c.reset}\n`);
    console.log(`${c.primary}Orchestrator ile tüm servisler başlatılıyor...${c.reset}\n`);

    const child = spawn('node', ['scripts/start-all.js', '--dev'], {
      cwd: projectRoot,
      stdio: 'inherit',
    });

    child.on('close', async () => {
      await sendNotification('Catering Pro', 'Tüm servisler başlatıldı!');
      this.waitForEnter();
    });
  }

  async showServiceStatus() {
    const c = this.c;
    this.showCursor();
    this.clearScreen();

    console.log(`${c.success}${c.bold}📊 SERVİS DURUMU${c.reset}\n`);

    const child = spawn('node', ['scripts/services/health-checker.js'], {
      cwd: projectRoot,
      stdio: 'inherit',
    });

    child.on('close', () => {
      this.waitForEnter();
    });
  }

  async showRealtimeStatus() {
    const c = this.c;
    this.showCursor();
    this.clearScreen();

    console.log(`${c.success}${c.bold}📡 REALTIME DURUMU${c.reset}\n`);

    try {
      const response = await fetch('http://localhost:3001/api/system/health/detailed', {
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`${c.bold}Realtime:${c.reset}`);
        console.log(`  Enabled: ${data.realtime?.enabled ? c.success + 'Evet' : c.error + 'Hayır'}${c.reset}`);
        console.log(`  Connected: ${data.realtime?.connected ? c.success + 'Evet' : c.error + 'Hayır'}${c.reset}`);
        console.log(`  Channels: ${data.realtime?.channels || 0}`);
      } else {
        console.log(`${c.warning}Realtime bilgisi alınamadı.${c.reset}`);
      }
    } catch (error) {
      console.log(`${c.error}Backend'e bağlanılamadı: ${error.message}${c.reset}`);
    }

    this.waitForEnter();
  }

  async showSchedulerStatus() {
    const c = this.c;
    this.showCursor();
    this.clearScreen();

    console.log(`${c.success}${c.bold}⏱️ SCHEDULER DURUMU${c.reset}\n`);

    try {
      const response = await fetch('http://localhost:3001/api/system/schedulers', {
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        const data = await response.json();

        for (const [name, status] of Object.entries(data.schedulers || {})) {
          const icon = status.isRunning ? '🟢' : '⚪';
          console.log(`${icon} ${c.bold}${status.name || name}${c.reset}`);
          console.log(`   Durum: ${status.isRunning ? c.success + 'Çalışıyor' : c.dim + 'Hazır'}${c.reset}`);
          console.log(`   Son Çalışma: ${status.lastRun || 'Hiç'}`);
          console.log('');
        }
      } else {
        console.log(`${c.warning}Scheduler bilgisi alınamadı. Backend çalışıyor mu?${c.reset}`);
      }
    } catch (error) {
      console.log(`${c.error}Backend'e bağlanılamadı: ${error.message}${c.reset}`);
    }

    this.waitForEnter();
  }

  async triggerSync() {
    const c = this.c;
    this.showCursor();
    this.clearScreen();

    console.log(`${c.success}${c.bold}🔄 MANUEL SYNC${c.reset}\n`);

    try {
      const response = await fetch('http://localhost:3001/api/system/schedulers/sync/trigger', {
        method: 'POST',
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        console.log(`${c.success}✅ Sync tetiklendi!${c.reset}`);
      } else {
        console.log(`${c.warning}Sync tetiklenemedi. Backend'i kontrol edin.${c.reset}`);
      }
    } catch (error) {
      console.log(`${c.error}Backend'e bağlanılamadı: ${error.message}${c.reset}`);
    }

    this.waitForEnter();
  }

  async showQueueStatus() {
    const c = this.c;
    this.showCursor();
    this.clearScreen();

    console.log(`${c.success}${c.bold}📦 QUEUE DURUMU${c.reset}\n`);

    try {
      const response = await fetch('http://localhost:3001/api/system/health/detailed', {
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`Kuyrukta: ${data.queues?.pending || 0}`);
        console.log(`İşleniyor: ${data.queues?.processing || 0}`);
        console.log(`Tamamlanan: ${data.queues?.completed || 0}`);
      } else {
        console.log(`${c.warning}Queue bilgisi alınamadı.${c.reset}`);
      }
    } catch (error) {
      console.log(`${c.error}Backend'e bağlanılamadı: ${error.message}${c.reset}`);
    }

    this.waitForEnter();
  }

  async showDetailedHealth() {
    const c = this.c;
    this.showCursor();
    this.clearScreen();

    console.log(`${c.success}${c.bold}🏥 DETAYLI HEALTH CHECK${c.reset}\n`);

    try {
      const response = await fetch('http://localhost:3001/api/system/health/detailed', {
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) {
        const data = await response.json();

        console.log(`${c.bold}Sistem:${c.reset}`);
        console.log(`  Platform: ${data.system?.platform}`);
        console.log(`  Node: ${data.system?.nodeVersion}`);
        console.log(`  Uptime: ${data.system?.processUptime}s`);
        console.log(`  Memory: ${Math.round(data.system?.process?.memory?.heapUsed / 1024 / 1024)}MB`);

        console.log(`\n${c.bold}Database:${c.reset}`);
        console.log(`  Connected: ${data.database?.connected ? c.success + 'Evet' : c.error + 'Hayır'}${c.reset}`);

        console.log(`\n${c.bold}Realtime:${c.reset}`);
        console.log(`  Enabled: ${data.realtime?.enabled ? 'Evet' : 'Hayır'}`);
        console.log(`  Connected: ${data.realtime?.connected ? 'Evet' : 'Hayır'}`);
      } else {
        console.log(`${c.warning}Health bilgisi alınamadı.${c.reset}`);
      }
    } catch (error) {
      console.log(`${c.error}Backend'e bağlanılamadı: ${error.message}${c.reset}`);
    }

    this.waitForEnter();
  }

  async showDockerStatus() {
    const c = this.c;
    this.showCursor();
    this.clearScreen();

    console.log(`${c.success}${c.bold}🐳 DOCKER DURUMU${c.reset}\n`);

    try {
      const output = execSync('docker ps -a --filter "name=catering_" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"', {
        encoding: 'utf-8',
      });
      console.log(output || 'Catering container bulunamadı.');
    } catch (error) {
      console.log(`${c.warning}Docker çalışmıyor veya yüklü değil.${c.reset}`);
    }

    this.waitForEnter();
  }

  async checkEnvironment() {
    const c = this.c;
    this.showCursor();
    this.clearScreen();

    console.log(`${c.success}${c.bold}🔐 ENVIRONMENT KONTROLÜ${c.reset}\n`);

    const child = spawn('node', ['scripts/services/env-validator.js'], {
      cwd: projectRoot,
      stdio: 'inherit',
    });

    child.on('close', () => {
      this.waitForEnter();
    });
  }

  async checkDependencies() {
    const c = this.c;
    this.showCursor();
    this.clearScreen();

    console.log(`${c.success}${c.bold}📦 BAĞIMLILIK KONTROLÜ${c.reset}\n`);

    console.log(`${c.primary}Backend outdated packages:${c.reset}`);
    try {
      execSync('npm outdated', { cwd: path.join(projectRoot, 'backend'), stdio: 'inherit' });
    } catch {}

    console.log(`\n${c.primary}Frontend outdated packages:${c.reset}`);
    try {
      execSync('npm outdated', { cwd: path.join(projectRoot, 'frontend'), stdio: 'inherit' });
    } catch {}

    this.waitForEnter();
  }

  async viewLogs() {
    this.mode = 'logs';
    await this.renderLogsMode();
  }

  async viewLastReport() {
    const c = this.c;
    const outputDir = path.join(__dirname, 'output');

    try {
      const files = await fs.readdir(outputDir);
      const jsonFiles = files.filter((f) => f.endsWith('.json')).sort().reverse();

      if (jsonFiles.length === 0) {
        this.clearScreen();
        console.log(`${c.warning}Henüz rapor oluşturulmamış.${c.reset}`);
        console.log(`${c.dim}Önce bir denetim çalıştırın.${c.reset}`);
        this.waitForEnter();
        return;
      }

      const latestReport = path.join(outputDir, jsonFiles[0]);
      const content = await fs.readFile(latestReport, 'utf-8');
      const report = JSON.parse(content);

      this.clearScreen();
      console.log(`${c.success}${c.bold}📊 Son Denetim Raporu${c.reset}`);
      console.log(`${c.dim}Dosya: ${jsonFiles[0]}${c.reset}\n`);

      console.log(`${c.bold}Özet:${c.reset}`);
      console.log(`  Toplam Kontrol: ${report.summary.totalChecks}`);
      console.log(`  ${c.success}✅ Başarılı: ${report.summary.passed}${c.reset}`);
      console.log(`  ${c.error}❌ Hata: ${report.summary.errors}${c.reset}`);
      console.log(`  ${c.warning}⚠️  Uyarı: ${report.summary.warnings}${c.reset}`);
      console.log(`  Süre: ${(report.meta.duration / 1000).toFixed(2)}s`);

      if (report.recommendations?.length > 0) {
        console.log(`\n${c.bold}Öneriler:${c.reset}`);
        report.recommendations.slice(0, 5).forEach((rec, i) => {
          const icon = rec.priority === 'high' ? '🔴' : '🟡';
          console.log(`  ${i + 1}. ${icon} ${rec.action}`);
        });
      }

      console.log(`\n${c.dim}Tam rapor: ${latestReport}${c.reset}`);
      this.waitForEnter();
    } catch (error) {
      console.error(`${c.error}Rapor okunamadı: ${error.message}${c.reset}`);
      this.waitForEnter();
    }
  }

  async dbStatus() {
    const c = this.c;
    this.showCursor();
    this.clearScreen();

    console.log(`${c.success}${c.bold}📊 DATABASE DURUMU${c.reset}\n`);

    try {
      const response = await fetch('http://localhost:3001/api/system/health/detailed', {
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`${c.bold}Database:${c.reset}`);
        console.log(`  Connected: ${data.database?.connected ? c.success + '✓ Bağlı' : c.error + '✗ Bağlı Değil'}${c.reset}`);
        console.log(`  Type: Supabase (PostgreSQL)`);
      } else {
        console.log(`${c.warning}Database bilgisi alınamadı.${c.reset}`);
      }
    } catch (error) {
      console.log(`${c.error}Backend'e bağlanılamadı: ${error.message}${c.reset}`);
    }

    this.waitForEnter();
  }

  async dbMigrations() {
    const c = this.c;
    this.showCursor();
    this.clearScreen();

    console.log(`${c.success}${c.bold}📋 MIGRATION LİSTESİ${c.reset}\n`);
    console.log(`${c.dim}Supabase Dashboard'dan migration'ları görüntüleyebilirsiniz.${c.reset}`);
    console.log(`${c.dim}https://supabase.com/dashboard/project/[project-id]/database/migrations${c.reset}\n`);

    // Migration dosyalarını listele
    const migrationsDir = path.join(projectRoot, 'supabase', 'migrations');
    try {
      const files = await fs.readdir(migrationsDir);
      const sqlFiles = files.filter(f => f.endsWith('.sql')).sort();

      if (sqlFiles.length > 0) {
        console.log(`${c.bold}Lokal Migration Dosyaları:${c.reset}`);
        sqlFiles.forEach((file, i) => {
          console.log(`  ${i + 1}. ${file}`);
        });
      }
    } catch {
      console.log(`${c.warning}Migration klasörü bulunamadı.${c.reset}`);
    }

    this.waitForEnter();
  }

  async openSupabaseStudio() {
    const c = this.c;
    this.showCursor();
    this.clearScreen();

    console.log(`${c.success}${c.bold}🖥️ SUPABASE STUDIO${c.reset}\n`);

    // .env'den Supabase URL'i al
    try {
      const envPath = path.join(projectRoot, 'backend', '.env');
      const envContent = await fs.readFile(envPath, 'utf-8');
      const match = envContent.match(/SUPABASE_URL=(.+)/);

      if (match) {
        const supabaseUrl = match[1].trim();
        const projectRef = supabaseUrl.match(/https:\/\/(.+)\.supabase\.co/)?.[1];

        if (projectRef) {
          const dashboardUrl = `https://supabase.com/dashboard/project/${projectRef}`;
          console.log(`${c.primary}Dashboard URL: ${dashboardUrl}${c.reset}\n`);

          // macOS'ta tarayıcıda aç
          if (process.platform === 'darwin') {
            execSync(`open "${dashboardUrl}"`);
            console.log(`${c.success}✓ Tarayıcıda açıldı${c.reset}`);
          } else {
            console.log(`${c.dim}URL'i tarayıcınızda açın.${c.reset}`);
          }
        }
      } else {
        console.log(`${c.warning}SUPABASE_URL bulunamadı.${c.reset}`);
      }
    } catch (error) {
      console.log(`${c.error}Hata: ${error.message}${c.reset}`);
    }

    this.waitForEnter();
  }

  async dbBackup() {
    const c = this.c;
    this.showCursor();
    this.clearScreen();

    console.log(`${c.success}${c.bold}💾 DATABASE BACKUP${c.reset}\n`);
    console.log(`${c.warning}Supabase projelerinde backup işlemi Dashboard üzerinden yapılır.${c.reset}\n`);
    console.log(`${c.dim}1. Supabase Dashboard'a gidin${c.reset}`);
    console.log(`${c.dim}2. Settings > Database > Backups${c.reset}`);
    console.log(`${c.dim}3. "Download backup" butonuna tıklayın${c.reset}\n`);

    // Dashboard'u aç
    const shouldOpen = await this.confirm('Supabase Dashboard\'u açmak ister misiniz?');
    if (shouldOpen) {
      await this.openSupabaseStudio();
      return;
    }

    this.waitForEnter();
  }

  async dbReset() {
    const c = this.c;
    this.showCursor();
    this.clearScreen();

    console.log(`${c.bgRed}${c.white}${c.bold} ⚠️  DATABASE RESET ${c.reset}\n`);
    console.log(`${c.error}Bu işlem TÜM VERİLERİ SİLECEK!${c.reset}\n`);
    console.log(`${c.warning}Supabase'de bu işlem Dashboard üzerinden yapılmalıdır:${c.reset}`);
    console.log(`${c.dim}1. Settings > Database${c.reset}`);
    console.log(`${c.dim}2. "Reset database" bölümü${c.reset}\n`);

    this.waitForEnter();
  }

  async reinstallModules() {
    const c = this.c;
    this.showCursor();
    this.clearScreen();

    console.log(`${c.warning}${c.bold}📦 Node Modules Yeniden Kurulum${c.reset}\n`);

    const commands = [
      { label: 'Backend node_modules siliniyor...', cmd: 'rm -rf backend/node_modules' },
      { label: 'Frontend node_modules siliniyor...', cmd: 'rm -rf frontend/node_modules' },
      { label: 'Backend bağımlılıkları kuruluyor...', cmd: 'cd backend && npm install' },
      { label: 'Frontend bağımlılıkları kuruluyor...', cmd: 'cd frontend && npm install' },
    ];

    for (const { label, cmd } of commands) {
      console.log(`${c.primary}${label}${c.reset}`);
      try {
        execSync(cmd, { cwd: projectRoot, stdio: 'inherit', shell: true });
        console.log(`${c.success}✅ Tamamlandı${c.reset}\n`);
      } catch (error) {
        console.log(`${c.error}❌ Hata: ${error.message}${c.reset}\n`);
      }
    }

    console.log(`\n${c.success}${c.bold}✅ Yeniden kurulum tamamlandı!${c.reset}`);
    await sendNotification('Catering Pro', 'Node modules yeniden kuruldu!');
    this.waitForEnter();
  }

  waitForEnter() {
    const c = this.c;
    console.log(`\n${c.dim}Menüye dönmek için Enter'a basın...${c.reset}`);

    const handler = (str, key) => {
      if (key.name === 'return') {
        process.stdin.removeListener('keypress', handler);
        this.hideCursor();
        this.mode = 'normal';
        this.render();
      }
    };
    process.stdin.on('keypress', handler);
  }

  exit() {
    this.running = false;
    if (this.watchdogInterval) {
      clearInterval(this.watchdogInterval);
    }
    this.showCursor();
    this.clearScreen();
    console.log(`${this.c.success}👋 Güle güle!${this.c.reset}\n`);
    process.exit(0);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ANA ÇALIŞTIRMA
// ═══════════════════════════════════════════════════════════════════════════

const menu = new InteractiveMenu();
menu.run().catch(console.error);
