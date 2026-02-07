# Catering Pro - Kurumsal Is Yonetim Sistemi

Hazir yemek sektoru icin kapsamli ERP-benzeri kurumsal is yonetim sistemi. Ihale takibi, muhasebe, IK/bordro, stok, menu planlama ve AI asistan modullerini icerir.

**Son Guncelleme:** Subat 2026

---

## Ozellikler

### Ihale Yonetimi
- **Ihale Scraping** - ihalebul.com otomasyonu (Puppeteer)
- **Dokuman Isleme** - PDF/Word/Excel/CSV + AI analiz
- **AI Dokuman Analizi** - Azure Document AI + Claude
- **Ihale Takip Listesi** - Durum, notlar, hatirlaticilar
- **Teklif Hazirlama** - Teklif olusturma ve maliyet hesaplama
- **Ihale Sonuclari** - Kazanilan/kaybedilen takibi
- **Dilekce Yonetimi** - Ihale dilekcesi sablonlari

### Muhasebe Modulu
- **Cari Hesaplar** - Musteri/tedarikci yonetimi, bakiye takibi
- **Fatura Yonetimi** - Alis/satis faturalari, odeme takibi
- **Fatura Kalemleri** - Detayli kalem eslestirme ve analiz
- **Kasa-Banka** - Nakit hesaplari, hareketler, transferler
- **Gelir-Gider** - Finansal takip ve raporlama
- **Cek/Senet** - Cek ve senet takibi
- **Mutabakat** - Cari mutabakat raporlari
- **Uyumsoft Entegrasyonu** - Otomatik fatura sync

### Insan Kaynaklari
- **Personel Yonetimi** - Calisan kayitlari, proje atamalari
- **Bordro Sistemi** - Net->Brut hesaplama, SGK, Gelir Vergisi, AGI
- **Izin Yonetimi** - Izin talep ve onay surecleri
- **Tazminat Hesaplama** - Kidem/ihbar tazminati
- **Maas Odeme** - Odeme takibi ve raporlama

### Stok Yonetimi
- **Depo Yonetimi** - Coklu depo, lokasyon bazli
- **Stok Kartlari** - Urun/malzeme kartlari
- **Urun Varyantlari** - Varyant ve birim yonetimi
- **Birim Donusum** - Otomatik birim cevirme matrisi
- **Stok Hareketleri** - Giris/cikis/transfer/fire
- **Kritik Stok** - Minimum stok uyarilari
- **Demirbas Takibi** - Amortisman hesaplama

### Uretim Planlama
- **Recete Yonetimi** - Yemek receteleri, maliyetlendirme
- **Menu Planlama** - Gunluk/haftalik menuler
- **Gramaj Sartnameleri** - Sartname uyumu kontrolu
- **Malzeme Ihtiyac** - Otomatik malzeme hesaplama
- **Maliyet Analizi** - Detayli maliyet raporlama

### Firma Yonetimi
- **Firma Kartlari** - Musteri/tedarikci firma bilgileri
- **Tedarikci-Urun Mapping** - Tedarikci bazli fiyatlama
- **Belge Yonetimi** - Firma dokumanlari

### AI Asistan
- **Claude AI Chat** - Streaming sohbet
- **Tool Calling** - Sistem entegrasyonu
- **Dokuman Analizi** - Azure Document AI + Claude
- **Konusma Hafizasi** - Baglamsal cevaplar
- **Prompt Builder** - Ozel AI sablon olusturucu
- **Fatura AI** - Otomatik fatura analizi

### Sosyal Medya
- **WhatsApp Entegrasyonu** - WebSocket destekli mesajlasma
- **Instagram AI** - Sosyal medya veri analizi

### Sistem
- **Bildirim Sistemi** - Real-time bildirimler (Supabase)
- **Global Arama** - Tum modullerde arama
- **Export/Import** - Excel/PDF disa aktarma
- **Audit Logs** - Detayli islem gunlukleri
- **Yetki Yonetimi** - Rol bazli erisim kontrolu
- **IP Erisim Kontrolu** - Admin IP kisitlamalari

