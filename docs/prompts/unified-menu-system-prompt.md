# 🍽️ BİRLEŞİK MENÜ PLANLAMA SİSTEMİ - GELİŞTİRME PROMPT'U

## 📌 Proje Özeti

Catering Pro uygulamasında şu anda **4 farklı sayfada dağınık** olan menü planlama, reçete yönetimi ve ürün kartları sistemini **tek bir gelişmiş sayfada** birleştirmek istiyoruz.

### Mevcut Durum (Sorunlar)
- `/muhasebe/menu-planlama/` - ~2800 satır (çok büyük)
- `/muhasebe/menu-planlama-takvim/` - Ayrı sayfa
- `/muhasebe/stok/` - Ürün kartları burada (~2361 satır)
- `/muhasebe/fiyat-yonetimi/` - Ayrı sayfa
- `ReceteModal` (~2359 satır) ve `UrunKartlariModal` (~1249 satır) - Modal içinde modal açılıyor
- Kullanıcı sürekli sayfalar arası geçiş yapıyor

### Hedef
Tek bir `/muhasebe/uretim-merkezi/` (veya `/muhasebe/menu-yonetimi/`) sayfası oluşturmak.

---

## 🏗️ MİMARİ TASARIM

### 1. Genel Layout Yapısı

```
┌─────────────────────────────────────────────────────────────────┐
│                        HEADER                                    │
│  [🍽️ Üretim Merkezi]              [🔍 Global Arama] [👤 Profil] │
├──────────┬──────────────────────────────────────────────────────┤
│ SIDEBAR  │                    ANA İÇERİK                        │
│ (240px)  │  ┌─────────────────────────────────────────────────┐ │
│          │  │ CONTEXT TABS (seçili modüle göre değişir)       │ │
│ ▼ Ürünler│  ├─────────────────────────────────────────────────┤ │
│ ▼ Reçete │  │                                                 │ │
│ ▼ Menü   │  │              ESNEK PANEL ALANI                  │ │
│ ▼ Takvim │  │                                                 │ │
│          │  │  (Paneller açılıp kapanabilir,                  │ │
│ ─────────│  │   yeniden boyutlandırılabilir)                  │ │
│ 🛒 Sepet │  │                                                 │ │
│ ⭐ Favori│  │                                                 │ │
│ 🕐 Son   │  │                                                 │ │
└──────────┴──┴─────────────────────────────────────────────────┘ │
```

### 2. Sidebar Navigasyon Yapısı

```typescript
interface SidebarSection {
  id: 'urunler' | 'receteler' | 'menu' | 'takvim';
  icon: IconType;
  label: string;
  badge?: number; // Bildirim sayısı
  subItems?: SidebarSubItem[];
}

const sidebarSections: SidebarSection[] = [
  {
    id: 'urunler',
    icon: IconPackage,
    label: 'Ürün Kartları',
    badge: kritikStokSayisi,
    subItems: [
      { id: 'tum', label: 'Tüm Ürünler' },
      { id: 'kategoriler', label: 'Kategoriler' },
      { id: 'kritik', label: 'Kritik Stok', badge: 5 },
    ]
  },
  {
    id: 'receteler',
    icon: IconChefHat,
    label: 'Reçeteler',
    subItems: [
      { id: 'tum', label: 'Tüm Reçeteler' },
      { id: 'kategoriler', label: 'Kategoriler' },
      { id: 'eksik', label: 'Maliyeti Eksik', badge: 12 },
    ]
  },
  {
    id: 'menu',
    icon: IconCalendarEvent,
    label: 'Menü Planlama',
    subItems: [
      { id: 'gunluk', label: 'Günlük Menü' },
      { id: 'haftalik', label: 'Haftalık Menü' },
      { id: 'maliyet', label: 'Maliyet Analizi' },
    ]
  },
  {
    id: 'takvim',
    icon: IconCalendar,
    label: 'Takvim',
  },
];

// Alt bölüm: Hızlı Erişim
const quickAccess = [
  { id: 'sepet', icon: IconShoppingCart, label: 'Sepet', count: 8 },
  { id: 'favoriler', icon: IconStar, label: 'Favoriler' },
  { id: 'son', icon: IconHistory, label: 'Son Kullanılanlar' },
];
```

