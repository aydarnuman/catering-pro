'use client';

import { useQuery } from '@tanstack/react-query';
import { createContext, type ReactNode, useContext } from 'react';
import { menuPlanlamaAPI } from '@/lib/api/services/menu-planlama';
import type { MenuPlan, OgunTipi } from './types';

export type { Proje } from '@/types/domain';
export type { MenuPlan, OgunTipi } from './types';

import type { Proje } from '@/types/domain';

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
