/**
 * AI Configuration
 * Claude AI için merkezi yapılandırma
 * 
 * Not: Docling ve Gemini tamamen kaldırıldı. Tüm AI işlemleri Claude ile yapılıyor.
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
};

export const aiConfig = {
  // Claude (Anthropic) ayarları - TÜM AI ANALİZİ İÇİN
  claude: {
    // Pipeline v5.0 modelleri
    fastModel: process.env.CLAUDE_FAST_MODEL || 'claude-3-haiku-20240307',      // Aşama 1: Hızlı chunk analizi
    defaultModel: process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514',        // Aşama 2: Birleştirme + Genel AI
    analysisModel: process.env.CLAUDE_ANALYSIS_MODEL || 'claude-opus-4-20250514', // Derin analiz + Vision
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

  // Cost tracking (Claude only)
  costTracking: {
    enabled: process.env.AI_COST_TRACKING !== 'false',
    // Claude Sonnet fiyatları ($ per 1K tokens)
    claudeInputCost: 0.003,
    claudeOutputCost: 0.015,
    // Claude Opus fiyatları (derin analiz için)
    claudeOpusInputCost: 0.015,
    claudeOpusOutputCost: 0.075,
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// CONFIG VALIDATION - Eksik alan varsa uygulama başlamaz!
// ═══════════════════════════════════════════════════════════════════════════
function validateConfig() {
  const errors = [];
  
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
  
  if (errors.length > 0) {
    console.error('\n╔════════════════════════════════════════════════════════════╗');
    console.error('║           AI CONFIG VALIDATION HATASI!                      ║');
    console.error('╠════════════════════════════════════════════════════════════╣');
    errors.forEach(err => { console.error(`║ ${err.padEnd(58)}║`); });
    console.error('╠════════════════════════════════════════════════════════════╣');
    console.error('║ Çözüm: ai.config.js dosyasına eksik alanları ekle          ║');
    console.error('╚════════════════════════════════════════════════════════════╝\n');
    
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`AI Config Validation Failed: ${errors.length} eksik alan`);
    }
  } else {
    console.log('✅ AI Config validation başarılı - tüm alanlar tanımlı');
  }
}

// Config yüklenirken otomatik validate et
validateConfig();

export default aiConfig;
