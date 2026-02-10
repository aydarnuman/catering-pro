# Piyasa Fiyat Sistemi Dokümantasyonu

> Son güncelleme: 10 Şubat 2026
> Durum: Production'a deploy edilmedi, lokal test tamamlandı

## Genel Bakış

Piyasa fiyat sistemi 3 katmanlı veri toplama, merkezi özet hesaplama ve otomatik anomali düzeltme ile çalışır.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        VERİ TOPLAMA (3 Katman)                      │
├──────────────────┬──────────────────┬───────────────────────────────┤
│  Camgöz API      │  Tavily AI       │  Hal.gov.tr                   │
│  (45+ market)    │  (web arama)     │  (toptancı hal)               │
│  BİRİNCİL        │  TAMAMLAYICI     │  TAZE ÜRÜN                    │
│  Yapısal veri    │  AI answer +     │  ~400 sebze/meyve             │
│  Birim dönüşüm   │  snippet parse   │  Günlük bülten                │
└────────┬─────────┴────────┬─────────┴──────────────┬────────────────┘
         │                  │                        │
         ▼                  ▼                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│              piyasa_fiyat_gecmisi (HAM VERİ DEPOSU)                 │
│  Her market/kaynak için ayrı satır                                  │
│  Kolonlar: urun_kart_id, birim_fiyat, birim_tipi, market_adi, ...  │
└────────────────────────────┬────────────────────────────────────────┘
                             │ refresh_urun_fiyat_ozet()
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│              urun_fiyat_ozet (TEK DOĞRU KAYNAK)                     │
│  Ürün başına tek satır, IQR temizli                                 │
│  birim_fiyat_ekonomik | birim_fiyat_min | max | medyan              │
│  birim_tipi | confidence | kaynak_sayisi | kaynak_tip               │
└────────────────────────────┬────────────────────────────────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
  ┌──────────────┐  ┌────────────────┐  ┌────────────────┐
  │ Reçete       │  │ Ürün Kartı     │  │ Frontend UI    │
  │ Maliyet      │  │ Güncel Fiyat   │  │ Piyasa Panel   │
  │ Hesaplama    │  │ (aktif_fiyat)  │  │ Min/Ort/Max    │
  └──────────────┘  └────────────────┘  └────────────────┘
```

## Dosya Haritası

```
backend/src/services/
├── market-scraper.js          ← Camgöz API (birincil kaynak)
├── tavily-service.js          ← Tavily web arama (tamamlayıcı)
├── hal-scraper.js             ← Hal.gov.tr toptancı fiyatları
├── piyasa-fiyat-writer.js     ← TEK MERKEZİ YAZIM SERVİSİ ⭐
├── arama-terimi-optimizer.js  ← Otomatik arama terimi sabitleme
├── piyasa-sync-scheduler.js   ← Günde 3x otomatik güncelleme
└── ai-tools/piyasa-tools.js   ← AI agent fiyat araştırma tool

backend/src/routes/
├── menu-planlama.js           ← hesaplaReceteMaliyet() + ürün kartları
├── planlama.js                ← Piyasa takip, kaydet, optimize
└── fatura-kalemler.js         ← raf-fiyat endpoint (detay + özet)

frontend/src/
├── lib/api/services/fatura-kalemleri.ts  ← getRafFiyat(), FiyatOzet tipi
└── app/muhasebe/menu-planlama/components/
    ├── PiyasaFiyatlariSection.tsx         ← Piyasa fiyat paneli
    └── UrunDetayModal.tsx                ← Ürün detay + piyasa tab

