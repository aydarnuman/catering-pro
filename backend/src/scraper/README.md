# Scraper Modülü v4.0

ihalebul.com'dan ihale ve yüklenici verilerini çeken modüler scraping sistemi.

**Son Güncelleme:** 2026-02-07

---

## Modül Yapısı

```
scraper/
├── index.js                          # Ana barrel export (tüm modüller)
│
├── shared/                           # Ortak Altyapı
│   ├── index.js                      # shared barrel export
│   ├── browser.js                    # Puppeteer singleton (Headless Chrome)
│   ├── ihalebul-login.js             # ihalebul.com login yönetimi
│   ├── ihalebul-cookie.js            # Cookie saklama/yükleme (session.json)
│   └── scraper-logger.js             # Console + DB loglama
│
├── ihale-tarama/                     # İhale Tarama İşçileri
│   ├── index.js                      # ihale-tarama barrel export
│   ├── ihale-listesi-cek.js          # Liste sayfası tarama + DB kayıt
│   ├── ihale-icerik-cek.js           # Detay sayfası döküman çekme
│   └── ihale-tarama-cli.js           # CLI runner (cron ile çağrılır)
│
├── yuklenici-istihbarat/             # Yüklenici İstihbarat İşçileri
│   ├── index.js                      # yuklenici-istihbarat barrel export
│   ├── yuklenici-listesi-cek.js      # Firma listesi (kategori tarama)
│   ├── yuklenici-gecmisi-cek.js      # İhale geçmişi + KIK kararları
│   ├── yuklenici-profil-cek.js       # Analiz sayfası profil verisi
│   └── ihale-katilimci-cek.js        # Katılımcı bilgisi çekme
│
└── uyumsoft/                         # e-Fatura (Uyumsoft) Entegrasyonu
    ├── uyumsoft-fatura-service.js
    ├── uyumsoft-api-client.js
    └── uyumsoft-scheduler.js
```

---

## Modül Sorumlulukları

### shared/ — Ortak Altyapı
Tüm scraper işçilerinin bağımlı olduğu temel bileşenler.

| Dosya | Sorumluluk |
|-------|-----------|
| `browser.js` | Puppeteer instance yönetimi (Singleton). Chrome başlatma, sayfa oluşturma. |
| `ihalebul-login.js` | ihalebul.com'a login. Session restore veya fresh login. |
| `ihalebul-cookie.js` | Cookie'leri `storage/session.json` dosyasında sakla/yükle. 8 saat TTL. |
| `scraper-logger.js` | Console + opsiyonel DB loglama (`scraper_logs` tablosu). |

### ihale-tarama/ — İhale Tarama
"Hazır Yemek" kategorisindeki ihaleleri tarayan işçiler.

| Dosya | Sorumluluk |
|-------|-----------|
| `ihale-listesi-cek.js` | Liste sayfası tarama, ihale kartlarını parse, UPSERT ile DB'ye kaydet. |
| `ihale-icerik-cek.js` | Detay sayfasından döküman linkleri, ilan, mal/hizmet listesi, zeyilname çekme. |
| `ihale-tarama-cli.js` | CLI arayüzü. `--mode=list\|full\|single\|docs` modlarıyla çalıştırma. Cron tarafından çağrılır. |

### yuklenici-istihbarat/ — Yüklenici İstihbarat
Yüklenici firma verilerini toplayan işçiler.

| Dosya | Sorumluluk |
|-------|-----------|
| `yuklenici-listesi-cek.js` | Kategorideki firma listesini tarar, DB'ye kaydeder. |
| `yuklenici-gecmisi-cek.js` | Bir firmanın ihale geçmişini çeker. KIK kararları dahil. |
| `yuklenici-profil-cek.js` | ihalebul.com/analyze sayfasından firma profil verisini çeker. |
| `ihale-katilimci-cek.js` | Bir ihalenin katılımcılarını (teklif veren firmalar) çeker. |

---

## Kullanım

### Import

```javascript
// Barrel export ile
import scraper from './scraper/index.js';
scraper.browserManager.createPage();

// Named export ile
import { browserManager, scrapeList, documentScraper } from './scraper/index.js';

// Direkt dosya import
import browserManager from './scraper/shared/browser.js';
import { scrapeList } from './scraper/ihale-tarama/ihale-listesi-cek.js';
```

### CLI

```bash
# İhale listesi tara (5 sayfa)
node src/scraper/ihale-tarama/ihale-tarama-cli.js --mode=list --pages=5

# Liste + Döküman içerikleri
node src/scraper/ihale-tarama/ihale-tarama-cli.js --mode=full --pages=3

# Tek ihale URL ile ekle
node src/scraper/ihale-tarama/ihale-tarama-cli.js --mode=single --url=https://ihalebul.com/tender/123456
```

---

## Bağımlılık Grafiği

```
shared/browser.js ◄─── Tüm işçiler Puppeteer page alır
       │
shared/ihalebul-cookie.js ◄── ihalebul-login.js (cookie okur/yazar)
       │
shared/ihalebul-login.js ◄── Tüm işçiler login garantisi alır
       │
shared/scraper-logger.js ◄── Tüm işçiler log yazar
```

---

## Tüketici Haritası

| Tüketici | Kullandığı Modüller |
|----------|-------------------|
| `routes/scraper.js` | browser, login, ihale-icerik-cek, ihale-tarama-cli |
| `routes/contractors.js` | browser, yuklenici-listesi-cek, yuklenici-gecmisi-cek, yuklenici-profil-cek, ihale-katilimci-cek |
| `routes/document-proxy.js` | ihale-icerik-cek |
| `services/document-download.js` | browser, login, ihalebul-cookie |
| `services/document-storage.js` | browser, ihale-icerik-cek, ihalebul-cookie |
| `services/tender-scheduler.js` | ihale-tarama-cli (child_process spawn) |

---

## Environment Variables

```env
IHALEBUL_USERNAME=xxx           # ihalebul.com kullanıcı adı
IHALEBUL_PASSWORD=xxx           # ihalebul.com şifre
PUPPETEER_EXECUTABLE_PATH=xxx   # Production Chromium path (opsiyonel)
SESSION_TTL_HOURS=8             # Session geçerlilik süresi
LOG_LEVEL=INFO                  # DEBUG, INFO, WARN, ERROR
LOG_TO_DB=false                 # scraper_logs tablosuna yaz
```
