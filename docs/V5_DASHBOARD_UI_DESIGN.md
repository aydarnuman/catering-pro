# V5 AI Özellikleri - İhale Merkezi Entegrasyon Planı

> **Hedef:** Mevcut `ihale-merkezi` layout'una entegrasyon
> **Framework:** Next.js 15 + Mantine UI 7.17
> **Prensip:** Yeni sayfa YOK, mevcut yapıya ekleme

---

## Mevcut Yapı Analizi

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         IhaleMerkeziLayout                                   │
├────────────┬───────────────────────────────────┬─────────────────────────────┤
│ LeftPanel  │         CenterPanel               │        RightPanel           │
│ (300px)    │         (flexible)                │        (420px)              │
│            │                                   │                             │
│ İhale      │  Tabs:                            │  Tabs:                      │
│ Listesi    │  • Özet                           │  • Araçlar                  │
│  ┌───────┐ │    ├─ Analiz Kartları (4 adet)   │  • Dilekçe                  │
│  │tender │ │    │   Teknik/Birim/Metin/Döküman│  • Teklif                   │
│  │tender │ │    └─ İhale Bilgileri            │  • Tespit ←─ SuggestionsTab │
│  │tender │ │  • Dökümanlar                    │                             │
│  │  ...  │ │  • Notlar                        │                             │
│  └───────┘ │                                   │                             │
└────────────┴───────────────────────────────────┴─────────────────────────────┘
```

**Mevcut Dosyalar:**
- `CenterPanel/CenterPanel.tsx` - Özet, Dökümanlar, Notlar tab'ları
- `RightPanel/RightPanel.tsx` - Araçlar, Dilekçe, Teklif, Tespit tab'ları
- `RightPanel/SuggestionsTab.tsx` - Tespit edilen değerler ve öneriler

---

## V5 Entegrasyon Planı

| Özellik | Nereye? | Dosya |
|---------|---------|-------|
| **Anomaly Detection** | RightPanel → Tespit tab | `SuggestionsTab.tsx` |
| **Deep Table Schema** | CenterPanel → Özet içi modal | `CenterPanel.tsx` + yeni modal |
| **Field Dependency** | RightPanel → Yeni "Bağımlılık" tab | `RightPanel.tsx` + yeni component |
| **Doküman Kümeleme** | LeftPanel filtre + Analiz wizard | `LeftPanel.tsx` + `DocumentWizardModal.tsx` |

---

## 1. Anomaly Detection → SuggestionsTab Entegrasyonu

**Dosya:** `frontend/src/components/ihale-merkezi/RightPanel/SuggestionsTab.tsx`

### Mevcut Durum

```
┌─────────────────────────────────────────────────────┐
│ Tespit Tabı (MEVCUT)                               │
├─────────────────────────────────────────────────────┤
│                                                     │
│  📊 TESPİT EDİLEN DEĞERLER                         │
│  ┌───────────────────────────────────────────┐     │
│  │ ☑ Yaklaşık Maliyet    45.000.000 [Şartname]│     │
│  │ ☑ Kişi Sayısı         1250       [Analiz] │     │
│  │ ☑ Öğün Sayısı         4          [Analiz] │     │
│  └───────────────────────────────────────────┘     │
│                                                     │
│  [Seçilenleri Uygula]                              │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### V5 Sonrası

```
┌─────────────────────────────────────────────────────┐
│ Tespit Tabı (V5)                                   │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ⚠️ ANOMALİ UYARILARI                   [2 uyarı] │
│  ┌───────────────────────────────────────────┐     │
│  │ 🔴 kisi_sayisi: 50000                     │     │
│  │    Beklenen aralık: 50 - 2500             │     │
│  │    Z-score: 15.2 (kritik)                 │     │
│  │    [Düzelt] [Yoksay] [Doğru]              │     │
│  ├───────────────────────────────────────────┤     │
│  │ ⚠️ iscilik_orani: %45                     │     │
│  │    Beklenen aralık: %15 - %40             │     │
│  │    Z-score: 2.1 (uyarı)                   │     │
│  │    [Düzelt] [Yoksay] [Doğru]              │     │
│  └───────────────────────────────────────────┘     │
│                                                     │
│  ─────────────────────────────────────────────────  │
│                                                     │
│  📊 TESPİT EDİLEN DEĞERLER                [5 adet] │
│  ┌───────────────────────────────────────────┐     │
│  │ ☑ Yaklaşık Maliyet    45.000.000 [Şartname]│     │
│  │ ☑ Kişi Sayısı         1250 ✓     [Analiz] │     │
│  │ ☑ Öğün Sayısı         4          [Analiz] │     │
│  │ ☐ İşçilik Oranı       %27        [Analiz] │     │
│  └───────────────────────────────────────────┘     │
│                                                     │
│  [Seçilenleri Uygula]                              │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Yeni Component

```tsx
// frontend/src/components/ihale-merkezi/RightPanel/AnomalyWarnings.tsx

