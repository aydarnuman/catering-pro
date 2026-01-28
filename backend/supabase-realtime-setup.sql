-- =====================================================
-- SUPABASE REALTIME SETUP
-- Tüm kritik tablolar için realtime aktivasyonu
-- =====================================================

-- 1. Publication oluştur (eğer yoksa)
-- Supabase otomatik olarak "supabase_realtime" publication'ı kullanır
-- Biz bu publication'a tablolarımızı ekleyeceğiz

-- 2. Tabloları publication'a ekle
ALTER PUBLICATION supabase_realtime ADD TABLE invoices;
ALTER PUBLICATION supabase_realtime ADD TABLE cariler;
ALTER PUBLICATION supabase_realtime ADD TABLE cari_hareketler;
ALTER PUBLICATION supabase_realtime ADD TABLE stok;
ALTER PUBLICATION supabase_realtime ADD TABLE stok_hareketler;
ALTER PUBLICATION supabase_realtime ADD TABLE tenders;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE personeller;
ALTER PUBLICATION supabase_realtime ADD TABLE kasa_banka_hareketler;
ALTER PUBLICATION supabase_realtime ADD TABLE bordro;
ALTER PUBLICATION supabase_realtime ADD TABLE projeler;
ALTER PUBLICATION supabase_realtime ADD TABLE demirbas;
ALTER PUBLICATION supabase_realtime ADD TABLE urunler;
ALTER PUBLICATION supabase_realtime ADD TABLE menu_items;
ALTER PUBLICATION supabase_realtime ADD TABLE satin_alma;

-- 3. Row Level Security (RLS) kontrolü
-- Realtime için RLS aktif olmalı

-- Faturalar
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Faturalar herkese açık" ON invoices FOR SELECT USING (true);

-- Cariler
ALTER TABLE cariler ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cariler herkese açık" ON cariler FOR SELECT USING (true);

-- Cari Hareketler
ALTER TABLE cari_hareketler ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cari hareketler herkese açık" ON cari_hareketler FOR SELECT USING (true);

-- Stok
ALTER TABLE stok ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Stok herkese açık" ON stok FOR SELECT USING (true);

-- Stok Hareketler
ALTER TABLE stok_hareketler ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Stok hareketler herkese açık" ON stok_hareketler FOR SELECT USING (true);

-- İhaleler
ALTER TABLE tenders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "İhaleler herkese açık" ON tenders FOR SELECT USING (true);

-- Bildirimler
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Bildirimler herkese açık" ON notifications FOR SELECT USING (true);

-- Personel
ALTER TABLE personeller ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Personel herkese açık" ON personeller FOR SELECT USING (true);

-- Kasa Banka
ALTER TABLE kasa_banka_hareketler ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Kasa banka herkese açık" ON kasa_banka_hareketler FOR SELECT USING (true);

-- Bordro
ALTER TABLE bordro ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Bordro herkese açık" ON bordro FOR SELECT USING (true);

-- Projeler
ALTER TABLE projeler ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Projeler herkese açık" ON projeler FOR SELECT USING (true);

-- Demirbaş
ALTER TABLE demirbas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Demirbaş herkese açık" ON demirbas FOR SELECT USING (true);

-- Ürünler
ALTER TABLE urunler ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ürünler herkese açık" ON urunler FOR SELECT USING (true);

-- Menü
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Menü herkese açık" ON menu_items FOR SELECT USING (true);

-- Satın Alma
ALTER TABLE satin_alma ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Satın alma herkese açık" ON satin_alma FOR SELECT USING (true);

-- =====================================================
-- NOTLAR:
-- 1. Bu script Supabase SQL Editor'den çalıştırılmalı
-- 2. RLS politikaları mevcut authentication'a göre güncellenebilir
-- 3. "FOR SELECT USING (true)" = Herkese okuma izni (geçici)
-- 4. Production'da daha kısıtlayıcı politikalar kullanılmalı
-- =====================================================
