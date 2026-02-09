-- =============================================================================
-- Migration: Document Queue NOTIFY + Analysis Versioning
-- Description: 
--   1. LISTEN/NOTIFY trigger: documents.processing_status = 'queued' olunca
--      anında queue processor'a bildirim gönder (polling'e bağımlılığı kaldır)
--   2. analysis_history: Analiz versiyonlarını sakla (overwrite yerine)
-- Created: 2026-02-09
-- =============================================================================

-- 1. LISTEN/NOTIFY Trigger Function
-- =============================================================================

CREATE OR REPLACE FUNCTION notify_document_queued()
RETURNS TRIGGER AS $$
BEGIN
    -- Yeni kayıt queued ise veya mevcut kayıt queued'a geçtiyse bildir
    IF (TG_OP = 'INSERT' AND NEW.processing_status = 'queued') OR
       (TG_OP = 'UPDATE' AND NEW.processing_status = 'queued' AND 
        (OLD.processing_status IS DISTINCT FROM 'queued')) THEN
        
        PERFORM pg_notify(
            'document_queued',
            json_build_object(
                'id', NEW.id,
                'tender_id', NEW.tender_id,
                'filename', NEW.original_filename,
                'file_type', NEW.file_type
            )::text
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger oluştur
DROP TRIGGER IF EXISTS trigger_document_queued_notify ON documents;
CREATE TRIGGER trigger_document_queued_notify
    AFTER INSERT OR UPDATE OF processing_status ON documents
    FOR EACH ROW
    EXECUTE FUNCTION notify_document_queued();

COMMENT ON FUNCTION notify_document_queued() IS 
    'Doküman kuyruğa eklenince pg_notify ile queue processor''a anında bildirim gönderir';

-- 2. Analysis History (Doküman Versiyonlama)
-- =============================================================================

-- analysis_history: Her analiz sonucunu versiyonla sakla
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'documents' AND column_name = 'analysis_history'
    ) THEN
        ALTER TABLE documents ADD COLUMN analysis_history JSONB DEFAULT '[]';
        COMMENT ON COLUMN documents.analysis_history IS 
            'Analiz geçmişi: [{version, provider, timestamp, completeness, result_summary}]';
    END IF;
END $$;

-- analysis_version: Kaçıncı analiz olduğunu takip et
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'documents' AND column_name = 'analysis_version'
    ) THEN
        ALTER TABLE documents ADD COLUMN analysis_version INTEGER DEFAULT 0;
        COMMENT ON COLUMN documents.analysis_version IS 'Analiz versiyon numarası (her yeniden analizde artar)';
    END IF;
END $$;

-- Mevcut analysis_result olan kayıtları version 1 yap
UPDATE documents 
SET analysis_version = 1
WHERE analysis_result IS NOT NULL 
  AND analysis_version = 0;

-- 3. Index: Hızlı queue polling için composite index
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_documents_queue_priority
    ON documents(processing_status, created_at ASC)
    WHERE processing_status IN ('queued', 'pending');

-- =============================================================================
-- Migration tamamlandı
-- =============================================================================
