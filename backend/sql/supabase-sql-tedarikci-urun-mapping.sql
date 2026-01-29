-- =====================================================
-- TEDARİKÇİ-ÜRÜN MAPPING SİSTEMİ
-- Supabase SQL Editor'da çalıştırın (tek seferde)
-- Bağımlılık: urun_kartlari, urun_kategorileri, fatura_kalemleri
-- =====================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Ana mapping tablosu
CREATE TABLE IF NOT EXISTS tedarikci_urun_mapping (
    id SERIAL PRIMARY KEY,

    -- Tedarikçi tanımlayıcı
    tedarikci_vkn VARCHAR(20) NOT NULL,
    tedarikci_ad VARCHAR(200),

    -- Fatura ürün tanımlayıcıları (en az biri dolu olmalı)
    fatura_urun_kodu VARCHAR(100),
    fatura_urun_adi VARCHAR(500),
    fatura_birimi VARCHAR(20),

    -- Hedef ürün kartı
    urun_kart_id INTEGER NOT NULL REFERENCES urun_kartlari(id) ON DELETE CASCADE,

    -- Birim dönüşüm bilgileri
    birim_carpani DECIMAL(10,4) DEFAULT 1,
    standart_birim VARCHAR(20) DEFAULT 'KG',

    -- Kullanım istatistikleri
    eslestirme_sayisi INTEGER DEFAULT 1,
    son_fiyat DECIMAL(15,4),
    son_kullanim_tarihi TIMESTAMP DEFAULT NOW(),

    -- Meta
    aktif BOOLEAN DEFAULT true,
    olusturan_kullanici INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Unique constraint (varsa atla)
DO $$ BEGIN
    ALTER TABLE tedarikci_urun_mapping
    ADD CONSTRAINT uq_tedarikci_urun_kod UNIQUE(tedarikci_vkn, fatura_urun_kodu);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- En az bir tanımlayıcı check (tablo yeni oluşturulduysa constraint yoktur)
DO $$ BEGIN
    ALTER TABLE tedarikci_urun_mapping
    ADD CONSTRAINT chk_en_az_bir_tanimlayici CHECK (
        fatura_urun_kodu IS NOT NULL OR fatura_urun_adi IS NOT NULL
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Index'ler
CREATE INDEX IF NOT EXISTS idx_tum_tedarikci_vkn ON tedarikci_urun_mapping(tedarikci_vkn);
CREATE INDEX IF NOT EXISTS idx_tum_urun_kart ON tedarikci_urun_mapping(urun_kart_id);
CREATE INDEX IF NOT EXISTS idx_tum_fatura_kodu ON tedarikci_urun_mapping(fatura_urun_kodu) WHERE fatura_urun_kodu IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tum_aktif ON tedarikci_urun_mapping(aktif) WHERE aktif = true;

-- Trigram index (fuzzy ad eşleştirme için)
CREATE INDEX IF NOT EXISTS idx_tum_urun_adi_trgm
ON tedarikci_urun_mapping USING gin (fatura_urun_adi gin_trgm_ops)
WHERE fatura_urun_adi IS NOT NULL;

-- =====================================================
-- VIEW: Mapping ile zenginleştirilmiş ürün bilgisi
-- =====================================================
CREATE OR REPLACE VIEW v_tedarikci_urun_detay AS
SELECT
    tum.id as mapping_id,
    tum.tedarikci_vkn,
    tum.tedarikci_ad,
    tum.fatura_urun_kodu,
    tum.fatura_urun_adi,
    tum.fatura_birimi,
    tum.birim_carpani,
    tum.standart_birim,
    tum.eslestirme_sayisi,
    tum.son_fiyat,
    tum.son_kullanim_tarihi,
    uk.id as urun_kart_id,
    uk.kod as urun_kod,
    uk.ad as urun_ad,
    uk.kategori_id,
    kat.ad as kategori_ad,
    NULL::VARCHAR as kategori_renk
FROM tedarikci_urun_mapping tum
JOIN urun_kartlari uk ON uk.id = tum.urun_kart_id
LEFT JOIN urun_kategorileri kat ON kat.id = uk.kategori_id
WHERE tum.aktif = true;

-- =====================================================
-- FUNCTION: Otomatik eşleştirme bul
-- Öncelik: 1) Kod 2) Ad tam 3) Ad fuzzy
-- =====================================================
CREATE OR REPLACE FUNCTION bul_otomatik_eslestirme(
    p_tedarikci_vkn VARCHAR,
    p_fatura_urun_kodu VARCHAR,
    p_fatura_urun_adi TEXT
)
RETURNS TABLE(
    mapping_id INTEGER,
    urun_kart_id INTEGER,
    urun_kod VARCHAR,
    urun_ad VARCHAR,
    birim_carpani DECIMAL,
    standart_birim VARCHAR,
    eslestirme_tipi VARCHAR,
    guven_skoru INTEGER
) AS $$
BEGIN
    -- 1. Kod eşleşmesi (en güvenilir)
    RETURN QUERY
    SELECT
        tum.id,
        tum.urun_kart_id,
        uk.kod,
        uk.ad,
        tum.birim_carpani,
        tum.standart_birim,
        'kod_eslesmesi'::VARCHAR,
        100::INTEGER
    FROM tedarikci_urun_mapping tum
    JOIN urun_kartlari uk ON uk.id = tum.urun_kart_id
    WHERE tum.aktif = true
      AND tum.tedarikci_vkn = p_tedarikci_vkn
      AND tum.fatura_urun_kodu IS NOT NULL
      AND tum.fatura_urun_kodu = p_fatura_urun_kodu
    LIMIT 1;

    IF FOUND THEN RETURN; END IF;

    -- 2. Ad eşleşmesi (tam eşleşme)
    RETURN QUERY
    SELECT
        tum.id,
        tum.urun_kart_id,
        uk.kod,
        uk.ad,
        tum.birim_carpani,
        tum.standart_birim,
        'ad_eslesmesi'::VARCHAR,
        90::INTEGER
    FROM tedarikci_urun_mapping tum
    JOIN urun_kartlari uk ON uk.id = tum.urun_kart_id
    WHERE tum.aktif = true
      AND tum.tedarikci_vkn = p_tedarikci_vkn
      AND tum.fatura_urun_adi IS NOT NULL
      AND UPPER(TRIM(tum.fatura_urun_adi)) = UPPER(TRIM(p_fatura_urun_adi))
    LIMIT 1;

    IF FOUND THEN RETURN; END IF;

    -- 3. Fuzzy ad eşleşmesi (benzerlik > 0.8)
    RETURN QUERY
    SELECT
        tum.id,
        tum.urun_kart_id,
        uk.kod,
        uk.ad,
        tum.birim_carpani,
        tum.standart_birim,
        'fuzzy'::VARCHAR,
        (similarity(tum.fatura_urun_adi, p_fatura_urun_adi) * 100)::INTEGER
    FROM tedarikci_urun_mapping tum
    JOIN urun_kartlari uk ON uk.id = tum.urun_kart_id
    WHERE tum.aktif = true
      AND tum.tedarikci_vkn = p_tedarikci_vkn
      AND tum.fatura_urun_adi IS NOT NULL
      AND similarity(tum.fatura_urun_adi, p_fatura_urun_adi) > 0.8
    ORDER BY similarity(tum.fatura_urun_adi, p_fatura_urun_adi) DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCTION: Mapping kaydet/güncelle (upsert)
