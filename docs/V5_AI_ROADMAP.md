# V5 AI Analyzer Roadmap

> **Tarih:** 2026-02-05
> **Versiyon:** 5.0 Planning
> **Durum:** Tasarım Aşaması

---

## Özet

Bu döküman, AI doküman analiz sisteminin v5 geliştirmelerini tanımlar.

### Onaylanan Özellikler

| # | Özellik | Öncelik | Durum |
|---|---------|---------|-------|
| 1 | Cross-Document Anomaly Detection | 🔴 Yüksek | Planlandı |
| 2 | Deep Table Schema Analysis | 🔴 Yüksek | Planlandı |
| 3 | Field Dependency Graph | 🟡 Orta | Planlandı |
| 4 | Doküman Kümeleme + Dashboard | 🔴 Yüksek | Planlandı |

### İptal Edilen Özellikler

| # | Özellik | Neden |
|---|---------|-------|
| - | Active Learning / Review Queue | Tek kullanıcı, gereksiz |
| - | Quality Dashboard | Gereksiz |
| - | Incremental Training | Azure desteklemiyor |

---

## 1. Cross-Document Anomaly Detection

### Amaç
Yeni analiz edilen dokümanların değerlerini geçmiş verilerle karşılaştırarak anormal değerleri tespit etmek.

### Teknik Tasarım

```javascript
// backend/src/services/ai-analyzer/pipeline/anomaly-detector.js

/**
 * Cross-Document Anomaly Detection
 * Z-score based anomaly detection using historical data
 */

const ANOMALY_FIELDS = [
  'kisi_sayisi',
  'isci_sayisi', 
  'ogun_sayisi',
  'iscilik_orani',
  'hizmet_gun_sayisi',
  'yaklasik_maliyet',
  'ogun_basi_fiyat'
];

const Z_SCORE_THRESHOLD = 2.0; // 2 standard deviations

async function detectAnomalies(extractedData, db) {
  const anomalies = [];
  
  // Get historical statistics (last 50 tenders)
  const stats = await db.query(`
    SELECT 
      field_name,
      AVG(CAST(value AS NUMERIC)) as avg,
      STDDEV(CAST(value AS NUMERIC)) as stddev,
      MIN(CAST(value AS NUMERIC)) as min,
      MAX(CAST(value AS NUMERIC)) as max,
      COUNT(*) as sample_count
    FROM tender_extracted_fields
    WHERE field_name = ANY($1)
      AND value ~ '^[0-9.]+$'
      AND created_at > NOW() - INTERVAL '6 months'
    GROUP BY field_name
    HAVING COUNT(*) >= 10
  `, [ANOMALY_FIELDS]);
  
  // Check each field
  for (const field of ANOMALY_FIELDS) {
    const value = extractedData[field];
    if (!value || isNaN(value)) continue;
    
    const stat = stats.find(s => s.field_name === field);
    if (!stat || stat.stddev === 0) continue;
    
    const zScore = Math.abs((value - stat.avg) / stat.stddev);
    
    if (zScore > Z_SCORE_THRESHOLD) {
      anomalies.push({
        field,
        value,
        expected: {
          avg: stat.avg,
          min: stat.min,
          max: stat.max,
          stddev: stat.stddev
        },
        zScore,
        severity: zScore > 3 ? 'critical' : 'warning',
        message: `${field}: ${value} değeri beklenen aralığın dışında (ort: ${stat.avg.toFixed(0)})`
      });
    }
  }
  
  return anomalies;
}

module.exports = { detectAnomalies, ANOMALY_FIELDS };
```

### Entegrasyon Noktası

`unified-pipeline.js` → `analyzeDocument()` sonunda:

```javascript
// After extraction complete
const anomalies = await detectAnomalies(result.extractedFields, db);
result.anomalies = anomalies;
result.hasAnomalies = anomalies.length > 0;
```

### UI Gösterimi

```
┌─────────────────────────────────────────────────────────┐
│ ⚠️ Anomali Tespit Edildi                               │
├─────────────────────────────────────────────────────────┤
│ kisi_sayisi: 50000                                      │
│ ├─ Beklenen aralık: 50 - 2500                          │
│ ├─ Ortalama: 450                                        │
│ └─ Bu değer ortalamanın 111x üzerinde                  │
│                                                         │
│ [Değeri Düzelt] [Yoksay] [Doğru İşaretle]              │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Deep Table Schema Analysis

### Amaç
Tabloları sadece sınıflandırmak yerine, iç yapısını (sütunlar, veri tipleri, ilişkiler) analiz etmek.

### Teknik Tasarım

```javascript
// backend/src/services/ai-analyzer/pipeline/table-schema-analyzer.js

