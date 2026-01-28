/**
 * Audit Reporter
 * Denetim sonuçlarını JSON formatında raporla
 */

import fs from 'fs/promises';
import path from 'path';

export class AuditReporter {
  constructor(options) {
    this.outputPath = options.outputPath;
    this.verbose = options.verbose;
  }

  /**
   * Rapor oluştur
   * @param {Object} results - Kategori sonuçları
   * @param {Object} meta - Meta bilgiler
   * @returns {Promise<Object>} Rapor objesi
   */
  async generate(results, meta) {
    const report = {
      meta: {
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        duration: meta.duration,
        projectRoot: meta.projectRoot,
        nodeVersion: process.version,
        outputPath: this.outputPath,
      },

      summary: this.calculateSummary(results),
      results: results,
      recommendations: this.generateRecommendations(results),
    };

    // Raporu dosyaya yaz
    await this.writeReport(report);

    return report;
  }

  /**
   * Özet hesapla
   */
  calculateSummary(results) {
    const summary = {
      totalChecks: 0,
      passed: 0,
      errors: 0,
      warnings: 0,
      info: 0,
      skipped: 0,
      byCategory: {},
    };

    for (const [categoryName, categoryResult] of Object.entries(results)) {
      const categoryStats = {
        passed: 0,
        errors: 0,
        warnings: 0,
        info: 0,
      };

      for (const check of categoryResult.checks) {
        summary.totalChecks++;

        if (check.status === 'passed') {
          summary.passed++;
          categoryStats.passed++;
        } else if (check.status === 'error') {
          summary.errors++;
          categoryStats.errors++;
        } else if (check.status === 'warning') {
          summary.warnings++;
          categoryStats.warnings++;
        }

        // Bulgu sayıları
        if (check.findings) {
          for (const finding of check.findings) {
            if (finding.severity === 'info') {
              summary.info++;
              categoryStats.info++;
            }
          }
        }
      }

      summary.byCategory[categoryName] = categoryStats;
    }

    return summary;
  }

  /**
   * Öneriler oluştur
   */
  generateRecommendations(results) {
    const recommendations = [];

    for (const [categoryName, categoryResult] of Object.entries(results)) {
      for (const check of categoryResult.checks) {
        if (check.status === 'error' || check.status === 'warning') {
          const priority = check.status === 'error' ? 'high' : 'medium';

          // Check bazında öneriler
          const recommendation = this.getRecommendationForCheck(check, categoryName);
          if (recommendation) {
            recommendations.push({
              priority,
              category: categoryName,
              check: check.id,
              ...recommendation,
            });
          }
        }
      }
    }

    // Önceliğe göre sırala
    return recommendations.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return (priorityOrder[a.priority] || 3) - (priorityOrder[b.priority] || 3);
    });
  }

  /**
   * Kontrol için öneri oluştur
   */
  getRecommendationForCheck(check, category) {
    const recommendations = {
      // Code Quality
      'lint-format': {
        action: 'Lint ve formatting hatalarını düzeltin',
        command: 'npm run lint:fix',
      },
      'dead-code': {
        action: 'Kullanılmayan kod ve bağımlılıkları temizleyin',
        command: 'npm prune && eslint --fix',
      },
      'typescript-strict': {
        action: 'TypeScript strict mode uyumluluğunu sağlayın',
      },
      complexity: {
        action: 'Yüksek karmaşıklıktaki fonksiyonları refactor edin',
      },
      'api-consistency': {
        action: 'API endpoint adlandırma ve response formatlarını standartlaştırın',
      },
      documentation: {
        action: 'JSDoc ve README belgelerini güncelleyin',
      },

      // Security
      dependencies: {
        action: 'Güvenlik açığı olan bağımlılıkları güncelleyin',
        command: 'npm audit fix',
      },
      secrets: {
        action: 'Kodda tespit edilen gizli anahtarları environment variable\'a taşıyın',
      },
      'auth-security': {
        action: 'Authentication ve authorization kontrollerini güçlendirin',
      },
      'cors-headers': {
        action: 'CORS ve security header yapılandırmasını kontrol edin',
      },
      'rate-limiting': {
        action: 'Rate limiting yapılandırmasını gözden geçirin',
      },
      'input-validation': {
        action: 'Input validation ve sanitization ekleyin',
      },
      'env-security': {
        action: '.env dosyalarını ve environment variable güvenliğini kontrol edin',
      },

      // Infrastructure
      'build-health': {
        action: 'Build yapılandırmasını ve script\'leri kontrol edin',
      },
      'database-health': {
        action: 'Migration tutarlılığını ve index\'leri kontrol edin',
      },
      'log-analysis': {
        action: 'Hata loglarını inceleyin ve çözümleyin',
      },
      performance: {
        action: 'Bundle boyutunu ve memory kullanımını optimize edin',
      },
    };

    return recommendations[check.id] || { action: `${check.name} sorunlarını giderin` };
  }

  /**
   * Raporu dosyaya yaz
   */
  async writeReport(report) {
    try {
      // Output dizinini oluştur
      const outputDir = path.dirname(this.outputPath);
      await fs.mkdir(outputDir, { recursive: true });

      // JSON olarak yaz
      await fs.writeFile(this.outputPath, JSON.stringify(report, null, 2), 'utf-8');

      if (this.verbose) {
        console.log(`\n📄 Rapor kaydedildi: ${this.outputPath}`);
      }
    } catch (error) {
      console.error(`Rapor yazılamadı: ${error.message}`);
    }
  }
}
