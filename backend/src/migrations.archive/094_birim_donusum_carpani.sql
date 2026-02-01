-- =====================================================
-- BİRİM DÖNÜŞÜM ÇARPANI
-- Fatura birim fiyatını standart birime (KG/LT) çevirmek için
-- =====================================================

-- Ürün kartına birim dönüşüm alanları ekle
ALTER TABLE urun_kartlari ADD COLUMN IF NOT EXISTS birim_carpani DECIMAL(10,4) DEFAULT 1;
ALTER TABLE urun_kartlari ADD COLUMN IF NOT EXISTS fatura_birimi VARCHAR(20);

-- Açıklama:
-- birim_carpani: Fatura birim fiyatını standart birime çevirmek için çarpan
--   Örnek: "SANA MARGARİN PAKET 250 GR *48" = 48 × 0.25 KG = 12 KG per koli
--   birim_carpani = 12, fatura_birimi = 'NPL' (koli)
--   Standart KG fiyatı = fatura_birim_fiyat / 12
--
-- fatura_birimi: Faturada kullanılan birim kodu (NPL, KGM, C62, LTR, vb.)

-- Index
CREATE INDEX IF NOT EXISTS idx_urun_birim_carpani ON urun_kartlari(birim_carpani) WHERE birim_carpani != 1;

-- Fatura kalemleri tablosuna da hesaplanmış birim fiyat alanı ekle
ALTER TABLE fatura_kalemleri ADD COLUMN IF NOT EXISTS birim_fiyat_standart DECIMAL(15,4);

-- Trigger: Eşleştirme yapıldığında standart birim fiyatı hesapla
CREATE OR REPLACE FUNCTION hesapla_standart_birim_fiyat()
RETURNS TRIGGER AS $$
DECLARE
    v_carpan DECIMAL(10,4);
BEGIN
    -- Eğer urun_id varsa, ürün kartından birim çarpanını al
    IF NEW.urun_id IS NOT NULL THEN
        SELECT COALESCE(birim_carpani, 1) INTO v_carpan
        FROM urun_kartlari WHERE id = NEW.urun_id;

        -- Standart birim fiyatı hesapla
        NEW.birim_fiyat_standart := NEW.birim_fiyat / NULLIF(v_carpan, 0);
    ELSE
        NEW.birim_fiyat_standart := NULL;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger'ı ekle
DROP TRIGGER IF EXISTS tr_hesapla_standart_fiyat ON fatura_kalemleri;
CREATE TRIGGER tr_hesapla_standart_fiyat
    BEFORE INSERT OR UPDATE OF urun_id, birim_fiyat ON fatura_kalemleri
    FOR EACH ROW
    EXECUTE FUNCTION hesapla_standart_birim_fiyat();

-- Mevcut eşleştirilmiş kalemleri güncelle (birim_carpani=1 varsayımıyla)
UPDATE fatura_kalemleri
SET birim_fiyat_standart = birim_fiyat
WHERE urun_id IS NOT NULL AND birim_fiyat_standart IS NULL;

-- View güncelle: Standart birim fiyatı kullan (kolon listesi değiştiği için önce drop)
DROP VIEW IF EXISTS v_urun_guncel_fiyat CASCADE;
CREATE OR REPLACE VIEW v_urun_guncel_fiyat AS
SELECT
    uk.id,
    uk.kod,
    uk.ad,
    uk.kategori_id,
    uk.birim_carpani,

    -- Son standart fiyat (birim çarpanı uygulanmış)
    (
        SELECT COALESCE(fk.birim_fiyat_standart, fk.birim_fiyat / NULLIF(uk.birim_carpani, 0))
        FROM fatura_kalemleri fk
        WHERE fk.urun_id = uk.id AND fk.birim_fiyat IS NOT NULL
        ORDER BY fk.fatura_tarihi DESC NULLS LAST
        LIMIT 1
    ) as son_fiyat,

    -- Son fiyat tarihi
    (
        SELECT fk.fatura_tarihi
        FROM fatura_kalemleri fk
        WHERE fk.urun_id = uk.id
        ORDER BY fk.fatura_tarihi DESC NULLS LAST
        LIMIT 1
    ) as son_fiyat_tarihi,

    -- Ortalama standart fiyat
    (
        SELECT ROUND(AVG(COALESCE(fk.birim_fiyat_standart, fk.birim_fiyat / NULLIF(uk.birim_carpani, 0)))::numeric, 4)
        FROM fatura_kalemleri fk
        WHERE fk.urun_id = uk.id AND fk.birim_fiyat IS NOT NULL
    ) as ortalama_fiyat,

    -- Fatura sayısı
    (
        SELECT COUNT(*)
        FROM fatura_kalemleri fk
        WHERE fk.urun_id = uk.id
    ) as fatura_sayisi

FROM urun_kartlari uk;

COMMENT ON COLUMN urun_kartlari.birim_carpani IS 'Fatura birim fiyatını standart birime (KG/LT) çevirmek için çarpan. Örn: 48×250gr koli = 12 KG';
COMMENT ON COLUMN urun_kartlari.fatura_birimi IS 'Faturada kullanılan birim kodu (NPL=koli, KGM=kg, C62=adet, LTR=litre)';
COMMENT ON COLUMN fatura_kalemleri.birim_fiyat_standart IS 'Standart birime (KG/LT) dönüştürülmüş birim fiyat';
