/**
 * God Mode AI Route'ları
 * /api/ai/god-mode/* endpoint'leri
 * Ana ai.js router'ından ayrıştırılmıştır.
 * Super Admin yetkisi gerekli.
 */

import express from 'express';
import { query } from '../database.js';
import { authenticate, requireSuperAdmin } from '../middleware/auth.js';
import aiAgent from '../services/ai-agent.js';
import aiTools from '../services/ai-tools/index.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * POST /api/ai/god-mode/execute
 * God Mode ile AI Agent çalıştır
 * Super Admin yetkisi gerekli
 */
router.post('/execute', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { message, sessionId, history = [] } = req.body;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Mesaj boş olamaz',
      });
    }

    logger.warn('[God Mode Execute] Super Admin komutu', {
      userId: req.user?.id,
      email: req.user?.email,
      messagePreview: message.substring(0, 100),
      sessionId,
      historyLength: history.length,
    });

    // God Mode ile AI Agent çalıştır
    const result = await aiAgent.processQuery(message, history, {
      sessionId: sessionId || `god-mode-${Date.now()}`,
      userId: req.user?.id || 'super_admin',
      department: 'GOD_MODE',
      isGodMode: true,
      pageContext: {
        isGodMode: true,
        page: 'admin/god-mode',
        user: {
          id: req.user?.id,
          email: req.user?.email,
          role: 'super_admin',
        },
      },
    });

    return res.json({
      success: result.success,
      response: result.response,
      toolsUsed: result.toolsUsed || [],
      iterations: result.iterations || 0,
      executionTime: result.executionTime || 0,
      godMode: true, // God Mode flag'i
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[God Mode Execute] Hata', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id,
    });
    return res.status(500).json({
      success: false,
      error: `God Mode komutu çalıştırılamadı: ${error.message}`,
    });
  }
});

/**
 * GET /api/ai/god-mode/tools
 * God Mode için mevcut tool listesini döndür
 * Super Admin yetkisi gerekli
 */
router.get('/tools', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    // AI Tools'dan tüm tool'ları al
    const allTools = aiTools.getToolDefinitions();

    // God mode tool'ları filtrele
    const godModeTools = allTools.filter((tool) => tool.name.startsWith('god_') || tool.isGodMode === true);

    // Normal tool'lar
    const normalTools = allTools.filter((tool) => !tool.name.startsWith('god_') && tool.isGodMode !== true);

    logger.info('[God Mode] Tool listesi istendi', {
      userId: req.user?.id,
      godModeCount: godModeTools.length,
      normalCount: normalTools.length,
    });

    return res.json({
      success: true,
      allTools: allTools.map((t) => ({
        name: t.name,
        description: t.description,
        isGodMode: t.name.startsWith('god_') || t.isGodMode === true,
      })),
      godModeTools: godModeTools.map((t) => ({
        name: t.name,
        description: t.description,
      })),
      normalTools: normalTools.map((t) => ({
        name: t.name,
        description: t.description,
      })),
      counts: {
        total: allTools.length,
        godMode: godModeTools.length,
        normal: normalTools.length,
      },
    });
  } catch (error) {
    logger.error('[God Mode Tools] Hata', { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      error: 'Tool listesi alınamadı',
    });
  }
});

/**
 * GET /api/ai/god-mode/logs
 * God Mode işlem loglarını getir
 * Super Admin yetkisi gerekli
 */
router.get('/logs', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    // God mode loglarını getir (ai_conversations tablosundan)
    const result = await query(
      `
      SELECT
        id,
        session_id,
        user_id,
        role,
        content,
        tools_used,
        metadata,
        created_at
      FROM ai_conversations
      WHERE session_id LIKE 'god-mode-%'
         OR (metadata->>'isGodMode')::boolean = true
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `,
      [parseInt(limit, 10), parseInt(offset, 10)]
    );

    return res.json({
      success: true,
      logs: result.rows,
      pagination: {
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
        count: result.rows.length,
      },
    });
  } catch (error) {
    logger.error('[God Mode Logs] Hata', { error: error.message });
    return res.status(500).json({
      success: false,
      error: 'Loglar alınamadı',
    });
  }
});

export default router;
