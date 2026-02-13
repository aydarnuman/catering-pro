/**
 * IngredientMatchPanel — Maliyet Ajanı Menü Seçici
 *
 * Kurum menüsü seçerek ihale maliyet hesabı yapar.
 * "Kurum Menüleri" sayfasındaki şablonlardan biri seçilir → anında maliyet görünür.
 */

import {
  Badge,
  Box,
  Button,
  Center,
  Divider,
  Group,
  Loader,
  Paper,
  ScrollArea,
  Stack,
  Text,
  ThemeIcon,
} from '@mantine/core';
import { IconArrowRight, IconChefHat, IconExternalLink, IconPlus } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { type KurumMenuOzet, kurumMenuleriAPI } from '@/lib/api/services/kurum-menuleri';

interface IngredientMatchPanelProps {
  tenderId: number;
  agentColor?: string;
}

export function IngredientMatchPanel({ agentColor = 'green' }: IngredientMatchPanelProps) {
  const router = useRouter();

  // Fetch kurum menüleri
  const { data: menuResp, isLoading } = useQuery({
    queryKey: ['kurum-menuleri-for-masa'],
    queryFn: () => kurumMenuleriAPI.getMenuler({ durum: 'aktif' }),
    staleTime: 5 * 60 * 1000,
  });

  const menuler: KurumMenuOzet[] = menuResp?.data ?? [];

  // Also fetch taslak menus
  const { data: taslakResp } = useQuery({
    queryKey: ['kurum-menuleri-taslak'],
    queryFn: () => kurumMenuleriAPI.getMenuler({ durum: 'taslak' }),
    staleTime: 5 * 60 * 1000,
  });

  const taslakMenuler: KurumMenuOzet[] = taslakResp?.data ?? [];
  const allMenuler = [...menuler, ...taslakMenuler];

  return (
    <Stack gap="md">
      {/* Header */}
      <Group gap={8}>
        <ThemeIcon size={28} variant="light" color={agentColor} radius="xl">
          <IconChefHat size={16} />
        </ThemeIcon>
        <div>
          <Text size="sm" fw={600} c="white">
            Kurum Menu Sablonlari
          </Text>
          <Text size="10px" c="dimmed">
            Hazir menu sablonlarindan maliyet hesaplayin
          </Text>
        </div>
      </Group>

      <Divider color="dark.5" />

      {/* Menu List */}
      {isLoading ? (
        <Center py="lg">
          <Loader size="sm" color={agentColor} />
        </Center>
      ) : allMenuler.length === 0 ? (
        <Stack align="center" py="lg" gap="sm">
          <IconChefHat size={36} color="var(--mantine-color-gray-6)" />
          <Text size="xs" c="dimmed" ta="center">
            Henuz kurum menusu olusturulmamis.
          </Text>
          <Text size="10px" c="dimmed" ta="center" maw={260}>
            Kurum Menuleri sayfasindan kurum tipine gore menu sablonlari olusturabilirsiniz.
          </Text>
          <Button
            size="xs"
            variant="light"
            color={agentColor}
            leftSection={<IconPlus size={14} />}
            onClick={() => router.push('/menu-planlama?tab=menuler&subtab=kurum')}
          >
            Menu Olustur
          </Button>
        </Stack>
      ) : (
        <ScrollArea.Autosize mah={400}>
          <Stack gap={6}>
            {allMenuler.map((menu) => (
              <MenuShortCard
                key={menu.id}
                menu={menu}
                onClick={() => router.push('/menu-planlama?tab=menuler&subtab=kurum')}
              />
            ))}
          </Stack>
        </ScrollArea.Autosize>
      )}

      <Divider color="dark.5" />

      {/* Go to full page */}
      <Button
        variant="subtle"
        color="gray"
        size="xs"
        rightSection={<IconExternalLink size={14} />}
        onClick={() => router.push('/menu-planlama?tab=menuler&subtab=kurum')}
        fullWidth
      >
        Tum Kurum Menuleri
      </Button>
    </Stack>
  );
}

// ─── Short Card ───────────────────────────────────────────────

function MenuShortCard({ menu, onClick }: { menu: KurumMenuOzet; onClick: () => void }) {
  return (
    <Paper
      p="xs"
      radius="md"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
        cursor: 'pointer',
        transition: 'background 0.15s',
      }}
      onClick={onClick}
    >
      <Group justify="space-between" wrap="nowrap">
        <Group gap={8} wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
          <Text size="sm">{menu.kurum_tipi_ikon}</Text>
          <Box style={{ minWidth: 0, flex: 1 }}>
            <Text size="xs" fw={600} c="white" lineClamp={1}>
              {menu.ad}
            </Text>
            <Group gap={4} mt={2}>
              <Badge size="xs" variant="light" color={menu.maliyet_seviyesi_renk || 'gray'}>
                {menu.maliyet_seviyesi_ad}
              </Badge>
              <Badge size="xs" variant="light" color="gray">
                {menu.gun_sayisi}g / {menu.yemek_sayisi}y
              </Badge>
            </Group>
          </Box>
        </Group>

        <Stack gap={2} align="flex-end" style={{ flexShrink: 0 }}>
          {menu.gunluk_maliyet > 0 ? (
            <>
              <Text size="xs" fw={700} c="green">
                {menu.gunluk_maliyet.toFixed(2)} TL
              </Text>
              <Text size="9px" c="dimmed">
                gun / kisi
              </Text>
            </>
          ) : (
            <Badge size="xs" variant="light" color="orange">
              Taslak
            </Badge>
          )}
          <IconArrowRight size={12} color="var(--mantine-color-gray-6)" />
        </Stack>
      </Group>
    </Paper>
  );
}
