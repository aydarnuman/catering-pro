'use client';

import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Center,
  Container,
  Drawer,
  Group,
  Loader,
  Tooltip as MantineTooltip,
  Modal,
  Paper,
  ScrollArea,
  SegmentedControl,
  Select,
  SimpleGrid,
  Skeleton,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  ThemeIcon,
  UnstyledButton,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconAlertCircle,
  IconBook2,
  IconCalendar,
  IconChartLine,
  IconCheck,
  IconCurrencyLira,
  IconFile,
  IconFileSpreadsheet,
  IconInfoCircle,
  IconPackages,
  IconPlus,
  IconRefresh,
  IconScale,
  IconSearch,
  IconSparkles,
  IconToolsKitchen2,
  IconTrendingDown,
  IconTrendingUp,
  IconX,
} from '@tabler/icons-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useRealtimeRefetch } from '@/context/RealtimeContext';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useResponsive } from '@/hooks/useResponsive';
import {
  type FiyatGecmisiItem,
  faturaKalemleriAPI,
  type MaliyetOzetItem,
  type PriceHistoryData,
} from '@/lib/api/services/fatura-kalemleri';
import { menuPlanlamaAPI, type Recete } from '@/lib/api/services/menu-planlama';
import { type UrunKarti, urunlerAPI } from '@/lib/api/services/urunler';
import { API_BASE_URL } from '@/lib/config';
import { formatDate, formatMoney } from '@/lib/formatters';
import { KaydedilenMenuler } from './components/KaydedilenMenuler';
// Menü Planlama Componentleri
import { MenuPlanlamaProvider } from './components/MenuPlanlamaContext';
import { MenuSidebar, SIDEBAR_ITEMS, type SidebarCategory } from './components/MenuSidebar';
import { MenuTakvim } from './components/MenuTakvim';

// Ürün adından birim bilgisini parse et (örn: "5 KG*2" -> {unit: "KG", amount: 5, multiplier: 2})
const parseUnitFromProductName = (
  productName: string
): { unit: string; amount: number; multiplier: number; totalAmount: number } | null => {
  if (!productName) return null;

  // Pattern: "5 KG*2", "10 KG", "250 GR*48", "1.5 L", "500 ML*12" gibi
  const patterns = [
    // "5 KG*2" formatı
    /(\d+(?:\.\d+)?)\s*(KG|GR|G|L|ML|LT|ADET|PKT|PAKET|KUTU|KOLİ)\s*\*\s*(\d+)/i,
    // "5 KG" formatı (çarpı yok)
    /(\d+(?:\.\d+)?)\s*(KG|GR|G|L|ML|LT|ADET|PKT|PAKET|KUTU|KOLİ)/i,
  ];

  for (const pattern of patterns) {
    const match = productName.match(pattern);
    if (match) {
      const amount = parseFloat(match[1]);
      const unit = match[2].toUpperCase();
      const multiplier = match[3] ? parseInt(match[3], 10) : 1;
      const totalAmount = amount * multiplier;

      return { unit, amount, multiplier, totalAmount };
    }
  }

  return null;
};

// Birim fiyatını hesapla ve formatla
const calculateUnitPrice = (
  unitPrice: number,
  productName: string
): { display: string; tooltip: string } | null => {
  const unitInfo = parseUnitFromProductName(productName);
  if (!unitInfo) return null;

  const { unit, amount, multiplier, totalAmount } = unitInfo;

  // Birim fiyatını hesapla
  let unitPricePerBase: number;
  let displayText: string;
  let tooltipText: string;

  if (multiplier > 1) {
    // "5 KG*2" durumu: toplam 10 KG, fiyat 185 TL -> 18.5 TL/kg
    unitPricePerBase = unitPrice / totalAmount;
    displayText = `₺${unitPricePerBase.toFixed(2)}/${unit.toLowerCase()}`;
    tooltipText = `${amount} ${unit} × ${multiplier} = ${totalAmount} ${unit} paket başına ₺${unitPrice.toFixed(2)}`;
  } else {
    // "5 KG" durumu: 5 KG, fiyat 185 TL -> 37 TL/kg
    unitPricePerBase = unitPrice / amount;
    displayText = `₺${unitPricePerBase.toFixed(2)}/${unit.toLowerCase()}`;
    tooltipText = `${amount} ${unit} paket başına ₺${unitPrice.toFixed(2)}`;
  }

  return { display: displayText, tooltip: tooltipText };
};

// Kategoriye göre renk belirle
const getCategoryColor = (category?: string): string => {
  if (!category) return 'dimmed';

  const categoryLower = category.toLowerCase();

  if (categoryLower.includes('sebze')) return 'green';
  if (categoryLower.includes('meyve')) return 'orange';
  if (categoryLower.includes('et') || categoryLower.includes('tavuk')) return 'red';
  if (categoryLower.includes('balık') || categoryLower.includes('balik')) return 'blue';
  if (categoryLower.includes('süt') || categoryLower.includes('sut')) return 'cyan';
  if (categoryLower.includes('bakliyat')) return 'yellow';
  if (categoryLower.includes('içecek') || categoryLower.includes('icecek')) return 'grape';
  if (categoryLower.includes('baharat')) return 'pink';
  if (categoryLower.includes('yağ') || categoryLower.includes('yag')) return 'lime';
  if (categoryLower.includes('temizlik')) return 'teal';
  if (categoryLower.includes('dondurulmuş') || categoryLower.includes('donuk')) return 'indigo';

  return 'dimmed';
};

// Fiyat Badge Komponenti
const FiyatBadge = ({
  fatura,
  piyasa,
  faturaGuncel = true,
  piyasaGuncel = true,
}: {
  fatura?: number;
  piyasa?: number;
  faturaGuncel?: boolean;
  piyasaGuncel?: boolean;
}) => {
  const fark = fatura && piyasa ? ((piyasa - fatura) / fatura) * 100 : 0;

  return (
    <Group gap={4}>
      {fatura !== undefined && fatura > 0 && (
        <Badge
          size="xs"
          variant="light"
          color={faturaGuncel ? 'blue' : 'yellow'}
          leftSection={<Text size="10px">📄</Text>}
        >
          ₺{fatura.toFixed(2)}
        </Badge>
      )}
      {piyasa !== undefined && piyasa > 0 && (
        <Badge
          size="xs"
          variant="light"
          color={piyasaGuncel ? 'teal' : 'orange'}
          leftSection={<Text size="10px">🏪</Text>}
        >
          ₺{piyasa.toFixed(2)}
        </Badge>
      )}
      {fatura && piyasa && Math.abs(fark) > 5 && (
        <Badge size="xs" variant="filled" color={fark > 0 ? 'red' : 'green'}>
          {fark > 0 ? '↑' : '↓'}
          {Math.abs(fark).toFixed(0)}%
        </Badge>
      )}
    </Group>
  );
};

// Gramaj Düzenlenebilir Satır
interface GramajEditableRowProps {
  gramaj: {
    id: number;
    yemek_turu: string;
    porsiyon_gramaj: number;
    birim: string;
    birim_fiyat?: number;
  };
  sartnameId: number;
  onUpdate: (
    gramajId: number,
    sartnameId: number,
    data: { yemek_turu?: string; porsiyon_gramaj?: number; birim?: string }
  ) => void;
  onDelete: (gramajId: number, sartnameId: number) => void;
}

const GramajEditableRow = ({ gramaj, sartnameId, onUpdate, onDelete }: GramajEditableRowProps) => {
  const [malzeme, setMalzeme] = useState(gramaj.yemek_turu || '');
  const [miktar, setMiktar] = useState(gramaj.porsiyon_gramaj?.toString() || '');
  const [birim, setBirim] = useState(gramaj.birim || 'g');
  const [debouncedMalzeme] = useDebouncedValue(malzeme, 2000);
  const [debouncedMiktar] = useDebouncedValue(miktar, 2000);
  const [debouncedBirim] = useDebouncedValue(birim, 2000);
  const initialRef = useRef({
    malzeme: gramaj.yemek_turu,
    miktar: gramaj.porsiyon_gramaj?.toString(),
    birim: gramaj.birim,
  });

  // Debounce sonrası otomatik kaydet
  useEffect(() => {
    const hasChanged =
      debouncedMalzeme !== initialRef.current.malzeme ||
      debouncedMiktar !== initialRef.current.miktar ||
      debouncedBirim !== initialRef.current.birim;

    if (hasChanged && debouncedMalzeme && debouncedMiktar) {
      const numMiktar = parseFloat(debouncedMiktar);
      if (!Number.isNaN(numMiktar) && numMiktar > 0) {
        onUpdate(gramaj.id, sartnameId, {
          yemek_turu: debouncedMalzeme,
          porsiyon_gramaj: numMiktar,
          birim: debouncedBirim,
        });
        initialRef.current = {
          malzeme: debouncedMalzeme,
          miktar: debouncedMiktar,
          birim: debouncedBirim,
        };
      }
    }
  }, [debouncedMalzeme, debouncedMiktar, debouncedBirim, gramaj.id, sartnameId, onUpdate]);

  // Fiyat hesapla (gramaj × birim fiyat / 1000 eğer birim gram ise)
  const hesaplananFiyat = useMemo(() => {
    if (!gramaj.birim_fiyat || !gramaj.porsiyon_gramaj) return null;
    const carpan = birim === 'kg' || birim === 'L' ? 1 : 0.001; // g ve ml için 1000'e böl
    return gramaj.porsiyon_gramaj * gramaj.birim_fiyat * carpan;
  }, [gramaj.birim_fiyat, gramaj.porsiyon_gramaj, birim]);

  return (
    <Table.Tr>
      <Table.Td>
        <TextInput
          size="xs"
          variant="unstyled"
          value={malzeme}
          onChange={(e) => setMalzeme(e.target.value)}
          placeholder="Malzeme adı..."
          styles={{ input: { fontWeight: 500 } }}
        />
      </Table.Td>
      <Table.Td>
        <TextInput
          size="xs"
          variant="unstyled"
          value={miktar}
          onChange={(e) => setMiktar(e.target.value)}
          placeholder="0"
          ta="center"
          styles={{ input: { textAlign: 'center', fontWeight: 600 } }}
        />
      </Table.Td>
      <Table.Td>
        <Select
          size="xs"
          variant="unstyled"
          value={birim}
          onChange={(v) => setBirim(v || 'g')}
          data={['g', 'kg', 'ml', 'L', 'adet']}
          comboboxProps={{ withinPortal: true }}
          styles={{ input: { textAlign: 'center' } }}
        />
      </Table.Td>
      <Table.Td ta="right">
        {hesaplananFiyat ? (
          <Text size="xs" c="teal" fw={500}>
            ₺{hesaplananFiyat.toFixed(2)}
          </Text>
        ) : gramaj.birim_fiyat ? (
          <Text size="xs" c="dimmed">
            ₺{gramaj.birim_fiyat.toFixed(2)}/kg
          </Text>
        ) : (
          <Text size="xs" c="dimmed">
            -
          </Text>
        )}
      </Table.Td>
      <Table.Td>
        <ActionIcon
          size="xs"
          variant="subtle"
          color="red"
          onClick={() => onDelete(gramaj.id, sartnameId)}
        >
          <IconX size={14} />
        </ActionIcon>
      </Table.Td>
    </Table.Tr>
  );
};

// Ürün arama tipi
interface UrunKartiOption {
  id: number;
  kod: string;
  ad: string;
  birim: string;
  son_alis_fiyat?: number;
}

// Yeni Gramaj Ekleme Satırı - Ürün kartlarından autocomplete
interface GramajNewRowProps {
  sartnameId: number;
  onAdd: (
    sartnameId: number,
    malzeme: string,
    gramaj: number,
    birim: string,
    birimFiyat?: number
  ) => void;
}

const GramajNewRow = ({ sartnameId, onAdd }: GramajNewRowProps) => {
  const [searchValue, setSearchValue] = useState('');
  const [selectedUrun, setSelectedUrun] = useState<UrunKartiOption | null>(null);
  const [miktar, setMiktar] = useState('');
  const [birim, setBirim] = useState('g');
  const [debouncedSearch] = useDebouncedValue(searchValue, 300);

  // Ürün kartlarını API'den ara
  const { data: urunler = [] } = useQuery<UrunKartiOption[]>({
    queryKey: ['urun-kartlari-arama', debouncedSearch],
    queryFn: async () => {
      if (!debouncedSearch || debouncedSearch.length < 2) return [];
      const res = await fetch(
        `${API_BASE_URL}/api/menu-planlama/stok-kartlari-listesi?arama=${encodeURIComponent(debouncedSearch)}`
      );
      const data = await res.json();
      return data.success ? data.data : [];
    },
    enabled: debouncedSearch.length >= 2,
  });

  const handleSelectUrun = (urunId: string | null) => {
    if (!urunId) {
      setSelectedUrun(null);
      return;
    }
    const urun = urunler.find((u) => u.id.toString() === urunId);
    if (urun) {
      setSelectedUrun(urun);
      setSearchValue(urun.ad);
      // Birim otomatik ayarla
      if (urun.birim) {
        const normalizedBirim = urun.birim.toLowerCase();
        if (['kg', 'g', 'gr'].includes(normalizedBirim)) setBirim('g');
        else if (['l', 'lt', 'ml'].includes(normalizedBirim)) setBirim('ml');
        else if (['adet', 'ad'].includes(normalizedBirim)) setBirim('adet');
      }
    }
  };

  const handleAdd = () => {
    const numMiktar = parseFloat(miktar);
    const malzemeAdi = selectedUrun?.ad || searchValue.trim();
    if (malzemeAdi && !Number.isNaN(numMiktar) && numMiktar > 0) {
      onAdd(sartnameId, malzemeAdi, numMiktar, birim, selectedUrun?.son_alis_fiyat);
      setSearchValue('');
      setSelectedUrun(null);
      setMiktar('');
      setBirim('g');
    }
  };

  return (
    <Table.Tr style={{ background: 'var(--mantine-color-dark-7)' }}>
      <Table.Td>
        <Select
          size="xs"
          variant="unstyled"
          placeholder="+ Ürün ara..."
          searchable
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          value={selectedUrun?.id.toString() || null}
          onChange={handleSelectUrun}
          data={urunler.map((u) => ({
            value: u.id.toString(),
            label: `${u.ad}${u.son_alis_fiyat ? ` • ₺${Number(u.son_alis_fiyat).toFixed(2)}` : ''}`,
          }))}
          nothingFoundMessage={
            debouncedSearch.length >= 2 ? 'Ürün bulunamadı' : 'En az 2 karakter yazın'
          }
          comboboxProps={{ withinPortal: true }}
          clearable
        />
      </Table.Td>
      <Table.Td>
        <TextInput
          size="xs"
          variant="unstyled"
          value={miktar}
          onChange={(e) => setMiktar(e.target.value)}
          placeholder="0"
          ta="center"
          styles={{ input: { textAlign: 'center' } }}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
      </Table.Td>
      <Table.Td>
        <Select
          size="xs"
          variant="unstyled"
          value={birim}
          onChange={(v) => setBirim(v || 'g')}
          data={['g', 'kg', 'ml', 'L', 'adet']}
          comboboxProps={{ withinPortal: true }}
          styles={{ input: { textAlign: 'center' } }}
        />
      </Table.Td>
      <Table.Td ta="right">
        {selectedUrun?.son_alis_fiyat ? (
          <Text size="xs" c="dimmed">
            ₺{Number(selectedUrun.son_alis_fiyat).toFixed(2)}/kg
          </Text>
        ) : (
          <Text size="xs" c="dimmed">
            -
          </Text>
        )}
      </Table.Td>
      <Table.Td>
        <ActionIcon
          size="xs"
          variant="light"
          color="teal"
          onClick={handleAdd}
          disabled={!(selectedUrun?.ad || searchValue.trim()) || !miktar}
        >
          <IconPlus size={14} />
        </ActionIcon>
      </Table.Td>
    </Table.Tr>
  );
};

