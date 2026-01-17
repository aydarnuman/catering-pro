import express from 'express';
import { query, pool } from '../database.js';

const router = express.Router();

/**
 * Takip listesini getir
 * GET /api/tender-tracking
 */
router.get('/', async (req, res) => {
  try {
    const { status, user_id } = req.query;
    
    let sql = `
      SELECT 
        tt.*,
        COALESCE(tt.user_notes, '[]'::jsonb) as user_notes,
        COALESCE(tt.hesaplama_verileri, '{}'::jsonb) as hesaplama_verileri,
        t.title as ihale_basligi,
        t.organization_name as kurum,
        t.tender_date as tarih,
        t.estimated_cost as bedel,
        t.city,
        t.external_id,
        t.url,
        (SELECT COUNT(*) FROM documents WHERE tender_id = t.id AND (file_type IS NULL OR file_type NOT LIKE '%zip%')) as dokuman_sayisi,
        (SELECT COUNT(*) FROM documents WHERE tender_id = t.id AND processing_status = 'completed' AND (file_type IS NULL OR file_type NOT LIKE '%zip%')) as analiz_edilen_dokuman
      FROM tender_tracking tt
      JOIN tenders t ON tt.tender_id = t.id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (status) {
      params.push(status);
      sql += ` AND tt.status = $${params.length}`;
    }
    
    if (user_id) {
      params.push(user_id);
      sql += ` AND tt.user_id = $${params.length}`;
    }
    
    sql += ` ORDER BY tt.created_at DESC`;
    
    const result = await query(sql, params);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Takip listesi hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Takip listesine ekle
 * POST /api/tender-tracking
 */
router.post('/', async (req, res) => {
  try {
    const { tender_id, user_id, status, notes, priority, analysis_summary } = req.body;
    
    if (!tender_id) {
      return res.status(400).json({ success: false, error: 'tender_id gerekli' });
    }
    
    // Upsert - varsa güncelle, yoksa ekle
    const result = await query(`
      INSERT INTO tender_tracking (tender_id, user_id, status, notes, priority, analysis_summary)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (tender_id, user_id) 
      DO UPDATE SET 
        status = COALESCE(EXCLUDED.status, tender_tracking.status),
        notes = COALESCE(EXCLUDED.notes, tender_tracking.notes),
        priority = COALESCE(EXCLUDED.priority, tender_tracking.priority),
        analysis_summary = COALESCE(EXCLUDED.analysis_summary, tender_tracking.analysis_summary),
        updated_at = NOW()
      RETURNING *
    `, [
      tender_id,
      user_id || null,
      status || 'bekliyor',
      notes || null,
      priority || 0,
      analysis_summary ? JSON.stringify(analysis_summary) : null
    ]);
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Takip ekleme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Takip kaydını güncelle
 * PUT /api/tender-tracking/:id
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      status, 
      notes, 
      priority, 
      reminder_date, 
      analysis_summary,
      // Yeni hesaplama alanları
      yaklasik_maliyet,
      sinir_deger,
      bizim_teklif,
      hesaplama_verileri
    } = req.body;
    
    const result = await query(`
      UPDATE tender_tracking 
      SET 
        status = COALESCE($1, status),
        notes = COALESCE($2, notes),
        priority = COALESCE($3, priority),
        reminder_date = $4,
        analysis_summary = COALESCE($5, analysis_summary),
        yaklasik_maliyet = COALESCE($6, yaklasik_maliyet),
        sinir_deger = COALESCE($7, sinir_deger),
        bizim_teklif = COALESCE($8, bizim_teklif),
        hesaplama_verileri = COALESCE($9, hesaplama_verileri),
        updated_at = NOW()
      WHERE id = $10
      RETURNING *
    `, [
      status,
      notes,
      priority,
      reminder_date || null,
      analysis_summary ? JSON.stringify(analysis_summary) : null,
      yaklasik_maliyet || null,
      sinir_deger || null,
      bizim_teklif || null,
      hesaplama_verileri ? JSON.stringify(hesaplama_verileri) : null,
      id
    ]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Kayıt bulunamadı' });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Takip güncelleme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Not ekle
 * POST /api/tender-tracking/:id/notes
 */
router.post('/:id/notes', async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;
    
    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, error: 'Not metni gerekli' });
    }
    
    const newNote = {
      id: `note_${Date.now()}`,
      text: text.trim(),
      created_at: new Date().toISOString()
    };
    
    const result = await query(`
      UPDATE tender_tracking 
      SET user_notes = COALESCE(user_notes, '[]'::jsonb) || $1::jsonb,
          updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `, [JSON.stringify(newNote), id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Kayıt bulunamadı' });
    }
    
    res.json({
      success: true,
      data: result.rows[0],
      note: newNote
    });
  } catch (error) {
    console.error('Not ekleme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Not sil
 * DELETE /api/tender-tracking/:id/notes/:noteId
 */
router.delete('/:id/notes/:noteId', async (req, res) => {
  try {
    const { id, noteId } = req.params;
    
    // JSONB array'den belirli notu kaldır
    const result = await query(`
      UPDATE tender_tracking 
      SET user_notes = (
        SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
        FROM jsonb_array_elements(COALESCE(user_notes, '[]'::jsonb)) elem
        WHERE elem->>'id' != $1
      ),
      updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `, [noteId, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Kayıt bulunamadı' });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Not silme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Takip kaydını sil
 * DELETE /api/tender-tracking/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await query(
      'DELETE FROM tender_tracking WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Kayıt bulunamadı' });
    }
    
    res.json({
      success: true,
      message: 'Takip kaydı silindi'
    });
  } catch (error) {
    console.error('Takip silme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Analiz sonrası otomatik takip listesine ekle
 * POST /api/tender-tracking/add-from-analysis
 */
router.post('/add-from-analysis', async (req, res) => {
  try {
    const { tender_id, user_id } = req.body;
    
    if (!tender_id) {
      return res.status(400).json({ success: false, error: 'tender_id gerekli' });
    }
    
    // Tüm analiz sonuçlarını topla
    const analysisResult = await query(`
      SELECT 
        d.id,
        d.doc_type,
        d.original_filename,
        d.analysis_result,
        d.processing_status
      FROM documents d
      WHERE d.tender_id = $1 AND d.processing_status = 'completed' AND d.analysis_result IS NOT NULL
    `, [tender_id]);
    
    // Analiz özetini oluştur
    let analysisSummary = {
      teknik_sartlar: [],
      birim_fiyatlar: [],
      notlar: [],
      documents_count: analysisResult.rows.length
    };
    
    for (const doc of analysisResult.rows) {
      if (doc.analysis_result) {
        const analysis = typeof doc.analysis_result === 'string' 
          ? JSON.parse(doc.analysis_result) 
          : doc.analysis_result;
        
        // Teknik şartları topla
        if (analysis.teknik_sartlar) {
          analysisSummary.teknik_sartlar.push(...analysis.teknik_sartlar);
        }
        if (analysis.technical_requirements) {
          analysisSummary.teknik_sartlar.push(...analysis.technical_requirements);
        }
        
        // Birim fiyatları topla
        if (analysis.birim_fiyatlar) {
          analysisSummary.birim_fiyatlar.push(...analysis.birim_fiyatlar);
        }
        if (analysis.unit_prices) {
          analysisSummary.birim_fiyatlar.push(...analysis.unit_prices);
        }
        
        // Notları topla
        if (analysis.notlar) {
          analysisSummary.notlar.push(...analysis.notlar);
        }
        if (analysis.notes) {
          analysisSummary.notlar.push(...analysis.notes);
        }
      }
    }
    
    // Takip listesine ekle/güncelle
    const result = await query(`
      INSERT INTO tender_tracking (
        tender_id, user_id, status, analysis_summary, 
        documents_analyzed, last_analysis_at
      )
      VALUES ($1, $2, 'bekliyor', $3, $4, NOW())
      ON CONFLICT (tender_id, user_id) 
      DO UPDATE SET 
        analysis_summary = $3,
        documents_analyzed = $4,
        last_analysis_at = NOW(),
        updated_at = NOW()
      RETURNING *
    `, [
      tender_id,
      user_id || null,
      JSON.stringify(analysisSummary),
      analysisResult.rows.length
    ]);
    
    res.json({
      success: true,
      data: result.rows[0],
      analysis_summary: analysisSummary
    });
  } catch (error) {
    console.error('Analiz sonrası takip ekleme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * İhale takip durumunu kontrol et
 * GET /api/tender-tracking/check/:tenderId
 */
router.get('/check/:tenderId', async (req, res) => {
  try {
    const { tenderId } = req.params;
    const { user_id } = req.query;
    
    const result = await query(`
      SELECT * FROM tender_tracking 
      WHERE tender_id = $1 AND (user_id = $2 OR user_id IS NULL)
    `, [tenderId, user_id || null]);
    
    res.json({
      success: true,
      isTracked: result.rows.length > 0,
      data: result.rows[0] || null
    });
  } catch (error) {
    console.error('Takip kontrol hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * İstatistikler
 * GET /api/tender-tracking/stats
 */
router.get('/stats', async (req, res) => {
  try {
    const { user_id } = req.query;
    
    let whereClause = user_id ? 'WHERE user_id = $1' : '';
    const params = user_id ? [user_id] : [];
    
    const result = await query(`
      SELECT 
        COUNT(*) as toplam,
        COUNT(*) FILTER (WHERE status = 'bekliyor') as bekliyor,
        COUNT(*) FILTER (WHERE status = 'basvuruldu') as basvuruldu,
        COUNT(*) FILTER (WHERE status = 'kazanildi') as kazanildi,
        COUNT(*) FILTER (WHERE status = 'kaybedildi') as kaybedildi,
        COUNT(*) FILTER (WHERE status = 'iptal') as iptal
      FROM tender_tracking
      ${whereClause}
    `, params);
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('İstatistik hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * İhale için güncel analiz sonuçlarını getir
 * Tüm dökümanların analysis_result'larını birleştirip döndürür
 * GET /api/tender-tracking/:tenderId/analysis
 */
router.get('/:tenderId/analysis', async (req, res) => {
  try {
    const { tenderId } = req.params;
    
    // Tüm dökümanların analiz sonuçlarını çek
    const docsResult = await query(`
      SELECT 
        id, original_filename, doc_type, processing_status, 
        analysis_result, extracted_text
      FROM documents 
      WHERE tender_id = $1 
        AND analysis_result IS NOT NULL
      ORDER BY doc_type, created_at
    `, [tenderId]);
    
    // İhale bilgilerini çek
    const tenderResult = await query(`
      SELECT id, title, organization_name, tender_date, city, 
             estimated_cost, external_id, url
      FROM tenders WHERE id = $1
    `, [tenderId]);
    
    if (tenderResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'İhale bulunamadı' });
    }
    
    const tender = tenderResult.rows[0];
    const documents = docsResult.rows;
    
    // Analiz sonuçlarını birleştir
    const combinedAnalysis = {
      ihale_basligi: tender.title,
      kurum: tender.organization_name,
      tarih: tender.tender_date,
      bedel: tender.estimated_cost || 'Belirtilmemiş',
      sure: '',
      teknik_sartlar: [],
      birim_fiyatlar: [],
      notlar: [],
      tam_metin: '',
      iletisim: null,
      dokuman_detaylari: [] // Her dökümanın ayrı analizi
    };
    
    for (const doc of documents) {
      const analysis = doc.analysis_result || {};
      
      // Her dökümanın ayrı analizini ekle
      combinedAnalysis.dokuman_detaylari.push({
        id: doc.id,
        filename: doc.original_filename,
        doc_type: doc.doc_type,
        status: doc.processing_status,
        analysis: analysis
      });
      
      // Birleşik alanları doldur
      if (analysis.sure && !combinedAnalysis.sure) {
        combinedAnalysis.sure = analysis.sure;
      }
      if (analysis.bedel && combinedAnalysis.bedel === 'Belirtilmemiş') {
        combinedAnalysis.bedel = analysis.bedel;
      }
      if (analysis.iletisim && !combinedAnalysis.iletisim) {
        combinedAnalysis.iletisim = analysis.iletisim;
      }
      
      // Teknik şartları birleştir
      if (analysis.teknik_sartlar && Array.isArray(analysis.teknik_sartlar)) {
        combinedAnalysis.teknik_sartlar.push(...analysis.teknik_sartlar);
      }
      
      // Birim fiyatları birleştir - object olanları önce, string olanları sonra
      if (analysis.birim_fiyatlar && Array.isArray(analysis.birim_fiyatlar)) {
        for (const item of analysis.birim_fiyatlar) {
          // Object formatındaki birim fiyatları (kalem, miktar, birim_fiyat içerenler)
          if (typeof item === 'object' && item !== null && item.kalem) {
            // Başa ekle (öncelikli)
            combinedAnalysis.birim_fiyatlar.unshift(item);
          } else if (typeof item === 'string') {
            // String formatındaki açıklamaları sona ekle
            combinedAnalysis.birim_fiyatlar.push(item);
          }
        }
      }
      
      // Notları birleştir
      if (analysis.notlar && Array.isArray(analysis.notlar)) {
        combinedAnalysis.notlar.push(...analysis.notlar);
      }
      
      // Tam metinleri birleştir
      if (analysis.tam_metin) {
        combinedAnalysis.tam_metin += `\n\n--- ${doc.original_filename} ---\n${analysis.tam_metin}`;
      }
    }
    
    // Tekrarları kaldır
    combinedAnalysis.teknik_sartlar = [...new Set(combinedAnalysis.teknik_sartlar)];
    
    // Birim fiyatları: object ve string'leri ayrı ayrı unique yap
    const objectItems = combinedAnalysis.birim_fiyatlar.filter(item => typeof item === 'object');
    const stringItems = combinedAnalysis.birim_fiyatlar.filter(item => typeof item === 'string');
    const uniqueObjects = [...new Map(objectItems.map(item => [JSON.stringify(item), item])).values()];
    const uniqueStrings = [...new Set(stringItems)];
    combinedAnalysis.birim_fiyatlar = [...uniqueObjects, ...uniqueStrings];
    combinedAnalysis.notlar = [...new Set(combinedAnalysis.notlar)];
    combinedAnalysis.tam_metin = combinedAnalysis.tam_metin.trim();
    
    // Döküman istatistikleri (ZIP dosyaları hariç - analiz edilemezler)
    const totalDocs = await query(`
      SELECT COUNT(*) as total, 
             COUNT(*) FILTER (WHERE processing_status = 'completed') as completed,
             COUNT(*) FILTER (WHERE processing_status = 'failed') as failed,
             COUNT(*) FILTER (WHERE processing_status = 'pending') as pending
      FROM documents 
      WHERE tender_id = $1 
        AND (file_type IS NULL OR file_type NOT LIKE '%zip%')
    `, [tenderId]);
    
    res.json({
      success: true,
      data: {
        tender: tender,
        analysis: combinedAnalysis,
        stats: {
          toplam_dokuman: parseInt(totalDocs.rows[0].total),
          analiz_edilen: parseInt(totalDocs.rows[0].completed),
          basarisiz: parseInt(totalDocs.rows[0].failed),
          bekleyen: parseInt(totalDocs.rows[0].pending)
        }
      }
    });
  } catch (error) {
    console.error('Analiz getirme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
