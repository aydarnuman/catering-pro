-- ============================================================
-- BİRİM DÖNÜŞÜM HESAPLAMA DÜZELTMESİ
-- 
-- SORUN: recalc_recete_maliyet() trigger'ı birim dönüşümü
--        yapmadan miktar * birim_fiyat hesaplıyordu.
--        200gr malzeme, 45 TL/kg fiyat → 200*45=9000 TL (YANLIŞ)
--        Doğrusu: 200*0.001*45 = 9 TL
--
-- DÜZELTME:
--   1. birim_donusumleri tablosuna eksik kayıtlar ekle
--   2. Ürüne özel birim dönüşüm tablosu oluştur
--   3. get_birim_donusum_carpani() SQL fonksiyonu ekle (ürüne özel + genel)
--   4. recalc_recete_maliyet() trigger'ını birim dönüşümlü hale getir
--   5. Yanlış birim atanmış ürün kartlarını düzelt
--   6. Tüm reçete maliyetlerini doğru formülle yeniden hesapla
-- ============================================================

-- 1. birim_donusumleri tablosuna eksik identity ve alias kayıtları ekle
INSERT INTO birim_donusumleri (kaynak_birim, hedef_birim, carpan)
VALUES
  ('g', 'g', 1),
  ('kg', 'kg', 1),
  ('ml', 'ml', 1),
  ('L', 'L', 1),
  ('lt', 'lt', 1),
  ('gr', 'kg', 0.001),
  ('lt', 'L', 1),
  ('L', 'lt', 1)
ON CONFLICT (kaynak_birim, hedef_birim) DO NOTHING;

-- 2. birim_eslestirme tablosuna eksik varyasyonlar ekle
INSERT INTO birim_eslestirme (varyasyon, standart)
VALUES
  ('lt', 'L'),
  ('litre', 'L'),
  ('LT', 'L'),
  ('Litre', 'L'),
  ('ml', 'ml'),
  ('ML', 'ml'),
  ('mililitre', 'ml'),
  ('dilim', 'dilim'),
  ('tutam', 'tutam'),
  ('porsiyon', 'porsiyon'),
  ('demet', 'demet'),
  ('paket', 'paket')
ON CONFLICT (varyasyon) DO NOTHING;

-- 3. Yanlış birim atanmış ürün kartlarını düzelt
-- Defne Yaprağı: birim='adet' ama fiyat_birimi='kg' → birim='kg' olmalı
UPDATE urun_kartlari SET birim = 'kg' WHERE id = 82 AND birim = 'adet' AND fiyat_birimi = 'kg';
-- Karanfil: aynı sorun
UPDATE urun_kartlari SET birim = 'kg' WHERE id = 114 AND birim = 'adet' AND fiyat_birimi = 'kg';

-- 4. Ürüne özel birim dönüşüm tablosu
CREATE TABLE IF NOT EXISTS urun_birim_donusumleri (
    id SERIAL PRIMARY KEY,
    urun_kart_id INTEGER NOT NULL REFERENCES urun_kartlari(id) ON DELETE CASCADE,
    kaynak_birim VARCHAR(20) NOT NULL,
    hedef_birim VARCHAR(20) NOT NULL,
    carpan DECIMAL(15,6) NOT NULL,
    aciklama VARCHAR(200),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(urun_kart_id, kaynak_birim, hedef_birim)
);

CREATE INDEX IF NOT EXISTS idx_urun_birim_don_urun ON urun_birim_donusumleri(urun_kart_id);

COMMENT ON TABLE urun_birim_donusumleri IS 
  'Ürüne özel birim dönüşüm katsayıları. Örn: 1 demet maydanoz = 100g → g:demet = 0.01';

-- 5. Bilinen ürünler için dönüşüm faktörleri
INSERT INTO urun_birim_donusumleri (urun_kart_id, kaynak_birim, hedef_birim, carpan, aciklama)
VALUES 
  (4763, 'g', 'demet', 0.01, '1 demet maydanoz ≈ 100g'),
  (4881, 'g', 'demet', 0.005, '1 demet taze soğan ≈ 200g'),
  (4658, 'g', 'adet', 0.0025, '1 kavanoz çilek reçeli ≈ 400g'),
  (4767, 'adet', 'kg', 0.12, '1 adet limon ≈ 120g'),
  (4767, 'ml', 'kg', 0.0025, '1 kg limon ≈ 400ml suyu'),
  (4759, 'adet', 'kg', 0.005, '1 diş sarımsak ≈ 5g')
ON CONFLICT (urun_kart_id, kaynak_birim, hedef_birim) DO NOTHING;

-- 6. get_birim_donusum_carpani fonksiyonu (ürüne özel dönüşüm destekli)
CREATE OR REPLACE FUNCTION get_birim_donusum_carpani(
  p_kaynak_birim TEXT,
  p_hedef_birim TEXT,
  p_urun_kart_id INTEGER DEFAULT NULL
)
RETURNS DECIMAL(15,6) AS $$
DECLARE
  v_std_kaynak TEXT;
  v_std_hedef TEXT;
  v_carpan DECIMAL(15,6);
