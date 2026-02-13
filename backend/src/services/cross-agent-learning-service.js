/**
 * Cross-Agent Learning Service
 * ==============================
 *
 * Ajanlar arası bilgi paylaşımı ve öğrenme propagasyonu.
 * Bir ajanın öğrendiği bilgiyi diğer ilgili ajanlara yayar.
 *
 * Akış:
 *   1. Agent X bir fact/pattern/insight öğrenir
 *   2. shareLearnning() çağrılır → shared_learnings'e yazılır
 *   3. Hedef ajanlar (veya tümü) bir sonraki çalışmada bu bilgiyi alır
 *   4. getSharedLearningsForAgent() → ilgili öğrenmeleri prompt'a enjekte eder
 *
 * Örnek senaryolar:
 *   - Ana agent "ABC Gıda tedarikçimiz" öğrenirse → maliyet ajanı da bilir
 *   - Mevzuat ajanı yeni KİK kararı bulursa → rekabet ajanı da bilir
 *   - Pipeline yeni format öğrenirse → tüm pipeline ajanları bilir
 */

import { query } from '../database.js';
import logger from '../utils/logger.js';
import { generateEmbedding } from './vector-memory-service.js';

// Cache: 15 dakika
const _cache = {};
const CACHE_TTL_MS = 15 * 60 * 1000;

/**
 * Ajanlar arası bilgi paylaş.
 *
 * @param {Object} params
 * @param {string} params.sourceAgent - Kaynak ajan (main, mevzuat, maliyet, teknik, rekabet, pipeline)
 * @param {string[]} params.targetAgents - Hedef ajanlar (boş = tümü)
 * @param {string} params.learningType - fact | pattern | correction | insight
 * @param {string} params.category - ihale, fatura, personel, stok, genel, mevzuat
 * @param {string} params.key - Bilgi anahtarı
 * @param {string} params.value - Bilgi değeri
 * @param {number} params.importance - 1-10 arası önem
 * @returns {Promise<{success: boolean, id?: number}>}
 */
