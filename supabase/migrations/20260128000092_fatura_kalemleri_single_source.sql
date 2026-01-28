-- =====================================================
-- SINGLE SOURCE OF TRUTH: fatura_kalemleri
-- =====================================================
-- 091'deki fatura_kalem_urunler tablosunu fatura_kalemleri olarak yeniden adlandırır.
-- Kolon adları: fatura_urun_adi → orijinal_urun_adi, fatura_urun_kodu → orijinal_urun_kodu
-- Menü maliyet için v_urun_guncel_fiyat view'ı eklenir.
-- =====================================================

-- 1. Tablo ve kolon yeniden adlandırma (fatura_kalem_urunler varsa VE fatura_kalemleri yoksa)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fatura_kalem_urunler')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fatura_kalemleri') THEN
    ALTER TABLE fatura_kalem_urunler RENAME TO fatura_kalemleri;
    ALTER TABLE fatura_kalemleri RENAME COLUMN fatura_urun_adi TO orijinal_urun_adi;
    ALTER TABLE fatura_kalemleri RENAME COLUMN fatura_urun_kodu TO orijinal_urun_kodu;
    
    -- İndeksleri güncelle (isimler eski tabloya referans veriyorsa yeniden oluştur)
    DROP INDEX IF EXISTS idx_fku_urun;
    DROP INDEX IF EXISTS idx_fku_ettn;
    DROP INDEX IF EXISTS idx_fku_tarih;
    DROP INDEX IF EXISTS idx_fku_tedarikci;
    DROP INDEX IF EXISTS idx_fku_eslesme;
    DROP INDEX IF EXISTS idx_fku_eslesmemis;
    DROP INDEX IF EXISTS idx_fku_urun_adi_trgm;
    
    CREATE INDEX IF NOT EXISTS idx_fk_urun ON fatura_kalemleri(urun_id);
    CREATE INDEX IF NOT EXISTS idx_fk_ettn ON fatura_kalemleri(fatura_ettn);
    CREATE INDEX IF NOT EXISTS idx_fk_tarih ON fatura_kalemleri(fatura_tarihi DESC);
    CREATE INDEX IF NOT EXISTS idx_fk_tedarikci ON fatura_kalemleri(tedarikci_vkn);
    CREATE INDEX IF NOT EXISTS idx_fk_eslesme ON fatura_kalemleri(urun_id) WHERE urun_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_fk_eslesmemis ON fatura_kalemleri(fatura_ettn) WHERE urun_id IS NULL;
    
    -- Trigram (extension varsa)
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
      CREATE INDEX IF NOT EXISTS idx_fk_urun_adi_trgm ON fatura_kalemleri USING gin (orijinal_urun_adi gin_trgm_ops);
    END IF;
    
    -- Trigger'ı yeni tabloya taşı
    DROP TRIGGER IF EXISTS trg_update_urun_fiyat_on_eslesme ON fatura_kalemleri;
    CREATE TRIGGER trg_update_urun_fiyat_on_eslesme
    BEFORE UPDATE ON fatura_kalemleri
    FOR EACH ROW EXECUTE FUNCTION update_urun_son_fiyat_from_fatura();
  END IF;
END $$;

-- 2. View'ları fatura_kalemleri + orijinal_urun_adi ile güncelle
-- Kolon sayısı/adi değiştiği için önce drop (42P16)
DROP VIEW IF EXISTS v_urun_fiyat_gecmisi_fatura CASCADE;
DROP VIEW IF EXISTS v_urun_maliyet_ozet CASCADE;
DROP VIEW IF EXISTS v_tedarikci_fiyat_karsilastirma CASCADE;
DROP VIEW IF EXISTS v_fatura_eslesme_durumu CASCADE;
DROP VIEW IF EXISTS v_kategori_harcama_raporu CASCADE;
DROP VIEW IF EXISTS v_urun_guncel_fiyat CASCADE;
CREATE OR REPLACE VIEW v_urun_fiyat_gecmisi_fatura AS
SELECT 
    fk.urun_id,
    uk.kod as urun_kod,
    uk.ad as urun_ad,
    fk.tedarikci_vkn,
    fk.tedarikci_ad,
    fk.birim_fiyat,
    fk.miktar,
    fk.birim,
    fk.tutar,
    fk.fatura_tarihi,
    fk.fatura_ettn,
    fk.orijinal_urun_adi
FROM fatura_kalemleri fk
JOIN urun_kartlari uk ON uk.id = fk.urun_id
WHERE fk.urun_id IS NOT NULL
ORDER BY fk.fatura_tarihi DESC;

