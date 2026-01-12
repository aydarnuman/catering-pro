'use client';

import { useState, useEffect } from 'react';
import {
  Container,
  Title,
  Text,
  Card,
  Button,
  Stack,
  Group,
  Badge,
  Box,
  SimpleGrid,
  ThemeIcon,
  Paper,
  Menu,
  ActionIcon,
  Modal,
  Textarea,
  Select,
  Divider,
  Alert,
  Tooltip,
  TextInput,
  Tabs,
  ScrollArea,
  Table
} from '@mantine/core';
import {
  IconBookmark,
  IconCalendar,
  IconCoin,
  IconBuilding,
  IconDotsVertical,
  IconTrash,
  IconEye,
  IconNote,
  IconClock,
  IconCheck,
  IconX,
  IconAlertCircle,
  IconSearch,
  IconFilter,
  IconFileAnalytics,
  IconChevronRight,
  IconDownload,
  IconSettings,
  IconClipboardList,
  IconReceipt
} from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import TeklifModal from '@/components/teklif/TeklifModal';

interface AnalysisData {
  ihale_basligi?: string;
  kurum?: string;
  tarih?: string;
  bedel?: string;
  sure?: string;
  teknik_sartlar?: string[];
  birim_fiyatlar?: any[];
  notlar?: string[];
  tam_metin?: string;
  iletisim?: any;
}

interface SavedTender {
  id: string;
  ihale_basligi: string;
  kurum: string;
  tarih: string;
  bedel: string;
  sure: string;
  status: 'bekliyor' | 'basvuruldu' | 'kazanildi' | 'kaybedildi' | 'iptal';
  notlar: string;
  created_at: string;
  dokuman_sayisi: number;
  teknik_sart_sayisi: number;
  birim_fiyat_sayisi: number;
  analiz_data?: AnalysisData;
}

const statusConfig = {
  bekliyor: { color: 'yellow', label: 'Bekliyor', icon: IconClock },
  basvuruldu: { color: 'blue', label: 'Başvuruldu', icon: IconFileAnalytics },
  kazanildi: { color: 'green', label: 'Kazanıldı', icon: IconCheck },
  kaybedildi: { color: 'red', label: 'Kaybedildi', icon: IconX },
  iptal: { color: 'gray', label: 'İptal Edildi', icon: IconX },
};

