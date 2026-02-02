'use client';

import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Center,
  Chip,
  CopyButton,
  Group,
  Loader,
  NumberInput,
  Paper,
  ScrollArea,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Title,
  Tooltip,
} from '@mantine/core';
import { useDebouncedCallback } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconBookmark,
  IconBrain,
  IconBuilding,
  IconBulb,
  IconCalculator,
  IconCalendar,
  IconCheck,
  IconChevronDown,
  IconClipboardList,
  IconCloudDownload,
  IconCoin,
  IconCopy,
  IconCurrencyLira,
  IconDownload,
  IconExternalLink,
  IconFile,
  IconFileAnalytics,
  IconFileDownload,
  IconFileText,
  IconGavel,
  IconMapPin,
  IconMathFunction,
  IconNote,
  IconPlus,
  IconRefresh,
  IconScale,
  IconSearch,
  IconSend,
  IconSparkles,
  IconTrash,
} from '@tabler/icons-react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { aiAPI } from '@/lib/api/services/ai';
import { tendersAPI } from '@/lib/api/services/tenders';
import type { Tender } from '@/types/api';
import type {
  AINote,
  AnalysisData,
  IhaleMerkeziState,
  SavedTender,
  TeknikSart,
  TenderStatus,
} from '../types';
import { statusConfig } from '../types';
import { DocumentWizardModal } from '../DocumentWizardModal';

interface CenterPanelProps {
  state: IhaleMerkeziState;
  onStateChange: (updates: Partial<IhaleMerkeziState>) => void;
  onSelectTender: (tender: Tender | SavedTender | null) => void;
  onUpdateStatus?: (tenderId: string, status: string) => void;
  onRefreshData?: () => void;
  isMobile?: boolean;
}

// Check if tender is SavedTender
function isSavedTender(tender: Tender | SavedTender | null): tender is SavedTender {
  return tender !== null && 'tender_id' in tender;
}

