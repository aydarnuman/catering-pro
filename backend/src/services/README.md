# Services Dokümantasyonu

Bu klasör tüm iş mantığı servislerini içerir. Servisler, route'lardan çağrılır ve veritabanı işlemlerini yönetir.

**Toplam Servis Dosyası:** 33 (ai-tools dahil 43)
**Son Güncelleme:** Ocak 2026

---

## 📁 Klasör Yapısı

```
services/
├── ai-tools/              # AI araç modülleri (10 dosya)
│   ├── index.js           # Merkezi registry
│   ├── cari-tools.js      # Cari hesap araçları
│   ├── satin-alma-tools.js # Satın alma araçları
│   ├── personel-tools.js  # Personel araçları
│   ├── web-tools.js       # Web arama araçları
│   ├── piyasa-tools.js    # Piyasa araçları
│   └── menu-tools.js      # Menü planlama araçları
├── claude-ai-service.js   # Claude AI entegrasyonu
├── gemini.js              # Gemini AI analizi
├── document-analysis.js   # Döküman işleme
└── [diğer servisler]
```

---

## 🤖 AI Servisleri

### claude-ai-service.js - Claude AI Entegrasyonu
Ana AI asistan servisi. Streaming chat, tool calling ve context management sağlar.

```javascript
// Özellikler
- Streaming chat responses (SSE)
- Tool-based agent system
- Context-aware responses
- Conversation memory
- System prompt management

// Kullanım (ES Modules)
import { chat, agentChat } from './services/claude-ai.js';

// Streaming chat
await chat(messages, onChunk, { stream: true });

// Agent mode (tool calling)
await agentChat(messages, tools, onChunk);
```

**AI Tools Registry:** `ai-tools/index.js`
- Tüm modüllerin AI araçlarını merkezi yönetir
- Tool definitions (Claude formatında)
- Tool execution dispatcher
- System context generator

### claude.js - Claude AI Döküman Analiz Servisi
Döküman analizi ve OCR işlemleri için Claude Vision API kullanır.

```javascript
// Özellikler
- PDF/Döküman analizi (Claude Vision)
- OCR (görüntüden metin)
- Yapılandırılmış veri çıkarma
- Multimodal analysis

// Kullanım (ES Modules)
import { analyzeDocument } from './services/claude.js';
const result = await analyzeDocument(filePath);
```

### ai-analyzer/ - Unified Pipeline (v8.0)
İhale dökümanlarından yapılandırılmış veri çıkarır. **Tek merkezi sistem** mimarisi kullanır.

```javascript
// Çıkarılan veriler
- Kurum bilgileri
- İhale tarihi/saati
- Tahmini bedel
- Teminat bilgileri
- Şartname maddeleri
- Gramaj tabloları (ısı değerleri filtreleniyor)

// Kullanım (ES Modules) - UNIFIED PIPELINE v8.0
import { analyzeDocument } from './services/ai-analyzer/unified-pipeline.js';
const result = await analyzeDocument(filePath, {
  onProgress,
  enableP0Checks: true,
  enableConflictDetection: true,
});

// Unified Pipeline akışı:
// 1. Azure Custom Model (ihale-catering-v1) → Eğitilmiş model
// 2. Azure Layout + Claude Semantic → Hibrit analiz
// 3. Zero-Loss Pipeline → Son fallback (pure Claude)
```

---

## 📄 AI Araç Modülleri (ai-tools/)

### index.js - Merkezi Registry
Tüm modül araçlarını tek noktadan yönetir.

```javascript
class AIToolsRegistry {
  constructor() {
    this.registerModule('satin_alma', satinAlmaTools);
    this.registerModule('cari', cariTools);
    this.registerModule('personel', personelTools);
    this.registerModule('web', webTools);
    this.registerModule('piyasa', piyasaTools);
    this.registerModule('menu', menuTools);
  }
  
  getToolDefinitions() { /* Claude formatında tool tanımları */ }
  executeTool(toolName, args) { /* Tool çalıştırma */ }
  getSystemContext() { /* Sistem bağlamı özeti */ }
}
```

