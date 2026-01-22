import express from 'express';
import { query } from '../database.js';
import aiAgent from '../services/ai-agent.js';
import { parseWithRegex, smartParse, batchParse } from '../services/ambalajParser.js';

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
        uk.kod as stok_kod,
        uk.ad as stok_adi,
        ptl.sistem_fiyat as guncel_sistem_fiyat,
        k.ad as kategori
      FROM piyasa_takip_listesi ptl
      LEFT JOIN urun_kartlari uk ON uk.id = ptl.stok_kart_id
      LEFT JOIN stok_kategoriler k ON k.id = uk.kategori_id
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
          LEFT JOIN urun_kartlari uk ON uk.id = ptl.stok_kart_id
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

// Detaylı piyasa araştırması - sonuçları kullanıcıya göster
router.post('/piyasa/detayli-arastir', async (req, res) => {
  try {
    const { urun_adi, stok_kart_id, ana_urun_id } = req.body;
    
    if (!urun_adi) {
      return res.status(400).json({ success: false, error: 'Ürün adı zorunludur' });
    }
    
    // AI ile araştırma yap
    const result = await aiAgent.executeTool('piyasa_fiyat_arastir', {
      urun_adi,
      stok_kart_id
    });
    
    if (!result.success || !result.piyasa?.kaynaklar) {
      return res.json({ success: false, sonuclar: [] });
    }
    
    // Kaynakları formatla
    const sonuclar = result.piyasa.kaynaklar.map(k => {
      // Ambalaj miktarını parse et
      let ambalaj = '1 KG';
      let ambalajMiktar = 1;
      
      // Ürün adından ambalaj bilgisi çıkar
      const kgMatch = k.urun_adi?.match(/(\d+[,.]?\d*)\s*(kg|kilo)/i);
      const grMatch = k.urun_adi?.match(/(\d+[,.]?\d*)\s*(gr|gram|g\b)/i);
      const ltMatch = k.urun_adi?.match(/(\d+[,.]?\d*)\s*(lt|litre|l\b)/i);
      
      if (kgMatch) {
        ambalajMiktar = parseFloat(kgMatch[1].replace(',', '.'));
        ambalaj = `${ambalajMiktar} KG`;
      } else if (grMatch) {
        ambalajMiktar = parseFloat(grMatch[1].replace(',', '.')) / 1000;
        ambalaj = `${grMatch[1]} GR`;
      } else if (ltMatch) {
        ambalajMiktar = parseFloat(ltMatch[1].replace(',', '.'));
        ambalaj = `${ambalajMiktar} LT`;
      }
      
      const fiyat = k.fiyat || k.price || 0;
      const birimFiyat = ambalajMiktar > 0 ? fiyat / ambalajMiktar : fiyat;
      
      return {
        market: k.market || k.kaynak || 'Bilinmeyen',
        urunAdi: k.urun_adi || k.product_name || urun_adi,
        marka: k.marka || '',
        fiyat: fiyat,
        ambalaj: ambalaj,
        ambalajMiktar: ambalajMiktar,
        birimFiyat: birimFiyat
      };
    });
    
    res.json({ 
      success: true, 
      sonuclar,
      ozet: {
        ortalama: result.piyasa.ortalama,
        min: result.piyasa.min,
        max: result.piyasa.max
      }
    });
  } catch (error) {
    console.error('Detaylı araştırma hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Seçilen AI sonuçlarını kaydet
router.post('/piyasa/kaydet-sonuclar', async (req, res) => {
  try {
    const { stok_kart_id, ana_urun_id, sonuclar } = req.body;
    
    if (!sonuclar || sonuclar.length === 0) {
      return res.status(400).json({ success: false, error: 'En az bir sonuç gerekli' });
    }
    
    let kaydedilen = 0;
    
    for (const sonuc of sonuclar) {
      await query(`
        INSERT INTO piyasa_fiyat_gecmisi 
        (stok_kart_id, ana_urun_id, urun_adi, market_adi, marka, 
         piyasa_fiyat_ort, ambalaj_miktar, bm_fiyat, arastirma_tarihi)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      `, [
        stok_kart_id || null,
        ana_urun_id || null,
        sonuc.urunAdi,
        sonuc.market,
        sonuc.marka || null,
        sonuc.fiyat,
        sonuc.ambalajMiktar || 1,
        sonuc.birimFiyat
      ]);
      kaydedilen++;
    }
    
    // Ortalama birim fiyatı hesapla
    const ortBirimFiyat = sonuclar.reduce((a, b) => a + b.birimFiyat, 0) / sonuclar.length;
    
    // Ürün kartını güncelle (varsa) - YENİ SİSTEM: urun_kartlari
    if (stok_kart_id) {
      await query(`
        UPDATE urun_kartlari SET
          son_piyasa_fiyat = $1,
          updated_at = NOW()
        WHERE id = $2
      `, [ortBirimFiyat, stok_kart_id]);
    }
    
    res.json({ 
      success: true, 
      message: `${kaydedilen} sonuç kaydedildi`,
      ortalamaBirimFiyat: ortBirimFiyat.toFixed(2)
    });
  } catch (error) {
    console.error('Sonuç kaydetme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Piyasa fiyatı kaydet (stok kartına bağla)
router.post('/piyasa/fiyat-kaydet', async (req, res) => {
  try {
    const { stok_kart_id, piyasa_fiyat_ort, piyasa_fiyat_min, piyasa_fiyat_max, urun_adi } = req.body;
    
    if (!stok_kart_id || !piyasa_fiyat_ort) {
      return res.status(400).json({ success: false, error: 'stok_kart_id ve piyasa_fiyat_ort zorunludur' });
    }
    
    // piyasa_fiyat_gecmisi tablosuna kaydet
    await query(`
      INSERT INTO piyasa_fiyat_gecmisi 
      (stok_kart_id, urun_adi, piyasa_fiyat_min, piyasa_fiyat_max, piyasa_fiyat_ort, arastirma_tarihi)
      VALUES ($1, $2, $3, $4, $5, NOW())
    `, [stok_kart_id, urun_adi || '', piyasa_fiyat_min || piyasa_fiyat_ort, piyasa_fiyat_max || piyasa_fiyat_ort, piyasa_fiyat_ort]);
    
    // Ürün kartındaki son fiyatı da güncelle - YENİ SİSTEM: urun_kartlari
    await query(`
      UPDATE urun_kartlari SET
        son_piyasa_fiyat = $1,
        updated_at = NOW()
      WHERE id = $2
    `, [piyasa_fiyat_ort, stok_kart_id]);
    
    res.json({ success: true, message: 'Fiyat kaydedildi' });
  } catch (error) {
    console.error('Fiyat kaydetme hatası:', error);
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
    
    // YENİ SİSTEM: urun_kartlari + urun_kategorileri
    const result = await query(`
      SELECT
        uk.id,
        uk.kod,
        uk.ad,
        uk.son_alis_fiyati as son_alis_fiyat,
        uk.toplam_stok,
        k.ad as kategori,
        b.kisa_ad as birim
      FROM urun_kartlari uk
      LEFT JOIN urun_kategorileri k ON k.id = uk.kategori_id
      LEFT JOIN birimler b ON b.id = uk.ana_birim_id
      WHERE uk.aktif = true
        AND (uk.ad ILIKE $1 OR uk.kod ILIKE $1)
      ORDER BY uk.ad
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

// =============================================
// FATURA FİYATLARI (Ürün Kartlarından) - YENİ SİSTEM
// =============================================

// Tüm ürün kartlarının fatura fiyatlarını getir
router.get('/piyasa/fatura-fiyatlari', async (req, res) => {
  try {
    const { kategori, arama, limit = 100 } = req.query;

    let whereConditions = ['uk.aktif = true', 'uk.son_alis_fiyati IS NOT NULL'];
    let params = [];
    let paramIndex = 1;

    if (kategori && kategori !== 'all') {
      whereConditions.push(`k.kod = $${paramIndex}`);
      params.push(kategori);
      paramIndex++;
    }

    if (arama) {
      whereConditions.push(`(uk.ad ILIKE $${paramIndex} OR uk.kod ILIKE $${paramIndex})`);
      params.push(`%${arama}%`);
      paramIndex++;
    }

    params.push(limit);

    // YENİ SİSTEM: urun_kartlari + urun_kategorileri
    const result = await query(`
      SELECT
        uk.id,
        uk.kod,
        uk.ad,
        uk.son_alis_fiyati as fatura_fiyat,
        uk.son_alis_tarihi as fatura_tarih,
        b.kisa_ad as birim,
        k.ad as kategori,
        k.kod as kategori_kod,
        -- Piyasa fiyatı (varsa)
        (
          SELECT piyasa_fiyat_ort
          FROM piyasa_fiyat_gecmisi
          WHERE stok_kart_id = uk.id
          ORDER BY arastirma_tarihi DESC
          LIMIT 1
        ) as piyasa_fiyat,
        -- Fark yüzdesi
        CASE
          WHEN uk.son_alis_fiyati > 0 AND (
            SELECT piyasa_fiyat_ort
            FROM piyasa_fiyat_gecmisi
            WHERE stok_kart_id = uk.id
            ORDER BY arastirma_tarihi DESC
            LIMIT 1
          ) IS NOT NULL THEN
            ROUND((((
              SELECT piyasa_fiyat_ort
              FROM piyasa_fiyat_gecmisi
              WHERE stok_kart_id = uk.id
              ORDER BY arastirma_tarihi DESC
              LIMIT 1
            ) - uk.son_alis_fiyati) / uk.son_alis_fiyati * 100)::numeric, 1)
          ELSE NULL
        END as fark_yuzde
      FROM urun_kartlari uk
      LEFT JOIN birimler b ON b.id = uk.ana_birim_id
      LEFT JOIN urun_kategorileri k ON k.id = uk.kategori_id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY uk.son_alis_tarihi DESC NULLS LAST, uk.ad
      LIMIT $${paramIndex}
    `, params);

    // Kategorileri de döndür - YENİ SİSTEM
    const kategoriler = await query(`
      SELECT DISTINCT k.kod, k.ad
      FROM urun_kategorileri k
      JOIN urun_kartlari uk ON uk.kategori_id = k.id
      WHERE uk.aktif = true AND uk.son_alis_fiyati IS NOT NULL
      ORDER BY k.ad
    `);
    
    res.json({
      success: true,
      data: result.rows,
      kategoriler: kategoriler.rows,
      ozet: {
        toplam: result.rows.length,
        fiyat_eslesme: result.rows.filter(r => r.piyasa_fiyat).length,
        ucuz_firsatlar: result.rows.filter(r => r.fark_yuzde && r.fark_yuzde > 5).length,
        pahali_uyarilar: result.rows.filter(r => r.fark_yuzde && r.fark_yuzde < -5).length
      }
    });
  } catch (error) {
    console.error('Fatura fiyatları hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Karşılaştırmalı fiyat listesi (Fatura + Piyasa yan yana) - YENİ SİSTEM
router.get('/piyasa/karsilastirma', async (req, res) => {
  try {
    const { kategori, limit = 50 } = req.query;

    let whereConditions = ['uk.aktif = true'];
    let params = [];
    let paramIndex = 1;

    if (kategori && kategori !== 'all') {
      whereConditions.push(`k.kod = $${paramIndex}`);
      params.push(kategori);
      paramIndex++;
    }

    params.push(limit);

    // YENİ SİSTEM: urun_kartlari + urun_kategorileri
    const result = await query(`
      WITH piyasa_son AS (
        SELECT DISTINCT ON (stok_kart_id)
          stok_kart_id,
          piyasa_fiyat_ort,
          piyasa_fiyat_min,
          piyasa_fiyat_max,
          arastirma_tarihi,
          kaynaklar
        FROM piyasa_fiyat_gecmisi
        WHERE stok_kart_id IS NOT NULL
        ORDER BY stok_kart_id, arastirma_tarihi DESC
      )
      SELECT
        uk.id,
        uk.kod,
        uk.ad,
        b.kisa_ad as birim,
        k.ad as kategori,

        -- Fatura bilgileri
        uk.son_alis_fiyati as fatura_fiyat,
        uk.son_alis_tarihi as fatura_tarih,

        -- Piyasa bilgileri
        ps.piyasa_fiyat_ort as piyasa_fiyat,
        ps.piyasa_fiyat_min as piyasa_min,
        ps.piyasa_fiyat_max as piyasa_max,
        ps.arastirma_tarihi as piyasa_tarih,
        ps.kaynaklar as piyasa_kaynaklar,

        -- Karşılaştırma
        CASE
          WHEN uk.son_alis_fiyati > 0 AND ps.piyasa_fiyat_ort > 0 THEN
            ROUND(((ps.piyasa_fiyat_ort - uk.son_alis_fiyati) / uk.son_alis_fiyati * 100)::numeric, 1)
          ELSE NULL
        END as fark_yuzde,

        -- Durum
        CASE
          WHEN uk.son_alis_fiyati IS NULL THEN 'fatura_yok'
          WHEN ps.piyasa_fiyat_ort IS NULL THEN 'piyasa_yok'
          WHEN ps.piyasa_fiyat_ort > uk.son_alis_fiyati * 1.05 THEN 'ucuz_aldik'
          WHEN ps.piyasa_fiyat_ort < uk.son_alis_fiyati * 0.95 THEN 'pahali_aldik'
          ELSE 'normal'
        END as durum,

        -- Son Fiyat (ortalama veya mevcut)
        CASE
          WHEN uk.son_alis_fiyati IS NOT NULL AND ps.piyasa_fiyat_ort IS NOT NULL THEN
            ROUND(((uk.son_alis_fiyati + ps.piyasa_fiyat_ort) / 2)::numeric, 2)
          WHEN uk.son_alis_fiyati IS NOT NULL THEN
            uk.son_alis_fiyati
          WHEN ps.piyasa_fiyat_ort IS NOT NULL THEN
            ps.piyasa_fiyat_ort
          ELSE NULL
        END as son_fiyat

      FROM urun_kartlari uk
      LEFT JOIN birimler b ON b.id = uk.ana_birim_id
      LEFT JOIN urun_kategorileri k ON k.id = uk.kategori_id
      LEFT JOIN piyasa_son ps ON ps.stok_kart_id = uk.id
      WHERE ${whereConditions.join(' AND ')}
        AND (uk.son_alis_fiyati IS NOT NULL OR ps.piyasa_fiyat_ort IS NOT NULL)
      ORDER BY
        CASE
          WHEN ps.piyasa_fiyat_ort < uk.son_alis_fiyati * 0.95 THEN 1  -- Pahalı aldıklarımız önce
          WHEN ps.piyasa_fiyat_ort > uk.son_alis_fiyati * 1.05 THEN 2  -- Ucuz aldıklarımız
          ELSE 3
        END,
        uk.ad
      LIMIT $${paramIndex}
    `, params);
    
    const data = result.rows;
    
    res.json({
      success: true,
      data,
      ozet: {
        toplam: data.length,
        ucuz_aldik: data.filter(r => r.durum === 'ucuz_aldik').length,
        pahali_aldik: data.filter(r => r.durum === 'pahali_aldik').length,
        normal: data.filter(r => r.durum === 'normal').length,
        fatura_yok: data.filter(r => r.durum === 'fatura_yok').length,
        piyasa_yok: data.filter(r => r.durum === 'piyasa_yok').length
      }
    });
  } catch (error) {
    console.error('Karşılaştırma hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Ürün kartı fiyatını manuel güncelle - YENİ SİSTEM
router.put('/piyasa/fiyat-guncelle/:stokKartId', async (req, res) => {
  try {
    const { stokKartId } = req.params;
    const { fiyat, kaynak = 'manuel' } = req.body;

    if (!fiyat || isNaN(fiyat) || fiyat <= 0) {
      return res.status(400).json({ success: false, error: 'Geçerli bir fiyat giriniz' });
    }

    // Ürün kartını güncelle - YENİ SİSTEM: urun_kartlari
    const result = await query(`
      UPDATE urun_kartlari
      SET son_alis_fiyati = $1,
          son_alis_tarihi = NOW(),
          updated_at = NOW()
      WHERE id = $2
      RETURNING id, ad, son_alis_fiyati as son_alis_fiyat, son_alis_tarihi
    `, [fiyat, stokKartId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Ürün kartı bulunamadı' });
    }

    // Log kaydet (opsiyonel)
    try {
      await query(`
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
        VALUES ($1, 'fiyat_guncelle', 'urun_kartlari', $2, $3)
      `, [
        req.user?.id || null,
        stokKartId,
        JSON.stringify({ yeni_fiyat: fiyat, kaynak, eski_fiyat: null })
      ]);
    } catch (logError) {
      // Log hatası kritik değil, devam et
      console.warn('Audit log hatası:', logError.message);
    }
    
    res.json({
      success: true,
      data: result.rows[0],
      message: `Fiyat ₺${Number(fiyat).toFixed(2)} olarak güncellendi`
    });
  } catch (error) {
    console.error('Fiyat güncelleme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===============================================
// ANA ÜRÜNLER (MASTER PRODUCTS) API
// ===============================================

// Ana ürünler listesi (kartlar için) - YENİ SİSTEM
router.get('/ana-urunler', async (req, res) => {
  try {
    const { kategori } = req.query;

    let whereConditions = ['au.aktif = true'];
    let params = [];
    let paramIndex = 1;

    if (kategori && kategori !== 'all') {
      whereConditions.push(`au.kategori = $${paramIndex}`);
      params.push(kategori);
      paramIndex++;
    }

    // YENİ SİSTEM: urun_kartlari
    const result = await query(`
      WITH piyasa_son AS (
        SELECT DISTINCT ON (uk.ana_urun_id)
          uk.ana_urun_id,
          pfg.piyasa_fiyat_ort
        FROM urun_kartlari uk
        JOIN piyasa_fiyat_gecmisi pfg ON pfg.stok_kart_id = uk.id
        WHERE uk.ana_urun_id IS NOT NULL
        ORDER BY uk.ana_urun_id, pfg.arastirma_tarihi DESC
      )
      SELECT
        au.id,
        au.kod,
        au.ad,
        au.ikon,
        au.kategori,
        au.sira,

        -- İstatistikler
        COUNT(DISTINCT uk.id) as stok_kart_sayisi,
        COUNT(DISTINCT CASE WHEN uk.son_alis_fiyati IS NOT NULL THEN uk.id END) as fiyatli_kart_sayisi,

        -- Ortalama fatura fiyatı
        ROUND(AVG(uk.son_alis_fiyati)::numeric, 2) as ortalama_fatura_fiyat,

        -- Piyasa fiyatı (en güncel)
        ROUND(ps.piyasa_fiyat_ort::numeric, 2) as piyasa_fiyat,

        -- Son fiyat: fatura ve piyasa ortalaması veya mevcut olan
        ROUND(
          COALESCE(
            CASE
              WHEN AVG(uk.son_alis_fiyati) IS NOT NULL AND ps.piyasa_fiyat_ort IS NOT NULL
              THEN (AVG(uk.son_alis_fiyati) + ps.piyasa_fiyat_ort) / 2
              ELSE COALESCE(AVG(uk.son_alis_fiyati), ps.piyasa_fiyat_ort)
            END,
            0
          )::numeric, 2
        ) as son_fiyat,

        -- Birim (en çok kullanılan)
        (
          SELECT b.kisa_ad
          FROM urun_kartlari uk4
          LEFT JOIN birimler b ON b.id = uk4.ana_birim_id
          WHERE uk4.ana_urun_id = au.id
          GROUP BY b.kisa_ad
          ORDER BY COUNT(*) DESC
          LIMIT 1
        ) as birim

      FROM ana_urunler au
      LEFT JOIN piyasa_son ps ON ps.ana_urun_id = au.id
      LEFT JOIN urun_kartlari uk ON uk.ana_urun_id = au.id AND uk.aktif = true
      WHERE ${whereConditions.join(' AND ')}
      GROUP BY au.id, au.kod, au.ad, au.ikon, au.kategori, au.sira, ps.piyasa_fiyat_ort
      ORDER BY au.kategori, au.sira, au.ad
    `, params);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Ana ürünler listesi hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Ana ürün detayı (stok kartları ve fiyatlarıyla)
router.get('/ana-urunler/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Ana ürün bilgisi
    const anaUrunResult = await query(`
      SELECT id, kod, ad, ikon, kategori
      FROM ana_urunler
      WHERE id = $1 AND aktif = true
    `, [id]);
    
    if (anaUrunResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Ana ürün bulunamadı' });
    }
    
    const anaUrun = anaUrunResult.rows[0];
    
    // Bu ana ürüne bağlı ürün kartları (ambalaj miktarı ve birim fiyat hesaplaması ile) - YENİ SİSTEM
    const stokKartlariResult = await query(`
      SELECT
        uk.id,
        uk.kod,
        uk.ad,
        b.kisa_ad as birim,
        COALESCE(uk.ambalaj_miktari, 1) as ambalaj_miktari,
        uk.son_alis_fiyati as fatura_fiyat,
        uk.son_alis_tarihi as fatura_tarih,
        -- Birim fiyat hesapla (fatura_fiyat / ambalaj_miktari)
        CASE
          WHEN uk.son_alis_fiyati IS NOT NULL AND COALESCE(uk.ambalaj_miktari, 1) > 0
          THEN ROUND((uk.son_alis_fiyati / COALESCE(uk.ambalaj_miktari, 1))::numeric, 2)
          ELSE NULL
        END as fatura_birim_fiyat,

        -- Piyasa fiyatı (ürün kartı bazında)
        pfg.piyasa_fiyat_ort as piyasa_fiyat,
        pfg.piyasa_fiyat_min as piyasa_min,
        pfg.piyasa_fiyat_max as piyasa_max,
        pfg.arastirma_tarihi as piyasa_tarih

      FROM urun_kartlari uk
      LEFT JOIN birimler b ON b.id = uk.ana_birim_id
      LEFT JOIN LATERAL (
        SELECT piyasa_fiyat_ort, piyasa_fiyat_min, piyasa_fiyat_max, arastirma_tarihi
        FROM piyasa_fiyat_gecmisi
        WHERE stok_kart_id = uk.id
        ORDER BY arastirma_tarihi DESC
        LIMIT 1
      ) pfg ON true
      WHERE uk.ana_urun_id = $1 AND uk.aktif = true
      ORDER BY uk.son_alis_tarihi DESC NULLS LAST, uk.ad
    `, [id]);
    
    // Ana ürün bazlı piyasa araştırması (farklı marketlerden)
    const piyasaArastirmaResult = await query(`
      SELECT 
        id,
        market_adi,
        marka,
        ambalaj_miktar,
        piyasa_fiyat_ort as fiyat,
        bm_fiyat as birim_fiyat,
        urun_adi,
        arastirma_tarihi
      FROM piyasa_fiyat_gecmisi
      WHERE ana_urun_id = $1
      ORDER BY arastirma_tarihi DESC, bm_fiyat ASC
      LIMIT 10
    `, [id]);
    
    // Piyasa özet istatistikleri
    const piyasaOzetResult = await query(`
      SELECT 
        ROUND(AVG(bm_fiyat)::numeric, 2) as ortalama,
        ROUND(MIN(bm_fiyat)::numeric, 2) as minimum,
        ROUND(MAX(bm_fiyat)::numeric, 2) as maksimum,
        COUNT(*) as kayit_sayisi,
        MAX(arastirma_tarihi) as son_guncelleme
      FROM piyasa_fiyat_gecmisi
      WHERE ana_urun_id = $1 AND bm_fiyat IS NOT NULL
    `, [id]);
    
    // Eşleşmemiş ürün kartları (öneri için) - YENİ SİSTEM
    const eslesmemisResult = await query(`
      SELECT uk.id, uk.kod, uk.ad, b.kisa_ad as birim, uk.ambalaj_miktari
      FROM urun_kartlari uk
      LEFT JOIN birimler b ON b.id = uk.ana_birim_id
      WHERE uk.ana_urun_id IS NULL
        AND uk.aktif = true
        AND (
          LOWER(uk.ad) LIKE '%' || LOWER($1) || '%'
          OR LOWER($1) LIKE '%' || LOWER(uk.ad) || '%'
        )
      ORDER BY uk.ad
      LIMIT 10
    `, [anaUrun.ad]);
    
    // Fatura fiyatları özeti (birim bazında)
    const faturaOzet = stokKartlariResult.rows.reduce((acc, sk) => {
      if (sk.fatura_birim_fiyat) {
        acc.toplam += parseFloat(sk.fatura_birim_fiyat);
        acc.sayac++;
        if (!acc.min || sk.fatura_birim_fiyat < acc.min) acc.min = sk.fatura_birim_fiyat;
        if (!acc.max || sk.fatura_birim_fiyat > acc.max) acc.max = sk.fatura_birim_fiyat;
      }
      return acc;
    }, { toplam: 0, sayac: 0, min: null, max: null });
    
    res.json({
      success: true,
      data: {
        ...anaUrun,
        stok_kartlari: stokKartlariResult.rows,
        piyasa_arastirma: piyasaArastirmaResult.rows,
        piyasa_ozet: piyasaOzetResult.rows[0],
        fatura_ozet: {
          ortalama: faturaOzet.sayac > 0 ? (faturaOzet.toplam / faturaOzet.sayac).toFixed(2) : null,
          minimum: faturaOzet.min,
          maksimum: faturaOzet.max,
          kayit_sayisi: faturaOzet.sayac
        },
        eslesmemis_oneriler: eslesmemisResult.rows
      }
    });
  } catch (error) {
    console.error('Ana ürün detay hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Ürün kartını ana ürüne eşleştir - YENİ SİSTEM
router.post('/ana-urunler/:id/eslestir', async (req, res) => {
  try {
    const { id } = req.params;
    const { stok_kart_id } = req.body;

    if (!stok_kart_id) {
      return res.status(400).json({ success: false, error: 'stok_kart_id gerekli' });
    }

    // Ana ürün var mı kontrol
    const anaUrunCheck = await query('SELECT id, ad FROM ana_urunler WHERE id = $1', [id]);
    if (anaUrunCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Ana ürün bulunamadı' });
    }

    // Ürün kartını güncelle - YENİ SİSTEM: urun_kartlari
    const result = await query(`
      UPDATE urun_kartlari
      SET ana_urun_id = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id, kod, ad
    `, [id, stok_kart_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Ürün kartı bulunamadı' });
    }

    res.json({
      success: true,
      message: `"${result.rows[0].ad}" → "${anaUrunCheck.rows[0].ad}" eşleştirildi`,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Eşleştirme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Ürün kartı eşleştirmesini kaldır - YENİ SİSTEM
router.delete('/ana-urunler/:id/eslestir/:stokKartId', async (req, res) => {
  try {
    const { id, stokKartId } = req.params;

    const result = await query(`
      UPDATE urun_kartlari
      SET ana_urun_id = NULL, updated_at = NOW()
      WHERE id = $1 AND ana_urun_id = $2
      RETURNING id, kod, ad
    `, [stokKartId, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Ürün kartı bulunamadı veya bu ana ürüne bağlı değil' });
    }

    res.json({
      success: true,
      message: `"${result.rows[0].ad}" eşleştirmesi kaldırıldı`,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Eşleştirme kaldırma hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Ana ürün fiyatını güncelle (tüm bağlı ürün kartlarına yansır) - YENİ SİSTEM
router.put('/ana-urunler/:id/fiyat', async (req, res) => {
  try {
    const { id } = req.params;
    const { fiyat } = req.body;

    if (!fiyat || isNaN(fiyat) || fiyat <= 0) {
      return res.status(400).json({ success: false, error: 'Geçerli bir fiyat giriniz' });
    }

    // Tüm bağlı ürün kartlarının fiyatını güncelle - YENİ SİSTEM: urun_kartlari
    const result = await query(`
      UPDATE urun_kartlari
      SET son_alis_fiyati = $1, son_alis_tarihi = NOW(), updated_at = NOW()
      WHERE ana_urun_id = $2
      RETURNING id, ad
    `, [fiyat, id]);

    res.json({
      success: true,
      message: `${result.rows.length} ürün kartının fiyatı ₺${Number(fiyat).toFixed(2)} olarak güncellendi`,
      guncellenen: result.rows
    });
  } catch (error) {
    console.error('Ana ürün fiyat güncelleme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Yeni ana ürün ekle
router.post('/ana-urunler', async (req, res) => {
  try {
    const { kod, ad, ikon, kategori } = req.body;
    
    if (!kod || !ad) {
      return res.status(400).json({ success: false, error: 'kod ve ad gerekli' });
    }
    
    const result = await query(`
      INSERT INTO ana_urunler (kod, ad, ikon, kategori)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [kod, ad, ikon || '📦', kategori || 'diger']);
    
    res.json({
      success: true,
      data: result.rows[0],
      message: `"${ad}" ana ürünü oluşturuldu`
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ success: false, error: 'Bu kod zaten kullanılıyor' });
    }
    console.error('Ana ürün ekleme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Ana ürün kategorileri (filter için)
router.get('/ana-urunler-kategoriler', async (req, res) => {
  try {
    const result = await query(`
      SELECT DISTINCT kategori, COUNT(*) as urun_sayisi
      FROM ana_urunler
      WHERE aktif = true
      GROUP BY kategori
      ORDER BY kategori
    `);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Kategoriler hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Eşleşmemiş ürün kartları listesi - YENİ SİSTEM
router.get('/eslesmemis-stok-kartlari', async (req, res) => {
  try {
    const { arama, limit = 50 } = req.query;

    let whereConditions = ['uk.ana_urun_id IS NULL', 'uk.aktif = true'];
    let params = [];
    let paramIndex = 1;

    if (arama) {
      whereConditions.push(`(uk.ad ILIKE $${paramIndex} OR uk.kod ILIKE $${paramIndex})`);
      params.push(`%${arama}%`);
      paramIndex++;
    }

    params.push(limit);

    // YENİ SİSTEM: urun_kartlari + urun_kategorileri
    const result = await query(`
      SELECT
        uk.id,
        uk.kod,
        uk.ad,
        b.kisa_ad as birim,
        k.ad as kategori,
        uk.son_alis_fiyati as son_alis_fiyat
      FROM urun_kartlari uk
      LEFT JOIN birimler b ON b.id = uk.ana_birim_id
      LEFT JOIN urun_kategorileri k ON k.id = uk.kategori_id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY uk.ad
      LIMIT $${paramIndex}
    `, params);

    res.json({
      success: true,
      data: result.rows,
      toplam: result.rows.length
    });
  } catch (error) {
    console.error('Eşleşmemiş ürün kartları hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// AMBALAJ MİKTARI PARSE
// =============================================

// Tek ürün için ambalaj miktarı parse et
router.post('/ambalaj-parse', async (req, res) => {
  try {
    const { urunAdi, forceAI = false } = req.body;
    
    if (!urunAdi) {
      return res.status(400).json({ success: false, error: 'Ürün adı gerekli' });
    }
    
    const result = await smartParse(urunAdi, forceAI);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Ambalaj parse hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Ürün kartının ambalaj miktarını güncelle (tek) - YENİ SİSTEM
router.post('/stok-karti/:id/ambalaj-guncelle', async (req, res) => {
  try {
    const { id } = req.params;
    const { forceAI = false } = req.body;

    // Ürün kartını al - YENİ SİSTEM: urun_kartlari
    const ukResult = await query('SELECT id, ad, ambalaj_miktari FROM urun_kartlari WHERE id = $1', [id]);
    if (ukResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Ürün kartı bulunamadı' });
    }

    const urunKarti = ukResult.rows[0];

    // Parse et
    const parseResult = await smartParse(urunKarti.ad, forceAI);

    if (parseResult.success && parseResult.amount) {
      // Güncelle
      await query(
        'UPDATE urun_kartlari SET ambalaj_miktari = $1 WHERE id = $2',
        [parseResult.amount, id]
      );

      res.json({
        success: true,
        data: {
          id: urunKarti.id,
          ad: urunKarti.ad,
          eskiAmbalaj: urunKarti.ambalaj_miktari,
          yeniAmbalaj: parseResult.amount,
          birim: parseResult.unit,
          method: parseResult.method,
          confidence: parseResult.confidence,
          explanation: parseResult.explanation
        }
      });
    } else {
      res.json({
        success: false,
        error: 'Ambalaj miktarı parse edilemedi',
        data: parseResult
      });
    }
  } catch (error) {
    console.error('Ambalaj güncelleme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Tüm ürün kartlarının ambalaj miktarını toplu güncelle - YENİ SİSTEM
router.post('/stok-karti/toplu-ambalaj-guncelle', async (req, res) => {
  try {
    const { sadeceBoslar = true, limit = 50 } = req.body;

    // Güncellenecek ürün kartlarını al - YENİ SİSTEM: urun_kartlari
    let whereClause = 'WHERE aktif = true';
    if (sadeceBoslar) {
      whereClause += ' AND (ambalaj_miktari IS NULL OR ambalaj_miktari = 1)';
    }

    const ukResult = await query(`
      SELECT id, ad, ambalaj_miktari, son_alis_fiyati as son_alis_fiyat
      FROM urun_kartlari
      ${whereClause}
      ORDER BY son_alis_fiyati DESC NULLS LAST
      LIMIT $1
    `, [limit]);

    const results = {
      toplam: ukResult.rows.length,
      basarili: 0,
      basarisiz: 0,
      detaylar: []
    };

    for (const uk of ukResult.rows) {
      // Önce regex ile dene (hızlı)
      const parseResult = parseWithRegex(uk.ad);

      // Başarılı parse: amount > 1 veya varsayılan birim (regex-default) ise güncelle
      const shouldUpdate = parseResult.success && parseResult.amount &&
        (parseResult.amount !== 1 || parseResult.method === 'regex-default');

      if (shouldUpdate) {
        // Güncelle
        await query(
          'UPDATE urun_kartlari SET ambalaj_miktari = $1 WHERE id = $2',
          [parseResult.amount, uk.id]
        );
        
        const eskiFiyat = uk.son_alis_fiyat ? parseFloat(uk.son_alis_fiyat) : null;
        const yeniBirimFiyat = eskiFiyat ? (eskiFiyat / parseResult.amount).toFixed(2) : null;

        results.basarili++;
        results.detaylar.push({
          id: uk.id,
          ad: uk.ad,
          eskiAmbalaj: uk.ambalaj_miktari,
          yeniAmbalaj: parseResult.amount,
          birim: parseResult.unit,
          method: parseResult.method,
          explanation: parseResult.explanation,
          eskiFiyat,
          yeniBirimFiyat,
          status: 'updated'
        });
      } else {
        results.basarisiz++;
        results.detaylar.push({
          id: uk.id,
          ad: uk.ad,
          status: 'skipped',
          reason: 'Parse edilemedi veya miktar 1'
        });
      }
    }
    
    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('Toplu ambalaj güncelleme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Ambalaj durumu özeti - YENİ SİSTEM
router.get('/stok-karti/ambalaj-ozet', async (req, res) => {
  try {
    // YENİ SİSTEM: urun_kartlari
    const result = await query(`
      SELECT
        COUNT(*) as toplam,
        COUNT(CASE WHEN ambalaj_miktari IS NULL OR ambalaj_miktari = 1 THEN 1 END) as parse_gerekli,
        COUNT(CASE WHEN ambalaj_miktari > 1 THEN 1 END) as parse_edilmis,
        COUNT(CASE WHEN son_alis_fiyati IS NOT NULL THEN 1 END) as fiyatli
      FROM urun_kartlari
      WHERE aktif = true
    `);
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Ambalaj özet hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;

