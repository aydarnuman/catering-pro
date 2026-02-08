# Backend API Dokümantasyonu

## 🎯 Genel Bakış

Catering Pro backend servisi, Node.js + Express.js üzerine inşa edilmiş RESTful API'dir. PostgreSQL veritabanı (Supabase) kullanır.

**Son Güncelleme:** Şubat 2026

## 🚀 Başlatma

```bash
cd backend
npm install
npm run dev        # Development (nodemon)
npm start          # Production
npm run migrate    # Database migrations
```

**Port:** 3001 (default)

---

## 📁 Klasör Yapısı

```
backend/
├── src/
│   ├── routes/              # API endpoint'leri (39 dosya)
│   │   ├── auth.js          # Kimlik doğrulama
│   │   ├── tenders.js       # İhale yönetimi
│   │   ├── tender-tracking.js # İhale takip listesi
│   │   ├── teklifler.js     # Teklif hazırlama
│   │   ├── documents.js     # Döküman işleme
│   │   ├── cariler.js       # Cari hesaplar
│   │   ├── invoices.js      # Fatura yönetimi
│   │   ├── stok.js          # Stok/Depo yönetimi
│   │   ├── personel.js      # Personel işlemleri
│   │   ├── bordro.js        # Bordro hesaplama
│   │   ├── izin.js          # İzin yönetimi
│   │   ├── kasa-banka.js    # Nakit yönetimi
│   │   ├── planlama.js      # Üretim planlama
│   │   ├── menu-planlama.js # Menü planlama
│   │   ├── ai.js            # AI asistan
│   │   ├── notifications.js # Bildirimler
│   │   ├── projeler.js      # Proje yönetimi
│   │   ├── satin-alma.js    # Satın alma
│   │   ├── search.js        # Global arama
│   │   └── ... (detay: routes/README.md)
│   │
│   ├── services/            # İş mantığı (33+ dosya)
│   │   ├── claude-ai-service.js  # Claude AI entegrasyonu
│   │   ├── ai-analyzer/          # Unified Pipeline v9 (Azure + Claude)
│   │   ├── document-analysis.js  # Döküman işleme
│   │   ├── bordro-service.js     # Bordro hesaplama
│   │   ├── cari-service.js       # Cari işlemler
│   │   ├── personel-service.js   # Personel işlemler
│   │   ├── sync-scheduler.js     # Otomatik sync
│   │   ├── tender-scheduler.js   # İhale scraper
│   │   ├── document-queue-processor.js # Döküman kuyruğu
│   │   ├── notification-service.js     # Bildirimler
│   │   ├── logger.js             # Winston logger
│   │   ├── ai-tools/             # AI araç modülleri (10 dosya)
│   │   │   ├── index.js          # Merkezi registry
│   │   │   ├── cari-tools.js
│   │   │   ├── personel-tools.js
│   │   │   ├── satin-alma-tools.js
│   │   │   ├── web-tools.js
│   │   │   ├── piyasa-tools.js
│   │   │   └── menu-tools.js
│   │   └── ... (detay: services/README.md)
│   │
│   ├── scraper/             # Web scraping (v4.0 modüler yapı)
│   │   ├── index.js         # Ana barrel export
│   │   ├── shared/          # Ortak altyapı
│   │   │   ├── browser.js         # Puppeteer singleton
│   │   │   ├── ihalebul-login.js  # ihalebul.com login
│   │   │   ├── ihalebul-cookie.js # Cookie yönetimi
│   │   │   └── scraper-logger.js  # DB loglama
│   │   ├── ihale-tarama/    # İhale tarama işçileri
│   │   │   ├── ihale-listesi-cek.js   # Liste tarama
│   │   │   ├── ihale-icerik-cek.js    # Döküman içerik çekme
│   │   │   └── ihale-tarama-cli.js    # CLI runner
│   │   ├── yuklenici-istihbarat/  # Yüklenici istihbarat
│   │   │   ├── yuklenici-listesi-cek.js  # Firma listesi
│   │   │   ├── yuklenici-gecmisi-cek.js  # İhale geçmişi
│   │   │   ├── yuklenici-profil-cek.js   # Profil analizi
│   │   │   └── ihale-katilimci-cek.js    # Katılımcılar
│   │   └── uyumsoft/        # e-Fatura sistemi
│   │
│   ├── migrations/          # SQL migrations (54 dosya)
│   │   └── ... (detay: migrations/README.md)
│   │
│   ├── database.js          # PostgreSQL connection pool
│   ├── server.js            # Express app entry
│   └── swagger.js           # API dokümantasyonu
│
├── logs/                    # Winston log dosyaları
│   ├── app-YYYY-MM-DD.log
│   ├── error-YYYY-MM-DD.log
│   └── exceptions-YYYY-MM-DD.log
│
├── storage/                 # Session dosyaları
│   └── session.json
│
├── uploads/                 # Yüklenen dosyalar
│
└── temp/                    # Geçici dosyalar
```

---

## 🔐 Kimlik Doğrulama

JWT tabanlı authentication kullanılır.

```javascript
// Header
Authorization: Bearer <token>

// Token alımı
POST /api/auth/login
{ "email": "user@example.com", "password": "xxx" }

// Response
{ "success": true, "token": "eyJ...", "user": {...} }
```

---

## 📡 API Standartları

### Response Format

```javascript
// Başarılı
{ "success": true, "data": {...}, "count": 10 }

// Hata
{ "success": false, "error": "Hata mesajı" }

// Pagination
{
  "success": true,
  "data": [...],
  "count": 150,
  "page": 1,
  "totalPages": 8
}
```

