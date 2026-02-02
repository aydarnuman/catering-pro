# Lib Module

Ortak kütüphaneler ve yardımcı fonksiyonlar.

## Dosyalar

| Dosya | İçerik |
|-------|--------|
| `errors.js` | Custom error classes |
| `constants.js` | Sabit değerler, enum'lar |
| `utils.js` | Yardımcı fonksiyonlar |
| `index.js` | Merkezi export |

## Error Classes

```javascript
import { 
  ScraperError,
  SessionExpiredError,
  LoginFailedError,
  DocumentDownloadError,
  StorageUploadError,
  AnalysisError,
  AIApiError,
  ValidationError,
  NotFoundError
} from './lib/errors.js';

// Kullanım
throw new DocumentDownloadError(url, 'HTTP 404', { tenderId });

// Error handling
try {
  // ...
} catch (error) {
  if (error instanceof ScraperError) {
    console.log(error.code);    // 'DOWNLOAD_FAILED'
    console.log(error.context); // { url, tenderId }
  }
}
```

## Constants

```javascript
import { 
  TURKISH_CITIES,
  DOC_TYPES,
  DOC_TYPE_LABELS,
  SOURCE_TYPES,
  PROCESSING_STATUS,
  getDocTypeLabel
} from './lib/constants.js';

console.log(DOC_TYPES.TECH_SPEC);        // 'tech_spec'
console.log(getDocTypeLabel('tech_spec')); // 'Teknik Şartname'
```

## Utils

```javascript
import {
  delay,
  retryWithBackoff,
  normalizeCity,
  sanitizeFileName,
  parseJsonSafe,
  detectFileType,
  createTimer,
  formatDuration
} from './lib/utils.js';

// Delay
await delay(2000);

// Retry
const result = await retryWithBackoff(
  async () => fetchData(),
  { maxAttempts: 3, backoffMs: 1000 }
);

// Timer
const timer = createTimer();
// ... işlem
console.log(`Süre: ${formatDuration(timer.stop())}`);

// File type detection (magic bytes)
const ext = detectFileType(buffer);
// '.pdf', '.zip', '.jpg', etc.
```

## Import

```javascript
// Hepsini al
import * from './lib';

// Spesifik
import { delay, ScraperError, DOC_TYPES } from './lib';
```
