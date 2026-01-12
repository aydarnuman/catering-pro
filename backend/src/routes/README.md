# Routes API Dokümantasyonu

Bu klasör tüm API endpoint'lerini içerir. Her dosya bir modülü temsil eder.

---

## 📁 Modüller

### 🔐 auth.js - Kimlik Doğrulama
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| POST | `/api/auth/login` | Kullanıcı girişi |
| POST | `/api/auth/register` | Yeni kullanıcı kaydı |
| GET | `/api/auth/me` | Mevcut kullanıcı bilgisi |
| POST | `/api/auth/logout` | Çıkış |

---

### 👥 cariler.js - Cari Hesap Yönetimi
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | `/api/cariler` | Tüm cariler (filter: tip, aktif, search) |
| GET | `/api/cariler/:id` | Tek cari detayı |
| POST | `/api/cariler` | Yeni cari oluştur |
| PUT | `/api/cariler/:id` | Cari güncelle |
| DELETE | `/api/cariler/:id` | Cari sil |
| GET | `/api/cariler/:id/hareketler` | Cari hareketleri |
| GET | `/api/cariler/:id/bakiye` | Güncel bakiye |

**Cari Tipleri:** `musteri`, `tedarikci`, `her_ikisi`

---

### 📦 stok.js - Stok ve Depo Yönetimi
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | `/api/stok/depolar` | Depo listesi |
| GET | `/api/stok/depolar/:id/lokasyonlar` | Depo lokasyonları |
| GET | `/api/stok/lokasyonlar/:id/stoklar` | Lokasyon stokları |
| GET | `/api/stok/kartlar` | Stok kartları listesi |
| GET | `/api/stok/kartlar/:id` | Stok kartı detayı |
| POST | `/api/stok/kartlar` | Yeni stok kartı |
| PUT | `/api/stok/kartlar/:id` | Stok kartı güncelle |
| POST | `/api/stok/hareketler` | Stok hareketi ekle |
| GET | `/api/stok/hareketler` | Hareket listesi |
| GET | `/api/stok/kritik` | Kritik stok listesi |

**Hareket Tipleri:** `giris`, `cikis`, `transfer`, `sayim`

---

### 👨‍💼 personel.js - Personel Yönetimi
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | `/api/personel` | Personel listesi |
| GET | `/api/personel/stats` | İstatistikler (dashboard) |
| GET | `/api/personel/projeler` | Proje listesi |
| GET | `/api/personel/:id` | Personel detayı |
| POST | `/api/personel` | Yeni personel |
| PUT | `/api/personel/:id` | Personel güncelle |
| DELETE | `/api/personel/:id` | Personel sil |
| GET | `/api/personel/:id/izinler` | İzin kayıtları |
| POST | `/api/personel/:id/izin` | İzin talebi |

---

### 💰 bordro.js - Bordro Hesaplama
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | `/api/bordro` | Bordro listesi (dönem bazlı) |
| POST | `/api/bordro/hesapla` | Bordro hesapla |
| GET | `/api/bordro/:id` | Bordro detayı |
| POST | `/api/bordro/toplu` | Toplu bordro oluştur |
| GET | `/api/bordro/parametreler` | SGK/Vergi oranları |
| POST | `/api/bordro/tahakkuk` | Tahakkuk oluştur |

**Hesaplama:** Net→Brüt dönüşüm, AGİ, SGK, Gelir Vergisi, Damga Vergisi

---

### 🧾 invoices.js - Fatura Yönetimi
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | `/api/invoices` | Fatura listesi |
| GET | `/api/invoices/:id` | Fatura detayı |
| POST | `/api/invoices` | Yeni fatura |
| PUT | `/api/invoices/:id` | Fatura güncelle |
| DELETE | `/api/invoices/:id` | Fatura sil |
| POST | `/api/invoices/:id/odeme` | Ödeme kaydet |
| GET | `/api/invoices/vadesi-gecen` | Vadesi geçen faturalar |

