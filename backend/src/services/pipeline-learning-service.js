/**
 * Pipeline Learning Service
 * ==========================
 *
 * analysis_corrections tablosundaki HITL düzeltme verilerini analiz ederek
 * Claude extraction prompt'larına feedback enjekte eder.
 *
 * Akış:
 *   1. analysis_corrections'dan sık tekrarlayan field_path + correction pattern'leri çıkar
 *   2. pipeline_learned_patterns tablosuna kaydet (veya güncelle)
 *   3. Extraction prompt'larına dinamik "DİKKAT" bölümü olarak enjekte et
 *
 * Kullanım (prompt'larda):
 *   import { getCorrectionHintsForPrompt } from './pipeline-learning-service.js';
 *   const hints = await getCorrectionHintsForPrompt('dates');
 *   const enhancedPrompt = basePrompt + hints;
 */

import { query } from '../database.js';
import logger from '../utils/logger.js';

// Cache: 60 dakika (correction'lar çok sık oluşmaz)
let _correctionHintsCache = {};
let _correctionHintsCacheTime = 0;
const CACHE_TTL_MS = 60 * 60 * 1000;

/**
 * Sık tekrarlayan düzeltme pattern'lerini analiz et ve pipeline_learned_patterns'e kaydet.
 * Bu fonksiyon periyodik olarak çağrılabilir (cron veya manuel).
 *
 * @returns {Promise<{analyzed: number, newPatterns: number}>}
 */
export async function analyzeCorrectionsAndLearn() {
  try {
    // 1. Field_path bazında gruplama — en çok düzeltilen alanlar
    const fieldStats = await query(`
      SELECT 
        field_path,
        correction_type,
        COUNT(*) as count,
        COUNT(DISTINCT document_id) as unique_docs
      FROM analysis_corrections
      WHERE created_at > NOW() - INTERVAL '90 days'
      GROUP BY field_path, correction_type
      HAVING COUNT(*) >= 2
      ORDER BY count DESC
      LIMIT 30
    `);

    if (fieldStats.rows.length === 0) {
      return { analyzed: 0, newPatterns: 0 };
    }

    let newPatterns = 0;

    // 2. Her sık düzeltilen alan için pattern çıkar
    for (const stat of fieldStats.rows) {
      // Bu alan için son düzeltmeleri al
      const corrections = await query(
        `SELECT old_value, new_value, correction_type
         FROM analysis_corrections
         WHERE field_path = $1
           AND created_at > NOW() - INTERVAL '90 days'
         ORDER BY created_at DESC
         LIMIT 10`,
        [stat.field_path]
      );

      // Pattern'leri belirle
      for (const corr of corrections.rows) {
        const oldVal = JSON.stringify(corr.old_value);
        const newVal = JSON.stringify(corr.new_value);

        if (oldVal === newVal) continue;

        // Prompt tipini field_path'ten çıkar
        const promptType = mapFieldToPromptType(stat.field_path);

        try {
          await query(`SELECT upsert_pipeline_pattern($1, $2, $3, $4, $5, $6)`, [
            'correction',
            stat.field_path,
            oldVal,
            newVal,
            null,
            promptType,
          ]);
          newPatterns++;
        } catch (err) {
          // Duplicate veya constraint hatası — devam et
          if (!err.message.includes('duplicate')) {
            logger.warn('[Pipeline Learning] Pattern kayıt hatası', { error: err.message });
          }
        }
      }
    }

    logger.info(`[Pipeline Learning] Analiz tamamlandı`, {
      analyzed: fieldStats.rows.length,
      newPatterns,
    });

    // Cache'i temizle
    _correctionHintsCache = {};
    _correctionHintsCacheTime = 0;

    return { analyzed: fieldStats.rows.length, newPatterns };
  } catch (error) {
    logger.error('[Pipeline Learning] Analiz hatası', { error: error.message });
    return { analyzed: 0, newPatterns: 0 };
  }
}

/**
 * Belirli bir prompt türü için düzeltme ipuçlarını döndür.
 * Extraction prompt'larına ek section olarak eklenir.
 *
 * @param {string} promptType - 'dates' | 'amounts' | 'penalties' | 'personnel' | 'menu' | 'full'
 * @returns {Promise<string>} Prompt'a eklenecek uyarı metni
 */
