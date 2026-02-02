---
name: Fiyat Sistemi Tutarlılık
overview: Backend OKUMA sorgularında tutarsızlığı düzelt. Her yerde COALESCE(aktif_fiyat, son_alis_fiyati) pattern'i kullan. Yazma mantığına dokunma.
todos:
  - id: stok-js-okuma
    content: "stok.js - 8 OKUMA sorgusunda COALESCE pattern düzelt"
    status: pending
  - id: planlama-okuma
    content: "planlama.js + menu-planlama.js - OKUMA sorgularını düzelt"
    status: pending
  - id: diger-route-okuma
    content: "urunler.js, fatura-kalemler.js, export.js - OKUMA sorgularını düzelt"
    status: pending
  - id: frontend-gosterim
    content: "Frontend - aktif_fiyat öncelikli gösterim + her iki fiyatı tooltip'te göster"
    status: pending
  - id: test
    content: "Test - Stok değeri hesaplama doğrulaması"
    status: pending
isProject: false
---

# Fiyat Sistemi Tutarlılık Planı

## Temel Prensip

```
┌─────────────────────────────────────────────────────────────┐
│  HER İKİ ALAN DA KALSIN - KULLANICI SEÇEBİLSİN              │
├─────────────────────────────────────────────────────────────┤
│  aktif_fiyat      = Hesaplanmış güncel fiyat (öncelik sırası)│
│  son_alis_fiyati  = Gerçek fatura fiyatı (tarihi kayıt)      │
├─────────────────────────────────────────────────────────────┤
│  VARSAYILAN: COALESCE(aktif_fiyat, son_alis_fiyati)         │
│  UI'DA: Her iki fiyat da görünsün, seçenek olsun            │
└─────────────────────────────────────────────────────────────┘
```

## Kural

- **OKUMA (SELECT):** `COALESCE(uk.aktif_fiyat, uk.son_alis_fiyati)` kullan
- **YAZMA (INSERT/UPDATE):** Mevcut mantık aynen kalsın (her ikisine de yaz)

---

## FAZA 1: stok.js - Kritik OKUMA Sorguları

Dosya: `backend/src/routes/stok.js`

| Satır | Mevcut | Hedef |
|-------|--------|-------|
| 22 | `uk.son_alis_fiyati` | `COALESCE(uk.aktif_fiyat, uk.son_alis_fiyati, 0)` |
| 58 | `uk.son_alis_fiyati` | `COALESCE(uk.aktif_fiyat, uk.son_alis_fiyati, 0)` |
| 422 | `uk.son_alis_fiyati as son_alis_fiyat` | `COALESCE(uk.aktif_fiyat, uk.son_alis_fiyati) as son_alis_fiyat` |
| 424 | `uk.son_alis_fiyati` | `COALESCE(uk.aktif_fiyat, uk.son_alis_fiyati, 0)` |
| 544 | `uk.son_alis_fiyati as son_alis_fiyat` | `COALESCE(uk.aktif_fiyat, uk.son_alis_fiyati) as son_alis_fiyat` |
| 1001 | `uk.son_alis_fiyati` | `COALESCE(uk.aktif_fiyat, uk.son_alis_fiyati, 0)` |
| 1347 | `uk.son_alis_fiyati as son_alis_fiyat` | `COALESCE(uk.aktif_fiyat, uk.son_alis_fiyati) as son_alis_fiyat` |
| 1971 | `uk.son_alis_fiyati as guncel_fiyat` | `COALESCE(uk.aktif_fiyat, uk.son_alis_fiyati) as guncel_fiyat` |

**NOT:** Satır 116, 193 zaten doğru (COALESCE kullanıyor).

---

## FAZA 2: planlama.js + menu-planlama.js

### planlama.js OKUMA sorguları

| Satır | Değişiklik |
|-------|------------|
| 965 | `uk.son_alis_fiyati IS NOT NULL` → `COALESCE(uk.aktif_fiyat, uk.son_alis_fiyati) IS NOT NULL` |
| 968 | `AVG(uk.son_alis_fiyati)` → `AVG(COALESCE(uk.aktif_fiyat, uk.son_alis_fiyati))` |
| 977-979 | Aynı pattern |
| 1045, 1049-1050 | `uk.son_alis_fiyati` → `COALESCE(uk.aktif_fiyat, uk.son_alis_fiyati)` |
| 1341, 1445, 1520 | Aynı pattern |

### menu-planlama.js OKUMA sorguları

| Satır | Değişiklik |
|-------|------------|
| 199-202 | `uk.son_alis_fiyati` → `COALESCE(uk.aktif_fiyat, uk.son_alis_fiyati)` |
| 570-576, 626-632 | Aynı pattern |
| 710, 2835 | Aynı pattern |

---

## FAZA 3: Diğer Route'lar

### urunler.js

| Satır | Değişiklik |
|-------|------------|
| 277, 282 | OKUMA sorgularında COALESCE pattern |
| 1073 | Toplam değer hesaplama |
| 1144, 1329 | Liste sorguları |

### fatura-kalemler.js

| Satır | Değişiklik |
|-------|------------|
| 363, 515 | OKUMA sorgularında COALESCE pattern |

### export.js

| Satır | Değişiklik |
|-------|------------|
| 469, 501, 538 | Excel export sorgularında COALESCE pattern |

---

## FAZA 4: Frontend Güncellemeleri

### stok/page.tsx

Fiyat gösteriminde:
- Birincil: `aktif_fiyat` veya `COALESCE` sonucu
- Tooltip'te: Her iki fiyatı da göster (varsa)

```tsx
// Tooltip örneği:
<Tooltip label={`Aktif: ₺${aktif_fiyat} | Fatura: ₺${son_alis_fiyat}`}>
  <Text>{formatMoney(item.son_alis_fiyat)}</Text>
</Tooltip>
```

### stok/types.ts

```typescript
// Mevcut interface'e aktif_fiyat ekle (zaten var olabilir)
export interface StokItem {
  aktif_fiyat?: number;
  aktif_fiyat_tipi?: string;
  aktif_fiyat_guven?: number;
  son_alis_fiyat: number;  // Legacy, kalsın
}
```

---

## FAZA 5: Test

### Doğrulama Kontrolleri

1. Stok sayfasını aç - fiyatlar görünüyor mu?
2. Depo listesi - toplam değer hesaplanıyor mu?
3. Planlama modülü - maliyet hesaplama doğru mu?
4. Export - Excel'de fiyatlar doğru mu?

### SQL Doğrulama

```sql
-- Tutarsızlık kontrolü
SELECT 
  id, kod, ad,
  aktif_fiyat,
  son_alis_fiyati,
  COALESCE(aktif_fiyat, son_alis_fiyati) as kullanilan_fiyat
FROM urun_kartlari
WHERE aktif = true
  AND aktif_fiyat IS DISTINCT FROM son_alis_fiyati
LIMIT 20;
```

---

## Özet

| Faza | Dosya | Değişiklik Sayısı |
|------|-------|-------------------|
| 1 | stok.js | 8 satır |
| 2 | planlama.js, menu-planlama.js | ~15 satır |
| 3 | urunler.js, fatura-kalemler.js, export.js | ~10 satır |
| 4 | Frontend (stok modülü) | ~5 satır |
| 5 | Test | - |

**TOPLAM:** ~38 satır OKUMA sorgusu düzeltmesi

**DOKUNULMAYACAK:** Yazma mantığı (INSERT/UPDATE) - mevcut haliyle çalışıyor.
