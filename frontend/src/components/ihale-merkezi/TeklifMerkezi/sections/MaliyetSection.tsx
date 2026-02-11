'use client';

import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Checkbox,
  Divider,
  Group,
  NavLink,
  NumberInput,
  Paper,
  ScrollArea,
  SegmentedControl,
  Select,
  SimpleGrid,
  Slider,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import {
  formatPara,
  formatParaKisa,
  hesaplaEkipmanOzet,
  hesaplaGenelGiderOzet,
  hesaplaNakliyeOzet,
  hesaplaPersonelOzet,
  hesaplaRiskOzet,
  hesaplaSarfOzet,
  hesaplaYasalGiderOzet,
} from '../../../teklif/hesaplamalar';
import type { UseTeklifMerkeziReturn } from '../hooks/useTeklifMerkezi';
import type {
  AracKalem,
  EkipmanKalem,
  GenelGiderKalem,
  MaliyetKalemKey,
  PozisyonKalem,
  SarfKalem,
  YasalGiderKalem,
} from '../types';
import { ARAC_TIPLERI, EKIPMAN_SABLONLARI, MALIYET_KALEMLERI, POZISYON_SABLONLARI } from '../types';

interface MaliyetSectionProps {
  ctx: UseTeklifMerkeziReturn;
}

export function MaliyetSection({ ctx }: MaliyetSectionProps) {
  const {
    teklifData,
    hesaplanmisTeklifData,
    updateMaliyetDetay,
    handleKarOraniChange,
    selectedKalem,
    setSelectedKalem,
  } = ctx;

  const maliyetToplam = hesaplanmisTeklifData.maliyet_toplam;

  // Kategori gruplaması
  const groups = [
    { label: 'Direkt', keys: ['malzeme', 'personel'] },
    { label: 'Operasyonel', keys: ['nakliye', 'sarf_malzeme', 'ekipman_bakim'] },
    { label: 'Genel', keys: ['genel_gider', 'yasal_giderler', 'risk_payi'] },
  ];

  return (
    <Box style={{ display: 'flex', gap: 16, height: '100%', minHeight: 0 }}>
      {/* Sol: Kategori Listesi */}
      <Paper
        withBorder
        radius="md"
        style={{ width: 240, minWidth: 240, display: 'flex', flexDirection: 'column' }}
      >
        <Box p="sm" pb={4}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
            Maliyet Kalemleri
          </Text>
        </Box>
        <ScrollArea style={{ flex: 1 }}>
          {groups.map((group) => (
            <Box key={group.label}>
              <Text size="xs" c="dimmed" px="sm" py={4} fw={500}>
                {group.label}
              </Text>
              {MALIYET_KALEMLERI.filter((k) => group.keys.includes(k.key)).map((kalem) => {
                const tutar =
                  hesaplanmisTeklifData.maliyet_detay[kalem.key as MaliyetKalemKey].tutar;
                return (
                  <NavLink
                    key={kalem.key}
                    label={kalem.label}
                    active={selectedKalem === kalem.key}
                    onClick={() => setSelectedKalem(kalem.key as MaliyetKalemKey)}
                    rightSection={
                      tutar > 0 ? (
                        <Badge size="xs" variant="light" color="green">
                          {formatParaKisa(tutar)}
                        </Badge>
                      ) : null
                    }
                    styles={{
                      root: { borderRadius: 4, fontSize: 13 },
                      label: { fontWeight: selectedKalem === kalem.key ? 600 : 400 },
                    }}
                  />
                );
              })}
            </Box>
          ))}
        </ScrollArea>

        {/* Kâr Oranı + Toplam */}
        <Box p="sm" style={{ borderTop: '1px solid var(--mantine-color-dark-4)' }}>
          <Text size="xs" c="dimmed" mb={4}>
            Kâr Oranı
          </Text>
          <Group gap="xs" mb="xs">
            <Slider
              value={teklifData.kar_orani}
              onChange={(v) => handleKarOraniChange(v)}
              min={0}
              max={50}
              step={0.5}
              style={{ flex: 1 }}
              marks={[
                { value: 10, label: '10%' },
                { value: 25, label: '25%' },
              ]}
            />
            <NumberInput
              value={teklifData.kar_orani}
              onChange={(v) => handleKarOraniChange(v || 0)}
              size="xs"
              w={60}
              suffix="%"
              hideControls
            />
          </Group>
          <Divider my={4} />
          <Group justify="space-between">
            <Text size="xs" c="dimmed">
              Toplam
            </Text>
            <Text size="sm" fw={700} c="green">
              {formatPara(maliyetToplam)}
            </Text>
          </Group>
          <Group justify="space-between">
            <Text size="xs" c="dimmed">
              Teklif
            </Text>
            <Text size="sm" fw={700} c="blue">
              {formatPara(hesaplanmisTeklifData.teklif_fiyati)}
            </Text>
          </Group>
        </Box>
      </Paper>

      {/* Sağ: Detay Formu */}
      <Box style={{ flex: 1, minWidth: 0 }}>
        <ScrollArea h="100%">
          <Box p="md">
            {selectedKalem === 'malzeme' && <MalzemeForm ctx={ctx} />}
            {selectedKalem === 'personel' && <PersonelForm ctx={ctx} />}
            {selectedKalem === 'nakliye' && <NakliyeForm ctx={ctx} />}
            {selectedKalem === 'sarf_malzeme' && <SarfMalzemeForm ctx={ctx} />}
            {selectedKalem === 'ekipman_bakim' && <EkipmanForm ctx={ctx} />}
            {selectedKalem === 'genel_gider' && <GenelGiderForm ctx={ctx} />}
            {selectedKalem === 'yasal_giderler' && <YasalGiderlerForm ctx={ctx} />}
            {selectedKalem === 'risk_payi' && <RiskPayiForm ctx={ctx} />}
          </Box>
        </ScrollArea>
      </Box>
    </Box>
  );
}

