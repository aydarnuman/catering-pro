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
  ('ET-0014', 'Tavuk Göğüs (Bonfile)', (SELECT id FROM urun_kategorileri WHERE ad = 'Et & Tavuk'), 'kg', 200.00, 'TL/kg', 'Tavuk göğüs fileto'),
  ('ET-0015', 'Tavuk But', (SELECT id FROM urun_kategorileri WHERE ad = 'Et & Tavuk'), 'kg', 130.00, 'TL/kg', 'Tavuk but'),
  ('ET-0016', 'Tavuk Kanat', (SELECT id FROM urun_kategorileri WHERE ad = 'Et & Tavuk'), 'kg', 120.00, 'TL/kg', 'Tavuk kanat'),
  ('ET-0018', 'Bütün Piliç', (SELECT id FROM urun_kategorileri WHERE ad = 'Et & Tavuk'), 'kg', 105.00, 'TL/kg', 'Bütün piliç'),
  ('ET-0020', 'Hindi Göğüs', (SELECT id FROM urun_kategorileri WHERE ad = 'Et & Tavuk'), 'kg', 280.00, 'TL/kg', 'Hindi göğüs fileto')
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
  ('BLK-0008', 'Karides (Jumbo)', (SELECT id FROM urun_kategorileri WHERE ad = 'Balık & Deniz Ürünleri'), 'kg', 800.00, 'TL/kg', 'Jumbo karides'),
  ('BLK-0011', 'Alabalık', (SELECT id FROM urun_kategorileri WHERE ad = 'Balık & Deniz Ürünleri'), 'kg', 280.00, 'TL/kg', 'Taze alabalık')
ON CONFLICT (kod) DO UPDATE SET 
  manuel_fiyat = EXCLUDED.manuel_fiyat,
  aciklama = EXCLUDED.aciklama;

-- =====================================================
-- 3. SÜT ÜRÜNLERİ
-- =====================================================
INSERT INTO urun_kartlari (kod, ad, kategori_id, varsayilan_birim, manuel_fiyat, fiyat_birimi, aciklama) VALUES
  ('SUT-0001', 'Süt (Günlük)', (SELECT id FROM urun_kategorileri WHERE ad = 'Süt Ürünleri'), 'lt', 35.00, 'TL/lt', 'Günlük pastörize süt'),
  ('SUT-0003', 'Yoğurt (Kova)', (SELECT id FROM urun_kategorileri WHERE ad = 'Süt Ürünleri'), 'kg', 65.00, 'TL/kg', 'Kova yoğurt'),
  ('SUT-0005', 'Beyaz Peynir (Tam Yağlı)', (SELECT id FROM urun_kategorileri WHERE ad = 'Süt Ürünleri'), 'kg', 280.00, 'TL/kg', 'Tam yağlı beyaz peynir'),
  ('SUT-0006', 'Kaşar Peyniri (Taze)', (SELECT id FROM urun_kategorileri WHERE ad = 'Süt Ürünleri'), 'kg', 400.00, 'TL/kg', 'Taze kaşar peyniri'),
  ('SUT-0010', 'Tereyağı', (SELECT id FROM urun_kategorileri WHERE ad = 'Süt Ürünleri'), 'kg', 380.00, 'TL/kg', 'Tereyağı'),
  ('SUT-0011', 'Krema (Sıvı)', (SELECT id FROM urun_kategorileri WHERE ad = 'Süt Ürünleri'), 'lt', 180.00, 'TL/lt', 'Sıvı krema')
ON CONFLICT (kod) DO UPDATE SET 
  manuel_fiyat = EXCLUDED.manuel_fiyat,
  aciklama = EXCLUDED.aciklama;

