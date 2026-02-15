# Backend API Endpoint Analizi

> Tarih: 2026-02-15 | Toplam: **~680 endpoint** | **78 route dosyası** | **57 mount noktası**

---

## 1. Endpoint Haritası

### 1.1 Auth (`/api/auth`) — 30 endpoint
**Dosya:** `auth.js` | **Auth:** `authLimiter` (rate limit)

| Method | Path | Satır | Açıklama |
|--------|------|-------|----------|
| POST | /login | 78 | Kullanıcı girişi |
| POST | /register | 243 | Yeni kullanıcı kaydı |
| GET | /me | 299 | Mevcut kullanıcı bilgisi |
| GET | /firmalar | 330 | Kullanıcının erişebildiği firmalar |
| POST | /switch-firma | 357 | Aktif firma değiştir |
| PUT | /profile | 409 | Profil güncelle |
| PUT | /password | 440 | Şifre değiştir |
| POST | /logout | 485 | Çıkış yap |
| POST | /refresh | 523 | Token yenile |
| POST | /revoke-all | 607 | Tüm oturumları kapat |
| POST | /validate-password | 634 | Şifre güçlülük kontrolü |
| GET | /users | 651 | Kullanıcıları listele (Admin) |
| PUT | /users/:id | 711 | Kullanıcı güncelle (Admin) |
| DELETE | /users/:id | 809 | Kullanıcı sil (Admin) |
| POST | /setup-super-admin | 837 | İlk super admin ataması |
| PUT | /users/:id/lock | 873 | Hesabı kilitle (Admin) |
| PUT | /users/:id/unlock | 900 | Hesabı aç (Admin) |
| GET | /users/:id/login-attempts | 926 | Login geçmişi (Admin) |
| GET | /admin/notifications | 959 | Bildirimler (redirect → notifications) |
| GET | /admin/notifications/unread-count | 964 | Okunmamış sayısı (redirect) |
| PUT | /admin/notifications/:id/read | 969 | Okundu işaretle (redirect) |
| PUT | /admin/notifications/read-all | 974 | Tümünü okundu (redirect) |
| DELETE | /admin/notifications/:id | 979 | Bildirim sil (redirect) |
| GET | /sessions | 986 | Aktif oturumlar |
| DELETE | /sessions/:id | 1014 | Oturum sonlandır |
| DELETE | /sessions/other | 1055 | Diğer oturumları sonlandır |
| GET | /admin/ip-rules | 1081 | IP kuralları (Admin) |
| POST | /admin/ip-rules | 1128 | IP kuralı ekle (Admin) |
| PUT | /admin/ip-rules/:id | 1169 | IP kuralı güncelle (Admin) |
| DELETE | /admin/ip-rules/:id | 1233 | IP kuralı sil (Admin) |

---

### 1.2 İhale/Tender (`/api/tenders`) — 13 endpoint
**Dosya:** `tenders.js` | **Auth:** Yok

| Method | Path | Satır | Açıklama |
|--------|------|-------|----------|
| GET | / | 37 | İhale listesi (pagination + filtre) |
| GET | /stats | 210 | İstatistikler |
| GET | /cities | 245 | Şehir listesi |
| GET | /:id | 266 | İhale detayı |
| PATCH | /:id | 293 | İhale güncelle |
| DELETE | /:id | 356 | İhale sil |
| POST | /scrape | 377 | Manuel scrape tetikle |
| GET | /scheduler/status | 405 | Scheduler durumu |
| POST | /scheduler/start | 421 | Scheduler başlat |
| POST | /scheduler/stop | 437 | Scheduler durdur |
| GET | /scrape/logs | 453 | Scrape logları |
| GET | /stats/detailed | 472 | Detaylı istatistikler |
| GET | /stats/updates | 489 | Son güncelleme istatistikleri |

---

### 1.3 Dökümanlar — 32 endpoint (4 dosya)

#### documents.js (`/api/documents`) — 8 endpoint | Auth: Yok
| Method | Path | Satır | Açıklama |
|--------|------|-------|----------|
| POST | /upload | 74 | Döküman yükle |
| POST | /analyze | 223 | Claude AI ile analiz (SSE) |
| GET | /supported-formats | 369 | Desteklenen formatlar |
| GET | / | 378 | Döküman listesi |
| GET | /queue/progress | 403 | Kuyruk progress (SSE) |
| GET | /:id | 427 | Döküman detayı |
| POST | /fix-storage | 447 | Storage URL düzeltme |
| DELETE | /:id | 539 | Döküman sil |

#### document-proxy.js (`/api/documents`) — 3 endpoint | Auth: Yok
| Method | Path | Satır | Açıklama |
|--------|------|-------|----------|
| GET | /download/:tenderId/:type | 12 | Proxy ile döküman indir |
| GET | /list/:tenderId | 127 | İhale döküman listesi |
| POST | /scrape/:tenderId | 235 | İhale dökümanlarını scrape et |

#### tender-documents.js (`/api/tender-docs`) — 9 endpoint | Auth: Yok
| Method | Path | Satır | Açıklama |
|--------|------|-------|----------|
| POST | /:tenderId/merkez-scraper | 67 | Merkez scraper |
| POST | /:tenderId/download-documents | 70 | Döküman indir (eski, redirect) |
| GET | /:tenderId/downloaded-documents | 76 | İndirilen dökümanlar |
| GET | /documents/:documentId | 117 | Döküman detayı |
| GET | /documents/:documentId/url | 155 | İmzalı URL |
| GET | /documents/:documentId/convert | 185 | DOC→HTML dönüştür |
| POST | /documents/:documentId/queue | 361 | Kuyruğa ekle |
| POST | /documents/queue-multiple | 384 | Toplu kuyruğa ekle |
| GET | /:tenderId/download-status | 414 | İndirme durumu |

#### tender-content-documents.js (`/api/tender-content`) — 12 endpoint | Auth: Yok
| Method | Path | Satır | Açıklama |
|--------|------|-------|----------|
| POST | /:tenderId/create-documents | 32 | İçerik dökümanı oluştur |
| GET | /:tenderId/documents | 55 | Content dökümanları |
| POST | /documents/:documentId/queue | 81 | Kuyruğa ekle |
| GET | /:tenderId/all-documents | 104 | Tüm dökümanlar |
| GET | /queue/status | 135 | Queue durumu |
| POST | /queue/process | 155 | Manuel queue işleme |
| POST | /documents/:documentId/analyze | 178 | Döküman analiz (stream) |
| POST | /analyze-batch | 282 | Toplu analiz |
| POST | /documents/reset-failed | 496 | Hatalı dökümanları sıfırla |
| POST | /documents/reset | 539 | Dökümanları sıfırla |
| DELETE | /:tenderId/documents | 601 | Dökümanları sil |
| POST | /:tenderId/clear-analysis | 697 | Analizleri temizle |

---

### 1.4 İçerik Çıkarma (`/api/content`) — 3 endpoint
**Dosya:** `content-extractor.js` | **Auth:** Yok

| Method | Path | Satır | Açıklama |
|--------|------|-------|----------|
| GET | /announcement/:tenderId | 21 | İhale ilanı PDF |
| GET | /goods-services/:tenderId | 101 | Mal/Hizmet listesi CSV |
| GET | /status/:tenderId | 160 | İçerik durumu |

---

### 1.5 AI — 54 endpoint (6 dosya)

#### ai.js (`/api/ai`) — 40 endpoint | Auth: optionalAuth (bazıları admin)
| Method | Path | Satır | Açıklama |
|--------|------|-------|----------|
| POST | /chat | 35 | AI sohbet (eski) |
| POST | /agent | 136 | AI Agent (tool calling) |
| GET | /agent/tools | 202 | Tool listesi |
| POST | /agent/execute | 229 | Tool çalıştır |
| GET | /templates | 258 | Prompt şablonları |
| GET | /templates/:id | 333 | Şablon detayı |
| POST | /templates | 370 | Şablon oluştur (Admin) |
| PUT | /templates/:id | 438 | Şablon güncelle (Admin) |
| DELETE | /templates/:id | 494 | Şablon sil (Admin) |
| POST | /templates/:id/increment-usage | 536 | Kullanım sayacı |
| POST | /analyze-product | 560 | Ürün analizi |
| POST | /analyze-products-batch | 606 | Toplu ürün analizi |
| GET | /status | 664 | AI servis durumu |
| GET | /modules | 698 | Modül listesi |
| GET | /settings | 721 | AI ayarları |
| PUT | /settings | 768 | Ayar güncelle (Admin) |
| GET | /settings/export | 843 | Ayar export (Admin) |
| POST | /settings/import | 906 | Ayar import (Admin) |
| GET | /settings/history | 1045 | Ayar geçmişi (Admin) |
| GET | /settings/history/:settingKey/:version | 1076 | Versiyon detayı |
| POST | /settings/restore/:settingKey/:version | 1106 | Versiyon geri yükle |
| GET | /settings/models | 1140 | AI modelleri |
| PUT | /settings/model | 1173 | Model değiştir (Admin) |
| POST | /feedback | 1234 | Geri bildirim kaydet |
| GET | /feedback/stats | 1306 | Feedback istatistikleri |
| GET | /feedback/template-rankings | 1350 | Template performansı |
| GET | /feedback/model-rankings | 1364 | Model performansı |
| GET | /memory | 1382 | AI hafıza |
| POST | /memory | 1432 | Hafıza ekle |
| DELETE | /memory/:id | 1475 | Hafıza sil (Admin) |
| GET | /learned-facts | 1505 | Öğrenilen bilgiler |
| PUT | /learned-facts/:id/verify | 1555 | Bilgi onayla |
| POST | /snapshot | 1604 | Sistem özeti oluştur |
| GET | /snapshots | 1626 | Özetler |
| GET | /conversations | 1663 | Sohbet listesi |
| GET | /conversations/list | 1736 | Prefix ile filtrele |
| GET | /conversations/search | 1811 | Sohbet ara |
| GET | /conversations/:sessionId | 1861 | Oturum detayı |
| DELETE | /conversations/:sessionId | 1921 | Oturum sil |
| GET | /dashboard | 1965 | AI Dashboard metrikleri |
| POST | /shared-learnings | 2050 | Ajanlar arası bilgi paylaş |
| GET | /shared-learnings/:agentId | 2082 | Paylaşılan öğrenmeler |

