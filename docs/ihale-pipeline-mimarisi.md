# İhale Döküman Pipeline Mimarisi - Tam Analiz

## GENEL BAKIŞ

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           İHALE DÖKÜMAN İŞLEME SİSTEMİ                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│   │  SCRAPER    │───▶│  STORAGE    │───▶│  QUEUE      │───▶│  ANALYSIS   │     │
│   │  LAYER      │    │  LAYER      │    │  LAYER      │    │  LAYER      │     │
│   └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘     │
│                                                                                 │
│   • Liste çekme       • Supabase        • Kuyruk yönetim   • Claude AI         │
│   • Döküman link      • ZIP açma        • Auto-process     • Text extraction   │
│   • İçerik parse      • DB kayıt        • Batch işlem      • OCR (sınırlı)     │
│   • Session yönetim                                                            │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. SCRAPER LAYER (Veri Toplama)

### Dosya Yapısı
```
backend/src/scraper/
├── index.js              # Ana export modülü
├── browser-manager.js    # Puppeteer browser yönetimi
├── session-manager.js    # Session cache & yönetim
├── login-service.js      # Site login işlemleri
├── list-scraper.js       # İhale listesi tarama
├── document-scraper.js   # Döküman/içerik çekme
├── logger.js             # Scraper logging
├── runner.js             # Scraper runner
├── core/                 # Core modüller
│   ├── browser.js
│   ├── session.js
│   ├── auth.js
│   └── index.js
└── uyumsoft/            # Özel uyumsoft scraper
    ├── api-client.js
    ├── session.js
    ├── config.js
    └── fatura-service.js
```

### Akış Diyagramı
```
┌──────────────────┐
│   list-scraper   │  ihalebul.com kategori 15 (Hazır Yemek)
│   scrapeList()   │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  login-service   │  Session kontrol & login
│  ensureLoggedIn()│
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  extractTenders  │  Sayfa parse: başlık, kayıt no, tarih, vb.
└────────┬─────────┘
         │
         ├─────────────────────────────────────┐
         │ (includeDocuments = true)           │
         ▼                                     │
┌──────────────────┐                          │
│ document-scraper │                          │
│ scrapeAllContent │                          │
├──────────────────┤                          │
│ • documentLinks  │◀── PDF, DOC, XLS, ZIP    │
│ • announcement   │◀── İhale İlanı (TEXT)    │
│ • goodsServices  │◀── Mal/Hizmet (JSON)     │
│ • zeyilname      │◀── Zeyilname içeriği     │
│ • correction     │◀── Düzeltme ilanı        │
└────────┬─────────┘                          │
         │                                     │
         ▼                                     │
┌──────────────────┐                          │
│   saveTender()   │◀─────────────────────────┘
│   PostgreSQL     │
└──────────────────┘
```

### Çekilen Veri Tipleri
| Veri | Kaynak | Format | Hedef |
|------|--------|--------|-------|
| İhale Listesi | ihalebul.com/tenders | HTML Parse | tenders tablosu |
| Döküman Linkleri | Detay sayfası | URL Array | tenders.document_links |
| İhale İlanı | Card içeriği | TEXT | tenders.announcement_content |
| Mal/Hizmet | DataTable | JSON Array | tenders.goods_services_content |
| Zeyilname | Tab içeriği | TEXT | tenders.zeyilname_content |

---

## 2. STORAGE LAYER (Depolama)

### Dosya Yapısı
```
backend/src/services/
├── document-storage.js   # Supabase upload, ZIP açma
├── document-download.js  # URL'den dosya indirme
└── document.js          # Dosya işleme utilities
```

### Desteklenen Dosya Türleri
```javascript
SUPPORTED_EXTENSIONS = [
  '.pdf', '.doc', '.docx',    // Dökümanlar
  '.xls', '.xlsx',            // Tablolar
  '.zip', '.rar',             // Arşivler
  '.jpg', '.jpeg', '.png',    // Görseller
  '.txt', '.csv'              // Metin
]
```

