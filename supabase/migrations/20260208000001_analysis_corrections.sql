-- ====================================================
-- MIGRATION: Analysis Corrections (HITL)
-- Tarih: 2026-02-08
-- Açıklama: Kullanıcıların analiz sonuçlarını düzeltmesi ve
--           bu düzeltmelerin model eğitiminde kullanılması için tablo
-- ====================================================

-- analysis_corrections tablosu
CREATE TABLE IF NOT EXISTS analysis_corrections (
    id SERIAL PRIMARY KEY,
    document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
    tender_id INTEGER REFERENCES tenders(id) ON DELETE CASCADE,
    field_path VARCHAR(255) NOT NULL,         -- örnek: "servis_saatleri.kahvalti"
    old_value JSONB,                          -- önceki değer
    new_value JSONB,                          -- düzeltilmiş değer
    correction_type VARCHAR(20) NOT NULL DEFAULT 'edit'
        CHECK (correction_type IN ('edit', 'delete', 'add', 'confirm')),
    corrected_by VARCHAR(100),                -- kullanıcı adı/email
    used_in_training BOOLEAN DEFAULT false,   -- eğitimde kullanıldı mı
    blob_synced BOOLEAN DEFAULT false,        -- Azure Blob'a yazıldı mı
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Sık sorgulanan kolonlar için indexler
CREATE INDEX IF NOT EXISTS idx_corrections_document_id ON analysis_corrections(document_id);
CREATE INDEX IF NOT EXISTS idx_corrections_tender_id ON analysis_corrections(tender_id);
CREATE INDEX IF NOT EXISTS idx_corrections_used_in_training ON analysis_corrections(used_in_training) WHERE used_in_training = false;
CREATE INDEX IF NOT EXISTS idx_corrections_field_path ON analysis_corrections(field_path);
CREATE INDEX IF NOT EXISTS idx_corrections_created_at ON analysis_corrections(created_at DESC);

-- updated_at trigger
CREATE TRIGGER update_analysis_corrections_updated_at
    BEFORE UPDATE ON analysis_corrections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Toplam düzeltme sayısını hızlıca almak için
COMMENT ON TABLE analysis_corrections IS 'HITL: Kullanıcı analiz düzeltmeleri. Eğitim pipeline tarafından tüketilir.';
COMMENT ON COLUMN analysis_corrections.field_path IS 'Düzeltilen alanın yolu, örn: teknik_sartlar, servis_saatleri.kahvalti';
COMMENT ON COLUMN analysis_corrections.used_in_training IS 'Model eğitiminde kullanıldıysa true olarak işaretlenir';
COMMENT ON COLUMN analysis_corrections.blob_synced IS 'Azure Blob Storage''a labels.json olarak yazıldıysa true';

-- ====================================================
-- Migration tamamlandı
-- ====================================================
