/**
 * AI Cost Tracking Service
 * Claude API kullanım ve maliyet takibi
 *
 * Fiyatlandırma (Ocak 2025):
 * - Claude Sonnet 4: Input $3/1M tokens, Output $15/1M tokens
 * - Claude Haiku 3: Input $0.25/1M tokens, Output $1.25/1M tokens
 * - Claude Opus 4.5: Input $15/1M tokens, Output $75/1M tokens
 */

import { query } from '../database.js';
import logger from '../utils/logger.js';

// Model fiyatlandırması (USD per 1M tokens)
const PRICING = {
  'claude-sonnet-4-20250514': {
    input: 3 / 1_000_000, // $3 per 1M tokens
    output: 15 / 1_000_000, // $15 per 1M tokens
    name: 'Claude Sonnet 4',
  },
  'claude-3-haiku-20240307': {
    input: 0.25 / 1_000_000,
    output: 1.25 / 1_000_000,
    name: 'Claude Haiku 3',
  },
  'claude-opus-4-5-20251101': {
    input: 15 / 1_000_000,
    output: 75 / 1_000_000,
    name: 'Claude Opus 4.5',
  },
};

// Varsayılan günlük bütçe limiti (USD)
const DEFAULT_DAILY_BUDGET_USD = 50;

/**
 * AI kullanımını kaydet ve maliyeti hesapla
 *
 * @param {Object} params - Tracking parametreleri
 * @param {string} params.userId - Kullanıcı ID
 * @param {string} params.endpoint - API endpoint ('/api/ai/chat', etc.)
 * @param {string} params.model - Model adı ('claude-sonnet-4-20250514')
 * @param {string} params.sessionId - Session ID (opsiyonel)
 * @param {number} params.inputTokens - Input token sayısı
 * @param {number} params.outputTokens - Output token sayısı
 * @param {string} params.promptTemplate - Kullanılan prompt şablonu (opsiyonel)
 * @param {Array<string>} params.toolsUsed - Kullanılan tool'lar (opsiyonel)
 * @param {number} params.responseTimeMs - Yanıt süresi ms (opsiyonel)
 * @param {boolean} params.success - İstek başarılı mı? (varsayılan: true)
 * @param {string} params.errorMessage - Hata mesajı (varsa)
 * @returns {Promise<{success: boolean, costUsd: number, costTl: number, id: number}>}
 */
export async function trackAIUsage({
  userId = 'default',
  endpoint,
  model,
  sessionId = null,
  inputTokens = 0,
  outputTokens = 0,
  promptTemplate = null,
  toolsUsed = [],
  responseTimeMs = null,
  success = true,
  errorMessage = null,
}) {
  try {
    // Model fiyatlandırmasını al (varsayılan: Sonnet 4)
    const pricing = PRICING[model] || PRICING['claude-sonnet-4-20250514'];

    // Maliyet hesapla
    const inputCostUsd = inputTokens * pricing.input;
    const outputCostUsd = outputTokens * pricing.output;
    const _totalCostUsd = inputCostUsd + outputCostUsd;

    // Veritabanına kaydet
    const result = await query(
      `
      INSERT INTO ai_usage_tracking (
        user_id, endpoint, model, session_id,
        input_tokens, output_tokens,
        input_cost_usd, output_cost_usd,
        prompt_template, tools_used, response_time_ms,
        success, error_message
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING id, total_cost_usd, total_cost_tl
    `,
      [
        userId,
        endpoint,
        model,
        sessionId,
        inputTokens,
        outputTokens,
        inputCostUsd,
        outputCostUsd,
        promptTemplate,
        JSON.stringify(toolsUsed),
        responseTimeMs,
        success,
        errorMessage,
      ]
    );

    const record = result.rows[0];

    logger.info('✅ AI kullanımı kaydedildi', {
      trackingId: record.id,
      userId,
      endpoint,
      model: pricing.name || model,
      totalTokens: inputTokens + outputTokens,
      costUsd: record.total_cost_usd,
      costTl: record.total_cost_tl,
      responseTimeMs,
    });

    // Günlük bütçe kontrolü (async - blocking olmadan)
    checkDailyBudget().catch((err) => {
      logger.error('Budget check hatası', { error: err.message });
    });

    return {
      success: true,
      id: record.id,
      costUsd: parseFloat(record.total_cost_usd),
      costTl: parseFloat(record.total_cost_tl),
    };
  } catch (error) {
    logger.error('❌ AI usage tracking hatası', {
      error: error.message,
      stack: error.stack,
      userId,
      endpoint,
      model,
    });

    // Tracking hatası olsa bile request'i bloklama
    return {
      success: false,
      error: error.message,
      costUsd: 0,
      costTl: 0,
    };
  }
}

/**
 * Günlük bütçe kontrolü
 * Eğer günlük limit aşıldıysa uyarı logla
 *
 * @param {number} budgetLimitUsd - Günlük bütçe limiti (varsayılan: $50)
 * @returns {Promise<Object>}
 */
