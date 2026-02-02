'use client';

import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Checkbox,
  Divider,
  Group,
  Loader,
  Modal,
  Paper,
  Progress,
  ScrollArea,
  Stack,
  Stepper,
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
  IconEye,
  IconFile,
  IconFileText,
  IconRefresh,
  IconTrash,
  IconWorld,
  IconX,
} from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';
import { API_BASE_URL } from '@/lib/config';
import { tendersAPI } from '@/lib/api/services/tenders';

// ========== TYPES ==========

interface DocumentWizardModalProps {
  opened: boolean;
  onClose: () => void;
  tenderId: number;
  tenderTitle?: string;
  onComplete?: () => void;
}

interface DocumentItem {
  id: number;
  original_filename: string;
  file_type: string;
  doc_type: string;
  source_type: 'content' | 'download' | 'upload';
  processing_status: 'pending' | 'processing' | 'completed' | 'failed';
  storage_url?: string;
  extracted_text?: string;
  content_text?: string;
}

interface StepStatus {
  status: 'idle' | 'loading' | 'success' | 'error';
  message?: string;
}

// ========== HELPERS ==========

const DOC_TYPE_LABELS: Record<string, string> = {
  admin_spec: 'İdari Şartname',
  tech_spec: 'Teknik Şartname',
  announcement: 'İhale İlanı',
  goods_services: 'Mal/Hizmet Listesi',
  zeyilname: 'Zeyilname',
  contract: 'Sözleşme Tasarısı',
  unit_price: 'Birim Fiyat Cetveli',
  other: 'Diğer',
};

const getDocTypeLabel = (docType: string) => DOC_TYPE_LABELS[docType] || docType;

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

// ========== COMPONENT ==========

