-- Migration: 060_document_duplicates_cleanup.sql
-- Açıklama: Döküman duplikelerini temizle ve önle

-- 1. Önce mevcut duplikeleri temizle (her grup için en yeni kaydı tut)
WITH duplicates AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY tender_id, original_filename 
           ORDER BY created_at DESC, id DESC
         ) as rn
  FROM documents
  WHERE tender_id IS NOT NULL
)
DELETE FROM documents 
WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

-- 2. Duplike önlemek için UNIQUE index ekle
-- (tender_id + original_filename kombinasyonu benzersiz olmalı)
CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_tender_filename_unique 
ON documents (tender_id, original_filename) 
WHERE tender_id IS NOT NULL;

-- 3. source_url için de benzersizlik (aynı URL'den iki kez indirmeyi önle)
CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_source_url_unique 
ON documents (tender_id, source_url) 
WHERE tender_id IS NOT NULL AND source_url IS NOT NULL;

-- Not: ON CONFLICT kullanımı için kod güncellemesi gerekli
-- document-storage.js dosyasında INSERT ... ON CONFLICT DO NOTHING kullanılacak
