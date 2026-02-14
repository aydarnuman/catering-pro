-- Performance indexes v2: slow queries (notifications unread, users lookup, invoices stats)
-- Direct CREATE INDEX (idempotent; safe_create_index may not exist on all envs)

CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON notifications (user_id, created_at DESC)
  WHERE is_read = false;

CREATE INDEX IF NOT EXISTS idx_users_active_lookup
  ON users (id)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_invoices_status_date
  ON invoices (status, created_at DESC);

ANALYZE notifications;
ANALYZE users;
ANALYZE invoices;
