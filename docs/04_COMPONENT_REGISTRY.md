# 🧩 Bileşen Kayıt Defteri (Component Registry)

> Konum: `/frontend/src/components`  
> Son Güncelleme: 27 Ocak 2026

---

## 📋 İçindekiler

| Kategori | Bileşen Sayısı |
|----------|----------------|
| [Layout & Navigation](#1-layout--navigation) | 6 |
| [AI & Chat](#2-ai--chat) | 5 |
| [Data Display](#3-data-display) | 6 |
| [Forms & Modals](#4-forms--modals) | 8 |
| [Notifications](#5-notifications--status) | 3 |
| [External Integrations](#6-external-integrations) | 3 |
| [Domain-Specific](#7-domain-specific) | 6 klasör |

**Toplam: 35+ bileşen**

---

## 1. Layout & Navigation

### `AppLayout.tsx`
Ana uygulama layout wrapper

```typescript
// Kullanım
import { AppLayout } from '@/components';

<AppLayout>
  <YourContent />
</AppLayout>
```

**Props:**
| Prop | Tip | Default | Açıklama |
|------|-----|---------|----------|
| children | ReactNode | - | İçerik |

---

### `ClientLayout.tsx`
Client-side rendering için layout

```typescript
// app/layout.tsx içinde kullanılır
import ClientLayout from '@/components/ClientLayout';

export default function RootLayout({ children }) {
  return <ClientLayout>{children}</ClientLayout>;
}
```

---

### `Navbar.tsx`
Üst navigasyon çubuğu

**Özellikler:**
- Logo ve başlık
- Ana menü linkleri
- Kullanıcı dropdown
- Bildirim ikonu
- Tema değiştirici

---

### `MobileSidebar.tsx`
Mobil cihazlar için yan menü

**Özellikler:**
- Hamburger menü
- Drawer navigasyon
- Responsive

---

### `AdminGuard.tsx`
Admin sayfaları için koruma HOC

```typescript
// Kullanım
import { AdminGuard } from '@/components';

export default function AdminPage() {
  return (
    <AdminGuard>
      <AdminContent />
    </AdminGuard>
  );
}
```

**Davranış:**
- `role !== 'admin'` → Login sayfasına yönlendir
- Loading state göster

---

### `Providers.tsx`
React context provider'ları wrapper

```typescript
// Sağlanan Context'ler
- QueryClientProvider (React Query)
- MantineProvider (UI)
- AuthProvider (Kimlik)
- RealtimeProvider (Supabase)
```

---

## 2. AI & Chat

### `AIChat.tsx`
Ana AI sohbet bileşeni

```typescript
import { AIChat } from '@/components';

<AIChat 
  conversationId="conv-123"
  onClose={() => setOpen(false)}
/>
```

**Props:**
| Prop | Tip | Default | Açıklama |
|------|-----|---------|----------|
| conversationId | string | - | Konuşma ID |
| context | object | - | Ek context |
| onClose | function | - | Kapatma callback |

**Özellikler:**
- Streaming response
- Tool calling desteği
- Mesaj geçmişi
- Markdown rendering

---

### `FloatingAIChat.tsx`
Floating chat widget

```typescript
// Otomatik olarak AppLayout'ta render edilir
// Sağ alt köşede floating buton
```

**Özellikler:**
- Minimizable
- Draggable (opsiyonel)
- Persistent state

---

### `ChatHistory/`
Sohbet geçmişi bileşenleri

```
ChatHistory/
├── index.tsx
├── ConversationList.tsx
├── MessageBubble.tsx
└── ChatInput.tsx
```

---

### `IhaleUzmaniModal.tsx`
İhale analiz modal

```typescript
import { IhaleUzmaniModal } from '@/components';

<IhaleUzmaniModal
  isOpen={open}
  onClose={() => setOpen(false)}
  tenderId={123}
/>
```

**Props:**
| Prop | Tip | Açıklama |
|------|-----|----------|
| isOpen | boolean | Modal açık mı |
| onClose | function | Kapatma |
| tenderId | number | İhale ID |
| documentId | number | Belge ID (opsiyonel) |

---

### `IhaleUzmani/`
İhale uzmanı alt bileşenleri

```
IhaleUzmani/
├── index.tsx
├── AnalysisPanel.tsx
├── RiskAssessment.tsx
├── CostEstimate.tsx
└── BidSuggestion.tsx
```

---

## 3. Data Display

### `ResponsiveTable.tsx`
Responsive veri tablosu

```typescript
import { ResponsiveTable } from '@/components';

<ResponsiveTable
  columns={[
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Ad' },
    { key: 'status', label: 'Durum' }
  ]}
  data={items}
  onRowClick={(row) => handleClick(row)}
/>
```

**Props:**
| Prop | Tip | Default | Açıklama |
|------|-----|---------|----------|
| columns | Column[] | - | Kolon tanımları |
| data | any[] | - | Veri dizisi |
| loading | boolean | false | Yükleniyor mu |
| onRowClick | function | - | Satır tıklama |
| selectable | boolean | false | Seçilebilir mi |
| pagination | boolean | true | Sayfalama |
| pageSize | number | 10 | Sayfa boyutu |

**Column Tipi:**
```typescript
interface Column {
  key: string;
  label: string;
  render?: (value: any, row: any) => ReactNode;
  sortable?: boolean;
  width?: number | string;
}
```

---

### `ResponsiveModal.tsx`
Responsive modal wrapper

```typescript
import { ResponsiveModal } from '@/components';

<ResponsiveModal
  opened={isOpen}
  onClose={handleClose}
  title="Modal Başlık"
  size="lg"
>
  <ModalContent />
</ResponsiveModal>
```

**Props:**
| Prop | Tip | Default | Açıklama |
|------|-----|---------|----------|
| opened | boolean | - | Açık mı |
| onClose | function | - | Kapatma |
| title | string | - | Başlık |
| size | string | 'md' | xs/sm/md/lg/xl/full |
| fullScreen | boolean | false | Tam ekran (mobil) |

---

### `DataActions.tsx`
Veri aksiyonları toolbar

```typescript
import { DataActions } from '@/components';

<DataActions
  onAdd={() => setShowAdd(true)}
  onExport={() => handleExport()}
  onImport={() => handleImport()}
  onRefresh={() => refetch()}
/>
```

---

### `SearchModal.tsx`
Global arama modalı

```typescript
// Ctrl+K veya Navbar'dan açılır
<SearchModal
  isOpen={searchOpen}
  onClose={() => setSearchOpen(false)}
/>
```

**Özellikler:**
- Global arama
- Kategori filtreleme
- Keyboard shortcuts
- Son aramalar

---

### `ExportModal.tsx`
Dışa aktarma modalı

```typescript
<ExportModal
  isOpen={exportOpen}
  onClose={() => setExportOpen(false)}
  module="tenders"
  filters={currentFilters}
/>
```

**Desteklenen Formatlar:**
- Excel (.xlsx)
- CSV
- PDF

---

### `ImportModal.tsx`
İçe aktarma modalı

```typescript
<ImportModal
  isOpen={importOpen}
  onClose={() => setImportOpen(false)}
  module="cariler"
  onSuccess={() => refetch()}
/>
```

---

## 4. Forms & Modals

### `BordroImportModal.tsx`
Bordro import modalı

```typescript
<BordroImportModal
  isOpen={open}
  onClose={handleClose}
  onSuccess={handleSuccess}
/>
```

**Özellikler:**
- Excel dosyası yükleme
- Şablon indirme
- Önizleme
- Validasyon

---

### `ReceteDetayModal.tsx`
Reçete detay modalı (malzemeler, gramaj karşılaştırma, maliyet analizi)

```typescript
<ReceteDetayModal
  opened={open}
  onClose={handleClose}
  receteId={editId}
  isMobile={isMobile}
  isMounted={isMounted}
/>
```

---

### `TenderMapModal.tsx`
İhale harita modalı

```typescript
<TenderMapModal
  isOpen={open}
  onClose={handleClose}
  tenders={tenderList}
/>
```

**Özellikler:**
- Türkiye haritası
- Şehir bazlı ihale gösterimi
- Clustering
- Popup detaylar

---

### `UrunDetayModal.tsx`
Ürün detay modalı

```typescript
<UrunDetayModal
  isOpen={open}
  onClose={handleClose}
  urunId={selectedId}
/>
```

---

### `UrunKartlariModal.tsx`
Ürün kartları seçim modalı

```typescript
<UrunKartlariModal
  isOpen={open}
  onClose={handleClose}
  onSelect={(urun) => handleSelect(urun)}
  multiSelect={false}
/>
```

---

### `ErrorBoundary.tsx`
Hata yakalama bileşeni

```typescript
<ErrorBoundary fallback={<ErrorFallback />}>
  <RiskyComponent />
</ErrorBoundary>
```

---

## 5. Notifications & Status

### `NotificationDropdown.tsx`
Bildirim dropdown menüsü

```typescript
// Navbar içinde kullanılır
<NotificationDropdown />
```

**Özellikler:**
- Okunmamış sayacı
- Bildirim listesi
- Okundu işaretleme
- Tümünü okundu

---

### `RealtimeIndicator.tsx`
Realtime bağlantı göstergesi

```typescript
<RealtimeIndicator />
```

**Durumlar:**
- 🟢 Bağlı
- 🟡 Bağlanıyor
- 🔴 Bağlantı kesildi

---

### `WhatsAppNavButton.tsx`
WhatsApp navigasyon butonu

```typescript
<WhatsAppNavButton 
  unreadCount={5}
  onClick={() => navigate('/sosyal-medya')}
/>
```

---

## 6. External Integrations

### `WhatsAppWidget/`
WhatsApp widget bileşenleri

```
WhatsAppWidget/
├── index.tsx
├── ChatList.tsx
├── MessageView.tsx
└── SendMessage.tsx
```

**Özellikler:**
- Mesaj listesi
- Mesaj gönderme
- Medya desteği
- Status gösterimi

---

### `GodModeTerminal/`
Admin terminal bileşeni

```
GodModeTerminal/
├── index.tsx
├── Terminal.tsx
├── CommandHistory.tsx
└── OutputPanel.tsx
```

**Özellikler:**
- Komut satırı arayüzü
- SQL sorguları
- Sistem komutları
- Output formatting

---

### `PromptBuilder/`
AI prompt builder

```
PromptBuilder/
├── index.tsx
├── TemplateEditor.tsx
├── VariablePanel.tsx
└── PreviewPanel.tsx
```

---

## 7. Domain-Specific

### `common/`
Ortak kullanılan küçük bileşenler

```
common/
├── LoadingSpinner.tsx
├── EmptyState.tsx
├── ConfirmDialog.tsx
├── Badge.tsx
├── StatusBadge.tsx
├── DatePicker.tsx
├── MoneyInput.tsx
└── FileUpload.tsx
```

---

### `mobile/`
Mobil özel bileşenler

```
mobile/
├── MobileNav.tsx
├── MobileTable.tsx
├── MobileCard.tsx
├── SwipeableRow.tsx
└── BottomSheet.tsx
```

---

### `muhasebe/`
Muhasebe modülü bileşenleri

```
muhasebe/
├── CariForm.tsx
├── CariCard.tsx
├── FaturaForm.tsx
├── FaturaKalemTable.tsx
├── StokForm.tsx
├── StokHareketForm.tsx
├── BordroTable.tsx
├── BordroForm.tsx
├── KasaBankaWidget.tsx
├── GelirGiderChart.tsx
└── MaliyetAnalizi.tsx
```

---

### `teklif/`
Teklif bileşenleri

```
teklif/
├── TeklifForm.tsx
├── BirimFiyatTable.tsx
├── TeklifPDF.tsx
└── TeklifKarsilastirma.tsx
```

---

### `ui/`
UI primitives (Mantine üzeri)

```
ui/
├── Button.tsx
├── Card.tsx
├── Input.tsx
├── Select.tsx
├── Table.tsx
├── Tabs.tsx
└── Tooltip.tsx
```

---

### `NotesSection/`
Not bileşenleri

```
NotesSection/
├── index.tsx
├── NoteList.tsx
├── NoteForm.tsx
└── NoteCard.tsx
```

---

## 🪝 Custom Hooks

### `useLocalStorage.ts`
LocalStorage yönetimi

```typescript
const [value, setValue] = useLocalStorage('key', defaultValue);
```

---

### `usePermissions.ts`
Yetki kontrolü

```typescript
const { hasPermission, isAdmin } = usePermissions();

if (hasPermission('cariler.create')) {
  // ...
}
```

---

### `useRealtimeSubscription.ts`
Supabase realtime subscription

```typescript
useRealtimeSubscription('tenders', (payload) => {
  console.log('Change:', payload);
  refetch();
});
```

---

### `useResponsive.ts`
Responsive breakpoint kontrolü

```typescript
const { isMobile, isTablet, isDesktop } = useResponsive();
```

---

### `usePromptBuilder.ts`
Prompt builder hook'u

```typescript
const { templates, generatePrompt } = usePromptBuilder();
```

---

### `useWhatsAppSocket.ts`
WhatsApp WebSocket bağlantısı

```typescript
const { connected, messages, sendMessage } = useWhatsAppSocket();
```

---

## 🔐 Context'ler

### `AuthContext.tsx` ⛔ KRİTİK

```typescript
// Kullanım
const { user, login, logout, isAuthenticated } = useAuth();
```

**Sağlanan Değerler:**
| Değer | Tip | Açıklama |
|-------|-----|----------|
| user | User | null | Mevcut kullanıcı |
| isAuthenticated | boolean | Giriş yapılmış mı |
| isLoading | boolean | Auth yükleniyor |
| login | function | Giriş fonksiyonu |
| logout | function | Çıkış fonksiyonu |
| refreshToken | function | Token yenile |

---

### `RealtimeContext.tsx`

```typescript
const { isConnected, subscribe, unsubscribe } = useRealtime();
```

---

## 📦 Index Export

```typescript
// components/index.ts
export { AppLayout } from './AppLayout';
export { AdminGuard } from './AdminGuard';
export { AIChat } from './AIChat';
export { ResponsiveTable } from './ResponsiveTable';
export { ResponsiveModal } from './ResponsiveModal';
// ... diğer exportlar
```

---

## 🎨 Styling Conventions

### CSS Modules
```typescript
import styles from './Component.module.css';

<div className={styles.container}>
```

### Mantine Styles
```typescript
<Box sx={(theme) => ({
  padding: theme.spacing.md,
  backgroundColor: theme.colors.gray[0]
})}>
```

### Tailwind (sınırlı kullanım)
```typescript
<div className="flex items-center gap-2">
```

---

## 📝 Bileşen Şablonu

Yeni bileşen oluştururken:

```typescript
// components/NewComponent.tsx
'use client';

import { FC, useState } from 'react';
import { Box, Text } from '@mantine/core';

interface NewComponentProps {
  title: string;
  onAction?: () => void;
}

export const NewComponent: FC<NewComponentProps> = ({ 
  title, 
  onAction 
}) => {
  const [state, setState] = useState(false);

  return (
    <Box p="md">
      <Text>{title}</Text>
    </Box>
  );
};

export default NewComponent;
```

---

*Bu döküman frontend/src/components klasöründen derlenmiştir.*
