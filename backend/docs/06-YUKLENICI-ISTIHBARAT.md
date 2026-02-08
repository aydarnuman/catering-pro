# Yüklenici İstihbarat Modülü

> **Son Güncelleme:** 2026-02-07
> **Konum:** `backend/src/scraper/yuklenici-istihbarat/`
> **Veri Kaynağı:** ihalebul.com
> **Route:** `routes/contractors.js`

---

## 1. Genel Bakış

Yüklenici istihbarat modülü, catering sektöründeki rakip firmaları ve ihale katılımcılarını ihalebul.com üzerinden takip eder. 4 ayrı worker modülü ile yüklenici listesi, ihale geçmişi, analiz profili ve katılımcı bilgilerini toplar.

```
ihalebul.com
     │
     ├── /tenders/search (sonuçlanmış)  ──→  yuklenici-listesi-cek
     ├── /tenders/search/contracted      ──→  yuklenici-gecmisi-cek
     ├── /analyze                        ──→  yuklenici-profil-cek
     └── /tender/{id}/participants       ──→  ihale-katilimci-cek
                                                     │
                                                     ▼
                                              Supabase (PostgreSQL)
                                              ├── yukleniciler tablosu
                                              └── yuklenici_ihale_gecmisi tablosu
```

---

## 2. Worker Modülleri

### 2A. yuklenici-listesi-cek.js

**Görev:** Sonuçlanmış ihalelerden yüklenici firma listesini çeker.

**Kaynak URL:** `https://www.ihalebul.com/tenders/search?workcategory_in=15&sort=date_desc`

**Export:** `scrapeContractorList(page, options)`

**Parametreler:**
- `page` - Puppeteer sayfası
- `options.maxPages` - Maksimum sayfa sayısı (varsayılan: 20)
- `options.onPageComplete` - Her sayfa callback

**Çıktı:**
```javascript
{
  success: true,
  stats: {
    pages_scraped: 15,
    contractors_found: 120,
    contractors_new: 45,
    contractors_updated: 75,
    errors: 0
  }
}
```

**DB İşlemi:** `yukleniciler` tablosuna UPSERT (unvan bazlı)

**Route:** `POST /api/contractors/scrape`

---

### 2B. yuklenici-gecmisi-cek.js

**Görev:** Belirli bir yüklenicinin tüm ihale geçmişini çeker + KIK kararlarını tarar.

**Kaynak URL'leri** (3 faz halinde taranır):

| Faz | URL Path | Parametre | Açıklama |
|-----|----------|-----------|----------|
| 1 | `/tenders/search/contracted` | `contractortitle_in=X&workend=%3E0` | Devam eden ihaleler |
| 2 | `/tenders/search/contracted` | `contractortitle_in=X&workend=%3C0` | Tamamlanan ihaleler |
| 3 | `/tenders/search/contracted` | `participanttitle_in=X` | Tüm katıldığı ihaleler |

**Export'lar:**
- `scrapeContractorTenders(page, yuklenici, options)` - Tek yüklenici
- `batchScrapeContractorTenders(page, yukleniciler, options)` - Toplu tarama
- `scrapeKikDecisions(page, yuklenici, options)` - KIK karar tarama

**Parametreler:**
- `yuklenici` - `{ id, unvan }`
- `options.maxPages` - Her fazda maks sayfa (varsayılan: 15)
- `options.onPageComplete` - Sayfa callback

**DB İşlemi:** `yuklenici_ihale_gecmisi` tablosuna UPSERT

**Route'lar:**
- `POST /api/contractors/:id/scrape-history` (tek yüklenici)
- `POST /api/contractors/scrape/tender-history` (batch)
- `POST /api/contractors/:id/toggle-istihbarat` (otomatik)

---

### 2C. yuklenici-profil-cek.js

**Görev:** Yüklenicinin ihalebul.com analiz sayfasından detaylı profil verisi çeker.

**Kaynak URL:** `https://www.ihalebul.com/analyze?workcategory_in=15&contractortitle_in={FIRMA_ADI}`

**Export'lar:**
- `scrapeAnalyzePage(page, yuklenici, options)` - Analiz sayfasını tara
- `normalizeAnalyzData(rawData)` - Ham veriyi normalize et

**Çıktı Yapısı:**
```javascript
{
  ozet: { toplam_ihale, kazanilan, kaybedilen, devam_eden, ... },
  yillik_trend: [{ yil, sayi, tutar }],
  sektorler: [{ sektor, sayi, oran }],
  idareler: [{ idare, sayi, tutar }],
  yukleniciler_listesi: [...],
  ortak_girisimler: [...],
  rakipler: [{ firma, sayi, oran }],
  sehirler: [{ sehir, sayi }],
  ihale_turleri: [...],
  ihale_usulleri: [...],
  teklif_turleri: [...]
}
```

