#!/usr/bin/env node
/**
 * Catering Pro - İnteraktif Geliştirici Menüsü v2.0
 * Geliştirilmiş servis yönetimi, realtime izleme ve Docker desteği
 *
 * Ok tuşları ile gezin, Enter ile seçin
 */

import readline from 'readline';
import { spawn, execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import net from 'net';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

// ANSI renk kodları
const c = {
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
};

// Port tanımları
const PORTS = {
  frontend: 3000,
  backend: 3001,
  whatsapp: 3002,
  postgres: 5432,
};

// Docker kurulu mu kontrol
function isDockerAvailable() {
  try {
    execSync('docker info 2>/dev/null', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

// Port kontrolü
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

// Temel kategoriler
const baseCategories = [
  {
    name: '🔍 DENETİM',
    color: c.cyan,
    items: [
      {
        label: 'Tüm Denetimleri Çalıştır',
        icon: '🔍',
        description: 'Kod kalitesi, güvenlik ve altyapı kontrollerinin hepsi',
        command: ['node', 'scripts/audit/audit.js', '--verbose'],
        cwd: projectRoot,
      },
      {
        label: 'Kod Kalitesi',
        icon: '📝',
        description: 'Lint, dead code, complexity, API tutarlılığı',
        command: ['node', 'scripts/audit/audit.js', '--category=code-quality', '--verbose'],
        cwd: projectRoot,
      },
      {
        label: 'Güvenlik',
        icon: '🔒',
        description: 'Bağımlılıklar, gizli anahtarlar, auth, input validation',
        command: ['node', 'scripts/audit/audit.js', '--category=security', '--verbose'],
        cwd: projectRoot,
      },
      {
        label: 'Altyapı',
        icon: '🏗️',
        description: 'Build, database, log analizi, performans',
        command: ['node', 'scripts/audit/audit.js', '--category=infrastructure', '--verbose'],
        cwd: projectRoot,
      },
      {
        label: 'Gizli Anahtar Taraması',
        icon: '🔑',
        description: 'Kodda hardcoded secret tespit et',
        command: ['node', 'scripts/audit/audit.js', '--check=secrets', '--verbose'],
        cwd: projectRoot,
      },
      {
        label: 'SQL Injection Kontrolü',
        icon: '💉',
        description: 'Input validation ve SQL injection riskleri',
        command: ['node', 'scripts/audit/audit.js', '--check=input-validation', '--verbose'],
        cwd: projectRoot,
      },
      {
        label: 'Son Raporu Görüntüle',
        icon: '📊',
        action: 'viewLastReport',
      },
    ],
  },
  {
    name: '🚀 SERVİSLER',
    color: c.green,
    items: [
      {
        label: '🎯 HER ŞEYİ BAŞLAT',
        icon: '🚀',
        description: 'Pre-flight check + sıralı başlatma + health verify',
        action: 'startEverything',
        highlight: true,
      },
      {
        label: 'Tümünü Yeniden Başlat',
        icon: '🔄',
        description: 'stop → clean → start (temiz başlatma)',
        command: ['./service.sh', 'restart'],
        cwd: projectRoot,
      },
      {
        label: 'Servisleri Başlat',
        icon: '▶️',
        description: 'Backend + Frontend başlat',
        command: ['./service.sh', 'start'],
        cwd: projectRoot,
      },
      {
        label: 'Servisleri Durdur',
        icon: '⏹️',
        description: 'Tüm servisleri durdur',
        command: ['./service.sh', 'stop'],
        cwd: projectRoot,
      },
      {
        label: 'Durum Kontrolü',
        icon: '📊',
        description: 'Servislerin çalışma durumu',
        action: 'serviceStatus',
      },
      {
        label: 'Canlı Loglar',
        icon: '📜',
        description: 'Log takibi (Ctrl+C ile çık)',
        command: ['./service.sh', 'logs'],
        cwd: projectRoot,
      },
      {
        label: 'Sadece Backend Yenile',
        icon: '🔙',
        description: 'Backend servisini yeniden başlat',
        command: ['./service.sh', 'backend'],
        cwd: projectRoot,
      },
      {
        label: 'Sadece Frontend Yenile',
        icon: '🖥️',
        description: 'Frontend servisini yeniden başlat',
        command: ['./service.sh', 'frontend'],
        cwd: projectRoot,
      },
    ],
  },
  {
    name: '🔄 REALTIME',
    color: c.cyan,
    items: [
      {
        label: 'Realtime Durumu',
        icon: '📡',
        description: 'Supabase realtime bağlantı durumu',
        action: 'realtimeStatus',
      },
      {
        label: 'Scheduler Durumu',
        icon: '⏱️',
        description: 'Sync ve tender scheduler durumları',
        action: 'schedulerStatus',
      },
      {
        label: 'Manuel Sync Tetikle',
        icon: '🔄',
        description: 'Uyumsoft fatura senkronizasyonu',
        action: 'triggerSync',
        dangerous: true,
        confirmMessage: 'Fatura senkronizasyonu başlatılacak.',
      },
      {
        label: 'Queue Durumu',
        icon: '📦',
        description: 'Döküman işleme kuyruğu',
        action: 'queueStatus',
      },
      {
        label: 'Health Check (Detaylı)',
        icon: '🏥',
        description: 'Tüm sistemlerin detaylı sağlık kontrolü',
        action: 'detailedHealth',
      },
    ],
  },
  {
    name: '🧹 CACHE',
    color: c.yellow,
    items: [
      {
        label: 'Hızlı Temizlik',
        icon: '🧹',
        description: 'Cache temizle (.next silmez)',
        command: ['./service.sh', 'clean'],
        cwd: projectRoot,
      },
      {
        label: 'Hard Temizlik',
        icon: '💥',
        description: '.next + cache tamamen sil',
        command: ['./service.sh', 'clean:hard'],
        cwd: projectRoot,
        dangerous: true,
        confirmMessage: '.next klasörü silinecek. İlk build daha uzun sürecek.',
      },
      {
        label: 'Temiz Dev Başlat',
        icon: '🚀',
        description: 'Clean + Dev mode başlat',
        command: ['npm', 'run', 'dev:clean'],
        cwd: path.join(projectRoot, 'frontend'),
      },
      {
        label: 'Temiz Build',
        icon: '📦',
        description: 'Clean + Production build',
        command: ['npm', 'run', 'build:clean'],
        cwd: path.join(projectRoot, 'frontend'),
      },
    ],
  },
  {
    name: '🗄️ DATABASE',
    color: c.magenta,
    items: [
      {
        label: 'Migration Çalıştır',
        icon: '📤',
        description: 'Bekleyen migration\'ları uygula',
        command: ['npm', 'run', 'migrate'],
        cwd: path.join(projectRoot, 'backend'),
      },
      {
        label: 'Migration Durumu',
        icon: '📋',
        description: 'Uygulanan migration\'ları listele',
        command: ['node', 'src/migrate.js', '--status'],
        cwd: path.join(projectRoot, 'backend'),
      },
      {
        label: 'Database Backup',
        icon: '💾',
        description: 'Veritabanını yedekle',
        action: 'dbBackup',
      },
      {
        label: 'Database Reset',
        icon: '⚠️',
        description: 'TÜM VERİLERİ SİL ve sıfırla',
        action: 'dbReset',
        dangerous: true,
        confirmMessage: 'TÜM VERİLER SİLİNECEK! Bu işlem geri alınamaz.',
      },
    ],
  },
  {
    name: '🧪 TEST',
    color: c.blue,
    items: [
      {
        label: 'Testleri Çalıştır',
        icon: '🧪',
        description: 'Jest testlerini çalıştır',
        command: ['npm', 'test'],
        cwd: path.join(projectRoot, 'backend'),
      },
      {
        label: 'Test Coverage',
        icon: '📈',
        description: 'Coverage raporu ile test',
        command: ['npm', 'run', 'test:coverage'],
        cwd: path.join(projectRoot, 'backend'),
      },
      {
        label: 'TypeScript Check',
        icon: '📘',
        description: 'Type hatalarını kontrol et',
        command: ['npm', 'run', 'type-check'],
        cwd: path.join(projectRoot, 'frontend'),
      },
      {
        label: 'Production Build',
        icon: '📦',
        description: 'Next.js production build',
        command: ['npm', 'run', 'build'],
        cwd: path.join(projectRoot, 'frontend'),
      },
      {
        label: 'Lint (Backend)',
        icon: '🔧',
        description: 'Backend Biome lint',
        command: ['npm', 'run', 'lint'],
        cwd: path.join(projectRoot, 'backend'),
      },
      {
        label: 'Lint (Frontend)',
        icon: '🔧',
        description: 'Frontend Biome lint',
        command: ['npm', 'run', 'lint'],
        cwd: path.join(projectRoot, 'frontend'),
      },
      {
        label: 'Lint Fix (Tümü)',
        icon: '✨',
        description: 'Otomatik lint düzeltme',
        command: ['npm', 'run', 'lint:fix'],
        cwd: projectRoot,
      },
    ],
  },
  {
    name: '📂 GIT',
    color: c.white,
    items: [
      {
        label: 'Git Status',
        icon: '📋',
        description: 'Değişiklikleri göster',
        command: ['git', 'status'],
        cwd: projectRoot,
      },
      {
        label: 'Git Diff',
        icon: '📝',
        description: 'Değişiklik detayları',
        command: ['git', 'diff', '--stat'],
        cwd: projectRoot,
      },
      {
        label: 'Git Pull',
        icon: '⬇️',
        description: 'Remote\'dan güncelle',
        command: ['git', 'pull'],
        cwd: projectRoot,
      },
      {
        label: 'Git Log (Son 10)',
        icon: '📜',
        description: 'Son commit\'leri göster',
        command: ['git', 'log', '--oneline', '-10'],
        cwd: projectRoot,
      },
      {
        label: 'Branch Bilgisi',
        icon: '🌿',
        description: 'Mevcut branch ve remote',
        command: ['git', 'branch', '-vv'],
        cwd: projectRoot,
      },
    ],
  },
  {
    name: '🆘 ACİL',
    color: c.red,
    items: [
      {
        label: 'Portları Temizle',
        icon: '🔌',
        description: '3000, 3001, 3002 portlarını zorla kapat',
        command: ['bash', '-c', 'lsof -ti:3000,3001,3002 | xargs kill -9 2>/dev/null || echo "Açık port yok"'],
        cwd: projectRoot,
        dangerous: true,
        confirmMessage: 'Portlar zorla kapatılacak. Çalışan servisler duracak.',
      },
      {
        label: 'Tam Sıfırlama',
        icon: '🔥',
        description: 'Stop + Clean:hard + Start',
        command: ['bash', '-c', './service.sh stop && ./service.sh clean:hard && ./service.sh start'],
        cwd: projectRoot,
        dangerous: true,
        confirmMessage: 'Tüm cache silinip servisler yeniden başlatılacak.',
      },
      {
        label: 'Node Modules Yenile',
        icon: '📦',
        description: 'node_modules sil ve yeniden yükle',
        action: 'reinstallModules',
        dangerous: true,
        confirmMessage: 'node_modules silinip yeniden kurulacak. Bu uzun sürebilir.',
      },
      {
        label: 'Environment Kontrolü',
        icon: '🔐',
        description: 'Gerekli environment değişkenlerini kontrol et',
        action: 'envCheck',
      },
    ],
  },
];

// Docker kategorisi (sadece Docker varsa)
const dockerCategory = {
  name: '🐳 DOCKER',
  color: c.blue,
  items: [
    {
      label: 'Container Durumu',
      icon: '📦',
      description: 'Catering container\'larının durumu',
      action: 'dockerStatus',
    },
    {
      label: 'Compose Up',
      icon: '▶️',
      description: 'Tüm Docker servislerini başlat',
      command: ['docker-compose', 'up', '-d'],
      cwd: projectRoot,
    },
    {
      label: 'Compose Down',
      icon: '⏹️',
      description: 'Tüm Docker servislerini durdur',
      command: ['docker-compose', 'down'],
      cwd: projectRoot,
    },
    {
      label: 'PostgreSQL Logları',
      icon: '🗄️',
      description: 'PostgreSQL container logları',
      command: ['docker', 'logs', '-f', '--tail', '100', 'catering_postgres'],
      cwd: projectRoot,
    },
    {
      label: 'WhatsApp Logları',
      icon: '📱',
      description: 'WhatsApp container logları',
      command: ['docker', 'logs', '-f', '--tail', '100', 'catering_whatsapp'],
      cwd: projectRoot,
    },
    {
      label: 'Compose Restart',
      icon: '🔄',
      description: 'Tüm container\'ları yeniden başlat',
      command: ['docker-compose', 'restart'],
      cwd: projectRoot,
      dangerous: true,
      confirmMessage: 'Tüm Docker container\'ları yeniden başlatılacak.',
    },
  ],
};

class InteractiveMenu {
  constructor() {
    this.categoryIndex = 0;
    this.itemIndex = 0;
    this.running = true;
    this.menuCategories = [...baseCategories];
    this.serviceStatus = {};

    // Docker varsa kategori ekle
    if (isDockerAvailable()) {
      // ACİL'den önce ekle
      this.menuCategories.splice(this.menuCategories.length - 1, 0, dockerCategory);
    }
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

  // Servis durumlarını güncelle
  async updateServiceStatus() {
    this.serviceStatus = {
      backend: await checkPort(PORTS.backend),
      frontend: await checkPort(PORTS.frontend),
      whatsapp: await checkPort(PORTS.whatsapp),
      postgres: await checkPort(PORTS.postgres),
    };
  }

  // Canlı durum header'ı
  renderStatusHeader() {
    const indicators = [];

    for (const [name, isUp] of Object.entries(this.serviceStatus)) {
      const icon = isUp ? '●' : '○';
      const color = isUp ? c.green : c.red;
      indicators.push(`${color}${icon}${c.reset} ${name}`);
    }

    console.log(`${c.dim}┌─ SERVİS DURUMU ────────────────────────────────────────────────┐${c.reset}`);
    console.log(`${c.dim}│${c.reset}  ${indicators.join('  │  ')}  ${c.dim}│${c.reset}`);
    console.log(`${c.dim}└────────────────────────────────────────────────────────────────┘${c.reset}`);
  }

  async render() {
    this.clearScreen();

    // Servis durumlarını güncelle
    await this.updateServiceStatus();

    // Header
    console.log(`${c.bgBlue}${c.white}${c.bold}`);
    console.log('  ╔═══════════════════════════════════════════════════════════════╗  ');
    console.log('  ║          🚀 CATERING PRO - GELİŞTİRİCİ ARAÇLARI 🚀            ║  ');
    console.log('  ╚═══════════════════════════════════════════════════════════════╝  ');
    console.log(`${c.reset}\n`);

    // Canlı durum header'ı
    this.renderStatusHeader();

    // Navigasyon bilgisi
    console.log(`\n${c.dim}  ←/→: Kategori  │  ↑/↓: Öğe  │  Enter: Çalıştır  │  r: Yenile  │  q: Çıkış${c.reset}\n`);

    // Kategori tabs
    let tabLine = '  ';
    this.menuCategories.forEach((cat, idx) => {
      if (idx === this.categoryIndex) {
        tabLine += `${c.bgBlue}${c.white}${c.bold} ${cat.name} ${c.reset} `;
      } else {
        tabLine += `${c.dim} ${cat.name} ${c.reset} `;
      }
    });
    console.log(tabLine);
    console.log(`${c.dim}  ${'─'.repeat(65)}${c.reset}\n`);

    // Kategori öğeleri
    const category = this.getCurrentCategory();

    category.items.forEach((item, idx) => {
      const isSelected = idx === this.itemIndex;
      const dangerIcon = item.dangerous ? `${c.red}⚠️ ${c.reset}` : '';
      const highlightBg = item.highlight && isSelected ? c.bgGreen : '';

      if (isSelected) {
        console.log(`${highlightBg}${c.cyan}  ❯ ${item.icon} ${c.bold}${item.label}${c.reset} ${dangerIcon}`);
        if (item.description) {
          console.log(`${c.cyan}      ${c.dim}${item.description}${c.reset}`);
        }
      } else {
        console.log(`${c.reset}    ${item.icon} ${item.label} ${dangerIcon}`);
      }
    });

    // Footer
    console.log(`\n${c.dim}  ─────────────────────────────────────────────────────────────────${c.reset}`);
    console.log(`${c.dim}  Proje: ${projectRoot}${c.reset}`);

    // Quick info
    try {
      const branch = execSync('git branch --show-current', { cwd: projectRoot, encoding: 'utf-8' }).trim();
      console.log(`${c.dim}  Git Branch: ${c.green}${branch}${c.reset}`);
    } catch {}
  }

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
        } else if (str === 'r' || str === 'R') {
          await this.render();
        } else if (key.name === 'q' || (key.ctrl && key.name === 'c')) {
          this.exit();
          resolve();
        }
      });
    });
  }

  async confirm(message) {
    this.showCursor();
    console.log(`\n${c.bgYellow}${c.bold} ⚠️  UYARI ${c.reset}`);
    console.log(`${c.yellow}${message}${c.reset}\n`);
    console.log(`${c.bold}Devam etmek istiyor musunuz? (e/h)${c.reset}`);

    return new Promise((resolve) => {
      const handler = (str, key) => {
        if (key.name === 'e' || str === 'e' || str === 'E') {
          process.stdin.removeListener('keypress', handler);
          resolve(true);
        } else if (key.name === 'h' || str === 'h' || str === 'H' || key.name === 'n') {
          process.stdin.removeListener('keypress', handler);
          resolve(false);
        }
      };
      process.stdin.on('keypress', handler);
    });
  }

  async executeSelection(item) {
    // Tehlikeli işlem kontrolü
    if (item.dangerous) {
      const confirmed = await this.confirm(item.confirmMessage || 'Bu işlem tehlikeli olabilir.');
      if (!confirmed) {
        this.hideCursor();
        await this.render();
        return;
      }
    }

    // Özel action'lar
    if (item.action) {
      await this.handleAction(item.action);
      return;
    }

    this.showCursor();
    this.clearScreen();

    console.log(`${c.green}${c.bold}▶ ${item.icon} ${item.label}${c.reset}\n`);

    // Komutu çalıştır
    const child = spawn(item.command[0], item.command.slice(1), {
      cwd: item.cwd || projectRoot,
      stdio: 'inherit',
      shell: item.command[0] === 'bash',
    });

    child.on('close', async (code) => {
      console.log(`\n${c.dim}─────────────────────────────────────────────${c.reset}`);
      const status = code === 0 ? `${c.green}✅ Başarılı${c.reset}` : `${c.red}❌ Hata (kod: ${code})${c.reset}`;
      console.log(`Sonuç: ${status}`);
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
      default:
        console.log(`${c.red}Bilinmeyen action: ${action}${c.reset}`);
    }
  }

  // Her şeyi başlat
  async startEverything() {
    this.showCursor();
    this.clearScreen();

    console.log(`${c.green}${c.bold}🎯 HER ŞEYİ BAŞLAT${c.reset}\n`);
    console.log(`${c.cyan}Orchestrator ile tüm servisler başlatılıyor...${c.reset}\n`);

    const child = spawn('node', ['scripts/services/orchestrator.js'], {
      cwd: projectRoot,
      stdio: 'inherit',
    });

    child.on('close', async (code) => {
      console.log(`\n${c.dim}Menüye dönmek için Enter'a basın...${c.reset}`);

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

  // Servis durumu göster
  async showServiceStatus() {
    this.showCursor();
    this.clearScreen();

    console.log(`${c.green}${c.bold}📊 SERVİS DURUMU${c.reset}\n`);

    const child = spawn('node', ['scripts/services/health-checker.js'], {
      cwd: projectRoot,
      stdio: 'inherit',
    });

    child.on('close', () => {
      this.waitForEnter();
    });
  }

  // Realtime durumu
  async showRealtimeStatus() {
    this.showCursor();
    this.clearScreen();

    console.log(`${c.green}${c.bold}📡 REALTIME DURUMU${c.reset}\n`);

    const child = spawn('node', ['scripts/services/realtime-manager.js', 'status'], {
      cwd: projectRoot,
      stdio: 'inherit',
    });

    child.on('close', () => {
      this.waitForEnter();
    });
  }

  // Scheduler durumu
  async showSchedulerStatus() {
    this.showCursor();
    this.clearScreen();

    console.log(`${c.green}${c.bold}⏱️ SCHEDULER DURUMU${c.reset}\n`);

    try {
      const response = await fetch('http://localhost:3001/api/system/schedulers', {
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        const data = await response.json();

        for (const [name, status] of Object.entries(data.schedulers || {})) {
          const icon = status.isRunning ? '🟢' : '⚪';
          console.log(`${icon} ${c.bold}${status.name || name}${c.reset}`);
          console.log(`   Durum: ${status.isRunning ? c.green + 'Çalışıyor' : c.dim + 'Hazır'}${c.reset}`);
          console.log(`   Son Çalışma: ${status.lastRun || 'Hiç'}`);
          console.log(`   Başarılı: ${status.stats?.successfulRuns || 0}`);
          console.log(`   Hatalı: ${status.stats?.failedRuns || 0}`);
          console.log('');
        }
      } else {
        console.log(`${c.yellow}Scheduler bilgisi alınamadı. Backend çalışıyor mu?${c.reset}`);
      }
    } catch (error) {
      console.log(`${c.red}Backend'e bağlanılamadı: ${error.message}${c.reset}`);
      console.log(`${c.dim}Backend'in http://localhost:3001 adresinde çalıştığından emin olun.${c.reset}`);
    }

    this.waitForEnter();
  }

  // Sync tetikle
  async triggerSync() {
    this.showCursor();
    this.clearScreen();

    console.log(`${c.green}${c.bold}🔄 MANUEL SYNC${c.reset}\n`);

    try {
      const response = await fetch('http://localhost:3001/api/system/schedulers/sync/trigger', {
        method: 'POST',
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        console.log(`${c.green}✅ Sync tetiklendi!${c.reset}`);
      } else {
        console.log(`${c.yellow}Sync tetiklenemedi. Backend'i kontrol edin.${c.reset}`);
      }
    } catch (error) {
      console.log(`${c.red}Backend'e bağlanılamadı: ${error.message}${c.reset}`);
    }

    this.waitForEnter();
  }

  // Queue durumu
  async showQueueStatus() {
    this.showCursor();
    this.clearScreen();

    console.log(`${c.green}${c.bold}📦 QUEUE DURUMU${c.reset}\n`);

    try {
      const response = await fetch('http://localhost:3001/api/system/schedulers/document-queue', {
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`Kuyrukta: ${data.totalInQueue || 0}`);
        console.log(`İşleniyor: ${data.isProcessing ? 'Evet' : 'Hayır'}`);
      } else {
        console.log(`${c.yellow}Queue bilgisi alınamadı.${c.reset}`);
      }
    } catch (error) {
      console.log(`${c.red}Backend'e bağlanılamadı: ${error.message}${c.reset}`);
    }

    this.waitForEnter();
  }

  // Detaylı health
  async showDetailedHealth() {
    this.showCursor();
    this.clearScreen();

    console.log(`${c.green}${c.bold}🏥 DETAYLI HEALTH CHECK${c.reset}\n`);

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
        console.log(`  Memory: ${data.system?.process?.memory?.heapUsed}MB / ${data.system?.process?.memory?.heapTotal}MB`);

        console.log(`\n${c.bold}Realtime:${c.reset}`);
        console.log(`  Enabled: ${data.realtime?.enabled ? 'Evet' : 'Hayır'}`);
        console.log(`  Connected: ${data.realtime?.connected ? 'Evet' : 'Hayır'}`);
      } else {
        console.log(`${c.yellow}Health bilgisi alınamadı.${c.reset}`);
      }
    } catch (error) {
      console.log(`${c.red}Backend'e bağlanılamadı: ${error.message}${c.reset}`);
    }

    this.waitForEnter();
  }

  // Docker durumu
  async showDockerStatus() {
    this.showCursor();
    this.clearScreen();

    console.log(`${c.green}${c.bold}🐳 DOCKER DURUMU${c.reset}\n`);

    const child = spawn('node', ['scripts/services/docker-manager.js', 'status'], {
      cwd: projectRoot,
      stdio: 'inherit',
    });

    child.on('close', () => {
      this.waitForEnter();
    });
  }

  // Environment kontrolü
  async checkEnvironment() {
    this.showCursor();
    this.clearScreen();

    console.log(`${c.green}${c.bold}🔐 ENVIRONMENT KONTROLÜ${c.reset}\n`);

    const child = spawn('node', ['scripts/services/env-validator.js'], {
      cwd: projectRoot,
      stdio: 'inherit',
    });

    child.on('close', () => {
      this.waitForEnter();
    });
  }

  async viewLastReport() {
    const outputDir = path.join(__dirname, 'output');

    try {
      const files = await fs.readdir(outputDir);
      const jsonFiles = files.filter((f) => f.endsWith('.json')).sort().reverse();

      if (jsonFiles.length === 0) {
        this.clearScreen();
        console.log(`${c.yellow}Henüz rapor oluşturulmamış.${c.reset}`);
        console.log(`${c.dim}Önce bir denetim çalıştırın.${c.reset}`);
        this.waitForEnter();
        return;
      }

      const latestReport = path.join(outputDir, jsonFiles[0]);
      const content = await fs.readFile(latestReport, 'utf-8');
      const report = JSON.parse(content);

      this.clearScreen();
      console.log(`${c.green}${c.bold}📊 Son Denetim Raporu${c.reset}`);
      console.log(`${c.dim}Dosya: ${jsonFiles[0]}${c.reset}\n`);

      console.log(`${c.bold}Özet:${c.reset}`);
      console.log(`  Toplam Kontrol: ${report.summary.totalChecks}`);
      console.log(`  ${c.green}✅ Başarılı: ${report.summary.passed}${c.reset}`);
      console.log(`  ${c.red}❌ Hata: ${report.summary.errors}${c.reset}`);
      console.log(`  ${c.yellow}⚠️  Uyarı: ${report.summary.warnings}${c.reset}`);
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
      console.error(`${c.red}Rapor okunamadı: ${error.message}${c.reset}`);
      this.waitForEnter();
    }
  }

  async dbBackup() {
    this.showCursor();
    this.clearScreen();
    console.log(`${c.green}${c.bold}💾 Database Backup${c.reset}\n`);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = `backup-${timestamp}.sql`;

    console.log(`${c.dim}Backup oluşturuluyor: ${backupFile}${c.reset}\n`);

    try {
      execSync(`pg_dump $DATABASE_URL > ${backupFile}`, {
        cwd: projectRoot,
        stdio: 'inherit',
        shell: true,
      });
      console.log(`\n${c.green}✅ Backup başarılı: ${backupFile}${c.reset}`);
    } catch (error) {
      console.log(`\n${c.yellow}⚠️ pg_dump çalıştırılamadı. Manuel backup alın.${c.reset}`);
      console.log(`${c.dim}Komut: pg_dump $DATABASE_URL > backup.sql${c.reset}`);
    }

    this.waitForEnter();
  }

  async dbReset() {
    this.showCursor();
    this.clearScreen();
    console.log(`${c.bgRed}${c.white}${c.bold} ⚠️  DATABASE RESET ${c.reset}\n`);
    console.log(`${c.red}Bu işlem TÜM VERİLERİ SİLECEK!${c.reset}\n`);
    console.log(`${c.yellow}Önce backup almak ister misiniz? (e/h/iptal için i)${c.reset}`);

    const answer = await new Promise((resolve) => {
      const handler = (str) => {
        process.stdin.removeListener('keypress', handler);
        resolve(str?.toLowerCase());
      };
      process.stdin.on('keypress', handler);
    });

    if (answer === 'i') {
      this.hideCursor();
      await this.render();
      return;
    }

    if (answer === 'e') {
      await this.dbBackup();
    }

    console.log(`\n${c.red}Database sıfırlanıyor...${c.reset}`);
    console.log(`${c.dim}Bu özellik henüz implemente edilmedi.${c.reset}`);
    console.log(`${c.dim}Manuel: DROP SCHEMA public CASCADE; CREATE SCHEMA public;${c.reset}`);

    this.waitForEnter();
  }

  async reinstallModules() {
    this.showCursor();
    this.clearScreen();
    console.log(`${c.yellow}${c.bold}📦 Node Modules Yeniden Kurulum${c.reset}\n`);

    const commands = [
      { label: 'Backend node_modules siliniyor...', cmd: 'rm -rf backend/node_modules' },
      { label: 'Frontend node_modules siliniyor...', cmd: 'rm -rf frontend/node_modules' },
      { label: 'Backend bağımlılıkları kuruluyor...', cmd: 'cd backend && npm install' },
      { label: 'Frontend bağımlılıkları kuruluyor...', cmd: 'cd frontend && npm install' },
    ];

    for (const { label, cmd } of commands) {
      console.log(`${c.cyan}${label}${c.reset}`);
      try {
        execSync(cmd, { cwd: projectRoot, stdio: 'inherit', shell: true });
        console.log(`${c.green}✅ Tamamlandı${c.reset}\n`);
      } catch (error) {
        console.log(`${c.red}❌ Hata: ${error.message}${c.reset}\n`);
      }
    }

    console.log(`\n${c.green}${c.bold}✅ Yeniden kurulum tamamlandı!${c.reset}`);
    this.waitForEnter();
  }

  waitForEnter() {
    console.log(`\n${c.dim}Menüye dönmek için Enter'a basın...${c.reset}`);

    const handler = (str, key) => {
      if (key.name === 'return') {
        process.stdin.removeListener('keypress', handler);
        this.hideCursor();
        this.render();
      }
    };
    process.stdin.on('keypress', handler);
  }

  exit() {
    this.running = false;
    this.showCursor();
    this.clearScreen();
    console.log(`${c.green}👋 Güle güle!${c.reset}\n`);
    process.exit(0);
  }
}

// Ana çalıştırma
const menu = new InteractiveMenu();
menu.run().catch(console.error);
