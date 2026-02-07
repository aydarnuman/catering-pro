'use client';

import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Container,
  Divider,
  Group,
  Loader,
  Modal,
  Pagination,
  Paper,
  Progress,
  Rating,
  ScrollArea,
  Select,
  Skeleton,
  Stack,
  Table,
  Tabs,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Title,
  Tooltip,
  useMantineColorScheme,
} from '@mantine/core';
import { useDebouncedValue, useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconAlertTriangle,
  IconBookmark,
  IconBookmarkFilled,
  IconBrain,
  IconBuildingBank,
  IconCalendar,
  IconChartBar,
  IconChartPie,
  IconChevronDown,
  IconChevronUp,
  IconDatabase,
  IconExternalLink,
  IconEye,
  IconFileAlert,
  IconLoader,
  IconMapPin,
  IconRefresh,
  IconSearch,
  IconShieldCheck,
  IconSpy,
  IconTrendingUp,
  IconTrophy,
  IconUsers,
  IconX,
} from '@tabler/icons-react';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getApiUrl } from '@/lib/config';
import type { Yuklenici, AnalyzData, StatsData, ScrapeStatus, SortField } from '@/types/yuklenici';
import { formatCurrency } from '@/types/yuklenici';

// ─── Ana Sayfa ──────────────────────────────────────────────────