export function CenterPanel({
  state,
  onStateChange,
  onUpdateStatus,
  onRefreshData,
  isMobile = false,
}: CenterPanelProps) {
  const { selectedTender, activeDetailTab, dilekceType, firmalar, selectedFirmaId } = state;

  // URL state için hooks
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Document wizard modal state - URL'den oku
  const wizardParam = searchParams.get('wizard');
  const documentWizardOpen = wizardParam === '1' || wizardParam === 'open';

  // Modal aç/kapa fonksiyonları - URL'i güncelle
  const openDocumentWizard = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('wizard', '1');
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }, [searchParams, router, pathname]);

  const closeDocumentWizard = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('wizard');
    const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.push(newUrl, { scroll: false });
  }, [searchParams, router, pathname]);

  // Selected firma
  const selectedFirma = firmalar?.find((f) => f.id === selectedFirmaId);

  // No tender selected
  if (!selectedTender) {
    return (
      <Box
        style={{
          height: '100%',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          overflow: 'hidden',
          background: 'transparent',
          borderRight: isMobile ? 'none' : '1px solid var(--mantine-color-default-border)',
        }}
      >
        <IconFileText size={64} color="var(--mantine-color-gray-4)" />
        <Text size="lg" c="dimmed" mt="md">
          Sol panelden bir ihale seçin
        </Text>
        <Text size="sm" c="dimmed" mt="xs">
          İhale detayları ve AI asistan burada görünecek
        </Text>
      </Box>
    );
  }

  const isSaved = isSavedTender(selectedTender);

  // Analiz durumu kontrolü
  const hasDocuments = isSaved && (selectedTender.dokuman_sayisi || 0) > 0;
  const hasAnalysis =
    isSaved &&
    ((selectedTender.analiz_edilen_dokuman || 0) > 0 ||
      (selectedTender.teknik_sart_sayisi || 0) > 0 ||
      (selectedTender.birim_fiyat_sayisi || 0) > 0);

  // Extract fields
  const title = isSaved ? selectedTender.ihale_basligi : selectedTender.title;
  const organization = isSaved ? selectedTender.kurum : selectedTender.organization;
  const city = selectedTender.city;
  const dateStr = isSaved ? selectedTender.tarih : selectedTender.deadline;
  const externalId = isSaved ? selectedTender.external_id : selectedTender.external_id;
  const url = isSaved ? selectedTender.url : selectedTender.url;

  // Zeyilname ve düzeltme ilanı (sadece SavedTender için)
  const zeyilname = isSaved ? selectedTender.zeyilname_content : null;
  const correction = isSaved ? selectedTender.correction_notice_content : null;

  return (
    <Box
      style={{
        height: '100%',
        minHeight: 0, // Critical for CSS Grid scroll
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: 'transparent',
        borderRight: isMobile ? 'none' : '1px solid var(--mantine-color-default-border)',
      }}
    >
      {/* Detail Section */}
      <ScrollArea style={{ flex: 1, minHeight: 0 }} offsetScrollbars>
        <Box p="md">
          {/* Header */}
          <Group justify="space-between" mb="md">
            <Box style={{ flex: 1 }}>
              <Group gap="xs" mb={4}>
                {externalId && (
                  <Badge size="sm" variant="light" color="gray">
                    #{externalId}
                  </Badge>
                )}
              </Group>
              <Title order={4} lineClamp={2}>
                {title || 'İsimsiz İhale'}
              </Title>
            </Box>
            <Group gap="xs">
              {url && (
                <Button
                  component="a"
                  href={url}
                  target="_blank"
                  variant="light"
                  size="xs"
                  rightSection={<IconExternalLink size={14} />}
                >
                  Kaynak
                </Button>
              )}
              {isSaved && (
                <Tooltip label="JSON olarak indir">
                  <ActionIcon
                    variant="light"
                    size="md"
                    onClick={() => {
                      const data = {
                        ihale: {
                          baslik: selectedTender.ihale_basligi,
                          kurum: selectedTender.kurum,
                          tarih: selectedTender.tarih,
                          sehir: selectedTender.city,
                          bedel: selectedTender.bedel,
                          external_id: selectedTender.external_id,
                          url: selectedTender.url,
                        },
                        hesaplamalar: {
                          yaklasik_maliyet: selectedTender.yaklasik_maliyet,
                          sinir_deger: selectedTender.sinir_deger,
                          bizim_teklif: selectedTender.bizim_teklif,
                        },
                        analiz: selectedTender.analysis_summary,
                        durum: selectedTender.status,
                        olusturulma: selectedTender.created_at,
                      };
                      const blob = new Blob([JSON.stringify(data, null, 2)], {
                        type: 'application/json',
                      });
                      const urlObj = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = urlObj;
                      a.download = `ihale_${selectedTender.external_id || selectedTender.id}_${Date.now()}.json`;
                      a.click();
                      URL.revokeObjectURL(urlObj);
                    }}
                  >
                    <IconDownload size={16} />
                  </ActionIcon>
                </Tooltip>
              )}
            </Group>
          </Group>

          {/* Status ve Firma Seçiciler */}
          {isSaved && (
            <Group gap="xs" mb="md">
              <Select
                size="xs"
                w={140}
                placeholder="Durum"
                value={selectedTender.status}
                onChange={(value) => {
                  if (value && onUpdateStatus) {
                    onUpdateStatus(selectedTender.id, value);
                  }
                }}
                data={Object.entries(statusConfig).map(([key, val]) => ({
                  value: key,
                  label: `${val.icon} ${val.label}`,
                }))}
                leftSection={
                  <Box
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: `var(--mantine-color-${statusConfig[selectedTender.status as TenderStatus]?.color || 'gray'}-6)`,
                    }}
                  />
                }
              />
              {firmalar && firmalar.length > 0 && (
                <Select
                  size="xs"
                  w={180}
                  placeholder="Firma seçin"
                  value={selectedFirmaId?.toString() || null}
                  onChange={(value) =>
                    onStateChange({ selectedFirmaId: value ? parseInt(value, 10) : null })
                  }
                  data={firmalar.map((f) => ({
                    value: f.id.toString(),
                    label:
                      f.kisa_ad ||
                      (f.unvan.length > 25 ? `${f.unvan.substring(0, 25)}...` : f.unvan),
                  }))}
                  leftSection={<IconBuilding size={14} />}
                  clearable
                />
              )}
              {selectedFirma && (
                <Badge size="sm" variant="light" color="blue">
                  {selectedFirma.vergi_no || 'Vergi No Yok'}
                </Badge>
              )}
            </Group>
          )}

          {/* Summary Cards */}
          {/* Summary Info - Compact Inline */}
          <Group gap="xs" mb="md" wrap="nowrap">
            <Tooltip
              label={organization || '-'}
              multiline
              maw={300}
              withArrow
              disabled={!organization || organization.length < 30}
            >
              <Paper
                p="xs"
                withBorder
                radius="md"
                style={{ overflow: 'hidden', flex: 1, minWidth: 0 }}
              >
                <Group gap={6} wrap="nowrap">
                  <ThemeIcon size="sm" variant="light" color="orange" style={{ flexShrink: 0 }}>
                    <IconBuilding size={12} />
                  </ThemeIcon>
                  <Box style={{ minWidth: 0, flex: 1 }}>
                    <Text size="xs" c="dimmed">
                      Kurum
                    </Text>
                    <Text size="xs" fw={500} truncate="end">
                      {organization || '-'}
                    </Text>
                  </Box>
                </Group>
              </Paper>
            </Tooltip>
            <Paper p="xs" withBorder radius="md" style={{ flexShrink: 0, minWidth: 110 }}>
              <Group gap={6} wrap="nowrap">
                <ThemeIcon size="sm" variant="light" color="blue" style={{ flexShrink: 0 }}>
                  <IconMapPin size={12} />
                </ThemeIcon>
                <Box>
                  <Text size="xs" c="dimmed">
                    Şehir
                  </Text>
                  <Text size="xs" fw={500}>
                    {city || '-'}
                  </Text>
                </Box>
              </Group>
            </Paper>
            <Paper p="xs" withBorder radius="md" style={{ flexShrink: 0 }}>
              <Group gap={6} wrap="nowrap">
                <ThemeIcon size="sm" variant="light" color="cyan" style={{ flexShrink: 0 }}>
                  <IconCalendar size={12} />
                </ThemeIcon>
                <Box>
                  <Text size="xs" c="dimmed">
                    Son Teklif
                  </Text>
                  <Text size="xs" fw={500}>
                    {dateStr
                      ? new Date(dateStr).toLocaleDateString('tr-TR', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '-'}
                  </Text>
                </Box>
              </Group>
            </Paper>
          </Group>

          {/* Zeyilname & Düzeltme İlanı */}
          {(zeyilname || correction) && (
            <SimpleGrid cols={zeyilname && correction ? 2 : 1} spacing="xs" mb="md">
              {zeyilname && (
                <Card
                  p="sm"
                  radius="md"
                  withBorder
                  style={{ borderLeft: '4px solid var(--mantine-color-orange-6)' }}
                >
                  <Group gap="xs" mb="xs">
                    <ThemeIcon color="orange" size="sm" radius="xl">
                      <IconNote size={12} />
                    </ThemeIcon>
                    <Text size="sm" fw={600}>
                      Zeyilname
                    </Text>
                    <Badge color="orange" size="xs" variant="light">
                      Güncelleme
                    </Badge>
                  </Group>
                  <ScrollArea h={80}>
                    <Text size="xs" style={{ whiteSpace: 'pre-wrap' }}>
                      {zeyilname.content?.substring(0, 300)}
                      {(zeyilname.content?.length || 0) > 300 && '...'}
                    </Text>
                  </ScrollArea>
                </Card>
              )}
              {correction && (
                <Card
                  p="sm"
                  radius="md"
                  withBorder
                  style={{ borderLeft: '4px solid var(--mantine-color-red-6)' }}
                >
                  <Group gap="xs" mb="xs">
                    <ThemeIcon color="red" size="sm" radius="xl">
                      <IconSparkles size={12} />
                    </ThemeIcon>
                    <Text size="sm" fw={600}>
                      Düzeltme İlanı
                    </Text>
                    <Badge color="red" size="xs" variant="light">
                      Düzeltme
                    </Badge>
                  </Group>
                  <ScrollArea h={80}>
                    <Text size="xs" style={{ whiteSpace: 'pre-wrap' }}>
                      {correction.content?.substring(0, 300)}
                      {(correction.content?.length || 0) > 300 && '...'}
                    </Text>
                  </ScrollArea>
                </Card>
              )}
            </SimpleGrid>
          )}

          {/* Tabs: Özet / Analiz / Dökümanlar / Araçlar / Dilekçe / Teklif */}
          <Tabs
            value={activeDetailTab}
            onChange={(value) =>
              onStateChange({ activeDetailTab: value as IhaleMerkeziState['activeDetailTab'] })
            }
          >
            <Tabs.List grow>
              <Tabs.Tab value="ozet" leftSection={<IconFileText size={14} />}>
                Özet
              </Tabs.Tab>
              {/* Analiz - sadece döküman varsa göster */}
              {hasDocuments && (
                <Tabs.Tab
                  value="analiz"
                  leftSection={<IconBrain size={14} />}
                  disabled={!hasAnalysis}
                >
                  <Group gap={4}>
                    Analiz
                    {hasAnalysis ? (
                      <Badge size="xs" variant="filled" color="orange">
                        {(selectedTender.teknik_sart_sayisi || 0) +
                          (selectedTender.birim_fiyat_sayisi || 0)}
                      </Badge>
                    ) : (
                      <Badge size="xs" variant="light" color="gray">
                        Yok
                      </Badge>
                    )}
                  </Group>
                </Tabs.Tab>
              )}
              {/* Dökümanlar - sadece takip ediliyorsa göster */}
              {isSaved && (
                <Tabs.Tab value="dokumanlar" leftSection={<IconFile size={14} />}>
                  <Group gap={4}>
                    Dökümanlar
                    {selectedTender.dokuman_sayisi > 0 && (
                      <Badge size="xs" variant="light" color="gray">
                        {selectedTender.dokuman_sayisi}
                      </Badge>
                    )}
                  </Group>
                </Tabs.Tab>
              )}
              {/* Araçlar, Dilekçe, Teklif - sadece döküman varsa göster */}
              {hasDocuments && (
                <>
                  <Tabs.Tab value="araclar" leftSection={<IconCalculator size={14} />}>
                    Araçlar
                  </Tabs.Tab>
                  <Tabs.Tab value="dilekce" leftSection={<IconGavel size={14} />}>
                    Dilekçe
                  </Tabs.Tab>
                  <Tabs.Tab value="teklif" leftSection={<IconFileAnalytics size={14} />}>
                    Teklif
                  </Tabs.Tab>
                </>
              )}
            </Tabs.List>

            <Tabs.Panel value="ozet" pt="md">
              {/* Özet içeriği */}
              <Stack gap="md">
                {/* Takip Edilmemişse - Takip Et Kartı */}
                {!isSaved && (
                  <Paper
                    p="lg"
                    withBorder
                    radius="lg"
                    style={{
                      background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(59, 130, 246, 0.02))',
                      borderColor: 'var(--mantine-color-blue-5)',
                    }}
                  >
                    <Stack gap="md" align="center">
                      <ThemeIcon size={50} variant="light" color="blue" radius="xl">
                        <IconBookmark size={24} />
                      </ThemeIcon>
                      <Box ta="center">
                        <Text size="md" fw={600}>İhaleyi Takip Et</Text>
                        <Text size="sm" c="dimmed">
                          Döküman indirmek ve analiz yapmak için önce ihaleyi takip listesine ekleyin
                        </Text>
                      </Box>
                      <Button
                        variant="filled"
                        color="blue"
                        size="md"
                        leftSection={<IconBookmark size={18} />}
                        onClick={async () => {
                          try {
                            await tendersAPI.addTracking(selectedTender.id);
                            onRefreshData?.();
                          } catch (error) {
                            console.error('Takibe ekleme hatası:', error);
                          }
                        }}
                      >
                        Takip Listesine Ekle
                      </Button>
                    </Stack>
                  </Paper>
                )}

                {/* Takip Edilmiş ama Analiz Yok - Döküman Yönetimi Kartı */}
                {isSaved && !hasAnalysis && (
                  <Paper
                    p="lg"
                    withBorder
                    radius="lg"
                    style={{
                      background: 'linear-gradient(135deg, rgba(201, 162, 39, 0.15), rgba(201, 162, 39, 0.03))',
                      borderColor: '#C9A227',
                    }}
                  >
                    <Stack gap="md" align="center">
                      <ThemeIcon size={50} variant="light" color="orange" radius="xl">
                        <IconSparkles size={24} />
                      </ThemeIcon>
                      <Box ta="center">
                        <Text size="md" fw={600}>Döküman ve Analiz</Text>
                        <Text size="sm" c="dimmed">
                          Site içeriğini çekin, dökümanları indirin ve AI ile analiz edin
                        </Text>
                      </Box>
                      <Button
                        variant="gradient"
                        style={{ background: 'linear-gradient(135deg, #C9A227 0%, #D4AF37 50%, #E6C65C 100%)', border: 'none' }}
                        size="md"
                        leftSection={<IconFileText size={18} />}
                        onClick={openDocumentWizard}
                      >
                        Döküman Yönetimi
                      </Button>
                      {hasDocuments && (
                        <Text size="xs" c="dimmed">
                          {selectedTender.dokuman_sayisi} döküman mevcut, analiz bekliyor
                        </Text>
                      )}
                    </Stack>
                  </Paper>
                )}

                {/* Analiz Özeti - Kompakt Kartlar (sadece analiz varsa) */}
                {hasAnalysis && (
                  <SimpleGrid cols={3} spacing="xs">
                    <Paper
                      p="sm"
                      withBorder
                      radius="md"
                      style={{
                        background:
                          'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(59, 130, 246, 0.05))',
                        borderColor: 'var(--mantine-color-blue-6)',
                        cursor: 'pointer',
                      }}
                      onClick={() => onStateChange({ activeDetailTab: 'analiz' })}
                    >
                      <Group gap="xs">
                        <ThemeIcon size="lg" variant="light" color="blue" radius="xl">
                          <IconClipboardList size={18} />
                        </ThemeIcon>
                        <Box>
                          <Text size="xl" fw={700} c="blue">
                            {selectedTender.teknik_sart_sayisi || 0}
                          </Text>
                          <Text size="xs" c="dimmed">
                            Teknik Şart
                          </Text>
                        </Box>
                      </Group>
                    </Paper>
                    <Paper
                      p="sm"
                      withBorder
                      radius="md"
                      style={{
                        background:
                          'linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(34, 197, 94, 0.05))',
                        borderColor: 'var(--mantine-color-green-6)',
                        cursor: 'pointer',
                      }}
                      onClick={() => onStateChange({ activeDetailTab: 'analiz' })}
                    >
                      <Group gap="xs">
                        <ThemeIcon size="lg" variant="light" color="green" radius="xl">
                          <IconCurrencyLira size={18} />
                        </ThemeIcon>
                        <Box>
                          <Text size="xl" fw={700} c="green">
                            {selectedTender.birim_fiyat_sayisi || 0}
                          </Text>
                          <Text size="xs" c="dimmed">
                            Birim Fiyat
                          </Text>
                        </Box>
                      </Group>
                    </Paper>
                    <Paper
                      p="sm"
                      withBorder
                      radius="md"
                      style={{
                        background:
                          'linear-gradient(135deg, rgba(201, 162, 39, 0.15), rgba(201, 162, 39, 0.05))',
                        borderColor: '#C9A227',
                        cursor: 'pointer',
                      }}
                      onClick={() => onStateChange({ activeDetailTab: 'dokumanlar' })}
                    >
                      <Group gap="xs">
                        <ThemeIcon size="lg" variant="light" color="orange" radius="xl">
                          <IconFile size={18} />
                        </ThemeIcon>
                        <Box>
                          <Text size="xl" fw={700} c="orange">
                            {selectedTender.analiz_edilen_dokuman || 0}/
                            {selectedTender.dokuman_sayisi || 0}
                          </Text>
                          <Text size="xs" c="dimmed">
                            Analiz Edildi
                          </Text>
                        </Box>
                      </Group>
                    </Paper>
                  </SimpleGrid>
                )}

                {/* Öne Çıkan Teknik Şartlar (İlk 5) */}
                {selectedTender.analysis_summary?.teknik_sartlar &&
                  selectedTender.analysis_summary.teknik_sartlar.length > 0 && (
                    <Paper p="sm" withBorder radius="md" className="glassy-card-nested">
                      <Group justify="space-between" mb="xs">
                        <Group gap="xs">
                          <ThemeIcon size="sm" variant="light" color="blue">
                            <IconClipboardList size={12} />
                          </ThemeIcon>
                          <Text size="sm" fw={600}>
                            Öne Çıkan Teknik Şartlar
                          </Text>
                        </Group>
                        <Button
                          size="xs"
                          variant="subtle"
                          onClick={() => onStateChange({ activeDetailTab: 'analiz' })}
                          rightSection={<IconChevronDown size={12} />}
                        >
                          Tümü ({selectedTender.analysis_summary.teknik_sartlar.length})
                        </Button>
                      </Group>
                      <Stack gap={4}>
                        {selectedTender.analysis_summary.teknik_sartlar
                          .slice(0, 5)
                          .map((sart, idx) => {
                            const sartText =
                              typeof sart === 'string' ? sart : sart?.text || String(sart);
                            return (
                              <Group key={`ts-${sartText.substring(0, 30)}`} gap="xs" wrap="nowrap">
                                <Badge size="xs" variant="filled" color="blue" circle>
                                  {idx + 1}
                                </Badge>
                                <Text size="xs" lineClamp={1} style={{ flex: 1 }}>
                                  {sartText}
                                </Text>
                              </Group>
                            );
                          })}
                      </Stack>
                    </Paper>
                  )}

                {/* Öne Çıkan Birim Fiyatlar (İlk 5) */}
                {selectedTender.analysis_summary?.birim_fiyatlar &&
                  selectedTender.analysis_summary.birim_fiyatlar.length > 0 && (
                    <Paper p="sm" withBorder radius="md" className="glassy-card-nested">
                      <Group justify="space-between" mb="xs">
                        <Group gap="xs">
                          <ThemeIcon size="sm" variant="light" color="green">
                            <IconCurrencyLira size={12} />
                          </ThemeIcon>
                          <Text size="sm" fw={600}>
                            Öne Çıkan Birim Fiyatlar
                          </Text>
                        </Group>
                        <Button
                          size="xs"
                          variant="subtle"
                          onClick={() => onStateChange({ activeDetailTab: 'analiz' })}
                          rightSection={<IconChevronDown size={12} />}
                        >
                          Tümü ({selectedTender.analysis_summary.birim_fiyatlar.length})
                        </Button>
                      </Group>
                      <Stack gap={4}>
                        {selectedTender.analysis_summary.birim_fiyatlar
                          .slice(0, 5)
                          .map((item, idx) => {
                            const itemKey =
                              item.id ||
                              item.kalem ||
                              item.aciklama ||
                              `bf-${item.text?.substring(0, 20)}`;
                            return (
                              <Group key={String(itemKey)} justify="space-between" wrap="nowrap">
                                <Group gap="xs" style={{ flex: 1, minWidth: 0 }}>
                                  <Badge size="xs" variant="filled" color="green" circle>
                                    {idx + 1}
                                  </Badge>
                                  <Text size="xs" lineClamp={1} style={{ flex: 1 }}>
                                    {item.kalem || item.aciklama || item.text || 'Bilinmiyor'}
                                  </Text>
                                </Group>
                                <Group gap={4}>
                                  {item.birim && (
                                    <Badge size="xs" variant="outline" color="gray">
                                      {item.birim}
                                    </Badge>
                                  )}
                                  {(item.fiyat || item.tutar) && (
                                    <Badge size="xs" color="green">
                                      {Number(item.fiyat || item.tutar).toLocaleString('tr-TR')} ₺
                                    </Badge>
                                  )}
                                </Group>
                              </Group>
                            );
                          })}
                      </Stack>
                    </Paper>
                  )}

                {/* Hesaplama özeti */}
                {(selectedTender.yaklasik_maliyet ||
                  selectedTender.sinir_deger ||
                  selectedTender.bizim_teklif) && (
                  <Paper p="sm" withBorder radius="md" className="glassy-card-nested">
                    <Text size="sm" fw={600} mb="xs">
                      Hesaplama Özeti
                    </Text>
                    <SimpleGrid cols={3}>
                      <Box>
                        <Text size="xs" c="dimmed">
                          Yaklaşık Maliyet
                        </Text>
                        <Text size="sm" fw={600}>
                          {selectedTender.yaklasik_maliyet?.toLocaleString('tr-TR')} ₺
                        </Text>
                      </Box>
                      <Box>
                        <Text size="xs" c="dimmed">
                          Sınır Değer
                        </Text>
                        <Text size="sm" fw={600}>
                          {selectedTender.sinir_deger?.toLocaleString('tr-TR')} ₺
                        </Text>
                      </Box>
                      <Box>
                        <Text size="xs" c="dimmed">
                          Bizim Teklif
                        </Text>
                        <Text size="sm" fw={600} c="green">
                          {selectedTender.bizim_teklif?.toLocaleString('tr-TR')} ₺
                        </Text>
                      </Box>
                    </SimpleGrid>
                  </Paper>
                )}

                {/* Analiz yoksa mesaj */}
                {!selectedTender.analysis_summary?.teknik_sartlar?.length &&
                  !selectedTender.analysis_summary?.birim_fiyatlar?.length &&
                  !selectedTender.yaklasik_maliyet && (
                    <Paper p="md" withBorder radius="md" ta="center">
                      <Text size="sm" c="dimmed">
                        Bu ihale için henüz analiz yapılmamış.
                      </Text>
                      <Text size="xs" c="dimmed" mt="xs">
                        Dökümanlar sekmesinden dökümanları indirip analiz edebilirsiniz.
                      </Text>
                    </Paper>
                  )}
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="analiz" pt="md">
              {/* Analiz sekmesi - Teknik Şartlar + Birim Fiyatlar */}
              {isSaved ? (
                <AnalysisSection tender={selectedTender} />
              ) : (
                <Text size="sm" c="dimmed">
                  Takip edilen ihaleler için kullanılabilir.
                </Text>
              )}
            </Tabs.Panel>

            <Tabs.Panel value="dokumanlar" pt="md">
              {/* Dökümanlar sekmesi - Wizard Modal ile döküman yönetimi */}
              {isSaved ? (
                <DokumanlarSection 
                  tenderId={selectedTender.tender_id} 
                  tenderTitle={selectedTender.ihale_basligi}
                  dokumansayisi={selectedTender.dokuman_sayisi || 0}
                  analizEdilen={selectedTender.analiz_edilen_dokuman || 0}
                  onRefresh={onRefreshData} 
                />
              ) : (
                <Text size="sm" c="dimmed">
                  Takip edilen ihaleler için kullanılabilir.
                </Text>
              )}
            </Tabs.Panel>

            <Tabs.Panel value="araclar" pt="md">
              {/* Hesaplama araçları */}
              {isSaved ? (
                <AraclarSection tender={selectedTender} onRefresh={onRefreshData} />
              ) : (
                <Text size="sm" c="dimmed">
                  Takip edilen ihaleler için kullanılabilir.
                </Text>
              )}
            </Tabs.Panel>

            <Tabs.Panel value="dilekce" pt="md">
              <DilekceSection
                tender={isSaved ? selectedTender : null}
                dilekceType={dilekceType}
                onSelectType={(type) => onStateChange({ dilekceType: type })}
              />
            </Tabs.Panel>

            <Tabs.Panel value="teklif" pt="md">
              {/* Teklif cetveli */}
              <Text size="sm" c="dimmed" mb="md">
                Detaylı teklif cetveli hazırlamak için butona tıklayın
              </Text>
              <Button
                variant="gradient"
                style={{ background: 'linear-gradient(135deg, #C9A227 0%, #D4AF37 50%, #E6C65C 100%)', border: 'none' }}
                leftSection={<IconFileAnalytics size={16} />}
                onClick={() => onStateChange({ teklifModalOpen: true })}
              >
                Teklif Cetveli Hazırla
              </Button>
            </Tabs.Panel>
          </Tabs>
        </Box>
      </ScrollArea>

      {/* Document Wizard Modal - accessible from Özet tab */}
      {isSaved && (
        <DocumentWizardModal
          opened={documentWizardOpen}
          onClose={closeDocumentWizard}
          tenderId={selectedTender.tender_id}
          tenderTitle={selectedTender.ihale_basligi}
          onComplete={onRefreshData}
        />
      )}
    </Box>
  );
}

