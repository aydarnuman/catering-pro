'use client';

import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Group,
  Loader,
  Paper,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import {
  IconArrowLeft,
  IconBuildingCommunity,
  IconCalendarEvent,
  IconChefHat,
  IconEye,
  IconFile,
  IconPlus,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { type KurumMenuOzet, kurumMenuleriAPI } from '@/lib/api/services/kurum-menuleri';
import { formatMoney } from '@/lib/formatters';
import { KurumMenuTakvim } from './KurumMenuTakvim';
import { type MenuPlan, useMenuPlanlama } from './MenuPlanlamaContext';

// Kaydedilen Menü Kartı
const KaydedilenMenuKart = ({ menu }: { menu: MenuPlan }) => {
  const formatTarih = (tarihStr: string) => {
    const tarih = new Date(tarihStr);
    return tarih.toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <Paper
      p="sm"
      radius="md"
      style={{
        background: 'var(--mantine-color-dark-7)',
        border: '1px solid var(--mantine-color-dark-5)',
      }}
    >
      <Group justify="space-between" wrap="nowrap">
        <Box style={{ flex: 1, minWidth: 0 }}>
          <Group gap={8} wrap="nowrap">
            <Badge size="sm" variant="light" color="blue">
              {formatTarih(menu.baslangic_tarihi)}
            </Badge>
            <Text size="sm" truncate fw={500}>
              {menu.ad}
            </Text>
          </Group>

          {menu.ogunler && menu.ogunler.length > 0 && (
            <Group gap={6} mt={6}>
              {menu.ogunler.map((ogun) => {
                const ogunMaliyet = ogun.yemekler?.reduce((s, y) => s + (y.porsiyon_maliyet || 0), 0) || 0;
                return (
                  <Badge key={ogun.id} size="xs" variant="dot" color="teal">
                    {ogun.ogun_tipi_adi}: {ogun.yemekler?.length || 0} yemek
                    {ogunMaliyet > 0 && ` · ${formatMoney(ogunMaliyet)}`}
                  </Badge>
                );
              })}
            </Group>
          )}
          {menu.varsayilan_kisi_sayisi > 0 && (
            <Text size="10px" c="dimmed" mt={4}>
              {menu.varsayilan_kisi_sayisi.toLocaleString('tr-TR')} kişi
              {menu.toplam_maliyet && menu.varsayilan_kisi_sayisi > 0
                ? ` · Kişi başı ${formatMoney(menu.toplam_maliyet / menu.varsayilan_kisi_sayisi)}`
                : ''}
            </Text>
          )}
        </Box>

        <Group gap={8} wrap="nowrap">
          <Text size="sm" fw={600} c="teal">
            {formatMoney(menu.toplam_maliyet || 0)}
          </Text>

          <Tooltip label="Detay">
            <ActionIcon variant="subtle" color="gray" size="sm">
              <IconEye size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>
    </Paper>
  );
};

const MENU_SUBTABS = ['kurum', 'proje'] as const;

export function KaydedilenMenuler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { kaydedilenMenuler, kaydedilenMenulerLoading } = useMenuPlanlama();

  const subtabParam = searchParams.get('subtab');
  const initialSubtab = MENU_SUBTABS.includes(subtabParam as (typeof MENU_SUBTABS)[number]) ? subtabParam : 'kurum';
  const [activeSubtab, setActiveSubtab] = useState<string | null>(initialSubtab);

  const [kurumView, setKurumView] = useState<'list' | 'editor'>('list');
  const [selectedKurumMenuId, setSelectedKurumMenuId] = useState<number | null>(null);

  const handleSubtabChange = useCallback(
    (value: string | null) => {
      setActiveSubtab(value);
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', 'menuler');
      if (value && value !== 'kurum') {
        params.set('subtab', value);
      } else {
        params.delete('subtab');
      }
      const qs = params.toString();
      router.replace(`/menu-planlama?${qs}`, { scroll: false });
    },
    [router, searchParams]
  );

  useEffect(() => {
    if (MENU_SUBTABS.includes(subtabParam as (typeof MENU_SUBTABS)[number])) {
      setActiveSubtab(subtabParam);
    }
  }, [subtabParam]);

  return (
    <Tabs value={activeSubtab} onChange={handleSubtabChange} variant="default" radius="sm">
      <Tabs.List mb="md">
        <Tabs.Tab value="kurum" leftSection={<IconBuildingCommunity size={16} />}>
          Kurum Menüleri
        </Tabs.Tab>
        <Tabs.Tab value="proje" leftSection={<IconFile size={16} />}>
          Proje Menüleri
        </Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value="kurum">
        {kurumView === 'list' ? (
          <KurumMenuleriSection
            onNewTemplate={() => {
              setSelectedKurumMenuId(null);
              setKurumView('editor');
            }}
            onSelectTemplate={(menuId) => {
              setSelectedKurumMenuId(menuId ?? null);
              setKurumView('editor');
            }}
          />
        ) : (
          <Stack gap="md">
            <Button
              variant="subtle"
              leftSection={<IconArrowLeft size={16} />}
              onClick={() => {
                setKurumView('list');
                setSelectedKurumMenuId(null);
              }}
              size="sm"
            >
              Listeye dön
            </Button>
            <KurumMenuTakvim initialMenuId={selectedKurumMenuId} />
          </Stack>
        )}
      </Tabs.Panel>

      <Tabs.Panel value="proje">
        <ProjeMenuleriSection menuler={kaydedilenMenuler} loading={kaydedilenMenulerLoading} />
      </Tabs.Panel>
    </Tabs>
  );
}

