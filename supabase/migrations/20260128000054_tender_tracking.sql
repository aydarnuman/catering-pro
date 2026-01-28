-- İhale Takip Tablosu
CREATE TABLE IF NOT EXISTS tender_tracking (
    id SERIAL PRIMARY KEY,
    tender_id INTEGER NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'bekliyor', -- bekliyor, basvuruldu, kazanildi, kaybedildi, iptal
    notes TEXT,
    priority INTEGER DEFAULT 0, -- 0: normal, 1: yüksek, 2: acil
    analysis_summary JSONB, -- Analiz özeti (teknik şartlar, birim fiyatlar, notlar)
    documents_analyzed INTEGER DEFAULT 0,
    last_analysis_at TIMESTAMP,
    reminder_date DATE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(tender_id, user_id)
);

-- İndeksler
CREATE INDEX idx_tender_tracking_user ON tender_tracking(user_id);
CREATE INDEX idx_tender_tracking_status ON tender_tracking(status);
CREATE INDEX idx_tender_tracking_tender ON tender_tracking(tender_id);

-- Updated at trigger
CREATE TRIGGER set_tender_tracking_updated_at
BEFORE UPDATE ON tender_tracking
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();

-- Yorum: Bu tablo analiz edilen ihaleleri takip etmek için kullanılır
-- Analiz tamamlandığında otomatik olarak eklenir