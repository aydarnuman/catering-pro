-- =============================================
-- USER SESSIONS TABLOSU VE FONKSİYONLARI
-- Çalıştırma: Supabase Dashboard > SQL Editor
-- =============================================

-- 1. USER_SESSIONS TABLOSU
CREATE TABLE IF NOT EXISTS user_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token_hash VARCHAR(255) NOT NULL,
    device_info JSONB DEFAULT '{}',
    ip_address VARCHAR(45),
    user_agent TEXT,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    
    CONSTRAINT unique_refresh_token UNIQUE(refresh_token_hash)
);

-- 2. İNDEXLER
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token_hash ON user_sessions(refresh_token_hash);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(user_id, is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);

-- 3. AKTİF SESSION SAYISI FONKSİYONU
CREATE OR REPLACE FUNCTION get_active_session_count(p_user_id INTEGER)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM user_sessions
    WHERE user_id = p_user_id
      AND is_active = TRUE
      AND expires_at > NOW();
    
    RETURN COALESCE(v_count, 0);
END;
$$ LANGUAGE plpgsql;

-- 4. EN ESKİ AKTİF SESSION FONKSİYONU
CREATE OR REPLACE FUNCTION get_oldest_active_session(p_user_id INTEGER)
RETURNS INTEGER AS $$
DECLARE
    v_session_id INTEGER;
BEGIN
    SELECT id INTO v_session_id
    FROM user_sessions
    WHERE user_id = p_user_id
      AND is_active = TRUE
      AND expires_at > NOW()
    ORDER BY created_at ASC
    LIMIT 1;
    
    RETURN v_session_id;
END;
$$ LANGUAGE plpgsql;

-- 5. SESSION SONLANDIRMA FONKSİYONU
CREATE OR REPLACE FUNCTION terminate_session(p_session_id INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    v_affected INTEGER;
BEGIN
    UPDATE user_sessions
    SET is_active = FALSE,
        expires_at = NOW()
    WHERE id = p_session_id;
    
    GET DIAGNOSTICS v_affected = ROW_COUNT;
    
    -- İlgili refresh token'ı da iptal et
    UPDATE refresh_tokens
    SET revoked_at = NOW()
    WHERE token_hash = (
        SELECT refresh_token_hash 
        FROM user_sessions 
        WHERE id = p_session_id
    ) AND revoked_at IS NULL;
    
    RETURN v_affected > 0;
END;
$$ LANGUAGE plpgsql;

-- 6. DİĞER SESSION'LARI SONLANDIRMA FONKSİYONU
CREATE OR REPLACE FUNCTION terminate_other_sessions(p_user_id INTEGER, p_current_token_hash VARCHAR)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    -- Diğer aktif session'ları sonlandır
    WITH terminated AS (
        UPDATE user_sessions
        SET is_active = FALSE,
            expires_at = NOW()
        WHERE user_id = p_user_id
          AND refresh_token_hash != p_current_token_hash
          AND is_active = TRUE
        RETURNING refresh_token_hash
    )
    -- İlgili refresh token'ları da iptal et
    UPDATE refresh_tokens
    SET revoked_at = NOW()
    WHERE token_hash IN (SELECT refresh_token_hash FROM terminated)
      AND revoked_at IS NULL;
    
    SELECT COUNT(*) INTO v_count
    FROM user_sessions
    WHERE user_id = p_user_id
      AND refresh_token_hash != p_current_token_hash
      AND is_active = FALSE
      AND expires_at <= NOW();
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- 7. REFRESH_TOKENS TABLOSU (eğer yoksa)
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    device_info JSONB DEFAULT '{}',
    ip_address VARCHAR(45),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at);

-- 8. SÜRESİ DOLMUŞ SESSION'LARI TEMİZLE (opsiyonel scheduled job)
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    DELETE FROM user_sessions
    WHERE expires_at < NOW() - INTERVAL '7 days';
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    -- Refresh token'ları da temizle
    DELETE FROM refresh_tokens
    WHERE expires_at < NOW() - INTERVAL '7 days'
       OR revoked_at < NOW() - INTERVAL '7 days';
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- DOĞRULAMA
-- =============================================
DO $$
BEGIN
    RAISE NOTICE 'user_sessions tablosu ve fonksiyonlar başarıyla oluşturuldu!';
END $$;
