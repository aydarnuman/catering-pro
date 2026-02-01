-- =====================================================
-- PROJE ENTEGRASYONU - TÜM MODÜLLER İÇİN
-- Demirbaş ve Çek/Senet tablolarına proje_id ekleme
-- =====================================================

-- Demirbaş tablosuna proje_id ekle
ALTER TABLE demirbaslar ADD COLUMN IF NOT EXISTS proje_id INTEGER REFERENCES projeler(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_demirbaslar_proje ON demirbaslar(proje_id);

-- Çek/Senet tablosuna proje_id ekle
ALTER TABLE cek_senetler ADD COLUMN IF NOT EXISTS proje_id INTEGER REFERENCES projeler(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_cek_senetler_proje ON cek_senetler(proje_id);

-- Stok hareketlerine proje_id ekle (opsiyonel - fatura bazlı işlem için)
-- ALTER TABLE stok_hareketleri ADD COLUMN IF NOT EXISTS proje_id INTEGER REFERENCES projeler(id) ON DELETE SET NULL;
-- CREATE INDEX IF NOT EXISTS idx_stok_hareketleri_proje ON stok_hareketleri(proje_id);

-- Yorum: Proje entegrasyonu tamamlandı
-- Artık demirbaş ve çek/senetler proje bazlı takip edilebilir