### Doc Type Mapping
```javascript
DOC_TYPE_NAMES = {
  'admin_spec':      'İdari Şartname',
  'tech_spec':       'Teknik Şartname',
  'project_files':   'Proje Dosyaları',
  'announcement':    'İhale İlanı',
  'zeyilname':       'Zeyilname',
  'contract':        'Sözleşme Tasarısı',
  'unit_price':      'Birim Fiyat Teklif Cetveli',
  'pursantaj':       'Pursantaj Listesi',
  'quantity_survey': 'Mahal Listesi / Metraj',
  'standard_forms':  'Standart Formlar',
  'goods_services':  'Mal/Hizmet Listesi'
}
```

### Depolama Akışı
```
┌──────────────────┐
│ document_links   │  tenders tablosundan URL'ler
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ downloadDocument │  HTTP download + retry
└────────┬─────────┘
         │
         ├───────────────────────────┐
         │ (.zip / .rar)             │ (diğer)
         ▼                           ▼
┌──────────────────┐    ┌──────────────────┐
│   AdmZip açma    │    │   Direkt upload  │
│   + içerik loop  │    │                  │
└────────┬─────────┘    └────────┬─────────┘
         │                        │
         ▼                        ▼
┌───────────────────────────────────────────┐
│         Supabase Storage Upload           │
│         Bucket: tender-documents          │
│         Path: tender_{id}/{filename}      │
└────────────────────┬──────────────────────┘
                     │
                     ▼
┌───────────────────────────────────────────┐
│           documents tablosu               │
│  • storage_path, storage_url              │
│  • file_type, file_size, doc_type         │
│  • processing_status = 'pending'          │
└───────────────────────────────────────────┘
```

---

## 3. QUEUE / PROCESSING LAYER (İşleme Kuyruğu)

### Dosya Yapısı
```
backend/src/services/
├── document-queue-processor.js  # Kuyruk yönetimi
├── tender-content-service.js    # Content → Document dönüşümü
└── document.js                  # processDocument, extractText
```

### Kuyruk Durumları
```
pending → queued → processing → completed/failed
```

