'use client';

import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  NumberInput,
  Paper,
  ScrollArea,
  Select,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import {
  IconBuilding,
  IconCurrencyLira,
  IconPhone,
  IconPlus,
  IconTrash,
  IconTrophy,
  IconUser,
} from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';
import { firmalarAPI } from '@/lib/api/services/firmalar';
import { tendersAPI } from '@/lib/api/services/tenders';
import type { Firma, SavedTender } from '../types';

interface RakipTeklif {
  firma_id?: number;
  firma_adi: string;
  teklif_tutari: number;
  sira?: number;
}

interface FirmsPanelProps {
  tender: SavedTender;
  onRefresh?: () => void;
}

export function FirmsPanel({ tender, onRefresh }: FirmsPanelProps) {
  const [firmalar, setFirmalar] = useState<Firma[]>([]);
  const [rakipTeklifler, setRakipTeklifler] = useState<RakipTeklif[]>([]);
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  
  // Yeni firma ekleme modu
  const [yeniFirmaAdi, setYeniFirmaAdi] = useState('');

  // Firmaları yükle
  useEffect(() => {
    const loadFirmalar = async () => {
      try {
        const result = await firmalarAPI.getFirmalar();
        if (result.success && result.data) {
          setFirmalar(result.data);
        }
      } catch (error) {
        console.error('Firmalar yüklenemedi:', error);
      }
    };
    loadFirmalar();
  }, []);

  // İhaleye ait rakip teklifleri yükle
  useEffect(() => {
    if (tender.hesaplama_verileri?.rakipTeklifler) {
      setRakipTeklifler(tender.hesaplama_verileri.rakipTeklifler);
    } else if (tender.hesaplama_verileri?.teklifListesi) {
      // Eski format dönüşümü
      const eskiTeklifler = tender.hesaplama_verileri.teklifListesi as Array<{ firma: string; tutar: number }>;
      setRakipTeklifler(
        eskiTeklifler
          .filter((t) => t.firma || t.tutar > 0)
          .map((t, i) => ({
            firma_adi: t.firma,
            teklif_tutari: t.tutar,
            sira: i + 1,
          }))
      );
    }
  }, [tender]);

  // Kaydet
  const saveRakipTeklifler = useCallback(async () => {
    setSaveStatus('saving');
    try {
      await tendersAPI.updateTracking(Number(tender.id), {
        hesaplama_verileri: {
          ...tender.hesaplama_verileri,
          rakipTeklifler: rakipTeklifler.filter((r) => r.firma_adi || r.teklif_tutari > 0),
          // Eski formatı da güncelle (uyumluluk için)
          teklifListesi: rakipTeklifler
            .filter((r) => r.firma_adi || r.teklif_tutari > 0)
            .map((r) => ({ firma: r.firma_adi, tutar: r.teklif_tutari })),
        },
      });
      setSaveStatus('saved');
      onRefresh?.();
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Kaydetme hatası:', error);
      setSaveStatus('idle');
    }
  }, [tender, rakipTeklifler, onRefresh]);

  // Rakip ekle
  const addRakip = (firmaAdi?: string, firmaId?: number) => {
    setRakipTeklifler((prev) => [
      ...prev,
      {
        firma_id: firmaId,
        firma_adi: firmaAdi || '',
        teklif_tutari: 0,
        sira: prev.length + 1,
      },
    ]);
  };

  // Rakip güncelle
  const updateRakip = (index: number, field: keyof RakipTeklif, value: string | number) => {
    setRakipTeklifler((prev) =>
      prev.map((r, i) => (i === index ? { ...r, [field]: value } : r))
    );
  };

  // Rakip sil
  const removeRakip = (index: number) => {
    setRakipTeklifler((prev) => prev.filter((_, i) => i !== index));
  };

  // Firma seç ve ekle
  const selectFirmaAndAdd = (firmaId: string | null) => {
    if (!firmaId) return;
    const firma = firmalar.find((f) => f.id === Number(firmaId));
    if (firma) {
      addRakip(firma.unvan || firma.kisa_ad, firma.id);
    }
  };

  // Sıralama (teklif tutarına göre)
  const siraliTeklifler = [...rakipTeklifler].sort((a, b) => {
    if (!a.teklif_tutari && !b.teklif_tutari) return 0;
    if (!a.teklif_tutari) return 1;
    if (!b.teklif_tutari) return -1;
    return a.teklif_tutari - b.teklif_tutari;
  });

  // Bizim teklifimiz
  const bizimTeklif = tender.bizim_teklif || 0;

  // Sıralamamız
  const bizimSira = siraliTeklifler.findIndex((t) => t.teklif_tutari > bizimTeklif) + 1 || siraliTeklifler.length + 1;

  return (
    <Box p="xs">
      <Stack gap="sm">
        {/* Kayıt Durumu */}
        {saveStatus !== 'idle' && (
          <Badge size="xs" color={saveStatus === 'saving' ? 'blue' : 'green'} variant="light">
            {saveStatus === 'saving' ? 'Kaydediliyor...' : 'Kaydedildi ✓'}
          </Badge>
        )}

        {/* Rakip Firma Ekle */}
        <Paper p="xs" withBorder radius="md">
          <Text size="xs" fw={600} mb="xs">
            Rakip Firma Ekle
          </Text>
          <Stack gap={6}>
            {/* Kayıtlı firmalardan seç */}
            {firmalar.length > 0 && (
              <Select
                placeholder="Kayıtlı firmadan seç..."
                size="xs"
                searchable
                clearable
                data={firmalar.map((f) => ({
                  value: String(f.id),
                  label: f.unvan || f.kisa_ad || `Firma #${f.id}`,
                }))}
                onChange={selectFirmaAndAdd}
                leftSection={<IconBuilding size={14} />}
              />
            )}
            
            {/* Manuel firma girişi */}
            <Group gap={6}>
              <TextInput
                placeholder="Veya firma adı gir..."
                size="xs"
                value={yeniFirmaAdi}
                onChange={(e) => setYeniFirmaAdi(e.target.value)}
                style={{ flex: 1 }}
              />
              <Tooltip label="Ekle">
                <ActionIcon
                  variant="light"
                  color="blue"
                  size="sm"
                  disabled={!yeniFirmaAdi.trim()}
                  onClick={() => {
                    addRakip(yeniFirmaAdi.trim());
                    setYeniFirmaAdi('');
                  }}
                >
                  <IconPlus size={14} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Stack>
        </Paper>

        {/* Rakip Teklifler Listesi */}
        <Paper p="xs" withBorder radius="md">
          <Group justify="space-between" mb="xs">
            <Text size="xs" fw={600}>
              Rakip Teklifler ({rakipTeklifler.length})
            </Text>
            {bizimTeklif > 0 && (
              <Badge size="xs" color={bizimSira <= 1 ? 'green' : bizimSira <= 3 ? 'yellow' : 'red'}>
                Sıramız: {bizimSira}.
              </Badge>
            )}
          </Group>

          <ScrollArea.Autosize mah={250}>
            <Stack gap={6}>
              {rakipTeklifler.length === 0 ? (
                <Text size="xs" c="dimmed" ta="center" py="md">
                  Henüz rakip teklif eklenmedi
                </Text>
              ) : (
                rakipTeklifler.map((rakip, index) => {
                  const sira = siraliTeklifler.findIndex((t) => t === rakip) + 1;
                  const isEnDusuk = sira === 1 && rakip.teklif_tutari > 0;
                  
                  return (
                    <Paper
                      key={`rakip-${index}`}
                      p={8}
                      radius="sm"
                      style={{
                        background: isEnDusuk
                          ? 'rgba(34, 197, 94, 0.1)'
                          : 'var(--mantine-color-dark-6)',
                        border: isEnDusuk
                          ? '1px solid var(--mantine-color-green-7)'
                          : '1px solid var(--mantine-color-dark-4)',
                      }}
                    >
                      <Group gap={6} wrap="nowrap">
                        {/* Sıra */}
                        <ThemeIcon
                          size="sm"
                          variant="light"
                          color={isEnDusuk ? 'green' : 'gray'}
                          radius="xl"
                        >
                          {rakip.teklif_tutari > 0 ? (
                            isEnDusuk ? <IconTrophy size={12} /> : <Text size="xs">{sira}</Text>
                          ) : (
                            <Text size="xs">-</Text>
                          )}
                        </ThemeIcon>

                        {/* Firma Adı */}
                        <TextInput
                          placeholder="Firma adı"
                          size="xs"
                          value={rakip.firma_adi}
                          onChange={(e) => updateRakip(index, 'firma_adi', e.target.value)}
                          style={{ flex: 1 }}
                        />

                        {/* Teklif Tutarı */}
                        <NumberInput
                          placeholder="Teklif"
                          size="xs"
                          value={rakip.teklif_tutari || ''}
                          onChange={(val) => updateRakip(index, 'teklif_tutari', Number(val) || 0)}
                          thousandSeparator="."
                          decimalSeparator=","
                          rightSection={<IconCurrencyLira size={12} />}
                          w={120}
                        />

                        {/* Sil */}
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          size="sm"
                          onClick={() => removeRakip(index)}
                        >
                          <IconTrash size={14} />
                        </ActionIcon>
                      </Group>
                    </Paper>
                  );
                })
              )}
            </Stack>
          </ScrollArea.Autosize>
        </Paper>

        {/* Özet */}
        {rakipTeklifler.filter((r) => r.teklif_tutari > 0).length > 0 && (
          <Paper p="xs" withBorder radius="md" bg="dark.7">
            <Stack gap={4}>
              <Group justify="space-between">
                <Text size="xs" c="dimmed">En Düşük Teklif:</Text>
                <Text size="xs" fw={600} c="green">
                  {Math.min(...rakipTeklifler.filter((r) => r.teklif_tutari > 0).map((r) => r.teklif_tutari)).toLocaleString('tr-TR')} ₺
                </Text>
              </Group>
              <Group justify="space-between">
                <Text size="xs" c="dimmed">En Yüksek Teklif:</Text>
                <Text size="xs" fw={600} c="red">
                  {Math.max(...rakipTeklifler.filter((r) => r.teklif_tutari > 0).map((r) => r.teklif_tutari)).toLocaleString('tr-TR')} ₺
                </Text>
              </Group>
              {bizimTeklif > 0 && (
                <Group justify="space-between">
                  <Text size="xs" c="dimmed">Bizim Teklif:</Text>
                  <Text size="xs" fw={600} c="blue">
                    {bizimTeklif.toLocaleString('tr-TR')} ₺
                  </Text>
                </Group>
              )}
            </Stack>
          </Paper>
        )}

        {/* Kaydet Butonu */}
        <Button
          size="xs"
          variant="light"
          onClick={saveRakipTeklifler}
          loading={saveStatus === 'saving'}
          disabled={rakipTeklifler.length === 0}
        >
          Kaydet
        </Button>
      </Stack>
    </Box>
  );
}
