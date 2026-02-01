-- =====================================================
-- 113: Kapsamlı Ürün Kartları ve Fiyat Tahminleri
-- Tüm gıda ve gıda dışı kategoriler için ürün kartları
-- Fiyatlar: Ocak 2026 Türkiye toptan piyasa tahminleri
-- =====================================================

-- Önce kategori ID'lerini alalım (fonksiyon ile)
CREATE OR REPLACE FUNCTION get_kategori_id(kategori_adi TEXT) 
RETURNS INTEGER AS $$
DECLARE
  k_id INTEGER;
BEGIN
  SELECT id INTO k_id FROM urun_kategorileri WHERE ad = kategori_adi LIMIT 1;
  RETURN k_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 1. ET & TAVUK (Protein)
-- =====================================================
INSERT INTO urun_kartlari (kod, ad, kategori_id, varsayilan_birim, manuel_fiyat, fiyat_birimi, aciklama) VALUES
  ('ET-0001', 'Dana Kıyma', (SELECT id FROM urun_kategorileri WHERE ad = 'Et & Tavuk'), 'kg', 650.00, 'TL/kg', 'Dana kıyma, %15-20 yağlı'),
  ('ET-0002', 'Dana Kuşbaşı', (SELECT id FROM urun_kategorileri WHERE ad = 'Et & Tavuk'), 'kg', 680.00, 'TL/kg', 'Dana kuşbaşı, sote için'),
  ('ET-0003', 'Dana Bonfile', (SELECT id FROM urun_kategorileri WHERE ad = 'Et & Tavuk'), 'kg', 950.00, 'TL/kg', 'Dana bonfile, premium kesim'),
  ('ET-0004', 'Dana Antrikot', (SELECT id FROM urun_kategorileri WHERE ad = 'Et & Tavuk'), 'kg', 850.00, 'TL/kg', 'Dana antrikot'),
  ('ET-0005', 'Dana Pirzola', (SELECT id FROM urun_kategorileri WHERE ad = 'Et & Tavuk'), 'kg', 750.00, 'TL/kg', 'Dana pirzola'),
  ('ET-0006', 'Dana Kaburga', (SELECT id FROM urun_kategorileri WHERE ad = 'Et & Tavuk'), 'kg', 450.00, 'TL/kg', 'Dana kaburga'),
  ('ET-0007', 'Dana İncik', (SELECT id FROM urun_kategorileri WHERE ad = 'Et & Tavuk'), 'kg', 400.00, 'TL/kg', 'Dana incik'),
  ('ET-0008', 'Dana But', (SELECT id FROM urun_kategorileri WHERE ad = 'Et & Tavuk'), 'kg', 580.00, 'TL/kg', 'Dana but'),
  ('ET-0009', 'Kuzu Kuşbaşı', (SELECT id FROM urun_kategorileri WHERE ad = 'Et & Tavuk'), 'kg', 620.00, 'TL/kg', 'Kuzu kuşbaşı'),
  ('ET-0010', 'Kuzu Pirzola', (SELECT id FROM urun_kategorileri WHERE ad = 'Et & Tavuk'), 'kg', 700.00, 'TL/kg', 'Kuzu pirzola'),
  ('ET-0011', 'Kuzu But', (SELECT id FROM urun_kategorileri WHERE ad = 'Et & Tavuk'), 'kg', 550.00, 'TL/kg', 'Kuzu but'),
  ('ET-0012', 'Kuzu Kaburga', (SELECT id FROM urun_kategorileri WHERE ad = 'Et & Tavuk'), 'kg', 480.00, 'TL/kg', 'Kuzu kaburga'),
  ('ET-0013', 'Kuzu Kol', (SELECT id FROM urun_kategorileri WHERE ad = 'Et & Tavuk'), 'kg', 520.00, 'TL/kg', 'Kuzu kol'),
  ('ET-0014', 'Tavuk Göğüs (Bonfile)', (SELECT id FROM urun_kategorileri WHERE ad = 'Et & Tavuk'), 'kg', 200.00, 'TL/kg', 'Tavuk göğüs fileto'),
  ('ET-0015', 'Tavuk But', (SELECT id FROM urun_kategorileri WHERE ad = 'Et & Tavuk'), 'kg', 130.00, 'TL/kg', 'Tavuk but'),
  ('ET-0016', 'Tavuk Kanat', (SELECT id FROM urun_kategorileri WHERE ad = 'Et & Tavuk'), 'kg', 120.00, 'TL/kg', 'Tavuk kanat'),
  ('ET-0017', 'Tavuk Baget', (SELECT id FROM urun_kategorileri WHERE ad = 'Et & Tavuk'), 'kg', 115.00, 'TL/kg', 'Tavuk baget'),
  ('ET-0018', 'Bütün Piliç', (SELECT id FROM urun_kategorileri WHERE ad = 'Et & Tavuk'), 'kg', 105.00, 'TL/kg', 'Bütün piliç'),
  ('ET-0019', 'Tavuk Pirzola', (SELECT id FROM urun_kategorileri WHERE ad = 'Et & Tavuk'), 'kg', 140.00, 'TL/kg', 'Tavuk pirzola'),
  ('ET-0020', 'Hindi Göğüs', (SELECT id FROM urun_kategorileri WHERE ad = 'Et & Tavuk'), 'kg', 280.00, 'TL/kg', 'Hindi göğüs fileto'),
  ('ET-0021', 'Hindi But', (SELECT id FROM urun_kategorileri WHERE ad = 'Et & Tavuk'), 'kg', 220.00, 'TL/kg', 'Hindi but'),
  ('ET-0022', 'Kıyılmış Tavuk', (SELECT id FROM urun_kategorileri WHERE ad = 'Et & Tavuk'), 'kg', 180.00, 'TL/kg', 'Kıyılmış tavuk eti')
ON CONFLICT (kod) DO UPDATE SET 
  manuel_fiyat = EXCLUDED.manuel_fiyat,
  aciklama = EXCLUDED.aciklama;

-- =====================================================
-- 2. BALIK & DENİZ ÜRÜNLERİ
-- =====================================================
INSERT INTO urun_kartlari (kod, ad, kategori_id, varsayilan_birim, manuel_fiyat, fiyat_birimi, aciklama) VALUES
  ('BLK-0001', 'Levrek (Çiftlik)', (SELECT id FROM urun_kategorileri WHERE ad = 'Balık & Deniz Ürünleri'), 'kg', 350.00, 'TL/kg', 'Çiftlik levreği'),
  ('BLK-0002', 'Çipura (Çiftlik)', (SELECT id FROM urun_kategorileri WHERE ad = 'Balık & Deniz Ürünleri'), 'kg', 320.00, 'TL/kg', 'Çiftlik çipurası'),
  ('BLK-0003', 'Somon Fileto', (SELECT id FROM urun_kategorileri WHERE ad = 'Balık & Deniz Ürünleri'), 'kg', 650.00, 'TL/kg', 'Somon fileto'),
  ('BLK-0004', 'Hamsi', (SELECT id FROM urun_kategorileri WHERE ad = 'Balık & Deniz Ürünleri'), 'kg', 180.00, 'TL/kg', 'Taze hamsi'),
  ('BLK-0005', 'Palamut', (SELECT id FROM urun_kategorileri WHERE ad = 'Balık & Deniz Ürünleri'), 'kg', 250.00, 'TL/kg', 'Taze palamut'),
  ('BLK-0006', 'Mezgit', (SELECT id FROM urun_kategorileri WHERE ad = 'Balık & Deniz Ürünleri'), 'kg', 200.00, 'TL/kg', 'Taze mezgit'),
  ('BLK-0007', 'Sardalya', (SELECT id FROM urun_kategorileri WHERE ad = 'Balık & Deniz Ürünleri'), 'kg', 120.00, 'TL/kg', 'Taze sardalya'),
  ('BLK-0008', 'Karides (Jumbo)', (SELECT id FROM urun_kategorileri WHERE ad = 'Balık & Deniz Ürünleri'), 'kg', 800.00, 'TL/kg', 'Jumbo karides'),
  ('BLK-0009', 'Midye (Ayıklanmış)', (SELECT id FROM urun_kategorileri WHERE ad = 'Balık & Deniz Ürünleri'), 'kg', 250.00, 'TL/kg', 'Ayıklanmış midye'),
  ('BLK-0010', 'Kalamar', (SELECT id FROM urun_kategorileri WHERE ad = 'Balık & Deniz Ürünleri'), 'kg', 400.00, 'TL/kg', 'Temizlenmiş kalamar'),
  ('BLK-0011', 'Alabalık', (SELECT id FROM urun_kategorileri WHERE ad = 'Balık & Deniz Ürünleri'), 'kg', 280.00, 'TL/kg', 'Taze alabalık'),
  ('BLK-0012', 'İstavrit', (SELECT id FROM urun_kategorileri WHERE ad = 'Balık & Deniz Ürünleri'), 'kg', 150.00, 'TL/kg', 'Taze istavrit')
