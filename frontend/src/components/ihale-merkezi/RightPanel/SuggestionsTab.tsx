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
  Stack,
  Text,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconEdit, IconRefresh, IconSparkles } from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';
import { tendersAPI } from '@/lib/api/services/tenders';
import type { SavedTender } from '../types';

interface DetectedValue {
  key: string;
  label: string;
  value: string | number | null;
  source: 'sartname' | 'analiz' | 'hesaplama' | 'scraper';
  fieldName: string;
  type: 'currency' | 'number' | 'text';
}

interface SuggestionsTabProps {
  tender: SavedTender;
  onRefresh?: () => void;
  onApplied?: (savedFields: string[]) => void;
}

export function SuggestionsTab({ tender, onRefresh, onApplied }: SuggestionsTabProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [detectedValues, setDetectedValues] = useState<DetectedValue[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [editMode, setEditMode] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<number | string>('');

  // Mevcut tender verilerinden fallback öneriler oluştur
  const buildFallbackSuggestions = useCallback((t: SavedTender): DetectedValue[] => {
    const suggestions: DetectedValue[] = [];

    // Yaklaşık maliyet
    if (t.yaklasik_maliyet) {
      suggestions.push({
        key: 'yaklasik_maliyet',
        label: 'Yaklaşık Maliyet',
        value: t.yaklasik_maliyet,
        source: 'sartname',
        fieldName: 'yaklasik_maliyet',
        type: 'currency',
      });
    }

    // Sınır değer
    if (t.sinir_deger) {
      suggestions.push({
        key: 'sinir_deger',
        label: 'Sınır Değer',
        value: t.sinir_deger,
        source: 'hesaplama',
        fieldName: 'sinir_deger',
        type: 'currency',
      });
    }

    // Bizim teklif
    if (t.bizim_teklif) {
      suggestions.push({
        key: 'bizim_teklif',
        label: 'Bizim Teklif',
        value: t.bizim_teklif,
        source: 'sartname',
        fieldName: 'bizim_teklif',
        type: 'currency',
      });
    }

    return suggestions;
  }, []);

  // Tespit edilen verileri yükle
  const fetchSuggestions = useCallback(async () => {
    setLoading(true);
    try {
      const response = await tendersAPI.getTenderSuggestions(Number(tender.id));
      if (response.success && response.data) {
        setDetectedValues(response.data.suggestions || []);
        // Varsayılan olarak tümünü seç
        setSelectedKeys(new Set(response.data.suggestions?.map((s: DetectedValue) => s.key) || []));
      }
    } catch (error) {
      console.error('Suggestions fetch error:', error);
      // Fallback: Mevcut tender verilerinden öneriler oluştur
      const fallbackSuggestions = buildFallbackSuggestions(tender);
      setDetectedValues(fallbackSuggestions);
      setSelectedKeys(new Set(fallbackSuggestions.map((s) => s.key)));
    } finally {
      setLoading(false);
    }
  }, [tender.id, tender, buildFallbackSuggestions]);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  // Seçilen önerileri uygula
  const handleApply = async () => {
    if (selectedKeys.size === 0) {
      notifications.show({
        title: 'Uyarı',
        message: 'En az bir değer seçmelisiniz',
        color: 'yellow',
      });
      return;
    }

    setSaving(true);
    try {
      const selectedValues = detectedValues.filter((v) => selectedKeys.has(v.key));
      const savedLabels: string[] = [];
      const savedFields: string[] = [];

      // Ana alanlar (DB'de direkt kolon olarak var)
      const directFields = ['yaklasik_maliyet', 'sinir_deger', 'bizim_teklif'];
      const updateData: Record<string, unknown> = {};

      // Ek veriler hesaplama_verileri JSONB'ye kaydedilecek
      const hesaplamaVerileri: Record<string, unknown> = {};

      for (const val of selectedValues) {
        savedLabels.push(val.label);
        savedFields.push(val.fieldName);

        if (directFields.includes(val.fieldName)) {
          updateData[val.fieldName] = val.value;
        } else {
          // Diğer alanlar hesaplama_verileri'ne
          hesaplamaVerileri[val.fieldName] = val.value;
        }
      }

      // Eğer ek veri varsa hesaplama_verileri'ne ekle
      if (Object.keys(hesaplamaVerileri).length > 0) {
        updateData.hesaplama_verileri = hesaplamaVerileri;
      }

      await tendersAPI.updateTracking(Number(tender.id), updateData);

      // Detaylı başarı mesajı
      notifications.show({
        title: 'Veriler Kaydedildi',
        message: `${savedLabels.slice(0, 3).join(', ')}${savedLabels.length > 3 ? ` ve ${savedLabels.length - 3} değer daha` : ''} ihale kaydına eklendi.`,
        color: 'teal',
        autoClose: 5000,
      });

      onRefresh?.();

      // Callback: Hesaplamalar panelini aç
      onApplied?.(savedFields);
    } catch (error) {
      console.error('Apply suggestions error:', error);
      notifications.show({
        title: 'Hata',
        message: 'Değerler uygulanırken bir hata oluştu',
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  };

  // Değer düzenleme
  const handleEditSave = (key: string) => {
    setDetectedValues((prev) =>
      prev.map((v) => (v.key === key ? { ...v, value: editValue as number } : v))
    );
    setEditMode(null);
  };

  // Kaynak badge rengi
  const getSourceColor = (source: DetectedValue['source']) => {
    switch (source) {
      case 'sartname':
        return 'blue';
      case 'analiz':
        return 'teal';
      case 'hesaplama':
        return 'violet';
      case 'scraper':
        return 'gray';
      default:
        return 'gray';
    }
  };

  // Kaynak label
  const getSourceLabel = (source: DetectedValue['source']) => {
    switch (source) {
      case 'sartname':
        return 'Şartname';
      case 'analiz':
        return 'Analiz';
      case 'hesaplama':
        return 'Hesaplama';
      case 'scraper':
        return 'Scraper';
      default:
        return source;
    }
  };

  // Değer formatla
  const formatValue = (value: string | number | null, type: DetectedValue['type']) => {
    if (value === null || value === undefined) return '-';
    if (type === 'currency') {
      return `${Number(value).toLocaleString('tr-TR')} ₺`;
    }
    return String(value);
  };

  if (loading) {
    return (
      <Box ta="center" py="xl">
        <Loader size="sm" />
        <Text size="xs" c="dimmed" mt="xs">
          Tespit edilen veriler yükleniyor...
        </Text>
      </Box>
    );
  }

  if (detectedValues.length === 0) {
    return (
      <Box ta="center" py="xl">
        <IconSparkles size={32} color="var(--mantine-color-dimmed)" />
        <Text size="sm" c="dimmed" mt="sm">
          Henüz tespit edilen veri yok
        </Text>
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
    );
  }

  return (
    <Stack gap="sm">
      {/* Header */}
      <Group justify="space-between" mb="xs">
        <Group gap="xs">
          <IconSparkles size={16} color="var(--mantine-color-teal-6)" />
          <Text size="sm" fw={500}>
            Tespit Edilen Veriler
          </Text>
        </Group>
        <Tooltip label="Yenile">
          <ActionIcon variant="subtle" size="sm" onClick={fetchSuggestions}>
            <IconRefresh size={14} />
          </ActionIcon>
        </Tooltip>
      </Group>

      {/* Değer listesi */}
      <Stack gap={6}>
        {detectedValues.map((item) => (
          <Paper
            key={item.key}
            p="xs"
            withBorder
            style={{
              borderColor: selectedKeys.has(item.key)
                ? 'var(--mantine-color-teal-6)'
                : 'var(--mantine-color-default-border)',
              background: selectedKeys.has(item.key) ? 'rgba(20, 184, 166, 0.05)' : 'transparent',
            }}
          >
            <Group justify="space-between" wrap="nowrap">
              <Group gap="xs" wrap="nowrap" style={{ flex: 1 }}>
                <Checkbox
                  size="xs"
                  checked={selectedKeys.has(item.key)}
                  onChange={(e) => {
                    const newSet = new Set(selectedKeys);
                    if (e.currentTarget.checked) {
                      newSet.add(item.key);
                    } else {
                      newSet.delete(item.key);
                    }
                    setSelectedKeys(newSet);
                  }}
                />
                <Box style={{ flex: 1, minWidth: 0 }}>
                  <Text size="xs" c="dimmed" truncate>
                    {item.label}
                  </Text>
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
                      <ActionIcon
                        size="xs"
                        color="green"
                        variant="light"
                        onClick={() => handleEditSave(item.key)}
                      >
                        <IconCheck size={12} />
                      </ActionIcon>
                    </Group>
                  ) : (
                    <Group gap={4}>
                      <Text size="sm" fw={500}>
                        {formatValue(item.value, item.type)}
                      </Text>
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
              <Badge size="xs" variant="light" color={getSourceColor(item.source)}>
                {getSourceLabel(item.source)}
              </Badge>
            </Group>
          </Paper>
        ))}
      </Stack>

      {/* Uygula butonu */}
      <Button
        fullWidth
        color="teal"
        leftSection={<IconCheck size={16} />}
        onClick={handleApply}
        loading={saving}
        disabled={selectedKeys.size === 0}
        mt="sm"
      >
        Seçilenleri Uygula ({selectedKeys.size})
      </Button>

      <Text size="xs" c="dimmed" ta="center">
        Veya{' '}
        <Text
          component="span"
          size="xs"
          c="blue"
          style={{ cursor: 'pointer' }}
          onClick={() => {
            // TODO: Manuel giriş modalı aç
          }}
        >
          manuel giriş yapın
        </Text>
      </Text>
    </Stack>
  );
}
