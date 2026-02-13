# AI Pipeline Dokümantasyonu

> Son güncelleme: 2026-02-13 (kaynak: ai-pipeline-analysis.mdc doğrulanarak taşındı)

## Genel Bakış

Unified Pipeline, ihale dokümanlarını analiz eden tek merkezî sistemdir. Azure Document AI + Claude hibrit yaklaşımıyla PDF/DOCX/XLSX dosyalarından yapısal veri çıkarır.

## Pipeline Mimarisi

### Unified Pipeline (TEK GİRİŞ NOKTASI)
- **Dosya:** `backend/src/services/ai-analyzer/unified-pipeline.js` (~799 satır)
- **Fonksiyon:** `analyzeDocument(filePath, options)`
- **7 adım:** Azure Custom → Azure Layout → Claude Semantic → Birleştirme → Kritik Alan Validasyonu → Confidence → Rapor

### Zero-Loss Pipeline (Fallback - 8 Katman)
- **Dosya:** `backend/src/services/ai-analyzer/pipeline/index.js` (~1003 satır)

| Katman | Dosya | Satır | Görev |
|--------|-------|-------|-------|
| L0 | extractor.js | ~543 | Raw Capture (pdf-parse, mammoth, xlsx, Claude Vision OCR) |
| L1 | structure.js | ~701 | Rule-based yapı tespiti (LLM YOK) |
| L2 | chunker.js | ~555 | 6000 token/chunk, overlap yok, P0 kontrollü |
| L3 | analyzer.js | ~684 | 2 aşamalı (Opus paralel chunk → Opus birleştirme) |
| L4 | structure.js | — | Cross-reference resolution |
| L5 | conflict.js | ~358 | Çelişki TESPİT (çözmez, sadece raporlar) |
| L6 | assembler.js | ~613 | Birleştirme (yeni bilgi ekleme YASAK - P0-08) |
| L6.5 | — | — | Fill Missing Critical Fields |
| L7 | validator.js | ~338 | Ajv + P0 checks + completeness score |

### Provider Karar Ağacı
```
AZURE_USE_CUSTOM_MODEL=true? → Azure Custom Model → Başarılı? → +Claude zenginleştirme
                            → Başarısız? ↓
AZURE_DOCUMENT_AI_ENABLED=true? → Azure Layout → Başarılı? → +Claude zenginleştirme
                               → Başarısız? ↓
FALLBACK → Zero-Loss Pipeline (saf Claude, ~$1.50/50pg, ~90s)
```

## AI Modelleri (v9.1)

Tüm model referansları `backend/src/config/ai.config.js` (~203 satır) üzerinden yönetilir:

| Kullanım | Config Key | Varsayılan |
|----------|-----------|-----------|
| Chunk analizi (Stage 1) | `aiConfig.claude.fastModel` | claude-opus-4-6 |
| Birleştirme (Stage 2) | `aiConfig.claude.defaultModel` | claude-opus-4-6 |
| Derin analiz | `aiConfig.claude.analysisModel` | claude-opus-4-6 |
| OCR | Claude Vision | claude-opus-4-6 |
| Azure Custom | `AZURE_DOCUMENT_AI_MODEL_ID` | ihale-catering-v1 (kod default), ihale-catering-v5 (env) |
| Azure Layout | — | prebuilt-layout |

**max_tokens:** 8192 (config + hardcoded)
**temperature:** Config'de 0.2 tanımlı ama `analyzer.js`'de API çağrılarına **geçilmiyor** (API default 1.0 uygulanır — bilinen sorun)

## Prompt Sistemi (15+ dosya)

### Extraction Prompt'ları (6 adet)
- extract-full.js, extract-dates.js, extract-amounts.js
- extract-penalties.js, extract-menu.js, extract-personnel.js

### Stage Prompt'ları
- `catering-terminology.js`: ENHANCED_STAGE1_PROMPT + ENHANCED_STAGE2_PROMPT + sektör terminolojisi

### Doc-Type Prompt'ları (v9.1, 7 dosya)
- `prompts/doc-type/index.js`: detectDocType() + getDocTypePrompt()
- ilan-metni.js, idari-sartname.js, teknik-sartname.js
- sozlesme-tasarisi.js, mal-hizmet-listesi.js, birim-fiyat-cetveli.js
- Content dokümanlar → doc-type prompt, DOC/DOCX/PDF → generic ENHANCED_STAGE1_PROMPT

