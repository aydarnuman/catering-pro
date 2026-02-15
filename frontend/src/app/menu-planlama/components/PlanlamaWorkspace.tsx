'use client';

import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Collapse,
  Group,
  Loader,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconArrowLeft,
  IconBolt,
  IconBuildingCommunity,
  IconCalendarEvent,
  IconCheck,
  IconChefHat,
  IconChevronDown,
  IconChevronRight,
  IconEdit,
  IconPlus,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { type KurumMenuOzet, kurumMenuleriAPI } from '@/lib/api/services/kurum-menuleri';
import { menuPlanlamaAPI } from '@/lib/api/services/menu-planlama';
import { formatMoney } from '@/lib/formatters';
import { HizliGunlukMenuModal } from './HizliGunlukMenuModal';
import { KurumMenuTakvim } from './KurumMenuTakvim';
import { type MenuPlan, useMenuPlanlama } from './MenuPlanlamaContext';
import { MenuTakvim } from './MenuTakvim';

type ViewState = { type: 'hub' } | { type: 'proje'; planId?: number } | { type: 'kurum'; menuId?: number };

interface PlanlamaWorkspaceProps {
  initialMode?: 'proje' | 'kurum';
}

export function PlanlamaWorkspace({ initialMode }: PlanlamaWorkspaceProps) {
  const [view, setView] = useState<ViewState>(initialMode === 'kurum' ? { type: 'kurum' } : { type: 'hub' });

  const goBack = () => setView({ type: 'hub' });

  if (view.type === 'proje') {
    return (
      <Stack gap="md">
        <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={goBack} size="sm" w="fit-content">
          Tüm Planlar
        </Button>
        <MenuTakvim />
      </Stack>
    );
  }

  if (view.type === 'kurum') {
    return (
      <Stack gap="md">
        <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={goBack} size="sm" w="fit-content">
          Tüm Planlar
        </Button>
        <KurumMenuTakvim initialMenuId={view.menuId ?? null} />
      </Stack>
    );
  }

  return <PlanlamaHub onNavigate={setView} />;
}

// ─── Hub ─────────────────────────────────────────────────────

