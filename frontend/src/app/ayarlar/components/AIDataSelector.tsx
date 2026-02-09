'use client';

import {
  Button,
  Divider,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Switch,
  Text,
} from '@mantine/core';
import { IconCheck } from '@tabler/icons-react';
import { useState } from 'react';
import type { AIAnalysisData } from './types';

const fieldLabels: Record<string, string> = {
  unvan: 'Firma Ünvanı',
  vergi_dairesi: 'Vergi Dairesi',
  vergi_no: 'Vergi No',
  ticaret_sicil_no: 'Ticaret Sicil No',
  mersis_no: 'MERSİS No',
  adres: 'Adres',
  il: 'İl',
  ilce: 'İlçe',
  telefon: 'Telefon',
  yetkili_adi: 'Yetkili Adı',
  yetkili_tc: 'Yetkili TC',
  yetkili_unvani: 'Yetkili Ünvanı',
  imza_yetkisi: 'İmza Yetkisi',
  faaliyet_kodu: 'Faaliyet Kodu',
  belge_tarihi: 'Belge Tarihi',
};

interface AIDataSelectorProps {
  aiData: AIAnalysisData;
  onApply: (fields: string[]) => void;
  onCancel: () => void;
}

export default function AIDataSelector({ aiData, onApply, onCancel }: AIDataSelectorProps) {
  const [selectedFields, setSelectedFields] = useState<string[]>(
    Object.keys(aiData).filter((k) => aiData[k] && k !== 'guven_skoru')
  );

  const toggleField = (field: string) => {
    setSelectedFields((prev) =>
      prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field]
    );
  };

  const validFields = Object.entries(aiData).filter(
    ([key, val]) => val && key !== 'guven_skoru' && key !== 'rawResponse'
  );

  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
        {validFields.map(([key, value]) => (
          <Paper
            key={key}
            p="sm"
            radius="md"
            withBorder
            style={{
              cursor: 'pointer',
              borderColor: selectedFields.includes(key)
                ? 'var(--mantine-color-violet-5)'
                : undefined,
              background: selectedFields.includes(key)
                ? 'var(--mantine-color-violet-light)'
                : undefined,
            }}
            onClick={() => toggleField(key)}
          >
            <Group justify="space-between" wrap="nowrap">
              <div style={{ flex: 1, minWidth: 0 }}>
                <Text size="xs" c="dimmed">
                  {fieldLabels[key] || key}
                </Text>
                <Text size="sm" fw={500} truncate>
                  {String(value)}
                </Text>
              </div>
              <Switch
                checked={selectedFields.includes(key)}
                onChange={() => toggleField(key)}
                size="sm"
              />
            </Group>
          </Paper>
        ))}
      </SimpleGrid>

      <Divider />

      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          {selectedFields.length} alan seçildi
        </Text>
        <Group gap="sm">
          <Button variant="subtle" onClick={onCancel}>
            İptal
          </Button>
          <Button
            color="violet"
            leftSection={<IconCheck size={16} />}
            onClick={() => onApply(selectedFields)}
            disabled={selectedFields.length === 0}
          >
            Seçilenleri Firmaya Uygula
          </Button>
        </Group>
      </Group>
    </Stack>
  );
}
