-- ====================================================
-- FATURA TABLOLARI MIGRATION
-- ====================================================

-- Manuel Faturalar Tablosu
CREATE TABLE IF NOT EXISTS invoices (
    id SERIAL PRIMARY KEY,
    invoice_type VARCHAR(10) NOT NULL CHECK (invoice_type IN ('sales', 'purchase')), -- satış/alış
    series VARCHAR(10) NOT NULL, -- Seri (A, B vs)
    invoice_no VARCHAR(50) NOT NULL, -- Fatura No
    
    -- Cari Bilgileri
    customer_id INTEGER, -- İleride cariler tablosu eklenince kullanılacak
    customer_name VARCHAR(255) NOT NULL,
    customer_vkn VARCHAR(20), -- VKN/TCKN
    customer_address TEXT,
    customer_phone VARCHAR(50),
    customer_email VARCHAR(100),
    
    -- Tarihler
    invoice_date DATE NOT NULL,
    due_date DATE,
    
    -- Tutarlar
    subtotal DECIMAL(15,2) DEFAULT 0, -- Ara toplam
    vat_total DECIMAL(15,2) DEFAULT 0, -- KDV toplamı
    total_amount DECIMAL(15,2) DEFAULT 0, -- Genel toplam
    currency VARCHAR(3) DEFAULT 'TRY',
    
    -- Durum
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
    payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'partial', 'paid')),
    
    -- Notlar
    notes TEXT,
    internal_notes TEXT, -- İç notlar (müşteriye gösterilmez)
    
    -- Metadata
    source VARCHAR(20) DEFAULT 'manual' CHECK (source IN ('manual', 'uyumsoft', 'api', 'import')),
    created_by VARCHAR(100),
    updated_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Unique constraint
    UNIQUE(series, invoice_no)
);

