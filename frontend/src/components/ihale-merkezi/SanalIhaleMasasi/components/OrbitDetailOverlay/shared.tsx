/**
 * OrbitDetailOverlay — Shared constants, icons, and form shell
 */

import { ActionIcon, Button, Group, Stack, Text } from '@mantine/core';
import {
  IconArrowLeft,
  IconBrain,
  IconCheck,
  IconFileCertificate,
  IconFileText,
  IconLink,
  IconMathFunction,
  IconNote,
  IconUser,
  IconX,
} from '@tabler/icons-react';

export const ICON_MAP: Record<string, typeof IconNote> = {
  note: IconNote,
  'file-text': IconFileText,
  'file-certificate': IconFileCertificate,
  brain: IconBrain,
  link: IconLink,
  user: IconUser,
  'math-function': IconMathFunction,
};

export const DARK_INPUT_STYLES = {
  input: {
    background: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.1)',
  },
};

// ─── FormShell ──────────────────────────────────────────────

interface FormShellProps {
  config: { label: string; icon: string; color: string } | undefined;
  saving: boolean;
  disabled: boolean;
  onBack: () => void;
  onClose: () => void;
  onSubmit: () => void;
  children: React.ReactNode;
}

/** Shared header + footer wrapper for all create forms */
export function FormShell({ config, saving, disabled, onBack, onClose, onSubmit, children }: FormShellProps) {
  const TypeIcon = ICON_MAP[config?.icon || 'note'] || IconNote;
  return (
    <Stack gap="sm" px="md" pt="md" pb="md" style={{ flex: 1, minHeight: 0 }}>
      <Group justify="space-between">
        <Group gap="xs">
          <ActionIcon variant="subtle" color="gray" size="sm" onClick={onBack}>
            <IconArrowLeft size={14} />
          </ActionIcon>
          <TypeIcon size={16} color={`var(--mantine-color-${config?.color || 'yellow'}-5)`} />
          <Text size="sm" fw={700} c="white">
            {config?.label}
          </Text>
        </Group>
        <ActionIcon variant="subtle" color="gray" size="sm" onClick={onClose}>
          <IconX size={14} />
        </ActionIcon>
      </Group>

      {children}

      <Group justify="flex-end" gap="xs">
        <Button size="xs" variant="subtle" color="gray" onClick={onClose}>
          Iptal
        </Button>
        <Button
          size="xs"
          variant="gradient"
          gradient={{
            from: config?.color || 'indigo',
            to: config?.color || 'violet',
          }}
          leftSection={<IconCheck size={14} />}
          loading={saving}
          disabled={disabled}
          onClick={onSubmit}
        >
          Olustur
        </Button>
      </Group>
    </Stack>
  );
}
