import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
// Node 18+ has native fetch — no import needed
import { supabase } from '../supabase.js';
// v9.0: TEK MERKEZİ SİSTEM - unified-pipeline kullan!
import { analyzeDocument } from './ai-analyzer/unified-pipeline.js';

const BUCKET_NAME = 'tender-documents';

/**
 * Döküman işleme ana fonksiyonu
 * v9.0: TEK MERKEZİ SİSTEM - unified-pipeline kullanır
 *
 * @param {number} documentId - Döküman ID
 * @param {string} filePath - Dosya yolu
 * @param {string} originalFilename - Orijinal dosya adı
 * @returns {Promise<object>} - İşlenmiş veri
 */
export async function processDocument(documentId, filePath, originalFilename) {
  let tempFilePath = null;

  try {
    const { pool: dbPool } = await import('../database.js');
    const docResult = await dbPool.query(
      'SELECT content_text, file_type, source_type, storage_path, storage_url FROM documents WHERE id = $1',
      [documentId]
    );

    if (docResult.rows.length === 0) {
      throw new Error(`Döküman bulunamadı: ${documentId}`);
    }

    const document = docResult.rows[0];
    let analysisFilePath = filePath;

    // Storage'dan indirme gerekiyorsa
    if (document.source_type === 'download' && document.storage_path) {
      const fileBuffer = await downloadFromSupabase(document.storage_path, document.storage_url);
      const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'doc-process-'));
      const ext = path.extname(originalFilename).toLowerCase() || '.pdf';
      tempFilePath = path.join(tempDir, `document${ext}`);
      await fs.promises.writeFile(tempFilePath, fileBuffer);
      analysisFilePath = tempFilePath;
    }

    // v9.0: UNIFIED PIPELINE
    const result = await analyzeDocument(analysisFilePath);

    return {
      text: result.extraction?.text || '',
      ocr: result.extraction?.ocrApplied ? { applied: true } : null,
      analysis: {
        pipeline_version: '9.0',
        provider: result.meta?.provider_used || 'unified',
        ...result.analysis,
      },
    };
  } finally {
    if (tempFilePath) {
      try {
        const tempDir = path.dirname(tempFilePath);
        await fs.promises.rm(tempDir, { recursive: true });
      } catch {}
    }
  }
}

/**
 * Supabase Storage'dan dosya indir
 */
export async function downloadFromSupabase(storagePath, storageUrl) {
  // Önce public URL'den dene
  if (storageUrl) {
    const response = await fetch(storageUrl);
    if (response.ok) {
      return Buffer.from(await response.arrayBuffer());
    }
  }

  // Signed URL ile dene
  if (supabase?.storage) {
    const { data, error } = await supabase.storage.from(BUCKET_NAME).createSignedUrl(storagePath, 3600); // 1 saat geçerli

    if (error) {
      throw new Error(`Signed URL hatası: ${error.message}`);
    }
    const response = await fetch(data.signedUrl);
    if (!response.ok) {
      throw new Error(`Download hatası: HTTP ${response.status}`);
    }

    return Buffer.from(await response.arrayBuffer());
  }

  throw new Error('Supabase client mevcut değil');
}

/**
 * Content dökümanı işleme (sadece DB'deki metin için)
 * v9.0: Text-only analiz için chunker + analyzer kullanır
 *
 * @param {number} documentId - Döküman ID
 * @returns {Promise<object>} - İşlenmiş veri
 */
export async function processContentDocument(documentId) {
  const { pool: dbPool } = await import('../database.js');
  const { chunkText } = await import('./ai-analyzer/pipeline/chunker.js');
  const { analyze } = await import('./ai-analyzer/pipeline/analyzer.js');

  const docResult = await dbPool.query(
    `SELECT content_text, content_type, original_filename 
       FROM documents WHERE id = $1 AND source_type = 'content'`,
    [documentId]
  );

  if (docResult.rows.length === 0) {
    throw new Error(`Content döküman bulunamadı: ${documentId}`);
  }

  const document = docResult.rows[0];

  if (!document.content_text) {
    throw new Error('Content text boş');
  }

  // Text-based analiz (unified pipeline content için chunker+analyzer kullanır)
  const chunks = chunkText(document.content_text);
  const analysis = await analyze(chunks);

  return {
    text: document.content_text,
    ocr: null,
    analysis: {
      pipeline_version: '9.0',
      provider: 'claude-text',
      ...analysis,
    },
  };
}

// NOT: extractPDF, extractWord, extractExcel fonksiyonları
// unified-pipeline.js'e taşındı. Bu dosya sadece wrapper olarak kullanılıyor.
