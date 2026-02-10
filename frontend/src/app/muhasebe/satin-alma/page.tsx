'use client';

import {
  ActionIcon,
  Alert,
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  Container,
  Divider,
  Group,
  Loader,
  Menu,
  Modal,
  NumberInput,
  Paper,
  rem,
  Select,
  SimpleGrid,
  Stack,
  Stepper,
  Table,
  Tabs,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Title,
  useMantineColorScheme,
} from '@mantine/core';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconAlertCircle,
  IconBuilding,
  IconCheck,
  IconClipboardList,
  IconClock,
  IconCurrencyLira,
  IconDotsVertical,
  IconEye,
  IconPackage,
  IconPlus,
  IconReceipt,
  IconRefresh,
  IconSearch,
  IconTrash,
  IconTruck,
  IconX,
} from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import RaporMerkeziModal from '@/components/rapor-merkezi/RaporMerkeziModal';
import StyledDatePicker from '@/components/ui/StyledDatePicker';
import { useRealtimeRefetch } from '@/context/RealtimeContext';
import { formatDate } from '@/lib/formatters';
import 'dayjs/locale/tr';
import { muhasebeAPI } from '@/lib/api/services/muhasebe';
import {
  type Proje,
  projelerAPI,
  type Siparis,
  type SiparisKalem,
  type SiparisOzet,
  siparislerAPI,
} from '@/lib/satin-alma-api';

interface Tedarikci {
  id: number;
  unvan: string;
  vkn: string;
}

const birimler = ['Kg', 'Adet', 'Lt', 'Paket', 'Koli', 'Kutu', 'Porsiyon', 'Gram'];

