'use client';

import {
  ActionIcon,
  Badge,
  Card,
  Divider,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
  ThemeIcon,
  Tooltip,
  useMantineColorScheme,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconBulb,
  IconCalendarEvent,
  IconReceipt,
  IconRefresh,
  IconSparkles,
  IconTrendingUp,
  IconUsers,
} from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { personelAPI } from '@/lib/api/services/personel';
import { muhasebeAPI } from '@/lib/api/services/muhasebe';

interface Insight {
  type: 'warning' | 'info' | 'success';
  icon: React.ReactNode;
  title: string;
  description: string;
  badge?: string;
}

export function AIDashboardWidget() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';

  const fetchInsights = async () => {
    setLoading(true);
    try {
      // Paralel API çağrıları
      const [personelResult, faturaResult] = await Promise.all([
        personelAPI.getStats().catch(() => null),
        muhasebeAPI.getInvoiceStats().catch(() => null),
      ]);

      const newInsights: Insight[] = [];

      // Personel insights
      const personelData = (personelResult as any)?.data || personelResult;
      if (personelData) {
        if (personelData.izinli_personel > 0) {
          newInsights.push({
            type: 'info',
            icon: <IconUsers size={16} />,
            title: 'İzinli Personel',
            description: `Bugün ${personelData.izinli_personel} personel izinli`,
            badge: `${personelData.izinli_personel} kişi`,
          });
        }
        if (personelData.toplam_personel > 0) {
          newInsights.push({
            type: 'success',
            icon: <IconTrendingUp size={16} />,
            title: 'Personel Özeti',
            description: `${personelData.aktif_personel} aktif personel`,
            badge: `${personelData.toplam_personel} toplam`,
          });
        }
      }

      // Fatura insights
      const faturaData = (faturaResult as any)?.data || faturaResult;
      if (faturaData) {
        if (faturaData.bekleyen_fatura > 0) {
          newInsights.push({
            type: 'warning',
            icon: <IconReceipt size={16} />,
            title: 'Onay Bekleyen Faturalar',
            description: `${faturaData.bekleyen_fatura} fatura onay bekliyor`,
            badge: 'Acil',
          });
        }
        if (faturaData.bugun_vade > 0) {
          newInsights.push({
            type: 'warning',
            icon: <IconCalendarEvent size={16} />,
            title: 'Vadesi Bugün',
            description: `${faturaData.bugun_vade} faturanın vadesi bugün`,
            badge: 'Dikkat',
          });
        }
        if (faturaData.geciken_fatura > 0) {
          newInsights.push({
            type: 'warning',
            icon: <IconAlertTriangle size={16} />,
            title: 'Geciken Faturalar',
            description: `${faturaData.geciken_fatura} faturanın vadesi geçmiş!`,
            badge: 'Kritik',
          });
        }
      }

      // Default insight eğer hiçbir şey yoksa
      if (newInsights.length === 0) {
        newInsights.push({
          type: 'success',
          icon: <IconBulb size={16} />,
          title: 'Her şey yolunda!',
          description: 'Dikkat edilecek bir durum yok',
        });
      }

      setInsights(newInsights);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Dashboard widget error:', error);
      setInsights([
        {
          type: 'info',
          icon: <IconBulb size={16} />,
          title: 'AI Asistan Hazır',
          description: 'Sağ alttaki butona tıklayarak sorularınızı sorabilirsiniz',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInsights();
    // Her 5 dakikada bir güncelle
    const interval = setInterval(fetchInsights, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchInsights]);

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'warning':
        return 'orange';
      case 'success':
        return 'green';
      default:
        return 'blue';
    }
  };

  return (
    <Card
      shadow="md"
      padding="lg"
      radius="lg"
      withBorder
      style={{
        background: isDark
          ? 'linear-gradient(135deg, rgba(102,126,234,0.1) 0%, rgba(118,75,162,0.1) 100%)'
          : 'linear-gradient(135deg, rgba(102,126,234,0.05) 0%, rgba(118,75,162,0.05) 100%)',
        border: '1px solid rgba(102,126,234,0.2)',
      }}
    >
      <Stack gap="md">
        {/* Header */}
        <Group justify="space-between">
          <Group gap="xs">
            <ThemeIcon
              size={36}
              radius="md"
              variant="gradient"
              gradient={{ from: 'violet', to: 'grape' }}
            >
              <IconSparkles size={20} />
            </ThemeIcon>
            <div>
              <Text fw={600} size="sm">
                AI Smart Insights
              </Text>
              <Text size="xs" c="dimmed">
                {lastUpdate
                  ? `Son güncelleme: ${lastUpdate.toLocaleTimeString('tr-TR')}`
                  : 'Yükleniyor...'}
              </Text>
            </div>
          </Group>
          <Tooltip label="Yenile">
            <ActionIcon variant="subtle" color="violet" onClick={fetchInsights} loading={loading}>
              <IconRefresh size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>

        <Divider />

        {/* Insights */}
        {loading ? (
          <Group justify="center" py="md">
            <Loader size="sm" color="violet" />
            <Text size="sm" c="dimmed">
              Analiz ediliyor...
            </Text>
          </Group>
        ) : (
          <Stack gap="xs">
            {insights.map((insight, index) => (
              <Paper
                key={index}
                p="sm"
                radius="md"
                withBorder
                style={{
                  borderLeft: `3px solid var(--mantine-color-${getTypeColor(insight.type)}-6)`,
                  background: isDark ? 'rgba(0,0,0,0.2)' : 'white',
                }}
              >
                <Group justify="space-between" wrap="nowrap">
                  <Group gap="xs" wrap="nowrap">
                    <ThemeIcon
                      size="sm"
                      variant="light"
                      color={getTypeColor(insight.type)}
                      radius="xl"
                    >
                      {insight.icon}
                    </ThemeIcon>
                    <div>
                      <Text size="xs" fw={600}>
                        {insight.title}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {insight.description}
                      </Text>
                    </div>
                  </Group>
                  {insight.badge && (
                    <Badge size="xs" variant="light" color={getTypeColor(insight.type)}>
                      {insight.badge}
                    </Badge>
                  )}
                </Group>
              </Paper>
            ))}
          </Stack>
        )}

        {/* Footer tip */}
        <Paper p="xs" radius="sm" bg={isDark ? 'dark.6' : 'gray.0'}>
          <Group gap="xs">
            <IconBulb size={14} color="var(--mantine-color-yellow-6)" />
            <Text size="xs" c="dimmed">
              Detaylı analiz için sağ alttaki AI asistanı kullanın
            </Text>
          </Group>
        </Paper>
      </Stack>
    </Card>
  );
}
