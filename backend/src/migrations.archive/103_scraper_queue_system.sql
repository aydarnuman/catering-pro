-- ============================================================================
-- MIGRATION: 059_scraper_queue_system.sql
-- AÇIKLAMA: Scraper için Job Queue, Health Monitoring ve Loglama sistemi
-- TARİH: 2026-01-17
-- ============================================================================

-- ENUM TİPLERİ
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'scraper_job_status') THEN
        CREATE TYPE scraper_job_status AS ENUM (
            'pending', 'processing', 'completed', 'failed', 'retry_pending', 'cancelled'
        );
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'scraper_health_status') THEN
        CREATE TYPE scraper_health_status AS ENUM (
            'healthy', 'degraded', 'open', 'half_open'
        );
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'log_level') THEN
        CREATE TYPE log_level AS ENUM ('DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL');
    END IF;
END $$;

-- TABLO: scraper_jobs
CREATE TABLE IF NOT EXISTS scraper_jobs (
    id SERIAL PRIMARY KEY,
    job_type VARCHAR(20) NOT NULL DEFAULT 'document',
    tender_id INTEGER REFERENCES tenders(id) ON DELETE CASCADE,
    external_id VARCHAR(50),
    tender_url TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    priority INTEGER DEFAULT 5,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 5,
    next_retry_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    error_details JSONB,
    result JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    worker_id VARCHAR(50),
    duration_ms INTEGER,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- TABLO: scraper_health
CREATE TABLE IF NOT EXISTS scraper_health (
    id SERIAL PRIMARY KEY,
    source VARCHAR(50) UNIQUE NOT NULL DEFAULT 'ihalebul',
    status VARCHAR(20) DEFAULT 'healthy',
    failure_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    failure_threshold INTEGER DEFAULT 5,
    success_threshold INTEGER DEFAULT 2,
    last_success_at TIMESTAMP WITH TIME ZONE,
    last_failure_at TIMESTAMP WITH TIME ZONE,
    cooldown_until TIMESTAMP WITH TIME ZONE,
    stats JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- TABLO: scraper_logs
CREATE TABLE IF NOT EXISTS scraper_logs (
    id SERIAL PRIMARY KEY,
    level VARCHAR(10) NOT NULL DEFAULT 'INFO',
    module VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    context JSONB DEFAULT '{}'::jsonb,
    job_id INTEGER REFERENCES scraper_jobs(id) ON DELETE SET NULL,
    tender_id INTEGER REFERENCES tenders(id) ON DELETE SET NULL,
    session_id VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- İNDEKSLER
CREATE INDEX IF NOT EXISTS idx_scraper_jobs_status ON scraper_jobs(status);
CREATE INDEX IF NOT EXISTS idx_scraper_jobs_tender ON scraper_jobs(tender_id);
CREATE INDEX IF NOT EXISTS idx_scraper_logs_created ON scraper_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scraper_logs_level ON scraper_logs(level);

-- VARSAYILAN VERİ
INSERT INTO scraper_health (source, status) VALUES ('ihalebul', 'healthy') ON CONFLICT (source) DO NOTHING;
