-- ====================================================
-- BORDRO SİSTEMİ - SGK VE MAAŞ HESAPLAMA
-- Migration - 022
-- ====================================================

-- ====================================================
-- 1. PERSONELLER TABLOSUNA BORDRO ALANLARI EKLE
-- ====================================================

-- Medeni durum ve aile bilgileri (AGİ hesabı için)
ALTER TABLE personeller ADD COLUMN IF NOT EXISTS medeni_durum VARCHAR(20) DEFAULT 'bekar';
ALTER TABLE personeller ADD COLUMN IF NOT EXISTS es_calisiyormu BOOLEAN DEFAULT FALSE;
ALTER TABLE personeller ADD COLUMN IF NOT EXISTS cocuk_sayisi INTEGER DEFAULT 0;

-- Engel durumu (vergi indirimi için)
ALTER TABLE personeller ADD COLUMN IF NOT EXISTS engel_derecesi INTEGER DEFAULT 0; -- 0: yok, 1: 1.derece, 2: 2.derece, 3: 3.derece

-- SGK bilgileri
ALTER TABLE personeller ADD COLUMN IF NOT EXISTS sgk_no VARCHAR(20);
ALTER TABLE personeller ADD COLUMN IF NOT EXISTS sgk_giris_tarihi DATE;

-- Brüt maaş alanı (mevcut maas alanını brüt olarak kullanacağız)
-- Ek ödemeler
ALTER TABLE personeller ADD COLUMN IF NOT EXISTS yemek_yardimi DECIMAL(15,2) DEFAULT 0;
ALTER TABLE personeller ADD COLUMN IF NOT EXISTS yol_yardimi DECIMAL(15,2) DEFAULT 0;

-- ====================================================
-- 2. BORDRO KAYITLARI TABLOSU
-- ====================================================
CREATE TABLE IF NOT EXISTS bordro_kayitlari (
    id SERIAL PRIMARY KEY,
    personel_id INTEGER NOT NULL REFERENCES personeller(id) ON DELETE CASCADE,
    
    -- Dönem bilgisi
    yil INTEGER NOT NULL,
    ay INTEGER NOT NULL CHECK (ay >= 1 AND ay <= 12),
    
    -- Çalışma bilgileri
    calisma_gunu INTEGER DEFAULT 30,
    fazla_mesai_saat DECIMAL(10,2) DEFAULT 0,
    
    -- Brüt kazançlar
    brut_maas DECIMAL(15,2) NOT NULL,
    fazla_mesai_ucret DECIMAL(15,2) DEFAULT 0,
    ikramiye DECIMAL(15,2) DEFAULT 0,
    prim DECIMAL(15,2) DEFAULT 0,
    yemek_yardimi DECIMAL(15,2) DEFAULT 0,
    yol_yardimi DECIMAL(15,2) DEFAULT 0,
    diger_kazanc DECIMAL(15,2) DEFAULT 0,
    brut_toplam DECIMAL(15,2) NOT NULL,
    
    -- SGK matrahı
    sgk_matrahi DECIMAL(15,2) NOT NULL,
    
    -- İşçi kesintileri
    sgk_isci DECIMAL(15,2) NOT NULL,         -- %14
    issizlik_isci DECIMAL(15,2) NOT NULL,    -- %1
    toplam_isci_sgk DECIMAL(15,2) NOT NULL,  -- %15
    
    -- Vergi matrahı (Brüt - SGK işçi payı)
    vergi_matrahi DECIMAL(15,2) NOT NULL,
    
    -- Vergiler
    kumulatif_matrah DECIMAL(15,2) NOT NULL, -- Yıl başından itibaren
    gelir_vergisi DECIMAL(15,2) NOT NULL,
    damga_vergisi DECIMAL(15,2) NOT NULL,    -- %0.759
    
    -- AGİ
    agi_tutari DECIMAL(15,2) DEFAULT 0,
    
    -- Net maaş
    net_maas DECIMAL(15,2) NOT NULL,
    
    -- İşveren maliyeti
    sgk_isveren DECIMAL(15,2) NOT NULL,      -- %15.5 (teşvikli)
    issizlik_isveren DECIMAL(15,2) NOT NULL, -- %2
    toplam_isveren_sgk DECIMAL(15,2) NOT NULL,
    toplam_maliyet DECIMAL(15,2) NOT NULL,   -- Brüt + İşveren SGK
    
    -- Ödeme bilgileri
    odeme_durumu VARCHAR(20) DEFAULT 'beklemede' CHECK (odeme_durumu IN ('beklemede', 'odendi', 'iptal')),
    odeme_tarihi DATE,
    odeme_yontemi VARCHAR(30),
    aciklama TEXT,
    
    -- Metadata
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Her personel için her ay tek kayıt
    UNIQUE(personel_id, yil, ay)
);

