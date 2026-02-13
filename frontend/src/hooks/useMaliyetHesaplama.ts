/**
 * Menü maliyet hesaplama custom hook
 * Sepetteki yemeklerin toplam maliyetlerini hesaplar
 */

import { useMemo } from 'react';

export interface SeciliYemek {
  id: string;
  recete_id: number;
  kategori: string;
  ad: string;
  fiyat: number;
  fatura_fiyat?: number;
  piyasa_fiyat?: number;
}

export const useMaliyetHesaplama = (yemekler: SeciliYemek[]) => {
  const toplamFaturaMaliyet = useMemo(
    () => yemekler.reduce((sum, y) => sum + (y.fatura_fiyat || y.fiyat), 0),
    [yemekler]
  );

  const toplamPiyasaMaliyet = useMemo(
    () => yemekler.reduce((sum, y) => sum + (y.piyasa_fiyat || y.fiyat), 0),
    [yemekler]
  );

  const toplamMaliyet = useMemo(() => yemekler.reduce((sum, y) => sum + y.fiyat, 0), [yemekler]);

  const maliyetFarki = toplamPiyasaMaliyet - toplamFaturaMaliyet;

  const maliyetFarkiYuzde = toplamFaturaMaliyet > 0 ? (maliyetFarki / toplamFaturaMaliyet) * 100 : 0;

  return {
    toplamMaliyet,
    toplamFaturaMaliyet,
    toplamPiyasaMaliyet,
    maliyetFarki,
    maliyetFarkiYuzde,
  };
};
