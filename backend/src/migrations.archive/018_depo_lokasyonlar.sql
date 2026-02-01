-- Depo lokasyonları/bölümleri için tablo
CREATE TABLE IF NOT EXISTS depo_lokasyonlar (
  id SERIAL PRIMARY KEY,
  depo_id INTEGER NOT NULL REFERENCES depolar(id) ON DELETE CASCADE,
  kod VARCHAR(50) NOT NULL,
  ad VARCHAR(100) NOT NULL,
  tur VARCHAR(50), -- soguk_hava, dondurulmus, kuru_gida, sebze_meyve, temizlik, vb
  sicaklik_min DECIMAL(5,2), -- Minimum sıcaklık (soğuk depolar için)
  sicaklik_max DECIMAL(5,2), -- Maximum sıcaklık
  kapasite_m3 DECIMAL(10,2) DEFAULT 0,
  raf_sayisi INTEGER DEFAULT 0,
  notlar TEXT,
  aktif BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(depo_id, kod)
);

-- stok_depo_durumlari tablosuna lokasyon desteği ekle
ALTER TABLE stok_depo_durumlari 
ADD COLUMN IF NOT EXISTS lokasyon_id INTEGER REFERENCES depo_lokasyonlar(id);

-- Mevcut depolar için örnek lokasyonlar ekle
INSERT INTO depo_lokasyonlar (depo_id, kod, ad, tur, sicaklik_min, sicaklik_max) VALUES
-- Merkez Depo lokasyonları
(1, 'M-KURU', 'Kuru Gıda', 'kuru_gida', NULL, NULL),
(1, 'M-KONSERVE', 'Konserve Ürünler', 'konserve', NULL, NULL),
(1, 'M-ICECEK', 'İçecekler', 'icecek', NULL, NULL),

-- Mutfak Deposu lokasyonları  
(2, 'MUT-GUNLUK', 'Günlük Kullanım', 'kuru_gida', NULL, NULL),
(2, 'MUT-BAHARAT', 'Baharatlar', 'baharat', NULL, NULL),

-- Soğuk Hava Deposu 1 lokasyonları
(3, 'S1-ET', 'Et Ürünleri', 'soguk_hava', 0, 4),
(3, 'S1-SUT', 'Süt Ürünleri', 'soguk_hava', 2, 6),
(3, 'S1-SEBZE', 'Sebze-Meyve', 'sebze_meyve', 4, 8),

-- KYK Merkez Yurt Deposu lokasyonları (ID: 6)
(6, 'KYK-M-KURU', 'Kuru Gıda Bölümü', 'kuru_gida', NULL, NULL),
(6, 'KYK-M-SOGUK', 'Soğuk Hava Bölümü', 'soguk_hava', 0, 4),
(6, 'KYK-M-DONDURULMUS', 'Dondurulmuş Ürün Bölümü', 'dondurulmus', -18, -12),
(6, 'KYK-M-SEBZE', 'Sebze-Meyve Bölümü', 'sebze_meyve', 8, 12),
(6, 'KYK-M-TEMIZLIK', 'Temizlik Malzemeleri', 'temizlik', NULL, NULL),

-- KYK Yurt Mutfak Deposu lokasyonları (ID: 7)
(7, 'KYK-MUT-KURU', 'Kuru Gıda Rafları', 'kuru_gida', NULL, NULL),
(7, 'KYK-MUT-BAHARAT', 'Baharat Dolabı', 'baharat', NULL, NULL),
(7, 'KYK-MUT-TEMIZLIK', 'Temizlik Malzemeleri', 'temizlik', NULL, NULL),
(7, 'KYK-MUT-KAGIT', 'Kağıt Ürünler', 'temizlik', NULL, NULL),

-- KYK Soğuk Hava Deposu lokasyonları (ID: 8)
(8, 'KYK-S-ET', 'Et ve Et Ürünleri', 'soguk_hava', 0, 4),
(8, 'KYK-S-SUT', 'Süt Ürünleri', 'soguk_hava', 2, 6),
(8, 'KYK-S-DONDURMA', 'Dondurma ve Tatlılar', 'dondurulmus', -18, -12),
(8, 'KYK-S-MEYVE', 'Meyve Suları', 'soguk_hava', 4, 8);

-- Mevcut stokları rastgele lokasyonlara dağıt (örnek)
UPDATE stok_depo_durumlari sd
SET lokasyon_id = (
  SELECT dl.id 
  FROM depo_lokasyonlar dl 
  WHERE dl.depo_id = sd.depo_id 
  AND dl.aktif = true 
  ORDER BY RANDOM() 
  LIMIT 1
)
WHERE lokasyon_id IS NULL;

-- View: Depo lokasyon bazlı stok özeti
CREATE OR REPLACE VIEW v_depo_lokasyon_stok AS
SELECT 
  d.id as depo_id,
  d.ad as depo_ad,
  d.kod as depo_kod,
  dl.id as lokasyon_id,
  dl.ad as lokasyon_ad,
  dl.kod as lokasyon_kod,
  dl.tur as lokasyon_tur,
  COUNT(DISTINCT sd.stok_kart_id) as urun_sayisi,
  COALESCE(SUM(sd.miktar * sk.son_alis_fiyat), 0) as toplam_deger
FROM depolar d
LEFT JOIN depo_lokasyonlar dl ON dl.depo_id = d.id
LEFT JOIN stok_depo_durumlari sd ON sd.depo_id = d.id AND sd.lokasyon_id = dl.id
LEFT JOIN stok_kartlari sk ON sk.id = sd.stok_kart_id
WHERE d.aktif = true AND dl.aktif = true
GROUP BY d.id, d.ad, d.kod, dl.id, dl.ad, dl.kod, dl.tur
ORDER BY d.kod, dl.kod;