// Varsayılan kategoriler (backend'den gelmezse kullanılacak)
const VARSAYILAN_KATEGORILER = [
  { kod: 'corba', ad: 'Çorbalar', ikon: '🥣', renk: 'orange' },
  { kod: 'sebze', ad: 'Sebze Yemekleri', ikon: '🥬', renk: 'green' },
  { kod: 'bakliyat', ad: 'Bakliyat', ikon: '🫘', renk: 'yellow' },
  { kod: 'tavuk', ad: 'Tavuk Yemekleri', ikon: '🍗', renk: 'orange' },
  { kod: 'et', ad: 'Et Yemekleri', ikon: '🥩', renk: 'red' },
  { kod: 'balik', ad: 'Balık', ikon: '🐟', renk: 'blue' },
  { kod: 'pilav', ad: 'Pilav & Makarna', ikon: '🍚', renk: 'cyan' },
  { kod: 'salata', ad: 'Salatalar', ikon: '🥗', renk: 'lime' },
  { kod: 'tatli', ad: 'Tatlılar', ikon: '🍮', renk: 'pink' },
  { kod: 'icecek', ad: 'İçecekler', ikon: '🥛', renk: 'grape' },
];

interface ReceteYemek {
  id: number;
  kod?: string;
  ad: string;
  kategori?: string;
  sistem_maliyet?: number;
  piyasa_maliyet?: number;
  fatura_maliyet?: number;
  fatura_guncel?: boolean;
  piyasa_guncel?: boolean;
  fiyat_uyari?: string;
  kalori?: number;
  // Yeni alanlar (backend'den gelen veri formatına uygun)
  fiyat?: number;
  fatura_fiyat?: number;
  piyasa_fiyat?: number;
  porsiyon?: number;
}

interface KategoriInfo {
  kod: string;
  ad: string;
  ikon: string;
  renk: string;
}

interface ReceteKategori {
  kod: string;
  ad: string;
  ikon: string;
  renk?: string;
  yemekler: ReceteYemek[];
}

interface SeciliYemek {
  id: string;
  recete_id: number;
  kategori: string;
  ad: string;
  fiyat: number;
  fatura_fiyat?: number;
  piyasa_fiyat?: number;
}

interface Malzeme {
  id: number;
  malzeme_adi: string;
  miktar: number;
  birim: string;
  stok_kart_id: number | null;
  stok_adi: string | null;
  sistem_fiyat: number | null;
  piyasa_fiyat: number | null;
  stok_birim: string | null;
}

interface ReceteDetay {
  id: number;
  kod: string;
  ad: string;
  kategori: string;
  porsiyon_gram: number;
  sistem_maliyet: number;
  piyasa_maliyet: number;
  malzemeler: Malzeme[];
}

// Backend'den gelen reçete response type'ı
interface BackendReceteResponse {
  id: number;
  kod: string | null;
  ad: string;
  kategori_id: number | null;
  kategori_adi: string | null;
  kategori_ikon: string | null;
  porsiyon_miktar: number | null;
  hazirlik_suresi: number | null;
  pisirme_suresi: number | null;
  kalori: number | null;
  protein: number | null;
  karbonhidrat: number | null;
  yag: number | null;
  tahmini_maliyet: number | null;
  ai_olusturuldu: boolean | null;
  proje_id: number | null;
  proje_adi: string | null;
  created_at: string | null;
  malzeme_sayisi: number;
}

// Backend'den gelen maliyet analizi response type'ı
interface BackendMaliyetAnaliziResponse {
  recete: {
    id: number;
    ad: string;
    kod: string | null;
    kategori: string | null;
    ikon: string | null;
    porsiyon: number | null;
    kalori: number | null;
    protein: number | null;
  };
  malzemeler: Array<{
    id: number;
    malzeme_adi: string;
    miktar: number;
    birim: string;
    sistem_fiyat: number;
    piyasa_fiyat: number;
    sistem_toplam: number;
    piyasa_toplam: number;
    piyasa_detay: {
      min: number;
      max: number;
      ort: number;
      tarih: string;
    } | null;
  }>;
  maliyet: {
    sistem: number;
    piyasa: number;
    fark: number;
    fark_yuzde: string;
  };
}

