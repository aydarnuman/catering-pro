-- Personel tablosuna bordro maaşı (resmi/SGK maaşı) kolonu ekle
ALTER TABLE personel ADD COLUMN IF NOT EXISTS bordro_maas DECIMAL(12,2) DEFAULT 0;

-- Mevcut kayıtlar için bordro maaşını net maaş ile aynı yap (sonra düzenlenebilir)
UPDATE personel SET bordro_maas = maas WHERE bordro_maas = 0 OR bordro_maas IS NULL;

-- Yorum ekle
COMMENT ON COLUMN personel.bordro_maas IS 'Resmi bordro maaşı (SGK''ya bildirilen tutar)';
COMMENT ON COLUMN personel.maas IS 'Gerçek net maaş (elden ödenen tutar)';
