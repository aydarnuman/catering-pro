-- Dilekçe Kayıt Tablosu
-- İhale uzmanı modalında oluşturulan dilekçeleri saklar

CREATE TABLE IF NOT EXISTS tender_dilekceleri (
  id SERIAL PRIMARY KEY,
  tender_tracking_id INTEGER REFERENCES tender_tracking(id) ON DELETE CASCADE,
  tender_id INTEGER, -- tender_tracking olmasa bile ihale id'si
  dilekce_type VARCHAR(50) NOT NULL, -- asiri_dusuk, idare_sikayet, kik_itiraz, aciklama_cevabi
  title VARCHAR(255),
  content TEXT NOT NULL,
  ihale_bilgileri JSONB, -- ihale başlık, kurum, no vb.
  maliyet_bilgileri JSONB, -- hesaplama verileri
  version INTEGER DEFAULT 1,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index'ler
CREATE INDEX IF NOT EXISTS idx_tender_dilekceleri_tracking ON tender_dilekceleri(tender_tracking_id);
CREATE INDEX IF NOT EXISTS idx_tender_dilekceleri_tender ON tender_dilekceleri(tender_id);
CREATE INDEX IF NOT EXISTS idx_tender_dilekceleri_type ON tender_dilekceleri(dilekce_type);
CREATE INDEX IF NOT EXISTS idx_tender_dilekceleri_created ON tender_dilekceleri(created_at DESC);

-- Yorum
COMMENT ON TABLE tender_dilekceleri IS 'İhale uzmanı modalında AI ile oluşturulan dilekçelerin kaydı';
COMMENT ON COLUMN tender_dilekceleri.dilekce_type IS 'Dilekçe türü: asiri_dusuk, idare_sikayet, kik_itiraz, aciklama_cevabi';
COMMENT ON COLUMN tender_dilekceleri.version IS 'Aynı ihale için aynı türde birden fazla dilekçe oluşturulabilir';
