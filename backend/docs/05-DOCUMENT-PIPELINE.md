# Döküman İşleme Pipeline'ı (v5.2)

3 katmanlı döküman işleme mimarisi + retry/streaming desteği.

## Mimari

```
┌─────────────────────────────────────────────────────────────┐
│ LAYER 1: EXTRACTION (Veri Kaybı SIFIR)                     │
├─────────────────────────────────────────────────────────────┤
│ PDF    → pdf-parse (metin) + Claude Vision (OCR)           │
│ XLSX   → JSON yapısı korunur (satır/sütun/sayfa)           │
│ DOCX   → Mammoth (HTML + düz metin)                        │
│ ZIP    → Recursive extraction                              │
│ IMAGE  → Claude Vision OCR                                 │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ LAYER 2: SMART CHUNKING                                    │
├─────────────────────────────────────────────────────────────┤
│ • Döküman türüne göre chunk stratejisi                     │
│ • Tablolar bölünmez (atomic unit)                          │
│ • Başlık-içerik bağlamı korunur                            │
│ • Max ~3500 token/chunk                                    │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ LAYER 3: 2-AŞAMALI ANALİZ                                  │
├─────────────────────────────────────────────────────────────┤
│ Aşama 1: Her chunk → Haiku (paralel, hızlı özet)          │
│ Aşama 2: Tüm özetler → Sonnet (birleştirme + final)       │
└─────────────────────────────────────────────────────────────┘
```

## Kullanım

### Programatik

```javascript
import { runPipeline } from './services/ai-analyzer';

const result = await runPipeline('/path/to/file.pdf', {
  onProgress: (p) => console.log(p.message),
  skipAnalysis: false, // sadece extraction istersen true
});

// Sonuç yapısı
{
  success: true,
  extraction: {
    type: 'pdf',
    textLength: 45000,
    structured: { pageCount: 25, tables: [] },
    ocrApplied: false,
  },
  chunks: [
    { index: 0, type: 'text', tokenEstimate: 2500, context: {...} },
    ...
  ],
  analysis: {
    ozet: "İhale özeti...",
    teknik_sartlar: [...],
    birim_fiyatlar: [...],
    takvim: [...],
    meta: { chunkCount: 15, totalTokens: 45000 }
  },
  stats: {
    totalDuration: 12500,
    chunkCount: 15,
    totalTokens: 45000,
  }
}
```

### API Endpoint

```bash
# Yeni pipeline endpoint
curl -X POST http://localhost:3001/api/documents/analyze-pipeline \
  -F "file=@document.pdf" \
  -F "tender_id=123"

# SSE response akışı:
# data: {"stage":"extraction","message":"Döküman okunuyor...","progress":5}
# data: {"stage":"chunking","message":"İçerik bölümleniyor...","progress":30}
# data: {"stage":"stage1","message":"Parça analizi: 5/15","progress":40}
# data: {"stage":"stage2","message":"Final analiz yapılıyor...","progress":60}
# data: {"stage":"complete","result":{...},"document_id":"uuid"}
```

## Dosya Yapısı

```
src/services/ai-analyzer/pipeline/
├── index.js      → Ana pipeline (runPipeline, runPipelineBatch)
├── extractor.js  → Layer 1: Veri çıkarma
├── chunker.js    → Layer 2: Akıllı bölümleme
└── analyzer.js   → Layer 3: 2 aşamalı analiz
```

## Layer Detayları

### Layer 1: Extractor

| Dosya Türü | Yöntem | Çıktı |
|------------|--------|-------|
| PDF | pdf-parse + OCR | text + pageCount |
| XLSX | xlsx lib | sheets[] (JSON yapısı korunur) |
| DOCX | mammoth | text + html + tables[] |
| DOC | LibreOffice/antiword | text |
| Görsel | Claude Vision | text (OCR) |
| ZIP | unzip + recursive | files[] |

**OCR Tetikleme Kuralı:**
- `textDensity < 10` (karakter/KB) ve `fileSize > 100KB` → OCR gerekli

### Layer 2: Chunker

**Chunk Türleri:**
- `text` - Normal metin
- `table` - Tablo (bölünmez)
- `header` - Başlık + içerik

**Bölme Kuralları:**
1. Max 3500 token/chunk (~5250 karakter)
2. Tablolar atomik (hiç bölünmez)
3. Paragraf sınırında bölme tercih edilir
4. Başlık bağlamı korunur

