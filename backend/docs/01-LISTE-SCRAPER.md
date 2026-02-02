# Liste Scraper Sistemi

> **Versiyon:** 1.0.0
> **Son Güncelleme:** 2026-02-02
> **Durum:** ✅ Çalışıyor

---

## Genel Bakış

Liste Scraper, ihalebul.com'dan **Hazır Yemek - Lokantacılık (Kategori 15)** ihalelerini otomatik olarak çeker ve Supabase veritabanına kaydeder.

```
┌─────────────────┐     ┌──────────────────┐     ┌────────────────┐
│  ihalebul.com   │────→│  Liste Scraper   │────→│   Supabase     │
│  (Kategori 15)  │     │  (Puppeteer)     │     │   (tenders)    │
└─────────────────┘     └──────────────────┘     └────────────────┘
```

---

## Dosya Yapısı

```
src/scraper/
├── runner.js           # CLI - Ana giriş noktası
├── list-scraper.js     # Liste tarama mantığı
├── browser-manager.js  # Puppeteer instance yönetimi
├── login-service.js    # ihalebul.com authentication
├── session-manager.js  # Cookie/session saklama
├── logger.js           # Console + DB loglama
├── document-scraper.js # Döküman içerik çekme (ayrı modül)
└── index.js            # Export'lar
```

---

## Çalıştırma

### CLI Komutları

```bash
# Sadece liste çek (döküman içeriği OLMADAN)
node src/scraper/runner.js --mode=list --pages=5

# Liste + Döküman içerikleri (YAVAŞ)
node src/scraper/runner.js --mode=full --pages=3

# Tek ihale URL ile ekle
node src/scraper/runner.js --mode=single --url="https://ihalebul.com/tender/123456"
```

### Parametreler

| Parametre | Varsayılan | Açıklama |
|-----------|------------|----------|
| `--mode` | `list` | `list`, `full`, `single` |
| `--pages` | `5` | Taranacak sayfa sayısı |
| `--url` | - | Tek ihale için URL (`single` modda zorunlu) |

---

## Bileşen Detayları

### 1. Runner (`runner.js`)

CLI giriş noktası. Argümanları parse eder ve ilgili fonksiyonu çağırır.

```javascript
// Kullanım akışı
main() → parseArgs() → runList() / runFull() / runSingle()
```

### 2. List Scraper (`list-scraper.js`)

Ana tarama mantığı.

**Akış:**
1. Login kontrolü (`loginService.ensureLoggedIn`)
2. Kategori sayfasına git
3. Her sayfa için:
   - Scroll (lazy load)
   - İhaleleri çıkar (`extractTenders`)
   - Maskelenmiş veri kontrolü
   - Veritabanına kaydet (`saveTender`)
4. Sonraki sayfaya geç

**Önemli Fonksiyonlar:**

| Fonksiyon | Açıklama |
|-----------|----------|
| `scrapeList(page, options)` | Ana fonksiyon |
| `extractTenders(page)` | Sayfadan ihale kartlarını parse et |
| `saveTender(tender)` | UPSERT ile veritabanına kaydet |
| `isMasked(tender)` | `***` içeren veri kontrolü |
| `parseDate(str)` | Türkçe tarih parse |
| `parseAmount(str)` | Para tutarı parse |

**Konfigürasyon:**

```javascript
const CATEGORY_URL = 'https://www.ihalebul.com/tenders/search?workcategory_in=15';
const PAGE_DELAY = 2000; // Sayfalar arası bekleme (ms)
```

### 3. Browser Manager (`browser-manager.js`)

Puppeteer instance yönetimi (Singleton pattern).

**Özellikler:**
- Headless Chrome
- User-Agent: Chrome 120 (Mac)
- Viewport: 1280x800
- Timeout: 30 saniye

```javascript
const browser = await browserManager.getBrowser();
const page = await browserManager.createPage();
await browserManager.close();
```

### 4. Login Service (`login-service.js`)

ihalebul.com authentication yönetimi.

**Akış:**
1. Kayıtlı session var mı? → Cookie'leri yükle
2. Test sayfasına git, login kontrolü
3. Login değilse → Fresh login
4. Cookie'leri kaydet

**Ortam Değişkenleri:**
```env
IHALEBUL_USERNAME=kullanici_adi
IHALEBUL_PASSWORD=sifre
```

**Önemli Fonksiyonlar:**

| Fonksiyon | Açıklama |
|-----------|----------|
| `performLogin(page)` | Session restore veya fresh login |
| `freshLogin(page)` | Sıfırdan login (modal form) |
| `isLoggedIn(page)` | Login durumu kontrolü |
| `ensureLoggedIn(page)` | Login garantile |
| `forceRelogin(page)` | Session temizle, yeniden login |

**Login Kontrolü Kriterleri:**
- `***` içeren maskelenmiş veri → Login değil
- "Çıkış" veya "logout" butonu → Login

### 5. Session Manager (`session-manager.js`)

Cookie'leri dosyada saklar.

**Dosya:** `storage/session.json`

**Session Yapısı:**
```json
{
  "id": "sess_1234567890_abc123",
  "cookies": [...],
  "username": "kullanici",
  "createdAt": 1234567890000,
  "expiresAt": 1234567890000,
  "lastUsedAt": 1234567890000
}
```

**Konfigürasyon:**
```env
SESSION_TTL_HOURS=8  # Session geçerlilik süresi
```

### 6. Logger (`logger.js`)

Console ve opsiyonel DB loglama.

**Log Seviyeleri:** `DEBUG`, `INFO`, `WARN`, `ERROR`, `FATAL`

