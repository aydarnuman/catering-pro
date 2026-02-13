'use client';

/**
 * KurumMenuTakvim
 *
 * Kurum tipine gore hazir menu sablonu olusturma takvimi.
 * AI cok faktorlu menu motoru ile otomatik doldurma + manuel duzenleme.
 *
 * State: gun_no bazli TakvimState (tarih degil, cunku sablonlar tarihsiz)
 * Key format: "gunNo_ogunKod" (orn: "1_ogle", "3_kahvalti")
 */

import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Center,
  Group,
  Loader,
  MultiSelect,
  NumberInput,
  Paper,
  Popover,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconAdjustments,
  IconBuildingCommunity,
  IconCalculator,
  IconChefHat,
  IconCoin,
  IconDeviceFloppy,
  IconPlus,
  IconRobot,
  IconSearch,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import {
  type KurumMenuOzet,
  type KurumTipi,
  kurumMenuleriAPI,
  type MaliyetSeviyesi,
} from '@/lib/api/services/kurum-menuleri';
import { menuPlanlamaAPI, type Recete } from '@/lib/api/services/menu-planlama';

// ─── Types ────────────────────────────────────────────────────

interface CellYemek {
  id: string; // "recete-{receteId}-{ts}"
  recete_id?: number;
  ad: string;
  fiyat: number;
  ikon?: string;
}

// Key: "gunNo_ogunKod" (orn: "1_ogle")
type KurumTakvimState = Record<string, CellYemek[]>;

interface OgunTipi {
  id: number;
  kod: string;
  ad: string;
  ikon: string;
}

interface PresetConfig {
  gunluk_kalori_hedef?: { min: number; max: number };
  ogun_yapisi?: string;
  ogun_cesit?: Record<string, string[]>;
  haftalik_zorunlu?: Record<string, number>;
  rotasyon?: Record<string, number>;
  haric_tutma?: string[];
  mevsim_tercihi?: string;
  maliyet_limit_porsiyon?: Record<string, number>;
  ozel_notlar?: string;
}

// ─── Constants ────────────────────────────────────────────────

const OGUN_TIPLERI_3: OgunTipi[] = [
  { id: 1, kod: 'kahvalti', ad: 'Kahvalti', ikon: '☀️' },
  { id: 2, kod: 'ogle', ad: 'Ogle', ikon: '🌞' },
  { id: 3, kod: 'aksam', ad: 'Aksam', ikon: '🌙' },
];

const OGUN_TIPLERI_2: OgunTipi[] = [
  { id: 2, kod: 'ogle', ad: 'Ogle', ikon: '🌞' },
  { id: 3, kod: 'aksam', ad: 'Aksam', ikon: '🌙' },
];

const MEVSIMLER = [
  { value: 'auto', label: 'Otomatik' },
  { value: 'ilkbahar', label: 'Ilkbahar' },
  { value: 'yaz', label: 'Yaz' },
  { value: 'sonbahar', label: 'Sonbahar' },
  { value: 'kis', label: 'Kis' },
];

const HARIC_TUTMA_OPTIONS = ['domuz', 'alkol', 'gluten', 'laktoz', 'fistik', 'deniz_urunleri', 'soya', 'yumurta'];

// ─── Component ────────────────────────────────────────────────

