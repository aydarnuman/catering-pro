# Tutarsızlıklar ve Öneriler Raporu - Catering Pro

**Oluşturulma Tarihi:** 2026-01-31
**Analiz Kapsamı:** Database, Backend API, Frontend
**Tespit Edilen Sorun Sayısı:** 45+

---

## Executive Summary

Bu rapor, Catering Pro projesinin kapsamlı analizinden çıkan tutarsızlıkları, eksiklikleri ve iyileştirme önerilerini içermektedir. Sorunlar **kritiklik seviyesine** göre sınıflandırılmış ve her biri için somut çözüm önerileri sunulmuştur.

### Kritiklik Seviyeleri

| Seviye | Tanım | Örnek |
|--------|-------|-------|
| 🔴 **CRITICAL** | Güvenlik riski veya veri kaybı potansiyeli | Auth tutarsızlıkları, silme işlemi tutarsızlıkları |
| 🟠 **HIGH** | Kullanıcı deneyimini ciddi etkileyen sorunlar | Frontend-backend uyumsuzlukları, eksik endpoint'ler |
| 🟡 **MEDIUM** | Maintainability ve developer experience sorunları | İsimlendirme tutarsızlıkları, kod organizasyonu |
| 🟢 **LOW** | Estetik veya minör iyileştirmeler | Dokümantasyon eksiklikleri, kod optimizasyonu |

---

## İçindekiler

