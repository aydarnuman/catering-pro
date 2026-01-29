'use client';

import { Button, Group, Modal, Stack, Text, ThemeIcon } from '@mantine/core';
import {
  IconAlertTriangle,
  IconInfoCircle,
  IconTrash,
} from '@tabler/icons-react';

export interface ConfirmDialogProps {
  opened: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  loading?: boolean;
}

const variantConfig = {
  danger: {
    icon: IconTrash,
    color: 'red',
    confirmColor: 'red',
  },
  warning: {
    icon: IconAlertTriangle,
    color: 'yellow',
    confirmColor: 'yellow',
  },
  info: {
    icon: IconInfoCircle,
    color: 'blue',
    confirmColor: 'blue',
  },
};

export function ConfirmDialog({
  opened,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Onayla',
  cancelText = 'İptal',
  variant = 'info',
  loading = false,
}: ConfirmDialogProps) {
  const config = variantConfig[variant];
  const Icon = config.icon;

  const handleConfirm = () => {
    onConfirm();
    if (!loading) {
      onClose();
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={null}
      centered
      size="sm"
      withCloseButton={false}
      closeOnClickOutside={!loading}
      closeOnEscape={!loading}
    >
      <Stack align="center" gap="md" py="md">
        <ThemeIcon size={60} radius="xl" color={config.color} variant="light">
          <Icon size={32} />
        </ThemeIcon>

        <Text size="lg" fw={600} ta="center">
          {title}
        </Text>

        <Text size="sm" c="dimmed" ta="center">
          {message}
        </Text>

        <Group mt="md" justify="center">
          <Button variant="default" onClick={onClose} disabled={loading}>
            {cancelText}
          </Button>
          <Button
            color={config.confirmColor}
            onClick={handleConfirm}
            loading={loading}
          >
            {confirmText}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

// Hook for easier usage
import { useCallback, useState } from 'react';

interface UseConfirmDialogOptions {
  title: string;
  message: string;
  variant?: 'danger' | 'warning' | 'info';
  confirmText?: string;
  cancelText?: string;
}

export function useConfirmDialog() {
  const [opened, setOpened] = useState(false);
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<UseConfirmDialogOptions>({
    title: '',
    message: '',
    variant: 'info',
  });
  const [resolveRef, setResolveRef] = useState<((value: boolean) => void) | null>(null);

  const confirm = useCallback((opts: UseConfirmDialogOptions): Promise<boolean> => {
    setOptions(opts);
    setOpened(true);

    return new Promise((resolve) => {
      setResolveRef(() => resolve);
    });
  }, []);

  const handleConfirm = useCallback(() => {
    if (resolveRef) {
      resolveRef(true);
      setResolveRef(null);
    }
    setOpened(false);
  }, [resolveRef]);

  const handleClose = useCallback(() => {
    if (resolveRef) {
      resolveRef(false);
      setResolveRef(null);
    }
    setOpened(false);
  }, [resolveRef]);

  const dialogProps: ConfirmDialogProps = {
    opened,
    onClose: handleClose,
    onConfirm: handleConfirm,
    title: options.title,
    message: options.message,
    variant: options.variant,
    confirmText: options.confirmText,
    cancelText: options.cancelText,
    loading,
  };

  return {
    confirm,
    dialogProps,
    setLoading,
    ConfirmDialogComponent: () => <ConfirmDialog {...dialogProps} />,
  };
}
