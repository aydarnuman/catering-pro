-- =============================================
-- REÇETE MALZEME FİYAT SÜTUNLARI
-- Fatura fiyatı ve Piyasa fiyatı ayrı ayrı tutulacak
-- =============================================

-- Mevcut birim_fiyat sütununu piyasa_fiyat olarak kullanacağız
-- Fatura fiyatı için yeni sütun ekliyoruz

-- Fatura fiyatı (stok kartından son_alis_fiyat)
ALTER TABLE recete_malzemeler 
ADD COLUMN IF NOT EXISTS fatura_fiyat DECIMAL(15,4);

-- Piyasa fiyatı (AI araştırmasından) - mevcut birim_fiyat'ı kullan veya yeniden adlandır
-- birim_fiyat zaten var, onu piyasa için kullanacağız
-- Açıklık için piyasa_fiyat sütunu da ekleyelim
ALTER TABLE recete_malzemeler 
ADD COLUMN IF NOT EXISTS piyasa_fiyat DECIMAL(15,4);

-- Fiyat güncelleme tarihleri
ALTER TABLE recete_malzemeler 
ADD COLUMN IF NOT EXISTS fatura_fiyat_tarihi TIMESTAMP;

ALTER TABLE recete_malzemeler 
ADD COLUMN IF NOT EXISTS piyasa_fiyat_tarihi TIMESTAMP;

-- Hangi fiyatın maliyet hesabında kullanılacağı (otomatik veya manuel seçim)
-- 'fatura', 'piyasa', 'manuel', 'auto' (auto = fatura varsa fatura, yoksa piyasa)
ALTER TABLE recete_malzemeler 
ADD COLUMN IF NOT EXISTS fiyat_tercihi VARCHAR(20) DEFAULT 'auto';

-- Stok kartı eşleştirme güvenilirliği (AI tarafından belirlenir)
-- 0-100 arası, 100 = kesin eşleşme
ALTER TABLE recete_malzemeler 
ADD COLUMN IF NOT EXISTS eslestirme_guvenilirligi INTEGER DEFAULT 0;

-- Yorumlar
COMMENT ON COLUMN recete_malzemeler.fatura_fiyat IS 'Stok kartından son_alis_fiyat (fatura bazlı gerçek fiyat)';
COMMENT ON COLUMN recete_malzemeler.piyasa_fiyat IS 'AI piyasa araştırmasından güncel fiyat';
COMMENT ON COLUMN recete_malzemeler.fiyat_tercihi IS 'Maliyet hesabında kullanılacak fiyat: auto, fatura, piyasa, manuel';
COMMENT ON COLUMN recete_malzemeler.eslestirme_guvenilirligi IS 'AI stok kartı eşleştirme güvenilirliği (0-100)';

-- Mevcut verileri güncelle: birim_fiyat'ı piyasa_fiyat'a kopyala
UPDATE recete_malzemeler 
SET piyasa_fiyat = birim_fiyat 
WHERE piyasa_fiyat IS NULL AND birim_fiyat IS NOT NULL;

-- Stok kartı eşleşmişlerin fatura fiyatını çek
UPDATE recete_malzemeler rm
SET fatura_fiyat = sk.son_alis_fiyat,
    fatura_fiyat_tarihi = NOW()
FROM stok_kartlari sk
WHERE rm.stok_kart_id = sk.id 
  AND sk.son_alis_fiyat IS NOT NULL
  AND rm.fatura_fiyat IS NULL;
