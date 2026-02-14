'use client';

import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  Loader,
  Paper,
  ScrollArea,
  Select,
  Stack,
  Text,
  ThemeIcon,
  Title,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconBookmark,
  IconBuilding,
  IconCalendar,
  IconCards,
  IconCopy,
  IconExternalLink,
  IconFileSearch,
  IconFileText,
  IconMapPin,
  IconNote,
  IconReport,
  IconSettings,
  IconUpload,
} from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import RaporMerkeziModal from '@/components/rapor-merkezi/RaporMerkeziModal';
import { formatDate } from '@/lib/formatters';
import { tendersAPI } from '@/lib/api/services/tenders';
import type { Tender } from '@/types/api';
import { DocumentWizardModal } from '../DocumentWizardModal';
import type { IhaleMerkeziState, SavedTender, TenderStatus } from '../types';
import { statusConfig } from '../types';
import { UniversalDocViewer } from './DokumanDogrulama/UniversalDocViewer';
import { SettingsModal } from './SettingsModal';

// ─── Types ────────────────────────────────────────────────────

interface CenterPanelProps {
  state: IhaleMerkeziState;
  onStateChange: (updates: Partial<IhaleMerkeziState>) => void;
  onSelectTender: (tender: Tender | SavedTender | null) => void;
  onUpdateStatus?: (tenderId: string, status: string) => void;
  onRefreshData?: () => void;
  onTextSelect?: (text: string, documentId?: number) => void;
  isMobile?: boolean;
}

// Check if tender is SavedTender
function isSavedTenderFn(tender: Tender | SavedTender | null): tender is SavedTender {
  return tender !== null && 'tender_id' in tender;
}

// ─── Component ────────────────────────────────────────────────

