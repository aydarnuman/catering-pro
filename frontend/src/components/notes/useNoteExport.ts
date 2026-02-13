'use client';

/**
 * useNoteExport - Export helpers for notes (text, markdown, print)
 */

import { notifications } from '@mantine/notifications';
import { useCallback, useMemo } from 'react';
import type { UnifiedNote } from '@/types/notes';

function stripHtml(html: string): string {
  if (typeof document === 'undefined') return html.replace(/<[^>]*>/g, '');
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}

export function useNoteExport(notes: UnifiedNote[]) {
  const allNotesText = useMemo(
    () =>
      notes
        .map((n, i) => {
          const parts: string[] = [];
          if (n.title) parts.push(n.title);
          if (n.content) parts.push(stripHtml(n.content));
          if (n.tags?.length) parts.push(`Etiketler: ${n.tags.map((t) => t.name).join(', ')}`);
          return `--- Not ${i + 1} ---\n${parts.join('\n')}`;
        })
        .join('\n\n'),
    [notes]
  );

  const allNotesMarkdown = useMemo(() => {
    const md = notes
      .map((n) => {
        const parts: string[] = [];
        if (n.title) parts.push(`## ${n.title}`);
        if (n.content) parts.push(stripHtml(n.content));
        if (n.tags?.length) parts.push(`**Etiketler:** ${n.tags.map((t) => `\`${t.name}\``).join(' ')}`);
        return parts.join('\n\n');
      })
      .join('\n\n---\n\n');
    return `# Calisma Alanim - Notlar\n\n${md}`;
  }, [notes]);

  const handlePrint = useCallback(() => {
    const content = notes
      .map(
        (n) =>
          `<div style="margin-bottom:24px;padding-bottom:16px;border-bottom:1px solid #ddd"><h2>${n.title || 'Not'}</h2>${n.content}</div>`
      )
      .join('');
    const pw = window.open('', '_blank');
    if (!pw) {
      notifications.show({ message: 'Popup engelleyici aktif', color: 'orange' });
      return;
    }
    pw.document.write(
      `<!DOCTYPE html><html><head><title>Calisma Alanim</title><style>body{font-family:-apple-system,sans-serif;max-width:800px;margin:40px auto;padding:0 20px;color:#333;line-height:1.6}h1{border-bottom:2px solid #333;padding-bottom:8px}h2{color:#555;margin-top:24px}@media print{body{margin:20px}}</style></head><body><h1>Calisma Alanim</h1><p style="color:#888;font-size:13px">Tarih: ${new Date().toLocaleDateString('tr-TR')} | ${notes.length} not</p>${content}</body></html>`
    );
    pw.document.close();
    pw.print();
  }, [notes]);

  return { allNotesText, allNotesMarkdown, handlePrint };
}
