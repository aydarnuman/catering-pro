-- Supabase Auth geçişi: public.users uyumu
-- auth_user_id: auth.users.id (UUID) eşlemesi için
-- password_hash: Supabase-only kullanıcılar için NULL kabul edilir

ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_user_id UUID;

ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

COMMENT ON COLUMN users.auth_user_id IS 'Supabase auth.users.id (UUID) - Supabase Auth ile eşleme';
