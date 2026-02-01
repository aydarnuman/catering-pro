-- Proje/Şube Etiketleri Tablosu
CREATE TABLE IF NOT EXISTS etiketler (
  id SERIAL PRIMARY KEY,
  kod VARCHAR(20) UNIQUE NOT NULL,        -- 'HASTANE', 'KYK', 'OKUL'
  ad VARCHAR(100) NOT NULL,               -- 'Hastane Projesi'
  renk VARCHAR(7) DEFAULT '#6366f1',      -- Hex renk kodu
  ikon VARCHAR(50) DEFAULT 'tag',         -- Tabler icon adı
  aciklama TEXT,
  aktif BOOLEAN DEFAULT true,
  sira INTEGER DEFAULT 0,                 -- Sıralama için
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Fatura-Etiket İlişki Tablosu (Çoka-Çok)
CREATE TABLE IF NOT EXISTS fatura_etiketler (
  id SERIAL PRIMARY KEY,
  fatura_ettn VARCHAR(100) NOT NULL,      -- Uyumsoft fatura ETTN
  etiket_id INTEGER REFERENCES etiketler(id) ON DELETE CASCADE,
  notlar TEXT,                            -- Opsiyonel açıklama
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(100),
  UNIQUE(fatura_ettn, etiket_id)          -- Aynı faturaya aynı etiket 2 kez atanamaz
);

-- Varsayılan etiketler
INSERT INTO etiketler (kod, ad, renk, ikon, aciklama, sira) VALUES
  ('HASTANE', 'Hastane', '#10b981', 'building-hospital', 'Hastane projesi faturaları', 1),
  ('KYK', 'KYK Yurdu', '#f59e0b', 'building', 'KYK yurdu faturaları', 2)
ON CONFLICT (kod) DO NOTHING;

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_fatura_etiketler_ettn ON fatura_etiketler(fatura_ettn);
CREATE INDEX IF NOT EXISTS idx_fatura_etiketler_etiket ON fatura_etiketler(etiket_id);
CREATE INDEX IF NOT EXISTS idx_etiketler_aktif ON etiketler(aktif);

