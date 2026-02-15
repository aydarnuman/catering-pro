'use client';

import {
  ActionIcon,
  Autocomplete,
  Badge,
  Box,
  Button,
  Chip,
  Drawer,
  Group,
  Loader,
  Modal,
  NumberInput,
  Paper,
  ScrollArea,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconClipboardList, IconPlus, IconRefresh, IconRobot, IconTrash, IconX } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { type AltTipTanimi, type GramajKurali, menuPlanlamaAPI } from '@/lib/api/services/menu-planlama';
import { menuPlanlamaKeys } from './queryKeys';

interface SartnameYonetimModalProps {
  opened: boolean;
  onClose: () => void;
}

interface SartnameItem {
  id: number;
  kod: string;
  ad: string;
  kurum_adi?: string;
  kurum_ikon?: string;
  yil?: number;
  gramaj_sayisi?: number;
}

// Profil seçenekleri
const SARTNAME_PROFILLERI = [
  { value: 'kyk_yurt', label: '🏫 KYK / Öğrenci Yurdu', desc: 'Standart öğrenci porsiyonu' },
  { value: 'hastane', label: '🏥 Hastane / Diyet', desc: 'Düşük yağ, kontrollü kalori' },
  { value: 'okul', label: '🎓 Okul / MEB', desc: 'Çocuk-genç porsiyonu' },
  { value: 'kurumsal', label: '🏢 Kurumsal Yemekhane', desc: 'Standart yetişkin porsiyon' },
  { value: 'premium', label: '🏨 Premium / Restoran', desc: 'Büyük porsiyon, kaliteli malzeme' },
  { value: 'agir_is', label: '🎖️ Ağır İş / Asker', desc: 'Büyük porsiyon, yüksek kalori' },
  { value: 'diyet', label: '🥗 Diyet / Sağlık', desc: 'Düşük kalorili, hafif porsiyonlar' },
];

