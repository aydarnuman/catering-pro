-- =============================================
-- STOK TRIGGER DÜZELTME
-- =============================================

-- Eski trigger'ı kaldır
DROP TRIGGER IF EXISTS trg_update_stok_after_hareket ON stok_hareketleri;

-- Fonksiyonu düzelt
CREATE OR REPLACE FUNCTION update_stok_after_hareket_new()
RETURNS TRIGGER AS $$
DECLARE
    v_depo_id INTEGER;
    v_miktar DECIMAL(15,3);
BEGIN
    -- Depo ve miktar belirle
    IF NEW.hareket_yonu = '+' THEN
        v_depo_id := NEW.giris_depo_id;
        v_miktar := NEW.miktar;
    ELSE
        v_depo_id := NEW.cikis_depo_id;
        v_miktar := -NEW.miktar;
    END IF;
    
    -- Stok kartını güncelle (toplam)
    UPDATE stok_kartlari 
    SET 
        toplam_stok = toplam_stok + v_miktar,
        son_alis_tarihi = CASE 
            WHEN NEW.hareket_tipi = 'GIRIS' THEN NEW.belge_tarihi 
            ELSE son_alis_tarihi 
        END,
        son_alis_fiyat = CASE 
            WHEN NEW.hareket_tipi = 'GIRIS' THEN NEW.birim_fiyat 
            ELSE son_alis_fiyat 
        END,
        updated_at = NOW()
    WHERE id = NEW.stok_kart_id;
    
    -- Depo stok durumunu güncelle
    INSERT INTO stok_depo_durumlari (stok_kart_id, depo_id, miktar, son_giris_tarihi)
    VALUES (NEW.stok_kart_id, v_depo_id, v_miktar, NEW.belge_tarihi)
    ON CONFLICT (stok_kart_id, depo_id)
    DO UPDATE SET 
        miktar = stok_depo_durumlari.miktar + v_miktar,
        son_giris_tarihi = CASE 
            WHEN NEW.hareket_yonu = '+' THEN NEW.belge_tarihi 
            ELSE stok_depo_durumlari.son_giris_tarihi 
        END,
        son_cikis_tarihi = CASE 
            WHEN NEW.hareket_yonu = '-' THEN NEW.belge_tarihi 
            ELSE stok_depo_durumlari.son_cikis_tarihi 
        END,
        updated_at = NOW();
    
    -- Transfer durumunda her iki depoyu güncelle
    IF NEW.hareket_tipi = 'TRANSFER' THEN
        -- Çıkış deposu
        UPDATE stok_depo_durumlari 
        SET 
            miktar = miktar - NEW.miktar,
            son_cikis_tarihi = NEW.belge_tarihi,
            updated_at = NOW()
        WHERE stok_kart_id = NEW.stok_kart_id 
        AND depo_id = NEW.cikis_depo_id;
        
        -- Giriş deposu
        INSERT INTO stok_depo_durumlari (stok_kart_id, depo_id, miktar, son_giris_tarihi)
        VALUES (NEW.stok_kart_id, NEW.giris_depo_id, NEW.miktar, NEW.belge_tarihi)
        ON CONFLICT (stok_kart_id, depo_id)
        DO UPDATE SET 
            miktar = stok_depo_durumlari.miktar + NEW.miktar,
            son_giris_tarihi = NEW.belge_tarihi,
            updated_at = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Yeni trigger'ı ekle
CREATE TRIGGER trg_update_stok_after_hareket
    AFTER INSERT ON stok_hareketleri
    FOR EACH ROW
    EXECUTE FUNCTION update_stok_after_hareket_new();