### cari-tools.js - Cari Hesap Araçları
```javascript
// Araçlar
- cari_listele: Cari hesap listesi
- cari_detay: Cari detay bilgileri
- cari_bakiye: Güncel bakiye sorgu
- cari_hareketler: Cari hareketleri
- bakiye_ozet: Toplam alacak/borç
```

### satin-alma-tools.js - Satın Alma Araçları
```javascript
// Araçlar
- talep_olustur: Satın alma talebi
- talep_listele: Talep listesi
- siparis_olustur: Sipariş oluştur
- tedarikci_bul: Tedarikçi arama
```

### personel-tools.js - Personel Araçları
```javascript
// Araçlar
- personel_listele: Personel listesi
- personel_detay: Personel bilgileri
- izin_bakiye: İzin bakiye sorgu
- bordro_hesapla: Bordro hesaplama
- sgk_parametreler: SGK oranları
```

### web-tools.js - Web Araçları
```javascript
// Araçlar
- web_search: Web'de arama
- web_fetch: URL içeriği çek
- web_scrape: Sayfa scraping
```

### piyasa-tools.js - Piyasa Araçları
```javascript
// Araçlar
- fiyat_sorgula: Güncel piyasa fiyatı
- doviz_kuru: Döviz kurları
- enflasyon_verisi: Enflasyon verileri
```

### menu-tools.js - Menü Planlama Araçları
```javascript
// Araçlar
- recete_listele: Reçete listesi
- maliyet_hesapla: Reçete maliyeti
- gramaj_kontrol: Şartname kontrolü
- menu_olustur: Menü önerisi
```

---

## 📋 İhale Servisleri

### tender-service.js - İhale Servisi
İhale CRUD işlemleri ve istatistikler.

```javascript
// Metodlar
getTenders(filters, pagination)
getTenderById(id)
createTender(data)
updateTender(id, data)
deleteTender(id)
getTenderStats()
searchTenders(query)
```

### tender-tracking-service.js - Takip Servisi
İhale takip listesi yönetimi.

```javascript
// Metodlar
getTrackedTenders(userId)
addToTracking(tenderId, data)
updateTracking(id, data)
removeFromTracking(id)
addNote(trackingId, note)
getTrackingStats()
```

### scraper-service.js - Scraper Servisi
ihalebul.com veri çekme servisi.

```javascript
// Metodlar
runScraper(options)
getScraperLogs()
parseDocument(url)
downloadDocument(url, path)
```

---

## 💰 Muhasebe Servisleri

### cari-service.js - Cari Hesap Servisi
Müşteri ve tedarikçi yönetimi.

```javascript
// Metodlar
getCariler(filters)
getCariById(id)
createCari(data)
updateCari(id, data)
deleteCari(id)
getCariHareketler(id)
getCariBalance(id)
recalculateBalance(id)
```

### invoice-service.js - Fatura Servisi
Fatura işlemleri ve ödeme takibi.

```javascript
// Metodlar
getInvoices(filters)
createInvoice(data)
updateInvoice(id, data)
deleteInvoice(id)
addPayment(invoiceId, payment)
getOverdueInvoices()
getInvoiceSummary()
```

### kasa-banka-service.js - Nakit Servisi
Kasa ve banka hesap yönetimi.

```javascript
// Metodlar
getAccounts()
createAccount(data)
updateAccount(id, data)
addTransaction(data)
transfer(fromId, toId, amount)
getDailySummary()
```

---

## 👨‍💼 İK Servisleri

### personel-service.js - Personel Servisi
Çalışan yönetimi ve istatistikler.

```javascript
// Metodlar
getPersoneller(filters)
getPersonelById(id)
createPersonel(data)
updatePersonel(id, data)
deletePersonel(id)
getPersonelStats()
getPersonelByProject(projeId)
```

### bordro-service.js - Bordro Servisi
Maaş hesaplama ve tahakkuk işlemleri.

```javascript
// Metodlar
calculateBordro(personelId, month)
getBordroList(filters)
createBordro(data)
getBordroParameters()
generateTahakkuk(month)
exportBordro(format)

// Hesaplama detayları
- Brüt → Net dönüşüm
- SGK işçi/işveren payı
- Gelir vergisi (kümülatif)
- Damga vergisi
- AGİ hesaplama
```

