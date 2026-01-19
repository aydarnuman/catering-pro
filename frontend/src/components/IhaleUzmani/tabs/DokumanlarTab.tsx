'use client';

import {
  ActionIcon,
  Badge,
  Button,
  Center,
  Chip,
  Group,
  Paper,
  ScrollArea,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconBulb,
  IconClipboardCopy,
  IconClipboardList,
  IconCoin,
  IconCopy,
  IconSearch,
  IconSettings,
} from '@tabler/icons-react';
import { useState } from 'react';
import { AnalysisData, ClipboardItem } from '../types';

interface DokumanlarTabProps {
  analysisData: AnalysisData;
  addToClipboard: (
    type: ClipboardItem['type'],
    content: string,
    source: string,
    metadata?: ClipboardItem['metadata']
  ) => void;
}

export function DokumanlarTab({ analysisData, addToClipboard }: DokumanlarTabProps) {
  // Internal states for filtering
  const [teknikSartArama, setTeknikSartArama] = useState('');
  const [sadeceZorunluGoster, setSadeceZorunluGoster] = useState(false);
  const [birimFiyatArama, setBirimFiyatArama] = useState('');
  const [aiNotArama, setAiNotArama] = useState('');

  return (
    <Tabs defaultValue="teknik" variant="pills" radius="md">
      <Tabs.List mb="lg" style={{ gap: 6 }}>
        <Tabs.Tab
          value="teknik"
          leftSection={<IconSettings size={14} />}
          style={{ fontWeight: 500 }}
        >
          Teknik Şartlar
          <Badge size="xs" variant="filled" color="blue" ml={6}>
            {analysisData.teknik_sartlar?.length || 0}
          </Badge>
        </Tabs.Tab>
        <Tabs.Tab
          value="fiyat"
          leftSection={<IconCoin size={14} />}
          style={{ fontWeight: 500 }}
        >
          Birim Fiyatlar
          <Badge size="xs" variant="filled" color="green" ml={6}>
            {analysisData.birim_fiyatlar?.length || 0}
          </Badge>
        </Tabs.Tab>
        <Tabs.Tab
          value="ainotlar"
          leftSection={<IconBulb size={14} />}
          style={{ fontWeight: 500 }}
        >
          AI Notları
          <Badge
            size="xs"
            variant="gradient"
            gradient={{ from: 'orange', to: 'yellow' }}
            ml={6}
          >
            {analysisData.notlar?.length || 0}
          </Badge>
        </Tabs.Tab>
        <Tabs.Tab
          value="metin"
          leftSection={<IconClipboardList size={14} />}
          style={{ fontWeight: 500 }}
        >
          Tam Metin
        </Tabs.Tab>
      </Tabs.List>

      {/* TEKNİK ŞARTLAR */}
      <Tabs.Panel value="teknik">
        {/* Arama ve Filtreleme Toolbar */}
        <Paper p="sm" mb="md" radius="md" withBorder bg="gray.0">
          <Group gap="md" justify="space-between">
            <Group gap="sm" style={{ flex: 1 }}>
              <TextInput
                placeholder="Şartlarda ara..."
                leftSection={<IconSearch size={16} />}
                value={teknikSartArama}
                onChange={(e) => setTeknikSartArama(e.target.value)}
                size="sm"
                style={{ flex: 1, maxWidth: 300 }}
                styles={{ input: { borderRadius: 20 } }}
              />
              <Chip
                checked={sadeceZorunluGoster}
                onChange={() => setSadeceZorunluGoster(!sadeceZorunluGoster)}
                color="red"
                variant="filled"
                size="sm"
              >
                Sadece Zorunlu
              </Chip>
            </Group>
            <Group gap="xs">
              {(() => {
                const zorunluSayisi = analysisData.teknik_sartlar?.filter(s => /zorunlu|mecburi|şart|gerekli|mutlaka/i.test(s)).length || 0;
                return (
                  <>
                    <Badge variant="light" color="red" size="sm">
                      {zorunluSayisi} Zorunlu
                    </Badge>
                    <Badge variant="light" color="blue" size="sm">
                      {analysisData.teknik_sartlar?.length || 0} Toplam
                    </Badge>
                  </>
                );
              })()}
            </Group>
          </Group>
        </Paper>

        <ScrollArea h="calc(100vh - 340px)" offsetScrollbars>
          {analysisData.teknik_sartlar && analysisData.teknik_sartlar.length > 0 ? (
            <Stack gap="xs">
              {analysisData.teknik_sartlar
                .map((sart, originalIndex) => ({ sart, originalIndex }))
                .filter(({ sart }) => {
                  if (teknikSartArama && !sart.toLowerCase().includes(teknikSartArama.toLowerCase())) {
                    return false;
                  }
                  if (sadeceZorunluGoster && !/zorunlu|mecburi|şart|gerekli|mutlaka/i.test(sart)) {
                    return false;
                  }
                  return true;
                })
                .map(({ sart, originalIndex }) => {
                  const isImportant = /zorunlu|mecburi|şart|gerekli|mutlaka/i.test(sart);
                  const isWarning = /dikkat|uyarı|önemli|not:|ödeme/i.test(sart);
                  const borderColor = isImportant 
                    ? 'var(--mantine-color-red-4)' 
                    : isWarning 
                      ? 'var(--mantine-color-orange-4)' 
                      : 'var(--mantine-color-gray-3)';
                  const bgColor = isImportant 
                    ? 'rgba(254, 226, 226, 0.3)' 
                    : isWarning 
                      ? 'rgba(255, 237, 213, 0.3)' 
                      : 'white';
                  const iconColor = isImportant ? 'red' : isWarning ? 'orange' : 'blue';

                  return (
                    <Paper
                      key={originalIndex}
                      p="sm"
                      radius="md"
                      withBorder
                      style={{
                        borderColor,
                        background: bgColor,
                        borderLeftWidth: 4,
                        transition: 'all 0.2s ease',
                        cursor: 'default',
                      }}
                      className="teknik-sart-item"
                    >
                      <Group gap="sm" wrap="nowrap" align="flex-start">
                        <Badge
                          size="lg"
                          variant="gradient"
                          gradient={{
                            from: iconColor,
                            to: iconColor === 'red' ? 'pink' : iconColor === 'orange' ? 'yellow' : 'cyan',
                          }}
                          circle
                          style={{ minWidth: 32, minHeight: 32, fontSize: 12, flexShrink: 0 }}
                        >
                          {originalIndex + 1}
                        </Badge>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Text size="sm" fw={isImportant ? 600 : 500} style={{ lineHeight: 1.5 }}>
                            {sart}
                          </Text>
                          {isImportant && (
                            <Badge size="xs" color="red" variant="light" mt={6}>
                              ZORUNLU ŞART
                            </Badge>
                          )}
                        </div>
                        <Group gap={4}>
                          <Tooltip label="Panoya Ekle" position="left">
                            <ActionIcon 
                              variant="light" 
                              color="orange" 
                              size="sm"
                              onClick={() => addToClipboard(
                                'teknik',
                                sart,
                                `Teknik Şart #${originalIndex + 1}`,
                                { itemIndex: originalIndex + 1, isZorunlu: isImportant }
                              )}
                            >
                              <IconClipboardCopy size={14} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Kopyala" position="left">
                            <ActionIcon 
                              variant="subtle" 
                              color="gray" 
                              size="sm"
                              onClick={() => {
                                navigator.clipboard.writeText(sart);
                                notifications.show({
                                  message: 'Kopyalandı',
                                  color: 'green',
                                  autoClose: 1500,
                                });
                              }}
                            >
                              <IconCopy size={14} />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      </Group>
                    </Paper>
                  );
                })}
              {/* Filtreleme sonucu boş mesajı */}
              {analysisData.teknik_sartlar.filter(sart => {
                if (teknikSartArama && !sart.toLowerCase().includes(teknikSartArama.toLowerCase())) return false;
                if (sadeceZorunluGoster && !/zorunlu|mecburi|şart|gerekli|mutlaka/i.test(sart)) return false;
                return true;
              }).length === 0 && (
                <Center py="xl">
                  <Stack align="center" gap="sm">
                    <ThemeIcon size={60} variant="light" color="gray" radius="xl">
                      <IconSearch size={30} />
                    </ThemeIcon>
                    <Text c="dimmed">Filtreye uygun şart bulunamadı</Text>
                    <Button 
                      variant="light" 
                      size="xs" 
                      onClick={() => { setTeknikSartArama(''); setSadeceZorunluGoster(false); }}
                    >
                      Filtreleri Temizle
                    </Button>
                  </Stack>
                </Center>
              )}
            </Stack>
          ) : (
            <Center h={300}>
              <Stack align="center" gap="md">
                <ThemeIcon
                  size={80}
                  radius="xl"
                  variant="gradient"
                  gradient={{ from: 'gray', to: 'dark' }}
                >
                  <IconClipboardList size={40} />
                </ThemeIcon>
                <Text c="dimmed" size="lg">
                  Teknik şart bulunamadı
                </Text>
                <Text c="dimmed" size="sm">
                  Döküman analizi yapıldığında burada görünecek
                </Text>
              </Stack>
            </Center>
          )}
        </ScrollArea>
      </Tabs.Panel>

      {/* BİRİM FİYATLAR */}
      <Tabs.Panel value="fiyat">
        <Paper p="sm" mb="md" radius="md" withBorder bg="gray.0">
          <Group gap="md" justify="space-between">
            <TextInput
              placeholder="Kalemlerde ara..."
              leftSection={<IconSearch size={16} />}
              value={birimFiyatArama}
              onChange={(e) => setBirimFiyatArama(e.target.value)}
              size="sm"
              style={{ flex: 1, maxWidth: 300 }}
              styles={{ input: { borderRadius: 20 } }}
            />
            <Group gap="sm">
              {(() => {
                const fiyatliKalemler = analysisData.birim_fiyatlar?.filter((item: any) => {
                  const fiyat = typeof item === 'object' ? (item.fiyat || item.tutar) : null;
                  return fiyat && fiyat !== '-' && fiyat !== 'BELİRTİLMEMİŞ';
                }).length || 0;
                return (
                  <>
                    <Badge variant="filled" color="green" size="sm">
                      {fiyatliKalemler} Fiyatlı
                    </Badge>
                    <Badge variant="light" color="gray" size="sm">
                      {(analysisData.birim_fiyatlar?.length || 0) - fiyatliKalemler} Belirsiz
                    </Badge>
                    <Badge variant="outline" color="blue" size="sm">
                      {analysisData.birim_fiyatlar?.length || 0} Toplam
                    </Badge>
                  </>
                );
              })()}
            </Group>
          </Group>
        </Paper>

        <ScrollArea h="calc(100vh - 340px)" offsetScrollbars>
          {analysisData.birim_fiyatlar && analysisData.birim_fiyatlar.length > 0 ? (
            <Paper withBorder radius="md" style={{ overflow: 'hidden' }}>
              <Table striped highlightOnHover verticalSpacing="sm" horizontalSpacing="md">
                <Table.Thead style={{ 
                  position: 'sticky', 
                  top: 0, 
                  background: 'var(--mantine-color-blue-0)',
                  zIndex: 1,
                }}>
                  <Table.Tr>
                    <Table.Th w={50} style={{ fontWeight: 700 }}>#</Table.Th>
                    <Table.Th style={{ fontWeight: 700 }}>Kalem Açıklaması</Table.Th>
                    <Table.Th w={100} style={{ fontWeight: 700 }}>Birim</Table.Th>
                    <Table.Th w={140} style={{ fontWeight: 700 }}>Miktar</Table.Th>
                    <Table.Th w={140} ta="right" style={{ fontWeight: 700 }}>Fiyat</Table.Th>
                    <Table.Th w={40}></Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {analysisData.birim_fiyatlar
                    .filter((item: any) => {
                      if (!birimFiyatArama) return true;
                      const kalem = typeof item === 'object' ? (item.kalem || item.aciklama || '') : String(item);
                      return kalem.toLowerCase().includes(birimFiyatArama.toLowerCase());
                    })
                    .map((item: any, i: number) => {
                      const kalem = typeof item === 'object' ? item.kalem || item.aciklama || '-' : item;
                      const birim = typeof item === 'object' ? item.birim || '-' : '-';
                      const miktar = typeof item === 'object' ? item.miktar || '-' : '-';
                      const fiyat = typeof item === 'object' ? item.fiyat || item.tutar || null : null;
                      const hasFiyat = fiyat && fiyat !== '-' && fiyat !== 'BELİRTİLMEMİŞ';
                      
                      return (
                        <Table.Tr 
                          key={i}
                          style={{ 
                            background: hasFiyat ? 'rgba(64, 192, 87, 0.04)' : undefined,
                          }}
                        >
                          <Table.Td>
                            <Badge size="sm" variant="light" color="blue" radius="sm">
                              {i + 1}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm" fw={500} lineClamp={2}>
                              {kalem}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm" c="dimmed">{birim}</Text>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm" fw={500}>{miktar}</Text>
                          </Table.Td>
                          <Table.Td ta="right">
                            {hasFiyat ? (
                              <Badge color="green" variant="filled" size="md">
                                {fiyat}
                              </Badge>
                            ) : (
                              <Badge color="gray" variant="light" size="md">
                                {fiyat || '-'}
                              </Badge>
                            )}
                          </Table.Td>
                          <Table.Td>
                            <Tooltip label="Panoya Ekle" position="left">
                              <ActionIcon 
                                variant="light" 
                                color="orange" 
                                size="sm"
                                onClick={() => addToClipboard(
                                  'fiyat',
                                  `${kalem}: ${miktar} ${birim} - ${fiyat || 'Fiyat yok'}`,
                                  `Birim Fiyat #${i + 1}`,
                                  { value: parseFloat(fiyat) || 0, unit: birim }
                                )}
                              >
                                <IconClipboardCopy size={14} />
                              </ActionIcon>
                            </Tooltip>
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                </Table.Tbody>
              </Table>
              {/* Filtreleme sonucu boş */}
              {birimFiyatArama && analysisData.birim_fiyatlar.filter((item: any) => {
                const kalem = typeof item === 'object' ? (item.kalem || item.aciklama || '') : String(item);
                return kalem.toLowerCase().includes(birimFiyatArama.toLowerCase());
              }).length === 0 && (
                <Center py="xl">
                  <Stack align="center" gap="sm">
                    <Text c="dimmed">Arama sonucu bulunamadı</Text>
                    <Button variant="light" size="xs" onClick={() => setBirimFiyatArama('')}>
                      Aramayı Temizle
                    </Button>
                  </Stack>
                </Center>
              )}
            </Paper>
          ) : (
            <Center h={300}>
              <Stack align="center" gap="md">
                <ThemeIcon size={80} radius="xl" variant="gradient" gradient={{ from: 'green', to: 'teal' }}>
                  <IconCoin size={40} />
                </ThemeIcon>
                <Text c="dimmed" size="lg">Birim fiyat bulunamadı</Text>
                <Text c="dimmed" size="sm">Döküman analizi yapıldığında burada görünecek</Text>
              </Stack>
            </Center>
          )}
        </ScrollArea>
      </Tabs.Panel>

      {/* AI NOTLARI */}
      <Tabs.Panel value="ainotlar">
        <Paper p="sm" mb="md" radius="md" withBorder bg="orange.0" style={{ borderColor: 'var(--mantine-color-orange-3)' }}>
          <Group gap="md" justify="space-between">
            <Group gap="sm" style={{ flex: 1 }}>
              <TextInput
                placeholder="Notlarda ara..."
                leftSection={<IconSearch size={16} />}
                value={aiNotArama}
                onChange={(e) => setAiNotArama(e.target.value)}
                size="sm"
                style={{ flex: 1, maxWidth: 300 }}
                styles={{ input: { borderRadius: 20 } }}
              />
            </Group>
            <Group gap="xs">
              <ThemeIcon size="sm" variant="gradient" gradient={{ from: 'orange', to: 'yellow' }} radius="xl">
                <IconBulb size={12} />
              </ThemeIcon>
              <Text size="sm" fw={600} c="orange.7">
                {analysisData.notlar?.length || 0} AI İçgörü
              </Text>
            </Group>
          </Group>
        </Paper>

        <ScrollArea h="calc(100vh - 340px)" offsetScrollbars>
          {analysisData.notlar && analysisData.notlar.length > 0 ? (
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
              {analysisData.notlar
                .filter(not => {
                  if (!aiNotArama) return true;
                  return not.toLowerCase().includes(aiNotArama.toLowerCase());
                })
                .map((not, i) => {
                  const isNumeric = /\d+[\.,]?\d*\s*(tl|₺|adet|kişi|gün|ay|yıl)/i.test(not);
                  const isProcedure = /ihale|usul|yöntem|ekap|teklif|başvuru/i.test(not);
                  const isWarning = /dikkat|uyarı|önemli|risk|zorunlu/i.test(not);
                  
                  const bgColor = isWarning 
                    ? 'rgba(254, 226, 226, 0.4)' 
                    : isNumeric 
                      ? 'rgba(219, 234, 254, 0.4)'
                      : isProcedure
                        ? 'rgba(220, 252, 231, 0.4)'
                        : 'rgba(255, 237, 213, 0.5)';
                  const borderColor = isWarning 
                    ? 'var(--mantine-color-red-4)' 
                    : isNumeric 
                      ? 'var(--mantine-color-blue-4)'
                      : isProcedure
                        ? 'var(--mantine-color-green-4)'
                        : 'var(--mantine-color-orange-4)';

                  return (
                    <Paper
                      key={i}
                      p="sm"
                      radius="md"
                      style={{
                        borderLeft: `4px solid ${borderColor}`,
                        background: bgColor,
                        transition: 'all 0.2s ease',
                      }}
                      className="ai-note-compact"
                    >
                      <Group gap="sm" wrap="nowrap" align="flex-start">
                        <ThemeIcon
                          size={28}
                          radius="xl"
                          variant="light"
                          color={isWarning ? 'red' : isNumeric ? 'blue' : isProcedure ? 'green' : 'orange'}
                        >
                          <IconBulb size={14} />
                        </ThemeIcon>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Badge
                            size="xs"
                            variant="gradient"
                            gradient={{ 
                              from: isWarning ? 'red' : isNumeric ? 'blue' : isProcedure ? 'green' : 'orange', 
                              to: isWarning ? 'pink' : isNumeric ? 'cyan' : isProcedure ? 'teal' : 'yellow' 
                            }}
                            mb={6}
                          >
                            {isWarning ? '⚠️ Dikkat' : isNumeric ? '📊 Rakamsal' : isProcedure ? '⚖️ Prosedür' : `💡 İçgörü #${i + 1}`}
                          </Badge>
                          <Text size="sm" style={{ lineHeight: 1.5 }}>
                            {not}
                          </Text>
                        </div>
                        <Tooltip label="Panoya Ekle" position="left">
                          <ActionIcon 
                            variant="light" 
                            color="orange" 
                            size="sm"
                            onClick={() => addToClipboard(
                              'ai',
                              not,
                              `AI Notu #${i + 1}`
                            )}
                          >
                            <IconClipboardCopy size={14} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Paper>
                  );
                })}
              {/* Arama sonucu boş */}
              {aiNotArama && analysisData.notlar.filter(not => 
                not.toLowerCase().includes(aiNotArama.toLowerCase())
              ).length === 0 && (
                <Center py="xl" style={{ gridColumn: '1 / -1' }}>
                  <Stack align="center" gap="sm">
                    <Text c="dimmed">Arama sonucu bulunamadı</Text>
                    <Button variant="light" size="xs" color="orange" onClick={() => setAiNotArama('')}>
                      Aramayı Temizle
                    </Button>
                  </Stack>
                </Center>
              )}
            </SimpleGrid>
          ) : (
            <Center h={300}>
              <Stack align="center" gap="md">
                <ThemeIcon
                  size={80}
                  radius="xl"
                  variant="gradient"
                  gradient={{ from: 'orange', to: 'yellow' }}
                >
                  <IconBulb size={40} />
                </ThemeIcon>
                <Text c="dimmed" size="lg">
                  AI notu bulunamadı
                </Text>
                <Text c="dimmed" size="sm">
                  AI analizi yapıldığında notlar burada görünecek
                </Text>
              </Stack>
            </Center>
          )}
        </ScrollArea>
      </Tabs.Panel>

      {/* TAM METİN */}
      <Tabs.Panel value="metin">
        <ScrollArea h="calc(100vh - 280px)" offsetScrollbars>
          {analysisData.tam_metin ? (
            <Paper p="md" withBorder bg="gray.0">
              <Text size="sm" style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                {analysisData.tam_metin}
              </Text>
            </Paper>
          ) : (
            <Text c="dimmed" ta="center" py="xl">
              Tam metin bulunamadı
            </Text>
          )}
        </ScrollArea>
      </Tabs.Panel>
    </Tabs>
  );
}
