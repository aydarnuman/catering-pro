'use client';

import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Container,
  Group,
  Loader,
  Paper,
  Progress,
  RingProgress,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Timeline,
  Title,
  Tooltip,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconBrain,
  IconCheck,
  IconCloud,
  IconCloudUpload,
  IconDatabase,
  IconFileText,
  IconHeartbeat,
  IconPlayerPlay,
  IconRefresh,
  IconRocket,
  IconTable,
  IconTrendingUp,
} from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface RetrainStatus {
  shouldRetrain: boolean;
  pendingCorrections: number;
  pendingSyncCount: number;
  threshold: number;
  isTraining: boolean;
  currentTraining: {
    modelId: string;
    startedAt: string;
    status: string;
    correctionCount?: number;
  } | null;
  stats: {
    total: string;
    pending_training: string;
    pending_sync: string;
    tenders: string;
    documents: string;
  };
  model: {
    activeModelId: string;
    trained_corrections: string;
    pending_corrections: string;
    oldest_pending: string | null;
    last_training_date: string | null;
  };
}

interface TrainResult {
  success: boolean;
  modelId?: string;
  correctionCount?: number;
  elapsed?: number;
  error?: string;
}

interface AzureHealth {
  healthy: boolean;
  customModelId?: string;
  customModelExists?: boolean;
  availableModels?: number;
  elapsed_ms?: number;
  error?: string;
}

interface AzureModelDetail {
  modelId: string;
  description: string;
  createdDateTime: string;
  expirationDateTime?: string;
  averageAccuracy: number | null;
  trainingDocumentCount?: number;
  docTypes: Array<{
    docType: string;
    fieldCount: number;
    buildMode: string;
    fields: Array<{ name: string; type: string; description: string }>;
    fieldConfidence: Record<string, number>;
  }>;
}

interface AzureModels {
  models: Array<{
    modelId: string;
    description: string;
    createdDateTime: string;
  }>;
  total: number;
}