interface Anomaly {
  field: string;
  value: number | string;
  expectedMin: number;
  expectedMax: number;
  zScore: number;
  severity: 'warning' | 'critical';
}

interface AnomalyWarningsProps {
  anomalies: Anomaly[];
  onFix: (field: string) => void;
  onIgnore: (field: string) => void;
  onConfirm: (field: string) => void;
}

export function AnomalyWarnings({ anomalies, onFix, onIgnore, onConfirm }: AnomalyWarningsProps) {
  if (anomalies.length === 0) return null;
  
  return (
    <Paper p="sm" withBorder radius="md" bg="dark.7" mb="md">
      <Group justify="space-between" mb="xs">
        <Group gap="xs">
          <IconAlertTriangle size={16} color="orange" />
          <Text size="sm" fw={600}>Anomali Uyarıları</Text>
        </Group>
        <Badge color="orange" size="sm">{anomalies.length}</Badge>
      </Group>
      
      <Stack gap="xs">
        {anomalies.map((a) => (
          <Paper key={a.field} p="xs" withBorder radius="sm" 
            style={{ borderColor: a.severity === 'critical' ? 'red' : 'orange' }}>
            
            <Group justify="space-between">
              <Group gap="xs">
                {a.severity === 'critical' 
                  ? <ThemeIcon color="red" size="sm"><IconX size={12}/></ThemeIcon>
                  : <ThemeIcon color="orange" size="sm"><IconAlertTriangle size={12}/></ThemeIcon>
                }
                <Text size="sm" fw={500}>{a.field}: {a.value}</Text>
              </Group>
            </Group>
            
            <Text size="xs" c="dimmed" ml={24}>
              Beklenen: {a.expectedMin} - {a.expectedMax} | Z-score: {a.zScore.toFixed(1)}
            </Text>
            
            <Group gap="xs" mt="xs" ml={24}>
              <Button size="xs" variant="light" color="blue" onClick={() => onFix(a.field)}>
                Düzelt
              </Button>
              <Button size="xs" variant="subtle" color="gray" onClick={() => onIgnore(a.field)}>
                Yoksay
              </Button>
              <Button size="xs" variant="subtle" color="green" onClick={() => onConfirm(a.field)}>
                Doğru
              </Button>
            </Group>
          </Paper>
        ))}
      </Stack>
    </Paper>
  );
}
```

---

## 2. Deep Table Schema → CenterPanel Modal

**Dosya:** `frontend/src/components/ihale-merkezi/CenterPanel/CenterPanel.tsx`

### Mevcut Durum

CenterPanel'de zaten "Teknik Şartlar" ve "Birim Fiyatlar" kartlarına tıklayınca modal açılıyor.

### V5 Ekleme

"Teknik Şart" modal içine tablo analizi ekle:

```
┌─────────────────────────────────────────────────────────┐
│ Teknik Şartlar Modal (V5)                         [✕]  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  SEGMENT CONTROL:  [Liste]  [Tablo Analizi]            │
│                                                         │
│  ─────────────────────────────────────────────────────  │
│                                                         │
│  TABLO ANALİZİ (segment="Tablo Analizi" seçildiğinde)  │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 📊 Gramaj Tablosu (Sayfa 5)                     │   │
│  │ 25 satır × 4 sütun                              │   │
│  │                                                  │   │
│  │ Sütunlar:                                       │   │
│  │ • Yemek Adı   [TEXT]     25 unique              │   │
│  │ • Porsiyon    [INTEGER]  50-250g                │   │
│  │ • Kişi Başı   [INTEGER]  gram                   │   │
│  │ • Toplam      [FORMULA]  hesaplanan             │   │
│  │                                                  │   │
│  │ İlişkiler:                                      │   │
│  │ → Haftalık Menü ile %85 benzerlik               │   │
│  │                                                  │   │
│  │ [Tabloyu Görüntüle]                             │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 📊 Personel Tablosu (Sayfa 8)                   │   │
│  │ 12 satır × 5 sütun                              │   │
│  │ ...                                             │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Field Dependency → RightPanel Yeni Tab

**Dosya:** `frontend/src/components/ihale-merkezi/RightPanel/RightPanel.tsx`

