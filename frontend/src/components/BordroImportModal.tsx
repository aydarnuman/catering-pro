'use client';

import {
  Alert,
  Badge,
  Box,
  Button,
  Checkbox,
  Divider,
  FileButton,
  Group,
  Modal,
  NumberInput,
  Paper,
  ScrollArea,
  Select,
  Stack,
  Stepper,
  Table,
  Text,
  TextInput,
  ThemeIcon,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconAlertCircle,
  IconBuildingFactory,
  IconCalendar,
  IconCash,
  IconCheck,
  IconFileSpreadsheet,
  IconRefresh,
  IconUpload,
  IconUserPlus,
  IconUsers,
  IconX,
} from '@tabler/icons-react';
import { useEffect, useRef, useState } from 'react';
import { API_BASE_URL } from '@/lib/config';

interface Proje {
  id: number;
  ad: string;
  kod: string | null;
  personel_sayisi: number;
}

interface BordroRecord {
  personel_id?: number;
  personel_adi: string;
  sistem_adi?: string;
  tc_kimlik?: string;
  sgk_no?: string;
  brut_maas?: number;
  net_maas?: number;
  eslestirme_tipi?: string;
}

interface TahakkukBilgisi {
  aylik_ucret_toplami: number | null;
  fazla_mesai_toplami: number | null;
  sair_odemeler_toplami: number | null;
  isveren_sgk_hissesi: number | null;
  isveren_issizlik: number | null;
  toplam_gider: number | null;
  odenecek_net_ucret: number | null;
  odenecek_sgk_primi: number | null;
  odenecek_gelir_vergisi: number | null;
  odenecek_damga_vergisi: number | null;
  odenecek_issizlik: number | null;
  toplam_odeme: number | null;
  toplam_sgk_primi: number | null;
}

interface Verification {
  personelTotals: {
    brut_toplam: number;
    net_toplam: number;
    sgk_isci: number;
    sgk_isveren: number;
    gelir_vergisi: number;
    damga_vergisi: number;
  };
  tahakkuk: TahakkukBilgisi;
  comparison: {
    brut: { personel: number; tahakkuk: number; match: boolean };
    net: { personel: number; tahakkuk: number; match: boolean };
    sgk_isveren: { personel: number; tahakkuk: number; match: boolean };
    gelir_vergisi: { personel: number; tahakkuk: number; match: boolean };
  };
  allMatch: boolean;
}

interface AnalysisResult {
  success: boolean;
  matched: BordroRecord[];
  unmatched: BordroRecord[];
  stats: {
    total: number;
    matched: number;
    unmatched: number;
  };
  existing: {
    kayit_sayisi: number;
    toplam_net: number;
  };
  warnings: string[];
  tempFile: string;
  originalFilename: string;
  // Template bilgisi
  templateInfo?: {
    aiUsed: boolean;
    usedTemplate: { id: number; ad: string } | null;
    suggestedMapping: any | null;
    formatSignature: string | null;
    canSaveTemplate: boolean;
  };
  // Çift katmanlı doğrulama
  tahakkuk?: TahakkukBilgisi | null;
  verification?: Verification | null;
}

interface BordroTemplate {
  id: number;
  ad: string;
  aciklama: string | null;
  proje_id: number | null;
  proje_adi: string | null;
  kullanim_sayisi: number;
  son_kullanim: string | null;
}

interface BordroImportModalProps {
  opened: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  defaultProjeId?: number;
}

const AYLAR = [
  { value: '1', label: 'Ocak' },
  { value: '2', label: 'Şubat' },
  { value: '3', label: 'Mart' },
  { value: '4', label: 'Nisan' },
  { value: '5', label: 'Mayıs' },
  { value: '6', label: 'Haziran' },
  { value: '7', label: 'Temmuz' },
  { value: '8', label: 'Ağustos' },
  { value: '9', label: 'Eylül' },
  { value: '10', label: 'Ekim' },
  { value: '11', label: 'Kasım' },
  { value: '12', label: 'Aralık' },
];

