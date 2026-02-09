'use client';

import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Center,
  Chip,
  CopyButton,
  Group,
  Loader,
  Paper,
  ScrollArea,
  SegmentedControl,
  Stack,
  Table,
  Text,
  TextInput,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconAlertTriangle,
  IconBrain,
  IconBulb,
  IconCalendar,
  IconClipboardList,
  IconCopy,
  IconCurrencyLira,
  IconExclamationMark,
  IconFileText,
  IconInfoCircle,
  IconRefresh,
  IconSearch,
} from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';
import { tendersAPI } from '@/lib/api/services/tenders';
import type {
  AINote,
  AnalysisData,
  OnemliNot,
  SavedTender,
  TakvimItem,
  TeknikSart,
} from '../types';

// Helper: Teknik şart text'ini al (null-safe)
function getTeknikSartText(sart: string | TeknikSart | null | undefined): string {
  if (!sart) return '';
  if (typeof sart === 'string') return sart;
  if (typeof sart === 'object' && 'text' in sart) return sart.text || '';
  if (typeof sart === 'object' && 'madde' in sart) return (sart as { madde?: string }).madde || '';
  return String(sart);
}

// Helper: Teknik şart kaynak dökümanını al (null-safe)
function getTeknikSartSource(sart: string | TeknikSart | null | undefined): string | undefined {
  if (!sart || typeof sart !== 'object') return undefined;
  return (sart as TeknikSart).source;
}

// Helper: Not text'ini al (null-safe)
function getNoteText(not: string | AINote | null | undefined): string {
  if (!not) return '';
  if (typeof not === 'string') return not;
  if (typeof not === 'object' && 'text' in not) return not.text || '';
  return String(not);
}

// Helper: Not kaynak dökümanını al (null-safe)
function getNoteSource(not: string | AINote | null | undefined): string | undefined {
  if (!not || typeof not !== 'object') return undefined;
  return (not as AINote).source;
}

