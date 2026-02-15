'use client';

import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Divider,
  Group,
  Loader,
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
  IconAlertTriangle,
  IconBuilding,
  IconCalendar,
  IconChevronLeft,
  IconChevronRight,
  IconCoffee,
  IconCopy,
  IconDeviceFloppy,
  IconFilePlus,
  IconMoon,
  IconSun,
  IconUsers,
  IconX,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { menuPlanlamaAPI, type Recete } from '@/lib/api/services/menu-planlama';
import { formatMoney } from '@/lib/formatters';
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
  type TakvimHucre,
  type TakvimState,
} from './calendar/types';
import { useMenuPlanlama } from './MenuPlanlamaContext';
import { menuPlanlamaKeys } from './queryKeys';

// Öğün tiplerine görsel bilgi ekle (API'den gelen kod'a göre)
const OGUN_GORSELLER: Record<string, { ikon: React.ReactNode; renk: string }> = {
  kahvalti: { ikon: <IconCoffee size={16} />, renk: 'orange' },
  ogle: { ikon: <IconSun size={16} />, renk: 'yellow' },
  aksam: { ikon: <IconMoon size={16} />, renk: 'violet' },
};
const VARSAYILAN_GORSEL = { ikon: <IconSun size={16} />, renk: 'blue' };

/** API'den gelen OgunTipi[]'ni OgunInfo[]'ya dönüştür */
function ogunTipleriToInfo(ogunTipleri: import('./types').OgunTipi[]): OgunInfo[] {
  return ogunTipleri
    .sort((a, b) => a.sira - b.sira)
    .map((ot) => ({
      id: ot.id,
      kod: ot.kod,
      ad: ot.ad,
      ...(OGUN_GORSELLER[ot.kod] || VARSAYILAN_GORSEL),
    }));
}

