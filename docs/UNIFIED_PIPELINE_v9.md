# UNIFIED DOCUMENT ANALYSIS PIPELINE v9.0
## TEK MERKEZİ SİSTEM

> **SON GÜNCELLEME:** 2026-02-05  
> **DURUM:** AKTIF - Tüm document analysis işlemleri bu pipeline üzerinden geçer

---

## 1. KULLANIM

```javascript
// TEK DOĞRU YÖNTEM:
import { analyzeDocument } from './services/ai-analyzer/unified-pipeline.js';

const result = await analyzeDocument(filePath, {
  onProgress: (progress) => console.log(progress),
});

// Sonuç yapısı:
{
  success: true,
  analysis: { summary, catering, personnel, dates, ... },
  extraction: { text, pages, ocrApplied },
  validation: { completeness_score, missing_fields },
  meta: { provider_used, elapsed_ms, document_id },
}
```

### KULLANMAYIN:
```javascript
// ❌ ESKİ - DEPRECATED
import { runPipeline } from './services/ai-analyzer/pipeline/index.js';
import { analyzeFile } from './services/ai-analyzer/index.js';
import { runZeroLossPipeline } from './services/ai-analyzer/pipeline/index.js';
```

---

## 2. SİSTEM DİAGRAMI

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    UNIFIED PIPELINE v9.0                                │
│                   TEK GİRİŞ NOKTASI                                     │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  1. CONFIG CHECK (ai.config.js)                                         │
│  ├── isAzureConfigured()      → Azure hazır mı?                        │
│  ├── isCustomModelEnabled()   → Custom model aktif mi?                 │
│  └── getCustomModelId()       → Model ID (ihale-catering-v1)           │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │ Azure Custom Model aktif mi?   │
                    └───────────────┬───────────────┘
                           ┌────────┴────────┐
                          YES               NO
                           │                 │
                           ▼                 │
┌──────────────────────────────────────┐     │
│  AZURE CUSTOM MODEL                  │     │
│  (ihale-catering-v1)                 │     │
│  ─────────────────────               │     │
│  • REST API (2024-11-30)             │     │
│  • Eğitilmiş alanlar                 │     │
│  • Yüksek doğruluk                   │     │
│  • ~25-35 saniye                     │     │
└──────────────────────────────────────┘     │
         │ success?                          │
    ┌────┴────┐                              │
   YES       NO                              │
    │         │                              │
    │         └──────────────────────────────┤
    │                                        │
    │    ┌───────────────────────────────────┴─┐
    │    │ Azure Layout aktif mi?              │
    │    └───────────────────────────────────┬─┘
    │                               ┌────────┴────────┐
    │                              YES               NO
    │                               │                 │
    │                               ▼                 │
    │    ┌──────────────────────────────────────┐    │
    │    │  AZURE LAYOUT                        │    │
    │    │  (prebuilt-layout)                   │    │
    │    │  ─────────────────                   │    │
    │    │  • Tablo çıkarma                     │    │
    │    │  • Form alanları                     │    │
    │    │  • Yapısal veri                      │    │
    │    └──────────────────────────────────────┘    │
    │              │                                 │
    │              ▼                                 │
    │    ┌──────────────────────────────────────┐   │
    │    │  CLAUDE SEMANTIC                     │   │
    │    │  (claude-sonnet-4)                   │   │
    │    │  ─────────────────                   │   │
    │    │  • Azure + Claude birleştirme        │   │
    │    │  • Semantic alan çıkarma             │   │
    │    │  • Bağlam analizi                    │   │
    │    └──────────────────────────────────────┘   │
    │              │                                 │
    └──────────────┼─────────────────────────────────┘
                   │ success?
              ┌────┴────┐
             YES       NO
              │         │
              │         ▼
              │    ┌──────────────────────────────────────┐
              │    │  ZERO-LOSS PIPELINE (Fallback)      │
              │    │  (claude-sonnet-4 + claude-haiku)   │
              │    │  ─────────────────────────────      │
              │    │  • 7 katmanlı pipeline               │
              │    │  • Tamamen Claude tabanlı            │
              │    │  • PDF → Image → OCR → Chunk        │
              │    │  • ~60-120 saniye                    │
              │    └──────────────────────────────────────┘
              │         │
              └────┬────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  VALIDATION & OUTPUT                                                    │
│  ─────────────────────                                                  │
│  • Completeness score hesaplama                                         │
│  • Missing fields belirleme                                             │
│  • Final output format (createSuccessOutput)                            │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. DOSYA YAPISI

