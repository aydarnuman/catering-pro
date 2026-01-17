# Routes API Dokümantasyonu

Bu klasör tüm API endpoint'lerini içerir. Her dosya bir modülü temsil eder.

**Toplam Route Dosyası:** 39
**Son Güncelleme:** Ocak 2026

---

## 📁 Modül Kategorileri

### 🔐 Kimlik Doğrulama & Sistem

#### auth.js - Kimlik Doğrulama
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| POST | `/api/auth/login` | Kullanıcı girişi |
| POST | `/api/auth/register` | Yeni kullanıcı kaydı |
| GET | `/api/auth/me` | Mevcut kullanıcı bilgisi |
| PUT | `/api/auth/profile` | Profil güncelleme |
| PUT | `/api/auth/password` | Şifre değiştirme |
| GET | `/api/auth/users` | Kullanıcı listesi (Admin) |

#### notifications.js - Bildirim Sistemi
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | `/api/notifications` | Bildirim listesi |
| GET | `/api/notifications/unread-count` | Okunmamış sayısı |
| PATCH | `/api/notifications/:id/read` | Okundu işaretle |
| PATCH | `/api/notifications/read-all` | Tümünü okundu yap |
| POST | `/api/notifications` | Bildirim oluştur |
| DELETE | `/api/notifications/:id` | Bildirim sil |

#### search.js - Global Arama
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | `/api/search` | Tüm modüllerde arama |
| GET | `/api/search/suggestions` | Arama önerileri |

#### database-stats.js - Sistem İstatistikleri
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | `/api/database-stats/admin-stats` | Admin istatistikleri |
| GET | `/api/database-stats/health-detailed` | Detaylı sistem durumu |

---

### 📋 İhale Modülü

#### tenders.js - İhale Yönetimi
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | `/api/tenders` | İhale listesi (pagination, filter) |
| GET | `/api/tenders/stats` | İstatistikler |
| GET | `/api/tenders/:id` | İhale detayı |
| POST | `/api/tenders` | Yeni ihale |
| PUT | `/api/tenders/:id` | İhale güncelle |
| DELETE | `/api/tenders/:id` | İhale sil |

**Filtreleme:** `?city=Ankara&status=active&search=yemek`

#### tender-tracking.js - İhale Takip Listesi
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | `/api/tender-tracking` | Takip listesi |
| POST | `/api/tender-tracking` | Takibe ekle |
| PUT | `/api/tender-tracking/:id` | Takip güncelle |
| DELETE | `/api/tender-tracking/:id` | Takipten çıkar |
| POST | `/api/tender-tracking/:id/notes` | Not ekle |
| DELETE | `/api/tender-tracking/:id/notes/:noteId` | Not sil |
| GET | `/api/tender-tracking/check/:tenderId` | Takip durumu kontrol |
| GET | `/api/tender-tracking/stats` | Takip istatistikleri |
| GET | `/api/tender-tracking/:tenderId/analysis` | Birleşik analiz sonucu |
| POST | `/api/tender-tracking/add-from-analysis` | Analiz sonrası ekle |

**Durumlar:** `bekliyor`, `basvuruldu`, `kazanildi`, `kaybedildi`, `iptal`

#### teklifler.js - Teklif Hazırlama
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | `/api/teklifler` | Teklif listesi |
| GET | `/api/teklifler/:id` | Teklif detayı |
| GET | `/api/teklifler/ihale/:ihaleId` | İhaleye ait teklif |
| POST | `/api/teklifler` | Yeni teklif |
| PUT | `/api/teklifler/:id` | Teklif güncelle |
| DELETE | `/api/teklifler/:id` | Teklif sil |

**Durum:** `taslak`, `hazirlaniyor`, `tamamlandi`, `sunuldu`

#### ihale-sonuclari.js - İhale Sonuçları
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | `/api/ihale-sonuclari` | Sonuç listesi |
| GET | `/api/ihale-sonuclari/:id` | Sonuç detayı |
| POST | `/api/ihale-sonuclari` | Sonuç kaydet |
| PUT | `/api/ihale-sonuclari/:id` | Sonuç güncelle |

---

### 📄 Döküman Modülü

#### documents.js - Döküman Yönetimi
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| POST | `/api/documents/upload` | Döküman yükle |
| POST | `/api/documents/analyze` | AI ile analiz (SSE) |
| GET | `/api/documents` | Döküman listesi |
| GET | `/api/documents/:id` | Döküman detayı |
| DELETE | `/api/documents/:id` | Döküman sil |
| GET | `/api/documents/:id/download` | Döküman indir |
| POST | `/api/documents/:id/reanalyze` | Yeniden analiz |

**Desteklenen Formatlar:** PDF, DOCX, DOC, XLSX, XLS, TXT, CSV, PNG, JPG, ZIP

