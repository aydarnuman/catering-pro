-- Şef Gramajı Sistemi
-- Her malzeme için opsiyonel şef gramajı ve hangi gramajın kullanılacağı

-- 1. Yeni alanları ekle
ALTER TABLE recete_malzemeler 
ADD COLUMN IF NOT EXISTS sef_miktar DECIMAL(10, 4),
ADD COLUMN IF NOT EXISTS aktif_miktar_tipi VARCHAR(10) DEFAULT 'sistem' CHECK (aktif_miktar_tipi IN ('sistem', 'sef'));

-- 2. Yorum ekle
COMMENT ON COLUMN recete_malzemeler.sef_miktar IS 'Şef tarafından belirlenen alternatif gramaj';
COMMENT ON COLUMN recete_malzemeler.aktif_miktar_tipi IS 'Hangi gramajın kullanılacağı: sistem veya sef';

-- 3. Aktif miktarı döndüren fonksiyon
CREATE OR REPLACE FUNCTION get_aktif_miktar(p_miktar DECIMAL, p_sef_miktar DECIMAL, p_aktif_tip VARCHAR)
RETURNS DECIMAL AS $$
BEGIN
  IF p_aktif_tip = 'sef' AND p_sef_miktar IS NOT NULL THEN
    RETURN p_sef_miktar;
  ELSE
    RETURN p_miktar;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 4. View: Malzeme maliyet hesaplama (aktif gramaj ile)
CREATE OR REPLACE VIEW v_recete_malzeme_maliyet AS
SELECT 
  rm.id,
  rm.recete_id,
  rm.malzeme_adi,
  rm.miktar as sistem_miktar,
  rm.sef_miktar,
  rm.aktif_miktar_tipi,
  get_aktif_miktar(rm.miktar, rm.sef_miktar, rm.aktif_miktar_tipi) as aktif_miktar,
  rm.birim,
  uk.aktif_fiyat as birim_fiyat,
  get_aktif_miktar(rm.miktar, rm.sef_miktar, rm.aktif_miktar_tipi) * COALESCE(uk.aktif_fiyat, 0) as toplam_maliyet
FROM recete_malzemeler rm
LEFT JOIN urun_kartlari uk ON uk.id = rm.urun_kart_id;
