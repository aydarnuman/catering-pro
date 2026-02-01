# API Endpoint Kataloğu - Catering Pro

**Oluşturulma Tarihi:** 2026-01-31
**Toplam Route Dosyası:** 58
**Toplam Endpoint:** 200+

---

## İçindekiler

1. [Kimlik Doğrulama & Güvenlik](#kimlik-doğrulama--güvenlik)
2. [Personel Yönetimi](#personel-yönetimi)
3. [Bordro Sistemi](#bordro-sistemi)
4. [Proje Yönetimi](#proje-yönetimi)
5. [Fatura İşlemleri](#fatura-işlemleri)
6. [Cari Yönetimi](#cari-yönetimi)
7. [Stok Yönetimi](#stok-yönetimi)
8. [İhale Sistemi](#ihale-sistemi)
9. [Menü Planlama](#menü-planlama)
10. [Demirbaş Yönetimi](#demirbaş-yönetimi)
11. [Satın Alma](#satın-alma)
12. [AI Entegrasyonu](#ai-entegrasyonu)
13. [Sistem & Yardımcı](#sistem--yardımcı)

---

## Kimlik Doğrulama & Güvenlik

**Dosya:** `backend/src/routes/auth.js` (1,330 satır)
**Middleware:** `authenticate` - JWT token doğrulama
**Token Yapısı:** 24 saat access token, 30 gün refresh token

### Login & Logout

| Method | Endpoint | Auth | Açıklama |
|--------|----------|------|----------|
| POST | `/api/auth/login` | ❌ | Kullanıcı girişi (JWT + bcrypt) |
| POST | `/api/auth/logout` | ❌ | Refresh token iptal et, cookie temizle |
| POST | `/api/auth/refresh` | ❌ | Yeni access token al |
| GET | `/api/auth/me` | ✅ | Mevcut kullanıcı bilgisi |

**Login Request:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Login Response:**
```json
{
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "ad_soyad": "Ahmet Yılmaz",
    "rol": "admin"
  }
}
```

---

### Kullanıcı Yönetimi

| Method | Endpoint | Auth | İzin | Açıklama |
|--------|----------|------|------|----------|
| POST | `/api/auth/register` | ❌ | - | Yeni kullanıcı kaydı |
| PUT | `/api/auth/profile` | ✅ | - | Kullanıcı adı güncelle |
| PUT | `/api/auth/password` | ✅ | - | Şifre değiştir |
| POST | `/api/auth/validate-password` | ❌ | - | Şifre güvenlik kontrolü |
| GET | `/api/auth/users` | ✅ | Admin | Tüm kullanıcıları listele |
| PUT | `/api/auth/users/:id` | ✅ | Admin | Kullanıcı bilgilerini güncelle |
| DELETE | `/api/auth/users/:id` | ✅ | Admin | Kullanıcı sil |
| POST | `/api/auth/setup-super-admin` | ❌ | - | İlk kurulum: süper admin oluştur |

---

### Oturum Yönetimi

| Method | Endpoint | Auth | Açıklama |
|--------|----------|------|----------|
| GET | `/api/auth/sessions` | ✅ | Aktif oturumları listele |
| DELETE | `/api/auth/sessions/:id` | ✅ | Belirli oturumu sonlandır |
| DELETE | `/api/auth/sessions/other` | ✅ | Diğer tüm oturumları sonlandır |
| POST | `/api/auth/revoke-all` | ✅ | Tüm kullanıcı oturumlarını iptal et |

---

### Hesap Kilitleme

| Method | Endpoint | Auth | İzin | Açıklama |
|--------|----------|------|------|----------|
| PUT | `/api/auth/users/:id/lock` | ✅ | Admin | Hesabı N dakika kilitle |
| PUT | `/api/auth/users/:id/unlock` | ✅ | Admin | Hesap kilidini kaldır |
| GET | `/api/auth/users/:id/login-attempts` | ✅ | Admin | Giriş denemesi geçmişi |

**Lock Request:**
```json
{
  "durationMinutes": 30,
  "reason": "Multiple failed login attempts"
}
```

---

### IP Erişim Kontrolü

| Method | Endpoint | Auth | İzin | Açıklama |
|--------|----------|------|------|----------|
| GET | `/api/auth/admin/ip-rules` | ✅ | Admin | IP kurallarını listele |
| POST | `/api/auth/admin/ip-rules` | ✅ | Admin | Yeni IP kuralı ekle |
| PUT | `/api/auth/admin/ip-rules/:id` | ✅ | Admin | IP kuralı güncelle |
| DELETE | `/api/auth/admin/ip-rules/:id` | ✅ | Admin | IP kuralı sil |

**IP Rule Types:**
- `whitelist` - Sadece bu IP'ler erişebilir
- `blacklist` - Bu IP'ler engellenmiştir

---

## Personel Yönetimi

**Dosya:** `backend/src/routes/personel.js` (1,027 satır)

### Temel CRUD

| Method | Endpoint | Auth | İzin | Açıklama |
|--------|----------|------|------|----------|
| GET | `/api/personel` | ✅ | - | Tüm personeli listele |
| GET | `/api/personel/:id` | ✅ | - | Personel detayı |
| POST | `/api/personel` | ✅ | personel:create | Yeni personel ekle |
| PUT | `/api/personel/:id` | ✅ | personel:edit | Personel bilgisi güncelle |
| DELETE | `/api/personel/:id` | ✅ | personel:delete | Personel sil (hard delete) |

**Personel Create/Update:**
```json
{
  "ad_soyad": "Ahmet Yılmaz",
  "tc_kimlik_no": "12345678901",
  "telefon": "0532 123 4567",
  "email": "ahmet@example.com",
  "departman": "Mutfak",
  "pozisyon": "Aşçıbaşı",
  "ise_giris_tarihi": "2024-01-15",
  "maas": 35000
}
```

---

### İstatistikler

| Method | Endpoint | Auth | Açıklama |
|--------|----------|------|----------|
| GET | `/api/personel/stats` | ✅ | Genel personel istatistikleri |
| GET | `/api/personel/stats/overview` | ✅ | Özet istatistikler (toplam, aktif, departman dağılımı) |
| GET | `/api/personel/stats/departman` | ✅ | Departman bazlı istatistikler |

---

### Proje Atamaları

| Method | Endpoint | Auth | Açıklama |
|--------|----------|------|----------|
| GET | `/api/personel/projeler` | ✅ | Tüm projeleri listele |
| GET | `/api/personel/projeler/:id` | ✅ | Proje detayı |
| POST | `/api/personel/projeler` | ❌ | Yeni proje oluştur |
| PUT | `/api/personel/projeler/:id` | ❌ | Proje güncelle |
| DELETE | `/api/personel/projeler/:id` | ❌ | Proje sil |
| POST | `/api/personel/projeler/:projeId/personel` | ❌ | Projeye personel ata |
| POST | `/api/personel/projeler/:projeId/personel/bulk` | ❌ | Toplu personel ataması |
| PUT | `/api/personel/atama/:atamaId` | ❌ | Atama güncelle |
| DELETE | `/api/personel/atama/:atamaId` | ❌ | Atamayı kaldır |

---

### Görevler (Tasks)

| Method | Endpoint | Auth | Açıklama |
|--------|----------|------|----------|
| GET | `/api/personel/gorevler` | ✅ | Görev listesi |
| POST | `/api/personel/gorevler` | ❌ | Yeni görev oluştur |
| PUT | `/api/personel/gorevler/:id` | ❌ | Görev güncelle |
| DELETE | `/api/personel/gorevler/:id` | ❌ | Görev sil |

---

### Tazminat Hesaplama

| Method | Endpoint | Auth | Açıklama |
|--------|----------|------|----------|
| GET | `/api/personel/tazminat/sebepler` | ❌ | Çıkış sebeplerini listele |
| GET | `/api/personel/tazminat/yasal-bilgiler` | ❌ | Kıdem tazminatı yasal bilgileri |
| POST | `/api/personel/tazminat/hesapla` | ❌ | Tazminat hesapla |
| POST | `/api/personel/tazminat/kaydet` | ❌ | Tazminat kaydını veritabanına kaydet |
| GET | `/api/personel/tazminat/risk` | ❌ | Tazminat risk analizi |
| GET | `/api/personel/tazminat/gecmis` | ❌ | Tazminat geçmişi |

**Tazminat Hesaplama Request:**
```json
{
  "personel_id": "uuid",
  "cikis_tarihi": "2024-12-31",
  "cikis_sebebi": "istifa",
  "son_brut_ucret": 45000
}
```

---

### İzin Yönetimi

| Method | Endpoint | Auth | Açıklama |
|--------|----------|------|----------|
| PUT | `/api/personel/:id/izin-gun` | ❌ | Yıllık izin gün güncelleme |

---

## Bordro Sistemi

**Dosya:** `backend/src/routes/bordro.js` (916 satır)

### Maaş Hesaplama

| Method | Endpoint | Auth | Açıklama |
|--------|----------|------|----------|
| POST | `/api/bordro/net-brut-hesapla` | ❌ | Netten brüte veya brütten nete hesaplama |
| POST | `/api/bordro/hesapla` | ❌ | Personel için bordro hesapla |
| POST | `/api/bordro/toplu-hesapla` | ❌ | Toplu bordro hesaplama |

**Net-Brüt Hesaplama Request:**
```json
{
  "hesaplama_tipi": "net_to_brut", // veya "brut_to_net"
  "tutar": 30000,
  "yil": 2025,
  "medeni_hal": "evli",
  "cocuk_sayisi": 2
}
```

**Response:**
```json
{
  "brut_ucret": 42150,
  "net_ucret": 30000,
  "sgk_isci": 5901,
  "sgk_isveren": 6533,
  "gelir_vergisi": 4929,
  "damga_vergisi": 320,
  "agi": 2500, // Asgari Geçim İndirimi
  "vergi_matrah": 36249,
  "toplam_isveren_maliyeti": 48683
}
```

---

### Bordro Yönetimi

| Method | Endpoint | Auth | Açıklama |
|--------|----------|------|----------|
| GET | `/api/bordro` | ✅ | Tüm bordro kayıtlarını listele |
| GET | `/api/bordro/ozet/:yil/:ay` | ✅ | Dönem özeti |
| POST | `/api/bordro/kaydet` | ❌ | Bordro kaydı oluştur |
| PATCH | `/api/bordro/:id/odeme` | ❌ | Bordro ödeme durumu güncelle |
| POST | `/api/bordro/toplu-odeme` | ❌ | Toplu ödeme işaretle |
| DELETE | `/api/bordro/donem-sil` | ❌ | Dönem silme |

**Query Parameters (GET /api/bordro):**
- `yil` - Yıl filtresi
- `ay` - Ay filtresi (1-12)
- `personel_id` - Personel filtresi

---

### Vergi & Asgari Ücret

| Method | Endpoint | Auth | Açıklama |
|--------|----------|------|----------|
| GET | `/api/bordro/vergi-dilimleri/:yil` | ✅ | Yıla göre vergi dilimleri |
| GET | `/api/bordro/asgari-ucret/:yil` | ✅ | Yıla göre asgari ücret |

**2025 Vergi Dilimleri:**
```json
[
  { "alt_sinir": 0, "ust_sinir": 110000, "oran": 15 },
  { "alt_sinir": 110000, "ust_sinir": 230000, "oran": 20 },
  { "alt_sinir": 230000, "ust_sinir": 870000, "oran": 27 },
  { "alt_sinir": 870000, "ust_sinir": 3000000, "oran": 35 },
  { "alt_sinir": 3000000, "ust_sinir": null, "oran": 40 }
]
```

---

## Proje Yönetimi

**Dosya:** `backend/src/routes/projeler.js` (1,509 satır)

### Temel CRUD

| Method | Endpoint | Auth | Açıklama |
|--------|----------|------|----------|
| GET | `/api/projeler` | ❌ | Tüm projeleri listele |
| GET | `/api/projeler/:id` | ❌ | Proje detayı |
| POST | `/api/projeler` | ❌ | Yeni proje oluştur |
| PUT | `/api/projeler/:id` | ❌ | Proje güncelle |
| DELETE | `/api/projeler/:id` | ❌ | Proje sil (soft delete - aktif=false) |

**Proje Create/Update:**
```json
{
  "proje_adi": "KYK Yurt Catering 2025",
  "baslangic_tarihi": "2025-01-01",
  "bitis_tarihi": "2025-12-31",
  "sozlesme_tutari": 5000000,
  "durum": "aktif",
  "kurum_adi": "Kredi ve Yurtlar Kurumu",
  "fatura_donemi": "aylik",
  "kapasite": 1500,
  "notlar": "3 öğün - Kahvaltı, Öğle, Akşam"
}
```

---

### Proje İlişkileri

| Method | Endpoint | Auth | Açıklama |
|--------|----------|------|----------|
| GET | `/api/projeler/:id/personeller` | ❌ | Projedeki personel listesi |
| GET | `/api/projeler/:id/siparisler` | ❌ | Proje siparişleri |
| GET | `/api/projeler/:id/hareketler` | ❌ | Proje hareketleri (gelir/gider) |

---

### Özet & Analiz

| Method | Endpoint | Auth | Açıklama |
|--------|----------|------|----------|
| GET | `/api/projeler/:id/ozet` | ❌ | Proje özeti (bütçe, harcama, personel) |
| GET | `/api/projeler/:id/tam-ozet` | ❌ | Detaylı proje özeti (tüm ilişkiler) |
| GET | `/api/projeler/stats/genel-ozet` | ❌ | Tüm projeler genel özeti |

**Proje Özet Response:**
```json
{
  "proje": { ... },
  "toplam_harcama": 1250000,
  "toplam_gelir": 1500000,
  "personel_sayisi": 45,
  "aktif_siparisler": 12,
  "butce_kullanim_orani": 25
}
```

---

### Personel Atamaları

| Method | Endpoint | Auth | Açıklama |
|--------|----------|------|----------|
| POST | `/api/projeler/:id/personeller` | ❌ | Projeye personel ata |
| POST | `/api/projeler/:id/personeller/bulk` | ❌ | Toplu personel ataması |
| PUT | `/api/projeler/personel-atama/:atamaId` | ❌ | Atama güncelle |
| DELETE | `/api/projeler/personel-atama/:atamaId` | ❌ | Atamayı kaldır |
| GET | `/api/projeler/:id/atamasiz-personeller` | ❌ | Atama yapılabilir personeller |

---

### Proje Yetkilileri

| Method | Endpoint | Auth | Açıklama |
|--------|----------|------|----------|
| GET | `/api/projeler/:id/yetkililer` | ❌ | Proje yetkililerini listele |
| POST | `/api/projeler/:id/yetkililer` | ❌ | Yetkili ekle |
| PUT | `/api/projeler/:projeId/yetkililer/:yetkiliId` | ❌ | Yetkili güncelle |
| DELETE | `/api/projeler/:projeId/yetkililer/:yetkiliId` | ❌ | Yetkili kaldır |

---

### Proje Dokümanları

| Method | Endpoint | Auth | Açıklama |
|--------|----------|------|----------|
| GET | `/api/projeler/:id/dokumanlar` | ❌ | Proje dokümanlarını listele |
| POST | `/api/projeler/:id/dokumanlar` | ❌ | Doküman yükle |
| DELETE | `/api/projeler/:projeId/dokumanlar/:dokumanId` | ❌ | Doküman sil |

---

### Raporlar

| Method | Endpoint | Auth | Açıklama |
|--------|----------|------|----------|
| GET | `/api/projeler/raporlar/harcama-ozeti` | ❌ | Harcama özet raporu |
| GET | `/api/projeler/raporlar/maliyet-analizi` | ❌ | Maliyet analizi raporu |

---

## Fatura İşlemleri

**Dosyalar:** `invoices.js`, `fatura-kalemler.js`

### Fatura Yönetimi

**Dosya:** `backend/src/routes/invoices.js` (527 satır)

| Method | Endpoint | Auth | İzin | Açıklama |
|--------|----------|------|------|----------|
| GET | `/api/invoices/stats` | ❌ | - | Fatura istatistikleri |
| GET | `/api/invoices` | ❌ | - | Fatura listesi |
| GET | `/api/invoices/:id` | ❌ | - | Fatura detayı |
| POST | `/api/invoices` | ✅ | fatura:create | Yeni fatura oluştur |
| PUT | `/api/invoices/:id` | ✅ | fatura:edit | Fatura güncelle |
| PATCH | `/api/invoices/:id/status` | ❌ | - | Fatura durumu güncelle |
| DELETE | `/api/invoices/:id` | ✅ | fatura:delete | Fatura sil |

**Query Parameters (GET /api/invoices):**
- `page` - Sayfa numarası
- `limit` - Sayfa başına kayıt
- `startDate` - Başlangıç tarihi
- `endDate` - Bitiş tarihi
- `durum` - Durum filtresi
- `tedarikci` - Tedarikçi filtresi

---

### Fatura Özet Raporları

| Method | Endpoint | Auth | Açıklama |
|--------|----------|------|----------|
| GET | `/api/invoices/summary/monthly` | ❌ | Aylık özet |
| GET | `/api/invoices/summary/category` | ❌ | Kategori bazlı özet |

---

### Fatura Kalemleri

**Dosya:** `backend/src/routes/fatura-kalemler.js`

| Method | Endpoint | Auth | Açıklama |
|--------|----------|------|----------|
| GET | `/api/fatura-kalemler/faturalar` | ❌ | Fatura listesi (Uyumsoft) |
| GET | `/api/fatura-kalemler/faturalar/:ettn/kalemler` | ❌ | Fatura kalemlerini getir |
| POST | `/api/fatura-kalemler/faturalar/:ettn/kalemler/:sira/eslesdir` | ❌ | Kalemi ürün ile eşleştir |
| POST | `/api/fatura-kalemler/faturalar/:ettn/toplu-eslesdir` | ❌ | Toplu eşleştirme |
| POST | `/api/fatura-kalemler/faturalar/:ettn/otomatik-eslesdir` | ❌ | Otomatik eşleştirme |
| DELETE | `/api/fatura-kalemler/faturalar/:ettn/kalemler/:sira/eslesme` | ❌ | Eşleştirmeyi kaldır |

---

### Ürün Eşleştirme

| Method | Endpoint | Auth | Açıklama |
|--------|----------|------|----------|
| GET | `/api/fatura-kalemler/urunler/ara` | ❌ | Ürün arama |
| GET | `/api/fatura-kalemler/urunler/oneriler` | ❌ | Eşleştirme önerileri |
| POST | `/api/fatura-kalemler/urunler/hizli-olustur` | ❌ | Hızlı ürün oluştur |

---

### Raporlar

| Method | Endpoint | Auth | Açıklama |
|--------|----------|------|----------|
| GET | `/api/fatura-kalemler/raporlar/eslesme-durumu` | ❌ | Eşleşme durum raporu |
| GET | `/api/fatura-kalemler/raporlar/tedarikci-fiyat` | ❌ | Tedarikçi fiyat karşılaştırma |

---

## Cari Yönetimi

**Dosya:** `backend/src/routes/cariler.js`

| Method | Endpoint | Auth | Açıklama |
|--------|----------|------|----------|
| GET | `/api/cariler` | ❌ | Cari listesi |
| GET | `/api/cariler/:id` | ❌ | Cari detayı |
| POST | `/api/cariler` | ❌ | Yeni cari ekle |
| PUT | `/api/cariler/:id` | ❌ | Cari güncelle |
| DELETE | `/api/cariler/:id` | ❌ | Cari sil |

---

### Cari Hareketler

| Method | Endpoint | Auth | Açıklama |
|--------|----------|------|----------|
| GET | `/api/cariler/:id/hareketler` | ❌ | Cari hareketleri |
| GET | `/api/cariler/:id/aylik-ozet` | ❌ | Aylık özet |
| GET | `/api/cariler/:id/ekstre` | ❌ | Cari ekstresi |

**Query Parameters (hareketler):**
- `startDate` - Başlangıç tarihi
- `endDate` - Bitiş tarihi
- `tip` - Hareket tipi (borc, alacak)

---

## Stok Yönetimi

**Dosya:** `backend/src/routes/stok.js`

### Stok Kartları

| Method | Endpoint | Auth | Açıklama |
|--------|----------|------|----------|
| GET | `/api/stok` | ❌ | Stok kartı listesi |
| GET | `/api/stok/:id` | ❌ | Stok kartı detayı |
| POST | `/api/stok` | ❌ | Yeni stok kartı oluştur |
| PUT | `/api/stok/:id` | ❌ | Stok kartı güncelle |
| PATCH | `/api/stok/:id/guncelle` | ❌ | Kısmi güncelleme |
| DELETE | `/api/stok/:id` | ❌ | Stok kartı sil |

**Query Parameters (GET /api/stok):**
- `kategori_id` - Kategori filtresi
- `search` - Arama terimi (ürün adı/kodu)
- `min_stok_altinda` - Minimum stok altındakiler

---

### Kategoriler

| Method | Endpoint | Auth | Açıklama |
|--------|----------|------|----------|
| GET | `/api/stok/kategoriler` | ❌ | Kategori listesi |
| POST | `/api/stok/kategoriler` | ❌ | Yeni kategori ekle |

---

### Stok Hareketleri

| Method | Endpoint | Auth | Açıklama |
|--------|----------|------|----------|
| POST | `/api/stok/transfer` | ❌ | Toplu stok transferi |

**Transfer Request:**
```json
{
  "kaynak_depo_id": "uuid",
  "hedef_depo_id": "uuid",
  "transfers": [
    {
      "stok_kart_id": "uuid",
      "miktar": 100,
      "birim": "kg"
    }
  ]
}
```

---

## İhale Sistemi

**Dosyalar:** `tenders.js`, `tender-*.js`

### İhale Yönetimi

**Dosya:** `backend/src/routes/tenders.js`

| Method | Endpoint | Auth | Açıklama |
|--------|----------|------|----------|
| GET | `/api/tenders` | ❌ | İhale listesi |
| GET | `/api/tenders/:id` | ❌ | İhale detayı |
| POST | `/api/tenders` | ❌ | Yeni ihale ekle |
| PUT | `/api/tenders/:id` | ❌ | İhale güncelle |
| DELETE | `/api/tenders/:id` | ❌ | İhale sil |

---

### İhale Takip

**Dosya:** `backend/src/routes/tender-tracking.js`

| Method | Endpoint | Auth | Açıklama |
|--------|----------|------|----------|
| GET | `/api/tender-tracking` | ❌ | Takip listesi |
| POST | `/api/tender-tracking` | ❌ | Yeni takip ekle |
| PUT | `/api/tender-tracking/:id` | ❌ | Takip güncelle |
| DELETE | `/api/tender-tracking/:id` | ❌ | Takip kaldır |

---

### İhale Dokümanları

**Dosya:** `backend/src/routes/tender-documents.js`

| Method | Endpoint | Auth | Açıklama |
|--------|----------|------|----------|
| GET | `/api/tender-documents/:tenderId` | ❌ | İhale dokümanları |
| POST | `/api/tender-documents` | ❌ | Doküman yükle |
| DELETE | `/api/tender-documents/:id` | ❌ | Doküman sil |

---

### Dilekçe Oluştur

**Dosya:** `backend/src/routes/tender-dilekce.js`

| Method | Endpoint | Auth | Açıklama |
|--------|----------|------|----------|
| POST | `/api/tender-dilekce/generate` | ❌ | Dilekçe oluştur |
| GET | `/api/tender-dilekce/:id` | ❌ | Dilekçe görüntüle |

---

## Menü Planlama

**Dosya:** `backend/src/routes/menu-planlama.js`

### Menü Planları

| Method | Endpoint | Auth | Açıklama |
|--------|----------|------|----------|
| GET | `/api/menu-planlama` | ❌ | Menü planlarını listele |
| GET | `/api/menu-planlama/:id` | ❌ | Menü planı detayı |
| POST | `/api/menu-planlama` | ❌ | Yeni menü planı oluştur |
| PUT | `/api/menu-planlama/:id` | ❌ | Menü planı güncelle |
| DELETE | `/api/menu-planlama/:id` | ❌ | Menü planı sil |

---

### Çakışma Kontrolü

| Method | Endpoint | Auth | Açıklama |
|--------|----------|------|----------|
| POST | `/api/menu-planlama/check-conflict` | ❌ | Tarih çakışması kontrol et |

**Request:**
```json
{
  "proje_id": "uuid",
  "baslangic_tarihi": "2025-02-01",
  "bitis_tarihi": "2025-02-28"
}
```

---

## Demirbaş Yönetimi

**Dosya:** `backend/src/routes/demirbas.js` (~70 endpoint)

### Kategoriler

| Method | Endpoint | Auth | Açıklama |
|--------|----------|------|----------|
| GET | `/api/demirbas/kategoriler` | ❌ | Kategori listesi |
| POST | `/api/demirbas/kategoriler` | ❌ | Kategori ekle |

---

### Lokasyonlar

| Method | Endpoint | Auth | Açıklama |
|--------|----------|------|----------|
| GET | `/api/demirbas/lokasyonlar` | ❌ | Lokasyon listesi |
| POST | `/api/demirbas/lokasyonlar` | ❌ | Lokasyon ekle |
| PUT | `/api/demirbas/lokasyonlar/:id` | ❌ | Lokasyon güncelle |
| DELETE | `/api/demirbas/lokasyonlar/:id` | ❌ | Lokasyon sil |

---

### Demirbaş Varlıklar

| Method | Endpoint | Auth | Açıklama |
|--------|----------|------|----------|
| GET | `/api/demirbas` | ❌ | Demirbaş listesi |
| GET | `/api/demirbas/:id` | ❌ | Demirbaş detayı |
| POST | `/api/demirbas` | ❌ | Yeni demirbaş ekle |
| PUT | `/api/demirbas/:id` | ❌ | Demirbaş güncelle |
| DELETE | `/api/demirbas/:id` | ❌ | Demirbaş sil |

---

### İşlemler

| Method | Endpoint | Auth | Açıklama |
|--------|----------|------|----------|
| POST | `/api/demirbas/zimmet` | ❌ | Demirbaş zimmetleme |
| POST | `/api/demirbas/zimmet-iade` | ❌ | Zimmet iadesi |
| POST | `/api/demirbas/transfer` | ❌ | Lokasyon transferi |
| POST | `/api/demirbas/bakim` | ❌ | Bakım girişi |
| POST | `/api/demirbas/bakim-cikis` | ❌ | Bakımdan çıkış |

---

### Toplu İşlemler

| Method | Endpoint | Auth | Açıklama |
|--------|----------|------|----------|
| POST | `/api/demirbas/toplu/sil` | ❌ | Toplu silme |
| POST | `/api/demirbas/toplu/transfer` | ❌ | Toplu transfer |

---

## Satın Alma

**Dosya:** `backend/src/routes/satin-alma.js`

### Satın Alma Talepleri

| Method | Endpoint | Auth | Açıklama |
|--------|----------|------|----------|
| GET | `/api/satin-alma` | ❌ | Talep listesi |
| GET | `/api/satin-alma/:id` | ❌ | Talep detayı |
| POST | `/api/satin-alma` | ❌ | Yeni talep oluştur |
| PUT | `/api/satin-alma/:id` | ❌ | Talep güncelle |
| PATCH | `/api/satin-alma/:id/durum` | ❌ | Durum güncelle |
| DELETE | `/api/satin-alma/:id` | ❌ | Talep sil |

---

## AI Entegrasyonu

**Dosyalar:** `ai.js`, `ai-memory.js`, `prompt-builder.js`

### AI Agent

**Dosya:** `backend/src/routes/ai.js`

| Method | Endpoint | Auth | Açıklama |
|--------|----------|------|----------|
| GET | `/api/ai/agent/tools` | ✅ | Kullanılabilir AI araçlarını listele |
| POST | `/api/ai/agent/execute` | ✅ | AI görev çalıştır |

---

### AI Templates

| Method | Endpoint | Auth | Açıklama |
|--------|----------|------|----------|
| GET | `/api/ai/templates` | ✅ | Şablon listesi |
| GET | `/api/ai/templates/:id` | ✅ | Şablon detayı |
| POST | `/api/ai/templates` | ✅ | Yeni şablon oluştur |
| PUT | `/api/ai/templates/:id` | ✅ | Şablon güncelle |
| DELETE | `/api/ai/templates/:id` | ✅ | Şablon sil |

---

### Ürün Analizi

| Method | Endpoint | Auth | Açıklama |
|--------|----------|------|----------|
| POST | `/api/ai/analyze-product` | ❌ | Ürün analizi (AI) |
| POST | `/api/ai/analyze-product-batch` | ❌ | Toplu ürün analizi |

---

### AI Memory

**Dosya:** `backend/src/routes/ai-memory.js`

| Method | Endpoint | Auth | Açıklama |
|--------|----------|------|----------|
| GET | `/api/ai-memory/conversations` | ✅ | Konuşma geçmişi |
| GET | `/api/ai-memory/:conversationId` | ✅ | Konuşma detayı |
| POST | `/api/ai-memory` | ✅ | Yeni mesaj ekle |
| DELETE | `/api/ai-memory/:conversationId` | ✅ | Konuşmayı sil |

---

### Prompt Builder

**Dosya:** `backend/src/routes/prompt-builder.js`

| Method | Endpoint | Auth | Açıklama |
|--------|----------|------|----------|
| GET | `/api/prompt-builder/saved` | ✅ | Kaydedilmiş promptlar |
| POST | `/api/prompt-builder/save` | ✅ | Prompt kaydet |
| DELETE | `/api/prompt-builder/:id` | ✅ | Prompt sil |

---

## Sistem & Yardımcı

### Yetki Yönetimi

**Dosya:** `backend/src/routes/permissions.js`

| Method | Endpoint | Auth | İzin | Açıklama |
|--------|----------|------|------|----------|
| GET | `/api/permissions/modules` | ✅ | - | Modül listesi |
| GET | `/api/permissions/user/:userId` | ✅ | Admin | Kullanıcı yetkileri |
| PUT | `/api/permissions/user/:userId` | ✅ | Admin | Yetki güncelle |
| GET | `/api/permissions/templates` | ✅ | Admin | Yetki şablonları |
| POST | `/api/permissions/apply-template` | ✅ | Admin | Şablon uygula |

---

### Denetim Logları

**Dosya:** `backend/src/routes/audit-logs.js`

| Method | Endpoint | Auth | İzin | Açıklama |
|--------|----------|------|------|----------|
| GET | `/api/audit-logs` | ✅ | Admin | Log listesi |
| GET | `/api/audit-logs/:id` | ✅ | Admin | Log detayı |

**Query Parameters:**
- `user_id` - Kullanıcı filtresi
- `module` - Modül filtresi
- `action` - Aksiyon filtresi (create, update, delete)
- `startDate` - Başlangıç tarihi
- `endDate` - Bitiş tarihi

---

### Bildirimler

**Dosya:** `backend/src/routes/notifications.js`

| Method | Endpoint | Auth | Açıklama |
|--------|----------|------|----------|
| GET | `/api/notifications` | ✅ | Kullanıcı bildirimleri |
| PATCH | `/api/notifications/:id/read` | ✅ | Okundu işaretle |
| DELETE | `/api/notifications/:id` | ✅ | Bildirimi sil |
| POST | `/api/notifications/mark-all-read` | ✅ | Tümünü okundu işaretle |

---

### Notlar

**Dosya:** `backend/src/routes/notlar.js` + `routes/notes/*`

| Method | Endpoint | Auth | Açıklama |
|--------|----------|------|----------|
| GET | `/api/notlar` | ✅ | Not listesi |
| GET | `/api/notlar/:id` | ✅ | Not detayı |
| POST | `/api/notlar` | ✅ | Yeni not oluştur |
| PUT | `/api/notlar/:id` | ✅ | Not güncelle |
| DELETE | `/api/notlar/:id` | ✅ | Not sil |

**Notes Subdirectory Endpoints:**
- `/api/notes/personal` - Kişisel notlar
- `/api/notes/contextual` - Bağlamsal notlar
- `/api/notes/attachments` - Ek yönetimi
- `/api/notes/reminders` - Hatırlatıcılar
- `/api/notes/tags` - Etiket yönetimi

---

### Arama

**Dosya:** `backend/src/routes/search.js`

| Method | Endpoint | Auth | Açıklama |
|--------|----------|------|----------|
| GET | `/api/search` | ✅ | Genel arama (tüm modüller) |
| GET | `/api/search/:module` | ✅ | Modül-spesifik arama |

**Query Parameters:**
- `q` - Arama terimi (required)
- `limit` - Sonuç limiti (default: 10)

---

### Export

**Dosya:** `backend/src/routes/export.js`

| Method | Endpoint | Auth | Açıklama |
|--------|----------|------|----------|
| GET | `/api/export/personel/excel` | ✅ | Personel Excel export |
| GET | `/api/export/personel/pdf` | ✅ | Personel PDF export |
| GET | `/api/export/fatura/excel` | ✅ | Fatura Excel export |
| GET | `/api/export/fatura/pdf` | ✅ | Fatura PDF export |
| GET | `/api/export/cari/excel` | ✅ | Cari Excel export |
| GET | `/api/export/stok/excel` | ✅ | Stok Excel export |
| GET | `/api/export/bordro/excel` | ✅ | Bordro Excel export |

**Email Export:**
- `POST /api/export/personel/mail` - Personel raporu mail gönder
- `POST /api/export/fatura/mail` - Fatura raporu mail gönder

---

### Sistem Bilgileri

**Dosya:** `backend/src/routes/system.js`

| Method | Endpoint | Auth | İzin | Açıklama |
|--------|----------|------|------|----------|
| GET | `/api/system/health` | ❌ | - | Sistem sağlık kontrolü |
| GET | `/api/system/stats` | ✅ | Admin | Sistem istatistikleri |
| GET | `/api/system/database-stats` | ✅ | Admin | Veritabanı istatistikleri |

---

### Senkronizasyon

**Dosya:** `backend/src/routes/sync.js`

| Method | Endpoint | Auth | İzin | Açıklama |
|--------|----------|------|------|----------|
| POST | `/api/sync/run` | ✅ | Admin | Senkronizasyonu başlat |
| GET | `/api/sync/status` | ✅ | Admin | Senkronizasyon durumu |
| GET | `/api/sync/logs` | ✅ | Admin | Senkronizasyon logları |

---

### Scraper

**Dosya:** `backend/src/routes/scraper.js`

| Method | Endpoint | Auth | İzin | Açıklama |
|--------|----------|------|------|----------|
| POST | `/api/scraper/run` | ✅ | Admin | Scraper başlat |
| GET | `/api/scraper/status` | ✅ | Admin | Scraper durumu |
| GET | `/api/scraper/logs` | ✅ | Admin | Scraper logları |

---

## API Endpoint İstatistikleri

| Kategori | Endpoint Sayısı |
|----------|-----------------|
| Kimlik Doğrulama & Güvenlik | 24 |
| Personel Yönetimi | 30+ |
| Bordro Sistemi | 11 |
| Proje Yönetimi | 25+ |
| Fatura İşlemleri | 20+ |
| Cari Yönetimi | 8 |
| Stok Yönetimi | 10+ |
| İhale Sistemi | 15+ |
| Menü Planlama | 6+ |
| Demirbaş Yönetimi | 20+ |
| Satın Alma | 6 |
| AI Entegrasyonu | 15+ |
| Sistem & Yardımcı | 30+ |
| **TOPLAM** | **220+** |

---

## Kimlik Doğrulama Desenleri

### Public Endpoints (Auth: ❌)
- Çoğu modülde `/stats`, `/`, `/:id` endpointleri public
- Login, refresh token
- Sistem sağlık kontrolü

### Authenticated Endpoints (Auth: ✅)
- Dashboard verileri
- Kullanıcıya özel işlemler
- JWT token zorunlu

### Admin-Only (Auth: ✅ + Admin)
- Kullanıcı yönetimi
- IP kuralları
- Sistem ayarları
- Audit logları

### Permission-Based (Auth: ✅ + Permission)
- Modül bazlı yetki kontrolü
- `requirePermission('module', 'action')` middleware
- Granular RBAC

---

## API İsimlendirme Kuralları

| Desen | Örnek | Amaç |
|-------|-------|------|
| `/:id` | `/personel/:id` | Tekil kaynak |
| `/:id/relation` | `/projeler/:id/personeller` | İlişkili kaynaklar |
| `/bulk` | `/personeller/bulk` | Toplu işlemler |
| `/ozet` | `/bordro/ozet/:yil/:ay` | Özet/toplam |
| `/raporlar/*` | `/projeler/raporlar/harcama` | Raporlar |
| `/toplu-*` | `/bordro/toplu-hesapla` | Toplu hesaplamalar |
| `PATCH /:id/action` | `/bordro/:id/odeme` | Kısmi durum değişikliği |

---

## Tutarsızlıklar & Öneriler

### 1. Kimlik Doğrulama Tutarsızlıkları
**Sorun:** Bazı `/personel/` route'ları karma auth (GET public, POST auth gerekli)

**Öneri:** Tüm route'lar için tutarlı auth middleware uygula

### 2. Route Organizasyonu
**Sorun:** Personel atama route'ları `/personel` ve `/projeler` arasında bölünmüş

**Öneri:** İlgili route'ları tek dosyada topla, proje atamaları sadece `/projeler` altında

### 3. Silme İşlemi Tutarsızlıkları
**Sorun:**
- `/projeler` soft delete kullanıyor (`aktif = false`)
- `/personel` hard delete kullanıyor

**Öneri:** Tüm kritik tablolar için `deleted_at` ile global soft delete

### 4. Eksik Endpointler
**Tablolar var ama API yok:**
- `gorevler` (tasks) - migration 029 var, minimal route
- `cek_senet_sistemi` - migration 026, route yok
- `whatsapp_messages` - migration 077, sınırlı entegrasyon
- `scraper_queue` - migration 103, temel route'lar

**Öneri:** Eksik tablolar için tam CRUD endpoint'leri implement et

---

**Son Güncelleme:** 2026-01-31
**Bakım:** Development Team
