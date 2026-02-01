'use client';

import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Menu,
  Modal,
  Paper,
  RingProgress,
  SimpleGrid,
  Skeleton,
  Stack,
  Tabs,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconAlertTriangle,
  IconCheck,
  IconChevronDown,
  IconClock,
  IconDatabase,
  IconDownload,
  IconFileInvoice,
  IconFileSpreadsheet,
  IconFileTypeCsv,
  IconRefresh,
  IconTruck,
} from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { API_BASE_URL } from '@/lib/config';

// Fiyat yönetimi component içeriği import edilecek
import { DashboardCharts } from '@/components/fiyat-yonetimi/DashboardCharts';
import { FiyatGuncelleme } from '@/components/fiyat-yonetimi/FiyatGuncelleme';
import { TedarikciSozlesme } from '@/components/fiyat-yonetimi/TedarikciSozlesme';
import { UrunDetay } from '@/components/fiyat-yonetimi/UrunDetay';
import { UrunListesi } from '@/components/fiyat-yonetimi/UrunListesi';
import { UyariMerkezi } from '@/components/fiyat-yonetimi/UyariMerkezi';
import {
  downloadCSV,
  downloadJSON,
  SOZLESME_EXPORT_COLUMNS,
  toCSV,
  URUN_EXPORT_COLUMNS,
} from '@/lib/fiyat-yonetimi/exportUtils';

interface DashboardData {
  ozet: {
    toplam_urun: number;
    fiyatli_urun: number;
    guncel_fiyat: number;
    eski_fiyat: number;
    ortalama_guven: number;
    sozlesme_fiyatli: number;
    fatura_fiyatli: number;
    piyasa_fiyatli: number;
    manuel_fiyatli: number;
    varsayilan_fiyatli: number;
  };
  kategoriler: Array<{
    kategori_id: number;
    kategori_ad: string;
    urun_sayisi: number;
    guncel_fiyat: number;
    eski_fiyat: number;
    ortalama_guven: number;
  }>;
  kaynaklar: Array<{
    kod: string;
    ad: string;
    guvenilirlik_skoru: number;
    urun_sayisi: number;
    son_basarili_guncelleme: string | null;
  }>;
  uyarilar: Record<string, number>;
}

