# İhale Döküman Analiz Sistemi
## Öncesi / Sonrası Karşılaştırma

---

# BÖLÜM 1: MEVCUT SİSTEM (ÖNCESİ)

## 1.1 Genel Akış Şeması

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              MEVCUT SİSTEM AKIŞI                                    │
│                                   (ÖNCESİ)                                          │
└─────────────────────────────────────────────────────────────────────────────────────┘

     [İNTERNET]                                                              [VERİTABANI]
         │                                                                        │
         │                                                                        │
         ▼                                                                        │
┌─────────────────┐                                                               │
│   ihalebul.com  │                                                               │
│   ekap.gov.tr   │                                                               │
└────────┬────────┘                                                               │
         │                                                                        │
         │ HTTP/Puppeteer                                                         │
         ▼                                                                        │
┌─────────────────────────────────────────────────────────────────┐               │
│                      SCRAPER LAYER                              │               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │               │
│  │   browser   │  │   session   │  │    login    │             │               │
│  │   manager   │  │   manager   │  │   service   │             │               │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘             │               │
│         │                │                │                     │               │
│         └────────────────┼────────────────┘                     │               │
│                          ▼                                      │               │
│  ┌─────────────────────────────────────────────────────────┐   │               │
│  │                    list-scraper                          │   │               │
│  │            (İhale listesi tarama)                        │   │               │
│  └────────────────────────┬────────────────────────────────┘   │               │
│                           │                                     │               │
│                           ▼                                     │               │
│  ┌─────────────────────────────────────────────────────────┐   │               │
│  │                  document-scraper                        │   │               │
│  │     (Döküman linkleri + içerik çekme)                   │   │               │
│  └────────────────────────┬────────────────────────────────┘   │               │
│                           │                                     │               │
└───────────────────────────┼─────────────────────────────────────┘               │
                            │                                                      │
                            │ tenders tablosuna kayıt                              │
                            │ (title, document_links, announcement_content, vb.)   │
                            ▼                                                      │
┌─────────────────────────────────────────────────────────────────┐               │
│                      STORAGE LAYER                              │               │
│  ┌─────────────────────────────────────────────────────────┐   │               │
│  │                 document-storage                         │   │               │
│  │        (URL'den indir → Supabase'e yükle)               │   │               │
│  └────────────────────────┬────────────────────────────────┘   │               │
│                           │                                     │               │
│                           ▼                                     │               │
│  ┌─────────────────────────────────────────────────────────┐   │               │
│  │              Supabase Storage                            │   │               │
│  │         Bucket: tender-documents                         │   │               │
│  │         Path: tender_{id}/{filename}                     │   │               │
│  └────────────────────────┬────────────────────────────────┘   │               │
│                           │                                     │               │
│                           │ documents tablosuna kayıt           │               │
│                           │ (storage_path, file_type, vb.)      │               │
│                           │ processing_status = 'pending'       │               │
└───────────────────────────┼─────────────────────────────────────┘               │
                            │                                                      │
                            ▼                                                      │
┌─────────────────────────────────────────────────────────────────┐               │
│                      QUEUE LAYER                                │               │
│  ┌─────────────────────────────────────────────────────────┐   │               │
│  │            document-queue-processor                      │   │               │
│  │          (30 sn interval, max 2 concurrent)             │   │               │
│  │                                                          │   │               │
│  │   SELECT * FROM documents                                │   │               │
│  │   WHERE processing_status = 'queued'                     │   │               │
│  │   LIMIT 2                                                │   │               │
│  └────────────────────────┬────────────────────────────────┘   │               │
│                           │                                     │               │
│                           │ TEK TEK İŞLEM (bağımsız)           │               │
│                           ▼                                     │               │
└───────────────────────────┼─────────────────────────────────────┘               │
                            │                                                      │
                            ▼                                                      │
┌─────────────────────────────────────────────────────────────────┐               │
│                     ANALYSIS LAYER                              │               │
│                                                                 │               │
│   ┌──────────────────────────────────────────────────────┐     │               │
│   │  Döküman 1    Döküman 2    Döküman 3    Döküman N    │     │               │
│   │      │            │            │            │        │     │               │
│   │      ▼            ▼            ▼            ▼        │     │               │
│   │  ┌───────┐    ┌───────┐    ┌───────┐    ┌───────┐   │     │               │
│   │  │Analiz │    │Analiz │    │Analiz │    │Analiz │   │     │               │
│   │  │(ayrı) │    │(ayrı) │    │(ayrı) │    │(ayrı) │   │     │               │
│   │  └───┬───┘    └───┬───┘    └───┬───┘    └───┬───┘   │     │               │
│   │      │            │            │            │        │     │               │
│   │      ▼            ▼            ▼            ▼        │     │               │
│   │  ┌───────┐    ┌───────┐    ┌───────┐    ┌───────┐   │     │               │
│   │  │Sonuç 1│    │Sonuç 2│    │Sonuç 3│    │Sonuç N│   │     │               │
│   │  └───────┘    └───────┘    └───────┘    └───────┘   │     │               │
│   │                                                      │     │               │
│   │         ❌ CROSS-REFERENCE YOK                       │     │               │
│   │         ❌ ÇELİŞKİ TESPİTİ YOK                       │     │               │
│   │         ❌ BİRLEŞİK ANALİZ YOK                       │     │               │
│   └──────────────────────────────────────────────────────┘     │               │
│                                                                 │               │
│   Servisler:                                                    │               │
│   • claude.js (batch analiz, SSE streaming)                    │               │
│   • document-analyzer.js (tekil analiz, Gemini)                │               │
│                                                                 │               │
└─────────────────────────────────────────────────────────────────┘               │
                            │                                                      │
                            │ UPDATE documents                                     │
                            │ SET analysis_result = {...}                          │
                            ▼                                                      │
                    ┌───────────────┐                                              │
                    │  PostgreSQL   │◀─────────────────────────────────────────────┘
                    │   Database    │
                    └───────────────┘
