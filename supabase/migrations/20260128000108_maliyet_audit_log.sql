-- =============================================
-- MALİYET DEĞİŞİKLİK KAYITLARI (AUDIT LOG)
-- =============================================

CREATE TABLE IF NOT EXISTS maliyet_audit_log (
    id SERIAL PRIMARY KEY,
    
    -- Kaynak bilgisi
    recete_id INTEGER REFERENCES receteler(id) ON DELETE SET NULL,
    sablon_id INTEGER REFERENCES maliyet_menu_sablonlari(id) ON DELETE SET NULL,
    
    -- Önceki değerler
    onceki_fatura_maliyet DECIMAL(15,2),
    onceki_piyasa_maliyet DECIMAL(15,2),
    
    -- Yeni değerler
    yeni_fatura_maliyet DECIMAL(15,2),
    yeni_piyasa_maliyet DECIMAL(15,2),
    
    -- Değişim bilgisi
    fatura_degisim DECIMAL(15,2),
    piyasa_degisim DECIMAL(15,2),
    fatura_degisim_yuzde DECIMAL(5,2),
    piyasa_degisim_yuzde DECIMAL(5,2),
    
    -- Sebep
    sebep VARCHAR(50) NOT NULL,  
    -- 'fiyat_guncelleme', 'malzeme_ekleme', 'malzeme_silme', 
    -- 'birim_duzeltme', 'manuel_duzeltme', 'toplu_guncelleme'
    
    aciklama TEXT,
    
    -- Kim yaptı
    kullanici_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_audit_recete ON maliyet_audit_log(recete_id);
CREATE INDEX IF NOT EXISTS idx_audit_sablon ON maliyet_audit_log(sablon_id);
CREATE INDEX IF NOT EXISTS idx_audit_tarih ON maliyet_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_sebep ON maliyet_audit_log(sebep);

-- Son 30 günlük değişimleri gösteren view
CREATE OR REPLACE VIEW v_maliyet_degisim_ozet AS
SELECT 
    DATE(created_at) as tarih,
    COUNT(*) as degisim_sayisi,
    COUNT(DISTINCT recete_id) as etkilenen_recete,
    AVG(ABS(fatura_degisim_yuzde)) as ort_fatura_degisim,
    AVG(ABS(piyasa_degisim_yuzde)) as ort_piyasa_degisim,
    SUM(CASE WHEN fatura_degisim > 0 THEN 1 ELSE 0 END) as artan,
    SUM(CASE WHEN fatura_degisim < 0 THEN 1 ELSE 0 END) as azalan
FROM maliyet_audit_log
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY tarih DESC;

-- Yorumlar
COMMENT ON TABLE maliyet_audit_log IS 'Maliyet değişiklik geçmişi - %5+ değişimleri kaydeder';
COMMENT ON VIEW v_maliyet_degisim_ozet IS 'Son 30 günlük maliyet değişim özeti';