---

## Proje Yapisi

```
CATERING/
├── backend/                     # Node.js + Express API (ES Modules)
│   └── src/
│       ├── routes/              # API endpoints (52 dosya)
│       ├── services/            # Business logic (34 dosya)
│       │   └── ai-tools/        # AI arac modulleri (10 dosya)
│       ├── middleware/          # Auth, rate-limit, CSRF
│       ├── scraper/             # ihalebul.com scraper
│       │   └── uyumsoft/        # Uyumsoft API client
│       ├── migrations/          # Legacy SQL migrations (102 dosya)
│       ├── database.js          # PostgreSQL connection (Supabase)
│       ├── supabase.js          # Supabase client
│       └── server.js            # Express entry point
│
├── frontend/                    # Next.js 15 + React 18 + TypeScript
│   └── src/
│       ├── app/                 # App Router pages
│       │   ├── tenders/         # Ihale modulu
│       │   ├── tracking/        # Ihale takip
│       │   ├── ai-chat/         # AI sohbet sayfasi + history
│       │   ├── planlama/        # Uretim planlama
│       │   ├── muhasebe/        # Muhasebe modulu
│       │   │   ├── cariler/     # Cari hesaplar
│       │   │   ├── faturalar/   # Fatura yonetimi
│       │   │   ├── stok/        # Stok kartlari
│       │   │   ├── personel/    # Personel/HR
│       │   │   ├── menu-planlama/ # Menu planlama
│       │   │   └── raporlar/    # Finansal raporlar
│       │   ├── admin/           # Admin paneli
│       │   ├── ayarlar/         # Sistem ayarlari
│       │   ├── sosyal-medya/    # WhatsApp + Instagram
│       │   └── profil/          # Kullanici profili
│       ├── components/          # UI components (~80+ dosya)
│       ├── context/             # AuthContext, RealtimeContext
│       ├── hooks/               # Custom hooks
│       └── lib/                 # Utilities + API services
│           ├── api/services/    # Moduler API katmani
│           └── supabase/        # Supabase client config
│
├── supabase/                    # Supabase migrations
│   └── migrations/              # SQL migrations (102 dosya)
│
├── services/                    # Harici servisler
│   ├── whatsapp/                # WhatsApp entegrasyonu (Node.js)
│   └── instagram/               # Instagram entegrasyonu (Python)
│
├── docs/                        # Dokumantasyon
│   ├── 00_INDEX.md              # Dokuman indeksi
│   ├── 01_DATABASE_SCHEMA.md    # Veritabani semasi
│   ├── 02_API_ENDPOINTS.md      # API detaylari
│   ├── 03_FRONTEND_MODULES.md   # Frontend modulleri
│   ├── 04_COMPONENT_REGISTRY.md # Component listesi
│   ├── ARCHITECTURE.md          # Sistem mimarisi
│   ├── DEPLOYMENT.md            # Production deploy
│   └── DIGITALOCEAN.md          # Server konfigurasyonu
│
├── uploads/                     # Yuklenen dosyalar
├── scripts/                     # Deploy & utility scripts
├── ecosystem.config.js          # PM2 production config
├── docker-compose.yml           # Container orchestration
├── service.sh                   # Servis yonetim scripti
└── start-all.sh                 # Toplu baslatma scripti
```

---

## Teknoloji Yigini

### Backend