```

## 1.2 Mevcut Servisler ve Sorumlulukları

| Servis | Dosya | Satır | Sorumluluk | Sorun |
|--------|-------|-------|------------|-------|
| **browser-manager** | scraper/browser-manager.js | ~200 | Puppeteer instance yönetimi | ✅ İyi |
| **session-manager** | scraper/session-manager.js | ~150 | Cookie/session cache | ✅ İyi |
| **login-service** | scraper/login-service.js | ~300 | Site login işlemleri | ✅ İyi |
| **list-scraper** | scraper/list-scraper.js | ~400 | İhale listesi tarama | ✅ İyi |
| **document-scraper** | scraper/document-scraper.js | ~350 | Döküman link/içerik çekme | ✅ İyi |
| **document-storage** | services/document-storage.js | ~500 | Supabase upload, ZIP açma | ✅ İyi |
| **document-queue-processor** | services/document-queue-processor.js | ~300 | Kuyruk yönetimi | ⚠️ Basit |
| **claude.js** | services/claude.js | 1278 | AI analiz (batch) | ⚠️ Tek tek |
| **document-analyzer.js** | services/document-analyzer.js | 413 | AI analiz (tekil) | ⚠️ Bağımsız |

## 1.3 Mevcut Sistemin Problemleri

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                            MEVCUT SİSTEM PROBLEMLERİ                                │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  ❌ PROBLEM 1: BAĞIMSIZ ANALİZ                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                              │   │
│  │   İdari Şartname ──▶ Analiz ──▶ "Teslim: 12:00"                            │   │
│  │                                                                              │   │
│  │   Teknik Şartname ──▶ Analiz ──▶ "Gramaj: 250gr"                           │   │
│  │                                                                              │   │
│  │   Zeyilname ──▶ Analiz ──▶ "Gramaj: 300gr olarak değişti"                  │   │
│  │                                                                              │   │
│  │   ⚠️ ÇELİŞKİ YAKALANMIYOR! (250gr vs 300gr)                                │   │
│  │                                                                              │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                     │
│  ❌ PROBLEM 2: BÜYÜK DÖKÜMAN İŞLEME                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                              │   │
│  │   25MB PDF ──▶ ❌ 20MB limit                                                │   │
│  │   Taranmış PDF ──▶ ❌ OCR yok, boş text                                    │   │
│  │   100 sayfa PDF ──▶ ❌ Token limiti aşımı                                  │   │
│  │                                                                              │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                     │
│  ❌ PROBLEM 3: VERİ KAYBI                                                           │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                              │   │
│  │   Chunk yok ──▶ Büyük döküman kesilir ──▶ Bilgi kaybı                      │   │
│  │   Overlap yok ──▶ Bölüm sınırlarında veri kaybolur                         │   │
│  │                                                                              │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                     │
│  ❌ PROBLEM 4: KULLANILMAYAN KAPASİTE                                               │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                              │   │
│  │   docling-client.js (794 satır) ──▶ ❌ Kullanılmıyor (%97.9 tablo)         │   │
│  │   ai-analyzer/ modülü ──▶ ❌ Kullanılmıyor (modüler yapı)                  │   │
│  │   pdf.js (1148 satır) ──▶ ❌ Kullanılmıyor (Docling entegrasyonu)          │   │
│  │                                                                              │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

# BÖLÜM 2: HEDEF SİSTEM (SONRASI)

## 2.1 Yeni Akış Şeması

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              HEDEF SİSTEM AKIŞI                                     │
│                                  (SONRASI)                                          │
└─────────────────────────────────────────────────────────────────────────────────────┘

     [İNTERNET]                                                              [VERİTABANI]
         │                                                                        │
         ▼                                                                        │
┌─────────────────────────────────────────────────────────────────┐               │
│                      SCRAPER LAYER                              │               │
│                    (DEĞİŞİKLİK YOK)                             │               │
│  browser-manager → session-manager → login-service              │               │
│  list-scraper → document-scraper                                │               │
└───────────────────────────┬─────────────────────────────────────┘               │
                            │                                                      │
                            ▼                                                      │
┌─────────────────────────────────────────────────────────────────┐               │
│                      STORAGE LAYER                              │               │
│                    (DEĞİŞİKLİK YOK)                             │               │
│  document-storage → Supabase Storage → documents tablosu        │               │
└───────────────────────────┬─────────────────────────────────────┘               │
                            │                                                      │
                            │ processing_status = 'pending'                        │
                            ▼                                                      │
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           PARSE LAYER (YENİ)                                    │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                         Docker Services                                  │   │
│  │                                                                          │   │
│  │   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                 │   │
│  │   │  Tesseract  │    │ LibreOffice │    │   Docling   │                 │   │
│  │   │     OCR     │    │  Converter  │    │   Tables    │                 │   │
│  │   │             │    │             │    │             │                 │   │
│  │   │ • Türkçe    │    │ • DOC→PDF   │    │ • %97.9     │                 │   │
│  │   │ • İngilizce │    │ • XLS→CSV   │    │   doğruluk  │                 │   │
│  │   │ • Scanned   │    │ • PPT→PDF   │    │ • Tablo     │                 │   │
│  │   └──────┬──────┘    └──────┬──────┘    └──────┬──────┘                 │   │
│  │          │                  │                  │                         │   │
│  │          └──────────────────┼──────────────────┘                         │   │
│  │                             │                                            │   │
│  │                             ▼                                            │   │
│  │   ┌─────────────────────────────────────────────────────────────────┐   │   │
│  │   │                    parse-orchestrator.js                         │   │   │
│  │   │                                                                  │   │   │
│  │   │    file_type → uygun parser seç → clean text çıkar             │   │   │
│  │   │                                                                  │   │   │
│  │   │    .pdf (normal) → pdf-parse                                    │   │   │
│  │   │    .pdf (scanned) → Tesseract OCR                               │   │   │
│  │   │    .pdf (tablolu) → Docling                                     │   │   │
│  │   │    .doc/.docx → LibreOffice → pdf-parse                         │   │   │
│  │   │    .xls/.xlsx → xlsx lib / Docling                              │   │   │
│  │   │    .jpg/.png → Tesseract OCR                                    │   │   │
│  │   └─────────────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  Çıktı: documents.extracted_text (temiz, okunabilir metin)                     │
└─────────────────────────────────────┬───────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           CHUNK LAYER (YENİ)                                    │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                        chunk-service.js                                  │   │
│  │                                                                          │   │
│  │   ┌─────────────────────────────────────────────────────────────────┐   │   │
│  │   │  Semantic Chunking                                               │   │   │
│  │   │  • Başlık/bölüm bazlı ayırma                                    │   │   │
│  │   │  • "MADDE 1:", "1.", "A)" pattern detection                     │   │   │
│  │   └─────────────────────────────────────────────────────────────────┘   │   │
│  │                                                                          │   │
│  │   ┌─────────────────────────────────────────────────────────────────┐   │   │
│  │   │  Overlap Strategy                                                │   │   │
│  │   │  • Her chunk sonuna 150 token overlap                           │   │   │
│  │   │  • Veri kaybını önler                                           │   │   │
│  │   │                                                                  │   │   │
│  │   │  Chunk 1: [====================]                                │   │   │
│  │   │  Chunk 2:              [====================]                   │   │   │
│  │   │  Chunk 3:                          [====================]       │   │   │
│  │   │                        ↑ overlap ↑                              │   │   │
│  │   └─────────────────────────────────────────────────────────────────┘   │   │
│  │                                                                          │   │
│  │   ┌─────────────────────────────────────────────────────────────────┐   │   │
│  │   │  Token-Aware Splitting                                           │   │   │
│  │   │  • Max 4000 token/chunk (Claude güvenli limit)                  │   │   │
│  │   │  • tiktoken ile sayım                                           │   │   │
│  │   └─────────────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  Çıktı: document_chunks tablosu (document_id, chunk_index, content, tokens)    │
└─────────────────────────────────────┬───────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      ANALYSIS LAYER (YENİLENMİŞ)                                │
│                                                                                 │
│  ══════════════════════════════════════════════════════════════════════════    │
│  ║                    AŞAMA 1: EXTRACTION (Paralel)                        ║    │
│  ══════════════════════════════════════════════════════════════════════════    │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                     extraction-service.js                                │   │
│  │                                                                          │   │
│  │   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐                │   │
│  │   │ Doc 1   │   │ Doc 2   │   │ Doc 3   │   │ Doc N   │                │   │
│  │   │ Chunks  │   │ Chunks  │   │ Chunks  │   │ Chunks  │                │   │
│  │   └────┬────┘   └────┬────┘   └────┬────┘   └────┬────┘                │   │
│  │        │             │             │             │                      │   │
│  │        │  PARALEL    │  PARALEL    │  PARALEL    │                      │   │
│  │        ▼             ▼             ▼             ▼                      │   │
│  │   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐                │   │
│  │   │ Claude  │   │ Claude  │   │ Claude  │   │ Claude  │                │   │
│  │   │ Extract │   │ Extract │   │ Extract │   │ Extract │                │   │
│  │   └────┬────┘   └────┬────┘   └────┬────┘   └────┬────┘                │   │
│  │        │             │             │             │                      │   │
│  │        ▼             ▼             ▼             ▼                      │   │
│  │   ┌─────────────────────────────────────────────────────────────────┐   │   │
│  │   │                  Structured JSON Pool                            │   │   │
│  │   │                                                                  │   │   │
│  │   │  Doc 1: { fiyatlar: [...], miktarlar: [...], şartlar: [...] }  │   │   │
│  │   │  Doc 2: { fiyatlar: [...], miktarlar: [...], şartlar: [...] }  │   │   │
│  │   │  Doc 3: { fiyatlar: [...], miktarlar: [...], şartlar: [...] }  │   │   │
│  │   │  Doc N: { fiyatlar: [...], miktarlar: [...], şartlar: [...] }  │   │   │
│  │   │                                                                  │   │   │
│  │   └─────────────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                      │                                          │
│                                      │ Tüm structured data                      │
│                                      ▼                                          │
│  ══════════════════════════════════════════════════════════════════════════    │
│  ║                  AŞAMA 2: UNIFIED ANALYSIS (Tek Çağrı)                  ║    │
│  ══════════════════════════════════════════════════════════════════════════    │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                     unified-analyzer.js                                  │   │
│  │                                                                          │   │
│  │   Input: Tüm dökümanların structured JSON'ları                          │   │
│  │                                                                          │   │
│  │   ┌─────────────────────────────────────────────────────────────────┐   │   │
│  │   │                    Claude Opus Analiz                            │   │   │
│  │   │                                                                  │   │   │
│  │   │   1. CROSS-REFERENCE                                            │   │   │
│  │   │      • Teknik şartname ↔ Birim fiyat eşleşmesi                 │   │   │
│  │   │      • Mal/hizmet listesi ↔ Şartname tutarlılığı               │   │   │
│  │   │                                                                  │   │   │
│  │   │   2. ÇELİŞKİ TESPİTİ                                            │   │   │
│  │   │      • Orijinal vs Zeyilname değişiklikleri                     │   │   │
│  │   │      • Şartnameler arası tutarsızlık                            │   │   │
│  │   │                                                                  │   │   │
│  │   │   3. EKSİK BİLGİ                                                │   │   │
│  │   │      • Referans verilen ama bulunamayan maddeler                │   │   │
│  │   │      • Kritik bilgi eksiklikleri                                │   │   │
│  │   │                                                                  │   │   │
│  │   │   4. MALİYET HESAPLAMA                                          │   │   │
│  │   │      • Birim fiyat × Miktar                                     │   │   │
│  │   │      • Toplam teklif tahmini                                    │   │   │
│  │   │                                                                  │   │   │
│  │   │   5. RİSK ANALİZİ                                               │   │   │
│  │   │      • Cezai şartlar                                            │   │   │
│  │   │      • Teslim riskleri                                          │   │   │
│  │   │      • Fiyat riskleri                                           │   │   │
│  │   └─────────────────────────────────────────────────────────────────┘   │   │
│  │                                                                          │   │
│  │   Output: Unified Analysis Result (JSON)                                │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                      │                                          │
│                                      ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                     tender_analysis tablosu                              │   │
│  │                                                                          │   │
│  │   tender_id, unified_analysis, cross_references, conflicts,             │   │
│  │   missing_info, cost_estimate, risks, created_at                        │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## 2.2 Yeni Servisler ve Sorumlulukları

### Mevcut Servisler (Değişiklik Yok)

| Servis | Durum | Açıklama |
|--------|-------|----------|
| browser-manager | ✅ Aynı | Puppeteer yönetimi |
| session-manager | ✅ Aynı | Session cache |
| login-service | ✅ Aynı | Site login |
| list-scraper | ✅ Aynı | İhale listesi |
| document-scraper | ✅ Aynı | Döküman linkleri |
| document-storage | ✅ Aynı | Supabase upload |

### Yeni/Güncellenen Servisler

| Servis | Dosya | Sorumluluk | Detay |
|--------|-------|------------|-------|
| **parse-orchestrator** | services/parse-orchestrator.js | Dosya tipi tespiti ve uygun parser'a yönlendirme | Scanned PDF → OCR, Tablolu → Docling, Normal → pdf-parse |
| **ocr-service** | services/ocr-service.js | Tesseract OCR wrapper | Türkçe + İngilizce, sayfa sayfa işleme |
| **docling-service** | services/docling-service.js | Docling API wrapper | Tablo extraction, high accuracy |
| **chunk-service** | services/chunk-service.js | Semantic chunking | Overlap, token-aware splitting |
| **extraction-service** | services/extraction-service.js | Aşama 1: Structured data extraction | Paralel Claude çağrıları |
| **unified-analyzer** | services/unified-analyzer.js | Aşama 2: Cross-reference analiz | Tek Claude Opus çağrısı |

## 2.3 Yeni Veritabanı Tabloları

```sql
-- Chunk tablosu
CREATE TABLE document_chunks (
    id SERIAL PRIMARY KEY,
    document_id INTEGER REFERENCES documents(id),
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    token_count INTEGER,
    start_page INTEGER,
    end_page INTEGER,
    section_title VARCHAR(500),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Extraction sonuçları
CREATE TABLE document_extractions (
    id SERIAL PRIMARY KEY,
    document_id INTEGER REFERENCES documents(id),
    extracted_data JSONB NOT NULL,  -- structured JSON
    extraction_model VARCHAR(100),
    extraction_tokens INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Unified analiz sonuçları (ihale bazlı)
CREATE TABLE tender_analysis (
    id SERIAL PRIMARY KEY,
    tender_id INTEGER REFERENCES tenders(id),
    unified_analysis JSONB NOT NULL,
    cross_references JSONB,         -- dökümanlar arası referanslar
    conflicts JSONB,                -- tespit edilen çelişkiler
    missing_info JSONB,             -- eksik bilgiler
    cost_estimate JSONB,            -- maliyet tahmini
    risks JSONB,                    -- risk analizi
    analysis_model VARCHAR(100),
    total_tokens INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

# BÖLÜM 3: SERVİS DETAYLARI

## 3.1 parse-orchestrator.js

```
┌─────────────────────────────────────────────────────────────────┐
│                    parse-orchestrator.js                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  GÖREV: Dosya tipine göre uygun parser'ı seç ve çalıştır       │
│                                                                 │
│  INPUT:                                                         │
│    • document_id                                                │
│    • storage_path (Supabase)                                    │
│    • file_type                                                  │
│                                                                 │
│  KARAR AĞACI:                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                          │   │
│  │  file_type === 'pdf'                                    │   │
│  │      │                                                   │   │
│  │      ├── isScanned(pdf) ──▶ ocr-service (Tesseract)     │   │
│  │      │                                                   │   │
│  │      ├── hasComplexTables(pdf) ──▶ docling-service      │   │
│  │      │                                                   │   │
│  │      └── else ──▶ pdf-parse (normal extraction)         │   │
│  │                                                          │   │
│  │  file_type === 'docx' || 'doc'                          │   │
│  │      └── libreoffice → pdf → parse                      │   │
│  │                                                          │   │
│  │  file_type === 'xlsx' || 'xls'                          │   │
│  │      └── docling-service (yüksek doğruluk)              │   │
│  │                                                          │   │
│  │  file_type === 'image'                                  │   │
│  │      └── ocr-service (Tesseract)                        │   │
│  │                                                          │   │
│  │  file_type === 'txt'                                    │   │
│  │      └── fs.readFile (direkt okuma)                     │   │
│  │                                                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  OUTPUT:                                                        │
│    • extracted_text (temiz metin)                              │
│    • metadata (sayfa sayısı, tablo sayısı, vb.)                │
│                                                                 │
│  FONKSİYONLAR:                                                  │
│    parseDocument(documentId)                                    │
│    detectDocumentType(buffer)                                   │
│    isScannedPdf(pdfPath)                                        │
│    hasComplexTables(pdfPath)                                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 3.2 chunk-service.js

```
┌─────────────────────────────────────────────────────────────────┐
│                      chunk-service.js                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  GÖREV: Büyük metni akıllıca parçalara ayır                    │
│                                                                 │
│  INPUT:                                                         │
│    • document_id                                                │
│    • extracted_text                                             │
│    • options: { maxTokens, overlap, strategy }                  │
│                                                                 │
│  STRATEJİLER:                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                          │   │
│  │  1. SEMANTIC CHUNKING (Tercih)                          │   │
│  │     • "MADDE 1:", "1.", "A)" pattern'larını bul         │   │
│  │     • Bölüm başlıklarına göre ayır                      │   │
│  │     • Her chunk mantıksal bir bütün olsun               │   │
│  │                                                          │   │
│  │  2. SENTENCE CHUNKING (Fallback)                        │   │
│  │     • Cümle sınırlarında kes                            │   │
│  │     • Paragraf bütünlüğünü koru                         │   │
│  │                                                          │   │
│  │  3. TOKEN CHUNKING (Son çare)                           │   │
│  │     • Sabit token sayısına göre kes                     │   │
│  │     • Kelime ortasında kesme                            │   │
│  │                                                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  OVERLAP MEKANİZMASI:                                           │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                          │   │
│  │  maxTokens = 4000, overlap = 150                        │   │
│  │                                                          │   │
│  │  Chunk 1: token[0 ... 4000]                             │   │
│  │  Chunk 2: token[3850 ... 7850]  ← 150 token örtüşme    │   │
│  │  Chunk 3: token[7700 ... 11700] ← 150 token örtüşme    │   │
│  │                                                          │   │
│  │  ✅ Bölüm sınırında bilgi kaybı YOK                     │   │
│  │                                                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  OUTPUT:                                                        │
│    • document_chunks tablosuna kayıt                           │
│    • chunks[]: { index, content, tokens, section }             │
│                                                                 │
│  FONKSİYONLAR:                                                  │
│    chunkDocument(documentId, text, options)                     │
│    detectSections(text)                                         │
│    countTokens(text)                                            │
│    applyOverlap(chunks, overlapSize)                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 3.3 extraction-service.js

```
┌─────────────────────────────────────────────────────────────────┐
│                    extraction-service.js                        │
│                        (AŞAMA 1)                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  GÖREV: Her dökümanın chunk'larından structured data çıkar     │
│                                                                 │
│  INPUT:                                                         │
│    • tender_id                                                  │
│    • document_ids[]                                             │
│                                                                 │
│  İŞLEM AKIŞI:                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                          │   │
│  │  for each document (PARALEL):                           │   │
│  │      chunks = getChunks(document_id)                    │   │
│  │                                                          │   │
│  │      for each chunk:                                    │   │
│  │          extracted = await claude.extract(chunk, schema)│   │
│  │                                                          │   │
│  │      merged = mergeChunkExtractions(extractions)        │   │
│  │      save to document_extractions                       │   │
│  │                                                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  EXTRACTION SCHEMA (Her döküman için):                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  {                                                       │   │
│  │    "fiyatlar": [                                        │   │
│  │      { "kalem": "...", "birim_fiyat": 0, "birim": "" }  │   │
│  │    ],                                                    │   │
│  │    "miktarlar": [                                       │   │
│  │      { "kalem": "...", "miktar": 0, "birim": "" }       │   │
│  │    ],                                                    │   │
│  │    "tarihler": [                                        │   │
│  │      { "tip": "...", "tarih": "YYYY-MM-DD" }            │   │
│  │    ],                                                    │   │
│  │    "teknik_sartlar": [                                  │   │
│  │      { "kategori": "...", "deger": "...", "madde": "" } │   │
│  │    ],                                                    │   │
│  │    "cezai_sartlar": [                                   │   │
│  │      { "kosul": "...", "ceza": "...", "madde": "" }     │   │
│  │    ],                                                    │   │
│  │    "referanslar": [                                     │   │
│  │      { "kaynak_doc": "...", "madde": "...", "konu": ""} │   │
│  │    ]                                                     │   │
│  │  }                                                       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  OUTPUT:                                                        │
│    • document_extractions tablosuna kayıt                      │
│    • Her döküman için structured JSON                          │
│                                                                 │
│  FONKSİYONLAR:                                                  │
│    extractFromTender(tenderId)                                  │
│    extractFromDocument(documentId)                              │
│    extractFromChunk(chunkContent, docType)                      │
│    mergeChunkExtractions(extractions[])                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 3.4 unified-analyzer.js

```
┌─────────────────────────────────────────────────────────────────┐
│                     unified-analyzer.js                         │
│                        (AŞAMA 2)                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  GÖREV: Tüm dökümanların extraction'larını birleştir ve        │
│         cross-reference analizi yap                             │
│                                                                 │
│  INPUT:                                                         │
│    • tender_id                                                  │
│    • all_extractions[] (Aşama 1 çıktısı)                       │
│                                                                 │
│  ANALİZ ADIMLARI:                                               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                          │   │
│  │  1. CROSS-REFERENCE KONTROLÜ                            │   │
│  │     ┌───────────────────────────────────────────────┐   │   │
│  │     │ Teknik Şartname: "Tavuk sote 250gr"           │   │   │
│  │     │ Birim Fiyat: "Tavuk sote - kalem var mı?"     │   │   │
│  │     │ Mal/Hizmet: "Tavuk sote - miktar eşleşiyor mu"│   │   │
│  │     │                                                │   │   │
│  │     │ ✅ Eşleşme bulundu / ⚠️ Eşleşme yok          │   │   │
│  │     └───────────────────────────────────────────────┘   │   │
│  │                                                          │   │
│  │  2. ÇELİŞKİ TESPİTİ                                     │   │
│  │     ┌───────────────────────────────────────────────┐   │   │
│  │     │ Orijinal: "Gramaj 250gr" (Teknik Şartname)    │   │   │
│  │     │ Zeyilname: "Gramaj 300gr olarak değişti"      │   │   │
│  │     │                                                │   │   │
│  │     │ ⚠️ ÇELİŞKİ: Gramaj değeri farklı              │   │   │
│  │     │    Geçerli değer: 300gr (Zeyilname)           │   │   │
│  │     └───────────────────────────────────────────────┘   │   │
│  │                                                          │   │
│  │  3. EKSİK BİLGİ TESPİTİ                                 │   │
│  │     ┌───────────────────────────────────────────────┐   │   │
│  │     │ Referans: "Teknik Şartname Madde 5.2"         │   │   │
│  │     │ Kontrol: Madde 5.2 döküman içinde var mı?     │   │   │
│  │     │                                                │   │   │
│  │     │ ⚠️ EKSİK: Madde 5.2 bulunamadı               │   │   │
│  │     └───────────────────────────────────────────────┘   │   │
│  │                                                          │   │
│  │  4. MALİYET HESAPLAMA                                   │   │
│  │     ┌───────────────────────────────────────────────┐   │   │
│  │     │ Kalem 1: 45.50 TL × 50,000 adet = 2,275,000   │   │   │
│  │     │ Kalem 2: 38.00 TL × 30,000 adet = 1,140,000   │   │   │
│  │     │ ...                                            │   │   │
│  │     │ TOPLAM TAHMİNİ: 5,420,000 TL                  │   │   │
│  │     └───────────────────────────────────────────────┘   │   │
│  │                                                          │   │
│  │  5. RİSK ANALİZİ                                        │   │
│  │     ┌───────────────────────────────────────────────┐   │   │
│  │     │ • Cezai şart: Günlük %0.5 gecikme cezası      │   │   │
│  │     │ • Teslim riski: 30 farklı noktaya dağıtım     │   │   │
│  │     │ • Fiyat riski: Enflasyon koruma yok           │   │   │
│  │     │                                                │   │   │
│  │     │ RİSK SEVİYESİ: ORTA-YÜKSEK                    │   │   │
│  │     └───────────────────────────────────────────────┘   │   │
│  │                                                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  OUTPUT:                                                        │
│    • tender_analysis tablosuna kayıt                           │
│    • Unified analysis JSON                                      │
│                                                                 │
│  FONKSİYONLAR:                                                  │
│    analyzeUnified(tenderId)                                     │
│    checkCrossReferences(extractions[])                          │
│    detectConflicts(extractions[])                               │
│    findMissingInfo(extractions[])                               │
│    calculateCost(extractions[])                                 │
│    assessRisks(extractions[])                                   │
│    generateSummary(analysis)                                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

# BÖLÜM 4: KARŞILAŞTIRMA TABLOSU

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                          ÖNCESİ vs SONRASI                                          │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  ÖZELLİK                    │  ÖNCESİ              │  SONRASI                       │
│  ───────────────────────────┼──────────────────────┼───────────────────────────     │
│  Döküman analizi            │  Tek tek, bağımsız   │  İki aşamalı, birleşik        │
│  Cross-reference            │  ❌ Yok              │  ✅ Otomatik                   │
│  Çelişki tespiti            │  ❌ Yok              │  ✅ Zeyilname kontrolü         │
│  Büyük PDF (25MB+)          │  ❌ Başarısız        │  ✅ Chunk + OCR                │
│  Taranmış PDF               │  ❌ Boş text         │  ✅ Tesseract OCR              │
│  Tablo extraction           │  ⚠️ Basit           │  ✅ Docling %97.9              │
│  Token yönetimi             │  ❌ Limit aşımı      │  ✅ Chunk + overlap            │
│  Veri kaybı                 │  ⚠️ Risk var        │  ✅ Overlap koruma             │
│  Maliyet hesaplama          │  ❌ Manuel           │  ✅ Otomatik                   │
│  Risk analizi               │  ❌ Yok              │  ✅ Otomatik                   │
│  Paralel işleme             │  ⚠️ Sınırlı         │  ✅ Aşama 1 paralel            │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

# BÖLÜM 5: ÖRNEK SENARYO

## Senaryo: 10 Dökümanlı İhale Analizi

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  İHALE: Yemek Hizmeti Alımı                                                         │
│  DÖKÜMANLAR:                                                                        │
│    1. İdari Şartname (PDF, 45 sayfa)                                               │
│    2. Teknik Şartname (PDF, 120 sayfa, tablolu)                                    │
│    3. Birim Fiyat Cetveli (XLSX, 500 satır)                                        │
│    4. Mal/Hizmet Listesi (PDF, scanned, 30 sayfa)                                  │
│    5. Sözleşme Tasarısı (DOCX, 25 sayfa)                                           │
│    6. Zeyilname 1 (PDF, 5 sayfa)                                                   │
│    7. Zeyilname 2 (PDF, 3 sayfa)                                                   │
│    8. Pursantaj Listesi (XLSX, 200 satır)                                          │
│    9. Standart Formlar (ZIP → 10 DOCX)                                             │
│   10. Proje Dosyaları (PDF, 80 sayfa, CAD çizimleri)                               │
└─────────────────────────────────────────────────────────────────────────────────────┘

                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              PARSE LAYER                                            │
├─────────────────────────────────────────────────────────────────────────────────────┤
│  1. İdari Şartname     → pdf-parse          → 45,000 karakter                      │
│  2. Teknik Şartname    → Docling (tablolar) → 180,000 karakter + 25 tablo          │
│  3. Birim Fiyat        → Docling            → 500 satır JSON                        │
│  4. Mal/Hizmet         → Tesseract OCR      → 35,000 karakter                       │
│  5. Sözleşme           → LibreOffice→PDF    → 28,000 karakter                       │
│  6. Zeyilname 1        → pdf-parse          → 6,000 karakter                        │
│  7. Zeyilname 2        → pdf-parse          → 4,000 karakter                        │
│  8. Pursantaj          → Docling            → 200 satır JSON                        │
│  9. Standart Formlar   → ZIP açma → 10 ayrı → 15,000 karakter                       │
│  10. Proje Dosyaları   → pdf-parse + OCR    → 95,000 karakter                       │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              CHUNK LAYER                                            │
├─────────────────────────────────────────────────────────────────────────────────────┤
│  Toplam: ~410,000 karakter → ~100,000 token                                         │
│                                                                                     │
│  Chunking (4000 token/chunk, 150 overlap):                                          │
│    Doc 1:  12 chunk                                                                 │
│    Doc 2:  48 chunk (en büyük)                                                      │
│    Doc 3:  3 chunk                                                                  │
│    Doc 4:  10 chunk                                                                 │
│    Doc 5:  8 chunk                                                                  │
│    Doc 6:  2 chunk                                                                  │
│    Doc 7:  1 chunk                                                                  │
│    Doc 8:  2 chunk                                                                  │
│    Doc 9:  4 chunk                                                                  │
│    Doc 10: 25 chunk                                                                 │
│    ─────────────                                                                    │
│    TOPLAM: 115 chunk                                                                │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                         AŞAMA 1: EXTRACTION                                         │
├─────────────────────────────────────────────────────────────────────────────────────┤
│  115 chunk × ~1000 output token = ~115,000 token                                    │
│  Paralel işleme: 10 concurrent = ~12 dakika                                         │
│                                                                                     │
│  Çıktı (her döküman için structured JSON):                                          │
│  {                                                                                  │
│    "doc_type": "tech_spec",                                                         │
│    "fiyatlar": [...],                                                               │
│    "miktarlar": [...],                                                              │
│    "tarihler": [...],                                                               │
│    "teknik_sartlar": [...],                                                         │
│    "cezai_sartlar": [...],                                                          │
│    "referanslar": [...]                                                             │
│  }                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                       AŞAMA 2: UNIFIED ANALYSIS                                     │
├─────────────────────────────────────────────────────────────────────────────────────┤
│  Input: 10 dökümanın structured JSON'ları (~25,000 token)                           │
│  Model: Claude Opus                                                                 │
│  Output: ~8,000 token                                                               │
│  Süre: ~2 dakika                                                                    │
│                                                                                     │
│  SONUÇ:                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │  CROSS-REFERENCES (15 adet)                                                  │   │
│  │  ✅ Teknik Şartname Mad.5 ↔ Birim Fiyat Kalem 1-50                          │   │
│  │  ✅ Sözleşme Mad.12 ↔ İdari Şartname Mad.8                                  │   │
│  │  ⚠️ Pursantaj Kalem 45 → Teknik Şartname'de karşılık YOK                    │   │
│  │                                                                              │   │
│  │  ÇELİŞKİLER (3 adet)                                                        │   │
│  │  ⚠️ Gramaj: Teknik=250gr, Zeyilname-2=300gr → GEÇERLİ: 300gr               │   │
│  │  ⚠️ Teslim saati: İdari=12:00, Sözleşme=11:30 → TUTARSIZ                   │   │
│  │  ⚠️ Ceza oranı: İdari=%0.3, Sözleşme=%0.5 → TUTARSIZ                       │   │
│  │                                                                              │   │
│  │  EKSİK BİLGİLER (5 adet)                                                    │   │
│  │  ❌ Teknik Şartname Mad.18 referans veriyor ama Mad.18 yok                  │   │
│  │  ❌ Birim fiyatta "Kahvaltı seti" var ama teknik şartnamede tanım yok       │   │
│  │                                                                              │   │
│  │  MALİYET TAHMİNİ                                                            │   │
│  │  Toplam kalem: 127                                                          │   │
│  │  Tahmini tutar: 8,450,000 TL (±%5)                                          │   │
│  │                                                                              │   │
│  │  RİSK ANALİZİ                                                               │   │
│  │  • Yüksek: Günlük %0.5 gecikme cezası (sektör ort. %0.2)                    │   │
│  │  • Orta: 45 farklı teslim noktası                                           │   │
│  │  • Düşük: 12 ay sözleşme süresi                                             │   │
│  │  GENEL RİSK: ORTA-YÜKSEK                                                    │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                     │
│  TOPLAM SÜRE: ~14 dakika                                                            │
│  TOPLAM TOKEN: ~150,000 (maliyet: ~$2-3)                                            │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

# BÖLÜM 6: UYGULAMA PLANI

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                            UYGULAMA PLANI                                           │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  FAZ 1: PARSE LAYER (3 gün)                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │  Gün 1: Docker setup                                                         │   │
│  │    • Tesseract container (Türkçe paket)                                     │   │
│  │    • LibreOffice container                                                   │   │
│  │    • Docling container                                                       │   │
│  │                                                                              │   │
│  │  Gün 2-3: parse-orchestrator.js                                             │   │
│  │    • Dosya tipi tespiti                                                     │   │
│  │    • Router logic                                                            │   │
│  │    • Scanned PDF detection                                                   │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                     │
│  FAZ 2: CHUNK LAYER (2 gün)                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │  Gün 4: chunk-service.js                                                     │   │
│  │    • Semantic chunking                                                       │   │
│  │    • Token counting (tiktoken)                                              │   │
│  │                                                                              │   │
│  │  Gün 5: Overlap mekanizması                                                 │   │
│  │    • document_chunks tablosu                                                │   │
│  │    • Test & tuning                                                           │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                     │
│  FAZ 3: EXTRACTION SERVICE (3 gün)                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │  Gün 6-7: extraction-service.js                                             │   │
│  │    • JSON schema tanımlama                                                  │   │
│  │    • Claude prompt engineering                                               │   │
│  │    • Paralel işleme                                                         │   │
│  │                                                                              │   │
│  │  Gün 8: Chunk merge logic                                                   │   │
│  │    • document_extractions tablosu                                           │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                     │
│  FAZ 4: UNIFIED ANALYZER (3 gün)                                                    │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │  Gün 9-10: unified-analyzer.js                                              │   │
│  │    • Cross-reference logic                                                   │   │
│  │    • Conflict detection                                                      │   │
│  │    • Claude Opus prompt                                                      │   │
│  │                                                                              │   │
│  │  Gün 11: tender_analysis tablosu                                            │   │
│  │    • API endpoint                                                            │   │
│  │    • Frontend entegrasyonu                                                   │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                     │
│  FAZ 5: TEST & OPTİMİZASYON (2 gün)                                                │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │  Gün 12: End-to-end test                                                    │   │
│  │    • 25MB+ PDF test                                                         │   │
│  │    • 10+ döküman batch test                                                 │   │
│  │                                                                              │   │
│  │  Gün 13: Performance tuning                                                 │   │
│  │    • Parallelization ayarları                                               │   │
│  │    • Cache mekanizması                                                       │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                     │
│  TOPLAM: 13 gün (paralel çalışmayla 8-10 gün)                                      │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```
