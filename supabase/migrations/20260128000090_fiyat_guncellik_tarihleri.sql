-- Fiyat güncellik tarihlerini ekle
-- Bu migration fiyat verilerinin ne zaman güncellendiğini takip eder

-- recete_malzemeler tablosuna fiyat güncellik tarihleri ekle
ALTER TABLE recete_malzemeler
ADD COLUMN IF NOT EXISTS fatura_fiyat_tarihi TIMESTAMP,
ADD COLUMN IF NOT EXISTS piyasa_fiyat_tarihi TIMESTAMP;

-- urun_kartlari tablosuna son alış tarihi ekle (zaten olabilir)
ALTER TABLE urun_kartlari
ADD COLUMN IF NOT EXISTS son_alis_tarihi TIMESTAMP;

-- piyasa_fiyat_gecmisi zaten arastirma_tarihi var, ek bir şey gerekmez

-- Mevcut verilere default tarih ata (migration sırasında)
UPDATE recete_malzemeler
SET fatura_fiyat_tarihi = updated_at
WHERE fatura_fiyat IS NOT NULL AND fatura_fiyat_tarihi IS NULL;

UPDATE recete_malzemeler
SET piyasa_fiyat_tarihi = updated_at
WHERE piyasa_fiyat IS NOT NULL AND piyasa_fiyat_tarihi IS NULL;

UPDATE urun_kartlari
SET son_alis_tarihi = updated_at
WHERE son_alis_fiyati IS NOT NULL AND son_alis_tarihi IS NULL;

-- Trigger: Fiyat değiştiğinde tarihi güncelle
CREATE OR REPLACE FUNCTION update_fiyat_tarihi()
RETURNS TRIGGER AS $$
BEGIN
  -- Fatura fiyatı değiştiyse
  IF NEW.fatura_fiyat IS DISTINCT FROM OLD.fatura_fiyat THEN
    NEW.fatura_fiyat_tarihi = NOW();
  END IF;

  -- Piyasa fiyatı değiştiyse
  IF NEW.piyasa_fiyat IS DISTINCT FROM OLD.piyasa_fiyat THEN
    NEW.piyasa_fiyat_tarihi = NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_recete_malzeme_fiyat_tarihi ON recete_malzemeler;
CREATE TRIGGER trg_recete_malzeme_fiyat_tarihi
  BEFORE UPDATE ON recete_malzemeler
  FOR EACH ROW
  EXECUTE FUNCTION update_fiyat_tarihi();

-- Ürün kartları için de trigger
CREATE OR REPLACE FUNCTION update_urun_alis_tarihi()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.son_alis_fiyati IS DISTINCT FROM OLD.son_alis_fiyati THEN
    NEW.son_alis_tarihi = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_urun_alis_tarihi ON urun_kartlari;
CREATE TRIGGER trg_urun_alis_tarihi
  BEFORE UPDATE ON urun_kartlari
  FOR EACH ROW
  EXECUTE FUNCTION update_urun_alis_tarihi();

-- Fiyat güncellik kontrolü için yardımcı fonksiyon
CREATE OR REPLACE FUNCTION fiyat_guncel_mi(tarih TIMESTAMP, gun_limiti INTEGER DEFAULT 30)
RETURNS BOOLEAN AS $$
BEGIN
  IF tarih IS NULL THEN
    RETURN FALSE;
  END IF;
  RETURN tarih > NOW() - (gun_limiti || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION fiyat_guncel_mi IS 'Fiyatın belirtilen gün içinde güncel olup olmadığını kontrol eder';
