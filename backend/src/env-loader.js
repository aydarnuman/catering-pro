/**
 * Environment Loader
 * Bu dosya en başta import edilmeli - diğer tüm import'lardan önce
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { validateEnvironment } from './utils/env-validator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Backend .env dosyasını yükle
const envPath = path.join(__dirname, '../.env');
const result = dotenv.config({ path: envPath });

if (result.error) {
  // Development'ta .env dosyası yoksa uyarı ver ama devam et
  if (process.env.NODE_ENV !== 'production') {
    console.warn('⚠️ .env dosyası yüklenemedi (development modunda devam ediliyor):', envPath);
  } else {
    console.error('❌ .env dosyası yüklenemedi:', envPath);
    console.error(result.error);
    process.exit(1);
  }
}

// Environment variable'ları validate et
try {
  validateEnvironment();
} catch (error) {
  console.error('❌ Environment validation hatası:', error.message);
  process.exit(1);
}
