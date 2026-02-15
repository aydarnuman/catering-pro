'use client';

import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Divider,
  Grid,
  Group,
  Modal,
  Paper,
  ScrollArea,
  SegmentedControl,
  Select,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  UnstyledButton,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconMinus, IconPlus, IconSearch, IconSwitchHorizontal, IconX } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { menuPlanlamaAPI } from '@/lib/api/services/menu-planlama';
import { formatMoney } from '@/lib/formatters';
import { useMenuPlanlama } from './MenuPlanlamaContext';
import { ETLI_KATEGORILER, ETSIZ_KATEGORILER, type ReceteKategori } from './types';

// ─── Tipler ─────────────────────────────────────────────────

interface DailyMenuMeal {
  id: number;
  ad: string;
  fiyat: number;
  kategoriKod: string;
  ikon: string;
}

interface EtsizAlternatif {
  etliId: number;
  etsizId: number;
  etsizAd: string;
  etsizFiyat: number;
  etsizIkon: string;
}

const OGUN_SECENEKLERI = [
  { value: 'kahvalti', label: '☀️ Kahvaltı' },
  { value: 'ogle', label: '🌞 Öğle Yemeği' },
  { value: 'aksam', label: '🌙 Akşam Yemeği' },
  { value: 'diyet', label: '🥗 Diyet' },
];

const OGUN_ID_MAP: Record<string, number> = {
  kahvalti: 1,
  ogle: 2,
  aksam: 3,
  diyet: 2, // Diyet öğünü backend'de öğle tipi olarak kaydedilir
};

interface HizliGunlukMenuModalProps {
  opened: boolean;
  onClose: () => void;
  editData?: {
    planId: number;
    ad: string;
    ogunKod: string;
    yemekler: DailyMenuMeal[];
  } | null;
}

