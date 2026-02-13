'use client';

import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Divider,
  Group,
  Loader,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import { IconCalendarEvent, IconChefHat, IconEye, IconPlus } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { type KurumMenuOzet, kurumMenuleriAPI } from '@/lib/api/services/kurum-menuleri';
import { formatMoney } from '@/lib/formatters';
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
              {menu.ogunler.map((ogun) => (
                <Badge key={ogun.id} size="xs" variant="dot" color="teal">
                  {ogun.ogun_tipi_adi}: {ogun.yemekler?.length || 0} yemek
                </Badge>
              ))}
            </Group>
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

export function KaydedilenMenuler() {
  const { kaydedilenMenuler, kaydedilenMenulerLoading } = useMenuPlanlama();

  return (
    <Stack gap="xl">
      {/* ═══ Kurum Menüleri ═══ */}
      <KurumMenuleriSection />

      <Divider label="Proje Menü Planları" labelPosition="center" color="dark.4" />

      {/* ═══ Kayıtlı Proje Menüleri ═══ */}
      <ProjeMenuleriSection menuler={kaydedilenMenuler} loading={kaydedilenMenulerLoading} />
    </Stack>
  );
}

// ─── Kurum Menüleri Section ───────────────────────────────────

function KurumMenuleriSection() {
  const router = useRouter();

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
              Kurum Menuleri
            </Text>
            <Text size="xs" c="dimmed">
              Kurum tipine gore hazir menu sablonlari
            </Text>
          </div>
        </Group>
        <Button
          size="xs"
          variant="light"
          color="green"
          leftSection={<IconPlus size={14} />}
          onClick={() => router.push('/menu-planlama?tab=kurum-menuleri')}
        >
          Yeni Sablon
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
              Henuz kurum menusu olusturulmamis
            </Text>
            <Button
              size="xs"
              variant="subtle"
              color="green"
              onClick={() => router.push('/menu-planlama?tab=kurum-menuleri')}
            >
              Ilk sablonu olustur
            </Button>
          </Stack>
        </Paper>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="sm">
          {menuler.map((menu) => (
            <KurumMenuKart key={menu.id} menu={menu} onClick={() => router.push('/menu-planlama?tab=kurum-menuleri')} />
          ))}
        </SimpleGrid>
      )}
    </Box>
  );
}

// ─── Kurum Menü Kartı ─────────────────────────────────────────

function KurumMenuKart({ menu, onClick }: { menu: KurumMenuOzet; onClick: () => void }) {
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
            {Number(menu.gunluk_maliyet).toFixed(0)} TL/gun
          </Badge>
        )}
      </Group>
      <Group gap={6}>
        <Badge size="xs" color={menu.maliyet_seviyesi_renk || 'gray'} variant="light">
          {menu.maliyet_seviyesi_ad}
        </Badge>
        <Badge size="xs" color="gray" variant="light">
          {menu.gun_sayisi} gun
        </Badge>
        <Badge size="xs" color="gray" variant="light">
          {menu.yemek_sayisi} yemek
        </Badge>
        <Badge size="xs" variant="dot" color={menu.durum === 'aktif' ? 'green' : 'yellow'}>
          {menu.durum === 'aktif' ? 'Aktif' : 'Taslak'}
        </Badge>
      </Group>
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
