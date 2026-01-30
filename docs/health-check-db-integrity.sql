-- =============================================================================
-- CATERING PRO - Database Integrity Check (Supabase SQL Editor'de çalıştırın)
-- Production'da çalıştırmadan önce staging/test ortamında deneyin, backup alın.
-- =============================================================================

-- 1. Orphan Records Kontrolü (proje şemasına göre)
SELECT 'invoices_orphan' AS issue, COUNT(*) AS count
FROM invoices WHERE customer_id IS NOT NULL AND customer_id NOT IN (SELECT id FROM cariler)
UNION ALL
SELECT 'fatura_odemeleri_orphan', COUNT(*)
FROM fatura_odemeleri WHERE fatura_id NOT IN (SELECT id FROM invoices)
UNION ALL
SELECT 'stok_hareketleri_orphan', COUNT(*)
FROM stok_hareketleri WHERE stok_id NOT IN (SELECT id FROM stok_kartlari)
UNION ALL
SELECT 'invoice_items_orphan', COUNT(*)
FROM invoice_items WHERE invoice_id NOT IN (SELECT id FROM invoices);

-- 2. Data Type Kontrolü (FLOAT kullanımı olmamalı - NUMERIC tercih)
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND data_type IN ('real', 'double precision', 'float')
  AND table_name IN ('invoices', 'fatura_odemeleri', 'cariler', 'stok_kartlari', 'bordro');

-- 3. Null Constraint (önemli kolonlarda is_nullable = NO beklenir)
SELECT table_name, column_name, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name IN ('id', 'created_at', 'created_by')
  AND table_name IN ('invoices', 'cariler', 'stok_kartlari', 'invoice_items')
ORDER BY table_name, column_name;

-- 4. Foreign Key Özeti
SELECT tc.table_name, kcu.column_name, ccu.table_name AS foreign_table, rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
ORDER BY tc.table_name
LIMIT 30;

-- 5. Cari bakiye tutarlılık (cariler.bakiye = alacak - borc, GENERATED kolon ise otomatik)
-- Sadece borc/alacak manuel güncelleniyorsa kontrol için:
SELECT c.id, c.unvan, c.borc, c.alacak, c.bakiye,
       (c.alacak - c.borc) AS hesaplanan_bakiye,
       (c.bakiye - (c.alacak - c.borc)) AS fark
FROM cariler c
WHERE ABS(COALESCE(c.bakiye, 0) - (COALESCE(c.alacak, 0) - COALESCE(c.borc, 0))) > 0.01;

-- 6. Fatura toplam vs kalem toplamı (invoices.total_amount vs SUM(invoice_items))
SELECT i.id, i.invoice_no, i.total_amount AS kayitli_toplam,
       COALESCE(SUM(ii.quantity * ii.unit_price), 0) AS kalem_toplami,
       (i.total_amount - COALESCE(SUM(ii.quantity * ii.unit_price), 0)) AS fark
FROM invoices i
LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
GROUP BY i.id
HAVING ABS(i.total_amount - COALESCE(SUM(ii.quantity * ii.unit_price), 0)) > 0.01;
