'use client';

import { Box, Group, Paper, Progress, Stack, Text, ThemeIcon } from '@mantine/core';
import { IconRobot } from '@tabler/icons-react';
import { useMemo } from 'react';

import type { DocumentProgress, PipelineStage } from './DocumentWizardModal';

// Sadece text pulse efekti
const pulseTextKeyframes = `
  @keyframes textPulse {
    0%, 100% { opacity: 0.5; }
    50% { opacity: 1; }
  }
`;

if (typeof document !== 'undefined' && !document.getElementById('analysis-animations')) {
  const style = document.createElement('style');
  style.id = 'analysis-animations';
  style.textContent = pulseTextKeyframes;
  document.head.appendChild(style);
}

interface AnalysisProgressPanelProps {
  documentProgress: Map<number, DocumentProgress>;
  analysisProgress: { current: number; total: number; currentDoc?: string } | null; // Reserved for fallback
  startTime: number | null;
}

// Tek bir dökümanın progress gösterimi
function DocumentProgressItem({ doc, index }: { doc: DocumentProgress; index: number }) {
  const isActive = doc.status === 'processing';
  const isCompleted = doc.status === 'completed' || doc.status === 'skipped';
  const isError = doc.status === 'error';

  // Genel progress hesaplama
  const overallProgress = useMemo(() => {
    if (isCompleted) return 100;
    if (isError) return 0;
    if (!doc.stage) return 0;

    const stageOrder: PipelineStage[] = [
      'pending',
      'extraction',
      'ocr',
      'chunking',
      'analysis',
      'completed',
    ];
    const stageIndex = stageOrder.indexOf(doc.stage);

    // Her aşama için base progress
    const baseProgress = Math.max(0, stageIndex) * 20;

    // Aşama içi progress
    const stageProgress = doc.stageProgress || 0;
    const inStageProgress = (stageProgress / 100) * 20;

    return Math.min(100, baseProgress + inStageProgress);
  }, [doc.stage, doc.stageProgress, isCompleted, isError]);

  // Tamamlanmış mı kontrol et
  const isDone = isCompleted || doc.stageMessage?.includes('tamamlandı');

  return (
    <Box
      py={4}
      style={{
        opacity: doc.status === 'pending' ? 0.35 : isDone ? 0.5 : 1,
      }}
    >
      <Group justify="space-between" wrap="nowrap" gap="xs">
        <Group gap={6} wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
          <Text size="xs" c="dimmed" style={{ minWidth: 16 }}>
            {index}.
          </Text>
          <Text
            size="xs"
            truncate
            c={isDone ? 'dimmed' : isError ? 'red' : undefined}
            style={{
              flex: 1,
              ...(isActive &&
                !isDone && {
                  animation: 'textPulse 1.5s ease-in-out infinite',
                }),
            }}
          >
            {doc.name}
          </Text>
        </Group>

        {/* Sağ taraf - durum bilgisi */}
        {isDone ? (
          <Text size="xs" c="dimmed">
            {doc.result ? (
              <>
                {(doc.result.teknikSartlar || 0) > 0 && `${doc.result.teknikSartlar} şart`}
                {(doc.result.teknikSartlar || 0) > 0 &&
                  (doc.result.birimFiyatlar || 0) > 0 &&
                  ' · '}
                {(doc.result.birimFiyatlar || 0) > 0 && `${doc.result.birimFiyatlar} fiyat`}
                {!(doc.result.teknikSartlar || 0) && !(doc.result.birimFiyatlar || 0) && '✓'}
              </>
            ) : (
              '✓'
            )}
          </Text>
        ) : isError ? (
          <Text size="xs" c="red">
            !
          </Text>
        ) : isActive ? (
          <Text
            size="xs"
            c="dimmed"
            style={{
              whiteSpace: 'nowrap',
              animation: 'textPulse 1.5s ease-in-out infinite',
            }}
          >
            {doc.chunks ? `${doc.chunks.current}/${doc.chunks.total}` : doc.stageMessage || '...'}
          </Text>
        ) : (
          <Text size="xs" c="dimmed">
            —
          </Text>
        )}
      </Group>

      {/* Progress bar - sadece aktif dökümanlar için */}
      {isActive && (
        <Progress value={overallProgress} size={2} color="blue" bg="dark.6" radius={0} mt={4} />
      )}

      {/* Hata mesajı */}
      {isError && doc.error && (
        <Text size="xs" c="red" mt={4}>
          {doc.error}
        </Text>
      )}
    </Box>
  );
}

export function AnalysisProgressPanel({
  documentProgress,
  analysisProgress: _analysisProgress,
  startTime,
}: AnalysisProgressPanelProps) {
  // Dökümanları sırala: işlenen > bekleyen > tamamlanan (en sona)
  const sortedDocs = useMemo(() => {
    const docs = Array.from(documentProgress.values());
    // Orijinal sırayı korumak için index ekle
    const indexed = docs.map((doc, i) => ({ doc, originalIndex: i + 1 }));
    // Sırala: processing > pending > error > completed/skipped
    indexed.sort((a, b) => {
      const statusOrder: Record<string, number> = {
        processing: 0,
        pending: 1,
        error: 2,
        completed: 3,
        skipped: 4,
      };
      return (statusOrder[a.doc.status] || 5) - (statusOrder[b.doc.status] || 5);
    });
    return indexed;
  }, [documentProgress]);

  // İstatistikler
  const stats = useMemo(() => {
    const docs = Array.from(documentProgress.values());
    return {
      total: docs.length,
      completed: docs.filter((d) => d.status === 'completed').length,
      processing: docs.filter((d) => d.status === 'processing').length,
      pending: docs.filter((d) => d.status === 'pending').length,
      error: docs.filter((d) => d.status === 'error').length,
      skipped: docs.filter((d) => d.status === 'skipped').length,
    };
  }, [documentProgress]);

  // Tahmini süre
  const estimatedTime = useMemo(() => {
    if (!startTime || stats.completed === 0) return null;

    const elapsed = Date.now() - startTime;
    const perDoc = elapsed / (stats.completed + stats.skipped);
    const remaining = perDoc * (stats.pending + stats.processing);

    if (remaining < 60000) return `~${Math.ceil(remaining / 1000)} sn`;
    return `~${Math.ceil(remaining / 60000)} dk`;
  }, [startTime, stats]);

  if (documentProgress.size === 0) {
    return null;
  }

  return (
    <Paper p="sm" withBorder radius="md" bg="dark.7">
      <Stack gap="sm">
        {/* Özet başlık */}
        <Group justify="space-between">
          <Group gap="xs">
            <ThemeIcon size="sm" variant="subtle" color="gray">
              <IconRobot size={14} />
            </ThemeIcon>
            <Text size="sm" fw={500} c="dimmed">
              Analiz İlerlemesi
            </Text>
          </Group>
          <Text size="xs" c="dimmed">
            {stats.completed + stats.skipped}/{stats.total}
            {estimatedTime && stats.processing > 0 && ` · ${estimatedTime}`}
          </Text>
        </Group>

        {/* Genel progress bar - basit */}
        <Progress
          value={((stats.completed + stats.skipped) / stats.total) * 100}
          size={3}
          color="teal"
          bg="dark.6"
          radius={0}
        />

        {/* Döküman listesi */}
        <Stack gap={4}>
          {sortedDocs.map(({ doc, originalIndex }) => (
            <DocumentProgressItem key={doc.id} doc={doc} index={originalIndex} />
          ))}
        </Stack>
      </Stack>
    </Paper>
  );
}
