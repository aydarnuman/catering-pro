#!/usr/bin/env node
/**
 * Catering Pro - Service Orchestrator
 * Tüm servisleri koordineli şekilde yöneten ana modül
 */

import { spawn, execSync } from 'child_process';
import { services, paths, ports, colors, icons, defaults } from './config.js';
import { validateEnvironment, printValidationResult } from './env-validator.js';
import { checkPort, checkHttpHealth, checkAllServices, printHealthReport, getProcessOnPort } from './health-checker.js';
import { isDockerAvailable, composeUp, composeDown, getContainerStatus } from './docker-manager.js';

const c = colors;

/**
 * Service Orchestrator Class
 */
export class Orchestrator {
  constructor(options = {}) {
    this.options = {
      mode: options.mode || 'dev', // dev, prod, docker
      verbose: options.verbose || false,
      skipEnvCheck: options.skipEnvCheck || false,
      skipDocker: options.skipDocker || false,
    };
    this.processes = new Map();
    this.startedServices = [];
  }

  /**
   * Log mesajı yazdır
   */
  log(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString('tr-TR');
    const prefix = `${c.dim}[${timestamp}]${c.reset}`;

    switch (type) {
      case 'success':
        console.log(`${prefix} ${icons.success} ${c.green}${message}${c.reset}`);
        break;
      case 'error':
        console.log(`${prefix} ${icons.error} ${c.red}${message}${c.reset}`);
        break;
      case 'warning':
        console.log(`${prefix} ${icons.warning} ${c.yellow}${message}${c.reset}`);
        break;
      case 'info':
        console.log(`${prefix} ${icons.info} ${message}`);
        break;
      case 'step':
        console.log(`${prefix} ${c.cyan}${c.bold}▶ ${message}${c.reset}`);
        break;
      default:
        console.log(`${prefix} ${message}`);
    }
  }

  /**
   * Başlık yazdır
   */
  printHeader(title) {
    console.log(`\n${c.cyan}${c.bold}═══════════════════════════════════════════════════════════════${c.reset}`);
    console.log(`${c.cyan}${c.bold}       🍽️  CATERING PRO - ${title}${c.reset}`);
    console.log(`${c.cyan}${c.bold}═══════════════════════════════════════════════════════════════${c.reset}\n`);
  }

  /**
   * Pre-flight kontrolleri
   */
  async preFlightChecks() {
    this.printHeader('PRE-FLIGHT CHECKS');

    const checks = {
      environment: null,
      ports: null,
      docker: null,
    };

    // 1. Environment kontrolü
    if (!this.options.skipEnvCheck) {
      this.log('Environment değişkenleri kontrol ediliyor...', 'step');
      checks.environment = await validateEnvironment();

      if (!checks.environment.valid) {
        printValidationResult(checks.environment);
        return { success: false, reason: 'Environment doğrulaması başarısız', checks };
      }

      this.log('Environment doğrulaması başarılı', 'success');
    }

    // 2. Port kontrolü
    this.log('Port durumları kontrol ediliyor...', 'step');
    checks.ports = {};

    for (const [name, service] of Object.entries(services)) {
      if (!service.required) continue;

      const portCheck = await checkPort(service.port);
      checks.ports[name] = portCheck;

      if (portCheck.open) {
        const process = getProcessOnPort(service.port);
        this.log(`Port ${service.port} (${name}) zaten kullanımda${process ? ` - PID: ${process.pid}` : ''}`, 'warning');
      }
    }

    // 3. Docker kontrolü (opsiyonel)
    if (!this.options.skipDocker) {
      this.log('Docker durumu kontrol ediliyor...', 'step');
      checks.docker = {
        available: isDockerAvailable(),
      };

      if (checks.docker.available) {
        this.log('Docker kullanılabilir', 'success');
      } else {
        this.log('Docker kullanılamıyor (opsiyonel)', 'warning');
      }
    }

    console.log(`\n${c.green}${icons.success} Pre-flight kontrolleri tamamlandı${c.reset}\n`);

    return { success: true, checks };
  }

