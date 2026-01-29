'use client';

import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Chip,
  Collapse,
  Group,
  Modal,
  Paper,
  ScrollArea,
  SegmentedControl,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import {
  IconBrain,
  IconCalculator,
  IconChevronDown,
  IconChevronUp,
  IconClipboardCopy,
  IconCoin,
  IconCopy,
  IconDownload,
  IconNote,
  IconPencil,
  IconPinned,
  IconPinnedOff,
  IconPlus,
  IconSearch,
  IconSettings,
  IconTag,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import { useState } from 'react';
import type { UseClipboardReturn } from '../hooks/useClipboard';
import {
  type ClipboardItem,
  type ClipboardPriority,
  type ClipboardTag,
  priorityConfig,
  tagConfig,
} from '../types';

interface ClipboardModalProps {
  clipboard: UseClipboardReturn;
}

export function ClipboardModal({ clipboard }: ClipboardModalProps) {
  const {
    items,
    modalOpened,
    setModalOpened,
    search,
    setSearch,
    showAddNote,
    setShowAddNote,
    addNote,
    updateItem,
    togglePin,
    copyItem,
    removeItem,
    copyAll,
    clearAll,
    downloadAsFile,
    getByCategory,
    getFiltered,
  } = clipboard;

  // Not ekleme state'leri
  const [noteContent, setNoteContent] = useState('');
  const [notePriority, setNotePriority] = useState<ClipboardPriority | undefined>(undefined);
  const [noteTags, setNoteTags] = useState<ClipboardTag[]>([]);
  const [noteColor, setNoteColor] = useState<string>('');

  // Düzenleme state'i
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  // Kategori görünürlüğü
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  const typeConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
    not: { icon: <IconPencil size={14} />, color: 'pink', label: 'Manuel Not' },
    teknik: { icon: <IconSettings size={14} />, color: 'violet', label: 'Teknik' },
    fiyat: { icon: <IconCoin size={14} />, color: 'green', label: 'Fiyat' },
    ai: { icon: <IconBrain size={14} />, color: 'blue', label: 'AI' },
    hesaplama: { icon: <IconCalculator size={14} />, color: 'orange', label: 'Hesaplama' },
    genel: { icon: <IconNote size={14} />, color: 'gray', label: 'Genel' },
  };

  const colorOptions = [
    { value: '', label: 'Varsayılan' },
    { value: 'pink', label: '🩷 Pembe' },
    { value: 'red', label: '❤️ Kırmızı' },
    { value: 'orange', label: '🧡 Turuncu' },
    { value: 'yellow', label: '💛 Sarı' },
    { value: 'green', label: '💚 Yeşil' },
    { value: 'teal', label: '💙 Turkuaz' },
    { value: 'blue', label: '💜 Mavi' },
    { value: 'violet', label: '🤍 Mor' },
  ];

  const handleAddNote = () => {
    if (
      addNote(
        noteContent,
        notePriority,
        noteTags.length > 0 ? noteTags : undefined,
        noteColor || undefined
      )
    ) {
      setNoteContent('');
      setNotePriority(undefined);
      setNoteTags([]);
      setNoteColor('');
    }
  };

  const handleStartEdit = (item: ClipboardItem) => {
    setEditingId(item.id);
    setEditContent(item.content);
  };

  const handleSaveEdit = () => {
    if (editingId && editContent.trim()) {
      updateItem(editingId, { content: editContent.trim() });
      setEditingId(null);
      setEditContent('');
    }
  };

  const toggleCategory = (cat: string) => {
    setCollapsedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  const renderClipboardItem = (item: ClipboardItem) => {
    const filteredItems = getFiltered();
    if (search && !filteredItems.find((i) => i.id === item.id)) return null;

    const config = typeConfig[item.type];
    const isEditing = editingId === item.id;
    const itemColor = item.color || config.color;

    return (
      <Paper
        key={item.id}
        p="sm"
        withBorder
        radius="md"
        style={{
          borderLeft: `4px solid var(--mantine-color-${itemColor}-5)`,
          background: item.isPinned
            ? 'linear-gradient(135deg, var(--mantine-color-yellow-0), var(--mantine-color-yellow-1))'
            : item.color
              ? `linear-gradient(135deg, var(--mantine-color-${item.color}-0), white)`
              : 'white',
          transition: 'all 0.2s ease',
        }}
        className="clipboard-item"
      >
        <Group justify="space-between" align="flex-start">
          <Box style={{ flex: 1 }}>
            {/* Üst Bilgiler */}
            <Group gap="xs" mb={6} wrap="wrap">
              {item.isPinned && (
                <Badge
                  size="xs"
                  variant="filled"
                  color="yellow"
                  leftSection={<IconPinned size={10} />}
                >
                  Sabitlenmiş
                </Badge>
              )}
              <Badge size="xs" variant="light" color={config.color} leftSection={config.icon}>
                {config.label}
              </Badge>
              {item.priority && (
                <Badge size="xs" variant="dot" color={priorityConfig[item.priority].color}>
                  {priorityConfig[item.priority].icon} {priorityConfig[item.priority].label}
                </Badge>
              )}
              {item.tags?.map((tag) => (
                <Badge
                  key={tag}
                  size="xs"
                  variant="outline"
                  color={tagConfig[tag].color}
                  leftSection={<IconTag size={8} />}
                >
                  {tagConfig[tag].label}
                </Badge>
              ))}
            </Group>

            {/* İçerik */}
            {isEditing ? (
              <Group gap="xs">
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  autosize
                  minRows={2}
                  style={{ flex: 1 }}
                  size="sm"
                />
                <Stack gap={4}>
                  <ActionIcon variant="filled" color="green" size="sm" onClick={handleSaveEdit}>
                    <IconPinned size={14} />
                  </ActionIcon>
                  <ActionIcon
                    variant="light"
                    color="gray"
                    size="sm"
                    onClick={() => setEditingId(null)}
                  >
                    <IconX size={14} />
                  </ActionIcon>
                </Stack>
              </Group>
            ) : (
              <Text size="sm" style={{ lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {item.content}
              </Text>
            )}

            {/* Alt Bilgi */}
            <Group gap="xs" mt={6}>
              <Text size="xs" c="dimmed">
                {item.source}
              </Text>
              <Text size="xs" c="dimmed">
                •
              </Text>
              <Text size="xs" c="dimmed">
                {new Date(item.createdAt).toLocaleString('tr-TR', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </Group>
          </Box>

          {/* Aksiyonlar */}
          {!isEditing && (
            <Group gap={4}>
              <Tooltip label={item.isPinned ? 'Sabitlemeyi Kaldır' : 'Sabitle'}>
                <ActionIcon
                  variant="subtle"
                  color={item.isPinned ? 'yellow' : 'gray'}
                  onClick={() => togglePin(item.id)}
                >
                  {item.isPinned ? <IconPinnedOff size={16} /> : <IconPinned size={16} />}
                </ActionIcon>
              </Tooltip>
              {item.type === 'not' && (
                <Tooltip label="Düzenle">
                  <ActionIcon variant="subtle" color="orange" onClick={() => handleStartEdit(item)}>
                    <IconPencil size={16} />
                  </ActionIcon>
                </Tooltip>
              )}
              <Tooltip label="Kopyala">
                <ActionIcon variant="subtle" color="blue" onClick={() => copyItem(item.content)}>
                  <IconCopy size={16} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Sil">
                <ActionIcon variant="subtle" color="red" onClick={() => removeItem(item.id)}>
                  <IconTrash size={16} />
                </ActionIcon>
              </Tooltip>
            </Group>
          )}
        </Group>
      </Paper>
    );
  };

  const renderCategory = (
    key: string,
    items: ClipboardItem[],
    icon: React.ReactNode,
    label: string,
    color: string
  ) => {
    if (items.length === 0) return null;
    const isCollapsed = collapsedCategories[key];

    return (
      <Box key={key}>
        <Group gap="xs" mb="xs" style={{ cursor: 'pointer' }} onClick={() => toggleCategory(key)}>
          {icon}
          <Text size="sm" fw={600} c={`${color}.7`}>
            {label} ({items.length})
          </Text>
          <ActionIcon variant="subtle" size="xs" color={color}>
            {isCollapsed ? <IconChevronDown size={14} /> : <IconChevronUp size={14} />}
          </ActionIcon>
        </Group>
        <Collapse in={!isCollapsed}>
          <Stack gap="xs">{items.map(renderClipboardItem)}</Stack>
        </Collapse>
      </Box>
    );
  };

  const categories = getByCategory();

  return (
    <Modal
      opened={modalOpened}
      onClose={() => setModalOpened(false)}
      title={
        <Group gap="sm">
          <ThemeIcon
            size={40}
            radius="xl"
            variant="gradient"
            gradient={{ from: 'pink', to: 'orange' }}
          >
            <IconClipboardCopy size={22} />
          </ThemeIcon>
          <div>
            <Text fw={700} size="lg">
              Çalışma Panosu
            </Text>
            <Text size="xs" c="dimmed">
              {items.length} öğe • İhale notları ve verileri
            </Text>
          </div>
        </Group>
      }
      size="xl"
      radius="lg"
      centered
      classNames={{ content: 'clipboard-modal-content' }}
      styles={{
        header: {
          padding: '16px 20px',
          borderBottom: '1px solid var(--mantine-color-pink-2)',
          background: 'linear-gradient(180deg, var(--mantine-color-pink-0) 0%, #fff 100%)',
        },
        body: { padding: 0 },
      }}
    >
      <Box className="clipboard-modal-body">
        {/* Üst Araç Çubuğu */}
        <Box
          p="md"
          style={{
            borderBottom: '1px solid var(--mantine-color-gray-2)',
            background: 'var(--mantine-color-gray-0)',
          }}
        >
          <Group justify="space-between" wrap="wrap" gap="sm">
            <Group gap="sm" style={{ flex: 1, minWidth: 250 }}>
              <TextInput
                placeholder="Panoda ara..."
                leftSection={<IconSearch size={16} />}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ flex: 1 }}
                size="sm"
              />
            </Group>
            <Group gap="xs">
              <Button
                variant="gradient"
                gradient={{ from: 'pink', to: 'violet' }}
                size="sm"
                leftSection={<IconPlus size={16} />}
                onClick={() => setShowAddNote(!showAddNote)}
              >
                Not Ekle
              </Button>
              <Button
                variant="light"
                color="blue"
                size="sm"
                leftSection={<IconCopy size={16} />}
                onClick={copyAll}
                disabled={items.length === 0}
              >
                Kopyala
              </Button>
              <Button
                variant="light"
                color="teal"
                size="sm"
                leftSection={<IconDownload size={16} />}
                onClick={downloadAsFile}
                disabled={items.length === 0}
              >
                İndir
              </Button>
              <Button
                variant="light"
                color="red"
                size="sm"
                leftSection={<IconTrash size={16} />}
                onClick={clearAll}
                disabled={items.length === 0}
              >
                Temizle
              </Button>
            </Group>
          </Group>
        </Box>

        {/* Not Ekleme Formu */}
        <Collapse in={showAddNote}>
          <Box
            p="md"
            style={{
              background:
                'linear-gradient(135deg, var(--mantine-color-pink-0), var(--mantine-color-violet-0))',
              borderBottom: '1px solid var(--mantine-color-pink-2)',
            }}
          >
            <Stack gap="sm">
              <Group align="flex-start" gap="sm">
                <ThemeIcon size={36} radius="xl" color="pink" variant="light">
                  <IconPencil size={18} />
                </ThemeIcon>
                <div style={{ flex: 1 }}>
                  <Text size="sm" fw={600} mb={4}>
                    Yeni Not Ekle
                  </Text>
                  <Text size="xs" c="dimmed">
                    İhale ile ilgili kendi notlarınızı ekleyin
                  </Text>
                </div>
                <ActionIcon variant="subtle" color="gray" onClick={() => setShowAddNote(false)}>
                  <IconX size={18} />
                </ActionIcon>
              </Group>

              <Textarea
                placeholder="Notunuzu yazın... (örn: Bu ihale için 3 rakip firma var, dikkatli fiyat vermeli)"
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                minRows={3}
                autosize
                styles={{
                  input: {
                    backgroundColor: '#fff',
                    color: '#1a1b1e',
                    border: '1px solid #e9ecef',
                  },
                }}
              />

              <Group gap="md" wrap="wrap">
                {/* Öncelik */}
                <div>
                  <Text size="xs" c="dimmed" mb={4}>
                    Öncelik
                  </Text>
                  <SegmentedControl
                    size="xs"
                    value={notePriority || ''}
                    onChange={(v) => setNotePriority((v as ClipboardPriority) || undefined)}
                    data={[
                      { value: '', label: 'Yok' },
                      { value: 'high', label: '🔴 Yüksek' },
                      { value: 'medium', label: '🟡 Orta' },
                      { value: 'low', label: '🟢 Düşük' },
                    ]}
                    className="clipboard-modal-segmented"
                  />
                </div>

                {/* Renk */}
                <div>
                  <Text size="xs" c="dimmed" mb={4}>
                    Renk
                  </Text>
                  <Select
                    size="xs"
                    value={noteColor}
                    onChange={(v) => setNoteColor(v || '')}
                    data={colorOptions}
                    w={130}
                    styles={{
                      input: {
                        backgroundColor: '#fff',
                        color: '#1a1b1e',
                        border: '1px solid #e9ecef',
                      },
                    }}
                  />
                </div>
              </Group>

              {/* Etiketler */}
              <div>
                <Text size="xs" c="dimmed" mb={4}>
                  Etiketler
                </Text>
                <Chip.Group
                  multiple
                  value={noteTags}
                  onChange={(v) => setNoteTags(v as ClipboardTag[])}
                >
                  <Group gap="xs">
                    {(Object.keys(tagConfig) as ClipboardTag[]).map((tag) => (
                      <Chip
                        key={tag}
                        value={tag}
                        size="xs"
                        color={tagConfig[tag].color}
                        variant="outline"
                      >
                        {tagConfig[tag].icon} {tagConfig[tag].label}
                      </Chip>
                    ))}
                  </Group>
                </Chip.Group>
              </div>

              <Button
                variant="gradient"
                gradient={{ from: 'pink', to: 'violet' }}
                leftSection={<IconPlus size={16} />}
                onClick={handleAddNote}
                disabled={!noteContent.trim()}
              >
                Notu Kaydet
              </Button>
            </Stack>
          </Box>
        </Collapse>

        {/* İçerik - form ile arasında boşluk, çakışma önlenir */}
        <ScrollArea h={showAddNote ? 320 : 450} p="md" mt={showAddNote ? 'md' : 0}>
          {items.length === 0 ? (
            <Stack align="center" justify="center" style={{ minHeight: 220 }} py="xl" gap="md">
              <ThemeIcon size={80} variant="light" color="pink" radius="xl">
                <IconClipboardCopy size={40} />
              </ThemeIcon>
              <div style={{ textAlign: 'center' }}>
                <Text size="lg" c="dimmed" fw={500}>
                  Çalışma Panosu Boş
                </Text>
                <Text size="sm" c="dimmed" mt={8} maw={400}>
                  Kendi notlarınızı eklemek için yukarıdaki &quot;Not Ekle&quot; butonunu kullanın.
                  <br />
                  Ya da dökümanlardan öğelerin yanındaki 📋 butonuyla panoya ekleyin.
                </Text>
                <Button
                  variant="light"
                  color="pink"
                  mt="md"
                  leftSection={<IconPlus size={16} />}
                  onClick={() => setShowAddNote(true)}
                >
                  İlk Notunuzu Ekleyin
                </Button>
              </div>
            </Stack>
          ) : (
            <Stack gap="lg">
              {/* Sabitlenmiş */}
              {renderCategory(
                'pinned',
                categories.pinned,
                <IconPinned size={16} color="var(--mantine-color-yellow-6)" />,
                'SABİTLENMİŞ',
                'yellow'
              )}

              {/* Manuel Notlar */}
              {renderCategory(
                'not',
                categories.not,
                <IconPencil size={16} color="var(--mantine-color-pink-6)" />,
                'MANUEL NOTLAR',
                'pink'
              )}

              {/* Teknik */}
              {renderCategory(
                'teknik',
                categories.teknik,
                <IconSettings size={16} color="var(--mantine-color-violet-6)" />,
                'TEKNİK ŞARTLAR',
                'violet'
              )}

              {/* Fiyat */}
              {renderCategory(
                'fiyat',
                categories.fiyat,
                <IconCoin size={16} color="var(--mantine-color-green-6)" />,
                'BİRİM FİYATLAR',
                'green'
              )}

              {/* AI */}
              {renderCategory(
                'ai',
                categories.ai,
                <IconBrain size={16} color="var(--mantine-color-blue-6)" />,
                'AI NOTLARI',
                'blue'
              )}

              {/* Hesaplama */}
              {renderCategory(
                'hesaplama',
                categories.hesaplama,
                <IconCalculator size={16} color="var(--mantine-color-orange-6)" />,
                'HESAPLAMALAR',
                'orange'
              )}

              {/* Genel */}
              {renderCategory(
                'genel',
                categories.genel,
                <IconNote size={16} color="var(--mantine-color-gray-6)" />,
                'GENEL NOTLAR',
                'gray'
              )}
            </Stack>
          )}
        </ScrollArea>

        {/* Alt Bilgi */}
        <Box
          p="sm"
          style={{
            borderTop: '1px solid var(--mantine-color-gray-2)',
            background: 'var(--mantine-color-gray-0)',
          }}
        >
          <Group justify="space-between">
            <Text size="xs" c="dimmed">
              💡 İpucu: Notları sabitleyerek en üste taşıyabilirsiniz
            </Text>
            {items.length > 0 && (
              <Badge variant="light" color="pink">
                {items.filter((i) => i.type === 'not').length} manuel not
              </Badge>
            )}
          </Group>
        </Box>
      </Box>
    </Modal>
  );
}
