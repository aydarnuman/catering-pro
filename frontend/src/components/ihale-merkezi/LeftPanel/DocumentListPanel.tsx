'use client';

import {
  ActionIcon,
  Badge,
  Box,
  Button,
  FileButton,
  Group,
  Loader,
  Paper,
  ScrollArea,
  Stack,
  Text,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconArrowLeft,
  IconBuilding,
  IconCalendar,
  IconFile,
  IconFileSearch,
  IconFileText,
  IconPhoto,
  IconPlus,
  IconRefresh,
  IconSettings,
  IconTable,
  IconUpload,
} from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { API_BASE_URL } from '@/lib/config';
import { formatDate } from '@/lib/formatters';
import type { DocFileType } from '../CenterPanel/DokumanDogrulama/UniversalDocViewer';
import type { DocumentInfo, SavedTender } from '../types';

// ─── Helpers ────────────────────────────────────────────────────

function getDocFileType(filename: string, fileType: string, sourceType: string): DocFileType {
  if (sourceType === 'content') return 'html';
  const ext = filename?.split('.').pop()?.toLowerCase() || '';
  if (ext === 'pdf' || fileType?.includes('pdf')) return 'pdf';
  if (ext === 'docx' || ext === 'doc' || fileType?.includes('word')) return 'docx';
  if (ext === 'xlsx' || ext === 'xls' || fileType?.includes('sheet') || fileType?.includes('excel')) return 'xlsx';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext) || fileType?.includes('image')) return 'image';
  return 'unknown';
}

function getFileTypeIcon(ft: DocFileType) {
  switch (ft) {
    case 'pdf':
      return <IconFileText size={16} />;
    case 'docx':
      return <IconFileText size={16} />;
    case 'xlsx':
      return <IconTable size={16} />;
    case 'image':
      return <IconPhoto size={16} />;
    case 'html':
      return <IconFileSearch size={16} />;
    default:
      return <IconFile size={16} />;
  }
}

function getFileTypeColor(ft: DocFileType): string {
  switch (ft) {
    case 'pdf':
      return 'red';
    case 'docx':
      return 'blue';
    case 'xlsx':
      return 'green';
    case 'image':
      return 'orange';
    case 'html':
      return 'cyan';
    default:
      return 'gray';
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'completed':
    case 'extracted':
      return { color: 'green', label: 'Tamamlandı' };
    case 'pending':
    case 'queued':
      return { color: 'yellow', label: 'Bekliyor' };
    case 'processing':
      return { color: 'blue', label: 'İşleniyor' };
    case 'error':
    case 'failed':
      return { color: 'red', label: 'Hata' };
    default:
      return { color: 'gray', label: status || 'Bilinmiyor' };
  }
}

const DOC_TYPE_LABELS: Record<string, string> = {
  admin_spec: 'İdari Şartname',
  tech_spec: 'Teknik Şartname',
  announcement: 'İhale İlanı',
  goods_services: 'Mal/Hizmet Listesi',
  zeyilname: 'Zeyilname',
  contract: 'Sözleşme Tasarısı',
  unit_price: 'Birim Fiyat Cetveli',
  result_announcement: 'Sonuç İlanı',
  other: 'Diğer',
};

function getDocTypeLabel(docType: string): string {
  return DOC_TYPE_LABELS[docType] || docType || 'Diğer';
}

// ─── Props ──────────────────────────────────────────────────────

interface DocumentListPanelProps {
  tender: SavedTender;
  documents: DocumentInfo[];
  documentsLoading: boolean;
  selectedDocumentId: number | null;
  onSelectDocument: (doc: DocumentInfo) => void;
  onDeselectTender: () => void;
  onOpenDocumentWizard: () => void;
  onRefreshDocuments?: () => void;
}

// ─── Desteklenen Formatlar ───────────────────────────────────────
const ACCEPTED_FORMATS =
  '.pdf,.doc,.docx,.rtf,.odt,.xls,.xlsx,.ods,.csv,.pptx,.ppt,.odp,.txt,.xml,.json,.png,.jpg,.jpeg,.webp,.gif,.tiff,.tif,.bmp,.zip,.rar';

// ─── Component ──────────────────────────────────────────────────

