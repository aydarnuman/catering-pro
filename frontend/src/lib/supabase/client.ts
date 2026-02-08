/**
 * SUPABASE CLIENT - SADECE REALTIME ICIN
 *
 * Bu client Auth icin KULLANILMIYOR.
 * Kimlik dogrulama: Custom JWT + bcrypt + HttpOnly Cookie
 * Auth dosyalari: context/AuthContext.tsx, middleware.ts
 *
 * Bu client sadece Supabase Realtime subscription icin kullanilir.
 * Kullanim yerleri: RealtimeContext.tsx, useRealtimeSubscription.ts
 */
import { createBrowserClient } from '@supabase/ssr';

// Supabase URL ve Anon Key kontrolü (sadece Realtime icin)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Build sırasında env vars yoksa placeholder kullan
const PLACEHOLDER_URL = 'https://placeholder.supabase.co';
const PLACEHOLDER_KEY = 'placeholder-key';

export function createClient() {
  // Runtime'da gerçek değerler kullanılacak
  const url = supabaseUrl || PLACEHOLDER_URL;
  const key = supabaseAnonKey || PLACEHOLDER_KEY;

  // Build sırasında uyarı ver ama hata verme
  if (!supabaseUrl || !supabaseAnonKey) {
    if (typeof window !== 'undefined') {
      console.warn('[Supabase] Environment variables not set. Realtime will not work.');
    }
  }

  return createBrowserClient(url, key);
}

// Supabase'in gerçekten kullanılabilir olup olmadığını kontrol et
export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey);
}