function PlanlamaHub({ onNavigate }: { onNavigate: (view: ViewState) => void }) {
  const { kaydedilenMenuler, kaydedilenMenulerLoading, refetchMenuler } = useMenuPlanlama();
  const [projeOpen, setProjeOpen] = useState(true);
  const [gunlukOpen, setGunlukOpen] = useState(true);
  const [kurumOpen, setKurumOpen] = useState(false);
  const [gunlukModalOpened, setGunlukModalOpened] = useState(false);

  const {
    data: kurumMenuResp,
    isLoading: kurumLoading,
    refetch: refetchKurum,
  } = useQuery({
    queryKey: ['kurum-menuleri-hub'],
    queryFn: () => kurumMenuleriAPI.getMenuler(),
    staleTime: 5 * 60 * 1000,
  });
  const kurumMenuler: KurumMenuOzet[] = kurumMenuResp?.data ?? [];

  // Günlük ve proje planlarını ayır
  const gunlukMenuler = useMemo(() => kaydedilenMenuler.filter((m) => m.tip === 'gunluk'), [kaydedilenMenuler]);
  const projeMenuler = useMemo(() => kaydedilenMenuler.filter((m) => m.tip !== 'gunluk'), [kaydedilenMenuler]);

  const loading = kaydedilenMenulerLoading || kurumLoading;
  const hicPlanYok = projeMenuler.length === 0 && gunlukMenuler.length === 0 && kurumMenuler.length === 0;

  return (
    <Stack gap="lg">
      {/* Yeni oluştur kartları */}
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
        <Card
          p="md"
          radius="md"
          withBorder
          style={{ cursor: 'pointer', borderStyle: 'dashed' }}
          onClick={() => onNavigate({ type: 'proje' })}
        >
          <Group gap="md" wrap="nowrap">
            <ThemeIcon size={44} radius="xl" variant="light" color="indigo">
              <IconCalendarEvent size={22} />
            </ThemeIcon>
            <Box>
              <Group gap={6}>
                <Text fw={600} size="sm">
                  Yeni Proje Planı
                </Text>
                <IconPlus size={14} style={{ opacity: 0.5 }} />
              </Group>
              <Text size="xs" c="dimmed">
                Tarihe bağlı haftalık/aylık menü planı
              </Text>
            </Box>
          </Group>
        </Card>

        <Card
          p="md"
          radius="md"
          withBorder
          style={{ cursor: 'pointer', borderStyle: 'dashed' }}
          onClick={() => setGunlukModalOpened(true)}
        >
          <Group gap="md" wrap="nowrap">
            <ThemeIcon size={44} radius="xl" variant="light" color="orange">
              <IconBolt size={22} />
            </ThemeIcon>
            <Box>
              <Group gap={6}>
                <Text fw={600} size="sm">
                  Hızlı Günlük Menü
                </Text>
                <IconPlus size={14} style={{ opacity: 0.5 }} />
              </Group>
              <Text size="xs" c="dimmed">
                Tek öğünlük menü oluştur, maliyeti karşılaştır
              </Text>
            </Box>
          </Group>
        </Card>

        <Card
          p="md"
          radius="md"
          withBorder
          style={{ cursor: 'pointer', borderStyle: 'dashed' }}
          onClick={() => onNavigate({ type: 'kurum' })}
        >
          <Group gap="md" wrap="nowrap">
            <ThemeIcon size={44} radius="xl" variant="light" color="green">
              <IconBuildingCommunity size={22} />
            </ThemeIcon>
            <Box>
              <Group gap={6}>
                <Text fw={600} size="sm">
                  Yeni Kurum Şablonu
                </Text>
                <IconPlus size={14} style={{ opacity: 0.5 }} />
              </Group>
              <Text size="xs" c="dimmed">
                Kurum tipine göre tekrar kullanılabilir şablon
              </Text>
            </Box>
          </Group>
        </Card>
      </SimpleGrid>

      {/* Kaydedilen planlar */}
      {loading ? (
        <Group justify="center" py="xl">
          <Loader size="sm" />
        </Group>
      ) : hicPlanYok ? (
        <Paper p="xl" radius="md" withBorder style={{ borderStyle: 'dashed' }}>
          <Stack align="center" gap="sm" py="md">
            <IconChefHat size={36} style={{ opacity: 0.4 }} />
            <Text size="sm" c="dimmed" ta="center">
              Henüz kaydedilmiş plan yok. Yukarıdan yeni bir plan oluşturun.
            </Text>
          </Stack>
        </Paper>
      ) : (
        <Stack gap="md">
          {/* Proje planları (üstte) */}
          {projeMenuler.length > 0 && (
            <ProjePlanlariSection
              menuler={projeMenuler}
              open={projeOpen}
              onToggle={() => setProjeOpen((o) => !o)}
              onNavigate={onNavigate}
            />
          )}

          {/* Günlük menüler (ortada) */}
          {gunlukMenuler.length > 0 && (
            <Box>
              <UnstyledButton onClick={() => setGunlukOpen((o) => !o)} style={{ width: '100%' }}>
                <Group gap="xs" mb={gunlukOpen ? 'sm' : 0}>
                  {gunlukOpen ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
                  <ThemeIcon size="sm" color="orange" variant="light">
                    <IconBolt size={14} />
                  </ThemeIcon>
                  <Text size="sm" fw={600}>
                    Günlük Menüler
                  </Text>
                  <Badge size="xs" variant="light" color="orange">
                    {gunlukMenuler.length}
                  </Badge>
                </Group>
              </UnstyledButton>
              <Collapse in={gunlukOpen}>
                <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="sm">
                  {gunlukMenuler.map((menu) => (
                    <GunlukMenuCard key={menu.id} menu={menu} onRefetch={refetchMenuler} />
                  ))}
                </SimpleGrid>
              </Collapse>
            </Box>
          )}

          {/* Kurum şablonları (altta, varsayılan kapalı) */}
          {kurumMenuler.length > 0 && (
            <Box>
              <UnstyledButton onClick={() => setKurumOpen((o) => !o)} style={{ width: '100%' }}>
                <Group gap="xs" mb={kurumOpen ? 'sm' : 0}>
                  {kurumOpen ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
                  <ThemeIcon size="sm" color="green" variant="light">
                    <IconBuildingCommunity size={14} />
                  </ThemeIcon>
                  <Text size="sm" fw={600}>
                    Kurum Şablonları
                  </Text>
                  <Badge size="xs" variant="light" color="green">
                    {kurumMenuler.length}
                  </Badge>
                </Group>
              </UnstyledButton>
              <Collapse in={kurumOpen}>
                <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="sm">
                  {kurumMenuler.map((menu) => (
                    <KurumMenuCard
                      key={menu.id}
                      menu={menu}
                      onClick={() => onNavigate({ type: 'kurum', menuId: menu.id })}
                      onRefetch={refetchKurum}
                    />
                  ))}
                </SimpleGrid>
              </Collapse>
            </Box>
          )}
        </Stack>
      )}

      {/* Hızlı Günlük Menü Modal */}
      <HizliGunlukMenuModal opened={gunlukModalOpened} onClose={() => setGunlukModalOpened(false)} />
    </Stack>
  );
}

// ─── Ortak Kart Kabuğu (rename + delete) ─────────────────────

interface MenuPlanCardShellProps {
  name: string;
  icon: React.ReactNode;
  onRename: (newName: string) => Promise<unknown>;
  onDelete: () => Promise<unknown>;
  deleteSuccessMessage?: string;
  onClick?: () => void;
  rightOfName?: React.ReactNode;
  children?: React.ReactNode;
}

function MenuPlanCardShell({
  name,
  icon,
  onRename,
  onDelete,
  deleteSuccessMessage = 'Silindi',
  onClick,
  rightOfName,
  children,
}: MenuPlanCardShellProps) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(name);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const renameMutation = useMutation({
    mutationFn: () => onRename(editName.trim()),
    onSuccess: () => setEditing(false),
    onError: () => notifications.show({ title: 'Hata', message: 'İsim güncellenemedi', color: 'red' }),
  });

  const deleteMutation = useMutation({
    mutationFn: onDelete,
    onSuccess: () => notifications.show({ title: 'Silindi', message: deleteSuccessMessage, color: 'teal' }),
    onError: () => notifications.show({ title: 'Hata', message: 'Silinemedi', color: 'red' }),
  });

  return (
    <Card
      p="sm"
      radius="md"
      withBorder
      style={{ cursor: editing ? 'default' : 'pointer' }}
      onClick={editing ? undefined : onClick}
    >
      <Group justify="space-between" wrap="nowrap" mb={6}>
        <Group gap={8} wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
          {icon}
          {editing ? (
            <Group gap={4} wrap="nowrap" style={{ flex: 1 }} onClick={(e) => e.stopPropagation()}>
              <TextInput
                size="xs"
                value={editName}
                onChange={(e) => setEditName(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && editName.trim()) renameMutation.mutate();
                  if (e.key === 'Escape') {
                    setEditing(false);
                    setEditName(name);
                  }
                }}
                style={{ flex: 1 }}
                autoFocus
              />
              <ActionIcon
                size="xs"
                color="teal"
                variant="light"
                onClick={() => editName.trim() && renameMutation.mutate()}
                loading={renameMutation.isPending}
              >
                <IconCheck size={12} />
              </ActionIcon>
              <ActionIcon
                size="xs"
                color="gray"
                variant="subtle"
                onClick={() => {
                  setEditing(false);
                  setEditName(name);
                }}
              >
                <IconX size={12} />
              </ActionIcon>
            </Group>
          ) : (
            <Text size="sm" fw={600} lineClamp={1}>
              {name}
            </Text>
          )}
        </Group>

        {!editing && (
          <Group gap={4} wrap="nowrap" onClick={(e) => e.stopPropagation()}>
            {rightOfName}
            <Tooltip label="Yeniden adlandır" withArrow>
              <ActionIcon size="xs" variant="subtle" color="gray" onClick={() => setEditing(true)}>
                <IconEdit size={12} />
              </ActionIcon>
            </Tooltip>
            {confirmDelete ? (
              <Group gap={2}>
                <ActionIcon
                  size="xs"
                  variant="filled"
                  color="red"
                  onClick={() => deleteMutation.mutate()}
                  loading={deleteMutation.isPending}
                >
                  <IconCheck size={12} />
                </ActionIcon>
                <ActionIcon size="xs" variant="subtle" color="gray" onClick={() => setConfirmDelete(false)}>
                  <IconX size={12} />
                </ActionIcon>
              </Group>
            ) : (
              <Tooltip label="Sil" withArrow>
                <ActionIcon size="xs" variant="subtle" color="red" onClick={() => setConfirmDelete(true)}>
                  <IconTrash size={12} />
                </ActionIcon>
              </Tooltip>
            )}
          </Group>
        )}
      </Group>

      {children}
    </Card>
  );
}

