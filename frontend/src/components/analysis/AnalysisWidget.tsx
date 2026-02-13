'use client';

/**
 * AnalysisWidget
 * Arka planda çalışan analizleri gösteren floating widget
 * Sağ alt köşede küçük, genişletilebilir panel
 */

import {
  ActionIcon,
  Badge,
  Box,
  Collapse,
  Group,
  Paper,
  Progress,
  Stack,
  Text,
  Tooltip,
  Transition,
} from '@mantine/core';
import { IconCheck, IconChevronDown, IconChevronUp, IconLoader, IconPlayerPause, IconX } from '@tabler/icons-react';
import { useState } from 'react';
import { type AnalysisJob, useAnalysis } from '@/context/AnalysisContext';

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

// Tek job item
function JobItem({ job, onCancel, onRemove }: { job: AnalysisJob; onCancel: () => void; onRemove: () => void }) {
  const percentage = job.progress.total > 0 ? Math.round((job.progress.current / job.progress.total) * 100) : 0;

  const elapsed = job.endTime ? job.endTime - job.startTime : Date.now() - job.startTime;

  return (
    <Paper p="xs" radius="sm" withBorder>
      <Stack gap={4}>
        <Group justify="space-between" wrap="nowrap">
          <Text size="xs" fw={500} lineClamp={1} style={{ flex: 1 }}>
            {job.tenderTitle || job.tenderId}
          </Text>

          {job.status === 'running' ? (
            <Tooltip label="İptal et">
              <ActionIcon size="xs" color="red" variant="subtle" onClick={onCancel}>
                <IconPlayerPause size={12} />
              </ActionIcon>
            </Tooltip>
          ) : (
            <Tooltip label="Kaldır">
              <ActionIcon size="xs" color="gray" variant="subtle" onClick={onRemove}>
                <IconX size={12} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>

        {job.status === 'running' && (
          <>
            <Progress
              value={percentage}
              size="xs"
              radius="xl"
              striped
              animated
              styles={{
                root: { background: 'rgba(201, 162, 39, 0.1)' },
                section: { background: 'linear-gradient(90deg, #8B7355 0%, #C9A227 100%)' },
              }}
            />
            <Group justify="space-between">
              <Text size="xs" c="dimmed">
                {job.progress.current}/{job.progress.total}
              </Text>
              <Text size="xs" c="dimmed">
                {formatDuration(elapsed)}
              </Text>
            </Group>
          </>
        )}

        {job.status === 'completed' && (
          <Group gap="xs">
            <Badge size="xs" color="green" variant="light" leftSection={<IconCheck size={10} />}>
              Tamamlandı
            </Badge>
            <Text size="xs" c="dimmed">
              {formatDuration(elapsed)}
            </Text>
          </Group>
        )}

        {job.status === 'failed' && (
          <Badge size="xs" color="red" variant="light" leftSection={<IconX size={10} />}>
            Hata
          </Badge>
        )}

        {job.status === 'cancelled' && (
          <Badge size="xs" color="gray" variant="light">
            İptal edildi
          </Badge>
        )}
      </Stack>
    </Paper>
  );
}

export function AnalysisWidget() {
  const { jobs, activeJobCount, cancelJob, removeJob } = useAnalysis();
  const [expanded, setExpanded] = useState(false);

  // Hiç job yoksa widget gösterme
  if (jobs.length === 0) {
    return null;
  }

  // Sadece son 5 job'ı göster
  const visibleJobs = jobs.slice(-5).reverse();
  const runningJobs = jobs.filter((j) => j.status === 'running');

  // Toplam progress
  const totalProgress =
    runningJobs.length > 0
      ? Math.round(
          runningJobs.reduce((acc, job) => {
            const jobProgress = job.progress.total > 0 ? (job.progress.current / job.progress.total) * 100 : 0;
            return acc + jobProgress;
          }, 0) / runningJobs.length
        )
      : 100;

  return (
    <Transition mounted={jobs.length > 0} transition="slide-up" duration={300}>
      {(styles) => (
        <Box
          style={{
            ...styles,
            position: 'fixed',
            bottom: 20,
            right: 20,
            zIndex: 1000,
            width: expanded ? 320 : 200,
            transition: 'width 0.2s ease',
          }}
        >
          <Paper
            shadow="lg"
            radius="md"
            withBorder
            style={{
              overflow: 'hidden',
              background: 'var(--mantine-color-body)',
            }}
          >
            {/* Header - her zaman görünür */}
            <Box
              p="sm"
              style={{
                background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                borderBottom: '1px solid rgba(201, 162, 39, 0.3)',
                cursor: 'pointer',
              }}
              onClick={() => setExpanded(!expanded)}
            >
              <Group justify="space-between" wrap="nowrap">
                <Group gap="xs" wrap="nowrap">
                  {activeJobCount > 0 ? (
                    <IconLoader size={16} color="#C9A227" className="animate-spin" />
                  ) : (
                    <IconCheck size={16} color="#10b981" />
                  )}
                  <Text size="sm" fw={600} c={activeJobCount > 0 ? '#D4AF37' : '#10b981'}>
                    {activeJobCount > 0 ? `Analiz: ${totalProgress}%` : 'Analiz Tamamlandı'}
                  </Text>
                </Group>

                <Group gap={4} wrap="nowrap">
                  {activeJobCount > 0 && (
                    <Badge
                      size="sm"
                      variant="filled"
                      style={{
                        background: 'rgba(201, 162, 39, 0.2)',
                        color: '#D4AF37',
                        border: '1px solid rgba(201, 162, 39, 0.4)',
                      }}
                    >
                      {activeJobCount}
                    </Badge>
                  )}
                  {expanded ? (
                    <IconChevronDown size={16} color="#9CA3AF" />
                  ) : (
                    <IconChevronUp size={16} color="#9CA3AF" />
                  )}
                </Group>
              </Group>

              {!expanded && activeJobCount > 0 && (
                <Progress
                  value={totalProgress}
                  size="xs"
                  radius="xl"
                  mt="xs"
                  styles={{
                    root: { background: 'rgba(201, 162, 39, 0.15)' },
                    section: { background: 'linear-gradient(90deg, #8B7355 0%, #C9A227 100%)' },
                  }}
                />
              )}
            </Box>

            {/* Genişletilmiş içerik */}
            <Collapse in={expanded}>
              <Stack gap="xs" p="sm" mah={300} style={{ overflow: 'auto' }}>
                {visibleJobs.map((job) => (
                  <JobItem
                    key={job.id}
                    job={job}
                    onCancel={() => cancelJob(job.id)}
                    onRemove={() => removeJob(job.id)}
                  />
                ))}

                {jobs.length > 5 && (
                  <Text size="xs" c="dimmed" ta="center">
                    +{jobs.length - 5} daha...
                  </Text>
                )}
              </Stack>
            </Collapse>
          </Paper>
        </Box>
      )}
    </Transition>
  );
}

export default AnalysisWidget;
