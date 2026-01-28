-- İhale Tablosu
CREATE TABLE IF NOT EXISTS tenders (
    id SERIAL PRIMARY KEY,
    external_id VARCHAR(50) UNIQUE NOT NULL,
    ikn VARCHAR(50),
    title TEXT NOT NULL,
    publish_date DATE,
    tender_date TIMESTAMP,
    city VARCHAR(100),
    location TEXT,
    organization_name TEXT,
    estimated_cost DECIMAL(15,2),
    estimated_cost_raw VARCHAR(255),
    tender_type VARCHAR(100),
    url TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    detail_scraped BOOLEAN DEFAULT FALSE,
    scraped_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- İndeksler
CREATE INDEX idx_tenders_status ON tenders(status);
CREATE INDEX idx_tenders_city ON tenders(city);
CREATE INDEX idx_tenders_tender_date ON tenders(tender_date);
CREATE INDEX idx_tenders_detail_scraped ON tenders(detail_scraped);

-- Scraper Log Tablosu
CREATE TABLE IF NOT EXISTS scraper_logs (
    id SERIAL PRIMARY KEY,
    action VARCHAR(50) NOT NULL,
    started_at TIMESTAMP DEFAULT NOW(),
    finished_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'running',
    pages_scraped INTEGER DEFAULT 0,
    tenders_found INTEGER DEFAULT 0,
    tenders_new INTEGER DEFAULT 0,
    tenders_updated INTEGER DEFAULT 0,
    error_message TEXT,
    metadata JSONB
);

-- Döküman Tablosu
CREATE TABLE IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY,
    tender_id INTEGER REFERENCES tenders(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    file_size INTEGER NOT NULL,
    file_path TEXT NOT NULL,
    extracted_text TEXT,
    ocr_result JSONB,
    analysis_result JSONB,
    processing_status VARCHAR(50) DEFAULT 'pending',
    processed_at TIMESTAMP,
    uploaded_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_documents_tender_id ON documents(tender_id);
CREATE INDEX idx_documents_processing_status ON documents(processing_status);

-- Kullanıcı Tablosu
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(20) DEFAULT 'user',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);

-- Aktif ihaleler view
CREATE OR REPLACE VIEW active_tenders AS
SELECT * FROM tenders 
WHERE status = 'active' 
AND (tender_date IS NULL OR tender_date > NOW())
ORDER BY tender_date ASC;

-- Şehir istatistikleri view
CREATE OR REPLACE VIEW tenders_by_city AS
SELECT 
    COALESCE(city, 'Bilinmiyor') as city,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE status = 'active') as active
FROM tenders 
GROUP BY city 
ORDER BY total DESC;
