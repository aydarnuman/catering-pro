import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Divider,
  Group,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core';
import {
  IconArrowLeft,
  IconBrain,
  IconCheck,
  IconDeviceFloppy,
  IconEdit,
  IconFileCertificate,
  IconFileText,
  IconLink,
  IconMathFunction,
  IconNote,
  IconTrash,
  IconUser,
  IconX,
} from '@tabler/icons-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useState } from 'react';
import { ATTACHMENT_TYPES, ATTACHMENT_TYPE_MAP, SPRING_CONFIG } from '../constants';
import type { AttachmentType, OrbitAttachment } from '../types';

const ICON_MAP: Record<string, typeof IconNote> = {
  note: IconNote,
  'file-text': IconFileText,
  'file-certificate': IconFileCertificate,
  brain: IconBrain,
  link: IconLink,
  user: IconUser,
  'math-function': IconMathFunction,
};

// ─── View Mode ──────────────────────────────────────────

interface ViewProps {
  attachment: OrbitAttachment;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
  onSaveVirtual?: () => void;
}

function ViewMode({ attachment, onEdit, onDelete, onClose, onSaveVirtual }: ViewProps) {
  const config = ATTACHMENT_TYPE_MAP[attachment.type];
  const Icon = ICON_MAP[config?.icon || 'note'] || IconNote;
  const isVirtual = !!attachment.virtual;
  const [saving, setSaving] = useState(false);

  return (
    <Stack gap="sm" style={{ flex: 1, minHeight: 0 }}>
      {/* Header */}
      <Group justify="space-between" align="flex-start" px="md" pt="md">
        <Group gap="xs" align="center" style={{ flex: 1, minWidth: 0 }}>
          <Icon size={18} color={`var(--mantine-color-${config?.color || 'yellow'}-5)`} />
          <Text size="sm" fw={700} c="white" lineClamp={2} style={{ flex: 1 }}>
            {attachment.title || 'Baslissiz'}
          </Text>
        </Group>
        <Group gap={4}>
          {isVirtual ? (
            <ActionIcon
              variant="gradient"
              gradient={{ from: 'teal', to: 'green' }}
              size="sm"
              loading={saving}
              onClick={async () => {
                setSaving(true);
                await onSaveVirtual?.();
                setSaving(false);
              }}
            >
              <IconDeviceFloppy size={14} />
            </ActionIcon>
          ) : (
            <>
              <ActionIcon variant="subtle" color="gray" size="sm" onClick={onEdit}>
                <IconEdit size={14} />
              </ActionIcon>
              <ActionIcon variant="subtle" color="red" size="sm" onClick={onDelete}>
                <IconTrash size={14} />
              </ActionIcon>
            </>
          )}
          <ActionIcon variant="subtle" color="gray" size="sm" onClick={onClose}>
            <IconX size={14} />
          </ActionIcon>
        </Group>
      </Group>

      {/* Type badge + date */}
      <Group gap="xs" px="md">
        <Badge size="xs" color={config?.color || 'yellow'} variant="light">
          {config?.label || attachment.type}
        </Badge>
        {isVirtual && (
          <Badge size="xs" color="teal" variant="outline">
            AI Analiz
          </Badge>
        )}
        {attachment.sourceAgent && (
          <Badge size="xs" color="indigo" variant="outline">
            Agent
          </Badge>
        )}
        {attachment.pinned && (
          <Badge size="xs" color="orange" variant="outline">
            Sabitlenmis
          </Badge>
        )}
      </Group>

      <Divider color="dark.5" mx="md" />

      {/* Content */}
      <Box
        px="md"
        pb="md"
        style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}
      >
        <Text
          size="xs"
          c="gray.4"
          style={{ lineHeight: 1.7, whiteSpace: 'pre-wrap' }}
        >
          {attachment.content || 'Icerik yok'}
        </Text>

        {/* URL for link type */}
        {attachment.url && (
          <Box mt="sm">
            <Text size="10px" c="dimmed">Baglanti:</Text>
            <Text
              size="xs"
              c="teal"
              component="a"
              href={attachment.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ wordBreak: 'break-all' }}
            >
              {attachment.url}
            </Text>
          </Box>
        )}

        {/* Tags */}
        {attachment.tags && attachment.tags.length > 0 && (
          <Group gap={4} mt="sm">
            {attachment.tags.map((tag) => (
              <Badge key={tag.id} size="xs" color={tag.color || 'gray'} variant="dot">
                {tag.name}
              </Badge>
            ))}
          </Group>
        )}

        {/* Timestamp */}
        <Text size="10px" c="dimmed" mt="sm">
          {attachment.createdAt ? new Date(attachment.createdAt).toLocaleDateString('tr-TR', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }) : ''}
        </Text>
      </Box>
    </Stack>
  );
}

