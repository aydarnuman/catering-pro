-- =============================================
-- 076: AKILLI EŞLEŞTİRME - ÜRÜN KARTLARI SİSTEMİ
-- urun_kartlari tablosu için eşleştirme fonksiyonları
-- =============================================

-- pg_trgm extension (fuzzy search için)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Ürün kartı adına trigram indeksi
CREATE INDEX IF NOT EXISTS idx_urun_kartlari_ad_trgm ON urun_kartlari USING gin (ad gin_trgm_ops);

-- Eski fonksiyonları sil
DROP FUNCTION IF EXISTS kontrol_fiyat_anomali(INTEGER, DECIMAL, DECIMAL);
DROP FUNCTION IF EXISTS akilli_stok_eslestir(TEXT, TEXT, TEXT);

-- =============================================
-- ÜRÜN ADI NORMALİZE FONKSİYONU (Türkçe ASCII dönüşümü)
-- =============================================
CREATE OR REPLACE FUNCTION normalize_urun_adi_v2(ad TEXT)
RETURNS TEXT AS $$
DECLARE
    result TEXT;
BEGIN
    result := LOWER(COALESCE(ad, ''));
    -- Türkçe karakterleri ASCII'ye dönüştür
    result := TRANSLATE(result, 'ıİğĞüÜşŞöÖçÇâÂîÎûÛêÊôÔ', 'iiggUUssoocc');
    -- Sadece ASCII harfler, rakamlar ve boşluk bırak (tüm unicode sorunlarını çöz)
    result := REGEXP_REPLACE(result, '[^a-z0-9 ]', '', 'g');
    -- Miktar/birim kaldır
    result := REGEXP_REPLACE(result, '\d+\s*(kg|gr|g|lt|l|ml|adet|ad|pkt|paket|kutu|koli)\b', '', 'gi');
    -- Çoklu boşlukları tek boşluğa
    result := REGEXP_REPLACE(result, '\s+', ' ', 'g');
    RETURN TRIM(result);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =============================================
-- AKILLI EŞLEŞTİRME FONKSİYONU
-- urun_kartlari tablosunu kullanır
-- =============================================
CREATE OR REPLACE FUNCTION akilli_stok_eslestir(
    p_urun_adi TEXT,
    p_urun_kodu TEXT DEFAULT NULL,
    p_tedarikci_vkn TEXT DEFAULT NULL
)
RETURNS TABLE (
    stok_kart_id INTEGER,
    stok_kodu VARCHAR,
    stok_adi VARCHAR,
    guven_skoru DECIMAL,
    eslestirme_yontemi VARCHAR,
    benzerlik DECIMAL
) AS $$
DECLARE
    normalized_adi TEXT;
BEGIN
    normalized_adi := normalize_urun_adi_v2(p_urun_adi);
    
    -- 1. Önce tam kod eşleşmesi kontrol et
    IF p_urun_kodu IS NOT NULL THEN
        RETURN QUERY
        SELECT 
            uk.id,
            uk.kod,
            uk.ad,
            100::DECIMAL,
            'tam_eslesme'::VARCHAR,
            1.0::DECIMAL
        FROM urun_kartlari uk
        WHERE uk.kod = p_urun_kodu AND uk.aktif = TRUE
        LIMIT 1;
        
        IF FOUND THEN RETURN; END IF;
    END IF;
    
    -- 2. Tedarikçi geçmişinden eşleşme ara
    RETURN QUERY
    SELECT 
        ute.urun_kart_id,
        uk.kod,
        uk.ad,
        LEAST(100, 80 + (ute.eslestirme_sayisi * 2))::DECIMAL,
        'gecmis_eslesme'::VARCHAR,
        0.9::DECIMAL
    FROM urun_tedarikci_eslestirme ute
    JOIN urun_kartlari uk ON uk.id = ute.urun_kart_id
    WHERE ute.aktif = TRUE
      AND uk.aktif = TRUE
      AND (
          ute.tedarikci_urun_adi_normalized = normalized_adi
          OR (p_urun_kodu IS NOT NULL AND ute.tedarikci_urun_kodu = p_urun_kodu)
          OR ute.tedarikci_urun_adi ILIKE '%' || LEFT(p_urun_adi, 15) || '%'
      )
    ORDER BY ute.eslestirme_sayisi DESC
    LIMIT 1;
    
    IF FOUND THEN RETURN; END IF;
    
    -- 3. Kelime eşleşmesi (ürün kartı adı fatura kaleminde geçiyorsa - ÖNCELİKLİ)
    RETURN QUERY
    SELECT 
        uk.id,
        uk.kod,
        uk.ad,
        80::DECIMAL,
        'kelime_eslesme'::VARCHAR,
        0.8::DECIMAL
    FROM urun_kartlari uk
    WHERE uk.aktif = TRUE
      AND normalized_adi ILIKE '%' || normalize_urun_adi_v2(uk.ad) || '%'
      AND LENGTH(normalize_urun_adi_v2(uk.ad)) >= 4
    LIMIT 3;
    
    IF FOUND THEN RETURN; END IF;
    
    -- 4. Fuzzy match (düşük eşik)
    RETURN QUERY
    SELECT 
        uk.id,
        uk.kod,
        uk.ad,
        (similarity(normalize_urun_adi_v2(uk.ad), normalized_adi) * 90)::DECIMAL,
        'fuzzy_match'::VARCHAR,
        similarity(normalize_urun_adi_v2(uk.ad), normalized_adi)::DECIMAL
    FROM urun_kartlari uk
    WHERE uk.aktif = TRUE
      AND similarity(normalize_urun_adi_v2(uk.ad), normalized_adi) >= 0.15
    ORDER BY similarity(normalize_urun_adi_v2(uk.ad), normalized_adi) DESC
    LIMIT 5;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- FİYAT ANOMALİ KONTROL FONKSİYONU