ON CONFLICT (kod) DO UPDATE SET 
  manuel_fiyat = EXCLUDED.manuel_fiyat,
  aciklama = EXCLUDED.aciklama;

-- =====================================================
-- 3. SÜT ÜRÜNLERİ
-- =====================================================
INSERT INTO urun_kartlari (kod, ad, kategori_id, varsayilan_birim, manuel_fiyat, fiyat_birimi, aciklama) VALUES
  ('SUT-0001', 'Süt (Günlük)', (SELECT id FROM urun_kategorileri WHERE ad = 'Süt Ürünleri'), 'lt', 35.00, 'TL/lt', 'Günlük pastörize süt'),
  ('SUT-0002', 'Süt (UHT)', (SELECT id FROM urun_kategorileri WHERE ad = 'Süt Ürünleri'), 'lt', 42.00, 'TL/lt', 'UHT uzun ömürlü süt'),
  ('SUT-0003', 'Yoğurt (Kova)', (SELECT id FROM urun_kategorileri WHERE ad = 'Süt Ürünleri'), 'kg', 65.00, 'TL/kg', 'Kova yoğurt'),
  ('SUT-0004', 'Süzme Yoğurt', (SELECT id FROM urun_kategorileri WHERE ad = 'Süt Ürünleri'), 'kg', 120.00, 'TL/kg', 'Süzme yoğurt'),
  ('SUT-0005', 'Beyaz Peynir (Tam Yağlı)', (SELECT id FROM urun_kategorileri WHERE ad = 'Süt Ürünleri'), 'kg', 280.00, 'TL/kg', 'Tam yağlı beyaz peynir'),
  ('SUT-0006', 'Kaşar Peyniri (Taze)', (SELECT id FROM urun_kategorileri WHERE ad = 'Süt Ürünleri'), 'kg', 400.00, 'TL/kg', 'Taze kaşar peyniri'),
  ('SUT-0007', 'Kaşar Peyniri (Eski)', (SELECT id FROM urun_kategorileri WHERE ad = 'Süt Ürünleri'), 'kg', 480.00, 'TL/kg', 'Eski kaşar peyniri'),
  ('SUT-0008', 'Tost Peyniri (Dilimli)', (SELECT id FROM urun_kategorileri WHERE ad = 'Süt Ürünleri'), 'kg', 350.00, 'TL/kg', 'Dilimli tost peyniri'),
  ('SUT-0009', 'Lor Peyniri', (SELECT id FROM urun_kategorileri WHERE ad = 'Süt Ürünleri'), 'kg', 150.00, 'TL/kg', 'Lor peyniri'),
  ('SUT-0010', 'Tereyağı', (SELECT id FROM urun_kategorileri WHERE ad = 'Süt Ürünleri'), 'kg', 380.00, 'TL/kg', 'Tereyağı'),
  ('SUT-0011', 'Krema (Sıvı)', (SELECT id FROM urun_kategorileri WHERE ad = 'Süt Ürünleri'), 'lt', 180.00, 'TL/lt', 'Sıvı krema'),
  ('SUT-0012', 'Labne', (SELECT id FROM urun_kategorileri WHERE ad = 'Süt Ürünleri'), 'kg', 200.00, 'TL/kg', 'Labne peyniri'),
  ('SUT-0013', 'Ayran', (SELECT id FROM urun_kategorileri WHERE ad = 'Süt Ürünleri'), 'lt', 35.00, 'TL/lt', 'Ayran'),
  ('SUT-0014', 'Kaymak', (SELECT id FROM urun_kategorileri WHERE ad = 'Süt Ürünleri'), 'kg', 450.00, 'TL/kg', 'Kaymak'),
  ('SUT-0015', 'Çökelek', (SELECT id FROM urun_kategorileri WHERE ad = 'Süt Ürünleri'), 'kg', 180.00, 'TL/kg', 'Çökelek peyniri'),
  ('SUT-0016', 'Ezine Peyniri', (SELECT id FROM urun_kategorileri WHERE ad = 'Süt Ürünleri'), 'kg', 450.00, 'TL/kg', 'Ezine beyaz peynir'),
  ('SUT-0017', 'Tulum Peyniri', (SELECT id FROM urun_kategorileri WHERE ad = 'Süt Ürünleri'), 'kg', 500.00, 'TL/kg', 'Tulum peyniri')
ON CONFLICT (kod) DO UPDATE SET 
  manuel_fiyat = EXCLUDED.manuel_fiyat,
  aciklama = EXCLUDED.aciklama;

-- =====================================================
-- 4. SEBZELER (Mevsimsel - Kış fiyatları)
-- =====================================================
INSERT INTO urun_kartlari (kod, ad, kategori_id, varsayilan_birim, manuel_fiyat, fiyat_birimi, aciklama) VALUES
  ('SBZ-0001', 'Domates', (SELECT id FROM urun_kategorileri WHERE ad = 'Sebzeler'), 'kg', 45.00, 'TL/kg', 'Domates'),
  ('SBZ-0002', 'Biber (Sivri)', (SELECT id FROM urun_kategorileri WHERE ad = 'Sebzeler'), 'kg', 55.00, 'TL/kg', 'Sivri biber'),
  ('SBZ-0003', 'Biber (Dolmalık)', (SELECT id FROM urun_kategorileri WHERE ad = 'Sebzeler'), 'kg', 50.00, 'TL/kg', 'Dolmalık biber'),
  ('SBZ-0004', 'Patlıcan', (SELECT id FROM urun_kategorileri WHERE ad = 'Sebzeler'), 'kg', 40.00, 'TL/kg', 'Patlıcan'),
  ('SBZ-0005', 'Kabak', (SELECT id FROM urun_kategorileri WHERE ad = 'Sebzeler'), 'kg', 35.00, 'TL/kg', 'Kabak'),
  ('SBZ-0006', 'Soğan (Kuru)', (SELECT id FROM urun_kategorileri WHERE ad = 'Sebzeler'), 'kg', 25.00, 'TL/kg', 'Kuru soğan'),
  ('SBZ-0007', 'Soğan (Yeşil)', (SELECT id FROM urun_kategorileri WHERE ad = 'Sebzeler'), 'demet', 12.00, 'TL/demet', 'Yeşil soğan'),
  ('SBZ-0008', 'Sarımsak', (SELECT id FROM urun_kategorileri WHERE ad = 'Sebzeler'), 'kg', 120.00, 'TL/kg', 'Sarımsak'),
  ('SBZ-0009', 'Patates', (SELECT id FROM urun_kategorileri WHERE ad = 'Sebzeler'), 'kg', 28.00, 'TL/kg', 'Patates'),
  ('SBZ-0010', 'Havuç', (SELECT id FROM urun_kategorileri WHERE ad = 'Sebzeler'), 'kg', 25.00, 'TL/kg', 'Havuç'),
  ('SBZ-0011', 'Ispanak', (SELECT id FROM urun_kategorileri WHERE ad = 'Sebzeler'), 'kg', 55.00, 'TL/kg', 'Ispanak'),
  ('SBZ-0012', 'Pırasa', (SELECT id FROM urun_kategorileri WHERE ad = 'Sebzeler'), 'kg', 35.00, 'TL/kg', 'Pırasa'),
  ('SBZ-0013', 'Lahana (Beyaz)', (SELECT id FROM urun_kategorileri WHERE ad = 'Sebzeler'), 'kg', 20.00, 'TL/kg', 'Beyaz lahana'),
  ('SBZ-0014', 'Lahana (Kırmızı)', (SELECT id FROM urun_kategorileri WHERE ad = 'Sebzeler'), 'kg', 25.00, 'TL/kg', 'Kırmızı lahana'),
  ('SBZ-0015', 'Karnabahar', (SELECT id FROM urun_kategorileri WHERE ad = 'Sebzeler'), 'kg', 30.00, 'TL/kg', 'Karnabahar'),
  ('SBZ-0016', 'Brokoli', (SELECT id FROM urun_kategorileri WHERE ad = 'Sebzeler'), 'kg', 50.00, 'TL/kg', 'Brokoli'),
  ('SBZ-0017', 'Salatalık', (SELECT id FROM urun_kategorileri WHERE ad = 'Sebzeler'), 'kg', 40.00, 'TL/kg', 'Salatalık'),
  ('SBZ-0018', 'Marul', (SELECT id FROM urun_kategorileri WHERE ad = 'Sebzeler'), 'adet', 15.00, 'TL/adet', 'Marul'),
  ('SBZ-0019', 'Maydanoz', (SELECT id FROM urun_kategorileri WHERE ad = 'Sebzeler'), 'demet', 8.00, 'TL/demet', 'Maydanoz'),
  ('SBZ-0020', 'Dereotu', (SELECT id FROM urun_kategorileri WHERE ad = 'Sebzeler'), 'demet', 8.00, 'TL/demet', 'Dereotu'),
  ('SBZ-0021', 'Nane', (SELECT id FROM urun_kategorileri WHERE ad = 'Sebzeler'), 'demet', 10.00, 'TL/demet', 'Taze nane'),
  ('SBZ-0022', 'Roka', (SELECT id FROM urun_kategorileri WHERE ad = 'Sebzeler'), 'demet', 12.00, 'TL/demet', 'Roka'),
  ('SBZ-0023', 'Kereviz (Sap)', (SELECT id FROM urun_kategorileri WHERE ad = 'Sebzeler'), 'kg', 40.00, 'TL/kg', 'Sap kereviz'),
  ('SBZ-0024', 'Kereviz (Kök)', (SELECT id FROM urun_kategorileri WHERE ad = 'Sebzeler'), 'kg', 35.00, 'TL/kg', 'Kök kereviz'),
  ('SBZ-0025', 'Turp', (SELECT id FROM urun_kategorileri WHERE ad = 'Sebzeler'), 'demet', 15.00, 'TL/demet', 'Turp'),
  ('SBZ-0026', 'Pancar', (SELECT id FROM urun_kategorileri WHERE ad = 'Sebzeler'), 'kg', 25.00, 'TL/kg', 'Pancar'),
  ('SBZ-0027', 'Bezelye (Taze)', (SELECT id FROM urun_kategorileri WHERE ad = 'Sebzeler'), 'kg', 80.00, 'TL/kg', 'Taze bezelye'),
  ('SBZ-0028', 'Fasulye (Taze)', (SELECT id FROM urun_kategorileri WHERE ad = 'Sebzeler'), 'kg', 70.00, 'TL/kg', 'Taze fasulye'),
  ('SBZ-0029', 'Enginar', (SELECT id FROM urun_kategorileri WHERE ad = 'Sebzeler'), 'adet', 25.00, 'TL/adet', 'Enginar'),
  ('SBZ-0030', 'Mantar (Kültür)', (SELECT id FROM urun_kategorileri WHERE ad = 'Sebzeler'), 'kg', 90.00, 'TL/kg', 'Kültür mantarı')