export function BordroImportModal({
  opened,
  onClose,
  onSuccess,
  defaultProjeId,
}: BordroImportModalProps) {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // Proje ve dönem
  const [projeler, setProjeler] = useState<Proje[]>([]);
  const [projeId, setProjeId] = useState<string | null>(defaultProjeId?.toString() || null);
  const [yil, setYil] = useState<number>(new Date().getFullYear());
  const [ay, setAy] = useState<string>((new Date().getMonth() + 1).toString());

  // Dosya ve analiz
  const [file, setFile] = useState<File | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [selectedRecords, setSelectedRecords] = useState<number[]>([]);

  // Template
  const [templates, setTemplates] = useState<BordroTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [forceAI, setForceAI] = useState(false);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');

  const resetRef = useRef<() => void>(null);

  // Projeleri ve template'leri yükle
  useEffect(() => {
    if (opened) {
      fetchProjeler();
      fetchTemplates();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened]);

  // Proje değişince template'leri filtrele
  useEffect(() => {
    if (projeId) {
      fetchTemplates();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projeId]);

  const fetchProjeler = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/bordro-import/projeler`);
      if (res.ok) {
        const data = await res.json();
        setProjeler(data);
      }
    } catch (error) {
      console.error('Proje yükleme hatası:', error);
    }
  };

  const fetchTemplates = async () => {
    try {
      const url =
        projeId && projeId !== '0'
          ? `${API_BASE_URL}/api/bordro-import/templates?projeId=${projeId}`
          : `${API_BASE_URL}/api/bordro-import/templates`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setTemplates(data);
      }
    } catch (error) {
      console.error('Template yükleme hatası:', error);
    }
  };

  const handleClose = async () => {
    // Temp dosyayı temizle
    if (analysisResult?.tempFile) {
      try {
        await fetch(`${API_BASE_URL}/api/bordro-import/cancel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tempFile: analysisResult.tempFile }),
        });
      } catch (_e) {}
    }

    // Reset
    setStep(0);
    setFile(null);
    setAnalysisResult(null);
    setSelectedRecords([]);
    setSelectedTemplateId(null);
    setForceAI(false);
    setShowSaveTemplate(false);
    setNewTemplateName('');
    resetRef.current?.();
    onClose();
  };

  // Dosya analizi
  const handleAnalyze = async () => {
    if (!file) return;

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('yil', yil.toString());
      formData.append('ay', ay);
      if (projeId && projeId !== '0') {
        formData.append('projeId', projeId);
      }
      // Template parametreleri
      if (forceAI) {
        formData.append('forceAI', 'true');
      }
      if (selectedTemplateId && !forceAI) {
        formData.append('templateId', selectedTemplateId);
      }

      const response = await fetch(`${API_BASE_URL}/api/bordro-import/analyze`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error);
      }

      setAnalysisResult(data);
      // Eşleşen tüm kayıtları seç
      setSelectedRecords(data.matched.map((_: any, i: number) => i));
      setStep(2);

      // Template bilgisi mesajı
      const templateInfo = data.templateInfo;
      if (templateInfo?.usedTemplate) {
        notifications.show({
          title: '⚡ Hızlı Analiz',
          message: `"${templateInfo.usedTemplate.ad}" şablonu kullanıldı - AI gerekmedi!`,
          color: 'teal',
          icon: <IconCheck size={18} />,
        });
      } else if (templateInfo?.aiUsed) {
        notifications.show({
          title: 'AI Analizi Tamamlandı',
          message: `${data.stats.matched} kayıt eşleşti${templateInfo.canSaveTemplate ? ' - Şablon olarak kaydedebilirsiniz' : ''}`,
          color: data.stats.unmatched > 0 ? 'yellow' : 'green',
          icon: <IconCheck size={18} />,
        });
      }
    } catch (error: any) {
      notifications.show({
        title: 'Analiz Hatası',
        message: error.message || 'Dosya analiz edilemedi',
        color: 'red',
        icon: <IconX size={18} />,
      });
    } finally {
      setLoading(false);
    }
  };

  // Template kaydet
  const handleSaveTemplate = async () => {
    if (!newTemplateName.trim() || !analysisResult?.templateInfo?.suggestedMapping) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/bordro-import/templates/from-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ad: newTemplateName,
          aciklama: `${file?.name} dosyasından otomatik oluşturuldu`,
          proje_id: projeId && projeId !== '0' ? parseInt(projeId, 10) : null,
          suggestedMapping: analysisResult.templateInfo.suggestedMapping,
          formatSignature: analysisResult.templateInfo.formatSignature,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error);
      }

      notifications.show({
        title: 'Şablon Kaydedildi',
        message: `"${newTemplateName}" şablonu sonraki yüklemelerde kullanılacak`,
        color: 'green',
        icon: <IconCheck size={18} />,
      });

      setShowSaveTemplate(false);
      setNewTemplateName('');
      fetchTemplates();
    } catch (error: any) {
      notifications.show({
        title: 'Kayıt Hatası',
        message: error.message || 'Şablon kaydedilemedi',
        color: 'red',
        icon: <IconX size={18} />,
      });
    } finally {
      setLoading(false);
    }
  };

  // Kaydet
  const handleConfirm = async () => {
    if (!analysisResult || selectedRecords.length === 0) return;

    setLoading(true);
    try {
      const recordsToImport = selectedRecords.map((i) => analysisResult.matched[i]);

      const response = await fetch(`${API_BASE_URL}/api/bordro-import/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projeId: projeId && projeId !== '0' ? parseInt(projeId, 10) : null,
          yil,
          ay: parseInt(ay, 10),
          records: recordsToImport,
          tempFile: analysisResult.tempFile,
          originalFilename: analysisResult.originalFilename,
          // PDF'den çekilen TAHAKKUK BİLGİLERİNİ de kaydet
          tahakkuk: analysisResult.tahakkuk || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error);
      }

      notifications.show({
        title: 'Bordro Kaydedildi',
        message: `${data.inserted} yeni kayıt, ${data.updated} güncelleme yapıldı`,
        color: 'green',
        icon: <IconCheck size={18} />,
      });

      onSuccess?.();
      handleClose();
    } catch (error: any) {
      notifications.show({
        title: 'Kayıt Hatası',
        message: error.message || 'Bordro kaydedilemedi',
        color: 'red',
        icon: <IconX size={18} />,
      });
    } finally {
      setLoading(false);
    }
  };

  // Tek personel oluştur
  const handleCreatePersonel = async (record: any, index: number) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/bordro-import/create-personel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personel_adi: record.personel_adi,
          tc_kimlik: record.tc_kimlik,
          sgk_no: record.sgk_no,
          brut_maas: record.brut_maas,
          projeId: projeId && projeId !== '0' ? parseInt(projeId, 10) : null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error);
      }

      // Personel oluşturuldu, listeyi güncelle
      if (analysisResult) {
        const updatedRecord = {
          ...record,
          personel_id: data.personel_id,
          sistem_adi: record.personel_adi,
          eslestirme_tipi: 'yeni_olusturuldu',
        };

        const newMatched = [...analysisResult.matched, updatedRecord];
        const newUnmatched = analysisResult.unmatched.filter((_: any, i: number) => i !== index);

        setAnalysisResult({
          ...analysisResult,
          matched: newMatched,
          unmatched: newUnmatched,
          stats: {
            ...analysisResult.stats,
            matched: newMatched.length,
            unmatched: newUnmatched.length,
          },
        });

        // Yeni kaydı seçili olarak ekle
        setSelectedRecords([...selectedRecords, newMatched.length - 1]);
      }

      notifications.show({
        title: 'Personel Oluşturuldu',
        message: `${record.personel_adi} sisteme eklendi`,
        color: 'green',
        icon: <IconCheck size={18} />,
      });
    } catch (error: any) {
      notifications.show({
        title: 'Oluşturma Hatası',
        message: error.message || 'Personel oluşturulamadı',
        color: 'red',
        icon: <IconX size={18} />,
      });
    }
  };

  // Tüm bulunamayanları oluştur
  const handleCreateAllPersonel = async () => {
    if (!analysisResult?.unmatched.length) return;

    setLoading(true);
    let successCount = 0;
    let failCount = 0;

    for (let i = analysisResult.unmatched.length - 1; i >= 0; i--) {
      try {
        const record = analysisResult.unmatched[i];
        const response = await fetch(`${API_BASE_URL}/api/bordro-import/create-personel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            personel_adi: record.personel_adi,
            tc_kimlik: record.tc_kimlik,
            sgk_no: record.sgk_no,
            brut_maas: record.brut_maas,
            projeId: projeId && projeId !== '0' ? parseInt(projeId, 10) : null,
          }),
        });

        const data = await response.json();

        if (response.ok) {
          const updatedRecord = {
            ...record,
            personel_id: data.personel_id,
            sistem_adi: record.personel_adi,
            eslestirme_tipi: 'yeni_olusturuldu',
          };

          analysisResult.matched.push(updatedRecord);
          analysisResult.unmatched.splice(i, 1);
          successCount++;
        } else {
          failCount++;
        }
      } catch {
        failCount++;
      }
    }

    // State güncelle
    setAnalysisResult({
      ...analysisResult,
      stats: {
        ...analysisResult.stats,
        matched: analysisResult.matched.length,
        unmatched: analysisResult.unmatched.length,
      },
    });

    // Tüm yeni kayıtları seç
    setSelectedRecords(analysisResult.matched.map((_: any, i: number) => i));

    setLoading(false);

    notifications.show({
      title: 'Toplu Oluşturma Tamamlandı',
      message: `${successCount} personel oluşturuldu${failCount > 0 ? `, ${failCount} hata` : ''}`,
      color: failCount > 0 ? 'yellow' : 'green',
      icon: <IconCheck size={18} />,
    });
  };

  // Seçim toggle
  const toggleAll = () => {
    if (analysisResult) {
      if (selectedRecords.length === analysisResult.matched.length) {
        setSelectedRecords([]);
      } else {
        setSelectedRecords(analysisResult.matched.map((_, i) => i));
      }
    }
  };

  const toggleRecord = (index: number) => {
    if (selectedRecords.includes(index)) {
      setSelectedRecords(selectedRecords.filter((i) => i !== index));
    } else {
      setSelectedRecords([...selectedRecords, index]);
    }
  };

  const selectedProje = projeler.find((p) => p.id.toString() === projeId);

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={
        <Group gap="xs">
          <ThemeIcon color="green" variant="light">
            <IconCash size={18} />
          </ThemeIcon>
          <Text fw={600}>Bordro İçe Aktarım</Text>
        </Group>
      }
      size="xl"
      closeOnClickOutside={false}
    >
      <Stack gap="md">
        {/* Stepper */}
        <Stepper active={step} size="sm">
          <Stepper.Step
            label="Proje & Dönem"
            description="Seçim yapın"
            icon={<IconCalendar size={18} />}
          />
          <Stepper.Step
            label="Dosya"
            description="Dosya yükleyin"
            icon={<IconFileSpreadsheet size={18} />}
          />
          <Stepper.Step
            label="Eşleştirme"
            description="Kontrol edin"
            icon={<IconUsers size={18} />}
          />
          <Stepper.Step label="Kaydet" description="Tamamla" icon={<IconCheck size={18} />} />
        </Stepper>

        {/* Step 0: Proje ve Dönem Seçimi */}
        {step === 0 && (
          <Stack gap="md">
            <Paper withBorder p="md">
              <Stack gap="md">
                <Select
                  label="Proje"
                  description="Bordro hangi projeye ait?"
                  placeholder="Proje seçin"
                  value={projeId}
                  onChange={setProjeId}
                  data={[
                    { value: '0', label: '📊 Genel (Proje bağımsız)' },
                    ...projeler.map((p) => ({
                      value: p.id.toString(),
                      label: `📁 ${p.ad}${p.kod ? ` (${p.kod})` : ''} - ${p.personel_sayisi} personel`,
                    })),
                  ]}
                  searchable
                  leftSection={<IconBuildingFactory size={16} />}
                />

                {selectedProje && (
                  <Alert color="blue" variant="light" icon={<IconUsers size={18} />}>
                    <Text size="sm">
                      <strong>{selectedProje.ad}</strong> projesinde{' '}
                      <strong>{selectedProje.personel_sayisi}</strong> aktif personel var.
                    </Text>
                  </Alert>
                )}

                <Divider label="Bordro Dönemi" labelPosition="center" />

                <Group grow>
                  <NumberInput
                    label="Yıl"
                    value={yil}
                    onChange={(val) => setYil(val as number)}
                    min={2020}
                    max={2030}
                    leftSection={<IconCalendar size={16} />}
                  />
                  <Select
                    label="Ay"
                    value={ay}
                    onChange={(val) => setAy(val || '1')}
                    data={AYLAR}
                    leftSection={<IconCalendar size={16} />}
                  />
                </Group>
              </Stack>
            </Paper>

            <Group justify="flex-end">
              <Button onClick={() => setStep(1)}>Devam →</Button>
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
                cursor: 'pointer',
              }}
            >
              <Stack align="center" gap="sm">
                {file ? (
                  <>
                    <ThemeIcon size={60} color="green" variant="light">
                      <IconFileSpreadsheet size={36} />
                    </ThemeIcon>
                    <Text fw={500}>{file.name}</Text>
                    <Text size="sm" c="dimmed">
                      {(file.size / 1024).toFixed(1)} KB
                    </Text>
                    <Button
                      variant="light"
                      color="red"
                      size="xs"
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
                    <ThemeIcon size={60} color="gray" variant="light">
                      <IconUpload size={36} />
                    </ThemeIcon>
                    <Text c="dimmed">Bordro dosyasını seçin (Excel veya PDF)</Text>
                    <FileButton
                      resetRef={resetRef}
                      onChange={setFile}
                      accept=".xlsx,.xls,.csv,.pdf"
                    >
                      {(props) => (
                        <Button {...props} variant="light">
                          Dosya Seç
                        </Button>
                      )}
                    </FileButton>
                    <Text size="xs" c="dimmed">
                      Desteklenen: Excel (.xlsx, .xls), CSV, PDF
                    </Text>
                  </>
                )}
              </Stack>
            </Paper>

            {/* Template seçimi */}
            {templates.length > 0 && (
              <Paper withBorder p="sm">
                <Stack gap="xs">
                  <Group justify="space-between">
                    <Text size="sm" fw={500}>
                      ⚡ Hızlı Şablon
                    </Text>
                    <Checkbox
                      size="xs"
                      label="Her zaman AI kullan"
                      checked={forceAI}
                      onChange={(e) => {
                        setForceAI(e.target.checked);
                        if (e.target.checked) setSelectedTemplateId(null);
                      }}
                    />
                  </Group>
                  {!forceAI && (
                    <Select
                      size="sm"
                      placeholder="Şablon seçin (otomatik algılama)"
                      value={selectedTemplateId}
                      onChange={setSelectedTemplateId}
                      clearable
                      data={[
                        { value: '', label: '🔍 Otomatik Algıla' },
                        ...templates.map((t) => ({
                          value: t.id.toString(),
                          label: `📋 ${t.ad}${t.proje_adi ? ` (${t.proje_adi})` : ''} - ${t.kullanim_sayisi} kullanım`,
                        })),
                      ]}
                    />
                  )}
                  <Text size="xs" c="dimmed">
                    {forceAI
                      ? '⚠️ AI her seferinde kullanılacak (daha yavaş)'
                      : '✨ Kayıtlı şablon varsa AI kullanılmadan hızlı parse yapılır'}
                  </Text>
                </Stack>
              </Paper>
            )}

            {/* Özet bilgi */}
            <Paper withBorder p="sm" bg="gray.0">
              <Group justify="space-between">
                <Text size="sm">
                  <strong>Proje:</strong> {selectedProje?.ad || 'Genel'}
                </Text>
                <Text size="sm">
                  <strong>Dönem:</strong> {AYLAR.find((a) => a.value === ay)?.label} {yil}
                </Text>
              </Group>
            </Paper>

            <Group justify="space-between">
              <Button variant="default" onClick={() => setStep(0)}>
                ← Geri
              </Button>
              <Button
                onClick={handleAnalyze}
                loading={loading}
                disabled={!file}
                leftSection={<IconRefresh size={16} />}
              >
                {forceAI || !templates.length ? 'AI ile Analiz Et' : 'Analiz Et'}
              </Button>
            </Group>
          </Stack>
        )}

        {/* Step 2: Eşleştirme Önizleme */}
        {step === 2 && analysisResult && (
          <Stack gap="md">
            {/* Özet */}
            <Paper withBorder p="sm">
              <Group justify="space-between">
                <Group gap="xs">
                  <Badge color="green" size="lg">
                    ✅ {analysisResult.stats.matched} Eşleşti
                  </Badge>
                  {analysisResult.stats.unmatched > 0 && (
                    <Badge color="yellow" size="lg">
                      ⚠️ {analysisResult.stats.unmatched} Bulunamadı
                    </Badge>
                  )}
                  {analysisResult.templateInfo?.usedTemplate && (
                    <Badge color="teal" size="lg" variant="light">
                      ⚡ {analysisResult.templateInfo.usedTemplate.ad}
                    </Badge>
                  )}
                </Group>
                <Text size="sm" c="dimmed">
                  Toplam: {analysisResult.stats.total} kayıt
                </Text>
              </Group>
            </Paper>

            {/* Template kaydetme seçeneği */}
            {analysisResult.templateInfo?.canSaveTemplate && !showSaveTemplate && (
              <Alert color="teal" variant="light" icon={<IconCheck size={18} />}>
                <Group justify="space-between" align="center">
                  <Text size="sm">
                    Bu format için şablon kaydedin - sonraki yüklemelerde AI gerekmez!
                  </Text>
                  <Button
                    size="xs"
                    variant="light"
                    color="teal"
                    onClick={() => setShowSaveTemplate(true)}
                  >
                    Şablon Kaydet
                  </Button>
                </Group>
              </Alert>
            )}

            {showSaveTemplate && (
              <Paper withBorder p="sm" bg="teal.0">
                <Stack gap="xs">
                  <Text size="sm" fw={500}>
                    💾 Şablon Olarak Kaydet
                  </Text>
                  <Group>
                    <TextInput
                      placeholder="Şablon adı (örn: Hezar Dinari Bordro)"
                      value={newTemplateName}
                      onChange={(e) => setNewTemplateName(e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <Button
                      size="sm"
                      color="teal"
                      onClick={handleSaveTemplate}
                      loading={loading}
                      disabled={!newTemplateName.trim()}
                    >
                      Kaydet
                    </Button>
                    <Button
                      size="sm"
                      variant="subtle"
                      color="gray"
                      onClick={() => {
                        setShowSaveTemplate(false);
                        setNewTemplateName('');
                      }}
                    >
                      İptal
                    </Button>
                  </Group>
                  <Text size="xs" c="dimmed">
                    Bu şablon, aynı formattaki dosyaları AI olmadan anında işleyecek
                  </Text>
                </Stack>
              </Paper>
            )}

            {/* 🔥 TAHAKKUK DOĞRULAMA - Çift Katmanlı Kontrol */}
            {analysisResult.verification && (
              <Paper
                withBorder
                p="sm"
                bg={analysisResult.verification.allMatch ? 'green.0' : 'red.0'}
              >
                <Stack gap="xs">
                  <Group gap="xs">
                    {analysisResult.verification.allMatch ? (
                      <Badge color="green" size="lg" leftSection={<IconCheck size={14} />}>
                        ✅ DOĞRULAMA BAŞARILI
                      </Badge>
                    ) : (
                      <Badge color="red" size="lg" leftSection={<IconAlertCircle size={14} />}>
                        ⚠️ TOPLAMLAR UYUŞMUYOR
                      </Badge>
                    )}
                    <Text size="xs" c="dimmed">
                      PDF&apos;deki TAHAKKUK BİLGİLERİ ile karşılaştırıldı
                    </Text>
                  </Group>

                  <Table withTableBorder fz="xs">
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Alan</Table.Th>
                        <Table.Th ta="right">PDF (TAHAKKUK)</Table.Th>
                        <Table.Th ta="right">Personel Toplamı</Table.Th>
                        <Table.Th ta="center">Durum</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      <Table.Tr>
                        <Table.Td>Brüt Toplam</Table.Td>
                        <Table.Td ta="right">
                          {analysisResult.verification.tahakkuk.aylik_ucret_toplami?.toLocaleString(
                            'tr-TR'
                          )}{' '}
                          ₺
                        </Table.Td>
                        <Table.Td ta="right">
                          {analysisResult.verification.personelTotals.brut_toplam.toLocaleString(
                            'tr-TR'
                          )}{' '}
                          ₺
                        </Table.Td>
                        <Table.Td ta="center">
                          {analysisResult.verification.comparison.brut.match ? (
                            <Badge color="green" size="xs">
                              ✓
                            </Badge>
                          ) : (
                            <Badge color="red" size="xs">
                              ✗
                            </Badge>
                          )}
                        </Table.Td>
                      </Table.Tr>
                      <Table.Tr>
                        <Table.Td>Net Maaş</Table.Td>
                        <Table.Td ta="right">
                          {analysisResult.verification.tahakkuk.odenecek_net_ucret?.toLocaleString(
                            'tr-TR'
                          )}{' '}
                          ₺
                        </Table.Td>
                        <Table.Td ta="right">
                          {analysisResult.verification.personelTotals.net_toplam.toLocaleString(
                            'tr-TR'
                          )}{' '}
                          ₺
                        </Table.Td>
                        <Table.Td ta="center">
                          {analysisResult.verification.comparison.net.match ? (
                            <Badge color="green" size="xs">
                              ✓
                            </Badge>
                          ) : (
                            <Badge color="red" size="xs">
                              ✗
                            </Badge>
                          )}
                        </Table.Td>
                      </Table.Tr>
                      <Table.Tr>
                        <Table.Td>İşveren SGK</Table.Td>
                        <Table.Td ta="right">
                          {analysisResult.verification.tahakkuk.isveren_sgk_hissesi?.toLocaleString(
                            'tr-TR'
                          )}{' '}
                          ₺
                        </Table.Td>
                        <Table.Td ta="right">
                          {analysisResult.verification.personelTotals.sgk_isveren.toLocaleString(
                            'tr-TR'
                          )}{' '}
                          ₺
                        </Table.Td>
                        <Table.Td ta="center">
                          {analysisResult.verification.comparison.sgk_isveren.match ? (
                            <Badge color="green" size="xs">
                              ✓
                            </Badge>
                          ) : (
                            <Badge color="red" size="xs">
                              ✗
                            </Badge>
                          )}
                        </Table.Td>
                      </Table.Tr>
                      <Table.Tr>
                        <Table.Td>Gelir Vergisi</Table.Td>
                        <Table.Td ta="right">
                          {analysisResult.verification.tahakkuk.odenecek_gelir_vergisi?.toLocaleString(
                            'tr-TR'
                          )}{' '}
                          ₺
                        </Table.Td>
                        <Table.Td ta="right">
                          {analysisResult.verification.personelTotals.gelir_vergisi.toLocaleString(
                            'tr-TR'
                          )}{' '}
                          ₺
                        </Table.Td>
                        <Table.Td ta="center">
                          {analysisResult.verification.comparison.gelir_vergisi.match ? (
                            <Badge color="green" size="xs">
                              ✓
                            </Badge>
                          ) : (
                            <Badge color="red" size="xs">
                              ✗
                            </Badge>
                          )}
                        </Table.Td>
                      </Table.Tr>
                    </Table.Tbody>
                  </Table>

                  {!analysisResult.verification.allMatch && (
                    <Alert color="orange" variant="light" icon={<IconAlertCircle size={16} />}>
                      <Text size="xs">
                        Toplamlar uyuşmuyor! PDF&apos;den bazı değerler eksik çekilmiş olabilir.
                        Yine de kaydetmek isterseniz devam edebilirsiniz.
                      </Text>
                    </Alert>
                  )}
                </Stack>
              </Paper>
            )}

            {/* TAHAKKUK BİLGİLERİ Özet (verification yoksa ama tahakkuk varsa) */}
            {analysisResult.tahakkuk && !analysisResult.verification && (
              <Paper withBorder p="sm" bg="blue.0">
                <Stack gap="xs">
                  <Text size="sm" fw={500}>
                    📊 PDF&apos;den Alınan TAHAKKUK BİLGİLERİ
                  </Text>
                  <Group grow>
                    <Box>
                      <Text size="xs" c="dimmed">
                        Brüt Toplam
                      </Text>
                      <Text size="sm" fw={500}>
                        {analysisResult.tahakkuk.aylik_ucret_toplami?.toLocaleString('tr-TR')} ₺
                      </Text>
                    </Box>
                    <Box>
                      <Text size="xs" c="dimmed">
                        Net Ücret
                      </Text>
                      <Text size="sm" fw={500}>
                        {analysisResult.tahakkuk.odenecek_net_ucret?.toLocaleString('tr-TR')} ₺
                      </Text>
                    </Box>
                    <Box>
                      <Text size="xs" c="dimmed">
                        Toplam Maliyet
                      </Text>
                      <Text size="sm" fw={500}>
                        {analysisResult.tahakkuk.toplam_gider?.toLocaleString('tr-TR')} ₺
                      </Text>
                    </Box>
                  </Group>
                </Stack>
              </Paper>
            )}

            {/* Mevcut kayıt uyarısı */}
            {analysisResult.existing.kayit_sayisi > 0 && (
              <Alert color="yellow" icon={<IconAlertCircle size={18} />}>
                <Text size="sm">
                  Bu dönem için <strong>{analysisResult.existing.kayit_sayisi}</strong> kayıt zaten
                  var. İçe aktarım yapılırsa mevcut kayıtlar <strong>güncellenecek</strong>.
                </Text>
              </Alert>
            )}

            {/* Uyarılar */}
            {analysisResult.warnings.length > 0 && (
              <Alert color="orange" variant="light" icon={<IconAlertCircle size={18} />}>
                <Text size="sm" fw={500}>
                  Uyarılar:
                </Text>
                {analysisResult.warnings.slice(0, 3).map((w, i) => (
                  <Text key={i} size="xs" c="dimmed">
                    • {w}
                  </Text>
                ))}
              </Alert>
            )}

            {/* Eşleşenler tablosu */}
            {analysisResult.matched.length > 0 && (
              <Paper withBorder>
                <Box p="xs" bg="green.0">
                  <Text size="sm" fw={500} c="green.8">
                    ✅ Eşleşen Kayıtlar ({analysisResult.matched.length})
                  </Text>
                </Box>
                <ScrollArea h={200}>
                  <Table striped highlightOnHover fz="sm">
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>
                          <Checkbox
                            checked={selectedRecords.length === analysisResult.matched.length}
                            indeterminate={
                              selectedRecords.length > 0 &&
                              selectedRecords.length < analysisResult.matched.length
                            }
                            onChange={toggleAll}
                          />
                        </Table.Th>
                        <Table.Th>Personel</Table.Th>
                        <Table.Th>TC Kimlik</Table.Th>
                        <Table.Th ta="right">Brüt</Table.Th>
                        <Table.Th ta="right">Net</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {analysisResult.matched.map((record, i) => (
                        <Table.Tr key={i}>
                          <Table.Td>
                            <Checkbox
                              checked={selectedRecords.includes(i)}
                              onChange={() => toggleRecord(i)}
                            />
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm" fw={500}>
                              {record.personel_adi}
                            </Text>
                            {record.sistem_adi && record.sistem_adi !== record.personel_adi && (
                              <Text size="xs" c="dimmed">
                                → {record.sistem_adi}
                              </Text>
                            )}
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm" ff="monospace">
                              {record.tc_kimlik || '-'}
                            </Text>
                          </Table.Td>
                          <Table.Td ta="right">
                            <Text size="sm">{record.brut_maas?.toLocaleString('tr-TR')} ₺</Text>
                          </Table.Td>
                          <Table.Td ta="right">
                            <Text size="sm" fw={500} c="green">
                              {record.net_maas?.toLocaleString('tr-TR')} ₺
                            </Text>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </ScrollArea>
              </Paper>
            )}

            {/* Eşleşmeyenler tablosu */}
            {analysisResult.unmatched.length > 0 && (
              <Paper withBorder>
                <Box p="xs" bg="yellow.0">
                  <Group justify="space-between">
                    <Text size="sm" fw={500} c="yellow.8">
                      ⚠️ Bulunamayan Kayıtlar ({analysisResult.unmatched.length})
                    </Text>
                    <Button
                      size="xs"
                      variant="filled"
                      color="blue"
                      leftSection={<IconUserPlus size={14} />}
                      onClick={handleCreateAllPersonel}
                      loading={loading}
                    >
                      Tümünü Oluştur ({analysisResult.unmatched.length})
                    </Button>
                  </Group>
                </Box>
                <ScrollArea h={150}>
                  <Table striped fz="sm">
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Personel</Table.Th>
                        <Table.Th>TC Kimlik</Table.Th>
                        <Table.Th>Net Maaş</Table.Th>
                        <Table.Th>İşlem</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {analysisResult.unmatched.map((record, i) => (
                        <Table.Tr key={i}>
                          <Table.Td>
                            <Text size="sm">{record.personel_adi}</Text>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm" ff="monospace">
                              {record.tc_kimlik || '-'}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm">{record.net_maas?.toLocaleString('tr-TR')} ₺</Text>
                          </Table.Td>
                          <Table.Td>
                            <Button
                              size="xs"
                              variant="light"
                              color="blue"
                              leftSection={<IconUserPlus size={14} />}
                              onClick={() => handleCreatePersonel(record, i)}
                            >
                              Oluştur
                            </Button>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </ScrollArea>
                <Box p="xs" bg="gray.0">
                  <Text size="xs" c="dimmed">
                    "Oluştur" ile personeli sisteme ekleyip projeye atayabilirsiniz.
                  </Text>
                </Box>
              </Paper>
            )}

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
                ← Geri
              </Button>
              <Group>
                <Button variant="light" color="red" onClick={handleClose}>
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

export default BordroImportModal;
