-- v_urun_guncel_fiyat view'ini genislet
-- Mevcut: sadece fatura_kalemleri'nden fiyat
-- Yeni: fatura > urun_fiyat_gecmisi > manuel_fiyat fallback + raf_fiyat (piyasa) kolonu

CREATE OR REPLACE VIEW v_urun_guncel_fiyat AS
SELECT
    uk.id,
    uk.kod,
    uk.ad,
    uk.kategori_id,
    COALESCE(uk.birim_carpani, 1) as birim_carpani,

    -- Son fiyat: fatura > urun_fiyat_gecmisi > manuel_fiyat
    COALESCE(
        -- 1. Fatura'dan son fiyat
        (
            SELECT COALESCE(fk.birim_fiyat_standart, fk.birim_fiyat / NULLIF(COALESCE(uk.birim_carpani, 1), 0))
            FROM fatura_kalemleri fk
            WHERE fk.urun_id = uk.id AND fk.birim_fiyat IS NOT NULL
            ORDER BY fk.fatura_tarihi DESC NULLS LAST
            LIMIT 1
        ),
        -- 2. urun_fiyat_gecmisi'nden son fiyat
        (
            SELECT ufg.fiyat::numeric
            FROM urun_fiyat_gecmisi ufg
            WHERE ufg.urun_kart_id = uk.id AND ufg.fiyat IS NOT NULL
            ORDER BY ufg.tarih DESC NULLS LAST, ufg.created_at DESC NULLS LAST
            LIMIT 1
        ),
        -- 3. Manuel fiyat
        uk.manuel_fiyat
    ) as son_fiyat,

    -- Son fiyat tarihi (fatura > urun_fiyat_gecmisi > null)
    COALESCE(
        (
            SELECT fk.fatura_tarihi
            FROM fatura_kalemleri fk
            WHERE fk.urun_id = uk.id
            ORDER BY fk.fatura_tarihi DESC NULLS LAST
            LIMIT 1
        ),
        (
            SELECT ufg.tarih
            FROM urun_fiyat_gecmisi ufg
            WHERE ufg.urun_kart_id = uk.id
            ORDER BY ufg.tarih DESC NULLS LAST, ufg.created_at DESC NULLS LAST
            LIMIT 1
        )
    ) as son_fiyat_tarihi,

    -- Ortalama fiyat (sadece fatura, en guvenilir)
    (
        SELECT ROUND(AVG(COALESCE(fk.birim_fiyat_standart, fk.birim_fiyat / NULLIF(COALESCE(uk.birim_carpani, 1), 0)))::numeric, 4)
        FROM fatura_kalemleri fk
        WHERE fk.urun_id = uk.id AND fk.birim_fiyat IS NOT NULL
    ) as ortalama_fiyat,

    -- Fatura sayisi
    (
        SELECT COUNT(*)
        FROM fatura_kalemleri fk
        WHERE fk.urun_id = uk.id
    ) as fatura_sayisi,

    -- Tedarikci sayisi
    (
        SELECT COUNT(DISTINCT fk.tedarikci_vkn)
        FROM fatura_kalemleri fk
        WHERE fk.urun_id = uk.id
    ) as tedarikci_sayisi,

    -- Fiyat kaynagi: hangi kaynaktan geliyor
    CASE
        WHEN EXISTS (
            SELECT 1 FROM fatura_kalemleri fk
            WHERE fk.urun_id = uk.id AND fk.birim_fiyat IS NOT NULL
        ) THEN 'fatura'
        WHEN EXISTS (
            SELECT 1 FROM urun_fiyat_gecmisi ufg
            WHERE ufg.urun_kart_id = uk.id AND ufg.fiyat IS NOT NULL
        ) THEN 'gecmis'
        WHEN uk.manuel_fiyat IS NOT NULL THEN 'manuel'
        ELSE NULL
    END as fiyat_kaynagi,

    -- Raf fiyati: piyasa_fiyat_gecmisi'nden son arastirma (Camgoz.net)
    (
        SELECT pfg.piyasa_fiyat_ort
        FROM piyasa_fiyat_gecmisi pfg
        WHERE pfg.urun_kart_id = uk.id
        ORDER BY pfg.arastirma_tarihi DESC NULLS LAST
        LIMIT 1
    ) as raf_fiyat,

    -- Raf fiyat arastirma tarihi
    (
        SELECT pfg.arastirma_tarihi
        FROM piyasa_fiyat_gecmisi pfg
        WHERE pfg.urun_kart_id = uk.id
        ORDER BY pfg.arastirma_tarihi DESC NULLS LAST
        LIMIT 1
    ) as raf_fiyat_tarihi

FROM urun_kartlari uk
WHERE uk.aktif = true;
