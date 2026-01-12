-- ====================================================
-- BORDRO PROJE DESTEĞİ
-- Migration - 028
-- ====================================================

-- ====================================================
-- 1. BORDRO TABLOSUNA PROJE_ID EKLE
-- ====================================================

-- Proje referansı ekle
ALTER TABLE bordro_kayitlari 
ADD COLUMN IF NOT EXISTS proje_id INTEGER REFERENCES projeler(id) ON DELETE SET NULL;

-- Kaynak bilgisi (import için)
ALTER TABLE bordro_kayitlari 
ADD COLUMN IF NOT EXISTS kaynak VARCHAR(50) DEFAULT 'manuel';
-- Değerler: 'manuel', 'excel_import', 'toplu_hesaplama'

ALTER TABLE bordro_kayitlari 
ADD COLUMN IF NOT EXISTS kaynak_dosya VARCHAR(255);

-- ====================================================
-- 2. UNIQUE CONSTRAINT GÜNCELLE
-- ====================================================

-- Eski constraint'i kaldır
ALTER TABLE bordro_kayitlari 
DROP CONSTRAINT IF EXISTS bordro_kayitlari_personel_id_yil_ay_key;

-- Yeni constraint: personel + proje + yıl + ay benzersiz olmalı
-- NOT: proje_id NULL olabilir (genel bordro için)
CREATE UNIQUE INDEX IF NOT EXISTS idx_bordro_unique_with_project 
ON bordro_kayitlari (personel_id, COALESCE(proje_id, 0), yil, ay);

-- ====================================================
-- 3. İNDEKSLER
-- ====================================================

CREATE INDEX IF NOT EXISTS idx_bordro_proje ON bordro_kayitlari(proje_id);
CREATE INDEX IF NOT EXISTS idx_bordro_proje_donem ON bordro_kayitlari(proje_id, yil, ay);

-- ====================================================
-- 4. PROJE BAZLI BORDRO ÖZET VIEW
-- ====================================================

CREATE OR REPLACE VIEW bordro_proje_ozet AS
SELECT 
    p.id as proje_id,
    p.ad as proje_ad,
    p.kod as proje_kod,
    b.yil,
    b.ay,
    COUNT(DISTINCT b.personel_id) as personel_sayisi,
    SUM(b.brut_toplam) as toplam_brut,
    SUM(b.net_maas) as toplam_net,
    SUM(b.toplam_isci_sgk) as toplam_sgk_isci,
    SUM(b.toplam_isveren_sgk) as toplam_sgk_isveren,
    SUM(b.gelir_vergisi) as toplam_gelir_vergisi,
    SUM(b.damga_vergisi) as toplam_damga_vergisi,
    SUM(b.toplam_maliyet) as toplam_maliyet,
    COUNT(*) FILTER (WHERE b.odeme_durumu = 'odendi') as odenen_sayisi,
    COUNT(*) FILTER (WHERE b.odeme_durumu = 'beklemede') as bekleyen_sayisi
FROM bordro_kayitlari b
LEFT JOIN projeler p ON p.id = b.proje_id
GROUP BY p.id, p.ad, p.kod, b.yil, b.ay
ORDER BY b.yil DESC, b.ay DESC, p.ad;

-- ====================================================
-- 5. PERSONEL PROJE BORDRO VIEW
-- ====================================================

CREATE OR REPLACE VIEW personel_proje_bordro AS
SELECT 
    per.id as personel_id,
    per.ad || ' ' || per.soyad as personel_ad,
    per.tc_kimlik,
    p.id as proje_id,
    p.ad as proje_ad,
    b.yil,
    b.ay,
    b.brut_maas,
    b.brut_toplam,
    b.net_maas,
    b.toplam_isci_sgk,
    b.gelir_vergisi,
    b.damga_vergisi,
    b.toplam_maliyet,
    b.odeme_durumu
FROM bordro_kayitlari b
JOIN personeller per ON per.id = b.personel_id
LEFT JOIN projeler p ON p.id = b.proje_id
ORDER BY b.yil DESC, b.ay DESC, per.ad;

-- ====================================================
-- Migration tamamlandı!
-- ====================================================