export default function ModelEgitimiPage() {
  const router = useRouter();
  const [status, setStatus] = useState<RetrainStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [training, setTraining] = useState(false);
  const [trainResult, setTrainResult] = useState<TrainResult | null>(null);
  const [azureHealth, setAzureHealth] = useState<AzureHealth | null>(null);
  const [azureModels, setAzureModels] = useState<AzureModels | null>(null);
  const [activeModelDetail, setActiveModelDetail] = useState<AzureModelDetail | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const [statusRes, healthRes, modelsRes] = await Promise.all([
        api.get('/api/analysis-corrections/retrain/status').catch(() => null),
        api.get('/api/analysis-corrections/azure/health').catch(() => null),
        api.get('/api/analysis-corrections/azure/models').catch(() => null),
      ]);

      if (statusRes?.data?.success) {
        setStatus(statusRes.data.data);

        // Aktif modelin detayini al
        const activeId = statusRes.data.data?.model?.activeModelId;
        if (activeId) {
          const detailRes = await api.get(`/api/analysis-corrections/azure/models/${activeId}`).catch(() => null);
          if (detailRes?.data?.success) {
            setActiveModelDetail(detailRes.data.data.model);
          }
        }
      }
      if (healthRes?.data) setAzureHealth(healthRes.data.data);
      if (modelsRes?.data?.success) setAzureModels(modelsRes.data.data);
    } catch (err) {
      console.error('Status alınamadı:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 15000); // 15sn
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleTriggerTraining = async () => {
    if (!confirm('Model eğitimini başlatmak istediğinize emin misiniz? Bu işlem 10-30 dakika sürebilir.')) {
      return;
    }
    setTraining(true);
    setTrainResult(null);
    try {
      const res = await api.post('/api/analysis-corrections/retrain/trigger');
      setTrainResult(res.data?.data || res.data);
      fetchStatus(); // Durumu yenile
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } }; message?: string };
      setTrainResult({
        success: false,
        error: error.response?.data?.error || error.message || 'Bilinmeyen hata',
      });
    } finally {
      setTraining(false);
    }
  };

  const handleSyncBlob = async () => {
    try {
      await api.post('/api/analysis-corrections/sync');
      fetchStatus();
    } catch (err) {
      console.error('Blob sync hatası:', err);
    }
  };

  const pendingCount = parseInt(status?.stats?.pending_training || '0', 10);
  const totalCount = parseInt(status?.stats?.total || '0', 10);
  const trainedCount = parseInt(status?.model?.trained_corrections || '0', 10);
  const pendingSyncCount = parseInt(status?.stats?.pending_sync || '0', 10);
  const threshold = status?.threshold || 50;
  const thresholdProgress = Math.min((pendingCount / threshold) * 100, 100);

  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        {/* Header */}
        <Group justify="space-between">
          <Group gap="md">
            <ActionIcon variant="subtle" size="lg" onClick={() => router.push('/admin')}>
              <IconArrowLeft size={20} />
            </ActionIcon>
            <div>
              <Group gap="sm" mb={4}>
                <ThemeIcon size="lg" radius="md" variant="gradient" gradient={{ from: 'cyan', to: 'blue' }}>
                  <IconBrain size={20} />
                </ThemeIcon>
                <Title order={1} size="h2">
                  Model Egitimi
                </Title>
              </Group>
              <Text c="dimmed">Azure Document Intelligence model durumu ve egitim yonetimi</Text>
            </div>
          </Group>

          <Group>
            <Tooltip label="Yenile">
              <ActionIcon variant="light" size="lg" onClick={fetchStatus} loading={loading}>
                <IconRefresh size={18} />
              </ActionIcon>
            </Tooltip>
            {status?.model?.activeModelId && (
              <Badge size="lg" variant="light" color="cyan">
                {status.model.activeModelId}
              </Badge>
            )}
          </Group>
        </Group>

        {/* Eğitim devam ediyorsa uyarı */}
        {status?.isTraining && status.currentTraining && (
          <Alert icon={<Loader size={20} />} title="Egitim Devam Ediyor" color="blue" variant="light">
            <Text size="sm">
              Model <strong>{status.currentTraining.modelId}</strong> egitiliyor... Durum:{' '}
              {status.currentTraining.status}
              {status.currentTraining.correctionCount && ` (${status.currentTraining.correctionCount} duzeltme)`}
            </Text>
            <Text size="xs" c="dimmed" mt={4}>
              Baslangic: {new Date(status.currentTraining.startedAt).toLocaleString('tr-TR')}
            </Text>
          </Alert>
        )}

        {/* Eğitim sonucu */}
        {trainResult && (
          <Alert
            icon={trainResult.success ? <IconCheck size={20} /> : <IconAlertTriangle size={20} />}
            title={trainResult.success ? 'Egitim Basarili' : 'Egitim Basarisiz'}
            color={trainResult.success ? 'green' : 'red'}
            variant="light"
            withCloseButton
            onClose={() => setTrainResult(null)}
          >
            {trainResult.success ? (
              <Text size="sm">
                Model <strong>{trainResult.modelId}</strong> basariyla egitildi. {trainResult.correctionCount} duzeltme
                islendi. Sure: {((trainResult.elapsed || 0) / 1000).toFixed(0)} saniye.
              </Text>
            ) : (
              <Text size="sm">{trainResult.error}</Text>
            )}
          </Alert>
        )}

        {/* İstatistik kartları */}
        {loading ? (
          <SimpleGrid cols={{ base: 2, sm: 4 }}>
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} padding="lg" radius="md" className="stat-card" h={120} />
            ))}
          </SimpleGrid>
        ) : (
          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
            {/* Toplam Düzeltme */}
            <Card padding="lg" radius="md" className="stat-card">
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed">
                  Toplam Duzeltme
                </Text>
                <ThemeIcon variant="light" color="blue" size="sm" radius="xl">
                  <IconFileText size={14} />
                </ThemeIcon>
              </Group>
              <Text fw={700} size="xl">
                {totalCount}
              </Text>
              <Text size="xs" c="dimmed" mt={4}>
                {status?.stats?.tenders || 0} ihale, {status?.stats?.documents || 0} dokuman
              </Text>
            </Card>

            {/* Eğitim Bekleyen */}
            <Card padding="lg" radius="md" className="stat-card">
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed">
                  Egitim Bekleyen
                </Text>
                <ThemeIcon variant="light" color={pendingCount >= threshold ? 'orange' : 'gray'} size="sm" radius="xl">
                  <IconTrendingUp size={14} />
                </ThemeIcon>
              </Group>
              <Text fw={700} size="xl" c={pendingCount >= threshold ? 'orange' : undefined}>
                {pendingCount}
              </Text>
              <Progress
                value={thresholdProgress}
                size="xs"
                mt={4}
                color={pendingCount >= threshold ? 'orange' : 'blue'}
              />
              <Text size="xs" c="dimmed" mt={2}>
                Esik: {threshold}
              </Text>
            </Card>

            {/* Eğitilmiş */}
            <Card padding="lg" radius="md" className="stat-card">
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed">
                  Egitimde Kullanilan
                </Text>
                <ThemeIcon variant="light" color="green" size="sm" radius="xl">
                  <IconCheck size={14} />
                </ThemeIcon>
              </Group>
              <Text fw={700} size="xl" c="green">
                {trainedCount}
              </Text>
              {status?.model?.last_training_date && (
                <Text size="xs" c="dimmed" mt={4}>
                  Son: {new Date(status.model.last_training_date).toLocaleDateString('tr-TR')}
                </Text>
              )}
            </Card>

            {/* Blob Sync */}
            <Card padding="lg" radius="md" className="stat-card">
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed">
                  Blob Sync
                </Text>
                <ThemeIcon variant="light" color={pendingSyncCount > 0 ? 'yellow' : 'green'} size="sm" radius="xl">
                  <IconCloudUpload size={14} />
                </ThemeIcon>
              </Group>
              <Text fw={700} size="xl">
                {pendingSyncCount > 0 ? (
                  <span style={{ color: 'var(--mantine-color-yellow-6)' }}>{pendingSyncCount} bekliyor</span>
                ) : (
                  <span style={{ color: 'var(--mantine-color-green-6)' }}>Guncel</span>
                )}
              </Text>
              {pendingSyncCount > 0 && (
                <Button
                  size="compact-xs"
                  variant="light"
                  color="yellow"
                  mt={4}
                  onClick={handleSyncBlob}
                  leftSection={<IconCloudUpload size={12} />}
                >
                  Simdi Sync Et
                </Button>
              )}
            </Card>
          </SimpleGrid>
        )}

        {/* Ana İçerik - İki kolon */}
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
          {/* Sol: Eğitim Tetikleme */}
          <Paper p="lg" radius="md" className="standard-card">
            <Title order={4} mb="md">
              Egitim Tetikleme
            </Title>

            <Stack gap="md">
              {/* Eşik göstergesi */}
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <RingProgress
                  size={160}
                  thickness={14}
                  roundCaps
                  sections={[
                    {
                      value: thresholdProgress,
                      color: pendingCount >= threshold ? 'orange' : 'blue',
                    },
                  ]}
                  label={
                    <div style={{ textAlign: 'center' }}>
                      <Text size="xl" fw={700}>
                        {pendingCount}
                      </Text>
                      <Text size="xs" c="dimmed">
                        / {threshold}
                      </Text>
                    </div>
                  }
                />
              </div>

              {status?.shouldRetrain ? (
                <Alert color="orange" variant="light" icon={<IconAlertTriangle size={18} />}>
                  <Text size="sm" fw={500}>
                    Esik asildi! {pendingCount} duzeltme egitim bekliyor.
                  </Text>
                </Alert>
              ) : (
                <Alert color="blue" variant="light" icon={<IconBrain size={18} />}>
                  <Text size="sm">{threshold - pendingCount} duzeltme daha biriktiginde egitim onerilecek.</Text>
                </Alert>
              )}

              <Button
                size="lg"
                fullWidth
                variant="gradient"
                gradient={{ from: 'cyan', to: 'blue' }}
                leftSection={training ? <Loader size={18} color="white" /> : <IconPlayerPlay size={18} />}
                onClick={handleTriggerTraining}
                disabled={training || (status?.isTraining ?? false) || pendingCount === 0}
              >
                {training ? 'Egitim Baslatiliyor...' : 'Egitimi Baslat'}
              </Button>

              {pendingCount === 0 && (
                <Text size="xs" c="dimmed" ta="center">
                  Egitim icin en az 1 duzeltme gerekli
                </Text>
              )}
            </Stack>
          </Paper>

          {/* Sağ: Model Bilgileri ve Pipeline */}
          <Paper p="lg" radius="md" className="standard-card">
            <Title order={4} mb="md">
              Pipeline Durumu
            </Title>

            <Timeline active={-1} bulletSize={28} lineWidth={2}>
              <Timeline.Item bullet={<IconFileText size={14} />} title="Kullanici Duzeltmesi">
                <Text size="sm" c="dimmed">
                  Kullanici analiz sonuclarini duzenler, kaydeder
                </Text>
                <Badge size="xs" variant="light" color="green" mt={4}>
                  {totalCount} toplam
                </Badge>
              </Timeline.Item>

              <Timeline.Item bullet={<IconCloudUpload size={14} />} title="Azure Blob Sync">
                <Text size="sm" c="dimmed">
                  Duzeltmeler otomatik olarak labels.json dosyalarina yazilir
                </Text>
                <Badge size="xs" variant="light" color={pendingSyncCount > 0 ? 'yellow' : 'green'} mt={4}>
                  {pendingSyncCount > 0 ? `${pendingSyncCount} bekliyor` : 'Guncel'}
                </Badge>
              </Timeline.Item>

              <Timeline.Item bullet={<IconDatabase size={14} />} title="Esik Kontrolu">
                <Text size="sm" c="dimmed">
                  {threshold} duzeltme biriktikce admin bilgilendirilir
                </Text>
                <Badge size="xs" variant="light" color={pendingCount >= threshold ? 'orange' : 'gray'} mt={4}>
                  {pendingCount}/{threshold}
                </Badge>
              </Timeline.Item>

              <Timeline.Item bullet={<IconRocket size={14} />} title="Model Egitimi">
                <Text size="sm" c="dimmed">
                  Admin tetikler, build-dataset.mjs Azure DI API ile egitir
                </Text>
                <Badge size="xs" variant="light" color="cyan" mt={4}>
                  {status?.model?.activeModelId || 'ihale-catering-v1'}
                </Badge>
              </Timeline.Item>

              <Timeline.Item bullet={<IconBrain size={14} />} title="Yeni Model Aktif">
                <Text size="sm" c="dimmed">
                  Yeni model devreye girer, sonraki analizlerde kullanilir
                </Text>
              </Timeline.Item>
            </Timeline>

            {/* Aktif Model Bilgisi */}
            {status?.model && (
              <Paper p="sm" mt="md" withBorder radius="md" bg="var(--mantine-color-dark-7)">
                <Group justify="space-between">
                  <Text size="sm" fw={500}>
                    Aktif Model
                  </Text>
                  <Badge color="cyan" variant="filled">
                    {status.model.activeModelId}
                  </Badge>
                </Group>
                {status.model.oldest_pending && (
                  <Text size="xs" c="dimmed" mt={4}>
                    En eski bekleyen duzeltme: {new Date(status.model.oldest_pending).toLocaleDateString('tr-TR')}
                  </Text>
                )}
              </Paper>
            )}
          </Paper>
        </SimpleGrid>

        {/* ═══════════════════════════════════════════════════════ */}
        {/* AZURE DOCUMENT INTELLIGENCE DURUMU                    */}
        {/* ═══════════════════════════════════════════════════════ */}
        <Paper p="md" withBorder radius="md">
          <Group mb="md">
            <ThemeIcon size="lg" radius="md" color="blue" variant="light">
              <IconCloud size={20} />
            </ThemeIcon>
            <div>
              <Text fw={600} size="lg">
                Azure Document Intelligence
              </Text>
              <Text size="xs" c="dimmed">
                Servis durumu ve model detayları
              </Text>
            </div>
          </Group>

          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
            {/* Servis Durumu */}
            <Paper p="sm" withBorder radius="md">
              <Group gap="xs" mb="xs">
                <IconHeartbeat size={16} />
                <Text size="sm" fw={500}>
                  Servis Durumu
                </Text>
              </Group>
              {azureHealth ? (
                <Stack gap={4}>
                  <Badge size="lg" color={azureHealth.healthy ? 'green' : 'red'} variant="filled" fullWidth>
                    {azureHealth.healthy ? 'Aktif' : 'Bağlantı Hatası'}
                  </Badge>
                  {azureHealth.healthy && (
                    <>
                      <Text size="xs" c="dimmed">
                        Toplam model: {azureHealth.availableModels || 0}
                      </Text>
                      <Text size="xs" c="dimmed">
                        Yanıt: {azureHealth.elapsed_ms}ms
                      </Text>
                    </>
                  )}
                  {azureHealth.error && (
                    <Text size="xs" c="red">
                      {azureHealth.error}
                    </Text>
                  )}
                </Stack>
              ) : (
                <Text size="xs" c="dimmed">
                  Yükleniyor...
                </Text>
              )}
            </Paper>

            {/* Aktif Model */}
            <Paper p="sm" withBorder radius="md">
              <Group gap="xs" mb="xs">
                <IconBrain size={16} />
                <Text size="sm" fw={500}>
                  Aktif Model
                </Text>
              </Group>
              {activeModelDetail ? (
                <Stack gap={4}>
                  <Badge size="lg" color="cyan" variant="filled" fullWidth>
                    {activeModelDetail.modelId}
                  </Badge>
                  <Text size="xs" c="dimmed">
                    Oluşturma: {new Date(activeModelDetail.createdDateTime).toLocaleDateString('tr-TR')}
                  </Text>
                  {activeModelDetail.trainingDocumentCount != null && (
                    <Text size="xs" c="dimmed">
                      Eğitim dokümanı: {activeModelDetail.trainingDocumentCount}
                    </Text>
                  )}
                  {activeModelDetail.averageAccuracy != null && (
                    <Group gap={4} mt={2}>
                      <Text size="xs" fw={500}>
                        Ortalama Doğruluk:
                      </Text>
                      <Badge
                        size="sm"
                        color={
                          activeModelDetail.averageAccuracy >= 0.8
                            ? 'green'
                            : activeModelDetail.averageAccuracy >= 0.6
                              ? 'yellow'
                              : 'red'
                        }
                      >
                        %{(activeModelDetail.averageAccuracy * 100).toFixed(1)}
                      </Badge>
                    </Group>
                  )}
                  {activeModelDetail.expirationDateTime && (
                    <Text size="xs" c="orange">
                      Son kullanma: {new Date(activeModelDetail.expirationDateTime).toLocaleDateString('tr-TR')}
                    </Text>
                  )}
                </Stack>
              ) : (
                <Text size="xs" c="dimmed">
                  {azureHealth?.customModelExists === false ? 'Model bulunamadı' : 'Yükleniyor...'}
                </Text>
              )}
            </Paper>

            {/* Tüm Modeller */}
            <Paper p="sm" withBorder radius="md">
              <Group gap="xs" mb="xs">
                <IconDatabase size={16} />
                <Text size="sm" fw={500}>
                  Tüm Custom Modeller
                </Text>
              </Group>
              {azureModels ? (
                <Stack gap={4}>
                  {azureModels.models.length === 0 ? (
                    <Text size="xs" c="dimmed">
                      Henüz model yok
                    </Text>
                  ) : (
                    azureModels.models
                      .sort((a, b) => new Date(b.createdDateTime).getTime() - new Date(a.createdDateTime).getTime())
                      .slice(0, 5)
                      .map((m) => (
                        <Group key={m.modelId} justify="space-between" gap={4}>
                          <Text size="xs" truncate style={{ maxWidth: 130 }}>
                            {m.modelId}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {new Date(m.createdDateTime).toLocaleDateString('tr-TR')}
                          </Text>
                        </Group>
                      ))
                  )}
                  {azureModels.total > 5 && (
                    <Text size="xs" c="dimmed" ta="center">
                      +{azureModels.total - 5} model daha
                    </Text>
                  )}
                </Stack>
              ) : (
                <Text size="xs" c="dimmed">
                  Yükleniyor...
                </Text>
              )}
            </Paper>
          </SimpleGrid>

          {/* Field Accuracy Tablosu (aktif model) */}
          {activeModelDetail?.docTypes?.[0]?.fieldConfidence &&
            Object.keys(activeModelDetail.docTypes[0].fieldConfidence).length > 0 && (
              <Paper p="sm" mt="md" withBorder radius="md">
                <Group gap="xs" mb="sm">
                  <IconTable size={16} />
                  <Text size="sm" fw={500}>
                    Alan Doğruluk Oranları
                  </Text>
                  <Badge size="xs" variant="light" color="cyan">
                    {activeModelDetail.docTypes[0].buildMode}
                  </Badge>
                </Group>
                <Stack gap={6}>
                  {Object.entries(activeModelDetail.docTypes[0].fieldConfidence)
                    .sort(([, a], [, b]) => (b as number) - (a as number))
                    .map(([field, confidence]) => (
                      <div key={field}>
                        <Group justify="space-between" mb={2}>
                          <Text size="xs" fw={500}>
                            {field}
                          </Text>
                          <Text size="xs" c="dimmed">
                            %{((confidence as number) * 100).toFixed(1)}
                          </Text>
                        </Group>
                        <Progress
                          value={(confidence as number) * 100}
                          size="sm"
                          color={
                            (confidence as number) >= 0.9 ? 'green' : (confidence as number) >= 0.7 ? 'yellow' : 'red'
                          }
                          radius="xl"
                        />
                      </div>
                    ))}
                </Stack>
              </Paper>
            )}
        </Paper>
      </Stack>
    </Container>
  );
}