export function KurumMenuTakvim() {
  const queryClient = useQueryClient();

  // ─── Config state ─────────────────────────────────────────
  const [kurumTipiId, setKurumTipiId] = useState<string | null>(null);
  const [maliyetSeviyesiId, setMaliyetSeviyesiId] = useState<string | null>(null);
  const [menuAdi, setMenuAdi] = useState('');
  const [gunSayisi, setGunSayisi] = useState(15);
  const [kisiSayisi, setKisiSayisi] = useState(500);
  const [mevsim, setMevsim] = useState('auto');
  const [haricTutma, setHaricTutma] = useState<string[]>([]);
  const [ozelIstek, setOzelIstek] = useState('');
  const [presetConfig, setPresetConfig] = useState<PresetConfig>({});

  // ─── Takvim state ─────────────────────────────────────────
  const [takvim, setTakvim] = useState<KurumTakvimState>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [editingMenuId, setEditingMenuId] = useState<number | null>(null);

  // ─── Popover state ────────────────────────────────────────
  const [activeCell, setActiveCell] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');

  // ─── Fetch lookups ────────────────────────────────────────
  const { data: kurumResp } = useQuery({
    queryKey: ['kurum-tipleri'],
    queryFn: () => kurumMenuleriAPI.getKurumTipleri(),
    staleTime: 30 * 60 * 1000,
  });
  const kurumTipleri: KurumTipi[] = (kurumResp as unknown as { data?: KurumTipi[] })?.data ?? [];

  const { data: maliyetResp } = useQuery({
    queryKey: ['maliyet-seviyeleri'],
    queryFn: () => kurumMenuleriAPI.getMaliyetSeviyeleri(),
    staleTime: 30 * 60 * 1000,
  });
  const maliyetSeviyeleri: MaliyetSeviyesi[] = (maliyetResp as unknown as { data?: MaliyetSeviyesi[] })?.data ?? [];

  // Fetch saved kurum menuleri (for side panel)
  const { data: savedResp } = useQuery({
    queryKey: ['kurum-menuleri-saved'],
    queryFn: () => kurumMenuleriAPI.getMenuler(),
    staleTime: 2 * 60 * 1000,
  });
  const savedMenuler: KurumMenuOzet[] = (savedResp as unknown as { data?: KurumMenuOzet[] })?.data ?? [];

  // Fetch recipes for popover
  const { data: receteResp, isLoading: receteLoading } = useQuery({
    queryKey: ['receteler-kurum', searchText],
    queryFn: () => menuPlanlamaAPI.getReceteler({ arama: searchText || undefined, limit: 30 }),
    staleTime: 5 * 60 * 1000,
    enabled: activeCell !== null,
  });

  const receteler: Recete[] = useMemo(() => {
    if (!receteResp) return [];
    const raw = receteResp as unknown as { success: boolean; data?: Recete[]; receteler?: Recete[] };
    return raw.data ?? raw.receteler ?? [];
  }, [receteResp]);

  // ─── Derived ──────────────────────────────────────────────

  const ogunYapisi = presetConfig.ogun_yapisi || '3_ogun';
  const is2Ogun = ogunYapisi === '2_ogun' || ogunYapisi === '2_ogun_kyk';

  const ogunTipleri = is2Ogun
    ? ogunYapisi === '2_ogun_kyk'
      ? [
          { id: 1, kod: 'kahvalti', ad: 'Kahvalti', ikon: '☀️' },
          { id: 3, kod: 'aksam', ad: 'Aksam', ikon: '🌙' },
        ]
      : OGUN_TIPLERI_2
    : OGUN_TIPLERI_3;
  const gunSayisiNum = gunSayisi;

  const { totalMaliyet, gunlukOrtalama, toplamYemek } = useMemo(() => {
    let total = 0;
    let yemekCount = 0;
    const gunMaliyetler = new Map<number, number>();
    for (const [key, yemekler] of Object.entries(takvim)) {
      const gunNo = Number(key.split('_')[0]);
      const gunTotal = yemekler.reduce((s, y) => s + (Number(y.fiyat) || 0), 0);
      total += gunTotal;
      yemekCount += yemekler.length;
      gunMaliyetler.set(gunNo, (gunMaliyetler.get(gunNo) || 0) + gunTotal);
    }
    const gunluk = gunMaliyetler.size > 0 ? total / gunMaliyetler.size : 0;
    return {
      totalMaliyet: Math.round(total * 100) / 100,
      gunlukOrtalama: Math.round(gunluk * 100) / 100,
      toplamYemek: yemekCount,
    };
  }, [takvim]);

  // ─── Preset loading ───────────────────────────────────────

  const handleKurumChange = useCallback(
    (val: string | null) => {
      setKurumTipiId(val);
      if (!val) {
        setPresetConfig({});
        return;
      }
      const kurum = kurumTipleri.find((k) => String(k.id) === val);
      if (kurum) {
        const preset = (kurum as unknown as { preset_config?: PresetConfig }).preset_config || {};
        setPresetConfig(preset);
        if (preset.haric_tutma) setHaricTutma(preset.haric_tutma);
        if (preset.mevsim_tercihi) setMevsim(preset.mevsim_tercihi);
        // Auto-generate name (gun sayisina dokunma)
        const maliyetSev = maliyetSeviyeleri.find((m) => String(m.id) === maliyetSeviyesiId);
        setMenuAdi(`${kurum.ad} ${maliyetSev?.ad || ''} Menu`.trim());
      }
    },
    [kurumTipleri, maliyetSeviyesiId, maliyetSeviyeleri]
  );

  // ─── Cell operations ──────────────────────────────────────

  const addYemek = useCallback((gunNo: number, ogunKod: string, recete: Recete) => {
    const key = `${gunNo}_${ogunKod}`;
    const yemek: CellYemek = {
      id: `recete-${recete.id}-${Date.now()}`,
      recete_id: recete.id,
      ad: recete.ad,
      fiyat: Number(recete.tahmini_maliyet || 0),
      ikon: recete.kategori_ikon,
    };
    setTakvim((prev) => ({
      ...prev,
      [key]: [...(prev[key] || []), yemek],
    }));
    setHasChanges(true);
  }, []);

  const removeYemek = useCallback((gunNo: number, ogunKod: string, yemekId: string) => {
    const key = `${gunNo}_${ogunKod}`;
    setTakvim((prev) => ({
      ...prev,
      [key]: (prev[key] || []).filter((y) => y.id !== yemekId),
    }));
    setHasChanges(true);
  }, []);

  const clearCell = useCallback((gunNo: number, ogunKod: string) => {
    const key = `${gunNo}_${ogunKod}`;
    setTakvim((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setHasChanges(true);
  }, []);

  // ─── AI Fill ──────────────────────────────────────────────

  const aiMutation = useMutation({
    mutationFn: () => {
      const kurumKod = kurumTipleri.find((k) => String(k.id) === kurumTipiId)?.kod || '';
      const maliyetKod = maliyetSeviyeleri.find((m) => String(m.id) === maliyetSeviyesiId)?.kod || 'standart';
      return kurumMenuleriAPI.aiOlustur({
        kurum_tipi_kod: kurumKod,
        maliyet_seviyesi_kod: maliyetKod,
        gun_sayisi: gunSayisiNum,
        ogun_yapisi: presetConfig.ogun_yapisi || '3_ogun',
        mevsim,
        haric_tutma: haricTutma,
        ozel_istekler: ozelIstek,
      });
    },
    onSuccess: (resp) => {
      const raw = resp as unknown as {
        success: boolean;
        gunler?: Array<{
          gun_no: number;
          ogunler: Array<{
            ogun_kod: string;
            yemekler: Array<{ recete_id: number; ad: string; fiyat?: number; ikon?: string }>;
          }>;
        }>;
        error?: string;
      };
      if (!raw.success) {
        notifications.show({ title: 'AI Hatasi', message: raw.error || 'Menu olusturulamadi', color: 'red' });
        return;
      }
      // Convert AI response to TakvimState
      const newState: KurumTakvimState = {};
      for (const gun of raw.gunler || []) {
        for (const ogun of gun.ogunler || []) {
          const key = `${gun.gun_no}_${ogun.ogun_kod}`;
          newState[key] = (ogun.yemekler || []).map((y) => ({
            id: `recete-${y.recete_id}-${Date.now()}-${Math.random()}`,
            recete_id: y.recete_id,
            ad: y.ad,
            fiyat: y.fiyat || 0,
            ikon: y.ikon,
          }));
        }
      }
      setTakvim(newState);
      setHasChanges(true);
      notifications.show({
        title: 'Menu Olusturuldu',
        message: 'AI menuyu doldurdu, inceleyip kaydedebilirsiniz',
        color: 'green',
      });
    },
    onError: (err: Error) => {
      notifications.show({ title: 'AI Hatasi', message: err.message, color: 'red' });
    },
  });

  // ─── Save ─────────────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: async () => {
      let menuId = editingMenuId;

      // Create menu if new
      if (!menuId) {
        const createResp = await kurumMenuleriAPI.createMenu({
          ad: menuAdi || 'Yeni Kurum Menusu',
          kurum_tipi_id: Number(kurumTipiId),
          maliyet_seviyesi_id: Number(maliyetSeviyesiId),
          gun_sayisi: gunSayisiNum,
          ogun_yapisi: presetConfig.ogun_yapisi || '3_ogun',
          kisi_sayisi: kisiSayisi,
        });
        const raw = createResp as unknown as { success: boolean; data?: { id: number } };
        if (!raw.success || !raw.data?.id) throw new Error('Menu olusturulamadi');
        menuId = raw.data.id;
        setEditingMenuId(menuId);
      }

      // Build gunler payload
      const gunler = [];
      for (const [key, yemekler] of Object.entries(takvim)) {
        if (yemekler.length === 0) continue;
        const [gunNoStr, ogunKod] = key.split('_');
        const ogun = ogunTipleri.find((o) => o.kod === ogunKod);
        if (!ogun) continue;
        gunler.push({
          gun_no: Number(gunNoStr),
          ogun_tipi_id: ogun.id,
          yemekler: yemekler.map((y, i) => ({
            recete_id: y.recete_id,
            yemek_adi: y.ad,
            sira: i,
          })),
        });
      }

      return kurumMenuleriAPI.topluKaydet(menuId, gunler);
    },
    onSuccess: (resp) => {
      const raw = resp as unknown as { success: boolean; data?: { yemek_sayisi: number; toplam_maliyet: number } };
      if (raw.success) {
        setHasChanges(false);
        queryClient.invalidateQueries({ queryKey: ['kurum-menuleri-saved'] });
        notifications.show({
          title: 'Kaydedildi',
          message: `${raw.data?.yemek_sayisi ?? 0} yemek, ${raw.data?.toplam_maliyet?.toFixed(2) ?? 0} TL`,
          color: 'green',
        });
      }
    },
    onError: (err: Error) => {
      notifications.show({ title: 'Kaydetme Hatasi', message: err.message, color: 'red' });
    },
  });

  // ─── Load existing menu ───────────────────────────────────

  const loadMenu = useCallback(
    async (menuId: number) => {
      try {
        const resp = await kurumMenuleriAPI.getMenuDetay(menuId);
        const raw = resp as unknown as {
          success: boolean;
          data?: {
            ad: string;
            gun_sayisi: number;
            kisi_sayisi: number;
            kurum_tipi_kod: string;
            maliyet_seviyesi_kod: string;
            gunler: Array<{
              gun_no: number;
              ogun_kod: string;
              yemekler: Array<{
                recete_id: number | null;
                yemek_adi: string;
                porsiyon_maliyet: number;
                kategori_ikon?: string;
              }>;
            }>;
          };
        };
        if (!raw.success || !raw.data) return;

        const menu = raw.data;
        setEditingMenuId(menuId);
        setMenuAdi(menu.ad);
        setGunSayisi(Number(menu.gun_sayisi) || 15);
        setKisiSayisi(menu.kisi_sayisi);

        // Find kurum and maliyet IDs
        const kurum = kurumTipleri.find((k) => k.kod === menu.kurum_tipi_kod);
        if (kurum) setKurumTipiId(String(kurum.id));
        const malSev = maliyetSeviyeleri.find((m) => m.kod === menu.maliyet_seviyesi_kod);
        if (malSev) setMaliyetSeviyesiId(String(malSev.id));

        // Load takvim
        const newState: KurumTakvimState = {};
        for (const gun of menu.gunler || []) {
          const key = `${gun.gun_no}_${gun.ogun_kod}`;
          newState[key] = (gun.yemekler || []).map((y) => ({
            id: `recete-${y.recete_id || 0}-${Date.now()}-${Math.random()}`,
            recete_id: y.recete_id || undefined,
            ad: y.yemek_adi,
            fiyat: y.porsiyon_maliyet || 0,
            ikon: y.kategori_ikon,
          }));
        }
        setTakvim(newState);
        setHasChanges(false);
      } catch {
        notifications.show({ title: 'Hata', message: 'Menu yuklenemedi', color: 'red' });
      }
    },
    [kurumTipleri, maliyetSeviyeleri]
  );

  // ─── New menu ─────────────────────────────────────────────
  const handleNew = useCallback(() => {
    setEditingMenuId(null);
    setTakvim({});
    setMenuAdi('');
    setHasChanges(false);
  }, []);

  // ─── Render ───────────────────────────────────────────────

  return (
    <Stack gap="md">
      {/* Config Panel */}
      <Paper p="md" radius="md" withBorder>
        <Group gap="md" align="flex-end" wrap="wrap">
          <Select
            label="Kurum Tipi"
            placeholder="Secin"
            data={kurumTipleri.map((k) => ({ value: String(k.id), label: `${k.ikon} ${k.ad}` }))}
            value={kurumTipiId}
            onChange={handleKurumChange}
            w={200}
          />
          <Select
            label="Maliyet Seviyesi"
            placeholder="Secin"
            data={maliyetSeviyeleri.map((m) => ({ value: String(m.id), label: m.ad }))}
            value={maliyetSeviyesiId}
            onChange={setMaliyetSeviyesiId}
            w={160}
          />
          <NumberInput
            label="Gun"
            value={gunSayisi}
            onChange={(v) => setGunSayisi(Number(v) || 1)}
            min={1}
            max={30}
            w={80}
          />
          <NumberInput label="Kisi" value={kisiSayisi} onChange={(v) => setKisiSayisi(Number(v) || 1)} min={1} w={90} />
          <Select label="Mevsim" data={MEVSIMLER} value={mevsim} onChange={(v) => setMevsim(v || 'auto')} w={120} />
        </Group>

        {/* Second row: Menu Adi + Actions */}
        <Group gap="md" mt="sm" align="flex-end" wrap="wrap">
          <TextInput
            placeholder="orn: KYK Standart 15 Gunluk"
            value={menuAdi}
            onChange={(e) => setMenuAdi(e.target.value)}
            style={{ flex: 1, minWidth: 200 }}
            size="sm"
          />

          {/* AI Olustur + Gelismis Ayarlar */}
          <Group gap={6}>
            <Button
              variant="gradient"
              gradient={{ from: 'violet', to: 'blue' }}
              leftSection={<IconRobot size={16} />}
              onClick={() => aiMutation.mutate()}
              loading={aiMutation.isPending}
              disabled={!kurumTipiId}
            >
              AI ile Olustur
            </Button>

            {/* Gelismis ayarlar popover */}
            <AiSettingsPopover
              haricTutma={haricTutma}
              onHaricTutmaChange={setHaricTutma}
              ozelIstek={ozelIstek}
              onOzelIstekChange={setOzelIstek}
              presetNotu={presetConfig.ozel_notlar}
            />
          </Group>

          <Button variant="subtle" color="gray" size="sm" onClick={handleNew}>
            Yeni
          </Button>
          <Button
            leftSection={<IconDeviceFloppy size={16} />}
            onClick={() => saveMutation.mutate()}
            loading={saveMutation.isPending}
            disabled={!hasChanges || !kurumTipiId || !maliyetSeviyesiId}
            size="sm"
          >
            Kaydet
          </Button>
        </Group>

        {aiMutation.isPending && (
          <Text size="xs" c="dimmed" mt="xs">
            AI menuyu olusturuyor... (~20sn)
          </Text>
        )}
      </Paper>

      {/* Saved menus - horizontal cards with detail */}
      {savedMenuler.length > 0 && (
        <ScrollArea>
          <Group gap="sm" wrap="nowrap">
            {savedMenuler.map((m) => {
              const isActive = editingMenuId === m.id;
              return (
                <Paper
                  key={m.id}
                  p="xs"
                  px="sm"
                  radius="md"
                  withBorder
                  style={{
                    cursor: 'pointer',
                    flexShrink: 0,
                    minWidth: 200,
                    background: isActive ? 'rgba(59,130,246,0.12)' : undefined,
                    borderColor: isActive ? 'var(--mantine-color-blue-5)' : undefined,
                  }}
                  onClick={() => loadMenu(m.id)}
                >
                  <Group gap={8} wrap="nowrap" mb={4}>
                    <Text size="sm">{m.kurum_tipi_ikon}</Text>
                    <Text size="xs" fw={600} lineClamp={1} style={{ flex: 1 }}>
                      {m.ad}
                    </Text>
                  </Group>
                  <Group gap={4} wrap="wrap">
                    <Badge size="xs" variant="light" color={m.maliyet_seviyesi_renk || 'gray'}>
                      {m.maliyet_seviyesi_ad}
                    </Badge>
                    <Badge size="xs" variant="light" color="gray">
                      {m.gun_sayisi}g
                    </Badge>
                    <Badge size="xs" variant="light" color="gray">
                      {m.yemek_sayisi}y
                    </Badge>
                  </Group>
                  {Number(m.gunluk_maliyet) > 0 && (
                    <Group justify="space-between" mt={6}>
                      <Text size="10px" c="dimmed">
                        Gunluk
                      </Text>
                      <Text size="xs" fw={700} c="green">
                        {Number(m.gunluk_maliyet).toFixed(2)} TL
                      </Text>
                    </Group>
                  )}
                </Paper>
              );
            })}
          </Group>
        </ScrollArea>
      )}

      {/* Calendar Grid */}
      <Paper p="sm" radius="md" withBorder>
        <ScrollArea scrollbarSize={8} type="hover">
          {/* 7 gun = 1 hafta ekrana sigsin, geri kalani scroll */}
          <Box style={{ minWidth: gunSayisiNum > 7 ? `calc((100% - 60px) / 7 * ${gunSayisiNum} + 60px)` : undefined }}>
            {/* Day headers */}
            <Group gap={0} wrap="nowrap" mb={6}>
              <Box w={60} style={{ flexShrink: 0 }} />
              {Array.from({ length: gunSayisiNum }, (_, i) => {
                const haftaNo = Math.floor(i / 7) + 1;
                const isWeekStart = i > 0 && i % 7 === 0;
                return (
                  <Box
                    key={`dh-${i + 1}`}
                    style={{
                      flex: '1 0 0',
                      minWidth: 0,
                      textAlign: 'center',
                      borderLeft: isWeekStart ? '2px solid var(--mantine-color-dark-4)' : undefined,
                      paddingLeft: isWeekStart ? 4 : undefined,
                    }}
                  >
                    {(isWeekStart || i === 0) && (
                      <Text size="9px" c="dimmed" mb={-1}>
                        {haftaNo}. hafta
                      </Text>
                    )}
                    <Text size="xs" fw={600}>
                      Gun {i + 1}
                    </Text>
                  </Box>
                );
              })}
            </Group>

            {/* Ogun rows */}
            {ogunTipleri.map((ogun) => (
              <Group key={ogun.kod} gap={0} wrap="nowrap" mb={6} align="flex-start">
                <Box w={60} pt={6} style={{ flexShrink: 0 }}>
                  <Group gap={4}>
                    <Text size="sm">{ogun.ikon}</Text>
                    <Text size="xs" fw={500}>
                      {ogun.ad}
                    </Text>
                  </Group>
                </Box>
                {Array.from({ length: gunSayisiNum }, (_, dayIdx) => {
                  const gunNo = dayIdx + 1;
                  const cellKey = `${gunNo}_${ogun.kod}`;
                  const cellYemekler = takvim[cellKey] || [];
                  const isWeekStart = dayIdx > 0 && dayIdx % 7 === 0;

                  return (
                    <KurumMenuCell
                      key={cellKey}
                      gunNo={gunNo}
                      ogunKod={ogun.kod}
                      yemekler={cellYemekler}
                      isOpen={activeCell === cellKey}
                      isWeekStart={isWeekStart}
                      onToggle={() => {
                        setActiveCell(activeCell === cellKey ? null : cellKey);
                        setSearchText('');
                      }}
                      onAddRecete={(r) => addYemek(gunNo, ogun.kod, r)}
                      onRemoveYemek={(yId) => removeYemek(gunNo, ogun.kod, yId)}
                      onClear={() => clearCell(gunNo, ogun.kod)}
                      receteler={receteler}
                      receteLoading={receteLoading}
                      searchText={searchText}
                      onSearchChange={setSearchText}
                    />
                  );
                })}
              </Group>
            ))}
          </Box>
        </ScrollArea>
      </Paper>

      {/* Cost Summary */}
      <Paper p="md" radius="md" withBorder>
        {/* Row 1: Per-person costs */}
        <SimpleGrid cols={4} mb="sm">
          <Group gap="sm">
            <IconCoin size={18} color="var(--mantine-color-green-5)" />
            <div>
              <Text size="10px" c="dimmed">
                1 Kisi / 1 Ogun Ort.
              </Text>
              <Text size="md" fw={700}>
                {toplamYemek > 0 ? ((totalMaliyet / toplamYemek) * ogunTipleri.length).toFixed(2) : '0.00'} TL
              </Text>
            </div>
          </Group>
          <Group gap="sm">
            <IconChefHat size={18} color="var(--mantine-color-blue-5)" />
            <div>
              <Text size="10px" c="dimmed">
                1 Kisi / Gunluk
              </Text>
              <Text size="md" fw={700}>
                {gunlukOrtalama.toFixed(2)} TL
              </Text>
            </div>
          </Group>
          <Group gap="sm">
            <IconCalculator size={18} color="var(--mantine-color-teal-5)" />
            <div>
              <Text size="10px" c="dimmed">
                1 Kisi / {gunSayisiNum} Gun Toplam
              </Text>
              <Text size="md" fw={700}>
                {totalMaliyet.toFixed(2)} TL
              </Text>
            </div>
          </Group>
          <Group gap="sm">
            <IconBuildingCommunity size={18} color="var(--mantine-color-violet-5)" />
            <div>
              <Text size="10px" c="dimmed">
                Toplam Yemek
              </Text>
              <Text size="md" fw={700}>
                {toplamYemek} cesit
              </Text>
            </div>
          </Group>
        </SimpleGrid>

        {/* Row 2: Total cost with kisi sayisi */}
        <Paper
          p="sm"
          radius="sm"
          style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)' }}
        >
          <Group justify="space-between" wrap="wrap">
            <Group gap="sm">
              <IconCoin size={20} color="var(--mantine-color-green-5)" />
              <div>
                <Text size="10px" c="dimmed">
                  {kisiSayisi} kisi x {gunSayisiNum} gun x {gunlukOrtalama.toFixed(2)} TL
                </Text>
                <Text size="lg" fw={700} c="green">
                  {(gunlukOrtalama * kisiSayisi * gunSayisiNum).toLocaleString('tr-TR', { minimumFractionDigits: 0 })}{' '}
                  TL
                </Text>
              </div>
            </Group>
            <Stack gap={2} align="flex-end">
              <Text size="10px" c="dimmed">
                Gunluk ({kisiSayisi} kisi):{' '}
                {(gunlukOrtalama * kisiSayisi).toLocaleString('tr-TR', { minimumFractionDigits: 0 })} TL
              </Text>
              <Text size="10px" c="dimmed">
                Ogun basi ({kisiSayisi} kisi):{' '}
                {toplamYemek > 0
                  ? ((totalMaliyet / toplamYemek) * ogunTipleri.length * kisiSayisi).toLocaleString('tr-TR', {
                      minimumFractionDigits: 0,
                    })
                  : '0'}{' '}
                TL
              </Text>
            </Stack>
          </Group>
        </Paper>
      </Paper>
    </Stack>
  );
}

