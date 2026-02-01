'use client';

import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Checkbox,
  Collapse,
  Group,
  Menu,
  Pagination,
  Paper,
  Progress,
  ScrollArea,
  Select,
  Skeleton,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconAdjustments,
  IconChevronDown,
  IconChevronUp,
  IconCurrencyLira,
  IconDownload,
  IconEye,
  IconRefresh,
  IconRobot,
  IconSearch,
  IconSelector,
  IconX,
} from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { API_BASE_URL } from '@/lib/config';
import { downloadCSV, toCSV, URUN_EXPORT_COLUMNS } from '@/lib/fiyat-yonetimi/exportUtils';

interface Urun {
  id: number;
  kod: string;
  ad: string;
  varsayilan_birim: string;
  aktif_fiyat: number | null;
  aktif_fiyat_tipi: string | null;
  aktif_fiyat_guven: number;
  aktif_fiyat_guncelleme: string | null;
  kategori_ad: string | null;
  kaynak_adi: string | null;
  guncellik_durumu: string;
  gun_farki: number | null;
  tipLabel?: string;
}

interface Kategori {
  kategori_id: number;
  kategori_ad: string;
  urun_sayisi: number;
}

interface UrunListesiProps {
  onUrunSec: (urunId: number) => void;
}

type SortField = 'ad' | 'aktif_fiyat' | 'aktif_fiyat_guven' | 'aktif_fiyat_guncelleme' | 'kategori_ad';
type SortDirection = 'asc' | 'desc';

interface SortState {
  field: SortField | null;
  direction: SortDirection;
}

const FIYAT_TIPLERI = [
  { value: '', label: 'Tümü' },
  { value: 'SOZLESME', label: 'Sözleşme' },
  { value: 'FATURA', label: 'Fatura' },
  { value: 'PIYASA', label: 'Piyasa' },
  { value: 'MANUEL', label: 'Manuel' },
  { value: 'AI_TAHMINI', label: 'AI Tahmini' },
];

const GUNCELLIK_OPTIONS = [
  { value: '', label: 'Tümü' },
  { value: 'guncel', label: 'Güncel (7 gün)' },
  { value: 'eski', label: 'Eskimiş (30+ gün)' },
];

// Sıralanabilir tablo başlığı komponenti
function SortableTh({
  children,
  sorted,
  reversed,
  onSort,
  style,
}: {
  children: React.ReactNode;
  sorted: boolean;
  reversed: boolean;
  onSort: () => void;
  style?: React.CSSProperties;
}) {
  const Icon = sorted ? (reversed ? IconChevronUp : IconChevronDown) : IconSelector;
  return (
    <Table.Th style={style}>
      <UnstyledButton
        onClick={onSort}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          width: '100%',
          fontWeight: 600,
          color: sorted ? 'var(--mantine-color-blue-6)' : undefined,
        }}
      >
        {children}
        <Icon size={14} style={{ opacity: sorted ? 1 : 0.5 }} />
      </UnstyledButton>
    </Table.Th>
  );
}