CREATE OR REPLACE VIEW v_urun_maliyet_ozet AS
SELECT 
    fk.urun_id,
    uk.kod as urun_kod,
    uk.ad as urun_ad,
    uk.kategori_id,
    kat.ad as kategori_ad,
    COUNT(*) as fatura_kalem_sayisi,
    ROUND(AVG(fk.birim_fiyat)::numeric, 4) as ortalama_fiyat,
    MIN(fk.birim_fiyat) as min_fiyat,
    MAX(fk.birim_fiyat) as max_fiyat,
    (SELECT birim_fiyat FROM fatura_kalemleri 
     WHERE urun_id = fk.urun_id AND birim_fiyat IS NOT NULL
     ORDER BY fatura_tarihi DESC, created_at DESC LIMIT 1) as son_fiyat,
    MAX(fk.fatura_tarihi) as son_alis_tarihi,
    SUM(fk.miktar) as toplam_alinan_miktar,
    SUM(fk.tutar) as toplam_harcama
FROM fatura_kalemleri fk
JOIN urun_kartlari uk ON uk.id = fk.urun_id
LEFT JOIN urun_kategorileri kat ON kat.id = uk.kategori_id
WHERE fk.urun_id IS NOT NULL
GROUP BY fk.urun_id, uk.kod, uk.ad, uk.kategori_id, kat.ad;

CREATE OR REPLACE VIEW v_tedarikci_fiyat_karsilastirma AS
SELECT 
    fk.urun_id,
    uk.ad as urun_ad,
    fk.tedarikci_vkn,
    fk.tedarikci_ad,
    COUNT(*) as satin_alma_sayisi,
    ROUND(AVG(fk.birim_fiyat)::numeric, 4) as ort_birim_fiyat,
    MIN(fk.birim_fiyat) as min_fiyat,
    MAX(fk.birim_fiyat) as max_fiyat,
    (SELECT birim_fiyat FROM fatura_kalemleri f2
     WHERE f2.urun_id = fk.urun_id AND f2.tedarikci_vkn = fk.tedarikci_vkn
     ORDER BY fatura_tarihi DESC LIMIT 1) as son_fiyat,
    MAX(fk.fatura_tarihi) as son_alis_tarihi,
    SUM(fk.miktar) as toplam_alinan_miktar
FROM fatura_kalemleri fk
JOIN urun_kartlari uk ON uk.id = fk.urun_id
WHERE fk.urun_id IS NOT NULL AND fk.tedarikci_vkn IS NOT NULL
GROUP BY fk.urun_id, uk.ad, fk.tedarikci_vkn, fk.tedarikci_ad;

CREATE OR REPLACE VIEW v_fatura_eslesme_durumu AS
SELECT 
    fk.fatura_ettn,
    fk.tedarikci_ad,
    fk.fatura_tarihi,
    COUNT(*) as toplam_kalem,
    COUNT(fk.urun_id) as eslesmis_kalem,
    COUNT(*) - COUNT(fk.urun_id) as eslesmemis_kalem,
    ROUND((COUNT(fk.urun_id)::numeric / NULLIF(COUNT(*), 0)::numeric) * 100, 1) as eslesme_yuzdesi,
    SUM(fk.tutar) as fatura_toplam
FROM fatura_kalemleri fk
GROUP BY fk.fatura_ettn, fk.tedarikci_ad, fk.fatura_tarihi
ORDER BY fk.fatura_tarihi DESC;

CREATE OR REPLACE VIEW v_kategori_harcama_raporu AS
SELECT 
    uk.kategori_id,
    kat.ad as kategori_ad,
    kat.ikon,
    kat.renk,
    DATE_TRUNC('month', fk.fatura_tarihi) as ay,
    COUNT(DISTINCT fk.urun_id) as urun_cesidi,
    COUNT(*) as kalem_sayisi,
    SUM(fk.tutar) as toplam_harcama,
    ROUND(AVG(fk.tutar)::numeric, 2) as ort_kalem_tutari
FROM fatura_kalemleri fk
JOIN urun_kartlari uk ON uk.id = fk.urun_id
LEFT JOIN urun_kategorileri kat ON kat.id = uk.kategori_id
WHERE fk.urun_id IS NOT NULL
GROUP BY uk.kategori_id, kat.ad, kat.ikon, kat.renk, DATE_TRUNC('month', fk.fatura_tarihi)
ORDER BY ay DESC, toplam_harcama DESC;

