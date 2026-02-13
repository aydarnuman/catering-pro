'use client';

import {
  ActionIcon,
  Box,
  Button,
  Divider,
  Group,
  NumberInput,
  Paper,
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
  IconSun,
  IconUsers,
  IconX,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { menuPlanlamaAPI, type Recete } from '@/lib/api/services/menu-planlama';
import { MealCellPopover } from './calendar/MealCellPopover';
import { MonthlyCalendarGrid } from './calendar/MonthlyCalendarGrid';
import { PlanSummary } from './calendar/PlanSummary';
import {
  formatGunAdi,
  formatGunNo,
  formatTarih,
  getTarihAraligi,
  type OgunInfo,
  type PlanTipi,
  type TakvimState,
} from './calendar/types';
import { useMenuPlanlama } from './MenuPlanlamaContext';

// Öğün bilgileri
const OGUNLER: OgunInfo[] = [
  { id: 1, kod: 'kahvalti', ad: 'Kahvaltı', ikon: <IconCoffee size={16} />, renk: 'orange' },
  { id: 2, kod: 'ogle', ad: 'Öğle', ikon: <IconSun size={16} />, renk: 'yellow' },
  { id: 3, kod: 'aksam', ad: 'Akşam', ikon: <IconMoon size={16} />, renk: 'violet' },
];

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

export function MenuTakvim() {
  const queryClient = useQueryClient();
  const { projeler } = useMenuPlanlama();

  // Plan state
  const [selectedProjeId, setSelectedProjeId] = useState<number | null>(null);
  const [planTipi, setPlanTipi] = useState<PlanTipi>('haftalik');
  const [baslangicTarihi, setBaslangicTarihi] = useState<Date>(new Date());
  const [kisiSayisi, setKisiSayisi] = useState(500);
  const [takvimState, setTakvimState] = useState<TakvimState>({});

  // Popover state
  const [aktifHucreKey, setAktifHucreKey] = useState<string | null>(null);
  const [aramaMetni, setAramaMetni] = useState('');
  const [seciliKategori, setSeciliKategori] = useState('');
  const [debouncedArama] = useDebouncedValue(aramaMetni, 300);

  // Kopyalama state
  const [kopyaKaynakTarih, setKopyaKaynakTarih] = useState<Date | null>(null);

  // Aylık görünümde seçili gün (detay göstermek için)
  const [aylikSeciliGun, setAylikSeciliGun] = useState<string | null>(null);

  const aktifOgunKod = aktifHucreKey?.split('_')[1] || null;

  // Reçeteleri çek
  const { data: recetelerData, isLoading: recetelerLoading } = useQuery({
    queryKey: ['receteler-takvim', debouncedArama, seciliKategori, aktifOgunKod],
    queryFn: async () => {
      let kategori = seciliKategori || undefined;
      if (!kategori && aktifOgunKod && !debouncedArama) {
        const kategoriler = getKategorilerByOgun(aktifOgunKod);
        if (kategoriler.length > 0) {
          kategori = kategoriler[0];
        }
      }
      const res = await menuPlanlamaAPI.getReceteler({
        arama: debouncedArama || undefined,
        kategori,
        limit: 50,
      });
      return res.success ? res.data : [];
    },
    staleTime: 30000,
    enabled: !!aktifHucreKey,
  });

  // Tarih aralığı
  const tarihler = useMemo(() => getTarihAraligi(baslangicTarihi, planTipi), [baslangicTarihi, planTipi]);

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

  // Yemek ekle
  const handleYemekEkle = (tarih: Date, ogun: OgunInfo, yemek: Recete) => {
    const key = getHucreKey(tarih, ogun.kod);
    const fiyat = Number(yemek.tahmini_maliyet || yemek.porsiyon_miktar || 0);

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

  // Günü kopyala - hedef tarih(ler)e
  const handleGunuKopyala = (kaynakTarih: Date, hedefTarihler: Date[]) => {
    const kaynakYemekler: Record<string, (typeof takvimState)[string]> = {};
    for (const ogun of OGUNLER) {
      const key = getHucreKey(kaynakTarih, ogun.kod);
      if (takvimState[key]) {
        kaynakYemekler[ogun.kod] = takvimState[key];
      }
    }

    if (Object.keys(kaynakYemekler).length === 0) {
      notifications.show({ title: 'Uyarı', message: 'Kopyalanacak yemek yok', color: 'yellow' });
      return;
    }

    setTakvimState((prev) => {
      const yeni = { ...prev };
      for (const hedefTarih of hedefTarihler) {
        for (const ogun of OGUNLER) {
          if (kaynakYemekler[ogun.kod]) {
            const hedefKey = getHucreKey(hedefTarih, ogun.kod);
            yeni[hedefKey] = { ...kaynakYemekler[ogun.kod], tarih: hedefTarih };
          }
        }
      }
      return yeni;
    });

    setKopyaKaynakTarih(null);
    const hedefStr =
      hedefTarihler.length === 1 ? hedefTarihler[0].toLocaleDateString('tr-TR') : `${hedefTarihler.length} güne`;
    notifications.show({
      title: 'Kopyalandı',
      message: `Yemekler ${hedefStr} kopyalandı`,
      color: 'green',
    });
  };

  // Hesaplanan değerler
  const toplamMaliyet = useMemo(() => {
    return Object.values(takvimState).reduce((sum, hucre) => {
      return sum + hucre.yemekler.reduce((s, y) => s + y.fiyat, 0);
    }, 0);
  }, [takvimState]);

  const doluGunSayisi = useMemo(() => {
    const gunler = new Set<string>();
    for (const key of Object.keys(takvimState)) {
      gunler.add(key.split('_')[0]);
    }
    return gunler.size;
  }, [takvimState]);

  // Planı kaydet
  const savePlanMutation = useMutation({
    mutationFn: async () => {
      if (!selectedProjeId) throw new Error('Proje seçiniz');
      if (Object.keys(takvimState).length === 0) throw new Error('En az bir öğün ekleyin');

      const tarihStr = formatTarih(baslangicTarihi);
      const bitisTarihStr = formatTarih(tarihler[tarihler.length - 1]);

      const ogunler: Array<{
        tarih: string;
        ogun_tipi_id: number;
        kisi_sayisi: number;
        yemekler: Array<{ recete_id?: number; ad: string; fiyat: number }>;
      }> = [];

      for (const [key, hucre] of Object.entries(takvimState)) {
        const [tarih, ogunKod] = key.split('_');
        const ogun = OGUNLER.find((o) => o.kod === ogunKod);
        if (!ogun || hucre.yemekler.length === 0) continue;

        ogunler.push({
          tarih,
          ogun_tipi_id: ogun.id,
          kisi_sayisi: kisiSayisi,
          yemekler: hucre.yemekler.map((y) => ({
            recete_id: y.id.startsWith('recete-') ? parseInt(y.id.split('-')[1], 10) : undefined,
            ad: y.ad,
            fiyat: y.fiyat,
          })),
        });
      }

      const tipLabel =
        planTipi === 'haftalik'
          ? 'Haftalık'
          : planTipi === '15gunluk'
            ? '15 Günlük'
            : planTipi === 'aylik'
              ? 'Aylık'
              : 'Günlük';
      const res = await menuPlanlamaAPI.saveFullPlan({
        proje_id: selectedProjeId,
        ad: `${tipLabel} Menü - ${tarihStr}`,
        tip: planTipi === '15gunluk' ? 'haftalik' : planTipi,
        baslangic_tarihi: tarihStr,
        bitis_tarihi: bitisTarihStr,
        varsayilan_kisi_sayisi: kisiSayisi,
        ogunler,
      });

      if (!res.success) throw new Error(String(res.error || 'Plan kaydedilemedi'));
      return res.data.plan_id;
    },
    onSuccess: () => {
      notifications.show({ title: 'Başarılı', message: 'Menü planı kaydedildi', color: 'green' });
      setTakvimState({});
      queryClient.invalidateQueries({ queryKey: ['kaydedilen-menuler'] });
    },
    onError: (error: Error) => {
      notifications.show({ title: 'Hata', message: error.message, color: 'red' });
    },
  });

  const projeOptions = projeler.map((p) => ({
    value: String(p.id),
    label: `${p.ad}${p.musteri ? ` - ${p.musteri}` : ''}`,
  }));

  const atlamaMiktari = planTipi === 'gunluk' ? 1 : planTipi === 'haftalik' ? 7 : planTipi === '15gunluk' ? 15 : 30;

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
            <Select
              label="Proje / Şantiye"
              placeholder="Seçin..."
              data={projeOptions}
              value={selectedProjeId ? String(selectedProjeId) : null}
              onChange={(val) => setSelectedProjeId(val ? parseInt(val, 10) : null)}
              searchable
              leftSection={<IconBuilding size={16} />}
            />
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
            <Box>
              <Text size="sm" fw={500} mb={4}>
                Başlangıç
              </Text>
              <Group gap="xs">
                <ActionIcon
                  variant="light"
                  color="gray"
                  onClick={() => {
                    const d = new Date(baslangicTarihi);
                    d.setDate(d.getDate() - atlamaMiktari);
                    setBaslangicTarihi(d);
                  }}
                >
                  <IconChevronLeft size={16} />
                </ActionIcon>
                <TextInput
                  value={baslangicTarihi.toISOString().split('T')[0]}
                  onChange={(e) => {
                    const d = new Date(e.currentTarget.value);
                    if (!Number.isNaN(d.getTime())) setBaslangicTarihi(d);
                  }}
                  type="date"
                  size="sm"
                  style={{ flex: 1 }}
                  styles={{ input: { textAlign: 'center', fontWeight: 500 } }}
                />
                <ActionIcon
                  variant="light"
                  color="gray"
                  onClick={() => {
                    const d = new Date(baslangicTarihi);
                    d.setDate(d.getDate() + atlamaMiktari);
                    setBaslangicTarihi(d);
                  }}
                >
                  <IconChevronRight size={16} />
                </ActionIcon>
                <Tooltip label="Bugün">
                  <ActionIcon variant="light" color="blue" onClick={() => setBaslangicTarihi(new Date())}>
                    <IconCalendar size={16} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </Box>
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
      {planTipi === 'aylik' ? (
        <>
          {/* Aylık görünüm: mini-kart grid */}
          <Paper p="md" radius="md" withBorder>
            <MonthlyCalendarGrid
              tarihler={tarihler}
              ogunler={OGUNLER}
              takvimState={takvimState}
              selectedGun={aylikSeciliGun}
              onGunSec={(tarih) => setAylikSeciliGun(formatTarih(tarih))}
              kopyaKaynakTarih={kopyaKaynakTarih}
              onKopyaBaslat={setKopyaKaynakTarih}
              onKopyaYapistir={handleGunuKopyala}
              onKopyaIptal={() => setKopyaKaynakTarih(null)}
            />
          </Paper>

          {/* Seçili günün detay paneli */}
          {aylikSeciliGun && (
            <Paper p="md" radius="md" withBorder>
              <Group justify="space-between" mb="sm">
                <Text fw={600} size="sm">
                  {new Date(aylikSeciliGun).toLocaleDateString('tr-TR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })}
                </Text>
                <ActionIcon variant="subtle" color="gray" onClick={() => setAylikSeciliGun(null)}>
                  <IconX size={16} />
                </ActionIcon>
              </Group>
              <Group gap="md" wrap="nowrap" align="flex-start">
                {OGUNLER.map((ogun) => {
                  const key = `${aylikSeciliGun}_${ogun.kod}`;
                  const tarih = new Date(aylikSeciliGun);
                  return (
                    <Box key={ogun.kod} style={{ flex: 1 }}>
                      <MealCellPopover
                        hucre={takvimState[key]}
                        ogun={ogun}
                        tarih={tarih}
                        isOpen={aktifHucreKey === key}
                        onToggle={() => handlePopoverToggle(key)}
                        onClear={() => handleHucreClear(tarih, ogun.kod)}
                        onYemekEkle={(yemek) => handleYemekEkle(tarih, ogun, yemek)}
                        receteler={(recetelerData || []) as Recete[]}
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
            </Paper>
          )}
        </>
      ) : (
        /* Günlük/Haftalık/15 Günlük görünüm: satır grid */
        <Paper p="md" radius="md" withBorder>
          <ScrollArea>
            <Box style={{ minWidth: planTipi === 'gunluk' ? 200 : 600 }}>
              {/* Tarih Başlıkları */}
              <Group gap={0} wrap="nowrap" mb="sm">
                <Box w={80} />
                {tarihler.map((tarih) => {
                  const tarihKey = formatTarih(tarih);
                  const isKopyaKaynak = kopyaKaynakTarih && formatTarih(kopyaKaynakTarih) === tarihKey;
                  const gunDolu = OGUNLER.some((o) => takvimState[getHucreKey(tarih, o.kod)]);

                  return (
                    <Box key={tarihKey} style={{ flex: 1, minWidth: 100, textAlign: 'center' }}>
                      <Text size="xs" c="dimmed">
                        {formatGunAdi(tarih)}
                      </Text>
                      <Text fw={600}>{formatGunNo(tarih)}</Text>
                      {kopyaKaynakTarih && !isKopyaKaynak ? (
                        <Tooltip label="Bu güne yapıştır">
                          <ActionIcon
                            size="xs"
                            variant="light"
                            color="teal"
                            onClick={() => handleGunuKopyala(kopyaKaynakTarih, [tarih])}
                          >
                            <IconCopy size={12} />
                          </ActionIcon>
                        </Tooltip>
                      ) : isKopyaKaynak ? (
                        <Tooltip label="Kopyalamayı iptal et">
                          <ActionIcon size="xs" variant="filled" color="blue" onClick={() => setKopyaKaynakTarih(null)}>
                            <IconX size={12} />
                          </ActionIcon>
                        </Tooltip>
                      ) : gunDolu ? (
                        <Tooltip label="Bu günü kopyala">
                          <ActionIcon
                            size="xs"
                            variant="subtle"
                            color="gray"
                            onClick={() => setKopyaKaynakTarih(tarih)}
                          >
                            <IconCopy size={12} />
                          </ActionIcon>
                        </Tooltip>
                      ) : null}
                    </Box>
                  );
                })}
              </Group>

              {/* Öğün Satırları */}
              {OGUNLER.map((ogun) => (
                <Group key={ogun.kod} gap={0} wrap="nowrap" mb="xs">
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
                  {tarihler.map((tarih) => {
                    const key = getHucreKey(tarih, ogun.kod);
                    return (
                      <Box key={key} style={{ flex: 1, minWidth: 100, padding: '0 4px' }}>
                        <MealCellPopover
                          hucre={takvimState[key]}
                          ogun={ogun}
                          tarih={tarih}
                          isOpen={aktifHucreKey === key}
                          onToggle={() => handlePopoverToggle(key)}
                          onClear={() => handleHucreClear(tarih, ogun.kod)}
                          onYemekEkle={(yemek) => handleYemekEkle(tarih, ogun, yemek)}
                          receteler={(recetelerData || []) as Recete[]}
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
      )}

      {/* Özet Panel */}
      <PlanSummary
        doluGunSayisi={doluGunSayisi}
        toplamGun={tarihler.length}
        toplamOgun={Object.keys(takvimState).length}
        toplamMaliyet={toplamMaliyet}
        kisiSayisi={kisiSayisi}
      />
    </Stack>
  );
}