ON CONFLICT (kod) DO UPDATE SET 
  manuel_fiyat = EXCLUDED.manuel_fiyat,
  aciklama = EXCLUDED.aciklama;

-- =====================================================
-- 5. MEYVELER
-- =====================================================
INSERT INTO urun_kartlari (kod, ad, kategori_id, varsayilan_birim, manuel_fiyat, fiyat_birimi, aciklama) VALUES
  ('MYV-0001', 'Elma (Starking)', (SELECT id FROM urun_kategorileri WHERE ad = 'Meyveler'), 'kg', 45.00, 'TL/kg', 'Starking elma'),
  ('MYV-0002', 'Elma (Granny Smith)', (SELECT id FROM urun_kategorileri WHERE ad = 'Meyveler'), 'kg', 50.00, 'TL/kg', 'Yeşil elma'),
  ('MYV-0003', 'Portakal', (SELECT id FROM urun_kategorileri WHERE ad = 'Meyveler'), 'kg', 35.00, 'TL/kg', 'Portakal'),
  ('MYV-0004', 'Mandalina', (SELECT id FROM urun_kategorileri WHERE ad = 'Meyveler'), 'kg', 40.00, 'TL/kg', 'Mandalina'),
  ('MYV-0005', 'Limon', (SELECT id FROM urun_kategorileri WHERE ad = 'Meyveler'), 'kg', 45.00, 'TL/kg', 'Limon'),
  ('MYV-0006', 'Muz', (SELECT id FROM urun_kategorileri WHERE ad = 'Meyveler'), 'kg', 85.00, 'TL/kg', 'Muz'),
  ('MYV-0007', 'Nar', (SELECT id FROM urun_kategorileri WHERE ad = 'Meyveler'), 'kg', 50.00, 'TL/kg', 'Nar'),
  ('MYV-0008', 'Kivi', (SELECT id FROM urun_kategorileri WHERE ad = 'Meyveler'), 'kg', 70.00, 'TL/kg', 'Kivi'),
  ('MYV-0009', 'Üzüm', (SELECT id FROM urun_kategorileri WHERE ad = 'Meyveler'), 'kg', 60.00, 'TL/kg', 'Üzüm'),
  ('MYV-0010', 'Armut', (SELECT id FROM urun_kategorileri WHERE ad = 'Meyveler'), 'kg', 55.00, 'TL/kg', 'Armut'),
  ('MYV-0011', 'Avokado', (SELECT id FROM urun_kategorileri WHERE ad = 'Meyveler'), 'adet', 35.00, 'TL/adet', 'Avokado'),
  ('MYV-0012', 'Greyfurt', (SELECT id FROM urun_kategorileri WHERE ad = 'Meyveler'), 'kg', 40.00, 'TL/kg', 'Greyfurt')
ON CONFLICT (kod) DO UPDATE SET 
  manuel_fiyat = EXCLUDED.manuel_fiyat,
  aciklama = EXCLUDED.aciklama;

-- =====================================================
-- 6. BAKLİYAT
-- =====================================================
INSERT INTO urun_kartlari (kod, ad, kategori_id, varsayilan_birim, manuel_fiyat, fiyat_birimi, aciklama) VALUES
  ('BKL-0001', 'Kuru Fasulye (Dermason)', (SELECT id FROM urun_kategorileri WHERE ad = 'Bakliyat'), 'kg', 95.00, 'TL/kg', 'Dermason kuru fasulye'),
  ('BKL-0002', 'Kuru Fasulye (Şeker)', (SELECT id FROM urun_kategorileri WHERE ad = 'Bakliyat'), 'kg', 110.00, 'TL/kg', 'Şeker fasulye'),
  ('BKL-0003', 'Kuru Fasulye (İspir)', (SELECT id FROM urun_kategorileri WHERE ad = 'Bakliyat'), 'kg', 180.00, 'TL/kg', 'İspir fasulyesi'),
  ('BKL-0004', 'Nohut', (SELECT id FROM urun_kategorileri WHERE ad = 'Bakliyat'), 'kg', 75.00, 'TL/kg', 'Nohut'),
  ('BKL-0005', 'Kırmızı Mercimek', (SELECT id FROM urun_kategorileri WHERE ad = 'Bakliyat'), 'kg', 65.00, 'TL/kg', 'Kırmızı mercimek'),
  ('BKL-0006', 'Yeşil Mercimek', (SELECT id FROM urun_kategorileri WHERE ad = 'Bakliyat'), 'kg', 70.00, 'TL/kg', 'Yeşil mercimek'),
  ('BKL-0007', 'Barbunya', (SELECT id FROM urun_kategorileri WHERE ad = 'Bakliyat'), 'kg', 120.00, 'TL/kg', 'Barbunya'),
  ('BKL-0008', 'Börülce', (SELECT id FROM urun_kategorileri WHERE ad = 'Bakliyat'), 'kg', 90.00, 'TL/kg', 'Börülce'),
  ('BKL-0009', 'Kuru Bakla', (SELECT id FROM urun_kategorileri WHERE ad = 'Bakliyat'), 'kg', 80.00, 'TL/kg', 'Kuru bakla'),
  ('BKL-0010', 'Bezelye (Kuru)', (SELECT id FROM urun_kategorileri WHERE ad = 'Bakliyat'), 'kg', 85.00, 'TL/kg', 'Kuru bezelye')
ON CONFLICT (kod) DO UPDATE SET 
  manuel_fiyat = EXCLUDED.manuel_fiyat,
  aciklama = EXCLUDED.aciklama;

