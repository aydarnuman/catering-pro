# AI Chat, Agent & Tools Dokümantasyonu

> Son güncelleme: 2026-02-13 (kaynak: ai-chat-agent-analysis.mdc doğrulanarak taşındı)

## Genel Bakış

Sistem, Claude Tool Calling tabanlı bir AI agent + legacy chat servisi + 60+ tool'dan oluşur. Frontend'de tam sayfa chat ve floating widget bulunur.

## AI Servis Katmanı

### ai-agent.js (~1135 satır) — ANA SİSTEM
- Claude Tool Calling ile gerçek agent
- maxIterations=10 (loop koruması)
- Hafıza: `ai_memory` tablosu (fact/preference/pattern, top 30 by importance)
- Konuşma: `ai_conversations` tablosu (session bazlı, son 10 mesaj)
- Model: DB'den dinamik (varsayılan claude-opus-4-6)
- GOD MODE: super_admin için sınırsız yetki
- Context: sayfa bağlamı + ihale verisi + fiyat verisi otomatik eklenir

### claude-ai.js (~411 satır) — LEGACY
- Basit chat (tool calling YOK)
- Model: claude-opus-4-6
- 5 built-in şablon: default, cfo-analiz, risk-uzman, ihale-uzman, hizli-yanit
- Sadece `/api/ai/chat` endpoint'i için

### Diğer AI Servisleri
- yuklenici-ai.js (~209 sat): Yüklenici profil analizi, strateji tahmini
- instagram-ai.js (~663 sat): Instagram içerik üretimi (post/reel/story)
- invoice-ai.js (~326 sat): Doğal dil → SQL fatura sorguları
- prompt-builder-service.js (~413 sat): Wizard tabanlı prompt üretici

### ai.config.js (~203 satır) — TEK MERKEZİ CONFIG
- fastModel / defaultModel / analysisModel: hepsi claude-opus-4-6
- costTracking: Opus $0.015/$0.075 per 1K tokens
- queue.maxConcurrent: 4, pdf.parallelPages: 12

## AI Tools (11 modül, ~8,316 satır)

| Modül | Satır | Tool Sayısı | Kapsam |
|-------|-------|-------------|--------|
| index.js | ~1586 | 15 (GOD MODE) | Merkezi registry + god_* tools |
| menu-tools.js | ~1250 | ~10 | Reçete, maliyet, diyet, porsiyon |
| piyasa-tools.js | ~1038 | ~6 | Playwright ile canlı fiyat çekme |
| web-tools.js | ~889 | 3 | DuckDuckGo arama, mevzuat, URL okuma |
| personel-tools.js | ~762 | ~8 | Maaş, kıdem, SGK, vardiya |
| ihale-tools.js | ~678 | 8 | Liste, detay, analiz, karşılaştır, maliyet |
| satin-alma-tools.js | ~609 | ~7 | Sipariş CRUD, tedarikçi |
| rapor-tools.js | ~497 | ~6 | Günlük/haftalık/aylık raporlar |
| fatura-tools.js | ~465 | ~6 | Fatura CRUD, KDV raporu |
| cari-tools.js | ~377 | ~5 | Cari hesap, bakiye, ekstre |
| module-manifest.js | ~165 | — | Tool modül tanımları |

### GOD MODE Tools (15 adet, sadece super_admin)
- god_code_execute, god_sql_execute, god_file_read/write/list
- god_shell_execute, god_http_request, god_create_tool
- god_list/get/add/delete_secret, god_read_env
- god_github_api, god_supabase_storage

## Frontend AI Bileşenleri

### Chat
- AIChat.tsx (~1294 sat): Tam sayfa chat, compact/full modları
- FloatingAIChat.tsx (~1059 sat): Her sayfada floating widget, context algılama
- ai.ts (~526 sat): API servis katmanı

### Analiz Progress
- AnalysisContext.tsx (~308 sat): Arka plan analiz job yönetimi
- AnalysisWidget.tsx (~266 sat): Floating mini progress panel
- AnalysisProgressModal.tsx (~448 sat): Detaylı progress modal (timeline)
- AnalysisProgressPanel.tsx (~236 sat): İhale sayfası inline progress
- useAnalysisProgress.ts (~267 sat): SSE ile gerçek zamanlı progress

### Admin Sayfaları
- ayarlar/ai/page.tsx (~1812 sat): Şablon CRUD, model seçimi, hafıza, feedback, versiyon
- prompt-builder/page.tsx (~223 sat): Wizard prompt üretici
- prompt-builder/saved/page.tsx (~474 sat): Kayıtlı prompt galerisi
- analiz-kuyrugu/page.tsx (~477 sat): Queue dashboard (10s auto-refresh)

## Route'lar

### routes/ai.js (~2856 satır)
- /chat, /agent, /agent/tools, /agent/execute
- /templates (CRUD), /settings (CRUD + export/import/history/models)
- /analyze-product, /status, /modules, /feedback, /memory
- /learned-facts, /snapshot, /snapshots, /conversations (CRUD + search)
- /dashboard, /god-mode/execute, /god-mode/tools, /god-mode/logs
- /analyze-errors, /errors/recent
- /ihale-masasi/* (agent-action, analyze-all, analyze-agent, analysis/:tenderId, verdict, session/*)

### routes/ai-memory.js (~359 satır)
- Memory CRUD (/, /:id, /use/:id), /context, /conversation
- /conversation/:sessionId, /conversations/recent, /feedback, /learn

### routes/prompt-builder.js (~1198 satır)
- Categories, generate, save, gallery, optimize

### routes/content-extractor.js (~187 satır)
- PDF/CSV export

## Kritik Güvenlik Riskleri
1. **GOD MODE** — Raw SQL/Shell/File erişimi (sadece super_admin, ama çok güçlü)
2. **Agent rate limiting YOK**
3. **Token budget kontrolü YOK**
4. **Yazma işlemleri onaysız** (prompt kuralı var, enforce yok)
5. **Row-level security yok** (agent tüm tablolara erişir)
6. **Context injection riski** (frontend'den gelen systemContext)
7. **god_create_tool** — Self-replicating tool riski

## Toplam Kod
- Backend AI servisleri: ~3,200 satır
- Backend AI tools: ~8,316 satır
- Backend AI routes: ~4,600 satır
- Frontend AI: ~7,600+ satır
- **TOPLAM: ~23,700+ satır**
