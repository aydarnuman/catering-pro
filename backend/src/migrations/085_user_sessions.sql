-- =====================================================
-- User Sessions Management
-- Eşzamanlı oturum yönetimi ve limit kontrolü
-- =====================================================

-- 1. User sessions tablosu
CREATE TABLE IF NOT EXISTS user_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token_hash VARCHAR(255) NOT NULL, -- refresh_tokens tablosundaki token_hash ile ilişkili
    device_info JSONB DEFAULT '{}', -- { userAgent, device, os, browser }
    ip_address INET,
    user_agent TEXT,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token_hash ON user_sessions(refresh_token_hash);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(user_id, is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);

-- 2. Eski session'ları temizleme fonksiyonu (süresi dolmuş)
-- Önce eski imzayı kaldır (001'de RETURNS INTEGER vardı)
DROP FUNCTION IF EXISTS cleanup_expired_sessions();

CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
    UPDATE user_sessions
    SET is_active = FALSE
    WHERE expires_at < NOW() AND is_active = TRUE;
    
    -- 30 günden eski session'ları sil
    DELETE FROM user_sessions
    WHERE expires_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- 3. Kullanıcının aktif session sayısını getir (parametre adları 001 ile uyumlu)
CREATE OR REPLACE FUNCTION get_active_session_count(p_user_id INTEGER)
RETURNS INTEGER AS $$
DECLARE
    count_val INTEGER;
BEGIN
    SELECT COUNT(*) INTO count_val
    FROM user_sessions
    WHERE user_id = p_user_id
      AND is_active = TRUE
      AND expires_at > NOW();
    
    RETURN count_val;
END;
$$ LANGUAGE plpgsql;

-- 4. En eski aktif session'ı getir (parametre adları 001 ile uyumlu)
CREATE OR REPLACE FUNCTION get_oldest_active_session(p_user_id INTEGER)
RETURNS INTEGER AS $$
DECLARE
    session_id_val INTEGER;
BEGIN
    SELECT id INTO session_id_val
    FROM user_sessions
    WHERE user_id = p_user_id
      AND is_active = TRUE
      AND expires_at > NOW()
    ORDER BY created_at ASC
    LIMIT 1;
    
    RETURN session_id_val;
END;
$$ LANGUAGE plpgsql;

-- 5. Session'ı sonlandır (parametre adları 001 ile uyumlu)
CREATE OR REPLACE FUNCTION terminate_session(p_session_id INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE user_sessions
    SET is_active = FALSE
    WHERE id = p_session_id;
    
    -- İlgili refresh token'ı da iptal et
    UPDATE refresh_tokens
    SET revoked_at = NOW()
    WHERE token_hash = (
        SELECT refresh_token_hash 
        FROM user_sessions 
        WHERE id = p_session_id
    )
    AND revoked_at IS NULL;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- 6. Kullanıcının diğer tüm session'larını sonlandır (mevcut hariç, parametre adları 001 ile uyumlu)
CREATE OR REPLACE FUNCTION terminate_other_sessions(p_user_id INTEGER, p_current_token_hash VARCHAR)
RETURNS INTEGER AS $$
DECLARE
    terminated_count INTEGER;
BEGIN
    UPDATE user_sessions
    SET is_active = FALSE
    WHERE user_id = p_user_id
      AND refresh_token_hash != p_current_token_hash
      AND is_active = TRUE;
    
    GET DIAGNOSTICS terminated_count = ROW_COUNT;
    
    -- İlgili refresh token'ları da iptal et
    UPDATE refresh_tokens
    SET revoked_at = NOW()
    WHERE user_id = p_user_id
      AND token_hash != p_current_token_hash
      AND revoked_at IS NULL;
    
    RETURN terminated_count;
END;
$$ LANGUAGE plpgsql;

-- Yorumlar
COMMENT ON TABLE user_sessions IS 'Kullanıcı oturumlarını takip eder - eşzamanlı limit kontrolü için';
COMMENT ON COLUMN user_sessions.refresh_token_hash IS 'refresh_tokens tablosundaki token_hash ile eşleşir';
COMMENT ON COLUMN user_sessions.device_info IS 'Cihaz bilgileri (userAgent, device, os, browser)';
COMMENT ON COLUMN user_sessions.is_active IS 'Session aktif mi (false = sonlandırılmış)';
