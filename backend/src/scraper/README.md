# İhale Scraper v3.0

ihalebul.com'dan "Hazır Yemek" kategorisindeki ihaleleri çeken scraper sistemi.

## 📁 Dosya Yapısı

```
scraper/
├── browser-manager.js   # Puppeteer singleton
├── session-manager.js   # Cookie saklama (session.json)
├── login-service.js     # ihalebul.com authentication
├── list-scraper.js      # Liste tarama + DB kayıt
├── document-scraper.js  # Detay sayfası içerik çekme
├── logger.js            # Basit loglama
├── runner.js            # CLI aracı
└── index.js             # Export
```

## 🚀 Kullanım

### CLI

```bash
# Liste tara (varsayılan 5 sayfa)
node runner.js --mode=list --pages=5

# Liste + döküman içerikleri (her ihale için detay sayfasına gider)
node runner.js --mode=full --pages=3

# Tek ihale ekle (URL ile)
node runner.js --mode=single --url=https://ihalebul.com/tender/123456

# Yardım
node runner.js --help
```

### Kod İçinden

```javascript
import { scrapeList, documentScraper, browserManager } from './scraper/index.js';

// Liste tara
const page = await browserManager.createPage();
const result = await scrapeList(page, { maxPages: 5, includeDocuments: false });
await browserManager.close();

// Tek ihale detay
const details = await documentScraper.scrapeTenderDetails(page, 'https://ihalebul.com/tender/123');
```

## 📊 Veri Akışı

```
ihalebul.com
    │
    ▼
┌─────────────────┐
│  list-scraper   │ ─────► tenders tablosu
│                 │        ├── title, city, tender_date
│  (Liste Sayfası)│        ├── document_links (buton URL'leri)
└────────┬────────┘        └── documentButtons
         │
         │ includeDocuments=true
         ▼
┌─────────────────┐
│ document-scraper│ ─────► tenders tablosu (güncelleme)
│                 │        ├── announcement_content (TEXT)
│ (Detay Sayfası) │        ├── goods_services_content (JSON)
└─────────────────┘        ├── zeyilname_content
                           └── correction_notice_content
```

## 🔧 Environment Variables

```env
# Zorunlu
IHALEBUL_USERNAME=xxx
IHALEBUL_PASSWORD=xxx
DATABASE_URL=postgres://...

# Opsiyonel
PUPPETEER_EXECUTABLE_PATH=/snap/bin/chromium  # Production için
SESSION_TTL_HOURS=8                            # Session süresi
LOG_LEVEL=INFO                                 # DEBUG, INFO, WARN, ERROR
LOG_TO_DB=false                                # DB'ye log kaydet
```

## 📅 Cron Schedule

`tender-scheduler.js` tarafından yönetilir:

| Saat  | İşlem | Sayfa |
|-------|-------|-------|
| 08:00 | Liste | 5 |
| 09:00 | Döküman | - |
| 14:00 | Liste | 3 |
| 15:00 | Döküman | - |
| 19:00 | Liste | 2 |
| 03:00 | Temizlik | - |

## 🗃️ Database Tabloları

### tenders
- `external_id` - ihalebul ID
- `title`, `city`, `organization_name`
- `tender_date`, `estimated_cost`
- `document_links` - JSON (indirme URL'leri)
- `announcement_content` - İhale ilanı (TEXT)
- `goods_services_content` - Mal/Hizmet listesi (JSON)
- `zeyilname_content` - Zeyilname (JSON)
- `correction_notice_content` - Düzeltme ilanı (TEXT)

### scraper_logs
- `action`, `status`, `message`
- `tenders_found`, `tenders_new`, `tenders_updated`

## 🔒 Session Yönetimi

Session cookie'leri `storage/session.json` dosyasında saklanır:

```json
{
  "id": "sess_xxx",
  "cookies": [...],
  "username": "xxx",
  "createdAt": 1234567890,
  "expiresAt": 1234567890,
  "lastUsedAt": 1234567890
}
```

Session süresi dolduğunda otomatik re-login yapılır.

## 🐛 Troubleshooting

### "Masked data" hatası
- Login sorunu, session süresi dolmuş olabilir
- `storage/session.json` dosyasını sil ve tekrar dene

### "Browser launch failed"
- Production'da: `PUPPETEER_EXECUTABLE_PATH=/snap/bin/chromium`
- `snap install chromium` ile Chromium kur

### "Timeout" hatası
- Site yavaş veya bloklanmış olabilir
- IP değiştir veya daha sonra dene

## 📦 Backup

Eski sistem backup'ı: `backend/src/scraper-backup/`
