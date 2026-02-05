# Zero-Loss Pipeline - Boş Alan Düzeltme Planı

> **Sorun:** Pipeline değerler yerine boş string üretiyor
> **Etki:** iletisim, servis_saatleri, teminat_oranlari gibi alanlar boş
> **Öncelik:** KRİTİK

---

## Tespit Edilen Sorunlar

### 1. Prompt Sorunu (STAGE1_PROMPT & FULL_PROMPT)

**Mevcut:**
```
KURALLAR:
- Boş alanları boş array [] veya boş object {} olarak bırak
```

**Sorun:** AI'a "boş bırak" deniyor, bu da "değer yoksa üretme" anlamına geliyor.

### 2. Validation Eksikliği

- Kritik alanlar boş geldiğinde retry yok
- Completeness score hesaplanıyor ama aksiyon alınmıyor

### 3. Stage 2 (Birleştirme) Yetersizliği

- Boş alanları doldurmak için ek tarama yok
- Sadece var olanları birleştiriyor

---

## Çözüm Planı

### FIX 1: Prompt Güncelleme

**Dosya:** `backend/src/services/ai-analyzer/prompts/extract-full.js`

```javascript
// ESKİ
"- Boş alanları boş array [] veya boş object {} olarak bırak"

// YENİ
"- Bu alanları MUTLAKA doldur (metinde yoksa 'Belirtilmemiş' yaz):
   - iletisim (telefon, email, adres, yetkili - idari şartnamelerde MUTLAKA var)
   - teminat_oranlari (gecici, kesin - ihale şartnamelerinde ZORUNLU)
   - servis_saatleri (catering ihalelerinde MUTLAKA var)
- Diğer alanlar için boş array [] kullan"
```

### FIX 2: Kritik Alan Validator

**Yeni dosya:** `backend/src/services/ai-analyzer/controls/field-validator.js`

```javascript
// Kritik alanlar ve beklenen içerikleri
const CRITICAL_FIELDS = {
  iletisim: {
    required: ['telefon', 'email', 'adres'],
    sources: ['idari_sartname', 'ilan'],
    fallbackPrompt: 'İletişim bilgilerini bul: telefon, email, adres, yetkili kişi'
  },
  teminat_oranlari: {
    required: ['gecici', 'kesin'],
    sources: ['idari_sartname', 'sozlesme'],
    fallbackPrompt: 'Teminat oranlarını bul: geçici teminat %, kesin teminat %'
  },
  servis_saatleri: {
    required: ['kahvalti', 'ogle', 'aksam'],
    sources: ['teknik_sartname'],
    fallbackPrompt: 'Servis saatlerini bul: kahvaltı, öğle, akşam yemeği saatleri'
  },
  tahmini_bedel: {
    required: true,
    sources: ['ilan', 'idari_sartname'],
    fallbackPrompt: 'Yaklaşık maliyet/tahmini bedel değerini bul'
  }
};

export function validateCriticalFields(analysis) {
  const missing = [];
  
  for (const [field, config] of Object.entries(CRITICAL_FIELDS)) {
    const value = analysis[field];
    
    if (!value) {
      missing.push({ field, config });
      continue;
    }
    
    if (typeof value === 'object') {
      const hasContent = Object.values(value).some(v => v && v !== '');
      if (!hasContent) {
        missing.push({ field, config });
      }
    }
  }
  
  return {
    valid: missing.length === 0,
    missing,
    completeness: 1 - (missing.length / Object.keys(CRITICAL_FIELDS).length)
  };
}
```

### FIX 3: Fill Missing Stage (Yeni Aşama)

**Dosya:** `backend/src/services/ai-analyzer/pipeline/analyzer.js`

Stage 2'den sonra yeni bir aşama:

