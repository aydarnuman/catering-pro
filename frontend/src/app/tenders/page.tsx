'use client';

import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Collapse,
  Container,
  Divider,
  Grid,
  Group,
  Loader,
  Modal,
  MultiSelect,
  Pagination,
  Paper,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconAlertCircle,
  IconBuilding,
  IconCalendar,
  IconClock,
  IconCloudDownload,
  IconCurrencyLira,
  IconExternalLink,
  IconFileText,
  IconFilter,
  IconLink,
  IconMapPin,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconSparkles,
  IconX,
} from '@tabler/icons-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { apiClient } from '@/lib/api';
import { API_BASE_URL } from '@/lib/config';
import type { Tender, TendersResponse } from '@/types/api';

const API_URL = API_BASE_URL;

export default function TendersPage() {
  const router = useRouter();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [cityFilter, setCityFilter] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  // URL ile ihale ekleme
  const [addUrlModalOpen, setAddUrlModalOpen] = useState(false);
  const [tenderUrl, setTenderUrl] = useState('');
  const [addingTender, setAddingTender] = useState(false);

  // On-demand döküman çekme
  const [fetchingDocsModalOpen, setFetchingDocsModalOpen] = useState(false);
  const [fetchingDocsTender, setFetchingDocsTender] = useState<Tender | null>(null);
  const [fetchingDocsProgress, setFetchingDocsProgress] = useState<string>('Kontrol ediliyor...');

  // Debounce search - 500ms bekle
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1); // Arama değişince sayfa 1'e dön
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data, error, isLoading, mutate } = useSWR<TendersResponse>(
    ['tenders', currentPage, pageSize, debouncedSearch],
    () =>
      apiClient.getTenders({
        page: currentPage,
        limit: pageSize,
        search: debouncedSearch || undefined,
      })
  );

  // Güncelleme istatistikleri
  interface UpdateStats {
    lastUpdate: string;
    today: {
      newCount: number;
      updatedCount: number;
      newTenders: Array<{
        id: number;
        external_id: string;
        title: string;
        city: string;
        organization_name: string;
        created_at: string;
      }>;
      updatedTenders: Array<{
        id: number;
        external_id: string;
        title: string;
        city: string;
        organization_name: string;
        updated_at: string;
      }>;
    };
    totalCount: number;
  }

  const { data: statsData } = useSWR<{ success: boolean; data: UpdateStats }>(
    'tender-stats',
    () => fetch(`${API_URL}/api/tenders/stats/updates`).then((r) => r.json()),
    { refreshInterval: 60000 } // Her 1 dakikada yenile
  );

  const [showStats, setShowStats] = useState<'new' | 'updated' | false>(false);

  // URL ile ihale ekleme handler
  const handleAddTenderByUrl = async () => {
    if (!tenderUrl.trim()) {
      notifications.show({
        title: 'Hata',
        message: 'URL girmelisiniz',
        color: 'red',
      });
      return;
    }

    if (!tenderUrl.includes('ihalebul.com/tender/')) {
      notifications.show({
        title: 'Geçersiz URL',
        message: 'URL formatı: https://ihalebul.com/tender/123456',
        color: 'red',
      });
      return;
    }

    setAddingTender(true);
    try {
      const res = await fetch(`${API_URL}/api/scraper/add-tender`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: tenderUrl.trim() }),
      });

      const data = await res.json();

      if (data.success) {
        notifications.show({
          title: '✅ Başarılı!',
          message: `${data.data.isNew ? 'Yeni ihale eklendi' : 'İhale güncellendi'}: ${data.data.title?.substring(0, 50) || 'İhale'}... (${data.data.documentCount} döküman)`,
          color: 'green',
        });
        setAddUrlModalOpen(false);
        setTenderUrl('');
        mutate(); // Listeyi yenile
      } else {
        notifications.show({
          title: 'Hata',
          message: data.error || 'İhale eklenemedi',
          color: 'red',
        });
      }
    } catch (err: any) {
      notifications.show({
        title: 'Hata',
        message: err.message || 'Bağlantı hatası',
        color: 'red',
      });
    } finally {
      setAddingTender(false);
    }
  };

  // İhale detayına git - on-demand döküman çekme ile
  const handleTenderClick = async (tender: Tender) => {
    setFetchingDocsTender(tender);
    setFetchingDocsModalOpen(true);
    setFetchingDocsProgress('Döküman durumu kontrol ediliyor...');

    try {
      // 1. Döküman durumunu kontrol et
      const checkRes = await fetch(`${API_URL}/api/scraper/check-documents/${tender.id}`);
      const checkData = await checkRes.json();

      if (!checkData.success) {
        // Kontrol başarısız, direkt yönlendir
        router.push(`/tenders/${tender.id}`);
        setFetchingDocsModalOpen(false);
        return;
      }

      const { hasDocuments, needsUpdate, documentCount } = checkData.data;

      // 2. Döküman yoksa veya güncelleme gerekiyorsa çek
      if (!hasDocuments || needsUpdate) {
        setFetchingDocsProgress(
          hasDocuments
            ? `${documentCount} döküman mevcut, güncelleniyor...`
            : "Dökümanlar ihalebul.com'dan çekiliyor..."
        );

        const fetchRes = await fetch(`${API_URL}/api/scraper/fetch-documents/${tender.id}`, {
          method: 'POST',
        });
        const fetchData = await fetchRes.json();

        if (fetchData.success) {
          const newDocCount = fetchData.data?.documentCount || 0;

          if (newDocCount > 0) {
            notifications.show({
              title: '✅ Dökümanlar Yüklendi',
              message: `${newDocCount} döküman başarıyla çekildi`,
              color: 'green',
            });
          }
        }
      } else {
        setFetchingDocsProgress(`${documentCount} döküman mevcut, yönlendiriliyor...`);
      }

      // 3. Detay sayfasına yönlendir
      await new Promise((r) => setTimeout(r, 500)); // Kısa gecikme ile UX iyileştirme
      router.push(`/tenders/${tender.id}`);
    } catch (err: any) {
      console.error('Döküman çekme hatası:', err);
      // Hata olsa da detay sayfasına yönlendir
      router.push(`/tenders/${tender.id}`);
    } finally {
      setFetchingDocsModalOpen(false);
      setFetchingDocsTender(null);
    }
  };

  const formatCurrency = (amount?: number) => {
    if (!amount) return 'Belirtilmemiş';
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (tender: Tender) => {
    const deadline = new Date(tender.deadline);
    const now = new Date();
    const diffMs = deadline.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000));

    if (diffMs < 0) {
      return <Badge color="red">Süresi Dolmuş</Badge>;
    } else if (diffDays <= 1) {
      return <Badge color="red">BUGÜN!</Badge>;
    } else if (diffDays <= 3) {
      return <Badge color="orange">{diffDays} Gün Kaldı</Badge>;
    } else if (diffDays <= 7) {
      return <Badge color="yellow">{diffDays} Gün Kaldı</Badge>;
    } else {
      return <Badge color="green">Aktif</Badge>;
    }
  };

  const getStatus = (tender: Tender) => {
    const deadline = new Date(tender.deadline);
    const now = new Date();

    if (deadline < now) return 'expired';
    if (deadline.getTime() - now.getTime() < 7 * 24 * 60 * 60 * 1000) return 'urgent';
    return 'active';
  };

  // Filter tenders (arama artık backend'de yapılıyor, sadece client-side status/city filtresi)
  const filteredTenders = useMemo(() => {
    if (!data?.tenders) return [];

    return data.tenders.filter((tender) => {
      // Status filter (client-side)
      if (statusFilter) {
        const status = getStatus(tender);
        if (status !== statusFilter) return false;
      }

      // City filter (client-side)
      if (cityFilter.length > 0 && tender.city) {
        if (!cityFilter.includes(tender.city)) return false;
      }

      return true;
    });
  }, [data?.tenders, statusFilter, cityFilter, getStatus]);

  // Get unique cities for filter
  const availableCities = useMemo(() => {
    if (!data?.tenders) return [];
    const cities = new Set(data.tenders.map((t) => t.city).filter(Boolean) as string[]);
    return Array.from(cities).sort();
  }, [data?.tenders]);

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter(null);
    setCityFilter([]);
  };

  return (
    <Box
      style={{
        background: 'linear-gradient(180deg, rgba(34,139,230,0.03) 0%, rgba(255,255,255,0) 100%)',
        minHeight: '100vh',
      }}
    >
      <Container size="xl" py="xl">
        <Stack gap="xl">
          {/* Header */}
          <Group justify="space-between">
            <div>
              <Title order={1}>İhale Listesi</Title>
              <Text c="dimmed" size="lg">
                {isLoading
                  ? 'Aranıyor...'
                  : debouncedSearch
                    ? `"${debouncedSearch}" için ${data?.total || 0} sonuç bulundu`
                    : `${data?.total || 0} ihale bulundu`}
              </Text>
            </div>
            <Group>
              <Button
                leftSection={<IconFilter size={16} />}
                variant={showFilters ? 'filled' : 'outline'}
                onClick={() => setShowFilters(!showFilters)}
              >
                Filtreler
              </Button>
              <Button
                leftSection={<IconRefresh size={16} />}
                variant="outline"
                onClick={() => mutate()}
                loading={isLoading}
              >
                Yenile
              </Button>
              <Button
                leftSection={<IconLink size={16} />}
                variant="gradient"
                gradient={{ from: 'teal', to: 'cyan' }}
                onClick={() => setAddUrlModalOpen(true)}
              >
                URL ile Ekle
              </Button>
            </Group>
          </Group>

          {/* Bugünün Özeti - Dashboard Kartları */}
          {statsData?.data && (
            <Grid gutter="sm">
              {/* Stat Kartları */}
              <Grid.Col span={{ base: 4, sm: 2 }}>
                <Paper p="xs" radius="md" bg="blue.0" ta="center">
                  <Text size="xl" fw={700} c="blue.7">
                    {statsData.data.totalCount}
                  </Text>
                  <Text size="xs" c="blue.6">
                    Toplam
                  </Text>
                </Paper>
              </Grid.Col>

              <Grid.Col span={{ base: 4, sm: 2 }}>
                <Paper
                  p="xs"
                  radius="md"
                  bg="green.0"
                  ta="center"
                  style={{ cursor: statsData.data.today.newCount > 0 ? 'pointer' : 'default' }}
                  onClick={() =>
                    statsData.data.today.newCount > 0 &&
                    setShowStats(showStats === 'new' ? false : 'new')
                  }
                >
                  <Text size="xl" fw={700} c="green.7">
                    {statsData.data.today.newCount}
                  </Text>
                  <Text size="xs" c="green.6">
                    Yeni {statsData.data.today.newCount > 0 && '▾'}
                  </Text>
                </Paper>
              </Grid.Col>

              <Grid.Col span={{ base: 4, sm: 2 }}>
                <Paper
                  p="xs"
                  radius="md"
                  bg="orange.0"
                  ta="center"
                  style={{ cursor: statsData.data.today.updatedCount > 0 ? 'pointer' : 'default' }}
                  onClick={() =>
                    statsData.data.today.updatedCount > 0 &&
                    setShowStats(showStats === 'updated' ? false : 'updated')
                  }
                >
                  <Text size="xl" fw={700} c="orange.7">
                    {statsData.data.today.updatedCount}
                  </Text>
                  <Text size="xs" c="orange.6">
                    Güncellenen {statsData.data.today.updatedCount > 0 && '▾'}
                  </Text>
                </Paper>
              </Grid.Col>

              <Grid.Col span={{ base: 12, sm: 6 }}>
                <Paper p="xs" radius="md" bg="gray.0">
                  <Group gap="xs" justify="center">
                    <IconClock size={14} color="var(--mantine-color-gray-6)" />
                    <Text size="xs" c="dimmed">
                      {new Date(statsData.data.lastUpdate).toLocaleString('tr-TR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </Group>
                </Paper>
              </Grid.Col>

              {/* Yeni Eklenen İhaleler - Açılır Liste */}
              {showStats === 'new' && statsData.data.today.newTenders.length > 0 && (
                <Grid.Col span={12}>
                  <Paper
                    p="sm"
                    radius="md"
                    withBorder
                    style={{ borderColor: 'var(--mantine-color-green-3)' }}
                  >
                    <Group justify="space-between" mb="xs">
                      <Text size="sm" fw={600} c="green.7">
                        Bugün Eklenen İhaleler
                      </Text>
                      <ActionIcon variant="subtle" size="xs" onClick={() => setShowStats(false)}>
                        <IconX size={12} />
                      </ActionIcon>
                    </Group>
                    <Stack gap={4}>
                      {statsData.data.today.newTenders.map((t) => (
                        <Group key={t.id} gap="xs" wrap="nowrap">
                          <Badge size="xs" color="green" variant="light" style={{ minWidth: 70 }}>
                            {t.city}
                          </Badge>
                          <Text
                            size="xs"
                            lineClamp={1}
                            component={Link}
                            href={`/tenders/${t.id}`}
                            c="dark"
                            style={{ flex: 1, textDecoration: 'none' }}
                          >
                            {t.title}
                          </Text>
                        </Group>
                      ))}
                    </Stack>
                  </Paper>
                </Grid.Col>
              )}

              {/* Güncellenen İhaleler - Açılır Liste */}
              {showStats === 'updated' && statsData.data.today.updatedTenders.length > 0 && (
                <Grid.Col span={12}>
                  <Paper
                    p="sm"
                    radius="md"
                    withBorder
                    style={{ borderColor: 'var(--mantine-color-orange-3)' }}
                  >
                    <Group justify="space-between" mb="xs">
                      <Text size="sm" fw={600} c="orange.7">
                        Bugün Güncellenen İhaleler
                      </Text>
                      <ActionIcon variant="subtle" size="xs" onClick={() => setShowStats(false)}>
                        <IconX size={12} />
                      </ActionIcon>
                    </Group>
                    <Stack gap={4}>
                      {statsData.data.today.updatedTenders.map((t) => (
                        <Group key={t.id} gap="xs" wrap="nowrap">
                          <Badge size="xs" color="orange" variant="light" style={{ minWidth: 70 }}>
                            {t.city}
                          </Badge>
                          <Text
                            size="xs"
                            lineClamp={1}
                            component={Link}
                            href={`/tenders/${t.id}`}
                            c="dark"
                            style={{ flex: 1, textDecoration: 'none' }}
                          >
                            {t.title}
                          </Text>
                        </Group>
                      ))}
                    </Stack>
                  </Paper>
                </Grid.Col>
              )}
            </Grid>
          )}

          {/* Search and Filters */}
          <Paper shadow="sm" p="md" radius="md" withBorder>
            <Stack gap="md">
              {/* Search Bar - Tüm veritabanında arama yapar */}
              <TextInput
                placeholder="Tüm ihalelerde ara... (başlık, kuruluş, şehir, ihale no)"
                leftSection={<IconSearch size={16} />}
                size="md"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                rightSection={
                  isLoading && debouncedSearch ? (
                    <Loader size="xs" />
                  ) : searchQuery ? (
                    <ActionIcon onClick={() => setSearchQuery('')} variant="subtle">
                      <IconX size={16} />
                    </ActionIcon>
                  ) : null
                }
              />

              {/* Advanced Filters */}
              <Collapse in={showFilters}>
                <Grid>
                  <Grid.Col span={{ base: 12, md: 6 }}>
                    <Select
                      label="Durum"
                      placeholder="Tüm ihaleler"
                      value={statusFilter}
                      onChange={setStatusFilter}
                      clearable
                      data={[
                        { value: 'active', label: '✅ Aktif İhaleler' },
                        { value: 'urgent', label: '⚠️ Son 7 Gün' },
                        { value: 'expired', label: '❌ Süresi Dolmuş' },
                      ]}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, md: 6 }}>
                    <MultiSelect
                      label="Şehir"
                      placeholder="Şehir seçin"
                      value={cityFilter}
                      onChange={setCityFilter}
                      data={availableCities}
                      searchable
                      clearable
                    />
                  </Grid.Col>
                </Grid>

                {(searchQuery || statusFilter || cityFilter.length > 0) && (
                  <Group justify="flex-end" mt="sm">
                    <Button
                      variant="subtle"
                      size="xs"
                      onClick={clearFilters}
                      leftSection={<IconX size={14} />}
                    >
                      Filtreleri Temizle
                    </Button>
                  </Group>
                )}
              </Collapse>
            </Stack>
          </Paper>

          {/* Error Alert */}
          {error && (
            <Alert icon={<IconAlertCircle size={16} />} title="Bağlantı Hatası" color="red">
              İhaleler yüklenemedi: {error.message}
            </Alert>
          )}

          {/* Loading State */}
          {isLoading && (
            <Box ta="center" py="xl">
              <Loader size="lg" />
              <Text mt="md" c="dimmed">
                İhaleler yükleniyor...
              </Text>
            </Box>
          )}

          {/* Tenders Grid */}
          {filteredTenders.length > 0 && (
            <Grid>
              {filteredTenders.map((tender) => (
                <Grid.Col key={tender.id} span={{ base: 12, md: 6, lg: 4 }}>
                  <Card
                    shadow="sm"
                    padding="lg"
                    radius="md"
                    withBorder
                    h="100%"
                    style={{
                      transition: 'all 0.2s ease',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-4px)';
                      e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '';
                    }}
                  >
                    <Stack gap="sm" h="100%">
                      {/* Header */}
                      <Group justify="space-between" align="flex-start">
                        <Group gap="xs">
                          {getStatusBadge(tender)}
                          {tender.is_updated && (
                            <Badge
                              color="yellow"
                              size="sm"
                              variant="filled"
                              leftSection={<IconSparkles size={10} />}
                            >
                              Güncellendi
                            </Badge>
                          )}
                        </Group>
                        <Group gap="xs">
                          {tender.url && (
                            <Button
                              size="xs"
                              variant="subtle"
                              p={4}
                              component="a"
                              href={tender.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="İhale sayfasını aç"
                            >
                              <IconExternalLink size={14} />
                            </Button>
                          )}
                          <Text size="xs" c="dimmed">
                            #{tender.id}
                          </Text>
                        </Group>
                      </Group>

                      {/* Title - Tıklandığında on-demand döküman çekme */}
                      <Title
                        order={4}
                        lineClamp={2}
                        h={48}
                        style={{
                          cursor: 'pointer',
                          transition: 'color 0.2s',
                        }}
                        onClick={() => handleTenderClick(tender)}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = '#228be6';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = '';
                        }}
                      >
                        {tender.title}
                      </Title>

                      <Divider />

                      {/* Content */}
                      <Stack gap="xs" style={{ flex: 1 }}>
                        <Group gap="xs">
                          <IconBuilding size={16} />
                          <Text size="sm" lineClamp={2}>
                            {tender.organization}
                          </Text>
                        </Group>

                        {tender.city && (
                          <Group gap="xs">
                            <IconMapPin size={16} />
                            <Text size="sm">{tender.city}</Text>
                          </Group>
                        )}

                        <Group gap="xs">
                          <IconCalendar size={16} />
                          <Text size="sm" fw={500}>
                            Teklif tarihi:
                          </Text>
                          <Text size="sm">
                            {tender.deadline ? formatDate(tender.deadline) : 'Belirtilmemiş'}
                          </Text>
                        </Group>

                        {(tender.estimated_cost || tender.estimated_cost_min) && (
                          <Group gap="xs">
                            <IconCurrencyLira size={16} />
                            <Text size="sm">
                              {tender.estimated_cost
                                ? formatCurrency(tender.estimated_cost)
                                : tender.estimated_cost_min
                                  ? `${formatCurrency(tender.estimated_cost_min)} - ${formatCurrency(tender.estimated_cost_max)}`
                                  : 'Belirtilmemiş'}
                            </Text>
                          </Group>
                        )}

                        {tender.tender_method && (
                          <Group gap="xs">
                            <Text size="xs" c="dimmed">
                              Yöntem: {tender.tender_method}
                            </Text>
                          </Group>
                        )}
                      </Stack>

                      {/* Footer */}
                      <Stack gap="sm" mt="auto" pt="sm">
                        <Button
                          variant="light"
                          fullWidth
                          leftSection={<IconFileText size={16} />}
                          onClick={() => handleTenderClick(tender)}
                        >
                          Detayları Gör
                        </Button>
                        <Group justify="space-between">
                          <Text size="xs" c="dimmed">
                            {formatDate(tender.created_at)}
                          </Text>
                          <Text size="xs" c="dimmed">
                            #{tender.external_id}
                          </Text>
                        </Group>
                      </Stack>
                    </Stack>
                  </Card>
                </Grid.Col>
              ))}
            </Grid>
          )}

          {/* Empty State */}
          {data?.tenders && data.tenders.length === 0 && (
            <Box ta="center" py="xl">
              <IconAlertCircle size={48} color="gray" />
              <Text mt="md" size="lg" fw={500}>
                Henüz ihale bulunmuyor
              </Text>
              <Text c="dimmed">İhale verileri scraper ile toplanacak</Text>
            </Box>
          )}

          {/* No Results State */}
          {data?.tenders && data.tenders.length > 0 && filteredTenders.length === 0 && (
            <Box ta="center" py="xl">
              <IconSearch size={48} color="gray" />
              <Text mt="md" size="lg" fw={500}>
                Arama sonucu bulunamadı
              </Text>
              <Text c="dimmed">Farklı filtreler veya arama terimleri deneyin</Text>
              <Button variant="light" mt="md" onClick={clearFilters}>
                Filtreleri Temizle
              </Button>
            </Box>
          )}

          {/* Pagination */}
          {data && data.totalPages > 1 && (
            <Group justify="center" mt="xl">
              <Pagination
                total={data.totalPages}
                value={currentPage}
                onChange={setCurrentPage}
                size="lg"
                withEdges
              />
              <Text size="sm" c="dimmed">
                Sayfa {currentPage} / {data.totalPages} ({data.total} ihale)
              </Text>
            </Group>
          )}

          {/* Back Button */}
          <Group justify="center">
            <Button component={Link} href="/" variant="light">
              Ana Sayfaya Dön
            </Button>
          </Group>
        </Stack>

        {/* URL ile İhale Ekleme Modal */}
        <Modal
          opened={addUrlModalOpen}
          onClose={() => {
            setAddUrlModalOpen(false);
            setTenderUrl('');
          }}
          title="URL ile İhale Ekle"
          centered
        >
          <Stack gap="md">
            <TextInput
              label="İhale URL'si"
              placeholder="https://ihalebul.com/tender/123456"
              value={tenderUrl}
              onChange={(e) => setTenderUrl(e.target.value)}
              description="ihalebul.com üzerindeki ihale detay sayfasının URL'sini girin"
              leftSection={<IconLink size={16} />}
            />

            <Paper p="sm" bg="gray.0" radius="md">
              <Text size="xs" c="dimmed">
                <strong>Örnek:</strong> https://ihalebul.com/tender/1768253602118
              </Text>
              <Text size="xs" c="dimmed" mt="xs">
                Bu işlem ihale bilgilerini, döküman linklerini, ihale ilanı ve mal/hizmet listesini
                otomatik olarak çeker.
              </Text>
            </Paper>

            <Group justify="flex-end" mt="md">
              <Button
                variant="light"
                onClick={() => {
                  setAddUrlModalOpen(false);
                  setTenderUrl('');
                }}
              >
                İptal
              </Button>
              <Button
                variant="gradient"
                gradient={{ from: 'teal', to: 'cyan' }}
                leftSection={<IconPlus size={16} />}
                loading={addingTender}
                onClick={handleAddTenderByUrl}
                disabled={!tenderUrl.trim()}
              >
                İhale Ekle
              </Button>
            </Group>
          </Stack>
        </Modal>

        {/* Döküman Çekme Loading Modal */}
        <Modal
          opened={fetchingDocsModalOpen}
          onClose={() => {}} // Kapatılamaz
          centered
          withCloseButton={false}
          size="sm"
        >
          <Stack gap="lg" align="center" py="md">
            <Loader size="lg" color="violet" />
            <Stack gap="xs" align="center">
              <Title order={4}>Dökümanlar Yükleniyor</Title>
              {fetchingDocsTender && (
                <Text size="sm" c="dimmed" ta="center" lineClamp={2}>
                  {fetchingDocsTender.title}
                </Text>
              )}
            </Stack>
            <Paper p="md" bg="violet.0" radius="md" w="100%">
              <Group gap="sm" justify="center">
                <IconCloudDownload size={20} color="var(--mantine-color-violet-6)" />
                <Text size="sm" c="violet.7" fw={500}>
                  {fetchingDocsProgress}
                </Text>
              </Group>
            </Paper>
            <Text size="xs" c="dimmed">
              Bu işlem birkaç saniye sürebilir...
            </Text>
          </Stack>
        </Modal>
      </Container>
    </Box>
  );
}
