'use client';

import { useState, useEffect } from 'react';
import {
  Container,
  Title,
  Text,
  Card,
  Button,
  Stack,
  Group,
  Badge,
  Box,
  SimpleGrid,
  ThemeIcon,
  Paper,
  Menu,
  ActionIcon,
  Modal,
  Select,
  Divider,
  Alert,
  Tooltip,
  TextInput,
  Tabs,
  ScrollArea,
  Table,
  Loader
} from '@mantine/core';
import {
  IconBookmark,
  IconCalendar,
  IconCoin,
  IconBuilding,
  IconDotsVertical,
  IconTrash,
  IconEye,
  IconNote,
  IconClock,
  IconCheck,
  IconX,
  IconAlertCircle,
  IconSearch,
  IconFilter,
  IconFileAnalytics,
  IconChevronRight,
  IconDownload,
  IconSettings,
  IconClipboardList,
  IconReceipt,
  IconScale,
} from '@tabler/icons-react';
import Link from 'next/link';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import TeklifModal from '@/components/teklif/TeklifModal';
import IhaleUzmaniModal from '@/components/IhaleUzmaniModal';
import { API_BASE_URL } from '@/lib/config';

interface AnalysisData {
  ihale_basligi?: string;
  kurum?: string;
  tarih?: string;
  bedel?: string;
  sure?: string;
  teknik_sartlar?: string[];
  birim_fiyatlar?: any[];
  notlar?: string[];
  tam_metin?: string;
  iletisim?: any;
}

interface UserNote {
  id: string;
  text: string;
  created_at: string;
}

interface SavedTender {
  id: string;
  tender_id: number;
  ihale_basligi: string;
  kurum: string;
  tarih: string;
  bedel: string;
  sure: string;
  city?: string;
  external_id?: string;
  url?: string;
  status: 'bekliyor' | 'basvuruldu' | 'kazanildi' | 'kaybedildi' | 'iptal';
  notes: string;
  notlar?: string;
  user_notes?: UserNote[];
  created_at: string;
  dokuman_sayisi: number;
  analiz_edilen_dokuman?: number;
  teknik_sart_sayisi: number;
  birim_fiyat_sayisi: number;
  analiz_data?: AnalysisData;
  analysis_summary?: AnalysisData;
  // Hesaplama alanları
  yaklasik_maliyet?: number;
  sinir_deger?: number;
  bizim_teklif?: number;
  hesaplama_verileri?: any;
}

const statusConfig = {
  bekliyor: { color: 'yellow', label: 'Bekliyor', icon: IconClock },
  basvuruldu: { color: 'blue', label: 'Başvuruldu', icon: IconFileAnalytics },
  kazanildi: { color: 'green', label: 'Kazanıldı', icon: IconCheck },
  kaybedildi: { color: 'red', label: 'Kaybedildi', icon: IconX },
  iptal: { color: 'gray', label: 'İptal Edildi', icon: IconX },
};