#### document-proxy.js - Döküman Proxy
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | `/api/documents/proxy/:id` | Harici döküman proxy |

#### tender-documents.js - İhale Dökümanları
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | `/api/tender-docs/:tenderId` | İhale dökümanları |
| POST | `/api/tender-docs/:tenderId/download` | Toplu indirme |

#### tender-content-documents.js - İçerik Dökümanları
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | `/api/tender-content/:tenderId` | İçerik dökümanları |
| POST | `/api/tender-content/:tenderId/analyze` | Toplu analiz |

#### content-extractor.js - İçerik Çıkarıcı
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| POST | `/api/content/extract` | Metinden veri çıkar |
| POST | `/api/content/ocr` | OCR işlemi |

---

### 👥 Muhasebe Modülü

#### cariler.js - Cari Hesap Yönetimi
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | `/api/cariler` | Cari listesi (filter: tip, aktif, search) |
| GET | `/api/cariler/:id` | Cari detayı |
| POST | `/api/cariler` | Yeni cari |
| PUT | `/api/cariler/:id` | Cari güncelle |
| DELETE | `/api/cariler/:id` | Cari sil |
| GET | `/api/cariler/:id/hareketler` | Cari hareketleri |
| GET | `/api/cariler/:id/bakiye` | Güncel bakiye |
| GET | `/api/cariler/:id/faturalar` | Cari faturaları |

**Cari Tipleri:** `musteri`, `tedarikci`, `her_ikisi`

#### mutabakat.js - Cari Mutabakat
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | `/api/mutabakat/:cariId` | Mutabakat raporu |
| POST | `/api/mutabakat/:cariId/export` | PDF/Excel export |

#### invoices.js - Fatura Yönetimi
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | `/api/invoices` | Fatura listesi |
| GET | `/api/invoices/:id` | Fatura detayı |
| POST | `/api/invoices` | Yeni fatura |
| PUT | `/api/invoices/:id` | Fatura güncelle |
| DELETE | `/api/invoices/:id` | Fatura sil |
| POST | `/api/invoices/:id/odeme` | Ödeme kaydet |
| GET | `/api/invoices/vadesi-gecen` | Vadesi geçen faturalar |
| GET | `/api/invoices/ozet` | Fatura özeti |

**Fatura Tipleri:** `alis`, `satis`

#### kasa-banka.js - Nakit Yönetimi
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | `/api/kasa-banka/hesaplar` | Hesap listesi |
| GET | `/api/kasa-banka/hesaplar/:id` | Hesap detayı |
| POST | `/api/kasa-banka/hesaplar` | Yeni hesap |
| PUT | `/api/kasa-banka/hesaplar/:id` | Hesap güncelle |
| GET | `/api/kasa-banka/hareketler` | Hareket listesi |
| POST | `/api/kasa-banka/hareketler` | Hareket ekle |
| POST | `/api/kasa-banka/transfer` | Hesaplar arası transfer |
| GET | `/api/kasa-banka/ozet` | Günlük özet |

**Hesap Tipleri:** `kasa`, `banka`
**Hareket Tipleri:** `giris`, `cikis`, `transfer`

#### firmalar.js - Firma Yönetimi
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | `/api/firmalar` | Firma listesi |
| GET | `/api/firmalar/:id` | Firma detayı |
| POST | `/api/firmalar` | Yeni firma |
| PUT | `/api/firmalar/:id` | Firma güncelle |
| DELETE | `/api/firmalar/:id` | Firma sil |

---

### 📦 Stok Modülü

#### stok.js - Stok ve Depo Yönetimi
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | `/api/stok/depolar` | Depo listesi |
| GET | `/api/stok/depolar/:id` | Depo detayı |
| POST | `/api/stok/depolar` | Yeni depo |
| GET | `/api/stok/depolar/:id/lokasyonlar` | Depo lokasyonları |
| GET | `/api/stok/lokasyonlar/:id/stoklar` | Lokasyon stokları |
| GET | `/api/stok/kartlar` | Stok kartları listesi |
| GET | `/api/stok/kartlar/:id` | Stok kartı detayı |
| POST | `/api/stok/kartlar` | Yeni stok kartı |
| PUT | `/api/stok/kartlar/:id` | Stok kartı güncelle |
| DELETE | `/api/stok/kartlar/:id` | Stok kartı sil |
| POST | `/api/stok/hareketler` | Stok hareketi ekle |
| GET | `/api/stok/hareketler` | Hareket listesi |
| GET | `/api/stok/kritik` | Kritik stok listesi |
| GET | `/api/stok/durum/:kartId` | Depo bazlı stok durumu |

**Hareket Tipleri:** `giris`, `cikis`, `transfer`, `sayim`, `fire`