// ─── Günlük Menü Kartı ──────────────────────────────────────

function GunlukMenuCard({ menu, onRefetch }: { menu: MenuPlan; onRefetch: () => void }) {
  const formatTarih = (tarihStr: string) => {
    const tarih = new Date(tarihStr);
    return tarih.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });
  };

  return (
    <MenuPlanCardShell
      name={menu.ad}
      icon={
        <ThemeIcon size="xs" color="orange" variant="light" radius="xl">
          <IconBolt size={10} />
        </ThemeIcon>
      }
      onRename={(newName) => menuPlanlamaAPI.updateMenuPlan(menu.id, { ad: newName }).then(() => onRefetch())}
      onDelete={() => menuPlanlamaAPI.deleteMenuPlan(menu.id).then(() => onRefetch())}
      deleteSuccessMessage="Menü silindi"
      rightOfName={
        <Text size="sm" fw={600} c="teal">
          {formatMoney(menu.toplam_maliyet || 0)}
        </Text>
      }
    >
      <Group gap={6}>
        <Badge size="xs" color="orange" variant="light">
          {formatTarih(menu.baslangic_tarihi)}
        </Badge>
      </Group>
    </MenuPlanCardShell>
  );
}

// ─── Kurum Menü Kartı ────────────────────────────────────────

