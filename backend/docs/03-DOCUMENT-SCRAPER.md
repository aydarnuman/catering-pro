# Document Scraper Sistemi

İhale detay sayfasından döküman linkleri ve içerik çeken modül.

---

## 📁 Dosya Yapısı

```
src/scraper/
├── document-scraper.js   # Ana scraper class
└── runner.js             # CLI (--mode=full, --mode=single)
```

---

## 🎯 Ne Çeker?

| Veri Tipi | Açıklama | DB Kolonu |
|-----------|----------|-----------|
| **Document Links** | PDF, DOC, XLS download URL'leri | `document_links` (JSONB) |
| **Announcement** | İhale ilanı içeriği (TEXT) | `announcement_content` |
| **Goods/Services** | Mal/Hizmet listesi (JSON array) | `goods_services_content` |
| **Zeyilname** | Zeyilname içeriği | `zeyilname_content` |
| **Correction Notice** | Düzeltme ilanı | `correction_notice_content` |

---

## 🎬 Çalışma Senaryosu

### Senaryo: Full Mode (Liste + Dökümanlar)

```bash
npm run scrape:list -- --pages 1 --with-documents
# veya
node src/scraper/runner.js --mode=full --pages=1
```

```
═══ TARAMA BAŞLIYOR ═══
ListScraper: Sayfa 1 taranıyor...
ListScraper: 20 ihale bulundu

DocumentScraper: İhale 1/20 detay çekiliyor...
  → https://www.ihalebul.com/tender/123456
DocumentScraper: Tab'lar taranıyor (3 tab bulundu)
  → Genel Bilgiler ✓
  → Dökümanlar ✓  (5 dosya)
  → Zeyilname ✓   (1 dosya)
DocumentScraper: İçerikler çıkarılıyor...
  → announcement_content: 2,450 karakter
  → goods_services: 12 kalem
  → document_links: 6 döküman

DocumentScraper: İhale 2/20 detay çekiliyor...
...
```

---

### Senaryo: Single Mode (Tek İhale)

```bash
node src/scraper/runner.js --mode=single --url=https://www.ihalebul.com/tender/123456
```

```
Runner:Single: Başlatılıyor...
Login: Session geçerli ✓
DocumentScraper: Detay sayfasına gidiliyor...
DocumentScraper: Tab'lar taranıyor...
DocumentScraper: İçerikler çıkarılıyor...

═══ TAMAMLANDI ═══
  id: 42
  is_new: true
  documents: 6
```

---

## 📄 Döküman Tipleri

Document Scraper, URL hash'inden ve link text'inden döküman tipini otomatik algılar:

| Tip Kodu | Türkçe Adı | Algılama Pattern |
|----------|------------|------------------|
| `admin_spec` | İdari Şartname | `idari`, `.idari.` |
| `tech_spec` | Teknik Şartname | `teknik`, `.teknik.` |
| `announcement` | İhale İlanı | `ilan`, `.ilan.` |
| `zeyilname` | Zeyilname | `zeyil`, `zeyilname` |
| `contract` | Sözleşme Tasarısı | `sozlesme`, `sözleşme` |
| `unit_price` | Birim Fiyat Cetveli | `birim_fiyat` |
| `project_files` | Proje Dosyaları | `proje`, `.proje.` |
| `quantity_survey` | Mahal Listesi/Metraj | `mahal`, `metraj` |
| `standard_forms` | Standart Formlar | `standart_form` |
| `document_N` | Bilinmeyen (sıralı) | *(fallback)* |

### Örnek `document_links` JSONB:

```json
{
  "admin_spec": {
    "url": "https://ihalebul.com/download?hash=...",
    "name": "İdari Şartname",
    "fileName": "2024.12345.idari.pdf",
    "scrapedAt": "2024-01-15T10:30:00Z"
  },
  "tech_spec": {
    "url": "https://ihalebul.com/download?hash=...",
    "name": "Teknik Şartname",
    "fileName": "2024.12345.teknik.pdf",
    "scrapedAt": "2024-01-15T10:30:00Z"
  },
  "zeyilname": {
    "url": "https://ihalebul.com/download?hash=...",
    "name": "Zeyilname 1",
    "fileName": "zeyilname_1.pdf",
    "fromTab": "Zeyilname",
    "scrapedAt": "2024-01-15T10:30:00Z"
  }
}
```

---

## 📊 Mal/Hizmet Listesi Formatı

`goods_services_content` kolonu JSON array olarak kaydedilir:

```json
[
  { "sira": "1", "kalem": "Kahvaltı (50 kişilik)", "miktar": "365", "birim": "Gün" },
  { "sira": "2", "kalem": "Öğle Yemeği (100 kişilik)", "miktar": "365", "birim": "Gün" },
  { "sira": "3", "kalem": "Akşam Yemeği (80 kişilik)", "miktar": "365", "birim": "Gün" }
]
```

