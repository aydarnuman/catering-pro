# Frontend Dokümantasyonu

## Genel Bakis

Catering Pro frontend uygulamasi Next.js 15 (App Router) ile gelistirilmistir. Mantine UI v7 bilesen kutuphanesi kullanilir.

**Son Guncelleme:** Subat 2026

## 🚀 Başlatma

```bash
cd frontend
npm install
npm run dev        # Development (localhost:3000)
npm run build      # Production build
npm start          # Production server
```

**Port:** 3000 (default)

---

## 📁 Klasör Yapısı

```
src/
├── app/                        # Next.js App Router
│   ├── layout.tsx              # Root layout (MantineProvider, Navbar)
│   ├── page.tsx                # Ana dashboard
│   ├── globals.css             # Global stiller
│   │
│   ├── admin/                  # Admin paneli
│   │   └── page.tsx            # Admin dashboard
│   │
│   ├── ai-chat/                # AI Asistan
│   │   └── page.tsx            # AI sohbet sayfası
│   │
│   ├── ayarlar/                # Sistem Ayarları
│   │   ├── page.tsx            # Genel ayarlar
│   │   ├── api-test/           # API test sayfası
│   │   └── database-stats/     # DB istatistikleri
│   │
│   ├── tenders/                # İhale Modülü
│   │   ├── page.tsx            # İhale listesi
│   │   ├── [id]/               # Dinamik ihale detay
│   │   │   └── page.tsx
│   │   ├── upload/             # Döküman yükleme
│   │   └── tracking/           # İhale takip listesi
│   │
│   ├── upload/                 # Döküman Yükleme (Kısa yol)
│   │   └── page.tsx
│   │
│   ├── tracking/               # Takip Listesi (Kısa yol)
│   │   └── page.tsx
│   │
│   ├── planlama/               # Üretim Planlama
│   │   └── page.tsx
│   │
│   └── muhasebe/               # Muhasebe Modülü
│       ├── page.tsx            # Muhasebe dashboard
│       ├── layout.tsx          # Muhasebe layout
│       │
│       ├── cariler/            # Cari Hesaplar
│       │   ├── page.tsx        # Liste
│       │   └── [id]/           # Detay
│       │       └── page.tsx
│       │
│       ├── stok/               # Stok Yönetimi
│       │   ├── page.tsx        # Dashboard
│       │   ├── kartlar/        # Stok kartları
│       │   ├── depolar/        # Depo yönetimi
│       │   └── hareketler/     # Stok hareketleri
│       │
│       ├── personel/           # İnsan Kaynakları
│       │   ├── page.tsx        # Personel listesi
│       │   ├── [id]/           # Personel detay
│       │   │   └── page.tsx
│       │   ├── bordro/         # Bordro yönetimi
│       │   ├── izin/           # İzin takibi
│       │   ├── tazminat/       # Tazminat hesaplama
│       │   └── maas-odeme/     # Maaş ödeme
│       │
│       ├── faturalar/          # Fatura Yönetimi
│       │   └── page.tsx
│       │
│       ├── kasa-banka/         # Nakit Yönetimi
│       │   └── page.tsx
│       │
│       ├── gelir-gider/        # Gelir-Gider Takibi
│       │   └── page.tsx
│       │
│       ├── satin-alma/         # Satın Alma
│       │   └── page.tsx
│       │
│       ├── demirbas/           # Demirbaş Takibi
│       │   └── page.tsx
│       │
│       ├── projeler/           # Proje Yönetimi
│       │   ├── page.tsx
│       │   └── [id]/
│       │       └── page.tsx
│       │
│       ├── menu-planlama/      # Menü Planlama
│       │   └── page.tsx
│       │
│       ├── finans/             # Finansal Raporlar
│       │   └── page.tsx
│       │
│       └── raporlar/           # Genel Raporlar
│           └── page.tsx
│
├── components/                 # Reusable Componentler
│   ├── Navbar.tsx              # Ana navigation bar
│   ├── ClientLayout.tsx        # Client-side layout wrapper
│   ├── FloatingAIChat.tsx      # Floating AI asistan butonu
│   │
│   ├── ui/                     # Temel UI Componentleri
│   │   ├── LoadingSpinner.tsx
│   │   ├── ErrorBoundary.tsx
│   │   └── ConfirmDialog.tsx
│   │
│   ├── muhasebe/               # Muhasebe Componentleri
│   │   ├── CariForm.tsx
│   │   ├── CariTable.tsx
│   │   ├── StokKartForm.tsx
│   │   ├── PersonelForm.tsx
│   │   ├── BordroTable.tsx
│   │   └── KasaBankaForm.tsx
│   │
│   └── tenders/                # İhale Componentleri
│       ├── TenderCard.tsx
│       ├── TenderFilter.tsx
│       ├── DocumentViewer.tsx
│       ├── AnalysisPanel.tsx
│       └── TrackingForm.tsx
│
├── context/                    # React Context
│   └── AuthContext.tsx         # Authentication context & provider
│
├── hooks/                      # Custom React Hooks
│   ├── useAuth.ts              # Auth islemleri
│   ├── useDebounce.ts          # Debounce hook
│   ├── usePermissions.ts       # Modul bazli yetki kontrolu
│   └── usePagination.ts        # Pagination hook
│
├── lib/                        # Utility Fonksiyonları
│   ├── config.ts               # ⭐ API_BASE_URL ve endpoints
│   ├── api.ts                  # API client fonksiyonları
│   ├── utils.ts                # Helper fonksiyonları
│   └── format.ts               # Formatlama (para, tarih)
│
└── types/                      # TypeScript Tipleri
    ├── index.ts                # Genel tipler
    ├── cari.ts                 # Cari tipleri
    ├── stok.ts                 # Stok tipleri
    ├── personel.ts             # Personel tipleri
    ├── tender.ts               # İhale tipleri
    └── ai.ts                   # AI tipleri
```