// ─── Alt Form Bileşenleri ─────────────────────────────────────

function MalzemeForm({ ctx }: { ctx: UseTeklifMerkeziReturn }) {
  const { teklifData, hesaplanmisTeklifData, updateMaliyetDetay } = ctx;
  const detay = teklifData.maliyet_detay.malzeme.detay;
  const tutar = hesaplanmisTeklifData.maliyet_detay.malzeme.tutar;

  return (
    <Stack>
      <Group justify="space-between">
        <Text fw={600} size="lg">
          Ogün Maliyeti
        </Text>
        <Badge size="xl" color="green" variant="light">
          {formatPara(tutar)}
        </Badge>
      </Group>
      <Text size="xs" c="dimmed" fs="italic">
        Sadece yemek hammadde maliyetini girin. Personel, nakliye ve diger giderler ayri hesaplanir.
      </Text>
      <Table withTableBorder withColumnBorders>
        <Table.Thead>
          <Table.Tr>
            <Table.Th w={40}></Table.Th>
            <Table.Th>Ogün</Table.Th>
            <Table.Th w={90}>Kisi</Table.Th>
            <Table.Th w={70}>Gün</Table.Th>
            <Table.Th w={110}>Toplam Ogün</Table.Th>
            <Table.Th w={90}>Kisi Basi</Table.Th>
            <Table.Th w={130}>Toplam</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {detay.ogunler.map((ogun, idx) => {
            const toplamOgun = ogun.aktif ? ogun.kisiSayisi * ogun.gunSayisi : 0;
            const ogunToplam = ogun.aktif
              ? ogun.kisiSayisi * ogun.gunSayisi * ogun.kisiBasiMaliyet
              : 0;
            return (
              <Table.Tr key={ogun.ad} style={{ opacity: ogun.aktif ? 1 : 0.5 }}>
                <Table.Td>
                  <Checkbox
                    checked={ogun.aktif}
                    onChange={(e) => {
                      const y = [...detay.ogunler];
                      y[idx] = { ...y[idx], aktif: e.currentTarget.checked };
                      updateMaliyetDetay('malzeme', 'ogunler', y);
                    }}
                  />
                </Table.Td>
                <Table.Td>
                  <Text fw={500}>{ogun.ad}</Text>
                </Table.Td>
                <Table.Td>
                  <NumberInput
                    size="xs"
                    variant="unstyled"
                    value={ogun.kisiSayisi}
                    onChange={(v) => {
                      const y = [...detay.ogunler];
                      y[idx] = { ...y[idx], kisiSayisi: Number(v) || 0 };
                      updateMaliyetDetay('malzeme', 'ogunler', y);
                    }}
                    thousandSeparator="."
                    decimalSeparator=","
                    disabled={!ogun.aktif}
                  />
                </Table.Td>
                <Table.Td>
                  <NumberInput
                    size="xs"
                    variant="unstyled"
                    value={ogun.gunSayisi}
                    onChange={(v) => {
                      const y = [...detay.ogunler];
                      y[idx] = { ...y[idx], gunSayisi: Number(v) || 0 };
                      updateMaliyetDetay('malzeme', 'ogunler', y);
                    }}
                    disabled={!ogun.aktif}
                  />
                </Table.Td>
                <Table.Td>
                  <Text fw={600} c={toplamOgun > 0 ? 'blue' : 'dimmed'} size="sm">
                    {toplamOgun.toLocaleString('tr-TR')}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <NumberInput
                    size="xs"
                    variant="unstyled"
                    value={ogun.kisiBasiMaliyet}
                    onChange={(v) => {
                      const y = [...detay.ogunler];
                      y[idx] = { ...y[idx], kisiBasiMaliyet: Number(v) || 0 };
                      updateMaliyetDetay('malzeme', 'ogunler', y);
                    }}
                    decimalScale={2}
                    disabled={!ogun.aktif}
                  />
                </Table.Td>
                <Table.Td>
                  <Text fw={600} c={ogunToplam > 0 ? 'green' : 'dimmed'} size="sm">
                    {formatPara(ogunToplam)}
                  </Text>
                </Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
    </Stack>
  );
}

function PersonelForm({ ctx }: { ctx: UseTeklifMerkeziReturn }) {
  const { teklifData, hesaplanmisTeklifData, updateMaliyetDetay } = ctx;
  const detay = teklifData.maliyet_detay.personel.detay;
  const tutar = hesaplanmisTeklifData.maliyet_detay.personel.tutar;
  const ozet = hesaplaPersonelOzet(detay);

  return (
    <Stack>
      <Group justify="space-between">
        <Text fw={600} size="lg">
          Personel Maliyeti
        </Text>
        <Badge size="xl" color="green" variant="light">
          {formatPara(tutar)}
        </Badge>
      </Group>
      <Text size="xs" c="dimmed" fs="italic">
        Brüt maas üzerinden hesaplanir. SGK isveren payi otomatik eklenir.
      </Text>
      <Group>
        <NumberInput
          label="Süre (Ay)"
          value={detay.aySayisi}
          onChange={(v) => updateMaliyetDetay('personel', 'aySayisi', Number(v) || 12)}
          min={1}
          max={60}
          w={100}
        />
        <NumberInput
          label="SGK Orani (%)"
          value={detay.sgkOrani}
          onChange={(v) => updateMaliyetDetay('personel', 'sgkOrani', Number(v) || 22.5)}
          decimalScale={1}
          w={100}
        />
      </Group>
      {detay.pozisyonlar.map((poz, idx) => (
        <Paper key={`poz-${poz.pozisyon}-${idx}`} withBorder p="xs">
          <Group align="end">
            <Select
              label="Pozisyon"
              value={poz.pozisyon}
              onChange={(v) => {
                const y = [...detay.pozisyonlar];
                const s = POZISYON_SABLONLARI.find((s) => s.pozisyon === v);
                y[idx] = {
                  ...y[idx],
                  pozisyon: v || '',
                  brutMaas: s?.varsayilanMaas || y[idx].brutMaas,
                };
                updateMaliyetDetay('personel', 'pozisyonlar', y);
              }}
              data={POZISYON_SABLONLARI.map((s) => s.pozisyon)}
              searchable
              allowDeselect={false}
              style={{ flex: 2 }}
            />
            <NumberInput
              label="Adet"
              value={poz.adet}
              onChange={(v) => {
                const y = [...detay.pozisyonlar];
                y[idx] = { ...y[idx], adet: Number(v) || 0 };
                updateMaliyetDetay('personel', 'pozisyonlar', y);
              }}
              min={0}
              style={{ flex: 1 }}
            />
            <NumberInput
              label="Brüt Maas"
              value={poz.brutMaas}
              onChange={(v) => {
                const y = [...detay.pozisyonlar];
                y[idx] = { ...y[idx], brutMaas: Number(v) || 0 };
                updateMaliyetDetay('personel', 'pozisyonlar', y);
              }}
              thousandSeparator="."
              decimalSeparator=","
              style={{ flex: 1 }}
            />
            <ActionIcon
              color="red"
              variant="light"
              onClick={() => {
                updateMaliyetDetay(
                  'personel',
                  'pozisyonlar',
                  detay.pozisyonlar.filter((_, i) => i !== idx)
                );
              }}
            >
              <IconTrash size={16} />
            </ActionIcon>
          </Group>
        </Paper>
      ))}
      <Button
        variant="light"
        leftSection={<IconPlus size={16} />}
        onClick={() => {
          const y: PozisyonKalem = { pozisyon: '', adet: 1, brutMaas: 30000 };
          updateMaliyetDetay('personel', 'pozisyonlar', [...detay.pozisyonlar, y]);
        }}
      >
        Pozisyon Ekle
      </Button>
      {detay.pozisyonlar.length > 0 && (
        <Paper withBorder p="sm" bg="dark.7">
          <SimpleGrid cols={4}>
            <div>
              <Text size="xs" c="dimmed">
                Toplam Kisi
              </Text>
              <Text fw={600}>{ozet.toplamKisi}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">
                Aylik Brüt
              </Text>
              <Text fw={600}>{formatPara(ozet.aylikBrut)}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">
                Aylik SGK
              </Text>
              <Text fw={600}>{formatPara(ozet.aylikSgk)}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">
                {detay.aySayisi} Aylik Toplam
              </Text>
              <Text fw={700} c="green">
                {formatPara(ozet.yillikToplam)}
              </Text>
            </div>
          </SimpleGrid>
        </Paper>
      )}
    </Stack>
  );
}

function NakliyeForm({ ctx }: { ctx: UseTeklifMerkeziReturn }) {
  const { teklifData, hesaplanmisTeklifData, updateMaliyetDetay } = ctx;
  const detay = teklifData.maliyet_detay.nakliye.detay;
  const tutar = hesaplanmisTeklifData.maliyet_detay.nakliye.tutar;
  const ozet = hesaplaNakliyeOzet(detay);

  return (
    <Stack>
      <Group justify="space-between">
        <Text fw={600} size="lg">
          Nakliye Maliyeti
        </Text>
        <Badge size="xl" color="green" variant="light">
          {formatPara(tutar)}
        </Badge>
      </Group>
      <Text size="xs" c="dimmed" fs="italic">
        Araç kirasi ve yakit maliyetini içerir.
      </Text>
      <Group>
        <NumberInput
          label="Yakit Fiyati (TL/lt)"
          value={detay.yakitFiyati}
          onChange={(v) => updateMaliyetDetay('nakliye', 'yakitFiyati', Number(v) || 42)}
          decimalScale={2}
          w={120}
        />
        <NumberInput
          label="Süre (Ay)"
          value={detay.aySayisi}
          onChange={(v) => updateMaliyetDetay('nakliye', 'aySayisi', Number(v) || 12)}
          min={1}
          w={100}
        />
      </Group>
      {detay.araclar.map((arac, idx) => (
        <Paper key={`arac-${arac.tip}-${idx}`} withBorder p="xs">
          <Group align="end" wrap="nowrap">
            <Select
              label="Araç Tipi"
              value={arac.tip}
              onChange={(v) => {
                const y = [...detay.araclar];
                const s = ARAC_TIPLERI.find((a) => a.tip === v);
                y[idx] = {
                  ...y[idx],
                  tip: v || '',
                  aylikKira: s?.varsayilanKira || y[idx].aylikKira,
                  yakitTuketimi: s?.varsayilanTuketim || y[idx].yakitTuketimi,
                };
                updateMaliyetDetay('nakliye', 'araclar', y);
              }}
              data={ARAC_TIPLERI.map((a) => a.tip)}
              allowDeselect={false}
              style={{ flex: 2 }}
            />
            <NumberInput
              label="Adet"
              value={arac.adet}
              onChange={(v) => {
                const y = [...detay.araclar];
                y[idx] = { ...y[idx], adet: Number(v) || 0 };
                updateMaliyetDetay('nakliye', 'araclar', y);
              }}
              min={0}
              w={60}
            />
            <NumberInput
              label="Aylik Kira"
              value={arac.aylikKira}
              onChange={(v) => {
                const y = [...detay.araclar];
                y[idx] = { ...y[idx], aylikKira: Number(v) || 0 };
                updateMaliyetDetay('nakliye', 'araclar', y);
              }}
              thousandSeparator="."
              decimalSeparator=","
              w={100}
            />
            <NumberInput
              label="Aylik KM"
              value={arac.aylikKm}
              onChange={(v) => {
                const y = [...detay.araclar];
                y[idx] = { ...y[idx], aylikKm: Number(v) || 0 };
                updateMaliyetDetay('nakliye', 'araclar', y);
              }}
              thousandSeparator="."
              decimalSeparator=","
              w={80}
            />
            <NumberInput
              label="lt/100km"
              value={arac.yakitTuketimi}
              onChange={(v) => {
                const y = [...detay.araclar];
                y[idx] = { ...y[idx], yakitTuketimi: Number(v) || 0 };
                updateMaliyetDetay('nakliye', 'araclar', y);
              }}
              decimalScale={1}
              w={70}
            />
            <ActionIcon
              color="red"
              variant="light"
              onClick={() =>
                updateMaliyetDetay(
                  'nakliye',
                  'araclar',
                  detay.araclar.filter((_, i) => i !== idx)
                )
              }
            >
              <IconTrash size={16} />
            </ActionIcon>
          </Group>
        </Paper>
      ))}
      <Button
        variant="light"
        leftSection={<IconPlus size={16} />}
        onClick={() => {
          const y: AracKalem = {
            tip: 'Sogutuculu Kamyonet',
            adet: 1,
            aylikKira: 45000,
            aylikKm: 3000,
            yakitTuketimi: 12,
          };
          updateMaliyetDetay('nakliye', 'araclar', [...detay.araclar, y]);
        }}
      >
        Araç Ekle
      </Button>
      {detay.araclar.length > 0 && (
        <Paper withBorder p="sm" bg="dark.7">
          <SimpleGrid cols={4}>
            <div>
              <Text size="xs" c="dimmed">
                Toplam Araç
              </Text>
              <Text fw={600}>{ozet.toplamArac}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">
                Aylik Kira
              </Text>
              <Text fw={600}>{formatPara(ozet.aylikKiraToplam)}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">
                Aylik Yakit
              </Text>
              <Text fw={600}>{formatPara(ozet.aylikYakitToplam)}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">
                {detay.aySayisi} Aylik Toplam
              </Text>
              <Text fw={700} c="green">
                {formatPara(ozet.yillikToplam)}
              </Text>
            </div>
          </SimpleGrid>
        </Paper>
      )}
    </Stack>
  );
}

function SarfMalzemeForm({ ctx }: { ctx: UseTeklifMerkeziReturn }) {
  const { teklifData, hesaplanmisTeklifData, updateMaliyetDetay } = ctx;
  const detay = teklifData.maliyet_detay.sarf_malzeme.detay;
  const tutar = hesaplanmisTeklifData.maliyet_detay.sarf_malzeme.tutar;
  const ozet = hesaplaSarfOzet(detay);

  return (
    <Stack>
      <Group justify="space-between">
        <Text fw={600} size="lg">
          Sarf Malzeme Maliyeti
        </Text>
        <Badge size="xl" color="green" variant="light">
          {formatPara(tutar)}
        </Badge>
      </Group>
      <Text size="xs" c="dimmed" fs="italic">
        Peçete, ambalaj, temizlik malzemesi vb. Kisi basi günlük maliyet olarak girin.
      </Text>
      <Group>
        <NumberInput
          label="Günlük Kisi"
          value={detay.gunlukKisi}
          onChange={(v) => updateMaliyetDetay('sarf_malzeme', 'gunlukKisi', Number(v) || 0)}
          thousandSeparator="."
          decimalSeparator=","
          style={{ flex: 1 }}
        />
        <NumberInput
          label="Gün Sayisi"
          value={detay.gunSayisi}
          onChange={(v) => updateMaliyetDetay('sarf_malzeme', 'gunSayisi', Number(v) || 0)}
          style={{ flex: 1 }}
        />
      </Group>
      <Table withTableBorder withColumnBorders>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Kalem</Table.Th>
            <Table.Th w={120}>TL/Kisi/Gün</Table.Th>
            <Table.Th w={120}>Toplam</Table.Th>
            <Table.Th w={40}></Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {detay.kalemler.map((kalem, idx) => (
            <Table.Tr key={`sarf-${kalem.ad}-${idx}`}>
              <Table.Td>
                <TextInput
                  variant="unstyled"
                  value={kalem.ad}
                  onChange={(e) => {
                    const y = [...detay.kalemler];
                    y[idx] = { ...y[idx], ad: e.target.value };
                    updateMaliyetDetay('sarf_malzeme', 'kalemler', y);
                  }}
                />
              </Table.Td>
              <Table.Td>
                <NumberInput
                  variant="unstyled"
                  value={kalem.miktar}
                  onChange={(v) => {
                    const y = [...detay.kalemler];
                    y[idx] = { ...y[idx], miktar: Number(v) || 0 };
                    updateMaliyetDetay('sarf_malzeme', 'kalemler', y);
                  }}
                  decimalScale={2}
                />
              </Table.Td>
              <Table.Td>
                <Text fw={500}>
                  {formatParaKisa(detay.gunlukKisi * detay.gunSayisi * kalem.miktar)}
                </Text>
              </Table.Td>
              <Table.Td>
                <ActionIcon
                  color="red"
                  variant="subtle"
                  size="sm"
                  onClick={() =>
                    updateMaliyetDetay(
                      'sarf_malzeme',
                      'kalemler',
                      detay.kalemler.filter((_, i) => i !== idx)
                    )
                  }
                >
                  <IconTrash size={14} />
                </ActionIcon>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      <Button
        variant="light"
        size="xs"
        leftSection={<IconPlus size={14} />}
        onClick={() => {
          const y: SarfKalem = { ad: '', birim: 'TL/kisi/gün', miktar: 0 };
          updateMaliyetDetay('sarf_malzeme', 'kalemler', [...detay.kalemler, y]);
        }}
      >
        Kalem Ekle
      </Button>
      <Paper withBorder p="sm" bg="dark.7">
        <SimpleGrid cols={3}>
          <div>
            <Text size="xs" c="dimmed">
              Kisi Basi/Gün
            </Text>
            <Text fw={600}>{ozet.kisiBasiGunluk.toFixed(2)} TL</Text>
          </div>
          <div>
            <Text size="xs" c="dimmed">
              Günlük Toplam
            </Text>
            <Text fw={600}>{formatPara(ozet.gunlukToplam)}</Text>
          </div>
          <div>
            <Text size="xs" c="dimmed">
              Yillik Toplam
            </Text>
            <Text fw={700} c="green">
              {formatPara(ozet.yillikToplam)}
            </Text>
          </div>
        </SimpleGrid>
      </Paper>
    </Stack>
  );
}

function EkipmanForm({ ctx }: { ctx: UseTeklifMerkeziReturn }) {
  const { teklifData, hesaplanmisTeklifData, updateMaliyetDetay } = ctx;
  const detay = teklifData.maliyet_detay.ekipman_bakim.detay;
  const tutar = hesaplanmisTeklifData.maliyet_detay.ekipman_bakim.tutar;
  const ozet = hesaplaEkipmanOzet(detay);

  return (
    <Stack>
      <Group justify="space-between">
        <Text fw={600} size="lg">
          Ekipman & Bakim
        </Text>
        <Badge size="xl" color="green" variant="light">
          {formatPara(tutar)}
        </Badge>
      </Group>
      <Text size="xs" c="dimmed" fs="italic">
        Mutfak ekipmanlari için kira veya satin alma seçebilirsiniz.
      </Text>
      <NumberInput
        label="Süre (Ay)"
        value={detay.aySayisi}
        onChange={(v) => updateMaliyetDetay('ekipman_bakim', 'aySayisi', Number(v) || 12)}
        min={1}
        w={100}
      />
      {detay.ekipmanlar.map((ekp, idx) => (
        <Paper key={`ekp-${ekp.ad}-${idx}`} withBorder p="xs">
          <Group align="end">
            <Select
              label="Ekipman"
              value={ekp.ad}
              onChange={(v) => {
                const y = [...detay.ekipmanlar];
                const s = EKIPMAN_SABLONLARI.find((e) => e.ad === v);
                const f = ekp.tip === 'kira' ? s?.varsayilanKira : s?.varsayilanSatin;
                y[idx] = { ...y[idx], ad: v || '', birimFiyat: f || y[idx].birimFiyat };
                updateMaliyetDetay('ekipman_bakim', 'ekipmanlar', y);
              }}
              data={EKIPMAN_SABLONLARI.map((e) => e.ad)}
              searchable
              allowDeselect={false}
              style={{ flex: 2 }}
            />
            <SegmentedControl
              value={ekp.tip}
              onChange={(v) => {
                const y = [...detay.ekipmanlar];
                const s = EKIPMAN_SABLONLARI.find((e) => e.ad === ekp.ad);
                const f = v === 'kira' ? s?.varsayilanKira : s?.varsayilanSatin;
                y[idx] = { ...y[idx], tip: v as 'kira' | 'satin_alma', birimFiyat: f || 0 };
                updateMaliyetDetay('ekipman_bakim', 'ekipmanlar', y);
              }}
              data={[
                { label: 'Kira', value: 'kira' },
                { label: 'Satin Al', value: 'satin_alma' },
              ]}
              size="xs"
            />
            <NumberInput
              label="Adet"
              value={ekp.adet}
              onChange={(v) => {
                const y = [...detay.ekipmanlar];
                y[idx] = { ...y[idx], adet: Number(v) || 0 };
                updateMaliyetDetay('ekipman_bakim', 'ekipmanlar', y);
              }}
              min={0}
              w={60}
            />
            <NumberInput
              label={ekp.tip === 'kira' ? 'Aylik' : 'Fiyat'}
              value={ekp.birimFiyat}
              onChange={(v) => {
                const y = [...detay.ekipmanlar];
                y[idx] = { ...y[idx], birimFiyat: Number(v) || 0 };
                updateMaliyetDetay('ekipman_bakim', 'ekipmanlar', y);
              }}
              thousandSeparator="."
              decimalSeparator=","
              w={100}
            />
            <ActionIcon
              color="red"
              variant="light"
              onClick={() =>
                updateMaliyetDetay(
                  'ekipman_bakim',
                  'ekipmanlar',
                  detay.ekipmanlar.filter((_, i) => i !== idx)
                )
              }
            >
              <IconTrash size={16} />
            </ActionIcon>
          </Group>
        </Paper>
      ))}
      <Button
        variant="light"
        leftSection={<IconPlus size={16} />}
        onClick={() => {
          const y: EkipmanKalem = { ad: '', tip: 'kira', adet: 1, birimFiyat: 0 };
          updateMaliyetDetay('ekipman_bakim', 'ekipmanlar', [...detay.ekipmanlar, y]);
        }}
      >
        Ekipman Ekle
      </Button>
      <Divider />
      <NumberInput
        label="Aylik Bakim Tutari"
        value={detay.aylikBakimTutar}
        onChange={(v) => updateMaliyetDetay('ekipman_bakim', 'aylikBakimTutar', Number(v) || 0)}
        thousandSeparator="."
        decimalSeparator=","
      />
      {(detay.ekipmanlar.length > 0 || detay.aylikBakimTutar > 0) && (
        <Paper withBorder p="sm" bg="dark.7">
          <SimpleGrid cols={4}>
            <div>
              <Text size="xs" c="dimmed">
                Aylik Kira
              </Text>
              <Text fw={600}>{formatPara(ozet.aylikKiraToplam)}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">
                Satin Alma
              </Text>
              <Text fw={600}>{formatPara(ozet.satinAlmaToplam)}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">
                {detay.aySayisi} Ay Bakim
              </Text>
              <Text fw={600}>{formatPara(ozet.yillikBakim)}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">
                Toplam
              </Text>
              <Text fw={700} c="green">
                {formatPara(ozet.toplam)}
              </Text>
            </div>
          </SimpleGrid>
        </Paper>
      )}
    </Stack>
  );
}

function GenelGiderForm({ ctx }: { ctx: UseTeklifMerkeziReturn }) {
  const { teklifData, hesaplanmisTeklifData, updateMaliyetDetay } = ctx;
  const detay = teklifData.maliyet_detay.genel_gider.detay;
  const tutar = hesaplanmisTeklifData.maliyet_detay.genel_gider.tutar;
  const ozet = hesaplaGenelGiderOzet(detay);

  return (
    <Stack>
      <Group justify="space-between">
        <Text fw={600} size="lg">
          Genel Giderler
        </Text>
        <Badge size="xl" color="green" variant="light">
          {formatPara(tutar)}
        </Badge>
      </Group>
      <Text size="xs" c="dimmed" fs="italic">
        Kira, elektrik, su, dogalgaz gibi sabit giderler. Aylik tutarlari girin.
      </Text>
      <NumberInput
        label="Süre (Ay)"
        value={detay.aySayisi}
        onChange={(v) => updateMaliyetDetay('genel_gider', 'aySayisi', Number(v) || 12)}
        min={1}
        w={100}
      />
      {detay.kalemler.map((kalem, idx) => (
        <Group key={`gider-${kalem.ad}-${idx}`}>
          <TextInput
            value={kalem.ad}
            onChange={(e) => {
              const y = [...detay.kalemler];
              y[idx] = { ...y[idx], ad: e.target.value };
              updateMaliyetDetay('genel_gider', 'kalemler', y);
            }}
            style={{ flex: 2 }}
          />
          <NumberInput
            value={kalem.aylikTutar}
            onChange={(v) => {
              const y = [...detay.kalemler];
              y[idx] = { ...y[idx], aylikTutar: Number(v) || 0 };
              updateMaliyetDetay('genel_gider', 'kalemler', y);
            }}
            thousandSeparator="."
            decimalSeparator=","
            rightSection="TL"
            style={{ flex: 1 }}
          />
          <ActionIcon
            color="red"
            variant="light"
            onClick={() =>
              updateMaliyetDetay(
                'genel_gider',
                'kalemler',
                detay.kalemler.filter((_, i) => i !== idx)
              )
            }
          >
            <IconTrash size={16} />
          </ActionIcon>
        </Group>
      ))}
      <Button
        variant="light"
        leftSection={<IconPlus size={16} />}
        onClick={() => {
          const y: GenelGiderKalem = { ad: '', aylikTutar: 0 };
          updateMaliyetDetay('genel_gider', 'kalemler', [...detay.kalemler, y]);
        }}
      >
        Kalem Ekle
      </Button>
      <Paper withBorder p="sm" bg="dark.7">
        <Group justify="space-between">
          <div>
            <Text size="xs" c="dimmed">
              Aylik Toplam
            </Text>
            <Text fw={600}>{formatPara(ozet.aylikToplam)}</Text>
          </div>
          <div>
            <Text size="xs" c="dimmed">
              {detay.aySayisi} Aylik Toplam
            </Text>
            <Text fw={700} c="green">
              {formatPara(ozet.yillikToplam)}
            </Text>
          </div>
        </Group>
      </Paper>
    </Stack>
  );
}

function YasalGiderlerForm({ ctx }: { ctx: UseTeklifMerkeziReturn }) {
  const { teklifData, hesaplanmisTeklifData, updateMaliyetDetay } = ctx;
  const detay = teklifData.maliyet_detay.yasal_giderler.detay;
  const tutar = hesaplanmisTeklifData.maliyet_detay.yasal_giderler.tutar;
  const ozet = hesaplaYasalGiderOzet(detay);

  const renderKategori = (
    key: 'sigortalar' | 'belgeler' | 'isg' | 'ihaleGiderleri',
    baslik: string
  ) => (
    <Paper withBorder p="sm" key={key}>
      <Text fw={500} mb="xs">
        {baslik}
      </Text>
      {detay[key].map((item, idx) => (
        <Group key={`${key}-${item.ad}-${idx}`} mb="xs">
          <TextInput
            size="xs"
            value={item.ad}
            onChange={(e) => {
              const y = [...detay[key]];
              y[idx] = { ...y[idx], ad: e.target.value };
              updateMaliyetDetay('yasal_giderler', key, y);
            }}
            style={{ flex: 2 }}
          />
          <NumberInput
            size="xs"
            value={item.tutar}
            onChange={(v) => {
              const y = [...detay[key]];
              y[idx] = { ...y[idx], tutar: Number(v) || 0 };
              updateMaliyetDetay('yasal_giderler', key, y);
            }}
            thousandSeparator="."
            decimalSeparator=","
            rightSection="TL"
            style={{ flex: 1 }}
          />
          <ActionIcon
            color="red"
            variant="subtle"
            size="sm"
            onClick={() =>
              updateMaliyetDetay(
                'yasal_giderler',
                key,
                detay[key].filter((_, i) => i !== idx)
              )
            }
          >
            <IconTrash size={14} />
          </ActionIcon>
        </Group>
      ))}
      <Button
        variant="subtle"
        size="xs"
        leftSection={<IconPlus size={14} />}
        onClick={() => {
          const y: YasalGiderKalem = { ad: '', tutar: 0 };
          updateMaliyetDetay('yasal_giderler', key, [...detay[key], y]);
        }}
      >
        Ekle
      </Button>
    </Paper>
  );

  return (
    <Stack>
      <Group justify="space-between">
        <Text fw={600} size="lg">
          Yasal Giderler
        </Text>
        <Badge size="xl" color="green" variant="light">
          {formatPara(tutar)}
        </Badge>
      </Group>
      <Text size="xs" c="dimmed" fs="italic">
        Sigorta, belge, ISG ve ihale giderleri.
      </Text>
      {renderKategori('sigortalar', 'Sigortalar')}
      {renderKategori('belgeler', 'Belgeler & Sertifikalar')}
      {renderKategori('isg', 'Is Sagligi & Güvenligi')}
      {renderKategori('ihaleGiderleri', 'Ihale Giderleri')}
      <Paper withBorder p="sm" bg="dark.7">
        <SimpleGrid cols={5}>
          <div>
            <Text size="xs" c="dimmed">
              Sigortalar
            </Text>
            <Text fw={600}>{formatPara(ozet.sigortaToplam)}</Text>
          </div>
          <div>
            <Text size="xs" c="dimmed">
              Belgeler
            </Text>
            <Text fw={600}>{formatPara(ozet.belgeToplam)}</Text>
          </div>
          <div>
            <Text size="xs" c="dimmed">
              ISG
            </Text>
            <Text fw={600}>{formatPara(ozet.isgToplam)}</Text>
          </div>
          <div>
            <Text size="xs" c="dimmed">
              Ihale
            </Text>
            <Text fw={600}>{formatPara(ozet.ihaleToplam)}</Text>
          </div>
          <div>
            <Text size="xs" c="dimmed">
              Toplam
            </Text>
            <Text fw={700} c="green">
              {formatPara(ozet.toplam)}
            </Text>
          </div>
        </SimpleGrid>
      </Paper>
    </Stack>
  );
}

function RiskPayiForm({ ctx }: { ctx: UseTeklifMerkeziReturn }) {
  const { teklifData, hesaplanmisTeklifData, updateMaliyetDetay } = ctx;
  const detay = teklifData.maliyet_detay.risk_payi.detay;
  const riskHaricToplam =
    hesaplanmisTeklifData.maliyet_detay.malzeme.tutar +
    hesaplanmisTeklifData.maliyet_detay.personel.tutar +
    hesaplanmisTeklifData.maliyet_detay.nakliye.tutar +
    hesaplanmisTeklifData.maliyet_detay.sarf_malzeme.tutar +
    hesaplanmisTeklifData.maliyet_detay.ekipman_bakim.tutar +
    hesaplanmisTeklifData.maliyet_detay.genel_gider.tutar +
    hesaplanmisTeklifData.maliyet_detay.yasal_giderler.tutar;
  const ozet = hesaplaRiskOzet(riskHaricToplam, detay);

  return (
    <Stack>
      <Group justify="space-between">
        <Text fw={600} size="lg">
          Risk Payi
        </Text>
        <Badge size="xl" color="green" variant="light">
          {formatPara(hesaplanmisTeklifData.maliyet_detay.risk_payi.tutar)}
        </Badge>
      </Group>
      <Text size="xs" c="dimmed" fs="italic">
        Enflasyon, fiyat artisi ve beklenmedik gider riskleri.
      </Text>
      <Paper withBorder p="sm" bg="dark.7">
        <Text size="xs" c="dimmed" mb={4}>
          Risk Harici Toplam Maliyet
        </Text>
        <Text size="lg" fw={700}>
          {formatPara(riskHaricToplam)}
        </Text>
      </Paper>
      <SegmentedControl
        value={detay.kullanManuel ? 'manuel' : 'kategoriler'}
        onChange={(v) => updateMaliyetDetay('risk_payi', 'kullanManuel', v === 'manuel')}
        data={[
          { label: 'Kategoriler', value: 'kategoriler' },
          { label: 'Manuel Oran', value: 'manuel' },
        ]}
      />
      {detay.kullanManuel ? (
        <Group>
          <Slider
            value={detay.manuelOran}
            onChange={(v) => updateMaliyetDetay('risk_payi', 'manuelOran', v)}
            min={0}
            max={20}
            step={0.5}
            style={{ flex: 1 }}
            marks={[
              { value: 5, label: '5%' },
              { value: 10, label: '10%' },
            ]}
          />
          <NumberInput
            value={detay.manuelOran}
            onChange={(v) => updateMaliyetDetay('risk_payi', 'manuelOran', Number(v) || 0)}
            suffix="%"
            w={80}
          />
        </Group>
      ) : (
        <Stack gap="xs">
          {detay.kategoriler.map((kat, idx) => (
            <Group key={kat.ad}>
              <Checkbox
                checked={kat.aktif}
                onChange={(e) => {
                  const y = [...detay.kategoriler];
                  y[idx] = { ...y[idx], aktif: e.currentTarget.checked };
                  updateMaliyetDetay('risk_payi', 'kategoriler', y);
                }}
                label={kat.ad}
                style={{ flex: 2 }}
              />
              <NumberInput
                value={kat.oran}
                onChange={(v) => {
                  const y = [...detay.kategoriler];
                  y[idx] = { ...y[idx], oran: Number(v) || 0 };
                  updateMaliyetDetay('risk_payi', 'kategoriler', y);
                }}
                suffix="%"
                w={80}
                size="xs"
                disabled={!kat.aktif}
              />
            </Group>
          ))}
        </Stack>
      )}
      <Paper withBorder p="sm" bg="dark.7">
        <Group justify="space-between">
          <div>
            <Text size="xs" c="dimmed">
              Toplam Oran
            </Text>
            <Text fw={600}>%{ozet.toplamOran.toFixed(1)}</Text>
          </div>
          <div>
            <Text size="xs" c="dimmed">
              Risk Tutari
            </Text>
            <Text fw={700} c="green">
              {formatPara(ozet.riskTutari)}
            </Text>
          </div>
        </Group>
      </Paper>
    </Stack>
  );
}
