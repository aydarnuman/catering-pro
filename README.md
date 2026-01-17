# 🍽️ Catering Pro - Kurumsal İş Yönetim Sistemi

Hazır yemek sektörü için kapsamlı ERP-benzeri kurumsal iş yönetim sistemi. İhale takibi, muhasebe, İK/bordro, stok ve menü planlama modüllerini içerir.

**Son Güncelleme:** Ocak 2026

---

## 🚀 Özellikler

### 📋 İhale Yönetimi
- ✅ **İhale Scraping** - ihalebul.com otomasyonu (Puppeteer)
- ✅ **Döküman İşleme** - PDF/Word/Excel/CSV + AI analiz
- ✅ **AI Döküman Analizi** - Claude AI ile detaylı analiz
- ✅ **İhale Takip Listesi** - Durum, notlar, hatırlatıcılar
- ✅ **Teklif Hazırlama** - Teklif oluşturma ve takip

### 💰 Muhasebe Modülü
- ✅ **Cari Hesaplar** - Müşteri/tedarikçi yönetimi, bakiye takibi
- ✅ **Fatura Yönetimi** - Alış/satış faturaları, ödeme takibi
- ✅ **Kasa-Banka** - Nakit hesapları, hareketler, transferler
- ✅ **Gelir-Gider** - Finansal takip ve raporlama
- ✅ **Çek/Senet** - Çek ve senet takibi

### 👨‍💼 İnsan Kaynakları
- ✅ **Personel Yönetimi** - Çalışan kayıtları, proje atamaları
- ✅ **Bordro Sistemi** - Net→Brüt hesaplama, SGK, Gelir Vergisi, AGİ
- ✅ **İzin Yönetimi** - İzin talep ve onay süreçleri
- ✅ **Tazminat Hesaplama** - Kıdem/ihbar tazminatı
- ✅ **Maaş Ödeme** - Ödeme takibi

### 📦 Stok Yönetimi
- ✅ **Depo Yönetimi** - Çoklu depo, lokasyon bazlı
- ✅ **Stok Kartları** - Ürün/malzeme kartları
- ✅ **Stok Hareketleri** - Giriş/çıkış/transfer/fire
- ✅ **Kritik Stok** - Minimum stok uyarıları
- ✅ **Demirbaş Takibi** - Amortisman hesaplama

### 🍽️ Üretim Planlama
- ✅ **Reçete Yönetimi** - Yemek reçeteleri, maliyetlendirme
- ✅ **Menü Planlama** - Günlük/haftalık menüler
- ✅ **Gramaj Şartnameleri** - Şartname uyumu kontrolü
- ✅ **Malzeme İhtiyaç** - Otomatik malzeme hesaplama

### 🤖 AI Asistan
- ✅ **Claude AI Chat** - Streaming sohbet
- ✅ **Tool Calling** - Sistem entegrasyonu
- ✅ **Döküman Analizi** - Gemini Vision + Claude
- ✅ **Konuşma Hafızası** - Bağlamsal cevaplar

### 🔔 Sistem
- ✅ **Bildirim Sistemi** - Real-time bildirimler
- ✅ **Global Arama** - Tüm modüllerde arama
- ✅ **Export/Import** - Excel/PDF dışa aktarma
- ✅ **Uyumsoft Entegrasyonu** - Muhasebe sync

---

## 📁 Proje Yapısı

```
CATERİNG/
├── backend/                  # Node.js + Express API
│   └── src/
│       ├── routes/           # API endpoints (39 dosya)
│       ├── services/         # Business logic (33+ dosya)
│       │   └── ai-tools/     # AI araç modülleri
│       ├── migrations/       # SQL migrations (54 dosya)
│       ├── scraper/          # ihalebul.com scraper
│       ├── database.js       # PostgreSQL connection
│       └── server.js         # Express entry point
│
├── frontend/                 # Next.js 14 + React
│   └── src/
│       ├── app/              # App Router pages
│       │   ├── tenders/      # İhale modülü
│       │   ├── muhasebe/     # Muhasebe modülü
│       │   ├── planlama/     # Üretim planlama
│       │   └── ai-chat/      # AI asistan
│       ├── components/       # UI components
│       ├── context/          # React context
│       ├── hooks/            # Custom hooks
│       └── lib/              # Utilities
│
├── docs/                     # Dokümantasyon
│   ├── ARCHITECTURE.md
│   ├── DEPLOYMENT.md
│   └── DIGITALOCEAN.md
│
├── uploads/                  # Yüklenen dosyalar
└── scripts/                  # Deploy & utility scripts
```

---

## 🛠️ Teknoloji Yığını

