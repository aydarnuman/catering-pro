'use client';

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
  IconDownload,
  IconExternalLink,
  IconSearch,
  IconFilter,
  IconX
} from '@tabler/icons-react';
import Link from 'next/link';
import useSWR from 'swr';
import { useState, useMemo } from 'react';
import { apiClient } from '@/lib/api';
import { TendersResponse, Tender } from '@/types/api';

export default function TendersPage() {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [cityFilter, setCityFilter] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const { 
    data, 
    error, 
    isLoading,
    mutate 
  } = useSWR<TendersResponse>(
    ['tenders', currentPage, pageSize], 
    () => apiClient.getTenders({ page: currentPage, limit: pageSize })
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

  // Filter and search tenders
  const filteredTenders = useMemo(() => {
    if (!data?.tenders) return [];
    
    return data.tenders.filter((tender) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          tender.title.toLowerCase().includes(query) ||
          tender.organization.toLowerCase().includes(query) ||
          (tender.city && tender.city.toLowerCase().includes(query)) ||
          (tender.external_id && tender.external_id.toLowerCase().includes(query));
        
        if (!matchesSearch) return false;
      }

      // Status filter
      if (statusFilter) {
        const status = getStatus(tender);
        if (status !== statusFilter) return false;
      }

      // City filter
      if (cityFilter.length > 0 && tender.city) {
        if (!cityFilter.includes(tender.city)) return false;
      }

      return true;
    });
  }, [data?.tenders, searchQuery, statusFilter, cityFilter]);

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
                {filteredTenders.length > 0 
                  ? `${filteredTenders.length} ihale bulundu ${data?.total !== filteredTenders.length ? `(${data?.total} toplam)` : ''}`
                  : 'İhaleler yükleniyor...'}
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
              {/* Search Bar */}
              <TextInput
                placeholder="İhale başlığı, kuruluş, şehir veya ihale no ile ara..."
                leftSection={<IconSearch size={16} />}
                size="md"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                rightSection={
                  searchQuery && (
                    <ActionIcon onClick={() => setSearchQuery('')} variant="subtle">
                      <IconX size={16} />
                    </ActionIcon>
                  )
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
                      {getStatusBadge(tender)}
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
                    <Title order={4} lineClamp={2} h={48}>
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

                      {/* Dökümanlar - Yeni Düzenli Tasarım */}
                      <Stack gap="xs">
                        <Group gap="xs">
                          <IconFileText size={16} />
                          <Text size="sm" fw={500}>Dökümanlar:</Text>
                        </Group>
                        
                        {/* Dökümanları 2 sütunlu grid'de göster */}
                        <Box>
                          <Grid gutter={8}>
                            {/* Teknik Şartname */}
                            {tender.document_links?.tech_spec && (
                              <Grid.Col span={6}>
                                <Button
                                  fullWidth
                                  size="compact-xs"
                                  variant="light"
                                  color="blue"
                                  leftSection={<IconDownload size={12} />}
                                  component="a"
                                  href={`http://localhost:3001/api/documents/download/${tender.id}/tech_spec`}
                                  download
                                  styles={{
                                    root: { height: 28, fontSize: '11px' },
                                    section: { marginRight: 4 }
                                  }}
                                >
                                  Teknik Şartname
                                </Button>
                              </Grid.Col>
                            )}
                            
                            {/* İdari Şartname */}
                            {tender.document_links?.admin_spec && (
                              <Grid.Col span={6}>
                                <Button
                                  fullWidth
                                  size="compact-xs"
                                  variant="light"
                                  color="blue"
                                  leftSection={<IconDownload size={12} />}
                                  component="a"
                                  href={`http://localhost:3001/api/documents/download/${tender.id}/admin_spec`}
                                  download
                                  styles={{
                                    root: { height: 28, fontSize: '11px' },
                                    section: { marginRight: 4 }
                                  }}
                                >
                                  İdari Şartname
                                </Button>
                              </Grid.Col>
                            )}
                            
                            {/* İhale İlanı */}
                            {tender.has_announcement && (
                              <Grid.Col span={6}>
                                <Button
                                  fullWidth
                                  size="compact-xs"
                                  variant="light"
                                  color="violet"
                                  leftSection={<IconDownload size={12} />}
                                  component="a"
                                  href={`http://localhost:3001/api/content/announcement/${tender.id}`}
                                  download
                                  styles={{
                                    root: { height: 28, fontSize: '11px' },
                                    section: { marginRight: 4 }
                                  }}
                                >
                                  İhale İlanı (PDF)
                                </Button>
                              </Grid.Col>
                            )}
                            
                            {/* Mal/Hizmet Listesi */}
                            {tender.has_goods_services && (
                              <Grid.Col span={6}>
                                <Button
                                  fullWidth
                                  size="compact-xs"
                                  variant="light"
                                  color="green"
                                  leftSection={<IconDownload size={12} />}
                                  component="a"
                                  href={`http://localhost:3001/api/content/goods-services/${tender.id}`}
                                  download
                                  styles={{
                                    root: { height: 28, fontSize: '11px' },
                                    section: { marginRight: 4 }
                                  }}
                                >
                                  Mal/Hizmet (CSV)
                                </Button>
                              </Grid.Col>
                            )}
                            
                            {/* Proje Dosyaları */}
                            {tender.document_links?.project_files && (
                              <Grid.Col span={6}>
                                <Button
                                  fullWidth
                                  size="compact-xs"
                                  variant="light"
                                  color="orange"
                                  leftSection={<IconDownload size={12} />}
                                  component="a"
                                  href={`http://localhost:3001/api/documents/download/${tender.id}/project_files`}
                                  download
                                  styles={{
                                    root: { height: 28, fontSize: '11px' },
                                    section: { marginRight: 4 }
                                  }}
                                >
                                  Proje Dosyaları
                                </Button>
                              </Grid.Col>
                            )}
                          </Grid>
                          
                          {/* Hiç döküman yoksa */}
                          {(!tender.document_links || Object.keys(tender.document_links).length === 0) && 
                           !tender.has_announcement && !tender.has_goods_services && (
                            <Paper p="xs" radius="sm" bg="gray.0" ta="center">
                              <Text size="xs" c="dimmed">Döküman bulunamadı</Text>
                            </Paper>
                          )}
                        </Box>
                      </Stack>
                    </Stack>

                    {/* Footer */}
                    <Group justify="space-between" mt="auto" pt="sm">
                      <Text size="xs" c="dimmed">
                        {formatDate(tender.created_at)}
                      </Text>
                      <Text size="xs" c="dimmed">
                        #{tender.external_id}
                      </Text>
                    </Group>
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