// ─── Cell Component ───────────────────────────────────────────

function KurumMenuCell({
  gunNo,
  ogunKod,
  yemekler,
  isOpen,
  isWeekStart,
  onToggle,
  onAddRecete,
  onRemoveYemek,
  onClear,
  receteler,
  receteLoading,
  searchText,
  onSearchChange,
}: {
  gunNo: number;
  ogunKod: string;
  yemekler: CellYemek[];
  isOpen: boolean;
  isWeekStart?: boolean;
  onToggle: () => void;
  onAddRecete: (r: Recete) => void;
  onRemoveYemek: (yemekId: string) => void;
  onClear: () => void;
  receteler: Recete[];
  receteLoading: boolean;
  searchText: string;
  onSearchChange: (v: string) => void;
}) {
  const cellMaliyet = yemekler.reduce((s, y) => s + (Number(y.fiyat) || 0), 0);
  const [eklemeAcik, setEklemeAcik] = useState(false);
  // Bos hucrelerde dropdown otomatik acik
  const eklemeGoster = eklemeAcik || yemekler.length === 0;

  return (
    <Box
      style={{
        flex: '1 0 0',
        minWidth: 0,
        borderLeft: isWeekStart ? '2px solid var(--mantine-color-dark-4)' : undefined,
        paddingLeft: isWeekStart ? 2 : undefined,
      }}
      px={1}
    >
      <Popover
        opened={isOpen}
        onChange={(o) => {
          if (!o) {
            setEklemeAcik(false);
            onToggle();
          }
        }}
        width={340}
        position="bottom-start"
        shadow="xl"
      >
        <Popover.Target>
          <Paper
            p={4}
            radius="sm"
            onClick={onToggle}
            style={{
              minHeight: 120,
              cursor: 'pointer',
              border: isOpen
                ? '1px solid var(--mantine-color-blue-5)'
                : `1px solid ${yemekler.length > 0 ? 'var(--mantine-color-dark-4)' : 'var(--mantine-color-dark-6)'}`,
              background: yemekler.length > 0 ? 'var(--mantine-color-dark-7)' : 'var(--mantine-color-dark-8)',
            }}
          >
            {yemekler.length === 0 ? (
              <Center mih={112}>
                <Stack gap={2} align="center">
                  <IconPlus size={16} color="var(--mantine-color-gray-6)" />
                  <Text size="xs" c="dimmed">
                    Ekle
                  </Text>
                </Stack>
              </Center>
            ) : (
              <Stack gap={4} align="center" justify="center" mih={112}>
                {yemekler.map((y) => (
                  <Text key={y.id} size="xs" fw={500} c="white" lineClamp={1} ta="center">
                    {y.ad}
                  </Text>
                ))}
                {cellMaliyet > 0 && (
                  <Text size="xs" c="green.5" fw={700} ta="center">
                    {cellMaliyet.toFixed(0)} TL
                  </Text>
                )}
              </Stack>
            )}
          </Paper>
        </Popover.Target>

        <Popover.Dropdown p={0}>
          <Stack gap={0}>
            {/* Baslik */}
            <Group
              justify="space-between"
              p="xs"
              style={{
                borderBottom: '1px solid var(--mantine-color-dark-4)',
                background: 'var(--mantine-color-dark-7)',
              }}
            >
              <Text size="xs" fw={600}>
                Gun {gunNo} - {ogunKod}
              </Text>
              {yemekler.length > 0 && (
                <Group gap={4}>
                  <Badge size="xs" color="green" variant="light">
                    {cellMaliyet.toFixed(2)} TL
                  </Badge>
                  <ActionIcon size="xs" variant="subtle" color="red" onClick={onClear}>
                    <IconTrash size={12} />
                  </ActionIcon>
                </Group>
              )}
            </Group>

            {/* ANA ICERIK: Secilen Receteler (On Planda) */}
            <Box p="xs">
              {yemekler.length === 0 ? (
                <Stack align="center" py="md" gap={4}>
                  <IconChefHat size={20} color="var(--mantine-color-gray-6)" />
                  <Text size="xs" c="dimmed" ta="center">
                    Henuz recete eklenmedi
                  </Text>
                </Stack>
              ) : (
                <Stack gap={4}>
                  <Text size="10px" c="dimmed" fw={600}>
                    Receteler ({yemekler.length})
                  </Text>
                  <ScrollArea.Autosize mah={180}>
                    <Stack gap={3}>
                      {yemekler.map((y) => (
                        <Group
                          key={y.id}
                          justify="space-between"
                          wrap="nowrap"
                          px={8}
                          py={5}
                          style={{
                            borderRadius: 6,
                            background: 'var(--mantine-color-dark-6)',
                            border: '1px solid var(--mantine-color-dark-4)',
                          }}
                        >
                          <Text size="xs" fw={500} c="white" lineClamp={1} style={{ flex: 1, minWidth: 0 }}>
                            {y.ad}
                          </Text>
                          <Group gap={4} wrap="nowrap">
                            <Text size="10px" c="green" fw={600} style={{ whiteSpace: 'nowrap' }}>
                              {(Number(y.fiyat) || 0).toFixed(1)} TL
                            </Text>
                            <ActionIcon size={16} variant="subtle" color="red" onClick={() => onRemoveYemek(y.id)}>
                              <IconX size={10} />
                            </ActionIcon>
                          </Group>
                        </Group>
                      ))}
                    </Stack>
                  </ScrollArea.Autosize>

                  {/* Toplam */}
                  <Group
                    justify="space-between"
                    px={8}
                    py={5}
                    style={{
                      borderRadius: 6,
                      background: 'rgba(16,185,129,0.08)',
                      border: '1px solid rgba(16,185,129,0.15)',
                    }}
                  >
                    <Text size="xs" fw={700}>
                      Toplam
                    </Text>
                    <Text size="xs" fw={700} c="green">
                      {cellMaliyet.toFixed(2)} TL
                    </Text>
                  </Group>
                </Stack>
              )}
            </Box>

            {/* YEMEK EKLEME DROPDOWN (Ikincil) */}
            <Box
              onClick={() => setEklemeAcik((prev) => !prev)}
              px="xs"
              py={7}
              style={{
                cursor: 'pointer',
                borderTop: '1px solid var(--mantine-color-dark-4)',
                background: eklemeGoster ? 'var(--mantine-color-dark-6)' : 'var(--mantine-color-dark-7)',
                userSelect: 'none',
              }}
            >
              <Group justify="space-between">
                <Group gap={6}>
                  <IconPlus size={13} />
                  <Text size="xs" fw={600}>
                    Yemek Ekle
                  </Text>
                </Group>
                <Text size="11px" c="dimmed">
                  {eklemeGoster ? '▲' : '▼'}
                </Text>
              </Group>
            </Box>

            {eklemeGoster && (
              <Box style={{ borderTop: '1px solid var(--mantine-color-dark-5)' }}>
                <Box p="xs" pb={6}>
                  <TextInput
                    size="xs"
                    placeholder="Recete ara..."
                    leftSection={<IconSearch size={12} />}
                    value={searchText}
                    onChange={(e) => onSearchChange(e.target.value)}
                    styles={{ input: { fontSize: 11 } }}
                  />
                </Box>

                <ScrollArea.Autosize mah={200}>
                  {receteLoading ? (
                    <Center py="sm">
                      <Loader size="xs" />
                    </Center>
                  ) : (
                    <Stack gap={0} px={4} pb={4}>
                      {receteler.map((r) => (
                        <Box
                          key={r.id}
                          px={8}
                          py={5}
                          style={{
                            cursor: 'pointer',
                            borderRadius: 4,
                            transition: 'background 0.1s',
                          }}
                          onClick={() => onAddRecete(r)}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'var(--mantine-color-dark-5)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = '';
                          }}
                        >
                          <Group justify="space-between" wrap="nowrap" gap={4}>
                            <Box style={{ flex: 1, minWidth: 0 }}>
                              <Text size="11px" fw={500} lineClamp={1}>
                                {r.ad}
                              </Text>
                              {r.kategori_adi && (
                                <Text size="9px" c="dimmed" lineClamp={1}>
                                  {r.kategori_adi}
                                  {r.malzeme_sayisi ? ` · ${r.malzeme_sayisi} malzeme` : ''}
                                </Text>
                              )}
                            </Box>
                            <Group gap={4} wrap="nowrap">
                              <Text size="10px" c="green" fw={600}>
                                {r.tahmini_maliyet ? `${Number(r.tahmini_maliyet).toFixed(1)}` : '-'}
                              </Text>
                              <IconPlus size={11} color="var(--mantine-color-green-5)" />
                            </Group>
                          </Group>
                        </Box>
                      ))}
                      {!receteLoading && receteler.length === 0 && (
                        <Text size="xs" c="dimmed" ta="center" py="sm">
                          Sonuc yok
                        </Text>
                      )}
                    </Stack>
                  )}
                </ScrollArea.Autosize>
              </Box>
            )}
          </Stack>
        </Popover.Dropdown>
      </Popover>
    </Box>
  );
}

