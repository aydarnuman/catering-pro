-- Cari Hareketler Tablosu
-- Her fatura, ödeme, tahsilat burada kayıt olacak

CREATE TABLE IF NOT EXISTS cari_hareketler (
  id SERIAL PRIMARY KEY,
  cari_id INTEGER NOT NULL REFERENCES cariler(id) ON DELETE RESTRICT,
  
  -- Hareket tipi ve belge
  hareket_tipi VARCHAR(20) NOT NULL, -- 'fatura_alis', 'fatura_satis', 'tahsilat', 'odeme', 'acilis'
  belge_tipi VARCHAR(20), -- 'fatura', 'makbuz', 'dekont', 'cek', 'senet'
  belge_no VARCHAR(50),
  belge_tarihi DATE NOT NULL,
  vade_tarihi DATE,
  
  -- Tutarlar
  borc DECIMAL(15,2) DEFAULT 0,
  alacak DECIMAL(15,2) DEFAULT 0,
  bakiye DECIMAL(15,2) DEFAULT 0, -- İşlem sonrası bakiye
  
  -- Detaylar
  aciklama TEXT,
  doviz_tipi VARCHAR(3) DEFAULT 'TRY',
  doviz_kuru DECIMAL(10,4) DEFAULT 1,
  doviz_tutari DECIMAL(15,2),
  
  -- İlişkili kayıtlar
  fatura_id INTEGER,
  uyumsoft_fatura_id INTEGER,
  odeme_id INTEGER,
  
  -- Metadata
  created_by INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT check_borc_alacak CHECK (
    (borc > 0 AND alacak = 0) OR 
    (borc = 0 AND alacak > 0) OR 
    (borc = 0 AND alacak = 0)
  )
);

-- İndeksler
CREATE INDEX idx_cari_hareketler_cari_id ON cari_hareketler(cari_id);
CREATE INDEX idx_cari_hareketler_belge_tarihi ON cari_hareketler(belge_tarihi DESC);
CREATE INDEX idx_cari_hareketler_hareket_tipi ON cari_hareketler(hareket_tipi);
CREATE INDEX idx_cari_hareketler_vade_tarihi ON cari_hareketler(vade_tarihi);

-- Trigger: updated_at otomatik güncelleme
CREATE TRIGGER update_cari_hareketler_updated_at
  BEFORE UPDATE ON cari_hareketler
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Fonksiyon: Cari bakiye hesaplama
CREATE OR REPLACE FUNCTION calculate_cari_bakiye(p_cari_id INTEGER)
RETURNS TABLE(
  toplam_borc DECIMAL,
  toplam_alacak DECIMAL,
  bakiye DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(borc), 0) as toplam_borc,
    COALESCE(SUM(alacak), 0) as toplam_alacak,
    COALESCE(SUM(alacak - borc), 0) as bakiye
  FROM cari_hareketler
  WHERE cari_id = p_cari_id;
END;
$$ LANGUAGE plpgsql;

-- View: Cari Ekstre (Hareket Özeti)
CREATE OR REPLACE VIEW cari_ekstre AS
SELECT 
  ch.*,
  c.unvan as cari_unvan,
  c.tip as cari_tip,
  SUM(ch.alacak - ch.borc) OVER (
    PARTITION BY ch.cari_id 
    ORDER BY ch.belge_tarihi, ch.id
  ) as kumulatif_bakiye
FROM cari_hareketler ch
JOIN cariler c ON c.id = ch.cari_id
ORDER BY ch.belge_tarihi DESC, ch.id DESC;

-- View: Aylık Cari Özet
CREATE OR REPLACE VIEW aylik_cari_ozet AS
SELECT 
  c.id as cari_id,
  c.unvan,
  c.tip,
  DATE_TRUNC('month', ch.belge_tarihi) as ay,
  SUM(ch.borc) as aylik_borc,
  SUM(ch.alacak) as aylik_alacak,
  SUM(ch.alacak - ch.borc) as aylik_bakiye,
  COUNT(*) as hareket_sayisi
FROM cariler c
LEFT JOIN cari_hareketler ch ON c.id = ch.cari_id
GROUP BY c.id, c.unvan, c.tip, DATE_TRUNC('month', ch.belge_tarihi)
ORDER BY ay DESC, c.unvan;

-- View: Vade Analizi
CREATE OR REPLACE VIEW vade_analizi AS
SELECT 
  c.id as cari_id,
  c.unvan,
  c.tip,
  ch.belge_no,
  ch.belge_tarihi,
  ch.vade_tarihi,
  ch.borc,
  ch.alacak,
  CASE 
    WHEN ch.vade_tarihi < CURRENT_DATE THEN 'Gecikmiş'
    WHEN ch.vade_tarihi = CURRENT_DATE THEN 'Bugün'
    WHEN ch.vade_tarihi <= CURRENT_DATE + INTERVAL '7 days' THEN '1 Hafta İçinde'
    WHEN ch.vade_tarihi <= CURRENT_DATE + INTERVAL '30 days' THEN '1 Ay İçinde'
    ELSE 'Vadeli'
  END as vade_durumu,
  ch.vade_tarihi - CURRENT_DATE as gun_farki
