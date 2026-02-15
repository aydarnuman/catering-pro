'use client';

import {
  ActionIcon,
  Badge,
  Box,
  Center,
  Group,
  Loader,
  Modal,
  NumberInput,
  Paper,
  ScrollArea,
  Stack,
  Table,
  Text,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconCurrencyLira, IconEdit, IconRefresh, IconX } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { type MaliyetMalzeme, menuPlanlamaAPI } from '@/lib/api/services/menu-planlama';
import { menuPlanlamaKeys } from './queryKeys';

// ─── Fiyat kaynağı renk kodları ─────────────────────────────
const FIYAT_KAYNAGI_RENK: Record<string, string> = {
  FATURA: 'green',
  PIYASA: 'blue',
  VARYANT: 'orange',
  FATURA_ESKI: 'yellow',
  MANUEL: 'gray',
  yok: 'red',
};

function fiyatKaynagiLabel(kaynak: string | null): string {
  if (!kaynak || kaynak === 'yok') return 'Yok';
  const labels: Record<string, string> = {
    FATURA: 'Fatura',
    PIYASA: 'Piyasa',
    VARYANT: 'Varyant',
    FATURA_ESKI: 'Eski Fatura',
    MANUEL: 'Manuel',
  };
  return labels[kaynak] || kaynak;
}

// ─── Props ──────────────────────────────────────────────────
interface MaliyetDetayModalProps {
  opened: boolean;
  onClose: () => void;
  receteId: number | null;
  isMobile: boolean;
  isMounted: boolean;
}