export async function getCorrectionHintsForPrompt(promptType) {
  // Cache kontrolü
  if (_correctionHintsCache[promptType] !== undefined && Date.now() - _correctionHintsCacheTime < CACHE_TTL_MS) {
    return _correctionHintsCache[promptType];
  }

  try {
    // 1. Bu prompt türü için aktif pattern'leri al
    const patterns = await query(
      `SELECT field_name, wrong_pattern, correct_pattern, frequency, confidence, source_institution
       FROM pipeline_learned_patterns
       WHERE is_active = true
         AND (prompt_type = $1 OR prompt_type IS NULL)
         AND frequency >= 2
         AND confidence >= 0.6
       ORDER BY frequency DESC, confidence DESC
       LIMIT 10`,
      [promptType]
    );

    // 2. Sık düzeltilen alanları direkt correction tablosundan da al
    const frequentCorrections = await query(
      `SELECT
        field_path,
        COUNT(*) as count,
        mode() WITHIN GROUP (ORDER BY correction_type) as common_type
       FROM analysis_corrections
       WHERE created_at > NOW() - INTERVAL '60 days'
       GROUP BY field_path
       HAVING COUNT(*) >= 3
       ORDER BY count DESC
       LIMIT 8`
    );

    if (patterns.rows.length === 0 && frequentCorrections.rows.length === 0) {
      _correctionHintsCache[promptType] = '';
      _correctionHintsCacheTime = Date.now();
      return '';
    }

    let hints = `\n## ⚠️ DÜZELTME GERİ BİLDİRİMLERİ (ÖNCEKİ HATALARDAN ÖĞRENME)\n`;
    hints += 'Kullanıcılar önceki analizlerde şu alanlarda düzeltme yaptı. Bu hataları tekrarlama:\n\n';

    // Pattern bazlı ipuçları
    if (patterns.rows.length > 0) {
      for (const p of patterns.rows) {
        hints += `- **${p.field_name}**: `;
        if (p.wrong_pattern && p.correct_pattern) {
          const wrongShort = truncate(p.wrong_pattern, 80);
          const correctShort = truncate(p.correct_pattern, 80);
          hints += `Yanlış: "${wrongShort}" → Doğru: "${correctShort}" (${p.frequency}x düzeltildi)\n`;
        } else {
          hints += `${p.frequency}x düzeltildi (güven: ${p.confidence})\n`;
        }
      }
    }

    // Sık düzeltilen alanlar
    if (frequentCorrections.rows.length > 0) {
      hints += '\n**Sık düzeltilen alanlar (ekstra dikkat et):**\n';
      for (const fc of frequentCorrections.rows) {
        hints += `- \`${fc.field_path}\`: ${fc.count}x düzeltildi (genellikle ${fc.common_type})\n`;
      }
    }

    _correctionHintsCache[promptType] = hints;
    _correctionHintsCacheTime = Date.now();

    return hints;
  } catch (error) {
    logger.error('[Pipeline Learning] Hint yükleme hatası', { error: error.message, promptType });
    return '';
  }
}

/**
 * Tüm prompt türleri için toplu hints döndür.
 * Unified pipeline'ın full extraction'ı için.
 *
 * @returns {Promise<string>}
 */
export async function getAllCorrectionHints() {
  return getCorrectionHintsForPrompt('full');
}

/**
 * field_path'i prompt türüne maple
 */
function mapFieldToPromptType(fieldPath) {
  const field = fieldPath.toLowerCase();
  if (field.includes('tarih') || field.includes('date') || field.includes('sure')) return 'dates';
  if (field.includes('tutar') || field.includes('bedel') || field.includes('fiyat') || field.includes('amount'))
    return 'amounts';
  if (field.includes('ceza') || field.includes('penalt')) return 'penalties';
  if (field.includes('personel') || field.includes('person')) return 'personnel';
  if (field.includes('menu') || field.includes('ogun') || field.includes('gramaj') || field.includes('yemek'))
    return 'menu';
  return 'full';
}

/**
 * String'i belirli uzunlukta kes
 */
function truncate(str, maxLen) {
  if (!str) return '';
  const s = String(str);
  return s.length > maxLen ? `${s.slice(0, maxLen)}...` : s;
}

export default {
  analyzeCorrectionsAndLearn,
  getCorrectionHintsForPrompt,
  getAllCorrectionHints,
};