-- urun_fiyat_gecmisi tablosunu kullanır
-- =============================================
CREATE OR REPLACE FUNCTION kontrol_fiyat_anomali(
    p_urun_kart_id INTEGER,
    p_yeni_fiyat DECIMAL,
    p_esik_yuzde DECIMAL DEFAULT 30
)
RETURNS TABLE (
    anomali_var BOOLEAN,
    onceki_fiyat DECIMAL,
    fiyat_degisim_yuzde DECIMAL,
    aciklama VARCHAR
) AS $$
DECLARE
    v_onceki_fiyat DECIMAL;
    v_degisim DECIMAL;
BEGIN
    -- Son fiyatı al (urun_fiyat_gecmisi tablosundan)
    SELECT ufg.fiyat INTO v_onceki_fiyat
    FROM urun_fiyat_gecmisi ufg
    WHERE ufg.urun_kart_id = p_urun_kart_id
    ORDER BY ufg.tarih DESC, ufg.id DESC
    LIMIT 1;
    
    -- Önceki fiyat yoksa anomali yok
    IF v_onceki_fiyat IS NULL OR v_onceki_fiyat = 0 THEN
        RETURN QUERY SELECT FALSE, NULL::DECIMAL, NULL::DECIMAL, NULL::VARCHAR;
        RETURN;
    END IF;
    
    -- Değişim oranını hesapla
    v_degisim := ((p_yeni_fiyat - v_onceki_fiyat) / v_onceki_fiyat) * 100;
    
    -- Anomali kontrolü
    IF ABS(v_degisim) >= p_esik_yuzde THEN
        RETURN QUERY SELECT 
            TRUE,
            v_onceki_fiyat,
            ROUND(v_degisim, 2),
            CASE 
                WHEN v_degisim > 0 THEN 
                    FORMAT('Fiyat %%%.0f arttı (₺%.2f → ₺%.2f)', v_degisim, v_onceki_fiyat, p_yeni_fiyat)
                ELSE 
                    FORMAT('Fiyat %%%.0f düştü (₺%.2f → ₺%.2f)', ABS(v_degisim), v_onceki_fiyat, p_yeni_fiyat)
            END::VARCHAR;
    ELSE
        RETURN QUERY SELECT FALSE, v_onceki_fiyat, ROUND(v_degisim, 2), NULL::VARCHAR;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- YORUMLAR
-- =============================================
COMMENT ON FUNCTION normalize_urun_adi_v2(TEXT) IS 'Ürün adını karşılaştırma için normalize eder';
COMMENT ON FUNCTION akilli_stok_eslestir(TEXT, TEXT, TEXT) IS 'Fatura kalemini ürün kartına akıllı eşleştirir (urun_kartlari tablosu)';
COMMENT ON FUNCTION kontrol_fiyat_anomali(INTEGER, DECIMAL, DECIMAL) IS 'Fiyat değişim anomalisini tespit eder (urun_fiyat_gecmisi tablosu)';
