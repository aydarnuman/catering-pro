# İHALE DÖKÜMAN YÖNETİM SİSTEMİ - TAM MİMARİ PROMPT

> Bu prompt, ihalebul.com'dan ihale verisi çeken ve dökümanları yöneten sistemin tam mimarisini tanımlar.
> Yeni bir sistem kurarken veya mevcut sistemi anlamak için kullanılır.

---

## 🎯 SİSTEMİN AMACI

ihalebul.com'dan "Hazır Yemek" kategorisindeki ihaleleri otomatik olarak:
1. Listeleyip veritabanına kaydetmek
2. Site içeriklerini (ilan metni, mal/hizmet listesi) çekip döküman olarak saklamak
3. İndirilebilir dökümanları (PDF, DOCX, ZIP) indirip Supabase Storage'a yüklemek
4. ZIP/RAR arşivlerini açıp içindeki dosyaları ayrı ayrı kaydetmek
5. Tüm dökümanları analiz kuyruğuna ekleyip AI ile analiz etmek

---

## 📁 DOSYA YAPISI

```
backend/src/
├── scraper/                          # Scraper modülleri
│   ├── browser-manager.js            # Puppeteer singleton yönetimi
│   ├── session-manager.js            # Cookie saklama (session.json)
│   ├── login-service.js              # ihalebul.com authentication
│   ├── list-scraper.js               # Kategori sayfası tarama + DB kayıt
│   ├── document-scraper.js           # Detay sayfası içerik çekme
│   ├── runner.js                     # CLI aracı
│   └── index.js                      # Export
│
├── services/
│   ├── document-download.js          # ihalebul.com'dan dosya indirme (authenticated)
│   ├── document-storage.js           # Supabase Storage'a yükleme, ZIP açma
│   ├── tender-content-service.js     # Site içeriğini döküman olarak kaydetme
│   ├── document-queue-processor.js   # Analiz kuyruğu işleme
│   └── claude.js                     # Claude AI ile döküman analizi
│
├── routes/
│   ├── scraper.js                    # Scraper API endpoint'leri
│   ├── tender-documents.js           # Döküman indirme endpoint'leri
│   └── tender-content-documents.js   # Content döküman ve analiz endpoint'leri
│
└── storage/
    └── session.json                  # ihalebul.com session cookie'leri
```

---

## 🗃️ VERİTABANI ŞEMASI

### `tenders` Tablosu (İhale Ana Bilgileri)

