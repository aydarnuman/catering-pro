# Yuklenici Kutuphanesi - Tam Sistem Diyagrami

## 1. Komponent Mimarisi (1836 satir, tek dosya)

```
frontend/src/app/yuklenici-kutuphanesi/page.tsx
│
├── YukleniciKutuphanesiPage (Ana Sayfa)     [satir 68-471]
│   ├── Header (baslik + butonlar)
│   ├── Scrape Progress Bar
│   ├── Dashboard Stats (6 kart)
│   ├── Search + Filtreler
│   ├── Yuklenici Tablosu (sayfalama)
│   └── Modal → YukleniciProfilModal
│
├── YukleniciProfilModal (Detay Modal)       [satir 476-1118]
│   ├── Modal Header (takip/istihbarat butonlari)
│   ├── Stats Row (5 kart)
│   └── Tabs:
│       ├── "Genel" → AI Profil Ozeti, Sehir Dagilimi, Son Kazanilan
│       ├── "Analiz" → AnalyzTabContent
│       ├── "Ihale Gecmisi" → IhaleGecmisiTabContent
│       └── "Risk / Notlar" → Fesih, KIK, Notlar
│
├── AnalyzTabContent                         [satir 1122-1461]
│   ├── Ozet Stat Kartlari (6 mini kart)
│   └── Alt Tablar (pills):
│       ├── Yillik Trend (tablo)
│       ├── Idareler (tablo)
│       ├── Rakipler (tablo)
│       ├── Ortak Girisim (kart listesi)
│       ├── Sehirler (tablo)
│       └── Dagilimlar (ihale usulleri, teklif turleri, sektorler)
│
├── IhaleGecmisiTabContent                   [satir 1465-1813]
│   ├── Filtreler (arama, sehir, durum, yil)
│   ├── Durum gruplama mantigi
│   └── Ihale Listesi (2 kaynak: ihalebul + DB)
│
└── StatMiniCard (yardimci)                  [satir 1817-1835]
```

## 2. Veri Akisi

```
┌──────────────────────────────────────────────────────────────────────┐
│                          FRONTEND STATE                              │
│                                                                      │
│  YukleniciKutuphanesiPage:                                           │
│  ├── yukleniciler[]         ← GET /contractors?page&sort&search      │
│  ├── stats                  ← GET /contractors/stats                 │
│  ├── scrapeStatus           ← GET /contractors/scrape/status (poll)  │
│  ├── search, page, sort     → Query params                          │
│  └── takipteFilter          → Filter flag                           │
│                                                                      │
│  YukleniciProfilModal:                                               │
│  ├── data                   ← GET /contractors/:id                   │
│  │   ├── .yuklenici         → Firma bilgileri                       │
│  │   ├── .ihaleler[]        → ihalebul kaynagli ihale gecmisi       │
│  │   ├── .kazanilanIhaleler → DB kaynagli kazanilan ihaleler        │
│  │   └── .sehirDagilimi     → Sehir bazli dagılım                  │
│  ├── aiOzet                 ← GET /contractors/:id/ai-ozet          │
│  ├── riskData               ← GET /contractors/:id/risk             │
│  │   ├── .fesihler[]        → Fesih kayitlari                      │
│  │   └── .riskNotlari[]     → Risk notlari                         │
│  └── notlar                 → PATCH /contractors/:id                 │
│                                                                      │
│  AnalyzTabContent:                                                   │
│  └── analiz (prop)          → yuklenici.analiz_verisi               │
│      ├── .ozet              → Genel istatistikler                   │
│      ├── .yillik_trend[]    → Yıl bazlı performans                 │
│      ├── .idareler[]        → Calisilan kurumlar                    │
│      ├── .rakipler[]        → Rakip firmalar                        │
│      ├── .ortak_girisimler  → Is ortaklari                          │
│      ├── .sehirler[]        → Sehir bazli aktivite                  │
│      ├── .sektorler[]       → CPV kodlari                           │
│      ├── .ihale_usulleri[]  → Acik/kapali/davet vb.                 │
│      └── .teklif_turleri[]  → Birim fiyat/goturü vb.               │
└──────────────────────────────────────────────────────────────────────┘
```

## 3. Backend API Endpoint'leri

