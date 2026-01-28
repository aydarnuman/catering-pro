# 🔍 TEK KAYNAK DOĞRULAMA RAPORU

**Tarih:** 27 Ocak 2025  
**Kapsam:** Single Source of Truth – fatura kalem / fiyat / maliyet verisi  
**Kural:** Hiçbir dosya değiştirilmedi; yalnızca tarama ve raporlama yapıldı.

---

## ✅ TEMİZ ALANLAR

| Alan | Durum |
|------|-------|
| Backend route dosyası | ✅ Sadece `fatura-kalemler.js` (fatura kalem API’si) |
| Server.js | ✅ `invoice-items` / `invoiceItems` referansı yok; sadece `faturaKalemlerRouter` ve `/api/fatura-kalemleri` |
| Frontend fatura kalem API | ✅ `/api/fatura-kalemleri` tek kaynak; `fatura-kalemleri.ts` ve ilgili sayfalar bu endpoint’i kullanıyor |
| Frontend import | ✅ `from '@/lib/api/services/fatura-kalemleri'` ve `faturaKalemleriAPI` kullanılıyor; eski `invoice-items` / `fatura-kalemler` import’u yok |
| Migration 091 + 092 | ✅ `fatura_kalem_urunler` → `fatura_kalemleri` geçişi ve view’lar 092’de tutarlı |

---

## ⚠️ BULUNAN SORUNLAR

### 1. Eski tablo referansları (invoice_items / uyumsoft_invoice_items)

Tek geçerli tablo **fatura_kalemleri** olmalı. Aşağıdaki dosyalar hâlâ **invoice_items** veya **uyumsoft_invoice_items** kullanıyor:

| Dosya | Satır | Sorun | Önerilen çözüm |
|-------|-------|--------|-----------------|
| `backend/src/scripts/remove-placeholder-invoices.js` | 53 | `DELETE FROM invoice_items` | Eski senaryoya aitse kaldırılmalı veya fatura_kalemleri ile uyumlu hale getirilmeli |
| `backend/src/services/ai-agent.js` | 36, 55, 123 | `FROM invoice_items ii`, `FROM uyumsoft_invoice_items ui` | Fiyat/kalem verisi için fatura_kalemleri (veya ilgili view’lar) kullanılmalı |
| `backend/src/routes/stok.js` | 1832 | `FROM uyumsoft_invoice_items WHERE uyumsoft_invoice_id = ui.id` | Kalem sayısı fatura_kalemleri tablosundan türetilmeli |
| `backend/src/routes/invoices.js` | 88, 202, 292, 403, 414, 586 | `invoice_items` okuma/yazma/silme | Fatura kalem işlemleri fatura_kalemleri / fatura-kalemleri API ile tek kaynaktan yürütülmeli |
| `backend/src/services/sync-scheduler.js` | 351–352 | `FROM uyumsoft_invoice_items JOIN uyumsoft_invoices` | Sync mantığı fatura_kalemleri ile uyumlu hale getirilmeli |
| `backend/src/services/uyumsoft-sales.js` | 51 | `SELECT * FROM invoice_items WHERE invoice_id = $1` | Fatura kalem verisi fatura_kalemleri’nden alınmalı |
| `backend/src/services/ai-tools/fatura-tools.js` | 201, 381, 462 | `uyumsoft_invoice_items` / fatura kalem sorguları | fatura_kalemleri veya v_* view’ları kullanılmalı |
| `backend/src/services/invoice-ai.js` | 103, 176 | `FROM invoice_items ii`, `FROM uyumsoft_invoice_items` | Aynı şekilde fatura_kalemleri / view’lara geçilmeli |
| `backend/src/migrations/004_invoices_schema.sql` | 50, 143, 195–197, 206–207, 221, 248, 272–273, 284 | Eski tablolar: `invoice_items`, `uyumsoft_invoice_items` | Tarihî migration; yeni kod bu tablolara dayanmamalı |
| `backend/src/migrations/011_duplicate_detection.sql` | 77 | `FROM invoice_items WHERE invoice_id = i.id` | Duplicate kontrolü fatura_kalemleri ile uyumlu olacak şekilde güncellenebilir |

