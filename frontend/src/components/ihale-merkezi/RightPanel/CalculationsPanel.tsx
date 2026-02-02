'use client';

import {
  Badge,
  Box,
  Button,
  Divider,
  Group,
  NumberInput,
  Paper,
  Stack,
  Text,
  ThemeIcon,
} from '@mantine/core';
import { useDebouncedCallback } from '@mantine/hooks';
import { IconAlertTriangle, IconCheck } from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';
import { tendersAPI } from '@/lib/api/services/tenders';
import type { SavedTender } from '../types';

interface CalculationsPanelProps {
  tender: SavedTender;
}

export function CalculationsPanel({ tender }: CalculationsPanelProps) {
  const [yaklasikMaliyet, setYaklasikMaliyet] = useState(tender.yaklasik_maliyet || 0);
  const [sinirDeger, setSinirDeger] = useState<number | null>(tender.sinir_deger || null);
  const [bizimTeklif, setBizimTeklif] = useState(tender.bizim_teklif || 0);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Load initial data
  useEffect(() => {
    setYaklasikMaliyet(tender.yaklasik_maliyet || 0);
    setSinirDeger(tender.sinir_deger || null);
    setBizimTeklif(tender.bizim_teklif || 0);
  }, [tender.yaklasik_maliyet, tender.sinir_deger, tender.bizim_teklif]);

  // Auto-save
  const saveData = useDebouncedCallback(async () => {
    setSaveStatus('saving');
    try {
      await tendersAPI.updateTracking(Number(tender.id), {
        yaklasik_maliyet: yaklasikMaliyet || null,
        sinir_deger: sinirDeger || null,
        bizim_teklif: bizimTeklif || null,
      });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Save error:', error);
      setSaveStatus('idle');
    }
  }, 1000);

  // Calculate sınır değer
  const calculateSinirDeger = useCallback(() => {
    if (!yaklasikMaliyet) return;
    // Basit formül: %85
    const calculated = yaklasikMaliyet * 0.85;
    setSinirDeger(calculated);
    saveData();
  }, [yaklasikMaliyet, saveData]);

  // Risk assessment
  const getRiskStatus = () => {
    if (!sinirDeger || !bizimTeklif) return null;
    const ratio = bizimTeklif / sinirDeger;
    if (ratio < 0.85) return { color: 'red', label: 'Yüksek Risk', icon: IconAlertTriangle };
    if (ratio < 0.95) return { color: 'orange', label: 'Dikkat', icon: IconAlertTriangle };
    return { color: 'green', label: 'Uygun', icon: IconCheck };
  };

  const riskStatus = getRiskStatus();

  return (
    <Box p="xs">
      <Stack gap="xs">
        {/* Yaklaşık Maliyet */}
        <NumberInput
          label="Yaklaşık Maliyet"
          placeholder="0"
          value={yaklasikMaliyet}
          onChange={(val) => {
            setYaklasikMaliyet(Number(val) || 0);
            saveData();
          }}
          thousandSeparator="."
          decimalSeparator=","
          suffix=" ₺"
          size="xs"
        />

        {/* Sınır Değer */}
        <Group gap="xs" align="flex-end">
          <NumberInput
            label="Sınır Değer"
            placeholder="Hesapla"
            value={sinirDeger || ''}
            onChange={(val) => {
              setSinirDeger(Number(val) || null);
              saveData();
            }}
            thousandSeparator="."
            decimalSeparator=","
            suffix=" ₺"
            size="xs"
            style={{ flex: 1 }}
          />
          <Button size="xs" variant="light" onClick={calculateSinirDeger}>
            Hesapla
          </Button>
        </Group>

        {/* Bizim Teklif */}
        <NumberInput
          label="Bizim Teklif"
          placeholder="0"
          value={bizimTeklif}
          onChange={(val) => {
            setBizimTeklif(Number(val) || 0);
            saveData();
          }}
          thousandSeparator="."
          decimalSeparator=","
          suffix=" ₺"
          size="xs"
        />

        {/* Risk Status */}
        {riskStatus && (
          <Paper
            p="xs"
            withBorder
            radius="md"
            style={{ borderColor: `var(--mantine-color-${riskStatus.color}-5)` }}
          >
            <Group justify="space-between">
              <Group gap="xs">
                <ThemeIcon size="sm" color={riskStatus.color} variant="light">
                  <riskStatus.icon size={14} />
                </ThemeIcon>
                <Text size="sm" fw={500}>
                  {riskStatus.label}
                </Text>
              </Group>
              <Badge color={riskStatus.color} variant="filled">
                %{Math.round((bizimTeklif / (sinirDeger || 1)) * 100)}
              </Badge>
            </Group>
          </Paper>
        )}

        {/* Save Status */}
        {saveStatus !== 'idle' && (
          <Text size="xs" c={saveStatus === 'saving' ? 'blue' : 'green'} ta="right">
            {saveStatus === 'saving' ? 'Kaydediliyor...' : '✓ Kaydedildi'}
          </Text>
        )}

        <Divider my="xs" />

        {/* Quick Links */}
        <Text size="xs" c="dimmed">
          Detaylı hesaplamalar için sağ paneldeki "Hesaplamalar" sekmesini kullanın.
        </Text>
      </Stack>
    </Box>
  );
}
