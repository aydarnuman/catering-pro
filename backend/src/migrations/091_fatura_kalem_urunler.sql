-- =====================================================
-- FATURA KALEM → ÜRÜN EŞLEŞTİRME SİSTEMİ (BASİTLEŞTİRİLMİŞ)
-- =====================================================
-- Bu migration:
-- 1. fatura_kalem_urunler tablosu oluşturur (direkt eşleştirme)
-- 2. Maliyet hesaplama view'ları oluşturur
-- 3. Karmaşık AI eşleştirme sisteminin yerini alır
-- =====================================================

-- 1. FATURA KALEM ÜRÜNLER TABLOSU
-- Her fatura kalemi direkt bir ürün kartına bağlanır
CREATE TABLE IF NOT EXISTS fatura_kalem_urunler (
    id SERIAL PRIMARY KEY,
    
    -- Fatura referansı
    fatura_ettn VARCHAR(100) NOT NULL,
    kalem_sira INTEGER NOT NULL,
    
    -- Ürün bağlantısı (NULL olabilir - henüz eşleştirilmemiş)
    urun_id INTEGER REFERENCES urun_kartlari(id) ON DELETE SET NULL,
    
    -- Faturadan gelen orijinal bilgiler (değişmez, kaynak data)
    fatura_urun_adi TEXT NOT NULL,
    fatura_urun_kodu VARCHAR(100),
    miktar DECIMAL(15,3) NOT NULL,
    birim VARCHAR(20),              -- UBL birim kodu (KGM, LTR, C62, vb.)
    birim_fiyat DECIMAL(15,4),
    tutar DECIMAL(15,2),
    kdv_orani DECIMAL(5,2),
    kdv_tutari DECIMAL(15,2),
    
    -- Tedarikçi bilgisi (faturadan)
    tedarikci_vkn VARCHAR(20),
    tedarikci_ad VARCHAR(200),
    fatura_tarihi DATE,
    
    -- Dönüştürülmüş miktar (standart birime)
    standart_miktar DECIMAL(15,3),   -- Sistem biriminde miktar
    standart_birim VARCHAR(20),      -- Sistem birimi (KG, LT, ADET)
    
    -- Meta
    eslestirme_tarihi TIMESTAMP,
    eslestiren_kullanici INTEGER REFERENCES users(id),
    notlar TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    
    -- Benzersizlik: Bir faturanın aynı kalemi tekrar eşleştirilemez
    UNIQUE(fatura_ettn, kalem_sira)
);

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_fku_urun ON fatura_kalem_urunler(urun_id);
CREATE INDEX IF NOT EXISTS idx_fku_ettn ON fatura_kalem_urunler(fatura_ettn);
CREATE INDEX IF NOT EXISTS idx_fku_tarih ON fatura_kalem_urunler(fatura_tarihi DESC);
CREATE INDEX IF NOT EXISTS idx_fku_tedarikci ON fatura_kalem_urunler(tedarikci_vkn);
CREATE INDEX IF NOT EXISTS idx_fku_eslesme ON fatura_kalem_urunler(urun_id) WHERE urun_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fku_eslesmemis ON fatura_kalem_urunler(fatura_ettn) WHERE urun_id IS NULL;

-- Trigram index for fuzzy search on product names
CREATE INDEX IF NOT EXISTS idx_fku_urun_adi_trgm 
ON fatura_kalem_urunler USING gin (fatura_urun_adi gin_trgm_ops);

-- 2. VIEW: ÜRÜN FİYAT GEÇMİŞİ (Faturalardan otomatik)
-- Kolon/şema değişikliklerinde 42P16 hatasını önlemek için önce hepsini drop
DROP VIEW IF EXISTS v_urun_fiyat_gecmisi_fatura CASCADE;
DROP VIEW IF EXISTS v_urun_maliyet_ozet CASCADE;
DROP VIEW IF EXISTS v_tedarikci_fiyat_karsilastirma CASCADE;
DROP VIEW IF EXISTS v_kategori_harcama_raporu CASCADE;
CREATE OR REPLACE VIEW v_urun_fiyat_gecmisi_fatura AS
SELECT 
    fku.urun_id,
    uk.kod as urun_kod,
    uk.ad as urun_ad,
    fku.tedarikci_vkn,
    fku.tedarikci_ad,
    fku.birim_fiyat,
    fku.miktar,
    fku.birim,
    fku.tutar,
    fku.fatura_tarihi,
    fku.fatura_ettn,
    fku.fatura_urun_adi as orijinal_urun_adi
FROM fatura_kalem_urunler fku
JOIN urun_kartlari uk ON uk.id = fku.urun_id
WHERE fku.urun_id IS NOT NULL
ORDER BY fku.fatura_tarihi DESC;