```sql
CREATE TABLE tenders (
  id SERIAL PRIMARY KEY,
  external_id VARCHAR(50) UNIQUE,        -- ihalebul.com ID
  ikn VARCHAR(50),                       -- İhale Kayıt Numarası
  title TEXT,                            -- İhale başlığı
  city VARCHAR(100),                     -- Şehir
  organization_name TEXT,                -- İdare adı
  tender_date TIMESTAMPTZ,               -- Teklif tarihi
  estimated_cost DECIMAL(15,2),          -- Yaklaşık maliyet
  work_duration VARCHAR(100),            -- İşin süresi
  url TEXT,                              -- ihalebul.com detay URL
  tender_source VARCHAR(50),             -- 'ihalebul'
  category_id INT,                       -- Kategori ID (15 = Hazır Yemek)
  category_name VARCHAR(100),            -- Kategori adı
  
  -- Döküman Linkleri (Scraper'dan gelen)
  document_links JSONB,                  -- {tech_spec: {url, name}, admin_spec: {url, name}, ...}
  
  -- Site İçerikleri (Scraper'dan gelen)
  announcement_content TEXT,             -- İhale ilanı içeriği (TEXT)
  goods_services_content JSONB,          -- Mal/Hizmet listesi (JSON array)
  zeyilname_content JSONB,               -- Zeyilname içeriği
  correction_notice_content TEXT,        -- Düzeltme ilanı içeriği
  
  is_updated BOOLEAN DEFAULT FALSE,      -- Zeyilname/düzeltme var mı?
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `documents` Tablosu (Dökümanlar)

```sql
CREATE TABLE documents (
  id SERIAL PRIMARY KEY,
  tender_id INT REFERENCES tenders(id),
  
  -- Dosya Bilgileri
  filename VARCHAR(255),                 -- Storage'daki dosya adı
  original_filename VARCHAR(255),        -- Orijinal/görüntüleme adı
  file_type VARCHAR(20),                 -- pdf, docx, xlsx, zip, text, json
  file_size INT,                         -- Dosya boyutu (bytes)
  
  -- Storage Bilgileri (download tipi için)
  file_path TEXT,                        -- Storage path
  storage_path TEXT,                     -- Supabase Storage path
  storage_url TEXT,                      -- Public URL
  source_url TEXT,                       -- Kaynak URL (ihalebul.com)
  
  -- İçerik (content tipi için)
  content_text TEXT,                     -- Site içeriği (TEXT/JSON string)
  content_type VARCHAR(50),              -- announcement, goods_services
  
  -- Döküman Tipi
  doc_type VARCHAR(50),                  -- tech_spec, admin_spec, announcement, goods_services, zeyilname, vb.
  
  -- Kaynak Tipi (KRİTİK!)
  source_type VARCHAR(20),               -- 'content' | 'download' | 'upload'
  
  -- ZIP Bilgileri
  is_extracted BOOLEAN DEFAULT FALSE,    -- ZIP'ten çıkarıldı mı?
  parent_doc_id INT REFERENCES documents(id), -- Parent ZIP/RAR ID
  
  -- İşleme Durumu
  processing_status VARCHAR(20) DEFAULT 'pending', -- pending, queued, processing, completed, failed
  
  -- Analiz Sonuçları
  extracted_text TEXT,                   -- Çıkarılan metin
  analysis_result JSONB,                 -- AI analiz sonucu
  
  uploaded_by VARCHAR(100),              -- 'system', 'user', 'scraper'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Duplike kontrolü için unique constraint
  UNIQUE(tender_id, original_filename) WHERE tender_id IS NOT NULL
);
```

### `source_type` Değerleri (KRİTİK!)

| Değer | Açıklama | Örnek |
|-------|----------|-------|
| `content` | Site içeriğinden oluşturulan döküman | İhale İlanı metni, Mal/Hizmet listesi |
| `download` | ihalebul.com'dan indirilen dosya | Teknik Şartname PDF, İdari Şartname DOCX |
| `upload` | Kullanıcının yüklediği dosya | Manuel yüklenen dökümanlar |

### `doc_type` Değerleri

| Değer | Görüntüleme Adı | Kaynak |
|-------|-----------------|--------|
| `tech_spec` | Teknik Şartname | download |
| `admin_spec` | İdari Şartname | download |
| `announcement` | İhale İlanı | content/download |
| `goods_services` | Mal/Hizmet Listesi | content |
| `goods_list` | Malzeme Listesi | download |
| `zeyilname` | Zeyilname | download |
| `zeyilname_tech_spec` | Teknik Şartname Zeyilnamesi | download |
| `zeyilname_admin_spec` | İdari Şartname Zeyilnamesi | download |
| `correction_notice` | Düzeltme İlanı | content/download |
| `contract` | Sözleşme Tasarısı | download |
| `unit_price` | Birim Fiyat Teklif Cetveli | download |
| `pursantaj` | Pursantaj Listesi | download |
| `quantity_survey` | Mahal Listesi / Metraj | download |
| `standard_forms` | Standart Formlar | download |

---

## 🔄 VERİ AKIŞI (TAM SÜREÇ)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           1. LİSTE TARAMA                                │
├─────────────────────────────────────────────────────────────────────────┤
│  list-scraper.js                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ 1. ihalebul.com'a login ol (session-manager + login-service)      │   │
│  │ 2. Kategori sayfasına git (/tenders/search?workcategory_in=15)    │   │
│  │ 3. Her ihale kartından çıkar:                                     │   │
│  │    - external_id, title, city, organization_name                  │   │
│  │    - tender_date, estimated_cost                                  │   │
│  │    - documentButtons: {tech_spec: {url, name}, admin_spec: ...}   │   │
│  │ 4. tenders tablosuna UPSERT (external_id unique)                  │   │
│  │ 5. Sonraki sayfaya geç, tekrarla                                  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ÇIKTI: tenders tablosunda document_links dolu, içerikler boş           │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        2. İÇERİK ÇEKME                                   │
├─────────────────────────────────────────────────────────────────────────┤
│  document-scraper.js → scrapeAllContent(page, tenderUrl)                 │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ 1. İhale detay sayfasına git                                      │   │
│  │ 2. Tab'ları tara (Zeyilname, Dökümanlar vb.)                      │   │
│  │ 3. Her tab için:                                                  │   │
│  │    - scrapeDocumentLinksFromPage() → download URL'leri            │   │
│  │    - scrapeAnnouncementContent() → İlan metni (TEXT)              │   │
│  │    - scrapeGoodsServicesList() → Mal/Hizmet (JSON array)          │   │
│  │    - scrapeZeyilnameContent() → Zeyilname içeriği                 │   │
│  │ 4. tenders tablosunu güncelle:                                    │   │
│  │    - document_links = gerçek indirme URL'leri                     │   │
│  │    - announcement_content = TEXT                                  │   │
│  │    - goods_services_content = JSON                                │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ÇIKTI: tenders tablosunda document_links + içerikler dolu              │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
┌───────────────────────────────┐   ┌───────────────────────────────────┐
│   3a. CONTENT DÖKÜMAN OLUŞTUR │   │   3b. DOSYA İNDİR VE YÜKLE        │
├───────────────────────────────┤   ├───────────────────────────────────┤
│ tender-content-service.js     │   │ document-storage.js               │
│ createContentDocuments()      │   │ downloadTenderDocuments()         │
│ ┌───────────────────────────┐ │   │ ┌───────────────────────────────┐ │
│ │ 1. tenders'dan içerik al  │ │   │ │ 1. document_links'ten URL al  │ │
│ │ 2. documents'a INSERT:    │ │   │ │ 2. document-download.js ile   │ │
│ │    - source_type=content  │ │   │ │    authenticated indir        │ │
│ │    - content_text=metin   │ │   │ │ 3. Dosya tipini tespit et     │ │
│ │    - doc_type=announcement│ │   │ │    (magic bytes)              │ │
│ │      veya goods_services  │ │   │ │ 4. ZIP/RAR ise:               │ │
│ │ 3. processing_status=     │ │   │ │    - DOCX/XLSX mi kontrol et  │ │
│ │    'pending'              │ │   │ │    - Gerçek ZIP ise aç        │ │
│ └───────────────────────────┘ │   │ │    - Her dosyayı ayrı kaydet  │ │
│                               │   │ │ 5. Supabase Storage'a yükle   │ │
│ API: POST /api/tender-content │   │ │ 6. documents'a INSERT:        │ │
│      /:tenderId/create-       │   │ │    - source_type=download     │ │
│      documents                │   │ │    - storage_path, storage_url│ │
└───────────────────────────────┘   │ │    - is_extracted (ZIP'ten mi)│ │
                                    │ │    - parent_doc_id (parent ZIP)│ │
                                    │ └───────────────────────────────┘ │
                                    │                                   │
                                    │ API: POST /api/tender-docs/       │
                                    │      :tenderId/download-documents │
                                    └───────────────────────────────────┘
                    │                               │
                    └───────────────┬───────────────┘
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          4. ANALİZ KUYRUĞU                               │
├─────────────────────────────────────────────────────────────────────────┤
│  tender-content-documents.js → /api/tender-content/analyze-batch        │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ 1. documentIds array al                                           │   │
│  │ 2. Her döküman için:                                              │   │
│  │    IF source_type = 'content':                                    │   │
│  │       → content_text'i Claude ile analiz et                       │   │
│  │    ELSE IF source_type = 'download':                              │   │
│  │       → Supabase'den indir                                        │   │
│  │       → claude.js → analyzeFile() ile analiz et                   │   │
│  │    IF file_type = 'zip':                                          │   │
│  │       → Atla (içindeki dosyalar zaten ayrı)                       │   │
│  │ 3. analysis_result'ı documents'a kaydet                           │   │
│  │ 4. processing_status = 'completed'                                │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ÇIKTI: documents tablosunda analysis_result dolu                       │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🔧 MODÜL DETAYLARI

### 1. browser-manager.js - Puppeteer Singleton

```javascript
class BrowserManager {
  constructor() {
    this.browser = null;
  }
  