| Teknoloji | Versiyon | Aciklama |
|-----------|----------|----------|
| Node.js | ES Modules | Runtime |
| Express.js | ^4.18.2 | Web framework |
| PostgreSQL | 16 | Veritabani (Supabase hosted) |
| Supabase | ^2.89.0 | Database + Auth + Realtime |
| JWT + bcrypt | ^9.0.2 | Authentication |
| Puppeteer | ^22.15.0 | Web scraping |
| Winston | ^3.11.0 | Logging |
| Helmet | ^8.1.0 | Security headers |
| Sharp | ^0.34.5 | Image processing |
| Multer | ^1.4.5 | File upload |
| node-cron | ^4.2.1 | Scheduled tasks |
| Biome | ^2.3.10 | Linter & Formatter |

### Frontend

| Teknoloji | Versiyon | Aciklama |
|-----------|----------|----------|
| Next.js | ^15.5.7 | React framework (App Router) |
| React | ^18.3.1 | UI Library |
| TypeScript | ^5 | Type safety |
| Mantine UI | ^7.17.0 | Component library |
| TanStack Query | ^5.17.0 | Server state management |
| SWR | ^2.3.7 | Data fetching |
| Socket.io | ^4.8.3 | Real-time communication |
| Recharts | ^2.15.4 | Grafikler |
| Leaflet | ^1.9.4 | Harita entegrasyonu |
| DnD-Kit | ^6.3.1 | Drag & Drop |
| Axios | ^1.13.2 | HTTP client |
| Biome | ^2.3.10 | Linter & Formatter |

### AI Servisleri

| Teknoloji | Versiyon | Aciklama |
|-----------|----------|----------|
| Claude AI | ^0.71.2 | Chat, analiz & tool calling |
| Azure Document AI | @azure/ai-form-recognizer | Dokuman analizi & OCR |

### Deployment

| Teknoloji | Aciklama |
|-----------|----------|
| DigitalOcean | Droplet (Ubuntu 22.04) |
| Cloudflare | DNS, CDN, SSL |
| PM2 | Process manager |
| Nginx | Reverse proxy |
| Supabase | Database & Auth hosting |
| Docker | Container orchestration |

---

## Kurulum

### 1. Repository'yi Klonla

```bash
git clone https://github.com/your-repo/catering.git
cd catering
```

### 2. Environment Dosyalari

**Backend (`backend/.env`):**

```env
# =============================================================================
# DATABASE (Zorunlu)
# =============================================================================
# Supabase Connection String
# Format: postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:5432/postgres
DATABASE_URL=postgresql://postgres:PASSWORD@localhost:5432/catering_db

# Supabase Credentials
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-supabase-service-key

# =============================================================================
# AUTHENTICATION (Zorunlu)
# =============================================================================
JWT_SECRET=your-jwt-secret-minimum-32-characters
JWT_EXPIRES_IN=7d

# =============================================================================
# AI SERVISLERI (Opsiyonel - AI ozellikleri icin)
# =============================================================================
# Claude AI (AI Asistan)
CLAUDE_API_KEY=sk-ant-...

# Azure Document AI (Dokuman analizi)
AZURE_DOCUMENT_AI_ENDPOINT=https://your-resource.cognitiveservices.azure.com/
AZURE_DOCUMENT_AI_KEY=your-azure-key

# =============================================================================
# SCRAPER (Opsiyonel - Ihale scraping icin)
# =============================================================================
IHALEBUL_USERNAME=your_username
IHALEBUL_PASSWORD=your_password

# =============================================================================
# UYUMSOFT ENTEGRASYONU (Opsiyonel - Fatura sync)
# =============================================================================
UYUMSOFT_API_URL=https://efatura.uyumsoft.com.tr/api
UYUMSOFT_USERNAME=your_username
UYUMSOFT_PASSWORD=your_password

# =============================================================================
# SERVER AYARLARI
# =============================================================================
NODE_ENV=development
PORT=3001
```

**Frontend (`frontend/.env.local`):**

```env
# Supabase (Public keys - guvenli)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# API URL (Opsiyonel - varsayilan localhost:3001)
NEXT_PUBLIC_API_URL=http://localhost:3001
```

