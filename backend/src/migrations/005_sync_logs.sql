-- Senkronizasyon Logları Tablosu
CREATE TABLE IF NOT EXISTS sync_logs (
    id SERIAL PRIMARY KEY,
    sync_type VARCHAR(50) NOT NULL, -- 'auto', 'manual', 'scheduled_6h', 'scheduled_midnight', 'startup'
    status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'error', 'running')),
    started_at TIMESTAMP NOT NULL,
    finished_at TIMESTAMP,
    invoices_synced INTEGER DEFAULT 0,
    new_invoices INTEGER DEFAULT 0,
    error_message TEXT,
    details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Haftalık Raporlar Tablosu
CREATE TABLE IF NOT EXISTS weekly_reports (
    id SERIAL PRIMARY KEY,
    report_date DATE NOT NULL,
    report_data JSONB NOT NULL,
    sent_to TEXT[], -- Email adresleri
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Senkronizasyon Ayarları Tablosu
CREATE TABLE IF NOT EXISTS sync_settings (
    id SERIAL PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Varsayılan ayarları ekle
INSERT INTO sync_settings (setting_key, setting_value, description) VALUES
    ('auto_sync_enabled', 'true', 'Otomatik senkronizasyon aktif/pasif'),
    ('sync_interval_hours', '6', 'Otomatik senkronizasyon aralığı (saat)'),
    ('max_invoices_per_sync', '500', 'Tek seferde çekilecek maksimum fatura'),
    ('sync_months_range', '3', 'Geriye dönük kaç aylık fatura çekilecek'),
    ('notification_emails', '[]', 'Bildirim gönderilecek email adresleri'),
    ('webhook_urls', '[]', 'Bildirim gönderilecek webhook URLleri')
ON CONFLICT (setting_key) DO NOTHING;

-- İndeksler
CREATE INDEX idx_sync_logs_started_at ON sync_logs(started_at DESC);
CREATE INDEX idx_sync_logs_status ON sync_logs(status);
CREATE INDEX idx_sync_logs_sync_type ON sync_logs(sync_type);
CREATE INDEX idx_weekly_reports_report_date ON weekly_reports(report_date DESC);