BEGIN
  IF p_kaynak_birim IS NULL OR p_hedef_birim IS NULL THEN
    RETURN 1;
  END IF;

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
  IF v_std_kaynak = v_std_hedef THEN
    RETURN 1;
  END IF;

  -- Ürüne özel dönüşüm (varsa en öncelikli)
  IF p_urun_kart_id IS NOT NULL THEN
    SELECT carpan INTO v_carpan
    FROM urun_birim_donusumleri
    WHERE urun_kart_id = p_urun_kart_id
      AND kaynak_birim = v_std_kaynak AND hedef_birim = v_std_hedef
    LIMIT 1;
    IF v_carpan IS NOT NULL THEN RETURN v_carpan; END IF;

    -- Ürüne özel ters dönüşüm
    SELECT carpan INTO v_carpan
    FROM urun_birim_donusumleri
    WHERE urun_kart_id = p_urun_kart_id
      AND kaynak_birim = v_std_hedef AND hedef_birim = v_std_kaynak
    LIMIT 1;
    IF v_carpan IS NOT NULL AND v_carpan > 0 THEN RETURN 1.0 / v_carpan; END IF;
  END IF;

  -- Genel dönüşüm tablosu
  SELECT carpan INTO v_carpan
  FROM birim_donusumleri
  WHERE kaynak_birim = v_std_kaynak AND hedef_birim = v_std_hedef
  LIMIT 1;
  IF v_carpan IS NOT NULL THEN RETURN v_carpan; END IF;

  -- Genel ters dönüşüm
  SELECT carpan INTO v_carpan
  FROM birim_donusumleri
  WHERE kaynak_birim = v_std_hedef AND hedef_birim = v_std_kaynak
  LIMIT 1;
  IF v_carpan IS NOT NULL AND v_carpan > 0 THEN RETURN 1.0 / v_carpan; END IF;

  -- Bilinen fallback
  IF v_std_kaynak IN ('g', 'gr') AND v_std_hedef = 'kg' THEN RETURN 0.001; END IF;
  IF v_std_kaynak = 'kg' AND v_std_hedef IN ('g', 'gr') THEN RETURN 1000; END IF;
  IF v_std_kaynak = 'ml' AND v_std_hedef IN ('L', 'lt') THEN RETURN 0.001; END IF;
  IF v_std_kaynak IN ('L', 'lt') AND v_std_hedef = 'ml' THEN RETURN 1000; END IF;

  -- Dönüşüm bulunamadı - fallback 1
  RETURN 1;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_birim_donusum_carpani(TEXT, TEXT, INTEGER) IS 
  'İki birim arası dönüşüm çarpanını hesaplar. Ürüne özel > genel tablo > ters > fallback.';

-- 7. recalc_recete_maliyet() trigger'ını birim dönüşümlü hale getir
CREATE OR REPLACE FUNCTION recalc_recete_maliyet()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE receteler r
  SET 
    tahmini_maliyet = (
      SELECT COALESCE(SUM(
        CASE 
          WHEN rm.aktif_miktar_tipi = 'sef' AND rm.sef_miktar IS NOT NULL THEN rm.sef_miktar
          ELSE rm.miktar
        END
        * get_birim_donusum_carpani(rm.birim, COALESCE(uk.birim, 'kg'), rm.urun_kart_id)
        * COALESCE(rm.birim_fiyat, 0)
      ), 0)
      FROM recete_malzemeler rm
      LEFT JOIN urun_kartlari uk ON uk.id = rm.urun_kart_id
      WHERE rm.recete_id = r.id
    ),
    updated_at = NOW()
  WHERE r.id = NEW.recete_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION recalc_recete_maliyet() IS 
  'recete_malzemeler.birim_fiyat değişince receteler.tahmini_maliyet günceller (birim dönüşümlü).';

-- 8. Tüm reçete maliyetlerini doğru formülle yeniden hesapla
UPDATE receteler r
SET 
  tahmini_maliyet = sub.maliyet,
  updated_at = NOW()
FROM (
  SELECT 
    rm.recete_id,
    COALESCE(SUM(
      CASE 
        WHEN rm.aktif_miktar_tipi = 'sef' AND rm.sef_miktar IS NOT NULL THEN rm.sef_miktar
        ELSE rm.miktar
      END
      * get_birim_donusum_carpani(rm.birim, COALESCE(uk.birim, 'kg'), rm.urun_kart_id)
      * COALESCE(rm.birim_fiyat, 0)
    ), 0) AS maliyet
  FROM recete_malzemeler rm
  LEFT JOIN urun_kartlari uk ON uk.id = rm.urun_kart_id
  GROUP BY rm.recete_id
) sub
WHERE r.id = sub.recete_id;
