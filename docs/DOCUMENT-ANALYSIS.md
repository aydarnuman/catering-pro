# 🤖 Claude AI Döküman Analiz Sistemi

İhale şartnamelerini otomatik analiz eden AI destekli döküman işleme modülü.

## 🎯 Özellikler

- **Görsel PDF Analizi** - PDF'leri sayfa sayfa görsele çevirerek analiz
- **Akıllı Metin Tanıma** - %99 doğruluk oranı
- **Tablo ve Form Tanıma** - Karmaşık yapıları yapısal olarak çıkarır
- **Çoklu Format Desteği** - PDF, Word, Excel, Görsel, ZIP
- **Paralel İşleme** - Birden fazla dökümanı aynı anda analiz
- **Gerçek Zamanlı İlerleme** - SSE ile canlı durum takibi

## 📁 Desteklenen Formatlar

| Format | Uzantı | Dönüştürücü | Öncelik |
|--------|--------|-------------|---------|
| PDF | `.pdf` | pdf2pic → Claude Vision | - |
| Word (yeni) | `.docx` | LibreOffice → mammoth | 1 → 2 |
| Word (eski) | `.doc` | LibreOffice → antiword → textutil | 1 → 2 → 3 |
| Excel | `.xlsx`, `.xls` | xlsx | - |
| Metin | `.txt`, `.csv` | Native | - |
| Görseller | `.png`, `.jpg`, `.jpeg`, `.webp` | Claude Vision | - |
| Arşiv | `.zip` | unzip + içerik analizi | - |

## 🔧 Gereksinimler

```bash
# LibreOffice (önerilir - en iyi sonuç)
brew install --cask libreoffice

# GraphicsMagick (PDF dönüştürme için)
brew install graphicsmagick ghostscript

# antiword (yedek DOC okuyucu)
brew install antiword
```

## ⚙️ Ortam Değişkenleri

```env
# backend/.env
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx
```

## 🔍 Analiz Akışı

```
┌──────────────┐
│   Dosya      │
│   Yükleme    │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   Format     │
│   Algılama   │ ← file-type (magic bytes)
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────────────────┐
│              Format'a Göre İşleme            │
├──────────────────────────────────────────────┤
│ PDF  → pdf2pic → sharp → Claude Vision       │
│ DOCX → LibreOffice/mammoth → Claude Text     │
│ DOC  → LibreOffice/antiword → Claude Text    │
│ XLSX → xlsx parse → Claude Text              │
│ IMG  → Claude Vision                         │
│ ZIP  → unzip → her dosyayı ayrı işle         │
└──────────────────────────────────────────────┘
       │
       ▼
┌──────────────┐
│   Claude AI  │
│   Analiz     │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   JSON       │
│   Sonuç      │
└──────────────┘
```

## 📊 Analiz Sonuç Yapısı

```json
{
  "success": true,
  "toplam_sayfa": 3,
  "analiz": {
    "ihale_basligi": "2026 Yılı Gıda Alım İhalesi",
    "kurum": "T.C. Sağlık Bakanlığı",
    "tarih": "15.01.2026",
    "bedel": "5.500.000,00 TL",
    "sure": "365 gün",
    "teknik_sartlar": [
      "Ürünler TSE standartlarına uygun olmalı",
      "Soğuk zincir korunmalı"
    ],
    "birim_fiyatlar": [
      { "kalem": "Kuru Fasulye", "birim": "kg", "miktar": "1000" }
    ],
    "iletisim": {
      "adres": "...",
      "telefon": "...",
      "email": "..."
    },
    "notlar": [
      "Numune teslimi zorunlu"
    ],
    "tam_metin": "..."
  }
}
```

## 🌐 API Endpoint

### `POST /api/documents/analyze`

**Request:**
```bash
curl -X POST http://localhost:3001/api/documents/analyze \
  -F "file=@ihale-sartname.pdf" \
  -F "uploaded_by=user"
```

