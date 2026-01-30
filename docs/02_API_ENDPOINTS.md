# 🔌 API Endpoint'leri

> Backend: Express.js (ES Modules)  
> Port: 3001  
> Base URL: `http://localhost:3001` veya `https://catering-tr.com/api`  
> Son Güncelleme: 30 Ocak 2026

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
| [Unified Notes](#unified-notes) | notes/index.js, personal, contextual, tags, reminders, attachments | ~26 |
| [Sistem & Admin](#10-sistem--admin) | system.js, admin-*.js | ~20 |

**Toplam: ~52 route dosyası, ~200+ endpoint**

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

**Route dosyası:** `auth.js` (Cookie + JWT; loginAttemptService, sessionService)

### `POST /api/auth/login`
Kullanıcı girişi. Cookie: access_token, refresh_token.

| Parametre | Tip | Zorunlu | Açıklama |
|-----------|-----|---------|----------|
| email | string | ✅ | E-posta |
| password | string | ✅ | Şifre |

**Response:** `{ success, token, user: { id, email, name, role, user_type } }`  
**Hata:** 423 ACCOUNT_LOCKED (kilitli hesap), 401 geçersiz şifre

### `POST /api/auth/register`
Yeni kullanıcı kaydı (body: email, password, name, role?, user_type?).

### `GET /api/auth/me` 🔒
Mevcut kullanıcı bilgisi (Cookie veya Authorization header).

### `PUT /api/auth/profile` 🔒
Profil güncelle (body: name, en az 2 karakter).

### `PUT /api/auth/password` 🔒
Şifre değiştir (body: currentPassword, newPassword). Şifre güçlülük kuralları uygulanır.

### `POST /api/auth/logout` 🔒
Çıkış; cookie temizlenir, refresh token revoke edilir.

### `POST /api/auth/refresh`
Token yenile (Cookie: refresh_token).

### `POST /api/auth/revoke-all` 🔒
Tüm oturumları kapat (refresh token’lar revoke).

### `POST /api/auth/validate-password`
Şifre güçlülük kontrolü (body: password). Response: valid, errors, strength.

### `GET /api/auth/users` 🔑
Tüm kullanıcıları listele (admin/super_admin).

### `PUT /api/auth/users/:id` 🔑
Kullanıcı güncelle (body: name, email, password?, role?, user_type?, is_active).

### `DELETE /api/auth/users/:id` 🔑
Kullanıcı sil (kendinizi silemezsiniz).

### `POST /api/auth/setup-super-admin`
İlk super admin ataması (en düşük id’li admin’i super_admin yapar).

### `PUT /api/auth/users/:id/lock` 🔑
Hesabı kilitle (body: minutes?, default 60).

### `PUT /api/auth/users/:id/unlock` 🔑
Hesabı aç.

### `GET /api/auth/users/:id/login-attempts` 🔑
Login geçmişi (query: limit?, default 50).

### `GET /api/auth/sessions` 🔒
Aktif oturumları listele.

### `DELETE /api/auth/sessions/:id` 🔒
Belirli oturumu sonlandır (mevcut oturum hariç).

### `DELETE /api/auth/sessions/other` 🔒
Diğer tüm oturumları sonlandır.

### `GET /api/auth/admin/ip-rules` 🔑
IP kurallarını listele (query: type?, active?).

### `POST /api/auth/admin/ip-rules` 🔑
Yeni IP kuralı (body: ipAddress, type: whitelist|blacklist, description?).

### `PUT /api/auth/admin/ip-rules/:id` 🔑
IP kuralını güncelle.

### `DELETE /api/auth/admin/ip-rules/:id` 🔑
IP kuralını sil.

### [DEPRECATED] `GET/PUT/DELETE /api/auth/admin/notifications*`
307 redirect → `/api/notifications`. Yeni kodda doğrudan `/api/notifications` kullanın.

### `GET /api/permissions` 🔑
Tüm yetkileri listele

### `GET /api/permissions/user/:userId` 🔑
Kullanıcı yetkilerini getir

### `POST /api/permissions/user/:userId` 🔑
Kullanıcıya yetki ata

---

## 2. İhale Yönetimi

**Route dosyası:** `tenders.js` (tenderScheduler). Belgeler için ayrı route: `tender-documents.js`, `documents.js`.

### `GET /api/tenders`
İhale listesi (pagination + filtre). Süresi dolan ihaleler otomatik status=expired yapılır.

| Query Param | Tip | Default | Açıklama |
|-------------|-----|---------|----------|
| page | number | 1 | Sayfa |
| limit | number | 20 | Sayfa boyutu |
| city | string | - | Şehir filtresi |
| status | string | active | active, expired, urgent, archived, all |
| search | string | - | title veya organization_name ILIKE |

**Response:** `{ success, tenders, total, page, limit, totalPages }`

### `GET /api/tenders/stats`
İstatistikler (total, active, with_detail, today, this_week, topCities).

### `GET /api/tenders/cities`
Şehir listesi (city, count) aktif ihalelerden.

### `GET /api/tenders/:id`
İhale detayı + documents listesi.

### `PATCH /api/tenders/:id`
İhale güncelle (body: tender_date, status, city, organization_name, title, estimated_cost).

### `DELETE /api/tenders/:id`
İhale sil.

### `POST /api/tenders/scrape`
Manuel scrape (body: maxPages?, default 3). tenderScheduler kullanır.

### `GET /api/tenders/scheduler/status`
Scheduler durumu.

### `POST /api/tenders/scheduler/start`
Scheduler başlat.

### `POST /api/tenders/scheduler/stop`
Scheduler durdur.

### `GET /api/tenders/scrape/logs`
Scrape logları (query: limit?, default 50).

### `GET /api/tenders/stats/detailed`
Detaylı istatistikler (tenderScheduler.getTenderStats()).

### `GET /api/tenders/stats/updates`
Son güncelleme ve günlük/haftalık özet (lastUpdate, today, totalCount, weeklyStats).

### İhale belgeleri (ayrı route)
`GET/POST /api/tender-docs/*`, `GET/POST /api/documents/*` — bk. Sistem & İhale Belgeleri.

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

**Route dosyası:** `cariler.js` (authenticate, requirePermission, auditLog). Tablolar: cariler, cari_hareketler.

### `GET /api/cariler`
Cari listesi (sayfalama + filtre).

| Query Param | Tip | Default | Açıklama |
|-------------|-----|---------|----------|
| tip | string | - | musteri, tedarikci, her_ikisi |
| aktif | boolean | true | Aktif filtresi |
| search | string | - | unvan, vergi_no, telefon, email ILIKE |
| page | number | 1 | Sayfa |
| limit | number | 20 | Max 100 |

**Response:** `{ success, data, pagination: { page, limit, total, totalPages } }`

### `GET /api/cariler/:id`
Cari detayı

### `POST /api/cariler` 🔒 🛡️ cari.create
Yeni cari (body: tip, unvan, yetkili, vergi_no, vergi_dairesi, telefon, email, adres, il, ilce, borc, alacak, kredi_limiti, banka_adi, iban, notlar, etiket).

### `PUT /api/cariler/:id` 🔒 🛡️ cari.edit
Cari güncelle (body: tüm düzenlenebilir alanlar; id, bakiye, created_at, updated_at gönderilmez).

### `DELETE /api/cariler/:id` 🔒 🛡️ cari.delete
Cari sil (soft: aktif=false).

### `GET /api/cariler/:id/hareketler`
Cari hareketleri (cari_hareketler). Query: baslangic, bitis, tip (hareket_tipi).

### `GET /api/cariler/:id/aylik-ozet`
Aylık özet (query: yil). Son 12 ay borç/alacak/bakiye/hareket_sayisi.

### `GET /api/cariler/:id/ekstre`
Cari ekstre (query: startDate, endDate). Faturalardan borç/alacak + özet (toplamBorc, toplamAlacak, bakiye).

---

## 4. Muhasebe - Faturalar

**Route dosyası:** `invoices.js` (authenticate, requirePermission, auditLog). Kalem verisi tek kaynak: `fatura_kalemleri` / fatura-kalemler route.

### `GET /api/invoices/stats`
Fatura istatistikleri (dashboard): toplam_fatura, bekleyen_fatura, onaylanan_fatura, reddedilen_fatura, bugun_vade, geciken_fatura, toplam_tutar, bekleyen_tutar (son 30 gün).

### `GET /api/invoices`
Fatura listesi. Query: type, status, customer, startDate, endDate, search, proje_id, limit (default 250), offset (default 0). Proje bilgisi LEFT JOIN projeler. items her zaman [].

### `GET /api/invoices/:id`
Fatura detayı (items=[]; kalemler /api/fatura-kalemler ile alınır).

### `POST /api/invoices` 🔒 🛡️ fatura.create
Manuel fatura oluştur (body: invoice_type, series, invoice_no, customer_*, invoice_date, due_date, status, notes, items, created_by). Kalemler transaction içinde hesaplanır; kayıt fatura_kalemleri ile ayrı yönetiliyor.

### `PUT /api/invoices/:id` 🔒 🛡️ fatura.edit
Fatura güncelle (body: aynı alanlar + updated_by).

### `PATCH /api/invoices/:id/status`
Fatura durumunu güncelle (body: status). Auth yok.

### `DELETE /api/invoices/:id` 🔒 🛡️ fatura.delete
Fatura sil

### `GET /api/invoices/summary/monthly`
Aylık fatura özeti (query: year?, type?). Grup: month, invoice_type, count, subtotal, vat_total, total_amount.

### `GET /api/invoices/summary/category`
Kategori bazlı özet (faturaKalemleriClient.getKategoriOzetSummary). Query: startDate, endDate.

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
Ürün eşleştir (body: urun_id).

### `POST /api/fatura-kalemler/bulk-eslesme` 🔒
Toplu eşleştirme

### `GET /api/fatura-kalemler/oneriler/:kalemId`
Eşleştirme önerileri (AI)

---

## 5. Muhasebe - Stok

**Route dosyası:** `stok.js`. Tablolar: urun_kartlari, urun_depo_durumlari, urun_hareketleri, depolar, depo_lokasyonlar, fatura_stok_islem, urun_kategorileri, birimler. Servis: faturaKalemleriClient, faturaService (Uyumsoft).

### Depo yönetimi
| Method | Path | Açıklama | Auth |
|--------|------|----------|------|
| GET | /api/stok/depolar | Depo listesi (urun_sayisi, toplam_deger, kritik_urun) | - |
| GET | /api/stok/depolar/:depoId/lokasyonlar | Depo lokasyonları | - |
| GET | /api/stok/lokasyonlar/:lokasyonId/stoklar | Lokasyondaki stoklar (query: arama) | - |
| GET | /api/stok/depolar/:depoId/stoklar | Depodaki stoklar (query: kritik, kategori, arama) | - |
| GET | /api/stok/depolar/karsilastirma | Depo karşılaştırma (v_depo_karsilastirma) | - |
| POST | /api/stok/depolar | Yeni depo (body: ad, kod, tur, adres, telefon, email, yetkili, kapasite_m3) | - |
| PUT | /api/stok/depolar/:id | Depo güncelle | - |
| DELETE | /api/stok/depolar/:id | Depo pasif (stok varsa 400) | - |

### Stok kartları (urun_kartlari)
| Method | Path | Açıklama | Auth |
|--------|------|----------|------|
| GET | /api/stok/kartlar | Kart listesi (query: kategori, depo, kritik, arama, limit, offset) | - |
| GET | /api/stok/kartlar/:id | Kart detay + depo_durumlari + son_hareketler | - |
| POST | /api/stok/kartlar | Yeni ürün kartı (body: kod?, ad, barkod, kategori_id, ana_birim_id, min_stok, max_stok, kritik_stok, son_alis_fiyat, kdv_orani, raf_omru_gun, aciklama) | 🔒 🛡️ stok.create |
| DELETE | /api/stok/kartlar/:id | Kart sil (ilişkili hareket/depo durumu temizlenir, soft delete) | 🔒 🛡️ stok.delete |
| GET | /api/stok/kartlar/ara | Arama (query: q, min 2 karakter) | - |

### Stok hareketleri (urun_hareketleri)
| Method | Path | Açıklama | Auth |
|--------|------|----------|------|
| GET | /api/stok/hareketler | Hareket listesi (query: limit, offset, urun_kart_id|stok_kart_id, depo_id, hareket_tipi) | - |
| POST | /api/stok/hareketler/giris | Stok girişi (body: urun_kart_id|stok_kart_id, depo_id, miktar, birim_fiyat?, belge_no?, cari_id?, aciklama?) | - |
| POST | /api/stok/hareketler/cikis | Stok çıkışı (body: urun_kart_id|stok_kart_id, depo_id, miktar, belge_no?, aciklama?) | - |
| POST | /api/stok/hareketler/transfer | Transfer (body: urun_kart_id|stok_kart_id, kaynak_depo_id, hedef_depo_id, miktar, belge_no?, aciklama?) | - |

### Raporlar ve yardımcı
| Method | Path | Açıklama | Auth |
|--------|------|----------|------|
| GET | /api/stok/kritik | Kritik stoklar (query: depo_id) | - |
| GET | /api/stok/rapor/deger | Stok değer raporu (kategori bazlı) | - |
| GET | /api/stok/kategoriler | urun_kategorileri listesi | - |
| GET | /api/stok/birimler | birimler listesi | - |

### Faturadan stok
| Method | Path | Açıklama | Auth |
|--------|------|----------|------|
| GET | /api/stok/faturalar | İşlenmemiş/ işlenmiş faturalar (limit, offset) | - |
| GET | /api/stok/faturalar/islenmemis | İşlenmemiş faturalar (limit) | - |
| GET | /api/stok/faturalar/:ettn/kalemler | Fatura kalemleri (faturaKalemleriClient) | - |
| GET | /api/stok/faturalar/:ettn/akilli-kalemler | Akıllı eşleştirme ile kalemler (Uyumsoft XML + akilli_stok_eslestir) | - |
| POST | /api/stok/faturadan-giris | Faturadan stok girişi (body: ettn, depo_id, kalemler, notlar?) | - |
| POST | /api/stok/toplu-fatura-isle | 🔒 Toplu fatura işleme (body: fatura_ettnler, depo_id, sadece_otomatik?) | - |
| GET | /api/stok/fiyat-anomaliler | Fiyat anomali raporu (query: limit) | - |

### Akıllı eşleştirme
| Method | Path | Açıklama | Auth |
|--------|------|----------|------|
| POST | /api/stok/akilli-eslestir | Tek ürün akıllı eşleştirme (body: urun_adi, urun_kodu?, tedarikci_vkn?). PostgreSQL: akilli_stok_eslestir() | - |

### `GET /api/urunler` (ayrı route: urunler.js)
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

**Route dosyası:** `kasa-banka.js`. Path prefix: /api/kasa-banka. Tablolar: kasa_banka_hesaplari, kasa_banka_hareketleri, cek_senet vb.

### Hesaplar
| Method | Path | Açıklama | Auth |
|--------|------|----------|------|
| GET | /api/kasa-banka/hesaplar | Kasa/banka hesapları listesi | - |
| POST | /api/kasa-banka/hesaplar | Yeni hesap | - |
| PUT | /api/kasa-banka/hesaplar/:id | Hesap güncelle | - |
| DELETE | /api/kasa-banka/hesaplar/:id | Hesap sil | - |

### Hareketler
| Method | Path | Açıklama | Auth |
|--------|------|----------|------|
| GET | /api/kasa-banka/hareketler | Hareket listesi (query: hesap_id vb.) | - |
| POST | /api/kasa-banka/hareketler | Hareket ekle | - |
| POST | /api/kasa-banka/transfer | Hesaplar arası transfer (body: kaynak_hesap_id, hedef_hesap_id, tutar, aciklama?) | - |

### Çek/Senet
| Method | Path | Açıklama | Auth |
|--------|------|----------|------|
| GET | /api/kasa-banka/cek-senet | Çek/senet listesi | - |
| POST | /api/kasa-banka/cek-senet | Yeni çek/senet | - |
| PUT | /api/kasa-banka/cek-senet/:id | Güncelle | - |
| POST | /api/kasa-banka/cek-senet/:id/tahsil | Tahsil | - |
| POST | /api/kasa-banka/cek-senet/:id/ciro | Ciro | - |
| POST | /api/kasa-banka/cek-senet/:id/iade | İade | - |
| DELETE | /api/kasa-banka/cek-senet/:id | Sil | - |

### Özet ve cariler
| Method | Path | Açıklama | Auth |
|--------|------|----------|------|
| GET | /api/kasa-banka/ozet | Kasa/banka özet | - |
| GET | /api/kasa-banka/cariler | Cariler listesi (dropdown vb.) | - |

### Gelir/gider (ayrı route varsa)
`GET/POST /api/gelir-gider`, `GET /api/gelir-gider/ozet` — gelir-gider route’u varsa aynı şekilde dokümante edilir.

---

## 7. Personel & Bordro

**Route dosyası personel:** `personel.js` (mount: /api/personel). İçerir: personel CRUD, projeler CRUD, proje-personel atama, görevler, tazminat, izin günü. **Route dosyası bordro:** `bordro.js` (mount: /api/bordro). **İzin:** `izin.js` (mount: /api/izin).

### Personel (personel.js)
| Method | Path | Açıklama | Auth |
|--------|------|----------|------|
| GET | /api/personel/stats | Personel istatistikleri | 🔒 |
| GET | /api/personel | Personel listesi (query: aktif, departman, search vb.) | 🔒 |
| GET | /api/personel/:id | Personel detayı | 🔒 |
| POST | /api/personel | Yeni personel (body: tc_kimlik, ad, soyad, ise_giris_tarihi, departman, pozisyon, maas vb.) | 🔒 🛡️ personel.create |
| PUT | /api/personel/:id | Personel güncelle | 🔒 🛡️ personel.edit |
| DELETE | /api/personel/:id | Personel sil | 🔒 🛡️ personel.delete |
| PUT | /api/personel/:id/izin-gun | İzin günü güncelle | - |

### Projeler (personel.js altında /api/personel/projeler)
| Method | Path | Açıklama | Auth |
|--------|------|----------|------|
| GET | /api/personel/projeler | Proje listesi | 🔒 |
| GET | /api/personel/projeler/:id | Proje detayı | 🔒 |
| POST | /api/personel/projeler | Yeni proje | - |
| PUT | /api/personel/projeler/:id | Proje güncelle | - |
| DELETE | /api/personel/projeler/:id | Proje sil | - |
| POST | /api/personel/projeler/:projeId/personel | Projeye personel ata | - |
| POST | /api/personel/projeler/:projeId/personel/bulk | Toplu personel ata | - |
| PUT | /api/personel/atama/:atamaId | Atama güncelle | - |
| DELETE | /api/personel/atama/:atamaId | Atama sil | - |

### İstatistikler ve görevler (personel.js)
| Method | Path | Açıklama | Auth |
|--------|------|----------|------|
| GET | /api/personel/stats/overview | Genel özet | 🔒 |
| GET | /api/personel/stats/departman | Departman bazlı | 🔒 |
| GET | /api/personel/gorevler | Görev listesi | 🔒 |
| POST | /api/personel/gorevler | Yeni görev | - |
| PUT | /api/personel/gorevler/:id | Görev güncelle | - |
| DELETE | /api/personel/gorevler/:id | Görev sil | - |

### Tazminat (personel.js)
| Method | Path | Açıklama | Auth |
|--------|------|----------|------|
| GET | /api/personel/tazminat/sebepler | Sebepler listesi | - |
| GET | /api/personel/tazminat/yasal-bilgiler | Yasal bilgiler | - |
| POST | /api/personel/tazminat/hesapla | Tazminat hesapla | - |
| POST | /api/personel/tazminat/kaydet | Tazminat kaydet | - |
| GET | /api/personel/tazminat/risk | Risk listesi | - |
| GET | /api/personel/tazminat/gecmis | Geçmiş hesaplamalar | - |

### Bordro (bordro.js)
| Method | Path | Açıklama | Auth |
|--------|------|----------|------|
| POST | /api/bordro/net-brut-hesapla | Net/brüt hesaplama | - |
| POST | /api/bordro/hesapla | Bordro hesapla | - |
| POST | /api/bordro/kaydet | Bordro kaydet | - |
| POST | /api/bordro/toplu-hesapla | Toplu bordro hesapla | - |
| GET | /api/bordro | Bordro listesi | 🔒 |
| GET | /api/bordro/ozet/:yil/:ay | Aylık özet | 🔒 |
| PATCH | /api/bordro/:id/odeme | Bordro ödeme işaretle | - |
| POST | /api/bordro/toplu-odeme | Toplu ödeme | - |
| DELETE | /api/bordro/donem-sil | Dönem sil | - |
| GET | /api/bordro/vergi-dilimleri/:yil | Vergi dilimleri | 🔒 |
| GET | /api/bordro/asgari-ucret/:yil | Asgari ücret | 🔒 |

### İzin (izin.js)
| Method | Path | Açıklama | Auth |
|--------|------|----------|------|
| GET | /api/izin | İzin talepleri | - |
| POST | /api/izin | İzin talebi oluştur | 🔒 |
| PUT | /api/izin/:id/onayla | İzin onayla | 🔒 |
| PUT | /api/izin/:id/reddet | İzin reddet | 🔒 |

---

## 8. Planlama

**Route dosyası planlama:** `planlama.js` (mount: /api/planlama). Piyasa takip, market scraper, ana ürünler, ambalaj parse. **Route dosyası menü:** `menu-planlama.js` (mount: /api/menu-planlama). Reçeteler, menü planları, şartname, import, AI malzeme öneri.

### Piyasa (planlama.js)
| Method | Path | Açıklama | Auth |
|--------|------|----------|------|
| GET | /api/planlama/piyasa/takip-listesi | Piyasa takip listesi | - |
| POST | /api/planlama/piyasa/takip-listesi | Takip ekle | - |
| DELETE | /api/planlama/piyasa/takip-listesi/:id | Takip sil | - |
| POST | /api/planlama/piyasa/toplu-guncelle | Toplu güncelle | - |
| GET | /api/planlama/piyasa/gecmis | Geçmiş fiyatlar | - |
| POST | /api/planlama/piyasa/chat | Piyasa chat | - |
| POST | /api/planlama/piyasa/oneri | Öneri | - |
| POST | /api/planlama/piyasa/hizli-arastir | Hızlı araştır | - |
| POST | /api/planlama/piyasa/detayli-arastir | Detaylı araştır | - |
| POST | /api/planlama/piyasa/kaydet-sonuclar | Sonuçları kaydet | - |
| POST | /api/planlama/piyasa/fiyat-kaydet | Fiyat kaydet | - |
| GET | /api/planlama/piyasa/urun-ara | Ürün ara | - |
| GET | /api/planlama/piyasa/fatura-fiyatlari | Fatura fiyatları | - |
| GET | /api/planlama/piyasa/karsilastirma | Karşılaştırma | - |
| PUT | /api/planlama/piyasa/fiyat-guncelle/:stokKartId | Fiyat güncelle | - |

### Market (planlama.js)
| Method | Path | Açıklama | Auth |
|--------|------|----------|------|
| GET | /api/planlama/market/sources | Kaynak listesi | - |
| POST | /api/planlama/market/collect | Topla | - |
| GET | /api/planlama/market | Market verisi | - |

### Ana ürünler ve ambalaj (planlama.js)
| Method | Path | Açıklama | Auth |
|--------|------|----------|------|
| GET | /api/planlama/ana-urunler | Ana ürün listesi | - |
| GET | /api/planlama/ana-urunler/:id | Ana ürün detayı | - |
| POST | /api/planlama/ana-urunler | Yeni ana ürün | - |
| POST | /api/planlama/ana-urunler/:id/eslestir | Stok kartı eşleştir | - |
| DELETE | /api/planlama/ana-urunler/:id/eslestir/:stokKartId | Eşleştirme sil | - |
| PUT | /api/planlama/ana-urunler/:id/fiyat | Fiyat güncelle | - |
| GET | /api/planlama/ana-urunler-kategoriler | Kategoriler | - |
| GET | /api/planlama/eslesmemis-stok-kartlari | Eşleşmemiş stok kartları | - |
| POST | /api/planlama/ambalaj-parse | Ambalaj parse | - |
| POST | /api/planlama/stok-karti/:id/ambalaj-guncelle | Ambalaj güncelle | - |
| POST | /api/planlama/stok-karti/toplu-ambalaj-guncelle | Toplu ambalaj güncelle | - |
| GET | /api/planlama/stok-karti/ambalaj-ozet | Ambalaj özet | - |

### Menü planlama (menu-planlama.js)
Kategoriler, receteler (CRUD, malzemeler, maliyet-hesapla), öğün tipleri, proje öğün şablonları, menu-planlari (CRUD, öğünler, yemekler), menu-plan (yemek-ekle), gunluk-ozet, sablon-kopyala, sartname (CRUD, gramaj, proje-ata, ogun-yapisi), recete gramaj-kontrol, import (analyze, save), AI malzeme oneri (tekli ve batch), urun-kategorileri, urun-kartlari (CRUD, eslestir), stok-kartlari-listesi. Detaylı path’ler route dosyasından okunabilir.

---

## 9. AI & Chat

**Route dosyası:** `ai.js` (mount: /api/ai). Servis: ai-agent, claude. Chat streaming, agent/tools, templates, settings, memory, conversations, god-mode, analyze-errors.

### Chat ve agent
| Method | Path | Açıklama | Auth |
|--------|------|----------|------|
| POST | /api/ai/chat | AI sohbet (streaming; message, conversation_id?, context?) | - |
| GET | /api/ai/agent/tools | Agent araç listesi | - |
| POST | /api/ai/agent/execute | Agent araç çalıştır | - |

### Templates
| Method | Path | Açıklama | Auth |
|--------|------|----------|------|
| GET | /api/ai/templates | Şablon listesi | - |
| GET | /api/ai/templates/:id | Şablon detayı | - |
| POST | /api/ai/templates | Yeni şablon | 🔑 |
| PUT | /api/ai/templates/:id | Şablon güncelle | 🔑 |
| DELETE | /api/ai/templates/:id | Şablon sil | 🔑 |
| POST | /api/ai/templates/:id/increment-usage | Kullanım artır | - |

### Ürün analizi ve durum
| Method | Path | Açıklama | Auth |
|--------|------|----------|------|
| POST | /api/ai/analyze-product | Ürün analizi | - |
| POST | /api/ai/analyze-products-batch | Toplu ürün analizi | - |
| GET | /api/ai/status | AI durumu | - |

### Settings (admin)
| Method | Path | Açıklama | Auth |
|--------|------|----------|------|
| GET | /api/ai/settings | Ayarlar | - |
| PUT | /api/ai/settings | Ayarları güncelle | 🔑 |
| GET | /api/ai/settings/export | Ayarları dışa aktar | 🔑 |
| POST | /api/ai/settings/import | Ayarları içe aktar | 🔑 |
| GET | /api/ai/settings/history | Ayarlar geçmişi | 🔑 |
| GET | /api/ai/settings/history/:settingKey/:version | Sürüm detayı | 🔑 |
| POST | /api/ai/settings/restore/:settingKey/:version | Sürüm geri yükle | 🔑 |
| GET | /api/ai/settings/models | Model listesi | - |
| PUT | /api/ai/settings/model | Model güncelle | 🔑 |

### Memory ve öğrenilen bilgiler
| Method | Path | Açıklama | Auth |
|--------|------|----------|------|
| GET | /api/ai/memory | AI hafıza | - |
| POST | /api/ai/memory | Hafızaya ekle | - |
| DELETE | /api/ai/memory/:id | Hafızadan sil | 🔑 |
| GET | /api/ai/learned-facts | Öğrenilen bilgiler | - |
| PUT | /api/ai/learned-facts/:id/verify | Doğrula | - |

### Snapshot ve konuşmalar
| Method | Path | Açıklama | Auth |
|--------|------|----------|------|
| POST | /api/ai/snapshot | Snapshot al | - |
| GET | /api/ai/snapshots | Snapshot listesi | - |
| GET | /api/ai/conversations | Konuşma listesi | - |
| GET | /api/ai/conversations/list | Konuşma listesi (alternatif) | - |
| GET | /api/ai/conversations/search | Konuşma arama | - |
| GET | /api/ai/conversations/:sessionId | Konuşma detayı | - |
| DELETE | /api/ai/conversations/:sessionId | Konuşma sil | - |

### Dashboard, feedback, god-mode, hata analizi
| Method | Path | Açıklama | Auth |
|--------|------|----------|------|
| GET | /api/ai/dashboard | AI dashboard | - |
| POST | /api/ai/feedback | Geri bildirim | - |
| GET | /api/ai/feedback/stats | Feedback istatistikleri | - |
| POST | /api/ai/god-mode/execute | God mode komut çalıştır | 🔒 super_admin |
| GET | /api/ai/god-mode/tools | God mode araçları | 🔒 super_admin |
| GET | /api/ai/god-mode/logs | God mode logları | 🔒 super_admin |
| POST | /api/ai/analyze-errors | Hata analizi (optionalAuth) | - |
| GET | /api/ai/errors/recent | Son hatalar | 🔑 |

### Ayrı route: ai-memory.js, prompt-builder
`GET/POST/DELETE /api/ai/memory` ai.js içinde. `/api/ai/memory` prefix’i ai.js’te kullanılıyor; ai-memory router’ı server’da `/api/ai/memory` ile mount edilmişse çakışma olabilir — server’da sıra: önce `/api/ai`, sonra `/api/ai/memory`. Prompt builder: `prompt-builder.js` → `/api/prompt-builder/templates`, `/api/prompt-builder/generate` vb.

---

## Unified Notes

**Route:** `routes/notes/index.js` → mount `/api/notes`. Alt route’lar: personal.js, contextual.js, tags.js, reminders.js, attachments.js. **Tüm endpoint’ler** `authenticate` middleware ile korunur. Tablolar: `unified_notes`, `note_tags_master`, `note_tags`, `unified_note_reminders`, `unified_note_attachments`.

### Kişisel notlar (personal) — `/api/notes`

| Method | Path | Açıklama | Auth |
|--------|------|----------|------|
| GET | /api/notes | Kişisel not listesi (context_type IS NULL). Query: is_task, is_completed, priority, color, pinned, due_date_from, due_date_to, search, limit (default 100), offset (default 0). Response: notes (tags, attachments, reminders dahil) | 🔒 |
| GET | /api/notes/:id | Tek not detayı | 🔒 |
| POST | /api/notes | Yeni kişisel not. Body: content (zorunlu), content_format (default plain), is_task (default false), priority (default normal), color (default blue), pinned (default false), due_date, reminder_date, tags (array) | 🔒 |
| PUT | /api/notes/:id | Not güncelle. Body: content, content_format, is_task, is_completed, priority, color, pinned, due_date, reminder_date, sort_order, tags | 🔒 |
| DELETE | /api/notes/:id | Not sil | 🔒 |
| PUT | /api/notes/:id/toggle | Görev tamamla/aç (is_completed toggle) | 🔒 |
| PUT | /api/notes/:id/pin | Sabitle/sabitten kaldır (pinned toggle) | 🔒 |
| PUT | /api/notes/reorder | Sıra güncelle (body: sıralama bilgisi) | 🔒 |
| DELETE | /api/notes/completed | Tamamlanan kişisel notları toplu sil | 🔒 |

### Bağlama bağlı notlar (contextual) — `/api/notes/context/:type/:id`

Geçerli `type`: tender, customer, event, project.

| Method | Path | Açıklama | Auth |
|--------|------|----------|------|
| GET | /api/notes/context/:type/:id | Belirtilen bağlamdaki notları listele. Query: limit (default 100), offset (default 0). Response: notes, total, context_type, context_id | 🔒 |
| POST | /api/notes/context/:type/:id | Bu bağlam için yeni not oluştur (body: content, content_format, is_task, priority, color, pinned, due_date, reminder_date, tags vb.) | 🔒 |
| PUT | /api/notes/context/:type/:id/reorder | Bağlam notlarının sırasını güncelle | 🔒 |

### Etiketler (tags) — `/api/notes/tags`

| Method | Path | Açıklama | Auth |
|--------|------|----------|------|
| GET | /api/notes/tags | Kullanıcının tüm etiketleri (usage_count, name, color) | 🔒 |
| GET | /api/notes/tags/suggestions | Etiket önerileri (autocomplete). Query: q, limit (default 20) | 🔒 |
| POST | /api/notes/tags | Yeni etiket. Body: name, color | 🔒 |
| PUT | /api/notes/tags/:tagId | Etiket güncelle (name, color) | 🔒 |
| DELETE | /api/notes/tags/:tagId | Etiket sil | 🔒 |

### Hatırlatıcılar (reminders) — `/api/notes/reminders`

| Method | Path | Açıklama | Auth |
|--------|------|----------|------|
| GET | /api/notes/reminders/upcoming | Yaklaşan (gönderilmemiş) hatırlatıcılar. Query: limit (default 50) | 🔒 |
| GET | /api/notes/reminders/due | Vadesi gelmiş hatırlatıcılar (bildirim sistemi için) | 🔒 |
| POST | /api/notes/reminders/:noteId | Nota hatırlatıcı ekle. Body: reminder_date (zorunlu), reminder_type (default notification) | 🔒 |
| PUT | /api/notes/reminders/:id/sent | Hatırlatıcıyı “gönderildi” işaretle | 🔒 |
| DELETE | /api/notes/reminders/:id | Hatırlatıcı sil | 🔒 |

### Ekler (attachments) — `/api/notes/attachments`

| Method | Path | Açıklama | Auth |
|--------|------|----------|------|
| POST | /api/notes/attachments/:noteId | Nota dosya ekle. multipart/form-data, field: file. Max 10MB. İzin verilen: jpeg, png, gif, webp, pdf, doc, docx, xls, xlsx, txt, csv | 🔒 |
| GET | /api/notes/attachments/:id/download | Eki indir | 🔒 |
| GET | /api/notes/attachments/note/:noteId | Belirli notun eklerini listele | 🔒 |
| DELETE | /api/notes/attachments/:id | Eki sil | 🔒 |

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
- `stok_kartlari`

---

## 📝 Swagger Dokümantasyonu

Canlı Swagger UI: `http://localhost:3001/api-docs`

Her route dosyasında JSDoc formatında Swagger annotations mevcut.

---

*Bu döküman route dosyalarından derlenmiştir.*
