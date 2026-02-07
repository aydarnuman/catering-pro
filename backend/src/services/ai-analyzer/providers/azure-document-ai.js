/**
 * Azure Document Intelligence Provider
 * İhale dökümanları için custom model tabanlı extraction
 *
 * v2.0 Features:
 * - Prebuilt Layout: Tablo ve form extraction
 * - Custom Model: İhale-spesifik alan extraction
 * - High accuracy for structured documents
 * - Enhanced error handling and retries
 * - Fallback mechanisms
 * - Timeout protection
 */

import fs from 'node:fs';
import { AzureKeyCredential, DocumentAnalysisClient } from '@azure/ai-form-recognizer';
import aiConfig from '../../../config/ai.config.js';
import logger from '../../../utils/logger.js';

// ═══════════════════════════════════════════════════════════════════════════
// AZURE DOCUMENT AI CONFIG (dinamik getter - env her çağrıda okunur)
// ═══════════════════════════════════════════════════════════════════════════

function getAzureConfig() {
  return {
    endpoint: process.env.AZURE_DOCUMENT_AI_ENDPOINT || aiConfig.azure?.endpoint,
    apiKey: process.env.AZURE_DOCUMENT_AI_KEY || aiConfig.azure?.apiKey,
    // Custom model ID (Document Intelligence Studio'da eğitildikten sonra)
    customModelId: process.env.AZURE_DOCUMENT_AI_MODEL_ID || aiConfig.azure?.customModelId || 'ihale-teknik-sartname',
    // Timeout settings - 100+ sayfa PDF için 10 dakika gerekebilir
    timeout: parseInt(process.env.AZURE_TIMEOUT, 10) || aiConfig.azure?.timeout || 600000, // 10 minutes
    maxRetries: 3,
    retryDelayMs: 2000,
    // Prebuilt model options
    prebuiltModels: {
      layout: 'prebuilt-layout', // Tablo + text extraction
      document: 'prebuilt-document', // Key-value pairs
      invoice: 'prebuilt-invoice', // Fatura analizi
      contract: 'prebuilt-contract', // Sözleşme analizi - ihale için!
    },
  };
}

// Backward compatibility - config as getter
const config = new Proxy(
  {},
  {
    get: (_, prop) => getAzureConfig()[prop],
  }
);

// Error codes that warrant retry
const RETRYABLE_ERRORS = [
  'ETIMEDOUT',
  'ECONNRESET',
  'ECONNREFUSED',
  'ENOTFOUND',
  'ServiceUnavailable',
  'TooManyRequests',
  '429',
  '503',
];

// ═══════════════════════════════════════════════════════════════════════════
// CLIENT INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════

let client = null;

function getClient() {
  if (!client) {
    if (!config.endpoint || !config.apiKey) {
      throw new Error(
        'Azure Document Intelligence credentials missing. Set AZURE_DOCUMENT_AI_ENDPOINT and AZURE_DOCUMENT_AI_KEY'
      );
    }
    client = new DocumentAnalysisClient(config.endpoint, new AzureKeyCredential(config.apiKey));
    logger.info('Azure Document Intelligence client initialized', {
      module: 'azure-doc-ai',
      endpoint: config.endpoint.substring(0, 40) + '...',
      timeout: config.timeout,
    });
  }
  return client;
}

/**
 * Check if Azure Document AI is configured
 */
export function isAzureConfigured() {
  return !!(config.endpoint && config.apiKey);
}

/**
 * Determine if an error is retryable
 */
function isRetryableError(error) {
  const errorStr = String(error.code || error.message || '');
  return RETRYABLE_ERRORS.some((code) => errorStr.includes(code));
}

/**
 * Sleep helper for retry delays
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute with timeout
 */
async function withTimeout(promise, timeoutMs, operation = 'operation') {
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Azure ${operation} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]);
}

/**
 * Execute with retry logic
 */
async function withRetry(fn, maxRetries = config.maxRetries, operation = 'operation') {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (!isRetryableError(error) || attempt === maxRetries) {
        throw error;
      }

      const delay = config.retryDelayMs * 2 ** (attempt - 1); // Exponential backoff
      logger.warn(`Azure ${operation} failed, retrying...`, {
        module: 'azure-doc-ai',
        attempt,
        maxRetries,
        delay,
        error: error.message,
      });

      await sleep(delay);
    }
  }

  throw lastError;
}

