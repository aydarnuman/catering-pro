-- 118: VARSAYILAN fiyat tipini kaldır
-- Sahte veri önleme - fiyat yoksa NULL dönsün, backend AI tahmini yapacak

-- =====================================================
-- 1. recalc_urun_aktif_fiyat FONKSİYONUNU GÜNCELLE
-- =====================================================
CREATE OR REPLACE FUNCTION recalc_urun_aktif_fiyat(p_urun_id INTEGER)
RETURNS TABLE(fiyat DECIMAL(15,4), tip VARCHAR(20), kaynak_id INTEGER, guven INTEGER) AS $$
DECLARE
  v_fiyat DECIMAL(15,4);
  v_tip VARCHAR(20);
  v_kaynak_id INTEGER;
  v_guven INTEGER := 0;
  v_sozlesme_fiyat DECIMAL(15,4);
  v_fatura_fiyat DECIMAL(15,4);
  v_piyasa_fiyat DECIMAL(15,4);
  v_fatura_eski_fiyat DECIMAL(15,4);
  v_manuel_fiyat DECIMAL(15,4);
BEGIN
  -- Kaynak ID'lerini al
  DECLARE
    FATURA_KAYNAK INTEGER := (SELECT id FROM fiyat_kaynaklari WHERE kod = 'FATURA');
    TEDARIKCI_KAYNAK INTEGER := (SELECT id FROM fiyat_kaynaklari WHERE kod = 'TEDARIKCI');
    PIYASA_KAYNAK INTEGER := (SELECT id FROM fiyat_kaynaklari WHERE kod IN ('TZOB', 'ESK', 'HAL', 'TOBB', 'EPDK') LIMIT 1);
    MANUEL_KAYNAK INTEGER := (SELECT id FROM fiyat_kaynaklari WHERE kod = 'MANUEL');
  BEGIN

  -- 1. SOZLESME - Aktif tedarikçi sözleşmesi (güven: 100)
  SELECT tf.fiyat INTO v_sozlesme_fiyat
  FROM tedarikci_fiyatlari tf
  WHERE tf.urun_kart_id = p_urun_id
    AND tf.aktif = true
    AND (tf.gecerlilik_bitis IS NULL OR tf.gecerlilik_bitis >= CURRENT_DATE)
    AND (tf.gecerlilik_baslangic IS NULL OR tf.gecerlilik_baslangic <= CURRENT_DATE)
  ORDER BY tf.oncelik NULLS LAST, tf.fiyat ASC
  LIMIT 1;

  IF v_sozlesme_fiyat IS NOT NULL THEN
    v_fiyat := v_sozlesme_fiyat;
    v_tip := 'SOZLESME';
    v_kaynak_id := TEDARIKCI_KAYNAK;
    v_guven := 100;
    
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

  -- 2. FATURA - Son 30 gün içinde fatura (güven: 95)
  SELECT AVG(ufg.fiyat) INTO v_fatura_fiyat
  FROM urun_fiyat_gecmisi ufg
  WHERE ufg.urun_kart_id = p_urun_id
    AND ufg.tarih >= CURRENT_DATE - INTERVAL '30 days'
    AND (ufg.kaynak ILIKE '%fatura%' OR ufg.kaynak_id = FATURA_KAYNAK);

  IF v_fatura_fiyat IS NOT NULL THEN
    v_fiyat := v_fatura_fiyat;
    v_tip := 'FATURA';
    v_kaynak_id := FATURA_KAYNAK;
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

  -- 3. PIYASA - Son 14 gün içinde piyasa verisi (güven: 80)
  SELECT AVG(ufg.fiyat) INTO v_piyasa_fiyat
  FROM urun_fiyat_gecmisi ufg
  LEFT JOIN fiyat_kaynaklari fk ON fk.id = ufg.kaynak_id
  WHERE ufg.urun_kart_id = p_urun_id
    AND ufg.tarih >= CURRENT_DATE - INTERVAL '14 days'
    AND (fk.kod IN ('TZOB', 'ESK', 'HAL', 'TOBB', 'EPDK') OR ufg.kaynak ILIKE '%piyasa%');

  IF v_piyasa_fiyat IS NOT NULL THEN
    v_fiyat := v_piyasa_fiyat;
    v_tip := 'PIYASA';
    v_kaynak_id := PIYASA_KAYNAK;
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

  -- 4. FATURA_ESKI - 30-90 gün önceki fatura (güven: 60)
  SELECT AVG(ufg.fiyat) INTO v_fatura_eski_fiyat
  FROM urun_fiyat_gecmisi ufg
  WHERE ufg.urun_kart_id = p_urun_id
    AND ufg.tarih >= CURRENT_DATE - INTERVAL '90 days'
    AND ufg.tarih < CURRENT_DATE - INTERVAL '30 days'
    AND (ufg.kaynak ILIKE '%fatura%' OR ufg.kaynak_id = FATURA_KAYNAK);

  IF v_fatura_eski_fiyat IS NOT NULL THEN
    v_fiyat := v_fatura_eski_fiyat;
    v_tip := 'FATURA_ESKI';
    v_kaynak_id := FATURA_KAYNAK;
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

  -- 5. MANUEL - Fiyat geçmişinde manuel kayıt (güven: 50)
  SELECT ufg.fiyat INTO v_manuel_fiyat
  FROM urun_fiyat_gecmisi ufg
  WHERE ufg.urun_kart_id = p_urun_id
    AND (ufg.kaynak ILIKE '%manuel%' OR ufg.kaynak_id = MANUEL_KAYNAK)
  ORDER BY ufg.tarih DESC
  LIMIT 1;

  IF v_manuel_fiyat IS NOT NULL THEN
    v_fiyat := v_manuel_fiyat;
    v_tip := 'MANUEL';
    v_kaynak_id := MANUEL_KAYNAK;
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

  -- 6. VARSAYILAN KALDIRILDI!
  -- Artık sahte fiyat döndürmüyoruz
  -- Backend AI tahmini yapacak (hesaplaAktifFiyat fonksiyonu)

  -- Hiç fiyat bulunamadı - NULL döndür
  UPDATE urun_kartlari SET
    aktif_fiyat = NULL,
    aktif_fiyat_tipi = NULL,
    aktif_fiyat_kaynagi_id = NULL,
    aktif_fiyat_guven = 0,
    aktif_fiyat_guncelleme = NOW()
  WHERE id = p_urun_id;
  
  RETURN QUERY SELECT NULL::DECIMAL(15,4), NULL::VARCHAR(20), NULL::INTEGER, 0::INTEGER;

  END; -- DECLARE bloğu sonu
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 2. AI_TAHMINI KAYNAK TIPINI GÜNCELLE
-- =====================================================
UPDATE fiyat_kaynaklari 
SET guvenilirlik_skoru = 40, aciklama = 'Claude AI ile piyasa tahmini (gerçek fiyat olmadığında)'
WHERE kod = 'AI_TAHMINI';

-- Yoksa ekle
INSERT INTO fiyat_kaynaklari (kod, ad, aciklama, guvenilirlik_skoru, guncelleme_sikligi, kaynak_tipi)
VALUES ('AI_TAHMINI', 'AI Fiyat Tahmini', 'Claude AI ile piyasa tahmini (gerçek fiyat olmadığında)', 40, 'gunluk', 'ai')
ON CONFLICT (kod) DO NOTHING;

-- =====================================================
-- 3. VARSAYILAN FİYATLARINI TEMİZLE
-- =====================================================
-- Mevcut VARSAYILAN fiyatları NULL yap (AI tekrar hesaplayacak)
UPDATE urun_kartlari SET
  aktif_fiyat = NULL,
  aktif_fiyat_tipi = NULL,
  aktif_fiyat_guven = 0
WHERE aktif_fiyat_tipi = 'VARSAYILAN';

COMMENT ON FUNCTION recalc_urun_aktif_fiyat IS 
'Ürün aktif fiyatını hesaplar. Öncelik: SOZLESME > FATURA > PIYASA > FATURA_ESKI > MANUEL. 
Fiyat bulunamazsa NULL döndürür, backend AI tahmini yapar.';
