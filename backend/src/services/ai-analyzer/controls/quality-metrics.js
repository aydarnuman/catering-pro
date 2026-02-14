/**
 * Quality Metrics & Monitoring
 * ============================
 *
 * 4. Confidence Threshold - Düşük güvenlikli verileri işaretle
 * 9. Monitoring - Pipeline performans takibi
 */

import logger from '../../../utils/logger.js';

// ═══════════════════════════════════════════════════════════════════════════
// CONFIDENCE THRESHOLDS
// ═══════════════════════════════════════════════════════════════════════════

export const CONFIDENCE_THRESHOLDS = {
  HIGH: 0.85, // Güvenilir veri
  MEDIUM: 0.65, // Dikkatli kullan
  LOW: 0.45, // Doğrulama gerekli
  REJECT: 0.3, // Kullanma
};

export const FIELD_IMPORTANCE = {
  critical: ['tahmini_bedel', 'ihale_tarihi', 'son_teklif_tarihi', 'teminat_oranlari'],
  important: ['iletisim', 'servis_saatleri', 'mali_kriterler', 'ogun_bilgileri'],
  standard: ['personel_detaylari', 'teknik_sartlar', 'ceza_kosullari'],
};

/**
 * Düşük güvenlikli alanları tespit et ve işaretle
 * @param {Object} analysis - Analiz sonucu
 * @param {Object} azureResult - Azure'dan gelen ham sonuç (confidence değerleri ile)
 * @returns {Object} Confidence raporu
 */
export function analyzeConfidence(analysis, azureResult = {}) {
  const report = {
    overall_confidence: 0,
    low_confidence_fields: [],
    high_confidence_fields: [],
    needs_verification: [],
    field_confidences: {},
    summary: {
      total_fields: 0,
      high: 0,
      medium: 0,
      low: 0,
      rejected: 0,
    },
  };

  // Azure'dan gelen field confidence'ları
  const azureFields = azureResult.fields || {};

  for (const [fieldName, fieldData] of Object.entries(azureFields)) {
    const confidence = fieldData?.confidence || 0;
    report.field_confidences[fieldName] = confidence;
    report.summary.total_fields++;

    // Kategorize et
    if (confidence >= CONFIDENCE_THRESHOLDS.HIGH) {
      report.summary.high++;
      report.high_confidence_fields.push({ field: fieldName, confidence });
    } else if (confidence >= CONFIDENCE_THRESHOLDS.MEDIUM) {
      report.summary.medium++;
    } else if (confidence >= CONFIDENCE_THRESHOLDS.LOW) {
      report.summary.low++;
      report.low_confidence_fields.push({
        field: fieldName,
        confidence,
        reason: 'Düşük güvenlik skoru',
        action: 'Doğrulama önerilir',
      });
    } else {
      report.summary.rejected++;
      report.low_confidence_fields.push({
        field: fieldName,
        confidence,
        reason: 'Çok düşük güvenlik - kullanılmamalı',
        action: 'Manuel giriş gerekli',
      });
    }

    // Kritik alanlar için ekstra kontrol
    if (FIELD_IMPORTANCE.critical.includes(fieldName) && confidence < CONFIDENCE_THRESHOLDS.MEDIUM) {
      report.needs_verification.push({
        field: fieldName,
        confidence,
        importance: 'critical',
        message: `KRİTİK ALAN düşük güvenlikli: ${fieldName}`,
      });
    }
  }

  // Array tipindeki alanları kontrol et (dates, amounts, etc.)
  const arrayFields = ['dates', 'amounts', 'penalties', 'ogun_bilgileri', 'personel_detaylari'];
  for (const fieldName of arrayFields) {
    const items = analysis?.[fieldName] || [];
    if (!Array.isArray(items)) continue;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.confidence && item.confidence < CONFIDENCE_THRESHOLDS.MEDIUM) {
        report.low_confidence_fields.push({
          field: `${fieldName}[${i}]`,
          value: item.value || item.tur || item.pozisyon,
          confidence: item.confidence,
          reason: 'Array item düşük güvenlikli',
        });
      }
    }
  }

  // Overall confidence hesapla
  const confidenceValues = Object.values(report.field_confidences);
  if (confidenceValues.length > 0) {
    report.overall_confidence =
      Math.round((confidenceValues.reduce((a, b) => a + b, 0) / confidenceValues.length) * 100) / 100;
  }

  return report;
}

// ═══════════════════════════════════════════════════════════════════════════
// PIPELINE MONITORING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Pipeline performans izleyici
 */
export class PipelineMonitor {
  constructor(documentId) {
    this.documentId = documentId;
    this.startTime = Date.now();
    this.stages = [];
    this.currentStage = null;
    this.metrics = {
      total_chunks: 0,
      processed_chunks: 0,
      failed_chunks: 0,
      api_calls: {
        azure: 0,
        claude: 0,
      },
      token_usage: {
        input: 0,
        output: 0,
      },
      errors: [],
    };
  }

  /**
   * Yeni aşama başlat
   */
  startStage(stageName, metadata = {}) {
    if (this.currentStage) {
      this.endStage();
    }

    this.currentStage = {
      name: stageName,
      start_time: Date.now(),
      metadata,
      substages: [],
    };

    logger.info(`📊 [Monitor] Stage başladı: ${stageName}`, {
      module: 'pipeline-monitor',
      document_id: this.documentId,
      elapsed_ms: Date.now() - this.startTime,
    });
  }

