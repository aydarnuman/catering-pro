'use client';

import { useState, useEffect } from 'react';
import {
  Container,
  Title,
  Text,
  Paper,
  Group,
  Stack,
  Grid,
  Button,
  Badge,
  Tabs,
  Card,
  ActionIcon,
  TextInput,
  NumberInput,
  Select,
  Textarea,
  Modal,
  Table,
  Menu,
  Loader,
  Alert,
  ThemeIcon,
  Progress,
  Tooltip,
  SimpleGrid,
  Divider,
  Box,
  RingProgress,
  Center
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import {
  IconPlus,
  IconWallet,
  IconBuildingBank,
  IconArrowUpRight,
  IconArrowDownRight,
  IconArrowsExchange,
  IconReceipt,
  IconFileText,
  IconEdit,
  IconTrash,
  IconSearch,
  IconFilter,
  IconRefresh,
  IconAlertCircle,
  IconCheck,
  IconClock,
  IconCalendar,
  IconCash,
  IconCreditCard,
  IconChartBar,
  IconTrendingUp,
  IconTrendingDown,
  IconDotsVertical,
  IconEye,
  IconDownload,
  IconReportMoney,
  IconExclamationCircle,
  IconChecks,
  IconX,
  IconChevronRight
} from '@tabler/icons-react';

const API_URL = 'http://localhost:3001/api';

// Tipler
interface Hesap {
  id: number;
  hesap_tipi: 'kasa' | 'banka';
  hesap_adi: string;
  banka_adi?: string;
  sube?: string;
  hesap_no?: string;
  iban?: string;
  para_birimi: string;
  bakiye: number;
  kredi_limiti?: number;
  aktif: boolean;
}

interface Hareket {
  id: number;
  hesap_id: number;
  hareket_tipi: 'giris' | 'cikis' | 'transfer';
  tutar: number;
  onceki_bakiye: number;
  sonraki_bakiye: number;
  aciklama?: string;
  belge_no?: string;
  tarih: string;
  saat?: string;
  hesap?: { id: number; hesap_adi: string; hesap_tipi: string };
  karsi_hesap?: { id: number; hesap_adi: string };
  cari?: { id: number; unvan: string };
}

interface CekSenet {
  id: number;
  tip: 'cek' | 'senet';
  yonu: 'alinan' | 'verilen';
  durum: string;
  belge_no: string;
  tutar: number;
  doviz: string;
  kesim_tarihi: string;
  vade_tarihi: string;
  banka_adi?: string;
  kesen_unvan: string;
  cari?: { id: number; unvan: string };
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

// Para formatı
const formatMoney = (value: number) => {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 2
  }).format(value);
};

// Tarih formatı
const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('tr-TR');
};

