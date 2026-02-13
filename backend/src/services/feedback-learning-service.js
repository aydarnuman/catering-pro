/**
 * Feedback Learning Service
 * =========================
 *
 * AI feedback verisini analiz edip prompt iyileştirme,
 * model seçimi ve template sıralama kararlarına dönüştürür.
 *
 * Öğrenme döngüsü:
 *   1. Negatif feedback'lerden anti-pattern çıkar → system prompt'a ekle
 *   2. Template bazlı başarı oranlarını hesapla → sıralama öner
 *   3. Model bazlı performans karşılaştır → otomatik model seçimi
 *   4. Sık yapılan hata pattern'lerini belirle → negatif örnek olarak ekle
 */

import { query } from '../database.js';
import logger from '../utils/logger.js';

// Cache: 15 dakika geçerli (feedback verileri sık değişmez)
let _feedbackInsightsCache = null;
let _feedbackInsightsCacheTime = 0;
const CACHE_TTL_MS = 15 * 60 * 1000;

/**
 * Son 30 gündeki feedback'lerden anti-pattern'leri çıkar.
 * Negatif feedback'li yanıtların ortak özelliklerini belirler.
 *
 * @returns {Promise<string>} System prompt'a eklenecek uyarı metni
 */
export async function getFeedbackInsightsForPrompt() {
  // Cache kontrolü
  if (_feedbackInsightsCache && Date.now() - _feedbackInsightsCacheTime < CACHE_TTL_MS) {
    return _feedbackInsightsCache;
  }

  try {
    // 1. Negatif feedback pattern'leri (rating <= 2 veya feedback_type = 'wrong'/'not_helpful')
    const negativePatterns = await query(`
      SELECT 
        message_content,
        ai_response,
        feedback_type,
        comment,
        template_slug,
        tools_used
      FROM ai_feedback
      WHERE (rating <= 2 OR feedback_type IN ('wrong', 'not_helpful'))
        AND created_at > NOW() - INTERVAL '30 days'
        AND message_content IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 20
    `);

    // 2. Feedback türü dağılımı
    const typeDistribution = await query(`
      SELECT 
        feedback_type,
        COUNT(*) as count,
        AVG(rating)::numeric(3,2) as avg_rating
      FROM ai_feedback
      WHERE created_at > NOW() - INTERVAL '30 days'
        AND feedback_type IS NOT NULL
      GROUP BY feedback_type
      ORDER BY count DESC
    `);

    // 3. Template bazlı başarı oranları (gelecekte kullanılacak)
    const _templatePerformance = await query(`
      SELECT 
        template_slug,
        COUNT(*) as total,
        COUNT(CASE WHEN rating >= 4 THEN 1 END) as positive,
        COUNT(CASE WHEN rating <= 2 THEN 1 END) as negative,
        AVG(rating)::numeric(3,2) as avg_rating,
        AVG(response_time_ms)::integer as avg_response_time
      FROM ai_feedback
      WHERE created_at > NOW() - INTERVAL '30 days'
        AND template_slug IS NOT NULL
      GROUP BY template_slug
      HAVING COUNT(*) >= 3
      ORDER BY avg_rating DESC
    `);

    // 4. Model bazlı performans (gelecekte kullanılacak)
    const _modelPerformance = await query(`
      SELECT 
        model_used,
        COUNT(*) as total,
        COUNT(CASE WHEN rating >= 4 THEN 1 END) as positive,
        COUNT(CASE WHEN rating <= 2 THEN 1 END) as negative,
        AVG(rating)::numeric(3,2) as avg_rating,
        AVG(response_time_ms)::integer as avg_response_time
      FROM ai_feedback
      WHERE created_at > NOW() - INTERVAL '30 days'
        AND model_used IS NOT NULL
      GROUP BY model_used
      HAVING COUNT(*) >= 3
      ORDER BY avg_rating DESC
    `);

    // Anti-pattern metni oluştur
    let insightsText = '';

    // Negatif pattern'lerden ders çıkar
    if (negativePatterns.rows.length > 0) {
      const wrongAnswers = negativePatterns.rows.filter((r) => r.feedback_type === 'wrong');
      const unhelpful = negativePatterns.rows.filter((r) => r.feedback_type === 'not_helpful');

      const antiPatterns = [];

      // "Yanlış" olarak işaretlenen yanıtlardan ortak temalar çıkar
      if (wrongAnswers.length > 0) {
        const themes = extractCommonThemes(wrongAnswers);
        if (themes.length > 0) {
          antiPatterns.push(...themes.map((t) => `- YANLIŞ YANIT: ${t}`));
        }
      }

      // "Yararsız" olarak işaretlenen yanıtlardan ortak temalar çıkar
      if (unhelpful.length > 0) {
        const themes = extractCommonThemes(unhelpful);
        if (themes.length > 0) {
          antiPatterns.push(...themes.map((t) => `- YARDIMCI OLMAYAN: ${t}`));
        }
      }

      // Kullanıcı yorumlarından öğrenme
      const comments = negativePatterns.rows
        .filter((r) => r.comment && r.comment.trim().length > 5)
        .map((r) => r.comment.trim())
        .slice(0, 5);

      if (comments.length > 0) {
        antiPatterns.push(...comments.map((c) => `- KULLANICI ŞİKAYETİ: "${c}"`));
      }

      if (antiPatterns.length > 0) {
        insightsText += `
## ⚠️ GERİ BİLDİRİMLERDEN ÖĞRENME (BUNLARI YAPMA!)
Kullanıcılar şu tür yanıtlardan memnun kalmamış:
${antiPatterns.slice(0, 8).join('\n')}
Bu hataları tekrarlama. Daha dikkatli ve doğru yanıtlar ver.
`;
      }
    }

    // Feedback dağılımı kontrolü
    const wrongCount = typeDistribution.rows.find((r) => r.feedback_type === 'wrong')?.count || 0;
    const totalFeedback = typeDistribution.rows.reduce((sum, r) => sum + parseInt(r.count, 10), 0);

    if (wrongCount > 0 && totalFeedback > 0) {
      const wrongRate = ((wrongCount / totalFeedback) * 100).toFixed(0);
      if (parseInt(wrongRate, 10) > 20) {
        insightsText += `\nDİKKAT: Yanıtların %${wrongRate}'i yanlış olarak işaretlenmiş. Daha dikkatli ol!\n`;
      }
    }

    _feedbackInsightsCache = insightsText;
    _feedbackInsightsCacheTime = Date.now();

    logger.debug('[Feedback Learning] Insights güncellendi', {
      negativeCount: negativePatterns.rows.length,
      insightsLength: insightsText.length,
    });

    return insightsText;
  } catch (error) {
    logger.error('[Feedback Learning] Insights oluşturma hatası', { error: error.message });
    return '';
  }
}

