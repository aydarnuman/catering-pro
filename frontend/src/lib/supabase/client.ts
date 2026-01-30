/**
 * SUPABASE BROWSER CLIENT - DEPRECATED
 *
 * ⚠️  BU DOSYA ARTIK KULLANILMIYOR
 * ⚠️  Auth sistemi PostgreSQL + JWT tabanlı (AuthContext.tsx)
 *
 * Bu dosya sadece geriye dönük uyumluluk için bırakıldı.
 * Yeni kod yazarken bu dosyayı import etmeyin.
 *
 * Auth için: frontend/src/context/AuthContext.tsx
 * API çağrıları için: frontend/src/lib/api/*
 *
 * @see /docs/ARCHITECTURE.md
 * @deprecated
 */

import { createBrowserClient } from '@supabase/ssr';

// Supabase URL ve Anon Key kontrolü
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Build sırasında env vars yoksa placeholder kullan
const PLACEHOLDER_URL = 'https://placeholder.supabase.co';
const PLACEHOLDER_KEY = 'placeholder-key';

/**
 * @deprecated Auth için AuthContext kullanın
 */
export function createClient() {
  console.warn('[DEPRECATED] supabase/client.ts kullanılmamalı - AuthContext kullanın');

  const url = supabaseUrl || PLACEHOLDER_URL;
  const key = supabaseAnonKey || PLACEHOLDER_KEY;

  return createBrowserClient(url, key);
}

/**
 * @deprecated
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey);
}
