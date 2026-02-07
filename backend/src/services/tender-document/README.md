# Tender Document Module

İhale döküman yönetimi modülü. Merkez Scraper ile tüm içerikleri tek noktadan işler.

## Yapı

```
tender-document/
└── index.js                # Public API (wrapper)

# Bağlı servisler:
../document-storage.js      # Merkez Scraper + Supabase Storage işlemleri
../document-download.js     # Authenticated döküman indirme
../tender-content-service.js # Site içeriğinden döküman oluşturma
../document-queue-processor.js # Analiz kuyruğu
```

## Merkez Scraper

Tek entry point: `merkezScraper(tenderId)` - İhale kartındaki tüm butonları doğru yöntemle işler.

### Buton Tipleri ve İşleme Yöntemleri

| Buton | Kod | Yöntem | Hedef |
|-------|-----|--------|-------|
| Malzeme Listesi | 6 | content_scrape (json_table) | `goods_services_content` kolonu |
| İhale İlanı | 2 | content_scrape (text) | `announcement_content` kolonu |
| Düzeltme İlanı | 3 | content_scrape (text) | `correction_notice_content` kolonu |
| Zeyilname | 9 | content_scrape (text) | `zeyilname_content` kolonu |
| İdari Şartname | 7 | download (dosya) | `documents` tablosu + Supabase Storage |
| Teknik Şartname | 8 | download (dosya) | `documents` tablosu + Supabase Storage |

### Kullanım

```javascript
import { merkezScraper } from './services/tender-document';

// Bir ihalenin tüm içeriklerini işle (dosya indirme + içerik scrape)
const result = await merkezScraper(tenderId);

console.log(result);
// {
//   tenderId: 123,
//   downloaded: [{ docType: 'tech_spec', filesCount: 1, ... }],
//   contentScraped: [{ docType: 'goods_list', targetColumn: 'goods_services_content', size: 18 }],
//   failed: [],
//   skipped: [{ docType: 'admin_spec', reason: 'already_downloaded' }]
// }
```

### Geriye Uyumluluk

```javascript
// Eski isim hala çalışır (alias)
import { downloadTenderDocuments } from './services/tender-document';
const result = await downloadTenderDocuments(tenderId); // merkezScraper'a yönlendirilir
```

### Content Döküman Oluşturma

```javascript
import { createContentDocuments } from './services/tender-document';

// Site içeriğinden döküman oluştur (announcement, goods_services)
const docs = await createContentDocuments(tenderId);
```

### Döküman Listesi

```javascript
import { 
  getDownloadedDocuments, 
  getContentDocuments, 
  getAllDocuments 
} from './services/tender-document';

// Sadece indirilen dökümanlar
const downloaded = await getDownloadedDocuments(tenderId);

// Sadece content dökümanları
const content = await getContentDocuments(tenderId);

// Tümü
const all = await getAllDocuments(tenderId);
```

### Analiz Kuyruğu

```javascript
import { 
  addToQueue, 
  addMultipleToQueue,
  getQueueStatus 
} from './services/tender-document';

// Tek dökümanı kuyruğa ekle
await addToQueue(documentId);

// Çoklu ekleme
await addMultipleToQueue([doc1Id, doc2Id, doc3Id]);

// Kuyruk durumu
const status = await getQueueStatus();
// { pending: 5, processing: 2, completed: 100, failed: 3 }
```

### Signed URL

```javascript
import { getSignedUrl } from './services/tender-document';

// Private bucket için geçici URL al (1 saat geçerli)
const url = await getSignedUrl(documentId, 3600);
```

## Akış Diyagramı

