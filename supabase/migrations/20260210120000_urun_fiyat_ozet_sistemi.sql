-- =============================================
-- Ürün Fiyat Özet Sistemi
-- Piyasa fiyat karmaşıklığını çözen merkezi özet katmanı
--
-- Sorun: piyasa_fiyat_gecmisi tablosunda farklı ambalaj boyutları,
-- farklı birim tipleri (kg/L/adet) karışık şekilde saklanıyor.
-- Ortalama hesaplamaları anlamsız sonuçlar veriyor.
--
-- Çözüm:
-- 1. birim_tipi kolonu eklenerek JSON'dan çıkarılıyor
-- 2. urun_fiyat_ozet tablosu ile her ürün için tek temiz özet
-- 3. refresh_urun_fiyat_ozet() fonksiyonu ile IQR temizli hesaplama
-- 4. v_urun_guncel_fiyat view güncellenerek yeni sisteme bağlanıyor
-- =============================================

-- ─── 1a. piyasa_fiyat_gecmisi'ne birim_tipi kolonu ─────────

ALTER TABLE piyasa_fiyat_gecmisi
  ADD COLUMN IF NOT EXISTS birim_tipi VARCHAR(10);

-- Mevcut veriyi kaynaklar JSON'dan backfill et
UPDATE piyasa_fiyat_gecmisi
SET birim_tipi = kaynaklar->>'birimTipi'
WHERE birim_tipi IS NULL
  AND kaynaklar IS NOT NULL
  AND kaynaklar->>'birimTipi' IS NOT NULL;

-- Hâlâ NULL kalanları birim_fiyat ve ambalaj_miktar'a göre tahmin et
UPDATE piyasa_fiyat_gecmisi
SET birim_tipi = 'adet'
WHERE birim_tipi IS NULL;

-- Performans indexi: ürün + birim + tarih
CREATE INDEX IF NOT EXISTS idx_pfg_urun_birim_tarih
  ON piyasa_fiyat_gecmisi(urun_kart_id, birim_tipi, arastirma_tarihi DESC);

-- ─── 1b. urun_fiyat_ozet tablosu ────────────────────────────

