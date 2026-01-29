import express from 'express';
import { query } from '../database.js';

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
        COALESCE(tt.hesaplama_verileri, '{}'::jsonb) as hesaplama_verileri,
        t.title as ihale_basligi,
        t.organization_name as kurum,
        t.tender_date as tarih,
        t.estimated_cost as bedel,
        t.city,
        t.external_id,
        t.url,
        (SELECT COUNT(*) FROM documents d WHERE d.tender_id = tt.tender_id AND (d.file_type IS NULL OR d.file_type NOT LIKE '%zip%')) as dokuman_sayisi,
        (SELECT COUNT(*) FROM documents d WHERE d.tender_id = tt.tender_id AND d.processing_status = 'completed' AND (d.file_type IS NULL OR d.file_type NOT LIKE '%zip%')) as analiz_edilen_dokuman,
        COALESCE(
          (SELECT json_agg(json_build_object(
            'id', un.id,
            'text', un.content,
            'color', un.color,
            'pinned', un.pinned,
            'is_completed', un.is_completed,
            'created_at', un.created_at
          ) ORDER BY un.pinned DESC, un.sort_order ASC, un.created_at DESC)
          FROM unified_notes un
          WHERE un.context_type = 'tender' AND un.context_id = tt.tender_id),
          '[]'::json
        ) as user_notes
      FROM tender_tracking tt
      JOIN tenders t ON t.id = tt.tender_id::integer
      WHERE 1=1
    `;

    const params = [];

    if (status) {
      params.push(status);
      sql += ` AND tt.status = $${params.length}`;
    }

    if (user_id) {
      params.push(parseInt(user_id, 10));
      sql += ` AND tt.user_id = $${params.length}`;
    }

    sql += ` ORDER BY tt.created_at DESC`;

    const result = await query(sql, params);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
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
    const result = await query(
      `
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
    `,
      [
        tender_id,
        user_id || null,
        status || 'bekliyor',
        notes || null,
        priority || 0,
        analysis_summary ? JSON.stringify(analysis_summary) : null,
      ]
    );

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
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
      hesaplama_verileri,
    } = req.body;

    const result = await query(
      `
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
    `,
      [
        status,
        notes,
        priority,
        reminder_date || null,
        analysis_summary ? JSON.stringify(analysis_summary) : null,
        yaklasik_maliyet || null,
        sinir_deger || null,
        bizim_teklif || null,
        hesaplama_verileri ? JSON.stringify(hesaplama_verileri) : null,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Kayıt bulunamadı' });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Not ekle - Unified Notes sistemine yönlendirildi
 * POST /api/tender-tracking/:id/notes
 */
router.post('/:id/notes', async (req, res) => {
  try {
    const { id } = req.params;
    const { text, note } = req.body;
    const noteText = text || note;

    if (!noteText || !noteText.trim()) {
      return res.status(400).json({ success: false, error: 'Not metni gerekli' });
    }

    // Tracking kaydından tender_id ve user_id al
    const trackingResult = await query('SELECT tender_id, user_id FROM tender_tracking WHERE id = $1', [id]);

    if (trackingResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Kayıt bulunamadı' });
    }

    const { tender_id, user_id } = trackingResult.rows[0];

    // Unified notes'a ekle
    const result = await query(
      `
      INSERT INTO unified_notes (
        user_id, context_type, context_id, content, content_format,
        is_task, priority, color, pinned, sort_order
      )
      VALUES (
        $1, 'tender', $2::text, $3, 'plain',
        false, 'normal', 'yellow', false,
        COALESCE((SELECT MAX(sort_order) + 1 FROM unified_notes WHERE context_type = 'tender' AND context_id = $2::text), 0)
      )
      RETURNING *
    `,
      [user_id || 1, tender_id, noteText.trim()]
    );

    const newNote = result.rows[0];

    // Eski format ile uyumluluk için dönüşüm
    res.json({
      success: true,
      note: {
        id: newNote.id,
        text: newNote.content,
        created_at: newNote.created_at,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Not sil - Unified Notes sistemine yönlendirildi
 * DELETE /api/tender-tracking/:id/notes/:noteId
 */
router.delete('/:id/notes/:noteId', async (req, res) => {
  try {
    const { id, noteId } = req.params;

    // Tracking kaydından user_id al (yetki kontrolü için)
    const trackingResult = await query('SELECT user_id FROM tender_tracking WHERE id = $1', [id]);

    if (trackingResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Kayıt bulunamadı' });
    }

    // Unified notes'tan sil
    const result = await query('DELETE FROM unified_notes WHERE id = $1 RETURNING id', [noteId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Not bulunamadı' });
    }

    res.json({
      success: true,
      message: 'Not silindi',
    });
  } catch (error) {
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

    const result = await query('DELETE FROM tender_tracking WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Kayıt bulunamadı' });
    }

    res.json({
      success: true,
      message: 'Takip kaydı silindi',
    });
  } catch (error) {
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
    const analysisResult = await query(
      `
      SELECT 
        d.id,
        d.doc_type,
        d.original_filename,
        d.analysis_result,
        d.processing_status
      FROM documents d
      WHERE d.tender_id = $1 AND d.processing_status = 'completed' AND d.analysis_result IS NOT NULL
    `,
      [tender_id]
    );

    // Analiz özetini oluştur
    const analysisSummary = {
      teknik_sartlar: [],
      birim_fiyatlar: [],
      notlar: [],
      documents_count: analysisResult.rows.length,
    };

    for (const doc of analysisResult.rows) {
      if (doc.analysis_result) {
        const analysis =
          typeof doc.analysis_result === 'string' ? JSON.parse(doc.analysis_result) : doc.analysis_result;

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
    const result = await query(
      `
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
    `,
      [tender_id, user_id || null, JSON.stringify(analysisSummary), analysisResult.rows.length]
    );

    res.json({
      success: true,
      data: result.rows[0],
      analysis_summary: analysisSummary,
    });
  } catch (error) {
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

    // user_id varsa ona göre, yoksa tüm user_id NULL olanları da dahil et
    let sql, params;
    if (user_id) {
      sql = `SELECT * FROM tender_tracking WHERE tender_id = $1 AND user_id = $2`;
      params = [parseInt(tenderId, 10), parseInt(user_id, 10)];
    } else {
      // user_id yoksa, bu tender için herhangi bir takip var mı?
      sql = `SELECT * FROM tender_tracking WHERE tender_id = $1`;
      params = [parseInt(tenderId, 10)];
    }

    const result = await query(sql, params);

    res.json({
      success: true,
      isTracked: result.rows.length > 0,
      data: result.rows[0] || null,
    });
  } catch (error) {
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

    const whereClause = user_id ? 'WHERE user_id = $1' : '';
    const params = user_id ? [parseInt(user_id, 10)] : [];

    const result = await query(
      `
      SELECT 
        COUNT(*) as toplam,
        COUNT(*) FILTER (WHERE status = 'bekliyor') as bekliyor,
        COUNT(*) FILTER (WHERE status = 'basvuruldu') as basvuruldu,
        COUNT(*) FILTER (WHERE status = 'kazanildi') as kazanildi,
        COUNT(*) FILTER (WHERE status = 'kaybedildi') as kaybedildi,
        COUNT(*) FILTER (WHERE status = 'iptal') as iptal
      FROM tender_tracking
      ${whereClause}
    `,
      params
    );

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
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
    const docsResult = await query(
      `
      SELECT 
        id, original_filename, doc_type, processing_status, 
        analysis_result, extracted_text
      FROM documents 
      WHERE tender_id = $1 
        AND analysis_result IS NOT NULL
      ORDER BY doc_type, created_at
    `,
      [tenderId]
    );

    // İhale bilgilerini çek
    const tenderResult = await query(
      `
      SELECT id, title, organization_name, tender_date, city, 
             estimated_cost, external_id, url
      FROM tenders WHERE id = $1
    `,
      [tenderId]
    );

    if (tenderResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'İhale bulunamadı' });
    }

    const tender = tenderResult.rows[0];
    const documents = docsResult.rows;

    // Gizlenen notları al (kullanıcı tarafından silinen)
    const trackingResult = await query(
      `
      SELECT hidden_notes FROM tender_tracking WHERE tender_id = $1
    `,
      [tenderId]
    );
    const hiddenNotes = trackingResult.rows[0]?.hidden_notes || [];

    // Analiz sonuçlarını birleştir
    const combinedAnalysis = {
      ihale_basligi: tender.title,
      kurum: tender.organization_name,
      tarih: tender.tender_date,
      bedel: tender.estimated_cost || 'Belirtilmemiş',
      sure: '',
      teknik_sartlar: [],
      birim_fiyatlar: [],
      notlar: [], // Artık object array: { id, text, source, doc_id, verified }
      tam_metin: '',
      iletisim: null,
      dokuman_detaylari: [], // Her dökümanın ayrı analizi
    };

    // Not ID'si için sayaç
    let noteIdCounter = 1;

    for (const doc of documents) {
      const analysis = doc.analysis_result || {};
      const sourceName = doc.original_filename || doc.doc_type || 'Bilinmeyen';

      // Her dökümanın ayrı analizini ekle
      combinedAnalysis.dokuman_detaylari.push({
        id: doc.id,
        filename: doc.original_filename,
        doc_type: doc.doc_type,
        status: doc.processing_status,
        analysis: analysis,
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

      // Teknik şartları birleştir (kaynak bilgisiyle)
      // Hem Claude formatı (teknik_sartlar) hem Gemini formatı (technical_specs) destekleniyor
      const teknikSartlarSource = analysis.teknik_sartlar || analysis.technical_specs || [];
      if (Array.isArray(teknikSartlarSource)) {
        for (const sart of teknikSartlarSource) {
          const sartText = typeof sart === 'string' ? sart : sart.text || String(sart);
          combinedAnalysis.teknik_sartlar.push({
            text: sartText,
            source: sourceName,
            doc_id: doc.id,
          });
        }
      }

      // Birim fiyatları birleştir - object olanları önce, string olanları sonra
      // Hem Claude formatı (birim_fiyatlar) hem Gemini formatı (unit_prices) destekleniyor
      const birimFiyatlarSource = analysis.birim_fiyatlar || analysis.unit_prices || [];
      if (Array.isArray(birimFiyatlarSource)) {
        for (const item of birimFiyatlarSource) {
          // Object formatındaki birim fiyatları (kalem, miktar, birim_fiyat içerenler)
          if (typeof item === 'object' && item !== null && (item.kalem || item.name || item.description)) {
            // Başa ekle (öncelikli)
            combinedAnalysis.birim_fiyatlar.unshift({
              kalem: item.kalem || item.name || item.description,
              miktar: item.miktar || item.quantity,
              birim: item.birim || item.unit,
              fiyat: item.fiyat || item.tutar || item.price || item.amount,
              source: sourceName,
              doc_id: doc.id,
            });
          } else if (typeof item === 'string') {
            // String formatındaki açıklamaları sona ekle
            combinedAnalysis.birim_fiyatlar.push({ text: item, source: sourceName, doc_id: doc.id });
          }
        }
      }

      // Notları birleştir (kaynak bilgisiyle)
      // Hem Claude formatı (notlar) hem Gemini formatı (important_notes) destekleniyor
      const notlarSource = analysis.notlar || analysis.important_notes || [];
      if (Array.isArray(notlarSource)) {
        for (const not of notlarSource) {
          const noteText = typeof not === 'string' ? not : not.text || String(not);
          const noteId = `note_${doc.id}_${noteIdCounter++}`;

          // Gizlenen notları atla
          if (hiddenNotes.includes(noteId) || hiddenNotes.includes(noteText)) {
            continue;
          }

          combinedAnalysis.notlar.push({
            id: noteId,
            text: noteText,
            source: sourceName,
            doc_id: doc.id,
            verified: false,
          });
        }
      }

      // Tam metinleri birleştir
      if (analysis.tam_metin) {
        combinedAnalysis.tam_metin += `\n\n--- ${doc.original_filename} ---\n${analysis.tam_metin}`;
      }
    }

    // Teknik şartları: tüm şartlar gösterilsin (unique filtreleme yok)
    // İhale Listesi analizi ile aynı sayılar gösterilecek
    // String formatındakileri object'e çevir
    combinedAnalysis.teknik_sartlar = combinedAnalysis.teknik_sartlar.map((sart) =>
      typeof sart === 'string' ? { text: sart, source: 'Bilinmeyen' } : sart
    );

    // Birim fiyatları: tüm kalemler gösterilsin (unique filtreleme yok)
    // İhale Listesi analizi ile aynı sayılar gösterilecek

    // Notları: tüm notlar gösterilsin (unique filtreleme yok)
    // İhale Listesi analizi ile aynı sayılar gösterilecek
    combinedAnalysis.tam_metin = combinedAnalysis.tam_metin.trim();

    // Döküman istatistikleri (ZIP dosyaları hariç - analiz edilemezler)
    // analysis_result dolu olan dökümanları da "completed" say (status güncellenmemiş olabilir)
    const totalDocs = await query(
      `
      SELECT COUNT(*) as total, 
             COUNT(*) FILTER (WHERE 
               processing_status = 'completed' 
               OR (analysis_result IS NOT NULL AND analysis_result::text NOT IN ('{}', 'null', ''))
             ) as completed,
             COUNT(*) FILTER (WHERE processing_status = 'failed' AND (analysis_result IS NULL OR analysis_result::text IN ('{}', 'null', ''))) as failed,
             COUNT(*) FILTER (WHERE processing_status = 'pending' AND (analysis_result IS NULL OR analysis_result::text IN ('{}', 'null', ''))) as pending
      FROM documents 
      WHERE tender_id = $1 
        AND (file_type IS NULL OR file_type NOT LIKE '%zip%')
    `,
      [tenderId]
    );

    res.json({
      success: true,
      data: {
        tender: tender,
        analysis: combinedAnalysis,
        stats: {
          toplam_dokuman: parseInt(totalDocs.rows[0].total, 10),
          analiz_edilen: parseInt(totalDocs.rows[0].completed, 10),
          basarisiz: parseInt(totalDocs.rows[0].failed, 10),
          bekleyen: parseInt(totalDocs.rows[0].pending, 10),
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * AI Notunu gizle (sil)
 * POST /api/tender-tracking/:tenderId/hide-note
 */
router.post('/:tenderId/hide-note', async (req, res) => {
  try {
    const { tenderId } = req.params;
    const { noteId, noteText } = req.body;

    if (!noteId && !noteText) {
      return res.status(400).json({ success: false, error: 'noteId veya noteText gerekli' });
    }

    // Gizlenecek değeri belirle (ID veya text)
    const hideValue = noteId || noteText;

    // Mevcut hidden_notes'a ekle
    const result = await query(
      `
      UPDATE tender_tracking 
      SET hidden_notes = COALESCE(hidden_notes, '[]'::jsonb) || $1::jsonb,
          updated_at = NOW()
      WHERE tender_id = $2
      RETURNING hidden_notes
    `,
      [JSON.stringify([hideValue]), tenderId]
    );

    if (result.rows.length === 0) {
      // Tracking kaydı yoksa oluştur
      await query(
        `
        INSERT INTO tender_tracking (tender_id, status, hidden_notes)
        VALUES ($1, 'bekliyor', $2::jsonb)
        ON CONFLICT (tender_id, user_id) DO UPDATE 
        SET hidden_notes = COALESCE(tender_tracking.hidden_notes, '[]'::jsonb) || $2::jsonb,
            updated_at = NOW()
      `,
        [tenderId, JSON.stringify([hideValue])]
      );
    }

    res.json({
      success: true,
      message: 'Not gizlendi',
      hiddenNote: hideValue,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Gizlenen AI Notunu geri getir
 * POST /api/tender-tracking/:tenderId/unhide-note
 */
router.post('/:tenderId/unhide-note', async (req, res) => {
  try {
    const { tenderId } = req.params;
    const { noteId, noteText } = req.body;

    if (!noteId && !noteText) {
      return res.status(400).json({ success: false, error: 'noteId veya noteText gerekli' });
    }

    const unhideValue = noteId || noteText;

    // hidden_notes'dan çıkar
    const _result = await query(
      `
      UPDATE tender_tracking 
      SET hidden_notes = (
        SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
        FROM jsonb_array_elements(COALESCE(hidden_notes, '[]'::jsonb)) elem
        WHERE elem::text != $1::text
      ),
      updated_at = NOW()
      WHERE tender_id = $2
      RETURNING hidden_notes
    `,
      [JSON.stringify(unhideValue), tenderId]
    );

    res.json({
      success: true,
      message: 'Not geri getirildi',
      unhiddenNote: unhideValue,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Gizlenen notların listesini getir
 * GET /api/tender-tracking/:tenderId/hidden-notes
 */
router.get('/:tenderId/hidden-notes', async (req, res) => {
  try {
    const { tenderId } = req.params;

    const result = await query(
      `
      SELECT hidden_notes FROM tender_tracking WHERE tender_id = $1
    `,
      [tenderId]
    );

    res.json({
      success: true,
      hiddenNotes: result.rows[0]?.hidden_notes || [],
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