```
/api/contractors (authenticate middleware tümüne uygulanır)
│
├── CRUD İşlemleri
│   ├── GET    /                           → Liste (sayfalama, arama, sıralama)
│   ├── GET    /stats                      → Dashboard istatistikleri
│   ├── GET    /:id                        → Detay (yuklenici + ihaleler + sehir)
│   └── PATCH  /:id                        → Güncelle (puan, notlar, etiketler)
│
├── Takip / İstihbarat
│   ├── POST   /:id/toggle-follow          → Takip aç/kapa
│   └── POST   /:id/toggle-istihbarat      → İstihbarat aç/kapa + scrape tetikle
│
├── Scraping (ihalebul.com)
│   ├── POST   /scrape                     → Liste taramasi başlat
│   ├── GET    /scrape/status              → Tarama durumu (polling)
│   ├── POST   /scrape/stop               → Taramayı durdur
│   ├── POST   /scrape/participants        → Katılımcı taramasi
│   ├── POST   /scrape/tender-history      → İhale geçmişi taraması
│   ├── POST   /:id/scrape-history         → Tek yüklenici ihale geçmişi
│   └── POST   /:id/scrape-analyze         → Analiz sayfası taraması
│
├── Analiz & AI
│   ├── GET    /:id/analyze                → Analiz verisi getir
│   ├── GET    /:id/ai-ozet               → AI profil özeti oluştur
│   └── GET    /tender/:id/ai-rakip-analiz → AI rakip analizi
│
├── Risk
│   ├── GET    /:id/risk                   → Fesihler + risk notları
│   └── PATCH  /:id/risk                   → Risk notu güncelle
│
├── Analytics
│   ├── GET    /analytics/pazar            → Pazar büyüklüğü analizi
│   └── GET    /analytics/fiyat-tahmini    → Fiyat tahmini
│
├── Meta
│   ├── GET    /meta/etiketler             → Etiket listesi
│   └── GET    /meta/sehirler              → Şehir listesi
│
└── Listeleme
    ├── GET    /karsilastir?ids=1,2,3      → Yüklenici karşılaştırma
    ├── GET    /en-aktif                   → En aktif yükleniciler
    ├── GET    /sehir-bazli               → Şehir bazlı dağılım
    └── GET    /:id/tenders               → Yüklenici ihaleleri
```

## 4. Scraping Akisi

```
┌──────────────┐     POST /scrape      ┌──────────────────────┐
│   Frontend   │ ──────────────────→   │  contractors.js      │
│   (Button)   │                       │  scrapeState {}      │
└──────┬───────┘                       │  (in-memory state)   │
       │                               └──────────┬───────────┘
       │  polling (2s)                             │
       │  GET /scrape/status                       ▼
       │◄──────────────────────        ┌──────────────────────┐
       │                               │  Puppeteer Scraper   │
       │                               │  ├── login-service   │
       │  progress bar update          │  ├── list-scraper    │
       │◄──────────────────────        │  ├── participant-    │
       │                               │  │   scraper         │
       │  tamamlandi                   │  ├── contractor-     │
       │◄──────────────────────        │  │   tender-scraper  │
       │                               │  └── analyze-page-   │
       ▼                               │      scraper         │
  fetchYukleniciler()                  └──────────────────────┘
  fetchStats()                              │
                                            ▼
                                       ihalebul.com
                                       (headless browser)
```

## 5. Tip Sistemi

```
frontend/src/types/yuklenici.ts
│
├── Yuklenici              → Ana firma tipi (33 alan)
├── AnalyzData             → ihalebul /analyze sayfasi verisi
│   ├── AnalyzOzet
│   ├── AnalyzYillikTrend
│   ├── AnalyzIdare
│   ├── AnalyzRakip
│   ├── AnalyzOrtakGirisim
│   ├── AnalyzSehir
│   ├── AnalyzSektor
│   └── AnalyzDagilim
├── StatsData              → Dashboard istatistikleri
├── ScrapeStatus           → Tarama durumu
├── SortField              → Sıralama seçenekleri (7 alan)
├── YukleniciDetay         → Profil modal verisi
├── YukleniciIhale         → ihalebul kaynaklı ihale
├── KazanilanIhale         → DB kaynakli kazanilan ihale
├── YukleniciKarsilastirma → Karşılaştırma (Phase 3)
└── formatCurrency()       → Para formatı yardımcısı
```

## 6. Kullanilmayan Hook'lar (useYukleniciler.ts)

```
frontend/src/hooks/useYukleniciler.ts (React Query tabanlı)
│
│  ⚠️  Bu dosya YAZILMIŞ ama page.tsx KULLANMIYOR!
│  page.tsx kendi useState + fetch mantığını kullanıyor.
│
├── useYukleniciList()     → Liste hook (React Query)
├── useYukleniciStats()    → İstatistik hook
├── useYukleniciDetay()    → Detay hook
├── useScrapeStatus()      → Scrape polling hook
├── useTakipToggle()       → Mutation
├── useIstihbaratToggle()  → Mutation
├── useStartScrape()       → Mutation
├── useSaveNotlar()        → Mutation
├── useScrapeHistory()     → Mutation
└── useScrapeAnalyze()     → Mutation
```

