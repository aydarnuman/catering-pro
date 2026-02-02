/**
 * Docling Client - IBM Docling API Client
 * PDF, DOCX, görüntü ve diğer dökümanları işler
 *
 * v2.0 - Paralel chunk işleme eklendi (3x hız artışı)
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import FormData from 'form-data';
import fetch from 'node-fetch';
import { PDFDocument } from 'pdf-lib';
import logger from '../../../utils/logger.js';

// Docling API URL - sunucuda Docker container olarak çalışıyor
const DOCLING_API_URL = process.env.DOCLING_API_URL || 'http://localhost:5001';

// Paralel işleme ayarları
const PARALLEL_CHUNKS = parseInt(process.env.DOCLING_PARALLEL_CHUNKS || '3', 10);

class DoclingClient {
  constructor() {
    this.baseUrl = DOCLING_API_URL;
    this.timeout = 600000; // 10 dakika timeout (büyük PDF'ler için)
    this.parallelChunks = PARALLEL_CHUNKS; // Aynı anda işlenecek chunk sayısı
  }

  /**
   * URL'den döküman dönüştür
   * @param {string} url - Döküman URL'i
   * @returns {Promise<Object>} - Dönüştürülmüş döküman
   */
  async convertFromUrl(url) {
    const startTime = Date.now();

    logger.info('Docling: Converting document from URL', {
      module: 'docling',
      action: 'convertFromUrl',
      url: url.substring(0, 100),
    });

    try {
      const response = await fetch(`${this.baseUrl}/v1/convert/source`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          http_sources: [{ url }],
        }),
        timeout: this.timeout,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Docling API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      const duration = Date.now() - startTime;

      logger.info('Docling: Document converted successfully', {
        module: 'docling',
        action: 'convertFromUrl',
        duration: `${duration}ms`,
        hasDocument: !!result.document,
      });

      return this.normalizeResult(result);
    } catch (error) {
      logger.error('Docling: Conversion failed', {
        module: 'docling',
        action: 'convertFromUrl',
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Dosyadan döküman dönüştür (async API kullanır - büyük dosyalar için)
   * @param {string} filePath - Dosya yolu
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<Object>} - Dönüştürülmüş döküman
   */
  async convertFromFile(filePath, onProgress = null) {
    const startTime = Date.now();
    const filename = path.basename(filePath);
    const fileSize = fs.statSync(filePath).size;
    const sizeMB = fileSize / (1024 * 1024);

    // Küçük dosyalar için sync API (< 2MB), büyük dosyalar için async API
    const useAsync = sizeMB > 2;

    logger.info('Docling: Converting document from file', {
      module: 'docling',
      action: 'convertFromFile',
      filename,
      sizeMB: sizeMB.toFixed(2),
      useAsync,
    });

    try {
      const form = new FormData();
      form.append('files', fs.createReadStream(filePath), filename);
      form.append('to_formats', 'text');
      // OCR ve tablo çıkarma varsayılan olarak açık (Docker Desktop 16GB+ RAM gerektirir)

      if (useAsync) {
        // ASYNC API - Büyük dosyalar için (> 2MB)
        return await this.convertFromFileAsync(filePath, form, filename, onProgress);
      }

      // SYNC API - Küçük dosyalar için
      const response = await fetch(`${this.baseUrl}/v1/convert/file`, {
        method: 'POST',
        body: form,
        headers: form.getHeaders(),
        timeout: 120000, // 2 dakika (sync limit)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Docling API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      const duration = Date.now() - startTime;

      logger.info('Docling: Document converted successfully', {
        module: 'docling',
        action: 'convertFromFile',
        filename,
        duration: `${duration}ms`,
        hasDocument: !!result.document,
      });

      return this.normalizeResult(result);
    } catch (error) {
      logger.error('Docling: Conversion failed', {
        module: 'docling',
        action: 'convertFromFile',
        filename,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Async API ile dosya dönüştür (büyük dosyalar için)
   * @param {string} filePath - Dosya yolu
   * @param {FormData} form - Form data
   * @param {string} filename - Dosya adı
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<Object>}
   */
  async convertFromFileAsync(_filePath, form, filename, onProgress = null) {
    const startTime = Date.now();

    logger.info('Docling: Starting async conversion', {
      module: 'docling',
      action: 'convertFromFileAsync',
      filename,
    });

    // 1. Async job başlat
    const submitResponse = await fetch(`${this.baseUrl}/v1/convert/file/async`, {
      method: 'POST',
      body: form,
      headers: form.getHeaders(),
      timeout: 60000, // Submit için 1 dakika yeterli
    });

    if (!submitResponse.ok) {
      const errorText = await submitResponse.text();
      throw new Error(`Docling async submit error: ${submitResponse.status} - ${errorText}`);
    }

    const submitResult = await submitResponse.json();
    const taskId = submitResult.task_id;

    if (!taskId) {
      throw new Error('Docling async: No task_id returned');
    }

    logger.info('Docling: Async job submitted', {
      module: 'docling',
      action: 'convertFromFileAsync',
      taskId,
    });

    // 2. Durumu poll et
    const maxWaitTime = this.timeout; // 10 dakika
    const pollInterval = 3000; // 3 saniye
    let elapsed = 0;
    let lastStatus = '';

    while (elapsed < maxWaitTime) {
      await this.sleep(pollInterval);
      elapsed += pollInterval;

      try {
        const statusResponse = await fetch(`${this.baseUrl}/v1/status/poll/${taskId}`, {
          timeout: 10000,
        });

        if (!statusResponse.ok) {
          logger.warn('Docling: Status poll failed', {
            module: 'docling',
            action: 'convertFromFileAsync',
            status: statusResponse.status,
          });
          continue;
        }

        const status = await statusResponse.json();
        const taskStatus = status.task_status || status.status;

        if (taskStatus !== lastStatus) {
          logger.info('Docling: Job status update', {
            module: 'docling',
            action: 'convertFromFileAsync',
            taskId,
            status: taskStatus,
            elapsed: `${Math.round(elapsed / 1000)}s`,
          });
          lastStatus = taskStatus;
        }

        if (onProgress) {
          onProgress({
            stage: 'docling_async',
            message: `Docling işliyor: ${taskStatus} (${Math.round(elapsed / 1000)}s)`,
            progress: Math.min(90, Math.round((elapsed / maxWaitTime) * 100)),
          });
        }

        if (taskStatus === 'success' || taskStatus === 'SUCCESS') {
          // 3. Sonucu al
          const resultResponse = await fetch(`${this.baseUrl}/v1/result/${taskId}`, {
            timeout: 60000,
          });

          if (!resultResponse.ok) {
            throw new Error(`Docling result fetch error: ${resultResponse.status}`);
          }

          const result = await resultResponse.json();
          const duration = Date.now() - startTime;

          logger.info('Docling: Async conversion completed', {
            module: 'docling',
            action: 'convertFromFileAsync',
            filename,
            taskId,
            duration: `${duration}ms`,
            hasDocument: !!result.document,
          });

          return this.normalizeResult(result);
        }

        if (taskStatus === 'failure' || taskStatus === 'FAILURE' || taskStatus === 'error') {
          throw new Error(`Docling async job failed: ${JSON.stringify(status)}`);
        }
      } catch (pollError) {
        logger.warn('Docling: Poll error', {
          module: 'docling',
          action: 'convertFromFileAsync',
          error: pollError.message,
        });
        // Devam et, bir sonraki poll'u dene
      }
    }

    throw new Error(`Docling async timeout after ${maxWaitTime / 1000}s`);
  }

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Buffer'dan döküman dönüştür
   * @param {Buffer} buffer - Dosya buffer'ı
   * @param {string} filename - Dosya adı
   * @returns {Promise<Object>} - Dönüştürülmüş döküman
   */
  async convertFromBuffer(buffer, filename = 'document.pdf') {
    const startTime = Date.now();

    logger.info('Docling: Converting document from buffer', {
      module: 'docling',
      action: 'convertFromBuffer',
      filename,
      bufferSize: buffer.length,
    });

    try {
      const form = new FormData();
      form.append('files', buffer, {
        filename,
        contentType: this.getMimeType(filename),
      });

      const response = await fetch(`${this.baseUrl}/v1/convert/file`, {
        method: 'POST',
        body: form,
        headers: form.getHeaders(),
        timeout: this.timeout,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Docling API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      const duration = Date.now() - startTime;

      logger.info('Docling: Document converted successfully', {
        module: 'docling',
        action: 'convertFromBuffer',
        filename,
        duration: `${duration}ms`,
        hasDocument: !!result.document,
      });

      return this.normalizeResult(result);
    } catch (error) {
      logger.error('Docling: Conversion failed', {
        module: 'docling',
        action: 'convertFromBuffer',
        filename,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Tek bir chunk'ı Docling'e gönder ve sonucu al
   * @param {Object} chunkInfo - Chunk bilgisi {index, path, startPage, endPage}
   * @returns {Promise<Object|null>} - Sonuç veya null (hata durumunda)
   */
  async processChunk(chunkInfo) {
    const { index, path: chunkPath, startPage, endPage } = chunkInfo;

    try {
      const form = new FormData();
      form.append('files', fs.createReadStream(chunkPath), `chunk_${index}.pdf`);

      const response = await fetch(`${this.baseUrl}/v1/convert/file`, {
        method: 'POST',
        body: form,
        headers: form.getHeaders(),
        timeout: this.timeout,
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.warn('Docling: Chunk conversion failed', {
          module: 'docling',
          action: 'processChunk',
          chunk: index + 1,
          error: errorText,
        });
        return null;
      }

      const result = await response.json();

      logger.info('Docling: Chunk converted successfully', {
        module: 'docling',
        action: 'processChunk',
        chunk: index + 1,
        pages: `${startPage + 1}-${endPage}`,
        textLength: result.document?.main_text?.length || 0,
      });

      return {
        chunkIndex: index,
        startPage,
        endPage,
        result: this.normalizeResult(result),
      };
    } catch (error) {
      logger.warn('Docling: Chunk conversion error', {
        module: 'docling',
        action: 'processChunk',
        chunk: index + 1,
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Büyük PDF'leri parçalara bölerek PARALEL işle
   * v2.0 - 3x hız artışı (sıralı yerine paralel)
   *
   * @param {string} filePath - PDF dosya yolu
   * @param {number} chunkSize - Her parçadaki sayfa sayısı (varsayılan: 10)
   * @param {Function} onProgress - İlerleme callback'i
   * @returns {Promise<Object>} - Birleştirilmiş sonuç
   */
  async convertFromFileChunked(filePath, chunkSize = 10, onProgress = null) {
    const startTime = Date.now();
    const filename = path.basename(filePath);

    logger.info('Docling: Starting PARALLEL chunked conversion', {
      module: 'docling',
      action: 'convertFromFileChunked',
      filename,
      chunkSize,
      parallelChunks: this.parallelChunks,
    });

    let tempDir = null;

    try {
      // ADIM 1: PDF'i yükle ve sayfa sayısını al
      const pdfBuffer = fs.readFileSync(filePath);
      const pdfDoc = await PDFDocument.load(pdfBuffer);
      const totalPages = pdfDoc.getPageCount();
      const totalChunks = Math.ceil(totalPages / chunkSize);

      logger.info('Docling: PDF loaded for parallel chunking', {
        module: 'docling',
        action: 'convertFromFileChunked',
        totalPages,
        totalChunks,
        parallelChunks: this.parallelChunks,
        estimatedBatches: Math.ceil(totalChunks / this.parallelChunks),
      });

      if (onProgress) {
        onProgress({
          stage: 'docling_prep',
          message: `PDF hazırlanıyor: ${totalPages} sayfa, ${totalChunks} parça...`,
          progress: 5,
        });
      }

      // Temp dizin oluştur
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docling-parallel-'));

      // ADIM 2: TÜM chunk PDF'lerini önce oluştur (bu hızlı, sıralı yapılabilir)
      const chunkInfos = [];

      for (let i = 0; i < totalChunks; i++) {
        const startPage = i * chunkSize;
        const endPage = Math.min(startPage + chunkSize, totalPages);

        // Chunk PDF oluştur
        const chunkDoc = await PDFDocument.create();
        const pagesToCopy = await chunkDoc.copyPages(
          pdfDoc,
          Array.from({ length: endPage - startPage }, (_, j) => startPage + j)
        );
        for (const page of pagesToCopy) {
          chunkDoc.addPage(page);
        }

        // Dosyaya yaz
        const chunkPath = path.join(tempDir, `chunk_${i}.pdf`);
        const chunkBuffer = await chunkDoc.save();
        fs.writeFileSync(chunkPath, chunkBuffer);

        chunkInfos.push({
          index: i,
          path: chunkPath,
          startPage,
          endPage,
        });
      }

      logger.info('Docling: All chunk PDFs created', {
        module: 'docling',
        action: 'convertFromFileChunked',
        chunkCount: chunkInfos.length,
      });

      if (onProgress) {
        onProgress({
          stage: 'docling_chunk',
          message: `${totalChunks} parça oluşturuldu, paralel işleme başlıyor...`,
          progress: 15,
        });
      }

      // ADIM 3: Chunk'ları PARALEL işle (batch halinde)
      const allResults = [];
      let completedChunks = 0;

      // Batch'ler halinde paralel işle
      for (let batchStart = 0; batchStart < chunkInfos.length; batchStart += this.parallelChunks) {
        const batch = chunkInfos.slice(batchStart, batchStart + this.parallelChunks);
        const batchNum = Math.floor(batchStart / this.parallelChunks) + 1;
        const totalBatches = Math.ceil(chunkInfos.length / this.parallelChunks);

        logger.info('Docling: Processing batch', {
          module: 'docling',
          action: 'convertFromFileChunked',
          batch: batchNum,
          totalBatches,
          chunksInBatch: batch.length,
          chunkIndices: batch.map((c) => c.index + 1).join(', '),
        });

        if (onProgress) {
          onProgress({
            stage: 'docling_chunk',
            message: `Batch ${batchNum}/${totalBatches}: Parça ${batch[0].index + 1}-${batch[batch.length - 1].index + 1} paralel işleniyor...`,
            progress: 15 + Math.round((completedChunks / totalChunks) * 80),
          });
        }

        // Bu batch'teki tüm chunk'ları paralel işle
        const batchPromises = batch.map((chunkInfo) => this.processChunk(chunkInfo));
        const batchResults = await Promise.all(batchPromises);

        // Başarılı sonuçları topla
        for (const result of batchResults) {
          if (result) {
            allResults.push(result);
          }
          completedChunks++;
        }

        // İşlenen chunk dosyalarını temizle (memory için)
        for (const chunkInfo of batch) {
          try {
            fs.unlinkSync(chunkInfo.path);
          } catch (_e) {
            // Ignore
          }
        }

        logger.info('Docling: Batch completed', {
          module: 'docling',
          action: 'convertFromFileChunked',
          batch: batchNum,
          successfulInBatch: batchResults.filter((r) => r !== null).length,
          totalSuccessful: allResults.length,
        });
      }

      // ADIM 4: Sonuçları birleştir
      const mergedResult = this.mergeChunkResults(allResults, totalPages);
      const duration = Date.now() - startTime;
      const durationMin = (duration / 60000).toFixed(1);

      logger.info('Docling: PARALLEL chunked conversion completed', {
        module: 'docling',
        action: 'convertFromFileChunked',
        filename,
        duration: `${duration}ms`,
        durationMinutes: `${durationMin}m`,
        successfulChunks: allResults.length,
        totalChunks,
        totalTextLength: mergedResult.text?.length || 0,
        totalTables: mergedResult.tables?.length || 0,
      });

      if (onProgress) {
        onProgress({
          stage: 'docling_complete',
          message: `Tamamlandı: ${allResults.length}/${totalChunks} parça başarılı (${durationMin} dk)`,
          progress: 100,
        });
      }

      return mergedResult;
    } catch (error) {
      logger.error('Docling: Parallel chunked conversion failed', {
        module: 'docling',
        action: 'convertFromFileChunked',
        filename,
        error: error.message,
      });
      throw error;
    } finally {
      // Temp dizini temizle
      if (tempDir) {
        try {
          fs.rmSync(tempDir, { recursive: true });
        } catch (_e) {
          // Ignore
        }
      }
    }
  }

  /**
   * Chunk sonuçlarını birleştir
   * @param {Array} chunkResults - Chunk sonuçları
   * @param {number} totalPages - Toplam sayfa sayısı
   * @returns {Object} - Birleştirilmiş sonuç
   */
  mergeChunkResults(chunkResults, totalPages) {
    if (!chunkResults || chunkResults.length === 0) {
      return {
        success: false,
        text: '',
        tables: [],
        images: [],
        pageCount: totalPages,
        metadata: {},
        raw: null,
      };
    }

    // Sonuçları sayfa sırasına göre sırala
    chunkResults.sort((a, b) => a.startPage - b.startPage);

    // Metinleri birleştir
    const texts = chunkResults.map((c) => c.result.text || '').filter(Boolean);
    const fullText = texts.join('\n\n--- Sayfa Sonu ---\n\n');

    // Tabloları birleştir (chunk index'i ile)
    const allTables = [];
    chunkResults.forEach((chunk) => {
      if (chunk.result.tables && chunk.result.tables.length > 0) {
        chunk.result.tables.forEach((table) => {
          allTables.push({
            ...table,
            chunkIndex: chunk.chunkIndex,
            pageRange: `${chunk.startPage + 1}-${chunk.endPage}`,
          });
        });
      }
    });

    // Görüntüleri birleştir
    const allImages = [];
    chunkResults.forEach((chunk) => {
      if (chunk.result.images && chunk.result.images.length > 0) {
        chunk.result.images.forEach((img) => {
          allImages.push({
            ...img,
            chunkIndex: chunk.chunkIndex,
            pageRange: `${chunk.startPage + 1}-${chunk.endPage}`,
          });
        });
      }
    });

    return {
      success: true,
      text: fullText,
      tables: allTables,
      images: allImages,
      pageCount: totalPages,
      metadata: {
        chunked: true,
        parallel: true,
        totalChunks: chunkResults.length,
      },
      raw: chunkResults.map((c) => c.result.raw),
    };
  }

  /**
   * Docling sonucunu normalize et
   * @param {Object} result - Docling API sonucu
   * @returns {Object} - Normalize edilmiş sonuç
   */
  normalizeResult(result) {
    const doc = result.document || result;

    // Metinleri birleştir
    let fullText = '';
    const tables = [];
    const images = [];

    if (doc.texts && Array.isArray(doc.texts)) {
      fullText = doc.texts.map((t) => t.text || t).join('\n\n');
    } else if (doc.main_text) {
      fullText = doc.main_text;
    } else if (doc.md) {
      fullText = doc.md;
    }

    // Tabloları çıkar
    if (doc.tables && Array.isArray(doc.tables)) {
      doc.tables.forEach((table, idx) => {
        tables.push({
          index: idx,
          data: table.data || table,
          markdown: table.md || this.tableToMarkdown(table),
        });
      });
    }

    // Görüntüleri çıkar
    if (doc.pictures && Array.isArray(doc.pictures)) {
      doc.pictures.forEach((pic, idx) => {
        images.push({
          index: idx,
          caption: pic.caption,
          data: pic.data,
        });
      });
    }

    return {
      success: true,
      text: fullText,
      tables,
      images,
      pageCount: doc.num_pages || doc.pages?.length || 1,
      metadata: {
        title: doc.name || doc.title,
        format: doc.file_format,
      },
      raw: doc,
    };
  }

  /**
   * Tablo verisini Markdown'a çevir
   * @param {Object} table - Tablo verisi
   * @returns {string} - Markdown formatında tablo
   */
  tableToMarkdown(table) {
    if (!table.data || !Array.isArray(table.data)) return '';

    const rows = table.data;
    if (rows.length === 0) return '';

    let md = '';

    // Header
    const header = rows[0];
    md += '| ' + header.join(' | ') + ' |\n';
    md += '| ' + header.map(() => '---').join(' | ') + ' |\n';

    // Body
    for (let i = 1; i < rows.length; i++) {
      md += '| ' + rows[i].join(' | ') + ' |\n';
    }

    return md;
  }

  /**
   * Dosya uzantısına göre MIME type döndür
   * @param {string} filename - Dosya adı
   * @returns {string} - MIME type
   */
  getMimeType(filename) {
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes = {
      '.pdf': 'application/pdf',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.doc': 'application/msword',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.xls': 'application/vnd.ms-excel',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.tiff': 'image/tiff',
      '.html': 'text/html',
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Docling API'nin erişilebilir olup olmadığını kontrol et
   * @returns {Promise<boolean>}
   */
  async isAvailable() {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        timeout: 5000,
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

// Singleton export
const doclingClient = new DoclingClient();
export default doclingClient;
export { doclingClient, DoclingClient };