---

## 🎨 UI Framework

### Mantine UI (v7+)
```tsx
import { 
  Button, Card, Table, Modal, TextInput, 
  Select, NumberInput, Tabs, ActionIcon,
  Group, Stack, Box, Container, Title,
  Paper, Badge, Loader, Progress
} from '@mantine/core';

import { notifications } from '@mantine/notifications';
import { DatePickerInput } from '@mantine/dates';
```

### Tabler Icons
```tsx
import { 
  IconPlus, IconEdit, IconTrash, IconSearch,
  IconFilter, IconDownload, IconUpload,
  IconCheck, IconX, IconAlertCircle
} from '@tabler/icons-react';
```

### Recharts (Grafikler)
```tsx
import { 
  BarChart, Bar, LineChart, Line, 
  PieChart, Pie, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell
} from 'recharts';
```

### TanStack React Query (Data Fetching - Yeni Kod)
```tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { API_BASE_URL } from '@/lib/config';

const { data, error, isLoading } = useQuery({
  queryKey: ['cariler'],
  queryFn: () => axios.get(`${API_BASE_URL}/api/cariler`).then(res => res.data),
});
```

> **Not:** SWR bazi eski kodlarda hala kullanilir. Yeni kod `@tanstack/react-query` kullanmalidir.

---

## 🔗 API Bağlantısı

### ONEMLI: API_BASE_URL Kullanimi

**ASLA hardcoded URL kullanmayin. Axios kullanin (fetch degil):**

```tsx
// YANLIS
fetch('http://localhost:3001/api/cariler');

// DOGRU - Axios + config.ts
import axios from 'axios';
import { API_BASE_URL } from '@/lib/config';

// GET
const res = await axios.get(`${API_BASE_URL}/api/cariler`);

// POST
const res = await axios.post(`${API_BASE_URL}/api/cariler`, formData);

// PUT
const res = await axios.put(`${API_BASE_URL}/api/cariler/${id}`, updateData);

// DELETE
const res = await axios.delete(`${API_BASE_URL}/api/cariler/${id}`);
```

> **Not:** `config.ts` runtime'da hostname'e gore API URL'sini otomatik belirler.
> `NEXT_PUBLIC_API_URL` env degiskenine ihtiyac yoktur.