export function SartnameYonetimModal({ opened, onClose }: SartnameYonetimModalProps) {
  const queryClient = useQueryClient();
  const [seciliSartnameId, setSeciliSartnameId] = useState<number | null>(null);
  const [kategoriFiltre, setKategoriFiltre] = useState<string | null>(null);
  const [profilSecimAcik, setProfilSecimAcik] = useState(false);
  const [yeniSartnameFormu, setYeniSartnameFormu] = useState<{
    ad: string;
    kod: string;
  } | null>(null);
  const [yeniKuralFormu, setYeniKuralFormu] = useState<{
    alt_tip_id: string;
    malzeme_tipi: string;
    gramaj: number;
    birim: string;
  } | null>(null);
  const [topluUygulaKategoriId, setTopluUygulaKategoriId] = useState<number | null>(null);
  const [topluUygulaAltTipId, setTopluUygulaAltTipId] = useState<number | null>(null);

  // Şartname listesi
  const { data: sartnameler = [], isLoading: sartnameLoading } = useQuery<SartnameItem[]>({
    queryKey: menuPlanlamaKeys.sartnameler.liste(),
    queryFn: async () => {
      const res = await menuPlanlamaAPI.getSartnameListesi();
      return res.success ? (res.data as SartnameItem[]) : [];
    },
    enabled: opened,
  });

  // Alt tipler
  const { data: altTipler = [] } = useQuery<AltTipTanimi[]>({
    queryKey: ['alt-tipler'],
    queryFn: async () => {
      const res = await menuPlanlamaAPI.getAltTipler();
      return res.success ? (res.data as AltTipTanimi[]) : [];
    },
    enabled: opened,
  });

  // Malzeme eşleme sözlüğü (malzeme tipi önerileri için)
  const { data: malzemeEslesmeleri = [] } = useQuery({
    queryKey: ['malzeme-eslesmeleri'],
    queryFn: async () => {
      const res = await menuPlanlamaAPI.getMalzemeEslesmeleri();
      return res.success ? (res.data as Array<{ malzeme_tipi: string }>) : [];
    },
    enabled: opened,
  });

  // Reçete kategorileri (toplu uygulama filtre için)
  const { data: receteKategorileri = [] } = useQuery({
    queryKey: menuPlanlamaKeys.receteler.kategoriler(),
    queryFn: async () => {
      const res = await menuPlanlamaAPI.getKategoriler();
      return res.success ? (res.data as Array<{ id: number; ad: string }>) : [];
    },
    enabled: opened,
  });

  // Seçili şartnamenin gramaj kuralları
  const {
    data: gramajKurallari = [],
    isLoading: kurallarLoading,
    refetch: refetchKurallar,
  } = useQuery<GramajKurali[]>({
    queryKey: ['gramaj-kurallari', seciliSartnameId],
    queryFn: async () => {
      if (!seciliSartnameId) return [];
      const res = await menuPlanlamaAPI.getGramajKurallari(seciliSartnameId);
      return res.success ? (res.data as GramajKurali[]) : [];
    },
    enabled: !!seciliSartnameId && opened,
  });

  // Şartname silme mutation
  const silSartnameMutation = useMutation({
    mutationFn: (id: number) => menuPlanlamaAPI.deleteSartname(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: menuPlanlamaKeys.sartnameler.liste() });
      setSeciliSartnameId(null);
      notifications.show({ message: 'Şartname silindi', color: 'green' });
    },
    onError: (err: Error) => {
      notifications.show({ title: 'Hata', message: err.message, color: 'red' });
    },
  });

  // Yeni şartname oluşturma mutation
  const yeniSartnameMutation = useMutation({
    mutationFn: (data: { ad: string; kod: string }) => menuPlanlamaAPI.createSartname({ ad: data.ad, kod: data.kod }),
    onSuccess: (res) => {
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: menuPlanlamaKeys.sartnameler.liste() });
        setSeciliSartnameId(res.data.id);
        setYeniSartnameFormu(null);
        notifications.show({ message: 'Şartname oluşturuldu', color: 'green' });
      }
    },
    onError: (err: Error) => {
      notifications.show({ title: 'Hata', message: err.message, color: 'red' });
    },
  });

  // İlk şartnameyi otomatik seç
  if (sartnameler.length > 0 && seciliSartnameId === null) {
    setSeciliSartnameId(sartnameler[0].id);
  }

  // Benzersiz kategoriler (filtre için)
  const kategoriler = useMemo(() => {
    const map = new Map<string, { kod: string; ad: string; ikon: string }>();
    for (const k of gramajKurallari) {
      if (k.kategori_kodu && !map.has(k.kategori_kodu)) {
        map.set(k.kategori_kodu, {
          kod: k.kategori_kodu,
          ad: k.kategori_adi || k.kategori_kodu,
          ikon: k.kategori_ikon || '',
        });
      }
    }
    return Array.from(map.values());
  }, [gramajKurallari]);

  // Filtrelenmiş ve gruplanmış kurallar
  const grupluKurallar = useMemo(() => {
    const filtered = kategoriFiltre
      ? gramajKurallari.filter((k) => k.kategori_kodu === kategoriFiltre)
      : gramajKurallari;

    // Alt tip bazlı gruplama
    const groups = new Map<number, { altTip: GramajKurali; kurallar: GramajKurali[] }>();
    for (const kural of filtered) {
      if (!groups.has(kural.alt_tip_id)) {
        groups.set(kural.alt_tip_id, { altTip: kural, kurallar: [] });
      }
      groups.get(kural.alt_tip_id)?.kurallar.push(kural);
    }
    return Array.from(groups.values());
  }, [gramajKurallari, kategoriFiltre]);

  const KURAL_DEGISIKLIK_BILGI =
    "Reçete malzemeleri otomatik güncellenmez; değişikliği reçetelere yansıtmak için Toplu uygula'yı kullanın.";

  // Kural silme mutation
  const silMutation = useMutation({
    mutationFn: (kuralId: number) => menuPlanlamaAPI.deleteGramajKurali(kuralId),
    onSuccess: () => {
      refetchKurallar();
      notifications.show({ message: 'Kural silindi', color: 'green' });
      notifications.show({ message: KURAL_DEGISIKLIK_BILGI, color: 'blue', autoClose: 6000 });
    },
  });

  // Kural güncelleme mutation
  const guncelleMutation = useMutation({
    mutationFn: ({ kuralId, data }: { kuralId: number; data: { gramaj?: number; birim?: string } }) =>
      menuPlanlamaAPI.updateGramajKurali(kuralId, data),
    onSuccess: () => {
      refetchKurallar();
      notifications.show({ message: KURAL_DEGISIKLIK_BILGI, color: 'blue', autoClose: 6000 });
    },
  });

  // Yeni kural ekleme
  const ekleMutation = useMutation({
    mutationFn: (data: { alt_tip_id: number; malzeme_tipi: string; gramaj: number; birim: string }) => {
      if (!seciliSartnameId) throw new Error('Şartname seçilmedi');
      return menuPlanlamaAPI.addGramajKurali(seciliSartnameId, data);
    },
    onSuccess: () => {
      refetchKurallar();
      setYeniKuralFormu(null);
      notifications.show({ message: 'Kural eklendi', color: 'green' });
      notifications.show({ message: KURAL_DEGISIKLIK_BILGI, color: 'blue', autoClose: 6000 });
    },
    onError: (err: Error) => {
      notifications.show({ message: err.message || 'Hata oluştu', color: 'red' });
    },
  });

  // Toplu uygulama mutation
  const topluUygulaMutation = useMutation({
    mutationFn: () => {
      if (!seciliSartnameId) throw new Error('Şartname seçilmedi');
      const body: { kategori_id?: number; alt_tip_id?: number } = {};
      if (topluUygulaKategoriId != null) body.kategori_id = topluUygulaKategoriId;
      if (topluUygulaAltTipId != null) body.alt_tip_id = topluUygulaAltTipId;
      return menuPlanlamaAPI.topluGramajUygula(seciliSartnameId, body);
    },
    onSuccess: (res) => {
      if (res.success) {
        const d = res.data;
        notifications.show({
          title: 'Toplu Uygulama Tamamlandı',
          message: `${d.guncellenen_recete} reçetede ${d.guncellenen_malzeme} malzeme güncellendi.`,
          color: 'green',
        });
        queryClient.invalidateQueries({ queryKey: menuPlanlamaKeys.receteler.all() });
        queryClient.invalidateQueries({ queryKey: menuPlanlamaKeys.receteler.kategoriler() });
      }
    },
    onError: (err: Error) => {
      notifications.show({ title: 'Hata', message: err.message, color: 'red' });
    },
  });

  // AI gramaj kuralları oluşturma mutation
  const aiGramajMutation = useMutation({
    mutationFn: (profil: string) => {
      if (!seciliSartnameId) throw new Error('Şartname seçilmedi');
      return menuPlanlamaAPI.aiGramajOlustur(seciliSartnameId, { profil });
    },
    onSuccess: (res) => {
      if (res.success) {
        const d = res.data;
        refetchKurallar();
        setProfilSecimAcik(false);
        notifications.show({
          title: 'AI Gramaj Kuralları Oluşturuldu',
          message: `${d.eklenen} yeni kural eklendi, ${d.atlanan} mevcut kural atlandı.`,
          color: 'green',
          autoClose: 5000,
        });
        notifications.show({
          message: KURAL_DEGISIKLIK_BILGI,
          color: 'blue',
          autoClose: 6000,
        });
      }
    },
    onError: (err: Error) => {
      notifications.show({ title: 'AI Hatası', message: err.message, color: 'red' });
    },
  });

  // Malzeme tipi öneri listesi: sözlük + bu şartnamedeki kurallardaki tipler (tekilleştirilmiş, sıralı)
  const malzemeTipiSecenekleri = useMemo(() => {
    const sozlukTipleri = malzemeEslesmeleri.map((m) => m.malzeme_tipi).filter(Boolean);
    const kuralTipleri = gramajKurallari.map((k) => k.malzeme_tipi).filter(Boolean);
    return Array.from(new Set([...sozlukTipleri, ...kuralTipleri])).sort((a, b) => a.localeCompare(b));
  }, [malzemeEslesmeleri, gramajKurallari]);

  // Alt tip Select seçenekleri
  const altTipSecenekleri = useMemo(
    () =>
      (altTipler ?? []).map((t) => ({
        value: String(t.id),
        label: `${t.ikon || ''} ${t.ad} (${t.kategori_adi || '?'})`.trim(),
      })),
    [altTipler]
  );

  const handleKuralEkle = useCallback(() => {
    if (!yeniKuralFormu || !yeniKuralFormu.alt_tip_id || !yeniKuralFormu.malzeme_tipi || !yeniKuralFormu.gramaj) return;
    ekleMutation.mutate({
      alt_tip_id: Number(yeniKuralFormu.alt_tip_id),
      malzeme_tipi: yeniKuralFormu.malzeme_tipi,
      gramaj: yeniKuralFormu.gramaj,
      birim: yeniKuralFormu.birim || 'g',
    });
  }, [yeniKuralFormu, ekleMutation]);

  const seciliSartname = sartnameler.find((s) => s.id === seciliSartnameId);

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconClipboardList size={20} />
          <Title order={4}>Şartname Yönetimi</Title>
        </Group>
      }
      size="xl"
      position="right"
      padding="md"
    >
      <Stack gap="md" h="calc(100vh - 80px)">
        {/* Şartname Seçici + Yeni Ekle */}
        {yeniSartnameFormu ? (
          <Paper withBorder p="sm" style={{ background: 'var(--mantine-color-dark-6)' }}>
            <Group justify="space-between" mb="xs">
              <Text fw={600} size="sm">
                Yeni Şartname Oluştur
              </Text>
              <ActionIcon size="sm" variant="subtle" color="gray" onClick={() => setYeniSartnameFormu(null)}>
                <IconX size={14} />
              </ActionIcon>
            </Group>
            <Stack gap="xs">
              <TextInput
                label="Şartname Adı"
                placeholder="ör: ABC Holding Şartnamesi"
                value={yeniSartnameFormu.ad}
                onChange={(e) => setYeniSartnameFormu({ ...yeniSartnameFormu, ad: e.target.value })}
                size="xs"
              />
              <Button
                size="xs"
                color="green"
                fullWidth
                leftSection={<IconCheck size={14} />}
                onClick={() => {
                  if (yeniSartnameFormu.ad.trim()) {
                    yeniSartnameMutation.mutate({
                      ad: yeniSartnameFormu.ad.trim(),
                      kod: yeniSartnameFormu.kod || '',
                    });
                  }
                }}
                loading={yeniSartnameMutation.isPending}
                disabled={!yeniSartnameFormu.ad.trim()}
              >
                Oluştur
              </Button>
            </Stack>
          </Paper>
        ) : (
          <Group gap="xs" align="end">
            <Select
              label="Şartname"
              placeholder="Şartname seçin..."
              data={(sartnameler ?? []).map((s) => ({
                value: String(s.id),
                label:
                  `${s.kurum_ikon || ''} ${s.ad}${s.gramaj_sayisi ? ` — ${s.gramaj_sayisi} kural` : ' — boş'}`.trim(),
              }))}
              value={seciliSartnameId ? String(seciliSartnameId) : null}
              onChange={(val) => {
                setSeciliSartnameId(val ? Number(val) : null);
                setKategoriFiltre(null);
              }}
              searchable
              disabled={sartnameLoading}
              style={{ flex: 1 }}
            />
            <Tooltip label="Yeni şartname ekle">
              <ActionIcon
                size="lg"
                variant="light"
                color="green"
                onClick={() => setYeniSartnameFormu({ ad: '', kod: '' })}
                mb={1}
              >
                <IconPlus size={16} />
              </ActionIcon>
            </Tooltip>
            {seciliSartnameId && (
              <Tooltip label="Şartnameyi sil">
                <ActionIcon
                  size="lg"
                  variant="light"
                  color="red"
                  mb={1}
                  onClick={() => {
                    const name = seciliSartname?.ad || 'bu şartname';
                    if (window.confirm(`"${name}" şartnamesini ve tüm kurallarını silmek istediğinize emin misiniz?`)) {
                      silSartnameMutation.mutate(seciliSartnameId);
                    }
                  }}
                  loading={silSartnameMutation.isPending}
                >
                  <IconTrash size={16} />
                </ActionIcon>
              </Tooltip>
            )}
          </Group>
        )}

        {seciliSartname && (
          <>
            {/* Kategori Filtreleme */}
            {kategoriler.length > 0 && (
              <Chip.Group
                value={kategoriFiltre || ''}
                onChange={(v) => setKategoriFiltre((typeof v === 'string' ? v : null) || null)}
              >
                <Group gap="xs">
                  <Chip value="" variant="light" size="xs">
                    Tümü
                  </Chip>
                  {kategoriler.map((k) => (
                    <Chip key={k.kod} value={k.kod} variant="light" size="xs">
                      {k.ikon} {k.ad}
                    </Chip>
                  ))}
                </Group>
              </Chip.Group>
            )}

            {/* Gramaj Kuralları */}
            <ScrollArea flex={1} offsetScrollbars>
              {kurallarLoading ? (
                <Box ta="center" py="xl">
                  <Loader size="sm" />
                </Box>
              ) : grupluKurallar.length === 0 ? (
                <Paper p="lg" withBorder ta="center">
                  <Text c="dimmed" size="sm">
                    Bu şartnameye henüz gramaj kuralı eklenmemiş.
                  </Text>
                </Paper>
              ) : (
                <Stack gap="md">
                  {grupluKurallar.map(({ altTip, kurallar }) => (
                    <Paper key={altTip.alt_tip_id} withBorder p="sm" radius="md">
                      <Group gap="xs" mb="xs">
                        <Text size="lg">{altTip.alt_tip_ikon}</Text>
                        <Text fw={600} size="sm">
                          {altTip.alt_tip_adi}
                        </Text>
                        <Badge size="xs" variant="light" color="gray">
                          {altTip.kategori_adi}
                        </Badge>
                      </Group>

                      <Table striped highlightOnHover withTableBorder withColumnBorders fz="sm">
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>Malzeme Tipi</Table.Th>
                            <Table.Th w={100} ta="right">
                              Gramaj
                            </Table.Th>
                            <Table.Th w={60}>Birim</Table.Th>
                            <Table.Th w={60} ta="center">
                              İşlem
                            </Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {kurallar.map((k) => (
                            <KuralSatiri
                              key={k.id}
                              kural={k}
                              onUpdate={(data) => guncelleMutation.mutate({ kuralId: k.id, data })}
                              onDelete={() => silMutation.mutate(k.id)}
                            />
                          ))}
                        </Table.Tbody>
                      </Table>
                    </Paper>
                  ))}
                </Stack>
              )}
            </ScrollArea>

            {/* Yeni kural ekleme */}
            {yeniKuralFormu ? (
              <Paper withBorder p="sm" style={{ background: 'var(--mantine-color-dark-6)' }}>
                <Group justify="space-between" mb="xs">
                  <Text fw={600} size="sm">
                    Yeni Gramaj Kuralı
                  </Text>
                  <ActionIcon color="gray" variant="subtle" onClick={() => setYeniKuralFormu(null)} size="sm">
                    <IconX size={14} />
                  </ActionIcon>
                </Group>
                <Stack gap="xs">
                  <Select
                    label="Alt Tip"
                    placeholder="Alt tip seçin..."
                    data={altTipSecenekleri}
                    value={yeniKuralFormu.alt_tip_id}
                    onChange={(v) => setYeniKuralFormu({ ...yeniKuralFormu, alt_tip_id: v || '' })}
                    searchable
                    size="xs"
                  />
                  <Group grow gap="xs">
                    <Autocomplete
                      label="Malzeme Tipi"
                      placeholder="Seçin veya yazın (ör: Çiğ et, Sıvı yağ)"
                      value={yeniKuralFormu.malzeme_tipi}
                      onChange={(v) => setYeniKuralFormu({ ...yeniKuralFormu, malzeme_tipi: v })}
                      data={malzemeTipiSecenekleri}
                      size="xs"
                    />
                    <NumberInput
                      label="Gramaj"
                      placeholder="150"
                      value={yeniKuralFormu.gramaj || ''}
                      onChange={(v) => setYeniKuralFormu({ ...yeniKuralFormu, gramaj: Number(v) || 0 })}
                      min={0}
                      size="xs"
                      w={100}
                    />
                    <Select
                      label="Birim"
                      data={['g', 'ml', 'adet']}
                      value={yeniKuralFormu.birim}
                      onChange={(v) => setYeniKuralFormu({ ...yeniKuralFormu, birim: v || 'g' })}
                      size="xs"
                      w={80}
                    />
                  </Group>
                  <Button
                    leftSection={<IconCheck size={14} />}
                    color="green"
                    variant="filled"
                    size="xs"
                    onClick={handleKuralEkle}
                    loading={ekleMutation.isPending}
                    fullWidth
                  >
                    Ekle
                  </Button>
                </Stack>
              </Paper>
            ) : (
              <Stack gap="sm">
                <Group gap="xs" wrap="wrap">
                  <Button
                    leftSection={<IconRobot size={14} />}
                    variant="filled"
                    size="xs"
                    color="blue"
                    onClick={() => setProfilSecimAcik(true)}
                    loading={aiGramajMutation.isPending}
                  >
                    AI ile Kuralları Oluştur
                  </Button>
                  <Button
                    leftSection={<IconPlus size={14} />}
                    variant="light"
                    size="xs"
                    onClick={() => setYeniKuralFormu({ alt_tip_id: '', malzeme_tipi: '', gramaj: 0, birim: 'g' })}
                  >
                    Elle Kural Ekle
                  </Button>
                  <Button
                    leftSection={<IconRefresh size={14} />}
                    variant="filled"
                    size="xs"
                    color="teal"
                    onClick={() => topluUygulaMutation.mutate()}
                    loading={topluUygulaMutation.isPending}
                    disabled={gramajKurallari.length === 0}
                  >
                    Reçetelere Uygula
                  </Button>
                </Group>
                <Group gap="xs" align="flex-end">
                  <Select
                    placeholder="Tüm kategoriler"
                    label="Toplu uygulama: Kategori"
                    description="Boş bırakırsanız tüm reçeteler uygulanır"
                    data={receteKategorileri.map((k) => ({ value: String(k.id), label: k.ad }))}
                    value={topluUygulaKategoriId != null ? String(topluUygulaKategoriId) : null}
                    onChange={(v) => setTopluUygulaKategoriId(v ? Number(v) : null)}
                    clearable
                    searchable
                    size="xs"
                    style={{ minWidth: 160 }}
                  />
                  <Select
                    placeholder="Tüm alt tipler"
                    label="Toplu uygulama: Alt tip"
                    description="Boş bırakırsanız tüm reçeteler uygulanır"
                    data={altTipSecenekleri}
                    value={topluUygulaAltTipId != null ? String(topluUygulaAltTipId) : null}
                    onChange={(v) => setTopluUygulaAltTipId(v ? Number(v) : null)}
                    clearable
                    searchable
                    size="xs"
                    style={{ minWidth: 180 }}
                  />
                </Group>
              </Stack>
            )}
          </>
        )}
      </Stack>

      {/* Profil Seçim Modal */}
      <Modal
        opened={profilSecimAcik}
        onClose={() => setProfilSecimAcik(false)}
        title={
          <Group gap="xs">
            <IconRobot size={20} />
            <Text fw={600}>Şartname Profili Seçin</Text>
          </Group>
        }
        size="md"
      >
        <Stack gap="xs">
          <Text size="sm" c="dimmed">
            Bu şartname nasıl bir kurum/hizmet için? AI, seçtiğiniz profile göre gramajları belirleyecek.
          </Text>
          {SARTNAME_PROFILLERI.map((profil) => (
            <Paper
              key={profil.value}
              withBorder
              p="sm"
              radius="md"
              style={{
                cursor: aiGramajMutation.isPending ? 'wait' : 'pointer',
                transition: 'all 0.15s ease',
              }}
              onClick={() => {
                if (!aiGramajMutation.isPending) {
                  aiGramajMutation.mutate(profil.value);
                }
              }}
            >
              <Group justify="space-between">
                <Box>
                  <Text size="sm" fw={600}>
                    {profil.label}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {profil.desc}
                  </Text>
                </Box>
                {aiGramajMutation.isPending && aiGramajMutation.variables === profil.value && <Loader size="xs" />}
              </Group>
            </Paper>
          ))}

          {/* Mevcut şartnameden kopyala */}
          <Paper withBorder p="sm" radius="md" style={{ borderStyle: 'dashed' }}>
            <Text size="sm" fw={600} c="dimmed">
              📋 Mevcut şartnameden kopyala
            </Text>
            <Select
              placeholder="Kaynak şartname seçin..."
              data={sartnameler
                .filter((s) => s.id !== seciliSartnameId)
                .map((s) => ({
                  value: String(s.id),
                  label: `${s.kurum_ikon || ''} ${s.ad}`.trim(),
                }))}
              onChange={(val) => {
                if (val) {
                  aiGramajMutation.mutate(`kopyala:${val}`);
                }
              }}
              size="xs"
              mt="xs"
              searchable
              disabled={aiGramajMutation.isPending}
            />
          </Paper>
        </Stack>
      </Modal>
    </Drawer>
  );
}

