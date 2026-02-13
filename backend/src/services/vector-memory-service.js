/**
 * Vector Memory Service
 * =====================
 *
 * pgvector tabanlı semantic memory sistemi.
 * AI memory'ye embedding ekler ve semantic search ile ilgili hafızaları bulur.
 *
 * Embedding API: Anthropic Claude (voyage-3-lite) veya Supabase AI (gte-small)
 * Fallback: SQL bazlı keyword arama (embedding yoksa)
 *
 * Kullanım:
 *   import { searchMemorySemantic, generateAndStoreEmbedding } from './vector-memory-service.js';
 *
 *   // Semantic search
 *   const results = await searchMemorySemantic('KYK projesinin bütçesi', 'default');
 *
 *   // Memory'ye embedding ekle
 *   await generateAndStoreEmbedding(memoryId, 'ABC Gıda tedarikçimizdir');
 */

import { query } from '../database.js';
import logger from '../utils/logger.js';

// Embedding model — Voyage 3 Lite (1536 dim, hızlı, ucuz)
// Fallback: Basit TF-IDF benzeri hash (embedding API yoksa)
const EMBEDDING_MODEL = 'voyage-3-lite';
const EMBEDDING_DIMENSIONS = 1536;

/**
 * Metin için embedding üret (Anthropic Voyage API)
 *
 * @param {string} text - Embed edilecek metin
 * @returns {Promise<number[]|null>} 1536 boyutlu embedding vektörü veya null
 */