#### ai-ihale-masasi.js (`/api/ai/ihale-masasi`) — 12 endpoint
| Method | Path | Satır | Açıklama |
|--------|------|-------|----------|
| POST | /agent-action | 37 | Agent bazlı AI aksiyon |
| POST | /analyze-all | 131 | 4 agent paralel analiz |
| POST | /analyze-agent | 163 | Tek agent analiz |
| GET | /analysis/:tenderId | 202 | Cache'den analiz yükle |
| POST | /verdict | 226 | AI verdict üret |
| POST | /session/save | 265 | Oturum kaydet |
| GET | /session/:tenderId | 291 | Oturum geçmişi |
| POST | /match-ingredients | 321 | Malzeme eşleştir |
| POST | /save-ingredient-matches | 532 | Eşleştirme kaydet |
| GET | /ingredient-matches/:tenderId | 574 | Kaydedilmiş eşleştirmeler |
| POST | /outcome | 615 | İhale sonucu kaydet |
| GET | /outcomes | 710 | Tüm sonuçlar |

#### ai-god-mode.js (`/api/ai/god-mode`) — 3 endpoint
| Method | Path | Satır | Açıklama |
|--------|------|-------|----------|
| POST | /execute | 22 | God Mode çalıştır (Super Admin) |
| GET | /tools | 85 | Tool listesi |
| GET | /logs | 137 | İşlem logları |

#### ai-analysis.js (`/api/ai`) — 4 endpoint
| Method | Path | Satır | Açıklama |
|--------|------|-------|----------|
| POST | /analyze-errors | 26 | Frontend hata analizi |
| GET | /errors/recent | 108 | Son hatalar |
| POST | /card-transform | 144 | Kart dönüşümü |
| POST | /cross-analysis | 217 | Çapraz analiz |

#### ai-memory.js (`/api/ai/memory`) — 14 endpoint
| Method | Path | Satır | Açıklama |
|--------|------|-------|----------|
| GET | / | 12 | Hafızaları getir |
| GET | /context | 58 | Context getir |
| GET | /:id | 114 | Tek hafıza |
| POST | / | 129 | Hafıza ekle |
| PUT | /:id | 160 | Hafıza güncelle |
| DELETE | /:id | 190 | Hafıza sil |
| POST | /use/:id | 205 | Kullanım güncelle |
| POST | /conversation | 229 | Konuşma kaydet |
| GET | /conversation/:sessionId | 253 | Konuşma geçmişi |
| GET | /conversations/recent | 274 | Son konuşmalar |
| POST | /feedback | 303 | Geri bildirim |
| POST | /learn | 323 | Öğrenme kaydet |
| GET | /semantic-search | 365 | Semantik arama |
| POST | /backfill-embeddings | 380 | Toplu embedding |

---

### 1.6 Agents (`/api/agents`) — 12 endpoint
**Dosya:** `agents.js` | **Auth:** `authenticate`

| Method | Path | Satır | Açıklama |
|--------|------|-------|----------|
| GET | / | 51 | Agent listesi |
| GET | /context/:contextKey | 81 | Bağlama göre agentlar |
| GET | /:slug | 144 | Agent detayı |
| PUT | /:slug | 221 | Agent güncelle (Admin) |
| GET | /:slug/tools | 326 | Tool listesi |
| POST | /:slug/tools | 354 | Tool ekle (Admin) |
| PUT | /:slug/tools/:toolSlug | 414 | Tool güncelle (Admin) |
| DELETE | /:slug/tools/:toolSlug | 483 | Tool sil (Admin) |
| GET | /:slug/knowledge | 518 | Bilgi kaynakları |
| POST | /:slug/knowledge | 554 | Kaynak ekle |
| PUT | /:slug/knowledge/:id | 611 | Kaynak güncelle |
| DELETE | /:slug/knowledge/:id | 667 | Kaynak sil |

---

### 1.7 Fatura — 26 endpoint (2 dosya)

#### invoices.js (`/api/invoices`) — 9 endpoint | Auth: Yok
| Method | Path | Satır | Açıklama |
|--------|------|-------|----------|
| GET | /stats | 22 | Fatura istatistikleri |
| GET | / | 61 | Fatura listesi |
| GET | /:id | 176 | Fatura detayı |
| POST | / | 215 | Fatura oluştur |
| PUT | /:id | 314 | Fatura güncelle |
| PATCH | /:id/status | 421 | Durum güncelle |
| DELETE | /:id | 460 | Fatura sil |
| GET | /summary/monthly | 495 | Aylık özet |
| GET | /summary/category | 543 | Kategori özeti |

#### fatura-kalemler.js (`/api/fatura-kalemleri`) — 17 endpoint | Auth: Yok
| Method | Path | Satır | Açıklama |
|--------|------|-------|----------|
| GET | /faturalar | 28 | Fatura kalem özetleri |
| GET | /faturalar/:ettn/kalemler | 92 | Fatura kalemleri |
| POST | /faturalar/:ettn/kalemler/:sira/eslesdir | 385 | Kalemi eşleştir |
| POST | /faturalar/:ettn/toplu-eslesdir | 515 | Toplu eşleştir |
| POST | /faturalar/:ettn/otomatik-eslesdir | 560 | Otomatik eşleştir |
| DELETE | /faturalar/:ettn/kalemler/:sira/eslesme | 638 | Eşleştirme kaldır |
| GET | /urunler/ara | 668 | Ürün ara |
| GET | /urunler/oneriler | 721 | Ürün önerileri |
| POST | /urunler/hizli-olustur | 790 | Hızlı ürün oluştur |
| GET | /fiyatlar/guncel | 826 | Güncel fiyatlar |
| GET | /fiyatlar/:urunId/gecmis | 855 | Fiyat geçmişi |
| GET | /fiyatlar/tedarikci-karsilastirma | 880 | Tedarikçi karşılaştırma |
| GET | /fiyatlar/:urunId/raf-fiyat | 918 | Raf fiyatı |
| GET | /debug/kalem/:ettn/:sira | 976 | Debug endpoint |
| GET | /raporlar/eslesme-durumu | 1021 | Eşleşme raporu |
| GET | /raporlar/kategori-harcama | 1049 | Kategori harcama |
| GET | /raporlar/tedarikci-ozet | 1091 | Tedarikçi özeti |

---

### 1.8 Stok & Ürünler — 48 endpoint (2 dosya)

#### stok.js (`/api/stok`) — 27 endpoint | Auth: Yok
| Method | Path | Satır | Açıklama |
|--------|------|-------|----------|
| GET | /depolar | 29 | Depo listesi |
| GET | /depolar/:depoId/lokasyonlar | 50 | Lokasyonlar |
| GET | /lokasyonlar/:lokasyonId/stoklar | 70 | Lokasyon stokları |
| POST | /depolar | 90 | Depo oluştur |
| PUT | /depolar/:id | 120 | Depo güncelle |
| DELETE | /depolar/:id | 150 | Depo sil |
| GET | /kartlar | 175 | Stok kartları |
| DELETE | /kartlar/:id | 200 | Stok kartı sil |
| GET | /kartlar/:id | 225 | Stok kartı detayı |
| POST | /kartlar | 250 | Stok kartı oluştur |
| GET | /hareketler | 280 | Stok hareketleri |
| POST | /hareketler/giris | 310 | Stok giriş |
| POST | /hareketler/cikis | 340 | Stok çıkış |
| POST | /hareketler/transfer | 370 | Stok transfer |
| GET | /kritik | 400 | Kritik stok uyarıları |
| GET | /rapor/deger | 430 | Stok değer raporu |
| GET | /kategoriler | 460 | Kategoriler |
| GET | /birimler | 490 | Birimler |
| GET | /faturalar | 520 | Faturalar |
| GET | /faturalar/:ettn/kalemler | 550 | Fatura kalemleri |
| POST | /faturadan-giris | 580 | Faturadan stok giriş |
| GET | /kartlar/ara | 610 | Stok kartı ara |
| POST | /akilli-eslestir | 640 | Akıllı eşleştir |
| GET | /faturalar/:ettn/akilli-kalemler | 670 | Akıllı kalemler |
| POST | /toplu-fatura-isle | 700 | Toplu fatura işle |
| GET | /faturalar/islenmemis | 730 | İşlenmemiş faturalar |
| GET | /fiyat-anomaliler | 760 | Fiyat anomalileri |

#### urunler.js (`/api/urunler`) — 21 endpoint | Auth: Yok
| Method | Path | Satır | Açıklama |
|--------|------|-------|----------|
| GET | / | 219 | Ürün listesi |
| GET | /:id | 342 | Ürün detayı |
| POST | / | 491 | Ürün oluştur |
| PUT | /:id | 600 | Ürün güncelle |
| DELETE | /:id | 709 | Ürün sil |
| PATCH | /:id/fiyat | 768 | Fiyat güncelle |
| PATCH | /:id/aktif-fiyat-sec | 833 | Aktif fiyat seç |
| GET | /kategoriler/liste | 925 | Kategoriler |
| POST | /:id/giris | 969 | Stok giriş |
| POST | /:id/cikis | 1019 | Stok çıkış |
| POST | /eslestir | 1073 | Eşleştir |
| POST | /akilli-eslesdir | 1147 | Akıllı eşleştir |
| GET | /ozet/istatistikler | 1238 | İstatistikler |
| POST | /varyant-sistemi-kur | 1284 | Varyant sistemi kur |
| GET | /:id/varyantlar | 1309 | Varyantlar |
| GET | /ana-urunler/liste | 1337 | Ana ürünler |
| POST | /varyant-olustur | 1389 | Varyant oluştur |
| POST | /varyant-bagla | 1552 | Varyant bağla |
| POST | /toplu-varyant-bagla | 1608 | Toplu varyant bağla |
| GET | /duplikeler/liste | 1662 | Dublikeler |
| POST | /duplikeler/birlestir | 1700 | Dublike birleştir |

