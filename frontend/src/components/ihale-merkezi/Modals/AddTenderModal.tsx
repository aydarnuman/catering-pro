'use client';

import {
  Button,
  Group,
  Loader,
  Modal,
  Paper,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconLink, IconPlus } from '@tabler/icons-react';
import { useState } from 'react';
import { api } from '@/lib/api';

interface AddTenderModalProps {
  opened: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddTenderModal({ opened, onClose, onSuccess }: AddTenderModalProps) {
  const [tenderUrl, setTenderUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!tenderUrl.trim()) {
      notifications.show({
        title: 'Hata',
        message: 'URL girmelisiniz',
        color: 'red',
      });
      return;
    }

    if (!tenderUrl.includes('ihalebul.com/tender/')) {
      notifications.show({
        title: 'Geçersiz URL',
        message: 'URL formatı: https://ihalebul.com/tender/123456',
        color: 'red',
      });
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/api/scraper/add-tender', { url: tenderUrl.trim() });
      const data = res.data;

      if (data.success) {
        notifications.show({
          title: data.data.isNew ? 'Yeni İhale Eklendi' : 'İhale Güncellendi',
          message: `${data.data.title?.substring(0, 50) || 'İhale'}... (${data.data.documentCount} döküman)`,
          color: 'green',
        });
        setTenderUrl('');
        onClose();
        onSuccess();
      } else {
        notifications.show({
          title: 'Hata',
          message: data.error || 'İhale eklenemedi',
          color: 'red',
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'İhale ekleme başarısız';
      notifications.show({
        title: 'Hata',
        message,
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="URL ile İhale Ekle"
      centered
      size="md"
    >
      <Stack gap="md">
        <TextInput
          label="İhale URL'si"
          placeholder="https://ihalebul.com/tender/123456"
          value={tenderUrl}
          onChange={(e) => setTenderUrl(e.target.value)}
          description="ihalebul.com üzerindeki ihale detay sayfasının URL'sini girin"
          leftSection={<IconLink size={16} />}
          disabled={loading}
        />

        <Paper p="sm" radius="md" withBorder>
          <Text size="xs" c="dimmed">
            <strong>Örnek:</strong> https://ihalebul.com/tender/1768253602118
          </Text>
          <Text size="xs" c="dimmed" mt="xs">
            Bu işlem ihale bilgilerini, döküman linklerini, ihale ilanı ve mal/hizmet
            listesini otomatik olarak çeker.
          </Text>
        </Paper>

        <Group justify="flex-end" mt="md">
          <Button variant="light" onClick={onClose} disabled={loading}>
            İptal
          </Button>
          <Button
            variant="gradient"
            gradient={{ from: 'teal', to: 'cyan' }}
            leftSection={loading ? <Loader size={14} color="white" /> : <IconPlus size={16} />}
            onClick={handleSubmit}
            disabled={!tenderUrl.trim() || loading}
          >
            {loading ? 'Ekleniyor...' : 'İhale Ekle'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
