-- =============================================
-- KYK VE DİĞER DEPOLARI EKLE
-- =============================================

-- Mevcut depoları güncelle ve yenilerini ekle
INSERT INTO depolar (kod, ad, tip, lokasyon, sorumlu_kisi, telefon, aktif) VALUES 
    -- KYK Depoları
    ('KYK_MERKEZ', 'KYK Merkez Yurt Deposu', 'genel', 'KYK Merkez Kampüs - Ana Depo', 'Ahmet Yılmaz', '0555 123 4567', true),
    ('KYK_MUTFAK', 'KYK Yurt Mutfak Deposu', 'genel', 'KYK Merkez Kampüs - Mutfak Katı', 'Mehmet Demir', '0555 234 5678', true),
    ('KYK_SOGUK', 'KYK Soğuk Hava Deposu', 'soğuk', 'KYK Merkez Kampüs - Bodrum', 'Ayşe Kaya', '0555 345 6789', true),
    
    -- Diğer Lokasyonlar
    ('KAMPUS_A', 'A Kampüsü Deposu', 'genel', 'A Kampüsü Yemekhane Binası', 'Fatma Öz', '0555 456 7890', true),
    ('KAMPUS_B', 'B Kampüsü Deposu', 'genel', 'B Kampüsü Yemekhane Binası', 'Ali Şen', '0555 567 8901', true),
    
    -- Özel Depolar
    ('BAHARAT', 'Baharat ve Kuru Gıda Deposu', 'kuru', 'Ana Bina - Kuru Gıda Bölümü', 'Zeynep Ak', '0555 678 9012', true),
    ('SEBZE', 'Sebze-Meyve Deposu', 'soğuk', 'Ana Bina - Sebze Soğuk Hava', 'Hasan Yıldız', '0555 789 0123', true)
ON CONFLICT (kod) DO UPDATE SET
    ad = EXCLUDED.ad,
    lokasyon = EXCLUDED.lokasyon,
    sorumlu_kisi = EXCLUDED.sorumlu_kisi,
    telefon = EXCLUDED.telefon;

-- Örnek stok kartları ekle (test için)
INSERT INTO stok_kartlari (
    kod, ad, kategori_id, ana_birim_id, 
    min_stok, max_stok, kritik_stok, optimum_stok,
    son_alis_fiyat, varsayilan_tedarikci_id, aktif
) VALUES 
    ('PIRINCBALDO', 'Pirinç - Baldo', 
        (SELECT id FROM stok_kategoriler WHERE kod = 'GIDA_KURU'), 
        (SELECT id FROM birimler WHERE kod = 'KG'),
        100, 1000, 50, 500, 45.50, NULL, true),
    
    ('MAKARNA', 'Makarna - Spagetti', 
        (SELECT id FROM stok_kategoriler WHERE kod = 'GIDA_KURU'),
        (SELECT id FROM birimler WHERE kod = 'PAKET'),
        200, 2000, 100, 1000, 12.75, NULL, true),
    
    ('TAVUKBUT', 'Tavuk But', 
        (SELECT id FROM stok_kategoriler WHERE kod = 'GIDA_ET'),
        (SELECT id FROM birimler WHERE kod = 'KG'),
        50, 500, 25, 250, 65.00, NULL, true),
    
    ('DOMATES', 'Domates', 
        (SELECT id FROM stok_kategoriler WHERE kod = 'GIDA_SEBZE'),
        (SELECT id FROM birimler WHERE kod = 'KG'),
        30, 300, 15, 150, 15.50, NULL, true),
    
    ('AYCICEKYA', 'Ayçiçek Yağı 5 Lt', 
        (SELECT id FROM stok_kategoriler WHERE kod = 'GIDA'),
        (SELECT id FROM birimler WHERE kod = 'ADET'),
        20, 200, 10, 100, 185.00, NULL, true)
ON CONFLICT (kod) DO NOTHING;

-- Her depoya farklı miktarlarda stok ekle
DO $$
DECLARE
    v_stok_id INTEGER;
    v_depo_id INTEGER;
