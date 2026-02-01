-- Migration: 097_performans_indexleri.sql
-- Tarih: 2026-01-28
-- Açıklama: Performans optimizasyonu için eksik index'ler
-- NOT: Bu migration güvenli - tablo/sütun yoksa atlar

-- Helper function: Güvenli index oluşturma
CREATE OR REPLACE FUNCTION safe_create_index(
  p_index_name TEXT,
  p_table_name TEXT,
  p_columns TEXT,
  p_where_clause TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  v_sql TEXT;
  v_column TEXT;
  v_columns TEXT[];
  v_all_columns_exist BOOLEAN := TRUE;
BEGIN
  -- Tablo var mı kontrol et
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = p_table_name AND table_schema = 'public') THEN
    RAISE NOTICE 'Tablo % mevcut değil, atlanıyor', p_table_name;
    RETURN;
  END IF;

  -- Sütunları parse et ve kontrol et
  v_columns := string_to_array(regexp_replace(p_columns, '\s+', '', 'g'), ',');
  FOREACH v_column IN ARRAY v_columns
  LOOP
    -- DESC, ASC gibi modifierleri temizle
    v_column := regexp_replace(v_column, '\s*(DESC|ASC)$', '', 'i');
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = p_table_name AND column_name = v_column AND table_schema = 'public') THEN
      RAISE NOTICE 'Sütun %.% mevcut değil, index atlanıyor', p_table_name, v_column;
      v_all_columns_exist := FALSE;
    END IF;
  END LOOP;

  IF NOT v_all_columns_exist THEN
    RETURN;
  END IF;

  -- Index oluştur
  v_sql := format('CREATE INDEX IF NOT EXISTS %I ON %I (%s)', p_index_name, p_table_name, p_columns);
  IF p_where_clause IS NOT NULL THEN
    v_sql := v_sql || ' WHERE ' || p_where_clause;
  END IF;

  EXECUTE v_sql;
  RAISE NOTICE 'Index % oluşturuldu', p_index_name;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Index % oluşturulamadı: %', p_index_name, SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FATURA VE İLİŞKİLİ TABLOLAR
-- ============================================================

SELECT safe_create_index('idx_invoices_proje_status_created', 'invoices', 'proje_id, status, created_at DESC');
SELECT safe_create_index('idx_invoices_customer_due', 'invoices', 'customer_id, due_date');
SELECT safe_create_index('idx_invoices_invoice_date', 'invoices', 'invoice_date DESC');
SELECT safe_create_index('idx_invoices_dashboard', 'invoices', 'proje_id, invoice_date, status, total_amount');
SELECT safe_create_index('idx_invoices_ettn', 'invoices', 'ettn', 'ettn IS NOT NULL');
SELECT safe_create_index('idx_invoices_unpaid', 'invoices', 'due_date, total_amount', 'status != ''paid''');

SELECT safe_create_index('idx_uyumsoft_invoices_ettn', 'uyumsoft_invoices', 'ettn');
SELECT safe_create_index('idx_uyumsoft_invoices_created', 'uyumsoft_invoices', 'created_at DESC');
SELECT safe_create_index('idx_uyumsoft_invoices_direction_date', 'uyumsoft_invoices', 'direction, invoice_date DESC');

-- ============================================================
-- CARİ HESAPLAR
-- ============================================================

SELECT safe_create_index('idx_cari_hareketleri_cari_tarih', 'cari_hareketleri', 'cari_id, tarih DESC');
SELECT safe_create_index('idx_cari_hareketleri_bakiye', 'cari_hareketleri', 'cari_id, islem_tipi, tutar');
SELECT safe_create_index('idx_cariler_vergi_no', 'cariler', 'vergi_no', 'vergi_no IS NOT NULL');
SELECT safe_create_index('idx_cariler_tip_aktif', 'cariler', 'tip, aktif');

-- ============================================================
-- PERSONEL VE BORDRO
-- ============================================================

SELECT safe_create_index('idx_personeller_proje_aktif', 'personeller', 'proje_id, aktif');
SELECT safe_create_index('idx_bordro_proje_ay', 'bordro', 'proje_id, ay_yil');
SELECT safe_create_index('idx_bordro_personel_ay', 'bordro', 'personel_id, ay_yil DESC');

-- ============================================================
-- STOK VE ÜRÜNLER
-- ============================================================

SELECT safe_create_index('idx_stok_kartlari_kategori_aktif', 'stok_kartlari', 'kategori, aktif');
SELECT safe_create_index('idx_stok_kartlari_barkod', 'stok_kartlari', 'barkod', 'barkod IS NOT NULL');
SELECT safe_create_index('idx_urun_kartlari_kategori', 'urun_kartlari', 'kategori_id');
SELECT safe_create_index('idx_urun_varyantlari_ana_urun', 'urun_varyantlari', 'ana_urun_id');

-- ============================================================
-- FATURA KALEMLERİ
-- ============================================================

SELECT safe_create_index('idx_fatura_kalemleri_fatura', 'fatura_kalemleri', 'fatura_id');
SELECT safe_create_index('idx_fatura_kalemleri_urun', 'fatura_kalemleri', 'urun_id', 'urun_id IS NOT NULL');
SELECT safe_create_index('idx_fatura_kalemleri_tedarikci_tarih', 'fatura_kalemleri', 'tedarikci_vkn, fatura_tarihi DESC');

-- ============================================================
-- PROJELER VE FİRMALAR
-- ============================================================

SELECT safe_create_index('idx_projeler_firma', 'projeler', 'firma_id');
SELECT safe_create_index('idx_projeler_aktif', 'projeler', 'aktif', 'aktif = true');

-- ============================================================
-- BİLDİRİMLER VE LOGLAR
-- ============================================================

SELECT safe_create_index('idx_notifications_user_read', 'notifications', 'user_id, is_read, created_at DESC');
SELECT safe_create_index('idx_admin_notifications_created', 'admin_notifications', 'created_at DESC');
SELECT safe_create_index('idx_audit_logs_created', 'audit_logs', 'created_at DESC');

-- ============================================================
-- TEDARİKÇİ ÜRÜN EŞLEŞTİRME
-- ============================================================

SELECT safe_create_index('idx_tedarikci_urun_mapping_tedarikci', 'tedarikci_urun_mapping', 'tedarikci_vkn');
SELECT safe_create_index('idx_tedarikci_urun_mapping_urun', 'tedarikci_urun_mapping', 'urun_id');

-- ============================================================
-- KULLANICI VE OTURUM
-- ============================================================

SELECT safe_create_index('idx_user_sessions_user_active', 'user_sessions', 'user_id, is_active', 'is_active = true');
SELECT safe_create_index('idx_refresh_tokens_token', 'refresh_tokens', 'token');
SELECT safe_create_index('idx_document_queue_pending', 'document_queue', 'created_at', 'status = ''pending''');

-- ============================================================
-- ANALYZE (istatistikleri güncelle)
-- ============================================================

DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY['invoices', 'uyumsoft_invoices', 'cariler', 'personeller', 'bordro', 'stok_kartlari', 'fatura_kalemleri'];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = t AND table_schema = 'public') THEN
      EXECUTE format('ANALYZE %I', t);
      RAISE NOTICE 'ANALYZE % tamamlandı', t;
    END IF;
  END LOOP;
END $$;

-- Helper function'ı temizle (opsiyonel, bırakılabilir)
-- DROP FUNCTION IF EXISTS safe_create_index(TEXT, TEXT, TEXT, TEXT);

-- Migration tamamlandı
DO $$ BEGIN RAISE NOTICE 'Migration 097_performans_indexleri.sql tamamlandı'; END $$;
