'use client';

import {
  ActionIcon,
  Autocomplete,
  Badge,
  Box,
  Button,
  Center,
  Divider,
  Group,
  Loader,
  Menu,
  Modal,
  NumberInput,
  Paper,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconCheck,
  IconCurrencyLira,
  IconDotsVertical,
  IconEdit,
  IconLink,
  IconLinkOff,
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
  kategori_adi: string;
  kategori_ikon: string;
  varsayilan_birim: string;
  stok_kart_id: number | null;
  stok_kart_adi: string | null;
  stok_fiyat: number | null;
  stok_birim: string | null;
  manuel_fiyat: number | null;
  fiyat_birimi: string;
  guncel_fiyat: number | null;
  ikon: string | null;
  aktif: boolean;
}

interface StokKarti {
  id: number;
  kod: string;
  ad: string;
  birim: string;
  son_alis_fiyat: number;
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
  const [stokKartlari, setStokKartlari] = useState<StokKarti[]>([]);
  const [loading, setLoading] = useState(false);

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
    stok_kart_id: null as number | null,
    manuel_fiyat: null as number | null,
    fiyat_birimi: 'kg',
  });

  // Stok arama
  const [stokArama, setStokArama] = useState('');

  // Data yükle
  useEffect(() => {
    if (opened) {
      fetchKategoriler();
      fetchUrunler();
      fetchStokKartlari();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened]);

  // Kategorileri yükle
  const fetchKategoriler = async () => {
    try {
      const res = await fetch(`${API_URL}/menu-planlama/urun-kategorileri`);
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

      const res = await fetch(`${API_URL}/menu-planlama/urun-kartlari?${params}`);
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

  // Stok kartlarını yükle
  const fetchStokKartlari = async (arama?: string) => {
    try {
      const params = arama ? `?arama=${encodeURIComponent(arama)}` : '';
      const res = await fetch(`${API_URL}/menu-planlama/stok-kartlari-listesi${params}`);
      const result = await res.json();
      if (result.success) {
        setStokKartlari(result.data);
      }
    } catch (error) {
      console.error('Stok kartı yükleme hatası:', error);
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
      const res = await fetch(`${API_URL}/menu-planlama/urun-kartlari`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
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
      const res = await fetch(`${API_URL}/menu-planlama/urun-kartlari/${selectedUrun.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
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
      const res = await fetch(`${API_URL}/menu-planlama/urun-kartlari/${urunId}`, {
        method: 'DELETE',
      });

      const result = await res.json();

      if (result.success) {
        notifications.show({
          title: 'Başarılı',
          message: result.soft_deleted ? 'Ürün kartı pasife alındı' : 'Ürün kartı silindi',
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
      stok_kart_id: null,
      manuel_fiyat: null,
      fiyat_birimi: 'kg',
    });
    setStokArama('');
  };

  // Düzenleme moduna geç
  const startEdit = (urun: UrunKarti) => {
    setFormData({
      ad: urun.ad,
      kategori_id: urun.kategori_id?.toString() || '',
      varsayilan_birim: urun.varsayilan_birim || 'gr',
      stok_kart_id: urun.stok_kart_id,
      manuel_fiyat: urun.manuel_fiyat,
      fiyat_birimi: urun.fiyat_birimi || 'kg',
    });
    setStokArama(urun.stok_kart_adi || '');
    setEditMode(true);
  };

  // Ürün seç (reçeteye eklemek için)
  const handleUrunSec = (urun: UrunKarti) => {
    setSelectedUrun(urun);
    if (onUrunSelect) {
      onUrunSelect(urun);
    }
  };

  const formatMoney = (value: number | null) => {
    if (value === null || value === undefined) return '—';
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 2,
    }).format(value);
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
                              {urun.guncel_fiyat && (
                                <Badge size="xs" variant="filled" color="green">
                                  {formatMoney(urun.guncel_fiyat)}/{urun.fiyat_birimi}
                                </Badge>
                              )}
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

                <Divider label="Fiyat Bilgisi" labelPosition="center" />

                <Paper p="md" withBorder radius="md" bg="blue.0">
                  <Stack gap="sm">
                    <Text size="sm" fw={500}>
                      <IconLink size={14} style={{ marginRight: 4 }} />
                      Stok Kartı ile Eşleştir (Opsiyonel)
                    </Text>
                    <Text size="xs" c="dimmed">
                      Stok kartı ile eşleştirirseniz fiyat otomatik güncel kalır
                    </Text>
                    <Autocomplete
                      placeholder="Stok kartı ara..."
                      data={stokKartlari.map((sk) => ({
                        value: sk.ad,
                        label: `${sk.kod} - ${sk.ad} (${formatMoney(sk.son_alis_fiyat)}/${sk.birim || 'kg'})`,
                      }))}
                      value={stokArama}
                      onChange={(val) => {
                        setStokArama(val);
                        fetchStokKartlari(val);
                      }}
                      onOptionSubmit={(val) => {
                        const selected = stokKartlari.find((sk) => sk.ad === val);
                        if (selected) {
                          setFormData({ ...formData, stok_kart_id: selected.id });
                          setStokArama(selected.ad);
                        }
                      }}
                    />
                    {formData.stok_kart_id && (
                      <Group>
                        <Badge color="green" leftSection={<IconCheck size={12} />}>
                          Stok kartı seçildi
                        </Badge>
                        <Button
                          size="xs"
                          variant="subtle"
                          color="red"
                          onClick={() => {
                            setFormData({ ...formData, stok_kart_id: null });
                            setStokArama('');
                          }}
                        >
                          Kaldır
                        </Button>
                      </Group>
                    )}
                  </Stack>
                </Paper>

                <Paper p="md" withBorder radius="md">
                  <Stack gap="sm">
                    <Text size="sm" fw={500}>
                      <IconCurrencyLira size={14} style={{ marginRight: 4 }} />
                      Manuel Fiyat (Stok kartı yoksa)
                    </Text>
                    <SimpleGrid cols={2}>
                      <NumberInput
                        label="Fiyat (₺)"
                        placeholder="0.00"
                        value={formData.manuel_fiyat || ''}
                        onChange={(val) =>
                          setFormData({
                            ...formData,
                            manuel_fiyat: typeof val === 'number' ? val : null,
                          })
                        }
                        min={0}
                        decimalScale={2}
                        disabled={!!formData.stok_kart_id}
                      />
                      <Select
                        label="Fiyat Birimi"
                        data={FIYAT_BIRIMLERI}
                        value={formData.fiyat_birimi}
                        onChange={(val) => setFormData({ ...formData, fiyat_birimi: val || 'kg' })}
                      />
                    </SimpleGrid>
                  </Stack>
                </Paper>

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
              // Ürün Detayı
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
                          {selectedUrun.kategori_adi}
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

                <SimpleGrid cols={3}>
                  <Paper p="md" withBorder radius="md" ta="center">
                    <Text size="xs" c="dimmed">
                      Varsayılan Birim
                    </Text>
                    <Text fw={600} size="lg">
                      {selectedUrun.varsayilan_birim?.toUpperCase()}
                    </Text>
                  </Paper>
                  <Paper p="md" withBorder radius="md" ta="center">
                    <Text size="xs" c="dimmed">
                      Fiyat Birimi
                    </Text>
                    <Text fw={600} size="lg">
                      {selectedUrun.fiyat_birimi?.toUpperCase()}
                    </Text>
                  </Paper>
                  <Paper
                    p="md"
                    withBorder
                    radius="md"
                    ta="center"
                    bg={selectedUrun.guncel_fiyat ? 'green.0' : 'gray.0'}
                  >
                    <Text size="xs" c="dimmed">
                      Güncel Fiyat
                    </Text>
                    <Text fw={600} size="lg" c={selectedUrun.guncel_fiyat ? 'green' : 'dimmed'}>
                      {formatMoney(selectedUrun.guncel_fiyat)}
                    </Text>
                  </Paper>
                </SimpleGrid>

                {/* Stok Kartı Eşleştirme */}
                <Paper p="md" withBorder radius="md">
                  <Group justify="space-between" mb="sm">
                    <Text fw={500}>
                      {selectedUrun.stok_kart_id ? (
                        <>
                          <IconLink size={16} style={{ marginRight: 4 }} /> Bağlı Stok Kartı
                        </>
                      ) : (
                        <>
                          <IconLinkOff size={16} style={{ marginRight: 4 }} /> Stok Kartı Bağlantısı
                          Yok
                        </>
                      )}
                    </Text>
                  </Group>

                  {selectedUrun.stok_kart_id ? (
                    <Paper p="sm" withBorder bg="blue.0">
                      <Group justify="space-between">
                        <Box>
                          <Text fw={500}>{selectedUrun.stok_kart_adi}</Text>
                          <Text size="xs" c="dimmed">
                            Stok fiyatı: {formatMoney(selectedUrun.stok_fiyat)}/
                            {selectedUrun.stok_birim || 'kg'}
                          </Text>
                        </Box>
                        <Badge color="green" size="lg">
                          <IconCheck size={12} /> Eşleştirildi
                        </Badge>
                      </Group>
                    </Paper>
                  ) : (
                    <Text size="sm" c="dimmed">
                      Bu ürün kartı henüz bir stok kartı ile eşleştirilmemiş.
                      {selectedUrun.manuel_fiyat
                        ? ' Manuel fiyat kullanılıyor.'
                        : ' Fiyat bilgisi yok.'}
                    </Text>
                  )}
                </Paper>

                {/* Manuel Fiyat */}
                {selectedUrun.manuel_fiyat && (
                  <Paper p="md" withBorder radius="md" bg="orange.0">
                    <Group justify="space-between">
                      <Box>
                        <Text fw={500}>Manuel Fiyat</Text>
                        <Text size="xs" c="dimmed">
                          Elle girilen fiyat değeri
                        </Text>
                      </Box>
                      <Text fw={600} size="lg" c="orange">
                        {formatMoney(selectedUrun.manuel_fiyat)}/{selectedUrun.fiyat_birimi}
                      </Text>
                    </Group>
                  </Paper>
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