export default function TrackingPage() {
  const [tenders, setTenders] = useState<SavedTender[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTender, setSelectedTender] = useState<SavedTender | null>(null);
  const [detailOpened, { open: openDetail, close: closeDetail }] = useDisclosure(false);
  const [teklifOpened, { open: openTeklif, close: closeTeklif }] = useDisclosure(false);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [userNote, setUserNote] = useState('');

  // LocalStorage'dan verileri yükle
  useEffect(() => {
    const saved = localStorage.getItem('savedTenders');
    if (saved) {
      setTenders(JSON.parse(saved));
    }
    setLoading(false);
  }, []);

  // Verileri kaydet
  const saveTenders = (newTenders: SavedTender[]) => {
    localStorage.setItem('savedTenders', JSON.stringify(newTenders));
    setTenders(newTenders);
  };

  // Durum güncelle
  const updateStatus = (id: string, newStatus: SavedTender['status']) => {
    const updated = tenders.map(t => 
      t.id === id ? { ...t, status: newStatus } : t
    );
    saveTenders(updated);
    if (selectedTender?.id === id) {
      setSelectedTender({ ...selectedTender, status: newStatus });
    }
    notifications.show({
      title: 'Durum Güncellendi',
      message: `İhale durumu "${statusConfig[newStatus].label}" olarak değiştirildi`,
      color: statusConfig[newStatus].color,
    });
  };

  // Not güncelle
  const updateNote = (id: string, note: string) => {
    const updated = tenders.map(t => 
      t.id === id ? { ...t, notlar: note } : t
    );
    saveTenders(updated);
    if (selectedTender?.id === id) {
      setSelectedTender({ ...selectedTender, notlar: note });
    }
    notifications.show({
      title: 'Not Kaydedildi',
      message: 'İhale notu güncellendi',
      color: 'green',
    });
  };

  // İhale sil
  const deleteTender = (id: string) => {
    const updated = tenders.filter(t => t.id !== id);
    saveTenders(updated);
    closeDetail();
    notifications.show({
      title: 'İhale Silindi',
      message: 'İhale takip listesinden kaldırıldı',
      color: 'red',
    });
  };

  // JSON indir
  const downloadJSON = (tender: SavedTender) => {
    const exportData = {
      ihale_bilgileri: {
        baslik: tender.ihale_basligi,
        kurum: tender.kurum,
        tarih: tender.tarih,
        bedel: tender.bedel,
        sure: tender.sure,
        durum: statusConfig[tender.status].label
      },
      analiz_data: tender.analiz_data,
      kullanici_notu: tender.notlar,
      kayit_tarihi: tender.created_at
    };
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ihale-${tender.id}.json`;
    link.click();
  };

  // Detay modalı açıldığında notu yükle
  const handleOpenDetail = (tender: SavedTender) => {
    setSelectedTender(tender);
    setUserNote(tender.notlar || '');
    openDetail();
  };

  // Filtreleme
  const filteredTenders = tenders.filter(t => {
    const matchesStatus = !filterStatus || t.status === filterStatus;
    const matchesSearch = !searchQuery || 
      t.ihale_basligi?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.kurum?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // İstatistikler
  const stats = {
    toplam: tenders.length,
    bekliyor: tenders.filter(t => t.status === 'bekliyor').length,
    basvuruldu: tenders.filter(t => t.status === 'basvuruldu').length,
    kazanildi: tenders.filter(t => t.status === 'kazanildi').length,
  };

  // Kalan gün hesapla
  const getDaysRemaining = (dateStr: string) => {
    if (!dateStr) return null;
    try {
      const parts = dateStr.match(/(\d{1,2})[./](\d{1,2})[./](\d{4})/);
      if (!parts) return null;
      const date = new Date(parseInt(parts[3]), parseInt(parts[2]) - 1, parseInt(parts[1]));
      const today = new Date();
      const diff = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return diff;
    } catch {
      return null;
    }
  };

  // Analiz verilerini al
  const getAnalysisData = (tender: SavedTender): AnalysisData => {
    if (tender.analiz_data) {
      return tender.analiz_data;
    }
    return {
      ihale_basligi: tender.ihale_basligi,
      kurum: tender.kurum,
      tarih: tender.tarih,
      bedel: tender.bedel,
      sure: tender.sure,
      teknik_sartlar: [],
      birim_fiyatlar: [],
      notlar: [],
      tam_metin: ''
    };
  };

  if (loading) {
    return (
      <Container size="xl" py="xl">
        <Text>Yükleniyor...</Text>
      </Container>
    );
  }

  return (
    <Box style={{ background: 'linear-gradient(180deg, rgba(59,130,246,0.05) 0%, rgba(255,255,255,0) 100%)', minHeight: '100vh' }}>
      <Container size="xl" py="xl">
        <Stack gap="xl">
          {/* Header */}
          <Group justify="space-between" align="flex-start">
            <div>
              <Group gap="sm" mb="xs">
                <ThemeIcon size={44} radius="md" variant="gradient" gradient={{ from: 'blue', to: 'cyan' }}>
                  <IconBookmark size={26} />
                </ThemeIcon>
                <div>
                  <Title order={1}>İhale Takibim</Title>
                  <Text c="dimmed">Kaydettiğiniz ihaleleri takip edin</Text>
                </div>
              </Group>
            </div>
          </Group>

          {/* İstatistik Kartları */}
          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
            <Paper p="md" radius="md" withBorder>
              <Group justify="space-between">
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Toplam</Text>
                  <Text size="xl" fw={700}>{stats.toplam}</Text>
                </div>
                <ThemeIcon size={40} radius="md" variant="light" color="gray">
                  <IconBookmark size={22} />
                </ThemeIcon>
              </Group>
            </Paper>
            <Paper p="md" radius="md" withBorder style={{ borderColor: 'var(--mantine-color-yellow-5)' }}>
              <Group justify="space-between">
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Bekliyor</Text>
                  <Text size="xl" fw={700} c="yellow">{stats.bekliyor}</Text>
                </div>
                <ThemeIcon size={40} radius="md" variant="light" color="yellow">
                  <IconClock size={22} />
                </ThemeIcon>
              </Group>
            </Paper>
            <Paper p="md" radius="md" withBorder style={{ borderColor: 'var(--mantine-color-blue-5)' }}>
              <Group justify="space-between">
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Başvuruldu</Text>
                  <Text size="xl" fw={700} c="blue">{stats.basvuruldu}</Text>
                </div>
                <ThemeIcon size={40} radius="md" variant="light" color="blue">
                  <IconFileAnalytics size={22} />
                </ThemeIcon>
              </Group>
            </Paper>
            <Paper p="md" radius="md" withBorder style={{ borderColor: 'var(--mantine-color-green-5)' }}>
              <Group justify="space-between">
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Kazanıldı</Text>
                  <Text size="xl" fw={700} c="green">{stats.kazanildi}</Text>
                </div>
                <ThemeIcon size={40} radius="md" variant="light" color="green">
                  <IconCheck size={22} />
                </ThemeIcon>
              </Group>
            </Paper>
          </SimpleGrid>

          {/* Filtreler */}
          <Paper p="md" radius="md" withBorder>
            <Group>
              <TextInput
                placeholder="İhale ara..."
                leftSection={<IconSearch size={16} />}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ flex: 1 }}
              />
              <Select
                placeholder="Durum filtrele"
                leftSection={<IconFilter size={16} />}
                clearable
                value={filterStatus}
                onChange={setFilterStatus}
                data={[
                  { value: 'bekliyor', label: '🟡 Bekliyor' },
                  { value: 'basvuruldu', label: '🔵 Başvuruldu' },
                  { value: 'kazanildi', label: '🟢 Kazanıldı' },
                  { value: 'kaybedildi', label: '🔴 Kaybedildi' },
                  { value: 'iptal', label: '⚫ İptal' },
                ]}
                w={180}
              />
            </Group>
          </Paper>

          {/* İhale Kartları */}
          {filteredTenders.length === 0 ? (
            <Alert icon={<IconAlertCircle size={16} />} title="Henüz ihale yok" color="gray">
              {tenders.length === 0 
                ? 'Henüz kaydettiğiniz bir ihale bulunmuyor. Yükle & Analiz sayfasından döküman yükleyip "Kaydet" butonuna tıklayarak ihale ekleyebilirsiniz.'
                : 'Filtrelere uygun ihale bulunamadı.'}
            </Alert>
          ) : (
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
              {filteredTenders.map((tender) => {
                const daysRemaining = getDaysRemaining(tender.tarih);
                const isUrgent = daysRemaining !== null && daysRemaining <= 7 && daysRemaining >= 0;
                const isPast = daysRemaining !== null && daysRemaining < 0;
                const StatusIcon = statusConfig[tender.status].icon;

                return (
                  <Card 
                    key={tender.id} 
                    shadow="sm" 
                    padding="lg" 
                    radius="md" 
                    withBorder
                    style={{
                      borderColor: isUrgent ? 'var(--mantine-color-red-5)' : undefined,
                      borderWidth: isUrgent ? 2 : 1,
                    }}
                  >
                    {/* Üst Kısım - Durum ve Menü */}
                    <Group justify="space-between" mb="md">
                      <Badge 
                        color={statusConfig[tender.status].color} 
                        variant="light"
                        leftSection={<StatusIcon size={12} />}
                      >
                        {statusConfig[tender.status].label}
                      </Badge>
                      <Menu shadow="md" width={180}>
                        <Menu.Target>
                          <ActionIcon variant="subtle" color="gray">
                            <IconDotsVertical size={18} />
                          </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                          <Menu.Label>Durum Değiştir</Menu.Label>
                          <Menu.Item 
                            leftSection={<IconClock size={14} />}
                            onClick={() => updateStatus(tender.id, 'bekliyor')}
                          >
                            Bekliyor
                          </Menu.Item>
                          <Menu.Item 
                            leftSection={<IconFileAnalytics size={14} />}
                            onClick={() => updateStatus(tender.id, 'basvuruldu')}
                          >
                            Başvuruldu
                          </Menu.Item>
                          <Menu.Item 
                            leftSection={<IconCheck size={14} />}
                            color="green"
                            onClick={() => updateStatus(tender.id, 'kazanildi')}
                          >
                            Kazanıldı
                          </Menu.Item>
                          <Menu.Item 
                            leftSection={<IconX size={14} />}
                            color="red"
                            onClick={() => updateStatus(tender.id, 'kaybedildi')}
                          >
                            Kaybedildi
                          </Menu.Item>
                          <Menu.Divider />
                          <Menu.Item 
                            leftSection={<IconEye size={14} />}
                            onClick={() => handleOpenDetail(tender)}
                          >
                            Detayları Gör
                          </Menu.Item>
                          <Menu.Divider />
                          <Menu.Item 
                            leftSection={<IconTrash size={14} />}
                            color="red"
                            onClick={() => deleteTender(tender.id)}
                          >
                            Sil
                          </Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                    </Group>

                    {/* Başlık */}
                    <Text fw={600} size="lg" lineClamp={2} mb="sm">
                      {tender.ihale_basligi || 'İsimsiz İhale'}
                    </Text>

                    {/* Kurum */}
                    {tender.kurum && (
                      <Group gap="xs" mb="xs">
                        <IconBuilding size={16} color="var(--mantine-color-gray-6)" />
                        <Text size="sm" c="dimmed" lineClamp={1}>{tender.kurum}</Text>
                      </Group>
                    )}

                    {/* Tarih */}
                    {tender.tarih && (
                      <Group gap="xs" mb="xs">
                        <IconCalendar size={16} color="var(--mantine-color-gray-6)" />
                        <Text size="sm" c="dimmed">{tender.tarih}</Text>
                        {daysRemaining !== null && (
                          <Badge 
                            size="sm" 
                            color={isPast ? 'gray' : isUrgent ? 'red' : 'blue'}
                            variant="light"
                          >
                            {isPast 
                              ? 'Geçmiş' 
                              : daysRemaining === 0 
                                ? 'Bugün!' 
                                : `${daysRemaining} gün`}
                          </Badge>
                        )}
                      </Group>
                    )}

                    {/* Bedel */}
                    {tender.bedel && (
                      <Group gap="xs" mb="md">
                        <IconCoin size={16} color="var(--mantine-color-green-6)" />
                        <Text size="sm" fw={600} c="green">{tender.bedel}</Text>
                      </Group>
                    )}

                    <Divider my="sm" />

                    {/* Alt Bilgiler */}
                    <Group justify="space-between">
                      <Group gap="xs">
                        {tender.teknik_sart_sayisi > 0 && (
                          <Tooltip label="Teknik Şart">
                            <Badge size="sm" variant="dot" color="blue">
                              {tender.teknik_sart_sayisi} şart
                            </Badge>
                          </Tooltip>
                        )}
                        {tender.birim_fiyat_sayisi > 0 && (
                          <Tooltip label="Birim Fiyat">
                            <Badge size="sm" variant="dot" color="green">
                              {tender.birim_fiyat_sayisi} kalem
                            </Badge>
                          </Tooltip>
                        )}
                      </Group>
                      <Button 
                        variant="light" 
                        size="xs"
                        rightSection={<IconChevronRight size={14} />}
                        onClick={() => handleOpenDetail(tender)}
                      >
                        Detay
                      </Button>
                    </Group>

                    {/* Not varsa göster */}
                    {tender.notlar && (
                      <Paper p="xs" mt="sm" bg="gray.0" radius="sm">
                        <Group gap="xs">
                          <IconNote size={14} color="var(--mantine-color-orange-6)" />
                          <Text size="xs" c="dimmed" lineClamp={2}>{tender.notlar}</Text>
                        </Group>
                      </Paper>
                    )}
                  </Card>
                );
              })}
            </SimpleGrid>
          )}
        </Stack>
      </Container>

      {/* Detay Modal */}
      <Modal 
        opened={detailOpened} 
        onClose={closeDetail} 
        title={<Text fw={600} size="lg">📋 İhale Detayı</Text>}
        size="xl"
        centered
      >
        {selectedTender && (() => {
          const analysisData = getAnalysisData(selectedTender);
          
          return (
            <Stack gap="md">
              {/* Üst Bar - Durum ve Aksiyonlar */}
              <Group justify="space-between">
                <Select
                  value={selectedTender.status}
                  onChange={(value) => value && updateStatus(selectedTender.id, value as SavedTender['status'])}
                  data={[
                    { value: 'bekliyor', label: '🟡 Bekliyor' },
                    { value: 'basvuruldu', label: '🔵 Başvuruldu' },
                    { value: 'kazanildi', label: '🟢 Kazanıldı' },
                    { value: 'kaybedildi', label: '🔴 Kaybedildi' },
                    { value: 'iptal', label: '⚫ İptal' },
                  ]}
                  w={160}
                />
                <Group gap="xs">
                  <Button 
                    variant="gradient"
                    gradient={{ from: 'teal', to: 'cyan' }}
                    size="xs"
                    leftSection={<IconReceipt size={14} />}
                    onClick={() => {
                      closeDetail();
                      openTeklif();
                    }}
                  >
                    Teklif Oluştur
                  </Button>
                  <Button 
                    variant="light" 
                    size="xs"
                    leftSection={<IconDownload size={14} />}
                    onClick={() => downloadJSON(selectedTender)}
                  >
                    JSON
                  </Button>
                  <Button 
                    variant="light" 
                    color="red"
                    size="xs"
                    leftSection={<IconTrash size={14} />}
                    onClick={() => deleteTender(selectedTender.id)}
                  >
                    Sil
                  </Button>
                </Group>
              </Group>

              {/* Özet Kartları */}
              <Box p="md" bg="gray.0" style={{ borderRadius: 'var(--mantine-radius-md)' }}>
                <SimpleGrid cols={{ base: 2, sm: 3, md: 5 }} spacing="md">
                  <Paper p="sm" withBorder radius="md">
                    <Text size="xs" c="dimmed" tt="uppercase" fw={600}>İhale Başlığı</Text>
                    <Text size="sm" fw={500} lineClamp={2}>{selectedTender.ihale_basligi || '-'}</Text>
                  </Paper>
                  <Paper p="sm" withBorder radius="md">
                    <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Kurum</Text>
                    <Text size="sm" fw={500} lineClamp={2}>{selectedTender.kurum || '-'}</Text>
                  </Paper>
                  <Paper p="sm" withBorder radius="md">
                    <Text size="xs" c="dimmed" tt="uppercase" fw={600}>İhale Tarihi</Text>
                    <Text size="sm" fw={500}>{selectedTender.tarih || '-'}</Text>
                  </Paper>
                  <Paper p="sm" withBorder radius="md" style={{ borderColor: 'var(--mantine-color-green-5)' }}>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Tahmini Bedel</Text>
                    <Text size="sm" fw={700} c="green">{selectedTender.bedel || '-'}</Text>
                  </Paper>
                  <Paper p="sm" withBorder radius="md">
                    <Text size="xs" c="dimmed" tt="uppercase" fw={600}>İş Süresi</Text>
                    <Text size="sm" fw={500}>{selectedTender.sure || '-'}</Text>
                  </Paper>
                </SimpleGrid>
              </Box>

              {/* Sekmeli İçerik */}
              <Tabs defaultValue="teknik" variant="outline">
                <Tabs.List grow>
                  <Tabs.Tab value="teknik" leftSection={<IconSettings size={16} />}>
                    Teknik Şartlar ({analysisData.teknik_sartlar?.length || 0})
                  </Tabs.Tab>
                  <Tabs.Tab value="fiyat" leftSection={<IconCoin size={16} />}>
                    Birim Fiyatlar ({analysisData.birim_fiyatlar?.length || 0})
                  </Tabs.Tab>
                  <Tabs.Tab value="ainotlar" leftSection={<IconNote size={16} />}>
                    AI Notları ({analysisData.notlar?.length || 0})
                  </Tabs.Tab>
                  <Tabs.Tab value="metin" leftSection={<IconClipboardList size={16} />}>
                    Tam Metin
                  </Tabs.Tab>
                </Tabs.List>

                {/* Teknik Şartlar */}
                <Tabs.Panel value="teknik" pt="md">
                  {analysisData.teknik_sartlar && analysisData.teknik_sartlar.length > 0 ? (
                    <ScrollArea h={250} type="auto" offsetScrollbars>
                      <Stack gap="xs">
                        {analysisData.teknik_sartlar.map((sart, i) => (
                          <Paper key={i} p="sm" withBorder radius="sm" bg="gray.0">
                            <Group gap="xs" wrap="nowrap">
                              <Badge size="sm" variant="light" color="blue" circle>{i + 1}</Badge>
                              <Text size="sm">{sart}</Text>
                            </Group>
                          </Paper>
                        ))}
                      </Stack>
                    </ScrollArea>
                  ) : (
                    <Text c="dimmed" ta="center" py="xl">Teknik şart bulunamadı</Text>
                  )}
                </Tabs.Panel>

                {/* Birim Fiyatlar */}
                <Tabs.Panel value="fiyat" pt="md">
                  {analysisData.birim_fiyatlar && analysisData.birim_fiyatlar.length > 0 ? (
                    <ScrollArea h={250} type="auto" offsetScrollbars>
                      <Table striped highlightOnHover withTableBorder>
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th w={50}>#</Table.Th>
                            <Table.Th>Kalem / Açıklama</Table.Th>
                            <Table.Th>Birim</Table.Th>
                            <Table.Th>Miktar</Table.Th>
                            <Table.Th ta="right">Fiyat</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {analysisData.birim_fiyatlar.map((item: any, i) => (
                            <Table.Tr key={i}>
                              <Table.Td>{i + 1}</Table.Td>
                              <Table.Td>{item.kalem || item.aciklama || item.urun || '-'}</Table.Td>
                              <Table.Td>{item.birim || '-'}</Table.Td>
                              <Table.Td>{item.miktar || '-'}</Table.Td>
                              <Table.Td ta="right">
                                <Badge color="green" variant="light">
                                  {item.fiyat || item.tutar || item.birim_fiyat || '-'}
                                </Badge>
                              </Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>
                    </ScrollArea>
                  ) : (
                    <Text c="dimmed" ta="center" py="xl">Birim fiyat bulunamadı</Text>
                  )}
                </Tabs.Panel>

                {/* AI Notları */}
                <Tabs.Panel value="ainotlar" pt="md">
                  {analysisData.notlar && analysisData.notlar.length > 0 ? (
                    <ScrollArea h={250} type="auto" offsetScrollbars>
                      <Stack gap="xs">
                        {analysisData.notlar.map((not, i) => (
                          <Paper key={i} p="sm" withBorder radius="sm">
                            <Group gap="xs" wrap="nowrap" align="flex-start">
                              <ThemeIcon size="sm" color="orange" variant="light" mt={2}>
                                <IconNote size={12} />
                              </ThemeIcon>
                              <Text size="sm">{not}</Text>
                            </Group>
                          </Paper>
                        ))}
                      </Stack>
                    </ScrollArea>
                  ) : (
                    <Text c="dimmed" ta="center" py="xl">AI notu bulunamadı</Text>
                  )}
                </Tabs.Panel>

                {/* Tam Metin */}
                <Tabs.Panel value="metin" pt="md">
                  {analysisData.tam_metin ? (
                    <ScrollArea h={250} type="auto" offsetScrollbars>
                      <Paper p="md" withBorder bg="gray.0">
                        <Text size="sm" style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                          {analysisData.tam_metin}
                        </Text>
                      </Paper>
                    </ScrollArea>
                  ) : (
                    <Text c="dimmed" ta="center" py="xl">Tam metin bulunamadı</Text>
                  )}
                </Tabs.Panel>
              </Tabs>

              <Divider />

              {/* Kullanıcı Notu */}
              <Box>
                <Text size="sm" fw={600} mb="xs">📝 Kendi Notlarım</Text>
                <Textarea
                  placeholder="Bu ihale hakkında notlarınız..."
                  minRows={3}
                  value={userNote}
                  onChange={(e) => setUserNote(e.target.value)}
                />
                <Group justify="flex-end" mt="sm">
                  <Button 
                    size="sm"
                    onClick={() => updateNote(selectedTender.id, userNote)}
                    disabled={userNote === selectedTender.notlar}
                  >
                    Notu Kaydet
                  </Button>
                </Group>
              </Box>

              {/* Alt Bilgi */}
              <Text size="xs" c="dimmed" ta="right">
                Kaydedilme: {new Date(selectedTender.created_at).toLocaleDateString('tr-TR', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </Text>
            </Stack>
          );
        })()}
      </Modal>

      {/* Teklif Modal */}
      {selectedTender && (
        <TeklifModal
          opened={teklifOpened}
          onClose={closeTeklif}
          ihaleBasligi={selectedTender.ihale_basligi || 'İsimsiz İhale'}
          ihaleBedeli={selectedTender.bedel}
          birimFiyatlar={selectedTender.analiz_data?.birim_fiyatlar}
        />
      )}
    </Box>
  );
}
