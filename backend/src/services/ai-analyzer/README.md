# AI Analyzer Module v8.0 - Unified Pipeline

İhale dökümanlarını otomatik analiz eden **tek merkezi sistem**.

## Unified Pipeline v8.0

```
┌─────────────────────────────────────────────────────────────────┐
│                    analyzeDocument()                            │
│                   TEK GİRİŞ NOKTASI                             │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐   ┌─────────────────┐   ┌─────────────────┐
│ Azure Custom  │ → │  Azure Layout   │ → │   Zero-Loss     │
│    Model      │   │   + Claude      │   │   Pipeline      │
│ (Eğitilmiş)   │   │   (Hibrit)      │   │   (Fallback)    │
└───────────────┘   └─────────────────┘   └─────────────────┘
```

## Yapı

```
ai-analyzer/
├── unified-pipeline.js    # ⭐ TEK MERKEZİ SİSTEM
├── pipeline/              # Zero-Loss Pipeline (fallback)
│   ├── extractor.js       # Metin + OCR çıkarma
│   ├── structure.js       # Yapı tespiti
│   ├── chunker.js         # Parçalama
│   ├── analyzer.js        # AI analizi
│   ├── conflict.js        # Çelişki tespiti
│   ├── assembler.js       # Birleştirme
│   ├── validator.js       # Doğrulama
│   └── index.js           # Pipeline orchestrator
│
├── controls/              # P0 Kontrol Sistemleri
├── prompts/               # Extraction prompts
├── schemas/               # JSON şemaları
├── utils/                 # Yardımcı fonksiyonlar
└── index.js               # Public API
```

## Kullanım

### Ana Fonksiyon - analyzeDocument (v8.0)

```javascript
import { analyzeDocument } from './services/ai-analyzer/unified-pipeline.js';

const result = await analyzeDocument('/path/to/document.pdf', {
  onProgress: (progress) => {
    console.log(`${progress.stage}: ${progress.message} (${progress.progress}%)`);
  },
  enableP0Checks: true,
  enableConflictDetection: true,
});

if (result.success) {
  console.log(result.provider);    // 'azure-layout+claude' veya 'claude-zero-loss'
  console.log(result.analysis);    // Ana analiz sonucu
  console.log(result.conflicts);   // Tespit edilen çelişkiler
  console.log(result.validation);  // Doğrulama raporu
}
```

### ZIP Dosyaları

```javascript
import { analyzeFile } from './services/ai-analyzer';

// ZIP otomatik olarak açılır ve Unified Pipeline ile analiz edilir
const zipResult = await analyzeFile('/path/to/archive.zip');

console.log(zipResult.dosyalar);    // İçindeki dosya listesi
console.log(zipResult.analiz);      // Birleştirilmiş analiz sonucu
console.log(zipResult.conflicts);   // Dosyalar arası çelişkiler
```

### Pipeline Health Check

```javascript
import { checkPipelineHealth } from './services/ai-analyzer/unified-pipeline.js';

const health = await checkPipelineHealth();
// {
//   azure: { configured: true, healthy: true },
//   customModel: { enabled: false, modelId: 'ihale-catering-v1' },
//   claude: { configured: true }
// }
```

## Zero-Loss Pipeline (Fallback) Mimarisi

### Layer 0: Raw Capture (Metin Çıkarma)
- PDF: `pdf-parse` ile text extraction
- Taranmış/Bozuk PDF: OCR (Claude Vision ile sayfa sayfa)
- **PDF Text Quality Assessment**: Tablo yapısı bozuksa otomatik OCR'a yönlendirir
- Office: `mammoth` (docx), `xlsx` (excel)
- Görsel: Claude Vision ile direkt analiz

### Layer 1: Structure Detection (Rule-Based)
- Tablo pattern tespiti (satır/sütun grid)
- Başlık pattern: "Madde X.Y.Z" regex
- Liste pattern: numaralı/madde işaretli
- Dipnot pattern: (*), (1), vb.
- **LLM YOK** - Tamamen rule-based

### Layer 2: Semantic Chunking (P0 Kontrollü)
- Tablo içeriklerini ayrı chunk olarak işaretler
- Sayfa sınırlarını korur
- Context-aware bölümleme (3000 token/chunk)
- **P0 Kontrol**: Tablo bölünme, başlık-içerik birlikteliği

### Layer 3: Field Extraction (Micro/Full)
- **safeJsonParse**: Sayı aralıkları (55-60 → "55-60"), trailing comma düzeltme
- **Gürültü Filtreleme**: Isı değerleri (65°C), operasyonel detaylar filtrelenir
- Paralel chunk analizi (Haiku)
- Final birleştirme (Sonnet)

