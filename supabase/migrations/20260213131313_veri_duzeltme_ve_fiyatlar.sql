-- ============================================================
-- VERİ DÜZELTMELERİ + EKSİK FİYATLAR + İZLEME TABLOSU
-- ============================================================

-- ==================== ADIM 1: VERİ DÜZELTMELERİ ====================

-- 1a. Yanlış ürün eşleşmelerini düzelt
-- "Taze Fasulye" malzemesi -> Su (id:98) ile eşleştirilmiş, doğrusu Fasulye (Taze) (id:35)
UPDATE recete_malzemeler 
SET urun_kart_id = 35, 
    birim_fiyat = (SELECT COALESCE(aktif_fiyat, 0) FROM urun_kartlari WHERE id = 35)
WHERE id = 353 AND urun_kart_id = 98;

-- "Zeytin" malzemesi -> Zeytinyağı (id:70) ile eşleştirilmiş, doğrusu Zeytin (Siyah) (id:4877)
UPDATE recete_malzemeler 
SET urun_kart_id = 4877,
    birim_fiyat = (SELECT COALESCE(aktif_fiyat, 0) FROM urun_kartlari WHERE id = 4877)
WHERE id = 375 AND urun_kart_id = 70;

-- "Sıvı Yağ" malzemesi -> urun_kart_id NULL, Ayçiçek Yağı (id:4778) ile eşle
UPDATE recete_malzemeler 
SET urun_kart_id = 4778,
    birim_fiyat = (SELECT COALESCE(aktif_fiyat, 0) FROM urun_kartlari WHERE id = 4778)
WHERE id = 1811 AND urun_kart_id IS NULL;

-- 1b. Reçete birim hatalarını düzelt
-- "Su" birim "adet" -> "ml" (0.25 adet su -> 250 ml su)
UPDATE recete_malzemeler 
SET birim = 'ml', miktar = 250
WHERE id = 1536 AND birim = 'adet' AND miktar = 0.25;

UPDATE recete_malzemeler 
SET birim = 'ml', miktar = 250
WHERE id = 1546 AND birim = 'adet' AND miktar = 0.25;

-- 1c. Soğan (id:22) fiyat anomalisi düzeltme
-- 1271.82 TL/kg gerçekçi değil. 54 reçetede kullanılıyor.
-- Fiyatı Soğan (Kuru) (id:4758) ile aynı seviyeye çek: 25 TL/kg
UPDATE urun_kartlari 
SET aktif_fiyat = 25.00, aktif_fiyat_tipi = 'DUZELTME'
WHERE id = 22 AND aktif_fiyat > 1000;

-- 1d. Lavash Ekmeği birim/fiyat_birimi uyumsuzluğu
UPDATE urun_kartlari 
SET fiyat_birimi = 'adet'
WHERE id = 233 AND birim = 'adet' AND fiyat_birimi = 'kg';

-- ==================== ADIM 2: EKSİK FİYATLAR ====================

-- Fiyatsız ürünlere piyasa tahmini fiyat ekle
-- Un (id:63) -> Un (Ekmeklik) id:4776 ile aynı: 28 TL/kg
UPDATE urun_kartlari SET aktif_fiyat = 28.00, aktif_fiyat_tipi = 'TAHMIN' 
WHERE id = 63 AND aktif_fiyat IS NULL;

-- Biber (Yeşil) (id:25) -> Biber (Sivri) id:4756 ile aynı: 55 TL/kg
UPDATE urun_kartlari SET aktif_fiyat = 55.00, aktif_fiyat_tipi = 'TAHMIN' 
WHERE id = 25 AND aktif_fiyat IS NULL;

-- Nane (Kuru) (id:80) -> 250 TL/kg piyasa tahmini
UPDATE urun_kartlari SET aktif_fiyat = 250.00, aktif_fiyat_tipi = 'TAHMIN' 
WHERE id = 80 AND aktif_fiyat IS NULL;

-- Biber (Kırmızı) (id:26) -> 60 TL/kg piyasa tahmini
UPDATE urun_kartlari SET aktif_fiyat = 60.00, aktif_fiyat_tipi = 'TAHMIN' 
WHERE id = 26 AND aktif_fiyat IS NULL;

-- Kakao (id:231) -> 400 TL/kg piyasa tahmini
UPDATE urun_kartlari SET aktif_fiyat = 400.00, aktif_fiyat_tipi = 'TAHMIN' 
WHERE id = 231 AND aktif_fiyat IS NULL;

-- Bal (id:96) -> Bal (Süzme) id:4791 ile aynı: 450 TL/kg
UPDATE urun_kartlari SET aktif_fiyat = 450.00, aktif_fiyat_tipi = 'TAHMIN' 
WHERE id = 96 AND aktif_fiyat IS NULL;

-- Nane (id:44) -> 80 TL/kg piyasa tahmini
UPDATE urun_kartlari SET aktif_fiyat = 80.00, aktif_fiyat_tipi = 'TAHMIN' 
WHERE id = 44 AND aktif_fiyat IS NULL;