// Kural satırı bileşeni (inline düzenleme)
function KuralSatiri({
  kural,
  onUpdate,
  onDelete,
}: {
  kural: GramajKurali;
  onUpdate: (data: { gramaj?: number; birim?: string }) => void;
  onDelete: () => void;
}) {
  const [editGramaj, setEditGramaj] = useState<number>(kural.gramaj);

  return (
    <Table.Tr>
      <Table.Td>{kural.malzeme_tipi}</Table.Td>
      <Table.Td ta="right">
        <NumberInput
          value={editGramaj}
          onChange={(v) => setEditGramaj(Number(v) || 0)}
          onBlur={() => {
            if (editGramaj !== kural.gramaj) {
              onUpdate({ gramaj: editGramaj });
            }
          }}
          size="xs"
          min={0}
          hideControls
          styles={{ input: { textAlign: 'right', width: 80 } }}
          variant="unstyled"
        />
      </Table.Td>
      <Table.Td>
        <Text size="xs" c="dimmed">
          {kural.birim}
        </Text>
      </Table.Td>
      <Table.Td ta="center">
        <Tooltip label="Sil">
          <ActionIcon size="xs" variant="subtle" color="red" onClick={onDelete}>
            <IconTrash size={12} />
          </ActionIcon>
        </Tooltip>
      </Table.Td>
    </Table.Tr>
  );
}
