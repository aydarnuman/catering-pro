/**
 * TENDER STATUS UPDATER CRON JOB
 * Her saat başı çalışır ve süresi dolan ihaleleri "expired" yapar
 */

import cron from 'node-cron';
import { query } from '../database.js';
import logger from '../utils/logger.js';

let cronJob = null;

/**
 * Süresi dolan ihaleleri güncelle
 */
async function updateExpiredTenders() {
  const startTime = Date.now();

  try {
    const result = await query(`
      UPDATE tenders
      SET status = 'expired', updated_at = NOW()
      WHERE status = 'active'
        AND tender_date IS NOT NULL
        AND tender_date < NOW()
    `);

    const updateCount = result.rowCount || 0;
    const duration = Date.now() - startTime;

    if (updateCount > 0) {
      logger.info('✅ İhale durumları güncellendi', {
        updatedCount: updateCount,
        duration: `${duration}ms`,
      });
    } else {
      logger.debug('ℹ️ Güncellenecek ihale yok', { duration: `${duration}ms` });
    }

    return { success: true, updatedCount: updateCount, duration };
  } catch (error) {
    logger.error('❌ İhale durum güncelleme hatası', {
      error: error.message,
      stack: error.stack,
    });
    return { success: false, error: error.message };
  }
}

/**
 * Cron job'ı başlat
 */
export function startTenderStatusUpdater() {
  if (cronJob) {
    logger.warn('⚠️ Tender status updater zaten çalışıyor');
    return;
  }

  // Her saat başı çalış (0. dakika)
  cronJob = cron.schedule('0 * * * *', async () => {
    logger.info('🔄 Tender status updater çalışıyor...');
    await updateExpiredTenders();
  });

  logger.info('✅ Tender status updater başlatıldı (Her saat başı çalışacak)');

  // İlk çalıştırmayı hemen yap
  updateExpiredTenders();
}

/**
 * Cron job'ı durdur
 */
export function stopTenderStatusUpdater() {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
    logger.info('🛑 Tender status updater durduruldu');
  }
}

/**
 * Manuel tetikleme (test için)
 */
export async function triggerManualUpdate() {
  logger.info('🔧 Manuel tender status update tetiklendi');
  return await updateExpiredTenders();
}

/**
 * Cron job durumu
 */
export function getStatus() {
  return {
    isRunning: cronJob !== null,
    schedule: '0 * * * * (Her saat başı)',
  };
}

export default {
  start: startTenderStatusUpdater,
  stop: stopTenderStatusUpdater,
  triggerManual: triggerManualUpdate,
  getStatus,
};
