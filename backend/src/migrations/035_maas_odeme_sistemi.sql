-- =====================================================
-- MAAŞ ÖDEME TAKİP SİSTEMİ
-- =====================================================

-- 1. Maaş Ödemeleri Ana Tablosu (Aylık Özet)
CREATE TABLE IF NOT EXISTS maas_odemeleri (
  id SERIAL PRIMARY KEY,
  proje_id INT REFERENCES projeler(id) ON DELETE CASCADE,
  personel_id INT REFERENCES personeller(id) ON DELETE CASCADE,
  yil INT NOT NULL,
  ay INT NOT NULL,
  
  -- Maaş Bilgileri
  bordro_maas DECIMAL(12,2) DEFAULT 0,      -- SGK'ya bildirilen (banka)
  elden_fark DECIMAL(12,2) DEFAULT 0,       -- Kayıt dışı fark
  
  -- Ek Ödemeler
  avans DECIMAL(12,2) DEFAULT 0,            -- Alınan avans (düşülecek)
  prim DECIMAL(12,2) DEFAULT 0,             -- Prim (eklenecek)
  fazla_mesai DECIMAL(12,2) DEFAULT 0,      -- Fazla mesai ücreti
  
  -- Kesintiler
  sgk_kesinti DECIMAL(12,2) DEFAULT 0,      -- SGK işçi payı
  vergi_kesinti DECIMAL(12,2) DEFAULT 0,    -- Gelir vergisi
  diger_kesinti DECIMAL(12,2) DEFAULT 0,    -- Diğer kesintiler
  
  -- Hesaplanan
  net_odenecek DECIMAL(12,2) DEFAULT 0,     -- Toplam ödenecek
  
  -- Ödeme Durumu
  banka_odendi BOOLEAN DEFAULT FALSE,
  banka_odeme_tarihi TIMESTAMP,
  elden_odendi BOOLEAN DEFAULT FALSE,
  elden_odeme_tarihi TIMESTAMP,
  
  -- Meta
  notlar TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(proje_id, personel_id, yil, ay)
);

-- 2. Avans Hareketleri (Detaylı Takip)
CREATE TABLE IF NOT EXISTS avans_hareketleri (
  id SERIAL PRIMARY KEY,
  personel_id INT REFERENCES personeller(id) ON DELETE CASCADE,
  proje_id INT REFERENCES projeler(id) ON DELETE CASCADE,
  tutar DECIMAL(12,2) NOT NULL,
  tarih DATE NOT NULL,
  aciklama TEXT,
  odeme_sekli VARCHAR(20) DEFAULT 'nakit',  -- nakit, banka
  mahsup_ay INT,                             -- Hangi ay maaşından düşülecek
  mahsup_yil INT,
  mahsup_edildi BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 3. Prim Hareketleri (Detaylı Takip)
CREATE TABLE IF NOT EXISTS prim_hareketleri (
  id SERIAL PRIMARY KEY,
  personel_id INT REFERENCES personeller(id) ON DELETE CASCADE,
  proje_id INT REFERENCES projeler(id) ON DELETE CASCADE,
  tutar DECIMAL(12,2) NOT NULL,
  tarih DATE NOT NULL,
  prim_turu VARCHAR(50) NOT NULL,           -- performans, bayram, yillik, ozel
  aciklama TEXT,
  odeme_ay INT,                              -- Hangi ay ödenecek
  odeme_yil INT,
  odendi BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 4. Proje Maaş Ödeme Ayarları
CREATE TABLE IF NOT EXISTS proje_maas_ayarlari (
  id SERIAL PRIMARY KEY,
  proje_id INT REFERENCES projeler(id) ON DELETE CASCADE UNIQUE,
  odeme_gunu INT DEFAULT 15,                 -- Her ayın kaçı
  banka_adi VARCHAR(100),
  iban VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index'ler
CREATE INDEX IF NOT EXISTS idx_maas_odemeleri_proje_ay ON maas_odemeleri(proje_id, yil, ay);
CREATE INDEX IF NOT EXISTS idx_avans_personel ON avans_hareketleri(personel_id, mahsup_yil, mahsup_ay);
CREATE INDEX IF NOT EXISTS idx_prim_personel ON prim_hareketleri(personel_id, odeme_yil, odeme_ay);

-- Otomatik net_odenecek hesaplama trigger'ı
CREATE OR REPLACE FUNCTION hesapla_net_odenecek()
RETURNS TRIGGER AS $$
BEGIN
  NEW.net_odenecek = NEW.bordro_maas + NEW.elden_fark + NEW.prim + NEW.fazla_mesai - NEW.avans - NEW.sgk_kesinti - NEW.vergi_kesinti - NEW.diger_kesinti;
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_hesapla_net_odenecek ON maas_odemeleri;
CREATE TRIGGER trg_hesapla_net_odenecek
  BEFORE INSERT OR UPDATE ON maas_odemeleri
  FOR EACH ROW EXECUTE FUNCTION hesapla_net_odenecek();

-- View: Proje Maaş Özeti
CREATE OR REPLACE VIEW v_proje_maas_ozeti AS
SELECT 
  m.proje_id,
  p.ad as proje_adi,
  m.yil,
  m.ay,
  COUNT(DISTINCT m.personel_id) as personel_sayisi,
  SUM(m.bordro_maas) as toplam_bordro,
  SUM(m.elden_fark) as toplam_elden,
  SUM(m.avans) as toplam_avans,
  SUM(m.prim) as toplam_prim,
  SUM(m.net_odenecek) as toplam_odenecek,
  COUNT(CASE WHEN m.banka_odendi THEN 1 END) as banka_odenen,
  COUNT(CASE WHEN m.elden_odendi THEN 1 END) as elden_odenen
FROM maas_odemeleri m
JOIN projeler p ON p.id = m.proje_id
GROUP BY m.proje_id, p.ad, m.yil, m.ay;