export default function YukleniciKutuphanesiPage() {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';
  const searchParams = useSearchParams();

  const [yukleniciler, setYukleniciler] = useState<Yuklenici[]>([]);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams?.get('search') || '');
  const [debouncedSearch] = useDebouncedValue(search, 300);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sortField, setSortField] = useState<SortField>('toplam_sozlesme_bedeli');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [takipteFilter, setTakipteFilter] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false);

  // Scrape state
  const [scrapeStatus, setScrapeStatus] = useState<ScrapeStatus | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const mFetch = useCallback((url: string, opts?: RequestInit) => {
    return fetch(url, { credentials: 'include' as RequestCredentials, headers: { 'Content-Type': 'application/json' }, ...opts });
  }, []);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const fetchYukleniciler = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
        sort: sortField,
        order: sortDir,
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
        ...(takipteFilter ? { takipte: 'true' } : {}),
      });
      const res = await mFetch(getApiUrl(`/contractors?${params}`));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.success) {
        setYukleniciler(json.data);
        setTotalPages(json.totalPages || json.pagination?.totalPages || 1);
      }
    } catch (err) {
      console.error('Yuklenici fetch error:', err);
      notifications.show({ title: 'Hata', message: 'Yuklenici listesi yuklenemedi', color: 'red' });
    } finally {
      setLoading(false);
    }
  }, [page, sortField, sortDir, debouncedSearch, takipteFilter, mFetch]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await mFetch(getApiUrl('/contractors/stats'));
      if (!res.ok) return; // Tablo henüz yoksa sessizce devam et
      const json = await res.json();
      if (json.success) setStats(json.data);
    } catch {
      // Stats yüklenemezse sayfanın çalışmasını engelleme
    }
  }, [mFetch]);

  useEffect(() => {
    fetchYukleniciler();
  }, [fetchYukleniciler]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Sort toggle
  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
    setPage(1);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDir === 'asc' ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />;
  };

  // Takip toggle
  const handleTakipToggle = async (id: number) => {
    try {
      await mFetch(getApiUrl(`/contractors/${id}/toggle-follow`), { method: 'POST' });
      fetchYukleniciler();
    } catch { /* ignore */ }
  };

  // Istihbarat toggle
  const handleIstihbaratToggle = async (id: number) => {
    try {
      await mFetch(getApiUrl(`/contractors/${id}/toggle-istihbarat`), { method: 'POST' });
      fetchYukleniciler();
    } catch { /* ignore */ }
  };

  // Scrape başlat
  const startScrape = async () => {
    try {
      const res = await mFetch(getApiUrl('/contractors/scrape'), { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        notifications.show({ title: 'Tarama Basladi', message: 'ihalebul.com\'dan yukleniciler cekiliyor...', color: 'blue' });
        // Polling başlat
        pollRef.current = setInterval(async () => {
          try {
            const statusRes = await mFetch(getApiUrl('/contractors/scrape/status'));
            const status = await statusRes.json();
            setScrapeStatus(status);
            if (!status.running) {
              if (pollRef.current) clearInterval(pollRef.current);
              pollRef.current = null;
              setScrapeStatus(null);
              fetchYukleniciler();
              fetchStats();
              notifications.show({ title: 'Tamamlandi', message: 'Yuklenici listesi guncellendi', color: 'green' });
            }
          } catch { /* ignore */ }
        }, 2000);
      } else {
        notifications.show({ title: 'Uyari', message: json.error || 'Baslatilamadi', color: 'orange' });
      }
    } catch (err) {
      console.error('Scrape error:', err);
    }
  };

  const openDetail = (id: number) => {
    setSelectedId(id);
    openModal();
  };

  const totalYuklenici = stats?.genel?.toplam_yuklenici || '0';

  return (
    <Container size="xl" py="md">
      {/* Header */}
      <Group justify="space-between" mb="lg">
        <div>
          <Title order={2}>
            <IconUsers size={28} style={{ verticalAlign: 'middle', marginRight: 8 }} />
            Yuklenici Kutuphanesi
          </Title>
          <Text size="sm" c="dimmed">Rakip firma istihbarat merkezi – {totalYuklenici} yuklenici kayitli</Text>
        </div>
        <Group>
          <Button
            leftSection={<IconDatabase size={16} />}
            variant="filled"
            onClick={startScrape}
            loading={!!scrapeStatus?.running}
          >
            Yuklenici Cek
          </Button>
          <Button leftSection={<IconRefresh size={16} />} variant="light" onClick={() => { fetchYukleniciler(); fetchStats(); }}>
            Yenile
          </Button>
        </Group>
      </Group>

      {/* Scrape Progress */}
      {scrapeStatus?.running && (
        <Paper withBorder p="sm" mb="md" bg={isDark ? 'dark.6' : 'blue.0'}>
          <Group justify="space-between" mb={4}>
            <Group gap="xs">
              <IconLoader size={16} className="animate-spin" />
              <Text size="sm" fw={600}>Tarama devam ediyor...</Text>
            </Group>
            <Badge variant="light">{scrapeStatus.progress.current}/{scrapeStatus.progress.total}</Badge>
          </Group>
          <Progress value={scrapeStatus.progress.total > 0 ? (scrapeStatus.progress.current / scrapeStatus.progress.total) * 100 : 0} size="sm" />
          {scrapeStatus.lastLog.length > 0 && (
            <Text size="xs" c="dimmed" mt={4}>{scrapeStatus.lastLog[scrapeStatus.lastLog.length - 1].message}</Text>
          )}
        </Paper>
      )}

      {/* Dashboard Stats */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
          <Card withBorder p="sm" radius="md">
            <Text size="xs" c="dimmed">Toplam Yuklenici</Text>
            <Text fw={700} size="xl">{stats.genel.toplam_yuklenici}</Text>
          </Card>
          <Card withBorder p="sm" radius="md">
            <Group gap={6}>
              <IconBookmarkFilled size={14} color="var(--mantine-color-blue-6)" />
              <Text size="xs" c="dimmed">Takipte</Text>
            </Group>
            <Text fw={700} size="xl" c="blue">{stats.genel.takipte_olan}</Text>
          </Card>
          <Card withBorder p="sm" radius="md">
            <Text size="xs" c="dimmed">Aktif Yuklenici</Text>
            <Text fw={700} size="xl" c="green">{stats.genel.aktif_yuklenici}</Text>
          </Card>
          <Card withBorder p="sm" radius="md">
            <Text size="xs" c="dimmed">Pazar Buyuklugu</Text>
            <Text fw={700} size="lg" c="orange">
              {stats.genel.toplam_pazar_buyuklugu ? formatCurrency(parseFloat(stats.genel.toplam_pazar_buyuklugu)) : '-'}
            </Text>
          </Card>
          <Card withBorder p="sm" radius="md">
            <Text size="xs" c="dimmed">Ort. Kazanma</Text>
            <Text fw={700} size="xl" c="teal">
              %{stats.genel.ortalama_kazanma_orani ? parseFloat(stats.genel.ortalama_kazanma_orani).toFixed(1) : '0'}
            </Text>
          </Card>
          <Card withBorder p="sm" radius="md">
            <Text size="xs" c="dimmed">Ort. Indirim</Text>
            <Text fw={700} size="xl" c="grape">
              %{stats.genel.ortalama_indirim ? parseFloat(stats.genel.ortalama_indirim).toFixed(1) : '0'}
            </Text>
          </Card>
        </div>
      )}

      {/* Search + Filters */}
      <Paper withBorder p="md" mb="md">
        <Group>
          <TextInput
            placeholder="Yuklenici ara..."
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => { setSearch(e.currentTarget.value); setPage(1); }}
            style={{ flex: 1 }}
          />
          <Button
            variant={takipteFilter ? 'filled' : 'light'}
            color="blue"
            leftSection={<IconBookmark size={16} />}
            onClick={() => { setTakipteFilter(!takipteFilter); setPage(1); }}
          >
            Takipte
          </Button>
        </Group>
      </Paper>

      {/* Table */}
      <Paper withBorder>
        <ScrollArea>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={40}>#</Table.Th>
                <Table.Th>Yuklenici</Table.Th>
                <Table.Th style={{ cursor: 'pointer' }} onClick={() => toggleSort('katildigi_ihale_sayisi')}>
                  <Group gap={4}>Katildigi <SortIcon field="katildigi_ihale_sayisi" /></Group>
                </Table.Th>
                <Table.Th style={{ cursor: 'pointer' }} onClick={() => toggleSort('tamamlanan_is_sayisi')}>
                  <Group gap={4}>Tamamlanan <SortIcon field="tamamlanan_is_sayisi" /></Group>
                </Table.Th>
                <Table.Th style={{ cursor: 'pointer' }} onClick={() => toggleSort('toplam_sozlesme_bedeli')}>
                  <Group gap={4}>Toplam Sozlesme <SortIcon field="toplam_sozlesme_bedeli" /></Group>
                </Table.Th>
                <Table.Th style={{ cursor: 'pointer' }} onClick={() => toggleSort('kazanma_orani')}>
                  <Group gap={4}>Kazanma % <SortIcon field="kazanma_orani" /></Group>
                </Table.Th>
                <Table.Th>Durum</Table.Th>
                <Table.Th style={{ cursor: 'pointer' }} onClick={() => toggleSort('puan')}>
                  <Group gap={4}>Puan <SortIcon field="puan" /></Group>
                </Table.Th>
                <Table.Th>Islemler</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {loading ? (
                <Table.Tr><Table.Td colSpan={9}><Group justify="center" py="xl"><Loader size="sm" /></Group></Table.Td></Table.Tr>
              ) : yukleniciler.length === 0 ? (
                <Table.Tr><Table.Td colSpan={9}>
                  <Stack align="center" py="xl" gap="xs">
                    <IconUsers size={48} opacity={0.3} />
                    <Text c="dimmed">Yuklenici bulunamadi</Text>
                    {!debouncedSearch && !takipteFilter && (
                      <Button size="xs" variant="light" onClick={startScrape}>ihalebul.com&apos;dan Cek</Button>
                    )}
                  </Stack>
                </Table.Td></Table.Tr>
              ) : (
                yukleniciler.map((yk, idx) => (
                  <Table.Tr key={yk.id} style={{ cursor: 'pointer' }} onClick={() => openDetail(yk.id)}>
                    <Table.Td>{(page - 1) * 20 + idx + 1}</Table.Td>
                    <Table.Td>
                      <div>
                        <Text size="sm" fw={600} lineClamp={1}>{yk.kisa_ad || yk.unvan}</Text>
                        {yk.kisa_ad && <Text size="xs" c="dimmed" lineClamp={1}>{yk.unvan}</Text>}
                        <Group gap={4} mt={2}>
                          {yk.takipte && <Badge size="xs" color="blue" variant="filled">Takipte</Badge>}
                          {yk.istihbarat_takibi && <Badge size="xs" color="red" variant="filled">Istihbarat</Badge>}
                          {yk.etiketler?.slice(0, 2).map((e) => (
                            <Badge key={`tag-${yk.id}-${e}`} size="xs" variant="light">{e}</Badge>
                          ))}
                        </Group>
                      </div>
                    </Table.Td>
                    <Table.Td>{yk.katildigi_ihale_sayisi}</Table.Td>
                    <Table.Td>{yk.tamamlanan_is_sayisi}</Table.Td>
                    <Table.Td>
                      <Text size="sm" fw={500} c="orange">{formatCurrency(yk.toplam_sozlesme_bedeli)}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c={Number(yk.kazanma_orani) > 50 ? 'green' : undefined}>
                        %{Number(yk.kazanma_orani || 0).toFixed(1)}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4}>
                        {yk.devam_eden_is_sayisi > 0 && (
                          <Badge size="xs" color="blue">{yk.devam_eden_is_sayisi} aktif</Badge>
                        )}
                        {(yk.fesih_sayisi || 0) > 0 && (
                          <Badge size="xs" color="red">{yk.fesih_sayisi} fesih</Badge>
                        )}
                      </Group>
                    </Table.Td>
                    <Table.Td onClick={(e) => e.stopPropagation()}>
                      <Rating
                        value={yk.puan}
                        size="xs"
                        onChange={async (val) => {
                          try {
                            await mFetch(getApiUrl(`/contractors/${yk.id}`), {
                              method: 'PATCH',
                              body: JSON.stringify({ puan: val }),
                            });
                            fetchYukleniciler();
                          } catch { /* ignore */ }
                        }}
                      />
                    </Table.Td>
                    <Table.Td onClick={(e) => e.stopPropagation()}>
                      <Group gap={4}>
                        <Tooltip label="Detay">
                          <ActionIcon size="sm" variant="light" onClick={() => openDetail(yk.id)}>
                            <IconEye size={14} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label={yk.takipte ? 'Takipten cikar' : 'Takibe al'}>
                          <ActionIcon size="sm" variant={yk.takipte ? 'filled' : 'light'} color="blue" onClick={() => handleTakipToggle(yk.id)}>
                            {yk.takipte ? <IconBookmarkFilled size={14} /> : <IconBookmark size={14} />}
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Istihbarat">
                          <ActionIcon size="sm" variant={yk.istihbarat_takibi ? 'filled' : 'light'} color="red" onClick={() => handleIstihbaratToggle(yk.id)}>
                            <IconSpy size={14} />
                          </ActionIcon>
                        </Tooltip>
                        {yk.ihalebul_url && (
                          <Tooltip label="ihalebul.com">
                            <ActionIcon size="sm" variant="light" color="gray" onClick={() => window.open(yk.ihalebul_url ?? '', '_blank')}>
                              <IconExternalLink size={14} />
                            </ActionIcon>
                          </Tooltip>
                        )}
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))
              )}
            </Table.Tbody>
          </Table>
        </ScrollArea>

        {totalPages > 1 && (
          <Group justify="center" p="md">
            <Pagination total={totalPages} value={page} onChange={setPage} />
          </Group>
        )}
      </Paper>

      {/* Detail Modal */}
      <Modal
        opened={modalOpened}
        onClose={closeModal}
        size="xl"
        padding={0}
        withCloseButton={false}
        styles={{ body: { padding: 0 } }}
      >
        {selectedId && (
          <YukleniciProfilModal
            id={selectedId}
            onClose={closeModal}
            isDark={isDark}
            onIstihbaratToggle={handleIstihbaratToggle}
            onTakipToggle={handleTakipToggle}
          />
        )}
      </Modal>
    </Container>
  );
}

// ─── Yüklenici Profil Modal ─────────────────────────────────────

