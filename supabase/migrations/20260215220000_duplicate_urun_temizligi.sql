-- ============================================================================
-- Duplicate Ürün Kartı Temizliği
-- Aynı isimde birden fazla ürün kartı var. Pattern: eski (ID 1-100) fiyatsız
-- ve kullanılmıyor, yeni (ID 4700+) aktif ve reçetelerde kullanılıyor.
-- Eski kartlar deaktive edilir, yeni karta referans bağlanır.
-- ============================================================================

-- ─── STANDART PATTERN: Eski fiyatsız + kullanılmıyor → deaktive et ────────

-- Eski kartları deaktive et (fiyatsız, 0 reçete kullanımı olanlar)
UPDATE urun_kartlari SET aktif = false
WHERE id IN (3, 1, 2, 24, 13, 29, 31, 4, 5, 45, 49, 56, 30, 27, 46, 23, 7, 8)
  AND aktif = true;
-- dana bonfile(3), dana kıyma(1), dana kuşbaşı(2), domates(24), hamsi(13),
-- havuç(29), ıspanak(31), kuzu kuşbaşı(4), kuzu pirzola(5), limon(45),
-- muz(49), nohut(56), patates(30), patlıcan(27), portakal(46), sarımsak(23),
-- tavuk but(7), tavuk kanat(8)

-- Eski Maydanoz (kg birimli, fiyatsız) → deaktive
UPDATE urun_kartlari SET aktif = false WHERE id = 42 AND aktif = true;

-- Eski Makarna Spagetti (fiyatsız) → deaktive
UPDATE urun_kartlari SET aktif = false WHERE id = 64 AND aktif = true;

-- Eski Kekik, Kimyon (fiyatsız) → deaktive
UPDATE urun_kartlari SET aktif = false WHERE id IN (79, 78) AND aktif = true;

-- ─── ÖZEL DURUMLAR ──────────────────────────────────────────────────────────

-- Ayçiçek Yağı: ID:71 (₺410.88, 0 kullanım) vs ID:4778 (₺84.83, 30 kullanım)
-- Eski fiyat çok yüksek (muhtemelen farklı ambalaj), deaktive et
UPDATE urun_kartlari SET aktif = false WHERE id = 71 AND aktif = true;

-- Margarin: ID:4655 vs ID:4656 — ikisi de aynı fiyat, 0 kullanım
-- İlkini deaktive et (duplicate temizliği)
UPDATE urun_kartlari SET aktif = false WHERE id = 4655 AND aktif = true;

-- Simit: ID:4803 vs ID:4903 — eski fiyatsız, yeni ₺15
UPDATE urun_kartlari SET aktif = false WHERE id = 4803 AND aktif = true;

-- Mısır (Konserve): ID:4886 (₺53.38, 1 kullanım) vs ID:4914 (NULL fiyat, 0 kullanım)
-- TERS PATTERN: eski olan kullanılıyor! Yeni olanı deaktive et, eskiye fiyat koru
UPDATE urun_kartlari SET aktif = false WHERE id = 4914 AND aktif = true;

-- Zeytinyağı: ID:70 (₺257.88, 37 kullanım!) vs ID:238 (₺1393, 0 kullanım)
-- ESKİ OLAN KULLANILIYOR! Yeni olanı (₺1393 çok yüksek) deaktive et
UPDATE urun_kartlari SET aktif = false WHERE id = 238 AND aktif = true;

-- Tereyağı: ID:20 (₺420, 0 kullanım) vs ID:4753 (₺420, 57 kullanım)
-- Aynı fiyat, eski kullanılmıyor → deaktive
UPDATE urun_kartlari SET aktif = false WHERE id = 20 AND aktif = true;

-- Toz Şeker: ID:242 (₺206.93, 0 kullanım) vs ID:4790 (₺38, 3 kullanım)
-- Eski fiyat çok yüksek (muhtemelen eski dönem), yenisi güncel → eski deaktive
UPDATE urun_kartlari SET aktif = false WHERE id = 242 AND aktif = true;

-- ─── ÖZEt: Deaktive edilen ID'ler ──────────────────────────────────────────
-- 3, 1, 2, 24, 13, 29, 31, 4, 5, 45, 49, 56, 30, 27, 46, 23, 7, 8,
-- 42, 64, 79, 78, 71, 4655, 4803, 4914, 238, 20, 242
-- Toplam: 29 ürün kartı deaktive
