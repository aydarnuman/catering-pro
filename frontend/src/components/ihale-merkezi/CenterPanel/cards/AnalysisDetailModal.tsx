'use client';

import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Checkbox,
  Collapse,
  CopyButton,
  Divider,
  Group,
  List,
  Loader,
  Modal,
  Paper,
  ScrollArea,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconAlertCircle,
  IconAlertTriangle,
  IconCheck,
  IconClipboard,
  IconCopy,
  IconEdit,
  IconExternalLink,
  IconFileText,
  IconInfoCircle,
  IconList,
  IconPlus,
  IconSearch,
  IconSparkles,
  IconTableExport,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import { useCallback, useMemo, useState } from 'react';
import { type ContentType, detectContentType, splitContentToItems } from '../normalizeAnalysis';

// Tarih formatla (ISO -> TR format)
function formatDate(value: string): string {
  // ISO format: 2024-01-15 veya 2024-01-15T10:30:00
  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${day}.${month}.${year}`;
  }
  return value;
}

// Para birimi formatla
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value).replace('₺', '').trim() + ' TL';
}

// Yüzde formatla
function formatPercentage(value: number | string): string {
  const num = typeof value === 'string' ? Number.parseFloat(value) : value;
  if (Number.isNaN(num)) return String(value);
  return `%${num.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

// Hücre değerini formatla
function formatCellValue(value: unknown, fieldKey?: string): string {
  if (value === null || value === undefined || value === '') return '-';
  
  // Boolean
  if (typeof value === 'boolean') return value ? 'Evet' : 'Hayır';
  
  // Number
  if (typeof value === 'number') {
    // Para birimi alanları
    if (fieldKey && (fieldKey.includes('fiyat') || fieldKey.includes('tutar') || fieldKey.includes('bedel') || fieldKey.includes('ucret'))) {
      return formatCurrency(value);
    }
    // Yüzde alanları
    if (fieldKey && (fieldKey.includes('oran') || fieldKey.includes('yuzde') || fieldKey.includes('percent'))) {
      return formatPercentage(value);
    }
    return value.toLocaleString('tr-TR');
  }
  
  // String
  if (typeof value === 'string') {
    const str = value.trim();
    
    // ISO tarih formatı kontrolü
    if (/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(str)) {
      return formatDate(str);
    }
    
    // String içinde yüzde işareti varsa
    if (str.includes('%') || (fieldKey && fieldKey.includes('oran'))) {
      const numMatch = str.match(/[\d.,]+/);
      if (numMatch) {
        const num = Number.parseFloat(numMatch[0].replace(',', '.'));
        if (!Number.isNaN(num) && !str.includes('%')) {
          return formatPercentage(num);
        }
      }
    }
    
    // String içinde para birimi (TL, ₺) varsa düzgün formatla
    if (str.includes('TL') || str.includes('₺')) {
      const numMatch = str.replace(/[^\d.,]/g, '');
      if (numMatch) {
        const num = Number.parseFloat(numMatch.replace(/\./g, '').replace(',', '.'));
        if (!Number.isNaN(num)) {
          return formatCurrency(num);
        }
      }
    }
    
    return str;
  }
  
  return String(value);
}

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
  return parts.map((part, idx) => {
    if (
      /^\d+[.,]?\d*\s*(?:adet|kişi|kisi|gr|g|kg|lt|ml|porsiyon|öğün|ogun|gün|gun|saat|dakika|metre|m²|m2|%)?$/i.test(
        part
      )
    ) {
      return (
        <Text key={`hl-${part.slice(0, 10)}-${idx}`} component="span" fw={700} c="blue">
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
          if (obj.madde || obj.text || obj.description) return `${i + 1}. ${obj.madde || obj.text || obj.description}`;
          if (obj.not) return `${i + 1}. ${obj.not}`;
          if (obj.kalem)
            return `${obj.kalem}: ${obj.miktar || ''} ${obj.birim || ''} ${obj.fiyat ? `- ${obj.fiyat} TL` : ''}`;
          if (obj.pozisyon) return `${obj.pozisyon}: ${obj.adet || ''} kişi`;
          if (obj.olay) return `${obj.olay}: ${obj.tarih || ''}`;
          if (obj.tur && obj.oran) return `${obj.tur}: ${obj.oran}`;
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
        {items.map((item, idx) => (
          <List.Item key={`sli-${item.slice(0, 20)}-${idx}`}>
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
            {headers.map((h, hi) => (
              <Table.Th key={`sth-${h.slice(0, 10)}-${hi}`}>{h}</Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {dataRows.map((row, ri) => (
            <Table.Tr key={`str-${(row[0] || '').slice(0, 10)}-${ri}`}>
              {row.map((cell, ci) => (
                <Table.Td key={`std-${cell.slice(0, 10)}-${ri}-${ci}`}>{highlightNumbers(cell)}</Table.Td>
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
      {paragraphs.map((p, pi) => (
        <Text key={`sp-${p.slice(0, 15)}-${pi}`} size="sm" style={{ lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
          {highlightNumbers(p.trim())}
        </Text>
      ))}
    </Stack>
  );
}

function _ArrayListRenderer({ items, cardType }: { items: unknown[]; cardType: AnalysisCardType }) {
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
      {items.length === 0 && (
        <Text size="sm" c="dimmed" ta="center" py="md">
          Filtre kriterlerine uygun öğe bulunamadı.
        </Text>
      )}
    </Stack>
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
            {highlightNumbers(formatCellValue(value, key))}
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
    const colors: Record<string, string> = {
      uyari: 'red',
      gereklilik: 'blue',
      bilgi: 'gray',
      kisitlama: 'orange',
      sure: 'cyan',
      mali: 'green',
    };
    return { text: String(obj.tur).toUpperCase(), color: colors[String(obj.tur).toLowerCase()] || 'gray' };
  }
  if (cardType === 'gerekli_belgeler') {
    if (obj.zorunlu) return { text: 'Zorunlu', color: 'red' };
    return { text: 'Opsiyonel', color: 'gray' };
  }
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
    case 'ogun_bilgileri':
      return [
        { key: 'tur', label: 'Öğün Türü' },
        { key: 'miktar', label: 'Miktar', align: 'right' },
        { key: 'birim', label: 'Birim' },
      ];
    case 'gramaj_gruplari':
      return [
        { key: 'grup', label: 'Grup' },
        { key: 'yas_araligi', label: 'Yaş Aralığı' },
        { key: 'kisi_sayisi', label: 'Kişi', align: 'right' },
        { key: 'gramaj', label: 'Gramaj' },
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
  category: 'core' | 'transform' | 'analysis' | 'card_specific';
}

// Kart tipine ozel aksiyonlar
function getCardSpecificActions(cardType: AnalysisCardType): AIAction[] {
  const actions: AIAction[] = [];

  switch (cardType) {
    case 'onemli_notlar':
      actions.push({
        id: 'extract_risks',
        label: 'Risk Analizi',
        description: 'Uyarı, kısıtlama ve risk maddelerini öne çıkar',
        icon: <IconAlertTriangle size={16} />,
        transformType: 'extract_risks',
        category: 'card_specific',
      });
      break;
    case 'teknik_sartlar':
      actions.push({
        id: 'find_gaps',
        label: 'Eksik Gereksinim Analizi',
        description: 'Şartnamedeki potansiyel eksikleri tespit et',
        icon: <IconSearch size={16} />,
        transformType: 'find_gaps',
        category: 'card_specific',
      });
      break;
    case 'birim_fiyatlar':
      actions.push({
        id: 'price_check',
        label: 'Piyasa Karşılaştırması',
        description: 'Birim fiyatları piyasa ortalamasıyla karşılaştır',
        icon: <IconInfoCircle size={16} />,
        transformType: 'price_check',
        category: 'card_specific',
      });
      break;
    case 'mali_kriterler':
    case 'teminat_oranlari':
      actions.push({
        id: 'regulation_check',
        label: 'Mevzuat Uygunluğu',
        description: 'Kamu İhale Kanunu sınırlarına uygunluk kontrolü',
        icon: <IconCheck size={16} />,
        transformType: 'regulation_check',
        category: 'card_specific',
      });
      break;
    case 'ceza_kosullari':
      actions.push({
        id: 'penalty_analysis',
        label: 'Ceza Riski Analizi',
        description: 'Ceza oranlarının makullüğünü ve yasal sınırları kontrol et',
        icon: <IconAlertCircle size={16} />,
        transformType: 'penalty_analysis',
        category: 'card_specific',
      });
      break;
    case 'personel_detaylari':
      actions.push({
        id: 'labor_cost_check',
        label: 'İşçilik Maliyet Kontrolü',
        description: 'Personel sayısı ve ücret oranlarını kontrol et',
        icon: <IconInfoCircle size={16} />,
        transformType: 'labor_cost_check',
        category: 'card_specific',
      });
      break;
  }

  return actions;
}

// ─── Düzenlenebilir İçerik Alanı ─────────────────────────────────

function EditableContentArea({
  data,
  cardType,
  selectedItems,
  onToggleSelect,
  editingItem,
  onEditItem,
  onUpdateItem,
  editable,
}: {
  data: unknown;
  cardType: AnalysisCardType;
  selectedItems: Set<number>;
  onToggleSelect: (index: number) => void;
  editingItem: number | null;
  onEditItem: (index: number | null) => void;
  onUpdateItem: (index: number, newValue: unknown) => void;
  editable: boolean;
}) {
  const renderMode = getDataRenderMode(cardType);

  // String data
  if (typeof data === 'string') {
    return <SmartStringRenderer value={data} contentType={detectContentType(data)} />;
  }

  // Array data (list veya table)
  if (Array.isArray(data)) {
    if (renderMode === 'table') {
      return (
        <EditableTableRenderer
          items={data}
          cardType={cardType}
          selectedItems={selectedItems}
          onToggleSelect={onToggleSelect}
          editingItem={editingItem}
          onEditItem={onEditItem}
          onUpdateItem={onUpdateItem}
          editable={editable}
        />
      );
    }
    return (
      <EditableListRenderer
        items={data}
        cardType={cardType}
        selectedItems={selectedItems}
        onToggleSelect={onToggleSelect}
        editingItem={editingItem}
        onEditItem={onEditItem}
        onUpdateItem={onUpdateItem}
        editable={editable}
      />
    );
  }

  // Object data (key-value)
  if (typeof data === 'object' && data !== null) {
    return <ObjectKeyValueRenderer obj={data as Record<string, unknown>} />;
  }

  return (
    <Text size="sm" style={{ lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
      {String(data)}
    </Text>
  );
}

function EditableListRenderer({
  items,
  cardType,
  selectedItems,
  onToggleSelect,
  editingItem,
  onEditItem,
  onUpdateItem,
  editable,
}: {
  items: unknown[];
  cardType: AnalysisCardType;
  selectedItems: Set<number>;
  onToggleSelect: (index: number) => void;
  editingItem: number | null;
  onEditItem: (index: number | null) => void;
  onUpdateItem: (index: number, newValue: unknown) => void;
  editable: boolean;
}) {
  const [editValue, setEditValue] = useState('');
  const [originalItem, setOriginalItem] = useState<unknown>(null);

  const startEdit = (index: number, item: unknown) => {
    const text = getItemDisplayText(item, cardType);
    setEditValue(text);
    setOriginalItem(item);
    onEditItem(index);
  };

  // Obje yapısını koruyarak sadece ana metin alanını güncelle
  const saveEdit = (index: number) => {
    if (typeof originalItem === 'object' && originalItem !== null) {
      const obj = originalItem as Record<string, unknown>;
      // Ana metin alanını belirle ve güncelle
      const textField = obj.madde !== undefined ? 'madde'
        : obj.text !== undefined ? 'text'
        : obj.description !== undefined ? 'description'
        : obj.not !== undefined ? 'not'
        : obj.kalem !== undefined ? 'kalem'
        : obj.aciklama !== undefined ? 'aciklama'
        : obj.pozisyon !== undefined ? 'pozisyon'
        : obj.tur !== undefined ? 'tur'
        : obj.olay !== undefined ? 'olay'
        : obj.belge !== undefined ? 'belge'
        : null;
      
      if (textField) {
        onUpdateItem(index, { ...obj, [textField]: editValue });
      } else {
        // Hiçbir alan eşleşmezse string olarak kaydet
        onUpdateItem(index, editValue);
      }
    } else {
      // String ise direkt string olarak kaydet
      onUpdateItem(index, editValue);
    }
    setOriginalItem(null);
  };

  const cancelEdit = () => {
    onEditItem(null);
    setEditValue('');
    setOriginalItem(null);
  };

  return (
    <Stack gap={4}>
      {items.map((item, i) => {
        const text = getItemDisplayText(item, cardType);
        const badge = getItemBadge(item, cardType);
        const isSelected = selectedItems.has(i);
        const isEditing = editingItem === i;

        return (
          <Paper
            key={`eli-${text.slice(0, 20)}-${i}`}
            p="xs"
            withBorder
            style={{
              background: isSelected ? 'var(--mantine-color-dark-6)' : 'transparent',
              borderColor: isSelected ? 'var(--mantine-color-blue-7)' : 'var(--mantine-color-dark-5)',
              cursor: editable ? 'pointer' : 'default',
            }}
          >
            {isEditing ? (
              <Stack gap="xs">
                <Textarea
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  autosize
                  minRows={2}
                  maxRows={6}
                  autoFocus
                  styles={{ input: { fontSize: 13 } }}
                />
                <Group gap="xs" justify="flex-end">
                  <Button size="xs" variant="subtle" color="gray" onClick={cancelEdit}>
                    İptal
                  </Button>
                  <Button size="xs" variant="filled" color="green" onClick={() => saveEdit(i)}>
                    Tamam
                  </Button>
                </Group>
              </Stack>
            ) : (
              <Group gap="xs" wrap="nowrap" align="flex-start">
                {editable && (
                  <Checkbox
                    size="xs"
                    checked={isSelected}
                    onChange={() => onToggleSelect(i)}
                    style={{ marginTop: 3 }}
                  />
                )}
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
                {editable && (
                  <ActionIcon size="xs" variant="subtle" color="gray" onClick={() => startEdit(i, item)}>
                    <IconEdit size={12} />
                  </ActionIcon>
                )}
              </Group>
            )}
          </Paper>
        );
      })}
      {items.length === 0 && (
        <Text size="sm" c="dimmed" ta="center" py="md">
          Henüz öğe yok
        </Text>
      )}
    </Stack>
  );
}

function EditableTableRenderer({
  items,
  cardType,
  selectedItems,
  onToggleSelect,
  editingItem,
  onEditItem,
  onUpdateItem,
  editable,
}: {
  items: unknown[];
  cardType: AnalysisCardType;
  selectedItems: Set<number>;
  onToggleSelect: (index: number) => void;
  editingItem: number | null;
  onEditItem: (index: number | null) => void;
  onUpdateItem: (index: number, newValue: unknown) => void;
  editable: boolean;
}) {
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  // items boş ise
  if (items.length === 0) {
    return (
      <Text size="sm" c="dimmed" ta="center" py="md">
        Henüz öğe yok
      </Text>
    );
  }

  // Column tanımı yoksa, ilk item'dan dinamik olarak oluştur
  const predefinedColumns = getTableColumns(cardType);
  const columns: TableColumn[] = predefinedColumns || (() => {
    const firstItem = items[0];
    if (typeof firstItem === 'object' && firstItem !== null) {
      return Object.keys(firstItem as Record<string, unknown>)
        .filter(key => key !== 'id' && !key.startsWith('_'))
        .map(key => ({
          key,
          label: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        }));
    }
    return [{ key: 'value', label: 'Değer' }];
  })();

  const startEdit = (index: number, item: unknown) => {
    const obj = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>;
    const values: Record<string, string> = {};
    for (const col of columns) {
      values[col.key] = obj[col.key] != null ? String(obj[col.key]) : '';
    }
    setEditValues(values);
    onEditItem(index);
  };

  const saveEdit = (index: number, originalItem: unknown) => {
    const obj = (typeof originalItem === 'object' && originalItem !== null ? originalItem : {}) as Record<string, unknown>;
    const updatedItem = { ...obj };
    for (const col of columns) {
      const value = editValues[col.key];
      // Sayı alanları için number'a dönüştür
      if (col.align === 'right' && value) {
        const num = Number(value.replace(/[^\d,.]/g, '').replace(',', '.'));
        updatedItem[col.key] = Number.isNaN(num) ? value : num;
      } else {
        updatedItem[col.key] = value;
      }
    }
    onUpdateItem(index, updatedItem);
    setEditValues({});
  };

  const cancelEdit = () => {
    onEditItem(null);
    setEditValues({});
  };

  return (
    <Table striped highlightOnHover withTableBorder withColumnBorders fz="sm">
      <Table.Thead>
        <Table.Tr>
          {editable && <Table.Th w={40}></Table.Th>}
          <Table.Th w={40}>#</Table.Th>
          {columns.map((col) => (
            <Table.Th key={col.key} style={{ textAlign: col.align || 'left' }}>
              {col.label}
            </Table.Th>
          ))}
          {editable && <Table.Th w={80}>İşlem</Table.Th>}
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {items.map((item, i) => {
          const isSelected = selectedItems.has(i);
          const isEditing = editingItem === i;
          const obj = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>;
          const rowKey = obj.id ? String(obj.id) : `row-${i}-${JSON.stringify(Object.values(obj).slice(0, 2)).slice(0, 30)}`;
          
          return (
            <Table.Tr
              key={`etr-${rowKey}`}
              style={{ background: isSelected ? 'var(--mantine-color-dark-6)' : isEditing ? 'var(--mantine-color-blue-light)' : undefined }}
            >
              {editable && (
                <Table.Td>
                  <Checkbox size="xs" checked={isSelected} onChange={() => onToggleSelect(i)} disabled={isEditing} />
                </Table.Td>
              )}
              <Table.Td>
                <Badge size="xs" variant="light" color={isEditing ? 'blue' : 'gray'}>
                  {i + 1}
                </Badge>
              </Table.Td>
              {columns.map((col) => (
                <Table.Td key={`${rowKey}-${col.key}`} style={{ textAlign: col.align || 'left' }}>
                  {isEditing ? (
                    <TextInput
                      size="xs"
                      value={editValues[col.key] || ''}
                      onChange={(e) => setEditValues({ ...editValues, [col.key]: e.target.value })}
                      style={{ minWidth: 80 }}
                      styles={{ input: { textAlign: col.align || 'left' } }}
                    />
                  ) : (
                    formatCellValue(obj[col.key], col.key)
                  )}
                </Table.Td>
              ))}
              {editable && (
                <Table.Td>
                  {isEditing ? (
                    <Group gap={4} wrap="nowrap">
                      <ActionIcon size="xs" variant="filled" color="green" onClick={() => saveEdit(i, item)}>
                        <IconCheck size={12} />
                      </ActionIcon>
                      <ActionIcon size="xs" variant="subtle" color="gray" onClick={cancelEdit}>
                        <IconX size={12} />
                      </ActionIcon>
                    </Group>
                  ) : (
                    <ActionIcon size="xs" variant="subtle" color="gray" onClick={() => startEdit(i, item)}>
                      <IconEdit size={12} />
                    </ActionIcon>
                  )}
                </Table.Td>
              )}
            </Table.Tr>
          );
        })}
      </Table.Tbody>
    </Table>
  );
}

// ─── Kompakt AI Panel ────────────────────────────────────────────

function CompactAIPanel({
  data,
  cardType,
  selectedItems,
  tenderId,
  onApplyResult: _onApplyResult,
}: {
  data: unknown;
  cardType: AnalysisCardType;
  selectedItems: Set<number>;
  tenderId?: number;
  onApplyResult?: (result: unknown) => void;
}) {
  const [loading, setLoading] = useState<string | null>(null);
  const [result, setResult] = useState<{ action: string; content: string } | null>(null);

  const textData = useMemo(() => {
    if (selectedItems.size > 0 && Array.isArray(data)) {
      const selectedData = data.filter((_, i) => selectedItems.has(i));
      return dataToString(selectedData, cardType);
    }
    return dataToString(data, cardType);
  }, [data, cardType, selectedItems]);

  const cardSpecificActions = useMemo(() => getCardSpecificActions(cardType), [cardType]);

  const coreActions: { id: string; label: string; icon: React.ReactNode; transformType: string }[] = [
    { id: 'summarize', label: 'Özetle', icon: <IconSparkles size={14} />, transformType: 'summarize' },
    { id: 'validate', label: 'Tutarlılık Kontrolü', icon: <IconAlertCircle size={14} />, transformType: 'validate' },
    { id: 'find_duplicates', label: 'Benzer Bul', icon: <IconSearch size={14} />, transformType: 'find_duplicates' },
  ];

  const handleAction = async (actionId: string, transformType: string, label: string) => {
    if (!textData.trim()) {
      notifications.show({ title: 'Hata', message: 'İçerik boş', color: 'red' });
      return;
    }
    setLoading(actionId);
    setResult(null);
    try {
      const { api } = await import('@/lib/api');
      const { getApiUrl } = await import('@/lib/config');
      const res = await api.post(getApiUrl('/api/ai/card-transform'), {
        text: textData,
        transform_type: transformType,
        card_type: cardType,
        tender_id: tenderId,
      });
      const aiResult = res.data?.data;
      if (aiResult) {
        setResult({ action: label, content: aiResult.result || aiResult.text || JSON.stringify(aiResult) });
      }
    } catch {
      notifications.show({ title: 'Hata', message: 'AI işlemi başarısız', color: 'red' });
    } finally {
      setLoading(null);
    }
  };

  return (
    <Stack gap={0} h="100%">
      {/* Header */}
      <Box p="sm" style={{ borderBottom: '1px solid var(--mantine-color-dark-5)' }}>
        <Group gap="xs">
          <IconSparkles size={16} color="var(--mantine-color-violet-5)" />
          <Text size="sm" fw={600}>
            AI Yardımcı
          </Text>
        </Group>
        {selectedItems.size > 0 && (
          <Text size="xs" c="dimmed" mt={4}>
            {selectedItems.size} öğe seçili
          </Text>
        )}
      </Box>

      {/* Actions */}
      <ScrollArea.Autosize mah={200} p="sm">
        <Stack gap={4}>
          <Text size="xs" c="dimmed" fw={600} mb={4}>
            Genel
          </Text>
          {coreActions.map((action) => (
            <UnstyledButton
              key={action.id}
              onClick={() => handleAction(action.id, action.transformType, action.label)}
              disabled={loading !== null}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 8px',
                borderRadius: 6,
                background: loading === action.id ? 'var(--mantine-color-dark-5)' : 'transparent',
                opacity: loading && loading !== action.id ? 0.5 : 1,
              }}
            >
              {loading === action.id ? <Loader size={14} /> : action.icon}
              <Text size="xs">{action.label}</Text>
            </UnstyledButton>
          ))}

          {cardSpecificActions.length > 0 && (
            <>
              <Divider my="xs" />
              <Text size="xs" c="dimmed" fw={600} mb={4}>
                Bu Kart İçin
              </Text>
              {cardSpecificActions.map((action) => (
                <UnstyledButton
                  key={action.id}
                  onClick={() => handleAction(action.id, action.transformType, action.label)}
                  disabled={loading !== null}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 8px',
                    borderRadius: 6,
                    background: loading === action.id ? 'var(--mantine-color-dark-5)' : 'transparent',
                    opacity: loading && loading !== action.id ? 0.5 : 1,
                  }}
                >
                  {loading === action.id ? <Loader size={14} /> : action.icon}
                  <Text size="xs">{action.label}</Text>
                </UnstyledButton>
              ))}
            </>
          )}
        </Stack>
      </ScrollArea.Autosize>

      {/* Result */}
      {result && (
        <Box p="sm" style={{ borderTop: '1px solid var(--mantine-color-dark-5)', flex: 1 }}>
          <Group justify="space-between" mb="xs">
            <Text size="xs" fw={600} c="violet">
              {result.action}
            </Text>
            <ActionIcon size="xs" variant="subtle" color="gray" onClick={() => setResult(null)}>
              <IconX size={12} />
            </ActionIcon>
          </Group>
          <ScrollArea.Autosize mah={200}>
            <Text size="xs" style={{ lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {result.content}
            </Text>
          </ScrollArea.Autosize>
          <Group gap="xs" mt="sm">
            <CopyButton value={result.content}>
              {({ copied, copy }) => (
                <Button
                  size="xs"
                  variant="light"
                  color={copied ? 'green' : 'gray'}
                  onClick={copy}
                  leftSection={<IconCopy size={12} />}
                >
                  {copied ? 'Kopyalandı' : 'Kopyala'}
                </Button>
              )}
            </CopyButton>
          </Group>
        </Box>
      )}
    </Stack>
  );
}

// ─── Kaynak Tab ─────────────────────────────────────────────────

function SourceTab({
  sourceDocumentName,
  rawText,
  cardType,
}: {
  sourceDocumentId?: number;
  sourceDocumentName?: string;
  rawText?: string;
  cardType: AnalysisCardType;
}) {
  const cardTypeLabels: Record<string, string> = {
    teknik_sartlar: 'Teknik Şartname',
    onemli_notlar: 'İdari + Teknik Şartname',
    birim_fiyatlar: 'Birim Fiyat Cetveli',
    personel_detaylari: 'Teknik Şartname / Personel',
    mali_kriterler: 'İdari Şartname / Mali Yeterlilik',
    teminat_oranlari: 'İdari Şartname / Teminat',
    ceza_kosullari: 'Sözleşme Tasarısı',
    takvim: 'İhale İlanı + İdari Şartname',
    gerekli_belgeler: 'İdari Şartname / Belgeler',
    iletisim: 'İhale İlanı',
    servis_saatleri: 'Teknik Şartname / Servis',
    ogun_bilgileri: 'Teknik Şartname / Öğün',
    gramaj_gruplari: 'Teknik Şartname / Gramaj',
    fiyat_farki: 'İdari Şartname / Fiyat Farkı',
    eksik_bilgiler: 'Genel Analiz',
    is_yerleri: 'Teknik Şartname / Lokasyonlar',
  };

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
        <Box
          p="sm"
          style={{
            background: 'var(--mantine-color-dark-7)',
            borderRadius: 8,
            border: '1px solid var(--mantine-color-dark-5)',
          }}
        >
          <Group gap="xs" mb="xs">
            <ThemeIcon size="sm" variant="light" color="gray">
              <IconFileText size={12} />
            </ThemeIcon>
            <Text size="sm" fw={500}>
              Olası Kaynak
            </Text>
          </Group>
          <Text size="xs" c="dimmed">
            Bu verinin kaynağı:{' '}
            <Text component="span" fw={600} c="blue">
              {cardTypeLabels[cardType] || 'Genel Analiz'}
            </Text>
          </Text>
          <Text size="xs" c="dimmed" mt={4}>
            AI analizi sırasında dokümanlardan çıkarılmıştır. Kesin kaynak eşleştirmesi henüz mevcut değil.
          </Text>
        </Box>
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
        <Box
          p="sm"
          style={{
            background: 'var(--mantine-color-dark-8)',
            borderRadius: 8,
            border: '1px dashed var(--mantine-color-dark-4)',
          }}
        >
          <Text size="xs" c="dimmed" fs="italic">
            Orijinal metin alıntısı henüz mevcut değil. İleride doküman-analiz eşleştirmesi eklenecek.
          </Text>
        </Box>
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
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [showSourcePanel, setShowSourcePanel] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [editingItem, setEditingItem] = useState<number | null>(null);
  const [localData, setLocalData] = useState<unknown>(data);
  const [hasChanges, setHasChanges] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Data değiştiğinde local state'i güncelle
  useMemo(() => {
    setLocalData(data);
    setHasChanges(false);
    setSelectedItems(new Set());
    setSearchQuery('');
  }, [data]);

  // Filtrelenmiş veriyi hesapla
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return localData;
    const query = searchQuery.toLowerCase().trim();
    
    if (Array.isArray(localData)) {
      return localData.filter((item) => {
        const text = getItemDisplayText(item, cardType).toLowerCase();
        // Obje içindeki tüm değerleri de kontrol et
        if (typeof item === 'object' && item !== null) {
          const objValues = Object.values(item as Record<string, unknown>)
            .filter(v => v != null)
            .map(v => String(v).toLowerCase())
            .join(' ');
          return text.includes(query) || objValues.includes(query);
        }
        return text.includes(query);
      });
    }
    
    if (typeof localData === 'string') {
      return localData.toLowerCase().includes(query) ? localData : '';
    }
    
    if (typeof localData === 'object' && localData !== null) {
      const matches = Object.entries(localData as Record<string, unknown>)
        .filter(([k, v]) => {
          const keyMatch = k.toLowerCase().includes(query);
          const valueMatch = v != null && String(v).toLowerCase().includes(query);
          return keyMatch || valueMatch;
        });
      if (matches.length === 0) return null;
      return Object.fromEntries(matches);
    }
    
    return localData;
  }, [localData, searchQuery, cardType]);

  const textData = useMemo(() => dataToString(localData, cardType), [localData, cardType]);
  const itemCount = Array.isArray(localData) ? localData.length : 0;

  const handleCopyPlain = useCallback(() => {
    navigator.clipboard.writeText(textData);
    notifications.show({ title: 'Kopyalandı', message: 'İçerik panoya kopyalandı', color: 'green', autoClose: 2000 });
  }, [textData]);

  const handleCopyExcel = useCallback(() => {
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

  // Seçim işlemleri
  const toggleSelect = (index: number) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const selectAll = () => {
    if (Array.isArray(localData)) {
      setSelectedItems(new Set(localData.map((_, i) => i)));
    }
  };

  const clearSelection = () => setSelectedItems(new Set());

  // Öğe silme
  const handleDeleteSelected = () => {
    if (!Array.isArray(localData)) return;
    const newData = localData.filter((_, i) => !selectedItems.has(i));
    setLocalData(newData);
    setHasChanges(true);
    setSelectedItems(new Set());
  };

  // Öğe düzenleme
  const handleUpdateItem = (index: number, newValue: unknown) => {
    if (!Array.isArray(localData)) return;
    const newData = [...localData];
    newData[index] = newValue;
    setLocalData(newData);
    setHasChanges(true);
    setEditingItem(null);
  };

  // Yeni öğe ekleme
  const handleAddItem = () => {
    if (!Array.isArray(localData)) return;
    const newItem = typeof localData[0] === 'object' ? {} : '';
    setLocalData([...localData, newItem]);
    setHasChanges(true);
    setEditingItem(localData.length);
  };

  // Kaydet
  const handleSave = () => {
    if (onSave) {
      onSave(cardType, data, localData);
      setHasChanges(false);
      notifications.show({ title: 'Kaydedildi', message: 'Değişiklikler kaydedildi', color: 'green', autoClose: 2000 });
    }
  };

  // İptal
  const handleCancel = () => {
    setLocalData(data);
    setHasChanges(false);
    setSelectedItems(new Set());
    setEditingItem(null);
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size={showAIPanel ? '80rem' : 'xl'}
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
              {itemCount > 0 && (
                <Badge size="xs" variant="light" color="gray">
                  {itemCount} öğe
                </Badge>
              )}
              {hasChanges && (
                <Badge size="xs" variant="filled" color="yellow">
                  Değişiklik var
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
      {/* Üst araç çubuğu */}
      <Group justify="space-between" px="lg" py="xs" style={{ borderBottom: '1px solid var(--mantine-color-dark-5)' }}>
        <Group gap="xs">
          <TextInput
            placeholder="Ara..."
            size="xs"
            leftSection={<IconSearch size={14} />}
            rightSection={searchQuery && (
              <ActionIcon size="xs" variant="subtle" onClick={() => setSearchQuery('')}>
                <IconX size={12} />
              </ActionIcon>
            )}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            w={200}
            styles={{
              input: { background: 'var(--mantine-color-dark-7)', border: '1px solid var(--mantine-color-dark-5)' },
            }}
          />
          {searchQuery && (
            <Badge size="xs" variant="light" color="blue">
              {Array.isArray(filteredData) ? `${filteredData.length} sonuç` : filteredData ? '1 sonuç' : '0 sonuç'}
            </Badge>
          )}
          {onSave && Array.isArray(localData) && (
            <>
              <Button
                size="xs"
                variant="light"
                color="green"
                leftSection={<IconPlus size={14} />}
                onClick={handleAddItem}
              >
                Yeni Ekle
              </Button>
              <Button size="xs" variant="subtle" color="gray" onClick={selectAll}>
                Tümünü Seç
              </Button>
            </>
          )}
        </Group>
        <Group gap="xs">
          {selectedItems.size > 0 && onSave && (
            <>
              <Text size="xs" c="dimmed">
                {selectedItems.size} seçili
              </Text>
              <Button
                size="xs"
                variant="light"
                color="red"
                leftSection={<IconTrash size={14} />}
                onClick={handleDeleteSelected}
              >
                Sil
              </Button>
              <Button size="xs" variant="subtle" color="gray" onClick={clearSelection}>
                Temizle
              </Button>
            </>
          )}
          <Tooltip label="AI Yardımcı">
            <ActionIcon
              variant={showAIPanel ? 'filled' : 'light'}
              color="violet"
              onClick={() => setShowAIPanel(!showAIPanel)}
            >
              <IconSparkles size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Kaynak Bilgisi">
            <ActionIcon
              variant={showSourcePanel ? 'filled' : 'light'}
              color="blue"
              onClick={() => setShowSourcePanel(!showSourcePanel)}
            >
              <IconExternalLink size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Düz metin kopyala">
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
      </Group>

      {/* Ana içerik alanı */}
      <Box style={{ display: 'flex', minHeight: 400 }}>
        {/* Sol: İçerik */}
        <Box style={{ flex: 1, borderRight: showAIPanel ? '1px solid var(--mantine-color-dark-5)' : 'none' }}>
          <ScrollArea.Autosize mah="60vh" p="md">
            {filteredData === null || (Array.isArray(filteredData) && filteredData.length === 0) ? (
              <Stack align="center" py="xl">
                <ThemeIcon size="xl" variant="light" color="gray" radius="xl">
                  <IconSearch size={24} />
                </ThemeIcon>
                <Text size="sm" c="dimmed" ta="center">
                  &quot;{searchQuery}&quot; için sonuç bulunamadı
                </Text>
                <Button size="xs" variant="subtle" color="gray" onClick={() => setSearchQuery('')}>
                  Aramayı Temizle
                </Button>
              </Stack>
            ) : (
              <EditableContentArea
                data={searchQuery ? filteredData : localData}
                cardType={cardType}
                selectedItems={selectedItems}
                onToggleSelect={toggleSelect}
                editingItem={editingItem}
                onEditItem={setEditingItem}
                onUpdateItem={handleUpdateItem}
                editable={!!onSave && !searchQuery}
              />
            )}
          </ScrollArea.Autosize>
        </Box>

        {/* Sağ: AI Panel */}
        {showAIPanel && (
          <Box w={280} style={{ background: 'var(--mantine-color-dark-7)' }}>
            <CompactAIPanel
              data={localData}
              cardType={cardType}
              selectedItems={selectedItems}
              tenderId={tenderId}
              onApplyResult={(result) => {
                // AI sonucunu uygula
                if (result && onSave) {
                  setLocalData(result);
                  setHasChanges(true);
                }
              }}
            />
          </Box>
        )}
      </Box>

      {/* Kaynak paneli (collapse) */}
      <Collapse in={showSourcePanel}>
        <Box
          px="lg"
          py="md"
          style={{ borderTop: '1px solid var(--mantine-color-dark-5)', background: 'var(--mantine-color-dark-7)' }}
        >
          <SourceTab
            sourceDocumentId={sourceDocumentId}
            sourceDocumentName={sourceDocumentName}
            rawText={rawText}
            cardType={cardType}
          />
        </Box>
      </Collapse>

      {/* Alt bar */}
      <Divider />
      <Group justify="space-between" px="lg" py="sm">
        <Text size="xs" c="dimmed">
          {hasChanges ? 'Kaydedilmemiş değişiklikler var' : 'Tüm değişiklikler kaydedildi'}
        </Text>
        <Group gap="xs">
          <Button size="sm" variant="subtle" color="gray" onClick={handleCancel} disabled={!hasChanges}>
            İptal
          </Button>
          <Button
            size="sm"
            variant="filled"
            color="green"
            onClick={handleSave}
            disabled={!hasChanges || !onSave}
            leftSection={<IconCheck size={14} />}
          >
            Kaydet
          </Button>
        </Group>
      </Group>
    </Modal>
  );
}
