# Azure Document Intelligence Custom Model Eğitimi

## Genel Bakış

Bu klasör, Azure Document Intelligence Custom Neural Model eğitimi için araçları içerir.
İhale teknik şartnamelerinden öğün, personel, gramaj, menü, birim fiyat ve daha fazlasını otomatik çıkarmak için kullanılır.

## Aktif Dosya Yapısı

```
azure-training/
├── build-dataset.mjs           ← ANA SCRİPT: URL → OCR → Label → Train (tek dosya pipeline)
├── config.mjs                  ← Ortak config (.env'den okur, key HARDCODE edilmez)
├── archive/                    ← Eski script versiyonları (referans için, kullanılmıyor)
│   ├── auto-label.mjs
│   ├── auto-label-v2.mjs
│   ├── smart-label.mjs → v4
│   ├── fetch-training-docs.mjs
│   ├── download-from-storage.mjs
│   └── download-from-tenders.mjs
└── README.md                   ← Bu dosya
```

> **NOT:** `label.mjs`, `train.mjs`, `fetch-data.mjs` gibi eski dosyalar artık kullanılmıyor.
> Tüm işlevsellik `build-dataset.mjs` içinde birleştirildi.

## Gerekli Ortam Değişkenleri (.env)

```bash
# Azure Document Intelligence
AZURE_DOC_AI_ENDPOINT=https://your-endpoint.cognitiveservices.azure.com/
AZURE_DOC_AI_KEY=your-api-key

# Azure Blob Storage
AZURE_STORAGE_ACCOUNT=cateringtr
AZURE_STORAGE_KEY=your-storage-key
AZURE_TRAINING_CONTAINER=ihale-training    # opsiyonel, varsayılan: ihale-training

# Claude (etiketleme için)
ANTHROPIC_API_KEY=your-claude-key
```

## Pipeline: build-dataset.mjs

Tek script tüm pipeline'ı çalıştırır:

```
PDF URL → Azure Layout API (OCR) → Blob Storage → Claude Etiketleme → Model Eğitimi
```

### Kullanım

```bash
# Tüm URL'leri işle (OCR + label)
node build-dataset.mjs

# Sadece URL listesini göster
node build-dataset.mjs --dry-run

# Önce blob'u temizle, sonra işle
node build-dataset.mjs --clean

# İşlem sonunda model eğitimini başlat
node build-dataset.mjs --train

# Sadece model eğit (dataset zaten hazır)
node build-dataset.mjs --train-only

# Farklı model ID ile
node build-dataset.mjs --train --model=ihale-catering-v5
```

### Pipeline Adımları

1. **PDF → Blob Storage**: URL'den stream, locale inmez
2. **Azure Layout API**: OCR + tablo yapısı çıkarma (urlSource)
3. **OCR → Blob**: `.ocr.json` olarak yükleme (status: succeeded wrapper)
4. **Claude Etiketleme**: Multi-chunk (15 sayfa/chunk), tüm sayfalar işlenir
5. **Label Dosyası**: Koordinatlar [0,1] normalize, fuzzy match ile bounding box
6. **fields.json**: Alan tanımları otomatik yüklenir
7. **Model Eğitimi**: Neural model (opsiyonel, `--train` flag)

### Claude Etiketleme Detayları

- **Kırpma YOK**: Tüm sayfalar, tüm tablolar, tüm satırlar Claude'a gönderilir
- **Multi-chunk**: 15 sayfa/chunk olarak parçalanır (1000 sayfalık doküman bile işlenir)
- **Catering uzmanı prompt**: Detaylı alan açıklamaları ve ipuçları
- **Keyword fallback YOK**: Tamamen Claude'a güvenilir, hibrit sistem kaldırıldı

### Koordinat Eşleştirme

Fuzzy match ile 4 aşamalı bounding box bulma:

1. **Tam substring**: Normalize edilmiş metin araması
2. **line_text**: Claude'un döndürdüğü orijinal satır ile arama
3. **İlk 4 kelime**: Kısmi eşleşme
4. **En uzun kelime**: Tekil kelime bazlı fallback