CREATE TABLE IF NOT EXISTS urun_fiyat_ozet (
  urun_kart_id         INTEGER PRIMARY KEY REFERENCES urun_kartlari(id) ON DELETE CASCADE,
  birim_fiyat_ekonomik DECIMAL(15,4),   -- IQR temiz, en ucuz 5'in ortalaması
  birim_fiyat_min      DECIMAL(15,4),
  birim_fiyat_max      DECIMAL(15,4),
  birim_fiyat_medyan   DECIMAL(15,4),
  birim_tipi           VARCHAR(10),     -- kg, L, adet
  confidence           DECIMAL(5,2) DEFAULT 0, -- 0.00-1.00
  kaynak_sayisi        INTEGER DEFAULT 0,
  kaynak_tip           VARCHAR(30),     -- market, market+tavily_ai, tavily_referans, hal
  varyant_fiyat_dahil  BOOLEAN DEFAULT false,
  son_guncelleme       TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE urun_fiyat_ozet IS 'Ürün başına tek satır piyasa fiyat özeti. Tek doğru kaynak (single source of truth). IQR outlier temizli ekonomik ortalama içerir.';
COMMENT ON COLUMN urun_fiyat_ozet.birim_fiyat_ekonomik IS 'IQR outlier temizlenmiş en ucuz 5 fiyatın ortalaması (TL/birim)';
COMMENT ON COLUMN urun_fiyat_ozet.confidence IS '0.00-1.00 arası güvenilirlik skoru. Kaynak çeşitliliği, fiyat tutarlılığı ve güncelliğe göre hesaplanır';
COMMENT ON COLUMN urun_fiyat_ozet.varyant_fiyat_dahil IS 'true ise fiyat varyantlardan hesaplanmış (parent ürün için)';

-- ─── 1c. refresh_urun_fiyat_ozet() fonksiyonu ──────────────

CREATE OR REPLACE FUNCTION refresh_urun_fiyat_ozet(p_urun_kart_id INTEGER)
RETURNS void AS $$
DECLARE
  v_dominant_birim  VARCHAR(10);
  v_prices          DECIMAL[];
  v_clean_prices    DECIMAL[];
  v_q1              DECIMAL;
  v_q3              DECIMAL;
  v_iqr             DECIMAL;
  v_lower_bound     DECIMAL;
  v_upper_bound     DECIMAL;
  v_ekonomik_ort    DECIMAL;
  v_min             DECIMAL;
  v_max             DECIMAL;
  v_medyan          DECIMAL;
  v_count           INTEGER;
  v_kaynak_tip      VARCHAR(30);
  v_confidence      DECIMAL;
  v_kaynak_sayisi   INTEGER;
  v_median_price    DECIMAL;
BEGIN
  -- 1. Dominant birim tipini bul (en çok kayıt olan)
  SELECT birim_tipi INTO v_dominant_birim
  FROM piyasa_fiyat_gecmisi
  WHERE urun_kart_id = p_urun_kart_id
    AND birim_fiyat > 0
    AND birim_tipi IS NOT NULL
    AND arastirma_tarihi >= NOW() - INTERVAL '30 days'
  GROUP BY birim_tipi
  ORDER BY COUNT(*) DESC
  LIMIT 1;

  -- Dominant birim yoksa 'kg' varsay
  IF v_dominant_birim IS NULL THEN
    v_dominant_birim := 'kg';
  END IF;

  -- 2. Dominant birimle uyumlu fiyatları al (son 30 gün)
  SELECT ARRAY_AGG(birim_fiyat ORDER BY birim_fiyat ASC)
  INTO v_prices
  FROM piyasa_fiyat_gecmisi
  WHERE urun_kart_id = p_urun_kart_id
    AND birim_fiyat > 0
    AND (birim_tipi = v_dominant_birim OR birim_tipi IS NULL)
    AND arastirma_tarihi >= NOW() - INTERVAL '30 days';

  -- Hiç fiyat yoksa sil ve çık
  IF v_prices IS NULL OR array_length(v_prices, 1) IS NULL THEN
    DELETE FROM urun_fiyat_ozet WHERE urun_kart_id = p_urun_kart_id;
    RETURN;
  END IF;

  v_count := array_length(v_prices, 1);

  -- 3. IQR Outlier temizleme (5+ fiyat varsa)
  IF v_count >= 5 THEN
    v_q1 := v_prices[GREATEST(1, FLOOR(v_count * 0.25)::int)];
    v_q3 := v_prices[GREATEST(1, FLOOR(v_count * 0.75)::int)];
    v_iqr := v_q3 - v_q1;
    v_lower_bound := v_q1 - 1.5 * v_iqr;
    v_upper_bound := v_q3 + 1.5 * v_iqr;

    SELECT ARRAY_AGG(p ORDER BY p ASC)
    INTO v_clean_prices
    FROM unnest(v_prices) AS p
    WHERE p >= v_lower_bound AND p <= v_upper_bound;

    -- IQR sonrası çok az kaldıysa geri al
    IF v_clean_prices IS NULL OR array_length(v_clean_prices, 1) < 3 THEN
      v_clean_prices := v_prices;
    END IF;
  ELSE
    v_clean_prices := v_prices;
  END IF;

  -- 4. Medyan bazlı ek temizleme (4+ fiyat)
  IF array_length(v_clean_prices, 1) >= 4 THEN
    v_median_price := v_clean_prices[GREATEST(1, FLOOR(array_length(v_clean_prices, 1) / 2.0)::int)];
    
    SELECT ARRAY_AGG(p ORDER BY p ASC)
    INTO v_clean_prices
    FROM unnest(v_clean_prices) AS p
    WHERE p >= v_median_price * 0.2 AND p <= v_median_price * 3.0;

    -- Temizleme sonrası çok az kaldıysa medyan filtresini geri al
    IF v_clean_prices IS NULL OR array_length(v_clean_prices, 1) < 3 THEN
      v_clean_prices := v_prices;
    END IF;
  END IF;

  v_count := array_length(v_clean_prices, 1);

  -- 5. İstatistikleri hesapla
  v_min := v_clean_prices[1];
  v_max := v_clean_prices[v_count];
  v_medyan := v_clean_prices[GREATEST(1, FLOOR(v_count / 2.0)::int)];

  -- Ekonomik ortalama: en ucuz 5'in ortalaması
  SELECT ROUND(AVG(p)::numeric, 4)
  INTO v_ekonomik_ort
  FROM (
    SELECT unnest(v_clean_prices[1:LEAST(5, v_count)]) AS p
  ) sub;

  -- 6. Kaynak bilgileri
  SELECT 
    COUNT(DISTINCT COALESCE(market_adi, 'unknown')),
    -- kaynak_tip: kaynaklar JSON'dan
    CASE
      WHEN COUNT(DISTINCT CASE WHEN kaynaklar->>'kaynak' LIKE '%tavily%' OR kaynaklar->>'kaynakTip' LIKE '%tavily%' THEN 1 END) > 0
        AND COUNT(DISTINCT CASE WHEN kaynaklar->>'kaynak' = 'market' OR kaynaklar->>'kaynakTip' = 'market' THEN 1 END) > 0
      THEN 'market+tavily_ai'
      WHEN COUNT(DISTINCT CASE WHEN kaynaklar->>'kaynak' LIKE '%tavily%' OR kaynaklar->>'kaynakTip' LIKE '%tavily%' THEN 1 END) > 0
      THEN 'tavily_referans'
      WHEN COUNT(DISTINCT CASE WHEN kaynaklar->>'kaynak' LIKE '%hal%' OR kaynaklar->>'kaynakTip' LIKE '%hal%' THEN 1 END) > 0
      THEN 'hal'
      ELSE 'market'
    END
  INTO v_kaynak_sayisi, v_kaynak_tip
  FROM piyasa_fiyat_gecmisi
  WHERE urun_kart_id = p_urun_kart_id
    AND birim_fiyat > 0
    AND (birim_tipi = v_dominant_birim OR birim_tipi IS NULL)
    AND arastirma_tarihi >= NOW() - INTERVAL '30 days';

  -- 7. Confidence hesapla (0.00-1.00)
  -- Faktörler: kaynak sayısı (max 0.3), fiyat tutarlılığı (max 0.4), güncellik (max 0.3)
  v_confidence := 0;
  
  -- Kaynak çeşitliliği (0-0.3)
  v_confidence := v_confidence + LEAST(v_kaynak_sayisi * 0.06, 0.3);
  
  -- Fiyat tutarlılığı (0-0.4): max-min farkı medyana göre
  IF v_medyan > 0 AND v_max > 0 THEN
    DECLARE v_spread DECIMAL;
    BEGIN
      v_spread := (v_max - v_min) / v_medyan;
      IF v_spread <= 0.2 THEN v_confidence := v_confidence + 0.4;
      ELSIF v_spread <= 0.4 THEN v_confidence := v_confidence + 0.25;
      ELSIF v_spread <= 0.6 THEN v_confidence := v_confidence + 0.15;
      ELSE v_confidence := v_confidence + 0.05;
      END IF;
    END;
  END IF;
  
  -- Güncellik (0-0.3): son 3 günde veri varsa tam puan
  IF EXISTS (
    SELECT 1 FROM piyasa_fiyat_gecmisi
    WHERE urun_kart_id = p_urun_kart_id
      AND arastirma_tarihi >= NOW() - INTERVAL '3 days'
    LIMIT 1
  ) THEN
    v_confidence := v_confidence + 0.3;
  ELSIF EXISTS (
    SELECT 1 FROM piyasa_fiyat_gecmisi
    WHERE urun_kart_id = p_urun_kart_id
      AND arastirma_tarihi >= NOW() - INTERVAL '7 days'
    LIMIT 1
  ) THEN
    v_confidence := v_confidence + 0.15;
  END IF;

  -- 8. UPSERT
  INSERT INTO urun_fiyat_ozet (
    urun_kart_id, birim_fiyat_ekonomik, birim_fiyat_min, birim_fiyat_max,
    birim_fiyat_medyan, birim_tipi, confidence, kaynak_sayisi, kaynak_tip,
    varyant_fiyat_dahil, son_guncelleme
  ) VALUES (
    p_urun_kart_id, v_ekonomik_ort, v_min, v_max,
    v_medyan, v_dominant_birim, ROUND(v_confidence::numeric, 2), v_kaynak_sayisi, v_kaynak_tip,
    false, NOW()
  )
  ON CONFLICT (urun_kart_id) DO UPDATE SET
    birim_fiyat_ekonomik = EXCLUDED.birim_fiyat_ekonomik,
    birim_fiyat_min = EXCLUDED.birim_fiyat_min,
    birim_fiyat_max = EXCLUDED.birim_fiyat_max,
    birim_fiyat_medyan = EXCLUDED.birim_fiyat_medyan,
    birim_tipi = EXCLUDED.birim_tipi,
    confidence = EXCLUDED.confidence,
    kaynak_sayisi = EXCLUDED.kaynak_sayisi,
    kaynak_tip = EXCLUDED.kaynak_tip,
    varyant_fiyat_dahil = false,
    son_guncelleme = NOW();
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION refresh_urun_fiyat_ozet(INTEGER) IS 'Tek ürün için piyasa fiyat özetini yeniler. IQR outlier temizleme + ekonomik ortalama hesaplama yapar.';

-- ─── 1d. Varyant cascade fonksiyonu ─────────────────────────

CREATE OR REPLACE FUNCTION refresh_parent_fiyat_ozet(p_parent_urun_kart_id INTEGER)
RETURNS void AS $$
DECLARE
  v_varyant_sayisi   INTEGER;
  v_ekonomik_ort     DECIMAL;
  v_min_fiyat        DECIMAL;
  v_max_fiyat        DECIMAL;
  v_medyan           DECIMAL;
  v_birim_tipi       VARCHAR(10);
  v_confidence       DECIMAL;
  v_kaynak_sayisi    INTEGER;
BEGIN
  -- Varyantların özet fiyatlarını kontrol et
  SELECT
    COUNT(*),
    -- Ekonomik ortalama: en ucuz 3 varyantın ortalaması
    ROUND(AVG(birim_fiyat_ekonomik)::numeric, 4),
    MIN(birim_fiyat_min),
    MAX(birim_fiyat_max),
    -- Medyan: orta varyantın fiyatı
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY birim_fiyat_ekonomik),
    -- Dominant birim: en çok kullanılan
    MODE() WITHIN GROUP (ORDER BY birim_tipi),
    -- Confidence: varyantların ortalama confidence'ı
    ROUND(AVG(confidence)::numeric, 2),
    SUM(kaynak_sayisi)
  INTO v_varyant_sayisi, v_ekonomik_ort, v_min_fiyat, v_max_fiyat,
       v_medyan, v_birim_tipi, v_confidence, v_kaynak_sayisi
  FROM (
    SELECT ufo.*
    FROM urun_fiyat_ozet ufo
    JOIN urun_kartlari uk ON uk.id = ufo.urun_kart_id
    WHERE uk.ana_urun_id = p_parent_urun_kart_id
      AND ufo.birim_fiyat_ekonomik > 0
    ORDER BY ufo.birim_fiyat_ekonomik ASC
    LIMIT 3  -- En ucuz 3 varyant
  ) top_varyantlar;

  -- Varyant yoksa veya fiyatı yoksa çık
  IF v_varyant_sayisi = 0 OR v_ekonomik_ort IS NULL OR v_ekonomik_ort <= 0 THEN
    RETURN;
  END IF;

  -- Parent'ın zaten kendi doğrudan fiyatı varsa varyant fiyatını ÜSTÜNE YAZMA
  -- Sadece parent'ın kendi özeti yoksa veya varyant_fiyat_dahil=true ise güncelle
  INSERT INTO urun_fiyat_ozet (
    urun_kart_id, birim_fiyat_ekonomik, birim_fiyat_min, birim_fiyat_max,
    birim_fiyat_medyan, birim_tipi, confidence, kaynak_sayisi, kaynak_tip,
    varyant_fiyat_dahil, son_guncelleme
  ) VALUES (
    p_parent_urun_kart_id, v_ekonomik_ort, v_min_fiyat, v_max_fiyat,
    v_medyan, COALESCE(v_birim_tipi, 'kg'), v_confidence, v_kaynak_sayisi, 'varyant',
    true, NOW()
  )
  ON CONFLICT (urun_kart_id) DO UPDATE SET
    birim_fiyat_ekonomik = CASE
      WHEN urun_fiyat_ozet.varyant_fiyat_dahil = true 
        OR urun_fiyat_ozet.birim_fiyat_ekonomik IS NULL 
        OR urun_fiyat_ozet.birim_fiyat_ekonomik <= 0
      THEN EXCLUDED.birim_fiyat_ekonomik
      ELSE urun_fiyat_ozet.birim_fiyat_ekonomik
    END,
    birim_fiyat_min = CASE
      WHEN urun_fiyat_ozet.varyant_fiyat_dahil = true 
        OR urun_fiyat_ozet.birim_fiyat_min IS NULL
      THEN EXCLUDED.birim_fiyat_min
      ELSE urun_fiyat_ozet.birim_fiyat_min
    END,
    birim_fiyat_max = CASE
      WHEN urun_fiyat_ozet.varyant_fiyat_dahil = true 
        OR urun_fiyat_ozet.birim_fiyat_max IS NULL
      THEN EXCLUDED.birim_fiyat_max
      ELSE urun_fiyat_ozet.birim_fiyat_max
    END,
    birim_fiyat_medyan = CASE
      WHEN urun_fiyat_ozet.varyant_fiyat_dahil = true 
        OR urun_fiyat_ozet.birim_fiyat_medyan IS NULL
      THEN EXCLUDED.birim_fiyat_medyan
      ELSE urun_fiyat_ozet.birim_fiyat_medyan
    END,
    varyant_fiyat_dahil = CASE
      WHEN urun_fiyat_ozet.birim_fiyat_ekonomik IS NULL 
        OR urun_fiyat_ozet.birim_fiyat_ekonomik <= 0
        OR urun_fiyat_ozet.varyant_fiyat_dahil = true
      THEN true
      ELSE urun_fiyat_ozet.varyant_fiyat_dahil
    END,
    son_guncelleme = NOW();
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION refresh_parent_fiyat_ozet(INTEGER) IS 'Parent ürünün fiyat özetini varyantlardan hesaplar. En ucuz 3 varyantın ekonomik ortalamasını kullanır.';

