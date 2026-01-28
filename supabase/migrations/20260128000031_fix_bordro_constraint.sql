-- Bordro unique constraint düzeltme
-- ON CONFLICT için COALESCE kullanılamıyor, doğrudan kolon bazlı constraint gerekli

-- Eski constraint'i kaldır
ALTER TABLE bordro_kayitlari DROP CONSTRAINT IF EXISTS bordro_kayitlari_unique;
ALTER TABLE bordro_kayitlari DROP CONSTRAINT IF EXISTS bordro_kayitlari_personel_yil_ay_key;

-- proje_id NULL olduğunda da çalışacak unique index (partial index)
-- Proje_id NULL olanlar için
CREATE UNIQUE INDEX IF NOT EXISTS idx_bordro_unique_no_proje 
  ON bordro_kayitlari (personel_id, yil, ay) 
  WHERE proje_id IS NULL;

-- Proje_id olan kayıtlar için
CREATE UNIQUE INDEX IF NOT EXISTS idx_bordro_unique_with_proje 
  ON bordro_kayitlari (personel_id, proje_id, yil, ay) 
  WHERE proje_id IS NOT NULL;

-- Normal unique constraint da ekleyelim (ON CONFLICT için)
-- Bu, proje_id NOT NULL olanlar için çalışır
ALTER TABLE bordro_kayitlari 
  ADD CONSTRAINT bordro_kayitlari_unique_proje 
  UNIQUE (personel_id, proje_id, yil, ay);