export default function FinansMerkeziPage() {
  // State
  const [activeTab, setActiveTab] = useState<string | null>('ozet');
  const [loading, setLoading] = useState(true);
  const [ozet, setOzet] = useState<Ozet | null>(null);
  const [hesaplar, setHesaplar] = useState<Hesap[]>([]);
  const [hareketler, setHareketler] = useState<Hareket[]>([]);
  const [cekSenetler, setCekSenetler] = useState<CekSenet[]>([]);
  const [cariler, setCariler] = useState<Cari[]>([]);

  // Modal states
  const [hesapModalOpen, setHesapModalOpen] = useState(false);
  const [hareketModalOpen, setHareketModalOpen] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [cekSenetModalOpen, setCekSenetModalOpen] = useState(false);
  const [tahsilModalOpen, setTahsilModalOpen] = useState(false);

  // Form states
  const [selectedHesap, setSelectedHesap] = useState<Hesap | null>(null);
  const [selectedCekSenet, setSelectedCekSenet] = useState<CekSenet | null>(null);
  const [hareketTipi, setHareketTipi] = useState<'giris' | 'cikis'>('giris');

  // Hesap form
  const [hesapForm, setHesapForm] = useState({
    hesap_tipi: 'kasa' as 'kasa' | 'banka',
    hesap_adi: '',
    banka_adi: '',
    sube: '',
    hesap_no: '',
    iban: '',
    para_birimi: 'TRY',
    bakiye: 0,
    kredi_limiti: 0
  });

  // Hareket form
  const [hareketForm, setHareketForm] = useState({
    hesap_id: '',
    tutar: 0,
    aciklama: '',
    belge_no: '',
    tarih: new Date(),
    cari_id: ''
  });

  // Transfer form
  const [transferForm, setTransferForm] = useState({
    kaynak_hesap_id: '',
    hedef_hesap_id: '',
    tutar: 0,
    aciklama: '',
    tarih: new Date()
  });

  // Çek/Senet form
  const [cekSenetForm, setCekSenetForm] = useState({
    tip: 'cek' as 'cek' | 'senet',
    yonu: 'alinan' as 'alinan' | 'verilen',
    belge_no: '',
    tutar: 0,
    kesim_tarihi: new Date(),
    vade_tarihi: new Date(),
    banka_adi: '',
    sube_adi: '',
    hesap_no: '',
    kesen_unvan: '',
    cari_id: ''
  });

  // Filtreler
  const [cekSenetFiltre, setCekSenetFiltre] = useState({
    tip: '',
    yonu: '',
    durum: 'beklemede'
  });

  // Data yükleme
  const loadData = async () => {
    setLoading(true);
    
    // Carileri ayrı yükle - her zaman çalışsın
    try {
      const carilerRes = await fetch(`${API_URL}/cariler`);
      if (carilerRes.ok) {
        const result = await carilerRes.json();
        const carilerData = result.data || result || [];
        console.log('Cariler yüklendi:', carilerData.length, 'adet');
        setCariler(carilerData);
      }
    } catch (err) {
      console.error('Cariler yükleme hatası:', err);
    }
    
    // Diğer verileri yükle
    try {
      const [ozetRes, hesaplarRes, hareketlerRes, cekSenetRes] = await Promise.all([
        fetch(`${API_URL}/kasa-banka/ozet`),
        fetch(`${API_URL}/kasa-banka/hesaplar`),
        fetch(`${API_URL}/kasa-banka/hareketler?limit=50`),
        fetch(`${API_URL}/kasa-banka/cek-senet?limit=100`)
      ]);

      if (ozetRes.ok) setOzet(await ozetRes.json());
      if (hesaplarRes.ok) setHesaplar(await hesaplarRes.json());
      if (hareketlerRes.ok) setHareketler(await hareketlerRes.json());
      if (cekSenetRes.ok) setCekSenetler(await cekSenetRes.json());
    } catch (error) {
      console.error('Veri yükleme hatası:', error);
      notifications.show({
        title: 'Hata',
        message: 'Veriler yüklenirken bir hata oluştu',
        color: 'red'
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Hesap kaydet
  const handleSaveHesap = async () => {
    try {
      const method = selectedHesap ? 'PUT' : 'POST';
      const url = selectedHesap 
        ? `${API_URL}/kasa-banka/hesaplar/${selectedHesap.id}`
        : `${API_URL}/kasa-banka/hesaplar`;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(hesapForm)
      });

      if (res.ok) {
        notifications.show({
          title: 'Başarılı',
          message: `Hesap ${selectedHesap ? 'güncellendi' : 'oluşturuldu'}`,
          color: 'green'
        });
        setHesapModalOpen(false);
        resetHesapForm();
        loadData();
      }
    } catch (error) {
      notifications.show({ title: 'Hata', message: 'İşlem başarısız', color: 'red' });
    }
  };

  // Hareket kaydet
  const handleSaveHareket = async () => {
    try {
      const res = await fetch(`${API_URL}/kasa-banka/hareketler`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...hareketForm,
          hareket_tipi: hareketTipi,
          tarih: hareketForm.tarih.toISOString().split('T')[0],
          cari_id: hareketForm.cari_id || null
        })
      });

      if (res.ok) {
        notifications.show({
          title: 'Başarılı',
          message: hareketTipi === 'giris' ? 'Giriş kaydedildi' : 'Çıkış kaydedildi',
          color: 'green'
        });
        setHareketModalOpen(false);
        resetHareketForm();
        loadData();
      }
    } catch (error) {
      notifications.show({ title: 'Hata', message: 'İşlem başarısız', color: 'red' });
    }
  };

  // Transfer kaydet
  const handleSaveTransfer = async () => {
    try {
      const res = await fetch(`${API_URL}/kasa-banka/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...transferForm,
          tarih: transferForm.tarih.toISOString().split('T')[0]
        })
      });

      if (res.ok) {
        notifications.show({
          title: 'Başarılı',
          message: 'Transfer gerçekleştirildi',
          color: 'green'
        });
        setTransferModalOpen(false);
        resetTransferForm();
        loadData();
      }
    } catch (error) {
      notifications.show({ title: 'Hata', message: 'Transfer başarısız', color: 'red' });
    }
  };

  // Çek/Senet kaydet
  const handleSaveCekSenet = async () => {
    try {
      const res = await fetch(`${API_URL}/kasa-banka/cek-senet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...cekSenetForm,
          kesim_tarihi: cekSenetForm.kesim_tarihi.toISOString().split('T')[0],
          vade_tarihi: cekSenetForm.vade_tarihi.toISOString().split('T')[0],
          cari_id: cekSenetForm.cari_id || null
        })
      });

      if (res.ok) {
        notifications.show({
          title: 'Başarılı',
          message: `${cekSenetForm.tip === 'cek' ? 'Çek' : 'Senet'} kaydedildi`,
          color: 'green'
        });
        setCekSenetModalOpen(false);
        resetCekSenetForm();
        loadData();
      }
    } catch (error) {
      notifications.show({ title: 'Hata', message: 'İşlem başarısız', color: 'red' });
    }
  };

  // Çek/Senet tahsil et
  const handleTahsil = async () => {
    if (!selectedCekSenet) return;
    try {
      const res = await fetch(`${API_URL}/kasa-banka/cek-senet/${selectedCekSenet.id}/tahsil`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hesap_id: hareketForm.hesap_id,
          tarih: new Date().toISOString().split('T')[0]
        })
      });

      if (res.ok) {
        notifications.show({
          title: 'Başarılı',
          message: selectedCekSenet.yonu === 'alinan' ? 'Tahsilat yapıldı' : 'Ödeme yapıldı',
          color: 'green'
        });
        setTahsilModalOpen(false);
        setSelectedCekSenet(null);
        loadData();
      }
    } catch (error) {
      notifications.show({ title: 'Hata', message: 'İşlem başarısız', color: 'red' });
    }
  };

  // Reset functions
  const resetHesapForm = () => {
    setHesapForm({
      hesap_tipi: 'kasa',
      hesap_adi: '',
      banka_adi: '',
      sube: '',
      hesap_no: '',
      iban: '',
      para_birimi: 'TRY',
      bakiye: 0,
      kredi_limiti: 0
    });
    setSelectedHesap(null);
  };

  const resetHareketForm = () => {
    setHareketForm({
      hesap_id: '',
      tutar: 0,
      aciklama: '',
      belge_no: '',
      tarih: new Date(),
      cari_id: ''
    });
  };

  const resetTransferForm = () => {
    setTransferForm({
      kaynak_hesap_id: '',
      hedef_hesap_id: '',
      tutar: 0,
      aciklama: '',
      tarih: new Date()
    });
  };

  const resetCekSenetForm = () => {
    setCekSenetForm({
      tip: 'cek',
      yonu: 'alinan',
      belge_no: '',
      tutar: 0,
      kesim_tarihi: new Date(),
      vade_tarihi: new Date(),
      banka_adi: '',
      sube_adi: '',
      hesap_no: '',
      kesen_unvan: '',
      cari_id: ''
    });
  };

  // Hesap düzenleme
  const handleEditHesap = (hesap: Hesap) => {
    setSelectedHesap(hesap);
    setHesapForm({
      hesap_tipi: hesap.hesap_tipi,
      hesap_adi: hesap.hesap_adi,
      banka_adi: hesap.banka_adi || '',
      sube: hesap.sube || '',
      hesap_no: hesap.hesap_no || '',
      iban: hesap.iban || '',
      para_birimi: hesap.para_birimi,
      bakiye: hesap.bakiye,
      kredi_limiti: hesap.kredi_limiti || 0
    });
    setHesapModalOpen(true);
  };

  // Filtrelenmiş çek/senetler
  const filteredCekSenetler = cekSenetler.filter(cs => {
    if (cekSenetFiltre.tip && cs.tip !== cekSenetFiltre.tip) return false;
    if (cekSenetFiltre.yonu && cs.yonu !== cekSenetFiltre.yonu) return false;
    if (cekSenetFiltre.durum && cs.durum !== cekSenetFiltre.durum) return false;
    return true;
  });

  // Kasa ve banka hesaplarını ayır
  const kasalar = hesaplar.filter(h => h.hesap_tipi === 'kasa' && h.aktif);
  const bankalar = hesaplar.filter(h => h.hesap_tipi === 'banka' && h.aktif);

  if (loading) {
    return (
      <Container size="xl" py="xl">
        <Center h={400}>
          <Stack align="center" gap="md">
            <Loader size="lg" />
            <Text c="dimmed">Veriler yükleniyor...</Text>
          </Stack>
        </Center>
      </Container>
    );
  }

  return (
    <Container size="xl" py="xl">
      {/* Header */}
      <Group justify="space-between" mb="xl">
        <div>
          <Title order={1} mb={4}>💰 Finans Merkezi</Title>
          <Text c="dimmed">Kasa, Banka, Hareketler ve Çek/Senet Yönetimi</Text>
        </div>
        <Group>
          <Button
            leftSection={<IconRefresh size={18} />}
            variant="light"
            onClick={loadData}
          >
            Yenile
          </Button>
        </Group>
      </Group>

      {/* Özet Kartları (Her zaman görünür) */}
      <SimpleGrid cols={{ base: 2, sm: 3, md: 5 }} mb="xl">
        <Paper p="md" radius="md" withBorder>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Toplam Nakit</Text>
              <Text size="xl" fw={700} c="blue">{formatMoney(ozet?.genel_toplam || 0)}</Text>
            </div>
            <ThemeIcon size={48} radius="md" variant="light" color="blue">
              <IconWallet size={26} />
            </ThemeIcon>
          </Group>
        </Paper>

        <Paper p="md" radius="md" withBorder>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Kasalar</Text>
              <Text size="xl" fw={700} c="green">{formatMoney(ozet?.kasa_toplam || 0)}</Text>
            </div>
            <ThemeIcon size={48} radius="md" variant="light" color="green">
              <IconCash size={26} />
            </ThemeIcon>
          </Group>
        </Paper>

        <Paper p="md" radius="md" withBorder>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Bankalar</Text>
              <Text size="xl" fw={700} c="cyan">{formatMoney(ozet?.banka_toplam || 0)}</Text>
            </div>
            <ThemeIcon size={48} radius="md" variant="light" color="cyan">
              <IconBuildingBank size={26} />
            </ThemeIcon>
          </Group>
        </Paper>

        <Paper p="md" radius="md" withBorder>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Alacak (Çek/Senet)</Text>
              <Text size="xl" fw={700} c="teal">
                {formatMoney((ozet?.alinan_cek_toplam || 0) + (ozet?.alinan_senet_toplam || 0))}
              </Text>
            </div>
            <ThemeIcon size={48} radius="md" variant="light" color="teal">
              <IconArrowUpRight size={26} />
            </ThemeIcon>
          </Group>
        </Paper>

        <Paper p="md" radius="md" withBorder>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Borç (Çek/Senet)</Text>
              <Text size="xl" fw={700} c="red">
                {formatMoney((ozet?.verilen_cek_toplam || 0) + (ozet?.verilen_senet_toplam || 0))}
              </Text>
            </div>
            <ThemeIcon size={48} radius="md" variant="light" color="red">
              <IconArrowDownRight size={26} />
            </ThemeIcon>
          </Group>
        </Paper>
      </SimpleGrid>

      {/* Tabs */}
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List mb="lg">
          <Tabs.Tab value="ozet" leftSection={<IconChartBar size={16} />}>
            Özet
          </Tabs.Tab>
          <Tabs.Tab value="hesaplar" leftSection={<IconBuildingBank size={16} />}>
            Hesaplar
          </Tabs.Tab>
          <Tabs.Tab value="hareketler" leftSection={<IconArrowsExchange size={16} />}>
            Hareketler
          </Tabs.Tab>
          <Tabs.Tab value="cek-senet" leftSection={<IconReceipt size={16} />}>
            Çek/Senet
          </Tabs.Tab>
        </Tabs.List>

        {/* ÖZET TAB */}
        <Tabs.Panel value="ozet">
          <Grid>
            {/* Sol Kolon - Dikkat Gerektiren */}
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Paper p="lg" radius="md" withBorder>
                <Title order={4} mb="md">⚠️ Dikkat Gerektiren</Title>
                
                {(ozet?.vadesi_gecmis_adet || 0) > 0 && (
                  <Alert color="red" mb="sm" icon={<IconExclamationCircle />}>
                    <Group justify="space-between">
                      <div>
                        <Text fw={500}>Vadesi Geçmiş Çek/Senet</Text>
                        <Text size="sm" c="dimmed">
                          {ozet?.vadesi_gecmis_adet} adet - {formatMoney(ozet?.vadesi_gecmis_toplam || 0)}
                        </Text>
                      </div>
                      <Button size="xs" variant="light" color="red" onClick={() => setActiveTab('cek-senet')}>
                        Detay
                      </Button>
                    </Group>
                  </Alert>
                )}

                {(ozet?.bu_hafta_vadeli_adet || 0) > 0 && (
                  <Alert color="yellow" mb="sm" icon={<IconClock />}>
                    <Group justify="space-between">
                      <div>
                        <Text fw={500}>Bu Hafta Vadesi Dolan</Text>
                        <Text size="sm" c="dimmed">
                          {ozet?.bu_hafta_vadeli_adet} adet - {formatMoney(ozet?.bu_hafta_vadeli_toplam || 0)}
                        </Text>
                      </div>
                      <Button size="xs" variant="light" color="yellow" onClick={() => setActiveTab('cek-senet')}>
                        Detay
                      </Button>
                    </Group>
                  </Alert>
                )}

                {(ozet?.vadesi_gecmis_adet || 0) === 0 && (ozet?.bu_hafta_vadeli_adet || 0) === 0 && (
                  <Alert color="green" icon={<IconCheck />}>
                    Tüm çek ve senetler güncel! Vadesi geçmiş veya yaklaşan ödeme yok.
                  </Alert>
                )}
              </Paper>

              {/* Çek/Senet Özeti */}
              <Paper p="lg" radius="md" withBorder mt="md">
                <Title order={4} mb="md">📝 Çek/Senet Durumu</Title>
                <SimpleGrid cols={2}>
                  <Card withBorder p="sm">
                    <Text size="xs" c="dimmed">Alınan Çekler</Text>
                    <Text fw={700} size="lg" c="teal">{formatMoney(ozet?.alinan_cek_toplam || 0)}</Text>
                    <Text size="xs" c="dimmed">{ozet?.alinan_cek_adet || 0} adet beklemede</Text>
                  </Card>
                  <Card withBorder p="sm">
                    <Text size="xs" c="dimmed">Verilen Çekler</Text>
                    <Text fw={700} size="lg" c="red">{formatMoney(ozet?.verilen_cek_toplam || 0)}</Text>
                    <Text size="xs" c="dimmed">{ozet?.verilen_cek_adet || 0} adet beklemede</Text>
                  </Card>
                  <Card withBorder p="sm">
                    <Text size="xs" c="dimmed">Alınan Senetler</Text>
                    <Text fw={700} size="lg" c="teal">{formatMoney(ozet?.alinan_senet_toplam || 0)}</Text>
                    <Text size="xs" c="dimmed">{ozet?.alinan_senet_adet || 0} adet beklemede</Text>
                  </Card>
                  <Card withBorder p="sm">
                    <Text size="xs" c="dimmed">Verilen Senetler</Text>
                    <Text fw={700} size="lg" c="red">{formatMoney(ozet?.verilen_senet_toplam || 0)}</Text>
                    <Text size="xs" c="dimmed">{ozet?.verilen_senet_adet || 0} adet beklemede</Text>
                  </Card>
                </SimpleGrid>
              </Paper>
            </Grid.Col>

            {/* Sağ Kolon - Son İşlemler */}
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Paper p="lg" radius="md" withBorder>
                <Group justify="space-between" mb="md">
                  <Title order={4}>📋 Son İşlemler</Title>
                  <Button size="xs" variant="light" onClick={() => setActiveTab('hareketler')}>
                    Tümünü Gör
                  </Button>
                </Group>

                <Stack gap="xs">
                  {hareketler.slice(0, 8).map((hareket) => (
                    <Paper key={hareket.id} p="sm" withBorder radius="sm">
                      <Group justify="space-between">
                        <Group gap="sm">
                          <ThemeIcon
                            size="sm"
                            radius="xl"
                            color={
                              hareket.hareket_tipi === 'giris' ? 'green' :
                              hareket.hareket_tipi === 'cikis' ? 'red' : 'blue'
                            }
                            variant="light"
                          >
                            {hareket.hareket_tipi === 'giris' ? <IconArrowUpRight size={14} /> :
                             hareket.hareket_tipi === 'cikis' ? <IconArrowDownRight size={14} /> :
                             <IconArrowsExchange size={14} />}
                          </ThemeIcon>
                          <div>
                            <Text size="sm" fw={500} lineClamp={1}>
                              {hareket.aciklama || (
                                hareket.hareket_tipi === 'transfer' 
                                  ? `Transfer → ${hareket.karsi_hesap?.hesap_adi}`
                                  : hareket.hareket_tipi === 'giris' ? 'Giriş' : 'Çıkış'
                              )}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {hareket.hesap?.hesap_adi} • {formatDate(hareket.tarih)}
                            </Text>
                          </div>
                        </Group>
                        <Text 
                          fw={600} 
                          c={hareket.hareket_tipi === 'giris' ? 'green' : hareket.hareket_tipi === 'cikis' ? 'red' : 'blue'}
                        >
                          {hareket.hareket_tipi === 'giris' ? '+' : hareket.hareket_tipi === 'cikis' ? '-' : ''}
                          {formatMoney(hareket.tutar)}
                        </Text>
                      </Group>
                    </Paper>
                  ))}
                  {hareketler.length === 0 && (
                    <Text c="dimmed" ta="center" py="xl">Henüz hareket yok</Text>
                  )}
                </Stack>
              </Paper>
            </Grid.Col>
          </Grid>
        </Tabs.Panel>

        {/* HESAPLAR TAB */}
        <Tabs.Panel value="hesaplar">
          <Group justify="space-between" mb="md">
            <div />
            <Group>
              <Button
                leftSection={<IconArrowsExchange size={18} />}
                variant="light"
                onClick={() => setTransferModalOpen(true)}
              >
                Transfer
              </Button>
              <Button
                leftSection={<IconPlus size={18} />}
                onClick={() => {
                  resetHesapForm();
                  setHesapModalOpen(true);
                }}
              >
                Yeni Hesap
              </Button>
            </Group>
          </Group>

          {/* Kasalar */}
          <Title order={4} mb="md">💵 Kasalar</Title>
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} mb="xl">
            {kasalar.map((kasa) => (
              <Card key={kasa.id} withBorder shadow="sm" radius="md">
                <Group justify="space-between" mb="sm">
                  <Group gap="sm">
                    <ThemeIcon size="lg" variant="light" color="green">
                      <IconCash size={20} />
                    </ThemeIcon>
                    <Text fw={600}>{kasa.hesap_adi}</Text>
                  </Group>
                  <Menu shadow="md" width={160}>
                    <Menu.Target>
                      <ActionIcon variant="subtle" color="gray">
                        <IconDotsVertical size={18} />
                      </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Item 
                        leftSection={<IconArrowUpRight size={16} />}
                        onClick={() => {
                          setHareketForm({ ...hareketForm, hesap_id: String(kasa.id) });
                          setHareketTipi('giris');
                          setHareketModalOpen(true);
                        }}
                      >
                        Giriş
                      </Menu.Item>
                      <Menu.Item 
                        leftSection={<IconArrowDownRight size={16} />}
                        onClick={() => {
                          setHareketForm({ ...hareketForm, hesap_id: String(kasa.id) });
                          setHareketTipi('cikis');
                          setHareketModalOpen(true);
                        }}
                      >
                        Çıkış
                      </Menu.Item>
                      <Menu.Divider />
                      <Menu.Item 
                        leftSection={<IconEdit size={16} />}
                        onClick={() => handleEditHesap(kasa)}
                      >
                        Düzenle
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                </Group>
                <Text size="2rem" fw={700} c={kasa.bakiye >= 0 ? 'green' : 'red'}>
                  {formatMoney(kasa.bakiye)}
                </Text>
              </Card>
            ))}
            {kasalar.length === 0 && (
              <Paper p="xl" withBorder>
                <Text c="dimmed" ta="center">Henüz kasa eklenmemiş</Text>
              </Paper>
            )}
          </SimpleGrid>

          {/* Bankalar */}
          <Title order={4} mb="md">🏦 Banka Hesapları</Title>
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
            {bankalar.map((banka) => (
              <Card key={banka.id} withBorder shadow="sm" radius="md">
                <Group justify="space-between" mb="sm">
                  <Group gap="sm">
                    <ThemeIcon size="lg" variant="light" color="cyan">
                      <IconBuildingBank size={20} />
                    </ThemeIcon>
                    <div>
                      <Text fw={600}>{banka.hesap_adi}</Text>
                      {banka.banka_adi && (
                        <Text size="xs" c="dimmed">{banka.banka_adi}</Text>
                      )}
                    </div>
                  </Group>
                  <Menu shadow="md" width={160}>
                    <Menu.Target>
                      <ActionIcon variant="subtle" color="gray">
                        <IconDotsVertical size={18} />
                      </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Item 
                        leftSection={<IconArrowUpRight size={16} />}
                        onClick={() => {
                          setHareketForm({ ...hareketForm, hesap_id: String(banka.id) });
                          setHareketTipi('giris');
                          setHareketModalOpen(true);
                        }}
                      >
                        Giriş
                      </Menu.Item>
                      <Menu.Item 
                        leftSection={<IconArrowDownRight size={16} />}
                        onClick={() => {
                          setHareketForm({ ...hareketForm, hesap_id: String(banka.id) });
                          setHareketTipi('cikis');
                          setHareketModalOpen(true);
                        }}
                      >
                        Çıkış
                      </Menu.Item>
                      <Menu.Divider />
                      <Menu.Item 
                        leftSection={<IconEdit size={16} />}
                        onClick={() => handleEditHesap(banka)}
                      >
                        Düzenle
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                </Group>
                <Text size="2rem" fw={700} c={banka.bakiye >= 0 ? 'cyan' : 'red'}>
                  {formatMoney(banka.bakiye)}
                </Text>
                {banka.iban && (
                  <Text size="xs" c="dimmed" mt="xs">{banka.iban}</Text>
                )}
              </Card>
            ))}
            {bankalar.length === 0 && (
              <Paper p="xl" withBorder>
                <Text c="dimmed" ta="center">Henüz banka hesabı eklenmemiş</Text>
              </Paper>
            )}
          </SimpleGrid>
        </Tabs.Panel>

        {/* HAREKETLER TAB */}
        <Tabs.Panel value="hareketler">
          <Group justify="space-between" mb="md">
            <div />
            <Group>
              <Button
                leftSection={<IconArrowUpRight size={18} />}
                color="green"
                variant="light"
                onClick={() => {
                  setHareketTipi('giris');
                  resetHareketForm();
                  setHareketModalOpen(true);
                }}
              >
                Giriş
              </Button>
              <Button
                leftSection={<IconArrowDownRight size={18} />}
                color="red"
                variant="light"
                onClick={() => {
                  setHareketTipi('cikis');
                  resetHareketForm();
                  setHareketModalOpen(true);
                }}
              >
                Çıkış
              </Button>
              <Button
                leftSection={<IconArrowsExchange size={18} />}
                onClick={() => setTransferModalOpen(true)}
              >
                Transfer
              </Button>
            </Group>
          </Group>

          <Paper withBorder radius="md">
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Tarih</Table.Th>
                  <Table.Th>Tip</Table.Th>
                  <Table.Th>Hesap</Table.Th>
                  <Table.Th>Açıklama</Table.Th>
                  <Table.Th ta="right">Tutar</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {hareketler.map((hareket) => (
                  <Table.Tr key={hareket.id}>
                    <Table.Td>
                      <Text size="sm">{formatDate(hareket.tarih)}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        color={
                          hareket.hareket_tipi === 'giris' ? 'green' :
                          hareket.hareket_tipi === 'cikis' ? 'red' : 'blue'
                        }
                        variant="light"
                        leftSection={
                          hareket.hareket_tipi === 'giris' ? <IconArrowUpRight size={12} /> :
                          hareket.hareket_tipi === 'cikis' ? <IconArrowDownRight size={12} /> :
                          <IconArrowsExchange size={12} />
                        }
                      >
                        {hareket.hareket_tipi === 'giris' ? 'Giriş' :
                         hareket.hareket_tipi === 'cikis' ? 'Çıkış' : 'Transfer'}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{hareket.hesap?.hesap_adi || '-'}</Text>
                      {hareket.karsi_hesap && (
                        <Text size="xs" c="dimmed">→ {hareket.karsi_hesap.hesap_adi}</Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" lineClamp={1}>{hareket.aciklama || '-'}</Text>
                      {hareket.cari && (
                        <Text size="xs" c="dimmed">{hareket.cari.unvan}</Text>
                      )}
                    </Table.Td>
                    <Table.Td ta="right">
                      <Text
                        fw={600}
                        c={hareket.hareket_tipi === 'giris' ? 'green' : hareket.hareket_tipi === 'cikis' ? 'red' : 'blue'}
                      >
                        {hareket.hareket_tipi === 'giris' ? '+' : hareket.hareket_tipi === 'cikis' ? '-' : ''}
                        {formatMoney(hareket.tutar)}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
            {hareketler.length === 0 && (
              <Text c="dimmed" ta="center" py="xl">Henüz hareket yok</Text>
            )}
          </Paper>
        </Tabs.Panel>

        {/* ÇEK/SENET TAB */}
        <Tabs.Panel value="cek-senet">
          <Group justify="space-between" mb="md">
            <Group>
              <Select
                placeholder="Tip"
                data={[
                  { value: '', label: 'Tümü' },
                  { value: 'cek', label: 'Çek' },
                  { value: 'senet', label: 'Senet' }
                ]}
                value={cekSenetFiltre.tip}
                onChange={(v) => setCekSenetFiltre({ ...cekSenetFiltre, tip: v || '' })}
                w={120}
              />
              <Select
                placeholder="Yönü"
                data={[
                  { value: '', label: 'Tümü' },
                  { value: 'alinan', label: 'Alınan' },
                  { value: 'verilen', label: 'Verilen' }
                ]}
                value={cekSenetFiltre.yonu}
                onChange={(v) => setCekSenetFiltre({ ...cekSenetFiltre, yonu: v || '' })}
                w={120}
              />
              <Select
                placeholder="Durum"
                data={[
                  { value: '', label: 'Tümü' },
                  { value: 'beklemede', label: 'Beklemede' },
                  { value: 'tahsil_edildi', label: 'Tahsil Edildi' },
                  { value: 'odendi', label: 'Ödendi' },
                  { value: 'ciro_edildi', label: 'Ciro Edildi' },
                  { value: 'iade_edildi', label: 'İade Edildi' }
                ]}
                value={cekSenetFiltre.durum}
                onChange={(v) => setCekSenetFiltre({ ...cekSenetFiltre, durum: v || '' })}
                w={140}
              />
            </Group>
            <Group>
              <Button
                leftSection={<IconPlus size={18} />}
                onClick={() => {
                  resetCekSenetForm();
                  setCekSenetModalOpen(true);
                }}
              >
                Yeni Çek/Senet
              </Button>
            </Group>
          </Group>

          <Paper withBorder radius="md">
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Belge No</Table.Th>
                  <Table.Th>Tip</Table.Th>
                  <Table.Th>Yönü</Table.Th>
                  <Table.Th>Kişi/Firma</Table.Th>
                  <Table.Th>Vade Tarihi</Table.Th>
                  <Table.Th ta="right">Tutar</Table.Th>
                  <Table.Th>Durum</Table.Th>
                  <Table.Th ta="center">İşlem</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filteredCekSenetler.map((cs) => {
                  const vadeGecmis = new Date(cs.vade_tarihi) < new Date();
                  const vadeBuHafta = new Date(cs.vade_tarihi) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
                  
                  return (
                    <Table.Tr key={cs.id}>
                      <Table.Td>
                        <Text size="sm" fw={500}>{cs.belge_no}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge color={cs.tip === 'cek' ? 'blue' : 'violet'} variant="light">
                          {cs.tip === 'cek' ? 'Çek' : 'Senet'}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Badge color={cs.yonu === 'alinan' ? 'teal' : 'orange'} variant="light">
                          {cs.yonu === 'alinan' ? 'Alınan' : 'Verilen'}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{cs.cari?.unvan || cs.kesen_unvan}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs">
                          <Text size="sm" c={vadeGecmis && cs.durum === 'beklemede' ? 'red' : undefined}>
                            {formatDate(cs.vade_tarihi)}
                          </Text>
                          {cs.durum === 'beklemede' && vadeGecmis && (
                            <Badge color="red" size="xs">Gecikmiş</Badge>
                          )}
                          {cs.durum === 'beklemede' && !vadeGecmis && vadeBuHafta && (
                            <Badge color="yellow" size="xs">Bu hafta</Badge>
                          )}
                        </Group>
                      </Table.Td>
                      <Table.Td ta="right">
                        <Text fw={600} c={cs.yonu === 'alinan' ? 'teal' : 'orange'}>
                          {formatMoney(cs.tutar)}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          color={
                            cs.durum === 'beklemede' ? 'gray' :
                            cs.durum === 'tahsil_edildi' || cs.durum === 'odendi' ? 'green' :
                            cs.durum === 'ciro_edildi' ? 'blue' : 'red'
                          }
                          variant="light"
                        >
                          {cs.durum === 'beklemede' ? 'Beklemede' :
                           cs.durum === 'tahsil_edildi' ? 'Tahsil Edildi' :
                           cs.durum === 'odendi' ? 'Ödendi' :
                           cs.durum === 'ciro_edildi' ? 'Ciro Edildi' : 'İade'}
                        </Badge>
                      </Table.Td>
                      <Table.Td ta="center">
                        {cs.durum === 'beklemede' && (
                          <Button
                            size="xs"
                            variant="light"
                            color={cs.yonu === 'alinan' ? 'green' : 'orange'}
                            onClick={() => {
                              setSelectedCekSenet(cs);
                              setTahsilModalOpen(true);
                            }}
                          >
                            {cs.yonu === 'alinan' ? 'Tahsil Et' : 'Öde'}
                          </Button>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
            {filteredCekSenetler.length === 0 && (
              <Text c="dimmed" ta="center" py="xl">Kayıt bulunamadı</Text>
            )}
          </Paper>
        </Tabs.Panel>
      </Tabs>

      {/* MODALS */}

      {/* Hesap Modal */}
      <Modal
        opened={hesapModalOpen}
        onClose={() => { setHesapModalOpen(false); resetHesapForm(); }}
        title={selectedHesap ? 'Hesap Düzenle' : 'Yeni Hesap Ekle'}
        size="md"
      >
        <Stack>
          <Select
            label="Hesap Tipi"
            required
            data={[
              { value: 'kasa', label: '💵 Kasa' },
              { value: 'banka', label: '🏦 Banka' }
            ]}
            value={hesapForm.hesap_tipi}
            onChange={(v) => setHesapForm({ ...hesapForm, hesap_tipi: v as 'kasa' | 'banka' })}
          />
          <TextInput
            label="Hesap Adı"
            required
            placeholder="Örn: Ana Kasa, Ziraat İşletme"
            value={hesapForm.hesap_adi}
            onChange={(e) => setHesapForm({ ...hesapForm, hesap_adi: e.target.value })}
          />
          {hesapForm.hesap_tipi === 'banka' && (
            <>
              <TextInput
                label="Banka Adı"
                placeholder="Örn: Ziraat Bankası"
                value={hesapForm.banka_adi}
                onChange={(e) => setHesapForm({ ...hesapForm, banka_adi: e.target.value })}
              />
              <Grid>
                <Grid.Col span={6}>
                  <TextInput
                    label="Şube"
                    placeholder="Şube adı"
                    value={hesapForm.sube}
                    onChange={(e) => setHesapForm({ ...hesapForm, sube: e.target.value })}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <TextInput
                    label="Hesap No"
                    placeholder="Hesap numarası"
                    value={hesapForm.hesap_no}
                    onChange={(e) => setHesapForm({ ...hesapForm, hesap_no: e.target.value })}
                  />
                </Grid.Col>
              </Grid>
              <TextInput
                label="IBAN"
                placeholder="TR00 0000 0000 0000 0000 0000 00"
                value={hesapForm.iban}
                onChange={(e) => setHesapForm({ ...hesapForm, iban: e.target.value })}
              />
            </>
          )}
          <NumberInput
            label="Açılış Bakiyesi"
            placeholder="0"
            value={hesapForm.bakiye}
            onChange={(v) => setHesapForm({ ...hesapForm, bakiye: Number(v) || 0 })}
            thousandSeparator="."
            decimalSeparator=","
            prefix="₺ "
          />
          <Group justify="flex-end" mt="md">
            <Button variant="light" onClick={() => { setHesapModalOpen(false); resetHesapForm(); }}>
              İptal
            </Button>
            <Button onClick={handleSaveHesap}>
              {selectedHesap ? 'Güncelle' : 'Kaydet'}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Hareket Modal */}
      <Modal
        opened={hareketModalOpen}
        onClose={() => { setHareketModalOpen(false); resetHareketForm(); }}
        title={hareketTipi === 'giris' ? '↗️ Yeni Giriş' : '↘️ Yeni Çıkış'}
        size="md"
      >
        <Stack>
          <Select
            label="Hesap"
            required
            placeholder="Hesap seçin"
            data={hesaplar.filter(h => h.aktif).map(h => ({
              value: String(h.id),
              label: `${h.hesap_tipi === 'kasa' ? '💵' : '🏦'} ${h.hesap_adi} (${formatMoney(h.bakiye)})`
            }))}
            value={hareketForm.hesap_id}
            onChange={(v) => setHareketForm({ ...hareketForm, hesap_id: v || '' })}
          />
          <NumberInput
            label="Tutar"
            required
            placeholder="0"
            value={hareketForm.tutar}
            onChange={(v) => setHareketForm({ ...hareketForm, tutar: Number(v) || 0 })}
            thousandSeparator="."
            decimalSeparator=","
            prefix="₺ "
            min={0}
          />
          <Select
            label="Cari (Opsiyonel)"
            placeholder="Cari seçin"
            clearable
            searchable
            data={cariler.map(c => ({
              value: String(c.id),
              label: c.unvan
            }))}
            value={hareketForm.cari_id}
            onChange={(v) => setHareketForm({ ...hareketForm, cari_id: v || '' })}
          />
          <Textarea
            label="Açıklama"
            placeholder="İşlem açıklaması"
            value={hareketForm.aciklama}
            onChange={(e) => setHareketForm({ ...hareketForm, aciklama: e.target.value })}
          />
          <Grid>
            <Grid.Col span={6}>
              <TextInput
                label="Belge No"
                placeholder="Fiş/Makbuz no"
                value={hareketForm.belge_no}
                onChange={(e) => setHareketForm({ ...hareketForm, belge_no: e.target.value })}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <DateInput
                label="Tarih"
                value={hareketForm.tarih}
                onChange={(v) => setHareketForm({ ...hareketForm, tarih: v || new Date() })}
                locale="tr"
              />
            </Grid.Col>
          </Grid>
          <Group justify="flex-end" mt="md">
            <Button variant="light" onClick={() => { setHareketModalOpen(false); resetHareketForm(); }}>
              İptal
            </Button>
            <Button 
              color={hareketTipi === 'giris' ? 'green' : 'red'}
              onClick={handleSaveHareket}
            >
              {hareketTipi === 'giris' ? 'Girişi Kaydet' : 'Çıkışı Kaydet'}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Transfer Modal */}
      <Modal
        opened={transferModalOpen}
        onClose={() => { setTransferModalOpen(false); resetTransferForm(); }}
        title="🔄 Hesaplar Arası Transfer"
        size="md"
      >
        <Stack>
          <Select
            label="Kaynak Hesap"
            required
            placeholder="Nereden?"
            data={hesaplar.filter(h => h.aktif).map(h => ({
              value: String(h.id),
              label: `${h.hesap_tipi === 'kasa' ? '💵' : '🏦'} ${h.hesap_adi} (${formatMoney(h.bakiye)})`
            }))}
            value={transferForm.kaynak_hesap_id}
            onChange={(v) => setTransferForm({ ...transferForm, kaynak_hesap_id: v || '' })}
          />
          <Select
            label="Hedef Hesap"
            required
            placeholder="Nereye?"
            data={hesaplar.filter(h => h.aktif && String(h.id) !== transferForm.kaynak_hesap_id).map(h => ({
              value: String(h.id),
              label: `${h.hesap_tipi === 'kasa' ? '💵' : '🏦'} ${h.hesap_adi} (${formatMoney(h.bakiye)})`
            }))}
            value={transferForm.hedef_hesap_id}
            onChange={(v) => setTransferForm({ ...transferForm, hedef_hesap_id: v || '' })}
          />
          <NumberInput
            label="Tutar"
            required
            placeholder="0"
            value={transferForm.tutar}
            onChange={(v) => setTransferForm({ ...transferForm, tutar: Number(v) || 0 })}
            thousandSeparator="."
            decimalSeparator=","
            prefix="₺ "
            min={0}
          />
          <Textarea
            label="Açıklama"
            placeholder="Transfer açıklaması"
            value={transferForm.aciklama}
            onChange={(e) => setTransferForm({ ...transferForm, aciklama: e.target.value })}
          />
          <DateInput
            label="Tarih"
            value={transferForm.tarih}
            onChange={(v) => setTransferForm({ ...transferForm, tarih: v || new Date() })}
            locale="tr"
          />
          <Group justify="flex-end" mt="md">
            <Button variant="light" onClick={() => { setTransferModalOpen(false); resetTransferForm(); }}>
              İptal
            </Button>
            <Button onClick={handleSaveTransfer}>
              Transfer Yap
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Çek/Senet Modal */}
      <Modal
        opened={cekSenetModalOpen}
        onClose={() => { setCekSenetModalOpen(false); resetCekSenetForm(); }}
        title="📝 Yeni Çek/Senet Ekle"
        size="lg"
      >
        <Stack>
          <Grid>
            <Grid.Col span={6}>
              <Select
                label="Tip"
                required
                data={[
                  { value: 'cek', label: '📄 Çek' },
                  { value: 'senet', label: '📜 Senet' }
                ]}
                value={cekSenetForm.tip}
                onChange={(v) => setCekSenetForm({ ...cekSenetForm, tip: v as 'cek' | 'senet' })}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <Select
                label="Yönü"
                required
                data={[
                  { value: 'alinan', label: '↗️ Alınan' },
                  { value: 'verilen', label: '↘️ Verilen' }
                ]}
                value={cekSenetForm.yonu}
                onChange={(v) => setCekSenetForm({ ...cekSenetForm, yonu: v as 'alinan' | 'verilen' })}
              />
            </Grid.Col>
          </Grid>
          <Grid>
            <Grid.Col span={6}>
              <TextInput
                label="Belge No"
                required
                placeholder="Çek/Senet numarası"
                value={cekSenetForm.belge_no}
                onChange={(e) => setCekSenetForm({ ...cekSenetForm, belge_no: e.target.value })}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <NumberInput
                label="Tutar"
                required
                placeholder="0"
                value={cekSenetForm.tutar}
                onChange={(v) => setCekSenetForm({ ...cekSenetForm, tutar: Number(v) || 0 })}
                thousandSeparator="."
                decimalSeparator=","
                prefix="₺ "
                min={0}
              />
            </Grid.Col>
          </Grid>
          <TextInput
            label="Kesen/Düzenleyen"
            required
            placeholder="Kişi veya firma adı"
            value={cekSenetForm.kesen_unvan}
            onChange={(e) => setCekSenetForm({ ...cekSenetForm, kesen_unvan: e.target.value })}
          />
          <Select
            label="Cari (Opsiyonel)"
            placeholder="Cari seçin"
            clearable
            searchable
            data={cariler.map(c => ({
              value: String(c.id),
              label: c.unvan
            }))}
            value={cekSenetForm.cari_id}
            onChange={(v) => setCekSenetForm({ ...cekSenetForm, cari_id: v || '' })}
          />
          <Grid>
            <Grid.Col span={6}>
              <DateInput
                label="Kesim Tarihi"
                required
                value={cekSenetForm.kesim_tarihi}
                onChange={(v) => setCekSenetForm({ ...cekSenetForm, kesim_tarihi: v || new Date() })}
                locale="tr"
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <DateInput
                label="Vade Tarihi"
                required
                value={cekSenetForm.vade_tarihi}
                onChange={(v) => setCekSenetForm({ ...cekSenetForm, vade_tarihi: v || new Date() })}
                locale="tr"
              />
            </Grid.Col>
          </Grid>
          {cekSenetForm.tip === 'cek' && (
            <Grid>
              <Grid.Col span={6}>
                <TextInput
                  label="Banka Adı"
                  placeholder="Çekin bankası"
                  value={cekSenetForm.banka_adi}
                  onChange={(e) => setCekSenetForm({ ...cekSenetForm, banka_adi: e.target.value })}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <TextInput
                  label="Hesap No"
                  placeholder="Banka hesap no"
                  value={cekSenetForm.hesap_no}
                  onChange={(e) => setCekSenetForm({ ...cekSenetForm, hesap_no: e.target.value })}
                />
              </Grid.Col>
            </Grid>
          )}
          <Group justify="flex-end" mt="md">
            <Button variant="light" onClick={() => { setCekSenetModalOpen(false); resetCekSenetForm(); }}>
              İptal
            </Button>
            <Button onClick={handleSaveCekSenet}>
              Kaydet
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Tahsil/Ödeme Modal */}
      <Modal
        opened={tahsilModalOpen}
        onClose={() => { setTahsilModalOpen(false); setSelectedCekSenet(null); }}
        title={selectedCekSenet?.yonu === 'alinan' ? '✅ Çek/Senet Tahsilatı' : '✅ Çek/Senet Ödemesi'}
        size="sm"
      >
        <Stack>
          {selectedCekSenet && (
            <Paper p="md" withBorder bg="gray.0">
              <Group justify="space-between">
                <div>
                  <Text size="sm" c="dimmed">Belge No</Text>
                  <Text fw={500}>{selectedCekSenet.belge_no}</Text>
                </div>
                <div>
                  <Text size="sm" c="dimmed">Tutar</Text>
                  <Text fw={700} size="lg" c={selectedCekSenet.yonu === 'alinan' ? 'teal' : 'orange'}>
                    {formatMoney(selectedCekSenet.tutar)}
                  </Text>
                </div>
              </Group>
            </Paper>
          )}
          <Select
            label={selectedCekSenet?.yonu === 'alinan' ? 'Tahsilat Hesabı' : 'Ödeme Hesabı'}
            required
            placeholder="Hesap seçin"
            data={hesaplar.filter(h => h.aktif).map(h => ({
              value: String(h.id),
              label: `${h.hesap_tipi === 'kasa' ? '💵' : '🏦'} ${h.hesap_adi}`
            }))}
            value={hareketForm.hesap_id}
            onChange={(v) => setHareketForm({ ...hareketForm, hesap_id: v || '' })}
          />
          <Group justify="flex-end" mt="md">
            <Button variant="light" onClick={() => { setTahsilModalOpen(false); setSelectedCekSenet(null); }}>
              İptal
            </Button>
            <Button 
              color={selectedCekSenet?.yonu === 'alinan' ? 'green' : 'orange'}
              onClick={handleTahsil}
            >
              {selectedCekSenet?.yonu === 'alinan' ? 'Tahsil Et' : 'Öde'}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}