export async function shareLearning({
  sourceAgent,
  targetAgents = [],
  learningType,
  category,
  key,
  value,
  importance = 5,
}) {
  try {
    const result = await query(
      `INSERT INTO shared_learnings
        (source_agent, target_agents, learning_type, category, key, value, importance)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (source_agent, learning_type, key)
       DO UPDATE SET
         value = EXCLUDED.value,
         importance = GREATEST(shared_learnings.importance, EXCLUDED.importance),
         usage_count = shared_learnings.usage_count + 1,
         target_agents = CASE
           WHEN array_length(EXCLUDED.target_agents, 1) > 0
           THEN EXCLUDED.target_agents
           ELSE shared_learnings.target_agents
         END,
         updated_at = NOW()
       RETURNING id`,
      [sourceAgent, targetAgents, learningType, category, key, value, importance]
    );

    const learningId = result.rows[0]?.id;

    // Arka planda embedding üret
    if (learningId) {
      const text = `${category}: ${key} — ${value}`;
      generateEmbedding(text)
        .then(async (embedding) => {
          if (embedding) {
            await query(`UPDATE shared_learnings SET embedding = $1::vector WHERE id = $2`, [
              `[${embedding.join(',')}]`,
              learningId,
            ]);
          }
        })
        .catch((err) => logger.debug('[Cross-Agent] Embedding hatası', { error: err.message }));
    }

    // Cache temizle
    invalidateCrossAgentCache();

    logger.info(
      `[Cross-Agent] Bilgi paylaşıldı: ${sourceAgent} → ${targetAgents.length > 0 ? targetAgents.join(',') : 'tümü'}`,
      {
        sourceAgent,
        learningType,
        key,
        id: learningId,
      }
    );

    return { success: true, id: learningId };
  } catch (error) {
    logger.error('[Cross-Agent] Paylaşım hatası', { error: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * Belirli bir ajan için paylaşılan öğrenmeleri al.
 * Prompt'a enjekte edilecek section döndürür.
 *
 * @param {string} agentId - Hedef ajan
 * @param {string} category - Kategori filtresi (opsiyonel)
 * @returns {Promise<string>} Prompt section metni
 */
export async function getSharedLearningsForAgent(agentId, category = null) {
  const cacheKey = `shared_${agentId}_${category || 'all'}`;
  if (_cache[cacheKey] && Date.now() - _cache[cacheKey].time < CACHE_TTL_MS) {
    return _cache[cacheKey].data;
  }

  try {
    let sql = `
      SELECT source_agent, learning_type, category, key, value, importance
      FROM shared_learnings
      WHERE is_active = true
        AND (target_agents = '{}' OR $1 = ANY(target_agents))
        AND (expires_at IS NULL OR expires_at > NOW())
    `;
    const params = [agentId];
    let idx = 2;

    if (category) {
      sql += ` AND category = $${idx}`;
      params.push(category);
      idx++;
    }

    sql += ` ORDER BY importance DESC, usage_count DESC LIMIT 15`;

    const result = await query(sql, params);

    if (result.rows.length === 0) {
      _cache[cacheKey] = { data: '', time: Date.now() };
      return '';
    }

    // Kategorilere ayır
    const facts = result.rows.filter((r) => r.learning_type === 'fact');
    const patterns = result.rows.filter((r) => r.learning_type === 'pattern');
    const insights = result.rows.filter((r) => r.learning_type === 'insight');
    const corrections = result.rows.filter((r) => r.learning_type === 'correction');

    let section = `\n## 🔗 DİĞER AJANLARDAN ÖĞRENME\n`;

    if (facts.length > 0) {
      section += '\n**Bilgiler:**\n';
      for (const f of facts) {
        section += `- [${f.source_agent}] ${f.key}: ${f.value}\n`;
      }
    }

    if (patterns.length > 0) {
      section += '\n**Kalıplar:**\n';
      for (const p of patterns) {
        section += `- [${p.source_agent}] ${p.key}: ${p.value}\n`;
      }
    }

    if (insights.length > 0) {
      section += '\n**İçgörüler:**\n';
      for (const i of insights) {
        section += `- [${i.source_agent}] ${i.key}: ${i.value}\n`;
      }
    }

    if (corrections.length > 0) {
      section += '\n**Düzeltmeler:**\n';
      for (const c of corrections) {
        section += `- [${c.source_agent}] ${c.key}: ${c.value}\n`;
      }
    }

    _cache[cacheKey] = { data: section, time: Date.now() };

    return section;
  } catch (error) {
    logger.error('[Cross-Agent] Öğrenme yükleme hatası', { error: error.message, agentId });
    return '';
  }
}

/**
 * Ana agent'ın öğrendiği fact'i ilgili diğer ajanlara propagate et.
 * ai_learned_facts'dan confirmed olanları shared_learnings'e kopyalar.
 *
 * @param {Object} fact - {fact_type, entity_type, entity_name, fact_key, fact_value}
 * @returns {Promise<void>}
 */
export async function propagateFactFromMainAgent(fact) {
  if (!fact?.fact_key || !fact?.fact_value) return;

  // Hangi ajanlar bu bilgiyi kullanabilir?
  const targetMap = {
    tedarikci: ['maliyet', 'rekabet'],
    proje: ['maliyet', 'teknik'],
    personel: ['teknik'],
    urun: ['maliyet', 'teknik'],
    mevzuat: ['mevzuat', 'rekabet'],
    genel: [], // tümüne
  };

  const targets = targetMap[fact.entity_type] || [];

  await shareLearning({
    sourceAgent: 'main',
    targetAgents: targets,
    learningType: 'fact',
    category: fact.entity_type || 'genel',
    key: fact.fact_key,
    value: `${fact.entity_name ? `[${fact.entity_name}] ` : ''}${fact.fact_value}`,
    importance: 5,
  });
}

/**
 * Cache temizle
 */
export function invalidateCrossAgentCache() {
  for (const key of Object.keys(_cache)) {
    delete _cache[key];
  }
}

export default {
  shareLearning,
  getSharedLearningsForAgent,
  propagateFactFromMainAgent,
  invalidateCrossAgentCache,
};