  async getBrowser() {
    if (!this.browser || !this.browser.isConnected()) {
      this.browser = await puppeteer.launch({
        headless: 'new',
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      });
    }
    return this.browser;
  }
  
  async createPage() {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 ...');
    return page;
  }
  
  async close() {
    if (this.browser) await this.browser.close();
    this.browser = null;
  }
}
```

### 2. session-manager.js - Cookie Saklama

```javascript
// Session dosyası: backend/storage/session.json
{
  "id": "sess_1234567890_abc123",
  "cookies": [
    {"name": "auth", "value": "...", "domain": ".ihalebul.com", ...}
  ],
  "username": "xxx",
  "createdAt": 1234567890000,
  "expiresAt": 1234567890000 + 8*60*60*1000, // 8 saat
  "lastUsedAt": 1234567890000
}

// Fonksiyonlar:
saveSession(cookies, username)    // Cookie'leri kaydet
loadSession()                     // Cookie'leri yükle (süre kontrolü ile)
clearSession()                    // Session sil
isSessionValid()                  // Session geçerli mi?
applyCookies(page, cookies)       // Cookie'leri Puppeteer sayfasına uygula
```

### 3. login-service.js - ihalebul.com Authentication

```javascript
// ihalebul.com'da login modal olarak açılıyor
async performLogin(page) {
  // 1. Mevcut session'ı dene
  const session = await sessionManager.loadSession();
  if (session?.cookies) {
    await sessionManager.applyCookies(page, session.cookies);
    if (await this.isLoggedIn(page)) return true;
  }
  
  // 2. Fresh login
  return await this.freshLogin(page);
}