export async function checkDailyBudget(budgetLimitUsd = DEFAULT_DAILY_BUDGET_USD) {
  try {
    const result = await query(`SELECT * FROM check_daily_budget($1)`, [budgetLimitUsd]);

    if (result.rows.length === 0) {
      return { exceeded: false };
    }

    const budget = result.rows[0];

    if (budget.budget_exceeded) {
      logger.warn('🚨 GÜNLÜK BÜTÇE AŞILDI!', {
        todayCostUsd: parseFloat(budget.today_cost_usd),
        todayCostTl: parseFloat(budget.today_cost_tl),
        budgetLimit: parseFloat(budget.budget_limit),
        budgetRemaining: parseFloat(budget.budget_remaining),
        requestCount: budget.request_count,
      });

      // TODO: Email/SMS/Slack notification gönder
      // await sendBudgetAlert(budget);
    } else {
      logger.debug('✅ Günlük bütçe kontrol edildi', {
        todayCostUsd: parseFloat(budget.today_cost_usd),
        budgetRemaining: parseFloat(budget.budget_remaining),
        requestCount: budget.request_count,
      });
    }

    return {
      exceeded: budget.budget_exceeded,
      todayCostUsd: parseFloat(budget.today_cost_usd),
      todayCostTl: parseFloat(budget.today_cost_tl),
      budgetLimit: parseFloat(budget.budget_limit),
      budgetRemaining: parseFloat(budget.budget_remaining),
      requestCount: budget.request_count,
    };
  } catch (error) {
    logger.error('Budget kontrol hatası', { error: error.message });
    return { exceeded: false, error: error.message };
  }
}

/**
 * Kullanım raporu al (tarih aralığı)
 *
 * @param {string} startDate - Başlangıç tarihi (YYYY-MM-DD)
 * @param {string} endDate - Bitiş tarihi (YYYY-MM-DD)
 * @returns {Promise<Array>}
 */
export async function getUsageReport(startDate, endDate) {
  try {
    const result = await query(
      `
      SELECT
        DATE(created_at) as date,
        COUNT(*) as requests,
        SUM(input_tokens) as input_tokens,
        SUM(output_tokens) as output_tokens,
        SUM(total_tokens) as total_tokens,
        SUM(total_cost_usd) as cost_usd,
        SUM(total_cost_tl) as cost_tl,
        AVG(response_time_ms) as avg_response_time_ms,
        COUNT(CASE WHEN success = false THEN 1 END) as error_count
      FROM ai_usage_tracking
      WHERE created_at BETWEEN $1 AND $2
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `,
      [startDate, endDate]
    );

    return result.rows.map((row) => ({
      date: row.date,
      requests: parseInt(row.requests, 10),
      inputTokens: parseInt(row.input_tokens, 10),
      outputTokens: parseInt(row.output_tokens, 10),
      totalTokens: parseInt(row.total_tokens, 10),
      costUsd: parseFloat(row.cost_usd),
      costTl: parseFloat(row.cost_tl),
      avgResponseTimeMs: parseFloat(row.avg_response_time_ms),
      errorCount: parseInt(row.error_count, 10),
    }));
  } catch (error) {
    logger.error('Usage report hatası', { error: error.message });
    return [];
  }
}

/**
 * Aylık toplam maliyet
 *
 * @param {number} year - Yıl (2025)
 * @param {number} month - Ay (1-12)
 * @returns {Promise<Object>}
 */
export async function getMonthlyCost(year, month) {
  try {
    const result = await query(`SELECT * FROM get_monthly_cost($1, $2)`, [year, month]);

    if (result.rows.length === 0) {
      return {
        totalRequests: 0,
        totalTokens: 0,
        totalCostUsd: 0,
        totalCostTl: 0,
        avgCostPerRequest: 0,
      };
    }

    const data = result.rows[0];

    return {
      totalRequests: parseInt(data.total_requests, 10),
      totalTokens: parseInt(data.total_tokens, 10),
      totalCostUsd: parseFloat(data.total_cost_usd),
      totalCostTl: parseFloat(data.total_cost_tl),
      avgCostPerRequest: parseFloat(data.avg_cost_per_request),
    };
  } catch (error) {
    logger.error('Monthly cost hatası', { error: error.message });
    return null;
  }
}

/**
 * Kullanıcı bazlı istatistik (Son 30 gün)
 *
 * @param {string} userId - Kullanıcı ID
 * @returns {Promise<Object>}
 */
export async function getUserStats(userId) {
  try {
    const result = await query(
      `
      SELECT
        COUNT(*) as total_requests,
        SUM(total_tokens) as total_tokens,
        SUM(total_cost_usd) as total_cost_usd,
        SUM(total_cost_tl) as total_cost_tl,
        AVG(response_time_ms) as avg_response_time_ms,
        MAX(created_at) as last_used_at
      FROM ai_usage_tracking
      WHERE user_id = $1
        AND created_at >= CURRENT_DATE - INTERVAL '30 days'
    `,
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const data = result.rows[0];

    return {
      userId,
      totalRequests: parseInt(data.total_requests, 10),
      totalTokens: parseInt(data.total_tokens, 10),
      totalCostUsd: parseFloat(data.total_cost_usd),
      totalCostTl: parseFloat(data.total_cost_tl),
      avgResponseTimeMs: parseFloat(data.avg_response_time_ms),
      lastUsedAt: data.last_used_at,
    };
  } catch (error) {
    logger.error('User stats hatası', { error: error.message });
    return null;
  }
}

/**
 * Endpoint bazlı istatistikler
 *
 * @returns {Promise<Array>}
 */
export async function getEndpointStats() {
  try {
    const result = await query(`SELECT * FROM endpoint_usage_stats`);
    return result.rows;
  } catch (error) {
    logger.error('Endpoint stats hatası', { error: error.message });
    return [];
  }
}

export default {
  trackAIUsage,
  checkDailyBudget,
  getUsageReport,
  getMonthlyCost,
  getUserStats,
  getEndpointStats,
  PRICING,
  DEFAULT_DAILY_BUDGET_USD,
};
