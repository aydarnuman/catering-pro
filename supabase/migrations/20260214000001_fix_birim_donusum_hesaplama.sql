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
--   2. recalc_recete_maliyet() fonksiyonunu birim dönüşümlü hale getir
--   3. Tüm reçete maliyetlerini doğru formülle yeniden hesapla
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

-- 3. Birim dönüşüm çarpanı hesaplayan yardımcı fonksiyon (SQL seviyesinde)
CREATE OR REPLACE FUNCTION get_birim_donusum_carpani(
  p_kaynak_birim TEXT,
  p_hedef_birim TEXT
)
RETURNS DECIMAL(15,6) AS $$
DECLARE
  v_std_kaynak TEXT;
  v_std_hedef TEXT;
  v_carpan DECIMAL(15,6);
BEGIN
  -- NULL kontrolü
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

  -- Direkt dönüşüm var mı?
  SELECT carpan INTO v_carpan
  FROM birim_donusumleri
  WHERE kaynak_birim = v_std_kaynak AND hedef_birim = v_std_hedef
  LIMIT 1;

  IF v_carpan IS NOT NULL THEN
    RETURN v_carpan;
  END IF;

  -- Ters dönüşüm var mı?
  SELECT carpan INTO v_carpan
  FROM birim_donusumleri
  WHERE kaynak_birim = v_std_hedef AND hedef_birim = v_std_kaynak
  LIMIT 1;

  IF v_carpan IS NOT NULL AND v_carpan > 0 THEN
    RETURN 1.0 / v_carpan;
  END IF;

  -- Bilinen temel dönüşümler (fallback)
  IF v_std_kaynak IN ('g', 'gr') AND v_std_hedef = 'kg' THEN RETURN 0.001; END IF;
  IF v_std_kaynak = 'kg' AND v_std_hedef IN ('g', 'gr') THEN RETURN 1000; END IF;
  IF v_std_kaynak = 'ml' AND v_std_hedef IN ('L', 'lt') THEN RETURN 0.001; END IF;
  IF v_std_kaynak IN ('L', 'lt') AND v_std_hedef = 'ml' THEN RETURN 1000; END IF;

  -- Dönüşüm bulunamadı - aynı tip birimler arasında ise 1 döndür
  -- (adet→adet, porsiyon→porsiyon gibi zaten yukarıda yakalandı)
  -- Farklı tipte birimler arasında 1 döndürülmesi riskli ama
  -- mevcut veriyi korumak için fallback olarak bırakıyoruz
  RETURN 1;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_birim_donusum_carpani(TEXT, TEXT) IS 
  'İki birim arası dönüşüm çarpanını hesaplar. Normalize + tablo araması + ters dönüşüm + fallback.';

-- 4. recalc_recete_maliyet() fonksiyonunu BİRİM DÖNÜŞÜMLÜ hale getir
CREATE OR REPLACE FUNCTION recalc_recete_maliyet()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE receteler r
  SET 
    tahmini_maliyet = (
      SELECT COALESCE(SUM(
        -- Aktif miktar (şef gramajı veya sistem miktarı)
        CASE 
          WHEN rm.aktif_miktar_tipi = 'sef' AND rm.sef_miktar IS NOT NULL THEN rm.sef_miktar
          ELSE rm.miktar
        END
        -- Birim dönüşüm çarpanı (g→kg = 0.001, ml→lt = 0.001 vb.)
        * get_birim_donusum_carpani(
            rm.birim,
            COALESCE(uk.birim, 'kg')
          )
        -- Birim fiyat (TL/kg, TL/lt, TL/adet)
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

-- 5. Trigger'ı yeniden oluştur (fonksiyon değişti, trigger aynı kalıyor)
-- (CREATE OR REPLACE FUNCTION yeterli, trigger otomatik yeni fonksiyonu kullanır)

-- 6. TÜM REÇETE MALİYETLERİNİ DOĞRU FORMÜLLE YENİDEN HESAPLA
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
      * get_birim_donusum_carpani(
          rm.birim,
          COALESCE(uk.birim, 'kg')
        )
      * COALESCE(rm.birim_fiyat, 0)
    ), 0) AS maliyet
  FROM recete_malzemeler rm
  LEFT JOIN urun_kartlari uk ON uk.id = rm.urun_kart_id
  GROUP BY rm.recete_id
) sub
WHERE r.id = sub.recete_id;
