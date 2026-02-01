-- =====================================================
-- 117: PİYASA VERİSİ AKILLI EŞLEŞTİRME SİSTEMİ
-- =====================================================
-- Piyasa fiyat verilerini ürün kartlarına otomatik eşleştir
-- ve fiyat geçmişine aktar

-- 1. PİYASA VERİSİ İÇİN AKILLI EŞLEŞTİRME FONKSİYONU
-- =====================================================
CREATE OR REPLACE FUNCTION piyasa_akilli_eslestir(
  p_urun_adi TEXT,
  p_min_benzerlik FLOAT DEFAULT 0.6
)
RETURNS TABLE (
  urun_kart_id INTEGER,
  urun_kart_adi TEXT,
  urun_kart_kod TEXT,
  benzerlik FLOAT,
  eslesme_tipi TEXT,
  guven_skoru INTEGER
) AS $$
DECLARE
  v_normalized_adi TEXT;
  v_clean_adi TEXT;
BEGIN
  -- Normalize: küçük harf, trim, özel karakterleri temizle
  v_normalized_adi := LOWER(TRIM(p_urun_adi));
  
  -- Gramaj/ağırlık bilgilerini temizle (1kg, 5lt, 750g vb.)
  v_clean_adi := REGEXP_REPLACE(v_normalized_adi, '\s*\d+[\.,]?\d*\s*(kg|gr|g|lt|l|ml|adet|ad)\s*$', '', 'gi');
  v_clean_adi := REGEXP_REPLACE(v_clean_adi, '^\d+[\.,]?\d*\s*(kg|gr|g|lt|l|ml|adet|ad)\s+', '', 'gi');
  v_clean_adi := TRIM(v_clean_adi);
  
  -- Boş kaldıysa orijinal kullan
  IF v_clean_adi = '' OR v_clean_adi IS NULL THEN
    v_clean_adi := v_normalized_adi;
  END IF;

  RETURN QUERY
  WITH eslesmeler AS (
    SELECT 
      uk.id,
      uk.ad,
      uk.kod,
      -- Birden fazla benzerlik metriği
      similarity(v_normalized_adi, LOWER(uk.ad)) as sim_orijinal,
      similarity(v_clean_adi, LOWER(uk.ad)) as sim_temiz,
      similarity(v_clean_adi, LOWER(REGEXP_REPLACE(uk.ad, '\s*\([^)]+\)\s*', '', 'g'))) as sim_parantez_yok,
      -- Tam eşleşme kontrolü
      CASE WHEN v_normalized_adi = LOWER(uk.ad) THEN 1.0 ELSE 0.0 END as tam_eslesme,
      CASE WHEN v_clean_adi = LOWER(uk.ad) THEN 1.0 ELSE 0.0 END as temiz_tam_eslesme,
      -- İçerme kontrolü
      CASE WHEN LOWER(uk.ad) LIKE '%' || v_clean_adi || '%' THEN 0.3 ELSE 0.0 END as icerme_bonus
    FROM urun_kartlari uk
    WHERE uk.aktif = true
  ),
  skorlu AS (
    SELECT 
      e.id,
      e.ad,
      e.kod,
      -- En yüksek benzerliği al + bonusları ekle
      GREATEST(e.sim_orijinal, e.sim_temiz, e.sim_parantez_yok, e.tam_eslesme, e.temiz_tam_eslesme) 
        + e.icerme_bonus as toplam_skor,
      e.tam_eslesme,
      e.temiz_tam_eslesme
    FROM eslesmeler e
  )
  SELECT 
    s.id as urun_kart_id,
    s.ad as urun_kart_adi,
    s.kod as urun_kart_kod,
    ROUND(s.toplam_skor::numeric, 4)::FLOAT as benzerlik,
    CASE 
      WHEN s.tam_eslesme = 1.0 OR s.temiz_tam_eslesme = 1.0 THEN 'TAM_ESLESME'
      WHEN s.toplam_skor >= 0.85 THEN 'COK_YUKSEK'
      WHEN s.toplam_skor >= 0.70 THEN 'YUKSEK'
      WHEN s.toplam_skor >= 0.50 THEN 'ORTA'
      ELSE 'DUSUK'
    END as eslesme_tipi,
    -- Güven skoru: 0-100 arası
    CASE 
      WHEN s.tam_eslesme = 1.0 THEN 100
      WHEN s.temiz_tam_eslesme = 1.0 THEN 98
      WHEN s.toplam_skor >= 0.90 THEN 95
      WHEN s.toplam_skor >= 0.80 THEN 88
      WHEN s.toplam_skor >= 0.70 THEN 78
      WHEN s.toplam_skor >= 0.60 THEN 65
      ELSE 50
    END as guven_skoru
  FROM skorlu s
  WHERE s.toplam_skor >= p_min_benzerlik
  ORDER BY s.toplam_skor DESC
  LIMIT 3;  -- En iyi 3 öneriyi döndür
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION piyasa_akilli_eslestir IS 
'Piyasa ürün adını ürün kartlarıyla akıllı eşleştirir. 
Gramaj/birim bilgilerini temizler, fuzzy matching yapar, güven skoru hesaplar.';


