#!/usr/bin/env node
/**
 * Catering Pro - CLI Audit System
 * Kapsamlı kod denetim ve kalite kontrol aracı
 *
 * Kullanım:
 *   node scripts/audit/audit.js                       # Tüm kontroller
 *   node scripts/audit/audit.js --category=security   # Belirli kategori
 *   node scripts/audit/audit.js --check=secrets       # Belirli kontrol
 *   node scripts/audit/audit.js --ci                  # CI modu
 *   node scripts/audit/audit.js --verbose             # Detaylı çıktı
 *   node scripts/audit/audit.js --fix                 # Otomatik düzeltme
 */

import { parseArgs } from 'node:util';
import path from 'path';
import { fileURLToPath } from 'url';
import { AuditRunner } from './lib/runner.js';
import { AuditReporter } from './lib/reporter.js';
import { loadConfig } from './audit.config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const options = {
  category: { type: 'string', short: 'c' },
  check: { type: 'string', short: 'k' },
  output: { type: 'string', short: 'o' },
  ci: { type: 'boolean', default: false },
  verbose: { type: 'boolean', short: 'v', default: false },
  fix: { type: 'boolean', default: false },
  help: { type: 'boolean', short: 'h', default: false },
  'fail-on-warning': { type: 'boolean', default: false },
};

async function main() {
  const { values: args } = parseArgs({ options, allowPositionals: true });

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  const projectRoot = path.resolve(__dirname, '../..');
  const config = await loadConfig(projectRoot);

  const runner = new AuditRunner({
    projectRoot,
    config,
    category: args.category,
    check: args.check,
    verbose: args.verbose,
    fix: args.fix,
  });

  console.log('\n🔍 Catering Pro Denetim Sistemi');
  console.log('════════════════════════════════════════\n');

  const startTime = Date.now();

  try {
    const results = await runner.run();
    const duration = Date.now() - startTime;

    const outputPath = args.output || path.join(__dirname, 'output', `audit-${Date.now()}.json`);

    const reporter = new AuditReporter({
      outputPath,
      verbose: args.verbose,
    });

    const report = await reporter.generate(results, { duration, projectRoot, config });

    printSummary(report);

    const exitCode = determineExitCode(report, {
      ci: args.ci,
      failOnWarning: args['fail-on-warning'],
    });

    process.exit(exitCode);
  } catch (error) {
    console.error('\n❌ Denetim hatası:', error.message);
    if (args.verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

function printHelp() {
  console.log(`
Catering Pro - CLI Denetim Sistemi

KULLANIM:
  node scripts/audit/audit.js [seçenekler]

SEÇENEKLER:
  -c, --category <isim>    Belirli kategori çalıştır (code-quality, security, infrastructure)
  -k, --check <isim>       Belirli kontrol çalıştır (secrets, complexity, dependencies vb.)
  -o, --output <yol>       Özel çıktı dosyası yolu
      --ci                 CI modu (sıkı çıkış kodları)
  -v, --verbose            Detaylı çıktı göster
      --fix                Mümkün olan sorunları otomatik düzelt
      --fail-on-warning    Uyarılarda hata kodu ile çık (CI modu)
  -h, --help               Bu yardım mesajını göster

ÖRNEKLER:
  node scripts/audit/audit.js                           # Tüm denetimleri çalıştır
  node scripts/audit/audit.js --category=security       # Sadece güvenlik kontrolleri
  node scripts/audit/audit.js --check=secrets --verbose # Detaylı gizli anahtar taraması
  node scripts/audit/audit.js --ci --fail-on-warning    # Sıkı CI modu

KATEGORİLER:
  code-quality    : Lint, formatting, dead code, complexity, API tutarlılığı
  security        : Bağımlılık güvenliği, gizli anahtarlar, auth, CORS, rate limiting
  infrastructure  : Build, database, log analizi, performans
  `);
}

function printSummary(report) {
  const { summary, meta } = report;

  console.log('\n📊 DENETİM ÖZETİ');
  console.log('────────────────────────────────────────');
  console.log(`Toplam Kontrol:  ${summary.totalChecks}`);
  console.log(`Başarılı:        ${summary.passed} ✅`);
  console.log(`Hata:            ${summary.errors} ❌`);
  console.log(`Uyarı:           ${summary.warnings} ⚠️`);
  console.log(`Bilgi:           ${summary.info} ℹ️`);
  console.log(`Süre:            ${(meta.duration / 1000).toFixed(2)}s`);
  console.log(`Rapor:           ${meta.outputPath}`);
  console.log('────────────────────────────────────────\n');

  // Kategori bazında özet
  if (summary.byCategory) {
    console.log('📁 KATEGORİ BAZINDA:');
    for (const [category, stats] of Object.entries(summary.byCategory)) {
      const icon = stats.errors > 0 ? '❌' : stats.warnings > 0 ? '⚠️' : '✅';
      console.log(`   ${icon} ${category}: ${stats.passed} başarılı, ${stats.errors} hata, ${stats.warnings} uyarı`);
    }
    console.log('');
  }

  if (summary.errors > 0) {
    console.log('❌ Denetim HATALARLA tamamlandı\n');
  } else if (summary.warnings > 0) {
    console.log('⚠️  Denetim UYARILARLA tamamlandı\n');
  } else {
    console.log('✅ Denetim BAŞARIYLA tamamlandı\n');
  }

  // Öneriler
  if (report.recommendations && report.recommendations.length > 0) {
    console.log('💡 ÖNERİLER:');
    report.recommendations.slice(0, 5).forEach((rec, i) => {
      const priorityIcon = rec.priority === 'critical' ? '🔴' : rec.priority === 'high' ? '🟠' : '🟡';
      console.log(`   ${i + 1}. ${priorityIcon} ${rec.action}`);
      if (rec.command) {
        console.log(`      └─ Komut: ${rec.command}`);
      }
    });
    console.log('');
  }
}

function determineExitCode(report, options) {
  // Çıkış kodları:
  // 0: Tümü başarılı
  // 1: Hata var
  // 2: Uyarı var (sadece failOnWarning true ise)

  if (report.summary.errors > 0) return 1;
  if (options.failOnWarning && report.summary.warnings > 0) return 2;
  return 0;
}

main().catch((error) => {
  console.error('Denetim başarısız:', error.message);
  process.exit(1);
});