### 3. Bağlam Tab'ları (Context Tabs)

Her modül seçildiğinde ana alanda farklı tab'lar görünür:

```typescript
const contextTabs: Record<SidebarSection['id'], Tab[]> = {
  urunler: [
    { id: 'liste', label: 'Liste', icon: IconList },
    { id: 'kartlar', label: 'Kartlar', icon: IconLayoutGrid },
    { id: 'fiyatlar', label: 'Fiyatlar', icon: IconCoin },
    { id: 'stok', label: 'Stok Durumu', icon: IconChartBar },
  ],
  receteler: [
    { id: 'liste', label: 'Liste', icon: IconList },
    { id: 'kategoriler', label: 'Kategoriler', icon: IconCategory },
    { id: 'maliyet', label: 'Maliyet', icon: IconCalculator },
    { id: 'ai', label: 'AI Önerileri', icon: IconSparkles },
  ],
  menu: [
    { id: 'sepet', label: 'Seçili Yemekler', icon: IconShoppingCart },
    { id: 'analiz', label: 'Maliyet Analizi', icon: IconChartPie },
    { id: 'karsilastir', label: 'Fiyat Karşılaştırma', icon: IconScale },
  ],
  takvim: [
    { id: 'gun', label: 'Günlük', icon: IconCalendarDay },
    { id: 'hafta', label: 'Haftalık', icon: IconCalendarWeek },
    { id: 'ay', label: 'Aylık', icon: IconCalendarMonth },
  ],
};
```

### 4. Esnek Panel Sistemi

```typescript
interface PanelConfig {
  id: string;
  title: string;
  defaultWidth: number | 'auto';
  minWidth: number;
  maxWidth: number;
  collapsible: boolean;
  resizable: boolean;
  defaultVisible: boolean;
  position: 'left' | 'center' | 'right';
}

// Örnek panel konfigürasyonları
const panelConfigs: Record<string, PanelConfig[]> = {
  'urunler-liste': [
    { 
      id: 'kategori-filter', 
      title: 'Kategoriler', 
      defaultWidth: 200, 
      minWidth: 150, 
      maxWidth: 300,
      collapsible: true,
      resizable: true,
      defaultVisible: true,
      position: 'left'
    },
    { 
      id: 'urun-liste', 
      title: 'Ürünler', 
      defaultWidth: 'auto', 
      minWidth: 400, 
      maxWidth: Infinity,
      collapsible: false,
      resizable: true,
      defaultVisible: true,
      position: 'center'
    },
    { 
      id: 'urun-detay', 
      title: 'Detay', 
      defaultWidth: 350, 
      minWidth: 300, 
      maxWidth: 500,
      collapsible: true,
      resizable: true,
      defaultVisible: false, // Ürün seçilince açılır
      position: 'right'
    },
  ],
  'receteler-liste': [
    // Benzer yapı...
  ],
};
```

---

## 🎯 FONKSİYONEL GEREKSİNİMLER

### 1. Ürün Kartları Modülü

#### Mevcut Özellikler (Korunacak)
- [x] Ürün CRUD işlemleri
- [x] Kategori filtreleme
- [x] Arama (ad, kod, barkod)
- [x] Stok durumu gösterimi (normal, düşük, kritik, fazla, tükenmiş)
- [x] Fiyat geçmişi
- [x] Depo bazlı stok görünümü
- [x] Varyant sistemi
- [x] Tedarikçi eşleştirme
- [x] Fatura entegrasyonu

