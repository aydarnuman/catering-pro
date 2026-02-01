-- =====================================================
-- Admin Notifications System
-- Admin'e kritik olaylar için bildirim sistemi
-- =====================================================

-- 1. Admin notifications tablosu
CREATE TABLE IF NOT EXISTS admin_notifications (
    id SERIAL PRIMARY KEY,
    type VARCHAR(50) NOT NULL, -- 'account_locked', 'suspicious_activity', 'system_error', 'high_priority'
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    severity VARCHAR(20) DEFAULT 'info', -- 'info', 'warning', 'error', 'critical'
    read BOOLEAN DEFAULT FALSE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, -- İlgili kullanıcı (varsa)
    metadata JSONB DEFAULT '{}', -- Ek bilgiler (IP, user agent, vs.)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    read_at TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_admin_notifications_read ON admin_notifications(read);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_type ON admin_notifications(type);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_severity ON admin_notifications(severity);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_created_at ON admin_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_user ON admin_notifications(user_id);

-- 2. Eski bildirimleri temizleme fonksiyonu (30 günden eski okunmuş bildirimler)
CREATE OR REPLACE FUNCTION cleanup_old_admin_notifications()
RETURNS void AS $$
BEGIN
    DELETE FROM admin_notifications
    WHERE read = TRUE 
      AND created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- 3. Okunmamış bildirim sayısını getiren fonksiyon
CREATE OR REPLACE FUNCTION get_unread_admin_notification_count()
RETURNS INTEGER AS $$
DECLARE
    count_val INTEGER;
BEGIN
    SELECT COUNT(*) INTO count_val
    FROM admin_notifications
    WHERE read = FALSE;
    
    RETURN count_val;
END;
$$ LANGUAGE plpgsql;

-- Yorumlar
COMMENT ON TABLE admin_notifications IS 'Admin kullanıcılarına gönderilen bildirimler';
COMMENT ON COLUMN admin_notifications.type IS 'Bildirim türü: account_locked, suspicious_activity, system_error, high_priority';
COMMENT ON COLUMN admin_notifications.severity IS 'Önem seviyesi: info, warning, error, critical';
COMMENT ON COLUMN admin_notifications.metadata IS 'Ek bilgiler (IP, user agent, detaylar)';