// ═══════════════════════════════════════════════════════════════════════════
// QUERY FIELDS - İhale dökümanları için özel alan çıkarımı
// ═══════════════════════════════════════════════════════════════════════════

/**
 * İhale dökümanları için Query Fields tanımları
 * Bu alanlar Azure'a gönderilerek ekstra bilgi çıkarımı sağlar
 */
const IHALE_QUERY_FIELDS = [
  // Menü bilgileri
  'OrnekMenu',
  'HaftalikMenu',
  'DiyetMenu',
  'KahvaltiMenusu',
  'OgleYemekMenusu',

  // Gramaj ve porsiyon
  'GramajListesi',
  'PorsiyonMiktarlari',

  // Personel
  'PersonelListesi',
  'AsciSayisi',
  'DiyetisyenSayisi',
  'ToplamPersonelSayisi',

  // Öğün bilgileri
  'GunlukOgunSayisi',
  'KahvaltiAdedi',
  'OgleYemekAdedi',
  'AksamYemekAdedi',
  'ToplamYemekMiktari',

  // Finansal
  'YaklasiKMaliyet',
  'BirimFiyatlar',
  'TeminatBedeli',

  // Diğer
  'CezaKosullari',
  'KaliteStandartlari',
  'ServisSaatleri',
  'HijyenKurallari',
  'SozlesmeSuresi',
];

// ═══════════════════════════════════════════════════════════════════════════
// PREBUILT LAYOUT ANALYSIS (Tablo Extraction)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Analyze document with prebuilt-layout model
 * Best for: Table extraction, text structure
 *
 * v2.0: Enhanced with retry, timeout, and validation
 * v3.0: Added Query Fields support for ihale documents
 *
 * @param {string|Buffer} document - File path or buffer
 * @param {Object} options - Analysis options
 * @param {boolean} options.useQueryFields - Enable query fields extraction
 * @param {string[]} options.queryFields - Custom query fields to extract
 * @returns {Promise<Object>} Extracted tables and text
 */