-- =====================================================
-- 7. TAHILLAR & MAKARNA
-- =====================================================
INSERT INTO urun_kartlari (kod, ad, kategori_id, varsayilan_birim, manuel_fiyat, fiyat_birimi, aciklama) VALUES
  ('THL-0001', 'Pirinç (Baldo)', (SELECT id FROM urun_kategorileri WHERE ad = 'Tahıllar & Makarna'), 'kg', 75.00, 'TL/kg', 'Baldo pirinç'),
  ('THL-0002', 'Pirinç (Osmancık)', (SELECT id FROM urun_kategorileri WHERE ad = 'Tahıllar & Makarna'), 'kg', 55.00, 'TL/kg', 'Osmancık pirinç'),
  ('THL-0003', 'Pirinç (Basmati)', (SELECT id FROM urun_kategorileri WHERE ad = 'Tahıllar & Makarna'), 'kg', 95.00, 'TL/kg', 'Basmati pirinç'),
  ('THL-0004', 'Bulgur (Pilavlık)', (SELECT id FROM urun_kategorileri WHERE ad = 'Tahıllar & Makarna'), 'kg', 45.00, 'TL/kg', 'Pilavlık bulgur'),
  ('THL-0005', 'Bulgur (Köftelik)', (SELECT id FROM urun_kategorileri WHERE ad = 'Tahıllar & Makarna'), 'kg', 48.00, 'TL/kg', 'Köftelik ince bulgur'),
  ('THL-0006', 'Un (Ekmeklik)', (SELECT id FROM urun_kategorileri WHERE ad = 'Tahıllar & Makarna'), 'kg', 28.00, 'TL/kg', 'Ekmeklik un'),
  ('THL-0007', 'Un (Pasta)', (SELECT id FROM urun_kategorileri WHERE ad = 'Tahıllar & Makarna'), 'kg', 32.00, 'TL/kg', 'Pasta unu'),
  ('THL-0008', 'Makarna (Spagetti)', (SELECT id FROM urun_kategorileri WHERE ad = 'Tahıllar & Makarna'), 'kg', 35.00, 'TL/kg', 'Spagetti makarna'),
  ('THL-0009', 'Makarna (Penne)', (SELECT id FROM urun_kategorileri WHERE ad = 'Tahıllar & Makarna'), 'kg', 35.00, 'TL/kg', 'Penne makarna'),
  ('THL-0010', 'Makarna (Kelebek)', (SELECT id FROM urun_kategorileri WHERE ad = 'Tahıllar & Makarna'), 'kg', 36.00, 'TL/kg', 'Kelebek makarna'),
  ('THL-0011', 'Makarna (Arpa Şehriye)', (SELECT id FROM urun_kategorileri WHERE ad = 'Tahıllar & Makarna'), 'kg', 38.00, 'TL/kg', 'Arpa şehriye'),
  ('THL-0012', 'Makarna (Tel Şehriye)', (SELECT id FROM urun_kategorileri WHERE ad = 'Tahıllar & Makarna'), 'kg', 38.00, 'TL/kg', 'Tel şehriye'),
  ('THL-0013', 'İrmik', (SELECT id FROM urun_kategorileri WHERE ad = 'Tahıllar & Makarna'), 'kg', 35.00, 'TL/kg', 'İrmik'),
  ('THL-0014', 'Nişasta', (SELECT id FROM urun_kategorileri WHERE ad = 'Tahıllar & Makarna'), 'kg', 40.00, 'TL/kg', 'Mısır nişastası'),
  ('THL-0015', 'Galeta Unu', (SELECT id FROM urun_kategorileri WHERE ad = 'Tahıllar & Makarna'), 'kg', 45.00, 'TL/kg', 'Galeta unu'),
  ('THL-0016', 'Yulaf Ezmesi', (SELECT id FROM urun_kategorileri WHERE ad = 'Tahıllar & Makarna'), 'kg', 80.00, 'TL/kg', 'Yulaf ezmesi')
ON CONFLICT (kod) DO UPDATE SET 
  manuel_fiyat = EXCLUDED.manuel_fiyat,
  aciklama = EXCLUDED.aciklama;

-- =====================================================
-- 8. YAĞLAR
-- =====================================================
INSERT INTO urun_kartlari (kod, ad, kategori_id, varsayilan_birim, manuel_fiyat, fiyat_birimi, aciklama) VALUES
  ('YAG-0001', 'Ayçiçek Yağı', (SELECT id FROM urun_kategorileri WHERE ad = 'Yağlar'), 'lt', 70.00, 'TL/lt', 'Ayçiçek yağı'),
  ('YAG-0002', 'Zeytinyağı (Riviera)', (SELECT id FROM urun_kategorileri WHERE ad = 'Yağlar'), 'lt', 200.00, 'TL/lt', 'Riviera zeytinyağı'),
  ('YAG-0003', 'Zeytinyağı (Sızma)', (SELECT id FROM urun_kategorileri WHERE ad = 'Yağlar'), 'lt', 350.00, 'TL/lt', 'Sızma zeytinyağı'),
  ('YAG-0004', 'Mısırözü Yağı', (SELECT id FROM urun_kategorileri WHERE ad = 'Yağlar'), 'lt', 85.00, 'TL/lt', 'Mısırözü yağı'),
  ('YAG-0005', 'Kanola Yağı', (SELECT id FROM urun_kategorileri WHERE ad = 'Yağlar'), 'lt', 75.00, 'TL/lt', 'Kanola yağı'),
  ('YAG-0006', 'Fındık Yağı', (SELECT id FROM urun_kategorileri WHERE ad = 'Yağlar'), 'lt', 280.00, 'TL/lt', 'Fındık yağı'),
  ('YAG-0007', 'Susam Yağı', (SELECT id FROM urun_kategorileri WHERE ad = 'Yağlar'), 'lt', 350.00, 'TL/lt', 'Susam yağı'),
  ('YAG-0008', 'Margarin (Paket)', (SELECT id FROM urun_kategorileri WHERE ad = 'Yağlar'), 'kg', 120.00, 'TL/kg', 'Paket margarin'),
  ('YAG-0009', 'Margarin (Kova)', (SELECT id FROM urun_kategorileri WHERE ad = 'Yağlar'), 'kg', 100.00, 'TL/kg', 'Kova margarin'),
  ('YAG-0010', 'Kızartma Yağı', (SELECT id FROM urun_kategorileri WHERE ad = 'Yağlar'), 'lt', 65.00, 'TL/lt', 'Kızartmalık yağ')
ON CONFLICT (kod) DO UPDATE SET 
  manuel_fiyat = EXCLUDED.manuel_fiyat,
  aciklama = EXCLUDED.aciklama;

-- =====================================================
-- 9. BAHARATLAR
-- =====================================================
INSERT INTO urun_kartlari (kod, ad, kategori_id, varsayilan_birim, manuel_fiyat, fiyat_birimi, aciklama) VALUES
  ('BHR-0001', 'Tuz (İyotlu)', (SELECT id FROM urun_kategorileri WHERE ad = 'Baharatlar'), 'kg', 12.00, 'TL/kg', 'İyotlu sofra tuzu'),
  ('BHR-0002', 'Tuz (Kaya)', (SELECT id FROM urun_kategorileri WHERE ad = 'Baharatlar'), 'kg', 25.00, 'TL/kg', 'Kaya tuzu'),
  ('BHR-0003', 'Karabiber (Toz)', (SELECT id FROM urun_kategorileri WHERE ad = 'Baharatlar'), 'kg', 350.00, 'TL/kg', 'Toz karabiber'),
  ('BHR-0004', 'Karabiber (Tane)', (SELECT id FROM urun_kategorileri WHERE ad = 'Baharatlar'), 'kg', 400.00, 'TL/kg', 'Tane karabiber'),
  ('BHR-0005', 'Kırmızı Biber (Pul)', (SELECT id FROM urun_kategorileri WHERE ad = 'Baharatlar'), 'kg', 280.00, 'TL/kg', 'Pul biber'),
  ('BHR-0006', 'Kırmızı Biber (Tatlı)', (SELECT id FROM urun_kategorileri WHERE ad = 'Baharatlar'), 'kg', 250.00, 'TL/kg', 'Tatlı kırmızı toz biber'),
  ('BHR-0007', 'Kimyon', (SELECT id FROM urun_kategorileri WHERE ad = 'Baharatlar'), 'kg', 320.00, 'TL/kg', 'Kimyon'),
  ('BHR-0008', 'Kekik', (SELECT id FROM urun_kategorileri WHERE ad = 'Baharatlar'), 'kg', 180.00, 'TL/kg', 'Kekik'),
  ('BHR-0009', 'Nane (Kuru)', (SELECT id FROM urun_kategorileri WHERE ad = 'Baharatlar'), 'kg', 200.00, 'TL/kg', 'Kuru nane'),
  ('BHR-0010', 'Sumak', (SELECT id FROM urun_kategorileri WHERE ad = 'Baharatlar'), 'kg', 220.00, 'TL/kg', 'Sumak'),
  ('BHR-0011', 'Zerdeçal', (SELECT id FROM urun_kategorileri WHERE ad = 'Baharatlar'), 'kg', 280.00, 'TL/kg', 'Zerdeçal'),
  ('BHR-0012', 'Tarçın (Toz)', (SELECT id FROM urun_kategorileri WHERE ad = 'Baharatlar'), 'kg', 350.00, 'TL/kg', 'Toz tarçın'),
  ('BHR-0013', 'Karanfil', (SELECT id FROM urun_kategorileri WHERE ad = 'Baharatlar'), 'kg', 600.00, 'TL/kg', 'Karanfil'),
  ('BHR-0014', 'Defne Yaprağı', (SELECT id FROM urun_kategorileri WHERE ad = 'Baharatlar'), 'kg', 250.00, 'TL/kg', 'Defne yaprağı'),
  ('BHR-0015', 'Köri', (SELECT id FROM urun_kategorileri WHERE ad = 'Baharatlar'), 'kg', 280.00, 'TL/kg', 'Köri'),
  ('BHR-0016', 'Biberiye', (SELECT id FROM urun_kategorileri WHERE ad = 'Baharatlar'), 'kg', 220.00, 'TL/kg', 'Biberiye'),
  ('BHR-0017', 'Çörek Otu', (SELECT id FROM urun_kategorileri WHERE ad = 'Baharatlar'), 'kg', 180.00, 'TL/kg', 'Çörek otu'),
  ('BHR-0018', 'Susam', (SELECT id FROM urun_kategorileri WHERE ad = 'Baharatlar'), 'kg', 150.00, 'TL/kg', 'Susam')
