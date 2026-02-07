# Catering Pro - Teknik Dokumantasyon Indeksi

> Son Guncelleme: 6 Subat 2026  
> Versiyon: 4.0

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

---

## Teknik Dokümanlar

| Döküman | Açıklama |
|---------|----------|
| [UNIFIED_PIPELINE_v9.md](./UNIFIED_PIPELINE_v9.md) | Aktif doküman analiz pipeline'ı |
| [AZURE_DOCUMENT_AI_SETUP.md](./AZURE_DOCUMENT_AI_SETUP.md) | Azure Document AI kurulumu |
| [SCRAPER_ENTEGRASYON_TALIMATI.md](./SCRAPER_ENTEGRASYON_TALIMATI.md) | İhale scraper sistemi |
| [REALTIME_SETUP.md](./REALTIME_SETUP.md) | Supabase Realtime kurulumu |
| [supabase-setup.md](./supabase-setup.md) | Supabase genel kurulum |

---

## Backend Dokümanları

| Döküman | Açıklama |
|---------|----------|
| [00-SYSTEM-ARCHITECTURE.md](../backend/docs/00-SYSTEM-ARCHITECTURE.md) | Backend genel mimari |
| [01-LISTE-SCRAPER.md](../backend/docs/01-LISTE-SCRAPER.md) | Liste scraper dokümantasyonu |
| [02-SESSION-COOKIE.md](../backend/docs/02-SESSION-COOKIE.md) | Session yönetimi |
| [03-DOCUMENT-SCRAPER.md](../backend/docs/03-DOCUMENT-SCRAPER.md) | Doküman scraper |
| [04-API-ROUTES.md](../backend/docs/04-API-ROUTES.md) | API route yapısı |
| [05-DOCUMENT-PIPELINE.md](../backend/docs/05-DOCUMENT-PIPELINE.md) | Doküman işleme pipeline'ı |
| [ai-analyzer-diagram.md](../backend/docs/ai-analyzer-diagram.md) | AI analiz akış diyagramı |

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
| Database | PostgreSQL (Supabase) | - |
| AI | Claude API, Azure Document AI | - |

---

*Son guncelleme: 6 Subat 2026*
