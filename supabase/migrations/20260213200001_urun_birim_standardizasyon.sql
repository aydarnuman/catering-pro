-- ============================================================
-- FAZ 1: Ürün Kartı Birim Standardizasyonu - Veri Migrasyonu
-- ============================================================
-- Amaç: Tüm ürün kartlarını kg/lt/adet standartına taşı
-- Kural: Ürün kartı birimi = kg/lt/adet/demet (gr/ml YASAK)
--        Reçete malzeme birimi = gr/ml/adet/porsiyon (serbest)
-- ============================================================

-- 1. Migrasyon log tablosu (geri dönüş ve audit için)
CREATE TABLE IF NOT EXISTS urun_birim_migrasyon_log (
  id SERIAL PRIMARY KEY,
  urun_kart_id INTEGER NOT NULL,
  urun_adi TEXT,
  islem_tipi VARCHAR(20) NOT NULL, -- 'MERGE', 'STANDARDIZE', 'PRICE_FLAG'
  eski_birim VARCHAR(20),
  yeni_birim VARCHAR(20),
  eski_varsayilan_birim VARCHAR(20),
  yeni_varsayilan_birim VARCHAR(20),
  eski_fiyat_birimi VARCHAR(20),
  yeni_fiyat_birimi VARCHAR(20),
  eski_aktif_fiyat DECIMAL(15,4),
  yeni_aktif_fiyat DECIMAL(15,4),
  eski_aktif BOOLEAN,
  merge_hedef_id INTEGER, -- duplike birleştirmede hedef kart
  aciklama TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Duplike çiftleri birleştir: eski gr kartının reçete bağlantılarını yeni kg kartına taşı
DO $$
DECLARE
  rec RECORD;
  moved_count INTEGER;
BEGIN
  -- Eski (gr birimli, genelde pasif) kartların yeni (kg birimli, aktif) karşılıklarını bul
  FOR rec IN
    SELECT 
      eski.id as eski_id,
      eski.ad as urun_adi,
      eski.birim as eski_birim,
      eski.aktif_fiyat as eski_fiyat,
      eski.aktif as eski_aktif,
      yeni.id as yeni_id,
      yeni.birim as yeni_birim,
      yeni.varsayilan_birim as yeni_varsayilan,
      yeni.aktif_fiyat as yeni_fiyat
    FROM urun_kartlari eski
    JOIN urun_kartlari yeni 
      ON LOWER(TRIM(eski.ad)) = LOWER(TRIM(yeni.ad)) 
      AND eski.id != yeni.id
    WHERE eski.birim = 'gr' 
      AND (yeni.birim IS NULL OR yeni.birim NOT IN ('gr', 'ml'))
      AND yeni.aktif = true
    ORDER BY eski.id
  LOOP
    -- Log: birleştirme kaydı
    INSERT INTO urun_birim_migrasyon_log (
      urun_kart_id, urun_adi, islem_tipi,
      eski_birim, yeni_birim, eski_aktif_fiyat, eski_aktif,
      merge_hedef_id, aciklama
    ) VALUES (
      rec.eski_id, rec.urun_adi, 'MERGE',
      rec.eski_birim, rec.yeni_birim, rec.eski_fiyat, rec.eski_aktif,
      rec.yeni_id,
      format('Birleştirme: %s (id:%s) → %s (id:%s)', rec.urun_adi, rec.eski_id, rec.urun_adi, rec.yeni_id)
    );

    -- Reçete malzeme bağlantılarını taşı (eski → yeni)
    -- Sadece yeni kartta aynı reçetede zaten yoksa taşı (unique constraint koruması)
    UPDATE recete_malzemeler rm
    SET urun_kart_id = rec.yeni_id
    WHERE rm.urun_kart_id = rec.eski_id
      AND NOT EXISTS (
        SELECT 1 FROM recete_malzemeler rm2 
        WHERE rm2.recete_id = rm.recete_id 
          AND rm2.urun_kart_id = rec.yeni_id
      );

    GET DIAGNOSTICS moved_count = ROW_COUNT;

    -- Eski kartı pasif yap ve işaretle
    UPDATE urun_kartlari 
    SET aktif = false,
        kod = COALESCE(kod, '') || '_MERGED_' || rec.yeni_id
    WHERE id = rec.eski_id AND aktif = true;

    IF moved_count > 0 THEN
      RAISE NOTICE 'MERGE: % (id:%) → (id:%), % reçete bağlantısı taşındı', 
        rec.urun_adi, rec.eski_id, rec.yeni_id, moved_count;
    END IF;
  END LOOP;
END $$;

-- 3. Tek kalan gr birimli aktif kartları kg'ye standardize et
-- ml birimli kartları lt'ye standardize et
DO $$
DECLARE
  rec RECORD;
  yeni_birim_val VARCHAR(20);
  fiyat_uyarisi TEXT;
BEGIN
  FOR rec IN
    SELECT id, ad, birim, varsayilan_birim, fiyat_birimi, aktif_fiyat, kategori_id
    FROM urun_kartlari
    WHERE aktif = true
      AND (birim = 'gr' OR birim = 'ml' OR birim = 'ADET')
    ORDER BY id
  LOOP
    -- Hedef birimi belirle
    IF rec.birim = 'gr' THEN
      yeni_birim_val := 'kg';
    ELSIF rec.birim = 'ml' THEN
      yeni_birim_val := 'lt';
    ELSIF rec.birim = 'ADET' THEN
      yeni_birim_val := 'adet';
    ELSE
      yeni_birim_val := rec.birim;
    END IF;

    -- Fiyat uyarısı kontrolü
    fiyat_uyarisi := NULL;
    IF rec.aktif_fiyat IS NOT NULL THEN
      -- Şüpheli fiyat tespiti (kategori bazlı)
      IF rec.aktif_fiyat > 2000 THEN
        fiyat_uyarisi := format('DİKKAT: Yüksek fiyat (%s TL) - kontrol edin', rec.aktif_fiyat);
      ELSIF rec.aktif_fiyat < 1 THEN
        fiyat_uyarisi := format('DİKKAT: Çok düşük fiyat (%s TL) - kontrol edin', rec.aktif_fiyat);
      END IF;
    END IF;

    -- Log kaydı
    INSERT INTO urun_birim_migrasyon_log (
      urun_kart_id, urun_adi, islem_tipi,
      eski_birim, yeni_birim,
      eski_varsayilan_birim, yeni_varsayilan_birim,
      eski_fiyat_birimi, yeni_fiyat_birimi,
      eski_aktif_fiyat, yeni_aktif_fiyat,
      aciklama
    ) VALUES (
      rec.id, rec.ad, 
      CASE WHEN fiyat_uyarisi IS NOT NULL THEN 'PRICE_FLAG' ELSE 'STANDARDIZE' END,
      rec.birim, yeni_birim_val,
      rec.varsayilan_birim, rec.varsayilan_birim, -- varsayilan_birim değişmez
      rec.fiyat_birimi, yeni_birim_val,
      rec.aktif_fiyat, rec.aktif_fiyat, -- fiyat değişmez (zaten kg bazlı olmalı)
      COALESCE(fiyat_uyarisi, format('Standardize: %s → %s', rec.birim, yeni_birim_val))
    );

    -- Kartı güncelle
    UPDATE urun_kartlari 
    SET birim = yeni_birim_val,
        fiyat_birimi = yeni_birim_val,
        updated_at = NOW()
    WHERE id = rec.id;

    RAISE NOTICE 'STANDARDIZE: % (id:%) birim: % → %', rec.ad, rec.id, rec.birim, yeni_birim_val;
  END LOOP;
END $$;

-- 4. NULL birimli kartları da düzelt (varsayilan_birim'den türet)
UPDATE urun_kartlari
SET birim = CASE 
    WHEN LOWER(varsayilan_birim) IN ('gr', 'g', 'gram') THEN 'kg'
    WHEN LOWER(varsayilan_birim) IN ('ml') THEN 'lt'
    WHEN LOWER(varsayilan_birim) IN ('kg') THEN 'kg'
    WHEN LOWER(varsayilan_birim) IN ('lt', 'l', 'litre') THEN 'lt'
    WHEN LOWER(varsayilan_birim) IN ('adet') THEN 'adet'
    WHEN LOWER(varsayilan_birim) IN ('demet') THEN 'demet'
    WHEN LOWER(varsayilan_birim) IN ('porsiyon') THEN 'adet'
    ELSE 'kg'
  END,
  fiyat_birimi = CASE 
    WHEN LOWER(varsayilan_birim) IN ('gr', 'g', 'gram', 'kg') THEN 'kg'
    WHEN LOWER(varsayilan_birim) IN ('ml', 'lt', 'l', 'litre') THEN 'lt'
    WHEN LOWER(varsayilan_birim) IN ('adet') THEN 'adet'
    WHEN LOWER(varsayilan_birim) IN ('demet') THEN 'demet'
    WHEN LOWER(varsayilan_birim) IN ('porsiyon') THEN 'adet'
    ELSE 'kg'
  END,
  updated_at = NOW()
WHERE birim IS NULL AND aktif = true;

-- 5. fiyat_birimi temizliği: 'TL/kg' → 'kg', 'TL/lt' → 'lt', 'TL/adet' → 'adet', 'TL/demet' → 'demet'
UPDATE urun_kartlari
SET fiyat_birimi = REPLACE(REPLACE(fiyat_birimi, 'TL/', ''), 'tl/', '')
WHERE fiyat_birimi LIKE 'TL/%' OR fiyat_birimi LIKE 'tl/%';

-- 6. Özet rapor
DO $$
DECLARE
  merge_count INTEGER;
  std_count INTEGER;
  flag_count INTEGER;
  remaining_gr INTEGER;
BEGIN
  SELECT COUNT(*) INTO merge_count FROM urun_birim_migrasyon_log WHERE islem_tipi = 'MERGE';
  SELECT COUNT(*) INTO std_count FROM urun_birim_migrasyon_log WHERE islem_tipi = 'STANDARDIZE';
  SELECT COUNT(*) INTO flag_count FROM urun_birim_migrasyon_log WHERE islem_tipi = 'PRICE_FLAG';
  SELECT COUNT(*) INTO remaining_gr FROM urun_kartlari WHERE birim IN ('gr', 'ml') AND aktif = true;

  RAISE NOTICE '================================================';
  RAISE NOTICE 'BİRİM STANDARDİZASYON RAPORU';
  RAISE NOTICE '================================================';
  RAISE NOTICE 'Birleştirilen duplike çift: %', merge_count;
  RAISE NOTICE 'Standardize edilen kart:    %', std_count;
  RAISE NOTICE 'Şüpheli fiyat uyarısı:     %', flag_count;
  RAISE NOTICE 'Kalan gr/ml kart (aktif):   %', remaining_gr;
  RAISE NOTICE '================================================';
END $$;
