/**
 * AI Analiz Route'ları
 * Card Transform, Cross Analysis, Error Analysis endpoint'leri
 * Ana ai.js router'ından ayrıştırılmıştır.
 */

import express from 'express';
import { query } from '../database.js';
import { authenticate, optionalAuth, requireAdmin } from '../middleware/auth.js';
import aiAgent from '../services/ai-agent.js';
import { createAnthropicClient } from '../utils/anthropic-client.js';
import logger from '../utils/logger.js';
import { CARD_TRANSFORM_PROMPTS, CROSS_ANALYSIS_SYSTEM_PROMPT } from './ai-prompts.js';

const router = express.Router();

// ============================================
// ERROR ANALYSIS ENDPOINT (Frontend Error Collector)
// ============================================

/**
 * POST /api/ai/analyze-errors
 * Frontend'den toplanan hataları AI ile analiz et
 * God Mode aktifken kullanılır
 */
router.post('/analyze-errors', optionalAuth, async (req, res) => {
  try {
    const { errors, context } = req.body;

    if (!errors || !Array.isArray(errors) || errors.length === 0) {
      return res.json({
        success: true,
        analysis: 'Analiz edilecek hata yok.',
        suggestions: [],
      });
    }

    logger.info('[Error Analysis] Frontend hataları alındı', {
      errorCount: errors.length,
      context: context?.currentUrl,
    });

    // Hataları AI'a gönder
    const errorSummary = errors
      .slice(0, 10) // Maksimum 10 hata
      .map(
        (e, i) =>
          `${i + 1}. [${e.type}] ${e.message}\n   URL: ${e.url}\n   Zaman: ${e.timestamp}${e.stack ? `\n   Stack: ${e.stack.substring(0, 200)}...` : ''}`
      )
      .join('\n\n');

    const analysisPrompt = `
Frontend'den aşağıdaki hatalar toplandı. Lütfen analiz et ve çözüm öner:

HATALAR:
${errorSummary}

CONTEXT:
- Sayfa: ${context?.currentUrl || 'Bilinmiyor'}
- Zaman: ${context?.timestamp || new Date().toISOString()}

Lütfen:
1. Her hatanın olası nedenini açıkla
2. Çözüm önerileri sun
3. Kritiklik seviyesini belirt (düşük/orta/yüksek)
4. Hangi dosyalarda düzeltme yapılması gerektiğini belirt
`;

    // AI Agent ile analiz yap (God Mode olmadan - sadece okuma)
    const result = await aiAgent.processQuery(analysisPrompt, [], {
      sessionId: `error-analysis-${Date.now()}`,
      userId: req.user?.id || 'error_collector',
      templateSlug: 'default',
    });

    // Sonuçları parse et
    const suggestions = [];
    const response = result.response || '';

    // Basit öneri çıkarma
    const lines = response.split('\n');
    lines.forEach((line) => {
      if (line.includes('Öneri:') || line.includes('Çözüm:') || line.match(/^\d+\./)) {
        suggestions.push(line.trim());
      }
    });

    return res.json({
      success: true,
      analysis: result.response,
      suggestions: suggestions.slice(0, 10),
      errorCount: errors.length,
      analyzedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[Error Analysis] Hata', { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      error: `Hata analizi yapılamadı: ${error.message}`,
    });
  }
});

/**
 * GET /api/ai/errors/recent
 * Son frontend hatalarını getir (Admin için)
 */
router.get('/errors/recent', authenticate, requireAdmin, async (req, res) => {
  try {
    const { limit = 50 } = req.query;

    // Eğer hata log tablosu varsa oradan çek
    // Şimdilik basit bir yapı kullanıyoruz
    const result = await query(
      `
      SELECT
        id, error_type, message, stack_trace, url, user_agent,
        additional_info, created_at
      FROM frontend_errors
      ORDER BY created_at DESC
      LIMIT $1
    `,
      [parseInt(limit, 10)]
    ).catch(() => ({ rows: [] }));

    return res.json({
      success: true,
      errors: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    logger.error('[Recent Errors] Hata', { error: error.message });
    return res.status(500).json({
      success: false,
      error: 'Hatalar yüklenemedi',
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// POST /api/ai/card-transform
// Seçilen metni AI ile farklı kart formatlarına dönüştür
// ═══════════════════════════════════════════════════════════════
router.post('/card-transform', authenticate, async (req, res) => {
  try {
    const { text, transform_type, tender_id, card_type } = req.body;

    if (!text || !transform_type) {
      return res.status(400).json({ success: false, error: 'text ve transform_type zorunlu' });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ success: false, error: 'AI servisi yapılandırılmamış' });
    }

    const systemPrompt = CARD_TRANSFORM_PROMPTS[transform_type];
    if (!systemPrompt) {
      return res.status(400).json({ success: false, error: 'Geçersiz transform_type' });
    }

    const aiClient = await createAnthropicClient();

    const aiResponse = await aiClient.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      temperature: 0.1,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: card_type ? `[Kart: ${card_type}]\n\n${text.substring(0, 4000)}` : text.substring(0, 4000),
        },
      ],
    });

    const responseText = aiResponse.content?.[0]?.type === 'text' ? aiResponse.content[0].text : '';

    // JSON parse
    let parsed;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch {
      parsed = null;
    }

    if (!parsed) {
      // Fallback: metin kartı olarak döndür
      return res.json({
        success: true,
        data: {
          card_type: 'text',
          title: `AI ${transform_type === 'table' ? 'Tablo' : transform_type === 'summary' ? 'Özet' : 'Veri'} Çıkarımı`,
          content: { text: responseText },
          category: 'diger',
        },
      });
    }

    logger.info('[Card Transform] AI dönüşümü tamamlandı', {
      tender_id,
      transform_type,
      card_type: card_type || parsed.card_type,
    });

    return res.json({ success: true, data: parsed });
  } catch (error) {
    logger.error('[Card Transform] Hata', { error: error.message });
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// POST /api/ai/cross-analysis
// Tüm analiz kartları arasında çapraz analiz yap
// ═══════════════════════════════════════════════════════════════
router.post('/cross-analysis', authenticate, async (req, res) => {
  try {
    const { tender_id, analysis_summary } = req.body;

    if (!analysis_summary) {
      return res.status(400).json({ success: false, error: 'analysis_summary zorunlu' });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ success: false, error: 'AI servisi yapılandırılmamış' });
    }

    const userMessage = `İhale Analiz Verileri:
${JSON.stringify(analysis_summary, null, 2)}

Lütfen bu verileri çapraz kontrol et ve bulgularını raporla.`;

    const aiClient = await createAnthropicClient();

    const message = await aiClient.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: CROSS_ANALYSIS_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    const responseText = message.content[0]?.type === 'text' ? message.content[0].text : '';

    logger.info('[Cross Analysis] Çapraz analiz tamamlandı', { tender_id });

    return res.json({
      success: true,
      data: {
        content: responseText,
        tender_id,
      },
    });
  } catch (error) {
    logger.error('[Cross Analysis] Hata', { error: error.message });
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