CREATE INDEX IF NOT EXISTS idx_bordro_personel ON bordro_kayitlari(personel_id);
CREATE INDEX IF NOT EXISTS idx_bordro_donem ON bordro_kayitlari(yil, ay);
CREATE INDEX IF NOT EXISTS idx_bordro_odeme ON bordro_kayitlari(odeme_durumu);

-- ====================================================
-- 3. VERGİ DİLİMLERİ TABLOSU (2024/2025 oranları)
-- ====================================================
CREATE TABLE IF NOT EXISTS vergi_dilimleri (
    id SERIAL PRIMARY KEY,
    yil INTEGER NOT NULL,
    baslangic DECIMAL(15,2) NOT NULL,
    bitis DECIMAL(15,2),  -- NULL = sınırsız
    oran DECIMAL(5,4) NOT NULL,
    
    UNIQUE(yil, baslangic)
);

-- 2025 vergi dilimleri (tahmini - güncellenmeli)
INSERT INTO vergi_dilimleri (yil, baslangic, bitis, oran) VALUES
(2025, 0, 110000, 0.15),
(2025, 110000, 230000, 0.20),
(2025, 230000, 580000, 0.27),
(2025, 580000, 3000000, 0.35),
(2025, 3000000, NULL, 0.40)
ON CONFLICT (yil, baslangic) DO NOTHING;

-- 2026 vergi dilimleri (tahmini)
INSERT INTO vergi_dilimleri (yil, baslangic, bitis, oran) VALUES
(2026, 0, 158000, 0.15),
(2026, 158000, 330000, 0.20),
(2026, 330000, 800000, 0.27),
(2026, 800000, 4300000, 0.35),
(2026, 4300000, NULL, 0.40)
ON CONFLICT (yil, baslangic) DO NOTHING;

-- ====================================================
-- 4. ASGARİ ÜCRET TABLOSU
-- ====================================================
CREATE TABLE IF NOT EXISTS asgari_ucret (
    id SERIAL PRIMARY KEY,
    yil INTEGER NOT NULL,
    donem INTEGER NOT NULL, -- 1: Ocak-Haziran, 2: Temmuz-Aralık
    brut_ucret DECIMAL(15,2) NOT NULL,
    net_ucret DECIMAL(15,2) NOT NULL,
    
    UNIQUE(yil, donem)
);

-- 2025 Asgari ücret (tahmini)
INSERT INTO asgari_ucret (yil, donem, brut_ucret, net_ucret) VALUES
(2025, 1, 22104, 17002),
(2025, 2, 22104, 17002)
ON CONFLICT (yil, donem) DO NOTHING;

-- 2026 Asgari ücret (tahmini)
INSERT INTO asgari_ucret (yil, donem, brut_ucret, net_ucret) VALUES
(2026, 1, 26500, 20400),
(2026, 2, 26500, 20400)
ON CONFLICT (yil, donem) DO NOTHING;

-- ====================================================
-- 5. TRIGGER'LAR
-- ====================================================

DROP TRIGGER IF EXISTS update_bordro_kayitlari_updated_at ON bordro_kayitlari;
CREATE TRIGGER update_bordro_kayitlari_updated_at 
    BEFORE UPDATE ON bordro_kayitlari
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ====================================================
-- 6. ROW LEVEL SECURITY
-- ====================================================

ALTER TABLE bordro_kayitlari ENABLE ROW LEVEL SECURITY;
ALTER TABLE vergi_dilimleri ENABLE ROW LEVEL SECURITY;
ALTER TABLE asgari_ucret ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access for authenticated users" ON bordro_kayitlari;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON vergi_dilimleri;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON asgari_ucret;

CREATE POLICY "Enable all access for authenticated users" ON bordro_kayitlari
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Enable all access for authenticated users" ON vergi_dilimleri
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Enable all access for authenticated users" ON asgari_ucret
    FOR ALL USING (auth.uid() IS NOT NULL);

-- ====================================================
-- 7. BORDRO ÖZET VIEW
-- ====================================================

CREATE OR REPLACE VIEW bordro_aylik_ozet AS
SELECT 
    b.yil,
    b.ay,
    COUNT(*) as personel_sayisi,
    SUM(b.brut_toplam) as toplam_brut,
    SUM(b.net_maas) as toplam_net,
    SUM(b.toplam_isci_sgk) as toplam_sgk_isci,
    SUM(b.toplam_isveren_sgk) as toplam_sgk_isveren,
    SUM(b.gelir_vergisi) as toplam_gelir_vergisi,
    SUM(b.damga_vergisi) as toplam_damga_vergisi,
    SUM(b.toplam_maliyet) as toplam_maliyet,
    COUNT(*) FILTER (WHERE b.odeme_durumu = 'odendi') as odenen_sayisi,
    COUNT(*) FILTER (WHERE b.odeme_durumu = 'beklemede') as bekleyen_sayisi
FROM bordro_kayitlari b
GROUP BY b.yil, b.ay
ORDER BY b.yil DESC, b.ay DESC;

-- ====================================================
-- Migration tamamlandı!
-- ====================================================

