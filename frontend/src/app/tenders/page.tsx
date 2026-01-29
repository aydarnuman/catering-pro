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
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconAlertCircle,
  IconArrowsSort,
  IconBuilding,
  IconCalendar,
  IconClock,
  IconCloudDownload,
  IconCurrencyLira,
  IconExternalLink,
  IconFileText,
  IconFilter,
  IconLink,
  IconMap,
  IconMapPin,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconSparkles,
  IconStar,
  IconStarFilled,
  IconX,
} from '@tabler/icons-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { EmptySearch, EmptyState, LoadingState, showError, showSuccess } from '@/components/common';
import { MobileFilterDrawer, MobileHide, MobileShow, MobileStack } from '@/components/mobile';
import TenderMapModal from '@/components/TenderMapModal';
import { useRealtimeRefetch } from '@/context/RealtimeContext';
import { useResponsive } from '@/hooks/useResponsive';
import { api, apiClient } from '@/lib/api';
import { tendersAPI } from '@/lib/api/services/tenders';
import { formatDate } from '@/lib/formatters';
import type { Tender, TendersResponse } from '@/types/api';

// API_URL kaldırıldı - tendersAPI kullanılıyor

export default function TendersPage() {
  const router = useRouter();
  const { isMobile, isTablet, isMounted } = useResponsive();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [cityFilter, setCityFilter] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  // Mobil filtre drawer
  const [mobileFilterOpened, { open: openMobileFilter, close: closeMobileFilter }] =
    useDisclosure(false);

  // URL ile ihale ekleme
  const [addUrlModalOpen, setAddUrlModalOpen] = useState(false);
  const [tenderUrl, setTenderUrl] = useState('');
  const [addingTender, setAddingTender] = useState(false);

  // On-demand döküman çekme
  const [fetchingDocsModalOpen, setFetchingDocsModalOpen] = useState(false);
  const [fetchingDocsTender, setFetchingDocsTender] = useState<Tender | null>(null);
  const [fetchingDocsProgress, setFetchingDocsProgress] = useState<string>('Kontrol ediliyor...');

  // Takip listesi durumları
  const [trackingIds, setTrackingIds] = useState<Set<number>>(new Set());
  const [togglingTrack, setTogglingTrack] = useState<number | null>(null);

  // Harita modal durumu
  const [mapModalOpen, setMapModalOpen] = useState(false);

  // Debounce search - 500ms bekle
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1); // Arama değişince sayfa 1'e dön
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data, error, isLoading, mutate } = useSWR<TendersResponse>(
    ['tenders', currentPage, pageSize, debouncedSearch, statusFilter],
    () =>
      apiClient.getTenders({
        page: currentPage,
        limit: pageSize,
        search: debouncedSearch || undefined,
        status: statusFilter || 'active', // Backend'e status gönder
      }),
    { dedupingInterval: 4000 }
  );

  // 🔴 REALTIME - İhaleler tablosunu dinle
  useRealtimeRefetch('tenders', () => mutate());

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
    () => tendersAPI.getTenderStats(),
    { refreshInterval: 60000 } // Her 1 dakikada yenile
  );

  const [showStats, setShowStats] = useState<'new' | 'updated' | false>(false);

  // Takip listesindeki ihale ID'lerini çek
  const { data: trackingData, mutate: mutateTracking } = useSWR<{
    success: boolean;
    data: Array<{ tender_id: number }>;
  }>('tender-tracking-ids', () => tendersAPI.getTrackingIds(), { revalidateOnFocus: false });

  // Takip ID'lerini Set'e dönüştür
  useEffect(() => {
    if (trackingData?.data) {
      const ids = new Set(trackingData.data.map((t) => t.tender_id));
      setTrackingIds(ids);
    }
  }, [trackingData]);

  // Takibe ekle/çıkar toggle
  const handleToggleTracking = async (e: React.MouseEvent, tender: Tender) => {
    e.stopPropagation(); // Kart tıklamasını engelle
    e.preventDefault();

    const isTracking = trackingIds.has(tender.id);
    setTogglingTrack(tender.id);

    try {
      if (isTracking) {
        // Takipten çıkar - önce tracking ID'yi bul
        const checkData = await tendersAPI.checkTracking(tender.id);

        if (checkData.success && checkData.data) {
          const trackingId = checkData.data.id;

          const deleteData = await tendersAPI.removeTracking(trackingId);

          if (deleteData.success) {
            setTrackingIds((prev) => {
              const newSet = new Set(prev);
              newSet.delete(tender.id);
              return newSet;
            });

            notifications.show({
              title: 'Takipten Çıkarıldı',
              message: `${tender.title?.substring(0, 40)}...`,
              color: 'gray',
            });
          } else {
            throw new Error(deleteData.error || 'Silme başarısız');
          }
        } else {
          // Tracking bulunamadı, UI'dan kaldır
          setTrackingIds((prev) => {
            const newSet = new Set(prev);
            newSet.delete(tender.id);
            return newSet;
          });
        }
      } else {
        // Takibe ekle
        const addData = await tendersAPI.addTracking(tender.id);

        if (addData.success) {
          setTrackingIds((prev) => new Set(prev).add(tender.id));

          notifications.show({
            title: '⭐ Takibe Alındı',
            message: `${tender.title?.substring(0, 40)}...`,
            color: 'yellow',
          });
        } else {
          throw new Error(addData.error || 'Ekleme başarısız');
        }
      }

      mutateTracking();
    } catch (err: any) {
      console.error('Tracking error:', err);
      notifications.show({
        title: 'Hata',
        message: err.message || 'İşlem başarısız oldu',
        color: 'red',
      });
    } finally {
      setTogglingTrack(null);
    }
  };

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
      const res = await api.post('/api/scraper/add-tender', { url: tenderUrl.trim() });
      const data = res.data;

      if (data.success) {
        showSuccess(
          `${data.data.isNew ? 'Yeni ihale eklendi' : 'İhale güncellendi'}: ${data.data.title?.substring(0, 50) || 'İhale'}... (${data.data.documentCount} döküman)`,
          '✅ Başarılı!'
        );
        setAddUrlModalOpen(false);
        setTenderUrl('');
        mutate(); // Listeyi yenile
      } else {
        showError(data.error || 'İhale eklenemedi', { title: 'Hata' });
      }
    } catch (err: any) {
      showError(err, { title: 'İhale Ekleme Hatası' });
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
      const checkRes = await api.get(`/api/scraper/check-documents/${tender.id}`);
      const checkData = checkRes.data;

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

        const fetchRes = await api.post(`/api/scraper/fetch-documents/${tender.id}`);
        const fetchData = fetchRes.data;

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

  const getStatusBadge = (tender: Tender) => {
    const deadline = new Date(tender.deadline);
    const now = new Date();

    // Gün bazlı karşılaştırma (saat değil)
    const deadlineDate = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());
    const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffDays = Math.round(
      (deadlineDate.getTime() - todayDate.getTime()) / (24 * 60 * 60 * 1000)
    );

    if (diffDays < 0) {
      // Geçmiş tarih
      const absDays = Math.abs(diffDays);
      return <Badge color="red">Süresi Dolmuş ({absDays} gün önce)</Badge>;
    } else if (diffDays === 0) {
      return (
        <Badge color="orange" variant="filled">
          🔥 BUGÜN!
        </Badge>
      );
    } else if (diffDays === 1) {
      return (
        <Badge color="yellow" variant="filled">
          ⚠️ YARIN
        </Badge>
      );
    } else if (diffDays <= 3) {
      return <Badge color="yellow">{diffDays} Gün Kaldı</Badge>;
    } else if (diffDays <= 7) {
      return <Badge color="lime">{diffDays} Gün Kaldı</Badge>;
    } else {
      return <Badge color="green">Aktif</Badge>;
    }
  };

  const _getStatus = (tender: Tender) => {
    const deadline = new Date(tender.deadline);
    const now = new Date();

    // Gün bazlı karşılaştırma
    const deadlineDate = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());
    const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (deadlineDate < todayDate) return 'expired';
    if (deadlineDate.getTime() - todayDate.getTime() < 7 * 24 * 60 * 60 * 1000) return 'urgent';
    return 'active';
  };

  // Backend'de filtreleme yapıldığı için client-side filtreleme gerekmiyor
  // Sadece city filter client-side yapılıyor (backend'de multi-select desteği yok)
  const filteredTenders = useMemo(() => {
    if (!data?.tenders) return [];

    // City filter (client-side - backend'de multi-select yok)
    if (cityFilter.length > 0) {
      return data.tenders.filter((tender) => {
        if (!tender.city) return false;
        return cityFilter.includes(tender.city);
      });
    }

    return data.tenders;
  }, [data?.tenders, cityFilter]);

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
        minHeight: '100vh',
      }}
    >
      <Container size="xl" py="xl">
        <Stack gap="xl">
          {/* Header */}
          <MobileStack
            stackOnMobile
            stackOnTablet={false}
            justify="space-between"
            align="flex-start"
          >
            <div>
              <Title order={isMobile ? 2 : 1}>İhale Listesi</Title>
              <Text c="dimmed" size={isMobile ? 'sm' : 'lg'}>
                {isLoading
                  ? 'Aranıyor...'
                  : debouncedSearch
                    ? `"${debouncedSearch}" için ${data?.total || 0} sonuç`
                    : `${data?.total || 0} ihale bulundu`}
              </Text>
            </div>

            {/* Desktop Buttons */}
            <MobileHide hideOnMobile hideOnTablet={false}>
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
                  leftSection={<IconMap size={16} />}
                  variant="gradient"
                  gradient={{ from: 'violet', to: 'indigo' }}
                  onClick={() => setMapModalOpen(true)}
                >
                  Haritada Göster
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
            </MobileHide>

            {/* Mobile Buttons - Compact */}
            <MobileShow showOnMobile showOnTablet={false}>
              <Group gap="xs" w="100%">
                <Button
                  leftSection={<IconFilter size={14} />}
                  variant="light"
                  size="sm"
                  onClick={openMobileFilter}
                  style={{ flex: 1 }}
                >
                  Filtreler
                </Button>
                <ActionIcon variant="light" size="lg" onClick={() => mutate()} loading={isLoading}>
                  <IconRefresh size={16} />
                </ActionIcon>
                <ActionIcon
                  variant="gradient"
                  gradient={{ from: 'violet', to: 'indigo' }}
                  size="lg"
                  onClick={() => setMapModalOpen(true)}
                >
                  <IconMap size={16} />
                </ActionIcon>
                <ActionIcon
                  variant="gradient"
                  gradient={{ from: 'teal', to: 'cyan' }}
                  size="lg"
                  onClick={() => setAddUrlModalOpen(true)}
                >
                  <IconLink size={16} />
                </ActionIcon>
              </Group>
            </MobileShow>
          </MobileStack>

          {/* Bugünün Özeti - Dashboard Kartları - Glassy */}
          {statsData?.data && (
            <SimpleGrid cols={{ base: 3, sm: 4 }} spacing="xs">
              {/* Stat Kartları */}
              <Paper p="xs" radius="lg" className="glassy-card-nested" ta="center">
                <Text size={isMobile ? 'lg' : 'xl'} fw={700} c="blue.4">
                  {statsData.data.totalCount}
                </Text>
                <Text size="xs" c="dimmed">
                  Toplam
                </Text>
              </Paper>

              <Paper
                p="xs"
                radius="lg"
                className="glassy-card-nested"
                ta="center"
                style={{ cursor: statsData.data.today.newCount > 0 ? 'pointer' : 'default' }}
                onClick={() =>
                  statsData.data.today.newCount > 0 &&
                  setShowStats(showStats === 'new' ? false : 'new')
                }
              >
                <Text size={isMobile ? 'lg' : 'xl'} fw={700} c="green.4">
                  {statsData.data.today.newCount}
                </Text>
                <Text size="xs" c="dimmed">
                  Yeni {statsData.data.today.newCount > 0 && '▾'}
                </Text>
              </Paper>

              <Paper
                p="xs"
                radius="lg"
                className="glassy-card-nested"
                ta="center"
                style={{ cursor: statsData.data.today.updatedCount > 0 ? 'pointer' : 'default' }}
                onClick={() =>
                  statsData.data.today.updatedCount > 0 &&
                  setShowStats(showStats === 'updated' ? false : 'updated')
                }
              >
                <Text size={isMobile ? 'lg' : 'xl'} fw={700} c="orange.4">
                  {statsData.data.today.updatedCount}
                </Text>
                <Text size="xs" c="dimmed">
                  Güncellenen {statsData.data.today.updatedCount > 0 && '▾'}
                </Text>
              </Paper>

              <MobileHide hideOnMobile>
                <Paper p="xs" radius="lg" className="glassy-card-nested">
                  <Group gap="xs" justify="center" h="100%" align="center">
                    <IconClock size={14} color="var(--muted)" />
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
              </MobileHide>
            </SimpleGrid>
          )}

          {/* Yeni Eklenen İhaleler - Açılır Liste - Glassy */}
          {statsData?.data && showStats === 'new' && statsData.data.today.newTenders.length > 0 && (
            <Paper
              p="sm"
              radius="lg"
              className="glassy-content-card"
              style={{ borderColor: 'rgba(34, 197, 94, 0.3)' }}
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
                    <Badge
                      size="xs"
                      color="green"
                      variant="light"
                      style={{ minWidth: isMobile ? 50 : 70 }}
                    >
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
          )}

          {/* Güncellenen İhaleler - Açılır Liste - Glassy */}
          {statsData?.data &&
            showStats === 'updated' &&
            statsData.data.today.updatedTenders.length > 0 && (
              <Paper
                p="sm"
                radius="lg"
                className="glassy-content-card"
                style={{ borderColor: 'rgba(249, 115, 22, 0.3)' }}
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
                      <Badge
                        size="xs"
                        color="orange"
                        variant="light"
                        style={{ minWidth: isMobile ? 50 : 70 }}
                      >
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
            )}

          {/* Search and Filters */}
          <Paper shadow="sm" p={isMobile ? 'sm' : 'md'} radius="md" withBorder>
            <Stack gap="md">
              {/* Search Bar - Tüm veritabanında arama yapar */}
              <TextInput
                placeholder={
                  isMobile
                    ? 'İhale ara...'
                    : 'Tüm ihalelerde ara... (başlık, kuruluş, şehir, ihale no)'
                }
                leftSection={<IconSearch size={16} />}
                size={isMobile ? 'sm' : 'md'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                rightSection={
                  isLoading && debouncedSearch ? (
                    <LoadingState loading={true} variant="inline" size="xs" />
                  ) : searchQuery ? (
                    <ActionIcon onClick={() => setSearchQuery('')} variant="subtle" size="md">
                      <IconX size={16} />
                    </ActionIcon>
                  ) : null
                }
              />

              {/* Aktif Filtre Özeti - Mobilde de göster */}
              {(statusFilter || cityFilter.length > 0) && (
                <Group gap="xs" wrap="wrap">
                  <Text size="xs" c="dimmed">
                    Filtreler:
                  </Text>
                  {statusFilter && (
                    <Badge variant="outline" color="violet" size="xs">
                      {statusFilter === 'active'
                        ? 'Güncel'
                        : statusFilter === 'urgent'
                          ? 'Acil'
                          : statusFilter === 'expired'
                            ? 'Dolmuş'
                            : statusFilter === 'archived'
                              ? 'Arşiv'
                              : 'Tümü'}
                    </Badge>
                  )}
                  {cityFilter.length > 0 && (
                    <Badge variant="outline" color="teal" size="xs">
                      {cityFilter.length} şehir
                    </Badge>
                  )}
                  <ActionIcon variant="subtle" size="xs" color="red" onClick={clearFilters}>
                    <IconX size={12} />
                  </ActionIcon>
                </Group>
              )}

              {/* Advanced Filters - Desktop Only */}
              <MobileHide hideOnMobile>
                <Collapse in={showFilters}>
                  <Stack gap="md">
                    {/* Hızlı Durum Filtreleri */}
                    <Box>
                      <Text size="sm" fw={500} mb="xs" c="dimmed">
                        Hızlı Filtreler
                      </Text>
                      <Group gap="xs" wrap="wrap">
                        <Badge
                          size="lg"
                          variant={!statusFilter || statusFilter === 'active' ? 'filled' : 'light'}
                          color="blue"
                          style={{ cursor: 'pointer' }}
                          onClick={() => setStatusFilter('active')}
                        >
                          📅 Güncel İhaleler
                        </Badge>
                        <Badge
                          size="lg"
                          variant={statusFilter === 'urgent' ? 'filled' : 'light'}
                          color="orange"
                          style={{ cursor: 'pointer' }}
                          onClick={() => setStatusFilter('urgent')}
                        >
                          ⚡ Bu Hafta Dolacak
                        </Badge>
                        <Badge
                          size="lg"
                          variant={statusFilter === 'expired' ? 'filled' : 'light'}
                          color="red"
                          style={{ cursor: 'pointer' }}
                          onClick={() => setStatusFilter('expired')}
                        >
                          ⏰ Süresi Dolmuş
                        </Badge>
                        <Badge
                          size="lg"
                          variant={statusFilter === 'all' ? 'filled' : 'light'}
                          color="gray"
                          style={{ cursor: 'pointer' }}
                          onClick={() => setStatusFilter('all')}
                        >
                          📋 Tümü
                        </Badge>
                      </Group>
                    </Box>

                    <Divider />

                    {/* Detaylı Filtreler */}
                    <Grid>
                      <Grid.Col span={{ base: 12, md: 4 }}>
                        <Select
                          label="İhale Durumu"
                          placeholder="Varsayılan: Güncel İhaleler"
                          value={statusFilter}
                          onChange={setStatusFilter}
                          clearable
                          leftSection={<IconFilter size={16} />}
                          data={[
                            {
                              group: 'Aktif İhaleler',
                              items: [
                                {
                                  value: 'active',
                                  label: '📅 Güncel İhaleler (Aktif + Son 1 Hafta)',
                                },
                                { value: 'urgent', label: '⚡ Bu Hafta Dolacaklar (Acil)' },
                              ],
                            },
                            {
                              group: 'Geçmiş İhaleler',
                              items: [
                                { value: 'expired', label: '⏰ Süresi Dolmuş (Tümü)' },
                                { value: 'archived', label: '📦 Arşiv (1 Haftadan Eski)' },
                              ],
                            },
                            {
                              group: 'Diğer',
                              items: [{ value: 'all', label: '📋 Tüm İhaleler' }],
                            },
                          ]}
                        />
                      </Grid.Col>
                      <Grid.Col span={{ base: 12, md: 4 }}>
                        <MultiSelect
                          label="Şehir Filtresi"
                          placeholder="Tüm şehirler"
                          value={cityFilter}
                          onChange={setCityFilter}
                          data={availableCities}
                          searchable
                          clearable
                          maxDropdownHeight={300}
                          leftSection={<IconMapPin size={16} />}
                          nothingFoundMessage="Şehir bulunamadı"
                        />
                      </Grid.Col>
                      <Grid.Col span={{ base: 12, md: 4 }}>
                        <Select
                          label="Sıralama"
                          placeholder="Varsayılan sıralama"
                          value={null}
                          onChange={() => {}}
                          disabled
                          leftSection={<IconArrowsSort size={16} />}
                          data={[
                            { value: 'deadline_asc', label: '📆 Tarihe Göre (Yakın → Uzak)' },
                            { value: 'deadline_desc', label: '📆 Tarihe Göre (Uzak → Yakın)' },
                            { value: 'created_desc', label: '🆕 Yeni Eklenenler Önce' },
                          ]}
                        />
                      </Grid.Col>
                    </Grid>
                  </Stack>
                </Collapse>
              </MobileHide>
            </Stack>
          </Paper>

          {/* Mobile Filter Drawer */}
          <MobileFilterDrawer
            opened={mobileFilterOpened}
            onClose={closeMobileFilter}
            title="İhale Filtreleri"
            onApply={closeMobileFilter}
            onReset={clearFilters}
          >
            <Stack gap="lg">
              {/* Hızlı Durum Filtreleri */}
              <Box>
                <Text size="sm" fw={500} mb="sm">
                  İhale Durumu
                </Text>
                <Stack gap="xs">
                  {[
                    { value: 'active', label: '📅 Güncel İhaleler', color: 'blue' },
                    { value: 'urgent', label: '⚡ Bu Hafta Dolacak', color: 'orange' },
                    { value: 'expired', label: '⏰ Süresi Dolmuş', color: 'red' },
                    { value: 'all', label: '📋 Tüm İhaleler', color: 'gray' },
                  ].map((item) => (
                    <Paper
                      key={item.value}
                      p="sm"
                      radius="md"
                      withBorder
                      style={{
                        cursor: 'pointer',
                        borderColor:
                          statusFilter === item.value
                            ? `var(--mantine-color-${item.color}-5)`
                            : undefined,
                        backgroundColor:
                          statusFilter === item.value
                            ? `var(--mantine-color-${item.color}-0)`
                            : undefined,
                      }}
                      onClick={() => setStatusFilter(item.value)}
                    >
                      <Text size="sm" fw={statusFilter === item.value ? 600 : 400}>
                        {item.label}
                      </Text>
                    </Paper>
                  ))}
                </Stack>
              </Box>

              <Divider />

              {/* Şehir Filtresi */}
              <MultiSelect
                label="Şehir Filtresi"
                placeholder="Şehir seçin"
                value={cityFilter}
                onChange={setCityFilter}
                data={availableCities}
                searchable
                clearable
                maxDropdownHeight={200}
                leftSection={<IconMapPin size={16} />}
              />
            </Stack>
          </MobileFilterDrawer>

          {/* Error Alert */}
          {error && (
            <Alert icon={<IconAlertCircle size={16} />} title="Bağlantı Hatası" color="red">
              İhaleler yüklenemedi: {error.message}
            </Alert>
          )}

          {/* Loading State */}
          {isLoading && <LoadingState loading={true} message="İhaleler yükleniyor..." />}

          {/* Tenders Grid - Glassy */}
          {filteredTenders.length > 0 && (
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing={isMobile ? 'sm' : 'md'}>
              {filteredTenders.map((tender) => (
                <Card
                  key={tender.id}
                  padding={isMobile ? 'sm' : 'lg'}
                  radius="lg"
                  h="100%"
                  className="glassy-card"
                  style={{
                    cursor: 'pointer',
                    borderColor: trackingIds.has(tender.id)
                      ? 'rgba(250, 204, 21, 0.5)'
                      : undefined,
                    borderWidth: trackingIds.has(tender.id) ? 2 : undefined,
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
                        {/* Takip Yıldızı */}
                        <ActionIcon
                          variant="transparent"
                          color={trackingIds.has(tender.id) ? 'yellow' : 'gray'}
                          size="xs"
                          loading={togglingTrack === tender.id}
                          onClick={(e) => handleToggleTracking(e, tender)}
                          title={trackingIds.has(tender.id) ? 'Takipten Çıkar' : 'Takibe Al'}
                          style={{
                            opacity: trackingIds.has(tender.id) ? 1 : 0.4,
                            transition: 'all 0.2s ease',
                          }}
                        >
                          {trackingIds.has(tender.id) ? (
                            <IconStarFilled size={16} style={{ color: '#fab005' }} />
                          ) : (
                            <IconStar size={16} />
                          )}
                        </ActionIcon>
                        {tender.url && (
                          <ActionIcon
                            size="sm"
                            variant="subtle"
                            component="a"
                            href={tender.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="İhale sayfasını aç"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <IconExternalLink size={14} />
                          </ActionIcon>
                        )}
                        <Text size="xs" c="dimmed">
                          #{tender.id}
                        </Text>
                      </Group>
                    </Group>

                    {/* Title - Tıklandığında on-demand döküman çekme */}
                    <Title
                      order={isMobile ? 5 : 4}
                      lineClamp={2}
                      h={isMobile ? 40 : 48}
                      style={{
                        cursor: 'pointer',
                        transition: 'color 0.2s',
                      }}
                      onClick={() => handleTenderClick(tender)}
                      onMouseEnter={(e) => {
                        if (!isMobile) e.currentTarget.style.color = '#228be6';
                      }}
                      onMouseLeave={(e) => {
                        if (!isMobile) e.currentTarget.style.color = '';
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
                          {tender.deadline
                            ? formatDate(tender.deadline, 'datetime')
                            : 'Belirtilmemiş'}
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
                          {formatDate(tender.created_at, 'datetime')}
                        </Text>
                        <Text size="xs" c="dimmed">
                          #{tender.external_id}
                        </Text>
                      </Group>
                    </Stack>
                  </Stack>
                </Card>
              ))}
            </SimpleGrid>
          )}

          {/* Empty State */}
          {data?.tenders && data.tenders.length === 0 && (
            <EmptyState
              title="Henüz ihale bulunmuyor"
              description="İhale verileri scraper ile toplanacak"
              icon={<IconFileText size={48} />}
              iconColor="blue"
            />
          )}

          {/* No Results State */}
          {data?.tenders && data.tenders.length > 0 && filteredTenders.length === 0 && (
            <EmptySearch
              query={debouncedSearch}
              action={{
                label: 'Filtreleri Temizle',
                onClick: clearFilters,
              }}
            />
          )}

          {/* Pagination */}
          {data && data.totalPages > 1 && (
            <Stack gap="sm" align="center" mt="xl">
              <Pagination
                total={data.totalPages}
                value={currentPage}
                onChange={setCurrentPage}
                size={isMobile ? 'sm' : 'lg'}
                withEdges={!isMobile}
                siblings={isMobile ? 0 : 1}
                boundaries={isMobile ? 1 : 2}
              />
              <Text size="xs" c="dimmed">
                Sayfa {currentPage} / {data.totalPages} ({data.total} ihale)
              </Text>
            </Stack>
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

            <Paper p="sm" radius="md" className="nested-card">
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

        {/* Harita Modal */}
        <TenderMapModal
          opened={mapModalOpen}
          onClose={() => setMapModalOpen(false)}
          tenders={data?.tenders || []}
        />
      </Container>
    </Box>
  );
}
