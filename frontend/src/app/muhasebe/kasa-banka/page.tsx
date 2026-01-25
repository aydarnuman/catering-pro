'use client';

import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Center,
  Container,
  Divider,
  Group,
  Loader,
  Menu,
  Modal,
  NumberInput,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Title,
  useMantineColorScheme,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconAlertTriangle,
  IconArrowDownRight,
  IconArrowsExchange,
  IconArrowUpRight,
  IconBuildingBank,
  IconCash,
  IconCheck,
  IconClockHour4,
  IconCreditCard,
  IconDotsVertical,
  IconEdit,
  IconFileInvoice,
  IconPlus,
  IconReceipt,
  IconReceiptRefund,
  IconRefresh,
  IconSend,
  IconTrash,
  IconWallet,
} from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';
import StyledDatePicker from '@/components/ui/StyledDatePicker';
import { formatMoney, formatDate } from '@/lib/formatters';
import { muhasebeAPI } from '@/lib/api/services/muhasebe';
import 'dayjs/locale/tr';

// Tip tanımları
interface Hesap {
  id: number;
  hesap_tipi: 'kasa' | 'banka';
  hesap_adi: string;
  banka_adi: string | null;
  sube: string | null;
  hesap_no: string | null;
  iban: string | null;
  para_birimi: string;
  bakiye: number;
  kredi_limiti: number;
  gunluk_limit: number | null;
  aktif: boolean;
  varsayilan: boolean;
  notlar: string | null;
  created_at: string;
}

interface Hareket {
  id: number;
  hesap_id: number;
  hareket_tipi: 'giris' | 'cikis' | 'transfer';
  tutar: number;
  onceki_bakiye: number;
  sonraki_bakiye: number;
  karsi_hesap_id: number | null;
  aciklama: string | null;
  belge_no: string | null;
  tarih: string;
  saat: string;
  hesap?: { id: number; hesap_adi: string; hesap_tipi: string };
  karsi_hesap?: { id: number; hesap_adi: string };
  cari?: { id: number; unvan: string };
}

interface CekSenet {
  id: number;
  tip: 'cek' | 'senet';
  yonu: 'alinan' | 'verilen';
  durum: 'beklemede' | 'tahsil_edildi' | 'odendi' | 'ciro_edildi' | 'iade_edildi' | 'iptal';
  belge_no: string;
  seri_no: string | null;
  tutar: number;
  doviz: string;
  kesim_tarihi: string;
  vade_tarihi: string;
  banka_adi: string | null;
  sube_adi: string | null;
  sube_kodu: string | null;
  hesap_no: string | null;
  kesen_unvan: string;
  kesen_vkn_tckn: string | null;
  cari_id: number | null;
  cirolu_mu: boolean;
  ciro_edilen_cari_id: number | null;
  ciro_tarihi: string | null;
  islem_tarihi: string | null;
  islem_hesap_id: number | null;
  iade_nedeni: string | null;
  notlar: string | null;
  cari?: { id: number; unvan: string; telefon: string };
  ciro_cari?: { id: number; unvan: string };
  hesap?: { id: number; hesap_adi: string };
}

interface Cari {
  id: number;
  unvan: string;
  tip: string;
}

interface Ozet {
  kasa_toplam: number;
  banka_toplam: number;
  genel_toplam: number;
  alinan_cek_toplam: number;
  alinan_cek_adet: number;
  verilen_cek_toplam: number;
  verilen_cek_adet: number;
  alinan_senet_toplam: number;
  alinan_senet_adet: number;
  verilen_senet_toplam: number;
  verilen_senet_adet: number;
  vadesi_gecmis_toplam: number;
  vadesi_gecmis_adet: number;
  bu_hafta_vadeli_toplam: number;
  bu_hafta_vadeli_adet: number;
}

// Bankalar listesi
const bankalar = [
  'Ana Kasa',
  'Ziraat Bankası',
  'Garanti BBVA',
  'İş Bankası',
  'Yapı Kredi',
  'Akbank',
  'QNB Finansbank',
  'Halkbank',
  'Vakıfbank',
  'TEB',
  'Denizbank',
  'Şekerbank',
  'Diğer',
];

