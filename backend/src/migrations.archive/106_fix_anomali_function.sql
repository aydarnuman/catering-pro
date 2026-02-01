-- Fix kontrol_fiyat_anomali function - FORMAT string error
DROP FUNCTION IF EXISTS kontrol_fiyat_anomali(INTEGER, DECIMAL, DECIMAL);

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
                    CONCAT('Fiyat ', ROUND(v_degisim)::TEXT, '% artti')
                ELSE 
                    CONCAT('Fiyat ', ROUND(ABS(v_degisim))::TEXT, '% dustu')
            END::VARCHAR;
    ELSE
        RETURN QUERY SELECT FALSE, v_onceki_fiyat, ROUND(v_degisim, 2), NULL::VARCHAR;
    END IF;
END;
$$ LANGUAGE plpgsql;