#### Yeni/Geliştirilecek
- [ ] Sürükle-bırak ile kategorilere taşıma
- [ ] Toplu düzenleme (bulk edit)
- [ ] Ürün birleştirme (duplikeleri merge)
- [ ] Hızlı fiyat güncelleme

### 2. Reçete Modülü

#### Mevcut Özellikler (Korunacak)
- [x] Reçete CRUD
- [x] Malzeme yönetimi (ekleme, düzenleme, silme)
- [x] Maliyet hesaplama (sistem fiyatı, piyasa fiyatı)
- [x] AI malzeme önerisi
- [x] Toplu AI reçetelendirme
- [x] Birim dönüşümleri (g, kg, ml, lt, adet)
- [x] Porsiyon hesaplama

#### Yeni/Geliştirilecek
- [ ] Reçeteden direkt ürün kartı oluşturma
- [ ] Malzeme sürükle-bırak sıralama
- [ ] Reçete kopyalama/şablondan oluşturma
- [ ] Besin değerleri otomatik hesaplama

### 3. Menü Planlama Modülü

#### Mevcut Özellikler (Korunacak)
- [x] Sepet sistemi (localStorage ile persist)
- [x] Kategori bazlı reçete seçimi
- [x] Kişi sayısına göre maliyet hesaplama
- [x] Fatura vs Piyasa fiyat karşılaştırma
- [x] Fiyat trend grafikleri

#### Yeni/Geliştirilecek
- [ ] Sürükle-bırak ile sepete ekleme
- [ ] Sepetten direkt takvime ekleme
- [ ] Menü şablonları (haftalık, aylık)
- [ ] Maliyet uyarıları (bütçe aşımı)

### 4. Takvim Modülü

#### Mevcut Özellikler (Korunacak)
- [x] FullCalendar entegrasyonu
- [x] Günlük/Haftalık görünüm
- [x] Öğün tipleri (Kahvaltı, Öğle, Akşam, Ara öğün, Gece)
- [x] Kişi sayısı yönetimi
- [x] Maliyet özeti

#### Yeni/Geliştirilecek
- [ ] Aylık görünüm
- [ ] Sürükle-bırak ile öğün taşıma
- [ ] Reçete listesinden takvime sürükle-bırak
- [ ] Haftalık tekrarlama

---

## 📱 MOBİL RESPONSIVE TASARIM

### Breakpoint Stratejisi

```typescript
const breakpoints = {
  mobile: 0,      // 0-767px
  tablet: 768,    // 768-1023px
  desktop: 1024,  // 1024-1439px
  wide: 1440,     // 1440px+
};

// Mobil davranışlar
const mobileLayout = {
  sidebar: 'drawer', // Mobilde sidebar drawer olur
  panels: 'stacked', // Paneller üst üste yığılır
  tabs: 'scrollable', // Tab'lar yatay scroll
  detailView: 'fullscreen', // Detay tam ekran açılır
};
```

### Mobil UI Kuralları

1. **Sidebar**: Hamburger menü ile açılan drawer
2. **Tab'lar**: Yatay kaydırılabilir
3. **Paneller**: Tek sütun, dikey sıralı
4. **Detay**: Tam ekran modal/drawer
5. **Aksiyonlar**: Bottom sheet veya FAB

---

## 🔄 STATE YÖNETİMİ

### localStorage Yapısı

```typescript
interface UretimMerkeziState {
  // Navigasyon durumu
  activeSection: 'urunler' | 'receteler' | 'menu' | 'takvim';
  activeSubSection: string | null;
  activeTab: string;
  
  // Panel durumları
  panels: {
    [panelId: string]: {
      visible: boolean;
      width: number;
      collapsed: boolean;
    };
  };
  
  // Filtreler
  filters: {
    urunler: { kategori: number | null; arama: string; durum: string };
    receteler: { kategori: number | null; arama: string };
  };
  
  // Seçimler
  selectedItems: {
    urun: number | null;
    recete: number | null;
  };
  
  // Sepet (mevcut)
  menuSepet: SeciliYemek[];
  kisiSayisi: number;
  
  // Favoriler
  favoriteRecipes: number[];
  favoriteProducts: number[];
  
  // Son kullanılanlar
  recentRecipes: number[];
  recentProducts: number[];
}

// localStorage key
const STORAGE_KEY = 'uretim-merkezi-state';
```