### 2. Frontend – paralel fatura kalem kaynağı

| Dosya | Satır | Sorun | Önerilen çözüm |
|-------|-------|--------|-----------------|
| `frontend/src/lib/api/services/stok.ts` | 255, 264 | `getFaturaKalemler` → `/api/stok/faturalar/${ettn}/kalemler`, `getAkilliKalemler` → `/api/stok/faturalar/${ettn}/akilli-kalemler` | Fatura kalem verisi tek kaynak olarak `/api/fatura-kalemleri/...` üzerinden alınmalı; stok tarafı sadece stok girişi akışına özel alanları kullanmalı |
| `frontend/src/app/muhasebe/stok/page.tsx` | 694, 740 | `stokAPI.getAkilliKalemler(ettn)`, `stokAPI.getFaturaKalemler(ettn)` | Aynı ekranlar mümkünse fatura-kalemleri API’si ile beslenmeli |

### 3. Dokümantasyon / isim tutarsızlıkları

| Dosya | Satır | Sorun | Önerilen çözüm |
|-------|-------|--------|-----------------|
| `backend/src/routes/fatura-kalemler.js` | 224, 273, 306, 514, 549, 581, 616, 643 | Yorumlarda path `/api/fatura-kalemler/...` (sonunda **i** yok) yazılmış; gerçek base path `/api/fatura-kalemleri` | Yorumlar `GET/POST /api/fatura-kalemleri/...` olacak şekilde düzeltilmeli |
| `backend/src/migrations/README.md` | 91 | “invoice_items — Fatura kalemleri” deniyor | Güncel mimaride “fatura_kalemleri” tek kaynak olduğu belirtilmeli |

### 4. Migration 091 içindeki fatura_kalem_urunler

| Dosya | Not |
|-------|-----|
| `backend/src/migrations/091_fatura_kalem_urunler.sql` | Tanım amaçlı; 092 bu tabloyu `fatura_kalemleri` olarak yeniden adlandırıyor. 091’deki view/fonksiyon isimleri `fatura_kalem_urunler` ile; bu, 092 sonrası kod tabanında kullanılmamalı. |

---

## 📊 API KULLANIM HARİTASI

| Sayfa / modül | Kullanılan endpoint | Durum |
|----------------|---------------------|--------|
| `/muhasebe/faturalar/[ettn]/kalemler` | `/api/fatura-kalemleri/faturalar/:ettn/kalemler`, `/api/fatura-kalemleri/urunler/ara`, `oneriler`, `eslesdir`, `hizli-olustur` | ✅ Tek kaynak |
| `/muhasebe/menu-planlama` | `faturaKalemleriAPI` → `/api/fatura-kalemleri/urunler/maliyet-ozet`, `fiyat-gecmisi`, `guncel-fiyat` vb. | ✅ Tek kaynak |
| `/muhasebe/stok` (faturadan stok) | `stokAPI.getFaturaKalemler` → `/api/stok/faturalar/:ettn/kalemler`, `getAkilliKalemler` → `.../akilli-kalemler` | ⚠️ Paralel kaynak; fatura kalem verisi fatura-kalemleri ile hizalanmalı |
| Ürün fiyat (kart) | `/api/urunler/:id/fiyat` | ℹ️ Ürün kartı fiyatı; fatura kalem single source dışı, ayrı konsept |
| Etiketler | `/api/etiketler/fatura/...` | ℹ️ Fatura etiketi; kalem verisi değil |
| Maliyet analizi | `/api/maliyet-analizi/receteler/:id/maliyet` | ℹ️ Reçete maliyeti; doğrudan fatura kalem endpoint’i değil |

---

## 🗄️ VERİTABANI REFERANSLARI

