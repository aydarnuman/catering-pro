# Fiyat & Eşleştirme Entegrasyon Planı

**Tarih:** 31 Ocak 2026  
**Amaç:** Ürün kartı eşleştirme → Fiyat güncelleme → Menü maliyet zincirini bağlamak

---

## 1. MEVCUT DURUM ANALİZİ

### 1.1 Sistemler ve Durumları

| Sistem | Dosya/Tablo | Durum | Sorun |
|--------|-------------|-------|-------|
| **Fatura İşleme** | `fatura-kalemler.js` | ✅ Çalışıyor | - |
| **AI Eşleştirme** | `ai-eslestirme.js` | ⚠️ Var ama bağlı değil | Otomatik tetiklenmiyor |
| **Fuzzy Match** | `akilli_stok_eslestir()` | ⚠️ Var ama kullanılmıyor | API yok |
| **Tedarikçi Mapping** | `tedarikci_urun_mapping` | ⚠️ Var ama zayıf | Tek yönlü |
| **Fiyat Geçmişi** | `urun_fiyat_gecmisi` | ⚠️ Var ama beslenmİyor | Eşleştirme kopuk |
| **Fiyat Motor** | `fiyat-motor.js` | ✅ Çalışıyor | - |
| **aktif_fiyat Trigger** | `115_fiyat_mimarisi.sql` | ✅ Çalışıyor | - |
| **Menü Maliyet** | `menu-planlama.js` | ⚠️ Kısmen | Fiyatsız ürünler var |

### 1.2 Kopuk Zincir

```
MEVCUT DURUM (KOPUK):

┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   FATURA    │ ──► │  KALEMLER   │ ──X │ EŞLEŞTİRME  │ ──X │   FİYAT     │
│   GELDİ     │     │  TABLOYA    │     │  (KOPUK)    │     │  GEÇMİŞİ    │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                                                                   │
                                                                   X (KOPUK)
                                                                   ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    MENÜ     │ ◄─X │   REÇETE    │ ◄─X │ aktif_fiyat │ ◄── │  TRIGGER    │
│  MALİYET    │     │  MALİYET    │     │  (BOŞ/ESKİ) │     │ (ÇALIŞIYOR) │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

### 1.3 Veri Durumu (Ekran Görüntüsünden)

| Fiyat Kaynağı | Ürün Sayısı | Yüzde | Anlam |
|---------------|-------------|-------|-------|
| SÖZLEŞME | 0 | %0 | Tedarikçi sözleşmesi yok |
| FATURA | 19 | %22 | Sadece 19 ürün faturadan fiyat aldı |
| PİYASA | 0 | %0 | Piyasa verisi çekilmemiş |
| MANUEL | 0 | %0 | Manuel giriş yok |
| **VARSAYILAN** | **66** | **%78** | ❌ Güven %30, güvenilmez |

**Sonuç:** 85 üründen 66'sı (%78) düşük güvenli fiyatta.

---

## 2. HEDEF MİMARİ

### 2.1 Bağlı Zincir

```
HEDEF DURUM (BAĞLI):

┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   FATURA    │ ──► │  KALEMLER   │ ──► │ OTOMATİK    │ ──► │   FİYAT     │
│   GELDİ     │     │  TABLOYA    │     │ EŞLEŞTİRME  │     │  GEÇMİŞİ    │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                           │                   │                   │
                           │                   │                   │ TRIGGER
                           ▼                   ▼                   ▼
                    ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
                    │   MAPPİNG   │ ◄── │   AI/FUZZY  │     │ aktif_fiyat │
                    │   ÖĞRENME   │     │   FALLBACK  │     │  GÜNCELLE   │
                    └─────────────┘     └─────────────┘     └─────────────┘
                                                                   │
                                                                   ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    MENÜ     │ ◄── │   REÇETE    │ ◄── │  MALİYET    │ ◄── │   GÜNCEL    │
│   PLANI     │     │  DETAY      │     │   HESAPLA   │     │   FİYAT     │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                                               │
                                               ▼
                                        ┌─────────────┐
                                        │   UYARI     │
                                        │  SİSTEMİ    │
                                        └─────────────┘
```

### 2.2 Eşleştirme Öncelik Sırası

```
1. MAPPING TABLOSU (tedarikci_urun_mapping)
   ├── Tedarikçi VKN + Ürün Kodu (tam eşleşme) → Güven: %100
   └── Tedarikçi VKN + Ürün Adı (tam eşleşme) → Güven: %95

