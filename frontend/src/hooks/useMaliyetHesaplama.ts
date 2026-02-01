/**
 * Menü maliyet hesaplama custom hook
 * Sepetteki yemeklerin toplam maliyetlerini hesaplar
 */

import { useMemo } from 'react';

export interface SeciliYemek {
  id: string;
  recete_id?: number;
  kategori: string;
  ad: string;
  fiyat: number;
  fatura_fiyat?: number;
  piyasa_fiyat?: number;
  ikon?: string;
}

export interface MaliyetDetay {
  toplamYemekSayisi: number;
  ortalamaFiyat: number;
  kisiBasiMaliyet: number;
}

export const useMaliyetHesaplama = (yemekler: SeciliYemek[]) => {
  return useMemo(() => {
    const toplamMaliyet = yemekler.reduce((sum, y) => sum + y.fiyat, 0);
    const toplamFaturaMaliyet = yemekler.reduce((sum, y) => sum + (y.fatura_fiyat || y.fiyat), 0);
    const toplamPiyasaMaliyet = yemekler.reduce((sum, y) => sum + (y.piyasa_fiyat || y.fiyat), 0);
    
    const maliyetFarki = toplamPiyasaMaliyet - toplamFaturaMaliyet;
    const maliyetFarkiYuzde = toplamFaturaMaliyet > 0 ? (maliyetFarki / toplamFaturaMaliyet) * 100 : 0;
    
    const toplamYemekSayisi = yemekler.length;
    const ortalamaFiyat = toplamYemekSayisi > 0 ? toplamMaliyet / toplamYemekSayisi : 0;
    
    const maliyetDetay: MaliyetDetay = {
      toplamYemekSayisi,
      ortalamaFiyat,
      kisiBasiMaliyet: toplamMaliyet,
    };

    return {
      toplamMaliyet,
      toplamFaturaMaliyet,
      toplamPiyasaMaliyet,
      maliyetFarki,
      maliyetFarkiYuzde,
      maliyetDetay,
    };
  }, [yemekler]);
};
