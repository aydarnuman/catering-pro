/**
 * SUPABASE SERVER CLIENT - SADECE REALTIME/DB ICIN
 *
 * Bu client Auth icin KULLANILMIYOR.
 * Kimlik dogrulama: Custom JWT + bcrypt + HttpOnly Cookie
 * Auth dosyalari: context/AuthContext.tsx, middleware.ts
 */
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Build-safe env kontrolü (sadece Realtime/DB icin)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const PLACEHOLDER_URL = 'https://placeholder.supabase.co';
const PLACEHOLDER_KEY = 'placeholder-key-for-build';

export async function createClient() {
  const cookieStore = await cookies();

  // Build sırasında env vars yoksa placeholder kullan
  const url = supabaseUrl || PLACEHOLDER_URL;
  const key = supabaseAnonKey || PLACEHOLDER_KEY;

  // Runtime'da uyarı ver (build sırasında değil)
  if (typeof window === 'undefined' && (!supabaseUrl || !supabaseAnonKey)) {
    console.warn('[Supabase Server] Environment variables not set. Realtime will not work.');
  }

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Component'te çağrılırsa hata verebilir, ignore et
        }
      },
    },
  });
}
