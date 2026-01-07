import express from 'express';
import { query } from '../database.js';

const router = express.Router();

// Veritabanı istatistikleri
router.get('/summary', async (req, res) => {
  try {
    // Fatura istatistikleri
    const invoiceStats = await query(`
      SELECT 
        (SELECT COUNT(*) FROM invoices) as manual_invoices,
        (SELECT COUNT(*) FROM uyumsoft_invoices) as uyumsoft_invoices,
        (SELECT SUM(total_amount) FROM invoices WHERE status = 'paid') as paid_amount,
        (SELECT SUM(payable_amount) FROM uyumsoft_invoices WHERE status != 'cancelled') as uyumsoft_amount
    `);

    // İhale istatistikleri
    const tenderStats = await query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'active') as active,
        COUNT(*) FILTER (WHERE status = 'closed') as closed,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as new_this_week
      FROM tenders
    `);

    // Döküman istatistikleri
    const documentStats = await query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE file_type = 'pdf') as pdf,
        COUNT(*) FILTER (WHERE file_type = 'excel') as excel,
        COUNT(*) FILTER (WHERE file_type = 'word') as word,
        SUM(file_size) as total_size
      FROM documents
    `);

    // Tablo boyutları
    const tableSizes = await query(`
      SELECT 
        schemaname,
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = tablename) as columns
      FROM pg_tables 
      WHERE schemaname = 'public' 
        AND tablename IN ('invoices', 'invoice_items', 'uyumsoft_invoices', 'tenders', 'documents', 'sync_logs')
      ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
    `);

    // Kayıt sayıları
    const recordCounts = await query(`
      SELECT 
        'invoices' as table_name, COUNT(*) as count, MAX(created_at) as last_update FROM invoices
      UNION ALL
      SELECT 
        'uyumsoft_invoices', COUNT(*), MAX(created_at) FROM uyumsoft_invoices  
      UNION ALL
      SELECT 
        'tenders', COUNT(*), MAX(created_at) FROM tenders
      UNION ALL
      SELECT 
        'documents', COUNT(*), MAX(created_at) FROM documents
      UNION ALL
      SELECT 
        'sync_logs', COUNT(*), MAX(created_at) FROM sync_logs
    `);

    // Veritabanı toplam boyutu
    const dbSize = await query(`
      SELECT pg_database_size(current_database()) as size,
             pg_size_pretty(pg_database_size(current_database())) as size_pretty
    `);

    res.json({
      success: true,
      data: {
        invoices: {
          manual: parseInt(invoiceStats.rows[0].manual_invoices || 0),
          uyumsoft: parseInt(invoiceStats.rows[0].uyumsoft_invoices || 0),
          total: parseInt(invoiceStats.rows[0].manual_invoices || 0) + parseInt(invoiceStats.rows[0].uyumsoft_invoices || 0),
          paidAmount: parseFloat(invoiceStats.rows[0].paid_amount || 0),
          uyumsoftAmount: parseFloat(invoiceStats.rows[0].uyumsoft_amount || 0)
        },
        tenders: {
          total: parseInt(tenderStats.rows[0].total || 0),
          active: parseInt(tenderStats.rows[0].active || 0),
          closed: parseInt(tenderStats.rows[0].closed || 0),
          newThisWeek: parseInt(tenderStats.rows[0].new_this_week || 0)
        },
        documents: {
          total: parseInt(documentStats.rows[0].total || 0),
          pdf: parseInt(documentStats.rows[0].pdf || 0),
          excel: parseInt(documentStats.rows[0].excel || 0),
          word: parseInt(documentStats.rows[0].word || 0),
          totalSize: parseInt(documentStats.rows[0].total_size || 0)
        },
        tables: recordCounts.rows.map(row => ({
          name: row.table_name,
          count: parseInt(row.count || 0),
          lastUpdate: row.last_update
        })),
        tableSizes: tableSizes.rows,
        database: {
          size: parseInt(dbSize.rows[0].size || 0),
          sizePretty: dbSize.rows[0].size_pretty || '0 MB'
        }
      }
    });
    
  } catch (error) {
    console.error('Database stats error:', error);
    res.status(500).json({ 
      error: error.message,
      success: false 
    });
  }
});

export default router;