export function HizliGunlukMenuModal({ opened, onClose, editData }: HizliGunlukMenuModalProps) {
  const { refetchMenuler } = useMenuPlanlama();
  const queryClient = useQueryClient();

  // Reçete verisini TanStack Query cache'den al (page.tsx'te zaten yükleniyor)
  const receteKategorileri = queryClient.getQueryData<ReceteKategori[]>(['recete-kategorileri']) ?? [];

  // State
  const [menuAdi, setMenuAdi] = useState(editData?.ad || '');
  const [ogunKod, setOgunKod] = useState(editData?.ogunKod || 'ogle');
  const [seciliYemekler, setSeciliYemekler] = useState<DailyMenuMeal[]>(editData?.yemekler || []);
  const [alternatifler, setAlternatifler] = useState<EtsizAlternatif[]>([]);
  const [arama, setArama] = useState('');
  const [kategoriFiltre, setKategoriFiltre] = useState('');

  // Modal açılınca state'i sıfırla
  const resetState = useCallback(() => {
    setMenuAdi(editData?.ad || '');
    setOgunKod(editData?.ogunKod || 'ogle');
    setSeciliYemekler(editData?.yemekler || []);
    setAlternatifler([]);
    setArama('');
    setKategoriFiltre('');
  }, [editData]);

  // Toplam maliyet
  const toplamMaliyet = useMemo(() => seciliYemekler.reduce((sum, y) => sum + y.fiyat, 0), [seciliYemekler]);

  // Filtrelenmiş reçete listesi
  const filtrelenmisReceteler = useMemo(() => {
    const aramaLower = arama.toLowerCase();
    return (receteKategorileri ?? [])
      .filter((k) => !kategoriFiltre || k.kod === kategoriFiltre)
      .flatMap((k) =>
        (k.yemekler ?? [])
          .filter((y) => !aramaLower || y.ad.toLowerCase().includes(aramaLower))
          .map((y) => ({
            id: y.id,
            ad: y.ad,
            fiyat: y.fiyat || 0,
            kategoriKod: k.kod,
            ikon: k.ikon,
          }))
      );
  }, [receteKategorileri, arama, kategoriFiltre]);

  // Etsiz alternatif seçenekleri
  const etsizSecenekler = useMemo(() => {
    return (receteKategorileri ?? [])
      .filter((k) => ETSIZ_KATEGORILER.includes(k.kod))
      .flatMap((k) =>
        (k.yemekler ?? []).map((y) => ({
          id: y.id,
          ad: y.ad,
          fiyat: y.fiyat || 0,
          ikon: k.ikon,
        }))
      );
  }, [receteKategorileri]);

  // Yemek ekle
  const yemekEkle = useCallback((yemek: DailyMenuMeal) => {
    setSeciliYemekler((prev) => {
      if (prev.some((y) => y.id === yemek.id)) return prev;
      return [...prev, yemek];
    });
  }, []);

  // Yemek çıkar
  const yemekCikar = useCallback((id: number) => {
    setSeciliYemekler((prev) => prev.filter((y) => y.id !== id));
    setAlternatifler((prev) => prev.filter((a) => a.etliId !== id));
  }, []);

  // Etsiz alternatif seç
  const alternatifSec = useCallback(
    (etliId: number, etsizId: number) => {
      const etsiz = etsizSecenekler.find((y) => y.id === etsizId);
      if (!etsiz) return;
      setAlternatifler((prev) => {
        const filtered = prev.filter((a) => a.etliId !== etliId);
        return [...filtered, { etliId, etsizId, etsizAd: etsiz.ad, etsizFiyat: etsiz.fiyat, etsizIkon: etsiz.ikon }];
      });
    },
    [etsizSecenekler]
  );

  // Alternatif kaldır
  const alternatifKaldir = useCallback((etliId: number) => {
    setAlternatifler((prev) => prev.filter((a) => a.etliId !== etliId));
  }, []);

  // Kaydet
  const saveMutation = useMutation({
    mutationFn: async () => {
      const bugun = new Date().toISOString().split('T')[0];
      const ogunAd = OGUN_SECENEKLERI.find((o) => o.value === ogunKod)?.label.replace(/^[^\s]+ /, '') || 'Öğle Yemeği';
      const ad = menuAdi.trim() || `${ogunAd} - ${bugun}`;

      return menuPlanlamaAPI.saveFullPlan({
        proje_id: null,
        ad,
        tip: 'gunluk',
        baslangic_tarihi: bugun,
        bitis_tarihi: bugun,
        varsayilan_kisi_sayisi: 1,
        ogunler: [
          {
            tarih: bugun,
            ogun_tipi_id: OGUN_ID_MAP[ogunKod] || 2,
            kisi_sayisi: 1,
            yemekler: seciliYemekler.map((y) => ({
              recete_id: y.id,
              ad: y.ad,
              fiyat: y.fiyat,
            })),
          },
        ],
      });
    },
    onSuccess: () => {
      notifications.show({ title: 'Kaydedildi', message: 'Günlük menü oluşturuldu', color: 'teal' });
      refetchMenuler();
      onClose();
      resetState();
    },
    onError: () => {
      notifications.show({ title: 'Hata', message: 'Menü kaydedilemedi', color: 'red' });
    },
  });

  return (
    <Modal
      opened={opened}
      onClose={() => {
        onClose();
        resetState();
      }}
      title={
        <Group gap="xs">
          <Text fw={700}>Hızlı Günlük Menü</Text>
        </Group>
      }
      size="xl"
      padding="md"
    >
      <Stack gap="md">
        {/* Üst kısım: menü adı + öğün seçimi */}
        <Group grow gap="md">
          <TextInput
            placeholder="Menü adı (opsiyonel)"
            value={menuAdi}
            onChange={(e) => setMenuAdi(e.currentTarget.value)}
            size="sm"
          />
          <SegmentedControl value={ogunKod} onChange={setOgunKod} size="xs" data={OGUN_SECENEKLERI} />
        </Group>

        <Divider />

        {/* Ana içerik: sol (seçilenler) + sağ (katalog) */}
        <Grid gutter="md">
          {/* Sol panel: Seçilen yemekler */}
          <Grid.Col span={{ base: 12, sm: 5 }}>
            <Stack gap="xs">
              <Text size="sm" fw={600} c="dimmed">
                Seçilen Yemekler ({seciliYemekler.length})
              </Text>

              {seciliYemekler.length === 0 ? (
                <Paper p="md" withBorder style={{ borderStyle: 'dashed' }}>
                  <Text size="xs" c="dimmed" ta="center">
                    Sağdaki katalogdan yemek ekleyin
                  </Text>
                </Paper>
              ) : (
                <ScrollArea h={350} offsetScrollbars>
                  <Stack gap={6}>
                    {seciliYemekler.map((yemek) => {
                      const isEtli = ETLI_KATEGORILER.includes(yemek.kategoriKod);
                      const alternatif = alternatifler.find((a) => a.etliId === yemek.id);

                      return (
                        <Box key={yemek.id}>
                          <Paper p="xs" radius="sm" withBorder>
                            <Group justify="space-between" wrap="nowrap">
                              <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
                                <Text size="sm">{yemek.ikon}</Text>
                                <Text size="xs" fw={500} lineClamp={1}>
                                  {yemek.ad}
                                </Text>
                              </Group>
                              <Group gap={4} wrap="nowrap">
                                <Text size="xs" fw={600} c="teal">
                                  {formatMoney(yemek.fiyat)}
                                </Text>
                                <ActionIcon size="xs" variant="subtle" color="red" onClick={() => yemekCikar(yemek.id)}>
                                  <IconX size={12} />
                                </ActionIcon>
                              </Group>
                            </Group>

                            {/* Etli ise: etsiz alternatif butonu */}
                            {isEtli && !alternatif && (
                              <Box mt={4}>
                                <Select
                                  size="xs"
                                  placeholder="🔄 Etsiz alternatif seç..."
                                  data={etsizSecenekler.map((y) => ({
                                    value: String(y.id),
                                    label: `${y.ikon} ${y.ad} — ${formatMoney(y.fiyat)}`,
                                  }))}
                                  onChange={(val) => val && alternatifSec(yemek.id, Number(val))}
                                  searchable
                                  clearable
                                  maxDropdownHeight={200}
                                />
                              </Box>
                            )}
                          </Paper>

                          {/* Etli/Etsiz karşılaştırma */}
                          {alternatif && (
                            <Paper
                              p="xs"
                              radius="sm"
                              withBorder
                              ml="md"
                              mt={4}
                              style={{ background: 'var(--mantine-color-dark-6)' }}
                            >
                              <Group justify="space-between" wrap="nowrap" mb={4}>
                                <Text size="xs" fw={600} c="dimmed">
                                  <IconSwitchHorizontal size={12} style={{ verticalAlign: 'middle' }} /> Karşılaştırma
                                </Text>
                                <ActionIcon
                                  size="xs"
                                  variant="subtle"
                                  color="gray"
                                  onClick={() => alternatifKaldir(yemek.id)}
                                >
                                  <IconX size={10} />
                                </ActionIcon>
                              </Group>
                              <Stack gap={2}>
                                <Group justify="space-between">
                                  <Text size="xs">🥩 {yemek.ad}</Text>
                                  <Text size="xs" fw={600}>
                                    {formatMoney(yemek.fiyat)}
                                  </Text>
                                </Group>
                                <Group justify="space-between">
                                  <Text size="xs">
                                    {alternatif.etsizIkon} {alternatif.etsizAd}
                                  </Text>
                                  <Text size="xs" fw={600}>
                                    {formatMoney(alternatif.etsizFiyat)}
                                  </Text>
                                </Group>
                                <Divider my={2} />
                                <Group justify="space-between">
                                  <Text size="xs" c="dimmed">
                                    Fark
                                  </Text>
                                  <Text size="xs" fw={700} c={alternatif.etsizFiyat < yemek.fiyat ? 'green' : 'red'}>
                                    {alternatif.etsizFiyat < yemek.fiyat ? '↓' : '↑'}{' '}
                                    {formatMoney(Math.abs(yemek.fiyat - alternatif.etsizFiyat))}
                                    {yemek.fiyat > 0 && (
                                      <Text span size="xs" c="dimmed">
                                        {' '}
                                        (%
                                        {Math.round(
                                          (Math.abs(yemek.fiyat - alternatif.etsizFiyat) / yemek.fiyat) * 100
                                        )}
                                        )
                                      </Text>
                                    )}
                                  </Text>
                                </Group>
                              </Stack>
                            </Paper>
                          )}
                        </Box>
                      );
                    })}
                  </Stack>
                </ScrollArea>
              )}

              {/* Toplam maliyet */}
              {seciliYemekler.length > 0 && (
                <Paper p="xs" radius="sm" style={{ background: 'var(--mantine-color-dark-6)' }}>
                  <Group justify="space-between">
                    <Text size="sm" fw={600}>
                      Toplam
                    </Text>
                    <Text size="sm" fw={700} c="teal">
                      {formatMoney(toplamMaliyet)}
                    </Text>
                  </Group>
                </Paper>
              )}
            </Stack>
          </Grid.Col>

          {/* Sağ panel: Reçete kataloğu */}
          <Grid.Col span={{ base: 12, sm: 7 }}>
            <Stack gap="xs">
              <Text size="sm" fw={600} c="dimmed">
                Reçete Kataloğu
              </Text>

              <TextInput
                placeholder="Yemek ara..."
                leftSection={<IconSearch size={14} />}
                value={arama}
                onChange={(e) => setArama(e.currentTarget.value)}
                size="xs"
              />

              {/* Kategori filtreleri */}
              <ScrollArea type="never">
                <Group gap={4} wrap="nowrap">
                  <Badge
                    size="sm"
                    variant={!kategoriFiltre ? 'filled' : 'light'}
                    color="gray"
                    style={{ cursor: 'pointer', flexShrink: 0 }}
                    onClick={() => setKategoriFiltre('')}
                  >
                    Tümü
                  </Badge>
                  {receteKategorileri.map((k) => (
                    <Badge
                      key={k.kod}
                      size="sm"
                      variant={kategoriFiltre === k.kod ? 'filled' : 'light'}
                      color={k.renk || 'gray'}
                      style={{ cursor: 'pointer', flexShrink: 0 }}
                      onClick={() => setKategoriFiltre(k.kod === kategoriFiltre ? '' : k.kod)}
                    >
                      {k.ikon} {k.ad}
                    </Badge>
                  ))}
                </Group>
              </ScrollArea>

              {/* Reçete listesi */}
              <ScrollArea h={330} offsetScrollbars>
                <Stack gap={4}>
                  {filtrelenmisReceteler.length === 0 ? (
                    <Text size="xs" c="dimmed" ta="center" py="md">
                      Sonuç bulunamadı
                    </Text>
                  ) : (
                    filtrelenmisReceteler.map((recete) => {
                      const zatenEklendi = seciliYemekler.some((y) => y.id === recete.id);

                      return (
                        <UnstyledButton
                          key={recete.id}
                          onClick={() => !zatenEklendi && yemekEkle(recete)}
                          style={{
                            opacity: zatenEklendi ? 0.5 : 1,
                            cursor: zatenEklendi ? 'default' : 'pointer',
                          }}
                        >
                          <Paper p={6} radius="sm" withBorder>
                            <Group justify="space-between" wrap="nowrap">
                              <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
                                <Text size="sm">{recete.ikon}</Text>
                                <Text size="xs" lineClamp={1}>
                                  {recete.ad}
                                </Text>
                              </Group>
                              <Group gap={6} wrap="nowrap">
                                <Text size="xs" fw={600} c="teal">
                                  {formatMoney(recete.fiyat)}
                                </Text>
                                {zatenEklendi ? (
                                  <ThemeIcon size={18} variant="light" color="gray" radius="xl">
                                    <IconMinus size={10} />
                                  </ThemeIcon>
                                ) : (
                                  <ThemeIcon size={18} variant="light" color="teal" radius="xl">
                                    <IconPlus size={10} />
                                  </ThemeIcon>
                                )}
                              </Group>
                            </Group>
                          </Paper>
                        </UnstyledButton>
                      );
                    })
                  )}
                </Stack>
              </ScrollArea>
            </Stack>
          </Grid.Col>
        </Grid>

        <Divider />

        {/* Alt kısım: toplam + kaydet */}
        <Group justify="space-between">
          <Group gap="md">
            <Text size="sm" c="dimmed">
              {seciliYemekler.length} yemek
            </Text>
            <Text size="lg" fw={700} c="teal">
              {formatMoney(toplamMaliyet)}
            </Text>
          </Group>
          <Group gap="sm">
            <Button
              variant="subtle"
              color="gray"
              onClick={() => {
                onClose();
                resetState();
              }}
            >
              İptal
            </Button>
            <Button
              color="teal"
              onClick={() => saveMutation.mutate()}
              loading={saveMutation.isPending}
              disabled={seciliYemekler.length === 0}
            >
              Kaydet
            </Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}
