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
    
    // Süresi dolan ihalelerin status'unu güncelle
    // Tüm süresi dolan ihaleleri expired yap (1 hafta içinde veya daha eski)
    // Bu işlem sadece aktif ihaleler için yapılır, performans için sadece gerekli durumlarda
    try {
      await query(`
        UPDATE tenders 
        SET status = 'expired', updated_at = NOW()
        WHERE status = 'active' 
          AND tender_date IS NOT NULL 
          AND tender_date < NOW()
      `);
    } catch (error) {
      // Status güncelleme hatası kritik değil, devam et
      console.warn('Status güncelleme hatası (kritik değil):', error.message);
    }
    
    const offset = (page - 1) * limit;
    
    // Status filtreleme: 'active' ise sadece aktif olanları, 'expired' ise süresi dolanları, 'all' ise hepsini göster
    let whereClause = [];
    let params = [];
    let paramIndex = 1;
    
    if (status === 'active') {
      // Varsayılan görünüm: Aktif ihaleler + Son 1 hafta içinde süresi dolanlar
      // tender_date NULL ise veya > NOW() ise VEYA son 1 hafta içinde süresi dolduysa göster
      whereClause.push(`(
        (tender_date IS NULL OR tender_date > NOW()) 
        OR (tender_date >= NOW() - INTERVAL '7 days' AND tender_date < NOW())
      )`);
    } else if (status === 'expired') {
      // Süresi dolan ihaleler (tümü): tender_date < NOW()
      whereClause.push(`(tender_date IS NOT NULL AND tender_date < NOW())`);
    } else if (status === 'urgent') {
      // Son 7 gün içinde süresi dolacak ihaleler
      whereClause.push(`(tender_date IS NOT NULL AND tender_date > NOW() AND tender_date <= NOW() + INTERVAL '7 days')`);
    } else if (status === 'archived') {
      // Arşiv: 1 haftadan fazla geçmiş ihaleler
      whereClause.push(`(tender_date IS NOT NULL AND tender_date < NOW() - INTERVAL '7 days')`);
    } else if (status === 'all') {
      // Tüm ihaleler - filtre yok
    } else {
      // Diğer status değerleri için normal filtreleme
      whereClause.push(`status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }
    
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
    
    const whereString = whereClause.length > 0 ? whereClause.join(' AND ') : '1=1';
    
    // Debug: Status filtreleme bilgisi
    if (status === 'expired') {
      console.log(`[TENDERS] Expired filter - WHERE: ${whereString}, Params:`, params);
    }
    
    // Toplam sayı
    const countResult = await query(
      `SELECT COUNT(*) FROM tenders WHERE ${whereString}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);
    
    // Debug: Toplam sayı
    if (status === 'expired') {
      console.log(`[TENDERS] Expired filter - Total count: ${total}`);
    }
    
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
        (zeyilname_content IS NOT NULL OR document_links::text ILIKE '%zeyilname%') as has_zeyilname,
        correction_notice_content IS NOT NULL as has_correction_notice,
        (is_updated = true OR document_links::text ILIKE '%zeyilname%' OR zeyilname_content IS NOT NULL OR correction_notice_content IS NOT NULL) as is_updated,
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
       ORDER BY 
         CASE 
           WHEN tender_date IS NULL THEN 2                              -- Tarihi belirsiz olanlar sonda
           WHEN tender_date::date >= CURRENT_DATE THEN 0                -- Bugün veya gelecek → Önce
           ELSE 1                                                       -- Geçmiş tarihli → En sonda
         END,
         CASE 
           WHEN tender_date::date >= CURRENT_DATE THEN tender_date      -- Aktifler: en yakın tarih önce (bugün, yarın, 2 gün...)
         END ASC NULLS LAST,
         CASE 
           WHEN tender_date::date < CURRENT_DATE THEN tender_date       -- Süresi dolanlar: en yeni dolan önce
         END DESC NULLS LAST,
         created_at DESC
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

// İhale güncelleme
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { tender_date, status, city, organization_name, title, estimated_cost } = req.body;
    
    // Güncelleme alanlarını dinamik oluştur
    const updates = [];
    const params = [];
    let paramIndex = 1;
    
    if (tender_date !== undefined) {
      updates.push(`tender_date = $${paramIndex++}`);
      params.push(tender_date);
    }
    if (status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      params.push(status);
    }
    if (city !== undefined) {
      updates.push(`city = $${paramIndex++}`);
      params.push(city);
    }
    if (organization_name !== undefined) {
      updates.push(`organization_name = $${paramIndex++}`);
      params.push(organization_name);
    }
    if (title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      params.push(title);
    }
    if (estimated_cost !== undefined) {
      updates.push(`estimated_cost = $${paramIndex++}`);
      params.push(estimated_cost);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'Güncellenecek alan belirtilmedi' });
    }
    
    updates.push(`updated_at = NOW()`);
    params.push(id);
    
    const result = await query(
      `UPDATE tenders SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'İhale bulunamadı' });
    }
    
    res.json({
      success: true,
      data: result.rows[0],
      message: 'İhale güncellendi'
    });
    
  } catch (error) {
    console.error('İhale güncelleme hatası:', error);
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

// Son güncelleme istatistikleri
router.get('/stats/updates', async (req, res) => {
  try {
    // Bugünün başlangıcı (Europe/Istanbul)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    // Son scraper çalışması
    const lastUpdateResult = await query(`
      SELECT MAX(updated_at) as last_update 
      FROM tenders
    `);
    
    // Bugün yeni eklenen ihaleler
    const newTodayResult = await query(`
      SELECT id, external_id, title, city, organization_name, created_at
      FROM tenders 
      WHERE created_at >= $1 
      ORDER BY created_at DESC 
      LIMIT 10
    `, [todayStart.toISOString()]);
    
    // Bugün güncellenen ihaleler (daha önce eklenenler)
    const updatedTodayResult = await query(`
      SELECT id, external_id, title, city, organization_name, updated_at
      FROM tenders 
      WHERE updated_at >= $1 AND created_at < $1
      ORDER BY updated_at DESC 
      LIMIT 10
    `, [todayStart.toISOString()]);
    
    // Bugünkü toplam sayılar
    const countsResult = await query(`
      SELECT 
        COUNT(*) FILTER (WHERE created_at >= $1) as new_count,
        COUNT(*) FILTER (WHERE updated_at >= $1 AND created_at < $1) as updated_count,
        COUNT(*) as total_count
      FROM tenders
    `, [todayStart.toISOString()]);
    
    // Son 7 gün istatistikleri
    const weeklyResult = await query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) FILTER (WHERE created_at >= DATE(created_at) AND created_at < DATE(created_at) + INTERVAL '1 day') as new_count
      FROM tenders
      WHERE created_at >= NOW() - INTERVAL '7 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);
    
    res.json({
      success: true,
      data: {
        lastUpdate: lastUpdateResult.rows[0]?.last_update,
        today: {
          newCount: parseInt(countsResult.rows[0]?.new_count || 0),
          updatedCount: parseInt(countsResult.rows[0]?.updated_count || 0),
          newTenders: newTodayResult.rows,
          updatedTenders: updatedTodayResult.rows
        },
        totalCount: parseInt(countsResult.rows[0]?.total_count || 0),
        weeklyStats: weeklyResult.rows
      }
    });
    
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
