'use client';

/**
 * UnifiedNotesModal - Calisma Alanim
 * SegmentedControl: Notlar | Gorevler | Takip Defteri
 * Sidebar yok, tek alan, full-width icerik
 */

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Center,
  Checkbox,
  Collapse,
  CopyButton,
  Divider,
  Group,
  Loader,
  Menu,
  Modal,
  Paper,
  PasswordInput,
  Popover,
  ScrollArea,
  SegmentedControl,
  Select,
  Stack,
  Text,
  TextInput,
  Tooltip,
  useMantineColorScheme,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconCalculator,
  IconCheck,
  IconCopy,
  IconDownload,
  IconFileText,
  IconFolder,
  IconFolderPlus,
  IconListCheck,
  IconLock,
  IconLockOpen,
  IconNote,
  IconNotebook,
  IconNotes,
  IconPin,
  IconPlus,
  IconPrinter,
  IconSearch,
  IconTrash,
  IconUser,
  IconX,
} from '@tabler/icons-react';
import { useClickOutside } from '@mantine/hooks';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useNotesModal } from '@/context/NotesContext';
import { useNoteFolders } from '@/hooks/useNoteFolders';
import { useNotes, useNoteTags } from '@/hooks/useNotes';
import type { CreateNoteDTO, NoteColor, NoteFolder, UnifiedNote } from '@/types/notes';
import { NoteAttachments } from './NoteAttachments';
import { NoteCard } from './NoteCard';
import { type ChecklistItem, NoteChecklist } from './NoteChecklist';
import { NoteEditor } from './NoteEditor';
import { CalculatorTool } from './tools/CalculatorTool';
import { TrackerTool } from './tools/tracker';

const FOLDER_COLORS = ['red', 'orange', 'yellow', 'teal', 'green', 'cyan', 'blue', 'violet', 'grape', 'pink', 'gray'];

// Context type labels
const CONTEXT_LABELS: Record<string, string> = {
  tender: 'Ihale', customer: 'Musteri', event: 'Etkinlik', project: 'Proje',
  contractor: 'Yuklenici', invoice: 'Fatura', stock: 'Stok', personnel: 'Personel',
  purchasing: 'Satin Alma', asset: 'Demirbas', finance: 'Finans', menu: 'Menu', recipe: 'Recete',
};

type ActiveTab = 'notes' | 'tasks' | 'tracker';

// ──────────────────────────────────────────────
// Sortable Note Card Wrapper
// ──────────────────────────────────────────────
function SortableNoteCard({
  note,
  ...props
}: {
  note: UnifiedNote;
  onToggleComplete?: (id: string) => void;
  onTogglePin?: (id: string) => void;
  onDelete?: (id: string) => void;
  onEdit?: (note: UnifiedNote) => void;
  onColorChange?: (id: string, color: NoteColor) => void;
  extraMenuItems?: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: note.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, zIndex: isDragging ? 1000 : 1 };

  return (
    <div ref={setNodeRef} style={style}>
      <NoteCard note={note} showDragHandle dragHandleProps={{ ...attributes, ...listeners }} {...props} />
    </div>
  );
}

