# Admin Panel Geliştirme ve Entegrasyon Planı

## 📊 Mevcut Durum Analizi (28 Ocak 2026)

### ✅ Tam Çalışan Özellikler

| Özellik | Dosya | Durum |
|---------|-------|-------|
| Admin Dashboard | `app/admin/page.tsx` | İstatistikler, 30s refresh |
| Bildirim Sistemi | `components/NotificationDropdown.tsx` | 60s polling |
| Global Arama | `components/SearchModal.tsx` | Cmd+K, kategoriler |
| Tema Sistemi | `components/ThemeProvider.tsx` | Dark/Light toggle |
| Export | `lib/export.ts` | CSV, Excel, PDF |
| Mobile Utils | `lib/mobile.ts` | Responsive helpers |
| Loading States | `components/LoadingState.tsx` | Çoklu varyant |

### ⚠️ Kısmi Mevcut (Geliştirilmeli)

| Özellik | Mevcut | Eksik |
|---------|--------|-------|
| Hotkey Sistemi | Cmd+K | Cmd+S, Cmd+N, Esc, vb. |
| Onay Diyalogları | `window.confirm()` | Styled Mantine Modal |
| Sayfalama | Bazı listelerde | Loglar, aktiviteler |

### ❌ Eksik Özellikler

| Özellik | Öncelik | Tahmini Süre |
|---------|---------|--------------|
| Kullanıcı Arama/Filtre | Yüksek | - |
| Toplu İşlemler | Orta | - |
| Dashboard Grafikleri | Düşük | - |
| WebSocket Bildirimler | Düşük | - |

---

## 🎯 Entegrasyon Planı

### Faz 1: Hızlı Kazanımlar (Öncelik: Yüksek)

#### 1.1 Kullanıcı Arama ve Filtreleme
**Dosya:** `app/admin/users/page.tsx`

```typescript
// Eklenecek state'ler
const [searchQuery, setSearchQuery] = useState('');
const [roleFilter, setRoleFilter] = useState<string | null>(null);
const [statusFilter, setStatusFilter] = useState<string | null>(null);

// Filtrelenmiş kullanıcılar
const filteredUsers = useMemo(() => {
  return users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = !roleFilter || user.role === roleFilter;
    const matchesStatus = statusFilter === null ||
                         (statusFilter === 'active' ? user.is_active : !user.is_active);
    return matchesSearch && matchesRole && matchesStatus;
  });
}, [users, searchQuery, roleFilter, statusFilter]);
```

**UI Bileşenleri:**
- TextInput (arama)
- Select (rol filtresi)
- SegmentedControl (aktif/pasif)

#### 1.2 Styled Onay Diyaloğu
**Yeni Dosya:** `components/ConfirmDialog.tsx`

```typescript
interface ConfirmDialogProps {
  opened: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  loading?: boolean;
}
```

**Kullanım:**
- Silme işlemleri: `variant="danger"`
- God Mode: `variant="warning"`
- Bilgilendirme: `variant="info"`

#### 1.3 Genişletilmiş Hotkey Sistemi
**Dosya:** `app/layout.tsx` veya yeni `hooks/useHotkeys.ts`

```typescript
const HOTKEYS = {
  'mod+K': () => openSearch(),
  'mod+S': () => saveChanges(),
  'mod+N': () => createNew(),
  'Escape': () => closeModals(),
  'mod+Shift+D': () => toggleTheme(),
};
```

---

### Faz 2: Orta Vadeli Geliştirmeler

#### 2.1 Toplu İşlemler (Bulk Operations)
**Dosya:** `app/admin/users/page.tsx`

```typescript
const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());

// Toplu işlem butonları
<Button.Group>
  <Button onClick={() => bulkActivate(selectedUsers)}>Toplu Aktif Et</Button>
  <Button onClick={() => bulkDeactivate(selectedUsers)}>Toplu Pasif Et</Button>
  <Button color="red" onClick={() => bulkDelete(selectedUsers)}>Toplu Sil</Button>
</Button.Group>
```

#### 2.2 Sayfalama Komponenti
**Dosya:** `components/DataPagination.tsx`

```typescript
interface PaginationProps {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}
```

---

### Faz 3: Uzun Vadeli Geliştirmeler

#### 3.1 Dashboard Grafikleri
**Kütüphane:** `@mantine/charts` veya `recharts`

```typescript
// Örnek grafikler
- Aylık ihale sayısı (LineChart)
- Kullanıcı aktivitesi (BarChart)
- Durum dağılımı (PieChart)
```

#### 3.2 WebSocket Bildirimler
**Backend:** Socket.io veya native WebSocket
**Frontend:** Gerçek zamanlı bildirim güncellemesi

---

## 📁 Dosya Yapısı (Önerilen)

```
frontend/src/
├── components/
│   ├── admin/
│   │   ├── UserFilters.tsx      # YENİ
│   │   ├── BulkActions.tsx      # YENİ
│   │   └── UserTable.tsx        # YENİ
│   ├── ConfirmDialog.tsx        # YENİ
│   └── DataPagination.tsx       # YENİ
├── hooks/
│   ├── useHotkeys.ts            # YENİ
│   └── useBulkSelect.ts         # YENİ
└── lib/
    └── hotkeys.ts               # YENİ
```

---

## ✅ Uygulama Kontrol Listesi

### Faz 1
- [ ] Kullanıcı arama input'u ekle
- [ ] Rol filtresi ekle
- [ ] Durum filtresi ekle
- [ ] ConfirmDialog komponenti oluştur
- [ ] Silme işlemlerinde ConfirmDialog kullan
- [ ] God Mode için ConfirmDialog kullan
- [ ] Hotkey sistemi genişlet

### Faz 2
- [ ] Checkbox ile çoklu seçim
- [ ] Toplu işlem butonları
- [ ] Sayfalama komponenti

### Faz 3
- [ ] Chart kütüphanesi ekle
- [ ] Dashboard grafikleri
- [ ] WebSocket altyapısı

---

## 🔧 Teknik Notlar

### Mevcut Bağımlılıklar (Kullanılacak)
- `@mantine/core` - UI bileşenleri
- `@mantine/hooks` - useHotkeys, useDisclosure
- `@tabler/icons-react` - İkonlar

### Eklenecek Bağımlılıklar
- `@mantine/charts` - Grafikler için (Faz 3)

### Stil Kuralları
- Mevcut Mantine tema kullanılacak
- Dark/Light mode uyumlu
- Mobile responsive
