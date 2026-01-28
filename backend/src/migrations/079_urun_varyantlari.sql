-- =====================================================
-- ÜRÜN VARYANTLARI SİSTEMİ
-- Ana ürün + Alt varyantlar yapısı
-- =====================================================
-- Örnek:
-- Şeker (ana_urun_id = NULL) → Ana Ürün
--   ├── Toz Şeker 5kg (ana_urun_id = Şeker.id) → Varyant
--   ├── Küp Şeker 5kg (ana_urun_id = Şeker.id) → Varyant
--   └── Pudra Şekeri (ana_urun_id = Şeker.id) → Varyant
-- =====================================================

-- 0. birim kolonu (urun_kartlari'nda yoksa ekle; 066'da varsayilan_birim/fiyat_birimi var)
ALTER TABLE urun_kartlari 
ADD COLUMN IF NOT EXISTS birim VARCHAR(20);
UPDATE urun_kartlari SET birim = COALESCE(varsayilan_birim, fiyat_birimi, 'ADET') WHERE birim IS NULL;

-- 1. Ana ürün referansı ekle
ALTER TABLE urun_kartlari 
ADD COLUMN IF NOT EXISTS ana_urun_id INTEGER REFERENCES urun_kartlari(id) ON DELETE SET NULL;

-- 2. Varyant tipi ekle (ambalaj, gramaj, marka vb.)
ALTER TABLE urun_kartlari 
ADD COLUMN IF NOT EXISTS varyant_tipi VARCHAR(50);

-- 3. Varyant açıklaması (5kg, 1lt, Besler marka vb.)
ALTER TABLE urun_kartlari 
ADD COLUMN IF NOT EXISTS varyant_aciklama VARCHAR(200);

-- 4. Fatura tedarikçi ürün adı (orjinal fatura metni)
ALTER TABLE urun_kartlari 
ADD COLUMN IF NOT EXISTS tedarikci_urun_adi TEXT;

-- 5. İndeks ekle
CREATE INDEX IF NOT EXISTS idx_urun_kartlari_ana_urun ON urun_kartlari(ana_urun_id);

-- 6. Varyant view'ı oluştur
CREATE OR REPLACE VIEW urun_varyantlari_view AS
SELECT 
    uk.id,
    uk.kod,
    uk.ad,
    uk.ana_urun_id,
    ana.ad as ana_urun_adi,
    ana.kod as ana_urun_kodu,
    uk.varyant_tipi,
    uk.varyant_aciklama,
    uk.tedarikci_urun_adi,
    uk.son_alis_fiyati,
    uk.toplam_stok,
    uk.birim,
    uk.kategori_id,
    kat.ad as kategori_adi,
    CASE 
        WHEN uk.ana_urun_id IS NULL THEN 'ana_urun'
        ELSE 'varyant'
    END as urun_tipi
FROM urun_kartlari uk
LEFT JOIN urun_kartlari ana ON ana.id = uk.ana_urun_id
LEFT JOIN urun_kategorileri kat ON kat.id = uk.kategori_id
WHERE uk.aktif = TRUE;