```javascript
async function fillMissingFields(analysis, chunks, missingFields) {
  for (const { field, config } of missingFields) {
    logger.info(`Filling missing field: ${field}`);
    
    // İlgili chunk'ları bul (document type'a göre)
    const relevantChunks = chunks.filter(c => 
      config.sources.some(s => c.context?.toLowerCase().includes(s))
    );
    
    if (relevantChunks.length === 0) {
      // Tüm chunk'larda ara
      relevantChunks.push(...chunks.slice(0, 3)); // İlk 3 chunk
    }
    
    // Focused prompt ile tekrar dene
    const focusedPrompt = `
      Bu metinde şu bilgiyi bul: ${config.fallbackPrompt}
      
      JSON formatında döndür:
      { "${field}": { ... } }
      
      Metinde açıkça yazıyorsa değeri yaz.
      Bulamadıysan "bulunamadi" yaz.
    `;
    
    for (const chunk of relevantChunks) {
      const result = await anthropic.messages.create({
        model: aiConfig.claude.defaultModel, // Sonnet (daha güçlü)
        max_tokens: 1024,
        messages: [{ role: 'user', content: focusedPrompt + '\n\n' + chunk.content }]
      });
      
      const parsed = safeJsonParse(result.content[0]?.text);
      if (parsed && parsed[field] && parsed[field] !== 'bulunamadi') {
        analysis[field] = parsed[field];
        logger.info(`Field filled: ${field}`, { value: parsed[field] });
        break;
      }
    }
  }
  
  return analysis;
}
```

### FIX 4: Pipeline Entegrasyonu

**Dosya:** `backend/src/services/ai-analyzer/pipeline/index.js` (`runZeroLossPipeline`)

```javascript
// Stage 2 sonrası ekleme:

// ===== LAYER 3.5: FILL MISSING CRITICAL FIELDS =====
const validation = validateCriticalFields(assembled);

if (!validation.valid && validation.missing.length > 0) {
  logger.info('Missing critical fields detected, running fill stage', {
    missing: validation.missing.map(m => m.field)
  });
  
  if (onProgress) {
    onProgress({
      stage: 'fill_missing',
      message: `Eksik alanlar dolduruluyor (${validation.missing.length})...`,
      progress: 85
    });
  }
  
  assembled = await fillMissingFields(assembled, chunks, validation.missing);
  
  // Tekrar validate
  const revalidation = validateCriticalFields(assembled);
  logger.info('Fill stage completed', {
    before: validation.completeness,
    after: revalidation.completeness
  });
}
```

---

## Uygulama Sırası

### Aşama 1: Hızlı Düzeltme (1-2 saat)
1. ✅ `extract-full.js` prompt güncelle
2. ✅ `analyzer.js` STAGE1_PROMPT ve STAGE2_PROMPT güncelle

### Aşama 2: Validator (2-3 saat)
3. ✅ `field-validator.js` oluştur
4. ✅ Pipeline'a entegre et

### Aşama 3: Fill Missing (3-4 saat)
5. ✅ `fillMissingFields` fonksiyonu yaz
6. ✅ Pipeline'a Layer 3.5 olarak ekle

### Aşama 4: Azure Model İyileştirme (Paralel)
7. ✅ `smart-label-v5.mjs` ile gelişmiş etiketler (Öğün + Personel tablolarına odaklı)
8. ⏳ Azure model yeniden eğitimi

#### v5 Yenilikleri:
- Öğün tablosu: kahvaltı/öğle/akşam kişi sayıları otomatik extraction
- Personel tablosu: pozisyon bazlı ayrım (aşçı, garson, bulaşıkçı vb.)
- Alt-alan etiketleri: Tablo içi değerler için granüler etiketler
- Doğrulama skoru: Her doküman için kalite skoru (0-100)

---

## Test Planı

```bash
# Tek döküman test
node backend/analyze-tender-full.mjs --tender=11231 --doc=331 --verbose

# Karşılaştırma
# ÖNCE: iletisim: { adres: "", email: "", ... }
# SONRA: iletisim: { adres: "Sancaktepe...", email: "...", ... }
```

---

## Beklenen İyileşme

| Alan | Önce | Sonra |
|------|------|-------|
| iletisim | %0 | %90+ |
| teminat_oranlari | %0 | %95+ |
| servis_saatleri | %0 | %85+ |
| tahmini_bedel | ~%50 | %90+ |

---

Onay verirsen hangi aşamadan başlayalım?
