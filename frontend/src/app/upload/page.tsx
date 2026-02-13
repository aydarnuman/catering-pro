'use client';

import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Container,
  Divider,
  Group,
  List,
  Paper,
  Progress,
  ScrollArea,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { Dropzone } from '@mantine/dropzone';
import { notifications } from '@mantine/notifications';
import {
  IconAlertCircle,
  IconCheck,
  IconClipboardList,
  IconCoin,
  IconDownload,
  IconFile,
  IconFileAnalytics,
  IconNote,
  IconSettings,
  IconSparkles,
  IconX,
} from '@tabler/icons-react';
import { useCallback, useState } from 'react';
import { API_BASE_URL } from '@/lib/config';

interface AnalysisResult {
  ihale_basligi: string;
  kurum: string;
  tarih: string;
  bedel: string;
  sure: string;
  teknik_sartlar: string[];
  birim_fiyatlar: any[];
  iletisim: any;
  notlar: string[];
  tam_metin: string;
}

interface ProgressState {
  stage: string;
  message: string;
  progress?: number;
  result?: { analiz: AnalysisResult };
  document_id?: number;
}

interface FileWithStatus {
  file: File;
  status: 'pending' | 'analyzing' | 'completed' | 'error';
  progress?: ProgressState;
  result?: AnalysisResult;
  error?: string;
}

