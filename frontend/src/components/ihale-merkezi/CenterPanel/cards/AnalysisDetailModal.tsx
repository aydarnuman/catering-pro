'use client';

import {
  ActionIcon,
  Badge,
  Box,
  Button,
  CopyButton,
  Divider,
  Group,
  List,
  Loader,
  Modal,
  ScrollArea,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  Textarea,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconAlertCircle,
  IconBrain,
  IconCheck,
  IconClipboard,
  IconCopy,
  IconEdit,
  IconExternalLink,
  IconFileText,
  IconList,
  IconListCheck,
  IconRobot,
  IconSparkles,
  IconTable,
  IconTableExport,
  IconTransform,
} from '@tabler/icons-react';
import { useCallback, useMemo, useState } from 'react';
import { type ContentType, detectContentType, splitContentToItems } from '../normalizeAnalysis';

// ─── Kart Tipi Tanimlari ────────────────────────────────────────

export type AnalysisCardType =
  | 'teknik_sartlar'
  | 'birim_fiyatlar'
  | 'onemli_notlar'
  | 'eksik_bilgiler'
  | 'takvim'
  | 'iletisim'
  | 'personel_detaylari'
  | 'ogun_bilgileri'
  | 'catering_detay'
  | 'is_yerleri'
  | 'mali_kriterler'
  | 'ceza_kosullari'
  | 'fiyat_farki'
  | 'gerekli_belgeler'
  | 'teminat_oranlari'
  | 'servis_saatleri'
  | 'gramaj_gruplari'
  | 'benzer_is_tanimi'
  | 'operasyonel_kurallar'
  | 'generic';

type DataRenderMode = 'list' | 'table' | 'key_value' | 'text' | 'auto';

function getDataRenderMode(cardType: AnalysisCardType): DataRenderMode {
  switch (cardType) {
    case 'teknik_sartlar':
    case 'onemli_notlar':
    case 'eksik_bilgiler':
    case 'is_yerleri':
    case 'gerekli_belgeler':
      return 'list';
    case 'birim_fiyatlar':
    case 'personel_detaylari':
    case 'ogun_bilgileri':
    case 'gramaj_gruplari':
    case 'takvim':
    case 'ceza_kosullari':
      return 'table';
    case 'iletisim':
    case 'mali_kriterler':
    case 'teminat_oranlari':
    case 'servis_saatleri':
    case 'fiyat_farki':
      return 'key_value';
    case 'benzer_is_tanimi':
      return 'text';
    default:
      return 'auto';
  }
}

// ─── Sayi Vurgulama ─────────────────────────────────────────────

function highlightNumbers(text: string): React.ReactNode {
  const parts = text.split(
    /(\d+[.,]?\d*\s*(?:adet|kişi|kisi|gr|g|kg|lt|ml|porsiyon|öğün|ogun|gün|gun|saat|dakika|metre|m²|m2|%)?)/gi
  );
  return parts.map((part) => {
    if (
      /^\d+[.,]?\d*\s*(?:adet|kişi|kisi|gr|g|kg|lt|ml|porsiyon|öğün|ogun|gün|gun|saat|dakika|metre|m²|m2|%)?$/i.test(
        part
      )
    ) {
      return (
        <Text key={`hl-${part}`} component="span" fw={700} c="blue">
          {part}
        </Text>
      );
    }
    return part;
  });
}

// ─── Veriyi String'e Donustur (kopyalama + AI icin) ─────────────

function dataToString(data: unknown, _cardType: AnalysisCardType): string {
  if (!data) return '';
  if (typeof data === 'string') return data;
  if (typeof data === 'number') return String(data);

  if (Array.isArray(data)) {
    return data
      .map((item, i) => {
        if (typeof item === 'string') return `${i + 1}. ${item}`;
        if (typeof item === 'object' && item !== null) {
          const obj = item as Record<string, unknown>;
          // Teknik sart
          if (obj.madde || obj.text || obj.description) return `${i + 1}. ${obj.madde || obj.text || obj.description}`;
          // Onemli not
          if (obj.not) return `${i + 1}. ${obj.not}`;
          // Birim fiyat
          if (obj.kalem)
            return `${obj.kalem}: ${obj.miktar || ''} ${obj.birim || ''} ${obj.fiyat ? `- ${obj.fiyat} TL` : ''}`;
          // Personel
          if (obj.pozisyon) return `${obj.pozisyon}: ${obj.adet || ''} kişi`;
          // Takvim
          if (obj.olay) return `${obj.olay}: ${obj.tarih || ''}`;
          // Ceza
          if (obj.tur && obj.oran) return `${obj.tur}: ${obj.oran}`;
          // Belge
          if (obj.belge) return `${obj.belge}${obj.zorunlu ? ' (zorunlu)' : ''}`;
          return JSON.stringify(item);
        }
        return String(item);
      })
      .join('\n');
  }

  if (typeof data === 'object' && data !== null) {
    return Object.entries(data as Record<string, unknown>)
      .filter(([, v]) => v != null && v !== '')
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n');
  }

  return String(data);
}

