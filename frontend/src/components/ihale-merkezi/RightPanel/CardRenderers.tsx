'use client';

import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Divider,
  Group,
  Modal,
  ScrollArea,
  Select,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { IconCalendar, IconCheck, IconEdit, IconFileText, IconTrash, IconX } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import type { CardCategory, TenderCard, UpdateCardInput } from '@/hooks/useTenderCards';

// ─── Text Card ──────────────────────────────────────────────────

function CardTextRenderer({ content }: { content: Record<string, unknown> }) {
  const text = typeof content?.text === 'string' ? content.text : '';
  if (!text) return null;
  return (
    <Text size="xs" c="dimmed" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
      {text}
    </Text>
  );
}

// ─── Table Card ─────────────────────────────────────────────────

function CardTableRenderer({ content }: { content: Record<string, unknown> }) {
  const headers = Array.isArray(content?.headers) ? (content.headers as string[]) : [];
  const rows = Array.isArray(content?.rows) ? (content.rows as string[][]) : [];

  if (rows.length === 0)
    return (
      <Text size="xs" c="dimmed">
        Boş tablo
      </Text>
    );

  return (
    <Box style={{ overflowX: 'auto' }}>
      <Table
        striped
        highlightOnHover
        withTableBorder
        withColumnBorders
        fz="xs"
        styles={{
          th: { padding: '4px 6px', fontSize: 11, fontWeight: 600 },
          td: { padding: '4px 6px', fontSize: 11 },
        }}
      >
        {headers.length > 0 && (
          <Table.Thead>
            <Table.Tr>
              {headers.map((h, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static table headers
                <Table.Th key={i}>{h}</Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
        )}
        <Table.Tbody>
          {rows.map((row, ri) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static table rows
            <Table.Tr key={ri}>
              {row.map((cell, ci) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static table cells
                <Table.Td key={ci}>{cell}</Table.Td>
              ))}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Box>
  );
}

// ─── List Card ──────────────────────────────────────────────────

function CardListRenderer({ content }: { content: Record<string, unknown> }) {
  const items = Array.isArray(content?.items) ? (content.items as string[]) : [];
  if (items.length === 0)
    return (
      <Text size="xs" c="dimmed">
        Boş liste
      </Text>
    );

  return (
    <Box component="ul" style={{ margin: 0, paddingLeft: 16 }}>
      {items.map((item, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static list items
        <Box component="li" key={i} mb={2}>
          <Text size="xs" c="dimmed">
            {item}
          </Text>
        </Box>
      ))}
    </Box>
  );
}

// ─── Number Card ────────────────────────────────────────────────

function CardNumberRenderer({ content }: { content: Record<string, unknown> }) {
  const label = typeof content?.label === 'string' ? content.label : '';
  const value = content?.value;
  const unit = typeof content?.unit === 'string' ? content.unit : '';

  return (
    <Group gap="xs" align="baseline">
      <Text size="lg" fw={700} c="white">
        {typeof value === 'number' ? value.toLocaleString('tr-TR') : String(value ?? '-')}
      </Text>
      {unit && (
        <Text size="xs" c="dimmed">
          {unit}
        </Text>
      )}
      {label && (
        <Text size="xs" c="dimmed">
          {label}
        </Text>
      )}
    </Group>
  );
}

// ─── Category Badge ─────────────────────────────────────────────

const categoryColors: Record<string, string> = {
  operasyonel: 'blue',
  mali: 'green',
  teknik: 'yellow',
  belgeler: 'orange',
  diger: 'gray',
};

const categoryLabels: Record<string, string> = {
  operasyonel: 'Operasyonel',
  mali: 'Mali',
  teknik: 'Teknik',
  belgeler: 'Belgeler',
  diger: 'Diğer',
};

export function CardCategoryBadge({ category }: { category: string }) {
  return (
    <Badge size="xs" variant="dot" color={categoryColors[category] || 'gray'}>
      {categoryLabels[category] || category}
    </Badge>
  );
}

// ─── Main Renderer (dispatches by card_type) ────────────────────

export function CardContentRenderer({ card }: { card: TenderCard }) {
  switch (card.card_type) {
    case 'table':
      return <CardTableRenderer content={card.content} />;
    case 'list':
      return <CardListRenderer content={card.content} />;
    case 'number':
      return <CardNumberRenderer content={card.content} />;
    default:
      return <CardTextRenderer content={card.content} />;
  }
}

// ─── Card Detail Modal ───────────────────────────────────────────

interface CardDetailModalProps {
  card: TenderCard | null;
  opened: boolean;
  onClose: () => void;
  onUpdate: (data: UpdateCardInput & { id: number }) => void;
  onDelete: (id: number) => void;
  isUpdating: boolean;
}

export function CardDetailModal({ card, opened, onClose, onUpdate, onDelete, isUpdating }: CardDetailModalProps) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editText, setEditText] = useState('');
  const [editCategory, setEditCategory] = useState<string>('diger');

  // Reset edit state when modal opens with new card
  useEffect(() => {
    if (opened && card) {
      setEditTitle(card.title);
      setEditText(typeof card.content?.text === 'string' ? card.content.text : '');
      setEditCategory(card.category || 'diger');
      setEditing(false);
    }
  }, [opened, card]);

  const handleStartEdit = () => {
    if (card) {
      setEditTitle(card.title);
      setEditText(typeof card.content?.text === 'string' ? card.content.text : '');
      setEditCategory(card.category || 'diger');
      setEditing(true);
    }
  };

  const handleSave = () => {
    if (!card) return;
    onUpdate({
      id: card.id,
      title: editTitle.trim() || card.title,
      content: { ...card.content, text: editText },
      category: editCategory as CardCategory,
    });
    setEditing(false);
  };

  const handleCancel = () => {
    if (card) {
      setEditTitle(card.title);
      setEditText(typeof card.content?.text === 'string' ? card.content.text : '');
      setEditCategory(card.category || 'diger');
    }
    setEditing(false);
  };

  const handleDelete = () => {
    if (card) {
      onDelete(card.id);
      onClose();
    }
  };

  if (!card) return null;

  const createdDate = card.created_at ? new Date(card.created_at).toLocaleDateString('tr-TR') : null;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <CardCategoryBadge category={card.category} />
          <Text size="sm" fw={600}>
            Kart Detayı
          </Text>
        </Group>
      }
      size="lg"
      centered
      styles={{
        header: { background: 'var(--mantine-color-dark-7)' },
        body: { background: 'var(--mantine-color-dark-7)', padding: 0 },
        content: { background: 'var(--mantine-color-dark-7)' },
      }}
    >
      <ScrollArea.Autosize mah={500}>
        <Stack gap="md" p="md">
          {/* ─── Title ─── */}
          {editing ? (
            <TextInput
              label="Başlık"
              placeholder="Kart başlığı"
              value={editTitle}
              onChange={(e) => setEditTitle(e.currentTarget.value)}
              size="sm"
            />
          ) : (
            <Box>
              <Text size="xs" c="dimmed" mb={4}>
                Başlık
              </Text>
              <Text size="md" fw={600}>
                {card.title}
              </Text>
            </Box>
          )}

          <Divider />

          {/* ─── Content ─── */}
          <Box>
            <Text size="xs" c="dimmed" mb={6}>
              İçerik (
              {card.card_type === 'table'
                ? 'Tablo'
                : card.card_type === 'list'
                  ? 'Liste'
                  : card.card_type === 'number'
                    ? 'Sayı'
                    : 'Metin'}
              )
            </Text>
            {editing && card.card_type === 'text' ? (
              <Textarea
                placeholder="İçerik"
                value={editText}
                onChange={(e) => setEditText(e.currentTarget.value)}
                autosize
                minRows={4}
                maxRows={12}
              />
            ) : (
              <Box
                p="sm"
                style={{
                  background: 'var(--mantine-color-dark-6)',
                  borderRadius: 'var(--mantine-radius-sm)',
                  border: '1px solid var(--mantine-color-dark-4)',
                }}
              >
                <CardContentRenderer card={card} />
              </Box>
            )}
          </Box>

          {/* ─── Category (Edit Mode) ─── */}
          {editing && (
            <Select
              label="Kategori"
              placeholder="Kategori seç"
              value={editCategory}
              onChange={(val) => setEditCategory(val || 'diger')}
              data={[
                { value: 'operasyonel', label: 'Operasyonel' },
                { value: 'mali', label: 'Mali' },
                { value: 'teknik', label: 'Teknik' },
                { value: 'belgeler', label: 'Belgeler' },
                { value: 'diger', label: 'Diğer' },
              ]}
              size="sm"
            />
          )}

          <Divider />

          {/* ─── Metadata ─── */}
          <Group gap="lg" wrap="wrap">
            {card.document_name && (
              <Group gap={4}>
                <IconFileText size={14} style={{ color: 'var(--mantine-color-dimmed)' }} />
                <Text size="xs" c="dimmed">
                  Kaynak: {card.document_name}
                </Text>
              </Group>
            )}
            {createdDate && (
              <Group gap={4}>
                <IconCalendar size={14} style={{ color: 'var(--mantine-color-dimmed)' }} />
                <Text size="xs" c="dimmed">
                  {createdDate}
                </Text>
              </Group>
            )}
            {card.source_type && (
              <Badge size="xs" variant="light" color="violet">
                {card.source_type === 'ai'
                  ? 'AI Oluşturdu'
                  : card.source_type === 'pdf_selection'
                    ? 'PDF Seçimi'
                    : card.source_type}
              </Badge>
            )}
          </Group>

          {/* ─── Source Text (if available) ─── */}
          {card.source_text && (
            <Box>
              <Text size="xs" c="dimmed" mb={4}>
                Kaynak Metin
              </Text>
              <Box
                p="xs"
                style={{
                  background: 'var(--mantine-color-dark-8)',
                  borderRadius: 'var(--mantine-radius-sm)',
                  borderLeft: '3px solid var(--mantine-color-violet-7)',
                }}
              >
                <Text size="xs" c="dimmed" style={{ fontStyle: 'italic' }}>
                  &quot;{card.source_text.length > 300 ? `${card.source_text.substring(0, 300)}...` : card.source_text}
                  &quot;
                </Text>
              </Box>
            </Box>
          )}
        </Stack>
      </ScrollArea.Autosize>

      {/* ─── Footer Actions ─── */}
      <Group justify="space-between" p="md" style={{ borderTop: '1px solid var(--mantine-color-dark-4)' }}>
        <Tooltip label="Kartı sil">
          <ActionIcon variant="subtle" color="red" size="lg" onClick={handleDelete}>
            <IconTrash size={18} />
          </ActionIcon>
        </Tooltip>

        {editing ? (
          <Group gap="xs">
            <Button variant="subtle" color="gray" onClick={handleCancel} leftSection={<IconX size={14} />}>
              İptal
            </Button>
            <Button
              variant="filled"
              color="pink"
              onClick={handleSave}
              loading={isUpdating}
              leftSection={<IconCheck size={14} />}
            >
              Kaydet
            </Button>
          </Group>
        ) : (
          <Button variant="light" color="violet" onClick={handleStartEdit} leftSection={<IconEdit size={14} />}>
            Düzenle
          </Button>
        )}
      </Group>
    </Modal>
  );
}
