-- =====================================================
-- Yüklenici Kütüphanesi: Ana Yükleniciler Tablosu
-- Rakip firma takip ve analiz sistemi
-- =====================================================

CREATE TABLE IF NOT EXISTS yukleniciler (
    id SERIAL PRIMARY KEY,
    
    -- Temel bilgiler
    unvan TEXT NOT NULL,
    kisa_ad TEXT,
    
    -- İstatistikler (scraper tarafından güncellenir)
    katildigi_ihale_sayisi INTEGER DEFAULT 0,
    kazanma_orani NUMERIC(5,2) DEFAULT 0,
    tamamlanan_is_sayisi INTEGER DEFAULT 0,
    devam_eden_is_sayisi INTEGER DEFAULT 0,
    toplam_sozlesme_bedeli NUMERIC(15,2) DEFAULT 0,
    ortalama_indirim_orani NUMERIC(5,2),
    
    -- Coğrafi ve sektörel
    aktif_sehirler JSONB DEFAULT '[]'::jsonb,
    
    -- Tarihler
    son_ihale_tarihi DATE,
    
    -- Kullanıcı değerlendirmesi
    puan INTEGER DEFAULT 0 CHECK (puan >= 0 AND puan <= 5),
    takipte BOOLEAN DEFAULT false,
    istihbarat_takibi BOOLEAN DEFAULT false,
    etiketler TEXT[] DEFAULT '{}',
    notlar TEXT,
    
    -- Risk bilgileri
    fesih_sayisi INTEGER DEFAULT 0,
    risk_notu TEXT,
    kik_sikayet_sayisi INTEGER DEFAULT 0,
    
    -- ihalebul.com analiz verisi (JSONB — tüm analiz sayfası verileri)
    analiz_verisi JSONB DEFAULT NULL,
    analiz_scraped_at TIMESTAMP DEFAULT NULL,
    
    -- Kaynak ve izleme
    ihalebul_url TEXT,
    veri_kaynaklari JSONB DEFAULT '[]'::jsonb,
    
    -- Zaman damgaları
    scraped_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Benzersizlik: aynı firma iki kez girilemesin
    UNIQUE(unvan)
);

-- === İndeksler ===
-- Arama
CREATE INDEX IF NOT EXISTS idx_yukleniciler_unvan_trgm ON yukleniciler USING gin (unvan gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_yukleniciler_kisa_ad ON yukleniciler(kisa_ad);

-- Filtreleme
CREATE INDEX IF NOT EXISTS idx_yukleniciler_takipte ON yukleniciler(takipte) WHERE takipte = true;
CREATE INDEX IF NOT EXISTS idx_yukleniciler_istihbarat ON yukleniciler(istihbarat_takibi) WHERE istihbarat_takibi = true;
CREATE INDEX IF NOT EXISTS idx_yukleniciler_aktif_sehirler ON yukleniciler USING gin (aktif_sehirler);
CREATE INDEX IF NOT EXISTS idx_yukleniciler_etiketler ON yukleniciler USING gin (etiketler);

-- Sıralama
CREATE INDEX IF NOT EXISTS idx_yukleniciler_sozlesme_bedeli ON yukleniciler(toplam_sozlesme_bedeli DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_yukleniciler_kazanma_orani ON yukleniciler(kazanma_orani DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_yukleniciler_son_ihale ON yukleniciler(son_ihale_tarihi DESC NULLS LAST);

-- Analiz verisi
CREATE INDEX IF NOT EXISTS idx_yukleniciler_analiz_scraped ON yukleniciler(analiz_scraped_at) WHERE analiz_scraped_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_yukleniciler_analiz_verisi_gin ON yukleniciler USING GIN (analiz_verisi) WHERE analiz_verisi IS NOT NULL;

-- === Trigram extension (arama için gerekli) ===
-- NOT: Eğer trigram extension yoksa bu index oluşmaz, sorun değil
-- Production'da "CREATE EXTENSION IF NOT EXISTS pg_trgm;" çalıştırılmış olmalı

COMMENT ON TABLE yukleniciler IS 'Yüklenici (rakip firma) kütüphanesi — ihale kazanan/kaybeden firmaların takip ve analiz veritabanı';
COMMENT ON COLUMN yukleniciler.analiz_verisi IS 'ihalebul.com /analyze sayfasından çekilen tüm veriler: özet, yıllık trend, idareler, rakipler, ortak girişimler, şehirler, sektörler, ihale usulleri, teklif türleri';
COMMENT ON COLUMN yukleniciler.istihbarat_takibi IS 'true ise ihale geçmişi periyodik olarak otomatik çekilir';
