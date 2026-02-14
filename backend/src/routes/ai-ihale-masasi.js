/**
 * İhale Masası AI Route'ları
 * /api/ai/ihale-masasi/* endpoint'leri
 * Ana ai.js router'ından ayrıştırılmıştır.
 */

import express from 'express';
import { query } from '../database.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import aiAgent from '../services/ai-agent.js';
import ihaleAgentService from '../services/ihale-agent-service.js';
import { invalidatePastLearningCache } from '../services/ihale-past-learning-service.js';
import { createAnthropicClient } from '../utils/anthropic-client.js';
import logger from '../utils/logger.js';
import {
  buildToolPrompt,
  getAgentSystemPrompt,
  getToolPromptTemplate,
  hesaplaPorsiyonMaliyet,
  parseAIResponseToToolResult,
  parseRecipesFromGramaj,
  parseRecipesFromSampleMenus,
} from './ai-helpers.js';
import { INGREDIENT_MATCH_PROMPT } from './ai-prompts.js';

const router = express.Router();

// ============================================
// Agent Action Endpoint
// ============================================

/**
 * POST /api/ai/ihale-masasi/agent-action
 * Sanal İhale Masası — Agent bazlı AI aksiyonu
 * Prompts are now fetched from database (agents + agent_tools tables) with fallback to hardcoded values
 */
router.post('/agent-action', optionalAuth, async (req, res) => {
  try {
    const { agentId, toolId, tenderId, input, analysisContext } = req.body;

    if (!agentId || !toolId) {
      return res.status(400).json({
        success: false,
        error: 'agentId ve toolId zorunludur',
      });
    }

    // Fetch agent system prompt from database (with fallback to hardcoded)
    const agentData = await getAgentSystemPrompt(agentId);
    if (!agentData) {
      return res.status(400).json({
        success: false,
        error: `Geçersiz agent: ${agentId}`,
      });
    }

    const { agentId: agentDbId, systemPrompt } = agentData;

    // Fetch tool prompt template from database (optional, falls back to hardcoded buildToolPrompt)
    const dbToolTemplate = await getToolPromptTemplate(agentDbId, toolId);

    logger.info(
      `[İhale Masası] Agent: ${agentId}, Tool: ${toolId}, Tender: ${tenderId || 'N/A'}, Source: ${agentDbId ? 'DB' : 'Fallback'}`,
      {
        agentId,
        toolId,
        tenderId,
        promptSource: agentDbId ? 'database' : 'fallback',
        toolTemplateSource: dbToolTemplate ? 'database' : 'fallback',
      }
    );

    // Build context from analysisContext (comes from frontend analysis_summary)
    const context = analysisContext || {};

    // Build the user message based on tool type (uses DB template if available)
    const userMessage = buildToolPrompt(toolId, input, context, dbToolTemplate);

    // Call AI agent with specialized system prompt
    const result = await aiAgent.processQuery(userMessage, [], {
      sessionId: `ihale-masasi-${agentId}-${Date.now()}`,
      userId: req.user?.id || 'ihale-masasi',
      department: 'İHALE',
      systemContext: systemPrompt,
      pageContext: {
        type: 'ihale-masasi',
        agentId,
        toolId,
        tenderId,
      },
    });

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error || 'AI yanıtı alınamadı',
      });
    }

    // Parse AI response to structured ToolResult
    const parsed = parseAIResponseToToolResult(result.response, toolId);

    return res.json({
      success: true,
      result: parsed.result,
      toolsUsed: result.toolsUsed || [],
      iterations: result.iterations || 0,
    });
  } catch (error) {
    logger.error('[İhale Masası] Agent Action Hata', {
      error: error.message,
      stack: error.stack,
      agentId: req.body?.agentId,
      toolId: req.body?.toolId,
    });
    return res.status(500).json({
      success: false,
      error: 'Agent aksiyonu çalıştırılamadı',
    });
  }
});

// ============================================
// AI Agent Analiz Endpoint'leri
// ============================================

/**
 * POST /api/ai/ihale-masasi/analyze-all
 * 4 agent'ı paralel başlatıp tüm analizleri döndürür
 */