export function CenterPanel({ state, onUpdateStatus, onRefreshData, onTextSelect }: CenterPanelProps) {
  const { selectedTender } = state;

  // Modal states
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [documentWizardOpen, setDocumentWizardOpen] = useState(false);
  const [raporMerkeziOpen, setRaporMerkeziOpen] = useState(false);

  // Listen for open-document-wizard events from context
  useEffect(() => {
    const handler = () => setDocumentWizardOpen(true);
    window.addEventListener('open-document-wizard', handler);
    return () => window.removeEventListener('open-document-wizard', handler);
  }, []);

  // Document data from context state
  const { documents, selectedDocumentId, signedUrl, signedUrlLoading: urlLoading } = state;

  // Currently selected document object
  const selectedDoc = useMemo(
    () => documents.find((d) => d.id === selectedDocumentId) || null,
    [documents, selectedDocumentId]
  );

  // Tender info
  const isSaved = selectedTender ? isSavedTenderFn(selectedTender) : false;
  const savedTender: SavedTender | null = isSaved ? (selectedTender as SavedTender) : null;
  const hasDocs = documents.length > 0;

  // Extract fields
  const title = isSaved ? savedTender?.ihale_basligi : (selectedTender as Tender)?.title;
  const organization = isSaved ? savedTender?.kurum : (selectedTender as Tender)?.organization;
  const city = selectedTender?.city;
  const dateStr = isSaved ? savedTender?.tarih : (selectedTender as Tender)?.deadline;
  const externalId = isSaved ? savedTender?.external_id : selectedTender?.external_id;
  const url = isSaved ? savedTender?.url : selectedTender?.url;

  // ─── Text selection ──────────────────────────────────────
  const [localSelectedText, setLocalSelectedText] = useState('');

  const handleTextSelect = useCallback(
    (text: string, _pageNumber?: number) => {
      setLocalSelectedText(text);
      onTextSelect?.(text, selectedDoc?.id);
    },
    [onTextSelect, selectedDoc]
  );

  const handleCopyText = useCallback(() => {
    if (!localSelectedText) return;
    navigator.clipboard.writeText(localSelectedText);
    notifications.show({ message: 'Metin kopyalandı', color: 'gray', autoClose: 1500 });
  }, [localSelectedText]);

  const handleSendNote = useCallback(() => {
    if (!localSelectedText) return;
    onTextSelect?.(localSelectedText, selectedDoc?.id);
    notifications.show({
      title: 'Metin gönderildi',
      message: 'Sağ panelden not olarak ekleyebilirsiniz',
      color: 'teal',
      autoClose: 2000,
    });
  }, [localSelectedText, onTextSelect, selectedDoc?.id]);

  const handleCreateCard = useCallback(() => {
    if (!localSelectedText) return;
    onTextSelect?.(localSelectedText, selectedDoc?.id);
    notifications.show({
      title: 'Metin gönderildi',
      message: 'Sağ paneldeki "Özel Kartlar" bölümünden kart oluşturabilirsiniz',
      color: 'pink',
      autoClose: 2000,
    });
  }, [localSelectedText, onTextSelect, selectedDoc?.id]);

  // ═══════════════════════════════════════════════════════════
  // No tender selected — Clean empty state
  // ═══════════════════════════════════════════════════════════
  if (!selectedTender) {
    return (
      <Box
        style={{
          height: '100%',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: 'transparent',
        }}
      >
        <Stack align="center" gap="md" py="xl" px="md" style={{ flex: 1, justifyContent: 'center' }}>
          <ThemeIcon size={64} radius="xl" variant="light" color="gray">
            <IconFileText size={32} />
          </ThemeIcon>
          <Box ta="center">
            <Text size="md" fw={600}>
              Döküman Çalışma Alanı
            </Text>
            <Text size="sm" c="dimmed" mt="xs">
              Sol panelden bir ihale seçerek dökümanları görüntüleyin
            </Text>
          </Box>
        </Stack>
      </Box>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // Not tracked — show "Track" CTA
  // ═══════════════════════════════════════════════════════════
  if (!isSaved) {
    return (
      <Box
        style={{
          height: '100%',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: 'transparent',
        }}
      >
        <ScrollArea style={{ flex: 1 }} p="md" offsetScrollbars>
          {/* Compact header */}
          <Title order={4} lineClamp={2} mb="md">
            {title || 'İsimsiz İhale'}
          </Title>

          <Group gap="xs" mb="md" wrap="nowrap">
            <Paper p="xs" withBorder radius="md" style={{ flex: 1, minWidth: 0 }}>
              <Text size="xs" c="dimmed">
                Kurum
              </Text>
              <Text size="xs" fw={500} truncate="end">
                {organization || '-'}
              </Text>
            </Paper>
            <Paper p="xs" withBorder radius="md">
              <Text size="xs" c="dimmed">
                Şehir
              </Text>
              <Text size="xs" fw={500}>
                {city || '-'}
              </Text>
            </Paper>
            <Paper p="xs" withBorder radius="md">
              <Text size="xs" c="dimmed">
                Son Teklif
              </Text>
              <Text size="xs" fw={500}>
                {formatDate(dateStr, 'datetime')}
              </Text>
            </Paper>
          </Group>

          <Paper
            p="xl"
            withBorder
            radius="lg"
            ta="center"
            style={{
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(59, 130, 246, 0.02))',
              borderColor: 'var(--mantine-color-blue-5)',
            }}
          >
            <Stack align="center" gap="md">
              <ThemeIcon size={50} variant="light" color="blue" radius="xl">
                <IconBookmark size={24} />
              </ThemeIcon>
              <Text size="md" fw={600}>
                İhaleyi Takip Et
              </Text>
              <Text size="sm" c="dimmed">
                Döküman indirmek ve analiz yapmak için önce ihaleyi takip listesine ekleyin
              </Text>
              <Button
                variant="filled"
                color="blue"
                size="md"
                leftSection={<IconBookmark size={18} />}
                onClick={async () => {
                  try {
                    await tendersAPI.addTracking(Number(selectedTender.id));
                    notifications.show({
                      title: 'Takibe Eklendi',
                      message: 'İhale takip listesine eklendi',
                      color: 'green',
                      autoClose: 2000,
                    });
                    onRefreshData?.();
                  } catch (error) {
                    console.error('Takibe ekleme hatası:', error);
                    notifications.show({
                      title: 'Hata',
                      message: 'İhale takibe eklenemedi',
                      color: 'red',
                    });
                  }
                }}
              >
                Takip Listesine Ekle
              </Button>
            </Stack>
          </Paper>
        </ScrollArea>
      </Box>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // Main: Document Workspace
  // ═══════════════════════════════════════════════════════════
  return (
    <Box
      style={{
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: 'transparent',
      }}
    >
      {/* ─── Compact Header ────────────────────────────────── */}
      <Box
        px="sm"
        py="xs"
        style={{
          borderBottom: '1px solid var(--mantine-color-default-border)',
          flexShrink: 0,
          background: 'rgba(24, 24, 27, 0.6)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <Group justify="space-between" gap="xs" wrap="nowrap">
          <Box style={{ flex: 1, minWidth: 0 }}>
            <Group gap={4} mb={2}>
              {externalId && (
                <Badge size="xs" variant="light" color="gray">
                  #{externalId}
                </Badge>
              )}
              <Badge
                size="xs"
                variant="light"
                color={statusConfig[savedTender?.status as TenderStatus]?.color || 'gray'}
              >
                {statusConfig[savedTender?.status as TenderStatus]?.label || savedTender?.status}
              </Badge>
            </Group>
            <Text size="sm" fw={600} lineClamp={1}>
              {title || 'İsimsiz İhale'}
            </Text>
            <Group gap="xs" mt={2}>
              <Group gap={4}>
                <IconBuilding size={11} color="var(--mantine-color-dimmed)" />
                <Text size="xs" c="dimmed" truncate="end" maw={200}>
                  {organization || '-'}
                </Text>
              </Group>
              <Group gap={4}>
                <IconMapPin size={11} color="var(--mantine-color-dimmed)" />
                <Text size="xs" c="dimmed">
                  {city || '-'}
                </Text>
              </Group>
              <Group gap={4}>
                <IconCalendar size={11} color="var(--mantine-color-dimmed)" />
                <Text size="xs" c="dimmed">
                  {formatDate(dateStr, 'datetime')}
                </Text>
              </Group>
            </Group>
          </Box>

          <Group gap={4}>
            {/* Status selector */}
            <Select
              size="xs"
              w={130}
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
              styles={{ input: { fontSize: 'var(--mantine-font-size-xs)' } }}
            />
            {url && (
              <Tooltip label="Kaynak Sayfa">
                <ActionIcon component="a" href={url} target="_blank" variant="light" size="sm">
                  <IconExternalLink size={14} />
                </ActionIcon>
              </Tooltip>
            )}
            <Tooltip label="Döküman Ayarları">
              <ActionIcon variant="light" color="grape" size="sm" onClick={() => setSettingsModalOpen(true)}>
                <IconSettings size={14} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Raporlar">
              <ActionIcon variant="light" color="blue" size="sm" onClick={() => setRaporMerkeziOpen(true)}>
                <IconReport size={14} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>
      </Box>

      {/* ─── Document Viewer (Main Content — Full Height) ──── */}
      <Box style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {!hasDocs ? (
          // No documents state
          <Stack align="center" gap="md" py="xl" px="md" style={{ flex: 1, justifyContent: 'center' }}>
            <ThemeIcon size={64} radius="xl" variant="light" color="blue">
              <IconUpload size={32} />
            </ThemeIcon>
            <Box ta="center">
              <Text size="md" fw={600}>
                Henüz Döküman Yok
              </Text>
              <Text size="sm" c="dimmed" mt="xs">
                Sol paneldeki Döküman Yönetimi ile dökümanları indirin ve analiz edin.
              </Text>
            </Box>
            <Button
              variant="filled"
              color="blue"
              leftSection={<IconUpload size={16} />}
              onClick={() => setDocumentWizardOpen(true)}
            >
              Döküman Yönetimi
            </Button>
          </Stack>
        ) : !selectedDoc ? (
          // Documents loaded but none selected
          <Stack align="center" gap="md" py="xl" px="md" style={{ flex: 1, justifyContent: 'center' }}>
            <ThemeIcon size={48} radius="xl" variant="light" color="cyan">
              <IconFileSearch size={24} />
            </ThemeIcon>
            <Text size="sm" c="dimmed" ta="center">
              Sol panelden bir döküman seçin
            </Text>
          </Stack>
        ) : urlLoading ? (
          // Loading signed URL
          <Stack align="center" gap="sm" py="xl" style={{ flex: 1, justifyContent: 'center' }}>
            <Loader size="md" />
            <Text size="sm" c="dimmed">
              Döküman hazırlanıyor...
            </Text>
          </Stack>
        ) : (
          // Document viewer + sabit toolbar
          <Box style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            {/* ─── Döküman Araç Çubuğu (her zaman görünür) ─── */}
            <Paper
              px="sm"
              py={6}
              radius={0}
              style={{
                flexShrink: 0,
                borderBottom: '1px solid var(--mantine-color-default-border)',
                background: 'rgba(24, 24, 27, 0.7)',
                backdropFilter: 'blur(6px)',
              }}
            >
              <Group justify="space-between" gap="xs">
                {/* Sol: seçilen metin önizleme */}
                <Text
                  size="xs"
                  c={localSelectedText ? 'teal' : 'dimmed'}
                  lineClamp={1}
                  style={{ flex: 1, minWidth: 0 }}
                >
                  {localSelectedText
                    ? `"${localSelectedText.length > 60 ? `${localSelectedText.substring(0, 60)}...` : localSelectedText}"`
                    : 'Döküman üzerinden metin seçin'}
                </Text>

                {/* Sağ: aksiyonlar */}
                <Group gap={4}>
                  <Tooltip label="Seçimi kopyala">
                    <ActionIcon
                      variant="subtle"
                      size="sm"
                      color="gray"
                      disabled={!localSelectedText}
                      onClick={handleCopyText}
                    >
                      <IconCopy size={14} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Not olarak gönder">
                    <ActionIcon
                      variant="subtle"
                      size="sm"
                      color="teal"
                      disabled={!localSelectedText}
                      onClick={handleSendNote}
                    >
                      <IconNote size={14} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Özel kart oluştur">
                    <ActionIcon
                      variant="subtle"
                      size="sm"
                      color="pink"
                      disabled={!localSelectedText}
                      onClick={handleCreateCard}
                    >
                      <IconCards size={14} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Group>
            </Paper>

            {/* ─── Viewer ─── */}
            <Box style={{ flex: 1, minHeight: 0 }}>
              {selectedDoc.source_type === 'content' ? (
                <UniversalDocViewer
                  url=""
                  documentId={selectedDoc.id}
                  fileName={selectedDoc.original_filename}
                  sourceType="content"
                  contentText={selectedDoc.content_text || selectedDoc.extracted_text || ''}
                  onTextSelect={handleTextSelect}
                />
              ) : signedUrl ? (
                <UniversalDocViewer
                  url={signedUrl}
                  documentId={selectedDoc.id}
                  fileName={selectedDoc.original_filename}
                  mimeType={selectedDoc.file_type}
                  sourceType={selectedDoc.source_type}
                  ocrText={selectedDoc.extracted_text}
                  extractedText={selectedDoc.extracted_text}
                  onTextSelect={handleTextSelect}
                />
              ) : (
                <UniversalDocViewer
                  url=""
                  documentId={selectedDoc.id}
                  fileName={selectedDoc.original_filename}
                  mimeType={selectedDoc.file_type}
                  sourceType={selectedDoc.source_type}
                  ocrText={selectedDoc.extracted_text}
                  extractedText={selectedDoc.extracted_text}
                  onTextSelect={handleTextSelect}
                />
              )}
            </Box>
          </Box>
        )}
      </Box>

      {/* ─── Modals ────────────────────────────────────────── */}
      {savedTender && (
        <SettingsModal
          opened={settingsModalOpen}
          onClose={() => setSettingsModalOpen(false)}
          tender={savedTender}
          onRefresh={onRefreshData}
        />
      )}

      <DocumentWizardModal
        opened={documentWizardOpen}
        onClose={() => setDocumentWizardOpen(false)}
        tenderId={savedTender?.tender_id ?? 0}
        tenderTitle={savedTender?.ihale_basligi ?? ''}
        onComplete={onRefreshData}
      />

      <RaporMerkeziModal
        opened={raporMerkeziOpen}
        onClose={() => setRaporMerkeziOpen(false)}
        module="ihale"
        context={{ tenderId: savedTender?.id }}
      />
    </Box>
  );
}
