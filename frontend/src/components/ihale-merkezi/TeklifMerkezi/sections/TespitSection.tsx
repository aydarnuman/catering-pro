'use client';

import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Checkbox,
  Group,
  Loader,
  NumberInput,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import {
  IconCheck,
  IconEdit,
  IconRefresh,
  IconSparkles,
} from '@tabler/icons-react';
import { useState } from 'react';
import type { UseTeklifMerkeziReturn } from '../hooks/useTeklifMerkezi';

interface TespitSectionProps {
  ctx: UseTeklifMerkeziReturn;
}

export function TespitSection({ ctx }: TespitSectionProps) {
  const {
    detectedValues,
    setDetectedValues,
    selectedSuggestionKeys,
    setSelectedSuggestionKeys,
    suggestionsLoading,
    fetchSuggestions,
    applySuggestions,
    saving,
    isSuresi,
    toplamOgun,
    teknikSartSayisi,
    birimFiyatSayisi,
    hesaplamaState,
    ogunBasiMaliyet,
    isSuresiAy,
  } = ctx;

  const [editMode, setEditMode] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<number | string>('');

  const handleEditSave = (key: string) => {
    setDetectedValues((prev) =>
      prev.map((v) => (v.key === key ? { ...v, value: editValue as number } : v))
    );
    setEditMode(null);
  };

  const getSourceColor = (source: string) => {
    switch (source) {
      case 'sartname': return 'blue';
      case 'analiz': return 'teal';
      case 'hesaplama': return 'violet';
      case 'scraper': return 'gray';
      default: return 'gray';
    }
  };

  const getSourceLabel = (source: string) => {
    switch (source) {
      case 'sartname': return 'Şartname';
      case 'analiz': return 'Analiz';
      case 'hesaplama': return 'Hesaplama';
      case 'scraper': return 'Scraper';
      default: return source;
    }
  };

  const formatValue = (value: string | number | null, type: string) => {
    if (value === null || value === undefined) return '—';
    if (type === 'currency') return `${Number(value).toLocaleString('tr-TR')} ₺`;
    return String(value);
  };

  return (
    <Stack gap="lg">
      {/* ─── Döküman Analiz Özeti ─── */}
      <Paper p="lg" withBorder radius="md" bg="rgba(20, 184, 166, 0.03)" style={{ borderColor: 'var(--mantine-color-teal-8)' }}>
        <Group gap="xs" mb="md">
          <ThemeIcon size="lg" variant="light" color="teal">
            <IconSparkles size={20} />
          </ThemeIcon>
          <div>
            <Text size="md" fw={600}>Döküman Analizi</Text>
            <Text size="xs" c="dimmed">AI tarafından tespit edilen veriler</Text>
          </div>
          <Box style={{ flex: 1 }} />
          <Tooltip label="Yeniden analiz et">
            <ActionIcon variant="subtle" color="teal" onClick={fetchSuggestions} loading={suggestionsLoading}>
              <IconRefresh size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>

        <SimpleGrid cols={{ base: 2, md: 4 }} spacing="md">
          {isSuresi && (
            <Paper p="sm" radius="md" bg="var(--mantine-color-dark-7)">
              <Text size="xs" c="dimmed">İş Süresi</Text>
              <Text size="md" fw={600}>{isSuresi}</Text>
              {isSuresiAy > 0 && <Text size="xs" c="dimmed">{isSuresiAy} ay</Text>}
            </Paper>
          )}
          {toplamOgun > 0 && (
            <Paper p="sm" radius="md" bg="var(--mantine-color-dark-7)">
              <Text size="xs" c="dimmed">Toplam Öğün</Text>
              <Text size="md" fw={600}>{(toplamOgun / 1000000).toFixed(1)}M</Text>
              <Text size="xs" c="dimmed">{toplamOgun.toLocaleString('tr-TR')} öğün</Text>
            </Paper>
          )}
          {teknikSartSayisi > 0 && (
            <Paper p="sm" radius="md" bg="var(--mantine-color-dark-7)">
              <Text size="xs" c="dimmed">Teknik Şart</Text>
              <Text size="md" fw={600}>{teknikSartSayisi}</Text>
              <Text size="xs" c="dimmed">madde</Text>
            </Paper>
          )}
          {birimFiyatSayisi > 0 && (
            <Paper p="sm" radius="md" bg="var(--mantine-color-dark-7)">
              <Text size="xs" c="dimmed">Birim Fiyat Kalemi</Text>
              <Text size="md" fw={600}>{birimFiyatSayisi}</Text>
              <Text size="xs" c="dimmed">kalem</Text>
            </Paper>
          )}
          {hesaplamaState.yaklasikMaliyet > 0 && (
            <Paper p="sm" radius="md" bg="var(--mantine-color-dark-7)">
              <Text size="xs" c="dimmed">Yaklaşık Maliyet</Text>
              <Text size="md" fw={600}>{hesaplamaState.yaklasikMaliyet.toLocaleString('tr-TR')} ₺</Text>
            </Paper>
          )}
          {ogunBasiMaliyet > 0 && (
            <Paper p="sm" radius="md" bg="var(--mantine-color-dark-7)">
              <Text size="xs" c="dimmed">Öğün Başı Maliyet</Text>
              <Text size="md" fw={600}>{ogunBasiMaliyet.toFixed(2)} ₺</Text>
            </Paper>
          )}
        </SimpleGrid>
      </Paper>

      {/* ─── Tespit Edilen Değerler ─── */}
      <Paper p="lg" withBorder radius="md">
        <Group justify="space-between" mb="md">
          <Text size="md" fw={600}>Tespit Edilen Değerler</Text>
          <Badge size="sm" variant="light" color="teal">
            {detectedValues.length} değer
          </Badge>
        </Group>

        {suggestionsLoading ? (
          <Box ta="center" py="xl">
            <Loader size="sm" />
            <Text size="xs" c="dimmed" mt="xs">Veriler yükleniyor...</Text>
          </Box>
        ) : detectedValues.length === 0 ? (
          <Box ta="center" py="xl">
            <IconSparkles size={32} color="var(--mantine-color-dimmed)" />
            <Text size="sm" c="dimmed" mt="sm">Henüz tespit edilen veri yok</Text>
            <Text size="xs" c="dimmed" mt={4}>
              Dökümanları analiz ettikten sonra öneriler burada görünecek
            </Text>
            <Button
              variant="subtle"
              size="xs"
              mt="md"
              leftSection={<IconRefresh size={14} />}
              onClick={fetchSuggestions}
            >
              Yenile
            </Button>
          </Box>
        ) : (
          <Stack gap={8}>
            {detectedValues.map((item) => (
              <Paper
                key={item.key}
                p="sm"
                withBorder
                radius="md"
                style={{
                  borderColor: selectedSuggestionKeys.has(item.key)
                    ? 'var(--mantine-color-teal-6)'
                    : 'var(--mantine-color-default-border)',
                  background: selectedSuggestionKeys.has(item.key)
                    ? 'rgba(20, 184, 166, 0.05)'
                    : 'transparent',
                }}
              >
                <Group justify="space-between" wrap="nowrap">
                  <Group gap="sm" wrap="nowrap" style={{ flex: 1 }}>
                    <Checkbox
                      size="sm"
                      checked={selectedSuggestionKeys.has(item.key)}
                      onChange={(e) => {
                        const newSet = new Set(selectedSuggestionKeys);
                        if (e.currentTarget.checked) newSet.add(item.key);
                        else newSet.delete(item.key);
                        setSelectedSuggestionKeys(newSet);
                      }}
                    />
                    <Box style={{ flex: 1, minWidth: 0 }}>
                      <Text size="xs" c="dimmed">{item.label}</Text>
                      {editMode === item.key ? (
                        <Group gap={4} mt={2}>
                          <NumberInput
                            size="xs"
                            value={editValue as number}
                            onChange={(val) => setEditValue(val || 0)}
                            thousandSeparator="."
                            decimalSeparator=","
                            hideControls
                            style={{ flex: 1 }}
                          />
                          <ActionIcon size="sm" color="green" variant="light" onClick={() => handleEditSave(item.key)}>
                            <IconCheck size={14} />
                          </ActionIcon>
                        </Group>
                      ) : (
                        <Group gap={4}>
                          <Text size="sm" fw={600}>{formatValue(item.value, item.type)}</Text>
                          {item.type === 'currency' && (
                            <ActionIcon
                              size="xs"
                              variant="subtle"
                              onClick={() => {
                                setEditMode(item.key);
                                setEditValue(item.value as number);
                              }}
                            >
                              <IconEdit size={12} />
                            </ActionIcon>
                          )}
                        </Group>
                      )}
                    </Box>
                  </Group>
                  <Badge size="sm" variant="light" color={getSourceColor(item.source)}>
                    {getSourceLabel(item.source)}
                  </Badge>
                </Group>
              </Paper>
            ))}

            <Button
              fullWidth
              color="teal"
              size="md"
              leftSection={<IconCheck size={18} />}
              onClick={applySuggestions}
              loading={saving}
              disabled={selectedSuggestionKeys.size === 0}
              mt="sm"
            >
              Seçilenleri Uygula ({selectedSuggestionKeys.size})
            </Button>
          </Stack>
        )}
      </Paper>
    </Stack>
  );
}
