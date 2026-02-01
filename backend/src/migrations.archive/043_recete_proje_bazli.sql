-- =====================================================
-- MİGRASYON 043: Reçeteleri Proje Bazlı Yapma
-- Her projenin kendi reçete kütüphanesi olacak
-- =====================================================

-- 1. Reçeteler tablosuna proje_id ekle
ALTER TABLE receteler ADD COLUMN IF NOT EXISTS proje_id INTEGER REFERENCES projeler(id) ON DELETE SET NULL;

-- 2. Index ekle
CREATE INDEX IF NOT EXISTS idx_receteler_proje ON receteler(proje_id);

-- 3. Reçete malzemelerine de proje referansı (opsiyonel, join için)
-- ALTER TABLE recete_malzemeler ADD COLUMN IF NOT EXISTS proje_id INTEGER REFERENCES projeler(id) ON DELETE SET NULL;

-- 4. View güncelle: Proje bazlı reçete listesi
DROP VIEW IF EXISTS v_proje_receteler CASCADE;
CREATE VIEW v_proje_receteler AS
SELECT 
    r.id,
    r.kod,
    r.ad,
    r.proje_id,
    p.ad as proje_adi,
    r.kategori_id,
    rk.ad as kategori_adi,
    rk.kod as kategori_kod,
    rk.ikon as kategori_ikon,
    r.porsiyon_miktar,
    r.porsiyon_birim,
    r.hazirlik_suresi,
    r.pisirme_suresi,
    r.kalori,
    r.protein,
    r.karbonhidrat,
    r.yag,
    r.tahmini_maliyet,
    r.tarif,
    r.aktif,
    r.created_at,
    (SELECT COUNT(*) FROM recete_malzemeler rm WHERE rm.recete_id = r.id) as malzeme_sayisi
FROM receteler r
LEFT JOIN projeler p ON p.id = r.proje_id
LEFT JOIN recete_kategoriler rk ON rk.id = r.kategori_id
WHERE r.aktif = true;

-- 5. Mevcut reçeteleri "Genel" olarak işaretle (proje_id = NULL = tüm projeler görebilir)
-- Bu sayede mevcut reçeteler kaybolmaz

-- 6. Yorum
COMMENT ON COLUMN receteler.proje_id IS 'NULL ise genel reçete (tüm projeler görebilir), değilse sadece o projeye özel';

-- Not: Artık reçeteler şu şekilde çalışacak:
-- proje_id = NULL → Genel reçete, tüm projeler kullanabilir
-- proje_id = X → Sadece X projesine özel reçete