export function UrunListesi({ onUrunSec }: UrunListesiProps) {
  const { isAuthenticated } = useAuth();
  const [urunler, setUrunler] = useState<Urun[]>([]);
  const [kategoriler, setKategoriler] = useState<Kategori[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  // Filtreler
  const [search, setSearch] = useState('');
  const [kategoriId, setKategoriId] = useState<string>('');
  const [tip, setTip] = useState<string>('');
  const [guncellik, setGuncellik] = useState<string>('');
  const [page, setPage] = useState(1);
  const limit = 25;

  // Sıralama
  const [sortState, setSortState] = useState<SortState>({ field: null, direction: 'asc' });

  // Toplu seçim
  const [seciliIds, setSeciliIds] = useState<Set<number>>(new Set());
  const [topluIslemYapiliyor, setTopluIslemYapiliyor] = useState(false);

  // Mobil
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [filtrelerAcik, { toggle: toggleFiltreler }] = useDisclosure(false);

  const fetchKategoriler = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/fiyat-yonetimi/kategoriler`);
      const data = await res.json();
      if (data.success) {
        setKategoriler(data.data);
      }
    } catch (error) {
      console.error('Kategori listesi hatası:', error);
    }
  };

  const fetchUrunler = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: ((page - 1) * limit).toString(),
      });
      if (search) params.append('search', search);
      if (kategoriId) params.append('kategori_id', kategoriId);
      if (tip) params.append('tip', tip);
      if (guncellik) params.append('guncellik', guncellik);

      const res = await fetch(`${API_BASE_URL}/api/fiyat-yonetimi/urunler?${params}`);
      const data = await res.json();
      if (data.success) {
        setUrunler(data.data);
        setTotal(data.total);
        // Sayfa değişince seçimleri temizle
        setSeciliIds(new Set());
      }
    } catch (error) {
      console.error('Ürün listesi hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKategoriler();
  }, []);

  useEffect(() => {
    fetchUrunler();
  }, [search, kategoriId, tip, guncellik, page]);

  // Sıralama işlemi
  const handleSort = (field: SortField) => {
    setSortState((current) => ({
      field,
      direction: current.field === field && current.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  // Sıralanmış ürün listesi
  const sortedUrunler = useMemo(() => {
    if (!sortState.field) return urunler;

    return [...urunler].sort((a, b) => {
      const direction = sortState.direction === 'asc' ? 1 : -1;

      switch (sortState.field) {
        case 'ad':
          return direction * a.ad.localeCompare(b.ad, 'tr');
        case 'kategori_ad':
          const katA = a.kategori_ad || '';
          const katB = b.kategori_ad || '';
          return direction * katA.localeCompare(katB, 'tr');
        case 'aktif_fiyat':
          const fiyatA = a.aktif_fiyat || 0;
          const fiyatB = b.aktif_fiyat || 0;
          return direction * (fiyatA - fiyatB);
        case 'aktif_fiyat_guven':
          const guvenA = a.aktif_fiyat_guven || 0;
          const guvenB = b.aktif_fiyat_guven || 0;
          return direction * (guvenA - guvenB);
        case 'aktif_fiyat_guncelleme':
          const tarihA = a.aktif_fiyat_guncelleme ? new Date(a.aktif_fiyat_guncelleme).getTime() : 0;
          const tarihB = b.aktif_fiyat_guncelleme ? new Date(b.aktif_fiyat_guncelleme).getTime() : 0;
          return direction * (tarihA - tarihB);
        default:
          return 0;
      }
    });
  }, [urunler, sortState]);

  // Toplu seçim işlemleri
  const handleTumunuSec = () => {
    if (seciliIds.size === sortedUrunler.length) {
      setSeciliIds(new Set());
    } else {
      setSeciliIds(new Set(sortedUrunler.map((u) => u.id)));
    }
  };

  const handleTekSecim = (id: number) => {
    setSeciliIds((prev) => {
      const yeni = new Set(prev);
      if (yeni.has(id)) {
        yeni.delete(id);
      } else {
        yeni.add(id);
      }
      return yeni;
    });
  };

  const handleSecimiTemizle = () => {
    setSeciliIds(new Set());
  };

  // Toplu AI Tahmini
  const handleTopluAiTahmini = async () => {
    if (!isAuthenticated || seciliIds.size === 0) return;

    setTopluIslemYapiliyor(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/fiyat-yonetimi/toplu/ai-tahmini`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urun_ids: Array.from(seciliIds) }),
      });

      const data = await res.json();

      if (data.success) {
        notifications.show({
          title: 'AI Tahmini Tamamlandı',
          message: `${data.data?.basarili || 0} ürün için fiyat tahmini yapıldı`,
          color: 'green',
        });
        fetchUrunler();
        setSeciliIds(new Set());
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      notifications.show({
        title: 'Hata',
        message: error.message || 'AI tahmini başarısız',
        color: 'red',
      });
    } finally {
      setTopluIslemYapiliyor(false);
    }
  };

  // Toplu Fiyat Yenileme
  const handleTopluYenileme = async () => {
    if (!isAuthenticated || seciliIds.size === 0) return;

    setTopluIslemYapiliyor(true);
    let basarili = 0;
    let hatali = 0;

    try {
      for (const id of seciliIds) {
        try {
          const res = await fetch(`${API_BASE_URL}/api/fiyat-yonetimi/urunler/${id}/hesapla`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
          });
          const data = await res.json();
          if (data.success) {
            basarili++;
          } else {
            hatali++;
          }
        } catch {
          hatali++;
        }
      }

      notifications.show({
        title: 'Fiyat Yenileme Tamamlandı',
        message: `${basarili} başarılı, ${hatali} hatalı`,
        color: hatali === 0 ? 'green' : 'yellow',
      });
      fetchUrunler();
      setSeciliIds(new Set());
    } catch (error: any) {
      notifications.show({ title: 'Hata', message: error.message, color: 'red' });
    } finally {
      setTopluIslemYapiliyor(false);
    }
  };

  // Seçili ürünleri export
  const handleSeciliExport = () => {
    const seciliUrunler = sortedUrunler.filter((u) => seciliIds.has(u.id));
    if (seciliUrunler.length === 0) return;

    const csvContent = toCSV(seciliUrunler, URUN_EXPORT_COLUMNS);
    const tarih = new Date().toISOString().split('T')[0];
    downloadCSV(csvContent, `secili-urunler-${tarih}.csv`);
    notifications.show({
      title: 'Export Başarılı',
      message: `${seciliUrunler.length} ürün CSV olarak indirildi`,
      color: 'green',
    });
  };

  const getGuvenColor = (guven: number) => {
    if (guven >= 80) return 'green';
    if (guven >= 50) return 'yellow';
    return 'red';
  };

  const getGuncellikBadge = (durum: string, gunFarki: number | null) => {
    switch (durum) {
      case 'guncel':
        return (
          <Badge color="green" size="sm">
            Güncel
          </Badge>
        );
      case 'eski':
        return (
          <Badge color="yellow" size="sm">
            {gunFarki} gün
          </Badge>
        );
      case 'cok_eski':
        return (
          <Badge color="red" size="sm">
            {gunFarki} gün
          </Badge>
        );
      case 'fiyat_yok':
        return (
          <Badge color="gray" size="sm" variant="outline">
            Fiyat Yok
          </Badge>
        );
      case 'belirsiz':
        return (
          <Badge color="gray" size="sm">
            Belirsiz
          </Badge>
        );
      default:
        return (
          <Badge color="gray" size="sm">
            -
          </Badge>
        );
    }
  };

  const getTipBadge = (tip: string | null) => {
    const colors: Record<string, string> = {
      SOZLESME: 'blue',
      FATURA: 'green',
      FATURA_ESKI: 'lime',
      PIYASA: 'cyan',
      MANUEL: 'orange',
      AI_TAHMINI: 'violet',
      VARSAYILAN: 'gray',
    };
    const labels: Record<string, string> = {
      SOZLESME: 'Sözleşme',
      FATURA: 'Fatura',
      FATURA_ESKI: 'Eski Fatura',
      PIYASA: 'Piyasa',
      MANUEL: 'Manuel',
      AI_TAHMINI: 'AI Tahmini',
      VARSAYILAN: 'Varsayılan',
    };
    return tip ? (
      <Badge
        color={colors[tip] || 'gray'}
        size="sm"
        variant="light"
        leftSection={tip === 'AI_TAHMINI' ? <IconRobot size={10} /> : undefined}
      >
        {labels[tip] || tip}
      </Badge>
    ) : null;
  };

  const formatFiyat = (fiyat: number | null, birim: string) => {
    if (!fiyat) return '-';
    return `${fiyat.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} /${birim}`;
  };

  const tumSeciliMi = sortedUrunler.length > 0 && seciliIds.size === sortedUrunler.length;
  const bazilariSeciliMi = seciliIds.size > 0 && seciliIds.size < sortedUrunler.length;

  const aktifFiltreSayisi = [kategoriId, tip, guncellik].filter(Boolean).length;

  return (
    <Stack gap="md">
      {/* Filtreler */}
      <Paper p="md" withBorder>
        <Stack gap="sm">
          {/* Arama satırı - her zaman görünür */}
          <Group>
            <TextInput
              placeholder="Ürün ara..."
              leftSection={<IconSearch size={16} />}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              style={{ flex: 1 }}
            />
            {isMobile && (
              <ActionIcon
                variant={aktifFiltreSayisi > 0 ? 'filled' : 'light'}
                onClick={toggleFiltreler}
                color={aktifFiltreSayisi > 0 ? 'blue' : undefined}
              >
                <IconAdjustments size={18} />
              </ActionIcon>
            )}
            <ActionIcon variant="light" onClick={fetchUrunler}>
              <IconRefresh size={18} />
            </ActionIcon>
          </Group>

          {/* Ek filtreler - mobilde collapse */}
          {isMobile ? (
            <Collapse in={filtrelerAcik}>
              <Stack gap="xs">
                <Select
                  placeholder="Kategori"
                  data={[
                    { value: '', label: 'Tüm Kategoriler' },
                    ...kategoriler.map((k) => ({
                      value: k.kategori_id.toString(),
                      label: `${k.kategori_ad} (${k.urun_sayisi})`,
                    })),
                  ]}
                  value={kategoriId}
                  onChange={(v) => {
                    setKategoriId(v || '');
                    setPage(1);
                  }}
                  clearable
                  size="sm"
                />
                <Group grow>
                  <Select
                    placeholder="Kaynak"
                    data={FIYAT_TIPLERI}
                    value={tip}
                    onChange={(v) => {
                      setTip(v || '');
                      setPage(1);
                    }}
                    clearable
                    size="sm"
                  />
                  <Select
                    placeholder="Güncellik"
                    data={GUNCELLIK_OPTIONS}
                    value={guncellik}
                    onChange={(v) => {
                      setGuncellik(v || '');
                      setPage(1);
                    }}
                    clearable
                    size="sm"
                  />
                </Group>
              </Stack>
            </Collapse>
          ) : (
            <Group>
              <Select
                placeholder="Kategori"
                data={[
                  { value: '', label: 'Tüm Kategoriler' },
                  ...kategoriler.map((k) => ({
                    value: k.kategori_id.toString(),
                    label: `${k.kategori_ad} (${k.urun_sayisi})`,
                  })),
                ]}
                value={kategoriId}
                onChange={(v) => {
                  setKategoriId(v || '');
                  setPage(1);
                }}
                clearable
                w={200}
              />
              <Select
                placeholder="Kaynak"
                data={FIYAT_TIPLERI}
                value={tip}
                onChange={(v) => {
                  setTip(v || '');
                  setPage(1);
                }}
                clearable
                w={150}
              />
              <Select
                placeholder="Güncellik"
                data={GUNCELLIK_OPTIONS}
                value={guncellik}
                onChange={(v) => {
                  setGuncellik(v || '');
                  setPage(1);
                }}
                clearable
                w={150}
              />
            </Group>
          )}
        </Stack>
      </Paper>

      {/* Toplu İşlem Bar */}
      {seciliIds.size > 0 && (
        <Paper p="sm" withBorder bg="blue.0">
          <Group justify="space-between">
            <Group gap="xs">
              <Badge size="lg" variant="filled">
                {seciliIds.size} ürün seçili
              </Badge>
              <Button variant="subtle" size="xs" leftSection={<IconX size={14} />} onClick={handleSecimiTemizle}>
                Seçimi Temizle
              </Button>
            </Group>
            <Group gap="xs">
              <Button
                variant="light"
                color="violet"
                size="xs"
                leftSection={<IconRobot size={14} />}
                onClick={handleTopluAiTahmini}
                loading={topluIslemYapiliyor}
              >
                AI Tahmini
              </Button>
              <Button
                variant="light"
                size="xs"
                leftSection={<IconRefresh size={14} />}
                onClick={handleTopluYenileme}
                loading={topluIslemYapiliyor}
              >
                Fiyat Yenile
              </Button>
              <Button variant="light" color="green" size="xs" leftSection={<IconDownload size={14} />} onClick={handleSeciliExport}>
                CSV İndir
              </Button>
            </Group>
          </Group>
        </Paper>
      )}

      {/* Tablo */}
      <Paper withBorder>
        {loading ? (
          <Stack p="md" gap="sm">
            {[...Array(10)].map((_, i) => (
              <Skeleton key={i} height={40} />
            ))}
          </Stack>
        ) : urunler.length > 0 ? (
          <ScrollArea>
          <Table striped highlightOnHover style={{ minWidth: isMobile ? 700 : undefined }}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={{ width: 40 }}>
                  <Checkbox
                    checked={tumSeciliMi}
                    indeterminate={bazilariSeciliMi}
                    onChange={handleTumunuSec}
                    aria-label="Tümünü seç"
                  />
                </Table.Th>
                <SortableTh sorted={sortState.field === 'ad'} reversed={sortState.direction === 'desc'} onSort={() => handleSort('ad')}>
                  Ürün
                </SortableTh>
                <SortableTh
                  sorted={sortState.field === 'kategori_ad'}
                  reversed={sortState.direction === 'desc'}
                  onSort={() => handleSort('kategori_ad')}
                >
                  Kategori
                </SortableTh>
                <SortableTh
                  sorted={sortState.field === 'aktif_fiyat'}
                  reversed={sortState.direction === 'desc'}
                  onSort={() => handleSort('aktif_fiyat')}
                  style={{ textAlign: 'right' }}
                >
                  Aktif Fiyat
                </SortableTh>
                <Table.Th>Kaynak</Table.Th>
                <SortableTh
                  sorted={sortState.field === 'aktif_fiyat_guven'}
                  reversed={sortState.direction === 'desc'}
                  onSort={() => handleSort('aktif_fiyat_guven')}
                >
                  Güven
                </SortableTh>
                <SortableTh
                  sorted={sortState.field === 'aktif_fiyat_guncelleme'}
                  reversed={sortState.direction === 'desc'}
                  onSort={() => handleSort('aktif_fiyat_guncelleme')}
                >
                  Güncellik
                </SortableTh>
                <Table.Th></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {sortedUrunler.map((urun) => (
                <Table.Tr
                  key={urun.id}
                  style={{ cursor: 'pointer', background: seciliIds.has(urun.id) ? 'var(--mantine-color-blue-0)' : undefined }}
                >
                  <Table.Td onClick={(e) => e.stopPropagation()}>
                    <Checkbox checked={seciliIds.has(urun.id)} onChange={() => handleTekSecim(urun.id)} />
                  </Table.Td>
                  <Table.Td onClick={() => onUrunSec(urun.id)}>
                    <div>
                      <Text size="sm" fw={500}>
                        {urun.ad}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {urun.kod}
                      </Text>
                    </div>
                  </Table.Td>
                  <Table.Td onClick={() => onUrunSec(urun.id)}>
                    <Text size="sm" c="dimmed">
                      {urun.kategori_ad || '-'}
                    </Text>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right' }} onClick={() => onUrunSec(urun.id)}>
                    <Group gap={4} justify="flex-end">
                      <IconCurrencyLira size={14} />
                      <Text size="sm" fw={500}>
                        {formatFiyat(urun.aktif_fiyat, urun.varsayilan_birim)}
                      </Text>
                    </Group>
                  </Table.Td>
                  <Table.Td onClick={() => onUrunSec(urun.id)}>{getTipBadge(urun.aktif_fiyat_tipi)}</Table.Td>
                  <Table.Td onClick={() => onUrunSec(urun.id)}>
                    <Tooltip label={`Güven: %${urun.aktif_fiyat_guven}`}>
                      <Progress value={urun.aktif_fiyat_guven} size="sm" color={getGuvenColor(urun.aktif_fiyat_guven)} w={60} />
                    </Tooltip>
                  </Table.Td>
                  <Table.Td onClick={() => onUrunSec(urun.id)}>{getGuncellikBadge(urun.guncellik_durumu, urun.gun_farki)}</Table.Td>
                  <Table.Td>
                    <ActionIcon
                      variant="subtle"
                      onClick={(e) => {
                        e.stopPropagation();
                        onUrunSec(urun.id);
                      }}
                    >
                      <IconEye size={18} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
          </ScrollArea>
        ) : (
          <Paper p="xl" ta="center">
            <Text c="dimmed">
              {search || kategoriId || tip || guncellik ? 'Filtrelere uygun ürün bulunamadı' : 'Henüz ürün kartı yok'}
            </Text>
          </Paper>
        )}
      </Paper>

      {/* Pagination ve bilgi */}
      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          {total} ürün
          {sortState.field &&
            ` (${sortState.field === 'ad' ? 'ada' : sortState.field === 'aktif_fiyat' ? 'fiyata' : sortState.field === 'aktif_fiyat_guven' ? 'güvene' : sortState.field === 'aktif_fiyat_guncelleme' ? 'tarihe' : 'kategoriye'} göre ${sortState.direction === 'asc' ? 'artan' : 'azalan'})`}
        </Text>
        {total > limit && <Pagination value={page} onChange={setPage} total={Math.ceil(total / limit)} />}
      </Group>
    </Stack>
  );
}
