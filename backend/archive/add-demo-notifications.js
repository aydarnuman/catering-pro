import { query, pool } from './src/database.js';

async function addDemoNotifications() {
  try {
    // Demo bildirimler ekle
    const notifications = [
      {
        user_id: 1,
        title: 'Yeni İhale Yayınlandı',
        message: 'Ankara bölgesinde yeni yemek ihalesi yayınlandı',
        type: 'info',
        category: 'tender',
        link: '/tenders'
      },
      {
        user_id: 1,
        title: 'Vade Uyarısı',
        message: '3 faturanın vadesi bugün doluyor',
        type: 'warning',
        category: 'invoice',
        link: '/muhasebe/faturalar'
      },
      {
        user_id: 1,
        title: 'Stok Uyarısı',
        message: '5 üründe kritik stok seviyesi',
        type: 'warning',
        category: 'stock',
        link: '/muhasebe/stok'
      }
    ];

    for (const n of notifications) {
      await query(
        `INSERT INTO notifications (user_id, title, message, type, category, link) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [n.user_id, n.title, n.message, n.type, n.category, n.link]
      );
    }

    const result = await query('SELECT COUNT(*) FROM notifications');
    console.log('✅ Demo bildirimler eklendi. Toplam:', result.rows[0].count);
  } catch (err) {
    console.error('❌ Hata:', err.message);
  } finally {
    await pool.end();
  }
}

addDemoNotifications();
