import express from 'express';
import { query } from '../database.js';
import aiAgent from '../services/ai-agent.js';

const router = express.Router();

// =============================================
// PİYASA TAKİP LİSTESİ
// =============================================

// Takip listesini getir
router.get('/piyasa/takip-listesi', async (req, res) => {
  try {
    const { sadece_aktif = 'true' } = req.query;
    
    const result = await query(`
      SELECT 
        ptl.*,
        sk.kod as stok_kod,
        sk.ad as stok_adi,
        sk.toplam_stok,
        sk.son_alis_fiyat as guncel_sistem_fiyat,
        k.ad as kategori,
        b.kisa_ad as birim
      FROM piyasa_takip_listesi ptl
      LEFT JOIN stok_kartlari sk ON sk.id = ptl.stok_kart_id
      LEFT JOIN stok_kategoriler k ON k.id = sk.kategori_id
      LEFT JOIN birimler b ON b.id = sk.ana_birim_id
      ${sadece_aktif === 'true' ? 'WHERE ptl.aktif = true' : ''}
      ORDER BY 
        CASE ptl.durum 
          WHEN 'ucuz' THEN 1 
          WHEN 'pahali' THEN 2 
          ELSE 3 
        END,
        ptl.updated_at DESC
    `);
    
    const liste = result.rows;
    
    res.json({
      success: true,
      data: liste,
      ozet: {
        toplam: liste.length,
        ucuz_firsatlar: liste.filter(r => r.durum === 'ucuz').length,
        pahali_uyarilar: liste.filter(r => r.durum === 'pahali').length,
        normal: liste.filter(r => r.durum === 'normal').length
      }
    });
  } catch (error) {
    console.error('Takip listesi hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Takip listesine ekle
router.post('/piyasa/takip-listesi', async (req, res) => {
  try {
    const { stok_kart_id, urun_adi, sistem_fiyat, piyasa_fiyat, kaynaklar } = req.body;
    
    if (!urun_adi) {
      return res.status(400).json({ success: false, error: 'Ürün adı zorunludur' });
    }
    
    const farkYuzde = sistem_fiyat && piyasa_fiyat
      ? ((piyasa_fiyat - sistem_fiyat) / sistem_fiyat * 100).toFixed(2)
      : null;
    
    const durum = !farkYuzde ? 'bilinmiyor' :
                  parseFloat(farkYuzde) < -5 ? 'ucuz' :
                  parseFloat(farkYuzde) > 5 ? 'pahali' : 'normal';
    
    // Mevcut kayıt var mı?
    const existing = await query(`
      SELECT id FROM piyasa_takip_listesi 
      WHERE (stok_kart_id = $1 OR urun_adi = $2) AND aktif = true
    `, [stok_kart_id, urun_adi]);
    
    let result;
    if (existing.rows.length > 0) {
      // Güncelle
      result = await query(`
        UPDATE piyasa_takip_listesi 
        SET son_sistem_fiyat = $1, son_piyasa_fiyat = $2, fark_yuzde = $3, durum = $4
        WHERE id = $5
        RETURNING *
      `, [sistem_fiyat, piyasa_fiyat, farkYuzde, durum, existing.rows[0].id]);
    } else {
      // Yeni ekle
      result = await query(`
        INSERT INTO piyasa_takip_listesi 
        (stok_kart_id, urun_adi, son_sistem_fiyat, son_piyasa_fiyat, fark_yuzde, durum)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [stok_kart_id, urun_adi, sistem_fiyat, piyasa_fiyat, farkYuzde, durum]);
    }
    
    res.json({
      success: true,
      data: result.rows[0],
      islem: existing.rows.length > 0 ? 'guncellendi' : 'eklendi'
    });
  } catch (error) {
    console.error('Takip ekleme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Takip listesinden sil
router.delete('/piyasa/takip-listesi/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    await query('UPDATE piyasa_takip_listesi SET aktif = false WHERE id = $1', [id]);
    
    res.json({ success: true, message: 'Listeden kaldırıldı' });
  } catch (error) {
    console.error('Takip silme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Toplu fiyat güncelle
router.post('/piyasa/toplu-guncelle', async (req, res) => {
  try {
    const { urun_ids } = req.body;
    
    if (!urun_ids || urun_ids.length === 0) {
      return res.status(400).json({ success: false, error: 'Ürün seçilmedi' });
    }
    
    const sonuclar = [];
    
    for (const id of urun_ids) {
      try {
        // Ürün bilgisini al
        const urunResult = await query(`
          SELECT ptl.*, sk.ad as stok_adi
          FROM piyasa_takip_listesi ptl
          LEFT JOIN stok_kartlari sk ON sk.id = ptl.stok_kart_id
          WHERE ptl.id = $1
        `, [id]);
        
        if (urunResult.rows.length === 0) continue;
        
        const urun = urunResult.rows[0];
        
        // AI ile fiyat araştır
        const aiResult = await aiAgent.executeTool('piyasa_fiyat_arastir', {
          urun_adi: urun.stok_adi || urun.urun_adi,
          stok_kart_id: urun.stok_kart_id
        });
        
        if (aiResult.success) {
          // Listeyi güncelle
          const farkYuzde = aiResult.karsilastirma?.fark_yuzde;
          const durum = aiResult.karsilastirma?.durum || 'bilinmiyor';
          
          await query(`
            UPDATE piyasa_takip_listesi 
            SET son_piyasa_fiyat = $1, fark_yuzde = $2, durum = $3
            WHERE id = $4
          `, [aiResult.piyasa?.ortalama, farkYuzde, durum, id]);
          
          sonuclar.push({
            id,
            urun: urun.urun_adi,
            basarili: true,
            yeni_fiyat: aiResult.piyasa?.ortalama,
            durum
          });
        } else {
          sonuclar.push({
            id,
            urun: urun.urun_adi,
            basarili: false,
            hata: aiResult.error
          });
        }
      } catch (err) {
        sonuclar.push({
          id,
          basarili: false,
          hata: err.message
        });
      }
    }
    
    res.json({
      success: true,
      sonuclar,
      ozet: {
        toplam: sonuclar.length,
        basarili: sonuclar.filter(s => s.basarili).length,
        hatali: sonuclar.filter(s => !s.basarili).length
      }
    });
  } catch (error) {
    console.error('Toplu güncelleme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// PİYASA FİYAT GEÇMİŞİ
// =============================================

// Fiyat geçmişi getir
router.get('/piyasa/gecmis', async (req, res) => {
  try {
    const { urun_adi, stok_kart_id, limit = 50 } = req.query;
    
    let whereConditions = [];
    let params = [];
    let paramIndex = 1;
    
    if (urun_adi) {
      whereConditions.push(`urun_adi ILIKE $${paramIndex}`);
      params.push(`%${urun_adi}%`);
      paramIndex++;
    }
    
    if (stok_kart_id) {
      whereConditions.push(`stok_kart_id = $${paramIndex}`);
      params.push(stok_kart_id);
      paramIndex++;
    }
    
    params.push(limit);
    
    const result = await query(`
      SELECT * FROM piyasa_fiyat_gecmisi
      ${whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : ''}
      ORDER BY arastirma_tarihi DESC
      LIMIT $${paramIndex}
    `, params);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Fiyat geçmişi hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// AI CHAT - PİYASA ASİSTANI
// =============================================

// Piyasa asistanı ile sohbet
router.post('/piyasa/chat', async (req, res) => {
  try {
    const { message, sessionId } = req.body;
    
    if (!message) {
      return res.status(400).json({ success: false, error: 'Mesaj zorunludur' });
    }
    
    // AI Agent'a özel system prompt ekle
    const piyasaContext = `
Sen bir piyasa fiyat araştırma asistanısın. Kullanıcı ürün adı söylediğinde:
1. Önce piyasa_urun_ara tool'u ile stokta ara
2. Bulunan ürünler arasından seçim yaptır
3. Seçilen ürün için piyasa_fiyat_arastir tool'u ile fiyat araştır
4. Sonuçları güzel formatlı göster
5. Kullanıcı isterse piyasa_listeye_ekle ile takip listesine ekle

Kısa, öz ve yardımcı ol. Türkçe konuş.
`;
    
    const result = await aiAgent.processQuery(message, [], {
      sessionId: sessionId || `piyasa-${Date.now()}`,
      userId: 'default'
    });
    
    res.json({
      success: true,
      response: result.response,
      toolsUsed: result.toolsUsed,
      toolResults: result.toolResults,
      sessionId: result.sessionId
    });
  } catch (error) {
    console.error('Piyasa chat hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// AI ÜRÜN ÖNERİ SİSTEMİ
// =============================================

// Ürün öneri al (yazım kontrolü + genel terim tespiti)
router.post('/piyasa/oneri', async (req, res) => {
  try {
    const { arama_terimi } = req.body;
    
    if (!arama_terimi || arama_terimi.trim().length < 2) {
      return res.status(400).json({ 
        success: false, 
        error: 'En az 2 karakter girin' 
      });
    }
    
    const result = await aiAgent.executeTool('piyasa_urun_oneri', {
      arama_terimi: arama_terimi.trim()
    });
    
    res.json(result);
  } catch (error) {
    console.error('Öneri hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Tek ürün için hızlı fiyat araştır
router.post('/piyasa/hizli-arastir', async (req, res) => {
  try {
    const { urun_adi, stok_kart_id } = req.body;
    
    if (!urun_adi) {
      return res.status(400).json({ success: false, error: 'Ürün adı zorunludur' });
    }
    
    const result = await aiAgent.executeTool('piyasa_fiyat_arastir', {
      urun_adi,
      stok_kart_id
    });
    
    res.json(result);
  } catch (error) {
    console.error('Hızlı araştırma hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Stok kartlarını ara (autocomplete için)
router.get('/piyasa/urun-ara', async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.length < 2) {
      return res.json({ success: true, data: [] });
    }
    
    const result = await query(`
      SELECT 
        sk.id,
        sk.kod,
        sk.ad,
        sk.son_alis_fiyat,
        sk.toplam_stok,
        k.ad as kategori,
        b.kisa_ad as birim
      FROM stok_kartlari sk
      LEFT JOIN stok_kategoriler k ON k.id = sk.kategori_id
      LEFT JOIN birimler b ON b.id = sk.ana_birim_id
      WHERE sk.aktif = true
        AND (sk.ad ILIKE $1 OR sk.kod ILIKE $1)
      ORDER BY sk.ad
      LIMIT 10
    `, [`%${q}%`]);
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Ürün arama hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// MARKET API
// =============================================

// Market kaynaklarını getir (basit liste)
router.get('/market/sources', (req, res) => {
  res.json({
    success: true,
    sources: [
      { name: 'Akakce', status: 'active', type: 'comparison' },
      { name: 'Cimri', status: 'active', type: 'comparison' },
      { name: 'EnUygun', status: 'active', type: 'comparison' },
      { name: 'Migros', status: 'active', type: 'market' },
      { name: 'A101', status: 'active', type: 'market' },
      { name: 'Trendyol', status: 'active', type: 'marketplace' },
      { name: 'Hepsiburada', status: 'active', type: 'marketplace' },
      { name: 'Google Shopping', status: 'active', type: 'fallback' }
    ]
  });
});

// Fiyat topla (AI tool kullanarak)
router.post('/market/collect', async (req, res) => {
  try {
    const { items } = req.body;
    
    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Ürün listesi zorunludur' });
    }

    const allResults = [];
    
    for (const item of items) {
      const result = await aiAgent.executeTool('piyasa_fiyat_arastir', {
        urun_adi: item
      });
      
      if (result.success && result.piyasa?.kaynaklar) {
        allResults.push(...result.piyasa.kaynaklar.map(k => ({
          item,
          ...k
        })));
      }
    }

    res.json({
      success: true,
      prices: allResults
    });
  } catch (error) {
    console.error('Market collect hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Tüm toplanan fiyatları getir
router.get('/market', async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        id,
        urun_adi as item,
        kaynaklar->0->>'market' as source,
        piyasa_fiyat_ort as "unitPrice",
        'adet' as unit,
        arastirma_tarihi as "lastUpdated",
        0 as change,
        'available' as availability
      FROM piyasa_fiyat_gecmisi
      WHERE arastirma_tarihi > NOW() - INTERVAL '7 days'
      ORDER BY arastirma_tarihi DESC
      LIMIT 100
    `);

    res.json({
      success: true,
      prices: result.rows.map(r => ({
        ...r,
        unitPrice: parseFloat(r.unitPrice) || 0
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message, prices: [] });
  }
});

export default router;

