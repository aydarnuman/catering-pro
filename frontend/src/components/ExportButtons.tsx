'use client';

import { Alert, Button, Group, Menu, Modal, Select, Stack, Text, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconCheck,
  IconDownload,
  IconFileSpreadsheet,
  IconFileTypePdf,
  IconMail,
  IconX,
} from '@tabler/icons-react';
import { useState } from 'react';
import { API_BASE_URL } from '@/lib/config';

interface ExportButtonsProps {
  type: 'personel' | 'fatura' | 'cari' | 'stok';
  filters?: Record<string, string>;
}

const API_BASE = `${API_BASE_URL}/api`;

export function ExportButtons({ type, filters = {} }: ExportButtonsProps) {
  const [mailModalOpen, setMailModalOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [format, setFormat] = useState<string>('excel');
  const [loading, setLoading] = useState(false);

  const typeLabels: Record<string, string> = {
    personel: 'Personel',
    fatura: 'Fatura',
    cari: 'Cari',
    stok: 'Stok',
  };

  // Query string oluştur
  const buildQueryString = () => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.append(key, value);
    });
    return params.toString() ? `?${params.toString()}` : '';
  };

  // Excel indir
  const handleExcelDownload = () => {
    const url = `${API_BASE}/export/${type}/excel${buildQueryString()}`;
    window.open(url, '_blank');
    notifications.show({
      title: 'Excel İndiriliyor',
      message: `${typeLabels[type]} listesi Excel olarak indiriliyor...`,
      color: 'green',
      icon: <IconFileSpreadsheet size={18} />,
    });
  };

  // PDF indir
  const handlePdfDownload = () => {
    const url = `${API_BASE}/export/${type}/pdf${buildQueryString()}`;
    window.open(url, '_blank');
    notifications.show({
      title: 'PDF İndiriliyor',
      message: `${typeLabels[type]} listesi PDF olarak indiriliyor...`,
      color: 'blue',
      icon: <IconFileTypePdf size={18} />,
    });
  };

  // Mail gönder
  const handleMailSend = async () => {
    if (!email || !email.includes('@')) {
      notifications.show({
        title: 'Hata',
        message: 'Geçerli bir e-posta adresi girin',
        color: 'red',
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/export/${type}/mail`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          format,
          ...filters,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        notifications.show({
          title: 'Mail Gönderildi',
          message: `${typeLabels[type]} listesi ${email} adresine gönderildi`,
          color: 'green',
          icon: <IconCheck size={18} />,
        });
        setMailModalOpen(false);
        setEmail('');
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      notifications.show({
        title: 'Hata',
        message: error.message || 'Mail gönderilemedi',
        color: 'red',
        icon: <IconX size={18} />,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Menu shadow="md" width={200}>
        <Menu.Target>
          <Button variant="light" leftSection={<IconDownload size={16} />} size="sm">
            Dışa Aktar
          </Button>
        </Menu.Target>

        <Menu.Dropdown>
          <Menu.Label>Dışa Aktarım Formatı</Menu.Label>

          <Menu.Item
            leftSection={<IconFileSpreadsheet size={16} color="green" />}
            onClick={handleExcelDownload}
          >
            Excel (.xlsx)
          </Menu.Item>

          <Menu.Item
            leftSection={<IconFileTypePdf size={16} color="red" />}
            onClick={handlePdfDownload}
          >
            PDF
          </Menu.Item>

          <Menu.Divider />

          <Menu.Item
            leftSection={<IconMail size={16} color="blue" />}
            onClick={() => setMailModalOpen(true)}
          >
            E-posta Gönder
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>

      {/* Mail Modal */}
      <Modal
        opened={mailModalOpen}
        onClose={() => setMailModalOpen(false)}
        title={<Text fw={600}>{typeLabels[type]} Listesini E-posta ile Gönder</Text>}
        size="sm"
      >
        <Stack gap="md">
          <TextInput
            label="E-posta Adresi"
            placeholder="ornek@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <Select
            label="Format"
            value={format}
            onChange={(val) => setFormat(val || 'excel')}
            data={[
              { value: 'excel', label: 'Excel (.xlsx)' },
              { value: 'pdf', label: 'PDF' },
            ]}
          />

          <Alert color="blue" variant="light">
            <Text size="sm">
              {typeLabels[type]} listesi seçilen formatta e-posta adresinize gönderilecek.
            </Text>
          </Alert>

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setMailModalOpen(false)}>
              İptal
            </Button>
            <Button onClick={handleMailSend} loading={loading} leftSection={<IconMail size={16} />}>
              Gönder
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
