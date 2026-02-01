'use client';

import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Divider,
  Drawer,
  Group,
  LoadingOverlay,
  NumberInput,
  Paper,
  Progress,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  Textarea,
  ThemeIcon,
  Timeline,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconAlertTriangle,
  IconArrowDown,
  IconArrowUp,
  IconCheck,
  IconChartLine,
  IconCurrencyLira,
  IconHistory,
  IconMinus,
  IconPlus,
  IconRefresh,
  IconRobot,
  IconSparkles,
  IconStar,
  IconTrendingDown,
  IconTrendingUp,
  IconTruck,
  IconX,
} from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';
import { useMediaQuery } from '@mantine/hooks';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAuth } from '@/context/AuthContext';
import { API_BASE_URL } from '@/lib/config';

interface UrunDetayProps {
  urunId: number | null;
  onClose: () => void;
}

interface FiyatDetay {
  urun: {
    id: number;
    kod: string;
    ad: string;
    varsayilan_birim: string;
    aktif_fiyat: number | null;
    aktif_fiyat_tipi: string | null;
    aktif_fiyat_guven: number;
    aktif_fiyat_guncelleme: string | null;
    manuel_fiyat: number | null;
    son_alis_fiyati: number | null;
    kaynak_adi: string | null;
    tipLabel: string | null;
  };
  tedarikci_fiyatlari: Array<{
    id: number;
    fiyat: number;
    birim: string;
    aktif: boolean;
    sozlesme_no: string;
    tedarikci_adi: string;
    gecerlilik_bitis: string;
    gecerlilik_baslangic?: string;
    min_siparis_miktar?: number;
    teslim_suresi_gun?: number;
  }>;
  fiyat_gecmisi: Array<{
    id: number;
    fiyat: number;
    tarih: string;
    kaynak: string;
    kaynak_adi: string;
    kaynak_kodu: string;
  }>;
  istatistikler: {
    min_fiyat: number | null;
    max_fiyat: number | null;
    ort_fiyat: number | null;
    kayit_sayisi: number;
  } | null;
}

const BIRIMLER = [
  { value: 'kg', label: 'Kilogram (kg)' },
  { value: 'gr', label: 'Gram (gr)' },
  { value: 'lt', label: 'Litre (lt)' },
  { value: 'adet', label: 'Adet' },
  { value: 'paket', label: 'Paket' },
  { value: 'kutu', label: 'Kutu' },
  { value: 'koli', label: 'Koli' },
];

// Özel Tooltip componenti
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <Paper p="xs" withBorder shadow="sm" style={{ background: 'white' }}>
        <Text size="xs" fw={500}>
          {label}
        </Text>
        <Text size="sm" c="blue" fw={600}>
          ₺{payload[0].value?.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
        </Text>
        {payload[0].payload?.kaynak && (
          <Badge size="xs" mt={4}>
            {payload[0].payload.kaynak}
          </Badge>
        )}
      </Paper>
    );
  }
  return null;
};