export default function UploadPage() {
  const [files, setFiles] = useState<FileWithStatus[]>([]);
  const [uploading, setUploading] = useState(false);
  const [_currentFileIndex, setCurrentFileIndex] = useState<number>(-1);
  const [combinedResult, setCombinedResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Desteklenen formatlar
  const SUPPORTED_EXTENSIONS = [
    '.pdf',
    '.png',
    '.jpg',
    '.jpeg',
    '.webp',
    '.gif',
    '.docx',
    '.doc',
    '.xlsx',
    '.xls',
    '.txt',
    '.csv',
  ];

  const getFileExtension = (filename: string) => {
    return `.${filename.split('.').pop()?.toLowerCase()}`;
  };

  const handleDrop = useCallback(
    (acceptedFiles: File[]) => {
      const validFiles: FileWithStatus[] = [];

      for (const selectedFile of acceptedFiles) {
        const ext = getFileExtension(selectedFile.name);

        // Format kontrolü
        if (!SUPPORTED_EXTENSIONS.includes(ext)) {
          notifications.show({
            title: 'Desteklenmeyen Format',
            message: `${selectedFile.name} - ${ext} formatı desteklenmiyor`,
            color: 'orange',
            icon: <IconX size={16} />,
          });
          continue;
        }

        validFiles.push({
          file: selectedFile,
          status: 'pending',
        });
      }

      if (validFiles.length > 0) {
        setFiles((prev) => [...prev, ...validFiles]);
        setError(null);
        setCombinedResult(null);

        notifications.show({
          title: 'Dosyalar Eklendi',
          message: `${validFiles.length} dosya listeye eklendi`,
          color: 'green',
          icon: <IconCheck size={16} />,
        });
      }
    },
    [getFileExtension]
  );

  // Tek dosya analizi
  const analyzeFile = async (fileWithStatus: FileWithStatus, index: number): Promise<AnalysisResult | null> => {
    const file = fileWithStatus.file;

    try {
      // Status güncelle
      setFiles((prev) => prev.map((f, i) => (i === index ? { ...f, status: 'analyzing' as const } : f)));

      const formData = new FormData();
      formData.append('file', file, file.name);
      formData.append('uploaded_by', 'user');

      const response = await fetch(`${API_BASE_URL}/api/documents/analyze`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error('Response stream okunamadı');

      let result: AnalysisResult | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ') && line.length > 6) {
            try {
              const jsonStr = line.slice(6);
              if (jsonStr.trim()) {
                const data = JSON.parse(jsonStr);

                // Progress güncelle
                setFiles((prev) => prev.map((f, i) => (i === index ? { ...f, progress: data } : f)));

                if (data.stage === 'complete') {
                  result = data.result.analiz;
                  setFiles((prev) =>
                    prev.map((f, i) =>
                      i === index ? { ...f, status: 'completed' as const, result: data.result.analiz } : f
                    )
                  );
                } else if (data.stage === 'error') {
                  throw new Error(data.message);
                }
              }
            } catch (parseError: any) {
              if (parseError.message) throw parseError;
            }
          }
        }
      }

      return result;
    } catch (err: any) {
      console.error(`Analiz hatası (${file.name}):`, err);
      setFiles((prev) =>
        prev.map((f, i) => (i === index ? { ...f, status: 'error' as const, error: err.message } : f))
      );
      return null;
    }
  };

  // Paralel analiz ayarları
  const PARALLEL_LIMIT = 3; // Aynı anda kaç dosya analiz edilsin

  // Tüm dosyaları analiz et (PARALEL)
  const handleAnalyzeAll = async () => {
    if (files.length === 0) {
      notifications.show({
        title: 'Hata',
        message: 'Lütfen önce dosya ekleyin',
        color: 'red',
        icon: <IconX size={16} />,
      });
      return;
    }

    const pendingIndices = files
      .map((f, i) => ({ file: f, index: i }))
      .filter((item) => item.file.status === 'pending' || item.file.status === 'error')
      .map((item) => item.index);

    if (pendingIndices.length === 0) {
      notifications.show({
        title: 'Bilgi',
        message: 'Tüm dosyalar zaten analiz edilmiş',
        color: 'blue',
        icon: <IconCheck size={16} />,
      });
      return;
    }

    setUploading(true);
    setError(null);

    const startTime = Date.now();

    notifications.show({
      title: '⚡ Paralel Analiz Başladı',
      message: `${pendingIndices.length} dosya ${PARALLEL_LIMIT} paralel işlemle analiz edilecek`,
      color: 'blue',
      icon: <IconFileAnalytics size={16} />,
    });

    // Paralel analiz - batch'ler halinde
    const allResults: (AnalysisResult | null)[] = new Array(files.length).fill(null);

    // Zaten tamamlanmış dosyaların sonuçlarını ekle
    files.forEach((f, i) => {
      if (f.result) allResults[i] = f.result;
    });

    // Paralel batch işleme
    for (let i = 0; i < pendingIndices.length; i += PARALLEL_LIMIT) {
      const batch = pendingIndices.slice(i, i + PARALLEL_LIMIT);

      // Bu batch'teki dosyaları paralel analiz et
      const batchPromises = batch.map((index) => analyzeFile(files[index], index));
      const batchResults = await Promise.all(batchPromises);

      // Sonuçları kaydet
      batchResults.forEach((result, batchIdx) => {
        const originalIndex = batch[batchIdx];
        allResults[originalIndex] = result;
      });
    }

    // Başarılı sonuçları filtrele ve birleştir
    const successResults = allResults.filter((r): r is AnalysisResult => r !== null);

    if (successResults.length > 0) {
      const combined = combineResults(successResults);
      setCombinedResult(combined);

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);

      notifications.show({
        title: '🎉 Tüm Analizler Tamamlandı!',
        message: `${successResults.length} dosya ${duration} saniyede analiz edildi`,
        color: 'green',
        icon: <IconCheck size={16} />,
      });
    }

    setCurrentFileIndex(-1);
    setUploading(false);
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
      tam_metin: '',
    };

    for (const r of results) {
      if (r.ihale_basligi && !combined.ihale_basligi) combined.ihale_basligi = r.ihale_basligi;
      if (r.kurum && !combined.kurum) combined.kurum = r.kurum;
      if (r.tarih && !combined.tarih) combined.tarih = r.tarih;
      if (r.bedel && !combined.bedel) combined.bedel = r.bedel;
      if (r.sure && !combined.sure) combined.sure = r.sure;
      if (r.teknik_sartlar?.length) combined.teknik_sartlar.push(...r.teknik_sartlar);
      if (r.birim_fiyatlar?.length) combined.birim_fiyatlar.push(...r.birim_fiyatlar);
      if (r.iletisim && Object.keys(r.iletisim).length) combined.iletisim = { ...combined.iletisim, ...r.iletisim };
      if (r.notlar?.length) combined.notlar.push(...r.notlar);
      if (r.tam_metin) combined.tam_metin += `${r.tam_metin}\n\n---\n\n`;
    }

    // Duplicate temizle
    combined.teknik_sartlar = [...new Set(combined.teknik_sartlar)];
    combined.notlar = [...new Set(combined.notlar)];

    // birim_fiyatlar için string olanları filtrele (sadece object formatını al)
    // ve normalize et (farklı key isimleri: kalem/is_kalemi/kalem_adi, birim/birimi, miktar/miktari, fiyat/birim_fiyat/birim_fiyati/tutari)
    combined.birim_fiyatlar = combined.birim_fiyatlar
      .filter((item: any) => typeof item === 'object' && item !== null)
      .map((item: any) => ({
        kalem: item.kalem || item.is_kalemi || item.kalem_adi || item.aciklama || '-',
        birim: item.birim || item.birimi || '-',
        miktar: item.miktar || item.miktari || '-',
        fiyat: item.fiyat || item.birim_fiyat || item.birim_fiyati || item.tutari || item.toplam_tutari || '-',
      }));

    return combined;
  };

  // Dosya silme
  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Tüm dosyaları temizle
  const clearAllFiles = () => {
    setFiles([]);
    setCombinedResult(null);
    setError(null);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Math.round((bytes / k ** i) * 100) / 100} ${sizes[i]}`;
  };

  return (
    <Box
      style={{
        background: 'linear-gradient(180deg, rgba(139,92,246,0.05) 0%, rgba(255,255,255,0) 100%)',
        minHeight: '100vh',
      }}
    >
      <Container size="xl" py="xl">
        <Stack gap="xl">
          {/* Header */}
          <Box ta="center">
            <Group justify="center" mb="md">
              <ThemeIcon size={60} radius="xl" variant="gradient" gradient={{ from: 'violet', to: 'grape' }}>
                <IconSparkles size={32} />
              </ThemeIcon>
            </Group>
            <Title order={1}>🤖 Claude AI Döküman Analizi</Title>
            <Text c="dimmed" size="lg" mt="sm">
              Her türlü dökümanı yükleyin, Claude AI akıllıca analiz etsin
            </Text>
            <Group justify="center" mt="md" gap="xs">
              <Badge color="blue" variant="light">
                PDF
              </Badge>
              <Badge color="green" variant="light">
                PNG/JPG
              </Badge>
              <Badge color="orange" variant="light">
                Word
              </Badge>
              <Badge color="grape" variant="light">
                Excel
              </Badge>
              <Badge color="gray" variant="light">
                TXT
              </Badge>
            </Group>
          </Box>

          {/* Info Alert */}
          <Alert icon={<IconAlertCircle size={16} />} title="Claude AI Özellikleri" color="violet" variant="light">
            <List size="sm" spacing="xs">
              <List.Item>
                📄 <strong>PDF:</strong> Sayfa sayfa görsel analiz
              </List.Item>
              <List.Item>
                🖼️ <strong>Görseller:</strong> PNG, JPG, WEBP doğrudan analiz
              </List.Item>
              <List.Item>
                📝 <strong>Word:</strong> DOCX/DOC metin çıkarma ve analiz
              </List.Item>
              <List.Item>
                📊 <strong>Excel:</strong> XLSX/XLS tablo analizi
              </List.Item>
              <List.Item>
                📋 <strong>Metin:</strong> TXT/CSV dosya analizi
              </List.Item>
            </List>
          </Alert>

          {/* Dropzone */}
          <Card shadow="md" padding="xl" radius="lg" withBorder>
            <Dropzone
              onDrop={handleDrop}
              onReject={() => {
                notifications.show({
                  title: 'Hata',
                  message: 'Dosya reddedildi. Maksimum 50MB.',
                  color: 'red',
                  icon: <IconX size={16} />,
                });
              }}
              maxSize={50 * 1024 * 1024} // 50MB
              accept={{
                'application/pdf': ['.pdf'],
                'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.gif'],
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
                'application/msword': ['.doc'],
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
                'application/vnd.ms-excel': ['.xls'],
                'text/plain': ['.txt'],
                'text/csv': ['.csv'],
              }}
              disabled={uploading}
              multiple={true}
              useFsAccessApi={false}
            >
              <Group justify="center" gap="xl" style={{ minHeight: 200, pointerEvents: 'none' }}>
                <Dropzone.Accept>
                  <IconCheck size={52} style={{ color: 'var(--mantine-color-green-6)' }} />
                </Dropzone.Accept>
                <Dropzone.Reject>
                  <IconX size={52} style={{ color: 'var(--mantine-color-red-6)' }} />
                </Dropzone.Reject>
                <Dropzone.Idle>
                  <IconFile size={52} style={{ color: 'var(--mantine-color-violet-6)' }} />
                </Dropzone.Idle>

                <Box>
                  <Text size="xl" inline fw={600}>
                    Dökümanları sürükleyin veya tıklayın
                  </Text>
                  <Text size="sm" c="dimmed" inline mt={7}>
                    Birden fazla dosya seçebilirsiniz • PDF, PNG, JPG, DOCX, XLSX, TXT • Maks. 50MB
                  </Text>
                </Box>
              </Group>
            </Dropzone>
          </Card>

          {/* Dosya Listesi */}
          {files.length > 0 && (
            <Card withBorder>
              <Stack gap="md">
                <Group justify="space-between">
                  <Group>
                    <ThemeIcon size={40} color="violet" variant="light">
                      <IconFile size={24} />
                    </ThemeIcon>
                    <div>
                      <Text fw={600}>{files.length} Dosya Seçildi</Text>
                      <Text size="sm" c="dimmed">
                        {files.filter((f) => f.status === 'completed').length} tamamlandı,
                        {files.filter((f) => f.status === 'pending').length} bekliyor
                      </Text>
                    </div>
                  </Group>
                  <Group>
                    <Button variant="light" color="red" size="sm" onClick={clearAllFiles} disabled={uploading}>
                      Temizle
                    </Button>
                    <Button
                      onClick={handleAnalyzeAll}
                      loading={uploading}
                      leftSection={<IconFileAnalytics size={18} />}
                      size="lg"
                      variant="gradient"
                      gradient={{ from: 'violet', to: 'grape' }}
                    >
                      🤖 Tümünü Analiz Et ({files.filter((f) => f.status === 'pending' || f.status === 'error').length})
                    </Button>
                  </Group>
                </Group>

                <Divider />

                {/* Dosya Listesi */}
                <Stack gap="xs">
                  {files.map((fileItem, index) => (
                    <Paper
                      key={index}
                      p="sm"
                      withBorder
                      style={{
                        borderColor:
                          fileItem.status === 'completed'
                            ? 'var(--mantine-color-green-5)'
                            : fileItem.status === 'error'
                              ? 'var(--mantine-color-red-5)'
                              : fileItem.status === 'analyzing'
                                ? 'var(--mantine-color-blue-5)'
                                : undefined,
                      }}
                    >
                      <Group justify="space-between">
                        <Group>
                          <ThemeIcon
                            size={32}
                            variant="light"
                            color={
                              fileItem.status === 'completed'
                                ? 'green'
                                : fileItem.status === 'error'
                                  ? 'red'
                                  : fileItem.status === 'analyzing'
                                    ? 'blue'
                                    : 'gray'
                            }
                          >
                            {fileItem.status === 'completed' ? (
                              <IconCheck size={18} />
                            ) : fileItem.status === 'error' ? (
                              <IconX size={18} />
                            ) : fileItem.status === 'analyzing' ? (
                              <IconFileAnalytics size={18} />
                            ) : (
                              <IconFile size={18} />
                            )}
                          </ThemeIcon>
                          <div>
                            <Text size="sm" fw={500}>
                              {fileItem.file.name}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {formatFileSize(fileItem.file.size)} •{' '}
                              {getFileExtension(fileItem.file.name).toUpperCase().slice(1)}
                              {fileItem.status === 'analyzing' &&
                                fileItem.progress &&
                                ` • ${fileItem.progress.message}`}
                              {fileItem.status === 'error' && ` • ${fileItem.error}`}
                            </Text>
                          </div>
                        </Group>
                        <Group gap="xs">
                          <Badge
                            size="sm"
                            color={
                              fileItem.status === 'completed'
                                ? 'green'
                                : fileItem.status === 'error'
                                  ? 'red'
                                  : fileItem.status === 'analyzing'
                                    ? 'blue'
                                    : 'gray'
                            }
                          >
                            {fileItem.status === 'completed'
                              ? '✓ Tamamlandı'
                              : fileItem.status === 'error'
                                ? '✗ Hata'
                                : fileItem.status === 'analyzing'
                                  ? '⟳ Analiz...'
                                  : 'Bekliyor'}
                          </Badge>
                          {!uploading && (
                            <Button variant="subtle" color="red" size="xs" onClick={() => removeFile(index)}>
                              <IconX size={14} />
                            </Button>
                          )}
                        </Group>
                      </Group>
                      {fileItem.status === 'analyzing' && fileItem.progress?.progress !== undefined && (
                        <Progress value={fileItem.progress.progress} animated color="blue" size="xs" mt="xs" />
                      )}
                    </Paper>
                  ))}
                </Stack>
              </Stack>
            </Card>
          )}

          {/* Error */}
          {error && (
            <Alert color="red" title="❌ Analiz Hatası" icon={<IconAlertCircle size={16} />}>
              {error}
            </Alert>
          )}

          {/* Birleşik Sonuç - GELİŞMİŞ GÖRÜNÜM */}
          {combinedResult && (
            <Card withBorder p={0} style={{ overflow: 'hidden' }}>
              {/* Header */}
              <Box
                p="lg"
                style={{
                  background:
                    'linear-gradient(135deg, var(--mantine-color-green-6) 0%, var(--mantine-color-teal-6) 100%)',
                }}
              >
                <Group justify="space-between">
                  <Group>
                    <ThemeIcon size={50} color="white" variant="white" radius="xl">
                      <IconCheck size={28} color="var(--mantine-color-green-6)" />
                    </ThemeIcon>
                    <div>
                      <Title order={2} c="white">
                        ✅ Analiz Tamamlandı
                      </Title>
                      <Text c="white" opacity={0.9}>
                        {files.filter((f) => f.status === 'completed').length} döküman •
                        {combinedResult.teknik_sartlar?.length || 0} teknik şart •
                        {combinedResult.birim_fiyatlar?.length || 0} kalem •{combinedResult.notlar?.length || 0} not
                      </Text>
                    </div>
                  </Group>
                  <Group>
                    <Button
                      variant="white"
                      color="green"
                      leftSection={<IconDownload size={16} />}
                      onClick={() => {
                        const exportData = {
                          analiz_tarihi: new Date().toISOString(),
                          toplam_dokuman: files.length,
                          basarili_dokuman: files.filter((f) => f.status === 'completed').length,
                          dosyalar: files.map((f) => ({
                            ad: f.file.name,
                            boyut: f.file.size,
                            durum: f.status,
                            sonuc: f.result,
                          })),
                          birlesik_sonuc: combinedResult,
                        };
                        const dataStr = JSON.stringify(exportData, null, 2);
                        const dataBlob = new Blob([dataStr], { type: 'application/json' });
                        const url = URL.createObjectURL(dataBlob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = `ihale-analiz-${Date.now()}.json`;
                        link.click();
                      }}
                    >
                      JSON İndir
                    </Button>
                    <Button
                      variant="white"
                      color="green"
                      leftSection={<IconCheck size={16} />}
                      onClick={() => {
                        // LocalStorage'a kaydet
                        const savedTenders = JSON.parse(localStorage.getItem('savedTenders') || '[]');
                        const newTender = {
                          id: `tender-${Date.now()}`,
                          ihale_basligi: combinedResult.ihale_basligi || 'İsimsiz İhale',
                          kurum: combinedResult.kurum || '',
                          tarih: combinedResult.tarih || '',
                          bedel: combinedResult.bedel || '',
                          sure: combinedResult.sure || '',
                          status: 'bekliyor',
                          notlar: '',
                          created_at: new Date().toISOString(),
                          dokuman_sayisi: files.filter((f) => f.status === 'completed').length,
                          teknik_sart_sayisi: combinedResult.teknik_sartlar?.length || 0,
                          birim_fiyat_sayisi: combinedResult.birim_fiyatlar?.length || 0,
                          analiz_data: combinedResult,
                        };
                        savedTenders.push(newTender);
                        localStorage.setItem('savedTenders', JSON.stringify(savedTenders));

                        notifications.show({
                          title: '✅ İhale Kaydedildi!',
                          message: 'İhale Takibim sayfasından görüntüleyebilirsiniz',
                          color: 'green',
                          icon: <IconCheck size={16} />,
                        });
                      }}
                    >
                      Kaydet
                    </Button>
                  </Group>
                </Group>
              </Box>

              {/* İhale Bilgileri - Özet Kartları */}
              <Box p="lg" className="nested-card">
                <SimpleGrid cols={{ base: 2, sm: 3, md: 5 }} spacing="md">
                  {combinedResult.ihale_basligi && (
                    <Paper p="md" withBorder radius="md">
                      <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                        İhale Başlığı
                      </Text>
                      <Text size="sm" fw={500} lineClamp={2}>
                        {combinedResult.ihale_basligi}
                      </Text>
                    </Paper>
                  )}
                  {combinedResult.kurum && (
                    <Paper p="md" withBorder radius="md">
                      <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                        Kurum
                      </Text>
                      <Text size="sm" fw={500} lineClamp={2}>
                        {combinedResult.kurum}
                      </Text>
                    </Paper>
                  )}
                  {combinedResult.tarih && (
                    <Paper p="md" withBorder radius="md">
                      <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                        İhale Tarihi
                      </Text>
                      <Text size="sm" fw={500}>
                        {combinedResult.tarih}
                      </Text>
                    </Paper>
                  )}
                  {combinedResult.bedel && (
                    <Paper p="md" withBorder radius="md" style={{ borderColor: 'var(--mantine-color-green-5)' }}>
                      <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                        Tahmini Bedel
                      </Text>
                      <Text size="sm" fw={700} c="green">
                        {combinedResult.bedel}
                      </Text>
                    </Paper>
                  )}
                  {combinedResult.sure && (
                    <Paper p="md" withBorder radius="md">
                      <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                        İş Süresi
                      </Text>
                      <Text size="sm" fw={500}>
                        {combinedResult.sure}
                      </Text>
                    </Paper>
                  )}
                </SimpleGrid>
              </Box>

              {/* Detaylı Bilgiler - Tabs */}
              <Box p="lg">
                <Tabs defaultValue="teknik" variant="outline">
                  <Tabs.List grow>
                    <Tabs.Tab value="teknik" leftSection={<IconSettings size={16} />}>
                      Teknik Şartlar ({combinedResult.teknik_sartlar?.length || 0})
                    </Tabs.Tab>
                    <Tabs.Tab value="fiyat" leftSection={<IconCoin size={16} />}>
                      Birim Fiyatlar ({combinedResult.birim_fiyatlar?.length || 0})
                    </Tabs.Tab>
                    <Tabs.Tab value="notlar" leftSection={<IconNote size={16} />}>
                      Önemli Notlar ({combinedResult.notlar?.length || 0})
                    </Tabs.Tab>
                    <Tabs.Tab value="metin" leftSection={<IconClipboardList size={16} />}>
                      Tam Metin
                    </Tabs.Tab>
                  </Tabs.List>

                  {/* Teknik Şartlar */}
                  <Tabs.Panel value="teknik" pt="md">
                    {combinedResult.teknik_sartlar?.length > 0 ? (
                      <ScrollArea h={400} type="auto" offsetScrollbars>
                        <Stack gap="xs">
                          {combinedResult.teknik_sartlar.map((sart, i) => (
                            <Paper key={i} p="sm" radius="sm" className="nested-card">
                              <Group gap="xs" wrap="nowrap">
                                <Badge size="sm" variant="light" color="blue" circle>
                                  {i + 1}
                                </Badge>
                                <Text size="sm">{sart}</Text>
                              </Group>
                            </Paper>
                          ))}
                        </Stack>
                      </ScrollArea>
                    ) : (
                      <Text c="dimmed" ta="center" py="xl">
                        Teknik şart bulunamadı
                      </Text>
                    )}
                  </Tabs.Panel>

                  {/* Birim Fiyatlar */}
                  <Tabs.Panel value="fiyat" pt="md">
                    {combinedResult.birim_fiyatlar?.length > 0 ? (
                      <ScrollArea h={400} type="auto" offsetScrollbars>
                        <Table striped highlightOnHover withTableBorder>
                          <Table.Thead>
                            <Table.Tr>
                              <Table.Th w={50}>#</Table.Th>
                              <Table.Th>Kalem / Açıklama</Table.Th>
                              <Table.Th>Birim</Table.Th>
                              <Table.Th>Miktar</Table.Th>
                              <Table.Th ta="right">Fiyat</Table.Th>
                            </Table.Tr>
                          </Table.Thead>
                          <Table.Tbody>
                            {combinedResult.birim_fiyatlar.map((item: any, i) => (
                              <Table.Tr key={i}>
                                <Table.Td>{i + 1}</Table.Td>
                                <Table.Td>{item.kalem || item.aciklama || item.urun || '-'}</Table.Td>
                                <Table.Td>{item.birim || '-'}</Table.Td>
                                <Table.Td>{item.miktar || '-'}</Table.Td>
                                <Table.Td ta="right">
                                  <Badge color="green" variant="light">
                                    {item.fiyat || item.tutar || item.birim_fiyat || '-'}
                                  </Badge>
                                </Table.Td>
                              </Table.Tr>
                            ))}
                          </Table.Tbody>
                        </Table>
                      </ScrollArea>
                    ) : (
                      <Text c="dimmed" ta="center" py="xl">
                        Birim fiyat bulunamadı
                      </Text>
                    )}
                  </Tabs.Panel>

                  {/* Önemli Notlar */}
                  <Tabs.Panel value="notlar" pt="md">
                    {combinedResult.notlar?.length > 0 ? (
                      <ScrollArea h={400} type="auto" offsetScrollbars>
                        <Stack gap="xs">
                          {combinedResult.notlar.map((not, i) => (
                            <Paper key={i} p="sm" withBorder radius="sm">
                              <Group gap="xs" wrap="nowrap" align="flex-start">
                                <ThemeIcon size="sm" color="orange" variant="light" mt={2}>
                                  <IconNote size={12} />
                                </ThemeIcon>
                                <Text size="sm">{not}</Text>
                              </Group>
                            </Paper>
                          ))}
                        </Stack>
                      </ScrollArea>
                    ) : (
                      <Text c="dimmed" ta="center" py="xl">
                        Not bulunamadı
                      </Text>
                    )}
                  </Tabs.Panel>

                  {/* Tam Metin */}
                  <Tabs.Panel value="metin" pt="md">
                    {combinedResult.tam_metin ? (
                      <ScrollArea h={400} type="auto" offsetScrollbars>
                        <Paper p="md" className="nested-card">
                          <Text size="sm" style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                            {combinedResult.tam_metin}
                          </Text>
                        </Paper>
                      </ScrollArea>
                    ) : (
                      <Text c="dimmed" ta="center" py="xl">
                        Metin bulunamadı
                      </Text>
                    )}
                  </Tabs.Panel>
                </Tabs>
              </Box>
            </Card>
          )}

          {/* Claude Özellikleri */}
          <Card shadow="md" padding="xl" radius="lg" withBorder>
            <Title order={3} mb="md">
              🤖 Claude AI Özellikleri
            </Title>
            <List
              spacing="md"
              icon={
                <ThemeIcon color="violet" size={24} radius="xl">
                  <IconSparkles size={16} />
                </ThemeIcon>
              }
            >
              <List.Item>
                <Text fw={500}>Görsel PDF Analizi</Text>
                <Text size="sm" c="dimmed">
                  PDF'i sayfa sayfa görsele çevirerek analiz eder
                </Text>
              </List.Item>
              <List.Item>
                <Text fw={500}>Akıllı Metin Tanıma</Text>
                <Text size="sm" c="dimmed">
                  El yazısı ve baskı metinleri %99 doğrulukla okur
                </Text>
              </List.Item>
              <List.Item>
                <Text fw={500}>Tablo ve Form Tanıma</Text>
                <Text size="sm" c="dimmed">
                  Karmaşık tabloları ve formları yapısal olarak çıkarır
                </Text>
              </List.Item>
              <List.Item>
                <Text fw={500}>İçerik Analizi</Text>
                <Text size="sm" c="dimmed">
                  İhale şartnamelerine özel bilgi çıkarımı yapar
                </Text>
              </List.Item>
            </List>
          </Card>
        </Stack>
      </Container>
    </Box>
  );
}
