#!/usr/bin/env node
/**
 * Catering Pro - Unified Start Script
 * Tüm servisleri doğru sırada başlatır
 *
 * Kullanım:
 *   node scripts/start-all.js          # Development mode
 *   node scripts/start-all.js --prod   # Production mode
 *   node scripts/start-all.js --docker # Docker mode
 */

import { Orchestrator } from './services/orchestrator.js';

// ANSI colors
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  dim: '\x1b[2m',
};

/**
 * Banner göster
 */
function showBanner() {
  console.log(`
${c.cyan}${c.bold}
   ____      _            _               ____
  / ___|__ _| |_ ___ _ __(_)_ __   __ _  |  _ \\ _ __ ___
 | |   / _\` | __/ _ \\ '__| | '_ \\ / _\` | | |_) | '__/ _ \\
 | |__| (_| | ||  __/ |  | | | | | (_| | |  __/| | | (_) |
  \\____\\__,_|\\__\\___|_|  |_|_| |_|\\__, | |_|   |_|  \\___/
                                  |___/
${c.reset}
${c.dim}  Kapsamlı Catering Yönetim Sistemi - Unified Start${c.reset}
`);
}

/**
 * Yardım mesajını göster
 */
function showHelp() {
  console.log(`
${c.bold}Kullanım:${c.reset}
  node scripts/start-all.js [seçenekler]

${c.bold}Modlar:${c.reset}
  ${c.cyan}--dev${c.reset}      Development modu (varsayılan)
             - Hot reload aktif
             - Verbose logging
             - Source maps

  ${c.cyan}--prod${c.reset}     Production modu
             - Optimized build
             - PM2 ile çalıştırma

  ${c.cyan}--docker${c.reset}   Docker modu
             - docker-compose up -d
             - Container orchestration

${c.bold}Seçenekler:${c.reset}
  ${c.cyan}--verbose, -v${c.reset}    Detaylı çıktı göster
  ${c.cyan}--skip-env${c.reset}       Environment kontrolünü atla
  ${c.cyan}--skip-docker${c.reset}    Docker servislerini atla
  ${c.cyan}--help, -h${c.reset}       Bu yardım mesajını göster

${c.bold}Örnekler:${c.reset}
  ${c.dim}# Development başlat${c.reset}
  node scripts/start-all.js

  ${c.dim}# Production başlat (verbose)${c.reset}
  node scripts/start-all.js --prod -v

  ${c.dim}# Sadece Node servisleri (Docker'sız)${c.reset}
  node scripts/start-all.js --skip-docker

${c.bold}Durdurmak için:${c.reset}
  ./service.sh stop
  ${c.dim}veya${c.reset}
  node scripts/services/orchestrator.js stop
`);
}

/**
 * Ana fonksiyon
 */
async function main() {
  const args = process.argv.slice(2);

  // Yardım
  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }

  // Banner
  showBanner();

  // Mod belirleme
  let mode = 'dev';
  if (args.includes('--prod')) mode = 'prod';
  if (args.includes('--docker')) mode = 'docker';

  console.log(`${c.cyan}Mode: ${c.bold}${mode.toUpperCase()}${c.reset}\n`);

  // Orchestrator ayarları
  const options = {
    mode,
    verbose: args.includes('--verbose') || args.includes('-v'),
    skipEnvCheck: args.includes('--skip-env'),
    skipDocker: args.includes('--skip-docker'),
  };

  // Orchestrator oluştur ve çalıştır
  const orchestrator = new Orchestrator(options);

  try {
    const result = await orchestrator.run();

    if (!result.success) {
      console.log(`\n${c.yellow}⚠️  Bazı servisler başlatılamadı. Logları kontrol edin.${c.reset}`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`\n${c.red}Hata: ${error.message}${c.reset}`);
    process.exit(1);
  }
}

// Çalıştır
main().catch(console.error);