export default function KasaBankaPage() {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';

  // Modals
  const [hesapOpened, { open: openHesap, close: closeHesap }] = useDisclosure(false);
  const [hareketOpened, { open: openHareket, close: closeHareket }] = useDisclosure(false);
  const [cekSenetOpened, { open: openCekSenet, close: closeCekSenet }] = useDisclosure(false);
  const [tahsilOpened, { open: openTahsil, close: closeTahsil }] = useDisclosure(false);
  const [ciroOpened, { open: openCiro, close: closeCiro }] = useDisclosure(false);

  // Data states
  const [loading, setLoading] = useState(true);
  const [hesaplar, setHesaplar] = useState<Hesap[]>([]);
  const [hareketler, setHareketler] = useState<Hareket[]>([]);
  const [cekSenetler, setCekSenetler] = useState<CekSenet[]>([]);
  const [cariler, setCariler] = useState<Cari[]>([]);
  const [ozet, setOzet] = useState<Ozet | null>(null);

  // Edit states
  const [editingHesap, setEditingHesap] = useState<Hesap | null>(null);
  const [selectedCekSenet, setSelectedCekSenet] = useState<CekSenet | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>('hesaplar');

  // Form states
  const [hesapForm, setHesapForm] = useState({
    hesap_tipi: 'banka' as 'kasa' | 'banka',
    hesap_adi: '',
    banka_adi: '',
    sube: '',
    hesap_no: '',
    iban: '',
    para_birimi: 'TRY',
    bakiye: 0,
    kredi_limiti: 0,
    aktif: true,
  });

  const [hareketForm, setHareketForm] = useState({
    hesap_id: '',
    hareket_tipi: 'giris' as 'giris' | 'cikis' | 'transfer',
    tutar: 0,
    aciklama: '',
    belge_no: '',
    tarih: new Date(),
    karsi_hesap_id: '',
  });

  const [cekSenetForm, setCekSenetForm] = useState({
    tip: 'cek' as 'cek' | 'senet',
    yonu: 'alinan' as 'alinan' | 'verilen',
    belge_no: '',
    seri_no: '',
    tutar: 0,
    kesim_tarihi: new Date(),
    vade_tarihi: new Date(),
    banka_adi: '',
    sube_adi: '',
    hesap_no: '',
    kesen_unvan: '',
    kesen_vkn_tckn: '',
    cari_id: '',
    notlar: '',
  });

  const [tahsilForm, setTahsilForm] = useState({
    hesap_id: '',
    tarih: new Date(),
    aciklama: '',
  });

  const [ciroForm, setCiroForm] = useState({
    ciro_cari_id: '',
    tarih: new Date(),
    aciklama: '',
  });

  // Data loading
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [hesaplarRes, hareketlerRes, cekSenetRes, carilerRes, ozetRes] = await Promise.all([
        muhasebeAPI.getKasaBankaHesaplar(),
        muhasebeAPI.getKasaBankaHareketler({ limit: 50 }),
        muhasebeAPI.getCekSenetler({ limit: 100 }),
        muhasebeAPI.getKasaBankaCariler(),
        muhasebeAPI.getKasaBankaOzet(),
      ]);

      if (hesaplarRes.success) setHesaplar((hesaplarRes.data || []) as any);
      if (hareketlerRes.success) setHareketler((hareketlerRes.data || []) as any);
      if (cekSenetRes.success) setCekSenetler(cekSenetRes.data || []);
      if (carilerRes.success) setCariler(carilerRes.data || []);
      if (ozetRes.success) setOzet(ozetRes.data);
    } catch (error) {
      console.error('Veri yükleme hatası:', error);
      notifications.show({ title: 'Hata', message: 'Veriler yüklenemedi', color: 'red' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Para formatı
  const formatMoney = (value: number) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 0,
    }).format(value);
  };


  // Vade durumu hesapla
  const getVadeDurumu = (vade: string) => {
    const bugun = new Date();
    const vadeTarihi = new Date(vade);
    const fark = Math.ceil((vadeTarihi.getTime() - bugun.getTime()) / (1000 * 60 * 60 * 24));

    if (fark < 0) return { renk: 'red', text: `${Math.abs(fark)} gün geçti` };
    if (fark === 0) return { renk: 'orange', text: 'Bugün' };
    if (fark <= 7) return { renk: 'yellow', text: `${fark} gün` };
    if (fark <= 30) return { renk: 'blue', text: `${fark} gün` };
    return { renk: 'gray', text: `${fark} gün` };
  };

  // Durum badge
  const getDurumBadge = (durum: string) => {
    const config: Record<string, { color: string; label: string }> = {
      beklemede: { color: 'blue', label: 'Beklemede' },
      tahsil_edildi: { color: 'green', label: 'Tahsil Edildi' },
      odendi: { color: 'green', label: 'Ödendi' },
      ciro_edildi: { color: 'violet', label: 'Ciro Edildi' },
      iade_edildi: { color: 'red', label: 'İade' },
      iptal: { color: 'gray', label: 'İptal' },
    };
    return config[durum] || { color: 'gray', label: durum };
  };

  // =====================
  // HESAP İŞLEMLERİ
  // =====================
  const handleHesapSubmit = async () => {
    if (!hesapForm.hesap_adi) {
      notifications.show({ title: 'Hata!', message: 'Hesap adı gerekli.', color: 'red' });
      return;
    }

    try {
      const result = editingHesap
        ? await muhasebeAPI.updateKasaBankaHesap(editingHesap.id, hesapForm as any)
        : await muhasebeAPI.createKasaBankaHesap(hesapForm as any);

      if (!result.success) throw new Error('İşlem başarısız');

      notifications.show({
        title: 'Başarılı!',
        message: 'Hesap kaydedildi.',
        color: 'green',
        icon: <IconCheck size={16} />,
      });
      loadData();
      resetHesapForm();
      closeHesap();
    } catch (_error) {
      notifications.show({ title: 'Hata!', message: 'Hesap kaydedilemedi.', color: 'red' });
    }
  };

  const handleDeleteHesap = async (id: number) => {
    if (!confirm('Bu hesabı silmek istediğinize emin misiniz?')) return;

    try {
      await muhasebeAPI.deleteKasaBankaHesap(id);
      notifications.show({ title: 'Silindi', message: 'Hesap silindi.', color: 'orange' });
      loadData();
    } catch (_error) {
      notifications.show({ title: 'Hata!', message: 'Hesap silinemedi.', color: 'red' });
    }
  };

  // =====================
  // HAREKET İŞLEMLERİ
  // =====================
  const handleHareketSubmit = async () => {
    if (!hareketForm.hesap_id || hareketForm.tutar <= 0) {
      notifications.show({ title: 'Hata!', message: 'Hesap ve tutar gerekli.', color: 'red' });
      return;
    }

    try {
      let result;
      if (hareketForm.hareket_tipi === 'transfer') {
        result = await muhasebeAPI.transferKasaBanka({
          kaynak_hesap_id: parseInt(hareketForm.hesap_id, 10),
          hedef_hesap_id: parseInt(hareketForm.karsi_hesap_id, 10),
          tutar: hareketForm.tutar,
          aciklama: hareketForm.aciklama,
          tarih: hareketForm.tarih.toISOString().split('T')[0],
        });
      } else {
        result = await muhasebeAPI.createKasaBankaHareket({
          hesap_id: parseInt(hareketForm.hesap_id, 10),
          tip: hareketForm.hareket_tipi as any,
          tutar: hareketForm.tutar,
          aciklama: hareketForm.aciklama,
          tarih: hareketForm.tarih.toISOString().split('T')[0],
        });
      }

      if (!result.success) throw new Error('İşlem başarısız');

      notifications.show({
        title: 'Başarılı!',
        message: 'Hareket kaydedildi.',
        color: 'green',
        icon: <IconCheck size={16} />,
      });
      loadData();
      resetHareketForm();
      closeHareket();
    } catch (_error) {
      notifications.show({ title: 'Hata!', message: 'Hareket kaydedilemedi.', color: 'red' });
    }
  };

  // =====================
  // ÇEK/SENET İŞLEMLERİ
  // =====================
  const handleCekSenetSubmit = async () => {
    if (!cekSenetForm.belge_no || !cekSenetForm.kesen_unvan || cekSenetForm.tutar <= 0) {
      notifications.show({
        title: 'Hata!',
        message: 'Belge no, keşideci ve tutar gerekli.',
        color: 'red',
      });
      return;
    }

    try {
      const result = await muhasebeAPI.createCekSenet({
        ...cekSenetForm,
        kesim_tarihi: cekSenetForm.kesim_tarihi.toISOString().split('T')[0],
        vade_tarihi: cekSenetForm.vade_tarihi.toISOString().split('T')[0],
        cari_id: cekSenetForm.cari_id ? parseInt(cekSenetForm.cari_id, 10) : null,
      });

      if (!result.success) throw new Error('İşlem başarısız');

      notifications.show({
        title: 'Başarılı!',
        message: 'Çek/Senet kaydedildi.',
        color: 'green',
        icon: <IconCheck size={16} />,
      });
      loadData();
      resetCekSenetForm();
      closeCekSenet();
    } catch (_error) {
      notifications.show({ title: 'Hata!', message: 'Çek/Senet kaydedilemedi.', color: 'red' });
    }
  };

  const handleTahsil = async () => {
    if (!selectedCekSenet || !tahsilForm.hesap_id) {
      notifications.show({ title: 'Hata!', message: 'Hesap seçimi gerekli.', color: 'red' });
      return;
    }

    try {
      const result = await muhasebeAPI.tahsilCekSenet(selectedCekSenet.id, {
        hesap_id: parseInt(tahsilForm.hesap_id, 10),
        tarih: tahsilForm.tarih.toISOString().split('T')[0],
      });

      if (!result.success) throw new Error('İşlem başarısız');

      notifications.show({
        title: 'Başarılı!',
        message: selectedCekSenet.yonu === 'alinan' ? 'Tahsilat kaydedildi.' : 'Ödeme kaydedildi.',
        color: 'green',
        icon: <IconCheck size={16} />,
      });
      loadData();
      closeTahsil();
      setSelectedCekSenet(null);
    } catch (_error) {
      notifications.show({ title: 'Hata!', message: 'İşlem kaydedilemedi.', color: 'red' });
    }
  };

  const handleCiro = async () => {
    if (!selectedCekSenet || !ciroForm.ciro_cari_id) {
      notifications.show({ title: 'Hata!', message: 'Cari seçimi gerekli.', color: 'red' });
      return;
    }

    try {
      const result = await muhasebeAPI.ciroCekSenet(selectedCekSenet.id, {
        ciro_cari_id: parseInt(ciroForm.ciro_cari_id, 10),
        ciro_tarihi: ciroForm.tarih.toISOString().split('T')[0],
      });

      if (!result.success) throw new Error('İşlem başarısız');

      notifications.show({
        title: 'Başarılı!',
        message: 'Ciro kaydedildi.',
        color: 'green',
        icon: <IconCheck size={16} />,
      });
      loadData();
      closeCiro();
      setSelectedCekSenet(null);
    } catch (_error) {
      notifications.show({ title: 'Hata!', message: 'Ciro kaydedilemedi.', color: 'red' });
    }
  };

  const handleIade = async (cekSenet: CekSenet) => {
    const neden = prompt('İade nedeni:');
    if (!neden) return;

    try {
      const result = await muhasebeAPI.iadeCekSenet(cekSenet.id);

      if (!result.success) throw new Error('İşlem başarısız');

      notifications.show({ title: 'Kaydedildi', message: 'İade kaydedildi.', color: 'orange' });
      loadData();
    } catch (_error) {
      notifications.show({ title: 'Hata!', message: 'İade kaydedilemedi.', color: 'red' });
    }
  };

  const handleDeleteCekSenet = async (id: number) => {
    if (!confirm('Bu kaydı silmek istediğinize emin misiniz?')) return;

    try {
      await muhasebeAPI.deleteCekSenet(id);
      notifications.show({ title: 'Silindi', message: 'Kayıt silindi.', color: 'orange' });
      loadData();
    } catch (_error) {
      notifications.show({ title: 'Hata!', message: 'Kayıt silinemedi.', color: 'red' });
    }
  };

  // Reset fonksiyonları
  const resetHesapForm = () => {
    setEditingHesap(null);
    setHesapForm({
      hesap_tipi: 'banka',
      hesap_adi: '',
      banka_adi: '',
      sube: '',
      hesap_no: '',
      iban: '',
      para_birimi: 'TRY',
      bakiye: 0,
      kredi_limiti: 0,
      aktif: true,
    });
  };

  const resetHareketForm = () => {
    setHareketForm({
      hesap_id: '',
      hareket_tipi: 'giris',
      tutar: 0,
      aciklama: '',
      belge_no: '',
      tarih: new Date(),
      karsi_hesap_id: '',
    });
  };

  const resetCekSenetForm = () => {
    setCekSenetForm({
      tip: 'cek',
      yonu: 'alinan',
      belge_no: '',
      seri_no: '',
      tutar: 0,
      kesim_tarihi: new Date(),
      vade_tarihi: new Date(),
      banka_adi: '',
      sube_adi: '',
      hesap_no: '',
      kesen_unvan: '',
      kesen_vkn_tckn: '',
      cari_id: '',
      notlar: '',
    });
  };

  // Düzenleme
  const handleEditHesap = (hesap: Hesap) => {
    setEditingHesap(hesap);
    setHesapForm({
      hesap_tipi: hesap.hesap_tipi,
      hesap_adi: hesap.hesap_adi,
      banka_adi: hesap.banka_adi || '',
      sube: hesap.sube || '',
      hesap_no: hesap.hesap_no || '',
      iban: hesap.iban || '',
      para_birimi: hesap.para_birimi,
      bakiye: hesap.bakiye,
      kredi_limiti: hesap.kredi_limiti,
      aktif: hesap.aktif,
    });
    openHesap();
  };

  // Filtreleme
  const alinanCekler = cekSenetler.filter((c) => c.tip === 'cek' && c.yonu === 'alinan');
  const verilenCekler = cekSenetler.filter((c) => c.tip === 'cek' && c.yonu === 'verilen');
  const alinanSenetler = cekSenetler.filter((c) => c.tip === 'senet' && c.yonu === 'alinan');
  const verilenSenetler = cekSenetler.filter((c) => c.tip === 'senet' && c.yonu === 'verilen');

  if (loading) {
    return (
      <Center h="80vh">
        <Stack align="center" gap="md">
          <Loader size="lg" />
          <Text c="dimmed">Veriler yükleniyor...</Text>
        </Stack>
      </Center>
    );
  }

  return (
    <Box
      style={{
        background: isDark
          ? 'linear-gradient(180deg, rgba(34,139,34,0.05) 0%, rgba(0,0,0,0) 100%)'
          : 'linear-gradient(180deg, rgba(34,139,34,0.08) 0%, rgba(255,255,255,0) 100%)',
        minHeight: '100vh',
      }}
    >
      <Container size="xl" py="xl">
        <Stack gap="xl">
          {/* Header */}
          <Group justify="space-between" align="flex-end">
            <Box>
              <Title order={1} fw={700}>
                🏦 Kasa / Banka / Çek-Senet
              </Title>
              <Text c="dimmed" size="lg">
                Nakit akışı ve kıymetli evrak takibi
              </Text>
            </Box>
            <Group>
              <Button leftSection={<IconRefresh size={18} />} variant="subtle" onClick={loadData}>
                Yenile
              </Button>
              <Button
                leftSection={<IconArrowsExchange size={18} />}
                variant="light"
                onClick={() => {
                  resetHareketForm();
                  openHareket();
                }}
              >
                Hareket
              </Button>
              <Button
                leftSection={<IconReceipt size={18} />}
                variant="light"
                color="violet"
                onClick={() => {
                  resetCekSenetForm();
                  openCekSenet();
                }}
              >
                Çek/Senet
              </Button>
              <Button
                leftSection={<IconPlus size={18} />}
                variant="gradient"
                gradient={{ from: 'green', to: 'teal' }}
                onClick={() => {
                  resetHesapForm();
                  openHesap();
                }}
              >
                Yeni Hesap
              </Button>
            </Group>
          </Group>

          {/* Özet Kartları */}
          {ozet && (
            <SimpleGrid cols={{ base: 2, sm: 3, md: 6 }}>
              <Card withBorder shadow="sm" p="md" radius="md">
                <Group justify="space-between">
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                    Kasa
                  </Text>
                  <ThemeIcon color="teal" variant="light" size="sm" radius="xl">
                    <IconCash size={14} />
                  </ThemeIcon>
                </Group>
                <Text fw={700} size="lg" mt="xs">
                  {formatMoney(ozet.kasa_toplam)}
                </Text>
              </Card>
              <Card withBorder shadow="sm" p="md" radius="md">
                <Group justify="space-between">
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                    Banka
                  </Text>
                  <ThemeIcon color="blue" variant="light" size="sm" radius="xl">
                    <IconBuildingBank size={14} />
                  </ThemeIcon>
                </Group>
                <Text fw={700} size="lg" mt="xs">
                  {formatMoney(ozet.banka_toplam)}
                </Text>
              </Card>
              <Card withBorder shadow="sm" p="md" radius="md">
                <Group justify="space-between">
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                    Alınan Çekler
                  </Text>
                  <ThemeIcon color="green" variant="light" size="sm" radius="xl">
                    <IconReceipt size={14} />
                  </ThemeIcon>
                </Group>
                <Text fw={700} size="lg" mt="xs">
                  {formatMoney(ozet.alinan_cek_toplam)}
                </Text>
                <Text size="xs" c="dimmed">
                  {ozet.alinan_cek_adet} adet
                </Text>
              </Card>
              <Card withBorder shadow="sm" p="md" radius="md">
                <Group justify="space-between">
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                    Verilen Çekler
                  </Text>
                  <ThemeIcon color="red" variant="light" size="sm" radius="xl">
                    <IconSend size={14} />
                  </ThemeIcon>
                </Group>
                <Text fw={700} size="lg" mt="xs">
                  {formatMoney(ozet.verilen_cek_toplam)}
                </Text>
                <Text size="xs" c="dimmed">
                  {ozet.verilen_cek_adet} adet
                </Text>
              </Card>
              <Card
                withBorder
                shadow="sm"
                p="md"
                radius="md"
                style={{
                  borderColor:
                    ozet.vadesi_gecmis_adet > 0 ? 'var(--mantine-color-red-5)' : undefined,
                }}
              >
                <Group justify="space-between">
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                    Vadesi Geçmiş
                  </Text>
                  <ThemeIcon color="red" variant="light" size="sm" radius="xl">
                    <IconAlertTriangle size={14} />
                  </ThemeIcon>
                </Group>
                <Text
                  fw={700}
                  size="lg"
                  mt="xs"
                  c={ozet.vadesi_gecmis_adet > 0 ? 'red' : undefined}
                >
                  {formatMoney(ozet.vadesi_gecmis_toplam)}
                </Text>
                <Text size="xs" c="dimmed">
                  {ozet.vadesi_gecmis_adet} adet
                </Text>
              </Card>
              <Card
                withBorder
                shadow="sm"
                p="md"
                radius="md"
                style={{
                  borderColor:
                    ozet.bu_hafta_vadeli_adet > 0 ? 'var(--mantine-color-orange-5)' : undefined,
                }}
              >
                <Group justify="space-between">
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                    Bu Hafta
                  </Text>
                  <ThemeIcon color="orange" variant="light" size="sm" radius="xl">
                    <IconClockHour4 size={14} />
                  </ThemeIcon>
                </Group>
                <Text
                  fw={700}
                  size="lg"
                  mt="xs"
                  c={ozet.bu_hafta_vadeli_adet > 0 ? 'orange' : undefined}
                >
                  {formatMoney(ozet.bu_hafta_vadeli_toplam)}
                </Text>
                <Text size="xs" c="dimmed">
                  {ozet.bu_hafta_vadeli_adet} adet
                </Text>
              </Card>
            </SimpleGrid>
          )}

          {/* Ana Tabs */}
          <Tabs value={activeTab} onChange={setActiveTab}>
            <Tabs.List>
              <Tabs.Tab value="hesaplar" leftSection={<IconWallet size={16} />}>
                Hesaplar
              </Tabs.Tab>
              <Tabs.Tab value="hareketler" leftSection={<IconArrowsExchange size={16} />}>
                Hareketler
              </Tabs.Tab>
              <Tabs.Tab value="alinan-cekler" leftSection={<IconReceipt size={16} />}>
                Alınan Çekler ({alinanCekler.length})
              </Tabs.Tab>
              <Tabs.Tab value="verilen-cekler" leftSection={<IconSend size={16} />}>
                Verilen Çekler ({verilenCekler.length})
              </Tabs.Tab>
              <Tabs.Tab value="alinan-senetler" leftSection={<IconFileInvoice size={16} />}>
                Alınan Senetler ({alinanSenetler.length})
              </Tabs.Tab>
              <Tabs.Tab value="verilen-senetler" leftSection={<IconFileInvoice size={16} />}>
                Verilen Senetler ({verilenSenetler.length})
              </Tabs.Tab>
            </Tabs.List>

            {/* HESAPLAR TAB */}
            <Tabs.Panel value="hesaplar" pt="md">
              <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
                {hesaplar.map((hesap) => (
                  <Paper key={hesap.id} withBorder p="lg" radius="md" shadow="sm">
                    <Group justify="space-between" mb="md">
                      <Group>
                        <ThemeIcon
                          color={hesap.hesap_tipi === 'kasa' ? 'teal' : 'blue'}
                          variant="light"
                          size="lg"
                          radius="md"
                        >
                          {hesap.hesap_tipi === 'kasa' ? (
                            <IconCash size={20} />
                          ) : (
                            <IconCreditCard size={20} />
                          )}
                        </ThemeIcon>
                        <div>
                          <Text size="sm" fw={600}>
                            {hesap.hesap_adi}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {hesap.banka_adi || hesap.hesap_tipi === 'kasa' ? 'Kasa' : 'Banka'}
                          </Text>
                        </div>
                      </Group>
                      <Menu position="bottom-end" shadow="md">
                        <Menu.Target>
                          <ActionIcon variant="subtle" color="gray">
                            <IconDotsVertical size={16} />
                          </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                          <Menu.Item
                            leftSection={<IconEdit size={14} />}
                            onClick={() => handleEditHesap(hesap)}
                          >
                            Düzenle
                          </Menu.Item>
                          <Menu.Item
                            color="red"
                            leftSection={<IconTrash size={14} />}
                            onClick={() => handleDeleteHesap(hesap.id)}
                          >
                            Sil
                          </Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                    </Group>
                    <Text size="xl" fw={700} c={hesap.bakiye >= 0 ? 'green' : 'red'}>
                      {formatMoney(hesap.bakiye)}
                    </Text>
                    {hesap.iban && (
                      <Text size="xs" c="dimmed" mt="xs">
                        {hesap.iban}
                      </Text>
                    )}
                  </Paper>
                ))}
              </SimpleGrid>
            </Tabs.Panel>

            {/* HAREKETLER TAB */}
            <Tabs.Panel value="hareketler" pt="md">
              <Card withBorder shadow="sm" radius="md">
                <Table.ScrollContainer minWidth={700}>
                  <Table verticalSpacing="sm" highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Tip</Table.Th>
                        <Table.Th>Hesap</Table.Th>
                        <Table.Th>Açıklama</Table.Th>
                        <Table.Th>Tarih</Table.Th>
                        <Table.Th style={{ textAlign: 'right' }}>Tutar</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {hareketler.map((hareket) => (
                        <Table.Tr key={hareket.id}>
                          <Table.Td>
                            <ThemeIcon
                              color={
                                hareket.hareket_tipi === 'giris'
                                  ? 'green'
                                  : hareket.hareket_tipi === 'cikis'
                                    ? 'red'
                                    : 'blue'
                              }
                              variant="light"
                              size="sm"
                              radius="xl"
                            >
                              {hareket.hareket_tipi === 'giris' ? (
                                <IconArrowUpRight size={14} />
                              ) : hareket.hareket_tipi === 'cikis' ? (
                                <IconArrowDownRight size={14} />
                              ) : (
                                <IconArrowsExchange size={14} />
                              )}
                            </ThemeIcon>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm">{hareket.hesap?.hesap_adi || '-'}</Text>
                            {hareket.hareket_tipi === 'transfer' && hareket.karsi_hesap && (
                              <Text size="xs" c="dimmed">
                                → {hareket.karsi_hesap.hesap_adi}
                              </Text>
                            )}
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm">{hareket.aciklama || '-'}</Text>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm" c="dimmed">
                              {formatDate(hareket.tarih)}
                            </Text>
                          </Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}>
                            <Text
                              size="sm"
                              fw={600}
                              c={
                                hareket.hareket_tipi === 'giris'
                                  ? 'green'
                                  : hareket.hareket_tipi === 'cikis'
                                    ? 'red'
                                    : 'blue'
                              }
                            >
                              {hareket.hareket_tipi === 'giris'
                                ? '+'
                                : hareket.hareket_tipi === 'cikis'
                                  ? '-'
                                  : ''}
                              {formatMoney(hareket.tutar)}
                            </Text>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
              </Card>
            </Tabs.Panel>

            {/* ÇEK/SENET TABLARI - renderCekSenetTable fonksiyonu */}
            {['alinan-cekler', 'verilen-cekler', 'alinan-senetler', 'verilen-senetler'].map(
              (tabValue) => {
                const liste =
                  tabValue === 'alinan-cekler'
                    ? alinanCekler
                    : tabValue === 'verilen-cekler'
                      ? verilenCekler
                      : tabValue === 'alinan-senetler'
                        ? alinanSenetler
                        : verilenSenetler;

                const isAlinan = tabValue.startsWith('alinan');

                return (
                  <Tabs.Panel key={tabValue} value={tabValue} pt="md">
                    <Card withBorder shadow="sm" radius="md">
                      <Table.ScrollContainer minWidth={900}>
                        <Table verticalSpacing="sm" highlightOnHover>
                          <Table.Thead>
                            <Table.Tr>
                              <Table.Th>Belge No</Table.Th>
                              <Table.Th>{isAlinan ? 'Kimden' : 'Kime'}</Table.Th>
                              <Table.Th>Keşideci</Table.Th>
                              <Table.Th>Banka</Table.Th>
                              <Table.Th>Vade</Table.Th>
                              <Table.Th>Durum</Table.Th>
                              <Table.Th style={{ textAlign: 'right' }}>Tutar</Table.Th>
                              <Table.Th></Table.Th>
                            </Table.Tr>
                          </Table.Thead>
                          <Table.Tbody>
                            {liste.map((item) => {
                              const vade = getVadeDurumu(item.vade_tarihi);
                              const durumBadge = getDurumBadge(item.durum);

                              return (
                                <Table.Tr key={item.id}>
                                  <Table.Td>
                                    <Text size="sm" fw={500}>
                                      {item.belge_no}
                                    </Text>
                                    {item.seri_no && (
                                      <Text size="xs" c="dimmed">
                                        Seri: {item.seri_no}
                                      </Text>
                                    )}
                                  </Table.Td>
                                  <Table.Td>
                                    <Text size="sm">{item.cari?.unvan || '-'}</Text>
                                  </Table.Td>
                                  <Table.Td>
                                    <Text size="sm">{item.kesen_unvan}</Text>
                                    {item.kesen_vkn_tckn && (
                                      <Text size="xs" c="dimmed">
                                        {item.kesen_vkn_tckn}
                                      </Text>
                                    )}
                                  </Table.Td>
                                  <Table.Td>
                                    <Text size="sm">{item.banka_adi || '-'}</Text>
                                  </Table.Td>
                                  <Table.Td>
                                    <Group gap="xs">
                                      <Text size="sm">{formatDate(item.vade_tarihi)}</Text>
                                      {item.durum === 'beklemede' && (
                                        <Badge size="xs" color={vade.renk} variant="light">
                                          {vade.text}
                                        </Badge>
                                      )}
                                    </Group>
                                  </Table.Td>
                                  <Table.Td>
                                    <Badge color={durumBadge.color} variant="light">
                                      {durumBadge.label}
                                    </Badge>
                                    {item.cirolu_mu && item.ciro_cari && (
                                      <Text size="xs" c="dimmed">
                                        → {item.ciro_cari.unvan}
                                      </Text>
                                    )}
                                  </Table.Td>
                                  <Table.Td style={{ textAlign: 'right' }}>
                                    <Text size="sm" fw={700} c={isAlinan ? 'green' : 'red'}>
                                      {formatMoney(item.tutar)}
                                    </Text>
                                  </Table.Td>
                                  <Table.Td>
                                    {item.durum === 'beklemede' && (
                                      <Menu position="bottom-end" shadow="md">
                                        <Menu.Target>
                                          <ActionIcon variant="subtle" color="gray">
                                            <IconDotsVertical size={16} />
                                          </ActionIcon>
                                        </Menu.Target>
                                        <Menu.Dropdown>
                                          <Menu.Item
                                            leftSection={<IconCheck size={14} />}
                                            onClick={() => {
                                              setSelectedCekSenet(item);
                                              setTahsilForm({
                                                hesap_id: '',
                                                tarih: new Date(),
                                                aciklama: '',
                                              });
                                              openTahsil();
                                            }}
                                          >
                                            {isAlinan ? 'Tahsil Et' : 'Ödendi'}
                                          </Menu.Item>
                                          {isAlinan && (
                                            <Menu.Item
                                              leftSection={<IconSend size={14} />}
                                              onClick={() => {
                                                setSelectedCekSenet(item);
                                                setCiroForm({
                                                  ciro_cari_id: '',
                                                  tarih: new Date(),
                                                  aciklama: '',
                                                });
                                                openCiro();
                                              }}
                                            >
                                              Ciro Et
                                            </Menu.Item>
                                          )}
                                          <Menu.Item
                                            leftSection={<IconReceiptRefund size={14} />}
                                            color="orange"
                                            onClick={() => handleIade(item)}
                                          >
                                            İade
                                          </Menu.Item>
                                          <Menu.Divider />
                                          <Menu.Item
                                            leftSection={<IconTrash size={14} />}
                                            color="red"
                                            onClick={() => handleDeleteCekSenet(item.id)}
                                          >
                                            Sil
                                          </Menu.Item>
                                        </Menu.Dropdown>
                                      </Menu>
                                    )}
                                  </Table.Td>
                                </Table.Tr>
                              );
                            })}
                            {liste.length === 0 && (
                              <Table.Tr>
                                <Table.Td colSpan={8}>
                                  <Text ta="center" c="dimmed" py="xl">
                                    Kayıt bulunamadı
                                  </Text>
                                </Table.Td>
                              </Table.Tr>
                            )}
                          </Table.Tbody>
                        </Table>
                      </Table.ScrollContainer>
                    </Card>
                  </Tabs.Panel>
                );
              }
            )}
          </Tabs>
        </Stack>

        {/* ===================== MODALS ===================== */}

        {/* Hesap Modal */}
        <Modal
          opened={hesapOpened}
          onClose={() => {
            resetHesapForm();
            closeHesap();
          }}
          title={<Title order={3}>{editingHesap ? 'Hesap Düzenle' : 'Yeni Hesap'}</Title>}
          size="md"
        >
          <Stack gap="md">
            <Select
              label="Hesap Tipi"
              data={[
                { label: '💵 Kasa', value: 'kasa' },
                { label: '🏦 Banka Hesabı', value: 'banka' },
              ]}
              value={hesapForm.hesap_tipi}
              onChange={(v) => setHesapForm({ ...hesapForm, hesap_tipi: v as any })}
            />
            <TextInput
              label="Hesap Adı"
              placeholder="Örn: Ana Kasa"
              value={hesapForm.hesap_adi}
              onChange={(e) => setHesapForm({ ...hesapForm, hesap_adi: e.currentTarget.value })}
              required
            />
            {hesapForm.hesap_tipi === 'banka' && (
              <>
                <Select
                  label="Banka"
                  data={bankalar}
                  value={hesapForm.banka_adi}
                  onChange={(v) => setHesapForm({ ...hesapForm, banka_adi: v || '' })}
                  searchable
                />
                <TextInput
                  label="Şube"
                  placeholder="Şube adı"
                  value={hesapForm.sube}
                  onChange={(e) => setHesapForm({ ...hesapForm, sube: e.currentTarget.value })}
                />
                <TextInput
                  label="IBAN"
                  placeholder="TR00 0000 0000 0000 0000 0000 00"
                  value={hesapForm.iban}
                  onChange={(e) => setHesapForm({ ...hesapForm, iban: e.currentTarget.value })}
                />
              </>
            )}
            <NumberInput
              label="Başlangıç Bakiyesi (₺)"
              value={hesapForm.bakiye}
              onChange={(v) => setHesapForm({ ...hesapForm, bakiye: Number(v) || 0 })}
              thousandSeparator="."
              decimalSeparator=","
            />
            <Group justify="flex-end" mt="md">
              <Button
                variant="default"
                onClick={() => {
                  resetHesapForm();
                  closeHesap();
                }}
              >
                İptal
              </Button>
              <Button color="green" onClick={handleHesapSubmit}>
                {editingHesap ? 'Güncelle' : 'Kaydet'}
              </Button>
            </Group>
          </Stack>
        </Modal>

        {/* Hareket Modal */}
        <Modal
          opened={hareketOpened}
          onClose={() => {
            resetHareketForm();
            closeHareket();
          }}
          title={<Title order={3}>Yeni Hareket</Title>}
          size="md"
        >
          <Stack gap="md">
            <Select
              label="İşlem Tipi"
              data={[
                { label: '📥 Giriş', value: 'giris' },
                { label: '📤 Çıkış', value: 'cikis' },
                { label: '🔄 Transfer', value: 'transfer' },
              ]}
              value={hareketForm.hareket_tipi}
              onChange={(v) => setHareketForm({ ...hareketForm, hareket_tipi: v as any })}
            />
            <Select
              label="Hesap"
              placeholder="Hesap seçin"
              data={hesaplar.map((h) => ({
                label: `${h.hesap_adi} (${formatMoney(h.bakiye)})`,
                value: h.id.toString(),
              }))}
              value={hareketForm.hesap_id}
              onChange={(v) => setHareketForm({ ...hareketForm, hesap_id: v || '' })}
              required
            />
            {hareketForm.hareket_tipi === 'transfer' && (
              <Select
                label="Hedef Hesap"
                placeholder="Transfer edilecek hesap"
                data={hesaplar
                  .filter((h) => h.id.toString() !== hareketForm.hesap_id)
                  .map((h) => ({ label: h.hesap_adi, value: h.id.toString() }))}
                value={hareketForm.karsi_hesap_id}
                onChange={(v) => setHareketForm({ ...hareketForm, karsi_hesap_id: v || '' })}
                required
              />
            )}
            <NumberInput
              label="Tutar (₺)"
              value={hareketForm.tutar}
              onChange={(v) => setHareketForm({ ...hareketForm, tutar: Number(v) || 0 })}
              min={0}
              thousandSeparator="."
              decimalSeparator=","
              required
            />
            <TextInput
              label="Açıklama"
              placeholder="İşlem açıklaması"
              value={hareketForm.aciklama}
              onChange={(e) => setHareketForm({ ...hareketForm, aciklama: e.currentTarget.value })}
            />
            <TextInput
              label="Belge No"
              placeholder="Fatura/Makbuz no"
              value={hareketForm.belge_no}
              onChange={(e) => setHareketForm({ ...hareketForm, belge_no: e.currentTarget.value })}
            />
            <StyledDatePicker
              label="Tarih"
              value={hareketForm.tarih}
              onChange={(v) => setHareketForm({ ...hareketForm, tarih: v || new Date() })}
            />
            <Group justify="flex-end" mt="md">
              <Button
                variant="default"
                onClick={() => {
                  resetHareketForm();
                  closeHareket();
                }}
              >
                İptal
              </Button>
              <Button
                color={
                  hareketForm.hareket_tipi === 'giris'
                    ? 'green'
                    : hareketForm.hareket_tipi === 'cikis'
                      ? 'red'
                      : 'blue'
                }
                onClick={handleHareketSubmit}
              >
                Kaydet
              </Button>
            </Group>
          </Stack>
        </Modal>

        {/* Çek/Senet Modal */}
        <Modal
          opened={cekSenetOpened}
          onClose={() => {
            resetCekSenetForm();
            closeCekSenet();
          }}
          title={<Title order={3}>Yeni Çek/Senet</Title>}
          size="lg"
        >
          <Stack gap="md">
            <Group grow>
              <Select
                label="Tip"
                data={[
                  { label: '📝 Çek', value: 'cek' },
                  { label: '📄 Senet', value: 'senet' },
                ]}
                value={cekSenetForm.tip}
                onChange={(v) => setCekSenetForm({ ...cekSenetForm, tip: v as any })}
              />
              <Select
                label="Yön"
                data={[
                  { label: '📥 Alınan', value: 'alinan' },
                  { label: '📤 Verilen', value: 'verilen' },
                ]}
                value={cekSenetForm.yonu}
                onChange={(v) => setCekSenetForm({ ...cekSenetForm, yonu: v as any })}
              />
            </Group>
            <Group grow>
              <TextInput
                label="Belge No"
                placeholder="Çek/Senet numarası"
                value={cekSenetForm.belge_no}
                onChange={(e) =>
                  setCekSenetForm({ ...cekSenetForm, belge_no: e.currentTarget.value })
                }
                required
              />
              <TextInput
                label="Seri No"
                placeholder="Seri numarası"
                value={cekSenetForm.seri_no}
                onChange={(e) =>
                  setCekSenetForm({ ...cekSenetForm, seri_no: e.currentTarget.value })
                }
              />
            </Group>
            <NumberInput
              label="Tutar (₺)"
              value={cekSenetForm.tutar}
              onChange={(v) => setCekSenetForm({ ...cekSenetForm, tutar: Number(v) || 0 })}
              min={0}
              thousandSeparator="."
              decimalSeparator=","
              required
            />
            <Group grow>
              <StyledDatePicker
                label="Keşide Tarihi"
                value={cekSenetForm.kesim_tarihi}
                onChange={(v) =>
                  setCekSenetForm({ ...cekSenetForm, kesim_tarihi: v || new Date() })
                }
              />
              <StyledDatePicker
                label="Vade Tarihi"
                value={cekSenetForm.vade_tarihi}
                onChange={(v) => setCekSenetForm({ ...cekSenetForm, vade_tarihi: v || new Date() })}
              />
            </Group>
            <Divider label="Keşideci Bilgileri" />
            <TextInput
              label="Keşideci Unvanı"
              placeholder="Ad Soyad / Firma"
              value={cekSenetForm.kesen_unvan}
              onChange={(e) =>
                setCekSenetForm({ ...cekSenetForm, kesen_unvan: e.currentTarget.value })
              }
              required
            />
            <Group grow>
              <TextInput
                label="VKN / TCKN"
                placeholder="Vergi/TC Kimlik No"
                value={cekSenetForm.kesen_vkn_tckn}
                onChange={(e) =>
                  setCekSenetForm({ ...cekSenetForm, kesen_vkn_tckn: e.currentTarget.value })
                }
              />
              <Select
                label="İlişkili Cari"
                placeholder="Cari seçin (opsiyonel)"
                data={cariler.map((c) => ({ label: c.unvan, value: c.id.toString() }))}
                value={cekSenetForm.cari_id}
                onChange={(v) => setCekSenetForm({ ...cekSenetForm, cari_id: v || '' })}
                searchable
                clearable
              />
            </Group>
            {cekSenetForm.tip === 'cek' && (
              <>
                <Divider label="Banka Bilgileri" />
                <Group grow>
                  <Select
                    label="Banka"
                    data={bankalar.filter((b) => b !== 'Ana Kasa')}
                    value={cekSenetForm.banka_adi}
                    onChange={(v) => setCekSenetForm({ ...cekSenetForm, banka_adi: v || '' })}
                    searchable
                  />
                  <TextInput
                    label="Şube"
                    placeholder="Şube adı"
                    value={cekSenetForm.sube_adi}
                    onChange={(e) =>
                      setCekSenetForm({ ...cekSenetForm, sube_adi: e.currentTarget.value })
                    }
                  />
                </Group>
                <TextInput
                  label="Hesap No"
                  placeholder="Hesap numarası"
                  value={cekSenetForm.hesap_no}
                  onChange={(e) =>
                    setCekSenetForm({ ...cekSenetForm, hesap_no: e.currentTarget.value })
                  }
                />
              </>
            )}
            <Textarea
              label="Notlar"
              placeholder="Ek notlar"
              value={cekSenetForm.notlar}
              onChange={(e) => setCekSenetForm({ ...cekSenetForm, notlar: e.currentTarget.value })}
            />
            <Group justify="flex-end" mt="md">
              <Button
                variant="default"
                onClick={() => {
                  resetCekSenetForm();
                  closeCekSenet();
                }}
              >
                İptal
              </Button>
              <Button color="violet" onClick={handleCekSenetSubmit}>
                Kaydet
              </Button>
            </Group>
          </Stack>
        </Modal>

        {/* Tahsil Modal */}
        <Modal
          opened={tahsilOpened}
          onClose={() => {
            closeTahsil();
            setSelectedCekSenet(null);
          }}
          title={
            <Title order={3}>{selectedCekSenet?.yonu === 'alinan' ? 'Tahsilat' : 'Ödeme'}</Title>
          }
          size="md"
        >
          <Stack gap="md">
            {selectedCekSenet && (
              <Alert color="blue" variant="light">
                <Text size="sm">
                  <strong>Belge:</strong> {selectedCekSenet.belge_no}
                </Text>
                <Text size="sm">
                  <strong>Tutar:</strong> {formatMoney(selectedCekSenet.tutar)}
                </Text>
                <Text size="sm">
                  <strong>Vade:</strong> {formatDate(selectedCekSenet.vade_tarihi)}
                </Text>
              </Alert>
            )}
            <Select
              label="Hesap"
              placeholder="Hangi hesaba?"
              data={hesaplar.map((h) => ({
                label: `${h.hesap_adi} (${formatMoney(h.bakiye)})`,
                value: h.id.toString(),
              }))}
              value={tahsilForm.hesap_id}
              onChange={(v) => setTahsilForm({ ...tahsilForm, hesap_id: v || '' })}
              required
            />
            <StyledDatePicker
              label="İşlem Tarihi"
              value={tahsilForm.tarih}
              onChange={(v) => setTahsilForm({ ...tahsilForm, tarih: v || new Date() })}
            />
            <TextInput
              label="Açıklama"
              placeholder="Ek açıklama"
              value={tahsilForm.aciklama}
              onChange={(e) => setTahsilForm({ ...tahsilForm, aciklama: e.currentTarget.value })}
            />
            <Group justify="flex-end" mt="md">
              <Button
                variant="default"
                onClick={() => {
                  closeTahsil();
                  setSelectedCekSenet(null);
                }}
              >
                İptal
              </Button>
              <Button color="green" onClick={handleTahsil}>
                {selectedCekSenet?.yonu === 'alinan' ? 'Tahsil Et' : 'Ödendi Olarak İşaretle'}
              </Button>
            </Group>
          </Stack>
        </Modal>

        {/* Ciro Modal */}
        <Modal
          opened={ciroOpened}
          onClose={() => {
            closeCiro();
            setSelectedCekSenet(null);
          }}
          title={<Title order={3}>Ciro Et</Title>}
          size="md"
        >
          <Stack gap="md">
            {selectedCekSenet && (
              <Alert color="violet" variant="light">
                <Text size="sm">
                  <strong>Belge:</strong> {selectedCekSenet.belge_no}
                </Text>
                <Text size="sm">
                  <strong>Tutar:</strong> {formatMoney(selectedCekSenet.tutar)}
                </Text>
                <Text size="sm">
                  <strong>Vade:</strong> {formatDate(selectedCekSenet.vade_tarihi)}
                </Text>
              </Alert>
            )}
            <Select
              label="Ciro Edilecek Cari"
              placeholder="Kime ciro edilecek?"
              data={cariler.map((c) => ({ label: c.unvan, value: c.id.toString() }))}
              value={ciroForm.ciro_cari_id}
              onChange={(v) => setCiroForm({ ...ciroForm, ciro_cari_id: v || '' })}
              searchable
              required
            />
            <StyledDatePicker
              label="Ciro Tarihi"
              value={ciroForm.tarih}
              onChange={(v) => setCiroForm({ ...ciroForm, tarih: v || new Date() })}
            />
            <TextInput
              label="Açıklama"
              placeholder="Ciro açıklaması"
              value={ciroForm.aciklama}
              onChange={(e) => setCiroForm({ ...ciroForm, aciklama: e.currentTarget.value })}
            />
            <Group justify="flex-end" mt="md">
              <Button
                variant="default"
                onClick={() => {
                  closeCiro();
                  setSelectedCekSenet(null);
                }}
              >
                İptal
              </Button>
              <Button color="violet" onClick={handleCiro}>
                Ciro Et
              </Button>
            </Group>
          </Stack>
        </Modal>
      </Container>
    </Box>
  );
}
