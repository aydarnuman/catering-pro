'use client';

import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Group,
  Paper,
  ScrollArea,
  Select,
  SimpleGrid,
  Tabs,
  Text,
  ThemeIcon,
  Title,
  Tooltip,
} from '@mantine/core';
import {
  IconBuilding,
  IconCalendar,
  IconDownload,
  IconExternalLink,
  IconFile,
  IconFileText,
  IconMapPin,
  IconNote,
  IconSettings,
  IconSparkles,
} from '@tabler/icons-react';
import { useCallback, useState } from 'react';
import { ContextualNotesSection } from '@/components/notes/ContextualNotesSection';
import { useAnalysisCorrections } from '@/hooks/useAnalysisCorrections';
import type { Tender } from '@/types/api';
import { DocumentWizardModal } from '../DocumentWizardModal';
import type { AnalysisData, IhaleMerkeziState, SavedTender, TenderStatus } from '../types';
import { statusConfig } from '../types';
import { BirimFiyatlarModal, TamMetinModal, TeknikSartlarModal } from './DetailModals';
import { DokumanlarSection } from './DokumanlarSection';
import { OzetTabPanel } from './OzetTabPanel';
import { SartnameGramajModal } from './SartnameGramajModal';
import { SettingsModal } from './SettingsModal';

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

  // HITL: Analiz düzeltme sistemi (hooks MUST be before early returns)
  const isSaved = selectedTender ? isSavedTender(selectedTender) : false;
  // TypeScript can't narrow union from stored boolean — create typed reference
  const savedTender: SavedTender | null = isSaved ? (selectedTender as SavedTender) : null;
  const currentTenderId = selectedTender
    ? isSaved
      ? (selectedTender as SavedTender).tender_id
      : ((selectedTender as Tender)?.id ?? null)
    : null;
  const {
    correctionCount,
    isConfirmed,
    saving: correctionSaving,
    saveCorrection,
    confirmAnalysis,
    getCorrectionForField,
  } = useAnalysisCorrections(currentTenderId ? Number(currentTenderId) : null);

  // Hangi kartlar edit modunda
  const [editingCards, setEditingCards] = useState<Set<string>>(new Set());
  const toggleCardEdit = useCallback((cardName: string) => {
    setEditingCards((prev) => {
      const next = new Set(prev);
      if (next.has(cardName)) {
        next.delete(cardName);
      } else {
        next.add(cardName);
      }
      return next;
    });
  }, []);

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

  // Analiz durumu kontrolü
  const hasAnalysis =
    isSaved &&
    ((savedTender?.analiz_edilen_dokuman || 0) > 0 ||
      (savedTender?.teknik_sart_sayisi || 0) > 0 ||
      (savedTender?.birim_fiyat_sayisi || 0) > 0);

  // Extract fields
  const title = isSaved ? savedTender?.ihale_basligi : (selectedTender as Tender).title;
  const organization = isSaved ? savedTender?.kurum : (selectedTender as Tender).organization;
  const city = selectedTender.city;
  const dateStr = isSaved ? savedTender?.tarih : (selectedTender as Tender).deadline;
  const externalId = isSaved ? savedTender?.external_id : selectedTender.external_id;
  const url = isSaved ? savedTender?.url : selectedTender.url;

  // Zeyilname ve düzeltme ilanı (sadece SavedTender için)
  const zeyilname = isSaved ? savedTender?.zeyilname_content : null;
  const correction = isSaved ? savedTender?.correction_notice_content : null;

  // Tipli analysis_summary (SavedTender için)
  const analysisSummary: AnalysisData | undefined = isSaved
    ? savedTender?.analysis_summary
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
                        if (!savedTender) return;
                        const st = savedTender;
                        const data = {
                          ihale: {
                            baslik: st.ihale_basligi,
                            kurum: st.kurum,
                            tarih: st.tarih,
                            sehir: st.city,
                            bedel: st.bedel,
                            external_id: st.external_id,
                            url: st.url,
                          },
                          hesaplamalar: {
                            yaklasik_maliyet: st.yaklasik_maliyet,
                            sinir_deger: st.sinir_deger,
                            bizim_teklif: st.bizim_teklif,
                          },
                          analiz: st.analysis_summary,
                          durum: st.status,
                          olusturulma: st.created_at,
                        };
                        const blob = new Blob([JSON.stringify(data, null, 2)], {
                          type: 'application/json',
                        });
                        const urlObj = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = urlObj;
                        a.download = `ihale_${st.external_id || st.id}_${Date.now()}.json`;
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
                value={savedTender?.status}
                onChange={(value) => {
                  if (value && onUpdateStatus && savedTender) {
                    onUpdateStatus(savedTender.id, value);
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
                    {(savedTender?.dokuman_sayisi ?? 0) > 0 && (
                      <Badge size="xs" variant="light" color="gray">
                        {savedTender?.dokuman_sayisi}
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
              <OzetTabPanel
                selectedTender={selectedTender}
                savedTender={savedTender}
                isSaved={isSaved}
                hasAnalysis={hasAnalysis}
                analysisSummary={analysisSummary}
                editingCards={editingCards}
                toggleCardEdit={toggleCardEdit}
                correctionCount={correctionCount}
                isConfirmed={isConfirmed}
                correctionSaving={correctionSaving}
                saveCorrection={saveCorrection}
                confirmAnalysis={confirmAnalysis}
                getCorrectionForField={getCorrectionForField}
                onRefreshData={onRefreshData}
                onOpenTeknikModal={() => setTeknikModalOpen(true)}
                onOpenBirimModal={() => setBirimModalOpen(true)}
                onOpenTamMetinModal={() => setTamMetinModalOpen(true)}
                onOpenSartnameModal={() => setSartnameGramajModalOpen(true)}
                onOpenDocumentWizard={() => setDocumentWizardOpen(true)}
              />
            </Tabs.Panel>

            <Tabs.Panel value="dokumanlar" pt="md">
              {/* Dökümanlar sekmesi - Wizard Modal ile döküman yönetimi */}
              {isSaved ? (
                <DokumanlarSection
                  tenderId={savedTender?.tender_id ?? 0}
                  tenderTitle={savedTender?.ihale_basligi ?? ''}
                  dokumansayisi={savedTender?.dokuman_sayisi || 0}
                  analizEdilen={savedTender?.analiz_edilen_dokuman || 0}
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
                  contextId={savedTender?.tender_id ?? 0}
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
      {isSaved && savedTender && (
        <SettingsModal
          opened={settingsModalOpen}
          onClose={() => setSettingsModalOpen(false)}
          tender={savedTender}
          onRefresh={onRefreshData}
        />
      )}

      {/* Döküman Wizard Modal - Özet sekmesinden erişim için */}
      {isSaved && (
        <DocumentWizardModal
          opened={documentWizardOpen}
          onClose={() => setDocumentWizardOpen(false)}
          tenderId={savedTender?.tender_id ?? 0}
          tenderTitle={savedTender?.ihale_basligi ?? ''}
          onComplete={onRefreshData}
        />
      )}

      {/* Teknik Şartlar Modal */}
      <TeknikSartlarModal
        opened={teknikModalOpen}
        onClose={() => setTeknikModalOpen(false)}
        analysisData={analysisSummary}
      />

      {/* Birim Fiyatlar Modal */}
      <BirimFiyatlarModal
        opened={birimModalOpen}
        onClose={() => setBirimModalOpen(false)}
        analysisData={analysisSummary}
      />

      {/* Tam Metin Modal */}
      <TamMetinModal
        opened={tamMetinModalOpen}
        onClose={() => setTamMetinModalOpen(false)}
        tamMetin={analysisSummary?.tam_metin}
      />

      {/* Şartname/Gramaj Detayları Modal */}
      <SartnameGramajModal
        opened={sartnameGramajModalOpen}
        onClose={() => setSartnameGramajModalOpen(false)}
        analysisData={analysisSummary}
      />
    </Box>
  );
}
