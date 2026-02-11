'use client';

import { notifications } from '@mantine/notifications';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { tendersAPI } from '@/lib/api/services/tenders';
import {
  formatPara,
  hesaplaCetvelToplami,
  hesaplaKarVeTeklif,
  hesaplaToplam,
  hesaplaTumMaliyetler,
} from '../../../teklif/hesaplamalar';
import {
  hesaplaBasitSinirDeger,
  hesaplaRiskAnalizi,
  hesaplaTeminatlar,
  parseIsSuresiAy,
} from '../../calculation-utils';
import type {
  CetvelKalemi,
  CompletionMap,
  DetectedValue,
  HesaplamaState,
  MaliyetKalemKey,
  SavedTender,
  TeklifData,
  TeklifMerkeziSection,
} from '../types';
import { DEFAULT_TEKLIF_DATA } from '../types';

// ─── Hook Return Type ──────────────────────────────────────────

export interface UseTeklifMerkeziReturn {
  // Navigation
  activeSection: TeklifMerkeziSection;
  setActiveSection: (section: TeklifMerkeziSection) => void;
  completionMap: CompletionMap;

  // Teklif Data (Maliyet + Cetvel)
  teklifData: TeklifData;
  hesaplanmisTeklifData: TeklifData;
  setTeklifData: React.Dispatch<React.SetStateAction<TeklifData>>;
  updateMaliyetDetay: (kalem: MaliyetKalemKey, path: string, value: unknown) => void;
  handleKarOraniChange: (value: number | string) => void;
  handleCetvelBirimFiyatChange: (index: number, birimFiyat: number) => void;
  handleCetvelMiktarChange: (index: number, miktar: number) => void;
  handleCetvelIsKalemiChange: (index: number, isKalemi: string) => void;
  handleCetvelBirimChange: (index: number, birim: string) => void;
  handleCetvelKalemEkle: () => void;
  handleCetvelKalemSil: (index: number) => void;
  selectedKalem: MaliyetKalemKey;
  setSelectedKalem: (k: MaliyetKalemKey) => void;
  existingTeklifId: number | null;

  // Hesaplama State (KİK)
  hesaplamaState: HesaplamaState;
  setHesaplamaState: React.Dispatch<React.SetStateAction<HesaplamaState>>;
  basitSinirDeger: number;
  aktifSinirDeger: number;
  riskAnalizi: { isAsiriDusuk: boolean; fark: number; farkYuzde: number };
  teminatlar: { geciciTeminat: number; kesinTeminat: number };
  isSuresi: string;
  toplamOgun: number;
  teknikSartSayisi: number;
  birimFiyatSayisi: number;
  isSuresiAy: number;
  ogunBasiMaliyet: number;
  ogunBasiTeklif: number;
  aylikMaliyet: number;
  gunlukOgun: number;

  // Tespit (Suggestions)
  detectedValues: DetectedValue[];
  setDetectedValues: React.Dispatch<React.SetStateAction<DetectedValue[]>>;
  selectedSuggestionKeys: Set<string>;
  setSelectedSuggestionKeys: React.Dispatch<React.SetStateAction<Set<string>>>;
  suggestionsLoading: boolean;
  fetchSuggestions: () => Promise<void>;
  applySuggestions: () => Promise<void>;

  // Save / Loading
  loading: boolean;
  saving: boolean;
  isDirty: boolean;
  handleSave: () => Promise<void>;

  // Tender info
  tender: SavedTender;
}

// ─── Hook ──────────────────────────────────────────────────────

