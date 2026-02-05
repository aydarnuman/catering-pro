# Azure Document Intelligence Kurulum Rehberi

Bu rehber, ihale dökümanları için Azure Document Intelligence custom model kurulumunu açıklar.

## 1. Azure Hesabı Oluşturma

### Adım 1: Azure Portal'a Kayıt
1. https://portal.azure.com adresine git
2. "Ücretsiz hesap oluştur" seçeneğini tıkla
3. Microsoft hesabı ile giriş yap veya yeni oluştur
4. Kredi kartı bilgilerini gir (ilk 12 ay ücretsiz $200 kredi)

### Adım 2: Document Intelligence Resource Oluşturma
1. Azure Portal'da "Create a resource" tıkla
2. "Document Intelligence" veya "Form Recognizer" ara
3. "Create" butonuna bas
4. Aşağıdaki bilgileri doldur:
   - **Subscription:** Azure subscription 1
   - **Resource group:** Yeni oluştur → `catering-ai-rg`
   - **Region:** `West Europe` (Türkiye'ye yakın)
   - **Name:** `catering-document-ai`
   - **Pricing tier:** `S0` (Standard) veya `F0` (Free - 500 sayfa/ay)

5. "Review + create" → "Create"

### Adım 3: API Anahtarlarını Al
1. Resource oluşturulduktan sonra "Go to resource" tıkla
2. Sol menüden "Keys and Endpoint" seç
3. Şu bilgileri kaydet:
   - **KEY 1:** `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
   - **Endpoint:** `https://catering-document-ai.cognitiveservices.azure.com/`

## 2. Environment Variables

`.env` dosyasına ekle:

```env
# Azure Document Intelligence
AZURE_DOCUMENT_AI_ENDPOINT=https://catering-document-ai.cognitiveservices.azure.com/
AZURE_DOCUMENT_AI_KEY=your-key-here
AZURE_DOCUMENT_AI_MODEL_ID=ihale-teknik-sartname
```

## 3. Custom Model Eğitimi

### Document Intelligence Studio'ya Giriş
1. https://documentintelligence.ai.azure.com/ adresine git
2. Azure hesabınla giriş yap
3. Resource'unu seç: `catering-document-ai`

### Yeni Custom Model Oluşturma
1. "Custom models" → "Create a custom model" tıkla
2. Model tipi: "Custom extraction model" seç
3. Model adı: `ihale-teknik-sartname`

### Training Data Hazırlama
1. Azure Blob Storage'a bir container oluştur: `training-data`
2. Minimum 5 örnek ihale dökümanı yükle (ideal: 15-50)
3. Her döküman için:
   - PDF dosyası
   - Otomatik veya manuel etiketleme

### Alanları Tanımlama (Labeling)
Studio'da her döküman için şu alanları işaretle:

**Temel Bilgiler:**
| Alan Adı | Tip | Açıklama |
|----------|-----|----------|
| `ihale_kayit_no` | String | İKN numarası (örn: 2026/123456) |
| `kurum_adi` | String | İhaleyi açan kurum |
| `ihale_adi` | String | İhalenin tam adı |

**Tarihler:**
| Alan Adı | Tip | Açıklama |
|----------|-----|----------|
| `ihale_tarihi` | Date | İhale tarihi |
| `son_teklif_tarihi` | Date | Son teklif verme tarihi |
| `baslangic_tarihi` | Date | Sözleşme başlangıç tarihi |
| `bitis_tarihi` | Date | Sözleşme bitiş tarihi |

**Finansal:**
| Alan Adı | Tip | Açıklama |
|----------|-----|----------|
| `yaklasik_maliyet` | Currency | Yaklaşık maliyet tutarı |
| `teminat_orani` | Number | Teminat yüzdesi |

**Tablolar (Kritik!):**
| Alan Adı | Tip | Açıklama |
|----------|-----|----------|
| `personel_tablosu` | Table | Personel listesi (pozisyon, adet, nitelik) |
| `gramaj_tablosu` | Table | Gramaj listesi (malzeme, gramaj, birim) |
| `ceza_kosullari` | Array | Ceza maddeleri listesi |
| `ogun_turleri` | Array | Öğün türleri ve miktarları |

**Detaylı şema:** `backend/src/services/ai-analyzer/schemas/azure-training-schema.json`

### Model Eğitimi
1. Tüm dökümanları etiketledikten sonra "Train" tıkla
2. Model adı: `ihale-teknik-sartname-v1`
3. Eğitim ~10-30 dakika sürer
4. Eğitim tamamlandığında "Model ID" yi kaydet

## 4. Fiyatlandırma

| Tier | Fiyat | Limit |
|------|-------|-------|
| F0 (Free) | $0 | 500 sayfa/ay |
| S0 (Standard) | $1.50/1000 sayfa | Sınırsız |
| Custom Model | $10/1000 sayfa | Model başına |

**Tahmini aylık maliyet (100 ihale/ay, ortalama 50 sayfa):**
- Prebuilt: 5000 sayfa × $0.0015 = **$7.50/ay**
- Custom: 5000 sayfa × $0.01 = **$50/ay**

## 5. API Kullanımı

### Prebuilt Layout (Tablo Extraction)
```javascript
const result = await client.beginAnalyzeDocument("prebuilt-layout", document);
```

### Custom Model
```javascript
const result = await client.beginAnalyzeDocument("ihale-teknik-sartname-v1", document);
```

## 6. Sonraki Adımlar

1. ✅ Azure hesabı oluştur
2. ✅ Document Intelligence resource oluştur
3. ✅ API key'leri .env'e ekle
4. ⬜ 5-10 örnek ihale dökümanı hazırla
5. ⬜ Studio'da model eğit
6. ⬜ Backend entegrasyonunu test et

## Kaynaklar

- [Azure Document Intelligence Docs](https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/)
- [Document Intelligence Studio](https://documentintelligence.ai.azure.com/)
- [Custom Model Training Guide](https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/how-to-guides/build-a-custom-model)
- [Pricing](https://azure.microsoft.com/en-us/pricing/details/ai-document-intelligence/)
