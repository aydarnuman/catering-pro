/**
 * Auto-Retrain Service (Opsiyon B - Yarı Otomasyon)
 * =================================================
 *
 * Düzeltme biriktiğinde admin'e bildirir, admin onaylarsa eğitimi tetikler.
 * Düzeltmeleri otomatik olarak "kullanıldı" işaretlemez - yalnızca
 * gerçek eğitim başarıyla tamamlandığında işaretler.
 *
 * AKIŞ:
 *   1. scheduledRetrainCheck() → Gece 02:00'de cron ile çalışır
 *   2. Bekleyen düzeltme sayısını kontrol eder
 *   3. Eşik aşıldıysa log yazar (ileride: admin'e notification)
 *   4. Admin /retrain/trigger çağırırsa → build-dataset.mjs child process başlatır
 *   5. Eğitim başarılı → düzeltmeler used_in_training=true olarak işaretlenir
 *
 * GÜVENLİK:
 *   - used_in_training YALNIZCA gerçek eğitim sonrası işaretlenir
 *   - Eğitim sırasında ikinci eğitim başlatılamaz (lock)
 *   - Timeout: 30 dakika (Azure DI eğitimi uzun sürebilir)
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { query } from '../database.js';
import { syncPendingCorrections, getCorrectionStats } from './correction-blob-sync.js';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ═══════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════

const RETRAIN_THRESHOLD = parseInt(process.env.RETRAIN_THRESHOLD || '50', 10);
const TRAIN_TIMEOUT = 30 * 60 * 1000; // 30 dakika
const BUILD_DATASET_PATH = path.join(__dirname, '../../scripts/azure-training/build-dataset.mjs');

// Eğitim kilidi - aynı anda birden fazla eğitim engellenir
let trainingLock = false;
let currentTraining = null;

// ═══════════════════════════════════════════════════════════════
// DURUM KONTROLÜ
// ═══════════════════════════════════════════════════════════════

/**
 * Eğitim gerekip gerekmediğini kontrol et
 * Hiçbir yan etkisi yok - sadece okur ve raporlar
 */
export async function checkRetrainThreshold() {
  try {
    const stats = await getCorrectionStats();
    const pendingCount = parseInt(stats.pending_training) || 0;
    const pendingSync = parseInt(stats.pending_sync) || 0;

    return {
      shouldRetrain: pendingCount >= RETRAIN_THRESHOLD,
      pendingCorrections: pendingCount,
      pendingSyncCount: pendingSync,
      threshold: RETRAIN_THRESHOLD,
      isTraining: trainingLock,
      currentTraining,
      stats,
      message: pendingCount >= RETRAIN_THRESHOLD
        ? `Eşik aşıldı: ${pendingCount}/${RETRAIN_THRESHOLD} düzeltme bekliyor. Eğitim tetiklenebilir.`
        : `Eşik altında: ${pendingCount}/${RETRAIN_THRESHOLD} düzeltme bekliyor.`,
    };
  } catch (error) {
    logger.error('Retrain threshold kontrolü başarısız', { error: error.message });
    return {
      shouldRetrain: false,
      pendingCorrections: 0,
      threshold: RETRAIN_THRESHOLD,
      isTraining: trainingLock,
      error: error.message,
    };
  }
}

/**
 * Mevcut ve geçmiş model versiyonlarını getir
 */
