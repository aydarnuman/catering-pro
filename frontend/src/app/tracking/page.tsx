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
  Progress,
  Alert,
  Tooltip,
  TextInput
} from '@mantine/core';
import {
  IconBookmark,
  IconCalendar,
  IconCoin,
  IconBuilding,
  IconDotsVertical,
  IconTrash,
  IconEdit,
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
  IconDownload
} from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';

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
  const [noteOpened, { open: openNote, close: closeNote }] = useDisclosure(false);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

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
    closeNote();
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
    notifications.show({
      title: 'İhale Silindi',
      message: 'İhale takip listesinden kaldırıldı',
      color: 'red',
    });
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
                            leftSection={<IconNote size={14} />}
                            onClick={() => {
                              setSelectedTender(tender);
                              openNote();
                            }}
                          >
                            Not Ekle
                          </Menu.Item>
                          <Menu.Item 
                            leftSection={<IconEye size={14} />}
                            onClick={() => {
                              setSelectedTender(tender);
                              openDetail();
                            }}
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
                        onClick={() => {
                          setSelectedTender(tender);
                          openDetail();
                        }}
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
        title={<Text fw={600}>İhale Detayı</Text>}
        size="lg"
      >
        {selectedTender && (
          <Stack gap="md">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase">İhale Başlığı</Text>
              <Text fw={500}>{selectedTender.ihale_basligi || '-'}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed" tt="uppercase">Kurum</Text>
              <Text>{selectedTender.kurum || '-'}</Text>
            </div>
            <Group grow>
              <div>
                <Text size="xs" c="dimmed" tt="uppercase">Tarih</Text>
                <Text>{selectedTender.tarih || '-'}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed" tt="uppercase">Bedel</Text>
                <Text c="green" fw={600}>{selectedTender.bedel || '-'}</Text>
              </div>
            </Group>
            <Group grow>
              <div>
                <Text size="xs" c="dimmed" tt="uppercase">Süre</Text>
                <Text>{selectedTender.sure || '-'}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed" tt="uppercase">Durum</Text>
                <Badge color={statusConfig[selectedTender.status].color}>
                  {statusConfig[selectedTender.status].label}
                </Badge>
              </div>
            </Group>
            <Divider />
            <Group grow>
              <Paper p="sm" withBorder ta="center">
                <Text size="xl" fw={700} c="blue">{selectedTender.teknik_sart_sayisi || 0}</Text>
                <Text size="xs" c="dimmed">Teknik Şart</Text>
              </Paper>
              <Paper p="sm" withBorder ta="center">
                <Text size="xl" fw={700} c="green">{selectedTender.birim_fiyat_sayisi || 0}</Text>
                <Text size="xs" c="dimmed">Birim Fiyat</Text>
              </Paper>
              <Paper p="sm" withBorder ta="center">
                <Text size="xl" fw={700} c="orange">{selectedTender.dokuman_sayisi || 0}</Text>
                <Text size="xs" c="dimmed">Döküman</Text>
              </Paper>
            </Group>
            {selectedTender.notlar && (
              <div>
                <Text size="xs" c="dimmed" tt="uppercase">Notlar</Text>
                <Paper p="sm" bg="gray.0" radius="sm">
                  <Text size="sm">{selectedTender.notlar}</Text>
                </Paper>
              </div>
            )}
            <Text size="xs" c="dimmed">
              Kaydedilme: {new Date(selectedTender.created_at).toLocaleDateString('tr-TR')}
            </Text>
          </Stack>
        )}
      </Modal>

      {/* Not Modal */}
      <Modal 
        opened={noteOpened} 
        onClose={closeNote} 
        title={<Text fw={600}>Not Ekle/Düzenle</Text>}
      >
        {selectedTender && (
          <Stack gap="md">
            <Textarea
              label="Not"
              placeholder="Bu ihale hakkında notlarınız..."
              minRows={4}
              defaultValue={selectedTender.notlar}
              id="tender-note"
            />
            <Group justify="flex-end">
              <Button variant="default" onClick={closeNote}>İptal</Button>
              <Button 
                onClick={() => {
                  const noteEl = document.getElementById('tender-note') as HTMLTextAreaElement;
                  updateNote(selectedTender.id, noteEl?.value || '');
                }}
              >
                Kaydet
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Box>
  );
}