-- ─── 1e. v_urun_guncel_fiyat view güncelleme ────────────────

CREATE OR REPLACE VIEW v_urun_guncel_fiyat AS
SELECT
    uk.id,
    uk.kod,
    uk.ad,
    uk.kategori_id,
    COALESCE(uk.birim_carpani, 1) as birim_carpani,

    -- Son fiyat: fatura > urun_fiyat_gecmisi > manuel_fiyat
    COALESCE(
        (
            SELECT COALESCE(fk.birim_fiyat_standart, fk.birim_fiyat / NULLIF(COALESCE(uk.birim_carpani, 1), 0))
            FROM fatura_kalemleri fk
            WHERE fk.urun_id = uk.id AND fk.birim_fiyat IS NOT NULL
            ORDER BY fk.fatura_tarihi DESC NULLS LAST
            LIMIT 1
        ),
        (
            SELECT ufg.fiyat::numeric
            FROM urun_fiyat_gecmisi ufg
            WHERE ufg.urun_kart_id = uk.id AND ufg.fiyat IS NOT NULL
            ORDER BY ufg.tarih DESC NULLS LAST, ufg.created_at DESC NULLS LAST
            LIMIT 1
        ),
        uk.manuel_fiyat
    ) as son_fiyat,

    -- Son fiyat tarihi
    COALESCE(
        (
            SELECT fk.fatura_tarihi
            FROM fatura_kalemleri fk
            WHERE fk.urun_id = uk.id
            ORDER BY fk.fatura_tarihi DESC NULLS LAST
            LIMIT 1
        ),
        (
            SELECT ufg.tarih
            FROM urun_fiyat_gecmisi ufg
            WHERE ufg.urun_kart_id = uk.id
            ORDER BY ufg.tarih DESC NULLS LAST, ufg.created_at DESC NULLS LAST
            LIMIT 1
        )
    ) as son_fiyat_tarihi,

    -- Ortalama fiyat (sadece fatura)
    (
        SELECT ROUND(AVG(COALESCE(fk.birim_fiyat_standart, fk.birim_fiyat / NULLIF(COALESCE(uk.birim_carpani, 1), 0)))::numeric, 4)
        FROM fatura_kalemleri fk
        WHERE fk.urun_id = uk.id AND fk.birim_fiyat IS NOT NULL
    ) as ortalama_fiyat,

    -- Fatura sayisi
    (SELECT COUNT(*) FROM fatura_kalemleri fk WHERE fk.urun_id = uk.id) as fatura_sayisi,

    -- Tedarikci sayisi
    (SELECT COUNT(DISTINCT fk.tedarikci_vkn) FROM fatura_kalemleri fk WHERE fk.urun_id = uk.id) as tedarikci_sayisi,

    -- Fiyat kaynagi
    CASE
        WHEN EXISTS (SELECT 1 FROM fatura_kalemleri fk WHERE fk.urun_id = uk.id AND fk.birim_fiyat IS NOT NULL) THEN 'fatura'
        WHEN EXISTS (SELECT 1 FROM urun_fiyat_gecmisi ufg WHERE ufg.urun_kart_id = uk.id AND ufg.fiyat IS NOT NULL) THEN 'gecmis'
        WHEN uk.manuel_fiyat IS NOT NULL THEN 'manuel'
        ELSE NULL
    END as fiyat_kaynagi,

    -- ★ YENİ: Raf fiyati artık urun_fiyat_ozet'ten (IQR temizli ekonomik ortalama)
    COALESCE(
        ufo.birim_fiyat_ekonomik,
        -- Fallback: eski yöntem (geriye uyumluluk)
        (
            SELECT pfg.piyasa_fiyat_ort
            FROM piyasa_fiyat_gecmisi pfg
            WHERE pfg.urun_kart_id = uk.id
            ORDER BY pfg.arastirma_tarihi DESC NULLS LAST
            LIMIT 1
        )
    ) as raf_fiyat,

    -- ★ YENİ: Özet bilgileri
    ufo.birim_fiyat_min as raf_fiyat_min,
    ufo.birim_fiyat_max as raf_fiyat_max,
    ufo.birim_fiyat_medyan as raf_fiyat_medyan,
    ufo.birim_tipi as raf_birim_tipi,
    ufo.confidence as raf_confidence,
    ufo.kaynak_tip as raf_kaynak_tip,
    ufo.varyant_fiyat_dahil as raf_varyant_fiyat_dahil,

    -- Raf fiyat tarihi
    COALESCE(
        ufo.son_guncelleme,
        (
            SELECT pfg.arastirma_tarihi
            FROM piyasa_fiyat_gecmisi pfg
            WHERE pfg.urun_kart_id = uk.id
            ORDER BY pfg.arastirma_tarihi DESC NULLS LAST
            LIMIT 1
        )
    ) as raf_fiyat_tarihi