**DB İşlemi:** `yukleniciler` tablosunda `analiz_verisi` (JSONB) alanını günceller

**Route:** `POST /api/contractors/:id/scrape-analyze`

---

### 2D. ihale-katilimci-cek.js

**Görev:** İhale katılımcı listelerini çeker ve yüklenici tablosuyla eşleştirir.

**Kaynak URL:** `https://www.ihalebul.com/tender/{externalId}/participants`

**Export:** `batchScrapeParticipants(page, tenders, options)`

**Parametreler:**
- `tenders` - `[{ id, external_id, document_links }]`
- `options.maxTenders` - Maks ihale sayısı (varsayılan: 20)
- `options.onProgress` - İlerleme callback

**Kaynak:** Katılımcı URL'si `tender.document_links.probable_participants.url` içinde saklanır

**DB İşlemi:** `yukleniciler` tablosuna yeni firma ekler (varsa günceller)

**Route:** `POST /api/contractors/scrape/participants`

---

## 3. Ortak Altyapı Bağımlılıkları

Tüm worker modülleri `shared/` altyapısını kullanır:

```
shared/ihalebul-login.js  →  ensureLoggedIn(page) - her işlemden önce
shared/ihalebul-cookie.js →  session.json'dan cookie yönetimi
shared/browser.js         →  createPage() ile Puppeteer sayfası
shared/scraper-logger.js  →  scrape_logs tablosuna loglama
```

Her worker arasında `2-5 sn` rastgele gecikme uygulanır (rate limiting koruması).

---

## 4. Veritabanı Tabloları

### yukleniciler

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| id | UUID | Primary key |
| unvan | TEXT | Firma adı (UNIQUE) |
| vergi_no | TEXT | Vergi numarası |
| ihale_sayisi | INT | Toplam ihale sayısı |
| kazanilan_ihale | INT | Kazanılan ihale sayısı |
| toplam_tutar | NUMERIC | Toplam ihale tutarı |
| analiz_verisi | JSONB | scrapeAnalyzePage() çıktısı |
| istihbarat_aktif | BOOLEAN | Otomatik takip durumu |
| son_tarama | TIMESTAMPTZ | Son scrape zamanı |

### yuklenici_ihale_gecmisi

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| id | UUID | Primary key |
| yuklenici_id | UUID | FK → yukleniciler |
| ihale_id | TEXT | ihalebul.com ihale ID |
| baslik | TEXT | İhale başlığı |
| kurum | TEXT | İhale açan kurum |
| tutar | NUMERIC | İhale tutarı |
| durum | TEXT | devam / tamamlandi / bilinmiyor |
| rol | TEXT | yuklenici / katilimci |
| tarih | DATE | İhale tarihi |

---

## 5. Frontend Entegrasyonu

Yüklenici verileri `frontend/src/app/(dashboard)/yuklenici-kutuphanesi/` sayfasında gösterilir.

Detaylı frontend mimari diagramı: `docs/yuklenici-kutuphanesi-diagram.md`

API çağrıları:
- `GET /api/contractors` - Liste
- `GET /api/contractors/:id` - Detay
- `POST /api/contractors/:id/scrape-history` - Geçmiş tara
- `POST /api/contractors/:id/scrape-analyze` - Analiz tara
- `POST /api/contractors/:id/toggle-istihbarat` - Otomatik takip aç/kapa

---

## 6. Kullanım

### Programatik

```javascript
import {
  scrapeContractorList,
  scrapeContractorTenders,
  scrapeAnalyzePage,
  batchScrapeParticipants,
} from '../scraper/yuklenici-istihbarat/index.js';

import { browserManager } from '../scraper/shared/browser.js';

const page = await browserManager.createPage();
try {
  // Yüklenici listesi çek
  const listResult = await scrapeContractorList(page, { maxPages: 5 });

  // Tek yüklenici geçmişi
  const histResult = await scrapeContractorTenders(page, { id: '...', unvan: 'FIRMA ADI' });

  // Analiz profili
  const analyzeResult = await scrapeAnalyzePage(page, { id: '...', unvan: 'FIRMA ADI' });
} finally {
  await browserManager.closePage(page);
}
```

### API Üzerinden

```bash
# Yüklenici listesi tara
curl -X POST http://localhost:3001/api/contractors/scrape \
  -H "Cookie: access_token=..." \
  -H "Content-Type: application/json" \
  -d '{"maxPages": 5}'

# Tek yüklenici ihale geçmişi
curl -X POST http://localhost:3001/api/contractors/{id}/scrape-history \
  -H "Cookie: access_token=..."

# Analiz profili
curl -X POST http://localhost:3001/api/contractors/{id}/scrape-analyze \
  -H "Cookie: access_token=..."
```

---

*Yüklenici İstihbarat Modülü v4.0 | İhale Motoru alt sistemi*
