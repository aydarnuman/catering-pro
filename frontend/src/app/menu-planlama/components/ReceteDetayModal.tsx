'use client';

import {
  ActionIcon,
  Alert,
  Badge,
  Center,
  Group,
  Loader,
  Modal,
  Paper,
  Select,
  Stack,
  Table,
  Text,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconAlertCircle, IconCheck, IconInfoCircle, IconRobot, IconScale } from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { type AltTipTanimi, menuPlanlamaAPI } from '@/lib/api/services/menu-planlama';
import { menuPlanlamaKeys } from './queryKeys';
import type { BackendMaliyetAnaliziResponse, ReceteDetay, SartnameSet } from './types';

type GramajOnizlemeItem = {
  id: number;
  malzeme_adi: string;
  mevcut_miktar: number;
  mevcut_birim: string;
  sartname_gramaj: number | null;
  sartname_birim: string | null;
  kullanilan_miktar: number;
  kullanilan_birim: string;
  hesaplanan_fiyat: number;
  malzeme_tipi: string | null;
  birim_fiyat: number;
};

interface ReceteDetayModalProps {
  opened: boolean;
  onClose: () => void;
  receteId: number | null;
  isMobile: boolean;
  isMounted: boolean;
}

export function ReceteDetayModal({ opened, onClose, receteId, isMobile, isMounted }: ReceteDetayModalProps) {
  // Local state for recete detay
  const [receteDetay, setReceteDetay] = useState<ReceteDetay | null>(null);

  // Şartname listesini API'den çek
  const { data: sartnameListesi = [] } = useQuery<SartnameSet[]>({
    queryKey: menuPlanlamaKeys.sartnameler.liste(),
    queryFn: async () => {
      const res = await menuPlanlamaAPI.getSartnameListesi();
      return res.success ? (res.data as SartnameSet[]) : [];
    },
  });

  // Karşılaştırma için seçilen şartname (mevcut şartnamelerden)
  const [activeReceteTab, setActiveReceteTab] = useLocalStorage<number | null>('recete-sartname-secim-v2', null);

  // İlk şartnameler yüklendiğinde varsayılan seçim
  useEffect(() => {
    const list = sartnameListesi ?? [];
    if (list.length > 0 && activeReceteTab == null) {
      setActiveReceteTab(list[0].id);
    }
  }, [sartnameListesi, activeReceteTab, setActiveReceteTab]);

  // Şartname gramaj önizlemesi (yeni sistem - sartname_gramaj_kurallari)
  const {
    data: gramajOnizleme,
    isLoading: gramajOnizlemeLoading,
  } = useQuery({
    queryKey: menuPlanlamaKeys.sartnameler.gramajOnizleme(receteId, activeReceteTab ? String(activeReceteTab) : undefined),
    queryFn: async () => {
      if (!receteId || !activeReceteTab) return null;
      const res = await menuPlanlamaAPI.getReceteSartnameGramajOnizleme(receteId, activeReceteTab);
      return res.success ? res.data : null;
    },
    enabled: !!receteId && !!activeReceteTab && !!opened,
    staleTime: 30 * 1000,
  });

  // Gramaj uyum kontrolü (şartnameye göre uygun/düşük/yüksek/eksik)
  const { data: gramajKontrolData } = useQuery({
    queryKey: menuPlanlamaKeys.sartnameler.gramajKontrol(receteId, activeReceteTab ? String(activeReceteTab) : undefined),
    queryFn: async () => {
      if (!receteId || !activeReceteTab) return null;
      const res = await menuPlanlamaAPI.getGramajKontrol(receteId, { sartname_id: activeReceteTab });
      return res.success ? res.data : null;
    },
    enabled: !!receteId && !!activeReceteTab && !!opened,
    staleTime: 30 * 1000,
  });

  // React Query: Reçete detayı
  const {
    data: receteDetayData,
    isLoading: detayLoading,
    error: receteDetayError,
  } = useQuery<ReceteDetay>({
    queryKey: menuPlanlamaKeys.receteler.detay(receteId),
    queryFn: async (): Promise<ReceteDetay> => {
      if (!receteId) throw new Error('Reçete ID gerekli');

      const result = await menuPlanlamaAPI.getMaliyetAnalizi(receteId);
      if (!result.success || !result.data) {
        throw new Error('Reçete detayı yüklenemedi');
      }

      const backendData = result.data as unknown as BackendMaliyetAnaliziResponse;

      return {
        id: backendData.recete.id,
        kod: backendData.recete.kod || '',
        ad: backendData.recete.ad,
        kategori: backendData.recete.kategori || 'Diğer',
        porsiyon_gram: backendData.recete.porsiyon || 0,
        sistem_maliyet: backendData.maliyet.sistem,
        piyasa_maliyet: backendData.maliyet.piyasa,
        malzemeler: backendData.malzemeler.map((m) => ({
          id: m.id,
          malzeme_adi: m.malzeme_adi,
          miktar: m.miktar,
          birim: m.birim,
          stok_kart_id: null,
          stok_adi: null,
          sistem_fiyat: m.sistem_fiyat,
          piyasa_fiyat: m.piyasa_fiyat,
          stok_birim: null,
          fiyat_kaynagi: m.fiyat_kaynagi || null,
          varyant_kaynak_adi: m.varyant_kaynak_adi || null,
          varyant_sayisi: m.varyant_sayisi || 0,
        })),
      };
    },
    enabled: !!receteId,
    retry: 2,
  });

  // Error handling for recete detay
  useEffect(() => {
    if (receteDetayError) {
      notifications.show({
        title: 'Hata',
        message: 'Reçete detayı yüklenemedi',
        color: 'red',
      });
    }
  }, [receteDetayError]);

  // Modal kapandığında/açıldığında detayı güncelle
  useEffect(() => {
    if (!opened) {
      setReceteDetay(null);
    } else if (receteDetayData) {
      setReceteDetay(receteDetayData);
    }
  }, [opened, receteDetayData]);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="sm">
          <IconScale size={24} color="var(--mantine-color-teal-6)" />
          <Text fw={600}>{receteDetay?.ad || 'Reçete Detayı'}</Text>
        </Group>
      }
      size="lg"
      fullScreen={isMobile && isMounted}
    >
      {detayLoading ? (
        <Center py="xl">
          <Loader color="teal" />
        </Center>
      ) : receteDetay ? (
        <Stack gap="md">
          {/* Alt Tip Seçici */}
          <AltTipSecici receteId={receteDetay.id} />

            <Stack gap="md">
              {/* Mevcut şartnamelerden seçerek reçete–şartname gramaj karşılaştırması */}
              <Select
                label="Şartnameye göre gramaj önizlemesi"
                description="Karşılaştırmak için mevcut şartnamelerden birini seçin"
                placeholder="Şartname seçin..."
                value={activeReceteTab?.toString() ?? null}
                onChange={(val) => setActiveReceteTab(val ? Number(val) : null)}
                data={(sartnameListesi ?? []).map((s) => ({ value: s.id.toString(), label: s.ad }))}
                clearable
                searchable
                style={{ maxWidth: 320 }}
              />

              {/* Gramaj uyum kontrolü özeti (şartname → reçete) */}
              {activeReceteTab != null && (() => {
                const kontrol = gramajKontrolData?.gramaj_kontrol ?? null;
                if (!kontrol) return null;
                const { uygun_sayisi, uyumsuz_sayisi, toplam_kontrol, sonuclar } = kontrol;
                const uyumsuzlar = sonuclar.filter((s) => s.durum !== 'uygun');
                return (
                  <Paper withBorder radius="md" p="sm">
                    <Group gap="xs" mb={uyumsuzlar.length > 0 ? 'sm' : 0}>
                      <IconScale size={18} color="var(--mantine-color-teal-6)" />
                      <Text size="sm" fw={600}>
                        Şartname uyum kontrolü
                      </Text>
                    </Group>
                    <Group gap="md">
                      <Badge
                        size="sm"
                        variant="light"
                        color="green"
                        leftSection={<IconCheck size={12} />}
                      >
                        {uygun_sayisi} uygun
                      </Badge>
                      {uyumsuz_sayisi > 0 && (
                        <Badge
                          size="sm"
                          variant="light"
                          color="orange"
                          leftSection={<IconAlertCircle size={12} />}
                        >
                          {uyumsuz_sayisi} uyumsuz
                        </Badge>
                      )}
                      <Text size="xs" c="dimmed">
                        Toplam {toplam_kontrol} kural kontrol edildi
                      </Text>
                    </Group>
                    {uyumsuzlar.length > 0 && (
                      <Table mt="sm" withTableBorder withColumnBorders layout="fixed" fz="xs">
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>Malzeme tipi</Table.Th>
                            <Table.Th ta="right">Hedef</Table.Th>
                            <Table.Th ta="right">Reçete</Table.Th>
                            <Table.Th>Durum</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {uyumsuzlar.map((s, i) => (
                            <Table.Tr key={`${s.malzeme_tipi}-${i}`}>
                              <Table.Td>{s.malzeme_tipi}</Table.Td>
                              <Table.Td ta="right">
                                {s.hedef_gramaj} {s.birim}
                              </Table.Td>
                              <Table.Td ta="right">
                                {s.recete_gramaj != null ? `${s.recete_gramaj} ${s.birim}` : '—'}
                              </Table.Td>
                              <Table.Td>
                                <Badge
                                  size="xs"
                                  variant="light"
                                  color={
                                    s.durum === 'eksik'
                                      ? 'red'
                                      : s.durum === 'dusuk'
                                        ? 'yellow'
                                        : 'orange'
                                  }
                                >
                                  {s.durum === 'eksik'
                                    ? 'Eksik'
                                    : s.durum === 'dusuk'
                                      ? 'Düşük'
                                      : 'Yüksek'}
                                </Badge>
                              </Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>
                    )}
                  </Paper>
                );
              })()}

              {/* Varyant fiyat bilgisi */}
              {receteDetay.malzemeler.some((m) => m.fiyat_kaynagi === 'VARYANT') && (
                <Alert variant="light" color="violet" icon={<IconInfoCircle size={16} />} radius="md" py="xs">
                  <Group gap="xs" wrap="wrap">
                    <Text size="xs">Bazı malzemelerin fiyatı varyantlardan alınıyor:</Text>
                    {receteDetay.malzemeler
                      .filter((m) => m.fiyat_kaynagi === 'VARYANT')
                      .map((m) => (
                        <Badge key={m.id} size="xs" variant="light" color="violet" radius="sm">
                          {m.malzeme_adi}
                          {m.varyant_kaynak_adi ? ` → ${m.varyant_kaynak_adi}` : ''}
                        </Badge>
                      ))}
                  </Group>
                </Alert>
              )}

              {/* Gramaj Önizleme Tablosu (yeni sistem - sartname_gramaj_kurallari) */}
              {(() => {
                const malzemeler = (gramajOnizleme?.malzemeler ?? []) as GramajOnizlemeItem[];
                const altTipId = gramajOnizleme?.alt_tip_id ?? null;
                const toplamMaliyet = gramajOnizleme?.toplam_maliyet ?? 0;
                const sartnameSecili = activeReceteTab != null;

                if (!sartnameSecili) {
                  return (
                    <Paper withBorder radius="md" p="xl">
                      <Text size="sm" c="dimmed" ta="center">
                        Karşılaştırma için yukarıdaki listeden bir şartname seçin.
                      </Text>
                    </Paper>
                  );
                }

                if (gramajOnizlemeLoading) {
                  return (
                    <Paper withBorder radius="md" p="xl">
                      <Center>
                        <Loader size="sm" color="teal" />
                      </Center>
                    </Paper>
                  );
                }

                if (!altTipId) {
                  return (
                    <Paper withBorder radius="md" p="xl">
                      <Text size="sm" c="dimmed" ta="center">
                        Reçeteye alt tip atanmamış. Alt tip atandığında şartname gramaj kuralları görünür.
                      </Text>
                    </Paper>
                  );
                }

                if (malzemeler.length === 0) {
                  return (
                    <Paper withBorder radius="md" p="xl">
                      <Text size="sm" c="dimmed" ta="center">
                        Bu reçetede malzeme bulunamadı.
                      </Text>
                    </Paper>
                  );
                }

                const sartnameDoluSayisi = malzemeler.filter((m) => m.sartname_gramaj != null).length;

                return (
                  <Paper withBorder radius="md" p={0} style={{ overflow: 'hidden' }}>
                    {sartnameDoluSayisi === 0 && (
                      <Alert variant="light" color="blue" radius="md" m="md" mb={0}>
                        <Text size="sm">
                          Bu şartnamede bu alt tip için eşleşen gramaj kuralı bulunamadı. Şartname Yönetimi&apos;nden
                          kural ekleyebilirsiniz.
                        </Text>
                      </Alert>
                    )}
                    <Table>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th style={{ width: '35%' }}>Malzeme</Table.Th>
                          <Table.Th ta="right" style={{ width: '12%' }}>
                            Reçete
                          </Table.Th>
                          <Table.Th ta="right" style={{ width: '12%' }}>
                            Şartname
                          </Table.Th>
                          <Table.Th ta="center" style={{ width: '8%' }}>
                            Birim
                          </Table.Th>
                          <Table.Th ta="right" style={{ width: '15%' }}>
                            Fiyat
                          </Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {malzemeler.map((m) => (
                          <Table.Tr key={m.id}>
                            <Table.Td>
                              <Text size="sm">{m.malzeme_adi}</Text>
                              {m.malzeme_tipi && (
                                <Badge size="xs" variant="light" color="teal" mt={4}>
                                  {m.malzeme_tipi}
                                </Badge>
                              )}
                            </Table.Td>
                            <Table.Td ta="right">
                              <Text size="sm" c="dimmed">
                                {m.mevcut_miktar}
                              </Text>
                            </Table.Td>
                            <Table.Td ta="right">
                              {m.sartname_gramaj != null ? (
                                <Text size="sm" fw={600} c="teal">
                                  {m.sartname_gramaj}
                                </Text>
                              ) : (
                                <Text size="sm" c="dimmed">
                                  —
                                </Text>
                              )}
                            </Table.Td>
                            <Table.Td ta="center">
                              <Text size="xs" c="dimmed">
                                {m.kullanilan_birim}
                              </Text>
                            </Table.Td>
                            <Table.Td ta="right">
                              <Text size="sm">₺{m.hesaplanan_fiyat.toFixed(2)}</Text>
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                    <Group justify="flex-end" p="md" bg="dark.6">
                      <Text size="sm" fw={600}>
                        Toplam: ₺{toplamMaliyet.toFixed(2)}
                      </Text>
                    </Group>
                    <Text size="xs" c="dimmed" ta="center" pb="md" px="md">
                      Şartname kurallarını düzenlemek için Şartname Yönetimi&apos;ni kullanın.
                    </Text>
                  </Paper>
                );
              })()}
            </Stack>
        </Stack>
      ) : (
        <Text c="dimmed" ta="center" py="xl">
          Reçete bilgisi bulunamadı
        </Text>
      )}
    </Modal>
  );
}

// =============================================
// Alt Tip Seçici Bileşeni
// =============================================
function AltTipSecici({ receteId }: { receteId: number }) {
  // Alt tipleri getir
  const { data: altTipler = [] } = useQuery<AltTipTanimi[]>({
    queryKey: ['alt-tipler'],
    queryFn: async () => {
      const res = await menuPlanlamaAPI.getAltTipler();
      return res.success ? (res.data as AltTipTanimi[]) : [];
    },
  });

  // Reçetenin mevcut detayını al
  const { data: receteData, refetch: refetchRecete } = useQuery({
    queryKey: menuPlanlamaKeys.receteler.altTip(receteId),
    queryFn: async () => {
      const res = await menuPlanlamaAPI.getRecete(receteId);
      return res.success ? res.data : null;
    },
    enabled: !!receteId,
  });

  const altTipSecenekleri = useMemo(() => {
    const list = altTipler ?? [];
    const byGroup = new Map<string, Array<{ value: string; label: string }>>();
    for (const t of list) {
      const g = t.kategori_adi || 'Diğer';
      const items = byGroup.get(g) ?? [];
      if (items.length === 0) byGroup.set(g, items);
      items.push({
        value: String(t.id),
        label: `${t.ikon || ''} ${t.ad}`.trim(),
      });
    }
    return Array.from(byGroup.entries()).map(([group, items]) => ({ group, items }));
  }, [altTipler]);

  // Alt tip güncelleme
  const updateMutation = useMutation({
    mutationFn: (altTipId: number) => menuPlanlamaAPI.updateReceteAltTip(receteId, altTipId),
    onSuccess: () => {
      refetchRecete();
      notifications.show({ message: 'Alt tip güncellendi', color: 'green' });
    },
  });

  // AI önerisi
  const aiOneriMutation = useMutation({
    mutationFn: () => menuPlanlamaAPI.aiAltTipOneri(receteId),
    onSuccess: (res) => {
      if (res.success && res.data.oneri) {
        const tip = altTipler.find((t) => t.kod === res.data.oneri);
        if (tip) {
          updateMutation.mutate(tip.id);
          notifications.show({
            title: 'AI Önerisi',
            message: `"${res.data.oneri_adi}" olarak atandı`,
            color: 'blue',
          });
        }
      } else {
        notifications.show({ message: 'AI öneri üretemedi', color: 'yellow' });
      }
    },
  });

  const mevcutAltTipId = (receteData as unknown as Record<string, unknown>)?.alt_tip_id as number | undefined;
  const altTipAktifDegil =
    mevcutAltTipId != null && altTipler.length > 0 && !altTipler.some((t) => t.id === mevcutAltTipId);

  return (
    <Paper withBorder p="xs" radius="md">
      {altTipAktifDegil && (
        <Alert
          color="yellow"
          variant="light"
          icon={<IconAlertCircle size={16} />}
          title="Bu alt tip artık aktif değil"
          mb="xs"
        >
          Reçetenize atanmış alt tip listeden kaldırılmış. Şartname uyumu için lütfen başka bir alt tip seçin.
        </Alert>
      )}
      <Group gap="sm">
        <Text size="xs" fw={600} c="dimmed">
          Alt Tip:
        </Text>
        <Select
          placeholder="Alt tip seçin..."
          data={altTipSecenekleri ?? []}
          value={mevcutAltTipId ? String(mevcutAltTipId) : null}
          onChange={(val) => {
            if (val) updateMutation.mutate(Number(val));
          }}
          searchable
          size="xs"
          w={250}
          clearable
        />
        <ActionIcon
          size="sm"
          variant="light"
          color="blue"
          onClick={() => aiOneriMutation.mutate()}
          loading={aiOneriMutation.isPending}
          title="AI ile alt tip öner"
        >
          <IconRobot size={14} />
        </ActionIcon>
      </Group>
    </Paper>
  );
}