### Mevcut Tab'lar

```tsx
<Tabs.List grow>
  <Tabs.Tab value="araclar">Araçlar</Tabs.Tab>
  <Tabs.Tab value="dilekce">Dilekçe</Tabs.Tab>
  <Tabs.Tab value="teklif">Teklif</Tabs.Tab>
  <Tabs.Tab value="tespit">Tespit</Tabs.Tab>
</Tabs.List>
```

### V5 Sonrası

```tsx
<Tabs.List grow>
  <Tabs.Tab value="araclar">Araçlar</Tabs.Tab>
  <Tabs.Tab value="dilekce">Dilekçe</Tabs.Tab>
  <Tabs.Tab value="teklif">Teklif</Tabs.Tab>
  <Tabs.Tab value="tespit">Tespit</Tabs.Tab>
  <Tabs.Tab value="bagimlilik" leftSection={<IconLink size={14}/>}>Bağımlılık</Tabs.Tab>
</Tabs.List>
```

### Bağımlılık Tab İçeriği

```
┌─────────────────────────────────────────────────────┐
│ Bağımlılık Tabı                                    │
├─────────────────────────────────────────────────────┤
│                                                     │
│  📊 ALAN BAĞIMLILIKLARI                            │
│                                                     │
│  ✓ Normal (7)  ⚠️ Eksik (2)  🔴 Hatalı (0)        │
│                                                     │
│  ┌───────────────────────────────────────────┐     │
│  │ ✓ kisi_sayisi → ogun_sayisi               │     │
│  │   1250 kişi × 4 öğün = 5000 öğün/gün     │     │
│  │   Doğrulama: OK                           │     │
│  ├───────────────────────────────────────────┤     │
│  │ ✓ isci_sayisi → personel_tablosu          │     │
│  │   28 işçi = Tablodaki 28 satır            │     │
│  │   Doğrulama: OK                           │     │
│  ├───────────────────────────────────────────┤     │
│  │ ⚠️ diyet_menu_var → diyetisyen_personel   │     │
│  │   Diyet menü VAR ama diyetisyen YOK       │     │
│  │   Olası KİK ihlali!                       │     │
│  │   [İncele]                                │     │
│  ├───────────────────────────────────────────┤     │
│  │ ⚠️ haftalik_menu → gramaj_tablosu         │     │
│  │   Menüde 18 yemek, gramajda 15 yemek      │     │
│  │   3 yemek eksik!                          │     │
│  │   [Eksikleri Gör]                         │     │
│  └───────────────────────────────────────────┘     │
│                                                     │
│  ─────────────────────────────────────────────────  │
│                                                     │
│  📐 HESAPLANAN DEĞERLER                            │
│                                                     │
│  ┌───────────────────────────────────────────┐     │
│  │ Öğün başı maliyet:     98.63 TL           │     │
│  │ Günlük toplam öğün:    5000               │     │
│  │ Günlük maliyet:        493.150 TL         │     │
│  │ Aylık maliyet:         14.794.500 TL      │     │
│  └───────────────────────────────────────────┘     │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Yeni Component

```tsx
// frontend/src/components/ihale-merkezi/RightPanel/DependencyTab.tsx

interface Dependency {
  from: string;
  to: string;
  status: 'ok' | 'warning' | 'error';
  message: string;
  details?: string;
}

interface CalculatedValue {
  label: string;
  value: string | number;
  formula?: string;
}

export function DependencyTab({ tender }: { tender: SavedTender }) {
  const [dependencies, setDependencies] = useState<Dependency[]>([]);
  const [calculated, setCalculated] = useState<CalculatedValue[]>([]);
  
  // ... render logic
}
```

---

## 4. Doküman Kümeleme → LeftPanel + DocumentWizard

### 4.1 LeftPanel Küme Filtresi

**Dosya:** `frontend/src/components/ihale-merkezi/LeftPanel/LeftPanel.tsx`

```
┌─────────────────────────────────────────────────────┐
│ LeftPanel (V5)                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  [Tüm İhaleler ▼] [Takip ▼] [Arama...]            │
│                                                     │
│  ──────── YENİ ────────                            │
│                                                     │
│  Küme Filtresi:                                    │
│  ┌───────────────────────────────────────────┐     │
│  │ 🏥 Hastane (12)                           │     │
│  │ 🏫 Okul (8)                               │     │
│  │ 🏛️ Kamu (5)                               │     │
│  │ ❓ Sınıflanmamış (3)                       │     │
│  └───────────────────────────────────────────┘     │
│                                                     │
│  ─────────────────────────────────────────────────  │
│                                                     │
│  İhale Listesi:                                    │
│  ┌───────────────────────────────────────────┐     │
│  │ 🏥 Ankara Şehir Hastanesi                 │     │
│  │    45M TL | 1250 kişi                     │     │
│  ├───────────────────────────────────────────┤     │
│  │ 🏫 Fatih Ortaokulu Yemek                  │     │
│  │    2.5M TL | 350 kişi                     │     │
│  ├───────────────────────────────────────────┤     │
│  │ ...                                       │     │
│  └───────────────────────────────────────────┘     │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 4.2 DocumentWizardModal Küme Tahmini