export default function MenuMaliyetPage() {
  const { isMobile, isMounted } = useResponsive();
  const queryClient = useQueryClient();

  // LocalStorage persist edilmiş state'ler
  const [seciliYemekler, setSeciliYemekler] = useLocalStorage<SeciliYemek[]>('menu-sepet', []);

  // Mobil drawer için kategori seçimi
  const [mobileDrawerKategori, setMobileDrawerKategori] = useState<string | null>(null);

  // Reçete detay modal
  const [detayModalOpened, setDetayModalOpened] = useState(false);
  const [receteDetay, setReceteDetay] = useState<ReceteDetay | null>(null);

  // Şartname tipler - API'den çekilecek
  interface SartnameGramaj {
    id: number;
    yemek_turu: string;
    malzeme_adi?: string;
    porsiyon_gramaj: number;
    birim: string;
  }

  interface SartnameSet {
    id: number;
    kod: string;
    ad: string;
    kurum_adi?: string;
    yil?: number;
    gramajlar?: SartnameGramaj[];
  }

  // Şartname listesini API'den çek
  const { data: sartnameListesi = [], refetch: refetchSartnameler } = useQuery<SartnameSet[]>({
    queryKey: ['sartname-liste'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/api/menu-planlama/sartname/liste`);
      const data = await res.json();
      return data.success ? data.data : [];
    },
  });

  // Şartname tab'ları - her tab bir şartnameyi temsil eder (id'ler)
  const [sartnameTabs, setSartnameTabs] = useLocalStorage<number[]>('recete-sartname-tabs-v2', []);
  const [activeReceteTab, setActiveReceteTab] = useLocalStorage<number | null>(
    'recete-active-tab-v2',
    null
  );
  const [newSartnameName, setNewSartnameName] = useState('');

  // İlk şartnameler yüklendiğinde tab'ları ayarla
  useEffect(() => {
    if (sartnameListesi.length > 0 && sartnameTabs.length === 0) {
      const ilkUc = sartnameListesi.slice(0, 3).map((s) => s.id);
      setSartnameTabs(ilkUc);
      setActiveReceteTab(ilkUc[0]);
    }
  }, [sartnameListesi, sartnameTabs.length, setSartnameTabs, setActiveReceteTab]);

  // Şartname detaylarını cache'le (gramajlarıyla birlikte)
  const [sartnameDetayCache, setSartnameDetayCache] = useState<Record<number, SartnameSet>>({});

  // Tab için şartname bilgisini al (gramajlarıyla)
  const getTabSartname = useCallback(
    (tabId: number): SartnameSet | undefined => {
      // Önce cache'e bak
      if (sartnameDetayCache[tabId]) {
        return sartnameDetayCache[tabId];
      }
      // Cache'de yoksa listeden al (gramajsız)
      return sartnameListesi.find((s) => s.id === tabId);
    },
    [sartnameDetayCache, sartnameListesi]
  );

  // Şartname detayını API'den çek (gramajlarıyla)
  const fetchSartnameDetay = useCallback(
    async (sartnameId: number) => {
      if (sartnameDetayCache[sartnameId]) return sartnameDetayCache[sartnameId];

      try {
        const res = await fetch(`${API_BASE_URL}/api/menu-planlama/sartname/${sartnameId}`);
        const data = await res.json();
        if (data.success) {
          const detay = { ...data.data, gramajlar: data.data.gramajlar || [] };
          setSartnameDetayCache((prev) => ({ ...prev, [sartnameId]: detay }));
          return detay;
        }
      } catch (err) {
        console.error('Şartname detay hatası:', err);
      }
      return null;
    },
    [sartnameDetayCache]
  );

  // Aktif tab değiştiğinde gramajları yükle
  useEffect(() => {
    if (activeReceteTab && !sartnameDetayCache[activeReceteTab]) {
      fetchSartnameDetay(activeReceteTab);
    }
  }, [activeReceteTab, sartnameDetayCache, fetchSartnameDetay]);

  // Yeni şartname ekle
  const handleAddSartname = async () => {
    if (!newSartnameName.trim()) return;

    try {
      const kod = newSartnameName.trim().toUpperCase().replace(/\s+/g, '-');
      const res = await fetch(`${API_BASE_URL}/api/menu-planlama/sartname`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kod,
          ad: newSartnameName.trim(),
          yil: new Date().getFullYear(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        await refetchSartnameler();
        setSartnameTabs((prev) => [...prev, data.data.id]);
        setActiveReceteTab(data.data.id);
        setNewSartnameName('');
        notifications.show({ title: 'Başarılı', message: 'Şartname eklendi', color: 'green' });
      }
    } catch (err) {
      notifications.show({ title: 'Hata', message: 'Şartname eklenemedi', color: 'red' });
    }
  };

  // Yeni gramaj ekle
  const handleAddGramaj = async (
    sartnameId: number,
    malzeme: string,
    gramaj: number,
    birim: string,
    birimFiyat?: number
  ) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/menu-planlama/sartname/${sartnameId}/gramaj`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yemek_turu: malzeme, porsiyon_gramaj: gramaj, birim }),
      });
      const data = await res.json();
      if (data.success) {
        // Fiyatı frontend'de ekle (backend'de bu alan yok)
        const newGramaj = { ...data.data, birim_fiyat: birimFiyat };
        setSartnameDetayCache((prev) => {
          const current = prev[sartnameId];
          if (!current) return prev;
          return {
            ...prev,
            [sartnameId]: {
              ...current,
              gramajlar: [...(current.gramajlar || []), newGramaj],
            },
          };
        });
      }
    } catch (err) {
      console.error('Gramaj eklenemedi:', err);
    }
  };

  // Gramaj güncelle
  const handleUpdateGramaj = async (
    gramajId: number,
    sartnameId: number,
    data: { yemek_turu?: string; porsiyon_gramaj?: number; birim?: string }
  ) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/menu-planlama/sartname/gramaj/${gramajId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (result.success) {
        setSartnameDetayCache((prev) => {
          const current = prev[sartnameId];
          if (!current || !current.gramajlar) return prev;
          return {
            ...prev,
            [sartnameId]: {
              ...current,
              gramajlar: current.gramajlar.map((g) => (g.id === gramajId ? { ...g, ...data } : g)),
            },
          };
        });
      }
    } catch (err) {
      console.error('Gramaj güncellenemedi:', err);
    }
  };

  // Gramaj sil
  const handleDeleteGramaj = async (gramajId: number, sartnameId: number) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/menu-planlama/sartname/gramaj/${gramajId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        setSartnameDetayCache((prev) => {
          const current = prev[sartnameId];
          if (!current || !current.gramajlar) return prev;
          return {
            ...prev,
            [sartnameId]: {
              ...current,
              gramajlar: current.gramajlar.filter((g) => g.id !== gramajId),
            },
          };
        });
      }
    } catch (err) {
      console.error('Gramaj silinemedi:', err);
    }
  };

  // Sidebar & Tab state
  const [activeCategory, setActiveCategory] = useState<SidebarCategory>('planlama');
  const [activeTab, setActiveTab] = useState<string | null>('takvim');

  // Kategori değiştiğinde ilk tab'a git
  useEffect(() => {
    const category = SIDEBAR_ITEMS.find((s) => s.id === activeCategory);
    if (category && category.tabs.length > 0) {
      setActiveTab(category.tabs[0].id);
    }
  }, [activeCategory]);

  // Aktif kategorinin tab'larını al
  const currentTabs = useMemo(() => {
    return SIDEBAR_ITEMS.find((s) => s.id === activeCategory)?.tabs || [];
  }, [activeCategory]);

  // Fiyat analizi state'leri - Fiyatlar tabı (Single Source: fatura_kalemleri)
  const [seciliFiyatUrunId, setSeciliFiyatUrunId] = useState<number | null>(null);
  const [seciliFiyatUrunAd, setSeciliFiyatUrunAd] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'3m' | '6m' | '1y' | 'all'>('6m');
  const [chartType, setChartType] = useState<'line' | 'bar' | 'area'>('line');
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [fiyatArama, setFiyatArama] = useState('');
  const [debouncedFiyatArama] = useDebouncedValue(fiyatArama, 300);
  const [sadecegida, setSadeceGida] = useState<boolean>(true); // Varsayılan: sadece gıda

  // Ürün detay modal – FiyatListeUrun (maliyet özeti + display alanları)
  type SeciliUrunDetayType = MaliyetOzetItem & {
    product_name: string;
    category: string | null;
    urun_id: number;
    avg_unit_price: number;
    min_unit_price: number;
    max_unit_price: number;
    total_amount: number;
    total_quantity: number;
    invoice_count: number;
    clean_product_name?: string;
    standard_unit?: string;
    price_per_unit?: number;
  };
  const [urunDetayModalOpened, setUrunDetayModalOpened] = useState(false);
  const [seciliUrunDetay, setSeciliUrunDetay] = useState<SeciliUrunDetayType | null>(null);

  // Veri doğrulama hataları
  const [dataValidationErrors, setDataValidationErrors] = useState<string[]>([]);

  // Ürünler tab state'leri
  const [urunArama, setUrunArama] = useState('');
  const [debouncedUrunArama] = useDebouncedValue(urunArama, 300);

  // Reçeteler tab state'leri
  const [receteArama, setReceteArama] = useState('');
  const [debouncedReceteArama] = useDebouncedValue(receteArama, 300);
  const [seciliKategoriKod, setSeciliKategoriKod] = useState<string | null>(null);

  // Hızlı reçete ekleme state'leri
  const [hizliReceteAdi, setHizliReceteAdi] = useState('');
  const [hizliReceteKategoriId, setHizliReceteKategoriId] = useState<string | null>(null);
  const [hizliReceteLoading, setHizliReceteLoading] = useState(false);

  // Reçete kategorilerini API'den çek
  const { data: receteKategorileriAPI = [] } = useQuery<
    Array<{ id: number; kod: string; ad: string; ikon: string; sira: number }>
  >({
    queryKey: ['recete-kategorileri-api'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/api/menu-planlama/kategoriler`);
      const data = await res.json();
      return data.success ? data.data : [];
    },
    staleTime: 60000,
  });

  // React Query: Reçete kategorileri
  const {
    data: receteKategorileri = [],
    isLoading: loading,
    error: receteKategorileriError,
    refetch: refetchReceteler,
  } = useQuery<ReceteKategori[]>({
    queryKey: ['recete-kategorileri'],
    queryFn: async (): Promise<ReceteKategori[]> => {
      const result = await menuPlanlamaAPI.getRecetelerMaliyet();
      if (!result.success) {
        throw new Error('Reçeteler yüklenemedi');
      }

      const receteler = (result.data || []) as BackendReceteResponse[];
      const kategoriMap = new Map<string, ReceteKategori>();

      receteler.forEach((recete: BackendReceteResponse) => {
        let kategoriKod = 'diger';
        let kategoriAdi = recete.kategori_adi || 'Diğer';
        let kategoriIkon = recete.kategori_ikon || '🍽️';

        const varsayilanKategori = VARSAYILAN_KATEGORILER.find(
          (k) => k.ad.toLowerCase() === kategoriAdi.toLowerCase()
        );

        if (varsayilanKategori) {
          kategoriKod = varsayilanKategori.kod;
          kategoriAdi = varsayilanKategori.ad;
          kategoriIkon = varsayilanKategori.ikon;
        } else {
          kategoriKod =
            kategoriAdi
              .toLowerCase()
              .replace(/[^a-z0-9]/g, '_')
              .replace(/_+/g, '_')
              .replace(/^_|_$/g, '') || 'diger';
        }

        if (!kategoriMap.has(kategoriKod)) {
          kategoriMap.set(kategoriKod, {
            kod: kategoriKod,
            ad: kategoriAdi,
            ikon: kategoriIkon,
            renk: varsayilanKategori?.renk || 'gray',
            yemekler: [],
          });
        }

        const kategori = kategoriMap.get(kategoriKod);
        if (!kategori) return;
        kategori.yemekler.push({
          id: recete.id,
          ad: recete.ad,
          kategori: kategoriKod,
          fiyat: Number(recete.tahmini_maliyet || 0),
          fatura_fiyat: Number(recete.tahmini_maliyet || 0),
          piyasa_fiyat: Number(recete.tahmini_maliyet || 0),
          porsiyon: Number(recete.porsiyon_miktar || 0),
        });
      });

      return Array.from(kategoriMap.values());
    },
    staleTime: 5 * 60 * 1000, // 5 dakika
    retry: 2,
  });

  // Error handling for recete kategorileri
  useEffect(() => {
    if (receteKategorileriError) {
      notifications.show({
        title: 'Hata',
        message: 'Reçeteler yüklenemedi. Tekrar denemek için tıklayın.',
        color: 'red',
        autoClose: false,
        onClick: () => refetchReceteler(),
      });
    }
  }, [receteKategorileriError, refetchReceteler]);

  // React Query: Maliyet özeti – Single Source (fatura_kalemleri)
  type FiyatListeUrun = MaliyetOzetItem & {
    product_name: string;
    category: string | null;
    urun_id: number;
    avg_unit_price: number;
    min_unit_price: number;
    max_unit_price: number;
    total_amount: number;
    invoice_count: number;
    total_quantity: number;
    is_food?: boolean;
    clean_product_name?: string;
    standard_unit?: string;
    price_per_unit?: number;
  };
  const {
    data: topUrunler = [],
    isLoading: fiyatLoading,
    error: topUrunlerError,
  } = useQuery<FiyatListeUrun[]>({
    queryKey: ['maliyet-ozet', 'fiyatlar'],
    queryFn: async (): Promise<FiyatListeUrun[]> => {
      const res = await faturaKalemleriAPI.getMaliyetOzet();
      if (!res.success || !Array.isArray(res.data)) return [];
      return (res.data as MaliyetOzetItem[]).map((m) => ({
        ...m,
        product_name: m.urun_ad,
        category: m.kategori_ad ?? 'Genel',
        urun_id: m.urun_id,
        avg_unit_price: Number(m.ortalama_fiyat) || 0,
        min_unit_price: Number(m.min_fiyat) || 0,
        max_unit_price: Number(m.max_fiyat) || 0,
        total_amount: Number(m.toplam_harcama) || 0,
        invoice_count: Number(m.fatura_kalem_sayisi) || 0,
        total_quantity: Number(m.toplam_alinan_miktar) || 0,
        is_food: true,
        clean_product_name: m.urun_ad,
        standard_unit: 'ADET',
        price_per_unit: Number(m.ortalama_fiyat) || 0,
      }));
    },
    staleTime: 5 * 60 * 1000,
    enabled: activeTab === 'fiyatlar',
    retry: 2,
  });

  // Error handling for top ürünler
  useEffect(() => {
    if (topUrunlerError) {
      notifications.show({
        title: 'Hata',
        message: 'En çok alınan ürünler yüklenemedi',
        color: 'red',
      });
    }
  }, [topUrunlerError]);

  // Zaman aralığına göre ay sayısı
  const _monthsMap = {
    '3m': 3,
    '6m': 6,
    '1y': 12,
    all: 24,
  };

  // React Query: Fiyat trendi – Single Source (fatura_kalemleri, urunId ile)
  const {
    data: fiyatTrendi = [],
    isLoading: trendLoading,
    error: trendError,
  } = useQuery<PriceHistoryData[]>({
    queryKey: ['fiyat-gecmisi', seciliFiyatUrunId, timeRange],
    queryFn: async (): Promise<PriceHistoryData[]> => {
      if (seciliFiyatUrunId == null) return [];
      const rows = (await faturaKalemleriAPI.getFiyatGecmisi(
        String(seciliFiyatUrunId),
        500
      )) as FiyatGecmisiItem[];
      if (rows.length === 0) return [];
      // Aylık grupla (PriceHistoryData formatına dönüştür)
      const byMonth = new Map<string, { sum: number; cnt: number; qty: number; amount: number }>();
      for (const r of rows) {
        const d = r.fatura_tarihi ? format(parseISO(r.fatura_tarihi), 'yyyy-MM') : '';
        if (!d) continue;
        const cur = byMonth.get(d) || { sum: 0, cnt: 0, qty: 0, amount: 0 };
        cur.sum += Number(r.birim_fiyat) || 0;
        cur.cnt += 1;
        cur.qty += Number(r.miktar) || 0;
        cur.amount += Number(r.tutar) || 0;
        byMonth.set(d, cur);
      }
      const sorted = Array.from(byMonth.entries()).sort((a, b) => a[0].localeCompare(b[0]));
      return sorted.map(([month, v]) => ({
        month: `${month}-01`,
        avg_price: v.cnt ? v.sum / v.cnt : 0,
        transaction_count: v.cnt,
        total_quantity: v.qty,
        total_amount: v.amount,
        min_price: v.cnt ? v.sum / v.cnt : 0,
        max_price: v.cnt ? v.sum / v.cnt : 0,
        change_percent: 0,
        trend: 'stable' as const,
      }));
    },
    enabled: seciliFiyatUrunId != null,
    staleTime: 2 * 60 * 1000,
    retry: 2,
  });

  // Error handling for fiyat trendi
  useEffect(() => {
    if (trendError) {
      notifications.show({
        title: 'Hata',
        message: 'Fiyat trendi yüklenemedi',
        color: 'red',
      });
    }
  }, [trendError]);

  // Batch kaldırıldı – Single Source: fatura_kalemleri, kalemler fatura açıldıkça doldurulur
  const renderBatchProcessButton = () => null;

  // React Query: Ürünler
  const {
    data: urunler = [],
    isLoading: urunlerLoading,
    error: urunlerError,
  } = useQuery<UrunKarti[]>({
    queryKey: ['urunler', debouncedUrunArama],
    queryFn: async (): Promise<UrunKarti[]> => {
      const res = await urunlerAPI.getUrunler({
        limit: 1000, // Tüm ürünleri getir
        arama: debouncedUrunArama || undefined,
      });
      if (!res.success) {
        throw new Error('Ürünler yüklenemedi');
      }
      return res.data || [];
    },
    staleTime: 5 * 60 * 1000,
    enabled: activeTab === 'urunler',
    retry: 2,
  });

  // Error handling for ürünler
  useEffect(() => {
    if (urunlerError) {
      notifications.show({
        title: 'Hata',
        message: 'Ürünler yüklenemedi',
        color: 'red',
      });
    }
  }, [urunlerError]);

  // React Query: Reçeteler listesi
  const {
    data: receteler = [],
    isLoading: recetelerLoading,
    error: recetelerError,
  } = useQuery<Recete[]>({
    queryKey: ['receteler', debouncedReceteArama],
    queryFn: async (): Promise<Recete[]> => {
      const res = await menuPlanlamaAPI.getReceteler({
        limit: 1000, // Tüm reçeteleri getir
        arama: debouncedReceteArama || undefined,
      });
      if (!res.success) {
        throw new Error('Reçeteler yüklenemedi');
      }
      return res.data || [];
    },
    staleTime: 5 * 60 * 1000,
    enabled: activeTab === 'receteler',
    retry: 2,
  });

  // Error handling for receteler
  useEffect(() => {
    if (recetelerError) {
      notifications.show({
        title: 'Hata',
        message: 'Reçeteler yüklenemedi',
        color: 'red',
      });
    }
  }, [recetelerError]);

  // Realtime hook
  useRealtimeRefetch(['menu_items', 'urunler'], () => {
    queryClient.invalidateQueries({ queryKey: ['recete-kategorileri'] });
    queryClient.invalidateQueries({ queryKey: ['receteler'] });
    queryClient.invalidateQueries({ queryKey: ['urunler'] });
  });

  // Kategori için reçeteleri getir
  const getRecetelerForKategori = (kategoriKod: string): ReceteYemek[] => {
    const kategori = receteKategorileri.find((k) => k.kod === kategoriKod);
    return kategori?.yemekler || [];
  };

  // React Query: Reçete detayı
  const [receteDetayId, setReceteDetayId] = useState<number | null>(null);

  const {
    data: receteDetayData,
    isLoading: detayLoading,
    error: receteDetayError,
  } = useQuery<ReceteDetay>({
    queryKey: ['recete-detay', receteDetayId],
    queryFn: async (): Promise<ReceteDetay> => {
      if (!receteDetayId) throw new Error('Reçete ID gerekli');

      const result = await menuPlanlamaAPI.getMaliyetAnalizi(receteDetayId);
      if (!result.success || !result.data) {
        throw new Error('Reçete detayı yüklenemedi');
      }

      const backendData = result.data as unknown as BackendMaliyetAnaliziResponse;

      return {
        id: backendData.recete.id,
        kod: backendData.recete.kod || '',
        ad: backendData.recete.ad,
        kategori: backendData.recete.kategori || 'Diğer',
        porsiyon_gram: backendData.recete.porsiyon || 0,
        sistem_maliyet: backendData.maliyet.sistem,
        piyasa_maliyet: backendData.maliyet.piyasa,
        malzemeler: backendData.malzemeler.map((m) => ({
          id: m.id,
          malzeme_adi: m.malzeme_adi,
          miktar: m.miktar,
          birim: m.birim,
          stok_kart_id: null,
          stok_adi: null,
          sistem_fiyat: m.sistem_fiyat,
          piyasa_fiyat: m.piyasa_fiyat,
          stok_birim: null,
        })),
      };
    },
    enabled: !!receteDetayId,
    retry: 2,
  });

  // Error handling for recete detay
  useEffect(() => {
    if (receteDetayError) {
      notifications.show({
        title: 'Hata',
        message: 'Reçete detayı yüklenemedi',
        color: 'red',
      });
    }
  }, [receteDetayError]);

  // Reçete detayını getir
  const fetchReceteDetay = useCallback((receteId: number) => {
    setReceteDetayId(receteId);
    setDetayModalOpened(true);
  }, []);

  // Hızlı reçete ekleme fonksiyonu (AI ile malzeme önerisi dahil)
  const handleHizliReceteEkle = useCallback(async () => {
    if (!hizliReceteAdi.trim()) {
      notifications.show({
        title: 'Hata',
        message: 'Reçete adı giriniz',
        color: 'red',
      });
      return;
    }

    setHizliReceteLoading(true);
    try {
      // 1. Önce reçeteyi oluştur
      const createRes = await fetch(`${API_BASE_URL}/api/menu-planlama/receteler`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ad: hizliReceteAdi.trim(),
          kategori_id: hizliReceteKategoriId ? parseInt(hizliReceteKategoriId, 10) : null,
          porsiyon_miktar: 1,
          ai_olusturuldu: true,
        }),
      });
      const createData = await createRes.json();

      if (!createData.success) {
        throw new Error(createData.error || 'Reçete oluşturulamadı');
      }

      const yeniReceteId = createData.data.id;

      // 2. AI ile malzeme önerisi al
      notifications.show({
        id: 'ai-loading',
        title: 'AI Çalışıyor',
        message: 'Malzemeler öneriliyor...',
        loading: true,
        autoClose: false,
      });

      const aiRes = await fetch(
        `${API_BASE_URL}/api/menu-planlama/receteler/${yeniReceteId}/ai-malzeme-oneri`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }
      );
      const aiData = await aiRes.json();

      notifications.hide('ai-loading');

      if (aiData.success && aiData.data?.malzemeler?.length > 0) {
        // 3. AI önerdiği malzemeleri ekle
        for (const malzeme of aiData.data.malzemeler) {
          await fetch(`${API_BASE_URL}/api/menu-planlama/receteler/${yeniReceteId}/malzemeler`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              malzeme_adi: malzeme.malzeme_adi,
              miktar: malzeme.miktar,
              birim: malzeme.birim || 'gr',
              urun_kart_id: malzeme.urun_kart_id || null,
            }),
          });
        }

        notifications.show({
          title: 'Başarılı',
          message: `"${hizliReceteAdi}" reçetesi ${aiData.data.malzemeler.length} malzeme ile oluşturuldu`,
          color: 'teal',
        });
      } else {
        notifications.show({
          title: 'Reçete Oluşturuldu',
          message: `"${hizliReceteAdi}" oluşturuldu. Malzemeleri manuel ekleyebilirsiniz.`,
          color: 'blue',
        });
      }

      // Formu temizle ve listeyi yenile
      setHizliReceteAdi('');
      setHizliReceteKategoriId(null);
      queryClient.invalidateQueries({ queryKey: ['receteler'] });
      queryClient.invalidateQueries({ queryKey: ['recete-kategorileri'] });

      // Yeni reçetenin detayını aç
      fetchReceteDetay(yeniReceteId);
    } catch (error) {
      notifications.hide('ai-loading');
      notifications.show({
        title: 'Hata',
        message: error instanceof Error ? error.message : 'Reçete oluşturulamadı',
        color: 'red',
      });
    } finally {
      setHizliReceteLoading(false);
    }
  }, [hizliReceteAdi, hizliReceteKategoriId, queryClient, fetchReceteDetay]);

  // Modal kapandığında detayı temizle
  useEffect(() => {
    if (!detayModalOpened) {
      setReceteDetayId(null);
      setReceteDetay(null);
    } else if (receteDetayData) {
      setReceteDetay(receteDetayData);
    }
  }, [detayModalOpened, receteDetayData]);

  // Fiyat trendi fetch fonksiyonu (ürün seçimi için)
  const handleFiyatTrendiSec = useCallback(
    (urunId: number, urunAdi: string) => {
      setSeciliFiyatUrunId(urunId);
      setSeciliFiyatUrunAd(urunAdi);
      if (selectedProducts.length < 2 && !selectedProducts.includes(urunAdi)) {
        setSelectedProducts([...selectedProducts, urunAdi]);
      }
    },
    [selectedProducts]
  );

  const validateProductData = useCallback((data: SeciliUrunDetayType): string[] => {
    const errors: string[] = [];
    const total = data.total_amount ?? data.toplam_harcama ?? 0;
    const avg = data.avg_unit_price ?? data.ortalama_fiyat ?? 0;
    const qty = data.total_quantity ?? data.toplam_alinan_miktar ?? 0;
    const minP = data.min_unit_price ?? data.min_fiyat;
    const maxP = data.max_unit_price ?? data.max_fiyat;
    const invCnt = data.invoice_count ?? data.fatura_kalem_sayisi ?? 0;
    if (total < 0) errors.push('Toplam tutar negatif olamaz');
    if (avg && qty > 0 && Math.abs(total / qty - avg) > 0.01)
      errors.push('Ortalama fiyat tutarsız');
    if (minP != null && maxP != null && minP > maxP)
      errors.push('Min fiyat max fiyattan büyük olamaz');
    if (qty < 0) errors.push('Toplam miktar negatif olamaz');
    if (invCnt < 0) errors.push('Fatura sayısı negatif olamaz');
    return errors;
  }, []);

  // Ürün detayını aç
  const handleUrunDetayAc = useCallback(
    (urun: SeciliUrunDetayType) => {
      // Veri doğrulama
      const errors = validateProductData(urun);
      setDataValidationErrors(errors);

      if (errors.length > 0) {
        notifications.show({
          title: 'Veri Uyarısı',
          message: `Veri tutarsızlıkları tespit edildi: ${errors.join(', ')}`,
          color: 'orange',
          autoClose: 5000,
        });
      }

      setSeciliUrunDetay(urun);
      setUrunDetayModalOpened(true);
    },
    [validateProductData]
  );

  // React Query: Son işlemler – Single Source (fatura_kalemleri, fiyat geçmişi)
  type SonIslemRow = {
    id?: number;
    invoice_date?: string;
    invoice_no?: string;
    supplier_name?: string;
    unit_price?: number;
    quantity?: number;
    line_total?: number;
    description?: string;
    unit?: string;
  };
  const { data: sonIslemler = [], isLoading: sonIslemlerLoading } = useQuery<SonIslemRow[]>({
    queryKey: ['fiyat-gecmisi-recent', seciliUrunDetay?.urun_id],
    queryFn: async (): Promise<SonIslemRow[]> => {
      const urunId = seciliUrunDetay?.urun_id;
      if (urunId == null) return [];
      const rows = (await faturaKalemleriAPI.getFiyatGecmisi(
        String(urunId),
        10
      )) as FiyatGecmisiItem[];
      return rows.map((r, i) => ({
        id: i,
        invoice_date: r.fatura_tarihi ?? undefined,
        supplier_name: r.tedarikci_ad ?? undefined,
        unit_price: r.birim_fiyat,
        quantity: r.miktar,
        line_total: r.tutar,
        description: r.orijinal_urun_adi,
        unit: r.birim ?? undefined,
      }));
    },
    enabled: !!seciliUrunDetay?.urun_id && urunDetayModalOpened,
    staleTime: 2 * 60 * 1000,
  });

  // React Query: Tedarikçi analizi – Single Source (fatura_kalemleri raporu)
  type TedarikciAnalizRow = {
    supplier_name: string;
    invoice_count: number;
    total_quantity: number;
    total_amount: number;
    avg_unit_price: number;
    min_unit_price: number;
    max_unit_price: number;
  };
  const { data: tedarikciAnalizi = [], isLoading: tedarikciLoading } = useQuery<
    TedarikciAnalizRow[]
  >({
    queryKey: ['tedarikci-karsilastirma', seciliUrunDetay?.urun_id],
    queryFn: async (): Promise<TedarikciAnalizRow[]> => {
      const urunId = seciliUrunDetay?.urun_id;
      if (urunId == null) return [];
      const rows = (await faturaKalemleriAPI.getTedarikciKarsilastirma(urunId)) ?? [];
      return (Array.isArray(rows) ? rows : []).map(
        (r: {
          tedarikci_ad?: string;
          ortalama_fiyat?: number;
          fatura_sayisi?: number;
          min_fiyat?: number;
          max_fiyat?: number;
        }) => ({
          supplier_name: r.tedarikci_ad || 'Bilinmeyen',
          invoice_count: Number(r.fatura_sayisi) || 0,
          total_quantity: 0,
          total_amount: Number(r.ortalama_fiyat) || 0,
          avg_unit_price: Number(r.ortalama_fiyat) || 0,
          min_unit_price: Number(r.min_fiyat) || 0,
          max_unit_price: Number(r.max_fiyat) || 0,
        })
      );
    },
    enabled: !!seciliUrunDetay?.urun_id && urunDetayModalOpened,
    staleTime: 5 * 60 * 1000,
  });

  // React Query: Mini grafik – Single Source (fatura_kalemleri, urunId ile)
  const { data: miniTrendData = [] } = useQuery<PriceHistoryData[]>({
    queryKey: ['fiyat-gecmisi-mini', seciliUrunDetay?.urun_id],
    queryFn: async (): Promise<PriceHistoryData[]> => {
      const urunId = seciliUrunDetay?.urun_id;
      if (urunId == null) return [];
      const rows = (await faturaKalemleriAPI.getFiyatGecmisi(
        String(urunId),
        100
      )) as FiyatGecmisiItem[];
      const byMonth = new Map<string, { sum: number; cnt: number }>();
      for (const r of rows) {
        const d = r.fatura_tarihi ? format(parseISO(r.fatura_tarihi), 'yyyy-MM') : '';
        if (!d) continue;
        const cur = byMonth.get(d) || { sum: 0, cnt: 0 };
        cur.sum += Number(r.birim_fiyat) || 0;
        cur.cnt += 1;
        byMonth.set(d, cur);
      }
      return Array.from(byMonth.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([month, v]) => ({ month: `${month}-01`, avg_price: v.cnt ? v.sum / v.cnt : 0 }));
    },
    enabled: !!seciliUrunDetay?.urun_id && urunDetayModalOpened,
    staleTime: 2 * 60 * 1000,
  });

  // Mini grafik için formatlanmış data
  const miniChartData = useMemo(() => {
    return miniTrendData.map((item) => {
      try {
        const monthDate = parseISO(item.month);
        return {
          ...item,
          month: format(monthDate, 'yyyy-MM', { locale: tr }),
          monthLabel: format(monthDate, 'MMM yyyy', { locale: tr }),
        };
      } catch {
        return {
          ...item,
          month: typeof item.month === 'string' ? item.month.slice(0, 7) : item.month,
          monthLabel: typeof item.month === 'string' ? item.month.slice(0, 7) : String(item.month),
        };
      }
    });
  }, [miniTrendData]);

  // Zaman bazlı karşılaştırma (bu ay vs geçen ay)
  const zamanKarsilastirma = useMemo(() => {
    if (miniTrendData.length < 2) return null;

    const sorted = [...miniTrendData].sort(
      (a, b) => new Date(a.month).getTime() - new Date(b.month).getTime()
    );

    const sonAy = sorted[sorted.length - 1];
    const oncekiAy = sorted[sorted.length - 2];

    if (!sonAy || !oncekiAy) return null;

    const fark = sonAy.avg_price - oncekiAy.avg_price;
    const farkYuzde = oncekiAy.avg_price > 0 ? (fark / oncekiAy.avg_price) * 100 : 0;

    return {
      buAy: sonAy.avg_price,
      geçenAy: oncekiAy.avg_price,
      fark,
      farkYuzde,
      trend: fark > 0 ? 'increasing' : fark < 0 ? 'decreasing' : ('stable' as const),
    };
  }, [miniTrendData]);

  // Export fonksiyonları
  const exportToPDF = useCallback(() => {
    if (!seciliUrunDetay) return;

    // Basit PDF export (window.print kullanarak)
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>${seciliUrunDetay.product_name} - Fiyat Analizi</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; }
              h1 { color: #333; }
              table { width: 100%; border-collapse: collapse; margin: 20px 0; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #f2f2f2; }
            </style>
          </head>
          <body>
            <h1>${seciliUrunDetay.product_name} - Detaylı Fiyat Analizi</h1>
            <h2>Özet Bilgiler</h2>
            <table>
              <tr><th>Toplam Tutar</th><td>${formatMoney(seciliUrunDetay.total_amount)}</td></tr>
              <tr><th>Ortalama Fiyat</th><td>₺${seciliUrunDetay.avg_unit_price?.toFixed(2) || '0'}</td></tr>
              <tr><th>Min Fiyat</th><td>₺${seciliUrunDetay.min_unit_price?.toFixed(2) || '0'}</td></tr>
              <tr><th>Max Fiyat</th><td>₺${seciliUrunDetay.max_unit_price?.toFixed(2) || '0'}</td></tr>
              <tr><th>Toplam Miktar</th><td>${seciliUrunDetay.total_quantity.toFixed(2)}</td></tr>
              <tr><th>Fatura Sayısı</th><td>${seciliUrunDetay.invoice_count}</td></tr>
              <tr><th>Kategori</th><td>${seciliUrunDetay.category || 'Genel'}</td></tr>
            </table>
            <p>Rapor Tarihi: ${format(new Date(), 'dd MMMM yyyy HH:mm', { locale: tr })}</p>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  }, [seciliUrunDetay]);

  const exportToExcel = useCallback(() => {
    if (!seciliUrunDetay) return;

    // CSV formatında export
    const csvData = [
      [
        'Ürün Adı',
        'Toplam Tutar',
        'Ortalama Fiyat',
        'Min Fiyat',
        'Max Fiyat',
        'Toplam Miktar',
        'Fatura Sayısı',
        'Kategori',
      ],
      [
        seciliUrunDetay.product_name,
        seciliUrunDetay.total_amount.toString(),
        (seciliUrunDetay.avg_unit_price || 0).toString(),
        (seciliUrunDetay.min_unit_price || 0).toString(),
        (seciliUrunDetay.max_unit_price || 0).toString(),
        seciliUrunDetay.total_quantity.toString(),
        seciliUrunDetay.invoice_count.toString(),
        seciliUrunDetay.category || 'Genel',
      ],
    ];

    const csv = csvData.map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `${seciliUrunDetay.product_name.replace(/[^a-z0-9]/gi, '_')}_analiz.csv`
    );
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [seciliUrunDetay]);

  // Yemek seç
  const handleYemekSec = (kategori: string, yemek: ReceteYemek) => {
    const id = `recete-${yemek.id}`;
    const mevcut = seciliYemekler.find((y) => y.id === id);

    if (mevcut) {
      // Zaten var, kaldır
      setSeciliYemekler(seciliYemekler.filter((y) => y.id !== id));
    } else {
      // Ekle
      setSeciliYemekler([
        ...seciliYemekler,
        {
          id,
          recete_id: yemek.id,
          kategori,
          ad: yemek.ad,
          fiyat: yemek.piyasa_maliyet || yemek.sistem_maliyet || 0,
          fatura_fiyat: yemek.fatura_maliyet || yemek.sistem_maliyet || 0,
          piyasa_fiyat: yemek.piyasa_maliyet || 0,
        },
      ]);
      notifications.show({
        message: `${yemek.ad} eklendi`,
        color: 'teal',
        autoClose: 1000,
      });
    }
  };

  // Kategorileri backend'den gelen veriden çıkar (memoized)
  const KATEGORILER = useMemo<KategoriInfo[]>(() => {
    if (receteKategorileri.length === 0) {
      return VARSAYILAN_KATEGORILER;
    }
    // Backend'den gelen kategorileri kullan
    return receteKategorileri.map((k) => ({
      kod: k.kod,
      ad: k.ad,
      ikon: k.ikon,
      renk: k.renk || 'gray',
    }));
  }, [receteKategorileri]);

  // Filtrelenmiş ürünler (memoized)
  const filteredUrunler = useMemo(() => {
    if (!debouncedUrunArama) return urunler;
    const arama = debouncedUrunArama.toLowerCase().trim();
    return urunler.filter(
      (u) => u.ad?.toLowerCase().includes(arama) || u.kod?.toLowerCase().includes(arama)
    );
  }, [urunler, debouncedUrunArama]);

  // Filtrelenmiş reçeteler (memoized)
  const filteredReceteler = useMemo(() => {
    let sonuc = receteler;

    // Kategori filtresi
    if (seciliKategoriKod) {
      const seciliKat = receteKategorileriAPI.find((k) => k.kod === seciliKategoriKod);
      if (seciliKat) {
        sonuc = sonuc.filter((r) => r.kategori_adi === seciliKat.ad);
      }
    }

    // Arama filtresi
    if (debouncedReceteArama && debouncedReceteArama.trim() !== '') {
      const arama = debouncedReceteArama.toLowerCase().trim();
      sonuc = sonuc.filter(
        (r) =>
          r.ad?.toLowerCase().includes(arama) ||
          r.kategori_adi?.toLowerCase().includes(arama) ||
          r.kategori?.toLowerCase().includes(arama)
      );
    }

    return sonuc;
  }, [receteler, debouncedReceteArama, seciliKategoriKod, receteKategorileriAPI]);

  // Fiyat trendi için formatlanmış data (memoized)
  const chartData = useMemo(() => {
    return fiyatTrendi.map((item) => {
      try {
        const monthDate = parseISO(item.month);
        return {
          ...item,
          month: format(monthDate, 'yyyy-MM', { locale: tr }),
          monthLabel: format(monthDate, 'MMM yyyy', { locale: tr }),
        };
      } catch {
        return {
          ...item,
          month: typeof item.month === 'string' ? item.month.slice(0, 7) : item.month,
          monthLabel: typeof item.month === 'string' ? item.month.slice(0, 7) : String(item.month),
        };
      }
    });
  }, [fiyatTrendi]);

  // Fiyat trendi istatistikleri (memoized)
  const fiyatIstatistikleri = useMemo(() => {
    if (fiyatTrendi.length === 0) return null;

    const prices = fiyatTrendi.map((d) => d.avg_price);
    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const firstPrice = fiyatTrendi[0]?.avg_price || 0;
    const lastPrice = fiyatTrendi[fiyatTrendi.length - 1]?.avg_price || 0;
    const changePercent = firstPrice > 0 ? ((lastPrice - firstPrice) / firstPrice) * 100 : 0;

    return {
      avgPrice,
      minPrice,
      maxPrice,
      changePercent,
      trend:
        changePercent > 0 ? 'increasing' : changePercent < 0 ? 'decreasing' : ('stable' as const),
    };
  }, [fiyatTrendi]);

  if (loading) {
    return (
      <Center h="100vh">
        <Stack align="center" gap="md">
          <Loader size="lg" color="teal" />
          <Text c="dimmed">Yükleniyor...</Text>
        </Stack>
      </Center>
    );
  }

  return (
    <Box
      style={{
        minHeight: '100vh',
        background:
          'linear-gradient(180deg, rgba(20, 184, 166, 0.03) 0%, rgba(59, 130, 246, 0.03) 100%)',
      }}
    >
      {/* Ana Layout: Sol Sidebar + İçerik */}
      <Group align="flex-start" gap={0} wrap="nowrap">
        {/* Sol Sidebar - Mobilde gizli */}
        {!isMobile && (
          <MenuSidebar activeCategory={activeCategory} onCategoryChange={setActiveCategory} />
        )}

        {/* Ana İçerik Alanı */}
        <Box style={{ flex: 1, minWidth: 0, paddingBottom: isMobile ? 70 : 0 }}>
          <Container size="xl" py="md">
            {/* Ana İçerik */}
            <Box>
              <Tabs value={activeTab} onChange={setActiveTab} variant="outline" radius="md">
                {/* Dinamik Tab Listesi - Kategoriye göre değişir */}
                <Tabs.List mb="md">
                  {currentTabs.map((tab) => (
                    <Tabs.Tab
                      key={tab.id}
                      value={tab.id}
                      leftSection={
                        tab.id === 'yemekler' ? (
                          <IconToolsKitchen2 size={16} />
                        ) : tab.id === 'urunler' ? (
                          <IconPackages size={16} />
                        ) : tab.id === 'receteler' ? (
                          <IconBook2 size={16} />
                        ) : tab.id === 'fiyatlar' ? (
                          <IconChartLine size={16} />
                        ) : tab.id === 'takvim' ? (
                          <IconCalendar size={16} />
                        ) : tab.id === 'maliyet' ? (
                          <IconCurrencyLira size={16} />
                        ) : tab.id === 'menuler' ? (
                          <IconFile size={16} />
                        ) : null
                      }
                    >
                      {tab.label}
                    </Tabs.Tab>
                  ))}
                </Tabs.List>

                {/* Tab: Ürünler - Tam özellikli */}
                <Tabs.Panel value="urunler">
                  <Paper p="md" withBorder radius="lg">
                    <Group justify="space-between" mb="md">
                      <Group gap="sm">
                        <Text fw={600} size="lg">
                          📦 Ürün Kartları
                        </Text>
                        <Badge variant="light" color="indigo">
                          {filteredUrunler.length} / {urunler.length} ürün
                        </Badge>
                      </Group>
                    </Group>

                    <TextInput
                      placeholder="Ürün ara (kod, ad)..."
                      leftSection={<IconSearch size={16} />}
                      value={urunArama}
                      onChange={(e) => setUrunArama(e.target.value)}
                      mb="md"
                    />

                    {urunlerLoading ? (
                      <Stack gap="xs">
                        <Skeleton height={60} radius="md" />
                        <Skeleton height={60} radius="md" />
                        <Skeleton height={60} radius="md" />
                        <Skeleton height={60} radius="md" />
                        <Skeleton height={60} radius="md" />
                      </Stack>
                    ) : (
                      <ScrollArea.Autosize mah={500}>
                        <Stack gap="xs">
                          {filteredUrunler.map((urun) => (
                            <Paper
                              key={urun.id}
                              p="sm"
                              withBorder
                              radius="md"
                              style={{ cursor: 'pointer' }}
                            >
                              <Group justify="space-between">
                                <Group gap="sm" style={{ flex: 1 }}>
                                  <Badge size="sm" variant="light" color="gray">
                                    {urun.kod}
                                  </Badge>
                                  <Box style={{ flex: 1 }}>
                                    <Text size="sm" fw={500}>
                                      {urun.ad}
                                    </Text>
                                    <Text size="xs" c="dimmed">
                                      {urun.kategori || 'Kategorisiz'}
                                    </Text>
                                  </Box>
                                </Group>
                                <Stack gap={2} align="flex-end">
                                  <Group gap="xs">
                                    <Text size="sm" fw={600}>
                                      {Number(urun.toplam_stok || 0).toFixed(1)}{' '}
                                      {urun.birim_kisa || urun.birim || 'Ad'}
                                    </Text>
                                    <Badge
                                      size="xs"
                                      color={
                                        urun.durum === 'kritik'
                                          ? 'red'
                                          : urun.durum === 'dusuk'
                                            ? 'orange'
                                            : 'green'
                                      }
                                    >
                                      {urun.durum || 'normal'}
                                    </Badge>
                                  </Group>
                                  {urun.son_alis_fiyati && (
                                    <Text size="xs" c="blue" fw={500}>
                                      ₺{Number(urun.son_alis_fiyati).toFixed(2)}/
                                      {urun.birim_kisa || 'kg'}
                                    </Text>
                                  )}
                                </Stack>
                              </Group>
                            </Paper>
                          ))}
                          {filteredUrunler.length === 0 && (
                            <Center py="xl">
                              <Stack align="center" gap="sm">
                                <IconPackages size={40} color="var(--mantine-color-gray-5)" />
                                <Text size="sm" c="dimmed">
                                  {urunler.length === 0
                                    ? 'Henüz ürün kartı yok'
                                    : 'Arama sonucu bulunamadı'}
                                </Text>
                              </Stack>
                            </Center>
                          )}
                        </Stack>
                      </ScrollArea.Autosize>
                    )}
                  </Paper>
                </Tabs.Panel>

                {/* Tab 3: Reçeteler - Tam özellikli */}
                <Tabs.Panel value="receteler">
                  <Paper p="md" withBorder radius="lg">
                    {/* Premium Header */}
                    <Group justify="space-between" mb="lg">
                      <Text fw={500} size="md" c="dimmed">
                        Reçete Kataloğu
                      </Text>
                      <Text size="xs" c="dimmed">
                        {filteredReceteler.length} / {receteler.length}
                      </Text>
                    </Group>

                    {/* Hızlı Reçete Ekleme Satırı */}
                    <Paper
                      p="sm"
                      mb="md"
                      radius="md"
                      style={{
                        background:
                          'linear-gradient(135deg, var(--mantine-color-teal-9) 0%, var(--mantine-color-cyan-9) 100%)',
                        border: '1px solid var(--mantine-color-teal-7)',
                      }}
                    >
                      <Group gap="sm" wrap="nowrap">
                        <TextInput
                          placeholder="Reçete adı yazın (örn: Mercimek Çorbası)"
                          value={hizliReceteAdi}
                          onChange={(e) => setHizliReceteAdi(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !hizliReceteLoading) {
                              handleHizliReceteEkle();
                            }
                          }}
                          leftSection={<IconPlus size={16} />}
                          size="sm"
                          radius="md"
                          style={{ flex: 1 }}
                          styles={{
                            input: {
                              background: 'var(--mantine-color-dark-7)',
                              border: 'none',
                              '&::placeholder': {
                                color: 'var(--mantine-color-dark-3)',
                              },
                            },
                          }}
                          disabled={hizliReceteLoading}
                        />
                        <Select
                          placeholder="Kategori"
                          value={hizliReceteKategoriId}
                          onChange={setHizliReceteKategoriId}
                          data={receteKategorileriAPI.map((k) => ({
                            value: k.id.toString(),
                            label: `${k.ikon} ${k.ad}`,
                          }))}
                          size="sm"
                          radius="md"
                          w={160}
                          clearable
                          styles={{
                            input: {
                              background: 'var(--mantine-color-dark-7)',
                              border: 'none',
                            },
                          }}
                          disabled={hizliReceteLoading}
                          comboboxProps={{ withinPortal: true }}
                        />
                        <Button
                          size="sm"
                          radius="md"
                          variant="white"
                          color="dark"
                          leftSection={<IconSparkles size={16} />}
                          onClick={handleHizliReceteEkle}
                          loading={hizliReceteLoading}
                          disabled={!hizliReceteAdi.trim()}
                        >
                          AI ile Oluştur
                        </Button>
                      </Group>
                      <Text size="xs" c="white" mt={6} opacity={0.8}>
                        Reçete adını yazın, AI otomatik malzemeleri önersin
                      </Text>
                    </Paper>

                    {/* Premium Search */}
                    <TextInput
                      placeholder="Ara..."
                      leftSection={<IconSearch size={14} stroke={1.5} />}
                      value={receteArama}
                      onChange={(e) => setReceteArama(e.target.value)}
                      mb="md"
                      size="sm"
                      radius="md"
                      styles={{
                        input: {
                          background: 'var(--mantine-color-dark-6)',
                          border: 'none',
                          '&:focus': {
                            border: 'none',
                          },
                        },
                      }}
                    />

                    {/* Premium Kategori Filter - Minimal Pill Style */}
                    <ScrollArea scrollbarSize={0} offsetScrollbars={false} mb="lg">
                      <Group gap={8} wrap="nowrap">
                        <UnstyledButton
                          onClick={() => setSeciliKategoriKod(null)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: 20,
                            background:
                              seciliKategoriKod === null
                                ? 'var(--mantine-color-dark-4)'
                                : 'transparent',
                            transition: 'all 0.2s ease',
                          }}
                        >
                          <Text
                            size="xs"
                            fw={seciliKategoriKod === null ? 500 : 400}
                            c={seciliKategoriKod === null ? 'white' : 'dimmed'}
                          >
                            Tümü
                          </Text>
                        </UnstyledButton>
                        {receteKategorileriAPI.map((kat) => {
                          const katSayisi = receteler.filter(
                            (r) => r.kategori_adi === kat.ad
                          ).length;
                          if (katSayisi === 0) return null;
                          const isActive = seciliKategoriKod === kat.kod;
                          return (
                            <UnstyledButton
                              key={kat.kod}
                              onClick={() => setSeciliKategoriKod(kat.kod)}
                              style={{
                                padding: '6px 12px',
                                borderRadius: 20,
                                background: isActive
                                  ? 'var(--mantine-color-dark-4)'
                                  : 'transparent',
                                transition: 'all 0.2s ease',
                              }}
                            >
                              <Group gap={6} wrap="nowrap">
                                <Text size="sm" style={{ lineHeight: 1 }}>
                                  {kat.ikon}
                                </Text>
                                <Text
                                  size="xs"
                                  fw={isActive ? 500 : 400}
                                  c={isActive ? 'white' : 'dimmed'}
                                >
                                  {kat.ad}
                                </Text>
                              </Group>
                            </UnstyledButton>
                          );
                        })}
                      </Group>
                    </ScrollArea>

                    {recetelerLoading ? (
                      <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} spacing="sm">
                        <Skeleton height={140} radius="lg" />
                        <Skeleton height={140} radius="lg" />
                        <Skeleton height={140} radius="lg" />
                        <Skeleton height={140} radius="lg" />
                        <Skeleton height={140} radius="lg" />
                        <Skeleton height={140} radius="lg" />
                        <Skeleton height={140} radius="lg" />
                        <Skeleton height={140} radius="lg" />
                      </SimpleGrid>
                    ) : filteredReceteler.length === 0 ? (
                      <Center py="xl">
                        <Stack align="center" gap="sm">
                          <IconBook2 size={40} color="var(--mantine-color-gray-5)" />
                          <Text size="sm" c="dimmed">
                            {receteler.length === 0
                              ? 'Henüz reçete yok'
                              : 'Arama sonucu bulunamadı'}
                          </Text>
                        </Stack>
                      </Center>
                    ) : (
                      <ScrollArea.Autosize mah={520}>
                        <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} spacing="sm">
                          {filteredReceteler.map((recete) => {
                            const kategoriAdi =
                              recete.kategori_adi || recete.kategori || 'Kategorisiz';
                            const kategoriInfo = KATEGORILER.find(
                              (k) =>
                                k.ad === kategoriAdi ||
                                (recete.kategori && k.kod === recete.kategori)
                            );
                            const maliyet = Number(
                              recete.tahmini_maliyet || recete.toplam_maliyet || 0
                            );
                            const malzemeSayisi =
                              recete.malzeme_sayisi || recete.malzemeler?.length || 0;
                            const porsiyon = recete.porsiyon_miktar || recete.porsiyon;
                            const kalori = recete.kalori;
                            const hazirlama = recete.hazirlik_suresi;
                            const pisirme = recete.pisirme_suresi;
                            const toplamSure = (hazirlama || 0) + (pisirme || 0);

                            return (
                              <UnstyledButton
                                key={recete.id}
                                onClick={() => fetchReceteDetay(recete.id)}
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  padding: '14px',
                                  borderRadius: 16,
                                  background: 'var(--mantine-color-dark-6)',
                                  transition: 'all 0.2s ease',
                                  height: '100%',
                                  minHeight: 155,
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = 'var(--mantine-color-dark-5)';
                                  e.currentTarget.style.transform = 'translateY(-2px)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'var(--mantine-color-dark-6)';
                                  e.currentTarget.style.transform = 'translateY(0)';
                                }}
                              >
                                {/* Top: Icon & Price */}
                                <Group justify="space-between" mb="xs" w="100%">
                                  <Box
                                    style={{
                                      width: 40,
                                      height: 40,
                                      borderRadius: 10,
                                      background: 'var(--mantine-color-dark-5)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                    }}
                                  >
                                    <Text size="lg">
                                      {kategoriInfo?.ikon || recete.kategori_ikon || '🍽️'}
                                    </Text>
                                  </Box>
                                  {maliyet > 0 && !Number.isNaN(maliyet) && (
                                    <Text size="sm" fw={600} c="teal">
                                      ₺{maliyet.toFixed(2)}
                                    </Text>
                                  )}
                                </Group>

                                {/* Name */}
                                <Text size="sm" fw={500} lineClamp={2} mb={6} style={{ flex: 1 }}>
                                  {recete.ad}
                                </Text>

                                {/* Stats Row */}
                                <Group gap={8} mb={6}>
                                  {porsiyon && (
                                    <Text size="xs" c="dimmed">
                                      {porsiyon}g
                                    </Text>
                                  )}
                                  {kalori && (
                                    <Text size="xs" c="orange">
                                      {kalori} kcal
                                    </Text>
                                  )}
                                  {toplamSure > 0 && (
                                    <Text size="xs" c="blue">
                                      {toplamSure}dk
                                    </Text>
                                  )}
                                </Group>

                                {/* Bottom: Category & Ingredients */}
                                <Group gap={6} wrap="nowrap">
                                  <Text size="xs" c="dimmed" truncate style={{ flex: 1 }}>
                                    {kategoriAdi}
                                  </Text>
                                  {malzemeSayisi > 0 && (
                                    <Badge size="xs" variant="light" color="gray" radius="sm">
                                      {malzemeSayisi}
                                    </Badge>
                                  )}
                                </Group>
                              </UnstyledButton>
                            );
                          })}
                        </SimpleGrid>
                      </ScrollArea.Autosize>
                    )}
                  </Paper>
                </Tabs.Panel>

                {/* Tab 4: Fiyatlar - Geliştirilmiş */}
                <Tabs.Panel value="fiyatlar">
                  <Stack gap="md">
                    {/* Fiyat Trendi Grafiği - Geliştirilmiş */}
                    {seciliFiyatUrunAd && (
                      <Paper p="md" withBorder radius="lg">
                        <Group justify="space-between" mb="md" wrap="wrap">
                          <Group gap="sm">
                            <Text fw={600} size="sm">
                              📈 {seciliFiyatUrunAd} - Fiyat Trendi
                            </Text>
                          </Group>
                          <Group gap="xs">
                            <SegmentedControl
                              size="xs"
                              value={timeRange}
                              onChange={(value) => setTimeRange(value as typeof timeRange)}
                              data={[
                                { label: '3 Ay', value: '3m' },
                                { label: '6 Ay', value: '6m' },
                                { label: '1 Yıl', value: '1y' },
                                { label: 'Tümü', value: 'all' },
                              ]}
                            />
                            <SegmentedControl
                              size="xs"
                              value={chartType}
                              onChange={(value) => setChartType(value as typeof chartType)}
                              data={[
                                { label: 'Çizgi', value: 'line' },
                                { label: 'Sütun', value: 'bar' },
                                { label: 'Alan', value: 'area' },
                              ]}
                            />
                            <ActionIcon
                              variant="subtle"
                              color="gray"
                              size="sm"
                              onClick={() => {
                                setSeciliFiyatUrunId(null);
                                setSeciliFiyatUrunAd(null);
                                setSelectedProducts([]);
                              }}
                            >
                              <IconX size={14} />
                            </ActionIcon>
                          </Group>
                        </Group>

                        {/* İstatistikler Kartı */}
                        {fiyatIstatistikleri && (
                          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="xs" mb="md">
                            <Paper p="sm" withBorder radius="md" ta="center">
                              <Text size="xs" c="dimmed">
                                Ortalama
                              </Text>
                              <Text fw={600} size="sm">
                                ₺{fiyatIstatistikleri.avgPrice.toFixed(2)}
                              </Text>
                            </Paper>
                            <Paper p="sm" withBorder radius="md" ta="center" bg="green.0">
                              <Text size="xs" c="dimmed">
                                Min
                              </Text>
                              <Text fw={600} size="sm" c="green">
                                ₺{fiyatIstatistikleri.minPrice.toFixed(2)}
                              </Text>
                            </Paper>
                            <Paper p="sm" withBorder radius="md" ta="center" bg="red.0">
                              <Text size="xs" c="dimmed">
                                Max
                              </Text>
                              <Text fw={600} size="sm" c="red">
                                ₺{fiyatIstatistikleri.maxPrice.toFixed(2)}
                              </Text>
                            </Paper>
                            <Paper
                              p="sm"
                              withBorder
                              radius="md"
                              ta="center"
                              bg={fiyatIstatistikleri.changePercent > 0 ? 'red.0' : 'green.0'}
                            >
                              <Text size="xs" c="dimmed">
                                Değişim
                              </Text>
                              <Group gap={4} justify="center">
                                {fiyatIstatistikleri.trend === 'increasing' ? (
                                  <IconTrendingUp size={14} color="var(--mantine-color-red-6)" />
                                ) : (
                                  <IconTrendingDown
                                    size={14}
                                    color="var(--mantine-color-green-6)"
                                  />
                                )}
                                <Text
                                  fw={600}
                                  size="sm"
                                  c={fiyatIstatistikleri.changePercent > 0 ? 'red' : 'green'}
                                >
                                  {fiyatIstatistikleri.changePercent > 0 ? '+' : ''}
                                  {fiyatIstatistikleri.changePercent.toFixed(1)}%
                                </Text>
                              </Group>
                            </Paper>
                          </SimpleGrid>
                        )}

                        {/* Grafik */}
                        {trendLoading ? (
                          <Skeleton height={isMobile ? 200 : 300} radius="md" />
                        ) : trendError ? (
                          <Alert color="red" title="Hata" icon={<IconAlertCircle />}>
                            Fiyat trendi yüklenemedi:{' '}
                            {trendError instanceof Error ? trendError.message : 'Bilinmeyen hata'}
                          </Alert>
                        ) : chartData.length === 0 ? (
                          <Center py="xl">
                            <Stack align="center" gap="sm">
                              <IconChartLine size={48} color="var(--mantine-color-gray-5)" />
                              <Text c="dimmed" ta="center">
                                Bu ürün için henüz fiyat geçmişi bulunmuyor
                              </Text>
                            </Stack>
                          </Center>
                        ) : (
                          <Box h={isMobile ? 200 : 300}>
                            <ResponsiveContainer width="100%" height="100%">
                              {chartType === 'line' ? (
                                <LineChart data={chartData}>
                                  <XAxis
                                    dataKey="month"
                                    tick={{ fontSize: 10 }}
                                    tickFormatter={(val) => {
                                      try {
                                        return format(parseISO(val), 'MMM', { locale: tr });
                                      } catch {
                                        return val;
                                      }
                                    }}
                                  />
                                  <YAxis tick={{ fontSize: 10 }} />
                                  <Tooltip
                                    content={({ active, payload }) => {
                                      if (active && payload && payload.length) {
                                        const data = payload[0].payload as PriceHistoryData & {
                                          monthLabel: string;
                                        };
                                        return (
                                          <Paper p="sm" shadow="md" withBorder>
                                            <Text fw={600} mb="xs">
                                              {data.monthLabel}
                                            </Text>
                                            <Stack gap={4}>
                                              <Group justify="space-between" gap="xl">
                                                <Text size="xs">Ortalama:</Text>
                                                <Text size="xs" fw={600}>
                                                  ₺{data.avg_price.toFixed(2)}
                                                </Text>
                                              </Group>
                                              <Group justify="space-between" gap="xl">
                                                <Text size="xs">Min:</Text>
                                                <Text size="xs" c="green">
                                                  ₺{(data.min_price ?? 0).toFixed(2)}
                                                </Text>
                                              </Group>
                                              <Group justify="space-between" gap="xl">
                                                <Text size="xs">Max:</Text>
                                                <Text size="xs" c="red">
                                                  ₺{(data.max_price ?? 0).toFixed(2)}
                                                </Text>
                                              </Group>
                                              <Group justify="space-between" gap="xl">
                                                <Text size="xs">İşlem:</Text>
                                                <Text size="xs">{data.transaction_count} adet</Text>
                                              </Group>
                                            </Stack>
                                          </Paper>
                                        );
                                      }
                                      return null;
                                    }}
                                  />
                                  <Line
                                    type="monotone"
                                    dataKey="avg_price"
                                    stroke="var(--mantine-color-grape-6)"
                                    strokeWidth={2}
                                    dot={{ fill: 'var(--mantine-color-grape-6)', r: 4 }}
                                    name="Ortalama"
                                  />
                                  <Line
                                    type="monotone"
                                    dataKey="min_price"
                                    stroke="var(--mantine-color-green-6)"
                                    strokeWidth={1.5}
                                    strokeDasharray="5 5"
                                    dot={false}
                                    name="Min"
                                  />
                                  <Line
                                    type="monotone"
                                    dataKey="max_price"
                                    stroke="var(--mantine-color-red-6)"
                                    strokeWidth={1.5}
                                    strokeDasharray="5 5"
                                    dot={false}
                                    name="Max"
                                  />
                                  <Legend />
                                </LineChart>
                              ) : chartType === 'bar' ? (
                                <BarChart data={chartData}>
                                  <XAxis
                                    dataKey="month"
                                    tick={{ fontSize: 10 }}
                                    tickFormatter={(val) => {
                                      try {
                                        return format(parseISO(val), 'MMM', { locale: tr });
                                      } catch {
                                        return val;
                                      }
                                    }}
                                  />
                                  <YAxis tick={{ fontSize: 10 }} />
                                  <Tooltip
                                    content={({ active, payload }) => {
                                      if (active && payload && payload.length) {
                                        const data = payload[0].payload as PriceHistoryData & {
                                          monthLabel: string;
                                        };
                                        return (
                                          <Paper p="sm" shadow="md" withBorder>
                                            <Text fw={600} mb="xs">
                                              {data.monthLabel}
                                            </Text>
                                            <Text size="xs">
                                              Ortalama: ₺{data.avg_price.toFixed(2)}
                                            </Text>
                                          </Paper>
                                        );
                                      }
                                      return null;
                                    }}
                                  />
                                  <Bar
                                    dataKey="avg_price"
                                    fill="var(--mantine-color-grape-6)"
                                    name="Ortalama Fiyat"
                                  />
                                </BarChart>
                              ) : (
                                <AreaChart data={chartData}>
                                  <XAxis
                                    dataKey="month"
                                    tick={{ fontSize: 10 }}
                                    tickFormatter={(val) => {
                                      try {
                                        return format(parseISO(val), 'MMM', { locale: tr });
                                      } catch {
                                        return val;
                                      }
                                    }}
                                  />
                                  <YAxis tick={{ fontSize: 10 }} />
                                  <Tooltip
                                    content={({ active, payload }) => {
                                      if (active && payload && payload.length) {
                                        const data = payload[0].payload as PriceHistoryData & {
                                          monthLabel: string;
                                        };
                                        return (
                                          <Paper p="sm" shadow="md" withBorder>
                                            <Text fw={600} mb="xs">
                                              {data.monthLabel}
                                            </Text>
                                            <Text size="xs">
                                              Ortalama: ₺{data.avg_price.toFixed(2)}
                                            </Text>
                                          </Paper>
                                        );
                                      }
                                      return null;
                                    }}
                                  />
                                  <Area
                                    type="monotone"
                                    dataKey="avg_price"
                                    stroke="var(--mantine-color-grape-6)"
                                    fill="var(--mantine-color-grape-1)"
                                    name="Ortalama Fiyat"
                                  />
                                </AreaChart>
                              )}
                            </ResponsiveContainer>
                          </Box>
                        )}
                      </Paper>
                    )}

                    {/* Top Ürünler - Geliştirilmiş */}
                    <Paper p="md" withBorder radius="lg">
                      <Stack gap="md">
                        <Group justify="space-between" wrap="wrap">
                          <Text fw={600} size="sm">
                            📦 Ürün Fiyatları (Son 3 Ay)
                          </Text>
                          {topUrunlerError && (
                            <Badge color="red" variant="light" size="sm">
                              Hata
                            </Badge>
                          )}
                        </Group>

                        {/* Arama Kutusu */}
                        <TextInput
                          placeholder="Ürün ara..."
                          leftSection={<IconSearch size={16} />}
                          value={fiyatArama}
                          onChange={(e) => setFiyatArama(e.currentTarget.value)}
                          size="sm"
                        />

                        {/* Gıda/Tümü Toggle ve Sonuç Sayısı */}
                        {!fiyatLoading && !topUrunlerError && (
                          <Stack gap="xs">
                            <SegmentedControl
                              size="xs"
                              value={sadecegida ? 'gida' : 'tumu'}
                              onChange={(value) => setSadeceGida(value === 'gida')}
                              data={[
                                { label: '🍎 Gıda', value: 'gida' },
                                { label: '📦 Tümü', value: 'tumu' },
                              ]}
                            />
                            <Group justify="space-between" wrap="wrap">
                              <Text size="xs" c="dimmed">
                                {(() => {
                                  const filtered = topUrunler.filter((u) => {
                                    // Gıda filtresi
                                    if (sadecegida && u.is_food === false) return false;
                                    // Arama filtresi
                                    if (!debouncedFiyatArama) return true;
                                    const searchLower = debouncedFiyatArama.toLowerCase();
                                    const productName = (
                                      u.clean_product_name || u.product_name
                                    ).toLowerCase();
                                    const category = (u.category || '').toLowerCase();
                                    return (
                                      productName.includes(searchLower) ||
                                      category.includes(searchLower)
                                    );
                                  });
                                  const gidaSayisi = topUrunler.filter(
                                    (u) => u.is_food !== false
                                  ).length;
                                  const gidaDisSayisi = topUrunler.filter(
                                    (u) => u.is_food === false
                                  ).length;
                                  return `${filtered.length} ürün gösteriliyor (${gidaSayisi} gıda, ${gidaDisSayisi} diğer)`;
                                })()}
                              </Text>
                            </Group>
                          </Stack>
                        )}
                      </Stack>

                      {fiyatLoading ? (
                        <Stack gap="xs" mt="md">
                          <Skeleton height={50} radius="md" />
                          <Skeleton height={50} radius="md" />
                          <Skeleton height={50} radius="md" />
                          <Skeleton height={50} radius="md" />
                          <Skeleton height={50} radius="md" />
                        </Stack>
                      ) : topUrunlerError ? (
                        <Alert color="red" title="Hata" icon={<IconAlertCircle />} mt="md">
                          Ürün fiyatları yüklenemedi
                        </Alert>
                      ) : (
                        <ScrollArea h={400} mt="md">
                          <Stack gap="xs">
                            {topUrunler
                              .filter((urun) => {
                                // Gıda filtresi
                                if (sadecegida && urun.is_food === false) return false;
                                // Arama filtresi
                                if (!debouncedFiyatArama) return true;
                                const searchLower = debouncedFiyatArama.toLowerCase();
                                const productName = (
                                  urun.clean_product_name || urun.product_name
                                ).toLowerCase();
                                const category = (urun.category || '').toLowerCase();
                                return (
                                  productName.includes(searchLower) ||
                                  category.includes(searchLower)
                                );
                              })
                              .map((urun, index) => {
                                const isSelected = seciliFiyatUrunId === urun.urun_id;

                                // Temizlenmiş ürün adı (backend'den veya frontend'de hesapla)
                                const displayName = urun.clean_product_name || urun.product_name;

                                // Birim fiyatı hesapla - önce backend'den gelen değeri kullan
                                const standardUnit = urun.standard_unit || 'ADET';
                                const pricePerUnit =
                                  urun.price_per_unit || urun.avg_unit_price || 0;

                                // Kategori rengi
                                const categoryColor = getCategoryColor(urun.category ?? undefined);

                                return (
                                  <Paper
                                    key={`${urun.product_name}-${index}`}
                                    p="xs"
                                    withBorder
                                    radius="md"
                                    style={{
                                      border: `1px solid ${isSelected ? 'var(--mantine-color-grape-5)' : 'var(--mantine-color-default-border)'}`,
                                      background: isSelected
                                        ? 'var(--mantine-color-grape-light)'
                                        : undefined,
                                      transition: 'all 0.15s',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    <Group justify="space-between" wrap="nowrap" gap="xs">
                                      <UnstyledButton
                                        onClick={() =>
                                          handleFiyatTrendiSec(urun.urun_id, urun.product_name)
                                        }
                                        style={{ flex: 1, minWidth: 0 }}
                                      >
                                        <Group
                                          gap="xs"
                                          wrap="nowrap"
                                          style={{ flex: 1, minWidth: 0 }}
                                        >
                                          <Text
                                            size="xs"
                                            c="dimmed"
                                            fw={500}
                                            style={{ minWidth: 20 }}
                                          >
                                            {index + 1}.
                                          </Text>
                                          <Box style={{ flex: 1, minWidth: 0 }}>
                                            <Text size="sm" fw={500} lineClamp={1}>
                                              {displayName}
                                            </Text>
                                            <Group gap={8} mt={2}>
                                              <Text size="xs" c={categoryColor}>
                                                {urun.category || 'Genel'}
                                              </Text>
                                              <Text size="xs" c="dimmed">
                                                |
                                              </Text>
                                              <Text size="xs" fw={600} c="grape">
                                                ₺{pricePerUnit.toFixed(2)}/
                                                {standardUnit.toLowerCase()}
                                              </Text>
                                            </Group>
                                          </Box>
                                        </Group>
                                      </UnstyledButton>
                                      <ActionIcon
                                        variant="subtle"
                                        color="gray"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleUrunDetayAc(urun);
                                        }}
                                        title="Detaylı Analiz"
                                      >
                                        <IconInfoCircle size={16} />
                                      </ActionIcon>
                                    </Group>
                                  </Paper>
                                );
                              })}
                            {topUrunler.filter((urun) => {
                              // Gıda filtresi
                              if (sadecegida && urun.is_food === false) return false;
                              // Arama filtresi
                              if (!debouncedFiyatArama) return true;
                              const searchLower = debouncedFiyatArama.toLowerCase();
                              const productName = (
                                urun.clean_product_name || urun.product_name
                              ).toLowerCase();
                              const category = (urun.category || '').toLowerCase();
                              return (
                                productName.includes(searchLower) || category.includes(searchLower)
                              );
                            }).length === 0 && (
                              <Center py="xl">
                                <Stack align="center" gap="md">
                                  <IconPackages size={40} color="var(--mantine-color-gray-5)" />
                                  <Text size="sm" c="dimmed" ta="center">
                                    {debouncedFiyatArama
                                      ? 'Arama sonucu bulunamadı'
                                      : sadecegida
                                        ? 'Gıda ürünü bulunamadı'
                                        : 'Henüz fatura kalemi yok'}
                                  </Text>
                                  {!debouncedFiyatArama &&
                                    !sadecegida &&
                                    renderBatchProcessButton()}
                                </Stack>
                              </Center>
                            )}
                          </Stack>
                        </ScrollArea>
                      )}
                    </Paper>
                  </Stack>
                </Tabs.Panel>

                {/* Tab 5: Takvim - Menü Planlama Takvimi */}
                <Tabs.Panel value="takvim">
                  <MenuPlanlamaProvider>
                    <MenuTakvim />
                  </MenuPlanlamaProvider>
                </Tabs.Panel>

                {/* Tab 6: Menüler - Şablonlar + Kaydedilenler */}
                <Tabs.Panel value="menuler">
                  <MenuPlanlamaProvider>
                    <KaydedilenMenuler />
                  </MenuPlanlamaProvider>
                </Tabs.Panel>
              </Tabs>
            </Box>
          </Container>

          {/* Mobil Bottom Navigation */}
          {isMobile && isMounted && (
            <Box
              style={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                background: 'var(--mantine-color-dark-7)',
                borderTop: '1px solid var(--mantine-color-dark-4)',
                padding: '8px 0',
                zIndex: 100,
              }}
            >
              <Group justify="space-around" gap={0}>
                {SIDEBAR_ITEMS.map((item) => {
                  const isActive = activeCategory === item.id;
                  return (
                    <UnstyledButton
                      key={item.id}
                      onClick={() => setActiveCategory(item.id)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        padding: '4px 12px',
                      }}
                    >
                      <ThemeIcon
                        size="sm"
                        variant={isActive ? 'filled' : 'subtle'}
                        color={isActive ? 'blue' : 'gray'}
                      >
                        {item.icon}
                      </ThemeIcon>
                      <Text
                        size="10px"
                        mt={2}
                        c={isActive ? 'blue' : 'dimmed'}
                        fw={isActive ? 600 : 400}
                      >
                        {item.label}
                      </Text>
                    </UnstyledButton>
                  );
                })}
              </Group>
            </Box>
          )}

          {/* Mobil Kategori Drawer */}
          {isMobile && isMounted && (
            <Drawer
              opened={!!mobileDrawerKategori}
              onClose={() => setMobileDrawerKategori(null)}
              position="bottom"
              size="70%"
              withCloseButton={false}
              styles={{
                content: {
                  borderTopLeftRadius: 16,
                  borderTopRightRadius: 16,
                },
              }}
            >
              {mobileDrawerKategori &&
                (() => {
                  const kat = KATEGORILER.find((k) => k.kod === mobileDrawerKategori);
                  const yemekler = getRecetelerForKategori(mobileDrawerKategori);
                  if (!kat) return null;

                  return (
                    <>
                      {/* Drawer handle */}
                      <Box ta="center" py="xs">
                        <Box
                          style={{
                            width: 40,
                            height: 4,
                            borderRadius: 2,
                            background: 'var(--mantine-color-gray-3)',
                            margin: '0 auto',
                          }}
                        />
                      </Box>

                      {/* Header */}
                      <Box
                        p="md"
                        style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}
                      >
                        <Group justify="space-between">
                          <Group gap="sm">
                            <Text size="xl">{kat.ikon}</Text>
                            <Box>
                              <Text fw={600}>{kat.ad}</Text>
                              <Text size="xs" c="dimmed">
                                {yemekler.length} reçete
                              </Text>
                            </Box>
                          </Group>
                          <ActionIcon
                            variant="subtle"
                            color="gray"
                            onClick={() => setMobileDrawerKategori(null)}
                          >
                            <IconX size={18} />
                          </ActionIcon>
                        </Group>
                      </Box>

                      {/* Yemek Listesi */}
                      <ScrollArea style={{ height: 'calc(100% - 80px)' }}>
                        <Stack gap={0}>
                          {yemekler.map((yemek) => {
                            const isSecili = seciliYemekler.some(
                              (y) => y.id === `recete-${yemek.id}`
                            );
                            return (
                              <Box
                                key={yemek.id}
                                p="md"
                                style={{
                                  borderBottom: '1px solid var(--mantine-color-default-border)',
                                  background: isSecili
                                    ? 'var(--mantine-color-teal-light)'
                                    : undefined,
                                }}
                              >
                                <Group justify="space-between" wrap="nowrap">
                                  <UnstyledButton
                                    onClick={() => {
                                      handleYemekSec(kat.kod, yemek);
                                      // Seçildiğinde drawer'ı kapatma - kullanıcı isterse kapatır
                                    }}
                                    style={{ flex: 1, minWidth: 0 }}
                                  >
                                    <Group gap="sm" wrap="nowrap">
                                      {isSecili ? (
                                        <ThemeIcon size="sm" color="teal" radius="xl">
                                          <IconCheck size={12} />
                                        </ThemeIcon>
                                      ) : (
                                        <Box
                                          style={{
                                            width: 22,
                                            height: 22,
                                            borderRadius: '50%',
                                            border: '2px solid var(--mantine-color-gray-3)',
                                          }}
                                        />
                                      )}
                                      <Box style={{ flex: 1, minWidth: 0 }}>
                                        <Text size="sm" truncate fw={isSecili ? 600 : 400}>
                                          {yemek.ad}
                                        </Text>
                                        <FiyatBadge
                                          fatura={yemek.fatura_maliyet || yemek.sistem_maliyet}
                                          piyasa={yemek.piyasa_maliyet}
                                          faturaGuncel={yemek.fatura_guncel !== false}
                                          piyasaGuncel={yemek.piyasa_guncel !== false}
                                        />
                                      </Box>
                                    </Group>
                                  </UnstyledButton>
                                  <ActionIcon
                                    variant="subtle"
                                    color="blue"
                                    size="lg"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      fetchReceteDetay(yemek.id);
                                    }}
                                  >
                                    <IconInfoCircle size={20} />
                                  </ActionIcon>
                                </Group>
                              </Box>
                            );
                          })}
                          {yemekler.length === 0 && (
                            <Center py="xl">
                              <Text c="dimmed">Bu kategoride reçete yok</Text>
                            </Center>
                          )}
                        </Stack>
                      </ScrollArea>
                    </>
                  );
                })()}
            </Drawer>
          )}

          {/* Ürün Detay Modal - Detaylı Fiyat Analizi (Geliştirilmiş) */}
          <Modal
            opened={urunDetayModalOpened}
            onClose={() => {
              setUrunDetayModalOpened(false);
              setSeciliUrunDetay(null);
              setDataValidationErrors([]);
            }}
            title={
              <Group justify="space-between" style={{ flex: 1 }}>
                <Group gap="sm">
                  <IconChartLine size={24} color="var(--mantine-color-grape-6)" />
                  <Text fw={600}>{seciliUrunDetay?.product_name || 'Ürün Detayı'}</Text>
                </Group>
                <Group gap="xs">
                  <ActionIcon
                    variant="subtle"
                    color="blue"
                    size="sm"
                    onClick={() => {
                      queryClient.invalidateQueries({ queryKey: ['maliyet-ozet'] });
                      queryClient.invalidateQueries({
                        queryKey: ['fiyat-gecmisi-recent', seciliUrunDetay?.urun_id],
                      });
                      queryClient.invalidateQueries({
                        queryKey: ['tedarikci-karsilastirma', seciliUrunDetay?.urun_id],
                      });
                      queryClient.invalidateQueries({
                        queryKey: ['fiyat-gecmisi-mini', seciliUrunDetay?.urun_id],
                      });
                    }}
                    title="Yenile"
                  >
                    <IconRefresh size={16} />
                  </ActionIcon>
                  <Button
                    variant="light"
                    size="xs"
                    leftSection={<IconFile size={14} />}
                    onClick={exportToPDF}
                  >
                    PDF
                  </Button>
                  <Button
                    variant="light"
                    size="xs"
                    leftSection={<IconFileSpreadsheet size={14} />}
                    onClick={exportToExcel}
                  >
                    Excel
                  </Button>
                </Group>
              </Group>
            }
            size="xl"
            fullScreen={isMobile && isMounted}
          >
            {seciliUrunDetay && (
              <Stack gap="md">
                {/* Veri Doğrulama Uyarıları */}
                {dataValidationErrors.length > 0 && (
                  <Alert color="orange" title="Veri Uyarısı" icon={<IconAlertCircle />}>
                    <Stack gap="xs">
                      {dataValidationErrors.map((error) => (
                        <Text key={error} size="xs">
                          • {error}
                        </Text>
                      ))}
                    </Stack>
                  </Alert>
                )}

                {/* Fiyat Bilgisi - Sadece Görüntüleme */}
                <Paper p="md" withBorder radius="md" bg="blue.0">
                  <Group gap="xs" mb="sm">
                    <IconCurrencyLira size={18} />
                    <Text fw={600} size="sm">
                      Fiyat Bilgisi
                    </Text>
                  </Group>
                  <Group gap="lg">
                    <Box>
                      <Text size="xs" c="dimmed">
                        Fatura Ortalaması
                      </Text>
                      <Text fw={600} c="blue">
                        ₺
                        {(
                          seciliUrunDetay.price_per_unit ||
                          seciliUrunDetay.avg_unit_price ||
                          0
                        ).toFixed(2)}
                        /{seciliUrunDetay.standard_unit?.toLowerCase() || 'kg'}
                      </Text>
                    </Box>
                    <Box>
                      <Text size="xs" c="dimmed">
                        Fatura Sayısı
                      </Text>
                      <Text fw={600}>{seciliUrunDetay.invoice_count} fatura</Text>
                    </Box>
                  </Group>
                  <Text size="xs" c="dimmed" mt="sm">
                    Fiyat düzenlemesi için Stok sayfasını kullanın.
                  </Text>
                </Paper>

                {/* Özet Bilgiler */}
                <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="xs">
                  <Paper p="sm" withBorder radius="md" ta="center">
                    <Text size="xs" c="dimmed">
                      Toplam Tutar
                    </Text>
                    <Text fw={700} size="lg" c="grape">
                      {formatMoney(seciliUrunDetay.total_amount)}
                    </Text>
                  </Paper>
                  <Paper p="sm" withBorder radius="md" ta="center" bg="blue.0">
                    <Text size="xs" c="dimmed">
                      Ortalama Fiyat
                    </Text>
                    <Text fw={700} size="lg" c="blue">
                      ₺{seciliUrunDetay.avg_unit_price?.toFixed(2) || '0'}
                    </Text>
                    {(() => {
                      const unitPrice = seciliUrunDetay.avg_unit_price
                        ? calculateUnitPrice(
                            seciliUrunDetay.avg_unit_price,
                            seciliUrunDetay.product_name
                          )
                        : null;
                      return unitPrice ? (
                        <MantineTooltip label={unitPrice.tooltip}>
                          <Text size="xs" c="dimmed" mt={4} style={{ cursor: 'help' }}>
                            {unitPrice.display}
                          </Text>
                        </MantineTooltip>
                      ) : null;
                    })()}
                  </Paper>
                  <Paper p="sm" withBorder radius="md" ta="center" bg="green.0">
                    <Text size="xs" c="dimmed">
                      Min Fiyat
                    </Text>
                    <Text fw={700} size="lg" c="green">
                      ₺{seciliUrunDetay.min_unit_price?.toFixed(2) || '0'}
                    </Text>
                    {(() => {
                      const unitPrice = seciliUrunDetay.min_unit_price
                        ? calculateUnitPrice(
                            seciliUrunDetay.min_unit_price,
                            seciliUrunDetay.product_name
                          )
                        : null;
                      return unitPrice ? (
                        <MantineTooltip label={unitPrice.tooltip}>
                          <Text size="xs" c="dimmed" mt={4} style={{ cursor: 'help' }}>
                            {unitPrice.display}
                          </Text>
                        </MantineTooltip>
                      ) : null;
                    })()}
                  </Paper>
                  <Paper p="sm" withBorder radius="md" ta="center" bg="red.0">
                    <Text size="xs" c="dimmed">
                      Max Fiyat
                    </Text>
                    <Text fw={700} size="lg" c="red">
                      ₺{seciliUrunDetay.max_unit_price?.toFixed(2) || '0'}
                    </Text>
                    {(() => {
                      const unitPrice = seciliUrunDetay.max_unit_price
                        ? calculateUnitPrice(
                            seciliUrunDetay.max_unit_price,
                            seciliUrunDetay.product_name
                          )
                        : null;
                      return unitPrice ? (
                        <MantineTooltip label={unitPrice.tooltip}>
                          <Text size="xs" c="dimmed" mt={4} style={{ cursor: 'help' }}>
                            {unitPrice.display}
                          </Text>
                        </MantineTooltip>
                      ) : null;
                    })()}
                  </Paper>
                </SimpleGrid>

                {/* Zaman Bazlı Karşılaştırma */}
                {zamanKarsilastirma && (
                  <Paper
                    p="md"
                    withBorder
                    radius="md"
                    bg={zamanKarsilastirma.fark > 0 ? 'red.0' : 'green.0'}
                  >
                    <Text fw={600} mb="md">
                      📊 Aylık Karşılaştırma
                    </Text>
                    <SimpleGrid cols={2} spacing="xs">
                      <Paper p="sm" withBorder radius="md" bg="white">
                        <Text size="xs" c="dimmed">
                          Bu Ay
                        </Text>
                        <Text fw={600} size="lg">
                          ₺{zamanKarsilastirma.buAy.toFixed(2)}
                        </Text>
                      </Paper>
                      <Paper p="sm" withBorder radius="md" bg="white">
                        <Text size="xs" c="dimmed">
                          Geçen Ay
                        </Text>
                        <Group gap={4}>
                          <Text fw={600} size="lg">
                            ₺{zamanKarsilastirma.geçenAy.toFixed(2)}
                          </Text>
                          <Badge
                            color={zamanKarsilastirma.fark > 0 ? 'red' : 'green'}
                            variant="filled"
                            size="sm"
                          >
                            {zamanKarsilastirma.fark > 0 ? '+' : ''}
                            {zamanKarsilastirma.farkYuzde.toFixed(1)}%
                          </Badge>
                        </Group>
                      </Paper>
                    </SimpleGrid>
                    <Text size="xs" c="dimmed" mt="xs">
                      {zamanKarsilastirma.fark > 0 ? '📈' : '📉'}
                      {zamanKarsilastirma.fark > 0 ? 'Artış' : 'Azalış'}: ₺
                      {Math.abs(zamanKarsilastirma.fark).toFixed(2)}
                    </Text>
                  </Paper>
                )}

                {/* Detaylı İstatistikler */}
                <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="xs">
                  <Paper p="sm" withBorder radius="md">
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">
                        Toplam Miktar
                      </Text>
                      <Text fw={600}>{seciliUrunDetay.total_quantity.toFixed(2)}</Text>
                    </Group>
                  </Paper>
                  <Paper p="sm" withBorder radius="md">
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">
                        Fatura Sayısı
                      </Text>
                      <Badge size="lg" variant="light" color="blue">
                        {seciliUrunDetay.invoice_count}
                      </Badge>
                    </Group>
                  </Paper>
                  <Paper p="sm" withBorder radius="md">
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">
                        Kategori
                      </Text>
                      <Badge variant="dot">{seciliUrunDetay.category || 'Genel'}</Badge>
                    </Group>
                  </Paper>
                </SimpleGrid>

                {/* Fiyat Aralığı */}
                {seciliUrunDetay.min_unit_price && seciliUrunDetay.max_unit_price && (
                  <Paper p="md" withBorder radius="md" bg="grape.0">
                    <Text fw={600} mb="xs">
                      Fiyat Aralığı
                    </Text>
                    <Group gap="md">
                      <Box>
                        <Text size="xs" c="dimmed">
                          Minimum
                        </Text>
                        <Text fw={600} c="green">
                          ₺{seciliUrunDetay.min_unit_price.toFixed(2)}
                        </Text>
                        {(() => {
                          const unitPrice = calculateUnitPrice(
                            seciliUrunDetay.min_unit_price,
                            seciliUrunDetay.product_name
                          );
                          return unitPrice ? (
                            <MantineTooltip label={unitPrice.tooltip}>
                              <Text size="xs" c="dimmed" style={{ cursor: 'help' }}>
                                {unitPrice.display}
                              </Text>
                            </MantineTooltip>
                          ) : null;
                        })()}
                      </Box>
                      <Box style={{ flex: 1 }}>
                        <Text size="xs" c="dimmed">
                          Ortalama
                        </Text>
                        <Text fw={600} c="blue">
                          ₺{seciliUrunDetay.avg_unit_price?.toFixed(2) || '0'}
                        </Text>
                        {(() => {
                          const unitPrice = seciliUrunDetay.avg_unit_price
                            ? calculateUnitPrice(
                                seciliUrunDetay.avg_unit_price,
                                seciliUrunDetay.product_name
                              )
                            : null;
                          return unitPrice ? (
                            <MantineTooltip label={unitPrice.tooltip}>
                              <Text size="xs" c="dimmed" style={{ cursor: 'help' }}>
                                {unitPrice.display}
                              </Text>
                            </MantineTooltip>
                          ) : null;
                        })()}
                      </Box>
                      <Box>
                        <Text size="xs" c="dimmed">
                          Maksimum
                        </Text>
                        <Text fw={600} c="red">
                          ₺{seciliUrunDetay.max_unit_price.toFixed(2)}
                        </Text>
                        {(() => {
                          const unitPrice = calculateUnitPrice(
                            seciliUrunDetay.max_unit_price,
                            seciliUrunDetay.product_name
                          );
                          return unitPrice ? (
                            <MantineTooltip label={unitPrice.tooltip}>
                              <Text size="xs" c="dimmed" style={{ cursor: 'help' }}>
                                {unitPrice.display}
                              </Text>
                            </MantineTooltip>
                          ) : null;
                        })()}
                      </Box>
                    </Group>
                    <Text size="xs" c="dimmed" mt="xs">
                      Fiyat farkı: ₺
                      {(seciliUrunDetay.max_unit_price - seciliUrunDetay.min_unit_price).toFixed(2)}
                      (
                      {(
                        ((seciliUrunDetay.max_unit_price - seciliUrunDetay.min_unit_price) /
                          seciliUrunDetay.min_unit_price) *
                        100
                      ).toFixed(1)}
                      %)
                    </Text>
                  </Paper>
                )}

                {/* Mini Grafik - Son 6 Ay Trendi */}
                {miniChartData.length > 0 && (
                  <Paper p="md" withBorder radius="md">
                    <Text fw={600} mb="md">
                      📈 Son 6 Ay Trendi
                    </Text>
                    <Box h={150}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={miniChartData}>
                          <XAxis
                            dataKey="month"
                            tick={{ fontSize: 8 }}
                            tickFormatter={(val) => {
                              try {
                                return format(parseISO(val), 'MMM', { locale: tr });
                              } catch {
                                return val;
                              }
                            }}
                          />
                          <YAxis tick={{ fontSize: 8 }} />
                          <Tooltip
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0].payload as PriceHistoryData & {
                                  monthLabel: string;
                                };
                                return (
                                  <Paper p="xs" shadow="md" withBorder>
                                    <Text size="xs" fw={600}>
                                      {data.monthLabel}
                                    </Text>
                                    <Text size="xs">Ort: ₺{data.avg_price.toFixed(2)}</Text>
                                  </Paper>
                                );
                              }
                              return null;
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="avg_price"
                            stroke="var(--mantine-color-grape-6)"
                            strokeWidth={2}
                            dot={{ fill: 'var(--mantine-color-grape-6)', r: 3 }}
                            name="Ortalama Fiyat"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </Box>
                  </Paper>
                )}

                {/* Son İşlemler Listesi */}
                <Paper p="md" withBorder radius="md">
                  <Text fw={600} mb="md">
                    📋 Son İşlemler
                  </Text>
                  {sonIslemlerLoading ? (
                    <Stack gap="xs">
                      <Skeleton height={50} radius="md" />
                      <Skeleton height={50} radius="md" />
                      <Skeleton height={50} radius="md" />
                    </Stack>
                  ) : sonIslemler.length > 0 ? (
                    <ScrollArea.Autosize mah={200}>
                      <Stack gap="xs">
                        {sonIslemler.map((item) => (
                          <Paper key={item.id} p="sm" withBorder radius="md">
                            <Group justify="space-between" wrap="nowrap">
                              <Box style={{ flex: 1, minWidth: 0 }}>
                                <Text size="sm" fw={500} lineClamp={1}>
                                  {formatDate(item.invoice_date, 'short')}
                                </Text>
                                <Text size="xs" c="dimmed" lineClamp={1}>
                                  {item.supplier_name || 'Tedarikçi bilgisi yok'} •{' '}
                                  {item.invoice_no ||
                                    (item.invoice_date
                                      ? `Fatura ${item.invoice_date}`
                                      : 'Son işlem')}
                                </Text>
                              </Box>
                              <Stack align="flex-end" gap={2}>
                                <Text size="sm" fw={600} c="grape">
                                  ₺{(item.unit_price ?? 0).toFixed(2)}
                                </Text>
                                <Text size="xs" c="dimmed">
                                  {item.quantity} {item.unit ?? ''}
                                </Text>
                              </Stack>
                            </Group>
                          </Paper>
                        ))}
                      </Stack>
                    </ScrollArea.Autosize>
                  ) : (
                    <Center py="xl">
                      <Text size="sm" c="dimmed">
                        Henüz işlem bulunmuyor
                      </Text>
                    </Center>
                  )}
                </Paper>

                {/* Tedarikçi Analizi */}
                <Paper p="md" withBorder radius="md">
                  <Text fw={600} mb="md">
                    🏢 Tedarikçi Analizi
                  </Text>
                  {tedarikciLoading ? (
                    <Stack gap="xs">
                      <Skeleton height={50} radius="md" />
                      <Skeleton height={50} radius="md" />
                    </Stack>
                  ) : tedarikciAnalizi.length > 0 ? (
                    <ScrollArea.Autosize mah={200}>
                      <Stack gap="xs">
                        {tedarikciAnalizi
                          .sort((a, b) => a.avg_unit_price - b.avg_unit_price) // En ucuzdan en pahalıya
                          .map((supplier, index) => (
                            <Paper
                              key={supplier.supplier_name}
                              p="sm"
                              withBorder
                              radius="md"
                              bg={index === 0 ? 'green.0' : undefined}
                            >
                              <Group justify="space-between" wrap="nowrap">
                                <Box style={{ flex: 1, minWidth: 0 }}>
                                  <Group gap="xs">
                                    <Text size="sm" fw={500} lineClamp={1}>
                                      {supplier.supplier_name}
                                    </Text>
                                    {index === 0 && (
                                      <Badge size="xs" color="green" variant="light">
                                        En Uygun
                                      </Badge>
                                    )}
                                  </Group>
                                  <Text size="xs" c="dimmed">
                                    {supplier.invoice_count} fatura •{' '}
                                    {supplier.total_quantity.toFixed(2)} miktar
                                  </Text>
                                </Box>
                                <Stack align="flex-end" gap={2}>
                                  <Text size="sm" fw={600} c={index === 0 ? 'green' : 'blue'}>
                                    ₺{supplier.avg_unit_price.toFixed(2)}
                                  </Text>
                                  <Text size="xs" c="dimmed">
                                    Toplam: {formatMoney(supplier.total_amount)}
                                  </Text>
                                  {supplier.min_unit_price && supplier.max_unit_price && (
                                    <Text size="xs" c="dimmed">
                                      {supplier.min_unit_price.toFixed(2)} -{' '}
                                      {supplier.max_unit_price.toFixed(2)} ₺
                                    </Text>
                                  )}
                                </Stack>
                              </Group>
                            </Paper>
                          ))}
                      </Stack>
                    </ScrollArea.Autosize>
                  ) : (
                    <Center py="xl">
                      <Text size="sm" c="dimmed">
                        Tedarikçi bilgisi bulunmuyor
                      </Text>
                    </Center>
                  )}
                </Paper>

                {/* Grafik Gösterimi */}
                <Paper p="md" withBorder radius="md">
                  <Text fw={600} mb="md">
                    Fiyat Trendi
                  </Text>
                  <Button
                    variant="light"
                    fullWidth
                    onClick={() => {
                      handleFiyatTrendiSec(
                        seciliUrunDetay.urun_id,
                        seciliUrunDetay.product_name ?? seciliUrunDetay.urun_ad
                      );
                      setUrunDetayModalOpened(false);
                    }}
                    leftSection={<IconChartLine size={16} />}
                  >
                    Detaylı Grafikte Göster
                  </Button>
                </Paper>

                {/* Bilgi */}
                <Paper p="sm" withBorder radius="md" bg="blue.0">
                  <Text size="xs" c="dimmed">
                    💡 Bu ürün için detaylı fiyat analizi grafikte görüntülenebilir. Detaylı
                    grafikte göster butonuna tıklayarak fiyat trendini inceleyebilirsiniz.
                  </Text>
                </Paper>
              </Stack>
            )}
          </Modal>

          {/* Reçete Detay Modal */}
          <Modal
            opened={detayModalOpened}
            onClose={() => {
              setDetayModalOpened(false);
              setReceteDetay(null);
            }}
            title={
              <Group gap="sm">
                <IconScale size={24} color="var(--mantine-color-teal-6)" />
                <Text fw={600}>{receteDetay?.ad || 'Reçete Detayı'}</Text>
              </Group>
            }
            size="lg"
            fullScreen={isMobile && isMounted}
          >
            {detayLoading ? (
              <Center py="xl">
                <Loader color="teal" />
              </Center>
            ) : receteDetay ? (
              <Tabs
                value={activeReceteTab?.toString() || ''}
                onChange={(val) => setActiveReceteTab(val ? Number(val) : null)}
              >
                <Stack gap="md">
                  {/* Tab listesi - Pill style */}
                  <Group gap="xs" wrap="wrap">
                    {sartnameTabs.map((tabId) => {
                      const sartname = getTabSartname(tabId);
                      const isActive = activeReceteTab === tabId;
                      return (
                        <Paper
                          key={tabId}
                          p="xs"
                          px="md"
                          radius="xl"
                          withBorder
                          style={{
                            cursor: 'pointer',
                            background: isActive
                              ? 'var(--mantine-color-teal-9)'
                              : 'var(--mantine-color-dark-6)',
                            borderColor: isActive
                              ? 'var(--mantine-color-teal-6)'
                              : 'var(--mantine-color-dark-4)',
                            transition: 'all 0.15s ease',
                          }}
                          onClick={() => {
                            setActiveReceteTab(tabId);
                            fetchSartnameDetay(tabId);
                          }}
                        >
                          <Group gap={8} wrap="nowrap">
                            <Text
                              size="sm"
                              fw={isActive ? 600 : 400}
                              c={isActive ? 'white' : 'dimmed'}
                            >
                              {sartname?.ad || `Şartname ${tabId}`}
                            </Text>
                            {sartnameTabs.length > 1 && (
                              <ActionIcon
                                size={16}
                                radius="xl"
                                variant="subtle"
                                color={isActive ? 'white' : 'gray'}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const newTabs = sartnameTabs.filter((t) => t !== tabId);
                                  setSartnameTabs(newTabs);
                                  if (activeReceteTab === tabId) {
                                    setActiveReceteTab(newTabs[0]);
                                  }
                                }}
                              >
                                <IconX size={10} />
                              </ActionIcon>
                            )}
                          </Group>
                        </Paper>
                      );
                    })}

                    {/* Yeni şartname ekle */}
                    {sartnameListesi.filter((s) => !sartnameTabs.includes(s.id)).length > 0 && (
                      <Select
                        size="xs"
                        placeholder="+ Ekle"
                        w={100}
                        data={sartnameListesi
                          .filter((s) => !sartnameTabs.includes(s.id))
                          .map((s) => ({ value: s.id.toString(), label: s.ad }))}
                        onChange={(val) => {
                          if (val) {
                            const numVal = Number(val);
                            if (!sartnameTabs.includes(numVal)) {
                              setSartnameTabs([...sartnameTabs, numVal]);
                              setActiveReceteTab(numVal);
                              fetchSartnameDetay(numVal);
                            }
                          }
                        }}
                        comboboxProps={{ withinPortal: true }}
                        styles={{ input: { borderRadius: 20 } }}
                      />
                    )}

                    {/* Manuel şartname ekleme */}
                    <Group gap={4}>
                      <TextInput
                        size="xs"
                        placeholder="Yeni..."
                        w={80}
                        value={newSartnameName}
                        onChange={(e) => setNewSartnameName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddSartname()}
                        styles={{ input: { borderRadius: 20 } }}
                      />
                      <ActionIcon
                        size="sm"
                        radius="xl"
                        variant="light"
                        color="teal"
                        onClick={handleAddSartname}
                        disabled={!newSartnameName.trim()}
                      >
                        <IconPlus size={14} />
                      </ActionIcon>
                    </Group>
                  </Group>

                  {/* Gramaj Tablosu - Aktif tab'ın içeriği */}
                  {(() => {
                    const currentSartname = getTabSartname(activeReceteTab || 0);
                    const gramajlar = currentSartname?.gramajlar || [];

                    return (
                      <Paper withBorder radius="md" p={0} style={{ overflow: 'hidden' }}>
                        <Table>
                          <Table.Thead>
                            <Table.Tr>
                              <Table.Th style={{ width: '40%' }}>Malzeme</Table.Th>
                              <Table.Th ta="center" style={{ width: '15%' }}>
                                Gramaj
                              </Table.Th>
                              <Table.Th ta="center" style={{ width: '12%' }}>
                                Birim
                              </Table.Th>
                              <Table.Th ta="right" style={{ width: '18%' }}>
                                Fiyat
                              </Table.Th>
                              <Table.Th style={{ width: 40 }} />
                            </Table.Tr>
                          </Table.Thead>
                          <Table.Tbody>
                            {gramajlar.map((g) => (
                              <GramajEditableRow
                                key={g.id}
                                gramaj={g}
                                sartnameId={activeReceteTab || 0}
                                onUpdate={handleUpdateGramaj}
                                onDelete={handleDeleteGramaj}
                              />
                            ))}
                            {/* Yeni satır ekleme */}
                            <GramajNewRow
                              sartnameId={activeReceteTab || 0}
                              onAdd={handleAddGramaj}
                            />
                          </Table.Tbody>
                        </Table>

                        {gramajlar.length === 0 && (
                          <Text size="sm" c="dimmed" ta="center" py="lg">
                            Bu şartnameye henüz gramaj eklenmemiş
                          </Text>
                        )}
                      </Paper>
                    );
                  })()}
                </Stack>
              </Tabs>
            ) : (
              <Text c="dimmed" ta="center" py="xl">
                Reçete bilgisi bulunamadı
              </Text>
            )}
          </Modal>
        </Box>
      </Group>
    </Box>
  );
}