router.post('/analyze-all', optionalAuth, async (req, res) => {
  try {
    const { tenderId, force, additionalContext } = req.body;

    if (!tenderId) {
      return res.status(400).json({ success: false, error: 'tenderId zorunludur' });
    }

    logger.info(`[İhale Masası] Tüm agent analizi: tender=${tenderId}, force=${!!force}`, {
      tenderId,
      force: !!force,
      userId: req.user?.id,
      hasAdditionalContext: !!additionalContext,
    });

    const result = await ihaleAgentService.analyzeAllAgents(tenderId, { force: !!force, additionalContext });

    return res.json({
      success: true,
      analyses: result.analyses,
      errors: result.errors,
    });
  } catch (error) {
    logger.error('[İhale Masası] analyze-all Hata', { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, error: 'Agent analizi çalıştırılamadı' });
  }
});

/**
 * POST /api/ai/ihale-masasi/analyze-agent
 * Tek bir agent ile analiz yap
 */
router.post('/analyze-agent', optionalAuth, async (req, res) => {
  try {
    const { tenderId, agentId, force, additionalContext } = req.body;

    if (!tenderId || !agentId) {
      return res.status(400).json({ success: false, error: 'tenderId ve agentId zorunludur' });
    }

    if (!ihaleAgentService.AGENT_IDS.includes(agentId)) {
      return res.status(400).json({ success: false, error: `Geçersiz agent: ${agentId}` });
    }

    logger.info(`[İhale Masası] Tekil agent analizi: tender=${tenderId}, agent=${agentId}`, {
      tenderId,
      agentId,
      force: !!force,
    });

    const result = await ihaleAgentService.analyzeWithAgent(tenderId, agentId, { force: !!force, additionalContext });

    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }

    return res.json({
      success: true,
      analysis: result.analysis,
      cached: result.cached || false,
    });
  } catch (error) {
    logger.error('[İhale Masası] analyze-agent Hata', { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, error: 'Agent analizi çalıştırılamadı' });
  }
});

/**
 * GET /api/ai/ihale-masasi/analysis/:tenderId
 * Cache'den hızlı yükleme (AI çağrısı yapmaz)
 */
router.get('/analysis/:tenderId', optionalAuth, async (req, res) => {
  try {
    const tenderId = parseInt(req.params.tenderId, 10);
    if (!tenderId || Number.isNaN(tenderId)) {
      return res.status(400).json({ success: false, error: 'Geçerli tenderId gerekli' });
    }

    const analyses = await ihaleAgentService.loadCachedAnalyses(tenderId);

    if (!analyses) {
      return res.json({ success: true, analyses: null, cached: false });
    }

    return res.json({ success: true, analyses, cached: true });
  } catch (error) {
    logger.error('[İhale Masası] analysis cache Hata', { error: error.message });
    return res.status(500).json({ success: false, error: 'Analiz yüklenemedi' });
  }
});

/**
 * POST /api/ai/ihale-masasi/verdict
 * AI ile akıllı verdict üret (tüm agent bulgularını sentezle)
 */
router.post('/verdict', optionalAuth, async (req, res) => {
  try {
    const { tenderId, analyses } = req.body;

    if (!tenderId || !analyses) {
      return res.status(400).json({ success: false, error: 'tenderId ve analyses zorunludur' });
    }

    logger.info(`[İhale Masası] AI Verdict üretiliyor: tender=${tenderId}`, { tenderId });

    // İhale temel bilgilerini al
    const tenderResult = await query(
      `SELECT t.title, t.organization_name AS organization, t.estimated_cost, t.tender_date
       FROM tenders t WHERE t.id = $1 LIMIT 1`,
      [tenderId]
    );
    const tenderInfo = tenderResult.rows[0] || {};

    const result = await ihaleAgentService.generateAIVerdict(tenderId, analyses, tenderInfo);

    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }

    return res.json({ success: true, verdict: result.verdict });
  } catch (error) {
    logger.error('[İhale Masası] verdict Hata', { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, error: 'Verdict üretilemedi' });
  }
});