/**
 * Template bazlı performans verilerini döndürür.
 * En başarılı template'leri üste sıralar.
 *
 * @returns {Promise<Array>} Template performans listesi
 */
export async function getTemplateRankings() {
  try {
    const result = await query(`
      SELECT 
        template_slug,
        COUNT(*) as total_uses,
        COUNT(CASE WHEN rating >= 4 THEN 1 END) as positive,
        COUNT(CASE WHEN rating <= 2 THEN 1 END) as negative,
        AVG(rating)::numeric(3,2) as avg_rating,
        AVG(response_time_ms)::integer as avg_response_time
      FROM ai_feedback
      WHERE created_at > NOW() - INTERVAL '60 days'
        AND template_slug IS NOT NULL
      GROUP BY template_slug
      HAVING COUNT(*) >= 2
      ORDER BY avg_rating DESC, positive DESC
    `);

    return result.rows;
  } catch (error) {
    logger.error('[Feedback Learning] Template ranking hatası', { error: error.message });
    return [];
  }
}

/**
 * Model bazlı performans verilerini döndürür.
 * Otomatik model seçimi için kullanılır.
 *
 * @returns {Promise<{bestModel: string|null, rankings: Array}>}
 */
export async function getModelRankings() {
  try {
    const result = await query(`
      SELECT 
        model_used,
        COUNT(*) as total_uses,
        COUNT(CASE WHEN rating >= 4 THEN 1 END) as positive,
        COUNT(CASE WHEN rating <= 2 THEN 1 END) as negative,
        AVG(rating)::numeric(3,2) as avg_rating,
        AVG(response_time_ms)::integer as avg_response_time
      FROM ai_feedback
      WHERE created_at > NOW() - INTERVAL '60 days'
        AND model_used IS NOT NULL
      GROUP BY model_used
      HAVING COUNT(*) >= 5
      ORDER BY avg_rating DESC
    `);

    const bestModel = result.rows.length > 0 ? result.rows[0].model_used : null;

    return {
      bestModel,
      rankings: result.rows,
    };
  } catch (error) {
    logger.error('[Feedback Learning] Model ranking hatası', { error: error.message });
    return { bestModel: null, rankings: [] };
  }
}