ON CONFLICT (kod) DO UPDATE SET 
  manuel_fiyat = EXCLUDED.manuel_fiyat,
  aciklama = EXCLUDED.aciklama;

-- =====================================================
-- 10. SOSLAR & SALÇALAR
-- =====================================================
INSERT INTO urun_kartlari (kod, ad, kategori_id, varsayilan_birim, manuel_fiyat, fiyat_birimi, aciklama) VALUES
  ('SOS-0001', 'Domates Salçası', (SELECT id FROM urun_kategorileri WHERE ad = 'Soslar & Salçalar'), 'kg', 95.00, 'TL/kg', 'Domates salçası'),
  ('SOS-0002', 'Biber Salçası (Tatlı)', (SELECT id FROM urun_kategorileri WHERE ad = 'Soslar & Salçalar'), 'kg', 110.00, 'TL/kg', 'Tatlı biber salçası'),
  ('SOS-0003', 'Biber Salçası (Acı)', (SELECT id FROM urun_kategorileri WHERE ad = 'Soslar & Salçalar'), 'kg', 115.00, 'TL/kg', 'Acı biber salçası'),
  ('SOS-0004', 'Ketçap', (SELECT id FROM urun_kategorileri WHERE ad = 'Soslar & Salçalar'), 'kg', 85.00, 'TL/kg', 'Ketçap'),
  ('SOS-0005', 'Mayonez', (SELECT id FROM urun_kategorileri WHERE ad = 'Soslar & Salçalar'), 'kg', 110.00, 'TL/kg', 'Mayonez'),
  ('SOS-0006', 'Hardal', (SELECT id FROM urun_kategorileri WHERE ad = 'Soslar & Salçalar'), 'kg', 150.00, 'TL/kg', 'Hardal'),
  ('SOS-0007', 'Sirke (Üzüm)', (SELECT id FROM urun_kategorileri WHERE ad = 'Soslar & Salçalar'), 'lt', 45.00, 'TL/lt', 'Üzüm sirkesi'),
  ('SOS-0008', 'Sirke (Elma)', (SELECT id FROM urun_kategorileri WHERE ad = 'Soslar & Salçalar'), 'lt', 65.00, 'TL/lt', 'Elma sirkesi'),
  ('SOS-0009', 'Nar Ekşisi', (SELECT id FROM urun_kategorileri WHERE ad = 'Soslar & Salçalar'), 'lt', 180.00, 'TL/lt', 'Nar ekşisi'),
  ('SOS-0010', 'Limon Sosu', (SELECT id FROM urun_kategorileri WHERE ad = 'Soslar & Salçalar'), 'lt', 55.00, 'TL/lt', 'Limon sosu'),
  ('SOS-0011', 'Soya Sosu', (SELECT id FROM urun_kategorileri WHERE ad = 'Soslar & Salçalar'), 'lt', 120.00, 'TL/lt', 'Soya sosu'),
  ('SOS-0012', 'Teriyaki Sos', (SELECT id FROM urun_kategorileri WHERE ad = 'Soslar & Salçalar'), 'lt', 150.00, 'TL/lt', 'Teriyaki sos'),
  ('SOS-0013', 'Barbekü Sos', (SELECT id FROM urun_kategorileri WHERE ad = 'Soslar & Salçalar'), 'lt', 130.00, 'TL/lt', 'Barbekü sos')
ON CONFLICT (kod) DO UPDATE SET 
  manuel_fiyat = EXCLUDED.manuel_fiyat,
  aciklama = EXCLUDED.aciklama;

-- =====================================================
-- 11. ŞEKERLER & TATLANDIRICILAR
-- =====================================================
INSERT INTO urun_kartlari (kod, ad, kategori_id, varsayilan_birim, manuel_fiyat, fiyat_birimi, aciklama) VALUES
  ('SKR-0001', 'Toz Şeker', (SELECT id FROM urun_kategorileri WHERE ad = 'Şekerler & Tatlandırıcılar'), 'kg', 38.00, 'TL/kg', 'Toz şeker'),
  ('SKR-0002', 'Küp Şeker', (SELECT id FROM urun_kategorileri WHERE ad = 'Şekerler & Tatlandırıcılar'), 'kg', 45.00, 'TL/kg', 'Küp şeker'),
  ('SKR-0003', 'Esmer Şeker', (SELECT id FROM urun_kategorileri WHERE ad = 'Şekerler & Tatlandırıcılar'), 'kg', 55.00, 'TL/kg', 'Esmer şeker'),
  ('SKR-0004', 'Pudra Şekeri', (SELECT id FROM urun_kategorileri WHERE ad = 'Şekerler & Tatlandırıcılar'), 'kg', 50.00, 'TL/kg', 'Pudra şekeri'),
  ('SKR-0005', 'Bal (Süzme)', (SELECT id FROM urun_kategorileri WHERE ad = 'Şekerler & Tatlandırıcılar'), 'kg', 450.00, 'TL/kg', 'Süzme bal'),
  ('SKR-0006', 'Pekmez (Üzüm)', (SELECT id FROM urun_kategorileri WHERE ad = 'Şekerler & Tatlandırıcılar'), 'kg', 150.00, 'TL/kg', 'Üzüm pekmezi'),
  ('SKR-0007', 'Pekmez (Dut)', (SELECT id FROM urun_kategorileri WHERE ad = 'Şekerler & Tatlandırıcılar'), 'kg', 180.00, 'TL/kg', 'Dut pekmezi'),
  ('SKR-0008', 'Reçel (Vişne)', (SELECT id FROM urun_kategorileri WHERE ad = 'Şekerler & Tatlandırıcılar'), 'kg', 120.00, 'TL/kg', 'Vişne reçeli'),
  ('SKR-0009', 'Reçel (Çilek)', (SELECT id FROM urun_kategorileri WHERE ad = 'Şekerler & Tatlandırıcılar'), 'kg', 130.00, 'TL/kg', 'Çilek reçeli'),
  ('SKR-0010', 'Reçel (Kayısı)', (SELECT id FROM urun_kategorileri WHERE ad = 'Şekerler & Tatlandırıcılar'), 'kg', 125.00, 'TL/kg', 'Kayısı reçeli')
ON CONFLICT (kod) DO UPDATE SET 
  manuel_fiyat = EXCLUDED.manuel_fiyat,
  aciklama = EXCLUDED.aciklama;

-- =====================================================
-- 12. İÇECEKLER
-- =====================================================
INSERT INTO urun_kartlari (kod, ad, kategori_id, varsayilan_birim, manuel_fiyat, fiyat_birimi, aciklama) VALUES
  ('ICK-0001', 'Su (Pet 0.5lt)', (SELECT id FROM urun_kategorileri WHERE ad = 'İçecekler'), 'adet', 8.00, 'TL/adet', '0.5 litre pet su'),
  ('ICK-0002', 'Su (Pet 1.5lt)', (SELECT id FROM urun_kategorileri WHERE ad = 'İçecekler'), 'adet', 12.00, 'TL/adet', '1.5 litre pet su'),
  ('ICK-0003', 'Su (Damacana 19lt)', (SELECT id FROM urun_kategorileri WHERE ad = 'İçecekler'), 'adet', 85.00, 'TL/adet', '19 litre damacana su'),
  ('ICK-0004', 'Çay (Siyah)', (SELECT id FROM urun_kategorileri WHERE ad = 'İçecekler'), 'kg', 350.00, 'TL/kg', 'Siyah çay'),
  ('ICK-0005', 'Kahve (Türk)', (SELECT id FROM urun_kategorileri WHERE ad = 'İçecekler'), 'kg', 600.00, 'TL/kg', 'Türk kahvesi'),
  ('ICK-0006', 'Kahve (Filtre)', (SELECT id FROM urun_kategorileri WHERE ad = 'İçecekler'), 'kg', 500.00, 'TL/kg', 'Filtre kahve'),
  ('ICK-0007', 'Meyve Suyu (1lt)', (SELECT id FROM urun_kategorileri WHERE ad = 'İçecekler'), 'lt', 45.00, 'TL/lt', 'Meyve suyu'),
  ('ICK-0008', 'Kola (2.5lt)', (SELECT id FROM urun_kategorileri WHERE ad = 'İçecekler'), 'adet', 55.00, 'TL/adet', 'Kola 2.5 litre'),
  ('ICK-0009', 'Soda (200ml)', (SELECT id FROM urun_kategorileri WHERE ad = 'İçecekler'), 'adet', 8.00, 'TL/adet', 'Soda 200ml'),
  ('ICK-0010', 'Maden Suyu (200ml)', (SELECT id FROM urun_kategorileri WHERE ad = 'İçecekler'), 'adet', 10.00, 'TL/adet', 'Maden suyu 200ml')