```
ihalebul.com liste sayfası
     │
     │  Her ihale kartında butonlar:
     │  [Malzeme Listesi] [İhale İlanı] [İdari Şartname] [Teknik Şartname] ...
     │
     ▼
┌──────────────┐
│ merkezScraper │─── Tek entry point
└──────────────┘
     │
     ├── content_scrape tipleri ──▶ tenders tablosu (ilgili kolon)
     │   (announcement, goods_list,    announcement_content,
     │    zeyilname, correction_notice) goods_services_content, ...
     │
     ├── download tipleri ──────▶ Supabase Storage + documents tablosu
     │   (tech_spec, admin_spec)
     │   1. Buton URL'sine git
     │   2. Gerçek download linkini bul
     │   3. Dosyayı indir (HTML guard)
     │   4. ZIP ise aç
     │   5. Storage'a yükle
     │
     ▼
┌─────────────┐
│ Queue Pro-  │
│ cessor      │
└─────────────┘
     │
     ▼
┌─────────────┐
│ AI Analyzer │
└─────────────┘
     │
     ▼
┌─────────────┐
│  analysis_  │
│  result     │
└─────────────┘
```

## Döküman Tipleri (doc_type)

| Tip | Açıklama | İşleme Yöntemi |
|-----|----------|----------------|
| `tech_spec` | Teknik Şartname | download |
| `admin_spec` | İdari Şartname | download |
| `announcement` | İhale İlanı | content_scrape |
| `goods_list` | Malzeme Listesi | content_scrape |
| `zeyilname` | Zeyilname | content_scrape |
| `correction_notice` | Düzeltme İlanı | content_scrape |
| `contract` | Sözleşme Tasarısı | download |
| `unit_price` | Birim Fiyat Cetveli | download |

## Kaynak Tipleri (source_type)

| Tip | Açıklama |
|-----|----------|
| `download` | ihalebul.com'dan indirilen |
| `content` | Site içeriğinden oluşturulan |
| `upload` | Kullanıcının yüklediği |

## İşleme Durumları (processing_status)

```
pending → queued → processing → completed
                             ↘ failed
```

## ZIP İşleme

ZIP dosyaları otomatik olarak açılır:

```javascript
// ZIP içinden çıkan dosyalar için:
// - is_extracted = true
// - parent_doc_id = ZIP'in document ID'si
// - source_url = original_url#file=filename
```

## HTML Guard

Merkez Scraper, indirilen her dosyanın ilk 500 byte'ını kontrol eder.
`<!DOCTYPE` veya `<html` ile başlayan içerikler dosya olarak kaydedilmez.
Bu, içerik sayfası URL'lerinin yanlışlıkla "sahte PDF" olarak kaydedilmesini önler.

## Konfigürasyon

| Env Variable | Default | Açıklama |
|--------------|---------|----------|
| `SUPABASE_SERVICE_KEY` | - | Supabase service key |
| `STORAGE_MAX_FILE_SIZE` | 52428800 | Max dosya boyutu (50MB) |
| `DOWNLOAD_DELAY` | 2000 | İndirmeler arası bekleme |

## Hata Giderme

### "Session bulunamadı"
- Scraper modülünü çalıştırın: `node runner.js --mode=list --pages=1`

### "HTML içerik tespit edildi"
- Buton URL'si bir içerik sayfasına işaret ediyor, gerçek download linki bulunamadı
- Merkez Scraper bu durumu otomatik olarak ele alır

### "Storage yükleme hatası"
- `SUPABASE_SERVICE_KEY` değişkenini kontrol edin
- Bucket'ın oluşturulduğundan emin olun

### "ZIP açılamadı"
- DOCX/XLSX dosyaları ZIP formatındadır, otomatik algılanır
- RAR için `unrar` yüklü olmalı

### "Döküman duplike"
- Aynı `(tender_id, original_filename)` kombinasyonu varsa güncellenir
- `ON CONFLICT DO UPDATE` kullanılır

## API Endpoints

```
POST /api/tender-docs/:tenderId/merkez-scraper     # Ana endpoint
POST /api/tender-docs/:tenderId/download-documents  # Geriye uyumluluk (aynı handler)
GET  /api/tender-docs/:tenderId/downloaded-documents
GET  /api/tender-docs/:tenderId/download-status
POST /api/tender-content/:tenderId/create-documents
GET  /api/tender-content/:tenderId/documents
GET  /api/tender-content/:tenderId/all-documents
POST /api/tender-content/analyze-batch
```