Tablo alanları için Azure'un kendi tablo bounding box'ı kullanılır.

## Etiketlenecek Alanlar (31 alan)

### İhale Genel Bilgileri
| Alan | Açıklama |
|------|----------|
| `ihale_konusu` | İhalenin konusu/adı |
| `idare_adi` | İhaleyi yapan kurum |
| `ihale_kayit_no` | İKN numarası |
| `ise_baslama_tarihi` | İşe başlama tarihi |
| `is_bitis_tarihi` | İş bitiş tarihi |
| `sure` | Sözleşme süresi |
| `yaklasik_maliyet` | Yaklaşık maliyet |

### Catering Operasyonel Bilgiler
| Alan | Açıklama |
|------|----------|
| `mutfak_tipi` | Yerinde pişirme / taşımalı / hazır yemek |
| `servis_tipi` | Self servis / masaya servis / tabldot |
| `et_tipi` | Dana / büyükbaş / küçükbaş / karışık |
| `gunluk_toplam_ogun` | Günlük toplam öğün sayısı |
| `yemek_cesit_sayisi` | Bir öğünde kaç çeşit yemek |
| `toplam_personel_sayisi` | Çalıştırılacak toplam personel |
| `ogle_kisi_sayisi` | Öğle yemeği kişi sayısı |
| `kahvalti_kisi_sayisi` | Kahvaltı kişi sayısı |
| `aksam_kisi_sayisi` | Akşam yemeği kişi sayısı |
| `diyet_kisi_sayisi` | Diyet yemek porsiyon sayısı |
| `hizmet_gun_sayisi` | Toplam hizmet gün sayısı |
| `kalite_standartlari` | ISO, HACCP, TSE belgeleri |
| `iscilik_orani` | İşçilik oranı yüzdesi |
| `yemek_pisirilecek_yer` | Mutfak/pişirme tesisi |
| `dagitim_saatleri` | Yemek dağıtım/servis saatleri |
| `gida_guvenligi_belgeleri` | Gerekli gıda güvenliği belgeleri |

### Tablo Alanları
| Alan | Açıklama |
|------|----------|
| `menu_tablosu` | Haftalık/günlük yemek menüsü tablosu |
| `gramaj_tablosu` | Gramaj/porsiyon miktarları tablosu |
| `personel_tablosu` | Personel listesi/gereksinimleri tablosu |
| `ogun_dagilimi` | Öğün dağılım tablosu |
| `birim_fiyat_cetveli` | Birim fiyat teklif cetveli |
| `malzeme_listesi` | Hammadde/gıda malzeme listesi |
| `dagitim_noktalari` | Dağıtım/servis noktaları tablosu |
| `ekipman_listesi` | Mutfak ekipman/demirbaş listesi |

## Mevcut Eğitim Verileri

9 PDF URL tanımlı (build-dataset.mjs içinde):

| Kategori | Doküman | Kurum Türü |
|----------|---------|------------|
| Hastane | FSM 24 aylık yemek | Sağlık |
| Hastane | Afyon 33 aylık taşımalı | Sağlık |
| Emniyet | Polis Akademisi Kırıkkale | Güvenlik |
| Emniyet | İzmir Ödemiş | Güvenlik |
| Emniyet | Muğla Özel Harekat | Güvenlik |
| Emniyet | Şanlıurfa Çevik Kuvvet | Güvenlik |
| Spor | Bursa gıda teknik | Gençlik/Spor |
| Spor | Bursa gramaj menü | Gençlik/Spor |
| Ulaşım | TCDD 2. Bölge | Demiryolu |

## Maliyet

| Bileşen | Yaklaşık Maliyet |
|---------|-----------------|
| Azure Layout API (9 PDF) | ~$5-10 |
| Claude etiketleme (multi-chunk) | ~$2-5 |
| Custom Neural Model eğitimi | ~$50-100 |
| **Toplam** | **~$60-115** |

## archive/ Klasörü

Eski script versiyonlarını içerir. `git mv` ile taşınmıştır, history korunmuştur.
Referans amaçlıdır, yeni geliştirmeler `build-dataset.mjs` üzerinden yapılır.