### React Query Entegrasyonu

```typescript
// Query key'ler
const queryKeys = {
  urunler: ['urunler'] as const,
  urun: (id: number) => ['urun', id] as const,
  urunKategorileri: ['urun-kategorileri'] as const,
  
  receteler: ['receteler'] as const,
  recete: (id: number) => ['recete', id] as const,
  receteKategorileri: ['recete-kategorileri'] as const,
  
  menuPlan: (params: MenuPlanParams) => ['menu-plan', params] as const,
};

// Lazy loading için prefetch stratejisi
const prefetchOnHover = async (queryClient: QueryClient, section: string) => {
  // Mouse hover'da prefetch başlat
  switch (section) {
    case 'urunler':
      queryClient.prefetchQuery({ queryKey: queryKeys.urunler });
      queryClient.prefetchQuery({ queryKey: queryKeys.urunKategorileri });
      break;
    case 'receteler':
      queryClient.prefetchQuery({ queryKey: queryKeys.receteler });
      queryClient.prefetchQuery({ queryKey: queryKeys.receteKategorileri });
      break;
  }
};
```

---

## 📁 DOSYA YAPISI

```
frontend/src/app/muhasebe/uretim-merkezi/
├── page.tsx                    # Ana sayfa
├── layout.tsx                  # Layout wrapper
├── components/
│   ├── Sidebar/
│   │   ├── Sidebar.tsx
│   │   ├── SidebarSection.tsx
│   │   ├── SidebarItem.tsx
│   │   └── QuickAccess.tsx
│   ├── Panels/
│   │   ├── PanelContainer.tsx  # Resizable panel container
│   │   ├── Panel.tsx           # Single panel component
│   │   └── PanelResizer.tsx    # Panel resize handle
│   ├── Urunler/
│   │   ├── UrunListesi.tsx
│   │   ├── UrunKartlari.tsx    # Grid view
│   │   ├── UrunDetay.tsx
│   │   ├── UrunForm.tsx
│   │   ├── KategoriFilter.tsx
│   │   └── FiyatGecmisi.tsx
│   ├── Receteler/
│   │   ├── ReceteListesi.tsx
│   │   ├── ReceteDetay.tsx
│   │   ├── ReceteForm.tsx
│   │   ├── MalzemeListesi.tsx
│   │   ├── MalzemeForm.tsx
│   │   ├── MaliyetKarti.tsx
│   │   └── AiOneriler.tsx
│   ├── MenuPlanlama/
│   │   ├── Sepet.tsx
│   │   ├── YemekSecici.tsx
│   │   ├── MaliyetAnalizi.tsx
│   │   ├── FiyatKarsilastirma.tsx
│   │   └── GrafikPanel.tsx
│   ├── Takvim/
│   │   ├── MenuTakvim.tsx
│   │   ├── GunlukGorunum.tsx
│   │   ├── OgunKarti.tsx
│   │   └── YemekEkleModal.tsx
│   └── shared/
│       ├── ContextTabs.tsx
│       ├── SearchBar.tsx
│       ├── EmptyState.tsx
│       └── LoadingState.tsx
├── hooks/
│   ├── useUretimState.ts       # Merkezi state hook
│   ├── usePanelResize.ts       # Panel resize logic
│   ├── useUrunler.ts
│   ├── useReceteler.ts
│   ├── useMenuPlanlama.ts
│   └── useTakvim.ts
├── store/
│   └── uretimStore.ts          # Zustand veya context
├── types/
│   └── index.ts
└── utils/
    ├── localStorage.ts
    └── panelHelpers.ts
```

---

## 🎨 UI/UX KURALLARI

