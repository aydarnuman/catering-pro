-- =====================================================
-- AI AYARLARI VERSİYONLAMA SİSTEMİ
-- Ayar değişikliklerinin geçmişini tutar
-- =====================================================

-- 1. AI ayarları versiyon geçmişi tablosu
CREATE TABLE IF NOT EXISTS ai_settings_history (
    id SERIAL PRIMARY KEY,
    setting_key VARCHAR(100) NOT NULL,        -- Hangi ayar (default_model, auto_learn_enabled, vb.)
    setting_value JSONB NOT NULL,             -- Ayar değeri (JSON formatında)
    version INTEGER NOT NULL,                 -- Versiyon numarası (her ayar için ayrı)
    changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    change_note TEXT,                         -- Değişiklik notu (opsiyonel)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_settings_history_key ON ai_settings_history(setting_key);
CREATE INDEX IF NOT EXISTS idx_settings_history_version ON ai_settings_history(setting_key, version DESC);
CREATE INDEX IF NOT EXISTS idx_settings_history_created ON ai_settings_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_settings_history_user ON ai_settings_history(changed_by);

-- 2. Her ayar için son versiyon numarasını getiren fonksiyon
CREATE OR REPLACE FUNCTION get_next_version(p_setting_key VARCHAR)
RETURNS INTEGER AS $$
DECLARE
    max_version INTEGER;
BEGIN
    SELECT COALESCE(MAX(version), 0) INTO max_version
    FROM ai_settings_history
    WHERE setting_key = p_setting_key;
    
    RETURN max_version + 1;
END;
$$ LANGUAGE plpgsql;

-- 3. Ayar değişikliğini versiyon geçmişine kaydet
CREATE OR REPLACE FUNCTION save_setting_version(
    p_setting_key VARCHAR,
    p_setting_value JSONB,
    p_changed_by INTEGER,
    p_change_note TEXT DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    v_version INTEGER;
BEGIN
    -- Sonraki versiyon numarasını al
    v_version := get_next_version(p_setting_key);
    
    -- Versiyon geçmişine kaydet
    INSERT INTO ai_settings_history (setting_key, setting_value, version, changed_by, change_note)
    VALUES (p_setting_key, p_setting_value, v_version, p_changed_by, p_change_note);
    
    RETURN v_version;
END;
$$ LANGUAGE plpgsql;

-- 4. Belirli bir versiyonu getir
CREATE OR REPLACE FUNCTION get_setting_version(p_setting_key VARCHAR, p_version INTEGER)
RETURNS TABLE(
    id INTEGER,
    setting_key VARCHAR,
    setting_value JSONB,
    version INTEGER,
    changed_by INTEGER,
    change_note TEXT,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        h.id,
        h.setting_key,
        h.setting_value,
        h.version,
        h.changed_by,
        h.change_note,
        h.created_at
    FROM ai_settings_history h
    WHERE h.setting_key = p_setting_key AND h.version = p_version
    ORDER BY h.created_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- 5. Ayarın tüm versiyon geçmişini getir
CREATE OR REPLACE FUNCTION get_setting_history(p_setting_key VARCHAR, p_limit INTEGER DEFAULT 50)
RETURNS TABLE(
    id INTEGER,
    setting_key VARCHAR,
    setting_value JSONB,
    version INTEGER,
    changed_by INTEGER,
    change_note TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    user_name VARCHAR,
    user_email VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        h.id,
        h.setting_key,
        h.setting_value,
        h.version,
        h.changed_by,
        h.change_note,
        h.created_at,
        u.name as user_name,
        u.email as user_email
    FROM ai_settings_history h
    LEFT JOIN users u ON u.id = h.changed_by
    WHERE h.setting_key = p_setting_key
    ORDER BY h.version DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- 6. Tüm ayarların versiyon geçmişini getir (son N kayıt)
CREATE OR REPLACE FUNCTION get_all_settings_history(p_limit INTEGER DEFAULT 100)
RETURNS TABLE(
    id INTEGER,
    setting_key VARCHAR,
    setting_value JSONB,
    version INTEGER,
    changed_by INTEGER,
    change_note TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    user_name VARCHAR,
    user_email VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        h.id,
        h.setting_key,
        h.setting_value,
        h.version,
        h.changed_by,
        h.change_note,
        h.created_at,
        u.name as user_name,
        u.email as user_email
    FROM ai_settings_history h
    LEFT JOIN users u ON u.id = h.changed_by
    ORDER BY h.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- 7. Eski versiyonları temizleme fonksiyonu (90 günden eski)
CREATE OR REPLACE FUNCTION cleanup_old_settings_history()
RETURNS void AS $$
BEGIN
    -- Her ayar için son 10 versiyonu koru, geri kalanını sil
    DELETE FROM ai_settings_history
    WHERE id NOT IN (
        SELECT id FROM (
            SELECT id, ROW_NUMBER() OVER (PARTITION BY setting_key ORDER BY version DESC) as rn
            FROM ai_settings_history
        ) ranked
        WHERE rn <= 10
    )
    AND created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- Yorumlar
COMMENT ON TABLE ai_settings_history IS 'AI ayarları versiyon geçmişi';
COMMENT ON COLUMN ai_settings_history.setting_key IS 'Ayar anahtarı (default_model, auto_learn_enabled, vb.)';
COMMENT ON COLUMN ai_settings_history.setting_value IS 'Ayar değeri (JSON formatında)';
COMMENT ON COLUMN ai_settings_history.version IS 'Versiyon numarası (her ayar için ayrı sayaç)';
COMMENT ON COLUMN ai_settings_history.change_note IS 'Değişiklik notu (opsiyonel)';
