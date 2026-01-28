-- Mükerrer Fatura Tespit Tabloları

-- Uyumsoft faturalarına yeni kolonlar ekle
ALTER TABLE uyumsoft_invoices ADD COLUMN IF NOT EXISTS direction VARCHAR(10) DEFAULT 'incoming';
ALTER TABLE uyumsoft_invoices ADD COLUMN IF NOT EXISTS is_duplicate BOOLEAN DEFAULT FALSE;
ALTER TABLE uyumsoft_invoices ADD COLUMN IF NOT EXISTS duplicate_of INTEGER REFERENCES uyumsoft_invoices(id);
ALTER TABLE uyumsoft_invoices ADD COLUMN IF NOT EXISTS duplicate_confidence INTEGER;
ALTER TABLE uyumsoft_invoices ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT FALSE;
ALTER TABLE uyumsoft_invoices ADD COLUMN IF NOT EXISTS is_rejected BOOLEAN DEFAULT FALSE;
ALTER TABLE uyumsoft_invoices ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Mükerrer fatura ilişkileri tablosu
CREATE TABLE IF NOT EXISTS invoice_duplicates (
    id SERIAL PRIMARY KEY,
    original_invoice_id INTEGER REFERENCES uyumsoft_invoices(id) ON DELETE CASCADE,
    duplicate_invoice_id INTEGER REFERENCES uyumsoft_invoices(id) ON DELETE CASCADE,
    confidence INTEGER CHECK (confidence >= 0 AND confidence <= 100),
    match_type VARCHAR(50), -- exact_match, similar, invoice_no_similar
    amount_diff DECIMAL(15,2),
    amount_diff_percent DECIMAL(5,2),
    days_diff INTEGER,
    detected_at TIMESTAMP DEFAULT NOW(),
    reviewed_at TIMESTAMP,
    reviewed_by VARCHAR(100),
    status VARCHAR(50) DEFAULT 'pending_review', -- pending_review, confirmed, rejected, auto_rejected
    notes TEXT,
    ai_analysis JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(original_invoice_id, duplicate_invoice_id)
);

-- İndeksler
CREATE INDEX idx_invoice_duplicates_status ON invoice_duplicates(status);
CREATE INDEX idx_invoice_duplicates_confidence ON invoice_duplicates(confidence DESC);
CREATE INDEX idx_invoice_duplicates_original ON invoice_duplicates(original_invoice_id);
CREATE INDEX idx_invoice_duplicates_duplicate ON invoice_duplicates(duplicate_invoice_id);
CREATE INDEX idx_uyumsoft_duplicates ON uyumsoft_invoices(is_duplicate) WHERE is_duplicate = true;
CREATE INDEX idx_uyumsoft_direction ON uyumsoft_invoices(direction);

-- Benzerlik uzantısı (PostgreSQL fuzzy string matching)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Fatura numarası benzerlik indexi
CREATE INDEX idx_uyumsoft_invoice_no_trgm ON uyumsoft_invoices USING gin (invoice_no gin_trgm_ops);

