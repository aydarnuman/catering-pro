-- =====================================================
-- Account Lockout System
-- Başarısız login denemelerini takip ve hesap kilitleme
-- =====================================================

-- 1. Login attempts tablosu
CREATE TABLE IF NOT EXISTS login_attempts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    success BOOLEAN NOT NULL DEFAULT FALSE,
    attempted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_login_attempts_user ON login_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts(email);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_login_attempts_attempted_at ON login_attempts(attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_attempts_success ON login_attempts(success);

-- 2. Users tablosuna kilitleme alanları ekle
ALTER TABLE users 
    ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS lockout_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_failed_login TIMESTAMP WITH TIME ZONE;

-- 3. Eski login attempt'leri temizleme fonksiyonu (30 günden eski)
CREATE OR REPLACE FUNCTION cleanup_old_login_attempts()
RETURNS void AS $$
BEGIN
    DELETE FROM login_attempts
    WHERE attempted_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- 4. Kilit süresi hesaplama fonksiyonu
-- İlk kilit: 15 dakika
-- İkinci kilit: 30 dakika
-- Üçüncü ve sonrası: 1 saat
CREATE OR REPLACE FUNCTION calculate_lockout_duration(lockout_count INTEGER)
RETURNS INTERVAL AS $$
BEGIN
    CASE lockout_count
        WHEN 0 THEN RETURN INTERVAL '15 minutes';
        WHEN 1 THEN RETURN INTERVAL '30 minutes';
        ELSE RETURN INTERVAL '1 hour';
    END CASE;
END;
$$ LANGUAGE plpgsql;

-- 5. Kullanıcı kilitli mi kontrol fonksiyonu
CREATE OR REPLACE FUNCTION is_user_locked(user_id_param INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    locked_until_val TIMESTAMP WITH TIME ZONE;
BEGIN
    SELECT locked_until INTO locked_until_val
    FROM users
    WHERE id = user_id_param;
    
    IF locked_until_val IS NULL THEN
        RETURN FALSE;
    END IF;
    
    IF locked_until_val > NOW() THEN
        RETURN TRUE;
    ELSE
        -- Kilit süresi dolmuş, sıfırla
        UPDATE users
        SET locked_until = NULL,
            failed_login_attempts = 0
        WHERE id = user_id_param;
        
        RETURN FALSE;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 6. Başarısız login kaydetme fonksiyonu
CREATE OR REPLACE FUNCTION record_failed_login(
    user_email VARCHAR(255),
    attempt_ip INET,
    attempt_user_agent TEXT
)
RETURNS TABLE(
    is_locked BOOLEAN,
    locked_until TIMESTAMP WITH TIME ZONE,
    remaining_attempts INTEGER
) AS $$
DECLARE
    user_id_val INTEGER;
    current_attempts INTEGER;
    current_lockout_count INTEGER;
    lock_duration INTERVAL;
    new_locked_until TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Kullanıcıyı bul
    SELECT id, failed_login_attempts, lockout_count
    INTO user_id_val, current_attempts, current_lockout_count
    FROM users
    WHERE email = user_email AND is_active = TRUE;
    
    -- Kullanıcı bulunamadıysa boş döndür
    IF user_id_val IS NULL THEN
        RETURN;
    END IF;
    
    -- Başarısız denemeyi kaydet
    INSERT INTO login_attempts (user_id, email, ip_address, user_agent, success)
    VALUES (user_id_val, user_email, attempt_ip, attempt_user_agent, FALSE);
    
    -- Deneme sayısını artır
    current_attempts := current_attempts + 1;
    
    -- 5 başarısız deneme sonrası kilitle
    IF current_attempts >= 5 THEN
        -- Kilit süresini hesapla
        lock_duration := calculate_lockout_duration(current_lockout_count);
        new_locked_until := NOW() + lock_duration;
        
        -- Kullanıcıyı kilitle
        UPDATE users
        SET failed_login_attempts = current_attempts,
            locked_until = new_locked_until,
            lockout_count = current_lockout_count + 1,
            last_failed_login = NOW()
        WHERE id = user_id_val;
        
        RETURN QUERY SELECT TRUE, new_locked_until, 0;
    ELSE
        -- Sadece deneme sayısını güncelle
        UPDATE users
        SET failed_login_attempts = current_attempts,
            last_failed_login = NOW()
        WHERE id = user_id_val;
        
        RETURN QUERY SELECT FALSE, NULL::TIMESTAMP WITH TIME ZONE, (5 - current_attempts);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 7. Başarılı login'de sıfırlama fonksiyonu
CREATE OR REPLACE FUNCTION reset_login_attempts(user_id_param INTEGER)
RETURNS void AS $$
BEGIN
    UPDATE users
    SET failed_login_attempts = 0,
        locked_until = NULL
    WHERE id = user_id_param;
    
    -- Başarılı login'i kaydet
    INSERT INTO login_attempts (user_id, email, ip_address, success)
    SELECT id, email, NULL, TRUE
    FROM users
    WHERE id = user_id_param;
END;
$$ LANGUAGE plpgsql;

-- Yorumlar
COMMENT ON TABLE login_attempts IS 'Tüm login denemelerini kaydeder - başarılı ve başarısız';
COMMENT ON COLUMN users.failed_login_attempts IS 'Ardışık başarısız login denemeleri sayısı';
COMMENT ON COLUMN users.locked_until IS 'Hesap kilitli ise kilit bitiş zamanı';
COMMENT ON COLUMN users.lockout_count IS 'Toplam kaç kez kilitlendi';
COMMENT ON COLUMN users.last_failed_login IS 'Son başarısız login zamanı';
