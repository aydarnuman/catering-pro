-- Fix database issues

-- 1. Fix uyumsoft_invoices UNIQUE constraint for ettn
-- Drop existing index first if exists
DROP INDEX IF EXISTS idx_uyumsoft_invoices_ettn;

-- Add proper UNIQUE constraint (needed for ON CONFLICT)
ALTER TABLE uyumsoft_invoices 
DROP CONSTRAINT IF EXISTS uyumsoft_invoices_ettn_key;

ALTER TABLE uyumsoft_invoices 
ADD CONSTRAINT uyumsoft_invoices_ettn_key UNIQUE (ettn);

-- 2. Fix scraper_logs table - add missing message column
ALTER TABLE scraper_logs 
ADD COLUMN IF NOT EXISTS message TEXT;

-- 3. Also fix cariler table VKN constraint issue (for ON CONFLICT)
ALTER TABLE cariler 
DROP CONSTRAINT IF EXISTS cariler_vergi_no_key;

ALTER TABLE cariler 
ADD CONSTRAINT cariler_vergi_no_key UNIQUE (vergi_no);

-- Success message
DO $$ 
BEGIN 
    RAISE NOTICE '✅ Database issues fixed!';
    RAISE NOTICE '📋 Fixed: uyumsoft_invoices ettn UNIQUE constraint';
    RAISE NOTICE '📋 Fixed: scraper_logs message column';
    RAISE NOTICE '📋 Fixed: cariler vergi_no UNIQUE constraint';
END $$;