> **Not:** Auth sistemi Custom AuthContext + JWT kullanmaktadir.

### 3. Bagimliliklari Yukle

```bash
# Backend
cd backend && npm install

# Frontend
cd ../frontend && npm install

# (Opsiyonel) WhatsApp servisi
cd ../services/whatsapp && npm install
```

### 4. Database Migration

```bash
# Supabase CLI ile (onerilen)
cd ..
supabase db push

# veya migration status kontrolu
supabase migration list
```

### 5. Uygulamayi Baslat

```bash
# Tek komutla tum servisleri baslat
./service.sh start

# Veya manuel (ayri terminallerde)
cd backend && npm run dev    # :3001
cd frontend && npm run dev   # :3000
```

---

## Servis Yonetimi

Tum servis islemleri icin `service.sh` script'ini kullanin:

```bash
./service.sh start      # Tum servisleri baslat
./service.sh stop       # Tum servisleri durdur
./service.sh restart    # Yeniden baslat
./service.sh status     # Durum kontrolu
./service.sh logs       # Canli log takibi
./service.sh clean      # Cache ve eski loglari temizle
./service.sh backend    # Sadece backend yeniden baslat
./service.sh frontend   # Sadece frontend yeniden baslat
```

### Docker ile Calistirma (Opsiyonel)

```bash
# Tum servisleri baslat
docker-compose up -d

# Loglari izle
docker-compose logs -f

# Servisleri durdur
docker-compose down
```

### Servis URL'leri

| Servis | URL | Aciklama |
|--------|-----|----------|
| Frontend | http://localhost:3000 | Next.js UI |
| Backend API | http://localhost:3001 | Express API |
| API Docs | http://localhost:3001/api-docs | Swagger UI |
| WhatsApp | http://localhost:3002 | WhatsApp servisi |
| Instagram | http://localhost:3003 | Instagram servisi |

---

## API Endpoints

### Ana Moduller

| Modul | Endpoint | Aciklama |
|-------|----------|----------|
| Auth | `/api/auth/*` | Login, register, profil |
| Tenders | `/api/tenders/*` | Ihale CRUD |
| Tracking | `/api/tender-tracking/*` | Takip listesi |
| Documents | `/api/documents/*` | Dokuman upload/analiz |
| Scraper | `/api/scraper/*` | ihalebul.com scraper |

### Muhasebe

| Modul | Endpoint | Aciklama |
|-------|----------|----------|
| Cariler | `/api/cariler/*` | Cari hesaplar |
| Invoices | `/api/invoices/*` | Faturalar |
| Fatura Kalemleri | `/api/fatura-kalemler/*` | Fatura kalem yonetimi |
| Stok | `/api/stok/*` | Stok yonetimi |
| Urunler | `/api/urunler/*` | Urun kartlari |
| Mutabakat | `/api/mutabakat/*` | Cari mutabakat |
| Uyumsoft | `/api/uyumsoft/*` | Fatura sync |

### IK/Bordro

| Modul | Endpoint | Aciklama |
|-------|----------|----------|
| Personel | `/api/personel/*` | Personel/HR |
| Bordro | `/api/bordro/*` | Bordro hesaplama |
| Maas Odeme | `/api/maas-odeme/*` | Maas odemeleri |
| Izin | `/api/izin/*` | Izin yonetimi |

### Diger

| Modul | Endpoint | Aciklama |
|-------|----------|----------|
| AI | `/api/ai/*` | AI asistan |
| AI Memory | `/api/ai-memory/*` | Konusma hafizasi |
| Firmalar | `/api/firmalar/*` | Firma kartlari |
| Menu Planlama | `/api/menu-planlama/*` | Menu yonetimi |
| Maliyet | `/api/maliyet-analizi/*` | Maliyet raporlari |
| Notifications | `/api/notifications/*` | Bildirimler |
| Export | `/api/export/*` | Veri disa aktarma |
| Search | `/api/search/*` | Global arama |
| System | `/api/system/*` | Sistem yonetimi |
| Audit Logs | `/api/audit-logs/*` | Islem gunlukleri |