export default function SatinAlmaPage() {
  const router = useRouter();
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [opened, { open, close }] = useDisclosure(false);
  const [detailOpened, { open: openDetail, close: closeDetail }] = useDisclosure(false);
  const [projeModalOpened, { open: openProjeModal, close: closeProjeModal }] = useDisclosure(false);
  const [formModalOpened, { open: openFormModal, close: closeFormModal }] = useDisclosure(false);
  const [raporMerkeziOpen, setRaporMerkeziOpen] = useState(false);
  const [formSiparis, setFormSiparis] = useState<Siparis | null>(null);

  const [activeTab, setActiveTab] = useState<string | null>('tumu');
  const [searchTerm, setSearchTerm] = useState('');

  // Data states
  const [siparisler, setSiparisler] = useState<Siparis[]>([]);
  const [projeler, setProjeler] = useState<Proje[]>([]);
  const [tedarikciler, setTedarikciler] = useState<Tedarikci[]>([]);
  const [ozet, setOzet] = useState<SiparisOzet | null>(null);
  const [selectedSiparis, setSelectedSiparis] = useState<Siparis | null>(null);

  // Loading states
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    baslik: '',
    proje_id: null as number | null,
    tedarikci_id: null as number | null,
    siparis_tarihi: new Date(),
    teslim_tarihi: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    oncelik: 'normal' as Siparis['oncelik'],
    notlar: '',
  });

  const [kalemler, setKalemler] = useState<SiparisKalem[]>([
    { urun_adi: '', miktar: 1, birim: 'Adet', tahmini_fiyat: 0 },
  ]);

  // Yeni proje formu
  const [newProje, setNewProje] = useState({
    kod: '',
    ad: '',
    adres: '',
    yetkili: '',
    telefon: '',
    renk: '#6366f1',
  });

  // Verileri yükle
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [siparisResult, projeResult, ozetResult, tedarikciResult] = await Promise.all([
        siparislerAPI.list(),
        projelerAPI.list(),
        siparislerAPI.getOzet(),
        muhasebeAPI.getCariler({ tip: 'tedarikci' }),
      ]);

      if (siparisResult.success && Array.isArray(siparisResult.data))
        setSiparisler(siparisResult.data);
      if (projeResult.success && Array.isArray(projeResult.data)) setProjeler(projeResult.data);
      if (ozetResult.success) setOzet(ozetResult.data);
      if (tedarikciResult.success && Array.isArray(tedarikciResult.data))
        setTedarikciler(
          tedarikciResult.data.map((c) => ({ id: c.id, unvan: c.unvan, vkn: c.vergi_no ?? '' })),
        );
    } catch (error) {
      console.error('Veri yükleme hatası:', error);
      notifications.show({ title: 'Hata', message: 'Veriler yüklenemedi', color: 'red' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 🔴 REALTIME - Satın alma tablosunu dinle
  useRealtimeRefetch('satin_alma', loadData);

  // Para formatı
  const formatMoney = (value: number) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 0,
    }).format(value || 0);
  };

  // Filtreleme
  const filteredSiparisler = siparisler.filter((s) => {
    const matchesTab =
      activeTab === 'tumu' ||
      (activeTab === 'bekleyen' &&
        ['talep', 'onay_bekliyor', 'onaylandi', 'siparis_verildi'].includes(s.durum)) ||
      (activeTab && s.proje_id === parseInt(activeTab, 10)) ||
      s.durum === activeTab;
    const matchesSearch =
      s.baslik.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.siparis_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.tedarikci_unvan || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchesTab && matchesSearch;
  });

  // Kalem işlemleri
  const addKalem = () => {
    setKalemler([...kalemler, { urun_adi: '', miktar: 1, birim: 'Adet', tahmini_fiyat: 0 }]);
  };

  const removeKalem = (index: number) => {
    if (kalemler.length > 1) setKalemler(kalemler.filter((_, i) => i !== index));
  };

  const updateKalem = (index: number, field: string, value: string | number) => {
    setKalemler(kalemler.map((k, i) => (i === index ? { ...k, [field]: value } : k)));
  };

  // Toplam hesapla
  const toplamTutar = kalemler.reduce((acc, k) => acc + (k.tahmini_fiyat || 0), 0);

  // Form sıfırla
  const resetForm = () => {
    setFormData({
      baslik: '',
      proje_id: null,
      tedarikci_id: null,
      siparis_tarihi: new Date(),
      teslim_tarihi: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      oncelik: 'normal',
      notlar: '',
    });
    setKalemler([{ urun_adi: '', miktar: 1, birim: 'Adet', tahmini_fiyat: 0 }]);
  };

  // Sipariş kaydet
  const handleSubmit = async () => {
    if (!formData.baslik || kalemler.some((k) => !k.urun_adi)) {
      notifications.show({
        title: 'Hata!',
        message: 'Lütfen zorunlu alanları doldurun.',
        color: 'red',
      });
      return;
    }

    setSaving(true);
    try {
      const result = await siparislerAPI.create({
        proje_id: formData.proje_id,
        tedarikci_id: formData.tedarikci_id,
        baslik: formData.baslik,
        siparis_tarihi: formData.siparis_tarihi.toISOString().split('T')[0],
        teslim_tarihi: formData.teslim_tarihi.toISOString().split('T')[0],
        oncelik: formData.oncelik,
        notlar: formData.notlar,
        kalemler,
      });

      if (result.success) {
        notifications.show({
          title: 'Başarılı!',
          message: 'Sipariş oluşturuldu.',
          color: 'green',
          icon: <IconCheck size={16} />,
        });
        loadData();
        resetForm();
        close();
      } else {
        throw new Error('Kayıt başarısız');
      }
    } catch (_error) {
      notifications.show({ title: 'Hata!', message: 'Sipariş oluşturulamadı.', color: 'red' });
    } finally {
      setSaving(false);
    }
  };

  // Durum güncelle
  const updateDurum = async (id: number, durum: Siparis['durum']) => {
    try {
      const result = await siparislerAPI.updateDurum(id, durum);
      if (result.success) {
        setSiparisler(siparisler.map((s) => (s.id === id ? { ...s, durum } : s)));
        notifications.show({
          title: 'Güncellendi',
          message: 'Sipariş durumu değiştirildi.',
          color: 'blue',
        });
        loadData(); // Özet için
      } else {
        throw new Error('API hatası');
      }
    } catch (error) {
      console.error('Durum güncelleme hatası:', error);
      notifications.show({ title: 'Hata', message: 'Durum güncellenemedi', color: 'red' });
    }
  };

  // Öncelik güncelle
  const updateOncelik = async (id: number, oncelik: Siparis['oncelik']) => {
    try {
      const result = await siparislerAPI.update(id, { oncelik });
      if (result.success) {
        setSiparisler(siparisler.map((s) => (s.id === id ? { ...s, oncelik } : s)));
        notifications.show({
          title: 'Güncellendi',
          message: 'Öncelik değiştirildi.',
          color: 'blue',
        });
      } else {
        throw new Error('API hatası');
      }
    } catch (error) {
      console.error('Öncelik güncelleme hatası:', error);
      notifications.show({ title: 'Hata', message: 'Öncelik güncellenemedi', color: 'red' });
    }
  };

  // Silme
  const handleDelete = async (id: number) => {
    if (!confirm('Bu siparişi silmek istediğinize emin misiniz?')) return;

    try {
      const result = await siparislerAPI.delete(id);
      if (result.success) {
        setSiparisler(siparisler.filter((s) => s.id !== id));
        notifications.show({ title: 'Silindi', message: 'Sipariş silindi.', color: 'orange' });
        loadData();
      } else {
        throw new Error('Silme başarısız');
      }
    } catch (error) {
      console.error('Silme hatası:', error);
      notifications.show({ title: 'Hata', message: 'Sipariş silinemedi', color: 'red' });
    }
  };

  // Sipariş formu göster
  const handlePrintOrder = async (siparis: Siparis) => {
    try {
      const result = await siparislerAPI.get(siparis.id);
      if (!result.success) {
        notifications.show({ title: 'Hata', message: 'Sipariş detayı alınamadı', color: 'red' });
        return;
      }
      setFormSiparis(result.data);
      openFormModal();
    } catch (_error) {
      notifications.show({ title: 'Hata', message: 'Sipariş detayı alınamadı', color: 'red' });
    }
  };

  // Yazdır
  const handlePrint = () => {
    const printContent = document.querySelector('.print-content');
    if (!printContent || !formSiparis) return;

    const proje = projeler.find((p) => p.id === formSiparis.proje_id);

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Sipariş Formu - ${formSiparis.siparis_no}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 30px; max-width: 800px; margin: 0 auto; }
          .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 15px; margin-bottom: 20px; }
          .header h1 { margin: 0 0 5px 0; font-size: 24px; }
          .header .no { color: #2196F3; font-size: 18px; margin: 5px 0; }
          .info-grid { display: flex; gap: 20px; margin-bottom: 20px; }
          .info-box { flex: 1; border: 1px solid #ddd; padding: 12px; border-radius: 6px; }
          .info-box h3 { margin: 0 0 8px 0; font-size: 11px; color: #666; text-transform: uppercase; }
          .info-box p { margin: 4px 0; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
          th { background: #f5f5f5; font-size: 12px; }
          .total { text-align: right; font-size: 16px; font-weight: bold; margin-bottom: 20px; }
          .notes { background: #fffbeb; padding: 12px; border-radius: 6px; border-left: 3px solid #f59e0b; margin-bottom: 20px; }
          .signatures { display: flex; gap: 40px; margin-top: 40px; }
          .sig-box { flex: 1; text-align: center; padding-top: 50px; border-top: 1px solid #333; }
          .sig-label { font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>SİPARİŞ FORMU</h1>
          <div class="no">${formSiparis.siparis_no}</div>
          <div>Tarih: ${formatDate(formSiparis.siparis_tarihi)}</div>
        </div>
        
        <div class="info-grid">
          <div class="info-box">
            <h3>Tedarikçi</h3>
            <p><strong>${formSiparis.tedarikci_unvan || '-'}</strong></p>
            ${formSiparis.tedarikci_vkn ? `<p>VKN: ${formSiparis.tedarikci_vkn}</p>` : ''}
          </div>
          <div class="info-box">
            <h3>Teslimat</h3>
            <p><strong>${proje?.ad || formSiparis.proje_ad || '-'}</strong></p>
            <p>Teslim: ${formatDate(formSiparis.teslim_tarihi || '')}</p>
            ${proje?.adres ? `<p>${proje.adres}</p>` : ''}
          </div>
        </div>
        
        <table>
          <thead>
            <tr>
              <th style="width:30px">#</th>
              <th>Ürün</th>
              <th style="width:80px">Miktar</th>
              <th style="width:60px">Birim</th>
              <th style="width:100px;text-align:right">Tutar</th>
            </tr>
          </thead>
          <tbody>
            ${(formSiparis.kalemler || [])
              .map(
                (k, i) => `
              <tr>
                <td>${i + 1}</td>
                <td>${k.urun_adi}</td>
                <td>${k.miktar}</td>
                <td>${k.birim}</td>
                <td style="text-align:right">${formatMoney(k.tahmini_fiyat)}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
        
        <div class="total">Toplam: ${formatMoney(Number(formSiparis.toplam_tutar))}</div>
        
        ${formSiparis.notlar ? `<div class="notes"><strong>Not:</strong> ${formSiparis.notlar}</div>` : ''}
        
        <div class="signatures">
          <div class="sig-box"><span class="sig-label">Sipariş Veren</span></div>
          <div class="sig-box"><span class="sig-label">Tedarikçi Onayı</span></div>
        </div>
      </body>
      </html>
    `;

    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    iframe.contentDocument?.write(html);
    iframe.contentDocument?.close();
    iframe.contentWindow?.print();
    setTimeout(() => document.body.removeChild(iframe), 1000);
  };

  // Detay görüntüle
  const handleViewDetail = async (siparis: Siparis) => {
    try {
      const result = await siparislerAPI.get(siparis.id);
      if (result.success) {
        setSelectedSiparis(result.data);
        openDetail();
      }
    } catch (_error) {
      notifications.show({ title: 'Hata', message: 'Detay yüklenemedi', color: 'red' });
    }
  };

  // Proje sil
  const handleDeleteProje = async (id: number, ad: string) => {
    if (!confirm(`"${ad}" projesini silmek istediğinize emin misiniz?`)) return;

    try {
      const result = await projelerAPI.delete(id);
      if (result.success) {
        setProjeler(projeler.filter((p) => p.id !== id));
        if (activeTab === String(id)) setActiveTab('tumu');
        notifications.show({ title: 'Silindi', message: 'Proje silindi.', color: 'orange' });
      } else {
        throw new Error('Silme başarısız');
      }
    } catch (_error) {
      notifications.show({ title: 'Hata', message: 'Proje silinemedi', color: 'red' });
    }
  };

  // Yeni proje ekle
  const handleCreateProje = async () => {
    if (!newProje.kod || !newProje.ad) {
      notifications.show({ title: 'Hata', message: 'Kod ve ad zorunludur', color: 'red' });
      return;
    }

    try {
      const result = await projelerAPI.create(newProje);
      if (result.success) {
        setProjeler([...projeler, result.data]);
        setNewProje({ kod: '', ad: '', adres: '', yetkili: '', telefon: '', renk: '#6366f1' });
        closeProjeModal();
        notifications.show({ title: 'Başarılı', message: 'Proje oluşturuldu', color: 'green' });
      }
    } catch (_error) {
      notifications.show({ title: 'Hata', message: 'Proje oluşturulamadı', color: 'red' });
    }
  };

  // Durum badge
  const getDurumBadge = (durum: string) => {
    const config: Record<string, { color: string; label: string }> = {
      talep: { color: 'orange', label: 'Bekliyor' },
      siparis_verildi: { color: 'blue', label: 'Gönderildi' },
      teslim_alindi: { color: 'green', label: 'Teslim Alındı' },
      iptal: { color: 'red', label: 'İptal' },
    };
    const { color, label } = config[durum] || { color: 'gray', label: durum };
    return (
      <Badge color={color} variant="light">
        {label}
      </Badge>
    );
  };

  // Öncelik badge
  const getOncelikBadge = (oncelik: string) => {
    const config: Record<string, { color: string; label: string }> = {
      dusuk: { color: 'gray', label: 'Düşük' },
      normal: { color: 'blue', label: 'Normal' },
      yuksek: { color: 'orange', label: 'Yüksek' },
      acil: { color: 'red', label: 'ACİL' },
    };
    const { color, label } = config[oncelik] || config.normal;
    return (
      <Badge color={color} variant="filled" size="xs">
        {label}
      </Badge>
    );
  };

  // Stepper aktif adım
  const getStepperActive = (durum: string) => {
    const steps: Record<string, number> = {
      talep: 0,
      siparis_verildi: 1,
      teslim_alindi: 2,
      iptal: -1,
    };
    return steps[durum] ?? 0;
  };

  if (loading) {
    return (
      <Box
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '50vh',
        }}
      >
        <Loader size="xl" />
      </Box>
    );
  }

  return (
    <Box
      style={{
        background: isDark
          ? 'linear-gradient(180deg, rgba(51,154,240,0.05) 0%, rgba(0,0,0,0) 100%)'
          : 'linear-gradient(180deg, rgba(51,154,240,0.08) 0%, rgba(255,255,255,0) 100%)',
        minHeight: '100vh',
      }}
    >
      <Container size="xl" py="xl">
        <Stack gap="xl">
          {/* Header */}
          <Group justify="space-between" align="flex-end">
            <Box>
              <Title order={1} fw={700}>
                📦 Satın Alma
              </Title>
              <Text c="dimmed" size="lg">
                Sipariş ve tedarik süreçlerinizi yönetin
              </Text>
            </Box>
            <Group>
              <Button variant="light" color="indigo" leftSection={<IconClipboardList size={18} />} onClick={() => setRaporMerkeziOpen(true)}>
                Raporlar
              </Button>
              <Button variant="light" leftSection={<IconRefresh size={18} />} onClick={loadData}>
                Yenile
              </Button>
              <Button
                leftSection={<IconPlus size={18} />}
                variant="gradient"
                gradient={{ from: 'blue', to: 'cyan' }}
                onClick={() => {
                  resetForm();
                  open();
                }}
              >
                Yeni Sipariş
              </Button>
            </Group>
          </Group>

          {/* Stats Cards */}
          <SimpleGrid cols={{ base: 2, md: 4 }}>
            <Card withBorder shadow="sm" p="lg" radius="md">
              <Group justify="space-between">
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                  Toplam Sipariş
                </Text>
                <ThemeIcon color="blue" variant="light" size="lg" radius="md">
                  <IconClipboardList size={20} />
                </ThemeIcon>
              </Group>
              <Text fw={700} size="xl" mt="md">
                {ozet?.toplam_siparis || 0}
              </Text>
            </Card>
            <Card withBorder shadow="sm" p="lg" radius="md">
              <Group justify="space-between">
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                  Bekleyen
                </Text>
                <ThemeIcon color="yellow" variant="light" size="lg" radius="md">
                  <IconClock size={20} />
                </ThemeIcon>
              </Group>
              <Text fw={700} size="xl" mt="md" c="yellow">
                {ozet?.bekleyen || 0}
              </Text>
            </Card>
            <Card withBorder shadow="sm" p="lg" radius="md">
              <Group justify="space-between">
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                  Tamamlanan
                </Text>
                <ThemeIcon color="green" variant="light" size="lg" radius="md">
                  <IconCheck size={20} />
                </ThemeIcon>
              </Group>
              <Text fw={700} size="xl" mt="md" c="green">
                {ozet?.tamamlanan || 0}
              </Text>
            </Card>
            <Card withBorder shadow="sm" p="lg" radius="md">
              <Group justify="space-between">
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                  Beklenen Teslimat
                </Text>
                <ThemeIcon color="cyan" variant="light" size="lg" radius="md">
                  <IconTruck size={20} />
                </ThemeIcon>
              </Group>
              <Text fw={700} size="xl" mt="md" c="cyan">
                {formatMoney(ozet?.beklenen_tutar || 0)}
              </Text>
            </Card>
          </SimpleGrid>

          {/* Proje Kartları */}
          {projeler.length > 0 && (
            <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }}>
              {projeler.map((proje) => {
                const projeSiparisleri = siparisler.filter((s) => s.proje_id === proje.id);
                const bekleyen = projeSiparisleri.filter(
                  (s) => !['teslim_alindi', 'iptal'].includes(s.durum)
                ).length;
                return (
                  <Paper
                    key={proje.id}
                    withBorder
                    p="md"
                    radius="md"
                    style={{
                      borderLeft: `4px solid ${proje.renk}`,
                      cursor: 'pointer',
                      backgroundColor:
                        activeTab === String(proje.id) ? `${proje.renk}15` : undefined,
                      position: 'relative',
                    }}
                    onClick={() =>
                      setActiveTab(activeTab === String(proje.id) ? 'tumu' : String(proje.id))
                    }
                  >
                    <ActionIcon
                      size="xs"
                      variant="subtle"
                      color="red"
                      style={{ position: 'absolute', top: 4, right: 4, opacity: 0.5 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteProje(proje.id, proje.ad);
                      }}
                    >
                      <IconX size={12} />
                    </ActionIcon>
                    <Group gap="xs">
                      <Avatar size="sm" radius="xl" style={{ backgroundColor: proje.renk }}>
                        <IconBuilding size={14} color="white" />
                      </Avatar>
                      <div style={{ flex: 1 }}>
                        <Text size="sm" fw={600}>
                          {proje.ad}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {projeSiparisleri.length} sipariş
                        </Text>
                      </div>
                      {bekleyen > 0 && (
                        <Badge size="sm" color="orange" variant="filled">
                          {bekleyen}
                        </Badge>
                      )}
                    </Group>
                  </Paper>
                );
              })}
              <Paper
                withBorder
                p="md"
                radius="md"
                style={{ borderStyle: 'dashed', cursor: 'pointer' }}
                onClick={openProjeModal}
              >
                <Group gap="xs" justify="center" h="100%">
                  <IconPlus size={18} style={{ color: 'var(--mantine-color-dimmed)' }} />
                  <Text size="sm" c="dimmed">
                    Yeni Proje
                  </Text>
                </Group>
              </Paper>
            </SimpleGrid>
          )}

          {/* Table */}
          <Card withBorder shadow="sm" p="lg" radius="md">
            <Group justify="space-between" mb="md">
              <Tabs value={activeTab} onChange={setActiveTab}>
                <Tabs.List>
                  <Tabs.Tab value="tumu">Tümü ({siparisler.length})</Tabs.Tab>
                  <Tabs.Tab value="bekleyen" color="yellow">
                    Bekleyen ({ozet?.bekleyen || 0})
                  </Tabs.Tab>
                  <Tabs.Tab value="teslim_alindi" color="green">
                    Tamamlanan
                  </Tabs.Tab>
                </Tabs.List>
              </Tabs>
              <TextInput
                placeholder="Sipariş ara..."
                leftSection={<IconSearch size={16} />}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.currentTarget.value)}
                style={{ width: 250 }}
              />
            </Group>

            {filteredSiparisler.length === 0 ? (
              <Alert icon={<IconAlertCircle size={16} />} color="gray">
                {siparisler.length === 0
                  ? 'Henüz sipariş yok. Yeni sipariş oluşturmak için "Yeni Sipariş" butonuna tıklayın.'
                  : 'Arama kriterlerine uygun sipariş bulunamadı.'}
              </Alert>
            ) : (
              <Table.ScrollContainer minWidth={900}>
                <Table verticalSpacing="sm" highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Sipariş No</Table.Th>
                      <Table.Th>Proje</Table.Th>
                      <Table.Th>Başlık / Tedarikçi</Table.Th>
                      <Table.Th>Tarih</Table.Th>
                      <Table.Th>Öncelik</Table.Th>
                      <Table.Th>Durum</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>Tutar</Table.Th>
                      <Table.Th style={{ textAlign: 'center', width: 80 }}>İşlem</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {filteredSiparisler.map((siparis) => (
                      <Table.Tr key={siparis.id}>
                        <Table.Td>
                          <Text
                            size="sm"
                            fw={600}
                            c="blue"
                            style={{ cursor: 'pointer' }}
                            onClick={() => handleViewDetail(siparis)}
                          >
                            {siparis.siparis_no}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          {siparis.proje_ad ? (
                            <Badge
                              variant="light"
                              leftSection={
                                <div
                                  style={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: '50%',
                                    backgroundColor: siparis.proje_renk,
                                  }}
                                />
                              }
                            >
                              {siparis.proje_ad}
                            </Badge>
                          ) : (
                            <Text size="xs" c="dimmed">
                              -
                            </Text>
                          )}
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" fw={500}>
                            {siparis.baslik}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {siparis.tedarikci_unvan || 'Tedarikçi seçilmedi'}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" c="dimmed">
                            {formatDate(siparis.siparis_tarihi)}
                          </Text>
                          {siparis.teslim_tarihi && (
                            <Text size="xs" c="dimmed">
                              Teslim: {formatDate(siparis.teslim_tarihi)}
                            </Text>
                          )}
                        </Table.Td>
                        <Table.Td>
                          <Menu position="bottom" shadow="md">
                            <Menu.Target>
                              <Box style={{ cursor: 'pointer' }}>
                                {getOncelikBadge(siparis.oncelik)}
                              </Box>
                            </Menu.Target>
                            <Menu.Dropdown>
                              <Menu.Item
                                onClick={() => updateOncelik(siparis.id, 'dusuk')}
                                color={siparis.oncelik === 'dusuk' ? 'gray' : undefined}
                              >
                                {siparis.oncelik === 'dusuk' && '✓ '}Düşük
                              </Menu.Item>
                              <Menu.Item
                                onClick={() => updateOncelik(siparis.id, 'normal')}
                                color={siparis.oncelik === 'normal' ? 'blue' : undefined}
                              >
                                {siparis.oncelik === 'normal' && '✓ '}Normal
                              </Menu.Item>
                              <Menu.Item
                                onClick={() => updateOncelik(siparis.id, 'yuksek')}
                                color={siparis.oncelik === 'yuksek' ? 'orange' : undefined}
                              >
                                {siparis.oncelik === 'yuksek' && '✓ '}Yüksek
                              </Menu.Item>
                              <Menu.Item
                                onClick={() => updateOncelik(siparis.id, 'acil')}
                                color={siparis.oncelik === 'acil' ? 'red' : undefined}
                              >
                                {siparis.oncelik === 'acil' && '✓ '}ACİL
                              </Menu.Item>
                            </Menu.Dropdown>
                          </Menu>
                        </Table.Td>
                        <Table.Td>{getDurumBadge(siparis.durum)}</Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          <Text size="sm" fw={600}>
                            {formatMoney(siparis.toplam_tutar)}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {siparis.kalem_sayisi} kalem
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Menu position="bottom-end" shadow="md">
                            <Menu.Target>
                              <ActionIcon variant="subtle" color="gray">
                                <IconDotsVertical size={16} />
                              </ActionIcon>
                            </Menu.Target>
                            <Menu.Dropdown>
                              <Menu.Item
                                leftSection={
                                  <IconEye style={{ width: rem(14), height: rem(14) }} />
                                }
                                onClick={() => handleViewDetail(siparis)}
                              >
                                Detay
                              </Menu.Item>
                              <Menu.Item
                                leftSection={
                                  <IconClipboardList style={{ width: rem(14), height: rem(14) }} />
                                }
                                onClick={() => handlePrintOrder(siparis)}
                              >
                                Sipariş Formu
                              </Menu.Item>
                              <Menu.Divider />
                              <Menu.Label>Durum</Menu.Label>
                              <Menu.Item
                                leftSection={
                                  <IconTruck style={{ width: rem(14), height: rem(14) }} />
                                }
                                color="cyan"
                                onClick={() => updateDurum(siparis.id, 'siparis_verildi')}
                                disabled={siparis.durum === 'siparis_verildi'}
                              >
                                {siparis.durum === 'siparis_verildi' ? '✓ ' : ''}Sipariş Verildi
                              </Menu.Item>
                              <Menu.Item
                                leftSection={
                                  <IconPackage style={{ width: rem(14), height: rem(14) }} />
                                }
                                color="green"
                                onClick={() => updateDurum(siparis.id, 'teslim_alindi')}
                                disabled={siparis.durum === 'teslim_alindi'}
                              >
                                {siparis.durum === 'teslim_alindi' ? '✓ ' : ''}Teslim Alındı
                              </Menu.Item>
                              {siparis.durum === 'teslim_alindi' && siparis.tedarikci_id && (
                                <Menu.Item
                                  leftSection={
                                    <IconReceipt style={{ width: rem(14), height: rem(14) }} />
                                  }
                                  color="violet"
                                  onClick={() =>
                                    router.push(`/muhasebe/faturalar?cari=${siparis.tedarikci_id}`)
                                  }
                                >
                                  Faturayı Gör
                                </Menu.Item>
                              )}
                              <Menu.Divider />
                              <Menu.Item
                                color="red"
                                leftSection={
                                  <IconTrash style={{ width: rem(14), height: rem(14) }} />
                                }
                                onClick={() => handleDelete(siparis.id)}
                              >
                                Sil
                              </Menu.Item>
                            </Menu.Dropdown>
                          </Menu>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            )}
          </Card>
        </Stack>

        {/* Yeni Sipariş Modal */}
        <Modal
          opened={opened}
          onClose={() => {
            resetForm();
            close();
          }}
          title={
            <Text fw={700} size="lg">
              Yeni Sipariş
            </Text>
          }
          size="xl"
          fullScreen={isMobile}
        >
          <Stack gap="md">
            <TextInput
              label="Sipariş Başlığı"
              placeholder="Örn: Ocak Ayı Gıda Alımı"
              value={formData.baslik}
              onChange={(e) => setFormData({ ...formData, baslik: e.currentTarget.value })}
              required
            />

            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <Select
                label="Proje / Şube"
                placeholder="Seçin (opsiyonel)"
                data={projeler.map((p) => ({ value: String(p.id), label: p.ad }))}
                value={formData.proje_id ? String(formData.proje_id) : null}
                onChange={(v) => setFormData({ ...formData, proje_id: v ? parseInt(v, 10) : null })}
                searchable
                clearable
              />
              <Select
                label="Tedarikçi"
                placeholder="Seçin (opsiyonel)"
                data={tedarikciler.map((t) => ({ value: String(t.id), label: t.unvan }))}
                value={formData.tedarikci_id ? String(formData.tedarikci_id) : null}
                onChange={(v) =>
                  setFormData({ ...formData, tedarikci_id: v ? parseInt(v, 10) : null })
                }
                searchable
                clearable
              />
            </SimpleGrid>

            <SimpleGrid cols={3}>
              <StyledDatePicker
                label="Sipariş Tarihi"
                value={formData.siparis_tarihi}
                onChange={(v) => setFormData({ ...formData, siparis_tarihi: v || new Date() })}
              />
              <StyledDatePicker
                label="İstenen Teslim Tarihi"
                value={formData.teslim_tarihi}
                onChange={(v) => setFormData({ ...formData, teslim_tarihi: v || new Date() })}
              />
              <Select
                label="Öncelik"
                data={[
                  { label: 'Düşük', value: 'dusuk' },
                  { label: 'Normal', value: 'normal' },
                  { label: 'Yüksek', value: 'yuksek' },
                  { label: 'ACİL', value: 'acil' },
                ]}
                value={formData.oncelik}
                onChange={(v) =>
                  setFormData({ ...formData, oncelik: (v as Siparis['oncelik']) || 'normal' })
                }
              />
            </SimpleGrid>

            <Divider label="Ürünler" labelPosition="center" />

            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ width: '40%' }}>Ürün Adı</Table.Th>
                  <Table.Th>Miktar</Table.Th>
                  <Table.Th>Birim</Table.Th>
                  <Table.Th>Tahmini Tutar</Table.Th>
                  <Table.Th></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {kalemler.map((kalem, index) => (
                  <Table.Tr key={`kalem-${index}-${kalem.urun_adi}`}>
                    <Table.Td>
                      <TextInput
                        size="xs"
                        placeholder="Ürün adı"
                        value={kalem.urun_adi}
                        onChange={(e) => updateKalem(index, 'urun_adi', e.currentTarget.value)}
                      />
                    </Table.Td>
                    <Table.Td>
                      <NumberInput
                        size="xs"
                        value={kalem.miktar}
                        onChange={(v) => updateKalem(index, 'miktar', v)}
                        min={0.1}
                        decimalScale={2}
                        style={{ width: 90 }}
                      />
                    </Table.Td>
                    <Table.Td>
                      <Select
                        size="xs"
                        data={birimler}
                        value={kalem.birim}
                        onChange={(v) => updateKalem(index, 'birim', v ?? '')}
                        style={{ width: 100 }}
                      />
                    </Table.Td>
                    <Table.Td>
                      <NumberInput
                        size="xs"
                        value={kalem.tahmini_fiyat}
                        onChange={(v) => updateKalem(index, 'tahmini_fiyat', v || 0)}
                        min={0}
                        prefix="₺"
                        thousandSeparator="."
                        decimalSeparator=","
                        style={{ width: 130 }}
                      />
                    </Table.Td>
                    <Table.Td>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        size="sm"
                        onClick={() => removeKalem(index)}
                        disabled={kalemler.length === 1}
                      >
                        <IconTrash size={14} />
                      </ActionIcon>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>

            <Group justify="space-between">
              <Button
                variant="light"
                size="xs"
                leftSection={<IconPlus size={14} />}
                onClick={addKalem}
              >
                Ürün Ekle
              </Button>
              <Group gap="xs">
                <IconCurrencyLira size={20} style={{ color: 'var(--mantine-color-green-6)' }} />
                <Text fw={700} size="lg" c="green">
                  Toplam: {formatMoney(toplamTutar)}
                </Text>
              </Group>
            </Group>

            <Textarea
              label="Notlar"
              placeholder="Ek notlar..."
              rows={2}
              value={formData.notlar}
              onChange={(e) => setFormData({ ...formData, notlar: e.currentTarget.value })}
            />

            <Group justify="flex-end" mt="md">
              <Button
                variant="default"
                onClick={() => {
                  resetForm();
                  close();
                }}
              >
                İptal
              </Button>
              <Button color="blue" onClick={handleSubmit} loading={saving}>
                Sipariş Oluştur
              </Button>
            </Group>
          </Stack>
        </Modal>

        {/* Detay Modal */}
        <Modal
          opened={detailOpened}
          onClose={closeDetail}
          title={
            <Text fw={700} size="lg">
              Sipariş Detayı
            </Text>
          }
          size="lg"
          fullScreen={isMobile}
        >
          {selectedSiparis && (
            <Stack gap="md">
              <Group justify="space-between">
                <div>
                  <Text size="xl" fw={700}>
                    {selectedSiparis.siparis_no}
                  </Text>
                  <Text size="lg">{selectedSiparis.baslik}</Text>
                </div>
                <Group>
                  {getOncelikBadge(selectedSiparis.oncelik)}
                  {getDurumBadge(selectedSiparis.durum)}
                </Group>
              </Group>

              <Stepper active={getStepperActive(selectedSiparis.durum)} size="sm">
                <Stepper.Step label="Sipariş Oluşturuldu" icon={<IconClipboardList size={18} />} />
                <Stepper.Step label="Tedarikçiye Gönderildi" icon={<IconTruck size={18} />} />
                <Stepper.Step label="Teslim Alındı" icon={<IconPackage size={18} />} />
              </Stepper>

              <Divider />

              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <Paper withBorder p="md" radius="md">
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                    Proje
                  </Text>
                  {selectedSiparis.proje_ad ? (
                    <Group mt="xs" gap="xs">
                      <div
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          backgroundColor: selectedSiparis.proje_renk,
                        }}
                      />
                      <Text fw={500}>{selectedSiparis.proje_ad}</Text>
                    </Group>
                  ) : (
                    <Text c="dimmed" mt="xs">
                      Proje seçilmedi
                    </Text>
                  )}
                </Paper>
                <Paper withBorder p="md" radius="md">
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                    Tedarikçi
                  </Text>
                  <Text fw={500} mt="xs">
                    {selectedSiparis.tedarikci_unvan || 'Tedarikçi seçilmedi'}
                  </Text>
                </Paper>
              </SimpleGrid>

              <Paper withBorder p="md" radius="md">
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                  Tarihler
                </Text>
                <Group justify="space-between" mt="xs">
                  <Text size="sm">Sipariş: {formatDate(selectedSiparis.siparis_tarihi)}</Text>
                  <Text size="sm">Teslim: {formatDate(selectedSiparis.teslim_tarihi || '')}</Text>
                </Group>
              </Paper>

              <Paper withBorder p="md" radius="md">
                <Text size="xs" c="dimmed" tt="uppercase" fw={700} mb="sm">
                  Ürünler
                </Text>
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Ürün</Table.Th>
                      <Table.Th>Miktar</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>Tutar</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {selectedSiparis.kalemler?.map((k) => (
                      <Table.Tr key={k.id}>
                        <Table.Td>{k.urun_adi}</Table.Td>
                        <Table.Td>
                          {k.miktar} {k.birim}
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          {formatMoney(k.tahmini_fiyat)}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
                <Divider my="sm" />
                <Group justify="flex-end">
                  <Text size="lg" fw={700}>
                    Toplam: {formatMoney(selectedSiparis.toplam_tutar)}
                  </Text>
                </Group>
              </Paper>

              {selectedSiparis.notlar && (
                <Paper withBorder p="md" radius="md">
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                    Notlar
                  </Text>
                  <Text mt="xs">{selectedSiparis.notlar}</Text>
                </Paper>
              )}

              <Group justify="flex-end">
                <Button variant="default" onClick={closeDetail}>
                  Kapat
                </Button>
              </Group>
            </Stack>
          )}
        </Modal>

        {/* Sipariş Formu Modal */}
        <Modal
          opened={formModalOpened}
          onClose={closeFormModal}
          title={
            <Text fw={700} size="lg">
              📦 Sipariş Formu
            </Text>
          }
          size="lg"
          fullScreen={isMobile}
          styles={{
            body: { padding: 0 },
          }}
        >
          {formSiparis && (
            <Box>
              <Box p="md" className="print-content">
                {/* Header */}
                <Paper withBorder p="md" mb="md" style={{ textAlign: 'center' }}>
                  <Title order={3}>SİPARİŞ FORMU</Title>
                  <Text size="lg" fw={600} c="blue">
                    {formSiparis.siparis_no}
                  </Text>
                  <Text size="sm" c="dimmed">
                    Tarih: {formatDate(formSiparis.siparis_tarihi)}
                  </Text>
                </Paper>

                {/* Info Grid */}
                <SimpleGrid cols={{ base: 1, sm: 2 }} mb="md">
                  <Paper withBorder p="md">
                    <Text size="xs" c="dimmed" tt="uppercase" fw={700} mb="xs">
                      Tedarikçi
                    </Text>
                    <Text fw={600}>{formSiparis.tedarikci_unvan || 'Belirtilmedi'}</Text>
                    {formSiparis.tedarikci_vkn && (
                      <Text size="sm" c="dimmed">
                        VKN: {formSiparis.tedarikci_vkn}
                      </Text>
                    )}
                  </Paper>
                  <Paper withBorder p="md">
                    <Text size="xs" c="dimmed" tt="uppercase" fw={700} mb="xs">
                      Teslimat
                    </Text>
                    <Text fw={600}>{formSiparis.proje_ad || 'Belirtilmedi'}</Text>
                    <Text size="sm" c="dimmed">
                      Teslim: {formatDate(formSiparis.teslim_tarihi || '')}
                    </Text>
                  </Paper>
                </SimpleGrid>

                {/* Ürünler */}
                <Paper withBorder p="md" mb="md">
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700} mb="sm">
                    Sipariş Kalemleri
                  </Text>
                  <Table>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>#</Table.Th>
                        <Table.Th>Ürün</Table.Th>
                        <Table.Th>Miktar</Table.Th>
                        <Table.Th style={{ textAlign: 'right' }}>Tutar</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {formSiparis.kalemler?.map((k, i) => (
                        <Table.Tr key={k.id ?? `form-kalem-${i}`}>
                          <Table.Td>{i + 1}</Table.Td>
                          <Table.Td>{k.urun_adi}</Table.Td>
                          <Table.Td>
                            {k.miktar} {k.birim}
                          </Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}>
                            {formatMoney(k.tahmini_fiyat)}
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                  <Divider my="sm" />
                  <Group justify="flex-end">
                    <Text size="lg" fw={700}>
                      Toplam: {formatMoney(Number(formSiparis.toplam_tutar))}
                    </Text>
                  </Group>
                </Paper>

                {formSiparis.notlar && (
                  <Paper
                    withBorder
                    p="md"
                    mb="md"
                    style={{
                      backgroundColor: 'var(--mantine-color-yellow-0)',
                      borderColor: 'var(--mantine-color-yellow-4)',
                    }}
                  >
                    <Text size="xs" c="dimmed" tt="uppercase" fw={700} mb="xs">
                      Notlar
                    </Text>
                    <Text>{formSiparis.notlar}</Text>
                  </Paper>
                )}

                {/* İmza Alanları */}
                <SimpleGrid cols={{ base: 1, sm: 2 }}>
                  <Paper withBorder p="md" style={{ textAlign: 'center' }}>
                    <Text size="sm" c="dimmed" mb="xl">
                      Sipariş Veren
                    </Text>
                    <Divider />
                    <Text size="xs" c="dimmed" mt="xs">
                      İmza / Kaşe
                    </Text>
                  </Paper>
                  <Paper withBorder p="md" style={{ textAlign: 'center' }}>
                    <Text size="sm" c="dimmed" mb="xl">
                      Tedarikçi Onayı
                    </Text>
                    <Divider />
                    <Text size="xs" c="dimmed" mt="xs">
                      İmza / Kaşe
                    </Text>
                  </Paper>
                </SimpleGrid>
              </Box>

              {/* Butonlar */}
              <Group
                justify="flex-end"
                p="md"
                style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}
              >
                <Button variant="default" onClick={closeFormModal}>
                  Kapat
                </Button>
                <Button color="blue" onClick={handlePrint}>
                  🖨️ Yazdır
                </Button>
              </Group>
            </Box>
          )}
        </Modal>

        {/* Yeni Proje Modal */}
        <Modal
          opened={projeModalOpened}
          onClose={closeProjeModal}
          title={
            <Text fw={700} size="lg">
              Yeni Proje / Şube
            </Text>
          }
          size="md"
          fullScreen={isMobile}
        >
          <Stack gap="md">
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput
                label="Proje Kodu"
                placeholder="KYK, HASTANE..."
                value={newProje.kod}
                onChange={(e) =>
                  setNewProje({ ...newProje, kod: e.currentTarget.value.toUpperCase() })
                }
                required
              />
              <TextInput
                label="Proje Adı"
                placeholder="KYK Yurdu"
                value={newProje.ad}
                onChange={(e) => setNewProje({ ...newProje, ad: e.currentTarget.value })}
                required
              />
            </SimpleGrid>
            <TextInput
              label="Adres"
              placeholder="Proje adresi"
              value={newProje.adres}
              onChange={(e) => setNewProje({ ...newProje, adres: e.currentTarget.value })}
            />
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput
                label="Yetkili Kişi"
                placeholder="Ad Soyad"
                value={newProje.yetkili}
                onChange={(e) => setNewProje({ ...newProje, yetkili: e.currentTarget.value })}
              />
              <TextInput
                label="Telefon"
                placeholder="05xx xxx xx xx"
                value={newProje.telefon}
                onChange={(e) => setNewProje({ ...newProje, telefon: e.currentTarget.value })}
              />
            </SimpleGrid>
            <Select
              label="Renk"
              data={[
                { value: '#10b981', label: '🟢 Yeşil' },
                { value: '#3b82f6', label: '🔵 Mavi' },
                { value: '#f59e0b', label: '🟠 Turuncu' },
                { value: '#ef4444', label: '🔴 Kırmızı' },
                { value: '#8b5cf6', label: '🟣 Mor' },
                { value: '#6366f1', label: '💜 İndigo' },
                { value: '#ec4899', label: '💗 Pembe' },
              ]}
              value={newProje.renk}
              onChange={(v) => setNewProje({ ...newProje, renk: v || '#6366f1' })}
            />
            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={closeProjeModal}>
                İptal
              </Button>
              <Button color="blue" onClick={handleCreateProje}>
                Proje Oluştur
              </Button>
            </Group>
          </Stack>
        </Modal>

        {/* Rapor Merkezi Modal */}
        <RaporMerkeziModal
          opened={raporMerkeziOpen}
          onClose={() => setRaporMerkeziOpen(false)}
          module="operasyon"
        />
      </Container>
    </Box>
  );
}