1. [Database Sorunları](#database-sorunları)
2. [Backend API Sorunları](#backend-api-sorunları)
3. [Frontend Sorunları](#frontend-sorunları)
4. [Entegrasyon Sorunları](#entegrasyon-sorunları)
5. [Güvenlik Sorunları](#güvenlik-sorunları)
6. [Performance Sorunları](#performance-sorunları)
7. [Dokümantasyon Sorunları](#dokümantasyon-sorunları)
8. [Öncelik Sıralaması](#öncelik-sıralaması)

---

## Database Sorunları

### 🟡 DS-001: İsimlendirme Tutarsızlıkları

**Sorun:**
Tablo ve kolon isimlerinde tutarsız kullanımlar:

1. **Underscore Kullanımı:**
   - ✓ Doğru: `stok_kartlari`, `kasa_banka_hesaplari`
   - ✗ Hatalı: `stokdepodurumlari` (underscore eksik)

2. **Türkçe Çoğul Formları:**
   - ✓ Doğru: `cariler`, `personeller`, `projeler`
   - ✗ Tutarsız: `cari_hareketler` (neden `cariler_hareketler` değil?)

3. **Foreign Key İsimlendirmesi:**
   - `stok_kart_id` kullanılan yerlerde
   - `stok_kartlari_id` kullanılan yerlerde
   - Karışık kullanım var

**Etki:** Medium - Developer experience ve kod okunabilirliğini olumsuz etkiliyor

**Öneri:**

1. **Naming Convention Dokümanı Oluştur:**
```markdown
# Database Naming Convention

## Tablo İsimleri
- Türkçe çoğul form kullan: `cariler`, `personeller`
- Her zaman underscore ile ayır: `stok_kartlari`, `cari_hareketler`
- İngilizce system tablo'ları ayrı namespace: `sys_users`, `sys_audit_logs`

## Foreign Key İsimlendirme
- Format: `{tablo_adi_tekil}_id`
- Örnek: `stok_kart_id`, `personel_id`, `proje_id`
```

2. **Migration Oluştur:**
```sql
-- Rename inconsistent tables
ALTER TABLE stokdepodurumlari RENAME TO stok_depo_durumlari;

-- Update foreign key naming (example)
-- First check all references before renaming
```

3. **Update All References:**
- Backend routes/services
- Frontend API calls
- Migration scripts

**Tahmini Süre:** 2-3 gün (migration + testing)

---

### 🟡 DS-002: Soft Delete Tutarsızlığı

**Sorun:**
Farklı tablolarda farklı soft delete stratejileri:

- **Projeler:** `aktif` (boolean) - `false` yapınca soft delete
- **Personeller:** Hard delete kullanılıyor
- **Cariler:** Soft delete yok
- **Standardizasyon yok**

**Etki:** Medium - Veri kaybı riski, inconsistent behavior

**Öneri:**

1. **Global Soft Delete Pattern:**
```sql
-- Add to all critical tables
ALTER TABLE personeller ADD COLUMN deleted_at TIMESTAMP;
ALTER TABLE cariler ADD COLUMN deleted_at TIMESTAMP;
ALTER TABLE stok_kartlari ADD COLUMN deleted_at TIMESTAMP;

-- Create index for performance
CREATE INDEX idx_personeller_not_deleted ON personeller(id) WHERE deleted_at IS NULL;
CREATE INDEX idx_cariler_not_deleted ON cariler(id) WHERE deleted_at IS NULL;
```

2. **Backend Helper Functions:**
```javascript
// src/utils/soft-delete.js
const softDelete = async (tableName, id) => {
  return await db(tableName)
    .where({ id })
    .update({ deleted_at: new Date() });
};

const restore = async (tableName, id) => {
  return await db(tableName)
    .where({ id })
    .update({ deleted_at: null });
};

// Use in routes
router.delete('/:id', async (req, res) => {
  await softDelete('personeller', req.params.id);
  res.json({ success: true });
});

router.post('/:id/restore', async (req, res) => {
  await restore('personeller', req.params.id);
  res.json({ success: true });
});
```

3. **Migration Plan:**
   - Phase 1: Add `deleted_at` columns to all tables
   - Phase 2: Update all DELETE routes to use soft delete
   - Phase 3: Add restore endpoints
   - Phase 4: Update frontend to show deleted items option

**Tahmini Süre:** 3-4 gün

---

### 🟡 DS-003: Eksik Foreign Key Constraints

**Sorun:**
Bazı tablolarda foreign key constraint'ler eksik, bu da orphaned records oluşturabilir.

**Etki:** Medium - Veri bütünlüğü riski

**Öneri:**
```sql
-- Example: Add missing foreign keys
ALTER TABLE satin_alma_kalemleri
  ADD CONSTRAINT fk_satin_alma_kalemleri_talep
  FOREIGN KEY (talep_id) REFERENCES satin_alma_talepleri(id)
  ON DELETE CASCADE;

ALTER TABLE recete_malzemeler
  ADD CONSTRAINT fk_recete_malzemeler_recete
  FOREIGN KEY (recete_id) REFERENCES receteler(id)
  ON DELETE CASCADE;

-- Audit all tables and add missing constraints
```

**Tahmini Süre:** 2 gün

---

### 🟢 DS-004: Eksik Indexler

**Sorun:**
Sık sorgulanan kolonlarda index eksikliği:
- `created_at` kolonları
- `tarih` filtreleme kolonları
- Status fields (`durum`, `tip`)

**Etki:** Low - Performance degradation on large datasets

**Öneri:**
```sql
-- Frequently queried date ranges
CREATE INDEX idx_invoices_fatura_tarihi ON invoices(fatura_tarihi);
CREATE INDEX idx_bordro_kayitlari_yil_ay ON bordro_kayitlari(yil, ay);
CREATE INDEX idx_stok_hareketleri_tarih ON stok_hareketleri(tarih);

-- Status filters
CREATE INDEX idx_projeler_durum ON projeler(durum) WHERE aktif = true;
CREATE INDEX idx_teklifler_durum ON teklifler(durum);

-- Composite indexes for common queries
CREATE INDEX idx_personel_departman_aktif ON personeller(departman, aktif);
```

**Tahmini Süre:** 1 gün

---

## Backend API Sorunları

### 🔴 BA-001: Kimlik Doğrulama Tutarsızlıkları

**Sorun:**
Bazı route'larda inconsistent authentication:

1. **Personel Routes:**
   - `GET /api/personel` - ✅ Auth required
   - `POST /api/personel` - ✅ Auth required
   - `GET /api/personel/projeler` - ❌ No auth
   - `POST /api/personel/projeler/:projeId/personel` - ❌ No auth

2. **Invoice Routes:**
   - `GET /api/invoices/stats` - ❌ No auth (should be protected)
   - `POST /api/invoices` - ✅ Auth + permission required

3. **Projeler Routes:**
   - Neredeyse tüm endpoint'ler public (auth yok)
   - Sensitive data exposure riski

**Etki:** CRITICAL - Güvenlik açığı, unauthorized access

**Öneri:**

1. **Auth Middleware Audit:**
```javascript
// Create audit script
const auditAuthRoutes = () => {
  const routes = [
    { path: '/api/personel', methods: ['GET', 'POST', 'PUT', 'DELETE'], requiresAuth: true },
    { path: '/api/projeler', methods: ['GET', 'POST', 'PUT', 'DELETE'], requiresAuth: true },
    // ... all routes
  ];

  routes.forEach(route => {
    // Check if auth middleware is applied
    // Generate report of missing auth
  });
};
```

2. **Apply Consistent Auth:**
```javascript
// backend/src/routes/personel.js
const { authenticate, requirePermission } = require('../middleware/auth');

// ALL routes should have auth
router.get('/projeler', authenticate, async (req, res) => { ... });
router.post('/projeler/:projeId/personel', authenticate, requirePermission('personel', 'edit'), async (req, res) => { ... });

// backend/src/routes/projeler.js
// Currently NO auth - add immediately
router.get('/', authenticate, async (req, res) => { ... });
router.post('/', authenticate, requirePermission('proje', 'create'), async (req, res) => { ... });
```

3. **Public Endpoint Whitelist:**
```javascript
// Only these should be public:
const PUBLIC_ROUTES = [
  '/api/auth/login',
  '/api/auth/refresh',
  '/api/auth/register',
  '/api/system/health',
];

// Everything else requires auth
```

**Tahmini Süre:** 2-3 gün (testing kritik)

---

### 🟠 BA-002: Route Organizasyon Sorunları

**Sorun:**
Personel assignment route'ları `/personel` ve `/projeler` arasında bölünmüş:

- `/api/personel/projeler/:projeId/personel` - Personel ata
- `/api/projeler/:id/personeller` - Projedeki personelleri listele
- Duplicate functionality, confusing API

**Etki:** High - Developer confusion, maintainability sorunu

**Öneri:**

1. **Consolidate Under /projeler:**
```javascript
// backend/src/routes/projeler.js - Keep only these
router.get('/:id/personeller', authenticate, ...);
router.post('/:id/personeller', authenticate, ...);
router.post('/:id/personeller/bulk', authenticate, ...);
router.delete('/personel-atama/:atamaId', authenticate, ...);

// backend/src/routes/personel.js - Remove project assignment routes
// Only keep pure personnel management routes
```

2. **Deprecation Plan:**
```javascript
// Mark old routes as deprecated
router.get('/projeler', authenticate, (req, res) => {
  res.status(410).json({
    error: 'This endpoint is deprecated. Use /api/projeler instead.',
    newEndpoint: '/api/projeler'
  });
});
```

**Tahmini Süre:** 2 gün

---

### 🟠 BA-003: Eksik Endpoint'ler

**Sorun:**
Tablolar var ama API endpoint'leri eksik:

1. **gorevler (tasks)** - migration 029
   - Minimal routes var
   - Full CRUD yok

2. **cek_senet_sistemi** - migration 026
   - Hiç route yok
   - Feature implement edilmemiş

3. **whatsapp_messages** - migration 077
   - Limited integration
   - Sadece basic routes

4. **scraper_queue** - migration 103
   - Minimal routes
   - Queue management eksik

**Etki:** High - Incomplete features, database tables unused

**Öneri:**

**Option 1 - Implement Missing Endpoints:**
```javascript
// backend/src/routes/gorevler.js
router.get('/', authenticate, async (req, res) => {
  const gorevler = await db('gorevler')
    .where({ user_id: req.user.id })
    .where('deleted_at', null);
  res.json(gorevler);
});

router.post('/', authenticate, async (req, res) => {
  const gorev = await db('gorevler').insert({
    ...req.body,
    user_id: req.user.id
  }).returning('*');
  res.json(gorev[0]);
});

// ... full CRUD
```

**Option 2 - Remove Unused Tables:**
```sql
-- If features are not planned
DROP TABLE cek_senet_sistemi;
-- Document why it was removed
```

**Recommendation:** Implement or remove - don't leave half-done

**Tahmini Süre:** 1 hafta (tüm eksik endpoint'ler için)

---

### 🟡 BA-004: Permission Check Tutarsızlığı

**Sorun:**
Bazı route'larda permission check var, bazılarında yok:

- Invoices: `requirePermission('fatura', 'create')`
- Personel: `requirePermission('personel', 'create')`
- Projeler: **Hiç permission check yok**
- Stok: **Hiç permission check yok**

**Etki:** Medium - Inconsistent access control

**Öneri:**
```javascript
// Apply to all critical operations
router.post('/api/projeler',
  authenticate,
  requirePermission('proje', 'create'),
  async (req, res) => { ... }
);

router.put('/api/stok/:id',
  authenticate,
  requirePermission('stok', 'edit'),
  async (req, res) => { ... }
);
```

**Tahmini Süre:** 3 gün

---

### 🟢 BA-005: Eksik API Dokümantasyonu

**Sorun:**
- Karmaşık hesaplama endpoint'leri (bordro, tazminat) dokümante edilmemiş
- Swagger/OpenAPI spec yok
- Request/response examples yok

**Etki:** Low - Developer onboarding zorluğu

**Öneri:**
```javascript
// Use Swagger JSDoc
/**
 * @swagger
 * /api/bordro/net-brut-hesapla:
 *   post:
 *     summary: Net-brüt maaş hesaplama
 *     tags: [Bordro]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               hesaplama_tipi:
 *                 type: string
 *                 enum: [net_to_brut, brut_to_net]
 *               tutar:
 *                 type: number
 *               yil:
 *                 type: number
 *     responses:
 *       200:
 *         description: Hesaplama sonucu
 */
router.post('/net-brut-hesapla', async (req, res) => { ... });
```

**Tahmini Süre:** 1 hafta (tüm endpoint'ler için)

---

## Frontend Sorunları

### 🟠 FE-001: Backend-Frontend Uyumsuzlukları

**Sorun:**
Frontend bazı endpoint'leri bekliyor ama backend'de yok:

1. **Menu Planning Conflict Detection:**
   - Frontend: `POST /api/menu-planlama/check-conflict`
   - Backend: Endpoint var ama incomplete implementation

2. **Calendar View API:**
   - Frontend menü takvim görünümü için gelişmiş sorgular bekliyor
   - Backend sadece basic list endpoint'i sunuyor

3. **Advanced Filtering:**
   - Bazı modüllerde frontend karmaşık filter UI'ı var
   - Backend filter parametrelerini handle etmiyor

**Etki:** High - Features çalışmıyor, UX kötü

**Öneri:**

1. **Implement Missing Backend:**
```javascript
// backend/src/routes/menu-planlama.js
router.post('/check-conflict', authenticate, async (req, res) => {
  const { proje_id, baslangic_tarihi, bitis_tarihi } = req.body;

  const conflicts = await db('menu_planlari')
    .where({ proje_id })
    .where('aktif', true)
    .where(function() {
      this.whereBetween('baslangic_tarihi', [baslangic_tarihi, bitis_tarihi])
        .orWhereBetween('bitis_tarihi', [baslangic_tarihi, bitis_tarihi]);
    });

  res.json({ hasConflict: conflicts.length > 0, conflicts });
});

router.get('/calendar-view', authenticate, async (req, res) => {
  const { proje_id, start_date, end_date } = req.query;

  const menuPlans = await db('menu_planlari')
    .join('menu_plan_ogunleri', 'menu_planlari.id', 'menu_plan_ogunleri.menu_plan_id')
    .join('menu_ogun_yemekleri', 'menu_plan_ogunleri.id', 'menu_ogun_yemekleri.menu_plan_ogun_id')
    .join('receteler', 'menu_ogun_yemekleri.recete_id', 'receteler.id')
    .where('menu_planlari.proje_id', proje_id)
    .whereBetween('menu_plan_ogunleri.tarih', [start_date, end_date])
    .select(/* ... */);

  res.json(menuPlans);
});
```

2. **Update Frontend to Use Correct Endpoints:**
```tsx
// frontend/src/lib/api/services/menu-planlama.ts
export const menuPlanlamaService = {
  checkConflict: (data: any) => api.post('/menu-planlama/check-conflict', data),
  getCalendarView: (params: any) => api.get('/menu-planlama/calendar-view', { params }),
};
```

**Tahmini Süre:** 1 hafta

---

### 🟠 FE-002: Kullanılmayan Backend Özellikleri

**Sorun:**
Backend'de var ama frontend'de kullanılmayan özellikler:

1. **Tazminat Hesaplama UI:** Minimal, sadece basic form
2. **Görevler Sistemi:** UI incomplete
3. **Admin Notification Features:** Bazı özellikler kullanılmıyor

**Etki:** High - Wasted development effort, incomplete features

**Öneri:**

**Option 1 - Complete Frontend:**
```tsx
// Implement full Tazminat UI
// frontend/src/app/muhasebe/personel/tazminat/page.tsx
'use client';

import { useState } from 'react';
import { personelService } from '@/lib/api/services/personel';

export default function TazminatPage() {
  const [calculation, setCalculation] = useState(null);

  const handleCalculate = async (data) => {
    const result = await personelService.calculateTazminat(data);
    setCalculation(result);
  };

  return (
    <div>
      <TazminatForm onSubmit={handleCalculate} />
      {calculation && <TazminatResults data={calculation} />}
      <TazminatHistory />
    </div>
  );
}
```

**Option 2 - Remove Unused Backend:**
```javascript
// If no plans to use, remove endpoint to reduce maintenance
// But document WHY it was removed
```

**Recommendation:** Complete frontend - features are valuable

**Tahmini Süre:** 2 hafta (tüm incomplete features için)

---

### 🟡 FE-003: Component Organizasyon Sorunları

**Sorun:**
- Bazı component'ler çok büyük (1000+ satır)
- Duplicate logic farklı component'lerde
- Naming conventions tutarsız

**Etki:** Medium - Maintainability zorluğu

**Öneri:**

1. **Component Splitting:**
```tsx
// Before: FaturaDetay.tsx (1200 lines)
export default function FaturaDetay() {
  // ... 1200 lines of code
}

// After: Split into smaller components
// FaturaDetay.tsx (150 lines)
export default function FaturaDetay() {
  return (
    <>
      <FaturaHeader data={fatura} />
      <FaturaKalemlerTable kalemler={kalemler} />
      <FaturaOdemeler odemeler={odemeler} />
      <FaturaIslemler fatura={fatura} />
    </>
  );
}

// FaturaHeader.tsx (50 lines)
// FaturaKalemlerTable.tsx (200 lines)
// FaturaOdemeler.tsx (100 lines)
// FaturaIslemler.tsx (80 lines)
```

2. **Extract Shared Logic to Hooks:**
```tsx
// Duplicate pagination logic in multiple components

// Create hook
export function usePagination(initialPage = 1, initialLimit = 10) {
  const [page, setPage] = useState(initialPage);
  const [limit, setLimit] = useState(initialLimit);

  const nextPage = () => setPage(p => p + 1);
  const prevPage = () => setPage(p => Math.max(1, p - 1));

  return { page, limit, nextPage, prevPage, setPage, setLimit };
}

// Use in components
const { page, limit, nextPage, prevPage } = usePagination();
```

3. **Naming Convention:**
```
# Component Naming Rules
- PascalCase: `FaturaDetay.tsx`
- Suffixes:
  - Modal: `FaturaEkleModal.tsx`
  - Form: `FaturaForm.tsx`
  - Table: `FaturaTable.tsx`
  - Card: `FaturaCard.tsx`
```

**Tahmini Süre:** 2 hafta (major refactoring)

---

### 🟡 FE-004: Type Safety Sorunları

**Sorun:**
- Bazı API response'ları `any` type kullanıyor
- Type definitions eksik veya incomplete
- Runtime type checking yok

**Etki:** Medium - Type safety risks, runtime errors

**Öneri:**

1. **Strict Typing:**
```tsx
// Before
const fetchFaturalar = async (): Promise<any> => {
  return await api.get('/invoices');
};

// After
interface Fatura {
  id: string;
  ettn: string;
  fatura_no: string;
  fatura_tarihi: string;
  tedarikci_adi: string;
  toplam_tutar: number;
  kdv_tutari: number;
  durum: 'draft' | 'approved' | 'paid';
}

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

const fetchFaturalar = async (): Promise<PaginatedResponse<Fatura>> => {
  const response = await api.get<PaginatedResponse<Fatura>>('/invoices');
  return response.data;
};
```

2. **Runtime Validation with Zod:**
```tsx
import { z } from 'zod';

const FaturaSchema = z.object({
  id: z.string().uuid(),
  ettn: z.string(),
  fatura_no: z.string(),
  fatura_tarihi: z.string().datetime(),
  tedarikci_adi: z.string(),
  toplam_tutar: z.number(),
  kdv_tutari: z.number(),
  durum: z.enum(['draft', 'approved', 'paid']),
});

const fetchFaturalar = async () => {
  const response = await api.get('/invoices');
  const validated = FaturaSchema.array().parse(response.data.data);
  return validated;
};
```

3. **Auto-generate Types from OpenAPI:**
```bash
npm install openapi-typescript
npx openapi-typescript http://localhost:3001/api-docs -o src/types/api-types.ts
```

**Tahmini Süre:** 1 hafta

---

### 🟡 FE-005: State Management Eksikliği

**Sorun:**
- Global state yönetimi sadece Context ile
- Karmaşık state için Redux/Zustand yok
- Cache management (react-query) kullanılmıyor
- Her component kendi API call'ını yapıyor (duplicate requests)

**Etki:** Medium - Performance, unnecessary re-renders

**Öneri:**

**Use React Query for Server State:**
```tsx
// Before - in component
const [faturalar, setFaturalar] = useState([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  const fetchData = async () => {
    setLoading(true);
    const data = await faturaService.getAll();
    setFaturalar(data);
    setLoading(false);
  };
  fetchData();
}, []);

// After - with React Query
import { useQuery } from '@tanstack/react-query';

const { data: faturalar, isLoading } = useQuery({
  queryKey: ['faturalar'],
  queryFn: () => faturaService.getAll(),
  staleTime: 5 * 60 * 1000, // 5 minutes
});
```

**Use Zustand for UI State:**
```tsx
// src/stores/useFilterStore.ts
import { create } from 'zustand';

interface FilterState {
  startDate: string | null;
  endDate: string | null;
  durum: string | null;
  setStartDate: (date: string | null) => void;
  setEndDate: (date: string | null) => void;
  setDurum: (durum: string | null) => void;
  reset: () => void;
}

export const useFilterStore = create<FilterState>((set) => ({
  startDate: null,
  endDate: null,
  durum: null,
  setStartDate: (startDate) => set({ startDate }),
  setEndDate: (endDate) => set({ endDate }),
  setDurum: (durum) => set({ durum }),
  reset: () => set({ startDate: null, endDate: null, durum: null }),
}));
```

**Tahmini Süre:** 1 hafta

---

## Entegrasyon Sorunları

### 🟠 IN-001: API Contract Mismatch

**Sorun:**
Frontend ve backend arasında API contract'ı dokümante edilmemiş:

- Expected request formats farklı
- Response structures documented değil
- Versioning yok

**Etki:** High - Breaking changes risky

**Öneri:**

1. **OpenAPI Specification:**
```yaml
# openapi.yaml
openapi: 3.0.0
info:
  title: Catering Pro API
  version: 1.0.0

paths:
  /api/personel:
    get:
      tags:
        - Personel
      summary: Get all personnel
      security:
        - bearerAuth: []
      parameters:
        - name: departman
          in: query
          schema:
            type: string
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Personel'
```

2. **Contract Testing:**
```javascript
// test/contract/personel.contract.test.js
const { Pact } = require('@pact-foundation/pact');

describe('Personel API Contract', () => {
  it('should return personel list', async () => {
    await provider
      .given('personel exists')
      .uponReceiving('a request for personel')
      .withRequest({
        method: 'GET',
        path: '/api/personel',
      })
      .willRespondWith({
        status: 200,
        body: Matchers.eachLike({
          id: Matchers.uuid(),
          ad_soyad: Matchers.string(),
        }),
      });
  });
});
```

**Tahmini Süre:** 2 hafta

---

### 🟢 IN-002: API Versioning Yok

**Sorun:**
API versioning stratejisi yok - breaking changes riski

**Etki:** Low (şu an), High (gelecekte)

**Öneri:**
```javascript
// Versioned routes
app.use('/api/v1', require('./routes/v1'));
app.use('/api/v2', require('./routes/v2'));

// Or header-based
app.use('/api', (req, res, next) => {
  const version = req.headers['api-version'] || 'v1';
  req.apiVersion = version;
  next();
});
```

**Tahmini Süre:** 3 gün

---

## Güvenlik Sorunları

### 🔴 SEC-001: Rate Limiting Eksikliği

**Sorun:**
Sadece login endpoint'inde rate limiting var, diğer endpoint'lerde yok

**Etki:** CRITICAL - DDoS riski, brute force attacks

**Öneri:**
```javascript
// backend/src/middleware/rate-limiter.js
const rateLimit = require('express-rate-limit');

// Global rate limiter
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 minutes
  message: 'Too many requests, please try again later',
});

// Strict limiter for sensitive operations
const strictLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  message: 'Too many requests, please slow down',
});

// Apply globally
app.use('/api', globalLimiter);

// Apply strict to sensitive endpoints
app.use('/api/auth/login', strictLimiter);
app.use('/api/invoices', strictLimiter);
app.use('/api/personel', strictLimiter);
```

**Tahmini Süre:** 1 gün

---

### 🔴 SEC-002: SQL Injection Riski

**Sorun:**
Bazı raw SQL query'lerde parametre binding eksik

**Etki:** CRITICAL - SQL injection vulnerability

**Öneri:**
```javascript
// Bad - SQL Injection risky
const query = `SELECT * FROM personeller WHERE ad_soyad LIKE '%${req.query.search}%'`;

// Good - Parameterized query
const query = 'SELECT * FROM personeller WHERE ad_soyad LIKE ?';
const results = await db.raw(query, [`%${req.query.search}%`]);

// Better - Use query builder
const results = await db('personeller')
  .where('ad_soyad', 'like', `%${req.query.search}%`);
```

**Tahmini Süre:** 3 gün (audit + fix)

---

### 🟠 SEC-003: CORS Configuration

**Sorun:**
CORS configuration production'a uygun değil

**Etki:** High - Security misconfiguration

**Öneri:**
```javascript
// backend/src/server.js
const cors = require('cors');

// Development
if (process.env.NODE_ENV === 'development') {
  app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true,
  }));
}

// Production
else {
  app.use(cors({
    origin: ['https://catering-tr.com', 'https://www.catering-tr.com'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));
}
```

**Tahmini Süre:** 1 gün

---

## Performance Sorunları

### 🟡 PE-001: N+1 Query Problem

**Sorun:**
Bazı endpoint'lerde N+1 query problemi:

```javascript
// Bad - N+1 queries
const projeler = await db('projeler').select('*');
for (const proje of projeler) {
  proje.personeller = await db('proje_personelleri')
    .where({ proje_id: proje.id });
}
```

**Etki:** Medium - Performance degradation

**Öneri:**
```javascript
// Good - Single query with join
const projeler = await db('projeler')
  .leftJoin('proje_personelleri', 'projeler.id', 'proje_personelleri.proje_id')
  .leftJoin('personeller', 'proje_personelleri.personel_id', 'personeller.id')
  .select(
    'projeler.*',
    db.raw('JSON_AGG(personeller.*) as personeller')
  )
  .groupBy('projeler.id');
```

**Tahmini Süre:** 1 hafta (audit + fix)

---

### 🟡 PE-002: Frontend Bundle Size

**Sorun:**
Large bundle size, no code splitting bazı route'larda

**Etki:** Medium - Slow initial load

**Öneri:**
```tsx
// Use dynamic imports
const IhaleUzmani = dynamic(() => import('@/components/IhaleUzmani'), {
  loading: () => <LoadingState />,
  ssr: false,
});

// Route-based code splitting (automatic in Next.js App Router)
// But check bundle analyzer
npm run build
npx @next/bundle-analyzer
```

**Tahmini Süre:** 3 gün

---

## Dokümantasyon Sorunları

### 🟢 DOC-001: API Dokümantasyonu Eksik

**Etki:** Low - Onboarding zorluğu

**Öneri:** Swagger/OpenAPI implement (yukarıda detaylandırıldı)

---

### 🟢 DOC-002: Architecture Decision Records Yok

**Öneri:**
```markdown
# ADR 001: Use JWT for Authentication

## Context
Need secure authentication for multi-device support

## Decision
Use JWT tokens with 24h access + 30d refresh strategy

## Consequences
- Stateless authentication
- Can't revoke access tokens immediately
- Need refresh token management
```

**Tahmini Süre:** 1 hafta (tüm major decisions için)

---

## Öncelik Sıralaması

### Sprint 1 - Critical Security & Data Integrity (1-2 hafta)

| ID | Sorun | Kritiklik | Süre |
|----|-------|-----------|------|
| BA-001 | Auth tutarsızlıkları | 🔴 CRITICAL | 2-3 gün |
| DS-002 | Soft delete standardization | 🟡 MEDIUM | 3-4 gün |
| SEC-001 | Rate limiting | 🔴 CRITICAL | 1 gün |
| SEC-002 | SQL injection audit | 🔴 CRITICAL | 3 gün |

**Toplam:** ~2 hafta

---

### Sprint 2 - API Completion & Frontend-Backend Alignment (2-3 hafta)

| ID | Sorun | Kritiklik | Süre |
|----|-------|-----------|------|
| BA-003 | Eksik endpoint'ler | 🟠 HIGH | 1 hafta |
| FE-001 | Backend-frontend uyumsuzlukları | 🟠 HIGH | 1 hafta |
| FE-002 | Kullanılmayan backend özellikleri | 🟠 HIGH | 2 hafta |

**Toplam:** ~3 hafta

---

### Sprint 3 - Code Quality & Organization (2-3 hafta)

| ID | Sorun | Kritiklik | Süre |
|----|-------|-----------|------|
| DS-001 | İsimlendirme tutarsızlıkları | 🟡 MEDIUM | 2-3 gün |
| BA-002 | Route organizasyon | 🟠 HIGH | 2 gün |
| FE-003 | Component organizasyon | 🟡 MEDIUM | 2 hafta |
| FE-004 | Type safety | 🟡 MEDIUM | 1 hafta |

**Toplam:** ~3 hafta

---

### Sprint 4 - Performance & Optimization (1-2 hafta)

| ID | Sorun | Kritiklik | Süre |
|----|-------|-----------|------|
| DS-004 | Eksik indexler | 🟢 LOW | 1 gün |
| PE-001 | N+1 query problem | 🟡 MEDIUM | 1 hafta |
| PE-002 | Bundle optimization | 🟡 MEDIUM | 3 gün |
| FE-005 | State management | 🟡 MEDIUM | 1 hafta |

**Toplam:** ~2 hafta

---

### Sprint 5 - Documentation & Testing (2-3 hafta)

| ID | Sorun | Kritiklik | Süre |
|----|-------|-----------|------|
| BA-005 | API dokümantasyonu | 🟢 LOW | 1 hafta |
| IN-001 | API contract | 🟠 HIGH | 2 hafta |
| DOC-001 | OpenAPI spec | 🟢 LOW | 1 hafta |
| DOC-002 | ADR docs | 🟢 LOW | 1 hafta |

**Toplam:** ~3 hafta

---

## Toplam Tahmini Süre

**Minimum (Critical + High priority):** 6-8 hafta
**Maksimum (Tüm sorunlar):** 12-14 hafta

---

## Sonuç ve Öneriler

### Genel Değerlendirme

Catering Pro projesi **mature ve feature-rich** bir sistemdir. Ancak **hızlı geliştirme sürecinde** oluşan tutarsızlıklar ve eksiklikler bulunmaktadır.

### Ana Odak Alanları

1. **Güvenlik:** Auth tutarsızlıkları ve SQL injection riskleri acil
2. **API Completion:** Eksik endpoint'ler ve frontend-backend uyumsuzlukları
3. **Code Quality:** İsimlendirme, organizasyon, type safety
4. **Documentation:** API dokümantasyonu ve developer onboarding

### Başarı Kriterleri

- ✅ Tüm endpoint'ler authenticated
- ✅ Hiç SQL injection vulnerability yok
- ✅ Frontend-backend API contract uyumlu
- ✅ Test coverage %80+
- ✅ OpenAPI spec complete
- ✅ Tüm tablolar için soft delete
- ✅ Consistent naming conventions

---

**Son Güncelleme:** 2026-01-31
**Bakım:** Development Team