**Fatura Tipleri:** `alis`, `satis`

---

### 🏦 kasa-banka.js - Nakit Yönetimi
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | `/api/kasa-banka/hesaplar` | Hesap listesi |
| GET | `/api/kasa-banka/hesaplar/:id` | Hesap detayı |
| POST | `/api/kasa-banka/hesaplar` | Yeni hesap |
| GET | `/api/kasa-banka/hareketler` | Hareket listesi |
| POST | `/api/kasa-banka/hareketler` | Hareket ekle |
| POST | `/api/kasa-banka/transfer` | Hesaplar arası transfer |
| GET | `/api/kasa-banka/ozet` | Günlük özet |

**Hesap Tipleri:** `kasa`, `banka`
**Hareket Tipleri:** `giris`, `cikis`, `transfer`

---

### 📋 tenders.js - İhale Takibi
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | `/api/tenders` | İhale listesi (pagination, filter) |
| GET | `/api/tenders/stats` | İstatistikler |
| GET | `/api/tenders/:id` | İhale detayı |
| DELETE | `/api/tenders/:id` | İhale sil |
| POST | `/api/tenders/:id/takip` | Takibe al |
| GET | `/api/tenders/yaklasan` | Yaklaşan ihaleler |

---

### 📄 documents.js - Döküman İşleme
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| POST | `/api/documents/upload` | Döküman yükle + AI analiz |
| GET | `/api/documents` | Döküman listesi |
| GET | `/api/documents/:id` | Döküman detayı |
| DELETE | `/api/documents/:id` | Döküman sil |
| GET | `/api/documents/:id/download` | Döküman indir |
| POST | `/api/documents/:id/reanalyze` | Yeniden analiz |

**Desteklenen Formatlar:** PDF, DOCX, XLSX

---

### 🍽️ menu-planlama.js - Menü Planlama
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | `/api/menu-planlama/receteler` | Reçete listesi |
| POST | `/api/menu-planlama/receteler` | Yeni reçete |
| GET | `/api/menu-planlama/menuler` | Menü listesi |
| POST | `/api/menu-planlama/menuler` | Menü oluştur |
| GET | `/api/menu-planlama/sartnameler` | Gramaj şartnameleri |
| POST | `/api/menu-planlama/malzeme-hesapla` | Malzeme ihtiyacı hesapla |

---

### 🤖 ai.js - AI Asistan
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| POST | `/api/ai/chat` | Sohbet mesajı gönder |
| GET | `/api/ai/memory` | Konuşma geçmişi |
| DELETE | `/api/ai/memory` | Geçmişi temizle |
| POST | `/api/ai/analyze` | Döküman analizi |

---

### 🛒 satin-alma.js - Satın Alma
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | `/api/satin-alma/talepler` | Talep listesi |
| POST | `/api/satin-alma/talepler` | Yeni talep |
| PUT | `/api/satin-alma/talepler/:id` | Talep güncelle |
| POST | `/api/satin-alma/talepler/:id/onayla` | Talep onayla |
| POST | `/api/satin-alma/talepler/:id/reddet` | Talep reddet |

---

### 📊 projeler.js - Proje Yönetimi
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | `/api/projeler` | Proje listesi |
| GET | `/api/projeler/:id` | Proje detayı |
| POST | `/api/projeler` | Yeni proje |
| PUT | `/api/projeler/:id` | Proje güncelle |
| GET | `/api/projeler/:id/personeller` | Proje personelleri |
| POST | `/api/projeler/:id/personel-ata` | Personel ata |

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
```

### Error Handling
```javascript
// 400 - Bad Request
{ "success": false, "error": "Zorunlu alan eksik: unvan" }

// 404 - Not Found
{ "success": false, "error": "Kayıt bulunamadı" }

// 500 - Server Error
{ "success": false, "error": "Veritabanı hatası" }
```