  /**
   * Port'u temizle
   */
  async killPort(port) {
    try {
      execSync(`lsof -ti:${port} | xargs kill -9 2>/dev/null`, { stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Servis için health check bekle
   */
  async waitForHealth(serviceName, timeout = 30000) {
    const service = services[serviceName];
    if (!service || !service.healthCheck) return true;

    const startTime = Date.now();
    const { url, retries = 5, retryDelay = 2000 } = service.healthCheck;

    if (service.healthCheck.type !== 'http') {
      // TCP check
      while (Date.now() - startTime < timeout) {
        const portCheck = await checkPort(service.port);
        if (portCheck.open) return true;
        await new Promise(r => setTimeout(r, 1000));
      }
      return false;
    }

    // HTTP health check
    for (let i = 0; i < retries; i++) {
      if (Date.now() - startTime > timeout) break;

      const result = await checkHttpHealth(url, 5000);
      if (result.healthy) return true;

      if (this.options.verbose) {
        this.log(`${serviceName} health check deneme ${i + 1}/${retries}...`, 'info');
      }

      await new Promise(r => setTimeout(r, retryDelay));
    }

    return false;
  }

  /**
   * Node servisi başlat
   */
  async startNodeService(serviceName) {
    const service = services[serviceName];
    if (!service || service.type !== 'node') {
      return { success: false, error: 'Geçersiz servis' };
    }

    const { cwd, devCommand, devArgs, command, args } = service;
    const isDevMode = this.options.mode === 'dev';
    const cmd = isDevMode ? devCommand : command;
    const cmdArgs = isDevMode ? devArgs : args;

    // Port temizle
    await this.killPort(service.port);
    await new Promise(r => setTimeout(r, 500));

    this.log(`${service.name} başlatılıyor (port ${service.port})...`, 'step');

    return new Promise((resolve) => {
      const child = spawn(cmd, cmdArgs, {
        cwd,
        stdio: this.options.verbose ? 'inherit' : 'pipe',
        detached: true,
        env: { ...process.env, PORT: String(service.port) },
      });

      this.processes.set(serviceName, child);

      child.on('error', (error) => {
        this.log(`${service.name} başlatılamadı: ${error.message}`, 'error');
        resolve({ success: false, error: error.message });
      });

      // Kısa bir süre bekle ve health check yap
      setTimeout(async () => {
        const healthy = await this.waitForHealth(serviceName, service.healthCheck?.timeout || 15000);

        if (healthy) {
          this.startedServices.push(serviceName);
          this.log(`${service.name} başarıyla başlatıldı`, 'success');
          resolve({ success: true, pid: child.pid });
        } else {
          this.log(`${service.name} health check başarısız`, 'error');
          resolve({ success: false, error: 'Health check başarısız' });
        }
      }, 2000);
    });
  }

  /**
   * Docker servisi başlat
   */
  async startDockerService(serviceName) {
    const service = services[serviceName];
    if (!service || service.type !== 'docker') {
      return { success: false, error: 'Geçersiz Docker servisi' };
    }

    if (!isDockerAvailable()) {
      return { success: false, error: 'Docker kullanılamıyor' };
    }

    // Container durumunu kontrol et
    const status = getContainerStatus(service.container);

    if (status.running) {
      this.log(`${service.name} zaten çalışıyor`, 'success');
      return { success: true, alreadyRunning: true };
    }

    this.log(`${service.name} başlatılıyor...`, 'step');

    // docker-compose ile başlat
    try {
      execSync(`docker start ${service.container} 2>/dev/null || docker-compose up -d ${serviceName}`, {
        cwd: paths.root,
        stdio: 'pipe',
      });

      // Health check bekle
      const healthy = await this.waitForHealth(serviceName, 10000);

      if (healthy) {
        this.startedServices.push(serviceName);
        this.log(`${service.name} başarıyla başlatıldı`, 'success');
        return { success: true };
      } else {
        return { success: false, error: 'Health check başarısız' };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Tüm servisleri başlat
   */
  async startAll() {
    this.printHeader('SERVİSLERİ BAŞLAT');

    // Servisleri başlatma sırasına göre sırala
    const sortedServices = Object.entries(services)
      .sort(([, a], [, b]) => a.startOrder - b.startOrder);

    for (const [name, service] of sortedServices) {
      // Bağımlılıkları kontrol et
      if (service.dependencies?.length > 0) {
        for (const dep of service.dependencies) {
          if (!this.startedServices.includes(dep)) {
            const depService = services[dep];
            if (depService?.required) {
              this.log(`${service.name} bağımlılığı ${dep} henüz başlatılmadı`, 'warning');
            }
          }
        }
      }

      // Servisi başlat
      let result;

      if (service.type === 'node') {
        result = await this.startNodeService(name);
      } else if (service.type === 'docker') {
        if (this.options.skipDocker || !isDockerAvailable()) {
          this.log(`${service.name} atlanıyor (Docker yok)`, 'warning');
          continue;
        }
        result = await this.startDockerService(name);
      }

      if (!result?.success && service.required) {
        this.log(`Zorunlu servis ${service.name} başlatılamadı`, 'error');

        // Gerekirse burada durdur
        if (name === 'backend') {
          this.log('Backend başlatılamadığı için frontend atlanıyor', 'warning');
          break;
        }
      }
    }

    console.log('');
  }

  /**
   * Post-start health check
   */
  async postStartHealthCheck() {
    this.printHeader('HEALTH CHECK');

    const results = await checkAllServices();
    printHealthReport(results);

    return results;
  }

  /**
   * Özet göster
   */
  showSummary() {
    console.log(`${c.cyan}───────────────────────────────────────────────────────────────${c.reset}`);
    console.log(`${c.bold}Başlatılan Servisler:${c.reset} ${this.startedServices.length}`);

    for (const name of this.startedServices) {
      const service = services[name];
      console.log(`  ${icons.success} ${service.name} (port ${service.port})`);
    }

    console.log(`\n${c.bold}Erişim Adresleri:${c.reset}`);
    console.log(`  🌐 Frontend: ${c.cyan}http://localhost:${ports.frontend}${c.reset}`);
    console.log(`  🔧 Backend:  ${c.cyan}http://localhost:${ports.backend}${c.reset}`);
    console.log(`  📚 API Docs: ${c.cyan}http://localhost:${ports.backend}/api-docs${c.reset}`);

    console.log(`\n${c.dim}Log takibi için: ./service.sh logs${c.reset}`);
    console.log(`${c.dim}Durdurmak için:  ./service.sh stop${c.reset}\n`);
  }

  /**
   * Tüm servisleri durdur
   */
  async stopAll() {
    this.printHeader('SERVİSLERİ DURDUR');

    // Node processleri durdur
    this.log('Node processleri durduruluyor...', 'step');

    try {
      execSync('pkill -f "node.*server.js" 2>/dev/null || true', { stdio: 'pipe' });
      execSync('pkill -f "next dev" 2>/dev/null || true', { stdio: 'pipe' });
      execSync('pkill -f "next-server" 2>/dev/null || true', { stdio: 'pipe' });
    } catch {}

    // Portları temizle
    for (const port of Object.values(ports)) {
      await this.killPort(port);
    }

    // Docker (opsiyonel)
    if (!this.options.skipDocker && isDockerAvailable()) {
      this.log('Docker container\'ları durduruluyor...', 'step');
      await composeDown();
    }

    this.log('Tüm servisler durduruldu', 'success');
  }

  /**
   * Durumu göster
   */
  async showStatus() {
    const results = await checkAllServices();
    printHealthReport(results);
  }

  /**
   * Ana çalıştırma metodu
   */
  async run() {
    try {
      // Pre-flight checks
      const preFlightResult = await this.preFlightChecks();

      if (!preFlightResult.success) {
        this.log(`Başlatma iptal edildi: ${preFlightResult.reason}`, 'error');
        process.exit(1);
      }

      // Servisleri başlat
      await this.startAll();

      // Post-start health check
      const healthResults = await this.postStartHealthCheck();

      // Özet
      this.showSummary();

      return {
        success: healthResults.allHealthy,
        startedServices: this.startedServices,
        healthResults,
      };
    } catch (error) {
      this.log(`Beklenmeyen hata: ${error.message}`, 'error');
      console.error(error);
      process.exit(1);
    }
  }
}

// CLI olarak çalıştırıldığında
const isMain = process.argv[1]?.endsWith('orchestrator.js');
if (isMain) {
  const args = process.argv.slice(2);

  const options = {
    mode: args.includes('--prod') ? 'prod' : 'dev',
    verbose: args.includes('--verbose') || args.includes('-v'),
    skipEnvCheck: args.includes('--skip-env'),
    skipDocker: args.includes('--skip-docker'),
  };

  const command = args.find(a => !a.startsWith('-'));
  const orchestrator = new Orchestrator(options);

  switch (command) {
    case 'start':
    case undefined:
      await orchestrator.run();
      break;

    case 'stop':
      await orchestrator.stopAll();
      break;

    case 'status':
      await orchestrator.showStatus();
      break;

    case 'preflight':
      const result = await orchestrator.preFlightChecks();
      process.exit(result.success ? 0 : 1);
      break;

    default:
      console.log(`
${c.bold}Kullanım:${c.reset}
  node orchestrator.js [komut] [seçenekler]

${c.bold}Komutlar:${c.reset}
  start     Tüm servisleri başlat (varsayılan)
  stop      Tüm servisleri durdur
  status    Servis durumlarını göster
  preflight Sadece pre-flight kontrolleri çalıştır

${c.bold}Seçenekler:${c.reset}
  --prod        Production modu
  --verbose, -v Detaylı çıktı
  --skip-env    Environment kontrolünü atla
  --skip-docker Docker'ı atla
`);
      break;
  }
}

export default Orchestrator;