export function FiyatYonetimiTab() {
  const [activeTab, setActiveTab] = useState<string | null>('urunler');
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [seciliUrunId, setSeciliUrunId] = useState<number | null>(null);
  const [uyariModalAcik, setUyariModalAcik] = useState(false);
  const [exporting, setExporting] = useState(false);

  const fetchDashboard = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/fiyat-yonetimi/dashboard`);
      const data = await res.json();
      if (data.success) {
        setDashboard(data.data);
      }
    } catch (error) {
      console.error('Dashboard yükleme hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const getGuvenColor = (guven: number) => {
    if (guven >= 80) return 'green';
    if (guven >= 50) return 'yellow';
    return 'red';
  };

  const toplam_uyari = dashboard?.uyarilar
    ? Object.values(dashboard.uyarilar).reduce((a, b) => a + b, 0)
    : 0;

  // Export fonksiyonları
  const handleExportUrunlerCSV = async () => {
    setExporting(true);
    try {
      // Tüm ürünleri çek (limit yüksek)
      const res = await fetch(`${API_BASE_URL}/api/fiyat-yonetimi/urunler?limit=10000`);
      const data = await res.json();

      if (data.success && data.data) {
        const csvContent = toCSV(data.data, URUN_EXPORT_COLUMNS);
        const tarih = new Date().toISOString().split('T')[0];
        downloadCSV(csvContent, `urun-fiyatlari-${tarih}.csv`);
        notifications.show({
          title: 'Export Başarılı',
          message: `${data.data.length} ürün CSV olarak indirildi`,
          color: 'green',
        });
      }
    } catch (error) {
      notifications.show({ title: 'Hata', message: 'Export başarısız', color: 'red' });
    } finally {
      setExporting(false);
    }
  };

  const handleExportUrunlerJSON = async () => {
    setExporting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/fiyat-yonetimi/urunler?limit=10000`);
      const data = await res.json();

      if (data.success && data.data) {
        const tarih = new Date().toISOString().split('T')[0];
        downloadJSON(data.data, `urun-fiyatlari-${tarih}.json`);
        notifications.show({
          title: 'Export Başarılı',
          message: `${data.data.length} ürün JSON olarak indirildi`,
          color: 'green',
        });
      }
    } catch (error) {
      notifications.show({ title: 'Hata', message: 'Export başarısız', color: 'red' });
    } finally {
      setExporting(false);
    }
  };

  const handleExportSozlesmelerCSV = async () => {
    setExporting(true);
    try {
      // Tüm sözleşmeleri ve fiyatları çek
      const res = await fetch(`${API_BASE_URL}/api/fiyat-yonetimi/sozlesmeler`);
      const data = await res.json();

      if (data.success && data.data) {
        // Her sözleşmenin detaylarını çek
        const allFiyatlar: any[] = [];

        for (const sozlesme of data.data) {
          const detayRes = await fetch(`${API_BASE_URL}/api/fiyat-yonetimi/sozlesmeler/${sozlesme.cari_id}`);
          const detayData = await detayRes.json();

          if (detayData.success && detayData.data?.fiyatlar) {
            detayData.data.fiyatlar.forEach((f: any) => {
              allFiyatlar.push({
                tedarikci_adi: detayData.data.tedarikci.unvan,
                ...f,
              });
            });
          }
        }

        const csvContent = toCSV(allFiyatlar, SOZLESME_EXPORT_COLUMNS);
        const tarih = new Date().toISOString().split('T')[0];
        downloadCSV(csvContent, `sozlesme-fiyatlari-${tarih}.csv`);
        notifications.show({
          title: 'Export Başarılı',
          message: `${allFiyatlar.length} sözleşme fiyatı CSV olarak indirildi`,
          color: 'green',
        });
      }
    } catch (error) {
      notifications.show({ title: 'Hata', message: 'Export başarısız', color: 'red' });
    } finally {
      setExporting(false);
    }
  };

  const handleExportDashboardJSON = async () => {
    if (dashboard) {
      const tarih = new Date().toISOString().split('T')[0];
      downloadJSON(dashboard, `fiyat-dashboard-${tarih}.json`);
      notifications.show({
        title: 'Export Başarılı',
        message: 'Dashboard verisi JSON olarak indirildi',
        color: 'green',
      });
    }
  };

  return (
    <Paper p="md" withBorder radius="lg">
      {/* Header */}
      <Group justify="space-between" mb="lg">
        <div>
          <Title order={4}>Fiyat Yönetimi</Title>
          <Text c="dimmed" size="sm">
            Merkezi fiyat takibi ve yönetimi
          </Text>
        </div>
        <Menu shadow="md" width={220}>
          <Menu.Target>
            <Button
              variant="light"
              leftSection={<IconDownload size={16} />}
              rightSection={<IconChevronDown size={14} />}
              loading={exporting}
            >
              Export
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Label>Ürün Fiyatları</Menu.Label>
            <Menu.Item leftSection={<IconFileTypeCsv size={16} />} onClick={handleExportUrunlerCSV}>
              Ürünleri CSV İndir
            </Menu.Item>
            <Menu.Item leftSection={<IconFileSpreadsheet size={16} />} onClick={handleExportUrunlerJSON}>
              Ürünleri JSON İndir
            </Menu.Item>
            <Menu.Divider />
            <Menu.Label>Sözleşmeler</Menu.Label>
            <Menu.Item leftSection={<IconFileTypeCsv size={16} />} onClick={handleExportSozlesmelerCSV}>
              Sözleşmeleri CSV İndir
            </Menu.Item>
            <Menu.Divider />
            <Menu.Label>Dashboard</Menu.Label>
            <Menu.Item
              leftSection={<IconFileSpreadsheet size={16} />}
              onClick={handleExportDashboardJSON}
              disabled={!dashboard}
            >
              Dashboard JSON İndir
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>

      {/* Özet Kartlar */}
      {loading ? (
        <SimpleGrid cols={{ base: 2, sm: 3, md: 6 }} mb="lg">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} height={100} radius="md" />
          ))}
        </SimpleGrid>
      ) : (
        dashboard && (
          <SimpleGrid cols={{ base: 2, sm: 3, md: 6 }} mb="lg">
            <Paper p="md" withBorder radius="md">
              <Group justify="space-between">
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={500}>
                    Toplam Ürün
                  </Text>
                  <Text size="xl" fw={700}>
                    {dashboard.ozet.toplam_urun}
                  </Text>
                </div>
                <ThemeIcon size="lg" variant="light" color="blue">
                  <IconDatabase size={20} />
                </ThemeIcon>
              </Group>
            </Paper>

            <Paper p="md" withBorder radius="md">
              <Group justify="space-between">
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={500}>
                    Güncel Fiyat
                  </Text>
                  <Text size="xl" fw={700} c="green">
                    {dashboard.ozet.guncel_fiyat}
                  </Text>
                </div>
                <ThemeIcon size="lg" variant="light" color="green">
                  <IconCheck size={20} />
                </ThemeIcon>
              </Group>
              <Text size="xs" c="dimmed" mt={4}>
                %{Math.round((dashboard.ozet.guncel_fiyat / dashboard.ozet.toplam_urun) * 100)}
              </Text>
            </Paper>

            <Paper p="md" withBorder radius="md">
              <Group justify="space-between">
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={500}>
                    Eskimiş
                  </Text>
                  <Text size="xl" fw={700} c="orange">
                    {dashboard.ozet.eski_fiyat}
                  </Text>
                </div>
                <ThemeIcon size="lg" variant="light" color="orange">
                  <IconClock size={20} />
                </ThemeIcon>
              </Group>
              <Text size="xs" c="dimmed" mt={4}>
                30+ gün
              </Text>
            </Paper>

            <Paper
              p="md"
              withBorder
              radius="md"
              style={{ cursor: toplam_uyari > 0 ? 'pointer' : 'default' }}
              onClick={() => toplam_uyari > 0 && setUyariModalAcik(true)}
            >
              <Group justify="space-between">
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={500}>
                    Uyarılar
                  </Text>
                  <Text size="xl" fw={700} c={toplam_uyari > 0 ? 'red' : 'green'}>
                    {toplam_uyari}
                  </Text>
                </div>
                <ThemeIcon size="lg" variant="light" color={toplam_uyari > 0 ? 'red' : 'green'}>
                  {toplam_uyari > 0 ? <IconAlertTriangle size={20} /> : <IconCheck size={20} />}
                </ThemeIcon>
              </Group>
              {toplam_uyari > 0 && (
                <Text size="xs" c="dimmed" mt={4}>
                  Detay için tıkla
                </Text>
              )}
            </Paper>

            <Paper p="md" withBorder radius="md">
              <Group justify="space-between">
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={500}>
                    Ort. Güven
                  </Text>
                  <Text size="xl" fw={700}>
                    %{dashboard.ozet.ortalama_guven}
                  </Text>
                </div>
                <RingProgress
                  size={40}
                  thickness={4}
                  sections={[
                    {
                      value: dashboard.ozet.ortalama_guven,
                      color: getGuvenColor(dashboard.ozet.ortalama_guven),
                    },
                  ]}
                />
              </Group>
            </Paper>

            <Paper p="md" withBorder radius="md">
              <Group justify="space-between">
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={500}>
                    Sözleşmeli
                  </Text>
                  <Text size="xl" fw={700} c="blue">
                    {dashboard.ozet.sozlesme_fiyatli}
                  </Text>
                </div>
                <ThemeIcon size="lg" variant="light" color="blue">
                  <IconFileInvoice size={20} />
                </ThemeIcon>
              </Group>
            </Paper>
          </SimpleGrid>
        )
      )}

      {/* Kaynak Dağılımı (Mini) */}
      {dashboard && !loading && (
        <Paper p="md" withBorder mb="lg">
          <Text size="sm" fw={500} mb="sm">
            Fiyat Kaynağı Dağılımı
          </Text>
          <Group gap="xl">
            <Group gap="xs">
              <Badge color="blue" variant="dot">
                Sözleşme
              </Badge>
              <Text size="sm" fw={500}>
                {dashboard.ozet.sozlesme_fiyatli}
              </Text>
            </Group>
            <Group gap="xs">
              <Badge color="green" variant="dot">
                Fatura
              </Badge>
              <Text size="sm" fw={500}>
                {dashboard.ozet.fatura_fiyatli}
              </Text>
            </Group>
            <Group gap="xs">
              <Badge color="cyan" variant="dot">
                Piyasa
              </Badge>
              <Text size="sm" fw={500}>
                {dashboard.ozet.piyasa_fiyatli}
              </Text>
            </Group>
            <Group gap="xs">
              <Badge color="orange" variant="dot">
                Manuel
              </Badge>
              <Text size="sm" fw={500}>
                {dashboard.ozet.manuel_fiyatli}
              </Text>
            </Group>
            <Group gap="xs">
              <Badge color="gray" variant="dot">
                Varsayılan
              </Badge>
              <Text size="sm" fw={500}>
                {dashboard.ozet.varsayilan_fiyatli}
              </Text>
            </Group>
          </Group>
        </Paper>
      )}

      {/* Sekmeler - 3 Tab */}
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List mb="md">
          <Tabs.Tab value="urunler" leftSection={<IconDatabase size={16} />}>
            Ürün Listesi
          </Tabs.Tab>
          <Tabs.Tab value="tedarikci" leftSection={<IconTruck size={16} />}>
            Sözleşmeler
          </Tabs.Tab>
          <Tabs.Tab value="guncelleme" leftSection={<IconRefresh size={16} />}>
            Fiyat Güncelleme
          </Tabs.Tab>
        </Tabs.List>

        {/* Ürün Listesi */}
        <Tabs.Panel value="urunler">
          <UrunListesi onUrunSec={(id) => setSeciliUrunId(id)} />
        </Tabs.Panel>

        {/* Tedarikçi Sözleşmeleri */}
        <Tabs.Panel value="tedarikci">
          <TedarikciSozlesme />
        </Tabs.Panel>

        {/* Fiyat Güncelleme (Piyasa + Toplu birleşik) */}
        <Tabs.Panel value="guncelleme">
          <FiyatGuncelleme />
        </Tabs.Panel>
      </Tabs>

      {/* Uyarılar Modal */}
      <Modal
        opened={uyariModalAcik}
        onClose={() => setUyariModalAcik(false)}
        title="Fiyat Uyarıları"
        size="xl"
      >
        <UyariMerkezi
          onUrunSec={(id) => {
            setSeciliUrunId(id);
            setUyariModalAcik(false);
          }}
        />
      </Modal>

      {/* Ürün Detay Drawer */}
      <UrunDetay urunId={seciliUrunId} onClose={() => setSeciliUrunId(null)} />
    </Paper>
  );
}