BEGIN
    -- Pirinç stokları
    SELECT id INTO v_stok_id FROM stok_kartlari WHERE kod = 'PIRINCBALDO';
    
    -- KYK Merkez deposuna 500 kg
    INSERT INTO stok_depo_durumlari (stok_kart_id, depo_id, miktar, min_stok, max_stok)
    VALUES (v_stok_id, (SELECT id FROM depolar WHERE kod = 'KYK_MERKEZ'), 500, 100, 1000);
    
    -- KYK Mutfak deposuna 150 kg
    INSERT INTO stok_depo_durumlari (stok_kart_id, depo_id, miktar, min_stok, max_stok)
    VALUES (v_stok_id, (SELECT id FROM depolar WHERE kod = 'KYK_MUTFAK'), 150, 50, 300);
    
    -- Ana depoya 800 kg
    INSERT INTO stok_depo_durumlari (stok_kart_id, depo_id, miktar, min_stok, max_stok)
    VALUES (v_stok_id, (SELECT id FROM depolar WHERE kod = 'MERKEZ'), 800, 200, 2000);
    
    -- Makarna stokları
    SELECT id INTO v_stok_id FROM stok_kartlari WHERE kod = 'MAKARNA';
    
    INSERT INTO stok_depo_durumlari (stok_kart_id, depo_id, miktar, min_stok, max_stok)
    VALUES 
        (v_stok_id, (SELECT id FROM depolar WHERE kod = 'KYK_MERKEZ'), 300, 100, 500),
        (v_stok_id, (SELECT id FROM depolar WHERE kod = 'KYK_MUTFAK'), 75, 50, 200),
        (v_stok_id, (SELECT id FROM depolar WHERE kod = 'KAMPUS_A'), 120, 50, 300);
    
    -- Tavuk stokları (soğuk depolarda)
    SELECT id INTO v_stok_id FROM stok_kartlari WHERE kod = 'TAVUKBUT';
    
    INSERT INTO stok_depo_durumlari (stok_kart_id, depo_id, miktar, min_stok, max_stok)
    VALUES 
        (v_stok_id, (SELECT id FROM depolar WHERE kod = 'KYK_SOGUK'), 120, 50, 300),
        (v_stok_id, (SELECT id FROM depolar WHERE kod = 'SOGUK1'), 200, 100, 500);
    
    -- Domates stokları
    SELECT id INTO v_stok_id FROM stok_kartlari WHERE kod = 'DOMATES';
    
    INSERT INTO stok_depo_durumlari (stok_kart_id, depo_id, miktar, min_stok, max_stok)
    VALUES 
        (v_stok_id, (SELECT id FROM depolar WHERE kod = 'KYK_MUTFAK'), 45, 20, 100),
        (v_stok_id, (SELECT id FROM depolar WHERE kod = 'SEBZE'), 180, 50, 400);
    
    -- Toplam stokları güncelle
    UPDATE stok_kartlari sk
    SET toplam_stok = (
        SELECT COALESCE(SUM(miktar), 0) 
        FROM stok_depo_durumlari 
        WHERE stok_kart_id = sk.id
    );
    
END $$;

-- Depo bazlı stok özet görünümü
CREATE OR REPLACE VIEW v_depo_stok_ozet AS
SELECT 
    d.id as depo_id,
    d.kod as depo_kod,
    d.ad as depo_ad,
    d.tip as depo_tip,
    d.lokasyon,
    d.sorumlu_kisi,
    COUNT(DISTINCT sd.stok_kart_id) as urun_cesidi,
    SUM(sd.miktar * sk.son_alis_fiyat) as toplam_deger,
    SUM(CASE WHEN sd.miktar <= sk.kritik_stok THEN 1 ELSE 0 END) as kritik_urun_sayisi
FROM depolar d
LEFT JOIN stok_depo_durumlari sd ON sd.depo_id = d.id
LEFT JOIN stok_kartlari sk ON sk.id = sd.stok_kart_id
WHERE d.aktif = true
GROUP BY d.id, d.kod, d.ad, d.tip, d.lokasyon, d.sorumlu_kisi
ORDER BY d.kod;

-- Karşılaştırmalı depo stok raporu
CREATE OR REPLACE VIEW v_depo_karsilastirma AS
SELECT 
    sk.kod as stok_kod,
    sk.ad as stok_ad,
    b.kisa_ad as birim,
    MAX(CASE WHEN d.kod = 'KYK_MERKEZ' THEN sd.miktar END) as kyk_merkez,
    MAX(CASE WHEN d.kod = 'KYK_MUTFAK' THEN sd.miktar END) as kyk_mutfak,
    MAX(CASE WHEN d.kod = 'KYK_SOGUK' THEN sd.miktar END) as kyk_soguk,
    MAX(CASE WHEN d.kod = 'MERKEZ' THEN sd.miktar END) as ana_depo,
    MAX(CASE WHEN d.kod = 'KAMPUS_A' THEN sd.miktar END) as kampus_a,
    MAX(CASE WHEN d.kod = 'KAMPUS_B' THEN sd.miktar END) as kampus_b,
    SUM(sd.miktar) as toplam_stok
FROM stok_kartlari sk
JOIN stok_depo_durumlari sd ON sd.stok_kart_id = sk.id
JOIN depolar d ON d.id = sd.depo_id
LEFT JOIN birimler b ON b.id = sk.ana_birim_id
GROUP BY sk.id, sk.kod, sk.ad, b.kisa_ad
ORDER BY sk.kod;

COMMENT ON VIEW v_depo_stok_ozet IS 'Her deponun özet durumu';
COMMENT ON VIEW v_depo_karsilastirma IS 'Tüm depolardaki stokların karşılaştırmalı görünümü';
