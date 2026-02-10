# Döküman Analiz Pipeline'ı v9.0 (Unified Pipeline)

> **Son Güncelleme:** 2026-02-07
> **Durum:** AKTİF - Tüm document analysis işlemleri bu pipeline üzerinden geçer

---

## 1. Genel Bakış

Tek merkezi sistem: `analyzeDocument()` fonksiyonu tüm döküman analizlerinin tek giriş noktasıdır. Azure Document Intelligence + Claude AI hibrit mimarisi ile çalışır.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND / API İSTEĞİ                               │
└───────────────────────────────────────┬─────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                               ROUTE KATMANI                                      │
│  ┌─────────────────────┐  ┌──────────────────────────────┐  ┌────────────────┐ │
│  │  routes/documents   │  │ routes/tender-content-docs   │  │ services/doc   │ │
│  │      .js            │  │          .js                 │  │    .js         │ │
│  └──────────┬──────────┘  └──────────────┬───────────────┘  └───────┬────────┘ │
│             └────────────────────────────┼──────────────────────────┘          │
└──────────────────────────────────────────┼──────────────────────────────────────┘
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          UNIFIED PIPELINE v9.0                                   │
│                        unified-pipeline.js                                       │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  ⭐ analyzeDocument(filePath, options)                                   │   │
│  │     TEK GİRİŞ NOKTASI - TÜM ANALİZLER İÇİN                              │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                    │                                            │
│        ┌───────────────────────────┼───────────────────────┐                   │
│        ▼                           ▼                       ▼                   │
│  ┌───────────────┐       ┌─────────────────┐       ┌─────────────────┐        │
│  │ Azure Custom  │       │  Azure Layout   │       │   Zero-Loss     │        │
│  │    Model      │  →    │   + Claude      │  →    │   Pipeline      │        │
│  │ (Eğitilmiş)   │       │   (Hibrit)      │       │   (Fallback)    │        │
│  └───────────────┘       └─────────────────┘       └─────────────────┘        │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Kullanım

### Programatik

```javascript
// TEK DOĞRU YÖNTEM:
import { analyzeDocument } from './services/ai-analyzer/unified-pipeline.js';

const result = await analyzeDocument(filePath, {
  onProgress: (progress) => console.log(progress),
});

// Sonuç yapısı: bkz. Bölüm 7 - Output Format
```

### KULLANMAYIN (Deprecated):
```javascript
// ❌ ESKİ - DEPRECATED
import { runPipeline } from './services/ai-analyzer/pipeline/index.js';
import { analyzeFile } from './services/ai-analyzer/index.js';
import { runZeroLossPipeline } from './services/ai-analyzer/pipeline/index.js';
```

### API Endpoint

```bash
curl -X POST http://localhost:3001/api/documents/analyze-pipeline \
  -F "file=@document.pdf" \
  -F "tender_id=123"

# SSE response akışı:
# data: {"stage":"azure-layout","message":"Azure Layout analiz ediyor...","progress":25}
# data: {"stage":"claude-semantic","message":"Claude semantic analiz yapıyor...","progress":50}
# data: {"stage":"complete","result":{...},"document_id":"uuid"}
```

### Queue Processor Entegrasyonu

```javascript
import { analyzeDocument } from './ai-analyzer/unified-pipeline.js';

const result = await analyzeDocument(filePath, {
  enableP0Checks: true,
  enableConflictDetection: true,
});
```

---

## 3. Pipeline Akış Detayı

