'use client';

import {
  ActionIcon,
  Accordion,
  Badge,
  Box,
  Button,
  CopyButton,
  Divider,
  Drawer,
  Group,
  Loader,
  Paper,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconBook,
  IconCalculator,
  IconCheck,
  IconCopy,
  IconGavel,
  IconInfoCircle,
  IconScale,
  IconSearch,
} from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';

interface GuncelDegerler {
  asgari_ucret?: {
    brut: number;
    net: number;
    isveren_maliyeti: number;
    donem: string;
  };
  esik_degerler?: {
    mal_hizmet_genel: number;
    mal_hizmet_diger: number;
    yapim_isleri: number;
    dogrudan_temin_buyuksehir: number;
    dogrudan_temin_diger: number;
  };
  itirazen_sikayet_bedelleri?: Array<{
    alt: number;
    ust: number | null;
    bedel: number;
    aciklama: string;
  }>;
}

interface Formula {
  ad: string;
  formul: string;
  aciklama: string;
  ornek?: string;
}

export function MevzuatWidget() {
  const [opened, { open, close }] = useDisclosure(false);
  const [loading, setLoading] = useState(false);
  const [guncelDegerler, setGuncelDegerler] = useState<GuncelDegerler | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Mevzuat verilerini yükle
  const fetchMevzuatData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/mevzuat/guncel-degerler');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setGuncelDegerler(data.data);
        }
      }
    } catch (error) {
      console.error('Mevzuat fetch error:', error);
      // Fallback verileri
      setGuncelDegerler({
        asgari_ucret: {
          brut: 22104,
          net: 17801.65,
          isveren_maliyeti: 25972.2,
          donem: '2026 Ocak-Haziran',
        },
        esik_degerler: {
          mal_hizmet_genel: 18734124,
          mal_hizmet_diger: 31223308,
          yapim_isleri: 686924429,
          dogrudan_temin_buyuksehir: 1021827,
          dogrudan_temin_diger: 340648,
        },
        itirazen_sikayet_bedelleri: [
          { alt: 0, ust: 8447946, bedel: 50640, aciklama: "8.447.946 TL'ye kadar" },
          { alt: 8447946, ust: 33791911, bedel: 101344, aciklama: '8.4M - 33.8M TL arası' },
          { alt: 33791911, ust: 253439417, bedel: 152021, aciklama: '33.8M - 253.4M TL arası' },
          { alt: 253439417, ust: null, bedel: 202718, aciklama: '253.4M TL üstü' },
        ],
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (opened && !guncelDegerler) {
      fetchMevzuatData();
    }
  }, [opened, guncelDegerler, fetchMevzuatData]);

  // Formüller
  const formuller: Formula[] = [
    {
      ad: 'Sınır Değer Hesaplama (Hizmet Alımı)',
      formul: 'SD = (YM + T1 + T2 + ... + Tn) / (n + 1) × R',
      aciklama:
        "YM: Yaklaşık Maliyet, Tn: Geçerli teklifler (YM'nin %60'ından düşük ve YM'den yüksek olanlar hariç), R: Sınır değer katsayısı",
      ornek: 'Örn: YM=10M, T1=8M, T2=9M, R=0.79 → SD = (10+8+9)/3 × 0.79 = 7.11M',
    },
    {
      ad: 'Aşırı Düşük Oran (Yemek İhalesi)',
      formul: '(Ana Çiğ Girdi + İşçilik) / Toplam Teklif',
      aciklama: 'Hesaplanan oran 0.80 - 0.95 aralığında olmalıdır. Bu aralık dışındaki teklifler reddedilir.',
      ornek: 'Örn: Ana girdi=4M, İşçilik=500K, Toplam=5M → Oran=0.90 ✓',
    },
    {
      ad: 'Personel Çalıştırılmasına Dayalı Hizmet',
      formul: 'SD = Kar Hariç Yaklaşık Maliyet',
      aciklama: 'Personel çalıştırılmasına dayalı hizmet alımlarında sınır değer, kar hariç yaklaşık maliyete eşittir.',
    },
  ];

  // Mevzuat özeti
  const mevzuatOzeti = [
    {
      baslik: 'İtiraz Süreleri',
      icerik: [
        'İdareye şikayet: İhale kararı tebliğinden itibaren 10 gün',
        'İtirazen şikayet: İdare kararından itibaren 10 gün',
        'Tatil günleri süreye dahil, son gün tatile denk gelirse ilk iş gününe uzar',
      ],
    },
    {
      baslik: 'Yemek İhalesi Özel Kuralları',
      icerik: [
        'Malzemeli Yemek Sunumu Hesap Cetveli (EK-H.4) zorunlu',
        'HACCP belgesi aranır',
        'İş deneyim belgesi benzer iş tanımına uygun olmalı',
        'Gramaj ve kalori hesapları teknik şartnamede belirtilmeli',
      ],
    },
    {
      baslik: 'Doğrudan Temin',
      icerik: [
        'Büyükşehir içinde: 1.021.827 TL (2026)',
        'Büyükşehir dışında: 340.648 TL (2026)',
        'İhale yapılmadan, piyasa araştırması ile alım',
      ],
    },
  ];

  // Para formatı
  const formatMoney = (value: number) => {
    return value.toLocaleString('tr-TR') + ' ₺';
  };

  return (
    <>
      {/* Floating Button */}
      <Box
        style={{
          position: 'fixed',
          bottom: 20,
          right: 20,
          zIndex: 100,
        }}
      >
        <Tooltip label="Mevzuat & Rehber" position="left">
          <ActionIcon
            size={56}
            radius="xl"
            variant="gradient"
            gradient={{ from: 'indigo', to: 'cyan', deg: 45 }}
            onClick={open}
            style={{
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)',
            }}
          >
            <IconBook size={28} />
          </ActionIcon>
        </Tooltip>
      </Box>

      {/* Drawer Panel */}
      <Drawer
        opened={opened}
        onClose={close}
        title={
          <Group gap="xs">
            <ThemeIcon size="md" variant="light" color="indigo">
              <IconBook size={18} />
            </ThemeIcon>
            <Text fw={600}>Mevzuat & Rehber</Text>
          </Group>
        }
        position="right"
        size="md"
        overlayProps={{ backgroundOpacity: 0.3, blur: 2 }}
      >
        <ScrollArea h="calc(100vh - 80px)" offsetScrollbars>
          <Stack gap="md">
            {/* Arama */}
            <TextInput
              placeholder="Ara..."
              leftSection={<IconSearch size={16} />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.currentTarget.value)}
            />

            {loading ? (
              <Box ta="center" py="xl">
                <Loader size="sm" />
              </Box>
            ) : (
              <Accordion variant="separated" defaultValue="guncel">
                {/* Güncel Değerler */}
                <Accordion.Item value="guncel">
                  <Accordion.Control icon={<IconInfoCircle size={18} color="var(--mantine-color-teal-6)" />}>
                    Güncel Değerler (2026)
                  </Accordion.Control>
                  <Accordion.Panel>
                    <Stack gap="xs">
                      {/* Asgari Ücret */}
                      <Paper p="xs" withBorder>
                        <Text size="xs" c="dimmed" mb={4}>
                          Asgari Ücret ({guncelDegerler?.asgari_ucret?.donem})
                        </Text>
                        <Group justify="space-between">
                          <Text size="sm">Brüt:</Text>
                          <Text size="sm" fw={500}>
                            {formatMoney(guncelDegerler?.asgari_ucret?.brut || 22104)}
                          </Text>
                        </Group>
                        <Group justify="space-between">
                          <Text size="sm">Net:</Text>
                          <Text size="sm" fw={500}>
                            {formatMoney(guncelDegerler?.asgari_ucret?.net || 17801.65)}
                          </Text>
                        </Group>
                        <Group justify="space-between">
                          <Text size="sm">İşveren Maliyeti:</Text>
                          <Text size="sm" fw={500}>
                            {formatMoney(guncelDegerler?.asgari_ucret?.isveren_maliyeti || 25972.2)}
                          </Text>
                        </Group>
                      </Paper>

                      {/* Eşik Değerler */}
                      <Paper p="xs" withBorder>
                        <Text size="xs" c="dimmed" mb={4}>
                          Eşik Değerler
                        </Text>
                        <Stack gap={4}>
                          <Group justify="space-between">
                            <Text size="xs">Mal/Hizmet (Genel):</Text>
                            <CopyButton value={String(guncelDegerler?.esik_degerler?.mal_hizmet_genel || 18734124)}>
                              {({ copied, copy }) => (
                                <Group gap={4}>
                                  <Text size="xs" fw={500}>
                                    {formatMoney(guncelDegerler?.esik_degerler?.mal_hizmet_genel || 18734124)}
                                  </Text>
                                  <ActionIcon size="xs" variant="subtle" onClick={copy}>
                                    {copied ? <IconCheck size={12} /> : <IconCopy size={12} />}
                                  </ActionIcon>
                                </Group>
                              )}
                            </CopyButton>
                          </Group>
                          <Group justify="space-between">
                            <Text size="xs">Doğrudan Temin (Büyükşehir):</Text>
                            <Text size="xs" fw={500}>
                              {formatMoney(guncelDegerler?.esik_degerler?.dogrudan_temin_buyuksehir || 1021827)}
                            </Text>
                          </Group>
                        </Stack>
                      </Paper>

                      {/* İtirazen Şikayet Bedelleri */}
                      <Paper p="xs" withBorder>
                        <Text size="xs" c="dimmed" mb={4}>
                          İtirazen Şikayet Bedelleri
                        </Text>
                        <Stack gap={4}>
                          {guncelDegerler?.itirazen_sikayet_bedelleri?.map((item) => (
                            <Group key={item.aciklama} justify="space-between">
                              <Text size="xs">{item.aciklama}:</Text>
                              <Badge size="sm" variant="light" color="blue">
                                {formatMoney(item.bedel)}
                              </Badge>
                            </Group>
                          ))}
                        </Stack>
                      </Paper>
                    </Stack>
                  </Accordion.Panel>
                </Accordion.Item>

                {/* Formüller */}
                <Accordion.Item value="formuller">
                  <Accordion.Control icon={<IconCalculator size={18} color="var(--mantine-color-violet-6)" />}>
                    Formüller & Hesaplamalar
                  </Accordion.Control>
                  <Accordion.Panel>
                    <Stack gap="sm">
                      {formuller.map((f) => (
                        <Paper key={f.ad} p="sm" withBorder>
                          <Text size="sm" fw={500} mb="xs">
                            {f.ad}
                          </Text>
                          <Paper p="xs" bg="var(--mantine-color-dark-7)" radius="sm" mb="xs">
                            <Text size="xs" ff="monospace" c="cyan">
                              {f.formul}
                            </Text>
                          </Paper>
                          <Text size="xs" c="dimmed">
                            {f.aciklama}
                          </Text>
                          {f.ornek && (
                            <Text size="xs" c="teal" mt={4}>
                              {f.ornek}
                            </Text>
                          )}
                        </Paper>
                      ))}
                    </Stack>
                  </Accordion.Panel>
                </Accordion.Item>

                {/* Mevzuat Özeti */}
                <Accordion.Item value="mevzuat">
                  <Accordion.Control icon={<IconScale size={18} color="var(--mantine-color-orange-6)" />}>
                    Mevzuat Özeti
                  </Accordion.Control>
                  <Accordion.Panel>
                    <Stack gap="sm">
                      {mevzuatOzeti.map((m, idx) => (
                        <Box key={m.baslik}>
                          <Text size="sm" fw={500} mb="xs">
                            {m.baslik}
                          </Text>
                          <Stack gap={4}>
                            {m.icerik.map((item) => (
                              <Group key={item} gap="xs" align="flex-start">
                                <Text size="xs" c="dimmed">
                                  •
                                </Text>
                                <Text size="xs">{item}</Text>
                              </Group>
                            ))}
                          </Stack>
                          {idx < mevzuatOzeti.length - 1 && <Divider my="sm" />}
                        </Box>
                      ))}
                    </Stack>
                  </Accordion.Panel>
                </Accordion.Item>

                {/* KİK Emsal */}
                <Accordion.Item value="emsal">
                  <Accordion.Control icon={<IconGavel size={18} color="var(--mantine-color-red-6)" />}>
                    KİK Emsal Kararlar
                  </Accordion.Control>
                  <Accordion.Panel>
                    <Stack gap="sm">
                      <Text size="xs" c="dimmed">
                        Emsal karar aramak için AI asistanı kullanın veya KİK web sitesini ziyaret edin.
                      </Text>
                      <Button
                        variant="light"
                        color="red"
                        size="xs"
                        leftSection={<IconGavel size={14} />}
                        component="a"
                        href="https://ekk.kik.gov.tr/EKAP/"
                        target="_blank"
                      >
                        KİK Karar Arama
                      </Button>
                    </Stack>
                  </Accordion.Panel>
                </Accordion.Item>

                {/* Yeni Başlayanlar İçin */}
                <Accordion.Item value="rehber">
                  <Accordion.Control icon={<IconBook size={18} color="var(--mantine-color-green-6)" />}>
                    Yeni Başlayanlar İçin Rehber
                  </Accordion.Control>
                  <Accordion.Panel>
                    <Stack gap="sm">
                      <Text size="sm" fw={500}>
                        İhale Süreci Adımları
                      </Text>
                      <Stack gap={4}>
                        {[
                          '1. İhale ilanını takip edin (EKAP, ihalebul.com)',
                          '2. İhale dokümanını indirin ve inceleyin',
                          '3. Teknik şartnameyi detaylı okuyun',
                          '4. Yaklaşık maliyet tahminini yapın',
                          '5. Teklif hazırlayın ve kontrol edin',
                          '6. EKAP üzerinden teklif verin',
                          '7. İhale sonucunu takip edin',
                          '8. Gerekirse itiraz sürecini başlatın',
                        ].map((step) => (
                          <Text key={step} size="xs">
                            {step}
                          </Text>
                        ))}
                      </Stack>

                      <Divider my="xs" />

                      <Text size="sm" fw={500}>
                        Sık Yapılan Hatalar
                      </Text>
                      <Stack gap={4}>
                        {[
                          '❌ İş deneyim belgesinin benzer iş tanımına uymaması',
                          '❌ Teklif mektubunda imza eksikliği',
                          '❌ Aşırı düşük açıklamada belge eksikliği',
                          '❌ İtiraz süresinin kaçırılması',
                          '❌ Geçici teminat tutarının yanlış hesaplanması',
                        ].map((err) => (
                          <Text key={err} size="xs" c="red.4">
                            {err}
                          </Text>
                        ))}
                      </Stack>
                    </Stack>
                  </Accordion.Panel>
                </Accordion.Item>
              </Accordion>
            )}
          </Stack>
        </ScrollArea>
      </Drawer>
    </>
  );
}
