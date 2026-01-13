'use client';

import { useState, useRef } from 'react';
import { API_BASE_URL } from '@/lib/config';
import {
  Modal,
  Button,
  Stack,
  Group,
  Text,
  Select,
  Paper,
  Table,
  Badge,
  Alert,
  Progress,
  Stepper,
  FileButton,
  ScrollArea,
  Checkbox,
  ActionIcon,
  Tooltip,
  Box
} from '@mantine/core';
import {
  IconUpload,
  IconFileSpreadsheet,
  IconFileTypePdf,
  IconFile,
  IconRobot,
  IconCheck,
  IconX,
  IconAlertCircle,
  IconDownload,
  IconTrash
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

interface ImportModalProps {
  opened: boolean;
  onClose: () => void;
  defaultType?: 'personel' | 'stok' | 'cari' | 'fatura' | 'bordro';
  onSuccess?: () => void;
}

interface AnalysisResult {
  success: boolean;
  filename: string;
  format: string;
  targetType: string;
  targetTable: string;
  preview: any[];
  allRecords: any[];
  mapping: Record<string, string>;
  warnings: string[];
  stats: {
    total: number;
    valid: number;
    invalid: number;
  };
  tempFile: string;
}

const API_BASE = `${API_BASE_URL}/api`;

const typeLabels: Record<string, string> = {
  personel: 'Personel',
  fatura: 'Fatura',
  cari: 'Cari Hesap',
  stok: 'Stok',
  bordro: 'Bordro'
};

const formatIcons: Record<string, JSX.Element> = {
  PDF: <IconFileTypePdf size={20} color="red" />,
  Excel: <IconFileSpreadsheet size={20} color="green" />,
  CSV: <IconFileSpreadsheet size={20} color="teal" />,
  Word: <IconFile size={20} color="blue" />,
  Text: <IconFile size={20} color="gray" />,
  Image: <IconFile size={20} color="purple" />
};

export function ImportModal({ opened, onClose, defaultType = 'personel', onSuccess }: ImportModalProps) {
  const [step, setStep] = useState(0);
  const [targetType, setTargetType] = useState<string>(defaultType);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [selectedRecords, setSelectedRecords] = useState<number[]>([]);
  const resetRef = useRef<() => void>(null);

  const handleClose = async () => {
    // Eğer analiz yapıldıysa ve onaylanmadıysa iptal et
    if (analysisResult?.tempFile) {
      try {
        await fetch(`${API_BASE}/import/cancel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tempFile: analysisResult.tempFile })
        });
      } catch (e) {
        // Sessiz hata
      }
    }
    
    // Reset
    setStep(0);
    setFile(null);
    setAnalysisResult(null);
    setSelectedRecords([]);
    resetRef.current?.();
    onClose();
  };

  // Dosya yükle ve analiz et
  const handleAnalyze = async () => {
    if (!file || !targetType) return;

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('targetType', targetType);

      const response = await fetch(`${API_BASE}/import/analyze`, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error);
      }

      setAnalysisResult(data);
      // Tüm kayıtları seçili olarak işaretle
      setSelectedRecords(data.allRecords.map((_: any, i: number) => i));
      setStep(2);

      notifications.show({
        title: 'Analiz Tamamlandı',
        message: `${data.stats.total} kayıt bulundu, ${data.stats.valid} geçerli`,
        color: 'green',
        icon: <IconRobot size={18} />
      });

    } catch (error: any) {
      notifications.show({
        title: 'Analiz Hatası',
        message: error.message || 'Dosya analiz edilemedi',
        color: 'red',
        icon: <IconX size={18} />
      });
    } finally {
      setLoading(false);
    }
  };

  // Seçilen kayıtları onayla ve kaydet
  const handleConfirm = async () => {
    if (!analysisResult || selectedRecords.length === 0) return;

    setLoading(true);
    try {
      const recordsToImport = selectedRecords.map(i => analysisResult.allRecords[i]);

      const response = await fetch(`${API_BASE}/import/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType: analysisResult.targetType,
          records: recordsToImport,
          tempFile: analysisResult.tempFile
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error);
      }

      notifications.show({
        title: 'İçe Aktarım Başarılı',
        message: `${data.inserted} kayıt başarıyla eklendi${data.failed > 0 ? `, ${data.failed} hatalı` : ''}`,
        color: 'green',
        icon: <IconCheck size={18} />
      });

      onSuccess?.();
      handleClose();

    } catch (error: any) {
      notifications.show({
        title: 'Kayıt Hatası',
        message: error.message || 'Veriler kaydedilemedi',
        color: 'red',
        icon: <IconX size={18} />
      });
    } finally {
      setLoading(false);
    }
  };

  // Şablon indir
  const handleDownloadTemplate = () => {
    window.open(`${API_BASE}/import/template/${targetType}`, '_blank');
  };

  // Toggle tüm kayıtlar
  const toggleAll = () => {
    if (analysisResult) {
      if (selectedRecords.length === analysisResult.allRecords.length) {
        setSelectedRecords([]);
      } else {
        setSelectedRecords(analysisResult.allRecords.map((_, i) => i));
      }
    }
  };

  // Toggle tek kayıt
  const toggleRecord = (index: number) => {
    if (selectedRecords.includes(index)) {
      setSelectedRecords(selectedRecords.filter(i => i !== index));
    } else {
      setSelectedRecords([...selectedRecords, index]);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={
        <Group gap="xs">
          <IconUpload size={20} />
          <Text fw={600}>AI Destekli İçe Aktarım</Text>
        </Group>
      }
      size="xl"
      closeOnClickOutside={false}
    >
      <Stack gap="md">
        {/* Stepper */}
        <Stepper active={step} size="sm">
          <Stepper.Step label="Dosya Seç" description="Format seçin" />
          <Stepper.Step label="Yükle" description="Dosya yükleyin" />
          <Stepper.Step label="Önizleme" description="Kontrol edin" />
          <Stepper.Step label="Tamamla" description="Kaydet" />
        </Stepper>

        {/* Step 0: Hedef ve Format Seçimi */}
        {step === 0 && (
          <Stack gap="md">
            <Select
              label="Hedef Modül"
              description="Veriler nereye aktarılacak?"
              value={targetType}
              onChange={(val) => setTargetType(val || 'personel')}
              data={[
                { value: 'personel', label: '👥 Personel' },
                { value: 'bordro', label: '💰 Bordro (Maaş Tablosu)' },
                { value: 'stok', label: '📦 Stok' },
                { value: 'cari', label: '🏢 Cari Hesap' },
                { value: 'fatura', label: '🧾 Fatura' }
              ]}
            />

            <Alert color="blue" variant="light" icon={<IconRobot size={18} />}>
              <Text size="sm" fw={500}>AI Destekli İçe Aktarım</Text>
              <Text size="xs" c="dimmed" mt={4}>
                Desteklenen formatlar: Excel (.xlsx), PDF, Word (.docx), CSV, Görsel (OCR)
              </Text>
              <Text size="xs" c="dimmed">
                AI, dosyanızı analiz edip otomatik olarak eşleştirir.
              </Text>
            </Alert>

            <Group>
              <Button
                variant="light"
                leftSection={<IconDownload size={16} />}
                onClick={handleDownloadTemplate}
              >
                Örnek Şablon İndir
              </Button>
            </Group>

            <Group justify="flex-end">
              <Button onClick={() => setStep(1)}>
                Devam
              </Button>
            </Group>
          </Stack>
        )}

        {/* Step 1: Dosya Yükleme */}
        {step === 1 && (
          <Stack gap="md">
            <Paper
              withBorder
              p="xl"
              style={{
                borderStyle: 'dashed',
                textAlign: 'center',
                cursor: 'pointer'
              }}
            >
              <Stack align="center" gap="sm">
                {file ? (
                  <>
                    <IconFileSpreadsheet size={48} color="green" />
                    <Text fw={500}>{file.name}</Text>
                    <Text size="sm" c="dimmed">
                      {(file.size / 1024).toFixed(1)} KB
                    </Text>
                    <Button
                      variant="light"
                      color="red"
                      size="xs"
                      leftSection={<IconTrash size={14} />}
                      onClick={() => {
                        setFile(null);
                        resetRef.current?.();
                      }}
                    >
                      Kaldır
                    </Button>
                  </>
                ) : (
                  <>
                    <IconUpload size={48} color="gray" />
                    <Text c="dimmed">Dosya seçin veya sürükleyip bırakın</Text>
                    <FileButton
                      resetRef={resetRef}
                      onChange={setFile}
                      accept=".xlsx,.xls,.csv,.pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
                    >
                      {(props) => (
                        <Button {...props} variant="light">
                          Dosya Seç
                        </Button>
                      )}
                    </FileButton>
                  </>
                )}
              </Stack>
            </Paper>

            <Group justify="space-between">
              <Button variant="default" onClick={() => setStep(0)}>
                Geri
              </Button>
              <Button
                onClick={handleAnalyze}
                loading={loading}
                disabled={!file}
                leftSection={<IconRobot size={16} />}
              >
                AI ile Analiz Et
              </Button>
            </Group>
          </Stack>
        )}

        {/* Step 2: Önizleme */}
        {step === 2 && analysisResult && (
          <Stack gap="md">
            {/* Özet */}
            <Group justify="space-between">
              <Group gap="xs">
                {formatIcons[analysisResult.format]}
                <Text fw={500}>{analysisResult.filename}</Text>
                <Badge color="blue">{analysisResult.format}</Badge>
                <Badge color="green">{typeLabels[analysisResult.targetType]}</Badge>
              </Group>
              <Group gap="xs">
                <Badge color="teal" size="lg">
                  {analysisResult.stats.valid} / {analysisResult.stats.total} geçerli
                </Badge>
              </Group>
            </Group>

            {/* Uyarılar */}
            {analysisResult.warnings.length > 0 && (
              <Alert color="yellow" icon={<IconAlertCircle size={18} />}>
                <Text size="sm" fw={500}>Uyarılar:</Text>
                {analysisResult.warnings.slice(0, 5).map((w, i) => (
                  <Text key={i} size="xs" c="dimmed">• {w}</Text>
                ))}
                {analysisResult.warnings.length > 5 && (
                  <Text size="xs" c="dimmed">... ve {analysisResult.warnings.length - 5} uyarı daha</Text>
                )}
              </Alert>
            )}

            {/* Veri Tablosu */}
            <Paper withBorder>
              <ScrollArea h={300}>
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>
                        <Checkbox
                          checked={selectedRecords.length === analysisResult.allRecords.length}
                          indeterminate={selectedRecords.length > 0 && selectedRecords.length < analysisResult.allRecords.length}
                          onChange={toggleAll}
                        />
                      </Table.Th>
                      <Table.Th>#</Table.Th>
                      {Object.keys(analysisResult.preview[0] || {}).slice(0, 5).map(key => (
                        <Table.Th key={key}>{key}</Table.Th>
                      ))}
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {analysisResult.allRecords.map((record, i) => (
                      <Table.Tr key={i} bg={selectedRecords.includes(i) ? undefined : 'gray.1'}>
                        <Table.Td>
                          <Checkbox
                            checked={selectedRecords.includes(i)}
                            onChange={() => toggleRecord(i)}
                          />
                        </Table.Td>
                        <Table.Td>{i + 1}</Table.Td>
                        {Object.values(record).slice(0, 5).map((val: any, j) => (
                          <Table.Td key={j}>
                            <Text size="sm" lineClamp={1}>
                              {val ?? '-'}
                            </Text>
                          </Table.Td>
                        ))}
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            </Paper>

            <Text size="sm" c="dimmed" ta="center">
              {selectedRecords.length} kayıt seçili
            </Text>

            <Group justify="space-between">
              <Button
                variant="default"
                onClick={() => {
                  setStep(1);
                  setAnalysisResult(null);
                }}
              >
                Geri
              </Button>
              <Group>
                <Button
                  variant="light"
                  color="red"
                  onClick={handleClose}
                >
                  İptal
                </Button>
                <Button
                  onClick={handleConfirm}
                  loading={loading}
                  disabled={selectedRecords.length === 0}
                  leftSection={<IconCheck size={16} />}
                  color="green"
                >
                  {selectedRecords.length} Kaydı İçe Aktar
                </Button>
              </Group>
            </Group>
          </Stack>
        )}
      </Stack>
    </Modal>
  );
}