/**
 * Deep Table Schema Analysis
 * Analyzes table structure, column types, and cross-table relationships
 */

const DATA_TYPES = {
  INTEGER: /^\d+$/,
  DECIMAL: /^\d+[.,]\d+$/,
  PERCENTAGE: /^\d+[.,]?\d*\s*%$/,
  CURRENCY: /^[\d.,]+\s*(TL|₺|tl)$/i,
  DATE: /^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/,
  TIME: /^\d{1,2}[:\.]\d{2}$/,
  GRAM: /^\d+\s*(gr?|gram|kg|lt|ml|adet)/i,
  TEXT: /.*/
};

async function analyzeTableSchema(table, allTables) {
  const schema = {
    tableIndex: table.index,
    tableType: table.type,
    rowCount: table.rowCount,
    columnCount: table.columnCount,
    columns: [],
    relationships: [],
    quality: {
      headerDetected: false,
      dataTypesConsistent: true,
      emptyCells: 0,
      duplicateRows: 0
    }
  };
  
  // Analyze each column
  for (let colIdx = 0; colIdx < table.columnCount; colIdx++) {
    const columnCells = table.cells.filter(c => c.columnIndex === colIdx);
    const header = columnCells.find(c => c.rowIndex === 0);
    const dataCells = columnCells.filter(c => c.rowIndex > 0);
    
    const values = dataCells.map(c => c.content?.trim()).filter(Boolean);
    const dataType = inferDataType(values);
    const unit = extractUnit(values);
    
    schema.columns.push({
      index: colIdx,
      header: header?.content || `Sütun ${colIdx + 1}`,
      dataType,
      unit,
      sampleValues: values.slice(0, 3),
      uniqueCount: new Set(values).size,
      emptyCount: dataCells.length - values.length,
      stats: dataType === 'INTEGER' || dataType === 'DECIMAL' ? {
        min: Math.min(...values.map(Number).filter(n => !isNaN(n))),
        max: Math.max(...values.map(Number).filter(n => !isNaN(n))),
        avg: values.map(Number).filter(n => !isNaN(n)).reduce((a, b) => a + b, 0) / values.length
      } : null
    });
  }
  
  // Detect header row
  schema.quality.headerDetected = schema.columns.every(col => 
    col.dataType === 'TEXT' || col.header !== col.sampleValues[0]
  );
  
  // Find cross-table relationships
  for (const otherTable of allTables) {
    if (otherTable.index === table.index) continue;
    
    for (const col of schema.columns) {
      for (const otherCol of otherTable.columns || []) {
        const similarity = calculateColumnSimilarity(col, otherCol);
        if (similarity > 0.7) {
          schema.relationships.push({
            sourceColumn: col.header,
            targetTable: otherTable.type,
            targetColumn: otherCol.header,
            similarity,
            relationshipType: inferRelationshipType(col, otherCol)
          });
        }
      }
    }
  }
  
  return schema;
}

function inferDataType(values) {
  if (values.length === 0) return 'TEXT';
  
  const typeCounts = {};
  for (const value of values) {
    for (const [type, regex] of Object.entries(DATA_TYPES)) {
      if (regex.test(value)) {
        typeCounts[type] = (typeCounts[type] || 0) + 1;
        break;
      }
    }
  }
  
  // Return most common type (excluding TEXT as fallback)
  const sorted = Object.entries(typeCounts)
    .filter(([t]) => t !== 'TEXT')
    .sort((a, b) => b[1] - a[1]);
  
  return sorted[0]?.[0] || 'TEXT';
}

