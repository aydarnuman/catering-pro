-- Projeler/Şubeler tablosu
CREATE TABLE IF NOT EXISTS projeler (
  id SERIAL PRIMARY KEY,
  kod VARCHAR(20) UNIQUE NOT NULL,
  ad VARCHAR(100) NOT NULL,
  adres TEXT,
  yetkili VARCHAR(100),
  telefon VARCHAR(20),
  renk VARCHAR(7) DEFAULT '#6366f1',
  aktif BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Siparişler tablosu
CREATE TABLE IF NOT EXISTS siparisler (
  id SERIAL PRIMARY KEY,
  siparis_no VARCHAR(20) UNIQUE NOT NULL,
  proje_id INTEGER REFERENCES projeler(id) ON DELETE SET NULL,
  tedarikci_id INTEGER REFERENCES cariler(id) ON DELETE SET NULL,
  baslik VARCHAR(200) NOT NULL,
  siparis_tarihi DATE NOT NULL DEFAULT CURRENT_DATE,
  teslim_tarihi DATE,
  durum VARCHAR(20) DEFAULT 'talep' CHECK (durum IN ('talep', 'onay_bekliyor', 'onaylandi', 'siparis_verildi', 'teslim_alindi', 'iptal')),
  oncelik VARCHAR(10) DEFAULT 'normal' CHECK (oncelik IN ('dusuk', 'normal', 'yuksek', 'acil')),
  toplam_tutar DECIMAL(12,2) DEFAULT 0,
  notlar TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sipariş Kalemleri tablosu
CREATE TABLE IF NOT EXISTS siparis_kalemleri (
  id SERIAL PRIMARY KEY,
  siparis_id INTEGER REFERENCES siparisler(id) ON DELETE CASCADE,
  urun_adi VARCHAR(200) NOT NULL,
  miktar DECIMAL(10,2) NOT NULL,
  birim VARCHAR(20) NOT NULL,
  tahmini_fiyat DECIMAL(12,2) DEFAULT 0,
  gercek_fiyat DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Örnek projeler ekle
INSERT INTO projeler (kod, ad, adres, yetkili, telefon, renk) VALUES
  ('KYK', 'KYK Yurdu', 'Üniversite Mahallesi, Yurt Caddesi No:1', 'Ahmet Yılmaz', '0532 111 22 33', '#10b981'),
  ('HASTANE', 'Devlet Hastanesi', 'Sağlık Mahallesi, Hastane Caddesi No:100', 'Mehmet Demir', '0533 222 33 44', '#3b82f6'),
  ('MERKEZ', 'Merkez Mutfak', 'Merkez Mahallesi, Ana Cadde No:50', 'Ayşe Kaya', '0534 333 44 55', '#f59e0b')
ON CONFLICT (kod) DO NOTHING;

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_siparisler_proje ON siparisler(proje_id);
CREATE INDEX IF NOT EXISTS idx_siparisler_tedarikci ON siparisler(tedarikci_id);
CREATE INDEX IF NOT EXISTS idx_siparisler_durum ON siparisler(durum);
CREATE INDEX IF NOT EXISTS idx_siparisler_tarih ON siparisler(siparis_tarihi);
CREATE INDEX IF NOT EXISTS idx_siparis_kalemleri_siparis ON siparis_kalemleri(siparis_id);

