-- =====================================================
-- DATABASE CLEANUP: Legacy Field Deprecation
-- Generated: 2026-02-01T07:30:13.435Z
-- =====================================================

-- =====================================================
-- 1. DEPRECATED FIELD COMMENTS
-- =====================================================
-- Bu alanlar artık kullanılmıyor, aktif_fiyat kullanılıyor

COMMENT ON COLUMN urun_kartlari.manuel_fiyat IS 'DEPRECATED: Use aktif_fiyat instead. Kept for legacy compatibility.';
COMMENT ON COLUMN urun_kartlari.son_alis_fiyati IS 'DEPRECATED: Use aktif_fiyat instead. Kept for legacy compatibility.';
COMMENT ON COLUMN urun_kartlari.ortalama_fiyat IS 'DEPRECATED: Use aktif_fiyat instead. Kept for legacy compatibility.';

-- Recete malzemeler için deprecated fields
COMMENT ON COLUMN recete_malzemeler.piyasa_fiyat IS 'DEPRECATED: System now uses urun_kartlari.aktif_fiyat via urun_kart_id join.';
COMMENT ON COLUMN recete_malzemeler.sistem_fiyat IS 'DEPRECATED: System now uses urun_kartlari.aktif_fiyat via urun_kart_id join.';

-- =====================================================
-- 2. CLEAN UP MIGRATION WARNINGS
-- =====================================================

-- Warning view for deprecated field usage
CREATE OR REPLACE VIEW v_deprecated_field_usage AS
SELECT 
  'urun_kartlari' as table_name,
  'manuel_fiyat' as field_name,
  COUNT(*) as records_with_value
FROM urun_kartlari 
WHERE manuel_fiyat IS NOT NULL AND manuel_fiyat != aktif_fiyat

UNION ALL

SELECT 
  'urun_kartlari' as table_name,
  'son_alis_fiyati' as field_name,
  COUNT(*) as records_with_value
FROM urun_kartlari 
WHERE son_alis_fiyati IS NOT NULL AND son_alis_fiyati != aktif_fiyat

UNION ALL

SELECT 
  'recete_malzemeler' as table_name,
  'piyasa_fiyat' as field_name,
  COUNT(*) as records_with_value
FROM recete_malzemeler 
WHERE piyasa_fiyat IS NOT NULL

UNION ALL

SELECT 
  'recete_malzemeler' as table_name,
  'sistem_fiyat' as field_name,
  COUNT(*) as records_with_value
FROM recete_malzemeler 
WHERE sistem_fiyat IS NOT NULL;

-- =====================================================
-- 3. FIYAT CONSISTENCY CHECK FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION check_fiyat_consistency()
RETURNS TABLE (
  urun_id INTEGER,
  urun_ad VARCHAR(500),
  aktif_fiyat DECIMAL(15,4),
  manuel_fiyat DECIMAL(15,4),
  son_alis_fiyati DECIMAL(15,4),
  inconsistency_type TEXT
) AS $$
BEGIN
  -- Check for products where aktif_fiyat is null but legacy fields have values
  RETURN QUERY
  SELECT 
    uk.id,
    uk.ad,
    uk.aktif_fiyat,
    uk.manuel_fiyat,
    uk.son_alis_fiyati,
    CASE 
      WHEN uk.aktif_fiyat IS NULL AND uk.manuel_fiyat IS NOT NULL 
      THEN 'Missing aktif_fiyat but has manuel_fiyat'
      WHEN uk.aktif_fiyat IS NULL AND uk.son_alis_fiyati IS NOT NULL 
      THEN 'Missing aktif_fiyat but has son_alis_fiyati'
      WHEN uk.aktif_fiyat != uk.manuel_fiyat AND uk.manuel_fiyat IS NOT NULL
      THEN 'aktif_fiyat differs from manuel_fiyat'
      ELSE 'other_inconsistency'
    END::TEXT as inconsistency_type
  FROM urun_kartlari uk
  WHERE uk.aktif = true
    AND (
      (uk.aktif_fiyat IS NULL AND (uk.manuel_fiyat IS NOT NULL OR uk.son_alis_fiyati IS NOT NULL))
      OR 
      (uk.aktif_fiyat IS NOT NULL AND uk.manuel_fiyat IS NOT NULL AND ABS(uk.aktif_fiyat - uk.manuel_fiyat) > 0.01)
    );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 4. DATA MIGRATION: Fill missing aktif_fiyat
-- =====================================================

-- Fill missing aktif_fiyat from legacy fields (one-time cleanup)
DO $$
DECLARE
  r RECORD;
  fixed_count INTEGER := 0;
BEGIN
  FOR r IN 
    SELECT id FROM urun_kartlari 
    WHERE aktif = true 
      AND aktif_fiyat IS NULL 
      AND (manuel_fiyat IS NOT NULL OR son_alis_fiyati IS NOT NULL)
  LOOP
    -- Use the recalc function to properly set aktif_fiyat
    PERFORM recalc_urun_aktif_fiyat(r.id);
    fixed_count := fixed_count + 1;
  END LOOP;
  
  RAISE NOTICE 'Fixed aktif_fiyat for % products', fixed_count;
END $$;

-- =====================================================
-- 5. PERFORMANCE OPTIMIZATION
-- =====================================================

-- Drop unused indexes if they exist (be careful!)
-- These will be recreated if needed in future migrations

-- Index for deprecated field queries (keep for now)
CREATE INDEX IF NOT EXISTS idx_urun_kartlari_legacy_fiyat_check 
ON urun_kartlari(aktif_fiyat, manuel_fiyat, son_alis_fiyati) 
WHERE aktif = true AND (manuel_fiyat IS NOT NULL OR son_alis_fiyati IS NOT NULL);

-- =====================================================
-- 6. MONITORING QUERIES
-- =====================================================

-- Query to check cleanup effectiveness
-- Run this after migration to verify cleanup worked

-- SELECT 'Deprecated field usage summary' as check_type, * FROM v_deprecated_field_usage;
-- SELECT 'Price consistency issues' as check_type, COUNT(*) as issue_count FROM check_fiyat_consistency();
-- SELECT 'Active products without aktif_fiyat' as check_type, COUNT(*) as count 
-- FROM urun_kartlari WHERE aktif = true AND aktif_fiyat IS NULL;

-- =====================================================
-- 7. COMPLETION LOG
-- =====================================================

INSERT INTO migration_log (migration_name, status, completed_at, notes) 
VALUES (
  'database_cleanup_legacy_fields', 
  'completed',
  NOW(),
  'Deprecated legacy price fields, added consistency checks, filled missing aktif_fiyat values'
) ON CONFLICT DO NOTHING;