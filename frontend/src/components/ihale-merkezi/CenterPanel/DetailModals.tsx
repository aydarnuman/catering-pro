'use client';

import {
  ActionIcon,
  Badge,
  Box,
  Button,
  CopyButton,
  Group,
  Modal,
  Paper,
  ScrollArea,
  Stack,
  Text,
  ThemeIcon,
} from '@mantine/core';
import {
  IconCheck,
  IconClipboardList,
  IconCopy,
  IconCurrencyLira,
  IconFileText,
} from '@tabler/icons-react';
import type { AnalysisData } from '../types';
import { getTeknikSartTextFromItem } from './OzetCards';

// ─── Teknik Şartlar Modal ──────────────────────────────────────────

interface TeknikSartlarModalProps {
  opened: boolean;
  onClose: () => void;
  analysisData?: AnalysisData;
}

export function TeknikSartlarModal({ opened, onClose, analysisData }: TeknikSartlarModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <ThemeIcon variant="light" color="blue" size="sm">
            <IconClipboardList size={14} />
          </ThemeIcon>
          <Text fw={600}>Teknik Şartlar ({analysisData?.teknik_sartlar?.length || 0})</Text>
        </Group>
      }
      size="lg"
    >
      <ScrollArea h={500}>
        <Stack gap="xs">
          {analysisData?.teknik_sartlar?.map((sart, idx) => {
            const sartText = getTeknikSartTextFromItem(sart);
            const sartObj =
              typeof sart === 'object' && sart !== null ? (sart as { onem?: string }) : null;
            const onem = sartObj?.onem;
            const onemColor = onem === 'kritik' ? 'red' : onem === 'normal' ? 'blue' : 'gray';
            return (
              <Paper
                key={`modal-ts-${sartText.substring(0, 30)}-${idx}`}
                p="sm"
                withBorder
                radius="md"
              >
                <Group gap="xs" wrap="nowrap" align="flex-start">
                  <Badge
                    size="sm"
                    variant="filled"
                    color={onemColor}
                    circle
                    style={{ flexShrink: 0, marginTop: 2 }}
                  >
                    {idx + 1}
                  </Badge>
                  <Box style={{ flex: 1 }}>
                    <Text size="sm">{sartText}</Text>
                    {onem && (
                      <Badge size="xs" variant="light" color={onemColor} mt="xs">
                        {onem === 'kritik' ? 'Kritik' : 'Normal'}
                      </Badge>
                    )}
                  </Box>
                  <CopyButton value={sartText}>
                    {({ copied, copy }) => (
                      <ActionIcon
                        variant="subtle"
                        size="sm"
                        onClick={copy}
                        color={copied ? 'teal' : 'gray'}
                      >
                        {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                      </ActionIcon>
                    )}
                  </CopyButton>
                </Group>
              </Paper>
            );
          })}
        </Stack>
      </ScrollArea>
    </Modal>
  );
}

// ─── Birim Fiyatlar Modal ──────────────────────────────────────────

interface BirimFiyatlarModalProps {
  opened: boolean;
  onClose: () => void;
  analysisData?: AnalysisData;
}

export function BirimFiyatlarModal({ opened, onClose, analysisData }: BirimFiyatlarModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <ThemeIcon variant="light" color="green" size="sm">
            <IconCurrencyLira size={14} />
          </ThemeIcon>
          <Text fw={600}>Birim Fiyatlar ({analysisData?.birim_fiyatlar?.length || 0})</Text>
        </Group>
      }
      size="lg"
    >
      <ScrollArea h={500}>
        <Stack gap="xs">
          {analysisData?.birim_fiyatlar?.map((item, idx) => {
            const itemText = item.kalem || item.aciklama || item.text || 'Bilinmeyen';
            return (
              <Paper
                key={`modal-bf-${itemText.substring(0, 20)}-${idx}`}
                p="sm"
                withBorder
                radius="md"
              >
                <Group justify="space-between" wrap="nowrap">
                  <Group gap="xs" style={{ flex: 1, minWidth: 0 }}>
                    <Badge
                      size="sm"
                      variant="filled"
                      color="green"
                      circle
                      style={{ flexShrink: 0 }}
                    >
                      {idx + 1}
                    </Badge>
                    <Box style={{ flex: 1 }}>
                      <Text size="sm">{itemText}</Text>
                      <Group gap="xs" mt="xs">
                        {item.birim && (
                          <Badge size="xs" variant="outline" color="gray">
                            {item.birim}
                          </Badge>
                        )}
                        {item.miktar && (
                          <Badge size="xs" variant="light" color="blue">
                            Miktar: {item.miktar}
                          </Badge>
                        )}
                      </Group>
                    </Box>
                  </Group>
                  <CopyButton value={itemText}>
                    {({ copied, copy }) => (
                      <ActionIcon
                        variant="subtle"
                        size="sm"
                        onClick={copy}
                        color={copied ? 'teal' : 'gray'}
                      >
                        {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                      </ActionIcon>
                    )}
                  </CopyButton>
                </Group>
              </Paper>
            );
          })}
        </Stack>
      </ScrollArea>
    </Modal>
  );
}

// ─── Tam Metin Modal ───────────────────────────────────────────────

interface TamMetinModalProps {
  opened: boolean;
  onClose: () => void;
  tamMetin?: string;
}

export function TamMetinModal({ opened, onClose, tamMetin }: TamMetinModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <ThemeIcon variant="light" color="violet" size="sm">
            <IconFileText size={14} />
          </ThemeIcon>
          <Text fw={600}>Dökümanlardan Çıkarılan Tam Metin</Text>
        </Group>
      }
      size="xl"
      fullScreen
    >
      <Stack gap="md" h="100%">
        <Group justify="flex-end">
          <CopyButton value={tamMetin || ''}>
            {({ copied, copy }) => (
              <Button
                variant="light"
                leftSection={copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                color={copied ? 'teal' : 'gray'}
                onClick={copy}
              >
                {copied ? 'Kopyalandı!' : 'Tümünü Kopyala'}
              </Button>
            )}
          </CopyButton>
        </Group>
        <ScrollArea style={{ flex: 1 }}>
          <Paper p="md" withBorder radius="md" bg="dark.8">
            <Text
              size="sm"
              style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', lineHeight: 1.6 }}
            >
              {tamMetin || 'Tam metin bulunamadı.'}
            </Text>
          </Paper>
        </ScrollArea>
      </Stack>
    </Modal>
  );
}