ON CONFLICT (kod) DO UPDATE SET 
  manuel_fiyat = EXCLUDED.manuel_fiyat,
  aciklama = EXCLUDED.aciklama;

-- =====================================================
-- 13. YUMURTA
-- =====================================================
INSERT INTO urun_kartlari (kod, ad, kategori_id, varsayilan_birim, manuel_fiyat, fiyat_birimi, aciklama) VALUES
  ('YMT-0001', 'Yumurta (L)', (SELECT id FROM urun_kategorileri WHERE ad = 'Diğer'), 'adet', 6.50, 'TL/adet', 'L boy yumurta'),
  ('YMT-0002', 'Yumurta (M)', (SELECT id FROM urun_kategorileri WHERE ad = 'Diğer'), 'adet', 5.50, 'TL/adet', 'M boy yumurta'),
  ('YMT-0003', 'Yumurta (Organik)', (SELECT id FROM urun_kategorileri WHERE ad = 'Diğer'), 'adet', 12.00, 'TL/adet', 'Organik yumurta'),
  ('YMT-0004', 'Yumurta (Köy)', (SELECT id FROM urun_kategorileri WHERE ad = 'Diğer'), 'adet', 10.00, 'TL/adet', 'Köy yumurtası')
ON CONFLICT (kod) DO UPDATE SET 
  manuel_fiyat = EXCLUDED.manuel_fiyat,
  aciklama = EXCLUDED.aciklama;

-- =====================================================
-- 14. ŞARKÜTERI (Yeni kategori)
-- =====================================================
INSERT INTO urun_kartlari (kod, ad, kategori_id, varsayilan_birim, manuel_fiyat, fiyat_birimi, aciklama) VALUES
  ('SRK-0001', 'Sucuk (Dana)', (SELECT id FROM urun_kategorileri WHERE ad = 'Şarküteri'), 'kg', 450.00, 'TL/kg', 'Dana sucuk'),
  ('SRK-0002', 'Salam', (SELECT id FROM urun_kategorileri WHERE ad = 'Şarküteri'), 'kg', 280.00, 'TL/kg', 'Salam'),
  ('SRK-0003', 'Sosis (Tavuk)', (SELECT id FROM urun_kategorileri WHERE ad = 'Şarküteri'), 'kg', 180.00, 'TL/kg', 'Tavuk sosis'),
  ('SRK-0004', 'Sosis (Dana)', (SELECT id FROM urun_kategorileri WHERE ad = 'Şarküteri'), 'kg', 220.00, 'TL/kg', 'Dana sosis'),
  ('SRK-0005', 'Pastırma', (SELECT id FROM urun_kategorileri WHERE ad = 'Şarküteri'), 'kg', 850.00, 'TL/kg', 'Pastırma'),
  ('SRK-0006', 'Kavurma', (SELECT id FROM urun_kategorileri WHERE ad = 'Şarküteri'), 'kg', 750.00, 'TL/kg', 'Kavurma'),
  ('SRK-0007', 'Jambon', (SELECT id FROM urun_kategorileri WHERE ad = 'Şarküteri'), 'kg', 350.00, 'TL/kg', 'Jambon')
ON CONFLICT (kod) DO UPDATE SET 
  manuel_fiyat = EXCLUDED.manuel_fiyat,
  aciklama = EXCLUDED.aciklama;

-- =====================================================
-- 15. KAHVALTILIK (Yeni kategori)
-- =====================================================
INSERT INTO urun_kartlari (kod, ad, kategori_id, varsayilan_birim, manuel_fiyat, fiyat_birimi, aciklama) VALUES
  ('KHV-0001', 'Zeytin (Siyah)', (SELECT id FROM urun_kategorileri WHERE ad = 'Kahvaltılık'), 'kg', 180.00, 'TL/kg', 'Siyah zeytin'),
  ('KHV-0002', 'Zeytin (Yeşil)', (SELECT id FROM urun_kategorileri WHERE ad = 'Kahvaltılık'), 'kg', 160.00, 'TL/kg', 'Yeşil zeytin'),
  ('KHV-0003', 'Tahin', (SELECT id FROM urun_kategorileri WHERE ad = 'Kahvaltılık'), 'kg', 220.00, 'TL/kg', 'Tahin'),
  ('KHV-0004', 'Helva', (SELECT id FROM urun_kategorileri WHERE ad = 'Kahvaltılık'), 'kg', 180.00, 'TL/kg', 'Tahin helva'),
  ('KHV-0005', 'Çikolatalı Fındık Kreması', (SELECT id FROM urun_kategorileri WHERE ad = 'Kahvaltılık'), 'kg', 250.00, 'TL/kg', 'Çikolatalı fındık kreması')
ON CONFLICT (kod) DO UPDATE SET 
  manuel_fiyat = EXCLUDED.manuel_fiyat,
  aciklama = EXCLUDED.aciklama;

-- =====================================================
-- GIDA DIŞI - TEMİZLİK MALZEMELERİ
-- =====================================================
INSERT INTO urun_kartlari (kod, ad, kategori_id, varsayilan_birim, manuel_fiyat, fiyat_birimi, aciklama) VALUES
  ('TMZ-0001', 'Bulaşık Deterjanı (Sıvı)', (SELECT id FROM urun_kategorileri WHERE ad = 'Temizlik Malzemeleri'), 'lt', 55.00, 'TL/lt', 'Elde yıkama bulaşık deterjanı'),
  ('TMZ-0002', 'Bulaşık Makinesi Tableti', (SELECT id FROM urun_kategorileri WHERE ad = 'Temizlik Malzemeleri'), 'adet', 8.00, 'TL/adet', 'Bulaşık makinesi tableti'),
  ('TMZ-0003', 'Çamaşır Deterjanı (Toz)', (SELECT id FROM urun_kategorileri WHERE ad = 'Temizlik Malzemeleri'), 'kg', 55.00, 'TL/kg', 'Toz çamaşır deterjanı'),
  ('TMZ-0004', 'Çamaşır Deterjanı (Sıvı)', (SELECT id FROM urun_kategorileri WHERE ad = 'Temizlik Malzemeleri'), 'lt', 65.00, 'TL/lt', 'Sıvı çamaşır deterjanı'),
  ('TMZ-0005', 'Çamaşır Suyu', (SELECT id FROM urun_kategorileri WHERE ad = 'Temizlik Malzemeleri'), 'lt', 30.00, 'TL/lt', 'Çamaşır suyu'),
  ('TMZ-0006', 'Yumuşatıcı', (SELECT id FROM urun_kategorileri WHERE ad = 'Temizlik Malzemeleri'), 'lt', 45.00, 'TL/lt', 'Çamaşır yumuşatıcı'),
  ('TMZ-0007', 'Yüzey Temizleyici', (SELECT id FROM urun_kategorileri WHERE ad = 'Temizlik Malzemeleri'), 'lt', 40.00, 'TL/lt', 'Çok amaçlı yüzey temizleyici'),
  ('TMZ-0008', 'Cam Temizleyici', (SELECT id FROM urun_kategorileri WHERE ad = 'Temizlik Malzemeleri'), 'lt', 45.00, 'TL/lt', 'Cam temizleyici'),
  ('TMZ-0009', 'Yağ Çözücü', (SELECT id FROM urun_kategorileri WHERE ad = 'Temizlik Malzemeleri'), 'lt', 60.00, 'TL/lt', 'Mutfak yağ çözücü'),
  ('TMZ-0010', 'Kireç Çözücü', (SELECT id FROM urun_kategorileri WHERE ad = 'Temizlik Malzemeleri'), 'lt', 55.00, 'TL/lt', 'Kireç çözücü'),
  ('TMZ-0011', 'WC Temizleyici', (SELECT id FROM urun_kategorileri WHERE ad = 'Temizlik Malzemeleri'), 'lt', 35.00, 'TL/lt', 'WC temizleyici'),
  ('TMZ-0012', 'Yer Temizleyici', (SELECT id FROM urun_kategorileri WHERE ad = 'Temizlik Malzemeleri'), 'lt', 35.00, 'TL/lt', 'Yer silme deterjanı')
