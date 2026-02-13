'use client';

import {
  Badge,
  Box,
  Divider,
  Group,
  LoadingOverlay,
  Modal,
  Paper,
  SimpleGrid,
  Stack,
  Table,
  Text,
  ThemeIcon,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconBuilding, IconHistory, IconLink, IconPackage } from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';
import { urunlerAPI } from '@/lib/api/services/urunler';
import { formatMoney } from '@/lib/formatters';

interface Props {
  opened: boolean;
  onClose: () => void;
  urunId: number | null;
}

export default function UrunDetayModal({ opened, onClose, urunId }: Props) {
  const [loading, setLoading] = useState(false);
  const [urunDetay, setUrunDetay] = useState<any>(null);

  const loadUrunDetay = useCallback(async (id: number) => {
    setLoading(true);
    try {
      const result = await urunlerAPI.getUrun(id);
      if (result.success) {
        setUrunDetay(result.data);
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      console.error('Ürün detay hatası:', error);
      notifications.show({
        title: 'Hata',
        message: 'Ürün detayları yüklenemedi',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  // Ürün detayını yükle
  useEffect(() => {
    if (opened && urunId) {
      loadUrunDetay(urunId);
    }
  }, [opened, urunId, loadUrunDetay]);

  // Miktar formatı
  const formatMiktar = (value: number | string | null | undefined) => {
    if (value === null || value === undefined) return '0';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (Number.isNaN(num)) return '0';
    if (Number.isInteger(num)) return num.toLocaleString('tr-TR');
    return num.toLocaleString('tr-TR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        urunDetay ? (
          <Group gap="sm">
            <ThemeIcon size={40} radius="xl" variant="gradient" gradient={{ from: 'blue', to: 'cyan' }}>
              <IconPackage size={20} />
            </ThemeIcon>
            <Box>
              <Text fw={600} size="lg">
                {urunDetay.ad}
              </Text>
              <Text size="xs" c="dimmed">
                {urunDetay.kod} • {urunDetay.kategori}
              </Text>
            </Box>
          </Group>
        ) : (
          <Text>Ürün Detayı</Text>
        )
      }
      size="xl"
    >
      <LoadingOverlay visible={loading} />

      {urunDetay && (
        <Stack gap="lg">
          {/* Genel Bilgiler */}
          <Paper p="md" withBorder radius="md">
            <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
              <Box>
                <Text size="xs" c="dimmed" tt="uppercase">
                  Mevcut Stok
                </Text>
                <Text size="xl" fw={700} c="blue">
                  {formatMiktar(urunDetay.toplam_stok)} {urunDetay.birim_kisa || 'Ad'}
                </Text>
              </Box>
              <Box>
                <Text size="xs" c="dimmed" tt="uppercase">
                  Son Alış Fiyatı
                </Text>
                <Text size="xl" fw={700} c="teal">
                  {formatMoney(urunDetay.son_alis_fiyati, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}
                </Text>
              </Box>
              <Box>
                <Text size="xs" c="dimmed" tt="uppercase">
                  Ort. Fiyat
                </Text>
                <Text size="xl" fw={700}>
                  {formatMoney(urunDetay.ortalama_fiyat, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}
                </Text>
              </Box>
              <Box>
                <Text size="xs" c="dimmed" tt="uppercase">
                  Min / Kritik Stok
                </Text>
                <Text size="xl" fw={700}>
                  {formatMiktar(urunDetay.min_stok)} / {formatMiktar(urunDetay.kritik_stok)}
                </Text>
              </Box>
            </SimpleGrid>
          </Paper>

          <Divider />

          {/* Fiyat Geçmişi */}
          <Box>
            <Group gap="xs" mb="xs">
              <IconHistory size={18} />
              <Text fw={600}>Fiyat Geçmişi</Text>
              <Badge size="sm" variant="light">
                {urunDetay.fiyat_gecmisi?.length || 0} kayıt
              </Badge>
            </Group>

            {urunDetay.fiyat_gecmisi && urunDetay.fiyat_gecmisi.length > 0 ? (
              <Table striped highlightOnHover withTableBorder>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Tarih</Table.Th>
                    <Table.Th>Tedarikçi</Table.Th>
                    <Table.Th>Fiyat</Table.Th>
                    <Table.Th>Kaynak</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {urunDetay.fiyat_gecmisi.map((fg: any) => (
                    <Table.Tr key={fg.id}>
                      <Table.Td>{fg.tarih ? new Date(fg.tarih).toLocaleDateString('tr-TR') : '-'}</Table.Td>
                      <Table.Td>
                        <Text size="sm" lineClamp={1}>
                          {fg.tedarikci || '-'}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text fw={500} c="blue">
                          {formatMoney(fg.fiyat, {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0,
                          })}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge size="xs" variant="light" color={fg.kaynak === 'fatura' ? 'violet' : 'gray'}>
                          {fg.kaynak === 'fatura' ? '📄 Fatura' : '✏️ Manuel'}
                        </Badge>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            ) : (
              <Paper p="md" withBorder ta="center" c="dimmed">
                <Text size="sm">Henüz fiyat kaydı yok</Text>
              </Paper>
            )}
          </Box>

          {/* Tedarikçi Eşleştirmeleri */}
          <Box>
            <Group gap="xs" mb="xs">
              <IconLink size={18} />
              <Text fw={600}>Tedarikçi Eşleştirmeleri</Text>
              <Badge size="sm" variant="light" color="grape">
                {urunDetay.tedarikci_eslestirmeleri?.length || 0} kayıt
              </Badge>
            </Group>

            {urunDetay.tedarikci_eslestirmeleri && urunDetay.tedarikci_eslestirmeleri.length > 0 ? (
              <Table striped highlightOnHover withTableBorder>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Tedarikçi Ürün Adı</Table.Th>
                    <Table.Th>Tedarikçi</Table.Th>
                    <Table.Th>Kod</Table.Th>
                    <Table.Th>Güven</Table.Th>
                    <Table.Th>Kullanım</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {urunDetay.tedarikci_eslestirmeleri.map((te: any) => (
                    <Table.Tr key={te.id}>
                      <Table.Td>
                        <Text size="sm" fw={500}>
                          {te.tedarikci_urun_adi}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" lineClamp={1}>
                          {te.tedarikci || '-'}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge size="xs" variant="light">
                          {te.tedarikci_urun_kodu || '-'}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          size="sm"
                          variant="light"
                          color={(te.guven_skoru || 0) >= 90 ? 'green' : (te.guven_skoru || 0) >= 70 ? 'yellow' : 'red'}
                        >
                          %{te.guven_skoru || '-'}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" c="dimmed">
                          {te.eslestirme_sayisi || 0}x
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            ) : (
              <Paper p="md" withBorder ta="center" c="dimmed">
                <Text size="sm">Henüz tedarikçi eşleştirmesi yok</Text>
                <Text size="xs" mt="xs">
                  Faturadan stok girişi yapıldığında otomatik oluşturulur
                </Text>
              </Paper>
            )}
          </Box>

          {/* Depo Durumları */}
          <Box>
            <Group gap="xs" mb="xs">
              <IconBuilding size={18} />
              <Text fw={600}>Depo Durumları</Text>
              <Badge size="sm" variant="light" color="cyan">
                {urunDetay.depo_durumlari?.length || 0} depo
              </Badge>
            </Group>

            {urunDetay.depo_durumlari && urunDetay.depo_durumlari.length > 0 ? (
              <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="sm">
                {urunDetay.depo_durumlari.map((dd: any) => (
                  <Paper key={dd.depo_id} p="sm" withBorder radius="md">
                    <Group justify="space-between" mb="xs">
                      <Text size="sm" fw={600}>
                        {dd.depo_ad}
                      </Text>
                      <Badge size="xs" variant="light">
                        {dd.depo_kod}
                      </Badge>
                    </Group>
                    <Text size="xl" fw={700} c="blue">
                      {formatMiktar(dd.miktar)} {urunDetay.birim_kisa || 'Ad'}
                    </Text>
                    {dd.rezerve_miktar > 0 && (
                      <Text size="xs" c="orange">
                        Rezerve: {formatMiktar(dd.rezerve_miktar)}
                      </Text>
                    )}
                    {dd.raf_konum && (
                      <Text size="xs" c="dimmed">
                        📍 {dd.raf_konum}
                      </Text>
                    )}
                  </Paper>
                ))}
              </SimpleGrid>
            ) : (
              <Paper p="md" withBorder ta="center" c="dimmed">
                <Text size="sm">Bu ürün hiçbir depoda stokta yok</Text>
              </Paper>
            )}
          </Box>
        </Stack>
      )}
    </Modal>
  );
}
