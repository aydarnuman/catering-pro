'use client';

import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Container,
  Grid,
  Group,
  LoadingOverlay,
  Menu,
  Paper,
  ScrollArea,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  ThemeIcon,
  Title,
  Tooltip,
  useMantineColorScheme,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconAlertCircle,
  IconAlertTriangle,
  IconArrowsExchange,
  IconBuilding,
  IconCategory,
  IconCheck,
  IconChevronDown,
  IconClipboardList,
  IconHistory,
  IconPackage,
  IconPackages,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconShoppingCart,
  IconTrash,
  IconTrendingDown,
  IconTrendingUp,
  IconX,
} from '@tabler/icons-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { Breadcrumbs, LoadingState } from '@/components/common';
import { DataActions } from '@/components/DataActions';
import { MobileHide, MobileShow, MobileStack } from '@/components/mobile';
import UrunDetayModal from '@/components/UrunDetayModal';
import UrunKartlariModal from '@/components/UrunKartlariModal';
import { useAuth } from '@/context/AuthContext';
import { useRealtimeRefetch } from '@/context/RealtimeContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useResponsive } from '@/hooks/useResponsive';
import { type AkilliKalem, type AkilliKalemlerResponse, stokAPI } from '@/lib/api/services/stok';
import { urunlerAPI } from '@/lib/api/services/urunler';
import { formatMoney } from '@/lib/formatters';
import {
  DepoModal,
  FaturaIslemModal,
  HareketlerModal,
  SayimModal,
  StokCikisModal,
  StokGirisModal,
  TransferModal,
  YeniUrunModal,
} from './components/modals';
import type { Birim, Depo, Kategori, StokItem } from './types';

