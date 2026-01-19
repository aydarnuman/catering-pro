import { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '@/lib/config';
import { AnalysisData, SavedTender, FirmaBilgisi } from '../types';

export interface UseIhaleDataReturn {
  // Analysis
  analysisData: AnalysisData;
  analysisLoading: boolean;
  analysisStats: { toplam_dokuman: number; analiz_edilen: number } | null;
  loadAnalysisData: () => Promise<void>;
  
  // Firmalar
  firmalar: FirmaBilgisi[];
  selectedFirmaId: number | null;
  setSelectedFirmaId: (id: number | null) => void;
  selectedFirma: FirmaBilgisi | undefined;
  loadFirmalar: () => Promise<void>;
}

export function useIhaleData(tender: SavedTender | null, opened: boolean): UseIhaleDataReturn {
  // Analysis state
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [liveAnalysisData, setLiveAnalysisData] = useState<AnalysisData | null>(null);
  const [analysisStats, setAnalysisStats] = useState<{
    toplam_dokuman: number;
    analiz_edilen: number;
  } | null>(null);

  // Firma state
  const [firmalar, setFirmalar] = useState<FirmaBilgisi[]>([]);
  const [selectedFirmaId, setSelectedFirmaId] = useState<number | null>(null);

  // Derived firma
  const selectedFirma = firmalar.find(f => f.id === selectedFirmaId) 
    || firmalar.find(f => f.varsayilan) 
    || firmalar[0];

  // Load analysis data
  const loadAnalysisData = useCallback(async () => {
    if (!tender) return;
    try {
      setAnalysisLoading(true);
      const response = await fetch(
        `${API_BASE_URL}/api/tender-tracking/${tender.tender_id}/analysis`
      );
      const result = await response.json();
      if (result.success && result.data) {
        setLiveAnalysisData(result.data.analysis);
        setAnalysisStats(result.data.stats);
      }
    } catch (error) {
      console.error('Analiz verisi çekme hatası:', error);
    } finally {
      setAnalysisLoading(false);
    }
  }, [tender]);

  // Load firmalar
  const loadFirmalar = useCallback(async () => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      const response = await fetch(`${API_BASE_URL}/api/firmalar`, {
        headers: { 
          Authorization: token ? `Bearer ${token}` : '',
        },
      });
      const data = await response.json();
      if (data.success && data.data) {
        setFirmalar(data.data);
        // Varsayılan firmayı seç
        const defaultFirma = data.data.find((f: FirmaBilgisi) => f.varsayilan);
        if (defaultFirma) {
          setSelectedFirmaId(defaultFirma.id);
        } else if (data.data.length > 0) {
          setSelectedFirmaId(data.data[0].id);
        }
      }
    } catch (error) {
      console.error('Firma yükleme hatası:', error);
    }
  }, []);

  // Get combined analysis data
  const getAnalysisData = useCallback((): AnalysisData => {
    if (liveAnalysisData) return liveAnalysisData;
    if (tender?.analiz_data) return tender.analiz_data;
    if (tender?.analysis_summary) return tender.analysis_summary;
    return {
      ihale_basligi: tender?.ihale_basligi || '',
      kurum: tender?.kurum || '',
      tarih: tender?.tarih || '',
      bedel: tender?.bedel || '',
      teknik_sartlar: [],
      birim_fiyatlar: [],
      notlar: [],
    };
  }, [liveAnalysisData, tender]);

  // Load on open
  useEffect(() => {
    if (opened && tender) {
      loadAnalysisData();
      loadFirmalar();
    }
  }, [opened, tender?.tender_id, loadAnalysisData, loadFirmalar]);

  // Reset on close
  useEffect(() => {
    if (!opened) {
      setLiveAnalysisData(null);
      setAnalysisStats(null);
    }
  }, [opened]);

  return {
    analysisData: getAnalysisData(),
    analysisLoading,
    analysisStats,
    loadAnalysisData,
    firmalar,
    selectedFirmaId,
    setSelectedFirmaId,
    selectedFirma,
    loadFirmalar,
  };
}
