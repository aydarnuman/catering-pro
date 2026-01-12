'use client';

import { useState, useEffect } from 'react';
import {
  Modal,
  Tabs,
  Table,
  Group,
  Text,
  Badge,
  Stack,
  SimpleGrid,
  Paper,
  ThemeIcon,
  Card,
  Title,
  Button,
  Select,
  Divider,
  Loader
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  IconUser,
  IconReceipt,
  IconTrendingUp,
  IconTrendingDown,
  IconCalendar,
  IconCash,
  IconAlertCircle,
  IconFileInvoice,
  IconCoin,
  IconChartBar,
  IconDownload,
  IconPrinter,
  IconEdit,
  IconScale,
  IconTrash
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { uyumsoftAPI } from '@/lib/invoice-api';

interface Cari {
  id: number;
  unvan: string;
  tip: string;
  vergi_no?: string;
  telefon?: string;
  email?: string;
  il?: string;
  borc: number;
  alacak: number;
  bakiye: number;
}

interface CariHareket {
  id: number;
  tarih: string;
  belge_no: string;
  aciklama: string;
  borc: number;
  alacak: number;
  bakiye: number;
  vade_tarihi?: string;
  hareket_tipi: string;
}

interface CariDetayModalProps {
  opened: boolean;
  onClose: () => void;
  cari: Cari | null;
  onEdit?: (cari: Cari) => void;
  onMutabakat?: (cari: Cari) => void;
  onDelete?: (cariId: number) => void;
}

export default function CariDetayModal({ opened, onClose, cari, onEdit, onMutabakat, onDelete }: CariDetayModalProps) {
  const [activeTab, setActiveTab] = useState<string | null>('ozet');
  const [hareketler, setHareketler] = useState<CariHareket[]>([]);
  const [aylikOzet, setAylikOzet] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null]);
  const [filterType, setFilterType] = useState<string | null>('all');
  
  // Fatura görüntüleme state'leri
  const [faturaModalOpened, setFaturaModalOpened] = useState(false);
  const [faturaLoading, setFaturaLoading] = useState(false);
  const [faturaHtml, setFaturaHtml] = useState<string | null>(null);
  const [selectedBelgeNo, setSelectedBelgeNo] = useState<string>('');

  useEffect(() => {
    if (cari && opened) {
      loadCariHareketler();
      loadAylikOzet();
    }
  }, [cari, opened]);

  // Filtreler değiştiğinde tekrar yükle
  useEffect(() => {
    if (cari && opened) {
      loadCariHareketler();
    }
  }, [dateRange, filterType]);

  const loadCariHareketler = async () => {
    setLoading(true);
    try {
      // URL parametrelerini oluştur
      const params = new URLSearchParams();
      
      if (dateRange[0]) {
        params.append('baslangic', dateRange[0].toISOString().split('T')[0]);
      }
      if (dateRange[1]) {
        params.append('bitis', dateRange[1].toISOString().split('T')[0]);
      }
      if (filterType && filterType !== 'all') {
        params.append('tip', filterType);
      }
      
      const queryString = params.toString();
      const url = `http://localhost:3001/api/cariler/${cari?.id}/hareketler${queryString ? `?${queryString}` : ''}`;
      
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setHareketler(data.data || []);
      }
    } catch (error) {
      console.error('Hareketler yüklenemedi:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAylikOzet = async () => {
    try {
      const response = await fetch(`http://localhost:3001/api/cariler/${cari?.id}/aylik-ozet`);
      if (response.ok) {
        const data = await response.json();
        setAylikOzet(data.data || []);
      }
    } catch (error) {
      console.error('Aylık özet yüklenemedi:', error);
    }
  };

  const formatMoney = (value: number) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY'
    }).format(value);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('tr-TR');
  };

  // Excel'e aktar
  const exportToExcel = () => {
    if (hareketler.length === 0) {
      notifications.show({
        title: 'Uyarı',
        message: 'Dışa aktarılacak veri bulunamadı',
        color: 'yellow'
      });
      return;
    }

    // CSV formatında oluştur
    const headers = ['Tarih', 'Belge No', 'Açıklama', 'Vade', 'Borç', 'Alacak', 'Bakiye'];
    const rows = hareketler.map(h => [
      formatDate(h.tarih),
      h.belge_no,
      h.aciklama,
      h.vade_tarihi ? formatDate(h.vade_tarihi) : '',
      h.borc.toFixed(2),
      h.alacak.toFixed(2),
      h.bakiye.toFixed(2)
    ]);

    const csvContent = [
      `${cari?.unvan} - Cari Ekstre`,
      '',
      headers.join(';'),
      ...rows.map(row => row.join(';'))
    ].join('\n');

    // BOM ekle (Türkçe karakterler için)
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${cari?.unvan}_ekstre_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    notifications.show({
      title: 'Başarılı',
      message: 'Excel dosyası indirildi',
      color: 'green'
    });
  };

  // Yazdır
  const handlePrint = () => {
    if (hareketler.length === 0) {
      notifications.show({
        title: 'Uyarı',
        message: 'Yazdırılacak veri bulunamadı',
        color: 'yellow'
      });
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${cari?.unvan} - Ekstre</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { font-size: 18px; margin-bottom: 5px; }
          h2 { font-size: 14px; color: #666; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f5f5f5; }
          .borc { color: #c92a2a; }
          .alacak { color: #2f9e44; }
          .bakiye-positive { color: #2f9e44; font-weight: bold; }
          .bakiye-negative { color: #c92a2a; font-weight: bold; }
          .right { text-align: right; }
          @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <h1>${cari?.unvan}</h1>
        <h2>Cari Ekstre - ${new Date().toLocaleDateString('tr-TR')}</h2>
        <table>
          <thead>
            <tr>
              <th>Tarih</th>
              <th>Belge No</th>
              <th>Açıklama</th>
              <th>Vade</th>
              <th class="right">Borç</th>
              <th class="right">Alacak</th>
              <th class="right">Bakiye</th>
            </tr>
          </thead>
          <tbody>
            ${hareketler.map(h => `
              <tr>
                <td>${formatDate(h.tarih)}</td>
                <td>${h.belge_no}</td>
                <td>${h.aciklama}</td>
                <td>${h.vade_tarihi ? formatDate(h.vade_tarihi) : '-'}</td>
                <td class="right borc">${h.borc > 0 ? h.borc.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' ₺' : ''}</td>
                <td class="right alacak">${h.alacak > 0 ? h.alacak.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' ₺' : ''}</td>
                <td class="right ${h.bakiye >= 0 ? 'bakiye-positive' : 'bakiye-negative'}">${h.bakiye.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
  };

  // Belge numarasına tıklandığında fatura detayını göster
  const showFaturaDetay = async (belgeNo: string) => {
    setSelectedBelgeNo(belgeNo);
    setFaturaHtml(null);
    setFaturaModalOpened(true);
    setFaturaLoading(true);

    try {
      // Uyumsoft faturalarından belge numarasına göre ara
      const result = await uyumsoftAPI.getInvoices({ limit: 500 });
      
      if (result.success && result.data) {
        // Belge numarasıyla eşleşen faturayı bul
        const fatura = result.data.find((f: any) => f.faturaNo === belgeNo);
        
        if (fatura?.ettn) {
          // ETTN ile detayı çek
          const detay = await uyumsoftAPI.getInvoiceDetail(fatura.ettn);
          if (detay.success && detay.html) {
            setFaturaHtml(detay.html);
          }
        }
      }
    } catch (error) {
      console.error('Fatura detay hatası:', error);
    } finally {
      setFaturaLoading(false);
    }
  };

  if (!cari) return null;

  const vadesiGecmis = hareketler.filter(h => 
    h.vade_tarihi && new Date(h.vade_tarihi) < new Date() && h.borc > 0
  );
  const vadesiYaklasan = hareketler.filter(h => 
    h.vade_tarihi && 
    new Date(h.vade_tarihi) >= new Date() && 
    new Date(h.vade_tarihi) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) &&
    h.borc > 0
  );

  return (
    <>
      <Modal
        opened={opened}
        onClose={onClose}
        size="xl"
        title={
          <Group>
            <ThemeIcon size="lg" variant="light">
              <IconUser size={20} />
            </ThemeIcon>
            <div>
              <Text size="lg" fw={600}>{cari.unvan}</Text>
              <Text size="sm" c="dimmed">
                {cari.tip === 'musteri' ? 'Müşteri' : cari.tip === 'tedarikci' ? 'Tedarikçi' : 'Her İkisi'}
              </Text>
            </div>
          </Group>
        }
      >
        {/* İşlem Butonları */}
        <Group justify="flex-end" mb="md" gap="xs">
          {onEdit && (
            <Button 
              variant="light" 
              color="blue" 
              size="xs"
              leftSection={<IconEdit size={14} />}
              onClick={() => {
                onClose();
                onEdit(cari);
              }}
            >
              Düzenle
            </Button>
          )}
          {onMutabakat && (
            <Button 
              variant="light" 
              color="teal" 
              size="xs"
              leftSection={<IconScale size={14} />}
              onClick={() => {
                onClose();
                onMutabakat(cari);
              }}
            >
              Mutabakat
            </Button>
          )}
          {onDelete && (
            <Button 
              variant="light" 
              color="red" 
              size="xs"
              leftSection={<IconTrash size={14} />}
              onClick={() => {
                if (confirm('Bu cariyi silmek istediğinizden emin misiniz?')) {
                  onClose();
                  onDelete(cari.id);
                }
              }}
            >
              Sil
            </Button>
          )}
        </Group>

        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Tab value="ozet" leftSection={<IconChartBar size={16} />}>Özet</Tabs.Tab>
            <Tabs.Tab value="ekstre" leftSection={<IconReceipt size={16} />}>Ekstre</Tabs.Tab>
            <Tabs.Tab value="gelir-gider" leftSection={<IconCash size={16} />}>Gelir/Gider</Tabs.Tab>
            <Tabs.Tab value="vade" leftSection={<IconCalendar size={16} />}>Vade Analizi</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="ozet" pt="md">
            <Stack gap="md">
              <SimpleGrid cols={{ base: 1, sm: 3 }}>
                <Paper withBorder p="md">
                  <Group justify="space-between">
                    <div>
                      <Text size="xs" c="dimmed">Toplam Borç</Text>
                      <Text size="xl" fw={700} c="red">{formatMoney(cari.borc)}</Text>
                    </div>
                    <ThemeIcon color="red" variant="light" size="xl">
                      <IconTrendingDown size={24} />
                    </ThemeIcon>
                  </Group>
                </Paper>
                
                <Paper withBorder p="md">
                  <Group justify="space-between">
                    <div>
                      <Text size="xs" c="dimmed">Toplam Alacak</Text>
                      <Text size="xl" fw={700} c="green">{formatMoney(cari.alacak)}</Text>
                    </div>
                    <ThemeIcon color="green" variant="light" size="xl">
                      <IconTrendingUp size={24} />
                    </ThemeIcon>
                  </Group>
                </Paper>
                
                <Paper withBorder p="md">
                  <Group justify="space-between">
                    <div>
                      <Text size="xs" c="dimmed">Net Bakiye</Text>
                      <Text size="xl" fw={700} c={cari.bakiye >= 0 ? 'green' : 'red'}>
                        {formatMoney(cari.bakiye)}
                      </Text>
                    </div>
                    <ThemeIcon color={cari.bakiye >= 0 ? 'green' : 'red'} variant="light" size="xl">
                      <IconCoin size={24} />
                    </ThemeIcon>
                  </Group>
                </Paper>
              </SimpleGrid>

              <Card withBorder>
                <Group justify="space-between" mb="md">
                  <Title order={5}>Son 6 Ay Özeti</Title>
                  <Badge variant="light" size="lg">
                    Toplam: {formatMoney(aylikOzet.reduce((sum, o) => sum + (o.borc - o.alacak), 0))}
                  </Badge>
                </Group>
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Dönem</Table.Th>
                      <Table.Th style={{textAlign: 'right'}}>Borç</Table.Th>
                      <Table.Th style={{textAlign: 'right'}}>Alacak</Table.Th>
                      <Table.Th style={{textAlign: 'right'}}>Fark</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {aylikOzet.slice(0, 6).map((ozet, index) => {
                      const fark = ozet.alacak - ozet.borc;
                      return (
                        <Table.Tr key={index}>
                          <Table.Td><Text fw={500}>{ozet.ay}</Text></Table.Td>
                          <Table.Td style={{textAlign: 'right'}}>
                            {ozet.borc > 0 && <Text span c="red">{formatMoney(ozet.borc)}</Text>}
                          </Table.Td>
                          <Table.Td style={{textAlign: 'right'}}>
                            {ozet.alacak > 0 && <Text span c="green">{formatMoney(ozet.alacak)}</Text>}
                          </Table.Td>
                          <Table.Td style={{textAlign: 'right'}}>
                            <Text span c={fark >= 0 ? 'green' : 'red'} fw={600}>
                              {formatMoney(Math.abs(fark))}
                            </Text>
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              </Card>

              <Card withBorder>
                <Title order={5} mb="md">İletişim Bilgileri</Title>
                <SimpleGrid cols={2}>
                  <div>
                    <Text size="sm" c="dimmed">Vergi No</Text>
                    <Text size="sm" fw={500}>{cari.vergi_no || '-'}</Text>
                  </div>
                  <div>
                    <Text size="sm" c="dimmed">Telefon</Text>
                    <Text size="sm" fw={500}>{cari.telefon || '-'}</Text>
                  </div>
                  <div>
                    <Text size="sm" c="dimmed">E-posta</Text>
                    <Text size="sm" fw={500}>{cari.email || '-'}</Text>
                  </div>
                  <div>
                    <Text size="sm" c="dimmed">Şehir</Text>
                    <Text size="sm" fw={500}>{cari.il || '-'}</Text>
                  </div>
                </SimpleGrid>
              </Card>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="ekstre" pt="md">
            <Stack gap="md">
              <Group>
                <DatePickerInput
                  type="range"
                  label="Tarih Aralığı"
                  placeholder="Tarih seçin"
                  value={dateRange}
                  onChange={setDateRange}
                  style={{ flex: 1 }}
                />
                <Select
                  label="Hareket Tipi"
                  data={[
                    { value: 'all', label: 'Tümü' },
                    { value: 'fatura_alis', label: 'Alış Faturaları' },
                    { value: 'fatura_satis', label: 'Satış Faturaları' },
                    { value: 'tahsilat', label: 'Tahsilatlar' },
                    { value: 'odeme', label: 'Ödemeler' }
                  ]}
                  value={filterType}
                  onChange={setFilterType}
                />
                <Button 
                  variant="light" 
                  leftSection={<IconDownload size={16} />}
                  onClick={() => exportToExcel()}
                >
                  Excel
                </Button>
                <Button 
                  variant="light" 
                  leftSection={<IconPrinter size={16} />}
                  onClick={() => handlePrint()}
                >
                  Yazdır
                </Button>
              </Group>

              <Table.ScrollContainer minWidth={700}>
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Tarih</Table.Th>
                      <Table.Th>Belge No</Table.Th>
                      <Table.Th>Açıklama</Table.Th>
                      <Table.Th>Vade</Table.Th>
                      <Table.Th>Borç</Table.Th>
                      <Table.Th>Alacak</Table.Th>
                      <Table.Th>Bakiye</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {hareketler.map((hareket) => (
                      <Table.Tr key={hareket.id}>
                        <Table.Td>{formatDate(hareket.tarih)}</Table.Td>
                        <Table.Td>
                          <Badge 
                            variant="light" 
                            size="sm"
                            style={{ cursor: 'pointer' }}
                            onClick={() => showFaturaDetay(hareket.belge_no)}
                          >
                            {hareket.belge_no}
                          </Badge>
                        </Table.Td>
                        <Table.Td>{hareket.aciklama}</Table.Td>
                        <Table.Td>
                          {hareket.vade_tarihi ? (
                            <Badge 
                              color={new Date(hareket.vade_tarihi) < new Date() ? 'red' : 'blue'}
                              variant="light"
                              size="sm"
                            >
                              {formatDate(hareket.vade_tarihi)}
                            </Badge>
                          ) : '-'}
                        </Table.Td>
                        <Table.Td>
                          {hareket.borc > 0 && <Text c="red" fw={500}>{formatMoney(hareket.borc)}</Text>}
                        </Table.Td>
                        <Table.Td>
                          {hareket.alacak > 0 && <Text c="green" fw={500}>{formatMoney(hareket.alacak)}</Text>}
                        </Table.Td>
                        <Table.Td>
                          <Text c={hareket.bakiye >= 0 ? 'green' : 'red'} fw={600}>
                            {formatMoney(hareket.bakiye)}
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                    {hareketler.length === 0 && (
                      <Table.Tr>
                        <Table.Td colSpan={7} style={{ textAlign: 'center' }}>
                          <Text c="dimmed">Hareket bulunmamaktadır</Text>
                        </Table.Td>
                      </Table.Tr>
                    )}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="gelir-gider" pt="md">
            <Stack gap="md">
              {/* Özet Kartları */}
              <SimpleGrid cols={{ base: 1, sm: 3 }}>
                <Paper withBorder p="md">
                  <Text size="xs" c="dimmed">Toplam Gelir (Son 6 Ay)</Text>
                  <Text size="xl" fw={700} c="green">
                    {formatMoney(aylikOzet.slice(0, 6).reduce((sum, o) => sum + Number(o.alacak || 0), 0))}
                  </Text>
                </Paper>
                <Paper withBorder p="md">
                  <Text size="xs" c="dimmed">Toplam Gider (Son 6 Ay)</Text>
                  <Text size="xl" fw={700} c="red">
                    {formatMoney(aylikOzet.slice(0, 6).reduce((sum, o) => sum + Number(o.borc || 0), 0))}
                  </Text>
                </Paper>
                <Paper withBorder p="md">
                  <Text size="xs" c="dimmed">Net Durum</Text>
                  <Text size="xl" fw={700} c={aylikOzet.slice(0, 6).reduce((sum, o) => sum + Number(o.alacak || 0) - Number(o.borc || 0), 0) >= 0 ? 'green' : 'red'}>
                    {formatMoney(aylikOzet.slice(0, 6).reduce((sum, o) => sum + Number(o.alacak || 0) - Number(o.borc || 0), 0))}
                  </Text>
                </Paper>
              </SimpleGrid>

              <SimpleGrid cols={2}>
                <Card withBorder>
                  <Title order={5} mb="md" c="green">Gelirler (Alacaklar)</Title>
                  <Stack gap="xs">
                    {hareketler
                      .filter(h => h.alacak > 0)
                      .slice(0, 10)
                      .map((hareket) => (
                        <Group key={hareket.id} justify="space-between">
                          <div>
                            <Text size="sm" fw={500}>{hareket.belge_no}</Text>
                            <Text size="xs" c="dimmed">{formatDate(hareket.tarih)}</Text>
                          </div>
                          <Text size="sm" c="green" fw={500}>+{formatMoney(hareket.alacak)}</Text>
                        </Group>
                      ))}
                    {hareketler.filter(h => h.alacak > 0).length === 0 && (
                      <Text size="sm" c="dimmed" ta="center">Gelir hareketi yok</Text>
                    )}
                  </Stack>
                </Card>
                
                <Card withBorder>
                  <Title order={5} mb="md" c="red">Giderler (Borçlar)</Title>
                  <Stack gap="xs">
                    {hareketler
                      .filter(h => h.borc > 0)
                      .slice(0, 10)
                      .map((hareket) => (
                        <Group key={hareket.id} justify="space-between">
                          <div>
                            <Text size="sm" fw={500}>{hareket.belge_no}</Text>
                            <Text size="xs" c="dimmed">{formatDate(hareket.tarih)}</Text>
                          </div>
                          <Text size="sm" c="red" fw={500}>-{formatMoney(hareket.borc)}</Text>
                        </Group>
                      ))}
                    {hareketler.filter(h => h.borc > 0).length === 0 && (
                      <Text size="sm" c="dimmed" ta="center">Gider hareketi yok</Text>
                    )}
                  </Stack>
                </Card>
              </SimpleGrid>

              {/* Aylık Özet Grafiği */}
              <Card withBorder>
                <Title order={5} mb="md">Aylık Gelir/Gider Karşılaştırması</Title>
                <Table striped>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Dönem</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>Gelir</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>Gider</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>Net</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {aylikOzet.slice(0, 6).map((ozet, index) => {
                      const net = Number(ozet.alacak || 0) - Number(ozet.borc || 0);
                      return (
                        <Table.Tr key={index}>
                          <Table.Td><Text fw={500}>{ozet.ay}</Text></Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}>
                            <Text c="green">{formatMoney(ozet.alacak || 0)}</Text>
                          </Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}>
                            <Text c="red">{formatMoney(ozet.borc || 0)}</Text>
                          </Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}>
                            <Text c={net >= 0 ? 'green' : 'red'} fw={600}>
                              {formatMoney(net)}
                            </Text>
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              </Card>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="vade" pt="md">
            <Stack gap="md">
              {vadesiGecmis.length > 0 && (
                <Card withBorder bg="red.0">
                  <Group>
                    <ThemeIcon color="red" variant="light">
                      <IconAlertCircle />
                    </ThemeIcon>
                    <div>
                      <Text fw={500}>Vadesi Geçmiş</Text>
                      <Text size="sm" c="dimmed">
                        {vadesiGecmis.length} adet, Toplam: {formatMoney(vadesiGecmis.reduce((sum, h) => sum + h.borc, 0))}
                      </Text>
                    </div>
                  </Group>
                </Card>
              )}
              
              {vadesiYaklasan.length > 0 && (
                <Card withBorder bg="yellow.0">
                  <Group>
                    <ThemeIcon color="yellow" variant="light">
                      <IconCalendar />
                    </ThemeIcon>
                    <div>
                      <Text fw={500}>Vadesi Yaklaşan (7 gün)</Text>
                      <Text size="sm" c="dimmed">
                        {vadesiYaklasan.length} adet, Toplam: {formatMoney(vadesiYaklasan.reduce((sum, h) => sum + h.borc, 0))}
                      </Text>
                    </div>
                  </Group>
                </Card>
              )}

              <Table.ScrollContainer minWidth={500}>
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Belge No</Table.Th>
                      <Table.Th>Vade Tarihi</Table.Th>
                      <Table.Th>Kalan Gün</Table.Th>
                      <Table.Th>Tutar</Table.Th>
                      <Table.Th>Durum</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {hareketler
                      .filter(h => h.vade_tarihi && h.borc > 0)
                      .map((hareket) => {
                        const vadeDate = new Date(hareket.vade_tarihi!);
                        const today = new Date();
                        const gunFarki = Math.floor((vadeDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                        
                        return (
                          <Table.Tr key={hareket.id}>
                            <Table.Td>{hareket.belge_no}</Table.Td>
                            <Table.Td>{formatDate(hareket.vade_tarihi!)}</Table.Td>
                            <Table.Td>
                              <Badge color={gunFarki < 0 ? 'red' : gunFarki <= 7 ? 'yellow' : 'green'}>
                                {gunFarki < 0 ? `${Math.abs(gunFarki)} gün geçti` : `${gunFarki} gün kaldı`}
                              </Badge>
                            </Table.Td>
                            <Table.Td>
                              <Text c="red" fw={500}>{formatMoney(hareket.borc)}</Text>
                            </Table.Td>
                            <Table.Td>
                              <Badge 
                                color={gunFarki < 0 ? 'red' : gunFarki <= 7 ? 'yellow' : 'green'}
                                variant="filled"
                              >
                                {gunFarki < 0 ? 'Gecikmiş' : gunFarki <= 7 ? 'Yaklaşıyor' : 'Vadeli'}
                              </Badge>
                            </Table.Td>
                          </Table.Tr>
                        );
                      })}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </Modal>

      {/* Fatura Görüntüleme Modal */}
      <Modal 
        opened={faturaModalOpened} 
        onClose={() => setFaturaModalOpened(false)}
        size="90%"
        title={<Text fw={600}>📄 {selectedBelgeNo}</Text>}
        styles={{ body: { padding: 0 } }}
      >
        {faturaLoading ? (
          <Stack align="center" py={100}>
            <Loader size="xl" color="violet" />
            <Text c="dimmed">Fatura yükleniyor...</Text>
          </Stack>
        ) : faturaHtml ? (
          <iframe
            srcDoc={faturaHtml}
            style={{ width: '100%', height: '80vh', border: 'none', background: 'white' }}
            title="E-Fatura"
          />
        ) : (
          <Stack align="center" py={100}>
            <ThemeIcon color="gray" size={60} variant="light" radius="xl">
              <IconFileInvoice size={30} />
            </ThemeIcon>
            <Text c="dimmed">Bu belge için Uyumsoft faturası bulunamadı</Text>
          </Stack>
        )}
      </Modal>
    </>
  );
}