-- 2. PİYASA VERİSİNİ FİYAT GEÇMİŞİNE AKTARMA FONKSİYONU
-- =====================================================
CREATE OR REPLACE FUNCTION piyasa_fiyat_aktar(
  p_piyasa_id INTEGER,
  p_min_guven INTEGER DEFAULT 85
)
RETURNS TABLE (
  basarili BOOLEAN,
  mesaj TEXT,
  urun_kart_id INTEGER,
  guven INTEGER
) AS $$
DECLARE
  v_piyasa RECORD;
  v_eslesme RECORD;
  v_piyasa_kaynak_id INTEGER;
  v_fiyat DECIMAL(15,4);
BEGIN
  -- Piyasa kaydını al
  SELECT * INTO v_piyasa FROM piyasa_fiyat_gecmisi WHERE id = p_piyasa_id;
  
  IF v_piyasa IS NULL THEN
    RETURN QUERY SELECT false, 'Piyasa kaydı bulunamadı', NULL::INTEGER, 0;
    RETURN;
  END IF;
  
  -- Zaten eşleştirilmiş mi?
  IF v_piyasa.stok_kart_id IS NOT NULL THEN
    RETURN QUERY SELECT true, 'Zaten eşleştirilmiş', v_piyasa.stok_kart_id, 100;
    RETURN;
  END IF;
  
  -- PIYASA kaynak ID'sini al
  SELECT id INTO v_piyasa_kaynak_id 
  FROM fiyat_kaynaklari 
  WHERE kod = 'PIYASA' 
  LIMIT 1;
  
  -- Yoksa oluştur
  IF v_piyasa_kaynak_id IS NULL THEN
    INSERT INTO fiyat_kaynaklari (kod, ad, aciklama, oncelik, guvenilirlik_skoru, aktif)
    VALUES ('PIYASA', 'Piyasa Araştırması', 'Market/TZOB/HAL fiyat verileri', 3, 80, true)
    RETURNING id INTO v_piyasa_kaynak_id;
  END IF;
  
  -- En iyi eşleşmeyi bul
  SELECT * INTO v_eslesme 
  FROM piyasa_akilli_eslestir(v_piyasa.urun_adi, 0.5)
  LIMIT 1;
  
  -- Eşleşme yok
  IF v_eslesme IS NULL THEN
    RETURN QUERY SELECT false, 'Eşleşme bulunamadı: ' || v_piyasa.urun_adi, NULL::INTEGER, 0;
    RETURN;
  END IF;
  
  -- Güven çok düşük
  IF v_eslesme.guven_skoru < p_min_guven THEN
    -- Kuyruğa ekle (varsa)
    BEGIN
      INSERT INTO eslestirme_kuyrugu (
        kaynak_tip, kaynak_id, orijinal_ad, birim, fiyat,
        onerilen_urun_id, onerilen_guven, oneri_yontemi, durum
      ) VALUES (
        'piyasa', p_piyasa_id, v_piyasa.urun_adi, 'kg', 
        COALESCE(v_piyasa.piyasa_fiyat_ort, v_piyasa.birim_fiyat),
        v_eslesme.urun_kart_id, v_eslesme.guven_skoru, 'fuzzy', 'bekliyor'
      ) ON CONFLICT (kaynak_tip, kaynak_id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      -- Kuyruk tablosu yoksa sessizce devam et
      NULL;
    END;
    
    RETURN QUERY SELECT false, 
      'Düşük güven (' || v_eslesme.guven_skoru || '): ' || v_piyasa.urun_adi || ' -> ' || v_eslesme.urun_kart_adi,
      v_eslesme.urun_kart_id, v_eslesme.guven_skoru;
    RETURN;
  END IF;
  
  -- Fiyatı belirle (birim_fiyat > piyasa_fiyat_ort > bm_fiyat)
  v_fiyat := COALESCE(v_piyasa.birim_fiyat, v_piyasa.piyasa_fiyat_ort, v_piyasa.bm_fiyat);
  
  IF v_fiyat IS NULL OR v_fiyat <= 0 THEN
    RETURN QUERY SELECT false, 'Geçersiz fiyat', v_eslesme.urun_kart_id, v_eslesme.guven_skoru;
    RETURN;
  END IF;
  
  -- Piyasa kaydını güncelle
  UPDATE piyasa_fiyat_gecmisi 
  SET stok_kart_id = v_eslesme.urun_kart_id
  WHERE id = p_piyasa_id;
  
  -- Fiyat geçmişine ekle (trigger aktif_fiyat'ı güncelleyecek)
  INSERT INTO urun_fiyat_gecmisi (
    urun_kart_id, 
    fiyat, 
    kaynak_id, 
    kaynak,
    tarih, 
    aciklama, 
    dogrulanmis
  ) VALUES (
    v_eslesme.urun_kart_id,
    v_fiyat,
    v_piyasa_kaynak_id,
    'Piyasa: ' || COALESCE(v_piyasa.market_adi, 'Araştırma'),
    COALESCE(v_piyasa.arastirma_tarihi::date, CURRENT_DATE),
    'Piyasa fiyatı - ' || v_piyasa.urun_adi || 
      CASE WHEN v_piyasa.marka IS NOT NULL THEN ' (' || v_piyasa.marka || ')' ELSE '' END,
    true
  ) ON CONFLICT DO NOTHING;
  
  RETURN QUERY SELECT true, 
    'Eşleştirildi (' || v_eslesme.guven_skoru || '%): ' || v_piyasa.urun_adi || ' -> ' || v_eslesme.urun_kart_adi,
    v_eslesme.urun_kart_id, v_eslesme.guven_skoru;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION piyasa_fiyat_aktar IS 
'Tek piyasa kaydını eşleştirip fiyat geçmişine aktarır.
p_min_guven: Minimum güven skoru (default: 85). Altındakiler kuyruğa gider.';


-- 3. TOPLU PİYASA EŞLEŞTİRME FONKSİYONU
-- =====================================================
CREATE OR REPLACE FUNCTION piyasa_toplu_eslestir(
  p_min_guven INTEGER DEFAULT 85,
  p_limit INTEGER DEFAULT 500
)
RETURNS TABLE (
  toplam INTEGER,
  basarili INTEGER,
  dusuk_guven INTEGER,
  hata INTEGER
) AS $$
DECLARE
  v_rec RECORD;
  v_result RECORD;
  v_toplam INTEGER := 0;
  v_basarili INTEGER := 0;
  v_dusuk INTEGER := 0;
  v_hata INTEGER := 0;
BEGIN
  FOR v_rec IN 
    SELECT id 
    FROM piyasa_fiyat_gecmisi 
    WHERE stok_kart_id IS NULL
    ORDER BY arastirma_tarihi DESC
    LIMIT p_limit
  LOOP
    v_toplam := v_toplam + 1;
    
    SELECT * INTO v_result FROM piyasa_fiyat_aktar(v_rec.id, p_min_guven);
    
    IF v_result.basarili THEN
      v_basarili := v_basarili + 1;
    ELSIF v_result.guven > 0 THEN
      v_dusuk := v_dusuk + 1;
    ELSE
      v_hata := v_hata + 1;
    END IF;
  END LOOP;
  
  RETURN QUERY SELECT v_toplam, v_basarili, v_dusuk, v_hata;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION piyasa_toplu_eslestir IS 
'Eşleştirilmemiş tüm piyasa kayıtlarını toplu işler.';


-- 4. YENİ PİYASA VERİSİ İÇİN TRIGGER
-- =====================================================
CREATE OR REPLACE FUNCTION trg_piyasa_otomatik_eslestir()
RETURNS TRIGGER AS $$
DECLARE
  v_result RECORD;
BEGIN
  -- Sadece yeni kayıtlarda ve stok_kart_id NULL ise
  IF NEW.stok_kart_id IS NULL AND NEW.urun_adi IS NOT NULL THEN
    -- Yüksek güvenli eşleştirme yap (>= 88)
    SELECT * INTO v_result FROM piyasa_fiyat_aktar(NEW.id, 88);
    
    -- Başarılıysa stok_kart_id'yi güncelle
    IF v_result.basarili AND v_result.urun_kart_id IS NOT NULL THEN
      NEW.stok_kart_id := v_result.urun_kart_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Mevcut trigger'ı kaldır (varsa)
DROP TRIGGER IF EXISTS trg_piyasa_auto_eslestir ON piyasa_fiyat_gecmisi;

-- Yeni trigger oluştur
CREATE TRIGGER trg_piyasa_auto_eslestir
AFTER INSERT ON piyasa_fiyat_gecmisi
FOR EACH ROW
EXECUTE FUNCTION trg_piyasa_otomatik_eslestir();

COMMENT ON TRIGGER trg_piyasa_auto_eslestir ON piyasa_fiyat_gecmisi IS 
'Yeni piyasa verisi eklendiğinde otomatik eşleştirme yapar.';


-- 5. PİYASA EŞLEŞTİRME DURUMU VIEW'I
-- =====================================================
CREATE OR REPLACE VIEW v_piyasa_eslestirme_durumu AS
SELECT 
  COUNT(*) as toplam_kayit,
  COUNT(*) FILTER (WHERE stok_kart_id IS NOT NULL) as eslesen,
  COUNT(*) FILTER (WHERE stok_kart_id IS NULL) as eslesmemis,
  ROUND(100.0 * COUNT(*) FILTER (WHERE stok_kart_id IS NOT NULL) / NULLIF(COUNT(*), 0), 1) as eslesme_yuzdesi,
  COUNT(DISTINCT stok_kart_id) FILTER (WHERE stok_kart_id IS NOT NULL) as benzersiz_urun,
  MAX(arastirma_tarihi) as son_arastirma
FROM piyasa_fiyat_gecmisi;

COMMENT ON VIEW v_piyasa_eslestirme_durumu IS 'Piyasa verisi eşleştirme istatistikleri';


-- 6. PİYASA ÜRÜNLERİ İLE ÜRÜN KARTLARI KARŞILAŞTIRMA VIEW'I
-- =====================================================
CREATE OR REPLACE VIEW v_piyasa_urun_karsilastirma AS
WITH piyasa_ozet AS (
  SELECT 
    LOWER(TRIM(urun_adi)) as piyasa_adi,
    COUNT(*) as kayit_sayisi,
    AVG(piyasa_fiyat_ort) as ort_fiyat,
    MAX(arastirma_tarihi) as son_tarih,
    MAX(stok_kart_id) as eslesme_id
  FROM piyasa_fiyat_gecmisi
  GROUP BY LOWER(TRIM(urun_adi))
)
SELECT 
  po.piyasa_adi,
  po.kayit_sayisi,
  ROUND(po.ort_fiyat::numeric, 2) as ort_fiyat,
  po.son_tarih,
  po.eslesme_id,
  uk.ad as eslesen_urun,
  uk.kod as eslesen_kod,
  CASE WHEN po.eslesme_id IS NOT NULL THEN 'ESLESMIS' ELSE 'BEKLIYOR' END as durum
FROM piyasa_ozet po
LEFT JOIN urun_kartlari uk ON uk.id = po.eslesme_id
ORDER BY po.kayit_sayisi DESC, po.piyasa_adi;

COMMENT ON VIEW v_piyasa_urun_karsilastirma IS 'Piyasa ürünleri ve ürün kartları karşılaştırması';

-- İndeks ekle (performans için)
CREATE INDEX IF NOT EXISTS idx_piyasa_stok_kart_id ON piyasa_fiyat_gecmisi(stok_kart_id);
CREATE INDEX IF NOT EXISTS idx_piyasa_urun_adi_lower ON piyasa_fiyat_gecmisi(LOWER(urun_adi));

SELECT 'Migration 117: Piyasa akıllı eşleştirme sistemi kuruldu' as status;
