'use client';

import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Divider,
  Grid,
  Group,
  NumberInput,
  Paper,
  Progress,
  RingProgress,
  ScrollArea,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  ThemeIcon,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconAlertTriangle,
  IconCalculator,
  IconCheck,
  IconCurrencyLira,
  IconInfoCircle,
  IconPercentage,
  IconPlus,
  IconShieldCheck,
  IconTrash,
} from '@tabler/icons-react';
import { useState } from 'react';
import {
  type ActiveTool,
  hesaplaKikSinirDegerFormul,
  IHALE_KATSAYILARI,
  type IhaleTuru,
} from '../../calculation-utils';
import type { UseTeklifMerkeziReturn } from '../hooks/useTeklifMerkezi';

interface HesaplamalarSectionProps {
  ctx: UseTeklifMerkeziReturn;
}

export function HesaplamalarSection({ ctx }: HesaplamalarSectionProps) {
  const {
    hesaplamaState,
    setHesaplamaState,
    basitSinirDeger,
    riskAnalizi,
    teminatlar,
    ogunBasiMaliyet,
    ogunBasiTeklif,
    aylikMaliyet,
  } = ctx;

  const [activeTool, setActiveTool] = useState<ActiveTool>('temel');

  const { yaklasikMaliyet, bizimTeklif, ihaleTuru, teklifListesi, kikSinirDeger, maliyetler } = hesaplamaState;
  const { isAsiriDusuk, fark, farkYuzde } = riskAnalizi;
  const { geciciTeminat, kesinTeminat } = teminatlar;

  const toplamMaliyet = Object.values(maliyetler).reduce((a, b) => a + b, 0);
  const karMarji = bizimTeklif > 0 && toplamMaliyet > 0 ? ((bizimTeklif - toplamMaliyet) / bizimTeklif) * 100 : 0;

  const setYaklasikMaliyet = (v: number) => setHesaplamaState((p) => ({ ...p, yaklasikMaliyet: v }));
  const setBizimTeklif = (v: number) => setHesaplamaState((p) => ({ ...p, bizimTeklif: v }));
  const setIhaleTuru = (v: IhaleTuru) => setHesaplamaState((p) => ({ ...p, ihaleTuru: v }));
  const setTeklifListesi = (fn: (prev: typeof teklifListesi) => typeof teklifListesi) =>
    setHesaplamaState((p) => ({ ...p, teklifListesi: fn(p.teklifListesi) }));
  const setKikSinirDeger = (v: number | null) => setHesaplamaState((p) => ({ ...p, kikSinirDeger: v }));
  const setMaliyetler = (fn: (prev: typeof maliyetler) => typeof maliyetler) =>
    setHesaplamaState((p) => ({ ...p, maliyetler: fn(p.maliyetler) }));

  const hesaplaKikSinirDegerFn = () => {
    const sonuc = hesaplaKikSinirDegerFormul(teklifListesi, yaklasikMaliyet, ihaleTuru);
    if (!sonuc) {
      const gecerli = teklifListesi.filter((t) => t.tutar > 0);
      notifications.show({
        title: gecerli.length < 3 ? 'Yetersiz Veri' : 'Yaklaşık Maliyet Gerekli',
        message: gecerli.length < 3 ? 'En az 3 geçerli teklif girmelisiniz' : 'Önce yaklaşık maliyeti girin',
        color: 'yellow',
      });
      return;
    }
    setKikSinirDeger(sonuc.sinirDeger);
    notifications.show({
      title: 'Sınır Değer Hesaplandı',
      message: `${sonuc.gecerliSayisi} geçerli teklif, ${IHALE_KATSAYILARI[ihaleTuru].aciklama}${sonuc.elenenSayisi > 0 ? ` (${sonuc.elenenSayisi} teklif elendi)` : ''}`,
      color: 'green',
    });
  };

  // ─── Temel Hesaplama ───
  const renderTemelHesaplama = () => (
    <Grid gutter="lg">
      <Grid.Col span={6}>
        <Stack gap="md">
          <NumberInput
            label="Yaklaşık Maliyet (İhale Bedeli)"
            description="İhale ilanındaki tahmini bedel"
            placeholder="0"
            value={yaklasikMaliyet || ''}
            onChange={(val) => setYaklasikMaliyet(Number(val) || 0)}
            min={0}
            max={999999999999}
            thousandSeparator="."
            decimalSeparator=","
            suffix=" ₺"
            size="md"
            leftSection={<IconCurrencyLira size={18} />}
            styles={{ input: { fontWeight: 600 } }}
          />
          <NumberInput
            label="Bizim Teklif"
            description="Vereceğiniz teklif tutarı"
            placeholder="0"
            value={bizimTeklif || ''}
            onChange={(val) => setBizimTeklif(Number(val) || 0)}
            min={0}
            max={999999999999}
            thousandSeparator="."
            decimalSeparator=","
            suffix=" ₺"
            size="md"
            leftSection={<IconCurrencyLira size={18} />}
            styles={{ input: { fontWeight: 600 } }}
          />
          <Paper p="md" bg="dark.7" radius="md">
            <Group justify="space-between" mb="xs">
              <Text size="sm" c="dimmed">
                Sınır Değer (x0.85)
              </Text>
              <Badge size="sm" variant="light" color="blue">
                Otomatik
              </Badge>
            </Group>
            <Text size="xl" fw={700} c="blue">
              {basitSinirDeger > 0 ? `${basitSinirDeger.toLocaleString('tr-TR')} ₺` : '—'}
            </Text>
            <Text size="xs" c="dimmed" mt={4}>
              Bu değerin altı "aşırı düşük" sorgulamasına tabi
            </Text>
          </Paper>
        </Stack>
      </Grid.Col>
      <Grid.Col span={6}>
        <Paper
          p="xl"
          radius="md"
          h="100%"
          style={{
            background:
              yaklasikMaliyet === 0
                ? 'var(--mantine-color-dark-6)'
                : isAsiriDusuk
                  ? 'linear-gradient(135deg, rgba(255,107,107,0.15) 0%, rgba(255,107,107,0.05) 100%)'
                  : 'linear-gradient(135deg, rgba(81,207,102,0.15) 0%, rgba(81,207,102,0.05) 100%)',
            border:
              yaklasikMaliyet > 0
                ? `2px solid var(--mantine-color-${isAsiriDusuk ? 'red' : 'green'}-6)`
                : '1px solid var(--mantine-color-dark-4)',
          }}
        >
          <Stack align="center" justify="center" h="100%" gap="md">
            {yaklasikMaliyet === 0 ? (
              <>
                <RingProgress
                  size={100}
                  thickness={8}
                  sections={[{ value: 0, color: 'gray' }]}
                  label={
                    <Text ta="center" size="sm" c="dimmed">
                      ?
                    </Text>
                  }
                />
                <Text c="dimmed" ta="center">
                  Yaklaşık Maliyet girin
                </Text>
              </>
            ) : bizimTeklif === 0 ? (
              <>
                <RingProgress
                  size={100}
                  thickness={8}
                  sections={[{ value: 50, color: 'blue' }]}
                  label={
                    <Text ta="center" fw={700}>
                      50%
                    </Text>
                  }
                />
                <Text c="dimmed" ta="center">
                  Bizim Teklif girin
                </Text>
              </>
            ) : (
              <>
                <ThemeIcon
                  size={80}
                  radius="xl"
                  variant="gradient"
                  gradient={isAsiriDusuk ? { from: 'red', to: 'orange' } : { from: 'teal', to: 'green' }}
                >
                  {isAsiriDusuk ? <IconAlertTriangle size={40} /> : <IconCheck size={40} />}
                </ThemeIcon>
                <Text size="xl" fw={700} c={isAsiriDusuk ? 'red' : 'green'} ta="center">
                  {isAsiriDusuk ? 'AŞIRI DÜŞÜK RİSKİ' : 'UYGUN TEKLİF'}
                </Text>
                <Text size="sm" c="dimmed" ta="center">
                  {isAsiriDusuk ? 'Açıklama hazırlamanız gerekebilir' : 'Aşırı düşük sorgusu riski düşük'}
                </Text>
                <Paper p="sm" bg="dark.8" radius="md" w="100%">
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">
                      Sınır Değerden Fark
                    </Text>
                    <Text size="sm" fw={600} c={fark >= 0 ? 'green' : 'red'}>
                      {fark >= 0 ? '+' : ''}
                      {fark.toLocaleString('tr-TR')} ₺ ({farkYuzde >= 0 ? '+' : ''}
                      {farkYuzde.toFixed(1)}%)
                    </Text>
                  </Group>
                </Paper>
              </>
            )}
          </Stack>
        </Paper>
      </Grid.Col>
    </Grid>
  );

  // ─── KİK Sınır Değer ───
  const renderKikSinirDeger = () => (
    <Stack gap="md">
      <Paper
        p="md"
        bg="rgba(201, 162, 39, 0.1)"
        radius="md"
        style={{ border: '1px solid var(--mantine-color-yellow-6)' }}
      >
        <Group gap="xs" mb="xs">
          <IconInfoCircle size={16} color="var(--mantine-color-yellow-6)" />
          <Text size="sm" fw={600} c="yellow">
            KİK Sınır Değer Formülü (Güncel Mevzuat)
          </Text>
        </Group>
        <Text size="xs" c="dimmed">
          <strong>Formül:</strong> SD = ((YM + Sum Tn) / (n+1)) x R
        </Text>
      </Paper>
      <Select
        label="İhale Türü"
        value={ihaleTuru}
        onChange={(val) => val && setIhaleTuru(val as IhaleTuru)}
        data={[
          { value: 'hizmet', label: 'Hizmet Alımı (R = 0.90)' },
          { value: 'yapim_ustyapi', label: 'Yapım İşi - Üstyapı/Bina (N = 1.00)' },
          { value: 'yapim_altyapi', label: 'Yapım İşi - Altyapı (N = 1.20)' },
        ]}
        allowDeselect={false}
      />
      <SimpleGrid cols={2} spacing="md">
        <Stack gap="xs">
          <Group justify="space-between">
            <Text size="sm" fw={600}>
              Rakip Teklifler
            </Text>
            <Button
              size="compact-xs"
              variant="light"
              leftSection={<IconPlus size={12} />}
              onClick={() => setTeklifListesi((prev) => [...prev, { firma: `Firma ${prev.length + 1}`, tutar: 0 }])}
            >
              Ekle
            </Button>
          </Group>
          <ScrollArea h={250}>
            <Stack gap="xs">
              {teklifListesi.map((teklif, index) => (
                <Group key={index} gap="xs">
                  <TextInput
                    placeholder="Firma"
                    value={teklif.firma}
                    onChange={(e) =>
                      setTeklifListesi((prev) =>
                        prev.map((t, i) => (i === index ? { ...t, firma: e.target.value } : t))
                      )
                    }
                    size="xs"
                    style={{ flex: 1 }}
                  />
                  <NumberInput
                    placeholder="Tutar"
                    value={teklif.tutar || ''}
                    onChange={(val) =>
                      setTeklifListesi((prev) =>
                        prev.map((t, i) => (i === index ? { ...t, tutar: Number(val) || 0 } : t))
                      )
                    }
                    min={0}
                    thousandSeparator="."
                    decimalSeparator=","
                    suffix=" ₺"
                    size="xs"
                    style={{ width: 150 }}
                  />
                  {teklifListesi.length > 3 && (
                    <ActionIcon
                      size="sm"
                      variant="subtle"
                      color="red"
                      onClick={() => setTeklifListesi((prev) => prev.filter((_, i) => i !== index))}
                    >
                      <IconTrash size={14} />
                    </ActionIcon>
                  )}
                </Group>
              ))}
            </Stack>
          </ScrollArea>
          <Button
            fullWidth
            variant="gradient"
            gradient={{ from: 'yellow', to: 'orange' }}
            leftSection={<IconCalculator size={16} />}
            onClick={hesaplaKikSinirDegerFn}
          >
            KİK Formülü ile Hesapla
          </Button>
        </Stack>
        <Paper p="lg" bg="dark.7" radius="md">
          <Stack align="center" justify="center" h="100%" gap="md">
            <Text size="sm" c="dimmed">
              KİK Sınır Değer
            </Text>
            <Text size="2rem" fw={700} c="yellow">
              {kikSinirDeger ? `${kikSinirDeger.toLocaleString('tr-TR')} ₺` : '—'}
            </Text>
            {kikSinirDeger && bizimTeklif > 0 && (
              <Badge size="lg" color={bizimTeklif < kikSinirDeger ? 'red' : 'green'} variant="light">
                {bizimTeklif < kikSinirDeger ? 'Sınırın Altında' : 'Sınırın Üstünde'}
              </Badge>
            )}
            <Divider w="100%" />
            <Group justify="space-between" w="100%">
              <Text size="xs" c="dimmed">
                Basit Hesap (x0.85)
              </Text>
              <Text size="xs" fw={500}>
                {basitSinirDeger.toLocaleString('tr-TR')} ₺
              </Text>
            </Group>
            <Group justify="space-between" w="100%">
              <Text size="xs" c="dimmed">
                Teklif Sayısı
              </Text>
              <Text size="xs" fw={500}>
                {teklifListesi.filter((t) => t.tutar > 0).length}
              </Text>
            </Group>
          </Stack>
        </Paper>
      </SimpleGrid>
    </Stack>
  );

  // ─── Aşırı Düşük ───
  const renderAsiriDusuk = () => (
    <Stack gap="md">
      <Paper
        p="md"
        bg="rgba(255, 107, 107, 0.1)"
        radius="md"
        style={{ border: '1px solid var(--mantine-color-red-6)' }}
      >
        <Group gap="xs" mb="xs">
          <IconAlertTriangle size={16} color="var(--mantine-color-red-6)" />
          <Text size="sm" fw={600} c="red">
            Aşırı Düşük Teklif Açıklaması
          </Text>
        </Group>
        <Text size="xs" c="dimmed">
          Teklifiniz sınır değerin altındaysa, maliyet bileşenlerinizi detaylı şekilde açıklamanız gerekir.
        </Text>
      </Paper>
      <SimpleGrid cols={2} spacing="md">
        <Stack gap="xs">
          <Text size="sm" fw={600}>
            Maliyet Bileşenleri
          </Text>
          {Object.entries({
            hammadde: 'Hammadde / Gıda',
            iscilik: 'İşçilik',
            enerji: 'Enerji',
            nakliye: 'Nakliye',
            ambalaj: 'Ambalaj',
            diger: 'Diğer Giderler',
          }).map(([key, label]) => (
            <NumberInput
              key={key}
              label={label}
              value={maliyetler[key as keyof typeof maliyetler] || ''}
              onChange={(val) => setMaliyetler((prev) => ({ ...prev, [key]: Number(val) || 0 }))}
              min={0}
              thousandSeparator="."
              decimalSeparator=","
              suffix=" ₺"
              size="xs"
            />
          ))}
        </Stack>
        <Paper p="lg" bg="dark.7" radius="md">
          <Stack gap="md">
            <div>
              <Text size="xs" c="dimmed" mb={4}>
                Toplam Maliyet
              </Text>
              <Text size="xl" fw={700}>
                {toplamMaliyet.toLocaleString('tr-TR')} ₺
              </Text>
            </div>
            <div>
              <Text size="xs" c="dimmed" mb={4}>
                Bizim Teklif
              </Text>
              <Text size="lg" fw={600} c="blue">
                {bizimTeklif.toLocaleString('tr-TR')} ₺
              </Text>
            </div>
            <Divider />
            <div>
              <Text size="xs" c="dimmed" mb={4}>
                Kar Marjı
              </Text>
              <Text size="lg" fw={700} c={karMarji < 0 ? 'red' : karMarji < 5 ? 'yellow' : 'green'}>
                %{karMarji.toFixed(1)}
              </Text>
              {karMarji < 0 && (
                <Badge color="red" size="sm">
                  ZARAR
                </Badge>
              )}
            </div>
            <Progress
              value={Math.min(100, (toplamMaliyet / bizimTeklif) * 100) || 0}
              color={toplamMaliyet > bizimTeklif ? 'red' : toplamMaliyet > bizimTeklif * 0.95 ? 'yellow' : 'green'}
              size="lg"
              radius="xl"
            />
            <Text size="xs" c="dimmed" ta="center">
              {toplamMaliyet > bizimTeklif
                ? 'Maliyet tekliften yüksek!'
                : toplamMaliyet > bizimTeklif * 0.95
                  ? 'Kar marjı çok düşük'
                  : 'Açıklama kabul edilebilir'}
            </Text>
          </Stack>
        </Paper>
      </SimpleGrid>
    </Stack>
  );

  // ─── Teminat ───
  const renderTeminat = () => (
    <Stack gap="md">
      <Paper
        p="md"
        bg="rgba(81, 207, 102, 0.1)"
        radius="md"
        style={{ border: '1px solid var(--mantine-color-green-6)' }}
      >
        <Group gap="xs" mb="xs">
          <IconShieldCheck size={16} color="var(--mantine-color-green-6)" />
          <Text size="sm" fw={600} c="green">
            Teminat Hesaplamaları
          </Text>
        </Group>
        <Text size="xs" c="dimmed">
          4734 sayılı Kamu İhale Kanunu'na göre geçici teminat %3, kesin teminat %6 oranında alınır.
        </Text>
      </Paper>
      <SimpleGrid cols={3} spacing="md">
        <Card padding="lg" radius="md" withBorder>
          <Stack align="center" gap="md">
            <ThemeIcon size={50} radius="xl" variant="light" color="blue">
              <IconPercentage size={24} />
            </ThemeIcon>
            <Text size="xs" c="dimmed">
              Geçici Teminat (%3)
            </Text>
            <Text size="xl" fw={700} c="blue">
              {geciciTeminat > 0 ? `${geciciTeminat.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺` : '—'}
            </Text>
          </Stack>
        </Card>
        <Card padding="lg" radius="md" withBorder>
          <Stack align="center" gap="md">
            <ThemeIcon size={50} radius="xl" variant="light" color="green">
              <IconShieldCheck size={24} />
            </ThemeIcon>
            <Text size="xs" c="dimmed">
              Kesin Teminat (%6)
            </Text>
            <Text size="xl" fw={700} c="green">
              {kesinTeminat > 0 ? `${kesinTeminat.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺` : '—'}
            </Text>
          </Stack>
        </Card>
        <Card padding="lg" radius="md" withBorder>
          <Stack align="center" gap="md">
            <ThemeIcon size={50} radius="xl" variant="light" color="orange">
              <IconCurrencyLira size={24} />
            </ThemeIcon>
            <Text size="xs" c="dimmed">
              Toplam Teminat
            </Text>
            <Text size="xl" fw={700} c="orange">
              {geciciTeminat + kesinTeminat > 0
                ? `${(geciciTeminat + kesinTeminat).toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺`
                : '—'}
            </Text>
          </Stack>
        </Card>
      </SimpleGrid>
      {bizimTeklif > 0 && (
        <Paper p="md" bg="dark.7" radius="md">
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Kalem</Table.Th>
                <Table.Th ta="right">Oran</Table.Th>
                <Table.Th ta="right">Tutar</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              <Table.Tr>
                <Table.Td>Geçici Teminat</Table.Td>
                <Table.Td ta="right">%3</Table.Td>
                <Table.Td ta="right" fw={600}>
                  {geciciTeminat.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺
                </Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>Kesin Teminat</Table.Td>
                <Table.Td ta="right">%6</Table.Td>
                <Table.Td ta="right" fw={600}>
                  {kesinTeminat.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺
                </Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>Damga Vergisi</Table.Td>
                <Table.Td ta="right">‰9.48</Table.Td>
                <Table.Td ta="right" fw={600}>
                  {(bizimTeklif * 0.00948).toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺
                </Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>KİK Payı</Table.Td>
                <Table.Td ta="right">‰0.5</Table.Td>
                <Table.Td ta="right" fw={600}>
                  {(bizimTeklif * 0.0005).toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺
                </Table.Td>
              </Table.Tr>
              <Table.Tr style={{ background: 'var(--mantine-color-dark-6)' }}>
                <Table.Td fw={700}>TOPLAM MALİYET</Table.Td>
                <Table.Td ta="right">—</Table.Td>
                <Table.Td ta="right" fw={700} c="orange">
                  {(geciciTeminat + kesinTeminat + bizimTeklif * 0.00948 + bizimTeklif * 0.0005).toLocaleString(
                    'tr-TR',
                    { maximumFractionDigits: 0 }
                  )}{' '}
                  ₺
                </Table.Td>
              </Table.Tr>
            </Table.Tbody>
          </Table>
        </Paper>
      )}
    </Stack>
  );

  return (
    <Stack gap="lg">
      {/* Araç Seçici */}
      <SegmentedControl
        fullWidth
        value={activeTool}
        onChange={(v) => setActiveTool(v as ActiveTool)}
        data={[
          { label: 'Temel Hesaplama', value: 'temel' },
          { label: 'KİK Sınır Değer', value: 'sinir' },
          { label: 'Aşırı Düşük', value: 'asiri' },
          { label: 'Teminat', value: 'teminat' },
        ]}
        styles={{ root: { background: 'var(--mantine-color-dark-7)' } }}
      />

      {/* İçerik */}
      {activeTool === 'temel' && renderTemelHesaplama()}
      {activeTool === 'sinir' && renderKikSinirDeger()}
      {activeTool === 'asiri' && renderAsiriDusuk()}
      {activeTool === 'teminat' && renderTeminat()}

      {/* Detaylı Analiz */}
      {yaklasikMaliyet > 0 && bizimTeklif > 0 && (
        <>
          <Divider label="Detaylı Analiz" labelPosition="center" />
          <SimpleGrid cols={4} spacing="sm">
            <Paper p="sm" bg="dark.7" radius="md" ta="center">
              <Text size="xs" c="dimmed">
                Öğün Başı Maliyet
              </Text>
              <Text size="md" fw={700} c="blue">
                {ogunBasiMaliyet > 0 ? `${ogunBasiMaliyet.toFixed(2)} ₺` : '—'}
              </Text>
            </Paper>
            <Paper p="sm" bg="dark.7" radius="md" ta="center">
              <Text size="xs" c="dimmed">
                Öğün Başı Teklif
              </Text>
              <Text size="md" fw={700} c="green">
                {ogunBasiTeklif > 0 ? `${ogunBasiTeklif.toFixed(2)} ₺` : '—'}
              </Text>
            </Paper>
            <Paper p="sm" bg="dark.7" radius="md" ta="center">
              <Text size="xs" c="dimmed">
                Aylık Maliyet
              </Text>
              <Text size="md" fw={700}>
                {aylikMaliyet > 0 ? `${(aylikMaliyet / 1000000).toFixed(1)}M ₺` : '—'}
              </Text>
            </Paper>
            <Paper p="sm" bg="dark.7" radius="md" ta="center">
              <Text size="xs" c="dimmed">
                Geçici Teminat
              </Text>
              <Text size="md" fw={700} c="orange">
                {geciciTeminat > 0 ? `${(geciciTeminat / 1000000).toFixed(1)}M ₺` : '—'}
              </Text>
            </Paper>
          </SimpleGrid>
        </>
      )}
    </Stack>
  );
}