export async function getModelVersionInfo() {
  try {
    // Aktif model: ai.config.js'den
    const activeModelId = process.env.AZURE_DOCUMENT_AI_MODEL_ID || 'ihale-catering-v1';

    // Eğitim geçmişi: used_in_training olan düzeltmelerden tahmin
    const historyResult = await query(
      `SELECT
         COUNT(*) FILTER (WHERE used_in_training = true) as trained_corrections,
         COUNT(*) FILTER (WHERE used_in_training = false) as pending_corrections,
         MIN(created_at) FILTER (WHERE used_in_training = false) as oldest_pending,
         MAX(updated_at) FILTER (WHERE used_in_training = true) as last_training_date
       FROM analysis_corrections`
    );

    return {
      activeModelId,
      ...historyResult.rows[0],
    };
  } catch (error) {
    return {
      activeModelId: process.env.AZURE_DOCUMENT_AI_MODEL_ID || 'ihale-catering-v1',
      error: error.message,
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// MANUEL EĞİTİM TETİKLEME (Admin tarafından çağrılır)
// ═══════════════════════════════════════════════════════════════

/**
 * Manuel eğitim tetikle
 * Admin panelden çağrılır: POST /api/analysis-corrections/retrain/trigger
 *
 * Güvenlik:
 * - Eğitim zaten çalışıyorsa reddeder
 * - Önce tüm blob sync'leri tamamlar
 * - build-dataset.mjs --train-only komutunu child process olarak çalıştırır
 * - Başarılı olursa düzeltmeleri used_in_training=true yapar
 * - Başarısız olursa hiçbir şeyi değiştirmez
 */
export async function triggerManualTraining(options = {}) {
  // 1. Lock kontrolü
  if (trainingLock) {
    return {
      success: false,
      error: 'Eğitim zaten devam ediyor',
      currentTraining,
    };
  }

  const startTime = Date.now();
  const modelId = options.modelId || generateNextModelId();

  // 2. Lock al
  trainingLock = true;
  currentTraining = {
    modelId,
    startedAt: new Date().toISOString(),
    status: 'syncing',
  };

  try {
    // 3. Önce bekleyen blob sync'leri tamamla
    logger.info('[Retrain] Blob sync başlatılıyor...');
    currentTraining.status = 'syncing';
    const syncResult = await syncPendingCorrections();
    logger.info('[Retrain] Blob sync tamamlandı', syncResult);

    // 4. Bekleyen düzeltme ID'lerini kaydet (eğitim sonrası işaretlemek için)
    const pendingResult = await query(
      `SELECT id FROM analysis_corrections
       WHERE used_in_training = false AND blob_synced = true`
    );
    const pendingIds = pendingResult.rows.map(r => r.id);

    if (pendingIds.length === 0) {
      trainingLock = false;
      currentTraining = null;
      return {
        success: false,
        error: 'Blob sync yapılmış bekleyen düzeltme yok',
      };
    }

    // 5. build-dataset.mjs --train-only çalıştır
    logger.info(`[Retrain] Model eğitimi başlatılıyor: ${modelId} (${pendingIds.length} düzeltme)`);
    currentTraining.status = 'training';
    currentTraining.correctionCount = pendingIds.length;

    const trainResult = await runBuildDataset(modelId);

    if (trainResult.success) {
      // 6. Başarılı: düzeltmeleri işaretle
      currentTraining.status = 'marking';
      const markResult = await query(
        `UPDATE analysis_corrections
         SET used_in_training = true, updated_at = NOW()
         WHERE id = ANY($1::int[])
         RETURNING id`,
        [pendingIds]
      );

      const markedCount = markResult.rowCount;
      logger.info(`[Retrain] Eğitim başarılı! ${markedCount} düzeltme işaretlendi. Model: ${modelId}`);

      trainingLock = false;
      currentTraining = null;

      return {
        success: true,
        modelId,
        correctionCount: markedCount,
        syncResult,
        trainOutput: trainResult.output,
        elapsed: Date.now() - startTime,
      };
    } else {
      // 7. Başarısız: hiçbir şeyi değiştirme
      logger.error(`[Retrain] Eğitim başarısız: ${trainResult.error}`);

      trainingLock = false;
      currentTraining = null;

      return {
        success: false,
        error: trainResult.error,
        trainOutput: trainResult.output,
        elapsed: Date.now() - startTime,
      };
    }
  } catch (error) {
    logger.error('[Retrain] Pipeline hatası', { error: error.message });
    trainingLock = false;
    currentTraining = null;

    return {
      success: false,
      error: error.message,
      elapsed: Date.now() - startTime,
    };
  }
}

/**
 * build-dataset.mjs --train-only komutunu child process olarak çalıştır
 */
function runBuildDataset(modelId) {
  return new Promise((resolve) => {
    const args = [BUILD_DATASET_PATH, '--train-only', `--model=${modelId}`];

    logger.info(`[Retrain] Çalıştırılıyor: node ${args.join(' ')}`);

    const child = spawn('node', args, {
      cwd: path.dirname(BUILD_DATASET_PATH),
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      const text = data.toString();
      stdout += text;
      // Her satırı logla (gerçek zamanlı izleme)
      text.split('\n').filter(l => l.trim()).forEach(line => {
        logger.info(`[Retrain:stdout] ${line}`);
      });
    });

    child.stderr.on('data', (data) => {
      const text = data.toString();
      stderr += text;
      text.split('\n').filter(l => l.trim()).forEach(line => {
        logger.warn(`[Retrain:stderr] ${line}`);
      });
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({
          success: true,
          output: stdout.slice(-2000), // Son 2000 karakter
        });
      } else {
        resolve({
          success: false,
          error: `Process exited with code ${code}`,
          output: (stderr || stdout).slice(-2000),
        });
      }
    });

    child.on('error', (err) => {
      resolve({
        success: false,
        error: `Process spawn error: ${err.message}`,
        output: '',
      });
    });

    // Timeout
    setTimeout(() => {
      if (!child.killed) {
        child.kill('SIGTERM');
        resolve({
          success: false,
          error: `Timeout: ${TRAIN_TIMEOUT / 1000} saniye aşıldı`,
          output: stdout.slice(-2000),
        });
      }
    }, TRAIN_TIMEOUT);
  });
}

// ═══════════════════════════════════════════════════════════════
// YARDIMCI
// ═══════════════════════════════════════════════════════════════

/**
 * Sonraki model versiyonunu belirle
 * Mevcut AZURE_DOCUMENT_AI_MODEL_ID'den version numarasını çıkart ve +1
 */
function generateNextModelId() {
  const currentId = process.env.AZURE_DOCUMENT_AI_MODEL_ID || 'ihale-catering-v1';
  const match = currentId.match(/-v(\d+)$/);
  const currentVersion = match ? parseInt(match[1], 10) : 1;
  return `ihale-catering-v${currentVersion + 1}`;
}

/**
 * Scheduler-uyumlu kontrol fonksiyonu
 * Her gece çalıştırılabilir - SADECE kontrol eder, eğitim başlatmaz
 */
export async function scheduledRetrainCheck() {
  logger.info('[AutoRetrain] Zamanlanmış kontrol başlıyor');

  const status = await checkRetrainThreshold();

  if (status.shouldRetrain) {
    logger.warn('═'.repeat(60));
    logger.warn('[AutoRetrain] EĞİTİM GEREKLİ!');
    logger.warn(`[AutoRetrain] ${status.pendingCorrections} düzeltme bekliyor (eşik: ${RETRAIN_THRESHOLD})`);
    logger.warn(`[AutoRetrain] Admin panelden tetikleyin: POST /api/analysis-corrections/retrain/trigger`);
    logger.warn('═'.repeat(60));
    // İleride: Admin'e email/Slack notification gönderilebilir
  } else {
    logger.info(`[AutoRetrain] Eşik altında: ${status.pendingCorrections}/${RETRAIN_THRESHOLD}`);
  }

  return status;
}

export default {
  checkRetrainThreshold,
  getModelVersionInfo,
  triggerManualTraining,
  scheduledRetrainCheck,
  RETRAIN_THRESHOLD,
};
