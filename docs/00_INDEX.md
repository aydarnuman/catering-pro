# Catering Pro - Teknik Dokumantasyon Indeksi

> Son Guncelleme: 13 Subat 2026  
> Versiyon: 4.2

---

## Dokümantasyon Haritası

| # | Döküman | Açıklama | Durum |
|---|---------|----------|-------|
| 00 | [INDEX.md](./00_INDEX.md) | Bu dosya - İndeks | Aktif |
| 01 | [DATABASE_SCHEMA.md](./01_DATABASE_SCHEMA.md) | Veritabanı şeması ve ilişkiler | Aktif |
| 02 | [API_ENDPOINTS.md](./02_API_ENDPOINTS.md) | Tüm backend API endpoint'leri | Aktif |
| 03 | [FRONTEND_MODULES.md](./03_FRONTEND_MODULES.md) | Frontend modül yapısı | Aktif |
| 04 | [COMPONENT_REGISTRY.md](./04_COMPONENT_REGISTRY.md) | Bileşen kayıt defteri | Aktif |
| 05 | [ARCHITECTURE.md](./ARCHITECTURE.md) | Genel sistem mimarisi | Aktif |
| 06 | [DEPLOYMENT.md](./DEPLOYMENT.md) | Deployment kılavuzu | Aktif |
| 07 | [DIGITALOCEAN.md](./DIGITALOCEAN.md) | Sunucu yönetimi | Aktif |
| 08 | [05_MUHASEBE_FINANSAL_MODULLER.md](./05_MUHASEBE_FINANSAL_MODULLER.md) | Muhasebe, Fatura & Finansal Modüller (126 dosya analizi) | Aktif |

---

## Teknik Dokümanlar

| Döküman | Açıklama |
|---------|----------|
| [AI_CHAT_AGENT.md](./AI_CHAT_AGENT.md) | AI Chat, Agent & Tools dokumantasyonu |
| [AI_PIPELINE.md](./AI_PIPELINE.md) | AI Pipeline (Unified + Zero-Loss) dokumantasyonu |
| [AZURE_TRAINING.md](./AZURE_TRAINING.md) | Azure Model egitimi & training pipeline |
| [AZURE_DOCUMENT_AI_SETUP.md](./AZURE_DOCUMENT_AI_SETUP.md) | Azure Document AI kurulumu |
| [piyasa-fiyat-sistemi.md](./piyasa-fiyat-sistemi.md) | Piyasa fiyat sistemi (3 katmanli veri toplama) |
| [REALTIME_SETUP.md](./REALTIME_SETUP.md) | Supabase Realtime kurulumu |
| [supabase-setup.md](./supabase-setup.md) | Supabase DB kurulumu (Auth bölümü geçersiz) |
| [yuklenici-kutuphanesi-diagram.md](./yuklenici-kutuphanesi-diagram.md) | Yüklenici kütüphanesi frontend diagramı |

---

## Backend Dokümanları

| Döküman | Açıklama |
|---------|----------|
| [00-SYSTEM-ARCHITECTURE.md](../backend/docs/00-SYSTEM-ARCHITECTURE.md) | Backend genel mimari |
| [01-LISTE-SCRAPER.md](../backend/docs/01-LISTE-SCRAPER.md) | Liste scraper dokümantasyonu |
| [02-SESSION-COOKIE.md](../backend/docs/02-SESSION-COOKIE.md) | Session yönetimi |
| [03-DOCUMENT-SCRAPER.md](../backend/docs/03-DOCUMENT-SCRAPER.md) | Doküman scraper |
| [04-API-ROUTES.md](../backend/docs/04-API-ROUTES.md) | API route yapısı |
| [05-DOCUMENT-PIPELINE.md](../backend/docs/05-DOCUMENT-PIPELINE.md) | Döküman analiz pipeline'ı v9.0 (kanonik referans) |
| [06-YUKLENICI-ISTIHBARAT.md](../backend/docs/06-YUKLENICI-ISTIHBARAT.md) | Yüklenici istihbarat modülü |

---

## Hızlı Referans

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
├── backend/           # Express.js API (ES Modules)
│   ├── src/routes/    # API endpoint'leri
│   ├── src/services/  # İş mantığı servisleri
│   ├── src/middleware/ # Auth, CSRF, Rate Limit
│   └── src/scraper/   # İhale scraper
│
├── docs/              # Bu klasör
└── supabase/          # Migration dosyaları
```

### Tech Stack
| Katman | Teknoloji | Port |
|--------|-----------|------|
| Frontend | Next.js 15, Mantine UI 7.17, React Query | :3000 |
| Backend | Express.js, ES Modules | :3001 |
| Database | PostgreSQL (Supabase hosted) | - |
| Auth | Custom JWT + bcrypt + HttpOnly Cookie (Supabase Auth KULLANILMIYOR) | - |
| AI | Claude API, Azure Document AI | - |

---

*Son guncelleme: 7 Subat 2026*
