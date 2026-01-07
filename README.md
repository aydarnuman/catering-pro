# 🍽️ Catering Pro - İhale Takip Sistemi

Hazır yemek sektörü için ihale takip ve yönetim sistemi.

## 🚀 Özellikler

- ✅ **İhale Scraping** - ihalebul.com otomasyonu
- ✅ **Döküman İşleme** - PDF/Word/Excel + AI analiz (Gemini)
- ✅ **Admin Panel** - Modern Next.js UI
- ✅ **Authentication** - JWT + NextAuth
- ✅ **PostgreSQL** - Güçlü veri yönetimi

## 📁 Proje Yapısı

```
.
├── backend/              # Node.js + Express
│   └── src/
│       ├── routes/       # API endpoints
│       ├── services/     # Döküman işleme, AI
│       ├── scraper/      # İhale scraper
│       └── server.js     # Ana server
├── frontend/             # Next.js + React
│   └── src/
│       ├── app/          # Pages
│       └── components/   # UI components
├── database/
│   └── migrations/       # SQL migrations
├── uploads/              # Yüklenen dosyalar
└── docker-compose.yml    # PostgreSQL
```

## 🛠️ Kurulum

### 1. Bağımlılıkları Yükle

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 2. PostgreSQL Başlat

```bash
docker-compose up -d
```

### 3. Environment Dosyası

```bash
cp .env.example .env
# .env dosyasını düzenle
```

**Gerekli değişkenler:**
- `DATABASE_URL` - PostgreSQL bağlantısı
- `GEMINI_API_KEY` - Google Gemini AI key
- `IHALEBUL_USERNAME` - ihalebul.com kullanıcı adı
- `IHALEBUL_PASSWORD` - ihalebul.com şifre
- `JWT_SECRET` - Auth için secret
- `NEXTAUTH_SECRET` - NextAuth için secret

### 4. Database Migration

```bash
cd backend
npm run migrate
```

### 5. İlk Kullanıcı Oluştur

```bash
# Backend'de
npm run dev

# Başka terminalde
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "admin123",
    "name": "Admin User",
    "role": "admin"
  }'
```

## 🎯 Kullanım

### Backend API Server

```bash
cd backend
npm run dev
# http://localhost:3001
```

### Frontend Admin Panel

```bash
cd frontend
npm run dev
# http://localhost:3000
```

### Scraper Çalıştırma

```bash
cd backend

# Liste scraping (10 sayfa)
npm run scraper -- --action=list --maxPages=10

# Belirli sayfadan başla
npm run scraper -- --action=list --maxPages=20 --startPage=5
```

## 📡 API Endpoints

### Auth
- `POST /api/auth/login` - Login
- `POST /api/auth/register` - Yeni kullanıcı
- `GET /api/auth/me` - Mevcut kullanıcı

### Tenders
- `GET /api/tenders` - İhale listesi (pagination + filter)
- `GET /api/tenders/stats` - İstatistikler
- `GET /api/tenders/:id` - İhale detayı
- `DELETE /api/tenders/:id` - İhale silme

### Documents
- `POST /api/documents/upload` - Döküman yükle + analiz
- `GET /api/documents` - Döküman listesi
- `GET /api/documents/:id` - Döküman detayı
- `DELETE /api/documents/:id` - Döküman silme

### Health
- `GET /health` - System health check

## 🤖 AI Özellikleri

### Gemini AI Kullanımı

1. **OCR** - PDF/Word/Excel'den metin çıkarma
2. **Döküman Analizi** - İhale bilgilerini çıkarma
3. **Şehir Normalizasyonu** - Şehir isimlerini temizleme

### Örnek Analiz Sonucu

```json
{
  "title": "Hazır Yemek Hizmeti Alınacaktır",
  "organization": "Ankara Belediyesi",
  "city": "Ankara",
  "tender_date": "2025-12-15",
  "estimated_cost": "1250000",
  "technical_specs": ["Günlük 500 porsiyon", "HACCP belgesi gerekli"],
  "contact": {
    "phone": "0312 123 45 67",
    "email": "ihale@ankara.gov.tr"
  }
}
```

## 🔐 Güvenlik

- ✅ JWT token authentication
- ✅ Password hashing (bcrypt)
- ✅ SQL injection koruması (parameterized queries)
- ✅ CORS yapılandırması
- ✅ File upload validation

## 📊 Database Schema

### Tenders (İhaleler)
- `external_id` - İhalebul.com ID (unique)
- `title` - İhale başlığı
- `tender_date` - İhale tarihi
- `city` - Şehir (AI ile temizlenmiş)
- `organization_name` - Kurum adı
- `estimated_cost` - Tahmini bedel
- `url` - Detay sayfası URL

### Documents (Dökümanlar)
- `tender_id` - İlişkili ihale
- `filename` - Dosya adı
- `file_type` - Dosya tipi
- `extracted_text` - Çıkarılan metin
- `analysis_result` - AI analiz sonucu (JSON)

## 🚨 Troubleshooting

### Database bağlantı hatası
```bash
# PostgreSQL çalışıyor mu kontrol et
docker-compose ps

# Logs kontrol et
docker-compose logs postgres
```

### Scraper login hatası
```bash
# Credentials kontrol et
echo $IHALEBUL_USERNAME
echo $IHALEBUL_PASSWORD

# Session temizle
rm backend/storage/session.json
```

### AI analiz hatası
```bash
# Gemini API key kontrol et
echo $GEMINI_API_KEY

# API quota kontrol et
# https://aistudio.google.com/app/apikey
```

## 📝 License

MIT

## 👨‍💻 Geliştirici

Catering Pro Team
