-- =====================================================
-- 112: Kategori Sistemi Genişletme
-- Gıda ve Gıda Dışı kategorilerin ayrılması
-- =====================================================

-- 1. Kategori türü kolonu ekle
ALTER TABLE urun_kategorileri 
ADD COLUMN IF NOT EXISTS tur VARCHAR(20) DEFAULT 'gida';

-- 2. Kategori grubu kolonu (alt gruplama için)
ALTER TABLE urun_kategorileri 
ADD COLUMN IF NOT EXISTS grup VARCHAR(50);

-- 3. Açıklama kolonu
ALTER TABLE urun_kategorileri 
ADD COLUMN IF NOT EXISTS aciklama TEXT;

-- 4. Mevcut kategorileri "gida" olarak işaretle
UPDATE urun_kategorileri SET tur = 'gida' WHERE tur IS NULL;

-- 5. Mevcut gıda kategorilerine grup ata
UPDATE urun_kategorileri SET grup = 'protein' WHERE ad IN ('Et & Tavuk', 'Balık & Deniz Ürünleri');
UPDATE urun_kategorileri SET grup = 'sut_urunleri' WHERE ad = 'Süt Ürünleri';
UPDATE urun_kategorileri SET grup = 'taze' WHERE ad IN ('Sebzeler', 'Meyveler');
UPDATE urun_kategorileri SET grup = 'kuru_gida' WHERE ad IN ('Bakliyat', 'Tahıllar & Makarna');
UPDATE urun_kategorileri SET grup = 'sos_baharat' WHERE ad IN ('Yağlar', 'Baharatlar', 'Soslar & Salçalar');
UPDATE urun_kategorileri SET grup = 'diger_gida' WHERE ad IN ('Şekerler & Tatlandırıcılar', 'İçecekler', 'Diğer');

-- 6. Eksik gıda kategorilerini ekle
INSERT INTO urun_kategorileri (ad, ikon, sira, tur, grup, aciklama) VALUES
  ('Konserve & Hazır Gıda', '🥫', 14, 'gida', 'kuru_gida', 'Konserve ürünler, hazır çorbalar, soslar'),
  ('Dondurulmuş Gıda', '🧊', 15, 'gida', 'donuk', 'Dondurulmuş sebze, meyve, hamur işleri'),
  ('Unlu Mamuller & Fırın', '🥖', 16, 'gida', 'firin', 'Ekmek, yufka, milföy, börek malzemeleri'),
  ('Kuruyemiş & Kuru Meyve', '🥜', 17, 'gida', 'kuru_gida', 'Fındık, ceviz, badem, kuru üzüm'),
  ('Kahvaltılık', '🍳', 18, 'gida', 'kahvalti', 'Zeytin, reçel, bal, peynir çeşitleri'),
  ('Şarküteri', '🥓', 19, 'gida', 'protein', 'Sucuk, sosis, salam, pastırma')
ON CONFLICT (ad) DO UPDATE SET 
  tur = EXCLUDED.tur,
  grup = EXCLUDED.grup,
  aciklama = EXCLUDED.aciklama;

-- 7. GIDA DIŞI KATEGORİLER
INSERT INTO urun_kategorileri (ad, ikon, sira, tur, grup, aciklama) VALUES
  -- Temizlik & Hijyen
  ('Temizlik Malzemeleri', '🧹', 101, 'gida_disi', 'temizlik', 'Deterjan, çamaşır suyu, yüzey temizleyici'),
  ('Hijyen Ürünleri', '🧴', 102, 'gida_disi', 'temizlik', 'Sabun, dezenfektan, el antiseptiği'),
  ('Çöp & Atık', '🗑️', 103, 'gida_disi', 'temizlik', 'Çöp poşeti, atık kovası, geri dönüşüm'),
  
  -- Ambalaj & Paketleme
  ('Ambalaj Malzemeleri', '📦', 111, 'gida_disi', 'ambalaj', 'Streç film, alüminyum folyo, vakum poşet'),
  ('Tek Kullanımlık', '🥡', 112, 'gida_disi', 'ambalaj', 'Köpük tabak, plastik çatal, kağıt bardak'),
  ('Paket Servis', '🛍️', 113, 'gida_disi', 'ambalaj', 'Paket kutusu, karton tabak, taşıma çantası'),
  
  -- Mutfak Ekipman
  ('Mutfak Ekipmanları', '🍳', 121, 'gida_disi', 'ekipman', 'Tencere, tava, kesme tahtası'),
  ('Mutfak Sarf', '🔪', 122, 'gida_disi', 'ekipman', 'Bıçak, spatula, kevgir, servis malzemesi'),
  ('Pişirme Aksesuarları', '🧤', 123, 'gida_disi', 'ekipman', 'Fırın eldiveni, önlük, tülbent'),
  
  -- İş Güvenliği & Giyim
  ('İş Güvenliği', '⛑️', 131, 'gida_disi', 'guvenlik', 'Bone, eldiven, maske, gözlük'),
  ('İş Kıyafeti', '👔', 132, 'gida_disi', 'guvenlik', 'Aşçı önlüğü, mutfak kıyafeti'),
  
  -- Enerji & Yakıt
  ('Yakıt & Enerji', '⛽', 141, 'gida_disi', 'enerji', 'LPG, tüp gaz, jeneratör yakıtı'),
  
  -- Ofis & Kırtasiye
  ('Ofis Malzemeleri', '📎', 151, 'gida_disi', 'ofis', 'Kırtasiye, yazıcı malzemesi'),
  
  -- Diğer Gıda Dışı
  ('Diğer Sarf Malzeme', '🔧', 199, 'gida_disi', 'diger', 'Sınıflandırılmamış sarf malzemeler')
ON CONFLICT (ad) DO UPDATE SET 
  tur = EXCLUDED.tur,
  grup = EXCLUDED.grup,
  sira = EXCLUDED.sira,
  aciklama = EXCLUDED.aciklama;

-- 8. İndeks ekle
CREATE INDEX IF NOT EXISTS idx_urun_kategorileri_tur ON urun_kategorileri(tur);
CREATE INDEX IF NOT EXISTS idx_urun_kategorileri_grup ON urun_kategorileri(grup);

-- 9. View: Kategoriler türe göre gruplu
CREATE OR REPLACE VIEW v_kategoriler_gruplu AS
SELECT 
  id,
  ad,
  ikon,
  sira,
  tur,
  grup,
  aciklama,
  aktif,
  CASE 
    WHEN tur = 'gida' THEN 'Gıda'
    WHEN tur = 'gida_disi' THEN 'Gıda Dışı'
    ELSE 'Diğer'
  END as tur_adi
FROM urun_kategorileri
WHERE aktif = true
ORDER BY tur, sira;

-- 10. View: Kategori özeti
CREATE OR REPLACE VIEW v_kategori_ozeti AS
SELECT 
  tur,
  CASE 
    WHEN tur = 'gida' THEN 'Gıda'
    WHEN tur = 'gida_disi' THEN 'Gıda Dışı'
    ELSE 'Diğer'
  END as tur_adi,
  COUNT(*) as kategori_sayisi,
  COUNT(DISTINCT grup) as grup_sayisi
FROM urun_kategorileri
WHERE aktif = true
GROUP BY tur;

COMMENT ON COLUMN urun_kategorileri.tur IS 'gida, gida_disi';
COMMENT ON COLUMN urun_kategorileri.grup IS 'Alt gruplama: protein, taze, kuru_gida, temizlik, ambalaj vb.';
