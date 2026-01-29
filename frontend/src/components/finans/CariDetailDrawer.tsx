'use client';

import {
  ActionIcon,
  Badge,
  Button,
  Center,
  Divider,
  Drawer,
  Group,
  Loader,
  Paper,
  ScrollArea,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  ThemeIcon,
  Timeline,
  Title,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconArrowDownRight,
  IconArrowUpRight,
  IconBuilding,
  IconCash,
  IconCreditCard,
  IconEdit,
  IconFileInvoice,
  IconHistory,
  IconMail,
  IconMapPin,
  IconPhone,
  IconReceipt,
  IconUser,
  IconWallet,
  IconX,
} from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';
import { muhasebeAPI } from '@/lib/api/services/muhasebe';
import { formatMoney } from '@/lib/formatters';
import type { Cari, CariHareket } from '@/types/domain';

interface CariDetailDrawerProps {
  cari: Cari | null;
  opened: boolean;
  onClose: () => void;
  onEdit?: (cari: Cari) => void;
  onMutabakat?: (cari: Cari) => void;
  onOdemeYap?: (cari: Cari) => void;
  onTahsilatYap?: (cari: Cari) => void;
}

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

export default function CariDetailDrawer({
  cari,
  opened,
  onClose,
  onEdit,
  onMutabakat,
  onOdemeYap,
  onTahsilatYap,
}: CariDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<string | null>('ozet');
  const [hareketler, setHareketler] = useState<CariHareket[]>([]);
  const [loading, setLoading] = useState(false);

  const loadHareketler = useCallback(async () => {
    if (!cari?.id) return;
    setLoading(true);
    try {
      const result = await muhasebeAPI.getCariHareketler(cari.id);
      if (result.success) {
        setHareketler(result.data || []);
      }
    } catch (err) {
      console.error('Hareketler yükleme hatası:', err);
    } finally {
      setLoading(false);
    }
  }, [cari?.id]);

  useEffect(() => {
    if (opened && cari?.id) {
      loadHareketler();
    }
  }, [opened, cari?.id, loadHareketler]);

  if (!cari) return null;

  const bakiye = Number(cari.alacak || 0) - Number(cari.borc || 0);
  const bakiyeColor = bakiye > 0 ? 'teal' : bakiye < 0 ? 'red' : 'gray';

  const getTipBadge = () => {
    switch (cari.tip) {
      case 'musteri':
        return (
          <Badge color="blue" variant="light">
            Müşteri
          </Badge>
        );
      case 'tedarikci':
        return (
          <Badge color="orange" variant="light">
            Tedarikçi
          </Badge>
        );
      case 'her_ikisi':
        return (
          <Badge color="grape" variant="light">
            Müşteri & Tedarikçi
          </Badge>
        );
      default:
        return null;
    }
  };

  const getHareketIcon = (tip: string) => {
    switch (tip) {
      case 'fatura_alis':
        return <IconReceipt size={14} color="var(--mantine-color-red-6)" />;
      case 'fatura_satis':
        return <IconReceipt size={14} color="var(--mantine-color-teal-6)" />;
      case 'tahsilat':
        return <IconArrowDownRight size={14} color="var(--mantine-color-teal-6)" />;
      case 'odeme':
        return <IconArrowUpRight size={14} color="var(--mantine-color-red-6)" />;
      default:
        return <IconCash size={14} />;
    }
  };

  const getHareketTipText = (tip: string) => {
    switch (tip) {
      case 'fatura_alis':
        return 'Alış Faturası';
      case 'fatura_satis':
        return 'Satış Faturası';
      case 'tahsilat':
        return 'Tahsilat';
      case 'odeme':
        return 'Ödeme';
      case 'acilis':
        return 'Açılış';
      default:
        return tip;
    }
  };

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="sm">
          <ThemeIcon size="lg" radius="xl" variant="light" color="blue">
            <IconUser size={18} />
          </ThemeIcon>
          <div>
            <Title order={4}>{cari.unvan}</Title>
            {getTipBadge()}
          </div>
        </Group>
      }
      position="right"
      size="lg"
      padding="md"
      styles={{
        header: { paddingBottom: 0 },
        body: { paddingTop: 'var(--mantine-spacing-md)' },
      }}
    >
      <Stack gap="md" h="calc(100vh - 100px)">
        {/* Hızlı Aksiyonlar */}
        <Paper p="sm" radius="md" className="standard-card">
          <Group justify="space-between" wrap="wrap" gap="xs">
            {onEdit && (
              <Button
                variant="light"
                size="xs"
                leftSection={<IconEdit size={14} />}
                onClick={() => onEdit(cari)}
              >
                Düzenle
              </Button>
            )}
            {onMutabakat && (
              <Button
                variant="light"
                size="xs"
                color="grape"
                leftSection={<IconFileInvoice size={14} />}
                onClick={() => onMutabakat(cari)}
              >
                Mutabakat
              </Button>
            )}
            {cari.tip !== 'musteri' && onOdemeYap && (
              <Button
                variant="light"
                size="xs"
                color="red"
                leftSection={<IconArrowUpRight size={14} />}
                onClick={() => onOdemeYap(cari)}
              >
                Ödeme Yap
              </Button>
            )}
            {cari.tip !== 'tedarikci' && onTahsilatYap && (
              <Button
                variant="light"
                size="xs"
                color="teal"
                leftSection={<IconArrowDownRight size={14} />}
                onClick={() => onTahsilatYap(cari)}
              >
                Tahsilat Al
              </Button>
            )}
          </Group>
        </Paper>

        {/* Bakiye Özeti */}
        <SimpleGrid cols={3}>
          <Paper p="md" radius="md" className="standard-card" ta="center">
            <Text size="xs" c="dimmed" mb={4}>
              Borç
            </Text>
            <Text fw={700} size="lg" c="red">
              {formatMoney(Number(cari.borc || 0))}
            </Text>
          </Paper>
          <Paper p="md" radius="md" className="standard-card" ta="center">
            <Text size="xs" c="dimmed" mb={4}>
              Alacak
            </Text>
            <Text fw={700} size="lg" c="teal">
              {formatMoney(Number(cari.alacak || 0))}
            </Text>
          </Paper>
          <Paper
            p="md"
            radius="md"
            ta="center"
            style={{
              background:
                bakiye > 0
                  ? 'linear-gradient(135deg, rgba(32, 201, 151, 0.1), rgba(32, 201, 151, 0.05))'
                  : bakiye < 0
                    ? 'linear-gradient(135deg, rgba(250, 82, 82, 0.1), rgba(250, 82, 82, 0.05))'
                    : undefined,
              border: `1px solid var(--mantine-color-${bakiyeColor}-3)`,
            }}
          >
            <Text size="xs" c="dimmed" mb={4}>
              Bakiye
            </Text>
            <Group gap={4} justify="center">
              {bakiye > 0 && <IconArrowUpRight size={18} color="var(--mantine-color-teal-6)" />}
              {bakiye < 0 && <IconArrowDownRight size={18} color="var(--mantine-color-red-6)" />}
              <Text fw={700} size="lg" c={bakiyeColor}>
                {formatMoney(Math.abs(bakiye))}
              </Text>
            </Group>
            <Text size="xs" c="dimmed">
              {bakiye > 0 ? 'Alacaklı' : bakiye < 0 ? 'Borçlu' : 'Dengeli'}
            </Text>
          </Paper>
        </SimpleGrid>

        {/* Tabs */}
        <Tabs value={activeTab} onChange={setActiveTab} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <Tabs.List>
            <Tabs.Tab value="ozet" leftSection={<IconUser size={14} />}>
              Bilgiler
            </Tabs.Tab>
            <Tabs.Tab value="hareketler" leftSection={<IconHistory size={14} />}>
              Hareketler
            </Tabs.Tab>
          </Tabs.List>

          {/* Bilgiler Tab */}
          <Tabs.Panel value="ozet" pt="md" style={{ flex: 1, overflow: 'auto' }}>
            <ScrollArea h="100%">
              <Stack gap="md">
                {/* İletişim Bilgileri */}
                <Paper p="md" radius="md" className="nested-card">
                  <Text size="sm" fw={600} mb="sm">
                    İletişim Bilgileri
                  </Text>
                  <Stack gap="xs">
                    {cari.yetkili && (
                      <Group gap="xs">
                        <ThemeIcon size="sm" variant="light" color="gray">
                          <IconUser size={12} />
                        </ThemeIcon>
                        <Text size="sm">{cari.yetkili}</Text>
                      </Group>
                    )}
                    {cari.telefon && (
                      <Group gap="xs">
                        <ThemeIcon size="sm" variant="light" color="gray">
                          <IconPhone size={12} />
                        </ThemeIcon>
                        <Text size="sm">{cari.telefon}</Text>
                      </Group>
                    )}
                    {cari.email && (
                      <Group gap="xs">
                        <ThemeIcon size="sm" variant="light" color="gray">
                          <IconMail size={12} />
                        </ThemeIcon>
                        <Text size="sm">{cari.email}</Text>
                      </Group>
                    )}
                    {(cari.adres || cari.il) && (
                      <Group gap="xs" align="flex-start">
                        <ThemeIcon size="sm" variant="light" color="gray">
                          <IconMapPin size={12} />
                        </ThemeIcon>
                        <Text size="sm">
                          {[cari.adres, cari.ilce, cari.il].filter(Boolean).join(', ')}
                        </Text>
                      </Group>
                    )}
                    {!cari.yetkili && !cari.telefon && !cari.email && !cari.adres && (
                      <Text size="sm" c="dimmed" fs="italic">
                        İletişim bilgisi girilmemiş
                      </Text>
                    )}
                  </Stack>
                </Paper>

                {/* Vergi Bilgileri */}
                <Paper p="md" radius="md" className="nested-card">
                  <Text size="sm" fw={600} mb="sm">
                    Vergi Bilgileri
                  </Text>
                  <Stack gap="xs">
                    {cari.vergi_no && (
                      <Group justify="space-between">
                        <Text size="sm" c="dimmed">
                          Vergi No
                        </Text>
                        <Text size="sm" fw={500}>
                          {cari.vergi_no}
                        </Text>
                      </Group>
                    )}
                    {cari.vergi_dairesi && (
                      <Group justify="space-between">
                        <Text size="sm" c="dimmed">
                          Vergi Dairesi
                        </Text>
                        <Text size="sm" fw={500}>
                          {cari.vergi_dairesi}
                        </Text>
                      </Group>
                    )}
                    {!cari.vergi_no && !cari.vergi_dairesi && (
                      <Text size="sm" c="dimmed" fs="italic">
                        Vergi bilgisi girilmemiş
                      </Text>
                    )}
                  </Stack>
                </Paper>

                {/* Banka Bilgileri */}
                {(cari.banka_adi || cari.iban) && (
                  <Paper p="md" radius="md" className="nested-card">
                    <Text size="sm" fw={600} mb="sm">
                      Banka Bilgileri
                    </Text>
                    <Stack gap="xs">
                      {cari.banka_adi && (
                        <Group justify="space-between">
                          <Text size="sm" c="dimmed">
                            Banka
                          </Text>
                          <Text size="sm" fw={500}>
                            {cari.banka_adi}
                          </Text>
                        </Group>
                      )}
                      {cari.iban && (
                        <Group justify="space-between">
                          <Text size="sm" c="dimmed">
                            IBAN
                          </Text>
                          <Text size="sm" fw={500} style={{ fontFamily: 'monospace' }}>
                            {cari.iban}
                          </Text>
                        </Group>
                      )}
                    </Stack>
                  </Paper>
                )}

                {/* Notlar */}
                {cari.notlar && (
                  <Paper p="md" radius="md" className="nested-card">
                    <Text size="sm" fw={600} mb="sm">
                      Notlar
                    </Text>
                    <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                      {cari.notlar}
                    </Text>
                  </Paper>
                )}
              </Stack>
            </ScrollArea>
          </Tabs.Panel>

          {/* Hareketler Tab */}
          <Tabs.Panel value="hareketler" pt="md" style={{ flex: 1, overflow: 'auto' }}>
            <ScrollArea h="100%">
              {loading ? (
                <Center py="xl">
                  <Loader size="md" />
                </Center>
              ) : hareketler.length === 0 ? (
                <Center py="xl">
                  <Stack align="center" gap="md">
                    <ThemeIcon size={60} radius="xl" variant="light" color="gray">
                      <IconHistory size={30} />
                    </ThemeIcon>
                    <Text c="dimmed">Bu cari için hareket kaydı bulunamadı</Text>
                  </Stack>
                </Center>
              ) : (
                <Timeline active={-1} bulletSize={24} lineWidth={2}>
                  {hareketler.slice(0, 20).map((hareket) => (
                    <Timeline.Item
                      key={hareket.id}
                      bullet={getHareketIcon(hareket.hareket_tipi)}
                      title={
                        <Group justify="space-between">
                          <Text size="sm" fw={500}>
                            {getHareketTipText(hareket.hareket_tipi)}
                          </Text>
                          <Text
                            size="sm"
                            fw={600}
                            c={Number(hareket.alacak || 0) > 0 ? 'teal' : 'red'}
                          >
                            {Number(hareket.alacak || 0) > 0 ? '+' : '-'}
                            {formatMoney(
                              Number(hareket.alacak || 0) > 0
                                ? Number(hareket.alacak)
                                : Number(hareket.borc)
                            )}
                          </Text>
                        </Group>
                      }
                    >
                      <Text c="dimmed" size="xs">
                        {formatDate(hareket.belge_tarihi)}
                        {hareket.belge_no && ` - ${hareket.belge_no}`}
                      </Text>
                      {hareket.aciklama && (
                        <Text size="xs" mt={4}>
                          {hareket.aciklama}
                        </Text>
                      )}
                    </Timeline.Item>
                  ))}
                </Timeline>
              )}
            </ScrollArea>
          </Tabs.Panel>
        </Tabs>
      </Stack>
    </Drawer>
  );
}