-- =====================================================
CREATE OR REPLACE FUNCTION kaydet_tedarikci_urun_mapping(
    p_tedarikci_vkn VARCHAR,
    p_tedarikci_ad VARCHAR,
    p_fatura_urun_kodu VARCHAR,
    p_fatura_urun_adi VARCHAR,
    p_fatura_birimi VARCHAR,
    p_urun_kart_id INTEGER,
    p_birim_carpani DECIMAL DEFAULT 1,
    p_standart_birim VARCHAR DEFAULT 'KG',
    p_son_fiyat DECIMAL DEFAULT NULL,
    p_kullanici_id INTEGER DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    v_mapping_id INTEGER;
BEGIN
    SELECT id INTO v_mapping_id
    FROM tedarikci_urun_mapping
    WHERE tedarikci_vkn = p_tedarikci_vkn
      AND (
          (fatura_urun_kodu IS NOT NULL AND fatura_urun_kodu = p_fatura_urun_kodu)
          OR
          (fatura_urun_kodu IS NULL AND fatura_urun_adi = p_fatura_urun_adi)
      )
    LIMIT 1;

    IF v_mapping_id IS NOT NULL THEN
        UPDATE tedarikci_urun_mapping
        SET urun_kart_id = p_urun_kart_id,
            birim_carpani = p_birim_carpani,
            standart_birim = p_standart_birim,
            son_fiyat = COALESCE(p_son_fiyat, son_fiyat),
            eslestirme_sayisi = eslestirme_sayisi + 1,
            son_kullanim_tarihi = NOW(),
            updated_at = NOW()
        WHERE id = v_mapping_id;
    ELSE
        INSERT INTO tedarikci_urun_mapping (
            tedarikci_vkn, tedarikci_ad,
            fatura_urun_kodu, fatura_urun_adi, fatura_birimi,
            urun_kart_id, birim_carpani, standart_birim,
            son_fiyat, olusturan_kullanici
        ) VALUES (
            p_tedarikci_vkn, p_tedarikci_ad,
            p_fatura_urun_kodu, p_fatura_urun_adi, p_fatura_birimi,
            p_urun_kart_id, p_birim_carpani, p_standart_birim,
            p_son_fiyat, p_kullanici_id
        )
        RETURNING id INTO v_mapping_id;
    END IF;

    RETURN v_mapping_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- VIEW: Güncel fiyat (sadece bu script tablolarına bağımlı)
-- fatura_kalemleri yoksa bu view atlanabilir / hata verir
-- =====================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'fatura_kalemleri') THEN
        DROP VIEW IF EXISTS v_urun_guncel_fiyat CASCADE;
        CREATE VIEW v_urun_guncel_fiyat AS
        SELECT
            uk.id,
            uk.kod,
            uk.ad,
            uk.kategori_id,
            COALESCE(uk.birim_carpani, 1) as birim_carpani,
            (
                SELECT fk.birim_fiyat
                FROM fatura_kalemleri fk
                WHERE fk.urun_id = uk.id AND fk.birim_fiyat IS NOT NULL
                ORDER BY fk.fatura_tarihi DESC NULLS LAST
                LIMIT 1
            ) as son_fiyat,
            (
                SELECT fk.fatura_tarihi
                FROM fatura_kalemleri fk
                WHERE fk.urun_id = uk.id
                ORDER BY fk.fatura_tarihi DESC NULLS LAST
                LIMIT 1
            ) as son_fiyat_tarihi,
            (
                SELECT ROUND(AVG(fk.birim_fiyat)::numeric, 4)
                FROM fatura_kalemleri fk
                WHERE fk.urun_id = uk.id AND fk.birim_fiyat IS NOT NULL
            ) as ortalama_fiyat,
            (SELECT COUNT(*) FROM fatura_kalemleri fk WHERE fk.urun_id = uk.id) as fatura_sayisi,
            (SELECT COUNT(DISTINCT fk.tedarikci_vkn) FROM fatura_kalemleri fk WHERE fk.urun_id = uk.id) as tedarikci_sayisi
        FROM urun_kartlari uk
        WHERE uk.aktif = true;
    END IF;
