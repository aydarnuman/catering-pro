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
  Stack,
  Text,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconBrain,
  IconCheck,
  IconCloudDownload,
  IconDownload,
  IconFile,
  IconRefresh,
  IconX,
} from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';
import { tendersAPI } from '@/lib/api/services/tenders';

interface DocumentsPanelProps {
  tenderId: number;
  onRefresh?: () => void;
}

interface Document {
  id: number;
  original_filename: string;
  file_type: string;
  doc_type: string;
  processing_status: string;
  storage_url?: string;
}

export function DocumentsPanel({ tenderId, onRefresh }: DocumentsPanelProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  // Fetch documents
  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const downloadData = await tendersAPI.getDownloadedDocuments(String(tenderId));
      if (downloadData.success && downloadData.data?.documents) {
        const docs: Document[] = downloadData.data.documents.flatMap(
          (group: { files: Document[] }) =>
            group.files.map((file: Document) => ({
              ...file,
            }))
        );
        setDocuments(docs);
      }
    } catch (error) {
      console.error('Documents fetch error:', error);
    } finally {
      setLoading(false);
    }
  }, [tenderId]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Download documents
  const handleDownload = async () => {
    setDownloading(true);
    try {
      const result = await tendersAPI.downloadTenderDocuments(String(tenderId));
      if (result.success) {
        notifications.show({
          title: 'İndirme Tamamlandı',
          message: `${result.data?.totalDownloaded || 0} döküman indirildi`,
          color: 'green',
        });
        fetchDocuments();
      }
    } catch {
      notifications.show({
        title: 'Hata',
        message: 'Dökümanlar indirilemedi',
        color: 'red',
      });
    } finally {
      setDownloading(false);
    }
  };

  // Analyze documents with AI
  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      const result = await tendersAPI.analyzeDocuments(String(tenderId));
      if (result.success) {
        notifications.show({
          title: 'Analiz Tamamlandı',
          message: 'Dökümanlar başarıyla analiz edildi',
          color: 'green',
        });
        fetchDocuments();
        onRefresh?.();
      }
    } catch {
      notifications.show({
        title: 'Hata',
        message: 'Dökümanlar analiz edilemedi',
        color: 'red',
      });
    } finally {
      setAnalyzing(false);
    }
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { color: string; label: string }> = {
      pending: { color: 'gray', label: 'Bekliyor' },
      processing: { color: 'blue', label: 'İşleniyor' },
      completed: { color: 'green', label: 'Tamamlandı' },
      failed: { color: 'red', label: 'Hata' },
    };
    const s = statusMap[status] || statusMap.pending;
    return (
      <Badge size="xs" color={s.color} variant="light">
        {s.label}
      </Badge>
    );
  };

  // Get doc type label
  const getDocTypeLabel = (docType: string) => {
    const labels: Record<string, string> = {
      admin_spec: 'İdari Şartname',
      tech_spec: 'Teknik Şartname',
      announcement: 'İhale İlanı',
      goods_services: 'Mal/Hizmet',
      zeyilname: 'Zeyilname',
      contract: 'Sözleşme',
    };
    return labels[docType] || docType;
  };

  return (
    <Box p="xs">
      {/* Actions */}
      <Stack gap={4} mb="xs">
        <Group justify="space-between">
          <Button
            size="xs"
            variant="light"
            leftSection={<IconCloudDownload size={14} />}
            onClick={handleDownload}
            loading={downloading}
          >
            İndir
          </Button>
          <Tooltip label="Yenile">
            <ActionIcon variant="subtle" size="sm" onClick={fetchDocuments} loading={loading}>
              <IconRefresh size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>
        <Button
          size="xs"
          variant="gradient"
          gradient={{ from: 'violet', to: 'grape' }}
          leftSection={<IconBrain size={14} />}
          onClick={handleAnalyze}
          loading={analyzing}
          disabled={documents.length === 0}
          fullWidth
        >
          AI ile Analiz Et
        </Button>
      </Stack>

      {/* Documents List */}
      <ScrollArea.Autosize mah={200}>
        <Stack gap={4}>
          {loading ? (
            <Box ta="center" py="md">
              <Loader size="sm" />
            </Box>
          ) : documents.length === 0 ? (
            <Text size="xs" c="dimmed" ta="center" py="md">
              Henüz döküman yok. "İndir" butonuna tıklayın.
            </Text>
          ) : (
            documents.map((doc) => (
              <Paper key={doc.id} p="xs" withBorder radius="sm">
                <Group justify="space-between" wrap="nowrap">
                  <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                    <ThemeIcon
                      size="sm"
                      variant="light"
                      color={
                        doc.processing_status === 'completed'
                          ? 'green'
                          : doc.processing_status === 'failed'
                            ? 'red'
                            : 'gray'
                      }
                    >
                      {doc.processing_status === 'completed' ? (
                        <IconCheck size={12} />
                      ) : doc.processing_status === 'failed' ? (
                        <IconX size={12} />
                      ) : (
                        <IconFile size={12} />
                      )}
                    </ThemeIcon>
                    <Box style={{ minWidth: 0, flex: 1 }}>
                      <Text size="xs" fw={500} truncate>
                        {doc.original_filename || getDocTypeLabel(doc.doc_type)}
                      </Text>
                      <Group gap={4}>
                        <Badge size="xs" variant="dot" color="blue">
                          {doc.file_type?.toUpperCase() || 'PDF'}
                        </Badge>
                        {getStatusBadge(doc.processing_status)}
                      </Group>
                    </Box>
                  </Group>
                  {doc.storage_url && (
                    <Tooltip label="İndir">
                      <ActionIcon
                        size="sm"
                        variant="subtle"
                        component="a"
                        href={doc.storage_url}
                        target="_blank"
                      >
                        <IconDownload size={14} />
                      </ActionIcon>
                    </Tooltip>
                  )}
                </Group>
              </Paper>
            ))
          )}
        </Stack>
      </ScrollArea.Autosize>
    </Box>
  );
}
