'use client';

import {
  ActionIcon,
  Badge,
  Box,
  Collapse,
  Group,
  Loader,
  Pagination,
  Paper,
  ScrollArea,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import {
  IconBookmark,
  IconLayoutRows,
  IconLink,
  IconList,
  IconMap,
  IconRefresh,
  IconSearch,
  IconX,
} from '@tabler/icons-react';
import { useCallback, useMemo, useState } from 'react';
import type { Tender } from '@/types/api';
import type { IhaleMerkeziState, SavedTender } from '../types';
import { TenderListItem } from './TenderListItem';

interface LeftPanelProps {
  state: IhaleMerkeziState;
  loading: boolean;
  totalPages: number;
  totalCount: number;
  onStateChange: (updates: Partial<IhaleMerkeziState>) => void;
  onSelectTender: (tender: Tender | SavedTender | null) => void;
  onRefresh: () => void;
  onToggleTracking?: (tenderId: number, isCurrentlyTracked: boolean) => void;
  isMobile?: boolean;
}

export function LeftPanel({
  state,
  loading,
  totalPages,
  totalCount,
  onStateChange,
  onSelectTender,
  onRefresh,
  onToggleTracking,
  isMobile = false,
}: LeftPanelProps) {
  const [searchInput, setSearchInput] = useState(state.searchQuery);
  const [expandAll, setExpandAll] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  // Toggle expand for a single card
  const toggleExpand = useCallback((tenderId: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(tenderId)) {
        next.delete(tenderId);
      } else {
        next.add(tenderId);
      }
      return next;
    });
  }, []);

  // Check if a card is expanded (individual override OR expandAll)
  const isCardExpanded = useCallback(
    (tenderId: number) => {
      if (expandAll) return !expandedIds.has(tenderId); // expandAll: individual toggle collapses
      return expandedIds.has(tenderId); // normal: individual toggle expands
    },
    [expandAll, expandedIds]
  );

  // Current list based on active tab
  const currentList = useMemo((): (Tender | SavedTender)[] => {
    if (state.activeTab === 'tracked') {
      return state.trackedTenders;
    }
    return state.allTenders;
  }, [state.activeTab, state.allTenders, state.trackedTenders]);

  // Filter list by search and filters
  const filteredList = useMemo(() => {
    let list: (Tender | SavedTender)[] = currentList;

    // Search filter
    if (searchInput.trim()) {
      const query = searchInput.toLowerCase();
      list = list.filter((tender) => {
        const title = 'title' in tender ? tender.title : tender.ihale_basligi;
        const org = 'organization' in tender ? tender.organization : tender.kurum;
        const city = tender.city || '';
        const extId = ('external_id' in tender ? tender.external_id : '') || '';

        return (
          title?.toLowerCase().includes(query) ||
          org?.toLowerCase().includes(query) ||
          city.toLowerCase().includes(query) ||
          extId.toLowerCase().includes(query)
        );
      });
    }

    // City filter - backend'de yapılıyor, local filter'a gerek yok
    // if (state.filters.city?.length) {
    //   list = list.filter((tender) => tender.city && state.filters.city?.includes(tender.city));
    // }

    // Status filter (date-based) - "sonuclanan" backend'de filtreleniyor, local'e gerek yok
    if (state.filters.status && state.filters.status !== 'sonuclanan') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      list = list.filter((tender) => {
        // SavedTender uses 'tarih', Tender uses 'tender_date' or 'deadline'
        const dateStr =
          'tarih' in tender
            ? tender.tarih
            : 'tender_date' in tender
              ? tender.tender_date
              : tender.deadline;
        if (!dateStr) return state.filters.status === 'dolmus';

        const tenderDate = new Date(dateStr);
        const daysDiff = Math.ceil(
          (tenderDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (state.filters.status === 'guncel') return daysDiff > 3;
        if (state.filters.status === 'yaklasan') return daysDiff >= 0 && daysDiff <= 3;
        if (state.filters.status === 'dolmus') return daysDiff < 0;
        return true;
      });
    }

    return list;
  }, [currentList, searchInput, state.filters]);

  // Handle search
  const handleSearch = (value: string) => {
    setSearchInput(value);
    // Debounce for API search
    if (state.activeTab === 'all') {
      const timer = setTimeout(() => {
        onStateChange({ searchQuery: value, currentPage: 1 });
      }, 500);
      return () => clearTimeout(timer);
    }
  };

  // City options from tenders
  const cityOptions = useMemo(() => {
    const cities = new Set<string>();
    state.allTenders.forEach((t) => {
      if (t.city) cities.add(t.city);
    });
    state.trackedTenders.forEach((t) => {
      if (t.city) cities.add(t.city);
    });
    return Array.from(cities)
      .sort()
      .map((city) => ({ value: city, label: city }));
  }, [state.allTenders, state.trackedTenders]);

  // Status options
  const statusOptions = [
    { value: 'guncel', label: '🟢 Güncel' },
    { value: 'yaklasan', label: '🟡 Yaklaşan' },
    { value: 'dolmus', label: '🔴 Dolmuş' },
    { value: 'sonuclanan', label: '🏆 Sonuçlanan' },
  ];

  // Stats data
  const stats = state.statsData;

  return (
    <Box
      style={{
        borderRight: isMobile ? 'none' : '1px solid var(--mantine-color-default-border)',
        height: '100%',
        minHeight: 0, // Critical for CSS Grid scroll
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: 'rgba(24, 24, 27, 0.85)',
        backdropFilter: 'blur(8px)',
      }}
    >
      {/* Header - Stats */}
      {stats && (
        <Box p="xs" style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
          <SimpleGrid cols={3} spacing={4}>
            <Paper
              p={6}
              radius="md"
              className="glassy-card-nested"
              ta="center"
              style={{ cursor: 'default' }}
            >
              <Text size="lg" fw={700} c="blue.5">
                {stats.totalCount}
              </Text>
              <Text size="xs" c="dimmed">
                Toplam
              </Text>
            </Paper>
            <Paper
              p={6}
              radius="md"
              className="glassy-card-nested"
              ta="center"
              style={{ cursor: stats.today.newCount > 0 ? 'pointer' : 'default' }}
              onClick={() =>
                stats.today.newCount > 0 &&
                onStateChange({ showStats: state.showStats === 'new' ? false : 'new' })
              }
            >
              <Text size="lg" fw={700} c="green.5">
                {stats.today.newCount}
              </Text>
              <Text size="xs" c="dimmed">
                Yeni {stats.today.newCount > 0 && '▾'}
              </Text>
            </Paper>
            <Paper
              p={6}
              radius="md"
              className="glassy-card-nested"
              ta="center"
              style={{ cursor: stats.today.updatedCount > 0 ? 'pointer' : 'default' }}
              onClick={() =>
                stats.today.updatedCount > 0 &&
                onStateChange({ showStats: state.showStats === 'updated' ? false : 'updated' })
              }
            >
              <Text size="lg" fw={700} c="orange.5">
                {stats.today.updatedCount}
              </Text>
              <Text size="xs" c="dimmed">
                Güncellenen {stats.today.updatedCount > 0 && '▾'}
              </Text>
            </Paper>
          </SimpleGrid>

          {/* Expanded stats list */}
          <Collapse in={state.showStats === 'new' && stats.today.newTenders.length > 0}>
            <Paper
              p="xs"
              mt="xs"
              radius="md"
              style={{ background: 'rgba(34, 197, 94, 0.1)', maxHeight: 150 }}
            >
              <Text size="xs" fw={600} c="green.7" mb={4}>
                Bugün Eklenen
              </Text>
              <ScrollArea h={100}>
                <Stack gap={2}>
                  {stats.today.newTenders.slice(0, 5).map((t) => (
                    <Group key={t.id} gap={4} wrap="nowrap">
                      <Badge size="xs" color="green" variant="light" style={{ minWidth: 50 }}>
                        {t.city}
                      </Badge>
                      <Text
                        size="xs"
                        lineClamp={1}
                        style={{ cursor: 'pointer', flex: 1 }}
                        onClick={() => {
                          // Find and select this tender
                          const tender = state.allTenders.find((x) => x.id === t.id);
                          if (tender) onSelectTender(tender);
                        }}
                      >
                        {t.title}
                      </Text>
                    </Group>
                  ))}
                </Stack>
              </ScrollArea>
            </Paper>
          </Collapse>

          <Collapse in={state.showStats === 'updated' && stats.today.updatedTenders.length > 0}>
            <Paper
              p="xs"
              mt="xs"
              radius="md"
              style={{ background: 'rgba(249, 115, 22, 0.1)', maxHeight: 150 }}
            >
              <Text size="xs" fw={600} c="orange.7" mb={4}>
                Bugün Güncellenen
              </Text>
              <ScrollArea h={100}>
                <Stack gap={2}>
                  {stats.today.updatedTenders.slice(0, 5).map((t) => (
                    <Group key={t.id} gap={4} wrap="nowrap">
                      <Badge size="xs" color="orange" variant="light" style={{ minWidth: 50 }}>
                        {t.city}
                      </Badge>
                      <Text
                        size="xs"
                        lineClamp={1}
                        style={{ cursor: 'pointer', flex: 1 }}
                        onClick={() => {
                          const tender = state.allTenders.find((x) => x.id === t.id);
                          if (tender) onSelectTender(tender);
                        }}
                      >
                        {t.title}
                      </Text>
                    </Group>
                  ))}
                </Stack>
              </ScrollArea>
            </Paper>
          </Collapse>
        </Box>
      )}

      {/* Tab Switcher */}
      <Box p="xs" style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
        <SegmentedControl
          fullWidth
          size="xs"
          value={state.activeTab}
          onChange={(value) => onStateChange({ activeTab: value as 'all' | 'tracked' })}
          data={[
            {
              value: 'all',
              label: (
                <Group gap={4} justify="center">
                  <IconList size={14} />
                  <span>Tümü</span>
                  <Badge size="xs" variant="light" color="blue">
                    {totalCount}
                  </Badge>
                </Group>
              ),
            },
            {
              value: 'tracked',
              label: (
                <Group gap={4} justify="center">
                  <IconBookmark size={14} />
                  <span>Takip</span>
                  <Badge size="xs" variant="light" color="yellow">
                    {state.trackedTenders.length}
                  </Badge>
                </Group>
              ),
            },
          ]}
        />
      </Box>

      {/* Action Buttons - Arama üstünde */}
      <Box px="xs" py={6} style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
        <Group gap={6} justify="space-between">
          <Group gap={6}>
            <Tooltip label="Tüm ihaleleri haritada görüntüle" position="bottom">
              <Badge
                variant="light"
                color="violet"
                size="sm"
                leftSection={<IconMap size={12} />}
                style={{ cursor: 'pointer' }}
                onClick={() => onStateChange({ mapModalOpen: true })}
              >
                Harita
              </Badge>
            </Tooltip>
            <Tooltip label="EKAP URL'si ile yeni ihale ekle" position="bottom">
              <Badge
                variant="light"
                color="teal"
                size="sm"
                leftSection={<IconLink size={12} />}
                style={{ cursor: 'pointer' }}
                onClick={() => onStateChange({ addUrlModalOpen: true })}
              >
                Ekle
              </Badge>
            </Tooltip>
            <Tooltip label={expandAll ? 'Kartları daralt' : 'Kart detaylarını göster'} position="bottom">
              <Badge
                variant={expandAll ? 'filled' : 'light'}
                color="gray"
                size="sm"
                leftSection={<IconLayoutRows size={12} />}
                style={{ cursor: 'pointer' }}
                onClick={() => {
                  setExpandAll(!expandAll);
                  setExpandedIds(new Set()); // Reset individual overrides
                }}
              >
                Detay
              </Badge>
            </Tooltip>
          </Group>
          <Tooltip
            label={`Tıkla: Yenile | Son: ${stats?.lastUpdate ? new Date(stats.lastUpdate).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '--:--'}`}
            position="bottom"
          >
            <Badge
              variant="light"
              color="blue"
              size="sm"
              leftSection={
                <IconRefresh
                  size={12}
                  style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }}
                />
              }
              style={{ cursor: 'pointer', opacity: loading ? 0.7 : 1 }}
              onClick={onRefresh}
            >
              {stats?.lastUpdate
                ? new Date(stats.lastUpdate).toLocaleTimeString('tr-TR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'Yenile'}
            </Badge>
          </Tooltip>
        </Group>
      </Box>

      {/* Search & Filters */}
      <Box p="xs" style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
        <Stack gap="xs">
          <TextInput
            placeholder="İhale ara..."
            size="xs"
            leftSection={<IconSearch size={14} />}
            rightSection={
              searchInput ? (
                <ActionIcon size="xs" variant="subtle" onClick={() => handleSearch('')}>
                  <IconX size={12} />
                </ActionIcon>
              ) : null
            }
            value={searchInput}
            onChange={(e) => handleSearch(e.target.value)}
          />

          {/* Filters */}
          <Group gap="xs">
            <Select
              placeholder="Şehir"
              size="xs"
              clearable
              searchable
              style={{ flex: 1 }}
              value={state.filters.city?.[0] || null}
              onChange={(value) =>
                onStateChange({
                  filters: { ...state.filters, city: value ? [value] : undefined },
                  currentPage: 1,
                })
              }
              data={cityOptions}
            />
            <Select
              placeholder="Durum"
              size="xs"
              clearable
              style={{ flex: 1 }}
              value={state.filters.status || null}
              onChange={(value) => {
                // "Sonuçlanan" seçildiğinde backend'den completed ihaleleri çek
                const isCompleted = value === 'sonuclanan';
                onStateChange({
                  filters: {
                    ...state.filters,
                    status: value || undefined,
                    apiStatus: isCompleted ? 'completed' : undefined,
                  },
                  currentPage: 1,
                });
              }}
              data={statusOptions}
            />
          </Group>
        </Stack>
      </Box>

      {/* Tender List */}
      <ScrollArea style={{ flex: 1 }} offsetScrollbars>
        <Stack gap={0} p="xs">
          {loading ? (
            <Box ta="center" py="xl">
              <Loader size="sm" />
              <Text size="xs" c="dimmed" mt="xs">
                Yükleniyor...
              </Text>
            </Box>
          ) : filteredList.length === 0 ? (
            <Box ta="center" py="xl">
              <IconList size={32} color="var(--mantine-color-gray-5)" />
              <Text size="sm" c="dimmed" mt="xs">
                {searchInput ? 'Sonuç bulunamadı' : 'Henüz ihale yok'}
              </Text>
            </Box>
          ) : (
            filteredList.map((tender) => {
              const tid = 'tender_id' in tender ? tender.tender_id : tender.id;
              return (
                <TenderListItem
                  key={'tender_id' in tender ? tender.id : tender.id}
                  tender={tender}
                  isSelected={state.selectedTenderId === tid}
                  isTracked={state.trackedTenders.some((t) => t.tender_id === tid)}
                  isExpanded={isCardExpanded(tid)}
                  onClick={() => onSelectTender(tender)}
                  onToggleExpand={() => toggleExpand(tid)}
                  onToggleTracking={onToggleTracking}
                />
              );
            })
          )}
        </Stack>
      </ScrollArea>

      {/* Pagination - Only for "all" tab */}
      {state.activeTab === 'all' && totalPages > 1 && (
        <Box p="xs" style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}>
          <Pagination
            total={totalPages}
            value={state.currentPage}
            onChange={(page) => onStateChange({ currentPage: page })}
            size="xs"
            siblings={0}
            boundaries={1}
          />
        </Box>
      )}
    </Box>
  );
}