export function AnalysisSection({ tender }: { tender: SavedTender }) {
  const [activeAnalysisTab, setActiveAnalysisTab] = useState<string>('teknik');
  const [teknikSartArama, setTeknikSartArama] = useState('');
  const [birimFiyatArama, setBirimFiyatArama] = useState('');
  const [aiNotArama, setAiNotArama] = useState('');
  const [sadeceZorunluGoster, setSadeceZorunluGoster] = useState(false);

  // Detay verisi için state (tam metin vs)
  const [detailedAnalysis, setDetailedAnalysis] = useState<AnalysisData | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Detay verisini çek (tam metin için)
  const fetchDetails = useCallback(async () => {
    if (!tender.tender_id) return;

    setLoadingDetails(true);
    try {
      const response = await tendersAPI.getTrackingDetails(tender.tender_id);
      if (response.success && response.data?.analysis) {
        setDetailedAnalysis(response.data.analysis);
      }
    } catch (err) {
      console.error('Detay verisi alınamadı:', err);
    } finally {
      setLoadingDetails(false);
    }
  }, [tender.tender_id]);

  // İlk yüklemede detay verisini çek
  useEffect(() => {
    // Eğer analysis_summary'de tam_metin yoksa detay verisini çek
    if (!tender.analysis_summary?.tam_metin && tender.tender_id) {
      fetchDetails();
    }
  }, [tender.tender_id, tender.analysis_summary?.tam_metin, fetchDetails]);

  // Verileri birleştir (detaydan veya summary'den)
  const analysisData = detailedAnalysis || tender.analysis_summary;

  // Tüm teknik şartlar
  const allTeknikSartlar = analysisData?.teknik_sartlar || [];

  // Zorunlu şartlar
  const zorunluSartlar = allTeknikSartlar.filter((s) =>
    /zorunlu|mecburi|şart|gerekli|mutlaka/i.test(getTeknikSartText(s))
  );

  // Filtrelenmiş teknik şartlar
  const filteredTeknikSartlar = allTeknikSartlar.filter((sart) => {
    const text = getTeknikSartText(sart);
    const matchesSearch = text.toLowerCase().includes(teknikSartArama.toLowerCase());
    const matchesZorunlu =
      !sadeceZorunluGoster || /zorunlu|mecburi|şart|gerekli|mutlaka/i.test(text);
    return matchesSearch && matchesZorunlu;
  });

  // Filtrelenmiş birim fiyatlar
  const filteredBirimFiyatlar =
    analysisData?.birim_fiyatlar?.filter((item) =>
      (item.kalem || item.aciklama || item.text || '')
        .toLowerCase()
        .includes(birimFiyatArama.toLowerCase())
    ) || [];

  // AI Notları
  const allNotlar = analysisData?.notlar || [];
  const filteredNotlar = allNotlar.filter((not) =>
    getNoteText(not).toLowerCase().includes(aiNotArama.toLowerCase())
  );

  // Tam Metin
  const tamMetin = analysisData?.tam_metin || '';

  // Analiz yoksa mesaj - hem sayıları hem de analysis_summary içeriğini kontrol et
  const hasAnyAnalysis =
    (tender.teknik_sart_sayisi || 0) > 0 ||
    (tender.birim_fiyat_sayisi || 0) > 0 ||
    allTeknikSartlar.length > 0 ||
    (analysisData?.birim_fiyatlar?.length || 0) > 0 ||
    allNotlar.length > 0;

  if (!hasAnyAnalysis) {
    return (
      <Paper p="xl" withBorder radius="md" ta="center">
        <ThemeIcon size="xl" variant="light" color="gray" radius="xl" mb="md">
          <IconBrain size={28} />
        </ThemeIcon>
        <Text size="lg" fw={600} mb="xs">
          Henüz analiz yapılmamış
        </Text>
        <Text size="sm" c="dimmed" mb="md">
          Dökümanlar sekmesinden dökümanları indirip AI ile analiz edin.
        </Text>
      </Paper>
    );
  }

  return (
    <Stack gap="md">
      {/* Alt Sekmeler */}
      <SegmentedControl
        value={activeAnalysisTab}
        onChange={setActiveAnalysisTab}
        data={[
          {
            value: 'teknik',
            label: (
              <Group gap={4}>
                <IconClipboardList size={14} />
                <span>Teknik Şartlar</span>
                <Badge size="xs" variant="filled" color="blue">
                  {tender.teknik_sart_sayisi}
                </Badge>
              </Group>
            ),
          },
          {
            value: 'birim',
            label: (
              <Group gap={4}>
                <IconCurrencyLira size={14} />
                <span>Birim Fiyatlar</span>
                <Badge size="xs" variant="filled" color="green">
                  {tender.birim_fiyat_sayisi}
                </Badge>
              </Group>
            ),
          },
          ...((analysisData?.takvim?.length || 0) > 0
            ? [
                {
                  value: 'takvim',
                  label: (
                    <Group gap={4}>
                      <IconCalendar size={14} />
                      <span>Takvim</span>
                      <Badge size="xs" variant="filled" color="cyan">
                        {analysisData?.takvim?.length || 0}
                      </Badge>
                    </Group>
                  ),
                },
              ]
            : []),
          ...((analysisData?.onemli_notlar?.length || 0) > 0
            ? [
                {
                  value: 'onemli',
                  label: (
                    <Group gap={4}>
                      <IconAlertCircle size={14} />
                      <span>Önemli Notlar</span>
                      <Badge size="xs" variant="filled" color="orange">
                        {analysisData?.onemli_notlar?.length || 0}
                      </Badge>
                    </Group>
                  ),
                },
              ]
            : []),
          ...(allNotlar.length > 0
            ? [
                {
                  value: 'notlar',
                  label: (
                    <Group gap={4}>
                      <IconBulb size={14} />
                      <span>AI Notları</span>
                      <Badge size="xs" variant="filled" color="violet">
                        {allNotlar.length}
                      </Badge>
                    </Group>
                  ),
                },
              ]
            : []),
          {
            value: 'metin',
            label: (
              <Group gap={4}>
                <IconFileText size={14} />
                <span>Tam Metin</span>
                {loadingDetails && <Loader size={10} />}
              </Group>
            ),
          },
        ]}
        size="xs"
        fullWidth
      />

      {/* Teknik Şartlar Tab */}
      {activeAnalysisTab === 'teknik' && (
        <Stack gap="xs">
          {/* Arama ve Filtreler */}
          <Group gap="xs">
            <TextInput
              placeholder="Teknik şartlarda ara..."
              leftSection={<IconSearch size={14} />}
              value={teknikSartArama}
              onChange={(e) => setTeknikSartArama(e.target.value)}
              size="xs"
              style={{ flex: 1 }}
            />
            <Chip
              checked={sadeceZorunluGoster}
              onChange={() => setSadeceZorunluGoster(!sadeceZorunluGoster)}
              color="red"
              variant="filled"
              size="xs"
            >
              Zorunlu ({zorunluSartlar.length})
            </Chip>
          </Group>

          {/* Liste */}
          <ScrollArea h={320}>
            <Stack gap={4}>
              {filteredTeknikSartlar.length === 0 ? (
                <Paper p="md" withBorder radius="md" ta="center">
                  <Text size="sm" c="dimmed">
                    {teknikSartArama || sadeceZorunluGoster
                      ? 'Sonuç bulunamadı'
                      : 'Henüz teknik şart yok'}
                  </Text>
                </Paper>
              ) : (
                filteredTeknikSartlar.map((sart, idx) => {
                  const text = getTeknikSartText(sart);
                  const source = getTeknikSartSource(sart);
                  const onem =
                    typeof sart === 'object' && sart !== null && 'onem' in sart
                      ? (sart as { onem?: string }).onem
                      : undefined;
                  const isZorunlu =
                    onem === 'kritik' || /zorunlu|mecburi|şart|gerekli|mutlaka/i.test(text);

                  return (
                    <Paper
                      key={`ts-${idx}-${text.substring(0, 20)}`}
                      p="xs"
                      withBorder
                      radius="sm"
                      style={{
                        background: isZorunlu
                          ? 'rgba(239, 68, 68, 0.05)'
                          : 'rgba(59, 130, 246, 0.03)',
                        borderLeft: isZorunlu ? '3px solid var(--mantine-color-red-5)' : undefined,
                      }}
                    >
                      <Group justify="space-between" wrap="nowrap">
                        <Group gap="xs" style={{ flex: 1, minWidth: 0 }}>
                          <Badge
                            size="xs"
                            variant="filled"
                            color={isZorunlu ? 'red' : 'blue'}
                            circle
                          >
                            {idx + 1}
                          </Badge>
                          <Box style={{ flex: 1, minWidth: 0 }}>
                            <Group gap={4} wrap="nowrap">
                              <Text size="xs" style={{ flex: 1 }}>{text}</Text>
                              {onem && (
                                <Badge
                                  size="xs"
                                  variant="light"
                                  color={onem === 'kritik' ? 'red' : onem === 'normal' ? 'blue' : 'gray'}
                                  style={{ flexShrink: 0 }}
                                >
                                  {onem === 'kritik' ? 'Kritik' : onem === 'normal' ? 'Normal' : onem}
                                </Badge>
                              )}
                            </Group>
                            {source && (
                              <Text size="xs" c="dimmed" fs="italic">
                                Kaynak: {source}
                              </Text>
                            )}
                          </Box>
                        </Group>
                        <CopyButton value={text}>
                          {({ copied, copy }) => (
                            <Tooltip label={copied ? 'Kopyalandı!' : 'Kopyala'}>
                              <ActionIcon
                                size="xs"
                                variant="subtle"
                                color={copied ? 'green' : 'gray'}
                                onClick={copy}
                              >
                                <IconCopy size={12} />
                              </ActionIcon>
                            </Tooltip>
                          )}
                        </CopyButton>
                      </Group>
                    </Paper>
                  );
                })
              )}
            </Stack>
          </ScrollArea>

          {/* Toplam */}
          <Group justify="space-between">
            <Group gap="xs">
              <Badge variant="light" color="red" size="sm">
                {zorunluSartlar.length} Zorunlu
              </Badge>
              <Badge variant="light" color="blue" size="sm">
                {tender.teknik_sart_sayisi} Toplam
              </Badge>
            </Group>
            <CopyButton value={filteredTeknikSartlar.map((s) => getTeknikSartText(s)).join('\n')}>
              {({ copied, copy }) => (
                <Button
                  size="xs"
                  variant="light"
                  color={copied ? 'green' : 'blue'}
                  onClick={copy}
                  leftSection={<IconCopy size={12} />}
                >
                  {copied ? 'Kopyalandı!' : 'Tümünü Kopyala'}
                </Button>
              )}
            </CopyButton>
          </Group>
        </Stack>
      )}

      {/* Birim Fiyatlar Tab */}
      {activeAnalysisTab === 'birim' && (
        <Stack gap="xs">
          {/* Arama */}
          <TextInput
            placeholder="Birim fiyatlarda ara..."
            leftSection={<IconSearch size={14} />}
            value={birimFiyatArama}
            onChange={(e) => setBirimFiyatArama(e.target.value)}
            size="xs"
          />

          {/* Tablo */}
          <ScrollArea h={350}>
            {filteredBirimFiyatlar.length === 0 ? (
              <Paper p="md" withBorder radius="md" ta="center">
                <Text size="sm" c="dimmed">
                  {birimFiyatArama ? 'Sonuç bulunamadı' : 'Henüz birim fiyat yok'}
                </Text>
              </Paper>
            ) : (
              <Table striped highlightOnHover withTableBorder withColumnBorders>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th style={{ width: 40 }}>#</Table.Th>
                    <Table.Th>Tanım</Table.Th>
                    <Table.Th style={{ width: 70 }}>Miktar</Table.Th>
                    <Table.Th style={{ width: 70 }}>Birim</Table.Th>
                    <Table.Th style={{ width: 100, textAlign: 'right' }}>Fiyat</Table.Th>
                    <Table.Th style={{ width: 40 }} />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {filteredBirimFiyatlar.map((item, idx) => (
                    <Table.Tr key={`bf-${idx}-${item.id || item.kalem?.substring(0, 10) || idx}`}>
                      <Table.Td>
                        <Badge size="xs" variant="filled" color="green" circle>
                          {idx + 1}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs">
                          {item.kalem || item.aciklama || item.text || 'Bilinmiyor'}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" ta="center">
                          {item.miktar || '-'}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge size="xs" variant="outline" color="gray">
                          {item.birim || '-'}
                        </Badge>
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        <Text size="xs" fw={600} c="green">
                          {item.fiyat || item.tutar
                            ? `${Number(item.fiyat || item.tutar).toLocaleString('tr-TR')} ₺`
                            : '-'}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <CopyButton
                          value={`${item.kalem || item.aciklama || item.text || ''}\t${item.miktar || ''}\t${item.birim || ''}\t${item.fiyat || item.tutar || ''}`}
                        >
                          {({ copied, copy }) => (
                            <Tooltip label={copied ? 'Kopyalandı!' : 'Kopyala'}>
                              <ActionIcon
                                size="xs"
                                variant="subtle"
                                color={copied ? 'green' : 'gray'}
                                onClick={copy}
                              >
                                <IconCopy size={12} />
                              </ActionIcon>
                            </Tooltip>
                          )}
                        </CopyButton>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </ScrollArea>

          {/* Toplam */}
          <Group justify="space-between">
            <Text size="xs" c="dimmed">
              {birimFiyatArama
                ? `${filteredBirimFiyatlar.length} / ${tender.birim_fiyat_sayisi} sonuç`
                : `Toplam: ${tender.birim_fiyat_sayisi} birim fiyat`}
            </Text>
            <CopyButton
              value={filteredBirimFiyatlar
                .map(
                  (i) =>
                    `${i.kalem || i.aciklama || i.text || ''}\t${i.miktar || ''}\t${i.birim || ''}\t${i.fiyat || i.tutar || ''}`
                )
                .join('\n')}
            >
              {({ copied, copy }) => (
                <Button
                  size="xs"
                  variant="light"
                  color={copied ? 'green' : 'blue'}
                  onClick={copy}
                  leftSection={<IconCopy size={12} />}
                >
                  {copied ? 'Kopyalandı!' : 'Tümünü Kopyala'}
                </Button>
              )}
            </CopyButton>
          </Group>
        </Stack>
      )}

      {/* Takvim Tab */}
      {activeAnalysisTab === 'takvim' && (
        <Stack gap="xs">
          <ScrollArea h={350}>
            {analysisData?.takvim && analysisData.takvim.length > 0 ? (
              <Stack gap="xs">
                {analysisData.takvim.map((item) => {
                  const takvimItem = item as TakvimItem;
                  return (
                    <Paper
                      key={`takvim-${takvimItem.olay}-${takvimItem.tarih}`}
                      p="sm"
                      withBorder
                      radius="sm"
                      style={{
                        background: 'rgba(6, 182, 212, 0.05)',
                        borderLeft: '3px solid var(--mantine-color-cyan-5)',
                      }}
                    >
                      <Group justify="space-between" wrap="nowrap">
                        <Group gap="sm" style={{ flex: 1, minWidth: 0 }}>
                          <ThemeIcon size="md" variant="light" color="cyan" radius="xl">
                            <IconCalendar size={14} />
                          </ThemeIcon>
                          <Box style={{ flex: 1, minWidth: 0 }}>
                            <Text size="sm" fw={500}>
                              {takvimItem.olay}
                            </Text>
                            <Group gap="xs" mt={4}>
                              <Badge size="sm" variant="filled" color="cyan">
                                {takvimItem.tarih}
                              </Badge>
                              {takvimItem.gun && (
                                <Badge size="sm" variant="outline" color="cyan">
                                  {takvimItem.gun} gün
                                </Badge>
                              )}
                            </Group>
                          </Box>
                        </Group>
                        <CopyButton value={`${takvimItem.olay}: ${takvimItem.tarih}`}>
                          {({ copied, copy }) => (
                            <Tooltip label={copied ? 'Kopyalandı!' : 'Kopyala'}>
                              <ActionIcon
                                size="xs"
                                variant="subtle"
                                color={copied ? 'green' : 'gray'}
                                onClick={copy}
                              >
                                <IconCopy size={12} />
                              </ActionIcon>
                            </Tooltip>
                          )}
                        </CopyButton>
                      </Group>
                    </Paper>
                  );
                })}
              </Stack>
            ) : (
              <Paper p="md" withBorder radius="md" ta="center">
                <Text size="sm" c="dimmed">
                  Takvim bilgisi bulunamadı
                </Text>
              </Paper>
            )}
          </ScrollArea>
        </Stack>
      )}

      {/* Önemli Notlar Tab */}
      {activeAnalysisTab === 'onemli' && (
        <Stack gap="xs">
          <ScrollArea h={350}>
            {analysisData?.onemli_notlar && analysisData.onemli_notlar.length > 0 ? (
              <Stack gap="xs">
                {analysisData.onemli_notlar.map((not) => {
                  const notItem =
                    typeof not === 'string' ? { not, tur: 'bilgi' as const } : (not as OnemliNot);
                  const turColor =
                    notItem.tur === 'uyari'
                      ? 'red'
                      : notItem.tur === 'gereklilik'
                        ? 'blue'
                        : 'gray';
                  const turLabel =
                    notItem.tur === 'uyari'
                      ? 'Uyarı'
                      : notItem.tur === 'gereklilik'
                        ? 'Gereklilik'
                        : 'Bilgi';
                  const TurIcon =
                    notItem.tur === 'uyari'
                      ? IconAlertTriangle
                      : notItem.tur === 'gereklilik'
                        ? IconExclamationMark
                        : IconInfoCircle;

                  return (
                    <Paper
                      key={`onemli-${notItem.not.substring(0, 30)}-${notItem.tur}`}
                      p="sm"
                      withBorder
                      radius="sm"
                      style={{
                        background:
                          notItem.tur === 'uyari'
                            ? 'rgba(239, 68, 68, 0.05)'
                            : notItem.tur === 'gereklilik'
                              ? 'rgba(59, 130, 246, 0.05)'
                              : 'rgba(107, 114, 128, 0.05)',
                        borderLeft: `3px solid var(--mantine-color-${turColor}-5)`,
                      }}
                    >
                      <Group justify="space-between" wrap="nowrap" align="flex-start">
                        <Group gap="sm" style={{ flex: 1, minWidth: 0 }} align="flex-start">
                          <ThemeIcon size="md" variant="light" color={turColor} radius="xl">
                            <TurIcon size={14} />
                          </ThemeIcon>
                          <Box style={{ flex: 1, minWidth: 0 }}>
                            <Group gap="xs" mb={4}>
                              <Badge size="xs" variant="filled" color={turColor}>
                                {turLabel}
                              </Badge>
                            </Group>
                            <Text size="sm">{notItem.not}</Text>
                          </Box>
                        </Group>
                        <CopyButton value={notItem.not}>
                          {({ copied, copy }) => (
                            <Tooltip label={copied ? 'Kopyalandı!' : 'Kopyala'}>
                              <ActionIcon
                                size="xs"
                                variant="subtle"
                                color={copied ? 'green' : 'gray'}
                                onClick={copy}
                              >
                                <IconCopy size={12} />
                              </ActionIcon>
                            </Tooltip>
                          )}
                        </CopyButton>
                      </Group>
                    </Paper>
                  );
                })}
              </Stack>
            ) : (
              <Paper p="md" withBorder radius="md" ta="center">
                <Text size="sm" c="dimmed">
                  Önemli not bulunamadı
                </Text>
              </Paper>
            )}
          </ScrollArea>
        </Stack>
      )}

      {/* AI Notları Tab */}
      {activeAnalysisTab === 'notlar' && (
        <Stack gap="xs">
          {/* Arama */}
          <TextInput
            placeholder="Notlarda ara..."
            leftSection={<IconSearch size={14} />}
            value={aiNotArama}
            onChange={(e) => setAiNotArama(e.target.value)}
            size="xs"
          />

          {/* Liste */}
          <ScrollArea h={350}>
            <Stack gap={4}>
              {filteredNotlar.length === 0 ? (
                <Paper p="md" withBorder radius="md" ta="center">
                  <Text size="sm" c="dimmed">
                    {aiNotArama ? 'Sonuç bulunamadı' : 'Henüz AI notu yok'}
                  </Text>
                </Paper>
              ) : (
                filteredNotlar.map((not, idx) => {
                  const text = getNoteText(not);
                  const source = getNoteSource(not);

                  return (
                    <Paper
                      key={`note-${idx}-${text.substring(0, 20)}`}
                      p="sm"
                      withBorder
                      radius="sm"
                      style={{
                        background: 'rgba(234, 179, 8, 0.05)',
                        borderLeft: '3px solid var(--mantine-color-yellow-5)',
                      }}
                    >
                      <Group justify="space-between" wrap="nowrap" align="flex-start">
                        <Group gap="xs" style={{ flex: 1, minWidth: 0 }} align="flex-start">
                          <ThemeIcon size="sm" variant="light" color="orange" radius="xl">
                            <IconBulb size={12} />
                          </ThemeIcon>
                          <Box style={{ flex: 1, minWidth: 0 }}>
                            <Text size="xs">{text}</Text>
                            {source && (
                              <Text size="xs" c="dimmed" fs="italic" mt={4}>
                                Kaynak: {source}
                              </Text>
                            )}
                          </Box>
                        </Group>
                        <CopyButton value={text}>
                          {({ copied, copy }) => (
                            <Tooltip label={copied ? 'Kopyalandı!' : 'Kopyala'}>
                              <ActionIcon
                                size="xs"
                                variant="subtle"
                                color={copied ? 'green' : 'gray'}
                                onClick={copy}
                              >
                                <IconCopy size={12} />
                              </ActionIcon>
                            </Tooltip>
                          )}
                        </CopyButton>
                      </Group>
                    </Paper>
                  );
                })
              )}
            </Stack>
          </ScrollArea>

          {/* Toplam */}
          <Group justify="space-between">
            <Text size="xs" c="dimmed">
              {aiNotArama
                ? `${filteredNotlar.length} / ${allNotlar.length} sonuç`
                : `Toplam: ${allNotlar.length} AI notu`}
            </Text>
            <CopyButton value={filteredNotlar.map((n) => getNoteText(n)).join('\n\n')}>
              {({ copied, copy }) => (
                <Button
                  size="xs"
                  variant="light"
                  color={copied ? 'green' : 'yellow'}
                  onClick={copy}
                  leftSection={<IconCopy size={12} />}
                >
                  {copied ? 'Kopyalandı!' : 'Tümünü Kopyala'}
                </Button>
              )}
            </CopyButton>
          </Group>
        </Stack>
      )}

      {/* Tam Metin Tab */}
      {activeAnalysisTab === 'metin' && (
        <Stack gap="xs">
          <Paper p="sm" withBorder radius="md">
            <Group justify="space-between" mb="xs">
              <Text size="sm" fw={600}>
                Dökümanlardan Çıkarılan Tam Metin
              </Text>
              <Group gap="xs">
                <Tooltip label="Yenile">
                  <ActionIcon
                    size="sm"
                    variant="light"
                    color="gray"
                    onClick={fetchDetails}
                    loading={loadingDetails}
                  >
                    <IconRefresh size={14} />
                  </ActionIcon>
                </Tooltip>
                <CopyButton value={tamMetin}>
                  {({ copied, copy }) => (
                    <Button
                      size="xs"
                      variant="light"
                      color={copied ? 'green' : 'blue'}
                      onClick={copy}
                      leftSection={<IconCopy size={12} />}
                      disabled={!tamMetin}
                    >
                      {copied ? 'Kopyalandı!' : 'Kopyala'}
                    </Button>
                  )}
                </CopyButton>
              </Group>
            </Group>
            <ScrollArea h={350}>
              {loadingDetails ? (
                <Center h={200}>
                  <Loader size="sm" />
                </Center>
              ) : tamMetin ? (
                <Text size="xs" style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                  {tamMetin}
                </Text>
              ) : (
                <Center h={200}>
                  <Stack align="center" gap="xs">
                    <ThemeIcon size="lg" variant="light" color="gray" radius="xl">
                      <IconFileText size={20} />
                    </ThemeIcon>
                    <Text size="sm" c="dimmed" ta="center">
                      Tam metin bulunamadı.
                    </Text>
                    <Text size="xs" c="dimmed" ta="center">
                      Dökümanlar analiz edildiğinde burada tam metin görüntülenecek.
                    </Text>
                    <Button
                      size="xs"
                      variant="light"
                      onClick={fetchDetails}
                      leftSection={<IconRefresh size={12} />}
                    >
                      Yeniden Dene
                    </Button>
                  </Stack>
                </Center>
              )}
            </ScrollArea>
          </Paper>
          {tamMetin && (
            <Text size="xs" c="dimmed">
              Toplam: {tamMetin.length.toLocaleString('tr-TR')} karakter
            </Text>
          )}
        </Stack>
      )}
    </Stack>
  );
}