// ──────────────────────────────────────────────
// Main Modal Component
// ──────────────────────────────────────────────
export function UnifiedNotesModal() {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';

  const { state, closeNotes } = useNotesModal();
  const { opened, contextType, contextId, contextTitle, initialTab } = state;

  // ── State ──
  const [activeTab, setActiveTab] = useState<ActiveTab>('notes');
  const [searchQuery, setSearchQuery] = useState('');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [activeFolderId, setActiveFolderId] = useState<number | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<UnifiedNote | null>(null);
  const [noteMode, setNoteMode] = useState<'personal' | 'context'>('personal');
  const [editChecklist, setEditChecklist] = useState<ChecklistItem[]>([]);
  const [calcOpen, setCalcOpen] = useState(false);
  const calcPopupRef = useClickOutside(() => setCalcOpen(false));

  // Folder state
  const [unlockedFolders, setUnlockedFolders] = useState<Set<number>>(new Set());
  const [unlockingFolderId, setUnlockingFolderId] = useState<number | null>(null);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState('blue');
  const [newFolderPassword, setNewFolderPassword] = useState('');

  // Folders hook
  const { folders, createFolder, deleteFolder, unlockFolder, moveNote: moveNoteToFolder } = useNoteFolders();

  // Reset on open
  useEffect(() => {
    if (opened) {
      setSearchQuery('');
      setTagFilter(null);
      setActiveFolderId(null);
      setComposerOpen(false);
      setEditingNote(null);
      setNoteMode(contextType ? 'context' : 'personal');
      setActiveTab(initialTab === 'tasks' ? 'tasks' : 'notes');
      setEditChecklist([]);
      setCalcOpen(false);
      setUnlockedFolders(new Set());
      setUnlockingFolderId(null);
    }
  }, [opened, contextType, initialTab]);

  const isContextMode = noteMode === 'context' && !!contextType && contextId != null;
  const isTaskView = activeTab === 'tasks';

  // Fetch notes
  const {
    notes, isLoading, createNote, updateNote, deleteNote,
    toggleComplete, togglePin, reorderNotes, deleteCompleted, refresh,
  } = useNotes({
    contextType: isContextMode ? contextType : null,
    contextId: isContextMode ? contextId : null,
    enabled: opened,
  });

  const { suggestions: allTags } = useNoteTags();

  // DnD
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // ── Filtering ──
  const filteredNotes = useMemo(() => {
    let result = [...notes];

    // Tab filter
    if (activeTab === 'tasks') {
      result = result.filter((n) => n.is_task);
    } else if (activeTab === 'notes') {
      // Folder filter
      if (activeFolderId !== null) {
        result = result.filter((n) => n.folder_id === activeFolderId);
      }
      // Sort pinned to top
      result.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return 0;
      });
    }

    // Tag filter
    if (tagFilter) {
      const tl = tagFilter.toLowerCase();
      result = result.filter((n) => n.tags?.some((t) => t.name.toLowerCase() === tl));
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (n) =>
          (n.title || '').toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q) ||
          n.tags?.some((t) => t.name.toLowerCase().includes(q))
      );
    }

    return result;
  }, [notes, activeTab, activeFolderId, tagFilter, searchQuery]);

  // Pinned divider index (for notes tab)
  const pinnedCount = activeTab === 'notes' ? filteredNotes.filter((n) => n.pinned).length : 0;

  // Inline checklist items (tasks tab)
  const inlineChecklist = useMemo(() => {
    if (!isTaskView) return [];
    const items: Array<ChecklistItem & { noteId: string; noteTitle: string }> = [];
    for (const note of notes) {
      const meta = note.metadata as Record<string, unknown> | undefined;
      const cl = meta?.checklist;
      if (Array.isArray(cl)) {
        const title = note.title || note.content.replace(/<[^>]+>/g, '').slice(0, 50);
        for (const item of cl as ChecklistItem[]) items.push({ ...item, noteId: note.id, noteTitle: title });
      }
    }
    return items;
  }, [notes, isTaskView]);

  // Stats
  const stats = useMemo(() => {
    const tasks = notes.filter((n) => n.is_task);
    return {
      total: notes.length,
      pending: tasks.filter((n) => !n.is_completed).length,
      completed: tasks.filter((n) => n.is_completed).length,
      pinned: notes.filter((n) => n.pinned).length,
    };
  }, [notes]);

  // ── Handlers ──
  const handleCreateNote = useCallback(async (data: CreateNoteDTO) => {
    const result = await createNote(data);
    if (result) { setComposerOpen(false); notifications.show({ message: 'Not olusturuldu', color: 'green', icon: <IconCheck size={16} />, autoClose: 2000 }); }
  }, [createNote]);

  const handleUpdateNote = useCallback(async (data: CreateNoteDTO) => {
    if (!editingNote) return;
    const result = await updateNote(editingNote.id, { ...data, sort_order: editingNote.sort_order });
    if (result) { setEditingNote(null); setEditChecklist([]); notifications.show({ message: 'Not guncellendi', color: 'green', icon: <IconCheck size={16} />, autoClose: 2000 }); }
  }, [editingNote, updateNote]);

  const handleDeleteNote = useCallback(async (id: string) => {
    const success = await deleteNote(id);
    if (success) notifications.show({ message: 'Not silindi', color: 'orange', autoClose: 2000 });
  }, [deleteNote]);

  const handleToggleComplete = useCallback(async (id: string) => { await toggleComplete(id); }, [toggleComplete]);
  const handleTogglePin = useCallback(async (id: string) => { await togglePin(id); }, [togglePin]);
  const handleColorChange = useCallback(async (id: string, color: NoteColor) => { await updateNote(id, { color }); }, [updateNote]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = filteredNotes.findIndex((n) => n.id === active.id);
    const newIndex = filteredNotes.findIndex((n) => n.id === over.id);
    if (oldIndex !== -1 && newIndex !== -1) {
      const newOrder = [...filteredNotes];
      const [moved] = newOrder.splice(oldIndex, 1);
      newOrder.splice(newIndex, 0, moved);
      reorderNotes(newOrder.map((n) => n.id));
    }
  }, [filteredNotes, reorderNotes]);

  const handleDeleteCompleted = useCallback(async () => {
    const count = await deleteCompleted();
    if (count > 0) notifications.show({ message: `${count} tamamlanmis not silindi`, color: 'orange', autoClose: 2000 });
  }, [deleteCompleted]);

  const handleEditNote = useCallback((note: UnifiedNote) => {
    setEditingNote(note);
    const meta = note.metadata as Record<string, unknown> | undefined;
    const checklist = meta?.checklist;
    setEditChecklist(Array.isArray(checklist) ? checklist : []);
  }, []);

  // ── Folder handlers ──
  const handleCreateFolder = useCallback(async () => {
    if (!newFolderName.trim()) return;
    const folder = await createFolder({
      name: newFolderName.trim(),
      color: newFolderColor,
      password: newFolderPassword || null,
    });
    if (folder) {
      setCreateFolderOpen(false);
      setNewFolderName('');
      setNewFolderColor('blue');
      setNewFolderPassword('');
      notifications.show({ message: `"${folder.name}" klasoru olusturuldu`, color: 'green' });
    }
  }, [newFolderName, newFolderColor, newFolderPassword, createFolder]);

  const handleFolderClick = useCallback((folder: NoteFolder) => {
    if (folder.is_locked && !unlockedFolders.has(folder.id)) {
      setUnlockingFolderId(folder.id);
      setUnlockPassword('');
      return;
    }
    setActiveFolderId(activeFolderId === folder.id ? null : folder.id);
  }, [activeFolderId, unlockedFolders]);

  const handleUnlockFolder = useCallback(async () => {
    if (!unlockingFolderId || !unlockPassword) return;
    const ok = await unlockFolder(unlockingFolderId, unlockPassword);
    if (ok) {
      setUnlockedFolders((prev) => new Set([...prev, unlockingFolderId]));
      setActiveFolderId(unlockingFolderId);
      setUnlockingFolderId(null);
      setUnlockPassword('');
    } else {
      notifications.show({ message: 'Yanlis sifre', color: 'red' });
    }
  }, [unlockingFolderId, unlockPassword, unlockFolder]);

  // ── Export helpers ──
  const stripHtmlContent = useCallback((html: string): string => {
    if (typeof document === 'undefined') return html.replace(/<[^>]*>/g, '');
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  }, []);

  const allNotesText = useMemo(() => notes.map((n, i) => {
    const parts: string[] = [];
    if (n.title) parts.push(n.title);
    if (n.content) parts.push(stripHtmlContent(n.content));
    if (n.tags?.length) parts.push(`Etiketler: ${n.tags.map((t) => t.name).join(', ')}`);
    return `--- Not ${i + 1} ---\n${parts.join('\n')}`;
  }).join('\n\n'), [notes, stripHtmlContent]);

  const allNotesMarkdown = useMemo(() => {
    const md = notes.map((n) => {
      const parts: string[] = [];
      if (n.title) parts.push(`## ${n.title}`);
      if (n.content) parts.push(stripHtmlContent(n.content));
      if (n.tags?.length) parts.push(`**Etiketler:** ${n.tags.map((t) => `\`${t.name}\``).join(' ')}`);
      return parts.join('\n\n');
    }).join('\n\n---\n\n');
    return `# Calisma Alanim - Notlar\n\n${md}`;
  }, [notes, stripHtmlContent]);

  const handlePrint = useCallback(() => {
    const content = notes.map((n) => `<div style="margin-bottom:24px;padding-bottom:16px;border-bottom:1px solid #ddd"><h2>${n.title || 'Not'}</h2>${n.content}</div>`).join('');
    const pw = window.open('', '_blank');
    if (!pw) { notifications.show({ message: 'Popup engelleyici aktif', color: 'orange' }); return; }
    pw.document.write(`<!DOCTYPE html><html><head><title>Calisma Alanim</title><style>body{font-family:-apple-system,sans-serif;max-width:800px;margin:40px auto;padding:0 20px;color:#333;line-height:1.6}h1{border-bottom:2px solid #333;padding-bottom:8px}h2{color:#555;margin-top:24px}@media print{body{margin:20px}}</style></head><body><h1>Calisma Alanim</h1><p style="color:#888;font-size:13px">Tarih: ${new Date().toLocaleDateString('tr-TR')} | ${notes.length} not</p>${content}</body></html>`);
    pw.document.close();
    pw.print();
  }, [notes]);

  // ── Context label ──
  const contextLabel = contextType
    ? `${CONTEXT_LABELS[contextType] || contextType}${contextTitle ? `: ${contextTitle}` : ''}`
    : '';

  const borderSubtl = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const surfaceBg = isDark ? '#1a1a1e' : '#ffffff';

  // Tag options for dropdown
  const tagOptions = useMemo(() =>
    allTags.map((t) => ({ value: t.name, label: t.name })),
    [allTags]
  );

  return (
    <Modal
      opened={opened}
      onClose={closeNotes}
      title={
        <Group gap="sm">
          <Box style={{
            width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: isDark
              ? 'linear-gradient(135deg, rgba(139,92,246,0.2) 0%, rgba(99,102,241,0.15) 100%)'
              : 'linear-gradient(135deg, rgba(139,92,246,0.12) 0%, rgba(99,102,241,0.08) 100%)',
            border: `1px solid ${isDark ? 'rgba(139,92,246,0.25)' : 'rgba(139,92,246,0.18)'}`,
            boxShadow: '0 2px 8px rgba(139,92,246,0.15)',
          }}>
            <IconNote size={20} color="var(--mantine-color-violet-5)" />
          </Box>
          <Box>
            <Text fw={700} size="lg" style={{ letterSpacing: '-0.02em' }}>Calisma Alanim</Text>
            <Text size="xs" c="dimmed" fw={500}>{isContextMode ? contextLabel : 'Notlar, gorevler ve takip'}</Text>
          </Box>
        </Group>
      }
      fullScreen radius={0} padding={0}
      overlayProps={{ backgroundOpacity: 0.5, blur: 8 }}
      styles={{
        header: {
          padding: '16px 24px',
          background: isDark ? 'linear-gradient(180deg, #1e1e24 0%, #1a1a1e 100%)' : 'linear-gradient(180deg, #ffffff 0%, #fafafa 100%)',
          backdropFilter: 'blur(12px)',
        },
        body: { padding: 0, background: surfaceBg, height: 'calc(100vh - 60px)', display: 'flex', flexDirection: 'column' },
        content: { background: surfaceBg },
        close: { transition: 'all 0.15s ease', borderRadius: 10 },
      }}
      className="ws-header-gradient"
    >
      {/* ── Context Mode Switcher ── */}
      {contextType && contextId != null && (
        <Box px="lg" py="xs" style={{ borderBottom: `1px solid ${borderSubtl}` }}>
          <SegmentedControl
            value={noteMode}
            onChange={(v) => setNoteMode(v as 'personal' | 'context')}
            size="xs"
            data={[
              { value: 'personal', label: (<Group gap={6} justify="center"><IconUser size={14} /><Text size="xs" fw={500}>Kisisel</Text></Group>) },
              { value: 'context', label: (<Group gap={6} justify="center"><IconNotes size={14} /><Text size="xs" fw={500}>{contextLabel}</Text></Group>) },
            ]}
          />
        </Box>
      )}

      {/* ── Tab SegmentedControl ── */}
      <Box px="lg" py="sm" style={{ borderBottom: `1px solid ${borderSubtl}` }}>
        <SegmentedControl
          value={activeTab}
          onChange={(v) => { setActiveTab(v as ActiveTab); setSearchQuery(''); setTagFilter(null); setComposerOpen(false); }}
          size="sm"
          radius="md"
          fullWidth
          data={[
            { value: 'notes', label: (<Group gap={6} justify="center"><IconNotes size={15} /><Text size="xs" fw={600}>Notlar{stats.total > 0 ? ` (${stats.total})` : ''}</Text></Group>) },
            { value: 'tasks', label: (<Group gap={6} justify="center"><IconListCheck size={15} /><Text size="xs" fw={600}>Gorevler{stats.pending > 0 ? ` (${stats.pending})` : ''}</Text></Group>) },
            { value: 'tracker', label: (<Group gap={6} justify="center"><IconNotebook size={15} /><Text size="xs" fw={600}>Takip Defteri</Text></Group>) },
          ]}
        />
      </Box>

      {/* ── Content Area (full width, no sidebar) ── */}
      <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, position: 'relative' }}>
        {/* Floating Calculator Popup */}
        {calcOpen && (
          <Paper ref={calcPopupRef} shadow="xl" radius="lg" p="md" className="ws-tool-fade-in"
            style={{
              position: 'absolute', top: 8, right: 16, width: 340, maxHeight: 500, zIndex: 100,
              background: isDark ? 'rgba(26,26,30,0.97)' : 'rgba(255,255,255,0.97)',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
              backdropFilter: 'blur(24px)',
              boxShadow: isDark ? '0 12px 48px rgba(0,0,0,0.5), 0 4px 16px rgba(0,0,0,0.3)' : '0 12px 48px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.06)',
              overflow: 'hidden',
            }}>
            <Group justify="space-between" mb="sm">
              <Group gap="xs">
                <Box style={{ width: 26, height: 26, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isDark ? 'rgba(20,184,166,0.15)' : 'rgba(20,184,166,0.1)', color: 'var(--mantine-color-teal-5)' }}>
                  <IconCalculator size={14} />
                </Box>
                <Text size="sm" fw={700}>Hesap Makinasi</Text>
              </Group>
              <ActionIcon variant="subtle" size="sm" radius="md" onClick={() => setCalcOpen(false)}><IconX size={14} /></ActionIcon>
            </Group>
            <ScrollArea mah={420}><CalculatorTool /></ScrollArea>
          </Paper>
        )}

        {activeTab === 'tracker' ? (
          /* ── Tracker View ── */
          <ScrollArea style={{ flex: 1 }} p="lg">
            <Box className="ws-tool-fade-in"><TrackerTool /></Box>
          </ScrollArea>
        ) : (
          /* ── Notes / Tasks View ── */
          <>
            {/* ── Folder Chips (notes tab only) ── */}
            {activeTab === 'notes' && (
              <Box px="lg" py="xs" style={{ borderBottom: `1px solid ${borderSubtl}` }}>
                <ScrollArea type="never">
                  <Group gap={6} wrap="nowrap">
                    <Badge
                      size="md"
                      variant={activeFolderId === null ? 'filled' : 'light'}
                      color={activeFolderId === null ? 'blue' : 'gray'}
                      style={{ cursor: 'pointer', flexShrink: 0 }}
                      onClick={() => setActiveFolderId(null)}
                    >
                      Tum Notlar
                    </Badge>
                    {folders.map((f) => {
                      const isActive = activeFolderId === f.id;
                      const isLocked = f.is_locked && !unlockedFolders.has(f.id);
                      return (
                        <Badge
                          key={f.id}
                          size="md"
                          variant={isActive ? 'filled' : 'light'}
                          color={isActive ? f.color : 'gray'}
                          leftSection={isLocked ? <IconLock size={10} /> : <IconFolder size={10} />}
                          rightSection={isActive ? (
                            <ActionIcon
                              size={14} variant="transparent" color="white"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm(`"${f.name}" klasorunu silmek istediginize emin misiniz?`)) {
                                  deleteFolder(f.id);
                                  setActiveFolderId(null);
                                }
                              }}
                              style={{ marginLeft: -4 }}
                            >
                              <IconX size={10} />
                            </ActionIcon>
                          ) : undefined}
                          style={{ cursor: 'pointer', flexShrink: 0 }}
                          onClick={() => handleFolderClick(f)}
                        >
                          {f.name}{f.note_count > 0 ? ` (${f.note_count})` : ''}
                        </Badge>
                      );
                    })}
                    {/* Add folder button */}
                    <Popover opened={createFolderOpen} onChange={setCreateFolderOpen} position="bottom" withArrow>
                      <Popover.Target>
                        <Badge
                          size="md"
                          variant="light"
                          color="gray"
                          leftSection={<IconFolderPlus size={10} />}
                          style={{ cursor: 'pointer', flexShrink: 0, opacity: 0.7 }}
                          onClick={() => setCreateFolderOpen(true)}
                        >
                          Klasor
                        </Badge>
                      </Popover.Target>
                      <Popover.Dropdown>
                        <Stack gap="xs" style={{ width: 240 }}>
                          <Text size="xs" fw={700}>Yeni Klasor</Text>
                          <TextInput
                            placeholder="Klasor adi"
                            value={newFolderName}
                            onChange={(e) => setNewFolderName(e.currentTarget.value)}
                            size="xs" radius="md" autoFocus
                            onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                          />
                          <Group gap={4}>
                            {FOLDER_COLORS.map((c) => (
                              <Box
                                key={c}
                                style={{
                                  width: 18, height: 18, borderRadius: '50%', cursor: 'pointer',
                                  background: `var(--mantine-color-${c}-5)`,
                                  border: newFolderColor === c ? '2px solid white' : '2px solid transparent',
                                  boxShadow: newFolderColor === c ? `0 0 4px var(--mantine-color-${c}-5)` : 'none',
                                }}
                                onClick={() => setNewFolderColor(c)}
                              />
                            ))}
                          </Group>
                          <PasswordInput
                            placeholder="Sifre (opsiyonel)"
                            value={newFolderPassword}
                            onChange={(e) => setNewFolderPassword(e.currentTarget.value)}
                            size="xs" radius="md"
                          />
                          <Button size="xs" radius="md" onClick={handleCreateFolder} disabled={!newFolderName.trim()}>
                            Olustur
                          </Button>
                        </Stack>
                      </Popover.Dropdown>
                    </Popover>
                  </Group>
                </ScrollArea>

                {/* Unlock modal */}
                <Modal
                  opened={unlockingFolderId !== null}
                  onClose={() => { setUnlockingFolderId(null); setUnlockPassword(''); }}
                  title={<Group gap="xs"><IconLock size={16} /><Text size="sm" fw={600}>Klasor Sifresi</Text></Group>}
                  size="xs" centered radius="lg"
                >
                  <Stack gap="sm">
                    <Text size="xs" c="dimmed">Bu klasor sifre ile korunuyor.</Text>
                    <PasswordInput
                      placeholder="Sifre girin"
                      value={unlockPassword}
                      onChange={(e) => setUnlockPassword(e.currentTarget.value)}
                      size="sm" radius="md" autoFocus
                      onKeyDown={(e) => e.key === 'Enter' && handleUnlockFolder()}
                    />
                    <Button
                      onClick={handleUnlockFolder}
                      disabled={!unlockPassword}
                      leftSection={<IconLockOpen size={14} />}
                      radius="md"
                    >
                      Kilidi Ac
                    </Button>
                  </Stack>
                </Modal>
              </Box>
            )}

            {/* Stats + Search + Tools */}
            <Box px="lg" py="sm" style={{ borderBottom: `1px solid ${borderSubtl}` }}>
              <Group justify="space-between" mb="xs">
                <Group gap="md">
                  {activeTab === 'notes' && stats.pinned > 0 && (
                    <Badge variant="light" color="violet" size="sm" leftSection={<IconPin size={10} />}>{stats.pinned} sabitli</Badge>
                  )}
                  {activeTab === 'tasks' && stats.completed > 0 && (
                    <Badge variant="light" color="green" size="sm">{stats.completed} tamamlanan</Badge>
                  )}
                </Group>
                <Group gap={4}>
                  <Tooltip label="Hesap Makinasi">
                    <ActionIcon variant={calcOpen ? 'light' : 'subtle'} color={calcOpen ? 'teal' : 'gray'} size="sm" radius="md" onClick={() => setCalcOpen((p) => !p)}>
                      <IconCalculator size={15} />
                    </ActionIcon>
                  </Tooltip>
                  {notes.length > 0 && (
                    <Menu position="bottom-end" withArrow>
                      <Menu.Target>
                        <Tooltip label="Disa aktar"><ActionIcon variant="subtle" color="gray" size="sm" radius="md"><IconDownload size={15} /></ActionIcon></Tooltip>
                      </Menu.Target>
                      <Menu.Dropdown>
                        <CopyButton value={allNotesText}>{({ copied, copy }) => (<Menu.Item leftSection={copied ? <IconCheck size={14} /> : <IconCopy size={14} />} onClick={copy} color={copied ? 'green' : undefined}>{copied ? 'Kopyalandi' : 'Tumunu kopyala'}</Menu.Item>)}</CopyButton>
                        <CopyButton value={allNotesMarkdown}>{({ copied, copy }) => (<Menu.Item leftSection={copied ? <IconCheck size={14} /> : <IconFileText size={14} />} onClick={copy} color={copied ? 'green' : undefined}>{copied ? 'Kopyalandi' : 'Markdown'}</Menu.Item>)}</CopyButton>
                        <Menu.Divider />
                        <Menu.Item leftSection={<IconPrinter size={14} />} onClick={handlePrint}>Yazdir</Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  )}
                  {stats.completed > 0 && (
                    <Tooltip label="Tamamlananlari sil"><ActionIcon variant="subtle" color="red" size="sm" radius="md" onClick={handleDeleteCompleted}><IconTrash size={15} /></ActionIcon></Tooltip>
                  )}
                </Group>
              </Group>
              <Group gap="xs">
                <TextInput
                  placeholder={isTaskView ? 'Gorevlerde ara...' : 'Notlarda ara...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.currentTarget.value)}
                  leftSection={<IconSearch size={16} />}
                  rightSection={searchQuery ? <ActionIcon variant="subtle" size="xs" onClick={() => setSearchQuery('')}><IconX size={14} /></ActionIcon> : null}
                  size="sm" radius="md" className="ws-search-input"
                  style={{ flex: 1 }}
                />
                {tagOptions.length > 0 && (
                  <Select
                    placeholder="Etiket"
                    data={tagOptions}
                    value={tagFilter}
                    onChange={setTagFilter}
                    size="sm" radius="md" clearable
                    style={{ width: 140 }}
                    leftSection={<IconPin size={12} />}
                  />
                )}
              </Group>
            </Box>

            {/* Composer */}
            <Box px="lg" py="sm">
              {!composerOpen ? (
                <Button
                  variant="light" leftSection={<IconPlus size={16} />}
                  onClick={() => { setEditingNote(null); setComposerOpen(true); }}
                  fullWidth radius="lg"
                  styles={{ root: {
                    background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.015)',
                    border: `1.5px dashed ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                    color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)',
                    fontWeight: 500, height: 44, transition: 'all 0.15s ease',
                  } }}
                >
                  {isTaskView ? '+ Yeni gorev ekle...' : '+ Yeni not ekle...'}
                </Button>
              ) : (
                <Collapse in={composerOpen}>
                  <Paper p="md" radius="lg" withBorder style={{
                    borderColor: isTaskView ? `var(--mantine-color-orange-${isDark ? '6' : '3'})` : `var(--mantine-color-violet-${isDark ? '6' : '3'})`,
                    boxShadow: isDark ? '0 4px 16px rgba(0,0,0,0.2)' : '0 4px 16px rgba(0,0,0,0.06)',
                  }}>
                    <Group justify="space-between" mb="sm">
                      <Text size="sm" fw={600} c={isTaskView ? 'orange' : 'violet'}>{isTaskView ? 'Yeni Gorev' : 'Yeni Not'}</Text>
                      <ActionIcon variant="subtle" size="sm" onClick={() => setComposerOpen(false)}><IconX size={16} /></ActionIcon>
                    </Group>
                    <NoteEditor onSave={handleCreateNote} onCancel={() => setComposerOpen(false)} compact taskMode={isTaskView} showTaskToggle={!isTaskView} initialIsTask={isTaskView} initialColor={isTaskView ? 'orange' : 'blue'} />
                  </Paper>
                </Collapse>
              )}
            </Box>

            {/* Notes/Tasks list */}
            <ScrollArea style={{ flex: 1 }} px="lg" pb="md">
              {isLoading ? (
                <Center h={200}><Stack align="center" gap="xs"><Loader size="md" color="violet" /><Text size="sm" c="dimmed">Yukleniyor...</Text></Stack></Center>
              ) : filteredNotes.length === 0 ? (
                <Center style={{ flex: 1, minHeight: 240 }}>
                  <Stack align="center" gap="md">
                    <Box className="ws-empty-icon" style={{
                      width: 72, height: 72, borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: isDark ? 'linear-gradient(135deg, rgba(139,92,246,0.08) 0%, rgba(99,102,241,0.05) 100%)' : 'linear-gradient(135deg, rgba(139,92,246,0.06) 0%, rgba(99,102,241,0.03) 100%)',
                      border: `1px solid ${isDark ? 'rgba(139,92,246,0.12)' : 'rgba(139,92,246,0.08)'}`,
                    }}>
                      {searchQuery ? <IconSearch size={32} stroke={1.3} color="var(--mantine-color-gray-5)" />
                        : isTaskView ? <IconListCheck size={32} stroke={1.3} color="var(--mantine-color-orange-4)" />
                        : <IconNotes size={32} stroke={1.3} color="var(--mantine-color-violet-4)" />}
                    </Box>
                    <Stack align="center" gap={4}>
                      <Text size="md" fw={600} c={isDark ? 'gray.4' : 'gray.7'}>
                        {searchQuery ? 'Sonuc bulunamadi' : isTaskView ? 'Gorev listeniz temiz' : 'Henuz not eklenmemis'}
                      </Text>
                      <Text size="xs" c="dimmed" ta="center" maw={280}>
                        {searchQuery ? 'Farkli anahtar kelimelerle deneyin' : isTaskView ? 'Yeni gorevler ekleyerek islerinizi takip edin' : 'Fikirlerinizi ve planlarinizi burada yonetin'}
                      </Text>
                    </Stack>
                    {!searchQuery && !composerOpen && (
                      <Button variant="light" size="sm" color="violet" leftSection={<IconPlus size={16} />} onClick={() => setComposerOpen(true)} mt={4} radius="md">
                        {isTaskView ? 'Yeni gorev ekle' : 'Ilk notunu olustur'}
                      </Button>
                    )}
                  </Stack>
                </Center>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={filteredNotes.map((n) => n.id)} strategy={verticalListSortingStrategy}>
                    <Stack gap="xs">
                      {filteredNotes.map((note, idx) => (
                        <Stack key={note.id} gap={4}>
                          {/* Pinned divider */}
                          {activeTab === 'notes' && pinnedCount > 0 && idx === pinnedCount && (
                            <Divider my={4} label={<Text size="xs" c="dimmed" fw={500}>Diger notlar</Text>} labelPosition="left" />
                          )}
                          <SortableNoteCard
                            note={note}
                            onToggleComplete={handleToggleComplete}
                            onTogglePin={handleTogglePin}
                            onDelete={handleDeleteNote}
                            onEdit={handleEditNote}
                            onColorChange={handleColorChange}
                            extraMenuItems={activeTab === 'notes' && folders.length > 0 ? (
                              <>
                                <Menu.Divider />
                                <Menu.Label>Klasore tasi</Menu.Label>
                                {note.folder_id && (
                                  <Menu.Item leftSection={<IconX size={12} />} onClick={() => moveNoteToFolder(note.id, null)}>
                                    Klasorden cikar
                                  </Menu.Item>
                                )}
                                {folders.filter((f) => f.id !== note.folder_id).map((f) => (
                                  <Menu.Item
                                    key={f.id}
                                    leftSection={<Box style={{ width: 8, height: 8, borderRadius: '50%', background: `var(--mantine-color-${f.color}-5)` }} />}
                                    onClick={() => moveNoteToFolder(note.id, f.id)}
                                  >
                                    {f.name}
                                  </Menu.Item>
                                ))}
                              </>
                            ) : undefined}
                          />
                          {note.attachments && note.attachments.length > 0 && (
                            <Box ml={28}><NoteAttachments noteId={note.id} attachments={note.attachments} onUpdate={refresh} /></Box>
                          )}
                          {Array.isArray((note.metadata as Record<string, unknown>)?.checklist) &&
                            ((note.metadata as Record<string, unknown>).checklist as ChecklistItem[]).length > 0 && (
                              <Box ml={28}><NoteChecklist items={(note.metadata as Record<string, unknown>).checklist as ChecklistItem[]} onChange={() => {}} readonly /></Box>
                            )}
                        </Stack>
                      ))}
                    </Stack>
                  </SortableContext>
                </DndContext>
              )}

              {/* Inline checklist (tasks tab) */}
              {isTaskView && inlineChecklist.length > 0 && (
                <Box mt="lg">
                  <Divider label={<Text size="xs" fw={600} c="dimmed">Not Ici Gorevler ({inlineChecklist.filter((i) => i.done).length}/{inlineChecklist.length})</Text>} labelPosition="left" mb="sm" />
                  <Stack gap={4}>
                    {inlineChecklist.map((item) => (
                      <Group key={`${item.noteId}-${item.id}`} gap="xs" wrap="nowrap">
                        <Checkbox checked={item.done} size="xs" radius="xl" readOnly styles={{ input: { cursor: 'default' } }} />
                        <Text size="xs" style={{ flex: 1, textDecoration: item.done ? 'line-through' : 'none', opacity: item.done ? 0.5 : 1 }}>{item.text}</Text>
                        <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>{item.noteTitle}</Text>
                      </Group>
                    ))}
                  </Stack>
                </Box>
              )}
            </ScrollArea>
          </>
        )}
      </Box>

      {/* ── Edit Note Modal ── */}
      <Modal
        opened={!!editingNote}
        onClose={() => { setEditingNote(null); setEditChecklist([]); }}
        title={<Group gap="xs"><IconNote size={18} /><Text fw={600} size="sm">Notu Duzenle</Text></Group>}
        size="lg" radius="lg" centered
      >
        {editingNote && (
          <Stack>
            <NoteEditor
              initialTitle={editingNote.title || ''} initialContent={editingNote.content} initialContentFormat={editingNote.content_format}
              initialColor={editingNote.color} initialPriority={editingNote.priority} initialTags={editingNote.tags?.map((t) => t.name) ?? []}
              initialDueDate={editingNote.due_date ? new Date(editingNote.due_date) : null}
              initialReminderDate={editingNote.reminder_date ? new Date(editingNote.reminder_date) : null}
              initialIsTask={editingNote.is_task} initialChecklist={editChecklist}
              onSave={handleUpdateNote} onCancel={() => { setEditingNote(null); setEditChecklist([]); }} saveLabel="Guncelle"
            />
            {editingNote.attachments && editingNote.attachments.length > 0 && (
              <Paper p="sm" withBorder radius="md">
                <Text size="xs" fw={600} mb="xs">Dosya Ekleri</Text>
                <NoteAttachments noteId={editingNote.id} attachments={editingNote.attachments} onUpdate={refresh} />
              </Paper>
            )}
          </Stack>
        )}
      </Modal>
    </Modal>
  );
}

export default UnifiedNotesModal;
