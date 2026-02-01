# Fiyat Yönetimi API Referansı

Base URL: `/api/fiyat-yonetimi`

## Kimlik Doğrulama

Tüm `POST`, `PUT`, `DELETE` istekleri için JWT token gereklidir:

```
Authorization: Bearer <token>
```

---

## Dashboard

### GET /dashboard

Genel istatistikler ve özet bilgiler.

**Response:**
```json
{
  "success": true,
  "data": {
    "ozet": {
      "toplam_urun": 243,
      "fiyatli_urun": 240,
      "guncel_fiyat": 180,
      "eski_fiyat": 45,
      "ortalama_guven": 78,
      "sozlesme_fiyatli": 25,
      "fatura_fiyatli": 120,
      "piyasa_fiyatli": 15,
      "manuel_fiyatli": 40,
      "varsayilan_fiyatli": 40
    },
    "kategoriler": [
      {
        "kategori_id": 1,
        "kategori_ad": "Et & Tavuk",
        "urun_sayisi": 22,
        "guncel_fiyat": 18,
        "eski_fiyat": 4,
        "ortalama_guven": 85
      }
    ],
    "kaynaklar": [
      {
        "kod": "FATURA",
        "ad": "Fatura Girişi",
        "guvenilirlik_skoru": 95,
        "urun_sayisi": 120,
        "son_basarili_guncelleme": "2026-01-31T10:00:00Z"
      }
    ],
    "uyarilar": {
      "ANOMALI": 5,
      "ESKIMIS": 13
    }
  }
}
```

---

## Ürün İşlemleri

### GET /urunler

Ürün listesi fiyat durumu ile.

