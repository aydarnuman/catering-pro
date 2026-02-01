# 📚 Catering Pro - Teknik Dokümantasyon İndeksi

> Son Güncelleme: 31 Ocak 2026
> Versiyon: 2.2

---

## 🗂️ Dokümantasyon Haritası

| # | Döküman | Açıklama | Durum |
|---|---------|----------|-------|
| 00 | [INDEX.md](./00_INDEX.md) | Bu dosya - İndeks | ✅ |
| 01 | [DATABASE_SCHEMA.md](./01_DATABASE_SCHEMA.md) | Veritabanı şeması ve ilişkiler | ✅ |
| 02 | [API_ENDPOINTS.md](./02_API_ENDPOINTS.md) | Tüm backend API endpoint'leri | ✅ |
| 03 | [FRONTEND_MODULES.md](./03_FRONTEND_MODULES.md) | Frontend modül yapısı | ✅ |
| 04 | [COMPONENT_REGISTRY.md](./04_COMPONENT_REGISTRY.md) | Bileşen kayıt defteri | ✅ |
| 05 | [ARCHITECTURE.md](./ARCHITECTURE.md) | Genel mimari (mevcut) | ✅ |
| 06 | [SERVICES.md](./SERVICES.md) | Backend servis kataloğu | ✅ |
| 07 | [DEPLOYMENT.md](./DEPLOYMENT.md) | Deployment kılavuzu (mevcut) | ✅ |
| 08 | [INCONSISTENCY-REPORT.md](./INCONSISTENCY-REPORT.md) | Dokümantasyon tutarsızlık raporu | ✅ |
| 09 | [MIMARI_OZET.md](./MIMARI_OZET.md) | Mimari özet (tek sayfa) | ✅ |
| 10 | [analiz/NOTION-EKLEME-PLANI.md](./analiz/NOTION-EKLEME-PLANI.md) | Modeller analiz dökümanları ve Notion ekleme planı | ✅ |
| 11 | [fiyat-yonetimi/README.md](./fiyat-yonetimi/README.md) | **Fiyat Yönetimi Merkezi Mimarisi** | ✅ **YENİ** |

### 🔍 Kapsamlı Analiz Dökümanları (Yeni - 2026-01-31)

| # | Döküman | Açıklama | Durum |
|---|---------|----------|-------|
| A1 | [analiz/01_DATABASE_SCHEMA.md](./analiz/01_DATABASE_SCHEMA.md) | **Kapsamlı Database Schema Referansı** - 110 migration, 60+ tablo detaylı analizi | ✅ **NEW** |
| A2 | [analiz/02_API_ENDPOINTS.md](./analiz/02_API_ENDPOINTS.md) | **Tam API Endpoint Kataloğu** - 220+ endpoint, Türkçe dokümantasyon | ✅ **NEW** |
| A3 | [analiz/03_FRONTEND_ARCHITECTURE.md](./analiz/03_FRONTEND_ARCHITECTURE.md) | **Frontend Mimari Dökümantasyonu** - 69 sayfa, 95 component, hooks, state yönetimi | ✅ **NEW** |
| A4 | [analiz/04_TUTARSIZLIKLAR_VE_ONERILER.md](./analiz/04_TUTARSIZLIKLAR_VE_ONERILER.md) | **Tutarsızlıklar ve Öneriler Raporu** - 45+ sorun, kritiklik analizi, çözüm önerileri | ✅ **NEW** |
| A5 | [analiz/05_NOTION_VS_KOD_KARSILASTIRMA.md](./analiz/05_NOTION_VS_KOD_KARSILASTIRMA.md) | **Notion vs Kod Karşılaştırma** - 127 tutarsızlık, güncelleme planı | ✅ **NEW** |

---

## 🎯 Hızlı Referans