### Swagger Dokumantasyonu

```
http://localhost:3001/api-docs
```

---

## AI Ozellikleri

### Claude AI Asistan

- Streaming chat responses
- Tool-based agent system
- Sistem verileriyle entegrasyon
- Konusma hafizasi (memory)

```typescript
// AI'dan ihale analizi iste
"Son eklenen 5 ihaleyi analiz et ve hangisine basvurmaliyiz?"

// Cari bakiye sorgu
"Ankara'daki musterilerin toplam bakiyesi nedir?"

// Bordro hesaplama
"5000 TL net maas icin brut ne olur?"
```

### Azure Document AI + Claude Dokuman Analizi

- PDF/Word/Excel OCR (Azure Document Intelligence)
- Yapilandirilmis veri cikarma (Custom Model + Claude Semantic)
- Gramaj tablosu analizi
- Sartname parsing

### Prompt Builder

- Ozel AI sablon olusturma
- Kategori bazli promptlar
- Kayitli sablonlar

---

## Troubleshooting

### Database Baglanti Hatasi

```bash
# Supabase connection test
psql $DATABASE_URL -c "SELECT 1"

# Pool durumu kontrolu
curl http://localhost:3001/api/database-stats
```

### Scraper Hatasi

```bash
# Session temizle
rm backend/storage/session.json

# Basarisiz dokumanlari temizle (API)
curl -X POST http://localhost:3001/api/scraper/cleanup-documents

# Tek ihale icin temizlik
curl -X POST http://localhost:3001/api/scraper/cleanup-tender/97
```

### API Baglanti Hatasi

```bash
# Health check
curl http://localhost:3001/health

# Detayli sistem durumu
curl http://localhost:3001/api/system/status
```

### Frontend Build Hatasi

```bash
# Type check
cd frontend && npm run type-check

# Lint kontrolu
npm run lint

# Cache temizle
rm -rf .next && npm run build
```

---

## Scripts

### Backend

```bash
npm run dev          # Development mode (--watch)
npm run start        # Production mode
npm run lint         # Biome lint check
npm run lint:fix     # Biome auto-fix
npm run test         # Jest tests
npm run scraper      # Manuel scraper calistir
```

### Frontend

```bash
npm run dev          # Development server
npm run build        # Production build
npm run start        # Production server
npm run lint         # Biome lint check
npm run type-check   # TypeScript check
```

### Database

```bash
# Supabase CLI komutlari (proje kokunden)
supabase migration list     # Migration durumu
supabase migration new      # Yeni migration olustur
supabase db push           # Migrationlari uygula
supabase db reset          # Database sifirla
supabase db diff           # Schema farklari
```

---

## Production Deployment

### PM2 ile

```bash
# Baslat
pm2 start ecosystem.config.js

# Durum
pm2 status

# Loglar
pm2 logs

# Restart
pm2 restart all

# Stop
pm2 stop all
```

### Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## Detayli Dokumantasyon

- [Dokuman Indeksi](docs/00_INDEX.md) - Tum dokumanlar
- [Database Schema](docs/01_DATABASE_SCHEMA.md) - Veritabani yapisi
- [API Endpoints](docs/02_API_ENDPOINTS.md) - API detaylari
- [Frontend Modules](docs/03_FRONTEND_MODULES.md) - UI modulleri
- [Component Registry](docs/04_COMPONENT_REGISTRY.md) - Component listesi
- [Architecture](docs/ARCHITECTURE.md) - Sistem mimarisi
- [Deployment](docs/DEPLOYMENT.md) - Production deploy
- [DigitalOcean](docs/DIGITALOCEAN.md) - Server konfigurasyonu
---

## License

MIT

## Gelistirici

Catering Pro Team - 2026
