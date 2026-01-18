'use client';

import {
  ActionIcon,
  Group,
  Menu,
  Modal,
  Select,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconCheck,
  IconDotsVertical,
  IconFileSpreadsheet,
  IconFileTypePdf,
  IconMail,
  IconSettings,
  IconUpload,
  IconX,
} from '@tabler/icons-react';
import { useState } from 'react';
import { API_BASE_URL } from '@/lib/config';
import { ExportModal } from './ExportModal';
import { ImportModal } from './ImportModal';

interface DataActionsProps {
  type: 'personel' | 'fatura' | 'cari' | 'stok' | 'bordro';
  filters?: Record<string, string>;
  onImportSuccess?: () => void;
  // Sayfa bazlı veriler (export seçenekleri için)
  projeler?: { id: number; ad: string }[];
  departmanlar?: string[];
  kategoriler?: string[];
}

const API_BASE = `${API_BASE_URL}/api`;

const typeLabels: Record<string, string> = {
  personel: 'Personel',
  fatura: 'Fatura',
  cari: 'Cari',
  stok: 'Stok',
  bordro: 'Bordro',
};

export function DataActions({
  type,
  filters = {},
  onImportSuccess,
  projeler = [],
  departmanlar = [],
  kategoriler = [],
}: DataActionsProps) {
  const [mailModalOpen, setMailModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [format, setFormat] = useState<string>('excel');
  const [loading, setLoading] = useState(false);

  // Query string oluştur
  const buildQueryString = () => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.append(key, value);
    });
    return params.toString() ? `?${params.toString()}` : '';
  };

  // Dosya indirme fonksiyonu
  const downloadFile = async (format: 'excel' | 'pdf') => {
    const url = `${API_BASE}/export/${type}/${format}${buildQueryString()}`;

    try {
      notifications.show({
        id: `download-${format}`,
        title: format === 'excel' ? 'Excel Hazırlanıyor...' : 'PDF Hazırlanıyor...',
        message: `${typeLabels[type]} listesi indiriliyor...`,
        color: format === 'excel' ? 'green' : 'blue',
        loading: true,
        autoClose: false,
      });

      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'İndirme başarısız' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${type}-listesi-${new Date().toISOString().split('T')[0]}.${format === 'excel' ? 'xlsx' : 'pdf'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);

      notifications.update({
        id: `download-${format}`,
        title: 'İndirildi!',
        message: `${typeLabels[type]} listesi başarıyla indirildi.`,
        color: 'green',
        loading: false,
        autoClose: 3000,
        icon:
          format === 'excel' ? <IconFileSpreadsheet size={18} /> : <IconFileTypePdf size={18} />,
      });
    } catch (error: any) {
      console.error('Download error:', error);
      notifications.update({
        id: `download-${format}`,
        title: 'İndirme Hatası',
        message: error.message || 'Dosya indirilemedi',
        color: 'red',
        loading: false,
        autoClose: 5000,
        icon: <IconX size={18} />,
      });
    }
  };

  // Hızlı Excel indir (tüm liste)
  const handleQuickExcelDownload = () => {
    downloadFile('excel');
  };

  // Hızlı PDF indir (tüm liste)
  const handleQuickPdfDownload = () => {
    downloadFile('pdf');
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
        body: JSON.stringify({ email, format, ...filters }),
      });

      const data = await response.json();

      if (response.ok) {
        notifications.show({
          title: 'Gönderildi',
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
      <Menu shadow="md" width={220} position="bottom-end">
        <Menu.Target>
          <Tooltip label="Dışa/İçe Aktar">
            <ActionIcon variant="light" color="gray" size="lg" radius="md">
              <IconDotsVertical size={18} />
            </ActionIcon>
          </Tooltip>
        </Menu.Target>

        <Menu.Dropdown>
          <Menu.Label>📥 İçe Aktar</Menu.Label>

          <Menu.Item
            leftSection={<IconUpload size={16} color="teal" />}
            onClick={() => setImportModalOpen(true)}
          >
            Toplu Veri Yükle (AI)
          </Menu.Item>

          <Menu.Divider />

          <Menu.Label>📤 Hızlı Dışa Aktar</Menu.Label>

          <Menu.Item
            leftSection={<IconFileSpreadsheet size={16} color="green" />}
            onClick={handleQuickExcelDownload}
          >
            Tüm Liste (Excel)
          </Menu.Item>

          <Menu.Item
            leftSection={<IconFileTypePdf size={16} color="red" />}
            onClick={handleQuickPdfDownload}
          >
            Tüm Liste (PDF)
          </Menu.Item>

          <Menu.Divider />

          <Menu.Item
            leftSection={<IconSettings size={16} color="violet" />}
            onClick={() => setExportModalOpen(true)}
          >
            Detaylı Rapor Seçenekleri
          </Menu.Item>

          <Menu.Divider />

          <Menu.Item
            leftSection={<IconMail size={16} color="blue" />}
            onClick={() => setMailModalOpen(true)}
          >
            E-posta ile Gönder
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>

      {/* Mail Modal */}
      <Modal
        opened={mailModalOpen}
        onClose={() => setMailModalOpen(false)}
        title={<Text fw={600}>{typeLabels[type]} Listesini E-posta Gönder</Text>}
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

          <Group justify="flex-end" mt="md">
            <Text
              size="sm"
              c="dimmed"
              style={{ cursor: 'pointer' }}
              onClick={() => setMailModalOpen(false)}
            >
              İptal
            </Text>
            <ActionIcon
              variant="filled"
              color="blue"
              size="lg"
              onClick={handleMailSend}
              loading={loading}
            >
              <IconMail size={18} />
            </ActionIcon>
          </Group>
        </Stack>
      </Modal>

      {/* Import Modal */}
      <ImportModal
        opened={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        defaultType={type}
        onSuccess={onImportSuccess}
      />

      {/* Export Modal */}
      <ExportModal
        opened={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        type={type}
        projeler={projeler}
        departmanlar={departmanlar}
        kategoriler={kategoriler}
      />
    </>
  );
}
