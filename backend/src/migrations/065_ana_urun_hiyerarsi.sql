-- 065_ana_urun_hiyerarsi.sql
-- Ana ürünlere hiyerarşi desteği (sadece Piyasa Robotu görsel organizasyonu için)

-- parent_id kolonu ekle
ALTER TABLE ana_urunler 
ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES ana_urunler(id) ON DELETE SET NULL;

-- Index ekle
CREATE INDEX IF NOT EXISTS idx_ana_urunler_parent_id ON ana_urunler(parent_id);

-- Mevcut "Salça" ürününü üst kategori yap ve alt kategoriler ekle
DO $$
DECLARE
    salca_id INTEGER;
    et_id INTEGER;
BEGIN
    -- Salça ana kategorisini bul
    SELECT id INTO salca_id FROM ana_urunler WHERE kod = 'salca' LIMIT 1;
    
    IF salca_id IS NOT NULL THEN
        -- Alt kategoriler ekle (eğer yoksa)
        INSERT INTO ana_urunler (kod, ad, ikon, kategori, parent_id, aktif)
        VALUES 
            ('domates-salcasi', 'Domates Salçası', '🍅', 'baharat', salca_id, true),
            ('biber-salcasi-tatli', 'Biber Salçası (Tatlı)', '🌶️', 'baharat', salca_id, true),
            ('biber-salcasi-aci', 'Biber Salçası (Acı)', '🔥', 'baharat', salca_id, true)
        ON CONFLICT (kod) DO NOTHING;
        
        -- Mevcut stok kartlarını alt kategorilere taşı
        UPDATE stok_kartlari 
        SET ana_urun_id = (SELECT id FROM ana_urunler WHERE kod = 'domates-salcasi')
        WHERE ana_urun_id = salca_id 
          AND LOWER(ad) LIKE '%domates%';
          
        UPDATE stok_kartlari 
        SET ana_urun_id = (SELECT id FROM ana_urunler WHERE kod = 'biber-salcasi-tatli')
        WHERE ana_urun_id = salca_id 
          AND LOWER(ad) LIKE '%biber%' 
          AND (LOWER(ad) LIKE '%tatlı%' OR LOWER(ad) LIKE '%tatli%');
          
        UPDATE stok_kartlari 
        SET ana_urun_id = (SELECT id FROM ana_urunler WHERE kod = 'biber-salcasi-aci')
        WHERE ana_urun_id = salca_id 
          AND LOWER(ad) LIKE '%biber%' 
          AND (LOWER(ad) LIKE '%acı%' OR LOWER(ad) LIKE '%aci%');
    END IF;
    
    -- Et kategorisi için de benzer yapı
    SELECT id INTO et_id FROM ana_urunler WHERE kod = 'tavuk' OR kod = 'et' LIMIT 1;
    
    -- Gerekirse diğer kategoriler de eklenebilir
END $$;

-- View: Ana ürünler ve alt ürünlerini birlikte getir
CREATE OR REPLACE VIEW v_ana_urunler_hiyerarsi AS
SELECT 
    au.id,
    au.kod,
    au.ad,
    au.ikon,
    au.kategori,
    au.parent_id,
    COALESCE(parent.ad, au.ad) as ust_kategori_ad,
    COALESCE(parent.ikon, au.ikon) as ust_kategori_ikon,
    (SELECT COUNT(*) FROM ana_urunler WHERE parent_id = au.id) as alt_kategori_sayisi,
    (SELECT COUNT(*) FROM stok_kartlari WHERE ana_urun_id = au.id AND aktif = true) as stok_kart_sayisi
FROM ana_urunler au
LEFT JOIN ana_urunler parent ON parent.id = au.parent_id
WHERE au.aktif = true;
