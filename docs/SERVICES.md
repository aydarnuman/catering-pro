# Backend Servis Kataloğu

> Kaynak: `backend/src/services/`  
> Son Güncelleme: Ocak 2026

Bu doküman backend servis dosyalarının sorumluluklarını, public metodlarını ve hangi route’lar tarafından kullanıldığını özetler.

---

## Klasör Yapısı

```
backend/src/services/
├── ai-tools/           # AI agent araç modülleri (10 dosya)
│   ├── index.js        # Merkezi registry (aiAgent tarafından kullanılır)
│   ├── cari-tools.js
│   ├── fatura-tools.js
│   ├── ihale-tools.js
│   ├── menu-tools.js
│   ├── personel-tools.js
│   ├── piyasa-tools.js
│   ├── rapor-tools.js
│   ├── satin-alma-tools.js
│   └── web-tools.js
├── admin-notification-service.js
├── ai-agent.js
├── ambalajParser.js
├── audit-service.js
├── bordro-import-service.js
├── bordro-template-service.js
├── claude-ai.js
├── claude.js
├── cost-tracker.js
├── document-analyzer.js
├── document-download.js
├── document-queue-processor.js
├── document-storage.js
├── document.js
├── duplicate-detector.js
├── export-service.js
├── fatura-kalemleri-client.js
├── firma-belge-service.js
├── import-service.js
├── instagram-ai.js
├── invoice-ai.js
├── login-attempt-service.js
├── mail-service.js
├── market-scraper.js
├── menu-import.js
├── permission-service.js
├── prompt-builder-service.js
├── reminder-notification-scheduler.js
├── session-service.js
├── settings-version-service.js
├── sync-scheduler.js
├── system-monitor.js
├── tazminat-service.js
├── tender-content-service.js
├── tender-scheduler.js
├── unified-notification-service.js
└── uyumsoft-sales.js
```

---

## Auth & Oturum

| Servis | Sorumluluk | Public / Kullanım | Route Kullanımı |
|--------|------------|-------------------|-----------------|
| **login-attempt-service.js** | Başarısız giriş sayacı, hesap kilitleme | checkLockStatusByEmail, recordFailedLogin, recordSuccessfulLogin, lockAccount, unlockAccount, getUserStatus, getLoginHistory | auth.js |
| **session-service.js** | Oturum CRUD (user_sessions), aktivite güncelleme | createSession, updateSessionActivity, getUserSessions, getSessionByToken, terminateSession, terminateOtherSessions | auth.js |
| **permission-service.js** | Yetki kontrolü (permissions, user_permissions) | checkPermission, getUserPermissions, getPermissionByCode | middleware/auth.js, permissions route |

---

## AI & Döküman Analizi

| Servis | Sorumluluk | Public / Kullanım | Route Kullanımı |
|--------|------------|-------------------|-----------------|
| **ai-agent.js** | Claude tabanlı agent, chat streaming, tool execution | chat, agentChat, getToolDefinitions, getSystemContext | ai.js |
| **claude-ai.js** | Claude API wrapper (streaming, messages) | chat, streamChat | ai-agent.js |
| **claude.js** | Döküman/PDF/Excel analizi, OCR, normalizeCity, analyzeFile | analyzePdfWithClaude, analyzeImageFile, analyzeDocxFile, analyzeExcelFile, analyzeWithClaude, analyzeFile, getFileType, normalizeCity | document.js, document-analyzer, ai, ihale analizi |
| **document-analyzer.js** | Gemini ile metin/görüntü analizi, ambalaj parse, normalizeCity | analyzeDocument, analyzeImageWithGemini, parseAmbalajWithAI, normalizeCity | document.js, menu-planlama (AI malzeme) |
| **prompt-builder-service.js** | Prompt şablonları, kategoriler, kayıtlı promptlar | getCategories, getTemplatesByCategorySlug, getTemplateById, generatePrompt, savePrompt, getSavedPrompts, incrementTemplateUsage | prompt-builder.js |
| **instagram-ai.js** | Instagram içerik üretimi (caption, hashtag, menü kartı, Replicate görsel) | generateInstagramCaption, generateHashtags, analyzeDMAndSuggestReply, generateMenuPost, generateImagePrompt, generateImageWithReplicate, generateMenuCardTemplate | social.js (Instagram) |
| **invoice-ai.js** | Fatura doğal dil sorgusu (parse + execute + format) | parseInvoiceQuery, executeInvoiceQuery, formatInvoiceResponse | ai.js (agent tools üzerinden) |
| **cost-tracker.js** | AI kullanım maliyet takibi | trackAIUsage, checkDailyBudget, getUsageReport, getMonthlyCost, getUserStats, getEndpointStats | ai.js (middleware/route içi) |

