-- =====================================================
-- User Preferences Table
-- Kullanıcı tercihlerini DB'de saklamak için
-- =====================================================

-- User preferences tablosu
CREATE TABLE IF NOT EXISTS user_preferences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    preference_key VARCHAR(100) NOT NULL,
    preference_value JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, preference_key)
);

-- Index for fast user lookup
CREATE INDEX IF NOT EXISTS idx_user_preferences_user ON user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_key ON user_preferences(preference_key);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_user_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_user_preferences_updated_at ON user_preferences;
CREATE TRIGGER trigger_user_preferences_updated_at
    BEFORE UPDATE ON user_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_user_preferences_updated_at();

-- Varsayılan tercih kategorileri için yorum
COMMENT ON TABLE user_preferences IS 'Kullanıcı tercihleri - tema, bildirim ayarları vb.';
COMMENT ON COLUMN user_preferences.preference_key IS 'Tercih anahtarı: theme, notifications, display, ai_settings vb.';
COMMENT ON COLUMN user_preferences.preference_value IS 'JSON formatında tercih değerleri';
