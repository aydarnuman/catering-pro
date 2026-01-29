-- =====================================================
-- Unified Notifications System Migration
-- Tüm bildirimleri tek tabloda birleştirir
-- =====================================================

-- 1. notifications tablosuna yeni kolonlar ekle
ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS severity VARCHAR(20) DEFAULT 'info',
ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'user',
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- severity: info, warning, error, critical
-- source: user (normal bildirim), admin (admin bildirimi), system (sistem bildirimi)

-- 2. Yeni indexler
CREATE INDEX IF NOT EXISTS idx_notifications_source ON notifications(source);
CREATE INDEX IF NOT EXISTS idx_notifications_severity ON notifications(severity);
CREATE INDEX IF NOT EXISTS idx_notifications_category ON notifications(category);

-- 3. admin_notifications verilerini notifications tablosuna taşı
INSERT INTO notifications (user_id, title, message, type, category, is_read, created_at, read_at, severity, source, metadata)
SELECT
    user_id,
    title,
    message,
    CASE
        WHEN severity = 'critical' THEN 'error'
        WHEN severity = 'error' THEN 'error'
        WHEN severity = 'warning' THEN 'warning'
        ELSE 'info'
    END as type,
    type as category, -- admin notification type -> category (account_locked, suspicious_activity, etc.)
    read as is_read,
    created_at,
    read_at,
    severity,
    'admin' as source,
    metadata
FROM admin_notifications
WHERE NOT EXISTS (
    SELECT 1 FROM notifications n
    WHERE n.source = 'admin'
    AND n.created_at = admin_notifications.created_at
    AND n.title = admin_notifications.title
);

-- 4. Composite index for efficient queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_source_read
ON notifications(user_id, source, is_read);

-- 5. Okunmamış bildirim sayısı fonksiyonu (tüm kaynaklar için)
CREATE OR REPLACE FUNCTION get_unified_unread_notification_count(p_user_id INTEGER DEFAULT NULL, p_is_admin BOOLEAN DEFAULT FALSE)
RETURNS INTEGER AS $$
DECLARE
    count_val INTEGER;
BEGIN
    IF p_is_admin THEN
        -- Admin tüm bildirimleri görebilir
        SELECT COUNT(*) INTO count_val
        FROM notifications
        WHERE is_read = FALSE
        AND (p_user_id IS NULL OR user_id = p_user_id OR user_id IS NULL);
    ELSE
        -- Normal kullanıcı sadece kendi bildirimlerini görür
        SELECT COUNT(*) INTO count_val
        FROM notifications
        WHERE is_read = FALSE
        AND user_id = p_user_id
        AND source = 'user';
    END IF;

    RETURN COALESCE(count_val, 0);
END;
$$ LANGUAGE plpgsql;

-- 6. Eski bildirimleri temizleme fonksiyonu (30 günden eski okunmuş bildirimler)
CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM notifications
    WHERE is_read = TRUE
      AND created_at < NOW() - INTERVAL '30 days';

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 7. Yorumlar güncelle
COMMENT ON TABLE notifications IS 'Birleşik bildirim sistemi - tüm kullanıcı ve admin bildirimleri';
COMMENT ON COLUMN notifications.severity IS 'Önem seviyesi: info, warning, error, critical';
COMMENT ON COLUMN notifications.source IS 'Bildirim kaynağı: user, admin, system';
COMMENT ON COLUMN notifications.metadata IS 'Ek bilgiler (IP, user agent, detaylar)';

-- 8. RLS politikaları (Supabase için)
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Kullanıcılar kendi bildirimlerini görebilir
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications" ON notifications
    FOR SELECT
    USING (
        auth.uid()::text = user_id::text
        OR source = 'system'
        OR (source = 'admin' AND EXISTS (
            SELECT 1 FROM users WHERE id::text = auth.uid()::text AND user_type IN ('admin', 'super_admin')
        ))
    );

-- Kullanıcılar kendi bildirimlerini okundu işaretleyebilir
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications" ON notifications
    FOR UPDATE
    USING (
        auth.uid()::text = user_id::text
        OR (source = 'admin' AND EXISTS (
            SELECT 1 FROM users WHERE id::text = auth.uid()::text AND user_type IN ('admin', 'super_admin')
        ))
    );

-- Sistem bildirimleri oluşturabilir (service role)
DROP POLICY IF EXISTS "Service can insert notifications" ON notifications;
CREATE POLICY "Service can insert notifications" ON notifications
    FOR INSERT
    WITH CHECK (true);

-- 9. NOT: admin_notifications tablosu şimdilik korunuyor
-- Veriler taşındıktan ve sistem stabil olduktan sonra silinebilir
-- DROP TABLE IF EXISTS admin_notifications;