// ============================================
// Session Kayıt
// ============================================

/**
 * POST /api/ai/ihale-masasi/session/save
 * İhale masası oturumunu kaydet
 */
router.post('/session/save', optionalAuth, async (req, res) => {
  try {
    const { tenderId, sessionData } = req.body;

    if (!tenderId || !sessionData) {
      return res.status(400).json({ success: false, error: 'tenderId ve sessionData zorunludur' });
    }

    const result = await query(
      `INSERT INTO ihale_masasi_sessions (tender_id, session_data, user_id)
       VALUES ($1, $2, $3)
       RETURNING id, created_at`,
      [tenderId, JSON.stringify(sessionData), req.user?.id || 'default']
    );

    return res.json({ success: true, sessionId: result.rows[0].id, createdAt: result.rows[0].created_at });
  } catch (error) {
    logger.error('[İhale Masası Session Save] Hata', { error: error.message });
    return res.status(500).json({ success: false, error: 'Oturum kaydedilemedi' });
  }
});

/**
 * GET /api/ai/ihale-masasi/session/:tenderId
 * İhale masası geçmiş oturumlarını getir
 */
router.get('/session/:tenderId', optionalAuth, async (req, res) => {
  try {
    const result = await query(
      `SELECT id, session_data, created_at
       FROM ihale_masasi_sessions
       WHERE tender_id = $1
       ORDER BY created_at DESC
       LIMIT 10`,
      [req.params.tenderId]
    );

    return res.json({ success: true, sessions: result.rows });
  } catch (error) {
    logger.error('[İhale Masası Session List] Hata', { error: error.message });
    return res.status(500).json({ success: false, error: 'Oturumlar yüklenemedi' });
  }
});

// ═══════════════════════════════════════════════════════════════
// MALZEME EŞLEŞTİRME (Porsiyon Maliyet Hesabı)
// ═══════════════════════════════════════════════════════════════

/**
 * POST /api/ai/ihale-masasi/match-ingredients
 * Şartnamedeki örnek menü tariflerini parse et, ürün kartlarıyla eşleştir,
 * yemek bazlı maliyet hesapla.
 *
 * Kaynak: documents.analysis_result.analysis.catering.sample_menus
 * Bu tablolar "Yemek Adı: X" header'ı ile başlar, satırlarda malzeme + gramaj bulunur.
 */