---

### 1.9 Menü Planlama — 60 endpoint (6 dosya)

#### menu-planlama.js (`/api/menu-planlama`) — 19 endpoint | Auth: `authenticate`
| Method | Path | Satır | Açıklama |
|--------|------|-------|----------|
| GET | /ogun-tipleri | 45 | Öğün tipleri |
| GET | /projeler | 65 | Proje listesi |
| GET | /menu-planlari | 85 | Plan listesi |
| GET | /projeler/:projeId/ogun-sablonlari | 105 | Öğün şablonları |
| POST | /projeler/:projeId/ogun-sablonlari | 125 | Şablon oluştur |
| GET | /projeler/:projeId/menu-planlari | 145 | Proje planları |
| GET | /menu-planlari/:id | 165 | Plan detayı |
| POST | /menu-planlari | 185 | Plan oluştur |
| PUT | /menu-planlari/:id | 205 | Plan güncelle |
| DELETE | /menu-planlari/:id | 225 | Plan sil |
| POST | /menu-planlari/:planId/ogunler | 245 | Öğün ekle |
| POST | /ogunler/:ogunId/yemekler | 265 | Yemek ekle |
| PUT | /menu-ogun/:ogunId | 285 | Öğün güncelle |
| DELETE | /yemekler/:yemekId | 305 | Yemek sil |
| POST | /menu-planlari/toplu-kaydet | 325 | Toplu kaydet |
| GET | /menu-plan | 345 | Plan getir |
| POST | /menu-plan/yemek-ekle | 365 | Plana yemek ekle |
| GET | /menu-planlari/:planId/gunluk-ozet | 385 | Günlük özet |
| POST | /projeler/:kaynakId/sablon-kopyala/:hedefId | 405 | Şablon kopyala |

#### menu-planlama/receteler.js — 12 endpoint
| Method | Path | Satır | Açıklama |
|--------|------|-------|----------|
| GET | /kategoriler | 35 | Reçete kategorileri |
| POST | /kategoriler | 55 | Kategori oluştur |
| GET | /receteler | 75 | Reçete listesi |
| GET | /receteler/:id | 105 | Reçete detayı |
| POST | /receteler | 225 | Reçete oluştur |
| PUT | /receteler/:id | 255 | Reçete güncelle |
| DELETE | /receteler/:id | 285 | Reçete sil |
| POST | /receteler/:id/malzemeler | 315 | Malzemeler ekle |
| PUT | /malzemeler/:id | 345 | Malzeme güncelle |
| DELETE | /malzemeler/:id | 375 | Malzeme sil |
| POST | /receteler/:id/maliyet-hesapla | 405 | Maliyet hesapla |
| POST | /receteler/toplu-maliyet-hesapla | 435 | Toplu maliyet |

#### menu-planlama/sartnameler.js — 10 endpoint
| Method | Path | Satır | Açıklama |
|--------|------|-------|----------|
| GET | /sartname/kurumlar | 35 | Kurumlar |
| GET | /sartname/liste | 55 | Şartname listesi |
| POST | /sartname | 75 | Şartname oluştur |
| GET | /sartname/:id | 105 | Şartname detayı |
| PUT | /sartname/:id | 135 | Şartname güncelle |
| POST | /sartname/:sartnameId/proje-ata | 165 | Projeye ata |
| GET | /proje/:projeId/sartnameler | 195 | Proje şartnameleri |
| POST | /sartname/:sartnameId/ogun-yapisi | 315 | Öğün yapısı ekle |
| PUT | /ogun-yapisi/:id | 345 | Öğün yapısı güncelle |
| GET | /recete/:receteId/gramaj-kontrol | 375 | Gramaj kontrolü |

**Şartname gramaj:** Ana sistem `sartname_gramaj_kurallari` (alt_tip + malzeme_tipi); toplu uygulama, önizleme ve uyum bu tabloyu kullanır. Eski `sartname_porsiyon_gramajlari` endpoint'leri kaldırıldı.

#### menu-planlama/urun-kartlari.js — 9 endpoint
| Method | Path | Satır | Açıklama |
|--------|------|-------|----------|
| GET | /urun-kategorileri | 35 | Kategoriler |
| GET | /urun-kartlari | 55 | Ürün kartları |
| GET | /urun-kartlari/:id | 85 | Kart detayı |
| POST | /urun-kartlari | 115 | Kart oluştur |
| PUT | /urun-kartlari/:id | 145 | Kart güncelle |
| DELETE | /urun-kartlari/:id | 175 | Kart sil |
| GET | /urun-kartlari/:id/varyantlar | 205 | Varyantlar |
| POST | /urun-kartlari/eslestir | 235 | Eşleştir |
| GET | /stok-kartlari-listesi | 265 | Stok kartları |

#### menu-planlama/menu-import.js — 2 endpoint
| Method | Path | Satır | Açıklama |
|--------|------|-------|----------|
| POST | /import/analyze | 35 | Menü analiz et |
| POST | /import/save | 110 | Menüyü kaydet |

#### menu-planlama/ai-features.js — 2 endpoint
| Method | Path | Satır | Açıklama |
|--------|------|-------|----------|
| POST | /receteler/:id/ai-malzeme-oneri | 45 | AI malzeme önerisi |
| POST | /receteler/batch-ai-malzeme-oneri | 180 | Toplu AI önerisi |

---

### 1.10 Kurum Menüleri (`/api/kurum-menuleri`) — 10 endpoint
**Dosya:** `kurum-menuleri.js` | **Auth:** `authenticate`

| Method | Path | Satır | Açıklama |
|--------|------|-------|----------|
| GET | /kurum-tipleri | 35 | Kurum tipleri |
| GET | /maliyet-seviyeleri | 55 | Maliyet seviyeleri |
| GET | / | 75 | Menü listesi |
| GET | /:id | 105 | Menü detayı |
| POST | / | 135 | Menü oluştur |
| PUT | /:id | 165 | Menü güncelle |
| DELETE | /:id | 195 | Menü sil |
| POST | /:id/toplu-kaydet | 225 | Toplu kaydet |
| POST | /:id/maliyet-hesapla | 255 | Maliyet hesapla |
| POST | /ai-olustur | 285 | AI ile menü oluştur |

---

### 1.11 Maliyet Analizi (`/api/maliyet-analizi`) — 16 endpoint
**Dosya:** `maliyet-analizi.js` | **Auth:** `authenticate`

| Method | Path | Satır | Açıklama |
|--------|------|-------|----------|
| GET | /kategoriler | 45 | Kategoriler |
| POST | /kategoriler | 65 | Kategori oluştur |
| GET | /sablonlar | 85 | Şablonlar |
| GET | /sablonlar/:id | 115 | Şablon detayı |
| POST | /sablonlar | 145 | Şablon oluştur |
| POST | /sablonlar/menu-plandan | 175 | Plandan şablon |
| POST | /sablonlar/:id/yemek | 205 | Şablona yemek ekle |
| DELETE | /sablonlar/:sablonId/yemek/:yemekId | 235 | Yemek sil |
| DELETE | /sablonlar/:id | 265 | Şablon sil |
| POST | /sablonlar/:id/hesapla | 295 | Maliyet hesapla |
| POST | /sablonlar/:id/fiyat-guncelle | 325 | Fiyat güncelle |
| POST | /karsilastir | 355 | Karşılaştırma |
| GET | /menu-ogunler | 385 | Menü öğünleri |
| GET | /receteler | 415 | Reçeteler |
| GET | /receteler/:id/maliyet | 445 | Reçete maliyeti |
| GET | /ozet | 475 | Özet |

---

### 1.12 Personel & İK — 81 endpoint (5 dosya)

#### personel.js (`/api/personel`) — 28 endpoint | Auth: Yok (kısmen route içinde)
| Method | Path | Satır | Açıklama |
|--------|------|-------|----------|
| GET | /stats | 28 | İstatistikler |
| GET | /projeler | 69 | Projeler |
| GET | /projeler/:id | 102 | Proje detayı |
| POST | /projeler | 154 | Proje ekle |
| PUT | /projeler/:id | 190 | Proje güncelle |
| DELETE | /projeler/:id | 228 | Proje sil |
| GET | / | 247 | Personel listesi |
| GET | /:id | 313 | Personel detayı |
| POST | / | 359 | Personel ekle |
| PUT | /:id | 458 | Personel güncelle |
| DELETE | /:id | 579 | Personel sil |
| POST | /projeler/:projeId/personel | 598 | Projeye ata |
| POST | /projeler/:projeId/personel/bulk | 642 | Toplu ata |
| PUT | /atama/:atamaId | 691 | Atama güncelle |
| DELETE | /atama/:atamaId | 725 | Atama kaldır |
| GET | /stats/overview | 753 | Özet istatistikler |
| GET | /stats/departman | 774 | Departman bazlı |
| GET | /gorevler | 797 | Görevler |
| POST | /gorevler | 814 | Görev ekle |
| PUT | /gorevler/:id | 840 | Görev güncelle |
| DELETE | /gorevler/:id | 878 | Görev sil |
| GET | /tazminat/sebepler | 916 | Çıkış sebepleri |
| GET | /tazminat/yasal-bilgiler | 928 | Yasal bilgiler |
| POST | /tazminat/hesapla | 940 | Tazminat hesapla |
| POST | /tazminat/kaydet | 955 | Tazminat kaydet |
| GET | /tazminat/risk | 980 | Risk analizi |
| GET | /tazminat/gecmis | 994 | Tazminat geçmişi |
| PUT | /:id/izin-gun | 1035 | İzin günü güncelle |

