'use client';

import { useQuery } from '@tanstack/react-query';
import { createContext, type ReactNode, useContext } from 'react';
import { menuPlanlamaAPI } from '@/lib/api/services/menu-planlama';

export type { Proje } from '@/types/domain';

import type { Proje } from '@/types/domain';

export interface OgunTipi {
  id: number;
  ad: string;
  kod: string;
  sira: number;
}

export interface MenuPlan {
  id: number;
  proje_id: number;
  proje_adi?: string;
  ad: string;
  tip: 'gunluk' | 'haftalik' | 'aylik';
  baslangic_tarihi: string;
  bitis_tarihi: string;
  varsayilan_kisi_sayisi: number;
  toplam_maliyet?: number;
  created_at: string;
  proje?: Proje;
  ogunler?: {
    id: number;
    ogun_tipi_id: number;
    ogun_tipi_adi?: string;
    yemekler?: Array<{
      id: number;
      recete_adi: string;
      porsiyon_maliyet: number;
    }>;
  }[];
}

interface MenuPlanlamaContextType {
  projeler: Proje[];
  projelerLoading: boolean;
  ogunTipleri: OgunTipi[];
  ogunTipleriLoading: boolean;
  kaydedilenMenuler: MenuPlan[];
  kaydedilenMenulerLoading: boolean;
  refetchMenuler: () => void;
}

const MenuPlanlamaContext = createContext<MenuPlanlamaContextType | null>(null);

export function MenuPlanlamaProvider({ children }: { children: ReactNode }) {
  // Projeleri çek
  const { data: projelerData, isLoading: projelerLoading } = useQuery({
    queryKey: ['menu-planlama-projeler'],
    queryFn: async () => {
      const res = await menuPlanlamaAPI.getProjeler();
      return res.success ? res.data : [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Öğün tiplerini çek
  const { data: ogunTipleriData, isLoading: ogunTipleriLoading } = useQuery({
    queryKey: ['menu-planlama-ogun-tipleri'],
    queryFn: async () => {
      const res = await menuPlanlamaAPI.getOgunTipleri();
      return res.success ? res.data : [];
    },
    staleTime: 30 * 60 * 1000,
  });

  // Kaydedilen menüleri çek
  const {
    data: kaydedilenMenulerData,
    isLoading: kaydedilenMenulerLoading,
    refetch: refetchMenuler,
  } = useQuery({
    queryKey: ['kaydedilen-menuler'],
    queryFn: async () => {
      const res = await menuPlanlamaAPI.getMenuPlanlari();
      return res.success ? res.data : [];
    },
    staleTime: 60 * 1000,
  });

  const value: MenuPlanlamaContextType = {
    projeler: (projelerData || []) as Proje[],
    projelerLoading,
    ogunTipleri: (ogunTipleriData || []) as OgunTipi[],
    ogunTipleriLoading,
    kaydedilenMenuler: (kaydedilenMenulerData || []) as MenuPlan[],
    kaydedilenMenulerLoading,
    refetchMenuler,
  };

  return <MenuPlanlamaContext.Provider value={value}>{children}</MenuPlanlamaContext.Provider>;
}

export function useMenuPlanlama() {
  const context = useContext(MenuPlanlamaContext);
  if (!context) {
    throw new Error('useMenuPlanlama must be used within a MenuPlanlamaProvider');
  }
  return context;
}