## 7. Sorunlar ve Refactor Onerileri

```
┌─────────────────────────────────────────────────────────────────┐
│                         SORUNLAR                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. TEK DOSYA DEVİ (1836 satır, 5 komponent)                    │
│     → Bakım, test ve code review zorlaşıyor                     │
│                                                                  │
│  2. useYukleniciler.ts KULLANILMIYOR                             │
│     → React Query hook'ları hazır ama sayfa hâlâ                │
│       useState + useCallback + manuel polling kullanıyor         │
│     → Cache yok, her modal açılışta tekrar fetch                 │
│     → Optimistic update yok                                      │
│                                                                  │
│  3. POLLING MEKANİZMASI                                          │
│     → 3 ayrı yerde setInterval/clearInterval tekrarı             │
│     → useScrapeStatus hook'u bu işi otomatik yapabilir           │
│                                                                  │
│  4. DUPLICATED mFetch                                            │
│     → Hem ana sayfada hem modal'da aynı mFetch tanımlı           │
│     → apiFetch (useYukleniciler.ts) zaten var                    │
│                                                                  │
│  5. TİP GÜVENLİĞİ ZAYIF                                        │
│     → ihaleler: Array<Record<string, unknown>>                   │
│     → Tip tanımı var (YukleniciIhale) ama kullanılmıyor          │
│                                                                  │
│  6. MODAL İÇİNDE ÇOK FAZLA STATE                                │
│     → 15+ useState hook'u tek component'ta                       │
│     → useReducer veya ayırma gerekli                             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     ÖNERILEN REFACTOR                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  frontend/src/app/yuklenici-kutuphanesi/                         │
│  ├── page.tsx                  → Ana sayfa (sadece liste)        │
│  ├── components/                                                 │
│  │   ├── YukleniciTable.tsx    → Tablo + sıralama                │
│  │   ├── YukleniciProfilModal.tsx → Detay modal                  │
│  │   ├── AnalyzTabContent.tsx  → Analiz tab                      │
│  │   ├── IhaleGecmisiTab.tsx   → İhale geçmişi tab              │
│  │   ├── RiskTab.tsx           → Risk/notlar tab                 │
│  │   ├── DashboardStats.tsx    → Üst istatistik kartları         │
│  │   └── ScrapeProgress.tsx    → Tarama progress bar             │
│  └── hooks/                                                      │
│      └── → useYukleniciler.ts'ye geçiş (React Query)            │
│                                                                  │
│  Faydalar:                                                       │
│  • Her dosya <300 satır                                          │
│  • React Query ile otomatik cache + refetch                      │
│  • Polling mantığı useScrapeStatus'a taşınır                     │
│  • Tip güvenliği artar (Record<string,unknown> → YukleniciIhale) │
│  • Test yazılabilir hale gelir                                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## 8. Veri Kaynaklari

```
                    ┌────────────────┐
                    │  ihalebul.com  │
                    │  (Web Scrape)  │
                    └───────┬────────┘
                            │
            ┌───────────────┼───────────────┐
            │               │               │
            ▼               ▼               ▼
    ┌───────────┐   ┌───────────┐   ┌───────────┐
    │ Liste     │   │ Analiz    │   │ İhale     │
    │ Scraper   │   │ Page      │   │ Geçmişi   │
    │           │   │ Scraper   │   │ Scraper   │
    └─────┬─────┘   └─────┬─────┘   └─────┬─────┘
          │               │               │
          ▼               ▼               ▼
    ┌─────────────────────────────────────────┐
    │            Supabase DB                   │
    │  ├── yukleniciler (ana tablo)            │
    │  ├── yuklenici_ihaleleri (scrape)        │
    │  └── tenders (DB kaynakli ihaleler)      │
    └─────────────────────────────────────────┘
          │               │               │
          ▼               ▼               ▼
    ┌─────────────────────────────────────────┐
    │        /api/contractors/:id              │
    │  → yuklenici bilgileri                   │
    │  → ihaleler (yuklenici_ihaleleri)       │
    │  → kazanilanIhaleler (tenders tablosu)  │
    │  → sehirDagilimi (aggregate)            │
    └─────────────────────────────────────────┘
```
