-- =====================================================
-- 115: Merkezi Fiyat Mimarisi
-- Single Source of Truth - aktif_fiyat sistemi
-- =====================================================

-- =====================================================
-- 1. ÜRÜN KARTLARINA AKTİF FİYAT ALANLARI
-- =====================================================
-- Mevcut alanları koruyoruz (geriye uyumluluk)
-- Yeni merkezi alanlar ekliyoruz

ALTER TABLE urun_kartlari ADD COLUMN IF NOT EXISTS aktif_fiyat DECIMAL(15,4);
ALTER TABLE urun_kartlari ADD COLUMN IF NOT EXISTS aktif_fiyat_tipi VARCHAR(20);  -- SOZLESME/FATURA/PIYASA/MANUEL/VARSAYILAN
ALTER TABLE urun_kartlari ADD COLUMN IF NOT EXISTS aktif_fiyat_kaynagi_id INTEGER REFERENCES fiyat_kaynaklari(id);
ALTER TABLE urun_kartlari ADD COLUMN IF NOT EXISTS aktif_fiyat_guncelleme TIMESTAMPTZ;
ALTER TABLE urun_kartlari ADD COLUMN IF NOT EXISTS aktif_fiyat_guven INTEGER DEFAULT 30;  -- 0-100 güven skoru

-- Fatura kaynağı için ID
DO $$
BEGIN
  -- FATURA kaynağı yoksa ekle
  INSERT INTO fiyat_kaynaklari (kod, ad, aciklama, guvenilirlik_skoru, guncelleme_sikligi, veri_tipi)
  VALUES ('FATURA', 'Fatura Girişi', 'Gelen faturalardan otomatik çekilen fiyatlar', 95, 'anlik', 'manuel')
  ON CONFLICT (kod) DO NOTHING;
END $$;

-- =====================================================
-- 2. AKTİF FİYAT HESAPLAMA FONKSİYONU
-- =====================================================
-- Öncelik Sırası:
-- 1. Aktif tedarikçi sözleşmesi (güven: 100)
-- 2. Son 30 gün fatura (güven: 95)
-- 3. Piyasa verisi - TZOB/ESK/HAL (güven: 80)
-- 4. Eski fatura 30-90 gün (güven: 60)
-- 5. Manuel giriş (güven: 50)
-- 6. Varsayılan/manuel_fiyat (güven: 30)

CREATE OR REPLACE FUNCTION recalc_urun_aktif_fiyat(p_urun_id INTEGER)
RETURNS TABLE (
  fiyat DECIMAL(15,4),
  tip VARCHAR(20),
  kaynak_id INTEGER,
  guven INTEGER
) AS $$
DECLARE
  v_fiyat DECIMAL(15,4);
  v_tip VARCHAR(20);
  v_kaynak_id INTEGER;
  v_guven INTEGER;
  v_tedarikci_fiyat RECORD;
  v_fatura_fiyat RECORD;
  v_piyasa_fiyat RECORD;
  v_eski_fatura RECORD;
  v_manuel_fiyat RECORD;
  v_varsayilan_fiyat DECIMAL(15,4);
