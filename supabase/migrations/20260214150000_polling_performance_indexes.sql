-- Migration: 20260214150000_polling_performance_indexes.sql
-- Tarih: 2026-02-14
-- Açıklama: Admin dashboard ve polling sorgularının performansı için ek index'ler
--
-- Sorun: notifications COUNT, users SELECT, cariler COUNT, invoices stats
-- sorguları 1-5sn sürüyor. Bu partial index'ler yoğun polling sorgularını hızlandırır.

-- ============================================================
-- 1. Okunmamış bildirimler partial index
-- ============================================================
-- Kullanım: SELECT COUNT(*) FROM notifications WHERE is_read = FALSE
-- Mevcut idx_notifications_user_read (user_id, is_read, created_at) composite index
-- bu sorgu için uygun değil — partial index çok daha verimli.
CREATE INDEX IF NOT EXISTS idx_notifications_is_read
  ON notifications(is_read) WHERE is_read = FALSE;

-- ============================================================
-- 2. Aktif kullanıcılar partial index
-- ============================================================
-- Kullanım: SELECT * FROM users WHERE is_active = true
-- admin-stats dashboard'unda kullanıcı sayısı sorgulanıyor.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'is_active' AND table_schema = 'public'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_users_active ON users(id) WHERE is_active = true;
    RAISE NOTICE 'idx_users_active oluşturuldu';
  ELSE
    RAISE NOTICE 'users.is_active sütunu mevcut değil, atlanıyor';
  END IF;
END $$;

-- ============================================================
-- 3. Fatura status index
-- ============================================================
-- Kullanım: SELECT COUNT(*) FROM invoices GROUP BY status (admin stats)
-- Mevcut composite index'ler (proje_id, status, ...) tek başına status
-- filtrelemesinde verimli değil.
CREATE INDEX IF NOT EXISTS idx_invoices_status
  ON invoices(status);

-- ============================================================
-- ANALYZE — Planner'ın yeni index'leri görmesi için
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications' AND table_schema = 'public') THEN
    EXECUTE 'ANALYZE notifications';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users' AND table_schema = 'public') THEN
    EXECUTE 'ANALYZE users';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invoices' AND table_schema = 'public') THEN
    EXECUTE 'ANALYZE invoices';
  END IF;
END $$;

-- Migration tamamlandı
DO $$ BEGIN RAISE NOTICE 'Migration 20260214150000_polling_performance_indexes.sql tamamlandı'; END $$;