### 1. Akıllı Etkileşim (Smart Interaction)

```typescript
// Duruma göre en uygun UI seçimi
const getInteractionType = (context: InteractionContext): 'modal' | 'drawer' | 'inline' | 'split' => {
  const { screenWidth, currentSection, action, itemCount } = context;
  
  // Mobilde her zaman drawer/modal
  if (screenWidth < 768) {
    return action === 'select' ? 'drawer' : 'modal';
  }
  
  // Tekli seçim: inline panel
  if (action === 'select' && itemCount === 1) {
    return 'inline';
  }
  
  // Çoklu seçim: modal
  if (action === 'select' && itemCount > 5) {
    return 'modal';
  }
  
  // Form işlemleri: drawer
  if (action === 'edit' || action === 'create') {
    return 'drawer';
  }
  
  // Karşılaştırma: split view
  if (action === 'compare') {
    return 'split';
  }
  
  return 'inline';
};
```

### 2. Görsel Tutarlılık

- **Renkler**: Mantine tema renkleri
- **İkonlar**: Tabler Icons (mevcut)
- **Spacing**: Mantine spacing scale (xs, sm, md, lg, xl)
- **Shadows**: Mantine shadow scale
- **Radius**: Mantine radius scale

### 3. Animasyonlar

```typescript
// Framer Motion ile smooth geçişler
const panelVariants = {
  hidden: { width: 0, opacity: 0 },
  visible: { width: 'auto', opacity: 1 },
  collapsed: { width: 48, opacity: 1 },
};

const listItemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};
```

---

## ⚡ PERFORMANS OPTİMİZASYONLARI

### 1. Lazy Loading

```typescript
// Next.js dynamic import
const UrunlerPanel = dynamic(() => import('./components/Urunler/UrunListesi'), {
  loading: () => <LoadingState />,
  ssr: false,
});

const TakvimPanel = dynamic(() => import('./components/Takvim/MenuTakvim'), {
  loading: () => <LoadingState />,
  ssr: false,
});
```

### 2. Virtual Scrolling

```typescript
// Uzun listeler için @tanstack/react-virtual
import { useVirtualizer } from '@tanstack/react-virtual';

const UrunListesi = ({ urunler }: Props) => {
  const parentRef = useRef<HTMLDivElement>(null);
  
  const virtualizer = useVirtualizer({
    count: urunler.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60, // Satır yüksekliği
    overscan: 5,
  });
  
  // ...
};
```

### 3. Memoization

```typescript
// Ağır hesaplamalar için useMemo
const hesaplananMaliyet = useMemo(() => {
  return seciliYemekler.reduce((toplam, yemek) => {
    return toplam + hesaplaMaliyet(yemek, kisiSayisi);
  }, 0);
}, [seciliYemekler, kisiSayisi]);

// Callback'ler için useCallback
const handleUrunSelect = useCallback((urunId: number) => {
  setSelectedUrun(urunId);
  openPanel('urun-detay');
}, []);
```

---

## 🔗 API ENTEGRASYONLARİ

### Mevcut Endpoint'ler (Kullanılacak)

```typescript
// Ürünler
GET  /api/urunler
GET  /api/urunler/:id
POST /api/urunler
PUT  /api/urunler/:id
DELETE /api/urunler/:id
GET  /api/urunler/kategoriler/liste

// Reçeteler
GET  /api/menu-planlama/receteler
GET  /api/menu-planlama/receteler/:id
POST /api/menu-planlama/receteler
PUT  /api/menu-planlama/receteler/:id
DELETE /api/menu-planlama/receteler/:id
GET  /api/menu-planlama/kategoriler

// Malzemeler
POST /api/menu-planlama/receteler/:id/malzemeler
PUT  /api/menu-planlama/malzemeler/:id
DELETE /api/menu-planlama/malzemeler/:id

// Menü Planlama
GET  /api/menu-planlama/menu-plan
POST /api/menu-planlama/menu-plan/yemek-ekle
GET  /api/menu-planlama/menu-planlari/:planId/gunluk-ozet

// AI
POST /api/menu-planlama/receteler/:id/ai-malzeme-oneri
POST /api/menu-planlama/receteler/batch-ai-malzeme-oneri
```