**Excel Özel Chunking:**
- Her sayfa ayrı chunk (küçükse)
- Büyük sayfalar satırlara bölünür
- Header satırı her chunk'ta tekrarlanır

### Layer 3: Analyzer

**Aşama 1 (Haiku - Paralel):**
- Her chunk için çıkarılan veriler:
  - özet
  - teknik_sartlar[]
  - birim_fiyatlar[]
  - tarihler[]
  - miktarlar[]
  - onemli_notlar[]
- 4 paralel istek

**Aşama 2 (Sonnet - Final):**
- Tüm chunk özetleri birleştirilir
- Tekrar edenler temizlenir
- Final analiz üretilir

**Küçük Döküman Optimizasyonu:**
- ≤2 chunk → Direkt Sonnet (tek aşama)

## Maliyet Karşılaştırması

| Yöntem | 50 sayfa PDF | Tahmini Maliyet |
|--------|--------------|-----------------|
| Eski (tüm sayfalar Sonnet) | 50 × Sonnet | ~$1.50 |
| Yeni (Haiku + Sonnet) | 15 × Haiku + 1 × Sonnet | ~$0.15 |
| **Tasarruf** | | **~90%** |

## Queue Processor Entegrasyonu

### Supabase'den İndirme Akışı

Queue processor, dökümanları Supabase Storage'dan indirir ve işler:

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Queue'dan döküman al (status: queued)                    │
│    SELECT * FROM documents WHERE processing_status = 'queued'│
│    ⚠️ ZIP dosyaları HARİÇ TUTULUR                          │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Supabase'den temp dosyaya indir (v5.2)                   │
│    storage_url → HTTPS GET → /tmp/doc_{id}_{ts}.ext         │
│    downloadFromStorage(url, filename, docId)                │
│                                                             │
│    ✅ Retry: 3 deneme (exponential backoff: 1s, 2s, 4s)    │
│    ✅ Timeout: 120 saniye                                   │
│    ✅ Max Redirects: 5                                      │
│    ✅ Progress Log: 5MB+ dosyalarda %20'lik log            │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Pipeline'ı çalıştır (temp dosya üzerinde)                │
│    runPipeline(tempFilePath)                                │
│    • Extraction → Chunking → Analysis                       │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Sonuçları kaydet ve temizle                              │
│    • extracted_text, analysis_result → DB                   │
│    • processing_status = 'completed'                        │
│    • Temp dosya silinir                                     │
└─────────────────────────────────────────────────────────────┘
```

### Kod Örneği

```javascript
import queueProcessor from './services/document-queue-processor.js';

// Pipeline modunu aç/kapat
queueProcessor.setPipelineMode(true);  // Yeni pipeline
queueProcessor.setPipelineMode(false); // Eski yöntem

// Status
const status = await queueProcessor.getQueueStatus();
// { usePipeline: true, queued: 5, processing: 2, ... }
```

## Hata Yönetimi

Pipeline her katmanda hata yakalar ve devam eder:

1. **Extraction hatası** → Dosya türü kontrol et, OCR dene
2. **Chunk hatası** → Fallback: tüm metin tek chunk
3. **Stage 1 hatası** → Hatalı chunk atlanır
4. **Stage 2 hatası** → Mevcut chunk özetleri döndürülür

## ZIP Dosya İşleme

İhale dökümanları genellikle ZIP paketleri halinde gelir. Pipeline ZIP dosyalarını otomatik olarak açar ve içindeki tüm dökümanları işler.

### ⚠️ ALTIN KURAL: ZIP Dosyaları Doğrudan Analize GİTMEZ!

```
ZIP DOSYASI ──────────────────────────────────────────────────────────
       │
       │  ❌ YANLIŞ: ZIP → Analiz (Çalışmaz!)
       │
       │  ✅ DOĞRU:  ZIP → Extraction → İç Dosyalar → Analiz
       │
───────────────────────────────────────────────────────────────────────
```

**Neden?**
- ZIP bir konteynerdir, içerik değil
- AI modelleri ZIP'i anlayamaz
- Önce açılmalı, sonra içindeki dosyalar ayrı ayrı işlenmeli

**Queue Processor Koruması:**
```sql
-- ZIP dosyaları kuyruktan otomatik hariç tutulur
WHERE file_type NOT IN ('zip', '.zip')
```

**Doğru Kullanım:**
```javascript
// Pipeline ZIP'i otomatik açar ve içindekileri işler
const result = await runPipeline('ihale_paketi.zip');
// result.extraction.structured.files → İç dosyalar
// result.analysis → Tüm dosyaların birleşik analizi
```

### ZIP İşleme Akışı

```
ZIP DOSYASI
    │
    ▼
