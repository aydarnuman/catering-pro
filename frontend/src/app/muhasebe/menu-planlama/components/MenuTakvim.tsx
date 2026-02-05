'use client';

import {
  ActionIcon,
  Box,
  Button,
  Card,
  Divider,
  Group,
  Loader,
  NumberInput,
  Paper,
  Popover,
  ScrollArea,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconBuilding,
  IconCalendar,
  IconChevronLeft,
  IconChevronRight,
  IconCoffee,
  IconCopy,
  IconDeviceFloppy,
  IconMoon,
  IconPlus,
  IconSearch,
  IconSun,
  IconTrash,
  IconUsers,
  IconX,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { API_BASE_URL } from '@/lib/config';
import { formatMoney } from '@/lib/formatters';
import { useMenuPlanlama } from './MenuPlanlamaContext';

// Types
type PlanTipi = 'gunluk' | 'haftalik' | '15gunluk' | 'aylik';

interface TakvimHucre {
  tarih: Date;
  ogunTipiId: number;
  yemekler: Array<{
    id: string;
    ad: string;
    fiyat: number;
    ikon?: string;
  }>;
}

interface TakvimState {
  [key: string]: TakvimHucre; // key: "2026-02-15_ogle"
}

// Öğün bilgileri
const OGUNLER = [
  { id: 1, kod: 'kahvalti', ad: 'Kahvaltı', ikon: <IconCoffee size={16} />, renk: 'orange' },
  { id: 2, kod: 'ogle', ad: 'Öğle', ikon: <IconSun size={16} />, renk: 'yellow' },
  { id: 3, kod: 'aksam', ad: 'Akşam', ikon: <IconMoon size={16} />, renk: 'violet' },
];

// Tarih yardımcıları
const formatTarih = (tarih: Date) => tarih.toISOString().split('T')[0];
const formatGunAdi = (tarih: Date) => tarih.toLocaleDateString('tr-TR', { weekday: 'short' });
const formatGunNo = (tarih: Date) => tarih.getDate();
// Tarih aralığı oluştur
const getTarihAraligi = (baslangic: Date, tip: PlanTipi): Date[] => {
  const gunSayisi = {
    gunluk: 1,
    haftalik: 7,
    '15gunluk': 15,
    aylik: 30,
  }[tip];

  const tarihler: Date[] = [];
  for (let i = 0; i < gunSayisi; i++) {
    const tarih = new Date(baslangic);
    tarih.setDate(baslangic.getDate() + i);
    tarihler.push(tarih);
  }
  return tarihler;
};

// Hücre Kartı - Popover ile inline yemek seçimi
const HucreKart = ({
  hucre,
  ogun,
  tarih,
  isOpen,
  onToggle,
  onClear,
  onYemekEkle,
  receteler,
  recetelerLoading,
  aramaMetni,
  onAramaChange,
  seciliKategori,
  onKategoriChange,
}: {
  hucre?: TakvimHucre;
  ogun: (typeof OGUNLER)[0];
  tarih: Date;
  isOpen: boolean;
  onToggle: () => void;
  onClear: () => void;
  onYemekEkle: (yemek: any) => void;
  receteler: any[];
  recetelerLoading: boolean;
  aramaMetni: string;
  onAramaChange: (val: string) => void;
  seciliKategori: string;
  onKategoriChange: (kategori: string) => void;
}) => {
  const yemekSayisi = hucre?.yemekler?.length || 0;
  const toplamFiyat = hucre?.yemekler?.reduce((sum, y) => sum + y.fiyat, 0) || 0;

  return (
    <Popover
      opened={isOpen}
      onChange={(opened) => !opened && onToggle()}
      position="bottom"
      withArrow
      shadow="xl"
      width={420}
    >
      <Popover.Target>
        <Card
          p="xs"
          radius="sm"
          withBorder
          style={{
            background:
              yemekSayisi > 0
                ? `var(--mantine-color-${ogun.renk}-light)`
                : 'var(--mantine-color-dark-6)',
            borderColor: isOpen
              ? `var(--mantine-color-${ogun.renk}-6)`
              : yemekSayisi > 0
                ? `var(--mantine-color-${ogun.renk}-5)`
                : 'var(--mantine-color-dark-4)',
            minHeight: 80,
            cursor: 'pointer',
            transition: 'all 0.15s',
            boxShadow: isOpen ? `0 0 0 2px var(--mantine-color-${ogun.renk}-5)` : 'none',
          }}
          onClick={onToggle}
          onMouseEnter={(e) => {
            if (!isOpen) {
              e.currentTarget.style.borderColor = `var(--mantine-color-${ogun.renk}-5)`;
              e.currentTarget.style.transform = 'scale(1.02)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isOpen) {
              e.currentTarget.style.borderColor =
                yemekSayisi > 0
                  ? `var(--mantine-color-${ogun.renk}-5)`
                  : 'var(--mantine-color-dark-4)';
              e.currentTarget.style.transform = '';
            }
          }}
        >
          {yemekSayisi === 0 ? (
            <Stack align="center" justify="center" h={60} gap={4}>
              <IconPlus size={20} style={{ opacity: 0.5 }} />
              <Text size="xs" c="dimmed">
                Ekle
              </Text>
            </Stack>
          ) : (
            <Stack gap={4}>
              <Group justify="space-between" wrap="nowrap">
                <Text size="xs" fw={600} lineClamp={1}>
                  {yemekSayisi} yemek
                </Text>
                <ActionIcon
                  size="xs"
                  variant="subtle"
                  color="red"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClear();
                  }}
                >
                  <IconX size={12} />
                </ActionIcon>
              </Group>
              <Text size="10px" c="dimmed" lineClamp={2}>
                {hucre?.yemekler
                  ?.slice(0, 2)
                  .map((y) => y.ad)
                  .join(', ')}
                {yemekSayisi > 2 && '...'}
              </Text>
              <Text size="xs" fw={600} c={ogun.renk}>
                {formatMoney(toplamFiyat)}
              </Text>
            </Stack>
          )}
        </Card>
      </Popover.Target>

      <Popover.Dropdown p={0}>
        <Box>
          {/* Başlık */}
          <Group
            justify="space-between"
            p="xs"
            style={{
              borderBottom: '1px solid var(--mantine-color-dark-4)',
              background: 'var(--mantine-color-dark-7)',
            }}
          >
            <Group gap="xs">
              <ThemeIcon size="sm" color={ogun.renk} variant="light">
                {ogun.ikon}
              </ThemeIcon>
              <Text size="sm" fw={600}>
                {ogun.ad}
              </Text>
            </Group>
            <Text size="xs" c="dimmed">
              {tarih.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
            </Text>
          </Group>

          {/* 3 Kolonlu İçerik */}
          <Group gap={0} wrap="nowrap" align="stretch">
            {/* Sol Kolon - Kategoriler */}
            <Box
              style={{
                width: 70,
                borderRight: '1px solid var(--mantine-color-dark-4)',
                background: 'var(--mantine-color-dark-7)',
              }}
            >
              <Stack gap={0} p={4}>
                <Text size="9px" c="dimmed" ta="center" py={4}>
                  Kategori
                </Text>
                {[
                  { kod: '', ad: 'Tümü' },
                  { kod: 'corba', ad: 'Çorba' },
                  { kod: 'ana_yemek', ad: 'Ana' },
                  { kod: 'pilav_makarna', ad: 'Pilav' },
                  { kod: 'salata_meze', ad: 'Salata' },
                  { kod: 'tatli', ad: 'Tatlı' },
                ].map((kat) => (
                  <UnstyledButton
                    key={kat.kod}
                    onClick={() => onKategoriChange?.(kat.kod)}
                    style={{
                      padding: '4px 6px',
                      borderRadius: 4,
                      fontSize: 10,
                      background:
                        seciliKategori === kat.kod
                          ? `var(--mantine-color-${ogun.renk}-light)`
                          : 'transparent',
                      fontWeight: seciliKategori === kat.kod ? 600 : 400,
                    }}
                  >
                    {kat.ad}
                  </UnstyledButton>
                ))}
              </Stack>
            </Box>

            {/* Orta Kolon - Arama ve Liste */}
            <Box style={{ flex: 1, minWidth: 160 }}>
              <Box p="xs" style={{ borderBottom: '1px solid var(--mantine-color-dark-5)' }}>
                <TextInput
                  placeholder="Ara..."
                  size="xs"
                  leftSection={<IconSearch size={12} />}
                  value={aramaMetni}
                  onChange={(e) => onAramaChange(e.currentTarget.value)}
                  rightSection={
                    aramaMetni && (
                      <ActionIcon size="xs" variant="subtle" onClick={() => onAramaChange('')}>
                        <IconX size={10} />
                      </ActionIcon>
                    )
                  }
                  styles={{ input: { fontSize: 11 } }}
                />
              </Box>
              <ScrollArea.Autosize mah={220}>
                <Stack gap={0} p={4}>
                  {recetelerLoading ? (
                    <Stack align="center" py="md">
                      <Loader size="xs" />
                    </Stack>
                  ) : receteler?.length > 0 ? (
                    receteler.slice(0, 20).map((recete: any) => (
                      <UnstyledButton
                        key={recete.id}
                        onClick={() => onYemekEkle(recete)}
                        style={{
                          padding: '5px 8px',
                          borderRadius: 4,
                          transition: 'background 0.1s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = `var(--mantine-color-${ogun.renk}-light)`;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = '';
                        }}
                      >
                        <Group justify="space-between" wrap="nowrap" gap={4}>
                          <Text size="11px" lineClamp={1} style={{ flex: 1 }}>
                            {recete.ad}
                          </Text>
                          <Group gap={2} wrap="nowrap">
                            <Text size="10px" fw={600} c={ogun.renk}>
                              {formatMoney(recete.tahmini_maliyet || recete.porsiyon_maliyet || 0)}
                            </Text>
                            <IconPlus size={10} style={{ opacity: 0.5 }} />
                          </Group>
                        </Group>
                      </UnstyledButton>
                    ))
                  ) : (
                    <Text size="xs" c="dimmed" ta="center" py="md">
                      Sonuç yok
                    </Text>
                  )}
                </Stack>
              </ScrollArea.Autosize>
            </Box>

            {/* Sağ Kolon - Seçilenler */}
            <Box
              style={{
                width: 140,
                borderLeft: '1px solid var(--mantine-color-dark-4)',
                background: 'var(--mantine-color-dark-7)',
              }}
            >
              <Group
                justify="space-between"
                p={6}
                style={{ borderBottom: '1px solid var(--mantine-color-dark-5)' }}
              >
                <Text size="10px" fw={500}>
                  Seçilenler ({yemekSayisi})
                </Text>
                {yemekSayisi > 0 && (
                  <ActionIcon size="xs" color="red" variant="subtle" onClick={onClear}>
                    <IconTrash size={10} />
                  </ActionIcon>
                )}
              </Group>
              <ScrollArea.Autosize mah={180}>
                <Stack gap={2} p={6}>
                  {yemekSayisi === 0 ? (
                    <Text size="10px" c="dimmed" ta="center" py="md">
                      Henüz seçim yok
                    </Text>
                  ) : (
                    hucre?.yemekler?.map((y, i) => (
                      <Group key={y.id || i} justify="space-between" wrap="nowrap">
                        <Text size="10px" c="dimmed" lineClamp={1} style={{ flex: 1 }}>
                          {y.ad}
                        </Text>
                        <Text size="10px" fw={500} c={ogun.renk}>
                          {formatMoney(y.fiyat)}
                        </Text>
                      </Group>
                    ))
                  )}
                </Stack>
              </ScrollArea.Autosize>
              {yemekSayisi > 0 && (
                <Box
                  p={6}
                  style={{
                    borderTop: '1px solid var(--mantine-color-dark-5)',
                    background: 'var(--mantine-color-dark-6)',
                  }}
                >
                  <Group justify="space-between">
                    <Text size="10px" fw={600}>
                      Toplam:
                    </Text>
                    <Text size="11px" fw={700} c={ogun.renk}>
                      {formatMoney(toplamFiyat)}
                    </Text>
                  </Group>
                </Box>
              )}
            </Box>
          </Group>
        </Box>
      </Popover.Dropdown>
    </Popover>
  );
};