async freshLogin(page) {
  // 1. Ana sayfaya git
  await page.goto('https://www.ihalebul.com');
  
  // 2. Login butonunu bul ve tıkla (modal açılır)
  const loginBtn = await this.findLoginButton(page);
  await loginBtn.click();
  
  // 3. Modal'ın açılmasını bekle
  await page.waitForSelector('.modal.show', {timeout: 10000});
  
  // 4. Email/password gir
  await page.type('input[name="Email"]', process.env.IHALEBUL_USERNAME);
  await page.type('input[name="Password"]', process.env.IHALEBUL_PASSWORD);
  
  // 5. Submit
  await this.clickSubmitButton(page);
  
  // 6. Cookie'leri kaydet
  const cookies = await page.cookies();
  await sessionManager.saveSession(cookies, process.env.IHALEBUL_USERNAME);
  
  return true;
}

async isLoggedIn(page) {
  // Kullanıcı menüsü var mı kontrol et
  return await page.evaluate(() => {
    return !!document.querySelector('.user-dropdown, .user-menu, [href*="logout"]');
  });
}
```

### 4. list-scraper.js - Liste Tarama

```javascript
export async function scrapeList(page, options = {}) {
  const { maxPages = 100, startPage = 1, includeDocuments = false } = options;
  
  await loginService.ensureLoggedIn(page);
  await page.goto(CATEGORY_URL, { waitUntil: 'networkidle2' });
  
  while (currentPage <= maxPages) {
    // Scroll (lazy load için)
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    
    // İhaleleri çıkar
    const tenders = await extractTenders(page);
    
    // Maskelenmiş veri kontrolü (login sorunu)
    const maskedCount = tenders.filter(t => isMasked(t)).length;
    if (maskedCount > tenders.length * 0.3) {
      await loginService.forceRelogin(page);
      continue;
    }
    
    // Opsiyonel: Her ihale için içerikleri de çek
    if (includeDocuments) {
      for (const tender of tenders) {
        const content = await documentScraper.scrapeAllContent(page, tender.url);
        Object.assign(tender, {
          document_links: content.documentLinks,
          announcement_content: content.announcementContent,
          goods_services_content: content.goodsServicesList,
          ...
        });
      }
    }
    
    // DB'ye kaydet (UPSERT)
    for (const tender of tenders) {
      await saveTender(tender);
    }
    
    // Sonraki sayfa
    await page.goto(`${CATEGORY_URL}&page=${++currentPage}`);
  }
}