-- Mükerrer tespit istatistikleri
CREATE TABLE IF NOT EXISTS duplicate_detection_stats (
    id SERIAL PRIMARY KEY,
    run_date DATE NOT NULL,
    total_invoices INTEGER,
    duplicates_found INTEGER,
    high_confidence INTEGER,
    medium_confidence INTEGER,
    low_confidence INTEGER,
    potential_savings DECIMAL(15,2),
    auto_rejected INTEGER,
    manually_reviewed INTEGER,
    false_positives INTEGER,
    execution_time_ms INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Manuel faturalara ETTN ve Uyumsoft durumu ekle
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS ettn VARCHAR(100);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS uyumsoft_status VARCHAR(50);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS uyumsoft_sent_at TIMESTAMP;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS uyumsoft_error TEXT;

-- Satış faturası view'ı
CREATE OR REPLACE VIEW v_sales_invoices AS
SELECT 
    i.*,
    c.unvan as cari_unvan,
    c.vergi_no as cari_vkn,
    c.email as cari_email,
    COALESCE(
        (SELECT SUM(line_total) FROM invoice_items WHERE invoice_id = i.id),
        0
    ) as calculated_total
FROM invoices i
LEFT JOIN cariler c ON i.customer_id = c.id
WHERE i.invoice_type = 'sales';

-- Mükerrer tespit view'ı
CREATE OR REPLACE VIEW v_duplicate_invoices AS
SELECT 
    d.id as detection_id,
    d.confidence,
    d.match_type,
    d.status as detection_status,
    d.detected_at,
    o.id as original_id,
    o.invoice_no as original_no,
    o.invoice_date as original_date,
    o.sender_name as original_vendor,
    o.payable_amount as original_amount,
    dup.id as duplicate_id,
    dup.invoice_no as duplicate_no,
    dup.invoice_date as duplicate_date,
    dup.payable_amount as duplicate_amount,
    d.amount_diff,
    d.amount_diff_percent,
    d.days_diff
FROM invoice_duplicates d
JOIN uyumsoft_invoices o ON d.original_invoice_id = o.id
JOIN uyumsoft_invoices dup ON d.duplicate_invoice_id = dup.id
ORDER BY d.confidence DESC, d.detected_at DESC;

-- Trigger: Yeni fatura eklendiğinde otomatik mükerrer kontrolü
CREATE OR REPLACE FUNCTION check_duplicate_on_insert()
RETURNS TRIGGER AS $$
DECLARE
    duplicate_count INTEGER;
BEGIN
    -- Aynı VKN, yakın tarih ve benzer tutar kontrolü
    SELECT COUNT(*)
    INTO duplicate_count
    FROM uyumsoft_invoices
    WHERE 
        sender_vkn = NEW.sender_vkn
        AND id != NEW.id
        AND ABS(payable_amount - NEW.payable_amount) < (NEW.payable_amount * 0.01)
        AND invoice_date BETWEEN NEW.invoice_date - INTERVAL '3 days' 
                            AND NEW.invoice_date + INTERVAL '3 days';
    
    -- Mükerrer varsa işaretle (onay beklesin)
    IF duplicate_count > 0 THEN
        NEW.is_duplicate := NULL; -- Manuel kontrol gerekli
        RAISE NOTICE 'Potansiyel mükerrer fatura tespit edildi: %', NEW.invoice_no;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger'ı aktif et
CREATE TRIGGER trg_check_duplicate_invoice
    BEFORE INSERT ON uyumsoft_invoices
    FOR EACH ROW
    EXECUTE FUNCTION check_duplicate_on_insert();

-- İstatistik fonksiyonu
CREATE OR REPLACE FUNCTION calculate_duplicate_stats(
    start_date DATE,
    end_date DATE
) RETURNS TABLE(
    total_invoices BIGINT,
    duplicate_count BIGINT,
    potential_savings NUMERIC,
    top_duplicate_vendor TEXT,
    most_common_match_type TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(DISTINCT i.id),
        COUNT(DISTINCT CASE WHEN i.is_duplicate THEN i.id END),
        SUM(CASE WHEN i.is_duplicate THEN i.payable_amount ELSE 0 END),
        (
            SELECT sender_name 
            FROM uyumsoft_invoices 
            WHERE is_duplicate = true 
            GROUP BY sender_name 
            ORDER BY COUNT(*) DESC 
            LIMIT 1
        ),
        (
            SELECT match_type 
            FROM invoice_duplicates 
            WHERE detected_at BETWEEN start_date AND end_date
            GROUP BY match_type 
            ORDER BY COUNT(*) DESC 
            LIMIT 1
        )
    FROM uyumsoft_invoices i
    WHERE i.invoice_date BETWEEN start_date AND end_date;
END;
$$ LANGUAGE plpgsql;

-- Mükerrer temizleme prosedürü
CREATE OR REPLACE FUNCTION auto_reject_obvious_duplicates()
RETURNS INTEGER AS $$
DECLARE
    rejected_count INTEGER := 0;
BEGIN
    -- %100 aynı olanları otomatik reddet
    UPDATE invoice_duplicates
    SET 
        status = 'auto_rejected',
        reviewed_at = NOW(),
        reviewed_by = 'SYSTEM',
        notes = 'Otomatik reddedildi: Aynı fatura no, tarih ve tutar'
    WHERE status = 'pending_review'
    AND confidence >= 95
    AND amount_diff = 0
    AND days_diff = 0;
    
    GET DIAGNOSTICS rejected_count = ROW_COUNT;
    
    -- İlgili faturaları da işaretle
    UPDATE uyumsoft_invoices u
    SET 
        is_duplicate = true,
        is_rejected = true,
        rejection_reason = 'Mükerrer fatura - otomatik reddedildi'
    WHERE EXISTS (
        SELECT 1 FROM invoice_duplicates d
        WHERE d.duplicate_invoice_id = u.id
        AND d.status = 'auto_rejected'
    );
    
    RETURN rejected_count;
END;
$$ LANGUAGE plpgsql;

-- Haftalık mükerrer raporu için cron job hazırlığı
COMMENT ON FUNCTION calculate_duplicate_stats IS 
'Her Pazartesi sabah 09:00''da çalıştırılacak. Cron: 0 9 * * 1';
