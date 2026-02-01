-- Tazminat Sistemi Migration
-- 1. Personel tablosuna kalan izin ve çıkış bilgileri
-- 2. Tazminat hesap geçmişi tablosu

-- Personeller tablosuna yeni alanlar
ALTER TABLE personeller ADD COLUMN IF NOT EXISTS kalan_izin_gun INTEGER DEFAULT 14;
ALTER TABLE personeller ADD COLUMN IF NOT EXISTS cikis_tarihi DATE;
ALTER TABLE personeller ADD COLUMN IF NOT EXISTS cikis_sebebi VARCHAR(50);
ALTER TABLE personeller ADD COLUMN IF NOT EXISTS tazminat_odendi BOOLEAN DEFAULT FALSE;
ALTER TABLE personeller ADD COLUMN IF NOT EXISTS tazminat_toplam DECIMAL(12,2);

-- Tazminat hesap geçmişi tablosu
CREATE TABLE IF NOT EXISTS tazminat_hesaplari (
  id SERIAL PRIMARY KEY,
  personel_id INTEGER REFERENCES personeller(id) ON DELETE CASCADE,
  hesap_tarihi DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Çıkış bilgileri
  cikis_tarihi DATE NOT NULL,
  cikis_sebebi VARCHAR(50) NOT NULL,
  
  -- Çalışma süresi
  ise_giris_tarihi DATE NOT NULL,
  calisma_yil DECIMAL(6,2) NOT NULL,
  calisma_ay INTEGER,
  calisma_gun INTEGER,
  
  -- Maaş bilgisi
  brut_maas DECIMAL(12,2) NOT NULL,
  gunluk_brut DECIMAL(12,2) NOT NULL,
  
  -- Kıdem tazminatı
  kidem_hak_var BOOLEAN DEFAULT FALSE,
  kidem_gun INTEGER DEFAULT 0,
  kidem_tutari DECIMAL(12,2) DEFAULT 0,
  kidem_tavan_asildi BOOLEAN DEFAULT FALSE,
  
  -- İhbar tazminatı
  ihbar_hak_var BOOLEAN DEFAULT FALSE,
  ihbar_gun INTEGER DEFAULT 0,
  ihbar_tutari DECIMAL(12,2) DEFAULT 0,
  
  -- İzin ücreti
  izin_hak_var BOOLEAN DEFAULT TRUE,
  izin_gun INTEGER DEFAULT 0,
  izin_tutari DECIMAL(12,2) DEFAULT 0,
  
  -- Toplam
  toplam_tazminat DECIMAL(12,2) NOT NULL,
  
  -- Durum
  odeme_durumu VARCHAR(20) DEFAULT 'beklemede', -- beklemede, odendi, iptal
  odeme_tarihi DATE,
  
  -- Meta
  notlar TEXT,
  created_by INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexler
CREATE INDEX IF NOT EXISTS idx_tazminat_personel ON tazminat_hesaplari(personel_id);
CREATE INDEX IF NOT EXISTS idx_tazminat_tarih ON tazminat_hesaplari(hesap_tarihi);
CREATE INDEX IF NOT EXISTS idx_tazminat_durum ON tazminat_hesaplari(odeme_durumu);

-- Updated at trigger
DROP TRIGGER IF EXISTS update_tazminat_hesaplari_updated_at ON tazminat_hesaplari;
CREATE TRIGGER update_tazminat_hesaplari_updated_at
  BEFORE UPDATE ON tazminat_hesaplari
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Kıdem tazminatı tavan tablosu (yıllık güncellenir)
CREATE TABLE IF NOT EXISTS kidem_tavan (
  id SERIAL PRIMARY KEY,
  yil INTEGER NOT NULL,
  donem INTEGER NOT NULL, -- 1: Ocak-Haziran, 2: Temmuz-Aralık
  tavan_tutari DECIMAL(12,2) NOT NULL,
  gecerlilik_baslangic DATE NOT NULL,
  gecerlilik_bitis DATE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 2024 ve 2025 tavanları
INSERT INTO kidem_tavan (yil, donem, tavan_tutari, gecerlilik_baslangic, gecerlilik_bitis)
VALUES 
  (2024, 1, 23489.83, '2024-01-01', '2024-06-30'),
  (2024, 2, 35058.58, '2024-07-01', '2024-12-31'),
  (2025, 1, 41828.42, '2025-01-01', '2025-06-30')
ON CONFLICT DO NOTHING;

-- Yorum
COMMENT ON TABLE tazminat_hesaplari IS 'Personel tazminat hesaplama geçmişi';
COMMENT ON TABLE kidem_tavan IS 'Kıdem tazminatı tavan tutarları (6 ayda bir güncellenir)';

