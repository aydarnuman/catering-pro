-- Bordro Template Sistemi
-- Şirket/proje bazlı bordro formatlarını kaydetmek için

-- Template tablosu
CREATE TABLE IF NOT EXISTS bordro_templates (
  id SERIAL PRIMARY KEY,
  
  -- Tanımlama
  ad VARCHAR(100) NOT NULL,
  aciklama TEXT,
  proje_id INTEGER REFERENCES projeler(id) ON DELETE SET NULL,
  
  -- Kolon eşleştirme (JSON)
  kolon_mapping JSONB NOT NULL,
  -- Örnek: {
  --   "tc_kimlik": {"kolon": "A", "tip": "string"},
  --   "ad_soyad": {"kolon": "B", "tip": "string"},
  --   "brut_maas": {"kolon": "E", "tip": "number"},
  --   "net_maas": {"kolon": "L", "tip": "number"},
  --   "ise_giris": {"kolon": "C", "tip": "date", "format": "DD.MM.YYYY"}
  -- }
  
  -- Satır bilgileri
  baslik_satiri INTEGER DEFAULT 1,        -- Başlık hangi satırda
  veri_baslangic_satiri INTEGER DEFAULT 2, -- Veri hangi satırdan başlıyor
  
  -- Doğrulama için imza (ilk satırların hash'i)
  format_imza VARCHAR(64),  -- Dosya formatını tanımak için
  
  -- Meta
  kullanim_sayisi INTEGER DEFAULT 0,
  son_kullanim TIMESTAMP,
  aktif BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_bordro_templates_proje ON bordro_templates(proje_id);
CREATE INDEX IF NOT EXISTS idx_bordro_templates_aktif ON bordro_templates(aktif);
CREATE INDEX IF NOT EXISTS idx_bordro_templates_imza ON bordro_templates(format_imza);

-- Unique constraint: Aynı proje için aynı isimde template olmasın
ALTER TABLE bordro_templates 
  ADD CONSTRAINT bordro_templates_unique_name 
  UNIQUE(proje_id, ad);

-- Trigger: updated_at otomatik güncelle
CREATE OR REPLACE FUNCTION update_bordro_template_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_bordro_template_updated ON bordro_templates;
CREATE TRIGGER trigger_bordro_template_updated
  BEFORE UPDATE ON bordro_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_bordro_template_timestamp();

-- Yorum
COMMENT ON TABLE bordro_templates IS 'Bordro dosya formatlarını saklar, AI olmadan hızlı parse için';
COMMENT ON COLUMN bordro_templates.kolon_mapping IS 'JSON: Her alan için kolon harfi ve veri tipi';
COMMENT ON COLUMN bordro_templates.format_imza IS 'Dosya header hash - otomatik template eşleştirme için';

