# AI Analyzer Module

Claude AI ile döküman analiz modülü. İhale şartnamelerini otomatik olarak analiz eder ve yapılandırılmış veri çıkarır.

## Yapı

```
ai-analyzer/
├── core/                    # Temel modüller
│   ├── client.js           # Claude API client (singleton)
│   ├── prompts.js          # Prompt şablonları
│   └── index.js            # Core exports
│
├── analyzers/              # Dosya tipi analizörleri
│   ├── pdf.js              # PDF analizi (görsel + doğrudan)
│   ├── image.js            # Görsel analizi
│   ├── office.js           # Word/Excel analizi
│   ├── text.js             # Metin analizi
│   └── index.js            # Analyzer exports
│
├── utils/                  # Yardımcı fonksiyonlar
│   ├── parser.js           # JSON parse, merge helpers
│   └── index.js            # Utils exports
│
└── index.js                # Public API
```

## Kullanım

### Ana Fonksiyon

```javascript
import { analyzeFile } from './services/ai-analyzer';

// Herhangi bir dosyayı analiz et (otomatik tip tespiti)
const result = await analyzeFile('/path/to/document.pdf', (progress) => {
  console.log(`${progress.stage}: ${progress.message}`);
});

console.log(result.analiz);
// {
//   tam_metin: "İhale özeti...",
//   ihale_basligi: "...",
//   kurum: "...",
//   tarih: "...",
//   bedel: "...",
//   teknik_sartlar: [...],
//   birim_fiyatlar: [...],
//   ...
// }
```

### Spesifik Analizörler

```javascript
import { 
  analyzePdf, 
  analyzeImageFile, 
  analyzeDocx, 
  analyzeExcel,
  analyzeTextFile 
} from './services/ai-analyzer';

// PDF analizi (sayfa sayfa görsel analiz)
const pdfResult = await analyzePdf('/path/to/file.pdf');

// Görsel analizi
const imageResult = await analyzeImageFile('/path/to/image.png');

// Word dökümanı
const docResult = await analyzeDocx('/path/to/file.docx');

// Excel tablosu
const excelResult = await analyzeExcel('/path/to/file.xlsx');

// Metin dosyası
const textResult = await analyzeTextFile('/path/to/file.txt');
```

### ZIP Dosyaları

```javascript
// ZIP otomatik olarak açılır ve içindeki dosyalar ayrı ayrı analiz edilir
const zipResult = await analyzeFile('/path/to/archive.zip');

console.log(zipResult.dosyalar);    // İçindeki dosya listesi
console.log(zipResult.analiz);      // Birleştirilmiş analiz sonucu
```

## Desteklenen Formatlar

| Format | Uzantılar | Analiz Yöntemi |
|--------|-----------|----------------|
| PDF | `.pdf` | Görsel (sayfa sayfa) veya doğrudan |
| Görsel | `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif` | Claude Vision |
| Word | `.doc`, `.docx` | Metin çıkarma + analiz |
| Excel | `.xls`, `.xlsx` | Tablo analizi |
| Metin | `.txt`, `.csv` | Doğrudan analiz |
| Arşiv | `.zip`, `.rar` | Açma + içerik analizi |

## Konfigürasyon

| Env Variable | Default | Açıklama |
|--------------|---------|----------|
| `ANTHROPIC_API_KEY` | - | Claude API anahtarı (zorunlu) |
| `CLAUDE_MODEL` | claude-sonnet-4-20250514 | Kullanılacak model |
| `CLAUDE_MAX_TOKENS` | 4096 | Max token sayısı |
| `AI_PDF_MAX_PAGES` | 50 | PDF max sayfa limiti |
| `AI_PDF_PARALLEL_PAGES` | 3 | Paralel sayfa dönüşümü |

Detaylı config: `backend/src/config/ai.config.js`

## Çıktı Formatı

```typescript
interface AnalysisResult {
  success: boolean;
  toplam_sayfa: number;
  analiz: {
    tam_metin: string;
    ihale_basligi: string;
    kurum: string;
    tarih: string;
    bedel: string;
    sure: string;
    gunluk_ogun_sayisi?: string;
    kisi_sayisi?: string;
    teknik_sartlar: string[];
    birim_fiyatlar: BirimFiyat[];
    iletisim: Record<string, string>;
    notlar: string[];
  };
  ham_sayfalar?: PageResult[];
  sure_saniye?: number;
}

interface BirimFiyat {
  kalem: string;
  birim: string;
  miktar: string;
  fiyat?: string;
}
```

## Progress Callback

```javascript
const result = await analyzeFile(path, (progress) => {
  // progress.stage: 'converting' | 'analyzing' | 'merging' | 'extracting'
  // progress.message: İşlem açıklaması
  // progress.progress: 0-100 yüzde (opsiyonel)
  
  updateUI(progress);
});
```

## Error Handling

```javascript
import { AIApiError, AIParseError, FileTypeError } from './lib/errors.js';

try {
  const result = await analyzeFile(path);
} catch (error) {
  if (error instanceof FileTypeError) {
    console.log('Desteklenmeyen dosya formatı');
  } else if (error instanceof AIApiError) {
    console.log('Claude API hatası:', error.message);
  } else if (error instanceof AIParseError) {
    console.log('Analiz sonucu parse edilemedi');
  }
}
```

## Import

```javascript
import { analyzeFile, analyzePdf, analyzeImageFile } from './services/ai-analyzer';
```

## Performans İpuçları

1. **PDF'ler için**: Büyük PDF'leri bölmeyi düşünün
2. **Paralel analiz**: ZIP içindeki dosyalar sıralı işlenir (rate limit)
3. **Cache**: Analiz sonuçları DB'de saklanır, tekrar analiz etmeyin
4. **Timeout**: Büyük dosyalar için timeout artırın

## Bağımlılıklar

- `@anthropic-ai/sdk` - Claude API
- `pdf2pic` - PDF → görsel dönüşümü
- `sharp` - Görsel optimizasyonu
- `mammoth` - DOCX okuma
- `xlsx` - Excel okuma
- `adm-zip` - ZIP açma
