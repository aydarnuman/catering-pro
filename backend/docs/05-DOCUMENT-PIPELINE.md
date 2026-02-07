# Döküman İşleme Pipeline'ı (v9.0 - Unified Pipeline)

**Tek merkezi sistem** - Azure + Claude hibrit mimarisi.

## Mimari

```
┌─────────────────────────────────────────────────────────────────┐
│                    analyzeDocument()                            │
│                   TEK GİRİŞ NOKTASI                             │
└───────────────────────────────┬─────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
┌───────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Azure Custom  │     │  Azure Layout   │     │   Zero-Loss     │
│    Model      │  →  │   + Claude      │  →  │   Pipeline      │
│ (Eğitilmiş)   │     │   (Hibrit)      │     │   (Fallback)    │
└───────────────┘     └─────────────────┘     └─────────────────┘
```

## Kullanım

### Programatik

```javascript
import { analyzeDocument } from './services/ai-analyzer/unified-pipeline.js';

const result = await analyzeDocument('/path/to/file.pdf', {
  onProgress: (p) => console.log(p.message),
});

// Sonuç yapısı
{
  success: true,
  provider: 'azure-layout+claude',  // veya 'claude-zero-loss'
  extraction: {
    text: '...',
    structured: { pageCount: 25, tables: [] },
    ocrApplied: false,
  },
  analysis: {
    ozet: "İhale özeti...",
    teknik_sartlar: [...],
    birim_fiyatlar: [...],
    takvim: [...],
  },
  stats: {
    totalDuration: 12500,
  },
  validation: {
    completeness_score: 85,
  }
}
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

## Pipeline Akışı

### 1. Azure Custom Model (Öncelikli)
- Eğitilmiş ihale-catering-v1 modeli
- `AZURE_USE_CUSTOM_MODEL=true` ile aktif
- En yüksek doğruluk

### 2. Azure Layout + Claude Semantic (Varsayılan)
- Azure: Tablo ve yapı çıkarma
- Claude: Anlam analizi ve zenginleştirme
- Dengeli maliyet/performans

### 3. Zero-Loss Pipeline (Fallback)
- Pure Claude analizi
- Azure başarısız olursa devreye girer
- 7 katmanlı mimari

## Dosya Yapısı

```
src/services/ai-analyzer/
├── unified-pipeline.js  → ⭐ TEK MERKEZİ SİSTEM
├── pipeline/
│   ├── index.js         → Zero-Loss orchestrator
│   ├── extractor.js     → Metin + OCR çıkarma
│   ├── chunker.js       → Akıllı bölümleme
│   └── analyzer.js      → Claude analizi
└── index.js             → Public API
```

## Konfigürasyon (.env)

```bash
# Azure Document Intelligence
AZURE_DOCUMENT_AI_ENABLED=true
AZURE_DOCUMENT_AI_ENDPOINT=https://...
AZURE_DOCUMENT_AI_KEY=...
AZURE_DOCUMENT_AI_MODEL_ID=ihale-catering-v1
AZURE_USE_CUSTOM_MODEL=false  # true = custom model aktif

# Claude
ANTHROPIC_API_KEY=...
```

## Health Check

```javascript
import { checkPipelineHealth } from './services/ai-analyzer/unified-pipeline.js';

const health = await checkPipelineHealth();
// {
//   azure: { configured: true, healthy: true },
//   customModel: { enabled: false, modelId: 'ihale-catering-v1' },
//   claude: { configured: true }
// }
```

## Desteklenen Formatlar

| Format | Uzantılar | Analiz Yöntemi |
|--------|-----------|----------------|
| PDF | `.pdf` | Text extraction + OCR (taranmış için) |
| Görsel | `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`, `.tiff`, `.bmp` | Claude Vision |
| Word | `.doc`, `.docx`, `.rtf`, `.odt` | Mammoth text extraction |
| Excel | `.xls`, `.xlsx`, `.ods`, `.csv` | XLSX parser |
| Metin | `.txt`, `.xml`, `.json` | Doğrudan analiz |
| Arşiv | `.zip` | Açma + içerik analizi |

## Queue Processor Entegrasyonu

Queue processor artık Unified Pipeline kullanır:

```javascript
import { analyzeDocument } from './ai-analyzer/unified-pipeline.js';

// Tüm dökümanlar tek pipeline ile işlenir
const result = await analyzeDocument(filePath, {
  enableP0Checks: true,
  enableConflictDetection: true,
});
```

## Maliyet Karşılaştırması

| Yöntem | 50 sayfa PDF | Tahmini Maliyet |
|--------|--------------|-----------------|
| Sadece Claude | 50 × Sonnet | ~$1.50 |
| Azure Layout + Claude | Azure $0.08 + Claude $0.10 | ~$0.18 |
| **Tasarruf** | | **~88%** |
