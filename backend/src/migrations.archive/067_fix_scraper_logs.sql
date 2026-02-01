-- scraper_logs tablosuna eksik kolonları ekle (tender-scheduler için)
ALTER TABLE scraper_logs ADD COLUMN IF NOT EXISTS action VARCHAR(50);
ALTER TABLE scraper_logs ADD COLUMN IF NOT EXISTS status VARCHAR(50);
ALTER TABLE scraper_logs ADD COLUMN IF NOT EXISTS metadata JSONB;
ALTER TABLE scraper_logs ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE scraper_logs ADD COLUMN IF NOT EXISTS finished_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE scraper_logs ADD COLUMN IF NOT EXISTS tenders_found INTEGER DEFAULT 0;
ALTER TABLE scraper_logs ADD COLUMN IF NOT EXISTS tenders_new INTEGER DEFAULT 0;
ALTER TABLE scraper_logs ADD COLUMN IF NOT EXISTS tenders_updated INTEGER DEFAULT 0;
ALTER TABLE scraper_logs ADD COLUMN IF NOT EXISTS pages_scraped INTEGER DEFAULT 0;

-- Mevcut veriler için varsayılan değer
UPDATE scraper_logs SET action = 'scrape' WHERE action IS NULL;
