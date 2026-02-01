-- KYK Yurt Menüsü - Toplu Reçete Ekleme
-- Tarih: 2026-01

-- =============================================
-- ÇORBALAR
-- =============================================

INSERT INTO receteler (kod, ad, kategori_id, porsiyon_miktar, kalori, protein, karbonhidrat, yag, aktif)
SELECT 'CRB-' || LPAD(ROW_NUMBER() OVER()::text, 3, '0'), ad, 
       (SELECT id FROM recete_kategoriler WHERE kod = 'corba'), 
       1, kalori, protein, karbonhidrat, yag, true
FROM (VALUES
  ('Mercimek Çorbası', 180, 12, 28, 4),
  ('Ezogelin Çorbası', 165, 10, 30, 3),
  ('Tarhana Çorbası', 150, 8, 25, 4),
  ('Domates Çorbası', 120, 3, 20, 3),
  ('Yayla Çorbası', 140, 6, 18, 5),
  ('Şehriye Çorbası', 130, 4, 24, 2),
  ('Tavuk Suyu Çorbası', 90, 8, 8, 3),
  ('Düğün Çorbası', 175, 10, 15, 8),
  ('Sebze Çorbası', 100, 3, 18, 2),
  ('Pirinç Çorbası', 135, 3, 26, 2),
  ('Kremalı Mantar Çorbası', 160, 5, 12, 10),
  ('Patates Çorbası', 145, 4, 22, 4)
) AS t(ad, kalori, protein, karbonhidrat, yag)
ON CONFLICT (kod) DO NOTHING;

-- =============================================
-- ANA YEMEKLER
-- =============================================

INSERT INTO receteler (kod, ad, kategori_id, porsiyon_miktar, kalori, protein, karbonhidrat, yag, aktif)
SELECT 'ANA-' || LPAD(ROW_NUMBER() OVER()::text, 3, '0'), ad, 
       (SELECT id FROM recete_kategoriler WHERE kod = 'ana_yemek'), 
       1, kalori, protein, karbonhidrat, yag, true
FROM (VALUES
  ('Kuru Fasulye', 320, 18, 45, 8),
  ('Nohut Yemeği', 300, 15, 42, 7),
  ('Etli Bezelye', 280, 20, 22, 12),
  ('Etli Türlü', 290, 18, 25, 12),
  ('Tavuk Sote', 260, 28, 10, 12),
  ('Tavuklu Pilav', 450, 25, 55, 12),
  ('İzmir Köfte', 380, 22, 20, 24),
  ('Kadınbudu Köfte', 340, 20, 18, 20),
  ('Et Haşlama', 350, 32, 8, 22),
  ('Tas Kebabı', 370, 28, 12, 24),
  ('Karışık Kızartma', 400, 15, 35, 22),
  ('Karnıyarık', 320, 18, 25, 18),
  ('İmam Bayıldı', 280, 6, 22, 18),
  ('Etli Kapuska', 260, 18, 20, 12),
  ('Yaprak Sarma', 290, 12, 35, 12),
  ('Musakka', 340, 16, 28, 18),
  ('Taze Fasulye', 180, 8, 22, 6),
  ('Patlıcan Kebabı', 310, 22, 15, 18),
  ('Güveç', 380, 24, 28, 18),
  ('Fırın Tavuk', 300, 30, 5, 18)
) AS t(ad, kalori, protein, karbonhidrat, yag)
ON CONFLICT (kod) DO NOTHING;

-- =============================================
-- PİLAV / MAKARNA
-- =============================================

INSERT INTO receteler (kod, ad, kategori_id, porsiyon_miktar, kalori, protein, karbonhidrat, yag, aktif)
SELECT 'PLV-' || LPAD(ROW_NUMBER() OVER()::text, 3, '0'), ad, 
       (SELECT id FROM recete_kategoriler WHERE kod = 'pilav_makarna'), 
       1, kalori, protein, karbonhidrat, yag, true
FROM (VALUES
  ('Pirinç Pilavı', 200, 4, 42, 3),
  ('Bulgur Pilavı', 180, 6, 38, 2),
  ('Şehriyeli Pilav', 210, 5, 44, 3),
  ('Spagetti Bolonez', 350, 15, 48, 10),
  ('Makarna (Domates Soslu)', 260, 8, 48, 4),
  ('Soslu Makarna', 300, 10, 45, 8),
  ('Nohutlu Pilav', 220, 8, 40, 4),
  ('Domatesli Bulgur Pilavı', 190, 6, 38, 3)
) AS t(ad, kalori, protein, karbonhidrat, yag)
ON CONFLICT (kod) DO NOTHING;

-- =============================================
-- SALATA / MEZE
-- =============================================