2. FUZZY MATCH (pg_trgm)
   ├── Benzerlik > %80 → Güven: %85
   └── Benzerlik > %60 → Güven: %70 (onay gerekir)

3. AI EŞLEŞTİRME (Claude)
   ├── Güven skoru >= %80 → Otomatik kabul
   └── Güven skoru < %80 → Manuel onay kuyruğu

4. MANUEL EŞLEŞTİRME
   └── Kullanıcı seçimi → Mapping'e kaydet
```

---

## 3. YAPILACAK İŞLER

### Aşama 1: Eşleştirme Zincirini Bağla

| # | İş | Dosya | Öncelik |
|---|-----|-------|---------|
| 1.1 | Fatura kalem INSERT sonrası otomatik eşleştirme trigger'ı | `fatura-kalemler.js` | 🔴 Yüksek |
| 1.2 | Eşleştirme servisi (mapping → fuzzy → AI sırasıyla) | `services/eslestirme-merkezi.js` (YENİ) | 🔴 Yüksek |
| 1.3 | Eşleşme sonrası fiyat geçmişine otomatik INSERT | `eslestirme-merkezi.js` | 🔴 Yüksek |
| 1.4 | Eşleşmeyen kalemler için kuyruk tablosu | `eslestirme_kuyrugu` (YENİ TABLO) | 🟡 Orta |

### Aşama 2: Fiyat Zincirini Bağla

| # | İş | Dosya | Öncelik |
|---|-----|-------|---------|
| 2.1 | `planlama.js` - aktif_fiyat kullanımı | `planlama.js` | 🔴 Yüksek |
| 2.2 | `maliyet-analizi.js` - aktif_fiyat kullanımı | `maliyet-analizi.js` | 🔴 Yüksek |
| 2.3 | `urunler.js` - aktif_fiyat önceliği | `urunler.js` | 🟡 Orta |
| 2.4 | `fatura-kalemler.js` - trigger'a güven | `fatura-kalemler.js` | 🟡 Orta |
| 2.5 | `export.js` - aktif_fiyat export | `export.js` | 🟢 Düşük |

### Aşama 3: Uyarı ve Kontrol Sistemi

| # | İş | Dosya | Öncelik |
|---|-----|-------|---------|
| 3.1 | Günlük fiyat eskime kontrolü (cron) | `services/fiyat-kontrol-scheduler.js` (YENİ) | 🟡 Orta |
| 3.2 | Düşük güven skoru uyarısı | `fiyat_uyarilari` tablosu | 🟡 Orta |
| 3.3 | Menü maliyet değişim uyarısı | `menu-planlama.js` | 🟢 Düşük |
| 3.4 | Dashboard'da uyarı özeti | Frontend | 🟢 Düşük |

### Aşama 4: Basitleştirme

| # | İş | Dosya | Öncelik |
|---|-----|-------|---------|
| 4.1 | Eşleştirme UI basitleştirme | Frontend | 🟡 Orta |
| 4.2 | Tek tıkla toplu eşleştirme | API + Frontend | 🟡 Orta |
| 4.3 | Fiyat durumu dashboard | Frontend | 🟢 Düşük |

---

## 4. TEKNİK DETAYLAR

### 4.1 Yeni Servis: `eslestirme-merkezi.js`

```javascript
/**
 * Merkezi Eşleştirme Servisi
 * Tüm eşleştirme işlemlerini tek noktadan yönetir
 */

export async function eslestirKalem(kalem) {
  // 1. Mapping tablosundan ara
  const mapping = await bulMappingEslestirme(kalem);
  if (mapping && mapping.guven >= 95) {
    return { ...mapping, yontem: 'mapping' };
  }
  
  // 2. Fuzzy match dene
  const fuzzy = await bulFuzzyEslestirme(kalem);
  if (fuzzy && fuzzy.benzerlik >= 0.8) {
    return { ...fuzzy, yontem: 'fuzzy' };
  }
  
  // 3. AI eşleştirme dene
  const ai = await aiEslestirTekKalem(kalem);
  if (ai && ai.guven_skoru >= 70) {
    // Mapping'e kaydet (öğrenme)
    await kaydetMapping(kalem, ai);
    return { ...ai, yontem: 'ai' };
  }
  
  // 4. Kuyruğa ekle (manuel onay gerekli)
  await kuyruğaEkle(kalem);
  return null;
}