---

## AI Araçları (ai-tools/)

| Modül | Sorumluluk | Route / Kullanım |
|-------|------------|-------------------|
| **index.js** | Tüm modül tanımlarını toplar; getToolDefinitions, executeTool, getSystemContext | ai-agent.js |
| **cari-tools.js** | Cari listele, detay, bakiye, hareketler | AI agent (cari modülü) |
| **fatura-tools.js** | Fatura sorguları, istatistikler | AI agent (fatura modülü) |
| **ihale-tools.js** | İhale listele, detay, takip | AI agent (ihale modülü) |
| **menu-tools.js** | Reçete, maliyet, gramaj, menü önerisi | AI agent (menü modülü) |
| **personel-tools.js** | Personel, izin, bordro sorguları | AI agent (personel modülü) |
| **piyasa-tools.js** | Fiyat, döviz, enflasyon | AI agent (piyasa modülü) |
| **rapor-tools.js** | Rapor üretimi | AI agent |
| **satin-alma-tools.js** | Satın alma talepleri, sipariş, tedarikçi | AI agent (satin_alma modülü) |
| **web-tools.js** | Web arama, fetch, scrape | AI agent (web modülü) |

---

## Döküman & Depolama

| Servis | Sorumluluk | Public / Kullanım | Route Kullanımı |
|--------|------------|-------------------|-----------------|
| **document-storage.js** | Supabase Storage upload/download, path yönetimi | upload, download, getPublicUrl, deleteFile | documents.js, tender-documents, document-proxy |
| **document.js** | Döküman işleme (processDocument, downloadFromSupabase, processContentDocument) | processDocument, downloadFromSupabase, processContentDocument | documents, content-extractor |
| **document-download.js** | İhale döküman indirme, ZIP, cleanup | downloadDocumentsForTender, getDownloadStatus | tender-documents.js |
| **document-queue-processor.js** | Kuyruk tabanlı döküman analizi | addJob, processQueue, getStatus | documents, scraper pipeline |
| **tender-content-service.js** | İhale içerik dökümanları (announcement, goods_services, zeyilname) | getContent, saveContent, getContentTypes | tender-content-documents.js |

---

## Muhasebe & Fatura

| Servis | Sorumluluk | Public / Kullanım | Route Kullanımı |
|--------|------------|-------------------|-----------------|
| **fatura-kalemleri-client.js** | Fatura kalemleri API (fatura_kalemleri tablosu), kategori özeti | getKalemler, getKalemSayilari, getKategoriOzetSummary | invoices.js, stok.js, fatura-kalemler.js |
| **uyumsoft-sales.js** | Uyumsoft fatura/müşteri API entegrasyonu | getInboxInvoices, getInvoiceData, vb. | uyumsoft.js, stok (akilli-kalemler) |

---

## Bordro & İK

| Servis | Sorumluluk | Public / Kullanım | Route Kullanımı |
|--------|------------|-------------------|-----------------|
| **bordro-import-service.js** | Bordro Excel import, eşleştirme, tahakkuk kaydetme | analyzeBordroFile, saveBordroRecords, getProjePersonelleri, getTahakkuk, createPersonelFromBordro | bordro-import.js |
| **bordro-template-service.js** | Bordro Excel şablon tanıma ve parse | listTemplates, saveTemplate, findTemplateBySignature, parseWithTemplate | bordro-import-service.js |
| **tazminat-service.js** | Tazminat/ihbar hesaplama, kayıt, personel çıkış, risk | hesaplaTazminat, kaydetTazminatHesabi, personelCikisYap, hesaplaTazminatRiski | personel.js (tazminat route’ları) |

---

## İhale & Scraper

| Servis | Sorumluluk | Public / Kullanım | Route Kullanımı |
|--------|------------|-------------------|-----------------|
| **tender-scheduler.js** | İhale scraper zamanlama, manuel scrape, loglar, istatistikler | start, stop, triggerManualScrape, getStatus, getScrapeLogs, getTenderStats | tenders.js |

