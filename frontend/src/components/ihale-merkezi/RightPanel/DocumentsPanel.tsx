'use client';

import {
  ActionIcon,
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
import {
  IconCheck,
  IconDownload,
  IconFile,
  IconFileText,
  IconRefresh,
  IconX,
} from '@tabler/icons-react';
import { API_BASE_URL } from '@/lib/config';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { tendersAPI } from '@/lib/api/services/tenders';
import { DocumentWizardModal } from '../DocumentWizardModal';

interface DocumentsPanelProps {
  tenderId: number;
  tenderTitle?: string;
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

export function DocumentsPanel({ tenderId, tenderTitle, onRefresh }: DocumentsPanelProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  
  // URL state için hooks
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Wizard modal state - URL'den oku
  const wizardParam = searchParams.get('wizard');
  const wizardOpen = wizardParam === '1' || wizardParam === 'open';

  // Modal aç/kapa fonksiyonları
  const openWizard = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('wizard', '1');
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }, [searchParams, router, pathname]);

  const closeWizard = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('wizard');
    const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.push(newUrl, { scroll: false });
  }, [searchParams, router, pathname]);

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

  // Stats
  const totalDocs = documents.length;
  const completedDocs = documents.filter(d => d.processing_status === 'completed').length;
  const pendingDocs = documents.filter(d => d.processing_status === 'pending' || d.processing_status === 'failed').length;

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

  // Sync analysis summary to tender (silent auto-sync)
  const handleSyncAnalysis = useCallback(async () => {
    if (completedDocs === 0) return;
    
    try {
      await fetch(`${API_BASE_URL}/api/tender-tracking/add-from-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tender_id: tenderId }),
      });
      onRefresh?.();
    } catch (error) {
      console.error('Auto-sync error:', error);
    }
  }, [completedDocs, tenderId, onRefresh]);

  // Auto-sync when documents are loaded and there are completed analyses
  useEffect(() => {
    if (!loading && completedDocs > 0) {
      handleSyncAnalysis();
    }
  }, [loading, completedDocs, handleSyncAnalysis]);

  return (
    <>
      <Box p="xs">
        {/* Summary & Open Wizard Button */}
        <Stack gap="xs">
          {/* Stats */}
          {!loading && totalDocs > 0 && (
            <Group justify="space-around" py="xs">
              <Box ta="center">
                <Text size="lg" fw={700}>{totalDocs}</Text>
                <Text size="xs" c="dimmed">Toplam</Text>
              </Box>
              <Box ta="center">
                <Text size="lg" fw={700} c="green">{completedDocs}</Text>
                <Text size="xs" c="dimmed">Analiz</Text>
              </Box>
              <Box ta="center">
                <Text size="lg" fw={700} c="yellow">{pendingDocs}</Text>
                <Text size="xs" c="dimmed">Bekliyor</Text>
              </Box>
            </Group>
          )}

          {/* Open Wizard Button */}
          <Group gap="xs">
            <Button
              size="xs"
              variant="gradient"
              style={{ background: 'linear-gradient(135deg, #C9A227 0%, #D4AF37 50%, #E6C65C 100%)', border: 'none', flex: 1 }}
              leftSection={<IconFileText size={14} />}
              onClick={openWizard}
            >
              Döküman Yönetimi
            </Button>
            <Tooltip label="Yenile">
              <ActionIcon variant="light" size="md" onClick={fetchDocuments} loading={loading}>
                <IconRefresh size={14} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Stack>

        {/* Quick Document List */}
        <ScrollArea.Autosize mah={150} mt="xs">
          <Stack gap={4}>
            {loading ? (
              <Box ta="center" py="md">
                <Loader size="sm" />
              </Box>
            ) : documents.length === 0 ? (
              <Text size="xs" c="dimmed" ta="center" py="sm">
                Henüz döküman yok
              </Text>
            ) : (
              documents.slice(0, 5).map((doc) => (
                <Paper key={doc.id} p={6} withBorder radius="sm">
                  <Group justify="space-between" wrap="nowrap">
                    <Group gap={6} wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                      <ThemeIcon
                        size="xs"
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
                          <IconCheck size={10} />
                        ) : doc.processing_status === 'failed' ? (
                          <IconX size={10} />
                        ) : (
                          <IconFile size={10} />
                        )}
                      </ThemeIcon>
                      <Text size="xs" truncate style={{ flex: 1 }}>
                        {doc.original_filename || getDocTypeLabel(doc.doc_type)}
                      </Text>
                    </Group>
                    {doc.storage_url && (
                      <ActionIcon
                        size="xs"
                        variant="subtle"
                        component="a"
                        href={doc.storage_url}
                        target="_blank"
                      >
                        <IconDownload size={12} />
                      </ActionIcon>
                    )}
                  </Group>
                </Paper>
              ))
            )}
            {documents.length > 5 && (
              <Text size="xs" c="dimmed" ta="center">
                +{documents.length - 5} daha...
              </Text>
            )}
          </Stack>
        </ScrollArea.Autosize>
      </Box>

      {/* Wizard Modal */}
      <DocumentWizardModal
        opened={wizardOpen}
        onClose={closeWizard}
        tenderId={tenderId}
        tenderTitle={tenderTitle}
        onComplete={() => {
          fetchDocuments();
          onRefresh?.();
        }}
      />
    </>
  );
}
