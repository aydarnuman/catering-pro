# Frontend Dokümantasyonu

## 🎯 Genel Bakış

Catering Pro frontend uygulaması Next.js 14 (App Router) ile geliştirilmiştir. Mantine UI ve Tailwind CSS kullanılır.

## 🚀 Başlatma

```bash
cd frontend
npm install
npm run dev        # Development
npm run build      # Production build
npm start          # Production server
```

**Port:** 3000 (default)

---

## 📁 Klasör Yapısı

```
src/
├── app/                    # Next.js App Router
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Ana sayfa
│   ├── globals.css         # Global stiller
│   │
│   ├── admin/              # Admin paneli
│   ├── ai-chat/            # AI asistan
│   ├── ayarlar/            # Sistem ayarları
│   ├── tenders/            # İhale modülü
│   ├── upload/             # Döküman yükleme
│   ├── tracking/           # İhale takip
│   ├── planlama/           # Üretim planlama
│   │
│   └── muhasebe/           # Muhasebe modülü
│       ├── page.tsx        # Dashboard
│       ├── cariler/        # Cari hesaplar
│       ├── stok/           # Stok yönetimi
│       ├── personel/       # Personel/HR
│       ├── faturalar/      # Fatura yönetimi
│       ├── kasa-banka/     # Nakit yönetimi
│       ├── gelir-gider/    # Gelir-gider
│       ├── satin-alma/     # Satın alma
│       ├── demirbas/       # Demirbaş takibi
│       ├── menu-planlama/  # Menü planlama
│       ├── finans/         # Finansal raporlar
│       └── raporlar/       # Genel raporlar
│
├── components/             # Reusable componentler
│   ├── ui/                 # Temel UI componentleri
│   ├── muhasebe/           # Muhasebe componentleri
│   ├── tenders/            # İhale componentleri
│   └── layout/             # Layout componentleri
│
├── hooks/                  # Custom React hooks
│   ├── useApi.ts           # API çağrıları
│   ├── useAuth.ts          # Auth işlemleri
│   └── useDebounce.ts      # Debounce hook
│
├── lib/                    # Utility fonksiyonları
│   ├── api.ts              # API client
│   ├── utils.ts            # Helper fonksiyonları
│   └── format.ts           # Formatlama
│
└── types/                  # TypeScript tipleri
    ├── index.ts            # Genel tipler
    ├── cari.ts             # Cari tipleri
    └── stok.ts             # Stok tipleri
```

---

## 🎨 UI Framework

### Mantine UI
```tsx
import { Button, Card, Table, Modal } from '@mantine/core';
import { notifications } from '@mantine/notifications';
```

### Tabler Icons
```tsx
import { IconPlus, IconEdit, IconTrash } from '@tabler/icons-react';
```

### Recharts (Grafikler)
```tsx
import { BarChart, LineChart, PieChart } from 'recharts';
```

---

## 📄 Sayfa Yapısı

### Standart Sayfa Template
```tsx
'use client';

import { useState, useEffect } from 'react';
import { Container, Title, Card } from '@mantine/core';

export default function ModulPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/endpoint');
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      }
    } catch (error) {
      console.error('Hata:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Yükleniyor...</div>;

  return (
    <Container size="xl">
      <Title>Modül Başlığı</Title>
      {/* İçerik */}
    </Container>
  );
}
```

---

## 🔗 API Bağlantısı

### Fetch Kullanımı
```tsx
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// GET
const response = await fetch(`${API_URL}/api/cariler`);
const { success, data, error } = await response.json();

// POST
const response = await fetch(`${API_URL}/api/cariler`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(formData)
});
```

---

## 🧩 Component Standartları

### Naming Convention
- **Pages:** `page.tsx` (Next.js convention)
- **Components:** `PascalCase.tsx`
- **Hooks:** `useCamelCase.ts`
- **Utils:** `camelCase.ts`

### Component Yapısı
```tsx
'use client';

import { useState } from 'react';

interface Props {
  data: DataType;
  onSave: (item: DataType) => void;
}

export default function ComponentName({ data, onSave }: Props) {
  // State tanımları
  // Event handlers
  // Render
}
```

---

## 🔐 Authentication

NextAuth.js kullanılır.

```tsx
import { useSession, signIn, signOut } from 'next-auth/react';

const { data: session, status } = useSession();

if (status === 'loading') return <Loading />;
if (!session) return <Login />;
```

---

## 🎯 Modül Açıklamaları

### `/muhasebe` - Muhasebe Dashboard
Ana dashboard, özet kartlar, grafikler

### `/muhasebe/cariler` - Cari Hesaplar
Müşteri/tedarikçi yönetimi, bakiye takibi

### `/muhasebe/stok` - Stok Yönetimi
Depo, lokasyon, stok kartları, hareketler

### `/muhasebe/personel` - Personel/HR
Çalışan kayıtları, izin yönetimi, bordro

### `/muhasebe/faturalar` - Fatura Yönetimi
Alış/satış faturaları, ödeme takibi

### `/muhasebe/kasa-banka` - Nakit Yönetimi
Kasa ve banka hesapları, hareketler

### `/tenders` - İhale Takibi
İhale listesi, detay, döküman analizi

### `/ai-chat` - AI Asistan
Konuşma arayüzü, hafıza yönetimi

### `/planlama` - Üretim Planlama
Menü oluşturma, malzeme hesaplama

---

## ⚠️ Önemli Kurallar

1. **'use client'** direktifi client componentlerde zorunlu
2. **Loading states** her async işlemde göster
3. **Error handling** try-catch ile yap
4. **TypeScript** mümkün olduğunca kullan
5. **Responsive** tasarım düşün

---

## 🔧 Environment Variables

```env
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=xxx
```

---

## 🧪 Development

```bash
# Development server
npm run dev

# Type check
npm run type-check

# Lint
npm run lint

# Build test
npm run build
```
