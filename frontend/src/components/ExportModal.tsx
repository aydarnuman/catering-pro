'use client';

import { useState, useEffect } from 'react';
import {
  Modal,
  Stack,
  Group,
  Text,
  Select,
  Button,
  Paper,
  Badge,
  Loader,
  Alert
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  IconFileSpreadsheet,
  IconFileTypePdf,
  IconDownload,
  IconAlertCircle
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import 'dayjs/locale/tr';

interface ExportModalProps {
  opened: boolean;
  onClose: () => void;
  type: 'personel' | 'fatura' | 'cari' | 'stok' | 'bordro';
  projeler?: { id: number; ad: string }[];
  departmanlar?: string[];
  kategoriler?: string[];
}

interface RaporTipi {
  value: string;
  label: string;
  endpoint: string;
  needsParam?: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const typeLabels: Record<string, string> = {
  personel: 'Personel',
  fatura: 'Fatura',
  cari: 'Cari',
  stok: 'Stok'
};

export function ExportModal({ opened, onClose, type, projeler = [], departmanlar = [], kategoriler = [] }: ExportModalProps) {
  const [raporTipleri, setRaporTipleri] = useState<RaporTipi[]>([]);
  const [selectedRapor, setSelectedRapor] = useState<string>('tum');
  const [selectedParam, setSelectedParam] = useState<string>('');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [donem, setDonem] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Rapor tiplerini yükle
  useEffect(() => {
    if (opened) {
      fetchRaporTipleri();
      // Varsayılan dönem (bu ay)
      const now = new Date();
      setDonem(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
    }
  }, [opened, type]);

  const fetchRaporTipleri = async () => {
    try {
      console.log('Fetching rapor tipleri from:', `${API_BASE}/export/rapor-tipleri/${type}`);
      const response = await fetch(`${API_BASE}/export/rapor-tipleri/${type}`);
      
      if (!response.ok) {
        console.error('API yanıtı başarısız:', response.status, response.statusText);
        // Varsayılan rapor tiplerini kullan
        setRaporTipleri(getDefaultRaporTipleri(type));
        return;
      }
      
      const data = await response.json();
      console.log('API yanıtı:', data);
      
      // Array olduğundan emin ol
      if (Array.isArray(data)) {
        setRaporTipleri(data);
      } else {
        console.warn('Rapor tipleri array değil, varsayılan kullanılıyor:', data);
        setRaporTipleri(getDefaultRaporTipleri(type));
      }
    } catch (error) {
      console.error('Rapor tipleri yüklenemedi:', error);
      // Varsayılan rapor tiplerini kullan
      setRaporTipleri(getDefaultRaporTipleri(type));
    }
  };
  
  // Varsayılan rapor tipleri (backend'e erişilemezse)
  const getDefaultRaporTipleri = (t: string): RaporTipi[] => {
    const defaults: Record<string, RaporTipi[]> = {
      personel: [
        { value: 'tum', label: 'Tüm Personel', endpoint: '/personel/excel' },
        { value: 'proje', label: 'Proje Bazlı', endpoint: '/personel/proje/:id', needsParam: 'proje' },
        { value: 'departman', label: 'Departman Bazlı', endpoint: '/personel/excel?departman=', needsParam: 'departman' }
      ],
      fatura: [
        { value: 'tum', label: 'Tüm Faturalar', endpoint: '/fatura/excel' },
        { value: 'satis', label: 'Satış Faturaları', endpoint: '/fatura/excel?type=SATIS' },
        { value: 'alis', label: 'Alış Faturaları', endpoint: '/fatura/excel?type=ALIS' }
      ],
      cari: [
        { value: 'tum', label: 'Tüm Cariler', endpoint: '/cari/excel' },
        { value: 'musteri', label: 'Müşteriler', endpoint: '/cari/excel?tip=musteri' },
        { value: 'tedarikci', label: 'Tedarikçiler', endpoint: '/cari/excel?tip=tedarikci' }
      ],
      stok: [
        { value: 'tum', label: 'Tüm Stok', endpoint: '/stok/excel' },
        { value: 'kritik', label: 'Kritik Stok', endpoint: '/stok/kritik' }
      ]
    };
    return defaults[t] || [{ value: 'tum', label: 'Tüm Liste', endpoint: `/${t}/excel` }];
  };

  const currentRapor = Array.isArray(raporTipleri) ? raporTipleri.find(r => r.value === selectedRapor) : null;

  // Export URL oluştur
  const buildExportUrl = (format: 'excel' | 'pdf') => {
    if (!currentRapor) return '';

    let endpoint = currentRapor.endpoint;

    // Parametre gerektiren raporlar
    if (currentRapor.needsParam === 'proje' && selectedParam) {
      endpoint = endpoint.replace(':id', selectedParam);
    } else if (currentRapor.needsParam === 'donem' && donem) {
      endpoint = endpoint.replace(':donem', donem);
    } else if (currentRapor.needsParam === 'departman' && selectedParam) {
      endpoint = endpoint + encodeURIComponent(selectedParam);
    } else if (currentRapor.needsParam === 'kategori' && selectedParam) {
      endpoint = endpoint + encodeURIComponent(selectedParam);
    } else if (currentRapor.needsParam === 'tarih' && startDate && endDate) {
      const params = new URLSearchParams();
      params.append('startDate', startDate.toISOString().split('T')[0]);
      params.append('endDate', endDate.toISOString().split('T')[0]);
      endpoint = endpoint + (endpoint.includes('?') ? '&' : '?') + params.toString();
    }

    // Format parametresi (PDF için)
    if (format === 'pdf') {
      // Excel endpoint'ini PDF'e çevir
      endpoint = endpoint.replace('/excel', '/pdf');
      // Özel raporlar için format parametresi ekle
      if (!endpoint.includes('/pdf')) {
        endpoint = endpoint + (endpoint.includes('?') ? '&' : '?') + 'format=pdf';
      }
    }

    const url = `${API_BASE}/export${endpoint}`;
    console.log('Export URL:', url); // Debug için
    return url;
  };

  const handleExport = async (format: 'excel' | 'pdf') => {
    const url = buildExportUrl(format);
    if (!url) {
      notifications.show({
        title: 'Hata',
        message: 'Lütfen rapor tipini seçin',
        color: 'red'
      });
      return;
    }

    try {
      notifications.show({
        id: `export-${format}`,
        title: format === 'excel' ? 'Excel Hazırlanıyor...' : 'PDF Hazırlanıyor...',
        message: `${currentRapor?.label || ''} raporu indiriliyor...`,
        color: format === 'excel' ? 'green' : 'blue',
        loading: true,
        autoClose: false
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
      a.download = `${currentRapor?.label || type}-${new Date().toISOString().split('T')[0]}.${format === 'excel' ? 'xlsx' : 'pdf'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
      
      notifications.update({
        id: `export-${format}`,
        title: 'İndirildi!',
        message: `${currentRapor?.label || ''} raporu başarıyla indirildi.`,
        color: 'green',
        loading: false,
        autoClose: 3000,
        icon: format === 'excel' ? <IconFileSpreadsheet size={18} /> : <IconFileTypePdf size={18} />
      });
      
      onClose();
    } catch (error: any) {
      console.error('Export error:', error);
      notifications.update({
        id: `export-${format}`,
        title: 'İndirme Hatası',
        message: error.message || 'Dosya indirilemedi',
        color: 'red',
        loading: false,
        autoClose: 5000
      });
    }
  };

  // Parametre select verisi
  const getParamOptions = () => {
    if (!currentRapor?.needsParam) return [];

    switch (currentRapor.needsParam) {
      case 'proje':
        return projeler.map(p => ({ value: p.id.toString(), label: p.ad }));
      case 'departman':
        return departmanlar.map(d => ({ value: d, label: d }));
      case 'kategori':
        return kategoriler.map(k => ({ value: k, label: k }));
      default:
        return [];
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconDownload size={20} />
          <Text fw={600}>{typeLabels[type]} Dışa Aktarım</Text>
        </Group>
      }
      size="md"
    >
      <Stack gap="md">
        {/* Rapor Tipi Seçimi */}
        <Select
          label="Rapor Tipi"
          placeholder="Rapor tipini seçin"
          data={raporTipleri.map(r => ({ value: r.value, label: r.label }))}
          value={selectedRapor}
          onChange={(val) => {
            setSelectedRapor(val || 'tum');
            setSelectedParam('');
          }}
        />

        {/* Parametre Seçimi (Proje, Departman, Kategori) */}
        {currentRapor?.needsParam && currentRapor.needsParam !== 'tarih' && currentRapor.needsParam !== 'donem' && (
          <Select
            label={
              currentRapor.needsParam === 'proje' ? 'Proje Seçin' :
              currentRapor.needsParam === 'departman' ? 'Departman Seçin' :
              'Kategori Seçin'
            }
            placeholder="Seçiniz..."
            data={getParamOptions()}
            value={selectedParam}
            onChange={(val) => setSelectedParam(val || '')}
            searchable
          />
        )}

        {/* Dönem Seçimi (Bordro için) */}
        {currentRapor?.needsParam === 'donem' && (
          <Select
            label="Dönem"
            placeholder="Dönem seçin"
            data={[
              { value: `${new Date().getFullYear()}-01`, label: 'Ocak 2026' },
              { value: `${new Date().getFullYear()}-02`, label: 'Şubat 2026' },
              { value: `${new Date().getFullYear()}-03`, label: 'Mart 2026' },
              { value: `${new Date().getFullYear()}-04`, label: 'Nisan 2026' },
              { value: `${new Date().getFullYear()}-05`, label: 'Mayıs 2026' },
              { value: `${new Date().getFullYear()}-06`, label: 'Haziran 2026' },
              { value: `${new Date().getFullYear()}-07`, label: 'Temmuz 2026' },
              { value: `${new Date().getFullYear()}-08`, label: 'Ağustos 2026' },
              { value: `${new Date().getFullYear()}-09`, label: 'Eylül 2026' },
              { value: `${new Date().getFullYear()}-10`, label: 'Ekim 2026' },
              { value: `${new Date().getFullYear()}-11`, label: 'Kasım 2026' },
              { value: `${new Date().getFullYear()}-12`, label: 'Aralık 2026' }
            ]}
            value={donem}
            onChange={(val) => setDonem(val || '')}
          />
        )}

        {/* Tarih Aralığı Seçimi */}
        {currentRapor?.needsParam === 'tarih' && (
          <Group grow>
            <DatePickerInput
              label="Başlangıç"
              placeholder="Tarih seçin"
              value={startDate}
              onChange={setStartDate}
              locale="tr"
            />
            <DatePickerInput
              label="Bitiş"
              placeholder="Tarih seçin"
              value={endDate}
              onChange={setEndDate}
              locale="tr"
            />
          </Group>
        )}

        {/* Seçilen Rapor Bilgisi */}
        {currentRapor && (
          <Paper withBorder p="sm" radius="md" bg="gray.0">
            <Group justify="space-between">
              <Text size="sm" c="dimmed">Seçilen Rapor:</Text>
              <Badge color="blue" variant="light">{currentRapor.label}</Badge>
            </Group>
          </Paper>
        )}

        {/* Uyarı */}
        {currentRapor?.needsParam && !selectedParam && currentRapor.needsParam !== 'tarih' && currentRapor.needsParam !== 'donem' && (
          <Alert color="yellow" icon={<IconAlertCircle size={16} />}>
            Lütfen {currentRapor.needsParam === 'proje' ? 'proje' : currentRapor.needsParam === 'departman' ? 'departman' : 'kategori'} seçin.
          </Alert>
        )}

        {/* Export Butonları */}
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={onClose}>
            İptal
          </Button>
          <Button
            leftSection={<IconFileSpreadsheet size={18} />}
            color="green"
            onClick={() => handleExport('excel')}
            disabled={!!(currentRapor?.needsParam && !selectedParam && currentRapor.needsParam !== 'tarih' && currentRapor.needsParam !== 'donem')}
          >
            Excel
          </Button>
          <Button
            leftSection={<IconFileTypePdf size={18} />}
            color="red"
            onClick={() => handleExport('pdf')}
            disabled={!!(currentRapor?.needsParam && !selectedParam && currentRapor.needsParam !== 'tarih' && currentRapor.needsParam !== 'donem')}
          >
            PDF
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

