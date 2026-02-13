-- ============================================================
-- ÜRÜNE ÖZEL BİRİM DÖNÜŞÜMLERİ + VERİ DÜZELTMELERİ
-- ============================================================

-- 1. Yanlış birim atanmış ürün kartlarını düzelt
-- Defne Yaprağı: birim='adet' ama fiyat_birimi='kg' → birim='kg' olmalı
UPDATE urun_kartlari SET birim = 'kg' WHERE id = 82 AND birim = 'adet' AND fiyat_birimi = 'kg';
-- Karanfil: aynı sorun
UPDATE urun_kartlari SET birim = 'kg' WHERE id = 114 AND birim = 'adet' AND fiyat_birimi = 'kg';

-- 2. Ürüne özel birim dönüşüm tablosu oluştur
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

-- 3. Bilinen ürünler için dönüşüm faktörleri ekle

-- Maydanoz: 1 demet ≈ 100g → 1g = 0.01 demet
INSERT INTO urun_birim_donusumleri (urun_kart_id, kaynak_birim, hedef_birim, carpan, aciklama)
VALUES (4763, 'g', 'demet', 0.01, '1 demet maydanoz ≈ 100g')
ON CONFLICT (urun_kart_id, kaynak_birim, hedef_birim) DO NOTHING;

-- Taze Soğan: 1 demet ≈ 200g → 1g = 0.005 demet
INSERT INTO urun_birim_donusumleri (urun_kart_id, kaynak_birim, hedef_birim, carpan, aciklama)
VALUES (4881, 'g', 'demet', 0.005, '1 demet taze soğan ≈ 200g')
ON CONFLICT (urun_kart_id, kaynak_birim, hedef_birim) DO NOTHING;

-- Çilek Reçeli: 1 adet (kavanoz) ≈ 400g → 1g = 0.0025 adet  
INSERT INTO urun_birim_donusumleri (urun_kart_id, kaynak_birim, hedef_birim, carpan, aciklama)
VALUES (4658, 'g', 'adet', 0.0025, '1 kavanoz çilek reçeli ≈ 400g')
ON CONFLICT (urun_kart_id, kaynak_birim, hedef_birim) DO NOTHING;

-- Limon: 1 adet ≈ 120g = 0.12 kg → adet:kg = 0.12
INSERT INTO urun_birim_donusumleri (urun_kart_id, kaynak_birim, hedef_birim, carpan, aciklama)
VALUES (4767, 'adet', 'kg', 0.12, '1 adet limon ≈ 120g')
ON CONFLICT (urun_kart_id, kaynak_birim, hedef_birim) DO NOTHING;

-- Sarımsak: 1 diş ≈ 5g = 0.005 kg → adet:kg = 0.005
INSERT INTO urun_birim_donusumleri (urun_kart_id, kaynak_birim, hedef_birim, carpan, aciklama)
VALUES (4759, 'adet', 'kg', 0.005, '1 diş sarımsak ≈ 5g')
ON CONFLICT (urun_kart_id, kaynak_birim, hedef_birim) DO NOTHING;

-- 4. get_birim_donusum_carpani fonksiyonunu ürüne özel tablo desteği ile güncelle
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

  RETURN 1;
END;
$$ LANGUAGE plpgsql STABLE;

-- 5. recalc_recete_maliyet trigger'ı güncelle (ürün id'sini de gönder)
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

-- 6. Tüm reçete maliyetlerini yeniden hesapla (ürüne özel dönüşüm dahil)
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
