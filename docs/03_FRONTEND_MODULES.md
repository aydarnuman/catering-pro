# 🎨 Frontend Modüller

> Framework: Next.js 15 (App Router)  
> UI Library: Mantine UI 7.17  
> Port: 3000  
> Son Güncelleme: 27 Ocak 2026

---

## 📋 Modül İndeksi

| # | Modül | Route | Sayfa Sayısı | Durum |
|---|-------|-------|--------------|-------|
| 1 | [Dashboard](#1-dashboard) | `/` | 1 | ✅ |
| 2 | [Admin](#2-admin-paneli) | `/admin/*` | 11 | ✅ |
| 3 | [Muhasebe](#3-muhasebe-modülü) | `/muhasebe/*` | 12 | ✅ |
| 4 | [İhaleler](#4-i̇haleler) | `/tenders/*` | 2 | ✅ |
| 5 | [AI Chat](#5-ai-chat) | `/ai-chat` | 1 | ✅ |
| 6 | [Planlama](#6-planlama) | `/planlama` | 1 | ✅ |
| 7 | [İhale Uzmanı](#7-i̇hale-uzmanı) | `/ihale-uzmani` | 1 | ✅ |
| 8 | [Tracking](#8-tracking) | `/tracking` | 1 | ✅ |
| 9 | [Profil](#9-profil) | `/profil` | 1 | ✅ |
| 10 | [Ayarlar](#10-ayarlar) | `/ayarlar` | 1 | ✅ |
| 11 | [Sosyal Medya](#11-sosyal-medya) | `/sosyal-medya` | 1 | ✅ |
| 12 | [Giriş](#12-giriş) | `/giris` | 1 | ✅ |

**Toplam: 34 sayfa**

---

## Genel Yapı

```
frontend/src/app/
├── page.tsx              # Dashboard
├── layout.tsx            # Root Layout
├── globals.css
├── error.tsx             # Error Boundary
├── not-found.tsx         # 404
├── global-error.tsx
│
├── admin/               # Admin Paneli
├── ai-chat/             # AI Sohbet
├── ayarlar/             # Ayarlar
├── giris/               # Login
├── ihale-uzmani/        # İhale Uzmanı
├── muhasebe/            # Muhasebe Ana Modül
├── planlama/            # Planlama
├── profil/              # Kullanıcı Profili
├── sosyal-medya/        # Sosyal Medya
├── tenders/             # İhaleler
├── tracking/            # İhale Takip
└── upload/              # Dosya Yükleme
```

---

## 1. Dashboard

**Route:** `/`  
**Dosya:** `app/page.tsx`

### Özellikler
- Özet istatistikler (kartlar)
- Son ihaleler listesi
- Kritik stok uyarıları
- Bekleyen faturalar
- Hızlı erişim linkleri

### Kullanılan API'ler
- `GET /api/tenders?limit=5`
- `GET /api/invoices/stats`
- `GET /api/stok?kritik=true`
- `GET /api/notifications`

---

## 2. Admin Paneli

**Route:** `/admin/*`  
**Koruma:** `AdminGuard` HOC + role="admin"

### Alt Sayfalar

| Route | Dosya | Açıklama |
|-------|-------|----------|
| `/admin` | `admin/page.tsx` | Admin dashboard |
| `/admin/kullanicilar` | `admin/kullanicilar/page.tsx` | Kullanıcı yönetimi |
| `/admin/yetkiler` | `admin/yetkiler/page.tsx` | Yetki yönetimi |
| `/admin/yetki-sablonlari` | `admin/yetki-sablonlari/page.tsx` | Yetki şablonları |
| `/admin/loglar` | `admin/loglar/page.tsx` | Sistem logları |
| `/admin/sistem` | `admin/sistem/page.tsx` | Sistem ayarları |
| `/admin/sync` | `admin/sync/page.tsx` | Senkronizasyon |
| `/admin/scraper` | `admin/scraper/page.tsx` | Scraper yönetimi |
| `/admin/ip-management` | `admin/ip-management/page.tsx` | IP erişim kontrolü |
| `/admin/prompt-builder` | `admin/prompt-builder/page.tsx` | AI prompt yönetimi |
| `/admin/god-mode` | `admin/god-mode/page.tsx` | Süper admin terminali |

### Özel Bileşenler
- `GodModeTerminal/` - Terminal UI
- `PromptBuilder/` - Prompt düzenleyici

---

## 3. Muhasebe Modülü

**Route:** `/muhasebe/*`  
**En büyük modül - 12 alt sayfa**

### Alt Sayfalar

| Route | Dosya | Açıklama | Satır |
|-------|-------|----------|-------|
| `/muhasebe` | `page.tsx` | Muhasebe dashboard | ~200 |
| `/muhasebe/cariler` | `cariler/page.tsx` | Cari hesaplar | ~800 |
| `/muhasebe/faturalar` | `faturalar/page.tsx` | Fatura listesi | ~1500 |
| `/muhasebe/faturalar/[ettn]` | `faturalar/[ettn]/page.tsx` | Fatura detay | ~600 |
| `/muhasebe/stok` | `stok/page.tsx` | Stok yönetimi | ⚠️ **3800+** |
| `/muhasebe/personel` | `personel/page.tsx` | Personel/Bordro | ~1200 |
| `/muhasebe/kasa-banka` | `kasa-banka/page.tsx` | Kasa/Banka | ~600 |
| `/muhasebe/gelir-gider` | `gelir-gider/page.tsx` | Gelir/Gider | ~500 |
| `/muhasebe/demirbas` | `demirbas/page.tsx` | Demirbaş | ~400 |
| `/muhasebe/satin-alma` | `satin-alma/page.tsx` | Satın alma | ~700 |
| `/muhasebe/menu-planlama` | `menu-planlama/page.tsx` | Menü planlama | ~900 |
| `/muhasebe/raporlar` | `raporlar/page.tsx` | Finansal raporlar | ~400 |
| `/muhasebe/finans` | `finans/page.tsx` | Finans özeti | ~300 |

### ⚠️ Refactoring Gerekli
- `stok/page.tsx` → 3800+ satır, bileşenlere ayrılmalı
- `faturalar/page.tsx` → 1500+ satır, parçalanabilir

### Muhasebe Özel Bileşenleri
```
components/muhasebe/
├── CariForm.tsx
├── FaturaForm.tsx
├── StokForm.tsx
├── BordroTable.tsx
├── KasaBankaWidget.tsx
└── ...
```

---

## 4. İhaleler

**Route:** `/tenders/*`

### Sayfalar

| Route | Dosya | Açıklama |
|-------|-------|----------|
| `/tenders` | `tenders/page.tsx` | İhale listesi |
| `/tenders/[id]` | `tenders/[id]/page.tsx` | İhale detay |

### Özellikler
- İhale listesi (filtreleme, arama)
- İhale detay sayfası
- Belge yükleme ve analiz
- Teklif hazırlama
- Takip listesine ekleme

### Kullanılan Bileşenler
- `TenderMapModal` - İhale haritası
- `IhaleUzmaniModal` - AI analiz
- `NotesSection/` - Not ekleme

---

## 5. AI Chat

**Route:** `/ai-chat`  
**Dosya:** `ai-chat/page.tsx`

### Özellikler
- Claude AI ile sohbet
- Streaming response
- Tool calling (sistem entegrasyonu)
- Konuşma geçmişi
- Floating chat widget

### Bileşenler
- `AIChat.tsx` - Ana chat componenti
- `FloatingAIChat.tsx` - Floating widget
- `ChatHistory/` - Geçmiş yönetimi

---

## 6. Planlama

**Route:** `/planlama`  
**Dosya:** `planlama/page.tsx`

### Özellikler
- Haftalık üretim planı
- Takvim görünümü
- Reçete seçimi
- Porsiyon hesaplama
- Malzeme ihtiyaç listesi

---

## 7. İhale Uzmanı

**Route:** `/ihale-uzmani`  
**Dosya:** `ihale-uzmani/page.tsx`

### Özellikler
- İhale belgesi analizi (AI)
- Şartname özeti
- Risk analizi
- Maliyet tahmini
- Teklif önerisi

### Bileşenler
- `IhaleUzmani/` - Alt bileşenler
- `IhaleUzmaniModal.tsx` - Modal wrapper

---

## 8. Tracking

**Route:** `/tracking`  
**Dosya:** `/tracking/page.tsx`

### Özellikler
- İhale takip listesi
- Durum yönetimi (pipeline)
- Öncelik belirleme
- Hatırlatıcılar
- Son tarih takibi

---

## 9. Profil

**Route:** `/profil`  
**Dosya:** `profil/page.tsx`

### Özellikler
- Kullanıcı bilgileri
- Şifre değiştirme
- Tercihler
- Bildirim ayarları

---

## 10. Ayarlar

**Route:** `/ayarlar`  
**Dosya:** `ayarlar/page.tsx`

### Özellikler
- Uygulama ayarları
- Tema seçimi
- Dil ayarları
- API konfigürasyonu

---

## 11. Sosyal Medya

**Route:** `/sosyal-medya`  
**Dosya:** `sosyal-medya/page.tsx`

### Özellikler
- WhatsApp entegrasyonu
- Instagram entegrasyonu
- Mesaj yönetimi

### Harici Servisler
- `/services/whatsapp/`
- `/services/instagram/`

---

## 12. Giriş

**Route:** `/giris`  
**Dosya:** `giris/page.tsx`

### Özellikler
- Login formu
- JWT authentication
- "Beni hatırla" özelliği
- Şifremi unuttum

---

## 🔐 Middleware & Auth

**Dosya:** `middleware.ts`

### Korumalı Route'lar
```typescript
const protectedRoutes = [
  '/admin',
  '/muhasebe/personel',
  '/ayarlar',
  '/profil'
];

const adminRoutes = [
  '/admin/*'
];
```

### Public Route'lar
```typescript
const publicRoutes = [
  '/giris',
  '/api/*',
  '/_next/*'
];
```

---

## 📱 Responsive Design

### Breakpoints (Mantine)
| Breakpoint | Genişlik |
|------------|----------|
| xs | < 576px |
| sm | ≥ 576px |
| md | ≥ 768px |
| lg | ≥ 992px |
| xl | ≥ 1200px |

### Mobil Bileşenler
```
components/mobile/
├── MobileNav.tsx
├── MobileTable.tsx
└── MobileCard.tsx
```

---

## 🎨 Tema & Styling

### Mantine Theme
```typescript
// lib/theme.ts
const theme = createTheme({
  primaryColor: 'blue',
  fontFamily: 'Inter, sans-serif',
  // ...
});
```

### Global CSS
- `globals.css` - Global stiller
- Mantine CSS variables
- Custom utility classes

---

## 📊 State Management

### React Query
Tüm API çağrıları React Query ile yönetilir:
```typescript
const { data, isLoading } = useQuery({
  queryKey: ['tenders'],
  queryFn: () => api.get('/tenders')
});
```

### Context
- `AuthContext` - Kimlik doğrulama
- `RealtimeContext` - Supabase realtime

### Local State
- `useState` - Bileşen state'i
- `useReducer` - Kompleks state
- `useLocalStorage` - Persistent state

---

## 🔄 Data Flow

```
┌─────────────────────────────────────────────────────┐
│                    Page Component                    │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌─────────────┐    ┌─────────────┐                 │
│  │ React Query │◄───│   API Lib   │                 │
│  │   (Cache)   │    │  (Fetch)    │                 │
│  └──────┬──────┘    └──────┬──────┘                 │
│         │                   │                        │
│         ▼                   ▼                        │
│  ┌─────────────────────────────────────────┐        │
│  │              Components                  │        │
│  │   ┌─────────┐  ┌─────────┐  ┌────────┐ │        │
│  │   │ Tables  │  │ Forms   │  │ Modals │ │        │
│  │   └─────────┘  └─────────┘  └────────┘ │        │
│  └─────────────────────────────────────────┘        │
│                                                      │
└─────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────┐
│                   Backend API                        │
│                   (Port 3001)                        │
└─────────────────────────────────────────────────────┘
```

---

## 📝 Sayfa Şablonu

Yeni sayfa oluştururken bu şablonu kullanın:

```typescript
// app/yeni-modul/page.tsx
'use client';

import { useState } from 'react';
import { Container, Title, Paper } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export default function YeniModulPage() {
  const [filters, setFilters] = useState({});
  
  const { data, isLoading, error } = useQuery({
    queryKey: ['yeni-modul', filters],
    queryFn: () => api.get('/api/yeni-modul', { params: filters })
  });

  if (isLoading) return <div>Yükleniyor...</div>;
  if (error) return <div>Hata: {error.message}</div>;

  return (
    <Container size="xl" py="md">
      <Title order={2} mb="lg">Yeni Modül</Title>
      <Paper p="md" shadow="xs">
        {/* İçerik */}
      </Paper>
    </Container>
  );
}
```

---

*Bu döküman frontend/src/app klasöründen derlenmiştir.*
