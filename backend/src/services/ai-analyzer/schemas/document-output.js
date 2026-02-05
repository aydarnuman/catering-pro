/**
 * Document-level Output Schema
 *
 * Tüm chunk'lardan birleştirilmiş döküman çıktısı.
 * P0-08 (Yeni bilgi ekleme yasağı) ve P0-09 (Conflict preservation) gereksinimlerini karşılar.
 */

/**
 * Döküman analiz sonucu şeması
 */
export const DOCUMENT_OUTPUT_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'DocumentOutput',
  description: 'Döküman seviyesinde birleştirilmiş extraction sonucu',
  type: 'object',
  required: ['document_id', 'fields', 'conflicts', 'completeness_score', 'character_count_match'],
  properties: {
    // Döküman kimliği
    document_id: {
      type: 'string',
      description: 'Benzersiz döküman tanımlayıcısı',
    },

    // Döküman metadata
    document_metadata: {
      type: 'object',
      properties: {
        file_name: { type: 'string' },
        file_type: { type: 'string' },
        file_size: { type: 'number' },
        page_count: { type: 'number' },
        total_chunks: { type: 'number' },
        extraction_types_used: {
          type: 'array',
          items: { type: 'string' },
        },
        processing_time_ms: { type: 'number' },
      },
    },

    // Çıkarılan alanlar (extraction türüne göre gruplandırılmış)
    fields: {
      type: 'object',
      properties: {
        // Tarihler
        dates: {
          type: 'array',
          items: {
            type: 'object',
            required: ['value', 'type', 'source_chunk_id'],
            properties: {
              value: { type: ['string', 'null'] },
              type: { type: 'string' },
              context: { type: 'string' },
              confidence: { type: 'number' },
              source_chunk_id: { type: 'string' },
              source_position: { type: 'array', items: { type: 'number' } },
            },
          },
        },

        // Tutarlar
        amounts: {
          type: 'array',
          items: {
            type: 'object',
            required: ['value', 'type', 'source_chunk_id'],
            properties: {
              value: { type: 'string' },
              numeric_value: { type: 'number' },
              type: { type: 'string' },
              currency: { type: ['string', 'null'] },
              includes_kdv: { type: ['boolean', 'null'] },
              unit: { type: ['string', 'null'] },
              context: { type: 'string' },
              confidence: { type: 'number' },
              source_chunk_id: { type: 'string' },
              source_position: { type: 'array', items: { type: 'number' } },
            },
          },
        },

        // Cezalar
        penalties: {
          type: 'array',
          items: {
            type: 'object',
            required: ['type', 'source_chunk_id'],
            properties: {
              type: { type: 'string' },
              rate: { type: ['string', 'null'] },
              rate_numeric: { type: ['number', 'null'] },
              period: { type: ['string', 'null'] },
              base: { type: ['string', 'null'] },
              max_limit: { type: ['string', 'null'] },
              description: { type: 'string' },
              trigger_condition: { type: 'string' },
              context: { type: 'string' },
              confidence: { type: 'number' },
              source_chunk_id: { type: 'string' },
              source_position: { type: 'array', items: { type: 'number' } },
              related_article: { type: ['string', 'null'] },
            },
          },
        },

        // Menü/Öğün bilgileri
        menus: {
          type: 'object',
          properties: {
            meals: { type: 'array' },
            gramaj: { type: 'array' },
            calories: { type: 'array' },
            quality_requirements: { type: 'array' },
            menu_options: { type: 'array' },
            service_times: { type: 'object' },
          },
        },

        // Personel bilgileri
        personnel: {
          type: 'object',
          properties: {
            staff: { type: 'array' },
            qualifications: { type: 'array' },
            working_conditions: { type: 'array' },
            wage_info: { type: 'array' },
            total_count: { type: ['number', 'null'] },
          },
        },

        // Genel gereksinimler
        requirements: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              category: { type: 'string' },
              requirement: { type: 'string' },
              mandatory: { type: 'boolean' },
              source_chunk_id: { type: 'string' },
            },
          },
        },

        // Gerekli belgeler
        required_documents: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              document_name: { type: 'string' },
              mandatory: { type: 'boolean' },
              source_chunk_id: { type: 'string' },
            },
          },
        },

        // İletişim bilgileri
        contact: {
          type: 'object',
          properties: {
            phone: { type: 'string' },
            email: { type: 'string' },
            address: { type: 'string' },
            contact_person: { type: 'string' },
          },
        },

        // Teminat oranları
        guarantee_rates: {
          type: 'object',
          properties: {
            temporary: { type: 'string' },
            final: { type: 'string' },
          },
        },
      },
    },

    // Çelişkiler (P0-09: Conflict Preservation)
    conflicts: {
      type: 'array',
      description: 'Aynı alan için farklı değerler tespit edildiğinde',
      items: {
        type: 'object',
        required: ['field', 'values', 'needs_review'],
        properties: {
          // Çelişen alan
          field: {
            type: 'string',
            description: 'Çelişki olan alan (örn: dates.baslangic, amounts.toplam_bedel)',
          },

          // Çelişen değerler
          values: {
            type: 'array',
            minItems: 2,
            items: {
              type: 'object',
              required: ['value', 'source_chunk_id'],
              properties: {
                value: { type: ['string', 'number', 'null'] },
                source_chunk_id: { type: 'string' },
                context: { type: 'string' },
                confidence: { type: 'number' },
              },
            },
          },

          // İnceleme gerekli
          needs_review: {
            type: 'boolean',
            default: true,
          },

          // Çelişki türü
          conflict_type: {
            type: 'string',
            enum: ['different_values', 'partial_match', 'contradictory'],
          },

          // Önerilen çözüm (sadece bilgi, otomatik uygulanmaz)
          suggested_resolution: {
            type: ['string', 'null'],
            description: 'Olası çözüm önerisi (kullanıcı karar verir)',
          },
        },
      },
    },

    // Çözülemeyen referanslar
    unresolved_references: {
      type: 'array',
      description: 'Çözülemeyen çapraz referanslar',
      items: {
        type: 'object',
        properties: {
          reference_text: { type: 'string', description: 'Referans metni (örn: "Madde 8\'e bakınız")' },
          target: { type: 'string', description: 'Referans hedefi (örn: "Madde 8")' },
          source_chunk_id: { type: 'string' },
          reason: { type: 'string', description: 'Çözülememe nedeni' },
        },
      },
    },

    // Tamlık skoru
    completeness_score: {
      type: 'number',
      minimum: 0,
      maximum: 1,
      description: 'Döküman tamlık skoru (0.0-1.0)',
    },

    // Tamlık detayları
    completeness_details: {
      type: 'object',
      properties: {
        required_fields: {
          type: 'array',
          items: { type: 'string' },
        },
        found_fields: {
          type: 'array',
          items: { type: 'string' },
        },
        missing_fields: {
          type: 'array',
          items: { type: 'string' },
        },
      },
    },

    // Karakter sayısı eşleşmesi (P0-05)
    character_count_match: {
      type: 'boolean',
      description: 'OCR çıktısı ile chunk toplamı eşleşiyor mu?',
    },

    // Karakter sayısı detayları
    character_count_details: {
      type: 'object',
      properties: {
        original_length: { type: 'number' },
        chunked_length: { type: 'number' },
        difference: { type: 'number' },
        tolerance: { type: 'number' },
      },
    },

    // İşlem meta bilgileri
    processing_metadata: {
      type: 'object',
      properties: {
        total_chunks: { type: 'number' },
        successful_extractions: { type: 'number' },
        failed_extractions: { type: 'number' },
        total_findings: { type: 'number' },
        extraction_types: { type: 'array', items: { type: 'string' } },
        total_input_tokens: { type: 'number' },
        total_output_tokens: { type: 'number' },
        total_duration_ms: { type: 'number' },
      },
    },
  },
};