#### bordro.js (`/api/bordro`) — 11 endpoint | Auth: Yok
| Method | Path | Satır | Açıklama |
|--------|------|-------|----------|
| POST | /net-brut-hesapla | 224 | Net-brüt hesapla |
| POST | /hesapla | 301 | Bordro hesapla |
| POST | /kaydet | 448 | Bordro kaydet |
| POST | /toplu-hesapla | 539 | Toplu hesapla |
| GET | / | 706 | Bordro listesi |
| GET | /ozet/:yil/:ay | 747 | Bordro özeti |
| PATCH | /:id/odeme | 780 | Ödeme durumu |
| POST | /toplu-odeme | 811 | Toplu ödeme |
| DELETE | /donem-sil | 840 | Dönem sil |
| GET | /vergi-dilimleri/:yil | 872 | Vergi dilimleri |
| GET | /asgari-ucret/:yil | 890 | Asgari ücret |

#### maas-odeme.js (`/api/maas-odeme`) — 15 endpoint | Auth: Yok
| Method | Path | Satır | Açıklama |
|--------|------|-------|----------|
| GET | /ozet/:projeId/:yil/:ay | 25 | Ödeme özeti |
| POST | /olustur/:projeId/:yil/:ay | 112 | Ödeme oluştur |
| PATCH | /:id/odendi | 150 | Ödendi işaretle |
| PATCH | /personel-odeme/:personelId | 178 | Personel ödeme |
| PATCH | /toplu-odendi/:projeId/:yil/:ay | 217 | Toplu ödeme |
| GET | /avans/:personelId | 248 | Avans geçmişi |
| POST | /avans | 269 | Avans ekle |
| GET | /prim/:personelId | 309 | Prim geçmişi |
| POST | /prim | 330 | Prim ekle |
| PATCH | /personel/:maasOdemeId | 366 | Maaş güncelle |
| GET | /proje-ayarlari/:projeId | 395 | Proje ayarları |
| POST | /proje-ayarlari/:projeId | 414 | Ayar kaydet |
| GET | /aylik-odeme/:projeId/:yil/:ay | 446 | Aylık ödeme |
| PATCH | /aylik-odeme/:projeId/:yil/:ay | 478 | Aylık güncelle |
| POST | /finalize/:projeId/:yil/:ay | 530 | Finalize et |

#### izin.js (`/api/izin`) — 9 endpoint | Auth: Yok
| Method | Path | Satır | Açıklama |
|--------|------|-------|----------|
| GET | /turler | 11 | İzin türleri |
| GET | /talepler | 27 | Talepler |
| POST | /talepler | 83 | Talep oluştur |
| PATCH | /talepler/:id/durum | 148 | Durum güncelle |
| DELETE | /talepler/:id | 182 | Talep sil |
| GET | /personel/:id/ozet | 207 | Personel özeti |
| POST | /kidem-hesapla | 303 | Kıdem hesapla |
| GET | /stats | 441 | İstatistikler |
| GET | /bugun-izinli | 461 | Bugün izinliler |

#### bordro-import.js (`/api/bordro-import`) — 15 endpoint | Auth: Yok
| Method | Path | Satır | Açıklama |
|--------|------|-------|----------|
| GET | /projeler | 61 | Projeler |
| GET | /proje/:projeId/personeller | 88 | Personeller |
| GET | /check/:projeId/:yil/:ay | 102 | Bordro kontrolü |
| POST | /analyze | 125 | Dosya analiz |
| POST | /confirm | 163 | Onayla ve kaydet |
| POST | /create-personel | 213 | Personel oluştur |
| POST | /cancel | 245 | İptal et |
| GET | /tahakkuk/:projeId/:yil/:ay | 263 | Tahakkuk bilgisi |
| GET | /ozet/:projeId/:yil/:ay | 290 | Özet bilgisi |
| GET | /templates | 331 | Şablonlar |
| GET | /templates/:id | 345 | Şablon detayı |
| POST | /templates | 364 | Şablon kaydet |
| PUT | /templates/:id | 396 | Şablon güncelle |
| DELETE | /templates/:id | 438 | Şablon sil |
| POST | /templates/from-analysis | 454 | AI'dan şablon |

---

### 1.13 Projeler — 33 endpoint (2 dosya)

#### projeler.js (`/api/projeler`) — 25 endpoint | Auth: `optionalAuth`
| Method | Path | Satır | Açıklama |
|--------|------|-------|----------|
| GET | / | 15 | Proje listesi |
| GET | /:id | 75 | Proje detayı |
| GET | /:id/personeller | 110 | Personeller |
| GET | /:id/siparisler | 139 | Siparişler |
| GET | /:id/hareketler | 167 | Hareketler |
| POST | / | 200 | Proje oluştur |
| PUT | /:id | 343 | Proje güncelle |
| DELETE | /:id | 515 | Proje sil |
| GET | /:id/ozet | 549 | Özet |
| GET | /:id/tam-ozet | 619 | Tam özet |
| GET | /stats/genel-ozet | 841 | Genel istatistik |
| POST | /:id/personeller | 984 | Personel ata |
| POST | /:id/personeller/bulk | 1032 | Toplu ata |
| PUT | /personel-atama/:atamaId | 1085 | Atama güncelle |
| DELETE | /personel-atama/:atamaId | 1119 | Atama kaldır |
| GET | /raporlar/harcama-ozeti | 1154 | Harcama raporu |
| GET | /raporlar/maliyet-analizi | 1194 | Maliyet analizi |
| GET | /:id/atamasiz-personeller | 1279 | Atamasız personeller |
| GET | /:id/yetkililer | 1311 | Yetkililer |
| POST | /:id/yetkililer | 1334 | Yetkili ekle |
| PUT | /:projeId/yetkililer/:yetkiliId | 1362 | Yetkili güncelle |
| DELETE | /:projeId/yetkililer/:yetkiliId | 1398 | Yetkili sil |
| GET | /:id/dokumanlar | 1425 | Dökümanlar |
| POST | /:id/dokumanlar | 1468 | Döküman ekle |
| DELETE | /:projeId/dokumanlar/:dokumanId | 1502 | Döküman sil |

#### proje-hareketler.js (`/api/proje-hareketler`) — 8 endpoint | Auth: Yok
| Method | Path | Satır | Açıklama |
|--------|------|-------|----------|
| GET | /ozet/:projeId | 10 | Hareket özeti |
| GET | /:projeId | 76 | Hareket listesi |
| POST | / | 130 | Hareket ekle |
| POST | /personel-gideri | 154 | Personel gideri |
| PATCH | /:id | 216 | Hareket güncelle |
| DELETE | /:id | 246 | Hareket sil |
| GET | /atanmamis | 273 | Atanmamış giderler |
| GET | /tum-projeler/ozet | 313 | Tüm projeler özeti |

---

### 1.14 Cariler (`/api/cariler`) — 8 endpoint
**Dosya:** `cariler.js` | **Auth:** Yok

| Method | Path | Satır | Açıklama |
|--------|------|-------|----------|
| GET | / | 62 | Cari listesi |
| GET | /:id | 151 | Cari detayı |
| POST | / | 192 | Cari oluştur |
| PUT | /:id | 291 | Cari güncelle |
| GET | /:id/hareketler | 360 | Hareketler |
| GET | /:id/aylik-ozet | 428 | Aylık özet |
| DELETE | /:id | 493 | Cari sil |
| GET | /:id/ekstre | 522 | Ekstre |

---

### 1.15 Kasa-Banka (`/api/kasa-banka`) — 16 endpoint
**Dosya:** `kasa-banka.js` | **Auth:** Yok

| Method | Path | Satır | Açıklama |
|--------|------|-------|----------|
| GET | /hesaplar | 27 | Hesaplar |
| POST | /hesaplar | 77 | Hesap ekle |
| PUT | /hesaplar/:id | 139 | Hesap güncelle |
| DELETE | /hesaplar/:id | 202 | Hesap sil |
| GET | /hareketler | 217 | Hareketler |
| POST | /hareketler | 267 | Hareket ekle |
| POST | /transfer | 305 | Transfer |
| GET | /cek-senet | 347 | Çek/Senet listesi |
| POST | /cek-senet | 407 | Çek/Senet ekle |
| PUT | /cek-senet/:id | 470 | Çek/Senet güncelle |
| POST | /cek-senet/:id/tahsil | 492 | Tahsil et |
| POST | /cek-senet/:id/ciro | 563 | Ciro et |
| POST | /cek-senet/:id/iade | 605 | İade et |
| DELETE | /cek-senet/:id | 639 | Sil |
| GET | /ozet | 654 | Özet |
| GET | /cariler | 735 | Cariler |

---

### 1.16 Mutabakat (`/api/mutabakat`) — 5 endpoint
**Dosya:** `mutabakat.js` | **Auth:** Yok

| Method | Path | Satır | Açıklama |
|--------|------|-------|----------|
| GET | /ekstre/:cariId | 15 | Cari ekstre |
| GET | /fatura-bazli/:cariId | 186 | Fatura bazlı mutabakat |
| GET | /donemsel/:cariId | 312 | Dönemsel mutabakat |
| POST | /fatura-odeme | 459 | Fatura ödeme kaydet |
| GET | /fatura-odemeler/:faturaId | 505 | Fatura ödemeleri |

---

### 1.17 Satın Alma (`/api/satin-alma`) — 13 endpoint
**Dosya:** `satin-alma.js` | **Auth:** Yok

| Method | Path | Satır | Açıklama |
|--------|------|-------|----------|
| GET | /projeler | 9 | Projeler |
| POST | /projeler | 23 | Proje ekle |
| PUT | /projeler/:id | 41 | Proje güncelle |
| DELETE | /projeler/:id | 68 | Proje sil |
| GET | /siparisler | 81 | Siparişler |
| GET | /siparisler/:id | 142 | Sipariş detayı |
| POST | /siparisler | 187 | Sipariş oluştur |
| PUT | /siparisler/:id | 271 | Sipariş güncelle |
| PUT | /siparisler/:id/durum | 348 | Durum güncelle |
| DELETE | /siparisler/:id | 369 | Sipariş sil |
| GET | /ozet | 382 | Özet |
| GET | /raporlar/proje-bazli | 400 | Proje raporu |
| GET | /raporlar/tedarikci-bazli | 432 | Tedarikçi raporu |