// İhale kartından veri çıkarma
async function extractTenders(page) {
  return await page.evaluate(() => {
    const tenders = [];
    
    document.querySelectorAll('.card.border-secondary.my-2.mx-1').forEach(card => {
      // Detay linki
      const detailLink = card.querySelector('a[href*="/tender/"]');
      const url = detailLink?.href;
      const id = url?.match(/\/tender\/(\d+)$/)?.[1];
      
      // Döküman butonları - URL pattern'ine göre tip belirle
      const documentButtons = {};
      card.querySelectorAll('a.btn[href*="/tender/"]').forEach(btn => {
        const match = btn.href.match(/\/tender\/\d+\/(\d+)/);
        const typeCode = match?.[1];
        
        // ihalebul.com URL kodları:
        // 2 = İhale İlanı, 3 = Düzeltme, 6 = Malzeme, 7 = İdari, 8 = Teknik, 9 = Zeyilname
        const typeMap = {
          2: 'announcement', 3: 'correction_notice', 6: 'goods_list',
          7: 'admin_spec', 8: 'tech_spec', 9: 'zeyilname'
        };
        
        if (typeMap[typeCode]) {
          documentButtons[typeMap[typeCode]] = {
            url: btn.href.split('?')[0],
            name: btn.textContent.trim()
          };
        }
      });
      
      tenders.push({ id, url, documentButtons, ... });
    });
    
    return tenders;
  });
}
```

### 5. document-scraper.js - İçerik Çekme

```javascript
async scrapeAllContent(page, tenderUrl) {
  await page.goto(tenderUrl, { waitUntil: 'networkidle2' });
  
  // 1. Mevcut sayfadaki döküman linklerini çek
  let allDocumentLinks = await this.scrapeDocumentLinksFromPage(page);
  
  // 2. Tab'ları tara (Zeyilname, Dökümanlar vb.)
  const tabDocuments = await this.scrapeTabContents(page);
  allDocumentLinks = { ...allDocumentLinks, ...tabDocuments };
  
  // 3. İçerikleri çek
  const announcementContent = await this.scrapeAnnouncementContent(page);
  const goodsServicesList = await this.scrapeGoodsServicesList(page);
  const zeyilnameContent = await this.scrapeZeyilnameContent(page);
  
  return {
    documentLinks: allDocumentLinks,      // {tech_spec: {url, name}, ...}
    announcementContent,                   // TEXT string
    goodsServicesList,                     // JSON array [{kalem, miktar, birim}, ...]
    zeyilnameContent,                      // JSON
  };
}

// Download URL'lerini bul
async scrapeDocumentLinksFromPage(page) {
  return await page.evaluate(() => {
    const documents = {};
    
    // Geniş selector - download içeren tüm linkler
    const selectors = [
      'a[href*="download"]', 'a[href*=".pdf"]', 'a[href*=".doc"]',
      'a[href*=".xls"]', 'a[href*=".zip"]'
    ];
    
    document.querySelectorAll(selectors.join(', ')).forEach(link => {
      const href = link.href;
      
      // URL'den hash parametresini decode et (dosya adı)
      const hash = new URL(href).searchParams.get('hash');
      if (hash) {
        const fileName = atob(hash);
        // Dosya adından tip belirle
        if (fileName.includes('idari')) docType = 'admin_spec';
        else if (fileName.includes('teknik')) docType = 'tech_spec';
        ...
      }
      
      documents[docType] = { url: href, name: link.textContent };
    });
    
    return documents;
  });
}

