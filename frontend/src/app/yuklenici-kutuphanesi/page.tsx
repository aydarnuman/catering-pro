'use client';

import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Container,
  Divider,
  Group,
  Modal,
  MultiSelect,
  Pagination,
  Paper,
  Progress,
  Rating,
  ScrollArea,
  Select,
  Skeleton,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
  Tooltip,
  useMantineColorScheme,
} from '@mantine/core';
import { useDebouncedValue, useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconBookmark,
  IconBookmarkFilled,
  IconChevronDown,
  IconChevronUp,
  IconDatabase,
  IconExternalLink,
  IconFilterOff,
  IconLoader,
  IconRefresh,
  IconSearch,
  IconSelector,
  IconUsers,
  IconX,
} from '@tabler/icons-react';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DashboardStats, SektorGundemiPanel, YukleniciModal } from '@/components/yuklenici-kutuphanesi';
import { BildirimListesi } from '@/components/yuklenici-kutuphanesi/istihbarat/BildirimListesi';
import { getApiUrl } from '@/lib/config';
import type { ScrapeStatus, SortField, StatsData, Yuklenici } from '@/types/yuklenici';
import { formatCurrency } from '@/types/yuklenici';

// ─── Kazanma orani renk helper ────────────────────────────────
function getKazanmaColor(oran: number): string {
  if (oran >= 50) return 'var(--yk-gold)';
  return 'dimmed';
}

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
  const [totalCount, setTotalCount] = useState(0);
  const [sortField, setSortField] = useState<SortField>('toplam_sozlesme_bedeli');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [takipteFilter, setTakipteFilter] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false);

  // Yeni filtreler: sehir ve etiket
  const [filterSehir, setFilterSehir] = useState<string | null>(null);
  const [filterEtiketler, setFilterEtiketler] = useState<string[]>([]);

  // Sehir ve etiket secenekleri (meta endpoint'lerden)
  const [sehirOptions, setSehirOptions] = useState<{ value: string; label: string }[]>([]);
  const [etiketOptions, setEtiketOptions] = useState<{ value: string; label: string }[]>([]);

  // Scrape state
  const [scrapeStatus, setScrapeStatus] = useState<ScrapeStatus | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const mFetch = useCallback((url: string, opts?: RequestInit) => {
    return fetch(url, {
      credentials: 'include' as RequestCredentials,
      headers: { 'Content-Type': 'application/json' },
      ...opts,
    });
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
        ...(filterSehir ? { sehir: filterSehir } : {}),
        ...(filterEtiketler.length > 0 ? { etiket: filterEtiketler.join(',') } : {}),
      });
      const res = await mFetch(getApiUrl(`/contractors?${params}`));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.success) {
        setYukleniciler(json.data);
        setTotalPages(json.totalPages || json.pagination?.totalPages || 1);
        setTotalCount(json.total || json.pagination?.total || json.data?.length || 0);
      }
    } catch (err) {
      console.error('Yuklenici fetch error:', err);
      notifications.show({ title: 'Hata', message: 'Yuklenici listesi yuklenemedi', color: 'red' });
    } finally {
      setLoading(false);
    }
  }, [page, sortField, sortDir, debouncedSearch, takipteFilter, filterSehir, filterEtiketler, mFetch]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await mFetch(getApiUrl('/contractors/stats'));
      if (!res.ok) return;
      const json = await res.json();
      if (json.success) setStats(json.data);
    } catch {
      // Stats yuklenemezse sayfanin calisimasini engelleme
    }
  }, [mFetch]);

  // Sehir ve etiket meta verilerini cek
  const fetchMeta = useCallback(async () => {
    try {
      const [sehirRes, etiketRes] = await Promise.all([
        mFetch(getApiUrl('/contractors/meta/sehirler')),
        mFetch(getApiUrl('/contractors/meta/etiketler')),
      ]);

      if (sehirRes.ok) {
        const sehirJson = await sehirRes.json();
        if (sehirJson.success && Array.isArray(sehirJson.data)) {
          setSehirOptions(
            sehirJson.data.map((s: { sehir: string; count?: number }) => ({
              value: s.sehir,
              label: `${s.sehir}${s.count ? ` (${s.count})` : ''}`,
            }))
          );
        }
      }

      if (etiketRes.ok) {
        const etiketJson = await etiketRes.json();
        if (etiketJson.success && Array.isArray(etiketJson.data)) {
          setEtiketOptions(etiketJson.data.map((e: string) => ({ value: e, label: e })));
        }
      }
    } catch {
      // Meta yuklenemezse sessizce devam et
    }
  }, [mFetch]);

  useEffect(() => {
    fetchYukleniciler();
  }, [fetchYukleniciler]);
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);
  useEffect(() => {
    fetchMeta();
  }, [fetchMeta]);

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
    if (sortField !== field) return <IconSelector size={14} opacity={0.3} />;
    return sortDir === 'asc' ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />;
  };

  // Takip toggle
  const handleTakipToggle = async (id: number) => {
    try {
      await mFetch(getApiUrl(`/contractors/${id}/toggle-follow`), { method: 'POST' });
      fetchYukleniciler();
    } catch {
      /* ignore */
    }
  };

  // Istihbarat toggle
  const handleIstihbaratToggle = async (id: number) => {
    try {
      await mFetch(getApiUrl(`/contractors/${id}/toggle-istihbarat`), { method: 'POST' });
      fetchYukleniciler();
    } catch {
      /* ignore */
    }
  };

  // Scrape baslat
  const startScrape = async () => {
    try {
      const res = await mFetch(getApiUrl('/contractors/scrape'), { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        notifications.show({
          title: 'Tarama Basladi',
          message: "ihalebul.com'dan yukleniciler cekiliyor...",
          color: 'blue',
        });
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
              notifications.show({
                title: 'Tamamlandi',
                message: 'Yuklenici listesi guncellendi',
                color: 'green',
              });
            }
          } catch {
            /* ignore */
          }
        }, 2000);
      } else {
        notifications.show({
          title: 'Uyari',
          message: json.error || 'Baslatilamadi',
          color: 'orange',
        });
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

  // Aktif filtre sayisi
  const activeFilterCount = [takipteFilter, !!filterSehir, filterEtiketler.length > 0, !!debouncedSearch].filter(
    Boolean
  ).length;

  const clearAllFilters = () => {
    setSearch('');
    setFilterSehir(null);
    setFilterEtiketler([]);
    setTakipteFilter(false);
    setPage(1);
  };

  // Skeleton satir render
  const SKELETON_KEYS = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'];
  const renderSkeletonRows = () =>
    SKELETON_KEYS.map((k) => (
      <Table.Tr key={k}>
        <Table.Td>
          <Skeleton height={14} width={20} />
        </Table.Td>
        <Table.Td>
          <Stack gap={4}>
            <Skeleton height={14} width={200 + Math.random() * 100} />
            <Skeleton height={10} width={120} />
          </Stack>
        </Table.Td>
        <Table.Td>
          <Skeleton height={14} width={40} />
        </Table.Td>
        <Table.Td>
          <Skeleton height={14} width={40} />
        </Table.Td>
        <Table.Td>
          <Skeleton height={14} width={80} />
        </Table.Td>
        <Table.Td>
          <Skeleton height={14} width={50} />
        </Table.Td>
        <Table.Td>
          <Skeleton height={14} width={60} />
        </Table.Td>
        <Table.Td>
          <Skeleton height={14} width={70} />
        </Table.Td>
        <Table.Td>
          <Skeleton height={14} width={90} />
        </Table.Td>
      </Table.Tr>
    ));

  return (
    <Container size="xl" py="md">
      {/* Header — Premium dark + gold */}
      <Group justify="space-between" mb="lg">
        <div>
          <Group gap="sm" align="center">
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'linear-gradient(135deg, var(--yk-gold), var(--yk-gold-light))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <IconUsers size={20} color="#000" />
            </div>
            <div>
              <Title order={2} style={{ letterSpacing: '-0.01em' }}>
                İhale İstihbarat
              </Title>
              <Text size="sm" c="dimmed" style={{ letterSpacing: '0.01em' }}>
                Rakip firma istihbarat merkezi –{' '}
                <Text span style={{ color: 'var(--yk-gold)' }} fw={600}>
                  {totalYuklenici}
                </Text>{' '}
                yuklenici kayitli
              </Text>
            </div>
          </Group>
        </div>
        <Group>
          <BildirimListesi />
          <Button
            leftSection={<IconDatabase size={16} />}
            variant="filled"
            onClick={startScrape}
            loading={!!scrapeStatus?.running}
            style={{
              background: 'linear-gradient(135deg, var(--yk-gold), #B8963F)',
              color: '#000',
              border: 'none',
              fontWeight: 600,
            }}
          >
            Yuklenici Cek
          </Button>
          <Button
            leftSection={<IconRefresh size={16} />}
            variant="light"
            onClick={() => {
              fetchYukleniciler();
              fetchStats();
            }}
            style={{
              background: 'var(--yk-gold-dim)',
              color: 'var(--yk-gold)',
              border: '1px solid var(--yk-border)',
            }}
          >
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
              <Text size="sm" fw={600}>
                Tarama devam ediyor...
              </Text>
            </Group>
            <Badge variant="light">
              {scrapeStatus.progress.current}/{scrapeStatus.progress.total}
            </Badge>
          </Group>
          <Progress
            value={
              scrapeStatus.progress.total > 0 ? (scrapeStatus.progress.current / scrapeStatus.progress.total) * 100 : 0
            }
            size="sm"
          />
          {scrapeStatus.lastLog.length > 0 && (
            <Text size="xs" c="dimmed" mt={4}>
              {scrapeStatus.lastLog[scrapeStatus.lastLog.length - 1].message}
            </Text>
          )}
        </Paper>
      )}

      {/* Dashboard Stats */}
      {stats && <DashboardStats stats={stats} onOpenDetail={openDetail} />}

      {/* Sektör Gündemi — Canlı haberler */}
      <Box mb="md">
        <SektorGundemiPanel />
      </Box>

      {/* Search + Filters — Premium dark */}
      <Paper p="md" mb="md" className="yk-filter-bar" radius="md">
        <Group>
          <TextInput
            placeholder="Yuklenici ara..."
            leftSection={<IconSearch size={16} style={{ color: 'var(--yk-gold)' }} />}
            rightSection={
              search ? (
                <ActionIcon
                  size="xs"
                  variant="subtle"
                  onClick={() => {
                    setSearch('');
                    setPage(1);
                  }}
                  aria-label="Aramayi temizle"
                >
                  <IconX size={12} />
                </ActionIcon>
              ) : undefined
            }
            value={search}
            onChange={(e) => {
              setSearch(e.currentTarget.value);
              setPage(1);
            }}
            style={{ flex: 1 }}
            styles={{
              input: {
                background: 'var(--yk-surface-glass)',
                borderColor: 'var(--yk-border-subtle)',
              },
            }}
          />

          <Divider orientation="vertical" style={{ borderColor: 'var(--yk-border-subtle)' }} />

          {sehirOptions.length > 0 && (
            <Select
              placeholder="Sehir filtrele"
              data={sehirOptions}
              value={filterSehir}
              onChange={(v) => {
                setFilterSehir(v);
                setPage(1);
              }}
              clearable
              searchable
              w={200}
              styles={{
                input: {
                  background: 'var(--yk-surface-glass)',
                  borderColor: 'var(--yk-border-subtle)',
                },
              }}
            />
          )}
          {etiketOptions.length > 0 && (
            <MultiSelect
              placeholder="Etiket"
              data={etiketOptions}
              value={filterEtiketler}
              onChange={(v) => {
                setFilterEtiketler(v);
                setPage(1);
              }}
              clearable
              w={200}
              styles={{
                input: {
                  background: 'var(--yk-surface-glass)',
                  borderColor: 'var(--yk-border-subtle)',
                },
              }}
            />
          )}

          <Divider orientation="vertical" style={{ borderColor: 'var(--yk-border-subtle)' }} />

          <Button
            variant={takipteFilter ? 'filled' : 'light'}
            leftSection={<IconBookmark size={16} />}
            onClick={() => {
              setTakipteFilter(!takipteFilter);
              setPage(1);
            }}
            style={
              takipteFilter
                ? {
                    background: 'linear-gradient(135deg, var(--yk-gold), #B8963F)',
                    color: '#000',
                    border: 'none',
                  }
                : {
                    background: 'var(--yk-gold-dim)',
                    color: 'var(--yk-gold)',
                    border: '1px solid var(--yk-border)',
                  }
            }
          >
            Takipte
          </Button>

          {activeFilterCount > 0 && (
            <>
              <Badge size="lg" className="yk-badge-gold">
                {activeFilterCount} filtre
              </Badge>
              <Tooltip label="Tum filtreleri temizle">
                <ActionIcon
                  variant="light"
                  onClick={clearAllFilters}
                  aria-label="Filtreleri temizle"
                  style={{
                    background: 'var(--yk-surface-glass)',
                    border: '1px solid var(--yk-border-subtle)',
                    color: 'var(--yk-text-secondary)',
                  }}
                >
                  <IconFilterOff size={16} />
                </ActionIcon>
              </Tooltip>
            </>
          )}
        </Group>
      </Paper>

      {/* Table — Premium dark */}
      <Paper className="yk-table-wrapper" radius="md">
        <ScrollArea>
          <Table highlightOnHover>
            <Table.Thead style={{ borderBottom: '1px solid var(--yk-border)' }}>
              <Table.Tr>
                <Table.Th
                  w={40}
                  style={{
                    color: 'var(--yk-text-secondary)',
                    fontSize: 11,
                    letterSpacing: '0.03em',
                    textTransform: 'uppercase',
                  }}
                >
                  #
                </Table.Th>
                <Table.Th
                  style={{
                    color: 'var(--yk-text-secondary)',
                    fontSize: 11,
                    letterSpacing: '0.03em',
                    textTransform: 'uppercase',
                  }}
                >
                  Yuklenici
                </Table.Th>
                {[
                  { field: 'katildigi_ihale_sayisi' as SortField, label: 'Katildigi' },
                  { field: 'tamamlanan_is_sayisi' as SortField, label: 'Tamamlanan' },
                  { field: 'toplam_sozlesme_bedeli' as SortField, label: 'Toplam Sozlesme' },
                  { field: 'kazanma_orani' as SortField, label: 'Kazanma %' },
                ].map(({ field, label }) => (
                  <Table.Th
                    key={field}
                    style={{
                      cursor: 'pointer',
                      userSelect: 'none',
                      color: sortField === field ? 'var(--yk-gold)' : 'var(--yk-text-secondary)',
                      fontSize: 11,
                      letterSpacing: '0.03em',
                      textTransform: 'uppercase',
                    }}
                    onClick={() => toggleSort(field)}
                    aria-sort={sortField === field ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    <Group gap={4} wrap="nowrap">
                      {label} <SortIcon field={field} />
                    </Group>
                  </Table.Th>
                ))}
                <Table.Th
                  style={{
                    color: 'var(--yk-text-secondary)',
                    fontSize: 11,
                    letterSpacing: '0.03em',
                    textTransform: 'uppercase',
                  }}
                >
                  Durum
                </Table.Th>
                <Table.Th
                  style={{
                    cursor: 'pointer',
                    userSelect: 'none',
                    color: sortField === 'puan' ? 'var(--yk-gold)' : 'var(--yk-text-secondary)',
                    fontSize: 11,
                    letterSpacing: '0.03em',
                    textTransform: 'uppercase',
                  }}
                  onClick={() => toggleSort('puan')}
                  aria-sort={sortField === 'puan' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  <Group gap={4} wrap="nowrap">
                    Puan <SortIcon field="puan" />
                  </Group>
                </Table.Th>
                <Table.Th
                  style={{
                    color: 'var(--yk-text-secondary)',
                    fontSize: 11,
                    letterSpacing: '0.03em',
                    textTransform: 'uppercase',
                  }}
                >
                  Islemler
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {loading ? (
                renderSkeletonRows()
              ) : yukleniciler.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={9}>
                    <Stack align="center" py={56} gap="sm">
                      <div
                        style={{
                          width: 64,
                          height: 64,
                          borderRadius: 16,
                          background: 'var(--yk-gold-dim)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <IconUsers size={32} style={{ color: 'var(--yk-gold)', opacity: 0.6 }} stroke={1.5} />
                      </div>
                      <Text size="lg" fw={500} c="dimmed">
                        Yuklenici bulunamadi
                      </Text>
                      <Text size="sm" c="dimmed">
                        {debouncedSearch || takipteFilter || filterSehir || filterEtiketler.length > 0
                          ? 'Farkli filtrelerle tekrar deneyin'
                          : "ihalebul.com'dan yuklenici verisi cekin"}
                      </Text>
                      {!debouncedSearch && !takipteFilter && !filterSehir && filterEtiketler.length === 0 && (
                        <Button
                          size="sm"
                          leftSection={<IconDatabase size={16} />}
                          onClick={startScrape}
                          mt="xs"
                          style={{
                            background: 'linear-gradient(135deg, var(--yk-gold), #B8963F)',
                            color: '#000',
                            border: 'none',
                          }}
                        >
                          ihalebul.com&apos;dan Cek
                        </Button>
                      )}
                      {activeFilterCount > 0 && (
                        <Button
                          size="sm"
                          variant="subtle"
                          leftSection={<IconFilterOff size={16} />}
                          onClick={clearAllFilters}
                          mt="xs"
                          style={{ color: 'var(--yk-gold)' }}
                        >
                          Filtreleri Temizle
                        </Button>
                      )}
                    </Stack>
                  </Table.Td>
                </Table.Tr>
              ) : (
                yukleniciler.map((yk, idx) => {
                  const kazanmaOrani = Number(yk.kazanma_orani || 0);
                  return (
                    <Table.Tr
                      key={yk.id}
                      style={{
                        cursor: 'pointer',
                        transition: 'background-color 0.15s ease',
                        borderBottom: '1px solid var(--yk-border-subtle)',
                      }}
                      onClick={() => openDetail(yk.id)}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') openDetail(yk.id);
                      }}
                    >
                      <Table.Td>{(page - 1) * 20 + idx + 1}</Table.Td>
                      <Table.Td>
                        <div>
                          <Text size="sm" fw={600} lineClamp={1}>
                            {yk.kisa_ad || yk.unvan}
                          </Text>
                          {yk.kisa_ad && (
                            <Text size="xs" c="dimmed" lineClamp={1}>
                              {yk.unvan}
                            </Text>
                          )}
                          <Group gap={4} mt={2}>
                            {yk.takipte && (
                              <Badge
                                size="xs"
                                variant="outline"
                                style={{
                                  borderColor: 'var(--yk-border)',
                                  color: 'var(--yk-text-secondary)',
                                }}
                              >
                                Takipte
                              </Badge>
                            )}
                            {yk.istihbarat_takibi && (
                              <Badge
                                size="xs"
                                variant="outline"
                                style={{
                                  borderColor: 'var(--yk-border)',
                                  color: 'var(--yk-text-secondary)',
                                }}
                              >
                                Istihbarat
                              </Badge>
                            )}
                          </Group>
                        </div>
                      </Table.Td>
                      <Table.Td>{yk.katildigi_ihale_sayisi}</Table.Td>
                      <Table.Td>{yk.tamamlanan_is_sayisi}</Table.Td>
                      <Table.Td>
                        <Text size="sm" fw={600} style={{ color: 'var(--yk-gold)' }}>
                          {formatCurrency(yk.toplam_sozlesme_bedeli)}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" fw={500} style={{ color: getKazanmaColor(kazanmaOrani) }}>
                          %{kazanmaOrani.toFixed(1)}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        {yk.devam_eden_is_sayisi > 0 || (yk.fesih_sayisi || 0) > 0 ? (
                          <Text size="xs" c="dimmed">
                            {yk.devam_eden_is_sayisi > 0 && `${yk.devam_eden_is_sayisi} aktif`}
                            {yk.devam_eden_is_sayisi > 0 && (yk.fesih_sayisi || 0) > 0 && ' · '}
                            {(yk.fesih_sayisi || 0) > 0 && `${yk.fesih_sayisi} fesih`}
                          </Text>
                        ) : (
                          <Text size="xs" c="dimmed">
                            —
                          </Text>
                        )}
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
                            } catch {
                              /* ignore */
                            }
                          }}
                        />
                      </Table.Td>
                      <Table.Td onClick={(e) => e.stopPropagation()}>
                        <Group gap={6}>
                          <Tooltip label={yk.takipte ? 'Takipten cikar' : 'Takibe al'}>
                            <ActionIcon
                              size="sm"
                              variant="subtle"
                              onClick={() => handleTakipToggle(yk.id)}
                              aria-label={yk.takipte ? 'Takipten cikar' : 'Takibe al'}
                              style={{
                                color: yk.takipte ? 'var(--yk-gold)' : 'var(--yk-text-secondary)',
                              }}
                            >
                              {yk.takipte ? <IconBookmarkFilled size={16} /> : <IconBookmark size={16} />}
                            </ActionIcon>
                          </Tooltip>
                          {yk.ihalebul_url && (
                            <Tooltip label="ihalebul.com">
                              <ActionIcon
                                size="sm"
                                variant="subtle"
                                onClick={() => window.open(yk.ihalebul_url ?? '', '_blank')}
                                aria-label="ihalebul.com'da ac"
                                style={{ color: 'var(--yk-text-secondary)' }}
                              >
                                <IconExternalLink size={16} />
                              </ActionIcon>
                            </Tooltip>
                          )}
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  );
                })
              )}
            </Table.Tbody>
          </Table>
        </ScrollArea>

        {/* Pagination + Info */}
        <Group justify="space-between" p="md" pt="sm">
          <Text size="xs" c="dimmed">
            {totalCount > 0
              ? `${(page - 1) * 20 + 1}–${Math.min(page * 20, totalCount)} / ${totalCount} yuklenici`
              : ''}
          </Text>
          {totalPages > 1 && <Pagination total={totalPages} value={page} onChange={setPage} size="sm" />}
        </Group>
      </Paper>

      {/* Detail Modal - Fullscreen Premium */}
      <Modal
        opened={modalOpened}
        onClose={closeModal}
        fullScreen
        padding={0}
        withCloseButton={false}
        styles={{
          body: { padding: 0, background: 'linear-gradient(180deg, #0f1015 0%, #16171c 100%)' },
          content: { background: 'linear-gradient(180deg, #0f1015 0%, #16171c 100%)' },
        }}
        transitionProps={{ transition: 'slide-up', duration: 200 }}
        aria-labelledby="yuklenici-modal-title"
      >
        {selectedId && (
          <YukleniciModal
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
