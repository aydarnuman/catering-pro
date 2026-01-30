# SERVİS ANALİZ PROMPTLARI

Her servis için aşağıdaki promptu Cursor'a ver.
Şablon referansı otomatik olarak okunacak.

---

## KULLANIM

```
1. Aşağıdan ilgili servisi kopyala
2. Cursor'a yapıştır
3. Analiz tamamlanınca /docs/analiz/[servis]-analizi.md olarak kaydet
```

---

## 1. STOK SERVİSİ

```
/docs/cursor-templates/SERVIS-ANALIZ-SABLONU.md dosyasını oku ve şablonu STOK servisine uygula.

ÖNCE OKU:
- /backend/src/routes/stok.js
- /backend/src/routes/urunler.js
- /frontend/src/app/muhasebe/stok/page.tsx
- /frontend/src/app/muhasebe/stok/hooks/useStokData.tsx
- /frontend/src/app/muhasebe/stok/types.ts
- /frontend/src/app/muhasebe/stok/components/modals/ (tüm dosyalar)
- /backend/src/migrations/ içinde stok ile ilgili migration'lar

ÖZEL DİKKAT:
- Stok hareketleri (giriş/çıkış/transfer/sayım) akışları
- Fatura-stok entegrasyonu
- Depo/lokasyon yapısı
- Birim dönüşüm mantığı

Şablondaki TÜM bölümleri doldur.
```

---

## 2. FATURALAR SERVİSİ

```
/docs/cursor-templates/SERVIS-ANALIZ-SABLONU.md dosyasını oku ve şablonu FATURALAR servisine uygula.

ÖNCE OKU:
- /backend/src/routes/invoices.js
- /backend/src/routes/fatura-kalemler.js
- /backend/src/routes/uyumsoft.js
- /backend/src/services/invoice-ai.js
- /backend/src/services/fatura-kalemleri-client.js
- /backend/src/scraper/uyumsoft/ (tüm dosyalar)
- /frontend/src/app/muhasebe/faturalar/page.tsx
- /frontend/src/app/muhasebe/faturalar/hooks/ (tüm dosyalar)
- /frontend/src/app/muhasebe/faturalar/types/index.ts
- /frontend/src/app/muhasebe/faturalar/components/ (tüm dosyalar)
- /frontend/src/app/muhasebe/faturalar/[ettn]/kalemler/page.tsx
- /backend/src/migrations/ içinde fatura ile ilgili migration'lar

ÖZEL DİKKAT:
- Alış/Satış fatura akışları
- Uyumsoft e-fatura entegrasyonu
- Fatura kalemleri → Stok aktarım süreci
- AI ürün eşleştirme mantığı
- Cari bakiye güncelleme trigger'ları

Şablondaki TÜM bölümleri doldur.
```

---

## 3. CARİLER SERVİSİ

```
/docs/cursor-templates/SERVIS-ANALIZ-SABLONU.md dosyasını oku ve şablonu CARİLER servisine uygula.

ÖNCE OKU:
- /backend/src/routes/cariler.js
- /backend/src/routes/mutabakat.js
- /backend/src/routes/firmalar.js
- /backend/src/services/firma-belge-service.js
- /frontend/src/app/muhasebe/cariler/page.tsx
- /backend/src/migrations/ içinde cari ile ilgili migration'lar

ÖZEL DİKKAT:
- Cari türleri (müşteri/tedarikçi/hem ikisi) yapısı
- Cari hareket ve bakiye hesaplama mantığı
- Fatura → Cari hareket otomatik oluşturma
- Mutabakat süreci
- Firma vs Cari farkı

Şablondaki TÜM bölümleri doldur.
```

---

## 4. PERSONEL + BORDRO SERVİSİ

```
/docs/cursor-templates/SERVIS-ANALIZ-SABLONU.md dosyasını oku ve şablonu PERSONEL ve BORDRO servislerine uygula.

ÖNCE OKU:
- /backend/src/routes/personel.js
- /backend/src/routes/bordro.js
- /backend/src/routes/bordro-import.js
- /backend/src/routes/maas-odeme.js
- /backend/src/routes/izin.js
- /backend/src/services/bordro-import-service.js
- /backend/src/services/bordro-template-service.js
- /backend/src/services/tazminat-service.js
- /frontend/src/app/muhasebe/personel/page.tsx
- /backend/src/data/mevzuat/ (tüm JSON dosyaları)
- /backend/src/migrations/ içinde personel/bordro ile ilgili migration'lar

ÖZEL DİKKAT:
- Personel → Proje ataması akışı
- Bordro hesaplama formülleri (brüt→net)
- SGK/vergi kesinti hesaplamaları
- İzin yönetimi ve kıdem hesabı
- Maaş ödeme süreci
- Tazminat hesaplama mantığı
- Excel import akışı
- Mevzuat JSON'larındaki oranlar

Şablondaki TÜM bölümleri doldur. Bu iki servisi BİRLİKTE analiz et.
```

---

## 5. İHALELER SERVİSİ

```
/docs/cursor-templates/SERVIS-ANALIZ-SABLONU.md dosyasını oku ve şablonu İHALELER servisine uygula.

ÖNCE OKU:
- /backend/src/routes/tenders.js
- /backend/src/routes/tender-documents.js
- /backend/src/routes/tender-content-documents.js
- /backend/src/routes/tender-notes.js
- /backend/src/routes/tender-tracking.js
- /backend/src/routes/tender-dilekce.js
- /backend/src/routes/ihale-sonuclari.js
- /backend/src/routes/teklifler.js
- /backend/src/routes/firmalar.js
- /backend/src/services/tender-content-service.js
- /backend/src/services/tender-scheduler.js
- /backend/src/scraper/ (ihalebul.com scraper)
- /backend/src/jobs/tender-status-updater.js
- /frontend/src/app/tenders/page.tsx
- /frontend/src/app/tenders/[id]/page.tsx
- /frontend/src/app/tracking/page.tsx
- /frontend/src/app/ihale-uzmani/page.tsx
- /backend/src/migrations/ içinde ihale/tender ile ilgili migration'lar

ÖZEL DİKKAT:
- İhale yaşam döngüsü (ilan→teklif→sonuç)
- ihalebul.com scraper çalışma mantığı
- Doküman indirme ve işleme akışı
- Teklif hesaplama ve tracking
- Firma yeterlilik belgeleri yönetimi
- AI ihale uzmanı entegrasyonu
- Scheduler job'ları
- İhale durumları (status) listesi

Şablondaki TÜM bölümleri doldur.
```

---

## ÇIKTI KAYDETME

Her analiz sonrası:

```
Bu analizi /docs/analiz/[servis]-analizi.md olarak kaydet.
```

Örnek:
- `/docs/analiz/stok-analizi.md`
- `/docs/analiz/faturalar-analizi.md`
- `/docs/analiz/cariler-analizi.md`
- `/docs/analiz/personel-bordro-analizi.md`
- `/docs/analiz/ihaleler-analizi.md`

---

## TAHMİNİ SÜRE

| Servis | Karmaşıklık | Süre |
|--------|-------------|------|
| Stok | Yüksek | 2-3 saat |
| Faturalar | Yüksek | 2-3 saat |
| Cariler | Orta | 1-2 saat |
| Personel+Bordro | Yüksek | 2-3 saat |
| İhaleler | Yüksek | 2-3 saat |

**Toplam:** ~10-14 saat (2-3 gün)
