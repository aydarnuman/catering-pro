-- Migration: 112_performance_indexes_v2.sql
-- Açıklama: Yavaş sorgular için performans index'leri (notifications COUNT unread, users lookup, invoices stats)
-- NOT: safe_create_index helper'ı 097'de tanımlı, bu migration sadece index çağrıları + ANALYZE

-- notifications: COUNT WHERE is_read = FALSE (1-5sn → hızlandırma)
SELECT safe_create_index('idx_notifications_unread', 'notifications', 'user_id, created_at DESC', 'is_read = false');

-- users: SELECT WHERE id + is_active (1-2.3sn → hızlandırma)
SELECT safe_create_index('idx_users_active_lookup', 'users', 'id', 'is_active = true');

-- invoices: stats by status + date (2-5sn / timeout → hızlandırma)
SELECT safe_create_index('idx_invoices_status_date', 'invoices', 'status, created_at DESC');

-- İstatistik güncellemesi (planner için)
ANALYZE notifications;
ANALYZE users;
ANALYZE invoices;