INSERT INTO receteler (kod, ad, kategori_id, porsiyon_miktar, kalori, protein, karbonhidrat, yag, aktif)
SELECT 'SLT-' || LPAD(ROW_NUMBER() OVER()::text, 3, '0'), ad, 
       (SELECT id FROM recete_kategoriler WHERE kod = 'salata_meze'), 
       1, kalori, protein, karbonhidrat, yag, true
FROM (VALUES
  ('Mevsim Salata', 45, 2, 8, 1),
  ('Çoban Salata', 50, 2, 10, 1),
  ('Cacık', 60, 4, 6, 2),
  ('Havuç Tarator', 80, 3, 10, 3),
  ('Piyaz', 120, 6, 18, 3),
  ('Turşu', 15, 0, 3, 0),
  ('Kısır', 180, 5, 30, 5),
  ('Rus Salatası', 200, 4, 18, 12),
  ('Yoğurt', 90, 5, 8, 4),
  ('Haydari', 110, 6, 5, 8)
) AS t(ad, kalori, protein, karbonhidrat, yag)
ON CONFLICT (kod) DO NOTHING;

-- =============================================
-- TATLILAR
-- =============================================

INSERT INTO receteler (kod, ad, kategori_id, porsiyon_miktar, kalori, protein, karbonhidrat, yag, aktif)
SELECT 'TTL-' || LPAD(ROW_NUMBER() OVER()::text, 3, '0'), ad, 
       (SELECT id FROM recete_kategoriler WHERE kod = 'tatli'), 
       1, kalori, protein, karbonhidrat, yag, true
FROM (VALUES
  ('Sütlaç', 180, 5, 32, 4),
  ('İrmik Helvası', 250, 4, 35, 10),
  ('Keşkül', 200, 6, 28, 7),
  ('Revani', 280, 4, 45, 10),
  ('Meyve Komposto', 100, 0, 25, 0),
  ('Puding', 160, 4, 28, 4),
  ('Ayva Tatlısı', 220, 1, 50, 2),
  ('Kabak Tatlısı', 200, 2, 45, 2)
) AS t(ad, kalori, protein, karbonhidrat, yag)
ON CONFLICT (kod) DO NOTHING;

-- =============================================
-- KAHVALTILIK
-- =============================================

INSERT INTO receteler (kod, ad, kategori_id, porsiyon_miktar, kalori, protein, karbonhidrat, yag, aktif)
SELECT 'KHV-' || LPAD(ROW_NUMBER() OVER()::text, 3, '0'), ad, 
       (SELECT id FROM recete_kategoriler WHERE kod = 'kahvaltilik'), 
       1, kalori, protein, karbonhidrat, yag, true
FROM (VALUES
  ('Haşlanmış Yumurta', 75, 6, 1, 5),
  ('Menemen', 180, 10, 12, 12),
  ('Sahanda Yumurta', 120, 8, 1, 9),
  ('Beyaz Peynir', 130, 8, 2, 10),
  ('Kaşar Peynir', 140, 10, 1, 11),
  ('Zeytin', 45, 0, 2, 4),
  ('Domates-Salatalık', 25, 1, 5, 0),
  ('Bal', 90, 0, 23, 0),
  ('Reçel', 75, 0, 19, 0),
  ('Tereyağı', 110, 0, 0, 12),
  ('Sucuk', 200, 12, 2, 16),
  ('Süt', 120, 6, 10, 6),
  ('Ekmek', 270, 8, 52, 2),
  ('Simit', 280, 8, 50, 5)
) AS t(ad, kalori, protein, karbonhidrat, yag)
ON CONFLICT (kod) DO NOTHING;

-- =============================================
-- İÇECEKLER
-- =============================================

INSERT INTO receteler (kod, ad, kategori_id, porsiyon_miktar, kalori, protein, karbonhidrat, yag, aktif)
SELECT 'ICK-' || LPAD(ROW_NUMBER() OVER()::text, 3, '0'), ad, 
       (SELECT id FROM recete_kategoriler WHERE kod = 'icecek'), 
       1, kalori, protein, karbonhidrat, yag, true
FROM (VALUES
  ('Çay', 2, 0, 0, 0),
  ('Ayran', 60, 3, 4, 3),
  ('Limonata', 80, 0, 20, 0),
  ('Meyve Suyu', 90, 0, 22, 0),
  ('Şalgam', 20, 0, 4, 0)
) AS t(ad, kalori, protein, karbonhidrat, yag)
ON CONFLICT (kod) DO NOTHING;

-- Eklenen reçete sayısını göster
DO $$
DECLARE
  recete_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO recete_count FROM receteler WHERE created_at > NOW() - INTERVAL '1 minute';
  RAISE NOTICE '✅ Toplam % reçete eklendi!', recete_count;
END $$;

