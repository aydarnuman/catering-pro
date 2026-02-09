'use client';

import {
  Badge,
  Box,
  Button,
  Center,
  Divider,
  Group,
  Loader,
  Modal,
  Paper,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconBrain,
  IconCheck,
  IconClock,
  IconDatabase,
  IconFileUpload,
  IconRefresh,
  IconRotate,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';
import { tendersAPI } from '@/lib/api/services/tenders';
import { API_BASE_URL } from '@/lib/config';
import { DocumentWizardModal } from '../DocumentWizardModal';
import type { SavedTender } from '../types';

interface DocStats {
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
}

interface SettingsModalProps {
  opened: boolean;
  onClose: () => void;
  tender: SavedTender;
  onRefresh?: () => void;
}

export function SettingsModal({ opened, onClose, tender, onRefresh }: SettingsModalProps) {
  const [docStats, setDocStats] = useState<DocStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);

  // Döküman istatistiklerini çek
  const fetchDocStats = useCallback(async () => {
    setLoading(true);
    try {
      const response = await tendersAPI.getDownloadedDocuments(String(tender.tender_id));
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
      setLoading(false);
    }
  }, [tender.tender_id]);

  // Modal açıldığında istatistikleri çek
  useEffect(() => {
    if (opened) {
      fetchDocStats();
    }
  }, [opened, fetchDocStats]);

  // Döküman işlemleri
  const handleSyncAnalysis = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/tender-tracking/add-from-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tender_id: tender.tender_id }),
      });
      const data = await response.json();
      if (data.success) {
        notifications.show({
          title: 'Başarılı',
          message: 'Analiz özeti güncellendi',
          color: 'green',
        });
        onRefresh?.();
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
      setLoading(false);
    }
  };

  const handleResetDocuments = async () => {
    if (
      !confirm(
        'Tüm dökümanları sıfırlamak istediğinize emin misiniz?\n\nBu işlem dökümanları tekrar analiz edilebilir hale getirir.'
      )
    )
      return;

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/tender-content/documents/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tenderId: tender.tender_id }),
      });
      const data = await response.json();
      if (data.success) {
        notifications.show({
          title: 'Başarılı',
          message: `${data.resetCount} döküman sıfırlandı`,
          color: 'green',
        });
        fetchDocStats();
        onRefresh?.();
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
      setLoading(false);
    }
  };

  const handleClearAnalysis = async () => {
    if (
      !confirm(
        'Tüm analiz sonuçlarını temizlemek istediğinize emin misiniz?\n\nDökümanlar silinmez, sadece analizler sıfırlanır.'
      )
    )
      return;

    setLoading(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/tender-content/${tender.tender_id}/clear-analysis`,
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
        onRefresh?.();
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
      setLoading(false);
    }
  };

  const handleDeleteAllDocuments = async () => {
    if (
      !confirm(
        'Bu ihaleye ait TÜM dökümanları silmek istediğinize emin misiniz?\n\nBu işlem geri alınamaz!'
      )
    )
      return;

    setLoading(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/tender-content/${tender.tender_id}/documents?deleteFromStorage=true`,
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
        onClose();
        fetchDocStats();
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
    } finally {
      setLoading(false);
    }
  };

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
    const lower = (docType || filename || '').toLowerCase();
    if (lower.includes('teknik') || lower.includes('tech')) return 'Teknik Şartname';
    if (lower.includes('idari') || lower.includes('admin')) return 'İdari Şartname';
    if (lower.includes('sözleşme') || lower.includes('contract')) return 'Sözleşme Tasarısı';
    if (lower.includes('birim') || lower.includes('fiyat') || lower.includes('price'))
      return 'Birim Fiyat Cetveli';
    if (lower.includes('ilan')) return 'İhale İlanı';
    if (lower.includes('zeyil')) return 'Zeyilname';
    if (lower.includes('mal') || lower.includes('hizmet') || lower.includes('liste'))
      return 'Mal/Hizmet Listesi';
    return docType || filename?.split('.')[0] || 'Döküman';
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
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
          {loading && !docStats ? (
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
              {docStats.documents && docStats.documents.length > 0 && (
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
              )}
            </Stack>
          ) : (
            <Text size="sm" c="dimmed" ta="center">
              Henüz döküman yok
            </Text>
          )}
        </Paper>

        {/* Döküman Yönetimi Butonu */}
        <Button
          variant="gradient"
          gradient={{ from: 'orange', to: 'yellow' }}
          leftSection={<IconFileUpload size={16} />}
          onClick={() => setWizardOpen(true)}
          fullWidth
          size="md"
        >
          Döküman Yönetimi
        </Button>
        <Text size="xs" c="dimmed" mt={-8}>
          Döküman indirme, yükleme ve analiz işlemleri
        </Text>

        <Divider label="İşlemler" labelPosition="center" />

        {/* Senkronizasyon */}
        <Button
          variant="light"
          color="green"
          leftSection={<IconRotate size={16} />}
          onClick={handleSyncAnalysis}
          loading={loading}
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
          loading={loading}
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
          loading={loading}
          disabled={
            !docStats ||
            (docStats.completed === 0 &&
              tender.teknik_sart_sayisi === 0 &&
              tender.birim_fiyat_sayisi === 0)
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
          loading={loading}
          disabled={!docStats || docStats.total === 0}
          fullWidth
        >
          Tüm Dökümanları Sil
        </Button>
        <Text size="xs" c="red" mt={-8}>
          Bu işlem geri alınamaz! Tüm dökümanlar kalıcı olarak silinir.
        </Text>
      </Stack>

      {/* Döküman Wizard Modal */}
      <DocumentWizardModal
        opened={wizardOpen}
        onClose={() => setWizardOpen(false)}
        tenderId={tender.tender_id}
        tenderTitle={tender.ihale_basligi}
        onComplete={() => {
          fetchDocStats();
          onRefresh?.();
        }}
      />
    </Modal>
  );
}