// ─── AI Settings Popover ──────────────────────────────────────

function AiSettingsPopover({
  haricTutma,
  onHaricTutmaChange,
  ozelIstek,
  onOzelIstekChange,
  presetNotu,
}: {
  haricTutma: string[];
  onHaricTutmaChange: (v: string[]) => void;
  ozelIstek: string;
  onOzelIstekChange: (v: string) => void;
  presetNotu?: string;
}) {
  const [opened, setOpened] = useState(false);
  const hasSettings = haricTutma.length > 0 || ozelIstek.length > 0;

  return (
    <Popover opened={opened} onChange={setOpened} width={320} position="bottom-end" shadow="xl">
      <Popover.Target>
        <ActionIcon
          variant={hasSettings ? 'filled' : 'subtle'}
          color={hasSettings ? 'violet' : 'gray'}
          size="lg"
          onClick={() => setOpened((v) => !v)}
        >
          <IconAdjustments size={18} />
        </ActionIcon>
      </Popover.Target>
      <Popover.Dropdown p="sm">
        <Stack gap="sm">
          <Text size="xs" fw={600} c="dimmed">
            Gelismis AI Ayarlari
          </Text>

          <MultiSelect
            label="Haric Tut"
            placeholder="Alerjen / kisitlama sec"
            data={HARIC_TUTMA_OPTIONS}
            value={haricTutma}
            onChange={onHaricTutmaChange}
            clearable
            size="xs"
          />

          <TextInput
            label="Ozel Istek"
            placeholder="orn: Haftada 2 kez makarna olsun"
            value={ozelIstek}
            onChange={(e) => onOzelIstekChange(e.target.value)}
            size="xs"
          />

          {presetNotu && (
            <Paper p="xs" radius="sm" style={{ background: 'rgba(139,92,246,0.08)' }}>
              <Text size="10px" c="violet.4" fs="italic">
                Kurum notu: {presetNotu}
              </Text>
            </Paper>
          )}
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}