function YukleniciProfilModal({
  id,
  onClose,
  isDark,
  onIstihbaratToggle,
  onTakipToggle,
}: {
  id: number;
  onClose: () => void;
  isDark: boolean;
  onIstihbaratToggle: (id: number) => Promise<void>;
  onTakipToggle: (id: number) => Promise<void>;
}) {
  const [data, setData] = useState<{
    yuklenici: Yuklenici;
    ihaleler: Array<Record<string, unknown>>;
    kazanilanIhaleler: Array<{
      id: number;
      title: string;
      city: string;
      organization_name: string;
      sozlesme_bedeli: number;
      estimated_cost: number;
      indirim_orani: number;
      sozlesme_tarihi: string;
      tender_date: string;
      status: string;
      url: string;
      work_duration: string;
    }>;
    sehirDagilimi: Array<{ sehir: string; ihale_sayisi: string; toplam_bedel: string }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [notlar, setNotlar] = useState('');
  const [activeTab, setActiveTab] = useState<string | null>('genel');
  const [scrapingHistory, setScrapingHistory] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // AI profil ozeti
  const [aiOzet, setAiOzet] = useState<string | null>(null);
  const [aiOzetLoading, setAiOzetLoading] = useState(false);

  // Risk detay
  const [riskData, setRiskData] = useState<{
    fesihler: Array<{ ihale_basligi: string; kurum_adi: string; sehir: string; sozlesme_bedeli: number; sozlesme_tarihi: string; fesih_durumu: string; ikn: string }>;
    kikKararlari: Array<{ ihale_basligi: string; kurum_adi: string; sehir: string; sozlesme_bedeli: number; sozlesme_tarihi: string; durum: string; ikn: string; tender_url?: string }>;
    riskNotlari: Array<{ id: number; content: string; created_at: string }>;
  } | null>(null);
  const [riskLoading, setRiskLoading] = useState(false);

  // Ihale gecmisi filtreleri
  const [ihaleFiltreSehir, setIhaleFiltreSehir] = useState<string | null>(null);
  const [ihaleFiltreDurum, setIhaleFiltreDurum] = useState<string | null>(null);
  const [ihaleFiltreYil, setIhaleFiltreYil] = useState<string | null>(null);
  const [ihaleSearch, setIhaleSearch] = useState('');

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const mFetch = useCallback((url: string, opts?: RequestInit) => {
    return fetch(url, { credentials: 'include' as RequestCredentials, headers: { 'Content-Type': 'application/json' }, ...opts });
  }, []);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    try {
      const res = await mFetch(getApiUrl(`/contractors/${id}`));
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        setNotlar(json.data.yuklenici.notlar || '');
      }
    } catch (err) {
      console.error('Detail fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [id, mFetch]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  // AI profil ozeti cek
  const fetchAiOzet = useCallback(async () => {
    setAiOzetLoading(true);
    try {
      const res = await mFetch(getApiUrl(`/contractors/${id}/ai-ozet`));
      const json = await res.json();
      if (json.success && json.data?.ozet) {
        setAiOzet(json.data.ozet);
      } else {
        notifications.show({ title: 'Uyari', message: json.error || 'AI ozeti olusturulamadi', color: 'orange' });
      }
    } catch (err) {
      console.error('AI ozet error:', err);
      notifications.show({ title: 'Hata', message: 'AI ozeti olusturulurken hata', color: 'red' });
    } finally {
      setAiOzetLoading(false);
    }
  }, [id, mFetch]);

  // Risk detay cek
  const fetchRiskData = useCallback(async () => {
    setRiskLoading(true);
    try {
      const res = await mFetch(getApiUrl(`/contractors/${id}/risk`));
      const json = await res.json();
      if (json.success) {
        setRiskData({
          fesihler: json.data.fesihler || [],
          kikKararlari: json.data.kikKararlari || [],
          riskNotlari: json.data.riskNotlari || [],
        });
      }
    } catch (err) {
      console.error('Risk data fetch error:', err);
    } finally {
      setRiskLoading(false);
    }
  }, [id, mFetch]);

  // Risk tab'a geçince veriyi çek
  useEffect(() => {
    if (activeTab === 'risk' && !riskData && !riskLoading) {
      fetchRiskData();
    }
  }, [activeTab, riskData, riskLoading, fetchRiskData]);

  // Puan güncelle
  const handlePuanChange = async (newPuan: number) => {
    try {
      await mFetch(getApiUrl(`/contractors/${id}`), {
        method: 'PATCH',
        body: JSON.stringify({ puan: newPuan }),
      });
      fetchDetail();
      notifications.show({ title: 'Kaydedildi', message: `Puan ${newPuan} olarak guncellendi`, color: 'green' });
    } catch (err) {
      console.error('Puan update error:', err);
    }
  };

  const handleTakipToggle = async () => {
    await onTakipToggle(id);
    fetchDetail();
  };

  const handleIstihbaratToggle = async () => {
    await onIstihbaratToggle(id);
    setScrapingHistory(true);
    pollRef.current = setInterval(async () => {
      try {
        const statusRes = await mFetch(getApiUrl('/contractors/scrape/status'));
        const status = await statusRes.json();
        if (!status.running) {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setScrapingHistory(false);
          fetchDetail();
          notifications.show({ title: 'Istihbarat Tamamlandi', message: 'Ihale gecmisi guncellendi', color: 'green' });
        }
      } catch { /* ignore */ }
    }, 3000);
    setTimeout(async () => {
      try {
        const statusRes = await mFetch(getApiUrl('/contractors/scrape/status'));
        const status = await statusRes.json();
        if (!status.running) {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setScrapingHistory(false);
          fetchDetail();
        }
      } catch { /* ignore */ }
    }, 1500);
  };

  const saveNotlar = async () => {
    try {
      await mFetch(getApiUrl(`/contractors/${id}`), {
        method: 'PATCH',
        body: JSON.stringify({ notlar }),
      });
      notifications.show({ title: 'Kaydedildi', message: 'Notlar guncellendi', color: 'green' });
    } catch (err) {
      console.error('Save notes error:', err);
    }
  };

  if (loading || !data) {
    return (
      <Box p="lg">
        <Group justify="space-between" mb="md">
          <Skeleton height={28} width={300} />
          <ActionIcon variant="subtle" onClick={onClose}><IconX size={18} /></ActionIcon>
        </Group>
        <Stack gap="sm">
          <Skeleton height={60} />
          <Skeleton height={200} />
        </Stack>
      </Box>
    );
  }

  const yk = data.yuklenici;
  const veriKaynaklari = yk.veri_kaynaklari || ['ihalebul'];

  return (
    <Box>
      {/* Modal Header */}
      <Paper p="md" style={{ borderBottom: `1px solid ${isDark ? '#333' : '#e0e0e0'}` }}>
        <Group justify="space-between">
          <div>
            <Group gap="xs">
              <Title order={3}>{yk.kisa_ad || yk.unvan}</Title>
              {yk.istihbarat_takibi && (
                <Badge color="red" variant="filled" size="sm" leftSection={<IconSpy size={12} />}>
                  {scrapingHistory ? 'Cekiliyor...' : 'Istihbarat'}
                </Badge>
              )}
            </Group>
            {yk.kisa_ad && <Text size="sm" c="dimmed">{yk.unvan}</Text>}
            <Group gap={6} mt={4}>
              {veriKaynaklari.map((vk) => (
                <Badge key={`vk-${vk}`} size="xs" variant="light" color="blue">
                  {vk}
                </Badge>
              ))}
              {yk.scraped_at && (
                <Text size="xs" c="dimmed">
                  Son tarama: {new Date(yk.scraped_at).toLocaleDateString('tr-TR')}
                </Text>
              )}
            </Group>
          </div>
          <Group>
            <Tooltip label={yk.takipte ? 'Takipten cikar' : 'Takibe al'}>
              <ActionIcon
                variant={yk.takipte ? 'filled' : 'light'}
                color="blue"
                onClick={handleTakipToggle}
              >
                {yk.takipte ? <IconBookmarkFilled size={18} /> : <IconBookmark size={18} />}
              </ActionIcon>
            </Tooltip>
            <Tooltip label={yk.istihbarat_takibi ? 'Istihbarattan cikar' : 'Istihbarata al'}>
              <ActionIcon
                variant={yk.istihbarat_takibi ? 'filled' : 'light'}
                color="red"
                onClick={handleIstihbaratToggle}
                loading={scrapingHistory}
              >
                <IconSpy size={18} />
              </ActionIcon>
            </Tooltip>
            <ActionIcon variant="subtle" onClick={onClose}><IconX size={18} /></ActionIcon>
          </Group>
        </Group>
      </Paper>

      {/* Stats Row */}
      <Group grow p="md" pb={0}>
        <Card withBorder p="xs" radius="sm">
          <Text size="xs" c="dimmed">Katildigi</Text>
          <Text fw={700} size="lg">{yk.katildigi_ihale_sayisi}</Text>
        </Card>
        <Card withBorder p="xs" radius="sm">
          <Text size="xs" c="dimmed">Kazanma</Text>
          <Text fw={700} size="lg" c="green">%{Number(yk.kazanma_orani || 0).toFixed(1)}</Text>
        </Card>
        <Card withBorder p="xs" radius="sm">
          <Text size="xs" c="dimmed">Toplam Sozlesme</Text>
          <Text fw={700} size="lg" c="orange">{formatCurrency(yk.toplam_sozlesme_bedeli)}</Text>
        </Card>
        <Card withBorder p="xs" radius="sm">
          <Text size="xs" c="dimmed">Ort. Indirim</Text>
          <Text fw={700} size="lg" c="teal">
            {yk.ortalama_indirim_orani ? `%${Number(yk.ortalama_indirim_orani).toFixed(1)}` : '-'}
          </Text>
        </Card>
        <Card withBorder p="xs" radius="sm">
          <Text size="xs" c="dimmed">Devam Eden</Text>
          <Text fw={700} size="lg" c={yk.devam_eden_is_sayisi > 0 ? 'blue' : undefined}>
            {yk.devam_eden_is_sayisi}
          </Text>
        </Card>
      </Group>

      {/* Tabs */}
      <Tabs value={activeTab} onChange={setActiveTab} px="md" pt="md">
        <Tabs.List>
          <Tabs.Tab value="genel" leftSection={<IconBuildingBank size={14} />}>Genel</Tabs.Tab>
          <Tabs.Tab value="analiz" leftSection={<IconChartPie size={14} />}>
            Analiz {yk.analiz_verisi ? '' : '(Bos)'}
          </Tabs.Tab>
          <Tabs.Tab value="ihaleler" leftSection={<IconChartBar size={14} />}>
            Ihale Gecmisi ({data.ihaleler.length + data.kazanilanIhaleler.length})
          </Tabs.Tab>
          <Tabs.Tab value="risk" leftSection={<IconAlertTriangle size={14} />}>
            Risk / Notlar
          </Tabs.Tab>
        </Tabs.List>

        {/* GENEL TAB */}
        <Tabs.Panel value="genel" pt="md">
          <Stack gap="md" pb="md">
            {/* Etiketler + Puan */}
            <Group justify="space-between" align="flex-start">
              <div>
                {yk.etiketler && yk.etiketler.length > 0 && (
                  <Group gap={4} mb="xs">
                    {yk.etiketler.map((e) => (
                      <Badge key={`etk-${e}`} size="sm" variant="light">{e}</Badge>
                    ))}
                  </Group>
                )}
                {yk.ihalebul_url && (
                  <Button
                    variant="light"
                    size="xs"
                    leftSection={<IconExternalLink size={14} />}
                    onClick={() => window.open(yk.ihalebul_url ?? '', '_blank')}
                  >
                    ihalebul.com&apos;da Goruntule
                  </Button>
                )}
              </div>
              <Group gap="xs">
                <Text size="sm" fw={600}>Puan:</Text>
                <Rating
                  value={yk.puan}
                  size="md"
                  onChange={handlePuanChange}
                />
              </Group>
            </Group>

            {/* AI Profil Ozeti */}
            <Card withBorder radius="sm" bg={isDark ? 'dark.6' : 'blue.0'}>
              <Group justify="space-between" mb={aiOzet ? 'xs' : 0}>
                <Group gap="xs">
                  <ThemeIcon size="sm" variant="light" color="blue">
                    <IconBrain size={14} />
                  </ThemeIcon>
                  <Text size="sm" fw={600}>AI Profil Ozeti</Text>
                </Group>
                <Button
                  size="xs"
                  variant="light"
                  leftSection={<IconBrain size={14} />}
                  onClick={fetchAiOzet}
                  loading={aiOzetLoading}
                >
                  {aiOzet ? 'Yenile' : 'Olustur'}
                </Button>
              </Group>
              {aiOzet && (
                <Text size="sm" style={{ whiteSpace: 'pre-line' }}>{aiOzet}</Text>
              )}
              {!aiOzet && !aiOzetLoading && (
                <Text size="xs" c="dimmed">
                  AI destekli firma profil ozeti olusturmak icin butona tiklayin.
                </Text>
              )}
            </Card>

            <Divider />

            {/* Sehir Dagilimi */}
            {(yk.aktif_sehirler && yk.aktif_sehirler.length > 0) || data.sehirDagilimi.length > 0 ? (
              <div>
                <Text size="sm" fw={600} mb="xs">
                  <IconMapPin size={14} style={{ verticalAlign: 'middle' }} /> Aktif Sehirler ({data.sehirDagilimi.length || yk.aktif_sehirler?.length || 0})
                </Text>
                {data.sehirDagilimi.length > 0 ? (
                  <Stack gap={4}>
                    {data.sehirDagilimi.slice(0, 10).map((s, idx) => (
                      <Group key={`${s.sehir}-${idx}`} justify="space-between">
                        <Text size="sm">{s.sehir}</Text>
                        <Group gap={8}>
                          <Badge size="xs" variant="light">{s.ihale_sayisi} ihale</Badge>
                          {parseFloat(s.toplam_bedel) > 0 && (
                            <Text size="xs" c="orange" fw={500}>
                              {formatCurrency(parseFloat(s.toplam_bedel))}
                            </Text>
                          )}
                        </Group>
                      </Group>
                    ))}
                  </Stack>
                ) : (
                  <Group gap={4} wrap="wrap">
                    {(yk.aktif_sehirler || []).slice(0, 10).map((s: string | { sehir: string }, idx: number) => (
                      <Badge key={`${typeof s === 'string' ? s : s.sehir}-${idx}`} size="sm" variant="light">
                        {typeof s === 'string' ? s : s.sehir}
                      </Badge>
                    ))}
                  </Group>
                )}
              </div>
            ) : null}

            {/* Son Kazanilan Ihaleler */}
            {data.kazanilanIhaleler.length > 0 && (
              <>
                <Divider />
                <div>
                  <Group gap="xs" mb="xs">
                    <IconTrophy size={14} color="var(--mantine-color-yellow-6)" />
                    <Text size="sm" fw={600}>Son Kazanilan Ihaleler</Text>
                    <Badge size="xs" variant="light" color="green">{data.kazanilanIhaleler.length}</Badge>
                  </Group>
                  <Stack gap={4}>
                    {data.kazanilanIhaleler.slice(0, 5).map((ihale) => (
                      <Paper
                        key={`son-${ihale.id}`}
                        withBorder
                        p="xs"
                        radius="sm"
                        style={{ cursor: ihale.url ? 'pointer' : undefined }}
                        onClick={() => { if (ihale.url) window.open(ihale.url, '_blank'); }}
                      >
                        <Group justify="space-between" wrap="nowrap">
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <Text size="xs" fw={600} lineClamp={1}>{ihale.title}</Text>
                            <Group gap="xs" mt={2}>
                              {ihale.city && <Badge size="xs" variant="light" color="blue">{ihale.city}</Badge>}
                              {ihale.organization_name && (
                                <Text size="xs" c="dimmed" lineClamp={1}>{ihale.organization_name}</Text>
                              )}
                            </Group>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            {ihale.sozlesme_bedeli && (
                              <Text size="xs" fw={600} c="orange">{formatCurrency(ihale.sozlesme_bedeli)}</Text>
                            )}
                            {(ihale.sozlesme_tarihi || ihale.tender_date) && (
                              <Text size="xs" c="dimmed">
                                {new Date(ihale.sozlesme_tarihi || ihale.tender_date).toLocaleDateString('tr-TR')}
                              </Text>
                            )}
                          </div>
                        </Group>
                      </Paper>
                    ))}
                    {data.kazanilanIhaleler.length > 5 && (
                      <Text size="xs" c="dimmed" ta="center">
                        +{data.kazanilanIhaleler.length - 5} daha... (Ihale Gecmisi tab&apos;inda goruntuleyebilirsiniz)
                      </Text>
                    )}
                  </Stack>
                </div>
              </>
            )}
          </Stack>
        </Tabs.Panel>

        {/* ANALİZ TAB */}
        <Tabs.Panel value="analiz" pt="md">
          <AnalyzTabContent
            analiz={yk.analiz_verisi || null}
            analizScrapedAt={yk.analiz_scraped_at || null}
          />
        </Tabs.Panel>

        {/* İHALE GEÇMİŞİ TAB */}
        <Tabs.Panel value="ihaleler" pt="md">
          <IhaleGecmisiTabContent
            ihaleler={data.ihaleler}
            kazanilanIhaleler={data.kazanilanIhaleler}
            filtreSehir={ihaleFiltreSehir}
            setFiltreSehir={setIhaleFiltreSehir}
            filtreDurum={ihaleFiltreDurum}
            setFiltreDurum={setIhaleFiltreDurum}
            filtreYil={ihaleFiltreYil}
            setFiltreYil={setIhaleFiltreYil}
            search={ihaleSearch}
            setSearch={setIhaleSearch}
          />
        </Tabs.Panel>

        {/* RISK / NOTLAR TAB */}
        <Tabs.Panel value="risk" pt="md">
          <Stack gap="md" pb="md">
            {/* Risk Ozet Kartlari */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <Card withBorder radius="sm">
                <Group gap="xs" mb="xs">
                  <IconAlertTriangle size={16} color="var(--mantine-color-red-6)" />
                  <Text size="sm" fw={600}>Fesih / Tasfiye</Text>
                </Group>
                {(yk.fesih_sayisi || 0) > 0 ? (
                  <Badge color="red" variant="light" size="lg">
                    {yk.fesih_sayisi} fesih kaydi
                  </Badge>
                ) : (
                  <Text size="sm" c="green">Fesih kaydi bulunmuyor</Text>
                )}
              </Card>

              <Card withBorder radius="sm">
                <Group gap="xs" mb="xs">
                  <IconShieldCheck size={16} color="var(--mantine-color-orange-6)" />
                  <Text size="sm" fw={600}>KIK Sikayet</Text>
                </Group>
                {(yk.kik_sikayet_sayisi || 0) > 0 ? (
                  <Badge color="orange" variant="light" size="lg">
                    {yk.kik_sikayet_sayisi} sikayet kaydi
                  </Badge>
                ) : (
                  <Text size="sm" c="dimmed">Sikayet verisi henuz yok</Text>
                )}
              </Card>

              <Card withBorder radius="sm" bg={yk.risk_notu ? (isDark ? 'dark.6' : 'red.0') : undefined}>
                <Group gap="xs" mb="xs">
                  <IconFileAlert size={16} color="var(--mantine-color-grape-6)" />
                  <Text size="sm" fw={600}>Risk Notu</Text>
                </Group>
                {yk.risk_notu ? (
                  <Text size="sm">{yk.risk_notu}</Text>
                ) : (
                  <Text size="sm" c="dimmed">Risk notu girilmemis</Text>
                )}
              </Card>
            </div>

            {/* Fesih Detaylari */}
            {(yk.fesih_sayisi || 0) > 0 && (
              <Card withBorder radius="sm">
                <Group gap="xs" mb="sm">
                  <IconAlertTriangle size={16} color="var(--mantine-color-red-6)" />
                  <Text size="sm" fw={600}>Fesih Detaylari ({riskData?.fesihler.length || '...'})</Text>
                  {riskLoading && <Loader size="xs" />}
                </Group>
                {riskData && riskData.fesihler.length > 0 ? (
                  <Stack gap={6}>
                    {riskData.fesihler.map((f, idx) => (
                      <Paper key={`fesih-${idx}-${f.ikn || ''}`} withBorder p="sm" radius="sm" bg={isDark ? 'dark.7' : 'red.0'}>
                        <Group justify="space-between" wrap="nowrap">
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <Text size="sm" fw={600} lineClamp={1}>{f.ihale_basligi}</Text>
                            <Group gap="xs" mt={4}>
                              {f.sehir && <Badge size="xs" variant="light" color="blue">{f.sehir}</Badge>}
                              {f.kurum_adi && <Text size="xs" c="dimmed" lineClamp={1}>{f.kurum_adi}</Text>}
                            </Group>
                            {f.fesih_durumu && f.fesih_durumu !== 'Var' && (
                              <Text size="xs" c="red" mt={4}>Durum: {f.fesih_durumu}</Text>
                            )}
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            {f.sozlesme_bedeli && (
                              <Text size="sm" fw={600} c="orange">{formatCurrency(f.sozlesme_bedeli)}</Text>
                            )}
                            {f.sozlesme_tarihi && (
                              <Text size="xs" c="dimmed">{new Date(f.sozlesme_tarihi).toLocaleDateString('tr-TR')}</Text>
                            )}
                            {f.ikn && <Text size="xs" c="dimmed">IKN: {f.ikn}</Text>}
                          </div>
                        </Group>
                      </Paper>
                    ))}
                  </Stack>
                ) : riskData && riskData.fesihler.length === 0 ? (
                  <Text size="sm" c="dimmed">Fesih detay bilgisi bulunamadi</Text>
                ) : null}
              </Card>
            )}

            {/* KIK Karar Detaylari */}
            {(yk.kik_sikayet_sayisi || 0) > 0 && (
              <Card withBorder radius="sm">
                <Group gap="xs" mb="sm">
                  <IconShieldCheck size={16} color="var(--mantine-color-orange-6)" />
                  <Text size="sm" fw={600}>KIK Karar Detaylari ({riskData?.kikKararlari.length || '...'})</Text>
                  {riskLoading && <Loader size="xs" />}
                </Group>
                {riskData && riskData.kikKararlari.length > 0 ? (
                  <Stack gap={6}>
                    {riskData.kikKararlari.map((k, idx) => (
                      <Paper key={`kik-${idx}-${k.ikn || ''}`} withBorder p="sm" radius="sm" bg={isDark ? 'dark.7' : 'orange.0'}>
                        <Group justify="space-between" wrap="nowrap">
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <Text size="sm" fw={600} lineClamp={1}>{k.ihale_basligi}</Text>
                            <Group gap="xs" mt={4}>
                              {k.sehir && <Badge size="xs" variant="light" color="blue">{k.sehir}</Badge>}
                              {k.kurum_adi && <Text size="xs" c="dimmed" lineClamp={1}>{k.kurum_adi}</Text>}
                            </Group>
                            {k.durum && <Badge size="xs" variant="light" color="orange" mt={4}>{k.durum}</Badge>}
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            {k.sozlesme_bedeli && (
                              <Text size="sm" fw={600} c="orange">{formatCurrency(k.sozlesme_bedeli)}</Text>
                            )}
                            {k.sozlesme_tarihi && (
                              <Text size="xs" c="dimmed">{new Date(k.sozlesme_tarihi).toLocaleDateString('tr-TR')}</Text>
                            )}
                            {k.ikn && <Text size="xs" c="dimmed">IKN: {k.ikn}</Text>}
                          </div>
                        </Group>
                      </Paper>
                    ))}
                  </Stack>
                ) : riskData && riskData.kikKararlari.length === 0 ? (
                  <Text size="sm" c="dimmed">KIK karar detayi bulunamadi</Text>
                ) : null}
              </Card>
            )}

            <Divider />

            {/* Notlar */}
            <div>
              <Text size="sm" fw={600} mb="xs">Notlar</Text>
              <Textarea
                value={notlar}
                onChange={(e) => setNotlar(e.currentTarget.value)}
                placeholder="Bu yuklenici hakkinda notlariniz..."
                minRows={3}
                maxRows={6}
                autosize
              />
              <Button
                variant="light"
                size="xs"
                mt="xs"
                onClick={saveNotlar}
              >
                Notlari Kaydet
              </Button>
            </div>
          </Stack>
        </Tabs.Panel>
      </Tabs>
    </Box>
  );
}

// ─── Analiz Tab İçeriği ─────────────────────────────────────────

function AnalyzTabContent({
  analiz,
  analizScrapedAt,
}: {
  analiz: AnalyzData | null;
  analizScrapedAt: string | null;
}) {
  const [activeSection, setActiveSection] = useState<string | null>('ozet');

  if (!analiz) {
    return (
      <Card withBorder radius="md" p="xl" bg="var(--mantine-color-yellow-light)">
        <Stack gap="md" align="center" py="md">
          <ThemeIcon size={64} variant="light" color="red" radius="xl">
            <IconSpy size={32} />
          </ThemeIcon>
          <div style={{ textAlign: 'center' }}>
            <Text fw={600} size="md" mb={4}>Analiz Verisi Henuz Cekilmedi</Text>
            <Text size="sm" c="dimmed" maw={400}>
              Yuklenici detay sayfasindaki istihbarat butonuna (casus ikonu) basarak analiz verilerini otomatik olarak cekin. Idareler, rakipler, ortak girisimler, yillik trend ve daha fazlasi cekilecek.
            </Text>
          </div>
        </Stack>
      </Card>
    );
  }

  const o = analiz.ozet;

  return (
    <Stack gap="md" pb="md">
      <Text size="xs" c="dimmed">
        Son analiz: {analizScrapedAt ? new Date(analizScrapedAt).toLocaleString('tr-TR') : '-'} — Istihbarat butonuyla guncellenir
      </Text>

      {o && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
          <StatMiniCard label="Toplam Sozlesme" value={o.toplam_sozlesme?.sayi} sub={formatCurrency(o.toplam_sozlesme?.tutar ?? null)} color="orange" />
          <StatMiniCard label="Tamamlanan" value={o.tamamlanan?.sayi} sub={formatCurrency(o.tamamlanan?.tutar ?? null)} color="green" />
          <StatMiniCard label="Devam Eden" value={o.devam_eden?.sayi} sub={formatCurrency(o.devam_eden?.tutar ?? null)} color="blue" />
          <StatMiniCard label="Ort. Tenzilat" value={`%${o.ort_tenzilat?.yuzde?.toFixed(1) || '0'}`} sub={formatCurrency(o.ort_tenzilat?.tutar ?? null)} color="teal" />
          <StatMiniCard label="Ort. Sure" value={`${o.ort_sozlesme_suresi_gun || 0} gun`} sub={`${o.ilk_sozlesme || '-'} → ${o.son_sozlesme || '-'}`} color="grape" />
          <StatMiniCard label="KIK Kararlari" value={o.kik_kararlari || 0} sub={`${o.iptal_ihale || 0} iptal`} color="red" />
        </div>
      )}

      <Tabs value={activeSection} onChange={setActiveSection} variant="pills" radius="xl">
        <ScrollArea type="auto" offsetScrollbars>
          <Tabs.List>
            <Tabs.Tab value="ozet" leftSection={<IconTrendingUp size={12} />}>Yillik Trend</Tabs.Tab>
            <Tabs.Tab value="idareler" leftSection={<IconBuildingBank size={12} />}>Idareler ({analiz.idareler?.length || 0})</Tabs.Tab>
            <Tabs.Tab value="rakipler" leftSection={<IconUsers size={12} />}>Rakipler ({analiz.rakipler?.length || 0})</Tabs.Tab>
            <Tabs.Tab value="ortak" leftSection={<IconUsers size={12} />}>Ortak Girisim ({analiz.ortak_girisimler?.length || 0})</Tabs.Tab>
            <Tabs.Tab value="sehirler" leftSection={<IconMapPin size={12} />}>Sehirler ({analiz.sehirler?.length || 0})</Tabs.Tab>
            <Tabs.Tab value="dagilimlar" leftSection={<IconChartPie size={12} />}>Dagilimlar</Tabs.Tab>
          </Tabs.List>
        </ScrollArea>

        <Tabs.Panel value="ozet" pt="md">
          {analiz.yillik_trend && analiz.yillik_trend.length > 0 ? (
            <ScrollArea>
              <Table striped highlightOnHover withTableBorder withColumnBorders fz="xs">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Yil</Table.Th>
                    <Table.Th>Ort. Katilimci</Table.Th>
                    <Table.Th>Gecerli Teklif</Table.Th>
                    <Table.Th>Tenzilat</Table.Th>
                    <Table.Th>Devam Eden</Table.Th>
                    <Table.Th>Tamamlanan</Table.Th>
                    <Table.Th>Toplam Sozlesme</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {analiz.yillik_trend.map((row, idx) => (
                    <Table.Tr key={`yil-${row.yil}-${idx}`}>
                      <Table.Td fw={600}>{row.yil}</Table.Td>
                      <Table.Td>{row.ort_katilimci}</Table.Td>
                      <Table.Td>{row.ort_gecerli_teklif}</Table.Td>
                      <Table.Td c="teal">%{row.tenzilat_yuzde?.toFixed(1)}</Table.Td>
                      <Table.Td>{row.devam_eden}</Table.Td>
                      <Table.Td>{row.tamamlanan}</Table.Td>
                      <Table.Td c="orange" fw={500}>{formatCurrency(row.toplam_sozlesme)}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          ) : (
            <Text c="dimmed" size="sm">Yillik trend verisi yok</Text>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="idareler" pt="md">
          {analiz.idareler && analiz.idareler.length > 0 ? (
            <ScrollArea h={350}>
              <Table striped highlightOnHover withTableBorder fz="xs">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Idare Adi</Table.Th>
                    <Table.Th ta="right">Gecmis</Table.Th>
                    <Table.Th ta="right">Devam</Table.Th>
                    <Table.Th ta="right">Tamamlanan</Table.Th>
                    <Table.Th ta="right">Toplam</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {analiz.idareler.map((row, idx) => (
                    <Table.Tr key={`${row.idare_adi}-${idx}`}>
                      <Table.Td style={{ maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.idare_adi}
                      </Table.Td>
                      <Table.Td ta="right">{row.gecmis}</Table.Td>
                      <Table.Td ta="right">{row.devam_eden > 0 ? <Badge size="xs" color="blue">{row.devam_eden}</Badge> : '-'}</Table.Td>
                      <Table.Td ta="right">{row.tamamlanan}</Table.Td>
                      <Table.Td ta="right" c="orange" fw={500}>{formatCurrency(row.toplam_sozlesme)}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          ) : (
            <Text c="dimmed" size="sm">Idare verisi yok</Text>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="rakipler" pt="md">
          {analiz.rakipler && analiz.rakipler.length > 0 ? (
            <ScrollArea h={350}>
              <Table striped highlightOnHover withTableBorder fz="xs">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Rakip Adi</Table.Th>
                    <Table.Th ta="right">Ihale Sayisi</Table.Th>
                    <Table.Th ta="right">Toplam Sozlesme</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {analiz.rakipler.map((row, idx) => (
                    <Table.Tr key={`${row.rakip_adi}-${idx}`}>
                      <Table.Td style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.rakip_adi}
                      </Table.Td>
                      <Table.Td ta="right">{row.ihale_sayisi}</Table.Td>
                      <Table.Td ta="right" c="orange" fw={500}>{formatCurrency(row.toplam_sozlesme)}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          ) : (
            <Text c="dimmed" size="sm">Rakip verisi yok</Text>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="ortak" pt="md">
          {analiz.ortak_girisimler && analiz.ortak_girisimler.length > 0 ? (
            <Stack gap="xs">
              {analiz.ortak_girisimler.map((row, idx) => (
                <Paper key={`${row.partner_adi}-${idx}`} withBorder p="sm" radius="sm">
                  <Text size="sm" fw={600} lineClamp={2}>{row.partner_adi}</Text>
                  <Group gap="md" mt={4}>
                    {row.devam_eden > 0 && <Badge size="xs" color="blue">{row.devam_eden} devam eden</Badge>}
                    <Badge size="xs" variant="light">{row.tamamlanan} tamamlanan</Badge>
                    <Text size="xs" c="orange" fw={500}>{formatCurrency(row.toplam_sozlesme)}</Text>
                  </Group>
                </Paper>
              ))}
            </Stack>
          ) : (
            <Text c="dimmed" size="sm">Ortak girisim verisi yok</Text>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="sehirler" pt="md">
          {analiz.sehirler && analiz.sehirler.length > 0 ? (
            <ScrollArea h={350}>
              <Table striped highlightOnHover withTableBorder fz="xs">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Sehir</Table.Th>
                    <Table.Th ta="right">Gecmis</Table.Th>
                    <Table.Th ta="right">Devam</Table.Th>
                    <Table.Th ta="right">Tamamlanan</Table.Th>
                    <Table.Th ta="right">Toplam</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {analiz.sehirler.map((row, idx) => (
                    <Table.Tr key={`${row.sehir}-${idx}`}>
                      <Table.Td fw={500}>{row.sehir}</Table.Td>
                      <Table.Td ta="right">{row.gecmis}</Table.Td>
                      <Table.Td ta="right">{row.devam_eden > 0 ? <Badge size="xs" color="blue">{row.devam_eden}</Badge> : '-'}</Table.Td>
                      <Table.Td ta="right">{row.tamamlanan}</Table.Td>
                      <Table.Td ta="right" c="orange" fw={500}>{formatCurrency(row.toplam_sozlesme)}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          ) : (
            <Text c="dimmed" size="sm">Sehir verisi yok</Text>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="dagilimlar" pt="md">
          <Stack gap="lg">
            {analiz.ihale_usulleri && analiz.ihale_usulleri.length > 0 && (
              <div>
                <Text size="sm" fw={600} mb="xs">Ihale Usulleri</Text>
                <Stack gap={4}>
                  {analiz.ihale_usulleri.slice(0, 8).map((row, idx) => (
                    <Group key={`usul-${row.ad}-${idx}`} justify="space-between" wrap="nowrap">
                      <Text size="xs" lineClamp={1} style={{ flex: 1, minWidth: 0 }}>{row.ad}</Text>
                      <Group gap="xs" wrap="nowrap">
                        <Badge size="xs" variant="light">{row.gecmis} ihale</Badge>
                        <Text size="xs" c="orange" fw={500} style={{ minWidth: 80, textAlign: 'right' }}>
                          {formatCurrency(row.toplam_sozlesme)}
                        </Text>
                      </Group>
                    </Group>
                  ))}
                </Stack>
              </div>
            )}

            <Divider />

            {analiz.teklif_turleri && analiz.teklif_turleri.length > 0 && (
              <div>
                <Text size="sm" fw={600} mb="xs">Teklif Turleri</Text>
                <Stack gap={4}>
                  {analiz.teklif_turleri.map((row, idx) => (
                    <Group key={`teklif-${row.ad}-${idx}`} justify="space-between" wrap="nowrap">
                      <Text size="xs" lineClamp={1} style={{ flex: 1, minWidth: 0 }}>{row.ad}</Text>
                      <Group gap="xs" wrap="nowrap">
                        <Badge size="xs" variant="light">{row.gecmis} ihale</Badge>
                        <Text size="xs" c="orange" fw={500} style={{ minWidth: 80, textAlign: 'right' }}>
                          {formatCurrency(row.toplam_sozlesme)}
                        </Text>
                      </Group>
                    </Group>
                  ))}
                </Stack>
              </div>
            )}

            <Divider />

            {analiz.sektorler && analiz.sektorler.length > 0 && (
              <div>
                <Text size="sm" fw={600} mb="xs">Sektorler (CPV)</Text>
                <Stack gap={4}>
                  {analiz.sektorler.slice(0, 8).map((row, idx) => (
                    <Group key={`${row.cpv_kodu}-${idx}`} justify="space-between" wrap="nowrap">
                      <Text size="xs" lineClamp={1} style={{ flex: 1, minWidth: 0 }}>
                        <Text span c="dimmed">{row.cpv_kodu}</Text> {row.sektor_adi}
                      </Text>
                      <Text size="xs" c="orange" fw={500} style={{ minWidth: 80, textAlign: 'right' }}>
                        {formatCurrency(row.toplam_sozlesme)}
                      </Text>
                    </Group>
                  ))}
                </Stack>
              </div>
            )}
          </Stack>
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}

// ─── İhale Geçmişi Tab İçeriği ──────────────────────────────────

function IhaleGecmisiTabContent({
  ihaleler,
  kazanilanIhaleler,
  filtreSehir,
  setFiltreSehir,
  filtreDurum,
  setFiltreDurum,
  filtreYil,
  setFiltreYil,
  search,
  setSearch,
}: {
  ihaleler: Array<Record<string, unknown>>;
  kazanilanIhaleler: Array<{
    id: number; title: string; city: string; organization_name: string;
    sozlesme_bedeli: number; estimated_cost: number; indirim_orani: number;
    sozlesme_tarihi: string; tender_date: string; status: string; url: string; work_duration: string;
  }>;
  filtreSehir: string | null;
  setFiltreSehir: (v: string | null) => void;
  filtreDurum: string | null;
  setFiltreDurum: (v: string | null) => void;
  filtreYil: string | null;
  setFiltreYil: (v: string | null) => void;
  search: string;
  setSearch: (v: string) => void;
}) {
  if (ihaleler.length === 0 && kazanilanIhaleler.length === 0) {
    return (
      <Stack align="center" py="xl" gap="md" pb="md">
        <ThemeIcon size={64} variant="light" color="red" radius="xl">
          <IconSpy size={32} />
        </ThemeIcon>
        <div style={{ textAlign: 'center' }}>
          <Text fw={600} size="md" mb={4}>Ihale gecmisi henuz cekilmedi</Text>
          <Text size="sm" c="dimmed" maw={400}>
            Yuklenici detay sayfasindaki istihbarat butonuna (casus ikonu) basarak ihale gecmisi, analiz verisi ve katilimci bilgilerini otomatik olarak cekin.
          </Text>
        </div>
      </Stack>
    );
  }

  // Sehir listesini olustur (her iki kaynaktan)
  const sehirSet = new Set<string>();
  ihaleler.forEach((i) => { if (typeof i.sehir === 'string' && i.sehir) sehirSet.add(i.sehir); });
  kazanilanIhaleler.forEach((i) => { if (i.city) sehirSet.add(i.city); });
  const sehirOptions = Array.from(sehirSet).sort().map((s) => ({ value: s, label: s }));

  // Yil listesini olustur
  const yilSet = new Set<string>();
  ihaleler.forEach((i) => {
    if (typeof i.sozlesme_tarihi === 'string' && i.sozlesme_tarihi) {
      yilSet.add(new Date(i.sozlesme_tarihi).getFullYear().toString());
    }
  });
  kazanilanIhaleler.forEach((i) => {
    const tarih = i.sozlesme_tarihi || i.tender_date;
    if (tarih) yilSet.add(new Date(tarih).getFullYear().toString());
  });
  const yilOptions = Array.from(yilSet).sort((a, b) => Number(b) - Number(a)).map((y) => ({ value: y, label: y }));

  // Durum listesini veriden olustur + Turkce etiket eslestirmesi
  const durumLabelMap: Record<string, string> = {
    tamamlandi: 'Tamamlandi',
    devam: 'Devam Ediyor',
    devam_ediyor: 'Devam Ediyor',
    iptal: 'Iptal',
    bilinmiyor: 'Bilinmiyor',
    completed: 'Tamamlandi',
    active: 'Aktif',
    sonuclandi: 'Sonuclandi',
    cancelled: 'Iptal',
  };
  // Birlesik durum gruplaması: benzer durumlari tek secenek olarak göster
  const durumGroupMap: Record<string, string> = {
    tamamlandi: 'tamamlandi',
    completed: 'tamamlandi',
    sonuclandi: 'tamamlandi',
    devam: 'devam',
    devam_ediyor: 'devam',
    active: 'devam',
    iptal: 'iptal',
    cancelled: 'iptal',
    bilinmiyor: 'bilinmiyor',
  };
  const durumGroupLabels: Record<string, string> = {
    tamamlandi: 'Tamamlandi',
    devam: 'Devam Ediyor',
    iptal: 'Iptal',
    bilinmiyor: 'Bilinmiyor',
  };

  const durumCountMap = new Map<string, number>();
  ihaleler.forEach((i) => {
    if (typeof i.durum === 'string' && i.durum) {
      const group = durumGroupMap[i.durum] || i.durum;
      durumCountMap.set(group, (durumCountMap.get(group) || 0) + 1);
    }
  });
  kazanilanIhaleler.forEach((i) => {
    if (i.status) {
      const group = durumGroupMap[i.status] || i.status;
      durumCountMap.set(group, (durumCountMap.get(group) || 0) + 1);
    }
  });
  const durumOptions = Array.from(durumCountMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([d, count]) => ({
      value: d,
      label: `${durumGroupLabels[d] || durumLabelMap[d] || d} (${count})`,
    }));

  // Gecersiz filtre degerini kontrol et
  const validDurumValues = new Set(durumOptions.map((o) => o.value));
  const effectiveDurum = filtreDurum && validDurumValues.has(filtreDurum) ? filtreDurum : null;

  // Filtreleme - durum icin grup eslestirmesi kullan
  const lowerSearch = search.toLowerCase();
  const filteredIhaleler = ihaleler.filter((i) => {
    if (filtreSehir && (typeof i.sehir !== 'string' || i.sehir !== filtreSehir)) return false;
    if (effectiveDurum) {
      const iDurum = typeof i.durum === 'string' ? (durumGroupMap[i.durum] || i.durum) : '';
      if (iDurum !== effectiveDurum) return false;
    }
    if (filtreYil && typeof i.sozlesme_tarihi === 'string' && !i.sozlesme_tarihi.startsWith(filtreYil)) return false;
    if (lowerSearch) {
      const baslik = typeof i.ihale_basligi === 'string' ? i.ihale_basligi.toLowerCase() : '';
      const kurum = typeof i.kurum_adi === 'string' ? i.kurum_adi.toLowerCase() : '';
      if (!baslik.includes(lowerSearch) && !kurum.includes(lowerSearch)) return false;
    }
    return true;
  });

  const filteredKazanilanIhaleler = kazanilanIhaleler.filter((i) => {
    if (filtreSehir && i.city !== filtreSehir) return false;
    if (effectiveDurum) {
      const iDurum = i.status ? (durumGroupMap[i.status] || i.status) : '';
      if (iDurum !== effectiveDurum) return false;
    }
    if (filtreYil) {
      const tarih = i.sozlesme_tarihi || i.tender_date;
      if (tarih && !tarih.startsWith(filtreYil)) return false;
    }
    if (lowerSearch) {
      if (!i.title.toLowerCase().includes(lowerSearch) && !i.organization_name.toLowerCase().includes(lowerSearch)) return false;
    }
    return true;
  });

  const totalFiltered = filteredIhaleler.length + filteredKazanilanIhaleler.length;
  const totalAll = ihaleler.length + kazanilanIhaleler.length;
  const hasActiveFilter = filtreSehir || effectiveDurum || filtreYil || search;

  return (
    <Stack gap="md" pb="md">
      {/* Header */}
      <Group justify="space-between">
        <Group gap="xs">
          <Text size="sm" fw={600}>
            {hasActiveFilter ? `${totalFiltered} / ${totalAll}` : totalAll} ihale kaydi
          </Text>
          {hasActiveFilter && (
            <Button
              size="compact-xs"
              variant="subtle"
              color="gray"
              onClick={() => {
                setFiltreSehir(null);
                setFiltreDurum(null);
                setFiltreYil(null);
                setSearch('');
              }}
            >
              Temizle
            </Button>
          )}
        </Group>
        <Text size="xs" c="dimmed">Istihbarat butonuyla guncellenir</Text>
      </Group>

      {/* Filtreler */}
      <Group grow>
        <TextInput
          placeholder="Ihale veya kurum ara..."
          leftSection={<IconSearch size={14} />}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          size="xs"
        />
        <Select
          placeholder="Sehir"
          data={sehirOptions}
          value={filtreSehir}
          onChange={setFiltreSehir}
          clearable
          size="xs"
          leftSection={<IconMapPin size={14} />}
        />
        <Select
          placeholder="Durum"
          data={durumOptions}
          value={filtreDurum}
          onChange={setFiltreDurum}
          clearable
          size="xs"
        />
        <Select
          placeholder="Yil"
          data={yilOptions}
          value={filtreYil}
          onChange={setFiltreYil}
          clearable
          size="xs"
          leftSection={<IconCalendar size={14} />}
        />
      </Group>

      {/* Ihale Listesi */}
      <ScrollArea h={340}>
        <Stack gap={6}>
          {filteredIhaleler.map((ihale: Record<string, unknown>) => (
            <Paper key={`ib-${String(ihale.id || Math.random())}`} withBorder p="sm" radius="sm">
              <Group justify="space-between" wrap="nowrap">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text size="sm" fw={600} lineClamp={1}>
                    {String(ihale.ihale_basligi || '')}
                  </Text>
                  <Group gap="xs" mt={4}>
                    {typeof ihale.sehir === 'string' && ihale.sehir && (
                      <Badge size="xs" variant="light" color="blue">{ihale.sehir}</Badge>
                    )}
                    {typeof ihale.kurum_adi === 'string' && ihale.kurum_adi && (
                      <Text size="xs" c="dimmed" lineClamp={1}>{ihale.kurum_adi}</Text>
                    )}
                    {typeof ihale.durum === 'string' && ihale.durum && (
                      <Badge
                        size="xs"
                        variant="light"
                        color={ihale.durum === 'tamamlandi' ? 'green' : ihale.durum === 'devam' ? 'blue' : ihale.durum === 'iptal' ? 'red' : 'gray'}
                      >
                        {String(ihale.durum).replace('_', ' ')}
                      </Badge>
                    )}
                    {typeof ihale.fesih_durumu === 'string' && ihale.fesih_durumu && ihale.fesih_durumu !== 'Yok' && (
                      <Badge size="xs" variant="filled" color="red">Fesih</Badge>
                    )}
                  </Group>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  {typeof ihale.sozlesme_bedeli === 'number' && ihale.sozlesme_bedeli > 0 && (
                    <Text size="sm" fw={600} c="orange">
                      {formatCurrency(ihale.sozlesme_bedeli)}
                    </Text>
                  )}
                  {typeof ihale.indirim_orani === 'number' && ihale.indirim_orani > 0 && (
                    <Text size="xs" c="green">%{ihale.indirim_orani.toFixed(1)} indirim</Text>
                  )}
                  {typeof ihale.sozlesme_tarihi === 'string' && ihale.sozlesme_tarihi && (
                    <Text size="xs" c="dimmed">
                      {new Date(ihale.sozlesme_tarihi).toLocaleDateString('tr-TR')}
                    </Text>
                  )}
                </div>
              </Group>
            </Paper>
          ))}

          {filteredKazanilanIhaleler.map((ihale) => (
            <Paper
              key={`db-${ihale.id}`}
              withBorder
              p="sm"
              radius="sm"
              style={{ cursor: ihale.url ? 'pointer' : undefined, borderLeft: '3px solid var(--mantine-color-green-6)' }}
              onClick={() => { if (ihale.url) window.open(ihale.url, '_blank'); }}
            >
              <Group justify="space-between" wrap="nowrap">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Group gap={4}>
                    <Text size="sm" fw={600} lineClamp={1}>{ihale.title}</Text>
                    <Badge size="xs" variant="filled" color="green">Kazanildi</Badge>
                  </Group>
                  <Group gap="xs" mt={4}>
                    {ihale.city && (
                      <Badge size="xs" variant="light" color="blue">{ihale.city}</Badge>
                    )}
                    {ihale.organization_name && (
                      <Text size="xs" c="dimmed" lineClamp={1}>{ihale.organization_name}</Text>
                    )}
                  </Group>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  {ihale.sozlesme_bedeli && (
                    <Text size="sm" fw={600} c="orange">
                      {formatCurrency(ihale.sozlesme_bedeli)}
                    </Text>
                  )}
                  {ihale.indirim_orani && (
                    <Text size="xs" c="green">%{Number(ihale.indirim_orani).toFixed(1)} indirim</Text>
                  )}
                  {(ihale.sozlesme_tarihi || ihale.tender_date) && (
                    <Text size="xs" c="dimmed">
                      {new Date(ihale.sozlesme_tarihi || ihale.tender_date).toLocaleDateString('tr-TR')}
                    </Text>
                  )}
                </div>
              </Group>
            </Paper>
          ))}

          {totalFiltered === 0 && hasActiveFilter && (
            <Stack align="center" py="lg" gap="xs">
              <IconSearch size={32} opacity={0.3} />
              <Text c="dimmed" size="sm">Filtrelere uyan ihale bulunamadi</Text>
              <Button
                size="xs"
                variant="light"
                color="gray"
                onClick={() => {
                  setFiltreSehir(null);
                  setFiltreDurum(null);
                  setFiltreYil(null);
                  setSearch('');
                }}
              >
                Filtreleri Temizle
              </Button>
            </Stack>
          )}
        </Stack>
      </ScrollArea>
    </Stack>
  );
}

// ─── Mini Stat Kart ─────────────────────────────────────────────

function StatMiniCard({
  label,
  value,
  sub,
  color = 'blue',
}: {
  label: string;
  value: string | number | undefined;
  sub?: string;
  color?: string;
}) {
  return (
    <Card withBorder p="xs" radius="sm">
      <Text size="xs" c="dimmed" lineClamp={1}>{label}</Text>
      <Text fw={700} size="md" c={color}>{value ?? '-'}</Text>
      {sub && <Text size="xs" c="dimmed" lineClamp={1}>{sub}</Text>}
    </Card>
  );
}