#### demirbas.js - Demirbaş Takibi
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | `/api/demirbas` | Demirbaş listesi |
| GET | `/api/demirbas/:id` | Demirbaş detayı |
| POST | `/api/demirbas` | Yeni demirbaş |
| PUT | `/api/demirbas/:id` | Demirbaş güncelle |
| DELETE | `/api/demirbas/:id` | Demirbaş sil |
| POST | `/api/demirbas/:id/amortisman` | Amortisman hesapla |

---

### 👨‍💼 İnsan Kaynakları Modülü

#### personel.js - Personel Yönetimi
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | `/api/personel` | Personel listesi |
| GET | `/api/personel/stats` | İstatistikler |
| GET | `/api/personel/projeler` | Proje listesi |
| GET | `/api/personel/:id` | Personel detayı |
| POST | `/api/personel` | Yeni personel |
| PUT | `/api/personel/:id` | Personel güncelle |
| DELETE | `/api/personel/:id` | Personel sil |
| GET | `/api/personel/:id/bordro-gecmisi` | Bordro geçmişi |
| GET | `/api/personel/:id/izin-bakiye` | İzin bakiyesi |

#### bordro.js - Bordro Hesaplama
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | `/api/bordro` | Bordro listesi (dönem bazlı) |
| POST | `/api/bordro/hesapla` | Bordro hesapla |
| GET | `/api/bordro/:id` | Bordro detayı |
| POST | `/api/bordro/toplu` | Toplu bordro oluştur |
| GET | `/api/bordro/parametreler` | SGK/Vergi oranları |
| POST | `/api/bordro/tahakkuk` | Tahakkuk oluştur |
| GET | `/api/bordro/donem/:donem` | Dönem bazlı liste |

**Hesaplama:** Net→Brüt dönüşüm, AGİ, SGK, Gelir Vergisi, Damga Vergisi

#### bordro-import.js - Bordro Import
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| POST | `/api/bordro-import/upload` | Excel yükle |
| POST | `/api/bordro-import/process` | Import işle |
| GET | `/api/bordro-import/template` | Şablon indir |

#### izin.js - İzin Yönetimi
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | `/api/izin` | İzin talepleri |
| GET | `/api/izin/:id` | İzin detayı |
| POST | `/api/izin` | İzin talebi oluştur |
| PUT | `/api/izin/:id` | İzin güncelle |
| POST | `/api/izin/:id/onayla` | İzin onayla |
| POST | `/api/izin/:id/reddet` | İzin reddet |
| GET | `/api/izin/personel/:personelId/bakiye` | İzin bakiyesi |

**İzin Tipleri:** `yillik`, `mazeret`, `hastalik`, `dogum`, `olum`

#### maas-odeme.js - Maaş Ödeme
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | `/api/maas-odeme` | Ödeme listesi |
| POST | `/api/maas-odeme` | Ödeme kaydet |
| GET | `/api/maas-odeme/bekleyen` | Bekleyen ödemeler |
| POST | `/api/maas-odeme/toplu` | Toplu ödeme |

---

### 🍽️ Planlama Modülü

#### planlama.js - Üretim Planlama
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | `/api/planlama/receteler` | Reçete listesi |
| GET | `/api/planlama/receteler/:id` | Reçete detayı |
| POST | `/api/planlama/receteler` | Yeni reçete |
| PUT | `/api/planlama/receteler/:id` | Reçete güncelle |
| GET | `/api/planlama/menuler` | Menü listesi |
| POST | `/api/planlama/menuler` | Menü oluştur |
| GET | `/api/planlama/sartnameler` | Gramaj şartnameleri |
| POST | `/api/planlama/malzeme-hesapla` | Malzeme ihtiyacı |

#### menu-planlama.js - Menü Planlama
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | `/api/menu-planlama/receteler` | Proje bazlı reçeteler |
| POST | `/api/menu-planlama/receteler` | Reçete oluştur |
| GET | `/api/menu-planlama/maliyet/:receteId` | Maliyet hesapla |
| POST | `/api/menu-planlama/import` | Excel'den import |

---

### 🛒 Satın Alma Modülü

#### satin-alma.js - Satın Alma
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | `/api/satin-alma/talepler` | Talep listesi |
| GET | `/api/satin-alma/talepler/:id` | Talep detayı |
| POST | `/api/satin-alma/talepler` | Yeni talep |
| PUT | `/api/satin-alma/talepler/:id` | Talep güncelle |
| POST | `/api/satin-alma/talepler/:id/onayla` | Talep onayla |
| POST | `/api/satin-alma/talepler/:id/reddet` | Talep reddet |
| DELETE | `/api/satin-alma/talepler/:id` | Talep sil |
| GET | `/api/satin-alma/siparisler` | Sipariş listesi |
| POST | `/api/satin-alma/siparisler` | Sipariş oluştur |

