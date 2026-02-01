-- Diyet, Vejetaryen, Glütensiz kategorilerini "Özel Diyet" altında birleştir

-- Eski kategorileri sil
DELETE FROM maliyet_kategoriler WHERE kod IN ('diyet', 'vejetaryen', 'glutensiz');

-- Özel Diyet kategorisini ekle/güncelle
INSERT INTO maliyet_kategoriler (kod, ad, ikon, aciklama, renk, sira)
VALUES ('ozel-diyet', 'Özel Diyet', '🥗', 'Diyet, Vejetaryen, Glütensiz menüler', 'lime', 5)
ON CONFLICT (kod) DO UPDATE SET 
    ad = 'Özel Diyet', 
    ikon = '🥗', 
    aciklama = 'Diyet, Vejetaryen, Glütensiz menüler',
    sira = 5;

-- "Özel" kategorisini 6. sıraya al
UPDATE maliyet_kategoriler SET sira = 6 WHERE kod = 'ozel';