// Dilekçe Type Card Component
function DilekceTypeCard({
  label,
  description,
  icon,
  color,
  selected,
  onClick,
}: {
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <Paper
      p="sm"
      radius="md"
      withBorder
      onClick={onClick}
      style={{
        cursor: 'pointer',
        borderColor: selected ? `var(--mantine-color-${color}-5)` : undefined,
        borderWidth: selected ? 2 : 1,
        background: selected ? `var(--mantine-color-${color}-light)` : undefined,
        transition: 'all 0.15s ease',
      }}
    >
      <Group gap="xs">
        <ThemeIcon size="md" variant={selected ? 'filled' : 'light'} color={color}>
          {icon}
        </ThemeIcon>
        <Box>
          <Text size="sm" fw={600}>
            {label}
          </Text>
          <Text size="xs" c="dimmed">
            {description}
          </Text>
        </Box>
      </Group>
    </Paper>
  );
}

// ========== DOKÜMANLAR SEKMESİ ==========

// ========== DÖKÜMANLAR SEKMESİ (Wizard Modal ile) ==========

interface DokumanlarSectionProps {
  tenderId: number;
  tenderTitle?: string;
  dokumansayisi?: number;
  analizEdilen?: number;
  onRefresh?: () => void;
}

function DokumanlarSection({ tenderId, tenderTitle, dokumansayisi = 0, analizEdilen = 0, onRefresh }: DokumanlarSectionProps) {
  const [wizardOpen, setWizardOpen] = useState(false);

  return (
    <>
      <Stack gap="md">
        {/* Özet Kartı */}
        <Paper p="lg" withBorder radius="md" bg="dark.6">
          <Stack gap="md" align="center">
            <ThemeIcon size={60} variant="light" color="orange" radius="xl">
              <IconFile size={30} />
            </ThemeIcon>
            
            <Box ta="center">
              <Text size="xl" fw={700}>
                {dokumansayisi > 0 ? `${dokumansayisi} Döküman` : 'Döküman Yok'}
              </Text>
              {dokumansayisi > 0 && (
                <Text size="sm" c="dimmed">
                  {analizEdilen > 0 
                    ? `${analizEdilen} tanesi analiz edildi`
                    : 'Henüz analiz yapılmamış'}
                </Text>
              )}
            </Box>

            {/* Progress */}
            {dokumansayisi > 0 && (
              <Box w="100%" maw={300}>
                <Group justify="space-between" mb={4}>
                  <Text size="xs" c="dimmed">Analiz Durumu</Text>
                  <Text size="xs" c="dimmed">{Math.round((analizEdilen / dokumansayisi) * 100)}%</Text>
                </Group>
                <Box 
                  h={8} 
                  bg="dark.4" 
                  style={{ borderRadius: 4, overflow: 'hidden' }}
                >
                  <Box 
                    h="100%" 
                    w={`${(analizEdilen / dokumansayisi) * 100}%`}
                    bg="green"
                    style={{ transition: 'width 0.3s ease' }}
                  />
                </Box>
              </Box>
            )}

            {/* Ana Buton */}
            <Button
              size="lg"
              variant="gradient"
              style={{ background: 'linear-gradient(135deg, #C9A227 0%, #D4AF37 50%, #E6C65C 100%)', border: 'none' }}
              leftSection={<IconFileText size={20} />}
              onClick={() => setWizardOpen(true)}
              fullWidth
              maw={300}
            >
              Döküman Yönetimi
            </Button>

            <Text size="xs" c="dimmed" ta="center">
              Site içeriği çekme, döküman indirme ve AI analizi için tıklayın
            </Text>
          </Stack>
        </Paper>

        {/* Hızlı Bilgi */}
        {dokumansayisi === 0 && (
          <Paper p="md" withBorder radius="md">
            <Stack gap="xs">
              <Text size="sm" fw={500}>Nasıl Çalışır?</Text>
              <Stack gap={4}>
                <Group gap="xs">
                  <Badge size="sm" circle>1</Badge>
                  <Text size="xs">Site içeriği çekilir (ilan, mal/hizmet listesi)</Text>
                </Group>
                <Group gap="xs">
                  <Badge size="sm" circle>2</Badge>
                  <Text size="xs">PDF/ZIP dökümanlar indirilir</Text>
                </Group>
                <Group gap="xs">
                  <Badge size="sm" circle>3</Badge>
                  <Text size="xs">AI ile analiz edilir (teknik şartlar, birim fiyatlar)</Text>
                </Group>
              </Stack>
            </Stack>
          </Paper>
        )}
      </Stack>

      {/* Wizard Modal */}
      <DocumentWizardModal
        opened={wizardOpen}
        onClose={() => setWizardOpen(false)}
        tenderId={tenderId}
        tenderTitle={tenderTitle}
        onComplete={onRefresh}
      />
    </>
  );
}

