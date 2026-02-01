/**
 * SUPABASE SERVER CLIENT - DEPRECATED
 *
 * ⚠️  BU DOSYA ARTIK KULLANILMIYOR
 * ⚠️  Auth sistemi PostgreSQL + JWT tabanlı
 *
 * Bu dosya sadece geriye dönük uyumluluk için bırakıldı.
 * Yeni kod yazarken bu dosyayı import etmeyin.
 *
 * Auth için: Backend API (/api/auth/*)
 * Server-side veri çekme: Backend API çağrıları
 *
 * @see /docs/ARCHITECTURE.md
 * @deprecated
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const PLACEHOLDER_URL = 'https://placeholder.supabase.co';
const PLACEHOLDER_KEY = 'placeholder-key-for-build';

/**
 * @deprecated Auth için backend API kullanın
 */
export async function createClient() {
  console.warn('[DEPRECATED] supabase/server.ts kullanılmamalı - Backend API kullanın');

  const cookieStore = await cookies();
  const url = supabaseUrl || PLACEHOLDER_URL;
  const key = supabaseAnonKey || PLACEHOLDER_KEY;

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Component'te çağrılırsa hata verebilir
        }
      },
    },
  });
}
