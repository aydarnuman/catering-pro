import { useDebouncedCallback } from '@mantine/hooks';
import { useCallback, useEffect, useState } from 'react';
import { tendersAPI } from '@/lib/api/services/tenders';
import type {
  AsiriDusukSonuc,
  BedelSonuc,
  MaliyetBilesenleri,
  SavedTender,
  TeklifItem,
  TeminatSonuc,
} from '../types';

export interface UseHesaplamalarReturn {
  // Ana değerler
  yaklasikMaliyet: number;
  setYaklasikMaliyet: (val: number) => void;
  sinirDeger: number | null;
  setSinirDeger: (val: number | null) => void;
  bizimTeklif: number;
  setBizimTeklif: (val: number) => void;
  hesaplananSinirDeger: number | null;
  setHesaplananSinirDeger: (val: number | null) => void;

  // Teklif listesi
  teklifListesi: TeklifItem[];
  setTeklifListesi: (val: TeklifItem[]) => void;

  // Maliyet bileşenleri
  maliyetBilesenleri: MaliyetBilesenleri;
  setMaliyetBilesenleri: (val: MaliyetBilesenleri) => void;

  // Sonuçlar
  asiriDusukSonuc: AsiriDusukSonuc | null;
  setAsiriDusukSonuc: (val: AsiriDusukSonuc | null) => void;
  teminatSonuc: TeminatSonuc | null;
  setTeminatSonuc: (val: TeminatSonuc | null) => void;
  bedelData: { yaklasikMaliyet: number };
  setBedelData: (val: { yaklasikMaliyet: number }) => void;
  bedelSonuc: BedelSonuc | null;
  setBedelSonuc: (val: BedelSonuc | null) => void;

  // Save status
  saveStatus: 'idle' | 'saving' | 'saved';
  dataLoaded: boolean;

  // Fonksiyonlar
  hesaplaSinirDeger: () => void;
  hesaplaAsiriDusuk: () => void;
  hesaplaTeminat: () => void;
  hesaplaBedel: () => void;
  resetHesaplamalar: () => void;
}