```
backend/src/
├── config/
│   └── ai.config.js              # TEK MERKEZİ CONFIG
│       ├── aiConfig              # Tüm AI ayarları
│       ├── isAzureConfigured()   # Azure check
│       ├── isCustomModelEnabled()# Custom model check
│       └── getCustomModelId()    # Model ID getter
│
├── services/
│   └── ai-analyzer/
│       ├── unified-pipeline.js   # ★ TEK GİRİŞ NOKTASI ★
│       │   └── analyzeDocument() # Ana fonksiyon
│       │
│       ├── providers/
│       │   └── azure-document-ai.js  # Azure integration
│       │       ├── analyzeWithCustomModel()
│       │       ├── analyzeWithLayout()
│       │       └── checkHealth()
│       │
│       ├── pipeline/             # Zero-Loss Pipeline (fallback)
│       │   ├── index.js          # runZeroLossPipeline
│       │   ├── extractor.js      # Text extraction
│       │   ├── chunker.js        # Text chunking
│       │   └── analyzer.js       # Claude analysis
│       │
│       ├── index.js              # Public API (deprecated wrappers)
│       ├── controls/             # Validation & quality
│       ├── prompts/              # Claude prompts
│       └── schemas/              # Output schemas
│
├── routes/
│   ├── documents.js              # → analyzeDocument() kullanır
│   └── tender-content-documents.js  # → analyzeDocument() kullanır
│
└── services/
    ├── document.js               # → analyzeDocument() kullanır
    └── document-queue-processor.js  # → analyzeDocument() kullanır
```

---

## 4. PROVIDER PRİORİTESİ

| Sıra | Provider | Koşul | Hız | Doğruluk |
|------|----------|-------|-----|----------|
| 1 | `azure-custom` | AZURE_USE_CUSTOM_MODEL=true | ~25s | ★★★★★ |
| 2 | `azure-layout+claude` | AZURE_DOCUMENT_AI_ENABLED=true | ~45s | ★★★★☆ |
| 3 | `claude-fallback` | Her zaman kullanılabilir | ~90s | ★★★☆☆ |

---

## 5. ENVIRONMENT VARIABLES

```env
# AZURE CUSTOM MODEL (Önerilen)
AZURE_DOCUMENT_AI_ENABLED=true
AZURE_DOCUMENT_AI_ENDPOINT=https://your-resource.cognitiveservices.azure.com/
AZURE_DOCUMENT_AI_KEY=your-key
AZURE_USE_CUSTOM_MODEL=true
AZURE_DOCUMENT_AI_MODEL_ID=ihale-catering-v1

# CLAUDE (Fallback)
ANTHROPIC_API_KEY=your-key
CLAUDE_MODEL=claude-sonnet-4-20250514
```

---

## 6. OUTPUT FORMAT

```javascript
{
  success: true,
  
  // Ana analiz sonucu
  analysis: {
    summary: {
      title: "İhale Başlığı",
      institution: "Kurum Adı",
      ikn: "2024/123456",
      budget: 1500000,
    },
    catering: {
      total_persons: 500,
      daily_meals: 3,
      sample_menus: [...],
      gramaj: [...],
    },
    personnel: {
      staff: [...],
      total_count: 25,
    },
    dates: {
      start_date: "2024-03-01",
      end_date: "2025-02-28",
      duration_days: 365,
    },
  },
  
  // Text extraction bilgisi
  extraction: {
    text: "...",
    pages: 45,
    ocrApplied: false,
  },
  
  // Kalite metrikleri
  validation: {
    completeness_score: 85,
    missing_fields: ["catering.gramaj"],
  },
  
  // Meta bilgiler
  meta: {
    provider_used: "azure-custom+claude",
    elapsed_ms: 28500,
    document_id: "unified_123456_abc",
    pipeline_version: "9.0",
  },
}
```

---

## 7. HEALTH CHECK

```javascript
import { checkPipelineHealth } from './services/ai-analyzer/unified-pipeline.js';

const health = await checkPipelineHealth();
// {
//   version: "9.0",
//   azure: { configured: true, healthy: true, customModelExists: true },
//   customModel: { enabled: true, modelId: "ihale-catering-v1" },
//   claude: { configured: true },
// }
```

---

## 8. MİGRASYON REHBERİ

### Eski Kod → Yeni Kod

```javascript
// ESKİ (v5.0-v8.0):
import { runPipeline } from './services/ai-analyzer/pipeline/index.js';
const result = await runPipeline(filePath);

// YENİ (v9.0):
import { analyzeDocument } from './services/ai-analyzer/unified-pipeline.js';
const result = await analyzeDocument(filePath);
```

### Sonuç Format Değişiklikleri

```javascript
// ESKİ:
result.meta.provider  → result.meta.provider_used
result.meta.chunks    → result.stats.chunks_processed
result.meta.stats     → result.stats

// YENİ ALANLAR:
result.validation.completeness_score
result.validation.missing_fields
result.extraction.ocrApplied
```

---

## 9. SORUN GİDERME

### Azure Custom Model çalışmıyor
```bash
# Config kontrol
node -e "require('dotenv').config(); console.log({
  enabled: process.env.AZURE_USE_CUSTOM_MODEL,
  modelId: process.env.AZURE_DOCUMENT_AI_MODEL_ID,
  endpoint: process.env.AZURE_DOCUMENT_AI_ENDPOINT?.slice(0,30),
})"
```

### Hangi provider kullanılıyor?
```javascript
const result = await analyzeDocument(filePath);
console.log('Provider:', result.meta?.provider_used);
// "azure-custom+claude" veya "azure-layout+claude" veya "claude-fallback"
```

### Completeness düşük
```javascript
const result = await analyzeDocument(filePath);
console.log('Missing:', result.validation?.missing_fields);
// ["catering.gramaj", "personnel.staff"] gibi
```

---

**TEK MERKEZİ SİSTEM - v9.0**  
*Tüm document analysis işlemleri `analyzeDocument()` fonksiyonundan geçer.*
