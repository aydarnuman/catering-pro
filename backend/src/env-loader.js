/**
 * Environment Loader
 * Bu dosya en başta import edilmeli - diğer tüm import'lardan önce
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { validateEnvironment } from './utils/env-validator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Önce proje kökü .env, sonra backend/.env (böylece tek .env yeterli olur)
const rootEnv = path.join(__dirname, '../../.env');
const backendEnv = path.join(__dirname, '../.env');
dotenv.config({ path: rootEnv });
const result = dotenv.config({ path: backendEnv });

if (result.error && process.env.NODE_ENV === 'production') {
  console.error('❌ .env dosyası yüklenemedi:', result.error);
  process.exit(1);
}

// Environment variable'ları validate et
try {
  validateEnvironment();
} catch (error) {
  console.error('❌ Environment validation hatası:', error.message);
  process.exit(1);
}