// ─── Icerik Tab: Akilli Render ──────────────────────────────────

function ContentTab({ data, cardType }: { data: unknown; cardType: AnalysisCardType }) {
  const renderMode = getDataRenderMode(cardType);

  // String veri -> otomatik tespit
  if (typeof data === 'string') {
    const ct = detectContentType(data);
    return <SmartStringRenderer value={data} contentType={ct} />;
  }

  // Array veri
  if (Array.isArray(data)) {
    if (renderMode === 'table') {
      return <ArrayTableRenderer items={data} cardType={cardType} />;
    }
    return <ArrayListRenderer items={data} cardType={cardType} />;
  }

  // Object veri (key-value)
  if (typeof data === 'object' && data !== null) {
    return <ObjectKeyValueRenderer obj={data as Record<string, unknown>} />;
  }

  // Fallback
  return (
    <Text size="sm" style={{ lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
      {String(data)}
    </Text>
  );
}

function SmartStringRenderer({ value, contentType }: { value: string; contentType: ContentType }) {
  if (contentType === 'list') {
    const items = splitContentToItems(value);
    return (
      <List
        spacing="xs"
        size="sm"
        icon={
          <ThemeIcon size={16} variant="light" color="blue" radius="xl">
            <IconList size={10} />
          </ThemeIcon>
        }
      >
        {items.map((item) => (
          <List.Item key={`sli-${item.slice(0, 30)}`}>
            <Text size="sm" style={{ lineHeight: 1.5 }}>
              {highlightNumbers(item)}
            </Text>
          </List.Item>
        ))}
      </List>
    );
  }
  if (contentType === 'table') {
    const lines = value.split(/\n/).filter((l) => l.trim());
    const rows = lines.map((line) => {
      if (line.includes('\t')) return line.split('\t').map((c) => c.trim());
      if (line.includes('|'))
        return line
          .split('|')
          .map((c) => c.trim())
          .filter(Boolean);
      return [line.trim()];
    });
    if (rows.length === 0) return null;
    const headers = rows[0];
    const dataRows = rows.slice(1);
    return (
      <Table striped highlightOnHover withTableBorder withColumnBorders fz="sm">
        <Table.Thead>
          <Table.Tr>
            {headers.map((h) => (
              <Table.Th key={`sth-${h.slice(0, 20)}`}>{h}</Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {dataRows.map((row) => (
            <Table.Tr key={`str-${(row[0] || '').slice(0, 15)}`}>
              {row.map((cell) => (
                <Table.Td key={`std-${cell.slice(0, 20)}`}>{highlightNumbers(cell)}</Table.Td>
              ))}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    );
  }
  // text
  const paragraphs = value.split(/\n\n+/).filter((p) => p.trim());
  return (
    <Stack gap="sm">
      {paragraphs.map((p) => (
        <Text key={`sp-${p.slice(0, 25)}`} size="sm" style={{ lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
          {highlightNumbers(p.trim())}
        </Text>
      ))}
    </Stack>
  );
}

function ArrayListRenderer({ items, cardType }: { items: unknown[]; cardType: AnalysisCardType }) {
  return (
    <Stack gap="xs">
      {items.map((item, i) => {
        const text = getItemDisplayText(item, cardType);
        const badge = getItemBadge(item, cardType);
        return (
          <Group key={`ali-${text.slice(0, 25)}-${i}`} gap="xs" wrap="nowrap" align="flex-start">
            <Badge size="xs" variant="filled" color="blue" circle style={{ flexShrink: 0, marginTop: 3 }}>
              {i + 1}
            </Badge>
            <Text size="sm" style={{ flex: 1, lineHeight: 1.5 }}>
              {highlightNumbers(text)}
            </Text>
            {badge && (
              <Badge size="xs" variant="light" color={badge.color} style={{ flexShrink: 0 }}>
                {badge.text}
              </Badge>
            )}
          </Group>
        );
      })}
    </Stack>
  );
}

function ArrayTableRenderer({ items, cardType }: { items: unknown[]; cardType: AnalysisCardType }) {
  const columns = getTableColumns(cardType);
  if (!columns) {
    // Fallback to list
    return <ArrayListRenderer items={items} cardType={cardType} />;
  }

  return (
    <Table striped highlightOnHover withTableBorder withColumnBorders fz="sm">
      <Table.Thead>
        <Table.Tr>
          {columns.map((col) => (
            <Table.Th key={`ath-${col.key}`} style={col.align ? { textAlign: col.align } : undefined}>
              {col.label}
            </Table.Th>
          ))}
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {items.map((item, i) => {
          const obj = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>;
          return (
            <Table.Tr key={`atr-${String(obj[columns[0]?.key] || i).slice(0, 20)}`}>
              {columns.map((col) => (
                <Table.Td key={`atd-${col.key}-${i}`} style={col.align ? { textAlign: col.align } : undefined}>
                  {highlightNumbers(String(obj[col.key] ?? ''))}
                </Table.Td>
              ))}
            </Table.Tr>
          );
        })}
      </Table.Tbody>
    </Table>
  );
}

function ObjectKeyValueRenderer({ obj }: { obj: Record<string, unknown> }) {
  const entries = Object.entries(obj).filter(([, v]) => v != null && v !== '');
  return (
    <SimpleGrid cols={2} spacing="md">
      {entries.map(([key, value]) => (
        <Box key={`okv-${key}`}>
          <Text size="xs" c="dimmed" tt="capitalize">
            {key.replace(/_/g, ' ')}
          </Text>
          <Text size="sm" fw={600}>
            {highlightNumbers(String(value))}
          </Text>
        </Box>
      ))}
    </SimpleGrid>
  );
}

// ─── Yardimci Fonksiyonlar ──────────────────────────────────────

function getItemDisplayText(item: unknown, _cardType: AnalysisCardType): string {
  if (typeof item === 'string') return item;
  if (typeof item === 'object' && item !== null) {
    const obj = item as Record<string, unknown>;
    return String(
      obj.madde ||
        obj.text ||
        obj.description ||
        obj.not ||
        obj.kalem ||
        obj.aciklama ||
        obj.pozisyon ||
        obj.tur ||
        obj.olay ||
        obj.belge ||
        JSON.stringify(item)
    );
  }
  return String(item);
}

function getItemBadge(item: unknown, cardType: AnalysisCardType): { text: string; color: string } | null {
  if (typeof item !== 'object' || item === null) return null;
  const obj = item as Record<string, unknown>;
  if (cardType === 'onemli_notlar' && obj.tur) {
    const colors: Record<string, string> = { uyari: 'red', gereklilik: 'blue', bilgi: 'gray' };
    return { text: String(obj.tur), color: colors[String(obj.tur)] || 'gray' };
  }
  if (cardType === 'gerekli_belgeler' && obj.zorunlu) return { text: 'Zorunlu', color: 'red' };
  if (obj.miktar) return { text: `${obj.miktar} ${obj.birim || ''}`.trim(), color: 'blue' };
  if (obj.adet) return { text: `${obj.adet} kişi`, color: 'indigo' };
  if (obj.oran) return { text: String(obj.oran), color: 'red' };
  return null;
}

interface TableColumn {
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
}

function getTableColumns(cardType: AnalysisCardType): TableColumn[] | null {
  switch (cardType) {
    case 'birim_fiyatlar':
      return [
        { key: 'kalem', label: 'Kalem' },
        { key: 'birim', label: 'Birim' },
        { key: 'miktar', label: 'Miktar', align: 'right' },
        { key: 'fiyat', label: 'Fiyat', align: 'right' },
      ];
    case 'personel_detaylari':
      return [
        { key: 'pozisyon', label: 'Pozisyon' },
        { key: 'adet', label: 'Adet', align: 'right' },
        { key: 'ucret_orani', label: 'Ücret Oranı' },
      ];
    case 'takvim':
      return [
        { key: 'olay', label: 'Olay' },
        { key: 'tarih', label: 'Tarih' },
        { key: 'gun', label: 'Gün', align: 'right' },
      ];
    case 'ceza_kosullari':
      return [
        { key: 'tur', label: 'Tür' },
        { key: 'oran', label: 'Oran' },
        { key: 'aciklama', label: 'Açıklama' },
      ];
    default:
      return null;
  }
}

// ─── AI Islemleri Tab ───────────────────────────────────────────

interface AIAction {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  transformType: string;
}

const AI_ACTIONS: AIAction[] = [
  {
    id: 'summarize',
    label: 'Özetle',
    description: 'İçeriği 2-3 cümleye indir',
    icon: <IconSparkles size={16} />,
    transformType: 'summarize',
  },
  {
    id: 'reformat',
    label: 'Yeniden Formatla',
    description: 'Düz metni yapılandırılmış formata çevir',
    icon: <IconTransform size={16} />,
    transformType: 'reformat',
  },
  {
    id: 'to_list',
    label: 'Maddelere Ayır',
    description: 'Paragraf metni maddeli listeye çevir',
    icon: <IconListCheck size={16} />,
    transformType: 'to_list',
  },
  {
    id: 'to_table',
    label: 'Tablo Yap',
    description: 'Liste veya metni tablo formatına çevir',
    icon: <IconTable size={16} />,
    transformType: 'to_table',
  },
  {
    id: 'validate',
    label: 'Doğrula',
    description: 'AI ile tutarsızlık ve hata kontrolü yap',
    icon: <IconAlertCircle size={16} />,
    transformType: 'validate',
  },
];

function AIActionsTab({ data, cardType, tenderId }: { data: unknown; cardType: AnalysisCardType; tenderId?: number }) {
  const [loading, setLoading] = useState<string | null>(null);
  const [result, setResult] = useState<{ action: string; content: string } | null>(null);

  const textData = useMemo(() => dataToString(data, cardType), [data, cardType]);

  const handleAction = useCallback(
    async (action: AIAction) => {
      if (!textData.trim()) {
        notifications.show({ title: 'Hata', message: 'İçerik boş', color: 'red' });
        return;
      }
      setLoading(action.id);
      setResult(null);
      try {
        const { api } = await import('@/lib/api');
        const { getApiUrl } = await import('@/lib/config');
        const res = await api.post(getApiUrl('/api/ai/card-transform'), {
          text: textData,
          transform_type: action.transformType,
          tender_id: tenderId,
        });
        const aiResult = res.data?.data;
        if (aiResult) {
          setResult({
            action: action.label,
            content:
              typeof aiResult.content === 'string' ? aiResult.content : JSON.stringify(aiResult.content, null, 2),
          });
        }
      } catch (err) {
        notifications.show({ title: 'AI Hatası', message: String(err), color: 'red' });
      } finally {
        setLoading(null);
      }
    },
    [textData, tenderId]
  );

  return (
    <Stack gap="md">
      <SimpleGrid cols={2} spacing="sm">
        {AI_ACTIONS.map((action) => (
          <Button
            key={action.id}
            variant="light"
            color="violet"
            leftSection={action.icon}
            onClick={() => handleAction(action)}
            loading={loading === action.id}
            disabled={!!loading}
            styles={{
              root: { height: 'auto', padding: '10px 14px' },
              inner: { justifyContent: 'flex-start' },
              label: { whiteSpace: 'normal' },
            }}
          >
            <Box>
              <Text size="sm" fw={600}>
                {action.label}
              </Text>
              <Text size="xs" c="dimmed">
                {action.description}
              </Text>
            </Box>
          </Button>
        ))}
      </SimpleGrid>

      {loading && (
        <Group gap="xs" justify="center" py="md">
          <Loader size="sm" color="violet" />
          <Text size="sm" c="dimmed">
            AI işliyor...
          </Text>
        </Group>
      )}

      {result && (
        <Box>
          <Divider my="sm" />
          <Group justify="space-between" mb="xs">
            <Group gap="xs">
              <IconRobot size={14} />
              <Text size="sm" fw={600}>
                {result.action} Sonucu
              </Text>
            </Group>
            <CopyButton value={result.content}>
              {({ copied, copy }) => (
                <Button
                  size="compact-xs"
                  variant="light"
                  color={copied ? 'green' : 'gray'}
                  onClick={copy}
                  leftSection={copied ? <IconCheck size={12} /> : <IconCopy size={12} />}
                >
                  {copied ? 'Kopyalandı' : 'Kopyala'}
                </Button>
              )}
            </CopyButton>
          </Group>
          <ScrollArea.Autosize mah={300}>
            <Text size="sm" style={{ lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
              {result.content}
            </Text>
          </ScrollArea.Autosize>
        </Box>
      )}
    </Stack>
  );
}

// ─── Kaynak Tab ─────────────────────────────────────────────────

function SourceTab({
  sourceDocumentName,
  rawText,
}: {
  sourceDocumentId?: number;
  sourceDocumentName?: string;
  rawText?: string;
}) {
  return (
    <Stack gap="md">
      {sourceDocumentName ? (
        <Group gap="xs">
          <ThemeIcon size="sm" variant="light" color="blue">
            <IconFileText size={12} />
          </ThemeIcon>
          <Text size="sm" fw={500}>
            {sourceDocumentName}
          </Text>
        </Group>
      ) : (
        <Text size="sm" c="dimmed">
          Kaynak doküman bilgisi mevcut değil.
        </Text>
      )}

      {rawText ? (
        <Box>
          <Text size="xs" c="dimmed" mb="xs" fw={600}>
            Orijinal Metin
          </Text>
          <Box
            p="sm"
            style={{
              background: 'var(--mantine-color-dark-7)',
              borderRadius: 8,
              borderLeft: '3px solid var(--mantine-color-violet-5)',
            }}
          >
            <ScrollArea.Autosize mah={400}>
              <Text size="xs" style={{ lineHeight: 1.6, whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                {rawText}
              </Text>
            </ScrollArea.Autosize>
          </Box>
        </Box>
      ) : (
        <Text size="sm" c="dimmed" fs="italic">
          Orijinal metin alıntısı mevcut değil.
        </Text>
      )}
    </Stack>
  );
}

// ─── Ana Modal ──────────────────────────────────────────────────

export interface AnalysisDetailModalProps {
  opened: boolean;
  onClose: () => void;
  cardType: AnalysisCardType;
  title: string;
  icon: React.ReactNode;
  color: string;
  data: unknown;
  rawText?: string;
  sourceDocumentId?: number;
  sourceDocumentName?: string;
  onSave?: (fieldPath: string, oldValue: unknown, newValue: unknown) => void;
  isCorrected?: boolean;
  tenderId?: number;
}

export function AnalysisDetailModal({
  opened,
  onClose,
  cardType,
  title,
  icon,
  color,
  data,
  rawText,
  sourceDocumentId,
  sourceDocumentName,
  onSave,
  isCorrected,
  tenderId,
}: AnalysisDetailModalProps) {
  const textData = useMemo(() => dataToString(data, cardType), [data, cardType]);

  const handleCopyPlain = useCallback(() => {
    navigator.clipboard.writeText(textData);
    notifications.show({ title: 'Kopyalandı', message: 'İçerik panoya kopyalandı', color: 'green', autoClose: 2000 });
  }, [textData]);

  const handleCopyExcel = useCallback(() => {
    // Tab-separated format for Excel
    const lines = textData.split('\n');
    const excelText = lines.map((l) => l.replace(/:\s+/g, '\t')).join('\n');
    navigator.clipboard.writeText(excelText);
    notifications.show({
      title: 'Kopyalandı',
      message: 'Excel formatında panoya kopyalandı',
      color: 'green',
      autoClose: 2000,
    });
  }, [textData]);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="xl"
      radius="lg"
      padding={0}
      title={
        <Group gap="sm" px="lg" pt="md">
          <ThemeIcon size="md" variant="light" color={color} radius="md">
            {icon}
          </ThemeIcon>
          <Box>
            <Text size="md" fw={600}>
              {title}
            </Text>
            <Group gap={4}>
              {isCorrected && (
                <Badge size="xs" variant="filled" color="green">
                  Düzeltildi
                </Badge>
              )}
              {Array.isArray(data) && (
                <Badge size="xs" variant="light" color="gray">
                  {data.length} öğe
                </Badge>
              )}
            </Group>
          </Box>
        </Group>
      }
      styles={{
        header: { borderBottom: '1px solid var(--mantine-color-dark-4)', paddingBottom: 8 },
        body: { padding: 0 },
      }}
    >
      <Tabs defaultValue="content" keepMounted={false}>
        <Tabs.List px="lg">
          <Tabs.Tab value="content" leftSection={<IconFileText size={14} />}>
            İçerik
          </Tabs.Tab>
          {onSave && (
            <Tabs.Tab value="edit" leftSection={<IconEdit size={14} />}>
              Düzenle
            </Tabs.Tab>
          )}
          <Tabs.Tab value="ai" leftSection={<IconBrain size={14} />}>
            AI
          </Tabs.Tab>
          <Tabs.Tab value="source" leftSection={<IconExternalLink size={14} />}>
            Kaynak
          </Tabs.Tab>
        </Tabs.List>

        <Box px="lg" py="md">
          <Tabs.Panel value="content">
            <ScrollArea.Autosize mah="60vh">
              <ContentTab data={data} cardType={cardType} />
            </ScrollArea.Autosize>
          </Tabs.Panel>

          {onSave && (
            <Tabs.Panel value="edit">
              <ScrollArea.Autosize mah="60vh">
                <EditTab data={data} cardType={cardType} fieldPath={cardType} onSave={onSave} />
              </ScrollArea.Autosize>
            </Tabs.Panel>
          )}

          <Tabs.Panel value="ai">
            <ScrollArea.Autosize mah="60vh">
              <AIActionsTab data={data} cardType={cardType} tenderId={tenderId} />
            </ScrollArea.Autosize>
          </Tabs.Panel>

          <Tabs.Panel value="source">
            <ScrollArea.Autosize mah="60vh">
              <SourceTab
                sourceDocumentId={sourceDocumentId}
                sourceDocumentName={sourceDocumentName}
                rawText={rawText}
              />
            </ScrollArea.Autosize>
          </Tabs.Panel>
        </Box>
      </Tabs>

      {/* Alt bar */}
      <Divider />
      <Group justify="flex-end" gap="xs" px="lg" py="sm">
        <Tooltip label="Düz metin olarak kopyala">
          <ActionIcon variant="subtle" color="gray" onClick={handleCopyPlain}>
            <IconClipboard size={16} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Excel formatında kopyala">
          <ActionIcon variant="subtle" color="gray" onClick={handleCopyExcel}>
            <IconTableExport size={16} />
          </ActionIcon>
        </Tooltip>
      </Group>
    </Modal>
  );
}

// ─── Edit Tab (Basit Metin Duzenleme) ───────────────────────────

function EditTab({
  data,
  cardType,
  fieldPath,
  onSave,
}: {
  data: unknown;
  cardType: AnalysisCardType;
  fieldPath: string;
  onSave: (fieldPath: string, oldValue: unknown, newValue: unknown) => void;
}) {
  const textValue = useMemo(() => dataToString(data, cardType), [data, cardType]);
  const [editText, setEditText] = useState(textValue);
  const isModified = editText !== textValue;

  const handleSave = () => {
    onSave(fieldPath, data, editText);
    notifications.show({ title: 'Kaydedildi', message: 'Değişiklikler kaydedildi', color: 'green', autoClose: 2000 });
  };

  return (
    <Stack gap="md">
      <Textarea
        value={editText}
        onChange={(e) => setEditText(e.target.value)}
        minRows={8}
        maxRows={20}
        autosize
        styles={{ input: { fontFamily: 'monospace', fontSize: 13 } }}
      />
      <Group justify="flex-end" gap="xs">
        <Button size="sm" variant="light" color="gray" onClick={() => setEditText(textValue)} disabled={!isModified}>
          Sıfırla
        </Button>
        <Button
          size="sm"
          variant="filled"
          color="green"
          onClick={handleSave}
          disabled={!isModified}
          leftSection={<IconCheck size={14} />}
        >
          Kaydet
        </Button>
      </Group>
      {isModified && (
        <Text size="xs" c="yellow">
          Kaydedilmemiş değişiklikler var.
        </Text>
      )}
    </Stack>
  );
}
