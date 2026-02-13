-- v_recete_malzeme_maliyet view'ını birim dönüşüm desteği ile güncelle
-- Eski: aktif_miktar * aktif_fiyat (birim dönüşümü yok → yanlış sonuç)
-- Yeni: aktif_miktar * dönüşüm_çarpanı * aktif_fiyat (doğru sonuç)
DROP VIEW IF EXISTS v_recete_malzeme_maliyet;

CREATE VIEW v_recete_malzeme_maliyet AS
SELECT 
  rm.id,
  rm.recete_id,
  rm.malzeme_adi,
  rm.miktar AS sistem_miktar,
  rm.sef_miktar,
  rm.aktif_miktar_tipi,
  get_aktif_miktar(rm.miktar, rm.sef_miktar, rm.aktif_miktar_tipi) AS aktif_miktar,
  rm.birim,
  uk.aktif_fiyat AS birim_fiyat,
  uk.birim AS urun_birim,
  -- Birim dönüşüm çarpanı
  COALESCE(
    bd.carpan,
    CASE 
      WHEN LOWER(COALESCE(be.standart, rm.birim)) IN ('g', 'gr', 'ml') THEN 0.001
      ELSE 1
    END
  ) AS donusum_carpani,
  -- Doğru maliyet hesabı: miktar × dönüşüm_çarpanı × fiyat
  get_aktif_miktar(rm.miktar, rm.sef_miktar, rm.aktif_miktar_tipi) 
    * COALESCE(
        bd.carpan,
        CASE 
          WHEN LOWER(COALESCE(be.standart, rm.birim)) IN ('g', 'gr', 'ml') THEN 0.001
          ELSE 1
        END
      ) 
    * COALESCE(uk.aktif_fiyat, 0) AS toplam_maliyet
FROM recete_malzemeler rm
LEFT JOIN urun_kartlari uk ON uk.id = rm.urun_kart_id
LEFT JOIN birim_eslestirme be ON be.varyasyon = rm.birim
LEFT JOIN birim_donusumleri bd 
  ON bd.kaynak_birim = COALESCE(be.standart, LOWER(rm.birim)) 
  AND bd.hedef_birim = COALESCE(LOWER(uk.birim), 'kg');

COMMENT ON VIEW v_recete_malzeme_maliyet IS 
  'Reçete malzeme maliyeti - birim_donusumleri tablosu ile doğru g→kg dönüşümü yapılır.';
