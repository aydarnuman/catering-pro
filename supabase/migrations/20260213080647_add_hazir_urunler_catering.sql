
-- Catering şartnamelerinde sık geçen hazır ürünler
-- Kategoriler: 534=Konserve & Hazır Gıda, 535=Dondurulmuş Gıda, 536=Unlu Mamuller & Fırın, 12=İçecekler, 11=Şekerler & Tatlandırıcılar, 3=Süt Ürünleri

INSERT INTO urun_kartlari (ad, kategori_id, varsayilan_birim, manuel_fiyat, aktif) VALUES
-- Tatlılar / Hazır Gıda
('Helva (Tahin)', 534, 'kg', 250.00, true),
('Güllaç Yaprağı', 534, 'kg', 350.00, true),
('Kadayıf (Taze)', 536, 'kg', 180.00, true),
('Kemalpaşa (Hazır)', 534, 'kg', 220.00, true),
('Kabak Tatlısı (Hazır)', 534, 'kg', 150.00, true),
('Revani (Hazır)', 534, 'porsiyon', 25.00, true),
('Sütlaç (Hazır)', 534, 'porsiyon', 20.00, true),
('Aşure', 534, 'porsiyon', 18.00, true),
('Baklava', 536, 'kg', 800.00, true),
('Lokum', 534, 'kg', 200.00, true),

-- İçecekler
('Gazlı İçecek (33cl)', 12, 'adet', 15.00, true),
('Meyve Suyu (200ml)', 12, 'adet', 8.00, true),
('Limonata', 12, 'lt', 30.00, true),
('Komposto', 12, 'lt', 25.00, true),
('Çorba (Hazır)', 534, 'porsiyon', 15.00, true),

-- Unlu Mamuller
('Pide', 536, 'adet', 15.00, true),
('Simit', 536, 'adet', 10.00, true),
('Poğaça', 536, 'adet', 12.00, true),
('Börek (Hazır)', 536, 'kg', 180.00, true),
('Lahmacun', 536, 'adet', 20.00, true),
('Yufka', 536, 'kg', 80.00, true),

-- Süt Ürünleri & Kahvaltılık
('Krem Şanti', 3, 'lt', 120.00, true),
('Peynir Helvası', 534, 'kg', 280.00, true),
('Tahin', 534, 'kg', 200.00, true),

-- Hazır Soslar
('Sos (Bechamel)', 534, 'lt', 60.00, true),
('Sos (BBQ)', 534, 'lt', 80.00, true),

-- Konserveler
('Bezelye (Konserve)', 534, 'kg', 45.00, true),
('Mısır (Konserve)', 534, 'kg', 50.00, true),
('Mantar (Konserve)', 534, 'kg', 70.00, true)

ON CONFLICT DO NOTHING;
