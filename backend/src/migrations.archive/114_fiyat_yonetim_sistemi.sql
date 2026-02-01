-- =====================================================
-- 114: Fiyat Yönetim Sistemi
-- Çok kaynaklı fiyat takibi, güven skoru, mevsimsellik
-- =====================================================

-- =====================================================
-- 1. FİYAT KAYNAKLARI TABLOSU
-- =====================================================
CREATE TABLE IF NOT EXISTS fiyat_kaynaklari (
  id SERIAL PRIMARY KEY,
  kod VARCHAR(30) UNIQUE NOT NULL,              -- 'TZOB', 'ESK', 'HAL', 'TEDARIKCI', 'MANUEL', 'AI_TAHMINI'
  ad VARCHAR(100) NOT NULL,
  aciklama TEXT,
  guvenilirlik_skoru INTEGER DEFAULT 50,        -- 1-100 arası
  guncelleme_sikligi VARCHAR(30),               -- 'gunluk', 'haftalik', 'aylik', 'anlık'
  veri_tipi VARCHAR(30) DEFAULT 'scraping',     -- 'api', 'scraping', 'manuel', 'ai'
  api_url TEXT,
  scraping_config JSONB,                        -- {url, selectors, auth}
  son_basarili_guncelleme TIMESTAMPTZ,
  son_hata_mesaji TEXT,
  aktif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Varsayılan fiyat kaynakları
INSERT INTO fiyat_kaynaklari (kod, ad, aciklama, guvenilirlik_skoru, guncelleme_sikligi, veri_tipi) VALUES
  ('TEDARIKCI', 'Tedarikçi Sözleşmesi', 'Tedarikçi ile yapılan sözleşme fiyatları', 100, 'anlik', 'manuel'),
  ('FATURA', 'Fatura Girişi', 'Gelen faturalardan otomatik çekilen fiyatlar', 95, 'anlik', 'manuel'),
  ('TZOB', 'TZOB Üretici/Market Fiyatları', 'Türkiye Ziraat Odaları Birliği haftalık fiyat bülteni', 85, 'haftalik', 'scraping'),
  ('ESK', 'Et ve Süt Kurumu', 'ESK resmi satış fiyatları', 90, 'haftalik', 'scraping'),
  ('HAL', 'Hal Fiyatları', 'Toptancı hal fiyatları (İstanbul, Ankara)', 80, 'gunluk', 'scraping'),
  ('TOBB', 'TOBB Ticaret Borsası', 'Tahıl ve bakliyat borsa fiyatları', 85, 'gunluk', 'scraping'),
  ('EPDK', 'EPDK Yakıt Fiyatları', 'LPG, akaryakıt fiyatları', 95, 'gunluk', 'scraping'),
  ('MANUEL', 'Manuel Giriş', 'Kullanıcı tarafından manuel girilen fiyatlar', 70, 'anlik', 'manuel'),
  ('AI_TAHMINI', 'AI Fiyat Tahmini', 'Yapay zeka ile tahmin edilen fiyatlar', 50, 'gunluk', 'ai')
ON CONFLICT (kod) DO UPDATE SET
  ad = EXCLUDED.ad,
  aciklama = EXCLUDED.aciklama,
  guvenilirlik_skoru = EXCLUDED.guvenilirlik_skoru;

-- =====================================================
-- 2. ÜRÜN FİYAT GEÇMİŞİ TABLOSU (GENİŞLETİLMİŞ)
-- =====================================================
-- Not: urun_fiyat_gecmisi tablosu zaten var, yeni kolonlar ekliyoruz
ALTER TABLE urun_fiyat_gecmisi ADD COLUMN IF NOT EXISTS kaynak_id INTEGER REFERENCES fiyat_kaynaklari(id);
ALTER TABLE urun_fiyat_gecmisi ADD COLUMN IF NOT EXISTS bolge VARCHAR(50) DEFAULT 'turkiye_geneli';
ALTER TABLE urun_fiyat_gecmisi ADD COLUMN IF NOT EXISTS birim VARCHAR(20);
ALTER TABLE urun_fiyat_gecmisi ADD COLUMN IF NOT EXISTS min_fiyat DECIMAL(12,2);
ALTER TABLE urun_fiyat_gecmisi ADD COLUMN IF NOT EXISTS max_fiyat DECIMAL(12,2);
ALTER TABLE urun_fiyat_gecmisi ADD COLUMN IF NOT EXISTS guven_skoru INTEGER;
ALTER TABLE urun_fiyat_gecmisi ADD COLUMN IF NOT EXISTS ham_veri JSONB;
ALTER TABLE urun_fiyat_gecmisi ADD COLUMN IF NOT EXISTS dogrulanmis BOOLEAN DEFAULT false;
ALTER TABLE urun_fiyat_gecmisi ADD COLUMN IF NOT EXISTS dogrulayan_kullanici_id INTEGER;

-- =====================================================
-- 3. ÜRÜN KARTLARINA FİYAT YÖNETİM KOLONLARI
-- =====================================================
ALTER TABLE urun_kartlari ADD COLUMN IF NOT EXISTS fiyat_kaynagi_id INTEGER REFERENCES fiyat_kaynaklari(id);
ALTER TABLE urun_kartlari ADD COLUMN IF NOT EXISTS min_fiyat DECIMAL(12,2);
ALTER TABLE urun_kartlari ADD COLUMN IF NOT EXISTS max_fiyat DECIMAL(12,2);
ALTER TABLE urun_kartlari ADD COLUMN IF NOT EXISTS ortalama_fiyat DECIMAL(12,2);
ALTER TABLE urun_kartlari ADD COLUMN IF NOT EXISTS fiyat_guven_skoru INTEGER DEFAULT 50;
ALTER TABLE urun_kartlari ADD COLUMN IF NOT EXISTS son_fiyat_guncelleme TIMESTAMPTZ;
ALTER TABLE urun_kartlari ADD COLUMN IF NOT EXISTS mevsimsel BOOLEAN DEFAULT false;
ALTER TABLE urun_kartlari ADD COLUMN IF NOT EXISTS fiyat_notu TEXT;
ALTER TABLE urun_kartlari ADD COLUMN IF NOT EXISTS fiyat_gecerlilik_gun INTEGER DEFAULT 30;

-- =====================================================
-- 4. MEVSİMSEL KATSAYILAR TABLOSU
-- =====================================================
CREATE TABLE IF NOT EXISTS mevsimsel_katsayilar (
  id SERIAL PRIMARY KEY,
  urun_kart_id INTEGER REFERENCES urun_kartlari(id) ON DELETE CASCADE,
  ay INTEGER CHECK (ay BETWEEN 1 AND 12),
  katsayi DECIMAL(4,2) DEFAULT 1.00,            -- 0.5 = %50 ucuz, 2.0 = %100 pahalı
  aciklama TEXT,
  gecmis_ortalama DECIMAL(12,2),                -- Geçmiş yılların ortalaması
  son_yil_fiyat DECIMAL(12,2),                  -- Geçen yılın aynı ayı
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(urun_kart_id, ay)
);

-- =====================================================
-- 5. TEDARİKÇİ FİYATLARI TABLOSU
-- =====================================================
CREATE TABLE IF NOT EXISTS tedarikci_fiyatlari (
  id SERIAL PRIMARY KEY,
  urun_kart_id INTEGER REFERENCES urun_kartlari(id) ON DELETE CASCADE,
  cari_id INTEGER REFERENCES cariler(id) ON DELETE CASCADE,
  fiyat DECIMAL(12,2) NOT NULL,
  birim VARCHAR(20),
  kdv_dahil BOOLEAN DEFAULT false,
  min_siparis_miktar DECIMAL(12,3),
  teslim_suresi_gun INTEGER,
  gecerlilik_baslangic DATE,
  gecerlilik_bitis DATE,
  sozlesme_no VARCHAR(50),
  oncelik INTEGER DEFAULT 1,                     -- Aynı ürün için birden fazla tedarikçi
  aktif BOOLEAN DEFAULT true,
  notlar TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tedarikci_fiyatlari_urun ON tedarikci_fiyatlari(urun_kart_id);
CREATE INDEX IF NOT EXISTS idx_tedarikci_fiyatlari_cari ON tedarikci_fiyatlari(cari_id);
CREATE INDEX IF NOT EXISTS idx_tedarikci_fiyatlari_aktif ON tedarikci_fiyatlari(aktif) WHERE aktif = true;

-- =====================================================
-- 6. FİYAT UYARILARI TABLOSU
-- =====================================================
CREATE TABLE IF NOT EXISTS fiyat_uyarilari (
  id SERIAL PRIMARY KEY,
  urun_kart_id INTEGER REFERENCES urun_kartlari(id) ON DELETE CASCADE,
  uyari_tipi VARCHAR(30) NOT NULL,              -- 'ANOMALI', 'ESKIMIS', 'MIN_ALTI', 'MAX_USTU', 'MEVSIM_FARKI'
  uyari_mesaji TEXT NOT NULL,
  onceki_fiyat DECIMAL(12,2),
  yeni_fiyat DECIMAL(12,2),
  degisim_orani DECIMAL(8,2),
  onem_derecesi VARCHAR(10) DEFAULT 'orta',     -- 'dusuk', 'orta', 'yuksek', 'kritik'
  okundu BOOLEAN DEFAULT false,
  cozuldu BOOLEAN DEFAULT false,
  cozum_notu TEXT,
  cozum_tarihi TIMESTAMPTZ,
  cozen_kullanici_id INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fiyat_uyarilari_urun ON fiyat_uyarilari(urun_kart_id);
CREATE INDEX IF NOT EXISTS idx_fiyat_uyarilari_okunmamis ON fiyat_uyarilari(okundu) WHERE okundu = false;

-- =====================================================
-- 7. SCRAPING LOG TABLOSU (FİYAT ÖZELİNDE)
-- =====================================================
CREATE TABLE IF NOT EXISTS fiyat_scraping_log (
  id SERIAL PRIMARY KEY,
  kaynak_id INTEGER REFERENCES fiyat_kaynaklari(id),
  basarili BOOLEAN DEFAULT false,
  toplam_urun INTEGER DEFAULT 0,
  guncellenen_urun INTEGER DEFAULT 0,
  hata_mesaji TEXT,
  calisma_suresi_ms INTEGER,
  ham_veri JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fiyat_scraping_log_kaynak ON fiyat_scraping_log(kaynak_id, created_at DESC);

-- =====================================================
-- 8. BÖLGESEL FİYAT FARKLARI
-- =====================================================
CREATE TABLE IF NOT EXISTS bolgesel_fiyat_carpanlari (
  id SERIAL PRIMARY KEY,
  bolge_kodu VARCHAR(30) NOT NULL,              -- 'istanbul', 'ankara', 'izmir', 'antalya', vb.
  bolge_adi VARCHAR(100) NOT NULL,
  kategori_id INTEGER REFERENCES urun_kategorileri(id),
  carpan DECIMAL(4,2) DEFAULT 1.00,             -- 1.05 = %5 daha pahalı
  aciklama TEXT,
  aktif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(bolge_kodu, kategori_id)
);

-- Varsayılan bölgeler
INSERT INTO bolgesel_fiyat_carpanlari (bolge_kodu, bolge_adi, carpan) VALUES
  ('istanbul', 'İstanbul', 1.05),
  ('ankara', 'Ankara', 1.00),
  ('izmir', 'İzmir', 1.02),
  ('antalya', 'Antalya', 0.95),
  ('adana', 'Adana', 0.93),
  ('bursa', 'Bursa', 1.00),
  ('konya', 'Konya', 0.92),
  ('turkiye_geneli', 'Türkiye Geneli', 1.00)
ON CONFLICT (bolge_kodu, kategori_id) DO NOTHING;

-- =====================================================
-- 9. GÜNCEL FİYAT HESAPLAMA FONKSİYONU
-- =====================================================
CREATE OR REPLACE FUNCTION hesapla_guncel_fiyat(
  p_urun_id INTEGER,
  p_bolge VARCHAR DEFAULT 'turkiye_geneli'
)
RETURNS TABLE (
  fiyat DECIMAL(12,2),
  kaynak VARCHAR(30),
  guven_skoru INTEGER,
  son_guncelleme TIMESTAMPTZ,
  mevsim_katsayisi DECIMAL(4,2)
) AS $$
DECLARE
  v_tedarikci_fiyat DECIMAL(12,2);
  v_piyasa_fiyat DECIMAL(12,2);
  v_mevsim_katsayi DECIMAL(4,2) := 1.0;
  v_bolge_carpan DECIMAL(4,2) := 1.0;
  v_sonuc_fiyat DECIMAL(12,2);
  v_kaynak VARCHAR(30);
  v_guven INTEGER;
  v_guncelleme TIMESTAMPTZ;
  v_kategori_id INTEGER;
BEGIN
  -- Kategorid'yi al
  SELECT kategori_id INTO v_kategori_id FROM urun_kartlari WHERE id = p_urun_id;
  
  -- 1. Önce aktif tedarikçi sözleşmesi var mı kontrol et (en güvenilir)
  SELECT tf.fiyat, tf.updated_at INTO v_tedarikci_fiyat, v_guncelleme
  FROM tedarikci_fiyatlari tf
  WHERE tf.urun_kart_id = p_urun_id 
    AND tf.aktif = true 
    AND (tf.gecerlilik_bitis IS NULL OR tf.gecerlilik_bitis >= CURRENT_DATE)
  ORDER BY tf.oncelik, tf.fiyat
  LIMIT 1;
  
  IF v_tedarikci_fiyat IS NOT NULL THEN
    v_sonuc_fiyat := v_tedarikci_fiyat;
    v_kaynak := 'TEDARIKCI';
    v_guven := 100;
  ELSE
    -- 2. Son 30 günlük fiyat ortalaması (kaynak güvenilirliğine göre ağırlıklı)
    SELECT 
      SUM(ufg.fiyat * COALESCE(fk.guvenilirlik_skoru, 50)) / NULLIF(SUM(COALESCE(fk.guvenilirlik_skoru, 50)), 0),
      MAX(ufg.created_at)
    INTO v_piyasa_fiyat, v_guncelleme
    FROM urun_fiyat_gecmisi ufg
    LEFT JOIN fiyat_kaynaklari fk ON fk.id = ufg.kaynak_id
    WHERE ufg.urun_kart_id = p_urun_id
      AND ufg.created_at > NOW() - INTERVAL '30 days'
      AND ufg.fiyat > 0;
    
    IF v_piyasa_fiyat IS NOT NULL THEN
      v_sonuc_fiyat := v_piyasa_fiyat;
      v_kaynak := 'PIYASA_ORT';
      v_guven := 75;
    ELSE
      -- 3. Manuel fiyat (urun_kartlari.manuel_fiyat)
      SELECT manuel_fiyat, fiyat_guncelleme_tarihi 
      INTO v_sonuc_fiyat, v_guncelleme
      FROM urun_kartlari WHERE id = p_urun_id;
      v_kaynak := 'MANUEL';
      v_guven := 50;
    END IF;
  END IF;
  
  -- Mevsimsel katsayı uygula
  SELECT COALESCE(mk.katsayi, 1.0) INTO v_mevsim_katsayi
  FROM mevsimsel_katsayilar mk
  WHERE mk.urun_kart_id = p_urun_id
    AND mk.ay = EXTRACT(MONTH FROM NOW());
  
  -- Bölgesel katsayı uygula
  SELECT COALESCE(bfc.carpan, 1.0) INTO v_bolge_carpan
  FROM bolgesel_fiyat_carpanlari bfc
  WHERE bfc.bolge_kodu = p_bolge
    AND (bfc.kategori_id = v_kategori_id OR bfc.kategori_id IS NULL)
  ORDER BY bfc.kategori_id NULLS LAST
  LIMIT 1;
  
  -- Final fiyat
  v_sonuc_fiyat := COALESCE(v_sonuc_fiyat, 0) * v_mevsim_katsayi * v_bolge_carpan;
  
  RETURN QUERY SELECT 
    ROUND(v_sonuc_fiyat, 2)::DECIMAL(12,2),
    v_kaynak,
    v_guven,
    v_guncelleme,
    v_mevsim_katsayi;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 10. FİYAT GÜVEN SKORU HESAPLAMA
-- =====================================================
CREATE OR REPLACE FUNCTION hesapla_fiyat_guven_skoru(p_urun_id INTEGER)
RETURNS INTEGER AS $$
DECLARE
  v_skor INTEGER := 0;
  v_tedarikci_var BOOLEAN;
  v_son_fiyat_gun INTEGER;
  v_kaynak_sayisi INTEGER;
  v_fiyat_tutarliligi DECIMAL;
BEGIN
  -- 1. Tedarikçi sözleşmesi varsa +40 puan
  SELECT EXISTS(
    SELECT 1 FROM tedarikci_fiyatlari 
    WHERE urun_kart_id = p_urun_id AND aktif = true
      AND (gecerlilik_bitis IS NULL OR gecerlilik_bitis >= CURRENT_DATE)
  ) INTO v_tedarikci_var;
  
  IF v_tedarikci_var THEN
    v_skor := v_skor + 40;
  END IF;
  
  -- 2. Son fiyat güncelliği (max +30 puan)
  SELECT EXTRACT(DAY FROM NOW() - MAX(created_at))::INTEGER
  INTO v_son_fiyat_gun
  FROM urun_fiyat_gecmisi WHERE urun_kart_id = p_urun_id;
  
  v_skor := v_skor + GREATEST(0, 30 - COALESCE(v_son_fiyat_gun, 30));
  
  -- 3. Kaynak çeşitliliği (max +15 puan)
  SELECT COUNT(DISTINCT kaynak_id) INTO v_kaynak_sayisi
  FROM urun_fiyat_gecmisi 
  WHERE urun_kart_id = p_urun_id
    AND created_at > NOW() - INTERVAL '30 days';
  
  v_skor := v_skor + LEAST(15, v_kaynak_sayisi * 5);
  
  -- 4. Fiyat tutarlılığı (max +15 puan)
  -- Standart sapma düşükse puan yüksek
  SELECT 
    CASE 
      WHEN AVG(fiyat) > 0 THEN (1 - LEAST(1, STDDEV(fiyat) / AVG(fiyat))) * 15
      ELSE 0
    END
  INTO v_fiyat_tutarliligi
  FROM urun_fiyat_gecmisi 
  WHERE urun_kart_id = p_urun_id
    AND created_at > NOW() - INTERVAL '30 days';
  
  v_skor := v_skor + COALESCE(v_fiyat_tutarliligi::INTEGER, 0);
  
  RETURN LEAST(100, v_skor);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 11. FİYAT ANOMALI KONTROLÜ (GELİŞTİRİLMİŞ)
-- =====================================================
CREATE OR REPLACE FUNCTION kontrol_ve_kaydet_fiyat_anomali(
  p_urun_id INTEGER,
  p_yeni_fiyat DECIMAL,
  p_kaynak_id INTEGER DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_onceki_fiyat DECIMAL;
  v_ortalama DECIMAL;
  v_stddev DECIMAL;
  v_degisim_orani DECIMAL;
  v_anomali_var BOOLEAN := false;
  v_mesaj TEXT;
  v_onem VARCHAR(10);
BEGIN
  -- Son fiyatı al
  SELECT fiyat INTO v_onceki_fiyat
  FROM urun_fiyat_gecmisi
  WHERE urun_kart_id = p_urun_id
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_onceki_fiyat IS NULL OR v_onceki_fiyat = 0 THEN
    RETURN false;
  END IF;
  
  -- Ortalama ve standart sapma
  SELECT AVG(fiyat), STDDEV(fiyat)
  INTO v_ortalama, v_stddev
  FROM urun_fiyat_gecmisi
  WHERE urun_kart_id = p_urun_id
    AND created_at > NOW() - INTERVAL '60 days';
  
  v_degisim_orani := ((p_yeni_fiyat - v_onceki_fiyat) / v_onceki_fiyat) * 100;
  
  -- Anomali kontrolü
  IF ABS(v_degisim_orani) > 50 THEN
    v_anomali_var := true;
    v_mesaj := 'Fiyat %' || ROUND(v_degisim_orani) || ' değişti!';
    v_onem := 'kritik';
  ELSIF ABS(v_degisim_orani) > 30 THEN
    v_anomali_var := true;
    v_mesaj := 'Fiyat %' || ROUND(v_degisim_orani) || ' değişti';
    v_onem := 'yuksek';
  ELSIF v_stddev IS NOT NULL AND ABS(p_yeni_fiyat - v_ortalama) > 2 * v_stddev THEN
    v_anomali_var := true;
    v_mesaj := 'Fiyat 2σ dışında: ' || ROUND(p_yeni_fiyat, 2) || ' TL (ort: ' || ROUND(v_ortalama, 2) || ')';
    v_onem := 'orta';
  END IF;
  
  -- Anomali varsa kaydet
  IF v_anomali_var THEN
    INSERT INTO fiyat_uyarilari (
      urun_kart_id, uyari_tipi, uyari_mesaji, 
      onceki_fiyat, yeni_fiyat, degisim_orani, onem_derecesi
    ) VALUES (
      p_urun_id, 'ANOMALI', v_mesaj,
      v_onceki_fiyat, p_yeni_fiyat, v_degisim_orani, v_onem
    );
  END IF;
  
  RETURN v_anomali_var;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 12. FİYAT GÜNCELLEME TRİGGER
-- =====================================================
CREATE OR REPLACE FUNCTION trg_fiyat_gecmisi_after_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- Güven skorunu güncelle
  UPDATE urun_kartlari
  SET 
    fiyat_guven_skoru = hesapla_fiyat_guven_skoru(NEW.urun_kart_id),
    son_fiyat_guncelleme = NOW()
  WHERE id = NEW.urun_kart_id;
  
  -- Anomali kontrolü (opsiyonel - performans için kapatılabilir)
  PERFORM kontrol_ve_kaydet_fiyat_anomali(NEW.urun_kart_id, NEW.fiyat, NEW.kaynak_id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fiyat_gecmisi_insert ON urun_fiyat_gecmisi;
CREATE TRIGGER trg_fiyat_gecmisi_insert
  AFTER INSERT ON urun_fiyat_gecmisi
  FOR EACH ROW
  EXECUTE FUNCTION trg_fiyat_gecmisi_after_insert();

-- =====================================================
-- 13. FİYAT GÜNCELLİK KONTROLÜ VIEW
-- =====================================================
CREATE OR REPLACE VIEW v_fiyat_guncellik_durumu AS
SELECT 
  uk.id,
  uk.kod,
  uk.ad,
  kat.ad as kategori,
  uk.manuel_fiyat,
  uk.son_alis_fiyati,
  uk.fiyat_guven_skoru,
  uk.son_fiyat_guncelleme,
  uk.mevsimsel,
  EXTRACT(DAY FROM NOW() - uk.son_fiyat_guncelleme)::INTEGER as gun_sayisi,
  CASE 
    WHEN uk.son_fiyat_guncelleme IS NULL THEN 'hic_guncellenmedi'
    WHEN uk.son_fiyat_guncelleme > NOW() - INTERVAL '7 days' THEN 'guncel'
    WHEN uk.son_fiyat_guncelleme > NOW() - INTERVAL '30 days' THEN 'orta'
    WHEN uk.son_fiyat_guncelleme > NOW() - INTERVAL '90 days' THEN 'eski'
    ELSE 'cok_eski'
  END as guncellik_durumu,
  fk.ad as fiyat_kaynagi,
  (SELECT COUNT(*) FROM urun_fiyat_gecmisi WHERE urun_kart_id = uk.id AND created_at > NOW() - INTERVAL '30 days') as son_30_gun_kayit
FROM urun_kartlari uk
LEFT JOIN urun_kategorileri kat ON kat.id = uk.kategori_id
LEFT JOIN fiyat_kaynaklari fk ON fk.id = uk.fiyat_kaynagi_id
WHERE uk.aktif = true
ORDER BY uk.son_fiyat_guncelleme NULLS FIRST;

-- =====================================================
-- 14. TEDARİKÇİ FİYAT KARŞILAŞTIRMA VIEW
-- =====================================================
CREATE OR REPLACE VIEW v_tedarikci_fiyat_karsilastirma AS
SELECT 
  uk.id as urun_id,
  uk.kod as urun_kod,
  uk.ad as urun_ad,
  tf.cari_id,
  c.unvan as tedarikci,
  tf.fiyat,
  tf.kdv_dahil,
  tf.min_siparis_miktar,
  tf.teslim_suresi_gun,
  tf.gecerlilik_bitis,
  tf.oncelik,
  tf.aktif,
  RANK() OVER (PARTITION BY uk.id ORDER BY tf.fiyat) as fiyat_sirasi,
  (SELECT AVG(fiyat) FROM tedarikci_fiyatlari WHERE urun_kart_id = uk.id AND aktif = true) as ortalama_fiyat,
  ROUND(((tf.fiyat - (SELECT AVG(fiyat) FROM tedarikci_fiyatlari WHERE urun_kart_id = uk.id AND aktif = true)) 
    / NULLIF((SELECT AVG(fiyat) FROM tedarikci_fiyatlari WHERE urun_kart_id = uk.id AND aktif = true), 0) * 100), 1) as ort_fark_yuzde
FROM urun_kartlari uk
JOIN tedarikci_fiyatlari tf ON tf.urun_kart_id = uk.id
JOIN cariler c ON c.id = tf.cari_id
WHERE uk.aktif = true
ORDER BY uk.ad, tf.fiyat;

-- =====================================================
-- 15. ESKİMİŞ FİYAT UYARISI JOB FONKSİYONU
-- =====================================================
CREATE OR REPLACE FUNCTION fiyat_eskime_kontrolu()
RETURNS INTEGER AS $$
DECLARE
  v_eklenen INTEGER := 0;
  r RECORD;
BEGIN
  -- 30 günden eski fiyatlar için uyarı oluştur
  FOR r IN 
    SELECT id, ad, son_fiyat_guncelleme
    FROM urun_kartlari
    WHERE aktif = true
      AND (son_fiyat_guncelleme IS NULL OR son_fiyat_guncelleme < NOW() - INTERVAL '30 days')
      AND manuel_fiyat > 0
      AND id NOT IN (
        SELECT urun_kart_id FROM fiyat_uyarilari 
        WHERE uyari_tipi = 'ESKIMIS' AND cozuldu = false
          AND created_at > NOW() - INTERVAL '7 days'
      )
  LOOP
    INSERT INTO fiyat_uyarilari (
      urun_kart_id, uyari_tipi, uyari_mesaji, onem_derecesi
    ) VALUES (
      r.id, 
      'ESKIMIS', 
      r.ad || ' ürününün fiyatı ' || COALESCE(
        EXTRACT(DAY FROM NOW() - r.son_fiyat_guncelleme)::TEXT || ' gündür',
        'hiç'
      ) || ' güncellenmedi',
      CASE 
        WHEN r.son_fiyat_guncelleme IS NULL THEN 'yuksek'
        WHEN r.son_fiyat_guncelleme < NOW() - INTERVAL '90 days' THEN 'kritik'
        ELSE 'orta'
      END
    );
    v_eklenen := v_eklenen + 1;
  END LOOP;
  
  RETURN v_eklenen;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 16. İNDEKSLER
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_fiyat_kaynaklari_aktif ON fiyat_kaynaklari(aktif) WHERE aktif = true;
CREATE INDEX IF NOT EXISTS idx_mevsimsel_katsayilar_urun_ay ON mevsimsel_katsayilar(urun_kart_id, ay);
CREATE INDEX IF NOT EXISTS idx_urun_kartlari_fiyat_guven ON urun_kartlari(fiyat_guven_skoru);
CREATE INDEX IF NOT EXISTS idx_urun_kartlari_son_fiyat ON urun_kartlari(son_fiyat_guncelleme);

-- =====================================================
-- YORUMLAR
-- =====================================================
COMMENT ON TABLE fiyat_kaynaklari IS 'Fiyat veri kaynakları - TZOB, ESK, Hal, Tedarikçi, Manuel';
COMMENT ON TABLE mevsimsel_katsayilar IS 'Ürün bazında aylık mevsimsel fiyat katsayıları';
COMMENT ON TABLE tedarikci_fiyatlari IS 'Tedarikçi sözleşme fiyatları - en güvenilir kaynak';
COMMENT ON TABLE fiyat_uyarilari IS 'Fiyat anomali ve eskime uyarıları';
COMMENT ON FUNCTION hesapla_guncel_fiyat IS 'Çok kaynaklı, mevsimsel ve bölgesel faktörlü fiyat hesaplama';