// ─── Edit Mode ──────────────────────────────────────────

interface EditProps {
  attachment: OrbitAttachment;
  onSave: (id: string, updates: { title?: string; content?: string }) => Promise<void>;
  onCancel: () => void;
}

function EditMode({ attachment, onSave, onCancel }: EditProps) {
  const [title, setTitle] = useState(attachment.title);
  const [content, setContent] = useState(attachment.content);
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    setSaving(true);
    await onSave(attachment.id, { title, content });
    setSaving(false);
    onCancel();
  }, [attachment.id, title, content, onSave, onCancel]);

  return (
    <Stack gap="sm" px="md" pt="md" pb="md" style={{ flex: 1, minHeight: 0 }}>
      <Group justify="space-between">
        <Text size="sm" fw={700} c="white">Duzenle</Text>
        <ActionIcon variant="subtle" color="gray" size="sm" onClick={onCancel}>
          <IconX size={14} />
        </ActionIcon>
      </Group>

      <TextInput
        size="xs"
        placeholder="Baslik"
        value={title}
        onChange={(e) => setTitle(e.currentTarget.value)}
        styles={{ input: { background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)' } }}
      />

      <Textarea
        size="xs"
        placeholder="Icerik"
        value={content}
        onChange={(e) => setContent(e.currentTarget.value)}
        minRows={6}
        maxRows={12}
        autosize
        styles={{ input: { background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)' } }}
      />

      <Group justify="flex-end" gap="xs">
        <Button size="xs" variant="subtle" color="gray" onClick={onCancel}>
          Iptal
        </Button>
        <Button
          size="xs"
          variant="gradient"
          gradient={{ from: 'indigo', to: 'violet' }}
          leftSection={<IconCheck size={14} />}
          loading={saving}
          onClick={handleSave}
        >
          Kaydet
        </Button>
      </Group>
    </Stack>
  );
}

// ─── Create Mode ────────────────────────────────────────

interface CreateProps {
  initialType?: AttachmentType;
  onSave: (input: {
    title: string;
    type: AttachmentType;
    content: string;
    url?: string;
  }) => Promise<unknown>;
  onClose: () => void;
}

function CreateMode({ initialType, onSave, onClose }: CreateProps) {
  const [selectedType, setSelectedType] = useState<AttachmentType | null>(initialType || null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [url, setUrl] = useState('');
  const [saving, setSaving] = useState(false);

  const creatableTypes = ATTACHMENT_TYPES.filter((t) => t.userCreatable);

  const handleSave = useCallback(async () => {
    if (!selectedType || !title.trim()) return;
    setSaving(true);
    await onSave({
      title: title.trim(),
      type: selectedType,
      content: content.trim(),
      ...(selectedType === 'link' && url.trim() ? { url: url.trim() } : {}),
    });
    setSaving(false);
    onClose();
  }, [selectedType, title, content, url, onSave, onClose]);

  // Step 1: Type selection
  if (!selectedType) {
    return (
      <Stack gap="sm" px="md" pt="md" pb="md" style={{ flex: 1, minHeight: 0 }}>
        <Group justify="space-between">
          <Text size="sm" fw={700} c="white">Yeni Ekle</Text>
          <ActionIcon variant="subtle" color="gray" size="sm" onClick={onClose}>
            <IconX size={14} />
          </ActionIcon>
        </Group>

        <Text size="xs" c="dimmed">Tip secin:</Text>

        <SimpleGrid cols={2} spacing={6}>
          {creatableTypes.map((typeConfig) => {
            const Icon = ICON_MAP[typeConfig.icon] || IconNote;
            return (
              <Box
                key={typeConfig.type}
                p="xs"
                onClick={() => setSelectedType(typeConfig.type)}
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.06)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = `var(--mantine-color-${typeConfig.color}-5)`;
                  (e.currentTarget as HTMLDivElement).style.background = `rgba(255,255,255,0.05)`;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.06)';
                  (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.03)';
                }}
              >
                <Group gap={6} wrap="nowrap">
                  <Icon size={14} color={`var(--mantine-color-${typeConfig.color}-5)`} />
                  <div>
                    <Text size="xs" fw={600} c="white" lineClamp={1}>{typeConfig.label}</Text>
                    <Text size="10px" c="dimmed" lineClamp={1}>{typeConfig.description}</Text>
                  </div>
                </Group>
              </Box>
            );
          })}
        </SimpleGrid>
      </Stack>
    );
  }

  // Step 2: Form
  const config = ATTACHMENT_TYPE_MAP[selectedType];
  const TypeIcon = ICON_MAP[config?.icon || 'note'] || IconNote;

  return (
    <Stack gap="sm" px="md" pt="md" pb="md" style={{ flex: 1, minHeight: 0 }}>
      <Group justify="space-between">
        <Group gap="xs">
          <ActionIcon variant="subtle" color="gray" size="sm" onClick={() => setSelectedType(null)}>
            <IconArrowLeft size={14} />
          </ActionIcon>
          <TypeIcon size={16} color={`var(--mantine-color-${config?.color || 'yellow'}-5)`} />
          <Text size="sm" fw={700} c="white">{config?.label}</Text>
        </Group>
        <ActionIcon variant="subtle" color="gray" size="sm" onClick={onClose}>
          <IconX size={14} />
        </ActionIcon>
      </Group>

      <TextInput
        size="xs"
        placeholder="Baslik *"
        value={title}
        onChange={(e) => setTitle(e.currentTarget.value)}
        styles={{ input: { background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)' } }}
      />

      {selectedType === 'link' && (
        <TextInput
          size="xs"
          placeholder="URL (https://...)"
          value={url}
          onChange={(e) => setUrl(e.currentTarget.value)}
          styles={{ input: { background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)' } }}
        />
      )}

      <Textarea
        size="xs"
        placeholder="Icerik"
        value={content}
        onChange={(e) => setContent(e.currentTarget.value)}
        minRows={4}
        maxRows={10}
        autosize
        styles={{ input: { background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)' } }}
      />

      <Group justify="flex-end" gap="xs">
        <Button size="xs" variant="subtle" color="gray" onClick={onClose}>
          Iptal
        </Button>
        <Button
          size="xs"
          variant="gradient"
          gradient={{ from: config?.color || 'indigo', to: config?.color || 'violet' }}
          leftSection={<IconCheck size={14} />}
          loading={saving}
          disabled={!title.trim()}
          onClick={handleSave}
        >
          Olustur
        </Button>
      </Group>
    </Stack>
  );
}

// ─── Main Overlay ───────────────────────────────────────

interface OrbitDetailOverlayProps {
  attachment: OrbitAttachment | null;
  mode: 'view' | 'edit' | 'create';
  createType?: AttachmentType;
  onSave: (id: string, updates: { title?: string; content?: string }) => Promise<void>;
  onCreate: (input: {
    title: string;
    type: AttachmentType;
    content: string;
    url?: string;
  }) => Promise<unknown>;
  onDelete: (id: string) => Promise<void>;
  onSaveVirtual?: (id: string) => Promise<void>;
  onClose: () => void;
  onEdit: (id: string) => void;
}

export function OrbitDetailOverlay({
  attachment,
  mode,
  createType,
  onSave,
  onCreate,
  onDelete,
  onSaveVirtual,
  onClose,
  onEdit,
}: OrbitDetailOverlayProps) {
  const isOpen = mode === 'create' || !!attachment;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="orbit-detail-overlay"
          initial={{ opacity: 0, rotateY: 90 }}
          animate={{ opacity: 1, rotateY: 0 }}
          exit={{ opacity: 0, rotateY: -90 }}
          transition={{ ...SPRING_CONFIG.stiff, duration: 0.3 }}
          onClick={(e) => e.stopPropagation()}
        >
          {mode === 'create' && (
            <CreateMode
              initialType={createType}
              onSave={onCreate}
              onClose={onClose}
            />
          )}
          {mode === 'edit' && attachment && (
            <EditMode
              attachment={attachment}
              onSave={onSave}
              onCancel={onClose}
            />
          )}
          {mode === 'view' && attachment && (
            <ViewMode
              attachment={attachment}
              onEdit={() => onEdit(attachment.id)}
              onDelete={() => onDelete(attachment.id)}
              onSaveVirtual={onSaveVirtual ? () => onSaveVirtual(attachment.id) : undefined}
              onClose={onClose}
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
