-- Piyasa araştırma eşleştirme iyileştirmeleri
-- 1. stok_kartlari: piyasa_arama_terimi (kullanıcı/AI tarafından cache'lenen doğru arama terimi)
-- 2. piyasa_fiyat_gecmisi: eslestirme_skoru + arama_terimi

-- 1. Stok kartına piyasa arama terimi ekle
-- Bu alan kullanıcı veya AI tarafından belirlenmiş doğru arama terimini cache'ler
-- Örnek: "Ayçiçek Yağı" için "ayçiçek yağı 5lt" terimi kaydedilir
ALTER TABLE stok_kartlari
ADD COLUMN IF NOT EXISTS piyasa_arama_terimi VARCHAR(200);

COMMENT ON COLUMN stok_kartlari.piyasa_arama_terimi IS 'Piyasa araştırması için cache''lenmiş arama terimi. NULL ise otomatik normalize edilir.';

-- 2. piyasa_fiyat_gecmisi: eşleştirme skoru ve arama terimi ekle
ALTER TABLE piyasa_fiyat_gecmisi
ADD COLUMN IF NOT EXISTS eslestirme_skoru INTEGER;

ALTER TABLE piyasa_fiyat_gecmisi
ADD COLUMN IF NOT EXISTS arama_terimi VARCHAR(200);

COMMENT ON COLUMN piyasa_fiyat_gecmisi.eslestirme_skoru IS 'Ürün eşleştirme alaka skoru (0-100)';
COMMENT ON COLUMN piyasa_fiyat_gecmisi.arama_terimi IS 'Araştırmada kullanılan arama terimi';

-- 3. Stok kartlarının ambalaj_miktari'nı tekrar güncelle (daha doğru pattern ile)
UPDATE stok_kartlari 
SET ambalaj_miktari = 
  CASE 
    -- KG formatları (1.5 KG, 5KG, 0,5 Kg)
    WHEN ad ~* '(\d+[.,]?\d*)\s*kg' THEN 
      CAST(REGEXP_REPLACE(SUBSTRING(ad FROM '(\d+[.,]?\d*)\s*kg'), ',', '.', 'g') AS DECIMAL)
    -- Gram formatları (500gr, 250g, 750 GR) → kg'a çevir
    WHEN ad ~* '(\d+)\s*gr?' AND NOT ad ~* '\d+\s*grup' THEN 
      CAST(SUBSTRING(ad FROM '(\d+)\s*gr?') AS DECIMAL) / 1000
    -- Litre formatları (1lt, 5 LT, 1.5 Litre)
    WHEN ad ~* '(\d+[.,]?\d*)\s*(lt|litre)' THEN 
      CAST(REGEXP_REPLACE(SUBSTRING(ad FROM '(\d+[.,]?\d*)\s*(lt|litre)'), ',', '.', 'g') AS DECIMAL)
    -- ML formatları (500ml, 200 ML) → litreye çevir
    WHEN ad ~* '(\d+)\s*ml' THEN 
      CAST(SUBSTRING(ad FROM '(\d+)\s*ml') AS DECIMAL) / 1000
    ELSE ambalaj_miktari
  END
WHERE ad ~* '\d+\s*(kg|gr?|lt|litre|ml)\b';

-- 4. İndeks ekle (arama terimi cache lookup)
CREATE INDEX IF NOT EXISTS idx_stok_piyasa_arama ON stok_kartlari(piyasa_arama_terimi) 
WHERE piyasa_arama_terimi IS NOT NULL;

-- 5. piyasa_fiyat_gecmisi için arama terimi indeksi
CREATE INDEX IF NOT EXISTS idx_piyasa_gecmis_arama_terimi ON piyasa_fiyat_gecmisi(arama_terimi);
