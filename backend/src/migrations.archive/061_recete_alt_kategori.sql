-- Reçetelere alt kategori alanı ekle
-- Bu alan maliyet analizi ve filtreleme için kullanılacak

-- Alt kategori alanı ekle
ALTER TABLE receteler ADD COLUMN IF NOT EXISTS alt_kategori VARCHAR(50);

-- Alt kategori indeksi
CREATE INDEX IF NOT EXISTS idx_receteler_alt_kategori ON receteler(alt_kategori);

-- ===========================================
-- TOPLU ALT KATEGORİ ATAMA (Reçete adına göre)
-- ===========================================

-- TAVUK YEMEKLERİ
UPDATE receteler SET alt_kategori = 'tavuk' 
WHERE alt_kategori IS NULL AND (
    LOWER(ad) LIKE '%tavuk%' OR 
    LOWER(ad) LIKE '%piliç%' OR
    LOWER(ad) LIKE '%chicken%'
);

-- ET YEMEKLERİ
UPDATE receteler SET alt_kategori = 'et' 
WHERE alt_kategori IS NULL AND (
    LOWER(ad) LIKE '%et %' OR 
    LOWER(ad) LIKE '%etli%' OR
    LOWER(ad) LIKE '%köfte%' OR
    LOWER(ad) LIKE '%kuzu%' OR
    LOWER(ad) LIKE '%dana%' OR
    LOWER(ad) LIKE '%biftek%' OR
    LOWER(ad) LIKE '%kavurma%' OR
    LOWER(ad) LIKE '%tandır%' OR
    LOWER(ad) LIKE '%tantuni%' OR
    LOWER(ad) LIKE '%kebab%' OR
    LOWER(ad) LIKE '%kebap%' OR
    LOWER(ad) LIKE '%güveç%' OR
    LOWER(ad) LIKE '%haşlama%' OR
    LOWER(ad) LIKE '%rosto%'
);

-- BALIK YEMEKLERİ
UPDATE receteler SET alt_kategori = 'balik' 
WHERE alt_kategori IS NULL AND (
    LOWER(ad) LIKE '%balık%' OR 
    LOWER(ad) LIKE '%balıg%' OR
    LOWER(ad) LIKE '%somon%' OR
    LOWER(ad) LIKE '%hamsi%' OR
    LOWER(ad) LIKE '%levrek%' OR
    LOWER(ad) LIKE '%çipura%' OR
    LOWER(ad) LIKE '%palamut%' OR
    LOWER(ad) LIKE '%mezgit%' OR
    LOWER(ad) LIKE '%fish%'
);

-- BAKLİYAT YEMEKLERİ
UPDATE receteler SET alt_kategori = 'bakliyat' 
WHERE alt_kategori IS NULL AND (
    LOWER(ad) LIKE '%kuru fasulye%' OR 
    LOWER(ad) LIKE '%kurufasulye%' OR
    LOWER(ad) LIKE '%nohut%' OR
    LOWER(ad) LIKE '%mercimek%' OR
    LOWER(ad) LIKE '%barbunya%' OR
    LOWER(ad) LIKE '%börülce%' OR
    LOWER(ad) LIKE '%fasulye%' OR
    LOWER(ad) LIKE '%bakla%' OR
    LOWER(ad) LIKE '%pilaki%'
);

-- SEBZE YEMEKLERİ
UPDATE receteler SET alt_kategori = 'sebze' 
WHERE alt_kategori IS NULL AND (
    LOWER(ad) LIKE '%patlıcan%' OR 
    LOWER(ad) LIKE '%kabak%' OR
    LOWER(ad) LIKE '%biber%' OR
    LOWER(ad) LIKE '%domates%' OR
    LOWER(ad) LIKE '%bamya%' OR
    LOWER(ad) LIKE '%bezelye%' OR
    LOWER(ad) LIKE '%ıspanak%' OR
    LOWER(ad) LIKE '%ispanak%' OR
    LOWER(ad) LIKE '%lahana%' OR
    LOWER(ad) LIKE '%kapuska%' OR
    LOWER(ad) LIKE '%türlü%' OR
    LOWER(ad) LIKE '%dolma%' OR
    LOWER(ad) LIKE '%sarma%' OR
    LOWER(ad) LIKE '%imam bayıldı%' OR
    LOWER(ad) LIKE '%musakka%' OR
    LOWER(ad) LIKE '%karnıyarık%' OR
    LOWER(ad) LIKE '%zeytinyağlı%' OR
    LOWER(ad) LIKE '%graten%' OR
    LOWER(ad) LIKE '%enginar%' OR
    LOWER(ad) LIKE '%kereviz%' OR
    LOWER(ad) LIKE '%havuç%' OR
    LOWER(ad) LIKE '%patates%' OR
    LOWER(ad) LIKE '%sebze%' OR
    LOWER(ad) LIKE '%karışık kızartma%' OR
    LOWER(ad) LIKE '%taze%'
);