export async function generateEmbedding(text) {
  if (!text || text.trim().length === 0) return null;

  try {
    // Anthropic'in embedding API'si henüz direkt desteklenmiyorsa,
    // basit bir Claude-tabanlı hash kullan
    // NOT: Gerçek production'da Voyage API veya OpenAI text-embedding-3-small kullanılabilir

    // Voyage API denemesi
    if (process.env.VOYAGE_API_KEY) {
      const response = await fetch('https://api.voyageai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
        },
        body: JSON.stringify({
          model: EMBEDDING_MODEL,
          input: [text.slice(0, 8000)], // Max input length
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.data?.[0]?.embedding || null;
      }
      logger.warn('[Vector Memory] Voyage API hatası, fallback kullanılacak', {
        status: response.status,
      });
    }

    // Supabase AI Gateway denemesi (gte-small model)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
    if (supabaseUrl && supabaseKey) {
      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/embed`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({ input: text.slice(0, 4000) }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data?.embedding) return data.embedding;
        }
      } catch (_err) {
        // Supabase embed edge function yoksa devam et
      }
    }

    // Fallback: Basit deterministic hash-based embedding (geçici çözüm)
    // Bu, gerçek semantic search kalitesi vermez ama yapıyı test etmeye yarar
    return generateSimpleEmbedding(text);
  } catch (error) {
    logger.error('[Vector Memory] Embedding üretim hatası', { error: error.message });
    return null;
  }
}

/**
 * AI Memory kaydına embedding ekle/güncelle
 *
 * @param {number} memoryId - ai_memory.id
 * @param {string} text - Embed edilecek metin (genellikle key + value)
 * @returns {Promise<boolean>}
 */
export async function generateAndStoreEmbedding(memoryId, text) {
  try {
    const embedding = await generateEmbedding(text);
    if (!embedding) return false;

    await query(`UPDATE ai_memory SET embedding = $1::vector WHERE id = $2`, [`[${embedding.join(',')}]`, memoryId]);

    return true;
  } catch (error) {
    logger.error('[Vector Memory] Embedding kaydetme hatası', { error: error.message, memoryId });
    return false;
  }
}

/**
 * Agent Knowledge Base kaydına embedding ekle
 *
 * @param {number} knowledgeId - agent_knowledge_base.id
 * @param {string} text - Embed edilecek metin
 * @returns {Promise<boolean>}
 */
export async function generateAndStoreKnowledgeEmbedding(knowledgeId, text) {
  try {
    const embedding = await generateEmbedding(text);
    if (!embedding) return false;

    await query(`UPDATE agent_knowledge_base SET embedding = $1::vector, chunk_text = $2 WHERE id = $3`, [
      `[${embedding.join(',')}]`,
      text.slice(0, 10000),
      knowledgeId,
    ]);

    return true;
  } catch (error) {
    logger.error('[Vector Memory] Knowledge embedding kaydetme hatası', { error: error.message, knowledgeId });
    return false;
  }
}

/**
 * Semantic memory search — Kullanıcı sorusuna en ilgili memory'leri bul
 *
 * @param {string} queryText - Arama metni
 * @param {string} userId - Kullanıcı ID
 * @param {number} limit - Maks sonuç sayısı
 * @param {number} threshold - Min similarity skoru (0-1)
 * @returns {Promise<Array>} Benzerlik skoruyla sıralı memory listesi
 */
export async function searchMemorySemantic(queryText, userId = 'default', limit = 10, threshold = 0.7) {
  try {
    const queryEmbedding = await generateEmbedding(queryText);
    if (!queryEmbedding) {
      // Fallback: SQL bazlı arama
      return searchMemoryKeyword(queryText, userId, limit);
    }

    const result = await query(`SELECT * FROM search_memory_semantic($1::vector, $2, $3, $4)`, [
      `[${queryEmbedding.join(',')}]`,
      threshold,
      limit,
      userId,
    ]);

    return result.rows;
  } catch (error) {
    logger.error('[Vector Memory] Semantic search hatası', { error: error.message });
    // Fallback
    return searchMemoryKeyword(queryText, userId, limit);
  }
}

/**
 * Semantic knowledge search — Agent bilgi tabanında arama
 *
 * @param {string} queryText - Arama metni
 * @param {string} agentId - Agent ID (opsiyonel, null=tüm ajanlar)
 * @param {number} limit - Maks sonuç
 * @returns {Promise<Array>}
 */
export async function searchKnowledgeSemantic(queryText, agentId = null, limit = 5) {
  try {
    const queryEmbedding = await generateEmbedding(queryText);
    if (!queryEmbedding) return [];

    const result = await query(`SELECT * FROM search_knowledge_semantic($1::vector, $2, 0.6, $3)`, [
      `[${queryEmbedding.join(',')}]`,
      agentId,
      limit,
    ]);

    return result.rows;
  } catch (error) {
    logger.error('[Vector Memory] Knowledge semantic search hatası', { error: error.message });
    return [];
  }
}

/**
 * Mevcut memory'lere toplu embedding ekle (batch işlem)
 * İlk kurulumda veya periyodik güncelleme için kullanılır.
 *
 * @param {number} batchSize - Tek seferde işlenecek kayıt sayısı
 * @returns {Promise<{processed: number, errors: number}>}
 */
export async function backfillEmbeddings(batchSize = 50) {
  try {
    // Embedding'i olmayan memory'leri al
    const missing = await query(
      `SELECT id, key, value, memory_type, category
       FROM ai_memory
       WHERE embedding IS NULL
       ORDER BY importance DESC, usage_count DESC
       LIMIT $1`,
      [batchSize]
    );

    let processed = 0;
    let errors = 0;

    for (const row of missing.rows) {
      const text = `${row.category || ''}: ${row.key} — ${row.value}`;
      const success = await generateAndStoreEmbedding(row.id, text);
      if (success) {
        processed++;
      } else {
        errors++;
      }
    }

    logger.info(`[Vector Memory] Backfill tamamlandı: ${processed} işlendi, ${errors} hata`, {
      processed,
      errors,
      total: missing.rows.length,
    });

    return { processed, errors };
  } catch (error) {
    logger.error('[Vector Memory] Backfill hatası', { error: error.message });
    return { processed: 0, errors: 0 };
  }
}

// ═══════════════════════════════════════════════════════════════
// YARDIMCI FONKSİYONLAR
// ═══════════════════════════════════════════════════════════════

/**
 * Fallback: SQL bazlı keyword arama (embedding yoksa)
 */
async function searchMemoryKeyword(queryText, userId, limit) {
  try {
    const result = await query(
      `SELECT id, memory_type, category, key, value, importance, usage_count,
              0.5::float as similarity
       FROM ai_memory
       WHERE user_id = $1
         AND (key ILIKE '%' || $2 || '%' OR value ILIKE '%' || $2 || '%')
       ORDER BY importance DESC, usage_count DESC
       LIMIT $3`,
      [userId, queryText.slice(0, 100), limit]
    );
    return result.rows;
  } catch (error) {
    logger.error('[Vector Memory] Keyword search hatası', { error: error.message });
    return [];
  }
}

/**
 * Basit deterministic embedding üreteci (fallback)
 * Gerçek semantic kalite vermez, ama yapıyı test etmeye yarar.
 * Production'da Voyage API veya OpenAI embedding kullanılmalı.
 */
function generateSimpleEmbedding(text) {
  const normalized = text.toLowerCase().trim();
  const embedding = new Array(EMBEDDING_DIMENSIONS).fill(0);

  // Basit character-level hashing
  for (let i = 0; i < normalized.length && i < 5000; i++) {
    const charCode = normalized.charCodeAt(i);
    const idx = (charCode * (i + 1) * 31) % EMBEDDING_DIMENSIONS;
    embedding[idx] += 1.0 / (1 + Math.floor(i / 100));
  }

  // Normalize (unit vector)
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  if (magnitude > 0) {
    for (let i = 0; i < embedding.length; i++) {
      embedding[i] /= magnitude;
    }
  }

  return embedding;
}

export default {
  generateEmbedding,
  generateAndStoreEmbedding,
  generateAndStoreKnowledgeEmbedding,
  searchMemorySemantic,
  searchKnowledgeSemantic,
  backfillEmbeddings,
};
