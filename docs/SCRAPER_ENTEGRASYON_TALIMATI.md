# 🕷️ SCRAPER SİSTEMİ - ENTEGRASYON VE KULLANIM TALIMATI

**Son Güncelleme:** 17 Ocak 2026

---

## 📋 ÖZET

Scraper sistemi ihalebul.com'dan ihale verilerini çeker:
- **Liste scraping:** İhale listesini tarar, temel bilgileri çeker
- **Döküman scraping:** İhale detay sayfasından döküman linkleri, ihale ilanı ve mal/hizmet listesi çeker
- **URL ile ekleme:** Tek bir ihaleyi URL ile manuel ekler

---

## 🏗️ MİMARİ

```
┌─────────────────────────────────────────────────────────────┐
│                      API KATMANI                             │
│  /api/scraper/*  (routes/scraper.js)                        │
│    ├─ GET /health        → Sistem durumu                    │
│    ├─ GET /stats         → İstatistikler                    │
│    ├─ POST /trigger      → Manuel scraping başlat           │
│    ├─ POST /add-tender   → URL ile ihale ekle               │
│    └─ POST /fetch-documents/:id → Tek ihale döküman çek     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    SCRAPER MODÜLLERI                        │
│  (backend/src/scraper/)                                     │
│                                                             │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ browser-manager │  │ session-manager │                  │
│  │   (singleton)   │  │   (cookies)     │                  │
│  └────────┬────────┘  └────────┬────────┘                  │
│           │                    │                            │
│           ▼                    ▼                            │
│  ┌─────────────────────────────────────────┐               │
│  │           login-service                  │               │
│  │   (ihalebul.com login + session)         │               │
│  └────────────────────┬────────────────────┘               │
│                       │                                     │
│           ┌───────────┴───────────┐                        │
│           ▼                       ▼                        │
│  ┌─────────────────┐     ┌─────────────────┐              │
│  │  list-scraper   │     │ document-scraper│              │
│  │  (liste çekme)  │     │ (döküman çekme) │              │
│  └─────────────────┘     └─────────────────┘              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      VERİTABANI                             │
│  PostgreSQL (Supabase)                                      │
│    ├─ tenders            → İhale kayıtları                 │
│    ├─ documents          → İndirilen dökümanlar            │
│    ├─ scraper_jobs       → Job kuyruğu                     │
│    ├─ scraper_logs       → Loglar                          │
│    └─ scraper_health     → Circuit breaker durumu          │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 DOSYA YAPISI

```
backend/src/scraper/
├── browser-manager.js    # Puppeteer tarayıcı (singleton)
├── session-manager.js    # Cookie kaydet/yükle
├── login-service.js      # ihalebul.com login
├── list-scraper.js       # Liste çekme + DB upsert
├── document-scraper.js   # Döküman/içerik çekme
├── index.js              # Export hub
├── logger.js             # Merkezi loglama
├── health.js             # Circuit breaker
├── queue.js              # Job kuyruğu
├── runner.js             # CLI çalıştırıcı
└── README.md             # Detaylı kılavuz
```

---

## 🔧 KULLANIM

### 1. API ile (Önerilen)

```bash
# Sistem durumu
curl http://localhost:3001/api/scraper/health

# Liste scraping (10 sayfa)
curl -X POST http://localhost:3001/api/scraper/trigger \
  -H "Content-Type: application/json" \
  -d '{"mode":"list","pages":10}'

# URL ile ihale ekle
curl -X POST http://localhost:3001/api/scraper/add-tender \
  -H "Content-Type: application/json" \
  -d '{"url":"https://ihalebul.com/tender/123456"}'

# Tek ihale için döküman çek
curl -X POST http://localhost:3001/api/scraper/fetch-documents/1239
```

### 2. CLI ile

```bash
cd backend

# Liste scraping
node src/scraper/runner.js --mode=list --pages=10

