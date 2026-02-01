# API Tutarlılık Denetim Raporu

**Tarih:** 2026-02-01
**Durum:** Analiz Tamamlandı

## 📊 Genel Bakış

| Metrik | Değer |
|--------|-------|
| Frontend API Services | 14 dosya |
| Backend Route Files | 54 dosya |
| Aktif Route Mounts | 50+ |
| Deprecated Routes | 2 (notlar, tender-notes) |

## ✅ Doğru Yapılandırmalar

1. **Unified Notes System** - `notlar` ve `tender-notes` doğru şekilde deprecated, `notes` aktif
2. **API Limiter** - Tüm `/api` route'larına uygulanmış
3. **Auth Limiter** - `/api/auth` için ayrı rate limiting

## ⚠️ Tespit Edilen Sorunlar

### 1. Duplicate Route Mount
```javascript
// server.js:319-320
app.use('/api/documents', documentsRouter);
app.use('/api/documents', documentProxyRouter);
```
**Durum:** Express'te çalışır ama kafa karıştırıcı
**Öneri:** `documentProxyRouter`'ı `/api/documents/proxy` altına taşı

### 2. Frontend'de Service Olmayan Backend Route'ları
Aşağıdaki backend route'ları için frontend'de merkezi service yok:
- `bordro`, `bordro-import`
- `kasa-banka`
- `izin`
- `maas-odeme`
- `fiyat-yonetimi`
- `teklifler`
- `projeler`
- `maliyet-analizi`
- `tender-tracking`
- `prompt-builder`

**Not:** Bu route'lar muhtemelen component-level fetch ile çağrılıyor.

### 3. Response Format Tutarsızlıkları
Standart format: `{ success: boolean, data?: any, error?: string }`

Tutarsız dosyalar:
- `social.js` - 503 status ile proxy error handling (doğru)
- Bazı route'larda `success` field eksik

## 🔧 Önerilen Düzeltmeler

### Öncelik 1: Kritik
1. ~~Duplicate `/api/documents` mount'ı düzelt~~ (aslında sorun yok, farklı sub-route'lar)

### Öncelik 2: İyileştirme  
1. Eksik frontend service'leri oluştur (ihtiyaç duyulduğunda)
2. Response format standardizasyonu

### Öncelik 3: Temizlik
1. Kullanılmayan route dosyalarını archive et
2. Dead code elimination

## 📁 Route Mapping

### Aktif Routes (server.js'den)
```
/api/auth          → authRouter
/api/tenders       → tendersRouter
/api/documents     → documentsRouter, documentProxyRouter
/api/content       → contentExtractorRouter
/api/uyumsoft      → uyumsoftRouter
/api/ai            → aiRouter
/api/invoices      → invoicesRouter
/api/fatura-kalemleri → faturaKalemlerRouter
/api/sync          → syncRouter
/api/database-stats → databaseStatsRouter
/api/cariler       → carilerRouter
/api/etiketler     → etiketlerRouter
/api/satin-alma    → satinAlmaRouter
/api/ai/memory     → aiMemoryRouter
/api/duplicates    → duplicateCheckRouter
/api/stok          → stokRouter
/api/urunler       → urunlerRouter
/api/personel      → personelRouter
/api/bordro        → bordroRouter
/api/izin          → izinRouter
/api/export        → exportRouter
/api/import        → importRouter
/api/demirbas      → demirbasRouter
/api/kasa-banka    → kasaBankaRouter
/api/mutabakat     → mutabakatRouter
/api/bordro-import → bordroImportRouter
/api/maas-odeme    → maasOdemeRouter
/api/proje-hareketler → projeHareketlerRouter
/api/projeler      → projelerRouter
/api/planlama      → planlamaRouter
/api/menu-planlama → menuPlanlamaRouter
/api/teklifler     → tekliflerRouter
/api/notes         → unifiedNotesRouter
/api/firmalar      → firmalarRouter
/api/ihale-sonuclari → ihaleSonuclariRouter
/api/search        → searchRouter
/api/notifications → notificationsRouter
/api/tender-docs   → tenderDocumentsRouter
/api/tender-content → tenderContentDocumentsRouter
/api/tender-tracking → tenderTrackingRouter
/api/permissions   → permissionsRouter
/api/audit-logs    → auditLogsRouter
/api/mail          → mailRouter
/api/scraper       → scraperRouter
/api/maliyet-analizi → maliyetAnaliziRouter
/api/fiyat-yonetimi → fiyatYonetimiRouter
/api/tender-dilekce → tenderDilekceRouter
/api/social        → socialRouter
/api/system        → systemRouter
/api/prompt-builder → promptBuilderRouter
/api/preferences   → preferencesRouter
/api/daily-audit   → dailyAuditRouter
```

### Deprecated Routes (yorum satırı)
```
// /api/notlar      → unified notes'a taşındı
// /api/tender-notes → unified notes'a taşındı
```

## 🎯 Sonuç

API yapısı genel olarak tutarlı. Kritik sorun yok.
Minor iyileştirmeler ihtiyaç duyuldukça yapılabilir.
