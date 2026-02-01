/**
 * Reçete kategorileri yönetimi için custom hook
 * API'den kategori verilerini çeker ve standardize eder
 */

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { menuPlanlamaAPI } from '@/lib/api/services/menu-planlama';

// Varsayılan kategoriler
export const VARSAYILAN_KATEGORILER = [
  { kod: 'corba', ad: 'Çorbalar', ikon: '🥣', renk: 'orange' },
  { kod: 'sebze', ad: 'Sebze Yemekleri', ikon: '🥬', renk: 'green' },
  { kod: 'bakliyat', ad: 'Bakliyat', ikon: '🫘', renk: 'yellow' },
  { kod: 'tavuk', ad: 'Tavuk Yemekleri', ikon: '🍗', renk: 'orange' },
  { kod: 'et', ad: 'Et Yemekleri', ikon: '🥩', renk: 'red' },
  { kod: 'balik', ad: 'Balık', ikon: '🐟', renk: 'blue' },
  { kod: 'pilav', ad: 'Pilav & Makarna', ikon: '🍚', renk: 'cyan' },
  { kod: 'salata', ad: 'Salatalar', ikon: '🥗', renk: 'lime' },
  { kod: 'tatli', ad: 'Tatlılar', ikon: '🍮', renk: 'pink' },
  { kod: 'icecek', ad: 'İçecekler', ikon: '🥛', renk: 'grape' },
];

export interface ReceteYemek {
  id: number;
  ad: string;
  kategori?: string;
  sistem_maliyet?: number;
  piyasa_maliyet?: number;
  fatura_maliyet?: number;
  fatura_guncel?: boolean;
  piyasa_guncel?: boolean;
  fiyat?: number;
}

export interface ReceteKategori {
  kod: string;
  ad: string;
  ikon: string;
  renk: string;
  yemekler: ReceteYemek[];
}

export interface KategoriInfo {
  kod: string;
  ad: string;
  ikon: string;
  renk: string;
}

export function useReceteKategorileri() {
  // API'den reçete kategorilerini çek
  const {
    data: receteKategorileri = [],
    isLoading: receteKategorileriLoading,
    error: receteKategorileriError,
  } = useQuery<ReceteKategori[]>({
    queryKey: ['recete-kategorileri'],
    queryFn: async (): Promise<ReceteKategori[]> => {
      const result = await menuPlanlamaAPI.getRecetelerMaliyet();
      if (!result.success) {
        throw new Error('Reçeteler yüklenemedi');
      }

      const receteler = (result.data || []) as any[];
      const kategoriMap = new Map<string, ReceteKategori>();

      receteler.forEach((recete: any) => {
        let kategoriKod = 'diger';
        let kategoriAdi = recete.kategori_adi || 'Diğer';
        let kategoriIkon = recete.kategori_ikon || '🍽️';

        const varsayilanKategori = VARSAYILAN_KATEGORILER.find(
          (k) => k.ad.toLowerCase() === kategoriAdi.toLowerCase()
        );

        if (varsayilanKategori) {
          kategoriKod = varsayilanKategori.kod;
          kategoriIkon = varsayilanKategori.ikon;
        } else {
          kategoriKod = kategoriAdi.toLowerCase().replace(/[^a-z0-9]/g, '_');
        }

        if (!kategoriMap.has(kategoriKod)) {
          kategoriMap.set(kategoriKod, {
            kod: kategoriKod,
            ad: kategoriAdi,
            ikon: kategoriIkon,
            renk: varsayilanKategori?.renk || 'gray',
            yemekler: [],
          });
        }

        const kategori = kategoriMap.get(kategoriKod)!;
        kategori.yemekler.push({
          id: recete.id,
          ad: recete.ad,
          kategori: kategoriKod,
          fiyat: Number(recete.tahmini_maliyet || 0),
          sistem_maliyet: Number(recete.tahmini_maliyet || 0),
          piyasa_maliyet: Number(recete.piyasa_maliyet || 0),
          fatura_maliyet: Number(recete.fatura_maliyet || 0),
          fatura_guncel: recete.fatura_guncel !== false,
          piyasa_guncel: recete.piyasa_guncel !== false,
        });
      });

      return Array.from(kategoriMap.values()).sort((a, b) => a.ad.localeCompare(b.ad));
    },
    staleTime: 2 * 60 * 1000, // 2 dakika cache
    gcTime: 5 * 60 * 1000, // 5 dakika garbage collection
  });

  // Kategoriler listesi
  const KATEGORILER = useMemo<KategoriInfo[]>(() => {
    if (receteKategorileri.length === 0) {
      return VARSAYILAN_KATEGORILER;
    }
    return receteKategorileri.map((k) => ({
      kod: k.kod,
      ad: k.ad,
      ikon: k.ikon,
      renk: k.renk,
    }));
  }, [receteKategorileri]);

  // Kategori için reçeteleri getir
  const getRecetelerForKategori = (kategoriKod: string): ReceteYemek[] => {
    const kategori = receteKategorileri.find((k) => k.kod === kategoriKod);
    return kategori?.yemekler || [];
  };

  return {
    receteKategorileri,
    receteKategorileriLoading,
    receteKategorileriError,
    KATEGORILER,
    getRecetelerForKategori,
  };
}