**Response (SSE Stream):**
```
data: {"stage":"extracting","message":"ZIP dosyası açılıyor..."}
data: {"stage":"analyzing","message":"ZIP içi: 1/3 - sartname.docx","progress":33}
data: {"stage":"analyzing","message":"ZIP içi: 2/3 - fiyat.xlsx","progress":66}
data: {"stage":"complete","result":{...},"document_id":123}
```

## 🖥️ Frontend Kullanımı

### Dosya Yükleme
- Drag & drop ile sürükle bırak
- Tıklayarak dosya seçme
- Çoklu dosya desteği

### İlerleme Takibi
- Her dosya için ayrı progress bar
- Anlık durum mesajları
- Hata bildirimleri

### Sonuç Görüntüleme
- **Tab 1:** Teknik Şartlar (scroll edilebilir liste)
- **Tab 2:** Birim Fiyatlar (tablo görünümü)
- **Tab 3:** Önemli Notlar
- **Tab 4:** Tam Metin

### Export
- JSON olarak indir
- İhale olarak kaydet

## 📂 Dosya Yapısı

```
backend/src/
├── services/
│   └── claude.js           # Ana analiz servisi
│       ├── analyzeFile()           # Ana giriş noktası
│       ├── analyzePdfWithClaude()  # PDF analizi
│       ├── analyzeDocxFile()       # Word analizi
│       ├── analyzeExcelFile()      # Excel analizi
│       ├── analyzeTextFile()       # Metin analizi
│       ├── analyzeImageFile()      # Görsel analizi
│       └── extractZipAndFindFiles()# ZIP işleme
└── routes/
    └── documents.js        # API endpoint

frontend/src/app/upload/
└── page.tsx               # Upload sayfası
    ├── Dropzone           # Dosya yükleme
    ├── FileList           # Dosya listesi
    ├── ProgressTracking   # İlerleme takibi
    └── ResultTabs         # Sonuç görünümü
```

## 🔄 Dönüştürme Önceliği

### Word Dosyaları (.doc/.docx)
```
1. LibreOffice (soffice --headless)  ← En iyi sonuç
2. mammoth (sadece DOCX)
3. antiword (sadece DOC)
4. textutil (macOS yerleşik)
```

### PDF Dosyaları
```
1. pdf2pic → sayfa sayfa görsel
2. sharp → boyut optimizasyonu (1000x1400, 80% JPEG)
3. Claude Vision → görsel analiz
```

### ZIP Dosyaları
```
1. Gerçek format algılama (file-type)
2. unzip ile içerik çıkarma
3. Desteklenen her dosyayı analiz
4. Sonuçları birleştirme
```

## ⚡ Performans

| İşlem | Süre |
|-------|------|
| PDF (3 sayfa) | ~60 saniye |
| DOCX (büyük) | ~15 saniye |
| ZIP (3 dosya) | ~45 saniye |
| Görsel | ~10 saniye |

## 🐛 Sorun Giderme

### "LibreOffice başarısız" Hatası
```bash
# LibreOffice kurulu mu?
which soffice

# Kurulu değilse:
brew install --cask libreoffice
```

### "PDF sayfalara dönüştürülemedi" Hatası
```bash
# GraphicsMagick kurulu mu?
which gm

# Kurulu değilse:
brew install graphicsmagick ghostscript
```

### "ZIP içinde desteklenen dosya bulunamadı" Hatası
- ZIP içinde sadece desteklenen formatlar aranır
- Desteklenen: PDF, DOC, DOCX, XLS, XLSX, TXT, CSV, PNG, JPG

### Claude API Hatası
```bash
# API key doğru mu?
echo $ANTHROPIC_API_KEY

# Kredi var mı?
# https://console.anthropic.com/settings/billing
```

## 📝 Notlar

- LibreOffice en iyi sonucu verir, mutlaka kurun
- Büyük dosyalar için timeout 60 saniye
- ZIP içindeki dosyalar sırayla işlenir
- Paralel analiz limiti: 2 dosya (API rate limit)