-- 3. VIEW: ÜRÜN MALİYET ÖZET (Son fiyat, ortalama, min, max)
CREATE OR REPLACE VIEW v_urun_maliyet_ozet AS
SELECT 
    fku.urun_id,
    uk.kod as urun_kod,
    uk.ad as urun_ad,
    uk.kategori_id,
    kat.ad as kategori_ad,
    
    -- Fiyat istatistikleri
    COUNT(*) as fatura_kalem_sayisi,
    ROUND(AVG(fku.birim_fiyat)::numeric, 4) as ortalama_fiyat,
    MIN(fku.birim_fiyat) as min_fiyat,
    MAX(fku.birim_fiyat) as max_fiyat,
    
    -- Son fiyat
    (SELECT birim_fiyat FROM fatura_kalem_urunler 
     WHERE urun_id = fku.urun_id AND birim_fiyat IS NOT NULL
     ORDER BY fatura_tarihi DESC, created_at DESC LIMIT 1) as son_fiyat,
    
    -- Son alım tarihi
    MAX(fku.fatura_tarihi) as son_alis_tarihi,
    
    -- Toplam alım
    SUM(fku.miktar) as toplam_alinan_miktar,
    SUM(fku.tutar) as toplam_harcama
    
FROM fatura_kalem_urunler fku
JOIN urun_kartlari uk ON uk.id = fku.urun_id
LEFT JOIN urun_kategorileri kat ON kat.id = uk.kategori_id
WHERE fku.urun_id IS NOT NULL
GROUP BY fku.urun_id, uk.kod, uk.ad, uk.kategori_id, kat.ad;

-- 4. VIEW: TEDARİKÇİ KARŞILAŞTIRMA (Aynı ürün farklı tedarikçiler)
CREATE OR REPLACE VIEW v_tedarikci_fiyat_karsilastirma AS
SELECT 
    fku.urun_id,
    uk.ad as urun_ad,
    fku.tedarikci_vkn,
    fku.tedarikci_ad,
    
    -- Tedarikçi bazlı istatistikler
    COUNT(*) as satin_alma_sayisi,
    ROUND(AVG(fku.birim_fiyat)::numeric, 4) as ort_birim_fiyat,
    MIN(fku.birim_fiyat) as min_fiyat,
    MAX(fku.birim_fiyat) as max_fiyat,
    
    -- Son fiyat (bu tedarikçiden)
    (SELECT birim_fiyat FROM fatura_kalem_urunler f2
     WHERE f2.urun_id = fku.urun_id AND f2.tedarikci_vkn = fku.tedarikci_vkn
     ORDER BY fatura_tarihi DESC LIMIT 1) as son_fiyat,
    
    MAX(fku.fatura_tarihi) as son_alis_tarihi,
    SUM(fku.miktar) as toplam_alinan_miktar
    
FROM fatura_kalem_urunler fku
JOIN urun_kartlari uk ON uk.id = fku.urun_id
WHERE fku.urun_id IS NOT NULL AND fku.tedarikci_vkn IS NOT NULL
GROUP BY fku.urun_id, uk.ad, fku.tedarikci_vkn, fku.tedarikci_ad;

-- 5. VIEW: FATURA EŞLEŞME DURUMU
-- Kolon adı fatura_no -> tedarikci_ad değiştiği için önce drop (42P16)
DROP VIEW IF EXISTS v_fatura_eslesme_durumu CASCADE;
CREATE OR REPLACE VIEW v_fatura_eslesme_durumu AS
SELECT 
    fku.fatura_ettn,
    fku.tedarikci_ad,
    fku.fatura_tarihi,
    COUNT(*) as toplam_kalem,
    COUNT(fku.urun_id) as eslesmis_kalem,
    COUNT(*) - COUNT(fku.urun_id) as eslesmemis_kalem,
    ROUND((COUNT(fku.urun_id)::numeric / COUNT(*)::numeric) * 100, 1) as eslesme_yuzdesi,
    SUM(fku.tutar) as fatura_toplam
FROM fatura_kalem_urunler fku
GROUP BY fku.fatura_ettn, fku.tedarikci_ad, fku.fatura_tarihi
ORDER BY fku.fatura_tarihi DESC;

-- 6. VIEW: KATEGORİ BAZLI HARCAMA RAPORU
CREATE OR REPLACE VIEW v_kategori_harcama_raporu AS
SELECT 
    uk.kategori_id,
    kat.ad as kategori_ad,
    kat.ikon,
    kat.renk,
    
    DATE_TRUNC('month', fku.fatura_tarihi) as ay,
    COUNT(DISTINCT fku.urun_id) as urun_cesidi,
    COUNT(*) as kalem_sayisi,
    SUM(fku.tutar) as toplam_harcama,
    ROUND(AVG(fku.tutar)::numeric, 2) as ort_kalem_tutari
    
