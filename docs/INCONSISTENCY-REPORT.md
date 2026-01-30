# Dokümantasyon Tutarsızlık Raporu

> Analiz tarihi: Ocak 2026  
> Kapsam: 02_API_ENDPOINTS, 03_FRONTEND_MODULES, 01_DATABASE_SCHEMA ile kod karşılaştırması

Bu rapor, dokümantasyon taraması sırasında tespit edilen eksik/yanlış/güncel olmayan kısımları ve giderilen güncellemeleri özetler.

---

## 1. Giderilen Tutarsızlıklar (Dokümantasyon Güncellendi)

### 1.1 Auth (auth.js)
- **Doc’ta yoktu, koda vardı:** `POST /register`, `PUT /profile`, `POST /validate-password`, `POST /revoke-all`, `GET/PUT/DELETE /users`, `POST /setup-super-admin`, `PUT /users/:id/lock`, `PUT /users/:id/unlock`, `GET /users/:id/login-attempts`, `GET/DELETE /sessions`, `DELETE /sessions/other`, `GET/POST/PUT/DELETE /admin/ip-rules`. **Güncelleme:** 02_API_ENDPOINTS.md Auth bölümü bu endpoint’lerle güncellendi.
- **Doc’ta vardı, davranış farklı:** Login response’ta `refreshToken` artık body’de dönmüyor (sadece cookie). Doc’ta “Cookie + token” olarak not eklendi.
- **Deprecated:** `GET/PUT/DELETE /api/auth/admin/notifications*` → 307 redirect `/api/notifications`. Doc’ta [DEPRECATED] olarak işaretlendi.

### 1.2 Tenders (tenders.js)
- **Doc’ta yanlış path:** İhale güncelleme `PUT /api/tenders/:id` değil, **PATCH /api/tenders/:id**. Doc düzeltildi.
- **Doc’ta yoktu:** `GET /stats`, `GET /cities`, `POST /scrape`, `GET /scheduler/status`, `POST /scheduler/start`, `POST /scheduler/stop`, `GET /scrape/logs`, `GET /stats/detailed`, `GET /stats/updates`. Doc’a eklendi.
- **Query parametreleri:** Liste için `page`, `limit`, `status` (active/expired/urgent/archived/all) doc’ta güncellendi.

### 1.3 Invoices (invoices.js)
- **Doc’ta yoktu:** `PATCH /api/invoices/:id/status`, `GET /api/invoices/summary/monthly`, `GET /api/invoices/summary/category`. Doc’a eklendi.
- **Auth:** POST/PUT/DELETE için `requirePermission('fatura', …)` ve `auditLog` doc’ta belirtildi.

### 1.4 Cariler (cariler.js)
- **Doc’ta vardı, kodda yok:** `GET /api/cariler/:id/bakiye` — kodda yok; yerine `GET /api/cariler/:id/aylik-ozet` ve `GET /api/cariler/:id/ekstre` var. Doc’ta bakiye kaldırıldı, aylik-ozet ve ekstre eklendi.
- **Doc’ta vardı, kodda yok:** `POST /api/cariler/:id/hareketler` — cariler.js’te yok (hareketler cari_hareketler tablosundan okunuyor; ekleme farklı bir flow’da olabilir). Doc’ta POST hareketler kaldırıldı.
- **Pagination:** Doc’ta `page`, `limit`, `pagination` response alanları eklendi.

### 1.5 Stok (stok.js)
- **Büyük fark:** Eski doc “stok_kartlari” ve `GET /api/stok`, `GET /api/stok/:id` vb. yapıyı anlatıyordu. Kod **yeni yapıyı** kullanıyor: `urun_kartlari`, `urun_depo_durumlari`, `depolar`, `depo_lokasyonlar`; path’ler `/api/stok/depolar`, `/api/stok/kartlar`, `/api/stok/hareketler`, `/api/stok/kritik`, `/api/stok/faturalar`, `/api/stok/akilli-eslestir` vb. **Güncelleme:** 02_API_ENDPOINTS.md Stok bölümü kodla uyumlu olacak şekilde yeniden yazıldı.

### 1.6 Kasa-Banka (kasa-banka.js)
- **Path farkı:** Doc’ta `/api/kasa-banka`, `/api/kasa-banka/:id`, `/api/kasa-banka/:id/hareketler` vardı. Kodda path’ler: `/api/kasa-banka/hesaplar`, `/api/kasa-banka/hareketler`, `/api/kasa-banka/transfer`, `/api/kasa-banka/cek-senet`, `/api/kasa-banka/ozet`, `/api/kasa-banka/cariler`. Doc güncellendi.

### 1.7 Personel & Bordro
- **Personel:** personel.js içinde projeler, görevler, tazminat, atama route’ları da var. Doc’a projeler, görevler, tazminat, bordro (bordro.js path’leri) eklendi.
- **Bordro:** Path’ler doc’ta `hesapla`, `kaydet`, `toplu-hesapla`, `ozet/:yil/:ay`, `donem-sil`, `vergi-dilimleri/:yil`, `asgari-ucret/:yil` olarak güncellendi.

