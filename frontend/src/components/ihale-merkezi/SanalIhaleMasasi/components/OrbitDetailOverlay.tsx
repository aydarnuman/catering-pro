import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Divider,
  Group,
  NumberInput,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
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
  IconPlus,
  IconTrash,
  IconUser,
  IconX,
} from '@tabler/icons-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useState } from 'react';
import { ATTACHMENT_TYPE_MAP, ATTACHMENT_TYPES, SPRING_CONFIG } from '../constants';
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
      <Box px="md" pb="md" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <Text size="xs" c="gray.4" style={{ lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
          {attachment.content || 'Icerik yok'}
        </Text>

        {/* URL for link type */}
        {attachment.url && (
          <Box mt="sm">
            <Text size="10px" c="dimmed">
              Baglanti:
            </Text>
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
          {attachment.createdAt
            ? new Date(attachment.createdAt).toLocaleDateString('tr-TR', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
            : ''}
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
        <Text size="sm" fw={700} c="white">
          Duzenle
        </Text>
        <ActionIcon variant="subtle" color="gray" size="sm" onClick={onCancel}>
          <IconX size={14} />
        </ActionIcon>
      </Group>

      <TextInput
        size="xs"
        placeholder="Baslik"
        value={title}
        onChange={(e) => setTitle(e.currentTarget.value)}
        styles={{
          input: { background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)' },
        }}
      />

      <Textarea
        size="xs"
        placeholder="Icerik"
        value={content}
        onChange={(e) => setContent(e.currentTarget.value)}
        minRows={6}
        maxRows={12}
        autosize
        styles={{
          input: { background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)' },
        }}
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
    metadata?: Record<string, unknown>;
  }) => Promise<unknown>;
  onClose: () => void;
}

// ─── Shared form styles & helpers ────────────────────────

const DARK_INPUT_STYLES = {
  input: {
    background: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.1)',
  },
};

interface FormShellProps {
  config: { label: string; icon: string; color: string } | undefined;
  saving: boolean;
  disabled: boolean;
  onBack: () => void;
  onClose: () => void;
  onSubmit: () => void;
  children: React.ReactNode;
}

/** Shared header + footer wrapper for all create forms */
function FormShell({
  config,
  saving,
  disabled,
  onBack,
  onClose,
  onSubmit,
  children,
}: FormShellProps) {
  const TypeIcon = ICON_MAP[config?.icon || 'note'] || IconNote;
  return (
    <Stack gap="sm" px="md" pt="md" pb="md" style={{ flex: 1, minHeight: 0 }}>
      <Group justify="space-between">
        <Group gap="xs">
          <ActionIcon variant="subtle" color="gray" size="sm" onClick={onBack}>
            <IconArrowLeft size={14} />
          </ActionIcon>
          <TypeIcon size={16} color={`var(--mantine-color-${config?.color || 'yellow'}-5)`} />
          <Text size="sm" fw={700} c="white">
            {config?.label}
          </Text>
        </Group>
        <ActionIcon variant="subtle" color="gray" size="sm" onClick={onClose}>
          <IconX size={14} />
        </ActionIcon>
      </Group>

      {children}

      <Group justify="flex-end" gap="xs">
        <Button size="xs" variant="subtle" color="gray" onClick={onClose}>
          Iptal
        </Button>
        <Button
          size="xs"
          variant="gradient"
          gradient={{
            from: config?.color || 'indigo',
            to: config?.color || 'violet',
          }}
          leftSection={<IconCheck size={14} />}
          loading={saving}
          disabled={disabled}
          onClick={onSubmit}
        >
          Olustur
        </Button>
      </Group>
    </Stack>
  );
}

// ─── NoteForm ────────────────────────────────────────────

function NoteForm({
  onSave,
  onBack,
  onClose,
}: {
  onSave: CreateProps['onSave'];
  onBack: () => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const config = ATTACHMENT_TYPE_MAP.note;

  const handleSubmit = useCallback(async () => {
    if (!title.trim()) return;
    setSaving(true);
    await onSave({ title: title.trim(), type: 'note', content: content.trim() });
    setSaving(false);
    onClose();
  }, [title, content, onSave, onClose]);

  return (
    <FormShell
      config={config}
      saving={saving}
      disabled={!title.trim()}
      onBack={onBack}
      onClose={onClose}
      onSubmit={handleSubmit}
    >
      <TextInput
        size="xs"
        placeholder="Baslik *"
        value={title}
        onChange={(e) => setTitle(e.currentTarget.value)}
        styles={DARK_INPUT_STYLES}
      />
      <Textarea
        size="xs"
        placeholder="Not icerigi"
        value={content}
        onChange={(e) => setContent(e.currentTarget.value)}
        minRows={4}
        maxRows={10}
        autosize
        styles={DARK_INPUT_STYLES}
      />
    </FormShell>
  );
}

// ─── LinkForm ────────────────────────────────────────────

function LinkForm({
  onSave,
  onBack,
  onClose,
}: {
  onSave: CreateProps['onSave'];
  onBack: () => void;
  onClose: () => void;
}) {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const config = ATTACHMENT_TYPE_MAP.link;

  const handleSubmit = useCallback(async () => {
    if (!url.trim()) return;
    setSaving(true);
    const finalTitle = title.trim() || url.trim();
    await onSave({
      title: finalTitle,
      type: 'link',
      content: description.trim(),
      url: url.trim(),
    });
    setSaving(false);
    onClose();
  }, [url, title, description, onSave, onClose]);

  return (
    <FormShell
      config={config}
      saving={saving}
      disabled={!url.trim()}
      onBack={onBack}
      onClose={onClose}
      onSubmit={handleSubmit}
    >
      <TextInput
        size="xs"
        placeholder="URL (https://...) *"
        value={url}
        onChange={(e) => setUrl(e.currentTarget.value)}
        styles={DARK_INPUT_STYLES}
      />
      <TextInput
        size="xs"
        placeholder="Baslik (opsiyonel — bos birakirsan URL kullanilir)"
        value={title}
        onChange={(e) => setTitle(e.currentTarget.value)}
        styles={DARK_INPUT_STYLES}
      />
      <Textarea
        size="xs"
        placeholder="Aciklama (opsiyonel)"
        value={description}
        onChange={(e) => setDescription(e.currentTarget.value)}
        minRows={2}
        maxRows={5}
        autosize
        styles={DARK_INPUT_STYLES}
      />
    </FormShell>
  );
}

// ─── ContactForm ─────────────────────────────────────────

function ContactForm({
  onSave,
  onBack,
  onClose,
}: {
  onSave: CreateProps['onSave'];
  onBack: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const config = ATTACHMENT_TYPE_MAP.contact;

  const handleSubmit = useCallback(async () => {
    if (!name.trim()) return;
    setSaving(true);

    // Build markdown content for display
    const lines: string[] = [`**${name.trim()}**`];
    if (company.trim()) lines.push(`Kurum: ${company.trim()}`);
    if (role.trim()) lines.push(`Rol: ${role.trim()}`);
    if (phone.trim()) lines.push(`Tel: ${phone.trim()}`);
    if (email.trim()) lines.push(`Email: ${email.trim()}`);
    if (note.trim()) lines.push(`\n${note.trim()}`);

    await onSave({
      title: name.trim(),
      type: 'contact',
      content: lines.join('\n'),
      metadata: {
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        company: company.trim() || undefined,
        role: role.trim() || undefined,
      },
    });
    setSaving(false);
    onClose();
  }, [name, phone, email, company, role, note, onSave, onClose]);

  return (
    <FormShell
      config={config}
      saving={saving}
      disabled={!name.trim()}
      onBack={onBack}
      onClose={onClose}
      onSubmit={handleSubmit}
    >
      <TextInput
        size="xs"
        placeholder="Ad Soyad *"
        value={name}
        onChange={(e) => setName(e.currentTarget.value)}
        styles={DARK_INPUT_STYLES}
      />
      <Group grow gap="xs">
        <TextInput
          size="xs"
          placeholder="Telefon"
          value={phone}
          onChange={(e) => setPhone(e.currentTarget.value)}
          styles={DARK_INPUT_STYLES}
        />
        <TextInput
          size="xs"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.currentTarget.value)}
          styles={DARK_INPUT_STYLES}
        />
      </Group>
      <Group grow gap="xs">
        <TextInput
          size="xs"
          placeholder="Kurum"
          value={company}
          onChange={(e) => setCompany(e.currentTarget.value)}
          styles={DARK_INPUT_STYLES}
        />
        <TextInput
          size="xs"
          placeholder="Rol / Gorev"
          value={role}
          onChange={(e) => setRole(e.currentTarget.value)}
          styles={DARK_INPUT_STYLES}
        />
      </Group>
      <Textarea
        size="xs"
        placeholder="Not (opsiyonel)"
        value={note}
        onChange={(e) => setNote(e.currentTarget.value)}
        minRows={2}
        maxRows={4}
        autosize
        styles={DARK_INPUT_STYLES}
      />
    </FormShell>
  );
}

// ─── CalculationForm ─────────────────────────────────────

interface CalcRow {
  key: string;
  label: string;
  quantity: number | '';
  unitPrice: number | '';
}

let calcRowCounter = 0;
function createCalcRow(): CalcRow {
  return { key: `cr-${++calcRowCounter}`, label: '', quantity: '', unitPrice: '' };
}

function CalculationForm({
  onSave,
  onBack,
  onClose,
}: {
  onSave: CreateProps['onSave'];
  onBack: () => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState('');
  const [rows, setRows] = useState<CalcRow[]>([createCalcRow()]);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const config = ATTACHMENT_TYPE_MAP.calculation;

  const addRow = useCallback(() => {
    setRows((prev) => [...prev, createCalcRow()]);
  }, []);

  const removeRow = useCallback((idx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const updateRow = useCallback(
    (idx: number, field: keyof CalcRow, value: string | number | '') => {
      setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
    },
    []
  );

  const total = rows.reduce((sum, r) => {
    const q = typeof r.quantity === 'number' ? r.quantity : 0;
    const p = typeof r.unitPrice === 'number' ? r.unitPrice : 0;
    return sum + q * p;
  }, 0);

  const validRows = rows.filter((r) => r.label.trim() && r.quantity !== '' && r.unitPrice !== '');

  const handleSubmit = useCallback(async () => {
    if (!title.trim() || validRows.length === 0) return;
    setSaving(true);

    // Build markdown table
    const lines = ['| Kalem | Miktar | Birim Fiyat | Tutar |', '|---|---|---|---|'];
    for (const r of validRows) {
      const q = typeof r.quantity === 'number' ? r.quantity : 0;
      const p = typeof r.unitPrice === 'number' ? r.unitPrice : 0;
      lines.push(
        `| ${r.label} | ${q} | ${p.toLocaleString('tr-TR')} | ${(q * p).toLocaleString('tr-TR')} |`
      );
    }
    lines.push(`| **TOPLAM** | | | **${total.toLocaleString('tr-TR')}** |`);
    if (note.trim()) lines.push(`\n${note.trim()}`);

    await onSave({
      title: title.trim(),
      type: 'calculation',
      content: lines.join('\n'),
      metadata: {
        rows: validRows.map((r) => ({
          label: r.label,
          quantity: r.quantity,
          unitPrice: r.unitPrice,
          total:
            (typeof r.quantity === 'number' ? r.quantity : 0) *
            (typeof r.unitPrice === 'number' ? r.unitPrice : 0),
        })),
        total,
      },
    });
    setSaving(false);
    onClose();
  }, [title, validRows, total, note, onSave, onClose]);

  return (
    <FormShell
      config={config}
      saving={saving}
      disabled={!title.trim() || validRows.length === 0}
      onBack={onBack}
      onClose={onClose}
      onSubmit={handleSubmit}
    >
      <TextInput
        size="xs"
        placeholder="Hesaplama basligi *"
        value={title}
        onChange={(e) => setTitle(e.currentTarget.value)}
        styles={DARK_INPUT_STYLES}
      />

      {/* Column headers */}
      <Group gap={4} wrap="nowrap">
        <Text size="9px" c="dimmed" fw={600} w="35%" pl={4}>
          KALEM
        </Text>
        <Text size="9px" c="dimmed" fw={600} w="18%" ta="center">
          MIKTAR
        </Text>
        <Text size="9px" c="dimmed" fw={600} w="25%" ta="center">
          B.FIYAT
        </Text>
        <Text size="9px" c="dimmed" fw={600} w="22%" ta="right" pr={28}>
          TUTAR
        </Text>
      </Group>

      {/* Rows */}
      <Stack gap={4}>
        {rows.map((row, idx) => {
          const q = typeof row.quantity === 'number' ? row.quantity : 0;
          const p = typeof row.unitPrice === 'number' ? row.unitPrice : 0;
          const rowTotal = q * p;
          return (
            <Group key={row.key} gap={4} wrap="nowrap" align="flex-end">
              <TextInput
                size="xs"
                placeholder="Kalem"
                value={row.label}
                onChange={(e) => updateRow(idx, 'label', e.currentTarget.value)}
                styles={DARK_INPUT_STYLES}
                style={{ flex: 3.5 }}
              />
              <NumberInput
                size="xs"
                placeholder="0"
                value={row.quantity}
                onChange={(v) => updateRow(idx, 'quantity', v === '' ? '' : Number(v))}
                min={0}
                hideControls
                styles={DARK_INPUT_STYLES}
                style={{ flex: 1.8 }}
              />
              <NumberInput
                size="xs"
                placeholder="0"
                value={row.unitPrice}
                onChange={(v) => updateRow(idx, 'unitPrice', v === '' ? '' : Number(v))}
                min={0}
                hideControls
                styles={DARK_INPUT_STYLES}
                style={{ flex: 2.5 }}
              />
              <Text size="xs" c="gray.4" fw={500} ta="right" style={{ flex: 2.2, minWidth: 0 }}>
                {rowTotal > 0 ? rowTotal.toLocaleString('tr-TR') : '—'}
              </Text>
              <ActionIcon
                variant="subtle"
                color="red"
                size="xs"
                onClick={() => removeRow(idx)}
                disabled={rows.length <= 1}
              >
                <IconTrash size={12} />
              </ActionIcon>
            </Group>
          );
        })}
      </Stack>

      <Button
        size="xs"
        variant="subtle"
        color="gray"
        leftSection={<IconPlus size={12} />}
        onClick={addRow}
        style={{ alignSelf: 'flex-start' }}
      >
        Satir Ekle
      </Button>

      {/* Total */}
      <Divider color="rgba(255,255,255,0.08)" />
      <Group justify="flex-end" pr={28}>
        <Text size="xs" c="dimmed" fw={600}>
          TOPLAM:
        </Text>
        <Text size="sm" c="white" fw={700}>
          {total.toLocaleString('tr-TR')} TL
        </Text>
      </Group>

      <Textarea
        size="xs"
        placeholder="Not (opsiyonel)"
        value={note}
        onChange={(e) => setNote(e.currentTarget.value)}
        minRows={2}
        maxRows={4}
        autosize
        styles={DARK_INPUT_STYLES}
      />
    </FormShell>
  );
}

// ─── DocumentForm ────────────────────────────────────────

function DocumentForm({
  onSave,
  onBack,
  onClose,
}: {
  onSave: CreateProps['onSave'];
  onBack: () => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const config = ATTACHMENT_TYPE_MAP.document;

  const handleSubmit = useCallback(async () => {
    if (!title.trim()) return;
    setSaving(true);
    await onSave({
      title: title.trim(),
      type: 'document',
      content: description.trim(),
    });
    setSaving(false);
    onClose();
  }, [title, description, onSave, onClose]);

  return (
    <FormShell
      config={config}
      saving={saving}
      disabled={!title.trim()}
      onBack={onBack}
      onClose={onClose}
      onSubmit={handleSubmit}
    >
      <TextInput
        size="xs"
        placeholder="Dokuman basligi *"
        value={title}
        onChange={(e) => setTitle(e.currentTarget.value)}
        styles={DARK_INPUT_STYLES}
      />
      <Box
        p="md"
        style={{
          background: 'rgba(255,255,255,0.02)',
          borderRadius: 10,
          border: '1px dashed rgba(255,255,255,0.1)',
          textAlign: 'center',
        }}
      >
        <IconFileText size={24} color="rgba(255,255,255,0.3)" />
        <Text size="xs" c="dimmed" mt={4}>
          Dosya yukleme yakindir eklenecek
        </Text>
      </Box>
      <Textarea
        size="xs"
        placeholder="Aciklama (opsiyonel)"
        value={description}
        onChange={(e) => setDescription(e.currentTarget.value)}
        minRows={2}
        maxRows={5}
        autosize
        styles={DARK_INPUT_STYLES}
      />
    </FormShell>
  );
}

// ─── CreateMode (orchestrator) ───────────────────────────

function CreateMode({ initialType, onSave, onClose }: CreateProps) {
  const [selectedType, setSelectedType] = useState<AttachmentType | null>(initialType || null);

  const creatableTypes = ATTACHMENT_TYPES.filter((t) => t.userCreatable);
  const goBack = useCallback(() => setSelectedType(null), []);

  // Step 1: Type selection
  if (!selectedType) {
    return (
      <Stack gap="sm" px="md" pt="md" pb="md" style={{ flex: 1, minHeight: 0 }}>
        <Group justify="space-between">
          <Text size="sm" fw={700} c="white">
            Yeni Ekle
          </Text>
          <ActionIcon variant="subtle" color="gray" size="sm" onClick={onClose}>
            <IconX size={14} />
          </ActionIcon>
        </Group>

        <Text size="xs" c="dimmed">
          Tip secin:
        </Text>

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
                  (e.currentTarget as HTMLDivElement).style.borderColor =
                    `var(--mantine-color-${typeConfig.color}-5)`;
                  (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.05)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.06)';
                  (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.03)';
                }}
              >
                <Group gap={6} wrap="nowrap">
                  <Icon size={14} color={`var(--mantine-color-${typeConfig.color}-5)`} />
                  <div>
                    <Text size="xs" fw={600} c="white" lineClamp={1}>
                      {typeConfig.label}
                    </Text>
                    <Text size="10px" c="dimmed" lineClamp={1}>
                      {typeConfig.description}
                    </Text>
                  </div>
                </Group>
              </Box>
            );
          })}
        </SimpleGrid>
      </Stack>
    );
  }

  // Step 2: Type-specific form
  switch (selectedType) {
    case 'link':
      return <LinkForm onSave={onSave} onBack={goBack} onClose={onClose} />;
    case 'contact':
      return <ContactForm onSave={onSave} onBack={goBack} onClose={onClose} />;
    case 'calculation':
      return <CalculationForm onSave={onSave} onBack={goBack} onClose={onClose} />;
    case 'document':
      return <DocumentForm onSave={onSave} onBack={goBack} onClose={onClose} />;
    default:
      return <NoteForm onSave={onSave} onBack={goBack} onClose={onClose} />;
  }
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
        <>
          {/* Backdrop */}
          <motion.div
            className="orbit-detail-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          {/* Modal */}
          <motion.div
            className="orbit-detail-overlay"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ ...SPRING_CONFIG.stiff, duration: 0.25 }}
            onClick={(e) => e.stopPropagation()}
          >
            {mode === 'create' && (
              <CreateMode initialType={createType} onSave={onCreate} onClose={onClose} />
            )}
            {mode === 'edit' && attachment && (
              <EditMode attachment={attachment} onSave={onSave} onCancel={onClose} />
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
        </>
      )}
    </AnimatePresence>
  );
}
