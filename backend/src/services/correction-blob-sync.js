/**
 * Correction Blob Sync Service
 * 
 * Kullanıcı düzeltmelerini Azure Blob Storage'a labels.json olarak yazar.
 * Bu dosyalar model eğitimi pipeline'ı tarafından tüketilir.
 * 
 * Her düzeltme kaydı, ilgili dökümanın blob'undaki labels.json dosyasını günceller.
 */

import { BlobServiceClient } from '@azure/storage-blob';
import { query } from '../database.js';
import logger from '../utils/logger.js';

// ═══════════════════════════════════════════════════════════════
// AZURE BLOB CLIENT
// ═══════════════════════════════════════════════════════════════

function getBlobClient() {
  const account = process.env.AZURE_STORAGE_ACCOUNT || 'cateringtr';
  const key = process.env.AZURE_STORAGE_KEY;
  const container = process.env.AZURE_TRAINING_CONTAINER || 'ihale-training';

  if (!key) {
    throw new Error('AZURE_STORAGE_KEY tanımlı değil. Blob sync yapılamaz.');
  }

  const connectionString = `DefaultEndpointsProtocol=https;AccountName=${account};AccountKey=${key};EndpointSuffix=core.windows.net`;
  const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
  const containerClient = blobServiceClient.getContainerClient(container);

  return containerClient;
}

// ═══════════════════════════════════════════════════════════════
// SYNC FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Tek bir düzeltmeyi Azure Blob'a yaz
 * Dökümanın mevcut label dosyasını günceller veya yenisini oluşturur
 */
export async function syncCorrectionToBlob(correctionId) {
  try {
    // Düzeltmeyi DB'den al
    const result = await query(
      `SELECT ac.*, d.original_filename, d.analysis_result
       FROM analysis_corrections ac
       LEFT JOIN documents d ON d.id = ac.document_id
       WHERE ac.id = $1`,
      [correctionId]
    );

    if (result.rows.length === 0) {
      logger.warn('Düzeltme bulunamadı', { correctionId });
      return false;
    }

    const correction = result.rows[0];

    if (!correction.original_filename) {
      logger.warn('Düzeltme için döküman bulunamadı, blob sync atlanıyor', { correctionId });
      // Yine de synced olarak işaretle
      await query(
        'UPDATE analysis_corrections SET blob_synced = true WHERE id = $1',
        [correctionId]
      );
      return true;
    }

    const containerClient = getBlobClient();
    const blobName = `${correction.original_filename}.labels.json`;
    const blobClient = containerClient.getBlockBlobClient(blobName);

    // Mevcut label dosyasını oku (varsa)
    let existingLabels = {};
    try {
      const downloadResponse = await blobClient.download(0);
      const downloadedContent = await streamToString(downloadResponse.readableStreamBody);
      existingLabels = JSON.parse(downloadedContent);
    } catch {
      // Dosya yoksa yeni oluştur
      existingLabels = {
        document: correction.original_filename,
        source: 'user_correction',
        created_at: new Date().toISOString(),
        fields: {},
      };
    }

    // Düzeltmeyi label'a ekle
    const fieldPath = correction.field_path;
    if (!existingLabels.fields) existingLabels.fields = {};
    existingLabels.fields[fieldPath] = {
      value: correction.new_value,
      confidence: 1.0, // Kullanıcı düzeltmesi = tam güven
      source: 'human_correction',
      corrected_at: correction.created_at,
      corrected_by: correction.corrected_by,
    };
    existingLabels.updated_at = new Date().toISOString();
    existingLabels.correction_count = Object.keys(existingLabels.fields).length;

    // Blob'a yaz
    const content = JSON.stringify(existingLabels, null, 2);
    await blobClient.upload(content, Buffer.byteLength(content), {
      overwrite: true,
      blobHTTPHeaders: { blobContentType: 'application/json' },
    });

    // DB'de synced olarak işaretle
    await query(
      'UPDATE analysis_corrections SET blob_synced = true WHERE id = $1',
      [correctionId]
    );

    logger.info('Düzeltme Azure Blob\'a yazıldı', {
      correctionId,
      blobName,
      fieldPath,
    });

    return true;
  } catch (error) {
    logger.error('Blob sync hatası', { correctionId, error: error.message });
    return false;
  }
}

/**
 * Tüm bekleyen düzeltmeleri toplu olarak sync et
 */
export async function syncPendingCorrections() {
  try {
    const result = await query(
      `SELECT id FROM analysis_corrections
       WHERE blob_synced = false AND correction_type != 'confirm'
       ORDER BY created_at ASC
       LIMIT 100`
    );

    if (result.rows.length === 0) {
      logger.debug('Bekleyen düzeltme yok');
      return { synced: 0, failed: 0 };
    }

    logger.info(`${result.rows.length} düzeltme sync edilecek`);

    let synced = 0;
    let failed = 0;

    for (const row of result.rows) {
      const success = await syncCorrectionToBlob(row.id);
      if (success) {
        synced++;
      } else {
        failed++;
      }
      // Rate limiting
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    logger.info('Blob sync tamamlandı', { synced, failed });
    return { synced, failed };
  } catch (error) {
    logger.error('Toplu blob sync hatası', { error: error.message });
    return { synced: 0, failed: 0, error: error.message };
  }
}

/**
 * Eğitim istatistiklerini getir
 */
export async function getCorrectionStats() {
  const result = await query(
    `SELECT
       COUNT(*) as total,
       COUNT(*) FILTER (WHERE used_in_training = false) as pending_training,
       COUNT(*) FILTER (WHERE blob_synced = false AND correction_type != 'confirm') as pending_sync,
       COUNT(DISTINCT tender_id) as tenders,
       COUNT(DISTINCT document_id) FILTER (WHERE document_id IS NOT NULL) as documents
     FROM analysis_corrections`
  );
  return result.rows[0];
}

// ═══════════════════════════════════════════════════════════════
// YARDIMCI
// ═══════════════════════════════════════════════════════════════

async function streamToString(readableStream) {
  if (!readableStream) return '';
  return new Promise((resolve, reject) => {
    const chunks = [];
    readableStream.on('data', (data) => chunks.push(data.toString()));
    readableStream.on('end', () => resolve(chunks.join('')));
    readableStream.on('error', reject);
  });
}

export default {
  syncCorrectionToBlob,
  syncPendingCorrections,
  getCorrectionStats,
};
