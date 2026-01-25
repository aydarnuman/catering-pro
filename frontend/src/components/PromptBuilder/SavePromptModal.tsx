'use client';

import {
  Button,
  Group,
  Modal,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconBookmark, IconCheck } from '@tabler/icons-react';
import { useEffect, useState } from 'react';

interface SavePromptModalProps {
  opened: boolean;
  onClose: () => void;
  onSave: (name: string, description?: string, isPublic?: boolean) => Promise<void>;
  isSaving?: boolean;
  defaultName?: string;
}

export function SavePromptModal({
  opened,
  onClose,
  onSave,
  isSaving,
  defaultName,
}: SavePromptModalProps) {
  const [name, setName] = useState(defaultName || '');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  // defaultName değişince güncelle
  useEffect(() => {
    if (defaultName) {
      setName(defaultName);
    }
  }, [defaultName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (name.trim().length < 3) {
      setNameError('İsim en az 3 karakter olmalı');
      return;
    }

    try {
      await onSave(name, description, isPublic);
      notifications.show({
        title: 'Kaydedildi!',
        message: 'Prompt başarıyla kaydedildi',
        color: 'green',
        icon: <IconCheck size={16} />,
      });
      // Reset form
      setName('');
      setDescription('');
      setIsPublic(false);
      setNameError(null);
      onClose();
    } catch (error) {
      notifications.show({
        title: 'Hata',
        message: error instanceof Error ? error.message : 'Kaydetme başarısız',
        color: 'red',
      });
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="sm">
          <ThemeIcon color="green" variant="light" radius="xl">
            <IconBookmark size={18} />
          </ThemeIcon>
          <Text fw={600}>Prompt&apos;u Kaydet</Text>
        </Group>
      }
      size="md"
      radius="lg"
    >
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          <TextInput
            label="İsim"
            placeholder="Örn: İhale Risk Analizi - KYK"
            required
            value={name}
            onChange={(e) => {
              setName(e.currentTarget.value);
              if (e.currentTarget.value.trim().length >= 3) {
                setNameError(null);
              }
            }}
            error={nameError}
          />

          <Textarea
            label="Açıklama (Opsiyonel)"
            placeholder="Bu prompt ne için kullanılacak?"
            minRows={2}
            value={description}
            onChange={(e) => setDescription(e.currentTarget.value)}
          />

          <Switch
            label="Herkese Açık Yap"
            description="Diğer kullanıcılar da bu prompt'u görebilir"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.currentTarget.checked)}
          />

          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={onClose}>
              İptal
            </Button>
            <Button
              type="submit"
              loading={isSaving}
              variant="gradient"
              gradient={{ from: 'green', to: 'teal' }}
              leftSection={<IconBookmark size={16} />}
            >
              Kaydet
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
