import express from 'express';
import { query } from '../database.js';

const router = express.Router();

// =====================================================
// HAFIZA API
// =====================================================

// Tüm hafızaları getir
router.get('/', async (req, res) => {
  try {
    const { user_id = 'default', category, memory_type, limit } = req.query;

    let sql = `SELECT * FROM ai_memory WHERE user_id = $1`;
    const params = [user_id];
    let paramIndex = 2;

    if (category) {
      sql += ` AND category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    if (memory_type) {
      sql += ` AND memory_type = $${paramIndex}`;
      params.push(memory_type);
      paramIndex++;
    }

    sql += ` ORDER BY importance DESC, usage_count DESC`;

    if (limit) {
      sql += ` LIMIT $${paramIndex}`;
      params.push(parseInt(limit, 10) || 50);
    }

    const result = await query(sql, params);

    // Standart API response formatı
    return res.json({
      success: true,
      data: {
        memories: result.rows,
        count: result.rows.length,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// AI için tam context getir (PARAMETRELI ROUTE'LARDAN ÖNCE!)
router.get('/context', async (req, res) => {
  try {
    const { user_id = 'default', session_id } = req.query;

    // Hafızalar
    const memories = await query(
      `
      SELECT memory_type, category, key, value, importance
      FROM ai_memory 
      WHERE user_id = $1 
      ORDER BY importance DESC, usage_count DESC
      LIMIT 50
    `,
      [user_id]
    );

    // Son konuşmalar (eğer session varsa)
    let recentConversations = [];
    if (session_id) {
      const convResult = await query(
        `
        SELECT role, content, tools_used, created_at
        FROM ai_conversations 
        WHERE session_id = $1 
        ORDER BY created_at DESC 
        LIMIT 20
      `,
        [session_id]
      );
      recentConversations = convResult.rows.reverse();
    }

    // Sistem durumu
    const systemStats = await query(`
      SELECT 
        (SELECT COUNT(*) FROM projeler WHERE aktif = true) as aktif_proje,
        (SELECT COUNT(*) FROM siparisler WHERE durum NOT IN ('iptal', 'teslim_alindi')) as acik_siparis,
        (SELECT COUNT(*) FROM cariler WHERE aktif = true AND tip IN ('tedarikci', 'her_ikisi')) as tedarikci_sayisi,
        (SELECT COUNT(*) FROM uyumsoft_invoices WHERE is_approved = false AND is_rejected = false) as bekleyen_fatura
    `);

    res.json({
      success: true,
      data: {
        memories: memories.rows,
        recentConversations,
        systemStats: systemStats.rows[0],
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Tek hafıza getir
router.get('/:id', async (req, res) => {
  try {
    const result = await query('SELECT * FROM ai_memory WHERE id = $1', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Hafıza bulunamadı' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Yeni hafıza ekle
router.post('/', async (req, res) => {
  try {
    const { user_id = 'default', memory_type, category, key, value, importance = 5 } = req.body;

    if (!memory_type || !key || !value) {
      return res.status(400).json({ success: false, error: 'memory_type, key ve value zorunludur' });
    }

    const result = await query(
      `
      INSERT INTO ai_memory (user_id, memory_type, category, key, value, importance)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (user_id, memory_type, key) 
      DO UPDATE SET 
        value = EXCLUDED.value,
        importance = EXCLUDED.importance,
        usage_count = ai_memory.usage_count + 1,
        last_used_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `,
      [user_id, memory_type, category, key, value, importance]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Hafıza güncelle
router.put('/:id', async (req, res) => {
  try {
    const { value, importance, category } = req.body;

    const result = await query(
      `
      UPDATE ai_memory 
      SET value = COALESCE($1, value),
          importance = COALESCE($2, importance),
          category = COALESCE($3, category),
          usage_count = usage_count + 1,
          last_used_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *
    `,
      [value, importance, category, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Hafıza bulunamadı' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Hafıza sil
router.delete('/:id', async (req, res) => {
  try {
    const result = await query('DELETE FROM ai_memory WHERE id = $1 RETURNING *', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Hafıza bulunamadı' });
    }

    res.json({ success: true, data: { deleted: result.rows[0] } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Hafıza kullanımı güncelle (AI tarafından çağrılır)
router.post('/use/:id', async (req, res) => {
  try {
    const result = await query(
      `
      UPDATE ai_memory 
      SET usage_count = usage_count + 1,
          last_used_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `,
      [req.params.id]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// KONUŞMA API
// =====================================================

// Konuşma kaydet
router.post('/conversation', async (req, res) => {
  try {
    const { session_id, user_id = 'default', role, content, tools_used, metadata } = req.body;

    if (!session_id || !role || !content) {
      return res.status(400).json({ success: false, error: 'session_id, role ve content zorunludur' });
    }

    const result = await query(
      `
      INSERT INTO ai_conversations (session_id, user_id, role, content, tools_used, metadata)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `,
      [session_id, user_id, role, content, tools_used || [], metadata || {}]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Konuşma geçmişi getir
router.get('/conversation/:sessionId', async (req, res) => {
  try {
    const { limit = 50 } = req.query;

    const result = await query(
      `
      SELECT * FROM ai_conversations 
      WHERE session_id = $1 
      ORDER BY created_at ASC 
      LIMIT $2
    `,
      [req.params.sessionId, limit]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Son konuşmaları getir (özet için)
router.get('/conversations/recent', async (req, res) => {
  try {
    const { user_id = 'default', limit = 10 } = req.query;

    const result = await query(
      `
      SELECT DISTINCT ON (session_id) 
        session_id,
        content as last_message,
        created_at
      FROM ai_conversations
      WHERE user_id = $1
      ORDER BY session_id, created_at DESC
      LIMIT $2
    `,
      [user_id, limit]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// GERİ BİLDİRİM API
// =====================================================

// Geri bildirim ekle
router.post('/feedback', async (req, res) => {
  try {
    const { conversation_id, user_id = 'default', rating, feedback_type, comment } = req.body;

    const result = await query(
      `
      INSERT INTO ai_feedback (conversation_id, user_id, rating, feedback_type, comment)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `,
      [conversation_id, user_id, rating, feedback_type, comment]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// AI öğrenme - yeni bilgi kaydet
router.post('/learn', async (req, res) => {
  try {
    const { user_id = 'default', learnings } = req.body;

    if (!Array.isArray(learnings)) {
      return res.status(400).json({ success: false, error: 'learnings array olmalı' });
    }

    const results = [];
    for (const learning of learnings) {
      const { memory_type, category, key, value, importance = 5 } = learning;

      const result = await query(
        `
        INSERT INTO ai_memory (user_id, memory_type, category, key, value, importance)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (user_id, memory_type, key) 
        DO UPDATE SET 
          value = EXCLUDED.value,
          importance = GREATEST(ai_memory.importance, EXCLUDED.importance),
          usage_count = ai_memory.usage_count + 1,
          last_used_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `,
        [user_id, memory_type, category, key, value, importance]
      );

      results.push(result.rows[0]);
    }

    res.status(201).json({ success: true, data: { learned: results.length, items: results } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