### Backend
| Teknoloji | Açıklama |
|-----------|----------|
| Node.js | Runtime |
| Express.js | Web framework |
| PostgreSQL | Veritabanı (Supabase hosted) |
| JWT + bcrypt | Authentication |
| Winston | Logging |
| node-cron | Scheduled tasks |

### Frontend
| Teknoloji | Açıklama |
|-----------|----------|
| Next.js 14 | React framework (App Router) |
| Mantine UI | Component library |
| Tailwind CSS | Styling |
| Recharts | Grafikler |
| SWR | Data fetching |

### AI
| Teknoloji | Açıklama |
|-----------|----------|
| Claude AI | Chat & analiz (@anthropic-ai/sdk) |
| Gemini AI | Döküman OCR & analiz |

### Deployment
| Teknoloji | Açıklama |
|-----------|----------|
| DigitalOcean | Droplet (Ubuntu 22.04) |
| Cloudflare | DNS, CDN, SSL |
| PM2 | Process manager |
| Nginx | Reverse proxy |
| Supabase | Database hosting |

---

## 🚀 Kurulum

### 1. Repository'yi Klonla

```bash
git clone https://github.com/your-repo/catering.git
cd catering
```

### 2. Environment Dosyaları

**Backend (.env):**
```env
# Database (Supabase)
DATABASE_URL=postgresql://user:pass@host:5432/db

# AI Keys
GEMINI_API_KEY=your-gemini-key
ANTHROPIC_API_KEY=your-claude-key

# Scraper
IHALEBUL_USERNAME=username
IHALEBUL_PASSWORD=password

# Auth
JWT_SECRET=your-jwt-secret

# Server
PORT=3001
NODE_ENV=development
```

**Frontend (.env.local):**
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret
```

### 3. Bağımlılıkları Yükle

```bash
# Backend
cd backend && npm install

# Frontend
cd ../frontend && npm install
```

### 4. Database Migration

```bash
cd backend
npm run migrate
```

### 5. Uygulamayı Başlat

```bash
# Development (ayrı terminallerde)
cd backend && npm run dev    # :3001
cd frontend && npm run dev   # :3000

# Veya tek komutla
./start-dev.sh
```

---

## 📡 API Endpoints

### Ana Modüller

| Modül | Endpoint | Açıklama |
|-------|----------|----------|
| Auth | `/api/auth/*` | Login, register, profil |
| Tenders | `/api/tenders/*` | İhale CRUD |
| Tracking | `/api/tender-tracking/*` | Takip listesi |
| Documents | `/api/documents/*` | Döküman upload/analiz |
| Cariler | `/api/cariler/*` | Cari hesaplar |
| Invoices | `/api/invoices/*` | Faturalar |
| Stok | `/api/stok/*` | Stok yönetimi |
| Personel | `/api/personel/*` | Personel/HR |
| Bordro | `/api/bordro/*` | Bordro hesaplama |
| Planlama | `/api/planlama/*` | Menü planlama |
| AI | `/api/ai/*` | AI asistan |

### Swagger Dokümantasyonu

```
http://localhost:3001/api-docs
```

---

## 🤖 AI Özellikleri

### Claude AI Asistan
- Streaming chat responses
- Tool-based agent system
- Sistem verileriyle entegrasyon

```typescript
// AI'dan ihale analizi iste
"Son eklenen 5 ihaleyi analiz et ve hangisine başvurmalıyız?"

// Cari bakiye sorgu
"Ankara'daki müşterilerin toplam bakiyesi nedir?"

// Bordro hesaplama
"5000 TL net maaş için brüt ne olur?"
```

### Gemini AI Döküman Analizi
- PDF/Word/Excel OCR
- Yapılandırılmış veri çıkarma
- Gramaj tablosu analizi

---

## 🚨 Troubleshooting

### Database Bağlantı Hatası
```bash
# Supabase connection test
psql $DATABASE_URL -c "SELECT 1"
```

### Scraper Hatası
```bash
# Session temizle
rm backend/storage/session.json
```

### API Bağlantı Hatası
```bash
# Health check
curl http://localhost:3001/health
```

---

## 📚 Detaylı Dokümantasyon

- [Architecture](docs/ARCHITECTURE.md) - Sistem mimarisi
- [Deployment](docs/DEPLOYMENT.md) - Production deploy
- [DigitalOcean](docs/DIGITALOCEAN.md) - Server konfigürasyonu
- [Backend Routes](backend/src/routes/README.md) - API detayları
- [Backend Services](backend/src/services/README.md) - Servis detayları
- [Frontend](frontend/README.md) - UI dokümantasyonu

---

## 📝 License

MIT

## 👨‍💻 Geliştirici

Catering Pro Team - 2026