| Tablo / view | Kullanım (özet) | Durum |
|--------------|------------------|--------|
| **fatura_kalemleri** | `fatura-kalemler.js` route’u (TABLO), 092 migration, 092 view’ları | ✅ Tek kaynak (yeni mimari) |
| **fatura_kalem_urunler** | Sadece 091/092 migration tanımlarında (092’de rename ediliyor) | ✅ Sadece migration; runtime’da tek tablo fatura_kalemleri |
| **invoice_items** | invoices.js, ai-agent.js, remove-placeholder-invoices.js, 004, 011, uyumsoft-sales.js | ⚠️ Eski; kullanılmamalı |
| **uyumsoft_invoice_items** | stok.js, sync-scheduler.js, ai-agent.js, ai-tools/fatura-tools.js, invoice-ai.js, 004 | ⚠️ Eski; fatura kalem verisi için fatura_kalemleri kullanılmalı |

### View kullanımı (fatura-kalemler.js ve migration’lar)

- **v_urun_fiyat_gecmisi_fatura** – 092, 091; fatura-kalemler.js’de kullanılıyor ✅  
- **v_urun_maliyet_ozet** – 092, 091; fatura-kalemler.js’de kullanılıyor ✅  
- **v_urun_guncel_fiyat** – 092; fatura-kalemler.js’de kullanılıyor ✅  
- **v_tedarikci_fiyat_karsilastirma** – 092, 091; fatura-kalemler.js’de kullanılıyor ✅  
- **v_fatura_eslesme_durumu** – 092, 091; fatura-kalemler.js’de kullanılıyor ✅  
- **v_kategori_harcama_raporu** – 092, 091; fatura-kalemler.js’de kullanılıyor ✅ (raporda “Başka fiyat/maliyet view’ı” olarak ek view; fatura kalem single source’a ait)

Diğer fiyat/maliyet view’ları (single source dışı, bilgi):

- `v_maliyet_degisim_ozet` (082), `v_eski_fiyatli_malzemeler`, `v_recete_fiyat_durumu` (081), `v_maliyet_sablon_ozet` (059).

---

## 🧹 TEMİZLİK GEREKLİ Mİ?

- [x] **Evet** – Yukarıdaki sorunlar giderilmeli; özellikle:
  1. **invoice_items / uyumsoft_invoice_items** kullanan tüm backend dosyaları fatura_kalemleri (ve ilgili view’lar) ile uyumlu hale getirilmeli.
  2. **Stok sayfası**ndaki fatura kalem verisi, tek kaynak prensibine uygun olarak `/api/fatura-kalemleri` ile beslenmeli veya stok endpoint’lerinin rolü netleştirilip dokümante edilmeli.
  3. **fatura-kalemler.js** içindeki yorum path’leri `/api/fatura-kalemleri` olacak şekilde düzeltilmeli.
  4. **Migrations README** içinde fatura kalemleri için “fatura_kalemleri”nin tek kaynak olduğu yazılmalı.

- [ ] Hayır – Sistem tamamen “Single Source of Truth” uyumlu değil; yukarıdaki adımlar yapılmadan işaretlenmemeli.

---

## ÖZET

- **Fatura kalem API’si ve frontend kullanımı:** `/api/fatura-kalemleri` ve `fatura-kalemleri` servisi tek kaynak olarak doğru kullanılıyor; menu-planlama ve faturalar/[ettn]/kalemler sayfaları uyumlu.
- **Eski kalıntılar:** `invoice_items` ve `uyumsoft_invoice_items` hâlâ birçok backend dosyasında (routes, services, scripts, eski migration’lar) kullanılıyor; bunların fatura_kalemleri ile değiştirilmesi gerekiyor.
- **Paralel kaynak:** Stok modülündeki `/api/stok/faturalar/:ettn/kalemler` ve `akilli-kalemler` fatura kalem verisi için ikinci bir kaynak oluşturuyor; single source için fatura-kalemleri ile hizalanmalı veya sadece stok işlemine özel sınırlar netleştirilmeli.
- **Dokümantasyon:** Route yorumları ve migrations README, fatura_kalemleri tek kaynak olacak şekilde güncellenmeli.

*Bu rapor yalnızca tarama ve raporlama amaçlıdır; hiçbir dosyada değişiklik yapılmamıştır.*
