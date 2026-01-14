'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { API_BASE_URL } from '@/lib/config';
import Link from 'next/link';
import {
  Container,
  Paper,
  Title,
  Text,
  Badge,
  Button,
  Group,
  Stack,
  Alert,
  ThemeIcon,
  Card,
  Divider,
  Modal,
  ScrollArea,
  Checkbox,
  Progress,
  Loader,
  Tabs,
  Table,
  Box,
  Tooltip,
  ActionIcon,
  SimpleGrid
} from '@mantine/core';
import {
  IconArrowLeft,
  IconExternalLink,
  IconDownload,
  IconFileText,
  IconBuilding,
  IconMapPin,
  IconCalendar,
  IconCurrencyLira,
  IconAlertCircle,
  IconEye,
  IconFile,
  IconCheck,
  IconX,
  IconClock,
  IconPlayerPlay,
  IconCloudDownload,
  IconFileAnalytics,
  IconSettings,
  IconNote,
  IconList,
  IconSparkles,
  IconCoin,
  IconRefresh,
  IconBookmark,
  IconBookmarkFilled
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

// ============ INTERFACES ============
interface Tender {
  id: number;
  external_id: string;
  title: string;
  organization_name: string;
  city: string;
  tender_date: string;
  estimated_cost: number | null;
  estimated_cost_raw: string | null;
  url: string;
  announcement_content?: string;
  goods_services_content?: any;
  ikn?: string;
  // Zeyilname ve Düzeltme İlanı içerikleri
  zeyilname_content?: {
    title: string;
    content: string;
    scrapedAt: string;
  } | null;
  correction_notice_content?: {
    title: string;
    content: string;
    scrapedAt: string;
  } | null;
  is_updated?: boolean;
  last_update_date?: string;
}

interface Document {
  id: number;
  original_filename: string;
  file_type: string;
  file_size: number;
  doc_type: string;
  processing_status: 'pending' | 'queued' | 'processing' | 'completed' | 'failed';
  created_at: string;
  storage_url?: string;
  source_type: 'content' | 'download' | 'upload';
  content_type?: string;
  analysis_result?: any;
  extracted_text?: string;
}

interface DownloadStatus {
  availableTypes: string[];
  downloadedTypes: string[];
  pendingTypes: string[];
  hasDocuments: boolean;
  isComplete: boolean;
  progress: number;
}

interface AnalysisResult {
  ihale_basligi?: string;
  kurum?: string;
  tarih?: string;
  bedel?: string;
  sure?: string;
  teknik_sartlar?: string[];
  birim_fiyatlar?: any[];
  iletisim?: any;
  notlar?: string[];
  tam_metin?: string;
}

// ============ STATUS HELPERS ============
const getStatusBadge = (status: string) => {
  const statusMap: Record<string, { color: string; label: string; icon: any }> = {
    'pending': { color: 'gray', label: 'Bekliyor', icon: IconClock },
    'queued': { color: 'yellow', label: 'Kuyrukta', icon: IconClock },
    'processing': { color: 'blue', label: 'Analiz Ediliyor', icon: IconPlayerPlay },
    'completed': { color: 'green', label: 'Tamamlandı', icon: IconCheck },
    'failed': { color: 'red', label: 'Hata', icon: IconX },
  };
  const s = statusMap[status] || statusMap['pending'];
  const Icon = s.icon;
  return (
    <Badge color={s.color} variant="light" size="sm" leftSection={<Icon size={10} />}>
      {s.label}
    </Badge>
  );
};

const getDocTypeIcon = (docType: string) => {
  if (docType.includes('İlan') || docType.includes('announcement') || docType.includes('correction')) return IconFileText;
  if (docType.includes('Mal') || docType.includes('Hizmet') || docType.includes('goods')) return IconList;
  if (docType.includes('Teknik') || docType.includes('tech_spec')) return IconSettings;
  if (docType.includes('İdari') || docType.includes('admin_spec')) return IconNote;
  if (docType.includes('zeyilname')) return IconSparkles;
  return IconFile;
};

// Doc type Türkçe karşılıkları
const DOC_TYPE_LABELS: Record<string, string> = {
  'admin_spec': 'İdari Şartname',
  'tech_spec': 'Teknik Şartname',
  'announcement': 'İhale İlanı',
  'goods_services': 'Mal/Hizmet Listesi',
  'zeyilname': 'Zeyilname',
  'zeyilname_tech_spec': 'Teknik Şartname Zeyilnamesi',
  'zeyilname_admin_spec': 'İdari Şartname Zeyilnamesi',
  'correction_notice': 'Düzeltme İlanı',
  'contract': 'Sözleşme Tasarısı',
  'unit_price': 'Birim Fiyat Cetveli',
  'pursantaj': 'Pursantaj Listesi',
  'quantity_survey': 'Mahal Listesi / Metraj',
  'standard_forms': 'Standart Formlar',
  'project_files': 'Proje Dosyaları',
};

const getDocTypeLabel = (docType: string): string => {
  return DOC_TYPE_LABELS[docType] || docType;
};

// ============ MAIN COMPONENT ============
export default function TenderDetailPage() {
  const params = useParams();
  const tenderId = params.id as string;

  // State
  const [tender, setTender] = useState<Tender | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [downloadStatus, setDownloadStatus] = useState<DownloadStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Action states
  const [downloading, setDownloading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedDocs, setSelectedDocs] = useState<Set<number>>(new Set());
  const [analysisProgress, setAnalysisProgress] = useState<{ current: number; total: number; message: string } | null>(null);
  
  // Modal states
  const [analysisModalOpen, setAnalysisModalOpen] = useState(false);
  const [combinedResult, setCombinedResult] = useState<AnalysisResult | null>(null);
  const [contentModalOpen, setContentModalOpen] = useState(false);
  const [selectedContent, setSelectedContent] = useState<{ title: string; content: string } | null>(null);
  
  // Takip listesi state
  const [isTracked, setIsTracked] = useState(false);
  const [trackingData, setTrackingData] = useState<any>(null);

  // ============ DATA FETCHING ============
  const fetchData = useCallback(async () => {
    try {
      // İhale detayı
      const tenderRes = await fetch(`${API_BASE_URL}/api/tenders/${tenderId}`);
      if (!tenderRes.ok) throw new Error('İhale bulunamadı');
      const tenderData = await tenderRes.json();
      if (tenderData.success) setTender(tenderData.data);

      // Content dökümanları
      const contentRes = await fetch(`${API_BASE_URL}/api/tender-content/${tenderId}/documents`);
      let contentDocs: Document[] = [];
      if (contentRes.ok) {
        const contentData = await contentRes.json();
        if (contentData.success && contentData.data?.documents) {
          contentDocs = contentData.data.documents.map((doc: any) => ({
            id: doc.id,
            original_filename: doc.original_filename,
            file_type: 'text',
            file_size: 0,
            doc_type: doc.content_type === 'announcement' ? 'İhale İlanı' : 'Mal/Hizmet Listesi',
            processing_status: doc.processing_status,
            created_at: doc.created_at,
            source_type: 'content' as const,
            content_type: doc.content_type,
            analysis_result: doc.analysis_result,
            extracted_text: doc.content_text
          }));
        }
      }

      // İndirilen dökümanlar
      const downloadRes = await fetch(`${API_BASE_URL}/api/tender-docs/${tenderId}/downloaded-documents`);
      let downloadDocs: Document[] = [];
      if (downloadRes.ok) {
        const downloadData = await downloadRes.json();
        if (downloadData.success && downloadData.data?.documents) {
          downloadDocs = downloadData.data.documents.flatMap((group: any) => 
            group.files.map((file: any) => ({
              ...file,
              source_type: 'download' as const
            }))
          );
        }
      }

      // Tüm dökümanları birleştir
      setDocuments([...contentDocs, ...downloadDocs]);

      // İndirme durumu
      const statusRes = await fetch(`${API_BASE_URL}/api/tender-docs/${tenderId}/download-status`);
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        if (statusData.success) setDownloadStatus(statusData.data);
      }

      // Takip listesi durumu kontrol
      const trackingRes = await fetch(`${API_BASE_URL}/api/tender-tracking/check/${tenderId}`);
      if (trackingRes.ok) {
        const trackingResult = await trackingRes.json();
        setIsTracked(trackingResult.isTracked);
        setTrackingData(trackingResult.data);
      }

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [tenderId]);

  // İlk yükleme
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ============ ACTIONS ============
  
  // Dökümanları indir
  const handleDownloadDocuments = async () => {
    setDownloading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/tender-docs/${tenderId}/download-documents`, {
        method: 'POST'
      });
      const result = await response.json();
      
      if (result.success) {
        const data = result.data;
        const downloadedCount = data?.totalDownloaded || data?.success?.length || 0;
        const skippedCount = data?.skipped?.length || 0;
        
        notifications.show({
          title: '✅ İndirme Başarılı',
          message: downloadedCount > 0 
            ? `${downloadedCount} döküman indirildi${skippedCount > 0 ? `, ${skippedCount} zaten mevcut` : ''}`
            : skippedCount > 0 
              ? `Tüm dökümanlar zaten indirilmiş (${skippedCount} adet)`
              : 'İşlem tamamlandı',
          color: 'green'
        });
        await fetchData();
      } else {
        throw new Error(result.error || 'İndirme hatası');
      }
    } catch (err: any) {
      notifications.show({
        title: '❌ Hata',
        message: err.message,
        color: 'red'
      });
    } finally {
      setDownloading(false);
    }
  };

  // İçerik dökümanlarını oluştur
  const handleCreateContentDocs = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/tender-content/${tenderId}/create-documents`, {
        method: 'POST'
      });
      const result = await response.json();
      
      if (result.success) {
        notifications.show({
          title: '✅ Dökümanlar Oluşturuldu',
          message: 'İçerik dökümanları başarıyla oluşturuldu',
          color: 'green'
        });
        await fetchData();
      }
    } catch (err: any) {
      notifications.show({
        title: '❌ Hata',
        message: err.message,
        color: 'red'
      });
    }
  };

  // Sonuçları birleştir
  const combineResults = (results: AnalysisResult[]): AnalysisResult => {
    const combined: AnalysisResult = {
      ihale_basligi: '',
      kurum: '',
      tarih: '',
      bedel: '',
      sure: '',
      teknik_sartlar: [],
      birim_fiyatlar: [],
      iletisim: {},
      notlar: [],
      tam_metin: ''
    };
    
    for (const r of results) {
      if (r.ihale_basligi && !combined.ihale_basligi) combined.ihale_basligi = r.ihale_basligi;
      if (r.kurum && !combined.kurum) combined.kurum = r.kurum;
      if (r.tarih && !combined.tarih) combined.tarih = r.tarih;
      if (r.bedel && !combined.bedel) combined.bedel = r.bedel;
      if (r.sure && !combined.sure) combined.sure = r.sure;
      if (r.teknik_sartlar?.length) combined.teknik_sartlar!.push(...r.teknik_sartlar);
      if (r.birim_fiyatlar?.length) combined.birim_fiyatlar!.push(...r.birim_fiyatlar);
      if (r.iletisim && Object.keys(r.iletisim).length) combined.iletisim = { ...combined.iletisim, ...r.iletisim };
      if (r.notlar?.length) combined.notlar!.push(...r.notlar);
      if (r.tam_metin) combined.tam_metin += r.tam_metin + '\n\n---\n\n';
    }
    
    // Duplicate temizle
    combined.teknik_sartlar = [...new Set(combined.teknik_sartlar)];
    combined.notlar = [...new Set(combined.notlar)];
    
    return combined;
  };

  // TOPLU ANALİZ - Backend'deki batch endpoint'i kullan
  // overrideIds: Opsiyonel - doğrudan ID listesi verilebilir (retry için)
  const handleAnalyzeSelected = async (overrideIds?: number[]) => {
    const documentIds = overrideIds || Array.from(selectedDocs);
    
    if (documentIds.length === 0) {
      notifications.show({
        title: '⚠️ Uyarı',
        message: 'Lütfen analiz edilecek dökümanları seçin',
        color: 'yellow'
      });
      return;
    }

    const selectedDocuments = documents.filter(d => documentIds.includes(d.id));
    const docCount = overrideIds ? overrideIds.length : selectedDocuments.length;
    
    setAnalyzing(true);
    setAnalysisProgress({ current: 0, total: docCount, message: 'Analiz başlıyor...' });

    const startTime = Date.now();
    
    notifications.show({
      title: '⚡ Toplu Analiz Başladı',
      message: `${docCount} döküman analiz edilecek`,
      color: 'blue',
      icon: <IconSparkles size={16} />
    });

    try {
      const response = await fetch(`${API_BASE_URL}/api/tender-content/analyze-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentIds })
      });

      if (!response.ok) throw new Error('Analiz hatası');
      
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      if (!reader) throw new Error('Stream okunamadı');
      
      const allResults: AnalysisResult[] = [];
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const text = decoder.decode(value);
        const lines = text.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ') && line.length > 6) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.stage === 'processing') {
                setAnalysisProgress({
                  current: data.current,
                  total: data.total,
                  message: data.message
                });
              }
              
              if (data.stage === 'complete') {
                // Başarılı sonuçları topla
                data.results?.forEach((r: any) => {
                  if (r.success && r.analysis) {
                    allResults.push(r.analysis);
                  }
                });
                
                setAnalysisProgress({ 
                  current: data.summary.total, 
                  total: data.summary.total, 
                  message: `Tamamlandı! (${data.summary.success}/${data.summary.total})` 
                });
              }
              
              if (data.stage === 'error') {
                throw new Error(data.message);
              }
            } catch (parseErr) {
              // JSON parse hatası - devam et
            }
          }
        }
      }
      
      if (allResults.length > 0) {
        const combined = combineResults(allResults);
        setCombinedResult(combined);
        setAnalysisModalOpen(true);
        
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        
        notifications.show({
          title: '🎉 Analiz Tamamlandı!',
          message: `${allResults.length} döküman ${duration} saniyede analiz edildi`,
          color: 'green',
          icon: <IconCheck size={16} />
        });

        // Analiz tamamlandığında otomatik takip listesine ekle
        try {
          await fetch(`${API_BASE_URL}/api/tender-tracking/add-from-analysis`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tender_id: parseInt(tenderId) })
          });
          setIsTracked(true);
          notifications.show({
            title: '📌 Takip Listesine Eklendi',
            message: 'Bu ihale analiz sonuçlarıyla birlikte takip listenize eklendi',
            color: 'teal'
          });
        } catch (trackErr) {
          console.error('Takip listesi ekleme hatası:', trackErr);
        }
      } else {
        notifications.show({
          title: '⚠️ Analiz Tamamlandı',
          message: 'Analiz sonucu bulunamadı veya tüm dökümanlar başarısız oldu',
          color: 'yellow'
        });
      }
      
    } catch (err: any) {
      console.error('Toplu analiz hatası:', err);
      notifications.show({
        title: '❌ Analiz Hatası',
        message: err.message || 'Bilinmeyen hata',
        color: 'red'
      });
    }

    setSelectedDocs(new Set());
    setAnalyzing(false);
    setAnalysisProgress(null);
    await fetchData();
  };

  // Checkbox toggle
  const toggleDoc = (id: number) => {
    const newSet = new Set(selectedDocs);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedDocs(newSet);
  };

  // Tümünü seç
  const toggleSelectAll = () => {
    const selectableDocs = documents.filter(d => 
      d.processing_status !== 'processing' && d.processing_status !== 'queued'
    );
    if (selectedDocs.size === selectableDocs.length) {
      setSelectedDocs(new Set());
    } else {
      setSelectedDocs(new Set(selectableDocs.map(d => d.id)));
    }
  };

  // İçeriği göster
  const showContent = (doc: Document) => {
    if (doc.extracted_text || tender?.announcement_content) {
      const content = doc.content_type === 'announcement' 
        ? tender?.announcement_content || doc.extracted_text
        : JSON.stringify(tender?.goods_services_content, null, 2);
      setSelectedContent({ title: doc.doc_type, content: content || '' });
      setContentModalOpen(true);
    }
  };

  // Mevcut analiz sonuçlarını göster
  const showExistingAnalysis = () => {
    const analyzedDocs = documents.filter(d => d.processing_status === 'completed' && d.analysis_result);
    
    if (analyzedDocs.length === 0) {
      notifications.show({
        title: '⚠️ Uyarı',
        message: 'Henüz analiz edilmiş döküman bulunmuyor',
        color: 'yellow'
      });
      return;
    }

    const results: AnalysisResult[] = analyzedDocs.map(d => {
      const analysis = typeof d.analysis_result === 'string' 
        ? JSON.parse(d.analysis_result) 
        : d.analysis_result;
      return analysis;
    });

    const combined = combineResults(results);
    setCombinedResult(combined);
    setAnalysisModalOpen(true);
  };

  // ============ RENDER ============
  if (loading) {
    return (
      <Container size="lg" py="xl">
        <Stack align="center" py={100}>
          <Loader size="lg" />
          <Text c="dimmed">Yükleniyor...</Text>
        </Stack>
      </Container>
    );
  }

  if (error || !tender) {
    return (
      <Container size="lg" py="xl">
        <Alert color="red" title="Hata" icon={<IconAlertCircle />}>
          {error || 'İhale bulunamadı'}
        </Alert>
      </Container>
    );
  }

  const selectableDocs = documents.filter(d => d.processing_status !== 'processing' && d.processing_status !== 'queued');
  const completedDocs = documents.filter(d => d.processing_status === 'completed');
  const failedDocs = documents.filter(d => d.processing_status === 'failed');

  // Hatalı dökümanları tekrar analiz et
  const handleRetryFailed = async () => {
    if (failedDocs.length === 0) {
      notifications.show({
        title: 'ℹ️ Bilgi',
        message: 'Tekrar denenecek hatalı döküman yok',
        color: 'blue'
      });
      return;
    }

    // Hatalı döküman ID'lerini önceden kaydet (reset sonrası failedDocs değişecek)
    const failedDocIds = failedDocs.map(d => d.id);
    
    // Önce hatalı dökümanların durumunu "pending" yap
    try {
      const response = await fetch(`${API_BASE_URL}/api/tender-content/documents/reset-failed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentIds: failedDocIds })
      });

      if (!response.ok) throw new Error('Reset hatası');

      const result = await response.json();

      const resetIds = result.resetIds || failedDocIds;
      
      notifications.show({
        title: '🔄 Tekrar Deneniyor',
        message: `${result.resetCount} hatalı döküman tekrar analiz edilecek`,
        color: 'blue'
      });

      // Dökümanları seç (UI için)
      setSelectedDocs(new Set(resetIds));
      
      // Sayfayı yenile
      await fetchData();
      
      // Analizi doğrudan ID'lerle başlat (state bekleme sorunu yok)
      handleAnalyzeSelected(resetIds);

    } catch (error) {
      console.error('Retry hatası:', error);
      notifications.show({
        title: '❌ Hata',
        message: 'Tekrar deneme başlatılamadı',
        color: 'red'
      });
    }
  };

  return (
    <Container size="lg" py="xl">
      <Stack gap="lg">
        {/* Header */}
        <Group justify="space-between">
          <Link href="/tenders" style={{ textDecoration: 'none' }}>
            <Button variant="subtle" leftSection={<IconArrowLeft size={16} />}>
              İhale Listesi
            </Button>
          </Link>
          <Button
            component="a"
            href={tender.url}
            target="_blank"
            variant="light"
            rightSection={<IconExternalLink size={16} />}
          >
            Kaynağa Git
          </Button>
        </Group>

        {/* İhale Başlığı */}
        <Group gap="md" align="center" justify="space-between">
          <Group gap="md" align="center">
            <Title order={2}>{tender.external_id} - {tender.title}</Title>
            {tender.is_updated && (
              <Badge color="yellow" size="lg" variant="filled" leftSection={<IconSparkles size={14} />}>
                Güncellendi
              </Badge>
            )}
            {isTracked && (
              <Badge color="teal" size="lg" variant="filled" leftSection={<IconBookmarkFilled size={14} />}>
                Takip Ediliyor
              </Badge>
            )}
          </Group>
          <Tooltip label={isTracked ? 'Takip listesinde' : 'Takip listesine ekle'}>
            <ActionIcon 
              size="lg" 
              variant={isTracked ? 'filled' : 'light'} 
              color="teal"
              onClick={async () => {
                if (!isTracked) {
                  try {
                    await fetch(`${API_BASE_URL}/api/tender-tracking`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ tender_id: parseInt(tenderId) })
                    });
                    setIsTracked(true);
                    notifications.show({
                      title: '📌 Takip Listesine Eklendi',
                      message: 'Bu ihale takip listenize eklendi',
                      color: 'teal'
                    });
                  } catch (err) {
                    notifications.show({
                      title: '❌ Hata',
                      message: 'Takip listesine eklenemedi',
                      color: 'red'
                    });
                  }
                }
              }}
            >
              {isTracked ? <IconBookmarkFilled size={20} /> : <IconBookmark size={20} />}
            </ActionIcon>
          </Tooltip>
        </Group>

        {/* İhale Bilgileri */}
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Group gap="xl" wrap="wrap">
            <Group gap="xs">
              <ThemeIcon variant="light" size="lg"><IconBuilding size={18} /></ThemeIcon>
              <div>
                <Text size="xs" c="dimmed">KURUM</Text>
                <Text size="sm" fw={500}>{tender.organization_name}</Text>
              </div>
            </Group>
            <Group gap="xs">
              <ThemeIcon variant="light" size="lg"><IconMapPin size={18} /></ThemeIcon>
              <div>
                <Text size="xs" c="dimmed">ŞEHİR</Text>
                <Text size="sm" fw={500}>{tender.city}</Text>
              </div>
            </Group>
            <Group gap="xs">
              <ThemeIcon variant="light" size="lg"><IconCalendar size={18} /></ThemeIcon>
              <div>
                <Text size="xs" c="dimmed">İHALE TARİHİ</Text>
                <Text size="sm" fw={500}>
                  {new Date(tender.tender_date).toLocaleDateString('tr-TR', {
                    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
                  })}
                </Text>
              </div>
            </Group>
            {tender.estimated_cost && (
              <Group gap="xs">
                <ThemeIcon variant="light" size="lg" color="green"><IconCurrencyLira size={18} /></ThemeIcon>
                <div>
                  <Text size="xs" c="dimmed">TAHMİNİ MALİYET</Text>
                  <Text size="sm" fw={500} c="green">
                    {tender.estimated_cost.toLocaleString('tr-TR')} ₺
                  </Text>
                </div>
              </Group>
            )}
          </Group>
        </Card>

        {/* ============ ZEYİLNAME VE DÜZELTME İLANI ============ */}
        {(tender.zeyilname_content || tender.correction_notice_content) && (
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
            {/* Zeyilname Kartı */}
            {tender.zeyilname_content && (
              <Card shadow="sm" padding="lg" radius="md" withBorder style={{ borderLeft: '4px solid var(--mantine-color-orange-6)' }}>
                <Group justify="space-between" mb="md">
                  <Group gap="sm">
                    <ThemeIcon color="orange" size="lg" radius="xl">
                      <IconNote size={18} />
                    </ThemeIcon>
                    <div>
                      <Text fw={600}>Zeyilname</Text>
                      <Text size="xs" c="dimmed">
                        {tender.zeyilname_content.scrapedAt && 
                          new Date(tender.zeyilname_content.scrapedAt).toLocaleDateString('tr-TR')}
                      </Text>
                    </div>
                  </Group>
                  <Badge color="orange" variant="light">Güncelleme</Badge>
                </Group>
                <ScrollArea h={200}>
                  <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                    {tender.zeyilname_content.content}
                  </Text>
                </ScrollArea>
              </Card>
            )}

            {/* Düzeltme İlanı Kartı */}
            {tender.correction_notice_content && (
              <Card shadow="sm" padding="lg" radius="md" withBorder style={{ borderLeft: '4px solid var(--mantine-color-red-6)' }}>
                <Group justify="space-between" mb="md">
                  <Group gap="sm">
                    <ThemeIcon color="red" size="lg" radius="xl">
                      <IconAlertCircle size={18} />
                    </ThemeIcon>
                    <div>
                      <Text fw={600}>Düzeltme İlanı</Text>
                      <Text size="xs" c="dimmed">
                        {tender.correction_notice_content.scrapedAt && 
                          new Date(tender.correction_notice_content.scrapedAt).toLocaleDateString('tr-TR')}
                      </Text>
                    </div>
                  </Group>
                  <Badge color="red" variant="light">Düzeltme</Badge>
                </Group>
                <ScrollArea h={200}>
                  <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                    {tender.correction_notice_content.content}
                  </Text>
                </ScrollArea>
              </Card>
            )}
          </SimpleGrid>
        )}

        {/* ============ DÖKÜMAN YÖNETİMİ KARTI ============ */}
        <Card shadow="sm" padding={0} radius="md" withBorder>
          {/* Başlık */}
          <Box p="md" style={{ background: 'linear-gradient(135deg, var(--mantine-color-violet-6) 0%, var(--mantine-color-grape-6) 100%)' }}>
            <Group justify="space-between">
              <Group>
                <ThemeIcon size={50} color="white" variant="white" radius="xl">
                  <IconFileAnalytics size={28} color="var(--mantine-color-violet-6)" />
                </ThemeIcon>
                <div>
                  <Title order={3} c="white">İhale Dökümanları</Title>
                  <Text c="white" opacity={0.9}>
                    {documents.length} döküman • {completedDocs.length} analiz edildi
                  </Text>
                </div>
              </Group>
              <Group gap="xs">
                {/* İçerik oluştur */}
                {documents.filter(d => d.source_type === 'content').length === 0 && tender.announcement_content && (
                  <Button variant="white" color="violet" size="sm" onClick={handleCreateContentDocs}>
                    İçerikleri Döküman Yap
                  </Button>
                )}
                
                {/* İndir */}
                {downloadStatus && downloadStatus.pendingTypes.length > 0 && (
                  <Button
                    variant="white"
                    color="blue"
                    size="sm"
                    leftSection={<IconCloudDownload size={16} />}
                    loading={downloading}
                    onClick={handleDownloadDocuments}
                  >
                    Dökümanları İndir ({downloadStatus.pendingTypes.length})
                  </Button>
                )}
                
                {/* Hatalıları Tekrar Dene */}
                {failedDocs.length > 0 && (
                  <Button
                    variant="white"
                    color="red"
                    size="sm"
                    leftSection={<IconRefresh size={16} />}
                    onClick={handleRetryFailed}
                    disabled={analyzing}
                  >
                    Hatalıları Tekrar Dene ({failedDocs.length})
                  </Button>
                )}

                {/* Mevcut Analizi Göster */}
                {completedDocs.length > 0 && (
                  <Button
                    variant="white"
                    color="green"
                    size="sm"
                    leftSection={<IconEye size={16} />}
                    onClick={showExistingAnalysis}
                  >
                    Analiz Sonuçları ({completedDocs.length})
                  </Button>
                )}
              </Group>
            </Group>
          </Box>

          {/* Analiz Progress */}
          {analyzing && analysisProgress && (
            <Box p="md" bg="blue.0">
              <Group gap="md">
                <Loader size="sm" />
                <div style={{ flex: 1 }}>
                  <Text size="sm" fw={500}>{analysisProgress.message}</Text>
                  <Progress 
                    value={(analysisProgress.current / analysisProgress.total) * 100} 
                    animated 
                    size="sm" 
                    mt="xs" 
                  />
                </div>
                <Text size="sm" c="dimmed">
                  {analysisProgress.current} / {analysisProgress.total}
                </Text>
              </Group>
            </Box>
          )}

          {/* Aksiyon Bar */}
          <Box p="md" bg="gray.0" style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}>
            <Group justify="space-between">
              <Checkbox
                checked={selectedDocs.size === selectableDocs.length && selectableDocs.length > 0}
                indeterminate={selectedDocs.size > 0 && selectedDocs.size < selectableDocs.length}
                onChange={toggleSelectAll}
                label={<Text size="sm">Tümünü Seç ({selectableDocs.length})</Text>}
                disabled={analyzing}
              />
              <Button
                variant="gradient"
                gradient={{ from: 'violet', to: 'grape' }}
                leftSection={<IconSparkles size={16} />}
                loading={analyzing}
                onClick={() => handleAnalyzeSelected()}
                disabled={selectedDocs.size === 0}
              >
                🤖 Seçilenleri Analiz Et ({selectedDocs.size})
              </Button>
            </Group>
          </Box>

          {/* Döküman Listesi */}
          <Box p="md">
            {documents.length === 0 ? (
              <Text c="dimmed" ta="center" py="xl">
                Henüz döküman yok. Yukarıdaki butonları kullanarak döküman ekleyin.
              </Text>
            ) : (
              <Stack gap="xs">
                {documents.map((doc) => {
                  const DocIcon = getDocTypeIcon(doc.doc_type);
                  const isProcessing = doc.processing_status === 'queued' || doc.processing_status === 'processing';
                  
                  return (
                    <Paper 
                      key={`${doc.source_type}-${doc.id}`} 
                      p="sm" 
                      withBorder
                      style={{
                        borderColor: doc.processing_status === 'completed' ? 'var(--mantine-color-green-4)' :
                                    doc.processing_status === 'failed' ? 'var(--mantine-color-red-4)' :
                                    isProcessing ? 'var(--mantine-color-blue-4)' : undefined,
                        background: selectedDocs.has(doc.id) ? 'var(--mantine-color-violet-0)' : undefined
                      }}
                    >
                      <Group justify="space-between" wrap="nowrap">
                        <Group gap="sm" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                          {/* Checkbox */}
                          <Checkbox
                            checked={selectedDocs.has(doc.id)}
                            onChange={() => toggleDoc(doc.id)}
                            disabled={isProcessing || analyzing}
                          />
                          
                          {/* İkon */}
                          <ThemeIcon 
                            variant="light" 
                            size="lg"
                            color={
                              doc.processing_status === 'completed' ? 'green' :
                              doc.processing_status === 'failed' ? 'red' :
                              isProcessing ? 'blue' : 'gray'
                            }
                          >
                            {isProcessing ? <Loader size={16} /> : <DocIcon size={18} />}
                          </ThemeIcon>
                          
                          {/* Bilgi */}
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <Text size="sm" fw={500} truncate>
                              {doc.original_filename || getDocTypeLabel(doc.doc_type)}
                            </Text>
                            <Group gap="xs">
                              <Badge size="xs" variant="dot" color={doc.source_type === 'content' ? 'blue' : 'orange'}>
                                {doc.source_type === 'content' ? 'İçerik' : doc.file_type?.toUpperCase() || 'PDF'}
                              </Badge>
                              <Text size="xs" c="dimmed">{getDocTypeLabel(doc.doc_type)}</Text>
                            </Group>
                          </div>
                        </Group>

                        {/* Sağ: Durum ve aksiyonlar */}
                        <Group gap="sm" wrap="nowrap">
                          {getStatusBadge(doc.processing_status)}
                          
                          {/* Aksiyonlar */}
                          {doc.source_type === 'content' && (
                            <Tooltip label="İçeriği Gör">
                              <ActionIcon variant="subtle" onClick={() => showContent(doc)}>
                                <IconEye size={16} />
                              </ActionIcon>
                            </Tooltip>
                          )}
                          
                          {doc.storage_url && (
                            <Tooltip label="Dosyayı İndir">
                              <ActionIcon variant="subtle" component="a" href={doc.storage_url} target="_blank">
                                <IconDownload size={16} />
                              </ActionIcon>
                            </Tooltip>
                          )}
                        </Group>
                      </Group>
                    </Paper>
                  );
                })}
              </Stack>
            )}
          </Box>
        </Card>

        {/* İlan İçeriği Önizleme */}
        {tender.announcement_content && (
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Group mb="md">
              <ThemeIcon variant="light" size="lg"><IconFileText size={18} /></ThemeIcon>
              <Title order={4}>İlan İçeriği Önizleme</Title>
            </Group>
            <ScrollArea h={250}>
              <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                {tender.announcement_content.substring(0, 2000)}
                {tender.announcement_content.length > 2000 && '...'}
              </Text>
            </ScrollArea>
          </Card>
        )}
      </Stack>

      {/* ============ ANALİZ SONUÇ MODAL ============ */}
      <Modal
        opened={analysisModalOpen}
        onClose={() => setAnalysisModalOpen(false)}
        title={
          <Group>
            <ThemeIcon size={40} color="green" variant="light" radius="xl">
              <IconCheck size={24} />
            </ThemeIcon>
            <div>
              <Text fw={600} size="lg">✅ Analiz Tamamlandı</Text>
              <Text size="sm" c="dimmed">
                {combinedResult?.teknik_sartlar?.length || 0} teknik şart • 
                {combinedResult?.birim_fiyatlar?.length || 0} kalem • 
                {combinedResult?.notlar?.length || 0} not
              </Text>
            </div>
          </Group>
        }
        size="xl"
      >
        {combinedResult && (
          <>
            {/* Özet Kartları */}
            <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="sm" mb="md">
              {combinedResult.ihale_basligi && (
                <Paper p="sm" withBorder>
                  <Text size="xs" c="dimmed">İhale Başlığı</Text>
                  <Text size="sm" fw={500} lineClamp={2}>{combinedResult.ihale_basligi}</Text>
                </Paper>
              )}
              {combinedResult.kurum && (
                <Paper p="sm" withBorder>
                  <Text size="xs" c="dimmed">Kurum</Text>
                  <Text size="sm" fw={500} lineClamp={2}>{combinedResult.kurum}</Text>
                </Paper>
              )}
              {combinedResult.bedel && (
                <Paper p="sm" withBorder style={{ borderColor: 'var(--mantine-color-green-5)' }}>
                  <Text size="xs" c="dimmed">Tahmini Bedel</Text>
                  <Text size="sm" fw={700} c="green">{combinedResult.bedel}</Text>
                </Paper>
              )}
            </SimpleGrid>

            <Tabs defaultValue="teknik">
              <Tabs.List>
                <Tabs.Tab value="teknik" leftSection={<IconSettings size={14} />}>
                  Teknik Şartlar ({combinedResult.teknik_sartlar?.length || 0})
                </Tabs.Tab>
                <Tabs.Tab value="fiyat" leftSection={<IconCoin size={14} />}>
                  Birim Fiyatlar ({combinedResult.birim_fiyatlar?.length || 0})
                </Tabs.Tab>
                <Tabs.Tab value="notlar" leftSection={<IconNote size={14} />}>
                  Notlar ({combinedResult.notlar?.length || 0})
                </Tabs.Tab>
              </Tabs.List>

              <Tabs.Panel value="teknik" pt="md">
                <ScrollArea h={350}>
                  {combinedResult.teknik_sartlar?.length ? (
                    <Stack gap="xs">
                      {combinedResult.teknik_sartlar.map((sart, i) => (
                        <Paper key={i} p="xs" withBorder bg="gray.0">
                          <Group gap="xs">
                            <Badge size="sm" circle variant="light">{i + 1}</Badge>
                            <Text size="sm">{sart}</Text>
                          </Group>
                        </Paper>
                      ))}
                    </Stack>
                  ) : (
                    <Text c="dimmed" ta="center">Teknik şart bulunamadı</Text>
                  )}
                </ScrollArea>
              </Tabs.Panel>

              <Tabs.Panel value="fiyat" pt="md">
                <ScrollArea h={350}>
                  {combinedResult.birim_fiyatlar?.length ? (
                    <Table striped highlightOnHover>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>#</Table.Th>
                          <Table.Th>Kalem</Table.Th>
                          <Table.Th>Birim</Table.Th>
                          <Table.Th>Miktar</Table.Th>
                          <Table.Th ta="right">Fiyat</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {combinedResult.birim_fiyatlar.map((item: any, i) => (
                          <Table.Tr key={i}>
                            <Table.Td>{i + 1}</Table.Td>
                            <Table.Td>{item.kalem || item.aciklama || '-'}</Table.Td>
                            <Table.Td>{item.birim || '-'}</Table.Td>
                            <Table.Td>{item.miktar || '-'}</Table.Td>
                            <Table.Td ta="right">
                              <Badge color="green" variant="light">
                                {item.fiyat || item.tutar || '-'}
                              </Badge>
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  ) : (
                    <Text c="dimmed" ta="center">Birim fiyat bulunamadı</Text>
                  )}
                </ScrollArea>
              </Tabs.Panel>

              <Tabs.Panel value="notlar" pt="md">
                <ScrollArea h={350}>
                  {combinedResult.notlar?.length ? (
                    <Stack gap="xs">
                      {combinedResult.notlar.map((not, i) => (
                        <Paper key={i} p="xs" withBorder>
                          <Group gap="xs">
                            <ThemeIcon size="sm" color="orange" variant="light">
                              <IconNote size={12} />
                            </ThemeIcon>
                            <Text size="sm">{not}</Text>
                          </Group>
                        </Paper>
                      ))}
                    </Stack>
                  ) : (
                    <Text c="dimmed" ta="center">Not bulunamadı</Text>
                  )}
                </ScrollArea>
              </Tabs.Panel>
            </Tabs>

            <Divider my="md" />
            
            <Group justify="flex-end">
              <Button
                variant="light"
                leftSection={<IconDownload size={16} />}
                onClick={() => {
                  const dataStr = JSON.stringify(combinedResult, null, 2);
                  const blob = new Blob([dataStr], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = `ihale-analiz-${tender.external_id}.json`;
                  link.click();
                }}
              >
                JSON İndir
              </Button>
              <Button onClick={() => setAnalysisModalOpen(false)}>
                Kapat
              </Button>
            </Group>
          </>
        )}
      </Modal>

      {/* İçerik Modal */}
      <Modal
        opened={contentModalOpen}
        onClose={() => setContentModalOpen(false)}
        title={selectedContent?.title}
        size="lg"
      >
        <ScrollArea h={500}>
          <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
            {selectedContent?.content}
          </Text>
        </ScrollArea>
      </Modal>
    </Container>
  );
}
