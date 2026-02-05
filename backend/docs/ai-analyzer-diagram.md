# AI Analyzer - Unified Pipeline v8.0 Diyagramı

## 1. Sistem Mimarisi

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
│             │                            │                          │          │
│             └────────────────────────────┼──────────────────────────┘          │
└──────────────────────────────────────────┼──────────────────────────────────────┘
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          UNIFIED PIPELINE v8.0                                   │
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
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## 2. Pipeline Akış Detayı

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         UNIFIED PIPELINE AKIŞI                                   │
│                                                                                  │
│   DOSYA GİRİŞİ                                                                   │
│       │                                                                          │
│       ▼                                                                          │
│   ┌───────────────────────────────────────────────────────────────────────┐     │
│   │  [5%] Belge Yükleme ve Doğrulama                                       │     │
│   └───────────────────────────────────────────────────────────────────────┘     │
│       │                                                                          │
│       ▼                                                                          │
│   ┌───────────────────────────────────────────────────────────────────────┐     │
│   │  Azure Custom Model aktif mi?                                          │     │
│   │  AZURE_USE_CUSTOM_MODEL=true && modelId var mı?                        │     │
│   └───────────────────────────────────────────────────────────────────────┘     │
│       │                                                                          │
│       ├─── EVET ──────────────────────────────────────────────────────────┐     │
│       │                                                                    │     │
│       │   ┌────────────────────────────────────────────────────────────┐  │     │
│       │   │  [15%] Azure Custom Model Analizi                           │  │     │
│       │   │  • ihale-catering-v1 modeli                                 │  │     │
│       │   │  • Doğrudan field extraction                                │  │     │
│       │   └────────────────────────────────────────────────────────────┘  │     │
│       │       │                                                           │     │
│       │       ├─── BAŞARILI ──→ Claude Semantic ile zenginleştir        │     │
│       │       │                                                           │     │
│       │       └─── BAŞARISIZ ──→ Azure Layout'a düş                      │     │
│       │                                                                    │     │
│       └─── HAYIR ─────────────────────────────────────────────────────────┘     │
│       │                                                                          │
│       ▼                                                                          │
│   ┌───────────────────────────────────────────────────────────────────────┐     │
│   │  [25%] Azure Layout Analizi (prebuilt-layout)                          │     │
│   │  • Tablo çıkarma                                                       │     │
│   │  • Paragraf yapısı                                                     │     │
│   │  • Form alanları                                                       │     │
│   └───────────────────────────────────────────────────────────────────────┘     │
│       │                                                                          │
│       ├─── BAŞARILI ──────────────────────────────────────────────────────┐     │
│       │                                                                    │     │
│       │   ┌────────────────────────────────────────────────────────────┐  │     │
│       │   │  [50%] Claude Semantic Analizi                              │  │     │
│       │   │  • Azure çıktısını zenginleştir                             │  │     │
│       │   │  • Anlam çıkarma                                            │  │     │
│       │   │  • Field mapping                                            │  │     │
│       │   └────────────────────────────────────────────────────────────┘  │     │
│       │       │                                                           │     │
│       │       ▼                                                           │     │
│       │   ┌────────────────────────────────────────────────────────────┐  │     │
│       │   │  [90%] Sonuç Birleştirme                                    │  │     │
│       │   │  • Azure + Claude → Unified result                          │  │     │
│       │   └────────────────────────────────────────────────────────────┘  │     │
│       │                                                                    │     │
│       └─── BAŞARISIZ ─────────────────────────────────────────────────────┘     │
│       │                                                                          │
│       ▼                                                                          │
│   ┌───────────────────────────────────────────────────────────────────────┐     │
│   │  ZERO-LOSS PIPELINE (Fallback)                                         │     │
│   │                                                                        │     │
│   │  Layer 0: Raw Capture (metin + OCR)                                    │     │
│   │  Layer 1: Structure Detection                                          │     │
│   │  Layer 2: Semantic Chunking                                            │     │
│   │  Layer 3: Field Extraction                                             │     │
│   │  Layer 4: Cross-Reference                                              │     │
│   │  Layer 5: Conflict Detection                                           │     │
│   │  Layer 6: Assembly                                                     │     │
│   │  Layer 7: Validation                                                   │     │
│   └───────────────────────────────────────────────────────────────────────┘     │
│       │                                                                          │
│       ▼                                                                          │
│   ┌───────────────────────────────────────────────────────────────────────┐     │
│   │  [100%] Analiz Tamamlandı                                              │     │
│   │                                                                        │     │
│   │  ÇIKTI: UnifiedPipelineResult                                          │     │
│   │  {                                                                     │     │
│   │    success: true,                                                      │     │
│   │    provider: 'azure-layout+claude' | 'claude-zero-loss',              │     │
│   │    extraction: { text, structured, ocrApplied },                      │     │
│   │    analysis: { ozet, teknik_sartlar, birim_fiyatlar, ... },          │     │
│   │    validation: { completeness_score },                                │     │
│   │    stats: { totalDuration }                                           │     │
│   │  }                                                                     │     │
│   └───────────────────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## 3. Azure Document Intelligence Detayı

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      AZURE DOCUMENT INTELLIGENCE                                 │
│                                                                                  │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │  CUSTOM MODEL (ihale-catering-v1)                                        │   │
│   │                                                                          │   │
│   │  Eğitilmiş alanlar:                                                      │   │
│   │  • kurum_adi                                                             │   │
│   │  • ihale_kayit_no (IKN)                                                  │   │
│   │  • tahmini_bedel                                                         │   │
│   │  • baslangic_tarihi, bitis_tarihi                                        │   │
│   │  • kisi_sayisi                                                           │   │
│   │  • ogun_detaylari                                                        │   │
│   │  • gramaj_tablosu                                                        │   │
│   │                                                                          │   │
│   │  Aktivasyon: AZURE_USE_CUSTOM_MODEL=true                                 │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │  PREBUILT-LAYOUT                                                         │   │
│   │                                                                          │   │
│   │  Çıktılar:                                                               │   │
│   │  • tables[] (tablo yapıları)                                             │   │
│   │  • paragraphs[] (metin blokları)                                         │   │
│   │  • keyValuePairs[] (form alanları)                                       │   │
│   │  • selectionMarks[] (checkbox'lar)                                       │   │
│   │                                                                          │   │
│   │  Varsayılan mod (AZURE_USE_CUSTOM_MODEL=false)                           │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## 4. Dosya Yapısı

```
backend/src/services/ai-analyzer/
├── unified-pipeline.js       ← ⭐ TEK MERKEZİ SİSTEM
│   ├── analyzeDocument()         → Ana fonksiyon
│   ├── checkPipelineHealth()     → Sağlık kontrolü
│   ├── analyzeWithCustomModel()  → Azure Custom
│   ├── analyzeWithLayout()       → Azure Layout
│   └── enhanceWithClaude()       → Claude zenginleştirme
│
├── index.js                  ← Public API (export'lar)
│
├── pipeline/                 ← Zero-Loss Pipeline (fallback)
│   ├── index.js              → Orchestrator
│   ├── extractor.js          → Layer 0: Raw Capture
│   ├── structure.js          → Layer 1: Structure Detection
│   ├── chunker.js            → Layer 2: Semantic Chunking
│   ├── analyzer.js           → Layer 3: Field Extraction
│   ├── conflict.js           → Layer 5: Conflict Detection
│   ├── assembler.js          → Layer 6: Assembly
│   └── validator.js          → Layer 7: Validation
│
├── controls/                 ← P0 Kontrol Sistemleri
│   └── p0-checks.js
│
├── prompts/                  ← Claude prompts
├── schemas/                  ← JSON şemaları
└── utils/                    ← Yardımcı fonksiyonlar
```

## 5. Desteklenen Dosya Formatları

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          SUPPORTED_FORMATS                                       │
│                                                                                  │
│   PDF             IMAGE              DOCUMENT          SPREADSHEET              │
│   ────            ─────              ────────          ───────────              │
│   .pdf            .png               .docx             .xlsx                    │
│                   .jpg               .doc              .xls                     │
│                   .jpeg              .rtf              .ods                     │
│                   .webp              .odt              .csv                     │
│                   .gif                                                          │
│                   .tiff                                                         │
│                   .bmp                                                          │
│                                                                                  │
│   ZIP (Özel İşlem)                                                              │
│   ────────────────                                                              │
│   .zip → İçindeki desteklenen dosyalar ayrı ayrı işlenir                       │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## 6. Konfigürasyon

```bash
# .env dosyası

# Azure Document Intelligence
AZURE_DOCUMENT_AI_ENABLED=true
AZURE_DOCUMENT_AI_ENDPOINT=https://your-resource.cognitiveservices.azure.com/
AZURE_DOCUMENT_AI_KEY=your-api-key
AZURE_DOCUMENT_AI_MODEL_ID=ihale-catering-v1
AZURE_USE_CUSTOM_MODEL=false  # true = custom model öncelikli

# Claude
ANTHROPIC_API_KEY=your-api-key
CLAUDE_MODEL=claude-sonnet-4-20250514
```

## 7. Kullanım Örnekleri

```javascript
// Temel kullanım
import { analyzeDocument } from './services/ai-analyzer/unified-pipeline.js';

const result = await analyzeDocument('/path/to/document.pdf', {
  onProgress: (p) => console.log(p.message, p.progress + '%')
});

// Sonuç yapısı
{
  success: true,
  provider: 'azure-layout+claude',
  extraction: { text, structured, ocrApplied },
  analysis: { ozet, teknik_sartlar, birim_fiyatlar, ... },
  validation: { completeness_score },
  stats: { totalDuration }
}
```

## 8. Bağımlılıklar

```
Harici Kütüphaneler:
├── @anthropic-ai/sdk           → Claude API
├── @azure/ai-form-recognizer   → Azure Document Intelligence
├── pdf-parse                   → PDF metin çıkarma
├── mammoth                     → DOCX okuma
├── xlsx                        → Excel okuma
├── file-type                   → Dosya türü tespiti
└── sharp                       → Görsel işleme

Dahili Bağımlılıklar:
├── config/ai.config.js         → AI ayarları
└── utils/logger.js             → Loglama
```
