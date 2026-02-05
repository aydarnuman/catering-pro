'use client';

import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Checkbox,
  Divider,
  FileButton,
  Group,
  Loader,
  Modal,
  Paper,
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
  IconChevronRight,
  IconCloudDownload,
  IconDownload,
  IconEye,
  IconFile,
  IconFileText,
  IconRefresh,
  IconTrash,
  IconUpload,
  IconX,
} from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';

import { tendersAPI } from '@/lib/api/services/tenders';
import { API_BASE_URL } from '@/lib/config';
import { AnalysisProgressPanel } from './AnalysisProgressPanel';

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

// Detaylı döküman analiz progress tipi
export type PipelineStage =
  | 'pending'
  | 'extraction'
  | 'ocr'
  | 'chunking'
  | 'analysis'
  | 'completed'
  | 'error'
  | 'skipped';

export interface DocumentProgress {
  id: number;
  name: string;
  status: 'pending' | 'processing' | 'completed' | 'error' | 'skipped';
  stage?: PipelineStage;
  stageProgress?: number; // 0-100
  stageMessage?: string;
  chunks?: { current: number; total: number };
  error?: string;
  result?: {
    teknikSartlar?: number;
    birimFiyatlar?: number;
    ocrApplied?: boolean;
  };
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

// Helper: API'den gelen dökümanların özelliklerini al (snake_case veya camelCase)
type DocWithVariants = DocumentItem & { fileName?: string; filename?: string; fileType?: string };
const getDocFilename = (doc: DocWithVariants): string => {
  return doc.original_filename || doc.fileName || doc.filename || '';
};
const getDocFileType = (doc: DocWithVariants): string => {
  return doc.file_type || doc.fileType || '';
};

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

  // Step statuses (2 steps: Download, Analyze)
  const [step1Status, setStep1Status] = useState<StepStatus>({ status: 'idle' }); // Download
  const [step2Status, setStep2Status] = useState<StepStatus>({ status: 'idle' }); // Analyze

  // Analysis progress (basit - backward compat)
  const [analysisProgress, setAnalysisProgress] = useState<{
    current: number;
    total: number;
    currentDoc?: string;
  } | null>(null);

  // Detaylı döküman bazlı progress
  const [documentProgress, setDocumentProgress] = useState<Map<number, DocumentProgress>>(
    new Map()
  );
  const [analysisStartTime, setAnalysisStartTime] = useState<number | null>(null);

  // Preview
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState<{ title: string; content: string } | null>(
    null
  );

  // ========== FETCH ALL DOCUMENTS ==========

