'use client';

import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Center,
  Divider,
  Group,
  Loader,
  Menu,
  Modal,
  Paper,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  ThemeIcon,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconBuilding,
  IconCheck,
  IconDotsVertical,
  IconEdit,
  IconHistory,
  IconLink,
  IconPackage,
  IconPlus,
  IconSearch,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { API_BASE_URL } from '@/lib/config';

const API_URL = `${API_BASE_URL}/api`;

// Birimler
const BIRIMLER = [
  { value: 'gr', label: 'Gram (gr)' },
  { value: 'kg', label: 'Kilogram (kg)' },
  { value: 'lt', label: 'Litre (lt)' },
  { value: 'ml', label: 'Mililitre (ml)' },
  { value: 'adet', label: 'Adet' },
];

const FIYAT_BIRIMLERI = [
  { value: 'kg', label: 'kg başına' },
  { value: 'lt', label: 'lt başına' },
  { value: 'adet', label: 'adet başına' },
];

interface Kategori {
  id: number;
  ad: string;
  ikon: string;
  urun_sayisi: number;
}

interface UrunKarti {
  id: number;
  kod: string;
  ad: string;
  kategori_id: number;
  kategori: string;
  kategori_ikon: string;
  birim: string;
  birim_kisa: string;
  ana_birim_id: number | null;
  barkod: string | null;
  min_stok: number;
  max_stok: number | null;
  kritik_stok: number | null;
  toplam_stok: number;
  ortalama_fiyat: number | null;
  son_alis_fiyati: number | null;
  son_alis_tarihi: string | null;
  manuel_fiyat: number | null;
  fiyat_birimi: string;
  ikon: string | null;
  aktif: boolean;
  durum: 'normal' | 'dusuk' | 'kritik' | 'fazla' | 'tukendi';
}

interface Props {
  opened: boolean;
  onClose: () => void;
  onUrunSelect?: (urun: UrunKarti) => void;
}

