import express from 'express';
import { query } from '../database.js';
import logger from '../utils/logger.js';

const router = express.Router();

// ─── Sayısal Değer Normalizasyonu Yardımcı Fonksiyonları ──────

/**
 * Metin veya sayıdan sayı çıkar.
 * "500 kişi" → 500, "1.250" → 1250, "Haftanın 7 günü..." → null
 * Çeviremezse null döner.
 */
function parseNumericValue(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return val;
  if (typeof val !== 'string') return null;
  // Türkçe binlik ayıracı (.) kaldır, ondalık (,) noktaya çevir, birim/metin temizle
  const cleaned = val
    .replace(/\./g, '')
    .replace(/,/g, '.')
    .replace(/[^\d.]/g, '');
  if (!cleaned) return null;
  const num = Number.parseFloat(cleaned);
  return Number.isNaN(num) ? null : Math.round(num);
}

/**
 * Türkçe para formatını sayıya çevir.
 * "1.250.000,00 TL" → 1250000, "750.000" → 750000
 */
function parseMoneyToNumeric(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return val;
  if (typeof val !== 'string') return null;
  const cleaned = val
    .replace(/\./g, '')
    .replace(/,/g, '.')
    .replace(/[^\d.]/g, '');
  if (!cleaned) return null;
  const num = Number.parseFloat(cleaned);
  return Number.isNaN(num) ? null : num;
}

/**
 * analysis_summary içindeki tüm sayısal alanları normalize et.
 * Metin olanları sayıya çevirir, orijinal metni _raw alanında saklar.
 * Çevrilemezse null bırakır (kullanıcı doğrulama ekranında dolduracak).
 */
function normalizeNumericFields(summary) {
  // Kişi sayıları
  const kisiAlanlari = [
    'kisi_sayisi',
    'kahvalti_kisi_sayisi',
    'ogle_kisi_sayisi',
    'aksam_kisi_sayisi',
    'diyet_kisi_sayisi',
  ];
  for (const alan of kisiAlanlari) {
    if (summary[alan] !== null && summary[alan] !== undefined) {
      const parsed = parseNumericValue(summary[alan]);
      if (typeof summary[alan] === 'string' && summary[alan].trim()) {
        summary[`${alan}_raw`] = summary[alan]; // orijinal metni sakla
      }
      summary[alan] = parsed; // null veya sayı
    }
  }

  // Gün sayıları
  if (summary.hizmet_gun_sayisi !== null && summary.hizmet_gun_sayisi !== undefined) {
    const raw = summary.hizmet_gun_sayisi;
    const parsed = parseNumericValue(raw);
    if (typeof raw === 'string' && raw.trim()) {
      summary.hizmet_gun_sayisi_raw = raw;
    }
    summary.hizmet_gun_sayisi = parsed;
  }

  // Günlük öğün sayısı
  if (summary.gunluk_ogun_sayisi !== null && summary.gunluk_ogun_sayisi !== undefined) {
    const raw = summary.gunluk_ogun_sayisi;
    const parsed = parseNumericValue(raw);
    if (typeof raw === 'string' && raw.trim()) {
      summary.gunluk_ogun_sayisi_raw = raw;
    }
    summary.gunluk_ogun_sayisi = parsed;
  }

  // Personel sayısı
  for (const alan of ['toplam_personel', 'personel_sayisi']) {
    if (summary[alan] !== null && summary[alan] !== undefined) {
      const parsed = parseNumericValue(summary[alan]);
      if (typeof summary[alan] === 'string' && summary[alan].trim()) {
        summary[`${alan}_raw`] = summary[alan];
      }
      summary[alan] = parsed;
    }
  }

  // Tahmini bedel — metin olarak bırak (gösterim), ek numeric alan ekle
  if (summary.tahmini_bedel && typeof summary.tahmini_bedel === 'string') {
    const numeric = parseMoneyToNumeric(summary.tahmini_bedel);
    if (numeric !== null) {
      summary.tahmini_bedel_numeric = numeric;
    }
  }

  // Toplam öğün sayısı
  if (summary.toplam_ogun_sayisi !== null && summary.toplam_ogun_sayisi !== undefined) {
    summary.toplam_ogun_sayisi = parseNumericValue(summary.toplam_ogun_sayisi);
  }
}

/**
 * Array öğelerine kaynak dosya bilgisi ekle (source attribution).
 * Her öğeye source ve doc_id alanları eklenir (yoksa).
 */
function addSourceToItems(items, doc) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => {
    if (typeof item === 'string') {
      return item; // string elemanları dönüştürme (is_yerleri, eksik_bilgiler)
    }
    return {
      ...item,
      source: item.source || doc.original_filename,
      doc_id: item.doc_id || doc.id,
    };
  });
}

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
 * Tekil takip kaydını getir (ihale masası sayfası için)
 * GET /api/tender-tracking/detail/:tenderId
 */
