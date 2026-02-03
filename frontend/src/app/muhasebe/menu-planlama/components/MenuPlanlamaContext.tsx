'use client';

import { notifications } from '@mantine/notifications';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { API_BASE_URL } from '@/lib/config';

// Types
export interface Proje {
  id: number;
  ad: string;
  musteri?: string;
  durum?: string;
  created_at?: string;
}

export interface OgunTipi {
  id: number;
  ad: string;
  kod: string;
  sira: number;
}

export interface SeciliYemek {
  id: string;
  recete_id: number;
  ad: string;
  fiyat: number;
  kategori?: string;
  ikon?: string;
}

export interface MenuPlan {
  id: number;
  proje_id: number;
  proje_adi?: string; // Backend'den gelen proje adı
  ad: string;
  tip: 'gunluk' | 'haftalik' | 'aylik';
  baslangic_tarihi: string;
  bitis_tarihi: string;
  varsayilan_kisi_sayisi: number;
  toplam_maliyet?: number;
  created_at: string;
  proje?: Proje;
  // Öğün bilgileri
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
  // Projeler
  projeler: Proje[];
  projelerLoading: boolean;
  selectedProjeId: number | null;
  setSelectedProjeId: (id: number | null) => void;

  // Öğün Tipleri
  ogunTipleri: OgunTipi[];
  ogunTipleriLoading: boolean;
  selectedOgunId: number | null;
  setSelectedOgunId: (id: number | null) => void;

  // Tarih
  selectedTarih: Date | null;
  setSelectedTarih: (tarih: Date | null) => void;

  // Seçili Yemekler (Sepet)
  seciliYemekler: SeciliYemek[];
  setSeciliYemekler: React.Dispatch<React.SetStateAction<SeciliYemek[]>>;
  addYemek: (yemek: Omit<SeciliYemek, 'id'>) => void;
  removeYemek: (id: string) => void;
  clearYemekler: () => void;

  // Kaydedilen Menüler
  kaydedilenMenuler: MenuPlan[];
  kaydedilenMenulerLoading: boolean;
  refetchMenuler: () => void;

  // Kaydetme
  saveMenuPlan: () => Promise<void>;
  savingMenu: boolean;
}

const MenuPlanlamaContext = createContext<MenuPlanlamaContextType | null>(null);

export function MenuPlanlamaProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  // State
  const [selectedProjeId, setSelectedProjeId] = useState<number | null>(null);
  const [selectedOgunId, setSelectedOgunId] = useState<number | null>(null);
  const [selectedTarih, setSelectedTarih] = useState<Date | null>(new Date());
  const [seciliYemekler, setSeciliYemekler] = useState<SeciliYemek[]>([]);

  // Projeleri çek
  const { data: projelerData, isLoading: projelerLoading } = useQuery({
    queryKey: ['menu-planlama-projeler'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/api/menu-planlama/projeler`);
      const data = await res.json();
      return data.success ? data.data : [];
    },
    staleTime: 5 * 60 * 1000, // 5 dakika
  });

  // Öğün tiplerini çek
  const { data: ogunTipleriData, isLoading: ogunTipleriLoading } = useQuery({
    queryKey: ['menu-planlama-ogun-tipleri'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/api/menu-planlama/ogun-tipleri`);
      const data = await res.json();
      return data.success ? data.data : [];
    },
    staleTime: 30 * 60 * 1000, // 30 dakika
  });

  // Kaydedilen menüleri çek
  const {
    data: kaydedilenMenulerData,
    isLoading: kaydedilenMenulerLoading,
    refetch: refetchMenuler,
  } = useQuery({
    queryKey: ['kaydedilen-menuler'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/api/menu-planlama/menu-planlari`);
      const data = await res.json();
      return data.success ? data.data : [];
    },
    staleTime: 60 * 1000, // 1 dakika
  });

  // Yemek ekleme
  const addYemek = useCallback((yemek: Omit<SeciliYemek, 'id'>) => {
    const id = `yemek-${yemek.recete_id}-${Date.now()}`;
    setSeciliYemekler((prev) => [...prev, { ...yemek, id }]);
  }, []);

  // Yemek silme
  const removeYemek = useCallback((id: string) => {
    setSeciliYemekler((prev) => prev.filter((y) => y.id !== id));
  }, []);

  // Tüm yemekleri temizle
  const clearYemekler = useCallback(() => {
    setSeciliYemekler([]);
  }, []);

  // Menü planı kaydetme mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedProjeId) throw new Error('Lütfen bir proje seçin');
      if (!selectedTarih) throw new Error('Lütfen bir tarih seçin');
      if (!selectedOgunId) throw new Error('Lütfen bir öğün tipi seçin');
      if (seciliYemekler.length === 0) throw new Error('Lütfen en az bir yemek ekleyin');

      const tarihStr = selectedTarih.toISOString().split('T')[0];

      // 1. Menü planı oluştur
      const planRes = await fetch(`${API_BASE_URL}/api/menu-planlama/menu-planlari`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proje_id: selectedProjeId,
          ad: `Menü - ${tarihStr}`,
          tip: 'gunluk',
          baslangic_tarihi: tarihStr,
          bitis_tarihi: tarihStr,
          varsayilan_kisi_sayisi: 500,
        }),
      });
      const planData = await planRes.json();
      if (!planData.success) throw new Error(planData.error || 'Plan oluşturulamadı');

      const planId = planData.data.id;

      // 2. Öğün ekle
      const ogunRes = await fetch(
        `${API_BASE_URL}/api/menu-planlama/menu-planlari/${planId}/ogunler`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tarih: tarihStr,
            ogun_tipi_id: selectedOgunId,
            kisi_sayisi: 500,
          }),
        }
      );
      const ogunData = await ogunRes.json();
      if (!ogunData.success) throw new Error(ogunData.error || 'Öğün eklenemedi');

      const ogunId = ogunData.data.id;

      // 3. Yemekleri ekle
      for (let i = 0; i < seciliYemekler.length; i++) {
        const yemek = seciliYemekler[i];
        await fetch(`${API_BASE_URL}/api/menu-planlama/ogunler/${ogunId}/yemekler`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recete_adi: yemek.ad,
            sira: i + 1,
            porsiyon_maliyet: yemek.fiyat,
          }),
        });
      }

      return planId;
    },
    onSuccess: () => {
      notifications.show({
        title: 'Başarılı',
        message: 'Menü planı kaydedildi',
        color: 'green',
      });
      clearYemekler();
      queryClient.invalidateQueries({ queryKey: ['kaydedilen-menuler'] });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Hata',
        message: error.message,
        color: 'red',
      });
    },
  });

  const saveMenuPlan = useCallback(async () => {
    await saveMutation.mutateAsync();
  }, [saveMutation]);

  const value: MenuPlanlamaContextType = {
    // Projeler
    projeler: projelerData || [],
    projelerLoading,
    selectedProjeId,
    setSelectedProjeId,

    // Öğün Tipleri
    ogunTipleri: ogunTipleriData || [],
    ogunTipleriLoading,
    selectedOgunId,
    setSelectedOgunId,

    // Tarih
    selectedTarih,
    setSelectedTarih,

    // Seçili Yemekler
    seciliYemekler,
    setSeciliYemekler,
    addYemek,
    removeYemek,
    clearYemekler,

    // Kaydedilen Menüler
    kaydedilenMenuler: kaydedilenMenulerData || [],
    kaydedilenMenulerLoading,
    refetchMenuler,

    // Kaydetme
    saveMenuPlan,
    savingMenu: saveMutation.isPending,
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
