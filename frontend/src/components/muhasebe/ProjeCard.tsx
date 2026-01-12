'use client';

import { useState, useEffect } from 'react';
import {
  Paper,
  Text,
  Group,
  Stack,
  Badge,
  Button,
  SimpleGrid,
  RingProgress,
  ThemeIcon,
  Tooltip,
  Loader,
} from '@mantine/core';
import {
  IconBuilding,
  IconUsers,
  IconCash,
  IconShoppingCart,
  IconChartBar,
  IconSettings,
} from '@tabler/icons-react';

interface GenelOzet {
  projeler: {
    toplam: number;
    aktif: number;
    tamamlanan: number;
    bekleyen: number;
  };
  personel: {
    toplam: number;
    maas_yuku: number;
    bordro_yuku: number;
  };
  bordro: {
    yil: number;
    ay: number;
    tahakkuk: number;
    net: number;
  };
  satin_alma: {
    toplam_siparis: number;
    bekleyen: number;
    harcama: number;
  };
  finans: {
    bu_ay_gelir: number;
    bu_ay_gider: number;
    bu_ay_net: number;
  };
  en_aktif_projeler: Array<{
    id: number;
    ad: string;
    kod: string;
    renk: string;
    personel: number;
    maas_yuku: number;
  }>;
  _meta: {
    tarih: string;
    yil: number;
    ay: number;
  };
}

interface ProjeCardProps {
  onYonetClick?: () => void;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export default function ProjeCard({ onYonetClick }: ProjeCardProps) {
  const [ozet, setOzet] = useState<GenelOzet | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/projeler/stats/genel-ozet');
      if (res.ok) {
        const data = await res.json();
        setOzet(data);
      }
    } catch (error) {
      console.error('Proje özet yüklenemedi:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Paper p="lg" radius="md" withBorder>
        <Group justify="center" py="xl">
          <Loader size="sm" />
          <Text c="dimmed">Proje verileri yükleniyor...</Text>
        </Group>
      </Paper>
    );
  }

  if (!ozet) {
    return (
      <Paper p="lg" radius="md" withBorder>
        <Text c="dimmed" ta="center">Proje verileri yüklenemedi</Text>
      </Paper>
    );
  }

  const ayAdi = ['', 'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'][ozet._meta.ay];

  return (
    <Paper 
      p="lg" 
      radius="md" 
      withBorder
      style={{
        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(168, 85, 247, 0.05) 100%)',
        borderColor: 'var(--mantine-color-indigo-2)',
      }}
    >
      {/* Header */}
      <Group justify="space-between" mb="md">
        <Group gap="sm">
          <ThemeIcon size="lg" radius="md" variant="gradient" gradient={{ from: 'indigo', to: 'violet' }}>
            <IconBuilding size={20} />
          </ThemeIcon>
          <div>
            <Text fw={700} size="lg">Proje Merkezi</Text>
            <Text size="xs" c="dimmed">{ayAdi} {ozet._meta.yil} Özet</Text>
          </div>
        </Group>
        <Button 
          variant="light" 
          color="indigo" 
          size="sm" 
          leftSection={<IconSettings size={16} />}
          onClick={onYonetClick}
        >
          Yönet
        </Button>
      </Group>

      {/* Proje Sayıları */}
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="xs" mb="md">
        <Paper p="xs" radius="sm" bg="white">
          <Text size="xs" c="dimmed">Aktif</Text>
          <Text size="xl" fw={700} c="green">{ozet.projeler.aktif}</Text>
        </Paper>
        <Paper p="xs" radius="sm" bg="white">
          <Text size="xs" c="dimmed">Bekleyen</Text>
          <Text size="xl" fw={700} c="orange">{ozet.projeler.bekleyen}</Text>
        </Paper>
        <Paper p="xs" radius="sm" bg="white">
          <Text size="xs" c="dimmed">Tamamlanan</Text>
          <Text size="xl" fw={700} c="blue">{ozet.projeler.tamamlanan}</Text>
        </Paper>
        <Paper p="xs" radius="sm" bg="white">
          <Text size="xs" c="dimmed">Toplam</Text>
          <Text size="xl" fw={700}>{ozet.projeler.toplam}</Text>
        </Paper>
      </SimpleGrid>

      {/* Ana İstatistikler */}
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md" mb="md">
        {/* Personel */}
        <Paper p="sm" radius="sm" withBorder>
          <Group gap="xs" mb="xs">
            <IconUsers size={16} color="var(--mantine-color-blue-6)" />
            <Text size="sm" fw={500}>Personel</Text>
          </Group>
          <Text size="xl" fw={700}>{ozet.personel.toplam}</Text>
          <Text size="xs" c="dimmed">Maaş Yükü: {formatCurrency(ozet.personel.maas_yuku)}</Text>
        </Paper>

        {/* Satın Alma */}
        <Paper p="sm" radius="sm" withBorder>
          <Group gap="xs" mb="xs">
            <IconShoppingCart size={16} color="var(--mantine-color-orange-6)" />
            <Text size="sm" fw={500}>Satın Alma</Text>
          </Group>
          <Group gap="xs">
            <Text size="xl" fw={700}>{ozet.satin_alma.toplam_siparis}</Text>
            {ozet.satin_alma.bekleyen > 0 && (
              <Badge size="xs" color="orange">{ozet.satin_alma.bekleyen} bekliyor</Badge>
            )}
          </Group>
          <Text size="xs" c="dimmed">Harcama: {formatCurrency(ozet.satin_alma.harcama)}</Text>
        </Paper>

        {/* Finans */}
        <Paper p="sm" radius="sm" withBorder>
          <Group gap="xs" mb="xs">
            <IconChartBar size={16} color="var(--mantine-color-grape-6)" />
            <Text size="sm" fw={500}>Bu Ay Net</Text>
          </Group>
          <Text 
            size="xl" 
            fw={700} 
            c={ozet.finans.bu_ay_net >= 0 ? 'green' : 'red'}
          >
            {formatCurrency(ozet.finans.bu_ay_net)}
          </Text>
          <Text size="xs" c="dimmed">
            Gelir: {formatCurrency(ozet.finans.bu_ay_gelir)} | 
            Gider: {formatCurrency(ozet.finans.bu_ay_gider)}
          </Text>
        </Paper>
      </SimpleGrid>

      {/* En Aktif Projeler */}
      {ozet.en_aktif_projeler.length > 0 && (
        <div>
          <Text size="sm" fw={500} mb="xs">En Aktif Projeler</Text>
          <Stack gap="xs">
            {ozet.en_aktif_projeler.slice(0, 3).map((proje) => (
              <Paper key={proje.id} p="xs" radius="sm" bg="white">
                <Group justify="space-between">
                  <Group gap="xs">
                    <div 
                      style={{ 
                        width: 8, 
                        height: 8, 
                        borderRadius: '50%', 
                        backgroundColor: proje.renk 
                      }} 
                    />
                    <div>
                      <Text size="sm" fw={500}>{proje.ad}</Text>
                      <Text size="xs" c="dimmed">{proje.kod}</Text>
                    </div>
                  </Group>
                  <Group gap="md">
                    <Tooltip label="Personel Sayısı">
                      <Badge variant="light" color="blue" leftSection={<IconUsers size={12} />}>
                        {proje.personel}
                      </Badge>
                    </Tooltip>
                    <Text size="sm" fw={500} c="dimmed">
                      {formatCurrency(proje.maas_yuku)}
                    </Text>
                  </Group>
                </Group>
              </Paper>
            ))}
          </Stack>
        </div>
      )}
    </Paper>
  );
}

