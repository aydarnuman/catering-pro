# TAM TEMİZLİK RAPORU – Eski Fatura Kalem Referansları

## Özet

Projede kalan tüm `invoice_items` ve `uyumsoft_invoice_items` referansları temizlendi. Tek kaynak: **fatura_kalemleri** tablosu ve **/api/fatura-kalemleri** API'si.

---

## Temizlenen dosyalar

| Dosya | Eski referans | Yapılan |
|-------|----------------|--------|
| backend/src/routes/stok.js | `uyumsoft_invoice_items` (kalem_sayisi) | `(SELECT COUNT(*) FROM fatura_kalemleri WHERE fatura_ettn = ui.ettn) as kalem_sayisi` |
| backend/src/routes/invoices.js | `invoice_items` (liste, detay, POST/PUT kalemleri) | Liste/detayda `items: []`; POST/PUT'ta kalem yazılmıyor; summary/category fatura_kalemleri + urun_kategorileri ile |
| backend/src/services/ai-agent.js | `invoice_items`, `uyumsoft_invoice_items` | Tek sorgu: `fatura_kalemleri` + uyumsoft_invoices + urun_kartlari/urun_kategorileri |
| backend/src/services/invoice-ai.js | `invoice_items`, `uyumsoft_invoice_items` | Kategori sorgusu `fatura_kalemleri` üzerinden; uyumsoftItems = manual sonucu |
| backend/src/services/ai-tools/fatura-tools.js | `uyumsoft_invoice_items` | get_efatura_detay kalemleri `fatura_kalemleri WHERE fatura_ettn = $1`; analyze_tedarikci/analyze_kategori_harcama fatura_kalemleri + urun_kartlari/kat |
| backend/src/services/sync-scheduler.js | `uyumsoft_invoice_items` | Kategori özeti `fatura_kalemleri` + uyumsoft_invoices + urun_kategorileri |
| backend/src/services/uyumsoft-sales.js | `invoice_items` | Kalem okuma kaldırıldı; `uyumsoftInvoice.lines = []` (manuel fatura kalemleri deprecated) |

---

## Silinen dosyalar

- **backend/src/scripts/remove-placeholder-invoices.js** – `invoice_items` kullanıyordu, artık gerekli değil.

---

## Kalan referanslar (sadece migration)

- **004_invoices_schema.sql** – Eski şema; `invoice_items`, `uyumsoft_invoice_items` tanımları burada. Dokunulmadı.
- **011_duplicate_detection.sql** – `invoice_items` referansı burada. Dokunulmadı.

**Migrations README:** Deprecated not eklendi: *"Eski tablolar (invoice_items, uyumsoft_invoice_items) deprecated. Yeni sistem: fatura_kalemleri"*

---

## Doğrulama

```bash
grep -rn "invoice_items" backend/src/ --include="*.js"
# Sonuç: 0

grep -rn "uyumsoft_invoice_items" backend/src/ --include="*.js"
# Sonuç: 0
```

*(Migration .sql dosyaları hariç; 004 ve 011’de tanım/referans duruyor.)*

---

## Kolon eşleştirmesi (referans)

| Eski | Yeni |
|------|------|
| invoice_items.product_name / description | fatura_kalemleri.orijinal_urun_adi |
| invoice_items.product_code | fatura_kalemleri.orijinal_urun_kodu |
| invoice_items.quantity | fatura_kalemleri.miktar |
| invoice_items.unit | fatura_kalemleri.birim |
| invoice_items.unit_price | fatura_kalemleri.birim_fiyat |
| invoice_items.line_total / total_price | fatura_kalemleri.tutar |
| invoice_items.vat_rate | fatura_kalemleri.kdv_orani |
| uyumsoft_invoice_items.uyumsoft_invoice_id → ui.id | fatura_kalemleri.fatura_ettn = ui.ettn |
| uyumsoft_invoice_items.line_number | fatura_kalemleri.kalem_sira |
| uyumsoft_invoice_items.ai_category | urun_kartlari → urun_kategorileri.ad (LEFT JOIN) |

---

## Kullanılan view’lar

- **v_urun_guncel_fiyat** – Son/ortalama fiyat
- **v_urun_fiyat_gecmisi** – Fiyat geçmişi
- **v_fatura_eslesme_durumu** – Eşleşme durumu

---

## Kurallar (uygulandı)

- Uygulama .js dosyalarında `invoice_items` ve `uyumsoft_invoice_items` kullanılmıyor (migration hariç).
- Fatura kalemi tek tablosu: **fatura_kalemleri**.
- Türkçe yorumlar eklendi/güncellendi.