router.get('/detail/:tenderId', async (req, res) => {
  try {
    const { tenderId } = req.params;

    const sql = `
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
      WHERE tt.tender_id = $1
      ORDER BY tt.created_at DESC
      LIMIT 1
    `;

    const result = await query(sql, [parseInt(tenderId, 10)]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Takip kaydı bulunamadı' });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    logger.error('Tekil takip kaydı getirme hatası:', error);
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

    const userIdValue = user_id || null;

    // Önce mevcut kayıt var mı kontrol et (NULL user_id için ON CONFLICT çalışmıyor)
    const existingCheck = await query(
      `SELECT id FROM tender_tracking WHERE tender_id = $1 AND (user_id = $2 OR (user_id IS NULL AND $2 IS NULL))`,
      [tender_id, userIdValue]
    );

    // Yaklaşık maliyeti tenders tablosundan çek
    const tenderDataForCost = await query(`SELECT estimated_cost FROM tenders WHERE id = $1`, [tender_id]);
    const estimatedCostFromTender = tenderDataForCost.rows[0]?.estimated_cost
      ? Number(tenderDataForCost.rows[0].estimated_cost)
      : null;

    let result;
    if (existingCheck.rows.length > 0) {
      // Mevcut kaydı güncelle
      result = await query(
        `
        UPDATE tender_tracking SET
          status = COALESCE($2, status),
          notes = COALESCE($3, notes),
          priority = COALESCE($4, priority),
          analysis_summary = COALESCE($5, analysis_summary),
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
        [
          existingCheck.rows[0].id,
          status || null,
          notes || null,
          priority || null,
          analysis_summary ? JSON.stringify(analysis_summary) : null,
        ]
      );
    } else {
      // Yeni kayıt oluştur - yaklaşık maliyeti de ekle
      result = await query(
        `
        INSERT INTO tender_tracking (tender_id, user_id, status, notes, priority, analysis_summary, yaklasik_maliyet)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `,
        [
          tender_id,
          userIdValue,
          status || 'bekliyor',
          notes || null,
          priority || 0,
          analysis_summary ? JSON.stringify(analysis_summary) : null,
          estimatedCostFromTender,
        ]
      );
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

    // Eğer hesaplama_verileri varsa, mevcut veriyle merge et
    let mergedHesaplamaVerileri = null;
    if (hesaplama_verileri) {
      // Önce mevcut veriyi al
      const currentResult = await query('SELECT hesaplama_verileri FROM tender_tracking WHERE id = $1', [id]);
      const currentData = currentResult.rows[0]?.hesaplama_verileri || {};
      // Merge: mevcut veri + yeni veri (yeni veri öncelikli)
      mergedHesaplamaVerileri = { ...currentData, ...hesaplama_verileri };
    }

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
        mergedHesaplamaVerileri ? JSON.stringify(mergedHesaplamaVerileri) : null,
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
 * Döküman analizinden tespit edilen önerileri getir
 * GET /api/tender-tracking/:id/suggestions
 */
router.get('/:id/suggestions', async (req, res) => {
  try {
    const { id } = req.params;

    // Tracking kaydını al
    const trackingResult = await query(
      `SELECT tt.*, t.estimated_cost, t.title, t.organization_name
       FROM tender_tracking tt
       JOIN tenders t ON t.id = tt.tender_id::integer
       WHERE tt.id = $1`,
      [id]
    );

    if (trackingResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Kayıt bulunamadı' });
    }

    const tracking = trackingResult.rows[0];
    const tenderId = tracking.tender_id;

    // Dökümanların analiz sonuçlarını al
    const docsResult = await query(
      `SELECT id, original_filename, analysis_result
       FROM documents
       WHERE tender_id = $1
         AND processing_status = 'completed'
         AND analysis_result IS NOT NULL`,
      [tenderId]
    );

    const suggestions = [];

    // Scraper'dan gelen tahmini bedel
    if (tracking.estimated_cost && !tracking.yaklasik_maliyet) {
      suggestions.push({
        key: 'yaklasik_maliyet_scraper',
        label: 'Yaklaşık Maliyet (Scraper)',
        value: Number(tracking.estimated_cost),
        source: 'scraper',
        fieldName: 'yaklasik_maliyet',
        type: 'currency',
      });
    }

    // Döküman analizlerinden verileri topla
    let bedel = null;
    let sure = null;
    let ogunBilgileri = [];
    let teknikSartlar = [];
    let birimFiyatlar = [];

    for (const doc of docsResult.rows) {
      const analysis = doc.analysis_result;
      if (!analysis) continue;

      // Bedel (yaklaşık maliyet) - analyzer: tahmini_bedel veya bedel
      if (!bedel) {
        const rawBedel = analysis.tahmini_bedel || analysis.bedel;
        if (rawBedel) {
          const parsedBedel = parseMoneyValue(rawBedel);
          if (parsedBedel) {
            bedel = parsedBedel;
          }
        }
      }

      // İş süresi - analyzer: teslim_suresi veya sure
      if (!sure) {
        sure = analysis.teslim_suresi || analysis.sure;
      }

      // Öğün bilgileri - analyzer: ogun_bilgileri []
      if (analysis.ogun_bilgileri?.length > 0 && ogunBilgileri.length === 0) {
        ogunBilgileri = analysis.ogun_bilgileri;
      }

      // Teknik şartlar - analyzer: teknik_sartlar []
      if (analysis.teknik_sartlar?.length > 0 && teknikSartlar.length === 0) {
        teknikSartlar = analysis.teknik_sartlar;
      }

      // Birim fiyatlar - analyzer: birim_fiyatlar []
      if (analysis.birim_fiyatlar?.length > 0 && birimFiyatlar.length === 0) {
        birimFiyatlar = analysis.birim_fiyatlar;
      }
    }

    // Bedel önerisi (döküman analizinden)
    if (bedel && !tracking.yaklasik_maliyet) {
      suggestions.push({
        key: 'yaklasik_maliyet_analiz',
        label: 'Yaklaşık Maliyet',
        value: bedel,
        source: 'analiz',
        fieldName: 'yaklasik_maliyet',
        type: 'currency',
      });
    }

    // Hesaplanmış sınır değer (varsayılan katsayı: 0.85)
    const yaklasikMaliyet = bedel || tracking.yaklasik_maliyet || tracking.estimated_cost;
    if (yaklasikMaliyet && !tracking.sinir_deger) {
      const hesaplananSinirDeger = Math.round(Number(yaklasikMaliyet) * 0.85);
      suggestions.push({
        key: 'sinir_deger_hesaplama',
        label: 'Tahmini Sınır Değer (×0.85)',
        value: hesaplananSinirDeger,
        source: 'hesaplama',
        fieldName: 'sinir_deger',
        type: 'currency',
      });
    }

    // İş süresi önerisi
    if (sure) {
      suggestions.push({
        key: 'is_suresi',
        label: 'İş Süresi',
        value: sure,
        source: 'analiz',
        fieldName: 'is_suresi',
        type: 'text',
      });
    }

    // Öğün bilgileri önerisi
    if (ogunBilgileri.length > 0) {
      // Toplam öğün sayısını hesapla
      const toplamOgun = ogunBilgileri.reduce((sum, o) => sum + (Number(o.miktar) || 0), 0);
      if (toplamOgun > 0) {
        suggestions.push({
          key: 'toplam_ogun',
          label: 'Toplam Öğün Sayısı',
          value: toplamOgun,
          source: 'analiz',
          fieldName: 'toplam_ogun_sayisi',
          type: 'number',
        });
      }

      // Öğün detaylarını da ekle
      suggestions.push({
        key: 'ogun_bilgileri',
        label: 'Öğün Detayları',
        value: ogunBilgileri.map((o) => `${o.tur}: ${o.miktar} ${o.birim || ''}`).join(', '),
        source: 'analiz',
        fieldName: 'ogun_bilgileri',
        type: 'text',
      });
    }

    // Teknik şart sayısı
    if (teknikSartlar.length > 0) {
      suggestions.push({
        key: 'teknik_sart_sayisi',
        label: 'Teknik Şart Sayısı',
        value: teknikSartlar.length,
        source: 'analiz',
        fieldName: 'teknik_sart_sayisi',
        type: 'number',
      });
    }

    // Birim fiyat sayısı
    if (birimFiyatlar.length > 0) {
      suggestions.push({
        key: 'birim_fiyat_sayisi',
        label: 'Birim Fiyat Kalemi',
        value: birimFiyatlar.length,
        source: 'analiz',
        fieldName: 'birim_fiyat_sayisi',
        type: 'number',
      });
    }

    res.json({
      success: true,
      data: {
        trackingId: id,
        tenderId,
        suggestions,
        currentValues: {
          yaklasik_maliyet: tracking.yaklasik_maliyet,
          sinir_deger: tracking.sinir_deger,
          bizim_teklif: tracking.bizim_teklif,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Para değerini parse et (örn: "15.250.000 TL" -> 15250000)
function parseMoneyValue(value) {
  if (!value) return null;
  if (typeof value === 'number') return value;

  const str = String(value)
    .replace(/[^\d.,]/g, '') // Sadece rakam, nokta ve virgül
    .replace(/\./g, '') // Binlik ayracı kaldır
    .replace(',', '.'); // Ondalık ayracı düzelt

  const num = parseFloat(str);
  return Number.isNaN(num) ? null : num;
}

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
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: karmaşık iş akışı, refactor planlanıyor
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

    // Analiz özetini oluştur - TÜM AI çıktı alanlarını içerir
    // v9.0 UNIFIED PIPELINE uyumlu
    const analysisSummary = {
      // Temel bilgiler (v9: summary.* alanlarından)
      ozet: null,
      ihale_basligi: null, // v9: summary.title
      kurum: null, // v9: summary.institution
      ihale_turu: null,
      tahmini_bedel: null, // v9: summary.estimated_value
      teslim_suresi: null, // v9: summary.duration
      ikn: null, // v9: summary.ikn
      // Catering bilgileri (v9: catering.* alanlarından)
      gunluk_ogun_sayisi: null, // v9: catering.daily_meals
      kisi_sayisi: null, // v9: catering.total_persons
      gramaj: [], // v9: catering.gramaj
      gramaj_gruplari: [], // yemek bazlı gruplanmış gramaj
      // ═══ Azure v5 Catering-Spesifik Alanlar ═══
      kahvalti_kisi_sayisi: null,
      ogle_kisi_sayisi: null,
      aksam_kisi_sayisi: null,
      diyet_kisi_sayisi: null,
      hizmet_gun_sayisi: null,
      mutfak_tipi: null,
      servis_tipi: null,
      et_tipi: null,
      yemek_cesit_sayisi: null,
      yemek_pisirilecek_yer: null,
      iscilik_orani: null,
      dagitim_saatleri: null,
      kalite_standartlari: null,
      gida_guvenligi_belgeleri: null,
      dagitim_noktalari: null,
      ekipman_listesi: null,
      malzeme_listesi: null,
      ogun_dagilimi: null,
      birim_fiyat_cetveli: null,
      menu_tablosu: null,
      // Personel bilgileri (v9: personnel.* alanlarından)
      toplam_personel: null, // v9: personnel.total_count
      // Listeler
      teknik_sartlar: [],
      birim_fiyatlar: [],
      takvim: [], // v9: dates.all_dates da buraya eklenir
      onemli_notlar: [],
      eksik_bilgiler: [],
      notlar: [],
      // Yeni detaylı alanlar
      personel_detaylari: [], // v9: personnel.staff
      ogun_bilgileri: [], // v9: catering.meals / sample_menus
      is_yerleri: [],
      ceza_kosullari: [], // v9: penalties
      gerekli_belgeler: [], // v9: required_documents
      mali_kriterler: {},
      fiyat_farki: {},
      teminat_oranlari: {},
      servis_saatleri: {},
      iletisim: {}, // v9: contact
      sinir_deger_katsayisi: null,
      benzer_is_tanimi: null,
      // Tam metin (tüm dökümanlardan birleştirilmiş)
      tam_metin: '',
      // Meta
      pipeline_version: '9.0',
      documents_count: analysisResult.rows.length,
      document_details: [],
    };

    for (const doc of analysisResult.rows) {
      if (doc.analysis_result) {
        const rawAnalysis =
          typeof doc.analysis_result === 'string' ? JSON.parse(doc.analysis_result) : doc.analysis_result;

        // ═══════════════════════════════════════════════════════════════
        // v9.0 UNIFIED PIPELINE MAPPING
        // Pipeline nested yapısını (summary, catering, personnel, dates)
        // frontend'in beklediği flat yapıya dönüştür
        // ═══════════════════════════════════════════════════════════════

        // v9.0 formatında "analysis" içinde nested olabilir
        const analysis = rawAnalysis.analysis || rawAnalysis;

        // Döküman detayını kaydet
        analysisSummary.document_details.push({
          id: doc.id,
          filename: doc.original_filename,
          doc_type: doc.doc_type,
          pipeline_version: rawAnalysis.pipeline_version || 'unknown',
          provider: rawAnalysis.provider || rawAnalysis.meta?.provider_used,
        });

        // ═══════════════════════════════════════════════════════════════
        // SUMMARY MAPPING (v9.0: analysis.summary → flat alanlar)
        // ═══════════════════════════════════════════════════════════════

        // Özet (en uzun/kapsamlı olanı kullan - birleştirme tutarsız sayılara yol açıyor)
        const ozet = analysis.ozet || analysis.summary?.description;
        if (ozet) {
          if (!analysisSummary.ozet || ozet.length > analysisSummary.ozet.length) {
            analysisSummary.ozet = ozet;
          }
        }

        // İhale başlığı (v9: summary.title)
        const ihaleBasligi = analysis.ihale_basligi || analysis.summary?.title;
        if (ihaleBasligi && !analysisSummary.ihale_basligi) {
          analysisSummary.ihale_basligi = ihaleBasligi;
        }

        // Kurum (v9: summary.institution)
        const kurum = analysis.kurum || analysis.summary?.institution;
        if (kurum && !analysisSummary.kurum) {
          analysisSummary.kurum = kurum;
        }

        // İhale türü (ilk bulunan)
        const ihaleTuru = analysis.ihale_turu || analysis.summary?.tender_type;
        if (ihaleTuru && !analysisSummary.ihale_turu) {
          analysisSummary.ihale_turu = ihaleTuru;
        }

        // Tahmini bedel (v9: summary.estimated_value veya tahmini_bedel alanı)
        const tahminiBedel = analysis.tahmini_bedel || analysis.summary?.estimated_value || analysis.summary?.budget;
        if (tahminiBedel && tahminiBedel !== 'Belirtilmemiş' && !analysisSummary.tahmini_bedel) {
          analysisSummary.tahmini_bedel = tahminiBedel;
        }

        // Teslim süresi (v9: summary.duration veya dates.duration_days)
        const teslimSuresi =
          analysis.teslim_suresi ||
          analysis.summary?.duration ||
          (analysis.dates?.duration_days ? `${analysis.dates.duration_days} gün` : null);
        if (teslimSuresi && !analysisSummary.teslim_suresi) {
          analysisSummary.teslim_suresi = teslimSuresi;
        }

        // ═══════════════════════════════════════════════════════════════
        // CATERING MAPPING (v9: analysis.catering → flat alanlar)
        // ═══════════════════════════════════════════════════════════════

        // Kişi sayısı (v9: catering.total_persons)
        const kisiSayisi = analysis.kisi_sayisi || analysis.catering?.total_persons || analysis.catering?.person_count;
        if (kisiSayisi && !analysisSummary.kisi_sayisi) {
          analysisSummary.kisi_sayisi = kisiSayisi;
        }

        // Günlük öğün sayısı (v9: catering.daily_meals)
        const gunlukOgun =
          analysis.gunluk_ogun_sayisi || analysis.catering?.daily_meals || analysis.catering?.daily_meal_count;
        if (gunlukOgun && !analysisSummary.gunluk_ogun_sayisi) {
          analysisSummary.gunluk_ogun_sayisi = gunlukOgun;
        }

        // Öğün bilgileri (v9: catering.meals veya catering.sample_menus)
        const ogunBilgileri = analysis.ogun_bilgileri || analysis.catering?.meals || analysis.catering?.sample_menus;
        if (ogunBilgileri && Array.isArray(ogunBilgileri)) {
          analysisSummary.ogun_bilgileri.push(...addSourceToItems(ogunBilgileri, doc));
        }

        // Gramaj bilgileri (v9: catering.gramaj)
        const gramaj = analysis.gramaj || analysis.catering?.gramaj;
        if (gramaj && Array.isArray(gramaj)) {
          if (!analysisSummary.gramaj) analysisSummary.gramaj = [];
          analysisSummary.gramaj.push(...addSourceToItems(gramaj, doc));
        }

        // Gramaj grupları (yemek bazlı) -- prompt'tan geliyorsa al
        const gramajGruplari = analysis.gramaj_gruplari || analysis.catering?.gramaj_gruplari;
        if (gramajGruplari && Array.isArray(gramajGruplari)) {
          if (!analysisSummary.gramaj_gruplari) analysisSummary.gramaj_gruplari = [];
          analysisSummary.gramaj_gruplari.push(...addSourceToItems(gramajGruplari, doc));
        }

        // ═══════════════════════════════════════════════════════════════
        // AZURE v5 CATERİNG-SPESİFİK ALANLAR
        // ═══════════════════════════════════════════════════════════════
        const cateringFieldMap = {
          kahvalti_kisi_sayisi: analysis.catering?.breakfast_persons,
          ogle_kisi_sayisi: analysis.catering?.lunch_persons,
          aksam_kisi_sayisi: analysis.catering?.dinner_persons,
          diyet_kisi_sayisi: analysis.catering?.diet_persons,
          hizmet_gun_sayisi: analysis.catering?.service_days,
          mutfak_tipi: analysis.catering?.kitchen_type,
          servis_tipi: analysis.catering?.service_type,
          et_tipi: analysis.catering?.meat_type,
          yemek_cesit_sayisi: analysis.catering?.meal_variety,
          yemek_pisirilecek_yer: analysis.catering?.cooking_location,
          iscilik_orani: analysis.catering?.labor_rate,
          dagitim_saatleri: analysis.catering?.delivery_hours,
          kalite_standartlari: analysis.catering?.quality_standards,
          gida_guvenligi_belgeleri: analysis.catering?.food_safety_docs,
          dagitim_noktalari: analysis.catering?.distribution_points,
          ekipman_listesi: analysis.catering?.equipment_list,
          malzeme_listesi: analysis.catering?.material_list,
          ogun_dagilimi: analysis.catering?.meal_distribution,
          birim_fiyat_cetveli: analysis.catering?.unit_price_table,
          menu_tablosu: analysis.catering?.menu_table,
        };

        for (const [key, val] of Object.entries(cateringFieldMap)) {
          if (val && !analysisSummary[key]) {
            analysisSummary[key] = val;
          }
        }

        // ═══════════════════════════════════════════════════════════════
        // PERSONNEL MAPPING (v9: analysis.personnel → flat alanlar)
        // ═══════════════════════════════════════════════════════════════

        // Personel detayları (v9: personnel.staff)
        const personelDetaylari = analysis.personel_detaylari || analysis.personnel?.staff;
        if (personelDetaylari && Array.isArray(personelDetaylari)) {
          analysisSummary.personel_detaylari.push(...addSourceToItems(personelDetaylari, doc));
        }

        // Toplam personel sayısı (v9: personnel.total_count)
        const toplamPersonel = analysis.toplam_personel || analysis.personnel?.total_count;
        if (toplamPersonel && !analysisSummary.toplam_personel) {
          analysisSummary.toplam_personel = toplamPersonel;
        }

        // ═══════════════════════════════════════════════════════════════
        // DATES MAPPING (v9: analysis.dates → takvim)
        // ═══════════════════════════════════════════════════════════════

        // Başlangıç tarihi
        const startDate = analysis.dates?.start_date || analysis.baslangic_tarihi;
        if (startDate && !analysisSummary.takvim.some((t) => t.olay?.includes('Başlangıç'))) {
          analysisSummary.takvim.push({
            olay: 'İşe Başlangıç Tarihi',
            tarih: startDate,
            source: doc.original_filename,
          });
        }

        // Bitiş tarihi
        const endDate = analysis.dates?.end_date || analysis.bitis_tarihi;
        if (endDate && !analysisSummary.takvim.some((t) => t.olay?.includes('Bitiş'))) {
          analysisSummary.takvim.push({ olay: 'Sözleşme Bitiş Tarihi', tarih: endDate, source: doc.original_filename });
        }

        // İhale tarihi
        const tenderDate = analysis.dates?.tender_date || analysis.ihale_tarihi;
        if (tenderDate && !analysisSummary.takvim.some((t) => t.olay?.includes('İhale'))) {
          analysisSummary.takvim.push({ olay: 'İhale Tarihi', tarih: tenderDate, source: doc.original_filename });
        }

        // Eski format takvim
        if (analysis.takvim && Array.isArray(analysis.takvim)) {
          analysisSummary.takvim.push(...analysis.takvim);
        }

        // v9: dates.all_dates
        if (analysis.dates?.all_dates && Array.isArray(analysis.dates.all_dates)) {
          analysisSummary.takvim.push(
            ...analysis.dates.all_dates.map((d) => ({
              olay: d.event || d.olay,
              tarih: d.date || d.tarih,
              source: doc.original_filename,
            }))
          );
        }

        // ═══════════════════════════════════════════════════════════════
        // TECHNICAL REQUIREMENTS & PENALTIES (v9: technical_requirements, penalties)
        // ═══════════════════════════════════════════════════════════════

        // Teknik şartları topla
        if (analysis.teknik_sartlar) {
          analysisSummary.teknik_sartlar.push(...addSourceToItems(analysis.teknik_sartlar, doc));
        }
        if (analysis.technical_requirements && Array.isArray(analysis.technical_requirements)) {
          analysisSummary.teknik_sartlar.push(
            ...analysis.technical_requirements.map((t) =>
              typeof t === 'string'
                ? { text: t, source: doc.original_filename }
                : { ...t, source: doc.original_filename }
            )
          );
        }

        // Ceza koşulları (v9: penalties)
        if (analysis.ceza_kosullari && Array.isArray(analysis.ceza_kosullari)) {
          analysisSummary.ceza_kosullari.push(...addSourceToItems(analysis.ceza_kosullari, doc));
        }
        if (analysis.penalties && Array.isArray(analysis.penalties)) {
          analysisSummary.ceza_kosullari.push(
            ...analysis.penalties.map((p) =>
              typeof p === 'string'
                ? { text: p, source: doc.original_filename }
                : { ...p, source: doc.original_filename }
            )
          );
        }

        // Birim fiyatları topla (v9: financial.unit_prices)
        if (analysis.birim_fiyatlar) {
          analysisSummary.birim_fiyatlar.push(...addSourceToItems(analysis.birim_fiyatlar, doc));
        }
        if (analysis.unit_prices) {
          analysisSummary.birim_fiyatlar.push(...addSourceToItems(analysis.unit_prices, doc));
        }
        if (analysis.financial?.unit_prices && Array.isArray(analysis.financial.unit_prices)) {
          analysisSummary.birim_fiyatlar.push(...addSourceToItems(analysis.financial.unit_prices, doc));
        }

        // Önemli notları topla (v9: important_notes)
        if (analysis.onemli_notlar && Array.isArray(analysis.onemli_notlar)) {
          analysisSummary.onemli_notlar.push(...addSourceToItems(analysis.onemli_notlar, doc));
        }
        if (analysis.important_notes && Array.isArray(analysis.important_notes)) {
          analysisSummary.onemli_notlar.push(
            ...analysis.important_notes.map((n) =>
              typeof n === 'string'
                ? { text: n, source: doc.original_filename }
                : { ...n, source: doc.original_filename }
            )
          );
        }

        // Eksik bilgileri topla
        if (analysis.eksik_bilgiler && Array.isArray(analysis.eksik_bilgiler)) {
          analysisSummary.eksik_bilgiler.push(...analysis.eksik_bilgiler);
        }

        // Notları topla
        if (analysis.notlar) {
          analysisSummary.notlar.push(...addSourceToItems(analysis.notlar, doc));
        }
        if (analysis.notes) {
          analysisSummary.notlar.push(...addSourceToItems(analysis.notes, doc));
        }

        // ═══════════════════════════════════════════════════════════════
        // EK ALANLAR - v9.0, v9.1 doc-type prompt ve eski format uyumluluğu
        // ═══════════════════════════════════════════════════════════════

        // IKN (v9: summary.ikn, v9.1: temel_bilgiler.ikn)
        const ikn = analysis.ikn || analysis.summary?.ikn || analysis.temel_bilgiler?.ikn;
        if (ikn && !analysisSummary.ikn) {
          analysisSummary.ikn = ikn;
        }

        // ═══════════════════════════════════════════════════════════════
        // v9.1 DOC-TYPE PROMPT MAPPING (yeni prompt çıktı yapıları)
        // ═══════════════════════════════════════════════════════════════

        // Mali yeterlilik (v9.1 ilan/idari prompt: mali_yeterlilik)
        if (analysis.mali_yeterlilik && typeof analysis.mali_yeterlilik === 'object') {
          const my = analysis.mali_yeterlilik;
          const placeholders = ['bulunamadı', 'belirtilmemiş', 'bilinmiyor', ''];
          const isReal = (v) => v && !placeholders.includes(String(v).trim().toLowerCase());

          if (isReal(my.cari_oran)) analysisSummary.mali_kriterler.cari_oran = my.cari_oran;
          if (isReal(my.ozkaynak_orani)) analysisSummary.mali_kriterler.ozkaynak_orani = my.ozkaynak_orani;
          if (isReal(my.banka_borc_orani)) analysisSummary.mali_kriterler.banka_borc_orani = my.banka_borc_orani;
          if (isReal(my.toplam_ciro_orani)) analysisSummary.mali_kriterler.toplam_ciro_orani = my.toplam_ciro_orani;
          if (isReal(my.hizmet_ciro_orani)) analysisSummary.mali_kriterler.hizmet_ciro_orani = my.hizmet_ciro_orani;
        }

        // İş deneyimi (v9.1: mesleki_yeterlilik veya is_deneyimi)
        if (analysis.mesleki_yeterlilik) {
          const my = analysis.mesleki_yeterlilik;
          if (my.is_deneyimi_orani && !analysisSummary.mali_kriterler.is_deneyimi) {
            analysisSummary.mali_kriterler.is_deneyimi = `${my.is_deneyimi_orani}${my.is_deneyimi_sure ? `, son ${my.is_deneyimi_sure} yıl` : ''}`;
          }
          if (my.benzer_is_tanimi && !analysisSummary.benzer_is_tanimi) {
            analysisSummary.benzer_is_tanimi = my.benzer_is_tanimi;
          }
          if (my.kapasite_gereksinimi && !analysisSummary.kapasite_gereksinimi) {
            analysisSummary.kapasite_gereksinimi = my.kapasite_gereksinimi;
          }
          // Gerekli belgeler
          if (my.gerekli_belgeler && Array.isArray(my.gerekli_belgeler)) {
            analysisSummary.gerekli_belgeler.push(
              ...my.gerekli_belgeler.map((b) =>
                typeof b === 'string'
                  ? { belge: b, zorunlu: true, source: doc.original_filename }
                  : { ...b, source: doc.original_filename }
              )
            );
          }
        }

        // Sınır değer katsayısı (v9.1: sinir_deger.katsayi_R)
        if (analysis.sinir_deger?.katsayi_R && !analysisSummary.sinir_deger_katsayisi) {
          const sd = analysis.sinir_deger;
          analysisSummary.sinir_deger_katsayisi = sd.tur ? `${sd.katsayi_R} (${sd.tur})` : sd.katsayi_R;
        }

        // Teminat (v9.1: teminat.gecici_teminat / kesin_teminat)
        if (analysis.teminat) {
          if (analysis.teminat.gecici_teminat && !analysisSummary.teminat_oranlari.gecici) {
            analysisSummary.teminat_oranlari.gecici = analysis.teminat.gecici_teminat;
          }
          if (analysis.teminat.kesin_teminat && !analysisSummary.teminat_oranlari.kesin) {
            analysisSummary.teminat_oranlari.kesin = analysis.teminat.kesin_teminat;
          }
        }

        // Tarihler (v9.1: tarihler.ihale_tarihi vb.)
        if (analysis.tarihler) {
          const t = analysis.tarihler;
          if (t.ihale_tarihi && !analysisSummary.takvim.some((tk) => tk.olay?.includes('İhale'))) {
            analysisSummary.takvim.push({
              olay: 'İhale Tarihi',
              tarih: t.ihale_tarihi + (t.ihale_saati ? ` ${t.ihale_saati}` : ''),
              source: doc.original_filename,
            });
          }
          if (
            t.ise_baslama &&
            !analysisSummary.takvim.some((tk) => tk.olay?.includes('Başlangıç') || tk.olay?.includes('başlama'))
          ) {
            analysisSummary.takvim.push({ olay: 'İşe Başlama', tarih: t.ise_baslama, source: doc.original_filename });
          }
          if (
            t.is_bitis &&
            !analysisSummary.takvim.some((tk) => tk.olay?.includes('Bitiş') || tk.olay?.includes('bitis'))
          ) {
            analysisSummary.takvim.push({ olay: 'İş Bitiş', tarih: t.is_bitis, source: doc.original_filename });
          }
          if (t.sure && !analysisSummary.teslim_suresi) {
            analysisSummary.teslim_suresi = t.sure;
          }
          if (t.teklif_gecerlilik) {
            analysisSummary.takvim.push({
              olay: 'Teklif Geçerlilik',
              tarih: `${t.teklif_gecerlilik} gün`,
              source: doc.original_filename,
            });
          }
        }

        // İhale türü (v9.1: temel_bilgiler.teklif_turu / ihale_usulu)
        if (analysis.temel_bilgiler) {
          if (analysis.temel_bilgiler.teklif_turu && !analysisSummary.teklif_turu) {
            analysisSummary.teklif_turu = analysis.temel_bilgiler.teklif_turu;
          }
          if (analysis.temel_bilgiler.ihale_usulu && !analysisSummary.ihale_usulu) {
            analysisSummary.ihale_usulu = analysis.temel_bilgiler.ihale_usulu;
          }
          if (!analysisSummary.ihale_turu) {
            analysisSummary.ihale_turu = 'hizmet';
          }
        }

        // Sözleşme tasarısı alanları (v9.1: ceza_kosullari, odeme_kosullari, fiyat_farki, is_artisi)
        if (analysis.ceza_kosullari && Array.isArray(analysis.ceza_kosullari)) {
          analysisSummary.ceza_kosullari.push(
            ...analysis.ceza_kosullari.map((c) => ({ ...c, source: doc.original_filename }))
          );
        }
        if (analysis.odeme_kosullari && !analysisSummary.odeme_kosullari) {
          analysisSummary.odeme_kosullari = analysis.odeme_kosullari;
        }
        if (analysis.fiyat_farki && typeof analysis.fiyat_farki === 'object' && analysis.fiyat_farki.uygulanacak_mi) {
          analysisSummary.fiyat_farki = { ...(analysisSummary.fiyat_farki || {}), ...analysis.fiyat_farki };
        }
        if (analysis.is_artisi && !analysisSummary.is_artisi) {
          analysisSummary.is_artisi = analysis.is_artisi;
        }
        if (analysis.operasyonel_kurallar) {
          if (!analysisSummary.operasyonel_kurallar) analysisSummary.operasyonel_kurallar = {};
          Object.assign(analysisSummary.operasyonel_kurallar, analysis.operasyonel_kurallar);
        }

        // Miktarlar / kalemler (v9.1: miktarlar.kalemler → birim_fiyatlar)
        if (analysis.miktarlar?.kalemler && Array.isArray(analysis.miktarlar.kalemler)) {
          analysisSummary.birim_fiyatlar.push(
            ...analysis.miktarlar.kalemler.map((k) => ({ ...k, source: doc.original_filename }))
          );
        }

        // İş yerleri topla
        if (analysis.is_yerleri && Array.isArray(analysis.is_yerleri)) {
          analysisSummary.is_yerleri.push(...analysis.is_yerleri);
        }
        // v9.1: servis_bilgileri.is_yerleri
        if (analysis.servis_bilgileri?.is_yerleri && Array.isArray(analysis.servis_bilgileri.is_yerleri)) {
          analysisSummary.is_yerleri.push(...analysis.servis_bilgileri.is_yerleri);
        }

        // Gerekli belgeler topla (v9: required_documents)
        if (analysis.gerekli_belgeler && Array.isArray(analysis.gerekli_belgeler)) {
          analysisSummary.gerekli_belgeler.push(...addSourceToItems(analysis.gerekli_belgeler, doc));
        }
        if (analysis.required_documents && Array.isArray(analysis.required_documents)) {
          analysisSummary.gerekli_belgeler.push(
            ...analysis.required_documents.map((d) =>
              typeof d === 'string'
                ? { text: d, source: doc.original_filename }
                : { ...d, source: doc.original_filename }
            )
          );
        }

        // Mali kriterler (merge - placeholder değerleri filtrele)
        if (analysis.mali_kriterler && typeof analysis.mali_kriterler === 'object') {
          const placeholderValues = [
            'bulunamadı',
            'belirtilmemiş',
            'bilinmiyor',
            'yok',
            'mevcut değil',
            'istenen tutar',
            'hesaplanacak',
          ];
          for (const [key, val] of Object.entries(analysis.mali_kriterler)) {
            if (val && String(val).trim() !== '') {
              const valLower = String(val).trim().toLowerCase();
              const isPlaceholder = placeholderValues.some((p) => valLower === p || valLower.includes(p));
              // Placeholder değer mevcut gerçek değeri EZMEMELİ
              if (!isPlaceholder) {
                analysisSummary.mali_kriterler[key] = val;
              } else if (
                !analysisSummary.mali_kriterler[key] ||
                placeholderValues.some((p) => String(analysisSummary.mali_kriterler[key]).toLowerCase().includes(p))
              ) {
                // Mevcut değer de placeholder ise veya boşsa, placeholder'ı al (hiç yoktan iyidir)
                analysisSummary.mali_kriterler[key] = val;
              }
              // Aksi halde: mevcut gerçek değer korunur, placeholder ezilmez
            }
          }
        }

        // Fiyat farkı (merge)
        if (analysis.fiyat_farki && typeof analysis.fiyat_farki === 'object') {
          // Katsayıları birleştir
          if (analysis.fiyat_farki.katsayilar) {
            analysisSummary.fiyat_farki.katsayilar = {
              ...(analysisSummary.fiyat_farki.katsayilar || {}),
              ...analysis.fiyat_farki.katsayilar,
            };
          }
          // Formül (ilk bulunan)
          if (analysis.fiyat_farki.formul && !analysisSummary.fiyat_farki.formul) {
            analysisSummary.fiyat_farki.formul = analysis.fiyat_farki.formul;
          }
        }

        // Teminat oranları (merge - placeholder korumalı)
        if (analysis.teminat_oranlari && typeof analysis.teminat_oranlari === 'object') {
          const placeholderValues = [
            'bulunamadı',
            'belirtilmemiş',
            'bilinmiyor',
            'sözleşmede belirtilecek',
            'rakam ve yazıyla',
            'hesaplanacak',
          ];
          for (const [key, val] of Object.entries(analysis.teminat_oranlari)) {
            if (val && String(val).trim() !== '') {
              const valLower = String(val).trim().toLowerCase();
              const isPlaceholder = placeholderValues.some((p) => valLower === p || valLower.includes(p));
              if (!isPlaceholder) {
                analysisSummary.teminat_oranlari[key] = val;
              } else if (
                !analysisSummary.teminat_oranlari[key] ||
                placeholderValues.some((p) => String(analysisSummary.teminat_oranlari[key]).toLowerCase().includes(p))
              ) {
                analysisSummary.teminat_oranlari[key] = val;
              }
            }
          }
        }

        // Servis saatleri (merge - placeholder korumalı)
        if (analysis.servis_saatleri && typeof analysis.servis_saatleri === 'object') {
          const placeholderValues = ['belirtilmemiş', 'bilinmiyor'];
          for (const [key, val] of Object.entries(analysis.servis_saatleri)) {
            if (val && String(val).trim() !== '') {
              const valLower = String(val).trim().toLowerCase();
              const isPlaceholder = placeholderValues.some((p) => valLower === p);
              if (!isPlaceholder) {
                analysisSummary.servis_saatleri[key] = val;
              } else if (!analysisSummary.servis_saatleri[key]) {
                analysisSummary.servis_saatleri[key] = val;
              }
            }
          }
        }

        // İletişim bilgileri (v9: contact veya iletisim) - placeholder korumalı
        const iletisim = analysis.iletisim || analysis.contact;
        if (iletisim && typeof iletisim === 'object') {
          const iletisimPlaceholders = [
            '0xxx xxx xx xx',
            'email@domain.com',
            'xxx@domain.com',
            'tam adres',
            'ad soyad',
            'belirtilmemiş',
            'bilinmiyor',
            '[telefon]',
            '[email]',
            '[adres]',
          ];
          for (const [key, val] of Object.entries(iletisim)) {
            if (val && val?.trim?.() !== '') {
              const valLower = String(val).trim().toLowerCase();
              const isPlaceholder = iletisimPlaceholders.some((p) => valLower === p);
              if (!isPlaceholder) {
                // Gerçek değer - mevcut placeholder'ı ezer
                analysisSummary.iletisim[key] = val;
              } else if (
                !analysisSummary.iletisim[key] ||
                iletisimPlaceholders.some((p) => String(analysisSummary.iletisim[key]).toLowerCase() === p)
              ) {
                // Mevcut de placeholder veya boşsa, yeni placeholder'ı al
                analysisSummary.iletisim[key] = val;
              }
              // Aksi halde: mevcut gerçek değer korunur
            }
          }
        }

        // Sınır değer katsayısı (ilk bulunan)
        if (analysis.sinir_deger_katsayisi && !analysisSummary.sinir_deger_katsayisi) {
          analysisSummary.sinir_deger_katsayisi = analysis.sinir_deger_katsayisi;
        }

        // Benzer iş tanımı (ilk bulunan)
        if (analysis.benzer_is_tanimi && !analysisSummary.benzer_is_tanimi) {
          analysisSummary.benzer_is_tanimi = analysis.benzer_is_tanimi;
        }

        // Tam metni topla (her döküman için ayrı başlık ile)
        // ham_metin = extracted raw text, tam_metin = AI özeti
        const docText = analysis.ham_metin || analysis.tam_metin || analysis.full_text || analysis.extracted_text;
        if (docText?.trim() && docText.trim().length > 50) {
          const separator = analysisSummary.tam_metin ? '\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' : '';
          const header = `📄 ${doc.original_filename}\n[${doc.doc_type || 'Döküman'}]\n\n`;
          analysisSummary.tam_metin += separator + header + docText.trim();
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // PROFESYONEL DEDUPE: Veri kaybı olmadan tekrarları temizle
    // ═══════════════════════════════════════════════════════════════

    // Normalize fonksiyonu (karşılaştırma + dedup için, tutarlı Türkçe normalizasyon)
    const normalizeForCompare = (text) => {
      // Önce büyük Türkçe harfleri dönüştür, sonra toLowerCase
      const preLower = (text || '').replace(/İ/g, 'i').replace(/I/g, 'ı');
      return preLower
        .toLowerCase()
        .replace(/ı/g, 'i')
        .replace(/ğ/g, 'g')
        .replace(/ü/g, 'u')
        .replace(/ş/g, 's')
        .replace(/ö/g, 'o')
        .replace(/ç/g, 'c')
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    };

    // 1. TAKVİM - Aynı olay adını normalize ederek kontrol et
    const takvimMap = new Map();
    analysisSummary.takvim.forEach((item) => {
      const key = normalizeForCompare(item.olay);
      const existing = takvimMap.get(key);
      if (!existing) {
        takvimMap.set(key, item);
      } else {
        // Daha detaylı olan veya tarih içeren versiyonu tut
        if (item.tarih && (!existing.tarih || item.tarih.length > existing.tarih.length)) {
          takvimMap.set(key, item);
        }
      }
    });
    analysisSummary.takvim = Array.from(takvimMap.values());

    // 2. TEKNİK ŞARTLAR - Normalize ederek karşılaştır
    const teknikMap = new Map();
    analysisSummary.teknik_sartlar.forEach((item) => {
      const text = typeof item === 'string' ? item : item.madde || '';
      const key = normalizeForCompare(text);
      if (key.length < 10) return; // Çok kısa olanları atla

      const existing = teknikMap.get(key);
      if (!existing) {
        teknikMap.set(key, item);
      } else {
        // Daha detaylı olanı tut (daha uzun metin veya daha fazla alan)
        const existingText = typeof existing === 'string' ? existing : existing.madde || '';
        if (text.length > existingText.length) {
          teknikMap.set(key, item);
        }
      }
    });
    analysisSummary.teknik_sartlar = Array.from(teknikMap.values());

    // 3. BİRİM FİYATLAR - kalem+birim kombinasyonuna göre, farklı miktarları koru
    const birimMap = new Map();
    analysisSummary.birim_fiyatlar.forEach((item) => {
      const kalemNorm = normalizeForCompare(item.kalem);
      const birimNorm = normalizeForCompare(item.birim || '');
      const miktarStr = String(item.miktar || '').replace(/[^\d]/g, '');

      // Anahtar: kalem + birim + miktar (farklı miktarlar farklı kalemler)
      const key = `${kalemNorm}|${birimNorm}|${miktarStr}`;

      if (!birimMap.has(key)) {
        birimMap.set(key, item);
      } else {
        // Daha detaylı olanı tut (fiyat bilgisi olan)
        const existing = birimMap.get(key);
        if (item.birim_fiyat && !existing.birim_fiyat) {
          birimMap.set(key, item);
        } else if (item.toplam && !existing.toplam) {
          birimMap.set(key, item);
        }
      }
    });
    analysisSummary.birim_fiyatlar = Array.from(birimMap.values());

    // 4. ÖNEMLİ NOTLAR - Normalize ederek karşılaştır
    const notlarMap = new Map();
    analysisSummary.onemli_notlar.forEach((item) => {
      const text = typeof item === 'string' ? item : item.not || '';
      const key = normalizeForCompare(text);
      if (key.length < 10) return; // Çok kısa olanları atla

      if (!notlarMap.has(key)) {
        notlarMap.set(key, item);
      } else {
        // Daha detaylı olanı tut
        const existing = notlarMap.get(key);
        const existingText = typeof existing === 'string' ? existing : existing.not || '';
        if (text.length > existingText.length) {
          notlarMap.set(key, item);
        }
      }
    });
    analysisSummary.onemli_notlar = Array.from(notlarMap.values());

    // 5. EKSİK BİLGİLER - Birebir aynı olanları temizle
    analysisSummary.eksik_bilgiler = [...new Set(analysisSummary.eksik_bilgiler)];

    // 6. İŞ YERLERİ - Birebir aynı olanları temizle
    analysisSummary.is_yerleri = [...new Set(analysisSummary.is_yerleri)];

    // 7. PERSONEL DETAYLARI - Pozisyona göre dedupe, en detaylıyı tut
    const personelMap = new Map();
    analysisSummary.personel_detaylari.forEach((item) => {
      const key = normalizeForCompare(item.pozisyon);
      const existing = personelMap.get(key);
      if (!existing) {
        personelMap.set(key, item);
      } else if (item.adet && (!existing.adet || item.adet > existing.adet)) {
        personelMap.set(key, item);
      }
    });
    analysisSummary.personel_detaylari = Array.from(personelMap.values());

    // 8. ÖĞÜN BİLGİLERİ - Öğün türüne göre dedupe
    const ogunMap = new Map();
    analysisSummary.ogun_bilgileri.forEach((item) => {
      const key = normalizeForCompare(item.tur);
      const existing = ogunMap.get(key);
      if (!existing) {
        ogunMap.set(key, item);
      } else if (item.miktar && (!existing.miktar || item.miktar > existing.miktar)) {
        ogunMap.set(key, item);
      }
    });
    analysisSummary.ogun_bilgileri = Array.from(ogunMap.values());

    // 9. CEZA KOŞULLARI - Türe göre dedupe
    const cezaMap = new Map();
    analysisSummary.ceza_kosullari.forEach((item) => {
      const key = normalizeForCompare(item.tur);
      if (!cezaMap.has(key)) {
        cezaMap.set(key, item);
      }
    });
    analysisSummary.ceza_kosullari = Array.from(cezaMap.values());

    // 10. GEREKLİ BELGELER - Belge adına göre dedupe
    const belgeMap = new Map();
    analysisSummary.gerekli_belgeler.forEach((item) => {
      const key = normalizeForCompare(typeof item === 'string' ? item : item.belge);
      if (!belgeMap.has(key)) {
        belgeMap.set(key, item);
      }
    });
    analysisSummary.gerekli_belgeler = Array.from(belgeMap.values());

    // ═══════════════════════════════════════════════════════════════
    // POST-PROCESSING KONSOLİDASYON
    // Ham veri tablolarda zaten var → doğru yapısal alanlara yönlendir
    // ═══════════════════════════════════════════════════════════════

    // 0. OCR ARTEFAKT TEMİZLİĞİ (Azure Document Intelligence artıkları)
    function cleanOcrArtifacts(value) {
      if (typeof value === 'string') {
        return value
          .replace(/:unselected:/g, '')
          .replace(/:selected:/g, '')
          .replace(/\n+/g, ' ')
          .replace(/^\.\s+/g, '') // Başta gereksiz nokta: ". 35.000" → "35.000"
          .trim();
      }
      if (Array.isArray(value)) {
        return value.map(cleanOcrArtifacts);
      }
      if (value && typeof value === 'object') {
        const cleaned = {};
        for (const [k, v] of Object.entries(value)) {
          cleaned[k] = cleanOcrArtifacts(v);
        }
        return cleaned;
      }
      return value;
    }

    // Tüm array ve object alanlarındaki OCR artefaktlarını temizle
    const ocrCleanFields = [
      'ogun_bilgileri',
      'teknik_sartlar',
      'onemli_notlar',
      'birim_fiyatlar',
      'ceza_kosullari',
      'gerekli_belgeler',
      'personel_detaylari',
      'gramaj',
      'gramaj_gruplari',
      'takvim',
      'is_yerleri',
      'notlar',
      'eksik_bilgiler',
      'mali_kriterler',
      'teminat_oranlari',
      'servis_saatleri',
      'iletisim',
      'fiyat_farki',
      'odeme_kosullari',
      'operasyonel_kurallar',
    ];
    for (const field of ocrCleanFields) {
      if (analysisSummary[field]) {
        analysisSummary[field] = cleanOcrArtifacts(analysisSummary[field]);
      }
    }

    // 1. ÖĞÜN TABLOLARINDAN LOKASYON + TOPLAM ÖĞÜN ÇIKARMA
    if (analysisSummary.ogun_bilgileri && analysisSummary.ogun_bilgileri.length > 0) {
      for (const tablo of analysisSummary.ogun_bilgileri) {
        // Sadece tablo formatındaki verileri işle (rows + headers olan)
        if (!tablo.rows || !tablo.headers) continue;

        const headersNorm = tablo.headers.map((h) => normalizeForCompare(h));

        // Bu bir öğün dağılım tablosu mu? (kolonlarda kahvaltı, yemek, öğün, diyet vs.)
        const ogunKeywords = ['kahvalti', 'yemek', 'ogun', 'diyet', 'ara ogun', 'rejim'];
        const isOgunTablosu = headersNorm.some((h) => ogunKeywords.some((kw) => h.includes(kw)));
        if (!isOgunTablosu) continue;

        for (const row of tablo.rows) {
          if (!row || row.length === 0) continue;
          const firstCol = String(row[0] || '').trim();
          const firstColNorm = normalizeForCompare(firstCol);

          // TOPLAM satırından toplam öğün sayısını çıkar
          if (firstColNorm === 'toplam') {
            // Son kolon genelde TOPLAM kolonu, ya da headers'ta "toplam" olan kolon
            const toplamIdx = headersNorm.indexOf('toplam');
            const toplamVal = toplamIdx >= 0 ? row[toplamIdx] : row[row.length - 1];
            const toplamSayi = parseInt(String(toplamVal || '').replace(/[^\d]/g, ''), 10);

            if (toplamSayi && !analysisSummary.toplam_ogun_sayisi) {
              analysisSummary.toplam_ogun_sayisi = toplamSayi;
            }
            continue; // TOPLAM satırını lokasyon olarak ekleme
          }

          // İlk kolondan lokasyon isimlerini çıkar → is_yerleri'ne ekle
          if (firstCol.length > 3 && !firstCol.match(/^\d+$/)) {
            const zatenVar = analysisSummary.is_yerleri.some(
              (iy) => normalizeForCompare(typeof iy === 'string' ? iy : iy.isim || iy.ad || '') === firstColNorm
            );
            if (!zatenVar) {
              analysisSummary.is_yerleri.push(firstCol);
            }
          }
        }
      }
    }

    // 2. İLETİŞİM ADRESİNDEN LOKASYONLARI ÇIKAR (is_yerleri hâlâ boşsa)
    if (analysisSummary.iletisim?.adres && analysisSummary.is_yerleri.length === 0) {
      const adres = analysisSummary.iletisim.adres;
      const parcalar = adres
        .split(',')
        .map((p) => p.trim())
        .filter((p) => p.length > 5);

      const lokasyonKeywords = [
        'hastane',
        'adsm',
        'trsm',
        'poliklinik',
        'mudurlugu',
        'baskanligi',
        'universitesi',
        'ek hizmet',
        'eah',
        'dante',
        'badem',
        'semt poliklinigi',
      ];

      for (const parca of parcalar) {
        const parcaNorm = normalizeForCompare(parca);
        const isLokasyon = lokasyonKeywords.some((kw) => parcaNorm.includes(kw));
        if (isLokasyon) {
          const zatenVar = analysisSummary.is_yerleri.some(
            (iy) => normalizeForCompare(typeof iy === 'string' ? iy : iy.isim || iy.ad || '') === parcaNorm
          );
          if (!zatenVar) {
            analysisSummary.is_yerleri.push(parca);
          }
        }
      }
    }

    // 3. PERSONEL DETAYLARINDAN → TOPLAM ÇIKAR + LOKASYON GİRİŞLERİNİ TEMİZLE
    if (analysisSummary.personel_detaylari && analysisSummary.personel_detaylari.length > 0) {
      const temizPersonel = [];

      // is_yerleri'ndeki lokasyon isimlerini normalize set'e al (karşılaştırma için)
      const lokasyonNormSet = new Set(
        analysisSummary.is_yerleri.map((iy) =>
          normalizeForCompare(typeof iy === 'string' ? iy : iy.isim || iy.ad || '')
        )
      );

      const lokasyonIpuclari = [
        'hastane',
        'eah',
        'adsm',
        'trsm',
        'mudurlugu',
        'baskanligi',
        'universitesi',
        'poliklinik',
        'ek hizmet',
      ];

      for (const p of analysisSummary.personel_detaylari) {
        const pozNorm = normalizeForCompare(p.pozisyon || '');

        // TOPLAM satırından toplam personel sayısını çıkar
        if (pozNorm === 'toplam') {
          const toplamAdet = parseInt(String(p.adet || '').replace(/[^\d]/g, ''), 10);
          if (toplamAdet && !analysisSummary.toplam_personel) {
            analysisSummary.toplam_personel = toplamAdet;
          }
          if (toplamAdet) {
            analysisSummary.personel_sayisi = toplamAdet;
          }
          continue; // TOPLAM'ı personel listesinde tutma
        }

        // Lokasyon isimlerini personel listesinden çıkar
        // İpuçları: hastane, EAH, ADSM, müdürlük + adet=1 veya adet yok
        const isLokasyonKeyword = lokasyonIpuclari.some((kw) => pozNorm.includes(kw));
        const isLokasyonFromTable = lokasyonNormSet.has(pozNorm);

        if ((isLokasyonKeyword || isLokasyonFromTable) && (p.adet === 1 || p.adet === '1' || !p.adet)) {
          // Lokasyonu is_yerleri'ne ekle (zaten yoksa)
          if (!lokasyonNormSet.has(pozNorm)) {
            analysisSummary.is_yerleri.push(p.pozisyon);
            lokasyonNormSet.add(pozNorm);
          }
          continue; // Lokasyonu personel listesinde tutma
        }

        temizPersonel.push(p);
      }

      analysisSummary.personel_detaylari = temizPersonel;
    }

    // 4. KİŞİ SAYISI HESAPLAMA
    if (!analysisSummary.kisi_sayisi || analysisSummary.kisi_sayisi === 'Belirtilmemiş') {
      const kahvalti = parseInt(String(analysisSummary.kahvalti_kisi_sayisi || '0').replace(/[^\d]/g, ''), 10);
      const ogle = parseInt(String(analysisSummary.ogle_kisi_sayisi || '0').replace(/[^\d]/g, ''), 10);
      const aksam = parseInt(String(analysisSummary.aksam_kisi_sayisi || '0').replace(/[^\d]/g, ''), 10);

      if (kahvalti || ogle || aksam) {
        analysisSummary.kisi_sayisi = Math.max(kahvalti, ogle, aksam);
      }
    }

    // 5. GÜNLÜK ÖĞÜN SAYISI (toplam öğün / hizmet gün sayısından)
    if (!analysisSummary.gunluk_ogun_sayisi || analysisSummary.gunluk_ogun_sayisi === 'Belirtilmemiş') {
      if (analysisSummary.toplam_ogun_sayisi && analysisSummary.hizmet_gun_sayisi) {
        const toplamOgun = parseInt(String(analysisSummary.toplam_ogun_sayisi).replace(/[^\d]/g, ''), 10);
        const gunSayisi = parseInt(String(analysisSummary.hizmet_gun_sayisi).replace(/[^\d]/g, ''), 10);
        if (toplamOgun && gunSayisi) {
          analysisSummary.gunluk_ogun_sayisi = Math.round(toplamOgun / gunSayisi);
        }
      }
    }

    // 6. İŞ YERLERİ SON TEMİZLİK (konsolidasyon sonrası tekrar dedupe)
    analysisSummary.is_yerleri = [...new Set(analysisSummary.is_yerleri)];

    // normalizeText = normalizeForCompare (birleştirildi, tutarlı Türkçe normalizasyon)
    const normalizeText = normalizeForCompare;

    // Bulunan verilere göre "eksik" olmayan bilgileri çıkar
    // Bu şekilde veri kaybı olmaz, sadece gerçekten bulunanlar filtrelenir
    const bulunanBilgiler = [];

    // ─── Yapısal veri alanlarını doğrudan kontrol et ───
    if (analysisSummary.ogun_bilgileri && analysisSummary.ogun_bilgileri.length > 0) {
      bulunanBilgiler.push('gunluk ogun say', 'ogun say', 'ogun bilgi', 'gunluk yemek', 'kapasite');
    }
    if (analysisSummary.gunluk_ogun_sayisi) {
      bulunanBilgiler.push('gunluk ogun say', 'ogun say');
    }
    if (analysisSummary.kisi_sayisi) {
      bulunanBilgiler.push('kisi say', 'toplam kisi');
    }
    if (analysisSummary.kahvalti_kisi_sayisi || analysisSummary.ogle_kisi_sayisi || analysisSummary.aksam_kisi_sayisi) {
      bulunanBilgiler.push('kisi say', 'toplam kisi');
    }
    if (analysisSummary.is_yerleri && analysisSummary.is_yerleri.length > 0) {
      bulunanBilgiler.push('is yer', 'lokasyon', 'isyeri adres', 'calisma kosul', 'teslim yer');
    }
    if (analysisSummary.personel_detaylari && analysisSummary.personel_detaylari.length > 0) {
      bulunanBilgiler.push('personel detay', 'personel', 'personel nitelik', 'personel say');
    }
    if (analysisSummary.personel_sayisi) {
      bulunanBilgiler.push('personel say', 'personel');
    }
    if (analysisSummary.iletisim && Object.keys(analysisSummary.iletisim).length > 0) {
      bulunanBilgiler.push('iletisim bilgi', 'iletisim', 'telefon', 'email', 'adres', 'yetkili');
    }
    if (analysisSummary.servis_saatleri && Object.keys(analysisSummary.servis_saatleri).length > 0) {
      bulunanBilgiler.push('servis saat', 'dagitim saat', 'yemek saat');
    }
    if (analysisSummary.mali_kriterler && Object.keys(analysisSummary.mali_kriterler).length > 0) {
      bulunanBilgiler.push('mali kriter', 'mali yeterli', 'cari oran', 'ozkaynak', 'ciro');
    }
    if (analysisSummary.gerekli_belgeler && analysisSummary.gerekli_belgeler.length > 0) {
      bulunanBilgiler.push('gerekli belge', 'belge liste', 'istenen belge');
    }

    // Takvimde bulunan bilgileri kontrol et
    if (analysisSummary.takvim && analysisSummary.takvim.length > 0) {
      analysisSummary.takvim.forEach((t) => {
        const olay = normalizeText(t.olay);
        if (olay.includes('ihale') && t.tarih) {
          bulunanBilgiler.push('ihale tarihi', 'ihale tarih', 'basvuru son tarih');
          // Saat bilgisi varsa onu da ekle
          if (t.tarih && (t.tarih.includes(':') || olay.includes('saat'))) {
            bulunanBilgiler.push('saat bilgi', 'ihalenin saat');
          }
        }
        if (olay.includes('teklif') && t.tarih) bulunanBilgiler.push('son teklif', 'teklif verme', 'teklif gecerlilik');
        if ((olay.includes('basla') || olay.includes('baslangic')) && t.tarih)
          bulunanBilgiler.push('baslangic tarih', 'baslama tarih', 'isin baslama', 'ise baslama');
        if (olay.includes('sozlesme') && t.tarih) bulunanBilgiler.push('sozlesme sur', 'sozlesme imza');
        if (olay.includes('teminat') && t.tarih) bulunanBilgiler.push('teminat', 'kesin teminat');
        if (olay.includes('teslim') && t.tarih) bulunanBilgiler.push('teslim', 'isyeri teslim');
      });
    }

    // Birim fiyatlarda bulunan bilgileri kontrol et
    if (analysisSummary.birim_fiyatlar && analysisSummary.birim_fiyatlar.length > 0) {
      bulunanBilgiler.push('birim fiyat', 'detayli birim fiyat', 'ogun birim fiyat', 'toplam tutar');
    }

    // Teknik şartlarda bulunan bilgileri kontrol et
    if (analysisSummary.teknik_sartlar && analysisSummary.teknik_sartlar.length > 0) {
      bulunanBilgiler.push('teknik sartname');
      // Personel, teminat gibi bilgiler teknik şartlarda olabilir
      analysisSummary.teknik_sartlar.forEach((ts) => {
        const madde = normalizeText(typeof ts === 'string' ? ts : ts.madde);
        if (madde.includes('personel')) bulunanBilgiler.push('personel', 'personel nitelik');
        if (madde.includes('teminat'))
          bulunanBilgiler.push('teminat', 'kesin teminat', 'teminat miktar', 'teminat tutar');
        if (madde.includes('odeme')) bulunanBilgiler.push('odeme sart', 'odeme kosul');
        if (madde.includes('ceza')) bulunanBilgiler.push('ceza madde', 'ceza');
        if (madde.includes('teslim')) bulunanBilgiler.push('teslim yer', 'teslim');
        if (madde.includes('fiyat fark')) bulunanBilgiler.push('fiyat fark');
        if (madde.includes('yemek') && madde.includes('sayı'))
          bulunanBilgiler.push('yemek say', 'gunluk yemek', 'kapasite');
        if (madde.includes('adres') || madde.includes('isyeri')) bulunanBilgiler.push('isyeri adres', 'calisma kosul');
      });
    }

    // Önemli notlarda bulunan bilgileri kontrol et
    if (analysisSummary.onemli_notlar && analysisSummary.onemli_notlar.length > 0) {
      analysisSummary.onemli_notlar.forEach((n) => {
        const not = normalizeText(typeof n === 'string' ? n : n.not);
        if (not.includes('bedel') || not.includes('butce'))
          bulunanBilgiler.push('tahmini bedel', 'tahmini ihale bedel');
        if (not.includes('komisyon')) bulunanBilgiler.push('komisyon', 'ihale komisyon');
        if (not.includes('dosya bedel')) bulunanBilgiler.push('dosya bedel', 'ihale dosya');
        if (not.includes('idare') || not.includes('kurum'))
          bulunanBilgiler.push('idare', 'kurum', 'iletisim', 'ihaleyi yapan');
        if (not.includes('usul')) bulunanBilgiler.push('ihale usul', 'acik', 'kapali');
        if (not.includes('teminat'))
          bulunanBilgiler.push('teminat', 'kesin teminat', 'teminat miktar', 'teminat tutar');
        if (not.includes('ceza')) bulunanBilgiler.push('ceza');
        if (not.includes('teslim')) bulunanBilgiler.push('teslim');
      });
    }

    // Tüm analiz metnini birleştir (daha kapsamlı arama için)
    const tumMetin = [
      ...(analysisSummary.takvim || []).map((t) => `${t.olay || ''} ${t.tarih || ''}`),
      ...(analysisSummary.teknik_sartlar || []).map((t) => (typeof t === 'string' ? t : t.madde || '')),
      ...(analysisSummary.onemli_notlar || []).map((n) => (typeof n === 'string' ? n : n.not || '')),
      ...(analysisSummary.birim_fiyatlar || []).map((b) => `${b.kalem || ''} ${b.miktar || ''}`),
      analysisSummary.ozet || '',
    ].join(' ');
    const tumMetinNorm = normalizeText(tumMetin);

    // Eksik bilgi -> aranacak anahtar kelimeler eşleştirmesi
    const eksikKeywords = {
      'ihale tarihi': ['ihale tarih', '2026', '2025', '2024'],
      'basvuru son tarih': ['ihale tarih', 'son tarih', 'teklif tarih'],
      'ihalenin saat': ['10:00', '11:00', '09:00', 'saat'],
      'saat bilgi': ['10:00', '11:00', '09:00', 'saat'],
      'ihaleyi yapan kurum': ['hastane', 'belediye', 'universite', 'mudurlugu', 'baskanligi', 'idare'],
      'ihaleyi duzenleyen': ['hastane', 'belediye', 'universite', 'mudurlugu', 'idare'],
      'gunluk yemek': ['gunluk', 'ogun', 'kisi', 'adet', 'porsiyon'],
      kapasite: ['gunluk', 'kisi', 'adet', 'kapasite'],
      'fiyat farki': ['fiyat fark', 'formul', 'katsayi'],
      'formul detay': ['fiyat fark', 'formul'],
      'katsayi deger': ['fiyat fark', 'katsayi', 'a1', 'b1'],
      // Yapısal alan eşleştirmeleri
      'gunluk ogun': ['ogun bilgi', 'ogun say', 'gunluk ogun'],
      'ogun say': ['ogun bilgi', 'ogun say', 'gunluk ogun'],
      'kisi say': ['kisi say', 'toplam kisi'],
      'is yer': ['is yer', 'lokasyon', 'isyeri adres'],
      lokasyon: ['lokasyon', 'is yer', 'isyeri adres'],
      'personel detay': ['personel detay', 'personel say', 'personel nitelik'],
      personel: ['personel detay', 'personel say', 'personel'],
      iletisim: ['iletisim bilgi', 'iletisim', 'telefon', 'email'],
      'servis saat': ['servis saat', 'dagitim saat', 'yemek saat'],
      'mali kriter': ['mali kriter', 'mali yeterli', 'cari oran'],
      'gerekli belge': ['gerekli belge', 'belge liste', 'istenen belge'],
      'belge liste': ['gerekli belge', 'belge liste'],
    };

    // Bulunan bilgileri eksik listesinden çıkar
    analysisSummary.eksik_bilgiler = analysisSummary.eksik_bilgiler.filter((eksik) => {
      const eksikNorm = normalizeText(eksik);

      // 1. Önce bulunanBilgiler listesinde ara
      if (bulunanBilgiler.some((bulunan) => eksikNorm.includes(bulunan))) {
        return false; // Bulundu, eksik değil
      }

      // 2. Eksik için tanımlı anahtar kelimelerle tüm metinde ara
      for (const [key, keywords] of Object.entries(eksikKeywords)) {
        if (eksikNorm.includes(key)) {
          // Bu eksik için tanımlı anahtar kelimelerden biri metinde var mı?
          if (keywords.some((kw) => tumMetinNorm.includes(kw))) {
            return false; // Bulundu, eksik değil
          }
        }
      }

      return true; // Gerçekten eksik
    });

    // ─── Gramaj Gruplama (Fallback) ────────────────────────────────
    // Eğer prompt gramaj_gruplari üretmediyse, düz gramaj listesindeki
    // "Toplam" satırlarını ayırıcı olarak kullanarak yemek grupları oluştur.
    if (
      (!analysisSummary.gramaj_gruplari || analysisSummary.gramaj_gruplari.length === 0) &&
      analysisSummary.gramaj &&
      analysisSummary.gramaj.length > 3
    ) {
      const gruplari = [];
      let currentGroup = { yemek_adi: null, malzemeler: [], toplam_gramaj: null };

      for (const g of analysisSummary.gramaj) {
        const itemName = (g.item || '').trim().toLowerCase();
        const weightVal = typeof g.weight === 'number' ? g.weight : parseNumericValue(g.weight);

        if (itemName === 'toplam' || itemName === 'total') {
          // Bu grup bitti, kaydet
          if (currentGroup.malzemeler.length > 0) {
            currentGroup.toplam_gramaj = weightVal;
            // Yemek adı yoksa ilk malzemeden veya sıradan adla
            if (!currentGroup.yemek_adi) {
              currentGroup.yemek_adi = `Yemek ${gruplari.length + 1}`;
            }
            gruplari.push({ ...currentGroup });
          }
          currentGroup = { yemek_adi: null, malzemeler: [], toplam_gramaj: null };
        } else if (itemName) {
          currentGroup.malzemeler.push({
            item: g.item,
            weight: weightVal,
            unit: g.unit || 'g',
          });
        }
      }

      // Son grup (Toplam satırı olmadan biten)
      if (currentGroup.malzemeler.length > 0) {
        if (!currentGroup.yemek_adi) {
          currentGroup.yemek_adi = `Yemek ${gruplari.length + 1}`;
        }
        gruplari.push({ ...currentGroup });
      }

      if (gruplari.length > 0) {
        analysisSummary.gramaj_gruplari = gruplari;
      }
    }

    // ─── Sayısal Değer Normalizasyonu ──────────────────────────────
    // Tüm kişi sayıları, gün sayıları ve personel sayılarını sayıya çevir.
    // Çevrilemezse null bırak, orijinal metin _raw alanında sakla.
    normalizeNumericFields(analysisSummary);

    // Yaklaşık maliyeti tenders tablosundan çek (scraper'ın topladığı veri)
    const tenderDataResult = await query(`SELECT estimated_cost FROM tenders WHERE id = $1`, [tender_id]);
    const estimatedCost = tenderDataResult.rows[0]?.estimated_cost
      ? Number(tenderDataResult.rows[0].estimated_cost)
      : null;

    // Önce mevcut kayıt var mı kontrol et (NULL user_id için ON CONFLICT çalışmıyor)
    const existingCheck = await query(
      `SELECT id, yaklasik_maliyet FROM tender_tracking WHERE tender_id = $1 AND (user_id = $2 OR (user_id IS NULL AND $2 IS NULL))`,
      [tender_id, user_id || null]
    );

    // Sayıları hesapla
    const teknikSartSayisi = analysisSummary.teknik_sartlar?.length || 0;
    const birimFiyatSayisi = analysisSummary.birim_fiyatlar?.length || 0;

    let result;
    if (existingCheck.rows.length > 0) {
      // Mevcut kaydı güncelle (yaklasik_maliyet sadece henüz set edilmemişse veya placeholder ise güncelle)
      result = await query(
        `
        UPDATE tender_tracking SET
          analysis_summary = $2,
          documents_analyzed = $3,
          teknik_sart_sayisi = $4,
          birim_fiyat_sayisi = $5,
          yaklasik_maliyet = CASE WHEN yaklasik_maliyet IS NULL OR yaklasik_maliyet = 999999999 THEN $6 ELSE yaklasik_maliyet END,
          last_analysis_at = NOW(),
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
        [
          existingCheck.rows[0].id,
          JSON.stringify(analysisSummary),
          analysisResult.rows.length,
          teknikSartSayisi,
          birimFiyatSayisi,
          estimatedCost,
        ]
      );
    } else {
      // Yeni kayıt oluştur - yaklaşık maliyeti de dahil et
      result = await query(
        `
        INSERT INTO tender_tracking (
          tender_id, user_id, status, analysis_summary, 
          documents_analyzed, teknik_sart_sayisi, birim_fiyat_sayisi, 
          yaklasik_maliyet, last_analysis_at
        )
        VALUES ($1, $2, 'bekliyor', $3, $4, $5, $6, $7, NOW())
        RETURNING *
      `,
        [
          tender_id,
          user_id || null,
          JSON.stringify(analysisSummary),
          analysisResult.rows.length,
          teknikSartSayisi,
          birimFiyatSayisi,
          estimatedCost,
        ]
      );
    }

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

// ════════════════════════════════════════════════════════════════
// RAKİP ANALİZİ - Hibrit (İç Veri + Tavily)
// ════════════════════════════════════════════════════════════════

// Basit in-memory cache (24 saat TTL)
const rakipCache = new Map();
const RAKIP_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 saat

/**
 * Potansiyel rakip analizi
 * GET /api/tender-tracking/:tenderId/rakip-analizi
 *
 * İki katmanlı yaklaşım:
 * 1. İç veritabanı: yuklenici_ihaleleri tablosundan kurum/şehir bazlı eşleştirme
 * 2. Tavily web araması: İç veride bulunamazsa web'den keşif
 */
router.get('/:tenderId/rakip-analizi', async (req, res) => {
  try {
    const { tenderId } = req.params;
    const { force } = req.query; // ?force=true → cache bypass

    // 1. İhale bilgilerini al
    const tenderResult = await query(
      `SELECT id, title, organization_name, city, estimated_cost, tender_date
       FROM tenders WHERE id = $1`,
      [tenderId]
    );

    if (!tenderResult.rows.length) {
      return res.status(404).json({ success: false, error: 'İhale bulunamadı' });
    }

    const tender = tenderResult.rows[0];
    const kurumAdi = tender.organization_name;
    const sehir = tender.city;

    if (!kurumAdi) {
      return res.json({
        success: true,
        kaynak: 'yok',
        mesaj: 'İhale için kurum adı belirtilmemiş',
        rakipler: [],
      });
    }

    // Cache kontrolü
    const cacheKey = `${tenderId}_${kurumAdi}`;
    if (!force && rakipCache.has(cacheKey)) {
      const cached = rakipCache.get(cacheKey);
      if (Date.now() - cached.timestamp < RAKIP_CACHE_TTL) {
        return res.json({ ...cached.data, cached: true });
      }
      rakipCache.delete(cacheKey);
    }

    // ── KATMAN 1: İç Veritabanı ──────────────────────────────────
    // Kurum adı bazlı eşleştirme (fuzzy matching)
    let kurumKelimeler = kurumAdi
      .replace(/[^\w\sçğıöşüÇĞİÖŞÜ]/gi, '')
      .split(/\s+/)
      .filter((k) => k.length > 2)
      .slice(0, 5);

    // Kelime bulunamazsa kurum adının kendisini kullan (kısa isimler için)
    if (kurumKelimeler.length === 0) {
      kurumKelimeler = [kurumAdi.trim()].filter((k) => k.length > 0);
    }

    // Hâlâ boşsa iç veri sorgulamasını atla
    let icVeriResult = { rows: [] };

    // Minimum eşleşme eşiği: 1 kelime → 1, 2+ kelime → 2
    const minEslesme = Math.min(2, kurumKelimeler.length);

    if (kurumKelimeler.length > 0) {
      // Kurum adı eşleşmesi
      icVeriResult = await query(
        `
      WITH kurum_eslesen AS (
        SELECT
          yi.yuklenici_id,
          yi.kurum_adi,
          yi.sehir,
          yi.sozlesme_bedeli,
          yi.indirim_orani,
          yi.sozlesme_tarihi,
          yi.ihale_basligi,
          yi.rol,
          yi.durum,
          -- Kurum adı benzerlik skoru: kaç anahtar kelime eşleşiyor
          (
            ${kurumKelimeler.map((_, i) => `CASE WHEN LOWER(yi.kurum_adi) LIKE LOWER($${i + 2}) THEN 1 ELSE 0 END`).join(' + ')}
          ) as kelime_eslesme
        FROM yuklenici_ihaleleri yi
        WHERE (
          ${kurumKelimeler.map((_, i) => `LOWER(yi.kurum_adi) LIKE LOWER($${i + 2})`).join(' OR ')}
        )
      )
      SELECT
        y.id as yuklenici_id,
        y.unvan,
        y.katildigi_ihale_sayisi,
        y.kazanma_orani,
        y.ortalama_indirim_orani,
        y.aktif_sehirler,
        y.devam_eden_is_sayisi,
        y.son_ihale_tarihi,
        y.takipte,
        y.istihbarat_takibi,
        y.puan,
        y.ihalebul_url,
        -- Bu kurumla ilgili geçmiş
        COUNT(ke.yuklenici_id) FILTER (WHERE ke.kelime_eslesme >= ${minEslesme}) as kurum_esleme_sayisi,
        COUNT(ke.yuklenici_id) FILTER (WHERE ke.kelime_eslesme >= ${minEslesme} AND ke.rol = 'yuklenici') as kurum_kazanim_sayisi,
        -- Bu şehirdeki geçmiş
        COUNT(ke.yuklenici_id) FILTER (WHERE LOWER(ke.sehir) = LOWER($1)) as sehir_esleme_sayisi,
        -- Son teklifler (kurum bazlı)
        json_agg(
          json_build_object(
            'ihale_basligi', ke.ihale_basligi,
            'kurum_adi', ke.kurum_adi,
            'sehir', ke.sehir,
            'sozlesme_bedeli', ke.sozlesme_bedeli,
            'indirim_orani', ke.indirim_orani,
            'sozlesme_tarihi', ke.sozlesme_tarihi,
            'rol', ke.rol,
            'durum', ke.durum,
            'kelime_eslesme', ke.kelime_eslesme
          ) ORDER BY ke.sozlesme_tarihi DESC NULLS LAST
        ) FILTER (WHERE ke.kelime_eslesme >= ${minEslesme}) as gecmis_ihaleler
      FROM kurum_eslesen ke
      JOIN yukleniciler y ON y.id = ke.yuklenici_id
      WHERE ke.kelime_eslesme >= ${minEslesme}
      GROUP BY y.id, y.unvan, y.katildigi_ihale_sayisi, y.kazanma_orani,
               y.ortalama_indirim_orani, y.aktif_sehirler, y.devam_eden_is_sayisi,
               y.son_ihale_tarihi, y.takipte, y.istihbarat_takibi, y.puan, y.ihalebul_url
      ORDER BY kurum_esleme_sayisi DESC, kurum_kazanim_sayisi DESC
      LIMIT 10
    `,
        [sehir || '', ...kurumKelimeler.map((k) => `%${k}%`)]
      );
    } // kurumKelimeler.length > 0

    // Şehir bazlı ek rakipler (kurumda eşleşmeyenler ama şehirde aktif olanlar)
    let sehirRakipleri = [];
    if (sehir) {
      const sehirResult = await query(
        `
        SELECT
          y.id as yuklenici_id,
          y.unvan,
          y.katildigi_ihale_sayisi,
          y.kazanma_orani,
          y.ortalama_indirim_orani,
          y.aktif_sehirler,
          y.devam_eden_is_sayisi,
          y.son_ihale_tarihi,
          y.takipte,
          y.istihbarat_takibi,
          y.puan,
          y.ihalebul_url,
          COUNT(yi.id) as sehir_ihale_sayisi,
          COUNT(yi.id) FILTER (WHERE yi.rol = 'yuklenici') as sehir_kazanim_sayisi,
          AVG(yi.indirim_orani) FILTER (WHERE yi.indirim_orani IS NOT NULL) as sehir_ort_indirim
        FROM yukleniciler y
        JOIN yuklenici_ihaleleri yi ON yi.yuklenici_id = y.id
        WHERE LOWER(yi.sehir) = LOWER($1)
          AND y.id NOT IN (${icVeriResult.rows.map((r) => r.yuklenici_id).join(',') || '0'})
        GROUP BY y.id
        HAVING COUNT(yi.id) >= 2
        ORDER BY sehir_ihale_sayisi DESC
        LIMIT 5
      `,
        [sehir]
      );
      sehirRakipleri = sehirResult.rows;
    }

    // Sonuçları katmanlara ayır
    // "Kesin rakip" = bu kuruma 2+ kez girmiş (veya tek kelime eşleşmede 1+ kez)
    const kesinEsik = Math.max(2, minEslesme + 1); // 2+ kez girmiş = kesin rakip
    const kesinRakipler = icVeriResult.rows
      .filter((r) => Number(r.kurum_esleme_sayisi) >= kesinEsik)
      .map((r) => ({
        ...formatRakip(r),
        katman: 'kesin',
        neden: `Bu kuruma ${r.kurum_esleme_sayisi} kez girmiş${Number(r.kurum_kazanim_sayisi) > 0 ? `, ${r.kurum_kazanim_sayisi} kez kazanmış` : ''}`,
        gecmis: (r.gecmis_ihaleler || []).slice(0, 5),
      }));

    const kuvvetliAdaylar = icVeriResult.rows
      .filter((r) => Number(r.kurum_esleme_sayisi) >= 1 && Number(r.kurum_esleme_sayisi) < kesinEsik)
      .map((r) => ({
        ...formatRakip(r),
        katman: 'kuvvetli',
        neden: `Bu kuruma ${r.kurum_esleme_sayisi} kez girmiş`,
        gecmis: (r.gecmis_ihaleler || []).slice(0, 3),
      }));

    const sehirAktif = sehirRakipleri.map((r) => ({
      ...formatRakip(r),
      katman: 'sehir',
      neden: `${sehir} ilinde ${r.sehir_ihale_sayisi} ihaleye girmiş (${r.sehir_kazanim_sayisi} kazanım)`,
      gecmis: [],
    }));

    const icVeriToplam = [...kesinRakipler, ...kuvvetliAdaylar, ...sehirAktif];

    // ── KATMAN 2: Tavily Web Araması (iç veri yetersizse) ─────────
    const tavilyRakipler = [];
    let tavilyOzet = null;

    if (icVeriToplam.length < 2) {
      try {
        const { tavilySearch } = await import('../services/tavily-service.js');

        const searchQuery = `"${kurumAdi}" yemek hizmeti ihale sonucu yüklenici kazanan firma`;
        const searchResult = await tavilySearch(searchQuery, {
          searchDepth: 'basic',
          maxResults: 5,
          includeAnswer: true,
          includeDomains: ['ihalebul.com'],
        });

        if (searchResult.success && searchResult.answer) {
          tavilyOzet = searchResult.answer;

          // Sonuçlardan firma adlarını çıkar (basit regex - ünvan pattern)
          const firmaPattern =
            /(?:([A-ZÇĞİÖŞÜa-zçğıöşü\s]+(?:(?:A\.Ş\.|Ltd\. Şti\.|Anonim Şirketi|Limited Şirketi|Tic\.|San\.)[.\s]*))+)/g;
          const bulunanFirmalar = new Set();

          const fullText = `${searchResult.answer} ${searchResult.results?.map((r) => r.content).join(' ')}`;
          const matches = fullText.match(firmaPattern) || [];

          for (const m of matches) {
            const temiz = m.trim();
            if (temiz.length > 10 && temiz.length < 150) {
              bulunanFirmalar.add(temiz);
            }
          }

          // Bulunan firmaları iç veritabanıyla eşleştir
          for (const firma of bulunanFirmalar) {
            // Önce yukleniciler tablosunda ara
            const eslesen = await query(
              `SELECT id, unvan, katildigi_ihale_sayisi, kazanma_orani,
                      ortalama_indirim_orani, aktif_sehirler, takipte, ihalebul_url
               FROM yukleniciler
               WHERE LOWER(unvan) LIKE LOWER($1) OR LOWER($1) LIKE '%' || LOWER(unvan) || '%'
               LIMIT 1`,
              [`%${firma.substring(0, 30)}%`]
            );

            if (eslesen.rows.length > 0) {
              const y = eslesen.rows[0];
              // Zaten iç veride bulunmuş mu kontrol
              if (!icVeriToplam.some((r) => r.yuklenici_id === y.id)) {
                tavilyRakipler.push({
                  yuklenici_id: y.id,
                  unvan: y.unvan,
                  katildigi_ihale_sayisi: y.katildigi_ihale_sayisi,
                  kazanma_orani: y.kazanma_orani,
                  ortalama_indirim_orani: y.ortalama_indirim_orani,
                  aktif_sehirler: y.aktif_sehirler,
                  takipte: y.takipte,
                  ihalebul_url: y.ihalebul_url,
                  katman: 'web_kesfedildi',
                  neden: 'Web aramasından tespit edildi (veritabanında mevcut)',
                  gecmis: [],
                });
              }
            } else {
              // Veritabanında yok - yeni keşif
              tavilyRakipler.push({
                yuklenici_id: null,
                unvan: firma,
                katildigi_ihale_sayisi: null,
                kazanma_orani: null,
                ortalama_indirim_orani: null,
                aktif_sehirler: null,
                takipte: false,
                ihalebul_url: null,
                katman: 'web_yeni',
                neden: 'Web aramasından yeni keşfedildi — takibe alınabilir',
                gecmis: [],
              });
            }
          }
        }
      } catch (tavilyErr) {
        logger.warn('Tavily rakip araması başarısız:', tavilyErr.message);
      }
    }

    // Sonuç
    const responseData = {
      success: true,
      ihale: {
        id: tender.id,
        kurum: kurumAdi,
        sehir,
        tahmini_bedel: tender.estimated_cost,
      },
      katmanlar: {
        kesin_rakipler: kesinRakipler.slice(0, 3),
        kuvvetli_adaylar: kuvvetliAdaylar.slice(0, 3),
        sehir_aktif: sehirAktif.slice(0, 3),
        web_kesfedilen: tavilyRakipler.slice(0, 5),
      },
      toplam_rakip: icVeriToplam.length + tavilyRakipler.length,
      kaynak: icVeriToplam.length > 0 ? 'ic_veri' : tavilyRakipler.length > 0 ? 'tavily' : 'yok',
      tavily_ozet: tavilyOzet,
    };

    // Cache'e yaz
    rakipCache.set(cacheKey, { timestamp: Date.now(), data: responseData });

    res.json(responseData);
  } catch (error) {
    logger.error('Rakip analizi hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/** Rakip verisini formatla */
function formatRakip(row) {
  return {
    yuklenici_id: row.yuklenici_id,
    unvan: row.unvan,
    katildigi_ihale_sayisi: row.katildigi_ihale_sayisi,
    kazanma_orani: row.kazanma_orani ? parseFloat(row.kazanma_orani) : null,
    ortalama_indirim_orani: row.ortalama_indirim_orani
      ? parseFloat(row.ortalama_indirim_orani)
      : row.sehir_ort_indirim
        ? parseFloat(row.sehir_ort_indirim)
        : null,
    aktif_sehirler: row.aktif_sehirler,
    devam_eden_is: row.devam_eden_is_sayisi,
    son_ihale_tarihi: row.son_ihale_tarihi,
    takipte: row.takipte,
    istihbarat_takibi: row.istihbarat_takibi,
    puan: row.puan,
    ihalebul_url: row.ihalebul_url,
  };
}

export default router;
