-- =====================================================
-- 114: Fiyat Yönetim Sistemi
-- Çok kaynaklı fiyat takibi, güven skoru, mevsimsellik
-- =====================================================

-- =====================================================
-- 1. FİYAT KAYNAKLARI TABLOSU
-- =====================================================
CREATE TABLE IF NOT EXISTS fiyat_kaynaklari (
  id SERIAL PRIMARY KEY,
  kod VARCHAR(30) UNIQUE NOT NULL,
  ad VARCHAR(100) NOT NULL,
  aciklama TEXT,
  guvenilirlik_skoru INTEGER DEFAULT 50,
  guncelleme_sikligi VARCHAR(30),
  veri_tipi VARCHAR(30) DEFAULT 'scraping',
  api_url TEXT,
  scraping_config JSONB,
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
  katsayi DECIMAL(4,2) DEFAULT 1.00,
  aciklama TEXT,
  gecmis_ortalama DECIMAL(12,2),
  son_yil_fiyat DECIMAL(12,2),
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
  oncelik INTEGER DEFAULT 1,
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
  uyari_tipi VARCHAR(30) NOT NULL,
  uyari_mesaji TEXT NOT NULL,
  onceki_fiyat DECIMAL(12,2),
  yeni_fiyat DECIMAL(12,2),
  degisim_orani DECIMAL(8,2),
  onem_derecesi VARCHAR(10) DEFAULT 'orta',
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
-- 7. SCRAPING LOG TABLOSU
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
  bolge_kodu VARCHAR(30) NOT NULL,
  bolge_adi VARCHAR(100) NOT NULL,
  kategori_id INTEGER REFERENCES urun_kategorileri(id),
  carpan DECIMAL(4,2) DEFAULT 1.00,
  aciklama TEXT,
  aktif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(bolge_kodu, kategori_id)
);

INSERT INTO bolgesel_fiyat_carpanlari (bolge_kodu, bolge_adi, carpan) VALUES
  ('istanbul', 'İstanbul', 1.05),
  ('ankara', 'Ankara', 1.00),
  ('izmir', 'İzmir', 1.02),
  ('antalya', 'Antalya', 0.95),
  ('adana', 'Adana', 0.93),
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
  SELECT kategori_id INTO v_kategori_id FROM urun_kartlari WHERE id = p_urun_id;
  
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
      SELECT manuel_fiyat, fiyat_guncelleme_tarihi 
      INTO v_sonuc_fiyat, v_guncelleme
      FROM urun_kartlari WHERE id = p_urun_id;
      v_kaynak := 'MANUEL';
      v_guven := 50;
    END IF;
  END IF;
  
  SELECT COALESCE(mk.katsayi, 1.0) INTO v_mevsim_katsayi
  FROM mevsimsel_katsayilar mk
  WHERE mk.urun_kart_id = p_urun_id
    AND mk.ay = EXTRACT(MONTH FROM NOW());
  
  SELECT COALESCE(bfc.carpan, 1.0) INTO v_bolge_carpan
  FROM bolgesel_fiyat_carpanlari bfc
  WHERE bfc.bolge_kodu = p_bolge
    AND (bfc.kategori_id = v_kategori_id OR bfc.kategori_id IS NULL)
  ORDER BY bfc.kategori_id NULLS LAST
  LIMIT 1;
  
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
  SELECT EXISTS(
    SELECT 1 FROM tedarikci_fiyatlari 
    WHERE urun_kart_id = p_urun_id AND aktif = true
      AND (gecerlilik_bitis IS NULL OR gecerlilik_bitis >= CURRENT_DATE)
  ) INTO v_tedarikci_var;
  
  IF v_tedarikci_var THEN
    v_skor := v_skor + 40;
  END IF;
  
  SELECT EXTRACT(DAY FROM NOW() - MAX(created_at))::INTEGER
  INTO v_son_fiyat_gun
  FROM urun_fiyat_gecmisi WHERE urun_kart_id = p_urun_id;
  
  v_skor := v_skor + GREATEST(0, 30 - COALESCE(v_son_fiyat_gun, 30));
  
  SELECT COUNT(DISTINCT kaynak_id) INTO v_kaynak_sayisi
  FROM urun_fiyat_gecmisi 
  WHERE urun_kart_id = p_urun_id
    AND created_at > NOW() - INTERVAL '30 days';
  
  v_skor := v_skor + LEAST(15, v_kaynak_sayisi * 5);
  
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
-- 11. ESKİMİŞ FİYAT KONTROLÜ
-- =====================================================
CREATE OR REPLACE FUNCTION fiyat_eskime_kontrolu()
RETURNS INTEGER AS $$
DECLARE
  v_eklenen INTEGER := 0;
  r RECORD;
BEGIN
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
-- 12. İNDEKSLER
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_fiyat_kaynaklari_aktif ON fiyat_kaynaklari(aktif) WHERE aktif = true;
CREATE INDEX IF NOT EXISTS idx_mevsimsel_katsayilar_urun_ay ON mevsimsel_katsayilar(urun_kart_id, ay);
CREATE INDEX IF NOT EXISTS idx_urun_kartlari_fiyat_guven ON urun_kartlari(fiyat_guven_skoru);
CREATE INDEX IF NOT EXISTS idx_urun_kartlari_son_fiyat ON urun_kartlari(son_fiyat_guncelleme);

-- YORUMLAR
COMMENT ON TABLE fiyat_kaynaklari IS 'Fiyat veri kaynakları - TZOB, ESK, Hal, Tedarikçi, Manuel';
COMMENT ON TABLE mevsimsel_katsayilar IS 'Ürün bazında aylık mevsimsel fiyat katsayıları';
COMMENT ON TABLE tedarikci_fiyatlari IS 'Tedarikçi sözleşme fiyatları - en güvenilir kaynak';
COMMENT ON TABLE fiyat_uyarilari IS 'Fiyat anomali ve eskime uyarıları';
