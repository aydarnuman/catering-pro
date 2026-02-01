'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useMaliyetHesaplama, type SeciliYemek, type MaliyetDetay } from '@/hooks/useMaliyetHesaplama';

export interface MenuPlanlamaContextType {
  // Sepet yönetimi
  seciliYemekler: SeciliYemek[];
  setSeciliYemekler: (yemekler: SeciliYemek[]) => void;
  clearSepet: () => void;
  
  // Kişi sayısı
  kisiSayisi: number;
  setKisiSayisi: (sayi: number) => void;
  
  // Maliyet hesaplamaları
  toplamMaliyet: number;
  maliyetDetay: MaliyetDetay;
  
  // Utility functions
  handleYemekEkle: (yemek: Omit<SeciliYemek, 'id'>) => void;
  handleYemekSil: (id: string) => void;
}

const MenuPlanlamaContext = createContext<MenuPlanlamaContextType | undefined>(undefined);

interface MenuPlanlamaProviderProps {
  children: ReactNode;
}

export function MenuPlanlamaProvider({ children }: MenuPlanlamaProviderProps) {
  // LocalStorage state'ler
  const [seciliYemekler, setSeciliYemekler, clearSepet] = useLocalStorage<SeciliYemek[]>(
    'menu-sepet',
    []
  );
  const [kisiSayisi, setKisiSayisi] = useLocalStorage<number>('menu-kisi-sayisi', 1000);

  // Maliyet hesaplamaları
  const maliyetHesaplama = useMaliyetHesaplama(seciliYemekler);
  const { toplamMaliyet, maliyetDetay } = maliyetHesaplama;

  // Utility functions
  const handleYemekEkle = (yemek: Omit<SeciliYemek, 'id'>) => {
    const id = `recete-${Date.now()}`;
    const mevcut = seciliYemekler.find((y) => y.ad === yemek.ad && y.kategori === yemek.kategori);
    
    if (mevcut) {
      // Zaten var, kaldır
      setSeciliYemekler(seciliYemekler.filter((y) => y.id !== mevcut.id));
    } else {
      // Yeni ekle
      setSeciliYemekler([...seciliYemekler, { ...yemek, id }]);
    }
  };

  const handleYemekSil = (id: string) => {
    setSeciliYemekler(seciliYemekler.filter((y) => y.id !== id));
  };

  const value: MenuPlanlamaContextType = {
    seciliYemekler,
    setSeciliYemekler,
    clearSepet,
    kisiSayisi,
    setKisiSayisi,
    toplamMaliyet,
    maliyetDetay,
    handleYemekEkle,
    handleYemekSil,
  };

  return (
    <MenuPlanlamaContext.Provider value={value}>
      {children}
    </MenuPlanlamaContext.Provider>
  );
}

export function useMenuPlanlama() {
  const context = useContext(MenuPlanlamaContext);
  if (context === undefined) {
    throw new Error('useMenuPlanlama must be used within a MenuPlanlamaProvider');
  }
  return context;
}