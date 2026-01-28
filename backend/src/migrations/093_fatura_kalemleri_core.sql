-- =====================================================
-- FATURA KALEMLERİ - CORE SİSTEM
-- Tek kaynak tablo + temel view'lar
-- =====================================================

-- fatura_kalemleri tablosu (092'de oluşturuldu, doğrula)
-- Yoksa oluştur:
CREATE TABLE IF NOT EXISTS fatura_kalemleri (
    id SERIAL PRIMARY KEY,

    -- Fatura referansı
    fatura_ettn VARCHAR(100) NOT NULL,
    kalem_sira INTEGER NOT NULL,

    -- Orijinal fatura bilgileri (değişmez)
    orijinal_urun_adi TEXT NOT NULL,
    orijinal_urun_kodu VARCHAR(100),
    miktar DECIMAL(15,3) NOT NULL,
    birim VARCHAR(20),
    birim_fiyat DECIMAL(15,4),
    tutar DECIMAL(15,2),
    kdv_orani DECIMAL(5,2),
    kdv_tutari DECIMAL(15,2),

    -- Tedarikçi
    tedarikci_vkn VARCHAR(20),
    tedarikci_ad VARCHAR(200),
    fatura_tarihi DATE,

    -- ETİKETLEME (ürün kartına bağlantı)
    urun_id INTEGER REFERENCES urun_kartlari(id) ON DELETE SET NULL,
    eslestirme_tarihi TIMESTAMP,
    eslestiren_kullanici INTEGER,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(fatura_ettn, kalem_sira)
);

-- Index'ler
CREATE INDEX IF NOT EXISTS idx_fk_ettn ON fatura_kalemleri(fatura_ettn);
CREATE INDEX IF NOT EXISTS idx_fk_urun ON fatura_kalemleri(urun_id) WHERE urun_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fk_tarih ON fatura_kalemleri(fatura_tarihi DESC);
CREATE INDEX IF NOT EXISTS idx_fk_tedarikci ON fatura_kalemleri(tedarikci_vkn);

-- Mevcut tabloda updated_at yoksa ekle (092'den gelen yapı için)
ALTER TABLE fatura_kalemleri ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Trigram index (fuzzy search için)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_fk_urun_adi_trgm
ON fatura_kalemleri USING gin (orijinal_urun_adi gin_trgm_ops);

-- =====================================================
-- VIEW: ÜRÜN GÜNCEL FİYAT
-- Kolon sırası/adi değiştiği için önce drop (42P16)
-- =====================================================
DROP VIEW IF EXISTS v_urun_guncel_fiyat CASCADE;
CREATE OR REPLACE VIEW v_urun_guncel_fiyat AS
SELECT
    uk.id,
    uk.kod,
    uk.ad,
    uk.kategori_id,

    -- Son fiyat
    (
        SELECT fk.birim_fiyat
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

    -- Ortalama fiyat
    (
        SELECT ROUND(AVG(fk.birim_fiyat)::numeric, 4)
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

-- =====================================================
-- VIEW: FİYAT GEÇMİŞİ (kolon değişikliği olabileceği için önce drop)
-- =====================================================
DROP VIEW IF EXISTS v_urun_fiyat_gecmisi CASCADE;
CREATE OR REPLACE VIEW v_urun_fiyat_gecmisi AS
SELECT
    fk.id,
    fk.urun_id,
    uk.kod as urun_kod,
    uk.ad as urun_ad,
    fk.orijinal_urun_adi,
    fk.tedarikci_vkn,
    fk.tedarikci_ad,
    fk.miktar,
    fk.birim,
    fk.birim_fiyat,
    fk.tutar,
    fk.fatura_tarihi,
    fk.fatura_ettn
FROM fatura_kalemleri fk
JOIN urun_kartlari uk ON uk.id = fk.urun_id
WHERE fk.urun_id IS NOT NULL
ORDER BY fk.fatura_tarihi DESC;

-- =====================================================
-- VIEW: EŞLEŞTİRME DURUMU (uyumsoft_invoices ile, kolon farkı için önce drop)
-- =====================================================
DROP VIEW IF EXISTS v_fatura_eslesme_durumu CASCADE;
CREATE OR REPLACE VIEW v_fatura_eslesme_durumu AS
SELECT
    fk.fatura_ettn,
    ui.invoice_no as fatura_no,
    ui.sender_name as tedarikci,
    ui.invoice_date as fatura_tarihi,
    COUNT(*) as toplam_kalem,
    COUNT(fk.urun_id) as eslesen_kalem,
    ROUND(COUNT(fk.urun_id)::numeric / NULLIF(COUNT(*), 0)::numeric * 100, 1) as eslesme_yuzdesi
FROM fatura_kalemleri fk
LEFT JOIN uyumsoft_invoices ui ON ui.ettn = fk.fatura_ettn
GROUP BY fk.fatura_ettn, ui.invoice_no, ui.sender_name, ui.invoice_date
ORDER BY ui.invoice_date DESC NULLS LAST, fk.fatura_ettn;

-- =====================================================
-- FUNCTION: ÖNERİLEN ÜRÜN EŞLEŞTİR (benzerlik + geçmiş)
-- =====================================================
CREATE OR REPLACE FUNCTION onerilen_urun_bul(
    p_urun_adi TEXT,
    p_tedarikci_vkn VARCHAR DEFAULT NULL
)
RETURNS TABLE(
    urun_id INTEGER,
    urun_kod VARCHAR,
    urun_ad VARCHAR,
    benzerlik NUMERIC,
    onceki_eslesme_sayisi BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        uk.id,
        uk.kod,
        uk.ad,
        similarity(p_urun_adi, uk.ad) as benzerlik,
        (
            SELECT COUNT(*)
            FROM fatura_kalemleri fk2
            WHERE fk2.urun_id = uk.id
            AND (p_tedarikci_vkn IS NULL OR fk2.tedarikci_vkn = p_tedarikci_vkn)
        ) as onceki_eslesme_sayisi
    FROM urun_kartlari uk
    WHERE similarity(p_urun_adi, uk.ad) > 0.3
    ORDER BY
        onceki_eslesme_sayisi DESC,
        benzerlik DESC
    LIMIT 10;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGER: updated_at otomatik güncelle
-- =====================================================
CREATE OR REPLACE FUNCTION update_fatura_kalemleri_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_fatura_kalemleri_updated ON fatura_kalemleri;
CREATE TRIGGER tr_fatura_kalemleri_updated
    BEFORE UPDATE ON fatura_kalemleri
    FOR EACH ROW
    EXECUTE FUNCTION update_fatura_kalemleri_updated_at();