BEGIN
  -- 1. AKTİF TEDARİKÇİ SÖZLEŞMESİ (güven: 100)
  SELECT tf.fiyat, tf.cari_id, fk.id as kaynak_id
  INTO v_tedarikci_fiyat
  FROM tedarikci_fiyatlari tf
  LEFT JOIN fiyat_kaynaklari fk ON fk.kod = 'TEDARIKCI'
  WHERE tf.urun_kart_id = p_urun_id
    AND tf.aktif = true
    AND (tf.gecerlilik_bitis IS NULL OR tf.gecerlilik_bitis >= CURRENT_DATE)
    AND (tf.gecerlilik_baslangic IS NULL OR tf.gecerlilik_baslangic <= CURRENT_DATE)
  ORDER BY tf.oncelik ASC, tf.fiyat ASC
  LIMIT 1;

  IF v_tedarikci_fiyat.fiyat IS NOT NULL THEN
    v_fiyat := v_tedarikci_fiyat.fiyat;
    v_tip := 'SOZLESME';
    v_kaynak_id := v_tedarikci_fiyat.kaynak_id;
    v_guven := 100;
    
    -- Güncelle ve dön
    UPDATE urun_kartlari SET
      aktif_fiyat = v_fiyat,
      aktif_fiyat_tipi = v_tip,
      aktif_fiyat_kaynagi_id = v_kaynak_id,
      aktif_fiyat_guven = v_guven,
      aktif_fiyat_guncelleme = NOW()
    WHERE id = p_urun_id;
    
    RETURN QUERY SELECT v_fiyat, v_tip, v_kaynak_id, v_guven;
    RETURN;
  END IF;

  -- 2. SON 30 GÜN FATURA (güven: 95)
  SELECT 
    ufg.fiyat,
    ufg.kaynak_id,
    COALESCE(ufg.kaynak_id, (SELECT id FROM fiyat_kaynaklari WHERE kod = 'FATURA')) as resolved_kaynak_id
  INTO v_fatura_fiyat
  FROM urun_fiyat_gecmisi ufg
  WHERE ufg.urun_kart_id = p_urun_id
    AND ufg.tarih >= CURRENT_DATE - INTERVAL '30 days'
    AND (ufg.kaynak ILIKE '%fatura%' OR ufg.kaynak_id = (SELECT id FROM fiyat_kaynaklari WHERE kod = 'FATURA'))
  ORDER BY ufg.tarih DESC, ufg.id DESC
  LIMIT 1;

  IF v_fatura_fiyat.fiyat IS NOT NULL THEN
    v_fiyat := v_fatura_fiyat.fiyat;
    v_tip := 'FATURA';
    v_kaynak_id := v_fatura_fiyat.resolved_kaynak_id;
    v_guven := 95;
    
    UPDATE urun_kartlari SET
      aktif_fiyat = v_fiyat,
      aktif_fiyat_tipi = v_tip,
      aktif_fiyat_kaynagi_id = v_kaynak_id,
      aktif_fiyat_guven = v_guven,
      aktif_fiyat_guncelleme = NOW()
    WHERE id = p_urun_id;
    
    RETURN QUERY SELECT v_fiyat, v_tip, v_kaynak_id, v_guven;
    RETURN;
  END IF;

  -- 3. PİYASA VERİSİ - TZOB/ESK/HAL (güven: 80)
  SELECT 
    ufg.fiyat,
    ufg.kaynak_id
  INTO v_piyasa_fiyat
  FROM urun_fiyat_gecmisi ufg
  JOIN fiyat_kaynaklari fk ON fk.id = ufg.kaynak_id
  WHERE ufg.urun_kart_id = p_urun_id
    AND ufg.tarih >= CURRENT_DATE - INTERVAL '14 days'
    AND fk.kod IN ('TZOB', 'ESK', 'HAL', 'TOBB', 'EPDK')
  ORDER BY fk.guvenilirlik_skoru DESC, ufg.tarih DESC
  LIMIT 1;

  IF v_piyasa_fiyat.fiyat IS NOT NULL THEN
    v_fiyat := v_piyasa_fiyat.fiyat;
    v_tip := 'PIYASA';
    v_kaynak_id := v_piyasa_fiyat.kaynak_id;
    v_guven := 80;
    
    UPDATE urun_kartlari SET
      aktif_fiyat = v_fiyat,
      aktif_fiyat_tipi = v_tip,
      aktif_fiyat_kaynagi_id = v_kaynak_id,
      aktif_fiyat_guven = v_guven,
      aktif_fiyat_guncelleme = NOW()
    WHERE id = p_urun_id;
    
    RETURN QUERY SELECT v_fiyat, v_tip, v_kaynak_id, v_guven;
    RETURN;
  END IF;

  -- 4. ESKİ FATURA 30-90 GÜN (güven: 60)
  SELECT 
    ufg.fiyat,
    COALESCE(ufg.kaynak_id, (SELECT id FROM fiyat_kaynaklari WHERE kod = 'FATURA')) as resolved_kaynak_id
  INTO v_eski_fatura
  FROM urun_fiyat_gecmisi ufg
  WHERE ufg.urun_kart_id = p_urun_id
    AND ufg.tarih >= CURRENT_DATE - INTERVAL '90 days'
    AND ufg.tarih < CURRENT_DATE - INTERVAL '30 days'
    AND (ufg.kaynak ILIKE '%fatura%' OR ufg.kaynak_id = (SELECT id FROM fiyat_kaynaklari WHERE kod = 'FATURA'))
  ORDER BY ufg.tarih DESC
  LIMIT 1;

  IF v_eski_fatura.fiyat IS NOT NULL THEN
    v_fiyat := v_eski_fatura.fiyat;
    v_tip := 'FATURA_ESKI';
    v_kaynak_id := v_eski_fatura.resolved_kaynak_id;
    v_guven := 60;
    
    UPDATE urun_kartlari SET
      aktif_fiyat = v_fiyat,
      aktif_fiyat_tipi = v_tip,
      aktif_fiyat_kaynagi_id = v_kaynak_id,
      aktif_fiyat_guven = v_guven,
      aktif_fiyat_guncelleme = NOW()
    WHERE id = p_urun_id;
    
    RETURN QUERY SELECT v_fiyat, v_tip, v_kaynak_id, v_guven;
    RETURN;
  END IF;

  -- 5. MANUEL GİRİŞ (güven: 50)
  SELECT 
    ufg.fiyat,
    COALESCE(ufg.kaynak_id, (SELECT id FROM fiyat_kaynaklari WHERE kod = 'MANUEL')) as resolved_kaynak_id
  INTO v_manuel_fiyat
  FROM urun_fiyat_gecmisi ufg
  WHERE ufg.urun_kart_id = p_urun_id
    AND (ufg.kaynak ILIKE '%manuel%' OR ufg.kaynak_id = (SELECT id FROM fiyat_kaynaklari WHERE kod = 'MANUEL'))
  ORDER BY ufg.tarih DESC, ufg.id DESC
  LIMIT 1;

  IF v_manuel_fiyat.fiyat IS NOT NULL THEN
    v_fiyat := v_manuel_fiyat.fiyat;
    v_tip := 'MANUEL';
    v_kaynak_id := v_manuel_fiyat.resolved_kaynak_id;
    v_guven := 50;
    
    UPDATE urun_kartlari SET
      aktif_fiyat = v_fiyat,
      aktif_fiyat_tipi = v_tip,
      aktif_fiyat_kaynagi_id = v_kaynak_id,
      aktif_fiyat_guven = v_guven,
      aktif_fiyat_guncelleme = NOW()
    WHERE id = p_urun_id;
    
    RETURN QUERY SELECT v_fiyat, v_tip, v_kaynak_id, v_guven;
    RETURN;
  END IF;

  -- 6. VARSAYILAN - manuel_fiyat veya son_alis_fiyati (güven: 30)
  SELECT COALESCE(manuel_fiyat, son_alis_fiyati)
  INTO v_varsayilan_fiyat
  FROM urun_kartlari
  WHERE id = p_urun_id;

  IF v_varsayilan_fiyat IS NOT NULL THEN
    v_fiyat := v_varsayilan_fiyat;
    v_tip := 'VARSAYILAN';
    v_kaynak_id := (SELECT id FROM fiyat_kaynaklari WHERE kod = 'MANUEL');
    v_guven := 30;
    
    UPDATE urun_kartlari SET
      aktif_fiyat = v_fiyat,
      aktif_fiyat_tipi = v_tip,
      aktif_fiyat_kaynagi_id = v_kaynak_id,
      aktif_fiyat_guven = v_guven,
      aktif_fiyat_guncelleme = NOW()
    WHERE id = p_urun_id;
    
    RETURN QUERY SELECT v_fiyat, v_tip, v_kaynak_id, v_guven;
    RETURN;
  END IF;

  -- Hiç fiyat bulunamadı
  UPDATE urun_kartlari SET
    aktif_fiyat = NULL,
    aktif_fiyat_tipi = NULL,
    aktif_fiyat_kaynagi_id = NULL,
    aktif_fiyat_guven = 0,
    aktif_fiyat_guncelleme = NOW()
  WHERE id = p_urun_id;
  
  RETURN QUERY SELECT NULL::DECIMAL(15,4), NULL::VARCHAR(20), NULL::INTEGER, 0::INTEGER;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 3. TRIGGER: FİYAT GEÇMİŞİNE EKLEME SONRASI
