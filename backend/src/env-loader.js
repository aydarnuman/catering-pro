/**
 * Environment Loader
 * Bu dosya en başta import edilmeli - diğer tüm import'lardan önce
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Backend .env dosyasını yükle
const envPath = path.join(__dirname, '../.env');
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.error('❌ .env dosyası yüklenemedi:', envPath);
  console.error(result.error);
} else {
  console.log('✅ .env yüklendi:', envPath);
}

// Debug: Kritik değişkenleri kontrol et
console.log('🔍 Environment Check:');
console.log('  DATABASE_URL:', process.env.DATABASE_URL ? '✓' : '✗');
console.log('  NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? '✓' : '✗');
console.log('  SUPABASE_SERVICE_KEY:', process.env.SUPABASE_SERVICE_KEY ? '✓' : '✗');
