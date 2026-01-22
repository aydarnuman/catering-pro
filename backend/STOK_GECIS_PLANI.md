# STOK SİSTEMİ GEÇİŞ PLANI
## stok_kartlari → urun_kartlari

**Tarih:** 2026-01-20
**Durum:** ✅ TAMAMLANDI

---

## MEVCUT DURUM ANALİZİ (Başlangıç)

| Sistem | Tablo | Kayıt | Aktif | Durum |
|--------|-------|-------|-------|-------|
| ESKİ | stok_kartlari | 80 | 0 | ❌ Kullanılmıyor |
| YENİ | urun_kartlari | 238 | 125 | ✅ Aktif |
| ESKİ | stok_hareketleri | 1 | - | ❌ Kullanılmıyor |
| YENİ | urun_hareketleri | 17 | - | ✅ Aktif |

**Sonuç:** Veriler YENİ sistemdeydi, kod ESKİ tabloları sorguluyordu.

---

## YAPILAN DEĞİŞİKLİKLER

### ✅ Aşama 1: stok.js Kritik Düzeltmeler

| Endpoint | Değişiklik |
|----------|------------|
| `GET /kartlar/:id` | `stok_kartlari` → `urun_kartlari` |
| `POST /kartlar` | `stok_kartlari` → `urun_kartlari` |
| `GET /hareketler` | `stok_hareketleri` → `urun_hareketleri` |
| `POST /hareketler/giris` | `stok_hareketleri` → `urun_hareketleri` + trigger |
| `POST /hareketler/cikis` | `stok_hareketleri` → `urun_hareketleri` + trigger |
| `POST /hareketler/transfer` | `stok_hareketleri` → `urun_hareketleri` + trigger |
| `GET /kritik` | `v_kritik_stoklar` → direkt `urun_kartlari` sorgusu |
| `GET /rapor/deger` | `stok_kartlari` → `urun_kartlari` |
| `GET /kategoriler` | `stok_kategoriler` → `urun_kategorileri` |
| `GET /depolar/:id/lokasyonlar` | `stok_depo_durumlari` → `urun_depo_durumlari` |
| `GET /lokasyonlar/:id/stoklar` | `stok_kartlari` → `urun_kartlari` |

### ✅ Aşama 2: Reçete Sistemi

**maliyet-analizi.js:**
- `LEFT JOIN stok_kartlari sk` → `LEFT JOIN urun_kartlari uk`
- `rm.stok_kart_id` → `rm.urun_kart_id`
- `sk.son_alis_fiyat` → `uk.son_alis_fiyati`

**menu-planlama.js:**
- Reçete detay sorgusu tamamen yeniden yazıldı
- `urun_fiyat_gecmisi` tablosu kullanıma alındı
- Eski `stok_kartlari` JOIN'leri kaldırıldı

### ✅ Aşama 3: Piyasa Takibi

**planlama.js:**
- `LEFT JOIN stok_kartlari sk` → `LEFT JOIN urun_kartlari uk`

### ✅ Aşama 4: Yardımcı Modüller

**export.js:**
- `SELECT * FROM stok_kartlari` → `SELECT * FROM urun_kartlari`
- Kritik stok raporu yeni sisteme geçirildi

**search.js:**
- Değişiklik gerekmedi (zaten yeni sistemi kullanıyordu)

---

## TABLO DÖNÜŞÜM REFERANSI

| ESKİ | YENİ |
|------|------|
| stok_kartlari | urun_kartlari |
| stok_depo_durumlari | urun_depo_durumlari |
| stok_hareketleri | urun_hareketleri |
| stok_kategoriler | urun_kategorileri |
| stok_fiyat_gecmisi | urun_fiyat_gecmisi |
| fatura_urun_eslestirme | urun_tedarikci_eslestirme |

## ALAN DÖNÜŞÜM REFERANSI

| ESKİ | YENİ |
|------|------|
| stok_kart_id | urun_kart_id |
| son_alis_fiyat | son_alis_fiyati |
| giris_depo_id | hedef_depo_id |
| cikis_depo_id | kaynak_depo_id |

---

## GERİYE UYUMLULUK

API'ler geriye uyumlu tutuldu:
- `stok_kart_id` parametresi hala kabul ediliyor (`urun_kart_id` ile eşleştiriliyor)
- Response'larda eski alan isimleri alias olarak eklendi

---

### ✅ Aşama 5: Planlama.js Tam Geçiş

**planlama.js:**
- Tüm `stok_kartlari` referansları → `urun_kartlari`
- Tüm `stok_kategoriler` referansları → `urun_kategorileri`
- `son_alis_fiyat` → `son_alis_fiyati`
- Ana ürünler API'leri yeni sisteme geçirildi
- Fatura fiyatları ve karşılaştırma sorguları güncellendi
- Ambalaj parse fonksiyonları yeni sisteme geçirildi
- Eşleşmemiş kartlar listesi yeni sisteme geçirildi

---

## KALAN İŞLER (Opsiyonel)

1. **Veri Migrasyonu:** 378 bağlantısız reçete malzemesi ürün kartlarına eşleştirilebilir
2. **Piyasa Takibi:** `piyasa_fiyat_gecmisi` tablosundaki `stok_kart_id` → `urun_kart_id` olarak yeniden adlandırılabilir
3. **Eski Tabloları Arşivle:** `stok_kartlari_arsiv` zaten var, diğerleri de arşivlenebilir

---

## TEST SONUÇLARI

```
✅ src/routes/stok.js - Syntax OK
✅ src/routes/urunler.js - Syntax OK
✅ src/routes/menu-planlama.js - Syntax OK
✅ src/routes/maliyet-analizi.js - Syntax OK
✅ src/routes/planlama.js - Syntax OK
✅ src/routes/export.js - Syntax OK
✅ src/routes/search.js - Syntax OK
```