supabase/migrations/
└── 20260210120000_urun_fiyat_ozet_sistemi.sql  ← Tüm DB değişiklikleri
```

## Veritabanı Şeması

### urun_fiyat_ozet (Yeni Tablo)
```sql
urun_kart_id         INTEGER PRIMARY KEY  -- FK → urun_kartlari
birim_fiyat_ekonomik DECIMAL(15,4)        -- IQR temiz, en ucuz 5'in ort.
birim_fiyat_min      DECIMAL(15,4)
birim_fiyat_max      DECIMAL(15,4)
birim_fiyat_medyan   DECIMAL(15,4)
birim_tipi           VARCHAR(10)          -- kg, L, adet
confidence           DECIMAL(5,2)         -- 0.00-1.00
kaynak_sayisi        INTEGER
kaynak_tip           VARCHAR(30)          -- market, market+tavily_ai, varyant
varyant_fiyat_dahil  BOOLEAN
son_guncelleme       TIMESTAMP
```

### piyasa_fiyat_gecmisi (Eklenen Kolon)
```sql
birim_tipi           VARCHAR(10)          -- YENİ: kg, L, adet (eskiden JSON'daydı)
```

### DB Fonksiyonları
- `refresh_urun_fiyat_ozet(urun_kart_id)` -- Tek ürün için özet hesapla
- `refresh_parent_fiyat_ozet(parent_id)` -- Varyantlardan parent fiyat hesapla

## Formüller

### 1. Ekonomik Ortalama (birim_fiyat_ekonomik)

```
Girdi: piyasa_fiyat_gecmisi'ndeki son 30 günlük birim_fiyat değerleri
       (dominant birim_tipi ile filtrelenmiş)

Adım 1: Dominant birim tespiti
  → En çok kayıt olan birim_tipi (kg, L veya adet)

Adım 2: IQR Outlier Temizleme (5+ fiyat varsa)
  Q1 = fiyatlar[%25]
  Q3 = fiyatlar[%75]
  IQR = Q3 - Q1
  Alt sınır = Q1 - 1.5 × IQR
  Üst sınır = Q3 + 1.5 × IQR
  → Sınır dışı fiyatlar çıkarılır

Adım 3: Medyan Bazlı Ek Temizleme (4+ fiyat varsa)
  Medyan = fiyatlar[%50]
  Alt = Medyan × 0.2
  Üst = Medyan × 3.0
  → Bu aralık dışındakiler çıkarılır

Adım 4: Ekonomik Ortalama
  → Temizlenmiş fiyatların en ucuz 5 tanesinin ortalaması
```

### 2. Confidence Skoru (0.00 - 1.00)

```
Kaynak Çeşitliliği (max 0.30):
  confidence += min(kaynak_sayısı × 0.06, 0.30)

Fiyat Tutarlılığı (max 0.40):
  spread = (max - min) / medyan
  spread ≤ 0.2 → +0.40  (çok tutarlı)
  spread ≤ 0.4 → +0.25  (tutarlı)
  spread ≤ 0.6 → +0.15  (orta)
  spread > 0.6 → +0.05  (dağınık)

Güncellik (max 0.30):
  Son 3 gün veri var → +0.30
  Son 7 gün veri var → +0.15
  Daha eski         → +0.00
```

### 3. Reçete Maliyet Hesaplama

```
Her malzeme için:
  birim_fiyat = COALESCE(
    aktif_fiyat,              -- 1. Sözleşme/fatura/varsayılan
    son_alis_fiyati,          -- 2. Son fatura fiyatı
    urun_fiyat_ozet.ekonomik, -- 3. Piyasa özet (IQR temizli) ⭐
    manuel_fiyat,             -- 4. Manuel giriş
    varyant_fiyat,            -- 5. Varyant fallback
    0                         -- 6. Fiyat yok
  )

  Birim dönüşümü:
    g/gr/ml → miktar × 0.001 × birim_fiyat
    kg/lt/L → miktar × birim_fiyat
    adet    → miktar × birim_fiyat

  toplam_maliyet = Σ(malzeme_maliyet)
```

### 4. Varyant Fiyat Hesaplama

```
Parent ürün fiyatı = En ucuz 3 varyantın ekonomik ortalaması

Örnek: Şeker (parent)
  ├── Toz Şeker 5kg  → ekonomik: 37 TL/kg
  ├── Küp Şeker 5kg  → ekonomik: 43 TL/kg
  └── Pudra Şekeri   → ekonomik: 52 TL/kg
  
  Parent fiyat = AVG(37, 43, 52) = 44 TL/kg
  varyant_fiyat_dahil = true
```

### 5. Fatura Anomali Tespiti

```
Kural: aktif_fiyat / piyasa_ekonomik > 3.0 VE confidence ≥ 0.5

Eylem: aktif_fiyat = piyasa_ekonomik, aktif_fiyat_tipi = 'PIYASA'

Neden: Fatura birim_fiyat bazen paket/koli fiyatı olarak geliyor
       (ör: 5L bidon zeytinyağı 1393 TL → kg fiyatı gibi)
       Piyasa özeti bu durumu düzeltir.
```

## Otomatik İşlemler

| İşlem | Zamanlama | Dosya |
|-------|-----------|-------|
| Piyasa fiyat sync | Günde 3x (08:00, 13:00, 18:00) | piyasa-sync-scheduler.js |
| Hal.gov.tr sync | Günde 1x (09:00) | hal-scraper.js |
| Arama terimi optimizasyonu | Haftalık Pazar 03:00 | arama-terimi-optimizer.js |
| Fatura anomali tespiti | Her sync sonrası | piyasa-fiyat-writer.js |
| Yeni ürün arama terimi | Ürün eklendiğinde (otomatik) | arama-terimi-optimizer.js |
| Özet yenileme | Her fiyat yazımında | piyasa-fiyat-writer.js |
| Varyant cascade | Varyant güncellendiğinde | piyasa-fiyat-writer.js |

## Birim Dönüşüm Kuralları

```
Ürün kartı birimi → Fiyat birimi:
  gr, gram, g     → kg (÷ 1000)
  ml              → L  (÷ 1000)
  kg, kilo        → kg
  lt, litre, L    → L
  adet, demet     → adet (doğrudan)

Reçetede miktar × 0.001 çarpanı:
  Birim g/gr/ml → maliyet = miktar × 0.001 × birim_fiyat_per_kg_or_L
  Birim kg/lt   → maliyet = miktar × birim_fiyat
  Birim adet    → maliyet = miktar × birim_fiyat
```

## Alaka Filtreleme (Camgöz Sonuçları)

NON_FOOD_KEYWORDS ile gıda dışı ürünler elenir:
- Kozmetik: palette, saç boyası, garnier, loreal
- Kişisel bakım: diş macunu, şampuan, sabun
- Hayvan: felix, whiskas, purina, pedigree, pouch
- Mutfak eşyası: bıçak, tencere, spatula

COMPOSITE_MARKERS ile bileşik ürünler elenir:
- dolgulu, aromalı, çeşnili, soslu, biberli, soğanlı, etli...
- "biber" aramasında "biberli zeytin" gelmez

## Mevcut Veri Durumu (10 Şubat 2026)

| Metrik | Değer |
|--------|-------|
| Aktif ürün kartı | 192 |
| Fiyat özeti olan | 192 |
| Confidence ≥ 0.65 | 172 (%90) |
| Aktif reçete | 115 |
| Toplam malzeme | 871 |
| Fiyatlı malzeme | 871 (%100) |
| Birim uyumsuzluğu | 0 |
| Fatura anomalisi | 0 (12 düzeltildi) |

## API Endpointleri

| Endpoint | Method | Açıklama |
|----------|--------|----------|
| `/api/fatura-kalemler/fiyatlar/:id/raf-fiyat` | GET | Detay satırları + özet |
| `/api/planlama/piyasa/hizli-arastir` | POST | Canlı fiyat araştırma |
| `/api/planlama/piyasa/terim-optimize` | POST | Toplu arama terimi optimizasyonu |
| `/api/planlama/piyasa/sync/tetikle` | POST | Manuel sync tetikleme |
| `/api/menu-planlama/receteler/:id/maliyet-hesapla` | POST | Reçete maliyet yenileme |
| `/api/menu-planlama/receteler/toplu-maliyet-hesapla` | POST | Tüm reçeteler maliyet |