### Pagination

```
GET /api/endpoint?page=1&limit=20
```

### Filtering

```
GET /api/cariler?tip=musteri&aktif=true&search=abc
GET /api/tenders?city=Ankara&status=active
GET /api/invoices?startDate=2026-01-01&endDate=2026-01-31
```

### Sorting

```
GET /api/tenders?sort=tender_date&order=desc
```

---

## 📊 Route Listesi (Özet)

| Route | Dosya | Açıklama |
|-------|-------|----------|
| `/api/auth/*` | auth.js | Kimlik doğrulama |
| `/api/tenders/*` | tenders.js | İhale yönetimi |
| `/api/tender-tracking/*` | tender-tracking.js | İhale takip listesi |
| `/api/teklifler/*` | teklifler.js | Teklif hazırlama |
| `/api/documents/*` | documents.js | Döküman işleme |
| `/api/cariler/*` | cariler.js | Cari hesap yönetimi |
| `/api/invoices/*` | invoices.js | Fatura yönetimi |
| `/api/stok/*` | stok.js | Stok/Depo yönetimi |
| `/api/personel/*` | personel.js | Personel işlemleri |
| `/api/bordro/*` | bordro.js | Bordro hesaplama |
| `/api/izin/*` | izin.js | İzin yönetimi |
| `/api/kasa-banka/*` | kasa-banka.js | Nakit akış |
| `/api/planlama/*` | planlama.js | Üretim planlama |
| `/api/menu-planlama/*` | menu-planlama.js | Menü planlama |
| `/api/projeler/*` | projeler.js | Proje yönetimi |
| `/api/satin-alma/*` | satin-alma.js | Satın alma |
| `/api/ai/*` | ai.js | AI asistan |
| `/api/notifications/*` | notifications.js | Bildirimler |
| `/api/search/*` | search.js | Global arama |
| `/api/export/*` | export.js | Dışa aktarma |
| `/api/notlar/*` | notlar.js | Dashboard notları |

**Detaylı endpoint listesi:** `src/routes/README.md`

---

## 🗃️ Veritabanı

**Bağlantı:** `src/database.js`

```javascript
import { query, pool } from './database.js';

// Tekli sorgu
const result = await query('SELECT * FROM cariler WHERE id = $1', [id]);

// Transaction
const client = await pool.connect();
try {
  await client.query('BEGIN');
  // işlemler...
  await client.query('COMMIT');
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  client.release();
}
```

---

## 📝 Migration Kullanımı

```bash
# Migration çalıştır
npm run migrate

# Manuel çalıştırma
psql $DATABASE_URL -f src/migrations/XXX_dosya.sql
```

**Konum:** `src/migrations/` (54 dosya)
**Detay:** `src/migrations/README.md`

---

## 🤖 AI Servisleri

### Claude AI (claude-ai-service.js)
- Streaming chat responses
- Tool calling (ai-tools registry)
- Conversation memory

### Azure Document AI + Unified Pipeline (ai-analyzer/)
- Azure Document Intelligence (Custom Model + Layout)
- Claude Semantic analiz
- PDF/Word/Excel/Image OCR ve yapılandırılmış veri çıkarma

### AI Tools Registry (ai-tools/)
- cari-tools: Cari hesap sorguları
- personel-tools: Personel/bordro sorguları
- satin-alma-tools: Satın alma işlemleri
- web-tools: Web araması
- piyasa-tools: Piyasa fiyatları
- menu-tools: Menü/reçete sorguları

---

## 🔄 Scheduled Tasks

Backend başlatıldığında otomatik çalışan servisler:

1. **sync-scheduler.js** - Uyumsoft senkronizasyonu
2. **tender-scheduler.js** - İhale scraper (günlük)
3. **document-queue-processor.js** - Döküman analiz kuyruğu

---

## 📚 Swagger Dokümantasyonu

```
http://localhost:3001/api-docs
http://localhost:3001/api-docs.json
```

---

## 🔧 Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:pass@host:5432/db

# AI Services
ANTHROPIC_API_KEY=xxx
AZURE_DOCUMENT_AI_ENDPOINT=xxx
AZURE_DOCUMENT_AI_KEY=xxx

# Auth
JWT_SECRET=xxx

# Scraper
IHALEBUL_USERNAME=xxx
IHALEBUL_PASSWORD=xxx

# Server
PORT=3001
NODE_ENV=development
```

---

## 📊 Logging

Winston logger ile günlük log dosyaları:

```
logs/
├── app-YYYY-MM-DD.log      # Genel loglar
├── error-YYYY-MM-DD.log    # Hata logları
├── exceptions-YYYY-MM-DD.log # Yakalanmamış hatalar
└── rejections-YYYY-MM-DD.log # Promise rejections
```

---

## ⚠️ Önemli Kurallar

1. **SQL Injection:** Parameterized queries kullan (`$1, $2...`)
2. **Error Handling:** Her route'da try-catch
3. **Logging:** Winston logger kullan
4. **Validation:** Input validation her endpoint'te
5. **Türkçe Karakter:** UTF-8 encoding
6. **Tarih Format:** ISO 8601 (YYYY-MM-DD)
7. **Para Birimi:** TRY, DECIMAL(15,2)

---

## 🧪 Test

```bash
# API health check
curl http://localhost:3001/health

# Swagger UI
open http://localhost:3001/api-docs

# Auth test
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test"}'
```
