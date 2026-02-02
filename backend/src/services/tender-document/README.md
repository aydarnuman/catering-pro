# Tender Document Module

İhale döküman yönetimi modülü. İndirme, depolama ve analiz kuyruğu işlemlerini yönetir.

## Yapı

```
tender-document/
└── index.js                # Public API (wrapper)

# Bağlı servisler:
../document-storage.js      # Supabase Storage işlemleri
../document-download.js     # Authenticated döküman indirme
../tender-content-service.js # Site içeriğinden döküman oluşturma
../document-queue-processor.js # Analiz kuyruğu
```

## Kullanım

### Döküman İndirme

```javascript
import { downloadTenderDocuments } from './services/tender-document';

// Bir ihalenin tüm dökümanlarını indir
const result = await downloadTenderDocuments(tenderId);

console.log(result);
// {
//   tenderId: 123,
//   success: [{ docType: 'tech_spec', filesCount: 1, ... }],
//   failed: [],
//   skipped: [{ docType: 'admin_spec', reason: 'already_downloaded' }],
//   totalDownloaded: 5,
//   totalSize: 1234567
// }
```

### Content Döküman Oluşturma

```javascript
import { createContentDocuments } from './services/tender-document';

// Site içeriğinden döküman oluştur (announcement, goods_services)
const docs = await createContentDocuments(tenderId);

console.log(docs);
// {
//   tenderId: 123,
//   created: [
//     { type: 'announcement', documentId: 456 },
//     { type: 'goods_services', documentId: 457 }
//   ]
// }
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
console.log(status);
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
ihalebul.com
     │
     ▼
┌─────────────┐     ┌─────────────┐
│ downloadTen │────▶│  Supabase   │
│ derDocuments│     │  Storage    │
└─────────────┘     └─────────────┘
     │                    │
     ▼                    │
┌─────────────┐           │
│  documents  │◀──────────┘
│  (DB)       │
└─────────────┘
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

| Tip | Açıklama | Kaynak |
|-----|----------|--------|
| `tech_spec` | Teknik Şartname | download |
| `admin_spec` | İdari Şartname | download |
| `announcement` | İhale İlanı | content/download |
| `goods_services` | Mal/Hizmet Listesi | content |
| `zeyilname` | Zeyilname | download |
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

## Konfigürasyon

| Env Variable | Default | Açıklama |
|--------------|---------|----------|
| `SUPABASE_SERVICE_KEY` | - | Supabase service key |
| `STORAGE_MAX_FILE_SIZE` | 52428800 | Max dosya boyutu (50MB) |
| `DOWNLOAD_DELAY` | 2000 | İndirmeler arası bekleme |

## Error Handling

```javascript
import { 
  DocumentDownloadError, 
  StorageUploadError, 
  ExtractionError 
} from '../lib/errors.js';

try {
  await downloadTenderDocuments(tenderId);
} catch (error) {
  if (error instanceof DocumentDownloadError) {
    // İndirme hatası - URL veya session sorunu
  } else if (error instanceof StorageUploadError) {
    // Supabase yükleme hatası
  } else if (error instanceof ExtractionError) {
    // ZIP açma hatası
  }
}
```

## Hata Giderme

### "Session bulunamadı"
- Scraper modülünü çalıştırın: `node runner.js --mode=list --pages=1`

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
POST /api/tender-docs/:tenderId/download-documents
GET  /api/tender-docs/:tenderId/downloaded-documents
GET  /api/tender-docs/:tenderId/download-status
POST /api/tender-content/:tenderId/create-documents
GET  /api/tender-content/:tenderId/documents
GET  /api/tender-content/:tenderId/all-documents
POST /api/tender-content/analyze-batch
```
