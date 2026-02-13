-- ============================================================
-- KALE SAVUNMA SİSTEMİ - DB SEVİYESİ KORUMALAR
--
-- 1. recete_malzemeler birim CHECK constraint
-- 2. Fiyat üst limit CHECK constraint
-- 3. recalc_recete_maliyet trigger'ı INSERT'te de çalışsın
-- 4. normalize_urun_birimi trigger'ına varsayilan_birim desteği
-- ============================================================

-- 1. recete_malzemeler birim CHECK constraint
-- Sadece tanımlı birimler kabul edilir (tanımsız birim DB seviyesinde reddedilir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_recete_birim'
  ) THEN
    ALTER TABLE recete_malzemeler ADD CONSTRAINT chk_recete_birim
    CHECK (
      birim IS NULL 
      OR LOWER(TRIM(birim)) IN ('g', 'gr', 'kg', 'ml', 'lt', 'l', 'adet', 'porsiyon', 'dilim', 'tutam', 'demet', 'paket')
    );
  END IF;
END $$;

-- 2. Fiyat üst limit CHECK constraint (50.000 TL/birim üstünü yasakla)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_fiyat_mantikli'
  ) THEN
    ALTER TABLE urun_kartlari ADD CONSTRAINT chk_fiyat_mantikli
    CHECK (aktif_fiyat IS NULL OR aktif_fiyat >= 0 AND aktif_fiyat < 50000);
  END IF;
END $$;

-- 3. recalc_recete_maliyet trigger'ını INSERT + UPDATE'te çalışacak şekilde yeniden oluştur
-- Eski trigger sadece UPDATE OF birim_fiyat'ta çalışıyordu
DROP TRIGGER IF EXISTS trg_recalc_recete_maliyet ON recete_malzemeler;

CREATE TRIGGER trg_recalc_recete_maliyet
  AFTER INSERT OR UPDATE OF birim_fiyat, miktar, birim ON recete_malzemeler
  FOR EACH ROW
  EXECUTE FUNCTION recalc_recete_maliyet();

-- 4. normalize_urun_birimi fonksiyonuna varsayilan_birim desteği ekle
CREATE OR REPLACE FUNCTION normalize_urun_birimi()
RETURNS TRIGGER AS $$
BEGIN
  -- birim normalizasyonu
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

  -- fiyat_birimi normalizasyonu
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

  -- varsayilan_birim normalizasyonu (YENİ - eskiden bu alan atlanıyordu)
  IF NEW.varsayilan_birim IS NOT NULL THEN
    NEW.varsayilan_birim := CASE LOWER(TRIM(NEW.varsayilan_birim))
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
      ELSE LOWER(TRIM(NEW.varsayilan_birim))
    END;
  END IF;

  -- birim NULL ise ve fiyat_birimi varsa, fiyat_birimi'ni kopyala
  IF NEW.birim IS NULL AND NEW.fiyat_birimi IS NOT NULL THEN
    NEW.birim := NEW.fiyat_birimi;
  END IF;

  -- fiyat_birimi NULL ise ve birim varsa, birim'i kopyala
  IF NEW.fiyat_birimi IS NULL AND NEW.birim IS NOT NULL THEN
    NEW.fiyat_birimi := NEW.birim;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Mevcut varsayilan_birim değerlerini normalize et (one-time)
UPDATE urun_kartlari
SET varsayilan_birim = CASE LOWER(TRIM(varsayilan_birim))
  WHEN 'gr' THEN 'kg'
  WHEN 'g' THEN 'kg'
  WHEN 'gram' THEN 'kg'
  WHEN 'ml' THEN 'lt'
  WHEN 'l' THEN 'lt'
  WHEN 'litre' THEN 'lt'
  ELSE LOWER(TRIM(varsayilan_birim))
END
WHERE varsayilan_birim IS NOT NULL
  AND LOWER(TRIM(varsayilan_birim)) IN ('gr', 'g', 'gram', 'ml', 'l', 'litre');
