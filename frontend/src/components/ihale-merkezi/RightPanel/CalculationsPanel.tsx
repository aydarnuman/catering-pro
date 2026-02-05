'use client';

import {
  Badge,
  Box,
  Button,
  Collapse,
  Divider,
  Group,
  NumberInput,
  Paper,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import { useDebouncedCallback, useDisclosure } from '@mantine/hooks';
import {
  IconAlertTriangle,
  IconCalculator,
  IconCheck,
  IconChevronDown,
  IconChevronUp,
  IconClock,
  IconCoin,
  IconInfoCircle,
  IconToolsKitchen2,
} from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';
import { tendersAPI } from '@/lib/api/services/tenders';
import type { SavedTender } from '../types';

interface CalculationsPanelProps {
  tender: SavedTender;
}

// Tespit edilen veri tipi
interface DetectedData {
  isSuresi?: string;
  toplamOgun?: number;
  ogunBilgileri?: string;
  teknikSartSayisi?: number;
  birimFiyatSayisi?: number;
}

export function CalculationsPanel({ tender }: CalculationsPanelProps) {
  const [yaklasikMaliyet, setYaklasikMaliyet] = useState(tender.yaklasik_maliyet || 0);
  const [sinirDeger, setSinirDeger] = useState<number | null>(tender.sinir_deger || null);
  const [bizimTeklif, setBizimTeklif] = useState(tender.bizim_teklif || 0);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [detectedData, setDetectedData] = useState<DetectedData>({});
  const [detailsOpened, { toggle: toggleDetails }] = useDisclosure(false);

  // Load initial data
  useEffect(() => {
    setYaklasikMaliyet(tender.yaklasik_maliyet || 0);
    setSinirDeger(tender.sinir_deger || null);
    setBizimTeklif(tender.bizim_teklif || 0);

    // Tespit edilen verileri yükle (analysis_summary'den)
    const analysis = tender.analysis_summary;
    if (analysis) {
      setDetectedData({
        isSuresi: analysis.sure || (tender as any).is_suresi,
        toplamOgun: (tender as any).toplam_ogun_sayisi,
        ogunBilgileri: (tender as any).ogun_bilgileri,
        teknikSartSayisi: analysis.teknik_sartlar?.length || (tender as any).teknik_sart_sayisi,
        birimFiyatSayisi: analysis.birim_fiyatlar?.length || (tender as any).birim_fiyat_sayisi,
      });
    }
  }, [tender]);

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
    const calculated = yaklasikMaliyet * 0.85;
    setSinirDeger(calculated);
    saveData();
  }, [yaklasikMaliyet, saveData]);

  // İş süresini ay olarak parse et
  const parseIsSuresi = (sure: string | undefined): number => {
    if (!sure) return 0;
    const match = sure.match(/(\d+)/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (sure.toLowerCase().includes('yıl') || sure.toLowerCase().includes('yil')) {
        return num * 12;
      }
      return num;
    }
    return 0;
  };

  // Otomatik hesaplamalar
  const isSuresiAy = parseIsSuresi(detectedData.isSuresi);
  const toplamOgun = detectedData.toplamOgun || 0;

  const ogunBasiMaliyet = yaklasikMaliyet && toplamOgun ? yaklasikMaliyet / toplamOgun : 0;
  const aylikMaliyet = yaklasikMaliyet && isSuresiAy ? yaklasikMaliyet / isSuresiAy : 0;
  const gunlukOgun = toplamOgun && isSuresiAy ? Math.round(toplamOgun / (isSuresiAy * 30)) : 0;

  const ogunBasiTeklif = bizimTeklif && toplamOgun ? bizimTeklif / toplamOgun : 0;

  // Risk assessment
  const getRiskStatus = () => {
    if (!sinirDeger || !bizimTeklif) return null;
    const ratio = bizimTeklif / sinirDeger;
    if (ratio < 0.85)
      return {
        color: 'red',
        label: 'Yüksek Risk - Aşırı Düşük',
        icon: IconAlertTriangle,
        percent: Math.round(ratio * 100),
      };
    if (ratio < 0.95)
      return {
        color: 'orange',
        label: 'Dikkat',
        icon: IconAlertTriangle,
        percent: Math.round(ratio * 100),
      };
    if (ratio > 1.05)
      return {
        color: 'yellow',
        label: 'Sınır Üstü',
        icon: IconInfoCircle,
        percent: Math.round(ratio * 100),
      };
    return {
      color: 'green',
      label: 'Uygun Aralık',
      icon: IconCheck,
      percent: Math.round(ratio * 100),
    };
  };

  const riskStatus = getRiskStatus();

  // Format money
  const formatMoney = (val: number) =>
    `${val.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`;
  const formatNumber = (val: number) => val.toLocaleString('tr-TR');

  return (
    <Box p="xs">
      <Stack gap="sm">
        {/* === BÖLÜM 1: TESPİT EDİLEN VERİLER === */}
        {(detectedData.isSuresi || detectedData.toplamOgun) && (
          <>
            <Group justify="space-between" onClick={toggleDetails} style={{ cursor: 'pointer' }}>
              <Group gap="xs">
                <ThemeIcon size="sm" variant="light" color="teal">
                  <IconInfoCircle size={14} />
                </ThemeIcon>
                <Text size="xs" fw={500}>
                  Tespit Edilen Veriler
                </Text>
              </Group>
              {detailsOpened ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
            </Group>

            <Collapse in={detailsOpened}>
              <Paper p="xs" withBorder bg="var(--mantine-color-dark-7)" radius="sm">
                <SimpleGrid cols={2} spacing="xs">
                  {detectedData.isSuresi && (
                    <Box>
                      <Text size="xs" c="dimmed">
                        İş Süresi
                      </Text>
                      <Text size="sm" fw={500}>
                        {detectedData.isSuresi}
                      </Text>
                    </Box>
                  )}
                  {detectedData.toplamOgun && (
                    <Box>
                      <Text size="xs" c="dimmed">
                        Toplam Öğün
                      </Text>
                      <Text size="sm" fw={500}>
                        {formatNumber(detectedData.toplamOgun)}
                      </Text>
                    </Box>
                  )}
                  {detectedData.teknikSartSayisi && (
                    <Box>
                      <Text size="xs" c="dimmed">
                        Teknik Şart
                      </Text>
                      <Text size="sm" fw={500}>
                        {detectedData.teknikSartSayisi} adet
                      </Text>
                    </Box>
                  )}
                  {detectedData.birimFiyatSayisi && (
                    <Box>
                      <Text size="xs" c="dimmed">
                        Birim Fiyat
                      </Text>
                      <Text size="sm" fw={500}>
                        {detectedData.birimFiyatSayisi} kalem
                      </Text>
                    </Box>
                  )}
                </SimpleGrid>
              </Paper>
            </Collapse>

            <Divider />
          </>
        )}

        {/* === BÖLÜM 2: MALİ GİRİŞLER === */}
        <Group gap="xs">
          <ThemeIcon size="sm" variant="light" color="blue">
            <IconCoin size={14} />
          </ThemeIcon>
          <Text size="xs" fw={500}>
            Mali Bilgiler
          </Text>
        </Group>

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
          <Tooltip label="YM × 0.85">
            <Button size="xs" variant="light" onClick={calculateSinirDeger}>
              Hesapla
            </Button>
          </Tooltip>
        </Group>

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

        {/* === BÖLÜM 3: OTOMATİK HESAPLAMALAR === */}
        {(ogunBasiMaliyet > 0 || aylikMaliyet > 0) && (
          <>
            <Divider my={4} />
            <Group gap="xs">
              <ThemeIcon size="sm" variant="light" color="violet">
                <IconCalculator size={14} />
              </ThemeIcon>
              <Text size="xs" fw={500}>
                Otomatik Hesaplamalar
              </Text>
            </Group>

            <Paper p="xs" withBorder radius="sm">
              <Stack gap={6}>
                {ogunBasiMaliyet > 0 && (
                  <Group justify="space-between">
                    <Group gap={4}>
                      <IconToolsKitchen2 size={12} color="var(--mantine-color-dimmed)" />
                      <Text size="xs" c="dimmed">
                        Öğün Başı Maliyet
                      </Text>
                    </Group>
                    <Text size="xs" fw={500}>
                      {ogunBasiMaliyet.toFixed(2)} ₺/öğün
                    </Text>
                  </Group>
                )}

                {ogunBasiTeklif > 0 && (
                  <Group justify="space-between">
                    <Group gap={4}>
                      <IconToolsKitchen2 size={12} color="var(--mantine-color-dimmed)" />
                      <Text size="xs" c="dimmed">
                        Öğün Başı Teklifimiz
                      </Text>
                    </Group>
                    <Text size="xs" fw={500} c="blue">
                      {ogunBasiTeklif.toFixed(2)} ₺/öğün
                    </Text>
                  </Group>
                )}

                {aylikMaliyet > 0 && (
                  <Group justify="space-between">
                    <Group gap={4}>
                      <IconClock size={12} color="var(--mantine-color-dimmed)" />
                      <Text size="xs" c="dimmed">
                        Aylık Maliyet
                      </Text>
                    </Group>
                    <Text size="xs" fw={500}>
                      {formatMoney(aylikMaliyet)}
                    </Text>
                  </Group>
                )}

                {gunlukOgun > 0 && (
                  <Group justify="space-between">
                    <Group gap={4}>
                      <IconToolsKitchen2 size={12} color="var(--mantine-color-dimmed)" />
                      <Text size="xs" c="dimmed">
                        Günlük Öğün
                      </Text>
                    </Group>
                    <Text size="xs" fw={500}>
                      ~{formatNumber(gunlukOgun)} öğün/gün
                    </Text>
                  </Group>
                )}
              </Stack>
            </Paper>
          </>
        )}

        {/* === BÖLÜM 4: RİSK ANALİZİ === */}
        {riskStatus && (
          <>
            <Divider my={4} />
            <Paper
              p="xs"
              withBorder
              radius="md"
              style={{ borderColor: `var(--mantine-color-${riskStatus.color}-5)` }}
            >
              <Stack gap="xs">
                <Group justify="space-between">
                  <Group gap="xs">
                    <ThemeIcon size="sm" color={riskStatus.color} variant="light">
                      <riskStatus.icon size={14} />
                    </ThemeIcon>
                    <Text size="sm" fw={500}>
                      {riskStatus.label}
                    </Text>
                  </Group>
                  <Badge color={riskStatus.color} variant="filled" size="sm">
                    %{riskStatus.percent}
                  </Badge>
                </Group>

                <Progress
                  value={Math.min(riskStatus.percent, 120)}
                  color={riskStatus.color}
                  size="sm"
                  radius="xl"
                />

                <Text size="xs" c="dimmed">
                  {riskStatus.percent < 85 && 'Aşırı düşük teklif açıklaması gerekebilir'}
                  {riskStatus.percent >= 85 &&
                    riskStatus.percent < 95 &&
                    'Sınır değere yakın, dikkatli olun'}
                  {riskStatus.percent >= 95 && riskStatus.percent <= 105 && 'Teklif uygun aralıkta'}
                  {riskStatus.percent > 105 && 'Teklif sınır değerin üstünde'}
                </Text>
              </Stack>
            </Paper>
          </>
        )}

        {/* Save Status */}
        {saveStatus !== 'idle' && (
          <Text size="xs" c={saveStatus === 'saving' ? 'blue' : 'green'} ta="right">
            {saveStatus === 'saving' ? 'Kaydediliyor...' : '✓ Kaydedildi'}
          </Text>
        )}
      </Stack>
    </Box>
  );
}