ON CONFLICT (kod) DO UPDATE SET 
  manuel_fiyat = EXCLUDED.manuel_fiyat,
  aciklama = EXCLUDED.aciklama;

-- =====================================================
-- GIDA DIŞI - HİJYEN ÜRÜNLERİ
-- =====================================================
INSERT INTO urun_kartlari (kod, ad, kategori_id, varsayilan_birim, manuel_fiyat, fiyat_birimi, aciklama) VALUES
  ('HJN-0001', 'Sıvı Sabun', (SELECT id FROM urun_kategorileri WHERE ad = 'Hijyen Ürünleri'), 'lt', 60.00, 'TL/lt', 'Sıvı el sabunu'),
  ('HJN-0002', 'Dezenfektan (Yüzey)', (SELECT id FROM urun_kategorileri WHERE ad = 'Hijyen Ürünleri'), 'lt', 80.00, 'TL/lt', 'Yüzey dezenfektanı'),
  ('HJN-0003', 'El Antiseptiği', (SELECT id FROM urun_kategorileri WHERE ad = 'Hijyen Ürünleri'), 'lt', 120.00, 'TL/lt', 'Alkol bazlı el dezenfektanı'),
  ('HJN-0004', 'Kolonya', (SELECT id FROM urun_kategorileri WHERE ad = 'Hijyen Ürünleri'), 'lt', 150.00, 'TL/lt', '80 derece kolonya'),
  ('HJN-0005', 'Kağıt Havlu (Rulo)', (SELECT id FROM urun_kategorileri WHERE ad = 'Hijyen Ürünleri'), 'rulo', 35.00, 'TL/rulo', 'Jumbo rulo kağıt havlu'),
  ('HJN-0006', 'Tuvalet Kağıdı', (SELECT id FROM urun_kategorileri WHERE ad = 'Hijyen Ürünleri'), 'rulo', 12.00, 'TL/rulo', 'Tuvalet kağıdı'),
  ('HJN-0007', 'Peçete', (SELECT id FROM urun_kategorileri WHERE ad = 'Hijyen Ürünleri'), 'paket', 25.00, 'TL/paket', 'Peçete (100 adet)')
ON CONFLICT (kod) DO UPDATE SET 
  manuel_fiyat = EXCLUDED.manuel_fiyat,
  aciklama = EXCLUDED.aciklama;

-- =====================================================
-- GIDA DIŞI - ÇÖP & ATIK
-- =====================================================
INSERT INTO urun_kartlari (kod, ad, kategori_id, varsayilan_birim, manuel_fiyat, fiyat_birimi, aciklama) VALUES
  ('COP-0001', 'Çöp Poşeti (Orta)', (SELECT id FROM urun_kategorileri WHERE ad = 'Çöp & Atık'), 'rulo', 35.00, 'TL/rulo', 'Orta boy çöp poşeti (20 adet)'),
  ('COP-0002', 'Çöp Poşeti (Büyük)', (SELECT id FROM urun_kategorileri WHERE ad = 'Çöp & Atık'), 'rulo', 50.00, 'TL/rulo', 'Büyük boy çöp poşeti (10 adet)'),
  ('COP-0003', 'Çöp Poşeti (Jumbo)', (SELECT id FROM urun_kategorileri WHERE ad = 'Çöp & Atık'), 'rulo', 80.00, 'TL/rulo', 'Jumbo boy çöp poşeti (10 adet)'),
  ('COP-0004', 'Çöp Kovası (Pedallı)', (SELECT id FROM urun_kategorileri WHERE ad = 'Çöp & Atık'), 'adet', 350.00, 'TL/adet', 'Pedallı çöp kovası 30lt')
ON CONFLICT (kod) DO UPDATE SET 
  manuel_fiyat = EXCLUDED.manuel_fiyat,
  aciklama = EXCLUDED.aciklama;

-- =====================================================
-- GIDA DIŞI - AMBALAJ MALZEMELERİ
-- =====================================================
INSERT INTO urun_kartlari (kod, ad, kategori_id, varsayilan_birim, manuel_fiyat, fiyat_birimi, aciklama) VALUES
  ('AMB-0001', 'Streç Film', (SELECT id FROM urun_kategorileri WHERE ad = 'Ambalaj Malzemeleri'), 'rulo', 120.00, 'TL/rulo', 'Streç film 30cm'),
  ('AMB-0002', 'Alüminyum Folyo', (SELECT id FROM urun_kategorileri WHERE ad = 'Ambalaj Malzemeleri'), 'rulo', 150.00, 'TL/rulo', 'Alüminyum folyo 30cm'),
  ('AMB-0003', 'Pişirme Kağıdı', (SELECT id FROM urun_kategorileri WHERE ad = 'Ambalaj Malzemeleri'), 'rulo', 80.00, 'TL/rulo', 'Yağlı pişirme kağıdı'),
  ('AMB-0004', 'Vakum Poşeti (Küçük)', (SELECT id FROM urun_kategorileri WHERE ad = 'Ambalaj Malzemeleri'), 'paket', 45.00, 'TL/paket', 'Vakum poşeti 20x30 (50 adet)'),
  ('AMB-0005', 'Vakum Poşeti (Büyük)', (SELECT id FROM urun_kategorileri WHERE ad = 'Ambalaj Malzemeleri'), 'paket', 65.00, 'TL/paket', 'Vakum poşeti 30x40 (50 adet)'),
  ('AMB-0006', 'Buzdolabı Poşeti', (SELECT id FROM urun_kategorileri WHERE ad = 'Ambalaj Malzemeleri'), 'paket', 25.00, 'TL/paket', 'Kilitli buzdolabı poşeti (50 adet)'),
  ('AMB-0007', 'Gıda Ambalaj Poşeti', (SELECT id FROM urun_kategorileri WHERE ad = 'Ambalaj Malzemeleri'), 'kg', 85.00, 'TL/kg', 'Şeffaf gıda poşeti')
ON CONFLICT (kod) DO UPDATE SET 
  manuel_fiyat = EXCLUDED.manuel_fiyat,
  aciklama = EXCLUDED.aciklama;

-- =====================================================
-- GIDA DIŞI - TEK KULLANIMLIK
-- =====================================================
INSERT INTO urun_kartlari (kod, ad, kategori_id, varsayilan_birim, manuel_fiyat, fiyat_birimi, aciklama) VALUES
  ('TKK-0001', 'Köpük Tabak (Küçük)', (SELECT id FROM urun_kategorileri WHERE ad = 'Tek Kullanımlık'), 'paket', 45.00, 'TL/paket', 'Köpük tabak 50 adet'),
  ('TKK-0002', 'Köpük Tabak (Büyük)', (SELECT id FROM urun_kategorileri WHERE ad = 'Tek Kullanımlık'), 'paket', 65.00, 'TL/paket', 'Büyük köpük tabak 50 adet'),
  ('TKK-0003', 'Plastik Bardak', (SELECT id FROM urun_kategorileri WHERE ad = 'Tek Kullanımlık'), 'paket', 35.00, 'TL/paket', 'Plastik bardak 180cc (100 adet)'),
  ('TKK-0004', 'Kağıt Bardak', (SELECT id FROM urun_kategorileri WHERE ad = 'Tek Kullanımlık'), 'paket', 55.00, 'TL/paket', 'Kağıt bardak 200cc (50 adet)'),
  ('TKK-0005', 'Plastik Çatal', (SELECT id FROM urun_kategorileri WHERE ad = 'Tek Kullanımlık'), 'paket', 25.00, 'TL/paket', 'Plastik çatal (100 adet)'),
  ('TKK-0006', 'Plastik Kaşık', (SELECT id FROM urun_kategorileri WHERE ad = 'Tek Kullanımlık'), 'paket', 25.00, 'TL/paket', 'Plastik kaşık (100 adet)'),
  ('TKK-0007', 'Plastik Bıçak', (SELECT id FROM urun_kategorileri WHERE ad = 'Tek Kullanımlık'), 'paket', 25.00, 'TL/paket', 'Plastik bıçak (100 adet)'),
  ('TKK-0008', 'Pipet', (SELECT id FROM urun_kategorileri WHERE ad = 'Tek Kullanımlık'), 'paket', 20.00, 'TL/paket', 'Pipet (100 adet)'),
  ('TKK-0009', 'Karıştırıcı', (SELECT id FROM urun_kategorileri WHERE ad = 'Tek Kullanımlık'), 'paket', 15.00, 'TL/paket', 'Kahve karıştırıcı (100 adet)')
