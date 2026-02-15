import type { ReactNode } from 'react';

export type PlanTipi = 'gunluk' | 'haftalik' | '15gunluk' | 'aylik';

export interface TakvimYemek {
  id: string;
  ad: string;
  fiyat: number;
  ikon?: string;
  malzemeSayisi?: number;
  kategoriAdi?: string;
}

export interface TakvimHucre {
  tarih: Date;
  ogunTipiId: number;
  yemekler: TakvimYemek[];
}

export interface TakvimState {
  [key: string]: TakvimHucre; // key: "2026-02-15_ogle"
}

export interface OgunInfo {
  id: number;
  kod: string;
  ad: string;
  ikon: ReactNode;
  renk: string;
}

// Tarih yardımcıları
export const formatTarih = (tarih: Date) => tarih.toISOString().split('T')[0];
export const formatGunAdi = (tarih: Date) => tarih.toLocaleDateString('tr-TR', { weekday: 'short' });
export const formatGunNo = (tarih: Date) => tarih.getDate();

export const getTarihAraligi = (baslangic: Date, tip: PlanTipi): Date[] => {
  const gunSayisi = {
    gunluk: 1,
    haftalik: 7,
    '15gunluk': 15,
    aylik: 30,
  }[tip];

  const tarihler: Date[] = [];
  for (let i = 0; i < gunSayisi; i++) {
    const tarih = new Date(baslangic);
    tarih.setDate(baslangic.getDate() + i);
    tarihler.push(tarih);
  }
  return tarihler;
};