export function DocumentWizardModal({
  opened,
  onClose,
  tenderId,
  tenderTitle,
  onComplete,
}: DocumentWizardModalProps) {
  // Wizard state
  const [activeStep, setActiveStep] = useState(0);
  
  // Documents
  const [contentDocs, setContentDocs] = useState<DocumentItem[]>([]);
  const [downloadDocs, setDownloadDocs] = useState<DocumentItem[]>([]);
  const [selectedForAnalysis, setSelectedForAnalysis] = useState<Set<number>>(new Set());
  
  // Step statuses
  const [step1Status, setStep1Status] = useState<StepStatus>({ status: 'idle' });
  const [step2Status, setStep2Status] = useState<StepStatus>({ status: 'idle' });
  const [step3Status, setStep3Status] = useState<StepStatus>({ status: 'idle' });
  
  // Analysis progress
  const [analysisProgress, setAnalysisProgress] = useState<{
    current: number;
    total: number;
    currentDoc?: string;
  } | null>(null);
  
  // Preview
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState<{ title: string; content: string } | null>(null);

  // ========== FETCH ALL DOCUMENTS ==========
  
  const fetchAllDocuments = useCallback(async () => {
    try {
      // Fetch content documents
      const contentResult = await tendersAPI.getTenderContentDocuments(tenderId);
      if (contentResult.success && contentResult.data) {
        // Handle both array and object response
        const contentData = Array.isArray(contentResult.data) 
          ? contentResult.data 
          : contentResult.data.documents || [];
        setContentDocs(contentData.map((d: DocumentItem) => ({ ...d, source_type: 'content' as const })));
      }
      
      // Fetch downloaded documents
      const downloadResult = await tendersAPI.getDownloadedDocuments(tenderId);
      if (downloadResult.success && downloadResult.data?.documents) {
        const docs: DocumentItem[] = downloadResult.data.documents.flatMap(
          (group: { files?: DocumentItem[]; doc_type?: string } & DocumentItem) => {
            // Handle both grouped and flat response
            if (group.files && Array.isArray(group.files)) {
              return group.files.map((file: DocumentItem) => ({
                ...file,
                source_type: 'download' as const,
              }));
            }
            // Single document format
            return [{
              ...group,
              source_type: 'download' as const,
            }];
          }
        );
        setDownloadDocs(docs);
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
    }
  }, [tenderId]);

  // Initial fetch
  useEffect(() => {
    if (opened && tenderId) {
      fetchAllDocuments();
    }
  }, [opened, tenderId, fetchAllDocuments]);

  // Reset when modal closes
  useEffect(() => {
    if (!opened) {
      setActiveStep(0);
      setStep1Status({ status: 'idle' });
      setStep2Status({ status: 'idle' });
      setStep3Status({ status: 'idle' });
      setSelectedForAnalysis(new Set());
      setAnalysisProgress(null);
    }
  }, [opened]);

  // ========== STEP 2: DOWNLOAD DOCUMENTS ==========
  
  const handleDownloadDocuments = async () => {
    setStep2Status({ status: 'loading', message: 'Site içerikleri çekiliyor...' });
    
    try {
      // 1. Önce scraper ile site içeriklerini çek (ihale ilanı, mal/hizmet listesi)
      const scrapeResult = await fetch(`${API_BASE_URL}/api/scraper/fetch-documents/${tenderId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      
      const scrapeData = await scrapeResult.json();
      
      if (scrapeData.success) {
        // Site içeriklerini documents tablosuna kaydet
        const contentResult = await tendersAPI.createContentDocuments(tenderId);
        console.log('[DocumentWizard] createContentDocuments result:', contentResult);
        
        if (contentResult.data?.errors?.length > 0) {
          console.warn('[DocumentWizard] Content creation errors:', contentResult.data.errors);
        }
      } else {
        console.warn('[DocumentWizard] Scraper failed:', scrapeData.error);
      }
      
      setStep2Status({ status: 'loading', message: 'Dökümanlar indiriliyor...' });
      
      // 2. Sonra dökümanları indir
      const result = await tendersAPI.downloadTenderDocuments(tenderId);
      
      if (result.success) {
        const downloadedCount = result.data?.totalDownloaded || 0;
        setStep2Status({ 
          status: 'success', 
          message: `${downloadedCount} döküman indirildi` 
        });
        
        // Refresh documents
        await fetchAllDocuments();
        
        notifications.show({
          title: 'İndirme Tamamlandı',
          message: `${downloadedCount} döküman başarıyla indirildi`,
          color: 'green',
        });
      } else {
        throw new Error(result.error || 'Bilinmeyen hata');
      }
    } catch (error: unknown) {
      console.error('Download error:', error);
      setStep2Status({ 
        status: 'error', 
        message: error instanceof Error ? error.message : 'Dökümanlar indirilemedi' 
      });
      
      notifications.show({
        title: 'Hata',
        message: 'Dökümanlar indirilemedi',
        color: 'red',
      });
    }
  };

  // ========== STEP 3: ANALYZE ==========
  
  const handleAnalyze = async () => {
    console.log('[DocumentWizard] handleAnalyze called');
    console.log('[DocumentWizard] selectedForAnalysis:', selectedForAnalysis.size, Array.from(selectedForAnalysis));
    console.log('[DocumentWizard] contentDocs:', contentDocs.length, contentDocs.map(d => ({ id: d.id, status: d.processing_status })));
    console.log('[DocumentWizard] downloadDocs:', downloadDocs.length, downloadDocs.map(d => ({ id: d.id, status: d.processing_status })));
    
    // Get pending documents
    const allDocs = [...contentDocs, ...downloadDocs];
    const docsToAnalyze = selectedForAnalysis.size > 0
      ? allDocs.filter(d => selectedForAnalysis.has(d.id))
      : allDocs.filter(d => d.processing_status === 'pending' || d.processing_status === 'failed');
    
    if (docsToAnalyze.length === 0) {
      notifications.show({
        title: 'Uyarı',
        message: 'Analiz edilecek döküman bulunamadı',
        color: 'yellow',
      });
      return;
    }
    
    setStep3Status({ status: 'loading', message: 'Analiz başlatılıyor...' });
    setAnalysisProgress({ current: 0, total: docsToAnalyze.length });
    
    // Timeout controller (10 dakika - büyük dokümanlar için)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 600000); // 10 dakika
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/tender-content/analyze-batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        signal: controller.signal,
        body: JSON.stringify({
          documentIds: docsToAnalyze.map(d => d.id),
        }),
      });
      
      clearTimeout(timeoutId); // Başarılı bağlantı, timeout'u iptal et
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      // Handle streaming response
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Stream not available');
      }
      
      const decoder = new TextDecoder();
      let completed = 0;
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const text = decoder.decode(value);
        const lines = text.split('\n').filter(line => line.startsWith('data: '));
        
        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6));
            
            // Backend 'stage' kullanıyor
            if (data.stage === 'processing') {
              // Her döküman için progress
              setAnalysisProgress({
                current: data.current || completed,
                total: data.total || docsToAnalyze.length,
                currentDoc: data.message,
              });
            } else if (data.stage === 'progress') {
              // Analiz ilerlemesi
              setAnalysisProgress(prev => prev ? { 
                ...prev, 
                currentDoc: data.message || prev.currentDoc 
              } : null);
            } else if (data.stage === 'complete' && data.summary) {
              // Final event - summary ile
              completed = data.summary.success || 0;
              setStep3Status({ 
                status: 'success', 
                message: `${completed} döküman analiz edildi` 
              });
            } else if (data.stage === 'error') {
              console.error('Analysis error:', data.message);
            }
          } catch {
            // Ignore parse errors
          }
        }
      }
      
      // Refresh documents after analysis
      await fetchAllDocuments();
      
      notifications.show({
        title: 'Analiz Tamamlandı',
        message: `${completed} döküman başarıyla analiz edildi`,
        color: 'green',
      });
      
      // Call onComplete
      onComplete?.();
      
    } catch (error: unknown) {
      console.error('Analysis error:', error);
      
      // Timeout veya abort hatası kontrolü
      const isAbortError = error instanceof Error && error.name === 'AbortError';
      const errorMessage = isAbortError 
        ? 'İşlem zaman aşımına uğradı (10 dakika). Daha az döküman seçip tekrar deneyin.'
        : (error instanceof Error ? error.message : 'Analiz başarısız');
      
      setStep3Status({ 
        status: 'error', 
        message: errorMessage
      });
      
      notifications.show({
        title: isAbortError ? 'Zaman Aşımı' : 'Hata',
        message: errorMessage,
        color: 'red',
      });
    } finally {
      clearTimeout(timeoutId); // Cleanup timeout
      setAnalysisProgress(null);
    }
  };

  // ========== RESET DOCUMENTS ==========
  
  const handleResetDocuments = async () => {
    const allDocs = [...contentDocs, ...downloadDocs];
    const docsToReset = selectedForAnalysis.size > 0
      ? allDocs.filter(d => selectedForAnalysis.has(d.id))
      : allDocs.filter(d => d.processing_status === 'completed' || d.processing_status === 'failed');
    
    if (docsToReset.length === 0) {
      notifications.show({
        title: 'Uyarı',
        message: 'Sıfırlanacak döküman bulunamadı',
        color: 'yellow',
      });
      return;
    }
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/tender-content/documents/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ documentIds: docsToReset.map(d => d.id) }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        notifications.show({
          title: 'Başarılı',
          message: `${data.resetCount} döküman sıfırlandı`,
          color: 'green',
        });
        await fetchAllDocuments();
        setSelectedForAnalysis(new Set());
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

  // ========== DELETE ALL DOCUMENTS ==========
  
  const handleDeleteAllDocuments = async () => {
    if (!confirm(`Bu ihaleye ait TÜM dökümanları silmek istediğinize emin misiniz?\n\nBu işlem geri alınamaz!`)) {
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
        await fetchAllDocuments();
        setSelectedForAnalysis(new Set());
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

  // ========== PREVIEW ==========
  
  const handlePreview = (doc: DocumentItem) => {
    const content = doc.extracted_text || doc.content_text || '';
    if (content) {
      setPreviewContent({
        title: doc.original_filename || getDocTypeLabel(doc.doc_type),
        content,
      });
      setPreviewOpen(true);
    }
  };

  // ========== SELECTION ==========
  
  const toggleDocSelection = (docId: number) => {
    setSelectedForAnalysis(prev => {
      const next = new Set(prev);
      if (next.has(docId)) {
        next.delete(docId);
      } else {
        next.add(docId);
      }
      return next;
    });
  };
  
  const selectAllPending = () => {
    const allDocs = [...contentDocs, ...downloadDocs];
    const pendingIds = allDocs
      .filter(d => 
        (d.processing_status === 'pending' || d.processing_status === 'failed') &&
        d.file_type !== 'zip' && d.file_type !== '.zip' && 
        d.file_type !== 'rar' && d.file_type !== '.rar'
      )
      .map(d => d.id);
    setSelectedForAnalysis(new Set(pendingIds));
  };

  // ========== RENDER HELPERS ==========
  
  const renderDocumentList = (docs: DocumentItem[], showCheckbox = false) => {
    if (docs.length === 0) {
      return (
        <Text size="sm" c="dimmed" ta="center" py="md">
          Döküman bulunamadı
        </Text>
      );
    }
    
    return (
      <Stack gap={4}>
        {docs.map(doc => (
          <Paper key={doc.id} p="xs" withBorder radius="sm">
            <Group justify="space-between" wrap="nowrap">
              <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                {showCheckbox && (
                  <Checkbox
                    size="xs"
                    checked={selectedForAnalysis.has(doc.id)}
                    onChange={() => toggleDocSelection(doc.id)}
                    disabled={
                      doc.processing_status === 'completed' ||
                      doc.file_type === 'zip' || doc.file_type === '.zip' ||
                      doc.file_type === 'rar' || doc.file_type === '.rar'
                    }
                  />
                )}
                <ThemeIcon
                  size="sm"
                  variant="light"
                  color={
                    doc.processing_status === 'completed'
                      ? 'green'
                      : doc.processing_status === 'failed'
                        ? 'red'
                        : doc.processing_status === 'processing'
                          ? 'blue'
                          : 'gray'
                  }
                >
                  {doc.processing_status === 'completed' ? (
                    <IconCheck size={12} />
                  ) : doc.processing_status === 'failed' ? (
                    <IconX size={12} />
                  ) : doc.processing_status === 'processing' ? (
                    <Loader size={12} />
                  ) : (
                    <IconFile size={12} />
                  )}
                </ThemeIcon>
                <Box style={{ minWidth: 0, flex: 1 }}>
                  <Text size="xs" fw={500} truncate>
                    {doc.original_filename || getDocTypeLabel(doc.doc_type)}
                  </Text>
                  <Group gap={4}>
                    <Badge size="xs" variant="dot" color={doc.source_type === 'content' ? 'cyan' : 'blue'}>
                      {doc.source_type === 'content' ? 'İÇERİK' : doc.file_type?.toUpperCase() || 'PDF'}
                    </Badge>
                    {getStatusBadge(doc.processing_status)}
                  </Group>
                </Box>
              </Group>
              <Group gap={4}>
                {(doc.source_type === 'content' || doc.extracted_text) && (
                  <Tooltip label="Önizle">
                    <ActionIcon size="sm" variant="subtle" onClick={() => handlePreview(doc)}>
                      <IconEye size={14} />
                    </ActionIcon>
                  </Tooltip>
                )}
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
            </Group>
          </Paper>
        ))}
      </Stack>
    );
  };

  const getStepIcon = (stepStatus: StepStatus, defaultIcon: React.ReactNode) => {
    if (stepStatus.status === 'loading') return <Loader size={18} />;
    if (stepStatus.status === 'success') return <IconCheck size={18} />;
    if (stepStatus.status === 'error') return <IconX size={18} />;
    return defaultIcon;
  };

  const getStepColor = (stepStatus: StepStatus) => {
    if (stepStatus.status === 'success') return 'green';
    if (stepStatus.status === 'error') return 'red';
    if (stepStatus.status === 'loading') return 'blue';
    return 'gray';
  };

  // Counts - ZIP/RAR dosyalarını hariç tut (analiz edilemez)
  const isArchive = (d: DocumentItem) => 
    d.file_type === 'zip' || d.file_type === '.zip' || 
    d.file_type === 'rar' || d.file_type === '.rar';
  
  const allDocs = [...contentDocs, ...downloadDocs];
  const analyzableDocs = allDocs.filter(d => !isArchive(d));
  
  const totalDocs = analyzableDocs.length;
  const completedDocs = analyzableDocs.filter(d => d.processing_status === 'completed').length;
  const pendingDocs = analyzableDocs.filter(d => d.processing_status === 'pending' || d.processing_status === 'failed').length;

  // Debug log kaldırıldı - spam yapıyordu

  return (
    <>
      <Modal
        opened={opened}
        onClose={onClose}
        title={
          <Group gap="xs">
            <IconFileText size={20} />
            <Text fw={600}>Döküman Yönetimi</Text>
            {tenderTitle && (
              <Text size="sm" c="dimmed" truncate style={{ maxWidth: 300 }}>
                - {tenderTitle}
              </Text>
            )}
          </Group>
        }
        size="xl"
        centered
      >
        <Stack gap="lg">
          {/* Summary */}
          <Paper p="sm" withBorder radius="md" bg="dark.6">
            <Group justify="space-around">
              <Box ta="center">
                <Text size="xl" fw={700} c="cyan">{contentDocs.length}</Text>
                <Text size="xs" c="dimmed">Site İçeriği</Text>
              </Box>
              <Divider orientation="vertical" />
              <Box ta="center">
                <Text size="xl" fw={700} c="blue">{downloadDocs.length}</Text>
                <Text size="xs" c="dimmed">İndirilen</Text>
              </Box>
              <Divider orientation="vertical" />
              <Box ta="center">
                <Text size="xl" fw={700} c="green">{completedDocs}</Text>
                <Text size="xs" c="dimmed">Analiz Edildi</Text>
              </Box>
              <Divider orientation="vertical" />
              <Box ta="center">
                <Text size="xl" fw={700} c="yellow">{pendingDocs}</Text>
                <Text size="xs" c="dimmed">Bekliyor</Text>
              </Box>
            </Group>
          </Paper>

          {/* Stepper */}
          <Stepper 
            active={activeStep} 
            onStepClick={setActiveStep}
            size="sm"
            allowNextStepsSelect={false}
          >
            {/* Step 1: View Content */}
            <Stepper.Step
              label="Site İçeriği"
              description="İlan ve mal/hizmet listesi"
              icon={getStepIcon(step1Status, <IconWorld size={18} />)}
              color={contentDocs.length > 0 ? 'green' : 'gray'}
              completedIcon={<IconCheck size={18} />}
            >
              <Stack gap="md" mt="md">
                {contentDocs.length > 0 ? (
                  <>
                    <Paper p="md" withBorder radius="md" bg="dark.6">
                      <Group gap="xs">
                        <ThemeIcon size="lg" variant="light" color="green" radius="xl">
                          <IconCheck size={18} />
                        </ThemeIcon>
                        <Box>
                          <Text size="sm" fw={500}>{contentDocs.length} Site İçeriği Mevcut</Text>
                          <Text size="xs" c="dimmed">
                            İhale ilanı ve mal/hizmet listesi hazır
                          </Text>
                        </Box>
                      </Group>
                    </Paper>

                    <Box>
                      <Text size="sm" fw={500} mb="xs">İçerik Dökümanları ({contentDocs.length})</Text>
                      <ScrollArea.Autosize mah={200}>
                        {renderDocumentList(contentDocs)}
                      </ScrollArea.Autosize>
                    </Box>
                  </>
                ) : (
                  <Paper p="md" withBorder radius="md" bg="dark.6">
                    <Group gap="xs">
                      <ThemeIcon size="lg" variant="light" color="yellow" radius="xl">
                        <IconWorld size={18} />
                      </ThemeIcon>
                      <Box>
                        <Text size="sm" fw={500}>Site İçeriği Yok</Text>
                        <Text size="xs" c="dimmed">
                          Dökümanları indirdiğinizde site içerikleri otomatik çekilecek
                        </Text>
                      </Box>
                    </Group>
                  </Paper>
                )}

                <Group justify="flex-end">
                  <Button 
                    variant="light"
                    onClick={() => setActiveStep(1)}
                  >
                    Sonraki Adım
                  </Button>
                </Group>
              </Stack>
            </Stepper.Step>

            {/* Step 2: Download Documents */}
            <Stepper.Step
              label="Dökümanları İndir"
              description="PDF ve diğer dosyalar"
              icon={getStepIcon(step2Status, <IconCloudDownload size={18} />)}
              color={getStepColor(step2Status)}
              loading={step2Status.status === 'loading'}
            >
              <Stack gap="md" mt="md">
                <Paper p="md" withBorder radius="md">
                  <Stack gap="sm">
                    <Group justify="space-between">
                      <Box>
                        <Text size="sm" fw={500}>EKAP Dökümanlarını İndir</Text>
                        <Text size="xs" c="dimmed">
                          Şartnameler, sözleşme ve diğer dosyalar indirilir
                        </Text>
                      </Box>
                      <Button
                        size="sm"
                        variant="light"
                        leftSection={<IconCloudDownload size={16} />}
                        onClick={handleDownloadDocuments}
                        loading={step2Status.status === 'loading'}
                        disabled={step2Status.status === 'success'}
                      >
                        {step2Status.status === 'success' ? 'Tamamlandı' : 'Dökümanları İndir'}
                      </Button>
                    </Group>
                    
                    {step2Status.message && (
                      <Text 
                        size="xs" 
                        c={step2Status.status === 'error' ? 'red' : step2Status.status === 'success' ? 'green' : 'dimmed'}
                      >
                        {step2Status.message}
                      </Text>
                    )}
                  </Stack>
                </Paper>

                {/* Downloaded Documents */}
                {downloadDocs.length > 0 && (
                  <Box>
                    <Text size="sm" fw={500} mb="xs">İndirilen Dökümanlar ({downloadDocs.length})</Text>
                    <ScrollArea.Autosize mah={200}>
                      {renderDocumentList(downloadDocs)}
                    </ScrollArea.Autosize>
                  </Box>
                )}

                <Group justify="space-between">
                  <Button variant="subtle" onClick={() => setActiveStep(0)}>
                    Geri
                  </Button>
                  <Button 
                    variant="light"
                    onClick={() => setActiveStep(2)}
                    disabled={step2Status.status === 'loading'}
                  >
                    Sonraki Adım
                  </Button>
                </Group>
              </Stack>
            </Stepper.Step>

            {/* Step 3: Analyze */}
            <Stepper.Step
              label="AI Analizi"
              description="Dökümanları analiz et"
              icon={getStepIcon(step3Status, <IconBrain size={18} />)}
              color={getStepColor(step3Status)}
              loading={step3Status.status === 'loading'}
            >
              <Stack gap="md" mt="md">
                <Paper p="md" withBorder radius="md">
                  <Stack gap="sm">
                    <Group justify="space-between">
                      <Box>
                        <Text size="sm" fw={500}>AI ile Döküman Analizi</Text>
                        <Text size="xs" c="dimmed">
                          Teknik şartlar ve birim fiyatlar otomatik çıkarılır
                        </Text>
                      </Box>
                      <Group gap="xs">
                        <Button
                          size="xs"
                          variant="subtle"
                          onClick={selectAllPending}
                          disabled={pendingDocs === 0}
                        >
                          Tümünü Seç ({pendingDocs})
                        </Button>
                        <Button
                          size="sm"
                          variant="gradient"
                          style={{ background: 'linear-gradient(135deg, #C9A227 0%, #D4AF37 50%, #E6C65C 100%)', border: 'none' }}
                          leftSection={<IconBrain size={16} />}
                          onClick={handleAnalyze}
                          loading={step3Status.status === 'loading'}
                          disabled={pendingDocs === 0 && selectedForAnalysis.size === 0}
                        >
                          {step3Status.status === 'success' ? 'Tamamlandı' : 'Analiz Et'}
                        </Button>
                      </Group>
                    </Group>
                    
                    {/* Analysis Progress */}
                    {analysisProgress && (
                      <Box>
                        <Group justify="space-between" mb={4}>
                          <Text size="xs" c="dimmed">
                            {analysisProgress.currentDoc || 'Analiz ediliyor...'}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {analysisProgress.current}/{analysisProgress.total}
                          </Text>
                        </Group>
                        <Progress
                          value={(analysisProgress.current / analysisProgress.total) * 100}
                          size="sm"
                          animated
                        />
                      </Box>
                    )}
                    
                    {step3Status.message && (
                      <Text 
                        size="xs" 
                        c={step3Status.status === 'error' ? 'red' : step3Status.status === 'success' ? 'green' : 'dimmed'}
                      >
                        {step3Status.message}
                      </Text>
                    )}
                  </Stack>
                </Paper>

                {/* All Documents with Checkboxes */}
                <Box>
                  <Group justify="space-between" mb="xs">
                    <Text size="sm" fw={500}>Tüm Dökümanlar ({totalDocs})</Text>
                    <Group gap="xs">
                      <Tooltip label="Seçili veya tamamlanmış dökümanları sıfırla">
                        <Button
                          size="compact-xs"
                          variant="light"
                          color="orange"
                          leftSection={<IconRefresh size={12} />}
                          onClick={handleResetDocuments}
                          disabled={step3Status.status === 'loading' || totalDocs === 0}
                        >
                          Sıfırla
                        </Button>
                      </Tooltip>
                      <Tooltip label="Bu ihaleye ait TÜM dökümanları sil">
                        <Button
                          size="compact-xs"
                          variant="light"
                          color="red"
                          leftSection={<IconTrash size={12} />}
                          onClick={handleDeleteAllDocuments}
                          disabled={step3Status.status === 'loading' || totalDocs === 0}
                        >
                          Tümünü Sil
                        </Button>
                      </Tooltip>
                      <Tooltip label="Yenile">
                        <ActionIcon variant="subtle" size="sm" onClick={fetchAllDocuments}>
                          <IconRefresh size={14} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Group>
                  <ScrollArea.Autosize mah={250}>
                    {renderDocumentList([...contentDocs, ...downloadDocs], true)}
                  </ScrollArea.Autosize>
                </Box>

                <Group justify="space-between">
                  <Button variant="subtle" onClick={() => setActiveStep(1)}>
                    Geri
                  </Button>
                  <Button 
                    variant="filled"
                    onClick={onClose}
                  >
                    Kapat
                  </Button>
                </Group>
              </Stack>
            </Stepper.Step>
          </Stepper>
        </Stack>
      </Modal>

      {/* Preview Modal */}
      <Modal
        opened={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={previewContent?.title || 'Önizleme'}
        size="xl"
        centered
      >
        <ScrollArea h={500} type="always" offsetScrollbars>
          <Text size="sm" style={{ whiteSpace: 'pre-wrap', paddingRight: 12 }}>
            {previewContent?.content || 'İçerik yok'}
          </Text>
        </ScrollArea>
      </Modal>
    </>
  );
}
