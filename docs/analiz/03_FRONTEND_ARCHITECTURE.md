# Frontend Mimari Dokümantasyonu - Catering Pro

**Oluşturulma Tarihi:** 2026-01-31
**Framework:** Next.js 15 (App Router)
**UI Kütüphanesi:** Mantine UI
**Toplam Sayfa:** 69 .tsx/.ts dosyası
**Toplam Component:** 95 .tsx/.ts dosyası

---

## İçindekiler

1. [Genel Mimari](#genel-mimari)
2. [Sayfa Yapısı](#sayfa-yapısı)
3. [Component Organizasyonu](#component-organizasyonu)
4. [State Yönetimi](#state-yönetimi)
5. [API Entegrasyonu](#api-entegrasyonu)
6. [Routing & Navigasyon](#routing--navigasyon)
7. [Type System](#type-system)
8. [Custom Hooks](#custom-hooks)
9. [Stil & Tema](#stil--tema)
10. [Öneriler](#öneriler)

---

## Genel Mimari

### Teknoloji Stack'i

```
Next.js 15 (App Router)
├── React 18
├── TypeScript
├── Mantine UI v7
├── Supabase Client (Realtime)
├── Axios (API Client)
└── CSS Modules + Global Styles
```

### Dizin Yapısı

```
frontend/src/
├── app/                    # Next.js App Router sayfaları (69 dosya)
│   ├── admin/             # Admin paneli (13 sayfa)
│   ├── muhasebe/          # Muhasebe modülü (20+ sayfa)
│   ├── tenders/           # İhale sistemi (3 sayfa)
│   ├── ai-chat/           # AI sohbet (2 sayfa)
│   ├── page.tsx           # Ana sayfa
│   ├── layout.tsx         # Root layout
│   └── ...
├── components/            # React component'leri (95 dosya)
│   ├── common/            # Ortak component'ler
│   ├── ui/                # UI primitives
│   ├── muhasebe/          # Muhasebe component'leri
│   ├── IhaleUzmani/       # İhale uzmanı
│   ├── GodModeTerminal/   # Admin terminal
│   └── ...
├── lib/                   # Utility kütüphaneleri (28 dosya)
│   ├── api/               # API client & services (14 dosya)
│   ├── supabase/          # Supabase client
│   ├── validation/        # Input validation
│   ├── config.ts          # Yapılandırma
│   └── ...
├── context/               # React Context providers (2 dosya)
│   ├── AuthContext.tsx
│   └── RealtimeContext.tsx
├── hooks/                 # Custom React hooks (9 dosya)
│   ├── usePermissions.ts
│   ├── useNotes.ts
│   └── ...
├── types/                 # TypeScript type definitions (5 dosya)
│   ├── domain.ts
│   ├── api.ts
│   └── ...
└── styles/               # Global styles
```

---

## Sayfa Yapısı

### Ana Sayfa & Layout

**Dosya:** `frontend/src/app/layout.tsx`
- Root layout - tüm sayfalar için wrapper
- `<Providers>` component'i ile context sağlayıcıları
- Global metadata ve font yapılandırması

**Dosya:** `frontend/src/app/page.tsx`
- Ana dashboard sayfası
- Login durumuna göre yönlendirme
- Genel istatistikler ve quicklinks

**Error Handling:**
- `error.tsx` - Sayfa hataları
- `global-error.tsx` - Global hata yakalama
- `not-found.tsx` - 404 sayfası

---

### Admin Modülü (13 Sayfa)

**Dizin:** `frontend/src/app/admin/`

| Sayfa | Dosya | Açıklama |
|-------|-------|----------|
| Admin Ana | `page.tsx` | Admin dashboard |
| Kullanıcılar | `kullanicilar/page.tsx` | Kullanıcı yönetimi |
| Yetki Şablonları | `yetki-sablonlari/page.tsx` | Permission template'leri |
| Yetkiler | `yetkiler/page.tsx` | Yetki atama |
| Loglar | `loglar/page.tsx` | Audit log görüntüleme |
| Sistem | `sistem/page.tsx` | Sistem ayarları |
| IP Yönetimi | `ip-management/page.tsx` | IP whitelist/blacklist |
| Scraper | `scraper/page.tsx` | Web scraper yönetimi |
| Prompt Builder | `prompt-builder/page.tsx` | AI prompt oluşturma |
| Saved Prompts | `prompt-builder/saved/page.tsx` | Kaydedilmiş prompt'lar |
| God Mode | `god-mode/page.tsx` | Admin terminal |
| Sync | `sync/page.tsx` | Veri senkronizasyonu |

**Layout:** `admin/layout.tsx` - Admin-only wrapper, `<AdminGuard>` ile korumalı

---

### Muhasebe Modülü (20+ Sayfa)

**Dizin:** `frontend/src/app/muhasebe/`

#### Faturalar
- `faturalar/page.tsx` - Fatura listesi
- `faturalar/[ettn]/page.tsx` - Fatura detay sayfası
- `faturalar/[ettn]/kalemler/page.tsx` - Fatura kalemleri eşleştirme
- `faturalar/components/` - Fatura component'leri
  - `tables/` - Tablo component'leri
  - `modals/` - Modal dialog'lar
- `faturalar/hooks/` - Fatura-spesifik hooks

#### Stok Yönetimi
- `stok/page.tsx` - Stok kartları listesi
- `stok/components/` - Stok component'leri
- `stok/modals/` - Stok modal'ları
- `stok/hooks/` - Stok hooks

#### Diğer Muhasebe Sayfaları
- `page.tsx` - Muhasebe ana dashboard
- `satin-alma/page.tsx` - Satın alma talepleri
- `raporlar/page.tsx` - Raporlar ana sayfa
- `raporlar/dashboard/page.tsx` - Rapor dashboard
- `gelir-gider/page.tsx` - Gelir-gider yönetimi
- `personel/page.tsx` - Personel listesi
- `demirbas/page.tsx` - Demirbaş yönetimi
- `kasa-banka/page.tsx` - Kasa & banka hesapları
- `finans/page.tsx` - Finans yönetimi
- `cariler/page.tsx` - Cari hesaplar
- `menu-planlama/page.tsx` - Menü planlama
- `menu-planlama-takvim/page.tsx` - Menü takvim görünümü

---

### İhale Modülü (3 Sayfa)

**Dizin:** `frontend/src/app/tenders/`

- `page.tsx` - İhale listesi
- `[id]/page.tsx` - İhale detay sayfası

**İhale Uzmanı:**
- `frontend/src/app/ihale-uzmani/page.tsx` - İhale uzmanı ana sayfa

---

### AI Chat (2 Sayfa)

**Dizin:** `frontend/src/app/ai-chat/`

- `page.tsx` - AI sohbet arayüzü
- `history/page.tsx` - Geçmiş konuşmalar

---

### Diğer Sayfalar

| Sayfa | Dosya | Açıklama |
|-------|-------|----------|
| Profil | `profil/page.tsx` | Kullanıcı profili |
| Ayarlar | `ayarlar/page.tsx` | Kullanıcı ayarları |
| Sistem Ayarları | `ayarlar/sistem/page.tsx` | Sistem ayarları |
| AI Ayarları | `ayarlar/ai/page.tsx` | AI yapılandırması |
| Sosyal Medya | `sosyal-medya/page.tsx` | Sosyal medya yönetimi |
| Tracking | `tracking/page.tsx` | İzleme |
| Upload | `upload/page.tsx` | Dosya yükleme |
| Giriş | `giris/page.tsx` | Login sayfası |
| Planlama | `planlama/page.tsx` | Planlama modülü |
| Artlist Demo | `artlist-demo/page.tsx` | Artlist entegrasyonu |

---

## Component Organizasyonu

### Top-Level Components (24 Dosya)

**Dosya:** `frontend/src/components/`

#### Layout & Navigation
- `AppLayout.tsx` - Ana uygulama layout'u
- `ClientLayout.tsx` - Client-side layout wrapper
- `Navbar.tsx` - Üst navigasyon bar'ı
- `MobileSidebar.tsx` - Mobil yan menü

#### Authentication Guards
- `AuthGuard.tsx` - Kimlik doğrulama kontrolü
- `AdminGuard.tsx` - Admin-only route koruması

#### AI Components
- `AIChat.tsx` - AI sohbet component'i
- `FloatingAIChat.tsx` - Floating AI chat button
- `IhaleUzmani/` - İhale uzmanı modülü (subdirectory)
- `PromptBuilder/` - Prompt oluşturma arayüzü (subdirectory)
- `GodModeTerminal/` - Admin terminal (subdirectory)

#### Data Management
- `ChatHistory/` - Chat geçmişi (subdirectory)
- `NotesSection/` - Not yönetimi (subdirectory)
- `DataActions.tsx` - Toplu veri işlemleri
- `SearchModal.tsx` - Arama modal'ı
- `ExportModal.tsx` - Export modal'ı
- `ImportModal.tsx` - Import modal'ı

#### Modals & Dialogs
- `ConfirmDialog.tsx` - Onay dialogu
- `ResponsiveModal.tsx` - Responsive modal wrapper
- `NotesModal.tsx` - Not ekleme/düzenleme
- `ReceteModal.tsx` - Reçete modal'ı
- `UrunDetayModal.tsx` - Ürün detay modal'ı
- `UrunKartlariModal.tsx` - Ürün kartları modal'ı
- `IhaleUzmaniModal.tsx` - İhale uzmanı modal'ı
- `BordroImportModal.tsx` - Bordro import modal'ı
- `TenderMapModal.tsx` - İhale harita modal'ı

#### Menu & Calendar
- `MenuCalendar.tsx` - Menü takvimi
- `MenuPlanCalendarView.tsx` - Menü plan takvim görünümü

#### Utilities
- `ErrorBoundary.tsx` - Hata yakalama boundary
- `Providers.tsx` - Context provider wrapper'ı
- `RealtimeIndicator.tsx` - Realtime bağlantı göstergesi
- `ResponsiveTable.tsx` - Responsive tablo wrapper
- `WhatsAppNavButton.tsx` - WhatsApp navigasyon butonu
- `WhatsAppWidget/` - WhatsApp entegrasyonu (subdirectory)

---

### Common Components

**Dizin:** `frontend/src/components/common/`

- `Breadcrumbs.tsx` - Breadcrumb navigasyonu
- `EmptyState.tsx` - Boş durum göstergesi
- `LoadingState.tsx` - Loading spinner/skeleton
- `index.ts` - Re-export barrel file

**Kullanım:**
```tsx
import { EmptyState, LoadingState } from '@/components/common';

// Kullanım
{loading ? <LoadingState /> : data.length === 0 ? <EmptyState /> : <DataTable />}
```

---

### UI Components

**Dizin:** `frontend/src/components/ui/`

- `StyledDatePicker.tsx` - Özelleştirilmiş tarih seçici
- `StyledDatePicker.module.css` - DatePicker stilleri
- `cards/` - Card component'leri

---

### Muhasebe Components

**Dizin:** `frontend/src/components/muhasebe/`

- `CariDetayModal.tsx` - Cari detay modal'ı
- `MutabakatModal.tsx` - Mutabakat modal'ı
- `ProjeCard.tsx` - Proje kartı component'i
- `ProjeYonetimModal.tsx` - Proje yönetim modal'ı

---

### İhale Uzmanı Components

**Dizin:** `frontend/src/components/IhaleUzmani/`

**Alt Dizinler:**
- `tabs/` - Tab component'leri
- `modals/` - Modal dialog'lar
- `hooks/` - İhale-spesifik hooks

---

### Diğer Component Dizinleri

- `artlist/` - Artlist entegrasyon component'leri
- `auth/` - Authentication component'leri
  - `steps/` - Multi-step auth flow
- `ChatHistory/` - Chat geçmişi component'leri
- `finans/` - Finans component'leri
- `GodModeTerminal/` - Admin terminal component'leri
- `mobile/` - Mobile-specific component'ler
- `notes/` - Notes sistem component'leri
- `NotesSection/` - Notes UI component'leri
- `PromptBuilder/` - Prompt builder UI
- `teklif/` - Teklif/quotation component'leri
- `WhatsAppWidget/` - WhatsApp entegrasyon widget'ları

---

## State Yönetimi

### Context Providers

#### AuthContext
**Dosya:** `frontend/src/context/AuthContext.tsx`

```tsx
interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}
```

**Özellikler:**
- JWT token yönetimi
- Kullanıcı bilgisi saklama
- Login/logout işlemleri
- Auto-refresh mechanism

**Kullanım:**
```tsx
import { useAuth } from '@/context/AuthContext';

const MyComponent = () => {
  const { user, logout } = useAuth();
  // ...
}
```

---

#### RealtimeContext
**Dosya:** `frontend/src/context/RealtimeContext.tsx`

```tsx
interface RealtimeContextType {
  subscribe: (table: string, callback: Function) => void;
  unsubscribe: (table: string) => void;
  isConnected: boolean;
}
```

**Özellikler:**
- Supabase realtime subscriptions
- Otomatik yeniden bağlantı
- Tablo-spesifik subscriptions
- Connection status tracking

---

### Custom Hooks (9 Dosya)

**Dizin:** `frontend/src/hooks/`

#### usePermissions
**Dosya:** `usePermissions.ts`

```tsx
const { hasPermission, loading } = usePermissions();

if (hasPermission('personel', 'create')) {
  // Kullanıcının personel oluşturma yetkisi var
}
```

---

#### useNotes
**Dosya:** `useNotes.ts`

```tsx
const { notes, createNote, updateNote, deleteNote } = useNotes();
```

**Özellikler:**
- Not CRUD işlemleri
- Etiket yönetimi
- Hatırlatıcı ayarlama
- Realtime güncellemeler

---

#### useMaliyetHesaplama
**Dosya:** `useMaliyetHesaplama.ts`

**Özellikler:**
- Reçete maliyet hesaplama
- Malzeme fiyat güncellemeleri
- Porsiyon başı maliyet

---

#### useGlobalHotkeys
**Dosya:** `useGlobalHotkeys.ts`

**Klavye Kısayolları:**
- `Ctrl+K` - Arama modal'ı
- `Ctrl+B` - Sidebar toggle
- `Ctrl+N` - Yeni not
- `Ctrl+Shift+A` - AI Chat toggle

---

#### useLocalStorage
**Dosya:** `useLocalStorage.ts`

```tsx
const [theme, setTheme] = useLocalStorage('theme', 'light');
```

---

#### usePromptBuilder
**Dosya:** `usePromptBuilder.ts`

**Özellikler:**
- AI prompt oluşturma
- Template yönetimi
- Değişken interpolation

---

#### useRealtimeSubscription
**Dosya:** `useRealtimeSubscription.ts`

```tsx
useRealtimeSubscription('personeller', (payload) => {
  console.log('Personel güncellendi:', payload);
});
```

---

#### useResponsive
**Dosya:** `useResponsive.ts`

```tsx
const { isMobile, isTablet, isDesktop } = useResponsive();
```

---

#### useWhatsAppSocket
**Dosya:** `useWhatsAppSocket.ts`

**Özellikler:**
- WhatsApp WebSocket bağlantısı
- Mesaj gönderme/alma
- Bağlantı durumu takibi

---

## API Entegrasyonu

### API Client Yapısı

**Ana Dosya:** `frontend/src/lib/api.ts`

```tsx
import axios from 'axios';
import { API_URL } from './config';

const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  withCredentials: true,
});

// Request interceptor - JWT token ekleme
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor - Token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token refresh logic
    }
    return Promise.reject(error);
  }
);
```

---

### API Services (14 Dosya)

**Dizin:** `frontend/src/lib/api/services/`

#### admin.ts
```tsx
export const adminService = {
  getUsers: () => api.get('/auth/users'),
  getUserPermissions: (userId: string) => api.get(`/permissions/user/${userId}`),
  updatePermissions: (userId: string, permissions: any) => api.put(`/permissions/user/${userId}`, permissions),
  getAuditLogs: (params: any) => api.get('/audit-logs', { params }),
  // ...
};
```

---

#### auth.ts
```tsx
export const authService = {
  login: (email: string, password: string) => api.post('/auth/login', { email, password }),
  logout: () => api.post('/auth/logout'),
  refresh: () => api.post('/auth/refresh'),
  me: () => api.get('/auth/me'),
  updateProfile: (data: any) => api.put('/auth/profile', data),
  changePassword: (oldPassword: string, newPassword: string) => api.put('/auth/password', { oldPassword, newPassword }),
  // ...
};
```

---

#### personel.ts
```tsx
export const personelService = {
  getAll: (params?: any) => api.get('/personel', { params }),
  getById: (id: string) => api.get(`/personel/${id}`),
  create: (data: any) => api.post('/personel', data),
  update: (id: string, data: any) => api.put(`/personel/${id}`, data),
  delete: (id: string) => api.delete(`/personel/${id}`),
  getStats: () => api.get('/personel/stats'),
  calculateTazminat: (data: any) => api.post('/personel/tazminat/hesapla', data),
  // ...
};
```

---

#### fatura-kalemleri.ts
```tsx
export const faturaKalemleriService = {
  getFaturalar: (params: any) => api.get('/fatura-kalemler/faturalar', { params }),
  getKalemler: (ettn: string) => api.get(`/fatura-kalemler/faturalar/${ettn}/kalemler`),
  matchItem: (ettn: string, sira: number, stokKartId: string) =>
    api.post(`/fatura-kalemler/faturalar/${ettn}/kalemler/${sira}/eslesdir`, { stok_kart_id: stokKartId }),
  autoMatch: (ettn: string) => api.post(`/fatura-kalemler/faturalar/${ettn}/otomatik-eslesdir`),
  // ...
};
```

---

#### stok.ts
```tsx
export const stokService = {
  getAll: (params?: any) => api.get('/stok', { params }),
  getById: (id: string) => api.get(`/stok/${id}`),
  create: (data: any) => api.post('/stok', data),
  update: (id: string, data: any) => api.put(`/stok/${id}`, data),
  delete: (id: string) => api.delete(`/stok/${id}`),
  getKategoriler: () => api.get('/stok/kategoriler'),
  transfer: (data: any) => api.post('/stok/transfer', data),
  // ...
};
```

---

#### tenders.ts
```tsx
export const tendersService = {
  getAll: (params?: any) => api.get('/tenders', { params }),
  getById: (id: string) => api.get(`/tenders/${id}`),
  create: (data: any) => api.post('/tenders', data),
  update: (id: string, data: any) => api.put(`/tenders/${id}`, data),
  delete: (id: string) => api.delete(`/tenders/${id}`),
  getDocuments: (tenderId: string) => api.get(`/tender-documents/${tenderId}`),
  generateDilekce: (data: any) => api.post('/tender-dilekce/generate', data),
  // ...
};
```

---

#### Diğer Service Dosyaları
- `demirbas.ts` - Demirbaş yönetimi
- `firmalar.ts` - Firma yönetimi
- `menu-planlama.ts` - Menü planlama
- `muhasebe.ts` - Muhasebe işlemleri
- `notes.ts` - Not yönetimi
- `scraper.ts` - Scraper yönetimi
- `urunler.ts` - Ürün yönetimi
- `ai.ts` - AI entegrasyonu

---

### API Configuration

**Dosya:** `frontend/src/lib/config.ts`

```tsx
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export const config = {
  apiUrl: API_URL,
  timeout: 30000,
  retryAttempts: 3,
  retryDelay: 1000,
};
```

---

### Error Handling

**Dosya:** `frontend/src/lib/error-handling.ts`

```tsx
export class ApiError extends Error {
  constructor(
    public status: number,
    public message: string,
    public data?: any
  ) {
    super(message);
  }
}

export const handleApiError = (error: any) => {
  if (error.response) {
    throw new ApiError(
      error.response.status,
      error.response.data.message || 'Bir hata oluştu',
      error.response.data
    );
  }
  throw new Error('Network error');
};
```

---

## Routing & Navigasyon

### Next.js App Router

**File-based Routing:**
```
app/
├── page.tsx              → /
├── giris/page.tsx        → /giris
├── admin/
│   ├── page.tsx          → /admin
│   └── kullanicilar/
│       └── page.tsx      → /admin/kullanicilar
└── muhasebe/
    ├── page.tsx          → /muhasebe
    └── faturalar/
        ├── page.tsx      → /muhasebe/faturalar
        └── [ettn]/
            └── page.tsx  → /muhasebe/faturalar/ABC123
```

---

### Dynamic Routes

**Örnek:** `app/muhasebe/faturalar/[ettn]/page.tsx`

```tsx
interface PageProps {
  params: { ettn: string };
}

export default function FaturaDetay({ params }: PageProps) {
  const { ettn } = params;
  // ...
}
```

---

### Layout Nesting

```
app/
├── layout.tsx                    # Root layout
├── admin/
│   ├── layout.tsx                # Admin layout (AdminGuard)
│   └── kullanicilar/page.tsx     # Nested inside admin layout
└── muhasebe/
    ├── layout.tsx                # (Optional) Muhasebe layout
    └── faturalar/page.tsx
```

---

### Protected Routes

**AuthGuard Kullanımı:**
```tsx
// app/muhasebe/layout.tsx
import { AuthGuard } from '@/components/AuthGuard';

export default function MuhasebeLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard requiredPermission="muhasebe:view">
      {children}
    </AuthGuard>
  );
}
```

---

## Type System

### Type Definitions (5 Dosya)

**Dizin:** `frontend/src/types/`

#### domain.ts
```tsx
export interface Personel {
  id: string;
  ad_soyad: string;
  tc_kimlik_no: string;
  telefon: string;
  email: string;
  departman: string;
  pozisyon: string;
  ise_giris_tarihi: string;
  maas: number;
  aktif: boolean;
  created_at: string;
}

export interface Proje {
  id: string;
  proje_adi: string;
  baslangic_tarihi: string;
  bitis_tarihi: string;
  sozlesme_tutari: number;
  durum: 'aktif' | 'tamamlandi' | 'iptal';
  aktif: boolean;
}

export interface StokKart {
  id: string;
  urun_kodu: string;
  urun_adi: string;
  kategori_id: string;
  birim_id: string;
  stok_miktari: number;
  birim_fiyat: number;
  min_stok: number;
  max_stok: number;
}

// ... daha fazla domain type
```

---

#### api.ts
```tsx
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiError {
  status: number;
  message: string;
  errors?: Record<string, string[]>;
}
```

---

#### notes.ts
```tsx
export interface Note {
  id: string;
  user_id: string;
  baslik: string;
  icerik: string;
  etiketler: string[];
  renk: string;
  tip: 'not' | 'gorev' | 'hatirlatma';
  durum: 'aktif' | 'tamamlandi' | 'iptal';
  oncelik: 'dusuk' | 'orta' | 'yuksek';
  bagli_modul?: string;
  bagli_kayit_id?: string;
  reminder_date?: string;
  created_at: string;
}
```

---

#### index.ts
Re-export barrel file:
```tsx
export * from './domain';
export * from './api';
export * from './notes';
```

---

#### styled-jsx.d.ts
Styled JSX type definitions

---

## Stil & Tema

### Global Styles

**Dosya:** `frontend/src/app/globals.css`

```css
@import '@mantine/core/styles.css';
@import '@mantine/dates/styles.css';
@import '@mantine/notifications/styles.css';

:root {
  --primary-color: #228be6;
  --background-color: #f8f9fa;
  --text-color: #212529;
  /* ... */
}

[data-theme='dark'] {
  --background-color: #1a1b1e;
  --text-color: #c1c2c5;
  /* ... */
}
```

---

### Mantine Theme Customization

**Dosya:** `frontend/src/components/Providers.tsx`

```tsx
import { MantineProvider } from '@mantine/core';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MantineProvider
      theme={{
        primaryColor: 'blue',
        fontFamily: 'Inter, sans-serif',
        headings: { fontFamily: 'Inter, sans-serif' },
      }}
    >
      {children}
    </MantineProvider>
  );
}
```

---

### CSS Modules

**Örnek:** `frontend/src/components/ui/StyledDatePicker.module.css`

```css
.datePicker {
  border-radius: 8px;
  border: 1px solid var(--border-color);
}

.datePicker:hover {
  border-color: var(--primary-color);
}
```

**Kullanım:**
```tsx
import styles from './StyledDatePicker.module.css';

<DatePicker className={styles.datePicker} />
```

---

## Öneriler & İyileştirmeler

### 1. Backend-Frontend Uyumsuzlukları

**Sorun:**
- Frontend bazı menü planlama conflict detection endpoint'leri bekliyor
- Calendar view API endpoint'leri eksik
- Bazı modüllerde advanced filtering bekleniyor

**Öneri:**
- Eksik backend endpoint'lerini implement et
- Frontend expectations ile backend API'yi hizala
- API contract documentation (OpenAPI/Swagger) oluştur

---

### 2. Kullanılmayan Backend Endpoint'leri

**Sorun:**
- Tazminat (severance) hesaplama UI minimal
- Görevler (tasks) sistemi incomplete
- Bazı admin notification özellikleri kullanılmıyor

**Öneri:**
- Eksik frontend sayfalarını implement et
- Kullanılmayan backend endpoint'leri sil veya frontend'i tamamla
- Feature flag sistemi ile deneysel özellikleri işaretle

---

### 3. Component Organizasyonu

**Sorun:**
- Bazı component'ler çok büyük (1000+ satır)
- Duplicated logic farklı component'lerde
- Naming conventions tutarsız

**Öneri:**
- Büyük component'leri daha küçük, reusable parçalara böl
- Shared logic için custom hook'lar oluştur
- Component naming convention guide oluştur
- Storybook ile component documentation

---

### 4. Type Safety

**Sorun:**
- Bazı API response'ları `any` type kullanıyor
- Type definitions eksik veya incomplete
- Runtime type checking yok

**Öneri:**
- Tüm API response'lar için strict typing
- Zod/Yup ile runtime validation
- API types backend'den auto-generate (openapi-typescript)

---

### 5. State Management

**Sorun:**
- Global state yönetimi sadece Context ile
- Karmaşık state için Redux/Zustand yok
- Cache management (react-query) kullanılmıyor

**Öneri:**
- React Query/SWR ile server state yönetimi
- Zustand ile client state (UI state, filters, etc.)
- Optimistic updates implementation
- Cache invalidation strategy

---

### 6. Performance

**Sorun:**
- Tüm component'ler client-side render
- No code splitting bazı route'larda
- Large bundle size

**Öneri:**
- Next.js Server Components kullan (where possible)
- Dynamic imports ile code splitting
- Image optimization (next/image)
- Bundle analyzer ile gereksiz dependency'leri tespit et

---

### 7. Testing

**Sorun:**
- Frontend test coverage düşük
- E2E test yok
- Component test'leri eksik

**Öneri:**
- Jest + React Testing Library ile unit test'ler
- Playwright/Cypress ile E2E test'ler
- Visual regression testing (Chromatic)
- Test coverage %80+ target

---

### 8. Accessibility

**Sorun:**
- ARIA attributes eksik
- Keyboard navigation incomplete
- Screen reader support limited

**Öneri:**
- WCAG 2.1 AA compliance
- axe-core ile automated a11y testing
- Keyboard navigation audit
- Focus management improvements

---

### 9. Mobile Experience

**Sorun:**
- Bazı sayfalar mobile-friendly değil
- Touch interactions limited
- Mobile navigation complex

**Öneri:**
- Mobile-first design approach
- Responsive breakpoint testing
- Touch gesture support
- Progressive Web App (PWA) features

---

### 10. Documentation

**Sorun:**
- Component documentation eksik
- Props/API documentation yok
- Usage examples limited

**Öneri:**
- JSDoc comments tüm component'lerde
- Storybook ile interactive documentation
- README dosyaları her modül için
- Architecture decision records (ADR)

---

## Frontend Metrics

| Metrik | Değer |
|--------|-------|
| Toplam Sayfa | 69 |
| Toplam Component | 95 |
| API Service Dosyaları | 14 |
| Custom Hooks | 9 |
| Context Providers | 2 |
| Type Definition Dosyaları | 5 |
| Utility Dosyaları | 28 |
| **Toplam Frontend Dosyası** | **~220** |

---

## Modül Dağılımı

| Modül | Sayfa Sayısı | Component Sayısı |
|-------|--------------|------------------|
| Admin | 13 | 10+ |
| Muhasebe | 20+ | 30+ |
| İhale | 4 | 15+ |
| AI | 2 | 8+ |
| Diğer | 30+ | 32+ |

---

**Son Güncelleme:** 2026-01-31
**Bakım:** Development Team
