'use client';

import React, { memo, useMemo, Suspense, lazy } from 'react';
import {
  Container,
  Title,
  Text,
  Card,
  Group,
  Stack,
  SimpleGrid,
  ThemeIcon,
  Badge,
  Box,
  Skeleton,
  Alert,
  useMantineColorScheme
} from '@mantine/core';
import {
  IconTrendingUp,
  IconTrendingDown,
  IconCash,
  IconReceipt,
  IconRefresh,
  IconAlertCircle
} from '@tabler/icons-react';
import { useDashboard } from '@/hooks/use-muhasebe';

// Lazy load heavy components
const AreaChartComponent = lazy(() => import('./charts/AreaChart'));
const PieChartComponent = lazy(() => import('./charts/PieChart'));
const RecentTransactionsTable = lazy(() => import('./tables/RecentTransactions'));
const UpcomingPaymentsCard = lazy(() => import('./cards/UpcomingPayments'));

// Memoized components for performance
const StatCard = memo(({ stat }: { stat: any }) => {
  const Icon = stat.icon;
  
  return (
    <Card withBorder shadow="sm" p="lg" radius="md">
      <Group justify="space-between">
        <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
          {stat.title}
        </Text>
        <ThemeIcon color={stat.color} variant="light" size="lg" radius="md">
          <Icon size={20} />
        </ThemeIcon>
      </Group>
      <Text fw={700} size="xl" mt="md">
        {stat.value}
      </Text>
      <Group gap="xs" mt={4}>
        {stat.trend && (
          <ThemeIcon 
            color={stat.trend === 'up' ? 'green' : 'red'} 
            variant="light" 
            size="sm" 
            radius="xl"
          >
            {stat.trend === 'up' ? (
              <IconTrendingUp size={14} />
            ) : (
              <IconTrendingDown size={14} />
            )}
          </ThemeIcon>
        )}
        <Text size="sm" c={stat.changeColor}>
          {stat.change}
        </Text>
        <Text size="xs" c="dimmed">
          {stat.description}
        </Text>
      </Group>
    </Card>
  );
});

StatCard.displayName = 'StatCard';

// Loading skeleton component
const DashboardSkeleton = () => (
  <Stack gap="xl">
    <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }}>
      {[...Array(4)].map((_, i) => (
        <Skeleton key={i} height={120} radius="md" />
      ))}
    </SimpleGrid>
    <SimpleGrid cols={{ base: 1, lg: 2 }}>
      <Skeleton height={300} radius="md" />
      <Skeleton height={300} radius="md" />
    </SimpleGrid>
  </Stack>
);

// Error component
const DashboardError = ({ onRetry }: { onRetry: () => void }) => (
  <Alert 
    icon={<IconAlertCircle size={16} />} 
    title="Veri yüklenemedi" 
    color="red"
    variant="light"
  >
    <Text size="sm" mb="md">
      Dashboard verileri yüklenirken bir hata oluştu.
    </Text>
    <Button 
      size="xs" 
      variant="light" 
      color="red" 
      onClick={onRetry}
      leftSection={<IconRefresh size={14} />}
    >
      Tekrar Dene
    </Button>
  </Alert>
);

