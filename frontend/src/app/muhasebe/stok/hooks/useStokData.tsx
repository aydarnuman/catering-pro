/**
 * useStokData - Stok Modülü State Yönetimi Hook'u
 * Tüm stok verilerini, formları ve işlemleri merkezi olarak yönetir
 */

'use client';

import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconAlertCircle, IconAlertTriangle, IconCheck, IconX } from '@tabler/icons-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRealtimeRefetch } from '@/context/RealtimeContext';
import { type AkilliKalem, type AkilliKalemlerResponse, stokAPI } from '@/lib/api/services/stok';
import { urunlerAPI } from '@/lib/api/services/urunler';

import type {
  Birim,
  Depo,
  DepoForm,
  Fatura,
  Kategori,
  Lokasyon,
  StokCikisForm,
  StokGirisForm,
  StokHareket,
  StokItem,
  TransferForm,
  UrunForm,
} from '../types';

import {
  DEFAULT_CIKIS_FORM,
  DEFAULT_DEPO_FORM,
  DEFAULT_GIRIS_FORM,
  DEFAULT_TRANSFER_FORM,
  DEFAULT_URUN_FORM,
} from '../types';

// Hook return tipi
export interface UseStokDataReturn {
  // State'ler
  states: {
    stoklar: StokItem[];
    tumUrunler: StokItem[];
    tumStokSayisi: number;
    depolar: Depo[];
    kategoriler: Kategori[];
    birimler: Birim[];
    lokasyonlar: Lokasyon[];
    hareketler: StokHareket[];
    faturalar: Fatura[];
    selectedDepo: number | null;
    selectedLokasyon: number | null;
    selectedStoklar: number[];
    selectedFatura: Fatura | null;
    editingDepo: Depo | null;
    // Form state'leri
    transferForm: TransferForm;
    depoForm: DepoForm;
    urunForm: UrunForm;
    girisForm: StokGirisForm;
    cikisForm: StokCikisForm;
    // Fatura işlem state'leri
    faturaKalemler: AkilliKalem[];
    faturaGirisDepo: number | null;
    kalemEslestirme: { [key: number]: number | null };
    faturaOzet: AkilliKalemlerResponse['ozet'] | null;
    faturaInfo: AkilliKalemlerResponse['fatura'] | null;
    // Sayım state'leri
    sayimDepoId: number | null;
    sayimVerileri: { [key: number]: number };
  };
  // Loading ve error
  loading: boolean;
  error: string | null;
  faturaLoading: boolean;
  hareketlerLoading: boolean;
  topluIslemLoading: boolean;
  // Modal kontrolleri
  modals: {
    urunModal: { opened: boolean; open: () => void; close: () => void };
    transferModal: { opened: boolean; open: () => void; close: () => void };
    depoModalOpened: boolean;
    stokGirisModalOpened: boolean;
    stokCikisModalOpened: boolean;
    sayimModalOpened: boolean;
    hareketlerModalOpened: boolean;
    faturaModalOpened: boolean;
    detayModalOpened: boolean;
    urunKartlariModalOpened: boolean;
  };
  // State setters
  setters: {
    setSelectedDepo: (id: number | null) => void;
    setSelectedLokasyon: (id: number | null) => void;
    setSelectedStoklar: (ids: number[]) => void;
    setSelectedFatura: (fatura: Fatura | null) => void;
    setEditingDepo: (depo: Depo | null) => void;
    setTransferForm: (form: TransferForm | ((prev: TransferForm) => TransferForm)) => void;
    setDepoForm: (form: DepoForm | ((prev: DepoForm) => DepoForm)) => void;
    setUrunForm: (form: UrunForm | ((prev: UrunForm) => UrunForm)) => void;
    setGirisForm: (form: StokGirisForm | ((prev: StokGirisForm) => StokGirisForm)) => void;
    setCikisForm: (form: StokCikisForm | ((prev: StokCikisForm) => StokCikisForm)) => void;
    setFaturaGirisDepo: (id: number | null) => void;
    setKalemEslestirme: (
      eslestirme:
        | { [key: number]: number | null }
        | ((prev: { [key: number]: number | null }) => { [key: number]: number | null })
    ) => void;
    setSayimDepoId: (id: number | null) => void;
    setSayimVerileri: (
      veriler:
        | { [key: number]: number }
        | ((prev: { [key: number]: number }) => { [key: number]: number })
    ) => void;
    // Modal setters
    setDepoModalOpened: (opened: boolean) => void;
    setStokGirisModalOpened: (opened: boolean) => void;
    setStokCikisModalOpened: (opened: boolean) => void;
    setSayimModalOpened: (opened: boolean) => void;
    setHareketlerModalOpened: (opened: boolean) => void;
    setFaturaModalOpened: (opened: boolean) => void;
    setDetayModalOpened: (opened: boolean) => void;
    setDetayUrunId: (id: number | null) => void;
    setUrunKartlariModalOpened: (opened: boolean) => void;
  };
  // Veri yükleme fonksiyonları
  loaders: {
    loadData: () => Promise<void>;
    loadDepoStoklar: (depoId: number) => Promise<void>;
    loadLokasyonStoklar: (lokasyonId: number) => Promise<void>;
    loadFaturalar: () => Promise<void>;
    loadFaturaKalemler: (ettn: string) => Promise<void>;
    loadHareketler: () => Promise<void>;
    loadSayimVerileri: (depoId: number) => Promise<void>;
  };
  // İşlem fonksiyonları
  actions: {
    // Depo işlemleri
    handleSaveDepo: () => Promise<void>;
    handleDeleteDepo: (depoId: number) => Promise<void>;
    // Stok işlemleri
    handleDeleteStok: (urunId: number) => Promise<void>;
    handleBulkDelete: () => Promise<void>;
    handleSelectAll: () => void;
    handleSelectStok: (stokId: number) => void;
    // Hareket işlemleri
    handleTransfer: () => Promise<void>;
    handleStokGiris: () => Promise<void>;
    handleStokCikis: () => Promise<void>;
    handleSayimKaydet: () => Promise<void>;
    // Fatura işlemleri
    handleTopluFaturaIsle: () => Promise<void>;
    handleFiyatGuncelle: (urunKartId: number, birimFiyat: number, urunAdi: string) => Promise<void>;
    handleYeniUrunOlustur: (kalem: any, anaUrunId?: number) => Promise<void>;
    handleFaturaStokGirisi: () => Promise<void>;
    // Ürün işlemleri
    handleSaveUrun: () => Promise<void>;
    loadUrunDetay: (urunId: number) => void;
    // Form reset
    resetDepoForm: () => void;
    resetTransferForm: () => void;
    resetGirisForm: () => void;
    resetCikisForm: () => void;
    resetUrunForm: () => void;
    resetFaturaState: () => void;
  };
  // Hesaplanmış değerler
  computed: {
    filteredStoklar: StokItem[];
    toplamKalem: number;
    kritikStok: number;
    toplamDeger: number;
    kategoriSayisi: number;
  };
  // Filtre state'leri
  filters: {
    activeTab: string | null;
    setActiveTab: (tab: string | null) => void;
    searchTerm: string;
    setSearchTerm: (term: string) => void;
  };
  // Ürün detay
  detayUrunId: number | null;
}