function StokPageContent() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { colorScheme } = useMantineColorScheme();
  const _isDark = colorScheme === 'dark';
  const { isMobile, isTablet, isMounted } = useResponsive();

  // === YETKİ KONTROLÜ ===
  const { canCreate, canEdit, canDelete, isSuperAdmin } = usePermissions();
  const _canCreateStok = isSuperAdmin || canCreate('stok');
  const _canEditStok = isSuperAdmin || canEdit('stok');
  const canDeleteStok = isSuperAdmin || canDelete('stok');
  const [opened, { open, close }] = useDisclosure(false);
  const [transferOpened, { open: openTransfer, close: closeTransfer }] = useDisclosure(false);
  const [activeTab, setActiveTab] = useState<string | null>('tumu');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [stoklar, setStoklar] = useState<StokItem[]>([]);
  const [tumUrunler, setTumUrunler] = useState<StokItem[]>([]); // Tüm ürün kartları (fatura eşleştirme için)
  const [tumStokSayisi, setTumStokSayisi] = useState<number>(0); // Toplam stok kartı sayısı
  const [depolar, setDepolar] = useState<Depo[]>([]);
  const [kategoriler, setKategoriler] = useState<Kategori[]>([]);
  const [birimler, setBirimler] = useState<Birim[]>([]);
  const [selectedDepo, setSelectedDepo] = useState<number | null>(null);
  const [selectedLokasyon, setSelectedLokasyon] = useState<number | null>(null);
  const [selectedStoklar, setSelectedStoklar] = useState<number[]>([]);
  const [lokasyonlar, setLokasyonlar] = useState<any[]>([]);
  const [_selectedStok, _setSelectedStok] = useState<StokItem | null>(null);

  // Transfer form
  const [transferForm, setTransferForm] = useState({
    stok_kart_id: 0,
    urun_id: 0,
    kaynak_depo_id: 0,
    hedef_depo_id: 0,
    miktar: 0,
    birim: 'kg',
    belge_no: '',
    aciklama: '',
  });

  // Yeni ürün formu
  const [urunForm, setUrunForm] = useState({
    kod: '',
    ad: '',
    kategori_id: '',
    ana_birim_id: '',
    barkod: '',
    min_stok: 0,
    max_stok: 0,
    son_alis_fiyat: 0,
    kdv_orani: 18,
    aciklama: '',
  });

  // Depo yönetimi state'leri
  const [depoModalOpened, setDepoModalOpened] = useState(false);
  const [editingDepo, setEditingDepo] = useState<Depo | null>(null);
  const [depoForm, setDepoForm] = useState({
    ad: '',
    kod: '',
    tur: 'genel',
    adres: '',
    telefon: '',
    email: '',
    yetkili: '',
    kapasite_m3: 0,
  });

  // Faturadan stok girişi state'leri
  const [faturaModalOpened, setFaturaModalOpened] = useState(false);

  // Yeni modal state'leri
  const [stokGirisModalOpened, setStokGirisModalOpened] = useState(false);
  const [stokCikisModalOpened, setStokCikisModalOpened] = useState(false);
  const [sayimModalOpened, setSayimModalOpened] = useState(false);
  const [hareketlerModalOpened, setHareketlerModalOpened] = useState(false);

  // Stok girişi form state
  const [girisForm, setGirisForm] = useState({
    stok_kart_id: null as number | null,
    urun_id: null as number | null,
    depo_id: null as number | null,
    miktar: 0,
    birim: 'kg',
    birim_fiyat: 0,
    giris_tipi: 'SATIN_ALMA',
    aciklama: '',
  });

  // Stok çıkışı form state
  const [cikisForm, setCikisForm] = useState({
    stok_kart_id: null as number | null,
    urun_id: null as number | null,
    depo_id: null as number | null,
    miktar: 0,
    birim: 'kg',
    cikis_tipi: 'TUKETIM',
    aciklama: '',
  });

  // Stok hareketleri state
  const [hareketler, setHareketler] = useState<any[]>([]);
  const [hareketlerLoading, setHareketlerLoading] = useState(false);

  // Sayım state
  const [sayimDepoId, setSayimDepoId] = useState<number | null>(null);
  const [sayimVerileri, setSayimVerileri] = useState<{ [key: number]: number }>({});
  const [faturalar, setFaturalar] = useState<any[]>([]);
  const [faturaLoading, setFaturaLoading] = useState(false);
  const [selectedFatura, setSelectedFatura] = useState<any>(null);

  // Ürün detay modalı (ortak bileşen)
  const [detayModalOpened, setDetayModalOpened] = useState(false);
  const [detayUrunId, setDetayUrunId] = useState<number | null>(null);

  // Tüm ürün kartları modalı
  const [urunKartlariModalOpened, setUrunKartlariModalOpened] = useState(false);
  const [faturaKalemler, setFaturaKalemler] = useState<AkilliKalem[]>([]);
  const [faturaGirisDepo, setFaturaGirisDepo] = useState<number | null>(null);
  const [kalemEslestirme, setKalemEslestirme] = useState<{ [key: number]: number | null }>({});
  const [faturaOzet, setFaturaOzet] = useState<AkilliKalemlerResponse['ozet'] | null>(null);
  const [faturaInfo, setFaturaInfo] = useState<AkilliKalemlerResponse['fatura'] | null>(null);
  const [topluIslemLoading, setTopluIslemLoading] = useState(false);

  // Depo yönetimi fonksiyonları
  const _handleEditDepo = (depoId: number) => {
    const depo = depolar.find((d) => d.id === depoId);
    if (depo) {
      setEditingDepo(depo);
      setDepoForm({
        ad: depo.ad,
        kod: depo.kod,
        tur: depo.tur || 'genel',
        adres: depo.adres || '',
        telefon: depo.telefon || '',
        email: depo.email || '',
        yetkili: depo.yetkili || '',
        kapasite_m3: depo.kapasite_m3 || 0,
      });
      setDepoModalOpened(true);
    }
  };

  const handleSaveDepo = async () => {
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
      setDepoForm({
        ad: '',
        kod: '',
        tur: 'genel',
        adres: '',
        telefon: '',
        email: '',
        yetkili: '',
        kapasite_m3: 0,
      });

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
  };

  const handleDeleteDepo = async (depoId: number) => {
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
  };

  // Cookie-only authentication - token gerekmiyor

  // API'den verileri yükle
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    let timeoutId: NodeJS.Timeout | null = null;

    try {
      // Timeout: 30 saniye sonra loading'i zorla bitir (axios timeout 60 saniye)
      timeoutId = setTimeout(() => {
        setLoading(false);
        setError(
          'Veri yükleme çok uzun sürdü. Lütfen sayfayı yenileyin veya internet bağlantınızı kontrol edin.'
        );
      }, 30000);

      // Paralel istekler - Promise.allSettled kullan (bir hata olsa bile diğerleri tamamlansın)
      // Limit kaldırıldı - tüm ürünler yüklenecek
      // Axios'un kendi timeout'u kullanılıyor (60 saniye)
      const results = await Promise.allSettled([
        urunlerAPI.getUrunler(), // Limit kaldırıldı - tüm ürünler yüklenecek
        stokAPI.getDepolar(),
        urunlerAPI.getKategoriler(),
        stokAPI.getBirimler(),
      ]);

      // Sonuçları parse et
      const urunData =
        results[0].status === 'fulfilled'
          ? results[0].value
          : { success: false, error: results[0].reason?.message || 'Ürün verileri alınamadı' };
      const depoData =
        results[1].status === 'fulfilled'
          ? results[1].value
          : { success: false, error: results[1].reason?.message || 'Depo verileri alınamadı' };
      const katData =
        results[2].status === 'fulfilled'
          ? results[2].value
          : { success: false, error: results[2].reason?.message || 'Kategori verileri alınamadı' };
      const birimData =
        results[3].status === 'fulfilled'
          ? results[3].value
          : { success: false, error: results[3].reason?.message || 'Birim verileri alınamadı' };

      // API response kontrolü - Kritik olanlar için hata fırlat
      const errors: string[] = [];
      if (!urunData.success) {
        errors.push(`Ürünler: ${urunData.error || 'Alınamadı'}`);
      }
      if (!depoData.success) {
        errors.push(`Depolar: ${depoData.error || 'Alınamadı'}`);
      }

      // Kritik veriler yoksa hata fırlat
      if (errors.length > 0 && (!urunData.success || !depoData.success)) {
        throw new Error(`Kritik veriler alınamadı: ${errors.join(', ')}`);
      }

      // Kategoriler ve birimler kritik değil, boş array olarak devam et

      // Ürün kartlarını stok formatına dönüştür
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

      // TÜM ÜRÜNLERİ GÖSTER (stok girişi yapılmamış ürünler de dahil)
      // Kullanıcı stok girişi yapabilir
      setStoklar(urunList); // Tüm ürünleri göster
      setTumUrunler(urunList); // Tüm ürünler (fatura eşleştirme için)
      setTumStokSayisi(urunList.length);
      setDepolar(
        (depoData.success && 'data' in depoData ? depoData.data || [] : []) as unknown as Depo[]
      );

      // Kategorileri dönüştür (başarısız olsa bile boş array kullan)
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
      // Daha açıklayıcı hata mesajı
      let errorMessage = 'Veriler yüklenirken hata oluştu';
      if (err?.response?.status === 401) {
        errorMessage = 'Oturum süresi dolmuş. Lütfen tekrar giriş yapın.';
      } else if (err?.response?.status === 403) {
        errorMessage = 'Bu sayfaya erişim yetkiniz yok.';
      } else if (err?.response?.status === 404) {
        errorMessage = 'Endpoint bulunamadı. Backend çalışıyor mu?';
      } else if (err?.response?.status === 500) {
        errorMessage = 'Sunucu hatası. Backend loglarını kontrol edin.';
      } else if (err?.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
      // Hata durumunda state'leri boş array olarak set et
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
        autoClose: 5000,
      });
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      setLoading(false);
    }
  }, []);

  // Depo stoklarını yükle
  const loadDepoStoklar = async (depoId: number) => {
    setLoading(true);
    try {
      setSelectedDepo(depoId);
      setSelectedLokasyon(null);

      // Lokasyonları yükle
      const lokResult = await stokAPI.getDepoLokasyonlar(depoId);
      if (lokResult.success) {
        setLokasyonlar(lokResult.data || []);
      } else {
        setLokasyonlar([]);
      }

      // Stokları yükle
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
  };

  // Lokasyon stoklarını yükle
  const loadLokasyonStoklar = async (lokasyonId: number) => {
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
  };

  // Ürün sil
  const handleDeleteStok = async (urunId: number) => {
    try {
      setLoading(true);

      // Yeni ürün kartları sistemini kullan
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

      // Listeyi yenile
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
  };

  // Toplu ürün sil
  const handleBulkDelete = async () => {
    if (selectedStoklar.length === 0) return;

    if (!confirm(`${selectedStoklar.length} ürünü silmek istediğinizden emin misiniz?`)) {
      return;
    }

    try {
      setLoading(true);
      let basarili = 0;
      let hatali = 0;

      // Yeni ürün kartları sistemini kullan
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
  };

  // Tümünü seç/kaldır
  const handleSelectAll = () => {
    if (selectedStoklar.length === filteredStoklar.length) {
      setSelectedStoklar([]);
    } else {
      setSelectedStoklar(filteredStoklar.map((s) => s.id));
    }
  };

  // Tek ürün seç/kaldır
  const handleSelectStok = (stokId: number) => {
    if (selectedStoklar.includes(stokId)) {
      setSelectedStoklar(selectedStoklar.filter((id) => id !== stokId));
    } else {
      setSelectedStoklar([...selectedStoklar, stokId]);
    }
  };

  // Faturaları yükle
  const loadFaturalar = async () => {
    setFaturaLoading(true);
    try {
      const result = await stokAPI.getFaturalar({ limit: 50 });
      if (result.success) {
        setFaturalar(result.data);
      }
    } catch (error: any) {
      console.error('Fatura yükleme hatası:', error);
    } finally {
      setFaturaLoading(false);
    }
  };

  // Fatura kalemlerini akıllı eşleştirme ile yükle
  const loadFaturaKalemler = async (ettn: string) => {
    setFaturaLoading(true);
    try {
      // Akıllı eşleştirme endpoint'ini kullan
      const result = (await stokAPI.getAkilliKalemler(ettn)) as any;

      if (result.success && result.kalemler) {
        const { kalemler, ozet, fatura } = result;

        setFaturaKalemler(kalemler);
        setFaturaOzet(ozet);
        setFaturaInfo(fatura);

        // Akıllı eşleştirme sonuçlarını otomatik uygula
        const eslestirmeler: { [key: number]: number | null } = {};
        kalemler.forEach((k: AkilliKalem) => {
          // Güven skoru >= 90 ve anomali yoksa otomatik eşleştir
          if (k.eslesme?.otomatik_onay && !k.anomali?.var) {
            eslestirmeler[k.sira] = k.eslesme.stok_kart_id;
          } else {
            eslestirmeler[k.sira] = null; // Manuel seçim gerekli
          }
        });
        setKalemEslestirme(eslestirmeler);

        // Özet bildirim
        const otomatikSayisi = Object.values(eslestirmeler).filter((v) => v !== null).length;
        const manuelSayisi = kalemler.length - otomatikSayisi;
        const anomaliSayisi = kalemler.filter((k: AkilliKalem) => k.anomali?.var).length;

        if (ozet.tum_otomatik) {
          notifications.show({
            title: '✅ Tüm Kalemler Eşleştirildi',
            message: `${kalemler.length} kalem otomatik eşleştirildi - kontrol edip onaylayabilirsiniz`,
            color: 'green',
            autoClose: 4000,
          });
        } else {
          notifications.show({
            title: '📋 Fatura Yüklendi',
            message: `${otomatikSayisi} otomatik eşleşti, ${manuelSayisi} manuel seçim bekliyor${anomaliSayisi > 0 ? `, ${anomaliSayisi} fiyat anomalisi` : ''}`,
            color: manuelSayisi > 0 ? 'yellow' : 'green',
            autoClose: 5000,
          });
        }
      }
    } catch (error: any) {
      console.error('Fatura kalem hatası:', error);
      // Fallback: basit endpoint'i dene
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
            title: '📋 Fatura Kalemleri',
            message: `${kalemler.length} kalem yüklendi - manuel eşleştirme gerekli`,
            color: 'blue',
            autoClose: 3000,
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
  };

  // Toplu fatura işleme
  const handleTopluFaturaIsle = async () => {
    if (!faturaGirisDepo) {
      notifications.show({
        title: 'Uyarı',
        message: 'Lütfen depo seçin',
        color: 'yellow',
      });
      return;
    }

    // İşlenmemiş faturaları al
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
          title: '✅ Toplu İşlem Tamamlandı',
          message: `${result.ozet?.basarili || 0} fatura işlendi, ${result.ozet?.otomatik_eslesen || 0} kalem eşleştirildi`,
          color: 'green',
          autoClose: 5000,
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
  };

  // Tek kalem için fiyat güncelle (stok girişi yapmadan)
  const handleFiyatGuncelle = async (urunKartId: number, birimFiyat: number, urunAdi: string) => {
    try {
      const result = await urunlerAPI.updateFiyat(urunKartId, {
        birim_fiyat: birimFiyat,
        kaynak: 'fatura_manuel',
        aciklama: `Faturadan manuel güncelleme - ${selectedFatura?.sender_name || ''}`,
      });

      if (result.success) {
        notifications.show({
          title: '💰 Fiyat Güncellendi',
          message: `${urunAdi}: ${(result as any).eski_fiyat || 0}₺ → ${birimFiyat}₺`,
          color: 'green',
          autoClose: 3000,
        });
        // Ürün listesini yenile
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
  };

  // Fatura kaleminden yeni ürün kartı oluştur
  const handleYeniUrunOlustur = async (kalem: any, anaUrunId?: number) => {
    try {
      const result = await urunlerAPI.createVaryant({
        ana_urun_id: anaUrunId || undefined,
        fatura_urun_adi: kalem.urun_adi,
        birim_fiyat: kalem.birim_fiyat,
      });

      if (result.success) {
        notifications.show({
          title: anaUrunId ? '🔗 Varyant Oluşturuldu' : '✨ Yeni Ürün Kartı',
          message: `${result.data.kod} - ${result.data.ad}`,
          color: 'green',
          autoClose: 4000,
        });

        // Yeni ürünü otomatik eşleştir
        setKalemEslestirme((prev) => ({
          ...prev,
          [kalem.sira]: result.data.id,
        }));

        // Ürün listesini yenile
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
  };

  // Faturadan stok girişi yap
  const handleFaturaStokGirisi = async () => {
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
  };

  // Stok kartı arama
  const [_stokAramaQuery, _setStokAramaQuery] = useState('');
  const [_stokAramaSonuclari, setStokAramaSonuclari] = useState<any[]>([]);

  const _araStokKarti = async (query: string) => {
    if (query.length < 2) {
      setStokAramaSonuclari([]);
      return;
    }
    try {
      const result = await stokAPI.araKartlar(query);
      if (result.success) {
        setStokAramaSonuclari(result.data);
      }
    } catch (error: any) {
      console.error('Stok arama hatası:', error);
    }
  };

  // Yeni ürün kaydet
  const handleSaveUrun = async () => {
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

      // Yeni ürün kartları sistemini kullan
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

      close();
      setUrunForm({
        kod: '',
        ad: '',
        kategori_id: '',
        ana_birim_id: '',
        barkod: '',
        min_stok: 0,
        max_stok: 0,
        son_alis_fiyat: 0,
        kdv_orani: 18,
        aciklama: '',
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
  };

  // Ürün detay modalını aç (ortak bileşen kullanır)
  const loadUrunDetay = (urunId: number) => {
    setDetayUrunId(urunId);
    setDetayModalOpened(true);
  };

  // Transfer yap
  const handleTransfer = async () => {
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
        loadData(); // Verileri yenile
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
  };

  // Stok girişi yap
  const handleStokGiris = async () => {
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
        setGirisForm({
          stok_kart_id: null,
          urun_id: null,
          depo_id: null,
          miktar: 0,
          birim: 'kg',
          birim_fiyat: 0,
          giris_tipi: 'SATIN_ALMA',
          aciklama: '',
        });
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
  };

  // Stok çıkışı yap
  const handleStokCikis = async () => {
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
        setCikisForm({
          stok_kart_id: null,
          urun_id: null,
          depo_id: null,
          miktar: 0,
          birim: 'kg',
          cikis_tipi: 'TUKETIM',
          aciklama: '',
        });
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
  };

  // Stok hareketlerini yükle
  const loadHareketler = useCallback(async () => {
    setHareketlerLoading(true);
    try {
      const result = await stokAPI.getHareketler({ limit: 100 });
      if (result.success) {
        setHareketler(result.data || []);
      }
    } catch (error: any) {
      console.error('Hareketler yükleme hatası:', error);
    } finally {
      setHareketlerLoading(false);
    }
  }, []);

  // Sayım için depo stoklarını yükle
  const loadSayimVerileri = async (depoId: number) => {
    setSayimDepoId(depoId);
    try {
      const result = await stokAPI.getDepoStoklar(depoId);
      if (result.success) {
        // Mevcut stokları sayım verilerine kopyala
        const initialSayim: { [key: number]: number } = {};
        result.data.forEach((item: any) => {
          initialSayim[item.id] = item.toplam_stok || 0;
        });
        setSayimVerileri(initialSayim);
      }
    } catch (error: any) {
      console.error('Sayım verileri yükleme hatası:', error);
    }
  };

  // Sayımı kaydet
  const handleSayimKaydet = async () => {
    if (!sayimDepoId) {
      notifications.show({ title: 'Hata', message: 'Lütfen depo seçin', color: 'red' });
      return;
    }

    setLoading(true);
    try {
      // Her ürün için fark varsa hareket oluştur
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
  };

  // Component mount
  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) return;
    loadData();
  }, [loadData, authLoading, isAuthenticated]);

  // 🔴 REALTIME - Stok ve stok hareketler tablolarını dinle
  useRealtimeRefetch(['stok', 'stok_hareketler'], loadData);

  // URL'de fatura parametresi varsa modalı aç ve o faturayı seç
  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) return;

    const faturaParam = searchParams.get('fatura');
    if (faturaParam && depolar.length > 0) {
      // Önce faturaları yükle, sonra ilgili faturayı seç
      const loadAndSelectFatura = async () => {
        setFaturaLoading(true);
        try {
          const result = await stokAPI.getFaturalar({ limit: 100 });
          if (result.success) {
            setFaturalar(result.data);
            // Gelen faturalardan parametredeki ETTN'i bul
            const targetFatura = result.data.find((f: any) => f.ettn === faturaParam);
            if (targetFatura) {
              setSelectedFatura(targetFatura);
              setFaturaModalOpened(true);
              // Fatura kalemlerini yükle
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
      // URL'den parametreyi temizle
      router.replace('/muhasebe/stok');
    }
  }, [searchParams, depolar, loadFaturaKalemler, authLoading, isAuthenticated, router]);

  // Hareketler modalı açıldığında verileri yükle
  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) return;
    if (hareketlerModalOpened) {
      loadHareketler();
    }
  }, [hareketlerModalOpened, loadHareketler, authLoading, isAuthenticated]);

  // Miktar formatı (gereksiz ondalıkları kaldır)
  const formatMiktar = (value: number | string) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (Number.isNaN(num)) return '0';
    // Tam sayı ise ondalık gösterme, değilse en fazla 2 basamak
    if (Number.isInteger(num)) {
      return num.toLocaleString('tr-TR');
    }
    // Ondalık kısmı varsa, gereksiz sıfırları kaldır
    const formatted = num.toLocaleString('tr-TR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
    return formatted;
  };

  // Para formatı (kuruşsuz)

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

  // İstatistikler
  const _toplamKalem = stoklar.length;
  const kritikStok = stoklar.filter((s) => s.durum === 'kritik').length;
  const toplamDeger = stoklar.reduce((acc, s) => acc + s.toplam_stok * s.son_alis_fiyat, 0);
  const kategoriSayisi = [...new Set(stoklar.map((s) => s.kategori))].length;

  // Kategori dağılımı (gerçek verilerle)
  const _kategoriDagilimi = kategoriler
    .map((kat) => ({
      name: kat.ad,
      value: stoklar
        .filter((s) => s.kategori === kat.ad)
        .reduce((acc, s) => acc + s.toplam_stok * s.son_alis_fiyat, 0),
    }))
    .filter((k) => k.value > 0);

  return (
    <Container fluid>
      <Breadcrumbs items={[{ label: 'Muhasebe', href: '/muhasebe' }, { label: 'Stok Takibi' }]} />
      <LoadingOverlay visible={loading} />

      {error && (
        <Alert icon={<IconAlertCircle size={16} />} color="red" mb="md">
          {error}
        </Alert>
      )}

      {/* Stok girişi yapılmamış ürünler için bilgilendirme */}
      {!loading &&
        !error &&
        stoklar.length > 0 &&
        stoklar.filter((s) => s.toplam_stok === 0).length === stoklar.length && (
          <Alert icon={<IconAlertTriangle size={16} />} color="blue" mb="md">
            <Text size="sm" fw={500} mb={4}>
              Stok girişi yapılmamış
            </Text>
            <Text size="xs" c="dimmed">
              Tüm ürünlerin stoku 0. Stok girişi yapmak için "Stok İşlemleri" butonuna tıklayın.
            </Text>
          </Alert>
        )}

      <MobileStack stackOnMobile justify="space-between" mb="md" align="flex-start">
        <Group gap="md">
          <ThemeIcon
            size={isMobile ? 36 : 42}
            radius="xl"
            variant="gradient"
            gradient={{ from: 'blue', to: 'cyan' }}
          >
            <IconPackage size={isMobile ? 20 : 24} />
          </ThemeIcon>
          <Box>
            <Title order={isMobile ? 4 : 3}>Stok Yönetimi</Title>
            <MobileHide hideOnMobile>
              <Text size="xs" c="dimmed">
                Ürün ve malzeme stoklarınızı takip edin
              </Text>
            </MobileHide>
          </Box>
        </Group>

        {/* Mobil Butonlar */}
        <MobileShow showOnMobile>
          <Group gap="xs" w="100%">
            <ActionIcon variant="light" size="lg" radius="xl" onClick={() => loadData()}>
              <IconRefresh size={18} />
            </ActionIcon>
            <Button
              variant="light"
              color="blue"
              size="xs"
              radius="xl"
              leftSection={<IconPackage size={14} />}
              onClick={() => setUrunKartlariModalOpened(true)}
              style={{ flex: 1 }}
            >
              Kartlar ({tumStokSayisi})
            </Button>
            <Menu shadow="md" width={200}>
              <Menu.Target>
                <Button
                  variant="filled"
                  color="grape"
                  size="xs"
                  radius="xl"
                  leftSection={<IconPlus size={14} />}
                >
                  İşlem
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item
                  leftSection={<IconTrendingUp size={16} color="green" />}
                  onClick={() => {
                    setFaturaModalOpened(true);
                    loadFaturalar();
                  }}
                >
                  Stok Girişi
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconTrendingDown size={16} color="red" />}
                  onClick={() => setStokCikisModalOpened(true)}
                >
                  Stok Çıkışı
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconArrowsExchange size={16} color="blue" />}
                  onClick={openTransfer}
                >
                  Transfer
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconClipboardList size={16} color="orange" />}
                  onClick={() => setSayimModalOpened(true)}
                >
                  Sayım
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item
                  leftSection={<IconHistory size={16} color="gray" />}
                  onClick={() => setHareketlerModalOpened(true)}
                >
                  Hareketler
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </MobileShow>

        {/* Desktop Butonlar */}
        <MobileHide hideOnMobile>
          <Group gap="xs">
            <ActionIcon
              variant="light"
              size="lg"
              radius="xl"
              onClick={() => loadData()}
              title="Yenile"
            >
              <IconRefresh size={18} />
            </ActionIcon>
            <Button
              variant="light"
              color="blue"
              size="sm"
              radius="xl"
              leftSection={<IconPackage size={16} />}
              onClick={() => setUrunKartlariModalOpened(true)}
            >
              Ürün Kartları ({tumStokSayisi})
            </Button>
            <Menu shadow="md" width={200}>
              <Menu.Target>
                <Button
                  variant="filled"
                  color="grape"
                  size="sm"
                  radius="xl"
                  leftSection={<IconPlus size={16} />}
                  rightSection={<IconChevronDown size={14} />}
                >
                  Stok İşlemleri
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item
                  leftSection={<IconTrendingUp size={16} color="green" />}
                  onClick={() => {
                    setFaturaModalOpened(true);
                    loadFaturalar();
                  }}
                >
                  Stok Girişi
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconTrendingDown size={16} color="red" />}
                  onClick={() => setStokCikisModalOpened(true)}
                >
                  Stok Çıkışı
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconArrowsExchange size={16} color="blue" />}
                  onClick={openTransfer}
                >
                  Transfer
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconClipboardList size={16} color="orange" />}
                  onClick={() => setSayimModalOpened(true)}
                >
                  Sayım
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item
                  leftSection={<IconHistory size={16} color="gray" />}
                  onClick={() => setHareketlerModalOpened(true)}
                >
                  Hareketler
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
            <DataActions
              type="stok"
              onImportSuccess={() => loadData()}
              kategoriler={kategoriler.map((k) => k.ad)}
            />
          </Group>
        </MobileHide>
      </MobileStack>

      {/* Modern İstatistik Kartları */}
      <Paper
        p={isMobile ? 'sm' : 'md'}
        radius="lg"
        mb="lg"
        style={{
          background:
            'linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(139, 92, 246, 0.05) 100%)',
          border: '1px solid var(--mantine-color-gray-2)',
        }}
      >
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing={isMobile ? 'xs' : 'md'}>
          <Box ta="center" py="xs">
            <Text size={isMobile ? 'xl' : '2rem'} fw={800} c="blue">
              {stoklar.length}
            </Text>
            <Text size="xs" tt="uppercase" fw={600} c="dimmed">
              Stokta Ürün
            </Text>
            <MobileHide hideOnMobile>
              <Text size="xs" c="dimmed">
                ({tumStokSayisi} ürün kartı)
              </Text>
            </MobileHide>
          </Box>
          <Box
            ta="center"
            py="xs"
            style={{ borderLeft: isMobile ? 'none' : '1px solid var(--mantine-color-gray-3)' }}
          >
            <Text size={isMobile ? 'xl' : '2rem'} fw={800} c="red">
              {kritikStok}
            </Text>
            <Text size="xs" tt="uppercase" fw={600} c="dimmed">
              Kritik Stok
            </Text>
          </Box>
          <Box
            ta="center"
            py="xs"
            style={{ borderLeft: isMobile ? 'none' : '1px solid var(--mantine-color-gray-3)' }}
          >
            <Text size={isMobile ? 'lg' : '2rem'} fw={800} c="teal">
              {formatMoney(toplamDeger, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </Text>
            <Text size="xs" tt="uppercase" fw={600} c="dimmed">
              Stok Değeri
            </Text>
          </Box>
          <Box
            ta="center"
            py="xs"
            style={{ borderLeft: isMobile ? 'none' : '1px solid var(--mantine-color-gray-3)' }}
          >
            <Text size={isMobile ? 'xl' : '2rem'} fw={800} c="grape">
              {kategoriSayisi}
            </Text>
            <Text size="xs" tt="uppercase" fw={600} c="dimmed">
              Kategori
            </Text>
          </Box>
        </SimpleGrid>
      </Paper>

      {/* Modern Depo Seçimi */}
      <Box mb="lg">
        <ScrollArea scrollbarSize={isMobile ? 4 : 8} type={isMobile ? 'scroll' : 'hover'}>
          <Group gap={isMobile ? 'xs' : 'md'} wrap="nowrap" style={{ minWidth: 'max-content' }}>
            {/* Tüm Depolar Kartı */}
            <Box
              onClick={() => {
                setSelectedDepo(null);
                loadData();
              }}
              style={{
                cursor: 'pointer',
                padding: '14px 20px',
                borderRadius: '16px',
                background:
                  selectedDepo === null
                    ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                    : 'white',
                color: selectedDepo === null ? 'white' : '#495057',
                boxShadow:
                  selectedDepo === null
                    ? '0 4px 15px rgba(102, 126, 234, 0.4)'
                    : '0 2px 10px rgba(0,0,0,0.08)',
                transition: 'all 0.3s ease',
                border: selectedDepo === null ? 'none' : '1px solid #e9ecef',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                minWidth: '150px',
              }}
            >
              <Box
                style={{
                  background: selectedDepo === null ? 'rgba(255,255,255,0.2)' : '#667eea15',
                  borderRadius: '12px',
                  padding: '10px',
                  display: 'flex',
                }}
              >
                <IconPackages size={22} color={selectedDepo === null ? 'white' : '#667eea'} />
              </Box>
              <Stack gap={2}>
                <Text size="xs" fw={500} style={{ opacity: 0.85 }}>
                  Tüm Depolar
                </Text>
                <Text size="lg" fw={700}>
                  {stoklar.length}{' '}
                  <Text span size="sm" fw={400}>
                    stokta
                  </Text>
                </Text>
              </Stack>
            </Box>

            {/* Depo Kartları */}
            {depolar.map((depo, index) => {
              const colors = [
                { from: '#11998e', to: '#38ef7d', shadow: 'rgba(17, 153, 142, 0.4)' },
                { from: '#ee0979', to: '#ff6a00', shadow: 'rgba(238, 9, 121, 0.4)' },
                { from: '#2193b0', to: '#6dd5ed', shadow: 'rgba(33, 147, 176, 0.4)' },
                { from: '#8E2DE2', to: '#4A00E0', shadow: 'rgba(142, 45, 226, 0.4)' },
              ];
              const colorSet = colors[index % colors.length];
              const isSelected = selectedDepo === depo.id;

              return (
                <Box
                  key={depo.id}
                  style={{
                    cursor: 'pointer',
                    padding: '14px 20px',
                    borderRadius: '16px',
                    background: isSelected
                      ? `linear-gradient(135deg, ${colorSet.from} 0%, ${colorSet.to} 100%)`
                      : 'white',
                    color: isSelected ? 'white' : '#495057',
                    boxShadow: isSelected
                      ? `0 4px 15px ${colorSet.shadow}`
                      : '0 2px 10px rgba(0,0,0,0.08)',
                    transition: 'all 0.3s ease',
                    border: isSelected ? 'none' : '1px solid #e9ecef',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    minWidth: '170px',
                    position: 'relative',
                  }}
                  onClick={() => loadDepoStoklar(depo.id)}
                >
                  <Box
                    style={{
                      background: isSelected ? 'rgba(255,255,255,0.2)' : `${colorSet.from}15`,
                      borderRadius: '12px',
                      padding: '10px',
                      display: 'flex',
                    }}
                  >
                    <IconBuilding size={22} color={isSelected ? 'white' : colorSet.from} />
                  </Box>
                  <Stack gap={2} style={{ flex: 1 }}>
                    <Text size="xs" fw={500} style={{ opacity: 0.85 }} lineClamp={1}>
                      {depo.ad}
                    </Text>
                    <Text size="lg" fw={700}>
                      {Number(depo.urun_sayisi) || 0}{' '}
                      <Text span size="sm" fw={400}>
                        ürün
                      </Text>
                    </Text>
                  </Stack>

                  {/* Silme butonu */}
                  {Number(depo.urun_sayisi || 0) === 0 && (
                    <ActionIcon
                      variant="light"
                      color="red"
                      size="sm"
                      radius="md"
                      style={{
                        position: 'absolute',
                        top: -8,
                        right: -8,
                        backdropFilter: 'blur(8px)',
                        backgroundColor: 'rgba(255, 82, 82, 0.15)',
                        border: '1px solid rgba(255, 82, 82, 0.3)',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 2px 8px rgba(255, 82, 82, 0.2)',
                      }}
                      className="depo-delete-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`"${depo.ad}" deposunu silmek istediğinizden emin misiniz?`)) {
                          handleDeleteDepo(depo.id);
                        }
                      }}
                    >
                      <IconX size={14} />
                    </ActionIcon>
                  )}
                </Box>
              );
            })}

            {/* Depo Ekle Kartı */}
            <Box
              onClick={() => setDepoModalOpened(true)}
              style={{
                cursor: 'pointer',
                padding: '14px 20px',
                borderRadius: '16px',
                background: 'white',
                border: '2px dashed var(--mantine-color-gray-4)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                minWidth: '120px',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--mantine-color-teal-5)';
                e.currentTarget.style.background = 'var(--mantine-color-teal-0)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--mantine-color-gray-4)';
                e.currentTarget.style.background = 'white';
              }}
            >
              <Box
                style={{
                  background: '#20c99715',
                  borderRadius: '12px',
                  padding: '10px',
                  display: 'flex',
                }}
              >
                <IconPlus size={22} color="#20c997" />
              </Box>
              <Text size="sm" fw={500} c="dimmed">
                Depo Ekle
              </Text>
            </Box>
          </Group>
        </ScrollArea>
      </Box>

      {/* Modern Lokasyon Seçimi */}
      {selectedDepo && lokasyonlar.length > 0 && (
        <Paper p="sm" radius="lg" mb="lg" withBorder>
          <Group gap="xs">
            <ThemeIcon size="sm" variant="light" color="grape" radius="xl">
              <IconCategory size={14} />
            </ThemeIcon>
            <Text size="sm" fw={600} c="dimmed">
              Bölümler:
            </Text>

            <Button
              variant={selectedLokasyon === null ? 'filled' : 'light'}
              color="grape"
              size="xs"
              radius="xl"
              onClick={() => {
                setSelectedLokasyon(null);
                loadDepoStoklar(selectedDepo);
              }}
            >
              Tümü ({stoklar.length})
            </Button>

            {lokasyonlar.map((lok: any) => {
              const getEmoji = () => {
                switch (lok.tur) {
                  case 'soguk_hava':
                    return '❄️';
                  case 'dondurulmus':
                    return '🧊';
                  case 'kuru_gida':
                    return '🌾';
                  case 'sebze_meyve':
                    return '🥬';
                  case 'temizlik':
                    return '🧹';
                  case 'baharat':
                    return '🌶️';
                  default:
                    return '📦';
                }
              };

              return (
                <Button
                  key={lok.id}
                  variant={selectedLokasyon === lok.id ? 'filled' : 'light'}
                  color={selectedLokasyon === lok.id ? 'grape' : 'gray'}
                  size="xs"
                  radius="xl"
                  leftSection={<span style={{ fontSize: '14px' }}>{getEmoji()}</span>}
                  onClick={() => loadLokasyonStoklar(lok.id)}
                >
                  {lok.ad} ({Number(lok.urun_sayisi) || 0})
                </Button>
              );
            })}
          </Group>
        </Paper>
      )}

      {/* Ana İçerik */}
      <Grid>
        <Grid.Col span={12}>
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Tabs value={activeTab} onChange={setActiveTab}>
              <Tabs.List>
                <Tabs.Tab value="tumu">Tümü ({stoklar.length})</Tabs.Tab>
                <Tabs.Tab value="kritik" color="red">
                  Kritik ({kritikStok})
                </Tabs.Tab>
                <Tabs.Tab value="dusuk" color="orange">
                  Düşük ({stoklar.filter((s) => s.durum === 'dusuk').length})
                </Tabs.Tab>
              </Tabs.List>

              <Box mt="md">
                <TextInput
                  placeholder="Ürün adı veya kodu ile ara..."
                  leftSection={<IconSearch size={16} />}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  mb="md"
                />

                {/* Toplu İşlem Çubuğu */}
                {selectedStoklar.length > 0 && (
                  <Paper p="xs" mb="sm" withBorder radius="md" bg="red.0">
                    <Group justify="space-between">
                      <Text size="sm" fw={500} c="red.7">
                        {selectedStoklar.length} ürün seçildi
                      </Text>
                      <Group gap="xs">
                        <Button
                          size="xs"
                          variant="light"
                          color="gray"
                          onClick={() => setSelectedStoklar([])}
                        >
                          Seçimi Kaldır
                        </Button>
                        <Button
                          size="xs"
                          color="red"
                          leftSection={<IconTrash size={14} />}
                          onClick={handleBulkDelete}
                          loading={loading}
                        >
                          Toplu Sil
                        </Button>
                      </Group>
                    </Group>
                  </Paper>
                )}

                {/* Mobil Kart Görünümü */}
                {isMobile && isMounted ? (
                  <Stack gap="sm">
                    {filteredStoklar.map((item) => (
                      <Paper
                        key={item.id}
                        p="sm"
                        radius="md"
                        withBorder
                        style={{
                          borderLeft: `3px solid ${
                            item.durum === 'kritik'
                              ? 'var(--mantine-color-red-5)'
                              : item.durum === 'dusuk'
                                ? 'var(--mantine-color-orange-5)'
                                : 'var(--mantine-color-green-5)'
                          }`,
                          background: selectedStoklar.includes(item.id)
                            ? 'var(--mantine-color-blue-0)'
                            : undefined,
                        }}
                      >
                        <Group justify="space-between" mb="xs">
                          <Group gap="xs">
                            <Checkbox
                              size="sm"
                              checked={selectedStoklar.includes(item.id)}
                              onChange={() => handleSelectStok(item.id)}
                            />
                            <Badge size="xs" variant="light">
                              {item.kod}
                            </Badge>
                          </Group>
                          <Badge
                            size="xs"
                            color={
                              item.durum === 'kritik'
                                ? 'red'
                                : item.durum === 'dusuk'
                                  ? 'orange'
                                  : item.durum === 'fazla'
                                    ? 'blue'
                                    : 'green'
                            }
                          >
                            {item.durum.toUpperCase()}
                          </Badge>
                        </Group>

                        <Text
                          fw={600}
                          size="sm"
                          mb="xs"
                          onClick={() => loadUrunDetay(item.id)}
                          c="blue"
                          style={{ cursor: 'pointer' }}
                        >
                          {item.ad}
                        </Text>

                        <Group justify="space-between" mb="xs">
                          <Text size="xs" c="dimmed">
                            {item.kategori}
                          </Text>
                          <Text size="sm" fw={600}>
                            {formatMiktar(item.toplam_stok)} {item.birim}
                          </Text>
                        </Group>

                        <Group justify="space-between" align="center">
                          <Text size="xs" c="dimmed">
                            {item.son_alis_fiyat
                              ? `${formatMoney(item.son_alis_fiyat, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}/${item.birim}`
                              : '-'}
                          </Text>
                          <Group gap="xs">
                            {(item.durum === 'kritik' || item.durum === 'dusuk') && (
                              <ActionIcon
                                variant="filled"
                                color="blue"
                                size="md"
                                onClick={() =>
                                  router.push(
                                    `/muhasebe/satin-alma?urun=${encodeURIComponent(item.ad)}&miktar=${item.min_stok - item.toplam_stok}`
                                  )
                                }
                              >
                                <IconShoppingCart size={14} />
                              </ActionIcon>
                            )}
                            <ActionIcon
                              variant="subtle"
                              color="green"
                              size="md"
                              onClick={() => {
                                setTransferForm({ ...transferForm, stok_kart_id: item.id });
                                openTransfer();
                              }}
                            >
                              <IconArrowsExchange size={14} />
                            </ActionIcon>
                            {canDeleteStok && (
                              <ActionIcon
                                variant="subtle"
                                color="red"
                                size="md"
                                onClick={() => {
                                  if (confirm(`"${item.ad}" ürününü silmek?`))
                                    handleDeleteStok(item.id);
                                }}
                              >
                                <IconTrash size={14} />
                              </ActionIcon>
                            )}
                          </Group>
                        </Group>
                      </Paper>
                    ))}
                  </Stack>
                ) : (
                  /* Desktop Tablo Görünümü */
                  <ScrollArea>
                    <Table>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th w={40}>
                            <Checkbox
                              checked={
                                selectedStoklar.length === filteredStoklar.length &&
                                filteredStoklar.length > 0
                              }
                              indeterminate={
                                selectedStoklar.length > 0 &&
                                selectedStoklar.length < filteredStoklar.length
                              }
                              onChange={handleSelectAll}
                            />
                          </Table.Th>
                          <Table.Th>Kod</Table.Th>
                          <Table.Th>Ürün Adı</Table.Th>
                          <Table.Th>Kategori</Table.Th>
                          <Table.Th>Stok</Table.Th>
                          <Table.Th>Birim Fiyat</Table.Th>
                          <Table.Th>Durum</Table.Th>
                          <Table.Th>Değer</Table.Th>
                          <Table.Th style={{ width: 120 }}>İşlemler</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {filteredStoklar.map((item) => (
                          <Table.Tr
                            key={item.id}
                            bg={selectedStoklar.includes(item.id) ? 'blue.0' : undefined}
                          >
                            <Table.Td>
                              <Checkbox
                                checked={selectedStoklar.includes(item.id)}
                                onChange={() => handleSelectStok(item.id)}
                              />
                            </Table.Td>
                            <Table.Td>
                              <Group gap={4}>
                                <Badge variant="light">{item.kod}</Badge>
                                {item.kod?.startsWith('FAT-') && (
                                  <Badge size="xs" variant="dot" color="violet">
                                    Faturadan
                                  </Badge>
                                )}
                              </Group>
                            </Table.Td>
                            <Table.Td>
                              <Text
                                fw={500}
                                style={{ cursor: 'pointer' }}
                                c="blue"
                                onClick={() => loadUrunDetay(item.id)}
                              >
                                {item.ad}
                              </Text>
                            </Table.Td>
                            <Table.Td>{item.kategori}</Table.Td>
                            <Table.Td>
                              {formatMiktar(item.toplam_stok)} {item.birim}
                            </Table.Td>
                            <Table.Td>
                              <Group gap={4}>
                                <Text size="sm" fw={500} c="blue">
                                  {item.son_alis_fiyat
                                    ? `${formatMoney(item.son_alis_fiyat, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}/${item.birim}`
                                    : '-'}
                                </Text>
                                {item.aktif_fiyat_tipi && (
                                  <Tooltip label={`Güven: %${item.aktif_fiyat_guven || 0}`}>
                                    <Badge
                                      size="xs"
                                      variant="dot"
                                      color={
                                        item.aktif_fiyat_tipi === 'SOZLESME'
                                          ? 'blue'
                                          : item.aktif_fiyat_tipi === 'FATURA'
                                            ? 'green'
                                            : item.aktif_fiyat_tipi === 'PIYASA'
                                              ? 'cyan'
                                              : 'gray'
                                      }
                                    >
                                      {item.aktif_fiyat_tipi === 'SOZLESME'
                                        ? 'SÖZ'
                                        : item.aktif_fiyat_tipi === 'FATURA'
                                          ? 'FTR'
                                          : item.aktif_fiyat_tipi === 'PIYASA'
                                            ? 'PYS'
                                            : item.aktif_fiyat_tipi === 'MANUEL'
                                              ? 'MNL'
                                              : 'VRS'}
                                    </Badge>
                                  </Tooltip>
                                )}
                              </Group>
                            </Table.Td>
                            <Table.Td>
                              <Badge
                                color={
                                  item.durum === 'kritik'
                                    ? 'red'
                                    : item.durum === 'dusuk'
                                      ? 'orange'
                                      : item.durum === 'fazla'
                                        ? 'blue'
                                        : 'green'
                                }
                              >
                                {item.durum.toUpperCase()}
                              </Badge>
                            </Table.Td>
                            <Table.Td>
                              {formatMoney(item.toplam_stok * item.son_alis_fiyat, {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0,
                              })}
                            </Table.Td>
                            <Table.Td>
                              <Group gap="xs">
                                {(item.durum === 'kritik' || item.durum === 'dusuk') && (
                                  <ActionIcon
                                    variant="filled"
                                    color="blue"
                                    size="sm"
                                    onClick={() =>
                                      router.push(
                                        `/muhasebe/satin-alma?urun=${encodeURIComponent(item.ad)}&miktar=${item.min_stok - item.toplam_stok}`
                                      )
                                    }
                                    title="Sipariş Ver"
                                  >
                                    <IconShoppingCart size={16} />
                                  </ActionIcon>
                                )}
                                <ActionIcon
                                  variant="subtle"
                                  color="green"
                                  size="sm"
                                  onClick={() => {
                                    setTransferForm({
                                      ...transferForm,
                                      stok_kart_id: item.id,
                                    });
                                    openTransfer();
                                  }}
                                  title="Transfer"
                                >
                                  <IconArrowsExchange size={16} />
                                </ActionIcon>
                                {canDeleteStok && (
                                  <ActionIcon
                                    variant="subtle"
                                    color="red"
                                    size="sm"
                                    onClick={() => {
                                      if (
                                        confirm(
                                          `"${item.ad}" ürününü silmek istediğinizden emin misiniz?`
                                        )
                                      ) {
                                        handleDeleteStok(item.id);
                                      }
                                    }}
                                    title="Sil"
                                  >
                                    <IconTrash size={16} />
                                  </ActionIcon>
                                )}
                              </Group>
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </ScrollArea>
                )}
              </Box>
            </Tabs>
          </Card>
        </Grid.Col>
      </Grid>

      {/* Depo Yönetim Modal */}
      <DepoModal
        opened={depoModalOpened}
        onClose={() => {
          setDepoModalOpened(false);
          setEditingDepo(null);
          setDepoForm({
            ad: '',
            kod: '',
            tur: 'genel',
            adres: '',
            telefon: '',
            email: '',
            yetkili: '',
            kapasite_m3: 0,
          });
        }}
        editingDepo={editingDepo}
        depoForm={depoForm}
        setDepoForm={setDepoForm}
        onSave={handleSaveDepo}
        loading={loading}
      />

      {/* Transfer Modal */}
      <TransferModal
        opened={transferOpened}
        onClose={closeTransfer}
        transferForm={transferForm}
        setTransferForm={setTransferForm}
        stoklar={stoklar}
        depolar={depolar}
        onTransfer={handleTransfer}
        loading={loading}
      />

      {/* Stok Girişi Modal */}
      <StokGirisModal
        opened={stokGirisModalOpened}
        onClose={() => setStokGirisModalOpened(false)}
        girisForm={girisForm}
        setGirisForm={setGirisForm}
        stoklar={stoklar}
        depolar={depolar}
        onGiris={handleStokGiris}
        loading={loading}
      />

      {/* Stok Çıkışı Modal */}
      <StokCikisModal
        opened={stokCikisModalOpened}
        onClose={() => setStokCikisModalOpened(false)}
        cikisForm={cikisForm}
        setCikisForm={setCikisForm}
        stoklar={stoklar}
        depolar={depolar}
        onCikis={handleStokCikis}
        loading={loading}
      />

      {/* Stok Sayımı Modal */}
      <SayimModal
        opened={sayimModalOpened}
        onClose={() => {
          setSayimModalOpened(false);
          setSayimVerileri({});
          setSayimDepoId(null);
        }}
        depolar={depolar}
        filteredStoklar={filteredStoklar}
        sayimDepoId={sayimDepoId}
        sayimVerileri={sayimVerileri}
        setSayimVerileri={setSayimVerileri}
        onDepoSelect={loadSayimVerileri}
        onSave={handleSayimKaydet}
        loading={loading}
      />

      {/* Stok Hareketleri Modal */}
      <HareketlerModal
        opened={hareketlerModalOpened}
        onClose={() => setHareketlerModalOpened(false)}
        hareketler={hareketler}
        loading={hareketlerLoading}
      />

      {/* Yeni Ürün Modal */}
      <YeniUrunModal
        opened={opened}
        onClose={close}
        urunForm={urunForm}
        setUrunForm={setUrunForm}
        kategoriler={kategoriler}
        birimler={birimler}
        onSave={handleSaveUrun}
        loading={loading}
      />

      {/* Ürün Detay Modal - Ortak Bileşen */}
      <UrunDetayModal
        opened={detayModalOpened}
        onClose={() => {
          setDetayModalOpened(false);
          setDetayUrunId(null);
        }}
        urunId={detayUrunId}
      />

      {/* Tüm Ürün Kartları Modal */}
      <UrunKartlariModal
        opened={urunKartlariModalOpened}
        onClose={() => setUrunKartlariModalOpened(false)}
      />

      <FaturaIslemModal
        opened={faturaModalOpened}
        onClose={() => {
          setFaturaModalOpened(false);
          setSelectedFatura(null);
          setFaturaKalemler([]);
          setKalemEslestirme({});
          setFaturaOzet(null);
          setFaturaInfo(null);
        }}
        faturalar={faturalar}
        selectedFatura={selectedFatura}
        setSelectedFatura={setSelectedFatura}
        faturaKalemler={faturaKalemler}
        faturaOzet={faturaOzet}
        faturaInfo={faturaInfo}
        kalemEslestirme={kalemEslestirme}
        setKalemEslestirme={setKalemEslestirme}
        tumUrunler={tumUrunler}
        depolar={depolar}
        faturaGirisDepo={faturaGirisDepo}
        setFaturaGirisDepo={setFaturaGirisDepo}
        onFaturaSelect={loadFaturaKalemler}
        onFaturaStokGirisi={handleFaturaStokGirisi}
        onTopluFaturaIsle={handleTopluFaturaIsle}
        onFiyatGuncelle={handleFiyatGuncelle}
        onYeniUrunOlustur={handleYeniUrunOlustur}
        onManuelGirisAc={() => {
          setFaturaModalOpened(false);
          setTimeout(() => open(), 100);
        }}
        faturaLoading={faturaLoading}
        topluIslemLoading={topluIslemLoading}
      />
    </Container>
  );
}

export default function StokPage() {
  return (
    <Suspense fallback={<LoadingState loading={true} fullHeight message="Yükleniyor..." />}>
      <StokPageContent />
    </Suspense>
  );
}
