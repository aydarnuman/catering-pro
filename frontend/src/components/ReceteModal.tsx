'use client';

import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Center,
  Divider,
  Group,
  Menu,
  Modal,
  NumberInput,
  Paper,
  Progress,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconAlertCircle,
  IconArrowLeft,
  IconBook2,
  IconChartPie,
  IconCheck,
  IconChefHat,
  IconCurrencyLira,
  IconDotsVertical,
  IconEdit,
  IconPackages,
  IconPlus,
  IconScale,
  IconSearch,
  IconSparkles,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { useResponsive } from '@/hooks/useResponsive';
import { formatMoney } from '@/lib/formatters';
import { EmptyState, LoadingState } from '@/components/common';
import { menuPlanlamaAPI } from '@/lib/api/services/menu-planlama';
import { stokAPI } from '@/lib/api/services/stok';
import UrunKartlariModal from './UrunKartlariModal';

// API_URL kaldırıldı - menuPlanlamaAPI kullanılıyor

// Malzeme ikonları (ürün adına göre)
const getMalzemeIcon = (ad: string): string => {
  const adLower = ad.toLowerCase();
  if (
    adLower.includes('et') ||
    adLower.includes('kıyma') ||
    adLower.includes('kuzu') ||
    adLower.includes('dana')
  )
    return '🥩';
  if (adLower.includes('tavuk') || adLower.includes('piliç')) return '🍗';
  if (adLower.includes('balık') || adLower.includes('levrek') || adLower.includes('çipura'))
    return '🐟';
  if (adLower.includes('pirinç') || adLower.includes('bulgur') || adLower.includes('makarna'))
    return '🍚';
  if (adLower.includes('un') || adLower.includes('ekmek')) return '🍞';
  if (adLower.includes('yağ') || adLower.includes('zeytinyağ') || adLower.includes('tereyağ'))
    return '🧈';
  if (
    adLower.includes('süt') ||
    adLower.includes('yoğurt') ||
    adLower.includes('peynir') ||
    adLower.includes('kaymak')
  )
    return '🥛';
  if (adLower.includes('yumurta')) return '🥚';
  if (adLower.includes('domates') || adLower.includes('salça')) return '🍅';
  if (adLower.includes('soğan')) return '🧅';
  if (adLower.includes('sarımsak')) return '🧄';
  if (adLower.includes('biber')) return '🌶️';
  if (adLower.includes('patates')) return '🥔';
  if (adLower.includes('havuç')) return '🥕';
  if (adLower.includes('fasulye') || adLower.includes('nohut') || adLower.includes('mercimek'))
    return '🫘';
  if (adLower.includes('şeker')) return '🍬';
  if (adLower.includes('tuz')) return '🧂';
  if (adLower.includes('su')) return '💧';
  if (adLower.includes('limon')) return '🍋';
  if (adLower.includes('elma')) return '🍎';
  if (adLower.includes('muz')) return '🍌';
  if (adLower.includes('portakal')) return '🍊';
  return '📦';
};

// Birimler
const BIRIMLER = [
  { value: 'gr', label: 'Gram (gr)' },
  { value: 'kg', label: 'Kilogram (kg)' },
  { value: 'lt', label: 'Litre (lt)' },
  { value: 'ml', label: 'Mililitre (ml)' },
  { value: 'adet', label: 'Adet' },
  { value: 'porsiyon', label: 'Porsiyon' },
  { value: 'dilim', label: 'Dilim' },
  { value: 'tutam', label: 'Tutam' },
];

// Renk paleti (maliyet breakdown için)
const COLORS = [
  '#FF6B6B',
  '#4ECDC4',
  '#45B7D1',
  '#96CEB4',
  '#FFEAA7',
  '#DDA0DD',
  '#98D8C8',
  '#F7DC6F',
  '#BB8FCE',
  '#85C1E9',
];

interface Recete {
  id: number;
  kod: string;
  ad: string;
  kategori_id: number;
  kategori_adi: string;
  kategori_ikon: string;
  porsiyon_miktar: number;
  hazirlik_suresi: number;
  pisirme_suresi: number;
  kalori: number;
  tahmini_maliyet: number;
  malzeme_sayisi: number;
}

interface Malzeme {
  id: number;
  malzeme_adi: string;
  miktar: number;
  birim: string;
  stok_kart_id: number | null;
  stok_adi: string | null;
  stok_birim: string | null;
  urun_kart_id: number | null;
  urun_adi: string | null;
  urun_birim: string | null;
  birim_fiyat: number | null; // Stok kartından gelen birim fiyat
  sistem_fiyat: number | null;
  piyasa_fiyat: number | null;
  piyasa_detay?: {
    min: number;
    max: number;
    ort: number;
    tarih: string;
  };
  zorunlu: boolean;
  maliyet?: number; // Hesaplanan maliyet
}

interface ReceteDetay extends Recete {
  tarif: string;
  aciklama: string;
  malzemeler: Malzeme[];
  toplam_sistem_maliyet?: number;
  toplam_piyasa_maliyet?: number;
}

interface Kategori {
  id: number;
  kod: string;
  ad: string;
  ikon: string;
}

interface PiyasaUrun {
  id: number;
  stok_kart_id: number;
  urun_adi: string;
  son_sistem_fiyat: number;
  son_piyasa_fiyat: number;
  fark_yuzde: number;
  durum: string;
  birim: string;
}

interface Props {
  opened: boolean;
  onClose: () => void;
  onReceteSelect?: (recete: Recete) => void;
}

