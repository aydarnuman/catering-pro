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
  Divider,
  Group,
  Loader,
  Modal,
  NumberInput,
  Paper,
  Progress,
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
  IconAlertCircle,
  IconAlertTriangle,
  IconArrowLeft,
  IconBookmark,
  IconBrain,
  IconBuilding,
  IconBulb,
  IconCalculator,
  IconCalendar,
  IconCertificate,
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconClipboardList,
  IconClock,
  IconCoin,
  IconCopy,
  IconCurrencyLira,
  IconDatabase,
  IconDownload,
  IconExclamationMark,
  IconExternalLink,
  IconFile,
  IconFileAnalytics,
  IconFileDownload,
  IconFileText,
  IconGavel,
  IconInfoCircle,
  IconMapPin,
  IconMathFunction,
  IconNote,
  IconPhone,
  IconPlus,
  IconRefresh,
  IconRotate,
  IconScale,
  IconSearch,
  IconSend,
  IconSettings,
  IconShield,
  IconSparkles,
  IconToolsKitchen2,
  IconTrash,
  IconUsers,
  IconWallet,
  IconX,
} from '@tabler/icons-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ContextualNotesSection } from '@/components/notes/ContextualNotesSection';
import { aiAPI } from '@/lib/api/services/ai';
import { tendersAPI } from '@/lib/api/services/tenders';
import { API_BASE_URL } from '@/lib/config';
import type { Tender } from '@/types/api';
import { CalculationModal } from '../CalculationModal';
import { DocumentWizardModal } from '../DocumentWizardModal';
import { detectMissingCriticalData, InlineDataForm } from '../InlineDataForm';
import type {
  AINote,
  AnalysisData,
  CezaKosulu,
  FiyatFarki,
  GerekliBelge,
  IhaleMerkeziState,
  IletisimBilgileri,
  MaliKriterler,
  OgunBilgisi,
  OnemliNot,
  PersonelDetay,
  SavedTender,
  ServisSaatleri,
  TakvimItem,
  TeknikSart,
  TeminatOranlari,
  TenderStatus,
} from '../types';
import { statusConfig } from '../types';

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
  const { selectedTender, activeDetailTab, firmalar, selectedFirmaId } = state;

  // Selected firma
  const selectedFirma = firmalar?.find((f) => f.id === selectedFirmaId);

  // Döküman Ayarları Modal state
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

  // Döküman Wizard Modal state (Özet sekmesinden erişim için)
  const [documentWizardOpen, setDocumentWizardOpen] = useState(false);

  // Analiz Detay Modalleri
  const [teknikModalOpen, setTeknikModalOpen] = useState(false);
  const [birimModalOpen, setBirimModalOpen] = useState(false);
  const [tamMetinModalOpen, setTamMetinModalOpen] = useState(false);
  const [sartnameGramajModalOpen, setSartnameGramajModalOpen] = useState(false);

  const [docStats, setDocStats] = useState<{
    total: number;
    completed: number;
    pending: number;
    failed: number;
    documents: Array<{
      original_filename: string;
      doc_type: string;
      processing_status: string;
      source_type?: string;
    }>;
  } | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);

  // Döküman istatistiklerini çek
  const fetchDocStats = useCallback(async () => {
    if (!selectedTender || !('tender_id' in selectedTender)) return;

    setSettingsLoading(true);
    try {
      const response = await tendersAPI.getDownloadedDocuments(String(selectedTender.tender_id));
      if (response.success && response.data?.documents) {
        type DocFile = {
          original_filename: string;
          doc_type: string;
          processing_status: string;
          file_type?: string;
          source_type?: string;
        };
        const allDocs: DocFile[] = response.data.documents
          .flatMap((g: { files: DocFile[] }) => g.files)
          .filter(
            (d: DocFile) =>
              !d.original_filename?.toLowerCase().endsWith('.zip') &&
              !d.original_filename?.toLowerCase().endsWith('.rar')
          );
        setDocStats({
          total: allDocs.length,
          completed: allDocs.filter((d: DocFile) => d.processing_status === 'completed').length,
          pending: allDocs.filter((d: DocFile) => d.processing_status === 'pending').length,
          failed: allDocs.filter((d: DocFile) => d.processing_status === 'failed').length,
          documents: allDocs.map((d: DocFile) => ({
            original_filename: d.original_filename,
            doc_type: d.doc_type || 'Bilinmiyor',
            processing_status: d.processing_status,
            source_type: d.source_type,
          })),
        });
      }
    } catch (error) {
      console.error('Doc stats error:', error);
    } finally {
      setSettingsLoading(false);
    }
  }, [selectedTender]);

  // Modal açıldığında istatistikleri çek
  useEffect(() => {
    if (settingsModalOpen) {
      fetchDocStats();
    }
  }, [settingsModalOpen, fetchDocStats]);

  // Döküman işlemleri
  const handleSyncAnalysis = async () => {
    if (!selectedTender || !('tender_id' in selectedTender)) return;
    setSettingsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/tender-tracking/add-from-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tender_id: selectedTender.tender_id }),
      });
      const data = await response.json();
      if (data.success) {
        notifications.show({
          title: 'Başarılı',
          message: 'Analiz özeti güncellendi',
          color: 'green',
        });
        onRefreshData?.();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      notifications.show({
        title: 'Hata',
        message: error instanceof Error ? error.message : 'Senkronizasyon başarısız',
        color: 'red',
      });
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleResetDocuments = async () => {
    if (!selectedTender || !('tender_id' in selectedTender)) return;
    if (
      !confirm(
        'Tüm dökümanları sıfırlamak istediğinize emin misiniz?\n\nBu işlem dökümanları tekrar analiz edilebilir hale getirir.'
      )
    )
      return;

    setSettingsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/tender-content/documents/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tenderId: selectedTender.tender_id }),
      });
      const data = await response.json();
      if (data.success) {
        notifications.show({
          title: 'Başarılı',
          message: `${data.resetCount} döküman sıfırlandı`,
          color: 'green',
        });
        fetchDocStats();
        onRefreshData?.();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      notifications.show({
        title: 'Hata',
        message: error instanceof Error ? error.message : 'Sıfırlama başarısız',
        color: 'red',
      });
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleClearAnalysis = async () => {
    if (!selectedTender || !('tender_id' in selectedTender)) return;
    if (
      !confirm(
        'Tüm analiz sonuçlarını temizlemek istediğinize emin misiniz?\n\nDökümanlar silinmez, sadece analizler sıfırlanır.'
      )
    )
      return;

    setSettingsLoading(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/tender-content/${selectedTender.tender_id}/clear-analysis`,
        {
          method: 'POST',
          credentials: 'include',
        }
      );
      const data = await response.json();
      if (data.success) {
        notifications.show({
          title: 'Başarılı',
          message: `${data.clearedCount} dökümanın analizi temizlendi`,
          color: 'green',
        });
        fetchDocStats();
        onRefreshData?.();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      notifications.show({
        title: 'Hata',
        message: error instanceof Error ? error.message : 'Temizleme başarısız',
        color: 'red',
      });
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleDeleteAllDocuments = async () => {
    if (!selectedTender || !('tender_id' in selectedTender)) return;
    if (
      !confirm(
        'Bu ihaleye ait TÜM dökümanları silmek istediğinize emin misiniz?\n\nBu işlem geri alınamaz!'
      )
    )
      return;

    setSettingsLoading(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/tender-content/${selectedTender.tender_id}/documents?deleteFromStorage=true`,
        {
          method: 'DELETE',
          credentials: 'include',
        }
      );
      const data = await response.json();
      if (data.success) {
        notifications.show({
          title: 'Başarılı',
          message: `${data.deletedCount} döküman silindi`,
          color: 'green',
        });
        setSettingsModalOpen(false);
        fetchDocStats();
        onRefreshData?.();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      notifications.show({
        title: 'Hata',
        message: error instanceof Error ? error.message : 'Silme başarısız',
        color: 'red',
      });
    } finally {
      setSettingsLoading(false);
    }
  };

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

  // Tipli analysis_summary (SavedTender için)
  const analysisSummary: AnalysisData | undefined = isSaved
    ? selectedTender.analysis_summary
    : undefined;

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
                <>
                  <Tooltip label="Döküman Ayarları">
                    <ActionIcon
                      variant="light"
                      color="grape"
                      size="md"
                      onClick={() => setSettingsModalOpen(true)}
                    >
                      <IconSettings size={16} />
                    </ActionIcon>
                  </Tooltip>
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
                </>
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
              {/* Notlar */}
              {isSaved && (
                <Tabs.Tab value="notlar" leftSection={<IconNote size={14} />}>
                  Notlar
                </Tabs.Tab>
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
                      background:
                        'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(59, 130, 246, 0.02))',
                      borderColor: 'var(--mantine-color-blue-5)',
                    }}
                  >
                    <Stack gap="md" align="center">
                      <ThemeIcon size={50} variant="light" color="blue" radius="xl">
                        <IconBookmark size={24} />
                      </ThemeIcon>
                      <Box ta="center">
                        <Text size="md" fw={600}>
                          İhaleyi Takip Et
                        </Text>
                        <Text size="sm" c="dimmed">
                          Döküman indirmek ve analiz yapmak için önce ihaleyi takip listesine
                          ekleyin
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

                {/* Takip Edilmiş ama Analiz Yok - Bilgi Mesajı */}
                {isSaved && !hasAnalysis && (
                  <Paper p="sm" withBorder radius="md" bg="dark.7">
                    <Group gap="xs">
                      <ThemeIcon size="sm" variant="light" color="yellow" radius="xl">
                        <IconSparkles size={14} />
                      </ThemeIcon>
                      <Text size="xs" c="dimmed">
                        Döküman indirme ve AI analizi için <strong>Dökümanlar</strong> sekmesini
                        kullanın
                      </Text>
                    </Group>
                  </Paper>
                )}

                {/* Analiz Özeti - Kompakt Kartlar (sadece analiz varsa) */}
                {hasAnalysis && (
                  <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="xs">
                    {/* Teknik Şartlar */}
                    <Paper
                      p="sm"
                      withBorder
                      radius="md"
                      style={{
                        background:
                          'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(59, 130, 246, 0.05))',
                        borderColor: 'var(--mantine-color-blue-6)',
                        cursor:
                          (selectedTender.teknik_sart_sayisi || 0) > 0 ? 'pointer' : 'default',
                      }}
                      onClick={() =>
                        (selectedTender.teknik_sart_sayisi || 0) > 0 && setTeknikModalOpen(true)
                      }
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

                    {/* Birim Fiyatlar */}
                    <Paper
                      p="sm"
                      withBorder
                      radius="md"
                      style={{
                        background:
                          'linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(34, 197, 94, 0.05))',
                        borderColor: 'var(--mantine-color-green-6)',
                        cursor:
                          (selectedTender.birim_fiyat_sayisi || 0) > 0 ? 'pointer' : 'default',
                      }}
                      onClick={() =>
                        (selectedTender.birim_fiyat_sayisi || 0) > 0 && setBirimModalOpen(true)
                      }
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

                    {/* Tam Metin */}
                    <Paper
                      p="sm"
                      withBorder
                      radius="md"
                      style={{
                        background:
                          'linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(139, 92, 246, 0.05))',
                        borderColor: 'var(--mantine-color-violet-6)',
                        cursor: analysisSummary?.tam_metin ? 'pointer' : 'default',
                      }}
                      onClick={() => analysisSummary?.tam_metin && setTamMetinModalOpen(true)}
                    >
                      <Group gap="xs">
                        <ThemeIcon size="lg" variant="light" color="violet" radius="xl">
                          <IconFileText size={18} />
                        </ThemeIcon>
                        <Box>
                          <Text size="xl" fw={700} c="violet">
                            {analysisSummary?.tam_metin ? '📄' : '-'}
                          </Text>
                          <Text size="xs" c="dimmed">
                            Tam Metin
                          </Text>
                        </Box>
                      </Group>
                    </Paper>

                    {/* Analiz Edildi - Tıklayınca modal açılır */}
                    <Tooltip label="Döküman Yönetimi">
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
                        onClick={() => setDocumentWizardOpen(true)}
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
                              Analiz
                            </Text>
                          </Box>
                        </Group>
                      </Paper>
                    </Tooltip>
                  </SimpleGrid>
                )}

                {/* AI Özeti */}
                {analysisSummary?.ozet && (
                  <Paper p="sm" withBorder radius="md" className="glassy-card-nested">
                    <Group gap="xs" mb="xs">
                      <ThemeIcon size="sm" variant="light" color="violet">
                        <IconBrain size={12} />
                      </ThemeIcon>
                      <Text size="sm" fw={600}>
                        AI Özeti
                      </Text>
                      {analysisSummary.ihale_turu && (
                        <Badge size="xs" variant="light" color="grape">
                          {analysisSummary.ihale_turu}
                        </Badge>
                      )}
                    </Group>
                    <Text size="sm" c="dimmed" style={{ lineHeight: 1.6 }}>
                      {analysisSummary.ozet}
                    </Text>
                    {(analysisSummary.teslim_suresi || analysisSummary.tahmini_bedel) && (
                      <Group gap="md" mt="xs">
                        {analysisSummary.teslim_suresi && (
                          <Badge
                            variant="outline"
                            color="blue"
                            size="sm"
                            leftSection={<IconClock size={10} />}
                          >
                            {analysisSummary.teslim_suresi}
                          </Badge>
                        )}
                        {analysisSummary.tahmini_bedel &&
                          analysisSummary.tahmini_bedel !== 'Belirtilmemiş' && (
                            <Badge
                              variant="outline"
                              color="green"
                              size="sm"
                              leftSection={<IconCurrencyLira size={10} />}
                            >
                              {analysisSummary.tahmini_bedel}
                            </Badge>
                          )}
                      </Group>
                    )}
                  </Paper>
                )}

                {/* Takvim */}
                {analysisSummary?.takvim && analysisSummary.takvim.length > 0 && (
                  <TakvimCard takvim={analysisSummary.takvim} />
                )}

                {/* Önemli Notlar */}
                {analysisSummary?.onemli_notlar && analysisSummary.onemli_notlar.length > 0 && (
                  <OnemliNotlarCard
                    notlar={
                      analysisSummary.onemli_notlar as Array<
                        { not: string; tur?: 'bilgi' | 'uyari' | 'gereklilik' } | string
                      >
                    }
                  />
                )}

                {/* Teknik Şartlar */}
                {analysisSummary?.teknik_sartlar && analysisSummary.teknik_sartlar.length > 0 && (
                  <TeknikSartlarCard teknikSartlar={analysisSummary.teknik_sartlar} />
                )}

                {/* Birim Fiyatlar */}
                {analysisSummary?.birim_fiyatlar && analysisSummary.birim_fiyatlar.length > 0 && (
                  <BirimFiyatlarCard birimFiyatlar={analysisSummary.birim_fiyatlar} />
                )}

                {/* Eksik Bilgiler */}
                {analysisSummary?.eksik_bilgiler && analysisSummary.eksik_bilgiler.length > 0 && (
                  <EksikBilgilerCard eksikBilgiler={analysisSummary.eksik_bilgiler} />
                )}

                {/* ═══════════════════════════════════════════════════════════════ */}
                {/* YENİ DETAY KARTLARI - Tüm analiz bilgileri */}
                {/* ═══════════════════════════════════════════════════════════════ */}

                {/* Dashboard Grid - Kritik bilgiler yan yana */}
                {(analysisSummary?.iletisim && Object.keys(analysisSummary.iletisim).length > 0) ||
                (analysisSummary?.servis_saatleri &&
                  Object.keys(analysisSummary.servis_saatleri).length > 0) ||
                (analysisSummary?.teminat_oranlari &&
                  Object.keys(analysisSummary.teminat_oranlari).length > 0) ? (
                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                    {/* İletişim Bilgileri */}
                    {analysisSummary?.iletisim &&
                      Object.keys(analysisSummary.iletisim).length > 0 && (
                        <IletisimCard iletisim={analysisSummary.iletisim} />
                      )}

                    {/* Servis Saatleri */}
                    {analysisSummary?.servis_saatleri &&
                      Object.keys(analysisSummary.servis_saatleri).length > 0 && (
                        <ServisSaatleriCard saatler={analysisSummary.servis_saatleri} />
                      )}

                    {/* Teminat Oranları */}
                    {analysisSummary?.teminat_oranlari &&
                      Object.keys(analysisSummary.teminat_oranlari).length > 0 && (
                        <TeminatOranlariCard teminat={analysisSummary.teminat_oranlari} />
                      )}

                    {/* Mali Kriterler */}
                    {analysisSummary?.mali_kriterler &&
                      Object.keys(analysisSummary.mali_kriterler).length > 0 && (
                        <MaliKriterlerCard kriterler={analysisSummary.mali_kriterler} />
                      )}
                  </SimpleGrid>
                ) : null}

                {/* Personel ve Öğün Bilgileri */}
                {((analysisSummary?.personel_detaylari &&
                  analysisSummary.personel_detaylari.length > 0) ||
                  (analysisSummary?.ogun_bilgileri &&
                    analysisSummary.ogun_bilgileri.length > 0)) && (
                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                    {/* Personel Detayları */}
                    {analysisSummary?.personel_detaylari &&
                      analysisSummary.personel_detaylari.length > 0 && (
                        <PersonelCard personel={analysisSummary.personel_detaylari} />
                      )}

                    {/* Öğün Bilgileri */}
                    {analysisSummary?.ogun_bilgileri &&
                      analysisSummary.ogun_bilgileri.length > 0 && (
                        <OgunBilgileriCard ogunler={analysisSummary.ogun_bilgileri} />
                      )}
                  </SimpleGrid>
                )}

                {/* İş Yerleri */}
                {analysisSummary?.is_yerleri && analysisSummary.is_yerleri.length > 0 && (
                  <IsYerleriCard yerler={analysisSummary.is_yerleri} />
                )}

                {/* Ceza Koşulları ve Fiyat Farkı */}
                {((analysisSummary?.ceza_kosullari && analysisSummary.ceza_kosullari.length > 0) ||
                  (analysisSummary?.fiyat_farki &&
                    (analysisSummary.fiyat_farki.formul ||
                      analysisSummary.fiyat_farki.katsayilar))) && (
                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                    {/* Ceza Koşulları */}
                    {analysisSummary?.ceza_kosullari &&
                      analysisSummary.ceza_kosullari.length > 0 && (
                        <CezaKosullariCard cezalar={analysisSummary.ceza_kosullari} />
                      )}

                    {/* Fiyat Farkı */}
                    {analysisSummary?.fiyat_farki &&
                      (analysisSummary.fiyat_farki.formul ||
                        analysisSummary.fiyat_farki.katsayilar) && (
                        <FiyatFarkiCard fiyatFarki={analysisSummary.fiyat_farki} />
                      )}
                  </SimpleGrid>
                )}

                {/* Gerekli Belgeler */}
                {analysisSummary?.gerekli_belgeler &&
                  analysisSummary.gerekli_belgeler.length > 0 && (
                    <GerekliBelgelerCard belgeler={analysisSummary.gerekli_belgeler} />
                  )}

                {/* Benzer İş Tanımı */}
                {analysisSummary?.benzer_is_tanimi && (
                  <BenzerIsTanimiCard tanim={analysisSummary.benzer_is_tanimi} />
                )}

                {/* Şartname/Gramaj Detayları Butonu */}
                {analysisSummary && (
                  <Button
                    variant="light"
                    color="orange"
                    leftSection={<IconScale size={16} />}
                    onClick={() => setSartnameGramajModalOpen(true)}
                    fullWidth
                  >
                    Şartname/Gramaj Detayları
                  </Button>
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
                {!analysisSummary?.teknik_sartlar?.length &&
                  !analysisSummary?.birim_fiyatlar?.length &&
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

            <Tabs.Panel value="notlar" pt="md">
              {/* Notlar sekmesi */}
              {isSaved ? (
                <ContextualNotesSection
                  contextType="tender"
                  contextId={selectedTender.tender_id}
                  title=""
                  compact={false}
                  showAddButton
                />
              ) : (
                <Text size="sm" c="dimmed">
                  Takip edilen ihaleler için kullanılabilir.
                </Text>
              )}
            </Tabs.Panel>
          </Tabs>
        </Box>
      </ScrollArea>

      {/* Döküman Ayarları Modal */}
      <Modal
        opened={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        title={
          <Group gap="xs">
            <ThemeIcon variant="light" color="grape" size="sm">
              <IconDatabase size={14} />
            </ThemeIcon>
            <Text fw={600}>Döküman ve Analiz Ayarları</Text>
          </Group>
        }
        size="md"
      >
        <Stack gap="md">
          {/* İstatistikler */}
          <Paper p="md" withBorder radius="md" bg="dark.7">
            <Text size="sm" fw={600} mb="sm">
              Veritabanı Durumu
            </Text>
            {settingsLoading && !docStats ? (
              <Center py="md">
                <Loader size="sm" />
              </Center>
            ) : docStats ? (
              <Stack gap="xs">
                <SimpleGrid cols={4}>
                  <Box ta="center">
                    <Text size="xl" fw={700}>
                      {docStats.total}
                    </Text>
                    <Text size="xs" c="dimmed">
                      Toplam
                    </Text>
                  </Box>
                  <Box ta="center">
                    <Text size="xl" fw={700} c="green">
                      {docStats.completed}
                    </Text>
                    <Text size="xs" c="dimmed">
                      Analiz Edildi
                    </Text>
                  </Box>
                  <Box ta="center">
                    <Text size="xl" fw={700} c="yellow">
                      {docStats.pending}
                    </Text>
                    <Text size="xs" c="dimmed">
                      Bekliyor
                    </Text>
                  </Box>
                  <Box ta="center">
                    <Text size="xl" fw={700} c="red">
                      {docStats.failed}
                    </Text>
                    <Text size="xs" c="dimmed">
                      Başarısız
                    </Text>
                  </Box>
                </SimpleGrid>
                {docStats.total > 0 && (
                  <Progress.Root size="lg" mt="xs">
                    <Tooltip label={`${docStats.completed} analiz edildi`}>
                      <Progress.Section
                        value={(docStats.completed / docStats.total) * 100}
                        color="green"
                      />
                    </Tooltip>
                    <Tooltip label={`${docStats.pending} bekliyor`}>
                      <Progress.Section
                        value={(docStats.pending / docStats.total) * 100}
                        color="yellow"
                      />
                    </Tooltip>
                    <Tooltip label={`${docStats.failed} başarısız`}>
                      <Progress.Section
                        value={(docStats.failed / docStats.total) * 100}
                        color="red"
                      />
                    </Tooltip>
                  </Progress.Root>
                )}

                {/* Döküman Listesi */}
                {docStats.documents &&
                  docStats.documents.length > 0 &&
                  (() => {
                    // Döküman türü çevirisi
                    const docTypeLabels: Record<string, string> = {
                      tech_spec: 'Teknik Şartname',
                      admin_spec: 'İdari Şartname',
                      contract: 'Sözleşme Tasarısı',
                      unit_price: 'Birim Fiyat Cetveli',
                      announcement: 'İhale İlanı',
                      addendum: 'Zeyilname',
                      result: 'Sonuç İlanı',
                      item_list: 'Mal/Hizmet Listesi',
                      other: 'Diğer Döküman',
                    };

                    const getDocTypeLabel = (docType: string, filename: string) => {
                      if (docTypeLabels[docType]) return docTypeLabels[docType];
                      // Dosya adından tahmin et
                      const lower = (docType || filename || '').toLowerCase();
                      if (lower.includes('teknik') || lower.includes('tech'))
                        return 'Teknik Şartname';
                      if (lower.includes('idari') || lower.includes('admin'))
                        return 'İdari Şartname';
                      if (lower.includes('sözleşme') || lower.includes('contract'))
                        return 'Sözleşme Tasarısı';
                      if (
                        lower.includes('birim') ||
                        lower.includes('fiyat') ||
                        lower.includes('price')
                      )
                        return 'Birim Fiyat Cetveli';
                      if (lower.includes('ilan')) return 'İhale İlanı';
                      if (lower.includes('zeyil')) return 'Zeyilname';
                      if (
                        lower.includes('mal') ||
                        lower.includes('hizmet') ||
                        lower.includes('liste')
                      )
                        return 'Mal/Hizmet Listesi';
                      return docType || filename?.split('.')[0] || 'Döküman';
                    };

                    return (
                      <Box mt="sm">
                        <Text size="xs" fw={600} c="dimmed" mb="xs">
                          Döküman Türleri
                        </Text>
                        <Stack gap={4}>
                          {docStats.documents.map((doc) => (
                            <Group
                              key={`doc-${doc.original_filename}-${doc.doc_type}`}
                              gap="xs"
                              justify="space-between"
                            >
                              <Group gap="xs">
                                <ThemeIcon
                                  size="xs"
                                  variant="light"
                                  color={
                                    doc.processing_status === 'completed'
                                      ? 'green'
                                      : doc.processing_status === 'pending'
                                        ? 'yellow'
                                        : 'red'
                                  }
                                >
                                  {doc.processing_status === 'completed' ? (
                                    <IconCheck size={10} />
                                  ) : doc.processing_status === 'pending' ? (
                                    <IconClock size={10} />
                                  ) : (
                                    <IconX size={10} />
                                  )}
                                </ThemeIcon>
                                <Tooltip label={doc.original_filename} position="top">
                                  <Group gap={4}>
                                    <Text size="xs" lineClamp={1} maw={160}>
                                      {getDocTypeLabel(doc.doc_type, doc.original_filename)}
                                    </Text>
                                    {doc.source_type === 'content' && (
                                      <Badge size="xs" variant="dot" color="blue">
                                        web
                                      </Badge>
                                    )}
                                  </Group>
                                </Tooltip>
                              </Group>
                              <Badge
                                size="xs"
                                variant="light"
                                color={
                                  doc.processing_status === 'completed'
                                    ? 'green'
                                    : doc.processing_status === 'pending'
                                      ? 'yellow'
                                      : 'red'
                                }
                              >
                                {doc.processing_status === 'completed'
                                  ? 'Analiz Edildi'
                                  : doc.processing_status === 'pending'
                                    ? 'Bekliyor'
                                    : 'Başarısız'}
                              </Badge>
                            </Group>
                          ))}
                        </Stack>
                      </Box>
                    );
                  })()}
              </Stack>
            ) : (
              <Text size="sm" c="dimmed" ta="center">
                Henüz döküman yok
              </Text>
            )}
          </Paper>

          <Divider label="İşlemler" labelPosition="center" />

          {/* Senkronizasyon */}
          <Button
            variant="light"
            color="green"
            leftSection={<IconRotate size={16} />}
            onClick={handleSyncAnalysis}
            loading={settingsLoading}
            disabled={!docStats || docStats.completed === 0}
            fullWidth
          >
            Analiz Özetini Güncelle
          </Button>
          <Text size="xs" c="dimmed" mt={-8}>
            Döküman analizlerini birleştirip ihale özetine kaydet
          </Text>

          {/* Sıfırla */}
          <Button
            variant="light"
            color="orange"
            leftSection={<IconRefresh size={16} />}
            onClick={handleResetDocuments}
            loading={settingsLoading}
            disabled={!docStats || docStats.total === 0}
            fullWidth
          >
            Dökümanları Sıfırla
          </Button>
          <Text size="xs" c="dimmed" mt={-8}>
            Tüm dökümanları tekrar analiz edilebilir hale getir
          </Text>

          {/* Analiz Temizle */}
          <Button
            variant="light"
            color="violet"
            leftSection={<IconBrain size={16} />}
            onClick={handleClearAnalysis}
            loading={settingsLoading}
            disabled={
              !docStats ||
              (docStats.completed === 0 &&
                (selectedTender as SavedTender).teknik_sart_sayisi === 0 &&
                (selectedTender as SavedTender).birim_fiyat_sayisi === 0)
            }
            fullWidth
          >
            Analizleri Temizle
          </Button>
          <Text size="xs" c="dimmed" mt={-8}>
            Dökümanlar kalır, sadece analiz sonuçları silinir
          </Text>

          <Divider label="Tehlikeli Alan" labelPosition="center" color="red" />

          {/* Tümünü Sil */}
          <Button
            variant="light"
            color="red"
            leftSection={<IconTrash size={16} />}
            onClick={handleDeleteAllDocuments}
            loading={settingsLoading}
            disabled={!docStats || docStats.total === 0}
            fullWidth
          >
            Tüm Dökümanları Sil
          </Button>
          <Text size="xs" c="red" mt={-8}>
            Bu işlem geri alınamaz! Tüm dökümanlar kalıcı olarak silinir.
          </Text>
        </Stack>
      </Modal>

      {/* Döküman Wizard Modal - Özet sekmesinden erişim için */}
      {isSaved && (
        <DocumentWizardModal
          opened={documentWizardOpen}
          onClose={() => setDocumentWizardOpen(false)}
          tenderId={selectedTender.tender_id}
          tenderTitle={selectedTender.ihale_basligi}
          onComplete={onRefreshData}
        />
      )}

      {/* Teknik Şartlar Modal */}
      <Modal
        opened={teknikModalOpen}
        onClose={() => setTeknikModalOpen(false)}
        title={
          <Group gap="xs">
            <ThemeIcon variant="light" color="blue" size="sm">
              <IconClipboardList size={14} />
            </ThemeIcon>
            <Text fw={600}>Teknik Şartlar ({analysisSummary?.teknik_sartlar?.length || 0})</Text>
          </Group>
        }
        size="lg"
      >
        <ScrollArea h={500}>
          <Stack gap="xs">
            {analysisSummary?.teknik_sartlar?.map((sart, idx) => {
              const sartText = getTeknikSartTextFromItem(sart);
              const sartObj =
                typeof sart === 'object' && sart !== null ? (sart as { onem?: string }) : null;
              const onem = sartObj?.onem;
              const onemColor = onem === 'kritik' ? 'red' : onem === 'normal' ? 'blue' : 'gray';
              return (
                <Paper
                  key={`modal-ts-${sartText.substring(0, 30)}-${idx}`}
                  p="sm"
                  withBorder
                  radius="md"
                >
                  <Group gap="xs" wrap="nowrap" align="flex-start">
                    <Badge
                      size="sm"
                      variant="filled"
                      color={onemColor}
                      circle
                      style={{ flexShrink: 0, marginTop: 2 }}
                    >
                      {idx + 1}
                    </Badge>
                    <Box style={{ flex: 1 }}>
                      <Text size="sm">{sartText}</Text>
                      {onem && (
                        <Badge size="xs" variant="light" color={onemColor} mt="xs">
                          {onem === 'kritik' ? 'Kritik' : 'Normal'}
                        </Badge>
                      )}
                    </Box>
                    <CopyButton value={sartText}>
                      {({ copied, copy }) => (
                        <ActionIcon
                          variant="subtle"
                          size="sm"
                          onClick={copy}
                          color={copied ? 'teal' : 'gray'}
                        >
                          {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                        </ActionIcon>
                      )}
                    </CopyButton>
                  </Group>
                </Paper>
              );
            })}
          </Stack>
        </ScrollArea>
      </Modal>

      {/* Birim Fiyatlar Modal */}
      <Modal
        opened={birimModalOpen}
        onClose={() => setBirimModalOpen(false)}
        title={
          <Group gap="xs">
            <ThemeIcon variant="light" color="green" size="sm">
              <IconCurrencyLira size={14} />
            </ThemeIcon>
            <Text fw={600}>Birim Fiyatlar ({analysisSummary?.birim_fiyatlar?.length || 0})</Text>
          </Group>
        }
        size="lg"
      >
        <ScrollArea h={500}>
          <Stack gap="xs">
            {analysisSummary?.birim_fiyatlar?.map((item, idx) => {
              const itemText = item.kalem || item.aciklama || item.text || 'Bilinmeyen';
              return (
                <Paper
                  key={`modal-bf-${itemText.substring(0, 20)}-${idx}`}
                  p="sm"
                  withBorder
                  radius="md"
                >
                  <Group justify="space-between" wrap="nowrap">
                    <Group gap="xs" style={{ flex: 1, minWidth: 0 }}>
                      <Badge
                        size="sm"
                        variant="filled"
                        color="green"
                        circle
                        style={{ flexShrink: 0 }}
                      >
                        {idx + 1}
                      </Badge>
                      <Box style={{ flex: 1 }}>
                        <Text size="sm">{itemText}</Text>
                        <Group gap="xs" mt="xs">
                          {item.birim && (
                            <Badge size="xs" variant="outline" color="gray">
                              {item.birim}
                            </Badge>
                          )}
                          {item.miktar && (
                            <Badge size="xs" variant="light" color="blue">
                              Miktar: {item.miktar}
                            </Badge>
                          )}
                        </Group>
                      </Box>
                    </Group>
                    <CopyButton value={itemText}>
                      {({ copied, copy }) => (
                        <ActionIcon
                          variant="subtle"
                          size="sm"
                          onClick={copy}
                          color={copied ? 'teal' : 'gray'}
                        >
                          {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                        </ActionIcon>
                      )}
                    </CopyButton>
                  </Group>
                </Paper>
              );
            })}
          </Stack>
        </ScrollArea>
      </Modal>

      {/* Tam Metin Modal */}
      <Modal
        opened={tamMetinModalOpen}
        onClose={() => setTamMetinModalOpen(false)}
        title={
          <Group gap="xs">
            <ThemeIcon variant="light" color="violet" size="sm">
              <IconFileText size={14} />
            </ThemeIcon>
            <Text fw={600}>Dökümanlardan Çıkarılan Tam Metin</Text>
          </Group>
        }
        size="xl"
        fullScreen
      >
        <Stack gap="md" h="100%">
          <Group justify="flex-end">
            <CopyButton value={analysisSummary?.tam_metin || ''}>
              {({ copied, copy }) => (
                <Button
                  variant="light"
                  leftSection={copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                  color={copied ? 'teal' : 'gray'}
                  onClick={copy}
                >
                  {copied ? 'Kopyalandı!' : 'Tümünü Kopyala'}
                </Button>
              )}
            </CopyButton>
          </Group>
          <ScrollArea style={{ flex: 1 }}>
            <Paper p="md" withBorder radius="md" bg="dark.8">
              <Text
                size="sm"
                style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', lineHeight: 1.6 }}
              >
                {analysisSummary?.tam_metin || 'Tam metin bulunamadı.'}
              </Text>
            </Paper>
          </ScrollArea>
        </Stack>
      </Modal>

      {/* Şartname/Gramaj Detayları Modal */}
      <Modal
        opened={sartnameGramajModalOpen}
        onClose={() => setSartnameGramajModalOpen(false)}
        title={
          <Group gap="xs">
            <ThemeIcon variant="light" color="orange" size="sm">
              <IconScale size={14} />
            </ThemeIcon>
            <Text fw={600}>Şartname/Gramaj Detayları</Text>
          </Group>
        }
        size="xl"
      >
        <ScrollArea h={500}>
          <Stack gap="md">
            {/* Öğün Bilgileri */}
            {analysisSummary?.ogun_bilgileri && analysisSummary.ogun_bilgileri.length > 0 && (
              <Paper p="md" withBorder radius="md">
                <Group gap="xs" mb="md">
                  <ThemeIcon size="sm" variant="light" color="orange">
                    <IconToolsKitchen2 size={14} />
                  </ThemeIcon>
                  <Text size="sm" fw={600}>
                    Öğün Bilgileri
                  </Text>
                  <Badge size="xs" variant="light" color="orange">
                    {analysisSummary.ogun_bilgileri.length} öğün
                  </Badge>
                </Group>
                <Table striped highlightOnHover withTableBorder withColumnBorders>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Öğün Türü</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>Miktar</Table.Th>
                      <Table.Th>Birim</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {analysisSummary.ogun_bilgileri.map((ogun) => (
                      <Table.Tr key={`modal-ogun-${ogun.tur}-${ogun.miktar}`}>
                        <Table.Td>
                          <Text fw={500}>{ogun.tur}</Text>
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          <Text fw={600} c="orange">
                            {ogun.miktar?.toLocaleString('tr-TR') || '-'}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text c="dimmed">{ogun.birim || 'adet'}</Text>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
                {(analysisSummary.gunluk_ogun_sayisi || analysisSummary.kisi_sayisi) && (
                  <Group gap="md" mt="md">
                    {analysisSummary.gunluk_ogun_sayisi && (
                      <Badge variant="outline" color="orange" size="md">
                        Günlük: {analysisSummary.gunluk_ogun_sayisi} öğün
                      </Badge>
                    )}
                    {analysisSummary.kisi_sayisi && (
                      <Badge variant="outline" color="blue" size="md">
                        Kişi: {analysisSummary.kisi_sayisi}
                      </Badge>
                    )}
                  </Group>
                )}
              </Paper>
            )}

            {/* Servis Saatleri */}
            {analysisSummary?.servis_saatleri &&
              Object.keys(analysisSummary.servis_saatleri).length > 0 && (
                <Paper p="md" withBorder radius="md">
                  <Group gap="xs" mb="md">
                    <ThemeIcon size="sm" variant="light" color="teal">
                      <IconClock size={14} />
                    </ThemeIcon>
                    <Text size="sm" fw={600}>
                      Servis Saatleri
                    </Text>
                  </Group>
                  <Table striped highlightOnHover withTableBorder>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Öğün</Table.Th>
                        <Table.Th>Saat Aralığı</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {Object.entries(analysisSummary.servis_saatleri)
                        .filter(([, val]) => val && val !== 'Belirtilmemiş')
                        .map(([key, val]) => (
                          <Table.Tr key={`modal-servis-${key}`}>
                            <Table.Td>
                              <Text fw={500} tt="capitalize">
                                {key.replace(/_/g, ' ')}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Badge variant="light" color="teal" size="lg">
                                {val}
                              </Badge>
                            </Table.Td>
                          </Table.Tr>
                        ))}
                    </Table.Tbody>
                  </Table>
                </Paper>
              )}

            {/* Personel Gereksinimleri */}
            {analysisSummary?.personel_detaylari &&
              analysisSummary.personel_detaylari.length > 0 && (
                <Paper p="md" withBorder radius="md">
                  <Group gap="xs" mb="md">
                    <ThemeIcon size="sm" variant="light" color="indigo">
                      <IconUsers size={14} />
                    </ThemeIcon>
                    <Text size="sm" fw={600}>
                      Personel Gereksinimleri
                    </Text>
                    <Badge size="xs" variant="light" color="indigo">
                      {analysisSummary.personel_detaylari.reduce(
                        (sum, p) => sum + (p.adet || 0),
                        0
                      )}{' '}
                      kişi
                    </Badge>
                  </Group>
                  <Table striped highlightOnHover withTableBorder withColumnBorders>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Pozisyon</Table.Th>
                        <Table.Th style={{ textAlign: 'right' }}>Adet</Table.Th>
                        <Table.Th>Ücret Oranı</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {analysisSummary.personel_detaylari.map((p) => (
                        <Table.Tr key={`modal-personel-${p.pozisyon}-${p.adet}`}>
                          <Table.Td>
                            <Text fw={500}>{p.pozisyon}</Text>
                          </Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}>
                            <Text fw={600} c="indigo">
                              {p.adet}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Text c="dimmed" size="sm">
                              {p.ucret_orani || '-'}
                            </Text>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Paper>
              )}

            {/* Teknik Şartlar */}
            {analysisSummary?.teknik_sartlar && analysisSummary.teknik_sartlar.length > 0 && (
              <Paper p="md" withBorder radius="md">
                <Group gap="xs" mb="md">
                  <ThemeIcon size="sm" variant="light" color="grape">
                    <IconClipboardList size={14} />
                  </ThemeIcon>
                  <Text size="sm" fw={600}>
                    Teknik Şartlar & Standartlar
                  </Text>
                </Group>
                <Stack gap="xs">
                  {analysisSummary.teknik_sartlar.slice(0, 15).map((sart) => {
                    const sartText =
                      typeof sart === 'string'
                        ? sart
                        : (sart as { madde?: string; aciklama?: string }).madde ||
                          (sart as { madde?: string; aciklama?: string }).aciklama ||
                          '';
                    return (
                      <Paper
                        key={`modal-sart-${sartText.substring(0, 50)}`}
                        p="xs"
                        withBorder
                        radius="sm"
                      >
                        <Text size="sm">{sartText}</Text>
                      </Paper>
                    );
                  })}
                  {analysisSummary.teknik_sartlar.length > 15 && (
                    <Text size="xs" c="dimmed" ta="center">
                      +{analysisSummary.teknik_sartlar.length - 15} daha fazla teknik şart
                    </Text>
                  )}
                </Stack>
              </Paper>
            )}

            {/* Veri Yoksa */}
            {!analysisSummary?.ogun_bilgileri?.length &&
              !analysisSummary?.servis_saatleri &&
              !analysisSummary?.personel_detaylari?.length &&
              !analysisSummary?.teknik_sartlar?.length && (
                <Paper p="xl" withBorder radius="md" ta="center">
                  <ThemeIcon size="xl" variant="light" color="gray" mx="auto" mb="md">
                    <IconScale size={24} />
                  </ThemeIcon>
                  <Text size="sm" c="dimmed">
                    Bu ihale için şartname/gramaj bilgisi bulunamadı.
                  </Text>
                  <Text size="xs" c="dimmed" mt="xs">
                    Dökümanlar analiz edildikten sonra detaylı bilgiler burada görünecektir.
                  </Text>
                </Paper>
              )}
          </Stack>
        </ScrollArea>
      </Modal>
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

// ========== ÖZET KARTLARİ (Expandable) ==========

// Teknik şart metnini çıkar
function getTeknikSartTextFromItem(sart: unknown): string {
  if (!sart) return '';
  if (typeof sart === 'string') return sart;
  if (typeof sart === 'object') {
    const obj = sart as Record<string, unknown>;
    return String(obj.madde || obj.text || obj.description || JSON.stringify(sart));
  }
  return String(sart);
}

// Teknik Şartlar Kartı
function TeknikSartlarCard({
  teknikSartlar,
}: {
  teknikSartlar: unknown[];
  onViewAll?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const displayItems = expanded ? teknikSartlar : teknikSartlar.slice(0, 5);
  const hasMore = teknikSartlar.length > 5;

  return (
    <Paper p="sm" withBorder radius="md" className="glassy-card-nested">
      <Group justify="space-between" mb="xs">
        <Group gap="xs">
          <ThemeIcon size="sm" variant="light" color="blue">
            <IconClipboardList size={12} />
          </ThemeIcon>
          <Text size="sm" fw={600}>
            Teknik Şartlar
          </Text>
          <Badge size="xs" variant="light" color="blue">
            {teknikSartlar.length}
          </Badge>
        </Group>
        {hasMore && (
          <Button
            size="xs"
            variant="subtle"
            onClick={() => setExpanded(!expanded)}
            rightSection={
              expanded ? (
                <IconChevronDown size={12} style={{ transform: 'rotate(180deg)' }} />
              ) : (
                <IconChevronDown size={12} />
              )
            }
          >
            {expanded ? 'Daralt' : `Tümü (${teknikSartlar.length})`}
          </Button>
        )}
      </Group>
      <ScrollArea.Autosize mah={expanded ? 400 : undefined}>
        <Stack gap={4}>
          {displayItems.map((sart, idx) => {
            const sartText = getTeknikSartTextFromItem(sart);
            const onem =
              typeof sart === 'object' && sart !== null
                ? (sart as Record<string, unknown>).onem
                : null;
            const onemColor = onem === 'kritik' ? 'red' : onem === 'normal' ? 'blue' : 'gray';
            return (
              <Group
                key={`ts-${idx}-${sartText.substring(0, 20)}`}
                gap="xs"
                wrap="nowrap"
                align="flex-start"
              >
                <Badge
                  size="xs"
                  variant="filled"
                  color={onemColor}
                  circle
                  style={{ flexShrink: 0, marginTop: 2 }}
                >
                  {idx + 1}
                </Badge>
                <Text size="xs" style={{ flex: 1 }} lineClamp={expanded ? undefined : 2}>
                  {sartText}
                </Text>
              </Group>
            );
          })}
        </Stack>
      </ScrollArea.Autosize>
    </Paper>
  );
}

// Birim Fiyatlar Kartı
function BirimFiyatlarCard({
  birimFiyatlar,
}: {
  birimFiyatlar: Array<{
    kalem?: string;
    aciklama?: string;
    text?: string;
    birim?: string;
    miktar?: string | number;
  }>;
  onViewAll?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const displayItems = expanded ? birimFiyatlar : birimFiyatlar.slice(0, 5);
  const hasMore = birimFiyatlar.length > 5;

  return (
    <Paper p="sm" withBorder radius="md" className="glassy-card-nested">
      <Group justify="space-between" mb="xs">
        <Group gap="xs">
          <ThemeIcon size="sm" variant="light" color="green">
            <IconCurrencyLira size={12} />
          </ThemeIcon>
          <Text size="sm" fw={600}>
            Birim Fiyatlar
          </Text>
          <Badge size="xs" variant="light" color="green">
            {birimFiyatlar.length}
          </Badge>
        </Group>
        {hasMore && (
          <Button
            size="xs"
            variant="subtle"
            color="green"
            onClick={() => setExpanded(!expanded)}
            rightSection={
              expanded ? (
                <IconChevronDown size={12} style={{ transform: 'rotate(180deg)' }} />
              ) : (
                <IconChevronDown size={12} />
              )
            }
          >
            {expanded ? 'Daralt' : `Tümü (${birimFiyatlar.length})`}
          </Button>
        )}
      </Group>
      <ScrollArea.Autosize mah={expanded ? 400 : undefined}>
        <Stack gap={4}>
          {displayItems.map((item, idx) => {
            const itemText = item.kalem || item.aciklama || item.text || 'Bilinmeyen';
            return (
              <Group
                key={`bf-${idx}-${itemText.substring(0, 15)}`}
                justify="space-between"
                wrap="nowrap"
              >
                <Group gap="xs" style={{ flex: 1, minWidth: 0 }}>
                  <Badge size="xs" variant="filled" color="green" circle style={{ flexShrink: 0 }}>
                    {idx + 1}
                  </Badge>
                  <Text size="xs" lineClamp={1} style={{ flex: 1 }}>
                    {itemText}
                  </Text>
                </Group>
                {item.birim && (
                  <Badge size="xs" variant="outline" color="gray" style={{ flexShrink: 0 }}>
                    {item.birim}
                  </Badge>
                )}
              </Group>
            );
          })}
        </Stack>
      </ScrollArea.Autosize>
    </Paper>
  );
}

// Önemli Notlar Kartı
function OnemliNotlarCard({
  notlar,
}: {
  notlar: Array<{ not: string; tur?: 'bilgi' | 'uyari' | 'gereklilik' } | string>;
  onViewAll?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const displayItems = expanded ? notlar : notlar.slice(0, 5);
  const hasMore = notlar.length > 5;

  return (
    <Paper p="sm" withBorder radius="md" className="glassy-card-nested">
      <Group justify="space-between" mb="xs">
        <Group gap="xs">
          <ThemeIcon size="sm" variant="light" color="orange">
            <IconAlertCircle size={12} />
          </ThemeIcon>
          <Text size="sm" fw={600}>
            Önemli Notlar
          </Text>
          <Badge size="xs" variant="light" color="orange">
            {notlar.length}
          </Badge>
        </Group>
        {hasMore && (
          <Button
            size="xs"
            variant="subtle"
            color="orange"
            onClick={() => setExpanded(!expanded)}
            rightSection={
              expanded ? (
                <IconChevronDown size={12} style={{ transform: 'rotate(180deg)' }} />
              ) : (
                <IconChevronDown size={12} />
              )
            }
          >
            {expanded ? 'Daralt' : `Tümü (${notlar.length})`}
          </Button>
        )}
      </Group>
      <ScrollArea.Autosize mah={expanded ? 400 : undefined}>
        <Stack gap={4}>
          {displayItems.map((not, idx) => {
            const notItem = typeof not === 'string' ? { not, tur: 'bilgi' as const } : not;
            const turColor =
              notItem.tur === 'uyari' ? 'red' : notItem.tur === 'gereklilik' ? 'blue' : 'gray';
            const TurIcon =
              notItem.tur === 'uyari'
                ? IconAlertTriangle
                : notItem.tur === 'gereklilik'
                  ? IconExclamationMark
                  : IconInfoCircle;
            return (
              <Group
                key={`not-${idx}-${notItem.not.substring(0, 20)}`}
                gap="xs"
                wrap="nowrap"
                align="flex-start"
              >
                <ThemeIcon
                  size="xs"
                  variant="light"
                  color={turColor}
                  radius="xl"
                  mt={2}
                  style={{ flexShrink: 0 }}
                >
                  <TurIcon size={10} />
                </ThemeIcon>
                <Text size="xs" style={{ flex: 1 }}>
                  {notItem.not}
                </Text>
              </Group>
            );
          })}
        </Stack>
      </ScrollArea.Autosize>
    </Paper>
  );
}

// Eksik Bilgiler Kartı
function EksikBilgilerCard({ eksikBilgiler }: { eksikBilgiler: string[] }) {
  const [expanded, setExpanded] = useState(false);
  const displayItems = expanded ? eksikBilgiler : eksikBilgiler.slice(0, 8);
  const hasMore = eksikBilgiler.length > 8;

  return (
    <Paper
      p="sm"
      withBorder
      radius="md"
      className="glassy-card-nested"
      style={{
        borderColor: 'var(--mantine-color-yellow-6)',
        background: 'rgba(234, 179, 8, 0.05)',
      }}
    >
      <Group justify="space-between" mb="xs">
        <Group gap="xs">
          <ThemeIcon size="sm" variant="light" color="yellow">
            <IconAlertTriangle size={12} />
          </ThemeIcon>
          <Text size="sm" fw={600}>
            Eksik Bilgiler
          </Text>
          <Badge size="xs" variant="light" color="yellow">
            {eksikBilgiler.length}
          </Badge>
        </Group>
        {hasMore && (
          <Button
            size="xs"
            variant="subtle"
            color="yellow"
            onClick={() => setExpanded(!expanded)}
            rightSection={
              expanded ? (
                <IconChevronDown size={12} style={{ transform: 'rotate(180deg)' }} />
              ) : (
                <IconChevronDown size={12} />
              )
            }
          >
            {expanded ? 'Daralt' : `Tümü (${eksikBilgiler.length})`}
          </Button>
        )}
      </Group>
      <ScrollArea.Autosize mah={expanded ? 300 : undefined}>
        <Group gap={6}>
          {displayItems.map((eksik, idx) => (
            <Badge
              key={`eksik-${eksik.substring(0, 15)}-${idx}`}
              size="xs"
              variant="outline"
              color="yellow"
            >
              {eksik}
            </Badge>
          ))}
        </Group>
      </ScrollArea.Autosize>
    </Paper>
  );
}

// Takvim Kartı
function TakvimCard({
  takvim,
}: {
  takvim: Array<{ olay: string; tarih: string; gun?: string }>;
  onViewAll?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const displayItems = expanded ? takvim : takvim.slice(0, 6);
  const hasMore = takvim.length > 6;

  return (
    <Paper p="sm" withBorder radius="md" className="glassy-card-nested">
      <Group justify="space-between" mb="xs">
        <Group gap="xs">
          <ThemeIcon size="sm" variant="light" color="cyan">
            <IconCalendar size={12} />
          </ThemeIcon>
          <Text size="sm" fw={600}>
            Takvim
          </Text>
          <Badge size="xs" variant="light" color="cyan">
            {takvim.length}
          </Badge>
        </Group>
        {hasMore && (
          <Button
            size="xs"
            variant="subtle"
            color="cyan"
            onClick={() => setExpanded(!expanded)}
            rightSection={
              expanded ? (
                <IconChevronDown size={12} style={{ transform: 'rotate(180deg)' }} />
              ) : (
                <IconChevronDown size={12} />
              )
            }
          >
            {expanded ? 'Daralt' : `Tümü (${takvim.length})`}
          </Button>
        )}
      </Group>
      <ScrollArea.Autosize mah={expanded ? 400 : undefined}>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
          {displayItems.map((item, idx) => (
            <Group key={`takvim-${item.olay}-${idx}`} gap="xs" wrap="nowrap">
              <ThemeIcon size="xs" variant="light" color="cyan" radius="xl">
                <IconClock size={10} />
              </ThemeIcon>
              <Box style={{ flex: 1, minWidth: 0 }}>
                <Text size="xs" fw={500} lineClamp={expanded ? undefined : 1}>
                  {item.olay}
                </Text>
                <Text size="xs" c="dimmed">
                  {item.tarih}
                </Text>
              </Box>
            </Group>
          ))}
        </SimpleGrid>
      </ScrollArea.Autosize>
    </Paper>
  );
}

// ═══════════════════════════════════════════════════════════════
// YENİ KARTLAR - Detaylı Analiz Bilgileri
// ═══════════════════════════════════════════════════════════════

// İletişim Bilgileri Kartı
function IletisimCard({ iletisim }: { iletisim: IletisimBilgileri }) {
  const entries = Object.entries(iletisim).filter(([, v]) => v?.trim());
  if (entries.length === 0) return null;

  const labels: Record<string, string> = {
    telefon: 'Telefon',
    email: 'E-posta',
    adres: 'Adres',
    yetkili: 'Yetkili',
  };

  return (
    <Paper p="sm" withBorder radius="md" className="glassy-card-nested">
      <Group gap="xs" mb="xs">
        <ThemeIcon size="sm" variant="light" color="blue">
          <IconPhone size={12} />
        </ThemeIcon>
        <Text size="sm" fw={600}>
          İletişim Bilgileri
        </Text>
      </Group>
      <Stack gap={4}>
        {entries.map(([key, value]) => (
          <Group key={key} gap="xs" wrap="nowrap">
            <Text size="xs" c="dimmed" w={70}>
              {labels[key] || key}:
            </Text>
            <Text size="xs" style={{ flex: 1 }}>
              {value}
            </Text>
          </Group>
        ))}
      </Stack>
    </Paper>
  );
}

// Personel Detayları Kartı
function PersonelCard({ personel }: { personel: PersonelDetay[] }) {
  const [expanded, setExpanded] = useState(false);
  if (!personel || personel.length === 0) return null;

  const displayItems = expanded ? personel : personel.slice(0, 5);
  const hasMore = personel.length > 5;
  const toplamPersonel = personel.reduce((sum, p) => sum + (p.adet || 0), 0);

  return (
    <Paper p="sm" withBorder radius="md" className="glassy-card-nested">
      <Group justify="space-between" mb="xs">
        <Group gap="xs">
          <ThemeIcon size="sm" variant="light" color="indigo">
            <IconUsers size={12} />
          </ThemeIcon>
          <Text size="sm" fw={600}>
            Personel Detayları
          </Text>
          <Badge size="xs" variant="light" color="indigo">
            {toplamPersonel} kişi
          </Badge>
        </Group>
        {hasMore && (
          <Button
            size="xs"
            variant="subtle"
            color="indigo"
            onClick={() => setExpanded(!expanded)}
            rightSection={
              <IconChevronDown
                size={12}
                style={{ transform: expanded ? 'rotate(180deg)' : 'none' }}
              />
            }
          >
            {expanded ? 'Daralt' : `Tümü (${personel.length})`}
          </Button>
        )}
      </Group>
      <ScrollArea.Autosize mah={expanded ? 300 : undefined}>
        <Stack gap={4}>
          {displayItems.map((p) => (
            <Group key={`personel-${p.pozisyon}-${p.adet}`} justify="space-between" gap="xs">
              <Text size="xs">{p.pozisyon}</Text>
              <Group gap="xs">
                <Badge size="xs" variant="outline" color="indigo">
                  {p.adet} kişi
                </Badge>
                {p.ucret_orani && (
                  <Badge size="xs" variant="light" color="green">
                    {p.ucret_orani}
                  </Badge>
                )}
              </Group>
            </Group>
          ))}
        </Stack>
      </ScrollArea.Autosize>
    </Paper>
  );
}

// Öğün Bilgileri Kartı
function OgunBilgileriCard({ ogunler }: { ogunler: OgunBilgisi[] }) {
  const [expanded, setExpanded] = useState(false);
  if (!ogunler || ogunler.length === 0) return null;

  const displayItems = expanded ? ogunler : ogunler.slice(0, 6);
  const hasMore = ogunler.length > 6;
  const toplamOgun = ogunler.reduce((sum, o) => sum + (o.miktar || 0), 0);

  return (
    <Paper p="sm" withBorder radius="md" className="glassy-card-nested">
      <Group justify="space-between" mb="xs">
        <Group gap="xs">
          <ThemeIcon size="sm" variant="light" color="orange">
            <IconToolsKitchen2 size={12} />
          </ThemeIcon>
          <Text size="sm" fw={600}>
            Öğün Bilgileri
          </Text>
          <Badge size="xs" variant="light" color="orange">
            {toplamOgun.toLocaleString('tr-TR')} öğün
          </Badge>
        </Group>
        {hasMore && (
          <Button
            size="xs"
            variant="subtle"
            color="orange"
            onClick={() => setExpanded(!expanded)}
            rightSection={
              <IconChevronDown
                size={12}
                style={{ transform: expanded ? 'rotate(180deg)' : 'none' }}
              />
            }
          >
            {expanded ? 'Daralt' : `Tümü (${ogunler.length})`}
          </Button>
        )}
      </Group>
      <ScrollArea.Autosize mah={expanded ? 300 : undefined}>
        <SimpleGrid cols={2} spacing="xs">
          {displayItems.map((o) => (
            <Group key={`ogun-${o.tur}-${o.miktar}`} gap="xs" wrap="nowrap">
              <Box style={{ flex: 1 }}>
                <Text size="xs" fw={500}>
                  {o.tur}
                </Text>
                <Text size="xs" c="dimmed">
                  {o.miktar?.toLocaleString('tr-TR')} {o.birim || 'öğün'}
                </Text>
              </Box>
            </Group>
          ))}
        </SimpleGrid>
      </ScrollArea.Autosize>
    </Paper>
  );
}

// İş Yerleri Kartı
function IsYerleriCard({ yerler }: { yerler: string[] }) {
  const [expanded, setExpanded] = useState(false);
  if (!yerler || yerler.length === 0) return null;

  const displayItems = expanded ? yerler : yerler.slice(0, 4);
  const hasMore = yerler.length > 4;

  return (
    <Paper p="sm" withBorder radius="md" className="glassy-card-nested">
      <Group justify="space-between" mb="xs">
        <Group gap="xs">
          <ThemeIcon size="sm" variant="light" color="teal">
            <IconMapPin size={12} />
          </ThemeIcon>
          <Text size="sm" fw={600}>
            İş Yerleri
          </Text>
          <Badge size="xs" variant="light" color="teal">
            {yerler.length} yer
          </Badge>
        </Group>
        {hasMore && (
          <Button
            size="xs"
            variant="subtle"
            color="teal"
            onClick={() => setExpanded(!expanded)}
            rightSection={
              <IconChevronDown
                size={12}
                style={{ transform: expanded ? 'rotate(180deg)' : 'none' }}
              />
            }
          >
            {expanded ? 'Daralt' : `Tümü (${yerler.length})`}
          </Button>
        )}
      </Group>
      <ScrollArea.Autosize mah={expanded ? 250 : undefined}>
        <Stack gap={4}>
          {displayItems.map((yer, index) => (
            <Group key={`yer-${index}-${yer.substring(0, 20)}`} gap="xs" wrap="nowrap">
              <ThemeIcon size="xs" variant="light" color="teal" radius="xl">
                <IconBuilding size={10} />
              </ThemeIcon>
              <Text size="xs">{yer}</Text>
            </Group>
          ))}
        </Stack>
      </ScrollArea.Autosize>
    </Paper>
  );
}

// Mali Kriterler Kartı
function MaliKriterlerCard({ kriterler }: { kriterler: MaliKriterler }) {
  const entries = Object.entries(kriterler).filter(([, v]) => v?.trim());
  if (entries.length === 0) return null;

  const labels: Record<string, string> = {
    cari_oran: 'Cari Oran',
    ozkaynak_orani: 'Öz Kaynak Oranı',
    is_deneyimi: 'İş Deneyimi',
    ciro_orani: 'Ciro Oranı',
  };

  return (
    <Paper p="sm" withBorder radius="md" className="glassy-card-nested">
      <Group gap="xs" mb="xs">
        <ThemeIcon size="sm" variant="light" color="grape">
          <IconWallet size={12} />
        </ThemeIcon>
        <Text size="sm" fw={600}>
          Mali Yeterlilik Kriterleri
        </Text>
      </Group>
      <SimpleGrid cols={2} spacing="xs">
        {entries.map(([key, value]) => (
          <Box key={key}>
            <Text size="xs" c="dimmed">
              {labels[key] || key}
            </Text>
            <Text size="sm" fw={600}>
              {value}
            </Text>
          </Box>
        ))}
      </SimpleGrid>
    </Paper>
  );
}

// Ceza Koşulları Kartı
function CezaKosullariCard({ cezalar }: { cezalar: CezaKosulu[] }) {
  const [expanded, setExpanded] = useState(false);
  if (!cezalar || cezalar.length === 0) return null;

  const displayItems = expanded ? cezalar : cezalar.slice(0, 4);
  const hasMore = cezalar.length > 4;

  return (
    <Paper
      p="sm"
      withBorder
      radius="md"
      className="glassy-card-nested"
      style={{ borderColor: 'var(--mantine-color-red-6)', background: 'rgba(239, 68, 68, 0.05)' }}
    >
      <Group justify="space-between" mb="xs">
        <Group gap="xs">
          <ThemeIcon size="sm" variant="light" color="red">
            <IconGavel size={12} />
          </ThemeIcon>
          <Text size="sm" fw={600}>
            Ceza Koşulları
          </Text>
          <Badge size="xs" variant="light" color="red">
            {cezalar.length}
          </Badge>
        </Group>
        {hasMore && (
          <Button
            size="xs"
            variant="subtle"
            color="red"
            onClick={() => setExpanded(!expanded)}
            rightSection={
              <IconChevronDown
                size={12}
                style={{ transform: expanded ? 'rotate(180deg)' : 'none' }}
              />
            }
          >
            {expanded ? 'Daralt' : `Tümü (${cezalar.length})`}
          </Button>
        )}
      </Group>
      <ScrollArea.Autosize mah={expanded ? 250 : undefined}>
        <Stack gap={4}>
          {displayItems.map((c) => (
            <Group key={`ceza-${c.tur}-${c.oran}`} justify="space-between" gap="xs" wrap="nowrap">
              <Text size="xs" style={{ flex: 1 }}>
                {c.tur}
              </Text>
              <Badge size="xs" variant="outline" color="red">
                {c.oran}
              </Badge>
            </Group>
          ))}
        </Stack>
      </ScrollArea.Autosize>
    </Paper>
  );
}

// Fiyat Farkı Kartı
function FiyatFarkiCard({ fiyatFarki }: { fiyatFarki: FiyatFarki }) {
  if (!fiyatFarki || (!fiyatFarki.formul && !fiyatFarki.katsayilar)) return null;

  const katsayilar = fiyatFarki.katsayilar ? Object.entries(fiyatFarki.katsayilar) : [];

  return (
    <Paper p="sm" withBorder radius="md" className="glassy-card-nested">
      <Group gap="xs" mb="xs">
        <ThemeIcon size="sm" variant="light" color="pink">
          <IconMathFunction size={12} />
        </ThemeIcon>
        <Text size="sm" fw={600}>
          Fiyat Farkı
        </Text>
      </Group>
      {fiyatFarki.formul && (
        <Text size="xs" c="dimmed" mb="xs" style={{ fontFamily: 'monospace' }}>
          {fiyatFarki.formul}
        </Text>
      )}
      {katsayilar.length > 0 && (
        <Group gap="xs">
          {katsayilar.map(([key, value]) => (
            <Badge key={key} size="xs" variant="outline" color="pink">
              {key}={value}
            </Badge>
          ))}
        </Group>
      )}
    </Paper>
  );
}

// Gerekli Belgeler Kartı
function GerekliBelgelerCard({ belgeler }: { belgeler: GerekliBelge[] }) {
  const [expanded, setExpanded] = useState(false);
  if (!belgeler || belgeler.length === 0) return null;

  const displayItems = expanded ? belgeler : belgeler.slice(0, 5);
  const hasMore = belgeler.length > 5;

  return (
    <Paper p="sm" withBorder radius="md" className="glassy-card-nested">
      <Group justify="space-between" mb="xs">
        <Group gap="xs">
          <ThemeIcon size="sm" variant="light" color="lime">
            <IconCertificate size={12} />
          </ThemeIcon>
          <Text size="sm" fw={600}>
            Gerekli Belgeler
          </Text>
          <Badge size="xs" variant="light" color="lime">
            {belgeler.length}
          </Badge>
        </Group>
        {hasMore && (
          <Button
            size="xs"
            variant="subtle"
            color="lime"
            onClick={() => setExpanded(!expanded)}
            rightSection={
              <IconChevronDown
                size={12}
                style={{ transform: expanded ? 'rotate(180deg)' : 'none' }}
              />
            }
          >
            {expanded ? 'Daralt' : `Tümü (${belgeler.length})`}
          </Button>
        )}
      </Group>
      <ScrollArea.Autosize mah={expanded ? 300 : undefined}>
        <Stack gap={4}>
          {displayItems.map((b) => {
            const belgeAdi = typeof b === 'string' ? b : b.belge;
            const zorunlu = typeof b === 'object' ? b.zorunlu : true;
            const puan = typeof b === 'object' ? (b.puan ?? 0) : 0;
            return (
              <Group key={`belge-${belgeAdi.substring(0, 30)}`} gap="xs" wrap="nowrap">
                <ThemeIcon
                  size="xs"
                  variant={zorunlu ? 'filled' : 'light'}
                  color={zorunlu ? 'lime' : 'gray'}
                  radius="xl"
                >
                  <IconCheck size={10} />
                </ThemeIcon>
                <Text size="xs" style={{ flex: 1 }}>
                  {belgeAdi}
                </Text>
                {puan > 0 && (
                  <Badge size="xs" variant="light" color="blue">
                    +{puan} puan
                  </Badge>
                )}
              </Group>
            );
          })}
        </Stack>
      </ScrollArea.Autosize>
    </Paper>
  );
}

// Teminat Oranları Kartı
function TeminatOranlariCard({ teminat }: { teminat: TeminatOranlari }) {
  const entries = Object.entries(teminat).filter(([, v]) => v?.trim());
  if (entries.length === 0) return null;

  const labels: Record<string, string> = {
    gecici: 'Geçici Teminat',
    kesin: 'Kesin Teminat',
    ek_kesin: 'Ek Kesin Teminat',
  };

  return (
    <Paper p="sm" withBorder radius="md" className="glassy-card-nested">
      <Group gap="xs" mb="xs">
        <ThemeIcon size="sm" variant="light" color="violet">
          <IconShield size={12} />
        </ThemeIcon>
        <Text size="sm" fw={600}>
          Teminat Oranları
        </Text>
      </Group>
      <Group gap="md">
        {entries.map(([key, value]) => (
          <Box key={key}>
            <Text size="xs" c="dimmed">
              {labels[key] || key}
            </Text>
            <Text size="lg" fw={700} c="violet">
              {value}
            </Text>
          </Box>
        ))}
      </Group>
    </Paper>
  );
}

// Servis Saatleri Kartı
function ServisSaatleriCard({ saatler }: { saatler: ServisSaatleri }) {
  const entries = Object.entries(saatler).filter(([, v]) => v?.trim());
  if (entries.length === 0) return null;

  const labels: Record<string, string> = {
    kahvalti: 'Kahvaltı',
    ogle: 'Öğle',
    aksam: 'Akşam',
  };

  return (
    <Paper p="sm" withBorder radius="md" className="glassy-card-nested">
      <Group gap="xs" mb="xs">
        <ThemeIcon size="sm" variant="light" color="cyan">
          <IconClock size={12} />
        </ThemeIcon>
        <Text size="sm" fw={600}>
          Servis Saatleri
        </Text>
      </Group>
      <Group gap="md">
        {entries.map(([key, value]) => (
          <Badge
            key={key}
            size="lg"
            variant="light"
            color="cyan"
            leftSection={<IconClock size={12} />}
          >
            {labels[key] || key}: {value}
          </Badge>
        ))}
      </Group>
    </Paper>
  );
}

// Benzer İş Tanımı Kartı
function BenzerIsTanimiCard({ tanim }: { tanim: string }) {
  if (!tanim || !tanim.trim()) return null;

  return (
    <Paper p="sm" withBorder radius="md" className="glassy-card-nested">
      <Group gap="xs" mb="xs">
        <ThemeIcon size="sm" variant="light" color="gray">
          <IconInfoCircle size={12} />
        </ThemeIcon>
        <Text size="sm" fw={600}>
          Benzer İş Tanımı
        </Text>
      </Group>
      <Text size="xs" c="dimmed" style={{ lineHeight: 1.6 }}>
        {tanim}
      </Text>
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

function DokumanlarSection({
  tenderId,
  tenderTitle,
  dokumansayisi = 0,
  analizEdilen = 0,
  onRefresh,
}: DokumanlarSectionProps) {
  const [wizardOpen, setWizardOpen] = useState(false);

  return (
    <>
      <Stack gap="md">
        {/* Kompakt Özet - Tıklanabilir */}
        <Paper
          p="md"
          withBorder
          radius="md"
          bg="dark.7"
          style={{ cursor: 'pointer' }}
          onClick={() => setWizardOpen(true)}
        >
          <Group justify="space-between" align="center">
            <Group gap="md">
              <ThemeIcon size="lg" variant="light" color="orange" radius="xl">
                <IconFile size={18} />
              </ThemeIcon>
              <Box>
                <Text size="sm" fw={600}>
                  {dokumansayisi > 0 ? `${dokumansayisi} Döküman` : 'Döküman Yok'}
                </Text>
                <Text size="xs" c="dimmed">
                  {dokumansayisi > 0
                    ? analizEdilen > 0
                      ? `${analizEdilen} analiz edildi`
                      : 'Analiz bekliyor'
                    : 'Henüz döküman indirilmedi'}
                </Text>
              </Box>
            </Group>

            <Group gap="xs">
              {dokumansayisi > 0 && (
                <Badge
                  size="lg"
                  variant="light"
                  color={analizEdilen === dokumansayisi ? 'green' : 'yellow'}
                >
                  %{Math.round((analizEdilen / dokumansayisi) * 100)}
                </Badge>
              )}
              <ActionIcon variant="subtle" color="gray" size="lg">
                <IconChevronRight size={18} />
              </ActionIcon>
            </Group>
          </Group>
        </Paper>
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

// Helper: Teknik şart text'ini al (null-safe)
function getTeknikSartText(sart: string | TeknikSart | null | undefined): string {
  if (!sart) return '';
  if (typeof sart === 'string') return sart;
  if (typeof sart === 'object' && 'text' in sart) return sart.text || '';
  if (typeof sart === 'object' && 'madde' in sart) return (sart as { madde?: string }).madde || '';
  return String(sart);
}

// Helper: Teknik şart kaynak dökümanını al (null-safe)
function getTeknikSartSource(sart: string | TeknikSart | null | undefined): string | undefined {
  if (!sart || typeof sart !== 'object') return undefined;
  return (sart as TeknikSart).source;
}

// Helper: Not text'ini al (null-safe)
function getNoteText(not: string | AINote | null | undefined): string {
  if (!not) return '';
  if (typeof not === 'string') return not;
  if (typeof not === 'object' && 'text' in not) return not.text || '';
  return String(not);
}

// Helper: Not kaynak dökümanını al (null-safe)
function getNoteSource(not: string | AINote | null | undefined): string | undefined {
  if (!not || typeof not !== 'object') return undefined;
  return (not as AINote).source;
}

export function AnalysisSection({ tender }: { tender: SavedTender }) {
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

  // Analiz yoksa mesaj - hem sayıları hem de analysis_summary içeriğini kontrol et
  const hasAnyAnalysis =
    (tender.teknik_sart_sayisi || 0) > 0 ||
    (tender.birim_fiyat_sayisi || 0) > 0 ||
    allTeknikSartlar.length > 0 ||
    (analysisData?.birim_fiyatlar?.length || 0) > 0 ||
    allNotlar.length > 0;

  if (!hasAnyAnalysis) {
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
          ...((analysisData?.takvim?.length || 0) > 0
            ? [
                {
                  value: 'takvim',
                  label: (
                    <Group gap={4}>
                      <IconCalendar size={14} />
                      <span>Takvim</span>
                      <Badge size="xs" variant="filled" color="cyan">
                        {analysisData?.takvim?.length || 0}
                      </Badge>
                    </Group>
                  ),
                },
              ]
            : []),
          ...((analysisData?.onemli_notlar?.length || 0) > 0
            ? [
                {
                  value: 'onemli',
                  label: (
                    <Group gap={4}>
                      <IconAlertCircle size={14} />
                      <span>Önemli Notlar</span>
                      <Badge size="xs" variant="filled" color="orange">
                        {analysisData?.onemli_notlar?.length || 0}
                      </Badge>
                    </Group>
                  ),
                },
              ]
            : []),
          ...(allNotlar.length > 0
            ? [
                {
                  value: 'notlar',
                  label: (
                    <Group gap={4}>
                      <IconBulb size={14} />
                      <span>AI Notları</span>
                      <Badge size="xs" variant="filled" color="violet">
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

      {/* Takvim Tab */}
      {activeAnalysisTab === 'takvim' && (
        <Stack gap="xs">
          <ScrollArea h={350}>
            {analysisData?.takvim && analysisData.takvim.length > 0 ? (
              <Stack gap="xs">
                {analysisData.takvim.map((item) => {
                  const takvimItem = item as TakvimItem;
                  return (
                    <Paper
                      key={`takvim-${takvimItem.olay}-${takvimItem.tarih}`}
                      p="sm"
                      withBorder
                      radius="sm"
                      style={{
                        background: 'rgba(6, 182, 212, 0.05)',
                        borderLeft: '3px solid var(--mantine-color-cyan-5)',
                      }}
                    >
                      <Group justify="space-between" wrap="nowrap">
                        <Group gap="sm" style={{ flex: 1, minWidth: 0 }}>
                          <ThemeIcon size="md" variant="light" color="cyan" radius="xl">
                            <IconCalendar size={14} />
                          </ThemeIcon>
                          <Box style={{ flex: 1, minWidth: 0 }}>
                            <Text size="sm" fw={500}>
                              {takvimItem.olay}
                            </Text>
                            <Group gap="xs" mt={4}>
                              <Badge size="sm" variant="filled" color="cyan">
                                {takvimItem.tarih}
                              </Badge>
                              {takvimItem.gun && (
                                <Badge size="sm" variant="outline" color="cyan">
                                  {takvimItem.gun} gün
                                </Badge>
                              )}
                            </Group>
                          </Box>
                        </Group>
                        <CopyButton value={`${takvimItem.olay}: ${takvimItem.tarih}`}>
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
                })}
              </Stack>
            ) : (
              <Paper p="md" withBorder radius="md" ta="center">
                <Text size="sm" c="dimmed">
                  Takvim bilgisi bulunamadı
                </Text>
              </Paper>
            )}
          </ScrollArea>
        </Stack>
      )}

      {/* Önemli Notlar Tab */}
      {activeAnalysisTab === 'onemli' && (
        <Stack gap="xs">
          <ScrollArea h={350}>
            {analysisData?.onemli_notlar && analysisData.onemli_notlar.length > 0 ? (
              <Stack gap="xs">
                {analysisData.onemli_notlar.map((not) => {
                  const notItem =
                    typeof not === 'string' ? { not, tur: 'bilgi' as const } : (not as OnemliNot);
                  const turColor =
                    notItem.tur === 'uyari'
                      ? 'red'
                      : notItem.tur === 'gereklilik'
                        ? 'blue'
                        : 'gray';
                  const turLabel =
                    notItem.tur === 'uyari'
                      ? 'Uyarı'
                      : notItem.tur === 'gereklilik'
                        ? 'Gereklilik'
                        : 'Bilgi';
                  const TurIcon =
                    notItem.tur === 'uyari'
                      ? IconAlertTriangle
                      : notItem.tur === 'gereklilik'
                        ? IconExclamationMark
                        : IconInfoCircle;

                  return (
                    <Paper
                      key={`onemli-${notItem.not.substring(0, 30)}-${notItem.tur}`}
                      p="sm"
                      withBorder
                      radius="sm"
                      style={{
                        background:
                          notItem.tur === 'uyari'
                            ? 'rgba(239, 68, 68, 0.05)'
                            : notItem.tur === 'gereklilik'
                              ? 'rgba(59, 130, 246, 0.05)'
                              : 'rgba(107, 114, 128, 0.05)',
                        borderLeft: `3px solid var(--mantine-color-${turColor}-5)`,
                      }}
                    >
                      <Group justify="space-between" wrap="nowrap" align="flex-start">
                        <Group gap="sm" style={{ flex: 1, minWidth: 0 }} align="flex-start">
                          <ThemeIcon size="md" variant="light" color={turColor} radius="xl">
                            <TurIcon size={14} />
                          </ThemeIcon>
                          <Box style={{ flex: 1, minWidth: 0 }}>
                            <Group gap="xs" mb={4}>
                              <Badge size="xs" variant="filled" color={turColor}>
                                {turLabel}
                              </Badge>
                            </Group>
                            <Text size="sm">{notItem.not}</Text>
                          </Box>
                        </Group>
                        <CopyButton value={notItem.not}>
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
                })}
              </Stack>
            ) : (
              <Paper p="md" withBorder radius="md" ta="center">
                <Text size="sm" c="dimmed">
                  Önemli not bulunamadı
                </Text>
              </Paper>
            )}
          </ScrollArea>
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

export function AraclarSection({
  tender,
  onRefresh,
}: {
  tender: SavedTender;
  onRefresh?: () => void;
}) {
  const [calcModalOpen, setCalcModalOpen] = useState(false);

  // Mevcut değerler (sadece gösterim için)
  const yaklasikMaliyet = tender.yaklasik_maliyet || 0;
  const bizimTeklif = tender.bizim_teklif || 0;
  const otomatikSinirDeger = yaklasikMaliyet > 0 ? Math.round(yaklasikMaliyet * 0.85) : 0;

  // Tespit edilen veriler
  const hesaplamaVerileri = (tender as any).hesaplama_verileri || {};
  const isSuresi =
    hesaplamaVerileri.is_suresi ||
    tender.analysis_summary?.teslim_suresi ||
    tender.analysis_summary?.sure;
  const toplamOgun =
    hesaplamaVerileri.toplam_ogun_sayisi ||
    tender.analysis_summary?.ogun_bilgileri?.reduce(
      (sum: number, o: any) => sum + (Number(o.miktar) || 0),
      0
    ) ||
    0;
  const teknikSartSayisi =
    hesaplamaVerileri.teknik_sart_sayisi || tender.analysis_summary?.teknik_sartlar?.length || 0;
  const birimFiyatSayisi =
    hesaplamaVerileri.birim_fiyat_sayisi || tender.analysis_summary?.birim_fiyatlar?.length || 0;

  // Hesaplamalar
  const ogunBasiMaliyet = yaklasikMaliyet && toplamOgun ? yaklasikMaliyet / toplamOgun : 0;

  // Risk hesaplama
  const isAsiriDusuk =
    bizimTeklif > 0 && otomatikSinirDeger > 0 && bizimTeklif < otomatikSinirDeger;
  const fark = bizimTeklif > 0 && otomatikSinirDeger > 0 ? bizimTeklif - otomatikSinirDeger : 0;

  return (
    <>
      {/* Hesaplama Modalı */}
      <CalculationModal
        opened={calcModalOpen}
        onClose={() => setCalcModalOpen(false)}
        tender={tender}
        onRefresh={onRefresh}
      />

      <Stack gap="md">
        {/* Ana Hesaplama Kartı - Hero */}
        <Paper
          p="lg"
          withBorder
          radius="md"
          bg={
            yaklasikMaliyet === 0
              ? 'dark.6'
              : isAsiriDusuk
                ? 'rgba(255, 107, 107, 0.08)'
                : 'rgba(81, 207, 102, 0.08)'
          }
          style={{
            borderColor:
              yaklasikMaliyet === 0
                ? undefined
                : isAsiriDusuk
                  ? 'var(--mantine-color-red-6)'
                  : 'var(--mantine-color-green-6)',
            cursor: 'pointer',
          }}
          onClick={() => setCalcModalOpen(true)}
        >
          <Group justify="space-between" align="flex-start">
            <div>
              <Group gap="xs" mb="xs">
                <ThemeIcon
                  size="lg"
                  variant="light"
                  color={yaklasikMaliyet === 0 ? 'blue' : isAsiriDusuk ? 'red' : 'green'}
                >
                  <IconCalculator size={20} />
                </ThemeIcon>
                <div>
                  <Text size="sm" fw={600}>
                    Teklif Hesaplama
                  </Text>
                  <Text size="xs" c="dimmed">
                    Sınır değer ve risk analizi
                  </Text>
                </div>
              </Group>

              {yaklasikMaliyet > 0 ? (
                <SimpleGrid cols={3} spacing="md" mt="md">
                  <Box>
                    <Text size="xs" c="dimmed">
                      Yaklaşık Maliyet
                    </Text>
                    <Text size="sm" fw={600}>
                      {yaklasikMaliyet.toLocaleString('tr-TR')} ₺
                    </Text>
                  </Box>
                  <Box>
                    <Text size="xs" c="dimmed">
                      Sınır Değer
                    </Text>
                    <Text size="sm" fw={600} c="blue">
                      {otomatikSinirDeger.toLocaleString('tr-TR')} ₺
                    </Text>
                  </Box>
                  <Box>
                    <Text size="xs" c="dimmed">
                      Bizim Teklif
                    </Text>
                    <Text size="sm" fw={600} c={isAsiriDusuk ? 'red' : 'green'}>
                      {bizimTeklif > 0 ? `${bizimTeklif.toLocaleString('tr-TR')} ₺` : '—'}
                    </Text>
                  </Box>
                </SimpleGrid>
              ) : (
                <Text size="sm" c="dimmed" mt="xs">
                  Teklif analizi için tıklayın
                </Text>
              )}
            </div>

            {yaklasikMaliyet > 0 && bizimTeklif > 0 && (
              <Badge
                size="lg"
                variant="light"
                color={isAsiriDusuk ? 'red' : 'green'}
                leftSection={
                  isAsiriDusuk ? <IconAlertTriangle size={14} /> : <IconCheck size={14} />
                }
              >
                {isAsiriDusuk ? 'RİSKLİ' : 'UYGUN'}
              </Badge>
            )}
          </Group>

          {yaklasikMaliyet > 0 && bizimTeklif > 0 && (
            <Group
              gap="xs"
              mt="md"
              pt="md"
              style={{ borderTop: '1px solid var(--mantine-color-dark-4)' }}
            >
              <Text size="xs" c="dimmed">
                Fark:
              </Text>
              <Text size="xs" fw={500} c={fark >= 0 ? 'green' : 'red'}>
                {fark >= 0 ? '+' : ''}
                {fark.toLocaleString('tr-TR')} ₺
              </Text>
              {ogunBasiMaliyet > 0 && (
                <>
                  <Text size="xs" c="dimmed" ml="md">
                    Öğün Başı:
                  </Text>
                  <Text size="xs" fw={500} c="blue">
                    {ogunBasiMaliyet.toFixed(2)} ₺
                  </Text>
                </>
              )}
            </Group>
          )}
        </Paper>

        {/* Açılır Hesaplama Butonu */}
        <Button
          fullWidth
          size="md"
          variant="gradient"
          gradient={{ from: 'blue', to: 'cyan' }}
          leftSection={<IconCalculator size={18} />}
          onClick={() => setCalcModalOpen(true)}
        >
          Detaylı Hesaplama Aç
        </Button>

        {/* Tespit Edilen Veriler - Kompakt */}
        {(isSuresi || toplamOgun > 0) && (
          <Paper p="sm" withBorder radius="md" bg="rgba(20, 184, 166, 0.03)">
            <Group gap="xs" mb="xs">
              <IconSparkles size={14} color="var(--mantine-color-teal-6)" />
              <Text size="xs" fw={600} c="teal">
                Döküman Analizi
              </Text>
            </Group>
            <SimpleGrid cols={4} spacing="xs">
              {isSuresi && (
                <Box>
                  <Text size="xs" c="dimmed">
                    Süre
                  </Text>
                  <Text size="sm" fw={500}>
                    {isSuresi}
                  </Text>
                </Box>
              )}
              {toplamOgun > 0 && (
                <Box>
                  <Text size="xs" c="dimmed">
                    Öğün
                  </Text>
                  <Text size="sm" fw={500}>
                    {(toplamOgun / 1000000).toFixed(1)}M
                  </Text>
                </Box>
              )}
              {teknikSartSayisi > 0 && (
                <Box>
                  <Text size="xs" c="dimmed">
                    Şart
                  </Text>
                  <Text size="sm" fw={500}>
                    {teknikSartSayisi}
                  </Text>
                </Box>
              )}
              {birimFiyatSayisi > 0 && (
                <Box>
                  <Text size="xs" c="dimmed">
                    Kalem
                  </Text>
                  <Text size="sm" fw={500}>
                    {birimFiyatSayisi}
                  </Text>
                </Box>
              )}
            </SimpleGrid>
          </Paper>
        )}
      </Stack>
    </>
  );
}

// Eski karmaşık UI kaldırıldı - Yeni CalculationModal kullanılıyor
const _unusedOldAraclarContent = null; // Placeholder
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

export function DilekceSection({ tender, dilekceType, onSelectType }: DilekceSectionProps) {
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>(
    []
  );
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [dilekceContent, setDilekceContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [showDataForm, setShowDataForm] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Eksik kritik verileri tespit et
  const missingFields = tender
    ? detectMissingCriticalData({
        yaklasik_maliyet: tender.yaklasik_maliyet,
        bizim_teklif: tender.bizim_teklif,
        sinir_deger: tender.sinir_deger,
      })
    : [];

  // Sadece zorunlu alanları kontrol et (sinir_deger opsiyonel)
  const hasCriticalMissing = missingFields.filter((f) => f !== 'sinir_deger').length > 0;

  // Auto-scroll on new messages
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  // AI ile dilekçe oluştur
  const handleSendMessage = async (messageOverride?: string) => {
    const messageToSend = messageOverride || input.trim();
    if (!messageToSend || !tender || !dilekceType) return;

    // Kritik veriler eksikse önce formu göster
    if (hasCriticalMissing && !messageOverride) {
      setPendingMessage(messageToSend);
      setShowDataForm(true);
      return;
    }

    const userMessage = messageToSend;
    if (!messageOverride) setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const typeInfo = dilekceTypes[dilekceType as keyof typeof dilekceTypes];

      // Zengin ihale context'i oluştur
      const analysisData = tender.analysis_summary;
      const teknikSartlar = analysisData?.teknik_sartlar?.slice(0, 10) || [];
      const birimFiyatlar = analysisData?.birim_fiyatlar?.slice(0, 10) || [];

      const systemPrompt = `Sen bir kamu ihale uzmanısın. ${typeInfo.label} dilekçesi hazırlamaya yardım ediyorsun.

## İHALE BİLGİLERİ
- Başlık: ${tender.ihale_basligi}
- Kurum: ${tender.kurum}
- Tarih: ${tender.tarih}
- Şehir: ${tender.city || '-'}
- İKN: ${tender.external_id || '-'}

## MALİ BİLGİLER
- Yaklaşık Maliyet: ${tender.yaklasik_maliyet ? `${tender.yaklasik_maliyet.toLocaleString('tr-TR')} ₺` : 'Belirtilmemiş'}
- Bizim Teklif: ${tender.bizim_teklif ? `${tender.bizim_teklif.toLocaleString('tr-TR')} ₺` : 'Belirtilmemiş'}
- Sınır Değer: ${tender.sinir_deger ? `${tender.sinir_deger.toLocaleString('tr-TR')} ₺` : 'Belirtilmemiş'}

## TEKNİK ŞARTLAR (${teknikSartlar.length} adet)
${teknikSartlar.map((s, i) => `${i + 1}. ${typeof s === 'string' ? s : s.text}`).join('\n') || 'Teknik şart bilgisi yok'}

## BİRİM FİYATLAR (${birimFiyatlar.length} adet)
${birimFiyatlar.map((b) => `- ${b.kalem}: ${b.miktar} ${b.birim}`).join('\n') || 'Birim fiyat bilgisi yok'}

## İŞ SÜRESİ VE DETAYLAR
- İş Süresi: ${analysisData?.sure || '-'}
- Günlük Öğün: ${analysisData?.gunluk_ogun_sayisi || '-'}
- Kişi Sayısı: ${analysisData?.kisi_sayisi || '-'}

## TALİMAT
Kullanıcının isteğine göre profesyonel bir ${typeInfo.label} hazırla. Dilekçe formatında, resmi dil kullan. 
Yukarıdaki ihale bilgilerini dilekçede uygun şekilde kullan.
Eğer kritik bir bilgi eksikse (örn: yaklaşık maliyet, bizim teklif) bunu nazikçe belirt.`;

      const response = await aiAPI.sendAgentMessage({
        message: userMessage,
        systemContext: systemPrompt,
        department: 'İHALE',
      });

      // API doğrudan { success, response } döndürür, data wrapper yok
      const aiResponse = (response as unknown as { success: boolean; response: string }).response;
      if (response.success && aiResponse) {
        const assistantMessage = aiResponse;
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

              {/* Eksik Bilgi Formu */}
              {showDataForm && tender && missingFields.length > 0 && (
                <InlineDataForm
                  tenderId={Number(tender.id)}
                  missingFields={missingFields}
                  currentValues={{
                    yaklasik_maliyet: tender.yaklasik_maliyet,
                    bizim_teklif: tender.bizim_teklif,
                    sinir_deger: tender.sinir_deger,
                  }}
                  onSaved={() => {
                    setShowDataForm(false);
                    // Bekleyen mesajı gönder
                    if (pendingMessage) {
                      handleSendMessage(pendingMessage);
                      setPendingMessage(null);
                    }
                  }}
                  onCancel={() => {
                    setShowDataForm(false);
                    setPendingMessage(null);
                  }}
                />
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
              onClick={() => handleSendMessage()}
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