// Mal/Hizmet tablosunu çek
async scrapeGoodsServicesList(page) {
  return await page.evaluate(() => {
    // DataTable'ı bul
    const table = document.querySelector('table.dataTable');
    if (!table) return null;
    
    const rows = [];
    table.querySelectorAll('tbody tr').forEach(tr => {
      const cells = tr.querySelectorAll('td');
      rows.push({
        sira: cells[0]?.textContent,
        kalem: cells[1]?.textContent,
        miktar: cells[2]?.textContent,
        birim: cells[3]?.textContent
      });
    });
    
    return rows;
  });
}
```

### 6. document-download.js - Authenticated İndirme

```javascript
class DocumentDownloadService {
  async downloadDocument(documentUrl) {
    // 1. Session cookie'lerini al
    const session = await sessionManager.loadSession();
    if (!session?.cookies) {
      throw new Error('Session bulunamadı');
    }
    
    // 2. Cookie header oluştur
    const cookieHeader = session.cookies
      .map(c => `${c.name}=${c.value}`)
      .join('; ');
    
    // 3. Fetch ile indir
    const response = await fetch(documentUrl, {
      headers: {
        'Cookie': cookieHeader,
        'User-Agent': 'Mozilla/5.0 ...',
        'Referer': 'https://www.ihalebul.com/'
      }
    });
    
    return await response.buffer();
  }
}
```

### 7. document-storage.js - Supabase Storage + ZIP İşleme

```javascript
class DocumentStorageService {
  async downloadTenderDocuments(tenderId) {
    // 1. İhale bilgilerini al
    const tender = await pool.query('SELECT document_links FROM tenders WHERE id = $1', [tenderId]);
    const documentLinks = tender.rows[0].document_links;
    
    // 2. Her döküman için indir
    for (const [docType, docData] of Object.entries(documentLinks)) {
      const url = docData.url;
      
      // Daha önce indirilmiş mi kontrol et
      if (await this.isAlreadyDownloaded(tenderId, url)) continue;
      
      // İndir
      const result = await this.downloadAndStore(tenderId, docType, url, docData.name);
    }
  }
  
  async downloadAndStore(tenderId, docType, url, displayName) {
    // 1. Dosyayı indir
    const fileBuffer = await documentDownloadService.downloadDocument(url);
    
    // 2. Dosya tipini tespit et (magic bytes)
    const extension = this.detectFileType(fileBuffer);
    
    // 3. ZIP/RAR ise aç
    if (extension === '.zip' || extension === '.rar') {
      return await this.extractAndUpload(tenderId, docType, tempFilePath, url);
    }
    
    // 4. Tek dosya yükle
    return await this.uploadSingleFile(tenderId, docType, fileBuffer, extension, displayName, url);
  }
  
  async extractAndUpload(tenderId, docType, zipPath, sourceUrl) {
    const zip = new AdmZip(zipPath);
    const zipEntries = zip.getEntries();
    
    // DOCX/XLSX kontrolü - ZIP gibi görünen Office dosyaları
    const entryNames = zipEntries.map(e => e.entryName.toLowerCase());
    const hasContentTypes = entryNames.some(n => n.includes('[content_types].xml'));
    const isDocx = hasContentTypes && entryNames.some(n => n.includes('word/document.xml'));
    const isXlsx = hasContentTypes && entryNames.some(n => n.includes('xl/workbook.xml'));
    
    if (isDocx || isXlsx) {
      // Bu aslında bir Office dosyası
      const realExt = isDocx ? '.docx' : '.xlsx';
      return await this.uploadSingleFile(..., realExt, ...);
    }
    
    // Gerçek ZIP - içindekileri çıkar
    const results = [];
    for (const entry of zipEntries) {
      if (entry.isDirectory) continue;
      
      const fileExt = path.extname(entry.entryName);
      if (!SUPPORTED_EXTENSIONS.includes(fileExt)) continue;
      
      const buffer = entry.getData();
      const fileDocType = this.detectDocTypeFromFileName(entry.entryName, docType);
      
      const result = await this.uploadSingleFile(
        tenderId, fileDocType, buffer, fileExt, entry.entryName, 
        `${sourceUrl}#file=${entry.entryName}`,
        true  // isExtracted = true
      );
      results.push(result);
    }
    
    // ZIP'in kendisini de kaydet (parent olarak)
    const archiveResult = await this.uploadSingleFile(..., true);
    
    // Child'ların parent_doc_id'sini güncelle
    await pool.query('UPDATE documents SET parent_doc_id = $1 WHERE id = ANY($2)', 
      [archiveResult.documentId, results.map(r => r.documentId)]);
    
    return [archiveResult, ...results];
  }
  