export function MenuTakvim() {
  const queryClient = useQueryClient();
  const { projeler, ogunTipleri, kaydedilenMenuler, kaydedilenMenulerLoading, refetchMenuler } = useMenuPlanlama();

  // Öğün bilgilerini API verisinden oluştur (hardcoded ID'ler yerine)
  const OGUNLER = useMemo(() => ogunTipleriToInfo(ogunTipleri), [ogunTipleri]);
  const OGUN_ID_TO_KOD = useMemo(
    () => Object.fromEntries(ogunTipleri.map((ot) => [ot.id, ot.kod])) as Record<number, string>,
    [ogunTipleri],
  );

  // Plan state
  const [selectedProjeId, setSelectedProjeId] = useState<number | null>(null);
  const [planTipi, setPlanTipi] = useState<PlanTipi>('haftalik');
  const [baslangicTarihi, setBaslangicTarihi] = useState<Date>(new Date());
  const [kisiSayisi, setKisiSayisi] = useState(500);
  const [takvimState, setTakvimState] = useState<TakvimState>({});

  // Saved plan editing state
  const [editingPlanId, setEditingPlanId] = useState<number | null>(null);
  const [loadingPlanId, setLoadingPlanId] = useState<number | null>(null);

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
    queryKey: menuPlanlamaKeys.receteler.takvim(debouncedArama, seciliKategori || undefined, aktifOgunKod || undefined),
    queryFn: async () => {
      const kategori = seciliKategori || undefined;
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

  // Kategorileri API'den çek (popover chip listesi için)
  const { data: kategorilerData } = useQuery({
    queryKey: menuPlanlamaKeys.receteler.kategoriler(),
    queryFn: async () => {
      const res = await menuPlanlamaAPI.getKategoriler();
      if (!res.success || !Array.isArray(res.data)) return [];
      return res.data.map((k) => ({ kod: String(k.id), ad: k.ad }));
    },
    staleTime: 5 * 60 * 1000,
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
    const fiyat = Number(yemek.tahmini_maliyet || 0);

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
              malzemeSayisi: yemek.malzeme_sayisi,
              kategoriAdi: yemek.kategori_adi,
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

  // Kaydedilmiş planı takvime yükle
  const loadSavedPlan = async (planId: number) => {
    if (loadingPlanId) return;
    setLoadingPlanId(planId);
    try {
      const res = await menuPlanlamaAPI.getMenuPlanDetay(planId);
      if (!res.success || !res.data) {
        notifications.show({ title: 'Hata', message: 'Plan yüklenemedi', color: 'red' });
        return;
      }
      const plan = res.data;

      // Takvim state'ini oluştur
      const yeniState: TakvimState = {};
      for (const ogun of plan.ogunler) {
        const ogunKod = OGUN_ID_TO_KOD[ogun.ogun_tipi_id];
        if (!ogunKod || !ogun.tarih) continue;
        const tarihStr = ogun.tarih.split('T')[0];
        const key = `${tarihStr}_${ogunKod}`;
        const ogunData = ogun as Record<string, unknown>;
        yeniState[key] = {
          tarih: new Date(tarihStr),
          ogunTipiId: ogun.ogun_tipi_id,
          yemekler: (ogun.yemekler || []).map((y) => ({
            id: `recete-${y.recete_id}-${Date.now()}-${Math.random()}`,
            ad: y.recete_ad || '',
            fiyat: Number(y.porsiyon_maliyet) || 0,
            ikon: y.recete_ikon || '🍽️',
            kategoriAdi: y.recete_kategori || undefined,
          })),
          sartnameDurum: (ogunData.sartname_durum as 'uygun' | 'uyari' | 'kontrol_yok') || undefined,
          sartnameUyarilar: (ogunData.sartname_uyarilar as TakvimHucre['sartnameUyarilar']) || undefined,
        };
      }

      // Plan ayarlarını yükle
      setSelectedProjeId(plan.proje_id);
      const tipMap: Record<string, PlanTipi> = { gunluk: 'gunluk', haftalik: 'haftalik', aylik: 'aylik' };
      setPlanTipi(tipMap[plan.tip] || 'haftalik');
      setBaslangicTarihi(new Date(plan.baslangic_tarihi));
      setKisiSayisi(plan.varsayilan_kisi_sayisi || 500);
      setTakvimState(yeniState);
      setEditingPlanId(planId);
      setAktifHucreKey(null);

      notifications.show({ title: 'Yüklendi', message: `"${plan.ad}" takvime yüklendi`, color: 'blue' });
    } catch {
      notifications.show({ title: 'Hata', message: 'Plan yüklenirken bir hata oluştu', color: 'red' });
    } finally {
      setLoadingPlanId(null);
    }
  };

  // Yeni plan başlat (takvimi temizle)
  const startNewPlan = () => {
    setTakvimState({});
    setEditingPlanId(null);
    setAktifHucreKey(null);
  };

  // Filtrelenmiş kaydedilen menüler (seçili projeye göre)
  const filteredMenuler = useMemo(() => {
    if (!selectedProjeId) return kaydedilenMenuler;
    return kaydedilenMenuler.filter((m) => m.proje_id === selectedProjeId);
  }, [kaydedilenMenuler, selectedProjeId]);

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

  // Öğün bazlı toplam maliyetler
  const ogunMaliyetleri = useMemo(() => {
    const maliyetler: Record<string, number> = {};
    for (const ogun of OGUNLER) {
      maliyetler[ogun.kod] = 0;
    }
    for (const [key, hucre] of Object.entries(takvimState)) {
      const ogunKod = key.split('_')[1];
      maliyetler[ogunKod] = (maliyetler[ogunKod] || 0) + hucre.yemekler.reduce((s, y) => s + y.fiyat, 0);
    }
    return maliyetler;
  }, [takvimState, OGUNLER]);

  // Günlük toplam maliyetler
  const gunlukMaliyetler = useMemo(() => {
    const maliyetler: Record<string, number> = {};
    for (const [key, hucre] of Object.entries(takvimState)) {
      const tarihKey = key.split('_')[0];
      maliyetler[tarihKey] = (maliyetler[tarihKey] || 0) + hucre.yemekler.reduce((s, y) => s + y.fiyat, 0);
    }
    return maliyetler;
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
      const fullRes = res as typeof res & { sartname_uyarilar?: unknown };
      return { planId: res.data.plan_id, sartname_uyarilar: fullRes.sartname_uyarilar };
    },
    onSuccess: (result) => {
      notifications.show({ title: 'Başarılı', message: 'Menü planı kaydedildi', color: 'green' });

      // Şartname uyarılarını göster (bilgilendirme)
      const uyarilar = result?.sartname_uyarilar as
        | Array<{
            tarih: string;
            ogun_tipi_kod: string;
            uyarilar: Array<{ tip: string; mesaj: string; eksik?: string[] }>;
          }>
        | null
        | undefined;
      if (uyarilar && uyarilar.length > 0) {
        const toplamUyari = uyarilar.reduce((s, u) => s + u.uyarilar.length, 0);
        const detayMesajlari = uyarilar
          .slice(0, 3)
          .map((u) => {
            const tarihStr = new Date(u.tarih).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
            const ogunStr = u.ogun_tipi_kod === 'ogle' ? 'Öğle' : u.ogun_tipi_kod === 'aksam' ? 'Akşam' : u.ogun_tipi_kod === 'kahvalti' ? 'Kahvaltı' : u.ogun_tipi_kod;
            return `${tarihStr} ${ogunStr}: ${u.uyarilar.map((uy) => uy.mesaj).join(', ')}`;
          })
          .join('\n');
        const fazlaMesaj = uyarilar.length > 3 ? `\n...ve ${uyarilar.length - 3} öğün daha` : '';

        notifications.show({
          title: `⚠️ ${toplamUyari} şartname uyarısı`,
          message: detayMesajlari + fazlaMesaj,
          color: 'orange',
          autoClose: 8000,
          icon: <IconAlertTriangle size={18} />,
        });
      }

      setTakvimState({});
      setEditingPlanId(null);
      queryClient.invalidateQueries({ queryKey: menuPlanlamaKeys.menuPlanlari() });
      refetchMenuler();
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
                <Title order={4}>{editingPlanId ? 'Plan Düzenleme' : 'Menü Planlama Takvimi'}</Title>
                <Text size="xs" c="dimmed">
                  {editingPlanId
                    ? `Plan #${editingPlanId} düzenleniyor`
                    : 'Günlük, haftalık veya aylık menü planı oluşturun'}
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

      {/* Kaydedilmiş Planlar (yatay scroll) */}
      {(filteredMenuler.length > 0 || kaydedilenMenulerLoading) && (
        <ScrollArea scrollbarSize={6} type="hover">
          <Group gap="sm" wrap="nowrap" pb={4}>
            {/* Yeni plan kartı */}
            <Paper
              p="xs"
              px="sm"
              radius="md"
              withBorder
              style={{
                cursor: 'pointer',
                flexShrink: 0,
                minWidth: 140,
                borderStyle: editingPlanId === null && Object.keys(takvimState).length === 0 ? 'solid' : 'dashed',
                borderColor: editingPlanId === null ? 'var(--mantine-color-indigo-5)' : 'var(--mantine-color-dark-4)',
                background: editingPlanId === null ? 'rgba(99,102,241,0.08)' : undefined,
              }}
              onClick={startNewPlan}
            >
              <Stack align="center" gap={4} py={4}>
                <IconFilePlus size={18} style={{ opacity: 0.7 }} />
                <Text size="xs" fw={600}>
                  Yeni Plan
                </Text>
              </Stack>
            </Paper>

            {kaydedilenMenulerLoading && (
              <Stack align="center" justify="center" style={{ minWidth: 100 }}>
                <Loader size="xs" />
              </Stack>
            )}

            {filteredMenuler.map((menu) => {
              const isActive = editingPlanId === menu.id;
              const isLoading = loadingPlanId === menu.id;
              return (
                <Paper
                  key={menu.id}
                  p="xs"
                  px="sm"
                  radius="md"
                  withBorder
                  style={{
                    cursor: isLoading ? 'wait' : 'pointer',
                    flexShrink: 0,
                    minWidth: 200,
                    background: isActive ? 'rgba(59,130,246,0.12)' : undefined,
                    borderColor: isActive ? 'var(--mantine-color-blue-5)' : undefined,
                    opacity: isLoading ? 0.7 : 1,
                  }}
                  onClick={() => !isLoading && loadSavedPlan(menu.id)}
                >
                  <Group gap={8} wrap="nowrap" mb={4}>
                    <Text size="xs" fw={600} lineClamp={1} style={{ flex: 1 }}>
                      {menu.ad}
                    </Text>
                    {isLoading && <Loader size={12} />}
                  </Group>
                  <Group gap={4} wrap="wrap">
                    <Badge size="xs" variant="light" color="blue">
                      {new Date(menu.baslangic_tarihi).toLocaleDateString('tr-TR', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </Badge>
                    {menu.ogunler && (
                      <Badge size="xs" variant="light" color="gray">
                        {menu.ogunler.length} öğün
                      </Badge>
                    )}
                  </Group>
                  {Number(menu.toplam_maliyet) > 0 && (
                    <Text size="10px" fw={600} c="teal" mt={4}>
                      {formatMoney(menu.toplam_maliyet || 0)}
                    </Text>
                  )}
                </Paper>
              );
            })}
          </Group>
        </ScrollArea>
      )}

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
                        kategoriler={kategorilerData}
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
                    {ogunMaliyetleri[ogun.kod] > 0 && (
                      <Text size="9px" fw={600} c={ogun.renk} mt={2}>
                        {formatMoney(ogunMaliyetleri[ogun.kod])}
                      </Text>
                    )}
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
                          kategoriler={kategorilerData}
                        />
                      </Box>
                    );
                  })}
                </Group>
              ))}

              {/* Günlük Toplam Maliyetler Satırı */}
              {Object.keys(gunlukMaliyetler).length > 0 && (
                <Group
                  gap={0}
                  wrap="nowrap"
                  mt="xs"
                  pt="xs"
                  style={{ borderTop: '1px solid var(--mantine-color-dark-4)' }}
                >
                  <Box w={80}>
                    <Text size="xs" fw={700} c="dimmed">
                      Günlük
                    </Text>
                  </Box>
                  {tarihler.map((tarih) => {
                    const tarihKey = formatTarih(tarih);
                    const gunMaliyet = gunlukMaliyetler[tarihKey] || 0;
                    return (
                      <Box
                        key={`toplam-${tarihKey}`}
                        style={{ flex: 1, minWidth: 100, padding: '0 4px', textAlign: 'center' }}
                      >
                        {gunMaliyet > 0 ? (
                          <Stack gap={0} align="center">
                            <Text size="xs" fw={700} c="teal">
                              {formatMoney(gunMaliyet)}
                            </Text>
                            <Text size="9px" c="dimmed">
                              {formatMoney(gunMaliyet / kisiSayisi)}/kişi
                            </Text>
                          </Stack>
                        ) : (
                          <Text size="xs" c="dimmed">
                            —
                          </Text>
                        )}
                      </Box>
                    );
                  })}
                </Group>
              )}
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
        ogunMaliyetleri={OGUNLER.map((o) => ({
          ad: o.ad,
          renk: o.renk,
          maliyet: ogunMaliyetleri[o.kod] || 0,
        }))}
      />
    </Stack>
  );
}