FROM fatura_kalem_urunler fku
JOIN urun_kartlari uk ON uk.id = fku.urun_id
LEFT JOIN urun_kategorileri kat ON kat.id = uk.kategori_id
WHERE fku.urun_id IS NOT NULL
GROUP BY uk.kategori_id, kat.ad, kat.ikon, kat.renk, DATE_TRUNC('month', fku.fatura_tarihi)
ORDER BY ay DESC, toplam_harcama DESC;

-- 7. FONKSİYON: ÖNERİLEN ÜRÜN EŞLEŞTİRME (Basit - geçmiş bazlı)
CREATE OR REPLACE FUNCTION onerilen_urun_eslestir(
    p_fatura_urun_adi TEXT,
    p_tedarikci_vkn VARCHAR DEFAULT NULL
)
RETURNS TABLE(
    urun_id INTEGER,
    urun_kod VARCHAR,
    urun_ad VARCHAR,
    eslestirme_sayisi BIGINT,
    son_fiyat DECIMAL,
    kaynak VARCHAR
) AS $$
BEGIN
    -- 1. Önce aynı tedarikçi + aynı isim kombinasyonuna bak
    IF p_tedarikci_vkn IS NOT NULL THEN
        RETURN QUERY
        SELECT 
            fku.urun_id,
            uk.kod,
            uk.ad,
            COUNT(*) as eslestirme_sayisi,
            (SELECT birim_fiyat FROM fatura_kalem_urunler 
             WHERE urun_id = fku.urun_id ORDER BY fatura_tarihi DESC LIMIT 1),
            'tedarikci_gecmis'::VARCHAR
        FROM fatura_kalem_urunler fku
        JOIN urun_kartlari uk ON uk.id = fku.urun_id
        WHERE fku.urun_id IS NOT NULL
          AND fku.tedarikci_vkn = p_tedarikci_vkn
          AND LOWER(fku.fatura_urun_adi) = LOWER(p_fatura_urun_adi)
        GROUP BY fku.urun_id, uk.kod, uk.ad
        ORDER BY eslestirme_sayisi DESC
        LIMIT 1;
        
        IF FOUND THEN RETURN; END IF;
    END IF;
    
    -- 2. Tüm tedarikçilerden aynı isim
    RETURN QUERY
    SELECT 
        fku.urun_id,
        uk.kod,
        uk.ad,
        COUNT(*) as eslestirme_sayisi,
        (SELECT birim_fiyat FROM fatura_kalem_urunler 
         WHERE urun_id = fku.urun_id ORDER BY fatura_tarihi DESC LIMIT 1),
        'isim_eslesmesi'::VARCHAR
    FROM fatura_kalem_urunler fku
    JOIN urun_kartlari uk ON uk.id = fku.urun_id
    WHERE fku.urun_id IS NOT NULL
      AND LOWER(fku.fatura_urun_adi) = LOWER(p_fatura_urun_adi)
    GROUP BY fku.urun_id, uk.kod, uk.ad
    ORDER BY eslestirme_sayisi DESC
    LIMIT 3;
    
    IF FOUND THEN RETURN; END IF;
    
    -- 3. Benzer isim (trigram)
    RETURN QUERY
    SELECT 
        fku.urun_id,
        uk.kod,
        uk.ad,
        COUNT(*) as eslestirme_sayisi,
        (SELECT birim_fiyat FROM fatura_kalem_urunler 
         WHERE urun_id = fku.urun_id ORDER BY fatura_tarihi DESC LIMIT 1),
        'benzer_isim'::VARCHAR
    FROM fatura_kalem_urunler fku
    JOIN urun_kartlari uk ON uk.id = fku.urun_id
    WHERE fku.urun_id IS NOT NULL
      AND similarity(LOWER(fku.fatura_urun_adi), LOWER(p_fatura_urun_adi)) > 0.4
    GROUP BY fku.urun_id, uk.kod, uk.ad
    ORDER BY MAX(similarity(LOWER(fku.fatura_urun_adi), LOWER(p_fatura_urun_adi))) DESC, eslestirme_sayisi DESC
    LIMIT 3;
END;
$$ LANGUAGE plpgsql;