export async function analyzeWithLayout(document, options = {}) {
  const startTime = Date.now();

  logger.info('Starting Azure Layout analysis', { module: 'azure-doc-ai' });

  // Validate input
  let documentBuffer;
  let fileSize = 0;

  try {
    if (typeof document === 'string') {
      // Validate file exists
      if (!fs.existsSync(document)) {
        return {
          success: false,
          provider: 'azure-layout',
          error: `File not found: ${document}`,
        };
      }
      documentBuffer = fs.readFileSync(document);
    } else {
      documentBuffer = document;
    }

    fileSize = documentBuffer.length;

    // Validate file size (Azure limit: 500MB, but practical limit is much lower)
    if (fileSize > 50 * 1024 * 1024) {
      // 50MB warning
      logger.warn('Large file detected, may take longer', {
        module: 'azure-doc-ai',
        fileSize: `${(fileSize / 1024 / 1024).toFixed(1)}MB`,
      });
    }

    // Validate it's a PDF (basic magic number check)
    if (documentBuffer.length >= 4) {
      const magic = documentBuffer.slice(0, 4).toString('ascii');
      if (magic !== '%PDF') {
        logger.warn('File may not be a valid PDF', {
          module: 'azure-doc-ai',
          magic: magic.replace(/[^\x20-\x7E]/g, '?'),
        });
        // Check if it's a ZIP
        if (documentBuffer[0] === 0x50 && documentBuffer[1] === 0x4b) {
          return {
            success: false,
            provider: 'azure-layout',
            error: 'File appears to be a ZIP archive, not a PDF',
          };
        }
      }
    }
  } catch (readError) {
    return {
      success: false,
      provider: 'azure-layout',
      error: `Failed to read document: ${readError.message}`,
    };
  }

  // Determine if Query Fields should be used
  const useQueryFields = options.useQueryFields ?? aiConfig.azure?.useQueryFields ?? false;
  const queryFields = options.queryFields || IHALE_QUERY_FIELDS;

  // Build analysis options
  const analysisOptions = {};
  if (useQueryFields) {
    analysisOptions.features = ['queryFields'];
    analysisOptions.queryFields = queryFields;
    logger.info('Query Fields enabled', {
      module: 'azure-doc-ai',
      fieldCount: queryFields.length,
    });
  }

  // Execute with retry and timeout
  try {
    const result = await withRetry(
      async () => {
        const client = getClient();

        const poller = await withTimeout(
          client.beginAnalyzeDocument(
            config.prebuiltModels.layout,
            documentBuffer,
            useQueryFields ? analysisOptions : undefined
          ),
          30000, // 30s to start
          'beginAnalyzeDocument'
        );

        return await withTimeout(poller.pollUntilDone(), config.timeout, 'pollUntilDone');
      },
      config.maxRetries,
      'Layout analysis'
    );

    const elapsed = Date.now() - startTime;

    // Extract query field results if available
    const queryFieldResults = useQueryFields ? extractQueryFields(result) : null;

    logger.info('Azure Layout analysis completed', {
      module: 'azure-doc-ai',
      pages: result.pages?.length || 0,
      tables: result.tables?.length || 0,
      paragraphs: result.paragraphs?.length || 0,
      queryFields: queryFieldResults ? Object.keys(queryFieldResults).length : 0,
      elapsed_ms: elapsed,
      fileSize: `${(fileSize / 1024).toFixed(1)}KB`,
    });

    return {
      success: true,
      provider: 'azure-layout',
      pages: extractPages(result),
      tables: extractTables(result),
      paragraphs: extractParagraphs(result),
      queryFields: queryFieldResults,
      raw: result,
      meta: {
        elapsed_ms: elapsed,
        page_count: result.pages?.length || 0,
        table_count: result.tables?.length || 0,
        query_fields_used: useQueryFields,
        file_size: fileSize,
      },
    };
  } catch (error) {
    const elapsed = Date.now() - startTime;

    logger.error('Azure Layout analysis failed', {
      module: 'azure-doc-ai',
      error: error.message,
      code: error.code,
      details: error.details,
      elapsed_ms: elapsed,
      fileSize: `${(fileSize / 1024).toFixed(1)}KB`,
    });

    return {
      success: false,
      provider: 'azure-layout',
      error: error.message,
      details: error.details || error.code,
      retryable: isRetryableError(error),
      meta: {
        elapsed_ms: elapsed,
      },
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// QUERY FIELDS EXTRACTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Extract query field results from Azure response
 * Query Fields allow extracting specific named fields without training
 *
 * @param {Object} result - Azure analysis result
 * @returns {Object} Extracted query fields with values
 */
function extractQueryFields(result) {
  const fields = {};

  // Query fields come back in result.documents[0].fields
  if (result.documents?.[0]?.fields) {
    const docFields = result.documents[0].fields;

    for (const [fieldName, fieldData] of Object.entries(docFields)) {
      if (fieldData) {
        fields[fieldName] = {
          value: fieldData.value || fieldData.content,
          content: fieldData.content,
          confidence: fieldData.confidence,
          type: fieldData.type || 'string',
          boundingRegions: fieldData.boundingRegions,
        };

        // Handle array/table fields
        if (fieldData.type === 'array' && fieldData.values) {
          fields[fieldName].items = fieldData.values.map((v) => ({
            value: v.value || v.content,
            confidence: v.confidence,
          }));
        }
      }
    }
  }

  // Also check for key-value pairs in paragraphs
  if (result.keyValuePairs) {
    for (const kvp of result.keyValuePairs) {
      const key = kvp.key?.content;
      const value = kvp.value?.content;

      if (key && value) {
        // Map common Turkish field names
        const normalizedKey = normalizeFieldName(key);
        if (!fields[normalizedKey]) {
          fields[normalizedKey] = {
            value: value,
            content: value,
            confidence: kvp.confidence,
            type: 'keyValuePair',
            originalKey: key,
          };
        }
      }
    }
  }

  logger.info('Query fields extracted', {
    module: 'azure-doc-ai',
    fieldCount: Object.keys(fields).length,
    fields: Object.keys(fields),
  });

  return fields;
}

/**
 * Normalize Turkish field names for consistent mapping
 */
function normalizeFieldName(key) {
  const normalizations = {
    'örnek menü': 'OrnekMenu',
    'haftalık menü': 'HaftalikMenu',
    'diyet menü': 'DiyetMenu',
    gramaj: 'GramajListesi',
    porsiyon: 'PorsiyonMiktarlari',
    personel: 'PersonelListesi',
    'aşçı sayısı': 'AsciSayisi',
    diyetisyen: 'DiyetisyenSayisi',
    'toplam personel': 'ToplamPersonelSayisi',
    'günlük öğün': 'GunlukOgunSayisi',
    kahvaltı: 'KahvaltiAdedi',
    'öğle yemeği': 'OgleYemekAdedi',
    'akşam yemeği': 'AksamYemekAdedi',
    'yaklaşık maliyet': 'YaklasiKMaliyet',
    'birim fiyat': 'BirimFiyatlar',
    teminat: 'TeminatBedeli',
    ceza: 'CezaKosullari',
    kalite: 'KaliteStandartlari',
    'servis saat': 'ServisSaatleri',
    hijyen: 'HijyenKurallari',
    'sözleşme süresi': 'SozlesmeSuresi',
  };

  const lowerKey = key.toLowerCase().trim();

  for (const [pattern, normalized] of Object.entries(normalizations)) {
    if (lowerKey.includes(pattern)) {
      return normalized;
    }
  }

  // CamelCase the key if no match found
  return key
    .split(/\s+/)
    .map((word, i) => (i === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()))
    .join('');
}

// ═══════════════════════════════════════════════════════════════════════════
// CUSTOM MODEL ANALYSIS (İhale Dökümanları)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Analyze document with custom trained model
 * Best for: İhale teknik şartname, idari şartname
 *
 * v3.0: Uses REST API with 2024-11-30 API version (required for custom models)
 * The SDK only supports 2023-07-31 which doesn't work with custom models.
 *
 * @param {string|Buffer} document - File path or buffer
 * @param {string} modelId - Custom model ID (optional, uses default)
 * @returns {Promise<Object>} Extracted fields
 */
export async function analyzeWithCustomModel(document, modelId = null) {
  const startTime = Date.now();
  const useModelId = modelId || config.customModelId;

  // Custom models require 2024-11-30 API version!
  const API_VERSION = '2024-11-30';

  logger.info('Starting Azure Custom Model analysis (REST API)', {
    module: 'azure-doc-ai',
    modelId: useModelId,
    apiVersion: API_VERSION,
  });

  // Validate credentials
  if (!config.endpoint || !config.apiKey) {
    return {
      success: false,
      provider: 'azure-custom',
      modelId: useModelId,
      error: 'Azure credentials not configured',
    };
  }

  // Validate input
  let documentBuffer;

  try {
    if (typeof document === 'string') {
      if (!fs.existsSync(document)) {
        return {
          success: false,
          provider: 'azure-custom',
          modelId: useModelId,
          error: `File not found: ${document}`,
        };
      }
      documentBuffer = fs.readFileSync(document);
    } else {
      documentBuffer = document;
    }
  } catch (readError) {
    return {
      success: false,
      provider: 'azure-custom',
      modelId: useModelId,
      error: `Failed to read document: ${readError.message}`,
    };
  }

  // Execute with REST API (SDK uses 2023-07-31 which doesn't support custom models)
  try {
    const result = await withRetry(
      async () => {
        // Step 1: Start analysis
        const analyzeUrl = `${config.endpoint}documentintelligence/documentModels/${useModelId}:analyze?api-version=${API_VERSION}`;

        logger.info('Calling Azure REST API', {
          module: 'azure-doc-ai',
          url: analyzeUrl.substring(0, 80) + '...',
        });

        const startResponse = await fetch(analyzeUrl, {
          method: 'POST',
          headers: {
            'Ocp-Apim-Subscription-Key': config.apiKey,
            'Content-Type': 'application/pdf',
          },
          body: documentBuffer,
        });

        if (!startResponse.ok) {
          const errorBody = await startResponse.text();
          throw new Error(`Analysis start failed: ${startResponse.status} - ${errorBody}`);
        }

        // Get operation location for polling
        const operationLocation = startResponse.headers.get('Operation-Location');
        if (!operationLocation) {
          throw new Error('No Operation-Location header in response');
        }

        logger.info('Custom Model analysis started, polling...', {
          module: 'azure-doc-ai',
        });

        // Step 2: Poll for result
        // 100+ sayfa PDF'ler için 10 dakika timeout gerekebilir
        let pollResult;
        const maxPolls = 600; // 10 dakika max (600 saniye)
        let pollCount = 0;
        let lastProgress = '';

        while (pollCount < maxPolls) {
          await sleep(1000); // Wait 1 second between polls
          pollCount++;

          const pollResponse = await fetch(operationLocation, {
            method: 'GET',
            headers: {
              'Ocp-Apim-Subscription-Key': config.apiKey,
            },
          });

          if (!pollResponse.ok) {
            const errorBody = await pollResponse.text();
            throw new Error(`Poll failed: ${pollResponse.status} - ${errorBody}`);
          }

          pollResult = await pollResponse.json();

          if (pollResult.status === 'succeeded') {
            logger.info('✓ Custom Model analysis succeeded', {
              module: 'azure-doc-ai',
              polls: pollCount,
              elapsed_seconds: pollCount,
            });
            break;
          } else if (pollResult.status === 'failed') {
            throw new Error(`Analysis failed: ${pollResult.error?.message || 'Unknown error'}`);
          }

          // Log progress - her 30 saniyede veya durum değiştiğinde
          const progressInfo = `${pollResult.status} (${pollCount}s)`;
          if (pollCount % 30 === 0 || progressInfo !== lastProgress) {
            logger.info('Azure Custom Model işliyor...', {
              module: 'azure-doc-ai',
              status: pollResult.status,
              elapsed_seconds: pollCount,
              max_seconds: maxPolls,
            });
            lastProgress = progressInfo;
          }
        }

        if (pollCount >= maxPolls) {
          throw new Error(`Analysis timed out after ${maxPolls} seconds (${maxPolls / 60} minutes)`);
        }

        return pollResult.analyzeResult;
      },
      config.maxRetries,
      'Custom Model analysis'
    );

    const elapsed = Date.now() - startTime;

    // Extract custom fields from REST API result
    const fields = extractCustomFieldsFromRest(result);
    const tables = extractTablesFromRest(result);

    logger.info('Azure Custom Model analysis completed', {
      module: 'azure-doc-ai',
      modelId: useModelId,
      documents: result.documents?.length || 0,
      fields_found: Object.keys(fields).length,
      tables_found: tables.length,
      elapsed_ms: elapsed,
    });

    return {
      success: true,
      provider: 'azure-custom',
      modelId: useModelId,
      fields,
      tables,
      confidence: calculateOverallConfidenceFromRest(result),
      raw: result,
      meta: {
        elapsed_ms: elapsed,
        document_count: result.documents?.length || 0,
        api_version: API_VERSION,
      },
    };
  } catch (error) {
    const elapsed = Date.now() - startTime;

    // Check for specific model errors
    const isModelNotFound =
      error.message?.includes('not found') ||
      error.message?.includes('does not exist') ||
      error.message?.includes('InvalidRequest');

    logger.error('Azure Custom Model analysis failed', {
      module: 'azure-doc-ai',
      error: error.message,
      modelId: useModelId,
      elapsed_ms: elapsed,
      modelNotFound: isModelNotFound,
    });

    return {
      success: false,
      provider: 'azure-custom',
      modelId: useModelId,
      error: error.message,
      modelNotFound: isModelNotFound,
      retryable: isRetryableError(error),
      meta: {
        elapsed_ms: elapsed,
      },
    };
  }
}

/**
 * Extract custom fields from REST API response
 */
function extractCustomFieldsFromRest(result) {
  const fields = {};

  if (!result?.documents) return fields;

  for (const doc of result.documents) {
    if (!doc.fields) continue;

    for (const [key, field] of Object.entries(doc.fields)) {
      if (field) {
        fields[key] = {
          value: field.valueString || field.valueNumber || field.valueDate || field.content || null,
          confidence: field.confidence || 0,
          type: field.type || 'string',
        };

        // Handle arrays
        if (field.valueArray) {
          fields[key] = {
            items: field.valueArray.map((item) => ({
              value: item.valueString || item.valueObject || item.content,
              confidence: item.confidence,
            })),
            type: 'array',
          };
        }
      }
    }
  }

  return fields;
}

/**
 * Extract tables from REST API response
 */
function extractTablesFromRest(result) {
  if (!result?.tables) return [];

  return result.tables.map((table, index) => {
    const rows = [];
    const headers = [];

    // Group cells by row
    const cellsByRow = {};
    for (const cell of table.cells || []) {
      const rowIdx = cell.rowIndex;
      if (!cellsByRow[rowIdx]) cellsByRow[rowIdx] = [];
      cellsByRow[rowIdx][cell.columnIndex] = cell.content || '';
    }

    // First row is typically headers
    const rowIndices = Object.keys(cellsByRow)
      .map(Number)
      .sort((a, b) => a - b);
    if (rowIndices.length > 0) {
      headers.push(...(cellsByRow[rowIndices[0]] || []));

      for (let i = 1; i < rowIndices.length; i++) {
        rows.push(cellsByRow[rowIndices[i]] || []);
      }
    }

    return {
      index,
      headers,
      rows,
      rowCount: table.rowCount,
      columnCount: table.columnCount,
    };
  });
}

/**
 * Calculate overall confidence from REST API response
 */
function calculateOverallConfidenceFromRest(result) {
  if (!result?.documents) return 0;

  const confidences = [];

  for (const doc of result.documents) {
    if (doc.confidence) confidences.push(doc.confidence);

    if (doc.fields) {
      for (const field of Object.values(doc.fields)) {
        if (field?.confidence) confidences.push(field.confidence);
      }
    }
  }

  if (confidences.length === 0) return 0;
  return confidences.reduce((a, b) => a + b, 0) / confidences.length;
}

// ═══════════════════════════════════════════════════════════════════════════
// COMBINED ANALYSIS (Layout + Custom)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Full analysis: Layout for tables + Custom for fields
 *
 * v2.0: Enhanced with graceful degradation and fallback support
 *
 * @param {string|Buffer} document - File path or buffer
 * @param {Object} options - Analysis options
 * @param {boolean} options.useCustomModel - Whether to try custom model (default: true)
 * @param {boolean} options.fallbackLayoutOnly - Fall back to layout-only if custom fails (default: true)
 * @returns {Promise<Object>} Combined extraction result
 */
export async function analyzeIhaleDocument(document, options = {}) {
  const startTime = Date.now();
  const { useCustomModel = true, fallbackLayoutOnly = true } = options;

  logger.info('Starting combined Azure analysis for ihale document', {
    module: 'azure-doc-ai',
    useCustomModel,
  });

  // Always run Layout analysis first
  const layoutResult = await analyzeWithLayout(document);

  // If Layout fails, return early with failure
  if (!layoutResult.success) {
    logger.error('Combined analysis failed: Layout analysis failed', {
      module: 'azure-doc-ai',
      error: layoutResult.error,
    });
    return {
      success: false,
      provider: 'azure-combined',
      error: `Layout analysis failed: ${layoutResult.error}`,
      layoutResult,
      meta: {
        elapsed_ms: Date.now() - startTime,
      },
    };
  }

  // Try Custom Model analysis if enabled
  let customResult = { success: false, error: 'Custom model disabled' };

  if (useCustomModel && (aiConfig.azure?.useCustomModel ?? false)) {
    customResult = await analyzeWithCustomModel(document);

    if (!customResult.success) {
      if (customResult.modelNotFound) {
        logger.warn('Custom model not found, using layout-only mode', {
          module: 'azure-doc-ai',
          modelId: customResult.modelId,
        });
      } else if (!fallbackLayoutOnly) {
        // If fallback not allowed, return failure
        return {
          success: false,
          provider: 'azure-combined',
          error: `Custom model failed: ${customResult.error}`,
          layoutResult,
          customResult,
          meta: {
            elapsed_ms: Date.now() - startTime,
          },
        };
      }
    }
  }

  const elapsed = Date.now() - startTime;

  // Merge results
  const result = {
    success: true, // Layout succeeded
    provider: 'azure-combined',

    // From Layout
    tables: layoutResult.tables || [],
    paragraphs: layoutResult.paragraphs || [],
    pages: layoutResult.pages || [],

    // From Custom Model (if available)
    fields: customResult.success ? customResult.fields : {},
    customModelUsed: customResult.success,

    // Transformed to pipeline format
    analysis: transformToAnalysisFormat(layoutResult, customResult),

    meta: {
      elapsed_ms: elapsed,
      layout_success: layoutResult.success,
      custom_success: customResult.success,
      table_count: layoutResult.meta?.table_count || 0,
      field_count: Object.keys(customResult.fields || {}).length,
      page_count: layoutResult.meta?.page_count || 0,
    },
  };

  logger.info('Combined Azure analysis completed', {
    module: 'azure-doc-ai',
    ...result.meta,
  });

  return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// HEALTH CHECK
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check Azure Document Intelligence service health
 * Use for monitoring and pre-flight checks
 * Uses REST API to verify connectivity (no SDK dependency)
 *
 * @returns {Promise<Object>} Health status
 */
export async function checkHealth() {
  const startTime = Date.now();

  try {
    if (!isAzureConfigured()) {
      return {
        healthy: false,
        error: 'Azure credentials not configured',
        elapsed_ms: Date.now() - startTime,
      };
    }

    // Use REST API to check health (SDK-independent)
    const url = `${config.endpoint}documentintelligence/documentModels?api-version=2024-11-30`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Ocp-Apim-Subscription-Key': config.apiKey,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return {
        healthy: false,
        error: `API returned ${response.status}: ${errorBody.substring(0, 100)}`,
        elapsed_ms: Date.now() - startTime,
      };
    }

    const data = await response.json();
    const modelCount = data.value?.length || 0;

    // Check if custom model exists
    const customModelExists = data.value?.some((m) => m.modelId === config.customModelId);

    return {
      healthy: true,
      endpoint: config.endpoint?.substring(0, 40) + '...',
      customModelId: config.customModelId,
      customModelExists,
      availableModels: modelCount,
      timeout: config.timeout,
      elapsed_ms: Date.now() - startTime,
    };
  } catch (error) {
    return {
      healthy: false,
      error: error.message,
      elapsed_ms: Date.now() - startTime,
    };
  }
}

/**
 * Get provider statistics (for monitoring)
 */
export function getStats() {
  return {
    configured: isAzureConfigured(),
    endpoint: config.endpoint ? config.endpoint.substring(0, 40) + '...' : null,
    customModelId: config.customModelId,
    timeout: config.timeout,
    maxRetries: config.maxRetries,
    prebuiltModels: Object.keys(config.prebuiltModels),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// DATA EXTRACTION HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function extractPages(result) {
  if (!result.pages) return [];

  return result.pages.map((page, index) => ({
    pageNumber: index + 1,
    width: page.width,
    height: page.height,
    unit: page.unit,
    lines:
      page.lines?.map((line) => ({
        content: line.content,
        boundingBox: line.polygon,
      })) || [],
  }));
}

function extractTables(result) {
  if (!result.tables) return [];

  return result.tables.map((table, index) => {
    const headers = [];
    const rows = [];

    // Group cells by row
    const cellsByRow = {};
    for (const cell of table.cells || []) {
      const rowIndex = cell.rowIndex;
      if (!cellsByRow[rowIndex]) {
        cellsByRow[rowIndex] = [];
      }
      cellsByRow[rowIndex].push({
        content: cell.content,
        columnIndex: cell.columnIndex,
        rowIndex: cell.rowIndex,
        isHeader: cell.kind === 'columnHeader',
        confidence: cell.confidence,
      });
    }

    // Sort and extract
    const sortedRows = Object.keys(cellsByRow).sort((a, b) => a - b);
    for (const rowKey of sortedRows) {
      const rowCells = cellsByRow[rowKey].sort((a, b) => a.columnIndex - b.columnIndex);
      const rowData = rowCells.map((c) => c.content);

      if (rowCells[0]?.isHeader) {
        headers.push(...rowData);
      } else {
        rows.push(rowData);
      }
    }

    return {
      tableIndex: index,
      rowCount: table.rowCount,
      columnCount: table.columnCount,
      headers: headers.length > 0 ? headers : null,
      rows,
      boundingRegions: table.boundingRegions,
    };
  });
}

function extractParagraphs(result) {
  if (!result.paragraphs) return [];

  return result.paragraphs.map((p) => ({
    content: p.content,
    role: p.role, // 'title', 'sectionHeading', etc.
    boundingRegions: p.boundingRegions,
  }));
}

function _extractCustomFields(result) {
  const fields = {};

  if (!result.documents || result.documents.length === 0) {
    return fields;
  }

  // Get fields from first document
  const doc = result.documents[0];

  for (const [fieldName, field] of Object.entries(doc.fields || {})) {
    if (!field) continue;

    fields[fieldName] = {
      value: field.content || field.value,
      type: field.type,
      confidence: field.confidence,
      boundingRegions: field.boundingRegions,
    };

    // Handle nested fields (tables, arrays)
    if (field.type === 'array' && field.values) {
      fields[fieldName].items = field.values.map((item) => {
        if (item.type === 'object' && item.properties) {
          const obj = {};
          for (const [propName, propValue] of Object.entries(item.properties)) {
            obj[propName] = propValue?.content || propValue?.value;
          }
          return obj;
        }
        return item.content || item.value;
      });
    }
  }

  return fields;
}

function _calculateOverallConfidence(result) {
  if (!result.documents || result.documents.length === 0) {
    return 0;
  }

  const confidences = [];
  for (const doc of result.documents) {
    for (const field of Object.values(doc.fields || {})) {
      if (field?.confidence) {
        confidences.push(field.confidence);
      }
    }
  }

  if (confidences.length === 0) return 0;
  return confidences.reduce((a, b) => a + b, 0) / confidences.length;
}

// ═══════════════════════════════════════════════════════════════════════════
// TRANSFORM TO PIPELINE FORMAT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Transform Azure results to match existing pipeline analysis format
 */
function transformToAnalysisFormat(layoutResult, customResult) {
  const analysis = {
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
      working_conditions: [],
      wage_info: [],
      total_count: null,
    },
    technical_requirements: [],
  };

  // Map custom fields to analysis format
  if (customResult.success && customResult.fields) {
    const fields = customResult.fields;

    // Dates
    if (fields.ihale_tarihi) {
      analysis.dates.tender_date = fields.ihale_tarihi.value;
      analysis.dates.all_dates.push({
        date: fields.ihale_tarihi.value,
        type: 'ihale_tarihi',
        confidence: fields.ihale_tarihi.confidence,
      });
    }
    if (fields.son_teklif_tarihi) {
      analysis.dates.deadline = fields.son_teklif_tarihi.value;
      analysis.dates.all_dates.push({
        date: fields.son_teklif_tarihi.value,
        type: 'son_teklif_tarihi',
        confidence: fields.son_teklif_tarihi.confidence,
      });
    }
    if (fields.baslangic_tarihi) {
      analysis.dates.start_date = fields.baslangic_tarihi.value;
    }
    if (fields.bitis_tarihi) {
      analysis.dates.end_date = fields.bitis_tarihi.value;
    }

    // Financial
    if (fields.yaklasik_maliyet) {
      analysis.financial.estimated_cost = {
        amount: fields.yaklasik_maliyet.value,
        confidence: fields.yaklasik_maliyet.confidence,
      };
      analysis.summary.estimated_value = fields.yaklasik_maliyet.value;
    }
    if (fields.teminat_orani) {
      analysis.financial.guarantees.rate = fields.teminat_orani.value;
    }

    // Summary
    if (fields.kurum_adi) {
      analysis.summary.institution = fields.kurum_adi.value;
    }
    if (fields.ihale_kayit_no) {
      analysis.summary.ikn = fields.ihale_kayit_no.value;
    }

    // Personnel table
    if (fields.personel_tablosu?.items) {
      analysis.personnel.staff = fields.personel_tablosu.items.map((item) => ({
        pozisyon: item.pozisyon || item.position,
        adet: parseInt(item.adet || item.count, 10) || 0,
        source: 'azure-custom',
      }));
    }

    // Gramaj table
    if (fields.gramaj_tablosu?.items) {
      analysis.catering.gramaj = fields.gramaj_tablosu.items.map((item) => ({
        item: item.malzeme || item.item,
        weight: item.gramaj || item.weight,
        unit: item.birim || item.unit || 'g',
        source: 'azure-custom',
      }));
    }

    // Ceza koşulları
    if (fields.ceza_kosullari?.items) {
      analysis.penalties = fields.ceza_kosullari.items.map((item) => ({
        description: typeof item === 'string' ? item : item.aciklama,
        source: 'azure-custom',
      }));
    }
  }

  // Extract gramaj from layout tables if not from custom
  if (analysis.catering.gramaj.length === 0 && layoutResult.tables) {
    const gramajTables = layoutResult.tables.filter((t) =>
      t.headers?.some(
        (h) =>
          h.toLowerCase().includes('gramaj') ||
          h.toLowerCase().includes('miktar') ||
          h.toLowerCase().includes('porsiyon')
      )
    );

    for (const table of gramajTables) {
      for (const row of table.rows || []) {
        // Try to extract gramaj from row
        const item = row[0];
        const weight = row.find((cell) => /\d+\s*(g|gr|gram|kg)/i.test(cell));

        if (item && weight) {
          analysis.catering.gramaj.push({
            item,
            weight: weight.match(/[\d.,]+/)?.[0],
            unit: weight.match(/(g|gr|gram|kg)/i)?.[0] || 'g',
            source: 'azure-layout',
          });
        }
      }
    }
  }

  return analysis;
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export default {
  isAzureConfigured,
  analyzeWithLayout,
  analyzeWithCustomModel,
  analyzeIhaleDocument,
  checkHealth,
  getStats,
};