export function UrunDetay({ urunId, onClose }: UrunDetayProps) {
  const { isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(false);
  const [detay, setDetay] = useState<FiyatDetay | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>('gecmis');
  const isMobile = useMediaQuery('(max-width: 768px)');

  // Manuel fiyat giriş formu
  const [yeniFiyat, setYeniFiyat] = useState<number | ''>('');
  const [seciliBirim, setSeciliBirim] = useState<string>('kg');
  const [fiyatAciklama, setFiyatAciklama] = useState('');
  const [fiyatKaydediyor, setFiyatKaydediyor] = useState(false);
  const [aiTahminiYapiliyor, setAiTahminiYapiliyor] = useState(false);

  const fetchDetay = async () => {
    if (!urunId) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/fiyat-yonetimi/urunler/${urunId}`);
      const data = await res.json();
      if (data.success) {
        setDetay(data.data);
        // Varsayılan birimi ayarla
        if (data.data?.urun?.varsayilan_birim) {
          setSeciliBirim(data.data.urun.varsayilan_birim);
        }
      }
    } catch (error) {
      console.error('Detay yükleme hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (urunId) {
      fetchDetay();
      setYeniFiyat('');
      setFiyatAciklama('');
    }
  }, [urunId]);

  const handleYenidenHesapla = async () => {
    if (!urunId || !isAuthenticated) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/fiyat-yonetimi/urunler/${urunId}/hesapla`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.success) {
        notifications.show({
          title: 'Başarılı',
          message: 'Fiyat yeniden hesaplandı',
          color: 'green',
        });
        fetchDetay();
      }
    } catch (error) {
      console.error('Hesaplama hatası:', error);
    }
  };

  const handleAiTahmini = async () => {
    if (!urunId || !isAuthenticated) return;

    setAiTahminiYapiliyor(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/fiyat-yonetimi/urunler/${urunId}/ai-tahmini`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.success) {
        notifications.show({
          title: 'AI Tahmini Başarılı',
          message: `${data.data.urun_ad}: ${data.data.fiyat.toLocaleString('tr-TR')} TL (Güven: %${data.data.guven})`,
          color: 'violet',
          icon: <IconSparkles size={18} />,
        });
        fetchDetay();
      } else {
        notifications.show({
          title: 'AI Tahmini Yapılamadı',
          message: data.error || 'Bu ürün için tahmin yapılamadı',
          color: 'orange',
        });
      }
    } catch (error) {
      console.error('AI tahmini hatası:', error);
      notifications.show({
        title: 'Hata',
        message: 'AI tahmini yapılırken bir hata oluştu',
        color: 'red',
      });
    } finally {
      setAiTahminiYapiliyor(false);
    }
  };

  const handleFiyatKaydet = async () => {
    if (!urunId || !isAuthenticated || !yeniFiyat) return;

    setFiyatKaydediyor(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/fiyat-yonetimi/urunler/${urunId}/fiyat`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fiyat: yeniFiyat,
          birim: seciliBirim,
          aciklama: fiyatAciklama,
        }),
      });
      const data = await res.json();
      if (data.success) {
        notifications.show({
          title: 'Başarılı',
          message: 'Fiyat kaydedildi',
          color: 'green',
        });
        setYeniFiyat('');
        setFiyatAciklama('');
        fetchDetay();
      } else {
        throw new Error(data.error);
      }
    } catch (error: unknown) {
      notifications.show({
        title: 'Hata',
        message: error instanceof Error ? error.message : 'Fiyat kaydedilemedi',
        color: 'red',
      });
    } finally {
      setFiyatKaydediyor(false);
    }
  };

  const getGuvenColor = (guven: number) => {
    if (guven >= 80) return 'green';
    if (guven >= 50) return 'yellow';
    return 'red';
  };

  const formatTarih = (tarih: string | null) => {
    if (!tarih) return '-';
    return new Date(tarih).toLocaleDateString('tr-TR');
  };

  // Grafik verisi
  const chartData = useMemo(() => {
    if (!detay?.fiyat_gecmisi) return [];
    return detay.fiyat_gecmisi
      .slice()
      .reverse()
      .map((g) => ({
        tarih: formatTarih(g.tarih),
        fiyat: g.fiyat,
        kaynak: g.kaynak_kodu || g.kaynak,
      }));
  }, [detay?.fiyat_gecmisi]);

  // Tedarikçi karşılaştırma istatistikleri
  const tedarikciStats = useMemo(() => {
    if (!detay?.tedarikci_fiyatlari || detay.tedarikci_fiyatlari.length === 0) return null;

    const fiyatlar = detay.tedarikci_fiyatlari.filter((t) => t.aktif).map((t) => t.fiyat);
    if (fiyatlar.length === 0) return null;

    const min = Math.min(...fiyatlar);
    const max = Math.max(...fiyatlar);
    const ort = fiyatlar.reduce((a, b) => a + b, 0) / fiyatlar.length;

    return { min, max, ort };
  }, [detay?.tedarikci_fiyatlari]);

  // Fiyat trendi hesapla
  const fiyatTrendi = useMemo(() => {
    if (!chartData || chartData.length < 2) return null;
    const ilk = chartData[0]?.fiyat || 0;
    const son = chartData[chartData.length - 1]?.fiyat || 0;
    if (ilk === 0) return null;
    const degisim = ((son - ilk) / ilk) * 100;
    return { degisim, artiyor: degisim > 0 };
  }, [chartData]);

  return (
    <Drawer
      opened={!!urunId}
      onClose={onClose}
      title={
        <Group>
          <Text fw={600}>{detay?.urun.ad || 'Yükleniyor...'}</Text>
          {detay?.urun.kod && (
            <Badge variant="light" size="sm">
              {detay.urun.kod}
            </Badge>
          )}
        </Group>
      }
      position="right"
      size={isMobile ? '100%' : 'lg'}
      padding={isMobile ? 'sm' : 'md'}
    >
      <LoadingOverlay visible={loading} />

      {detay && (
        <Stack gap="md">
          {/* Özet Bilgiler */}
          <Paper p="md" withBorder>
            <SimpleGrid cols={3}>
              <div>
                <Text size="xs" c="dimmed">
                  Aktif Fiyat
                </Text>
                <Group gap={4}>
                  <IconCurrencyLira size={18} />
                  <Text size="xl" fw={700}>
                    {detay.urun.aktif_fiyat?.toLocaleString('tr-TR', {
                      minimumFractionDigits: 2,
                    }) || '-'}
                  </Text>
                  <Text size="sm" c="dimmed">
                    /{detay.urun.varsayilan_birim}
                  </Text>
                </Group>
                {fiyatTrendi && (
                  <Group gap={4} mt={4}>
                    {fiyatTrendi.artiyor ? (
                      <IconTrendingUp size={14} color="red" />
                    ) : (
                      <IconTrendingDown size={14} color="green" />
                    )}
                    <Text size="xs" c={fiyatTrendi.artiyor ? 'red' : 'green'}>
                      {fiyatTrendi.artiyor ? '+' : ''}
                      {fiyatTrendi.degisim.toFixed(1)}%
                    </Text>
                  </Group>
                )}
              </div>
              <div>
                <Text size="xs" c="dimmed">
                  Kaynak
                </Text>
                <Badge
                  color={
                    detay.urun.aktif_fiyat_tipi === 'SOZLESME'
                      ? 'blue'
                      : detay.urun.aktif_fiyat_tipi === 'FATURA'
                        ? 'green'
                        : detay.urun.aktif_fiyat_tipi === 'PIYASA'
                          ? 'cyan'
                          : detay.urun.aktif_fiyat_tipi === 'AI_TAHMINI'
                            ? 'violet'
                            : detay.urun.aktif_fiyat_tipi === 'MANUEL'
                              ? 'orange'
                              : 'gray'
                  }
                  size="lg"
                  mt={4}
                  leftSection={
                    detay.urun.aktif_fiyat_tipi === 'AI_TAHMINI' ? <IconRobot size={12} /> : undefined
                  }
                >
                  {detay.urun.tipLabel || detay.urun.aktif_fiyat_tipi || 'Yok'}
                </Badge>
              </div>
              <div>
                <Text size="xs" c="dimmed">
                  Güven Skoru
                </Text>
                <Group gap="xs" mt={4}>
                  <Progress
                    value={detay.urun.aktif_fiyat_guven}
                    color={getGuvenColor(detay.urun.aktif_fiyat_guven)}
                    size="lg"
                    style={{ flex: 1 }}
                  />
                  <Text size="sm" fw={500}>
                    %{detay.urun.aktif_fiyat_guven}
                  </Text>
                </Group>
              </div>
            </SimpleGrid>

            <Divider my="sm" />

            <Group justify="space-between">
              <Text size="sm" c="dimmed">
                Son güncelleme: {formatTarih(detay.urun.aktif_fiyat_guncelleme)}
              </Text>
              <Group gap="xs">
                <Button
                  variant="light"
                  color="violet"
                  size="xs"
                  leftSection={<IconRobot size={14} />}
                  onClick={handleAiTahmini}
                  loading={aiTahminiYapiliyor}
                >
                  AI Tahmini
                </Button>
                <Button
                  variant="light"
                  size="xs"
                  leftSection={<IconRefresh size={14} />}
                  onClick={handleYenidenHesapla}
                >
                  Yeniden Hesapla
                </Button>
              </Group>
            </Group>
          </Paper>

          {/* İstatistikler */}
          {detay.istatistikler && detay.istatistikler.kayit_sayisi > 0 && (
            <Paper p="md" withBorder>
              <Text size="sm" fw={500} mb="xs">
                Son 90 Gün İstatistikleri
              </Text>
              <SimpleGrid cols={4}>
                <div>
                  <Text size="xs" c="dimmed">
                    Min
                  </Text>
                  <Text fw={500} c="green">
                    ₺{detay.istatistikler.min_fiyat?.toLocaleString('tr-TR')}
                  </Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed">
                    Max
                  </Text>
                  <Text fw={500} c="red">
                    ₺{detay.istatistikler.max_fiyat?.toLocaleString('tr-TR')}
                  </Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed">
                    Ortalama
                  </Text>
                  <Text fw={500} c="blue">
                    ₺
                    {detay.istatistikler.ort_fiyat?.toLocaleString('tr-TR', {
                      maximumFractionDigits: 2,
                    })}
                  </Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed">
                    Kayıt
                  </Text>
                  <Text fw={500}>{detay.istatistikler.kayit_sayisi}</Text>
                </div>
              </SimpleGrid>
            </Paper>
          )}

          {/* Sekmeler */}
          <Tabs value={activeTab} onChange={setActiveTab}>
            <Tabs.List>
              <Tabs.Tab value="gecmis" leftSection={<IconChartLine size={16} />}>
                Fiyat Grafiği
              </Tabs.Tab>
              <Tabs.Tab value="tedarikci" leftSection={<IconTruck size={16} />}>
                Tedarikçiler ({detay.tedarikci_fiyatlari.length})
              </Tabs.Tab>
              <Tabs.Tab value="manuel" leftSection={<IconPlus size={16} />}>
                Manuel Giriş
              </Tabs.Tab>
            </Tabs.List>

            {/* Fiyat Geçmişi ve Grafik */}
            <Tabs.Panel value="gecmis" pt="md">
              {chartData && chartData.length > 0 ? (
                <Stack gap="md">
                  <Paper p="sm" withBorder>
                    <Group justify="space-between" mb="xs">
                      <Text size="sm" fw={500}>
                        Fiyat Trendi
                      </Text>
                      {fiyatTrendi && (
                        <Badge color={fiyatTrendi.artiyor ? 'red' : 'green'} variant="light">
                          {fiyatTrendi.artiyor ? <IconArrowUp size={12} /> : <IconArrowDown size={12} />}
                          {fiyatTrendi.artiyor ? '+' : ''}
                          {fiyatTrendi.degisim.toFixed(1)}% (son {chartData.length} kayıt)
                        </Badge>
                      )}
                    </Group>
                    <ResponsiveContainer width="100%" height={180}>
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="colorFiyat" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#228be6" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#228be6" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                        <XAxis dataKey="tarih" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} domain={['auto', 'auto']} />
                        <RechartsTooltip content={<CustomTooltip />} />
                        {detay.istatistikler?.ort_fiyat && (
                          <ReferenceLine
                            y={detay.istatistikler.ort_fiyat}
                            stroke="#ff6b6b"
                            strokeDasharray="5 5"
                            label={{ value: 'Ort', fontSize: 10, fill: '#ff6b6b' }}
                          />
                        )}
                        <Area
                          type="monotone"
                          dataKey="fiyat"
                          stroke="#228be6"
                          strokeWidth={2}
                          fill="url(#colorFiyat)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </Paper>

                  <Text size="sm" fw={500}>
                    Fiyat Geçmişi
                  </Text>
                  <Timeline bulletSize={24} lineWidth={2}>
                    {detay.fiyat_gecmisi.slice(0, 10).map((g) => (
                      <Timeline.Item
                        key={g.id}
                        bullet={
                          <ThemeIcon
                            size={22}
                            radius="xl"
                            color={
                              g.kaynak_kodu === 'FATURA'
                                ? 'green'
                                : g.kaynak_kodu === 'TEDARIKCI'
                                  ? 'blue'
                                  : g.kaynak_kodu === 'AI_TAHMINI'
                                    ? 'violet'
                                    : 'gray'
                            }
                          >
                            <IconCurrencyLira size={12} />
                          </ThemeIcon>
                        }
                        title={
                          <Group gap="xs">
                            <Text fw={500}>₺{g.fiyat.toLocaleString('tr-TR')}</Text>
                            <Badge size="xs" variant="light">
                              {g.kaynak_adi || g.kaynak}
                            </Badge>
                          </Group>
                        }
                      >
                        <Text size="xs" c="dimmed">
                          {formatTarih(g.tarih)}
                        </Text>
                      </Timeline.Item>
                    ))}
                  </Timeline>
                </Stack>
              ) : (
                <Paper p="xl" withBorder ta="center">
                  <IconHistory size={40} color="gray" style={{ opacity: 0.5 }} />
                  <Text c="dimmed" mt="sm">
                    Henüz fiyat geçmişi yok
                  </Text>
                </Paper>
              )}
            </Tabs.Panel>

            {/* Tedarikçi Karşılaştırma */}
            <Tabs.Panel value="tedarikci" pt="md">
              {detay.tedarikci_fiyatlari.length > 0 ? (
                <Stack gap="md">
                  {/* Karşılaştırma özeti */}
                  {tedarikciStats && detay.tedarikci_fiyatlari.filter((t) => t.aktif).length > 1 && (
                    <SimpleGrid cols={3}>
                      <Card withBorder p="xs" bg="green.0">
                        <Text size="xs" c="dimmed">
                          En Ucuz
                        </Text>
                        <Text fw={700} c="green">
                          ₺{tedarikciStats.min.toLocaleString('tr-TR')}
                        </Text>
                      </Card>
                      <Card withBorder p="xs" bg="blue.0">
                        <Text size="xs" c="dimmed">
                          Ortalama
                        </Text>
                        <Text fw={700} c="blue">
                          ₺{tedarikciStats.ort.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}
                        </Text>
                      </Card>
                      <Card withBorder p="xs" bg="red.0">
                        <Text size="xs" c="dimmed">
                          En Pahalı
                        </Text>
                        <Text fw={700} c="red">
                          ₺{tedarikciStats.max.toLocaleString('tr-TR')}
                        </Text>
                      </Card>
                    </SimpleGrid>
                  )}

                  <Table>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Tedarikçi</Table.Th>
                        <Table.Th style={{ textAlign: 'right' }}>Fiyat</Table.Th>
                        <Table.Th style={{ textAlign: 'center' }}>Fark</Table.Th>
                        <Table.Th>Durum</Table.Th>
                        <Table.Th>Geçerlilik</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {detay.tedarikci_fiyatlari.map((tf) => {
                        const enUcuz = tedarikciStats && tf.fiyat === tedarikciStats.min && tf.aktif;
                        const enPahali = tedarikciStats && tf.fiyat === tedarikciStats.max && tf.aktif;
                        const fark = tedarikciStats ? ((tf.fiyat - tedarikciStats.ort) / tedarikciStats.ort) * 100 : 0;

                        return (
                          <Table.Tr key={tf.id} style={{ background: enUcuz ? '#e8f5e9' : undefined }}>
                            <Table.Td>
                              <Group gap="xs">
                                {enUcuz && (
                                  <Tooltip label="En ucuz">
                                    <IconStar size={14} color="gold" fill="gold" />
                                  </Tooltip>
                                )}
                                <div>
                                  <Text size="sm" fw={enUcuz ? 600 : 400}>
                                    {tf.tedarikci_adi}
                                  </Text>
                                  {tf.sozlesme_no && (
                                    <Text size="xs" c="dimmed">
                                      #{tf.sozlesme_no}
                                    </Text>
                                  )}
                                </div>
                              </Group>
                            </Table.Td>
                            <Table.Td style={{ textAlign: 'right' }}>
                              <Text fw={600} c={enUcuz ? 'green' : enPahali ? 'red' : undefined}>
                                ₺{tf.fiyat.toLocaleString('tr-TR')}
                              </Text>
                              <Text size="xs" c="dimmed">
                                /{tf.birim || detay.urun.varsayilan_birim}
                              </Text>
                            </Table.Td>
                            <Table.Td style={{ textAlign: 'center' }}>
                              {tedarikciStats && tf.aktif && detay.tedarikci_fiyatlari.filter((t) => t.aktif).length > 1 && (
                                <Badge
                                  size="xs"
                                  color={fark > 0 ? 'red' : fark < 0 ? 'green' : 'gray'}
                                  variant="light"
                                  leftSection={
                                    fark > 0 ? (
                                      <IconArrowUp size={10} />
                                    ) : fark < 0 ? (
                                      <IconArrowDown size={10} />
                                    ) : (
                                      <IconMinus size={10} />
                                    )
                                  }
                                >
                                  {fark > 0 ? '+' : ''}
                                  {fark.toFixed(1)}%
                                </Badge>
                              )}
                            </Table.Td>
                            <Table.Td>
                              {tf.aktif ? (
                                <Badge color="green" size="sm" leftSection={<IconCheck size={10} />}>
                                  Aktif
                                </Badge>
                              ) : (
                                <Badge color="gray" size="sm">
                                  Pasif
                                </Badge>
                              )}
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm" c="dimmed">
                                {formatTarih(tf.gecerlilik_bitis)}
                              </Text>
                              {tf.teslim_suresi_gun && (
                                <Text size="xs" c="dimmed">
                                  {tf.teslim_suresi_gun} gün teslim
                                </Text>
                              )}
                            </Table.Td>
                          </Table.Tr>
                        );
                      })}
                    </Table.Tbody>
                  </Table>
                </Stack>
              ) : (
                <Paper p="xl" withBorder ta="center">
                  <IconTruck size={40} color="gray" style={{ opacity: 0.5 }} />
                  <Text c="dimmed" mt="sm">
                    Henüz tedarikçi sözleşmesi yok
                  </Text>
                </Paper>
              )}
            </Tabs.Panel>

            {/* Manuel Fiyat Girişi */}
            <Tabs.Panel value="manuel" pt="md">
              <Stack gap="md">
                <Paper p="md" withBorder>
                  <Text size="sm" fw={500} mb="md">
                    Yeni Fiyat Gir
                  </Text>
                  <Stack gap="sm">
                    <Group grow>
                      <NumberInput
                        label="Fiyat"
                        placeholder="0.00"
                        value={yeniFiyat}
                        onChange={(v) => setYeniFiyat(v as number)}
                        leftSection={<IconCurrencyLira size={16} />}
                        decimalScale={2}
                        min={0}
                      />
                      <Select
                        label="Birim"
                        data={BIRIMLER}
                        value={seciliBirim}
                        onChange={(v) => setSeciliBirim(v || 'kg')}
                      />
                    </Group>
                    <Textarea
                      label="Açıklama (opsiyonel)"
                      placeholder="Fiyat güncelleme sebebi..."
                      value={fiyatAciklama}
                      onChange={(e) => setFiyatAciklama(e.target.value)}
                      rows={2}
                    />
                    <Button onClick={handleFiyatKaydet} loading={fiyatKaydediyor} disabled={!yeniFiyat}>
                      Fiyat Kaydet
                    </Button>
                  </Stack>
                </Paper>

                <Paper p="md" withBorder bg="yellow.0">
                  <Group gap="xs">
                    <IconAlertTriangle size={18} color="orange" />
                    <Text size="sm" fw={500}>
                      Not
                    </Text>
                  </Group>
                  <Text size="sm" c="dimmed" mt="xs">
                    Manuel girilen fiyatlar, tedarikçi sözleşmesi veya güncel fatura verisi olmadığında kullanılır. Güven
                    skoru: %50
                  </Text>
                </Paper>
              </Stack>
            </Tabs.Panel>
          </Tabs>
        </Stack>
      )}
    </Drawer>
  );
}