---

## 🔄 Tab Tarama Sistemi

ihalebul.com'da ihale detayları tab'lara bölünmüştür. Document Scraper her tab'ı otomatik tıklar:

```javascript
// Tab selector'ları
'.nav-tabs .nav-link'
'.nav-pills .nav-link'
'[role="tab"]'
'[data-bs-toggle="tab"]'
```

### Tab Tarama Akışı:

```
1. Sayfa yüklenir
2. Ana sayfadaki dökümanlar çekilir
3. Tab listesi alınır
4. Her tab için:
   → Tab tıklanır
   → 500ms beklenir (içerik yüklensin)
   → Tab içindeki dökümanlar çekilir
   → "fromTab" field'ı eklenir
5. Tüm dökümanlar birleştirilir
```

---

## 🔗 Link Çekme Selectors

```javascript
// Download link selectors
'a[href*="download"]'
'a[href*="file"]'
'a[href*="dosya"]'
'a[href*="attachment"]'
'a[href*="document"]'
'a[href*=".pdf"]'
'a[href*=".doc"]'
'a[href*=".xls"]'
'a[href*=".zip"]'
'a[href*=".rar"]'
```

---

## 🗄️ Veritabanı Şeması

```sql
-- tenders tablosundaki ilgili kolonlar
document_links          JSONB,      -- Döküman URL'leri
announcement_content    TEXT,       -- İhale ilanı (plain text)
goods_services_content  JSONB,      -- Mal/Hizmet listesi
zeyilname_content       JSONB,      -- Zeyilname
correction_notice_content TEXT      -- Düzeltme ilanı
```

---

## ⚙️ CLI Komutları

```bash
# Sadece liste (döküman yok)
npm run scrape:list -- --pages 5

# Liste + Dökümanlar (yeni ihaleler için)
node src/scraper/runner.js --mode=full --pages=5

# DB'deki dökümansız ihalelere döküman çek
node src/scraper/runner.js --mode=docs --limit=10

# Tek ihale detay çek
node src/scraper/runner.js --mode=single --url=https://www.ihalebul.com/tender/123456
```

---

## 🎬 Docs Mode Senaryosu

**Kullanım:** Daha önce `--mode=list` ile çekilmiş ama dökümanları olmayan ihaleler için.

```bash
node src/scraper/runner.js --mode=docs --limit=5
```

```
Runner:Docs: Dökümansız ihaleler taranıyor (limit: 5)
Runner:Docs: 5 dökümansız ihale bulundu
Runner:Docs: [1/5] İhale: 123456
DocScraper: Detay sayfasına gidiliyor...
DocScraper: İçerik çekildi { döküman: 4, ilan: "1850 chr" }
Runner:Docs: ✓ 123456: 4 döküman kaydedildi
Runner:Docs: [2/5] İhale: 123457
...
═══ TAMAMLANDI ═══
  toplam: 5
  başarılı: 4
  hatalı: 1
```

---

## 🔧 Metodlar

### `scrapeAllContent(page, tenderUrl)`
Tüm içerikleri çeker. Liste scraper'dan çağrılır.

```javascript
const content = await documentScraper.scrapeAllContent(page, tender.url);
// Returns:
{
  documentLinks: {...},
  announcementContent: "...",
  goodsServicesList: [...],
  zeyilnameContent: {...},
  correctionNoticeContent: "..."
}
```

### `scrapeTenderDetails(page, url)`
Tek ihale için tam detay çeker. `--mode=single` için kullanılır.

```javascript
const details = await documentScraper.scrapeTenderDetails(page, url);
// Returns:
{
  title: "...",
  kayitNo: "2024/12345",
  organization: "...",
  city: "Ankara",
  teklifTarihi: "15.01.2024 10:00",
  yaklasikMaliyet: "1.500.000,00 TL",
  documentLinks: {...},
  announcementContent: "...",
  ...
}
```

---

## ⚠️ Dikkat Edilmesi Gerekenler

1. **Tab Bekleme Süresi:** Tab tıklandıktan sonra 500ms beklenir. Yavaş bağlantılarda artırılabilir.

2. **Duplicate URL Kontrolü:** Aynı URL farklı tab'larda görünebilir. `seenUrls` Set ile filtrelenir.

3. **Hash Decode:** ihalebul.com döküman URL'lerinde Base64 encoded hash var. Dosya adı bu hash'ten çıkarılır.

4. **Maskelenmiş Veri:** Session geçersizse döküman linkleri `***` ile maskelenir → yeniden login gerekir.

---

## 📈 İyileştirme Önerileri

- [ ] Döküman indirme ve Supabase Storage'a yükleme
- [ ] OCR entegrasyonu (taranmış PDF'ler için)
- [ ] Retry mekanizması (tab yükleme hataları için)
- [ ] Progress callback (hangi ihale işleniyor gösterimi)
