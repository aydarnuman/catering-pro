'use client';

import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  Loader,
  NumberInput,
  Paper,
  Progress,
  ScrollArea,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconCalculator,
  IconCheck,
  IconCloudCheck,
  IconCoin,
  IconMathFunction,
  IconPlus,
  IconReportMoney,
  IconScale,
  IconTrash,
} from '@tabler/icons-react';

interface TeklifItem {
  firma: string;
  tutar: number;
}

interface MaliyetBilesenleri {
  anaCigGirdi: number;
  yardimciGirdi: number;
  iscilik: number;
  nakliye: number;
  sozlesmeGideri: number;
  genelGider: number;
  kar: number;
}

interface AsiriDusukSonuc {
  toplamMaliyet: number;
  asiriDusukMu: boolean;
  fark: number;
  farkOran: number;
  aciklama: string;
}

interface TeminatSonuc {
  geciciTeminat: number;
  kesinTeminat: number;
  damgaVergisi: number;
}

interface BedelSonuc {
  bedel: number;
  aciklama: string;
}

interface HesaplamalarTabProps {
  yaklasikMaliyet: number;
  setYaklasikMaliyet: (val: number) => void;
  sinirDeger: number | null;
  setSinirDeger: (val: number | null) => void;
  bizimTeklif: number;
  setBizimTeklif: (val: number) => void;
  teklifListesi: TeklifItem[];
  setTeklifListesi: (val: TeklifItem[] | ((prev: TeklifItem[]) => TeklifItem[])) => void;
  hesaplananSinirDeger: number | null;
  maliyetBilesenleri: MaliyetBilesenleri;
  setMaliyetBilesenleri: (
    val: MaliyetBilesenleri | ((prev: MaliyetBilesenleri) => MaliyetBilesenleri)
  ) => void;
  asiriDusukSonuc: AsiriDusukSonuc | null;
  teminatSonuc: TeminatSonuc | null;
  bedelData: { yaklasikMaliyet: number };
  setBedelData: (val: { yaklasikMaliyet: number }) => void;
  bedelSonuc: BedelSonuc | null;
  saveStatus: 'idle' | 'saving' | 'saved';
  hesaplaSinirDeger: () => void;
  hesaplaAsiriDusuk: () => void;
  hesaplaTeminat: () => void;
  hesaplaBedel: () => void;
}

// Pro Theme Colors - Light uyumlu
const theme = {
  bg: '#f8fafc',
  cardBg: '#ffffff',
  border: '#e2e8f0',
  borderFocus: '#0ea5e9',
  text: '#0f172a',
  textMuted: '#64748b',
  textDimmed: '#94a3b8',
  accent: '#0ea5e9',
  accentLight: '#e0f2fe',
  success: '#059669',
  successLight: '#d1fae5',
  warning: '#d97706',
  warningLight: '#fef3c7',
  danger: '#dc2626',
};