export async function eslestirVeFiyatKaydet(kalem) {
  const eslestirme = await eslestirKalem(kalem);
  
  if (eslestirme) {
    // Fiyat geçmişine kaydet (trigger aktif_fiyat'ı güncelleyecek)
    await kaydetFiyatGecmisi({
      urun_kart_id: eslestirme.urun_kart_id,
      fiyat: hesaplaStandartFiyat(kalem, eslestirme),
      kaynak: 'FATURA',
      fatura_ettn: kalem.fatura_ettn
    });
    
    // Kalemi güncelle
    await guncelleKalemUrunId(kalem.id, eslestirme.urun_kart_id);
  }
  
  return eslestirme;
}
```

### 4.2 Yeni Tablo: `eslestirme_kuyrugu`

```sql
CREATE TABLE eslestirme_kuyrugu (
    id SERIAL PRIMARY KEY,
    
    -- Kaynak bilgisi
    kaynak_tip VARCHAR(20) NOT NULL,  -- 'fatura', 'piyasa', 'recete'
    kaynak_id INTEGER,
    
    -- Eşleştirilecek veri
    orijinal_ad VARCHAR(500) NOT NULL,
    orijinal_kod VARCHAR(100),
    tedarikci_vkn VARCHAR(20),
    tedarikci_ad VARCHAR(200),
    birim VARCHAR(20),
    fiyat DECIMAL(15,4),
    
    -- Öneri (AI/Fuzzy sonucu)
    onerilen_urun_id INTEGER REFERENCES urun_kartlari(id),
    onerilen_guven INTEGER,
    oneri_yontemi VARCHAR(20),  -- 'fuzzy', 'ai'
    
    -- Durum
    durum VARCHAR(20) DEFAULT 'bekliyor',  -- bekliyor, onaylandi, reddedildi, yeni_urun
    isleyen_kullanici INTEGER,
    islem_tarihi TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_eslestirme_kuyrugu_durum ON eslestirme_kuyrugu(durum);
```

### 4.3 Fatura Kalem Trigger Değişikliği

```javascript
// fatura-kalemler.js - processKalem fonksiyonu

async function processKalem(kalem, faturaEttn) {
  // 1. Kalemi kaydet
  const savedKalem = await insertKalem(kalem, faturaEttn);
  
  // 2. OTOMATİK EŞLEŞTİRME (YENİ)
  const eslestirme = await eslestirVeFiyatKaydet({
    ...savedKalem,
    fatura_ettn: faturaEttn
  });
  
  if (eslestirme) {
    logger.info('Kalem otomatik eşleştirildi', {
      kalem: savedKalem.orijinal_urun_adi,
      urun: eslestirme.urun_kart_adi,
      yontem: eslestirme.yontem,
      guven: eslestirme.guven_skoru
    });
  }
  
  return savedKalem;
}
```

### 4.4 Günlük Fiyat Kontrol (Cron)

```javascript
// services/fiyat-kontrol-scheduler.js

import cron from 'node-cron';
import { query } from '../database.js';
import { tumFiyatlariYenidenHesapla } from './fiyat-motor.js';

// Her gün saat 06:00'da çalış
cron.schedule('0 6 * * *', async () => {
  logger.info('Günlük fiyat kontrolü başladı');
  
  // 1. Eskimiş fiyatları tespit et (30+ gün)
  const eskimis = await query(`
    SELECT id, ad, aktif_fiyat_guncelleme
    FROM urun_kartlari
    WHERE aktif = true
      AND (aktif_fiyat_guncelleme < NOW() - INTERVAL '30 days'
           OR aktif_fiyat_guncelleme IS NULL)
  `);
  
  if (eskimis.rows.length > 0) {
    // Uyarı oluştur
    await query(`
      INSERT INTO fiyat_uyarilari (uyari_tipi, urun_kart_id, mesaj)
      SELECT 'eskimis_fiyat', id, 'Fiyat 30 günden eski'
      FROM urun_kartlari
      WHERE id = ANY($1)
      ON CONFLICT DO NOTHING
    `, [eskimis.rows.map(r => r.id)]);
    
    logger.warn(`${eskimis.rows.length} ürünün fiyatı eskimiş`);
  }
  
  // 2. Düşük güvenli fiyatları tespit et
  const dusukGuven = await query(`
    SELECT id, ad, aktif_fiyat_guven
    FROM urun_kartlari
    WHERE aktif = true AND aktif_fiyat_guven < 50
  `);
  
  if (dusukGuven.rows.length > 0) {
    logger.warn(`${dusukGuven.rows.length} ürünün fiyat güveni düşük`);
  }
  
  logger.info('Günlük fiyat kontrolü tamamlandı');
});
```

---

## 5. UYGULAMA SIRASI

```
HAFTA 1:
├── 1.1 eslestirme-merkezi.js servisi oluştur
├── 1.2 Fatura kalem işlemede otomatik eşleştirme çağır
└── 1.3 Eşleşme sonrası fiyat geçmişine INSERT

HAFTA 2:
├── 2.1 planlama.js aktif_fiyat entegrasyonu
├── 2.2 maliyet-analizi.js aktif_fiyat entegrasyonu
└── 1.4 Eşleşmeyen kalemler için kuyruk tablosu

HAFTA 3:
├── 3.1 Günlük fiyat kontrolü scheduler
├── 4.1 Eşleştirme UI basitleştirme
└── 4.2 Tek tıkla toplu eşleştirme

HAFTA 4:
├── 3.2-3.4 Uyarı sistemi tamamlama
├── 2.3-2.5 Kalan dosya güncellemeleri
└── Test ve stabilizasyon
```

---

## 6. BAŞARI KRİTERLERİ

| Metrik | Mevcut | Hedef |
|--------|--------|-------|
| VARSAYILAN fiyatlı ürün | %78 (66) | < %20 |
| FATURA fiyatlı ürün | %22 (19) | > %60 |
| Otomatik eşleşme oranı | %0 | > %80 |
| Ortalama güven skoru | ~30 | > 70 |
| Eskimiş fiyat sayısı | ? | < 10 |

---

## 7. RİSKLER VE ÇÖZÜMLER

| Risk | Olasılık | Etki | Çözüm |
|------|----------|------|-------|
| AI maliyeti artışı | Orta | Düşük | Rate limiting, cache |
| Yanlış eşleştirme | Orta | Yüksek | Güven eşiği, manuel onay kuyruğu |
| Performans | Düşük | Orta | Async işleme, batch |
| Mevcut veri kaybı | Düşük | Yüksek | Geriye uyumluluk, fallback |

---

## 8. UYGULAMA DURUMU

### Tamamlanan İşler (31 Ocak 2026)

#### Aşama 1: Eşleştirme Zinciri ✅

| # | İş | Durum |
|---|-----|-------|
| 1.1 | `eslestirme-merkezi.js` servisi | ✅ Oluşturuldu |
| 1.2 | Fatura kalem otomatik eşleştirme | ✅ Entegre edildi |
| 1.3 | Fiyat geçmişine INSERT | ✅ Servis içinde |
| 1.4 | Kuyruk tablosu migration | ✅ 116_eslestirme_kuyrugu.sql |

#### Aşama 2: Fiyat Zinciri ✅

| # | İş | Durum |
|---|-----|-------|
| 2.1 | `planlama.js` aktif_fiyat | ✅ Güncellendi |
| 2.2 | `maliyet-analizi.js` aktif_fiyat | ✅ Güncellendi |

### Oluşturulan Dosyalar

```
YENİ:
├── backend/src/services/eslestirme-merkezi.js      # Merkezi eşleştirme servisi
├── backend/src/migrations/116_eslestirme_kuyrugu.sql
└── supabase/migrations/20260131000116_eslestirme_kuyrugu.sql

GÜNCELLENDİ:
├── backend/src/routes/fatura-kalemler.js   # Otomatik eşleştirme entegrasyonu + API
├── backend/src/routes/planlama.js          # COALESCE(aktif_fiyat, son_alis_fiyati)
└── backend/src/routes/maliyet-analizi.js   # aktif_fiyat öncelikli
```

### Yeni API Endpoint'leri

```
POST /api/fatura-kalemler/eslestirme/toplu       # Toplu otomatik eşleştirme
GET  /api/fatura-kalemler/eslestirme/kuyruk      # Onay bekleyen liste
POST /api/fatura-kalemler/eslestirme/kuyruk/:id/onayla  # Manuel onay
POST /api/fatura-kalemler/eslestirme/kuyruk/:id/reddet  # Reddet
GET  /api/fatura-kalemler/eslestirme/istatistik  # Eşleştirme özeti
```

### Sonraki Adımlar

1. **Migration çalıştır:** `116_eslestirme_kuyrugu.sql`
2. **Test et:** Fatura işleme akışını test et
3. **Toplu eşleştirme:** Mevcut eşleşmemiş kalemler için çalıştır
4. **Aşama 3:** Uyarı ve kontrol sistemi (opsiyonel)
