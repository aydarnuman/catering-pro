-- İhale içeriklerini documents tablosuna kaydetmek için yeni kolonlar
-- announcement_content ve goods_services_content'i döküman olarak işleyebilmek için

-- content_text kolonu ekle (dosya yerine metin içerik için)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS content_text TEXT;

-- content_type kolonu ekle (daha iyi filtreleme için)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS content_type VARCHAR(50);

-- source_type için yeni değer: 'content' (ihale içerikleri için)
-- Mevcut değerler: 'download' (indirilenler), 'upload' (manuel yüklenenler)

-- İndeks ekle
CREATE INDEX IF NOT EXISTS idx_documents_content_type ON documents(content_type);
CREATE INDEX IF NOT EXISTS idx_documents_source_type ON documents(source_type);

-- source_type check constraint güncelle (varsa)
-- Yeni constraint ekle
DO $$ 
BEGIN
    -- Eski constraint'i kaldır (varsa)
    ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_source_type_check;
    
    -- Yeni constraint ekle
    ALTER TABLE documents ADD CONSTRAINT documents_source_type_check 
    CHECK (source_type IN ('upload', 'download', 'content'));
    
EXCEPTION WHEN OTHERS THEN
    -- Constraint yoksa hiçbir şey yapma
    NULL;
END $$;

COMMENT ON COLUMN documents.content_text IS 'Dosya yerine direkt metin içerik (ihale ilanı, mal/hizmet listesi için)';
COMMENT ON COLUMN documents.content_type IS 'İçerik tipi: announcement, goods_services, extracted_text';
COMMENT ON COLUMN documents.source_type IS 'Kaynak tipi: upload (manuel), download (scraper), content (ihale içeriği)';