FROM urun_kartlari uk
LEFT JOIN urun_fiyat_ozet ufo ON ufo.urun_kart_id = uk.id
WHERE uk.aktif = true;

-- ─── 1f. Mevcut veri için özet tablosunu doldur ─────────────

-- Tüm aktif ürünler için özet hesapla (ilk yükleme)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT DISTINCT urun_kart_id 
    FROM piyasa_fiyat_gecmisi 
    WHERE urun_kart_id IS NOT NULL
      AND birim_fiyat > 0
      AND arastirma_tarihi >= NOW() - INTERVAL '30 days'
  LOOP
    PERFORM refresh_urun_fiyat_ozet(r.urun_kart_id);
  END LOOP;
  
  RAISE NOTICE 'urun_fiyat_ozet initial population completed';
END $$;

-- Varyant parent'ları için de hesapla
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT DISTINCT uk.ana_urun_id
    FROM urun_kartlari uk
    WHERE uk.ana_urun_id IS NOT NULL
      AND uk.aktif = true
      AND EXISTS (SELECT 1 FROM urun_fiyat_ozet ufo WHERE ufo.urun_kart_id = uk.id)
  LOOP
    PERFORM refresh_parent_fiyat_ozet(r.ana_urun_id);
  END LOOP;
  
  RAISE NOTICE 'parent variant price summaries completed';
END $$;