**Dosya:** `frontend/src/components/ihale-merkezi/DocumentWizardModal.tsx`

Doküman yüklerken küme tahmini step'i ekle:

```
┌─────────────────────────────────────────────────────────┐
│ Döküman Wizard (V5)                               [✕]  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Step 1: Yükle  →  Step 2: Küme  →  Step 3: Analiz    │
│     ✓               ●                  ○               │
│                                                         │
│  ─────────────────────────────────────────────────────  │
│                                                         │
│  📄 Teknik_Sartname.pdf yüklendi                       │
│                                                         │
│  🎯 KÜME TAHMİNİ:                                      │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 🏥 Hastane İhalesi                              │   │
│  │ ███████████████████████████████░░░░  87%        │   │
│  │ ○ Seç                                           │   │
│  ├─────────────────────────────────────────────────┤   │
│  │ 🏫 Okul İhalesi                                 │   │
│  │ ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  8%        │   │
│  │ ○ Seç                                           │   │
│  ├─────────────────────────────────────────────────┤   │
│  │ 🏛️ Kamu Kurumu                                  │   │
│  │ ██░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  5%        │   │
│  │ ○ Seç                                           │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ☑ Kümeye özel prompt kullan                          │
│  ☑ Anomaly kontrolü yap                               │
│  ☑ Tablo analizi yap                                  │
│                                                         │
│  ─────────────────────────────────────────────────────  │
│                                                         │
│                    [Geri]  [Analizi Başlat →]          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 5. Backend API Gereksinimleri

### Yeni Endpoint'ler

```typescript
// /api/tenders/:id/anomalies
GET - Anomali listesini getir
POST - Anomali durumunu güncelle (fixed/ignored/confirmed)

// /api/tenders/:id/dependencies  
GET - Alan bağımlılıklarını getir

// /api/tenders/:id/table-schema
GET - Tablo şema analizini getir

// /api/clusters
GET - Tüm kümeleri listele
POST - Yeni küme oluştur
PUT/:id - Küme güncelle
DELETE/:id - Küme sil

// /api/documents/:id/predict-cluster
POST - Doküman için küme tahmini yap
```

---

## 6. Database Tabloları

```sql
-- Kümeler
CREATE TABLE document_clusters (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT DEFAULT '📄',
  prompt TEXT, -- Kümeye özel analiz prompt'u
  stats JSONB DEFAULT '{}', -- min/max/avg değerler
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Doküman-Küme ilişkisi
CREATE TABLE document_cluster_assignments (
  id SERIAL PRIMARY KEY,
  document_id INTEGER REFERENCES tender_documents(id),
  cluster_id INTEGER REFERENCES document_clusters(id),
  confidence FLOAT,
  assigned_at TIMESTAMPTZ DEFAULT NOW()
);

-- Anomali geçmişi
CREATE TABLE anomaly_history (
  id SERIAL PRIMARY KEY,
  tender_id INTEGER REFERENCES tender_tracking(id),
  field TEXT NOT NULL,
  value TEXT,
  expected_min FLOAT,
  expected_max FLOAT,
  z_score FLOAT,
  severity TEXT CHECK (severity IN ('warning', 'critical')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'fixed', 'ignored', 'confirmed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 7. Uygulama Sırası

1. **Anomaly Detection** (SuggestionsTab.tsx) - En az değişiklik, hızlı kazanım
2. **Field Dependency Tab** (RightPanel) - Yeni tab ekle
3. **Table Schema Modal** (CenterPanel) - Mevcut modal genişlet
4. **Küme Filtresi** (LeftPanel) - UI ekleme
5. **Küme Tahmini** (DocumentWizard) - Wizard step ekleme

Bu plan mevcut yapıyı bozmuyor, sadece genişletiyor. Her değişiklik izole ve test edilebilir.

---

Onay verirsen hangi adımdan başlayalım?