# Tam scraping (liste + döküman)
node src/scraper/runner.js --mode=full --pages=50
```

### 3. Frontend'den

- **İhale Listesi Sayfası:** "URL ile Ekle" butonu
- **İhale Detay Sayfası:** "Döküman Linklerini Getir" butonu
- **Admin Panel:** Scraper Dashboard (/admin/scraper)

---

## ⏰ CRON ZAMANLAMA

`tender-scheduler.js` dosyasında otomatik görevler:

| Saat | Görev | Açıklama |
|------|-------|----------|
| 08:00 | Liste (5 sayfa) | Sabah yeni ihaleler |
| 09:00 | Döküman (100 job) | Eksik dökümanlar |
| 14:00 | Liste (3 sayfa) | Öğleden sonra güncelleme |
| 15:00 | Döküman (50 job) | Döküman tamamlama |
| 19:00 | Liste (2 sayfa) | Akşam kontrolü |
| 03:00 | Temizlik | 7 günden eski logları sil |

---

## 🔐 LOGIN SİSTEMİ

### Akış

1. `session-manager` → `storage/session.json` dosyasını kontrol et
2. Session varsa → cookie'leri yükle ve test et
3. Masked data ("*****") varsa → session expired, yeni login yap
4. Login başarılı → cookie'leri kaydet

### Önemli Notlar

- Session dosyası `.gitignore`'da olmalı
- Session ~8 saat geçerli
- Login bilgileri `.env`'de: `IHALEBUL_USERNAME`, `IHALEBUL_PASSWORD`

---

## 🖥️ PRODUCTION KURULUMU

### 1. Chromium Kurulumu

```bash
# Ubuntu/Debian
apt install snapd -y
snap install chromium
```

### 2. Environment Variables

```env
# .env dosyasına ekle
PUPPETEER_EXECUTABLE_PATH=/snap/bin/chromium
IHALEBUL_USERNAME=email@example.com
IHALEBUL_PASSWORD=sifre123
```

### 3. PM2 ile Çalıştırma

```bash
pm2 start src/server.js --name catering-backend
pm2 save
```

---

## 🐛 SORUN GİDERME

### Login Başarısız

```bash
# Session dosyasını sil
rm backend/storage/session.json

# Backend'i yeniden başlat
pm2 restart catering-backend
```

### Döküman Gelmiyor

1. Login aktif mi kontrol et: `/api/scraper/health`
2. İhale URL'si geçerli mi?
3. `fetch-documents` endpoint'ini çağır

### Browser Başlatılamıyor

```bash
# Chromium yolunu kontrol et
which chromium || which chromium-browser

# .env'de doğru path var mı?
grep PUPPETEER .env
```

---

## 📊 VERİTABANI ŞEMASI

### tenders tablosu (scraper ile ilgili)

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| external_id | VARCHAR(50) | ihalebul.com kayıt no |
| document_links | JSONB | Döküman URL'leri |
| announcement_content | TEXT | İhale ilanı metni |
| goods_services_content | JSONB | Mal/Hizmet listesi |
| zeyilname_content | JSONB | Zeyilname içeriği |

### scraper_jobs tablosu

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| tender_id | INTEGER | İhale ID |
| status | VARCHAR(20) | pending/processing/completed/failed |
| attempts | INTEGER | Deneme sayısı |
| error_message | TEXT | Hata mesajı |

---

## ✅ CHECKLIST

Yeni kurulumda kontrol et:

- [ ] `.env` dosyasında `IHALEBUL_USERNAME` ve `IHALEBUL_PASSWORD` var
- [ ] Production'da `PUPPETEER_EXECUTABLE_PATH` ayarlı
- [ ] `storage/session.json` .gitignore'da
- [ ] Chromium kurulu ve çalışıyor
- [ ] `/api/scraper/health` → `status: healthy`
- [ ] Test: URL ile ihale ekle çalışıyor

---

## 📝 DEĞİŞİKLİK GEÇMİŞİ

| Tarih | Değişiklik |
|-------|------------|
| 2026-01-17 | Tab tarama, içerik çekme düzeltildi |
| 2026-01-17 | URL ile ihale ekleme (frontend+backend) |
| 2026-01-16 | fetch-documents endpoint düzeltildi |
| 2026-01-15 | Logger, health, queue modülleri eklendi |
