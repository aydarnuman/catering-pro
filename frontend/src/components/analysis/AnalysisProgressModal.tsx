'use client';

/**
 * AnalysisProgressModal
 * Döküman analizi için detaylı progress modal
 * SSE ile gerçek zamanlı güncelleme
 */

import {
  Badge,
  Button,
  Group,
  List,
  Modal,
  Paper,
  Progress,
  Stack,
  Text,
  ThemeIcon,
  Timeline,
  Tooltip,
} from '@mantine/core';
import {
  IconCheck,
  IconClock,
  IconFile,
  IconFileText,
  IconLoader,
  IconMinimize,
  IconPhoto,
  IconPlayerPause,
  IconX,
} from '@tabler/icons-react';
import { useEffect, useState } from 'react';

// Progress stage types
export interface FileProgress {
  id: number;
  filename: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  stage?: 'text_extraction' | 'visual_analysis' | 'merging' | 'complete';
  stageDetail?: string;
  progress?: number;
  duration?: number;
  error?: string;
}

export interface AnalysisProgressData {
  current: number;
  total: number;
  message: string;
  stage?: string;
  currentFile?: FileProgress;
  files?: FileProgress[];
  startTime?: number;
  estimatedRemaining?: number;
}

interface AnalysisProgressModalProps {
  opened: boolean;
  onClose: () => void;
  onMinimize: () => void;
  onCancel: () => void;
  progress: AnalysisProgressData;
  tenderId: string;
  tenderTitle?: string;
}

// Süre formatla
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes > 0) {
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
  return `${seconds}s`;
}

// Stage icon'u
function getStageIcon(stage?: string, status?: string) {
  if (status === 'completed') {
    return <IconCheck size={14} />;
  }
  if (status === 'processing') {
    return <IconLoader size={14} className="animate-spin" />;
  }

  switch (stage) {
    case 'text_extraction':
      return <IconFileText size={14} />;
    case 'visual_analysis':
      return <IconPhoto size={14} />;
    case 'merging':
      return <IconFile size={14} />;
    default:
      return <IconClock size={14} />;
  }
}

// Stage adı
function _getStageName(stage?: string): string {
  switch (stage) {
    case 'text_extraction':
      return 'Metin çıkarma';
    case 'visual_analysis':
      return 'Görsel analiz';
    case 'merging':
      return 'Birleştirme';
    case 'complete':
      return 'Tamamlandı';
    default:
      return 'Hazırlanıyor';
  }
}

// Status badge rengi
function getStatusColor(status?: string): string {
  switch (status) {
    case 'completed':
      return 'green';
    case 'processing':
      return 'blue';
    case 'failed':
      return 'red';
    default:
      return 'gray';
  }
}

