-- =====================================================
-- 116: EŞLEŞTİRME KUYRUK SİSTEMİ
-- Manuel onay bekleyen eşleştirmeler için
-- =====================================================

-- Kuyruk tablosu
CREATE TABLE IF NOT EXISTS eslestirme_kuyrugu (
    id SERIAL PRIMARY KEY,
    
    -- Kaynak bilgisi
    kaynak_tip VARCHAR(20) NOT NULL DEFAULT 'fatura',  -- 'fatura', 'piyasa', 'recete'
    kaynak_id INTEGER,
    
    -- Eşleştirilecek veri
    orijinal_ad VARCHAR(500) NOT NULL,
    orijinal_kod VARCHAR(100),
    tedarikci_vkn VARCHAR(20),
    tedarikci_ad VARCHAR(200),
    birim VARCHAR(20),
    fiyat DECIMAL(15,4),
    
    -- Öneri (AI/Fuzzy sonucu)
    onerilen_urun_id INTEGER REFERENCES urun_kartlari(id),
    onerilen_guven INTEGER,
    oneri_yontemi VARCHAR(20),  -- 'fuzzy', 'ai', 'mapping'
    
    -- Durum
    durum VARCHAR(20) DEFAULT 'bekliyor',  -- bekliyor, onaylandi, reddedildi, yeni_urun
    isleyen_kullanici INTEGER,
    islem_tarihi TIMESTAMP,
    
    -- Meta
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Tekrar eklemeyi engelle
    CONSTRAINT uq_kuyruk_kaynak UNIQUE(kaynak_tip, kaynak_id)
);

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_eslestirme_kuyrugu_durum ON eslestirme_kuyrugu(durum);
CREATE INDEX IF NOT EXISTS idx_eslestirme_kuyrugu_tedarikci ON eslestirme_kuyrugu(tedarikci_vkn);
CREATE INDEX IF NOT EXISTS idx_eslestirme_kuyrugu_tarih ON eslestirme_kuyrugu(created_at DESC);

-- Yorum
COMMENT ON TABLE eslestirme_kuyrugu IS 'Manuel onay bekleyen eşleştirme talepleri. AI/Fuzzy düşük güvenle eşleştirme önerdiğinde buraya düşer.';

-- =====================================================
-- Kuyruk özet view'ı
-- =====================================================
CREATE OR REPLACE VIEW v_eslestirme_kuyrugu_ozet AS
SELECT
    durum,
    COUNT(*) as sayi,
    COUNT(DISTINCT tedarikci_vkn) as tedarikci_sayisi
FROM eslestirme_kuyrugu
GROUP BY durum;

-- =====================================================
-- Tedarikçi bazlı kuyruk view'ı
-- =====================================================
CREATE OR REPLACE VIEW v_eslestirme_kuyrugu_tedarikci AS
SELECT
    tedarikci_vkn,
    tedarikci_ad,
    COUNT(*) as bekleyen_sayi,
    MIN(created_at) as ilk_tarih,
    MAX(created_at) as son_tarih
FROM eslestirme_kuyrugu
WHERE durum = 'bekliyor'
GROUP BY tedarikci_vkn, tedarikci_ad
ORDER BY bekleyen_sayi DESC;

-- =====================================================
-- Güncellenmiş eşleştirme istatistikleri view'ı
-- =====================================================
CREATE OR REPLACE VIEW v_eslestirme_istatistik AS
SELECT
    -- Genel sayılar
    (SELECT COUNT(*) FROM fatura_kalemleri) as toplam_kalem,
    (SELECT COUNT(*) FROM fatura_kalemleri WHERE urun_id IS NOT NULL) as eslesen_kalem,
    (SELECT COUNT(*) FROM fatura_kalemleri WHERE urun_id IS NULL) as eslesmemis_kalem,
    
    -- Kuyruk
    (SELECT COUNT(*) FROM eslestirme_kuyrugu WHERE durum = 'bekliyor') as kuyruk_bekleyen,
    (SELECT COUNT(*) FROM eslestirme_kuyrugu WHERE durum = 'onaylandi') as kuyruk_onaylanan,
    
    -- Mapping
    (SELECT COUNT(*) FROM tedarikci_urun_mapping WHERE aktif = true) as aktif_mapping,
    
    -- Yüzdeler
    CASE 
        WHEN (SELECT COUNT(*) FROM fatura_kalemleri) > 0 
        THEN ROUND((SELECT COUNT(*) FROM fatura_kalemleri WHERE urun_id IS NOT NULL)::numeric / 
                   (SELECT COUNT(*) FROM fatura_kalemleri)::numeric * 100, 1)
        ELSE 0 
    END as eslesme_yuzdesi;
