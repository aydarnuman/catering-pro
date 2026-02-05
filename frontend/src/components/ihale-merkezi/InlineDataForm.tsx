'use client';

import { Box, Button, Group, NumberInput, Paper, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconEdit } from '@tabler/icons-react';
import { useState } from 'react';
import { tendersAPI } from '@/lib/api/services/tenders';

interface InlineDataFormProps {
  tenderId: number;
  missingFields: Array<'yaklasik_maliyet' | 'bizim_teklif' | 'sinir_deger'>;
  currentValues?: {
    yaklasik_maliyet?: number;
    bizim_teklif?: number;
    sinir_deger?: number;
  };
  onSaved?: (values: Record<string, number>) => void;
  onCancel?: () => void;
}

const fieldLabels: Record<string, string> = {
  yaklasik_maliyet: 'Yaklaşık Maliyet',
  bizim_teklif: 'Bizim Teklif',
  sinir_deger: 'Sınır Değer',
};

const fieldDescriptions: Record<string, string> = {
  yaklasik_maliyet: 'İdarenin belirlediği tahmini ihale bedeli',
  bizim_teklif: 'Firmamızın teklif tutarı',
  sinir_deger: 'Aşırı düşük sınır değer (opsiyonel)',
};

export function InlineDataForm({
  tenderId,
  missingFields,
  currentValues = {},
  onSaved,
  onCancel,
}: InlineDataFormProps) {
  const [values, setValues] = useState<Record<string, number | undefined>>({
    yaklasik_maliyet: currentValues.yaklasik_maliyet,
    bizim_teklif: currentValues.bizim_teklif,
    sinir_deger: currentValues.sinir_deger,
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    // Validasyon
    const criticalMissing = missingFields.filter((f) => f !== 'sinir_deger' && !values[f]);

    if (criticalMissing.length > 0) {
      notifications.show({
        title: 'Eksik Bilgi',
        message: `${criticalMissing.map((f) => fieldLabels[f]).join(', ')} alanları zorunludur`,
        color: 'yellow',
      });
      return;
    }

    setSaving(true);
    try {
      const updateData: Record<string, number | null> = {};
      for (const field of missingFields) {
        if (values[field]) {
          updateData[field] = values[field] as number;
        }
      }

      await tendersAPI.updateTracking(tenderId, updateData);

      notifications.show({
        title: 'Kaydedildi',
        message: 'Bilgiler başarıyla kaydedildi',
        color: 'green',
      });

      onSaved?.(updateData as Record<string, number>);
    } catch (error) {
      console.error('Save error:', error);
      notifications.show({
        title: 'Hata',
        message: 'Bilgiler kaydedilemedi',
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Paper
      p="md"
      withBorder
      style={{
        background:
          'linear-gradient(135deg, rgba(20, 184, 166, 0.05) 0%, rgba(59, 130, 246, 0.05) 100%)',
        borderColor: 'var(--mantine-color-teal-6)',
        borderWidth: 1,
      }}
    >
      <Group gap="xs" mb="sm">
        <IconEdit size={18} color="var(--mantine-color-teal-6)" />
        <Text size="sm" fw={500}>
          Eksik Bilgileri Doldurun
        </Text>
      </Group>

      <Text size="xs" c="dimmed" mb="md">
        Bu bilgiler dilekçe hazırlamak için gereklidir. Doldurduktan sonra AI devam edecek.
      </Text>

      <Stack gap="sm">
        {missingFields.map((field) => (
          <Box key={field}>
            <NumberInput
              label={fieldLabels[field]}
              description={fieldDescriptions[field]}
              placeholder="0"
              value={values[field] || ''}
              onChange={(val) => setValues((prev) => ({ ...prev, [field]: val as number }))}
              thousandSeparator="."
              decimalSeparator=","
              suffix=" ₺"
              hideControls
              styles={{
                input: {
                  background: 'var(--mantine-color-dark-7)',
                },
              }}
            />
          </Box>
        ))}
      </Stack>

      <Group justify="flex-end" mt="md" gap="xs">
        {onCancel && (
          <Button variant="subtle" size="xs" onClick={onCancel}>
            İptal
          </Button>
        )}
        <Button
          color="teal"
          size="xs"
          leftSection={<IconCheck size={14} />}
          onClick={handleSave}
          loading={saving}
        >
          Kaydet ve Devam Et
        </Button>
      </Group>
    </Paper>
  );
}

// AI'ın eksik verileri tespit etmesi için yardımcı fonksiyon
export function detectMissingCriticalData(tender: {
  yaklasik_maliyet?: number;
  bizim_teklif?: number;
  sinir_deger?: number;
}): Array<'yaklasik_maliyet' | 'bizim_teklif' | 'sinir_deger'> {
  const missing: Array<'yaklasik_maliyet' | 'bizim_teklif' | 'sinir_deger'> = [];

  if (!tender.yaklasik_maliyet) {
    missing.push('yaklasik_maliyet');
  }
  if (!tender.bizim_teklif) {
    missing.push('bizim_teklif');
  }
  // Sınır değer opsiyonel ama yararlı
  if (!tender.sinir_deger) {
    missing.push('sinir_deger');
  }

  return missing;
}