  const fetchAllDocuments = useCallback(async () => {
    // ZIP/RAR dosyalarını filtrele (analiz edilemez)
    const filterArchives = (docs: DocumentItem[]) => {
      return docs.filter((d) => {
        const ft = getDocFileType(d).toLowerCase();
        const fn = getDocFilename(d).toLowerCase();
        // Tüm olası ZIP/RAR formatlarını kontrol et
        const isArch =
          ft.includes('zip') || ft.includes('rar') || fn.endsWith('.zip') || fn.endsWith('.rar');
        if (isArch) {
          console.log('[DocumentWizard] Filtering out archive:', { id: d.id, fn, ft });
        }
        return !isArch;
      });
    };
    try {
      // Fetch content documents
      const contentResult = await tendersAPI.getTenderContentDocuments(tenderId);
      if (contentResult.success && contentResult.data) {
        // Handle both array and object response
        const contentData = Array.isArray(contentResult.data)
          ? contentResult.data
          : contentResult.data.documents || [];
        const mappedContent = contentData.map((d: DocumentItem) => ({
          ...d,
          source_type: 'content' as const,
        }));
        const filteredContent = filterArchives(mappedContent);
        console.log(
          '[DocumentWizard] Content docs before filter:',
          mappedContent.length,
          'after:',
          filteredContent.length
        );
        setContentDocs(filteredContent);
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
            return [
              {
                ...group,
                source_type: 'download' as const,
              },
            ];
          }
        );
        const filteredDownload = filterArchives(docs);
        console.log(
          '[DocumentWizard] Download docs before filter:',
          docs.length,
          'after:',
          filteredDownload.length
        );
        setDownloadDocs(filteredDownload);
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
      setStep1Status({ status: 'idle' }); // Download
      setStep2Status({ status: 'idle' }); // Analyze
      setSelectedForAnalysis(new Set());
      setAnalysisProgress(null);
      setDocumentProgress(new Map());
      setAnalysisStartTime(null);
    }
  }, [opened]);

  // ========== STEP 1: DOWNLOAD DOCUMENTS ==========

  const handleDownloadDocuments = async () => {
    setStep1Status({ status: 'loading', message: 'Site içerikleri çekiliyor...' });

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

      setStep1Status({ status: 'loading', message: 'Dökümanlar indiriliyor...' });

      // 2. Sonra dökümanları indir
      const result = await tendersAPI.downloadTenderDocuments(tenderId);

      if (result.success) {
        const downloadedCount = result.data?.totalDownloaded || 0;
        const skippedCount = result.data?.skipped?.length || 0;
        const successCount = result.data?.success?.length || 0;

        // Refresh documents first to get accurate count
        await fetchAllDocuments();

        // Build message
        let message = '';
        if (downloadedCount > 0) {
          message = `${downloadedCount} yeni döküman indirildi`;
        } else if (skippedCount > 0) {
          message = `Dökümanlar zaten mevcut (${skippedCount} dosya)`;
        } else if (successCount > 0) {
          message = `${successCount} döküman grubu işlendi`;
        } else {
          message = 'İşlem tamamlandı';
        }

        setStep1Status({
          status: 'success',
          message,
        });

        notifications.show({
          title: 'İndirme Tamamlandı',
          message:
            downloadedCount > 0
              ? `${downloadedCount} döküman başarıyla indirildi`
              : 'Dökümanlar zaten mevcut',
          color: 'green',
        });
      } else {
        throw new Error(result.error || 'Bilinmeyen hata');
      }
    } catch (error: unknown) {
      console.error('Download error:', error);
      setStep1Status({
        status: 'error',
        message: error instanceof Error ? error.message : 'Dökümanlar indirilemedi',
      });

      notifications.show({
        title: 'Hata',
        message: 'Dökümanlar indirilemedi',
        color: 'red',
      });
    }
  };

  // ========== MANUAL UPLOAD ==========

  const [uploading, setUploading] = useState(false);

  const handleManualUpload = async (files: File[]) => {
    if (!files || files.length === 0) return;

    setUploading(true);
    let successCount = 0;
    let errorCount = 0;

    for (const file of files) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('tender_id', tenderId.toString());

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
      await fetchAllDocuments();
    } else {
      notifications.show({
        title: 'Hata',
        message: 'Dosyalar yüklenemedi',
        color: 'red',
      });
    }
  };

  // ========== STEP 2: ANALYZE ==========

  const handleAnalyze = async () => {
    console.log('[DocumentWizard] handleAnalyze called');

    // Get pending documents (sadece indirilen dökümanlar)
    const docsToAnalyze =
      selectedForAnalysis.size > 0
        ? downloadDocs.filter((d) => selectedForAnalysis.has(d.id))
        : downloadDocs.filter(
            (d) => d.processing_status === 'pending' || d.processing_status === 'failed'
          );

    if (docsToAnalyze.length === 0) {
      notifications.show({
        title: 'Uyarı',
        message: 'Analiz edilecek döküman bulunamadı',
        color: 'yellow',
      });
      return;
    }

    setStep2Status({ status: 'loading', message: 'Analiz başlatılıyor...' });
    setAnalysisProgress({ current: 0, total: docsToAnalyze.length });
    setAnalysisStartTime(Date.now());

    // Initialize document progress map
    const initialProgress = new Map<number, DocumentProgress>();
    docsToAnalyze.forEach((doc) => {
      initialProgress.set(doc.id, {
        id: doc.id,
        name: getDocFilename(doc) || getDocTypeLabel(doc.doc_type),
        status: 'pending',
        stage: 'pending',
      });
    });
    setDocumentProgress(initialProgress);

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
          documentIds: docsToAnalyze.map((d) => d.id),
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
        const lines = text.split('\n').filter((line) => line.startsWith('data: '));

        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6));

            // Backend 'stage' kullanıyor
            if (data.stage === 'processing') {
              // Her döküman için progress - başlangıç
              completed = data.current || completed;
              setAnalysisProgress({
                current: data.current || completed,
                total: data.total || docsToAnalyze.length,
                currentDoc: data.message,
              });

              // Detaylı döküman progress güncelle
              if (data.documentId) {
                setDocumentProgress((prev) => {
                  const updated = new Map(prev);
                  const current = updated.get(data.documentId);
                  if (current) {
                    updated.set(data.documentId, {
                      ...current,
                      status: 'processing',
                      stage: 'extraction',
                      stageMessage: 'Döküman okunuyor...',
                    });
                  }
                  return updated;
                });
              }
            } else if (data.stage === 'progress') {
              // Analiz ilerlemesi - detaylı pipeline aşaması
              setAnalysisProgress((prev) =>
                prev
                  ? {
                      ...prev,
                      currentDoc: data.message || prev.currentDoc,
                    }
                  : null
              );

              // Detaylı döküman progress güncelle
              if (data.documentId) {
                setDocumentProgress((prev) => {
                  const updated = new Map(prev);
                  const current = updated.get(data.documentId);
                  if (current) {
                    // Pipeline stage belirleme
                    let pipelineStage: PipelineStage = current.stage || 'extraction';
                    if (data.pipelineStage) {
                      pipelineStage = data.pipelineStage as PipelineStage;
                    } else if (data.stage === 'extraction' || data.message?.includes('okunuyor')) {
                      pipelineStage = 'extraction';
                    } else if (data.stage === 'ocr' || data.message?.includes('OCR')) {
                      pipelineStage = 'ocr';
                    } else if (data.stage === 'chunking' || data.message?.includes('bölüm')) {
                      pipelineStage = 'chunking';
                    } else if (
                      data.stage === 'analysis' ||
                      data.message?.includes('analiz') ||
                      data.message?.includes('Chunk')
                    ) {
                      pipelineStage = 'analysis';
                    }

                    updated.set(data.documentId, {
                      ...current,
                      stage: pipelineStage,
                      stageProgress: data.progress,
                      stageMessage: data.message,
                      chunks: data.chunks || current.chunks,
                    });
                  }
                  return updated;
                });
              }
            } else if (data.stage === 'skipped') {
              // Döküman atlandı (cache)
              if (data.documentId) {
                setDocumentProgress((prev) => {
                  const updated = new Map(prev);
                  const current = updated.get(data.documentId);
                  if (current) {
                    updated.set(data.documentId, {
                      ...current,
                      status: 'skipped',
                      stage: 'skipped',
                      stageMessage: data.message || 'Zaten analiz edilmiş',
                    });
                  }
                  return updated;
                });
              }
            } else if (data.stage === 'complete' && data.summary) {
              // Final event - summary ile
              completed = data.summary.success || 0;
              setStep2Status({
                status: 'success',
                message: `${completed} döküman analiz edildi`,
              });

              // Tüm dökümanları tamamlandı olarak işaretle
              if (data.results) {
                setDocumentProgress((prev) => {
                  const updated = new Map(prev);
                  for (const result of data.results) {
                    const current = updated.get(result.id);
                    if (current) {
                      updated.set(result.id, {
                        ...current,
                        status: result.success
                          ? result.skipped
                            ? 'skipped'
                            : 'completed'
                          : 'error',
                        stage: result.success ? 'completed' : 'error',
                        stageMessage: result.success
                          ? result.skipped
                            ? 'Atlandı'
                            : 'Analiz tamamlandı'
                          : result.error,
                        error: result.error,
                        result: result.analysis
                          ? {
                              teknikSartlar: result.analysis.teknik_sartlar?.length || 0,
                              birimFiyatlar: result.analysis.birim_fiyatlar?.length || 0,
                              ocrApplied: result.analysis.meta?.ocrApplied,
                            }
                          : undefined,
                      });
                    }
                  }
                  return updated;
                });
              }
            } else if (data.stage === 'error') {
              console.error('Analysis error:', data.message);

              if (data.documentId) {
                setDocumentProgress((prev) => {
                  const updated = new Map(prev);
                  const current = updated.get(data.documentId);
                  if (current) {
                    updated.set(data.documentId, {
                      ...current,
                      status: 'error',
                      stage: 'error',
                      stageMessage: data.message,
                      error: data.message,
                    });
                  }
                  return updated;
                });
              }
            }
          } catch {
            // Ignore parse errors
          }
        }
      }

      // Refresh documents after analysis
      await fetchAllDocuments();

      // Sync analysis summary to tender tracking
      try {
        await fetch(`${API_BASE_URL}/api/tender-tracking/add-from-analysis`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ tender_id: tenderId }),
        });
        console.log('[DocumentWizard] Analysis summary synced to tender');
      } catch (syncError) {
        console.error('[DocumentWizard] Failed to sync analysis summary:', syncError);
      }

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
        : error instanceof Error
          ? error.message
          : 'Analiz başarısız';

      setStep2Status({
        status: 'error',
        message: errorMessage,
      });

      notifications.show({
        title: isAbortError ? 'Zaman Aşımı' : 'Hata',
        message: errorMessage,
        color: 'red',
      });
    } finally {
      clearTimeout(timeoutId); // Cleanup timeout
      setAnalysisProgress(null);
      setAnalysisStartTime(null);
      // Analiz bitince documentProgress'i temizle - döküman listesi görünsün
      setDocumentProgress(new Map());
    }
  };

  // ========== RESET DOCUMENTS ==========

  const handleResetDocuments = async () => {
    // Sadece indirilen dökümanlar
    const docsToReset =
      selectedForAnalysis.size > 0
        ? downloadDocs.filter((d) => selectedForAnalysis.has(d.id))
        : downloadDocs.filter(
            (d) => d.processing_status === 'completed' || d.processing_status === 'failed'
          );

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
        body: JSON.stringify({ documentIds: docsToReset.map((d) => d.id) }),
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
    if (
      !confirm(
        'Bu ihaleye ait TÜM dökümanları silmek istediğinize emin misiniz?\n\nBu işlem geri alınamaz!'
      )
    ) {
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
        title: getDocFilename(doc) || getDocTypeLabel(doc.doc_type),
        content,
      });
      setPreviewOpen(true);
    }
  };

  // ========== SELECTION ==========

  const toggleDocSelection = (docId: number) => {
    setSelectedForAnalysis((prev) => {
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
    // ZIP/RAR zaten fetchAllDocuments'ta filtrelendi, sadece indirilen dökümanlar
    const pendingIds = downloadDocs
      .filter((d) => d.processing_status === 'pending' || d.processing_status === 'failed')
      .map((d) => d.id);
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
        {docs.map((doc, index) => (
          <Paper key={`${doc.source_type}-${doc.id}-${index}`} p="xs" withBorder radius="sm">
            <Group justify="space-between" wrap="nowrap">
              <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                {showCheckbox && (
                  <Checkbox
                    size="xs"
                    checked={selectedForAnalysis.has(doc.id)}
                    onChange={() => toggleDocSelection(doc.id)}
                    disabled={doc.processing_status === 'completed'}
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
                  <Group gap={6} wrap="nowrap">
                    <Text size="xs" fw={500} truncate style={{ flex: 1 }}>
                      {getDocFilename(doc) || getDocTypeLabel(doc.doc_type)}
                    </Text>
                    {doc.storage_url && (
                      <IconCheck
                        size={14}
                        style={{
                          color: 'var(--mantine-color-green-5)',
                          flexShrink: 0,
                          opacity: 0.7,
                        }}
                      />
                    )}
                  </Group>
                  <Group gap={4}>
                    <Badge
                      size="xs"
                      variant="dot"
                      color={doc.source_type === 'content' ? 'cyan' : 'blue'}
                    >
                      {doc.source_type === 'content'
                        ? 'İÇERİK'
                        : getDocFileType(doc).toUpperCase() || 'PDF'}
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

  // Sadece indirilen dökümanlar (ZIP/RAR zaten fetchAllDocuments'ta filtrelendi)
  const totalDocs = downloadDocs.length;
  const completedDocs = downloadDocs.filter((d) => d.processing_status === 'completed').length;
  const pendingDocs = downloadDocs.filter(
    (d) => d.processing_status === 'pending' || d.processing_status === 'failed'
  ).length;

  // Debug log kaldırıldı - spam yapıyordu

  return (
    <>
      <style jsx global>{`
        @keyframes loadingPulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
      `}</style>
      <Modal
        opened={opened}
        onClose={onClose}
        closeOnClickOutside={false}
        closeOnEscape={false}
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
                <Text size="xl" fw={700} c="cyan">
                  {contentDocs.length}
                </Text>
                <Text size="xs" c="dimmed">
                  Site İçeriği
                </Text>
              </Box>
              <Divider orientation="vertical" />
              <Box ta="center">
                <Text size="xl" fw={700} c="blue">
                  {downloadDocs.length}
                </Text>
                <Text size="xs" c="dimmed">
                  İndirilen
                </Text>
              </Box>
              <Divider orientation="vertical" />
              <Box ta="center">
                <Text size="xl" fw={700} c="green">
                  {completedDocs}
                </Text>
                <Text size="xs" c="dimmed">
                  Analiz Edildi
                </Text>
              </Box>
              <Divider orientation="vertical" />
              <Box ta="center">
                <Text size="xl" fw={700} c="yellow">
                  {pendingDocs}
                </Text>
                <Text size="xs" c="dimmed">
                  Bekliyor
                </Text>
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
            {/* Step 1: Download Documents */}
            <Stepper.Step
              label="Dökümanları İndir"
              description="PDF ve diğer dosyalar"
              icon={getStepIcon(step1Status, <IconCloudDownload size={18} />)}
              color={getStepColor(step1Status)}
              loading={step1Status.status === 'loading'}
            >
              <Stack gap="md" mt="md">
                <Paper p="md" withBorder radius="md">
                  <Stack gap="sm">
                    <Group justify="space-between">
                      <Box>
                        <Text size="sm" fw={500}>
                          EKAP Dökümanlarını İndir
                        </Text>
                        <Text size="xs" c="dimmed">
                          Şartnameler, sözleşme ve diğer dosyalar indirilir
                        </Text>
                      </Box>
                      <Tooltip
                        label={
                          step1Status.status === 'success' ? 'Tamamlandı' : 'Dökümanları İndir'
                        }
                      >
                        <ActionIcon
                          size="lg"
                          variant={step1Status.status === 'success' ? 'light' : 'default'}
                          color={step1Status.status === 'success' ? 'green' : undefined}
                          onClick={handleDownloadDocuments}
                          loading={step1Status.status === 'loading'}
                          disabled={step1Status.status === 'success'}
                          styles={
                            step1Status.status !== 'success'
                              ? {
                                  root: {
                                    border: '1px solid var(--mantine-color-dark-4)',
                                    backgroundColor: 'var(--mantine-color-dark-6)',
                                    '&:hover': {
                                      backgroundColor: 'var(--mantine-color-dark-5)',
                                    },
                                  },
                                }
                              : undefined
                          }
                        >
                          {step1Status.status === 'success' ? (
                            <IconCheck size={18} />
                          ) : (
                            <IconDownload size={18} />
                          )}
                        </ActionIcon>
                      </Tooltip>
                    </Group>

                    {step1Status.message && (
                      <Group gap={6} align="center">
                        {step1Status.status === 'loading' && (
                          <Loader size={12} color="gray" type="dots" />
                        )}
                        <Text
                          size="xs"
                          c={
                            step1Status.status === 'error'
                              ? 'red'
                              : step1Status.status === 'success'
                                ? 'green'
                                : 'dimmed'
                          }
                          style={
                            step1Status.status === 'loading'
                              ? {
                                  animation: 'loadingPulse 1.5s ease-in-out infinite',
                                }
                              : undefined
                          }
                        >
                          {step1Status.message}
                        </Text>
                      </Group>
                    )}
                  </Stack>
                </Paper>

                {/* Manuel Döküman Yükleme */}
                <Paper p="md" withBorder radius="md" bg="dark.7">
                  <Group justify="space-between">
                    <Box>
                      <Text size="sm" fw={500}>
                        Manuel Döküman Ekle
                      </Text>
                      <Text size="xs" c="dimmed">
                        Kendi dökümanlarınızı yükleyin (PDF, DOC, XLS, vb.)
                      </Text>
                    </Box>
                    <FileButton
                      onChange={(files) => files && handleManualUpload(files)}
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.zip,.rar,.txt,.csv"
                      multiple
                    >
                      {(props) => (
                        <Button
                          {...props}
                          size="sm"
                          variant="default"
                          leftSection={<IconUpload size={16} />}
                          loading={uploading}
                          styles={{
                            root: {
                              border: '1px solid var(--mantine-color-dark-4)',
                              backgroundColor: 'var(--mantine-color-dark-6)',
                              '&:hover': {
                                backgroundColor: 'var(--mantine-color-dark-5)',
                              },
                            },
                          }}
                        >
                          Dosya Seç
                        </Button>
                      )}
                    </FileButton>
                  </Group>
                </Paper>

                {/* Downloaded Documents */}
                {downloadDocs.length > 0 && (
                  <Box>
                    <Text size="sm" fw={500} mb="xs">
                      İndirilen Dökümanlar ({downloadDocs.length})
                    </Text>
                    <ScrollArea.Autosize mah={200}>
                      {renderDocumentList(downloadDocs)}
                    </ScrollArea.Autosize>
                  </Box>
                )}

                <Group justify="flex-end">
                  <Tooltip label="Sonraki Adım">
                    <ActionIcon
                      size="lg"
                      variant="default"
                      onClick={() => setActiveStep(1)}
                      disabled={step1Status.status === 'loading'}
                      styles={{
                        root: {
                          border: '1px solid var(--mantine-color-dark-4)',
                          backgroundColor: 'var(--mantine-color-dark-6)',
                          '&:hover': {
                            backgroundColor: 'var(--mantine-color-dark-5)',
                          },
                        },
                      }}
                    >
                      <IconChevronRight size={18} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Stack>
            </Stepper.Step>

            {/* Step 2: Analyze */}
            <Stepper.Step
              label="AI Analizi"
              description="Dökümanları analiz et"
              icon={getStepIcon(step2Status, <IconBrain size={18} />)}
              color={getStepColor(step2Status)}
              loading={step2Status.status === 'loading'}
            >
              <Stack gap="md" mt="md">
                <Paper p="md" withBorder radius="md">
                  <Stack gap="sm">
                    <Group justify="space-between">
                      <Box>
                        <Text size="sm" fw={500}>
                          AI ile Döküman Analizi
                        </Text>
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
                          style={{
                            background:
                              'linear-gradient(135deg, #C9A227 0%, #D4AF37 50%, #E6C65C 100%)',
                            border: 'none',
                          }}
                          leftSection={<IconBrain size={16} />}
                          onClick={handleAnalyze}
                          loading={step2Status.status === 'loading'}
                          disabled={pendingDocs === 0 && selectedForAnalysis.size === 0}
                        >
                          {step2Status.status === 'success' ? 'Tamamlandı' : 'Analiz Et'}
                        </Button>
                      </Group>
                    </Group>

                    {/* Status message */}
                    {step2Status.message && step2Status.status !== 'loading' && (
                      <Text
                        size="xs"
                        c={
                          step2Status.status === 'error'
                            ? 'red'
                            : step2Status.status === 'success'
                              ? 'green'
                              : 'dimmed'
                        }
                      >
                        {step2Status.message}
                      </Text>
                    )}
                  </Stack>
                </Paper>

                {/* Analysis Progress Panel - Detaylı ilerleme gösterimi */}
                {(documentProgress.size > 0 || step2Status.status === 'loading') && (
                  <AnalysisProgressPanel
                    documentProgress={documentProgress}
                    analysisProgress={analysisProgress}
                    startTime={analysisStartTime}
                  />
                )}

                {/* All Documents with Checkboxes - Analiz sırasında gizle */}
                {documentProgress.size === 0 && (
                  <Box>
                    <Group justify="space-between" mb="xs">
                      <Text size="sm" fw={500}>
                        Tüm Dökümanlar ({downloadDocs.length})
                      </Text>
                      <Group gap="xs">
                        <Tooltip label="Seçili veya tamamlanmış dökümanları sıfırla">
                          <Button
                            size="compact-xs"
                            variant="light"
                            color="orange"
                            leftSection={<IconRefresh size={12} />}
                            onClick={handleResetDocuments}
                            disabled={step2Status.status === 'loading' || totalDocs === 0}
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
                            disabled={step2Status.status === 'loading' || totalDocs === 0}
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
                      {renderDocumentList(downloadDocs, true)}
                    </ScrollArea.Autosize>
                  </Box>
                )}

                <Group justify="space-between">
                  <Button variant="subtle" onClick={() => setActiveStep(0)}>
                    Geri
                  </Button>
                  <Button variant="filled" onClick={onClose}>
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