/**
 * Cache'i temizle (feedback eklendiğinde çağrılabilir)
 */
export function invalidateFeedbackCache() {
  _feedbackInsightsCache = null;
  _feedbackInsightsCacheTime = 0;
}

// ═══════════════════════════════════════════════════════════════
// YARDIMCI FONKSİYONLAR
// ═══════════════════════════════════════════════════════════════

/**
 * Negatif feedback'lerden ortak temaları çıkar.
 * Basit keyword/pattern analizi yapar (LLM kullanmadan).
 */
function extractCommonThemes(feedbackRows) {
  const themes = [];
  const keywordCounts = {};

  for (const row of feedbackRows) {
    const text = `${row.message_content || ''} ${row.comment || ''}`.toLowerCase();

    // Sık geçen sorun kategorileri
    const patterns = [
      { regex: /yanlış|hata|yanl[ıi]ş/i, theme: 'Yanlış bilgi verme' },
      { regex: /eksik|tam değil|yetersiz/i, theme: 'Eksik yanıt verme' },
      { regex: /anlamad[ıi]|yanlış anlad[ıi]/i, theme: 'Soruyu yanlış anlama' },
      { regex: /uzun|gereksiz|fazla/i, theme: 'Gereksiz uzun yanıtlar' },
      { regex: /fiyat|tutar|maliyet/i, theme: 'Fiyat/maliyet hesaplama hatası' },
      { regex: /sipariş|order/i, theme: 'Sipariş işlem hatası' },
      { regex: /tool|arac|fonksiyon/i, theme: 'Yanlış tool kullanımı' },
      { regex: /tarih|zaman|süre/i, theme: 'Tarih/zaman bilgisi hatası' },
      { regex: /tekrar|ayn[ıi]/i, theme: 'Tekrarlayan yanıtlar' },
    ];

    for (const pattern of patterns) {
      if (pattern.regex.test(text)) {
        keywordCounts[pattern.theme] = (keywordCounts[pattern.theme] || 0) + 1;
      }
    }
  }

  // En az 2 kez tekrarlayan temaları döndür
  for (const [theme, count] of Object.entries(keywordCounts)) {
    if (count >= 2) {
      themes.push(`${theme} (${count}x tekrarlanmış)`);
    }
  }

  // Hiç pattern eşleşmezse, en son yorumları direkt ekle
  if (themes.length === 0 && feedbackRows.length > 0) {
    const recentComments = feedbackRows
      .filter((r) => r.comment && r.comment.trim().length > 5)
      .slice(0, 3)
      .map((r) => r.comment.trim());

    if (recentComments.length > 0) {
      themes.push(...recentComments);
    }
  }

  return themes;
}

export default {
  getFeedbackInsightsForPrompt,
  getTemplateRankings,
  getModelRankings,
  invalidateFeedbackCache,
};
