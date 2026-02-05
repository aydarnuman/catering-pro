/**
 * Schemas Index - Tüm şemaları export eder
 */

import chunkOutput from './chunk-output.js';
import documentOutput from './document-output.js';
import finalOutput from './final-output.js';

export const CHUNK_OUTPUT_SCHEMA = chunkOutput.schema;
export const DOCUMENT_OUTPUT_SCHEMA = documentOutput.schema;
export const FINAL_OUTPUT_SCHEMA = finalOutput.schema;

export const EMPTY_CHUNK_OUTPUT = chunkOutput.empty;
export const EMPTY_DOCUMENT_OUTPUT = documentOutput.empty;
export const EMPTY_FINAL_OUTPUT = finalOutput.empty;

export { createChunkOutput, createFinding } from './chunk-output.js';
export { createDocumentOutput } from './document-output.js';
export { createErrorOutput, createFinalOutput, createSuccessOutput } from './final-output.js';

export default {
  chunk: chunkOutput,
  document: documentOutput,
  final: finalOutput,
};
