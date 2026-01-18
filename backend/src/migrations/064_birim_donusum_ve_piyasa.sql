-- 064_birim_donusum_ve_piyasa.sql
-- Birim dönüşümü ve piyasa araştırma iyileştirmeleri

-- 1. stok_kartlari tablosuna ambalaj_miktari ekle
-- Bu alan ürünün ambalaj miktarını tutar (örn: 1.5 kg, 0.75 kg)
ALTER TABLE stok_kartlari
ADD COLUMN IF NOT EXISTS ambalaj_miktari DECIMAL(10,3) DEFAULT 1;

-- Mevcut stok kartları için ambalaj miktarını tahmin et (ürün adından)
-- Örnek: "Billur İyotlu Tuz 1.5 KG" → 1.5
-- Örnek: "Marsa Tuz 750g" → 0.75
UPDATE stok_kartlari 
SET ambalaj_miktari = 
  CASE 
    -- KG formatları
    WHEN ad ~* '(\d+[.,]?\d*)\s*kg' THEN 
      CAST(REGEXP_REPLACE(SUBSTRING(ad FROM '(\d+[.,]?\d*)\s*kg'), ',', '.', 'g') AS DECIMAL)
    -- Gram formatları (kg'a çevir)
    WHEN ad ~* '(\d+)\s*gr?' THEN 
      CAST(SUBSTRING(ad FROM '(\d+)\s*gr?') AS DECIMAL) / 1000
    -- Litre formatları
    WHEN ad ~* '(\d+[.,]?\d*)\s*lt?' THEN 
      CAST(REGEXP_REPLACE(SUBSTRING(ad FROM '(\d+[.,]?\d*)\s*lt?'), ',', '.', 'g') AS DECIMAL)
    -- ML formatları (litreye çevir)
    WHEN ad ~* '(\d+)\s*ml' THEN 
      CAST(SUBSTRING(ad FROM '(\d+)\s*ml') AS DECIMAL) / 1000
    ELSE 1
  END
WHERE ambalaj_miktari IS NULL OR ambalaj_miktari = 1;

-- 2. piyasa_fiyat_gecmisi tablosuna yeni alanlar ekle
ALTER TABLE piyasa_fiyat_gecmisi
ADD COLUMN IF NOT EXISTS ana_urun_id INTEGER REFERENCES ana_urunler(id) ON DELETE SET NULL;

ALTER TABLE piyasa_fiyat_gecmisi
ADD COLUMN IF NOT EXISTS market_adi VARCHAR(100);

ALTER TABLE piyasa_fiyat_gecmisi
ADD COLUMN IF NOT EXISTS marka VARCHAR(100);

ALTER TABLE piyasa_fiyat_gecmisi
ADD COLUMN IF NOT EXISTS ambalaj_miktar DECIMAL(10,3);

ALTER TABLE piyasa_fiyat_gecmisi
ADD COLUMN IF NOT EXISTS birim_fiyat DECIMAL(15,2); -- KG/LT bazında hesaplanmış fiyat

-- İndeks ekle
CREATE INDEX IF NOT EXISTS idx_piyasa_fiyat_ana_urun ON piyasa_fiyat_gecmisi(ana_urun_id);
CREATE INDEX IF NOT EXISTS idx_piyasa_fiyat_market ON piyasa_fiyat_gecmisi(market_adi);

-- 3. Örnek piyasa verisi ekle (test için) - ATLANACAK
-- piyasa_fiyat_gecmisi tablosunda tüm sütunlar olmayabilir
-- Bu INSERT manuel olarak çalıştırılabilir
-- INSERT INTO piyasa_fiyat_gecmisi (ana_urun_id, market_adi, marka, ambalaj_miktar, piyasa_fiyat_ort, birim_fiyat, arastirma_tarihi, urun_adi)
-- SELECT ...;

COMMENT ON COLUMN stok_kartlari.ambalaj_miktari IS 'Ürünün ambalaj miktarı (KG veya LT cinsinden). Örn: 1.5kg tuz için 1.5';
COMMENT ON COLUMN piyasa_fiyat_gecmisi.ana_urun_id IS 'Genel ürün bazlı piyasa araştırması için ana ürün referansı';
COMMENT ON COLUMN piyasa_fiyat_gecmisi.market_adi IS 'Fiyatın alındığı market (A101, Migros, BİM vb.)';
COMMENT ON COLUMN piyasa_fiyat_gecmisi.marka IS 'Ürün markası';
COMMENT ON COLUMN piyasa_fiyat_gecmisi.birim_fiyat IS 'KG veya LT başına hesaplanmış fiyat';