---

## 📄 Sayfa Yapısı

### Standart Sayfa Template
```tsx
'use client';

import { useState, useEffect } from 'react';
import { Container, Title, Card, Group, Button, Table, LoadingOverlay } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconRefresh } from '@tabler/icons-react';
import { API_BASE_URL } from '@/lib/config';

export default function ModulPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/endpoint`);
      const json = await res.json();
      
      if (json.success) {
        setData(json.data);
      } else {
        notifications.show({
          title: 'Hata',
          message: json.error || 'Veri yüklenemedi',
          color: 'red'
        });
      }
    } catch (error) {
      notifications.show({
        title: 'Hata',
        message: 'Sunucuya bağlanılamadı',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container size="xl" py="md">
      <Group justify="space-between" mb="md">
        <Title order={2}>Modül Başlığı</Title>
        <Group>
          <Button leftSection={<IconRefresh size={16} />} variant="light" onClick={fetchData}>
            Yenile
          </Button>
          <Button leftSection={<IconPlus size={16} />}>
            Yeni Ekle
          </Button>
        </Group>
      </Group>
      
      <Card withBorder pos="relative">
        <LoadingOverlay visible={loading} />
        <Table striped highlightOnHover>
          {/* Tablo içeriği */}
        </Table>
      </Card>
    </Container>
  );
}
```

---

## 🧩 Component Standartları

### Naming Convention
- **Pages:** `page.tsx` (Next.js convention)
- **Components:** `PascalCase.tsx`
- **Hooks:** `useCamelCase.ts`
- **Utils:** `camelCase.ts`
- **Types:** `PascalCase` (interface/type)

### Component Yapısı
```tsx
'use client';

import { useState } from 'react';
import { Modal, TextInput, Button, Group, Stack } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { API_BASE_URL } from '@/lib/config';

interface FormData {
  unvan: string;
  tip: 'musteri' | 'tedarikci';
  vergi_no?: string;
}

interface Props {
  opened: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: FormData;
}

export default function CariForm({ opened, onClose, onSuccess, initialData }: Props) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<FormData>(initialData || { unvan: '', tip: 'musteri' });

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/cariler`, {
        method: initialData ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      
      const json = await res.json();
      
      if (json.success) {
        notifications.show({ title: 'Başarılı', message: 'Kaydedildi', color: 'green' });
        onSuccess();
        onClose();
      } else {
        notifications.show({ title: 'Hata', message: json.error, color: 'red' });
      }
    } catch (error) {
      notifications.show({ title: 'Hata', message: 'Sunucu hatası', color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Cari Hesap">
      <Stack>
        <TextInput
          label="Ünvan"
          required
          value={form.unvan}
          onChange={(e) => setForm({ ...form, unvan: e.target.value })}
        />
        {/* Diğer alanlar */}
        <Group justify="flex-end">
          <Button variant="light" onClick={onClose}>İptal</Button>
          <Button loading={loading} onClick={handleSubmit}>Kaydet</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
```

---

## Authentication (Custom JWT + PostgreSQL)

> **Supabase Auth KULLANILMIYOR.** Auth tamamen custom JWT + bcrypt + HttpOnly cookie tabanli.

### Auth Mimarisi

```
Frontend                          Backend
--------                          -------
AuthContext.tsx (state)       -->  POST /api/auth/login (bcrypt + JWT)
middleware.ts (route guard)  -->  Cookie: access_token (24 saat)
AuthGuard.tsx (component)    -->  Cookie: refresh_token (30 gun)
AdminGuard.tsx (admin)       -->  authenticate middleware (JWT verify)
usePermissions.ts (RBAC)     -->  requirePermission middleware
```

### AuthContext Kullanimi
```tsx
import { useAuth } from '@/context/AuthContext';

function MyComponent() {
  const { user, isAuthenticated, isAdmin, isSuperAdmin, login, logout } = useAuth();

  // Login
  const result = await login('email@example.com', 'password');
  if (result.success) { /* basarili */ }

  // User bilgisi
  // user.id, user.email, user.name, user.role, user.user_type
}
```

### Route Korumasi (3 Katman)

1. **middleware.ts** - Server-side: `access_token` cookie varligini kontrol eder, yoksa `/giris`'e yonlendirir
2. **AuthGuard** - Client-side: Auth olmayan kullaniciya login modal acar
3. **AdminGuard** - Client-side: Admin olmayan kullaniciya "Erisim Reddedildi" gosterir

### Yetki Kontrolu
```tsx
import { usePermissions } from '@/hooks/usePermissions';

function MyPage() {
  const { can, canView, canCreate, canEdit, canDelete, isSuperAdmin } = usePermissions();

  if (!canView('fatura')) return <div>Yetkiniz yok</div>;
  if (can('stok', 'create')) { /* stok olusturabilir */ }
}
```

---

## 🎯 Modül Açıklamaları

### Ana Dashboard (`/`)
- KPI kartları (ihale, cari, personel, stok)
- Hızlı işlem butonları
- Yaklaşan ihaleler
- Kullanıcı notları
- Sistem durumu
- AI tavsiyeleri

### İhale Modülü (`/tenders`)
- İhale listesi (filtreleme, arama)
- İhale detay sayfası
- Döküman yükleme & AI analizi
- Takip listesi yönetimi
- Teklif hazırlama

### Muhasebe Dashboard (`/muhasebe`)
- Finansal özet kartları
- Gelir-gider grafiği
- Gider dağılımı
- Son işlemler
- Yaklaşan ödemeler

### Cari Hesaplar (`/muhasebe/cariler`)
- Müşteri/tedarikçi listesi
- Bakiye takibi
- Cari hareketleri
- Mutabakat raporu

### Personel/HR (`/muhasebe/personel`)
- Personel listesi
- Bordro hesaplama
- İzin yönetimi
- Tazminat hesaplama
- Maaş ödeme takibi

### AI Asistan (`/ai-chat`)
- Sohbet arayüzü (streaming)
- Hafıza yönetimi
- Sistem entegrasyonu (tool calling)
- Prompt şablonları

---

## ⚠️ Önemli Kurallar

1. **'use client'** direktifi client componentlerde zorunlu
2. **API_BASE_URL** her zaman `lib/config.ts`'den import edilmeli
3. **Loading states** her async işlemde gösterilmeli
4. **Error handling** try-catch ile yapılmalı
5. **TypeScript** mümkün olduğunca kullanılmalı
6. **Responsive** tasarım düşünülmeli
7. **notifications** kullanıcı bilgilendirmesi için kullanılmalı

---

## Environment Variables

```env
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:3001  # Optional - config.ts otomatik belirler

# Supabase (Sadece Realtime icin - Auth KULLANILMIYOR)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_ENABLE_REALTIME=true
```

> **Not:** NextAuth (NEXTAUTH_URL, NEXTAUTH_SECRET) bu projede kullanilmiyor.
> Auth sistemi custom JWT + HttpOnly cookie tabanlidir. Detay: `src/context/AuthContext.tsx`

---

## 🧪 Development

```bash
# Development server
npm run dev

# Type check
npm run type-check

# Lint (Biome)
npm run lint

# Build test
npm run build
```

---

## Bagimliliklar

| Paket | Versiyon | Aciklama |
|-------|----------|----------|
| next | ^15.5 | React framework (App Router) |
| react | ^18.3 | UI library |
| @mantine/core | ^7.17 | UI components |
| @mantine/hooks | ^7.17 | React hooks |
| @mantine/notifications | ^7.17 | Toast notifications |
| @mantine/dates | ^7.17 | Date pickers |
| @mantine/form | ^7.17 | Form yonetimi |
| @tabler/icons-react | ^3.35 | Icon library |
| @tanstack/react-query | ^5.17 | Server state management |
| recharts | ^2.15 | Grafikler |
| axios | ^1.13 | HTTP client |
| socket.io-client | ^4.8 | Real-time (Realtime icin) |
| @biomejs/biome | ^2.3 | Linter & Formatter |

> **Not:** Tailwind CSS bu projede KULLANILMIYOR. Stil yonetimi Mantine props ile yapilir.