router.post('/match-ingredients', optionalAuth, async (req, res) => {
  try {
    const { tenderId } = req.body;
    if (!tenderId) {
      return res.status(400).json({ success: false, error: 'tenderId gerekli' });
    }

    // 1. Dokümanlardan sample_menus tablolarını çek
    const docResult = await query(
      `SELECT id, analysis_result->'analysis'->'catering'->'sample_menus' as sample_menus
       FROM documents
       WHERE tender_id = $1
         AND analysis_result->'analysis'->'catering'->'sample_menus' IS NOT NULL
         AND jsonb_array_length(COALESCE(analysis_result->'analysis'->'catering'->'sample_menus', '[]'::jsonb)) > 0
       ORDER BY id DESC
       LIMIT 1`,
      [tenderId]
    );

    // Fallback: gramaj verisinden "Toplam" satırlarıyla grupla
    let recipes = [];
    let dataSource = 'sample_menus';

    if (docResult.rows.length > 0 && docResult.rows[0].sample_menus) {
      recipes = parseRecipesFromSampleMenus(docResult.rows[0].sample_menus);
    }

    // Fallback: gramaj listesinden gruplama
    if (recipes.length === 0) {
      const trackingResult = await query(
        `SELECT analysis_summary->'gramaj' as gramaj,
                analysis_summary->'gramaj_gruplari' as gramaj_gruplari
         FROM tender_tracking WHERE tender_id = $1 LIMIT 1`,
        [tenderId]
      );
      if (trackingResult.rows.length > 0) {
        const gramaj = trackingResult.rows[0].gramaj || [];
        const gruplari = trackingResult.rows[0].gramaj_gruplari || [];
        recipes = parseRecipesFromGramaj(gramaj, gruplari);
        dataSource = gruplari.length > 0 ? 'gramaj_gruplari' : 'gramaj_fallback';
      }
    }

    if (recipes.length === 0) {
      return res.json({
        success: true,
        recipes: [],
        stats: { total_recipes: 0, total_ingredients: 0 },
        message: 'Menü tarifi bulunamadı',
      });
    }

    // 2. Ürün kartlarını çek
    const urunResult = await query(
      `SELECT id, ad, varsayilan_birim, manuel_fiyat,
              (SELECT uk2.ad FROM urun_kategorileri uk2 WHERE uk2.id = urun_kartlari.kategori_id) as kategori
       FROM urun_kartlari
       WHERE aktif = true
       ORDER BY ad`
    );
    const urunler = urunResult.rows;

    // 3. Benzersiz malzeme isimlerini topla (tüm tariflerden)
    const uniqueItems = new Set();
    for (const recipe of recipes) {
      for (const ing of recipe.ingredients) {
        uniqueItems.add(ing.item);
      }
    }

    // 4. AI ile eşleştirme
    const itemList = [...uniqueItems];
    const katalog = urunler.map((u) => ({ id: u.id, ad: u.ad }));

    const aiClient = await createAnthropicClient();

    const aiResponse = await aiClient.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      temperature: 0.1,
      system: INGREDIENT_MATCH_PROMPT,
      messages: [
        {
          role: 'user',
          content: `ŞARTNAME MALZEMELERİ:\n${JSON.stringify(itemList)}\n\nÜRÜN KATALOĞU:\n${JSON.stringify(katalog)}`,
        },
      ],
    });

    // AI yanıtından JSON çıkar
    const aiText = aiResponse.content[0]?.text || '[]';
    let aiMatches = [];
    try {
      const jsonMatch = aiText.match(/\[[\s\S]*\]/);
      aiMatches = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    } catch {
      logger.warn('[İhale Masası] AI eşleştirme JSON parse hatası', { text: aiText.slice(0, 200) });
    }

    // Eşleştirme haritası oluştur — case-insensitive + trim normalizasyonu
    const matchMap = new Map();
    logger.info(`[İhale Masası] AI ${aiMatches.length} eşleştirme döndü, ${uniqueItems.size} benzersiz malzeme`);

    for (const aiMatch of aiMatches) {
      if (!aiMatch.sartname || !aiMatch.urun_id) continue;
      const urun = urunler.find((u) => u.id === aiMatch.urun_id);
      if (!urun) continue;
      const matchData = {
        urun_id: urun.id,
        urun_ad: urun.ad,
        birim: urun.varsayilan_birim,
        fiyat: urun.manuel_fiyat ? Number(urun.manuel_fiyat) : null,
        kategori: urun.kategori,
        confidence: aiMatch.confidence || 0,
        note: aiMatch.not || null,
      };
      // Hem orijinal hem lowercase key ile kaydet (case-insensitive lookup)
      matchMap.set(aiMatch.sartname.trim(), matchData);
      matchMap.set(aiMatch.sartname.trim().toLowerCase(), matchData);
    }

    // 5. Her tarif için malzeme eşleştirmesi ve maliyet hesabı
    let toplamGenel = 0;
    let totalIngredients = 0;
    let matchedCount = 0;
    let pricedCount = 0;

    const enrichedRecipes = recipes.map((recipe) => {
      let recipeToplam = 0;
      const ingredients = recipe.ingredients.map((ing) => {
        totalIngredients++;
        // Case-insensitive + trim lookup
        const match = matchMap.get(ing.item.trim()) || matchMap.get(ing.item.trim().toLowerCase());
        if (!match) {
          return {
            ...ing,
            matched: false,
            urun: null,
            porsiyon_maliyet: null,
            confidence: 0,
          };
        }
        matchedCount++;
        const porsiyon = hesaplaPorsiyonMaliyet(match.fiyat, match.birim, ing.gramaj, ing.unit || 'g');
        if (porsiyon !== null) {
          recipeToplam += porsiyon;
          pricedCount++;
        }
        return {
          ...ing,
          matched: true,
          urun: {
            id: match.urun_id,
            ad: match.urun_ad,
            birim: match.birim,
            fiyat: match.fiyat,
          },
          porsiyon_maliyet: porsiyon,
          confidence: match.confidence,
          note: match.note,
        };
      });

      toplamGenel += recipeToplam;

      return {
        yemek_adi: recipe.name,
        kategori: recipe.category || null,
        toplam_gramaj: recipe.totalGramaj || null,
        ingredients,
        porsiyon_maliyet: Math.round(recipeToplam * 100) / 100,
      };
    });

    // Tarifleri maliyete göre sırala (pahalıdan ucuza)
    enrichedRecipes.sort((a, b) => (b.porsiyon_maliyet || 0) - (a.porsiyon_maliyet || 0));

    return res.json({
      success: true,
      recipes: enrichedRecipes,
      data_source: dataSource,
      stats: {
        total_recipes: recipes.length,
        total_ingredients: totalIngredients,
        unique_ingredients: uniqueItems.size,
        matched: matchedCount,
        priced: pricedCount,
        match_rate: Math.round((matchedCount / totalIngredients) * 100),
      },
      maliyet: {
        porsiyon_toplam: Math.round(toplamGenel * 100) / 100,
        ortalama_yemek: recipes.length > 0 ? Math.round((toplamGenel / recipes.length) * 100) / 100 : 0,
        hesaplanan_kalem: pricedCount,
        eksik_kalem: totalIngredients - pricedCount,
      },
      ai_model: 'claude-sonnet-4-20250514',
      ai_tokens: {
        input: aiResponse.usage?.input_tokens || 0,
        output: aiResponse.usage?.output_tokens || 0,
      },
    });
  } catch (error) {
    logger.error('[İhale Masası] Malzeme eşleştirme hatası', { error: error.message });
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/ai/ihale-masasi/save-ingredient-matches
 * Onaylanan malzeme eşleştirmelerini kaydet (tender_tracking.ingredient_matches JSON alanına)
 */
router.post('/save-ingredient-matches', optionalAuth, async (req, res) => {
  try {
    const { tenderId, matches } = req.body;
    if (!tenderId || !matches) {
      return res.status(400).json({ success: false, error: 'tenderId ve matches gerekli' });
    }

    // tender_tracking tablosundaki analysis_summary JSON'una ingredient_matches ekle
    const result = await query(
      `UPDATE tender_tracking
       SET analysis_summary = jsonb_set(
         COALESCE(analysis_summary, '{}'::jsonb),
         '{ingredient_matches}',
         $2::jsonb
       ),
       updated_at = NOW()
       WHERE tender_id = $1
       RETURNING id`,
      [tenderId, JSON.stringify({ matches, saved_at: new Date().toISOString(), saved_by: req.user?.id || null })]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'İhale bulunamadı' });
    }

    logger.info(`[İhale Masası] ${matches.length} malzeme eşleştirmesi kaydedildi`, { tenderId });

    return res.json({
      success: true,
      saved: matches.length,
      message: `${matches.length} eşleştirme kaydedildi`,
    });
  } catch (error) {
    logger.error('[İhale Masası] Eşleştirme kaydetme hatası', { error: error.message });
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/ai/ihale-masasi/ingredient-matches/:tenderId
 * Kaydedilmiş malzeme eşleştirmelerini getir
 */
router.get('/ingredient-matches/:tenderId', optionalAuth, async (req, res) => {
  try {
    const { tenderId } = req.params;
    if (!tenderId) {
      return res.status(400).json({ success: false, error: 'tenderId gerekli' });
    }

    const result = await query(
      `SELECT analysis_summary->'ingredient_matches' as ingredient_matches
       FROM tender_tracking
       WHERE tender_id = $1
       LIMIT 1`,
      [tenderId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'İhale bulunamadı' });
    }

    const data = result.rows[0].ingredient_matches;

    return res.json({
      success: true,
      matches: data?.matches || null,
      saved_at: data?.saved_at || null,
      saved_by: data?.saved_by || null,
    });
  } catch (error) {
    logger.error('[İhale Masası] Eşleştirme getirme hatası', { error: error.message });
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// IHALE SONUC KAYDI (Ogrenme Icin)
// ==========================================

/**
 * POST /api/ai/ihale-masasi/outcome
 * Ihale sonucunu kaydet (kazanilan/kaybedilen)
 */
router.post('/outcome', authenticate, async (req, res) => {
  try {
    const {
      tenderId,
      outcome,
      ourBidAmount,
      winningBidAmount,
      winnerCompany,
      reason,
      lessonsLearned,
      actualProfitMargin,
    } = req.body;

    if (!tenderId || !outcome) {
      return res.status(400).json({ success: false, error: 'tenderId ve outcome zorunlu' });
    }

    if (!['won', 'lost', 'cancelled', 'no_bid'].includes(outcome)) {
      return res.status(400).json({ success: false, error: 'outcome: won, lost, cancelled veya no_bid olmali' });
    }

    // Mevcut AI verdict ve risk skorlarini al
    const analysesResult = await query(
      `SELECT agent_id, risk_score FROM agent_analyses
       WHERE tender_id = $1 AND status = 'complete'`,
      [tenderId]
    );
    const agentRiskScores = {};
    for (const row of analysesResult.rows) {
      agentRiskScores[row.agent_id] = row.risk_score;
    }

    const verdictResult = await query(
      `SELECT analysis_summary->'ai_verdict' as verdict
       FROM tender_tracking WHERE tender_id = $1 LIMIT 1`,
      [tenderId]
    );
    const agentVerdict = verdictResult.rows[0]?.verdict?.verdict || null;

    const result = await query(
      `INSERT INTO tender_outcomes
        (tender_id, outcome, our_bid_amount, winning_bid_amount, winner_company,
         reason, lessons_learned, agent_verdict, agent_risk_scores, actual_profit_margin, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (tender_id) DO UPDATE SET
         outcome = EXCLUDED.outcome,
         our_bid_amount = EXCLUDED.our_bid_amount,
         winning_bid_amount = EXCLUDED.winning_bid_amount,
         winner_company = EXCLUDED.winner_company,
         reason = EXCLUDED.reason,
         lessons_learned = EXCLUDED.lessons_learned,
         agent_verdict = COALESCE(EXCLUDED.agent_verdict, tender_outcomes.agent_verdict),
         agent_risk_scores = COALESCE(EXCLUDED.agent_risk_scores, tender_outcomes.agent_risk_scores),
         actual_profit_margin = EXCLUDED.actual_profit_margin,
         updated_at = NOW()
       RETURNING id`,
      [
        tenderId,
        outcome,
        ourBidAmount || null,
        winningBidAmount || null,
        winnerCompany || null,
        reason || null,
        lessonsLearned || null,
        agentVerdict,
        JSON.stringify(agentRiskScores),
        actualProfitMargin || null,
        req.user?.username || 'default',
      ]
    );

    // Past learning cache temizle
    invalidatePastLearningCache();

    logger.info(`[Ihale Outcome] Sonuc kaydedildi: tender=${tenderId}, outcome=${outcome}`, {
      tenderId,
      outcome,
      id: result.rows[0].id,
    });

    return res.json({
      success: true,
      id: result.rows[0].id,
      message: `Ihale sonucu "${outcome}" olarak kaydedildi. Ajanlar bu veriden ogrenecek.`,
    });
  } catch (error) {
    logger.error('[Ihale Outcome] Kayit hatasi', { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/ai/ihale-masasi/outcomes
 * Tum ihale sonuclarini listele
 */
router.get('/outcomes', authenticate, async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;
    const result = await query(
      `SELECT
        to2.*,
        t.title as tender_title,
        t.organization_name,
        t.city,
        t.estimated_cost
       FROM tender_outcomes to2
       JOIN tenders t ON t.id = to2.tender_id
       ORDER BY to2.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    return res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('[Ihale Outcomes] Liste hatasi', { error: error.message });
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