function KurumMenuCard({
  menu,
  onClick,
  onRefetch,
}: {
  menu: KurumMenuOzet;
  onClick: () => void;
  onRefetch: () => void;
}) {
  return (
    <MenuPlanCardShell
      name={menu.ad}
      icon={<Text size="lg">{menu.kurum_tipi_ikon}</Text>}
      onRename={(newName) => kurumMenuleriAPI.updateMenu(menu.id, { ad: newName }).then(() => onRefetch())}
      onDelete={() => kurumMenuleriAPI.deleteMenu(menu.id).then(() => onRefetch())}
      deleteSuccessMessage="Şablon silindi"
      onClick={onClick}
    >
      <Group gap={6}>
        <Badge size="xs" color={menu.maliyet_seviyesi_renk || 'gray'} variant="light">
          {menu.maliyet_seviyesi_ad}
        </Badge>
        <Badge size="xs" color="gray" variant="light">
          {menu.gun_sayisi} gün
        </Badge>
        <Badge size="xs" color="gray" variant="light">
          {menu.yemek_sayisi} yemek
        </Badge>
        {Number(menu.gunluk_maliyet) > 0 && (
          <Badge size="xs" color="green" variant="light">
            {Number(menu.gunluk_maliyet).toFixed(0)} TL/gün
          </Badge>
        )}
      </Group>
    </MenuPlanCardShell>
  );
}

