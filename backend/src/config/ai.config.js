/**
 * AI Configuration
 * Claude ve Gemini AI için merkezi yapılandırma
 */

// ═══════════════════════════════════════════════════════════════════════════
// ZORUNLU CONFIG ALANLARI - Yeni alan eklenirse buraya da ekle!
// Bu sayede eksik config başlangıçta yakalanır, runtime'da değil.
// ═══════════════════════════════════════════════════════════════════════════
const REQUIRED_CONFIG_FIELDS = {
  claude: ['fastModel', 'defaultModel', 'analysisModel', 'maxTokens', 'temperature', 'timeout'],
  gemini: ['defaultModel', 'maxTokens', 'timeout'],
  pdf: ['maxPages', 'parallelPages', 'dpi'],
  image: ['maxWidth', 'maxHeight', 'quality'],
  queue: ['maxConcurrent', 'processInterval', 'retryDelay', 'maxRetries'],
};

export const aiConfig = {
  // Claude (Anthropic) ayarları
  claude: {
    // Pipeline v5.0 modelleri
    fastModel: process.env.CLAUDE_FAST_MODEL || 'claude-3-haiku-20240307',      // Aşama 1: Hızlı chunk analizi
    defaultModel: process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514',        // Aşama 2: Birleştirme
    analysisModel: process.env.CLAUDE_ANALYSIS_MODEL || 'claude-opus-4-20250514', // Derin analiz
    maxTokens: parseInt(process.env.CLAUDE_MAX_TOKENS || '4096', 10),
    temperature: parseFloat(process.env.CLAUDE_TEMPERATURE || '0.3'),
    timeout: parseInt(process.env.CLAUDE_TIMEOUT || '120000', 10), // 2 dakika
  },

  // Gemini (Google) ayarları - OCR fallback için
  gemini: {
    defaultModel: process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp',
    maxTokens: parseInt(process.env.GEMINI_MAX_TOKENS || '4096', 10),
    timeout: parseInt(process.env.GEMINI_TIMEOUT || '60000', 10),
  },

  // Docling (IBM) ayarları - PDF/Office işleme
  docling: {
    apiUrl: process.env.DOCLING_API_URL || 'http://localhost:5001',
    parallelChunks: parseInt(process.env.DOCLING_PARALLEL_CHUNKS || '3', 10), // Aynı anda işlenecek chunk
    chunkSize: parseInt(process.env.DOCLING_CHUNK_SIZE || '10', 10), // Her chunk'taki sayfa sayısı
    timeout: parseInt(process.env.DOCLING_TIMEOUT || '600000', 10), // 10 dakika
  },

  // PDF işleme ayarları
  pdf: {
    maxPages: parseInt(process.env.AI_PDF_MAX_PAGES || '100', 10),
    parallelPages: parseInt(process.env.AI_PDF_PARALLEL_PAGES || '8', 10), // 3→8 paralel sayfa
    pagesPerBatch: parseInt(process.env.AI_PDF_PAGES_PER_BATCH || '2', 10), // 2 sayfa tek API çağrısında (4 çok ağır)
    dpi: parseInt(process.env.AI_PDF_DPI || '150', 10), // 200→150 daha hızlı dönüşüm
    imageFormat: process.env.AI_PDF_IMAGE_FORMAT || 'png',
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
    claudeInputCost: 0.003, // $ per 1K tokens
    claudeOutputCost: 0.015, // $ per 1K tokens
    geminiInputCost: 0.00025, // $ per 1K tokens
    geminiOutputCost: 0.0005, // $ per 1K tokens
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
    errors.forEach(err => console.error(`║ ${err.padEnd(58)}║`));
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