## Schema Zinciri
- `chunk-output.js` (~223 sat) → `document-output.js` (~389 sat) → `final-output.js` (~370 sat)
- Her seviyede source_chunk_id ile izlenebilirlik (P0-10)

## Kontrol Sistemi (5 dosya)

| Dosya | Satır | Görev |
|-------|-------|-------|
| p0-checks.js | ~702 | 10 kritik kontrol (tablo bütünlüğü, karakter kaybı, JSON valid, null/empty, yeni bilgi yasağı, conflict preservation, source traceability, numeric integrity) |
| field-validator.js | ~311 | 5 kritik alan (iletişim, teminat, servis saatleri, mali kriterler, tahmini bedel) + KNOWN_PLACEHOLDERS + isPlaceholder() |
| conflict-resolver.js | ~448 | Tablo önceliği → Detay tercih → Confidence skoru → Çoğunluk kuralı |
| quality-metrics.js | ~337 | PipelineMonitor sınıfı, stage timing, API tracking |
| controls/index.js | ~19 | Re-export hub |

## Azure Document AI
- `providers/azure-document-ai.js` (~1471 satır)
- Prebuilt-layout + Custom model desteği
- REST API (2024-11-30) + SDK formatı parse
- Query Fields desteği, retry/timeout/fallback
- Custom model: ihale-catering-v5 (neural, eğitildi)

## Doküman İşleme Altyapısı
- `document-download.js` (~153 sat): EKAP'tan ihalebul.com üzerinden indirme
- `document-storage.js` (~1640 sat): Supabase Storage (tender-documents bucket), ZIP açma
- `document-queue-processor.js` (~484 sat): DB-based kuyruk (PostgreSQL status field), concurrency=1
- `tender-scheduler.js` (~603 sat): node-cron ile periyodik liste/doküman scraping
- `tender-content-service.js` (~253 sat): İhale içerik yönetimi

## Test Dosyaları (7 adet)
- zero-loss.test.js, conflict.test.js, p0-checks.test.js, validator.test.js
- structure.test.js, chunker.test.js, assembler.test.js
- Framework: Vitest

## Dosya Haritası
```
backend/src/services/ai-analyzer/
├── unified-pipeline.js       ← TEK MERKEZİ SİSTEM (~799 sat)
├── index.js                  ← Public API + deprecated wrapper (~92 sat)
├── README.md
├── pipeline/
│   ├── index.js              ← Zero-Loss orchestrator (~1003 sat)
│   ├── hybrid-pipeline.js    ← Azure+Claude hibrit (~1270 sat)
│   ├── azure-pipeline.js     ← Saf Azure pipeline (~426 sat)
│   ├── extractor.js, structure.js, chunker.js, analyzer.js
│   ├── conflict.js, assembler.js, validator.js
├── controls/
│   ├── p0-checks.js, field-validator.js, conflict-resolver.js
│   ├── quality-metrics.js, index.js
├── prompts/
│   ├── extract-*.js (6 dosya), catering-terminology.js, index.js
│   └── doc-type/ (7 dosya)
├── schemas/
│   ├── chunk-output.js, document-output.js, final-output.js
│   ├── azure-training-schema.json, index.js
├── providers/
│   └── azure-document-ai.js (~1471 sat)
├── utils/
│   ├── parser.js, merge-results.js, table-helpers.js, index.js
└── tests/ (7 test dosyası)
```

## Kritik Riskler
1. **Temperature geçilmiyor** — analyzer.js API çağrılarında temperature parametresi yok
2. **Concurrency koruması yok** — Race condition riski
3. **Claude JSON mode kullanılmıyor** — Text + safeJsonParse ile parse
4. **Azure maliyet takibi yok** — Budget kontrolü mevcut değil
5. **OCR pdftoppm bağımlılığı** — Harici komut, health check yok
6. **Deprecated fonksiyonlar** — index.js temizlenmeli
7. **Custom model fallback** — Kod default'u v1, env'de v5 (karışıklık riski)
