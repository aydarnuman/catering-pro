/**
 * İhale Past Learning Service
 * ============================
 *
 * Sanal İhale Masası ajanlarına geçmiş ihale sonuçlarını öğretir.
 * Kazanılan/kaybedilen ihalelerin analiz sonuçlarını few-shot örnek
 * olarak agent prompt'larına enjekte eder.
 *
 * Öğrenme akışı:
 *   1. tender_outcomes tablosundan geçmiş sonuçları yükle
 *   2. agent_analyses tablosundan o ihalelerin AI analizlerini al
 *   3. Kazanılan → "başarılı örnek", kaybedilen → "dikkat edilmesi gereken" olarak formatte
 *   4. buildAnalysisPrompt'a ek section olarak enjekte et
 */

import { query } from '../database.js';
import logger from '../utils/logger.js';

// Cache: 30 dakika geçerli (sonuçlar sık değişmez)
const _cache = {};
const CACHE_TTL_MS = 30 * 60 * 1000;

/**
 * Belirli bir agent için geçmiş ihale sonuçlarını ve analizleri yükle.
 * Prompt'a enjekte edilecek few-shot örnekleri döndürür.
 *
 * @param {string} agentId - mevzuat | maliyet | teknik | rekabet
 * @returns {Promise<string>} Prompt section metni
 */
export async function getPastLearningSection(agentId) {
  const cacheKey = `past_learning_${agentId}`;
  if (_cache[cacheKey] && Date.now() - _cache[cacheKey].time < CACHE_TTL_MS) {
    return _cache[cacheKey].data;
  }

  try {
    // 1. Sonuçlanmış ihalelerin AI analizlerini al (won + lost)
    const pastResults = await query(
      `SELECT
        t.title,
        t.organization_name,
        t.city,
        t.estimated_cost,
        to2.outcome,
        to2.our_bid_amount,
        to2.winning_bid_amount,
        to2.reason,
        to2.lessons_learned,
        to2.agent_verdict,
        to2.agent_risk_scores,
        to2.actual_profit_margin,
        aa.findings,
        aa.risk_score,
        aa.summary,
        aa.key_risks,
        aa.recommendations
      FROM tender_outcomes to2
      JOIN tenders t ON t.id = to2.tender_id
      LEFT JOIN agent_analyses aa ON aa.tender_id = to2.tender_id
        AND aa.agent_id = $1
        AND aa.status = 'complete'
      WHERE to2.outcome IN ('won', 'lost')
      ORDER BY to2.created_at DESC
      LIMIT 6`,
      [agentId]
    );

    if (pastResults.rows.length === 0) {
      _cache[cacheKey] = { data: '', time: Date.now() };
      return '';
    }

    // 2. Won ve Lost olarak ayır
    const wonTenders = pastResults.rows.filter((r) => r.outcome === 'won');
    const lostTenders = pastResults.rows.filter((r) => r.outcome === 'lost');

    let section = `\n## 📚 GEÇMİŞ İHALE DENEYİMLERİ (Öğrenme Verileri)\n`;
    section += 'Aşağıdaki geçmiş ihale sonuçlarını analiz kaliteni artırmak için referans al.\n';

    // 3. Kazanılan ihaleler
    if (wonTenders.length > 0) {
      section += '\n### ✅ KAZANILAN İHALELER (Başarılı Örnekler)\n';
      for (const t of wonTenders.slice(0, 3)) {
        section += formatPastTender(t, agentId);
      }
    }

    // 4. Kaybedilen ihaleler
    if (lostTenders.length > 0) {
      section += '\n### ❌ KAYBEDİLEN İHALELER (Dikkat Edilmesi Gerekenler)\n';
      for (const t of lostTenders.slice(0, 3)) {
        section += formatPastTender(t, agentId);
      }
    }

    // 5. Genel öğrenme özeti
    const avgWonRisk =
      wonTenders.length > 0
        ? Math.round(wonTenders.reduce((s, t) => s + (t.risk_score || 50), 0) / wonTenders.length)
        : null;
    const avgLostRisk =
      lostTenders.length > 0
        ? Math.round(lostTenders.reduce((s, t) => s + (t.risk_score || 50), 0) / lostTenders.length)
        : null;

    if (avgWonRisk !== null || avgLostRisk !== null) {
      section += '\n### 📊 İSTATİSTİKLER\n';
      if (avgWonRisk !== null) section += `- Kazanılan ihalelerde ortalama risk skorum: ${avgWonRisk}/100\n`;
      if (avgLostRisk !== null) section += `- Kaybedilen ihalelerde ortalama risk skorum: ${avgLostRisk}/100\n`;
      section += '- Bu verileri göz önünde bulundurarak risk skorlamanı kalibre et.\n';
    }

    _cache[cacheKey] = { data: section, time: Date.now() };

    logger.debug(`[İhale Past Learning] ${agentId}: ${pastResults.rows.length} geçmiş sonuç yüklendi`, {
      won: wonTenders.length,
      lost: lostTenders.length,
    });

    return section;
  } catch (error) {
    logger.error('[İhale Past Learning] Yükleme hatası', { error: error.message, agentId });
    return '';
  }
}

/**
 * Tek bir geçmiş ihaleyi prompt formatına dönüştür.
 */
function formatPastTender(t, _agentId) {
  let text = `\n**${t.title || 'İsimsiz'}** (${t.organization_name || '?'}, ${t.city || '?'})\n`;

  if (t.estimated_cost) {
    text += `- Tahmini Bedel: ${Number(t.estimated_cost).toLocaleString('tr-TR')} TL\n`;
  }
  if (t.our_bid_amount) {
    text += `- Teklifimiz: ${Number(t.our_bid_amount).toLocaleString('tr-TR')} TL\n`;
  }
  if (t.winning_bid_amount) {
    text += `- Kazanan Teklif: ${Number(t.winning_bid_amount).toLocaleString('tr-TR')} TL\n`;
  }
  if (t.winner_company && t.outcome === 'lost') {
    text += `- Kazanan: ${t.winner_company}\n`;
  }
  if (t.actual_profit_margin && t.outcome === 'won') {
    text += `- Gerçek Kar Marjı: %${t.actual_profit_margin}\n`;
  }

  // AI analiz özeti
  if (t.risk_score !== null && t.risk_score !== undefined) {
    text += `- Senin Risk Skorun: ${t.risk_score}/100\n`;
  }
  if (t.summary) {
    text += `- Analiz Özetin: ${t.summary}\n`;
  }

  // Anahtar riskler
  if (t.key_risks?.length > 0) {
    text += `- Tespit Ettiğin Riskler: ${t.key_risks.slice(0, 3).join('; ')}\n`;
  }

  // Gerçek sonuç nedeni
  if (t.reason) {
    text += `- **Sonuç Nedeni:** ${t.reason}\n`;
  }
  if (t.lessons_learned) {
    text += `- **Ders:** ${t.lessons_learned}\n`;
  }

  // AI verdict vs gerçek sonuç karşılaştırması
  if (t.agent_verdict) {
    const correct =
      (t.agent_verdict === 'go' && t.outcome === 'won') || (t.agent_verdict === 'dont-bid' && t.outcome === 'lost');
    text += `- AI Karar: ${t.agent_verdict} → ${correct ? '✅ Doğru tahmin' : '⚠️ Yanlış tahmin'}\n`;
  }

  return text;
}

/**
 * Cache'i temizle
 */
export function invalidatePastLearningCache() {
  for (const key of Object.keys(_cache)) {
    delete _cache[key];
  }
}

export default {
  getPastLearningSection,
  invalidatePastLearningCache,
};
