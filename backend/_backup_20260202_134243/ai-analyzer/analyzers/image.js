/**
 * Image Analyzer - Görsel dosya analizi
 */

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { aiConfig } from '../../../config/ai.config.js';
import logger from '../../../utils/logger.js';
import claudeClient from '../core/client.js';
import { PAGE_ANALYSIS_PROMPT } from '../core/prompts.js';
import { parsePageAnalysis } from '../utils/parser.js';

/**
 * Tek bir görseli analiz et
 * @param {string} imagePath - Görsel dosya yolu
 * @returns {Promise<Object>}
 */
export async function analyzeImage(imagePath) {
  const imageData = fs.readFileSync(imagePath);
  const base64Image = imageData.toString('base64');
  const ext = path.extname(imagePath).toLowerCase();

  const mimeType =
    ext === '.jpg' || ext === '.jpeg'
      ? 'image/jpeg'
      : ext === '.webp'
        ? 'image/webp'
        : ext === '.gif'
          ? 'image/gif'
          : 'image/png';

  logger.debug('Analyzing image', {
    module: 'ai-analyzer',
    action: 'image.analyze',
    imagePath,
    mimeType,
  });

  const responseText = await claudeClient.analyzeWithImage(base64Image, mimeType, PAGE_ANALYSIS_PROMPT);

  return parsePageAnalysis(responseText);
}

/**
 * Görsel dosyasını analiz et (optimize ederek)
 * @param {string} imagePath - Görsel dosya yolu
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Object>}
 */
export async function analyzeImageFile(imagePath, onProgress) {
  const startTime = Date.now();

  logger.info('Starting image analysis', {
    module: 'ai-analyzer',
    action: 'image.analyzeFile',
    imagePath,
  });

  if (onProgress) {
    onProgress({ stage: 'optimizing', message: 'Görsel optimize ediliyor...' });
  }

  // Görseli optimize et
  const ext = path.extname(imagePath).toLowerCase();
  const optimizedPath = imagePath.replace(ext, '_optimized.png');

  await sharp(imagePath)
    .resize(aiConfig.image.maxWidth, aiConfig.image.maxHeight, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .png({ quality: aiConfig.image.quality })
    .toFile(optimizedPath);

  if (onProgress) {
    onProgress({ stage: 'analyzing', message: 'Görsel analiz ediliyor...' });
  }

  const result = await analyzeImage(optimizedPath);

  // Temp dosyayı sil
  try {
    fs.unlinkSync(optimizedPath);
  } catch {}

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  logger.info('Image analysis completed', {
    module: 'ai-analyzer',
    action: 'image.analyzeFile',
    duration: `${duration}s`,
  });

  return {
    success: true,
    toplam_sayfa: 1,
    analiz: {
      tam_metin: result.sayfa_metni || '',
      ...result.tespit_edilen_bilgiler,
    },
    ham_sayfalar: [result],
  };
}

export default {
  analyzeImage,
  analyzeImageFile,
};