function extractUnit(values) {
  const units = values.map(v => {
    const match = v.match(/(gr?|gram|kg|lt|ml|adet|kişi|porsiyon|TL|₺|%)/i);
    return match?.[1]?.toLowerCase();
  }).filter(Boolean);
  
  if (units.length === 0) return null;
  
  // Return most common unit
  const counts = {};
  units.forEach(u => counts[u] = (counts[u] || 0) + 1);
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

module.exports = { analyzeTableSchema };
```

### Çıktı Örneği

```json
{
  "tableType": "gramaj_tablosu",
  "columns": [
    {
      "header": "Yemek Adı",
      "dataType": "TEXT",
      "uniqueCount": 25
    },
    {
      "header": "Porsiyon",
      "dataType": "INTEGER",
      "unit": "gram",
      "stats": { "min": 50, "max": 250, "avg": 150 }
    },
    {
      "header": "Kişi Başı",
      "dataType": "INTEGER",
      "unit": "gram"
    }
  ],
  "relationships": [
    {
      "sourceColumn": "Yemek Adı",
      "targetTable": "haftalik_menu_1",
      "targetColumn": "Yemek",
      "similarity": 0.85
    }
  ]
}
```

---

## 3. Field Dependency Graph

### Amaç
Alanlar arasındaki mantıksal bağımlılıkları tanımlayarak eksik veya tutarsız verileri tespit etmek.

### Bağımlılık Kuralları

```javascript
// backend/src/services/ai-analyzer/pipeline/field-dependencies.js

const FIELD_DEPENDENCIES = {
  // Eğer A varsa, B olmalı
  requires: [
    { if: 'ogun_sayisi', then: 'kisi_sayisi', message: 'Öğün sayısı var ama kişi sayısı yok' },
    { if: 'isci_sayisi', then: 'personel_tablosu', message: 'İşçi sayısı var ama personel tablosu yok' },
    { if: 'haftalik_menu_1', then: 'gramaj_tablosu', message: 'Menü var ama gramaj tablosu yok' },
    { if: 'iscilik_orani', then: 'isci_sayisi', message: 'İşçilik oranı var ama işçi sayısı yok' },
    { if: 'kahvalti_var', then: 'ogun_sayisi', message: 'Kahvaltı var ama öğün sayısı yok' },
  ],
  
  // Mantıksal tutarlılık
  consistency: [
    {
      check: (data) => data.ogun_sayisi >= 1 && data.ogun_sayisi <= 5,
      message: 'Öğün sayısı 1-5 arasında olmalı'
    },
    {
      check: (data) => !data.iscilik_orani || (data.iscilik_orani >= 10 && data.iscilik_orani <= 50),
      message: 'İşçilik oranı %10-50 arasında olmalı'
    },
    {
      check: (data) => !data.kisi_sayisi || !data.isci_sayisi || (data.kisi_sayisi / data.isci_sayisi >= 10),
      message: 'Kişi başına işçi oranı düşük (min 1:10)'
    },
  ],
  
  // Hesaplanabilir alanlar
  computed: [
    {
      field: 'ogun_basi_maliyet',
      formula: (data) => data.yaklasik_maliyet && data.kisi_sayisi && data.hizmet_gun_sayisi && data.ogun_sayisi
        ? data.yaklasik_maliyet / (data.kisi_sayisi * data.hizmet_gun_sayisi * data.ogun_sayisi)
        : null,
      requires: ['yaklasik_maliyet', 'kisi_sayisi', 'hizmet_gun_sayisi', 'ogun_sayisi']
    },
    {
      field: 'gunluk_toplam_ogun',
      formula: (data) => data.kisi_sayisi && data.ogun_sayisi
        ? data.kisi_sayisi * data.ogun_sayisi
        : null,
      requires: ['kisi_sayisi', 'ogun_sayisi']
    }
  ]
};

function validateDependencies(extractedData, tables) {
  const issues = [];
  
  // Check requires
  for (const rule of FIELD_DEPENDENCIES.requires) {
    const hasIf = extractedData[rule.if] || tables.some(t => t.type === rule.if);
    const hasThen = extractedData[rule.then] || tables.some(t => t.type === rule.then);
    
    if (hasIf && !hasThen) {
      issues.push({
        type: 'missing_dependency',
        severity: 'warning',
        message: rule.message,
        fields: [rule.if, rule.then]
      });
    }
  }
  
  // Check consistency
  for (const rule of FIELD_DEPENDENCIES.consistency) {
    if (!rule.check(extractedData)) {
      issues.push({
        type: 'consistency',
        severity: 'warning',
        message: rule.message
      });
    }
  }
  
  // Compute derived fields
  const computed = {};
  for (const rule of FIELD_DEPENDENCIES.computed) {
    const value = rule.formula(extractedData);
    if (value !== null) {
      computed[rule.field] = value;
    }
  }
  
  return { issues, computed };
}

module.exports = { validateDependencies, FIELD_DEPENDENCIES };
```

### UI - Bağımlılık Grafiği

```
┌─────────────────────────────────────────────────────────────────┐
│ 📊 Alan Bağımlılık Grafiği                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   kisi_sayisi ─────┬───── ogun_sayisi                          │
│        │           │           │                                │
│        │           │           │                                │
│        ▼           ▼           ▼                                │
│   isci_sayisi   ogun_basi_maliyet   kahvalti_var               │
│        │              ▲                                         │
│        │              │                                         │
│        ▼              │                                         │
│   personel_tablosu ───┘                                        │
│                                                                 │
│   ⚠️ Eksik: gramaj_tablosu (menü var ama gramaj yok)           │
│   ✓ Hesaplandı: ogun_basi_maliyet = 45.50 TL                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Doküman Kümeleme + Dashboard

### Amaç
Benzer dokümanları gruplandırarak her küme için özelleştirilmiş analiz yapmak.

### Sayfa: `/dashboard/ai-center`

### Wireframe

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  🤖 AI Analiz Merkezi                                           [+ Küme]   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 📊 KÜMELER                                                          │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │                                                                      │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │   │
│  │  │ 🏥 Hastane   │  │ 🏫 Okul      │  │ 🏛️ Kamu     │               │   │
│  │  │ 23 doküman   │  │ 45 doküman   │  │ 18 doküman   │               │   │
│  │  │              │  │              │  │              │               │   │
│  │  │ Avg kişi:    │  │ Avg kişi:    │  │ Avg kişi:    │               │   │
│  │  │ 1250         │  │ 320          │  │ 85           │               │   │
│  │  │              │  │              │  │              │               │   │
│  │  │ Öğün: 4-5    │  │ Öğün: 1-2    │  │ Öğün: 1      │               │   │
│  │  │              │  │              │  │              │               │   │
│  │  │ [Düzenle]    │  │ [Düzenle]    │  │ [Düzenle]    │               │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘               │   │
│  │                                                                      │   │
│  │  ┌──────────────┐                                                   │   │
│  │  │ ➕ Yeni Küme │ ← Otomatik öneriler veya manuel oluştur          │   │
│  │  └──────────────┘                                                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 📄 YENİ DOKÜMAN ANALİZİ                                             │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │                                                                      │   │
│  │  Dosya: Teknik_Sartname_2024.pdf                                    │   │
│  │                                                                      │   │
│  │  🎯 Küme Tahmini:                                                   │   │
│  │  ┌────────────────────────────────────────────────┐                 │   │
│  │  │ 🏥 Hastane İhalesi    ████████████░░ 87%       │                 │   │
│  │  │ 🏫 Okul İhalesi       ███░░░░░░░░░░░ 8%        │                 │   │
│  │  │ 🏛️ Kamu Kurumu       ██░░░░░░░░░░░░ 5%        │                 │   │
│  │  └────────────────────────────────────────────────┘                 │   │
│  │                                                                      │   │
│  │  Analiz Seçenekleri:                                                │   │
│  │  ○ Hastane İhalesi olarak analiz et (önerilen)                      │   │
│  │  ○ Genel analiz (küme bazlı değil)                                  │   │
│  │  ○ Farklı küme seç: [Dropdown ▼]                                    │   │
│  │                                                                      │   │
│  │  [🚀 Analizi Başlat]                                                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 📈 KÜME İSTATİSTİKLERİ                                              │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │                                                                      │   │
│  │  Seçili Küme: 🏥 Hastane İhalesi                                    │   │
│  │                                                                      │   │
│  │  ┌─────────────────┬─────────────────┬─────────────────┐            │   │
│  │  │ Alan            │ Aralık          │ Ortalama        │            │   │
│  │  ├─────────────────┼─────────────────┼─────────────────┤            │   │
│  │  │ kisi_sayisi     │ 500 - 2500      │ 1250            │            │   │
│  │  │ isci_sayisi     │ 15 - 45         │ 28              │            │   │
│  │  │ ogun_sayisi     │ 4 - 5           │ 4.2             │            │   │
│  │  │ iscilik_orani   │ 20% - 35%       │ 27%             │            │   │
│  │  │ diyet_menu      │ -               │ %100 var        │            │   │
│  │  └─────────────────┴─────────────────┴─────────────────┘            │   │
│  │                                                                      │   │
│  │  Kümeye Özel Prompt:                                                │   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │ Bu bir HASTANE yemek ihalesidir. Özellikle dikkat et:       │   │   │
│  │  │ - Diyet menü zorunlu                                         │   │   │
│  │  │ - Gece yemeği ve sahur olabilir                              │   │   │
│  │  │ - Diyetisyen personeli gerekli                               │   │   │
│  │  │ - Hasta ve refakatçi sayıları ayrı olabilir                  │   │   │
│  │  └─────────────────────────────────────────────────────────────┘   │   │
│  │  [✏️ Prompt'u Düzenle]                                              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Teknik Tasarım

#### Database Schema

```sql
-- Kümeler
CREATE TABLE document_clusters (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  icon VARCHAR(10),
  description TEXT,
  custom_prompt TEXT,
  is_auto_generated BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Küme İstatistikleri
CREATE TABLE cluster_field_stats (
  id SERIAL PRIMARY KEY,
  cluster_id INTEGER REFERENCES document_clusters(id),
  field_name VARCHAR(50) NOT NULL,
  min_value NUMERIC,
  max_value NUMERIC,
  avg_value NUMERIC,
  sample_count INTEGER,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Doküman-Küme İlişkisi
CREATE TABLE document_cluster_assignments (
  id SERIAL PRIMARY KEY,
  document_id INTEGER NOT NULL,
  cluster_id INTEGER REFERENCES document_clusters(id),
  confidence NUMERIC(3,2),
  assigned_by VARCHAR(20), -- 'auto' | 'manual'
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### Backend API

```javascript
// routes/document-clusters.js

// GET /api/clusters - Tüm kümeleri listele
// GET /api/clusters/:id/stats - Küme istatistikleri
// POST /api/clusters - Yeni küme oluştur
// PUT /api/clusters/:id - Küme güncelle
// DELETE /api/clusters/:id - Küme sil

// POST /api/clusters/predict - Doküman için küme tahmin et
// POST /api/clusters/assign - Dokümana küme ata
// POST /api/clusters/auto-generate - Otomatik küme öner
```

#### Küme Tahmini (Embedding-based)

```javascript
// services/cluster-predictor.js

async function predictCluster(documentText, clusters) {
  // Get document embedding (first 2-3 pages)
  const docEmbedding = await getEmbedding(documentText.slice(0, 10000));
  
  // Compare with cluster centroids
  const predictions = [];
  for (const cluster of clusters) {
    const similarity = cosineSimilarity(docEmbedding, cluster.centroid);
    predictions.push({
      clusterId: cluster.id,
      name: cluster.name,
      confidence: similarity
    });
  }
  
  return predictions.sort((a, b) => b.confidence - a.confidence);
}

async function getEmbedding(text) {
  // Option 1: OpenAI embeddings
  // Option 2: Claude (no direct embedding, use classification)
  // Option 3: Local model (sentence-transformers)
  
  // For now, use Claude classification
  const response = await anthropic.messages.create({
    model: 'claude-3-haiku-20240307',
    max_tokens: 100,
    messages: [{
      role: 'user',
      content: `Bu ihale dokümanı hangi kategoriye girer? 
      Kategoriler: hastane, okul, kamu, özel sektör, diğer
      
      Doküman başlangıcı:
      ${text.slice(0, 3000)}
      
      JSON formatında cevap: {"category": "...", "confidence": 0.XX}`
    }]
  });
  
  return JSON.parse(response.content[0].text);
}
```

---

## Uygulama Sırası

```
Hafta 1-2: Cross-Document Anomaly Detection
  └─ anomaly-detector.js
  └─ unified-pipeline.js entegrasyonu
  └─ UI: Anomaly warning component

Hafta 3-4: Deep Table Schema
  └─ table-schema-analyzer.js
  └─ Table schema storage
  └─ UI: Table details panel

Hafta 5-6: Field Dependency
  └─ field-dependencies.js
  └─ Computed fields
  └─ UI: Dependency graph visualization

Hafta 7-10: Doküman Kümeleme Dashboard
  └─ Database schema
  └─ API endpoints
  └─ cluster-predictor.js
  └─ Frontend: /dashboard/ai-center page
  └─ Cluster management UI
  └─ Analysis with cluster context
```

---

## Notlar

- Embedding için şimdilik Claude classification kullanılacak, ileride OpenAI veya local model eklenebilir
- Dashboard Mantine UI ile yapılacak, mevcut tasarım diline uyumlu
- Anomaly ve dependency kontrolları her analizde otomatik çalışacak
- Kümeler hibrit: otomatik önerilecek, kullanıcı onaylayacak/düzenleyecek