-- PİLAV & MAKARNA
UPDATE receteler SET alt_kategori = 'pilav' 
WHERE alt_kategori IS NULL AND (
    LOWER(ad) LIKE '%pilav%' OR 
    LOWER(ad) LIKE '%bulgur%' OR
    LOWER(ad) LIKE '%makarna%' OR
    LOWER(ad) LIKE '%erişte%' OR
    LOWER(ad) LIKE '%spagetti%' OR
    LOWER(ad) LIKE '%lazanya%' OR
    LOWER(ad) LIKE '%noodle%'
);

-- ÇORBA (zaten kategori var ama emin olmak için)
UPDATE receteler SET alt_kategori = 'corba' 
WHERE alt_kategori IS NULL AND (
    LOWER(ad) LIKE '%çorba%' OR 
    LOWER(ad) LIKE '%corba%'
);

-- SALATA & MEZE
UPDATE receteler SET alt_kategori = 'salata' 
WHERE alt_kategori IS NULL AND (
    LOWER(ad) LIKE '%salata%' OR 
    LOWER(ad) LIKE '%meze%' OR
    LOWER(ad) LIKE '%cacık%' OR
    LOWER(ad) LIKE '%piyaz%' OR
    LOWER(ad) LIKE '%turşu%' OR
    LOWER(ad) LIKE '%haydari%' OR
    LOWER(ad) LIKE '%humus%' OR
    LOWER(ad) LIKE '%tarator%' OR
    LOWER(ad) LIKE '%ezme%'
);

-- TATLI
UPDATE receteler SET alt_kategori = 'tatli' 
WHERE alt_kategori IS NULL AND (
    LOWER(ad) LIKE '%tatlı%' OR 
    LOWER(ad) LIKE '%tatli%' OR
    LOWER(ad) LIKE '%baklava%' OR
    LOWER(ad) LIKE '%sütlaç%' OR
    LOWER(ad) LIKE '%muhallebi%' OR
    LOWER(ad) LIKE '%kadayıf%' OR
    LOWER(ad) LIKE '%helva%' OR
    LOWER(ad) LIKE '%revani%' OR
    LOWER(ad) LIKE '%şekerpare%' OR
    LOWER(ad) LIKE '%tulumba%' OR
    LOWER(ad) LIKE '%lokma%' OR
    LOWER(ad) LIKE '%aşure%' OR
    LOWER(ad) LIKE '%kazandibi%' OR
    LOWER(ad) LIKE '%keşkül%' OR
    LOWER(ad) LIKE '%komposto%' OR
    LOWER(ad) LIKE '%hoşaf%' OR
    LOWER(ad) LIKE '%puding%' OR
    LOWER(ad) LIKE '%pasta%' OR
    LOWER(ad) LIKE '%kek%' OR
    LOWER(ad) LIKE '%kurabiye%'
);

-- İÇECEK
UPDATE receteler SET alt_kategori = 'icecek' 
WHERE alt_kategori IS NULL AND (
    LOWER(ad) LIKE '%ayran%' OR 
    LOWER(ad) LIKE '%şalgam%' OR
    LOWER(ad) LIKE '%limonata%' OR
    LOWER(ad) LIKE '%meyve suyu%' OR
    LOWER(ad) LIKE '%çay%' OR
    LOWER(ad) LIKE '%kahve%' OR
    LOWER(ad) LIKE '%smoothie%' OR
    LOWER(ad) LIKE '%şerbet%'
);

-- KAHVALTILIK
UPDATE receteler SET alt_kategori = 'kahvalti' 
WHERE alt_kategori IS NULL AND (
    LOWER(ad) LIKE '%kahvaltı%' OR 
    LOWER(ad) LIKE '%kahvalti%' OR
    LOWER(ad) LIKE '%yumurta%' OR
    LOWER(ad) LIKE '%omlet%' OR
    LOWER(ad) LIKE '%menemen%' OR
    LOWER(ad) LIKE '%peynir%' OR
    LOWER(ad) LIKE '%zeytin%' OR
    LOWER(ad) LIKE '%reçel%' OR
    LOWER(ad) LIKE '%bal%' OR
    LOWER(ad) LIKE '%kaymak%' OR
    LOWER(ad) LIKE '%sucuk%' OR
    LOWER(ad) LIKE '%simit%' OR
    LOWER(ad) LIKE '%poğaça%' OR
    LOWER(ad) LIKE '%börek%' OR
    LOWER(ad) LIKE '%gözleme%'
);

-- Kalan kategorize edilmemişlere 'diger' ata
UPDATE receteler SET alt_kategori = 'diger' 
WHERE alt_kategori IS NULL;

-- Sonuç raporu için view
CREATE OR REPLACE VIEW v_recete_alt_kategori_dagilim AS
SELECT 
    alt_kategori,
    COUNT(*) as adet,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM receteler), 1) as yuzde
FROM receteler
GROUP BY alt_kategori
ORDER BY adet DESC;
