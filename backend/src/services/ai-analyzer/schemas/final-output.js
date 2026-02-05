/**
 * Final Output Schema
 *
 * API'den dönen final sonuç şeması.
 * Tüm P0 kontrollerinin sonuçlarını içerir.
 */

/**
 * Final analiz sonucu şeması
 */
export const FINAL_OUTPUT_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'FinalOutput',
  description: 'Zero-Loss Pipeline final çıktısı',
  type: 'object',
  required: ['success', 'document_id', 'analysis', 'validation'],
  properties: {
    // İşlem başarılı mı?
    success: {
      type: 'boolean',
    },

    // Hata mesajı (success=false ise)
    error: {
      type: ['string', 'null'],
    },

    // Döküman kimliği
    document_id: {
      type: 'string',
    },

    // Ana analiz sonuçları
    analysis: {
      type: 'object',
      properties: {
        // Özet bilgiler
        summary: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'İhale başlığı' },
            institution: { type: 'string', description: 'Kurum' },
            tender_type: { type: 'string', description: 'İhale türü (mal/hizmet/yapım)' },
            estimated_value: { type: 'string', description: 'Yaklaşık maliyet' },
            duration: { type: 'string', description: 'Hizmet süresi' },
            ikn: { type: 'string', description: 'İhale Kayıt Numarası' },
          },
        },

        // Tarihler
        dates: {
          type: 'object',
          properties: {
            tender_date: { type: ['string', 'null'] },
            start_date: { type: ['string', 'null'] },
            end_date: { type: ['string', 'null'] },
            deadline: { type: ['string', 'null'] },
            all_dates: { type: 'array' },
          },
        },

        // Finansal bilgiler
        financial: {
          type: 'object',
          properties: {
            estimated_cost: { type: 'object' },
            unit_prices: { type: 'array' },
            guarantees: { type: 'object' },
            all_amounts: { type: 'array' },
          },
        },

        // Ceza koşulları
        penalties: {
          type: 'array',
        },

        // Menü ve yemek bilgileri
        catering: {
          type: 'object',
          properties: {
            meals: { type: 'array' },
            gramaj: { type: 'array' },
            service_times: { type: 'object' },
            quality_requirements: { type: 'array' },
            daily_meal_count: { type: ['number', 'null'] },
            person_count: { type: ['number', 'null'] },
          },
        },

        // Personel bilgileri
        personnel: {
          type: 'object',
          properties: {
            staff: { type: 'array' },
            qualifications: { type: 'array' },
            total_count: { type: ['number', 'null'] },
            wage_info: { type: 'array' },
          },
        },

        // Teknik şartlar
        technical_requirements: {
          type: 'array',
        },

        // Gerekli belgeler
        required_documents: {
          type: 'array',
        },

        // İletişim
        contact: {
          type: 'object',
        },

        // Önemli notlar
        important_notes: {
          type: 'array',
        },
      },
    },

    // Çelişkiler (P0-09)
    conflicts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          field: { type: 'string' },
          values: { type: 'array' },
          needs_review: { type: 'boolean' },
        },
      },
    },

    // Çözülemeyen referanslar
    unresolved_references: {
      type: 'array',
    },

    // Doğrulama sonuçları
    validation: {
      type: 'object',
      properties: {
        // Genel geçerlilik
        valid: {
          type: 'boolean',
        },

        // Şema hataları
        schema_errors: {
          type: 'array',
        },

        // Tamlık skoru
        completeness_score: {
          type: 'number',
          minimum: 0,
          maximum: 1,
        },

        // P0 kontrol sonuçları
        p0_checks: {
          type: 'object',
          properties: {
            all_passed: { type: 'boolean' },
            checks: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  code: { type: 'string' },
                  name: { type: 'string' },
                  passed: { type: 'boolean' },
                  details: { type: 'object' },
                },
              },
            },
          },
        },
      },
    },

    // Meta bilgiler
    meta: {
      type: 'object',
      properties: {
        // Pipeline versiyonu
        pipeline_version: {
          type: 'string',
          default: '2.0.0',
        },

        // İşlem istatistikleri
        stats: {
          type: 'object',
          properties: {
            total_chunks: { type: 'number' },
            extraction_types: { type: 'array', items: { type: 'string' } },
            total_findings: { type: 'number' },
            total_duration_ms: { type: 'number' },
            total_tokens: { type: 'number' },
          },
        },

        // Dosya bilgileri
        file_info: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            type: { type: 'string' },
            size: { type: 'number' },
            ocr_applied: { type: 'boolean' },
          },
        },

        // Chunk özeti
        chunk_summary: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              index: { type: 'number' },
              type: { type: 'string' },
              findings_count: { type: 'number' },
            },
          },
        },
      },
    },
  },
};

/**
 * Boş final çıktı şablonu
 */
export const EMPTY_FINAL_OUTPUT = {
  success: false,
  error: null,
  document_id: '',
  analysis: {
    summary: {
      title: '',
      institution: '',
      tender_type: '',
      estimated_value: '',
      duration: '',
      ikn: '',
    },
    dates: {
      tender_date: null,
      start_date: null,
      end_date: null,
      deadline: null,
      all_dates: [],
    },
    financial: {
      estimated_cost: {},
      unit_prices: [],
      guarantees: {},
      all_amounts: [],
    },
    penalties: [],
    catering: {
      meals: [],
      gramaj: [],
      service_times: {},
      quality_requirements: [],
      daily_meal_count: null,
      person_count: null,
    },
    personnel: {
      staff: [],
      qualifications: [],
      total_count: null,
      wage_info: [],
    },
    technical_requirements: [],
    required_documents: [],
    contact: {},
    important_notes: [],
  },
  conflicts: [],
  unresolved_references: [],
  validation: {
    valid: false,
    schema_errors: [],
    completeness_score: 0,
    p0_checks: {
      all_passed: false,
      checks: [],
    },
  },
  meta: {
    pipeline_version: '2.0.0',
    stats: {},
    file_info: {},
    chunk_summary: [],
  },
};

/**
 * Final çıktı oluştur
 * @param {Object} params - Parametreler
 * @returns {Object} Final çıktı
 */
export function createFinalOutput({
  success = false,
  error = null,
  documentId = '',
  analysis = {},
  conflicts = [],
  unresolvedReferences = [],
  validation = {},
  meta = {},
}) {
  return {
    success,
    error,
    document_id: documentId,
    analysis: {
      ...EMPTY_FINAL_OUTPUT.analysis,
      ...analysis,
    },
    conflicts,
    unresolved_references: unresolvedReferences,
    validation: {
      ...EMPTY_FINAL_OUTPUT.validation,
      ...validation,
    },
    meta: {
      ...EMPTY_FINAL_OUTPUT.meta,
      ...meta,
      pipeline_version: '2.0.0',
    },
  };
}

/**
 * Başarılı sonuç oluştur
 */
export function createSuccessOutput(documentId, analysis, validation, meta) {
  return createFinalOutput({
    success: true,
    documentId,
    analysis,
    validation,
    meta,
  });
}

/**
 * Hata sonucu oluştur
 */
export function createErrorOutput(documentId, error) {
  return createFinalOutput({
    success: false,
    error: error instanceof Error ? error.message : String(error),
    documentId,
  });
}

export default {
  schema: FINAL_OUTPUT_SCHEMA,
  empty: EMPTY_FINAL_OUTPUT,
  createFinalOutput,
  createSuccessOutput,
  createErrorOutput,
};
