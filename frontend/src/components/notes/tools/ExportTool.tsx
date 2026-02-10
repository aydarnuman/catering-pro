'use client';

/**
 * ExportTool - Not disa aktarma araclari
 * - Secili notu kopyala (duz metin)
 * - Tum notlari kopyala
 * - Yazdir (print-friendly)
 */

import {
  Button,
  CopyButton,
  Divider,
  Group,
  Paper,
  Select,
  Stack,
  Text,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconCheck,
  IconCopy,
  IconDownload,
  IconFileText,
  IconPrinter,
  IconSelectAll,
} from '@tabler/icons-react';
import { useCallback, useMemo, useState } from 'react';
import type { UnifiedNote } from '@/types/notes';

interface ExportToolProps {
  notes: UnifiedNote[];
}

function stripHtml(html: string): string {
  if (typeof document === 'undefined') return html.replace(/<[^>]*>/g, '');
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}

function noteToText(note: UnifiedNote): string {
  const parts: string[] = [];

  if (note.title) parts.push(note.title);
  if (note.content) parts.push(stripHtml(note.content));

  if (note.is_task) {
    parts.push(`Durum: ${note.is_completed ? 'Tamamlandi' : 'Bekliyor'}`);
  }

  if (note.tags?.length) {
    parts.push(`Etiketler: ${note.tags.map((t) => t.name).join(', ')}`);
  }

  if (note.due_date) {
    parts.push(`Bitis: ${new Date(note.due_date).toLocaleDateString('tr-TR')}`);
  }

  // Checklist
  const meta = note.metadata as Record<string, unknown> | undefined;
  const checklist = meta?.checklist;
  if (Array.isArray(checklist) && checklist.length > 0) {
    parts.push('Alt gorevler:');
    for (const item of checklist as Array<{ text: string; done: boolean }>) {
      parts.push(`  ${item.done ? '[x]' : '[ ]'} ${item.text}`);
    }
  }

  return parts.join('\n');
}

