/**
 * AI Configuration - TEK MERKEZİ YAPILANDIRMA
 * ============================================
 *
 * v9.0 UNIFIED SYSTEM - Tüm AI işlemleri için tek kaynak
 *
 * KULLANIM:
 *   import { analyzeDocument } from './ai-analyzer/unified-pipeline.js';
 *   import { aiConfig, isAzureConfigured } from './config/ai.config.js';
 *
 * PIPELINE AKIŞI (otomatik):
 *   1. Azure Custom Model (ihale-catering-v1) → En doğru, eğitilmiş
 *   2. Azure Layout + Claude → Hibrit analiz
 *   3. Claude Zero-Loss → Son fallback
 *
 * NOT: Diğer dosyalarda config TANIMLAMAYIN! Bu dosyayı import edin.
 */

// ═══════════════════════════════════════════════════════════════════════════
// ZORUNLU CONFIG ALANLARI - Yeni alan eklenirse buraya da ekle!
// Bu sayede eksik config başlangıçta yakalanır, runtime'da değil.
// ═══════════════════════════════════════════════════════════════════════════
const REQUIRED_CONFIG_FIELDS = {
  claude: ['fastModel', 'defaultModel', 'analysisModel', 'maxTokens', 'temperature', 'timeout'],
  pdf: ['maxPages', 'parallelPages', 'dpi'],
  image: ['maxWidth', 'maxHeight', 'quality'],
  queue: ['maxConcurrent', 'processInterval', 'retryDelay', 'maxRetries'],
  pipeline: ['provider'],
};