### Ana Dökümantasyon
- **API referansı (tüm endpoint'ler):** [02_API_ENDPOINTS.md](./02_API_ENDPOINTS.md)
- **Veritabanı şeması:** [01_DATABASE_SCHEMA.md](./01_DATABASE_SCHEMA.md)
- **Backend servis kataloğu:** [SERVICES.md](./SERVICES.md)
- **Tutarsızlık raporu (doc vs kod):** [INCONSISTENCY-REPORT.md](./INCONSISTENCY-REPORT.md)

### 💰 Fiyat Yönetimi Sistemi (2026-01-31 - YENİ MİMARİ)
- **📖 Ana Dokümantasyon:** [fiyat-yonetimi/README.md](./fiyat-yonetimi/README.md)
  - Single Source of Truth mimarisi
  - Fiyat öncelik sırası ve güven skorları
  - Veritabanı şeması ve trigger'lar
- **🔌 API Referansı:** [fiyat-yonetimi/API.md](./fiyat-yonetimi/API.md)
  - Dashboard, Ürün, Sözleşme, Toplu İşlem endpoint'leri
  - Request/Response örnekleri
- **🧹 Temizlik Planı:** [fiyat-yonetimi/TEMIZLIK_PLANI.md](./fiyat-yonetimi/TEMIZLIK_PLANI.md)
  - Eski fiyat alanları analizi
  - Kod güncelleme adımları
  - Test ve rollback planları

### 🆕 Kapsamlı Analiz Dökümanları (2026-01-31)
- **📊 Tam Database Schema:** [analiz/01_DATABASE_SCHEMA.md](./analiz/01_DATABASE_SCHEMA.md)
  - 110 Supabase + 106 Backend migrations
  - 60+ tablo detaylı açıklamaları
  - Migration tarihçesi ve modül gruplandırması
  - İsimlendirme tutarsızlıkları analizi

- **🔌 Tam API Endpoint Kataloğu:** [analiz/02_API_ENDPOINTS.md](./analiz/02_API_ENDPOINTS.md)
  - 220+ endpoint tam dokümantasyonu
  - Request/Response örnekleri
  - Auth patterns ve middleware
  - Türkçe açıklamalar

- **⚛️ Frontend Mimari:** [analiz/03_FRONTEND_ARCHITECTURE.md](./analiz/03_FRONTEND_ARCHITECTURE.md)
  - 69 sayfa + 95 component
  - State yönetimi (Context, Hooks)
  - API entegrasyonu (14 service dosyası)
  - Type system ve custom hooks

- **⚠️ Tutarsızlıklar ve Öneriler:** [analiz/04_TUTARSIZLIKLAR_VE_ONERILER.md](./analiz/04_TUTARSIZLIKLAR_VE_ONERILER.md)
  - 45+ tespit edilen sorun
  - Kritiklik seviyeleri (Critical, High, Medium, Low)
  - Detaylı çözüm önerileri
  - Sprint planlaması ve tahmini süreler

- **📝 Notion vs Kod Karşılaştırma:** [analiz/05_NOTION_VS_KOD_KARSILASTIRMA.md](./analiz/05_NOTION_VS_KOD_KARSILASTIRMA.md)
  - 127 tutarsızlık tespit edildi
  - Migration sayısı: 93 → 216 (110 Supabase + 106 Backend)
  - Frontend sayfa: 35 → 69
  - Tablo sayısı: 50 → 60+
  - Detaylı güncelleme planı (5 Sprint)

### Proje Yapısı
```
CATERİNG/
├── frontend/          # Next.js 15 (App Router)
│   ├── src/app/       # Route'lar ve sayfalar
│   ├── src/components/ # React bileşenleri
│   ├── src/context/   # React context'ler
│   ├── src/hooks/     # Custom hooks
│   └── src/lib/       # Utilities ve API
│
├── backend/           # Express.js (ES Modules)
│   ├── src/routes/    # API endpoint'leri (52 dosya)
│   ├── src/services/  # İş mantığı servisleri (35+ dosya)
│   ├── src/middleware/ # Auth, CSRF, Rate Limit
│   └── src/migrations/ # DB migrations (93 dosya)
│
├── services/          # Harici servisler
│   ├── whatsapp/      # WhatsApp entegrasyonu
│   └── instagram/     # Instagram entegrasyonu
│
├── docs/              # Bu klasör
└── supabase/          # Supabase konfigürasyonu
```

### Kritik Dosyalar ⛔
Bu dosyalara **DOKUNMAYIN** - sistemi bozabilir:

| Dosya | Sebep |
|-------|-------|
| `/frontend/src/context/AuthContext.tsx` | Auth sistemi |
| `/backend/src/database.js` | DB bağlantısı |
| `/backend/src/server.js` | Ana sunucu config |
| `/backend/src/middleware/auth.js` | JWT doğrulama |
| `.env` dosyaları | Environment variables |

### Tech Stack
| Katman | Teknoloji | Port |
|--------|-----------|------|
| Frontend | Next.js 15, Mantine UI 7.17, React Query | :3000 |
| Backend | Express.js, ES Modules | :3001 |
| Database | PostgreSQL (Supabase) | - |
| AI | Claude API, Gemini Vision | - |

---

## 📊 İstatistikler

### Güncellenmiş Proje Metrikleri (2026-01-31)

| Katman | Metrik | Sayı |
|--------|--------|------|
| **Database** | Supabase Migrations | 110 |
| | Backend Migrations | 106 |
| | Toplam Tablo | 60+ |
| | Modül Sayısı | 10+ (İhale, Muhasebe, Personel, Stok, vb.) |
| **Backend** | Route Dosyası | 58 (notes/ subdirectory dahil) |
| | Mounted Routes | 52+ |
| | Service Dosyası | 37 + 10 AI tools = 47 |
| | Middleware | 7 |
| | Utility Files | 5 |
| | Toplam Endpoint | 220+ |
| **Frontend** | Sayfa | 69 .tsx/.ts |
| | Component | 95 .tsx/.ts |
| | API Service | 14 |
| | Custom Hook | 9 |
| | Context Provider | 2 |
| | Type Definition | 5 |
| | Library Files | 28 |
| **Dokümantasyon** | Docs Dosyası | 36+ |
| | Analiz Dökümanı | 4 (yeni) |
| **Scripts** | Script Dosyası | 60+ |
| **TOPLAM PROJE** | Tracked Files | ~736 |

---

## 🔗 İlgili Dökümanlar

- [CURSOR-PROMPTS.md](../CURSOR-PROMPTS.md) - Cursor talimatları
- [README-DEV.md](../README-DEV.md) - Geliştirici kılavuzu
- [REALTIME_SETUP.md](../REALTIME_SETUP.md) - Realtime kurulumu

---

*Bu indeks otomatik olarak oluşturulmuştur.*
