# İHALE SİSTEMİ - TEK KANVAS
## Tüm Servisler ve Akış Zinciri

```
╔═══════════════════════════════════════════════════════════════════════════════════════════════════════════════╗
║                                                                                                               ║
║                                    İHALE DÖKÜMAN SİSTEMİ - TAM HARİTA                                        ║
║                                                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════════════════════════════════════╝


┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  KATMAN 1: VERİ KAYNAKLARI (İnternet)                                                                         ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

    ┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
    │  ihalebul.com   │      │   ekap.gov.tr   │      │  Diğer Siteler  │
    │  (Ana kaynak)   │      │  (Resmi kaynak) │      │                 │
    └────────┬────────┘      └────────┬────────┘      └────────┬────────┘
             │                        │                        │
             └────────────────────────┼────────────────────────┘
                                      │
                                      ▼
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  KATMAN 2: SCRAPER (Veri Toplama)                                                                             ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

    ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐
    │                                         scraper/                                                         │
    │                                                                                                          │
    │   ┌──────────────────────┐                                                                               │
    │   │   browser-manager    │  Puppeteer instance yönetimi                                                  │
    │   │   (1496 byte)        │  • Browser başlat/kapat                                                       │
    │   │                      │  • Sayfa oluştur                                                              │
    │   └──────────┬───────────┘  • Headless mod                                                               │
    │              │                                                                                           │
    │              ▼                                                                                           │
    │   ┌──────────────────────┐                                                                               │
    │   │   session-manager    │  Session yönetimi                                                             │
    │   │   (2183 byte)        │  • Cookie cache                                                               │
    │   │                      │  • Site bazlı session                                                         │
    │   └──────────┬───────────┘  • Session timeout                                                            │
    │              │                                                                                           │
    │              ▼                                                                                           │
    │   ┌──────────────────────┐                                                                               │
    │   │   login-service      │  Site login işlemleri                                                         │
    │   │   (10255 byte)       │  • ihalebul.com login                                                         │
    │   │                      │  • ekap.gov.tr login                                                          │
    │   └──────────┬───────────┘  • Captcha handling                                                           │
    │              │                                                                                           │
    │              ▼                                                                                           │
    │   ┌──────────────────────┐         ┌──────────────────────┐                                              │
    │   │   list-scraper       │────────▶│   document-scraper   │                                              │
    │   │   (11511 byte)       │         │   (19594 byte)       │                                              │
    │   │                      │         │                      │                                              │
    │   │ • Kategori tarama    │         │ • Döküman linkleri   │                                              │
    │   │ • İhale listesi çek  │         │ • İlan içeriği (text)│                                              │
    │   │ • Pagination         │         │ • Mal/hizmet (JSON)  │                                              │
    │   │ • Filtreleme         │         │ • Zeyilname içeriği  │                                              │
    │   └──────────────────────┘         └──────────────────────┘                                              │
    │                                                                                                          │
    │   Yardımcı:                                                                                              │
    │   ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐                           │
    │   │   logger (2054)      │  │   runner (5434)      │  │   index (885)        │                           │
    │   │   Scraper logging    │  │   Otomatik çalıştır  │  │   Export modülü      │                           │
    │   └──────────────────────┘  └──────────────────────┘  └──────────────────────┘                           │
    │                                                                                                          │
    │   Alt modüller:                                                                                          │
    │   ┌─────────────────────────────────────────┐  ┌─────────────────────────────────────────┐               │
    │   │   core/                                  │  │   uyumsoft/                             │               │
    │   │   • auth.js (12057) - EKAP auth         │  │   • api-client.js (10772)               │               │
    │   │   • browser.js (6188) - Browser utils   │  │   • session.js (7252)                   │               │
    │   │   • session.js (5874) - Session utils   │  │   • fatura-service.js (6636)            │               │
    │   └─────────────────────────────────────────┘  │   (Uyumsoft fatura entegrasyonu)        │               │
    │                                                └─────────────────────────────────────────┘               │
    └─────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ Çıktı: tenders tablosuna kayıt
                                      │        (title, document_links, announcement_content, goods_services_content)
                                      ▼
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  KATMAN 3: STORAGE (Depolama)                                                                                 ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

    ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐
    │                                         services/                                                        │
    │                                                                                                          │
    │   ┌──────────────────────────────┐                                                                       │
    │   │   document-download          │  URL'den dosya indirme                                                │
    │   │   (2222 byte)                │  • HTTP download                                                      │
    │   │                              │  • Retry mekanizması                                                  │
    │   │                              │  • Rate limiting                                                      │
    │   └──────────────┬───────────────┘                                                                       │
    │                  │                                                                                       │
    │                  ▼                                                                                       │
    │   ┌──────────────────────────────┐         ┌──────────────────────────────┐                              │
    │   │   document-storage           │────────▶│   Supabase Storage           │                              │
    │   │   (25813 byte)               │         │   Bucket: tender-documents   │                              │
    │   │                              │         └──────────────────────────────┘                              │
    │   │ • ZIP/RAR açma (AdmZip)      │                                                                       │
    │   │ • Supabase upload            │                                                                       │
    │   │ • doc_type belirleme         │         Desteklenen formatlar:                                        │
    │   │ • Dosya adından tip algılama │         .pdf .doc .docx .xls .xlsx                                    │
    │   └──────────────────────────────┘         .zip .rar .jpg .png .txt .csv                                 │
    │                                                                                                          │
    │   ┌──────────────────────────────┐                                                                       │
    │   │   tender-content-service     │  İçerik → Döküman dönüşümü                                            │
    │   │   (8298 byte)                │  • announcement_content → documents                                   │
    │   │                              │  • goods_services_content → documents                                 │
    │   └──────────────────────────────┘                                                                       │
    │                                                                                                          │
    └─────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ Çıktı: documents tablosuna kayıt
                                      │        (storage_path, file_type, processing_status='pending')
                                      ▼
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  KATMAN 4: QUEUE (Kuyruk İşleme)                                                                              ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

    ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐
    │                                         services/                                                        │
    │                                                                                                          │
    │   ┌──────────────────────────────┐                                                                       │
    │   │   document-queue-processor   │  Kuyruk yönetimi                                                      │
    │   │   (5142 byte)                │  • 30 saniye interval                                                 │
    │   │                              │  • Max 2 concurrent                                                   │
    │   │                              │  • pending → queued → processing                                      │
    │   └──────────────┬───────────────┘                                                                       │
    │                  │                                                                                       │
    │                  │ source_type kontrolü                                                                  │
    │                  │                                                                                       │
    │         ┌────────┴────────┐                                                                              │
    │         │                 │                                                                              │
    │         ▼                 ▼                                                                              │
    │   ┌───────────┐    ┌───────────┐                                                                         │
    │   │ 'content' │    │'download' │                                                                         │
    │   │           │    │           │                                                                         │
    │   └─────┬─────┘    └─────┬─────┘                                                                         │
    │         │                │                                                                               │
    │         ▼                ▼                                                                               │
    │   ┌──────────────────────────────┐                                                                       │
    │   │   document.js                │  Dosya işleme utilities                                               │
    │   │   (7147 byte)                │  • processDocument()                                                  │
    │   │                              │  • extractText()                                                      │
    │   │                              │  • Dosya tipi algılama                                                │
    │   └──────────────────────────────┘                                                                       │
    │                                                                                                          │
    │   ┌──────────────────────────────┐                                                                       │
    │   │   tender-scheduler           │  Zamanlanmış görevler                                                 │
    │   │   (16641 byte)               │  • Otomatik scraping                                                  │
    │   │                              │  • Periyodik kontrol                                                  │
    │   └──────────────────────────────┘                                                                       │
    │                                                                                                          │
    └─────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ extracted_text çıkarıldı
                                      ▼
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  KATMAN 5: ANALYSIS (AI Analiz)                                                                               ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

    ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐
    │                                         services/                                                        │
    │                                                                                                          │
    │   ╔══════════════════════════════════════════════════════════════════════════════════════════════════╗  │
    │   ║  AKTİF SERVİSLER                                                                                  ║  │
    │   ╚══════════════════════════════════════════════════════════════════════════════════════════════════╝  │
    │                                                                                                          │
    │   ┌──────────────────────────────┐         ┌──────────────────────────────┐                              │
    │   │   claude.js                  │         │   document-analyzer          │                              │
    │   │   (36788 byte / 1278 satır)  │         │   (11076 byte / 413 satır)   │                              │
    │   │                              │         │                              │                              │
    │   │ • BATCH ANALİZ (ana servis)  │         │ • TEKİL döküman analizi      │                              │
    │   │ • SSE streaming              │         │ • Gemini tabanlı             │                              │
    │   │ • Claude Sonnet              │         │ • Queue processor kullanır   │                              │
    │   │ • analyzePdfDirectWithClaude │         │                              │                              │
    │   │ • analyzeWithClaude          │         │                              │                              │
    │   └──────────────────────────────┘         └──────────────────────────────┘                              │
    │                                                                                                          │
    │   ┌──────────────────────────────┐                                                                       │
    │   │   claude-ai.js               │  Genel Claude API wrapper                                             │
    │   │   (12873 byte)               │  • chat, complete metodları                                           │
    │   └──────────────────────────────┘                                                                       │
    │                                                                                                          │
    │   ╔══════════════════════════════════════════════════════════════════════════════════════════════════╗  │
    │   ║  KULLANILMAYAN SERVİSLER (Potansiyel)                                                             ║  │
    │   ╚══════════════════════════════════════════════════════════════════════════════════════════════════╝  │
    │                                                                                                          │
    │   ┌──────────────────────────────────────────────────────────────────────────────────────────────────┐  │
    │   │   ai-analyzer/                              MODÜLER YAPI - AKTİF DEĞİL                            │  │
    │   │   │                                                                                               │  │
    │   │   ├── index.js (7268)                      Ana orchestrator                                       │  │
    │   │   │                                                                                               │  │
    │   │   ├── analyzers/                                                                                  │  │
    │   │   │   ├── pdf.js (34995)                   PDF analiz (Docling entegrasyonlu)                     │  │
    │   │   │   ├── office.js (6554)                 DOC/DOCX/XLS analiz                                    │  │
    │   │   │   ├── image.js (2780)                  Görsel analiz                                          │  │
    │   │   │   └── text.js (3440)                   Metin analiz                                           │  │
    │   │   │                                                                                               │  │
    │   │   ├── core/                                                                                       │  │
    │   │   │   ├── client.js (4259)                 AI client wrapper                                      │  │
    │   │   │   ├── prompts.js (5735)                Prompt şablonları                                      │  │
    │   │   │   └── docling-client.js (23442)        Docling API (%97.9 tablo doğruluğu)                    │  │
    │   │   │                                                                                               │  │
    │   │   └── utils/                                                                                      │  │
    │   │       └── parser.js (5585)                 Sonuç parse                                            │  │
    │   └──────────────────────────────────────────────────────────────────────────────────────────────────┘  │
    │                                                                                                          │
    └─────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ Çıktı: documents.analysis_result (JSON)
                                      ▼
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  KATMAN 6: API (Routes)                                                                                       ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

    ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐
    │                                         routes/                                                          │
    │                                                                                                          │
    │   ┌──────────────────────────────┐                                                                       │
    │   │   scraper.js (31327 byte)    │  /api/scraper/*                                                       │
    │   │                              │  • POST /run - Scraper başlat                                         │
    │   │                              │  • GET /status - Durum sorgula                                        │
    │   │                              │  • POST /stop - Durdur                                                │
    │   └──────────────────────────────┘                                                                       │
    │                                                                                                          │
    │   ┌──────────────────────────────┐                                                                       │
    │   │   tenders.js (14807 byte)    │  /api/tenders/*                                                       │
    │   │                              │  • GET / - Liste                                                      │
    │   │                              │  • GET /:id - Detay                                                   │
    │   │                              │  • PUT /:id - Güncelle                                                │
    │   │                              │  • DELETE /:id - Sil                                                  │
    │   └──────────────────────────────┘                                                                       │
    │                                                                                                          │
    │   ┌──────────────────────────────┐                                                                       │
    │   │   tender-documents.js        │  /api/tender-documents/*                                              │
    │   │   (8776 byte)                │  • GET /tender/:id - İhale dökümanları                                │
    │   │                              │  • POST /upload - Döküman yükle                                       │
    │   │                              │  • DELETE /:id - Döküman sil                                          │
    │   └──────────────────────────────┘                                                                       │
    │                                                                                                          │
    │   ┌──────────────────────────────┐                                                                       │
    │   │   tender-content-documents   │  /api/tender-content/*                                                │
    │   │   (12182 byte)               │  • POST /analyze-batch - BATCH ANALİZ (SSE)                           │
    │   │                              │  • POST /documents/:id/analyze - Tekil analiz                         │
    │   │                              │  • GET /documents/:id - Döküman detay                                 │
    │   └──────────────────────────────┘                                                                       │
    │                                                                                                          │
    │   ┌──────────────────────────────┐                                                                       │
    │   │   tender-tracking.js         │  /api/tender-tracking/*                                               │
    │   │   (23514 byte)               │  • İhale takip                                                        │
    │   │                              │  • Favori ihaleler                                                    │
    │   │                              │  • Hatırlatmalar                                                      │
    │   └──────────────────────────────┘                                                                       │
    │                                                                                                          │
    │   ┌──────────────────────────────┐  ┌──────────────────────────────┐                                     │
    │   │   documents.js (8420)        │  │   document-proxy.js (8208)   │                                     │
    │   │   Genel döküman CRUD         │  │   Proxy/redirect işlemleri   │                                     │
    │   └──────────────────────────────┘  └──────────────────────────────┘                                     │
    │                                                                                                          │
    │   ┌──────────────────────────────┐  ┌──────────────────────────────┐                                     │
    │   │   content-extractor.js       │  │   tender-notes.js (15793)    │                                     │
    │   │   (5473 byte)                │  │   İhale notları              │                                     │
    │   │   İçerik çıkarma             │  └──────────────────────────────┘                                     │
    │   └──────────────────────────────┘                                                                       │
    │                                                                                                          │
    └─────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  KATMAN 7: DATABASE (Veritabanı)                                                                              ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

    ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐
    │                                         PostgreSQL (Supabase)                                            │
    │                                                                                                          │
    │   ┌──────────────────────────────┐                                                                       │
    │   │   tenders                    │  Ana ihale tablosu                                                    │
    │   │                              │  • id, title, external_id                                             │
    │   │                              │  • document_links (JSONB)                                             │
    │   │                              │  • announcement_content (TEXT)                                        │
    │   │                              │  • goods_services_content (JSONB)                                     │
    │   │                              │  • zeyilname_content (TEXT)                                           │
    │   │                              │  • tender_date, status, city                                          │
    │   │                              │  • detail_scraped (boolean)                                           │
    │   └──────────────────────────────┘                                                                       │
    │                                                                                                          │
    │   ┌──────────────────────────────┐                                                                       │
    │   │   documents                  │  Döküman tablosu                                                      │
    │   │                              │  • id, tender_id (FK)                                                 │
    │   │                              │  • filename, original_filename                                        │
    │   │                              │  • file_type, file_size                                               │
    │   │                              │  • storage_path, storage_url                                          │
    │   │                              │  • source_type ('download'/'content')                                 │
    │   │                              │  • doc_type (admin_spec, tech_spec, vb.)                              │
    │   │                              │  • processing_status (pending/queued/processing/completed/failed)     │
    │   │                              │  • extracted_text (TEXT)                                              │
    │   │                              │  • analysis_result (JSONB)                                            │
    │   └──────────────────────────────┘                                                                       │
    │                                                                                                          │
    │   ┌──────────────────────────────┐                                                                       │
    │   │   scraper_logs               │  Scraper log tablosu                                                  │
    │   │                              │  • tenders_found, tenders_new                                         │
    │   │                              │  • status, error_message                                              │
    │   └──────────────────────────────┘                                                                       │
    │                                                                                                          │
    │   ┌──────────────────────────────┐                                                                       │
    │   │   Supabase Storage           │  Dosya depolama                                                       │
    │   │   Bucket: tender-documents   │  • tender_{id}/{filename}                                             │
    │   └──────────────────────────────┘                                                                       │
    │                                                                                                          │
    └─────────────────────────────────────────────────────────────────────────────────────────────────────────┘


╔═══════════════════════════════════════════════════════════════════════════════════════════════════════════════╗
║                                                                                                               ║
║                                    VERİ AKIŞ ZİNCİRİ (ÖZET)                                                   ║
║                                                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════════════════════════════════════╝

┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│ İnternet│───▶│ Scraper │───▶│ Storage │───▶│  Queue  │───▶│ Analysis│───▶│  API    │───▶│Frontend │
│         │    │         │    │         │    │         │    │         │    │         │    │         │
│ihalebul │    │list-    │    │document-│    │queue-   │    │claude.js│    │routes/* │    │Next.js  │
│ekap     │    │scraper  │    │storage  │    │processor│    │analyzer │    │         │    │         │
└─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘
                   │              │              │              │
                   ▼              ▼              ▼              ▼
              ┌─────────────────────────────────────────────────────┐
              │                    PostgreSQL                        │
              │   tenders → documents → extracted_text → analysis    │
              └─────────────────────────────────────────────────────┘


╔═══════════════════════════════════════════════════════════════════════════════════════════════════════════════╗
║                                                                                                               ║
║                                    SERVİS ENVANTER TABLOSU                                                    ║
║                                                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════════════════════════════════════╝

┌────────────────────────────────┬──────────┬─────────┬─────────────────────────────────────────────────────────┐
│ SERVİS                         │ BOYUT    │ DURUM   │ GÖREV                                                   │
├────────────────────────────────┼──────────┼─────────┼─────────────────────────────────────────────────────────┤
│ SCRAPER KATMANI                │          │         │                                                         │
├────────────────────────────────┼──────────┼─────────┼─────────────────────────────────────────────────────────┤
│ browser-manager.js             │ 1.5 KB   │ ✅ AKTİF│ Puppeteer browser instance yönetimi                     │
│ session-manager.js             │ 2.2 KB   │ ✅ AKTİF│ Cookie/session cache yönetimi                           │
│ login-service.js               │ 10.3 KB  │ ✅ AKTİF│ Site login (ihalebul, ekap)                             │
│ list-scraper.js                │ 11.5 KB  │ ✅ AKTİF│ İhale listesi tarama                                    │
│ document-scraper.js            │ 19.6 KB  │ ✅ AKTİF│ Döküman linkleri + içerik çekme                         │
│ runner.js                      │ 5.4 KB   │ ✅ AKTİF│ Otomatik scraper çalıştırma                             │
│ logger.js                      │ 2.1 KB   │ ✅ AKTİF│ Scraper logging                                         │
│ core/auth.js                   │ 12.1 KB  │ ✅ AKTİF│ EKAP authentication                                     │
│ core/browser.js                │ 6.2 KB   │ ✅ AKTİF│ Browser utilities                                       │
│ core/session.js                │ 5.9 KB   │ ✅ AKTİF│ Session utilities                                       │
│ uyumsoft/*                     │ 25.4 KB  │ ✅ AKTİF│ Uyumsoft fatura entegrasyonu                            │
├────────────────────────────────┼──────────┼─────────┼─────────────────────────────────────────────────────────┤
│ STORAGE KATMANI                │          │         │                                                         │
├────────────────────────────────┼──────────┼─────────┼─────────────────────────────────────────────────────────┤
│ document-download.js           │ 2.2 KB   │ ✅ AKTİF│ URL'den dosya indirme                                   │
│ document-storage.js            │ 25.8 KB  │ ✅ AKTİF│ Supabase upload, ZIP açma                               │
│ tender-content-service.js      │ 8.3 KB   │ ✅ AKTİF│ İçerik → döküman dönüşümü                               │
├────────────────────────────────┼──────────┼─────────┼─────────────────────────────────────────────────────────┤
│ QUEUE KATMANI                  │          │         │                                                         │
├────────────────────────────────┼──────────┼─────────┼─────────────────────────────────────────────────────────┤
│ document-queue-processor.js    │ 5.1 KB   │ ✅ AKTİF│ Kuyruk yönetimi (30sn, max 2)                           │
│ document.js                    │ 7.1 KB   │ ✅ AKTİF│ processDocument, extractText                            │
│ tender-scheduler.js            │ 16.6 KB  │ ✅ AKTİF│ Zamanlanmış görevler                                    │
├────────────────────────────────┼──────────┼─────────┼─────────────────────────────────────────────────────────┤
│ ANALYSIS KATMANI               │          │         │                                                         │
├────────────────────────────────┼──────────┼─────────┼─────────────────────────────────────────────────────────┤
│ claude.js                      │ 36.8 KB  │ ✅ AKTİF│ ANA ANALİZ: Batch, SSE, Claude Sonnet                   │
│ document-analyzer.js           │ 11.1 KB  │ ✅ AKTİF│ Tekil analiz, Gemini                                    │
│ claude-ai.js                   │ 12.9 KB  │ ✅ AKTİF│ Claude API wrapper                                      │
│ ai-analyzer/index.js           │ 7.3 KB   │ ❌ PASIF│ Modüler orchestrator                                    │
│ ai-analyzer/analyzers/pdf.js   │ 35.0 KB  │ ❌ PASIF│ PDF analiz (Docling entegrasyonlu)                      │
│ ai-analyzer/analyzers/office.js│ 6.6 KB   │ ❌ PASIF│ Office dosya analiz                                     │
│ ai-analyzer/analyzers/image.js │ 2.8 KB   │ ❌ PASIF│ Görsel analiz                                           │
│ ai-analyzer/analyzers/text.js  │ 3.4 KB   │ ❌ PASIF│ Metin analiz                                            │
│ ai-analyzer/core/docling.js    │ 23.4 KB  │ ❌ PASIF│ Docling API (%97.9 tablo doğruluğu)                     │
│ ai-analyzer/core/prompts.js    │ 5.7 KB   │ ❌ PASIF│ Prompt şablonları                                       │
│ ai-analyzer/utils/parser.js    │ 5.6 KB   │ ❌ PASIF│ Sonuç parse utilities                                   │
├────────────────────────────────┼──────────┼─────────┼─────────────────────────────────────────────────────────┤
│ API KATMANI (Routes)           │          │         │                                                         │
├────────────────────────────────┼──────────┼─────────┼─────────────────────────────────────────────────────────┤
│ scraper.js                     │ 31.3 KB  │ ✅ AKTİF│ /api/scraper/* - Scraper kontrol                        │
│ tenders.js                     │ 14.8 KB  │ ✅ AKTİF│ /api/tenders/* - İhale CRUD                             │
│ tender-documents.js            │ 8.8 KB   │ ✅ AKTİF│ /api/tender-documents/* - Döküman CRUD                  │
│ tender-content-documents.js    │ 12.2 KB  │ ✅ AKTİF│ /api/tender-content/* - Batch analiz                    │
│ tender-tracking.js             │ 23.5 KB  │ ✅ AKTİF│ /api/tender-tracking/* - İhale takip                    │
│ tender-notes.js                │ 15.8 KB  │ ✅ AKTİF│ İhale notları                                           │
│ documents.js                   │ 8.4 KB   │ ✅ AKTİF│ Genel döküman CRUD                                      │
│ document-proxy.js              │ 8.2 KB   │ ✅ AKTİF│ Döküman proxy                                           │
│ content-extractor.js           │ 5.5 KB   │ ✅ AKTİF│ İçerik çıkarma                                          │
└────────────────────────────────┴──────────┴─────────┴─────────────────────────────────────────────────────────┘

TOPLAM: 79,838 satır kod (tüm backend)
İHALE SİSTEMİ: ~45 dosya, ~350 KB
```
