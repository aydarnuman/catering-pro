# Services Dokümantasyonu

## 🎯 Genel Bakış

Bu klasör iş mantığı servislerini içerir. Route'lardan bağımsız, yeniden kullanılabilir fonksiyonlar burada tanımlanır.

---

## 📁 Servis Listesi

### 🤖 AI Servisleri

#### `gemini.js` - Google Gemini AI
Döküman analizi ve OCR işlemleri.

```javascript
import { analyzeDocument, extractText } from './gemini.js';

// Döküman analizi
const result = await analyzeDocument(filePath, fileType);
// Returns: { title, organization, city, tender_date, estimated_cost, ... }

// Metin çıkarma
const text = await extractText(filePath);
```

#### `claude.js` - Anthropic Claude AI
Konuşma asistanı ve gelişmiş analiz.

```javascript
import { chat, analyzeWithContext } from './claude.js';

// Sohbet
const response = await chat(message, history);

// Bağlamlı analiz
const analysis = await analyzeWithContext(document, context);
```

#### `ai-agent.js` - AI Agent Orchestration
Çoklu AI çağrıları ve tool kullanımı.

---

### 📄 Döküman Servisleri

#### `document.js` - Döküman İşleme
PDF, Word, Excel dosyalarından veri çıkarma.

```javascript
import { processDocument, extractFromPDF } from './document.js';

const result = await processDocument(filePath);
// Returns: { text, metadata, pages }
```

#### `document-download.js` - Döküman İndirme
Harici kaynaklardan döküman indirme.

---

### 💼 İş Mantığı Servisleri

#### `bordro-import-service.js` - Bordro Import
Excel'den bordro verisi aktarma.

```javascript
import { importBordroFromExcel } from './bordro-import-service.js';

const result = await importBordroFromExcel(filePath, donem);
// Returns: { imported: 50, errors: [] }
```

#### `bordro-template-service.js` - Bordro Şablonları
Bordro hesaplama şablonları ve formüller.

#### `tazminat-service.js` - Tazminat Hesaplama
Kıdem ve ihbar tazminatı hesaplama.

```javascript
import { hesaplaKidem, hesaplaIhbar } from './tazminat-service.js';

const kidem = await hesaplaKidem(personelId, cikisTarihi);
// Returns: { gun, tutar, detay }
```

#### `export-service.js` - Dışa Aktarma
Excel, PDF export işlemleri.

```javascript
import { exportToExcel, exportToPDF } from './export-service.js';

const buffer = await exportToExcel(data, columns);
```

#### `import-service.js` - İçe Aktarma
Harici kaynaklardan veri aktarma.

#### `duplicate-detector.js` - Duplikat Tespit
Mükerrer kayıt kontrolü.

```javascript
import { checkDuplicate } from './duplicate-detector.js';

const isDuplicate = await checkDuplicate('cariler', { vergi_no: '123' });
```

---

### 🔄 Entegrasyon Servisleri

#### `sync-scheduler.js` - Senkronizasyon
Periyodik veri senkronizasyonu.

#### `uyumsoft-sales.js` - Uyumsoft Entegrasyonu
Muhasebe yazılımı bağlantısı.

#### `tender-scheduler.js` - İhale Scheduler
Otomatik ihale scraping zamanlaması.

#### `market-scraper.js` - Market Scraper
Piyasa fiyat takibi.

---

### 🍽️ Planlama Servisleri

#### `menu-import.js` - Menü Import
Excel'den menü verisi aktarma.

```javascript
import { importMenuFromExcel } from './menu-import.js';

const result = await importMenuFromExcel(filePath, projeId);
```

#### `invoice-ai.js` - Fatura AI Analizi
Fatura dökümanlarından otomatik veri çıkarma.

---

## 🔧 Servis Geliştirme Kuralları

### 1. Standart Yapı
```javascript
/**
 * Servis açıklaması
 */

import { query } from '../database.js';

/**
 * Fonksiyon açıklaması
 * @param {Type} param - Parametre açıklaması
 * @returns {Promise<Type>} Dönüş açıklaması
 */
export async function fonksiyonAdi(param) {
  try {
    // İş mantığı
    return result;
  } catch (error) {
    console.error('Fonksiyon hatası:', error);
    throw error;
  }
}
```

### 2. Error Handling
```javascript
// Özel hata sınıfı kullan
class ServiceError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

// Throw meaningful errors
throw new ServiceError('Cari bulunamadı', 'CARI_NOT_FOUND');
```

### 3. Logging
```javascript
// Önemli işlemleri logla
console.log(`[${new Date().toISOString()}] İşlem başladı: ${islemId}`);
```

### 4. Configuration
```javascript
// Konfigürasyonları .env'den al
const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) throw new Error('GEMINI_API_KEY tanımlı değil');
```

---

## 📊 Servis Bağımlılıkları

```
gemini.js
└── @google/generative-ai

claude.js
└── @anthropic-ai/sdk

document.js
├── pdf-parse
├── mammoth (docx)
└── xlsx

export-service.js
├── exceljs
└── pdfkit

bordro-*.js
└── database.js
```

---

## ⚠️ Önemli Notlar

1. **API Keys:** `.env` dosyasında sakla
2. **Rate Limiting:** AI servislerinde dikkat et
3. **Timeout:** Uzun işlemlerde timeout ayarla
4. **Memory:** Büyük dosyalarda stream kullan
5. **Transaction:** İlişkili DB işlemlerinde transaction kullan