export function useHesaplamalar(
  tender: SavedTender | null,
  opened: boolean
): UseHesaplamalarReturn {
  // Ana değerler
  const [yaklasikMaliyet, setYaklasikMaliyet] = useState<number>(0);
  const [sinirDeger, setSinirDeger] = useState<number | null>(null);
  const [bizimTeklif, setBizimTeklif] = useState<number>(0);
  const [hesaplananSinirDeger, setHesaplananSinirDeger] = useState<number | null>(null);

  // Teklif listesi
  const [teklifListesi, setTeklifListesi] = useState<TeklifItem[]>([
    { firma: '', tutar: 0 },
    { firma: '', tutar: 0 },
  ]);

  // Maliyet bileşenleri
  const [maliyetBilesenleri, setMaliyetBilesenleri] = useState<MaliyetBilesenleri>({
    anaCigGirdi: 0,
    yardimciGirdi: 0,
    iscilik: 0,
    nakliye: 0,
    sozlesmeGideri: 0,
    genelGider: 0,
    kar: 0,
  });

  // Sonuçlar
  const [asiriDusukSonuc, setAsiriDusukSonuc] = useState<AsiriDusukSonuc | null>(null);
  const [teminatSonuc, setTeminatSonuc] = useState<TeminatSonuc | null>(null);
  const [bedelData, setBedelData] = useState({ yaklasikMaliyet: 0 });
  const [bedelSonuc, setBedelSonuc] = useState<BedelSonuc | null>(null);

  // Save tracking
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [dataLoaded, setDataLoaded] = useState(false);

  // Reset function
  const resetHesaplamalar = useCallback(() => {
    setYaklasikMaliyet(0);
    setSinirDeger(null);
    setBizimTeklif(0);
    setHesaplananSinirDeger(null);
    setTeklifListesi([
      { firma: '', tutar: 0 },
      { firma: '', tutar: 0 },
    ]);
    setMaliyetBilesenleri({
      anaCigGirdi: 0,
      yardimciGirdi: 0,
      iscilik: 0,
      nakliye: 0,
      sozlesmeGideri: 0,
      genelGider: 0,
      kar: 0,
    });
    setBedelData({ yaklasikMaliyet: 0 });
    setBedelSonuc(null);
    setAsiriDusukSonuc(null);
    setTeminatSonuc(null);
    setDataLoaded(false);
  }, []);

  // Auto-save (debounced)
  const saveHesaplamaData = useDebouncedCallback(async () => {
    if (!tender || !dataLoaded) return;

    setSaveStatus('saving');
    try {
      const hesaplamaVerileri = {
        teklif_listesi: teklifListesi.filter((t) => t.tutar > 0),
        maliyet_bilesenleri: maliyetBilesenleri,
        son_kayit: new Date().toISOString(),
      };

      await tendersAPI.updateTracking(Number(tender.id), {
        yaklasik_maliyet: yaklasikMaliyet || null,
        sinir_deger: sinirDeger || null,
        bizim_teklif: bizimTeklif || null,
        hesaplama_verileri: hesaplamaVerileri,
      });

      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Hesaplama verisi kaydetme hatası:', error);
      setSaveStatus('idle');
    }
  }, 1000);

  // Trigger auto-save
  useEffect(() => {
    if (dataLoaded && (yaklasikMaliyet > 0 || sinirDeger || bizimTeklif > 0)) {
      saveHesaplamaData();
    }
  }, [yaklasikMaliyet, sinirDeger, bizimTeklif, dataLoaded, saveHesaplamaData]);

  // Load saved data
  const loadSavedHesaplamaData = useCallback(async () => {
    if (!tender) return;

    try {
      const result = await tendersAPI.getTrackingList();

      if (result.success && result.data) {
        const currentTracking = result.data.find(
          (t: any) => t.id.toString() === tender.id || t.tender_id === tender.tender_id
        );

        if (currentTracking) {
          if (currentTracking.yaklasik_maliyet) {
            const yaklasikMaliyetValue = parseFloat(currentTracking.yaklasik_maliyet);
            setYaklasikMaliyet(yaklasikMaliyetValue);
            setBedelData({ yaklasikMaliyet: yaklasikMaliyetValue });
          } else if (tender.bedel) {
            const numericBedel = parseFloat(tender.bedel.replace(/[^\d,]/g, '').replace(',', '.'));
            if (!Number.isNaN(numericBedel)) {
              setYaklasikMaliyet(numericBedel);
              setBedelData({ yaklasikMaliyet: numericBedel });
            }
          }

          if (currentTracking.sinir_deger) {
            setSinirDeger(parseFloat(currentTracking.sinir_deger));
          }

          if (currentTracking.bizim_teklif) {
            setBizimTeklif(parseFloat(currentTracking.bizim_teklif));
          }

          if (currentTracking.hesaplama_verileri) {
            const hv =
              typeof currentTracking.hesaplama_verileri === 'string'
                ? JSON.parse(currentTracking.hesaplama_verileri)
                : currentTracking.hesaplama_verileri;

            if (hv && typeof hv === 'object') {
              if (
                hv.teklif_listesi &&
                Array.isArray(hv.teklif_listesi) &&
                hv.teklif_listesi.length >= 2
              ) {
                setTeklifListesi(hv.teklif_listesi);
              }
              if (hv.maliyet_bilesenleri && typeof hv.maliyet_bilesenleri === 'object') {
                setMaliyetBilesenleri({
                  anaCigGirdi: hv.maliyet_bilesenleri.anaCigGirdi || 0,
                  yardimciGirdi: hv.maliyet_bilesenleri.yardimciGirdi || 0,
                  iscilik: hv.maliyet_bilesenleri.iscilik || 0,
                  nakliye: hv.maliyet_bilesenleri.nakliye || 0,
                  sozlesmeGideri: hv.maliyet_bilesenleri.sozlesmeGideri || 0,
                  genelGider: hv.maliyet_bilesenleri.genelGider || 0,
                  kar: hv.maliyet_bilesenleri.kar || 0,
                });
              }
            }
          }

          setTimeout(() => setDataLoaded(true), 500);
          return;
        }
      }
    } catch (error) {
      console.error('Güncel veri yükleme hatası:', error);
    }

    // Fallback: tender objesinden yükle
    if (tender.bedel) {
      const numericBedel = parseFloat(tender.bedel.replace(/[^\d,]/g, '').replace(',', '.'));
      if (!Number.isNaN(numericBedel)) {
        setYaklasikMaliyet(numericBedel);
        setBedelData({ yaklasikMaliyet: numericBedel });
      }
    }

    setTimeout(() => setDataLoaded(true), 500);
  }, [tender]);

  // Load on open
  useEffect(() => {
    if (opened && tender) {
      resetHesaplamalar();
      loadSavedHesaplamaData();
    }
  }, [opened, tender?.tender_id, resetHesaplamalar, loadSavedHesaplamaData, tender]);

  // ===== HESAPLAMA FONKSİYONLARI =====

  // Sınır değer hesapla
  const hesaplaSinirDeger = useCallback(() => {
    const validTeklifler = teklifListesi
      .filter((t) => t.tutar > 0)
      .map((t) => t.tutar)
      .sort((a, b) => a - b);

    if (validTeklifler.length < 2 || !yaklasikMaliyet) {
      setHesaplananSinirDeger(null);
      return;
    }

    // Aşırı düşük teklifleri çıkar (%40'ın altındakileri)
    const filteredTeklifler = validTeklifler.filter((t) => t >= yaklasikMaliyet * 0.4);

    if (filteredTeklifler.length < 2) {
      setHesaplananSinirDeger(null);
      return;
    }

    // Ortalama hesapla
    const ortalama = filteredTeklifler.reduce((a, b) => a + b, 0) / filteredTeklifler.length;

    // K katsayısı hesapla (teklif sayısına göre)
    const n = filteredTeklifler.length;
    const k = n <= 3 ? 1.0 : n <= 5 ? 1.05 : n <= 10 ? 1.1 : 1.15;

    // Sınır değer = Ortalama / K
    const sinir = Math.round(ortalama / k);
    setHesaplananSinirDeger(sinir);
  }, [teklifListesi, yaklasikMaliyet]);

  // Aşırı düşük hesapla
  const hesaplaAsiriDusuk = useCallback(() => {
    const toplamMaliyet = Object.values(maliyetBilesenleri).reduce((a, b) => a + b, 0);

    if (toplamMaliyet === 0 || !sinirDeger) {
      setAsiriDusukSonuc(null);
      return;
    }

    const fark = sinirDeger - toplamMaliyet;
    const farkOran = ((sinirDeger - toplamMaliyet) / sinirDeger) * 100;

    setAsiriDusukSonuc({
      toplamMaliyet,
      asiriDusukMu: toplamMaliyet < sinirDeger,
      fark,
      farkOran,
      aciklama:
        toplamMaliyet < sinirDeger
          ? `Teklifiniz sınır değerin ${Math.abs(farkOran).toFixed(2)}% altında. Aşırı düşük teklif açıklaması yapmanız gerekiyor.`
          : 'Teklifiniz sınır değerin üzerinde. Açıklama gerekmez.',
    });
  }, [maliyetBilesenleri, sinirDeger]);

  // Teminat hesapla
  const hesaplaTeminat = useCallback(() => {
    if (!yaklasikMaliyet) {
      setTeminatSonuc(null);
      return;
    }

    const geciciTeminat = yaklasikMaliyet * 0.03; // %3
    const kesinTeminat = yaklasikMaliyet * 0.06; // %6
    const damgaVergisi = yaklasikMaliyet * 0.00948; // Binde 9.48

    setTeminatSonuc({
      geciciTeminat: Math.round(geciciTeminat),
      kesinTeminat: Math.round(kesinTeminat),
      damgaVergisi: Math.round(damgaVergisi),
    });
  }, [yaklasikMaliyet]);

  // Bedel hesapla
  const hesaplaBedel = useCallback(() => {
    if (!bedelData.yaklasikMaliyet) {
      setBedelSonuc(null);
      return;
    }

    const bedel = Math.round(bedelData.yaklasikMaliyet * 1.15);
    setBedelSonuc({
      bedel,
      aciklama: 'Yaklaşık maliyet üzerine %15 kar marjı ile hesaplanmıştır.',
    });
  }, [bedelData]);

  return {
    yaklasikMaliyet,
    setYaklasikMaliyet,
    sinirDeger,
    setSinirDeger,
    bizimTeklif,
    setBizimTeklif,
    hesaplananSinirDeger,
    setHesaplananSinirDeger,
    teklifListesi,
    setTeklifListesi,
    maliyetBilesenleri,
    setMaliyetBilesenleri,
    asiriDusukSonuc,
    setAsiriDusukSonuc,
    teminatSonuc,
    setTeminatSonuc,
    bedelData,
    setBedelData,
    bedelSonuc,
    setBedelSonuc,
    saveStatus,
    dataLoaded,
    hesaplaSinirDeger,
    hesaplaAsiriDusuk,
    hesaplaTeminat,
    hesaplaBedel,
    resetHesaplamalar,
  };
}