export function useStokData(): UseStokDataReturn {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // === TEMEL STATE'LER ===
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Veri state'leri
  const [stoklar, setStoklar] = useState<StokItem[]>([]);
  const [tumUrunler, setTumUrunler] = useState<StokItem[]>([]);
  const [tumStokSayisi, setTumStokSayisi] = useState<number>(0);
  const [depolar, setDepolar] = useState<Depo[]>([]);
  const [kategoriler, setKategoriler] = useState<Kategori[]>([]);
  const [birimler, setBirimler] = useState<Birim[]>([]);
  const [lokasyonlar, setLokasyonlar] = useState<Lokasyon[]>([]);
  const [hareketler, setHareketler] = useState<StokHareket[]>([]);
  const [faturalar, setFaturalar] = useState<Fatura[]>([]);

  // Seçim state'leri
  const [selectedDepo, setSelectedDepo] = useState<number | null>(null);
  const [selectedLokasyon, setSelectedLokasyon] = useState<number | null>(null);
  const [selectedStoklar, setSelectedStoklar] = useState<number[]>([]);
  const [selectedFatura, setSelectedFatura] = useState<Fatura | null>(null);
  const [editingDepo, setEditingDepo] = useState<Depo | null>(null);

  // Form state'leri
  const [transferForm, setTransferForm] = useState<TransferForm>(DEFAULT_TRANSFER_FORM);
  const [depoForm, setDepoForm] = useState<DepoForm>(DEFAULT_DEPO_FORM);
  const [urunForm, setUrunForm] = useState<UrunForm>(DEFAULT_URUN_FORM);
  const [girisForm, setGirisForm] = useState<StokGirisForm>(DEFAULT_GIRIS_FORM);
  const [cikisForm, setCikisForm] = useState<StokCikisForm>(DEFAULT_CIKIS_FORM);

  // Fatura işlem state'leri
  const [faturaKalemler, setFaturaKalemler] = useState<AkilliKalem[]>([]);
  const [faturaGirisDepo, setFaturaGirisDepo] = useState<number | null>(null);
  const [kalemEslestirme, setKalemEslestirme] = useState<{ [key: number]: number | null }>({});
  const [faturaOzet, setFaturaOzet] = useState<AkilliKalemlerResponse['ozet'] | null>(null);
  const [faturaInfo, setFaturaInfo] = useState<AkilliKalemlerResponse['fatura'] | null>(null);

  // Sayım state'leri
  const [sayimDepoId, setSayimDepoId] = useState<number | null>(null);
  const [sayimVerileri, setSayimVerileri] = useState<{ [key: number]: number }>({});

  // Loading state'leri
  const [faturaLoading, setFaturaLoading] = useState(false);
  const [hareketlerLoading, setHareketlerLoading] = useState(false);
  const [topluIslemLoading, setTopluIslemLoading] = useState(false);

  // Modal state'leri
  const [urunModalOpened, { open: openUrunModal, close: closeUrunModal }] = useDisclosure(false);
  const [transferOpened, { open: openTransfer, close: closeTransfer }] = useDisclosure(false);
  const [depoModalOpened, setDepoModalOpened] = useState(false);
  const [stokGirisModalOpened, setStokGirisModalOpened] = useState(false);
  const [stokCikisModalOpened, setStokCikisModalOpened] = useState(false);
  const [sayimModalOpened, setSayimModalOpened] = useState(false);
  const [hareketlerModalOpened, setHareketlerModalOpened] = useState(false);
  const [faturaModalOpened, setFaturaModalOpened] = useState(false);
  const [detayModalOpened, setDetayModalOpened] = useState(false);
  const [detayUrunId, setDetayUrunId] = useState<number | null>(null);
  const [urunKartlariModalOpened, setUrunKartlariModalOpened] = useState(false);

  // Filtre state'leri
  const [activeTab, setActiveTab] = useState<string | null>('tumu');
  const [searchTerm, setSearchTerm] = useState('');

  // === VERİ YÜKLEME FONKSİYONLARI ===

  const loadData = useCallback(async () => {
    console.log('loadData başlatıldı');
    setLoading(true);
    setError(null);

    let timeoutId: NodeJS.Timeout | null = null;

    try {
      timeoutId = setTimeout(() => {
        console.warn('loadData timeout - 30 saniye geçti');
        setLoading(false);
        setError('Veri yükleme çok uzun sürdü. Lütfen sayfayı yenileyin.');
      }, 30000);

      const results = await Promise.allSettled([
        urunlerAPI.getUrunler({ limit: 100 }),
        stokAPI.getDepolar(),
        urunlerAPI.getKategoriler(),
        stokAPI.getBirimler(),
      ]);

      const urunData =
        results[0].status === 'fulfilled'
          ? results[0].value
          : { success: false, error: results[0].reason?.message };
      const depoData =
        results[1].status === 'fulfilled'
          ? results[1].value
          : { success: false, error: results[1].reason?.message };
      const katData =
        results[2].status === 'fulfilled'
          ? results[2].value
          : { success: false, error: results[2].reason?.message };
      const birimData =
        results[3].status === 'fulfilled'
          ? results[3].value
          : { success: false, error: results[3].reason?.message };

      const errors: string[] = [];
      if (!urunData.success) errors.push(`Ürünler: ${urunData.error || 'Alınamadı'}`);
      if (!depoData.success) errors.push(`Depolar: ${depoData.error || 'Alınamadı'}`);

      if (errors.length > 0 && (!urunData.success || !depoData.success)) {
        throw new Error(`Kritik veriler alınamadı: ${errors.join(', ')}`);
      }

      const urunList = ((urunData.success && 'data' in urunData ? urunData.data : []) || []).map(
        (u: any) => ({
          id: u.id,
          kod: u.kod,
          ad: u.ad,
          kategori: u.kategori || 'Kategorisiz',
          kategori_id: u.kategori_id,
          birim: u.birim_kisa || u.birim || 'Ad',
          ana_birim_id: u.ana_birim_id,
          toplam_stok: parseFloat(u.toplam_stok) || 0,
          min_stok: parseFloat(u.min_stok) || 0,
          max_stok: parseFloat(u.max_stok) || 0,
          kritik_stok: parseFloat(u.kritik_stok) || 0,
          son_alis_fiyat: parseFloat(u.son_alis_fiyati) || 0,
          durum: u.durum || 'normal',
        })
      );

      setStoklar(urunList);
      setTumUrunler(urunList);
      setTumStokSayisi(urunList.length);
      setDepolar(
        (depoData.success && 'data' in depoData ? depoData.data || [] : []) as unknown as Depo[]
      );

      const katList = (
        katData.success && 'data' in katData && katData.data ? katData.data : []
      ).map((k: any) => ({
        id: k.id,
        kod: k.kod || `KAT${k.id}`,
        ad: k.ad,
      }));
      setKategoriler(katList);
      setBirimler(
        (birimData.success && 'data' in birimData && birimData.data ? birimData.data : []) || []
      );
    } catch (err: any) {
      console.error('Veri yükleme hatası:', err);

      let errorMessage = 'Veriler yüklenirken hata oluştu';
      if (err?.response?.status === 401) {
        errorMessage = 'Oturum süresi dolmuş. Lütfen tekrar giriş yapın.';
      } else if (err?.response?.status === 403) {
        errorMessage = 'Bu sayfaya erişim yetkiniz yok.';
      } else if (err?.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
      setStoklar([]);
      setTumUrunler([]);
      setTumStokSayisi(0);
      setDepolar([]);
      setKategoriler([]);
      setBirimler([]);

      notifications.show({
        title: 'Hata',
        message: errorMessage,
        color: 'red',
        icon: <IconAlertCircle />,
      });
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      setLoading(false);
    }
  }, []);

  const loadDepoStoklar = useCallback(async (depoId: number) => {
    setLoading(true);
    try {
      setSelectedDepo(depoId);
      setSelectedLokasyon(null);

      const lokResult = await stokAPI.getDepoLokasyonlar(depoId);
      if (lokResult.success) {
        setLokasyonlar(lokResult.data || []);
      } else {
        setLokasyonlar([]);
      }

      const result = await stokAPI.getDepoStoklar(depoId);
      if (result.success) {
        setStoklar((result.data || []) as unknown as StokItem[]);
      } else {
        setStoklar([]);
      }
    } catch (err) {
      console.error('Depo stok yükleme hatası:', err);
      setStoklar([]);
      setLokasyonlar([]);
      notifications.show({
        title: 'Hata',
        message: 'Depo stokları yüklenemedi',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLokasyonStoklar = useCallback(async (lokasyonId: number) => {
    setLoading(true);
    try {
      setSelectedLokasyon(lokasyonId);
      const result = await stokAPI.getLokasyonStoklar(lokasyonId);
      if (result.success) {
        setStoklar((result.data || []) as unknown as StokItem[]);
      } else {
        setStoklar([]);
      }
    } catch (err) {
      console.error('Lokasyon stok yükleme hatası:', err);
      setStoklar([]);
      notifications.show({
        title: 'Hata',
        message: 'Lokasyon stokları yüklenemedi',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const loadFaturalar = useCallback(async () => {
    setFaturaLoading(true);
    try {
      const result = await stokAPI.getFaturalar({ limit: 50 });
      if (result.success && result.data) {
        setFaturalar(result.data as unknown as Fatura[]);
      }
    } catch (error: any) {
      console.error('Fatura yükleme hatası:', error);
    } finally {
      setFaturaLoading(false);
    }
  }, []);

  const loadFaturaKalemler = useCallback(async (ettn: string) => {
    setFaturaLoading(true);
    try {
      const result = (await stokAPI.getAkilliKalemler(ettn)) as any;

      if (result.success && result.kalemler) {
        const { kalemler, ozet, fatura } = result;

        setFaturaKalemler(kalemler);
        setFaturaOzet(ozet);
        setFaturaInfo(fatura);

        const eslestirmeler: { [key: number]: number | null } = {};
        kalemler.forEach((k: AkilliKalem) => {
          if (k.eslesme?.otomatik_onay && !k.anomali?.var) {
            eslestirmeler[k.sira] = k.eslesme.stok_kart_id;
          } else {
            eslestirmeler[k.sira] = null;
          }
        });
        setKalemEslestirme(eslestirmeler);

        const otomatikSayisi = Object.values(eslestirmeler).filter((v) => v !== null).length;
        const manuelSayisi = kalemler.length - otomatikSayisi;
        const anomaliSayisi = kalemler.filter((k: AkilliKalem) => k.anomali?.var).length;

        if (ozet.tum_otomatik) {
          notifications.show({
            title: 'Tüm Kalemler Eşleştirildi',
            message: `${kalemler.length} kalem otomatik eşleştirildi`,
            color: 'green',
          });
        } else {
          notifications.show({
            title: 'Fatura Yüklendi',
            message: `${otomatikSayisi} otomatik eşleşti, ${manuelSayisi} manuel seçim bekliyor${anomaliSayisi > 0 ? `, ${anomaliSayisi} fiyat anomalisi` : ''}`,
            color: manuelSayisi > 0 ? 'yellow' : 'green',
          });
        }
      }
    } catch (error: any) {
      console.error('Fatura kalem hatası:', error);
      try {
        const fallbackResult = (await stokAPI.getFaturaKalemler(ettn)) as any;
        if (fallbackResult.success) {
          const kalemler = (fallbackResult.kalemler || fallbackResult.data || []).map(
            (k: any, index: number) => ({
              ...k,
              sira: k.sira || index + 1,
              eslesme: null,
              alternatif_eslesmeler: [],
              anomali: null,
            })
          );
          setFaturaKalemler(kalemler);
          setFaturaOzet(null);
          setFaturaInfo(null);

          const eslestirmeler: { [key: number]: number | null } = {};
          kalemler.forEach((k: any) => {
            eslestirmeler[k.sira] = null;
          });
          setKalemEslestirme(eslestirmeler);

          notifications.show({
            title: 'Fatura Kalemleri',
            message: `${kalemler.length} kalem yüklendi - manuel eşleştirme gerekli`,
            color: 'blue',
          });
        }
      } catch (_fallbackError) {
        notifications.show({
          title: 'Hata',
          message: 'Fatura kalemleri yüklenemedi',
          color: 'red',
        });
      }
    } finally {
      setFaturaLoading(false);
    }
  }, []);

  const loadHareketler = useCallback(async () => {
    setHareketlerLoading(true);
    try {
      const result = await stokAPI.getHareketler({ limit: 100 });
      if (result.success && result.data) {
        setHareketler(result.data as unknown as StokHareket[]);
      }
    } catch (error: any) {
      console.error('Hareketler yükleme hatası:', error);
    } finally {
      setHareketlerLoading(false);
    }
  }, []);

  const loadSayimVerileri = useCallback(async (depoId: number) => {
    setSayimDepoId(depoId);
    try {
      const result = await stokAPI.getDepoStoklar(depoId);
      if (result.success) {
        const initialSayim: { [key: number]: number } = {};
        result.data.forEach((item: any) => {
          initialSayim[item.id] = item.toplam_stok || 0;
        });
        setSayimVerileri(initialSayim);
      }
    } catch (error: any) {
      console.error('Sayım verileri yükleme hatası:', error);
    }
  }, []);

  // === İŞLEM FONKSİYONLARI ===

  // Depo işlemleri
  const handleSaveDepo = useCallback(async () => {
    try {
      setLoading(true);
      const result = editingDepo
        ? await stokAPI.updateDepo(editingDepo.id, depoForm)
        : await stokAPI.createDepo(depoForm);

      if (!result.success) {
        throw new Error(result.error || 'İşlem başarısız');
      }

      notifications.show({
        title: 'Başarılı',
        message: editingDepo ? 'Depo güncellendi' : 'Depo eklendi',
        color: 'green',
      });

      setDepoModalOpened(false);
      setEditingDepo(null);
      setDepoForm(DEFAULT_DEPO_FORM);
      await loadData();
    } catch (error: any) {
      notifications.show({
        title: 'Hata',
        message: error?.message || 'Bir hata oluştu',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  }, [editingDepo, depoForm, loadData]);

  const handleDeleteDepo = useCallback(
    async (depoId: number) => {
      if (!confirm('Bu depoyu silmek istediğinizden emin misiniz?')) return;

      try {
        setLoading(true);
        const result = await stokAPI.deleteDepo(depoId);

        if (!result.success) {
          throw new Error(result.error || 'Silme işlemi başarısız');
        }

        notifications.show({
          title: 'Başarılı',
          message: 'Depo silindi',
          color: 'green',
        });

        await loadData();
      } catch (error: any) {
        notifications.show({
          title: 'Hata',
          message: error.message,
          color: 'red',
        });
      } finally {
        setLoading(false);
      }
    },
    [loadData]
  );

  // Stok işlemleri
  const handleDeleteStok = useCallback(
    async (urunId: number) => {
      try {
        setLoading(true);
        const result = await urunlerAPI.deleteUrun(urunId);

        if (!result.success) {
          throw new Error(result.error || 'Silme işlemi başarısız');
        }

        notifications.show({
          title: 'Başarılı',
          message: 'Ürün silindi',
          color: 'green',
          icon: <IconCheck />,
        });

        await loadData();
      } catch (error: any) {
        notifications.show({
          title: 'Hata',
          message: error.message,
          color: 'red',
          icon: <IconX />,
        });
      } finally {
        setLoading(false);
      }
    },
    [loadData]
  );

  const handleBulkDelete = useCallback(async () => {
    if (selectedStoklar.length === 0) return;

    if (!confirm(`${selectedStoklar.length} ürünü silmek istediğinizden emin misiniz?`)) {
      return;
    }

    try {
      setLoading(true);
      let basarili = 0;
      let hatali = 0;

      for (const urunId of selectedStoklar) {
        try {
          const result = await urunlerAPI.deleteUrun(urunId);
          if (result.success) basarili++;
          else hatali++;
        } catch {
          hatali++;
        }
      }

      notifications.show({
        title: 'Toplu Silme Tamamlandı',
        message: `${basarili} ürün silindi${hatali > 0 ? `, ${hatali} hata` : ''}`,
        color: hatali > 0 ? 'yellow' : 'green',
        icon: <IconCheck />,
      });

      setSelectedStoklar([]);
      await loadData();
    } catch (error: any) {
      notifications.show({
        title: 'Hata',
        message: error.message,
        color: 'red',
        icon: <IconX />,
      });
    } finally {
      setLoading(false);
    }
  }, [selectedStoklar, loadData]);

  // Filtreleme
  const filteredStoklar = stoklar.filter((item) => {
    const matchesTab =
      activeTab === 'tumu' ||
      (activeTab === 'kritik' && item.durum === 'kritik') ||
      (activeTab === 'dusuk' && item.durum === 'dusuk');
    const matchesSearch =
      item.ad?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.kod?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const handleSelectAll = useCallback(() => {
    if (selectedStoklar.length === filteredStoklar.length) {
      setSelectedStoklar([]);
    } else {
      setSelectedStoklar(filteredStoklar.map((s) => s.id));
    }
  }, [selectedStoklar, filteredStoklar]);

  const handleSelectStok = useCallback(
    (stokId: number) => {
      if (selectedStoklar.includes(stokId)) {
        setSelectedStoklar(selectedStoklar.filter((id) => id !== stokId));
      } else {
        setSelectedStoklar([...selectedStoklar, stokId]);
      }
    },
    [selectedStoklar]
  );

  // Hareket işlemleri
  const handleTransfer = useCallback(async () => {
    if (
      !transferForm.stok_kart_id ||
      !transferForm.kaynak_depo_id ||
      !transferForm.hedef_depo_id ||
      transferForm.miktar <= 0
    ) {
      notifications.show({
        title: 'Hata',
        message: 'Lütfen tüm alanları doldurun',
        color: 'red',
      });
      return;
    }

    setLoading(true);
    try {
      const result = await stokAPI.transferHareket({
        kaynak_depo_id: transferForm.kaynak_depo_id,
        hedef_depo_id: transferForm.hedef_depo_id,
        urun_id: (transferForm.urun_id || transferForm.stok_kart_id) as number,
        miktar: transferForm.miktar,
        birim: transferForm.birim,
        belge_no: transferForm.belge_no || `TRF-${Date.now()}`,
        belge_tarihi: new Date().toISOString().split('T')[0],
        aciklama: transferForm.aciklama,
      });

      if (result.success) {
        notifications.show({
          title: 'Başarılı',
          message: result.message,
          color: 'green',
          icon: <IconCheck />,
        });
        closeTransfer();
        loadData();
      } else {
        throw new Error(result.error);
      }
    } catch (err: any) {
      notifications.show({
        title: 'Hata',
        message: err.message || 'Transfer başarısız',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  }, [transferForm, closeTransfer, loadData]);

  const handleStokGiris = useCallback(async () => {
    if (!girisForm.stok_kart_id || !girisForm.depo_id || girisForm.miktar <= 0) {
      notifications.show({
        title: 'Hata',
        message: 'Lütfen ürün, depo ve miktar seçin',
        color: 'red',
      });
      return;
    }

    setLoading(true);
    try {
      const result = await stokAPI.girisHareket({
        depo_id: girisForm.depo_id,
        urun_id: girisForm.stok_kart_id,
        miktar: girisForm.miktar,
        birim: girisForm.birim || 'adet',
        belge_no: `GRS-${Date.now()}`,
        belge_tarihi: new Date().toISOString().split('T')[0],
        aciklama: `${girisForm.giris_tipi}: ${girisForm.aciklama}`,
      });

      if (result.success) {
        notifications.show({
          title: 'Başarılı',
          message: 'Stok girişi yapıldı',
          color: 'green',
          icon: <IconCheck />,
        });
        setStokGirisModalOpened(false);
        setGirisForm(DEFAULT_GIRIS_FORM);
        loadData();
      } else {
        throw new Error(result.error);
      }
    } catch (err: any) {
      notifications.show({
        title: 'Hata',
        message: err.message || 'Stok girişi başarısız',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  }, [girisForm, loadData]);

  const handleStokCikis = useCallback(async () => {
    if (!cikisForm.stok_kart_id || !cikisForm.depo_id || cikisForm.miktar <= 0) {
      notifications.show({
        title: 'Hata',
        message: 'Lütfen ürün, depo ve miktar seçin',
        color: 'red',
      });
      return;
    }

    setLoading(true);
    try {
      const result = await stokAPI.cikisHareket({
        depo_id: cikisForm.depo_id,
        urun_id: cikisForm.stok_kart_id,
        miktar: cikisForm.miktar,
        birim: cikisForm.birim || 'adet',
        belge_no: `CKS-${Date.now()}`,
        belge_tarihi: new Date().toISOString().split('T')[0],
        aciklama: `${cikisForm.cikis_tipi}: ${cikisForm.aciklama}`,
      });

      if (result.success) {
        notifications.show({
          title: 'Başarılı',
          message: 'Stok çıkışı yapıldı',
          color: 'green',
          icon: <IconCheck />,
        });
        setStokCikisModalOpened(false);
        setCikisForm(DEFAULT_CIKIS_FORM);
        loadData();
      } else {
        throw new Error(result.error);
      }
    } catch (err: any) {
      notifications.show({
        title: 'Hata',
        message: err.message || 'Stok çıkışı başarısız',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  }, [cikisForm, loadData]);

  const handleSayimKaydet = useCallback(async () => {
    if (!sayimDepoId) {
      notifications.show({ title: 'Hata', message: 'Lütfen depo seçin', color: 'red' });
      return;
    }

    setLoading(true);
    try {
      let islemSayisi = 0;

      for (const item of filteredStoklar) {
        const sistemStok = item.toplam_stok || 0;
        const sayimStok = sayimVerileri[item.id] || 0;
        const fark = sayimStok - sistemStok;

        if (fark !== 0) {
          const hareketData = {
            depo_id: sayimDepoId,
            urun_id: item.id,
            miktar: Math.abs(fark),
            birim: item.birim || 'adet',
            belge_no: `SAYIM-${Date.now()}`,
            belge_tarihi: new Date().toISOString().split('T')[0],
            aciklama: `Stok sayımı: ${fark > 0 ? 'Fazla' : 'Eksik'} (${Math.abs(fark)} ${item.birim})`,
          };

          if (fark > 0) {
            await stokAPI.girisHareket(hareketData);
          } else {
            await stokAPI.cikisHareket(hareketData);
          }
          islemSayisi++;
        }
      }

      notifications.show({
        title: 'Başarılı',
        message: `Sayım tamamlandı. ${islemSayisi} ürün güncellendi.`,
        color: 'green',
        icon: <IconCheck />,
      });
      setSayimModalOpened(false);
      setSayimVerileri({});
      loadData();
    } catch (err: any) {
      notifications.show({
        title: 'Hata',
        message: err.message || 'Sayım kaydedilemedi',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  }, [sayimDepoId, filteredStoklar, sayimVerileri, loadData]);

  // Fatura işlemleri
  const handleTopluFaturaIsle = useCallback(async () => {
    if (!faturaGirisDepo) {
      notifications.show({
        title: 'Uyarı',
        message: 'Lütfen depo seçin',
        color: 'yellow',
      });
      return;
    }

    const islenmemisFaturalar = faturalar.filter((f) => !f.stok_islendi);
    if (islenmemisFaturalar.length === 0) {
      notifications.show({
        title: 'Bilgi',
        message: 'İşlenecek fatura bulunamadı',
        color: 'blue',
      });
      return;
    }

    setTopluIslemLoading(true);
    try {
      const result = (await stokAPI.topluFaturaIsle({
        faturalar: islenmemisFaturalar.map((f) => f.ettn),
        depo_id: faturaGirisDepo,
      })) as any;
      if (result.success) {
        notifications.show({
          title: 'Toplu İşlem Tamamlandı',
          message: `${result.ozet?.basarili || 0} fatura işlendi, ${result.ozet?.otomatik_eslesen || 0} kalem eşleştirildi`,
          color: 'green',
        });
        loadFaturalar();
        loadData();
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      notifications.show({
        title: 'Hata',
        message: error.message || 'Toplu işlem başarısız',
        color: 'red',
      });
    } finally {
      setTopluIslemLoading(false);
    }
  }, [faturaGirisDepo, faturalar, loadFaturalar, loadData]);

  const handleFiyatGuncelle = useCallback(
    async (urunKartId: number, birimFiyat: number, urunAdi: string) => {
      try {
        const result = await urunlerAPI.updateFiyat(urunKartId, {
          birim_fiyat: birimFiyat,
          kaynak: 'fatura_manuel',
          aciklama: `Faturadan manuel güncelleme - ${selectedFatura?.sender_name || ''}`,
        });

        if (result.success) {
          notifications.show({
            title: 'Fiyat Güncellendi',
            message: `${urunAdi}: ${(result as any).eski_fiyat || 0}₺ → ${birimFiyat}₺`,
            color: 'green',
          });
          loadData();
        } else {
          throw new Error(result.error);
        }
      } catch (error: any) {
        notifications.show({
          title: 'Hata',
          message: error.message || 'Fiyat güncellenemedi',
          color: 'red',
        });
      }
    },
    [selectedFatura, loadData]
  );

  const handleYeniUrunOlustur = useCallback(
    async (kalem: any, anaUrunId?: number) => {
      try {
        const result = await urunlerAPI.createVaryant({
          ana_urun_id: anaUrunId || undefined,
          fatura_urun_adi: kalem.urun_adi,
          birim_fiyat: kalem.birim_fiyat,
        });

        if (result.success) {
          notifications.show({
            title: anaUrunId ? 'Varyant Oluşturuldu' : 'Yeni Ürün Kartı',
            message: `${result.data.kod} - ${result.data.ad}`,
            color: 'green',
          });

          setKalemEslestirme((prev) => ({
            ...prev,
            [kalem.sira]: result.data.id,
          }));

          loadData();
        } else {
          throw new Error(result.error);
        }
      } catch (error: any) {
        notifications.show({
          title: 'Hata',
          message: error.message || 'Ürün oluşturulamadı',
          color: 'red',
        });
      }
    },
    [loadData]
  );

  const handleFaturaStokGirisi = useCallback(async () => {
    if (!selectedFatura || !faturaGirisDepo) {
      notifications.show({
        title: 'Uyarı',
        message: 'Lütfen depo seçin',
        color: 'yellow',
      });
      return;
    }

    const eslesmisKalemler = faturaKalemler
      .filter((k) => kalemEslestirme[k.sira])
      .map((k) => ({
        kalem_sira: k.sira,
        stok_kart_id: kalemEslestirme[k.sira],
        miktar: k.miktar,
        birim_fiyat: k.birim_fiyat,
        urun_kodu: k.urun_kodu,
        urun_adi: k.urun_adi,
      }));

    if (eslesmisKalemler.length === 0) {
      notifications.show({
        title: 'Uyarı',
        message: 'En az bir kalem eşleştirmeniz gerekiyor',
        color: 'yellow',
      });
      return;
    }

    setFaturaLoading(true);
    try {
      const result = await stokAPI.faturadanGiris({
        ettn: selectedFatura.ettn,
        depo_id: faturaGirisDepo,
        kalemler: eslesmisKalemler.map((k: any) => k.sira),
      });

      if (result.success) {
        notifications.show({
          title: 'Başarılı',
          message: result.message,
          color: 'green',
          icon: <IconCheck />,
        });
        setFaturaModalOpened(false);
        setSelectedFatura(null);
        setFaturaKalemler([]);
        setKalemEslestirme({});
        setFaturaOzet(null);
        setFaturaInfo(null);
        loadData();
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      notifications.show({
        title: 'Hata',
        message: error.message,
        color: 'red',
      });
    } finally {
      setFaturaLoading(false);
    }
  }, [selectedFatura, faturaGirisDepo, faturaKalemler, kalemEslestirme, loadData]);

  // Ürün işlemleri
  const handleSaveUrun = useCallback(async () => {
    if (!urunForm.kod || !urunForm.ad || !urunForm.kategori_id || !urunForm.ana_birim_id) {
      notifications.show({
        title: 'Uyarı',
        message: 'Lütfen zorunlu alanları doldurun',
        color: 'yellow',
        icon: <IconAlertTriangle />,
      });
      return;
    }

    try {
      setLoading(true);

      const result = await urunlerAPI.createUrun({
        kod: urunForm.kod,
        ad: urunForm.ad,
        kategori_id: parseInt(urunForm.kategori_id, 10),
        ana_birim_id: parseInt(urunForm.ana_birim_id, 10),
        barkod: urunForm.barkod,
        min_stok: urunForm.min_stok,
        max_stok: urunForm.max_stok,
        kdv_orani: urunForm.kdv_orani,
        aciklama: urunForm.aciklama,
      });

      if (!result.success) {
        throw new Error(result.error || 'Kayıt başarısız');
      }

      notifications.show({
        title: 'Başarılı',
        message: 'Yeni ürün eklendi',
        color: 'green',
        icon: <IconCheck />,
      });

      closeUrunModal();
      setUrunForm(DEFAULT_URUN_FORM);
      await loadData();
    } catch (error: any) {
      notifications.show({
        title: 'Hata',
        message: error.message,
        color: 'red',
        icon: <IconX />,
      });
    } finally {
      setLoading(false);
    }
  }, [urunForm, closeUrunModal, loadData]);

  const loadUrunDetay = useCallback((urunId: number) => {
    setDetayUrunId(urunId);
    setDetayModalOpened(true);
  }, []);

  // Reset fonksiyonları
  const resetDepoForm = useCallback(() => {
    setDepoForm(DEFAULT_DEPO_FORM);
    setEditingDepo(null);
  }, []);

  const resetTransferForm = useCallback(() => {
    setTransferForm(DEFAULT_TRANSFER_FORM);
  }, []);

  const resetGirisForm = useCallback(() => {
    setGirisForm(DEFAULT_GIRIS_FORM);
  }, []);

  const resetCikisForm = useCallback(() => {
    setCikisForm(DEFAULT_CIKIS_FORM);
  }, []);

  const resetUrunForm = useCallback(() => {
    setUrunForm(DEFAULT_URUN_FORM);
  }, []);

  const resetFaturaState = useCallback(() => {
    setSelectedFatura(null);
    setFaturaKalemler([]);
    setKalemEslestirme({});
    setFaturaOzet(null);
    setFaturaInfo(null);
  }, []);

  // === EFFECTS ===

  // İlk yükleme
  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) return;
    loadData();
  }, [loadData, authLoading, isAuthenticated]);

  // Realtime
  useRealtimeRefetch(['stok', 'stok_hareketler'], loadData);

  // URL'den fatura parametresi
  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) return;

    const faturaParam = searchParams.get('fatura');
    if (faturaParam && depolar.length > 0) {
      const loadAndSelectFatura = async () => {
        setFaturaLoading(true);
        try {
          const result = await stokAPI.getFaturalar({ limit: 100 });
          if (result.success && result.data) {
            const data = result.data as unknown as Fatura[];
            setFaturalar(data);
            const targetFatura = data.find((f) => f.ettn === faturaParam);
            if (targetFatura) {
              setSelectedFatura(targetFatura);
              setFaturaModalOpened(true);
              loadFaturaKalemler(faturaParam);
            } else {
              notifications.show({
                title: 'Uyarı',
                message: 'Fatura bulunamadı veya zaten işlenmiş',
                color: 'yellow',
              });
            }
          }
        } catch (error: any) {
          console.error('Fatura yükleme hatası:', error);
        } finally {
          setFaturaLoading(false);
        }
      };
      loadAndSelectFatura();
      router.replace('/muhasebe/stok');
    }
  }, [searchParams, depolar, loadFaturaKalemler, authLoading, isAuthenticated, router]);

  // Hareketler modalı açıldığında
  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) return;
    if (hareketlerModalOpened) {
      loadHareketler();
    }
  }, [hareketlerModalOpened, loadHareketler, authLoading, isAuthenticated]);

  // === HESAPLANAN DEĞERLER ===
  const toplamKalem = stoklar.length;
  const kritikStok = stoklar.filter((s) => s.durum === 'kritik').length;
  const toplamDeger = stoklar.reduce((acc, s) => acc + s.toplam_stok * s.son_alis_fiyat, 0);
  const kategoriSayisi = [...new Set(stoklar.map((s) => s.kategori))].length;

  // === RETURN ===
  return {
    states: {
      stoklar,
      tumUrunler,
      tumStokSayisi,
      depolar,
      kategoriler,
      birimler,
      lokasyonlar,
      hareketler,
      faturalar,
      selectedDepo,
      selectedLokasyon,
      selectedStoklar,
      selectedFatura,
      editingDepo,
      transferForm,
      depoForm,
      urunForm,
      girisForm,
      cikisForm,
      faturaKalemler,
      faturaGirisDepo,
      kalemEslestirme,
      faturaOzet,
      faturaInfo,
      sayimDepoId,
      sayimVerileri,
    },
    loading,
    error,
    faturaLoading,
    hareketlerLoading,
    topluIslemLoading,
    modals: {
      urunModal: { opened: urunModalOpened, open: openUrunModal, close: closeUrunModal },
      transferModal: { opened: transferOpened, open: openTransfer, close: closeTransfer },
      depoModalOpened,
      stokGirisModalOpened,
      stokCikisModalOpened,
      sayimModalOpened,
      hareketlerModalOpened,
      faturaModalOpened,
      detayModalOpened,
      urunKartlariModalOpened,
    },
    setters: {
      setSelectedDepo,
      setSelectedLokasyon,
      setSelectedStoklar,
      setSelectedFatura,
      setEditingDepo,
      setTransferForm,
      setDepoForm,
      setUrunForm,
      setGirisForm,
      setCikisForm,
      setFaturaGirisDepo,
      setKalemEslestirme,
      setSayimDepoId,
      setSayimVerileri,
      setDepoModalOpened,
      setStokGirisModalOpened,
      setStokCikisModalOpened,
      setSayimModalOpened,
      setHareketlerModalOpened,
      setFaturaModalOpened,
      setDetayModalOpened,
      setDetayUrunId,
      setUrunKartlariModalOpened,
    },
    loaders: {
      loadData,
      loadDepoStoklar,
      loadLokasyonStoklar,
      loadFaturalar,
      loadFaturaKalemler,
      loadHareketler,
      loadSayimVerileri,
    },
    actions: {
      handleSaveDepo,
      handleDeleteDepo,
      handleDeleteStok,
      handleBulkDelete,
      handleSelectAll,
      handleSelectStok,
      handleTransfer,
      handleStokGiris,
      handleStokCikis,
      handleSayimKaydet,
      handleTopluFaturaIsle,
      handleFiyatGuncelle,
      handleYeniUrunOlustur,
      handleFaturaStokGirisi,
      handleSaveUrun,
      loadUrunDetay,
      resetDepoForm,
      resetTransferForm,
      resetGirisForm,
      resetCikisForm,
      resetUrunForm,
      resetFaturaState,
    },
    computed: {
      filteredStoklar,
      toplamKalem,
      kritikStok,
      toplamDeger,
      kategoriSayisi,
    },
    filters: {
      activeTab,
      setActiveTab,
      searchTerm,
      setSearchTerm,
    },
    detayUrunId,
  };
}