  /**
   * Mevcut aşamayı bitir
   */
  endStage(result = {}) {
    if (!this.currentStage) return;

    this.currentStage.end_time = Date.now();
    this.currentStage.duration_ms = this.currentStage.end_time - this.currentStage.start_time;
    this.currentStage.result = result;

    this.stages.push({ ...this.currentStage });

    logger.info(`📊 [Monitor] Stage bitti: ${this.currentStage.name} (${this.currentStage.duration_ms}ms)`, {
      module: 'pipeline-monitor',
      document_id: this.documentId,
      duration: this.currentStage.duration_ms,
    });

    this.currentStage = null;
  }

  /**
   * API çağrısı kaydet
   */
  recordApiCall(provider, tokenUsage = {}) {
    if (provider === 'azure') {
      this.metrics.api_calls.azure++;
    } else if (provider === 'claude') {
      this.metrics.api_calls.claude++;
      if (tokenUsage.input) this.metrics.token_usage.input += tokenUsage.input;
      if (tokenUsage.output) this.metrics.token_usage.output += tokenUsage.output;
    }
  }

  /**
   * Chunk işleme kaydet
   */
  recordChunkProcessed(success = true) {
    this.metrics.total_chunks++;
    if (success) {
      this.metrics.processed_chunks++;
    } else {
      this.metrics.failed_chunks++;
    }
  }

  /**
   * Hata kaydet
   */
  recordError(stage, error) {
    this.metrics.errors.push({
      stage,
      error: error.message || String(error),
      timestamp: Date.now(),
    });
  }

  /**
   * Final rapor oluştur
   */
  generateReport() {
    if (this.currentStage) {
      this.endStage();
    }

    const totalDuration = Date.now() - this.startTime;

    // Stage süre dağılımı
    const stageDurations = {};
    let totalStageDuration = 0;
    for (const stage of this.stages) {
      stageDurations[stage.name] = stage.duration_ms;
      totalStageDuration += stage.duration_ms;
    }

    // Yüzde hesapla
    const stagePercentages = {};
    for (const [name, duration] of Object.entries(stageDurations)) {
      stagePercentages[name] = Math.round((duration / totalStageDuration) * 100);
    }

    // En yavaş aşama
    const slowestStage = Object.entries(stageDurations).sort((a, b) => b[1] - a[1])[0];

    const report = {
      document_id: this.documentId,
      total_duration_ms: totalDuration,
      total_duration_readable: formatDuration(totalDuration),
      stages: this.stages.map((s) => ({
        name: s.name,
        duration_ms: s.duration_ms,
        percentage: stagePercentages[s.name] || 0,
      })),
      slowest_stage: slowestStage ? { name: slowestStage[0], duration_ms: slowestStage[1] } : null,
      metrics: this.metrics,
      performance_summary: {
        chunks_per_second:
          this.metrics.total_chunks > 0
            ? Math.round((this.metrics.total_chunks / (totalDuration / 1000)) * 100) / 100
            : 0,
        success_rate:
          this.metrics.total_chunks > 0
            ? Math.round((this.metrics.processed_chunks / this.metrics.total_chunks) * 100)
            : 100,
        api_efficiency: calculateApiEfficiency(this.metrics),
      },
      timestamp: new Date().toISOString(),
    };

    // Log özet
    const chunkLine =
      this.metrics.total_chunks > 0
        ? `${this.metrics.processed_chunks}/${this.metrics.total_chunks} başarılı`
        : 'N/A (chunk bilgisi yok)';

    logger.info('═══════════════════════════════════════════════════════════', { module: 'pipeline-monitor' });
    logger.info(`📊 PIPELINE RAPORU - ${this.documentId}`, { module: 'pipeline-monitor' });
    logger.info(`   Toplam Süre: ${report.total_duration_readable}`, { module: 'pipeline-monitor' });
    logger.info(`   Chunks: ${chunkLine}`, { module: 'pipeline-monitor' });
    logger.info(`   API Çağrıları: Azure=${this.metrics.api_calls.azure}, Claude=${this.metrics.api_calls.claude}`, {
      module: 'pipeline-monitor',
    });
    if (slowestStage) {
      logger.info(`   En Yavaş: ${slowestStage[0]} (${slowestStage[1]}ms)`, { module: 'pipeline-monitor' });
    }
    logger.info('═══════════════════════════════════════════════════════════', { module: 'pipeline-monitor' });

    return report;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.round((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

function calculateApiEfficiency(metrics) {
  const totalCalls = metrics.api_calls.azure + metrics.api_calls.claude;
  if (totalCalls === 0) return 'N/A';

  // Azure daha ucuz, Claude daha pahalı
  // İdeal: Mümkün olduğunca Azure kullan
  const azureRatio = metrics.api_calls.azure / totalCalls;

  if (azureRatio >= 0.7) return 'excellent';
  if (azureRatio >= 0.5) return 'good';
  if (azureRatio >= 0.3) return 'moderate';
  return 'needs_optimization';
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export default {
  CONFIDENCE_THRESHOLDS,
  FIELD_IMPORTANCE,
  analyzeConfidence,
  PipelineMonitor,
};