-- =====================================================
CREATE OR REPLACE FUNCTION trg_recalc_aktif_fiyat_fn()
RETURNS TRIGGER AS $$
BEGIN
  -- Yeni fiyat girişi sonrası aktif fiyatı yeniden hesapla
  PERFORM recalc_urun_aktif_fiyat(NEW.urun_kart_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger varsa önce sil
DROP TRIGGER IF EXISTS trg_recalc_aktif_fiyat ON urun_fiyat_gecmisi;

-- Yeni trigger oluştur
CREATE TRIGGER trg_recalc_aktif_fiyat
AFTER INSERT ON urun_fiyat_gecmisi
FOR EACH ROW
EXECUTE FUNCTION trg_recalc_aktif_fiyat_fn();

-- =====================================================
-- 4. TEDARİKÇİ FİYATLARI TRİGGER
-- =====================================================
CREATE OR REPLACE FUNCTION trg_tedarikci_fiyat_aktif_fiyat_fn()
RETURNS TRIGGER AS $$
BEGIN
  -- Tedarikçi fiyatı değiştiğinde aktif fiyatı yeniden hesapla
  IF TG_OP = 'DELETE' THEN
    PERFORM recalc_urun_aktif_fiyat(OLD.urun_kart_id);
    RETURN OLD;
  ELSE
    PERFORM recalc_urun_aktif_fiyat(NEW.urun_kart_id);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tedarikci_fiyat_aktif_fiyat ON tedarikci_fiyatlari;

CREATE TRIGGER trg_tedarikci_fiyat_aktif_fiyat
AFTER INSERT OR UPDATE OR DELETE ON tedarikci_fiyatlari
FOR EACH ROW
EXECUTE FUNCTION trg_tedarikci_fiyat_aktif_fiyat_fn();

-- =====================================================
-- 5. MEVCUT VERİLER İÇİN AKTİF FİYATI HESAPLA
-- =====================================================
-- Tüm aktif ürünler için aktif_fiyat hesapla
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM urun_kartlari WHERE aktif = true
  LOOP
    PERFORM recalc_urun_aktif_fiyat(r.id);
  END LOOP;
END $$;

-- =====================================================
-- 6. ÜRÜN FİYAT DURUMU VIEW
-- =====================================================
CREATE OR REPLACE VIEW v_urun_fiyat_durumu AS
SELECT 
  uk.id,
  uk.kod,
  uk.ad,
  uk.kategori_id,
  kat.ad as kategori_ad,
  uk.varsayilan_birim,
  uk.aktif_fiyat,
  uk.aktif_fiyat_tipi,
  uk.aktif_fiyat_guven,
  uk.aktif_fiyat_guncelleme,
  fk.ad as kaynak_adi,
  -- Güncellik durumu
  CASE 
    WHEN uk.aktif_fiyat_guncelleme IS NULL THEN 'belirsiz'
    WHEN uk.aktif_fiyat_guncelleme >= NOW() - INTERVAL '7 days' THEN 'guncel'
    WHEN uk.aktif_fiyat_guncelleme >= NOW() - INTERVAL '30 days' THEN 'eski'
    ELSE 'cok_eski'
  END as guncellik_durumu,
  -- Gün farkı
  EXTRACT(DAY FROM NOW() - uk.aktif_fiyat_guncelleme)::INTEGER as gun_farki,
  -- Eski fiyatlar (karşılaştırma için)
  uk.manuel_fiyat,
  uk.son_alis_fiyati,
  uk.ortalama_fiyat
FROM urun_kartlari uk
LEFT JOIN urun_kategorileri kat ON kat.id = uk.kategori_id
LEFT JOIN fiyat_kaynaklari fk ON fk.id = uk.aktif_fiyat_kaynagi_id
WHERE uk.aktif = true
ORDER BY uk.ad;

-- =====================================================
-- 7. FİYAT ÖZET VIEW (Dashboard için)
-- =====================================================
CREATE OR REPLACE VIEW v_fiyat_ozet AS
SELECT 
  COUNT(*) as toplam_urun,
  COUNT(*) FILTER (WHERE aktif_fiyat IS NOT NULL) as fiyatli_urun,
  COUNT(*) FILTER (WHERE aktif_fiyat_guncelleme >= NOW() - INTERVAL '7 days') as guncel_fiyat,
  COUNT(*) FILTER (WHERE aktif_fiyat_guncelleme < NOW() - INTERVAL '30 days' OR aktif_fiyat_guncelleme IS NULL) as eski_fiyat,
  ROUND(AVG(aktif_fiyat_guven)::numeric, 0) as ortalama_guven,
  COUNT(*) FILTER (WHERE aktif_fiyat_tipi = 'SOZLESME') as sozlesme_fiyatli,
  COUNT(*) FILTER (WHERE aktif_fiyat_tipi = 'FATURA') as fatura_fiyatli,
  COUNT(*) FILTER (WHERE aktif_fiyat_tipi = 'PIYASA') as piyasa_fiyatli,
  COUNT(*) FILTER (WHERE aktif_fiyat_tipi = 'MANUEL') as manuel_fiyatli,
  COUNT(*) FILTER (WHERE aktif_fiyat_tipi = 'VARSAYILAN') as varsayilan_fiyatli
FROM urun_kartlari
WHERE aktif = true;

-- =====================================================
-- 8. KATEGORİ BAZLI FİYAT DURUMU VIEW
-- =====================================================
CREATE OR REPLACE VIEW v_kategori_fiyat_durumu AS
SELECT 
  kat.id as kategori_id,
  kat.ad as kategori_ad,
  COUNT(uk.id) as urun_sayisi,
  COUNT(*) FILTER (WHERE uk.aktif_fiyat IS NOT NULL) as fiyatli_urun,
  COUNT(*) FILTER (WHERE uk.aktif_fiyat_guncelleme >= NOW() - INTERVAL '7 days') as guncel_fiyat,
  COUNT(*) FILTER (WHERE uk.aktif_fiyat_guncelleme < NOW() - INTERVAL '30 days' OR uk.aktif_fiyat_guncelleme IS NULL) as eski_fiyat,
  ROUND(AVG(uk.aktif_fiyat_guven)::numeric, 0) as ortalama_guven,
  ROUND(AVG(uk.aktif_fiyat)::numeric, 2) as ortalama_fiyat
FROM urun_kategorileri kat
LEFT JOIN urun_kartlari uk ON uk.kategori_id = kat.id AND uk.aktif = true
GROUP BY kat.id, kat.ad
ORDER BY kat.ad;

-- =====================================================
-- 9. İNDEXLER
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_urun_kartlari_aktif_fiyat ON urun_kartlari(aktif_fiyat) WHERE aktif = true;
CREATE INDEX IF NOT EXISTS idx_urun_kartlari_aktif_fiyat_tipi ON urun_kartlari(aktif_fiyat_tipi) WHERE aktif = true;
CREATE INDEX IF NOT EXISTS idx_urun_kartlari_aktif_fiyat_guven ON urun_kartlari(aktif_fiyat_guven) WHERE aktif = true;
CREATE INDEX IF NOT EXISTS idx_urun_fiyat_gecmisi_tarih_kaynak ON urun_fiyat_gecmisi(urun_kart_id, tarih DESC, kaynak);
