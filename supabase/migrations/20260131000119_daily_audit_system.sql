-- =============================================
-- Daily Audit System - Günlük AI Denetim Sistemi
-- Migration: 119
-- Tarih: 2026-01-31
-- =============================================

-- Denetim çalıştırma durumları
DO $$ BEGIN
    CREATE TYPE audit_run_status AS ENUM ('running', 'completed', 'failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Bulgu önem seviyeleri
DO $$ BEGIN
    CREATE TYPE audit_severity AS ENUM ('kritik', 'orta', 'dusuk');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Bulgu kategorileri
DO $$ BEGIN
    CREATE TYPE audit_category AS ENUM ('recete', 'menu', 'fiyat');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Bulgu durumları
DO $$ BEGIN
    CREATE TYPE audit_finding_status AS ENUM ('beklemede', 'onaylandi', 'reddedildi', 'duzeltildi', 'otomatik_duzeltildi');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Düzeltme tipleri
DO $$ BEGIN
    CREATE TYPE audit_fix_type AS ENUM ('otomatik', 'manuel');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =============================================
-- 1. daily_audit_runs - Denetim çalıştırma kayıtları
-- =============================================
CREATE TABLE IF NOT EXISTS daily_audit_runs (
    id SERIAL PRIMARY KEY,
    baslangic_zamani TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    bitis_zamani TIMESTAMP WITH TIME ZONE,
    durum audit_run_status DEFAULT 'running',
    
    -- İstatistikler
    toplam_sorun INTEGER DEFAULT 0,
    otomatik_duzeltilen INTEGER DEFAULT 0,
    onay_bekleyen INTEGER DEFAULT 0,
    
    -- Kategori bazlı sayılar
    recete_sorun INTEGER DEFAULT 0,
    menu_sorun INTEGER DEFAULT 0,
    fiyat_sorun INTEGER DEFAULT 0,
    
    -- AI analiz özeti
    ai_genel_degerlendirme TEXT,
    ai_oncelikli_aksiyonlar JSONB DEFAULT '[]'::jsonb,
    
    -- Detaylı özet
    ozet_json JSONB DEFAULT '{}'::jsonb,
    
    -- Hata durumunda
    hata_mesaji TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- 2. daily_audit_findings - Tespit edilen sorunlar
-- =============================================
CREATE TABLE IF NOT EXISTS daily_audit_findings (
    id SERIAL PRIMARY KEY,
    audit_run_id INTEGER NOT NULL REFERENCES daily_audit_runs(id) ON DELETE CASCADE,
    
    -- Kategori ve tip
    kategori audit_category NOT NULL,
    sorun_tipi VARCHAR(100) NOT NULL,
    onem_seviyesi audit_severity DEFAULT 'orta',
    
    -- İlgili kayıt
    ilgili_tablo VARCHAR(100),
    ilgili_id INTEGER,
    ilgili_kod VARCHAR(100),
    ilgili_ad VARCHAR(255),
    
    -- Sorun detayı
    aciklama TEXT NOT NULL,
    detay_json JSONB DEFAULT '{}'::jsonb,
    
    -- AI analizi
    ai_analizi TEXT,
    ai_kok_neden TEXT,
    ai_etki_analizi TEXT,
    
    -- Önerilen düzeltme
    onerilen_duzeltme_json JSONB,
    otomatik_duzeltme_uygun BOOLEAN DEFAULT FALSE,
    
    -- Durum
    durum audit_finding_status DEFAULT 'beklemede',
    
    -- İşlem bilgileri
    isleme_alan_kullanici_id INTEGER,
    isleme_alinma_zamani TIMESTAMP WITH TIME ZONE,
    red_nedeni TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- 3. daily_audit_fixes - Düzeltme geçmişi
-- =============================================
CREATE TABLE IF NOT EXISTS daily_audit_fixes (
    id SERIAL PRIMARY KEY,
    finding_id INTEGER NOT NULL REFERENCES daily_audit_findings(id) ON DELETE CASCADE,
    
    -- Düzeltme tipi
    duzeltme_tipi audit_fix_type NOT NULL,
    
    -- Değişiklik detayları
    onceki_deger_json JSONB,
    yeni_deger_json JSONB,
    
    -- SQL sorgusu (debug için)
    uygulanan_sql TEXT,
    
    -- Kim yaptı
    onaylayan_kullanici_id INTEGER,
    
    -- Ne zaman
    uygulama_zamani TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Başarı durumu
    basarili BOOLEAN DEFAULT TRUE,
    hata_mesaji TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- 4. daily_audit_config - Denetim yapılandırması
-- =============================================
CREATE TABLE IF NOT EXISTS daily_audit_config (
    id SERIAL PRIMARY KEY,
    config_key VARCHAR(100) UNIQUE NOT NULL,
    config_value JSONB NOT NULL,
    aciklama TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Varsayılan yapılandırma değerleri
INSERT INTO daily_audit_config (config_key, config_value, aciklama) VALUES
('fiyat_esik_gun', '30', 'Fiyat güncelliği için eşik gün sayısı'),
('fiyat_anomali_yuzde', '30', 'Ani fiyat değişimi alarm yüzdesi'),
('kategori_sapma_yuzde', '100', 'Kategori ortalamasından sapma alarm yüzdesi'),
('ai_guven_esik', '50', 'AI tahmini minimum güven skoru'),
('maliyet_asim_yuzde', '120', 'Menü bütçe aşım alarm yüzdesi'),
('ayni_yemek_hafta_limit', '2', 'Aynı yemeğin haftada tekrar limiti'),
('ardisik_kategori_limit', '3', 'Aynı kategoriden ardışık gün limiti'),
('porsiyon_min_gramaj', '50', 'Minimum porsiyon gramajı (g)'),
('porsiyon_max_gramaj', '2000', 'Maksimum porsiyon gramajı (g)'),
('otomatik_duzeltme_aktif', 'true', 'Otomatik düzeltme aktif mi')
ON CONFLICT (config_key) DO NOTHING;

-- =============================================
-- İndeksler
-- =============================================
CREATE INDEX IF NOT EXISTS idx_audit_runs_durum ON daily_audit_runs(durum);
CREATE INDEX IF NOT EXISTS idx_audit_runs_tarih ON daily_audit_runs(baslangic_zamani DESC);

CREATE INDEX IF NOT EXISTS idx_audit_findings_run ON daily_audit_findings(audit_run_id);
CREATE INDEX IF NOT EXISTS idx_audit_findings_kategori ON daily_audit_findings(kategori);
CREATE INDEX IF NOT EXISTS idx_audit_findings_durum ON daily_audit_findings(durum);
CREATE INDEX IF NOT EXISTS idx_audit_findings_onem ON daily_audit_findings(onem_seviyesi);
CREATE INDEX IF NOT EXISTS idx_audit_findings_ilgili ON daily_audit_findings(ilgili_tablo, ilgili_id);

CREATE INDEX IF NOT EXISTS idx_audit_fixes_finding ON daily_audit_fixes(finding_id);
CREATE INDEX IF NOT EXISTS idx_audit_fixes_tip ON daily_audit_fixes(duzeltme_tipi);

-- =============================================
-- Trigger: updated_at otomatik güncelleme
-- =============================================
CREATE OR REPLACE FUNCTION update_audit_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_runs_updated ON daily_audit_runs;
CREATE TRIGGER trg_audit_runs_updated
    BEFORE UPDATE ON daily_audit_runs
    FOR EACH ROW EXECUTE FUNCTION update_audit_updated_at();

DROP TRIGGER IF EXISTS trg_audit_findings_updated ON daily_audit_findings;
CREATE TRIGGER trg_audit_findings_updated
    BEFORE UPDATE ON daily_audit_findings
    FOR EACH ROW EXECUTE FUNCTION update_audit_updated_at();

-- =============================================
-- View: Güncel denetim özeti
-- =============================================
CREATE OR REPLACE VIEW v_audit_dashboard AS
SELECT 
    dar.id as run_id,
    dar.baslangic_zamani,
    dar.bitis_zamani,
    dar.durum,
    dar.toplam_sorun,
    dar.otomatik_duzeltilen,
    dar.onay_bekleyen,
    dar.recete_sorun,
    dar.menu_sorun,
    dar.fiyat_sorun,
    dar.ai_genel_degerlendirme,
    EXTRACT(EPOCH FROM (dar.bitis_zamani - dar.baslangic_zamani)) as sure_saniye,
    (SELECT COUNT(*) FROM daily_audit_findings daf 
     WHERE daf.audit_run_id = dar.id AND daf.onem_seviyesi = 'kritik') as kritik_sayisi,
    (SELECT COUNT(*) FROM daily_audit_findings daf 
     WHERE daf.audit_run_id = dar.id AND daf.durum = 'beklemede') as bekleyen_sayisi
FROM daily_audit_runs dar
ORDER BY dar.baslangic_zamani DESC;

-- =============================================
-- View: Bekleyen onaylar
-- =============================================
CREATE OR REPLACE VIEW v_audit_pending_approvals AS
SELECT 
    daf.id,
    daf.kategori,
    daf.sorun_tipi,
    daf.onem_seviyesi,
    daf.ilgili_tablo,
    daf.ilgili_id,
    daf.ilgili_kod,
    daf.ilgili_ad,
    daf.aciklama,
    daf.ai_analizi,
    daf.ai_kok_neden,
    daf.onerilen_duzeltme_json,
    daf.created_at,
    dar.baslangic_zamani as audit_tarihi
FROM daily_audit_findings daf
JOIN daily_audit_runs dar ON dar.id = daf.audit_run_id
WHERE daf.durum = 'beklemede'
  AND daf.otomatik_duzeltme_uygun = FALSE
ORDER BY 
    CASE daf.onem_seviyesi 
        WHEN 'kritik' THEN 1 
        WHEN 'orta' THEN 2 
        ELSE 3 
    END,
    daf.created_at DESC;

-- =============================================
-- Fonksiyon: Denetim istatistikleri
-- =============================================
CREATE OR REPLACE FUNCTION get_audit_stats(days_back INTEGER DEFAULT 30)
RETURNS TABLE (
    toplam_denetim BIGINT,
    toplam_sorun BIGINT,
    otomatik_duzeltilen BIGINT,
    manuel_duzeltilen BIGINT,
    bekleyen BIGINT,
    kritik_sorun BIGINT,
    en_cok_sorun_kategori TEXT,
    en_cok_sorun_tipi TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(DISTINCT dar.id)::BIGINT as toplam_denetim,
        COALESCE(SUM(dar.toplam_sorun), 0)::BIGINT as toplam_sorun,
        COALESCE(SUM(dar.otomatik_duzeltilen), 0)::BIGINT as otomatik_duzeltilen,
        (SELECT COUNT(*) FROM daily_audit_fixes dafx 
         JOIN daily_audit_findings dafn ON dafn.id = dafx.finding_id
         WHERE dafx.duzeltme_tipi = 'manuel' 
         AND dafx.created_at >= NOW() - (days_back || ' days')::INTERVAL)::BIGINT as manuel_duzeltilen,
        (SELECT COUNT(*) FROM daily_audit_findings dafb 
         WHERE dafb.durum = 'beklemede')::BIGINT as bekleyen,
        (SELECT COUNT(*) FROM daily_audit_findings dafc 
         WHERE dafc.onem_seviyesi = 'kritik' 
         AND dafc.created_at >= NOW() - (days_back || ' days')::INTERVAL)::BIGINT as kritik_sorun,
        (SELECT dafk.kategori::TEXT FROM daily_audit_findings dafk 
         WHERE dafk.created_at >= NOW() - (days_back || ' days')::INTERVAL
         GROUP BY dafk.kategori ORDER BY COUNT(*) DESC LIMIT 1) as en_cok_sorun_kategori,
        (SELECT dafs.sorun_tipi FROM daily_audit_findings dafs 
         WHERE dafs.created_at >= NOW() - (days_back || ' days')::INTERVAL
         GROUP BY dafs.sorun_tipi ORDER BY COUNT(*) DESC LIMIT 1) as en_cok_sorun_tipi
    FROM daily_audit_runs dar
    WHERE dar.baslangic_zamani >= NOW() - (days_back || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql;
