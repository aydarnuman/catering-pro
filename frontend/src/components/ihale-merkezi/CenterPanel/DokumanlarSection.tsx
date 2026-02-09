'use client';

import {
  ActionIcon,
  Badge,
  Box,
  Group,
  Paper,
  Stack,
  Text,
  ThemeIcon,
} from '@mantine/core';
import { IconChevronRight, IconFile } from '@tabler/icons-react';
import { useState } from 'react';
import { DocumentWizardModal } from '../DocumentWizardModal';

interface DokumanlarSectionProps {
  tenderId: number;
  tenderTitle: string;
  dokumansayisi?: number;
  analizEdilen?: number;
  onRefresh?: () => void;
}

export function DokumanlarSection({
  tenderId,
  tenderTitle,
  dokumansayisi = 0,
  analizEdilen = 0,
  onRefresh,
}: DokumanlarSectionProps) {
  const [wizardOpen, setWizardOpen] = useState(false);

  return (
    <>
      <Stack gap="md">
        {/* Kompakt Özet - Tıklanabilir */}
        <Paper
          p="md"
          withBorder
          radius="md"
          bg="dark.7"
          style={{ cursor: 'pointer' }}
          onClick={() => setWizardOpen(true)}
        >
          <Group justify="space-between" align="center">
            <Group gap="md">
              <ThemeIcon size="lg" variant="light" color="orange" radius="xl">
                <IconFile size={18} />
              </ThemeIcon>
              <Box>
                <Text size="sm" fw={600}>
                  {dokumansayisi > 0 ? `${dokumansayisi} Döküman` : 'Döküman Yok'}
                </Text>
                <Text size="xs" c="dimmed">
                  {dokumansayisi > 0
                    ? analizEdilen > 0
                      ? `${analizEdilen} analiz edildi`
                      : 'Analiz bekliyor'
                    : 'Henüz döküman indirilmedi'}
                </Text>
              </Box>
            </Group>

            <Group gap="xs">
              {dokumansayisi > 0 && (
                <Badge
                  size="lg"
                  variant="light"
                  color={analizEdilen === dokumansayisi ? 'green' : 'yellow'}
                >
                  %{Math.round((analizEdilen / dokumansayisi) * 100)}
                </Badge>
              )}
              <ActionIcon variant="subtle" color="gray" size="lg">
                <IconChevronRight size={18} />
              </ActionIcon>
            </Group>
          </Group>
        </Paper>
      </Stack>

      {/* Wizard Modal */}
      <DocumentWizardModal
        opened={wizardOpen}
        onClose={() => setWizardOpen(false)}
        tenderId={tenderId}
        tenderTitle={tenderTitle}
        onComplete={onRefresh}
      />
    </>
  );
}