function noteToMarkdown(note: UnifiedNote): string {
  const parts: string[] = [];

  if (note.title) parts.push(`## ${note.title}`);
  if (note.content) parts.push(stripHtml(note.content));

  if (note.is_task) {
    parts.push(`**Durum:** ${note.is_completed ? 'Tamamlandi' : 'Bekliyor'}`);
  }

  if (note.tags?.length) {
    parts.push(`**Etiketler:** ${note.tags.map((t) => `\`${t.name}\``).join(' ')}`);
  }

  if (note.due_date) {
    parts.push(`**Bitis:** ${new Date(note.due_date).toLocaleDateString('tr-TR')}`);
  }

  const meta = note.metadata as Record<string, unknown> | undefined;
  const checklist = meta?.checklist;
  if (Array.isArray(checklist) && checklist.length > 0) {
    parts.push('### Alt gorevler');
    for (const item of checklist as Array<{ text: string; done: boolean }>) {
      parts.push(`- [${item.done ? 'x' : ' '}] ${item.text}`);
    }
  }

  parts.push(`\n*${new Date(note.created_at).toLocaleDateString('tr-TR')}*`);
  return parts.join('\n\n');
}

export function ExportTool({ notes }: ExportToolProps) {
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);

  const noteOptions = notes.map((n) => ({
    value: n.id,
    label: n.title || stripHtml(n.content).slice(0, 60) || 'Basliksiz not',
  }));

  const selectedNote = notes.find((n) => n.id === selectedNoteId);

  // All notes as text
  const allNotesText = useMemo(() => {
    return notes
      .map((n, i) => `--- Not ${i + 1} ---\n${noteToText(n)}`)
      .join('\n\n');
  }, [notes]);

  // All notes as markdown
  const allNotesMarkdown = useMemo(() => {
    return `# Calisma Alanim - Notlar\n\n${notes.map((n) => noteToMarkdown(n)).join('\n\n---\n\n')}`;
  }, [notes]);

  // Single note text
  const singleNoteText = selectedNote ? noteToText(selectedNote) : '';
  const singleNoteMarkdown = selectedNote ? noteToMarkdown(selectedNote) : '';

  const handlePrint = useCallback(() => {
    const content = selectedNote
      ? `<h1>${selectedNote.title || 'Not'}</h1>${selectedNote.content}`
      : notes
          .map(
            (n) =>
              `<div style="margin-bottom:24px;padding-bottom:16px;border-bottom:1px solid #ddd"><h2>${n.title || 'Not'}</h2>${n.content}</div>`
          )
          .join('');

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      notifications.show({ message: 'Popup engelleyici aktif, izin verin', color: 'orange' });
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Calisma Alanim - Yazdir</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #333; line-height: 1.6; }
          h1 { font-size: 24px; border-bottom: 2px solid #333; padding-bottom: 8px; }
          h2 { font-size: 18px; color: #555; margin-top: 24px; }
          ul, ol { padding-left: 24px; }
          @media print { body { margin: 20px; } }
        </style>
      </head>
      <body>
        <h1>Calisma Alanim</h1>
        <p style="color:#888;font-size:13px;">Tarih: ${new Date().toLocaleDateString('tr-TR')} | ${notes.length} not</p>
        ${content}
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  }, [notes, selectedNote]);

  return (
    <Stack gap="md">
      <Group gap="sm">
        <IconDownload size={20} />
        <Text size="lg" fw={700}>
          Disa Aktar
        </Text>
      </Group>

      {/* Single note export */}
      <Paper p="md" radius="md" withBorder>
        <Text size="sm" fw={600} mb="sm">
          Tek Not
        </Text>
        <Select
          placeholder="Not secin..."
          data={noteOptions}
          value={selectedNoteId}
          onChange={setSelectedNoteId}
          searchable
          size="sm"
          nothingFoundMessage="Not bulunamadi"
          mb="sm"
        />

        {selectedNote && (
          <Group gap="xs">
            <CopyButton value={singleNoteText}>
              {({ copied, copy }) => (
                <Button
                  variant="light"
                  size="xs"
                  color={copied ? 'green' : 'gray'}
                  leftSection={copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                  onClick={copy}
                >
                  {copied ? 'Kopyalandi' : 'Duz metin'}
                </Button>
              )}
            </CopyButton>
            <CopyButton value={singleNoteMarkdown}>
              {({ copied, copy }) => (
                <Button
                  variant="light"
                  size="xs"
                  color={copied ? 'green' : 'gray'}
                  leftSection={copied ? <IconCheck size={14} /> : <IconFileText size={14} />}
                  onClick={copy}
                >
                  {copied ? 'Kopyalandi' : 'Markdown'}
                </Button>
              )}
            </CopyButton>
          </Group>
        )}
      </Paper>

      {/* All notes export */}
      <Paper p="md" radius="md" withBorder>
        <Text size="sm" fw={600} mb="sm">
          Tum Notlar ({notes.length})
        </Text>
        <Group gap="xs">
          <CopyButton value={allNotesText}>
            {({ copied, copy }) => (
              <Button
                variant="light"
                size="xs"
                color={copied ? 'green' : 'gray'}
                leftSection={copied ? <IconCheck size={14} /> : <IconSelectAll size={14} />}
                onClick={copy}
              >
                {copied ? 'Kopyalandi' : 'Tumunu kopyala'}
              </Button>
            )}
          </CopyButton>
          <CopyButton value={allNotesMarkdown}>
            {({ copied, copy }) => (
              <Button
                variant="light"
                size="xs"
                color={copied ? 'green' : 'gray'}
                leftSection={copied ? <IconCheck size={14} /> : <IconFileText size={14} />}
                onClick={copy}
              >
                {copied ? 'Kopyalandi' : 'Markdown'}
              </Button>
            )}
          </CopyButton>
        </Group>
      </Paper>

      {/* Print */}
      <Divider label="Yazdir" labelPosition="left" />
      <Group gap="xs">
        <Button
          variant="light"
          size="sm"
          leftSection={<IconPrinter size={16} />}
          onClick={handlePrint}
          color="gray"
        >
          {selectedNote ? 'Secili notu yazdir' : 'Tum notlari yazdir'}
        </Button>
      </Group>
    </Stack>
  );
}
