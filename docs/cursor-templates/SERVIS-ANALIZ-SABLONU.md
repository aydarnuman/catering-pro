# SERVİS DERİN ANALİZ ŞABLONU

Bu şablon, Catering Pro ERP sistemindeki servislerin kapsamlı analizini yapmak için kullanılır.
Cursor'a verilen her servis analizi bu formatta çıktı üretmelidir.

---

## BÖLÜM 1: GENEL BAKIŞ

### 1.1 Servis Amacı
Bu servis ne iş yapar? Hangi iş problemini çözer?
- **Birincil amaç:** [Ana fonksiyon]
- **İkincil amaçlar:** [Yan fonksiyonlar]
- **Hedef kullanıcı:** [Kim kullanıyor - admin, muhasebe, depo vs.]

### 1.2 Dosya Haritası
```
/backend
├── src/routes/[servis].js          # API endpoint tanımları
├── src/services/[servis].js        # İş mantığı (varsa)
├── src/middleware/[ilgili].js      # Middleware'ler
└── src/utils/[ilgili].js           # Yardımcı fonksiyonlar

/frontend
├── src/app/[sayfa]/page.tsx        # Ana sayfa
├── src/app/[sayfa]/components/     # Sayfa-spesifik componentler
│   ├── [Liste].tsx
│   ├── [Form].tsx
│   └── [Modal].tsx
├── src/components/[ortak]/         # Paylaşılan componentler
├── src/hooks/use[Servis].ts        # Custom hook'lar
├── src/services/[servis].ts        # API çağrıları
└── src/types/[servis].ts           # TypeScript tipleri
```

---

## BÖLÜM 2: VERİTABANI YAPISI

### 2.1 Ana Tablolar
Her tablo için:

#### `tablo_adi`
```sql
CREATE TABLE tablo_adi (
    id SERIAL PRIMARY KEY,
    kolon1 VARCHAR(255) NOT NULL,
    kolon2 INTEGER DEFAULT 0,
    foreign_id INTEGER REFERENCES diger_tablo(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP
);

-- Index'ler
CREATE INDEX idx_tablo_kolon ON tablo_adi(kolon1);
```

**Kolon Açıklamaları:**
| Kolon | Tip | Null | Default | Açıklama |
|-------|-----|------|---------|----------|
| id | SERIAL | NO | auto | Primary key |
| kolon1 | VARCHAR | NO | - | [Ne için kullanılıyor] |
| foreign_id | INTEGER | YES | NULL | [Hangi tabloyla ilişki, neden] |

**İş Kuralları:**
- [Bu tabloya kayıt eklenirken X kontrolü yapılmalı]
- [Y durumunda soft delete uygulanıyor]
- [Z kolonunda unique constraint var]

### 2.2 İlişki Diyagramı
```
┌─────────────┐       ┌─────────────┐
│  tablo_a    │       │  tablo_b    │
├─────────────┤       ├─────────────┤
│ id (PK)     │───┐   │ id (PK)     │
│ ad          │   │   │ ad          │
│ tablo_b_id  │───┼──►│ durum       │
│ created_at  │   │   │ created_at  │
└─────────────┘   │   └─────────────┘
                  │
                  │   ┌─────────────┐
                  │   │  tablo_c    │
                  │   ├─────────────┤
                  └──►│ id (PK)     │
                      │ tablo_a_id  │
                      │ miktar      │
                      └─────────────┘

İlişki Türleri:
- tablo_a → tablo_b: N:1 (Her A bir B'ye ait)
- tablo_a → tablo_c: 1:N (Her A'nın birden fazla C'si olabilir)
```

### 2.3 Trigger ve Fonksiyonlar
```sql
-- Varsa trigger'ları listele
CREATE OR REPLACE FUNCTION trigger_fonksiyonu()
RETURNS TRIGGER AS $$
BEGIN
    -- Ne yapıyor açıkla
END;
$$ LANGUAGE plpgsql;
```

---

## BÖLÜM 3: BACKEND API

### 3.1 Route Dosyası Analizi
**Dosya:** `/backend/src/routes/[servis].js`

```javascript
// Route yapısı özeti
import express from 'express';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Middleware'ler
router.use(authMiddleware); // Tüm route'lara uygulanıyor
```

### 3.2 Endpoint Detayları

Her endpoint için şu formatı kullan:

#### `GET /api/[servis]` - Listeleme
**Amaç:** [Ne listeler, hangi filtreler var]