ON CONFLICT (kod) DO UPDATE SET 
  manuel_fiyat = EXCLUDED.manuel_fiyat,
  aciklama = EXCLUDED.aciklama;

-- =====================================================
-- GIDA DIŞI - PAKET SERVİS
-- =====================================================
INSERT INTO urun_kartlari (kod, ad, kategori_id, varsayilan_birim, manuel_fiyat, fiyat_birimi, aciklama) VALUES
  ('PKT-0001', 'Yemek Kutusu (Tek Gözlü)', (SELECT id FROM urun_kategorileri WHERE ad = 'Paket Servis'), 'adet', 4.50, 'TL/adet', 'Tek gözlü yemek kutusu'),
  ('PKT-0002', 'Yemek Kutusu (İki Gözlü)', (SELECT id FROM urun_kategorileri WHERE ad = 'Paket Servis'), 'adet', 6.00, 'TL/adet', 'İki gözlü yemek kutusu'),
  ('PKT-0003', 'Yemek Kutusu (Üç Gözlü)', (SELECT id FROM urun_kategorileri WHERE ad = 'Paket Servis'), 'adet', 7.50, 'TL/adet', 'Üç gözlü yemek kutusu'),
  ('PKT-0004', 'Salata Kabı (Yuvarlak)', (SELECT id FROM urun_kategorileri WHERE ad = 'Paket Servis'), 'adet', 3.50, 'TL/adet', 'Yuvarlak salata kabı'),
  ('PKT-0005', 'Çorba Kabı', (SELECT id FROM urun_kategorileri WHERE ad = 'Paket Servis'), 'adet', 3.00, 'TL/adet', 'Kapaklı çorba kabı'),
  ('PKT-0006', 'Sos Kabı (Küçük)', (SELECT id FROM urun_kategorileri WHERE ad = 'Paket Servis'), 'adet', 0.80, 'TL/adet', 'Küçük sos kabı'),
  ('PKT-0007', 'Taşıma Poşeti', (SELECT id FROM urun_kategorileri WHERE ad = 'Paket Servis'), 'adet', 1.50, 'TL/adet', 'Paket servis taşıma poşeti'),
  ('PKT-0008', 'Kraft Kağıt Torba', (SELECT id FROM urun_kategorileri WHERE ad = 'Paket Servis'), 'adet', 2.50, 'TL/adet', 'Kraft kağıt torba')
ON CONFLICT (kod) DO UPDATE SET 
  manuel_fiyat = EXCLUDED.manuel_fiyat,
  aciklama = EXCLUDED.aciklama;

-- =====================================================
-- GIDA DIŞI - İŞ GÜVENLİĞİ
-- =====================================================
INSERT INTO urun_kartlari (kod, ad, kategori_id, varsayilan_birim, manuel_fiyat, fiyat_birimi, aciklama) VALUES
  ('IGV-0001', 'Bone (Tek Kullanımlık)', (SELECT id FROM urun_kategorileri WHERE ad = 'İş Güvenliği'), 'paket', 45.00, 'TL/paket', 'Tek kullanımlık bone (100 adet)'),
  ('IGV-0002', 'Eldiven (Lateks)', (SELECT id FROM urun_kategorileri WHERE ad = 'İş Güvenliği'), 'kutu', 120.00, 'TL/kutu', 'Lateks eldiven (100 adet)'),
  ('IGV-0003', 'Eldiven (Nitril)', (SELECT id FROM urun_kategorileri WHERE ad = 'İş Güvenliği'), 'kutu', 150.00, 'TL/kutu', 'Nitril eldiven (100 adet)'),
  ('IGV-0004', 'Maske (Cerrahi)', (SELECT id FROM urun_kategorileri WHERE ad = 'İş Güvenliği'), 'kutu', 80.00, 'TL/kutu', 'Cerrahi maske (50 adet)'),
  ('IGV-0005', 'Ayak Koruyucu', (SELECT id FROM urun_kategorileri WHERE ad = 'İş Güvenliği'), 'paket', 55.00, 'TL/paket', 'Ayak koruyucu galoş (100 adet)'),
  ('IGV-0006', 'Fırın Eldiveni', (SELECT id FROM urun_kategorileri WHERE ad = 'İş Güvenliği'), 'çift', 85.00, 'TL/çift', 'Isıya dayanıklı fırın eldiveni')
ON CONFLICT (kod) DO UPDATE SET 
  manuel_fiyat = EXCLUDED.manuel_fiyat,
  aciklama = EXCLUDED.aciklama;

-- =====================================================
-- GIDA DIŞI - YAKIT & ENERJİ
-- =====================================================
INSERT INTO urun_kartlari (kod, ad, kategori_id, varsayilan_birim, manuel_fiyat, fiyat_birimi, aciklama) VALUES
  ('YKT-0001', 'Tüp Gaz (12kg)', (SELECT id FROM urun_kategorileri WHERE ad = 'Yakıt & Enerji'), 'adet', 850.00, 'TL/adet', 'LPG tüp 12kg'),
  ('YKT-0002', 'Tüp Gaz (Küçük)', (SELECT id FROM urun_kategorileri WHERE ad = 'Yakıt & Enerji'), 'adet', 450.00, 'TL/adet', 'Küçük boy tüp gaz'),
  ('YKT-0003', 'Mangal Kömürü', (SELECT id FROM urun_kategorileri WHERE ad = 'Yakıt & Enerji'), 'kg', 45.00, 'TL/kg', 'Mangal kömürü')
ON CONFLICT (kod) DO UPDATE SET 
  manuel_fiyat = EXCLUDED.manuel_fiyat,
  aciklama = EXCLUDED.aciklama;

-- =====================================================
-- GIDA DIŞI - OFİS MALZEMELERİ
-- =====================================================
INSERT INTO urun_kartlari (kod, ad, kategori_id, varsayilan_birim, manuel_fiyat, fiyat_birimi, aciklama) VALUES
  ('OFS-0001', 'A4 Kağıt', (SELECT id FROM urun_kategorileri WHERE ad = 'Ofis Malzemeleri'), 'paket', 250.00, 'TL/paket', 'A4 fotokopi kağıdı (500 yaprak)'),
  ('OFS-0002', 'Kalem (Tükenmez)', (SELECT id FROM urun_kategorileri WHERE ad = 'Ofis Malzemeleri'), 'adet', 8.00, 'TL/adet', 'Tükenmez kalem'),
  ('OFS-0003', 'Not Defteri', (SELECT id FROM urun_kategorileri WHERE ad = 'Ofis Malzemeleri'), 'adet', 25.00, 'TL/adet', 'Spiralli not defteri'),
  ('OFS-0004', 'Yazıcı Kartuşu', (SELECT id FROM urun_kategorileri WHERE ad = 'Ofis Malzemeleri'), 'adet', 650.00, 'TL/adet', 'Yazıcı kartuşu (siyah)'),
  ('OFS-0005', 'Zımba', (SELECT id FROM urun_kategorileri WHERE ad = 'Ofis Malzemeleri'), 'adet', 85.00, 'TL/adet', 'Zımba makinesi')
ON CONFLICT (kod) DO UPDATE SET 
  manuel_fiyat = EXCLUDED.manuel_fiyat,
  aciklama = EXCLUDED.aciklama;

-- Fonksiyonu temizle
DROP FUNCTION IF EXISTS get_kategori_id(TEXT);

-- Fiyat güncelleme tarihi ekle
UPDATE urun_kartlari 
SET fiyat_guncelleme_tarihi = NOW()
WHERE manuel_fiyat IS NOT NULL AND fiyat_guncelleme_tarihi IS NULL;

-- İstatistik view
CREATE OR REPLACE VIEW v_urun_kartlari_ozet AS
SELECT 
  uk.tur,
  uk.ad as kategori,
  COUNT(k.id) as urun_sayisi,
  ROUND(AVG(k.manuel_fiyat)::numeric, 2) as ortalama_fiyat,
  MIN(k.manuel_fiyat) as min_fiyat,
  MAX(k.manuel_fiyat) as max_fiyat
FROM urun_kategorileri uk
LEFT JOIN urun_kartlari k ON k.kategori_id = uk.id
WHERE uk.aktif = true
GROUP BY uk.tur, uk.ad, uk.sira
ORDER BY uk.tur, uk.sira;

COMMENT ON TABLE urun_kartlari IS 'Ürün kartları - Fiyatlar Ocak 2026 Türkiye toptan piyasa tahminleri';
