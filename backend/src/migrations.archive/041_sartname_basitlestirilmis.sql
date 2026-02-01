-- =============================================
-- ŞARTNAME SİSTEMİ - BASİTLEŞTİRİLMİŞ
-- Yemek kategorisi bazında porsiyon gramajları
-- =============================================

-- Eski karmaşık tabloları temizle (varsa)
DROP TABLE IF EXISTS gramaj_kontrol_loglari CASCADE;
DROP TABLE IF EXISTS sartname_ogun_kurallari CASCADE;
DROP TABLE IF EXISTS sartname_gramajlari CASCADE;

-- Yeni basit gramaj tablosu: Kategori bazında porsiyon gramajları
CREATE TABLE IF NOT EXISTS sartname_porsiyon_gramajlari (
  id SERIAL PRIMARY KEY,
  sartname_id INTEGER REFERENCES proje_sartnameleri(id) ON DELETE CASCADE,
  kategori_id INTEGER REFERENCES recete_kategoriler(id),
  yemek_turu VARCHAR(100) NOT NULL,        -- "Et Yemeği (kemiksiz)", "Pilav", "Çorba"
  porsiyon_gramaj INTEGER NOT NULL,         -- 150 (gram veya ml)
  birim VARCHAR(10) DEFAULT 'g',            -- g, ml, adet
  aciklama TEXT,                            -- "Dana eti minimum 100g"
  sira INTEGER DEFAULT 0,
  aktif BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Öğün yapısı tablosu: Her öğünde ne olacak
CREATE TABLE IF NOT EXISTS sartname_ogun_yapisi (
  id SERIAL PRIMARY KEY,
  sartname_id INTEGER REFERENCES proje_sartnameleri(id) ON DELETE CASCADE,
  ogun_tipi VARCHAR(50) NOT NULL,           -- kahvalti, ogle, aksam
  cesit_sayisi INTEGER,                     -- Kahvaltı için: 8-12 çeşit
  min_cesit INTEGER,
  max_cesit INTEGER,
  zorunlu_kategoriler TEXT[],               -- ['corba', 'ana_yemek', 'pilav_makarna']
  aciklama TEXT,
  aktif BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Örnek KYK Şartnamesi verilerini güncelle
DO $$
DECLARE
  v_sartname_id INTEGER;
  v_corba_kat INTEGER;
  v_ana_kat INTEGER;
  v_pilav_kat INTEGER;
  v_salata_kat INTEGER;
  v_tatli_kat INTEGER;
BEGIN
  SELECT id INTO v_sartname_id FROM proje_sartnameleri WHERE kod = 'KYK-2024';
  SELECT id INTO v_corba_kat FROM recete_kategoriler WHERE kod = 'corba';
  SELECT id INTO v_ana_kat FROM recete_kategoriler WHERE kod = 'ana_yemek';
  SELECT id INTO v_pilav_kat FROM recete_kategoriler WHERE kod = 'pilav_makarna';
  SELECT id INTO v_salata_kat FROM recete_kategoriler WHERE kod = 'salata_meze';
  SELECT id INTO v_tatli_kat FROM recete_kategoriler WHERE kod = 'tatli';
  
  IF v_sartname_id IS NOT NULL THEN
    -- Porsiyon gramajları
    INSERT INTO sartname_porsiyon_gramajlari (sartname_id, kategori_id, yemek_turu, porsiyon_gramaj, birim, aciklama, sira) VALUES
      (v_sartname_id, v_corba_kat, 'Çorba', 200, 'ml', 'Tüm çorbalar için standart porsiyon', 1),
      (v_sartname_id, v_ana_kat, 'Et Yemeği (kemikli)', 150, 'g', 'Kemikli et yemekleri', 2),
      (v_sartname_id, v_ana_kat, 'Et Yemeği (kemiksiz)', 100, 'g', 'Kemiksiz et, köfte vb.', 3),
      (v_sartname_id, v_ana_kat, 'Tavuk (but/göğüs)', 120, 'g', 'Tavuk yemekleri', 4),
      (v_sartname_id, v_ana_kat, 'Balık', 150, 'g', 'Balık yemekleri', 5),
      (v_sartname_id, v_ana_kat, 'Kuru Baklagil', 250, 'g', 'Kuru fasulye, nohut, mercimek', 6),
      (v_sartname_id, v_pilav_kat, 'Pilav', 150, 'g', 'Pirinç/bulgur pilavı', 7),
      (v_sartname_id, v_pilav_kat, 'Makarna', 200, 'g', 'Makarna yemekleri', 8),
      (v_sartname_id, v_salata_kat, 'Salata', 100, 'g', 'Mevsim salataları', 9),
      (v_sartname_id, v_salata_kat, 'Meze/Ara Sıcak', 80, 'g', 'Mezeler ve ara sıcaklar', 10),
      (v_sartname_id, v_tatli_kat, 'Sütlü Tatlı', 150, 'g', 'Sütlaç, muhallebi vb.', 11),
      (v_sartname_id, v_tatli_kat, 'Şerbetli Tatlı', 100, 'g', 'Baklava, kadayıf vb.', 12),
      (v_sartname_id, v_tatli_kat, 'Meyve', 150, 'g', 'Mevsim meyvesi', 13),
      (v_sartname_id, NULL, 'Ekmek', 100, 'g', 'Günlük ekmek', 14),
      (v_sartname_id, NULL, 'Ayran', 200, 'ml', 'Ayran porsiyon', 15),
      (v_sartname_id, NULL, 'Su', 500, 'ml', 'İçme suyu', 16)
    ON CONFLICT DO NOTHING;
    
    -- Öğün yapıları
    INSERT INTO sartname_ogun_yapisi (sartname_id, ogun_tipi, min_cesit, max_cesit, zorunlu_kategoriler, aciklama) VALUES
      (v_sartname_id, 'kahvalti', 8, 12, ARRAY['kahvaltilik'], 'Kahvaltı tabağı: peynir, zeytin, bal/reçel, yumurta, domates, salatalık, tereyağı, çay'),
      (v_sartname_id, 'ogle', 4, 5, ARRAY['corba', 'ana_yemek', 'pilav_makarna'], 'Öğle: Çorba + Ana Yemek + Pilav/Makarna + Salata/Tatlı'),
      (v_sartname_id, 'aksam', 4, 5, ARRAY['corba', 'ana_yemek', 'pilav_makarna'], 'Akşam: Çorba + Ana Yemek + Pilav/Makarna + Meyve/Tatlı')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_porsiyon_gramaj_sartname ON sartname_porsiyon_gramajlari(sartname_id);
CREATE INDEX IF NOT EXISTS idx_ogun_yapisi_sartname ON sartname_ogun_yapisi(sartname_id);

-- View: Şartname detay görünümü
CREATE OR REPLACE VIEW sartname_detay_view AS
SELECT 
  ps.id,
  ps.kod,
  ps.ad,
  sk.ad as kurum,
  sk.ikon as kurum_ikon,
  ps.yil,
  (SELECT COUNT(*) FROM sartname_porsiyon_gramajlari spg WHERE spg.sartname_id = ps.id AND spg.aktif) as gramaj_sayisi,
  (SELECT COUNT(*) FROM sartname_ogun_yapisi soy WHERE soy.sartname_id = ps.id AND soy.aktif) as ogun_sayisi,
  (SELECT COUNT(*) FROM proje_sartname_atamalari psa WHERE psa.sartname_id = ps.id) as proje_sayisi
FROM proje_sartnameleri ps
LEFT JOIN sartname_kurumlari sk ON sk.id = ps.kurum_id
WHERE ps.aktif = true;

COMMENT ON TABLE sartname_porsiyon_gramajlari IS 'Yemek kategorisi bazında standart porsiyon gramajları';
COMMENT ON TABLE sartname_ogun_yapisi IS 'Öğün bazında zorunlu kategoriler ve çeşit sayıları';