-- =====================================================
-- 4. SEBZELER (Mevsimsel - Kış fiyatları)
-- =====================================================
INSERT INTO urun_kartlari (kod, ad, kategori_id, varsayilan_birim, manuel_fiyat, fiyat_birimi, aciklama) VALUES
  ('SBZ-0001', 'Domates', (SELECT id FROM urun_kategorileri WHERE ad = 'Sebzeler'), 'kg', 45.00, 'TL/kg', 'Domates'),
  ('SBZ-0002', 'Biber (Sivri)', (SELECT id FROM urun_kategorileri WHERE ad = 'Sebzeler'), 'kg', 55.00, 'TL/kg', 'Sivri biber'),
  ('SBZ-0004', 'Patlıcan', (SELECT id FROM urun_kategorileri WHERE ad = 'Sebzeler'), 'kg', 40.00, 'TL/kg', 'Patlıcan'),
  ('SBZ-0006', 'Soğan (Kuru)', (SELECT id FROM urun_kategorileri WHERE ad = 'Sebzeler'), 'kg', 25.00, 'TL/kg', 'Kuru soğan'),
  ('SBZ-0008', 'Sarımsak', (SELECT id FROM urun_kategorileri WHERE ad = 'Sebzeler'), 'kg', 120.00, 'TL/kg', 'Sarımsak'),
  ('SBZ-0009', 'Patates', (SELECT id FROM urun_kategorileri WHERE ad = 'Sebzeler'), 'kg', 28.00, 'TL/kg', 'Patates'),
  ('SBZ-0010', 'Havuç', (SELECT id FROM urun_kategorileri WHERE ad = 'Sebzeler'), 'kg', 25.00, 'TL/kg', 'Havuç'),
  ('SBZ-0011', 'Ispanak', (SELECT id FROM urun_kategorileri WHERE ad = 'Sebzeler'), 'kg', 55.00, 'TL/kg', 'Ispanak'),
  ('SBZ-0019', 'Maydanoz', (SELECT id FROM urun_kategorileri WHERE ad = 'Sebzeler'), 'demet', 8.00, 'TL/demet', 'Maydanoz'),
  ('SBZ-0030', 'Mantar (Kültür)', (SELECT id FROM urun_kategorileri WHERE ad = 'Sebzeler'), 'kg', 90.00, 'TL/kg', 'Kültür mantarı')
ON CONFLICT (kod) DO UPDATE SET 
  manuel_fiyat = EXCLUDED.manuel_fiyat,
  aciklama = EXCLUDED.aciklama;

-- =====================================================
-- 5. MEYVELER
-- =====================================================
INSERT INTO urun_kartlari (kod, ad, kategori_id, varsayilan_birim, manuel_fiyat, fiyat_birimi, aciklama) VALUES
  ('MYV-0001', 'Elma (Starking)', (SELECT id FROM urun_kategorileri WHERE ad = 'Meyveler'), 'kg', 45.00, 'TL/kg', 'Starking elma'),
  ('MYV-0003', 'Portakal', (SELECT id FROM urun_kategorileri WHERE ad = 'Meyveler'), 'kg', 35.00, 'TL/kg', 'Portakal'),
  ('MYV-0005', 'Limon', (SELECT id FROM urun_kategorileri WHERE ad = 'Meyveler'), 'kg', 45.00, 'TL/kg', 'Limon'),
  ('MYV-0006', 'Muz', (SELECT id FROM urun_kategorileri WHERE ad = 'Meyveler'), 'kg', 85.00, 'TL/kg', 'Muz')
ON CONFLICT (kod) DO UPDATE SET 
  manuel_fiyat = EXCLUDED.manuel_fiyat,
  aciklama = EXCLUDED.aciklama;

-- =====================================================
-- 6. BAKLİYAT
-- =====================================================
INSERT INTO urun_kartlari (kod, ad, kategori_id, varsayilan_birim, manuel_fiyat, fiyat_birimi, aciklama) VALUES
  ('BKL-0001', 'Kuru Fasulye (Dermason)', (SELECT id FROM urun_kategorileri WHERE ad = 'Bakliyat'), 'kg', 95.00, 'TL/kg', 'Dermason kuru fasulye'),
  ('BKL-0004', 'Nohut', (SELECT id FROM urun_kategorileri WHERE ad = 'Bakliyat'), 'kg', 75.00, 'TL/kg', 'Nohut'),
  ('BKL-0005', 'Kırmızı Mercimek', (SELECT id FROM urun_kategorileri WHERE ad = 'Bakliyat'), 'kg', 65.00, 'TL/kg', 'Kırmızı mercimek'),
  ('BKL-0006', 'Yeşil Mercimek', (SELECT id FROM urun_kategorileri WHERE ad = 'Bakliyat'), 'kg', 70.00, 'TL/kg', 'Yeşil mercimek')