### Queue Processor Döngüsü
```
┌─────────────────────────────────────────────────────────┐
│              DocumentQueueProcessor                      │
│              (30 saniye interval)                        │
├─────────────────────────────────────────────────────────┤
│                                                          │
│   ┌─────────────────────────────────────────────────┐   │
│   │  1. SELECT * FROM documents                      │   │
│   │     WHERE processing_status = 'queued'           │   │
│   │     LIMIT 2 (maxConcurrent)                      │   │
│   └──────────────────────┬──────────────────────────┘   │
│                          │                               │
│                          ▼                               │
│   ┌─────────────────────────────────────────────────┐   │
│   │  2. source_type kontrolü                         │   │
│   │     • 'content' → processContentDocument()       │   │
│   │     • 'download' → processDocument()             │   │
│   └──────────────────────┬──────────────────────────┘   │
│                          │                               │
│                          ▼                               │
│   ┌─────────────────────────────────────────────────┐   │
│   │  3. Text extraction                              │   │
│   │     .pdf  → pdf-parse (+ Gemini Vision OCR)     │   │
│   │     .docx → mammoth                              │   │
│   │     .xlsx → xlsx lib                             │   │
│   │     .txt  → fs.readFile                          │   │
│   └──────────────────────┬──────────────────────────┘   │
│                          │                               │
│                          ▼                               │
│   ┌─────────────────────────────────────────────────┐   │
│   │  4. analyzeDocument() → document-analyzer.js     │   │
│   │     (Gemini tabanlı analiz)                      │   │
│   └──────────────────────┬──────────────────────────┘   │
│                          │                               │
│                          ▼                               │
│   ┌─────────────────────────────────────────────────┐   │
│   │  5. UPDATE documents                             │   │
│   │     extracted_text, analysis_result              │   │
│   │     processing_status = 'completed'              │   │
│   └─────────────────────────────────────────────────┘   │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## 4. ANALYSIS LAYER (Analiz)

### Mevcut Servisler
| Servis | Satır | Durum | Kullanım Alanı |
|--------|-------|-------|----------------|
| claude.js | 1278 | AKTİF | Batch analiz, streaming SSE |
| document-analyzer.js | 413 | AKTİF | Tekil döküman, Gemini |
| ai-analyzer/ | ~500 | KULLANILMIYOR | Modüler yapı |
| pdf.js | 1148 | KULLANILMIYOR | Docling entegrasyonu |
| docling-client.js | 794 | KULLANILMIYOR | IBM Docling API |

### Analiz Akışı (Batch - claude.js)
```
┌────────────────────────────────────────────────────────────────────┐
│                    POST /analyze-batch                              │
│                    (SSE Streaming)                                  │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   for each documentId:                                              │
│   ┌─────────────────────────────────────────────────────────────┐  │
│   │  1. Dosya tipi kontrolü                                      │  │
│   │     PDF → analyzePdfDirectWithClaude()                       │  │
│   │     DOC/DOCX → mammoth → analyzeWithClaude()                 │  │
│   │     XLS/XLSX → xlsx → analyzeWithClaude()                    │  │
│   │     Image → base64 → analyzeWithClaude()                     │  │
│   └──────────────────────┬──────────────────────────────────────┘  │
│                          │                                          │
│                          ▼                                          │
│   ┌─────────────────────────────────────────────────────────────┐  │
│   │  2. Claude API çağrısı                                       │  │
│   │     Model: claude-sonnet-4-20250514                          │  │
│   │     Max tokens: 8192                                         │  │
│   │     Prompt: İhale analiz şablonu                             │  │
│   └──────────────────────┬──────────────────────────────────────┘  │
│                          │                                          │
│                          ▼                                          │
│   ┌─────────────────────────────────────────────────────────────┐  │
│   │  3. SSE ile ilerleme gönder                                  │  │
│   │     { type: 'progress', documentId, status, message }        │  │
│   └──────────────────────┬──────────────────────────────────────┘  │
│                          │                                          │
│                          ▼                                          │
│   ┌─────────────────────────────────────────────────────────────┐  │
│   │  4. Sonuç kaydet                                             │  │
│   │     UPDATE documents SET analysis_result = {...}             │  │
│   └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
│   ──────────────────────────────────────────────────────────────   │
│   Son: { type: 'complete', summary: {...} }                        │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
```

---

## 5. MEVCUT SORUNLAR

### Kritik Sorunlar
```
┌─────────────────────────────────────────────────────────────────────┐
│ 1. BÜYÜK PDF SORUNU                                                 │
│    • 20MB limit (32MB'ye çıkarıldı)                                │
│    • Taranmış PDF'ler için OCR yetersiz                            │
│    • pdf-parse scanned PDF'de boş text döner                       │
│                                                                     │
│ 2. OCR EKSİKLİĞİ                                                   │
│    • Tesseract mevcut ama Türkçe paketi eksik                      │
│    • Gemini Vision sınırlı kullanımda                              │
│    • Sayfa sayfa OCR yok                                           │
│                                                                     │
│ 3. DÖKÜMAN CHUNK YOK                                               │
│    • Büyük dökümanlar tek seferde gönderiliyor                     │
│    • Token limiti aşımı riski                                      │
│    • Chunk → Merge stratejisi yok                                  │
│                                                                     │
│ 4. KULLANILMAYAN SERVİSLER                                         │
│    • pdf.js (Docling entegrasyonlu)                                │
│    • ai-analyzer/ (modüler yapı)                                   │
│    • docling-client.js (%97.9 tablo doğruluğu)                    │
│                                                                     │
│ 5. HATA YÖNETİMİ                                                   │
│    • Retry mekanizması zayıf                                       │
│    • Partial failure handling yok                                  │
│    • Rollback mekanizması yok                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 6. ÖNERİLEN MİMARİ

### Katmanlı Yaklaşım
```
┌─────────────────────────────────────────────────────────────────────┐
│                         ÖNERİLEN MİMARİ                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   ┌─────────────────────────────────────────────────────────────┐  │
│   │  LAYER 1: SCRAPER (Mevcut - İyi Çalışıyor)                  │  │
│   │  • list-scraper.js                                           │  │
│   │  • document-scraper.js                                       │  │
│   │  • session-manager.js                                        │  │
│   └─────────────────────────────────────────────────────────────┘  │
│                              │                                      │
│                              ▼                                      │
│   ┌─────────────────────────────────────────────────────────────┐  │
│   │  LAYER 2: STORAGE (Mevcut - İyi Çalışıyor)                  │  │
│   │  • document-storage.js                                       │  │
│   │  • Supabase Storage                                          │  │
│   └─────────────────────────────────────────────────────────────┘  │
│                              │                                      │
│                              ▼                                      │
│   ┌─────────────────────────────────────────────────────────────┐  │
│   │  LAYER 3: PARSE (YENİ - Docker Servisleri)                  │  │
│   │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │  │
│   │  │  Tesseract  │ │ LibreOffice │ │   Docling   │            │  │
│   │  │  OCR        │ │ Converter   │ │   Tables    │            │  │
│   │  └─────────────┘ └─────────────┘ └─────────────┘            │  │
│   └─────────────────────────────────────────────────────────────┘  │
│                              │                                      │
│                              ▼                                      │
│   ┌─────────────────────────────────────────────────────────────┐  │
│   │  LAYER 4: CHUNK (YENİ)                                       │  │
│   │  • Semantic chunking (heading bazlı)                         │  │
│   │  • Overlap chunking (veri kaybı önleme)                     │  │
│   │  • Token-aware splitting                                     │  │
│   └─────────────────────────────────────────────────────────────┘  │
│                              │                                      │
│                              ▼                                      │
│   ┌─────────────────────────────────────────────────────────────┐  │
│   │  LAYER 5: ANALYSIS (Claude Opus)                             │  │
│   │  • Structured output (JSON schema)                           │  │
│   │  • Per-chunk analysis                                        │  │
│   │  • Result merging                                            │  │
│   └─────────────────────────────────────────────────────────────┘  │
│                              │                                      │
│                              ▼                                      │
│   ┌─────────────────────────────────────────────────────────────┐  │
│   │  LAYER 6: VALIDATION & MERGE                                 │  │
│   │  • Cross-chunk validation                                    │  │
│   │  • Conflict resolution                                       │  │
│   │  • Final quality check                                       │  │
│   └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Docker Compose Önerisi
```yaml
services:
  # OCR Servisi
  tesseract:
    image: tesseractshadow/tesseract4re
    volumes:
      - ./uploads:/data
    environment:
      - TESSDATA_PREFIX=/usr/share/tessdata

  # DOC/DOCX → PDF dönüştürücü
  libreoffice:
    image: libreoffice/libreoffice-online

  # Tablo çıkarma (yüksek doğruluk)
  docling:
    image: ds4sd/docling-serve:latest
    ports:
      - "5001:5001"
```

---

## 7. UYGULAMA PLANI

### Faz 1: OCR İyileştirme (1-2 gün)
- [ ] Tesseract Türkçe paketi kurulumu
- [ ] Sayfa sayfa OCR implementasyonu
- [ ] Scanned PDF detection geliştirme

### Faz 2: Chunk Sistemi (2-3 gün)
- [ ] Semantic chunker implementasyonu
- [ ] Overlap stratejisi (100-200 token)
- [ ] Token counter entegrasyonu

### Faz 3: Docling Entegrasyonu (1-2 gün)
- [ ] Docker compose güncelleme
- [ ] docling-client.js aktivasyonu
- [ ] Tablo extraction entegrasyonu

### Faz 4: Claude Opus Analiz (2-3 gün)
- [ ] JSON schema tanımlama
- [ ] Chunk-based analysis
- [ ] Result merging logic
- [ ] Quality validation

### Faz 5: Test & Optimizasyon (2-3 gün)
- [ ] 25MB+ PDF testleri
- [ ] Multi-document batch testleri
- [ ] Performance optimization
- [ ] Error handling iyileştirme

---

## 8. SONUÇ

**Sıfırdan yapılmamalı**, mevcut sistem iyi temel sağlıyor. Önerilen yaklaşım:

1. **Scraper & Storage**: Dokunma, iyi çalışıyor
2. **Parse Layer**: Docker servislerle güçlendir (Tesseract, LibreOffice, Docling)
3. **Chunk Layer**: Yeni katman ekle
4. **Analysis**: claude.js'i refactor et, Opus kullan
5. **Validation**: Cross-check mekanizması ekle

Toplam süre: ~10-15 gün (paralel çalışmayla 7-10 gün)