// Clean input styles
const inputStyles = {
  input: {
    backgroundColor: '#f8fafc',
    borderColor: theme.border,
    color: theme.text,
    fontWeight: 600,
    '&:focus': { borderColor: theme.borderFocus },
  },
  label: {
    color: theme.textMuted,
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
};

export function HesaplamalarTab({
  yaklasikMaliyet,
  setYaklasikMaliyet,
  sinirDeger,
  setSinirDeger,
  bizimTeklif,
  setBizimTeklif,
  teklifListesi,
  setTeklifListesi,
  hesaplananSinirDeger,
  maliyetBilesenleri,
  setMaliyetBilesenleri,
  asiriDusukSonuc,
  teminatSonuc,
  bedelData,
  setBedelData,
  bedelSonuc,
  saveStatus,
  hesaplaSinirDeger,
  hesaplaAsiriDusuk,
  hesaplaTeminat,
  hesaplaBedel,
}: HesaplamalarTabProps) {
  return (
    <ScrollArea h="calc(100vh - 200px)" offsetScrollbars>
      <Stack gap="md">
        {/* ÜST BÖLÜM: TEMEL VERİLER */}
        <Paper
          p="lg"
          radius="md"
          style={{ background: theme.cardBg, border: `1px solid ${theme.border}` }}
        >
          <Group justify="space-between" mb="md">
            <Group gap="xs">
              <IconCalculator size={18} color={theme.accent} stroke={1.5} />
              <Text fw={600} size="sm" c={theme.text}>
                Teklif Verileri
              </Text>
            </Group>
            {saveStatus === 'saving' && (
              <Badge size="xs" variant="light" color="blue" leftSection={<Loader size={8} />}>
                Kaydediliyor
              </Badge>
            )}
            {saveStatus === 'saved' && (
              <Badge
                size="xs"
                variant="light"
                color="green"
                leftSection={<IconCloudCheck size={10} />}
              >
                Kaydedildi
              </Badge>
            )}
          </Group>

          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
            {/* Yaklaşık Maliyet */}
            <Box>
              <Text
                size="xs"
                fw={600}
                c={theme.textMuted}
                mb={4}
                tt="uppercase"
                style={{ letterSpacing: 0.5 }}
              >
                Yaklaşık Maliyet
              </Text>
              <NumberInput
                placeholder="0"
                value={yaklasikMaliyet || ''}
                onChange={(val) => setYaklasikMaliyet(Number(val) || 0)}
                thousandSeparator="."
                decimalSeparator=","
                min={0}
                variant="filled"
                size="md"
                hideControls
                styles={{
                  input: {
                    backgroundColor: theme.bg,
                    border: `1px solid ${theme.border}`,
                    fontWeight: 700,
                    fontSize: 20,
                    color: theme.text,
                  },
                }}
                rightSection={
                  <Text size="sm" c={theme.textDimmed} mr={8}>
                    ₺
                  </Text>
                }
              />
            </Box>

            {/* Sınır Değer */}
            <Box>
              <Text
                size="xs"
                fw={600}
                c={theme.warning}
                mb={4}
                tt="uppercase"
                style={{ letterSpacing: 0.5 }}
              >
                Sınır Değer
              </Text>
              <NumberInput
                placeholder="0"
                value={sinirDeger || ''}
                onChange={(val) => setSinirDeger(Number(val) || null)}
                thousandSeparator="."
                decimalSeparator=","
                min={0}
                variant="filled"
                size="md"
                hideControls
                styles={{
                  input: {
                    backgroundColor: theme.bg,
                    border: `1px solid ${theme.border}`,
                    fontWeight: 700,
                    fontSize: 20,
                    color: theme.text,
                  },
                }}
                rightSection={
                  <Text size="sm" c={theme.textDimmed} mr={8}>
                    ₺
                  </Text>
                }
              />
            </Box>

            {/* Bizim Teklifimiz */}
            <Box>
              <Text
                size="xs"
                fw={600}
                c={theme.accent}
                mb={4}
                tt="uppercase"
                style={{ letterSpacing: 0.5 }}
              >
                Bizim Teklifimiz
              </Text>
              <NumberInput
                placeholder="0"
                value={bizimTeklif || ''}
                onChange={(val) => setBizimTeklif(Number(val) || 0)}
                thousandSeparator="."
                decimalSeparator=","
                min={0}
                variant="filled"
                size="md"
                hideControls
                styles={{
                  input: {
                    backgroundColor: theme.bg,
                    border: `1px solid ${theme.border}`,
                    fontWeight: 700,
                    fontSize: 20,
                    color: theme.text,
                  },
                }}
                rightSection={
                  <Text size="sm" c={theme.textDimmed} mr={8}>
                    ₺
                  </Text>
                }
              />
            </Box>
          </SimpleGrid>

          {/* Progress Bar */}
          {sinirDeger && sinirDeger > 0 && bizimTeklif > 0 && (
            <Box mt="md" pt="md" style={{ borderTop: `1px solid ${theme.border}` }}>
              <Group justify="space-between" mb={6}>
                <Text size="xs" fw={500} c={theme.textMuted}>
                  Teklif / Sınır Değer
                </Text>
                <Badge
                  size="sm"
                  variant="light"
                  color={bizimTeklif < sinirDeger ? 'orange' : 'teal'}
                  leftSection={
                    bizimTeklif < sinirDeger ? (
                      <IconAlertTriangle size={10} />
                    ) : (
                      <IconCheck size={10} />
                    )
                  }
                >
                  %{Math.round((bizimTeklif / sinirDeger) * 100)}
                </Badge>
              </Group>
              <Progress.Root size={6} radius="xl">
                <Progress.Section
                  value={Math.min((bizimTeklif / sinirDeger) * 100, 100)}
                  color={bizimTeklif < sinirDeger ? 'orange' : 'teal'}
                />
              </Progress.Root>
              <Group justify="space-between" mt={4}>
                <Text size="xs" c={theme.textDimmed}>
                  0 ₺
                </Text>
                <Text size="xs" c={theme.textDimmed}>
                  {sinirDeger.toLocaleString('tr-TR')} ₺
                </Text>
              </Group>
            </Box>
          )}
        </Paper>

        {/* HESAPLAMA KARTLARI */}
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          {/* Sınır Değer Hesaplama */}
          <Paper
            p="md"
            radius="md"
            style={{ background: theme.cardBg, border: `1px solid ${theme.border}` }}
          >
            <Group gap="xs" mb="md">
              <IconMathFunction size={16} color={theme.accent} stroke={1.5} />
              <div>
                <Text fw={600} size="sm" c={theme.text}>
                  Sınır Değer Hesaplama
                </Text>
                <Text size="xs" c={theme.textDimmed}>
                  KİK formülü
                </Text>
              </div>
            </Group>

            <Group justify="space-between" mb="xs">
              <Text size="xs" fw={500} c={theme.textMuted}>
                Teklif Listesi
              </Text>
              <Button
                size="compact-xs"
                variant="subtle"
                color="blue"
                leftSection={<IconPlus size={12} />}
                onClick={() => setTeklifListesi((prev) => [...prev, { firma: '', tutar: 0 }])}
              >
                Ekle
              </Button>
            </Group>

            <Stack gap={6}>
              {teklifListesi.map((teklif, index) => (
                <Group key={index} gap={6}>
                  <TextInput
                    placeholder={`Firma ${index + 1}`}
                    value={teklif.firma}
                    onChange={(e) =>
                      setTeklifListesi((prev) =>
                        prev.map((t, i) => (i === index ? { ...t, firma: e.target.value } : t))
                      )
                    }
                    style={{ flex: 1, maxWidth: 100 }}
                    size="xs"
                    styles={inputStyles}
                  />
                  <NumberInput
                    placeholder="Tutar"
                    value={teklif.tutar || ''}
                    onChange={(val) =>
                      setTeklifListesi((prev) =>
                        prev.map((t, i) => (i === index ? { ...t, tutar: Number(val) || 0 } : t))
                      )
                    }
                    thousandSeparator="."
                    decimalSeparator=","
                    min={0}
                    style={{ flex: 1 }}
                    size="xs"
                    rightSection={
                      <Text size="xs" c={theme.textDimmed}>
                        ₺
                      </Text>
                    }
                    styles={inputStyles}
                  />
                  {teklifListesi.length > 2 && (
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      size="sm"
                      onClick={() => setTeklifListesi((prev) => prev.filter((_, i) => i !== index))}
                    >
                      <IconTrash size={14} />
                    </ActionIcon>
                  )}
                </Group>
              ))}
            </Stack>

            <Button
              fullWidth
              mt="sm"
              size="sm"
              variant="light"
              color="blue"
              leftSection={<IconCalculator size={14} />}
              onClick={hesaplaSinirDeger}
              disabled={teklifListesi.filter((t) => t.tutar > 0).length < 2}
            >
              Hesapla
            </Button>

            {hesaplananSinirDeger && (
              <Paper
                mt="sm"
                p="sm"
                radius="sm"
                bg={theme.successLight}
                style={{ border: `1px solid ${theme.success}30` }}
              >
                <Group justify="space-between">
                  <div>
                    <Text size="xs" c={theme.textMuted}>
                      Sonuç
                    </Text>
                    <Text size="lg" fw={700} c={theme.success}>
                      {hesaplananSinirDeger.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺
                    </Text>
                  </div>
                  <Button
                    size="xs"
                    color="teal"
                    variant="filled"
                    onClick={() => setSinirDeger(Math.round(hesaplananSinirDeger))}
                  >
                    Uygula
                  </Button>
                </Group>
              </Paper>
            )}
          </Paper>

          {/* Aşırı Düşük Analizi */}
          <Paper
            p="md"
            radius="md"
            style={{ background: theme.cardBg, border: `1px solid ${theme.border}` }}
          >
            <Group gap="xs" mb="md">
              <IconReportMoney size={16} color={theme.warning} stroke={1.5} />
              <div>
                <Text fw={600} size="sm" c={theme.text}>
                  Aşırı Düşük Analizi
                </Text>
                <Text size="xs" c={theme.textDimmed}>
                  Sınır değer kontrolü
                </Text>
              </div>
            </Group>

            {sinirDeger && bizimTeklif > 0 && (
              <Paper
                p="xs"
                mb="sm"
                radius="sm"
                bg={bizimTeklif < sinirDeger ? theme.warningLight : theme.successLight}
                style={{
                  border: `1px solid ${bizimTeklif < sinirDeger ? theme.warning : theme.success}30`,
                }}
              >
                <Group justify="space-between">
                  <Text
                    fw={600}
                    size="xs"
                    c={bizimTeklif < sinirDeger ? theme.warning : theme.success}
                  >
                    {bizimTeklif < sinirDeger ? '⚠ Açıklama Gerekli' : '✓ Uygun'}
                  </Text>
                  <Text
                    fw={600}
                    size="xs"
                    c={bizimTeklif < sinirDeger ? theme.warning : theme.success}
                  >
                    {Math.abs(sinirDeger - bizimTeklif).toLocaleString('tr-TR')} ₺
                  </Text>
                </Group>
              </Paper>
            )}

            <Text size="xs" fw={500} mb={6} c={theme.textMuted}>
              Maliyet Bileşenleri
            </Text>
            <SimpleGrid cols={2} spacing={6}>
              <NumberInput
                label="Ana Çiğ Girdi"
                placeholder="0"
                value={maliyetBilesenleri.anaCigGirdi || ''}
                onChange={(val) =>
                  setMaliyetBilesenleri((prev) => ({ ...prev, anaCigGirdi: Number(val) || 0 }))
                }
                thousandSeparator="."
                decimalSeparator=","
                min={0}
                size="xs"
                styles={inputStyles}
              />
              <NumberInput
                label="Yardımcı Girdi"
                placeholder="0"
                value={maliyetBilesenleri.yardimciGirdi || ''}
                onChange={(val) =>
                  setMaliyetBilesenleri((prev) => ({ ...prev, yardimciGirdi: Number(val) || 0 }))
                }
                thousandSeparator="."
                decimalSeparator=","
                min={0}
                size="xs"
                styles={inputStyles}
              />
              <NumberInput
                label="İşçilik"
                placeholder="0"
                value={maliyetBilesenleri.iscilik || ''}
                onChange={(val) =>
                  setMaliyetBilesenleri((prev) => ({ ...prev, iscilik: Number(val) || 0 }))
                }
                thousandSeparator="."
                decimalSeparator=","
                min={0}
                size="xs"
                styles={inputStyles}
              />
              <NumberInput
                label="Nakliye"
                placeholder="0"
                value={maliyetBilesenleri.nakliye || ''}
                onChange={(val) =>
                  setMaliyetBilesenleri((prev) => ({ ...prev, nakliye: Number(val) || 0 }))
                }
                thousandSeparator="."
                decimalSeparator=","
                min={0}
                size="xs"
                styles={inputStyles}
              />
              <NumberInput
                label="Sözleşme Gideri"
                placeholder="0"
                value={maliyetBilesenleri.sozlesmeGideri || ''}
                onChange={(val) =>
                  setMaliyetBilesenleri((prev) => ({ ...prev, sozlesmeGideri: Number(val) || 0 }))
                }
                thousandSeparator="."
                decimalSeparator=","
                min={0}
                size="xs"
                styles={inputStyles}
              />
              <NumberInput
                label="Genel Gider + Kâr"
                placeholder="0"
                value={maliyetBilesenleri.genelGider || ''}
                onChange={(val) =>
                  setMaliyetBilesenleri((prev) => ({ ...prev, genelGider: Number(val) || 0 }))
                }
                thousandSeparator="."
                decimalSeparator=","
                min={0}
                size="xs"
                styles={inputStyles}
              />
            </SimpleGrid>

            <Button
              fullWidth
              mt="sm"
              size="sm"
              variant="light"
              color="orange"
              leftSection={<IconCalculator size={14} />}
              onClick={hesaplaAsiriDusuk}
              disabled={!sinirDeger || bizimTeklif <= 0}
            >
              Analiz Et
            </Button>

            {asiriDusukSonuc && (
              <Paper
                mt="sm"
                p="sm"
                radius="sm"
                bg={asiriDusukSonuc.asiriDusukMu ? theme.warningLight : theme.successLight}
                style={{
                  border: `1px solid ${asiriDusukSonuc.asiriDusukMu ? theme.warning : theme.success}30`,
                }}
              >
                <Group justify="space-between" mb={4}>
                  <Badge
                    color={asiriDusukSonuc.asiriDusukMu ? 'orange' : 'teal'}
                    size="sm"
                    variant="filled"
                  >
                    {asiriDusukSonuc.asiriDusukMu ? 'Aşırı Düşük' : 'Normal'}
                  </Badge>
                  {asiriDusukSonuc.toplamMaliyet > 0 && (
                    <Text size="xs" fw={600} c={theme.text}>
                      {asiriDusukSonuc.toplamMaliyet.toLocaleString('tr-TR')} ₺
                    </Text>
                  )}
                </Group>
                <Text size="xs" c={theme.textMuted}>
                  {asiriDusukSonuc.aciklama}
                </Text>
              </Paper>
            )}
          </Paper>

          {/* İtirazen Şikayet Bedeli */}
          <Paper
            p="md"
            radius="md"
            style={{ background: theme.cardBg, border: `1px solid ${theme.border}` }}
          >
            <Group gap="xs" mb="md">
              <IconCoin size={16} color={theme.success} stroke={1.5} />
              <div>
                <Text fw={600} size="sm" c={theme.text}>
                  İtirazen Şikayet Bedeli
                </Text>
                <Text size="xs" c={theme.textDimmed}>
                  2026 tarifeleri
                </Text>
              </div>
            </Group>

            <NumberInput
              label="Yaklaşık Maliyet"
              placeholder="Üstteki değer kullanılır"
              value={bedelData.yaklasikMaliyet || yaklasikMaliyet || ''}
              onChange={(val) => setBedelData({ yaklasikMaliyet: Number(val) || 0 })}
              thousandSeparator="."
              decimalSeparator=","
              min={0}
              size="xs"
              styles={inputStyles}
            />

            <Button
              fullWidth
              mt="sm"
              size="sm"
              variant="light"
              color="teal"
              leftSection={<IconCoin size={14} />}
              onClick={hesaplaBedel}
            >
              Hesapla
            </Button>

            {bedelSonuc && (
              <Paper
                mt="sm"
                p="sm"
                radius="sm"
                bg={theme.successLight}
                style={{ border: `1px solid ${theme.success}30` }}
              >
                <Text size="lg" fw={700} c={theme.success}>
                  {bedelSonuc.bedel.toLocaleString('tr-TR')} ₺
                </Text>
                <Text size="xs" c={theme.textMuted}>
                  {bedelSonuc.aciklama}
                </Text>
              </Paper>
            )}
          </Paper>

          {/* Teminat Hesaplama */}
          <Paper
            p="md"
            radius="md"
            style={{ background: theme.cardBg, border: `1px solid ${theme.border}` }}
          >
            <Group gap="xs" mb="md">
              <IconScale size={16} color={theme.accent} stroke={1.5} />
              <div>
                <Text fw={600} size="sm" c={theme.text}>
                  Teminat Hesaplama
                </Text>
                <Text size="xs" c={theme.textDimmed}>
                  Geçici %3, Kesin %6
                </Text>
              </div>
            </Group>

            <Text size="xs" c={theme.textMuted} mb="sm">
              Teklif:{' '}
              <strong style={{ color: theme.text }}>
                {bizimTeklif > 0 ? `${bizimTeklif.toLocaleString('tr-TR')} ₺` : '-'}
              </strong>
            </Text>

            <Button
              fullWidth
              size="sm"
              variant="light"
              color="blue"
              leftSection={<IconScale size={14} />}
              onClick={hesaplaTeminat}
              disabled={bizimTeklif <= 0}
            >
              Hesapla
            </Button>

            {teminatSonuc && (
              <Stack gap={6} mt="sm">
                <Paper
                  p="xs"
                  radius="sm"
                  bg={theme.accentLight}
                  style={{ border: `1px solid ${theme.accent}30` }}
                >
                  <Group justify="space-between">
                    <Text size="xs" c={theme.textMuted}>
                      Geçici Teminat (%3)
                    </Text>
                    <Text size="sm" fw={700} c={theme.accent}>
                      {teminatSonuc.geciciTeminat.toLocaleString('tr-TR', {
                        maximumFractionDigits: 0,
                      })}{' '}
                      ₺
                    </Text>
                  </Group>
                </Paper>
                <Paper
                  p="xs"
                  radius="sm"
                  bg={theme.accentLight}
                  style={{ border: `1px solid ${theme.accent}30` }}
                >
                  <Group justify="space-between">
                    <Text size="xs" c={theme.textMuted}>
                      Kesin Teminat (%6)
                    </Text>
                    <Text size="sm" fw={700} c={theme.accent}>
                      {teminatSonuc.kesinTeminat.toLocaleString('tr-TR', {
                        maximumFractionDigits: 0,
                      })}{' '}
                      ₺
                    </Text>
                  </Group>
                </Paper>
                <Paper
                  p="xs"
                  radius="sm"
                  bg={theme.accentLight}
                  style={{ border: `1px solid ${theme.accent}30` }}
                >
                  <Group justify="space-between">
                    <Text size="xs" c={theme.textMuted}>
                      Damga Vergisi
                    </Text>
                    <Text size="sm" fw={700} c={theme.accent}>
                      {teminatSonuc.damgaVergisi.toLocaleString('tr-TR', {
                        maximumFractionDigits: 0,
                      })}{' '}
                      ₺
                    </Text>
                  </Group>
                </Paper>
              </Stack>
            )}
          </Paper>
        </SimpleGrid>
      </Stack>
    </ScrollArea>
  );
}
