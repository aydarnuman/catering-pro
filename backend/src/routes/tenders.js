import express from 'express';
import { query } from '../database.js';
import tenderScheduler from '../services/tender-scheduler.js';

const router = express.Router();

// İhale listesi (pagination + filtreleme)
router.get('/', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      city, 
      status = 'active',
      search 
    } = req.query;
    
    const offset = (page - 1) * limit;
    
    let whereClause = ['status = $1'];
    let params = [status];
    let paramIndex = 2;
    
    if (city) {
      whereClause.push(`city = $${paramIndex}`);
      params.push(city);
      paramIndex++;
    }
    
    if (search) {
      whereClause.push(`(title ILIKE $${paramIndex} OR organization_name ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }
    
    const whereString = whereClause.join(' AND ');
    
    // Toplam sayı
    const countResult = await query(
      `SELECT COUNT(*) FROM tenders WHERE ${whereString}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);
    
    // Veri - Frontend mapping için field'ları düzenleyelim
    const result = await query(
      `SELECT 
        id,
        external_id,
        title,
        publish_date,
        tender_date as deadline,
        city,
        location,
        organization_name as organization,
        estimated_cost,
        estimated_cost_raw,
        tender_type,
        url,
        status,
        document_links,
        announcement_content IS NOT NULL as has_announcement,
        goods_services_content IS NOT NULL as has_goods_services,
        created_at,
        updated_at,
        tender_method,
        tender_source,
        bid_type,
        category_id,
        category_name,
        raw_data
       FROM tenders 
       WHERE ${whereString}
       ORDER BY tender_date DESC NULLS LAST, created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    res.json({
      success: true,
      tenders: result.rows,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / limit)
    });
    
  } catch (error) {
    console.error('İhale listesi hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

// İstatistikler
router.get('/stats', async (req, res) => {
  try {
    const stats = await query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'active') as active,
        COUNT(*) FILTER (WHERE detail_scraped = true) as with_detail,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 day') as today,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as this_week
      FROM tenders
    `);
    
    const cities = await query(`
      SELECT city, COUNT(*) as count
      FROM tenders
      WHERE city IS NOT NULL AND status = 'active'
      GROUP BY city
      ORDER BY count DESC
      LIMIT 10
    `);
    
    res.json({
      success: true,
      data: {
        ...stats.rows[0],
        topCities: cities.rows
      }
    });
    
  } catch (error) {
    console.error('İstatistik hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

// Şehir listesi
router.get('/cities', async (req, res) => {
  try {
    const result = await query(`
      SELECT city, COUNT(*) as count
      FROM tenders
      WHERE city IS NOT NULL AND status = 'active'
      GROUP BY city
      ORDER BY city
    `);
    
    res.json({
      success: true,
      data: result.rows
    });
    
  } catch (error) {
    console.error('Şehir listesi hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

// Tekil ihale detayı
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await query(
      'SELECT * FROM tenders WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'İhale bulunamadı' });
    }
    
    // İhaleye ait dökümanları getir
    const documents = await query(
      'SELECT * FROM documents WHERE tender_id = $1 ORDER BY created_at DESC',
      [id]
    );
    
    res.json({
      success: true,
      data: {
        ...result.rows[0],
        documents: documents.rows
      }
    });
    
  } catch (error) {
    console.error('İhale detay hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

// İhale silme
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await query(
      'DELETE FROM tenders WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'İhale bulunamadı' });
    }
    
    res.json({
      success: true,
      message: 'İhale silindi'
    });
    
  } catch (error) {
    console.error('İhale silme hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

// Manuel scrape tetikle
router.post('/scrape', async (req, res) => {
  try {
    const { maxPages = 3 } = req.body;
    
    console.log(`📲 Manuel ihale scrape isteği: ${maxPages} sayfa`);
    
    const result = await tenderScheduler.triggerManualScrape({ maxPages });
    
    res.json({
      success: result.success,
      message: result.success ? 'Scrape tamamlandı' : 'Scrape başarısız',
      stats: result.stats,
      error: result.error
    });
  } catch (error) {
    console.error('❌ Manuel scrape hatası:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Scheduler durumu
router.get('/scheduler/status', (req, res) => {
  try {
    const status = tenderScheduler.getStatus();
    res.json({
      success: true,
      ...status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Scheduler'ı başlat
router.post('/scheduler/start', (req, res) => {
  try {
    tenderScheduler.start();
    res.json({
      success: true,
      message: 'İhale scheduler başlatıldı'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Scheduler'ı durdur
router.post('/scheduler/stop', (req, res) => {
  try {
    tenderScheduler.stop();
    res.json({
      success: true,
      message: 'İhale scheduler durduruldu'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Scrape logları
router.get('/scrape/logs', async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const logs = await tenderScheduler.getScrapeLogs(parseInt(limit));
    
    res.json({
      success: true,
      logs,
      total: logs.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Detaylı istatistikler
router.get('/stats/detailed', async (req, res) => {
  try {
    const stats = await tenderScheduler.getTenderStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