FROM cari_hareketler ch
JOIN cariler c ON c.id = ch.cari_id
WHERE ch.vade_tarihi IS NOT NULL
  AND (ch.borc > 0 OR ch.alacak > 0)
ORDER BY ch.vade_tarihi;

-- Trigger: Uyumsoft faturası eklendiğinde cari hareket oluştur
CREATE OR REPLACE FUNCTION create_cari_hareket_from_uyumsoft()
RETURNS TRIGGER AS $$
DECLARE
  v_cari_id INTEGER;
BEGIN
  -- Cari'yi bul veya oluştur
  SELECT id INTO v_cari_id
  FROM cariler
  WHERE vergi_no = NEW.sender_vkn;
  
  IF v_cari_id IS NULL THEN
    -- Cari yoksa oluştur
    INSERT INTO cariler (tip, unvan, vergi_no, email, aktif)
    VALUES (
      CASE 
        WHEN NEW.invoice_type LIKE '%incoming%' THEN 'tedarikci'
        ELSE 'musteri'
      END,
      NEW.sender_name,
      NEW.sender_vkn,
      NEW.sender_email,
      true
    )
    RETURNING id INTO v_cari_id;
  END IF;
  
  -- Cari hareket oluştur
  INSERT INTO cari_hareketler (
    cari_id,
    hareket_tipi,
    belge_tipi,
    belge_no,
    belge_tarihi,
    borc,
    alacak,
    aciklama,
    uyumsoft_fatura_id
  ) VALUES (
    v_cari_id,
    CASE 
      WHEN NEW.invoice_type LIKE '%incoming%' THEN 'fatura_alis'
      ELSE 'fatura_satis'
    END,
    'fatura',
    NEW.invoice_no,
    NEW.invoice_date,
    CASE WHEN NEW.invoice_type LIKE '%incoming%' THEN NEW.payable_amount ELSE 0 END,
    CASE WHEN NEW.invoice_type NOT LIKE '%incoming%' THEN NEW.payable_amount ELSE 0 END,
    CASE 
      WHEN NEW.invoice_type LIKE '%incoming%' THEN 'Alış Faturası - '
      ELSE 'Satış Faturası - '
    END || TO_CHAR(NEW.invoice_date, 'DD.MM.YYYY'),
    NEW.id
  );
  
  -- Cari bakiyesini güncelle
  UPDATE cariler
  SET 
    borc = borc + CASE WHEN NEW.invoice_type LIKE '%incoming%' THEN NEW.payable_amount ELSE 0 END,
    alacak = alacak + CASE WHEN NEW.invoice_type NOT LIKE '%incoming%' THEN NEW.payable_amount ELSE 0 END,
    bakiye = alacak - borc,
    updated_at = NOW()
  WHERE id = v_cari_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger'ı aktifleştir
CREATE TRIGGER trigger_uyumsoft_to_cari_hareket
  AFTER INSERT ON uyumsoft_invoices
  FOR EACH ROW
  EXECUTE FUNCTION create_cari_hareket_from_uyumsoft();

-- Mevcut Uyumsoft faturalarından cari hareketleri oluştur (tek seferlik)
INSERT INTO cari_hareketler (
  cari_id,
  hareket_tipi,
  belge_tipi,
  belge_no,
  belge_tarihi,
  borc,
  alacak,
  aciklama,
  uyumsoft_fatura_id
)
SELECT 
  c.id as cari_id,
  CASE 
    WHEN u.invoice_type LIKE '%incoming%' THEN 'fatura_alis'
    ELSE 'fatura_satis'
  END as hareket_tipi,
  'fatura' as belge_tipi,
  u.invoice_no,
  u.invoice_date,
  CASE WHEN u.invoice_type LIKE '%incoming%' THEN u.payable_amount ELSE 0 END as borc,
  CASE WHEN u.invoice_type NOT LIKE '%incoming%' THEN u.payable_amount ELSE 0 END as alacak,
  'Uyumsoft E-Fatura: ' || u.invoice_no as aciklama,
  u.id as uyumsoft_fatura_id
FROM uyumsoft_invoices u
JOIN cariler c ON c.vergi_no = u.sender_vkn
WHERE NOT EXISTS (
  SELECT 1 FROM cari_hareketler ch 
  WHERE ch.uyumsoft_fatura_id = u.id
);

-- RLS (Row Level Security) for Supabase
ALTER TABLE cari_hareketler ENABLE ROW LEVEL SECURITY;

-- Herkes okuyabilir (şimdilik)
CREATE POLICY "Cari hareketler okunabilir" ON cari_hareketler
  FOR SELECT USING (true);

-- Sadece authenticated kullanıcılar yazabilir
CREATE POLICY "Cari hareketler yazılabilir" ON cari_hareketler
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Cari hareketler güncellenebilir" ON cari_hareketler
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Cari hareketler silinebilir" ON cari_hareketler
  FOR DELETE USING (auth.uid() IS NOT NULL);
