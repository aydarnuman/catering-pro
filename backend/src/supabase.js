/**
 * Supabase Client - SADECE STORAGE İÇİN
 *
 * ⚠️  AUTH İÇİN KULLANILMIYOR - Kendi JWT sistemimiz var (middleware/auth.js, routes/auth.js)
 * ⚠️  DATABASE QUERY İÇİN KULLANILMIYOR - database.js kullanılıyor
 *
 * Bu dosya sadece:
 * - Supabase Storage (döküman upload/download - document-storage.js)
 * - Signed URL oluşturma
 * için kullanılır.
 *
 * Supabase hala şunlar için kullanılıyor:
 * - PostgreSQL Hosting (bağlantı database.js üzerinden)
 * - Migrations (Supabase CLI: supabase db push)
 * - Storage (bu dosya üzerinden)
 *
 * @see /docs/ARCHITECTURE.md
 */

import { createClient } from '@supabase/supabase-js';
import logger from './utils/logger.js';

// Lazy initialized client
let _supabase = null;
let _initialized = false;

/**
 * Get or create Supabase client (lazy initialization)
 * Bu fonksiyon çağrıldığında env değişkenleri zaten yüklenmiş olmalı
 */
function getSupabaseClient() {
  if (_initialized) {
    return _supabase;
  }

  _initialized = true;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

  const apiKey = supabaseServiceKey || supabaseAnonKey;

  if (!supabaseUrl || !apiKey) {
    logger.warn('[Supabase] Environment variables eksik - Storage çalışmayacak');
    return null;
  }

  _supabase = createClient(supabaseUrl, apiKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  return _supabase;
}

// Export as getter - her erişimde lazy init kontrol edilir
export const supabase = new Proxy(
  {},
  {
    get(_target, prop) {
      const client = getSupabaseClient();
      if (!client) {
        throw new Error(
          'Supabase client mevcut değil. SUPABASE_SERVICE_KEY veya NEXT_PUBLIC_SUPABASE_URL eksik olabilir.'
        );
      }
      return client[prop];
    },
  }
);

/**
 * Supabase'in kullanılabilir olup olmadığını kontrol et
 * @returns {boolean}
 */
export function isSupabaseConfigured() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(supabaseUrl && supabaseKey);
}

export default supabase;

// ===========================================================================
// DEPRECATED EXPORTS - Geriye dönük uyumluluk için bırakıldı
// Bu export'lar artık KULLANILMIYOR - database.js kullanılıyor
// Yeni kod yazılırken bunları kullanmayın!
// ===========================================================================

/**
 * @deprecated database.js'teki query fonksiyonunu kullanın
 */
export async function query(_text, _params = []) {
  logger.warn('[DEPRECATED] supabase.js query() kullanılmamalı - database.js kullanın');
  throw new Error('Bu fonksiyon deprecated. database.js kullanın.');
}

/**
 * @deprecated database.js'teki transaction fonksiyonunu kullanın
 */
export async function transaction(_callback) {
  logger.warn('[DEPRECATED] supabase.js transaction() kullanılmamalı - database.js kullanın');
  throw new Error('Bu fonksiyon deprecated. database.js kullanın.');
}

/**
 * @deprecated database.js'teki pool'u kullanın
 */
export const pool = {
  query: () => {
    throw new Error('supabase.js pool deprecated. database.js kullanın.');
  },
  connect: () => {
    throw new Error('supabase.js pool deprecated. database.js kullanın.');
  },
};

/**
 * @deprecated Bu helper'lar artık kullanılmıyor
 */
export const db = {
  _deprecated: true,
  _message: 'Bu helper artık kullanılmıyor. database.js ve ilgili route dosyalarını kullanın.',
};
