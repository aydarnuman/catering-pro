# Azure Document Intelligence Custom Model Eğitimi

## Genel Bakış

Bu klasör, Azure Document Intelligence Custom Neural Model eğitimi için gerekli araçları içerir.

## 🔴 v5 - Gelişmiş Öğün ve Personel Tabloları

### Yenilikler (Şubat 2026)

```bash
# Yeni etiketleme script'i
node scripts/azure-training/smart-label-v5.mjs
```

**Ana İyileştirmeler:**
1. **Öğün Tabloları**: Kahvaltı/Öğle/Akşam ayrımı, kişi sayıları otomatik çıkarma
2. **Personel Tabloları**: Pozisyon bazlı ayrım (Aşçı, Garson, vb.) ve sayılar
3. **Alt-alan Etiketleri**: Tablo içi değerler için granüler etiketler
4. **Satır Bazında Extraction**: Kritik tablolarda her satır ayrı ayrı analiz
5. **Doğrulama Skoru**: Her doküman için 0-100 arası kalite skoru

## Gereksinimler

### Minimum Döküman Sayısı
- **5 döküman**: Minimum (düşük doğruluk)
- **10-15 döküman**: Önerilen (iyi doğruluk)
- **20+ döküman**: İdeal (yüksek doğruluk)

### Döküman Çeşitliliği
Farklı kurumlardan ve formatlardan dökümanlar toplanmalı:
- Hastane teknik şartnameleri
- Okul/Üniversite yemek ihaleleri
- Kamu kurumu ihaleleri
- Belediye ihaleleri

## Etiketlenecek Alanlar (v5)

### 🔴 Kritik Tablolar
| Alan | Açıklama | Alt-Alanlar | Öncelik |
|------|----------|-------------|---------|
| `ogun_dagilimi` | Öğün dağılım tablosu | kahvalti_kisi, ogle_kisi, aksam_kisi, toplam | ⭐⭐⭐ |
| `personel_tablosu` | Personel gereksinimleri | asci, garson, bulasikci, diyetisyen, toplam | ⭐⭐⭐ |
| `haftalik_menu` | Haftalık menü | hafta_no, gunler, yemekler | ⭐⭐⭐ |
| `gramaj_tablosu` | Gramaj/porsiyon | yemek_adi, cig_gr, pismis_gr | ⭐⭐⭐ |

### 🟡 Önemli Tablolar
| Alan | Açıklama |
|------|----------|
| `ogun_detay` | Birim bazında Normal/Diyet/Refakatçi dağılımı |
| `birim_fiyat_cetveli` | Fiyat teklif cetveli |
| `dagitim_noktalari` | Yemekhaneler/servis noktaları |
| `malzeme_listesi` | Hammadde listesi |

### 🔵 String Alanlar
| Alan | Açıklama | Tip |
|------|----------|-----|
| `kahvalti_kisi_sayisi` | Kahvaltı kişi sayısı | number |
| `ogle_kisi_sayisi` | Öğle yemeği kişi sayısı | number |
| `aksam_kisi_sayisi` | Akşam yemeği kişi sayısı | number |
| `toplam_personel_sayisi` | Toplam personel | number |
| `gunluk_toplam_ogun` | Günlük toplam öğün | number |

## Eğitim Adımları

### Adım 1: Döküman Toplama
```bash
# Supabase'den mevcut dökümanları export et
node scripts/azure-training/export-documents.mjs

# Veya manuel olarak ekle
# PDF'leri scripts/azure-training/documents/ klasörüne koy
```

### Adım 2: Azure Blob Storage'a Yükle
```bash
node scripts/azure-training/upload-to-azure.mjs
```

### Adım 3: Document Intelligence Studio'da Etiketle
1. https://documentintelligence.ai.azure.com/studio adresine git
2. "Custom extraction models" > "Create new" seç
3. Blob Storage container'ını bağla
4. Her döküman için alanları etiketle
5. Eğitimi başlat

### Adım 4: Model ID'yi Sisteme Entegre Et
```javascript
// backend/src/config/ai.config.js
azure: {
  customModelId: 'ihale-catering-v1',  // Eğitim sonrası oluşan ID
}
```

## Query Fields Özelliği (Bonus)

Eğitim yapmadan hızlı çözüm için Query Fields kullanılabilir:

```javascript
// API çağrısında ek alanlar iste
POST /documentModels/prebuilt-layout:analyze
?features=queryFields
&queryFields=OrnekMenu,GramajListesi,PersonelSayisi,OgunAdetleri
```

## Dosya Yapısı

```
azure-training/
├── README.md                    # Bu dosya
├── export-documents.mjs         # Supabase'den döküman export
├── upload-to-azure.mjs          # Azure Blob Storage'a yükle
├── create-training-manifest.mjs # Eğitim manifest dosyası oluştur
├── documents/                   # Eğitim dökümanları (gitignore)
│   ├── tender_001.pdf
│   ├── tender_002.pdf
│   └── ...
└── labels/                      # Etiket dosyaları
    ├── fields.json
    └── *.labels.json
```

## Maliyet

| Model Türü | Eğitim Süresi | Maliyet |
|------------|---------------|---------|
| Custom Template | ~15 dk | ~$10 |
| Custom Neural | 1-2 saat | ~$50-100 |

## Önerilen Strateji

1. **Kısa vadede**: Query Fields ile hızlı sonuç al
2. **Orta vadede**: 10+ döküman topla, Custom Neural Model eğit
3. **Uzun vadede**: Composed Model ile birden fazla model birleştir
