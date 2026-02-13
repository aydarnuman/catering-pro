'use client';

import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Divider,
  Group,
  Loader,
  Modal,
  Paper,
  Progress,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconAlertTriangle,
  IconCalendar,
  IconCheck,
  IconChevronDown,
  IconChevronUp,
  IconClock,
  IconDownload,
  IconFileInvoice,
  IconList,
  IconMail,
  IconPrinter,
  IconX,
} from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';
import { muhasebeAPI } from '@/lib/api/services/muhasebe';
import { formatDate, formatMoney } from '@/lib/formatters';
import type { Cari } from '@/types/domain';

interface MutabakatModalProps {
  opened: boolean;
  onClose: () => void;
  cari: Cari | null;
}

// Para formatı - @/lib/formatters'dan import ediliyor

// Aylar listesi
const aylar = [
  { value: '1', label: 'Ocak' },
  { value: '2', label: 'Şubat' },
  { value: '3', label: 'Mart' },
  { value: '4', label: 'Nisan' },
  { value: '5', label: 'Mayıs' },
  { value: '6', label: 'Haziran' },
  { value: '7', label: 'Temmuz' },
  { value: '8', label: 'Ağustos' },
  { value: '9', label: 'Eylül' },
  { value: '10', label: 'Ekim' },
  { value: '11', label: 'Kasım' },
  { value: '12', label: 'Aralık' },
];

// Yıllar listesi
const yillar = Array.from({ length: 5 }, (_, i) => {
  const year = new Date().getFullYear() - i;
  return { value: String(year), label: String(year) };
});

