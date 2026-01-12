-- =====================================================
-- PROJE BAZLI GELİR/GİDER TAKİBİ
-- =====================================================

-- 1. Proje Hareketleri Ana Tablosu
CREATE TABLE IF NOT EXISTS proje_hareketler (
  id SERIAL PRIMARY KEY,
  proje_id INT REFERENCES projeler(id) ON DELETE CASCADE,
  tip VARCHAR(10) NOT NULL CHECK (tip IN ('gelir', 'gider')),
  kategori VARCHAR(50) NOT NULL,
  tutar DECIMAL(12,2) NOT NULL,
  tarih DATE NOT NULL,
  aciklama TEXT,
  
  -- Referans bilgileri (otomatik oluşturulan hareketler için)
  referans_tip VARCHAR(50), -- 'bordro', 'fatura', 'demirbas', 'cek_senet', 'hakedis', 'manuel'
  referans_id INT,
  
  -- Ödeme durumu
  odendi BOOLEAN DEFAULT FALSE,
  odeme_tarihi TIMESTAMP,
  
  -- Meta
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Gelir Kategorileri
-- 'hakedis' - İhale/sözleşme ödemeleri
-- 'fatura_satis' - Satış faturaları
-- 'diger_gelir' - Faiz, kira vs.

-- 3. Gider Kategorileri  
-- 'personel_maas' - Maaş ödemeleri
-- 'personel_sgk' - SGK primleri
-- 'personel_vergi' - Vergiler (gelir, damga, işsizlik)
-- 'fatura_alis' - Alış faturaları
-- 'demirbas' - Demirbaş alımları
-- 'nakit_cikis' - Nakit çıkışlar
-- 'cek_senet' - Çek/senet ödemeleri
-- 'diger_gider' - Diğer giderler

-- Index'ler
CREATE INDEX IF NOT EXISTS idx_proje_hareketler_proje ON proje_hareketler(proje_id);
CREATE INDEX IF NOT EXISTS idx_proje_hareketler_tarih ON proje_hareketler(tarih);
CREATE INDEX IF NOT EXISTS idx_proje_hareketler_tip ON proje_hareketler(tip);
CREATE INDEX IF NOT EXISTS idx_proje_hareketler_kategori ON proje_hareketler(kategori);
CREATE INDEX IF NOT EXISTS idx_proje_hareketler_referans ON proje_hareketler(referans_tip, referans_id);

-- View: Proje Gelir/Gider Özeti
CREATE OR REPLACE VIEW v_proje_gelir_gider_ozeti AS
SELECT 
  p.id as proje_id,
  p.ad as proje_adi,
  EXTRACT(YEAR FROM h.tarih) as yil,
  EXTRACT(MONTH FROM h.tarih) as ay,
  SUM(CASE WHEN h.tip = 'gelir' THEN h.tutar ELSE 0 END) as toplam_gelir,
  SUM(CASE WHEN h.tip = 'gider' THEN h.tutar ELSE 0 END) as toplam_gider,
  SUM(CASE WHEN h.tip = 'gelir' THEN h.tutar ELSE -h.tutar END) as net_kar,
  SUM(CASE WHEN h.tip = 'gider' AND h.odendi THEN h.tutar ELSE 0 END) as odenen_gider,
  SUM(CASE WHEN h.tip = 'gider' AND NOT h.odendi THEN h.tutar ELSE 0 END) as bekleyen_gider
FROM projeler p
LEFT JOIN proje_hareketler h ON h.proje_id = p.id
GROUP BY p.id, p.ad, EXTRACT(YEAR FROM h.tarih), EXTRACT(MONTH FROM h.tarih);

-- View: Kategori Bazlı Özet
CREATE OR REPLACE VIEW v_proje_kategori_ozeti AS
SELECT 
  proje_id,
  tip,
  kategori,
  EXTRACT(YEAR FROM tarih) as yil,
  EXTRACT(MONTH FROM tarih) as ay,
  SUM(tutar) as toplam,
  SUM(CASE WHEN odendi THEN tutar ELSE 0 END) as odenen,
  COUNT(*) as hareket_sayisi
FROM proje_hareketler
GROUP BY proje_id, tip, kategori, EXTRACT(YEAR FROM tarih), EXTRACT(MONTH FROM tarih);

-- Trigger: updated_at otomatik güncelleme
CREATE OR REPLACE FUNCTION update_proje_hareketler_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_proje_hareketler_updated ON proje_hareketler;
CREATE TRIGGER trg_proje_hareketler_updated
  BEFORE UPDATE ON proje_hareketler
  FOR EACH ROW EXECUTE FUNCTION update_proje_hareketler_updated_at();