export default function OptimizedDashboard() {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';
  
  // Use optimized hook for data fetching
  const {
    summary,
    monthlyTrend,
    expenseDistribution,
    recentTransactions,
    upcomingPayments,
    isLoading,
    refetch
  } = useDashboard();

  // Memoized calculations
  const stats = useMemo(() => {
    if (!summary) return [];
    
    const formatMoney = (value: number) => {
      return new Intl.NumberFormat('tr-TR', {
        style: 'currency',
        currency: 'TRY',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);
    };

    return [
      {
        title: 'Toplam Gelir',
        value: formatMoney(summary.totalIncome),
        change: `${summary.incomeChange > 0 ? '+' : ''}${summary.incomeChange}%`,
        changeColor: summary.incomeChange > 0 ? 'green' : 'red',
        trend: summary.incomeChange > 0 ? 'up' : 'down',
        icon: IconTrendingUp,
        color: 'green',
        description: 'Bu yıl'
      },
      {
        title: 'Toplam Gider',
        value: formatMoney(summary.totalExpense),
        change: `${summary.expenseChange > 0 ? '+' : ''}${summary.expenseChange}%`,
        changeColor: 'red',
        trend: 'up',
        icon: IconTrendingDown,
        color: 'red',
        description: 'Bu yıl'
      },
      {
        title: 'Net Kâr',
        value: formatMoney(summary.netProfit),
        change: `${summary.profitChange > 0 ? '+' : ''}${summary.profitChange}%`,
        changeColor: summary.profitChange > 0 ? 'green' : 'red',
        trend: summary.profitChange > 0 ? 'up' : 'down',
        icon: IconCash,
        color: 'teal',
        description: 'Bu yıl'
      },
      {
        title: 'Bekleyen Fatura',
        value: summary.pendingInvoices,
        change: formatMoney(summary.pendingAmount),
        changeColor: 'orange',
        trend: null,
        icon: IconReceipt,
        color: 'orange',
        description: 'Ödenmemiş'
      }
    ];
  }, [summary]);

  // Loading state
  if (isLoading) {
    return (
      <Container size="xl" py="xl">
        <Stack gap="xl">
          <Box>
            <Title order={1} fw={700}>💰 Muhasebe Dashboard</Title>
            <Text c="dimmed" size="lg">Mali durumunuzun genel görünümü</Text>
          </Box>
          <DashboardSkeleton />
        </Stack>
      </Container>
    );
  }

  // Error state
  if (!summary && !isLoading) {
    return (
      <Container size="xl" py="xl">
        <Stack gap="xl">
          <Box>
            <Title order={1} fw={700}>💰 Muhasebe Dashboard</Title>
            <Text c="dimmed" size="lg">Mali durumunuzun genel görünümü</Text>
          </Box>
          <DashboardError onRetry={refetch} />
        </Stack>
      </Container>
    );
  }

  return (
    <Box 
      style={{ 
        background: isDark 
          ? 'linear-gradient(180deg, rgba(20,184,166,0.05) 0%, rgba(0,0,0,0) 100%)' 
          : 'linear-gradient(180deg, rgba(20,184,166,0.08) 0%, rgba(255,255,255,0) 100%)',
        minHeight: '100vh' 
      }}
    >
      <Container size="xl" py="xl">
        <Stack gap="xl">
          {/* Header */}
          <Group justify="space-between" align="flex-end">
            <Box>
              <Title order={1} fw={700}>
                💰 Muhasebe Dashboard
              </Title>
              <Text c="dimmed" size="lg">
                Mali durumunuzun genel görünümü
              </Text>
            </Box>
            <Group>
              <Button 
                variant="subtle" 
                size="sm" 
                onClick={refetch}
                leftSection={<IconRefresh size={14} />}
              >
                Yenile
              </Button>
              <Badge size="lg" variant="light" color="teal">
                {new Date().toLocaleDateString('tr-TR', { 
                  month: 'long', 
                  year: 'numeric' 
                })}
              </Badge>
            </Group>
          </Group>

          {/* Stats Cards - Memoized */}
          <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }}>
            {stats.map((stat, index) => (
              <StatCard key={index} stat={stat} />
            ))}
          </SimpleGrid>

          {/* Charts - Lazy Loaded */}
          <SimpleGrid cols={{ base: 1, lg: 2 }}>
            <Suspense fallback={<Skeleton height={300} radius="md" />}>
              <AreaChartComponent 
                data={monthlyTrend} 
                isDark={isDark}
              />
            </Suspense>
            
            <Suspense fallback={<Skeleton height={300} radius="md" />}>
              <PieChartComponent 
                data={expenseDistribution}
                isDark={isDark}
              />
            </Suspense>
          </SimpleGrid>

          {/* Tables - Lazy Loaded */}
          <SimpleGrid cols={{ base: 1, lg: 2 }}>
            <Suspense fallback={<Skeleton height={400} radius="md" />}>
              <RecentTransactionsTable 
                transactions={recentTransactions}
              />
            </Suspense>
            
            <Suspense fallback={<Skeleton height={400} radius="md" />}>
              <UpcomingPaymentsCard 
                payments={upcomingPayments}
              />
            </Suspense>
          </SimpleGrid>
        </Stack>
      </Container>
    </Box>
  );
}

// Export memoized version
export const MemoizedDashboard = memo(OptimizedDashboard);