-- 3. Menü maliyet için tek kaynak view
CREATE OR REPLACE VIEW v_urun_guncel_fiyat AS
SELECT 
    uk.id,
    uk.kod,
    uk.ad,
    uk.kategori_id,
    (SELECT birim_fiyat 
     FROM fatura_kalemleri 
     WHERE urun_id = uk.id AND birim_fiyat IS NOT NULL 
     ORDER BY fatura_tarihi DESC 
     LIMIT 1) as son_fiyat,
    (SELECT ROUND(AVG(birim_fiyat)::numeric, 4) 
     FROM fatura_kalemleri 
     WHERE urun_id = uk.id) as ortalama_fiyat
FROM urun_kartlari uk;

-- 4. Öneri fonksiyonunu orijinal_urun_adi ile güncelle
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
  IF p_tedarikci_vkn IS NOT NULL THEN
    RETURN QUERY
    SELECT 
        fk.urun_id,
        uk.kod,
        uk.ad,
        COUNT(*)::BIGINT,
        (SELECT birim_fiyat FROM fatura_kalemleri 
         WHERE urun_id = fk.urun_id ORDER BY fatura_tarihi DESC LIMIT 1),
        'tedarikci_gecmis'::VARCHAR
    FROM fatura_kalemleri fk
    JOIN urun_kartlari uk ON uk.id = fk.urun_id
    WHERE fk.urun_id IS NOT NULL
      AND fk.tedarikci_vkn = p_tedarikci_vkn
      AND LOWER(fk.orijinal_urun_adi) = LOWER(p_fatura_urun_adi)
    GROUP BY fk.urun_id, uk.kod, uk.ad
    ORDER BY COUNT(*) DESC
    LIMIT 1;
    IF FOUND THEN RETURN; END IF;
  END IF;
  
  RETURN QUERY
  SELECT 
      fk.urun_id,
      uk.kod,
      uk.ad,
      COUNT(*)::BIGINT,
      (SELECT birim_fiyat FROM fatura_kalemleri 
       WHERE urun_id = fk.urun_id ORDER BY fatura_tarihi DESC LIMIT 1),
      'isim_eslesmesi'::VARCHAR
  FROM fatura_kalemleri fk
  JOIN urun_kartlari uk ON uk.id = fk.urun_id
  WHERE fk.urun_id IS NOT NULL
    AND LOWER(fk.orijinal_urun_adi) = LOWER(p_fatura_urun_adi)
  GROUP BY fk.urun_id, uk.kod, uk.ad
  ORDER BY COUNT(*) DESC
  LIMIT 3;
  IF FOUND THEN RETURN; END IF;
  
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
    RETURN QUERY
    SELECT 
        fk.urun_id,
        uk.kod,
        uk.ad,
        COUNT(*)::BIGINT,
        (SELECT birim_fiyat FROM fatura_kalemleri 
         WHERE urun_id = fk.urun_id ORDER BY fatura_tarihi DESC LIMIT 1),
        'benzer_isim'::VARCHAR
    FROM fatura_kalemleri fk
    JOIN urun_kartlari uk ON uk.id = fk.urun_id
    WHERE fk.urun_id IS NOT NULL
      AND similarity(LOWER(fk.orijinal_urun_adi), LOWER(p_fatura_urun_adi)) > 0.4
    GROUP BY fk.urun_id, uk.kod, uk.ad
    ORDER BY MAX(similarity(LOWER(fk.orijinal_urun_adi), LOWER(p_fatura_urun_adi))) DESC, COUNT(*) DESC
    LIMIT 3;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 5. Toplu kaydet fonksiyonunu fatura_kalemleri + orijinal_* ile güncelle
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
BEGIN
  FOR kalem IN SELECT * FROM jsonb_array_elements(p_kalemler)
  LOOP
    INSERT INTO fatura_kalemleri (
        fatura_ettn, kalem_sira, orijinal_urun_adi, orijinal_urun_kodu,
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
        orijinal_urun_adi = EXCLUDED.orijinal_urun_adi,
        miktar = EXCLUDED.miktar,
        birim_fiyat = EXCLUDED.birim_fiyat,
        tutar = EXCLUDED.tutar;
  END LOOP;
  eklenen := _eklenen;
  guncellenen := _guncellenen;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

COMMENT ON VIEW v_urun_guncel_fiyat IS 'Menü maliyet için tek kaynak: ürün kartı + son/ortalama fiyat (fatura_kalemleri)';
