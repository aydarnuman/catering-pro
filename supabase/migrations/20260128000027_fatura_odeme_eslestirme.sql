-- ====================================================
-- FATURA-ÖDEME EŞLEŞTİRME SİSTEMİ
-- Migration 027
-- ====================================================

-- ====================================================
-- 1. FATURA ÖDEMELERİ TABLOSU
-- Her ödeme hangi faturayı kapatıyor?
-- ====================================================
CREATE TABLE IF NOT EXISTS fatura_odemeleri (
    id SERIAL PRIMARY KEY,
    
    -- Fatura bilgisi
    fatura_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    
    -- Ödeme kaynağı (birinden biri dolu olmalı)
    hareket_id INTEGER REFERENCES kasa_banka_hareketleri(id) ON DELETE SET NULL,
    cek_senet_id INTEGER REFERENCES cek_senetler(id) ON DELETE SET NULL,
    
    -- Tutar ve tarih
    tutar DECIMAL(15,2) NOT NULL,
    tarih DATE NOT NULL DEFAULT CURRENT_DATE,
    
    -- Açıklama
    aciklama TEXT,
    belge_no VARCHAR(50),
    
    -- Otomatik mı manual mı eşleştirildi
    otomatik_eslesme BOOLEAN DEFAULT FALSE,
    
    -- Metadata
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_fatura_odeme_fatura ON fatura_odemeleri(fatura_id);
CREATE INDEX idx_fatura_odeme_hareket ON fatura_odemeleri(hareket_id);
CREATE INDEX idx_fatura_odeme_cek_senet ON fatura_odemeleri(cek_senet_id);
CREATE INDEX idx_fatura_odeme_tarih ON fatura_odemeleri(tarih);

-- ====================================================
-- 2. CARİ HAREKET GEÇMİŞİ GÖRÜNÜMÜ
-- Tüm hareketleri tek bir görünümde birleştir
-- ====================================================
CREATE OR REPLACE VIEW cari_hareketler AS
-- Faturalar (Satış = Alacak, Alış = Borç)
SELECT 
    'fatura' as kaynak_tip,
    i.id as kaynak_id,
    i.invoice_number as belge_no,
    i.date as tarih,
    c.id as cari_id,
    c.unvan as cari_unvan,
    CASE WHEN i.type = 'satis' THEN i.total_amount ELSE 0 END as borc,
    CASE WHEN i.type = 'alis' THEN i.total_amount ELSE 0 END as alacak,
    'Fatura: ' || i.invoice_number || ' - ' || COALESCE(i.description, '') as aciklama,
    i.created_at
FROM invoices i
JOIN cariler c ON c.unvan = i.customer_name OR c.id = i.cari_id

UNION ALL

-- Kasa/Banka Hareketleri (Tahsilat = Alacak düşer, Ödeme = Borç düşer)
SELECT 
    'hareket' as kaynak_tip,
    h.id as kaynak_id,
    h.belge_no,
    h.tarih,
    c.id as cari_id,
    c.unvan as cari_unvan,
    CASE WHEN h.hareket_tipi = 'cikis' THEN h.tutar ELSE 0 END as borc,  -- Ödeme yaptık
    CASE WHEN h.hareket_tipi = 'giris' THEN h.tutar ELSE 0 END as alacak, -- Tahsilat aldık
    h.aciklama,
    h.created_at
FROM kasa_banka_hareketleri h
JOIN cariler c ON c.id = h.cari_id
WHERE h.cari_id IS NOT NULL

UNION ALL

-- Çek/Senetler (Tahsil edilenler)
SELECT 
    'cek_senet' as kaynak_tip,
    cs.id as kaynak_id,
    cs.belge_no,
    COALESCE(cs.islem_tarihi, cs.vade_tarihi) as tarih,
    c.id as cari_id,
    c.unvan as cari_unvan,
    CASE WHEN cs.yonu = 'verilen' AND cs.durum = 'odendi' THEN cs.tutar ELSE 0 END as borc,
    CASE WHEN cs.yonu = 'alinan' AND cs.durum = 'tahsil_edildi' THEN cs.tutar ELSE 0 END as alacak,
    cs.tip || ' ' || CASE WHEN cs.yonu = 'alinan' THEN 'tahsilatı' ELSE 'ödemesi' END || ': ' || cs.belge_no as aciklama,
    cs.created_at
FROM cek_senetler cs
JOIN cariler c ON c.id = cs.cari_id
WHERE cs.cari_id IS NOT NULL AND cs.durum IN ('tahsil_edildi', 'odendi')

ORDER BY tarih DESC, created_at DESC;

-- ====================================================
-- 3. FATURA ÖDEME DURUMU GÖRÜNÜMÜ
-- ====================================================
CREATE OR REPLACE VIEW fatura_odeme_durumu AS
SELECT 
    i.id as fatura_id,
    i.invoice_number,
    i.date as fatura_tarihi,
    i.due_date as vade_tarihi,
    i.customer_name,
    i.type as fatura_tipi,
    i.total_amount as fatura_tutari,
    COALESCE(SUM(fo.tutar), 0) as odenen_tutar,
    i.total_amount - COALESCE(SUM(fo.tutar), 0) as kalan_tutar,
    CASE 
        WHEN i.total_amount - COALESCE(SUM(fo.tutar), 0) <= 0 THEN 'kapali'
        WHEN COALESCE(SUM(fo.tutar), 0) > 0 THEN 'kismi'
        ELSE 'acik'
    END as odeme_durumu,
    COUNT(fo.id) as odeme_sayisi,
    MAX(fo.tarih) as son_odeme_tarihi
FROM invoices i
LEFT JOIN fatura_odemeleri fo ON fo.fatura_id = i.id
GROUP BY i.id, i.invoice_number, i.date, i.due_date, i.customer_name, i.type, i.total_amount;

-- ====================================================
-- 4. CARİ MUTABAKAT ÖZET FONKSİYONU
-- ====================================================
CREATE OR REPLACE FUNCTION cari_mutabakat_ozet(
    p_cari_id INTEGER,
    p_baslangic_tarihi DATE,
    p_bitis_tarihi DATE
)
RETURNS TABLE (
    acilis_bakiyesi DECIMAL(15,2),
    donem_borc DECIMAL(15,2),
    donem_alacak DECIMAL(15,2),
    kapanis_bakiyesi DECIMAL(15,2),
    fatura_sayisi INTEGER,
    odeme_sayisi INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH 
    -- Dönem öncesi bakiye (açılış)
    onceki AS (
        SELECT 
            COALESCE(SUM(borc), 0) - COALESCE(SUM(alacak), 0) as bakiye
        FROM cari_hareketler
        WHERE cari_id = p_cari_id
        AND tarih < p_baslangic_tarihi
    ),
    -- Dönem içi hareketler
    donem AS (
        SELECT 
            COALESCE(SUM(borc), 0) as toplam_borc,
            COALESCE(SUM(alacak), 0) as toplam_alacak,
            COUNT(CASE WHEN kaynak_tip = 'fatura' THEN 1 END) as fatura_adet,
            COUNT(CASE WHEN kaynak_tip IN ('hareket', 'cek_senet') THEN 1 END) as odeme_adet
        FROM cari_hareketler
        WHERE cari_id = p_cari_id
        AND tarih BETWEEN p_baslangic_tarihi AND p_bitis_tarihi
    )
    SELECT 
        onceki.bakiye,
        donem.toplam_borc,
        donem.toplam_alacak,
        onceki.bakiye + donem.toplam_borc - donem.toplam_alacak,
        donem.fatura_adet::INTEGER,
        donem.odeme_adet::INTEGER
    FROM onceki, donem;
END;
$$ LANGUAGE plpgsql;

-- ====================================================
-- 5. INVOICES TABLOSUNA CARİ_ID KOLONU EKLEYELİM
-- (Eğer yoksa)
-- ====================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoices' AND column_name = 'cari_id'
    ) THEN
        ALTER TABLE invoices ADD COLUMN cari_id INTEGER REFERENCES cariler(id) ON DELETE SET NULL;
        CREATE INDEX idx_invoices_cari ON invoices(cari_id);
    END IF;
END $$;

-- ====================================================
-- Migration tamamlandı!
-- ====================================================