---

### 📊 Proje Modülü

#### projeler.js - Proje Yönetimi
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | `/api/projeler` | Proje listesi |
| GET | `/api/projeler/:id` | Proje detayı |
| POST | `/api/projeler` | Yeni proje |
| PUT | `/api/projeler/:id` | Proje güncelle |
| DELETE | `/api/projeler/:id` | Proje sil |
| GET | `/api/projeler/:id/personeller` | Proje personelleri |
| POST | `/api/projeler/:id/personel-ata` | Personel ata |
| DELETE | `/api/projeler/:id/personel/:personelId` | Personel çıkar |
| GET | `/api/projeler/:id/maliyet` | Proje maliyeti |

#### proje-hareketler.js - Proje Log'ları
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | `/api/proje-hareketler/:projeId` | Hareket listesi |
| POST | `/api/proje-hareketler` | Hareket ekle |

---

### 🤖 AI Modülü

#### ai.js - AI Asistan
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| POST | `/api/ai/chat` | Sohbet mesajı (streaming) |
| POST | `/api/ai/agent` | Tool-based AI agent |
| GET | `/api/ai/templates` | Prompt şablonları |
| POST | `/api/ai/templates` | Şablon kaydet |
| GET | `/api/ai/settings` | AI ayarları |
| PUT | `/api/ai/settings` | AI ayarları güncelle |
| POST | `/api/ai/feedback` | Geri bildirim |

#### ai-memory.js - AI Hafıza
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | `/api/ai/memory` | Konuşma geçmişi |
| DELETE | `/api/ai/memory` | Geçmişi temizle |
| GET | `/api/ai/memory/context` | Bağlam bilgisi |

---

### 🔄 Entegrasyon Modülü

#### sync.js - Senkronizasyon
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| POST | `/api/sync/trigger` | Manuel sync başlat |
| GET | `/api/sync/status` | Sync durumu |
| GET | `/api/sync/logs` | Sync logları |

#### uyumsoft.js - Uyumsoft Entegrasyonu
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| POST | `/api/uyumsoft/login` | Uyumsoft login |
| GET | `/api/uyumsoft/faturalar` | Fatura çek |
| POST | `/api/uyumsoft/sync` | Senkronize et |

---

### 🛠️ Yardımcı Modüller

#### export.js - Dışa Aktarma
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| POST | `/api/export/excel` | Excel export |
| POST | `/api/export/pdf` | PDF export |
| GET | `/api/export/templates` | Export şablonları |

#### import.js - İçe Aktarma
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| POST | `/api/import/excel` | Excel import |
| POST | `/api/import/validate` | Veri doğrulama |
| GET | `/api/import/templates` | Import şablonları |

#### etiketler.js - Etiket Sistemi
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | `/api/etiketler` | Etiket listesi |
| POST | `/api/etiketler` | Etiket oluştur |
| DELETE | `/api/etiketler/:id` | Etiket sil |

#### notlar.js - Not Sistemi
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | `/api/notlar` | Not listesi |
| POST | `/api/notlar` | Not ekle |
| PUT | `/api/notlar/:id` | Not güncelle |
| PUT | `/api/notlar/:id/toggle` | Tamamlandı işaretle |
| DELETE | `/api/notlar/:id` | Not sil |

#### duplicate-check.js - Duplikat Kontrol
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| POST | `/api/duplicates/check` | Duplikat kontrol |
| GET | `/api/duplicates/list` | Duplikat listesi |

---

## 🔧 Ortak Kullanım

### Pagination
```javascript
// Query params
?page=1&limit=20

// Response
{
  "success": true,
  "data": [...],
  "count": 150,
  "page": 1,
  "totalPages": 8
}
```

### Filtering
```javascript
// Örnek: Aktif müşterileri ara
GET /api/cariler?tip=musteri&aktif=true&search=ankara

// Tarih aralığı
GET /api/invoices?startDate=2026-01-01&endDate=2026-01-31
```

### Sorting
```javascript
GET /api/tenders?sort=tender_date&order=desc
```

### Error Handling
```javascript
// 400 - Bad Request
{ "success": false, "error": "Zorunlu alan eksik: unvan" }

// 401 - Unauthorized
{ "success": false, "error": "Oturum süresi dolmuş" }

// 404 - Not Found
{ "success": false, "error": "Kayıt bulunamadı" }

// 500 - Server Error
{ "success": false, "error": "Veritabanı hatası" }
```

---

## 📚 Swagger Dokümantasyonu

API dokümantasyonuna tarayıcıdan erişebilirsiniz:

```
http://localhost:3001/api-docs
```

Swagger JSON:
```
http://localhost:3001/api-docs.json
```