┌─────────────────────────────────────────┐
│ 1. ZIP EXTRACTION                       │
│    unzip → temp klasöre aç              │
│    Recursive: iç içe klasörler taranır  │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│ 2. DOSYA FİLTRELEME                     │
│    Desteklenen: .pdf .docx .doc .xlsx   │
│                 .xls .txt .csv .png     │
│    Atlanan: .exe .dll .tmp vs.          │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│ 3. PARALEL EXTRACTION                   │
│    Her dosya için Layer 1 çalışır       │
│    Sonuçlar birleştirilir               │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│ 4. BİRLEŞİK ANALİZ                      │
│    Tüm dosyaların chunk'ları            │
│    tek havuzda analiz edilir            │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│ 5. TEMİZLİK                             │
│    Temp klasör silinir                  │
│    Sadece sonuç döner                   │
└─────────────────────────────────────────┘
```

### Gerçek Örnek: İhale Şartname Paketi

```
ihale_2026_91672.zip (1.3 MB)
├── Teknik_Sartname/
│   ├── 2026_ASHB_Gida_Malzemeleri_Ozellikleri.docx (450 KB)
│   ├── 2026_ASHB_Gida_Rasyonu.docx (380 KB)
│   └── 2026_AÇIK_İHALE_KKE_TEKNİK_ŞARTNAME.doc (250 KB)
└── Idari_Sartname/
    ├── 2025-2181680_Birim_Fiyat_Teklif_Cetveli.docx (85 KB)
    ├── 2025-2181680_sozlesme_tasarisi.doc (72 KB)
    └── 2025-2181680_idari_sartname.doc (64 KB)
```

**Pipeline Çıktısı:**
```javascript
{
  success: true,
  extraction: {
    type: 'zip',
    structured: {
      fileCount: 6,
      files: [
        { fileName: '2026_ASHB_Gida_Malzemeleri_Ozellikleri.docx', type: 'docx', textLength: 45000 },
        { fileName: '2026_ASHB_Gida_Rasyonu.docx', type: 'docx', textLength: 12000 },
        // ... diğer dosyalar
      ]
    }
  },
  chunks: [
    { index: 0, context: { fileName: 'Gida_Malzemeleri.docx', heading: 'MADDE 1' } },
    { index: 1, context: { fileName: 'Gida_Malzemeleri.docx', heading: 'MADDE 2' } },
    // ... tüm dosyalardan chunk'lar
  ],
  analysis: {
    ozet: "6 dosyadan oluşan ihale paketi: Teknik şartname (3), İdari şartname (3)...",
    teknik_sartlar: [...], // Tüm dosyalardan birleştirilmiş
    birim_fiyatlar: [...], // Birim fiyat cetvelinden çıkarılmış
  }
}
```

### ZIP Kullanım Örnekleri

```bash
# API ile ZIP analizi
curl -X POST http://localhost:3001/api/documents/analyze-pipeline \
  -F "file=@ihale_paketi.zip"

# Programatik kullanım
import { runPipeline } from './services/ai-analyzer';

const result = await runPipeline('./ihale_paketi.zip', {
  onProgress: (p) => {
    // p.message: "ZIP içi: 3/6 - teknik_sartname.docx"
    console.log(p.message);
  }
});
```

### Nested ZIP Desteği

ZIP içinde ZIP varsa, sadece birinci seviye açılır (güvenlik nedeniyle).

```
paket.zip
├── sartnameler.zip  ← AÇILMAZ, atlanan dosya olarak raporlanır
├── teknik.docx      ← İşlenir
└── idari.pdf        ← İşlenir
```

### ZIP Performans İpuçları

| Senaryo | Öneri |
|---------|-------|
| Çok dosyalı ZIP (>10) | `runPipelineBatch` yerine tek `runPipeline` |
| Büyük dosyalar (>50MB) | ZIP'i manuel açıp dosyaları ayrı işle |
| Karışık formatlar | Pipeline otomatik halleder |

## Öneriler

1. **Büyük dökümanlar için:** `runPipelineBatch` kullan (paralel dosya işleme)
2. **Sadece metin çıkarma:** `skipAnalysis: true` ile hızlı extraction
3. **Maliyet kontrolü:** Küçük dökümanlar için eski `analyzeFile` yeterli
4. **ZIP paketleri:** Tek seferde tüm ihale paketini analiz et