// ========== ANALİZ SEKMESİ ==========

// Helper: Teknik şart text'ini al
function getTeknikSartText(sart: string | TeknikSart): string {
  return typeof sart === 'string' ? sart : sart.text;
}

// Helper: Teknik şart kaynak dökümanını al
function getTeknikSartSource(sart: string | TeknikSart): string | undefined {
  return typeof sart === 'object' ? sart.source : undefined;
}

// Helper: Not text'ini al
function getNoteText(not: string | AINote): string {
  return typeof not === 'string' ? not : not.text;
}

// Helper: Not kaynak dökümanını al
function getNoteSource(not: string | AINote): string | undefined {
  return typeof not === 'object' ? not.source : undefined;
}

function AnalysisSection({ tender }: { tender: SavedTender }) {
  const [activeAnalysisTab, setActiveAnalysisTab] = useState<string>('teknik');
  const [teknikSartArama, setTeknikSartArama] = useState('');
  const [birimFiyatArama, setBirimFiyatArama] = useState('');
  const [aiNotArama, setAiNotArama] = useState('');
  const [sadeceZorunluGoster, setSadeceZorunluGoster] = useState(false);

  // Detay verisi için state (tam metin vs)
  const [detailedAnalysis, setDetailedAnalysis] = useState<AnalysisData | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Detay verisini çek (tam metin için)
  const fetchDetails = useCallback(async () => {
    if (!tender.tender_id) return;

    setLoadingDetails(true);
    try {
      const response = await tendersAPI.getTrackingDetails(tender.tender_id);
      if (response.success && response.data?.analysis) {
        setDetailedAnalysis(response.data.analysis);
      }
    } catch (err) {
      console.error('Detay verisi alınamadı:', err);
    } finally {
      setLoadingDetails(false);
    }
  }, [tender.tender_id]);

  // İlk yüklemede detay verisini çek
  useEffect(() => {
    // Eğer analysis_summary'de tam_metin yoksa detay verisini çek
    if (!tender.analysis_summary?.tam_metin && tender.tender_id) {
      fetchDetails();
    }
  }, [tender.tender_id, tender.analysis_summary?.tam_metin, fetchDetails]);

  // Verileri birleştir (detaydan veya summary'den)
  const analysisData = detailedAnalysis || tender.analysis_summary;

  // Tüm teknik şartlar
  const allTeknikSartlar = analysisData?.teknik_sartlar || [];

  // Zorunlu şartlar
  const zorunluSartlar = allTeknikSartlar.filter((s) =>
    /zorunlu|mecburi|şart|gerekli|mutlaka/i.test(getTeknikSartText(s))
  );

  // Filtrelenmiş teknik şartlar
  const filteredTeknikSartlar = allTeknikSartlar.filter((sart) => {
    const text = getTeknikSartText(sart);
    const matchesSearch = text.toLowerCase().includes(teknikSartArama.toLowerCase());
    const matchesZorunlu =
      !sadeceZorunluGoster || /zorunlu|mecburi|şart|gerekli|mutlaka/i.test(text);
    return matchesSearch && matchesZorunlu;
  });

  // Filtrelenmiş birim fiyatlar
  const filteredBirimFiyatlar =
    analysisData?.birim_fiyatlar?.filter((item) =>
      (item.kalem || item.aciklama || item.text || '')
        .toLowerCase()
        .includes(birimFiyatArama.toLowerCase())
    ) || [];

  // AI Notları
  const allNotlar = analysisData?.notlar || [];
  const filteredNotlar = allNotlar.filter((not) =>
    getNoteText(not).toLowerCase().includes(aiNotArama.toLowerCase())
  );

  // Tam Metin
  const tamMetin = analysisData?.tam_metin || '';

  // Analiz yoksa mesaj
  if (!tender.teknik_sart_sayisi && !tender.birim_fiyat_sayisi && !allNotlar.length) {
    return (
      <Paper p="xl" withBorder radius="md" ta="center">
        <ThemeIcon size="xl" variant="light" color="gray" radius="xl" mb="md">
          <IconBrain size={28} />
        </ThemeIcon>
        <Text size="lg" fw={600} mb="xs">
          Henüz analiz yapılmamış
        </Text>
        <Text size="sm" c="dimmed" mb="md">
          Dökümanlar sekmesinden dökümanları indirip AI ile analiz edin.
        </Text>
      </Paper>
    );
  }

  return (
    <Stack gap="md">
      {/* Alt Sekmeler */}
      <SegmentedControl
        value={activeAnalysisTab}
        onChange={setActiveAnalysisTab}
        data={[
          {
            value: 'teknik',
            label: (
              <Group gap={4}>
                <IconClipboardList size={14} />
                <span>Teknik Şartlar</span>
                <Badge size="xs" variant="filled" color="blue">
                  {tender.teknik_sart_sayisi}
                </Badge>
              </Group>
            ),
          },
          {
            value: 'birim',
            label: (
              <Group gap={4}>
                <IconCurrencyLira size={14} />
                <span>Birim Fiyatlar</span>
                <Badge size="xs" variant="filled" color="green">
                  {tender.birim_fiyat_sayisi}
                </Badge>
              </Group>
            ),
          },
          ...(allNotlar.length > 0
            ? [
                {
                  value: 'notlar',
                  label: (
                    <Group gap={4}>
                      <IconBulb size={14} />
                      <span>AI Notları</span>
                      <Badge size="xs" variant="filled" color="orange">
                        {allNotlar.length}
                      </Badge>
                    </Group>
                  ),
                },
              ]
            : []),
          {
            value: 'metin',
            label: (
              <Group gap={4}>
                <IconFileText size={14} />
                <span>Tam Metin</span>
                {loadingDetails && <Loader size={10} />}
              </Group>
            ),
          },
        ]}
        size="xs"
        fullWidth
      />

      {/* Teknik Şartlar Tab */}
      {activeAnalysisTab === 'teknik' && (
        <Stack gap="xs">
          {/* Arama ve Filtreler */}
          <Group gap="xs">
            <TextInput
              placeholder="Teknik şartlarda ara..."
              leftSection={<IconSearch size={14} />}
              value={teknikSartArama}
              onChange={(e) => setTeknikSartArama(e.target.value)}
              size="xs"
              style={{ flex: 1 }}
            />
            <Chip
              checked={sadeceZorunluGoster}
              onChange={() => setSadeceZorunluGoster(!sadeceZorunluGoster)}
              color="red"
              variant="filled"
              size="xs"
            >
              Zorunlu ({zorunluSartlar.length})
            </Chip>
          </Group>

          {/* Liste */}
          <ScrollArea h={320}>
            <Stack gap={4}>
              {filteredTeknikSartlar.length === 0 ? (
                <Paper p="md" withBorder radius="md" ta="center">
                  <Text size="sm" c="dimmed">
                    {teknikSartArama || sadeceZorunluGoster
                      ? 'Sonuç bulunamadı'
                      : 'Henüz teknik şart yok'}
                  </Text>
                </Paper>
              ) : (
                filteredTeknikSartlar.map((sart, idx) => {
                  const text = getTeknikSartText(sart);
                  const source = getTeknikSartSource(sart);
                  const isZorunlu = /zorunlu|mecburi|şart|gerekli|mutlaka/i.test(text);

                  return (
                    <Paper
                      key={`ts-${idx}-${text.substring(0, 20)}`}
                      p="xs"
                      withBorder
                      radius="sm"
                      style={{
                        background: isZorunlu
                          ? 'rgba(239, 68, 68, 0.05)'
                          : 'rgba(59, 130, 246, 0.03)',
                        borderLeft: isZorunlu ? '3px solid var(--mantine-color-red-5)' : undefined,
                      }}
                    >
                      <Group justify="space-between" wrap="nowrap">
                        <Group gap="xs" style={{ flex: 1, minWidth: 0 }}>
                          <Badge
                            size="xs"
                            variant="filled"
                            color={isZorunlu ? 'red' : 'blue'}
                            circle
                          >
                            {idx + 1}
                          </Badge>
                          <Box style={{ flex: 1, minWidth: 0 }}>
                            <Text size="xs">{text}</Text>
                            {source && (
                              <Text size="xs" c="dimmed" fs="italic">
                                Kaynak: {source}
                              </Text>
                            )}
                          </Box>
                        </Group>
                        <CopyButton value={text}>
                          {({ copied, copy }) => (
                            <Tooltip label={copied ? 'Kopyalandı!' : 'Kopyala'}>
                              <ActionIcon
                                size="xs"
                                variant="subtle"
                                color={copied ? 'green' : 'gray'}
                                onClick={copy}
                              >
                                <IconCopy size={12} />
                              </ActionIcon>
                            </Tooltip>
                          )}
                        </CopyButton>
                      </Group>
                    </Paper>
                  );
                })
              )}
            </Stack>
          </ScrollArea>

          {/* Toplam */}
          <Group justify="space-between">
            <Group gap="xs">
              <Badge variant="light" color="red" size="sm">
                {zorunluSartlar.length} Zorunlu
              </Badge>
              <Badge variant="light" color="blue" size="sm">
                {tender.teknik_sart_sayisi} Toplam
              </Badge>
            </Group>
            <CopyButton value={filteredTeknikSartlar.map((s) => getTeknikSartText(s)).join('\n')}>
              {({ copied, copy }) => (
                <Button
                  size="xs"
                  variant="light"
                  color={copied ? 'green' : 'blue'}
                  onClick={copy}
                  leftSection={<IconCopy size={12} />}
                >
                  {copied ? 'Kopyalandı!' : 'Tümünü Kopyala'}
                </Button>
              )}
            </CopyButton>
          </Group>
        </Stack>
      )}

      {/* Birim Fiyatlar Tab */}
      {activeAnalysisTab === 'birim' && (
        <Stack gap="xs">
          {/* Arama */}
          <TextInput
            placeholder="Birim fiyatlarda ara..."
            leftSection={<IconSearch size={14} />}
            value={birimFiyatArama}
            onChange={(e) => setBirimFiyatArama(e.target.value)}
            size="xs"
          />

          {/* Tablo */}
          <ScrollArea h={350}>
            {filteredBirimFiyatlar.length === 0 ? (
              <Paper p="md" withBorder radius="md" ta="center">
                <Text size="sm" c="dimmed">
                  {birimFiyatArama ? 'Sonuç bulunamadı' : 'Henüz birim fiyat yok'}
                </Text>
              </Paper>
            ) : (
              <Table striped highlightOnHover withTableBorder withColumnBorders>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th style={{ width: 40 }}>#</Table.Th>
                    <Table.Th>Tanım</Table.Th>
                    <Table.Th style={{ width: 70 }}>Miktar</Table.Th>
                    <Table.Th style={{ width: 70 }}>Birim</Table.Th>
                    <Table.Th style={{ width: 100, textAlign: 'right' }}>Fiyat</Table.Th>
                    <Table.Th style={{ width: 40 }} />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {filteredBirimFiyatlar.map((item, idx) => (
                    <Table.Tr key={`bf-${idx}-${item.id || item.kalem?.substring(0, 10) || idx}`}>
                      <Table.Td>
                        <Badge size="xs" variant="filled" color="green" circle>
                          {idx + 1}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs">
                          {item.kalem || item.aciklama || item.text || 'Bilinmiyor'}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" ta="center">
                          {item.miktar || '-'}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge size="xs" variant="outline" color="gray">
                          {item.birim || '-'}
                        </Badge>
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        <Text size="xs" fw={600} c="green">
                          {item.fiyat || item.tutar
                            ? `${Number(item.fiyat || item.tutar).toLocaleString('tr-TR')} ₺`
                            : '-'}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <CopyButton
                          value={`${item.kalem || item.aciklama || item.text || ''}\t${item.miktar || ''}\t${item.birim || ''}\t${item.fiyat || item.tutar || ''}`}
                        >
                          {({ copied, copy }) => (
                            <Tooltip label={copied ? 'Kopyalandı!' : 'Kopyala'}>
                              <ActionIcon
                                size="xs"
                                variant="subtle"
                                color={copied ? 'green' : 'gray'}
                                onClick={copy}
                              >
                                <IconCopy size={12} />
                              </ActionIcon>
                            </Tooltip>
                          )}
                        </CopyButton>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </ScrollArea>

          {/* Toplam */}
          <Group justify="space-between">
            <Text size="xs" c="dimmed">
              {birimFiyatArama
                ? `${filteredBirimFiyatlar.length} / ${tender.birim_fiyat_sayisi} sonuç`
                : `Toplam: ${tender.birim_fiyat_sayisi} birim fiyat`}
            </Text>
            <CopyButton
              value={filteredBirimFiyatlar
                .map(
                  (i) =>
                    `${i.kalem || i.aciklama || i.text || ''}\t${i.miktar || ''}\t${i.birim || ''}\t${i.fiyat || i.tutar || ''}`
                )
                .join('\n')}
            >
              {({ copied, copy }) => (
                <Button
                  size="xs"
                  variant="light"
                  color={copied ? 'green' : 'blue'}
                  onClick={copy}
                  leftSection={<IconCopy size={12} />}
                >
                  {copied ? 'Kopyalandı!' : 'Tümünü Kopyala'}
                </Button>
              )}
            </CopyButton>
          </Group>
        </Stack>
      )}

      {/* AI Notları Tab */}
      {activeAnalysisTab === 'notlar' && (
        <Stack gap="xs">
          {/* Arama */}
          <TextInput
            placeholder="Notlarda ara..."
            leftSection={<IconSearch size={14} />}
            value={aiNotArama}
            onChange={(e) => setAiNotArama(e.target.value)}
            size="xs"
          />

          {/* Liste */}
          <ScrollArea h={350}>
            <Stack gap={4}>
              {filteredNotlar.length === 0 ? (
                <Paper p="md" withBorder radius="md" ta="center">
                  <Text size="sm" c="dimmed">
                    {aiNotArama ? 'Sonuç bulunamadı' : 'Henüz AI notu yok'}
                  </Text>
                </Paper>
              ) : (
                filteredNotlar.map((not, idx) => {
                  const text = getNoteText(not);
                  const source = getNoteSource(not);

                  return (
                    <Paper
                      key={`note-${idx}-${text.substring(0, 20)}`}
                      p="sm"
                      withBorder
                      radius="sm"
                      style={{
                        background: 'rgba(234, 179, 8, 0.05)',
                        borderLeft: '3px solid var(--mantine-color-yellow-5)',
                      }}
                    >
                      <Group justify="space-between" wrap="nowrap" align="flex-start">
                        <Group gap="xs" style={{ flex: 1, minWidth: 0 }} align="flex-start">
                          <ThemeIcon size="sm" variant="light" color="orange" radius="xl">
                            <IconBulb size={12} />
                          </ThemeIcon>
                          <Box style={{ flex: 1, minWidth: 0 }}>
                            <Text size="xs">{text}</Text>
                            {source && (
                              <Text size="xs" c="dimmed" fs="italic" mt={4}>
                                Kaynak: {source}
                              </Text>
                            )}
                          </Box>
                        </Group>
                        <CopyButton value={text}>
                          {({ copied, copy }) => (
                            <Tooltip label={copied ? 'Kopyalandı!' : 'Kopyala'}>
                              <ActionIcon
                                size="xs"
                                variant="subtle"
                                color={copied ? 'green' : 'gray'}
                                onClick={copy}
                              >
                                <IconCopy size={12} />
                              </ActionIcon>
                            </Tooltip>
                          )}
                        </CopyButton>
                      </Group>
                    </Paper>
                  );
                })
              )}
            </Stack>
          </ScrollArea>

          {/* Toplam */}
          <Group justify="space-between">
            <Text size="xs" c="dimmed">
              {aiNotArama
                ? `${filteredNotlar.length} / ${allNotlar.length} sonuç`
                : `Toplam: ${allNotlar.length} AI notu`}
            </Text>
            <CopyButton value={filteredNotlar.map((n) => getNoteText(n)).join('\n\n')}>
              {({ copied, copy }) => (
                <Button
                  size="xs"
                  variant="light"
                  color={copied ? 'green' : 'yellow'}
                  onClick={copy}
                  leftSection={<IconCopy size={12} />}
                >
                  {copied ? 'Kopyalandı!' : 'Tümünü Kopyala'}
                </Button>
              )}
            </CopyButton>
          </Group>
        </Stack>
      )}

      {/* Tam Metin Tab */}
      {activeAnalysisTab === 'metin' && (
        <Stack gap="xs">
          <Paper p="sm" withBorder radius="md">
            <Group justify="space-between" mb="xs">
              <Text size="sm" fw={600}>
                Dökümanlardan Çıkarılan Tam Metin
              </Text>
              <Group gap="xs">
                <Tooltip label="Yenile">
                  <ActionIcon
                    size="sm"
                    variant="light"
                    color="gray"
                    onClick={fetchDetails}
                    loading={loadingDetails}
                  >
                    <IconRefresh size={14} />
                  </ActionIcon>
                </Tooltip>
                <CopyButton value={tamMetin}>
                  {({ copied, copy }) => (
                    <Button
                      size="xs"
                      variant="light"
                      color={copied ? 'green' : 'blue'}
                      onClick={copy}
                      leftSection={<IconCopy size={12} />}
                      disabled={!tamMetin}
                    >
                      {copied ? 'Kopyalandı!' : 'Kopyala'}
                    </Button>
                  )}
                </CopyButton>
              </Group>
            </Group>
            <ScrollArea h={350}>
              {loadingDetails ? (
                <Center h={200}>
                  <Loader size="sm" />
                </Center>
              ) : tamMetin ? (
                <Text size="xs" style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                  {tamMetin}
                </Text>
              ) : (
                <Center h={200}>
                  <Stack align="center" gap="xs">
                    <ThemeIcon size="lg" variant="light" color="gray" radius="xl">
                      <IconFileText size={20} />
                    </ThemeIcon>
                    <Text size="sm" c="dimmed" ta="center">
                      Tam metin bulunamadı.
                    </Text>
                    <Text size="xs" c="dimmed" ta="center">
                      Dökümanlar analiz edildiğinde burada tam metin görüntülenecek.
                    </Text>
                    <Button
                      size="xs"
                      variant="light"
                      onClick={fetchDetails}
                      leftSection={<IconRefresh size={12} />}
                    >
                      Yeniden Dene
                    </Button>
                  </Stack>
                </Center>
              )}
            </ScrollArea>
          </Paper>
          {tamMetin && (
            <Text size="xs" c="dimmed">
              Toplam: {tamMetin.length.toLocaleString('tr-TR')} karakter
            </Text>
          )}
        </Stack>
      )}
    </Stack>
  );
}

// ========== ARAÇLAR SEKMESİ ==========

interface TeklifItem {
  firma: string;
  tutar: number;
}

interface MaliyetBilesenleri {
  anaCigGirdi: number;
  yardimciGirdi: number;
  iscilik: number;
  nakliye: number;
  sozlesmeGideri: number;
  genelGider: number;
}

function AraclarSection({ tender, onRefresh }: { tender: SavedTender; onRefresh?: () => void }) {
  const [yaklasikMaliyet, setYaklasikMaliyet] = useState(tender.yaklasik_maliyet || 0);
  const [sinirDeger, setSinirDeger] = useState<number | null>(tender.sinir_deger || null);
  const [bizimTeklif, setBizimTeklif] = useState(tender.bizim_teklif || 0);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Teklif listesi (KİK formülü için)
  const [teklifListesi, setTeklifListesi] = useState<TeklifItem[]>([
    { firma: '', tutar: 0 },
    { firma: '', tutar: 0 },
  ]);

  // Maliyet bileşenleri (aşırı düşük için)
  const [maliyetBilesenleri, setMaliyetBilesenleri] = useState<MaliyetBilesenleri>({
    anaCigGirdi: 0,
    yardimciGirdi: 0,
    iscilik: 0,
    nakliye: 0,
    sozlesmeGideri: 0,
    genelGider: 0,
  });

  // Hesaplama sonuçları
  const [hesaplananSinirDeger, setHesaplananSinirDeger] = useState<number | null>(null);
  const [asiriDusukSonuc, setAsiriDusukSonuc] = useState<{
    asiriDusukMu: boolean;
    toplamMaliyet: number;
    farkOran: number;
    aciklama: string;
  } | null>(null);
  const [teminatSonuc, setTeminatSonuc] = useState<{
    geciciTeminat: number;
    kesinTeminat: number;
    damgaVergisi: number;
  } | null>(null);
  const [bedelSonuc, setBedelSonuc] = useState<{
    bedel: number;
    aciklama: string;
  } | null>(null);

  // Auto-save
  const saveData = useDebouncedCallback(async () => {
    setSaveStatus('saving');
    try {
      await tendersAPI.updateTracking(Number(tender.id), {
        yaklasik_maliyet: yaklasikMaliyet || null,
        sinir_deger: sinirDeger || null,
        bizim_teklif: bizimTeklif || null,
        hesaplama_verileri: {
          teklifListesi,
          maliyetBilesenleri,
        },
      });
      setSaveStatus('saved');
      onRefresh?.();
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Save error:', error);
      setSaveStatus('idle');
    }
  }, 1000);

  useEffect(() => {
    if (yaklasikMaliyet > 0 || sinirDeger || bizimTeklif > 0) {
      saveData();
    }
  }, [yaklasikMaliyet, sinirDeger, bizimTeklif, saveData]);

  // KİK Formülü ile Sınır Değer Hesapla
  const hesaplaSinirDeger = () => {
    const gecerliTeklifler = teklifListesi.filter((t) => t.tutar > 0).map((t) => t.tutar);

    if (gecerliTeklifler.length < 2) {
      // Basit formül: %85
      if (yaklasikMaliyet) {
        const basit = yaklasikMaliyet * 0.85;
        setHesaplananSinirDeger(basit);
      }
      return;
    }

    // KİK formülü
    const n = gecerliTeklifler.length;
    const toplam = gecerliTeklifler.reduce((a, b) => a + b, 0);
    const ortalama = toplam / n;

    // Standart sapma
    const varyans = gecerliTeklifler.reduce((acc, val) => acc + (val - ortalama) ** 2, 0) / n;
    const stdSapma = Math.sqrt(varyans);

    // K katsayısı (teklif sayısına göre)
    const kValues: Record<number, number> = {
      2: 1.5,
      3: 1.35,
      4: 1.25,
      5: 1.18,
      6: 1.13,
      7: 1.09,
      8: 1.06,
    };
    const k = kValues[Math.min(n, 8)] || 1.0;

    // Sınır değer = Ortalama - (K * Standart Sapma)
    const sinir = Math.max(ortalama - k * stdSapma, ortalama * 0.4);

    setHesaplananSinirDeger(sinir);
  };

  // Aşırı düşük analiz (maliyet bileşenleri ile)
  const hesaplaAsiriDusuk = () => {
    const sd = sinirDeger || hesaplananSinirDeger;
    if (!sd || !bizimTeklif) return;

    const toplamMaliyet = Object.values(maliyetBilesenleri).reduce((a, b) => a + b, 0);
    const asiriDusukMu = bizimTeklif < sd;
    const farkOran = ((sd - bizimTeklif) / sd) * 100;

    let aciklama = '';
    if (asiriDusukMu) {
      if (toplamMaliyet > 0 && toplamMaliyet <= bizimTeklif) {
        aciklama = `Teklifiniz sınır değerin %${farkOran.toFixed(1)} altında. Maliyet bileşenleriniz (${toplamMaliyet.toLocaleString('tr-TR')} ₺) teklifi karşılıyor.`;
      } else if (toplamMaliyet > bizimTeklif) {
        aciklama = `⚠️ DİKKAT: Maliyet bileşenleriniz (${toplamMaliyet.toLocaleString('tr-TR')} ₺) tekliften yüksek! Açıklama kabul edilmeyebilir.`;
      } else {
        aciklama = `Teklifiniz sınır değerin %${farkOran.toFixed(1)} altında. Maliyet bileşenlerini girin.`;
      }
    } else {
      aciklama = 'Teklifiniz sınır değerin üstünde. Aşırı düşük sorgusu riski düşük.';
    }

    setAsiriDusukSonuc({
      asiriDusukMu,
      toplamMaliyet,
      farkOran,
      aciklama,
    });
  };

  // Teminat hesapla
  const hesaplaTeminat = () => {
    const tutar = bizimTeklif || yaklasikMaliyet;
    if (!tutar) return;
    setTeminatSonuc({
      geciciTeminat: tutar * 0.03,
      kesinTeminat: tutar * 0.06,
      damgaVergisi: tutar * 0.00948,
    });
  };

  // İtirazen şikayet bedeli (2026 tarifeleri)
  const hesaplaBedel = () => {
    const ym = yaklasikMaliyet;
    if (!ym) return;

    let bedel = 0;
    let aciklama = '';

    if (ym <= 1000000) {
      bedel = 12000;
      aciklama = '0 - 1.000.000 ₺ arası';
    } else if (ym <= 5000000) {
      bedel = 24000;
      aciklama = '1.000.000 - 5.000.000 ₺ arası';
    } else if (ym <= 10000000) {
      bedel = 36000;
      aciklama = '5.000.000 - 10.000.000 ₺ arası';
    } else if (ym <= 25000000) {
      bedel = 48000;
      aciklama = '10.000.000 - 25.000.000 ₺ arası';
    } else if (ym <= 50000000) {
      bedel = 60000;
      aciklama = '25.000.000 - 50.000.000 ₺ arası';
    } else if (ym <= 100000000) {
      bedel = 72000;
      aciklama = '50.000.000 - 100.000.000 ₺ arası';
    } else {
      bedel = 84000;
      aciklama = '100.000.000 ₺ üzeri';
    }

    setBedelSonuc({ bedel, aciklama });
  };

  return (
    <ScrollArea h={450}>
      <Stack gap="md" pr="xs">
        {/* Kayıt Durumu */}
        {saveStatus !== 'idle' && (
          <Badge size="xs" color={saveStatus === 'saving' ? 'blue' : 'green'} variant="light">
            {saveStatus === 'saving' ? 'Kaydediliyor...' : 'Kaydedildi'}
          </Badge>
        )}

        {/* Temel Veriler */}
        <Paper p="sm" withBorder radius="md">
          <Group gap="xs" mb="sm">
            <IconCalculator size={16} color="var(--mantine-color-blue-6)" />
            <Text size="sm" fw={600}>
              Teklif Verileri
            </Text>
          </Group>
          <SimpleGrid cols={3}>
            <NumberInput
              label="Yaklaşık Maliyet"
              value={yaklasikMaliyet || ''}
              onChange={(val) => setYaklasikMaliyet(Number(val) || 0)}
              thousandSeparator="."
              decimalSeparator=","
              rightSection={
                <Text size="xs" c="dimmed">
                  ₺
                </Text>
              }
              size="xs"
            />
            <NumberInput
              label="Sınır Değer"
              value={sinirDeger || ''}
              onChange={(val) => setSinirDeger(val ? Number(val) : null)}
              thousandSeparator="."
              decimalSeparator=","
              rightSection={
                <Text size="xs" c="dimmed">
                  ₺
                </Text>
              }
              size="xs"
              placeholder="Hesapla"
            />
            <NumberInput
              label="Bizim Teklif"
              value={bizimTeklif || ''}
              onChange={(val) => setBizimTeklif(Number(val) || 0)}
              thousandSeparator="."
              decimalSeparator=","
              rightSection={
                <Text size="xs" c="dimmed">
                  ₺
                </Text>
              }
              size="xs"
            />
          </SimpleGrid>
        </Paper>

        {/* KİK Formülü - Sınır Değer */}
        <Paper p="sm" withBorder radius="md">
          <Group justify="space-between" mb="sm">
            <Group gap="xs">
              <IconMathFunction size={16} color="#C9A227" />
              <Text size="sm" fw={600}>
                KİK Sınır Değer Formülü
              </Text>
            </Group>
            <Button
              size="compact-xs"
              variant="subtle"
              leftSection={<IconPlus size={12} />}
              onClick={() => setTeklifListesi((prev) => [...prev, { firma: '', tutar: 0 }])}
            >
              Teklif Ekle
            </Button>
          </Group>

          <Stack gap={4} mb="sm">
            {teklifListesi.map((teklif, index) => (
              <Group key={`teklif-${teklif.firma || 'empty'}-${teklif.tutar}-${index}`} gap={6}>
                <TextInput
                  placeholder={`Firma ${index + 1}`}
                  value={teklif.firma}
                  onChange={(e) =>
                    setTeklifListesi((prev) =>
                      prev.map((t, i) => (i === index ? { ...t, firma: e.target.value } : t))
                    )
                  }
                  style={{ flex: 1, maxWidth: 100 }}
                  size="xs"
                />
                <NumberInput
                  placeholder="Tutar"
                  value={teklif.tutar || ''}
                  onChange={(val) =>
                    setTeklifListesi((prev) =>
                      prev.map((t, i) => (i === index ? { ...t, tutar: Number(val) || 0 } : t))
                    )
                  }
                  thousandSeparator="."
                  decimalSeparator=","
                  style={{ flex: 1 }}
                  size="xs"
                  rightSection={
                    <Text size="xs" c="dimmed">
                      ₺
                    </Text>
                  }
                />
                {teklifListesi.length > 2 && (
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    size="sm"
                    onClick={() => setTeklifListesi((prev) => prev.filter((_, i) => i !== index))}
                  >
                    <IconTrash size={14} />
                  </ActionIcon>
                )}
              </Group>
            ))}
          </Stack>

          <Button
            fullWidth
            size="xs"
            variant="light"
            color="orange"
            leftSection={<IconCalculator size={14} />}
            onClick={hesaplaSinirDeger}
          >
            Sınır Değer Hesapla
          </Button>

          {hesaplananSinirDeger && (
            <Paper p="xs" mt="sm" radius="sm" bg="var(--mantine-color-green-light)">
              <Group justify="space-between">
                <Box>
                  <Text size="xs" c="dimmed">
                    Hesaplanan Sınır Değer
                  </Text>
                  <Text size="lg" fw={700} c="green">
                    {hesaplananSinirDeger.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺
                  </Text>
                </Box>
                <Button
                  size="xs"
                  variant="filled"
                  color="green"
                  onClick={() => setSinirDeger(Math.round(hesaplananSinirDeger))}
                >
                  Uygula
                </Button>
              </Group>
            </Paper>
          )}
        </Paper>

        {/* Aşırı Düşük Analizi */}
        <Paper p="sm" withBorder radius="md">
          <Group gap="xs" mb="sm">
            <IconAlertTriangle size={16} color="var(--mantine-color-orange-6)" />
            <Text size="sm" fw={600}>
              Aşırı Düşük Analizi
            </Text>
          </Group>

          {sinirDeger && bizimTeklif > 0 && (
            <Paper
              p="xs"
              mb="sm"
              radius="sm"
              bg={
                bizimTeklif < sinirDeger
                  ? 'var(--mantine-color-orange-light)'
                  : 'var(--mantine-color-green-light)'
              }
            >
              <Group justify="space-between">
                <Text fw={600} size="xs" c={bizimTeklif < sinirDeger ? 'orange' : 'green'}>
                  {bizimTeklif < sinirDeger ? '⚠ Açıklama Gerekli' : '✓ Uygun'}
                </Text>
                <Text fw={600} size="xs">
                  {Math.abs(sinirDeger - bizimTeklif).toLocaleString('tr-TR')} ₺ fark
                </Text>
              </Group>
            </Paper>
          )}

          <Text size="xs" fw={500} mb={6} c="dimmed">
            Maliyet Bileşenleri
          </Text>
          <SimpleGrid cols={2} spacing={6}>
            <NumberInput
              label="Ana Çiğ Girdi"
              value={maliyetBilesenleri.anaCigGirdi || ''}
              onChange={(val) =>
                setMaliyetBilesenleri((prev) => ({ ...prev, anaCigGirdi: Number(val) || 0 }))
              }
              thousandSeparator="."
              decimalSeparator=","
              size="xs"
            />
            <NumberInput
              label="Yardımcı Girdi"
              value={maliyetBilesenleri.yardimciGirdi || ''}
              onChange={(val) =>
                setMaliyetBilesenleri((prev) => ({ ...prev, yardimciGirdi: Number(val) || 0 }))
              }
              thousandSeparator="."
              decimalSeparator=","
              size="xs"
            />
            <NumberInput
              label="İşçilik"
              value={maliyetBilesenleri.iscilik || ''}
              onChange={(val) =>
                setMaliyetBilesenleri((prev) => ({ ...prev, iscilik: Number(val) || 0 }))
              }
              thousandSeparator="."
              decimalSeparator=","
              size="xs"
            />
            <NumberInput
              label="Nakliye"
              value={maliyetBilesenleri.nakliye || ''}
              onChange={(val) =>
                setMaliyetBilesenleri((prev) => ({ ...prev, nakliye: Number(val) || 0 }))
              }
              thousandSeparator="."
              decimalSeparator=","
              size="xs"
            />
            <NumberInput
              label="Sözleşme Gideri"
              value={maliyetBilesenleri.sozlesmeGideri || ''}
              onChange={(val) =>
                setMaliyetBilesenleri((prev) => ({ ...prev, sozlesmeGideri: Number(val) || 0 }))
              }
              thousandSeparator="."
              decimalSeparator=","
              size="xs"
            />
            <NumberInput
              label="Genel Gider + Kâr"
              value={maliyetBilesenleri.genelGider || ''}
              onChange={(val) =>
                setMaliyetBilesenleri((prev) => ({ ...prev, genelGider: Number(val) || 0 }))
              }
              thousandSeparator="."
              decimalSeparator=","
              size="xs"
            />
          </SimpleGrid>

          <Button
            fullWidth
            mt="sm"
            size="xs"
            variant="light"
            color="orange"
            leftSection={<IconCalculator size={14} />}
            onClick={hesaplaAsiriDusuk}
            disabled={!sinirDeger || bizimTeklif <= 0}
          >
            Analiz Et
          </Button>

          {asiriDusukSonuc && (
            <Paper
              p="xs"
              mt="sm"
              radius="sm"
              bg={
                asiriDusukSonuc.asiriDusukMu
                  ? 'var(--mantine-color-orange-light)'
                  : 'var(--mantine-color-green-light)'
              }
            >
              <Group justify="space-between" mb={4}>
                <Badge color={asiriDusukSonuc.asiriDusukMu ? 'orange' : 'green'} size="sm">
                  {asiriDusukSonuc.asiriDusukMu ? 'Aşırı Düşük' : 'Normal'}
                </Badge>
                {asiriDusukSonuc.toplamMaliyet > 0 && (
                  <Text size="xs" fw={600}>
                    Maliyet: {asiriDusukSonuc.toplamMaliyet.toLocaleString('tr-TR')} ₺
                  </Text>
                )}
              </Group>
              <Text size="xs" c="dimmed">
                {asiriDusukSonuc.aciklama}
              </Text>
            </Paper>
          )}
        </Paper>

        {/* Teminat ve İtirazen Şikayet */}
        <SimpleGrid cols={2}>
          {/* Teminat */}
          <Paper p="sm" withBorder radius="md">
            <Group gap="xs" mb="sm">
              <IconScale size={16} color="var(--mantine-color-blue-6)" />
              <Text size="sm" fw={600}>
                Teminat
              </Text>
            </Group>
            <Button
              fullWidth
              size="xs"
              variant="light"
              color="blue"
              onClick={hesaplaTeminat}
              disabled={!yaklasikMaliyet && !bizimTeklif}
            >
              Hesapla
            </Button>
            {teminatSonuc && (
              <Stack gap={4} mt="sm">
                <Group justify="space-between">
                  <Text size="xs" c="dimmed">
                    Geçici (%3)
                  </Text>
                  <Text size="xs" fw={600}>
                    {teminatSonuc.geciciTeminat.toLocaleString('tr-TR', {
                      maximumFractionDigits: 0,
                    })}{' '}
                    ₺
                  </Text>
                </Group>
                <Group justify="space-between">
                  <Text size="xs" c="dimmed">
                    Kesin (%6)
                  </Text>
                  <Text size="xs" fw={600}>
                    {teminatSonuc.kesinTeminat.toLocaleString('tr-TR', {
                      maximumFractionDigits: 0,
                    })}{' '}
                    ₺
                  </Text>
                </Group>
                <Group justify="space-between">
                  <Text size="xs" c="dimmed">
                    Damga V.
                  </Text>
                  <Text size="xs" fw={600}>
                    {teminatSonuc.damgaVergisi.toLocaleString('tr-TR', {
                      maximumFractionDigits: 0,
                    })}{' '}
                    ₺
                  </Text>
                </Group>
              </Stack>
            )}
          </Paper>

          {/* İtirazen Şikayet Bedeli */}
          <Paper p="sm" withBorder radius="md">
            <Group gap="xs" mb="sm">
              <IconCoin size={16} color="var(--mantine-color-teal-6)" />
              <Text size="sm" fw={600}>
                İtirazen Şikayet
              </Text>
            </Group>
            <Text size="xs" c="dimmed" mb="xs">
              2026 Tarifeleri
            </Text>
            <Button
              fullWidth
              size="xs"
              variant="light"
              color="teal"
              onClick={hesaplaBedel}
              disabled={!yaklasikMaliyet}
            >
              Hesapla
            </Button>
            {bedelSonuc && (
              <Paper p="xs" mt="sm" radius="sm" bg="var(--mantine-color-teal-light)">
                <Text size="lg" fw={700} c="teal">
                  {bedelSonuc.bedel.toLocaleString('tr-TR')} ₺
                </Text>
                <Text size="xs" c="dimmed">
                  {bedelSonuc.aciklama}
                </Text>
              </Paper>
            )}
          </Paper>
        </SimpleGrid>
      </Stack>
    </ScrollArea>
  );
}

// ========== DİLEKÇE SEKMESİ ==========

const dilekceTypes = {
  asiri_dusuk: {
    label: 'Aşırı Düşük Savunma',
    description: 'Aşırı düşük teklif açıklaması',
    icon: IconFileAnalytics,
    color: 'orange',
  },
  idare_sikayet: {
    label: 'İdareye Şikayet',
    description: 'İdareye şikayet başvurusu',
    icon: IconGavel,
    color: 'red',
  },
  kik_itiraz: {
    label: 'KİK İtiraz',
    description: 'Kamu İhale Kurumu itirazı',
    icon: IconScale,
    color: 'yellow',
  },
  aciklama_cevabi: {
    label: 'Açıklama Cevabı',
    description: 'Genel açıklama/cevap yazısı',
    icon: IconNote,
    color: 'teal',
  },
};

interface DilekceSectionProps {
  tender: SavedTender | null;
  dilekceType: string | null;
  onSelectType: (type: string | null) => void;
}

function DilekceSection({ tender, dilekceType, onSelectType }: DilekceSectionProps) {
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>(
    []
  );
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [dilekceContent, setDilekceContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  // AI ile dilekçe oluştur
  const handleSendMessage = async () => {
    if (!input.trim() || !tender || !dilekceType) return;

    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const typeInfo = dilekceTypes[dilekceType as keyof typeof dilekceTypes];
      const systemPrompt = `Sen bir kamu ihale uzmanısın. ${typeInfo.label} dilekçesi hazırlamaya yardım ediyorsun.
İhale bilgileri:
- Başlık: ${tender.ihale_basligi}
- Kurum: ${tender.kurum}
- Tarih: ${tender.tarih}
- Yaklaşık Maliyet: ${tender.yaklasik_maliyet?.toLocaleString('tr-TR')} ₺
- Bizim Teklif: ${tender.bizim_teklif?.toLocaleString('tr-TR')} ₺
- Sınır Değer: ${tender.sinir_deger?.toLocaleString('tr-TR')} ₺

Kullanıcının isteğine göre profesyonel bir ${typeInfo.label} hazırla. Dilekçe formatında, resmi dil kullan.`;

      const response = await aiAPI.sendAgentMessage({
        message: userMessage,
        systemContext: systemPrompt,
        department: 'İHALE',
      });

      if (response.success && response.data?.response) {
        const assistantMessage = response.data.response;
        setMessages((prev) => [...prev, { role: 'assistant', content: assistantMessage }]);

        // Eğer dilekçe içeriği oluşturulduysa kaydet
        if (
          assistantMessage.includes('SAYIN') ||
          assistantMessage.includes('İDAREYE') ||
          assistantMessage.includes('KAMU İHALE KURUMU')
        ) {
          setDilekceContent(assistantMessage);
        }
      }
    } catch (error) {
      console.error('Dilekçe AI error:', error);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Bir hata oluştu. Lütfen tekrar deneyin.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Dilekçeyi kopyala
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(dilekceContent);
      notifications.show({
        title: 'Kopyalandı',
        message: 'Dilekçe panoya kopyalandı',
        color: 'green',
      });
    } catch {
      // Fallback
    }
  };

  // Dilekçeyi indir (txt)
  const handleDownload = () => {
    const blob = new Blob([dilekceContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dilekce_${dilekceType}_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Tür seçilmemişse kart listesi göster
  if (!dilekceType) {
    return (
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Dilekçe tipi seçerek AI destekli dilekçe hazırlayın
        </Text>
        <SimpleGrid cols={2} spacing="xs">
          {Object.entries(dilekceTypes).map(([key, type]) => {
            const IconComp = type.icon;
            return (
              <DilekceTypeCard
                key={key}
                label={type.label}
                description={type.description}
                icon={<IconComp size={18} />}
                color={type.color}
                selected={false}
                onClick={() => onSelectType(key)}
              />
            );
          })}
        </SimpleGrid>
      </Stack>
    );
  }

  const selectedType = dilekceTypes[dilekceType as keyof typeof dilekceTypes];

  return (
    <Stack gap="md" h={450}>
      {/* Header */}
      <Group justify="space-between">
        <Group gap="xs">
          <ActionIcon
            variant="subtle"
            onClick={() => {
              onSelectType(null);
              setMessages([]);
              setDilekceContent('');
            }}
          >
            <IconArrowLeft size={16} />
          </ActionIcon>
          <Badge color={selectedType.color} variant="light" size="lg">
            {selectedType.label}
          </Badge>
        </Group>
        {dilekceContent && (
          <Group gap="xs">
            <Button
              size="xs"
              variant="light"
              leftSection={<IconCopy size={14} />}
              onClick={handleCopy}
            >
              Kopyala
            </Button>
            <Button
              size="xs"
              variant="light"
              color="green"
              leftSection={<IconFileDownload size={14} />}
              onClick={handleDownload}
            >
              İndir
            </Button>
          </Group>
        )}
      </Group>

      {/* Dilekçe içeriği veya chat */}
      {dilekceContent && !isEditing ? (
        <Paper p="md" withBorder radius="md" style={{ flex: 1, overflow: 'auto' }}>
          <Group justify="space-between" mb="sm">
            <Text size="sm" fw={600}>
              Oluşturulan Dilekçe
            </Text>
            <Button size="xs" variant="subtle" onClick={() => setIsEditing(true)}>
              Düzenle
            </Button>
          </Group>
          <ScrollArea h={300}>
            <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
              {dilekceContent}
            </Text>
          </ScrollArea>
        </Paper>
      ) : dilekceContent && isEditing ? (
        <Paper p="md" withBorder radius="md" style={{ flex: 1 }}>
          <Group justify="space-between" mb="sm">
            <Text size="sm" fw={600}>
              Dilekçeyi Düzenle
            </Text>
            <Button size="xs" variant="filled" color="green" onClick={() => setIsEditing(false)}>
              Kaydet
            </Button>
          </Group>
          <Textarea
            value={dilekceContent}
            onChange={(e) => setDilekceContent(e.target.value)}
            minRows={12}
            maxRows={15}
            autosize
          />
        </Paper>
      ) : (
        <>
          {/* Chat mesajları */}
          <ScrollArea style={{ flex: 1 }} offsetScrollbars>
            <Stack gap="xs">
              {messages.length === 0 && (
                <Paper p="md" withBorder radius="md" ta="center">
                  <ThemeIcon
                    size="xl"
                    variant="light"
                    color={selectedType.color}
                    radius="xl"
                    mb="sm"
                  >
                    <selectedType.icon size={24} />
                  </ThemeIcon>
                  <Text size="sm" fw={600} mb="xs">
                    {selectedType.label}
                  </Text>
                  <Text size="xs" c="dimmed" mb="md">
                    AI ile {selectedType.label.toLowerCase()} hazırlamak için talimatlarınızı yazın.
                  </Text>
                  <Stack gap={4}>
                    <Text size="xs" c="dimmed">
                      Örnek: "Bu ihale için aşırı düşük savunma dilekçesi hazırla"
                    </Text>
                    <Text size="xs" c="dimmed">
                      Örnek: "Sınır değerin altında kaldık, açıklama yaz"
                    </Text>
                  </Stack>
                </Paper>
              )}
              {messages.map((msg, idx) => (
                <Paper
                  key={`dilekce-msg-${msg.role}-${idx}`}
                  p="sm"
                  radius="md"
                  bg={
                    msg.role === 'user'
                      ? 'var(--mantine-color-blue-light)'
                      : 'var(--mantine-color-gray-light)'
                  }
                  style={{
                    alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '90%',
                  }}
                >
                  <Text size="xs" style={{ whiteSpace: 'pre-wrap' }}>
                    {msg.content}
                  </Text>
                </Paper>
              ))}
              {loading && (
                <Paper p="sm" radius="md" bg="var(--mantine-color-gray-light)">
                  <Group gap="xs">
                    <Loader size="xs" />
                    <Text size="xs" c="dimmed">
                      Dilekçe hazırlanıyor...
                    </Text>
                  </Group>
                </Paper>
              )}
              <div ref={messagesEndRef} />
            </Stack>
          </ScrollArea>

          {/* Input */}
          <Group gap="xs">
            <Textarea
              placeholder="Dilekçe talimatlarınızı yazın..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              style={{ flex: 1 }}
              minRows={1}
              maxRows={3}
              autosize
              disabled={loading || !tender}
            />
            <ActionIcon
              size="lg"
              color="blue"
              variant="filled"
              onClick={handleSendMessage}
              disabled={!input.trim() || loading || !tender}
            >
              <IconSend size={16} />
            </ActionIcon>
          </Group>
        </>
      )}
    </Stack>
  );
}
