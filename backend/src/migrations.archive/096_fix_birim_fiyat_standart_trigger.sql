-- =====================================================
-- TRIGGER DÜZELTMESİ: birim_fiyat_standart override sorunu
--
-- Sorun: 094'teki trigger HER UPDATE'te birim_fiyat_standart'ı override ediyordu.
-- Eşleştirme sırasında frontend'den gelen birim_carpani ile hesaplanan standart fiyat
-- trigger tarafından (ürün kartından alınan birim_carpani ile) üzerine yazılıyordu.
--
-- Çözüm: Trigger'ı tamamen kaldırıyoruz. Backend kodu birim_fiyat_standart'ı
-- doğrudan hesaplayıp yazıyor, trigger'a gerek yok.
-- =====================================================

-- Trigger'ı kaldır (artık backend hesaplıyor)
DROP TRIGGER IF EXISTS tr_hesapla_standart_fiyat ON fatura_kalemleri;

-- Fonksiyonu da kaldırabiliriz ama başka yerde kullanılıyor olabilir, şimdilik kalsın
-- DROP FUNCTION IF EXISTS hesapla_standart_birim_fiyat();

-- Açıklama
COMMENT ON TABLE fatura_kalemleri IS
'Fatura kalemleri tablosu. birim_fiyat_standart backend tarafından hesaplanır, trigger kaldırıldı.';