**Query Parametreleri:**
| Parametre | Tip | Açıklama |
|-----------|-----|----------|
| `search` | string | Ürün adı/kodu ara |
| `kategori_id` | number | Kategori filtresi |
| `tip` | string | SOZLESME/FATURA/PIYASA/MANUEL/VARSAYILAN |
| `guncellik` | string | guncel/eski |
| `limit` | number | Sayfa başı kayıt (varsayılan: 100) |
| `offset` | number | Atlama sayısı |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "kod": "ET-0001",
      "ad": "Dana Kıyma",
      "varsayilan_birim": "kg",
      "aktif_fiyat": 650.00,
      "aktif_fiyat_tipi": "SOZLESME",
      "aktif_fiyat_guven": 100,
      "aktif_fiyat_guncelleme": "2026-01-30T14:00:00Z",
      "kategori_ad": "Et & Tavuk",
      "kaynak_adi": "Tedarikçi Sözleşmesi",
      "guncellik_durumu": "guncel",
      "gun_farki": 1,
      "tipLabel": "Tedarikçi Sözleşmesi"
    }
  ],
  "total": 243
}
```

### GET /urunler/:id

Tek ürün fiyat detayı.

**Response:**
```json
{
  "success": true,
  "data": {
    "urun": {
      "id": 1,
      "kod": "ET-0001",
      "ad": "Dana Kıyma",
      "varsayilan_birim": "kg",
      "aktif_fiyat": 650.00,
      "aktif_fiyat_tipi": "SOZLESME",
      "aktif_fiyat_guven": 100,
      "aktif_fiyat_guncelleme": "2026-01-30T14:00:00Z",
      "manuel_fiyat": 600.00,
      "son_alis_fiyati": 640.00,
      "kaynak_adi": "Tedarikçi Sözleşmesi",
      "tipLabel": "Tedarikçi Sözleşmesi"
    },
    "tedarikci_fiyatlari": [
      {
        "id": 1,
        "fiyat": 650.00,
        "birim": "kg",
        "aktif": true,
        "sozlesme_no": "SZ-2026-001",
        "tedarikci_adi": "ABC Et Ltd",
        "gecerlilik_bitis": "2026-06-30"
      }
    ],
    "fiyat_gecmisi": [
      {
        "id": 100,
        "fiyat": 650.00,
        "tarih": "2026-01-30",
        "kaynak": "Tedarikçi sözleşmesi",
        "kaynak_adi": "Tedarikçi Sözleşmesi",
        "kaynak_kodu": "TEDARIKCI"
      },
      {
        "id": 95,
        "fiyat": 640.00,
        "tarih": "2026-01-25",
        "kaynak": "Fatura: ABC Et Ltd",
        "kaynak_adi": "Fatura Girişi",
        "kaynak_kodu": "FATURA"
      }
    ],
    "istatistikler": {
      "min_fiyat": 600.00,
      "max_fiyat": 680.00,
      "ort_fiyat": 640.00,
      "kayit_sayisi": 12
    }
  }
}
```

### GET /urunler/:id/gecmis

Ürün fiyat geçmişi.

**Query Parametreleri:**
| Parametre | Tip | Açıklama |
|-----------|-----|----------|
| `limit` | number | Kayıt sayısı (varsayılan: 50) |
| `kaynak_id` | number | Kaynak filtresi |
| `baslangic` | date | Başlangıç tarihi |
| `bitis` | date | Bitiş tarihi |

### GET /urunler/:id/tedarikci

Tedarikçi karşılaştırma.

**Response:**
```json
{
  "success": true,
  "data": {
    "sozlesmeler": [
      {
        "id": 1,
        "fiyat": 650.00,
        "birim": "kg",
        "aktif": true,
        "tedarikci_adi": "ABC Et Ltd",
        "gecerlilik_bitis": "2026-06-30"
      }
    ],
    "fatura_gecmisi": [
      {
        "cari_id": 5,
        "tedarikci_adi": "XYZ Gıda",
        "fatura_sayisi": 8,
        "ort_fiyat": 660.00,
        "min_fiyat": 640.00,
        "max_fiyat": 680.00,
        "son_alis_tarihi": "2026-01-20"
      }
    ]
  }
}
```

### POST /urunler/:id/hesapla

Fiyat yeniden hesapla.

**Auth:** Gerekli

**Response:**
```json
{
  "success": true,
  "data": {
    "fiyat": 650.00,
    "tip": "SOZLESME",
    "kaynak_id": 1,
    "guven": 100,
    "tipLabel": "Tedarikçi Sözleşmesi"
  },
  "message": "Fiyat yeniden hesaplandı"
}
```

### POST /urunler/:id/fiyat

Manuel fiyat gir.

**Auth:** Gerekli

**Body:**
```json
{
  "fiyat": 650.00,
  "birim": "kg",
  "aciklama": "Piyasa araştırması sonucu"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "gecmis_kayit": { ... },
    "aktif_fiyat": {
      "fiyat": 650.00,
      "tip": "MANUEL",
      "guven": 50
    }
  },
  "message": "Fiyat kaydedildi"
}
```

---

## Tedarikçi Sözleşmeleri

### GET /sozlesmeler

Tüm sözleşme özetleri.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "cari_id": 1,
      "tedarikci_adi": "ABC Et Ltd",
      "urun_sayisi": 15,
      "en_yakin_bitis": "2026-06-30",
      "aktif_sayisi": 15,
      "son_guncelleme": "2026-01-30T10:00:00Z"
    }
  ]
}
```

### GET /sozlesmeler/:cariId

Tedarikçi sözleşme detayı.

### POST /sozlesmeler/fiyat

Sözleşme fiyatı ekle/güncelle.

**Auth:** Gerekli

**Body:**
```json
{
  "urun_kart_id": 1,
  "cari_id": 5,
  "fiyat": 650.00,
  "birim": "kg",
  "kdv_dahil": false,
  "min_siparis_miktar": 10,
  "teslim_suresi_gun": 2,
  "gecerlilik_baslangic": "2026-01-01",
  "gecerlilik_bitis": "2026-06-30",
  "sozlesme_no": "SZ-2026-001"
}
```

