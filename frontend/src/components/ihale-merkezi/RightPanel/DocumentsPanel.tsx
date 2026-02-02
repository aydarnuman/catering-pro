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
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
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

  // Reset all documents
  const handleResetDocuments = async () => {
    if (documents.length === 0) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/tender-content/documents/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ documentIds: documents.map(d => d.id) }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        notifications.show({
          title: 'Başarılı',
          message: `${data.resetCount} döküman sıfırlandı`,
          color: 'green',
        });
        fetchDocuments();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      notifications.show({
        title: 'Hata',
        message: error instanceof Error ? error.message : 'Sıfırlama başarısız',
        color: 'red',
      });
    }
  };

  // Delete all documents
  const handleDeleteAllDocuments = async () => {
    if (!confirm('Bu ihaleye ait TÜM dökümanları silmek istediğinize emin misiniz?\n\nBu işlem geri alınamaz!')) {
      return;
    }
    
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/tender-content/${tenderId}/documents?deleteFromStorage=true`,
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
        fetchDocuments();
        onRefresh?.();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      notifications.show({
        title: 'Hata',
        message: error instanceof Error ? error.message : 'Silme başarısız',
        color: 'red',
      });
    }
  };

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
          <Button
            size="xs"
            variant="gradient"
            style={{ background: 'linear-gradient(135deg, #C9A227 0%, #D4AF37 50%, #E6C65C 100%)', border: 'none' }}
            leftSection={<IconFileText size={14} />}
            onClick={openWizard}
            fullWidth
          >
            Döküman Yönetimi
          </Button>

          {/* Document Actions */}
          <Group justify="space-between">
            <Group gap={4}>
              <Tooltip label="Dökümanları sıfırla (tekrar analiz için)">
                <ActionIcon 
                  variant="light" 
                  color="orange" 
                  size="sm" 
                  onClick={handleResetDocuments}
                  disabled={totalDocs === 0}
                >
                  <IconRefresh size={14} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Tüm dökümanları sil">
                <ActionIcon 
                  variant="light" 
                  color="red" 
                  size="sm" 
                  onClick={handleDeleteAllDocuments}
                  disabled={totalDocs === 0}
                >
                  <IconTrash size={14} />
                </ActionIcon>
              </Tooltip>
            </Group>
            <Tooltip label="Yenile">
              <ActionIcon variant="subtle" size="sm" onClick={fetchDocuments} loading={loading}>
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
