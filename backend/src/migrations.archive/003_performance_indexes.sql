-- Performans İndeksleri (Supabase AI Önerisi)

-- pg_trgm extension (text search için)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- JSONB İndeksleri
CREATE INDEX IF NOT EXISTS idx_tenders_document_links_gin 
ON public.tenders USING gin (document_links jsonb_path_ops);

CREATE INDEX IF NOT EXISTS idx_tenders_raw_data_gin 
ON public.tenders USING gin (raw_data jsonb_path_ops);

-- Tarih/Sıralama İndeksleri
CREATE INDEX IF NOT EXISTS idx_tenders_scraped_at ON public.tenders(scraped_at);
CREATE INDEX IF NOT EXISTS idx_tenders_publish_date ON public.tenders(publish_date);
CREATE INDEX IF NOT EXISTS idx_tenders_updated_at ON public.tenders(updated_at);

-- Filtre İndeksleri (zaten var olanları tekrar eklemiyor)
-- CREATE INDEX IF NOT EXISTS idx_tenders_status ON public.tenders(status); -- Zaten var
-- CREATE INDEX IF NOT EXISTS idx_tenders_city ON public.tenders(city); -- Zaten var

-- Tip filtreleri
CREATE INDEX IF NOT EXISTS idx_tenders_tender_type ON public.tenders(tender_type);
CREATE INDEX IF NOT EXISTS idx_tenders_category_id ON public.tenders(category_id);

-- Arama için
CREATE INDEX IF NOT EXISTS idx_tenders_organization_name ON public.tenders(organization_name);
CREATE INDEX IF NOT EXISTS idx_tenders_external_id ON public.tenders(external_id);

-- Composite index (sık kullanılan filtreler)
CREATE INDEX IF NOT EXISTS idx_tenders_status_city ON public.tenders(status, city);
CREATE INDEX IF NOT EXISTS idx_tenders_status_date ON public.tenders(status, tender_date);

-- Text search için (gelecekte kullanılabilir)
CREATE INDEX IF NOT EXISTS idx_tenders_title_trgm ON public.tenders USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_tenders_org_trgm ON public.tenders USING gin (organization_name gin_trgm_ops);

