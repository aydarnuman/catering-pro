# API Routes

Tüm API endpoint'lerinin özeti.

**Base URL:** `http://localhost:3001`

---

## Hızlı Referans

| Route | Dosya | Açıklama |
|-------|-------|----------|
| `/health` | server.js | Sağlık kontrolü |
| `/api/scraper` | scraper.js | Scraper yönetimi |
| `/api/tenders` | tenders.js | İhale CRUD |
| `/api/tender-documents` | tender-documents.js | Döküman indirme |
| `/api/tender-content` | tender-content-documents.js | İçerik analizi |
| `/api/documents` | documents.js | Döküman yükleme/analiz |
| `/api/content-extractor` | content-extractor.js | PDF/CSV export |
| `/api/tender-notes` | tender-notes.js | Not yönetimi |
| `/api/tender-tracking` | tender-tracking.js | Takip listesi |

---

## /health

```
GET /health
```
Sunucu durumu kontrolü.

**Response:**
```json
{
  "status": "ok",
  "service": "ihale-motoru",
  "timestamp": "2026-02-02T12:00:00.000Z"
}
```

---

## /api/scraper

Scraper işlemlerini yönetir.

| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | `/health` | Sistem durumu |
| GET | `/stats` | Queue istatistikleri |
| GET | `/jobs` | Job listesi |
| GET | `/logs` | Son loglar |
| POST | `/trigger` | Manuel scraping başlat |
| POST | `/reset` | Circuit breaker sıfırla |
| POST | `/add-tender` | URL ile ihale ekle |
| GET | `/check-documents/:tenderId` | Döküman durumu |
| POST | `/fetch-documents/:tenderId` | Döküman çek |

### Örnek: Manuel Scraping

```bash
curl -X POST http://localhost:3001/api/scraper/trigger \
  -H "Content-Type: application/json" \
  -d '{"pages": 1}'
```

### Örnek: URL ile İhale Ekle

```bash
curl -X POST http://localhost:3001/api/scraper/add-tender \
  -H "Content-Type: application/json" \
  -d '{"url": "https://ihalebul.com/tender/123456"}'
```

---

## /api/tenders

İhale CRUD işlemleri.

| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | `/` | İhale listesi (pagination) |
| GET | `/:id` | Tekil ihale detayı |
| PATCH | `/:id` | İhale güncelle |
| DELETE | `/:id` | İhale sil |
| GET | `/stats` | İstatistikler |
| GET | `/cities` | Şehir listesi |
| POST | `/scrape` | Manuel scrape |

### Örnek: İhale Listesi

```bash
curl "http://localhost:3001/api/tenders?page=1&limit=20"
```

**Response:**
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150
  }
}
```

### Örnek: Tekil İhale

```bash
curl "http://localhost:3001/api/tenders/11231"
```

---

## /api/tender-documents

Döküman indirme ve yönetimi.

| Method | Endpoint | Açıklama |
|--------|----------|----------|
| POST | `/:tenderId/download-documents` | Dökümanları Storage'a indir |
| GET | `/:tenderId/downloaded-documents` | İndirilen dökümanlar |
| GET | `/:tenderId/download-status` | İndirme durumu |
| GET | `/documents/:documentId` | Döküman detayı |
| GET | `/documents/:documentId/url` | İmzalı URL al |
| POST | `/documents/:documentId/queue` | Analiz kuyruğuna ekle |

---

## /api/tender-content

İçerik dökümanları ve analiz.

| Method | Endpoint | Açıklama |
|--------|----------|----------|
| POST | `/:tenderId/create-documents` | İçerikleri kaydet |
| GET | `/:tenderId/documents` | Content dökümanları |
| GET | `/:tenderId/all-documents` | Tüm dökümanlar |
| POST | `/documents/:documentId/analyze` | Analiz et (SSE) |
| POST | `/analyze-batch` | Toplu analiz |
| GET | `/queue/status` | Queue durumu |

---

## /api/documents

Genel döküman işlemleri.

| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | `/` | Döküman listesi |
| GET | `/:id` | Döküman detayı |
| POST | `/upload` | Döküman yükle |
| POST | `/analyze` | Claude AI analiz (SSE) |
| DELETE | `/:id` | Döküman sil |
| GET | `/supported-formats` | Desteklenen formatlar |

---

## /api/content-extractor

PDF/CSV export.

| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | `/announcement/:tenderId` | İlan PDF'i |
| GET | `/goods-services/:tenderId` | Mal/Hizmet CSV |
| GET | `/status/:tenderId` | İçerik durumu |

---

## /api/tender-notes

Not yönetimi.

| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | `/:trackingId` | Notları getir |
| POST | `/:trackingId` | Not ekle |
| PUT | `/:trackingId/:noteId` | Not güncelle |
| DELETE | `/:trackingId/:noteId` | Not sil |
| PUT | `/:trackingId/reorder` | Sırala |
| POST | `/:trackingId/:noteId/pin` | Pin toggle |

---

## /api/tender-tracking

Takip listesi.

| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | `/` | Takip listesi |
| POST | `/` | Takibe ekle |
| PUT | `/:id` | Takip güncelle |
| DELETE | `/:id` | Takipten çıkar |
| GET | `/check/:tenderId` | Takip durumu |
| GET | `/stats` | İstatistikler |
| GET | `/:tenderId/analysis` | Analiz sonuçları |

---

## Test Komutları

```bash
# Health check
curl http://localhost:3001/health

# İhale listesi
curl http://localhost:3001/api/tenders

# Tek ihale
curl http://localhost:3001/api/tenders/11231

# Scraper durumu
curl http://localhost:3001/api/scraper/stats
```

---

## Notlar

- Tüm `/api/*` endpoint'leri rate limit altında (1000 req/15dk)
- SSE endpoint'leri streaming response döner
- Auth middleware henüz aktif değil (development)