ON CONFLICT (kod) DO UPDATE SET 
  manuel_fiyat = EXCLUDED.manuel_fiyat,
  aciklama = EXCLUDED.aciklama;

-- =====================================================
-- 7. TAHILLAR & MAKARNA
-- =====================================================
INSERT INTO urun_kartlari (kod, ad, kategori_id, varsayilan_birim, manuel_fiyat, fiyat_birimi, aciklama) VALUES
  ('THL-0001', 'Pirinç (Baldo)', (SELECT id FROM urun_kategorileri WHERE ad = 'Tahıllar & Makarna'), 'kg', 75.00, 'TL/kg', 'Baldo pirinç'),
  ('THL-0002', 'Pirinç (Osmancık)', (SELECT id FROM urun_kategorileri WHERE ad = 'Tahıllar & Makarna'), 'kg', 55.00, 'TL/kg', 'Osmancık pirinç'),
  ('THL-0004', 'Bulgur (Pilavlık)', (SELECT id FROM urun_kategorileri WHERE ad = 'Tahıllar & Makarna'), 'kg', 45.00, 'TL/kg', 'Pilavlık bulgur'),
  ('THL-0006', 'Un (Ekmeklik)', (SELECT id FROM urun_kategorileri WHERE ad = 'Tahıllar & Makarna'), 'kg', 28.00, 'TL/kg', 'Ekmeklik un'),
  ('THL-0008', 'Makarna (Spagetti)', (SELECT id FROM urun_kategorileri WHERE ad = 'Tahıllar & Makarna'), 'kg', 35.00, 'TL/kg', 'Spagetti makarna')
ON CONFLICT (kod) DO UPDATE SET 
  manuel_fiyat = EXCLUDED.manuel_fiyat,
  aciklama = EXCLUDED.aciklama;

-- =====================================================
-- 8. YAĞLAR
-- =====================================================
INSERT INTO urun_kartlari (kod, ad, kategori_id, varsayilan_birim, manuel_fiyat, fiyat_birimi, aciklama) VALUES
  ('YAG-0001', 'Ayçiçek Yağı', (SELECT id FROM urun_kategorileri WHERE ad = 'Yağlar'), 'lt', 70.00, 'TL/lt', 'Ayçiçek yağı'),
  ('YAG-0002', 'Zeytinyağı (Riviera)', (SELECT id FROM urun_kategorileri WHERE ad = 'Yağlar'), 'lt', 200.00, 'TL/lt', 'Riviera zeytinyağı'),
  ('YAG-0003', 'Zeytinyağı (Sızma)', (SELECT id FROM urun_kategorileri WHERE ad = 'Yağlar'), 'lt', 350.00, 'TL/lt', 'Sızma zeytinyağı')
ON CONFLICT (kod) DO UPDATE SET 
  manuel_fiyat = EXCLUDED.manuel_fiyat,
  aciklama = EXCLUDED.aciklama;

-- =====================================================
-- 9. BAHARATLAR
-- =====================================================
INSERT INTO urun_kartlari (kod, ad, kategori_id, varsayilan_birim, manuel_fiyat, fiyat_birimi, aciklama) VALUES
  ('BHR-0001', 'Tuz (İyotlu)', (SELECT id FROM urun_kategorileri WHERE ad = 'Baharatlar'), 'kg', 12.00, 'TL/kg', 'İyotlu sofra tuzu'),
  ('BHR-0003', 'Karabiber (Toz)', (SELECT id FROM urun_kategorileri WHERE ad = 'Baharatlar'), 'kg', 350.00, 'TL/kg', 'Toz karabiber'),
  ('BHR-0005', 'Kırmızı Biber (Pul)', (SELECT id FROM urun_kategorileri WHERE ad = 'Baharatlar'), 'kg', 280.00, 'TL/kg', 'Pul biber'),
  ('BHR-0007', 'Kimyon', (SELECT id FROM urun_kategorileri WHERE ad = 'Baharatlar'), 'kg', 320.00, 'TL/kg', 'Kimyon'),
  ('BHR-0008', 'Kekik', (SELECT id FROM urun_kategorileri WHERE ad = 'Baharatlar'), 'kg', 180.00, 'TL/kg', 'Kekik')
