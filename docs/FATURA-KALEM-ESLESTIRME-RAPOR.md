# Fatura Kalem Eşleştirme Sistemi – Kontrol & Temizlik Raporu

## 🔍 ESKİ SİSTEM ANALİZİ

| Dosya | Durum | Aksiyon |
|-------|-------|---------|
| invoice-items.js | Bulundu | **Silinmedi** – menu-planlama sayfası `/api/invoice-items` kullanıyor (getTopProducts, getPriceHistory, batchProcess, getItems, getBatchStatus) |
| invoice-parser.js | Kullanılıyor (sadece invoice-items.js) | **Korundu** – invoice-items batch-process bu servisi kullanıyor |
| product-matcher.js | Bulunamadı | Yok |
| uyumsoft-invoice-items (route/dosya) | Bulunamadı | Yok – sadece tablo adı `uyumsoft_invoice_items` mevcut |
| server.js eski ref | Var | **Değiştirilmedi** – `/api/invoice-items` menu-planlama için gerekli |

**Not:** “Eski karmaşık eşleştirme” dediğimiz ekran zaten **fatura-kalemler** ve `/muhasebe/faturalar/[ettn]/kalemler` ile değiştirilmiş. `invoice-items.js` eşleştirme yapmıyor; fatura kalem listesi, fiyat geçmişi, top products ve Uyumsoft batch işlemi sunuyor. Bu API menü planlama sayfasında kullanıldığı için kaldırılmadı.

---

## ✅ YENİ SİSTEM DURUMU

| Bileşen | Dosya | Durum |
|---------|-------|--------|
| Migration | 091_fatura_kalem_urunler.sql | ✅ |
| Backend route | fatura-kalemler.js | ✅ |
| Server.js kaydı | app.use('/api/fatura-kalemler', faturaKalemlerRouter) | ✅ |
| Frontend sayfa | [ettn]/kalemler/page.tsx | ✅ |
| UI butonu | Faturalar listesinde “Kalemler & Eşleştir” → `/muhasebe/faturalar/${ettn}/kalemler` | ✅ |
| Uyumsoft sekmesi | Aynı buton Uyumsoft faturalarından da açılıyor | ✅ |

---

## 📊 YENİ SİSTEM ŞEMASI

```
┌─────────────────────────────────────────────────────────────────┐
│                    YENİ SİSTEM MİMARİSİ                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  DATABASE                                                        │
│  ├── fatura_kalem_urunler (ana tablo)                            │
│  ├── v_urun_fiyat_gecmisi_fatura (view)                          │
│  ├── v_urun_maliyet_ozet (view)                                  │
│  ├── v_tedarikci_fiyat_karsilastirma (view)                      │
│  ├── v_fatura_eslesme_durumu (view)                              │
│  ├── v_kategori_harcama_raporu (view)                            │
│  ├── onerilen_urun_eslestir() (function)                         │
│  └── fatura_kalemlerini_kaydet() (function)                      │
│                                                                  │
│  BACKEND API: /api/fatura-kalemler                               │
│  ├── GET  /faturalar/:ettn/kalemler                              │
│  ├── POST /faturalar/:ettn/kalemler/:sira/eslesdir              │
│  ├── POST /faturalar/:ettn/toplu-eslesdir                        │
│  ├── GET  /oneriler                                              │
│  ├── GET  /urunler/ara                                           │
│  ├── POST /urunler/hizli-olustur                                 │
│  ├── GET  /raporlar/maliyet-ozet                                 │
│  ├── GET  /raporlar/tedarikci-karsilastirma                      │
│  ├── GET  /raporlar/eslesme-durumu                               │
│  ├── GET  /raporlar/fiyat-gecmisi/:urunId                        │
│  └── GET  /raporlar/kategori-harcama                             │
│                                                                  │
│  FRONTEND                                                        │
│  ├── /muhasebe/faturalar (liste – “Kalemler & Eşleştir” butonu)  │
│  └── /muhasebe/faturalar/[ettn]/kalemler (eşleştirme sayfası)   │
│                                                                  │
│  AKIŞ                                                            │
│  Fatura → Kalemler listele → Kullanıcı ürün seç → Kaydet         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🧪 TEST TALİMATLARI

1. **Migration çalıştır:**
   ```bash
   cd /Users/numanaydar/Desktop/CATERİNG/backend
   node src/run-migrations.js
   # veya projede kullanılan migration aracı
   ```

2. **Backend başlat:**
   ```bash
   npm run dev
   ```

3. **Endpoint testi:**
   ```bash
   curl http://localhost:3001/api/fatura-kalemler/faturalar/TEST-ETTN/kalemler
   ```
   (TEST-ETTN yerine gerçek bir ETTN kullanın; fatura yoksa `data: []` ve `faturaBulunamadi: true` döner.)

4. **Tarayıcıda:**
   - `/muhasebe/faturalar` sayfasına gidin.
   - Uyumsoft sekmesinden bir fatura seçip “Kalemler & Eşleştir”e tıklayın.
   - Ürün eşleştirme yapıp kaydedin.

---

## 📁 DOKUNULMAYAN DOSYALAR (Talimat ile)

- `/backend/src/routes/fatura-kalemler.js`
- `/backend/src/migrations/091_fatura_kalem_urunler.sql`
- `/frontend/src/app/muhasebe/faturalar/[ettn]/kalemler/page.tsx`
- `/backend/src/database.js`
- `.env` dosyaları

---

## 🔗 ESKİ API’NİN KULLANIM YERİ

`/api/invoice-items` şu an **sadece** menü planlama sayfasında kullanılıyor:

- **Dosya:** `frontend/src/app/muhasebe/menu-planlama/page.tsx`
- **Servis:** `frontend/src/lib/api/services/invoice-items.ts`
- **Kullanım:** getTopProducts, getPriceHistory, getBatchStatus, batchProcess, getItems

Bu nedenle `invoice-items.js` ve `invoice-parser.js` kaldırılmadı. İleride menü planlama, fatura-kalemler view’larına (örn. `v_urun_maliyet_ozet`, `v_urun_fiyat_gecmisi_fatura`) taşınırsa bu iki dosya da kaldırılabilir.