export default function ReceteModal({ opened, onClose, onReceteSelect }: Props) {
  // Responsive
  const { isMobile, isMounted } = useResponsive();

  // Mobil görünüm: liste mi detay mı
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list');

  // Ürün Kartları Modal
  const [urunKartlariModalOpened, setUrunKartlariModalOpened] = useState(false);

  // States
  const [receteler, setReceteler] = useState<Recete[]>([]);
  const [kategoriler, setKategoriler] = useState<Kategori[]>([]);
  const [piyasaUrunleri, setPiyasaUrunleri] = useState<PiyasaUrun[]>([]);
  const [loading, setLoading] = useState(false);

  // Filtreler
  const [aramaText, setAramaText] = useState('');
  const [selectedKategori, setSelectedKategori] = useState<string | null>(null);

  // Seçili reçete detayı
  const [selectedRecete, setSelectedRecete] = useState<ReceteDetay | null>(null);
  const [detayLoading, setDetayLoading] = useState(false);

  // Düzenleme modu
  const [editMode, setEditMode] = useState(false);
  const [editingRecete, setEditingRecete] = useState<Partial<ReceteDetay> | null>(null);

  // Stok Kartı Modal - Malzeme Ekleme
  const [showStokKartModal, setShowStokKartModal] = useState(false);
  const [stokKartArama, setStokKartArama] = useState('');
  const [selectedStokKart, setSelectedStokKart] = useState<PiyasaUrun | null>(null);
  const [miktarGirisi, setMiktarGirisi] = useState({ miktar: 100, birim: 'gr' });

  // Malzeme düzenleme
  const [editingMalzemeId, setEditingMalzemeId] = useState<number | null>(null);
  const [editingMalzemeData, setEditingMalzemeData] = useState<{
    miktar: number;
    birim: string;
    birim_fiyat: number | null;
  } | null>(null);

  // Yeni reçete modu
  const [showYeniRecete, setShowYeniRecete] = useState(false);
  const [yeniRecete, setYeniRecete] = useState({
    ad: '',
    kod: '',
    kategori_id: null as number | null,
    porsiyon_miktar: 1,
    hazirlik_suresi: 0,
    pisirme_suresi: 0,
    kalori: 0,
    tarif: '',
    aciklama: '',
  });

  // Kişi sayısı çarpanı
  const [kisiSayisi, setKisiSayisi] = useState<number>(1);
  
  // Toplu AI İşleme
  const [topluAiLoading, setTopluAiLoading] = useState(false);
  const [topluAiProgress, setTopluAiProgress] = useState({ current: 0, total: 0, currentName: '' });

  // Sayfa açılınca verileri yükle
  useEffect(() => {
    if (opened) {
      fetchReceteler();
      fetchKategoriler();
      fetchPiyasaUrunleri();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened]);

  // Reçeteleri getir (duplicate kontrolü ile)
  const fetchReceteler = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedKategori) params.append('kategori', selectedKategori);
      if (aramaText) params.append('arama', aramaText);
      params.append('limit', '200');

      const result = await menuPlanlamaAPI.getReceteler({
        kategori: selectedKategori || undefined,
        arama: aramaText || undefined,
        limit: 200,
      });
      if (result.success) {
        // Duplicate kontrolü: Aynı isimli reçetelerden sadece birini al (en yüksek ID'li)
        const normalizeKey = (str: string) => {
          return (str || '')
            .toUpperCase()
            .replace(/\s+/g, '') // Tüm boşlukları kaldır
            .replace(/[^\wÇĞİÖŞÜçğıöşü]/g, '') // Özel karakterleri kaldır
            .trim();
        };

        const uniqueMap = new Map<string, any>();

        result.data.forEach((recete: any) => {
          const key = normalizeKey(recete.ad || '');
          if (key && key.length > 0) {
            // Eğer key varsa, yoksa veya yeni ID daha büyükse ekle
            if (!uniqueMap.has(key) || recete.id > uniqueMap.get(key).id) {
              uniqueMap.set(key, recete);
            }
          }
        });

        const uniqueList = Array.from(uniqueMap.values()).sort((a, b) =>
          (a.ad || '').localeCompare(b.ad || '', 'tr', { sensitivity: 'base' })
        );

        setReceteler(uniqueList);
      }
    } catch (error) {
      console.error('Reçete listesi hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  // Kategorileri getir
  const fetchKategoriler = async () => {
    try {
      const result = await menuPlanlamaAPI.getKategoriler();
      if (result.success) {
        setKategoriler(result.data as unknown as Kategori[]);
      }
    } catch (error) {
      console.error('Kategori listesi hatası:', error);
    }
  };

  // Stok kartlarını getir (unique - aynı isimli ürünlerden sadece biri)
  const fetchPiyasaUrunleri = async () => {
    try {
      const result = await stokAPI.getKartlar({ limit: 500 });
      if (result.success) {
        // Unique: Aynı isimli ürünlerden sadece birini al (en yüksek ID'li)
        // Normalizasyon: Boşlukları tamamen kaldır, büyük harfe çevir, özel karakterleri temizle
        const normalizeKey = (str: string) => {
          return (str || '')
            .toUpperCase()
            .replace(/\s+/g, '') // Tüm boşlukları kaldır
            .replace(/[^\wÇĞİÖŞÜçğıöşü]/g, '') // Özel karakterleri kaldır (sadece harf/sayı)
            .trim();
        };

        const uniqueMap = new Map<string, any>();

        result.data.forEach((s: any) => {
          const key = normalizeKey(s.ad || '');
          if (key && key.length > 0) {
            // Eğer key varsa, yoksa veya yeni ID daha büyükse ekle
            if (!uniqueMap.has(key) || s.id > uniqueMap.get(key).id) {
              uniqueMap.set(key, s);
            }
          }
        });

        const uniqueList = Array.from(uniqueMap.values()).sort((a, b) =>
          (a.ad || '').localeCompare(b.ad || '', 'tr', { sensitivity: 'base' })
        );

        setPiyasaUrunleri(
          uniqueList.map((s: any) => ({
            id: s.id,
            stok_kart_id: s.id,
            urun_adi: s.ad,
            son_sistem_fiyat: parseFloat(s.son_alis_fiyat) || 0,
            son_piyasa_fiyat: parseFloat(s.son_alis_fiyat) || 0,
            fark_yuzde: 0,
            durum: s.durum || 'bilinmiyor',
            birim: s.birim || 'kg',
          }))
        );
      }
    } catch (error) {
      console.error('Stok kartları hatası:', error);
    }
  };

  // Reçete detayını getir (maliyet hesaplamalı)
  const fetchReceteDetay = async (id: number) => {
    setDetayLoading(true);
    try {
      // Maliyet analizi endpoint'ini kullan - piyasa fiyatlarını içerir
      const result = await menuPlanlamaAPI.getMaliyetAnalizi(id) as any;

      if (result.success) {
        // Malzeme maliyetlerini hesapla
        // Son fiyat = (fatura + piyasa) / 2 veya mevcut olan
        const malzemelerWithCost =
          (result.data?.malzemeler || []).map((m: any) => {
            const faturaFiyat = m.sistem_fiyat || 0;
            const piyasaFiyat = m.piyasa_fiyat || 0;
            // Son fiyat: her ikisi varsa ortalama, yoksa mevcut olan
            const sonFiyat =
              faturaFiyat && piyasaFiyat
                ? (faturaFiyat + piyasaFiyat) / 2
                : piyasaFiyat || faturaFiyat || 0;
            const fiyat = sonFiyat;
            const birim = (m.birim || '').toLowerCase();
            let maliyet = 0;

            // Birim dönüşümü: gram/ml için kg/lt fiyatını kullan
            if (['g', 'gr', 'ml'].includes(birim)) {
              maliyet = (m.miktar / 1000) * fiyat;
            } else {
              maliyet = m.miktar * fiyat;
            }

            return { ...m, maliyet };
          }) || [];

        // Toplam maliyetleri hesapla
        const toplamPiyasa = malzemelerWithCost.reduce(
          (sum: number, m: any) => sum + (m.maliyet || 0),
          0
        );

        setSelectedRecete({
          ...result.data,
          malzemeler: malzemelerWithCost,
          toplam_piyasa_maliyet: toplamPiyasa,
        } as any);
        setEditingRecete(result.data as any);
      } else {
        // Fallback: normal endpoint
        const fallbackResult = await menuPlanlamaAPI.getRecete(id) as any;
        if (fallbackResult.success) {
          setSelectedRecete(fallbackResult.data as any);
          setEditingRecete(fallbackResult.data as any);
        }
      }
    } catch (_error) {
      notifications.show({
        title: 'Hata',
        message: 'Reçete detayı yüklenemedi',
        color: 'red',
      });
    } finally {
      setDetayLoading(false);
    }
  };

  // Arama/filtreleme değişince tekrar fetch
  useEffect(() => {
    if (opened) {
      const timer = setTimeout(() => {
        fetchReceteler();
      }, 300);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, aramaText, selectedKategori]);

  // Reçete güncelle
  const handleReceteGuncelle = async () => {
    if (!editingRecete || !selectedRecete) return;

    try {
      const result = await menuPlanlamaAPI.updateRecete(selectedRecete.id, editingRecete as any);

      if (result.success) {
        notifications.show({
          title: 'Başarılı',
          message: 'Reçete güncellendi',
          color: 'green',
        });
        setEditMode(false);
        fetchReceteDetay(selectedRecete.id);
        fetchReceteler();
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      notifications.show({
        title: 'Hata',
        message: error.message || 'Güncelleme başarısız',
        color: 'red',
      });
    }
  };

  // Malzeme ekleme loading state
  const [malzemeEklemeLoading, setMalzemeEklemeLoading] = useState(false);
  const [aiMalzemeLoading, setAiMalzemeLoading] = useState(false);

  // Stok kartı seçildi - miktar girişine geç
  const handleStokKartSec = (stokKart: PiyasaUrun) => {
    setSelectedStokKart(stokKart);
    // Varsayılan birim: kg/lt için gr/ml, adet için adet
    const birimLower = stokKart.birim?.toLowerCase() || 'kg';
    if (birimLower === 'kg') {
      setMiktarGirisi({ miktar: 100, birim: 'gr' });
    } else if (['lt', 'l'].includes(birimLower)) {
      setMiktarGirisi({ miktar: 100, birim: 'ml' });
    } else {
      setMiktarGirisi({ miktar: 1, birim: 'adet' });
    }
  };

  // Maliyet hesapla
  const hesaplaMaliyet = (
    miktar: number,
    birim: string,
    birimFiyat: number,
    anaBirim: string
  ): number => {
    const birimLower = birim.toLowerCase();
    const anaBirimLower = anaBirim?.toLowerCase() || 'kg';

    // gr → kg veya ml → lt dönüşümü
    if (['gr', 'g'].includes(birimLower) && anaBirimLower === 'kg') {
      return (miktar / 1000) * birimFiyat;
    } else if (['ml'].includes(birimLower) && ['lt', 'l'].includes(anaBirimLower)) {
      return (miktar / 1000) * birimFiyat;
    } else {
      return miktar * birimFiyat;
    }
  };

  // Malzeme ekle (modaldan)
  const handleMalzemeEkleFromModal = async () => {
    if (!selectedRecete || !selectedStokKart) return;

    const fiyat = selectedStokKart.son_sistem_fiyat || 0;
    if (fiyat <= 0) {
      notifications.show({
        title: 'Hata',
        message: 'Bu ürünün fiyatı yok',
        color: 'red',
      });
      return;
    }

    setMalzemeEklemeLoading(true);

    try {
      const result = await menuPlanlamaAPI.saveMalzeme(selectedRecete.id, {
        stok_kart_id: selectedStokKart.stok_kart_id,
        urun_adi: selectedStokKart.urun_adi,
        miktar: miktarGirisi.miktar,
        birim: miktarGirisi.birim,
        sistem_fiyat: fiyat,
      });

      if (result.success) {
        const maliyet = hesaplaMaliyet(
          miktarGirisi.miktar,
          miktarGirisi.birim,
          fiyat,
          selectedStokKart.birim
        );
        notifications.show({
          message: `✅ ${selectedStokKart.urun_adi} (${miktarGirisi.miktar} ${miktarGirisi.birim}) = ₺${maliyet.toFixed(2)}`,
          color: 'green',
          autoClose: 2000,
        });
        // Modalı kapat ve sıfırla
        setSelectedStokKart(null);
        setShowStokKartModal(false);
        setStokKartArama('');
        fetchReceteDetay(selectedRecete.id);
        fetchReceteler();
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      notifications.show({
        title: 'Hata',
        message: error.message || 'Malzeme eklenemedi',
        color: 'red',
      });
    } finally {
      setMalzemeEklemeLoading(false);
    }
  };

  // AI ile malzeme önerisi ve otomatik ekleme (Ürün Kartlarından)
  const handleAiMalzemeOneri = async () => {
    if (!selectedRecete) return;

    setAiMalzemeLoading(true);

    try {
      const result = await menuPlanlamaAPI.getAiMalzemeOneri(selectedRecete.id, '');

      if (result.success && result.data.malzemeler && result.data.malzemeler.length > 0) {
        // AI'dan gelen malzemeleri teker teker ekle
        let basarili = 0;
        let basarisiz = 0;

        for (const mal of result.data.malzemeler) {
          try {
            // Ürün kartı ID'si varsa kullan, yoksa yeni ürün kartı oluştur
            let urunKartId = mal.urun_kart_id;

            if (!urunKartId) {
              // Kategori ID'sini bul (AI'dan gelen kategori adına göre)
              const kategoriMap: Record<string, number> = {
                'et & tavuk': 1,
                et: 1,
                tavuk: 1,
                'balık & deniz ürünleri': 2,
                balık: 2,
                'deniz ürünleri': 2,
                'süt ürünleri': 3,
                süt: 3,
                sebzeler: 4,
                sebze: 4,
                meyveler: 5,
                meyve: 5,
                bakliyat: 6,
                'tahıllar & makarna': 7,
                tahıl: 7,
                makarna: 7,
                yağlar: 8,
                yağ: 8,
                baharatlar: 9,
                baharat: 9,
                'soslar & salçalar': 10,
                sos: 10,
                salça: 10,
                'şekerler & tatlandırıcılar': 11,
                şeker: 11,
                içecekler: 12,
                içecek: 12,
                diğer: 13,
              };

              const kategoriId = mal.kategori ? kategoriMap[mal.kategori.toLowerCase()] || 13 : 13;

              // Yeni ürün kartı oluştur (kategori ile birlikte)
              const urunResult = await menuPlanlamaAPI.createUrunKarti({
                ad: mal.malzeme_adi,
                kategori_id: kategoriId,
                varsayilan_birim: mal.birim || 'gr',
                fiyat_birimi: 'kg',
              });

              if (urunResult.success) {
                urunKartId = urunResult.data.id;
              }
            }

            // Malzemeyi reçeteye ekle
            const malResult = await menuPlanlamaAPI.saveMalzeme(selectedRecete.id, {
              urun_kart_id: urunKartId,
              urun_adi: mal.onerilen_urun_adi || mal.malzeme_adi,
              miktar: mal.miktar,
              birim: mal.birim || 'gr',
            });

            if (malResult.success) {
              basarili++;
            } else {
              basarisiz++;
            }
          } catch (error: any) {
            console.error(`Malzeme ekleme hatası (${mal.malzeme_adi}):`, error);
            basarisiz++;
          }
        }

        notifications.show({
          title: 'AI Malzeme Önerisi',
          message: `✅ ${basarili} malzeme eklendi${basarisiz > 0 ? `, ${basarisiz} başarısız` : ''}`,
          color: basarisiz === 0 ? 'green' : 'yellow',
          autoClose: 3000,
        });

        // Reçete detayını yenile
        fetchReceteDetay(selectedRecete.id);
        fetchReceteler();
      } else {
        throw new Error('AI malzeme önerisi alınamadı');
      }
    } catch (error: any) {
      notifications.show({
        title: 'Hata',
        message: error.message || 'AI malzeme önerisi başarısız',
        color: 'red',
      });
    } finally {
      setAiMalzemeLoading(false);
    }
  };

  // TOPLU AI REÇETELENDİRME (BATCH + PARALEL - 5x3 = 15 reçete aynı anda)
  const handleTopluAiRecetelendirme = async () => {
    // Malzemesi olmayan reçeteleri filtrele
    const malzemesizReceteler = receteler.filter(r => Number(r.malzeme_sayisi) === 0);
    
    if (malzemesizReceteler.length === 0) {
      notifications.show({
        title: 'Bilgi',
        message: 'Tüm reçetelerin malzemesi mevcut',
        color: 'blue',
      });
      return;
    }
    
    if (!confirm(`${malzemesizReceteler.length} reçete için AI ile malzeme önerisi alınacak (hızlı mod). Devam?`)) {
      return;
    }
    
    setTopluAiLoading(true);
    setTopluAiProgress({ current: 0, total: malzemesizReceteler.length, currentName: '🚀 Hızlı mod başlatılıyor...' });
    
    let basarili = 0;
    let basarisiz = 0;
    
    // Kategori map (ürün kartı oluşturmak için)
    const kategoriMap: Record<string, number> = {
      'et & tavuk': 1, et: 1, tavuk: 1,
      'balık & deniz ürünleri': 2, balık: 2,
      'süt ürünleri': 3, süt: 3,
      sebzeler: 4, sebze: 4,
      meyveler: 5, meyve: 5,
      bakliyat: 6,
      'tahıllar & makarna': 7, tahıl: 7, makarna: 7,
      yağlar: 8, yağ: 8,
      baharatlar: 9, baharat: 9,
      'soslar & salçalar': 10, sos: 10, salça: 10,
      'şekerler & tatlandırıcılar': 11, şeker: 11,
      içecekler: 12, içecek: 12,
      diğer: 13,
    };
    
    // 3'lü batch'lere böl (timeout önlemek için küçültüldü)
    const BATCH_SIZE = 3;
    const CONCURRENT_BATCHES = 2; // 2 batch paralel
    const batches: Recete[][] = [];
    
    for (let i = 0; i < malzemesizReceteler.length; i += BATCH_SIZE) {
      batches.push(malzemesizReceteler.slice(i, i + BATCH_SIZE));
    }
    
    // Tek bir batch'i işle
    const processBatch = async (batch: Recete[]): Promise<{ success: number; fail: number }> => {
      try {
        const receteIds = batch.map(r => r.id);
        
        // AbortController ile 90 saniye timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 90000);
        
        // BATCH AI çağrısı (5 reçete birden)
        // Timeout için Promise.race kullanıyoruz
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            controller.abort();
            reject(new Error('Timeout'));
          }, 90000);
        });

        const result = await Promise.race([
          menuPlanlamaAPI.batchAiMalzemeOneri(receteIds),
          timeoutPromise,
        ]);

        clearTimeout(timeoutId);
        
        if (!result.success || !result.data?.sonuclar) {
          return { success: 0, fail: batch.length };
        }
        
        let batchBasarili = 0;
        let batchBasarisiz = 0;
        
        // Her reçetenin sonucunu işle (paralel)
        await Promise.all(result.data.sonuclar.map(async (sonuc: any) => {
          try {
            if (!sonuc.malzemeler || sonuc.malzemeler.length === 0) {
              batchBasarisiz++;
              return;
            }
            
            // Malzemeleri paralel ekle
            await Promise.all(sonuc.malzemeler.map(async (mal: any) => {
              try {
                let urunKartId = mal.urun_kart_id;
                
                if (!urunKartId) {
                  const kategoriId = mal.kategori ? kategoriMap[mal.kategori.toLowerCase()] || 13 : 13;

                  const urunResult = await menuPlanlamaAPI.createUrunKarti({
                    ad: mal.malzeme_adi,
                    kategori_id: kategoriId,
                    varsayilan_birim: mal.birim || 'gr',
                    fiyat_birimi: 'kg',
                  });
                  if (urunResult.success) {
                    urunKartId = urunResult.data.id;
                  }
                }

                await menuPlanlamaAPI.saveMalzeme(sonuc.recete_id, {
                  urun_kart_id: urunKartId,
                  urun_adi: mal.malzeme_adi,
                  miktar: mal.miktar,
                  birim: mal.birim || 'gr',
                });
              } catch (e) {
                // Tek malzeme hatası, devam
              }
            }));
            
            batchBasarili++;
          } catch (e) {
            batchBasarisiz++;
          }
        }));
        
        return { success: batchBasarili, fail: batchBasarisiz };
      } catch (e) {
        return { success: 0, fail: batch.length };
      }
    };
    
    // Batch'leri CONCURRENT_BATCHES kadar paralel işle
    let processedCount = 0;
    
    try {
      for (let i = 0; i < batches.length; i += CONCURRENT_BATCHES) {
        const concurrentBatches = batches.slice(i, i + CONCURRENT_BATCHES);
        
        // İşlenen reçete isimlerini göster
        const isimleri = concurrentBatches.flat().map(r => r.ad).slice(0, 3).join(', ');
        setTopluAiProgress({ 
          current: processedCount, 
          total: malzemesizReceteler.length, 
          currentName: `⚡ ${isimleri}...` 
        });
        
        // Paralel batch işleme
        const results = await Promise.all(concurrentBatches.map(batch => processBatch(batch)));
        
        // Sonuçları topla
        results.forEach(r => {
          basarili += r.success;
          basarisiz += r.fail;
        });
        
        processedCount += concurrentBatches.flat().length;
        setTopluAiProgress({ 
          current: processedCount, 
          total: malzemesizReceteler.length, 
          currentName: `✅ ${processedCount}/${malzemesizReceteler.length}` 
        });
      }
      
      notifications.show({
        title: '🚀 Hızlı Reçetelendirme Tamamlandı',
        message: `✅ ${basarili} başarılı, ❌ ${basarisiz} başarısız`,
        color: basarisiz === 0 ? 'green' : 'yellow',
        autoClose: 5000,
      });
    } catch (error: any) {
      // Timeout veya abort hatası
      notifications.show({
        title: '⚠️ İşlem Durdu',
        message: `${basarili} tamamlandı, kalan reçeteler için tekrar deneyin`,
        color: 'orange',
        autoClose: 5000,
      });
    }
    
    setTopluAiLoading(false);
    setTopluAiProgress({ current: 0, total: 0, currentName: '' });
    
    // Listeyi güncelle (hata olsa bile)
    try {
      await fetchReceteler();
    } catch (e) {
      // Fetch hatası ignore et
    }
  };

  // Malzeme düzenlemeye başla
  const handleMalzemeDuzenleBasla = (malzeme: Malzeme) => {
    setEditingMalzemeId(malzeme.id);

    // Fiyat: Önce stok kartından, sonra birim_fiyat, son diğerleri
    let fiyat = null;
    if (malzeme.stok_kart_id) {
      const stokKart = piyasaUrunleri.find((s) => s.stok_kart_id === malzeme.stok_kart_id);
      if (stokKart && stokKart.son_sistem_fiyat > 0) {
        fiyat = stokKart.son_sistem_fiyat;
      }
    }
    if (!fiyat) {
      fiyat = malzeme.birim_fiyat || malzeme.piyasa_fiyat || malzeme.sistem_fiyat || null;
    }

    setEditingMalzemeData({
      miktar: malzeme.miktar,
      birim: malzeme.birim,
      birim_fiyat: fiyat,
    });
  };

  // Malzeme düzenlemeyi kaydet
  const handleMalzemeDuzenleKaydet = async () => {
    if (!editingMalzemeId || !editingMalzemeData || !selectedRecete) return;

    try {
      const result = await menuPlanlamaAPI.updateMalzeme(editingMalzemeId, editingMalzemeData);

      if (result.success) {
        notifications.show({
          message: 'Malzeme güncellendi',
          color: 'green',
          autoClose: 1500,
        });
        setEditingMalzemeId(null);
        setEditingMalzemeData(null);
        fetchReceteDetay(selectedRecete.id);
        fetchReceteler();
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      notifications.show({
        title: 'Hata',
        message: error.message || 'Güncelleme başarısız',
        color: 'red',
      });
    }
  };

  // Malzeme düzenlemeyi iptal
  const handleMalzemeDuzenleIptal = () => {
    setEditingMalzemeId(null);
    setEditingMalzemeData(null);
  };

  // Malzeme sil
  const handleMalzemeSil = async (malzemeId: number) => {
    if (!selectedRecete) return;

    try {
      const result = await menuPlanlamaAPI.deleteMalzeme(malzemeId);

      if (result.success) {
        notifications.show({
          title: 'Başarılı',
          message: 'Malzeme silindi',
          color: 'green',
        });
        fetchReceteDetay(selectedRecete.id);
        fetchReceteler();
      }
    } catch (_error) {
      notifications.show({
        title: 'Hata',
        message: 'Malzeme silinemedi',
        color: 'red',
      });
    }
  };

  // Yeni reçete oluştur
  const handleYeniReceteOlustur = async () => {
    if (!yeniRecete.ad || !yeniRecete.kategori_id) {
      notifications.show({
        title: 'Hata',
        message: 'Reçete adı ve kategorisi gerekli',
        color: 'red',
      });
      return;
    }

    try {
      const kod =
        yeniRecete.kod ||
        yeniRecete.ad
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9-]/g, '');

      const result = await menuPlanlamaAPI.createRecete({ ...yeniRecete, kod } as any);

      if (result.success) {
        notifications.show({
          title: 'Başarılı',
          message: 'Reçete oluşturuldu',
          color: 'green',
        });
        setShowYeniRecete(false);
        setYeniRecete({
          ad: '',
          kod: '',
          kategori_id: null,
          porsiyon_miktar: 1,
          hazirlik_suresi: 0,
          pisirme_suresi: 0,
          kalori: 0,
          tarif: '',
          aciklama: '',
        });
        fetchReceteler();
        fetchReceteDetay(result.data.id);
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      notifications.show({
        title: 'Hata',
        message: error.message || 'Reçete oluşturulamadı',
        color: 'red',
      });
    }
  };

  // Reçete sil
  const handleReceteSil = async (id: number) => {
    if (!confirm('Bu reçeteyi silmek istediğinizden emin misiniz?')) return;

    try {
      const result = await menuPlanlamaAPI.deleteRecete(id);

      if (result.success) {
        notifications.show({
          title: 'Başarılı',
          message: 'Reçete silindi',
          color: 'green',
        });
        setSelectedRecete(null);
        fetchReceteler();
      }
    } catch (_error) {
      notifications.show({
        title: 'Hata',
        message: 'Reçete silinemedi',
        color: 'red',
      });
    }
  };

  // Maliyet breakdown hesapla
  const getMaliyetBreakdown = () => {
    if (!selectedRecete?.malzemeler) return [];

    const total = selectedRecete.malzemeler.reduce((sum, m) => sum + (m.maliyet || 0), 0);
    if (total === 0) return [];

    return selectedRecete.malzemeler
      .filter((m) => (m.maliyet || 0) > 0)
      .map((m, i) => ({
        ad: m.malzeme_adi,
        maliyet: m.maliyet || 0,
        yuzde: ((m.maliyet || 0) / total) * 100,
        renk: COLORS[i % COLORS.length],
      }))
      .sort((a, b) => b.maliyet - a.maliyet);
  };

  // Piyasa fiyatı olmayan malzemeler
  const eksikFiyatlar =
    selectedRecete?.malzemeler?.filter((m) => !m.piyasa_fiyat && !m.sistem_fiyat) || [];

  // Mobilde reçete seçildiğinde detay görünümüne geç
  const handleReceteSecMobile = (id: number) => {
    fetchReceteDetay(id);
    if (isMobile && isMounted) {
      setMobileView('detail');
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="sm">
          {/* Mobilde geri butonu */}
          {isMobile && isMounted && mobileView === 'detail' && (
            <ActionIcon
              variant="subtle"
              onClick={() => {
                setMobileView('list');
                setSelectedRecete(null);
              }}
              mr={4}
            >
              <IconArrowLeft size={20} />
            </ActionIcon>
          )}
          <ThemeIcon
            size="lg"
            radius="xl"
            variant="gradient"
            gradient={{ from: 'orange', to: 'red' }}
          >
            <IconBook2 size={20} />
          </ThemeIcon>
          <Box>
            <Text fw={600} size={isMobile && isMounted ? 'md' : 'lg'}>
              {isMobile && isMounted && mobileView === 'detail' ? 'Reçete Detay' : 'Reçete Yönetimi'}
            </Text>
            <Text size="xs" c="dimmed">
              Piyasa fiyatlarıyla entegre
            </Text>
          </Box>
        </Group>
      }
      size={isMobile && isMounted ? '100%' : '95%'}
      fullScreen={isMobile && isMounted}
      styles={{
        body: { padding: 0 },
        content: { height: isMobile && isMounted ? '100vh' : '90vh' },
      }}
    >
      <Box style={{ display: 'flex', height: isMobile && isMounted ? 'calc(100vh - 60px)' : 'calc(90vh - 70px)', flexDirection: isMobile && isMounted ? 'column' : 'row' }}>
        {/* Sol Panel - Reçete Listesi (Desktop veya Mobile Liste Görünümü) */}
        {(!isMobile || !isMounted || mobileView === 'list') && (
        <Box
          style={{
            width: isMobile && isMounted ? '100%' : 320,
            borderRight: isMobile && isMounted ? 'none' : '1px solid var(--mantine-color-default-border)',
            display: 'flex',
            flexDirection: 'column',
            flex: isMobile && isMounted ? 1 : 'none',
          }}
        >
          {/* Arama ve Filtre */}
          <Box p="sm" style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
            <Stack gap="xs">
              <TextInput
                placeholder="Reçete ara..."
                leftSection={<IconSearch size={16} />}
                value={aramaText}
                onChange={(e) => setAramaText(e.target.value)}
                size="sm"
              />
              <Select
                placeholder="Kategori"
                data={kategoriler.map((k) => ({ value: k.kod, label: `${k.ikon} ${k.ad}` }))}
                value={selectedKategori}
                onChange={setSelectedKategori}
                clearable
                size="xs"
              />
              <Button
                variant="gradient"
                gradient={{ from: 'orange', to: 'red' }}
                leftSection={<IconPlus size={16} />}
                onClick={() => setShowYeniRecete(true)}
                size="xs"
                fullWidth
              >
                Yeni Reçete
              </Button>
              <Button
                variant="light"
                color="violet"
                leftSection={<IconPackages size={16} />}
                onClick={() => setUrunKartlariModalOpened(true)}
                size="xs"
                fullWidth
              >
                Ürün Kartları
              </Button>
              
              {/* Toplu AI Reçetelendirme */}
              {receteler.filter(r => Number(r.malzeme_sayisi) === 0).length > 0 && (
                <Tooltip label={`${receteler.filter(r => Number(r.malzeme_sayisi) === 0).length} malzemesiz reçeteyi AI ile doldur`}>
                  <Button
                    variant="gradient"
                    gradient={{ from: 'violet', to: 'grape' }}
                    leftSection={<IconSparkles size={16} />}
                    onClick={handleTopluAiRecetelendirme}
                    size="xs"
                    fullWidth
                    loading={topluAiLoading}
                    disabled={topluAiLoading}
                  >
                    {topluAiLoading 
                      ? `${topluAiProgress.current}/${topluAiProgress.total}` 
                      : `AI Toplu (${receteler.filter(r => Number(r.malzeme_sayisi) === 0).length})`
                    }
                  </Button>
                </Tooltip>
              )}
              
              {/* Progress bar */}
              {topluAiLoading && (
                <Box>
                  <Progress 
                    value={(topluAiProgress.current / topluAiProgress.total) * 100} 
                    size="sm" 
                    color="violet"
                    animated
                  />
                  <Text size="xs" c="dimmed" ta="center" mt={4} truncate>
                    {topluAiProgress.currentName}
                  </Text>
                </Box>
              )}
            </Stack>
          </Box>

          {/* Reçete Listesi */}
          <ScrollArea style={{ flex: 1 }}>
            {loading ? (
              <LoadingState loading={true} message="Reçeteler yükleniyor..." />
            ) : receteler.length === 0 ? (
              <EmptyState
                title="Reçete bulunamadı"
                compact
                icon={<IconBook2 size={32} />}
                iconColor="orange"
              />
            ) : (
              <Stack gap={0}>
                {receteler.map((recete) => {
                  const isSelected = selectedRecete?.id === recete.id;
                  return (
                    <Box
                      key={recete.id}
                      p="xs"
                      style={{
                        borderBottom: '1px solid var(--mantine-color-default-border)',
                        cursor: 'pointer',
                        background: isSelected ? 'var(--mantine-color-orange-light)' : undefined,
                        transition: 'background 0.15s',
                      }}
                      onClick={() => handleReceteSecMobile(recete.id)}
                    >
                      <Group justify="space-between" wrap="wrap">
                        <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                          <Text size="md">{recete.kategori_ikon || '📋'}</Text>
                          <Box style={{ flex: 1, minWidth: 0 }}>
                            <Text fw={500} size="sm" truncate>
                              {recete.ad}
                            </Text>
                            <Group gap={4}>
                              <Badge size="xs" variant="light" color="gray">
                                {recete.malzeme_sayisi} malzeme
                              </Badge>
                              {recete.tahmini_maliyet > 0 && (
                                <Badge size="xs" variant="filled" color="green">
                                  {formatMoney(recete.tahmini_maliyet)}
                                </Badge>
                              )}
                            </Group>
                          </Box>
                        </Group>
                        <Menu shadow="md" width={130} position="bottom-end">
                          <Menu.Target>
                            <ActionIcon
                              variant="subtle"
                              color="gray"
                              size="sm"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <IconDotsVertical size={14} />
                            </ActionIcon>
                          </Menu.Target>
                          <Menu.Dropdown>
                            <Menu.Item
                              leftSection={<IconEdit size={14} />}
                              onClick={(e) => {
                                e.stopPropagation();
                                fetchReceteDetay(recete.id);
                                setEditMode(true);
                              }}
                            >
                              Düzenle
                            </Menu.Item>
                            <Menu.Item
                              leftSection={<IconTrash size={14} />}
                              color="red"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleReceteSil(recete.id);
                              }}
                            >
                              Sil
                            </Menu.Item>
                          </Menu.Dropdown>
                        </Menu>
                      </Group>
                    </Box>
                  );
                })}
              </Stack>
            )}
          </ScrollArea>

          <Box
            p="xs"
            style={{
              borderTop: '1px solid var(--mantine-color-default-border)',
              background: 'var(--mantine-color-gray-light)',
            }}
          >
            <Text size="xs" c="dimmed" ta="center">
              {receteler.length} reçete · Piyasa fiyatlarıyla
            </Text>
          </Box>
        </Box>
        )}

        {/* Sağ Panel - Reçete Detay ve Maliyet (Desktop veya Mobile Detay Görünümü) */}
        {(!isMobile || !isMounted || mobileView === 'detail') && (
        <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {detayLoading ? (
            <LoadingState loading={true} fullHeight message="Reçete detayı yükleniyor..." />
          ) : !selectedRecete ? (
            <Center style={{ flex: 1 }}>
              <Stack align="center" gap="md">
                <ThemeIcon size={80} radius="xl" variant="light" color="gray">
                  <IconChefHat size={40} />
                </ThemeIcon>
                <Text c="dimmed">Detay görmek için bir reçete seçin</Text>
              </Stack>
            </Center>
          ) : (
            <>
              {/* Detay Header */}
              <Box p="md" style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
                <Group justify="space-between">
                  <Group gap="md">
                    <Text size="xl">{selectedRecete.kategori_ikon || '📋'}</Text>
                    <Box>
                      {editMode ? (
                        <TextInput
                          value={editingRecete?.ad || ''}
                          onChange={(e) =>
                            setEditingRecete({ ...editingRecete, ad: e.target.value })
                          }
                          size="md"
                          fw={600}
                        />
                      ) : (
                        <Text fw={600} size="lg">
                          {selectedRecete.ad}
                        </Text>
                      )}
                      <Group gap="xs">
                        <Badge variant="light" color="orange">
                          {selectedRecete.kategori_adi}
                        </Badge>
                        <Badge variant="light" color="gray">
                          Kod: {selectedRecete.kod}
                        </Badge>
                      </Group>
                    </Box>
                  </Group>
                  <Group>
                    {editMode ? (
                      <>
                        <Button
                          variant="light"
                          color="gray"
                          size="xs"
                          onClick={() => {
                            setEditMode(false);
                            setEditingRecete(selectedRecete);
                          }}
                        >
                          İptal
                        </Button>
                        <Button
                          variant="gradient"
                          gradient={{ from: 'teal', to: 'green' }}
                          size="xs"
                          leftSection={<IconCheck size={16} />}
                          onClick={handleReceteGuncelle}
                        >
                          Kaydet
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="light"
                          size="xs"
                          leftSection={<IconEdit size={16} />}
                          onClick={() => setEditMode(true)}
                        >
                          Düzenle
                        </Button>
                        {onReceteSelect && (
                          <Button
                            variant="gradient"
                            gradient={{ from: 'teal', to: 'cyan' }}
                            size="xs"
                            leftSection={<IconCheck size={16} />}
                            onClick={() => {
                              onReceteSelect(selectedRecete);
                              onClose();
                            }}
                          >
                            Seç
                          </Button>
                        )}
                      </>
                    )}
                  </Group>
                </Group>
              </Box>

              {/* Detay İçerik */}
              <ScrollArea style={{ flex: 1 }} p="md">
                <Stack gap="lg">
                  {/* MALİYET ANALİZİ KARTI */}
                  <Paper p="md" withBorder radius="lg" bg="var(--mantine-color-green-light)">
                    <Group justify="space-between" mb="md">
                      {(() => {
                        // Toplam maliyeti frontend'de hesapla (son fiyat = ortalama)
                        const hesaplananMaliyet =
                          selectedRecete.malzemeler?.reduce((toplam, m) => {
                            const faturaF = m.sistem_fiyat || 0;
                            const piyasaF = m.piyasa_fiyat || 0;
                            const fiyat =
                              faturaF && piyasaF
                                ? (faturaF + piyasaF) / 2
                                : piyasaF || faturaF || 0;
                            const miktar = Number(m.miktar) || 0;
                            const birimLower = (m.birim || '').toLowerCase();

                            let maliyet = 0;
                            if (['g', 'gr', 'ml'].includes(birimLower)) {
                              maliyet = (miktar / 1000) * Number(fiyat);
                            } else if (['kg', 'lt', 'l'].includes(birimLower)) {
                              maliyet = miktar * Number(fiyat);
                            } else {
                              maliyet = miktar * Number(fiyat);
                            }
                            return toplam + maliyet;
                          }, 0) || 0;

                        return (
                          <>
                            <Group gap="sm">
                              <ThemeIcon size="lg" radius="xl" color="green" variant="filled">
                                <IconCurrencyLira size={20} />
                              </ThemeIcon>
                              <Box>
                                <Text fw={600}>1 Porsiyon Maliyet</Text>
                                <Text size="xs" c="dimmed">
                                  Piyasa fiyatlarıyla hesaplandı
                                </Text>
                              </Box>
                            </Group>
                            <Text fw={700} size="xl" c="green">
                              {formatMoney(hesaplananMaliyet)}
                            </Text>
                          </>
                        );
                      })()}
                    </Group>

                    {/* Hızlı Hesap */}
                    {(() => {
                      // Toplam maliyeti frontend'de hesapla
                      const hesaplananMaliyet =
                        selectedRecete.malzemeler?.reduce((toplam, m) => {
                          const fiyat = m.piyasa_fiyat || m.sistem_fiyat || 0;
                          const miktar = Number(m.miktar) || 0;
                          const birimLower = (m.birim || '').toLowerCase();

                          let maliyet = 0;
                          if (['g', 'gr', 'ml'].includes(birimLower)) {
                            maliyet = (miktar / 1000) * Number(fiyat);
                          } else if (['kg', 'lt', 'l'].includes(birimLower)) {
                            maliyet = miktar * Number(fiyat);
                          } else {
                            maliyet = miktar * Number(fiyat);
                          }
                          return toplam + maliyet;
                        }, 0) || 0;

                      return (
                        <SimpleGrid cols={4} mb="md">
                          <Paper p="xs" radius="md" withBorder ta="center" bg="white">
                            <Text size="xs" c="dimmed">
                              100 Kişi
                            </Text>
                            <Text fw={600} size="sm" c="green">
                              {formatMoney(hesaplananMaliyet * 100)}
                            </Text>
                          </Paper>
                          <Paper p="xs" radius="md" withBorder ta="center" bg="white">
                            <Text size="xs" c="dimmed">
                              500 Kişi
                            </Text>
                            <Text fw={600} size="sm" c="green">
                              {formatMoney(hesaplananMaliyet * 500)}
                            </Text>
                          </Paper>
                          <Paper p="xs" radius="md" withBorder ta="center" bg="white">
                            <Text size="xs" c="dimmed">
                              1000 Kişi
                            </Text>
                            <Text fw={600} size="sm" c="green">
                              {formatMoney(hesaplananMaliyet * 1000)}
                            </Text>
                          </Paper>
                          <Paper p="xs" radius="md" withBorder ta="center" bg="white">
                            <Group gap={4} justify="center">
                              <NumberInput
                                value={kisiSayisi}
                                onChange={(v) => setKisiSayisi(Number(v) || 1)}
                                min={1}
                                max={100000}
                                size="xs"
                                w={70}
                                hideControls
                              />
                              <Text size="xs">kişi</Text>
                            </Group>
                            <Text fw={600} size="sm" c="teal">
                              {formatMoney(hesaplananMaliyet * kisiSayisi)}
                            </Text>
                          </Paper>
                        </SimpleGrid>
                      );
                    })()}

                    {/* Maliyet Breakdown */}
                    {getMaliyetBreakdown().length > 0 && (
                      <Box>
                        <Text size="sm" fw={500} mb="xs">
                          <IconChartPie
                            size={14}
                            style={{ marginRight: 4, verticalAlign: 'middle' }}
                          />
                          Maliyet Dağılımı
                        </Text>
                        <Stack gap={4}>
                          {getMaliyetBreakdown()
                            .slice(0, 5)
                            .map((item, i) => (
                              <Group key={i} gap="xs" wrap="nowrap">
                                <Box
                                  w={10}
                                  h={10}
                                  style={{ borderRadius: 2, background: item.renk }}
                                />
                                <Text size="xs" style={{ flex: 1 }} truncate>
                                  {item.ad}
                                </Text>
                                <Text size="xs" fw={500}>
                                  {formatMoney(item.maliyet)}
                                </Text>
                                <Badge size="xs" variant="light" color="gray">
                                  {item.yuzde.toFixed(0)}%
                                </Badge>
                              </Group>
                            ))}
                          {getMaliyetBreakdown().length > 5 && (
                            <Text size="xs" c="dimmed">
                              +{getMaliyetBreakdown().length - 5} diğer malzeme
                            </Text>
                          )}
                        </Stack>
                      </Box>
                    )}
                  </Paper>

                  {/* Eksik Fiyat Uyarısı */}
                  {eksikFiyatlar.length > 0 && (
                    <Alert
                      color="yellow"
                      icon={<IconAlertCircle size={16} />}
                      title="Eksik Piyasa Fiyatı"
                    >
                      <Text size="sm">
                        {eksikFiyatlar.length} malzemenin piyasa fiyatı yok:{' '}
                        {eksikFiyatlar.map((m) => m.malzeme_adi).join(', ')}
                      </Text>
                    </Alert>
                  )}

                  <Divider />

                  {/* Malzemeler Tablosu */}
                  <Box>
                    <Group justify="space-between" mb="sm">
                      <Text fw={600}>
                        <IconScale size={18} style={{ marginRight: 8, verticalAlign: 'middle' }} />
                        Malzemeler ({selectedRecete.malzemeler?.length || 0})
                      </Text>
                      <Group gap="xs">
                        {eksikFiyatlar.length > 0 && (
                          <Tooltip
                            label={`${eksikFiyatlar.length} malzemenin fiyatı eksik - Stok kartlarından güncelleyin`}
                          >
                            <Badge color="yellow" variant="light" size="sm">
                              {eksikFiyatlar.length} fiyat eksik
                            </Badge>
                          </Tooltip>
                        )}
                        <Button
                          variant="gradient"
                          gradient={{ from: 'violet', to: 'blue' }}
                          size="xs"
                          leftSection={<IconSparkles size={14} />}
                          onClick={handleAiMalzemeOneri}
                          loading={aiMalzemeLoading}
                          disabled={aiMalzemeLoading}
                        >
                          AI ile Öner
                        </Button>
                        <Button
                          variant="gradient"
                          gradient={{ from: 'orange', to: 'red' }}
                          size="xs"
                          leftSection={<IconPlus size={14} />}
                          onClick={() => setShowStokKartModal(true)}
                        >
                          Malzeme Ekle
                        </Button>
                      </Group>
                    </Group>

                    <Stack gap="xs">
                      {selectedRecete.malzemeler && selectedRecete.malzemeler.length > 0 ? (
                        selectedRecete.malzemeler.map((m) => {
                          const isEditing = editingMalzemeId === m.id;

                          // Maliyet hesapla
                          let fiyat = 0;
                          if (m.stok_kart_id) {
                            const stokKart = piyasaUrunleri.find(
                              (s) => s.stok_kart_id === m.stok_kart_id
                            );
                            if (stokKart && stokKart.son_sistem_fiyat > 0)
                              fiyat = stokKart.son_sistem_fiyat;
                          }
                          if (fiyat <= 0)
                            fiyat = m.birim_fiyat || m.piyasa_fiyat || m.sistem_fiyat || 0;

                          const miktar = Number(m.miktar) || 0;
                          const birimLower = (m.birim || '').toLowerCase();
                          let maliyet = 0;
                          if (['g', 'gr', 'ml'].includes(birimLower)) {
                            maliyet = (miktar / 1000) * Number(fiyat);
                          } else {
                            maliyet = miktar * Number(fiyat);
                          }

                          const fiyatBirimi = ['ml', 'lt', 'l'].includes(birimLower)
                            ? 'lt'
                            : birimLower === 'adet'
                              ? 'adet'
                              : 'kg';

                          if (isEditing) {
                            // DÜZENLEME MODU - Kompakt satır içi
                            return (
                              <Paper
                                key={m.id}
                                p="sm"
                                radius="md"
                                withBorder
                                style={{
                                  borderColor: 'var(--mantine-color-blue-4)',
                                  boxShadow: '0 0 0 1px var(--mantine-color-blue-2)',
                                }}
                              >
                                <Group justify="space-between" wrap="wrap">
                                  <Group gap="sm" wrap="nowrap" style={{ flex: 1 }}>
                                    <Text size="lg">
                                      {getMalzemeIcon(m.urun_adi || m.malzeme_adi)}
                                    </Text>
                                    <Text fw={600} size="sm">
                                      {m.urun_adi || m.malzeme_adi}
                                    </Text>
                                  </Group>

                                  <Group gap="sm" wrap="nowrap">
                                    <NumberInput
                                      value={editingMalzemeData?.miktar || 0}
                                      onChange={(val) =>
                                        setEditingMalzemeData((prev) => ({
                                          ...prev!,
                                          miktar: Number(val) || 0,
                                        }))
                                      }
                                      size="sm"
                                      min={0}
                                      decimalScale={2}
                                      w={90}
                                      styles={{ input: { textAlign: 'center', fontWeight: 600 } }}
                                    />
                                    <Select
                                      value={editingMalzemeData?.birim || 'gr'}
                                      onChange={(val) =>
                                        setEditingMalzemeData((prev) => ({
                                          ...prev!,
                                          birim: val || 'gr',
                                        }))
                                      }
                                      data={BIRIMLER}
                                      size="sm"
                                      w={100}
                                    />
                                    <Group gap={6} wrap="nowrap">
                                      <Text size="sm" c="dimmed">
                                        ₺
                                      </Text>
                                      <NumberInput
                                        value={editingMalzemeData?.birim_fiyat || ''}
                                        onChange={(val) =>
                                          setEditingMalzemeData((prev) => ({
                                            ...prev!,
                                            birim_fiyat: Number(val) || null,
                                          }))
                                        }
                                        size="sm"
                                        min={0}
                                        decimalScale={2}
                                        w={80}
                                        placeholder="0.00"
                                        styles={{ input: { textAlign: 'center', fontWeight: 600 } }}
                                      />
                                      <Text size="sm" c="dimmed">
                                        /{fiyatBirimi}
                                      </Text>
                                    </Group>

                                    <ActionIcon
                                      variant="filled"
                                      color="green"
                                      size="md"
                                      radius="xl"
                                      onClick={handleMalzemeDuzenleKaydet}
                                    >
                                      <IconCheck size={16} />
                                    </ActionIcon>
                                    <ActionIcon
                                      variant="light"
                                      color="gray"
                                      size="md"
                                      radius="xl"
                                      onClick={handleMalzemeDuzenleIptal}
                                    >
                                      <IconX size={16} />
                                    </ActionIcon>
                                  </Group>
                                </Group>
                              </Paper>
                            );
                          }

                          // NORMAL GÖRÜNÜM - Temiz ve tıklanabilir
                          return (
                            <Paper
                              key={m.id}
                              p="sm"
                              radius="md"
                              withBorder
                              style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
                              className="hover-card"
                              onClick={() => handleMalzemeDuzenleBasla(m)}
                            >
                              <Group justify="space-between" wrap="wrap">
                                <Group gap="sm" wrap="nowrap" style={{ flex: 1 }}>
                                  <Text size="lg">
                                    {getMalzemeIcon(m.urun_adi || m.malzeme_adi)}
                                  </Text>
                                  <Text fw={500} size="sm">
                                    {m.urun_adi || m.malzeme_adi}
                                  </Text>
                                </Group>

                                <Group gap="md" wrap="nowrap">
                                  <Text fw={600} size="sm" c="dark">
                                    {m.miktar} {m.birim}
                                  </Text>
                                  <Text fw={700} size="sm" c={maliyet > 0 ? 'teal' : 'dimmed'}>
                                    {maliyet > 0 ? formatMoney(maliyet) : '—'}
                                  </Text>
                                  <ActionIcon
                                    variant="subtle"
                                    color="red"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleMalzemeSil(m.id);
                                    }}
                                  >
                                    <IconTrash size={14} />
                                  </ActionIcon>
                                </Group>
                              </Group>
                            </Paper>
                          );
                        })
                      ) : (
                        <EmptyState
                          title="Henüz malzeme eklenmemiş"
                          description="AI ile öner veya manuel ekle"
                          compact
                          icon={<IconScale size={32} />}
                          iconColor="teal"
                        />
                      )}
                    </Stack>
                  </Box>

                  {/* Özet Bilgiler */}
                  <SimpleGrid cols={{ base: 2, sm: 4 }}>
                    <Paper p="sm" withBorder radius="md" ta="center">
                      <IconScale size={20} color="var(--mantine-color-blue-6)" />
                      <Text size="xs" c="dimmed" mt={4}>
                        Porsiyon
                      </Text>
                      {editMode ? (
                        <NumberInput
                          value={editingRecete?.porsiyon_miktar || 1}
                          onChange={(val) =>
                            setEditingRecete({
                              ...editingRecete,
                              porsiyon_miktar: Number(val) || 1,
                            })
                          }
                          min={1}
                          size="xs"
                          suffix=" gr"
                        />
                      ) : (
                        <Text fw={600}>{selectedRecete.porsiyon_miktar} gr</Text>
                      )}
                    </Paper>
                    <Paper p="sm" withBorder radius="md" ta="center">
                      <Text size="xs" c="dimmed">
                        Hazırlık
                      </Text>
                      {editMode ? (
                        <NumberInput
                          value={editingRecete?.hazirlik_suresi || 0}
                          onChange={(val) =>
                            setEditingRecete({
                              ...editingRecete,
                              hazirlik_suresi: Number(val) || 0,
                            })
                          }
                          min={0}
                          size="xs"
                          suffix=" dk"
                        />
                      ) : (
                        <Text fw={600}>{selectedRecete.hazirlik_suresi || 0} dk</Text>
                      )}
                    </Paper>
                    <Paper p="sm" withBorder radius="md" ta="center">
                      <Text size="xs" c="dimmed">
                        Pişirme
                      </Text>
                      {editMode ? (
                        <NumberInput
                          value={editingRecete?.pisirme_suresi || 0}
                          onChange={(val) =>
                            setEditingRecete({ ...editingRecete, pisirme_suresi: Number(val) || 0 })
                          }
                          min={0}
                          size="xs"
                          suffix=" dk"
                        />
                      ) : (
                        <Text fw={600}>{selectedRecete.pisirme_suresi || 0} dk</Text>
                      )}
                    </Paper>
                    <Paper p="sm" withBorder radius="md" ta="center">
                      <Text size="xs" c="dimmed">
                        Kalori
                      </Text>
                      <Text fw={600}>{selectedRecete.kalori || '—'} kcal</Text>
                    </Paper>
                  </SimpleGrid>

                  {/* Tarif */}
                  {editMode ? (
                    <Box>
                      <Text fw={600} mb="xs">
                        Tarif
                      </Text>
                      <Textarea
                        value={editingRecete?.tarif || ''}
                        onChange={(e) =>
                          setEditingRecete({ ...editingRecete, tarif: e.target.value })
                        }
                        minRows={4}
                        placeholder="Tarif açıklaması..."
                      />
                    </Box>
                  ) : (
                    selectedRecete.tarif && (
                      <Box>
                        <Text fw={600} mb="xs">
                          Tarif
                        </Text>
                        <Paper p="md" withBorder radius="md" bg="var(--mantine-color-gray-light)">
                          <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                            {selectedRecete.tarif}
                          </Text>
                        </Paper>
                      </Box>
                    )
                  )}
                </Stack>
              </ScrollArea>
            </>
          )}
        </Box>
        )}
      </Box>

      {/* Yeni Reçete Modal */}
      <Modal
        opened={showYeniRecete}
        onClose={() => setShowYeniRecete(false)}
        title={
          <Group gap="sm">
            <IconPlus size={20} />
            <Text fw={600}>Yeni Reçete Oluştur</Text>
          </Group>
        }
        size="lg"
      >
        <Stack gap="md">
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput
              label="Reçete Adı"
              placeholder="Örn: Pirinç Pilavı"
              value={yeniRecete.ad}
              onChange={(e) => setYeniRecete({ ...yeniRecete, ad: e.target.value })}
              required
            />
            <Select
              label="Kategori"
              placeholder="Kategori seç..."
              data={kategoriler.map((k) => ({
                value: k.id.toString(),
                label: `${k.ikon} ${k.ad}`,
              }))}
              value={yeniRecete.kategori_id?.toString() || null}
              onChange={(val) =>
                setYeniRecete({ ...yeniRecete, kategori_id: val ? parseInt(val, 10) : null })
              }
              required
            />
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, sm: 3 }}>
            <NumberInput
              label="Porsiyon (gr)"
              value={yeniRecete.porsiyon_miktar}
              onChange={(val) =>
                setYeniRecete({ ...yeniRecete, porsiyon_miktar: Number(val) || 1 })
              }
              min={1}
            />
            <NumberInput
              label="Hazırlık Süresi (dk)"
              value={yeniRecete.hazirlik_suresi}
              onChange={(val) =>
                setYeniRecete({ ...yeniRecete, hazirlik_suresi: Number(val) || 0 })
              }
              min={0}
            />
            <NumberInput
              label="Pişirme Süresi (dk)"
              value={yeniRecete.pisirme_suresi}
              onChange={(val) => setYeniRecete({ ...yeniRecete, pisirme_suresi: Number(val) || 0 })}
              min={0}
            />
          </SimpleGrid>

          <Textarea
            label="Tarif"
            placeholder="Tarif açıklaması (opsiyonel)"
            value={yeniRecete.tarif}
            onChange={(e) => setYeniRecete({ ...yeniRecete, tarif: e.target.value })}
            minRows={3}
          />

          <Group justify="flex-end">
            <Button variant="light" color="gray" onClick={() => setShowYeniRecete(false)}>
              İptal
            </Button>
            <Button
              variant="gradient"
              gradient={{ from: 'orange', to: 'red' }}
              onClick={handleYeniReceteOlustur}
            >
              Oluştur
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* STOK KARTI SEÇİM MODAL */}
      <Modal
        opened={showStokKartModal}
        onClose={() => {
          setShowStokKartModal(false);
          setSelectedStokKart(null);
          setStokKartArama('');
        }}
        title={
          <Group gap="sm">
            <ThemeIcon size="lg" radius="xl" color="orange" variant="light">
              <IconPlus size={18} />
            </ThemeIcon>
            <Text fw={600}>Stok Kartından Malzeme Seç</Text>
          </Group>
        }
        size="lg"
        centered
      >
        {!selectedStokKart ? (
          // ADIM 1: Stok Kartı Listesi
          <Stack gap="md">
            <TextInput
              placeholder="🔍 Stok kartı ara..."
              value={stokKartArama}
              onChange={(e) => setStokKartArama(e.target.value)}
              size="md"
              styles={{
                input: {
                  border: '2px solid var(--mantine-color-orange-3)',
                  fontSize: '1rem',
                },
              }}
            />

            <ScrollArea h={350} offsetScrollbars>
              <Stack gap="xs">
                {piyasaUrunleri
                  .filter(
                    (u) =>
                      stokKartArama === '' ||
                      u.urun_adi.toLowerCase().includes(stokKartArama.toLowerCase())
                  )
                  .slice(0, 20)
                  .map((stokKart) => {
                    const fiyat = Number(stokKart.son_sistem_fiyat) || 0;

                    return (
                      <Paper
                        key={stokKart.stok_kart_id}
                        p="sm"
                        withBorder
                        radius="md"
                        style={{
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                        }}
                        onClick={() => handleStokKartSec(stokKart)}
                        className="hover-card"
                      >
                        <Group justify="space-between">
                          <Group gap="sm">
                            <Text size="xl">{getMalzemeIcon(stokKart.urun_adi)}</Text>
                            <Box>
                              <Text fw={600}>{stokKart.urun_adi}</Text>
                              <Text size="xs" c="dimmed">
                                {stokKart.birim}
                              </Text>
                            </Box>
                          </Group>
                          <Badge size="lg" color="blue" variant="light">
                            ₺{fiyat.toFixed(2)}/{stokKart.birim}
                          </Badge>
                        </Group>
                      </Paper>
                    );
                  })}

                {stokKartArama &&
                  piyasaUrunleri.filter((u) =>
                    u.urun_adi.toLowerCase().includes(stokKartArama.toLowerCase())
                  ).length === 0 && (
                    <Paper
                      p="xl"
                      withBorder
                      radius="md"
                      ta="center"
                      bg="var(--mantine-color-gray-0)"
                    >
                      <Text c="dimmed" mb="xs">
                        "{stokKartArama}" bulunamadı
                      </Text>
                      <Text size="xs" c="dimmed">
                        Stok kartı yönetiminden yeni kart ekleyebilirsiniz
                      </Text>
                    </Paper>
                  )}
              </Stack>
            </ScrollArea>

            <Text size="xs" c="dimmed" ta="center">
              {piyasaUrunleri.length} stok kartı mevcut
            </Text>
          </Stack>
        ) : (
          // ADIM 2: Miktar Girişi
          <Stack gap="lg">
            {/* Seçili Ürün */}
            <Paper p="md" withBorder radius="md" bg="var(--mantine-color-orange-0)">
              <Group gap="md">
                <Text size="2rem">{getMalzemeIcon(selectedStokKart.urun_adi)}</Text>
                <Box style={{ flex: 1 }}>
                  <Text fw={700} size="lg">
                    {selectedStokKart.urun_adi}
                  </Text>
                  <Badge size="md" color="blue">
                    ₺{(selectedStokKart.son_sistem_fiyat || 0).toFixed(2)}/{selectedStokKart.birim}
                  </Badge>
                </Box>
                <ActionIcon variant="light" color="gray" onClick={() => setSelectedStokKart(null)}>
                  <IconX size={16} />
                </ActionIcon>
              </Group>
            </Paper>

            {/* Miktar Girişi */}
            <Group grow>
              <NumberInput
                label="Miktar"
                value={miktarGirisi.miktar}
                onChange={(val) => setMiktarGirisi({ ...miktarGirisi, miktar: Number(val) || 0 })}
                min={0}
                max={99999}
                size="lg"
                styles={{ input: { textAlign: 'center', fontWeight: 700, fontSize: '1.5rem' } }}
              />
              <Select
                label="Birim"
                value={miktarGirisi.birim}
                onChange={(val) => setMiktarGirisi({ ...miktarGirisi, birim: val || 'gr' })}
                data={
                  selectedStokKart.birim?.toLowerCase() === 'kg'
                    ? [
                        { value: 'gr', label: 'gram (gr)' },
                        { value: 'kg', label: 'kilogram (kg)' },
                      ]
                    : ['lt', 'l'].includes(selectedStokKart.birim?.toLowerCase() || '')
                      ? [
                          { value: 'ml', label: 'mililitre (ml)' },
                          { value: 'lt', label: 'litre (lt)' },
                        ]
                      : [{ value: 'adet', label: 'adet' }]
                }
                size="lg"
              />
            </Group>

            {/* Hesaplama Kutusu */}
            <Paper p="md" withBorder radius="md" bg="var(--mantine-color-teal-0)">
              <Stack gap="xs">
                <Text size="sm" c="dimmed" ta="center">
                  Maliyet Hesabı
                </Text>
                <Group justify="center" gap="xs">
                  <Text fw={500}>
                    {miktarGirisi.miktar} {miktarGirisi.birim}
                  </Text>
                  <Text c="dimmed">×</Text>
                  <Text fw={500}>
                    ₺{(selectedStokKart.son_sistem_fiyat || 0).toFixed(2)}/{selectedStokKart.birim}
                  </Text>
                  <Text c="dimmed">=</Text>
                  <Text fw={700} size="xl" c="teal">
                    ₺
                    {hesaplaMaliyet(
                      miktarGirisi.miktar,
                      miktarGirisi.birim,
                      selectedStokKart.son_sistem_fiyat || 0,
                      selectedStokKart.birim
                    ).toFixed(2)}
                  </Text>
                </Group>
              </Stack>
            </Paper>

            {/* Butonlar */}
            <Group justify="flex-end" mt="md">
              <Button variant="light" color="gray" onClick={() => setSelectedStokKart(null)}>
                Geri
              </Button>
              <Button
                variant="gradient"
                gradient={{ from: 'teal', to: 'green' }}
                size="md"
                loading={malzemeEklemeLoading}
                disabled={miktarGirisi.miktar <= 0}
                onClick={handleMalzemeEkleFromModal}
                leftSection={<IconCheck size={18} />}
              >
                Ekle ₺
                {hesaplaMaliyet(
                  miktarGirisi.miktar,
                  miktarGirisi.birim,
                  selectedStokKart.son_sistem_fiyat || 0,
                  selectedStokKart.birim
                ).toFixed(2)}
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      {/* Ürün Kartları Modal */}
      <UrunKartlariModal
        opened={urunKartlariModalOpened}
        onClose={() => setUrunKartlariModalOpened(false)}
      />
    </Modal>
  );
}
