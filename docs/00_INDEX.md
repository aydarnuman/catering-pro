# 📚 Catering Pro - Teknik Dokümantasyon İndeksi

> Son Güncelleme: 27 Ocak 2026  
> Versiyon: 2.0

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
| 06 | [DEPLOYMENT.md](./DEPLOYMENT.md) | Deployment kılavuzu (mevcut) | ✅ |

---

## 🎯 Hızlı Referans

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

| Metrik | Sayı |
|--------|------|
| Frontend Modül | 12 |
| Frontend Bileşen | 35+ |
| Backend Route | 52 |
| Backend Service | 35+ |
| DB Migration | 93 |
| DB Tablo | ~50+ |
| Custom Hook | 7 |
| Context | 2 |

---

## 🔗 İlgili Dökümanlar

- [CURSOR-PROMPTS.md](../CURSOR-PROMPTS.md) - Cursor talimatları
- [README-DEV.md](../README-DEV.md) - Geliştirici kılavuzu
- [REALTIME_SETUP.md](../REALTIME_SETUP.md) - Realtime kurulumu

---

*Bu indeks otomatik olarak oluşturulmuştur.*
