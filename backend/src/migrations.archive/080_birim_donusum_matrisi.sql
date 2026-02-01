-- =============================================
-- BİRİM DÖNÜŞÜM MATRİSİ
-- Tüm birim varyasyonlarını standartlaştırır
-- =============================================

-- Birim eşleştirme tablosu (varyasyonları standarda çevirir)
CREATE TABLE IF NOT EXISTS birim_eslestirme (
    id SERIAL PRIMARY KEY,
    varyasyon VARCHAR(20) NOT NULL,      -- 'gr', 'gram', 'GR', 'Gram'
    standart VARCHAR(10) NOT NULL,        -- 'g'
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(varyasyon)
);

-- Yaygın varyasyonları ekle
INSERT INTO birim_eslestirme (varyasyon, standart) VALUES
    -- Gram varyasyonları
    ('g', 'g'), ('gr', 'g'), ('gram', 'g'), ('GR', 'g'), ('Gram', 'g'), ('GRAM', 'g'),
    -- Kilogram varyasyonları  
    ('kg', 'kg'), ('KG', 'kg'), ('Kg', 'kg'), ('kilo', 'kg'), ('Kilo', 'kg'),
    -- Litre varyasyonları
    ('l', 'L'), ('L', 'L'), ('lt', 'L'), ('Lt', 'L'), ('LT', 'L'), ('litre', 'L'), ('Litre', 'L'),
    -- Mililitre varyasyonları
    ('ml', 'ml'), ('ML', 'ml'), ('Ml', 'ml'), ('mL', 'ml'),
    -- Adet varyasyonları
    ('adet', 'adet'), ('ADET', 'adet'), ('Adet', 'adet'), ('ad', 'adet'), ('AD', 'adet'),
    -- Paket
    ('paket', 'paket'), ('PAKET', 'paket'), ('Paket', 'paket'), ('pkt', 'paket'),
    -- Porsiyon
    ('porsiyon', 'porsiyon'), ('prs', 'porsiyon'), ('Porsiyon', 'porsiyon')
ON CONFLICT (varyasyon) DO NOTHING;

-- Birim dönüşüm tablosu (standart birimler arası)
CREATE TABLE IF NOT EXISTS birim_donusumleri (
    id SERIAL PRIMARY KEY,
    kaynak_birim VARCHAR(10) NOT NULL,    -- 'g'
    hedef_birim VARCHAR(10) NOT NULL,     -- 'kg'
    carpan DECIMAL(15,6) NOT NULL,        -- 0.001
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(kaynak_birim, hedef_birim)
);

-- Dönüşüm katsayıları
INSERT INTO birim_donusumleri (kaynak_birim, hedef_birim, carpan) VALUES
    -- Ağırlık
    ('g', 'kg', 0.001),
    ('kg', 'g', 1000),
    ('g', 'g', 1),
    ('kg', 'kg', 1),
    -- Hacim
    ('ml', 'L', 0.001),
    ('L', 'ml', 1000),
    ('ml', 'ml', 1),
    ('L', 'L', 1),
    -- Adet (dönüşüm yok)
    ('adet', 'adet', 1),
    ('paket', 'paket', 1),
    ('porsiyon', 'porsiyon', 1)
ON CONFLICT (kaynak_birim, hedef_birim) DO NOTHING;

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_birim_eslestirme_varyasyon ON birim_eslestirme(varyasyon);
CREATE INDEX IF NOT EXISTS idx_birim_donusum_kaynak ON birim_donusumleri(kaynak_birim);

-- Yorum
COMMENT ON TABLE birim_eslestirme IS 'Birim yazım varyasyonlarını standart forma çevirir';
COMMENT ON TABLE birim_donusumleri IS 'Standart birimler arası dönüşüm katsayıları';