  async uploadSingleFile(tenderId, docType, buffer, extension, displayName, sourceUrl, isExtracted = false) {
    // 1. Unique dosya adı oluştur
    const storageFileName = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${safeFileName}${extension}`;
    const storagePath = `tenders/${tenderId}/${docType}/${storageFileName}`;
    
    // 2. Supabase Storage'a yükle
    await supabase.storage.from('tender-documents').upload(storagePath, buffer);
    
    // 3. Public URL al
    const { data } = supabase.storage.from('tender-documents').getPublicUrl(storagePath);
    
    // 4. documents tablosuna kaydet
    await pool.query(`
      INSERT INTO documents (
        tender_id, filename, original_filename, file_type, file_size,
        storage_path, storage_url, source_url, doc_type,
        source_type, is_extracted, processing_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'download', $10, 'pending')
    `, [tenderId, storageFileName, displayName, extension, buffer.length, 
        storagePath, data.publicUrl, sourceUrl, docType, isExtracted]);
  }
  
  // Magic bytes ile dosya tipi tespit
  detectFileType(buffer) {
    if (buffer[0] === 0x25 && buffer[1] === 0x50) return '.pdf';      // %PDF
    if (buffer[0] === 0x50 && buffer[1] === 0x4b) return '.zip';      // PK (ZIP/DOCX/XLSX)
    if (buffer[0] === 0x52 && buffer[1] === 0x61) return '.rar';      // Rar!
    return null;
  }
}
```

### 8. tender-content-service.js - Content Döküman Oluşturma

```javascript
class TenderContentService {
  async createContentDocuments(tenderId) {
    // 1. İhale bilgilerini al
    const tender = await pool.query(
      'SELECT announcement_content, goods_services_content FROM tenders WHERE id = $1',
      [tenderId]
    );
    
    // 2. İhale İlanı dökümanı oluştur
    if (tender.announcement_content) {
      await pool.query(`
        INSERT INTO documents (
          tender_id, filename, original_filename, file_type, file_size,
          content_text, content_type, doc_type, source_type, processing_status
        ) VALUES ($1, $2, $3, 'text', $4, $5, 'announcement', 'announcement', 'content', 'pending')
      `, [tenderId, `ihale-ilani-${tenderId}.txt`, 'İhale İlanı', 
          tender.announcement_content.length, tender.announcement_content]);
    }
    
    // 3. Mal/Hizmet Listesi dökümanı oluştur
    if (tender.goods_services_content?.length > 0) {
      const contentText = this.formatGoodsServicesAsText(tender.goods_services_content);
      await pool.query(`
        INSERT INTO documents (
          tender_id, filename, original_filename, file_type, file_size,
          content_text, content_type, doc_type, source_type, processing_status
        ) VALUES ($1, $2, $3, 'json', $4, $5, 'goods_services', 'goods_services', 'content', 'pending')
      `, [tenderId, `mal-hizmet-${tenderId}.json`, 'Mal/Hizmet Listesi', 
          contentText.length, contentText]);
    }
  }
}
```

---

## 🌐 API ENDPOINT'LERİ

### Scraper API (`/api/scraper`)

```
POST /api/scraper/trigger
  Body: { maxPages: 5, includeDocuments: true }
  → Liste taramayı başlat

POST /api/scraper/fetch-documents/:tenderId
  → Tek ihale için detay sayfasını tara, içerikleri çek, document_links güncelle

POST /api/scraper/add-tender
  Body: { url: "https://ihalebul.com/tender/123456" }
  → URL ile tek ihale ekle
```

### Döküman İndirme API (`/api/tender-docs`)

```
POST /api/tender-docs/:tenderId/download-documents
  → document_links'teki tüm dosyaları indir ve Supabase'e yükle

GET /api/tender-docs/:tenderId/download-status
  → İndirme durumunu kontrol et

GET /api/tender-docs/:tenderId/downloaded-documents
  → İndirilen dökümanları listele
```

### Content Döküman API (`/api/tender-content`)

```
POST /api/tender-content/:tenderId/create-documents
  → Site içeriklerinden (announcement, goods_services) döküman oluştur

GET /api/tender-content/:tenderId/documents
  → Content dökümanlarını listele

GET /api/tender-content/:tenderId/all-documents
  → Tüm dökümanları listele (content + download + upload)

POST /api/tender-content/analyze-batch
  Body: { documentIds: [1, 2, 3] }
  → Seçilen dökümanları analiz et (SSE stream)

POST /api/tender-content/documents/:documentId/queue
  → Dökümanı analiz kuyruğuna ekle

GET /api/tender-content/queue/status
  → Kuyruk durumunu göster
```

---

## 🚀 KULLANIM AKIŞI

### 1. Yeni İhale Listesi Tarama (Cron Job)

```bash
# CLI ile
node backend/src/scraper/runner.js --mode=list --pages=5

# API ile
curl -X POST http://localhost:3001/api/scraper/trigger \
  -H "Content-Type: application/json" \
  -d '{"maxPages": 5}'
```

### 2. Tek İhale İçin Tam İşlem

```bash
# 1. İçerikleri çek (tenders tablosunu güncelle)
curl -X POST http://localhost:3001/api/scraper/fetch-documents/17813

# 2. Content dökümanları oluştur (documents tablosuna ekle)
curl -X POST http://localhost:3001/api/tender-content/17813/create-documents

# 3. Dosyaları indir (Supabase'e yükle, documents tablosuna ekle)
curl -X POST http://localhost:3001/api/tender-docs/17813/download-documents

# 4. Dökümanları listele
curl http://localhost:3001/api/tender-content/17813/all-documents

# 5. Analiz et
curl -X POST http://localhost:3001/api/tender-content/analyze-batch \
  -H "Content-Type: application/json" \
  -d '{"documentIds": [193, 195, 196]}'
```

---

## ⚙️ ENVIRONMENT VARIABLES

```env
# Zorunlu
DATABASE_URL=postgres://...
IHALEBUL_USERNAME=xxx
IHALEBUL_PASSWORD=xxx
SUPABASE_SERVICE_KEY=xxx
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
ANTHROPIC_API_KEY=sk-ant-xxx

# Opsiyonel
PUPPETEER_EXECUTABLE_PATH=/snap/bin/chromium  # Production
SESSION_TTL_HOURS=8                            # Session süresi
```

---

## 🔒 GÜVENLİK NOTLARI

1. **Session Yönetimi**: Cookie'ler `storage/session.json`'da saklanır, `.gitignore`'da olmalı
2. **Rate Limiting**: İndirmeler arası 2 saniye bekleme (`downloadDelay`)
3. **Maskelenmiş Veri**: Login sorunu varsa `***` içeren veriler gelir, otomatik re-login yapılır
4. **Duplike Kontrolü**: `(tender_id, original_filename)` unique constraint ile

---

## 🐛 HATA GİDERME

### "Session bulunamadı"
→ Scraper'ı çalıştır: `node runner.js --mode=list --pages=1`

### "Maskelenmiş veri"
→ `storage/session.json` sil ve tekrar login ol

### "ZIP açılamadı"
→ DOCX/XLSX olabilir, `extractAndUpload` otomatik algılar

### "Storage yükleme hatası"
→ `SUPABASE_SERVICE_KEY` kontrol et, bucket public mi?

---

## 📝 ÖNEMLİ KURALLAR

1. **source_type her zaman doğru olmalı**: content / download / upload
2. **ZIP'ten çıkan dosyalar**: `is_extracted = true`, `parent_doc_id` set edilmeli
3. **DOCX/XLSX algılama**: ZIP gibi görünen Office dosyaları otomatik algılanmalı
4. **Analiz için**: `source_type = 'content'` olanlar `content_text`'ten, `download` olanlar Storage'dan okunur
5. **processing_status akışı**: pending → queued → processing → completed/failed

---

*Bu prompt ile tam bir ihale döküman yönetim sistemi kurulabilir.*
