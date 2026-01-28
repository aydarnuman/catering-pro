# CORE SİSTEM RAPORU – Fatura Kalemleri

## Genel

Fatura kalem CORE yapısı kuruldu: **Uyumsoft → fatura_kalemleri → Etiketleme → Fiyat**. Stok, menü maliyet ve AI tarafına dokunulmadı; bunlar ileride bu yapıdan beslenecek.

---

## Oluşturulan / Güncellenen

- [x] **093_fatura_kalemleri_core.sql**  
  - `fatura_kalemleri` tablosu (IF NOT EXISTS), `updated_at` kolonu  
  - Index’ler: ettn, urun_id, fatura_tarihi, tedarikci_vkn, trigram (orijinal_urun_adi)  
  - View’lar: `v_urun_guncel_fiyat`, `v_urun_fiyat_gecmisi`, `v_fatura_eslesme_durumu` (uyumsoft_invoices ile)  
  - Fonksiyon: `onerilen_urun_bul(p_urun_adi, p_tedarikci_vkn)`  
  - Trigger: `tr_fatura_kalemleri_updated` (updated_at)

- [x] **fatura-kalemler.js** (backend)  
  - DELETE `/faturalar/:ettn/kalemler/:sira/eslesme` eklendi  
  - Diğer endpoint’ler aynı kaldı (kalemler, eslesdir, toplu-eslesdir, oneriler, urunler/ara, fiyat-gecmisi, guncel-fiyat, hizli-olustur, raporlar)

- [x] **fatura-kalemleri.ts** (frontend servis)  
  - `topluEslesdir(ettn, eslesmeler)`, `eslesmeKaldir(ettn, sira)`, `getGuncelFiyatlar(params)`, `getEslesmeDurumu(params)` eklendi  
  - Açıklamalar CORE “tek kaynak” mantığına göre güncellendi

- [x] **kalemler/page.tsx**  
  - Tüm istekler `faturaKalemleriAPI` ile yapılıyor  
  - `getKalemler`, `urunAra`, `getOneriler`, `eslesdir` / `eslesmeKaldir`, `hizliOlustur` kullanılıyor

---

## Silinen Eski Referanslar

Hedeflenen dört dosyada **invoice_items** ve **uyumsoft_invoice_items** hiç kullanılmıyormuş; bu yüzden bu dosyalarda kaldırılacak referans yok:

- `/backend/src/routes/fatura-kalemler.js` – yok
- `/backend/src/server.js` – yok
- `/frontend/src/app/muhasebe/faturalar/[ettn]/kalemler/page.tsx` – yok
- `/frontend/src/lib/api/services/fatura-kalemleri.ts` – yok

*(Eski tablolar başka dosyalarda kullanılmaya devam ediyor; CORE kapsamında dokunulmadı.)*

---

## API Endpoint’leri

| Metot | Endpoint | Durum |
|-------|----------|--------|
| GET | `/api/fatura-kalemleri/faturalar/:ettn/kalemler` | Var |
| POST | `/api/fatura-kalemleri/faturalar/:ettn/kalemler/:sira/eslesdir` | Var |
| DELETE | `/api/fatura-kalemleri/faturalar/:ettn/kalemler/:sira/eslesme` | **Yeni** |
| POST | `/api/fatura-kalemleri/faturalar/:ettn/toplu-eslesdir` | Var |
| GET | `/api/fatura-kalemleri/urunler/ara` | Var |
| GET | `/api/fatura-kalemleri/oneriler` | Var |
| POST | `/api/fatura-kalemleri/urunler/hizli-olustur` | Var |
| GET | `/api/fatura-kalemleri/urunler/guncel-fiyat` | Var |
| GET | `/api/fatura-kalemleri/urunler/fiyat-gecmisi/:urunId` | Var |
| GET | `/api/fatura-kalemleri/raporlar/eslesme-durumu` | Var |

---

## Test Önerileri

1. **Migration**  
   - `node src/run-migrations.js` veya projedeki migration runner ile 093’ü çalıştırın.

2. **Backend**  
   - `npm run dev` ile backend’i ayağa kaldırın.

3. **Faturalar**  
   - `/muhasebe/faturalar` sayfasından bir Uyumsoft faturasını açıp “Kalemler & Eşleştir”e gidin.

4. **Kontrol listesi**  
   - [ ] Kalem listesi geliyor mu?  
   - [ ] Ürün arama (dropdown) çalışıyor mu?  
   - [ ] Tek kalem eşleştirme kaydediliyor mu?  
   - [ ] “Eşleştirmeyi kaldır” ile DELETE endpoint’i tetiklenip kalem güncelleniyor mu?  
   - [ ] Güncel fiyat / fiyat geçmişi görüntülenebiliyor mu?

---

## Dosya Yapısı (CORE tarafı)

```
backend/
├── routes/
│   └── fatura-kalemler.js    ← Tek kalem API (CORE)
├── migrations/
│   └── 093_fatura_kalemleri_core.sql

frontend/
├── lib/api/services/
│   └── fatura-kalemleri.ts   ← Tek kalem servisi (CORE)
├── app/muhasebe/faturalar/
│   └── [ettn]/kalemler/
│       └── page.tsx         ← Kalemler UI (faturaKalemleriAPI kullanıyor)
```

---

## Kurallar (Uygulanan)

- Bu CORE dosyalarında **invoice_items** / **uyumsoft_invoice_items** kullanılmıyor.
- Tek tablo: **fatura_kalemleri**.
- Tek API prefix: **/api/fatura-kalemleri**.
- ES Modules ve Türkçe yorum kullanılıyor.

## Dokunulmayan (Kapsam Dışı)

- `/backend/src/routes/stok.js`
- `/backend/src/routes/invoices.js`
- `/backend/src/services/ai-*.js`
- `/backend/src/services/sync-*.js`
- `/frontend/src/app/muhasebe/stok/`
- `/frontend/src/app/muhasebe/menu-planlama/`
- `backend/src/database.js` ve `.env` dosyaları
