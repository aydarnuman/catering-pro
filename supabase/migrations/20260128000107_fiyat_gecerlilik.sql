-- =============================================
-- FİYAT GEÇERLİLİK SİSTEMİ
-- Eski fiyatları tespit ve raporlama
-- =============================================

-- Fiyat geçerlilik süresi ayarı (varsayılan 90 gün)
ALTER TABLE recete_malzemeler 
ADD COLUMN IF NOT EXISTS fiyat_gecerlilik_gun INTEGER DEFAULT 90;

-- Fiyat kaynağı (hangi fiyat kullanılıyor)
ALTER TABLE recete_malzemeler 
ADD COLUMN IF NOT EXISTS aktif_fiyat_kaynagi VARCHAR(20) DEFAULT 'auto';
-- Değerler: 'auto', 'fatura', 'piyasa', 'manuel'

-- Son maliyet hesaplama tarihi
ALTER TABLE recete_malzemeler 
ADD COLUMN IF NOT EXISTS son_maliyet_hesaplama TIMESTAMP;

-- Hesaplanan maliyetler (cache)
ALTER TABLE recete_malzemeler 
ADD COLUMN IF NOT EXISTS hesaplanan_fatura_maliyet DECIMAL(15,4);

ALTER TABLE recete_malzemeler 
ADD COLUMN IF NOT EXISTS hesaplanan_piyasa_maliyet DECIMAL(15,4);

-- Eski fiyatlı malzemeleri bulan VIEW
CREATE OR REPLACE VIEW v_eski_fiyatli_malzemeler AS
SELECT 
    rm.id,
    rm.recete_id,
    r.ad as recete_adi,
    rm.malzeme_adi,
    rm.stok_kart_id,
    sk.ad as stok_adi,
    rm.miktar,
    rm.birim,
    
    -- Fatura fiyat durumu
    rm.fatura_fiyat,
    rm.fatura_fiyat_tarihi,
    CASE 
        WHEN rm.fatura_fiyat IS NULL THEN 'yok'
        WHEN rm.fatura_fiyat_tarihi IS NULL THEN 'tarih_yok'
        WHEN rm.fatura_fiyat_tarihi < NOW() - INTERVAL '90 days' THEN 'eski'
        ELSE 'guncel'
    END as fatura_durum,
    CASE 
        WHEN rm.fatura_fiyat_tarihi IS NOT NULL 
        THEN EXTRACT(DAY FROM NOW() - rm.fatura_fiyat_tarihi)::INTEGER 
        ELSE NULL 
    END as fatura_gun,
    
    -- Piyasa fiyat durumu
    rm.piyasa_fiyat,
    rm.piyasa_fiyat_tarihi,
    CASE 
        WHEN rm.piyasa_fiyat IS NULL THEN 'yok'
        WHEN rm.piyasa_fiyat_tarihi IS NULL THEN 'tarih_yok'
        WHEN rm.piyasa_fiyat_tarihi < NOW() - INTERVAL '90 days' THEN 'eski'
        ELSE 'guncel'
    END as piyasa_durum,
    CASE 
        WHEN rm.piyasa_fiyat_tarihi IS NOT NULL 
        THEN EXTRACT(DAY FROM NOW() - rm.piyasa_fiyat_tarihi)::INTEGER 
        ELSE NULL 
    END as piyasa_gun,
    
    -- Genel durum
    CASE 
        WHEN rm.fatura_fiyat IS NULL AND rm.piyasa_fiyat IS NULL THEN 'kritik'
        WHEN (rm.fatura_fiyat_tarihi IS NOT NULL AND rm.fatura_fiyat_tarihi < NOW() - INTERVAL '90 days')
             AND (rm.piyasa_fiyat_tarihi IS NOT NULL AND rm.piyasa_fiyat_tarihi < NOW() - INTERVAL '90 days') THEN 'eski'
        WHEN (rm.fatura_fiyat_tarihi IS NOT NULL AND rm.fatura_fiyat_tarihi < NOW() - INTERVAL '90 days')
             AND (rm.piyasa_fiyat IS NULL OR rm.piyasa_fiyat_tarihi IS NULL) THEN 'eski'
        WHEN (rm.piyasa_fiyat_tarihi IS NOT NULL AND rm.piyasa_fiyat_tarihi < NOW() - INTERVAL '90 days')
             AND (rm.fatura_fiyat IS NULL OR rm.fatura_fiyat_tarihi IS NULL) THEN 'eski'
        WHEN rm.fatura_fiyat IS NULL OR rm.piyasa_fiyat IS NULL THEN 'eksik'
        ELSE 'tamam'
    END as genel_durum