// ─── Kurum Menüleri Section ───────────────────────────────────

function KurumMenuleriSection({
  onNewTemplate,
  onSelectTemplate,
}: {
  onNewTemplate: () => void;
  onSelectTemplate: (menuId?: number) => void;
}) {
  const { data: menuResp, isLoading } = useQuery({
    queryKey: ['kurum-menuleri-tab'],
    queryFn: () => kurumMenuleriAPI.getMenuler(),
    staleTime: 5 * 60 * 1000,
  });

  const menuler: KurumMenuOzet[] = menuResp?.data ?? [];

  return (
    <Box>
      <Group justify="space-between" mb="md">
        <Group gap="xs">
          <ThemeIcon size="md" color="green" variant="light">
            <IconChefHat size={16} />
          </ThemeIcon>
          <div>
            <Text fw={600} size="sm">
              Kurum Menüleri
            </Text>
            <Text size="xs" c="dimmed">
              Kurum tipine göre hazır menü şablonları
            </Text>
          </div>
        </Group>
        <Button size="xs" variant="light" color="green" leftSection={<IconPlus size={14} />} onClick={onNewTemplate}>
          Yeni Şablon
        </Button>
      </Group>

      {isLoading ? (
        <Group justify="center" py="md">
          <Loader size="xs" />
        </Group>
      ) : menuler.length === 0 ? (
        <Paper
          p="lg"
          radius="md"
          withBorder
          style={{
            borderStyle: 'dashed',
            borderColor: 'var(--mantine-color-dark-4)',
          }}
        >
          <Stack align="center" gap="sm">
            <IconChefHat size={32} color="var(--mantine-color-gray-6)" />
            <Text size="sm" c="dimmed" ta="center">
              Henüz kurum menüsü oluşturulmamış
            </Text>
            <Button size="xs" variant="subtle" color="green" onClick={onNewTemplate}>
              İlk şablonu oluştur
            </Button>
          </Stack>
        </Paper>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="sm">
          {menuler.map((menu) => (
            <KurumMenuKart key={menu.id} menu={menu} onClick={() => onSelectTemplate(menu.id)} />
          ))}
        </SimpleGrid>
      )}
    </Box>
  );
}

// ─── Kurum Menü Kartı ─────────────────────────────────────────