-- Fatura Kalemleri Tablosu
CREATE TABLE IF NOT EXISTS invoice_items (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER REFERENCES invoices(id) ON DELETE CASCADE,
    
    -- Ürün/Hizmet Bilgileri
    description TEXT NOT NULL,
    product_code VARCHAR(50), -- Ürün kodu
    category VARCHAR(100), -- Kategori (tavuk, et, sebze vs.)
    
    -- Miktar ve Fiyat
    quantity DECIMAL(15,3) DEFAULT 1,
    unit VARCHAR(20) DEFAULT 'Adet', -- Birim
    unit_price DECIMAL(15,4) DEFAULT 0, -- Birim fiyat
    
    -- KDV
    vat_rate DECIMAL(5,2) DEFAULT 10, -- KDV oranı %
    vat_amount DECIMAL(15,2) DEFAULT 0, -- KDV tutarı
    
    -- Toplamlar
    line_total DECIMAL(15,2) DEFAULT 0, -- Satır toplamı (KDV hariç)
    line_total_with_vat DECIMAL(15,2) DEFAULT 0, -- KDV dahil toplam
    
    -- İndirim (ileride kullanılabilir)
    discount_rate DECIMAL(5,2) DEFAULT 0,
    discount_amount DECIMAL(15,2) DEFAULT 0,
    
    -- Sıralama
    line_order INTEGER DEFAULT 1,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Uyumsoft Faturaları Tablosu (E-Fatura)
CREATE TABLE IF NOT EXISTS uyumsoft_invoices (
    id SERIAL PRIMARY KEY,
    
    -- Uyumsoft Referansları
    ettn VARCHAR(100) UNIQUE NOT NULL, -- Evrensel Tekil Tanımlama Numarası
    invoice_id VARCHAR(100), -- Fatura ID
    invoice_no VARCHAR(50) NOT NULL, -- Fatura No
    
    -- Fatura Bilgileri
    invoice_type VARCHAR(20) DEFAULT 'incoming', -- gelen/giden
    invoice_date TIMESTAMP,
    creation_date TIMESTAMP,
    
    -- Gönderen Firma
    sender_vkn VARCHAR(20),
    sender_name VARCHAR(500),
    sender_email VARCHAR(100),
    sender_address TEXT,
    
    -- Alan Firma (bizim firma)
    receiver_vkn VARCHAR(20),
    receiver_name VARCHAR(500),
    
    -- Tutarlar
    taxable_amount DECIMAL(15,2) DEFAULT 0, -- Vergiler hariç tutar
    tax_amount DECIMAL(15,2) DEFAULT 0, -- KDV tutarı
    payable_amount DECIMAL(15,2) DEFAULT 0, -- Ödenecek tutar
    currency VARCHAR(3) DEFAULT 'TRY',
    
    -- Durum
    status VARCHAR(50),
    is_new BOOLEAN DEFAULT FALSE,
    is_seen BOOLEAN DEFAULT FALSE,
    is_approved BOOLEAN DEFAULT FALSE,
    is_rejected BOOLEAN DEFAULT FALSE,
    
    -- E-İmza
    is_verified BOOLEAN DEFAULT FALSE,
    signing_date TIMESTAMP,
    
    -- Dökümanlar (Base64 veya URL)
    html_content TEXT, -- HTML görünümü
    pdf_url TEXT, -- PDF link
    xml_content TEXT, -- XML içeriği
    
    -- AI Analizi için
    ai_processed BOOLEAN DEFAULT FALSE,
    ai_analysis JSONB, -- AI analiz sonuçları
    extracted_items JSONB, -- Faturadan çıkarılan kalemler
    
    -- Sync bilgisi
    last_sync_date TIMESTAMP,
    sync_status VARCHAR(20),
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Uyumsoft Fatura Kalemleri (AI ile çıkarılanlar)
CREATE TABLE IF NOT EXISTS uyumsoft_invoice_items (
    id SERIAL PRIMARY KEY,
    uyumsoft_invoice_id INTEGER REFERENCES uyumsoft_invoices(id) ON DELETE CASCADE,
    
    -- Ürün Bilgileri
    product_name VARCHAR(500),
    product_code VARCHAR(100),
    category VARCHAR(100), -- AI ile kategorilendirilecek
    
    -- Miktarlar
    quantity DECIMAL(15,3),
    unit VARCHAR(50),
    unit_price DECIMAL(15,4),
    
    -- Tutarlar
    amount DECIMAL(15,2),
    vat_rate DECIMAL(5,2),
    vat_amount DECIMAL(15,2),
    total_amount DECIMAL(15,2),
    
    -- AI Analizi
    ai_confidence DECIMAL(5,2), -- AI güven skoru
    ai_category VARCHAR(100), -- AI tarafından belirlenen kategori
    ai_tags JSONB, -- AI etiketleri
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- Fatura Ödemeleri Tablosu (ileride kullanılabilir)
CREATE TABLE IF NOT EXISTS invoice_payments (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER REFERENCES invoices(id) ON DELETE CASCADE,
    
    payment_date DATE NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    payment_method VARCHAR(50), -- nakit, banka, kredi kartı vs.
    bank_account VARCHAR(100),
    reference_no VARCHAR(100), -- Dekont no vs.
    notes TEXT,
    
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);

-- İndeksler
CREATE INDEX idx_invoices_type ON invoices(invoice_type);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_invoice_date ON invoices(invoice_date);
CREATE INDEX idx_invoices_customer_name ON invoices(customer_name);
CREATE INDEX idx_invoices_source ON invoices(source);
CREATE INDEX idx_invoices_created_at ON invoices(created_at);

CREATE INDEX idx_invoice_items_invoice_id ON invoice_items(invoice_id);
CREATE INDEX idx_invoice_items_category ON invoice_items(category);
CREATE INDEX idx_invoice_items_product_code ON invoice_items(product_code);

CREATE INDEX idx_uyumsoft_invoices_ettn ON uyumsoft_invoices(ettn);
CREATE INDEX idx_uyumsoft_invoices_invoice_no ON uyumsoft_invoices(invoice_no);
CREATE INDEX idx_uyumsoft_invoices_invoice_date ON uyumsoft_invoices(invoice_date);
CREATE INDEX idx_uyumsoft_invoices_sender_vkn ON uyumsoft_invoices(sender_vkn);
CREATE INDEX idx_uyumsoft_invoices_sender_name ON uyumsoft_invoices(sender_name);
CREATE INDEX idx_uyumsoft_invoices_ai_processed ON uyumsoft_invoices(ai_processed);

CREATE INDEX idx_uyumsoft_invoice_items_category ON uyumsoft_invoice_items(category);
CREATE INDEX idx_uyumsoft_invoice_items_ai_category ON uyumsoft_invoice_items(ai_category);

-- Trigger: invoices tablosu updated_at otomatik güncelleme
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoice_items_updated_at BEFORE UPDATE ON invoice_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_uyumsoft_invoices_updated_at BEFORE UPDATE ON uyumsoft_invoices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- AI Analiz için Yardımcı View'lar
CREATE OR REPLACE VIEW invoice_summary AS
SELECT 
    DATE_TRUNC('month', invoice_date) as month,
    invoice_type,
    COUNT(*) as invoice_count,
    SUM(subtotal) as total_subtotal,
    SUM(vat_total) as total_vat,
    SUM(total_amount) as total_amount
FROM invoices
WHERE status != 'cancelled'
GROUP BY DATE_TRUNC('month', invoice_date), invoice_type;

CREATE OR REPLACE VIEW product_purchase_summary AS
SELECT 
    ii.category,
    DATE_TRUNC('month', i.invoice_date) as month,
    SUM(ii.quantity) as total_quantity,
    SUM(ii.line_total) as total_amount,
    COUNT(DISTINCT i.id) as invoice_count,
    AVG(ii.unit_price) as avg_unit_price
FROM invoice_items ii
JOIN invoices i ON ii.invoice_id = i.id
WHERE i.invoice_type = 'purchase'
AND i.status != 'cancelled'
GROUP BY ii.category, DATE_TRUNC('month', i.invoice_date);

-- Uyumsoft faturalar için özet view
CREATE OR REPLACE VIEW uyumsoft_monthly_summary AS
SELECT 
    DATE_TRUNC('month', invoice_date) as month,
    sender_name,
    COUNT(*) as invoice_count,
    SUM(payable_amount) as total_amount,
    SUM(tax_amount) as total_vat
FROM uyumsoft_invoices
GROUP BY DATE_TRUNC('month', invoice_date), sender_name;

-- AI için kategori bazlı analiz view
CREATE OR REPLACE VIEW category_analysis AS
SELECT 
    COALESCE(ii.category, ui.ai_category) as category,
    DATE_TRUNC('month', COALESCE(i.invoice_date, u.invoice_date)) as month,
    SUM(COALESCE(ii.line_total, ui.total_amount)) as total_amount,
    COUNT(*) as item_count
FROM invoice_items ii
FULL OUTER JOIN uyumsoft_invoice_items ui ON FALSE
LEFT JOIN invoices i ON ii.invoice_id = i.id
LEFT JOIN uyumsoft_invoices u ON ui.uyumsoft_invoice_id = u.id
WHERE COALESCE(ii.category, ui.ai_category) IS NOT NULL
GROUP BY COALESCE(ii.category, ui.ai_category), 
         DATE_TRUNC('month', COALESCE(i.invoice_date, u.invoice_date));

-- Başarılı migration mesajı
DO $$ 
BEGIN 
    RAISE NOTICE '✅ Fatura tabloları başarıyla oluşturuldu!';
    RAISE NOTICE '📊 Tablolar: invoices, invoice_items, uyumsoft_invoices, uyumsoft_invoice_items, invoice_payments';
    RAISE NOTICE '👁️ View''lar: invoice_summary, product_purchase_summary, uyumsoft_monthly_summary, category_analysis';
END $$;