export function useTeklifMerkezi(
  tender: SavedTender,
  initialSection: TeklifMerkeziSection = 'tespit',
  onRefresh?: () => void
): UseTeklifMerkeziReturn {
  // ═══ Navigation ═══
  const [activeSection, setActiveSection] = useState<TeklifMerkeziSection>(initialSection);

  // ═══ Teklif Data ═══
  const [teklifData, setTeklifData] = useState<TeklifData>(() => ({
    ...JSON.parse(JSON.stringify(DEFAULT_TEKLIF_DATA)),
    ihale_adi: tender.ihale_basligi || '',
    ihale_kayit_no: tender.external_id || '',
  }));
  const [selectedKalem, setSelectedKalem] = useState<MaliyetKalemKey>('malzeme');
  const [existingTeklifId, setExistingTeklifId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const initialLoadDone = useRef(false);

  // ═══ Hesaplama State ═══
  const [hesaplamaState, setHesaplamaState] = useState<HesaplamaState>(() => {
    const hv = (tender as unknown as Record<string, unknown>).hesaplama_verileri as
      | Record<string, unknown>
      | undefined;
    return {
      yaklasikMaliyet: tender.yaklasik_maliyet || 0,
      bizimTeklif: tender.bizim_teklif || 0,
      ihaleTuru: ((hv?.ihaleTuru as string) || 'hizmet') as HesaplamaState['ihaleTuru'],
      teklifListesi: buildTeklifListesi(hv),
      kikSinirDeger: (hv?.kikSinirDeger as number) || null,
      maliyetler: (hv?.maliyetler as HesaplamaState['maliyetler']) || {
        hammadde: 0,
        iscilik: 0,
        enerji: 0,
        nakliye: 0,
        ambalaj: 0,
        diger: 0,
      },
    };
  });

  // ═══ Tespit (Suggestions) ═══
  const [detectedValues, setDetectedValues] = useState<DetectedValue[]>([]);
  const [selectedSuggestionKeys, setSelectedSuggestionKeys] = useState<Set<string>>(new Set());
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  // ═══ Derived: Analysis Summary ═══
  const analysisSummary = tender.analysis_summary;
  const hv = (tender as unknown as Record<string, unknown>).hesaplama_verileri as
    | Record<string, unknown>
    | undefined;

  const isSuresi = String(
    hv?.is_suresi || analysisSummary?.teslim_suresi || analysisSummary?.sure || ''
  );
  const toplamOgun =
    (hv?.toplam_ogun_sayisi as number) ||
    analysisSummary?.ogun_bilgileri?.reduce(
      (sum: number, o: { miktar?: number }) => sum + (Number(o.miktar) || 0),
      0
    ) ||
    0;
  const teknikSartSayisi =
    (hv?.teknik_sart_sayisi as number) || analysisSummary?.teknik_sartlar?.length || 0;
  const birimFiyatSayisi =
    (hv?.birim_fiyat_sayisi as number) || analysisSummary?.birim_fiyatlar?.length || 0;
  const isSuresiAy = parseIsSuresiAy(isSuresi);

  // ═══ Derived: Hesaplama ═══
  const basitSinirDeger = hesaplaBasitSinirDeger(hesaplamaState.yaklasikMaliyet);
  const aktifSinirDeger = hesaplamaState.kikSinirDeger || basitSinirDeger;
  const riskAnalizi = hesaplaRiskAnalizi(hesaplamaState.bizimTeklif, aktifSinirDeger);
  const teminatlar = hesaplaTeminatlar(hesaplamaState.bizimTeklif);
  const ogunBasiMaliyet =
    hesaplamaState.yaklasikMaliyet && toplamOgun ? hesaplamaState.yaklasikMaliyet / toplamOgun : 0;
  const ogunBasiTeklif =
    hesaplamaState.bizimTeklif && toplamOgun ? hesaplamaState.bizimTeklif / toplamOgun : 0;
  const aylikMaliyet =
    hesaplamaState.yaklasikMaliyet && isSuresiAy ? hesaplamaState.yaklasikMaliyet / isSuresiAy : 0;
  const gunlukOgun = toplamOgun && isSuresiAy ? Math.round(toplamOgun / (isSuresiAy * 30)) : 0;

  // ═══ Derived: Teklif Hesaplama ═══
  const hesaplanmisTeklifData = useMemo(() => {
    const yeniDetay = hesaplaTumMaliyetler(teklifData.maliyet_detay);
    const maliyetToplam = hesaplaToplam(yeniDetay);
    const { karTutari, teklifFiyati } = hesaplaKarVeTeklif(maliyetToplam, teklifData.kar_orani);
    return {
      ...teklifData,
      maliyet_detay: yeniDetay,
      maliyet_toplam: maliyetToplam,
      kar_tutari: karTutari,
      teklif_fiyati: teklifFiyati,
    };
  }, [teklifData]);

  // ═══ Load Existing Teklif ═══
  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;

    const loadExisting = async () => {
      if (!tender.tender_id) return;
      setLoading(true);
      try {
        const data = await tendersAPI.getTeklifByIhale(tender.tender_id);
        if (data.success && data.data) {
          setTeklifData(data.data);
          setExistingTeklifId(data.data.id || null);
        }
      } catch {
        // İlk kez teklif oluşturulacak
      } finally {
        setLoading(false);
      }

      // Birim fiyatları cetvele ekle (eğer teklif yoksa)
      if (analysisSummary?.birim_fiyatlar?.length) {
        setTeklifData((prev) => {
          if (prev.birim_fiyat_cetveli.length > 0) return prev;
          const cetvel: CetvelKalemi[] = (analysisSummary.birim_fiyatlar ?? []).map(
            (item, idx) => ({
              sira: idx + 1,
              isKalemi: item.kalem || item.aciklama || item.text || '',
              birim: item.birim || 'Öğün',
              miktar: typeof item.miktar === 'number' ? item.miktar : Number(item.miktar) || 0,
              birimFiyat: 0,
              tutar: 0,
            })
          );
          return { ...prev, birim_fiyat_cetveli: cetvel };
        });
      }
    };

    loadExisting();
  }, [tender.tender_id, analysisSummary]);

  // ═══ Dirty Tracking ═══
  const teklifDataRef = useRef(teklifData);
  const hesaplamaStateRef = useRef(hesaplamaState);
  useEffect(() => {
    if (!initialLoadDone.current) return;
    // Referans değişikliği = veri değişti
    if (teklifDataRef.current !== teklifData || hesaplamaStateRef.current !== hesaplamaState) {
      teklifDataRef.current = teklifData;
      hesaplamaStateRef.current = hesaplamaState;
      setIsDirty(true);
    }
  });

  // ═══ Actions: Maliyet Detay ═══
  const updateMaliyetDetay = useCallback((kalem: MaliyetKalemKey, path: string, value: unknown) => {
    setTeklifData((prev) => {
      const yeniDetay = JSON.parse(JSON.stringify(prev.maliyet_detay));
      const keys = path.split('.');
      let obj: Record<string, unknown> = yeniDetay[kalem].detay;
      for (let i = 0; i < keys.length - 1; i++) {
        obj = obj[keys[i]] as Record<string, unknown>;
      }
      obj[keys[keys.length - 1]] = value;
      return { ...prev, maliyet_detay: yeniDetay };
    });
  }, []);

  const handleKarOraniChange = useCallback((value: number | string) => {
    const oran = typeof value === 'number' ? value : parseFloat(String(value)) || 0;
    setTeklifData((prev) => ({ ...prev, kar_orani: oran }));
  }, []);

  // ═══ Actions: Cetvel ═══
  const handleCetvelBirimFiyatChange = useCallback((index: number, birimFiyat: number) => {
    setTeklifData((prev) => {
      const yeniCetvel = [...prev.birim_fiyat_cetveli];
      yeniCetvel[index] = {
        ...yeniCetvel[index],
        birimFiyat,
        tutar: yeniCetvel[index].miktar * birimFiyat,
      };
      return {
        ...prev,
        birim_fiyat_cetveli: yeniCetvel,
        cetvel_toplami: hesaplaCetvelToplami(yeniCetvel),
      };
    });
  }, []);

  const handleCetvelMiktarChange = useCallback((index: number, miktar: number) => {
    setTeklifData((prev) => {
      const yeniCetvel = [...prev.birim_fiyat_cetveli];
      yeniCetvel[index] = {
        ...yeniCetvel[index],
        miktar,
        tutar: miktar * yeniCetvel[index].birimFiyat,
      };
      return {
        ...prev,
        birim_fiyat_cetveli: yeniCetvel,
        cetvel_toplami: hesaplaCetvelToplami(yeniCetvel),
      };
    });
  }, []);

  const handleCetvelIsKalemiChange = useCallback((index: number, isKalemi: string) => {
    setTeklifData((prev) => {
      const yeniCetvel = [...prev.birim_fiyat_cetveli];
      yeniCetvel[index] = { ...yeniCetvel[index], isKalemi };
      return { ...prev, birim_fiyat_cetveli: yeniCetvel };
    });
  }, []);

  const handleCetvelBirimChange = useCallback((index: number, birim: string) => {
    setTeklifData((prev) => {
      const yeniCetvel = [...prev.birim_fiyat_cetveli];
      yeniCetvel[index] = { ...yeniCetvel[index], birim };
      return { ...prev, birim_fiyat_cetveli: yeniCetvel };
    });
  }, []);

  const handleCetvelKalemEkle = useCallback(() => {
    setTeklifData((prev) => ({
      ...prev,
      birim_fiyat_cetveli: [
        ...prev.birim_fiyat_cetveli,
        {
          sira: prev.birim_fiyat_cetveli.length + 1,
          isKalemi: '',
          birim: 'Öğün',
          miktar: 0,
          birimFiyat: 0,
          tutar: 0,
        },
      ],
    }));
  }, []);

  const handleCetvelKalemSil = useCallback((index: number) => {
    setTeklifData((prev) => {
      const yeniCetvel = prev.birim_fiyat_cetveli.filter((_, i) => i !== index);
      for (let i = 0; i < yeniCetvel.length; i++) yeniCetvel[i].sira = i + 1;
      return {
        ...prev,
        birim_fiyat_cetveli: yeniCetvel,
        cetvel_toplami: hesaplaCetvelToplami(yeniCetvel),
      };
    });
  }, []);

  // ═══ Actions: Suggestions ═══
  const fetchSuggestions = useCallback(async () => {
    setSuggestionsLoading(true);
    try {
      const response = await tendersAPI.getTenderSuggestions(Number(tender.id));
      if (response.success && response.data) {
        const suggestions = response.data.suggestions || [];
        setDetectedValues(suggestions);
        setSelectedSuggestionKeys(new Set(suggestions.map((s: DetectedValue) => s.key)));
      }
    } catch {
      // Fallback
      const fallback: DetectedValue[] = [];
      if (tender.yaklasik_maliyet) {
        fallback.push({
          key: 'yaklasik_maliyet',
          label: 'Yaklaşık Maliyet',
          value: tender.yaklasik_maliyet,
          source: 'sartname',
          fieldName: 'yaklasik_maliyet',
          type: 'currency',
        });
      }
      if (tender.sinir_deger) {
        fallback.push({
          key: 'sinir_deger',
          label: 'Sınır Değer',
          value: tender.sinir_deger,
          source: 'hesaplama',
          fieldName: 'sinir_deger',
          type: 'currency',
        });
      }
      setDetectedValues(fallback);
      setSelectedSuggestionKeys(new Set(fallback.map((s) => s.key)));
    } finally {
      setSuggestionsLoading(false);
    }
  }, [tender.id, tender.yaklasik_maliyet, tender.sinir_deger]);

  // Load suggestions on mount
  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  const applySuggestions = useCallback(async () => {
    if (selectedSuggestionKeys.size === 0) {
      notifications.show({
        title: 'Uyarı',
        message: 'En az bir değer seçmelisiniz',
        color: 'yellow',
      });
      return;
    }
    setSaving(true);
    try {
      const selected = detectedValues.filter((v) => selectedSuggestionKeys.has(v.key));
      const directFields = ['yaklasik_maliyet', 'sinir_deger', 'bizim_teklif'];
      const updateData: Record<string, unknown> = {};
      const hesaplamaVerileri: Record<string, unknown> = {};

      for (const val of selected) {
        if (directFields.includes(val.fieldName)) {
          updateData[val.fieldName] = val.value;
          // Hesaplama state'i de güncelle
          if (val.fieldName === 'yaklasik_maliyet') {
            setHesaplamaState((p) => ({ ...p, yaklasikMaliyet: Number(val.value) || 0 }));
          } else if (val.fieldName === 'bizim_teklif') {
            setHesaplamaState((p) => ({ ...p, bizimTeklif: Number(val.value) || 0 }));
          }
        } else {
          hesaplamaVerileri[val.fieldName] = val.value;
        }
      }

      if (Object.keys(hesaplamaVerileri).length > 0) {
        updateData.hesaplama_verileri = hesaplamaVerileri;
      }

      await tendersAPI.updateTracking(Number(tender.id), updateData);
      notifications.show({
        title: 'Veriler Kaydedildi',
        message: `${selected.length} değer ihale kaydına eklendi`,
        color: 'teal',
      });
      onRefresh?.();
    } catch {
      notifications.show({
        title: 'Hata',
        message: 'Değerler uygulanırken bir hata oluştu',
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  }, [selectedSuggestionKeys, detectedValues, tender.id, onRefresh]);

  // ═══ Save All ═══
  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      // 1. Teklif kaydet (maliyet + cetvel)
      const teklifPayload = {
        ...hesaplanmisTeklifData,
        ihale_id: tender.tender_id,
      };

      if (existingTeklifId) {
        await tendersAPI.updateTeklif(existingTeklifId, teklifPayload);
      } else {
        const res = await tendersAPI.createTeklif(teklifPayload);
        if (res.success && res.data?.id) {
          setExistingTeklifId(res.data.id);
        }
      }

      // 2. Hesaplama verileri kaydet (KİK + tracking)
      const filtreliTeklifler = hesaplamaState.teklifListesi.filter((t) => t.firma || t.tutar > 0);
      await tendersAPI.updateTracking(Number(tender.id), {
        yaklasik_maliyet: hesaplamaState.yaklasikMaliyet || null,
        sinir_deger: aktifSinirDeger || null,
        bizim_teklif: hesaplamaState.bizimTeklif || null,
        hesaplama_verileri: {
          ...(hv || {}),
          rakipTeklifler: filtreliTeklifler.map((t) => ({
            firma_adi: t.firma,
            teklif_tutari: t.tutar,
          })),
          teklifListesi: filtreliTeklifler,
          maliyetler: hesaplamaState.maliyetler,
          kikSinirDeger: hesaplamaState.kikSinirDeger,
          ihaleTuru: hesaplamaState.ihaleTuru,
        },
      });

      setIsDirty(false);
      notifications.show({
        title: 'Tüm Veriler Kaydedildi',
        message: `Teklif (${formatPara(hesaplanmisTeklifData.teklif_fiyati)}) ve hesaplama verileri güncellendi`,
        color: 'green',
      });
      onRefresh?.();
    } catch (err) {
      notifications.show({
        title: 'Hata',
        message: (err instanceof Error ? err.message : null) || 'Kayıt sırasında bir hata oluştu',
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  }, [
    hesaplanmisTeklifData,
    hesaplamaState,
    tender,
    existingTeklifId,
    aktifSinirDeger,
    hv,
    onRefresh,
  ]);

  // ═══ Completion Map ═══
  const completionMap = useMemo<CompletionMap>(() => {
    const map: CompletionMap = {
      tespit: 'not_started',
      maliyet: 'not_started',
      hesaplamalar: 'not_started',
      cetvel: 'not_started',
      ozet: 'not_started',
    };

    // Tespit
    if (hesaplamaState.yaklasikMaliyet > 0 && hesaplamaState.bizimTeklif > 0) {
      map.tespit = 'complete';
    } else if (hesaplamaState.yaklasikMaliyet > 0 || detectedValues.length > 0) {
      map.tespit = 'partial';
    }

    // Maliyet
    const md = hesaplanmisTeklifData.maliyet_detay;
    const maliyetToplam = hesaplanmisTeklifData.maliyet_toplam;
    if (maliyetToplam > 0 && md.malzeme.tutar > 0) {
      map.maliyet = 'complete';
    } else if (maliyetToplam > 0) {
      map.maliyet = 'partial';
    }

    // Hesaplamalar
    if (hesaplamaState.yaklasikMaliyet > 0 && aktifSinirDeger > 0) {
      if (riskAnalizi.isAsiriDusuk) {
        map.hesaplamalar = 'warning';
      } else {
        map.hesaplamalar = 'complete';
      }
    } else if (hesaplamaState.yaklasikMaliyet > 0) {
      map.hesaplamalar = 'partial';
    }

    // Cetvel
    const cetvelKalemleri = hesaplanmisTeklifData.birim_fiyat_cetveli;
    if (cetvelKalemleri.length > 0 && cetvelKalemleri.some((k) => k.tutar > 0)) {
      map.cetvel = 'complete';
    } else if (cetvelKalemleri.length > 0) {
      map.cetvel = 'partial';
    }

    // Özet - hepsi tamamlanmışsa
    const otherSections = [map.tespit, map.maliyet, map.hesaplamalar, map.cetvel];
    if (otherSections.every((s) => s === 'complete')) {
      map.ozet = 'complete';
    } else if (otherSections.some((s) => s !== 'not_started')) {
      map.ozet = 'partial';
    }
    if (otherSections.some((s) => s === 'warning')) {
      map.ozet = 'warning';
    }

    return map;
  }, [hesaplamaState, detectedValues, hesaplanmisTeklifData, aktifSinirDeger, riskAnalizi]);

  return {
    activeSection,
    setActiveSection,
    completionMap,
    teklifData,
    hesaplanmisTeklifData,
    setTeklifData,
    updateMaliyetDetay,
    handleKarOraniChange,
    handleCetvelBirimFiyatChange,
    handleCetvelMiktarChange,
    handleCetvelIsKalemiChange,
    handleCetvelBirimChange,
    handleCetvelKalemEkle,
    handleCetvelKalemSil,
    selectedKalem,
    setSelectedKalem,
    existingTeklifId,
    hesaplamaState,
    setHesaplamaState,
    basitSinirDeger,
    aktifSinirDeger,
    riskAnalizi,
    teminatlar,
    isSuresi,
    toplamOgun,
    teknikSartSayisi,
    birimFiyatSayisi,
    isSuresiAy,
    ogunBasiMaliyet,
    ogunBasiTeklif,
    aylikMaliyet,
    gunlukOgun,
    detectedValues,
    setDetectedValues,
    selectedSuggestionKeys,
    setSelectedSuggestionKeys,
    suggestionsLoading,
    fetchSuggestions,
    applySuggestions,
    loading,
    saving,
    isDirty,
    handleSave,
    tender,
  };
}

// ─── Helpers ──────────────────────────────────────────────────

function buildTeklifListesi(
  hv: Record<string, unknown> | undefined
): Array<{ firma: string; tutar: number }> {
  if (!hv) return defaultTeklifListesi();

  // Yeni format
  const rakip = hv.rakipTeklifler as
    | Array<{ firma_adi?: string; firma?: string; teklif_tutari?: number; tutar?: number }>
    | undefined;
  if (rakip?.length) {
    const list = rakip.map((r) => ({
      firma: r.firma_adi || r.firma || '',
      tutar: r.teklif_tutari || r.tutar || 0,
    }));
    return list.length >= 3
      ? list
      : [
          ...list,
          ...Array(3 - list.length)
            .fill(null)
            .map((_, i) => ({ firma: `Firma ${list.length + i + 1}`, tutar: 0 })),
        ];
  }

  // Eski format
  const eski = hv.teklifListesi as Array<{ firma: string; tutar: number }> | undefined;
  if (eski?.length) {
    return eski.length >= 3
      ? eski
      : [
          ...eski,
          ...Array(3 - eski.length)
            .fill(null)
            .map((_, i) => ({ firma: `Firma ${eski.length + i + 1}`, tutar: 0 })),
        ];
  }

  return defaultTeklifListesi();
}

function defaultTeklifListesi() {
  return [
    { firma: 'Firma 1', tutar: 0 },
    { firma: 'Firma 2', tutar: 0 },
    { firma: 'Firma 3', tutar: 0 },
  ];
}