function KurumMenuKart({ menu, onClick }: { menu: KurumMenuOzet; onClick: () => void }) {
  const formatTarih = (tarihStr: string) => {
    const d = new Date(tarihStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffGun = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffGun === 0) return 'Bugün';
    if (diffGun === 1) return 'Dün';
    if (diffGun < 7) return `${diffGun} gün önce`;
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  };

  return (
    <Card p="sm" radius="md" withBorder style={{ cursor: 'pointer' }} onClick={onClick}>
      <Group justify="space-between" wrap="nowrap" mb={6}>
        <Group gap={8} wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
          <Text size="lg">{menu.kurum_tipi_ikon}</Text>
          <Text size="sm" fw={600} lineClamp={1}>
            {menu.ad}
          </Text>
        </Group>
        {Number(menu.gunluk_maliyet) > 0 && (
          <Badge size="sm" color="green" variant="light">
            {Number(menu.gunluk_maliyet).toFixed(0)} TL/gün
          </Badge>
        )}
      </Group>
      <Group gap={6} mb={4}>
        <Badge size="xs" color={menu.maliyet_seviyesi_renk || 'gray'} variant="light">
          {menu.maliyet_seviyesi_ad}
        </Badge>
        <Badge size="xs" color="gray" variant="light">
          {menu.gun_sayisi} gün
        </Badge>
        <Badge size="xs" color="gray" variant="light">
          {menu.yemek_sayisi} yemek
        </Badge>
        <Badge size="xs" variant="dot" color={menu.durum === 'aktif' ? 'green' : 'yellow'}>
          {menu.durum === 'aktif' ? 'Aktif' : 'Taslak'}
        </Badge>
      </Group>
      {/* Ek bilgiler: kişi, öğün, toplam maliyet, son güncelleme, kullanım */}
      <Group gap="xs" wrap="nowrap" style={{ flexWrap: 'wrap' }}>
        {menu.kisi_sayisi > 0 && (
          <Text size="xs" c="dimmed">
            {menu.kisi_sayisi} kişi
          </Text>
        )}
        {menu.ogun_sayisi > 0 && (
          <Text size="xs" c="dimmed">
            • {menu.ogun_sayisi} öğün
          </Text>
        )}
        {Number(menu.toplam_maliyet) > 0 && (
          <Text size="xs" c="dimmed">
            • Toplam {formatMoney(menu.toplam_maliyet)}
          </Text>
        )}
        {menu.updated_at && (
          <Text size="xs" c="dimmed" title={new Date(menu.updated_at).toLocaleString('tr-TR')}>
            • {formatTarih(menu.updated_at)}
          </Text>
        )}
        {menu.kullanim_sayisi > 0 && (
          <Text size="xs" c="dimmed">
            • {menu.kullanim_sayisi} kullanım
          </Text>
        )}
      </Group>
      {menu.etiketler && menu.etiketler.length > 0 && (
        <Group gap={4} mt={4} wrap="wrap">
          {menu.etiketler.slice(0, 3).map((etiket) => (
            <Badge key={etiket} size="xs" variant="outline" color="gray">
              {etiket}
            </Badge>
          ))}
        </Group>
      )}
    </Card>
  );
}

// ─── Proje Menüleri Section ───────────────────────────────────

function ProjeMenuleriSection({ menuler, loading }: { menuler: MenuPlan[]; loading: boolean }) {
  if (loading) {
    return (
      <Paper p="xl" radius="md" withBorder>
        <Group justify="center" py="xl">
          <Loader size="sm" />
          <Text>Menüler yükleniyor...</Text>
        </Group>
      </Paper>
    );
  }

  if (menuler.length === 0) {
    return (
      <Paper p="xl" radius="md" withBorder>
        <Stack align="center" gap="md" py="xl">
          <ThemeIcon size={60} radius="xl" variant="light" color="gray">
            <IconCalendarEvent size={30} />
          </ThemeIcon>
          <Stack gap={4} align="center">
            <Text fw={500}>Henüz kaydedilmiş proje menüsü yok</Text>
            <Text size="sm" c="dimmed" ta="center">
              Planlama &gt; Takvim bölümünden menü oluşturup kaydedin
            </Text>
          </Stack>
        </Stack>
      </Paper>
    );
  }

  // Menüleri projeye göre grupla
  const menulerByProje = menuler.reduce(
    (acc, menu) => {
      const projeKey = menu.proje_adi || `Proje ${menu.proje_id}`;
      if (!acc[projeKey]) {
        acc[projeKey] = [];
      }
      acc[projeKey].push(menu);
      return acc;
    },
    {} as Record<string, MenuPlan[]>
  );

  return (
    <Stack gap="md">
      {Object.entries(menulerByProje).map(([projeName, projeMenuler]) => (
        <Paper
          key={projeName}
          p="md"
          radius="md"
          withBorder
          style={{
            background: 'var(--mantine-color-dark-6)',
            borderColor: 'var(--mantine-color-dark-4)',
          }}
        >
          <Group gap="xs" mb="sm">
            <ThemeIcon size="sm" color="violet" variant="light">
              <IconCalendarEvent size={14} />
            </ThemeIcon>
            <Text size="sm" fw={600}>
              {projeName}
            </Text>
            <Badge size="xs" variant="light" color="violet">
              {projeMenuler.length} menü
            </Badge>
          </Group>

          <Stack gap="xs">
            {projeMenuler.map((menu) => (
              <KaydedilenMenuKart key={menu.id} menu={menu} />
            ))}
          </Stack>
        </Paper>
      ))}
    </Stack>
  );
}