---

## 🧪 TEST SENARYOLARI

### 1. Kullanıcı Akışı Testleri

```typescript
describe('Üretim Merkezi', () => {
  it('Reçete oluşturma akışı', async () => {
    // 1. Reçeteler bölümüne git
    // 2. Yeni reçete oluştur
    // 3. Ürün kartlarından malzeme ekle
    // 4. Maliyet hesaplandığını doğrula
    // 5. Menü sepetine ekle
    // 6. Takvime planla
  });

  it('Mobil navigasyon', async () => {
    // 1. Hamburger menüyü aç
    // 2. Bölüm seç
    // 3. Drawer kapansın
    // 4. İçerik yüklensin
  });
});
```

### 2. Performans Testleri

- 1000+ ürün ile liste performansı
- Panel resize smooth olmalı
- Tab değişimi < 100ms
- İlk yükleme < 2s

---

## 📝 UYGULAMA ADIMLARI

### Faz 1: Temel Yapı (1-2 gün)
1. [ ] Sayfa ve layout oluştur
2. [ ] Sidebar navigasyon
3. [ ] Panel sistemi (resizable)
4. [ ] State management setup
5. [ ] localStorage persistence

### Faz 2: Ürün Kartları Modülü (1 gün)
1. [ ] Mevcut UrunKartlariModal'ı panel'e dönüştür
2. [ ] Liste/Kart görünümleri
3. [ ] Kategori filtresi
4. [ ] Detay paneli

### Faz 3: Reçete Modülü (1-2 gün)
1. [ ] Mevcut ReceteModal'ı panel'e dönüştür
2. [ ] Malzeme yönetimi inline
3. [ ] Maliyet hesaplama
4. [ ] AI önerileri

### Faz 4: Menü Planlama Modülü (1 gün)
1. [ ] Sepet sistemi entegrasyonu
2. [ ] Yemek seçici
3. [ ] Maliyet analizi grafikleri

### Faz 5: Takvim Modülü (1 gün)
1. [ ] FullCalendar entegrasyonu
2. [ ] Öğün yönetimi
3. [ ] Drag-drop desteği

### Faz 6: Mobil Optimizasyon (1 gün)
1. [ ] Responsive breakpoint'ler
2. [ ] Drawer/bottom sheet
3. [ ] Touch optimizasyonlar

### Faz 7: Polish & Test (1 gün)
1. [ ] Animasyonlar
2. [ ] Loading states
3. [ ] Error handling
4. [ ] Performance tuning

---

## ⚠️ DİKKAT EDİLECEKLER

1. **Mevcut API'leri değiştirme** - Backend'de değişiklik yapma
2. **Mevcut verileri koru** - localStorage migration
3. **Geriye uyumluluk** - Eski sayfalar geçici olarak çalışmaya devam etsin
4. **Incremental migration** - Tek seferde değil, adım adım taşı

---

## 🎯 BAŞARI KRİTERLERİ

1. ✅ Tüm mevcut özellikler çalışıyor
2. ✅ Tek sayfada tüm modüller erişilebilir
3. ✅ Mobilde tam kullanılabilir
4. ✅ Sayfa yükleme < 2 saniye
5. ✅ Panel geçişleri smooth
6. ✅ State persist çalışıyor
7. ✅ Kod modüler ve bakımı kolay

---

## 📚 REFERANSLAR

- [Mantine UI Docs](https://mantine.dev/)
- [FullCalendar React](https://fullcalendar.io/docs/react)
- [TanStack Virtual](https://tanstack.com/virtual)
- [React Resizable Panels](https://react-resizable-panels.vercel.app/)