export function AnalysisProgressModal({
  opened,
  onClose,
  onMinimize,
  onCancel,
  progress,
  tenderId: _tenderId,
  tenderTitle,
}: AnalysisProgressModalProps) {
  const [elapsedTime, setElapsedTime] = useState(0);

  // Geçen süreyi hesapla
  const startTime = progress.startTime;
  useEffect(() => {
    if (!startTime || progress.current >= progress.total) return;

    const interval = setInterval(() => {
      setElapsedTime(Date.now() - startTime);
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime, progress.current, progress.total]);

  // Progress yüzdesi
  const percentage = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  // Tahmini kalan süre
  const estimatedRemaining =
    progress.estimatedRemaining ||
    (progress.current > 0 && elapsedTime > 0
      ? (elapsedTime / progress.current) * (progress.total - progress.current)
      : 0);

  // Tamamlandı mı?
  const isComplete = progress.current >= progress.total && progress.total > 0;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="sm">
          <ThemeIcon
            size="lg"
            radius="xl"
            style={{
              background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
              border: '1px solid rgba(201, 162, 39, 0.4)',
            }}
          >
            <IconFileText size={20} color="#C9A227" />
          </ThemeIcon>
          <div>
            <Text fw={600}>Döküman Analizi</Text>
            {tenderTitle && (
              <Text size="xs" c="dimmed" lineClamp={1}>
                {tenderTitle}
              </Text>
            )}
          </div>
        </Group>
      }
      size="lg"
      centered
      closeOnClickOutside={false}
      closeOnEscape={false}
      withCloseButton={false}
    >
      <Stack gap="md">
        {/* Ana Progress Bar */}
        <Paper p="md" radius="md" withBorder>
          <Stack gap="xs">
            <Group justify="space-between">
              <Text size="sm" fw={500}>
                {isComplete ? '✅ Analiz Tamamlandı!' : progress.message}
              </Text>
              <Badge
                size="lg"
                variant="filled"
                style={{
                  background: isComplete
                    ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)'
                    : 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                  border: isComplete ? 'none' : '1px solid rgba(201, 162, 39, 0.5)',
                  color: isComplete ? 'white' : '#D4AF37',
                }}
              >
                {percentage}%
              </Badge>
            </Group>

            <Progress
              value={percentage}
              size="xl"
              radius="xl"
              striped={!isComplete}
              animated={!isComplete}
              styles={{
                root: {
                  background: 'rgba(201, 162, 39, 0.1)',
                },
                section: {
                  background: isComplete
                    ? 'linear-gradient(90deg, #059669 0%, #10b981 100%)'
                    : 'linear-gradient(90deg, #8B7355 0%, #C9A227 50%, #8B7355 100%)',
                },
              }}
            />

            <Group justify="space-between">
              <Group gap="xs">
                <IconClock size={14} />
                <Text size="xs" c="dimmed">
                  Geçen: {formatDuration(elapsedTime)}
                </Text>
              </Group>

              {!isComplete && estimatedRemaining > 0 && (
                <Text size="xs" c="dimmed">
                  Kalan: ~{formatDuration(estimatedRemaining)}
                </Text>
              )}

              <Text size="xs" c="dimmed">
                {progress.current}/{progress.total} dosya
              </Text>
            </Group>
          </Stack>
        </Paper>

        {/* Mevcut Dosya Detayı */}
        {progress.currentFile && !isComplete && (
          <Paper p="md" radius="md" withBorder bg="var(--mantine-color-blue-0)">
            <Stack gap="xs">
              <Group justify="space-between">
                <Group gap="xs">
                  <IconFile size={16} />
                  <Text size="sm" fw={500} lineClamp={1}>
                    {progress.currentFile.filename}
                  </Text>
                </Group>
                <Badge size="sm" color="blue" variant="light">
                  İşleniyor
                </Badge>
              </Group>

              {/* Aşamalar */}
              <Timeline active={getActiveStageIndex(progress.currentFile.stage)} bulletSize={20} lineWidth={2}>
                <Timeline.Item
                  bullet={getStageIcon(
                    'text_extraction',
                    progress.currentFile.stage === 'text_extraction'
                      ? 'processing'
                      : progress.currentFile.stage &&
                          ['visual_analysis', 'merging', 'complete'].includes(progress.currentFile.stage)
                        ? 'completed'
                        : 'pending'
                  )}
                  title={<Text size="xs">Metin çıkarma</Text>}
                >
                  {progress.currentFile.stage === 'text_extraction' && progress.currentFile.stageDetail && (
                    <Text size="xs" c="dimmed">
                      {progress.currentFile.stageDetail}
                    </Text>
                  )}
                </Timeline.Item>

                <Timeline.Item
                  bullet={getStageIcon(
                    'visual_analysis',
                    progress.currentFile.stage === 'visual_analysis'
                      ? 'processing'
                      : progress.currentFile.stage && ['merging', 'complete'].includes(progress.currentFile.stage)
                        ? 'completed'
                        : 'pending'
                  )}
                  title={<Text size="xs">Görsel analiz</Text>}
                >
                  {progress.currentFile.stage === 'visual_analysis' && progress.currentFile.stageDetail && (
                    <Text size="xs" c="dimmed">
                      {progress.currentFile.stageDetail}
                    </Text>
                  )}
                </Timeline.Item>

                <Timeline.Item
                  bullet={getStageIcon(
                    'merging',
                    progress.currentFile.stage === 'merging'
                      ? 'processing'
                      : progress.currentFile.stage === 'complete'
                        ? 'completed'
                        : 'pending'
                  )}
                  title={<Text size="xs">Sonuç birleştirme</Text>}
                />
              </Timeline>
            </Stack>
          </Paper>
        )}

        {/* Tüm Dosyalar Listesi */}
        {progress.files && progress.files.length > 0 && (
          <Paper p="md" radius="md" withBorder>
            <Text size="sm" fw={500} mb="xs">
              Tüm Dosyalar
            </Text>
            <List spacing="xs" size="sm" center>
              {progress.files.map((file) => (
                <List.Item
                  key={file.id}
                  icon={
                    <ThemeIcon
                      size={20}
                      radius="xl"
                      color={getStatusColor(file.status)}
                      variant={file.status === 'processing' ? 'filled' : 'light'}
                    >
                      {file.status === 'completed' && <IconCheck size={12} />}
                      {file.status === 'processing' && <IconLoader size={12} className="animate-spin" />}
                      {file.status === 'failed' && <IconX size={12} />}
                      {file.status === 'pending' && <IconClock size={12} />}
                    </ThemeIcon>
                  }
                >
                  <Group justify="space-between" wrap="nowrap">
                    <Text
                      size="xs"
                      lineClamp={1}
                      style={{ flex: 1 }}
                      c={file.status === 'pending' ? 'dimmed' : undefined}
                    >
                      {file.filename}
                    </Text>
                    {file.duration && (
                      <Text size="xs" c="dimmed">
                        {formatDuration(file.duration)}
                      </Text>
                    )}
                  </Group>
                </List.Item>
              ))}
            </List>
          </Paper>
        )}

        {/* Butonlar */}
        <Group justify="space-between">
          <Tooltip label="Arka planda çalıştır">
            <Button
              variant="subtle"
              leftSection={<IconMinimize size={16} />}
              onClick={onMinimize}
              disabled={isComplete}
            >
              Arka Planda Çalıştır
            </Button>
          </Tooltip>

          <Group gap="xs">
            {!isComplete && (
              <Button variant="subtle" color="red" leftSection={<IconPlayerPause size={16} />} onClick={onCancel}>
                İptal
              </Button>
            )}

            {isComplete && (
              <Button
                variant="gradient"
                gradient={{ from: 'green', to: 'teal' }}
                leftSection={<IconCheck size={16} />}
                onClick={onClose}
              >
                Sonuçları Gör
              </Button>
            )}
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}

// Helper: Aktif stage index
function getActiveStageIndex(stage?: string): number {
  switch (stage) {
    case 'text_extraction':
      return 0;
    case 'visual_analysis':
      return 1;
    case 'merging':
      return 2;
    case 'complete':
      return 3;
    default:
      return -1;
  }
}

export default AnalysisProgressModal;