-- Badem (id:110) -> 600 TL/kg piyasa tahmini
UPDATE urun_kartlari SET aktif_fiyat = 600.00, aktif_fiyat_tipi = 'TAHMIN' 
WHERE id = 110 AND aktif_fiyat IS NULL;

-- Pizza Hamuru (id:235) -> 60 TL/kg piyasa tahmini
UPDATE urun_kartlari SET aktif_fiyat = 60.00, aktif_fiyat_tipi = 'TAHMIN' 
WHERE id = 235 AND aktif_fiyat IS NULL;

-- Simit (id:4903) -> 15 TL/adet piyasa tahmini
UPDATE urun_kartlari SET aktif_fiyat = 15.00, aktif_fiyat_tipi = 'TAHMIN' 
WHERE id = 4903 AND aktif_fiyat IS NULL;

-- Lavash Ekmeği (id:233) -> 8 TL/adet piyasa tahmini
UPDATE urun_kartlari SET aktif_fiyat = 8.00, aktif_fiyat_tipi = 'TAHMIN' 
WHERE id = 233 AND aktif_fiyat IS NULL;

-- Karışık Meyve (id:4804) -> 100 TL/kg piyasa tahmini
UPDATE urun_kartlari SET aktif_fiyat = 100.00, aktif_fiyat_tipi = 'TAHMIN' 
WHERE id = 4804 AND aktif_fiyat IS NULL;

-- Çam Fıstığı (id:4799) -> 1800 TL/kg piyasa tahmini
UPDATE urun_kartlari SET aktif_fiyat = 1800.00, aktif_fiyat_tipi = 'TAHMIN' 
WHERE id = 4799 AND aktif_fiyat IS NULL;

-- Fasulye (Taze) (id:35) -> fiyatı yok, 65 TL/kg tahmini ekle
UPDATE urun_kartlari SET aktif_fiyat = 65.00, aktif_fiyat_tipi = 'TAHMIN' 
WHERE id = 35 AND aktif_fiyat IS NULL;

-- ==================== ADIM 3: İZLEME TABLOSU ====================

-- Birim dönüşüm fallback log tablosu
CREATE TABLE IF NOT EXISTS birim_donusum_log (
    id SERIAL PRIMARY KEY,
    kaynak_birim VARCHAR(20) NOT NULL,
    hedef_birim VARCHAR(20) NOT NULL,
    urun_kart_id INTEGER REFERENCES urun_kartlari(id) ON DELETE SET NULL,
    urun_adi VARCHAR(200),
    recete_id INTEGER,
    recete_adi VARCHAR(200),
    carpan_kullanilan DECIMAL(15,6) DEFAULT 1,
    sorun_tipi VARCHAR(50) DEFAULT 'fallback', -- fallback, cross_type, missing
    cozuldu BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_birim_don_log_cozuldu ON birim_donusum_log(cozuldu) WHERE cozuldu = false;

COMMENT ON TABLE birim_donusum_log IS 
  'Birim dönüşümü yapılamayan (fallback=1 kullanılan) durumların logu. Periyodik kontrol için.';

-- ==================== ADIM 4: RECETE MALİYETLERİNİ YENİDEN HESAPLA ====================

-- Fiyat değişikliği olan ürünlerin recete_malzemeler.birim_fiyat'ını güncelle
-- (sync_recete_malzeme_fiyat trigger'ı sadece aktif_fiyat değiştiğinde çalışır,
--  ama bazı ürünler ilk kez fiyat aldı, trigger bunları yakalamaz)
UPDATE recete_malzemeler rm
SET birim_fiyat = uk.aktif_fiyat
FROM urun_kartlari uk
WHERE rm.urun_kart_id = uk.id
  AND uk.aktif_fiyat IS NOT NULL
  AND (rm.birim_fiyat IS NULL OR rm.birim_fiyat = 0 OR rm.birim_fiyat IS DISTINCT FROM uk.aktif_fiyat);

-- Tüm reçete maliyetlerini yeniden hesapla
UPDATE receteler r
SET 
  tahmini_maliyet = sub.maliyet,
  updated_at = NOW()
FROM (
  SELECT 
    rm.recete_id,
    COALESCE(SUM(
      CASE 
        WHEN rm.aktif_miktar_tipi = 'sef' AND rm.sef_miktar IS NOT NULL THEN rm.sef_miktar
        ELSE rm.miktar
      END
      * get_birim_donusum_carpani(rm.birim, COALESCE(uk.birim, 'kg'), rm.urun_kart_id)
      * COALESCE(rm.birim_fiyat, 0)
    ), 0) AS maliyet
  FROM recete_malzemeler rm
  LEFT JOIN urun_kartlari uk ON uk.id = rm.urun_kart_id
  GROUP BY rm.recete_id
) sub
WHERE r.id = sub.recete_id;
