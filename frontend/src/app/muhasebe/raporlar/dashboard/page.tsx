'use client';

import {
  Alert,
  Badge,
  Box,
  Card,
  Container,
  Group,
  Loader,
  Paper,
  Progress,
  Select,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
  useMantineColorScheme,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconCarrot,
  IconChartBar,
  IconChartPie,
  IconEggs,
  IconFileInvoice,
  IconMeat,
  IconPackage,
  IconReceipt,
  IconShoppingCart,
  IconTrendingDown,
  IconTrendingUp,
} from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { formatMoney } from '@/lib/formatters';
import { invoiceAPI, uyumsoftAPI } from '@/lib/invoice-api';

// Kategori ikonları
const categoryIcons: Record<string, any> = {
  tavuk: IconEggs,
  et: IconMeat,
  sebze: IconCarrot,
  bakliyat: IconPackage,
  diger: IconShoppingCart,
};

// Kategori renkleri
const categoryColors: Record<string, string> = {
  tavuk: 'yellow',
  et: 'red',
  sebze: 'green',
  bakliyat: 'orange',
  diger: 'gray',
};

export default function DashboardPage() {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';

  // State
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState((new Date().getMonth() + 1).toString());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [_monthlySummary, setMonthlySummary] = useState<any[]>([]);
  const [categorySummary, setCategorySummary] = useState<any[]>([]);
  const [uyumsoftSummary, setUyumsoftSummary] = useState<any>(null);
  const [currentMonthData, setCurrentMonthData] = useState<any>(null);

  // Para formatı

  // Yüzde hesapla
  const calculatePercentage = (value: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((value / total) * 100);
  };

  // Veri yükle
  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Paralel API çağrıları
      const [monthlyResult, categoryResult, uyumsoftResult] = await Promise.all([
        invoiceAPI.getMonthlySummary(parseInt(selectedYear, 10)),
        invoiceAPI.getCategorySummary(
          `${selectedYear}-${selectedMonth.padStart(2, '0')}-01`,
          `${selectedYear}-${selectedMonth.padStart(2, '0')}-31`
        ),
        uyumsoftAPI.getSummary(),
      ]);

      // Aylık özet
      if (monthlyResult.success) {
        setMonthlySummary(monthlyResult.data);

        // Bu ayın verilerini bul
        const thisMonth = monthlyResult.data.find((d: any) => {
          const month = new Date(d.month);
          return month.getMonth() + 1 === parseInt(selectedMonth, 10);
        });
        setCurrentMonthData(thisMonth);
      }

      // Kategori özet
      if (categoryResult.success) {
        setCategorySummary(categoryResult.data);
      }

      // Uyumsoft özet
      if (uyumsoftResult.success) {
        setUyumsoftSummary(uyumsoftResult.summary);
      }
    } catch (err: any) {
      console.error('Dashboard veri yükleme hatası:', err);
      setError(err.message || 'Veriler yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  // Component mount ve filter değişiminde veri yükle
  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Toplam hesaplamaları
  const totalPurchase = categorySummary.reduce((sum, cat) => sum + parseFloat(cat.total_amount || 0), 0);
  const totalSales = currentMonthData?.invoice_type === 'sales' ? parseFloat(currentMonthData.total_amount || 0) : 0;
  const totalInvoiceCount = (currentMonthData?.count || 0) + (uyumsoftSummary?.total_count || 0);

  // En yüksek kategori
  const topCategory =
    categorySummary.length > 0
      ? categorySummary.sort((a, b) => parseFloat(b.total_amount) - parseFloat(a.total_amount))[0]
      : null;

  if (loading) {
    return (
      <Container size="xl" py="xl">
        <Stack align="center" py={100}>
          <Loader size="xl" color="violet" />
          <Text c="dimmed">Dashboard yükleniyor...</Text>
        </Stack>
      </Container>
    );
  }

  if (error) {
    return (
      <Container size="xl" py="xl">
        <Alert icon={<IconAlertCircle />} color="red" title="Hata">
          {error}
        </Alert>
      </Container>
    );
  }

  return (
    <Box
      style={{
        background: isDark
          ? 'linear-gradient(180deg, rgba(139,92,246,0.05) 0%, rgba(0,0,0,0) 100%)'
          : 'linear-gradient(180deg, rgba(139,92,246,0.08) 0%, rgba(255,255,255,0) 100%)',
        minHeight: '100vh',
      }}
    >
      <Container size="xl" py="xl">
        <Stack gap="xl">
          {/* Header */}
          <Group justify="space-between" align="flex-start">
            <Box>
              <Title order={1} fw={700}>
                📊 Raporlama Dashboard
              </Title>
              <Text c="dimmed" size="lg">
                Finansal özet ve analizler
              </Text>
            </Box>
            <Group>
              <Select
                label="Yıl"
                value={selectedYear}
                onChange={(v) => setSelectedYear(v || new Date().getFullYear().toString())}
                data={[
                  { value: '2024', label: '2024' },
                  { value: '2025', label: '2025' },
                  { value: '2026', label: '2026' },
                ]}
                style={{ width: 100 }}
              />
              <Select
                label="Ay"
                value={selectedMonth}
                onChange={(v) => setSelectedMonth(v || '1')}
                data={[
                  { value: '1', label: 'Ocak' },
                  { value: '2', label: 'Şubat' },
                  { value: '3', label: 'Mart' },
                  { value: '4', label: 'Nisan' },
                  { value: '5', label: 'Mayıs' },
                  { value: '6', label: 'Haziran' },
                  { value: '7', label: 'Temmuz' },
                  { value: '8', label: 'Ağustos' },
                  { value: '9', label: 'Eylül' },
                  { value: '10', label: 'Ekim' },
                  { value: '11', label: 'Kasım' },
                  { value: '12', label: 'Aralık' },
                ]}
                style={{ width: 120 }}
              />
            </Group>
          </Group>

          {/* Özet Kartlar */}
          <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }}>
            <Card withBorder shadow="sm" p="lg" radius="md">
              <Group justify="space-between">
                <Box>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                    Toplam Alış
                  </Text>
                  <Text fw={700} size="xl" mt="sm" c="orange">
                    {formatMoney(totalPurchase)}
                  </Text>
                  <Text size="xs" c="dimmed" mt={5}>
                    {categorySummary.length} kategori
                  </Text>
                </Box>
                <ThemeIcon color="orange" variant="light" size={48} radius="md">
                  <IconShoppingCart size={24} />
                </ThemeIcon>
              </Group>
            </Card>

            <Card withBorder shadow="sm" p="lg" radius="md">
              <Group justify="space-between">
                <Box>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                    Toplam Satış
                  </Text>
                  <Text fw={700} size="xl" mt="sm" c="green">
                    {formatMoney(totalSales)}
                  </Text>
                  <Text size="xs" c="dimmed" mt={5}>
                    {currentMonthData?.invoice_type === 'sales' ? currentMonthData.count : 0} fatura
                  </Text>
                </Box>
                <ThemeIcon color="green" variant="light" size={48} radius="md">
                  <IconReceipt size={24} />
                </ThemeIcon>
              </Group>
            </Card>

            <Card withBorder shadow="sm" p="lg" radius="md">
              <Group justify="space-between">
                <Box>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                    Fatura Sayısı
                  </Text>
                  <Text fw={700} size="xl" mt="sm" c="violet">
                    {totalInvoiceCount}
                  </Text>
                  <Text size="xs" c="dimmed" mt={5}>
                    Manuel + E-Fatura
                  </Text>
                </Box>
                <ThemeIcon color="violet" variant="light" size={48} radius="md">
                  <IconFileInvoice size={24} />
                </ThemeIcon>
              </Group>
            </Card>

            <Card withBorder shadow="sm" p="lg" radius="md">
              <Group justify="space-between">
                <Box>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                    Net Durum
                  </Text>
                  <Text fw={700} size="xl" mt="sm" c={totalSales - totalPurchase >= 0 ? 'green' : 'red'}>
                    {formatMoney(totalSales - totalPurchase)}
                  </Text>
                  <Text size="xs" c="dimmed" mt={5}>
                    Kar/Zarar
                  </Text>
                </Box>
                <ThemeIcon
                  color={totalSales - totalPurchase >= 0 ? 'green' : 'red'}
                  variant="light"
                  size={48}
                  radius="md"
                >
                  {totalSales - totalPurchase >= 0 ? <IconTrendingUp size={24} /> : <IconTrendingDown size={24} />}
                </ThemeIcon>
              </Group>
            </Card>
          </SimpleGrid>

          {/* Kategori Dağılımı ve En Çok Alım */}
          <SimpleGrid cols={{ base: 1, md: 2 }}>
            {/* Kategori Dağılımı */}
            <Card withBorder shadow="sm" p="lg" radius="md">
              <Group justify="space-between" mb="md">
                <Text size="lg" fw={600}>
                  Kategori Dağılımı
                </Text>
                <ThemeIcon color="violet" variant="light" size="sm">
                  <IconChartPie size={16} />
                </ThemeIcon>
              </Group>

              <Stack gap="md">
                {categorySummary.length === 0 ? (
                  <Text c="dimmed" ta="center" py="xl">
                    Veri bulunamadı
                  </Text>
                ) : (
                  categorySummary.slice(0, 5).map((cat) => {
                    const Icon = categoryIcons[cat.category] || IconPackage;
                    const color = categoryColors[cat.category] || 'gray';
                    const percentage = calculatePercentage(parseFloat(cat.total_amount), totalPurchase);

                    return (
                      <Box key={cat.category}>
                        <Group justify="space-between" mb={5}>
                          <Group gap="xs">
                            <ThemeIcon color={color} variant="light" size="sm">
                              <Icon size={16} />
                            </ThemeIcon>
                            <Text size="sm" fw={500} tt="capitalize">
                              {cat.category}
                            </Text>
                          </Group>
                          <Text size="sm" fw={600}>
                            {formatMoney(parseFloat(cat.total_amount))}
                          </Text>
                        </Group>
                        <Progress value={percentage} color={color} size="sm" />
                        <Group justify="space-between" mt={5}>
                          <Text size="xs" c="dimmed">
                            {cat.invoice_count} fatura
                          </Text>
                          <Text size="xs" c="dimmed">
                            {parseFloat(cat.total_quantity).toFixed(0)}{' '}
                            {cat.category === 'tavuk' || cat.category === 'et' ? 'Kg' : 'Adet'}
                          </Text>
                        </Group>
                      </Box>
                    );
                  })
                )}
              </Stack>
            </Card>

            {/* En Çok Alım Yapılan Kategori */}
            <Card withBorder shadow="sm" p="lg" radius="md">
              <Group justify="space-between" mb="md">
                <Text size="lg" fw={600}>
                  Kategori Detayları
                </Text>
                <ThemeIcon color="violet" variant="light" size="sm">
                  <IconChartBar size={16} />
                </ThemeIcon>
              </Group>

              {topCategory ? (
                <Stack gap="md">
                  <Paper withBorder p="md" radius="md">
                    <Group justify="space-between" mb="xs">
                      <Text size="xs" c="dimmed" tt="uppercase">
                        En Yüksek Harcama
                      </Text>
                      <Badge color={categoryColors[topCategory.category]}>{topCategory.category.toUpperCase()}</Badge>
                    </Group>
                    <Text size="xl" fw={700} c={categoryColors[topCategory.category]}>
                      {formatMoney(parseFloat(topCategory.total_amount))}
                    </Text>
                    <Text size="xs" c="dimmed" mt={5}>
                      Ortalama birim fiyat: {formatMoney(parseFloat(topCategory.avg_unit_price))}
                    </Text>
                  </Paper>

                  <SimpleGrid cols={{ base: 1, sm: 2 }}>
                    {categorySummary.map((cat) => (
                      <Paper key={cat.category} withBorder p="sm" radius="md">
                        <Text size="xs" c="dimmed" mb={5}>
                          {cat.category}
                        </Text>
                        <Text size="lg" fw={600}>
                          {formatMoney(parseFloat(cat.total_amount))}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {cat.invoice_count} fatura
                        </Text>
                      </Paper>
                    ))}
                  </SimpleGrid>
                </Stack>
              ) : (
                <Text c="dimmed" ta="center" py="xl">
                  Veri bulunamadı
                </Text>
              )}
            </Card>
          </SimpleGrid>

          {/* Uyumsoft E-Fatura Özeti */}
          {uyumsoftSummary && (
            <Card withBorder shadow="sm" p="lg" radius="md">
              <Group justify="space-between" mb="md">
                <Text size="lg" fw={600}>
                  E-Fatura Özeti (Uyumsoft)
                </Text>
                <Badge color="violet" variant="light">
                  {uyumsoftSummary.total_count || 0} Fatura
                </Badge>
              </Group>

              <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }}>
                <Paper withBorder p="md" radius="md">
                  <Text size="xs" c="dimmed" mb={5}>
                    Toplam Tutar
                  </Text>
                  <Text size="lg" fw={600}>
                    {formatMoney(parseFloat(uyumsoftSummary.total_amount || 0))}
                  </Text>
                </Paper>
                <Paper withBorder p="md" radius="md">
                  <Text size="xs" c="dimmed" mb={5}>
                    Toplam KDV
                  </Text>
                  <Text size="lg" fw={600}>
                    {formatMoney(parseFloat(uyumsoftSummary.total_vat || 0))}
                  </Text>
                </Paper>
                <Paper withBorder p="md" radius="md">
                  <Text size="xs" c="dimmed" mb={5}>
                    Yeni Fatura
                  </Text>
                  <Text size="lg" fw={600}>
                    {uyumsoftSummary.new_count || 0}
                  </Text>
                </Paper>
                <Paper withBorder p="md" radius="md">
                  <Text size="xs" c="dimmed" mb={5}>
                    AI İşlenmiş
                  </Text>
                  <Text size="lg" fw={600}>
                    {uyumsoftSummary.ai_processed_count || 0}
                  </Text>
                </Paper>
              </SimpleGrid>
            </Card>
          )}
        </Stack>
      </Container>
    </Box>
  );
}