export function MenuTakvim() {
  const queryClient = useQueryClient();
  const { projeler } = useMenuPlanlama();

  // State
  const [selectedProjeId, setSelectedProjeId] = useState<number | null>(null);
  const [planTipi, setPlanTipi] = useState<PlanTipi>('haftalik');
  const [baslangicTarihi, setBaslangicTarihi] = useState<Date>(new Date());
  const [kisiSayisi, setKisiSayisi] = useState(500);
  const [takvimState, setTakvimState] = useState<TakvimState>({});

  // Popover state - hangi hücre açık
  const [aktifHucreKey, setAktifHucreKey] = useState<string | null>(null);
  const [aramaMetni, setAramaMetni] = useState('');
  const [seciliKategori, setSeciliKategori] = useState('');
  const [debouncedArama] = useDebouncedValue(aramaMetni, 300);

  // Öğün tipine göre kategori eşleştirmesi
  const getKategorilerByOgun = (ogunKod: string): string[] => {
    switch (ogunKod) {
      case 'kahvalti':
        return ['kahvaltilik', 'kahvalti_paketi'];
      case 'ogle':
      case 'aksam':
        return ['ana_yemek', 'corba', 'pilav_makarna', 'salata_meze', 'tatli'];
      default:
        return [];
    }
  };

  // Aktif öğün kodunu al (popover açıkken)
  const aktifOgunKod = aktifHucreKey?.split('_')[1] || null;

  // Reçeteleri çek - kategori ve aramaya göre filtrelenmiş
  const { data: recetelerData, isLoading: recetelerLoading } = useQuery({
    queryKey: ['receteler-takvim', debouncedArama, seciliKategori, aktifOgunKod],
    queryFn: async () => {
      const params = new URLSearchParams();

      // Arama varsa arama ile filtrele
      if (debouncedArama) {
        params.set('arama', debouncedArama);
      }

      // Kategori seçilmişse kategori ile filtrele
      if (seciliKategori) {
        params.set('kategori', seciliKategori);
      }
      // Kategori seçilmemişse ve öğün tipi varsa varsayılan kategorileri kullan
      else if (aktifOgunKod && !debouncedArama) {
        const kategoriler = getKategorilerByOgun(aktifOgunKod);
        if (kategoriler.length > 0) {
          params.set('kategori', kategoriler[0]);
        }
      }

      params.set('limit', '50');
      const res = await fetch(`${API_BASE_URL}/api/menu-planlama/receteler?${params}`);
      const data = await res.json();
      return data.success ? data.data : [];
    },
    staleTime: 30000,
    enabled: !!aktifHucreKey, // Sadece popover açıkken çalıştır
  });

  // Tarih aralığı
  const tarihler = useMemo(
    () => getTarihAraligi(baslangicTarihi, planTipi),
    [baslangicTarihi, planTipi]
  );

  // Hücre key oluştur
  const getHucreKey = (tarih: Date, ogunKod: string) => `${formatTarih(tarih)}_${ogunKod}`;

  // Popover toggle
  const handlePopoverToggle = (key: string) => {
    if (aktifHucreKey === key) {
      setAktifHucreKey(null);
      setAramaMetni('');
      setSeciliKategori('');
    } else {
      setAktifHucreKey(key);
      setAramaMetni('');
      setSeciliKategori('');
    }
  };

  // Hücre temizle
  const handleHucreClear = (tarih: Date, ogunKod: string) => {
    const key = getHucreKey(tarih, ogunKod);
    setTakvimState((prev) => {
      const yeni = { ...prev };
      delete yeni[key];
      return yeni;
    });
  };

  // Tek yemek doğrudan hücreye ekle
  const handleYemekEkle = (
    tarih: Date,
    ogun: (typeof OGUNLER)[0],
    yemek: {
      id: number;
      ad: string;
      tahmini_maliyet?: number;
      porsiyon_maliyet?: number;
      kategori_ikon?: string;
    }
  ) => {
    const key = getHucreKey(tarih, ogun.kod);
    const fiyat = parseFloat(String(yemek.tahmini_maliyet || yemek.porsiyon_maliyet || 0));

    setTakvimState((prev) => {
      const mevcut = prev[key]?.yemekler || [];
      return {
        ...prev,
        [key]: {
          tarih,
          ogunTipiId: ogun.id,
          yemekler: [
            ...mevcut,
            {
              id: `recete-${yemek.id}-${Date.now()}`,
              ad: yemek.ad,
              fiyat,
              ikon: yemek.kategori_ikon || '🍽️',
            },
          ],
        },
      };
    });

    notifications.show({
      title: 'Eklendi',
      message: `${yemek.ad} eklendi`,
      color: 'green',
    });
  };

  // Günü kopyala
  const handleGunuKopyala = (kaynakTarih: Date) => {
    const kaynakYemekler: Record<string, TakvimHucre> = {};
    OGUNLER.forEach((ogun) => {
      const key = getHucreKey(kaynakTarih, ogun.kod);
      if (takvimState[key]) {
        kaynakYemekler[ogun.kod] = takvimState[key];
      }
    });

    if (Object.keys(kaynakYemekler).length === 0) {
      notifications.show({
        title: 'Uyarı',
        message: 'Kopyalanacak yemek yok',
        color: 'yellow',
      });
      return;
    }

    // Sonraki güne kopyala
    const hedefTarih = new Date(kaynakTarih);
    hedefTarih.setDate(hedefTarih.getDate() + 1);

    if (hedefTarih > tarihler[tarihler.length - 1]) {
      notifications.show({
        title: 'Uyarı',
        message: 'Hedef tarih plan aralığı dışında',
        color: 'yellow',
      });
      return;
    }

    setTakvimState((prev) => {
      const yeni = { ...prev };
      OGUNLER.forEach((ogun) => {
        if (kaynakYemekler[ogun.kod]) {
          const hedefKey = getHucreKey(hedefTarih, ogun.kod);
          yeni[hedefKey] = {
            ...kaynakYemekler[ogun.kod],
            tarih: hedefTarih,
          };
        }
      });
      return yeni;
    });

    notifications.show({
      title: 'Kopyalandı',
      message: `Yemekler ${hedefTarih.toLocaleDateString('tr-TR')} tarihine kopyalandı`,
      color: 'green',
    });
  };

  // Toplam maliyet hesapla
  const toplamMaliyet = useMemo(() => {
    return Object.values(takvimState).reduce((sum, hucre) => {
      return sum + hucre.yemekler.reduce((s, y) => s + y.fiyat, 0);
    }, 0);
  }, [takvimState]);

  // Dolu gün sayısı
  const doluGunSayisi = useMemo(() => {
    const gunler = new Set<string>();
    Object.keys(takvimState).forEach((key) => {
      const tarih = key.split('_')[0];
      gunler.add(tarih);
    });
    return gunler.size;
  }, [takvimState]);

  // Planı kaydet
  const savePlanMutation = useMutation({
    mutationFn: async () => {
      if (!selectedProjeId) throw new Error('Proje seçiniz');
      if (Object.keys(takvimState).length === 0) throw new Error('En az bir öğün ekleyin');

      const tarihStr = formatTarih(baslangicTarihi);
      const bitisTarihStr = formatTarih(tarihler[tarihler.length - 1]);

      // Plan oluştur
      const planRes = await fetch(`${API_BASE_URL}/api/menu-planlama/menu-planlari`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proje_id: selectedProjeId,
          ad: `${planTipi === 'haftalik' ? 'Haftalık' : planTipi === '15gunluk' ? '15 Günlük' : planTipi === 'aylik' ? 'Aylık' : 'Günlük'} Menü - ${tarihStr}`,
          tip: planTipi === '15gunluk' ? 'haftalik' : planTipi,
          baslangic_tarihi: tarihStr,
          bitis_tarihi: bitisTarihStr,
          varsayilan_kisi_sayisi: kisiSayisi,
        }),
      });
      const planData = await planRes.json();
      if (!planData.success) throw new Error(planData.error);
      const planId = planData.data.id;

      // Her hücre için öğün ve yemek ekle
      for (const [key, hucre] of Object.entries(takvimState)) {
        const [tarih, ogunKod] = key.split('_');
        const ogun = OGUNLER.find((o) => o.kod === ogunKod);
        if (!ogun || hucre.yemekler.length === 0) continue;

        // Öğün ekle
        const ogunRes = await fetch(
          `${API_BASE_URL}/api/menu-planlama/menu-planlari/${planId}/ogunler`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tarih,
              ogun_tipi_id: ogun.id,
              kisi_sayisi: kisiSayisi,
            }),
          }
        );
        const ogunData = await ogunRes.json();
        if (!ogunData.success) continue;
        const ogunId = ogunData.data.id;

        // Yemekleri ekle
        for (let i = 0; i < hucre.yemekler.length; i++) {
          const yemek = hucre.yemekler[i];
          await fetch(`${API_BASE_URL}/api/menu-planlama/ogunler/${ogunId}/yemekler`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              recete_adi: yemek.ad,
              sira: i + 1,
              porsiyon_maliyet: yemek.fiyat,
            }),
          });
        }
      }

      return planId;
    },
    onSuccess: () => {
      notifications.show({
        title: 'Başarılı',
        message: 'Menü planı kaydedildi',
        color: 'green',
      });
      setTakvimState({});
      queryClient.invalidateQueries({ queryKey: ['kaydedilen-menuler'] });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Hata',
        message: error.message,
        color: 'red',
      });
    },
  });

  // Proje seçenekleri
  const projeOptions = projeler.map((p) => ({
    value: String(p.id),
    label: `${p.ad}${p.musteri ? ` - ${p.musteri}` : ''}`,
  }));

  return (
    <Stack gap="md">
      {/* Başlık ve Ayarlar */}
      <Paper p="md" radius="md" withBorder>
        <Stack gap="md">
          <Group justify="space-between" wrap="wrap">
            <Group gap="md">
              <ThemeIcon size="lg" color="indigo" variant="light">
                <IconCalendar size={20} />
              </ThemeIcon>
              <Box>
                <Title order={4}>Menü Planlama Takvimi</Title>
                <Text size="xs" c="dimmed">
                  Günlük, haftalık veya aylık menü planı oluşturun
                </Text>
              </Box>
            </Group>

            <Button
              variant="gradient"
              gradient={{ from: 'indigo', to: 'cyan' }}
              leftSection={<IconDeviceFloppy size={16} />}
              onClick={() => savePlanMutation.mutate()}
              loading={savePlanMutation.isPending}
              disabled={!selectedProjeId || Object.keys(takvimState).length === 0}
            >
              Planı Kaydet
            </Button>
          </Group>

          <Divider />

          <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
            {/* Proje Seçimi */}
            <Select
              label="Proje / Şantiye"
              placeholder="Seçin..."
              data={projeOptions}
              value={selectedProjeId ? String(selectedProjeId) : null}
              onChange={(val) => setSelectedProjeId(val ? parseInt(val, 10) : null)}
              searchable
              leftSection={<IconBuilding size={16} />}
            />

            {/* Plan Tipi */}
            <Box>
              <Text size="sm" fw={500} mb={4}>
                Plan Tipi
              </Text>
              <SegmentedControl
                fullWidth
                value={planTipi}
                onChange={(val) => setPlanTipi(val as PlanTipi)}
                data={[
                  { label: 'Günlük', value: 'gunluk' },
                  { label: 'Haftalık', value: 'haftalik' },
                  { label: '15 Gün', value: '15gunluk' },
                  { label: 'Aylık', value: 'aylik' },
                ]}
              />
            </Box>

            {/* Başlangıç Tarihi - Plan tipine göre atlama */}
            <Box>
              <Text size="sm" fw={500} mb={4}>
                Başlangıç
              </Text>
              <Group gap="xs">
                <Tooltip
                  label={
                    planTipi === 'gunluk'
                      ? '1 gün geri'
                      : planTipi === 'haftalik'
                        ? '1 hafta geri'
                        : planTipi === '15gunluk'
                          ? '15 gün geri'
                          : '1 ay geri'
                  }
                >
                  <ActionIcon
                    variant="light"
                    color="gray"
                    onClick={() => {
                      const yeniTarih = new Date(baslangicTarihi);
                      const atlamaMiktari =
                        planTipi === 'gunluk'
                          ? 1
                          : planTipi === 'haftalik'
                            ? 7
                            : planTipi === '15gunluk'
                              ? 15
                              : 30;
                      yeniTarih.setDate(yeniTarih.getDate() - atlamaMiktari);
                      setBaslangicTarihi(yeniTarih);
                    }}
                  >
                    <IconChevronLeft size={16} />
                  </ActionIcon>
                </Tooltip>
                <TextInput
                  value={baslangicTarihi.toISOString().split('T')[0]}
                  onChange={(e) => {
                    const yeniTarih = new Date(e.currentTarget.value);
                    if (!Number.isNaN(yeniTarih.getTime())) {
                      setBaslangicTarihi(yeniTarih);
                    }
                  }}
                  type="date"
                  size="sm"
                  style={{ flex: 1 }}
                  styles={{
                    input: {
                      textAlign: 'center',
                      fontWeight: 500,
                    },
                  }}
                />
                <Tooltip
                  label={
                    planTipi === 'gunluk'
                      ? '1 gün ileri'
                      : planTipi === 'haftalik'
                        ? '1 hafta ileri'
                        : planTipi === '15gunluk'
                          ? '15 gün ileri'
                          : '1 ay ileri'
                  }
                >
                  <ActionIcon
                    variant="light"
                    color="gray"
                    onClick={() => {
                      const yeniTarih = new Date(baslangicTarihi);
                      const atlamaMiktari =
                        planTipi === 'gunluk'
                          ? 1
                          : planTipi === 'haftalik'
                            ? 7
                            : planTipi === '15gunluk'
                              ? 15
                              : 30;
                      yeniTarih.setDate(yeniTarih.getDate() + atlamaMiktari);
                      setBaslangicTarihi(yeniTarih);
                    }}
                  >
                    <IconChevronRight size={16} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="Bugün">
                  <ActionIcon
                    variant="light"
                    color="blue"
                    onClick={() => setBaslangicTarihi(new Date())}
                  >
                    <IconCalendar size={16} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </Box>

            {/* Kişi Sayısı */}
            <NumberInput
              label="Kişi Sayısı"
              value={kisiSayisi}
              onChange={(val) => setKisiSayisi(Number(val) || 1)}
              min={1}
              max={10000}
              leftSection={<IconUsers size={16} />}
              thousandSeparator=" "
            />
          </SimpleGrid>
        </Stack>
      </Paper>

      {/* Takvim Grid */}
      <Paper p="md" radius="md" withBorder>
        <ScrollArea>
          <Box style={{ minWidth: planTipi === 'gunluk' ? 200 : 600 }}>
            {/* Tarih Başlıkları */}
            <Group gap={0} wrap="nowrap" mb="sm">
              <Box w={80} /> {/* Öğün kolonu için boşluk */}
              {tarihler.map((tarih) => (
                <Box
                  key={formatTarih(tarih)}
                  style={{
                    flex: 1,
                    minWidth: 100,
                    textAlign: 'center',
                  }}
                >
                  <Text size="xs" c="dimmed">
                    {formatGunAdi(tarih)}
                  </Text>
                  <Text fw={600}>{formatGunNo(tarih)}</Text>
                  <Tooltip label="Sonraki güne kopyala">
                    <ActionIcon
                      size="xs"
                      variant="subtle"
                      color="gray"
                      onClick={() => handleGunuKopyala(tarih)}
                    >
                      <IconCopy size={12} />
                    </ActionIcon>
                  </Tooltip>
                </Box>
              ))}
            </Group>

            {/* Öğün Satırları */}
            {OGUNLER.map((ogun) => (
              <Group key={ogun.kod} gap={0} wrap="nowrap" mb="xs">
                {/* Öğün Etiketi */}
                <Box w={80}>
                  <Group gap={4}>
                    <ThemeIcon size="sm" color={ogun.renk} variant="light">
                      {ogun.ikon}
                    </ThemeIcon>
                    <Text size="xs" fw={500}>
                      {ogun.ad}
                    </Text>
                  </Group>
                </Box>

                {/* Hücreler */}
                {tarihler.map((tarih) => {
                  const key = getHucreKey(tarih, ogun.kod);
                  return (
                    <Box key={key} style={{ flex: 1, minWidth: 100, padding: '0 4px' }}>
                      <HucreKart
                        hucre={takvimState[key]}
                        ogun={ogun}
                        tarih={tarih}
                        isOpen={aktifHucreKey === key}
                        onToggle={() => handlePopoverToggle(key)}
                        onClear={() => handleHucreClear(tarih, ogun.kod)}
                        onYemekEkle={(yemek) => handleYemekEkle(tarih, ogun, yemek)}
                        receteler={recetelerData || []}
                        recetelerLoading={recetelerLoading}
                        aramaMetni={aramaMetni}
                        onAramaChange={setAramaMetni}
                        seciliKategori={seciliKategori}
                        onKategoriChange={setSeciliKategori}
                      />
                    </Box>
                  );
                })}
              </Group>
            ))}
          </Box>
        </ScrollArea>
      </Paper>

      {/* Özet Panel */}
      <Paper p="md" radius="md" withBorder>
        <Group justify="space-between" wrap="wrap">
          <Group gap="xl">
            <Box>
              <Text size="xs" c="dimmed">
                Dolu Gün
              </Text>
              <Text fw={700} size="xl">
                {doluGunSayisi} / {tarihler.length}
              </Text>
            </Box>
            <Box>
              <Text size="xs" c="dimmed">
                Toplam Öğün
              </Text>
              <Text fw={700} size="xl">
                {Object.keys(takvimState).length}
              </Text>
            </Box>
            <Box>
              <Text size="xs" c="dimmed">
                Porsiyon Maliyeti
              </Text>
              <Text fw={700} size="xl" c="teal">
                {formatMoney(toplamMaliyet)}
              </Text>
            </Box>
          </Group>
          <Box>
            <Text size="xs" c="dimmed">
              {kisiSayisi.toLocaleString('tr-TR')} Kişilik Toplam
            </Text>
            <Text fw={700} size="xl" c="teal">
              {formatMoney(toplamMaliyet * kisiSayisi)}
            </Text>
          </Box>
        </Group>
      </Paper>
    </Stack>
  );
}