**Query Parametreleri:**
| Param | Tip | Zorunlu | Default | Açıklama |
|-------|-----|---------|---------|----------|
| page | number | Hayır | 1 | Sayfa numarası |
| limit | number | Hayır | 20 | Sayfa başı kayıt |
| search | string | Hayır | - | Arama terimi |

**Response Yapısı:**
```typescript
interface ListResponse {
  success: boolean;
  data: {
    items: Item[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  };
}
```

**Backend Kod Akışı:**
```javascript
// Adım adım ne yapıyor açıkla
router.get('/', async (req, res) => {
  // 1. Query parametreleri parse
  // 2. SQL sorgusu oluştur
  // 3. Filtreler ekle
  // 4. Sayfalama
  // 5. Response dön
});
```

#### `POST /api/[servis]` - Yeni Kayıt
**Request Body:**
```typescript
interface CreateRequest {
  alan1: string;      // Zorunlu
  alan2?: number;     // Opsiyonel
}
```

**Validasyon Kuralları:**
| Alan | Kural | Hata Mesajı |
|------|-------|-------------|
| alan1 | required, min:2 | "Minimum 2 karakter" |

**Yan Etkiler:**
- [ ] Başka tablo güncelleniyor mu?
- [ ] Log kaydı oluşturuluyor mu?
- [ ] Bildirim gönderiliyor mu?

### 3.3 Endpoint Özet Tablosu
| Method | Endpoint | Auth | Validasyon | Transaction | Açıklama |
|--------|----------|------|------------|-------------|----------|
| GET | /api/servis | ✓ | - | - | Listeleme |
| GET | /api/servis/:id | ✓ | - | - | Detay |
| POST | /api/servis | ✓ | ✓ | ✓ | Oluştur |
| PUT | /api/servis/:id | ✓ | ✓ | ✓ | Güncelle |
| DELETE | /api/servis/:id | ✓ | - | ✓ | Sil |

---

## BÖLÜM 4: FRONTEND YAPISI

### 4.1 Sayfa Componenti
**Dosya:** `/frontend/src/app/[sayfa]/page.tsx`

**Component Yapısı:**
```typescript
'use client';

export default function SayfaAdi() {
  // State tanımları
  const [state1, setState1] = useState();
  
  // Custom hook kullanımı
  const { data, isLoading } = useServisData();
  
  // Event handlers
  const handleAction = async () => {};
  
  return (
    // JSX yapısı
  );
}
```

**State Yönetimi:**
| State | Tip | Amaç | Güncellenme Zamanı |
|-------|-----|------|-------------------|
| seciliKayit | Item \| null | Seçili kayıt | Satır tıklandığında |
| modalAcik | boolean | Modal durumu | Buton tıklamalarında |

### 4.2 Modal Componentleri

Her modal için:

#### ModalAdi
**Dosya:** `/frontend/src/app/[sayfa]/components/ModalAdi.tsx`

**Props Interface:**
```typescript
interface ModalProps {
  opened: boolean;
  onClose: () => void;
  onSubmit: (values: FormValues) => Promise<void>;
  initialData?: Item | null;
}
```

**Form Alanları:**
| Alan | Component | Validasyon | Açıklama |
|------|-----------|------------|----------|
| ad | TextInput | required | İsim alanı |
| miktar | NumberInput | min:0 | Miktar |

**Form Akışı:**
1. Modal açılır
2. initialData varsa form doldurulur
3. Kullanıcı düzenler
4. Submit → API çağrısı
5. Başarılı → Modal kapanır, liste yenilenir

### 4.3 Custom Hooks

#### useServisData
**Dosya:** `/frontend/src/hooks/useServisData.ts`

```typescript
export function useServisData(params) {
  // React Query kullanımı
  const listQuery = useQuery({...});
  const createMutation = useMutation({...});
  
  return {
    data,
    isLoading,
    create,
    update,
    remove
  };
}
```

### 4.4 TypeScript Tipleri
**Dosya:** `/frontend/src/types/[servis].ts`

```typescript
// Ana entity
export interface ServisItem {
  id: number;
  // ... alanlar
}

// Request/Response tipleri
export interface CreateRequest {...}
export interface UpdateRequest {...}

// Form tipleri
export interface FormValues {...}
```

---

## BÖLÜM 5: BAĞIMLILIKLAR

### 5.1 Bu Servisin Kullandığı Servisler
```
[Bu Servis]
    │
    ├──► [Bağımlı Servis 1]
    │    ├── Nerede: [dosya:satır veya endpoint]
    │    ├── Nasıl: [fonksiyon/method adı]
    │    └── Neden: [iş gerekçesi]
    │
    └──► [Bağımlı Servis 2]
         └── ...
```