export default function UrunKartlariModal({ opened, onClose, onUrunSelect }: Props) {
  // States
  const [kategoriler, setKategoriler] = useState<Kategori[]>([]);
  const [urunler, setUrunler] = useState<UrunKarti[]>([]);
  const [loading, setLoading] = useState(false);
  const [detayLoading, setDetayLoading] = useState(false);
  
  // Detay bilgileri (direkt panelde gösterilecek)
  const [urunDetay, setUrunDetay] = useState<any>(null);

  // Filtreler
  const [aramaText, setAramaText] = useState('');
  const [selectedKategori, setSelectedKategori] = useState<string | null>(null);

  // Seçili ürün
  const [selectedUrun, setSelectedUrun] = useState<UrunKarti | null>(null);

  // Düzenleme/Yeni ekleme modu
  const [editMode, setEditMode] = useState(false);
  const [showYeniUrun, setShowYeniUrun] = useState(false);
  const [formData, setFormData] = useState({
    ad: '',
    kategori_id: '',
    varsayilan_birim: 'gr',
    manuel_fiyat: null as number | null,
    fiyat_birimi: 'kg',
  });

  // Data yükle
  useEffect(() => {
    if (opened) {
      fetchKategoriler();
      fetchUrunler();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened]);

  // Kategorileri yükle
  const fetchKategoriler = async () => {
    try {
      const res = await fetch(`${API_URL}/urunler/kategoriler/liste`);
      const result = await res.json();
      if (result.success) {
        setKategoriler(result.data);
      }
    } catch (error) {
      console.error('Kategori yükleme hatası:', error);
    }
  };

  // Ürünleri yükle
  const fetchUrunler = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedKategori) params.append('kategori_id', selectedKategori);
      if (aramaText) params.append('arama', aramaText);

      const res = await fetch(`${API_URL}/urunler?${params}`);
      const result = await res.json();
      if (result.success) {
        setUrunler(result.data);
      }
    } catch (error) {
      console.error('Ürün yükleme hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filtre değişince yeniden yükle
  useEffect(() => {
    if (opened) {
      const timeout = setTimeout(() => {
        fetchUrunler();
      }, 300);
      return () => clearTimeout(timeout);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, aramaText, selectedKategori]);

  // Yeni ürün oluştur
  const handleYeniUrun = async () => {
    if (!formData.ad.trim()) {
      notifications.show({ title: 'Hata', message: 'Ürün adı zorunludur', color: 'red' });
      return;
    }

    try {
      const res = await fetch(`${API_URL}/urunler`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ad: formData.ad,
          kategori_id: formData.kategori_id ? parseInt(formData.kategori_id, 10) : null,
        }),
      });

      const result = await res.json();

      if (result.success) {
        notifications.show({
          title: 'Başarılı',
          message: 'Ürün kartı oluşturuldu',
          color: 'green',
        });
        setShowYeniUrun(false);
        resetForm();
        fetchUrunler();
        fetchKategoriler();
      } else {
        notifications.show({ title: 'Hata', message: result.error, color: 'red' });
      }
    } catch (error) {
      console.error('Ürün oluşturma hatası:', error);
      notifications.show({ title: 'Hata', message: 'Ürün oluşturulamadı', color: 'red' });
    }
  };

  // Ürün güncelle
  const handleGuncelle = async () => {
    if (!selectedUrun) return;

    try {
      const res = await fetch(`${API_URL}/urunler/${selectedUrun.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ad: formData.ad,
          kategori_id: formData.kategori_id ? parseInt(formData.kategori_id, 10) : null,
        }),
      });

      const result = await res.json();

      if (result.success) {
        notifications.show({
          title: 'Başarılı',
          message: 'Ürün kartı güncellendi',
          color: 'green',
        });
        setEditMode(false);
        fetchUrunler();
        fetchKategoriler();
        // Seçili ürünü güncelle
        setSelectedUrun({ ...selectedUrun, ...result.data });
      } else {
        notifications.show({ title: 'Hata', message: result.error, color: 'red' });
      }
    } catch (error) {
      console.error('Ürün güncelleme hatası:', error);
      notifications.show({ title: 'Hata', message: 'Ürün güncellenemedi', color: 'red' });
    }
  };

  // Ürün sil
  const handleSil = async (urunId: number) => {
    if (!confirm('Bu ürün kartını silmek istediğinize emin misiniz?')) return;

    try {
      const res = await fetch(`${API_URL}/urunler/${urunId}`, {
        method: 'DELETE',
      });

      const result = await res.json();

      if (result.success) {
        notifications.show({
          title: 'Başarılı',
          message: 'Ürün kartı silindi',
          color: 'green',
        });
        if (selectedUrun?.id === urunId) {
          setSelectedUrun(null);
        }
        fetchUrunler();
        fetchKategoriler();
      } else {
        notifications.show({ title: 'Hata', message: result.error, color: 'red' });
      }
    } catch (error) {
      console.error('Ürün silme hatası:', error);
      notifications.show({ title: 'Hata', message: 'Ürün silinemedi', color: 'red' });
    }
  };

  // Form resetle
  const resetForm = () => {
    setFormData({
      ad: '',
      kategori_id: '',
      varsayilan_birim: 'gr',
      manuel_fiyat: null,
      fiyat_birimi: 'kg',
    });
  };

  // Düzenleme moduna geç
  const startEdit = (urun: UrunKarti) => {
    setFormData({
      ad: urun.ad,
      kategori_id: urun.kategori_id?.toString() || '',
      varsayilan_birim: urun.birim || 'gr',
      manuel_fiyat: urun.manuel_fiyat,
      fiyat_birimi: urun.fiyat_birimi || 'kg',
    });
    setEditMode(true);
  };

  // Ürün seç ve detay yükle
  const handleUrunSec = async (urun: UrunKarti) => {
    setSelectedUrun(urun);
    if (onUrunSelect) {
      onUrunSelect(urun);
    }
    // Detay bilgilerini yükle
    await loadUrunDetay(urun.id);
  };
  
  // Ürün detayını yükle
  const loadUrunDetay = async (id: number) => {
    setDetayLoading(true);
    try {
      const res = await fetch(`${API_URL}/urunler/${id}`);
      const result = await res.json();
      if (result.success) {
        setUrunDetay(result.data);
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      console.error('Ürün detay hatası:', error);
      setUrunDetay(null);
    } finally {
      setDetayLoading(false);
    }
  };

  // Miktar formatı (string veya number olabilir)
  const formatMiktar = (value: number | string | null | undefined) => {
    if (value === null || value === undefined) return '0';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (Number.isNaN(num)) return '0';
    if (Number.isInteger(num)) return num.toLocaleString('tr-TR');
    return num.toLocaleString('tr-TR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  };

  const formatMoney = (value: number | string | null | undefined) => {
    if (value === null || value === undefined) return '—';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (Number.isNaN(num)) return '—';
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  // Filtrelenmiş ürünler
  const filteredUrunler = urunler;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="sm">
          <ThemeIcon
            size="lg"
            radius="xl"
            variant="gradient"
            gradient={{ from: 'violet', to: 'indigo' }}
          >
            <IconPackage size={20} />
          </ThemeIcon>
          <Box>
            <Text fw={600} size="lg">
              Ürün Kartları
            </Text>
            <Text size="xs" c="dimmed">
              Reçete malzemeleri için temiz ürün tanımları
            </Text>
          </Box>
        </Group>
      }
      size="95%"
      styles={{
        body: { padding: 0 },
        content: { height: '90vh' },
      }}
    >
      <Box style={{ display: 'flex', height: 'calc(90vh - 70px)' }}>
        {/* Sol Panel - Ürün Listesi */}
        <Box
          style={{
            width: 350,
            borderRight: '1px solid var(--mantine-color-default-border)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Arama ve Filtre */}
          <Box p="sm" style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
            <Stack gap="xs">
              <TextInput
                placeholder="Ürün ara..."
                leftSection={<IconSearch size={16} />}
                value={aramaText}
                onChange={(e) => setAramaText(e.target.value)}
                size="sm"
              />
              <Select
                placeholder="Kategori seç"
                data={kategoriler.map((k) => ({
                  value: k.id.toString(),
                  label: `${k.ikon} ${k.ad} (${k.urun_sayisi})`,
                }))}
                value={selectedKategori}
                onChange={setSelectedKategori}
                clearable
                searchable
                size="xs"
              />
              <Button
                variant="gradient"
                gradient={{ from: 'violet', to: 'indigo' }}
                leftSection={<IconPlus size={16} />}
                onClick={() => {
                  resetForm();
                  setShowYeniUrun(true);
                  setSelectedUrun(null);
                  setEditMode(false);
                }}
                size="xs"
                fullWidth
              >
                Yeni Ürün Kartı
              </Button>
            </Stack>
          </Box>

          {/* Ürün Listesi */}
          <ScrollArea style={{ flex: 1 }}>
            {loading ? (
              <Center py="xl">
                <Loader color="violet" />
              </Center>
            ) : filteredUrunler.length === 0 ? (
              <Center py="xl">
                <Text c="dimmed" size="sm">
                  Ürün bulunamadı
                </Text>
              </Center>
            ) : (
              <Stack gap={0}>
                {filteredUrunler.map((urun) => {
                  const isSelected = selectedUrun?.id === urun.id;
                  return (
                    <Box
                      key={urun.id}
                      p="xs"
                      style={{
                        borderBottom: '1px solid var(--mantine-color-default-border)',
                        cursor: 'pointer',
                        background: isSelected ? 'var(--mantine-color-violet-light)' : undefined,
                        transition: 'background 0.15s',
                      }}
                      onClick={() => {
                        handleUrunSec(urun);
                        setShowYeniUrun(false);
                        setEditMode(false);
                      }}
                    >
                      <Group justify="space-between" wrap="nowrap">
                        <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                              <Text size="lg">{urun.ikon || urun.kategori_ikon || '📦'}</Text>
                          <Box style={{ flex: 1, minWidth: 0 }}>
                            <Text fw={500} size="sm" truncate>
                              {urun.ad}
                            </Text>
                            <Group gap={4}>
                              <Badge size="xs" variant="light" color="gray">
                                {urun.kod}
                              </Badge>
                              {urun.son_alis_fiyati && (
                                <Badge size="xs" variant="filled" color="green">
                                  {formatMoney(urun.son_alis_fiyati)}/{urun.birim_kisa || 'kg'}
                                </Badge>
                              )}
                              <Badge 
                                size="xs" 
                                variant="light" 
                                color={urun.durum === 'normal' ? 'green' : urun.durum === 'tukendi' ? 'red' : 'orange'}
                              >
                                {urun.durum === 'tukendi' ? 'Stok Yok' : urun.durum === 'kritik' ? 'Kritik' : urun.durum === 'dusuk' ? 'Düşük' : ''}
                              </Badge>
                            </Group>
                          </Box>
                        </Group>
                        <Menu shadow="md" width={130} position="bottom-end">
                          <Menu.Target>
                            <ActionIcon
                              variant="subtle"
                              color="gray"
                              size="sm"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <IconDotsVertical size={14} />
                            </ActionIcon>
                          </Menu.Target>
                          <Menu.Dropdown>
                            <Menu.Item
                              leftSection={<IconEdit size={14} />}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUrunSec(urun);
                                startEdit(urun);
                                setShowYeniUrun(false);
                              }}
                            >
                              Düzenle
                            </Menu.Item>
                            <Menu.Item
                              leftSection={<IconTrash size={14} />}
                              color="red"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSil(urun.id);
                              }}
                            >
                              Sil
                            </Menu.Item>
                          </Menu.Dropdown>
                        </Menu>
                      </Group>
                    </Box>
                  );
                })}
              </Stack>
            )}
          </ScrollArea>

          {/* Alt Bilgi */}
          <Box p="xs" style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}>
            <Text size="xs" c="dimmed" ta="center">
              {filteredUrunler.length} ürün kartı
            </Text>
          </Box>
        </Box>

        {/* Sağ Panel - Detay/Form */}
        <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <ScrollArea style={{ flex: 1 }} p="md">
            {showYeniUrun || editMode ? (
              // Yeni Ürün / Düzenleme Formu
              <Stack gap="md">
                <Group justify="space-between">
                  <Text fw={600} size="lg">
                    {editMode ? '✏️ Ürün Kartını Düzenle' : '➕ Yeni Ürün Kartı'}
                  </Text>
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    onClick={() => {
                      setShowYeniUrun(false);
                      setEditMode(false);
                      resetForm();
                    }}
                  >
                    <IconX size={18} />
                  </ActionIcon>
                </Group>

                <Divider />

                <SimpleGrid cols={2}>
                  <TextInput
                    label="Ürün Adı"
                    placeholder="Örn: Domates"
                    value={formData.ad}
                    onChange={(e) => setFormData({ ...formData, ad: e.target.value })}
                    required
                  />
                  <Select
                    label="Kategori"
                    placeholder="Kategori seç"
                    data={kategoriler.map((k) => ({
                      value: k.id.toString(),
                      label: `${k.ikon} ${k.ad}`,
                    }))}
                    value={formData.kategori_id}
                    onChange={(val) => setFormData({ ...formData, kategori_id: val || '' })}
                    searchable
                  />
                </SimpleGrid>

                <Select
                  label="Varsayılan Birim"
                  data={BIRIMLER}
                  value={formData.varsayilan_birim}
                  onChange={(val) => setFormData({ ...formData, varsayilan_birim: val || 'gr' })}
                  w="50%"
                />

                <Group justify="flex-end" mt="md">
                  <Button
                    variant="light"
                    color="gray"
                    onClick={() => {
                      setShowYeniUrun(false);
                      setEditMode(false);
                      resetForm();
                    }}
                  >
                    İptal
                  </Button>
                  <Button
                    variant="gradient"
                    gradient={{ from: 'violet', to: 'indigo' }}
                    leftSection={<IconCheck size={16} />}
                    onClick={editMode ? handleGuncelle : handleYeniUrun}
                  >
                    {editMode ? 'Güncelle' : 'Oluştur'}
                  </Button>
                </Group>
              </Stack>
            ) : selectedUrun ? (
              // Ürün Detayı - Tüm bilgiler tek panelde
              <Stack gap="md">
                <Group justify="space-between">
                  <Group gap="sm">
                    <Text size="2rem">
                      {selectedUrun.ikon || selectedUrun.kategori_ikon || '📦'}
                    </Text>
                    <Box>
                      <Text fw={600} size="xl">
                        {selectedUrun.ad}
                      </Text>
                      <Group gap="xs">
                        <Badge variant="light" color="violet">
                          {selectedUrun.kod}
                        </Badge>
                        <Badge variant="light" color="gray">
                          {selectedUrun.kategori}
                        </Badge>
                        <Badge 
                          variant="filled" 
                          color={selectedUrun.durum === 'normal' ? 'green' : selectedUrun.durum === 'tukendi' ? 'red' : 'orange'}
                        >
                          {selectedUrun.durum === 'tukendi' ? 'Stok Yok' : selectedUrun.durum === 'kritik' ? 'Kritik' : selectedUrun.durum === 'dusuk' ? 'Düşük' : 'Normal'}
                        </Badge>
                      </Group>
                    </Box>
                  </Group>
                  <Button
                    variant="light"
                    leftSection={<IconEdit size={16} />}
                    onClick={() => startEdit(selectedUrun)}
                  >
                    Düzenle
                  </Button>
                </Group>

                <Divider />

                {/* Genel Bilgiler */}
                <SimpleGrid cols={4}>
                  <Paper p="sm" withBorder radius="md" ta="center">
                    <Text size="xs" c="dimmed">Birim</Text>
                    <Text fw={600}>{selectedUrun.birim || selectedUrun.birim_kisa || '—'}</Text>
                  </Paper>
                  <Paper p="sm" withBorder radius="md" ta="center">
                    <Text size="xs" c="dimmed">Mevcut Stok</Text>
                    <Text fw={600} c="blue">{formatMiktar(selectedUrun.toplam_stok)} {selectedUrun.birim_kisa || 'Ad'}</Text>
                  </Paper>
                  <Paper p="sm" withBorder radius="md" ta="center" bg={selectedUrun.son_alis_fiyati ? 'green.0' : undefined}>
                    <Text size="xs" c="dimmed">Son Alış</Text>
                    <Text fw={600} c={selectedUrun.son_alis_fiyati ? 'green' : 'dimmed'}>{formatMoney(selectedUrun.son_alis_fiyati)}</Text>
                  </Paper>
                  <Paper p="sm" withBorder radius="md" ta="center">
                    <Text size="xs" c="dimmed">Min / Kritik</Text>
                    <Text fw={600}>{formatMiktar(selectedUrun.min_stok)} / {formatMiktar(selectedUrun.kritik_stok)}</Text>
                  </Paper>
                </SimpleGrid>

                {detayLoading ? (
                  <Center py="xl">
                    <Loader size="sm" color="violet" />
                  </Center>
                ) : urunDetay && (
                  <>
                    {/* Depo Durumları */}
                    <Box>
                      <Group gap="xs" mb="xs">
                        <IconBuilding size={16} />
                        <Text size="sm" fw={600}>Depo Durumları</Text>
                        <Badge size="xs" variant="light" color="cyan">
                          {urunDetay.depo_durumlari?.length || 0} depo
                        </Badge>
                      </Group>
                      
                      {urunDetay.depo_durumlari && urunDetay.depo_durumlari.length > 0 ? (
                        <SimpleGrid cols={3} spacing="xs">
                          {urunDetay.depo_durumlari.map((dd: any) => (
                            <Paper key={dd.depo_id} p="xs" withBorder radius="md">
                              <Group justify="space-between" mb={4}>
                                <Text size="xs" fw={600}>{dd.depo_ad}</Text>
                                <Badge size="xs" variant="light">{dd.depo_kod}</Badge>
                              </Group>
                              <Text size="lg" fw={700} c="blue">
                                {formatMiktar(dd.miktar)} {selectedUrun.birim_kisa || 'Ad'}
                              </Text>
                            </Paper>
                          ))}
                        </SimpleGrid>
                      ) : (
                        <Paper p="sm" withBorder ta="center" c="dimmed">
                          <Text size="xs">Bu ürün hiçbir depoda stokta yok</Text>
                        </Paper>
                      )}
                    </Box>

                    {/* Fiyat Geçmişi */}
                    <Box>
                      <Group gap="xs" mb="xs">
                        <IconHistory size={16} />
                        <Text size="sm" fw={600}>Fiyat Geçmişi</Text>
                        <Badge size="xs" variant="light">
                          {urunDetay.fiyat_gecmisi?.length || 0} kayıt
                        </Badge>
                      </Group>
                      
                      {urunDetay.fiyat_gecmisi && urunDetay.fiyat_gecmisi.length > 0 ? (
                        <Table striped highlightOnHover withTableBorder>
                          <Table.Thead>
                            <Table.Tr>
                              <Table.Th>Tarih</Table.Th>
                              <Table.Th>Tedarikçi</Table.Th>
                              <Table.Th>Fiyat</Table.Th>
                            </Table.Tr>
                          </Table.Thead>
                          <Table.Tbody>
                            {urunDetay.fiyat_gecmisi.slice(0, 5).map((fg: any) => (
                              <Table.Tr key={fg.id}>
                                <Table.Td>
                                  <Text size="xs">{fg.tarih ? new Date(fg.tarih).toLocaleDateString('tr-TR') : '-'}</Text>
                                </Table.Td>
                                <Table.Td>
                                  <Text size="xs" lineClamp={1}>{fg.tedarikci || '-'}</Text>
                                </Table.Td>
                                <Table.Td>
                                  <Text size="xs" fw={500} c="blue">{formatMoney(fg.fiyat)}</Text>
                                </Table.Td>
                              </Table.Tr>
                            ))}
                          </Table.Tbody>
                        </Table>
                      ) : (
                        <Paper p="sm" withBorder ta="center" c="dimmed">
                          <Text size="xs">Henüz fiyat kaydı yok</Text>
                        </Paper>
                      )}
                    </Box>

                    {/* Tedarikçi Eşleştirmeleri */}
                    <Box>
                      <Group gap="xs" mb="xs">
                        <IconLink size={16} />
                        <Text size="sm" fw={600}>Tedarikçi Eşleştirmeleri</Text>
                        <Badge size="xs" variant="light" color="grape">
                          {urunDetay.tedarikci_eslestirmeleri?.length || 0} kayıt
                        </Badge>
                      </Group>
                      
                      {urunDetay.tedarikci_eslestirmeleri && urunDetay.tedarikci_eslestirmeleri.length > 0 ? (
                        <Table striped highlightOnHover withTableBorder>
                          <Table.Thead>
                            <Table.Tr>
                              <Table.Th>Tedarikçi Ürün Adı</Table.Th>
                              <Table.Th>Kod</Table.Th>
                              <Table.Th>Kullanım</Table.Th>
                            </Table.Tr>
                          </Table.Thead>
                          <Table.Tbody>
                            {urunDetay.tedarikci_eslestirmeleri.slice(0, 5).map((te: any) => (
                              <Table.Tr key={te.id}>
                                <Table.Td>
                                  <Text size="xs" fw={500}>{te.tedarikci_urun_adi}</Text>
                                </Table.Td>
                                <Table.Td>
                                  <Badge size="xs" variant="light">{te.tedarikci_urun_kodu || '-'}</Badge>
                                </Table.Td>
                                <Table.Td>
                                  <Text size="xs" c="dimmed">{te.eslestirme_sayisi || 0}x</Text>
                                </Table.Td>
                              </Table.Tr>
                            ))}
                          </Table.Tbody>
                        </Table>
                      ) : (
                        <Paper p="sm" withBorder ta="center" c="dimmed">
                          <Text size="xs">Henüz tedarikçi eşleştirmesi yok</Text>
                          <Text size="xs" c="dimmed">Faturadan stok girişi yapıldığında otomatik oluşturulur</Text>
                        </Paper>
                      )}
                    </Box>
                  </>
                )}
              </Stack>
            ) : (
              // Hiçbir şey seçili değil
              <Center h="100%">
                <Stack align="center" gap="md">
                  <ThemeIcon size={80} radius="xl" variant="light" color="gray">
                    <IconPackage size={40} />
                  </ThemeIcon>
                  <Box ta="center">
                    <Text fw={500} size="lg">
                      Ürün Kartı Seçin
                    </Text>
                    <Text c="dimmed" size="sm">
                      Sol listeden bir ürün seçin veya yeni ürün kartı oluşturun
                    </Text>
                  </Box>
                </Stack>
              </Center>
            )}
          </ScrollArea>
        </Box>
      </Box>
    </Modal>
  );
}
