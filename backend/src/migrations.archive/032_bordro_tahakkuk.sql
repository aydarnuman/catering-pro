-- Bordro dönem özeti için TAHAKKUK BİLGİLERİ tablosu
-- PDF'den doğrudan çekilen özet veriler burada saklanacak

CREATE TABLE IF NOT EXISTS bordro_tahakkuk (
  id SERIAL PRIMARY KEY,
  proje_id INTEGER REFERENCES projeler(id) ON DELETE SET NULL,
  yil INTEGER NOT NULL,
  ay INTEGER NOT NULL,
  
  -- Sol taraf (Giderler)
  aylik_ucret_toplami DECIMAL(15,2),
  fazla_mesai_toplami DECIMAL(15,2) DEFAULT 0,
  sair_odemeler_toplami DECIMAL(15,2) DEFAULT 0,
  isveren_sgk_hissesi DECIMAL(15,2),
  isveren_issizlik DECIMAL(15,2),
  toplam_gider DECIMAL(15,2),
  
  -- Sağ taraf (Ödemeler)
  odenecek_net_ucret DECIMAL(15,2),
  odenecek_sgk_primi DECIMAL(15,2),
  odenecek_sgd_primi DECIMAL(15,2),
  odenecek_gelir_vergisi DECIMAL(15,2),
  odenecek_damga_vergisi DECIMAL(15,2),
  odenecek_issizlik DECIMAL(15,2),
  sair_kesintiler DECIMAL(15,2) DEFAULT 0,
  toplam_odeme DECIMAL(15,2),
  
  -- Alt kısım (SGK)
  toplam_sgk_primi DECIMAL(15,2),
  indirilecek_sgk_isveren DECIMAL(15,2) DEFAULT 0,
  net_odenecek_sgk DECIMAL(15,2),
  indirilecek_gelir_vergisi DECIMAL(15,2) DEFAULT 0,
  indirilecek_damga_vergisi DECIMAL(15,2) DEFAULT 0,
  agi_tutari DECIMAL(15,2) DEFAULT 0,
  
  -- Grup İcmali
  personel_sayisi INTEGER,
  toplam_gun INTEGER,
  emekli_sayisi INTEGER DEFAULT 0,
  normal_sayisi INTEGER DEFAULT 0,
  
  -- Meta
  kaynak_dosya VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Her proje için her dönem tek kayıt
  UNIQUE(proje_id, yil, ay)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_bordro_tahakkuk_donem ON bordro_tahakkuk(yil, ay);
CREATE INDEX IF NOT EXISTS idx_bordro_tahakkuk_proje ON bordro_tahakkuk(proje_id);

-- Updated at trigger
DROP TRIGGER IF EXISTS update_bordro_tahakkuk_updated_at ON bordro_tahakkuk;
CREATE TRIGGER update_bordro_tahakkuk_updated_at
  BEFORE UPDATE ON bordro_tahakkuk
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE bordro_tahakkuk IS 'PDF''den çekilen TAHAKKUK BİLGİLERİ - dönem özeti';