### Layer 4: Cross-Reference Resolution
- "Madde 8'e bakınız" gibi referansları çözümler
- Bağlamsal bağlantılar

### Layer 5: Conflict Detection
- Aynı alan için farklı değerler → conflict flag
- **ÇÖZMEZ, sadece raporlar**

### Layer 6: Assembly
- Tüm chunk sonuçlarını birleştirir
- **Yeni bilgi ekleme YASAK**
- Conflict preservation

### Layer 7: Validation
- JSON şema doğrulama
- Tamlık skoru hesaplama
- Source traceability kontrolü

## Desteklenen Formatlar

| Format | Uzantılar | Analiz Yöntemi |
|--------|-----------|----------------|
| PDF | `.pdf` | Text extraction + OCR (taranmış için) |
| Görsel | `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`, `.tiff`, `.bmp` | Claude Vision |
| Word | `.doc`, `.docx`, `.rtf`, `.odt` | Mammoth text extraction |
| Excel | `.xls`, `.xlsx`, `.ods`, `.csv` | XLSX parser |
| Sunum | `.pptx`, `.ppt`, `.odp` | Text extraction |
| Metin | `.txt`, `.xml`, `.json` | Doğrudan analiz |
| Arşiv | `.zip` | Açma + içerik analizi |

## Konfigürasyon

| Env Variable | Default | Açıklama |
|--------------|---------|----------|
| `ANTHROPIC_API_KEY` | - | Claude API anahtarı (zorunlu) |
| `CLAUDE_MODEL` | claude-sonnet-4-20250514 | Ana analiz modeli |
| `CLAUDE_FAST_MODEL` | claude-haiku | Chunk analiz modeli |
| `AI_PDF_MAX_PAGES` | 100 | PDF max sayfa limiti |
| `AI_PDF_PARALLEL_PAGES` | 12 | Paralel OCR sayfa sayısı |
| `AI_PDF_DPI` | 120 | OCR için görüntü çözünürlüğü |

Detaylı config: `backend/src/config/ai.config.js`

## Çıktı Formatı

```typescript
interface ZeroLossPipelineResult {
  success: boolean;
  extraction: {
    text: string;
    structured: {
      pageCount: number;
      tables: any[];
    };
    ocrApplied: boolean;
  };
  structure: {
    headings: Heading[];
    tables: Table[];
    lists: List[];
  };
  chunks: Chunk[];
  analysis: {
    ozet: string;
    ihale_turu: string;
    tahmini_bedel: string;
    teknik_sartlar: TeknikSart[];
    birim_fiyatlar: BirimFiyat[];
    takvim: Tarih[];
    onemli_notlar: Not[];
    meta: {
      chunkCount: number;
      method: string;
      totalInputTokens: number;
      totalOutputTokens: number;
    };
  };
  conflicts: Conflict[];  // Tespit edilen çelişkiler
  validation: {
    isValid: boolean;
    completenessScore: number;
    errors: ValidationError[];
  };
  stats: {
    extractDuration: number;
    structureDuration: number;
    chunkDuration: number;
    analyzeDuration: number;
    conflictDuration: number;
    validationDuration: number;
    totalDuration: number;
  };
}

interface Conflict {
  field: string;
  values: { value: any; sourceChunk: string }[];
  needsReview: boolean;
}
```

## Progress Callback

```javascript
const result = await analyzeDocument(path, {
  onProgress: (progress) => {
    // progress.stage: 'extraction' | 'azure-layout' | 'azure-custom' | 
    //                 'claude-semantic' | 'complete'
    // progress.message: İşlem açıklaması
    // progress.progress: 0-100 yüzde
    updateUI(progress);
  }
});
```

## P0 Kontrolleri

Zero-Loss Pipeline her adımda 8 kritik kontrol uygular:

| # | Kontrol | Açıklama |
|---|---------|----------|
| 1 | Tablo Bütünlüğü | Tablolar bölünmeden korunuyor mu? |
| 2 | Başlık-İçerik | Başlıklar içerikleriyle birlikte mi? |
| 3 | Karakter Sayısı | Input/output karakter sayısı eşit mi? |
| 4 | JSON Parse | Tüm JSON çıktıları geçerli mi? |
| 5 | Null vs [] | Null ve boş array doğru ayrılıyor mu? |
| 6 | Yeni Bilgi Yasağı | Assembly'de yeni bilgi eklenmedi mi? |
| 7 | Conflict Preservation | Çelişkiler korundu mu? |
| 8 | Source Traceability | Her veri kaynağına izlenebilir mi? |

## Bağımlılıklar

- `@anthropic-ai/sdk` - Claude API
- `pdf-parse` - PDF text extraction
- `sharp` - Görsel optimizasyonu (OCR için)
- `mammoth` - DOCX okuma
- `xlsx` - Excel okuma
