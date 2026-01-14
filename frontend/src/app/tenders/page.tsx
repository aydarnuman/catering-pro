'use client';

import { API_BASE_URL } from '@/lib/config';
import { 
  Container, 
  Title, 
  Text,
  Card,
  Badge,
  Group,
  Stack,
  Button,
  Grid,
  Loader,
  Alert,
  Box,
  Divider,
  Pagination,
  TextInput,
  Select,
  MultiSelect,
  Paper,
  Collapse,
  ActionIcon
} from '@mantine/core';
import { 
  IconCalendar,
  IconMapPin,
  IconCurrencyLira,
  IconBuilding,
  IconAlertCircle,
  IconRefresh,
  IconFileText,
  IconExternalLink,
  IconSearch,
  IconFilter,
  IconX,
  IconSparkles
} from '@tabler/icons-react';
import Link from 'next/link';
import useSWR from 'swr';
import { useState, useMemo, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { TendersResponse, Tender } from '@/types/api';

const API_URL = API_BASE_URL;

export default function TendersPage() {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [cityFilter, setCityFilter] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  // Debounce search - 500ms bekle
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1); // Arama değişince sayfa 1'e dön
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { 
    data, 
    error, 
    isLoading,
    mutate 
  } = useSWR<TendersResponse>(
    ['tenders', currentPage, pageSize, debouncedSearch], 
    () => apiClient.getTenders({ 
      page: currentPage, 
      limit: pageSize,
      search: debouncedSearch || undefined
    })
  );

  const formatCurrency = (amount?: number) => {
    if (!amount) return 'Belirtilmemiş';
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (tender: Tender) => {
    const deadline = new Date(tender.deadline);
    const now = new Date();
    
    if (deadline < now) {
      return <Badge color="red">Süresi Dolmuş</Badge>;
    } else if (deadline.getTime() - now.getTime() < 7 * 24 * 60 * 60 * 1000) {
      return <Badge color="yellow">Son 7 Gün</Badge>;
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
  }, [data?.tenders, statusFilter, cityFilter]);

  // Get unique cities for filter
  const availableCities = useMemo(() => {
    if (!data?.tenders) return [];
    const cities = new Set(data.tenders.map(t => t.city).filter(Boolean) as string[]);
    return Array.from(cities).sort();
  }, [data?.tenders]);

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter(null);
    setCityFilter([]);
  };

  return (
    <Box style={{ background: 'linear-gradient(180deg, rgba(34,139,230,0.03) 0%, rgba(255,255,255,0) 100%)', minHeight: '100vh' }}>
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
            </Group>
          </Group>

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
          <Alert 
            icon={<IconAlertCircle size={16} />} 
            title="Bağlantı Hatası" 
            color="red"
          >
            İhaleler yüklenemedi: {error.message}
          </Alert>
        )}

        {/* Loading State */}
        {isLoading && (
          <Box ta="center" py="xl">
            <Loader size="lg" />
            <Text mt="md" c="dimmed">İhaleler yükleniyor...</Text>
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
                        <Text size="xs" c="dimmed">#{tender.id}</Text>
                      </Group>
                    </Group>

                    {/* Title */}
                    <Link 
                      href={`/tenders/${tender.id}`} 
                      style={{ textDecoration: 'none', color: 'inherit' }}
                    >
                      <Title 
                        order={4} 
                        lineClamp={2} 
                        h={48}
                        style={{ 
                          cursor: 'pointer',
                          transition: 'color 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = '#228be6';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = '';
                        }}
                      >
                        {tender.title}
                      </Title>
                    </Link>

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
                        <Text size="sm" fw={500}>Teklif tarihi:</Text>
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
                              : 'Belirtilmemiş'
                            }
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
                        component={Link}
                        href={`/tenders/${tender.id}`}
                        variant="light"
                        fullWidth
                        leftSection={<IconFileText size={16} />}
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
            <Text mt="md" size="lg" fw={500}>Henüz ihale bulunmuyor</Text>
            <Text c="dimmed">İhale verileri scraper ile toplanacak</Text>
          </Box>
        )}

        {/* No Results State */}
        {data?.tenders && data.tenders.length > 0 && filteredTenders.length === 0 && (
          <Box ta="center" py="xl">
            <IconSearch size={48} color="gray" />
            <Text mt="md" size="lg" fw={500}>Arama sonucu bulunamadı</Text>
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
    </Container>
    </Box>
  );
}