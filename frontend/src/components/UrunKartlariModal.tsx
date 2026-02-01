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
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconBuilding,
  IconCheck,
  IconDotsVertical,
  IconEdit,
  IconHistory,
  IconInfoCircle,
  IconLink,
  IconPackage,
  IconPlus,
  IconSearch,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useResponsive } from '@/hooks/useResponsive';
import { urunlerAPI } from '@/lib/api/services/urunler';
import { getUrunBirimBilgisi, DEFAULT_OIL_DENSITY } from '@/lib/birim-donusum';
import { formatMoney } from '@/lib/formatters';

// Birimler
const BIRIMLER = [
  { value: 'gr', label: 'Gram (gr)' },
  { value: 'kg', label: 'Kilogram (kg)' },
  { value: 'lt', label: 'Litre (lt)' },
  { value: 'ml', label: 'Mililitre (ml)' },
  { value: 'adet', label: 'Adet' },
];

const _FIYAT_BIRIMLERI = [
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
  ana_urun_id?: number | null;
  varyant_tipi?: string | null;
}

interface Props {
  opened: boolean;
  onClose: () => void;
  onUrunSelect?: (urun: UrunKarti) => void;
}

export default function UrunKartlariModal({ opened, onClose, onUrunSelect }: Props) {
  const { isMobile, isMounted } = useResponsive();

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

  // Mobil görünüm - panel kontrolü
  const [mobileShowDetail, setMobileShowDetail] = useState(false);

  // Düzenleme/Yeni ekleme modu
  const [editMode, setEditMode] = useState(false);
  const [showYeniUrun, setShowYeniUrun] = useState(false);
  const [formData, setFormData] = useState({
    ad: '',
    kategori_id: '',
    varsayilan_birim: 'gr',
    manuel_fiyat: null as number | null,
    fiyat_birimi: 'kg',
    birim_carpani: 1, // Fatura birim fiyatını standart birime çevirmek için çarpan
  });

  // Fonksiyonları useCallback ile tanımla (TDZ hatası için)
  const fetchKategoriler = useCallback(async () => {
    try {
      const result = (await urunlerAPI.getKategoriler()) as any;
      if (result.success) {
        setKategoriler(result.data as any);
      }
    } catch (error) {
      console.error('Kategori yükleme hatası:', error);
    }
  }, []);

  const fetchUrunler = useCallback(async () => {
    setLoading(true);
    try {
      const result = (await urunlerAPI.getUrunler({
        kategori_id: selectedKategori || undefined,
        arama: aramaText || undefined,
      })) as any;
      if (result.success) {
        setUrunler(result.data as any);
      }
    } catch (error) {
      console.error('Ürün yükleme hatası:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedKategori, aramaText]);

  // Data yükle
  useEffect(() => {
    if (opened) {
      fetchKategoriler();
      fetchUrunler();
    }
  }, [opened, fetchKategoriler, fetchUrunler]);

  // Filtre değişince yeniden yükle
  useEffect(() => {
    if (opened) {
      const timeout = setTimeout(() => {
        fetchUrunler();
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, [opened, fetchUrunler]);

  // Filtrelenmiş ürünler (client-side ek filtreleme için)
  const _filteredUrunler = useMemo(() => {
    return urunler.filter((urun) => {
      // Arama metni kontrolü
      if (aramaText) {
        const searchLower = aramaText.toLowerCase();
        const matchesSearch =
          urun.ad.toLowerCase().includes(searchLower) ||
          urun.kod.toLowerCase().includes(searchLower) ||
          urun.barkod?.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Kategori kontrolü (API'de zaten filtreleniyor ama client-side da kontrol edelim)
      if (selectedKategori && urun.kategori_id !== parseInt(selectedKategori, 10)) {
        return false;
      }

      return true;
    });
  }, [urunler, aramaText, selectedKategori]);

  // Yeni ürün oluştur
  const handleYeniUrun = async () => {
    if (!formData.ad.trim()) {
      notifications.show({ title: 'Hata', message: 'Ürün adı zorunludur', color: 'red' });
      return;
    }

    try {
      const result = await urunlerAPI.createUrun({
        ad: formData.ad,
        kategori_id: formData.kategori_id ? parseInt(formData.kategori_id, 10) : undefined,
      });

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
        notifications.show({
          title: 'Hata',
          message: result.error || 'Ürün oluşturulamadı',
          color: 'red',
        });
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
      const result = await urunlerAPI.updateUrun(selectedUrun.id, {
        ad: formData.ad,
        kategori_id: formData.kategori_id ? parseInt(formData.kategori_id, 10) : undefined,
        birim_carpani: formData.birim_carpani || 1,
      });

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
        setSelectedUrun({ ...selectedUrun, ...result.data } as any);
      } else {
        notifications.show({
          title: 'Hata',
          message: result.error || 'Ürün güncellenemedi',
          color: 'red',
        });
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
      const result = await urunlerAPI.deleteUrun(urunId);

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
        notifications.show({
          title: 'Hata',
          message: result.error || 'Ürün silinemedi',
          color: 'red',
        });
      }
    } catch (error: any) {
      console.error('Ürün silme hatası:', error);
      const errorMessage =
        error.message === 'Failed to fetch'
          ? "Backend sunucusuna bağlanılamıyor. Lütfen backend'in çalıştığından emin olun."
          : error.message || 'Ürün silinemedi';
      notifications.show({
        title: 'Hata',
        message: errorMessage,
        color: 'red',
      });
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
      birim_carpani: 1,
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
      birim_carpani: (urun as any).birim_carpani || 1,
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
    // Mobilde detay paneline geç
    if (isMobile && isMounted) {
      setMobileShowDetail(true);
    }
  };

  // Ürün detayını yükle
  const loadUrunDetay = async (id: number) => {
    setDetayLoading(true);
    try {
      const result = await urunlerAPI.getUrun(id);
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

  // Filtrelenmiş ürünler - Ana ürünler ve varyantları grupla
  const anaUrunler = urunler.filter((u) => !u.ana_urun_id);
  const varyantlar = urunler.filter((u) => u.ana_urun_id);

  // Ana ürünleri varyantlarıyla birlikte grupla
  const gruplanmisUrunler = anaUrunler.map((ana) => ({
    ana,
    varyantlar: varyantlar.filter((v) => v.ana_urun_id === ana.id),
  }));

  // Toplam sayı (ana + varyant)
  const toplamUrunSayisi = urunler.length;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="sm">
          <ThemeIcon
            size={isMobile && isMounted ? 'md' : 'lg'}
            radius="xl"
            variant="gradient"
            gradient={{ from: 'violet', to: 'indigo' }}
          >
            <IconPackage size={isMobile && isMounted ? 16 : 20} />
          </ThemeIcon>
          <Box>
            <Text fw={600} size={isMobile && isMounted ? 'md' : 'lg'}>
              Ürün Kartları
            </Text>
            {(!isMobile || !isMounted) && (
              <Text size="xs" c="dimmed">
                Reçete malzemeleri için temiz ürün tanımları
              </Text>
            )}
          </Box>
        </Group>
      }
      size={isMobile && isMounted ? '100%' : '95%'}
      fullScreen={isMobile && isMounted}
      styles={{
        body: { padding: 0 },
        content: { height: isMobile && isMounted ? '100%' : '90vh' },
      }}
    >
      <Box
        style={{
          display: 'flex',
          flexDirection: isMobile && isMounted ? 'column' : 'row',
          height: isMobile && isMounted ? 'calc(100vh - 60px)' : 'calc(90vh - 70px)',
        }}
      >
        {/* Sol Panel - Ürün Listesi */}
        <Box
          style={{
            width: isMobile && isMounted ? '100%' : 350,
            borderRight:
              isMobile && isMounted ? 'none' : '1px solid var(--mantine-color-default-border)',
            display: isMobile && isMounted && mobileShowDetail ? 'none' : 'flex',
            flexDirection: 'column',
            flex: isMobile && isMounted ? 1 : undefined,
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
                  label: `${k.ad} (${k.urun_sayisi})`,
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
            ) : gruplanmisUrunler.length === 0 ? (
              <Center py="xl">
                <Text c="dimmed" size="sm">
                  Ürün bulunamadı
                </Text>
              </Center>
            ) : (
              <Stack gap={0}>
                {gruplanmisUrunler.map(({ ana, varyantlar: anaVaryantlar }) => {
                  const isAnaSelected = selectedUrun?.id === ana.id;

                  return (
                    <Box key={ana.id}>
                      {/* Ana Ürün */}
                      <Box
                        p="xs"
                        style={{
                          borderBottom: '1px solid var(--mantine-color-default-border)',
                          cursor: 'pointer',
                          background: isAnaSelected
                            ? 'var(--mantine-color-violet-light)'
                            : undefined,
                          transition: 'background 0.15s',
                        }}
                        onClick={() => {
                          handleUrunSec(ana);
                          setShowYeniUrun(false);
                          setEditMode(false);
                        }}
                      >
                        <Group justify="space-between" wrap="wrap">
                          <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                            <Box style={{ flex: 1, minWidth: 0 }}>
                              <Text fw={500} size="sm" truncate>
                                {ana.ad}
                              </Text>
                              <Group gap={4}>
                                <Badge size="xs" variant="light" color="gray">
                                  {ana.kod}
                                </Badge>
                {ana.son_alis_fiyati && (
                                  <Badge size="xs" variant="filled" color="green">
                                    {formatMoney(ana.son_alis_fiyati, {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 3,
                                    })}
                                    /{ana.birim_kisa || 'KG'}
                                  </Badge>
                                )}
                                {/* Birim Dönüşüm Mini Bilgi */}
                                {(() => {
                                  const birimInfo = getUrunBirimBilgisi(ana.ad, ana.birim || 'kg');
                                  if (birimInfo.tip !== 'bilinmiyor' && birimInfo.tip !== 'agirlik') {
                                    return (
                                      <Tooltip
                                        label={
                                          <Box>
                                            <Text size="xs" fw={600}>{birimInfo.bilgi}</Text>
                                            <Text size="xs" c="dimmed">{birimInfo.formul}</Text>
                                            <Text size="xs" c="dimmed">Kaynak: {birimInfo.kaynak}</Text>
                                          </Box>
                                        }
                                        withArrow
                                        multiline
                                        w={200}
                                      >
                                        <Badge 
                                          size="xs" 
                                          variant="outline" 
                                          color={birimInfo.tip === 'adet' ? 'orange' : 'cyan'}
                                          leftSection={<IconInfoCircle size={10} />}
                                          style={{ cursor: 'help' }}
                                        >
                                          {birimInfo.tip === 'adet' ? 'AD' : 'LT'}
                                        </Badge>
                                      </Tooltip>
                                    );
                                  }
                                  return null;
                                })()}
                                <Badge
                                  size="xs"
                                  variant="light"
                                  color={
                                    ana.durum === 'normal'
                                      ? 'green'
                                      : ana.durum === 'tukendi'
                                        ? 'red'
                                        : 'orange'
                                  }
                                >
                                  {ana.durum === 'tukendi'
                                    ? 'Stok Yok'
                                    : ana.durum === 'kritik'
                                      ? 'Kritik'
                                      : ana.durum === 'dusuk'
                                        ? 'Düşük'
                                        : ''}
                                </Badge>
                                {anaVaryantlar.length > 0 && (
                                  <Badge size="xs" variant="dot" color="violet">
                                    {anaVaryantlar.length} varyant
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
                                  handleUrunSec(ana);
                                  startEdit(ana);
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
                                  handleSil(ana.id);
                                }}
                              >
                                Sil
                              </Menu.Item>
                            </Menu.Dropdown>
                          </Menu>
                        </Group>
                      </Box>

                      {/* Varyantlar - Girintili */}
                      {anaVaryantlar.length > 0 && (
                        <Box
                          pl="md"
                          style={{ borderLeft: '2px solid var(--mantine-color-violet-2)' }}
                        >
                          {anaVaryantlar.map((varyant) => {
                            const isVaryantSelected = selectedUrun?.id === varyant.id;
                            return (
                              <Box
                                key={varyant.id}
                                p="xs"
                                style={{
                                  borderBottom: '1px solid var(--mantine-color-default-border)',
                                  cursor: 'pointer',
                                  background: isVaryantSelected
                                    ? 'var(--mantine-color-violet-light)'
                                    : 'var(--mantine-color-gray-0)',
                                  transition: 'background 0.15s',
                                }}
                                onClick={() => {
                                  handleUrunSec(varyant);
                                  setShowYeniUrun(false);
                                  setEditMode(false);
                                }}
                              >
                                <Group justify="space-between" wrap="wrap">
                                  <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                                    <Text size="sm" c="dimmed">
                                      └─
                                    </Text>
                                    <Box style={{ flex: 1, minWidth: 0 }}>
                                      <Text fw={400} size="xs" truncate c="dimmed">
                                        {varyant.ad}
                                      </Text>
                                      <Group gap={4}>
                                        <Badge size="xs" variant="light" color="gray">
                                          {varyant.kod}
                                        </Badge>
                                        {varyant.son_alis_fiyati && (
                                          <Badge size="xs" variant="filled" color="green">
                                            {formatMoney(varyant.son_alis_fiyati, {
                                              minimumFractionDigits: 2,
                                              maximumFractionDigits: 3,
                                            })}
                                            /{varyant.birim_kisa || 'KG'}
                                          </Badge>
                                        )}
                                        {/* Varyant Birim Dönüşüm Mini Bilgi */}
                                        {(() => {
                                          const birimInfo = getUrunBirimBilgisi(varyant.ad, varyant.birim || 'kg');
                                          if (birimInfo.tip !== 'bilinmiyor' && birimInfo.tip !== 'agirlik') {
                                            return (
                                              <Tooltip
                                                label={
                                                  <Box>
                                                    <Text size="xs" fw={600}>{birimInfo.bilgi}</Text>
                                                    <Text size="xs" c="dimmed">{birimInfo.formul}</Text>
                                                    <Text size="xs" c="dimmed">Kaynak: {birimInfo.kaynak}</Text>
                                                  </Box>
                                                }
                                                withArrow
                                                multiline
                                                w={200}
                                              >
                                                <Badge 
                                                  size="xs" 
                                                  variant="outline" 
                                                  color={birimInfo.tip === 'adet' ? 'orange' : 'cyan'}
                                                  leftSection={<IconInfoCircle size={10} />}
                                                  style={{ cursor: 'help' }}
                                                >
                                                  {birimInfo.tip === 'adet' ? 'AD' : 'LT'}
                                                </Badge>
                                              </Tooltip>
                                            );
                                          }
                                          return null;
                                        })()}
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
                                        <IconDotsVertical size={12} />
                                      </ActionIcon>
                                    </Menu.Target>
                                    <Menu.Dropdown>
                                      <Menu.Item
                                        leftSection={<IconEdit size={14} />}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleUrunSec(varyant);
                                          startEdit(varyant);
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
                                          handleSil(varyant.id);
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
                        </Box>
                      )}
                    </Box>
                  );
                })}
              </Stack>
            )}
          </ScrollArea>

          {/* Alt Bilgi */}
          <Box p="xs" style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}>
            <Text size="xs" c="dimmed" ta="center">
              {toplamUrunSayisi} ürün kartı ({anaUrunler.length} ana, {varyantlar.length} varyant)
            </Text>
          </Box>
        </Box>

        {/* Sağ Panel - Detay/Form */}
        <Box
          style={{
            flex: 1,
            display:
              isMobile && isMounted && !mobileShowDetail && !showYeniUrun && !editMode
                ? 'none'
                : 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            position: isMobile && isMounted ? 'absolute' : 'relative',
            top: isMobile && isMounted ? 0 : undefined,
            left: isMobile && isMounted ? 0 : undefined,
            right: isMobile && isMounted ? 0 : undefined,
            bottom: isMobile && isMounted ? 0 : undefined,
            background: 'var(--mantine-color-body)',
            zIndex: isMobile && isMounted ? 10 : undefined,
          }}
        >
          {/* Mobilde geri butonu */}
          {isMobile && isMounted && (mobileShowDetail || showYeniUrun || editMode) && (
            <Box p="xs" style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
              <Button
                variant="subtle"
                color="gray"
                size="xs"
                onClick={() => {
                  setMobileShowDetail(false);
                  if (showYeniUrun || editMode) {
                    setShowYeniUrun(false);
                    setEditMode(false);
                    resetForm();
                  }
                }}
                leftSection={<IconX size={14} />}
              >
                Geri
              </Button>
            </Box>
          )}

          <ScrollArea style={{ flex: 1 }} p="md">
            {showYeniUrun || editMode ? (
              // Yeni Ürün / Düzenleme Formu
              <Stack gap="md">
                <Group justify="space-between">
                  <Text fw={600} size="lg">
                    {editMode ? '✏️ Ürün Kartını Düzenle' : '➕ Yeni Ürün Kartı'}
                  </Text>
                  {(!isMobile || !isMounted) && (
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
                  )}
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
                      label: k.ad,
                    }))}
                    value={formData.kategori_id}
                    onChange={(val) => setFormData({ ...formData, kategori_id: val || '' })}
                    searchable
                  />
                </SimpleGrid>

                <SimpleGrid cols={2}>
                  <Select
                    label="Varsayılan Birim"
                    data={BIRIMLER}
                    value={formData.varsayilan_birim}
                    onChange={(val) => setFormData({ ...formData, varsayilan_birim: val || 'gr' })}
                  />
                  <TextInput
                    label="Birim Çarpanı"
                    description="Fatura koli/paket fiyatını KG/LT'ye çevirmek için. Örn: 48×250gr = 12"
                    type="number"
                    min={0.001}
                    step={0.1}
                    value={formData.birim_carpani}
                    onChange={(e) =>
                      setFormData({ ...formData, birim_carpani: parseFloat(e.target.value) || 1 })
                    }
                    rightSection={
                      <Text size="xs" c="dimmed">
                        KG
                      </Text>
                    }
                  />
                </SimpleGrid>

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
                          color={
                            selectedUrun.durum === 'normal'
                              ? 'green'
                              : selectedUrun.durum === 'tukendi'
                                ? 'red'
                                : 'orange'
                          }
                        >
                          {selectedUrun.durum === 'tukendi'
                            ? 'Stok Yok'
                            : selectedUrun.durum === 'kritik'
                              ? 'Kritik'
                              : selectedUrun.durum === 'dusuk'
                                ? 'Düşük'
                                : 'Normal'}
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
                    <Text size="xs" c="dimmed">
                      Birim
                    </Text>
                    <Text fw={600}>{selectedUrun.birim || selectedUrun.birim_kisa || 'KG'}</Text>
                  </Paper>
                  <Paper p="sm" withBorder radius="md" ta="center">
                    <Text size="xs" c="dimmed">
                      Mevcut Stok
                    </Text>
                    <Text fw={600} c="blue">
                      {formatMiktar(selectedUrun.toplam_stok)} {selectedUrun.birim_kisa || 'Ad'}
                    </Text>
                  </Paper>
                  <Paper
                    p="sm"
                    withBorder
                    radius="md"
                    ta="center"
                    bg={selectedUrun.son_alis_fiyati ? 'green.0' : undefined}
                  >
                    <Text size="xs" c="dimmed">
                      Son Alış (Birim Fiyat)
                    </Text>
                    <Text fw={600} c={selectedUrun.son_alis_fiyati ? 'green' : 'dimmed'}>
                      {formatMoney(selectedUrun.son_alis_fiyati, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 3,
                      })}
                      /{selectedUrun.birim_kisa || 'KG'}
                    </Text>
                  </Paper>
                  <Paper p="sm" withBorder radius="md" ta="center">
                    <Text size="xs" c="dimmed">
                      Min / Kritik
                    </Text>
                    <Text fw={600}>
                      {formatMiktar(selectedUrun.min_stok)} /{' '}
                      {formatMiktar(selectedUrun.kritik_stok)}
                    </Text>
                  </Paper>
                </SimpleGrid>

                {/* Birim Dönüşüm Bilgisi Kartı */}
                {(() => {
                  const birimInfo = getUrunBirimBilgisi(selectedUrun.ad, selectedUrun.birim || 'kg');
                  const tipRenkler = {
                    adet: { bg: 'orange.0', border: 'orange.3', text: 'orange.8' },
                    sivi: { bg: 'cyan.0', border: 'cyan.3', text: 'cyan.8' },
                    agirlik: { bg: 'gray.0', border: 'gray.3', text: 'gray.7' },
                    bilinmiyor: { bg: 'gray.0', border: 'gray.3', text: 'gray.6' },
                  };
                  const renk = tipRenkler[birimInfo.tip];
                  
                  return (
                    <Paper 
                      p="sm" 
                      withBorder 
                      radius="md" 
                      bg={renk.bg}
                      style={{ borderColor: `var(--mantine-color-${renk.border})` }}
                    >
                      <Group justify="space-between" mb="xs">
                        <Group gap="xs">
                          <IconInfoCircle size={16} style={{ color: `var(--mantine-color-${renk.text})` }} />
                          <Text size="sm" fw={600} c={renk.text}>
                            Birim Dönüşüm Bilgisi
                          </Text>
                        </Group>
                        <Badge 
                          size="xs" 
                          variant="filled" 
                          color={birimInfo.tip === 'adet' ? 'orange' : birimInfo.tip === 'sivi' ? 'cyan' : 'gray'}
                        >
                          {birimInfo.tip === 'adet' ? 'ADET' : birimInfo.tip === 'sivi' ? 'SIVI' : 'AĞIRLIK'}
                        </Badge>
                      </Group>
                      <SimpleGrid cols={3} spacing="xs">
                        <Box>
                          <Text size="xs" c="dimmed">Formül</Text>
                          <Text size="sm" fw={600}>{birimInfo.bilgi}</Text>
                        </Box>
                        <Box>
                          <Text size="xs" c="dimmed">Açıklama</Text>
                          <Text size="sm">{birimInfo.formul || '-'}</Text>
                        </Box>
                        <Box>
                          <Text size="xs" c="dimmed">Kaynak</Text>
                          <Text size="sm">{birimInfo.kaynak}</Text>
                        </Box>
                      </SimpleGrid>
                      {birimInfo.tip === 'adet' && selectedUrun.son_alis_fiyati && (
                        <Box mt="xs" pt="xs" style={{ borderTop: '1px dashed var(--mantine-color-orange-3)' }}>
                          <Text size="xs" c="dimmed">
                            💡 Maliyet hesabı: {birimInfo.bilgi.match(/\d+/)?.[0] || 50}g × {formatMoney(selectedUrun.son_alis_fiyati / 1000)} = {formatMoney((parseFloat(birimInfo.bilgi.match(/\d+/)?.[0] || '50') * (selectedUrun.son_alis_fiyati || 0)) / 1000)}/adet
                          </Text>
                        </Box>
                      )}
                      {birimInfo.tip === 'sivi' && selectedUrun.son_alis_fiyati && (
                        <Box mt="xs" pt="xs" style={{ borderTop: '1px dashed var(--mantine-color-cyan-3)' }}>
                          <Text size="xs" c="dimmed">
                            💡 Maliyet hesabı: 1L = {birimInfo.bilgi.match(/[\d.]+/)?.[0] || DEFAULT_OIL_DENSITY}kg → {formatMoney(selectedUrun.son_alis_fiyati * parseFloat(birimInfo.bilgi.match(/[\d.]+/)?.[0] || String(DEFAULT_OIL_DENSITY)))}/lt
                          </Text>
                        </Box>
                      )}
                    </Paper>
                  );
                })()}

                {detayLoading ? (
                  <Center py="xl">
                    <Loader size="sm" color="violet" />
                  </Center>
                ) : (
                  urunDetay && (
                    <>
                      {/* Depo Durumları */}
                      <Box>
                        <Group gap="xs" mb="xs">
                          <IconBuilding size={16} />
                          <Text size="sm" fw={600}>
                            Depo Durumları
                          </Text>
                          <Badge size="xs" variant="light" color="cyan">
                            {urunDetay.depo_durumlari?.length || 0} depo
                          </Badge>
                        </Group>

                        {urunDetay.depo_durumlari && urunDetay.depo_durumlari.length > 0 ? (
                          <SimpleGrid cols={3} spacing="xs">
                            {urunDetay.depo_durumlari.map((dd: any) => (
                              <Paper key={dd.depo_id} p="xs" withBorder radius="md">
                                <Group justify="space-between" mb={4}>
                                  <Text size="xs" fw={600}>
                                    {dd.depo_ad}
                                  </Text>
                                  <Badge size="xs" variant="light">
                                    {dd.depo_kod}
                                  </Badge>
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

                      {/* Fiyat Geçmişi (Birim Fiyatlar) */}
                      <Box>
                        <Group gap="xs" mb="xs">
                          <IconHistory size={16} />
                          <Text size="sm" fw={600}>
                            Fiyat Geçmişi (Birim Fiyat)
                          </Text>
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
                                <Table.Th ta="right">Birim Fiyat</Table.Th>
                              </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                              {urunDetay.fiyat_gecmisi.slice(0, 5).map((fg: any, idx: number) => (
                                <Table.Tr key={fg.id || `fg-${idx}`}>
                                  <Table.Td>
                                    <Text size="xs">
                                      {fg.tarih
                                        ? new Date(fg.tarih).toLocaleDateString('tr-TR')
                                        : '-'}
                                    </Text>
                                  </Table.Td>
                                  <Table.Td>
                                    <Text size="xs" lineClamp={1}>
                                      {fg.tedarikci || '-'}
                                    </Text>
                                  </Table.Td>
                                  <Table.Td ta="right">
                                    <Text size="xs" fw={500} c="green">
                                      {formatMoney(fg.fiyat, {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 3,
                                      })}
                                      /{selectedUrun?.birim_kisa || 'KG'}
                                    </Text>
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
                          <Text size="sm" fw={600}>
                            Tedarikçi Eşleştirmeleri
                          </Text>
                          <Badge size="xs" variant="light" color="grape">
                            {urunDetay.tedarikci_eslestirmeleri?.length || 0} kayıt
                          </Badge>
                        </Group>

                        {urunDetay.tedarikci_eslestirmeleri &&
                        urunDetay.tedarikci_eslestirmeleri.length > 0 ? (
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
                                    <Text size="xs" fw={500}>
                                      {te.tedarikci_urun_adi}
                                    </Text>
                                  </Table.Td>
                                  <Table.Td>
                                    <Badge size="xs" variant="light">
                                      {te.tedarikci_urun_kodu || '-'}
                                    </Badge>
                                  </Table.Td>
                                  <Table.Td>
                                    <Text size="xs" c="dimmed">
                                      {te.eslestirme_sayisi || 0}x
                                    </Text>
                                  </Table.Td>
                                </Table.Tr>
                              ))}
                            </Table.Tbody>
                          </Table>
                        ) : (
                          <Paper p="sm" withBorder ta="center" c="dimmed">
                            <Text size="xs">Henüz tedarikçi eşleştirmesi yok</Text>
                            <Text size="xs" c="dimmed">
                              Faturadan stok girişi yapıldığında otomatik oluşturulur
                            </Text>
                          </Paper>
                        )}
                      </Box>
                    </>
                  )
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
