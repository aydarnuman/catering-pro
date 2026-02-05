# v9.0 UNIFIED PIPELINE - Kontrol Raporu

> **Tarih:** 2026-02-05  
> **Durum:** Mapping düzeltmeleri yapıldı

---

## 1. TESPİT EDİLEN SORUNLAR

### Problem 1: Alan Adı Uyumsuzluğu (ÇÖZÜLDÜ ✅)

**Sorun:**
- unified-pipeline İngilizce nested yapı döndürüyordu: `analysis.summary.title`
- Frontend Türkçe flat yapı bekliyordu: `ihale_basligi`

**Çözüm:**
`tender-tracking.js` dosyasındaki `/add-from-analysis` endpoint'ine v9.0 mapping eklendi:

```javascript
// v9 mapping örnekleri:
analysis.summary.title → ihale_basligi
analysis.summary.institution → kurum
analysis.catering.total_persons → kisi_sayisi
analysis.catering.daily_meals → gunluk_ogun_sayisi
analysis.personnel.staff → personel_detaylari
analysis.dates.start_date → takvim[]
```

### Problem 2: Eksik Alanlar (ÇÖZÜLDÜ ✅)

**Sorun:**
- `analysisSummary` nesnesinde `ihale_basligi`, `kurum`, `gramaj`, `toplam_personel` alanları yoktu

**Çözüm:**
Eksik alanlar eklendi:
```javascript
ihale_basligi: null,  // v9: summary.title
kurum: null,          // v9: summary.institution
gramaj: [],           // v9: catering.gramaj
toplam_personel: null // v9: personnel.total_count
```

---

## 2. V9 VERİ AKIŞI

```
┌─────────────────────────────────────────────────────────────────┐
│                    UNIFIED PIPELINE v9.0                        │
│                                                                 │
│  analyzeDocument() → {                                          │
│    analysis: {                                                  │
│      summary: { title, institution, ikn, estimated_value },     │
│      catering: { total_persons, daily_meals, gramaj, meals },   │
│      personnel: { staff, total_count },                         │
│      dates: { start_date, end_date, tender_date, all_dates },   │
│      technical_requirements: [],                                │
│      penalties: [],                                             │
│      iletisim, teminat_oranlari, servis_saatleri, mali_kriterler│
│    },                                                           │
│    meta: { provider_used, elapsed_ms },                         │
│    validation: { completeness_score, missing_fields }           │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   DATABASE (JSONB)                              │
│                                                                 │
│  documents.analysis_result = JSON.stringify({                   │
│    pipeline_version: '9.0',                                     │
│    provider: 'azure-custom+claude',                             │
│    analysis: { ... },                                           │
│    stats: { ... },                                              │
│    validation: { ... }                                          │
│  })                                                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              TENDER-TRACKING.JS MAPPING                         │
│                                                                 │
│  /api/tender-tracking/:id/add-from-analysis                     │
│                                                                 │
│  v9 nested → flat Türkçe dönüşümü:                              │
│  • summary.title → ihale_basligi                                │
│  • summary.institution → kurum                                  │
│  • catering.total_persons → kisi_sayisi                         │
│  • catering.daily_meals → gunluk_ogun_sayisi                    │
│  • personnel.staff → personel_detaylari                         │
│  • dates.* → takvim[]                                           │
│  • technical_requirements → teknik_sartlar                      │
│  • penalties → ceza_kosullari                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND                                     │
│                                                                 │
│  AnalysisData interface (types.ts):                             │
│  {                                                              │
│    ihale_basligi, kurum, ikn, tahmini_bedel,                    │
│    kisi_sayisi, gunluk_ogun_sayisi,                             │
│    teknik_sartlar, birim_fiyatlar, takvim,                      │
│    personel_detaylari, ogun_bilgileri,                          │
│    iletisim, teminat_oranlari, servis_saatleri,                 │
│    mali_kriterler, ...                                          │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. KONTROL LİSTESİ

| Alan | Pipeline | DB Kayıt | Mapping | Frontend | Durum |
|------|----------|----------|---------|----------|-------|
| İhale Başlığı | summary.title | ✅ | ✅ | ihale_basligi | ✅ |
| Kurum | summary.institution | ✅ | ✅ | kurum | ✅ |
| IKN | summary.ikn | ✅ | ✅ | ikn | ✅ |
| Tahmini Bedel | summary.estimated_value | ✅ | ✅ | tahmini_bedel | ✅ |
| Kişi Sayısı | catering.total_persons | ✅ | ✅ | kisi_sayisi | ✅ |
| Günlük Öğün | catering.daily_meals | ✅ | ✅ | gunluk_ogun_sayisi | ✅ |
| Gramaj | catering.gramaj | ✅ | ✅ | gramaj | ✅ |
| Öğün Bilgileri | catering.meals | ✅ | ✅ | ogun_bilgileri | ✅ |
| Personel | personnel.staff | ✅ | ✅ | personel_detaylari | ✅ |
| Başlangıç Tarihi | dates.start_date | ✅ | ✅ | takvim[] | ✅ |
| Bitiş Tarihi | dates.end_date | ✅ | ✅ | takvim[] | ✅ |
| Teknik Şartlar | technical_requirements | ✅ | ✅ | teknik_sartlar | ✅ |
| Ceza Koşulları | penalties | ✅ | ✅ | ceza_kosullari | ✅ |
| İletişim | iletisim/contact | ✅ | ✅ | iletisim | ✅ |
| Teminat Oranları | teminat_oranlari | ✅ | ✅ | teminat_oranlari | ✅ |
| Servis Saatleri | servis_saatleri | ✅ | ✅ | servis_saatleri | ✅ |
| Mali Kriterler | mali_kriterler | ✅ | ✅ | mali_kriterler | ✅ |

---

## 4. KALAN GÖREVLER

### Öncelik 1 - Test (Hemen)
- [ ] Gerçek bir ihale dökümanı ile end-to-end test
- [ ] Frontend'de tüm alanların görüntülendiğini doğrula
- [ ] CalculationModal'da verilerin doğru yüklendiğini kontrol et

### Öncelik 2 - Eski Veri Uyumu
- [ ] Eski v5/v7 formatındaki veriler için backward compatibility test
- [ ] Eksik alanlar için graceful fallback doğrulama

### Öncelik 3 - Performans
- [ ] Azure Custom Model + Claude response time ölçümü
- [ ] Büyük dökümanlar (50+ sayfa) için stres testi

---

## 5. TEST KOMUTU

```bash
# Backend test
cd backend
node -e "
require('dotenv').config();
import('./src/services/ai-analyzer/unified-pipeline.js').then(async ({ analyzeDocument, checkPipelineHealth }) => {
  const health = await checkPipelineHealth();
  console.log('Health:', JSON.stringify(health, null, 2));
  
  // Test with a real document
  // const result = await analyzeDocument('./path/to/test.pdf');
  // console.log('Result:', JSON.stringify(result.analysis, null, 2));
}).catch(console.error);
"
```

---

**Sonuç:** v9.0 Unified Pipeline hazır, mapping düzeltmeleri yapıldı. Gerçek ihale dökümanı ile test önerilir.