### DELETE /sozlesmeler/fiyat/:id

Sözleşme fiyatı sil.

**Auth:** Gerekli

---

## Toplu İşlemler

### POST /toplu/yeniden-hesapla

Tüm ürünlerin aktif fiyatını yeniden hesapla.

**Auth:** Gerekli

**Response:**
```json
{
  "success": true,
  "data": {
    "basarili": 240,
    "hatali": 3
  },
  "message": "240 ürün başarıyla güncellendi, 3 hata"
}
```

### POST /toplu/hesapla

Seçili ürünler için fiyat hesapla.

**Auth:** Gerekli

**Body:**
```json
{
  "urun_ids": [1, 2, 3, 4, 5]
}
```

### POST /toplu/guncelle

Kategori bazlı toplu güncelleme.

**Auth:** Gerekli

**Body:**
```json
{
  "kategori_id": 5,
  "islem": "yuzde_artir",
  "deger": 10,
  "aciklama": "Şubat 2026 enflasyon güncellemesi"
}
```

**İşlem Tipleri:**
- `yuzde_artir` - Yüzde artır (%)
- `yuzde_azalt` - Yüzde azalt (%)
- `sabit_ekle` - Sabit tutar ekle (TL)
- `sabit_cikar` - Sabit tutar çıkar (TL)

---

## Uyarılar

### GET /uyarilar

Uyarı listesi.

**Query Parametreleri:**
| Parametre | Tip | Açıklama |
|-----------|-----|----------|
| `tip` | string | ANOMALI/ESKIMIS |
| `cozulmemis` | boolean | Sadece çözülmemiş |
| `limit` | number | Kayıt sayısı |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "urun_kart_id": 10,
      "urun_kod": "SBZ-0001",
      "urun_ad": "Domates",
      "uyari_tipi": "ANOMALI",
      "uyari_mesaji": "Fiyat %45 arttı",
      "onceki_fiyat": 28.00,
      "yeni_fiyat": 42.00,
      "degisim_orani": 50.0,
      "onem_derecesi": "yuksek",
      "okundu": false,
      "cozuldu": false,
      "created_at": "2026-01-30T08:00:00Z"
    }
  ]
}
```

### PUT /uyarilar/:id/okundu

Okundu işaretle.

### PUT /uyarilar/:id/cozuldu

Çözüldü işaretle.

### POST /uyarilar/toplu-okundu

Toplu okundu işaretle.

**Body:**
```json
{
  "ids": [1, 2, 3]
}
```

---

## Raporlar

### GET /raporlar/guncellik

Fiyat güncellik raporu.

**Response:**
```json
{
  "success": true,
  "data": [
    { "guncellik_durumu": "guncel", "urun_sayisi": 180 },
    { "guncellik_durumu": "eski", "urun_sayisi": 45 },
    { "guncellik_durumu": "cok_eski", "urun_sayisi": 15 },
    { "guncellik_durumu": "belirsiz", "urun_sayisi": 3 }
  ]
}
```

### GET /raporlar/trend

Fiyat trend raporu (son 30 gün).

**Query Parametreleri:**
| Parametre | Tip | Açıklama |
|-----------|-----|----------|
| `kategori_id` | number | Kategori filtresi |

### POST /raporlar/eskime-kontrolu

Eskimiş fiyat kontrolü başlat ve uyarı oluştur.

**Auth:** Gerekli

---

## Hata Kodları

| Kod | Açıklama |
|-----|----------|
| 400 | Geçersiz istek (eksik/hatalı parametre) |
| 401 | Kimlik doğrulama gerekli |
| 403 | Yetki yetersiz |
| 404 | Kaynak bulunamadı |
| 500 | Sunucu hatası |

**Hata Response Formatı:**
```json
{
  "success": false,
  "error": "Hata mesajı"
}
```