export default function TrackingPage() {
  const [tenders, setTenders] = useState<SavedTender[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTender, setSelectedTender] = useState<SavedTender | null>(null);
  const [detailOpened, { open: openDetail, close: closeDetail }] = useDisclosure(false);
  const [teklifOpened, { open: openTeklif, close: closeTeklif }] = useDisclosure(false);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [userNote, setUserNote] = useState('');
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [liveAnalysisData, setLiveAnalysisData] = useState<AnalysisData | null>(null);
  const [analysisStats, setAnalysisStats] = useState<{toplam_dokuman: number; analiz_edilen: number; basarisiz: number; bekleyen: number} | null>(null);
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);

  // Veritabanından verileri yükle
  const fetchTenders = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/tender-tracking`);
      const result = await response.json();
      
      if (result.success) {
        // API verisini frontend formatına dönüştür
        const formattedTenders: SavedTender[] = result.data.map((t: any) => ({
          id: t.id.toString(),
          tender_id: t.tender_id,
          ihale_basligi: t.ihale_basligi || '',
          kurum: t.kurum || '',
          tarih: t.tarih ? new Date(t.tarih).toLocaleDateString('tr-TR') : '',
          bedel: t.bedel ? `${Number(t.bedel).toLocaleString('tr-TR')} ₺` : '',
          sure: '',
          city: t.city,
          external_id: t.external_id,
          url: t.url,
          status: t.status || 'bekliyor',
          notes: t.notes || '',
          notlar: t.notes || '',
          user_notes: t.user_notes || [],
          created_at: t.created_at,
          dokuman_sayisi: t.dokuman_sayisi || 0,
          analiz_edilen_dokuman: t.analiz_edilen_dokuman || 0,
          teknik_sart_sayisi: t.analysis_summary?.teknik_sartlar?.length || 0,
          birim_fiyat_sayisi: t.analysis_summary?.birim_fiyatlar?.length || 0,
          analiz_data: t.analysis_summary,
          analysis_summary: t.analysis_summary,
          // Hesaplama alanları
          yaklasik_maliyet: t.yaklasik_maliyet ? parseFloat(t.yaklasik_maliyet) : undefined,
          sinir_deger: t.sinir_deger ? parseFloat(t.sinir_deger) : undefined,
          bizim_teklif: t.bizim_teklif ? parseFloat(t.bizim_teklif) : undefined,
          hesaplama_verileri: t.hesaplama_verileri || {}
        }));
        setTenders(formattedTenders);
      }
    } catch (error) {
      console.error('Takip listesi yükleme hatası:', error);
      notifications.show({
        title: '❌ Hata',
        message: 'Takip listesi yüklenemedi',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenders();
  }, []);

  // Durum güncelle
  const updateStatus = async (id: string, newStatus: SavedTender['status']) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/tender-tracking/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      
      if (!response.ok) throw new Error('Güncelleme hatası');
      
      const updated = tenders.map(t => 
        t.id === id ? { ...t, status: newStatus } : t
      );
      setTenders(updated);
      
      if (selectedTender?.id === id) {
        setSelectedTender({ ...selectedTender, status: newStatus });
      }
      
      notifications.show({
        title: 'Durum Güncellendi',
        message: `İhale durumu "${statusConfig[newStatus].label}" olarak değiştirildi`,
        color: statusConfig[newStatus].color,
      });
    } catch (error) {
      notifications.show({
        title: '❌ Hata',
        message: 'Durum güncellenemedi',
        color: 'red'
      });
    }
  };

  // Not güncelle
  const updateNote = async (id: string, note: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/tender-tracking/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: note })
      });
      
      if (!response.ok) throw new Error('Güncelleme hatası');
      
      const updated = tenders.map(t => 
        t.id === id ? { ...t, notlar: note, notes: note } : t
      );
      setTenders(updated);
      
      if (selectedTender?.id === id) {
        setSelectedTender({ ...selectedTender, notlar: note, notes: note });
      }
      
      notifications.show({
        title: 'Not Kaydedildi',
        message: 'İhale notu güncellendi',
        color: 'green',
      });
    } catch (error) {
      notifications.show({
        title: '❌ Hata',
        message: 'Not kaydedilemedi',
        color: 'red'
      });
    }
  };

  // Not ekle
  const addUserNote = async (id: string, text: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/tender-tracking/${id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      
      if (!response.ok) throw new Error('Not ekleme hatası');
      
      const result = await response.json();
      const newNote = result.note;
      
      const updated = tenders.map(t => 
        t.id === id ? { ...t, user_notes: [...(t.user_notes || []), newNote] } : t
      );
      setTenders(updated);
      
      if (selectedTender?.id === id) {
        setSelectedTender({ ...selectedTender, user_notes: [...(selectedTender.user_notes || []), newNote] });
      }
      
      setUserNote(''); // Input'u temizle
      
      notifications.show({
        title: '✅ Not Eklendi',
        message: 'Notunuz kaydedildi',
        color: 'green',
      });
    } catch (error) {
      notifications.show({
        title: '❌ Hata',
        message: 'Not eklenemedi',
        color: 'red'
      });
    }
  };

  // Not sil
  const deleteUserNote = async (trackingId: string, noteId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/tender-tracking/${trackingId}/notes/${noteId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) throw new Error('Not silme hatası');
      
      const updated = tenders.map(t => 
        t.id === trackingId 
          ? { ...t, user_notes: (t.user_notes || []).filter(n => n.id !== noteId) } 
          : t
      );
      setTenders(updated);
      
      if (selectedTender?.id === trackingId) {
        setSelectedTender({ 
          ...selectedTender, 
          user_notes: (selectedTender.user_notes || []).filter(n => n.id !== noteId) 
        });
      }
      
      notifications.show({
        title: 'Not Silindi',
        message: 'Notunuz kaldırıldı',
        color: 'orange',
      });
    } catch (error) {
      notifications.show({
        title: '❌ Hata',
        message: 'Not silinemedi',
        color: 'red'
      });
    }
  };

  // İhale sil
  const deleteTender = async (id: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/tender-tracking/${id}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) throw new Error('Silme hatası');
      
      const updated = tenders.filter(t => t.id !== id);
      setTenders(updated);
      closeDetail();
      
      notifications.show({
        title: 'İhale Silindi',
        message: 'İhale takip listesinden kaldırıldı',
        color: 'red',
      });
    } catch (error) {
      notifications.show({
        title: '❌ Hata',
        message: 'İhale silinemedi',
        color: 'red'
      });
    }
  };

  // JSON indir
  const downloadJSON = (tender: SavedTender) => {
    const exportData = {
      ihale_bilgileri: {
        baslik: tender.ihale_basligi,
        kurum: tender.kurum,
        tarih: tender.tarih,
        bedel: tender.bedel,
        sure: tender.sure,
        durum: statusConfig[tender.status].label
      },
      analiz_data: tender.analiz_data,
      kullanici_notu: tender.notlar,
      kayit_tarihi: tender.created_at
    };
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ihale-${tender.id}.json`;
    link.click();
  };

  // Detay modalı açıldığında notu ve güncel analiz verilerini yükle
  const handleOpenDetail = async (tender: SavedTender) => {
    setSelectedTender(tender);
    setUserNote(''); // Yeni not için boş başla
    setLiveAnalysisData(null);
    setAnalysisStats(null);
    setNotesExpanded(false); // Notlar kapalı başlasın
    openDetail();
    
    // AI Context'i güncelle - FloatingAIChat'e bildir
    if (typeof window !== 'undefined') {
      const contextEvent = new CustomEvent('ai-context-update', {
        detail: {
          type: 'tender',
          id: tender.tender_id,
          title: tender.ihale_basligi,
          data: {
            title: tender.ihale_basligi,
            organization: tender.kurum,
            city: tender.city,
            deadline: tender.tarih,
            estimated_cost: tender.bedel,
            external_id: tender.external_id
          }
        }
      });
      window.dispatchEvent(contextEvent);
    }
    
    // Güncel analiz verilerini API'den çek
    try {
      setAnalysisLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/tender-tracking/${tender.tender_id}/analysis`);
      const result = await response.json();
      
      if (result.success && result.data) {
        setLiveAnalysisData(result.data.analysis);
        setAnalysisStats(result.data.stats);
      }
    } catch (error) {
      console.error('Analiz verisi çekme hatası:', error);
    } finally {
      setAnalysisLoading(false);
    }
  };

  // Filtreleme
  const filteredTenders = tenders.filter(t => {
    const matchesStatus = !filterStatus || t.status === filterStatus;
    const matchesSearch = !searchQuery || 
      t.ihale_basligi?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.kurum?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.external_id?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // İstatistikler
  const stats = {
    toplam: tenders.length,
    bekliyor: tenders.filter(t => t.status === 'bekliyor').length,
    basvuruldu: tenders.filter(t => t.status === 'basvuruldu').length,
    kazanildi: tenders.filter(t => t.status === 'kazanildi').length,
  };

  // Kalan gün hesapla
  const getDaysRemaining = (dateStr: string) => {
    if (!dateStr) return null;
    try {
      const parts = dateStr.match(/(\d{1,2})[./](\d{1,2})[./](\d{4})/);
      if (!parts) return null;
      const date = new Date(parseInt(parts[3]), parseInt(parts[2]) - 1, parseInt(parts[1]));
      const today = new Date();
      const diff = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return diff;
    } catch {
      return null;
    }
  };

  // Analiz verilerini al - önce canlı veriyi kontrol et
  const getAnalysisData = (tender: SavedTender): AnalysisData => {
    // Önce API'den çekilen güncel veriyi kullan
    if (liveAnalysisData) {
      return liveAnalysisData;
    }
    // Sonra tender'daki analiz verisini kontrol et
    if (tender.analiz_data) {
      return tender.analiz_data;
    }
    if (tender.analysis_summary) {
      return tender.analysis_summary;
    }
    // Fallback: temel bilgiler
    return {
      ihale_basligi: tender.ihale_basligi,
      kurum: tender.kurum,
      tarih: tender.tarih,
      bedel: tender.bedel,
      sure: tender.sure,
      teknik_sartlar: [],
      birim_fiyatlar: [],
      notlar: [],
      tam_metin: ''
    };
  };

  if (loading) {
    return (
      <Container size="xl" py="xl">
        <Text>Yükleniyor...</Text>
      </Container>
    );
  }

  return (
    <Box style={{ background: 'linear-gradient(180deg, rgba(59,130,246,0.05) 0%, rgba(255,255,255,0) 100%)', minHeight: '100vh' }}>
      <Container size="xl" py="xl">
        <Stack gap="xl">
          {/* Header */}
          <Group justify="space-between" align="flex-start">
            <div>
              <Group gap="sm" mb="xs">
                <ThemeIcon size={44} radius="md" variant="gradient" gradient={{ from: 'blue', to: 'cyan' }}>
                  <IconBookmark size={26} />
                </ThemeIcon>
                <div>
                  <Title order={1}>İhale Takibim</Title>
                  <Text c="dimmed">Kaydettiğiniz ihaleleri takip edin</Text>
                </div>
              </Group>
            </div>
            <Text size="sm" c="dimmed">
              İhale kartına tıklayarak <Text component="span" fw={600} c="violet">İhale Uzmanı</Text> araçlarına erişin
            </Text>
          </Group>

          {/* İstatistik Kartları */}
          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
            <Paper p="md" radius="md" withBorder>
              <Group justify="space-between">
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Toplam</Text>
                  <Text size="xl" fw={700}>{stats.toplam}</Text>
                </div>
                <ThemeIcon size={40} radius="md" variant="light" color="gray">
                  <IconBookmark size={22} />
                </ThemeIcon>
              </Group>
            </Paper>
            <Paper p="md" radius="md" withBorder style={{ borderColor: 'var(--mantine-color-yellow-5)' }}>
              <Group justify="space-between">
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Bekliyor</Text>
                  <Text size="xl" fw={700} c="yellow">{stats.bekliyor}</Text>
                </div>
                <ThemeIcon size={40} radius="md" variant="light" color="yellow">
                  <IconClock size={22} />
                </ThemeIcon>
              </Group>
            </Paper>
            <Paper p="md" radius="md" withBorder style={{ borderColor: 'var(--mantine-color-blue-5)' }}>
              <Group justify="space-between">
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Başvuruldu</Text>
                  <Text size="xl" fw={700} c="blue">{stats.basvuruldu}</Text>
                </div>
                <ThemeIcon size={40} radius="md" variant="light" color="blue">
                  <IconFileAnalytics size={22} />
                </ThemeIcon>
              </Group>
            </Paper>
            <Paper p="md" radius="md" withBorder style={{ borderColor: 'var(--mantine-color-green-5)' }}>
              <Group justify="space-between">
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Kazanıldı</Text>
                  <Text size="xl" fw={700} c="green">{stats.kazanildi}</Text>
                </div>
                <ThemeIcon size={40} radius="md" variant="light" color="green">
                  <IconCheck size={22} />
                </ThemeIcon>
              </Group>
            </Paper>
          </SimpleGrid>

          {/* Filtreler */}
          <Paper p="md" radius="md" withBorder>
            <Group>
              <TextInput
                placeholder="İhale ara..."
                leftSection={<IconSearch size={16} />}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ flex: 1 }}
              />
              <Select
                placeholder="Durum filtrele"
                leftSection={<IconFilter size={16} />}
                clearable
                value={filterStatus}
                onChange={setFilterStatus}
                data={[
                  { value: 'bekliyor', label: '🟡 Bekliyor' },
                  { value: 'basvuruldu', label: '🔵 Başvuruldu' },
                  { value: 'kazanildi', label: '🟢 Kazanıldı' },
                  { value: 'kaybedildi', label: '🔴 Kaybedildi' },
                  { value: 'iptal', label: '⚫ İptal' },
                ]}
                w={180}
              />
            </Group>
          </Paper>

          {/* İhale Kartları */}
          {filteredTenders.length === 0 ? (
            <Alert icon={<IconAlertCircle size={16} />} title="Henüz ihale yok" color="gray">
              {tenders.length === 0 
                ? 'Henüz kaydettiğiniz bir ihale bulunmuyor. Yükle & Analiz sayfasından döküman yükleyip "Kaydet" butonuna tıklayarak ihale ekleyebilirsiniz.'
                : 'Filtrelere uygun ihale bulunamadı.'}
            </Alert>
          ) : (
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
              {filteredTenders.map((tender) => {
                const daysRemaining = getDaysRemaining(tender.tarih);
                const isUrgent = daysRemaining !== null && daysRemaining <= 7 && daysRemaining >= 0;
                const isPast = daysRemaining !== null && daysRemaining < 0;
                const StatusIcon = statusConfig[tender.status].icon;

                return (
                  <Card 
                    key={tender.id} 
                    shadow="sm" 
                    padding="lg" 
                    radius="md" 
                    withBorder
                    style={{
                      borderColor: isUrgent ? 'var(--mantine-color-red-5)' : undefined,
                      borderWidth: isUrgent ? 2 : 1,
                    }}
                  >
                    {/* Üst Kısım - Durum ve Menü */}
                    <Group justify="space-between" mb="md">
                      <Badge 
                        color={statusConfig[tender.status].color} 
                        variant="light"
                        leftSection={<StatusIcon size={12} />}
                      >
                        {statusConfig[tender.status].label}
                      </Badge>
                      <Menu shadow="md" width={180}>
                        <Menu.Target>
                          <ActionIcon variant="subtle" color="gray">
                            <IconDotsVertical size={18} />
                          </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                          <Menu.Label>Durum Değiştir</Menu.Label>
                          <Menu.Item 
                            leftSection={<IconClock size={14} />}
                            onClick={() => updateStatus(tender.id, 'bekliyor')}
                          >
                            Bekliyor
                          </Menu.Item>
                          <Menu.Item 
                            leftSection={<IconFileAnalytics size={14} />}
                            onClick={() => updateStatus(tender.id, 'basvuruldu')}
                          >
                            Başvuruldu
                          </Menu.Item>
                          <Menu.Item 
                            leftSection={<IconCheck size={14} />}
                            color="green"
                            onClick={() => updateStatus(tender.id, 'kazanildi')}
                          >
                            Kazanıldı
                          </Menu.Item>
                          <Menu.Item 
                            leftSection={<IconX size={14} />}
                            color="red"
                            onClick={() => updateStatus(tender.id, 'kaybedildi')}
                          >
                            Kaybedildi
                          </Menu.Item>
                          <Menu.Divider />
                          <Menu.Item 
                            leftSection={<IconEye size={14} />}
                            onClick={() => handleOpenDetail(tender)}
                          >
                            Detayları Gör
                          </Menu.Item>
                          <Menu.Divider />
                          <Menu.Item 
                            leftSection={<IconTrash size={14} />}
                            color="red"
                            onClick={() => deleteTender(tender.id)}
                          >
                            Sil
                          </Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                    </Group>

                    {/* Başlık */}
                    <Text fw={600} size="lg" lineClamp={2} mb="sm">
                      {tender.ihale_basligi || 'İsimsiz İhale'}
                    </Text>

                    {/* Kurum */}
                    {tender.kurum && (
                      <Group gap="xs" mb="xs">
                        <IconBuilding size={16} color="var(--mantine-color-gray-6)" />
                        <Text size="sm" c="dimmed" lineClamp={1}>{tender.kurum}</Text>
                      </Group>
                    )}

                    {/* Tarih */}
                    {tender.tarih && (
                      <Group gap="xs" mb="xs">
                        <IconCalendar size={16} color="var(--mantine-color-gray-6)" />
                        <Text size="sm" c="dimmed">{tender.tarih}</Text>
                        {daysRemaining !== null && (
                          <Badge 
                            size="sm" 
                            color={isPast ? 'gray' : isUrgent ? 'red' : 'blue'}
                            variant="light"
                          >
                            {isPast 
                              ? 'Geçmiş' 
                              : daysRemaining === 0 
                                ? 'Bugün!' 
                                : `${daysRemaining} gün`}
                          </Badge>
                        )}
                      </Group>
                    )}

                    {/* Bedel */}
                    {tender.bedel && (
                      <Group gap="xs" mb="md">
                        <IconCoin size={16} color="var(--mantine-color-green-6)" />
                        <Text size="sm" fw={600} c="green">{tender.bedel}</Text>
                      </Group>
                    )}

                    <Divider my="sm" />

                    {/* Alt Bilgiler */}
                    <Group justify="space-between">
                      <Group gap="xs">
                        {tender.teknik_sart_sayisi > 0 && (
                          <Tooltip label="Teknik Şart">
                            <Badge size="sm" variant="dot" color="blue">
                              {tender.teknik_sart_sayisi} şart
                            </Badge>
                          </Tooltip>
                        )}
                        {tender.birim_fiyat_sayisi > 0 && (
                          <Tooltip label="Birim Fiyat">
                            <Badge size="sm" variant="dot" color="green">
                              {tender.birim_fiyat_sayisi} kalem
                            </Badge>
                          </Tooltip>
                        )}
                        {/* Not sayısı badge - Tıklanabilir */}
                        {tender.user_notes && tender.user_notes.length > 0 && (
                          <Tooltip label="Notları göster">
                            <Badge 
                              size="sm" 
                              variant="light" 
                              color="yellow"
                              leftSection={<IconNote size={10} />}
                              style={{ cursor: 'pointer' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenDetail(tender);
                                setTimeout(() => setNotesExpanded(true), 100);
                              }}
                            >
                              {tender.user_notes.length}
                            </Badge>
                          </Tooltip>
                        )}
                        {/* Not ekle ikonu - Not yoksa */}
                        {(!tender.user_notes || tender.user_notes.length === 0) && (
                          <Tooltip label="Not ekle">
                            <ActionIcon 
                              size="sm" 
                              variant="subtle" 
                              color="gray"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenDetail(tender);
                                setTimeout(() => setNotesExpanded(true), 100);
                              }}
                            >
                              <IconNote size={14} />
                            </ActionIcon>
                          </Tooltip>
                        )}
                      </Group>
                      <Button 
                        variant="light" 
                        size="xs"
                        rightSection={<IconChevronRight size={14} />}
                        onClick={() => handleOpenDetail(tender)}
                      >
                        Detay
                      </Button>
                    </Group>
                  </Card>
                );
              })}
            </SimpleGrid>
          )}
        </Stack>
      </Container>

      {/* İhale Uzmanı Modal */}
      <IhaleUzmaniModal
        opened={detailOpened}
        onClose={() => {
          closeDetail();
          setLiveAnalysisData(null);
          setAnalysisStats(null);
          // AI Context'i sıfırla
          if (typeof window !== 'undefined') {
            const contextEvent = new CustomEvent('ai-context-update', {
              detail: { type: 'general' }
            });
            window.dispatchEvent(contextEvent);
          }
        }}
        tender={selectedTender}
        onUpdateStatus={updateStatus}
        onDelete={deleteTender}
        onAddNote={addUserNote}
        onDeleteNote={deleteUserNote}
      />

      {/* Teklif Modal */}
      {selectedTender && (
        <TeklifModal
          opened={teklifOpened}
          onClose={closeTeklif}
          ihaleBasligi={selectedTender.ihale_basligi || 'İsimsiz İhale'}
          ihaleBedeli={selectedTender.bedel ? Number(selectedTender.bedel) : undefined}
          birimFiyatlar={selectedTender.analiz_data?.birim_fiyatlar}
        />
      )}
    </Box>
  );
}
