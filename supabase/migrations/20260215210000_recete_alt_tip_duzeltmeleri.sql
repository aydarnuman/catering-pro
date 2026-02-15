-- ============================================================================
-- Reçete Alt Tip Ataması Düzeltmeleri
-- Anomali scriptlerinde tespit edilen yanlış alt_tip atamaları düzeltilir
-- ============================================================================

-- ─── 1. YANLIŞÇORBA ALT TİPLERİ ────────────────────────────────────────────
-- Bu çorbalar "Sebze Yemeği" (10) veya "Parçalı Et" (1) / "Tavuk Parçalı" (7)
-- olarak atanmış, doğru çorba alt tipine düzeltiliyorlar.

-- Domates Çorbası → Sebze/Domates Çorbası (14)
UPDATE receteler SET alt_tip_id = 14 WHERE id = 5 AND alt_tip_id = 10;

-- Sebze Çorba → Sebze/Domates Çorbası (14)
UPDATE receteler SET alt_tip_id = 14 WHERE id = 103 AND alt_tip_id = 10;

-- Sebze Çorbası → Sebze/Domates Çorbası (14)
UPDATE receteler SET alt_tip_id = 14 WHERE id = 9 AND alt_tip_id = 10;

-- Patates Çorbası → Sebze/Domates Çorbası (14)
UPDATE receteler SET alt_tip_id = 14 WHERE id = 10 AND alt_tip_id = 10;

-- Et Paça Çorba → Etli Çorba (37)
UPDATE receteler SET alt_tip_id = 37 WHERE id = 79 AND alt_tip_id = 1;

-- Tavuk Suyu Çorbası → Tavuklu Çorba (38)
UPDATE receteler SET alt_tip_id = 38 WHERE id = 12 AND alt_tip_id = 7;

-- Terbiyeli Tavuk Çorba → Tavuklu Çorba (38)
UPDATE receteler SET alt_tip_id = 38 WHERE id = 161 AND alt_tip_id = 7;

-- ─── 2. ETLİ YEMEKLER YANLIŞ ALT TİPTE ─────────────────────────────────────

-- Etli Türlü: Parçalı Et (1) → Etli Sebze (39) — et + çeşitli sebze
UPDATE receteler SET alt_tip_id = 39 WHERE id = 16 AND alt_tip_id = 1;

-- Etli Kapuska: Parçalı Et (1) → Etli Sebze (39) — kıyma + lahana
UPDATE receteler SET alt_tip_id = 39 WHERE id IN (
  SELECT id FROM receteler WHERE ad = 'Etli Kapuska' AND aktif = true AND alt_tip_id = 1
);

-- Etli Bezelye: Parçalı Et (1) → Etli Sebze (39) — et + bezelye
UPDATE receteler SET alt_tip_id = 39 WHERE id IN (
  SELECT id FROM receteler WHERE ad = 'Etli Bezelye' AND aktif = true AND alt_tip_id = 1
);

-- Güveç: Parçalı Et (1) → Etli Sebze (39) — et + çeşitli sebze
UPDATE receteler SET alt_tip_id = 39 WHERE id IN (
  SELECT id FROM receteler WHERE ad = 'Güveç' AND aktif = true AND alt_tip_id = 1
);

-- Patlıcan Kebabı: Parçalı Et (1) → Etli Sebze (39)
UPDATE receteler SET alt_tip_id = 39 WHERE id IN (
  SELECT id FROM receteler WHERE ad = 'Patlıcan Kebabı' AND aktif = true AND alt_tip_id = 1
);

-- Kadınbudu Köfte+ Fırın Sebze: Parçalı Et (1) → Etli Sebze (39) (kombine)
UPDATE receteler SET alt_tip_id = 39 WHERE id = 163 AND alt_tip_id = 1;

-- İzmir Köfte: Parçalı Et (1) → Kıymalı (3) — kıyma bazlı
UPDATE receteler SET alt_tip_id = 3 WHERE id IN (
  SELECT id FROM receteler WHERE ad = 'İzmir Köfte' AND aktif = true AND alt_tip_id = 1
);

-- Sulu Köfte: Parçalı Et (1) → Kıymalı (3)
UPDATE receteler SET alt_tip_id = 3 WHERE id IN (
  SELECT id FROM receteler WHERE ad = 'Sulu Köfte' AND aktif = true AND alt_tip_id = 1
);

-- Kuru Köfte: Parçalı Et (1) → Kıymalı (3)
UPDATE receteler SET alt_tip_id = 3 WHERE id IN (
  SELECT id FROM receteler WHERE ad = 'Kuru Köfte' AND aktif = true AND alt_tip_id = 1
);

-- Kadınbudu Köfte: Parçalı Et (1) → Kıymalı (3) 
UPDATE receteler SET alt_tip_id = 3 WHERE id IN (
  SELECT id FROM receteler WHERE ad = 'Kadınbudu Köfte' AND aktif = true AND alt_tip_id = 1
);

-- ─── 3. ETLİ BAKLİYAT YANLIŞ ALT TİPTE ─────────────────────────────────────
-- Bu yemeklerde et var ama "Kuru Baklagil (Etsiz)" olarak atanmış

