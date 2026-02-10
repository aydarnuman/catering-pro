'use client';

/**
 * UnifiedNotesModal - Gelismis tek notlar modali
 * Sidebar filtreleme, zengin metin, dosya ekleri, checklist, paylasma
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
  Divider,
  Group,
  Loader,
  Modal,
  Paper,
  ScrollArea,
  SegmentedControl,
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
  IconDownload,
  IconNote,
  IconNotes,
  IconPlus,
  IconSearch,
  IconSparkles,
  IconTemplate,
  IconTrash,
  IconUser,
  IconX,
} from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useNotesModal } from '@/context/NotesContext';
import { useNotes, useNoteTags } from '@/hooks/useNotes';
import type { CreateNoteDTO, NoteColor, UnifiedNote } from '@/types/notes';
import { NoteAttachments } from './NoteAttachments';
import { NoteCard } from './NoteCard';
import { type ChecklistItem, NoteChecklist } from './NoteChecklist';
import { NoteEditor } from './NoteEditor';
import { NotesSidebar, type SidebarFilter, type ToolType } from './NotesSidebar';
import { AIHelpTool } from './tools/AIHelpTool';
import { CalculatorTool } from './tools/CalculatorTool';
import { ExportTool } from './tools/ExportTool';
import { type NoteTemplate, TemplatesTool } from './tools/TemplatesTool';

// Context type labels
const CONTEXT_LABELS: Record<string, string> = {
  tender: 'Ihale',
  customer: 'Musteri',
  event: 'Etkinlik',
  project: 'Proje',
  contractor: 'Yuklenici',
  invoice: 'Fatura',
  stock: 'Stok',
  personnel: 'Personel',
  purchasing: 'Satin Alma',
  asset: 'Demirbas',
  finance: 'Finans',
  menu: 'Menu',
  recipe: 'Recete',
};

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
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: note.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <NoteCard
        note={note}
        showDragHandle
        dragHandleProps={{ ...attributes, ...listeners }}
        {...props}
      />
    </div>
  );
}

// ──────────────────────────────────────────────
// Main Modal Component
// ──────────────────────────────────────────────
export function UnifiedNotesModal() {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';

  // Global context
  const { state, closeNotes } = useNotesModal();
  const { opened, contextType, contextId, contextTitle, initialTab } = state;

  // Local state
  const [searchQuery, setSearchQuery] = useState('');
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<UnifiedNote | null>(null);
  const [noteMode, setNoteMode] = useState<'personal' | 'context'>('personal');
  const [sidebarFilter, setSidebarFilter] = useState<SidebarFilter>({ type: 'all' });
  const [editChecklist, setEditChecklist] = useState<ChecklistItem[]>([]);
  const [activeTool, setActiveTool] = useState<ToolType | null>(null);

  // Reset on open
  useEffect(() => {
    if (opened) {
      setSearchQuery('');
      setComposerOpen(false);
      setEditingNote(null);
      setNoteMode(contextType ? 'context' : 'personal');
      setSidebarFilter({
        type: initialTab === 'pinned' ? 'pinned' : initialTab === 'tasks' ? 'tasks' : 'all',
      });
      setEditChecklist([]);
      setActiveTool(null);
    }
  }, [opened, contextType, initialTab]);

  const isContextMode = noteMode === 'context' && !!contextType && contextId != null;

  // Fetch notes
  const {
    notes,
    isLoading,
    createNote,
    updateNote,
    deleteNote,
    toggleComplete,
    togglePin,
    reorderNotes,
    deleteCompleted,
    refresh,
  } = useNotes({
    contextType: isContextMode ? contextType : null,
    contextId: isContextMode ? contextId : null,
    enabled: opened,
  });

  // Fetch tags for sidebar
  const { suggestions: allTags } = useNoteTags();

  // DnD
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // ── Filtering ──
  const filteredNotes = useMemo(() => {
    let result = [...notes];

    // Sidebar filter
    if (sidebarFilter.type === 'pinned') {
      result = result.filter((n) => n.pinned);
    } else if (sidebarFilter.type === 'tasks') {
      result = result.filter((n) => n.is_task);
    } else if (sidebarFilter.type === 'tag' && sidebarFilter.tagName) {
      const tagName = sidebarFilter.tagName.toLowerCase();
      result = result.filter((n) => n.tags?.some((t) => t.name.toLowerCase() === tagName));
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (n) =>
          n.content.toLowerCase().includes(q) ||
          n.tags?.some((t) => t.name.toLowerCase().includes(q))
      );
    }

    return result;
  }, [notes, sidebarFilter, searchQuery]);

  const isTaskView = sidebarFilter.type === 'tasks';

  // ── Inline checklist items from all notes (for tasks tab section 2) ──
  const inlineChecklist = useMemo(() => {
    if (!isTaskView) return [];
    const items: Array<ChecklistItem & { noteId: string; noteTitle: string }> = [];
    for (const note of notes) {
      const meta = note.metadata as Record<string, unknown> | undefined;
      const cl = meta?.checklist;
      if (Array.isArray(cl)) {
        const title = note.title || note.content.replace(/<[^>]+>/g, '').slice(0, 50);
        for (const item of cl as ChecklistItem[]) {
          items.push({ ...item, noteId: note.id, noteTitle: title });
        }
      }
    }
    return items;
  }, [notes, isTaskView]);

  // ── Stats ──
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
  const handleCreateNote = useCallback(
    async (data: CreateNoteDTO) => {
      const result = await createNote(data);
      if (result) {
        setComposerOpen(false);
        notifications.show({
          message: 'Not olusturuldu',
          color: 'green',
          icon: <IconCheck size={16} />,
          autoClose: 2000,
        });
      }
    },
    [createNote]
  );

  const handleUpdateNote = useCallback(
    async (data: CreateNoteDTO) => {
      if (!editingNote) return;
      const result = await updateNote(editingNote.id, {
        ...data,
        sort_order: editingNote.sort_order,
      });
      if (result) {
        setEditingNote(null);
        setEditChecklist([]);
        notifications.show({
          message: 'Not guncellendi',
          color: 'green',
          icon: <IconCheck size={16} />,
          autoClose: 2000,
        });
      }
    },
    [editingNote, updateNote]
  );

  const handleDeleteNote = useCallback(
    async (id: string) => {
      const success = await deleteNote(id);
      if (success) {
        notifications.show({ message: 'Not silindi', color: 'orange', autoClose: 2000 });
      }
    },
    [deleteNote]
  );

  const handleToggleComplete = useCallback(
    async (id: string) => {
      await toggleComplete(id);
    },
    [toggleComplete]
  );
  const handleTogglePin = useCallback(
    async (id: string) => {
      await togglePin(id);
    },
    [togglePin]
  );
  const handleColorChange = useCallback(
    async (id: string, color: NoteColor) => {
      await updateNote(id, { color });
    },
    [updateNote]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
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
    },
    [filteredNotes, reorderNotes]
  );

  const handleDeleteCompleted = useCallback(async () => {
    const count = await deleteCompleted();
    if (count > 0) {
      notifications.show({
        message: `${count} tamamlanmis not silindi`,
        color: 'orange',
        autoClose: 2000,
      });
    }
  }, [deleteCompleted]);

  const handleEditNote = useCallback((note: UnifiedNote) => {
    setEditingNote(note);
    // Load checklist from metadata
    const meta = note.metadata as Record<string, unknown> | undefined;
    const checklist = meta?.checklist;
    setEditChecklist(Array.isArray(checklist) ? checklist : []);
  }, []);

  // Template handler - sablon secildiginde notu olusturup notlar gorunumune don
  const handleSelectTemplate = useCallback(
    async (template: NoteTemplate) => {
      const result = await createNote({
        title: template.title,
        content: template.content,
        content_format: 'html',
        is_task: template.isTask,
        color: template.color as NoteColor,
        tags: template.tags,
      });
      if (result) {
        setActiveTool(null);
        notifications.show({
          message: `"${template.name}" sablonundan not olusturuldu`,
          color: 'green',
          icon: <IconCheck size={16} />,
          autoClose: 2000,
        });
      }
    },
    [createNote]
  );

  // AI gorev cikarma handler - AI'dan gelen gorev maddelerini tek tek olustur
  const handleCreateTasksFromAI = useCallback(
    async (tasks: string[]) => {
      for (const taskText of tasks) {
        await createNote({
          title: taskText,
          content: '',
          is_task: true,
          color: 'orange',
        });
      }
      setActiveTool(null);
      setSidebarFilter({ type: 'tasks' });
    },
    [createNote]
  );

  const isToolView = activeTool !== null;

  // ── Context label ──
  const contextLabel = contextType
    ? `${CONTEXT_LABELS[contextType] || contextType}${contextTitle ? `: ${contextTitle}` : ''}`
    : '';

  const borderSubtl = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const surfaceBg = isDark ? '#1a1a1e' : '#ffffff';

  return (
    <Modal
      opened={opened}
      onClose={closeNotes}
      title={
        <Group gap="sm">
          <Box
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: isDark ? 'rgba(139,92,246,0.15)' : 'rgba(139,92,246,0.1)',
              border: `1px solid ${isDark ? 'rgba(139,92,246,0.2)' : 'rgba(139,92,246,0.15)'}`,
            }}
          >
            <IconNote size={20} color="var(--mantine-color-violet-5)" />
          </Box>
          <Box>
            <Text fw={700} size="lg" style={{ letterSpacing: '-0.02em' }}>
              Calisma Alanim
            </Text>
            <Text size="xs" c="dimmed" fw={500}>
              {isContextMode ? contextLabel : 'Notlar, gorevler ve planlama'}
            </Text>
          </Box>
        </Group>
      }
      fullScreen
      radius={0}
      padding={0}
      overlayProps={{ backgroundOpacity: 0.5, blur: 6 }}
      styles={{
        header: {
          padding: '16px 24px',
          borderBottom: `1px solid ${borderSubtl}`,
          background: surfaceBg,
        },
        body: { padding: 0, background: surfaceBg, height: 'calc(100vh - 60px)', display: 'flex', flexDirection: 'column' },
        content: { background: surfaceBg },
      }}
    >
      {/* ── Context Mode Switcher ── */}
      {contextType && contextId != null && (
        <Box px="lg" py="xs" style={{ borderBottom: `1px solid ${borderSubtl}` }}>
          <SegmentedControl
            value={noteMode}
            onChange={(v) => setNoteMode(v as 'personal' | 'context')}
            size="xs"
            data={[
              {
                value: 'personal',
                label: (
                  <Group gap={6} justify="center">
                    <IconUser size={14} />
                    <Text size="xs" fw={500}>
                      Kisisel Notlar
                    </Text>
                  </Group>
                ),
              },
              {
                value: 'context',
                label: (
                  <Group gap={6} justify="center">
                    <IconNotes size={14} />
                    <Text size="xs" fw={500}>
                      {contextLabel}
                    </Text>
                  </Group>
                ),
              },
            ]}
          />
        </Box>
      )}

      {/* ── Main Layout: Sidebar + Content ── */}
      <Group align="stretch" gap={0} wrap="nowrap" style={{ flex: 1, minHeight: 0 }}>
        {/* Sidebar */}
        <NotesSidebar
          notes={notes}
          activeFilter={sidebarFilter}
          onFilterChange={setSidebarFilter}
          tags={allTags}
        />

        {/* Content area */}
        <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {isToolView ? (
            /* ── Tool Content ── */
            <ScrollArea style={{ flex: 1 }} p="lg">
              {activeTool === 'calculator' && <CalculatorTool />}
              {activeTool === 'templates' && (
                <TemplatesTool onSelectTemplate={handleSelectTemplate} />
              )}
              {activeTool === 'ai-help' && (
                <AIHelpTool notes={notes} onCreateTasksFromAI={handleCreateTasksFromAI} />
              )}
              {activeTool === 'export' && <ExportTool notes={notes} />}
            </ScrollArea>
          ) : (
            <>
              {/* Stats + Search bar */}
              <Box px="lg" py="sm" style={{ borderBottom: `1px solid ${borderSubtl}` }}>
                <Group justify="space-between" mb="xs">
                  <Group gap="md">
                    <Badge variant="light" color="blue" size="sm">
                      {stats.total} not
                    </Badge>
                    {stats.pending > 0 && (
                      <Badge variant="light" color="orange" size="sm">
                        {stats.pending} bekleyen
                      </Badge>
                    )}
                    {stats.completed > 0 && (
                      <Badge variant="light" color="green" size="sm">
                        {stats.completed} tamamlanan
                      </Badge>
                    )}
                  </Group>
                  {stats.completed > 0 && (
                    <Button
                      variant="subtle"
                      color="red"
                      size="xs"
                      leftSection={<IconTrash size={14} />}
                      onClick={handleDeleteCompleted}
                    >
                      Tamamlananlari sil
                    </Button>
                  )}
                </Group>
                <TextInput
                  placeholder="Notlarda ara..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.currentTarget.value)}
                  leftSection={<IconSearch size={16} />}
                  rightSection={
                    searchQuery ? (
                      <ActionIcon variant="subtle" size="xs" onClick={() => setSearchQuery('')}>
                        <IconX size={14} />
                      </ActionIcon>
                    ) : null
                  }
                  size="sm"
                  radius="md"
                />
              </Box>

              {/* ── Composer ── */}
              <Box px="lg" py="sm">
                {!composerOpen ? (
                  <Button
                    variant="light"
                    leftSection={<IconPlus size={16} />}
                    onClick={() => {
                      setEditingNote(null);
                      setComposerOpen(true);
                    }}
                    fullWidth
                    radius="md"
                    styles={{
                      root: {
                        background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                        border: `1px dashed ${borderSubtl}`,
                        color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)',
                        fontWeight: 500,
                      },
                    }}
                  >
                    {isTaskView ? 'Yeni gorev ekle...' : 'Yeni not ekle...'}
                  </Button>
                ) : (
                  <Collapse in={composerOpen}>
                    <Paper
                      p="md"
                      radius="md"
                      withBorder
                      style={{
                        borderColor: isTaskView
                          ? 'var(--mantine-color-orange-3)'
                          : 'var(--mantine-color-violet-3)',
                      }}
                    >
                      <Group justify="space-between" mb="sm">
                        <Text size="sm" fw={600} c={isTaskView ? 'orange' : 'violet'}>
                          {isTaskView ? 'Yeni Gorev' : 'Yeni Not'}
                        </Text>
                        <ActionIcon
                          variant="subtle"
                          size="sm"
                          onClick={() => setComposerOpen(false)}
                        >
                          <IconX size={16} />
                        </ActionIcon>
                      </Group>
                      <NoteEditor
                        onSave={handleCreateNote}
                        onCancel={() => setComposerOpen(false)}
                        compact
                        taskMode={isTaskView}
                        showTaskToggle={!isTaskView}
                        initialIsTask={isTaskView}
                        initialColor={isTaskView ? 'orange' : 'blue'}
                      />
                    </Paper>
                  </Collapse>
                )}
              </Box>

              {/* ── Notes list ── */}
              <ScrollArea style={{ flex: 1 }} px="lg" pb="md">
                {isLoading ? (
                  <Center h={200}>
                    <Stack align="center" gap="xs">
                      <Loader size="md" color="violet" />
                      <Text size="sm" c="dimmed">
                        Notlar yukleniyor...
                      </Text>
                    </Stack>
                  </Center>
                ) : filteredNotes.length === 0 ? (
                  <Center h={200}>
                    <Stack align="center" gap="xs">
                      <Box
                        style={{
                          width: 64,
                          height: 64,
                          borderRadius: 16,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                        }}
                      >
                        <IconNotes size={32} color="gray" opacity={0.4} />
                      </Box>
                      <Text c="dimmed" size="sm" fw={500}>
                        {searchQuery
                          ? 'Aramanizla eslesen not bulunamadi'
                          : sidebarFilter.type === 'pinned'
                            ? 'Sabitlenen not yok'
                            : sidebarFilter.type === 'tasks'
                              ? 'Gorev yok'
                              : sidebarFilter.type === 'tag'
                                ? `"${sidebarFilter.tagName}" etiketi ile not yok`
                                : 'Henuz not eklenmemis'}
                      </Text>
                      {!searchQuery && sidebarFilter.type === 'all' && !composerOpen && (
                        <Button
                          variant="light"
                          size="xs"
                          color="violet"
                          leftSection={<IconPlus size={14} />}
                          onClick={() => setComposerOpen(true)}
                        >
                          Ilk notunu ekle
                        </Button>
                      )}
                    </Stack>
                  </Center>
                ) : (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={filteredNotes.map((n) => n.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <Stack gap="xs">
                        {filteredNotes.map((note) => (
                          <Stack key={note.id} gap={4}>
                            <SortableNoteCard
                              note={note}
                              onToggleComplete={handleToggleComplete}
                              onTogglePin={handleTogglePin}
                              onDelete={handleDeleteNote}
                              onEdit={handleEditNote}
                              onColorChange={handleColorChange}
                            />
                            {/* Inline attachments preview */}
                            {note.attachments && note.attachments.length > 0 && (
                              <Box ml={28}>
                                <NoteAttachments
                                  noteId={note.id}
                                  attachments={note.attachments}
                                  onUpdate={refresh}
                                />
                              </Box>
                            )}
                            {/* Inline checklist preview */}
                            {Array.isArray((note.metadata as Record<string, unknown>)?.checklist) &&
                              (
                                (note.metadata as Record<string, unknown>)
                                  .checklist as ChecklistItem[]
                              ).length > 0 && (
                                <Box ml={28}>
                                  <NoteChecklist
                                    items={
                                      (note.metadata as Record<string, unknown>)
                                        .checklist as ChecklistItem[]
                                    }
                                    onChange={() => {}}
                                    readonly
                                  />
                                </Box>
                              )}
                          </Stack>
                        ))}
                      </Stack>
                    </SortableContext>
                  </DndContext>
                )}

                {/* ── Not Ici Gorevler (only in tasks view) ── */}
                {isTaskView && inlineChecklist.length > 0 && (
                  <Box mt="lg">
                    <Divider
                      label={
                        <Text size="xs" fw={600} c="dimmed">
                          Not Ici Gorevler ({inlineChecklist.filter((i) => i.done).length}/
                          {inlineChecklist.length})
                        </Text>
                      }
                      labelPosition="left"
                      mb="sm"
                    />
                    <Stack gap={4}>
                      {inlineChecklist.map((item) => (
                        <Group key={`${item.noteId}-${item.id}`} gap="xs" wrap="nowrap">
                          <Checkbox
                            checked={item.done}
                            size="xs"
                            radius="xl"
                            readOnly
                            styles={{ input: { cursor: 'default' } }}
                          />
                          <Text
                            size="xs"
                            style={{
                              flex: 1,
                              textDecoration: item.done ? 'line-through' : 'none',
                              opacity: item.done ? 0.5 : 1,
                            }}
                          >
                            {item.text}
                          </Text>
                          <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
                            {item.noteTitle}
                          </Text>
                        </Group>
                      ))}
                    </Stack>
                  </Box>
                )}
              </ScrollArea>
            </>
          )}
        </Box>
      </Group>

      {/* ── Bottom Dock (Araclar) ── */}
      <Box
        style={{
          padding: '12px 0 14px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Box
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '8px 20px',
            borderRadius: 20,
            background: isDark
              ? 'rgba(255,255,255,0.06)'
              : 'rgba(0,0,0,0.04)',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
            backdropFilter: 'blur(12px)',
          }}
        >
          {([
            { key: 'calculator' as ToolType, icon: <IconCalculator size={22} />, label: 'Hesap Makinasi', color: 'teal' },
            { key: 'templates' as ToolType, icon: <IconTemplate size={22} />, label: 'Sablonlar', color: 'violet' },
            { key: 'ai-help' as ToolType, icon: <IconSparkles size={22} />, label: 'AI Yardim', color: 'blue' },
            { key: 'export' as ToolType, icon: <IconDownload size={22} />, label: 'Disa Aktar', color: 'orange' },
          ]).map((tool) => {
            const isActive = activeTool === tool.key;
            return (
              <Tooltip key={tool.key} label={tool.label} position="top" withArrow>
                <Box
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                    cursor: 'pointer',
                  }}
                  onClick={() => setActiveTool(isActive ? null : tool.key)}
                >
                  <Box
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 14,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: isActive
                        ? `var(--mantine-color-${tool.color}-${isDark ? '8' : '1'})`
                        : isDark
                          ? 'rgba(255,255,255,0.05)'
                          : 'rgba(0,0,0,0.03)',
                      border: isActive
                        ? `1.5px solid var(--mantine-color-${tool.color}-${isDark ? '6' : '3'})`
                        : `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'}`,
                      color: isActive
                        ? `var(--mantine-color-${tool.color}-${isDark ? '4' : '7'})`
                        : isDark
                          ? 'rgba(255,255,255,0.5)'
                          : 'rgba(0,0,0,0.4)',
                      transition: 'all 0.2s ease',
                      transform: isActive ? 'scale(1.08)' : 'scale(1)',
                    }}
                  >
                    {tool.icon}
                  </Box>
                  <Box
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: '50%',
                      background: isActive
                        ? `var(--mantine-color-${tool.color}-5)`
                        : 'transparent',
                      transition: 'background 0.2s ease',
                    }}
                  />
                </Box>
              </Tooltip>
            );
          })}
        </Box>
      </Box>

      {/* ── Edit Note Modal ── */}
      <Modal
        opened={!!editingNote}
        onClose={() => {
          setEditingNote(null);
          setEditChecklist([]);
        }}
        title={
          <Group gap="xs">
            <IconNote size={18} />
            <Text fw={600} size="sm">
              Notu Duzenle
            </Text>
          </Group>
        }
        size="lg"
        radius="lg"
        centered
      >
        {editingNote && (
          <Stack>
            <NoteEditor
              initialTitle={editingNote.title || ''}
              initialContent={editingNote.content}
              initialContentFormat={editingNote.content_format}
              initialColor={editingNote.color}
              initialPriority={editingNote.priority}
              initialTags={editingNote.tags?.map((t) => t.name) ?? []}
              initialDueDate={editingNote.due_date ? new Date(editingNote.due_date) : null}
              initialReminderDate={
                editingNote.reminder_date ? new Date(editingNote.reminder_date) : null
              }
              initialIsTask={editingNote.is_task}
              initialChecklist={editChecklist}
              onSave={handleUpdateNote}
              onCancel={() => {
                setEditingNote(null);
                setEditChecklist([]);
              }}
              saveLabel="Guncelle"
            />

            {/* Attachments (not editor icinde checklist zaten var) */}
            {editingNote.attachments && editingNote.attachments.length > 0 && (
              <Paper p="sm" withBorder radius="md">
                <Text size="xs" fw={600} mb="xs">
                  Dosya Ekleri
                </Text>
                <NoteAttachments
                  noteId={editingNote.id}
                  attachments={editingNote.attachments}
                  onUpdate={refresh}
                />
              </Paper>
            )}
          </Stack>
        )}
      </Modal>
    </Modal>
  );
}

export default UnifiedNotesModal;