export function DocumentListPanel({
  tender,
  documents,
  documentsLoading,
  selectedDocumentId,
  onSelectDocument,
  onDeselectTender,
  onOpenDocumentWizard,
  onRefreshDocuments,
}: DocumentListPanelProps) {
  const [uploading, setUploading] = useState(false);

  // ─── Quick Upload Handler ─────────────────────────────────────
  const handleQuickUpload = async (files: File[]) => {
    if (!files || files.length === 0) return;

    setUploading(true);
    let successCount = 0;
    let errorCount = 0;

    for (const file of files) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('tender_id', tender.tender_id.toString());

        const response = await fetch(`${API_BASE_URL}/api/documents/upload`, {
          method: 'POST',
          credentials: 'include',
          body: formData,
        });

        const data = await response.json();

        if (data.success || data.id) {
          successCount++;
        } else {
          errorCount++;
          console.error('Upload failed:', file.name, data.error);
        }
      } catch (error) {
        errorCount++;
        console.error('Upload error:', file.name, error);
      }
    }

    setUploading(false);

    if (successCount > 0) {
      notifications.show({
        title: 'Yükleme Tamamlandı',
        message: `${successCount} dosya yüklendi${errorCount > 0 ? `, ${errorCount} hata` : ''}`,
        color: errorCount > 0 ? 'yellow' : 'green',
      });
      onRefreshDocuments?.();
    } else {
      notifications.show({
        title: 'Hata',
        message: 'Dosyalar yüklenemedi',
        color: 'red',
      });
    }
  };

  // Filter out ZIP/RAR files and group by doc_type
  const groupedDocs = useMemo(() => {
    const groups: Record<string, DocumentInfo[]> = {};
    for (const doc of documents) {
      // Skip ZIP and RAR files
      const ext = doc.original_filename?.split('.').pop()?.toLowerCase() || '';
      if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) continue;
      
      const key = doc.doc_type || 'Diğer';
      if (!groups[key]) groups[key] = [];
      groups[key].push(doc);
    }
    return groups;
  }, [documents]);
  
  // Actual visible count (excluding archives)
  const visibleDocCount = useMemo(() => {
    return Object.values(groupedDocs).flat().length;
  }, [groupedDocs]);

  return (
    <Box
      style={{
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* ─── Back Button ────────────────────────────────────── */}
      <Box
        px="xs"
        py={6}
        style={{
          borderBottom: '1px solid var(--mantine-color-default-border)',
          flexShrink: 0,
        }}
      >
        <Group gap={6}>
          <ActionIcon variant="subtle" color="gray" size="sm" onClick={onDeselectTender}>
            <IconArrowLeft size={16} />
          </ActionIcon>
          <Text size="xs" fw={500} c="dimmed">
            İhale Listesi'ne Dön
          </Text>
        </Group>
      </Box>

      {/* ─── Mini Tender Summary ────────────────────────────── */}
      <Box
        px="xs"
        py={8}
        style={{
          borderBottom: '1px solid var(--mantine-color-default-border)',
          flexShrink: 0,
          background: 'rgba(59, 130, 246, 0.04)',
        }}
      >
        <Text size="xs" fw={600} lineClamp={2} mb={4}>
          {tender.ihale_basligi}
        </Text>
        <Group gap="xs">
          <Group gap={4}>
            <IconBuilding size={10} color="var(--mantine-color-dimmed)" />
            <Text size="xs" c="dimmed" lineClamp={1} maw={150}>
              {tender.kurum}
            </Text>
          </Group>
          <Group gap={4}>
            <IconCalendar size={10} color="var(--mantine-color-dimmed)" />
            <Text size="xs" c="dimmed">
              {formatDate(tender.tarih)}
            </Text>
          </Group>
        </Group>
      </Box>

      {/* ─── Document Count + Refresh ───────────────────────── */}
      <Box
        px="xs"
        py={6}
        style={{
          borderBottom: '1px solid var(--mantine-color-default-border)',
          flexShrink: 0,
        }}
      >
        <Group justify="space-between">
          <Group gap={6}>
            <Text size="xs" fw={600}>
              Dökümanlar
            </Text>
            <Badge size="xs" variant="light" color="blue">
              {visibleDocCount}
            </Badge>
          </Group>
          {onRefreshDocuments && (
            <Tooltip label="Dökümanları yenile" position="right">
              <ActionIcon variant="subtle" color="gray" size="xs" onClick={onRefreshDocuments}>
                <IconRefresh size={12} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      </Box>

      {/* ─── Document List ──────────────────────────────────── */}
      <ScrollArea style={{ flex: 1 }} offsetScrollbars>
        <Stack gap={0} p="xs">
          {documentsLoading ? (
            <Box ta="center" py="xl">
              <Loader size="sm" />
              <Text size="xs" c="dimmed" mt="xs">
                Dökümanlar yükleniyor...
              </Text>
            </Box>
          ) : visibleDocCount === 0 ? (
            <Stack align="center" gap="sm" py="xl" px="xs">
              <ThemeIcon size={40} radius="xl" variant="light" color="gray">
                <IconUpload size={20} />
              </ThemeIcon>
              <Text size="xs" c="dimmed" ta="center">
                Henüz döküman yok. Döküman Yönetimi'ni kullanarak döküman ekleyin.
              </Text>
              <Button
                variant="light"
                size="compact-xs"
                leftSection={<IconUpload size={12} />}
                onClick={onOpenDocumentWizard}
              >
                Döküman Yönetimi
              </Button>
            </Stack>
          ) : (
            Object.entries(groupedDocs).map(([groupName, docs]) => (
              <Box key={groupName} mb="xs">
                {Object.keys(groupedDocs).length > 1 && (
                  <Text size="xs" c="dimmed" fw={600} mb={4} px={4}>
                    {getDocTypeLabel(groupName)}
                  </Text>
                )}
                <Stack gap={4}>
                  {docs.map((doc) => {
                    const ft = getDocFileType(doc.original_filename, doc.file_type, doc.source_type);
                    const isActive = selectedDocumentId === doc.id;
                    const statusBadge = getStatusBadge(doc.processing_status);

                    return (
                      <Paper
                        key={doc.id}
                        p="xs"
                        radius="sm"
                        withBorder={isActive}
                        style={{
                          cursor: 'pointer',
                          background: isActive
                            ? `var(--mantine-color-${getFileTypeColor(ft)}-light)`
                            : 'rgba(255, 255, 255, 0.02)',
                          borderColor: isActive ? `var(--mantine-color-${getFileTypeColor(ft)}-5)` : 'transparent',
                          transition: 'all 0.15s ease',
                        }}
                        onClick={() => onSelectDocument(doc)}
                      >
                        <Group gap="xs" wrap="nowrap">
                          <ThemeIcon
                            size="sm"
                            variant={isActive ? 'filled' : 'light'}
                            color={getFileTypeColor(ft)}
                            radius="sm"
                          >
                            {getFileTypeIcon(ft)}
                          </ThemeIcon>
                          <Box style={{ flex: 1, minWidth: 0 }}>
                            <Text size="xs" fw={isActive ? 600 : 400} lineClamp={2} style={{ wordBreak: 'break-word' }}>
                              {doc.original_filename || 'Adsız Döküman'}
                            </Text>
                            <Group gap={4} mt={2}>
                              <Badge size="xs" variant="dot" color={statusBadge.color}>
                                {statusBadge.label}
                              </Badge>
                              <Badge size="xs" variant="light" color={getFileTypeColor(ft)}>
                                {ft.toUpperCase()}
                              </Badge>
                            </Group>
                          </Box>
                        </Group>
                      </Paper>
                    );
                  })}
                </Stack>
              </Box>
            ))
          )}
        </Stack>
      </ScrollArea>

      {/* ─── Bottom: Upload + Yönetim ───────────────────────── */}
      <Box
        px="xs"
        py={8}
        style={{
          borderTop: '1px solid var(--mantine-color-default-border)',
          flexShrink: 0,
        }}
      >
        <Group gap={6}>
          <FileButton onChange={(files) => files && handleQuickUpload(files)} accept={ACCEPTED_FORMATS} multiple>
            {(props) => (
              <Tooltip label="Hızlı dosya yükle" position="top">
                <Button
                  {...props}
                  variant="filled"
                  color="blue"
                  size="compact-sm"
                  loading={uploading}
                  style={{ flex: 1 }}
                  leftSection={<IconPlus size={14} />}
                >
                  Dosya Ekle
                </Button>
              </Tooltip>
            )}
          </FileButton>
          <Tooltip label="Döküman Yönetimi" position="top">
            <ActionIcon variant="light" color="gray" size="lg" onClick={onOpenDocumentWizard}>
              <IconSettings size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Box>
    </Box>
  );
}
