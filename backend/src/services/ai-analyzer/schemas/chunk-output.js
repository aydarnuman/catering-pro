/**
 * Chunk-level Output Schema
 *
 * Her chunk'ın analiz sonucu için şema.
 * P0-10 (Source Traceability) gereksinimini karşılar.
 */

/**
 * Chunk analiz sonucu şeması
 */
export const CHUNK_OUTPUT_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'ChunkOutput',
  description: 'Tek bir chunk için extraction sonucu',
  type: 'object',
  required: ['chunk_id', 'extraction_type', 'found', 'raw_text_hash'],
  properties: {
    // Chunk kimliği
    chunk_id: {
      type: 'string',
      description: 'Benzersiz chunk tanımlayıcısı (format: doc_id:chunk_index)',
    },

    // Extraction türü
    extraction_type: {
      type: 'string',
      enum: ['dates', 'amounts', 'penalties', 'menu', 'personnel', 'full'],
      description: 'Yapılan extraction türü',
    },

    // Bulunan veriler
    findings: {
      type: 'array',
      description: 'Çıkarılan bilgiler listesi',
      items: {
        type: 'object',
        required: ['value', 'confidence'],
        properties: {
          // Çıkarılan değer
          value: {
            type: ['string', 'number', 'object', 'null'],
            description: 'Çıkarılan değer',
          },

          // Değer türü (extraction_type'a özgü)
          type: {
            type: 'string',
            description: 'Değer alt türü (örn: ihale_tarihi, birim_fiyat)',
          },

          // Bağlam
          context: {
            type: 'string',
            maxLength: 300,
            description: 'Değerin bulunduğu bağlam (cümle)',
          },

          // Güven skoru
          confidence: {
            type: 'number',
            minimum: 0,
            maximum: 1,
            description: 'Extraction güven skoru (0.0-1.0)',
          },

          // Kaynak pozisyonu (P0-10 için kritik)
          source_position: {
            type: 'array',
            items: { type: 'number' },
            minItems: 2,
            maxItems: 2,
            description: 'Chunk içindeki [başlangıç, bitiş] karakter pozisyonu',
          },

          // Ham metin
          raw_text: {
            type: 'string',
            description: 'Orijinal metindeki değer (değiştirilmemiş)',
          },

          // Ek notlar
          notes: {
            type: 'string',
            description: 'Extraction hakkında notlar',
          },

          // İlgili madde numarası
          related_article: {
            type: ['string', 'null'],
            description: 'İlgili madde numarası (varsa)',
          },
        },
      },
    },

    // Veri bulundu mu?
    found: {
      type: 'boolean',
      description: "Bu chunk'ta ilgili veri bulundu mu?",
    },

    // P0-07: null vs empty ayrımı
    not_found_reason: {
      type: ['string', 'null'],
      enum: ['not_applicable', 'not_mentioned', 'parse_error', null],
      description: 'found=false ise neden bulunmadığı',
    },

    // Chunk ham metin hash'i (P0-05 doğrulaması için)
    raw_text_hash: {
      type: 'string',
      description: "Chunk içeriğinin MD5 hash'i (karakter kaybı kontrolü için)",
    },

    // Chunk metadata
    chunk_metadata: {
      type: 'object',
      properties: {
        index: { type: 'number', description: 'Chunk sırası' },
        type: { type: 'string', description: 'Chunk türü (table, text, header, mixed)' },
        token_estimate: { type: 'number', description: 'Tahmini token sayısı' },
        heading_context: { type: 'string', description: 'Üst başlık (varsa)' },
        position: { type: 'string', enum: ['start', 'middle', 'end'], description: 'Döküman içi pozisyon' },
      },
    },

    // LLM yanıt metadata
    llm_metadata: {
      type: 'object',
      properties: {
        model: { type: 'string', description: 'Kullanılan model' },
        input_tokens: { type: 'number' },
        output_tokens: { type: 'number' },
        duration_ms: { type: 'number', description: 'İşlem süresi (ms)' },
        raw_response_valid: { type: 'boolean', description: 'JSON parse başarılı mı (P0-06)' },
      },
    },

    // Extraction notları
    extraction_notes: {
      type: 'string',
      description: 'Genel extraction notları',
    },
  },
};

/**
 * Boş chunk çıktısı şablonu
 */
export const EMPTY_CHUNK_OUTPUT = {
  chunk_id: '',
  extraction_type: 'full',
  findings: [],
  found: false,
  not_found_reason: 'not_mentioned',
  raw_text_hash: '',
  chunk_metadata: {},
  llm_metadata: {},
  extraction_notes: '',
};

/**
 * Chunk çıktısı oluştur
 * @param {Object} params - Parametreler
 * @returns {Object} Chunk çıktısı
 */
export function createChunkOutput({
  chunkId,
  extractionType,
  findings = [],
  rawTextHash,
  chunkMetadata = {},
  llmMetadata = {},
  notes = '',
}) {
  const found = findings.length > 0;

  return {
    chunk_id: chunkId,
    extraction_type: extractionType,
    findings,
    found,
    not_found_reason: found ? null : 'not_mentioned',
    raw_text_hash: rawTextHash,
    chunk_metadata: chunkMetadata,
    llm_metadata: llmMetadata,
    extraction_notes: notes,
  };
}

/**
 * Finding objesi oluştur
 * @param {Object} params - Parametreler
 * @returns {Object} Finding objesi
 */
export function createFinding({
  value,
  type = null,
  context = '',
  confidence = 1.0,
  sourcePosition = null,
  rawText = '',
  notes = '',
  relatedArticle = null,
}) {
  return {
    value,
    type,
    context: context.substring(0, 300), // Max 300 karakter
    confidence,
    source_position: sourcePosition,
    raw_text: rawText,
    notes,
    related_article: relatedArticle,
  };
}

export default {
  schema: CHUNK_OUTPUT_SCHEMA,
  empty: EMPTY_CHUNK_OUTPUT,
  createChunkOutput,
  createFinding,
};