### izin-service.js - İzin Servisi
İzin talep ve onay süreçleri.

```javascript
// Metodlar
getIzinler(filters)
createIzinTalebi(data)
approveIzin(id)
rejectIzin(id, reason)
getIzinBalance(personelId)
```

---

## 📦 Stok Servisleri

### stok-service.js - Stok Servisi
Depo ve stok kartı yönetimi.

```javascript
// Metodlar
getDepolar()
createDepo(data)
getStokKartlar(filters)
createStokKart(data)
addStokHareket(data)
getKritikStoklar()
getStokDurum(kartId)
```

---

## 🍽️ Planlama Servisleri

### menu-service.js - Menü Servisi
Yemek reçetesi ve menü planlama.

```javascript
// Metodlar
getReceteler()
createRecete(data)
updateRecete(id, data)
getMenuler()
createMenu(data)
calculateMaliyetByRecete(receteId)
getSartnameler()
```

### malzeme-service.js - Malzeme Servisi
Malzeme ihtiyaç planlaması.

```javascript
// Metodlar
calculateMalzemeIhtiyaci(menuId, porsiyon)
getStokKarsilastirma(malzemeler)
generateSiparisListesi(eksikler)
```

---

## 🔄 Entegrasyon Servisleri

### sync-scheduler.js - Senkronizasyon Zamanlayıcı
Otomatik senkronizasyon görevleri.

```javascript
// Özellikler
- Cron-based scheduling
- Uyumsoft sync
- Email bildirimleri
- Error handling & retry

// Metodlar
start()
stop()
runSync()
getStatus()
getLogs()
```

### tender-scheduler.js - İhale Zamanlayıcı
İhale scraper otomatik çalıştırma.

```javascript
// Özellikler
- Günlük scraping
- Yeni ihale bildirimi
- Duplicate kontrolü

// Metodlar
start()
stop()
runNow()
```

### document-queue-processor.js - Döküman Kuyruk
Arka planda döküman işleme.

```javascript
// Özellikler
- Queue-based processing
- Batch analysis
- Progress tracking
- Error recovery

// Metodlar
start()
addToQueue(documentId)
processQueue()
getQueueStatus()
```

### uyumsoft-service.js - Uyumsoft Servisi
Uyumsoft ERP entegrasyonu.

```javascript
// Metodlar
login(credentials)
getFaturalar(dateRange)
syncFaturalar()
getSessionStatus()
```

---

## 🔧 Yardımcı Servisler

### notification-service.js - Bildirim Servisi
Push notification yönetimi.

```javascript
// Metodlar
sendNotification(userId, data)
getNotifications(userId)
markAsRead(id)
markAllAsRead(userId)
createSystemNotification(data)
```

### export-service.js - Export Servisi
Veri dışa aktarma.

```javascript
// Metodlar
exportToExcel(data, template)
exportToPDF(data, template)
getTemplates()
```

### email-service.js - Email Servisi
Email gönderimi.

```javascript
// Metodlar
sendEmail(to, subject, body)
sendBulkEmail(recipients, data)
sendNotificationEmail(userId, notification)
```

### logger.js - Loglama Servisi
Winston tabanlı loglama.

```javascript
// Özellikler
- Daily rotating files
- Console + file output
- Error tracking
- Request logging

// Log dosyaları
logs/app-YYYY-MM-DD.log
logs/error-YYYY-MM-DD.log
logs/exceptions-YYYY-MM-DD.log
```

---

## 📚 Kullanım Örneği

```javascript
// Route'tan servis çağırma (ES Modules)
import { getCariler } from '../services/cari-service.js';

router.get('/', async (req, res) => {
  try {
    const { page, limit, tip, search } = req.query;
    const result = await getCariler({ tip, search }, { page, limit });
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

---

## 🔗 Bağımlılıklar

| Servis | Bağımlılıklar |
|--------|---------------|
| claude-ai-service | @anthropic-ai/sdk, ai-tools |
| gemini | @google/generative-ai |
| document-analysis | gemini, pdf-parse, mammoth |
| bordro-service | database, personel-service |
| sync-scheduler | node-cron, uyumsoft-service |
| logger | winston, winston-daily-rotate-file |