export default function MutabakatModal({ opened, onClose, cari }: MutabakatModalProps) {
  const [activeTab, setActiveTab] = useState<string | null>('ekstre');
  const [loading, setLoading] = useState(false);

  // Dönem filtresi
  const [selectedAy, setSelectedAy] = useState(String(new Date().getMonth() + 1));
  const [selectedYil, setSelectedYil] = useState(String(new Date().getFullYear()));

  // Data states
  const [ekstreData, setEkstreData] = useState<any>(null);
  const [faturaBazliData, setFaturaBazliData] = useState<any>(null);
  const [donemselData, setDonemselData] = useState<any>(null);

  // Fatura bazlı filtre
  const [faturaFiltre, setFaturaFiltre] = useState('tumu');

  // Açık/kapalı fatura detayları
  const [expandedFatura, setExpandedFatura] = useState<number | null>(null);

  // Fonksiyonu useCallback ile tanımla (TDZ hatası için)
  const loadData = useCallback(async () => {
    if (!cari) return;
    setLoading(true);

    try {
      const baslangic = `${selectedYil}-${selectedAy.padStart(2, '0')}-01`;
      const sonGun = new Date(parseInt(selectedYil, 10), parseInt(selectedAy, 10), 0).getDate();
      const bitis = `${selectedYil}-${selectedAy.padStart(2, '0')}-${sonGun}`;

      if (activeTab === 'ekstre') {
        const result = await muhasebeAPI.getMutabakatEkstre(cari.id, baslangic, bitis);
        if (result.success) {
          setEkstreData(result.data);
        }
      } else if (activeTab === 'fatura-bazli') {
        const result = await muhasebeAPI.getMutabakatFaturaBazli(cari.id, {
          durum: faturaFiltre,
          yil: parseInt(selectedYil, 10),
          ay: parseInt(selectedAy, 10),
        });
        if (result.success) {
          setFaturaBazliData(result.data);
        }
      } else if (activeTab === 'donemsel') {
        const result = await muhasebeAPI.getMutabakatDonemsel(
          cari.id,
          parseInt(selectedYil, 10),
          parseInt(selectedAy, 10)
        );
        if (result.success) {
          setDonemselData(result.data);
        }
      }
    } catch (error) {
      console.error('Veri yükleme hatası:', error);
      notifications.show({
        title: 'Hata',
        message: 'Veriler yüklenemedi',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  }, [cari, selectedYil, selectedAy, activeTab, faturaFiltre]);

  // Verileri yükle
  useEffect(() => {
    if (opened && cari) {
      loadData();
    }
  }, [opened, cari, loadData]);

  // Fatura filtresi veya tarih değiştiğinde yeniden yükle
  useEffect(() => {
    if (activeTab === 'fatura-bazli' && cari) {
      loadData();
    }
  }, [activeTab, cari, loadData]);

  const renderEkstreTab = () => {
    if (!ekstreData) return <Text c="dimmed">Veri yükleniyor...</Text>;

    return (
      <Stack gap="md">
        {/* Dönem Özeti */}
        <Paper p="md" radius="md" className="nested-card">
          <SimpleGrid cols={{ base: 2, md: 4 }}>
            <Box>
              <Text size="xs" c="dimmed">
                Açılış Bakiyesi
              </Text>
              <Text fw={600} c={ekstreData.acilis_bakiyesi >= 0 ? 'green' : 'red'}>
                {formatMoney(ekstreData.acilis_bakiyesi)}
              </Text>
            </Box>
            <Box>
              <Text size="xs" c="dimmed">
                Toplam Borç
              </Text>
              <Text fw={600} c="red">
                {formatMoney(ekstreData.toplam_borc)}
              </Text>
            </Box>
            <Box>
              <Text size="xs" c="dimmed">
                Toplam Alacak
              </Text>
              <Text fw={600} c="green">
                {formatMoney(ekstreData.toplam_alacak)}
              </Text>
            </Box>
            <Box>
              <Text size="xs" c="dimmed">
                Kapanış Bakiyesi
              </Text>
              <Text fw={700} size="lg" c={ekstreData.kapanis_bakiyesi >= 0 ? 'green' : 'red'}>
                {formatMoney(ekstreData.kapanis_bakiyesi)}
              </Text>
            </Box>
          </SimpleGrid>
        </Paper>

        {/* Hareketler Tablosu */}
        <ScrollArea h={400}>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Tarih</Table.Th>
                <Table.Th>Belge No</Table.Th>
                <Table.Th>Açıklama</Table.Th>
                <Table.Th ta="right">Borç</Table.Th>
                <Table.Th ta="right">Alacak</Table.Th>
                <Table.Th ta="right">Bakiye</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {/* Açılış satırı */}
              <Table.Tr style={{ backgroundColor: 'var(--mantine-color-blue-0)' }}>
                <Table.Td>{formatDate(ekstreData.donem.baslangic)}</Table.Td>
                <Table.Td>-</Table.Td>
                <Table.Td>
                  <Text fw={500}>📅 Dönem Başı Devir</Text>
                </Table.Td>
                <Table.Td ta="right">-</Table.Td>
                <Table.Td ta="right">-</Table.Td>
                <Table.Td ta="right" fw={600}>
                  {formatMoney(ekstreData.acilis_bakiyesi)}
                </Table.Td>
              </Table.Tr>

              {ekstreData.hareketler.map((h: any, _index: number) => (
                <Table.Tr key={`${h.kaynak_tip}-${h.kaynak_id}`}>
                  <Table.Td>{formatDate(h.tarih)}</Table.Td>
                  <Table.Td>
                    <Badge
                      size="sm"
                      variant="light"
                      color={h.kaynak_tip === 'fatura' ? 'blue' : h.kaynak_tip === 'hareket' ? 'green' : 'orange'}
                    >
                      {h.belge_no || '-'}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      {h.kaynak_tip === 'fatura' && '📄'}
                      {h.kaynak_tip === 'hareket' && '💰'}
                      {h.kaynak_tip === 'cek_senet' && '📋'}
                      <Text size="sm">{h.aciklama}</Text>
                    </Group>
                  </Table.Td>
                  <Table.Td ta="right" c={h.borc > 0 ? 'red' : undefined}>
                    {h.borc > 0 ? formatMoney(h.borc) : '-'}
                  </Table.Td>
                  <Table.Td ta="right" c={h.alacak > 0 ? 'green' : undefined}>
                    {h.alacak > 0 ? formatMoney(h.alacak) : '-'}
                  </Table.Td>
                  <Table.Td ta="right" fw={600} c={h.bakiye >= 0 ? 'green' : 'red'}>
                    {formatMoney(h.bakiye)}
                  </Table.Td>
                </Table.Tr>
              ))}

              {ekstreData.hareketler.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={6}>
                    <Text ta="center" c="dimmed" py="xl">
                      Bu dönemde hareket bulunmamaktadır
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Stack>
    );
  };

  const renderFaturaBazliTab = () => {
    if (!faturaBazliData) return <Text c="dimmed">Veri yükleniyor...</Text>;

    return (
      <Stack gap="md">
        {/* Filtre ve Özet */}
        <Group justify="space-between">
          <Select
            value={faturaFiltre}
            onChange={(v) => setFaturaFiltre(v || 'tumu')}
            data={[
              { value: 'tumu', label: 'Tüm Faturalar' },
              { value: 'acik', label: '⏳ Açık Faturalar' },
              { value: 'kismi', label: '🟡 Kısmi Ödenenler' },
              { value: 'kapali', label: '✅ Kapalı Faturalar' },
            ]}
            w={200}
          />
          <Group gap="xl">
            <Badge size="lg" color="red" variant="light">
              Açık: {faturaBazliData.ozet.acik_fatura_sayisi}
            </Badge>
            <Badge size="lg" color="yellow" variant="light">
              Kısmi: {faturaBazliData.ozet.kismi_fatura_sayisi}
            </Badge>
            <Badge size="lg" color="green" variant="light">
              Kapalı: {faturaBazliData.ozet.kapali_fatura_sayisi}
            </Badge>
          </Group>
        </Group>

        {/* Özet Kartlar */}
        <SimpleGrid cols={3}>
          <Paper withBorder p="sm" radius="md">
            <Text size="xs" c="dimmed">
              Toplam Fatura
            </Text>
            <Text fw={700} size="xl">
              {formatMoney(faturaBazliData.ozet.toplam_tutar)}
            </Text>
          </Paper>
          <Paper withBorder p="sm" radius="md">
            <Text size="xs" c="dimmed">
              Ödenen
            </Text>
            <Text fw={700} size="xl" c="green">
              {formatMoney(faturaBazliData.ozet.odenen_tutar)}
            </Text>
          </Paper>
          <Paper withBorder p="sm" radius="md">
            <Text size="xs" c="dimmed">
              Kalan
            </Text>
            <Text fw={700} size="xl" c="red">
              {formatMoney(faturaBazliData.ozet.kalan_tutar)}
            </Text>
          </Paper>
        </SimpleGrid>

        {/* Fatura Listesi */}
        <ScrollArea h={350}>
          <Stack gap="xs">
            {faturaBazliData.faturalar.map((f: any) => (
              <Paper
                key={f.id}
                withBorder
                p="sm"
                radius="md"
                style={{ cursor: 'pointer' }}
                onClick={() => setExpandedFatura(expandedFatura === f.id ? null : f.id)}
              >
                <Group justify="space-between">
                  <Group>
                    <ThemeIcon
                      size="lg"
                      radius="md"
                      variant="light"
                      color={f.odeme_durumu === 'kapali' ? 'green' : f.odeme_durumu === 'kismi' ? 'yellow' : 'red'}
                    >
                      {f.odeme_durumu === 'kapali' ? (
                        <IconCheck size={18} />
                      ) : f.odeme_durumu === 'kismi' ? (
                        <IconClock size={18} />
                      ) : (
                        <IconAlertTriangle size={18} />
                      )}
                    </ThemeIcon>
                    <div>
                      <Group gap="xs">
                        <Text fw={600}>{f.invoice_number}</Text>
                        <Badge size="xs" color={f.fatura_tipi === 'satis' ? 'blue' : 'orange'}>
                          {f.fatura_tipi === 'satis' ? 'Satış' : 'Alış'}
                        </Badge>
                      </Group>
                      <Text size="xs" c="dimmed">
                        {formatDate(f.fatura_tarihi)}
                        {f.vade_tarihi && ` • Vade: ${formatDate(f.vade_tarihi)}`}
                      </Text>
                    </div>
                  </Group>
                  <Group>
                    <Stack gap={2} align="flex-end">
                      <Text fw={700}>{formatMoney(f.fatura_tutari)}</Text>
                      <Group gap={4}>
                        <Text size="xs" c="green">
                          Ödenen: {formatMoney(f.odenen_tutar)}
                        </Text>
                        <Text size="xs" c="red">
                          Kalan: {formatMoney(f.kalan_tutar)}
                        </Text>
                      </Group>
                    </Stack>
                    <ActionIcon variant="subtle" color="gray">
                      {expandedFatura === f.id ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
                    </ActionIcon>
                  </Group>
                </Group>

                {/* Progress bar */}
                <Progress
                  value={(f.odenen_tutar / f.fatura_tutari) * 100}
                  color={f.odeme_durumu === 'kapali' ? 'green' : f.odeme_durumu === 'kismi' ? 'yellow' : 'gray'}
                  size="sm"
                  mt="xs"
                />

                {/* Ödeme detayları */}
                {expandedFatura === f.id && f.odemeler && f.odemeler.length > 0 && (
                  <Box mt="sm" p="sm" style={{ backgroundColor: 'var(--mantine-color-gray-0)', borderRadius: 8 }}>
                    <Text size="xs" fw={500} mb="xs">
                      Ödemeler:
                    </Text>
                    {f.odemeler.map((o: any, i: number) => (
                      <Group key={i} justify="space-between" mb={4}>
                        <Group gap="xs">
                          <Text size="xs">{formatDate(o.tarih)}</Text>
                          {o.belge_no && (
                            <Badge size="xs" variant="outline">
                              {o.belge_no}
                            </Badge>
                          )}
                        </Group>
                        <Text size="xs" fw={500} c="green">
                          {formatMoney(o.tutar)}
                        </Text>
                      </Group>
                    ))}
                  </Box>
                )}
              </Paper>
            ))}

            {faturaBazliData.faturalar.length === 0 && (
              <Alert color="gray" variant="light">
                Bu cariye ait fatura bulunmamaktadır
              </Alert>
            )}
          </Stack>
        </ScrollArea>
      </Stack>
    );
  };

  const renderDonemselTab = () => {
    if (!donemselData) return <Text c="dimmed">Veri yükleniyor...</Text>;

    return (
      <Stack gap="md">
        {/* Dönem Başlığı */}
        <Paper withBorder p="md" radius="md" bg="blue.0">
          <Group justify="center">
            <Title order={3}>
              📅 {donemselData.donem.ay_adi} {donemselData.donem.yil} Mutabakatı
            </Title>
          </Group>
        </Paper>

        {/* Mutabakat Tablosu */}
        <Paper withBorder p="lg" radius="md">
          <Table verticalSpacing="md">
            <Table.Tbody>
              <Table.Tr>
                <Table.Td>
                  <Text fw={500}>Dönem Başı Bakiye</Text>
                </Table.Td>
                <Table.Td ta="right" fw={600} c={donemselData.acilis_bakiyesi >= 0 ? 'green' : 'red'}>
                  {formatMoney(donemselData.acilis_bakiyesi)}
                </Table.Td>
              </Table.Tr>

              <Table.Tr>
                <Table.Td colSpan={2}>
                  <Divider label="Dönem İçi Hareketler" labelPosition="center" />
                </Table.Td>
              </Table.Tr>

              <Table.Tr>
                <Table.Td>
                  <Group gap="xs">
                    <Badge color="blue" variant="light">
                      {donemselData.satis_faturalari.adet}
                    </Badge>
                    (+) Satış Faturaları
                  </Group>
                </Table.Td>
                <Table.Td ta="right" c="blue">
                  {formatMoney(donemselData.satis_faturalari.toplam)}
                </Table.Td>
              </Table.Tr>

              <Table.Tr>
                <Table.Td>
                  <Group gap="xs">
                    <Badge color="orange" variant="light">
                      {donemselData.alis_faturalari.adet}
                    </Badge>
                    (-) Alış Faturaları
                  </Group>
                </Table.Td>
                <Table.Td ta="right" c="orange">
                  {formatMoney(donemselData.alis_faturalari.toplam)}
                </Table.Td>
              </Table.Tr>

              <Table.Tr>
                <Table.Td>
                  <Group gap="xs">
                    <Badge color="green" variant="light">
                      {donemselData.tahsilatlar.adet}
                    </Badge>
                    (-) Tahsilatlar
                  </Group>
                </Table.Td>
                <Table.Td ta="right" c="green">
                  {formatMoney(donemselData.tahsilatlar.toplam)}
                </Table.Td>
              </Table.Tr>

              <Table.Tr>
                <Table.Td>
                  <Group gap="xs">
                    <Badge color="red" variant="light">
                      {donemselData.odemeler.adet}
                    </Badge>
                    (+) Ödemeler
                  </Group>
                </Table.Td>
                <Table.Td ta="right" c="red">
                  {formatMoney(donemselData.odemeler.toplam)}
                </Table.Td>
              </Table.Tr>

              <Table.Tr style={{ backgroundColor: 'var(--mantine-color-gray-0)' }}>
                <Table.Td>
                  <Text fw={700} size="lg">
                    DÖNEM SONU BAKİYE
                  </Text>
                </Table.Td>
                <Table.Td ta="right">
                  <Text fw={700} size="xl" c={donemselData.kapanis_bakiyesi >= 0 ? 'green' : 'red'}>
                    {formatMoney(donemselData.kapanis_bakiyesi)}
                  </Text>
                  <Badge mt="xs" color={donemselData.kapanis_bakiyesi >= 0 ? 'green' : 'red'}>
                    {donemselData.kapanis_bakiyesi >= 0 ? 'Alacaklı' : 'Borçlu'}
                  </Badge>
                </Table.Td>
              </Table.Tr>
            </Table.Tbody>
          </Table>
        </Paper>
      </Stack>
    );
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="sm">
          <ThemeIcon color="teal" variant="light" size="lg">
            <IconFileInvoice size={20} />
          </ThemeIcon>
          <div>
            <Text fw={600}>Cari Mutabakat</Text>
            <Text size="xs" c="dimmed">
              {cari?.unvan}
            </Text>
          </div>
        </Group>
      }
      size="xl"
      padding="lg"
    >
      <Stack gap="md">
        {/* Dönem Seçimi */}
        <Group>
          <Select label="Ay" data={aylar} value={selectedAy} onChange={(v) => setSelectedAy(v || '1')} w={120} />
          <Select
            label="Yıl"
            data={yillar}
            value={selectedYil}
            onChange={(v) => setSelectedYil(v || String(new Date().getFullYear()))}
            w={100}
          />
          <Group mt="xl">
            <Button variant="light" leftSection={<IconDownload size={16} />} color="blue">
              PDF
            </Button>
            <Button variant="light" leftSection={<IconPrinter size={16} />} color="gray">
              Yazdır
            </Button>
            <Button variant="light" leftSection={<IconMail size={16} />} color="violet">
              E-posta Gönder
            </Button>
          </Group>
        </Group>

        {/* Tab'lar */}
        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Tab value="ekstre" leftSection={<IconList size={16} />}>
              Ekstre
            </Tabs.Tab>
            <Tabs.Tab value="fatura-bazli" leftSection={<IconFileInvoice size={16} />}>
              Fatura Bazlı
            </Tabs.Tab>
            <Tabs.Tab value="donemsel" leftSection={<IconCalendar size={16} />}>
              Dönemsel
            </Tabs.Tab>
          </Tabs.List>

          <Box mt="md" pos="relative" mih={400}>
            {loading && (
              <Box
                pos="absolute"
                top={0}
                left={0}
                right={0}
                bottom={0}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(255,255,255,0.8)',
                  zIndex: 10,
                }}
              >
                <Loader />
              </Box>
            )}

            <Tabs.Panel value="ekstre">{renderEkstreTab()}</Tabs.Panel>

            <Tabs.Panel value="fatura-bazli">{renderFaturaBazliTab()}</Tabs.Panel>

            <Tabs.Panel value="donemsel">{renderDonemselTab()}</Tabs.Panel>
          </Box>
        </Tabs>

        {/* Mutabakat Onay Alanı - Sadece Bakiye Teyidi */}
        <Divider my="md" />
        <Paper p="md" radius="md" className="nested-card">
          <Group justify="space-between">
            <Stack gap={4}>
              <Text size="sm" fw={600}>
                📋 Bakiye Durumu
              </Text>
              <Text size="xs" c="dimmed">
                Bu cari ile {aylar.find((a) => a.value === selectedAy)?.label} {selectedYil} dönemi bakiyesi
              </Text>
            </Stack>
            <Paper withBorder p="md" radius="md" bg="white">
              <Text size="xs" c="dimmed" ta="center">
                Kapanış Bakiyesi
              </Text>
              <Text fw={700} size="xl" c={ekstreData?.kapanis_bakiyesi >= 0 ? 'teal.7' : 'red.7'} ta="center">
                {formatMoney(ekstreData?.kapanis_bakiyesi || 0)}
              </Text>
              <Text size="xs" c="dimmed" ta="center">
                {(ekstreData?.kapanis_bakiyesi || 0) < 0 ? '(Borcunuz var)' : '(Alacağınız var)'}
              </Text>
            </Paper>
          </Group>

          <Divider my="md" />

          <Group justify="flex-end">
            <Button
              variant="outline"
              color="red"
              leftSection={<IconX size={16} />}
              onClick={() => {
                notifications.show({
                  title: 'Uyuşmazlık',
                  message: 'Bakiye tutmuyor olarak işaretlendi',
                  color: 'red',
                });
              }}
            >
              Uyuşmazlık Bildir
            </Button>
            <Button
              color="green"
              leftSection={<IconCheck size={16} />}
              onClick={() => {
                notifications.show({
                  title: 'Mutabakat Onaylandı',
                  message: `${cari?.unvan} ile bakiye teyit edildi`,
                  color: 'green',
                  icon: <IconCheck size={16} />,
                });
                onClose();
              }}
            >
              Bakiyeyi Onayla
            </Button>
          </Group>
        </Paper>
      </Stack>
    </Modal>
  );
}