### 5.2 Bu Servisi Kullanan Servisler
| Kullanan | Nerede | Hangi Endpoint | Amaç |
|----------|--------|----------------|------|
| ServisX | dosya.js:45 | GET /api/servis | Veri çekme |

### 5.3 Ortak Bağımlılıklar
- Middleware'ler
- Utility fonksiyonları
- Shared componentler

---

## BÖLÜM 6: İŞ AKIŞLARI

### 6.1 Temel CRUD Akışları

Her önemli akış için diyagram çiz:

```
┌─────────────────┐
│ KULLANICI       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 1. Aksiyon      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 2. API Çağrısı  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 3. DB İşlemi    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 4. Response     │
└─────────────────┘
```

### 6.2 Hata Durumu Akışları
- Validation hataları
- DB hataları
- Network hataları

---

## BÖLÜM 7: KOD KALİTESİ ANALİZİ

### 7.1 Güvenlik Kontrolü
| Kontrol | Durum | Bulgu |
|---------|-------|-------|
| SQL Injection | ✓/✗/△ | Parameterized query var mı? |
| XSS Protection | ✓/✗/△ | Input sanitization var mı? |
| Auth Check | ✓/✗/△ | Tüm endpoint'ler korumalı mı? |
| Input Validation | ✓/✗/△ | Backend validasyonu yeterli mi? |

### 7.2 Performans Kontrolü
| Kontrol | Durum | Bulgu |
|---------|-------|-------|
| N+1 Query | ✓/✗/△ | JOIN kullanılmış mı? |
| Index Kullanımı | ✓/✗/△ | Sık sorgulanan kolonlar indexli mi? |
| Pagination | ✓/✗/△ | Büyük listeler sayfalanıyor mu? |

### 7.3 Kod Kalitesi Kontrolü
| Kontrol | Durum | Bulgu |
|---------|-------|-------|
| Error Handling | ✓/✗/△ | Try-catch var mı? |
| Transaction | ✓/✗/△ | Multi-table işlemler korumalı mı? |
| Type Safety | ✓/✗/△ | TypeScript tipleri tanımlı mı? |
| Code Duplication | ✓/✗/△ | Tekrar eden kod var mı? |

### 7.4 Tespit Edilen Sorunlar
| # | Seviye | Sorun | Konum | Çözüm Önerisi |
|---|--------|-------|-------|---------------|
| 1 | 🔴 Kritik | [Açıklama] | [dosya:satır] | [Çözüm] |
| 2 | 🟡 Orta | [Açıklama] | [dosya:satır] | [Çözüm] |
| 3 | 🟢 Düşük | [Açıklama] | [dosya:satır] | [Çözüm] |

### 7.5 Refactoring Önerileri

**Hemen Yapılabilir (Quick Wins):**
1. [Kolay iyileştirme]

**Orta Vadeli:**
1. [Daha kapsamlı iyileştirme]

**Uzun Vadeli:**
1. [Mimari değişiklik]

---

## BÖLÜM 8: TEST SENARYOLARI

### 8.1 Manuel Test Checklist
- [ ] Liste sayfası yükleniyor
- [ ] Filtreler çalışıyor
- [ ] Yeni kayıt oluşturulabiliyor
- [ ] Kayıt düzenlenebiliyor
- [ ] Kayıt silinebiliyor
- [ ] Validasyon hataları gösteriliyor
- [ ] Loading state'ler doğru çalışıyor
- [ ] Error state'ler doğru çalışıyor

### 8.2 Edge Case'ler
- [ ] Boş liste durumu
- [ ] Çok fazla kayıt (performans)
- [ ] Eşzamanlı güncelleme
- [ ] Network kesintisi

---

# ŞABLON KULLANIM KURALLARI

## YAPMALI
- ✓ Dosyaları gerçekten oku, varsayma
- ✓ Gerçek tablo/kolon/endpoint adları kullan
- ✓ Her bölümü doldur, boş bırakma
- ✓ Kod örnekleri mevcut koddan al
- ✓ Sorunları açıkça belirt

## YAPMAMALI
- ❌ Varsayımla ilerleme
- ❌ Görmediğin bilgiyi uydurmama - "BİLİNMİYOR" yaz
- ❌ Gereksiz uzatma
- ❌ Genel/soyut ifadeler kullanma

## ANALİZ BİTTİĞİNDE
1. "Analiz tamamlandı. Sorular?" de
2. Çıktıyı `/docs/analiz/[servis]-analizi.md` olarak kaydetmeyi öner