END $$;

-- =====================================================
-- Sync trigger FONKSİYONU (trigger'dan önce tanımlanmalı)
-- =====================================================
CREATE OR REPLACE FUNCTION sync_eslestirme_to_mapping()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.urun_id IS NOT NULL AND (OLD.urun_id IS NULL OR OLD.urun_id != NEW.urun_id) THEN
        PERFORM kaydet_tedarikci_urun_mapping(
            NEW.tedarikci_vkn,
            NEW.tedarikci_ad,
            NEW.orijinal_urun_kodu,
            NEW.orijinal_urun_adi,
            NEW.birim,
            NEW.urun_id,
            COALESCE((SELECT birim_carpani FROM urun_kartlari WHERE id = NEW.urun_id), 1),
            'KG',
            NEW.birim_fiyat,
            NEW.eslestiren_kullanici
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGER: Eşleştirme yapıldığında mapping'i güncelle
-- (fatura_kalemleri ve urun_id kolonu varsa)
-- =====================================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'fatura_kalemleri' AND column_name = 'urun_id'
    ) THEN
        DROP TRIGGER IF EXISTS tr_sync_eslestirme_mapping ON fatura_kalemleri;
        CREATE TRIGGER tr_sync_eslestirme_mapping
            AFTER UPDATE OF urun_id ON fatura_kalemleri
            FOR EACH ROW
            EXECUTE FUNCTION sync_eslestirme_to_mapping();
    END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- =====================================================
-- Mevcut eşleştirmelerden mapping tablosunu doldur
-- (fatura_kalemleri varsa)
-- =====================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'fatura_kalemleri') THEN
        INSERT INTO tedarikci_urun_mapping (
            tedarikci_vkn, tedarikci_ad,
            fatura_urun_kodu, fatura_urun_adi, fatura_birimi,
            urun_kart_id, birim_carpani, son_fiyat,
            eslestirme_sayisi, son_kullanim_tarihi
        )
        SELECT
            fk.tedarikci_vkn,
            MAX(fk.tedarikci_ad),
            fk.orijinal_urun_kodu,
            MAX(fk.orijinal_urun_adi),
            MAX(fk.birim),
            fk.urun_id,
            COALESCE(MAX(uk.birim_carpani), 1),
            MAX(fk.birim_fiyat),
            COUNT(*),
            MAX(fk.eslestirme_tarihi)
        FROM fatura_kalemleri fk
        JOIN urun_kartlari uk ON uk.id = fk.urun_id
        WHERE fk.urun_id IS NOT NULL
          AND fk.tedarikci_vkn IS NOT NULL
        GROUP BY fk.tedarikci_vkn, fk.orijinal_urun_kodu, fk.urun_id
        ON CONFLICT (tedarikci_vkn, fatura_urun_kodu) DO UPDATE SET
            eslestirme_sayisi = tedarikci_urun_mapping.eslestirme_sayisi + EXCLUDED.eslestirme_sayisi,
            son_fiyat = EXCLUDED.son_fiyat,
            son_kullanim_tarihi = EXCLUDED.son_kullanim_tarihi,
            updated_at = NOW();
    END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Yorumlar
COMMENT ON TABLE tedarikci_urun_mapping IS 'Tedarikçi ürün kodları ile ürün kartları arasındaki eşleştirme tablosu.';
COMMENT ON COLUMN tedarikci_urun_mapping.birim_carpani IS 'Fatura birim fiyatını standart birime çevirmek için bölücü. Örn: 48x250gr koli için 12';
COMMENT ON COLUMN tedarikci_urun_mapping.standart_birim IS 'Standart birim: KG, LT, ADET';