export function MaliyetDetayModal({ opened, onClose, receteId, isMobile, isMounted }: MaliyetDetayModalProps) {
  const queryClient = useQueryClient();

  // ─── Düzenleme state ────────────────────────────────────────
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editFiyat, setEditFiyat] = useState<number | string>('');

  // ─── Veri çekme ─────────────────────────────────────────────
  const {
    data: analizData,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: menuPlanlamaKeys.maliyetAnalizi.detay(receteId),
    queryFn: async () => {
      if (!receteId) return null;
      const res = await menuPlanlamaAPI.getMaliyetAnalizi(receteId);
      if (!res.success || !res.data) throw new Error('Maliyet analizi alınamadı');
      return res.data;
    },
    enabled: opened && !!receteId,
    staleTime: 30_000,
  });

  // ─── Malzeme fiyat güncelleme mutation ──────────────────────
  const updateMutation = useMutation({
    mutationFn: async ({ malzemeId, birimFiyat }: { malzemeId: number; birimFiyat: number }) => {
      const res = await menuPlanlamaAPI.updateMalzeme(malzemeId, { birim_fiyat: birimFiyat });
      if (!res.success) throw new Error(res.error || 'Güncelleme başarısız');
      return res;
    },
    onSuccess: () => {
      setEditingId(null);
      setEditFiyat('');
      // Modal verisini yenile
      queryClient.invalidateQueries({ queryKey: menuPlanlamaKeys.maliyetAnalizi.detay(receteId) });
      // Reçete listesini de yenile (karttaki ₺ güncellensin)
      queryClient.invalidateQueries({ queryKey: menuPlanlamaKeys.receteler.all() });
      notifications.show({
        title: 'Fiyat güncellendi',
        message: 'Maliyet yeniden hesaplandı',
        color: 'green',
      });
    },
    onError: (err: Error) => {
      notifications.show({
        title: 'Hata',
        message: err.message,
        color: 'red',
      });
    },
  });

  // ─── Anlık client-side hesaplama ────────────────────────────
  const computedMalzemeler = useMemo(() => {
    if (!analizData?.malzemeler) return [];
    return analizData.malzemeler.map((m) => {
      if (editingId === m.id && editFiyat !== '' && typeof editFiyat === 'number') {
        const yeniToplam = parseFloat(m.miktar) * m.carpan * editFiyat;
        return { ...m, _editBirimFiyat: editFiyat, _editToplam: yeniToplam };
      }
      return { ...m, _editBirimFiyat: null, _editToplam: null };
    });
  }, [analizData?.malzemeler, editingId, editFiyat]);

  const computedToplam = useMemo(() => {
    if (!computedMalzemeler.length) return { sistem: 0, piyasa: 0 };
    let sistem = 0;
    let piyasa = 0;
    for (const m of computedMalzemeler) {
      sistem += m._editToplam ?? m.sistem_toplam;
      piyasa += m.piyasa_toplam;
    }
    return { sistem, piyasa };
  }, [computedMalzemeler]);

  // ─── Handlers ───────────────────────────────────────────────
  const startEdit = useCallback((m: MaliyetMalzeme) => {
    setEditingId(m.id);
    setEditFiyat(m.sistem_fiyat);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditFiyat('');
  }, []);

  const saveEdit = useCallback(
    (malzemeId: number) => {
      if (typeof editFiyat !== 'number' || editFiyat < 0) {
        notifications.show({ title: 'Hata', message: 'Geçerli bir fiyat girin', color: 'red' });
        return;
      }
      updateMutation.mutate({ malzemeId, birimFiyat: editFiyat });
    },
    [editFiyat, updateMutation]
  );

  const handleClose = useCallback(() => {
    setEditingId(null);
    setEditFiyat('');
    onClose();
  }, [onClose]);

  // ─── Render ─────────────────────────────────────────────────
  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={
        <Group gap="xs">
          <IconCurrencyLira size={20} />
          <Text fw={600} size="sm">
            Maliyet Hesaplama Detayı
          </Text>
        </Group>
      }
      size="xl"
      fullScreen={isMobile && isMounted}
      styles={{
        body: { padding: isMobile ? 12 : undefined },
      }}
    >
      {isLoading && (
        <Center py="xl">
          <Loader size="md" />
        </Center>
      )}

      {isError && (
        <Center py="xl">
          <Stack align="center" gap="xs">
            <Text c="red" size="sm">
              Maliyet analizi yüklenemedi
            </Text>
            <ActionIcon variant="light" color="blue" onClick={() => refetch()}>
              <IconRefresh size={16} />
            </ActionIcon>
          </Stack>
        </Center>
      )}

      {analizData && !isLoading && (
        <Stack gap="md">
          {/* ─── Reçete başlık ──────────────────────────── */}
          <Group justify="space-between" align="flex-start">
            <Group gap="xs">
              {analizData.recete.ikon && <Text size="lg">{analizData.recete.ikon}</Text>}
              <Box>
                <Text fw={600} size="md">
                  {analizData.recete.ad}
                </Text>
                <Text size="xs" c="dimmed">
                  {analizData.recete.kategori}
                  {analizData.recete.porsiyon ? ` · ${analizData.recete.porsiyon}g` : ''}
                </Text>
              </Box>
            </Group>
            <ActionIcon variant="subtle" color="gray" onClick={() => refetch()} title="Yenile">
              <IconRefresh size={16} />
            </ActionIcon>
          </Group>

          {/* ─── Özet kartları ──────────────────────────── */}
          <Group grow gap="xs">
            <Paper p="xs" radius="md" style={{ background: 'var(--mantine-color-dark-6)' }}>
              <Text size="xs" c="dimmed">
                Sistem Maliyet
              </Text>
              <Text fw={700} size="lg" c="teal">
                ₺{computedToplam.sistem.toFixed(2)}
              </Text>
            </Paper>
            <Paper p="xs" radius="md" style={{ background: 'var(--mantine-color-dark-6)' }}>
              <Text size="xs" c="dimmed">
                Piyasa Maliyet
              </Text>
              <Text fw={700} size="lg" c="blue">
                ₺{computedToplam.piyasa.toFixed(2)}
              </Text>
            </Paper>
            <Paper p="xs" radius="md" style={{ background: 'var(--mantine-color-dark-6)' }}>
              <Text size="xs" c="dimmed">
                Fark
              </Text>
              <Text fw={700} size="lg" c={computedToplam.piyasa - computedToplam.sistem > 0 ? 'red' : 'green'}>
                {computedToplam.piyasa - computedToplam.sistem > 0 ? '+' : ''}₺
                {(computedToplam.piyasa - computedToplam.sistem).toFixed(2)}
              </Text>
            </Paper>
          </Group>

          {/* ─── Malzeme tablosu ────────────────────────── */}
          <ScrollArea.Autosize mah={400}>
            <Table striped highlightOnHover withTableBorder withColumnBorders fz="xs">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Malzeme</Table.Th>
                  <Table.Th ta="right">Miktar</Table.Th>
                  <Table.Th>Birim</Table.Th>
                  <Table.Th ta="right">Birim Fiyat</Table.Th>
                  <Table.Th ta="right">Toplam</Table.Th>
                  <Table.Th ta="center">Kaynak</Table.Th>
                  <Table.Th ta="center" w={70}>
                    İşlem
                  </Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {computedMalzemeler.map((m) => {
                  const isEditing = editingId === m.id;
                  const birimFiyatGosterim =
                    isEditing && m._editBirimFiyat != null ? m._editBirimFiyat : m.sistem_fiyat;
                  const toplamGosterim = isEditing && m._editToplam != null ? m._editToplam : m.sistem_toplam;
                  const kaynak = m.fiyat_kaynagi || 'yok';
                  const kaynakRenk = FIYAT_KAYNAGI_RENK[kaynak] || 'gray';

                  return (
                    <Table.Tr key={m.id}>
                      <Table.Td>
                        <Text size="xs" fw={500} lineClamp={1}>
                          {m.malzeme_adi}
                        </Text>
                      </Table.Td>
                      <Table.Td ta="right">
                        <Text size="xs">{m.miktar}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Group gap={4} wrap="nowrap">
                          <Text size="xs">{m.birim}</Text>
                          {m.birim.toLowerCase() !== m.fiyat_birimi?.toLowerCase() && (
                            <Tooltip label={`${m.birim} → ${m.fiyat_birimi} (×${m.carpan})`} withArrow>
                              <Text size="10px" c="dimmed" style={{ cursor: 'help' }}>
                                →{m.fiyat_birimi}
                              </Text>
                            </Tooltip>
                          )}
                        </Group>
                      </Table.Td>
                      <Table.Td ta="right">
                        {isEditing ? (
                          <NumberInput
                            size="xs"
                            value={editFiyat}
                            onChange={setEditFiyat}
                            min={0}
                            decimalScale={2}
                            fixedDecimalScale
                            prefix="₺"
                            w={100}
                            styles={{ input: { textAlign: 'right' } }}
                          />
                        ) : (
                          <Tooltip label={`/${m.fiyat_birimi}`} withArrow position="left">
                            <Text size="xs" style={{ cursor: 'help' }}>
                              ₺{Number(birimFiyatGosterim).toFixed(2)}
                            </Text>
                          </Tooltip>
                        )}
                      </Table.Td>
                      <Table.Td ta="right">
                        <Text size="xs" fw={isEditing ? 600 : 400} c={isEditing ? 'teal' : undefined}>
                          ₺{Number(toplamGosterim).toFixed(2)}
                        </Text>
                      </Table.Td>
                      <Table.Td ta="center">
                        <Badge size="xs" variant="light" color={kaynakRenk} radius="sm">
                          {fiyatKaynagiLabel(kaynak)}
                        </Badge>
                      </Table.Td>
                      <Table.Td ta="center">
                        {isEditing ? (
                          <Group gap={4} justify="center" wrap="nowrap">
                            <ActionIcon
                              size="xs"
                              variant="filled"
                              color="green"
                              onClick={() => saveEdit(m.id)}
                              loading={updateMutation.isPending}
                              title="Kaydet"
                            >
                              <IconCheck size={12} />
                            </ActionIcon>
                            <ActionIcon size="xs" variant="subtle" color="gray" onClick={cancelEdit} title="İptal">
                              <IconX size={12} />
                            </ActionIcon>
                          </Group>
                        ) : (
                          <ActionIcon
                            size="xs"
                            variant="subtle"
                            color="blue"
                            onClick={() => startEdit(m)}
                            title="Fiyat düzenle"
                          >
                            <IconEdit size={14} />
                          </ActionIcon>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
              {/* ─── Toplam satırı ────────────────────────── */}
              <Table.Tfoot>
                <Table.Tr>
                  <Table.Td colSpan={4}>
                    <Text size="xs" fw={700}>
                      TOPLAM
                    </Text>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Text size="xs" fw={700} c="teal">
                      ₺{computedToplam.sistem.toFixed(2)}
                    </Text>
                  </Table.Td>
                  <Table.Td colSpan={2} />
                </Table.Tr>
              </Table.Tfoot>
            </Table>
          </ScrollArea.Autosize>

          {/* ─── Malzeme sayısı bilgisi ─────────────────── */}
          <Text size="xs" c="dimmed" ta="right">
            {computedMalzemeler.length} malzeme
            {analizData.recete.porsiyon ? ` · Porsiyon: ${analizData.recete.porsiyon}g` : ''}
            {analizData.recete.kalori ? ` · ${analizData.recete.kalori} kcal` : ''}
          </Text>
        </Stack>
      )}
    </Modal>
  );
}