-- Nohut Yemeği (dana kıyma içeriyor) → Etli Baklagil (40)
UPDATE receteler SET alt_tip_id = 40 WHERE id = 14 AND alt_tip_id = 6;

-- Kuru Fasulye (dana kıyma içeriyor) → Etli Baklagil (40)
UPDATE receteler SET alt_tip_id = 40 WHERE id = 227 AND alt_tip_id = 6;

-- Kuru Fasulye Yemeği (kuşbaşı içeriyor) → Etli Baklagil (40)
UPDATE receteler SET alt_tip_id = 40 WHERE id = 211 AND alt_tip_id = 6;

-- Taze Fasulye → Sebze Yemeği (10) — taze fasulye baklagil değil, sebze
UPDATE receteler SET alt_tip_id = 10 WHERE id = 25 AND alt_tip_id = 6;

-- ─── 4. SEBZELİ ANA YEMEK DÜZELTMELERİ ─────────────────────────────────────

-- Bamya Yemeği: Sebze Yemeği (10) → Etli Sebze (39) — kuşbaşı içeriyor
UPDATE receteler SET alt_tip_id = 39 WHERE id = 140 AND alt_tip_id = 10;

-- Bezelye Yemeği: Sebze Yemeği (10) → Etli Sebze (39) — kuşbaşı içeriyor
UPDATE receteler SET alt_tip_id = 39 WHERE id = 94 AND alt_tip_id = 10;

-- Musakka: Sebze Yemeği (10) → Kıymalı (3) — kıyma bazlı
UPDATE receteler SET alt_tip_id = 3 WHERE id = 24 AND alt_tip_id = 10;

-- Karnıyarık: Sebze Yemeği (10) → Kıymalı (3) — kıyma dolgulu
UPDATE receteler SET alt_tip_id = 3 WHERE id = 20 AND alt_tip_id = 10;

-- Hünkar Beğendi (Beşamel Soslu...): Sebze Yemeği (10) → Parçalı Et (1)
UPDATE receteler SET alt_tip_id = 1 WHERE id IN (
  SELECT id FROM receteler WHERE ad LIKE 'Hünkar Beğendi (Beşamel%' AND aktif = true AND alt_tip_id = 10
);

-- ─── 5. DİĞER YANLIŞ ALT TİPLER ────────────────────────────────────────────

-- Fırın Makarna: Pirinç Pilavı (17) → Kıymalı Makarna (35)
UPDATE receteler SET alt_tip_id = 35 WHERE id = 213 AND alt_tip_id = 17;

-- Haşhaşlı Revani: Sütlü Tatlı (23) → Şerbetli Tatlı (24)
UPDATE receteler SET alt_tip_id = 24 WHERE id = 212 AND alt_tip_id = 23;

-- Dolma: Sebze Yemeği (10) → Zeytinyağlı Sebze (11)
UPDATE receteler SET alt_tip_id = 11 WHERE id = 90 AND alt_tip_id = 10;

-- Yaprak Sarma: Sebze Yemeği (10) → Zeytinyağlı Sebze (11)
UPDATE receteler SET alt_tip_id = 11 WHERE id = 23 AND alt_tip_id = 10;

-- Tavuklu Pilav: Tavuk Parçalı (7) → Tavuklu Pilav (33)
UPDATE receteler SET alt_tip_id = 33 WHERE id IN (
  SELECT id FROM receteler WHERE ad = 'Tavuklu Pilav' AND aktif = true AND alt_tip_id = 7
);

-- Tavuklu Bahçevan Kebabı: Tavuk Parçalı (7) olabilir ama sebze ağırlıklı, bırakıyoruz

-- ─── 6. ALT TİPİ NULL OLAN REÇETELERE ATAMA ─────────────────────────────────

-- Ekmek → Kahvaltı (30)
UPDATE receteler SET alt_tip_id = 30 WHERE id = 285 AND alt_tip_id IS NULL;

-- Hünkar Beğendi → Parçalı Et Kemiksiz (1)
UPDATE receteler SET alt_tip_id = 1 WHERE id = 109 AND alt_tip_id IS NULL;

-- İmam Bayıldı → Zeytinyağlı Sebze (11)
UPDATE receteler SET alt_tip_id = 11 WHERE id = 21 AND alt_tip_id IS NULL;

-- Karışık Pizza → Börek / Hamur İşi (31)
UPDATE receteler SET alt_tip_id = 31 WHERE id = 185 AND alt_tip_id IS NULL;

-- Kısır → Diğer Salatalar (21)
UPDATE receteler SET alt_tip_id = 21 WHERE id = 45 AND alt_tip_id IS NULL;

-- Lavaş/Sandviç → Börek / Hamur İşi (31)
UPDATE receteler SET alt_tip_id = 31 WHERE id = 88 AND alt_tip_id IS NULL;

-- Pişi/Katmer/Haşhaşlı Lokum → Hamur Tatlısı (26)
UPDATE receteler SET alt_tip_id = 26 WHERE id = 172 AND alt_tip_id IS NULL;

-- Yoğurt → Cacık (43) — en yakın alt tip
UPDATE receteler SET alt_tip_id = 43 WHERE id = 48 AND alt_tip_id IS NULL;
