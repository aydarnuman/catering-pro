# Backend API Dokümantasyonu

## 🎯 Genel Bakış

Catering Pro backend servisi, Node.js + Express.js üzerine inşa edilmiş RESTful API'dir. PostgreSQL veritabanı (Supabase) kullanır.

## 🚀 Başlatma

```bash
cd backend
npm install
npm run dev        # Development (nodemon)
npm start          # Production
```

**Port:** 3001 (default)

---

## 📁 Klasör Yapısı

```
src/
├── routes/              # API endpoint'leri
│   ├── auth.js          # Kimlik doğrulama
│   ├── cariler.js       # Müşteri/Tedarikçi
│   ├── stok.js          # Stok yönetimi
│   ├── personel.js      # Personel işlemleri
│   ├── bordro.js        # Bordro hesaplama
│   ├── invoices.js      # Fatura yönetimi
│   ├── kasa-banka.js    # Nakit yönetimi
│   ├── tenders.js       # İhale takibi
│   ├── planlama.js      # Menü planlama
│   ├── ai.js            # AI asistan
│   └── ...
├── services/            # İş mantığı servisleri
│   ├── gemini.js        # Google Gemini AI
│   ├── claude.js        # Claude AI
│   ├── document.js      # Döküman işleme
│   └── ...
├── scraper/             # Web scraping
├── migrations/          # SQL migration dosyaları
├── database.js          # DB connection pool
└── server.js            # Express app entry
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
```

### Pagination

```
GET /api/endpoint?page=1&limit=20
```

### Filtering

```
GET /api/cariler?tip=musteri&aktif=true&search=abc
```

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
} finally {
  client.release();
}
```

---

## 📝 Migration Kullanımı

```bash
# Yeni migration oluştur
# Dosya adı: XXX_aciklama.sql (sıradaki numara)

# Migration çalıştır
npm run migrate
```

**Konum:** `src/migrations/`

---

## 🔧 Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:pass@host:5432/db

# AI Services
GEMINI_API_KEY=xxx
CLAUDE_API_KEY=xxx

# Auth
JWT_SECRET=xxx
NEXTAUTH_SECRET=xxx

# Scraper
IHALEBUL_USERNAME=xxx
IHALEBUL_PASSWORD=xxx
```

---

## 📊 Route Listesi

| Route | Açıklama |
|-------|----------|
| `/api/auth/*` | Kimlik doğrulama |
| `/api/cariler/*` | Cari hesap yönetimi |
| `/api/stok/*` | Stok/Depo yönetimi |
| `/api/personel/*` | Personel işlemleri |
| `/api/bordro/*` | Bordro hesaplama |
| `/api/invoices/*` | Fatura yönetimi |
| `/api/kasa-banka/*` | Nakit akış |
| `/api/tenders/*` | İhale takibi |
| `/api/documents/*` | Döküman işleme |
| `/api/planlama/*` | Menü planlama |
| `/api/ai/*` | AI asistan |
| `/api/projeler/*` | Proje yönetimi |
| `/api/satin-alma/*` | Satın alma |

---

## ⚠️ Önemli Kurallar

1. **SQL Injection:** Parameterized queries kullan (`$1, $2...`)
2. **Error Handling:** Her route'da try-catch
3. **Logging:** `console.error` yerine proper logging
4. **Validation:** Input validation her endpoint'te
5. **Türkçe Karakter:** UTF-8 encoding

---

## 🧪 Test

```bash
# API health check
curl http://localhost:3001/health

# Auth test
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test"}'
```
