'use client';

import {
  ActionIcon,
  Alert,
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
  ThemeIcon,
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
  setMaliyetBilesenleri: (val: MaliyetBilesenleri | ((prev: MaliyetBilesenleri) => MaliyetBilesenleri)) => void;
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
      <Stack gap="lg">
        {/* ÜST BÖLÜM: TEMEL VERİLER */}
        <Paper 
          p="lg" 
          withBorder 
          radius="lg" 
          shadow="sm"
          style={{
            background: sinirDeger && bizimTeklif > 0
              ? bizimTeklif < sinirDeger 
                ? 'linear-gradient(135deg, rgba(255,244,230,0.7) 0%, rgba(255,255,255,1) 100%)'
                : 'linear-gradient(135deg, rgba(235,251,238,0.7) 0%, rgba(255,255,255,1) 100%)'
              : 'linear-gradient(135deg, rgba(248,249,250,1) 0%, rgba(255,255,255,1) 100%)'
          }}
        >
          <Group justify="space-between" mb="lg">
            <Group gap="sm">
              <ThemeIcon size="xl" variant="gradient" gradient={{ from: 'violet', to: 'indigo' }} radius="xl">
                <IconCalculator size={24} />
              </ThemeIcon>
              <div>
                <Text fw={700} size="lg">Teklif Verileri</Text>
                <Text size="xs" c="dimmed">Hesaplamalarda kullanılacak temel değerler</Text>
              </div>
            </Group>
            {/* Save Status */}
            {saveStatus === 'saving' && (
              <Badge size="sm" variant="light" color="blue" leftSection={<Loader size={10} />}>
                Kaydediliyor...
              </Badge>
            )}
            {saveStatus === 'saved' && (
              <Badge size="sm" variant="light" color="green" leftSection={<IconCloudCheck size={12} />}>
                Kaydedildi
              </Badge>
            )}
          </Group>

          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
            <Paper p="md" radius="md" withBorder bg="white" shadow="xs">
              <Group gap="xs" mb="sm">
                <ThemeIcon size="sm" variant="light" color="blue" radius="xl">
                  <IconCoin size={14} />
                </ThemeIcon>
                <Text size="sm" fw={600} c="blue.7">Yaklaşık Maliyet</Text>
              </Group>
              <NumberInput
                placeholder="İdarenin belirlediği tutar"
                value={yaklasikMaliyet || ''}
                onChange={(val) => setYaklasikMaliyet(Number(val) || 0)}
                thousandSeparator="."
                decimalSeparator=","
                min={0}
                variant="filled"
                size="lg"
                hideControls
                styles={{ input: { fontWeight: 700, fontSize: 18 } }}
                rightSection={<Text size="sm" c="dimmed" mr={12}>TL</Text>}
              />
            </Paper>
            <Paper p="md" radius="md" withBorder bg="white" shadow="xs">
              <Group gap="xs" mb="sm">
                <ThemeIcon size="sm" variant="light" color="orange" radius="xl">
                  <IconAlertTriangle size={14} />
                </ThemeIcon>
                <Text size="sm" fw={600} c="orange.7">Sınır Değer</Text>
              </Group>
              <NumberInput
                placeholder="Hesapla veya gir"
                value={sinirDeger || ''}
                onChange={(val) => setSinirDeger(Number(val) || null)}
                thousandSeparator="."
                decimalSeparator=","
                min={0}
                variant="filled"
                size="lg"
                hideControls
                styles={{ input: { fontWeight: 700, fontSize: 18 } }}
                rightSection={<Text size="sm" c="dimmed" mr={12}>TL</Text>}
              />
            </Paper>
            <Paper p="md" radius="md" withBorder bg="white" shadow="xs">
              <Group gap="xs" mb="sm">
                <ThemeIcon size="sm" variant="light" color="green" radius="xl">
                  <IconReportMoney size={14} />
                </ThemeIcon>
                <Text size="sm" fw={600} c="green.7">Bizim Teklifimiz</Text>
              </Group>
              <NumberInput
                placeholder="Vereceğiniz teklif"
                value={bizimTeklif || ''}
                onChange={(val) => setBizimTeklif(Number(val) || 0)}
                thousandSeparator="."
                decimalSeparator=","
                min={0}
                variant="filled"
                size="lg"
                hideControls
                styles={{ input: { fontWeight: 700, fontSize: 18 } }}
                rightSection={<Text size="sm" c="dimmed" mr={12}>TL</Text>}
              />
            </Paper>
          </SimpleGrid>

          {/* Progress Bar & Durum */}
          {sinirDeger && sinirDeger > 0 && bizimTeklif > 0 && (
            <Box mt="lg">
              <Group justify="space-between" mb="xs">
                <Text size="sm" fw={500}>Teklif / Sınır Değer Oranı</Text>
                <Badge 
                  size="lg" 
                  variant="filled"
                  color={bizimTeklif < sinirDeger ? 'orange' : 'green'}
                  leftSection={bizimTeklif < sinirDeger ? <IconAlertTriangle size={14} /> : <IconCheck size={14} />}
                >
                  %{Math.round((bizimTeklif / sinirDeger) * 100)} {bizimTeklif < sinirDeger ? '- Aşırı Düşük Riski' : '- Uygun'}
                </Badge>
              </Group>
              <Progress.Root size={24} radius="xl">
                <Progress.Section 
                  value={Math.min((bizimTeklif / sinirDeger) * 100, 100)} 
                  color={bizimTeklif < sinirDeger ? 'orange' : 'green'}
                >
                  <Progress.Label style={{ fontSize: 12, fontWeight: 600 }}>
                    {bizimTeklif.toLocaleString('tr-TR')} TL
                  </Progress.Label>
                </Progress.Section>
              </Progress.Root>
              <Group justify="space-between" mt={6}>
                <Text size="xs" c="dimmed">0 TL</Text>
                <Text size="xs" c="dimmed" fw={500}>Sınır: {sinirDeger.toLocaleString('tr-TR')} TL</Text>
              </Group>
              {bizimTeklif < sinirDeger && (
                <Alert mt="md" color="orange" variant="light" icon={<IconAlertTriangle size={18} />}>
                  <Text size="sm">
                    Teklifiniz sınır değerin <strong>%{((1 - bizimTeklif / sinirDeger) * 100).toFixed(1)}</strong> altında. 
                    Aşırı düşük teklif açıklaması hazırlamanız gerekebilir.
                  </Text>
                </Alert>
              )}
            </Box>
          )}
        </Paper>

        {/* ALT BÖLÜM: HESAPLAMA KARTLARI */}
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          {/* Sınır Değer Hesaplama Kartı */}
          <Paper p="lg" withBorder radius="lg" shadow="sm" style={{ background: 'white' }}>
            <Group gap="sm" mb="lg">
              <ThemeIcon size="lg" variant="gradient" gradient={{ from: 'violet', to: 'indigo' }} radius="xl">
                <IconMathFunction size={20} />
              </ThemeIcon>
              <div>
                <Text fw={600}>Sınır Değer Hesaplama</Text>
                <Text size="xs" c="dimmed">KİK formülü ile hesapla</Text>
              </div>
            </Group>

            <div>
              <Group justify="space-between" mb="sm">
                <Text size="sm" fw={500}>Teklif Listesi</Text>
                <Button
                  size="xs"
                  variant="light"
                  color="violet"
                  leftSection={<IconPlus size={14} />}
                  onClick={() => setTeklifListesi((prev) => [...prev, { firma: '', tutar: 0 }])}
                >
                  Ekle
                </Button>
              </Group>
              <Stack gap="xs">
                {teklifListesi.map((teklif, index) => (
                  <Group key={index} gap="xs">
                    <TextInput
                      placeholder={`Firma ${index + 1}`}
                      value={teklif.firma}
                      onChange={(e) =>
                        setTeklifListesi((prev) =>
                          prev.map((t, i) => i === index ? { ...t, firma: e.target.value } : t)
                        )
                      }
                      style={{ flex: 1, maxWidth: 140 }}
                      size="xs"
                    />
                    <NumberInput
                      placeholder="Tutar"
                      value={teklif.tutar || ''}
                      onChange={(val) =>
                        setTeklifListesi((prev) =>
                          prev.map((t, i) => i === index ? { ...t, tutar: Number(val) || 0 } : t)
                        )
                      }
                      thousandSeparator="."
                      decimalSeparator=","
                      min={0}
                      style={{ flex: 1 }}
                      size="xs"
                      rightSection={<Text size="xs" c="dimmed">TL</Text>}
                    />
                    {teklifListesi.length > 2 && (
                      <ActionIcon
                        variant="light"
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
            </div>

            <Button
              fullWidth
              mt="md"
              variant="gradient"
              gradient={{ from: 'violet', to: 'indigo' }}
              leftSection={<IconCalculator size={16} />}
              onClick={hesaplaSinirDeger}
              disabled={teklifListesi.filter((t) => t.tutar > 0).length < 2}
            >
              Sınır Değer Hesapla
            </Button>

            {hesaplananSinirDeger && (
              <Paper mt="md" p="md" radius="md" bg="green.0" withBorder style={{ borderColor: 'var(--mantine-color-green-4)' }}>
                <Group justify="space-between">
                  <div>
                    <Text size="xs" c="dimmed">Hesaplanan Değer</Text>
                    <Text size="xl" fw={700} c="green.7">
                      {hesaplananSinirDeger.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} TL
                    </Text>
                  </div>
                  <Button size="sm" color="green" onClick={() => setSinirDeger(Math.round(hesaplananSinirDeger))}>
                    Kaydet
                  </Button>
                </Group>
              </Paper>
            )}
          </Paper>

          {/* Aşırı Düşük Analiz Kartı */}
          <Paper p="lg" withBorder radius="lg" shadow="sm" style={{ background: 'white' }}>
            <Group gap="sm" mb="md">
              <ThemeIcon size="lg" variant="gradient" gradient={{ from: 'orange', to: 'red' }} radius="xl">
                <IconReportMoney size={20} />
              </ThemeIcon>
              <div>
                <Text fw={600}>Aşırı Düşük Analizi</Text>
                <Text size="xs" c="dimmed">Sınır değer karşılaştırması</Text>
              </div>
            </Group>

            {/* Durum Göstergesi */}
            {sinirDeger && bizimTeklif > 0 && (
              <Paper 
                p="sm" 
                mb="md" 
                radius="md" 
                bg={bizimTeklif < sinirDeger ? 'orange.0' : 'green.0'}
                withBorder
                style={{ borderColor: bizimTeklif < sinirDeger ? 'var(--mantine-color-orange-4)' : 'var(--mantine-color-green-4)' }}
              >
                <Group justify="space-between">
                  <div>
                    <Text size="xs" c="dimmed">Durum</Text>
                    <Text fw={700} c={bizimTeklif < sinirDeger ? 'orange.7' : 'green.7'}>
                      {bizimTeklif < sinirDeger ? '⚠️ AÇIKLAMA GEREKLİ' : '✅ AÇIKLAMA GEREKMİYOR'}
                    </Text>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <Text size="xs" c="dimmed">Fark</Text>
                    <Text fw={600} c={bizimTeklif < sinirDeger ? 'orange.7' : 'green.7'}>
                      {(sinirDeger - bizimTeklif).toLocaleString('tr-TR')} TL
                    </Text>
                  </div>
                </Group>
              </Paper>
            )}

            <Text size="xs" fw={500} mb="xs" c="dimmed">Maliyet Bileşenleri (EK-H.4 için)</Text>
            <SimpleGrid cols={2} spacing="xs">
              <NumberInput
                label="Ana Çiğ Girdi"
                placeholder="0"
                value={maliyetBilesenleri.anaCigGirdi || ''}
                onChange={(val) => setMaliyetBilesenleri((prev) => ({ ...prev, anaCigGirdi: Number(val) || 0 }))}
                thousandSeparator="."
                decimalSeparator=","
                min={0}
                size="xs"
              />
              <NumberInput
                label="Yardımcı Girdi"
                placeholder="0"
                value={maliyetBilesenleri.yardimciGirdi || ''}
                onChange={(val) => setMaliyetBilesenleri((prev) => ({ ...prev, yardimciGirdi: Number(val) || 0 }))}
                thousandSeparator="."
                decimalSeparator=","
                min={0}
                size="xs"
              />
              <NumberInput
                label="İşçilik"
                placeholder="0"
                value={maliyetBilesenleri.iscilik || ''}
                onChange={(val) => setMaliyetBilesenleri((prev) => ({ ...prev, iscilik: Number(val) || 0 }))}
                thousandSeparator="."
                decimalSeparator=","
                min={0}
                size="xs"
              />
              <NumberInput
                label="Nakliye"
                placeholder="0"
                value={maliyetBilesenleri.nakliye || ''}
                onChange={(val) => setMaliyetBilesenleri((prev) => ({ ...prev, nakliye: Number(val) || 0 }))}
                thousandSeparator="."
                decimalSeparator=","
                min={0}
                size="xs"
              />
              <NumberInput
                label="Sözleşme Gideri"
                placeholder="0"
                value={maliyetBilesenleri.sozlesmeGideri || ''}
                onChange={(val) => setMaliyetBilesenleri((prev) => ({ ...prev, sozlesmeGideri: Number(val) || 0 }))}
                thousandSeparator="."
                decimalSeparator=","
                min={0}
                size="xs"
              />
              <NumberInput
                label="Genel Gider + Kâr"
                placeholder="0"
                value={maliyetBilesenleri.genelGider || ''}
                onChange={(val) => setMaliyetBilesenleri((prev) => ({ ...prev, genelGider: Number(val) || 0 }))}
                thousandSeparator="."
                decimalSeparator=","
                min={0}
                size="xs"
              />
            </SimpleGrid>

            <Button
              fullWidth
              mt="md"
              variant="gradient"
              gradient={{ from: 'orange', to: 'red' }}
              leftSection={<IconCalculator size={16} />}
              onClick={hesaplaAsiriDusuk}
              disabled={!sinirDeger || bizimTeklif <= 0}
            >
              Detaylı Analiz
            </Button>

            {asiriDusukSonuc && (
              <Paper 
                mt="md" 
                p="md" 
                radius="md" 
                bg={asiriDusukSonuc.asiriDusukMu ? 'orange.0' : 'green.0'} 
                withBorder 
                style={{ borderColor: asiriDusukSonuc.asiriDusukMu ? 'var(--mantine-color-orange-4)' : 'var(--mantine-color-green-4)' }}
              >
                <Group justify="space-between" mb="xs">
                  <Badge color={asiriDusukSonuc.asiriDusukMu ? 'orange' : 'green'} size="lg">
                    {asiriDusukSonuc.asiriDusukMu ? 'AŞIRI DÜŞÜK' : 'NORMAL TEKLİF'}
                  </Badge>
                  {asiriDusukSonuc.toplamMaliyet > 0 && (
                    <Text size="sm" fw={600}>
                      Toplam Maliyet: {asiriDusukSonuc.toplamMaliyet.toLocaleString('tr-TR')} TL
                    </Text>
                  )}
                </Group>
                <Text size="sm">{asiriDusukSonuc.aciklama}</Text>
              </Paper>
            )}
          </Paper>

          {/* İtirazen Şikayet Bedeli Kartı */}
          <Paper p="lg" withBorder radius="lg" shadow="sm" style={{ background: 'white' }}>
            <Group gap="sm" mb="lg">
              <ThemeIcon size="lg" variant="gradient" gradient={{ from: 'teal', to: 'green' }} radius="xl">
                <IconCoin size={20} />
              </ThemeIcon>
              <div>
                <Text fw={600}>İtirazen Şikayet Bedeli</Text>
                <Text size="xs" c="dimmed">2026 yılı güncel tarifeleri</Text>
              </div>
            </Group>

            <NumberInput
              label="Yaklaşık Maliyet (TL)"
              placeholder="Otomatik: üstteki değer kullanılır"
              value={bedelData.yaklasikMaliyet || yaklasikMaliyet || ''}
              onChange={(val) => setBedelData({ yaklasikMaliyet: Number(val) || 0 })}
              thousandSeparator="."
              decimalSeparator=","
              min={0}
              size="sm"
            />

            <Button
              fullWidth
              mt="md"
              variant="gradient"
              gradient={{ from: 'teal', to: 'green' }}
              leftSection={<IconCoin size={16} />}
              onClick={hesaplaBedel}
            >
              Bedel Hesapla
            </Button>

            {bedelSonuc && (
              <Paper 
                mt="md" 
                p="md" 
                radius="md" 
                bg="green.0" 
                withBorder 
                style={{ borderColor: 'var(--mantine-color-green-4)' }}
              >
                <Text size="xl" fw={700} c="green.7">
                  {bedelSonuc.bedel.toLocaleString('tr-TR')} TL
                </Text>
                <Text size="xs" c="dimmed">{bedelSonuc.aciklama}</Text>
              </Paper>
            )}
          </Paper>

          {/* Teminat Hesaplama Kartı */}
          <Paper p="lg" withBorder radius="lg" shadow="sm" style={{ background: 'white' }}>
            <Group gap="sm" mb="lg">
              <ThemeIcon size="lg" variant="gradient" gradient={{ from: 'pink', to: 'grape' }} radius="xl">
                <IconScale size={20} />
              </ThemeIcon>
              <div>
                <Text fw={600}>Teminat Hesaplama</Text>
                <Text size="xs" c="dimmed">Geçici %3, Kesin %6, Damga Vergisi</Text>
              </div>
            </Group>

            <Text size="sm" c="dimmed" mb="md">
              Bizim Teklifimiz: <strong>{bizimTeklif > 0 ? `${bizimTeklif.toLocaleString('tr-TR')} TL` : 'Girilmedi'}</strong>
            </Text>

            <Button
              fullWidth
              variant="gradient"
              gradient={{ from: 'pink', to: 'grape' }}
              leftSection={<IconScale size={16} />}
              onClick={hesaplaTeminat}
              disabled={bizimTeklif <= 0}
            >
              Teminat Hesapla
            </Button>

            {teminatSonuc && (
              <Stack gap="sm" mt="md">
                <Paper p="sm" radius="md" bg="violet.0" withBorder style={{ borderColor: 'var(--mantine-color-violet-4)' }}>
                  <Group justify="space-between">
                    <Text size="sm" fw={500}>Geçici Teminat (%3)</Text>
                    <Text size="md" fw={700} c="violet.7">
                      {teminatSonuc.geciciTeminat.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} TL
                    </Text>
                  </Group>
                </Paper>
                <Paper p="sm" radius="md" bg="grape.0" withBorder style={{ borderColor: 'var(--mantine-color-grape-4)' }}>
                  <Group justify="space-between">
                    <Text size="sm" fw={500}>Kesin Teminat (%6)</Text>
                    <Text size="md" fw={700} c="grape.7">
                      {teminatSonuc.kesinTeminat.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} TL
                    </Text>
                  </Group>
                </Paper>
                <Paper p="sm" radius="md" bg="pink.0" withBorder style={{ borderColor: 'var(--mantine-color-pink-4)' }}>
                  <Group justify="space-between">
                    <Text size="sm" fw={500}>Damga Vergisi (‰5.69)</Text>
                    <Text size="md" fw={700} c="pink.7">
                      {teminatSonuc.damgaVergisi.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} TL
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