FROM recete_malzemeler rm
JOIN receteler r ON r.id = rm.recete_id
LEFT JOIN stok_kartlari sk ON sk.id = rm.stok_kart_id
WHERE r.aktif = true;

-- Reçete bazlı fiyat durumu özeti
CREATE OR REPLACE VIEW v_recete_fiyat_durumu AS
SELECT 
    r.id as recete_id,
    r.kod,
    r.ad,
    r.kategori_id,
    rk.ad as kategori_adi,
    
    COUNT(rm.id) as malzeme_sayisi,
    COUNT(CASE WHEN rm.fatura_fiyat IS NOT NULL THEN 1 END) as fatura_fiyatli,
    COUNT(CASE WHEN rm.piyasa_fiyat IS NOT NULL THEN 1 END) as piyasa_fiyatli,
    COUNT(CASE WHEN rm.fatura_fiyat IS NULL AND rm.piyasa_fiyat IS NULL THEN 1 END) as fiyatsiz,
    
    COUNT(CASE WHEN rm.fatura_fiyat_tarihi < NOW() - INTERVAL '90 days' THEN 1 END) as eski_fatura,
    COUNT(CASE WHEN rm.piyasa_fiyat_tarihi < NOW() - INTERVAL '90 days' THEN 1 END) as eski_piyasa,
    
    -- Toplam maliyetler
    COALESCE(SUM(rm.hesaplanan_fatura_maliyet), 0) as toplam_fatura_maliyet,
    COALESCE(SUM(rm.hesaplanan_piyasa_maliyet), 0) as toplam_piyasa_maliyet,
    
    -- Genel sağlık skoru (0-100)
    ROUND(
        (COUNT(CASE WHEN rm.fatura_fiyat IS NOT NULL 
                    AND rm.fatura_fiyat_tarihi > NOW() - INTERVAL '90 days' THEN 1 END)::DECIMAL 
         / NULLIF(COUNT(rm.id), 0) * 100)
    , 0) as fiyat_saglik_skoru
    
FROM receteler r
LEFT JOIN recete_kategoriler rk ON rk.id = r.kategori_id
LEFT JOIN recete_malzemeler rm ON rm.recete_id = r.id
WHERE r.aktif = true
GROUP BY r.id, r.kod, r.ad, r.kategori_id, rk.ad;

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_rm_fatura_tarih ON recete_malzemeler(fatura_fiyat_tarihi);
CREATE INDEX IF NOT EXISTS idx_rm_piyasa_tarih ON recete_malzemeler(piyasa_fiyat_tarihi);

-- Yorumlar
COMMENT ON COLUMN recete_malzemeler.fiyat_gecerlilik_gun IS 'Fiyat geçerlilik süresi (gün) - varsayılan 90';
COMMENT ON COLUMN recete_malzemeler.aktif_fiyat_kaynagi IS 'Hangi fiyat kaynağı kullanılıyor: auto, fatura, piyasa, manuel';
COMMENT ON COLUMN recete_malzemeler.son_maliyet_hesaplama IS 'Son maliyet hesaplama zamanı';
COMMENT ON COLUMN recete_malzemeler.hesaplanan_fatura_maliyet IS 'Cache: Hesaplanan fatura bazlı maliyet';
COMMENT ON COLUMN recete_malzemeler.hesaplanan_piyasa_maliyet IS 'Cache: Hesaplanan piyasa bazlı maliyet';
COMMENT ON VIEW v_eski_fiyatli_malzemeler IS 'Fiyatı eski veya eksik malzemeleri listeler';
COMMENT ON VIEW v_recete_fiyat_durumu IS 'Reçete bazlı fiyat sağlık durumu özeti';
