/**
 * Audit Runner
 * Denetim kontrollerini çalıştıran ana orkestratör
 */

import path from 'path';
import { codeQualityChecks } from '../checks/code-quality/index.js';
import { securityChecks } from '../checks/security/index.js';
import { infrastructureChecks } from '../checks/infrastructure/index.js';
import { SEVERITY, determineStatus, getHighestSeverity, countBySeverity } from './severity.js';

export class AuditRunner {
  constructor(options) {
    this.projectRoot = options.projectRoot;
    this.config = options.config;
    this.category = options.category;
    this.check = options.check;
    this.verbose = options.verbose;
    this.fix = options.fix;

    // Tüm kategoriler
    this.categories = {
      'code-quality': codeQualityChecks,
      security: securityChecks,
      infrastructure: infrastructureChecks,
    };
  }

  /**
   * Ana çalıştırma metodu
   * @returns {Promise<Object>} Denetim sonuçları
   */
  async run() {
    const results = {};
    const categoriesToRun = this.getCategoriesToRun();

    for (const categoryName of categoriesToRun) {
      const categoryModule = this.categories[categoryName];

      if (!categoryModule) {
        console.warn(`⚠️  Kategori bulunamadı: ${categoryName}`);
        continue;
      }

      if (this.verbose) {
        console.log(`\n📂 ${categoryModule.displayName} kontrolleri çalıştırılıyor...`);
      }

      results[categoryName] = await this.runCategory(categoryModule);
    }

    return results;
  }

  /**
   * Çalıştırılacak kategorileri belirle
   */
  getCategoriesToRun() {
    // Belirli bir kontrol istenmişse, onu içeren kategoriyi bul
    if (this.check) {
      for (const [categoryName, categoryModule] of Object.entries(this.categories)) {
        const hasCheck = categoryModule.checks.some((c) => c.id === this.check);
        if (hasCheck) return [categoryName];
      }
      console.warn(`⚠️  Kontrol bulunamadı: ${this.check}`);
      return [];
    }

    // Belirli kategori istenmişse
    if (this.category) {
      if (this.categories[this.category]) {
        return [this.category];
      }
      console.warn(`⚠️  Kategori bulunamadı: ${this.category}`);
      return [];
    }

    // Skip listesinde olmayanları döndür
    return Object.keys(this.categories).filter((cat) => !this.config.skip?.includes(cat));
  }

  /**
   * Kategori içindeki kontrolleri çalıştır
   */
  async runCategory(categoryModule) {
    const categoryResults = {
      name: categoryModule.displayName,
      description: categoryModule.description,
      checks: [],
    };

    const checksToRun = this.check
      ? categoryModule.checks.filter((c) => c.id === this.check)
      : categoryModule.checks.filter((c) => !this.config.skipChecks?.includes(c.id));

    for (const check of checksToRun) {
      if (this.verbose) {
        console.log(`   🔍 ${check.name}...`);
      }

      const startTime = Date.now();

      try {
        const context = {
          projectRoot: this.projectRoot,
          config: this.config,
          verbose: this.verbose,
          fix: this.fix && check.fixable,
        };

        const result = await check.run(context);
        result.duration = Date.now() - startTime;

        categoryResults.checks.push(result);

        if (this.verbose) {
          this.printCheckResult(result);
        }
      } catch (error) {
        categoryResults.checks.push({
          id: check.id,
          name: check.name,
          status: 'error',
          severity: SEVERITY.ERROR,
          duration: Date.now() - startTime,
          fixable: check.fixable,
          error: error.message,
          findings: [
            {
              severity: SEVERITY.ERROR,
              message: `Kontrol çalıştırılamadı: ${error.message}`,
            },
          ],
        });

        if (this.verbose) {
          console.error(`      ❌ Hata: ${error.message}`);
        }
      }
    }

    // Kategori durumunu belirle
    categoryResults.status = this.determineCategoryStatus(categoryResults.checks);

    return categoryResults;
  }

  /**
   * Kontrol sonucunu konsola yazdır
   */
  printCheckResult(result) {
    const icon = result.status === 'passed' ? '✅' : result.status === 'warning' ? '⚠️' : '❌';
    const findingCount = result.findings?.length || 0;
    console.log(`      ${icon} ${result.name}: ${findingCount} bulgu (${result.duration}ms)`);

    if (result.findings && result.findings.length > 0 && this.verbose) {
      result.findings.slice(0, 3).forEach((f) => {
        const loc = f.file ? ` (${f.file}${f.line ? ':' + f.line : ''})` : '';
        console.log(`         - ${f.message}${loc}`);
      });
      if (result.findings.length > 3) {
        console.log(`         ... ve ${result.findings.length - 3} daha`);
      }
    }
  }

  /**
   * Kategori durumunu belirle
   */
  determineCategoryStatus(checks) {
    const hasError = checks.some((c) => c.status === 'error');
    if (hasError) return 'error';

    const hasWarning = checks.some((c) => c.status === 'warning');
    if (hasWarning) return 'warning';

    return 'passed';
  }
}