---

### 1.18 Firmalar (`/api/firmalar`) — 30 endpoint
**Dosya:** `firmalar.js` | **Auth:** Yok (firmalarRouter'da)

| Method | Path | Satır | Açıklama |
|--------|------|-------|----------|
| GET | / | 59 | Firma listesi |
| GET | /alan-sablonlari | 95 | Alan şablonları |
| GET | /:id | 204 | Firma detayı |
| POST | /alan-sablonlari | 231 | Şablon ekle |
| GET | /varsayilan/get | 271 | Varsayılan firma |
| POST | / | 292 | Firma ekle |
| PUT | /:id | 445 | Firma güncelle |
| POST | /:id/belge | 626 | Belge yükle |
| PATCH | /:id/varsayilan | 727 | Varsayılan yap |
| DELETE | /:id | 756 | Firma sil |
| GET | /belge-tipleri | 785 | Belge tipleri |
| POST | /analyze-belge | 814 | AI belge analiz |
| POST | /:id/analyze-and-save | 855 | Analiz et ve kaydet |
| GET | /:id/ortaklar | 973 | Ortaklar |
| POST | /:id/ortaklar | 1000 | Ortak ekle |
| PUT | /:firmaId/ortaklar/:ortakId | 1061 | Ortak güncelle |
| DELETE | /:firmaId/ortaklar/:ortakId | 1135 | Ortak sil |
| GET | /:id/dokumanlar | 1167 | Dökümanlar |
| POST | /:id/dokumanlar | 1222 | Döküman ekle |
| PUT | /:firmaId/dokumanlar/:dokumanId | 1333 | Döküman güncelle |
| DELETE | /:firmaId/dokumanlar/:dokumanId | 1386 | Döküman sil |
| POST | /:firmaId/dokumanlar/:dokumanId/yeniden-analiz | 1419 | Yeniden analiz |
| POST | /:firmaId/dokumanlar/:dokumanId/veriyi-uygula | 1497 | Veri uygula |
| GET | /:id/export | 1618 | Export |
| GET | /:id/dokumanlar-zip | 1706 | ZIP indir |
| GET | /belge-tipleri/listele | 1756 | Belge tipleri |
| GET | /:id/ekstra-alanlar | 1816 | Ekstra alanlar |
| PUT | /:id/ekstra-alanlar | 1844 | Ekstra alanlar güncelle |
| PATCH | /:id/ekstra-alan | 1877 | Tek alan güncelle |
| DELETE | /:id/ekstra-alan/:alan | 1916 | Alan sil |

---

### 1.19 Yükleniciler (`/api/contractors`) — 43 endpoint
**Dosya:** `contractors.js` | **Auth:** Yok

| Method | Path | Satır | Açıklama |
|--------|------|-------|----------|
| GET | / | 50 | Yüklenici listesi |
| GET | /stats | 165 | İstatistikler |
| GET | /:id | 218 | Detay |
| PATCH | /:id | 305 | Güncelle |
| GET | /:id/notlar | 375 | Notlar |
| POST | /:id/notlar | 392 | Not ekle |
| PATCH | /:id/notlar/:notId | 419 | Not güncelle |
| DELETE | /:id/notlar/:notId | 466 | Not sil |
| POST | /:id/toggle-follow | 489 | Takip aç/kapat |
| POST | /:id/toggle-istihbarat | 523 | İstihbarat aç/kapat |
| GET | /:id/tenders | 777 | İhaleleri |
| GET | /tender/:tenderId/competitors | 841 | Rakipler |
| POST | /scrape | 909 | Scrape et |
| GET | /scrape/status | 991 | Scrape durumu |
| POST | /scrape/stop | 1008 | Scrape durdur |
| GET | /meta/etiketler | 1030 | Etiketler |
| GET | /meta/sehirler | 1054 | Şehirler |
| GET | /analytics/pazar | 1078 | Pazar analizi |
| GET | /analytics/fiyat-tahmini | 1159 | Fiyat tahmini |
| GET | /karsilastir | 1235 | Karşılaştır |
| GET | /en-aktif | 1354 | En aktifler |
| GET | /sehir-bazli | 1388 | Şehir bazlı |
| POST | /scrape/participants | 1417 | Katılımcı scrape |
| POST | /scrape/tender-history | 1512 | Tarihçe scrape |
| GET | /:id/risk | 1585 | Risk profili |
| PATCH | /:id/risk | 1658 | Risk güncelle |
| POST | /:id/scrape-history | 1687 | Geçmiş scrape |
| GET | /:id/analyze | 1786 | Analiz |
| POST | /:id/scrape-analyze | 1816 | Scrape + analiz |
| GET | /:id/ai-ozet | 1911 | AI özeti |
| GET | /tender/:tenderId/ai-rakip-analiz | 1933 | AI rakip analiz |
| GET | /:id/istihbarat | 2025 | İstihbarat verileri |
| POST | /:id/modul/:modul/calistir | 2070 | Modül çalıştır |
| POST | /:id/modul/tumunu-calistir | 2149 | Tüm modüller |
| GET | /:id/modul/:modul/durum | 2271 | Modül durumu |
| GET | /:id/modul/:modul/veri | 2300 | Modül verisi |
| GET | /bildirimler/liste | 2377 | Bildirimler |
| PATCH | /bildirimler/:bildirimId/oku | 2412 | Bildirim oku |
| POST | /bildirimler/tumunu-oku | 2429 | Tümünü oku |
| GET | /:id/fiyat-tahmin | 2444 | Fiyat tahmini |
| POST | /:id/derin-analiz | 2534 | Derin analiz |
| GET | /:id/derin-analiz | 2610 | Derin analiz sonuç |

---

### 1.20 İhale Takip (`/api/tender-tracking`) — 16 endpoint
**Dosya:** `tender-tracking.js` | **Auth:** Yok

| Method | Path | Satır | Açıklama |
|--------|------|-------|----------|
| GET | / | 136 | Takip listesi |
| GET | /detail/:tenderId | 200 | Takip detayı |
| POST | / | 257 | Takibe ekle |
| PUT | /:id | 334 | Güncelle |
| POST | /:id/notes | 408 | Not ekle |
| GET | /:id/suggestions | 464 | Öneriler |
| DELETE | /:id/notes/:noteId | 675 | Not sil |
| DELETE | /:id | 706 | Takip sil |
| POST | /add-from-analysis | 730 | Analizden ekle |
| GET | /check/:tenderId | 2223 | Kontrol |
| GET | /stats | 2255 | İstatistikler |
| GET | /:tenderId/analysis | 2291 | Analiz |
| POST | /:tenderId/hide-note | 2497 | Not gizle |
| POST | /:tenderId/unhide-note | 2549 | Not göster |
| GET | /:tenderId/hidden-notes | 2590 | Gizli notlar |
| GET | /:tenderId/rakip-analizi | 2626 | Rakip analizi |

---

### 1.21 İhale Sonuçları (`/api/ihale-sonuclari`) — 15 endpoint
**Dosya:** `ihale-sonuclari.js` | **Auth:** Yok

| Method | Path | Satır | Açıklama |
|--------|------|-------|----------|
| GET | / | 21 | Sonuç listesi |
| GET | /istatistikler | 104 | İstatistikler |
| GET | /aktif-surecler | 139 | Aktif süreçler |
| GET | /:id | 160 | Sonuç detayı |
| POST | / | 211 | Sonuç ekle |
| PUT | /:id | 288 | Güncelle |
| POST | /:id/rakip-teklif | 389 | Rakip teklif |
| DELETE | /:id/rakip-teklif/:sira | 445 | Teklif sil |
| PATCH | /:id/durum | 487 | Durum güncelle |
| POST | /:id/proje-olustur | 600 | Proje oluştur |
| GET | /:id/proje | 678 | İlişkili proje |
| POST | /:id/hesaplama-kaydet | 717 | Hesaplama kaydet |
| POST | /:id/ai-sohbet | 758 | AI sohbet |
| DELETE | /:id | 802 | Sil |
| POST | /tracking-aktar/:tenderId | 831 | Tracking'ten aktar |

---

### 1.22 Teklifler (`/api/teklifler`) — 6 endpoint
**Dosya:** `teklifler.js` | **Auth:** Yok

| Method | Path | Satır | Açıklama |
|--------|------|-------|----------|
| GET | / | 7 | Teklif listesi |
| GET | /:id | 42 | Teklif detayı |
| GET | /ihale/:ihaleId | 71 | İhale teklifi |
| POST | / | 96 | Teklif oluştur |
| PUT | /:id | 146 | Güncelle |
| DELETE | /:id | 207 | Sil |

---

### 1.23 Dilekçe (`/api/tender-dilekce`) — 6 endpoint
**Dosya:** `tender-dilekce.js` | **Auth:** Yok

| Method | Path | Satır | Açıklama |
|--------|------|-------|----------|
| GET | /:tenderId | 16 | İhale dilekçeleri |
| GET | /detail/:id | 46 | Dilekçe detayı |
| POST | / | 79 | Dilekçe kaydet |
| PUT | /:id | 146 | Güncelle |
| DELETE | /:id | 182 | Sil |
| GET | /types/stats | 212 | Tür istatistikleri |

---

### 1.24 Notlar (`/api/notes`) — 42 endpoint (8 alt-router)

#### notes/personal.js — 9 endpoint
| Method | Path | Satır | Açıklama |
|--------|------|-------|----------|
| GET | / | 20 | Not listesi |
| GET | /:id | 183 | Not detayı |
| POST | / | 242 | Not oluştur |
| PUT | /:id | 366 | Not güncelle |
| DELETE | /:id | 594 | Not sil |
| PUT | /:id/toggle | 619 | Tamamlandı/beklemede |
| PUT | /:id/pin | 653 | Sabitle |
| PUT | /reorder | 686 | Sırala |
| DELETE | /completed | 725 | Tamamlananları sil |

#### notes/contextual.js — 3 endpoint
| Method | Path | Satır | Açıklama |
|--------|------|-------|----------|
| GET | /context/:type/:id | 37 | Context notları |
| POST | /context/:type/:id | 117 | Context not ekle |
| PUT | /context/:type/:id/reorder | 244 | Sırala |

#### notes/tags.js — 5 endpoint
| GET | /tags | 20 | Etiketler |
| GET | /tags/suggestions | 46 | Öneriler |
| POST | /tags | 82 | Etiket oluştur |
| PUT | /tags/:tagId | 114 | Güncelle |
| DELETE | /tags/:tagId | 171 | Sil |

#### notes/reminders.js — 5 endpoint
| GET | /reminders/upcoming | 20 | Yaklaşan |
| GET | /reminders/due | 63 | Vadesi gelen |
| POST | /reminders/:noteId | 102 | Hatırlatıcı ekle |
| PUT | /reminders/:id/sent | 155 | Gönderildi |
| DELETE | /reminders/:id | 187 | Sil |

#### notes/attachments.js — 4 endpoint
| POST | /attachments/:noteId | 82 | Dosya ekle |
| GET | /attachments/:id/download | 160 | İndir |
| DELETE | /attachments/:id | 224 | Sil |
| GET | /attachments/note/:noteId | 272 | Dosyalar |

#### notes/sharing.js — 4 endpoint
| POST | /sharing/:noteId | 21 | Paylaş |
| GET | /sharing/:noteId | 71 | Paylaşım bilgisi |
| DELETE | /sharing/:shareId | 103 | Paylaşım iptal |
| GET | /sharing | 129 | Benimle paylaşılanlar |

#### notes/folders.js — 6 endpoint
| GET | /folders | 19 | Klasörler |
| POST | /folders | 46 | Klasör oluştur |
| PUT | /folders/:id | 83 | Güncelle |
| DELETE | /folders/:id | 150 | Sil |
| POST | /folders/:id/unlock | 178 | Kilit aç |
| PUT | /folders/move-note | 218 | Not taşı |

#### notes/tracker.js — 2 endpoint
| GET | /tracker | 20 | Takip listesi |
| PUT | /tracker | 44 | Tercihler |

---

### 1.25 Raporlar & Export — 26 endpoint (2 dosya)

#### reports.js (`/api/reports`) — 5 endpoint | Auth: `authenticate`
| Method | Path | Satır | Açıklama |
|--------|------|-------|----------|
| GET | /catalog/:module? | 21 | Rapor kataloğu |
| POST | /generate | 36 | Rapor üret |
| POST | /preview | 63 | Önizleme |
| POST | /bulk | 93 | Toplu ZIP |
| POST | /mail | 148 | Mail gönder |

#### export.js (`/api/export`) — 21 endpoint | Auth: Yok
| Method | Path | Satır | Açıklama |
|--------|------|-------|----------|
| GET | /personel/excel | 33 | Personel Excel |
| GET | /personel/pdf | 67 | Personel PDF |
| POST | /personel/mail | 101 | Personel mail |
| GET | /fatura/excel | 170 | Fatura Excel |
| GET | /fatura/pdf | 211 | Fatura PDF |
| POST | /fatura/mail | 252 | Fatura mail |
| GET | /cari/excel | 329 | Cari Excel |
| GET | /cari/pdf | 362 | Cari PDF |
| POST | /cari/mail | 396 | Cari mail |
| GET | /stok/excel | 465 | Stok Excel |
| GET | /stok/pdf | 497 | Stok PDF |
| POST | /stok/mail | 530 | Stok mail |
| GET | /personel/proje/:projeId | 599 | Proje personeli |
| GET | /bordro/:donem | 662 | Bordro raporu |
| GET | /izin-raporu | 741 | İzin raporu |
| GET | /fatura/vadesi-gecen | 857 | Vadesi geçenler |
| GET | /stok/kritik | 907 | Kritik stok |
| GET | /cari/bakiye | 963 | Cari bakiye |
| POST | /dilekce/pdf | 1016 | Dilekçe PDF |
| POST | /dilekce/docx | 1053 | Dilekçe DOCX |
| GET | /rapor-tipleri/:modul | 1097 | Rapor tipleri |

---

### 1.26 Demirbaş (`/api/demirbas`) — 21 endpoint
**Dosya:** `demirbas.js` | **Auth:** Yok

| Method | Path | Satır | Açıklama |
|--------|------|-------|----------|
| GET | /kategoriler | 11 | Kategoriler |
| POST | /kategoriler | 30 | Kategori ekle |
| GET | /lokasyonlar | 54 | Lokasyonlar |
| POST | /lokasyonlar | 73 | Lokasyon ekle |
| PUT | /lokasyonlar/:id | 93 | Lokasyon güncelle |
| DELETE | /lokasyonlar/:id | 127 | Lokasyon sil |
| GET | /istatistik/ozet | 170 | İstatistikler |
| POST | /toplu/sil | 271 | Toplu sil |
| POST | /toplu/transfer | 294 | Toplu transfer |
| GET | / | 326 | Demirbaş listesi |
| GET | /:id | 422 | Detay |
| POST | / | 499 | Ekle |
| PUT | /:id | 611 | Güncelle |
| DELETE | /:id | 690 | Sil |
| POST | /:id/zimmet | 714 | Zimmet ver |
| POST | /:id/zimmet-iade | 760 | İade |
| POST | /:id/zimmet-devir | 806 | Devir |
| POST | /:id/bakim | 864 | Bakım |
| POST | /:id/bakim-cikis | 921 | Bakımdan çıkar |
| POST | /:id/transfer | 962 | Transfer |
| POST | /:id/cikis | 1006 | Hurda/satış |

---

### 1.27 Planlama/Piyasa (`/api/planlama`) — 33 endpoint
**Dosya:** `planlama.js` | **Auth:** `authenticate`

| Method | Path | Satır | Açıklama |
|--------|------|-------|----------|
| GET | /piyasa/takip-listesi | 16 | Takip listesi |
| POST | /piyasa/takip-listesi | 55 | Takibe ekle |
| DELETE | /piyasa/takip-listesi/:id | 119 | Takipten çıkar |
| POST | /piyasa/toplu-guncelle | 132 | Toplu fiyat güncelle |
| GET | /piyasa/gecmis | 222 | Fiyat geçmişi |
| POST | /piyasa/chat | 268 | Piyasa sohbet |
| POST | /piyasa/oneri | 310 | Öneri |
| POST | /piyasa/hizli-arastir | 332 | Hızlı araştır |
| POST | /piyasa/detayli-arastir | 352 | Detaylı araştır |
| POST | /piyasa/kaydet-sonuclar | 421 | Sonuç kaydet |
| POST | /piyasa/fiyat-kaydet | 470 | Fiyat kaydet |
| GET | /piyasa/urun-ara | 508 | Ürün ara |
| GET | /market/sources | 549 | Kaynaklar |
| POST | /market/collect | 566 | Veri topla |
| GET | /market | 601 | Piyasa verileri |
| GET | /piyasa/fatura-fiyatlari | 636 | Fatura fiyatları |
| GET | /piyasa/karsilastirma | 732 | Karşılaştırma |
| PUT | /piyasa/fiyat-guncelle/:stokKartId | 846 | Fiyat güncelle |
| GET | /ana-urunler | 898 | Ana ürünler |
| GET | /ana-urunler/:id | 985 | Ana ürün detay |
| POST | /ana-urunler/:id/eslestir | 1133 | Eşleştir |
| DELETE | /ana-urunler/:id/eslestir/:stokKartId | 1174 | Eşleştirme kaldır |
| PUT | /ana-urunler/:id/fiyat | 1203 | Fiyat güncelle |
| POST | /ana-urunler | 1234 | Ana ürün oluştur |
| GET | /ana-urunler-kategoriler | 1265 | Kategoriler |
| GET | /eslesmemis-stok-kartlari | 1285 | Eşleşmemiş kartlar |
| POST | /ambalaj-parse | 1336 | Ambalaj parse |
| POST | /stok-karti/:id/ambalaj-guncelle | 1356 | Ambalaj güncelle |
| POST | /stok-karti/toplu-ambalaj-guncelle | 1402 | Toplu ambalaj |
| GET | /stok-karti/ambalaj-ozet | 1481 | Ambalaj özeti |
| GET | /piyasa/sync/durum | 1508 | Sync durumu |
| POST | /piyasa/sync/tetikle | 1532 | Sync tetikle |
| POST | /piyasa/terim-optimize | 1551 | Terim optimize |

---

### 1.28 Kalan Route Dosyaları

#### sync.js (`/api/sync`) — 12 endpoint | Auth: Yok
| POST | /manual | Manuel sync | POST | /date-range | Tarih aralığı | POST | /category | Kategori sync | POST | /vendor | Tedarikçi sync | POST | /cleanup-duplicates | Duplike temizle | GET | /logs | Loglar | GET | /settings | Ayarlar | PUT | /settings | Ayar güncelle | POST | /start | Başlat | POST | /stop | Durdur | POST | /generate-report | Rapor oluştur | GET | /status | Durum |

#### notifications.js (`/api/notifications`) — 10 endpoint | Auth: Yok
| GET | / | Bildirimler | GET | /unread-count | Okunmamış | GET | /:id | Detay | PATCH | /:id/read | Okundu | PATCH | /read-all | Tümü okundu | POST | / | Oluştur | DELETE | /:id | Sil | POST | /cleanup | Temizle | GET | /scheduler-status | Scheduler | POST | /trigger-reminders | Tetikle |

#### etiketler.js (`/api/etiketler`) — 10 endpoint | Auth: Yok
| GET | / | Etiketler | POST | / | Oluştur | PUT | /:id | Güncelle | DELETE | /:id | Sil | POST | /fatura/bulk | Toplu fatura | GET | /fatura/:ettn | Fatura etiketi | POST | /fatura/:ettn | Etiket ata | DELETE | /fatura/:ettn/:etiketId | Etiket kaldır | PUT | /fatura/:ettn | Toplu güncelle | GET | /raporlar/etiket-bazli | Rapor |

#### social.js (`/api/social`) — 36 endpoint | Auth: Yok
WhatsApp (17 ep): health, status, qr, connect, disconnect, reconnect, clean-session, chats, messages, seen, send, contacts, archive, unarchive, media, save-media, send-media
Instagram (19 ep): health, status, login, logout, profile, posts, dms, messages, send-dm, followers, upload, ai/caption, ai/hashtags, ai/dm-reply, ai/menu-post, ai/image-prompt, ai/generate-image, ai/menu-card, send-dm (dup)

#### system.js (`/api/system`) — 27 endpoint | Auth: `adminLimiter`
Terminal (4): presets, preset/:id, execute, history
Services (5): status, start-all, restart/whatsapp, restart/backend, :name
Info (3): info, system/info, env/check
Schedulers (5): list, document-queue, :name, :name/trigger, :id/toggle
Health/Stats (4): health/detailed, stats, logs/recent, docker
Realtime (2): status, tables
Tavily (2): kredi, config

#### scraper.js (`/api/scraper`) — 13 endpoint | Auth: `authenticate + requireAdmin`
health, stats, jobs, logs, trigger, reset, retry, cancel, cleanup, check-documents/:tenderId, fetch-documents/:tenderId, add-tender, update-tracked

#### mail.js (`/api/mail`) — 14 endpoint | Auth: Yok
send, send-bulk, templates, templates/:id, templates/:id/preview, reminders/run, reminders/sozlesme, reminders/teminat, reminders/sertifika, reminders/upcoming, logs, stats, settings, test

#### search.js (`/api/search`) — 1 endpoint
| GET | / | Global arama |

#### preferences.js (`/api/preferences`) — 7 endpoint | Auth: `authenticate`
| GET/PUT | / | Tümünü getir/güncelle | GET/PUT | /:key | Tek tercih | DELETE | /:key | Sil | GET | /export/all | Export | POST | /import/all | Import |

#### permissions.js (`/api/permissions`) — 13 endpoint | Auth: `adminLimiter`
modules, templates CRUD (5), my, accessible-modules, users, user/:userId (get/put), apply-template, check

#### audit-logs.js (`/api/audit-logs`) — 7 endpoint | Auth: `adminLimiter`
list, stats, summary, /:id, user/:userId/activity, entity/:entityType/:entityId, meta/filters

#### database-stats.js (`/api/database-stats`) — 3 endpoint
summary, admin-stats, health-detailed

#### uyumsoft.js (`/api/uyumsoft`) — 14 endpoint
connect, connect-saved, invoice/:ettn, disconnect, status, credentials, sync/blocking, sync/details, invoice/:ettn/pdf, invoice/:ettn/xml, invoice/:ettn/html, invoices, invoices/summary, test

#### mevzuat.js (`/api/mevzuat`) — 5 endpoint
guncel-degerler, formuller, ozet, rehber, gundem

#### sektor-gundem.js (`/api/sektor-gundem`) — 4 endpoint
ihale, istihbarat, firma, usage

#### duplicate-check.js (`/api/duplicates`) — 7 endpoint
check, check-batch, list, mark, /:id/review, savings, auto-clean

#### import.js (`/api/import`) — 8 endpoint
info, schema/:type, analyze, confirm, cancel, menu-analyze, menu-save, template/:type

#### prompt-builder.js (`/api/prompt-builder`) — 19 endpoint
categories, categories/:slug, questions, templates, template/:id, generate, save, saved, saved/:id (get/patch/delete), stats, gallery, my-stats, ask, transform, optimize, popular-categories, seed

#### analysis-corrections.js (`/api/analysis-corrections`) — 16 endpoint
/:tenderId (get), stats/summary, / (post), /batch, /confirm, /:id (delete), /sync, stats/training, retrain/status, retrain/trigger, azure/models, azure/models/:modelId, azure/health, /learn, /learned-patterns, correction-hints/:promptType

#### tender-cards.js (`/api/tender-cards`) — 5 endpoint
/:tenderId (get/post), /:id (put), /:id/reorder (put), /:id (delete)

#### masa-paketleri.js (`/api/masa-paketleri`) — 4 endpoint
/:tenderId (get/post/patch), /:tenderId/versions (get)

#### document-annotations.js (`/api/document-annotations`) — 5 endpoint
/:documentId (get), /tender/:tenderId (get), / (post), /:id (put/delete)

---

## 2. Sorunlu Alanlar

### 2.1 Entity Parçalanması (Aynı varlık birden fazla dosyada)

| Entity | Dosya Sayısı | Dosyalar | Sorun |
|--------|-------------|----------|-------|
| **İhale** | 8 | tenders, tender-tracking, tender-docs, tender-content, ihale-sonuclari, teklifler, tender-dilekce, tender-cards | Her ihale alt-kavramı ayrı route dosyasında |
| **İK/Personel** | 5 | personel, bordro, maas-odeme, izin, bordro-import | HR modülü 5 dosyaya dağılmış |
| **Fatura** | 3 | invoices, fatura-kalemler, etiketler (fatura/) | İki farklı fatura CRUD kaynağı |
| **Döküman** | 4 | documents, document-proxy, tender-docs, tender-content | Döküman yönetimi 4 ayrı yerde |
| **Ürün/Stok** | 3 | stok, urunler, planlama (ana-urunler) | Ürün CRUD 3 farklı dosyada |
| **Proje** | 4 | projeler, proje-hareketler, personel/projeler, satin-alma/projeler | Proje listesi 4 yerde tekrarlanıyor |
| **AI** | 6 | ai, ai-memory, ai-ihale-masasi, ai-god-mode, ai-analysis, ai-prompts | AI modülü 6 dosyada |
| **Rapor** | 2 | reports, export | Rapor çıktısı 2 ayrı dosyada |

### 2.2 Auth Middleware Eksiklikleri

**Kritik: Auth middleware OLMAYAN route'lar (server.js seviyesinde):**

| Route | Endpoint Sayısı | Risk |
|-------|----------------|------|
| `/api/tenders` | 13 | YÜKSEK — İhale verisi |
| `/api/documents` | 11 | YÜKSEK — Döküman yükleme/silme |
| `/api/invoices` | 9 | YÜKSEK — Fatura CRUD |
| `/api/fatura-kalemleri` | 17 | YÜKSEK — Fatura kalemleri |
| `/api/cariler` | 8 | YÜKSEK — Cari silme/oluşturma |
| `/api/stok` | 27 | YÜKSEK — Stok hareketi |
| `/api/urunler` | 21 | YÜKSEK — Ürün CRUD |
| `/api/personel` | 28 | YÜKSEK — Personel CRUD |
| `/api/bordro` | 11 | YÜKSEK — Bordro hesaplama |
| `/api/maas-odeme` | 15 | YÜKSEK — Maaş ödeme |
| `/api/izin` | 9 | ORTA — İzin yönetimi |
| `/api/kasa-banka` | 16 | YÜKSEK — Finansal işlem |
| `/api/proje-hareketler` | 8 | YÜKSEK — Gelir/gider |
| `/api/contractors` | 43 | ORTA — Yüklenici istihbarat |
| `/api/tender-tracking` | 16 | ORTA — İhale takip |
| `/api/ihale-sonuclari` | 15 | ORTA — İhale sonuçları |
| `/api/teklifler` | 6 | YÜKSEK — Teklif verileri |
| `/api/firmalar` | 30 | YÜKSEK — Firma silme (auth kendi içinde) |
| `/api/export` | 21 | ORTA — Veri dışa aktarma |
| `/api/notifications` | 10 | DÜŞÜK |
| `/api/mail` | 14 | ORTA — Mail gönderimi |
| `/api/social` | 36 | ORTA — WhatsApp/Instagram |
| `/api/sync` | 12 | ORTA — Senkronizasyon |
| `/api/demirbas` | 21 | ORTA — Demirbaş |
| `/api/satin-alma` | 13 | ORTA — Satın alma |
| `/api/mutabakat` | 5 | ORTA — Mutabakat |
| `/api/tender-dilekce` | 6 | DÜŞÜK |
| **TOPLAM** | **~450** | — |

> **Not:** Bazı route dosyaları kendi içinde `authenticate` middleware kullanıyor olabilir, ama server.js seviyesinde zorunlu kılınmıyor.

### 2.3 REST Convention İhlalleri

**Fiil kullanımı (eylem ismi olmamalı):**
- `/akilli-eslestir` → POST `/eslesme` veya `/matches`
- `/toplu-fatura-isle` → POST `/faturalar/toplu-islem`
- `/faturadan-giris` → POST `/hareketler/fatura`
- `/hesapla`, `/kaydet` → POST ana resource'a
- `/toggle-follow` → PUT `/:id/follow`
- `/tumunu-calistir` → POST `/:id/moduller/run-all`
- `/scrape-analyze` → POST `/:id/analysis`

**Türkçe/İngilizce karışımı:**
- `tenders` (EN) vs `cariler` (TR) vs `contractors` (EN) vs `personel` (TR)
- `invoices` (EN) vs `fatura-kalemleri` (TR)
- `search` (EN) vs `satin-alma` (TR)
- `notifications` (EN) vs `bildirimler` (TR, contractors altında)
- `reports` (EN) vs `raporlar` (TR, fatura-kalemler altında)

**Tutarsız çoğul/tekil:**
- `/api/stok` (tekil) vs `/api/cariler` (çoğul)
- `/api/personel` (tekil) vs `/api/invoices` (çoğul)
- `/api/bordro` (tekil) vs `/api/tenders` (çoğul)

### 2.4 Duplicate İşlevsellik

| İşlev | Tekrar Yerleri | Öneri |
|-------|---------------|-------|
| Ürün arama | `urunler/`, `stok/kartlar/ara`, `fatura-kalemleri/urunler/ara`, `planlama/urun-ara` | Tek servis |
| Proje listesi | `projeler/`, `personel/projeler`, `satin-alma/projeler`, `menu-planlama/projeler`, `bordro-import/projeler` | Tek endpoint, query param |
| Stok giriş | `stok/hareketler/giris`, `urunler/:id/giris`, `stok/faturadan-giris` | Tek giriş noktası |
| Akıllı eşleştirme | `stok/akilli-eslestir`, `urunler/akilli-eslesdir` | Birleştir |
| Fatura listesi | `invoices/`, `fatura-kalemleri/faturalar`, `stok/faturalar`, `uyumsoft/invoices` | 4 farklı fatura kaynağı |
| Kategori listesi | `stok/kategoriler`, `urunler/kategoriler/liste`, `menu-planlama/urun-kategorileri`, `planlama/ana-urunler-kategoriler` | 4 farklı kategori |
| Bildirimler | `notifications/`, `contractors/bildirimler/`, `auth/admin/notifications` | 3 bildirim sistemi |
| AI hafıza | `ai/memory`, `ai/memory/` (sub-router), `ai/learned-facts` | Çakışan memory endpoint'leri |

---

## 3. Kullanım Analizi

### 3.1 Frontend'den Çağrılmayan Endpoint'ler (Ölü/Potansiyel)

| Mount | Endpoint Sayısı | Durum |
|-------|----------------|-------|
| `/api/content/*` | 3 | ÖLÜ — Frontend'de import yok |
| `/api/uyumsoft/*` | 14 | ÖLÜ — Legacy entegrasyon |
| `/api/duplicates/*` | 7 | ÖLÜ — Frontend'de çağrı yok |
| `/api/import/*` | 8 | ÖLÜ — Frontend'de çağrı yok |
| `/api/prompt-builder/*` | 19 | ÖLÜ — AI templates ile değiştirilmiş |
| `/api/analysis-corrections/*` | 16 | ÖLÜ — Frontend'de çağrı yok |
| `/api/ai-prompts/*` | (sub-router) | ÖLÜ — Superseded |
| `/api/ai-helpers/*` | (sub-router) | ÖLÜ — Superseded |
| `fatura-kalemler/debug/*` | 1 | ÖLÜ — Debug endpoint |
| **Toplam potansiyel ölü** | **~70+** | — |

### 3.2 En Yoğun Kullanılan Endpoint'ler (Frontend)

| Endpoint | Çağıran Component Sayısı |
|----------|-------------------------|
| `/api/menu-planlama/receteler` | 10+ |
| `/api/notes/*` | 15+ |
| `/api/fatura-kalemleri/*` | 12+ |
| `/api/tender-tracking/*` | 10+ |
| `/api/tenders` | 8+ |
| `/api/projeler` | 8+ |
| `/api/menu-planlama/menu-planlari` | 8+ |
| `/api/notifications` | 8+ |
| `/api/cariler` | 7+ |
| `/api/ai/ihale-masasi/*` | 6+ |

### 3.3 Service Dosyası Olmayan Direkt API Çağrıları

| Dosya | Endpoint | Sorun |
|-------|----------|-------|
| `useMasaVeriPaketi.ts` | `/api/masa-paketleri/*` | Service dosyası yok |
| `useDocumentAnnotations.ts` | `/api/document-annotations/*` | Service dosyası yok |
| `SchedulersSection.tsx` | `/api/system/schedulers/*` | Direkt fetch |
| `GodModeTerminal.tsx` | `/api/system/terminal/*` | Direkt fetch |
| `PageScraper.tsx` | `/api/scraper/trigger` | Direkt fetch |

### 3.4 Ağır Component'ler (5+ API çağrısı)

| Component | API Çağrısı | Modül |
|-----------|------------|-------|
| `FaturaIslemModal.tsx` | 10+ | Stok |
| `ReceteDetayModal.tsx` | 8+ | Menü Planlama |
| `PlanlamaWorkspace.tsx` | 8+ | Menü Planlama |
| `MenuTakvim.tsx` | 6+ | Menü Planlama |
| `IngredientMatchPanel.tsx` | 6+ | İhale Merkezi |
| `CariDetailDrawer.tsx` | 5+ | Finans |
| `ProjeYonetimModal.tsx` | 5+ | Muhasebe |

---

## 4. Öneriler

### 4.1 Birleştirilmesi Gereken Endpoint'ler

| Mevcut | Öneri | Kazanım |
|--------|-------|---------|
| `tenders` + `tender-tracking` + `tender-cards` + `tender-dilekce` + `ihale-sonuclari` + `teklifler` | `/api/tenders/:id/tracking`, `/api/tenders/:id/cards`, `/api/tenders/:id/dilekce`, `/api/tenders/:id/sonuc`, `/api/tenders/:id/teklif` | 6 dosya → nested route'lar |
| `documents` + `document-proxy` + `tender-docs` + `tender-content` | `/api/documents` (tek giriş), alt-path'ler: `/tender/:id/docs`, `/queue/*` | 4 dosya → 1 dosya |
| `invoices` + `fatura-kalemler` | `/api/invoices/:ettn/kalemler` nested | 2 dosya → 1 dosya |
| `projeler` + `proje-hareketler` | `/api/projeler/:id/hareketler` nested | 2 dosya → 1 dosya |
| `reports` + `export` | `/api/reports` tek giriş | 2 dosya → 1 dosya |
| `personel/projeler` + `satin-alma/projeler` + `bordro-import/projeler` + `menu-planlama/projeler` | Tek `/api/projeler` endpoint'ini kullansınlar | Duplike kaldır |

### 4.2 Composite/Dashboard Endpoint Gereken Yerler

| Sayfa | Şu An | Öneri |
|-------|-------|-------|
| İhale Detay | 5+ ayrı çağrı (tender, tracking, cards, dilekce, sonuc) | `GET /api/tenders/:id/full` |
| Proje Detay | 4+ çağrı (proje, personel, hareketler, siparisler) | `GET /api/projeler/:id/tam-ozet` (zaten var) |
| Finans Dashboard | cariler + kasa-banka + projeler + invoices | `GET /api/dashboard/finans` |
| Personel Detay | personel + bordro + maas-odeme + izin | `GET /api/personel/:id/tam-profil` |

### 4.3 Silinmesi/Deprecate Edilmesi Gereken Endpoint'ler

| Endpoint | Sebep |
|----------|-------|
| `/api/content/*` (3 ep) | Frontend'den çağrılmıyor |
| `/api/uyumsoft/*` (14 ep) | sync.js ile değiştirilmiş görünüyor |
| `/api/duplicates/*` (7 ep) | Frontend'den çağrılmıyor |
| `/api/import/*` (8 ep) | Frontend'den çağrılmıyor, menu-import ile çakışıyor |
| `/api/prompt-builder/*` (19 ep) | AI templates ile değiştirilmiş |
| `/api/analysis-corrections/*` (16 ep) | Frontend'den çağrılmıyor |
| `/api/ai/chat` (1 ep) | Legacy, `/api/ai/agent` ile değiştirilmiş |
| `POST /tender-docs/:tenderId/download-documents` | Redirect, merkez-scraper ile aynı |
| `GET /api/stats` (backward alias) | system/stats'a redirect |
| `GET /api/logs/recent` (backward alias) | system/logs/recent'a redirect |
| `fatura-kalemler/debug/*` | Debug endpoint |
| **Toplam** | **~70 endpoint** |

### 4.4 İsimlendirme Düzeltmeleri

| Mevcut | Önerilen | Sebep |
|--------|----------|-------|
| `/api/cariler` | `/api/customers` veya tutarlı Türkçe | EN/TR tutarsızlık |
| `/api/fatura-kalemleri` | `/api/invoices/:ettn/items` | Nested resource |
| `/api/proje-hareketler` | `/api/projeler/:id/transactions` | Nested resource |
| `/api/ihale-sonuclari` | `/api/tenders/:id/results` | Nested resource |
| `/api/maas-odeme` | `/api/payroll/payments` | Tutarlılık |
| `/api/kasa-banka` | `/api/treasury` | Daha kısa |
| `/api/bordro-import` | `/api/payroll/import` | Nested |
| `/api/satin-alma` | `/api/procurement` | Tutarlılık |

### 4.5 Auth Eklenmesi Gereken Route'lar (Öncelikli)

**Hemen eklenecekler (server.js seviyesinde `authenticate`):**
1. `/api/invoices` — Fatura CRUD
2. `/api/fatura-kalemleri` — Fatura kalemleri
3. `/api/cariler` — Cari CRUD
4. `/api/stok` — Stok hareketleri
5. `/api/urunler` — Ürün CRUD
6. `/api/personel` — Personel CRUD
7. `/api/bordro` — Bordro
8. `/api/maas-odeme` — Maaş ödeme
9. `/api/kasa-banka` — Kasa/Banka
10. `/api/proje-hareketler` — Gelir/gider
11. `/api/teklifler` — Teklif verileri
12. `/api/satin-alma` — Satın alma
13. `/api/export` — Veri dışa aktarma

**İkinci öncelik:**
14. `/api/tenders` — optionalAuth yapılabilir
15. `/api/contractors` — optionalAuth
16. `/api/tender-tracking` — authenticate
17. `/api/ihale-sonuclari` — authenticate
18. `/api/demirbas` — authenticate
19. `/api/mail` — authenticate
20. `/api/social` — authenticate

---

## Özet Sayılar

| Metrik | Değer |
|--------|-------|
| Toplam endpoint | ~680 |
| Route dosyası | 78 |
| server.js mount noktası | 57 |
| Auth korumalı route (server.js) | 12 (%21) |
| Auth korumasız route | 45 (%79) |
| Frontend'den çağrılan | ~300 |
| Potansiyel ölü endpoint | ~70 |
| Duplike işlevsellik | 8 kategori |
| REST convention ihlali | 20+ path |
