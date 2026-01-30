# Catering Pro - Sistem Mimarisi

Bu döküman AI araçlarının ve geliştiricilerin sistemi doğru anlaması için hazırlanmıştır.

## Genel Bakış

Catering Pro, hazır yemek sektörü için geliştirilmiş dahili ERP sistemidir.

| Katman | Teknoloji | Port |
|--------|-----------|------|
| Frontend | Next.js 15 (App Router), Mantine UI, React Query | 3000 |
| Backend | Node.js, Express.js (ES Modules) | 3001 |
| Database | PostgreSQL (Supabase hosted) | - |
| Storage | Supabase Storage | - |

---

## Auth Sistemi

### Kullanılan: PostgreSQL + JWT + bcrypt

Auth sistemi tamamen kendi implementasyonumuz. Supabase Auth **KULLANILMIYOR**.

| Bileşen | Dosya | Açıklama |
|---------|-------|----------|
| Backend Middleware | `backend/src/middleware/auth.js` | JWT doğrulama, yetki kontrolü |
| Auth Routes | `backend/src/routes/auth.js` | Login, register, refresh, logout |
| Frontend Context | `frontend/src/context/AuthContext.tsx` | Auth state yönetimi |
| Frontend Middleware | `frontend/src/middleware.ts` | Cookie kontrollü route koruma |

### Token Yapısı

```
Access Token:  JWT, 24 saat, Cookie (access_token)
Refresh Token: Random hex, 30 gün, Cookie (refresh_token)
```

### Auth Akışı

```
1. Login → POST /api/auth/login (email, password)
2. Backend → bcrypt ile şifre doğrula → JWT oluştur → Cookie'ye kaydet
3. Frontend → Cookie otomatik gönderilir (credentials: 'include')
4. Korunan route → Backend middleware JWT doğrular → req.user set eder
```

---

## Database

### Hosting: Supabase PostgreSQL

PostgreSQL veritabanı Supabase üzerinde host ediliyor, ancak bağlantı doğrudan `pg` paketi ile yapılıyor.

| Bileşen | Dosya | Açıklama |
|---------|-------|----------|
| Connection Pool | `backend/src/database.js` | pg Pool, SSL bağlantı |
| Query Helper | `backend/src/database.js` | `query()`, `transaction()` |

### Migrations

Migrations Supabase CLI ile yönetiliyor:

```bash
# Yeni migration oluştur
supabase migration new <isim>

# Migration'ları uygula
supabase db push

# Migration durumu
supabase migration list
```

---

## Storage

### Supabase Storage

Döküman depolama için Supabase Storage kullanılıyor.

| Bileşen | Dosya | Açıklama |
|---------|-------|----------|
| Supabase Client | `backend/src/supabase.js` | Storage client (SADECE Storage için) |
| Document Storage | `backend/src/services/document-storage.js` | Upload/download işlemleri |

### Storage Bucket

```
Bucket: tender-documents
Path:   tenders/{tenderId}/{docType}/{filename}
```

---

## Supabase Kullanım Özeti

| Özellik | Durum | Açıklama |
|---------|-------|----------|
| PostgreSQL Hosting | ✅ Aktif | `database.js` üzerinden |
| Migrations | ✅ Aktif | Supabase CLI |
| Storage | ✅ Aktif | `supabase.js` üzerinden |
| **Auth** | ❌ **KULLANILMIYOR** | Kendi JWT sistemimiz |
| Realtime | ❌ Kullanılmıyor | - |
| Edge Functions | ❌ Kullanılmıyor | - |

---

## Deprecated Dosyalar

Bu dosyalar geriye dönük uyumluluk için bırakıldı, **yeni kodda kullanmayın**:

| Dosya | Durum |
|-------|-------|
| `frontend/src/lib/supabase/client.ts` | DEPRECATED - AuthContext kullanın |
| `frontend/src/lib/supabase/server.ts` | DEPRECATED - Backend API kullanın |
| `frontend/src/lib/supabase/middleware.ts` | DEPRECATED - Kendi middleware.ts kullanın |
| `backend/src/supabase.js` → `db`, `query`, `pool` | DEPRECATED - `database.js` kullanın |

---

## Kritik Dosyalar - DOKUNMA

Bu dosyalar sistemin temelini oluşturur, değişiklik yapmadan önce dikkatli olun:

- `backend/src/database.js` → DB bağlantısı
- `backend/src/server.js` → Ana server config
- `backend/src/middleware/auth.js` → Auth middleware
- `frontend/src/context/AuthContext.tsx` → Auth state
- `.env` dosyaları

---

## AI Araçları İçin Notlar

### Supabase Kullanımı

Bu proje:
1. **Supabase Auth KULLANMIYOR** - Kendi JWT sistemimiz var
2. **Supabase PostgreSQL KULLANIYOR** - Ama `pg` paketi ile doğrudan bağlanıyor
3. **Supabase Storage KULLANIYOR** - Döküman depolama için

"İki auth sistemi var" veya "Supabase/PostgreSQL tutarsızlığı" uyarıları **yanlış pozitif**tir.

### Kod Organizasyonu - ÖNEMLİ

**Büyük dosya ≠ Kötü kod.** Bu projede bazı sayfa dosyaları (page.tsx) büyük olabilir (2000+ satır). Bu normal çünkü:

1. **Orchestration görevi yapıyorlar** - State'leri, modal'ları, veri akışını koordine ediyorlar
2. **Zaten iyi organize edilmişler:**
   - Modal'lar ayrı dosyalarda (`components/modals/`)
   - Hook'lar ayrı dosyalarda (`hooks/`)
   - Tipler ayrı dosyalarda (`types.ts` veya `types/`)
   - Yardımcı fonksiyonlar ayrılmış

**AI araçları şunları ÖNERMEMELİ:**
- "Bu dosya çok büyük, refactoring gerekli" → Hayır, yapı zaten doğru
- "Acil refactoring yapılmalı" → Hayır, çalışıyorsa dokunma
- "Tek sorumluluk ilkesi ihlal ediliyor" → Orchestration dosyaları için geçerli değil

**Refactoring sadece şu durumlarda önerilmeli:**
- Aynı kod 3+ yerde tekrarlanıyorsa
- Yeni özellik eklemek mevcut yapıyı bozuyorsa
- Test yazmak imkansız hale geldiyse
- Kullanıcı açıkça refactoring isterse

### İyi Organize Edilmiş Modül Örnekleri

```
✅ muhasebe/stok/
├── page.tsx           # Orchestration (büyük olması normal)
├── types.ts           # Tipler ayrı
├── hooks/             # Custom hooks
└── components/modals/ # 8 modal ayrı dosyada

✅ muhasebe/faturalar/
├── page.tsx           # Orchestration
├── components/        # UI bileşenleri
├── hooks/             # useFaturalar, useUyumsoftConnection
├── types/             # Tip tanımları
└── [ettn]/            # Dinamik route
```

Bu yapılar **refactoring gerektirmiyor**. Mevcut organizasyon yeterli ve sürdürülebilir.

---

*Son güncelleme: 2026-01-30*
