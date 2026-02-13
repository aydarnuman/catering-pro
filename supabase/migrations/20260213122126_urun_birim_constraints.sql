-- ============================================================
-- FAZ 2: Ürün Kartı Birim Constraint'leri
-- ============================================================

-- 0. Pasif kartların birimlerini de standardize et (constraint uyumu)
UPDATE urun_kartlari
SET birim = CASE 
    WHEN LOWER(birim) IN ('gr', 'g', 'gram') THEN 'kg'
    WHEN LOWER(birim) IN ('ml') THEN 'lt'
    ELSE birim
  END
WHERE birim IS NOT NULL
  AND LOWER(birim) NOT IN ('kg', 'lt', 'adet', 'demet', 'paket', 'porsiyon');

-- 1. CHECK constraint
ALTER TABLE urun_kartlari DROP CONSTRAINT IF EXISTS chk_urun_birim_standart;
ALTER TABLE urun_kartlari 
ADD CONSTRAINT chk_urun_birim_standart 
CHECK (
  birim IS NULL
  OR LOWER(birim) IN ('kg', 'lt', 'adet', 'demet', 'paket', 'porsiyon')
);

COMMENT ON CONSTRAINT chk_urun_birim_standart ON urun_kartlari IS 
  'Ürün kartı birimi sadece kg/lt/adet/demet/paket/porsiyon olabilir. gr/ml YASAK.';

-- 2. Normalize trigger
CREATE OR REPLACE FUNCTION normalize_urun_birimi()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.birim IS NOT NULL THEN
    NEW.birim := CASE LOWER(TRIM(NEW.birim))
      WHEN 'gr' THEN 'kg'
      WHEN 'g' THEN 'kg'
      WHEN 'gram' THEN 'kg'
      WHEN 'ml' THEN 'lt'
      WHEN 'l' THEN 'lt'
      WHEN 'litre' THEN 'lt'
      WHEN 'kg' THEN 'kg'
      WHEN 'lt' THEN 'lt'
      WHEN 'adet' THEN 'adet'
      WHEN 'demet' THEN 'demet'
      WHEN 'paket' THEN 'paket'
      WHEN 'porsiyon' THEN 'porsiyon'
      ELSE LOWER(TRIM(NEW.birim))
    END;
  END IF;

  IF NEW.fiyat_birimi IS NOT NULL THEN
    NEW.fiyat_birimi := CASE 
      WHEN LOWER(TRIM(NEW.fiyat_birimi)) IN ('gr', 'g', 'gram', 'kg', 'tl/kg') THEN 'kg'
      WHEN LOWER(TRIM(NEW.fiyat_birimi)) IN ('ml', 'l', 'litre', 'lt', 'tl/lt') THEN 'lt'
      WHEN LOWER(TRIM(NEW.fiyat_birimi)) IN ('adet', 'tl/adet') THEN 'adet'
      WHEN LOWER(TRIM(NEW.fiyat_birimi)) IN ('demet', 'tl/demet') THEN 'demet'
      WHEN LOWER(TRIM(NEW.fiyat_birimi)) IN ('paket', 'tl/paket') THEN 'paket'
      WHEN LOWER(TRIM(NEW.fiyat_birimi)) IN ('porsiyon') THEN 'porsiyon'
      ELSE LOWER(TRIM(NEW.fiyat_birimi))
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_normalize_urun_birimi ON urun_kartlari;
CREATE TRIGGER trg_normalize_urun_birimi
BEFORE INSERT OR UPDATE ON urun_kartlari
FOR EACH ROW
EXECUTE FUNCTION normalize_urun_birimi();

-- 3. Duplike isim unique index
DO $$
DECLARE
  dup_count INTEGER;
  cleaned INTEGER;
BEGIN
  SELECT COUNT(*) INTO dup_count
  FROM (
    SELECT normalize_urun_adi_v2(ad), COUNT(*)
    FROM urun_kartlari
    WHERE aktif = true
    GROUP BY normalize_urun_adi_v2(ad)
    HAVING COUNT(*) > 1
  ) t;

  IF dup_count > 0 THEN
    WITH duplikeler AS (
      SELECT id, ad, normalize_urun_adi_v2(ad) as norm_ad,
             ROW_NUMBER() OVER (PARTITION BY normalize_urun_adi_v2(ad) ORDER BY 
               aktif_fiyat IS NOT NULL DESC,
               id DESC
             ) as rn
      FROM urun_kartlari
      WHERE aktif = true
    )
    UPDATE urun_kartlari uk
    SET aktif = false,
        kod = COALESCE(uk.kod, '') || '_DUP_' || uk.id
    FROM duplikeler d
    WHERE d.id = uk.id AND d.rn > 1;

    GET DIAGNOSTICS cleaned = ROW_COUNT;
    RAISE NOTICE 'Deaktive edilen duplike kart: %', cleaned;
  END IF;
END $$;

DROP INDEX IF EXISTS idx_urun_kartlari_unique_ad_aktif;
CREATE UNIQUE INDEX idx_urun_kartlari_unique_ad_aktif 
ON urun_kartlari (normalize_urun_adi_v2(ad)) 
WHERE aktif = true;

COMMENT ON INDEX idx_urun_kartlari_unique_ad_aktif IS 
  'Aynı isimde sadece 1 aktif ürün kartı olabilir. Duplike engeli.';
