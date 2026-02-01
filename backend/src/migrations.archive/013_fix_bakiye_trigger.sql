-- Fix: Remove explicit update of generated bakiye column in trigger
-- The bakiye column is a generated column that automatically calculates from (alacak - borc)
-- We cannot explicitly set it in an UPDATE statement

-- Drop the existing trigger first
DROP TRIGGER IF EXISTS trigger_uyumsoft_to_cari_hareket ON uyumsoft_invoices;

-- Recreate the function without the explicit bakiye update
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
  -- NOTE: bakiye column is GENERATED ALWAYS AS (alacak - borc) STORED, so it updates automatically
  UPDATE cariler
  SET 
    borc = borc + CASE WHEN NEW.invoice_type LIKE '%incoming%' THEN NEW.payable_amount ELSE 0 END,
    alacak = alacak + CASE WHEN NEW.invoice_type NOT LIKE '%incoming%' THEN NEW.payable_amount ELSE 0 END,
    -- bakiye = alacak - borc, -- REMOVED: This is a generated column, it updates automatically
    updated_at = NOW()
  WHERE id = v_cari_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
CREATE TRIGGER trigger_uyumsoft_to_cari_hareket
  AFTER INSERT ON uyumsoft_invoices
  FOR EACH ROW
  EXECUTE FUNCTION create_cari_hareket_from_uyumsoft();
