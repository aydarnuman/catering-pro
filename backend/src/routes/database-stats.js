import express from 'express';
import { query } from '../database.js';

const router = express.Router();

// Güvenli sorgu - hata durumunda varsayılan değer döner
const safeQuery = async (sql, defaultValue = null) => {
  try {
    const result = await query(sql);
    return result.rows;
  } catch (_e) {
    return defaultValue;
  }
};

// Veritabanı özet istatistikleri
router.get('/summary', async (_req, res) => {
  try {
    // Fatura istatistikleri
    const invoiceStats = await safeQuery(
      `
      SELECT 
        (SELECT COUNT(*) FROM invoices) as manual_invoices,
        (SELECT COUNT(*) FROM uyumsoft_invoices) as uyumsoft_invoices
    `,
      [{ manual_invoices: 0, uyumsoft_invoices: 0 }]
    );

    // İhale istatistikleri
    const tenderStats = await safeQuery(
      `
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'active') as active
      FROM tenders
    `,
      [{ total: 0, active: 0 }]
    );

    // Veritabanı toplam boyutu
    const dbSize = await safeQuery(
      `
      SELECT pg_database_size(current_database()) as size,
             pg_size_pretty(pg_database_size(current_database())) as size_pretty
    `,
      [{ size: 0, size_pretty: '0 MB' }]
    );

    res.json({
      success: true,
      data: {
        invoices: {
          manual: parseInt(invoiceStats[0]?.manual_invoices || 0, 10),
          uyumsoft: parseInt(invoiceStats[0]?.uyumsoft_invoices || 0, 10),
        },
        tenders: {
          total: parseInt(tenderStats[0]?.total || 0, 10),
          active: parseInt(tenderStats[0]?.active || 0, 10),
        },
        database: {
          size: parseInt(dbSize[0]?.size || 0, 10),
          sizePretty: dbSize[0]?.size_pretty || '0 MB',
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin Dashboard için detaylı istatistikler
router.get('/admin-stats', async (_req, res) => {
  const startTime = Date.now();

  try {
    // Tablo sayılarını tek tek al (hata vereni atla)
    const tablolar = [];

    const tableQueries = [
      { ad: 'cariler', sql: 'SELECT COUNT(*) as c FROM cariler' },
      { ad: 'personel', sql: 'SELECT COUNT(*) as c FROM personel' },
      { ad: 'invoices', sql: 'SELECT COUNT(*) as c FROM invoices' },
      { ad: 'tenders', sql: 'SELECT COUNT(*) as c FROM tenders' },
      { ad: 'stok_kartlari', sql: 'SELECT COUNT(*) as c FROM stok_kartlari' },
      { ad: 'kasa_banka', sql: 'SELECT COUNT(*) as c FROM kasa_banka' },
      { ad: 'demirbas', sql: 'SELECT COUNT(*) as c FROM demirbas' },
      { ad: 'users', sql: 'SELECT COUNT(*) as c FROM users' },
    ];

    for (const t of tableQueries) {
      const result = await safeQuery(t.sql, [{ c: 0 }]);
      if (result) {
        tablolar.push({ ad: t.ad, kayit: parseInt(result[0]?.c || 0, 10) });
      }
    }

    // Tablolar'ı kayıt sayısına göre sırala
    tablolar.sort((a, b) => b.kayit - a.kayit);

    // Veritabanı boyutu
    const dbSizeRows = await safeQuery(
      `
      SELECT 
        pg_database_size(current_database()) as bytes,
        pg_size_pretty(pg_database_size(current_database())) as formatted
    `,
      [{ bytes: 0, formatted: '0 MB' }]
    );

    // Aktif bağlantılar
    const connectionsRows = await safeQuery(
      `
      SELECT 
        count(*) as total,
        count(*) FILTER (WHERE state = 'active') as active,
        count(*) FILTER (WHERE state = 'idle') as idle
      FROM pg_stat_activity 
      WHERE datname = current_database()
    `,
      [{ total: 0, active: 0, idle: 0 }]
    );

    // Bugünkü aktiviteler
    const todayFatura = await safeQuery(`SELECT COUNT(*) as c FROM invoices WHERE DATE(created_at) = CURRENT_DATE`, [
      { c: 0 },
    ]);
    const todayIhale = await safeQuery(`SELECT COUNT(*) as c FROM tenders WHERE DATE(created_at) = CURRENT_DATE`, [
      { c: 0 },
    ]);
    const todayCari = await safeQuery(`SELECT COUNT(*) as c FROM cariler WHERE DATE(created_at) = CURRENT_DATE`, [
      { c: 0 },
    ]);
    const todayPersonel = await safeQuery(`SELECT COUNT(*) as c FROM personel WHERE DATE(created_at) = CURRENT_DATE`, [
      { c: 0 },
    ]);

    // Son aktiviteler
    const recentActivities = await safeQuery(
      `
      SELECT 
        'sync' as tip,
        sync_type as baslik,
        status,
        created_at as tarih,
        COALESCE(invoices_synced, 0) as detay
      FROM sync_logs 
      ORDER BY created_at DESC 
      LIMIT 5
    `,
      []
    );

    const responseTime = Date.now() - startTime;

    res.json({
      success: true,
      data: {
        tablolar,
        veritabani: {
          boyut: dbSizeRows[0]?.formatted || '0 MB',
          bytes: parseInt(dbSizeRows[0]?.bytes || 0, 10),
        },
        baglanti: {
          toplam: parseInt(connectionsRows[0]?.total || 0, 10),
          aktif: parseInt(connectionsRows[0]?.active || 0, 10),
          bekleyen: parseInt(connectionsRows[0]?.idle || 0, 10),
        },
        bugun: {
          fatura: parseInt(todayFatura[0]?.c || 0, 10),
          ihale: parseInt(todayIhale[0]?.c || 0, 10),
          cari: parseInt(todayCari[0]?.c || 0, 10),
          personel: parseInt(todayPersonel[0]?.c || 0, 10),
        },
        sonAktiviteler: recentActivities || [],
        performans: {
          responseTime,
          timestamp: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Sistem health check detaylı
router.get('/health-detailed', async (_req, res) => {
  const startTime = Date.now();

  try {
    // DB ping
    const dbStart = Date.now();
    const dbResult = await query('SELECT NOW() as time, version() as version');
    const dbResponseTime = Date.now() - dbStart;

    // Uptime
    let uptime = { days: 0, hours: 0, minutes: 0, formatted: '-', startTime: null };
    try {
      const uptimeResult = await query(`SELECT pg_postmaster_start_time() as start_time`);
      const serverStart = new Date(uptimeResult.rows[0].start_time);
      const uptimeMs = Date.now() - serverStart.getTime();

      const days = Math.floor(uptimeMs / (1000 * 60 * 60 * 24));
      const hours = Math.floor((uptimeMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((uptimeMs % (1000 * 60 * 60)) / (1000 * 60));

      uptime = {
        days,
        hours,
        minutes,
        formatted: `${days}g ${hours}s ${minutes}dk`,
        startTime: serverStart.toISOString(),
      };
    } catch (_e) {
      // Uptime alınamazsa varsayılan kullan
    }

    res.json({
      success: true,
      data: {
        status: 'healthy',
        database: {
          connected: true,
          responseTime: dbResponseTime,
          version: dbResult.rows[0].version.split(' ').slice(0, 2).join(' '),
          serverTime: dbResult.rows[0].time,
        },
        uptime,
        api: {
          responseTime: Date.now() - startTime,
          version: '1.0.0',
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      data: {
        status: 'unhealthy',
        database: { connected: false, error: error.message },
        uptime: { formatted: '-' },
        api: { responseTime: Date.now() - startTime },
      },
    });
  }
});

export default router;