### 1.8 Planlama & Menü
- **Planlama:** planlama.js piyasa, market, ana-urunler, ambalaj route’ları doc’a eklendi.
- **Menü:** menu-planlama.js çok sayıda endpoint içeriyor; doc’ta özet tablo ile “detaylı path’ler route dosyasından okunabilir” notu eklendi.

### 1.9 AI (ai.js)
- **Doc’ta yoktu:** agent/tools, agent/execute, templates CRUD, settings (export/import/history/restore/model), memory, learned-facts, snapshot, conversations (list/search), dashboard, feedback, god-mode, analyze-errors, errors/recent. Doc’a eklendi.

### 1.10 Frontend (03_FRONTEND_MODULES)
- Dashboard: Kritik stok API’si `GET /api/stok/kritik` olarak düzeltildi.
- Upload sayfası ve API kullanımı eklendi.
- Modül sayısı 13, sayfa sayısı 35+ olarak güncellendi; API servisleri (`@/lib/api/services/*`) ve `API_BASE_URL` kullanan sayfalar not edildi.

---

## 2. Veritabanı Şeması Notları

- **01_DATABASE_SCHEMA.md** mevcut tabloları kategorize ediyor. Stok modülü için kod **urun_kartlari**, **urun_depo_durumlari**, **depolar**, **depo_lokasyonlar**, **urun_hareketleri**, **fatura_stok_islem**, **urun_tedarikci_eslestirme**, **urun_fiyat_gecmisi** kullanıyor. Şema doc’unda bu tabloların varlığı ve ilişkileri kontrol edilmeli; “stok_kartlari” eski isim ise doc’ta urun_kartlari ile uyumlu hale getirilmeli.
- **refresh_tokens:** auth.js `token_hash`, `device_info`, `ip_address`, `revoked_at` kullanıyor. Şemada bu kolonlar varsa doc’ta belirtilmeli.
- **ip_access_rules:** auth.js `type` (whitelist/blacklist), `is_active` kullanıyor. Şemada `type` veya `rule_type` farkı varsa not edilmeli.

---

## 3. [MISSING] / [DEPRECATED] Özeti

| Etiket | Açıklama |
|--------|----------|
| **[DEPRECATED]** | `/api/auth/admin/notifications*` — Yeni kodda `/api/notifications` kullanılmalı. |
| **[MISSING] (doc’ta yoktu)** | Auth: register, profile, validate-password, users CRUD, lock/unlock, login-attempts, sessions, revoke-all, setup-super-admin, admin/ip-rules. Tenders: stats, cities, scrape, scheduler/*, scrape/logs, stats/detailed, stats/updates. Invoices: PATCH status, summary/monthly, summary/category. Cariler: aylik-ozet, ekstre. Stok: depolar, kartlar, hareketler, faturalar, akilli-eslestir vb. Kasa-banka: hesaplar, hareketler, transfer, cek-senet, ozet, cariler. Personel: projeler, görevler, tazminat. Bordro: net-brut-hesapla, kaydet, toplu-hesapla, ozet/:yil/:ay, donem-sil, vergi-dilimleri, asgari-ucret. Planlama: piyasa/*, market/*, ana-urunler, ambalaj. AI: agent, templates, settings, memory, learned-facts, snapshot, conversations, dashboard, feedback, god-mode, analyze-errors. |
| **Doc’ta vardı, kodda yok** | `GET /api/cariler/:id/bakiye`, `POST /api/cariler/:id/hareketler`. Eski stok path’leri (`GET /api/stok`, `GET /api/stok/:id` vb.) — artık /api/stok/kartlar, /api/stok/depolar yapısı kullanılıyor. |

---

## 4. Öneriler

1. **01_DATABASE_SCHEMA.md:** Stok bölümünde `stok_kartlari` geçiyorsa `urun_kartlari` ile ilişki ve depo tabloları (depolar, urun_depo_durumlari) netleştirilsin.
2. **Gelir-gider:** Kasa-banka doc’unda “Gelir/gider (ayrı route varsa)” notu var; gelir-gider route’u varsa 02_API_ENDPOINTS’e eklenebilir.
3. **Realtime:** 02_API_ENDPOINTS’te “Supabase Realtime” bölümü var; ARCHITECTURE’da “Realtime kullanılmıyor” deniyor. Tek kaynakta netleştirilsin (kullanılıyorsa hangi tablolar, kullanılmıyorsa doc’tan kaldırılsın).
4. **Frontend API servisleri:** Tüm sayfaların hangi servisi kullandığı 03_FRONTEND_MODULES’ta özetlendi; gerekiyorsa her sayfa için “Kullanılan API’ler” satırı genişletilebilir.

---

*Bu rapor Faz 1–5 analizlerinden üretilmiştir.*