/**
 * Boş döküman çıktısı şablonu
 */
export const EMPTY_DOCUMENT_OUTPUT = {
  document_id: '',
  document_metadata: {},
  fields: {
    dates: [],
    amounts: [],
    penalties: [],
    menus: {
      meals: [],
      gramaj: [],
      calories: [],
      quality_requirements: [],
      menu_options: [],
      service_times: {},
    },
    personnel: {
      staff: [],
      qualifications: [],
      working_conditions: [],
      wage_info: [],
      total_count: null,
    },
    requirements: [],
    required_documents: [],
    contact: {},
    guarantee_rates: {},
  },
  conflicts: [],
  unresolved_references: [],
  completeness_score: 0,
  completeness_details: {
    required_fields: [],
    found_fields: [],
    missing_fields: [],
  },
  character_count_match: false,
  character_count_details: {},
  processing_metadata: {},
};

/**
 * Döküman çıktısı oluştur
 * @param {Object} params - Parametreler
 * @returns {Object} Döküman çıktısı
 */
export function createDocumentOutput({
  documentId,
  documentMetadata = {},
  fields = {},
  conflicts = [],
  unresolvedReferences = [],
  completenessScore = 0,
  completenessDetails = {},
  characterCountMatch = false,
  characterCountDetails = {},
  processingMetadata = {},
}) {
  return {
    document_id: documentId,
    document_metadata: documentMetadata,
    fields: {
      ...EMPTY_DOCUMENT_OUTPUT.fields,
      ...fields,
    },
    conflicts,
    unresolved_references: unresolvedReferences,
    completeness_score: completenessScore,
    completeness_details: completenessDetails,
    character_count_match: characterCountMatch,
    character_count_details: characterCountDetails,
    processing_metadata: processingMetadata,
  };
}

export default {
  schema: DOCUMENT_OUTPUT_SCHEMA,
  empty: EMPTY_DOCUMENT_OUTPUT,
  createDocumentOutput,
};
