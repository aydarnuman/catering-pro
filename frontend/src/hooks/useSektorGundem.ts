/**
 * Sektör Gündem Hooks
 * ───────────────────
 * TanStack Query tabanlı hook'lar.
 *
 * Kullanım:
 *   const { data, isLoading, refetch } = useSektorGundem('ihale');
 *   const { data, isLoading, refetch } = useSektorGundem('istihbarat');
 *   const { data, isLoading } = useFirmaHaberleri('Firma Adı');
 */

import { useQuery } from '@tanstack/react-query';
import { getApiUrl } from '@/lib/config';

// ─── Types ───────────────────────────────────────────────

export interface Haber {
  baslik: string;
  url: string;
  ozet?: string;
  tarih?: string;
  kaynak_tipi?: 'tavily' | 'ekap' | 'ihalebul' | 'kik' | 'hal' | 'google_news' | 'db';
  ekVeri?: Record<string, unknown>;
}

export interface GundemKonu {
  konu: string;
  baslik: string;
  ai_ozet?: string;
  /** @deprecated backward compat — yeni API'de ai_ozet kullanılır */
  ozet?: string;
  haberler: Haber[];
  kaynaklar?: {
    tavily: number;
    db: number;
    toplam: number;
  };
}

export interface GundemResponse {
  success: boolean;
  kaynak: 'cache' | 'canli' | 'statik';
  guncelleme?: string;
  sonraki_guncelleme?: string;
  konular: GundemKonu[];
  uyari?: string;
}

export interface FirmaHaberResponse {
  success: boolean;
  kaynak?: 'cache' | 'canli';
  guncelleme?: string;
  firma_adi: string;
  ai_ozet?: string;
  haberler: Haber[];
  kaynaklar?: {
    tavily: number;
    db: number;
    toplam: number;
  };
  firma_profil?: {
    unvan: string;
    toplam_sozlesme_tutari?: number;
    katildigi_ihale?: number;
    tamamlanan_ihale?: number;
    kazanma_orani?: number;
    durum_puani?: number;
  } | null;
}

// ─── Fetch fonksiyonları ─────────────────────────────────

async function fetchGundem(tip: 'ihale' | 'istihbarat', refresh = false): Promise<GundemResponse> {
  const url = getApiUrl(`/api/sektor-gundem/${tip}${refresh ? '?refresh=1' : ''}`);
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || json.uyari || 'Veri alınamadı');
  return json;
}

async function fetchFirmaHaber(firmaAdi: string): Promise<FirmaHaberResponse> {
  const url = getApiUrl(`/api/sektor-gundem/firma?q=${encodeURIComponent(firmaAdi)}`);
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Firma haberleri alınamadı');
  return json;
}

// ─── Hooks ───────────────────────────────────────────────

/**
 * Sektör gündemi hook'u
 * @param tip - 'ihale' (İhale Merkezi) veya 'istihbarat' (Yüklenici Kütüphanesi)
 * @param enabled - Hook aktif mi (default: true)
 */
export function useSektorGundem(tip: 'ihale' | 'istihbarat', enabled = true) {
  return useQuery<GundemResponse>({
    queryKey: ['sektor-gundem', tip],
    queryFn: () => fetchGundem(tip),
    enabled,
    staleTime: 15 * 60 * 1000, // 15 dk (backend cache'e güven)
    gcTime: 30 * 60 * 1000, // 30 dk garbage collection
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

/**
 * Firma bazlı haber hook'u
 * @param firmaAdi - Firma adı (min 3 karakter)
 */
export function useFirmaHaberleri(firmaAdi: string | null | undefined) {
  return useQuery<FirmaHaberResponse>({
    queryKey: ['firma-haberleri', firmaAdi],
    queryFn: () => fetchFirmaHaber(firmaAdi as string),
    enabled: !!firmaAdi && firmaAdi.length >= 3,
    staleTime: 30 * 60 * 1000, // 30 dk
    gcTime: 60 * 60 * 1000, // 1 saat
    refetchOnWindowFocus: false,
    retry: 1,
  });
}
