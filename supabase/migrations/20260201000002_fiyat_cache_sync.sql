-- ============================================
-- FİYAT CACHE SYNC SİSTEMİ
-- recete_malzemeler.birim_fiyat otomatik güncelleme
-- ============================================

-- 1. urun_kartlari.aktif_fiyat değişince recete_malzemeler.birim_fiyat güncelle
CREATE OR REPLACE FUNCTION sync_recete_malzeme_fiyat()
RETURNS TRIGGER AS $$
BEGIN
  -- Sadece aktif_fiyat değiştiğinde çalış
  IF OLD.aktif_fiyat IS DISTINCT FROM NEW.aktif_fiyat THEN
    UPDATE recete_malzemeler 
    SET 
      birim_fiyat = NEW.aktif_fiyat,
      updated_at = NOW()
    WHERE urun_kart_id = NEW.id;
    
    -- Log (opsiyonel - debug için)
    -- RAISE NOTICE 'Fiyat güncellendi: urun_kart_id=%, yeni_fiyat=%', NEW.id, NEW.aktif_fiyat;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Trigger oluştur (varsa önce sil)
DROP TRIGGER IF EXISTS trg_sync_recete_fiyat ON urun_kartlari;

CREATE TRIGGER trg_sync_recete_fiyat
  AFTER UPDATE OF aktif_fiyat ON urun_kartlari
  FOR EACH ROW
  EXECUTE FUNCTION sync_recete_malzeme_fiyat();

-- 3. Mevcut verileri sync et (one-time)
UPDATE recete_malzemeler rm
SET birim_fiyat = uk.aktif_fiyat
FROM urun_kartlari uk
WHERE rm.urun_kart_id = uk.id
  AND (rm.birim_fiyat IS DISTINCT FROM uk.aktif_fiyat OR rm.birim_fiyat IS NULL);

-- 4. recete tahmini_maliyet güncelleme fonksiyonu
CREATE OR REPLACE FUNCTION recalc_recete_maliyet()
RETURNS TRIGGER AS $$
BEGIN
  -- Malzeme fiyatı değişince reçete maliyetini güncelle
  UPDATE receteler r
  SET 
    tahmini_maliyet = (
      SELECT COALESCE(SUM(
        CASE 
          WHEN rm.aktif_miktar_tipi = 'sef' AND rm.sef_miktar IS NOT NULL THEN rm.sef_miktar
          ELSE rm.miktar
        END * COALESCE(rm.birim_fiyat, 0)
      ), 0)
      FROM recete_malzemeler rm
      WHERE rm.recete_id = r.id
    ),
    updated_at = NOW()
  WHERE r.id = NEW.recete_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Trigger: recete_malzemeler.birim_fiyat değişince recete maliyetini güncelle
DROP TRIGGER IF EXISTS trg_recalc_recete_maliyet ON recete_malzemeler;

CREATE TRIGGER trg_recalc_recete_maliyet
  AFTER UPDATE OF birim_fiyat ON recete_malzemeler
  FOR EACH ROW
  EXECUTE FUNCTION recalc_recete_maliyet();

-- 6. Yorum ekle
COMMENT ON FUNCTION sync_recete_malzeme_fiyat() IS 'urun_kartlari.aktif_fiyat değişince recete_malzemeler.birim_fiyat otomatik günceller';
COMMENT ON FUNCTION recalc_recete_maliyet() IS 'recete_malzemeler.birim_fiyat değişince receteler.tahmini_maliyet günceller';

-- 7. Tüm reçete maliyetlerini yeniden hesapla (one-time)
UPDATE receteler r
SET tahmini_maliyet = (
  SELECT COALESCE(SUM(
    CASE 
      WHEN rm.aktif_miktar_tipi = 'sef' AND rm.sef_miktar IS NOT NULL THEN rm.sef_miktar
      ELSE rm.miktar
    END * COALESCE(rm.birim_fiyat, 0)
  ), 0)
  FROM recete_malzemeler rm
  WHERE rm.recete_id = r.id
);