**Örnek Çıktı:**
```
08:45:12 ✅ [Runner:List] Session başladı
08:45:15 ✅ [Login] Giriş başarılı
08:45:18 ✅ [Runner:List] Sayfa 1 tamamlandı
08:45:45 ✅ [Runner:List] Session tamamlandı (33.2s)
```

**Konfigürasyon:**
```env
LOG_LEVEL=info     # debug, info, warn, error
LOG_TO_DB=false    # DB'ye kaydet (scraper_logs tablosu)
```

---

## Veritabanı

### Tablo: `tenders`

Scraper aşağıdaki alanları doldurur:

| Alan | Tip | Açıklama |
|------|-----|----------|
| `external_id` | string | ihalebul.com ihale ID (unique) |
| `ikn` | string | İhale Kayıt Numarası |
| `title` | string | İhale başlığı |
| `city` | string | Şehir |
| `organization_name` | string | Kurum adı |
| `tender_date` | timestamp | Son teklif tarihi |
| `estimated_cost` | numeric | Yaklaşık maliyet |
| `work_duration` | string | İşin süresi |
| `url` | string | ihalebul.com linki |
| `tender_source` | string | `'ihalebul'` |
| `category_id` | int | `15` |
| `category_name` | string | `'Hazır Yemek - Lokantacılık'` |
| `document_links` | jsonb | Döküman URL'leri |

### UPSERT Mantığı

```sql
INSERT INTO tenders (...)
VALUES (...)
ON CONFLICT (external_id) DO UPDATE SET
  title = EXCLUDED.title,
  city = COALESCE(EXCLUDED.city, tenders.city),
  ...
  updated_at = NOW()
```

- **Yeni ihale:** INSERT
- **Mevcut ihale:** Sadece dolu alanları güncelle (COALESCE)

---

## Sayfa Parse Detayları

### Çıkarılan Bilgiler

Liste sayfasındaki her ihale kartından:

```javascript
{
  id: "123456",           // URL'den
  kayitNo: "2024/12345",  // .badge.text-info
  baslik: "İhale başlığı", // a[href*="/tender/"]
  sehir: "İstanbul",      // .text-dark-emphasis
  kurum: "Belediye",      // Metin içinden regex
  teklifTarihi: "15.02.2026 10:00",
  tutar: "500.000 TL",
  sure: "12 ay",
  url: "https://ihalebul.com/tender/123456",
  documentButtons: {      // URL pattern'den
    announcement: { name: "İhale İlanı", url: "..." },
    goods_list: { name: "Malzeme Listesi", url: "..." }
  }
}
```

### Döküman URL Kodları

ihalebul.com URL pattern: `/tender/{id}/{type_code}`

| Kod | Tip | Açıklama |
|-----|-----|----------|
| 2 | `announcement` | İhale İlanı |
| 3 | `correction_notice` | Düzeltme İlanı |
| 6 | `goods_list` | Malzeme Listesi |
| 7 | `admin_spec` | İdari Şartname |
| 8 | `tech_spec` | Teknik Şartname |
| 9 | `zeyilname` | Zeyilname |

---

## Hata Yönetimi

### Maskelenmiş Veri

Login olmadan bazı veriler `***` ile maskelenir:
- Kurum adı
- İhale başlığı
- Kayıt numarası

**Çözüm:** `%30`'dan fazla maskelenmiş veri varsa otomatik re-login.

### Session Timeout

ihalebul.com session ~8 saat geçerli.

**Çözüm:** Her sayfa öncesi `isLoggedIn()` kontrolü.

### Rate Limiting

Sayfalar arası `PAGE_DELAY = 2000ms` bekleme.

---

## Performans

| Metrik | Değer |
|--------|-------|
| 1 sayfa tarama | ~5-8 saniye |
| 1 sayfadaki ihale | ~20 adet |
| 5 sayfa (100 ihale) | ~40-50 saniye |
| Full mode (dökümanlarla) | ~3-5 dakika/sayfa |

---

## Sorun Giderme

### Login Başarısız

```bash
# Session temizle
rm storage/session.json

# Credentials kontrol
echo $IHALEBUL_USERNAME
echo $IHALEBUL_PASSWORD
```

### Puppeteer Hatası

```bash
# Chrome yolunu belirt (opsiyonel)
export PUPPETEER_EXECUTABLE_PATH=/path/to/chrome
```

### Hiç ihale gelmiyor

1. ihalebul.com erişilebilir mi?
2. Kategori 15'te ihale var mı?
3. Login başarılı mı? (Log'lara bak)

---

## Örnek Çıktı

```
$ node src/scraper/runner.js --mode=list --pages=2

08:45:12 ✅ [Runner:List] Session başladı
08:45:15 ✅ [Login] Session yüklendi
08:45:18 ✅ [Login] Login durumu: true
08:45:25 ✅ [Runner:List] Sayfa 1 tamamlandı {"count": 20, "new": 5, "updated": 15}
08:45:35 ✅ [Runner:List] Sayfa 2 tamamlandı {"count": 20, "new": 3, "updated": 17}
08:45:36 ✅ [Runner:List] Session tamamlandı (24.1s) {"pages": 2, "total": 40, "new": 8}
```

---

## İyileştirme Önerileri

1. **Paralel Sayfa Tarama:** Şu an sıralı, paralel yapılabilir
2. **Proxy Desteği:** Rate limit aşımı için
3. **Retry Mekanizması:** Başarısız sayfalar için otomatik tekrar
4. **Incremental Sync:** Sadece yeni/değişen ihaleleri çek
5. **Webhook Bildirimi:** Yeni ihale geldiğinde bildirim