ON CONFLICT (kod) DO UPDATE SET 
  manuel_fiyat = EXCLUDED.manuel_fiyat,
  aciklama = EXCLUDED.aciklama;

-- =====================================================
-- 10. SOSLAR & SALÇALAR
-- =====================================================
INSERT INTO urun_kartlari (kod, ad, kategori_id, varsayilan_birim, manuel_fiyat, fiyat_birimi, aciklama) VALUES
  ('SOS-0001', 'Domates Salçası', (SELECT id FROM urun_kategorileri WHERE ad = 'Soslar & Salçalar'), 'kg', 95.00, 'TL/kg', 'Domates salçası'),
  ('SOS-0002', 'Biber Salçası (Tatlı)', (SELECT id FROM urun_kategorileri WHERE ad = 'Soslar & Salçalar'), 'kg', 110.00, 'TL/kg', 'Tatlı biber salçası'),
  ('SOS-0004', 'Ketçap', (SELECT id FROM urun_kategorileri WHERE ad = 'Soslar & Salçalar'), 'kg', 85.00, 'TL/kg', 'Ketçap'),
  ('SOS-0005', 'Mayonez', (SELECT id FROM urun_kategorileri WHERE ad = 'Soslar & Salçalar'), 'kg', 110.00, 'TL/kg', 'Mayonez')
ON CONFLICT (kod) DO UPDATE SET 
  manuel_fiyat = EXCLUDED.manuel_fiyat,
  aciklama = EXCLUDED.aciklama;

-- =====================================================
-- 11. ŞEKERLER & TATLANDIRICILAR
-- =====================================================
INSERT INTO urun_kartlari (kod, ad, kategori_id, varsayilan_birim, manuel_fiyat, fiyat_birimi, aciklama) VALUES
  ('SKR-0001', 'Toz Şeker', (SELECT id FROM urun_kategorileri WHERE ad = 'Şekerler & Tatlandırıcılar'), 'kg', 38.00, 'TL/kg', 'Toz şeker'),
  ('SKR-0005', 'Bal (Süzme)', (SELECT id FROM urun_kategorileri WHERE ad = 'Şekerler & Tatlandırıcılar'), 'kg', 450.00, 'TL/kg', 'Süzme bal')
ON CONFLICT (kod) DO UPDATE SET 
  manuel_fiyat = EXCLUDED.manuel_fiyat,
  aciklama = EXCLUDED.aciklama;

-- =====================================================
-- 12. İÇECEKLER
-- =====================================================
INSERT INTO urun_kartlari (kod, ad, kategori_id, varsayilan_birim, manuel_fiyat, fiyat_birimi, aciklama) VALUES
  ('ICK-0001', 'Su (Pet 0.5lt)', (SELECT id FROM urun_kategorileri WHERE ad = 'İçecekler'), 'adet', 8.00, 'TL/adet', '0.5 litre pet su'),
  ('ICK-0004', 'Çay (Siyah)', (SELECT id FROM urun_kategorileri WHERE ad = 'İçecekler'), 'kg', 350.00, 'TL/kg', 'Siyah çay'),
  ('ICK-0005', 'Kahve (Türk)', (SELECT id FROM urun_kategorileri WHERE ad = 'İçecekler'), 'kg', 600.00, 'TL/kg', 'Türk kahvesi')
ON CONFLICT (kod) DO UPDATE SET 
  manuel_fiyat = EXCLUDED.manuel_fiyat,
  aciklama = EXCLUDED.aciklama;

-- =====================================================
-- 13. YUMURTA
-- =====================================================
INSERT INTO urun_kartlari (kod, ad, kategori_id, varsayilan_birim, manuel_fiyat, fiyat_birimi, aciklama) VALUES
  ('YMT-0001', 'Yumurta (L)', (SELECT id FROM urun_kategorileri WHERE ad = 'Diğer'), 'adet', 6.50, 'TL/adet', 'L boy yumurta'),
  ('YMT-0002', 'Yumurta (M)', (SELECT id FROM urun_kategorileri WHERE ad = 'Diğer'), 'adet', 5.50, 'TL/adet', 'M boy yumurta')
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
