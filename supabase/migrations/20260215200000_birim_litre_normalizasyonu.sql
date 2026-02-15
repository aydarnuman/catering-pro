-- Birim normalizasyonu: 'L' → 'lt' (backend + frontend + SQL tutarlılığı)
-- Backend ve frontend 'lt' kullanıyor; SQL fonksiyonları ve tablolar 'L' kullanıyordu.
-- Tüm katmanlar artık 'lt' kullanacak.

-- 1. birim_eslestirme tablosundaki standart değerleri güncelle
UPDATE birim_eslestirme SET standart = 'lt' WHERE standart = 'L';

-- 2. birim_donusumleri tablosundaki 'L' referanslarını güncelle
UPDATE birim_donusumleri SET kaynak_birim = 'lt' WHERE kaynak_birim = 'L';
UPDATE birim_donusumleri SET hedef_birim = 'lt' WHERE hedef_birim = 'L';

-- 3. Duplicate satırları temizle (lt:lt zaten varsa L:L'den gelen duplicate'i sil)
DELETE FROM birim_donusumleri a
  USING birim_donusumleri b
  WHERE a.id > b.id
    AND a.kaynak_birim = b.kaynak_birim
    AND a.hedef_birim = b.hedef_birim;

-- 4. Eksik capraz donusumleri ekle (ml ↔ g yaklaşımı)
INSERT INTO birim_donusumleri (kaynak_birim, hedef_birim, carpan)
VALUES
  ('ml', 'g', 1),
  ('g', 'ml', 1),
  ('ml', 'kg', 0.001),
  ('kg', 'ml', 1000),
  ('g', 'lt', 0.001),
  ('lt', 'g', 1000)
ON CONFLICT (kaynak_birim, hedef_birim) DO NOTHING;

-- 5. SQL fonksiyonunu güncelle — 'L' referanslarını 'lt' yap
CREATE OR REPLACE FUNCTION get_birim_donusum_carpani(
  p_kaynak_birim TEXT,
  p_hedef_birim TEXT,
  p_urun_kart_id INTEGER DEFAULT NULL
) RETURNS NUMERIC AS $$
DECLARE
  v_carpan NUMERIC;
  v_std_kaynak TEXT;
  v_std_hedef TEXT;
BEGIN
  -- Standart birime normalize et
  SELECT COALESCE(
    (SELECT standart FROM birim_eslestirme WHERE varyasyon = LOWER(TRIM(p_kaynak_birim)) LIMIT 1),
    LOWER(TRIM(p_kaynak_birim))
  ) INTO v_std_kaynak;

  SELECT COALESCE(
    (SELECT standart FROM birim_eslestirme WHERE varyasyon = LOWER(TRIM(p_hedef_birim)) LIMIT 1),
    LOWER(TRIM(p_hedef_birim))
  ) INTO v_std_hedef;

  -- Aynı birimse
  IF v_std_kaynak = v_std_hedef THEN RETURN 1; END IF;

  -- Ürüne özel dönüşüm
  IF p_urun_kart_id IS NOT NULL THEN
    SELECT carpan INTO v_carpan
    FROM urun_birim_donusumleri
    WHERE urun_kart_id = p_urun_kart_id
      AND kaynak_birim = v_std_kaynak
      AND hedef_birim = v_std_hedef
    LIMIT 1;
    IF v_carpan IS NOT NULL THEN RETURN v_carpan; END IF;

    -- Ters dönüşüm
    SELECT carpan INTO v_carpan
    FROM urun_birim_donusumleri
    WHERE urun_kart_id = p_urun_kart_id
      AND kaynak_birim = v_std_hedef
      AND hedef_birim = v_std_kaynak
    LIMIT 1;
    IF v_carpan IS NOT NULL AND v_carpan > 0 THEN RETURN 1.0 / v_carpan; END IF;
  END IF;

  -- Genel dönüşüm tablosu
  SELECT carpan INTO v_carpan
  FROM birim_donusumleri
  WHERE kaynak_birim = v_std_kaynak AND hedef_birim = v_std_hedef
  LIMIT 1;
  IF v_carpan IS NOT NULL THEN RETURN v_carpan; END IF;

  -- Ters dönüşüm
  SELECT carpan INTO v_carpan
  FROM birim_donusumleri
  WHERE kaynak_birim = v_std_hedef AND hedef_birim = v_std_kaynak
  LIMIT 1;
  IF v_carpan IS NOT NULL AND v_carpan > 0 THEN RETURN 1.0 / v_carpan; END IF;

  -- Hardcoded fallback (tüm katmanlar artık 'lt' kullanıyor)
  IF v_std_kaynak IN ('g', 'gr') AND v_std_hedef = 'kg' THEN RETURN 0.001; END IF;
  IF v_std_kaynak = 'kg' AND v_std_hedef IN ('g', 'gr') THEN RETURN 1000; END IF;
  IF v_std_kaynak = 'ml' AND v_std_hedef = 'lt' THEN RETURN 0.001; END IF;
  IF v_std_kaynak = 'lt' AND v_std_hedef = 'ml' THEN RETURN 1000; END IF;
  -- Hacim ↔ ağırlık çapraz (1ml ≈ 1g yaklaşımı)
  IF v_std_kaynak = 'ml' AND v_std_hedef IN ('g', 'gr') THEN RETURN 1; END IF;
  IF v_std_kaynak IN ('g', 'gr') AND v_std_hedef = 'ml' THEN RETURN 1; END IF;
  IF v_std_kaynak = 'ml' AND v_std_hedef = 'kg' THEN RETURN 0.001; END IF;
  IF v_std_kaynak = 'kg' AND v_std_hedef = 'ml' THEN RETURN 1000; END IF;

  -- Dönüşüm bulunamadı - fallback 1
  RETURN 1;
END;
$$ LANGUAGE plpgsql STABLE;