---

## Bildirim & Mail

| Servis | Sorumluluk | Public / Kullanım | Route Kullanımı |
|--------|------------|-------------------|-----------------|
| **unified-notification-service.js** | Bildirim CRUD, okundu işaretleme, filtreleme | getNotifications, markAsRead, markAllAsRead, create, getUnreadCount | notifications.js |
| **admin-notification-service.js** | Admin bildirimleri (unified ile birleştirilmiş; redirect) | - | auth.js (redirect) |
| **reminder-notification-scheduler.js** | Hatırlatma zamanlayıcı (cron) | start, scheduleReminders | Server başlangıç |
| **mail-service.js** | E-posta gönderimi | sendMail, sendBulk | mail.js, export, bildirimler |

---

## Sistem & Audit

| Servis | Sorumluluk | Public / Kullanım | Route Kullanımı |
|--------|------------|-------------------|-----------------|
| **audit-service.js** | Audit log yazma (audit_logs tablosu) | log(action, module, details, userId) | Middleware auditLog; invoices, cariler, personel, stok, vb. |
| **permission-service.js** | Yetki kontrolü | checkPermission, getUserPermissions | middleware requirePermission |
| **settings-version-service.js** | Ayarlar sürümleme (import/export, restore) | getHistory, getVersion, restore | ai.js (settings) |
| **system-monitor.js** | Sistem izleme, health | getStats, getLogs | system.js |

---

## Export / Import

| Servis | Sorumluluk | Public / Kullanım | Route Kullanımı |
|--------|------------|-------------------|-----------------|
| **export-service.js** | Excel/PDF oluşturma (personel, fatura, cari, stok, dilekçe), sendMail | createExcel, createPDF, createPersonelExcel, createFaturaExcel, createCariExcel, createStokExcel, createDilekcePDF, sendMail | export.js |
| **import-service.js** | CSV/Excel import (şema, analiz, onay, kaydet), menü döküman parse | processImport, confirmImport, getSchema, getAllSchemas, analyzeMenuDocument, saveMenuAsRecipes | import.js, menu-planlama (import) |
| **menu-import.js** | Menü Excel/PDF/görsel parse | parseExcelMenu, parsePdfMenu, parseImageMenu | import-service.js |

---

## Piyasa & Market

| Servis | Sorumluluk | Public / Kullanım | Route Kullanımı |
|--------|------------|-------------------|-----------------|
| **market-scraper.js** | Piyasa fiyatı arama (tarayıcı tabanlı) | searchMarketPrices, quickSearch, getAvailableMarkets, closeBrowser | planlama.js (market/collect, piyasa) |
| **ambalajParser.js** | Ambalaj metni parse (regex + AI) | parseWithRegex, parseWithAI, smartParse, batchParse | planlama.js (ambalaj-parse, stok-karti ambalaj) |

---

## Diğer Servisler

| Servis | Sorumluluk | Public / Kullanım | Route Kullanımı |
|--------|------------|-------------------|-----------------|
| **duplicate-detector.js** | Duplicate kontrolü (ihale/cari vb.) | checkDuplicate, findDuplicates | duplicate-check.js |
| **firma-belge-service.js** | Firma belgesi analizi (AI) | analyzeFirmaBelgesi, getDesteklenenBelgeTipleri | - |
| **sync-scheduler.js** | Genel senkronizasyon cron | start, runSync, getStatus | sync.js |

---

## Bağımlılık Özeti

- **database.js** (query, transaction): Çoğu servis ve route doğrudan kullanır.
- **ai-agent.js** → claude-ai.js, ai-tools/index.js, cost-tracker, permission-service, settings-version-service.
- **document.js** → claude.js, document-analyzer.js, document-storage.js.
- **auth.js (route)** → login-attempt-service, session-service.
- **invoices.js, stok.js, fatura-kalemler.js** → fatura-kalemleri-client.js.
- **bordro-import.js** → bordro-import-service.js → bordro-template-service.js.
- **planlama.js** → market-scraper.js, ambalajParser.js.
- **tenders.js** → tender-scheduler.js.

---

*Bu katalog `backend/src/services/` ve route dosyalarından türetilmiştir.*
