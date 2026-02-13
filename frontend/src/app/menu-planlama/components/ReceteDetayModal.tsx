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
  Tabs,
  Text,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconInfoCircle, IconPlus, IconScale, IconX } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { menuPlanlamaAPI } from '@/lib/api/services/menu-planlama';
import { GramajEditableRow } from './GramajEditableRow';
import { GramajNewRow } from './GramajNewRow';
import type { BackendMaliyetAnaliziResponse, ReceteDetay, SartnameGramaj, SartnameSet } from './types';

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
  const { data: sartnameListesi = [], refetch: refetchSartnameler } = useQuery<SartnameSet[]>({
    queryKey: ['sartname-liste'],
    queryFn: async () => {
      const res = await menuPlanlamaAPI.getSartnameListesi();
      return res.success ? (res.data as SartnameSet[]) : [];
    },
  });

  // Şartname tab'ları - her tab bir şartnameyi temsil eder (id'ler)
  const [sartnameTabs, setSartnameTabs] = useLocalStorage<number[]>('recete-sartname-tabs-v2', []);
  const [activeReceteTab, setActiveReceteTab] = useLocalStorage<number | null>('recete-active-tab-v2', null);
  const [newSartnameName, setNewSartnameName] = useState('');

  // İlk şartnameler yüklendiğinde tab'ları ayarla
  useEffect(() => {
    if (sartnameListesi.length > 0 && sartnameTabs.length === 0) {
      const ilkUc = sartnameListesi.slice(0, 3).map((s) => s.id);
      setSartnameTabs(ilkUc);
      setActiveReceteTab(ilkUc[0]);
    }
  }, [sartnameListesi, sartnameTabs.length, setSartnameTabs, setActiveReceteTab]);

  // Şartname detaylarını cache'le (gramajlarıyla birlikte)
  const [sartnameDetayCache, setSartnameDetayCache] = useState<Record<number, SartnameSet>>({});

  // Tab için şartname bilgisini al (gramajlarıyla)
  const getTabSartname = useCallback(
    (tabId: number): SartnameSet | undefined => {
      if (sartnameDetayCache[tabId]) {
        return sartnameDetayCache[tabId];
      }
      return sartnameListesi.find((s) => s.id === tabId);
    },
    [sartnameDetayCache, sartnameListesi]
  );

  // Şartname detayını API'den çek (gramajlarıyla)
  const fetchSartnameDetay = useCallback(
    async (sartnameId: number) => {
      if (sartnameDetayCache[sartnameId]) return sartnameDetayCache[sartnameId];

      try {
        const res = await menuPlanlamaAPI.getSartnameDetay(sartnameId);
        if (res.success) {
          const raw = res.data as Record<string, unknown>;
          const detay = { ...raw, gramajlar: (raw.gramajlar as unknown[]) || [] } as SartnameSet;
          setSartnameDetayCache((prev) => ({ ...prev, [sartnameId]: detay }));
          return detay;
        }
      } catch (err) {
        console.error('Şartname detay hatası:', err);
      }
      return null;
    },
    [sartnameDetayCache]
  );

  // Aktif tab değiştiğinde gramajları yükle
  useEffect(() => {
    if (activeReceteTab && !sartnameDetayCache[activeReceteTab]) {
      fetchSartnameDetay(activeReceteTab);
    }
  }, [activeReceteTab, sartnameDetayCache, fetchSartnameDetay]);

  // Yeni şartname ekle
  const handleAddSartname = async () => {
    if (!newSartnameName.trim()) return;

    try {
      const res = await menuPlanlamaAPI.createSartname({ ad: newSartnameName.trim() });
      if (res.success) {
        await refetchSartnameler();
        setSartnameTabs((prev) => [...prev, res.data.id]);
        setActiveReceteTab(res.data.id);
        setNewSartnameName('');
        notifications.show({ title: 'Başarılı', message: 'Şartname eklendi', color: 'green' });
      }
    } catch (_err) {
      notifications.show({ title: 'Hata', message: 'Şartname eklenemedi', color: 'red' });
    }
  };

  // Yeni gramaj ekle
  const handleAddGramaj = async (
    sartnameId: number,
    malzeme: string,
    gramaj: number,
    birim: string,
    birimFiyat?: number
  ) => {
    try {
      const res = await menuPlanlamaAPI.addGramaj(sartnameId, { yemek_turu: malzeme, porsiyon_gramaj: gramaj, birim });
      if (res.success) {
        const rawGramaj = res.data as Record<string, unknown>;
        const newGramaj: SartnameGramaj = {
          id: rawGramaj.id as number,
          yemek_turu: (rawGramaj.yemek_turu as string) || malzeme,
          malzeme_adi: rawGramaj.malzeme_adi as string | undefined,
          porsiyon_gramaj: (rawGramaj.porsiyon_gramaj as number) || gramaj,
          birim: (rawGramaj.birim as string) || birim,
          birim_fiyat: birimFiyat,
        };
        setSartnameDetayCache((prev) => {
          const current = prev[sartnameId];
          if (!current) return prev;
          return {
            ...prev,
            [sartnameId]: {
              ...current,
              gramajlar: [...(current.gramajlar || []), newGramaj],
            },
          };
        });
      }
    } catch (err) {
      console.error('Gramaj eklenemedi:', err);
    }
  };

  // Gramaj güncelle
  const handleUpdateGramaj = async (
    gramajId: number,
    sartnameId: number,
    data: { yemek_turu?: string; porsiyon_gramaj?: number; birim?: string }
  ) => {
    try {
      const result = await menuPlanlamaAPI.updateGramaj(gramajId, data);
      if (result.success) {
        setSartnameDetayCache((prev) => {
          const current = prev[sartnameId];
          if (!current || !current.gramajlar) return prev;
          return {
            ...prev,
            [sartnameId]: {
              ...current,
              gramajlar: current.gramajlar.map((g) => (g.id === gramajId ? { ...g, ...data } : g)),
            },
          };
        });
      }
    } catch (err) {
      console.error('Gramaj güncellenemedi:', err);
    }
  };

  // Gramaj sil
  const handleDeleteGramaj = async (gramajId: number, sartnameId: number) => {
    try {
      const data = await menuPlanlamaAPI.deleteGramaj(gramajId);
      if (data.success) {
        setSartnameDetayCache((prev) => {
          const current = prev[sartnameId];
          if (!current || !current.gramajlar) return prev;
          return {
            ...prev,
            [sartnameId]: {
              ...current,
              gramajlar: current.gramajlar.filter((g) => g.id !== gramajId),
            },
          };
        });
      }
    } catch (err) {
      console.error('Gramaj silinemedi:', err);
    }
  };

  // React Query: Reçete detayı
  const {
    data: receteDetayData,
    isLoading: detayLoading,
    error: receteDetayError,
  } = useQuery<ReceteDetay>({
    queryKey: ['recete-detay', receteId],
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
        <Tabs
          value={activeReceteTab?.toString() || ''}
          onChange={(val) => setActiveReceteTab(val ? Number(val) : null)}
        >
          <Stack gap="md">
            {/* Tab listesi - Pill style */}
            <Group gap="xs" wrap="wrap">
              {sartnameTabs.map((tabId) => {
                const sartname = getTabSartname(tabId);
                const isActive = activeReceteTab === tabId;
                return (
                  <Paper
                    key={tabId}
                    p="xs"
                    px="md"
                    radius="xl"
                    withBorder
                    style={{
                      cursor: 'pointer',
                      background: isActive ? 'var(--mantine-color-teal-9)' : 'var(--mantine-color-dark-6)',
                      borderColor: isActive ? 'var(--mantine-color-teal-6)' : 'var(--mantine-color-dark-4)',
                      transition: 'all 0.15s ease',
                    }}
                    onClick={() => {
                      setActiveReceteTab(tabId);
                      fetchSartnameDetay(tabId);
                    }}
                  >
                    <Group gap={8} wrap="nowrap">
                      <Text size="sm" fw={isActive ? 600 : 400} c={isActive ? 'white' : 'dimmed'}>
                        {sartname?.ad || `Şartname ${tabId}`}
                      </Text>
                      {sartnameTabs.length > 1 && (
                        <ActionIcon
                          size={16}
                          radius="xl"
                          variant="subtle"
                          color={isActive ? 'white' : 'gray'}
                          onClick={(e) => {
                            e.stopPropagation();
                            const newTabs = sartnameTabs.filter((t) => t !== tabId);
                            setSartnameTabs(newTabs);
                            if (activeReceteTab === tabId) {
                              setActiveReceteTab(newTabs[0]);
                            }
                          }}
                        >
                          <IconX size={10} />
                        </ActionIcon>
                      )}
                    </Group>
                  </Paper>
                );
              })}

              {/* Yeni şartname ekle */}
              {sartnameListesi.filter((s) => !sartnameTabs.includes(s.id)).length > 0 && (
                <Select
                  size="xs"
                  placeholder="+ Ekle"
                  w={100}
                  data={sartnameListesi
                    .filter((s) => !sartnameTabs.includes(s.id))
                    .map((s) => ({ value: s.id.toString(), label: s.ad }))}
                  onChange={(val) => {
                    if (val) {
                      const numVal = Number(val);
                      if (!sartnameTabs.includes(numVal)) {
                        setSartnameTabs([...sartnameTabs, numVal]);
                        setActiveReceteTab(numVal);
                        fetchSartnameDetay(numVal);
                      }
                    }
                  }}
                  comboboxProps={{ withinPortal: true }}
                  styles={{ input: { borderRadius: 20 } }}
                />
              )}

              {/* Manuel şartname ekleme */}
              <Group gap={4}>
                <TextInput
                  size="xs"
                  placeholder="Yeni..."
                  w={80}
                  value={newSartnameName}
                  onChange={(e) => setNewSartnameName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddSartname()}
                  styles={{ input: { borderRadius: 20 } }}
                />
                <ActionIcon
                  size="sm"
                  radius="xl"
                  variant="light"
                  color="teal"
                  onClick={handleAddSartname}
                  disabled={!newSartnameName.trim()}
                >
                  <IconPlus size={14} />
                </ActionIcon>
              </Group>
            </Group>

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

            {/* Gramaj Tablosu - Aktif tab'ın içeriği */}
            {(() => {
              const currentSartname = getTabSartname(activeReceteTab || 0);
              const gramajlar = currentSartname?.gramajlar || [];

              return (
                <Paper withBorder radius="md" p={0} style={{ overflow: 'hidden' }}>
                  <Table>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th style={{ width: '40%' }}>Malzeme</Table.Th>
                        <Table.Th ta="center" style={{ width: '15%' }}>
                          Gramaj
                        </Table.Th>
                        <Table.Th ta="center" style={{ width: '12%' }}>
                          Birim
                        </Table.Th>
                        <Table.Th ta="right" style={{ width: '18%' }}>
                          Fiyat
                        </Table.Th>
                        <Table.Th style={{ width: 40 }} />
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {gramajlar.map((g) => (
                        <GramajEditableRow
                          key={g.id}
                          gramaj={g}
                          sartnameId={activeReceteTab || 0}
                          onUpdate={handleUpdateGramaj}
                          onDelete={handleDeleteGramaj}
                        />
                      ))}
                      {/* Yeni satır ekleme */}
                      <GramajNewRow sartnameId={activeReceteTab || 0} onAdd={handleAddGramaj} />
                    </Table.Tbody>
                  </Table>

                  {gramajlar.length === 0 && (
                    <Text size="sm" c="dimmed" ta="center" py="lg">
                      Bu şartnameye henüz gramaj eklenmemiş
                    </Text>
                  )}
                </Paper>
              );
            })()}
          </Stack>
        </Tabs>
      ) : (
        <Text c="dimmed" ta="center" py="xl">
          Reçete bilgisi bulunamadı
        </Text>
      )}
    </Modal>
  );
}