// ─── Proje Menü Kartı ────────────────────────────────────────

function ProjeMenuCard({ menu, onClick, onRefetch }: { menu: MenuPlan; onClick: () => void; onRefetch: () => void }) {
  const formatTarih = (tarihStr: string) => {
    const tarih = new Date(tarihStr);
    return tarih.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <MenuPlanCardShell
      name={menu.ad}
      icon={
        <Badge size="sm" variant="light" color="blue">
          {formatTarih(menu.baslangic_tarihi)}
        </Badge>
      }
      onRename={(newName) => menuPlanlamaAPI.updateMenuPlan(menu.id, { ad: newName }).then(() => onRefetch())}
      onDelete={() => menuPlanlamaAPI.deleteMenuPlan(menu.id).then(() => onRefetch())}
      deleteSuccessMessage="Plan silindi"
      onClick={onClick}
      rightOfName={
        <Text size="sm" fw={600} c="teal">
          {formatMoney(menu.toplam_maliyet || 0)}
        </Text>
      }
    >
      {menu.varsayilan_kisi_sayisi > 0 && (
        <Text size="10px" c="dimmed">
          {menu.varsayilan_kisi_sayisi.toLocaleString('tr-TR')} kişi
        </Text>
      )}
    </MenuPlanCardShell>
  );
}

// ─── Proje Planları (proje bazlı gruplu) ─────────────────────

interface ProjeGrup {
  projeId: number;
  projeAdi: string;
  planlar: MenuPlan[];
}

function ProjePlanlariSection({
  menuler,
  open,
  onToggle,
  onNavigate,
}: {
  menuler: MenuPlan[];
  open: boolean;
  onToggle: () => void;
  onNavigate: (view: ViewState) => void;
}) {
  const { refetchMenuler } = useMenuPlanlama();

  const gruplar = useMemo<ProjeGrup[]>(() => {
    const map = new Map<number, ProjeGrup>();
    for (const menu of menuler) {
      const pid = menu.proje_id || 0;
      if (!map.has(pid)) {
        map.set(pid, {
          projeId: pid,
          projeAdi: menu.proje_adi || 'Projesi',
          planlar: [],
        });
      }
      map.get(pid)?.planlar.push(menu);
    }
    return Array.from(map.values());
  }, [menuler]);

  return (
    <Box>
      <UnstyledButton onClick={onToggle} style={{ width: '100%' }}>
        <Group gap="xs" mb={open ? 'sm' : 0}>
          {open ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
          <ThemeIcon size="sm" color="indigo" variant="light">
            <IconCalendarEvent size={14} />
          </ThemeIcon>
          <Text size="sm" fw={600}>
            Proje Planları
          </Text>
          <Badge size="xs" variant="light" color="indigo">
            {menuler.length}
          </Badge>
        </Group>
      </UnstyledButton>
      <Collapse in={open}>
        <Stack gap="md">
          {gruplar.map((grup) => (
            <Box key={grup.projeId}>
              <Text size="xs" fw={600} c="dimmed" mb={6} pl={4}>
                {grup.projeAdi}
                <Text span size="xs" c="dimmed" fw={400}>
                  {' '}
                  · {grup.planlar.length} plan
                </Text>
              </Text>
              <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="sm">
                {grup.planlar.map((menu) => (
                  <ProjeMenuCard
                    key={menu.id}
                    menu={menu}
                    onClick={() => onNavigate({ type: 'proje', planId: menu.id })}
                    onRefetch={refetchMenuler}
                  />
                ))}
              </SimpleGrid>
            </Box>
          ))}
        </Stack>
      </Collapse>
    </Box>
  );
}
