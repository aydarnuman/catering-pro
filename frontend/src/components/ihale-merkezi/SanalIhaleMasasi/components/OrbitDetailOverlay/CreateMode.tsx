import {
  ActionIcon,
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
import { IconFileText, IconNote, IconPlus, IconTrash, IconX } from '@tabler/icons-react';
import { useCallback, useState } from 'react';
import { ATTACHMENT_TYPE_MAP, ATTACHMENT_TYPES } from '../../constants';
import type { AttachmentType } from '../../types';
import { DARK_INPUT_STYLES, FormShell, ICON_MAP } from './shared';

// ─── Create Props ───────────────────────────────────────────

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

// ─── NoteForm ───────────────────────────────────────────────

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

// ─── LinkForm ───────────────────────────────────────────────

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
    await onSave({ title: title.trim() || url.trim(), type: 'link', content: description.trim(), url: url.trim() });
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
        placeholder="Baslik (opsiyonel)"
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

// ─── ContactForm ────────────────────────────────────────────

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

// ─── CalculationForm ────────────────────────────────────────

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

  const addRow = useCallback(() => setRows((prev) => [...prev, createCalcRow()]), []);
  const removeRow = useCallback((idx: number) => setRows((prev) => prev.filter((_, i) => i !== idx)), []);
  const updateRow = useCallback((idx: number, field: keyof CalcRow, value: string | number | '') => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  }, []);

  const total = rows.reduce((sum, r) => {
    const q = typeof r.quantity === 'number' ? r.quantity : 0;
    const p = typeof r.unitPrice === 'number' ? r.unitPrice : 0;
    return sum + q * p;
  }, 0);

  const validRows = rows.filter((r) => r.label.trim() && r.quantity !== '' && r.unitPrice !== '');

  const handleSubmit = useCallback(async () => {
    if (!title.trim() || validRows.length === 0) return;
    setSaving(true);
    const lines = ['| Kalem | Miktar | Birim Fiyat | Tutar |', '|---|---|---|---|'];
    for (const r of validRows) {
      const q = typeof r.quantity === 'number' ? r.quantity : 0;
      const p = typeof r.unitPrice === 'number' ? r.unitPrice : 0;
      lines.push(`| ${r.label} | ${q} | ${p.toLocaleString('tr-TR')} | ${(q * p).toLocaleString('tr-TR')} |`);
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
            (typeof r.quantity === 'number' ? r.quantity : 0) * (typeof r.unitPrice === 'number' ? r.unitPrice : 0),
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
      <Stack gap={4}>
        {rows.map((row, idx) => {
          const q = typeof row.quantity === 'number' ? row.quantity : 0;
          const p = typeof row.unitPrice === 'number' ? row.unitPrice : 0;
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
                {q * p > 0 ? (q * p).toLocaleString('tr-TR') : '—'}
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

// ─── DocumentForm ───────────────────────────────────────────

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
    await onSave({ title: title.trim(), type: 'document', content: description.trim() });
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

// ─── CreateMode Orchestrator ────────────────────────────────

export function CreateMode({ initialType, onSave, onClose }: CreateProps) {
  const [selectedType, setSelectedType] = useState<AttachmentType | null>(initialType || null);
  const creatableTypes = ATTACHMENT_TYPES.filter((t) => t.userCreatable);
  const goBack = useCallback(() => setSelectedType(null), []);

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
                  (e.currentTarget as HTMLDivElement).style.borderColor = `var(--mantine-color-${typeConfig.color}-5)`;
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
