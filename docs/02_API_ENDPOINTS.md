# 🔌 API Endpoint'leri

> Backend: Express.js (ES Modules)  
> Port: 3001  
> Base URL: `http://localhost:3001` veya `https://catering-tr.com/api`  
> Son Güncelleme: 6 Şubat 2026

---

## 📋 İçindekiler

| Kategori | Route Dosyası | Endpoint Sayısı |
|----------|---------------|-----------------|
| [Auth & Güvenlik](#1-auth--güvenlik) | auth.js, permissions.js | ~15 |
| [İhale Yönetimi](#2-i̇hale-yönetimi) | tenders.js, tender-*.js | ~30 |
| [Muhasebe - Cariler](#3-muhasebe---cariler) | cariler.js | ~10 |
| [Muhasebe - Faturalar](#4-muhasebe---faturalar) | invoices.js, fatura-kalemler.js | ~15 |
| [Muhasebe - Stok](#5-muhasebe---stok) | stok.js, urunler.js | ~20 |
| [Muhasebe - Finans](#6-muhasebe---finans) | kasa-banka.js, gelir-gider.js | ~15 |
| [Personel & Bordro](#7-personel--bordro) | personel.js, bordro.js | ~25 |
| [Planlama](#8-planlama) | planlama.js, menu-planlama.js | ~15 |
| [AI & Chat](#9-ai--chat) | ai.js, ai-memory.js | ~10 |
| [Sistem & Admin](#10-sistem--admin) | system.js, admin-*.js | ~20 |

**Toplam: ~52 route dosyası, ~175+ endpoint**

---

## 🔐 Genel Kurallar

### Authentication
```
Header: Authorization: Bearer <JWT_TOKEN>
```

### Erişim Seviyeleri
| Seviye | Açıklama |
|--------|----------|
| 🔓 Public | Auth gerektirmez (GET işlemleri) |
| 🔒 Auth | JWT token gerekli |
| 🔑 Admin | Admin rolü gerekli |
| 🛡️ Permission | Özel yetki gerekli |

### Response Formatı
```json
{
  "success": true,
  "data": {...},
  "count": 10,
  "message": "İşlem başarılı"
}
```

### Hata Response
```json
{
  "success": false,
  "error": "Hata mesajı",
  "code": "ERROR_CODE"
}
```

---

## 1. Auth & Güvenlik

### `POST /api/auth/login`
Kullanıcı girişi

| Parametre | Tip | Zorunlu | Açıklama |
|-----------|-----|---------|----------|
| email | string | ✅ | E-posta |
| password | string | ✅ | Şifre |

**Response:**
```json
{
  "success": true,
  "token": "eyJhbG...",
  "refreshToken": "...",
  "user": { "id": 1, "email": "...", "name": "...", "role": "admin" }
}
```

### `POST /api/auth/logout` 🔒
Çıkış yap

### `POST /api/auth/refresh`
Token yenile

| Parametre | Tip | Zorunlu |
|-----------|-----|---------|
| refreshToken | string | ✅ |

### `GET /api/auth/me` 🔒
Mevcut kullanıcı bilgisi

### `PUT /api/auth/password` 🔒
Şifre değiştir

| Parametre | Tip | Zorunlu |
|-----------|-----|---------|
| currentPassword | string | ✅ |
| newPassword | string | ✅ |

### `GET /api/permissions` 🔑
Tüm yetkileri listele

### `GET /api/permissions/user/:userId` 🔑
Kullanıcı yetkilerini getir

### `POST /api/permissions/user/:userId` 🔑
Kullanıcıya yetki ata

---

## 2. İhale Yönetimi

> **Detaylı ihale API referansı:** [`backend/docs/04-API-ROUTES.md`](../backend/docs/04-API-ROUTES.md)

### `GET /api/tenders`
İhale listesi

| Query Param | Tip | Default | Açıklama |
|-------------|-----|---------|----------|
| status | string | - | active/closed/won/lost |
| city | string | - | Şehir filtresi |
| search | string | - | Başlık araması |
| startDate | date | - | Başlangıç tarihi |
| endDate | date | - | Bitiş tarihi |
| limit | number | 50 | Limit |
| offset | number | 0 | Offset |

### `GET /api/tenders/:id`
İhale detayı

### `POST /api/tenders` 🔒
Yeni ihale oluştur

| Body | Tip | Zorunlu |
|------|-----|---------|
| title | string | ✅ |
| organization_name | string | ✅ |
| tender_date | date | - |
| city | string | - |
| estimated_cost | number | - |

### `PUT /api/tenders/:id` 🔒
İhale güncelle

### `DELETE /api/tenders/:id` 🔑
İhale sil

### `GET /api/tenders/:id/documents`
İhale belgeleri

### `POST /api/tenders/:id/documents` 🔒
Belge yükle (multipart/form-data)

### `DELETE /api/tenders/:tenderId/documents/:docId` 🔒
Belge sil

### `GET /api/tender-tracking`
Takip listesi

### `POST /api/tender-tracking` 🔒
Takibe ekle

### `PUT /api/tender-tracking/:id` 🔒
Takip güncelle

### `GET /api/teklifler`
Teklifler listesi

### `POST /api/teklifler` 🔒
Yeni teklif oluştur

### `GET /api/ihale-sonuclari`
İhale sonuçları

### `POST /api/ihale-sonuclari` 🔒
Sonuç kaydet

---

## 3. Muhasebe - Cariler

### `GET /api/cariler`
Cari listesi

| Query Param | Tip | Default | Açıklama |
|-------------|-----|---------|----------|
| tip | string | - | musteri/tedarikci/her_ikisi |
| aktif | boolean | true | Aktif filtresi |
| search | string | - | Ünvan/VKN araması |

### `GET /api/cariler/:id`
Cari detayı

### `POST /api/cariler` 🔒
Yeni cari oluştur

| Body | Tip | Zorunlu |
|------|-----|---------|
| tip | string | ✅ |
| unvan | string | ✅ |
| vergi_no | string | - |
| vergi_dairesi | string | - |
| telefon | string | - |
| email | string | - |
| adres | string | - |
| il | string | - |
| ilce | string | - |

### `PUT /api/cariler/:id` 🔒
Cari güncelle

### `DELETE /api/cariler/:id` 🔑
Cari sil

### `GET /api/cariler/:id/hareketler`
Cari hareketleri

### `POST /api/cariler/:id/hareketler` 🔒
Hareket ekle

### `GET /api/cariler/:id/bakiye`
Cari bakiye özeti

---

## 4. Muhasebe - Faturalar

### `GET /api/invoices`
Fatura listesi

| Query Param | Tip | Default | Açıklama |
|-------------|-----|---------|----------|
| type | string | - | sales/purchase |
| status | string | - | WaitingForAprovement/Approved/Rejected |
| customer | string | - | Müşteri araması |
| startDate | date | - | Başlangıç |
| endDate | date | - | Bitiş |
| proje_id | number | - | Proje filtresi |
| limit | number | 250 | Limit |

### `GET /api/invoices/stats`
Fatura istatistikleri (dashboard)

### `GET /api/invoices/:id`
Fatura detayı

### `POST /api/invoices` 🔒
Manuel fatura oluştur

### `PUT /api/invoices/:id` 🔒
Fatura güncelle

### `DELETE /api/invoices/:id` 🔑
Fatura sil

### `GET /api/fatura-kalemler`
Fatura kalemleri listesi

| Query Param | Tip | Açıklama |
|-------------|-----|----------|
| fatura_ettn | string | ETTN filtresi |
| urun_id | number | Ürün filtresi |
| tedarikci_vkn | string | Tedarikçi filtresi |
| eslesmemis | boolean | Sadece eşleşmemiş |

### `GET /api/fatura-kalemler/:id`
Kalem detayı

### `PUT /api/fatura-kalemler/:id/eslesme` 🔒
Ürün eşleştir

| Body | Tip | Zorunlu |
|------|-----|---------|
| urun_id | number | ✅ |

### `POST /api/fatura-kalemler/bulk-eslesme` 🔒
Toplu eşleştirme

### `GET /api/fatura-kalemler/oneriler/:kalemId`
Eşleştirme önerileri (AI)

---

## 5. Muhasebe - Stok

### `GET /api/stok`
Stok kartları listesi

| Query Param | Tip | Default | Açıklama |
|-------------|-----|---------|----------|
| kategori | string | - | Kategori filtresi |
| aktif | boolean | true | Aktif filtresi |
| kritik | boolean | - | Sadece kritik stok |
| search | string | - | Ad/kod araması |

### `GET /api/stok/:id`
Stok kartı detayı

### `POST /api/stok` 🔒
Yeni stok kartı

| Body | Tip | Zorunlu |
|------|-----|---------|
| kod | string | ✅ |
| ad | string | ✅ |
| kategori | string | ✅ |
| birim | string | ✅ |
| min_stok | number | - |
| alis_fiyati | number | - |
| satis_fiyati | number | - |

### `PUT /api/stok/:id` 🔒
Stok kartı güncelle

### `DELETE /api/stok/:id` 🔑
Stok kartı sil

### `GET /api/stok/:id/hareketler`
Stok hareketleri

### `POST /api/stok/:id/hareketler` 🔒
Stok hareketi ekle

| Body | Tip | Zorunlu |
|------|-----|---------|
| hareket_tipi | string | ✅ (giris/cikis/transfer/sayim) |
| miktar | number | ✅ |
| birim_fiyat | number | - |
| aciklama | string | - |

### `GET /api/urunler`
Ürün kartları listesi

### `GET /api/urunler/:id`
Ürün kartı detayı

### `POST /api/urunler` 🔒
Yeni ürün kartı

### `PUT /api/urunler/:id` 🔒
Ürün kartı güncelle

### `GET /api/urunler/:id/fiyat-gecmisi`
Fiyat geçmişi

### `GET /api/urunler/kategoriler`
Ürün kategorileri

---

## 6. Muhasebe - Finans

### `GET /api/kasa-banka`
Kasa/banka hesapları

### `GET /api/kasa-banka/:id`
Hesap detayı

### `POST /api/kasa-banka` 🔒
Yeni hesap

### `PUT /api/kasa-banka/:id` 🔒
Hesap güncelle

### `GET /api/kasa-banka/:id/hareketler`
Hesap hareketleri

### `POST /api/kasa-banka/:id/hareketler` 🔒
Hareket ekle

### `POST /api/kasa-banka/transfer` 🔒
Hesaplar arası transfer

| Body | Tip | Zorunlu |
|------|-----|---------|
| kaynak_hesap_id | number | ✅ |
| hedef_hesap_id | number | ✅ |
| tutar | number | ✅ |
| aciklama | string | - |

### `GET /api/gelir-gider`
Gelir/gider listesi

### `POST /api/gelir-gider` 🔒
Yeni gelir/gider

### `GET /api/gelir-gider/ozet`
Aylık özet

---

## 7. Personel & Bordro

### `GET /api/personel`
Personel listesi

| Query Param | Tip | Default | Açıklama |
|-------------|-----|---------|----------|
| aktif | boolean | true | Aktif filtresi |
| departman | string | - | Departman |
| search | string | - | Ad/TC araması |

### `GET /api/personel/:id`
Personel detayı

### `POST /api/personel` 🔒
Yeni personel

| Body | Tip | Zorunlu |
|------|-----|---------|
| tc_kimlik | string | ✅ |
| ad | string | ✅ |
| soyad | string | ✅ |
| ise_giris_tarihi | date | ✅ |
| departman | string | - |
| pozisyon | string | - |
| maas | number | - |

### `PUT /api/personel/:id` 🔒
Personel güncelle

### `DELETE /api/personel/:id` 🔑
Personel sil

### `GET /api/bordro`
Bordro listesi

| Query Param | Tip | Açıklama |
|-------------|-----|----------|
| yil | number | Yıl |
| ay | number | Ay |
| personel_id | number | Personel filtresi |
| odeme_durumu | string | beklemede/odendi |

### `GET /api/bordro/:id`
Bordro detayı

### `POST /api/bordro/hesapla` 🔒
Bordro hesapla

| Body | Tip | Zorunlu |
|------|-----|---------|
| personel_id | number | ✅ |
| yil | number | ✅ |
| ay | number | ✅ |

### `POST /api/bordro/toplu-hesapla` 🔒
Toplu bordro hesapla

| Body | Tip | Zorunlu |
|------|-----|---------|
| yil | number | ✅ |
| ay | number | ✅ |

### `PUT /api/bordro/:id/ode` 🔒
Bordro öde

### `GET /api/bordro/ozet`
Bordro özeti

### `GET /api/izin`
İzin talepleri

### `POST /api/izin` 🔒
İzin talebi oluştur

### `PUT /api/izin/:id/onayla` 🔒
İzin onayla

### `PUT /api/izin/:id/reddet` 🔒
İzin reddet

---

## 8. Planlama

### `GET /api/planlama`
Üretim planları

| Query Param | Tip | Açıklama |
|-------------|-----|----------|
| proje_id | number | Proje filtresi |
| tarih | date | Tarih |
| hafta | string | 2026-W05 formatı |

### `POST /api/planlama` 🔒
Plan oluştur

### `PUT /api/planlama/:id` 🔒
Plan güncelle

### `GET /api/menu-planlama`
Menü planları

### `POST /api/menu-planlama` 🔒
Menü oluştur

### `GET /api/menu-planlama/receteler`
Reçete listesi

### `POST /api/menu-planlama/receteler` 🔒
Reçete oluştur

### `GET /api/menu-planlama/receteler/:id`
Reçete detayı

### `PUT /api/menu-planlama/receteler/:id` 🔒
Reçete güncelle

### `GET /api/menu-planlama/malzeme-ihtiyac`
Malzeme ihtiyaç hesaplama

| Query Param | Tip | Açıklama |
|-------------|-----|----------|
| menu_id | number | Menü ID |
| porsiyon | number | Porsiyon sayısı |

---

## 9. AI & Chat

### `POST /api/ai/chat`
AI sohbet

| Body | Tip | Zorunlu |
|------|-----|---------|
| message | string | ✅ |
| conversation_id | string | - |
| context | object | - |

**Response:** Server-Sent Events (streaming)

### `GET /api/ai/conversations`
Konuşma listesi

### `GET /api/ai/conversations/:id`
Konuşma detayı

### `DELETE /api/ai/conversations/:id` 🔒
Konuşma sil

### `POST /api/ai/analyze-document`
Belge analizi (Azure Document AI + Claude)

| Body | Tip | Zorunlu |
|------|-----|---------|
| document_id | number | ✅ |

### `GET /api/ai-memory`
AI hafıza

### `POST /api/ai-memory` 🔒
Hafızaya ekle

### `DELETE /api/ai-memory/:id` 🔒
Hafızadan sil

### `GET /api/prompt-builder/templates`
Prompt şablonları

### `POST /api/prompt-builder/generate` 🔒
Prompt oluştur

---

## 10. Sistem & Admin

### `GET /health`
Sağlık kontrolü (public)

### `GET /api-docs`
Swagger UI

### `GET /api-docs.json`
OpenAPI spec

### `GET /api/system/stats` 🔑
Sistem istatistikleri

### `GET /api/system/logs` 🔑
Sistem logları

### `GET /api/database-stats` 🔑
Veritabanı istatistikleri

### `GET /api/audit-logs` 🔑
Denetim logları

| Query Param | Tip | Açıklama |
|-------------|-----|----------|
| user_id | number | Kullanıcı filtresi |
| module | string | Modül filtresi |
| action | string | Aksiyon filtresi |
| startDate | date | Başlangıç |
| endDate | date | Bitiş |

### `GET /api/notifications` 🔒
Bildirimler

### `PUT /api/notifications/:id/read` 🔒
Bildirim okundu işaretle

### `POST /api/notifications/mark-all-read` 🔒
Tümünü okundu işaretle

### `GET /api/search`
Global arama

| Query Param | Tip | Açıklama |
|-------------|-----|----------|
| q | string | Arama terimi |
| modules | string | Modüller (virgülle ayrılmış) |

### `POST /api/export` 🔒
Dışa aktarma

| Body | Tip | Zorunlu |
|------|-----|---------|
| module | string | ✅ |
| format | string | ✅ (excel/csv/pdf) |
| filters | object | - |

### `POST /api/import` 🔒
İçe aktarma (multipart/form-data)

### `GET /api/sync/status` 🔑
Senkronizasyon durumu

### `POST /api/sync/trigger` 🔑
Manuel senkronizasyon başlat

### `GET /api/scraper/status` 🔑
Scraper durumu

### `POST /api/scraper/run` 🔑
Scraper çalıştır

---

## 📊 Rate Limiting

| Endpoint Tipi | Limit |
|---------------|-------|
| Auth endpoints | 5 req/min |
| API genel | 100 req/min |
| Export | 10 req/hour |
| AI Chat | 30 req/min |

---

## 🔄 WebSocket / Realtime

Supabase Realtime kullanılıyor:

```javascript
// Frontend'de kullanım
const channel = supabase
  .channel('db-changes')
  .on('postgres_changes', 
    { event: '*', schema: 'public', table: 'tenders' },
    (payload) => console.log('Change:', payload)
  )
  .subscribe()
```

### Realtime Aktif Tablolar
- `tenders`
- `tender_tracking`
- `notifications`
- `invoices`
- `urun_kartlari`

---

## 📝 Swagger Dokümantasyonu

Canlı Swagger UI: `http://localhost:3001/api-docs`

Her route dosyasında JSDoc formatında Swagger annotations mevcut.

---

*Bu döküman route dosyalarından derlenmiştir.*