```
DOSYA GİRİŞİ
    │
    ▼
┌───────────────────────────────────────────────────────────────────────┐
│  [5%] Belge Yükleme ve Doğrulama                                      │
└───────────────────────────────────────────────────────────────────────┘
    │
    ▼
┌───────────────────────────────────────────────────────────────────────┐
│  Azure Custom Model aktif mi?                                          │
│  AZURE_USE_CUSTOM_MODEL=true && modelId var mı?                        │
└───────────────────────────────────────────────────────────────────────┘
    │
    ├─── EVET ──────────────────────────────────────────────────────┐
    │                                                                │
    │   ┌────────────────────────────────────────────────────────┐  │
    │   │  [15%] Azure Custom Model Analizi                       │  │
    │   │  • ihale-catering-v1 modeli                             │  │
    │   │  • Doğrudan field extraction                            │  │
    │   └────────────────────────────────────────────────────────┘  │
    │       │                                                       │
    │       ├─── BAŞARILI ──→ Claude Semantic ile zenginleştir     │
    │       └─── BAŞARISIZ ──→ Azure Layout'a düş                  │
    │                                                                │
    └─── HAYIR ─────────────────────────────────────────────────────┘
    │
    ▼
┌───────────────────────────────────────────────────────────────────────┐
│  [25%] Azure Layout Analizi (prebuilt-layout)                          │
│  • Tablo çıkarma                                                       │
│  • Paragraf yapısı                                                     │
│  • Form alanları                                                       │
└───────────────────────────────────────────────────────────────────────┘
    │
    ├─── BAŞARILI ──────────────────────────────────────────────────┐
    │                                                                │
    │   ┌────────────────────────────────────────────────────────┐  │
    │   │  [50%] Claude Semantic Analizi                          │  │
    │   │  • Azure çıktısını zenginleştir                         │  │
    │   │  • Anlam çıkarma ve field mapping                       │  │
    │   └────────────────────────────────────────────────────────┘  │
    │       │                                                       │
    │       ▼                                                       │
    │   ┌────────────────────────────────────────────────────────┐  │
    │   │  [90%] Sonuç Birleştirme                                │  │
    │   │  • Azure + Claude → Unified result                      │  │
    │   └────────────────────────────────────────────────────────┘  │
    │                                                                │
    └─── BAŞARISIZ ─────────────────────────────────────────────────┘
    │
    ▼
┌───────────────────────────────────────────────────────────────────────┐
│  ZERO-LOSS PIPELINE (Fallback) - 7 Katmanlı Mimari                    │
│                                                                        │
│  Layer 0: Raw Capture (metin + OCR)                                    │
│  Layer 1: Structure Detection (başlık, tablo, referans tespiti)        │
│  Layer 2: Semantic Chunking (akıllı bölümleme)                         │
│  Layer 3: Field Extraction (Claude Haiku → alan çıkarma)               │
│  Layer 4: Cross-Reference (çapraz doğrulama)                           │
│  Layer 5: Conflict Detection (çakışma tespiti)                         │
│  Layer 6: Assembly (Claude Sonnet → sonuç birleştirme)                 │
│  Layer 7: Validation (completeness score + kalite kontrol)             │
└───────────────────────────────────────────────────────────────────────┘
    │
    ▼
┌───────────────────────────────────────────────────────────────────────┐
│  [100%] Analiz Tamamlandı → UnifiedPipelineResult                      │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 4. Provider Öncelikleri

| Sıra | Provider | Koşul | Hız | Doğruluk | Tahmini Maliyet (50 sayfa) |
|------|----------|-------|-----|----------|---------------------------|
| 1 | `azure-custom` | AZURE_USE_CUSTOM_MODEL=true | ~25s | ★★★★★ | ~$0.18 |
| 2 | `azure-layout+claude` | AZURE_DOCUMENT_AI_ENABLED=true | ~45s | ★★★★☆ | ~$0.18 |
| 3 | `claude-fallback` | Her zaman kullanılabilir | ~90s | ★★★☆☆ | ~$1.50 |

Azure kullanımı ile ~%88 maliyet tasarrufu sağlanır.

---

## 5. Azure Document Intelligence

### Custom Model (ihale-catering-v1)

Eğitilmiş alanlar:
- `kurum_adi` - İhaleyi açan kurum
- `ihale_kayit_no` (IKN) - İhale kayıt numarası
- `tahmini_bedel` - Yaklaşık maliyet
- `baslangic_tarihi`, `bitis_tarihi` - Sözleşme tarihleri
- `kisi_sayisi` - Toplam kişi sayısı
- `ogun_detaylari` - Öğün bilgileri
- `gramaj_tablosu` - Gramaj tablosu

Aktivasyon: `AZURE_USE_CUSTOM_MODEL=true`

### Prebuilt-Layout (Varsayılan Mod)

Çıktılar:
- `tables[]` - Tablo yapıları
- `paragraphs[]` - Metin blokları
- `keyValuePairs[]` - Form alanları
- `selectionMarks[]` - Checkbox'lar

Aktivasyon: `AZURE_USE_CUSTOM_MODEL=false` (varsayılan)

---

## 6. Dosya Yapısı

```
backend/src/services/ai-analyzer/
├── unified-pipeline.js       ← ⭐ TEK MERKEZİ SİSTEM
│   ├── analyzeDocument()         → Ana fonksiyon
│   ├── checkPipelineHealth()     → Sağlık kontrolü
│   ├── analyzeWithCustomModel()  → Azure Custom
│   ├── analyzeWithLayout()       → Azure Layout
│   └── enhanceWithClaude()       → Claude zenginleştirme
│
├── index.js                  ← Public API (deprecated wrapper'lar)
│
├── pipeline/                 ← Zero-Loss Pipeline (fallback)
│   ├── index.js              → Orchestrator
│   ├── extractor.js          → Layer 0: Raw Capture
│   ├── structure.js          → Layer 1: Structure Detection
│   ├── chunker.js            → Layer 2: Semantic Chunking
│   ├── analyzer.js           → Layer 3: Field Extraction (Haiku→Sonnet)
│   ├── conflict.js           → Layer 5: Conflict Detection
│   ├── assembler.js          → Layer 6: Assembly
│   └── validator.js          → Layer 7: Validation
│
├── controls/                 ← P0 Kontrol Sistemleri
│   ├── p0-checks.js          → Hash, JSON validation, tablo bütünlüğü
│   ├── field-validator.js    → Alan doğrulama
│   ├── quality-metrics.js    → Kalite metrikleri
│   └── conflict-resolver.js  → Çakışma çözücü
│
├── prompts/                  ← Claude prompt şablonları
│   ├── extract-full.js       → Tam çıkarma
│   ├── extract-dates.js      → Tarih çıkarma
│   ├── extract-amounts.js    → Tutar çıkarma
│   ├── extract-penalties.js  → Ceza/yaptırım
│   ├── extract-menu.js       → Menü/yemek
│   ├── extract-personnel.js  → Personel
│   └── catering-terminology.js → Sektör terminolojisi
│
├── schemas/                  ← JSON çıktı şemaları
│   ├── chunk-output.js
│   ├── document-output.js
│   └── final-output.js
│
├── providers/
│   └── azure-document-ai.js  → Azure DI entegrasyonu
│
└── utils/
    └── parser.js              → JSON parse vb.
```

---

## 7. Output Format

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

## 8. Environment Variables

```env
# Azure Document Intelligence
AZURE_DOCUMENT_AI_ENABLED=true
AZURE_DOCUMENT_AI_ENDPOINT=https://your-resource.cognitiveservices.azure.com/
AZURE_DOCUMENT_AI_KEY=your-key
AZURE_DOCUMENT_AI_MODEL_ID=ihale-catering-v1
AZURE_USE_CUSTOM_MODEL=false  # true = custom model öncelikli

# Claude (Fallback)
ANTHROPIC_API_KEY=your-key
CLAUDE_MODEL=claude-opus-4-6
```

---

## 9. Health Check

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

## 10. Desteklenen Formatlar

| Format | Uzantılar | Analiz Yöntemi |
|--------|-----------|----------------|
| PDF | `.pdf` | Text extraction + OCR (taranmış için) |
| Görsel | `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`, `.tiff`, `.bmp` | Claude Vision |
| Word | `.doc`, `.docx`, `.rtf`, `.odt` | Mammoth text extraction |
| Excel | `.xls`, `.xlsx`, `.ods`, `.csv` | XLSX parser |
| Metin | `.txt`, `.xml`, `.json` | Doğrudan analiz |
| Arşiv | `.zip` | Açma + içerik analizi |

---

## 11. Migrasyon Rehberi (Eski → Yeni)

```javascript
// ESKİ (v5.0-v8.0):
import { runPipeline } from './services/ai-analyzer/pipeline/index.js';
const result = await runPipeline(filePath);

// YENİ (v9.0):
import { analyzeDocument } from './services/ai-analyzer/unified-pipeline.js';
const result = await analyzeDocument(filePath);
```

### Format Değişiklikleri
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

## 12. Bağımlılıklar

**Harici:**
- `@anthropic-ai/sdk` - Claude API
- `@azure/ai-form-recognizer` - Azure Document Intelligence
- `pdf-parse` - PDF metin çıkarma
- `mammoth` - DOCX okuma
- `xlsx` - Excel okuma
- `file-type` - Dosya türü tespiti
- `sharp` - Görsel işleme

**Dahili:**
- `config/ai.config.js` - AI ayarları
- `utils/logger.js` - Loglama

---

## 13. Sorun Giderme

### Azure Custom Model çalışmıyor
```bash
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

*TEK MERKEZİ SİSTEM - v9.0 | Tüm döküman analizleri `analyzeDocument()` üzerinden geçer.*