export const aiConfig = {
  // Claude (Anthropic) ayarları - TÜM AI ANALİZİ İÇİN
  claude: {
    // Pipeline v5.0 modelleri
    fastModel: process.env.CLAUDE_FAST_MODEL || 'claude-3-haiku-20240307', // Aşama 1: Hızlı chunk analizi
    defaultModel: process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514', // Aşama 2: Birleştirme + Genel AI
    analysisModel: process.env.CLAUDE_ANALYSIS_MODEL || 'claude-opus-4-6', // Derin analiz + Vision (1M context)
    maxTokens: parseInt(process.env.CLAUDE_MAX_TOKENS || '4096', 10),
    temperature: parseFloat(process.env.CLAUDE_TEMPERATURE || '0.3'),
    timeout: parseInt(process.env.CLAUDE_TIMEOUT || '120000', 10), // 2 dakika
  },

  // PDF işleme ayarları
  pdf: {
    maxPages: parseInt(process.env.AI_PDF_MAX_PAGES || '100', 10),
    parallelPages: parseInt(process.env.AI_PDF_PARALLEL_PAGES || '12', 10), // 8→12 paralel sayfa (API limitleri izin verirse)
    pagesPerBatch: parseInt(process.env.AI_PDF_PAGES_PER_BATCH || '2', 10), // 2 sayfa tek API çağrısında
    dpi: parseInt(process.env.AI_PDF_DPI || '120', 10), // 150→120 daha hızlı dönüşüm (text için yeterli)
    imageFormat: process.env.AI_PDF_IMAGE_FORMAT || 'png',
    jpegQuality: parseInt(process.env.AI_PDF_JPEG_QUALITY || '75', 10), // JPEG sıkıştırma kalitesi
  },

  // Görsel işleme ayarları
  image: {
    maxWidth: parseInt(process.env.AI_IMAGE_MAX_WIDTH || '1568', 10),
    maxHeight: parseInt(process.env.AI_IMAGE_MAX_HEIGHT || '1568', 10),
    quality: parseInt(process.env.AI_IMAGE_QUALITY || '85', 10),
    supportedFormats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
  },

  // Analiz kuyruğu ayarları
  queue: {
    maxConcurrent: parseInt(process.env.AI_QUEUE_CONCURRENT || '4', 10), // 2→4 paralel dosya
    processInterval: parseInt(process.env.AI_QUEUE_INTERVAL || '10000', 10), // 30s→10s aralık
    retryDelay: parseInt(process.env.AI_QUEUE_RETRY_DELAY || '30000', 10), // 60s→30s retry
    maxRetries: parseInt(process.env.AI_QUEUE_MAX_RETRIES || '3', 10),
  },

  // Cost tracking
  costTracking: {
    enabled: process.env.AI_COST_TRACKING !== 'false',
    // Claude Sonnet fiyatları ($ per 1K tokens)
    claudeInputCost: 0.003,
    claudeOutputCost: 0.015,
    // Claude Opus 4.6 fiyatları (derin analiz için)
    claudeOpusInputCost: 0.005,
    claudeOpusOutputCost: 0.025,
    // Azure Document Intelligence fiyatları ($ per 1000 pages)
    azureLayoutCost: 1.5, // prebuilt-layout
    azureCustomCost: 10.0, // custom model
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // AZURE DOCUMENT INTELLIGENCE (dinamik getter - env her erişimde okunur)
  // ═══════════════════════════════════════════════════════════════════════════
  get azure() {
    return {
      enabled: process.env.AZURE_DOCUMENT_AI_ENABLED === 'true',
      endpoint: process.env.AZURE_DOCUMENT_AI_ENDPOINT || '',
      apiKey: process.env.AZURE_DOCUMENT_AI_KEY || '',

      // Custom model (eğitildikten sonra)
      customModelId: process.env.AZURE_DOCUMENT_AI_MODEL_ID || null,
      useCustomModel: process.env.AZURE_USE_CUSTOM_MODEL === 'true',

      // Query Fields - Eğitim gerektirmeden özel alan çıkarımı
      // Azure 4.0 özelliği: Prebuilt modele ek sorgular gönder
      useQueryFields: process.env.AZURE_USE_QUERY_FIELDS === 'true',

      // Timeout (büyük PDF'ler için)
      timeout: parseInt(process.env.AZURE_TIMEOUT || '180000', 10), // 3 dakika
      maxRetries: parseInt(process.env.AZURE_MAX_RETRIES || '3', 10),
      retryDelayMs: parseInt(process.env.AZURE_RETRY_DELAY || '2000', 10),
    };
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PIPELINE PROVIDER SELECTION
  // ═══════════════════════════════════════════════════════════════════════════
  pipeline: {
    // 'claude' | 'azure' | 'hybrid'
    provider: process.env.DOCUMENT_AI_PROVIDER || 'hybrid',
    // Hibrit mod ayarları
    azureForTables: true, // Azure'u tablo extraction için kullan
    claudeForSemantic: true, // Claude'u semantic analiz için kullan
    // Fallback: Azure başarısız olursa Claude'a geç
    fallbackToClaudeOnError: true,
    // A/B test modu
    abTestEnabled: process.env.PIPELINE_AB_TEST === 'true',
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// CONFIG VALIDATION - Eksik alan varsa uygulama başlamaz!
// ═══════════════════════════════════════════════════════════════════════════
function validateConfig() {
  const errors = [];
  const warnings = [];

  for (const [section, fields] of Object.entries(REQUIRED_CONFIG_FIELDS)) {
    if (!aiConfig[section]) {
      errors.push(`❌ Config bölümü eksik: aiConfig.${section}`);
      continue;
    }

    for (const field of fields) {
      const value = aiConfig[section][field];
      if (value === undefined || value === null || value === '') {
        errors.push(`❌ Config alanı eksik: aiConfig.${section}.${field}`);
      }
    }
  }

  // Azure config validation - Artık unified-pipeline kendi kontrol ediyor
  // Bu uyarı sadece başlangıçta değil, ilk kullanımda gösterilsin
  // (dotenv yüklenmeden önce false positive verebilir)

  if (errors.length > 0) {
    errors.forEach((_err) => {});

    if (process.env.NODE_ENV === 'production') {
      throw new Error(`AI Config Validation Failed: ${errors.length} eksik alan`);
    }
  }

  // Log warnings but don't fail
  warnings.forEach((_warn) => {});
}

/**
 * Check if Azure is properly configured
 * TEK FONKSİYON - Diğer dosyalarda tanımlamayın, buradan import edin!
 * @returns {boolean}
 */
export function isAzureConfigured() {
  return !!(aiConfig.azure.enabled && aiConfig.azure.endpoint && aiConfig.azure.apiKey);
}

/**
 * Check if Azure Custom Model is enabled
 * @returns {boolean}
 */
export function isCustomModelEnabled() {
  return !!(isAzureConfigured() && aiConfig.azure.useCustomModel && aiConfig.azure.customModelId);
}

/**
 * Get Azure Custom Model ID
 * @returns {string|null}
 */
export function getCustomModelId() {
  return aiConfig.azure.customModelId || 'ihale-catering-v1';
}

/**
 * Get current pipeline provider
 * Falls back to 'claude' if hybrid/azure selected but Azure not configured
 * @returns {'claude' | 'azure' | 'hybrid'}
 */
export function getEffectiveProvider() {
  const provider = aiConfig.pipeline.provider;

  if ((provider === 'azure' || provider === 'hybrid') && !isAzureConfigured()) {
    return 'claude';
  }

  return provider;
}

// Config yüklenirken otomatik validate et
validateConfig();

export default aiConfig;