-- 7. Ana ürünleri listele fonksiyonu
CREATE OR REPLACE FUNCTION get_ana_urunler(p_kategori_id INTEGER DEFAULT NULL)
RETURNS TABLE (
    id INTEGER,
    kod VARCHAR,
    ad VARCHAR,
    kategori_id INTEGER,
    kategori_adi VARCHAR,
    varyant_sayisi BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        uk.id,
        uk.kod,
        uk.ad,
        uk.kategori_id,
        kat.ad as kategori_adi,
        COUNT(v.id) as varyant_sayisi
    FROM urun_kartlari uk
    LEFT JOIN urun_kategorileri kat ON kat.id = uk.kategori_id
    LEFT JOIN urun_kartlari v ON v.ana_urun_id = uk.id AND v.aktif = TRUE
    WHERE uk.aktif = TRUE
      AND uk.ana_urun_id IS NULL
      AND (p_kategori_id IS NULL OR uk.kategori_id = p_kategori_id)
    GROUP BY uk.id, uk.kod, uk.ad, uk.kategori_id, kat.ad
    ORDER BY uk.ad;
END;
$$ LANGUAGE plpgsql;

-- 8. Ürün varyantlarını listele fonksiyonu
CREATE OR REPLACE FUNCTION get_urun_varyantlari(p_ana_urun_id INTEGER)
RETURNS TABLE (
    id INTEGER,
    kod VARCHAR,
    ad VARCHAR,
    varyant_tipi VARCHAR,
    varyant_aciklama VARCHAR,
    tedarikci_urun_adi TEXT,
    son_alis_fiyati DECIMAL,
    toplam_stok DECIMAL,
    birim VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        uk.id,
        uk.kod,
        uk.ad,
        uk.varyant_tipi,
        uk.varyant_aciklama,
        uk.tedarikci_urun_adi,
        uk.son_alis_fiyati,
        uk.toplam_stok,
        uk.birim
    FROM urun_kartlari uk
    WHERE uk.ana_urun_id = p_ana_urun_id
      AND uk.aktif = TRUE
    ORDER BY uk.ad;
END;
$$ LANGUAGE plpgsql;

-- 9. Fatura kaleminden varyant oluştur fonksiyonu
CREATE OR REPLACE FUNCTION fatura_kaleminden_varyant_olustur(
    p_ana_urun_id INTEGER,
    p_fatura_urun_adi TEXT,
    p_varyant_tipi VARCHAR DEFAULT 'ambalaj',
    p_birim_fiyat DECIMAL DEFAULT NULL,
    p_kategori_id INTEGER DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    v_yeni_id INTEGER;
    v_kod VARCHAR;
    v_ana_urun RECORD;
    v_varyant_no INTEGER;
BEGIN
    -- Ana ürün bilgilerini al
    SELECT * INTO v_ana_urun FROM urun_kartlari WHERE id = p_ana_urun_id;
    
    IF v_ana_urun IS NULL THEN
        RAISE EXCEPTION 'Ana ürün bulunamadı: %', p_ana_urun_id;
    END IF;
    
    -- Varyant numarası hesapla
    SELECT COALESCE(COUNT(*), 0) + 1 INTO v_varyant_no 
    FROM urun_kartlari WHERE ana_urun_id = p_ana_urun_id;
    
    -- Kod oluştur: ANA-URUN-V1, ANA-URUN-V2, ...
    v_kod := v_ana_urun.kod || '-V' || v_varyant_no;
    
    -- Varyant oluştur
    INSERT INTO urun_kartlari (
        kod, ad, ana_urun_id, varyant_tipi, tedarikci_urun_adi,
        son_alis_fiyati, kategori_id, birim, aktif
    ) VALUES (
        v_kod,
        p_fatura_urun_adi,  -- Fatura kalemindeki ismi kullan
        p_ana_urun_id,
        p_varyant_tipi,
        p_fatura_urun_adi,
        p_birim_fiyat,
        COALESCE(p_kategori_id, v_ana_urun.kategori_id),
        v_ana_urun.birim,
        TRUE
    )
    RETURNING id INTO v_yeni_id;
    
    -- Fiyat geçmişine kaydet
    IF p_birim_fiyat IS NOT NULL THEN
        INSERT INTO urun_fiyat_gecmisi (urun_kart_id, fiyat, kaynak, aciklama, tarih)
        VALUES (v_yeni_id, p_birim_fiyat, 'fatura_varyant', 'Faturadan varyant oluşturuldu', NOW());
    END IF;
    
    RETURN v_yeni_id;
END;
$$ LANGUAGE plpgsql;

-- Yorumlar
COMMENT ON COLUMN urun_kartlari.ana_urun_id IS 'Ana ürün referansı. NULL ise bu bir ana üründür, değilse varyanttır.';
COMMENT ON COLUMN urun_kartlari.varyant_tipi IS 'Varyant türü: ambalaj, gramaj, marka, renk, vb.';
COMMENT ON COLUMN urun_kartlari.tedarikci_urun_adi IS 'Faturadaki orijinal ürün adı';
COMMENT ON FUNCTION fatura_kaleminden_varyant_olustur IS 'Fatura kaleminden yeni varyant oluşturur';