-- 8. FONKSİYON: FATURA KALEMLERİNİ TOPLU KAYDET
CREATE OR REPLACE FUNCTION fatura_kalemlerini_kaydet(
    p_fatura_ettn VARCHAR,
    p_kalemler JSONB,
    p_tedarikci_vkn VARCHAR,
    p_tedarikci_ad VARCHAR,
    p_fatura_tarihi DATE
)
RETURNS TABLE(eklenen INTEGER, guncellenen INTEGER) AS $$
DECLARE
    kalem JSONB;
    _eklenen INTEGER := 0;
    _guncellenen INTEGER := 0;
    _result INTEGER;
BEGIN
    FOR kalem IN SELECT * FROM jsonb_array_elements(p_kalemler)
    LOOP
        INSERT INTO fatura_kalem_urunler (
            fatura_ettn, kalem_sira, fatura_urun_adi, fatura_urun_kodu,
            miktar, birim, birim_fiyat, tutar, kdv_orani, kdv_tutari,
            tedarikci_vkn, tedarikci_ad, fatura_tarihi
        ) VALUES (
            p_fatura_ettn,
            (kalem->>'sira')::INTEGER,
            kalem->>'urun_adi',
            kalem->>'urun_kodu',
            (kalem->>'miktar')::DECIMAL,
            kalem->>'birim',
            (kalem->>'birim_fiyat')::DECIMAL,
            (kalem->>'tutar')::DECIMAL,
            (kalem->>'kdv_orani')::DECIMAL,
            (kalem->>'kdv_tutari')::DECIMAL,
            p_tedarikci_vkn,
            p_tedarikci_ad,
            p_fatura_tarihi
        )
        ON CONFLICT (fatura_ettn, kalem_sira) 
        DO UPDATE SET
            fatura_urun_adi = EXCLUDED.fatura_urun_adi,
            miktar = EXCLUDED.miktar,
            birim_fiyat = EXCLUDED.birim_fiyat,
            tutar = EXCLUDED.tutar
        RETURNING (xmax = 0)::INTEGER INTO _result;
        
        IF _result = 1 THEN
            _eklenen := _eklenen + 1;
        ELSE
            _guncellenen := _guncellenen + 1;
        END IF;
    END LOOP;
    
    eklenen := _eklenen;
    guncellenen := _guncellenen;
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- 9. TRİGGER: Eşleştirme yapıldığında ürün kartı fiyatını güncelle
CREATE OR REPLACE FUNCTION update_urun_son_fiyat_from_fatura()
RETURNS TRIGGER AS $$
BEGIN
    -- Sadece yeni eşleştirme yapıldığında
    IF NEW.urun_id IS NOT NULL AND (OLD.urun_id IS NULL OR OLD.urun_id != NEW.urun_id) THEN
        -- Ürün kartının son alış fiyatını güncelle
        UPDATE urun_kartlari 
        SET 
            son_alis_fiyati = NEW.birim_fiyat,
            son_alis_tarihi = NEW.fatura_tarihi,
            updated_at = NOW()
        WHERE id = NEW.urun_id
          AND (son_alis_tarihi IS NULL OR NEW.fatura_tarihi >= son_alis_tarihi);
        
        -- Eşleştirme tarihini kaydet
        NEW.eslestirme_tarihi := NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_urun_fiyat_on_eslesme ON fatura_kalem_urunler;
CREATE TRIGGER trg_update_urun_fiyat_on_eslesme
BEFORE UPDATE ON fatura_kalem_urunler
FOR EACH ROW EXECUTE FUNCTION update_urun_son_fiyat_from_fatura();

-- 10. COMMENT'LER
COMMENT ON TABLE fatura_kalem_urunler IS 'Fatura kalemleri ile ürün kartları arasındaki direkt eşleştirme. Her fatura kalemi bir ürüne bağlanır.';
COMMENT ON VIEW v_urun_fiyat_gecmisi_fatura IS 'Faturalardan otomatik oluşan ürün fiyat geçmişi';
COMMENT ON VIEW v_urun_maliyet_ozet IS 'Ürün bazlı maliyet özeti (son fiyat, ortalama, min, max)';
COMMENT ON VIEW v_tedarikci_fiyat_karsilastirma IS 'Aynı ürün için farklı tedarikçi fiyat karşılaştırması';
COMMENT ON VIEW v_fatura_eslesme_durumu IS 'Faturaların kalem eşleştirme durumu özeti';
COMMENT ON FUNCTION onerilen_urun_eslestir IS 'Fatura ürün adına göre önerilen ürün kartlarını döndürür (geçmiş bazlı)';

-- 11. GRANT'LAR (varsa role'lere)
-- GRANT SELECT ON v_urun_fiyat_gecmisi_fatura TO authenticated;
-- GRANT SELECT ON v_urun_maliyet_ozet TO authenticated;
-- GRANT SELECT ON v_tedarikci_fiyat_karsilastirma TO authenticated;
