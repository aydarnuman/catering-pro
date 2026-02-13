'use client';

/**
 * UnifiedNotesModal - Calisma Alanim
 * SegmentedControl: Notlar | Gorevler | Takip Defteri
 * Orchestrates sub-components: FolderBar, NotesToolbar, NoteComposer, NotesList, EditNoteModal, CalcPopup
 */

import { ActionIcon, Box, CopyButton, Group, Menu, Modal, ScrollArea, SegmentedControl, Text, Tooltip, useMantineColorScheme } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconArrowsMaximize,
  IconArrowsMinimize,
  IconCalculator,
  IconCalendar,
  IconCheck,
  IconCopy,
  IconDownload,
  IconFileText,
  IconListCheck,
  IconNote,
  IconNotebook,
  IconNotes,
  IconPrinter,
  IconUser,
  IconX,
} from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useNotesModal } from '@/context/NotesContext';
import { useNoteFolders } from '@/hooks/useNoteFolders';
import { useNotes, useNoteTags } from '@/hooks/useNotes';
import type { CreateNoteDTO, NoteColor, UnifiedNote } from '@/types/notes';
import { AgendaView } from './AgendaView';
import { CalcPopup } from './CalcPopup';
import { EditNoteModal } from './EditNoteModal';
import { FolderBar } from './FolderBar';
import type { ChecklistItem } from './NoteChecklist';
import { NoteComposer } from './NoteComposer';
import { NotesList } from './NotesList';
import { NotesToolbar } from './NotesToolbar';
import { TrackerTool } from './tools/tracker';
import { useNoteExport } from './useNoteExport';

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

type MainTab = 'plan' | 'tracker';
type SubTab = 'notes' | 'tasks' | 'agenda';
type ActiveTab = SubTab | 'tracker';

export function UnifiedNotesModal() {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [isExpanded, setIsExpanded] = useState(false);
  const isFullScreen = !!isMobile || isExpanded;

  const { state, closeNotes } = useNotesModal();
  const { opened, contextType, contextId, contextTitle, initialTab } = state;

  // ── State ──
  const [mainTab, setMainTab] = useState<MainTab>('plan');
  const [subTab, setSubTab] = useState<SubTab>('notes');
  const activeTab: ActiveTab = mainTab === 'tracker' ? 'tracker' : subTab;
  const [searchQuery, setSearchQuery] = useState('');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [activeFolderId, setActiveFolderId] = useState<number | null>(null);
  const [unlockedFolders, setUnlockedFolders] = useState<Set<number>>(new Set());
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<UnifiedNote | null>(null);
  const [noteMode, setNoteMode] = useState<'personal' | 'context'>('personal');
  const [editChecklist, setEditChecklist] = useState<ChecklistItem[]>([]);
  const [calcOpen, setCalcOpen] = useState(false);

  // Folders hook
  const { folders, createFolder, deleteFolder, unlockFolder, moveNote: moveNoteToFolder } = useNoteFolders();

  // Reset on open
  useEffect(() => {
    if (opened) {
      setSearchQuery('');
      setTagFilter(null);
      setActiveFolderId(null);
      setUnlockedFolders(new Set());
      setComposerOpen(false);
      setEditingNote(null);
      setNoteMode(contextType ? 'context' : 'personal');
      if (initialTab === 'tasks' || initialTab === 'agenda') {
        setMainTab('plan');
        setSubTab(initialTab);
      } else {
        setMainTab('plan');
        setSubTab('notes');
      }
      setEditChecklist([]);
      setCalcOpen(false);
    }
  }, [opened, contextType, initialTab]);

  const isContextMode = noteMode === 'context' && !!contextType && contextId != null;
  const isTaskView = activeTab === 'tasks';

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

  const { suggestions: allTags } = useNoteTags();
  const { allNotesText, allNotesMarkdown, handlePrint } = useNoteExport(notes);

  // ── Filtering ──
  // Determine which folder IDs are locked (have password & not yet unlocked)
  const lockedFolderIds = useMemo(() => {
    const ids = new Set<number>();
    for (const f of folders) {
      if (f.is_locked && !unlockedFolders.has(f.id)) {
        ids.add(f.id);
      }
    }
    return ids;
  }, [folders, unlockedFolders]);

  const filteredNotes = useMemo(() => {
    let result = [...notes];

    // Hide notes in locked folders (password not entered yet)
    if (lockedFolderIds.size > 0) {
      result = result.filter((n) => !n.folder_id || !lockedFolderIds.has(n.folder_id));
    }

    // Folder filter applies to all plan tabs (notes, tasks, agenda)
    if (activeFolderId !== null) {
      result = result.filter((n) => n.folder_id === activeFolderId);
    }

    if (activeTab === 'tasks') {
      result = result.filter((n) => n.is_task);
    } else if (activeTab === 'notes') {
      result.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return 0;
      });
    }

    if (tagFilter) {
      const tl = tagFilter.toLowerCase();
      result = result.filter((n) => n.tags?.some((t) => t.name.toLowerCase() === tl));
    }

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
  }, [notes, activeTab, activeFolderId, lockedFolderIds, tagFilter, searchQuery]);

  const pinnedCount = activeTab === 'notes' ? filteredNotes.filter((n) => n.pinned).length : 0;

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

  // Tag options
  const tagOptions = useMemo(() => allTags.map((t) => ({ value: t.name, label: t.name })), [allTags]);

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
      if (success) notifications.show({ message: 'Not silindi', color: 'orange', autoClose: 2000 });
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

  const handleDeleteCompleted = useCallback(async () => {
    const count = await deleteCompleted();
    if (count > 0)
      notifications.show({ message: `${count} tamamlanmis not silindi`, color: 'orange', autoClose: 2000 });
  }, [deleteCompleted]);

  const handleEditNote = useCallback((note: UnifiedNote) => {
    setEditingNote(note);
    const meta = note.metadata as Record<string, unknown> | undefined;
    const checklist = meta?.checklist;
    setEditChecklist(Array.isArray(checklist) ? checklist : []);
  }, []);

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
      withCloseButton={false}
      title={
        <Group justify="space-between" wrap="nowrap" style={{ width: '100%' }}>
          <Group gap="sm" wrap="nowrap">
            <Box
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: isDark
                  ? 'linear-gradient(135deg, rgba(139,92,246,0.2) 0%, rgba(99,102,241,0.15) 100%)'
                  : 'linear-gradient(135deg, rgba(139,92,246,0.12) 0%, rgba(99,102,241,0.08) 100%)',
                border: `1px solid ${isDark ? 'rgba(139,92,246,0.25)' : 'rgba(139,92,246,0.18)'}`,
                boxShadow: '0 2px 8px rgba(139,92,246,0.15)',
              }}
            >
              <IconNote size={20} color="var(--mantine-color-violet-5)" />
            </Box>
            <Box>
              <Text fw={700} size="lg" style={{ letterSpacing: '-0.02em' }}>
                Calisma Alanim
              </Text>
              <Text size="xs" c="dimmed" fw={500}>
                {isContextMode ? contextLabel : 'Notlar, gorevler ve takip'}
              </Text>
            </Box>
          </Group>
          <Group gap={4} wrap="nowrap">
            {!isMobile && (
              <ActionIcon
                variant="subtle"
                color="gray"
                size="md"
                radius="md"
                onClick={() => setIsExpanded((v) => !v)}
                title={isExpanded ? 'Kucult' : 'Tam ekran'}
              >
                {isExpanded ? <IconArrowsMinimize size={18} /> : <IconArrowsMaximize size={18} />}
              </ActionIcon>
            )}
            <ActionIcon
              variant="subtle"
              color="gray"
              size="md"
              radius="md"
              onClick={closeNotes}
              title="Kapat (ESC)"
              style={{ transition: 'all 0.15s ease' }}
            >
              <IconX size={18} />
            </ActionIcon>
          </Group>
        </Group>
      }
      fullScreen={isFullScreen}
      size={isFullScreen ? undefined : 900}
      centered={!isFullScreen}
      radius={isFullScreen ? 0 : 'lg'}
      padding={0}
      overlayProps={{ backgroundOpacity: 0.5, blur: 8 }}
      styles={{
        header: {
          padding: '16px 24px',
          background: isDark
            ? 'linear-gradient(180deg, #1e1e24 0%, #1a1a1e 100%)'
            : 'linear-gradient(180deg, #ffffff 0%, #fafafa 100%)',
          backdropFilter: 'blur(12px)',
          borderRadius: isFullScreen ? 0 : 'var(--mantine-radius-lg) var(--mantine-radius-lg) 0 0',
        },
        body: {
          padding: 0,
          background: surfaceBg,
          height: isFullScreen ? 'calc(100vh - 60px)' : '60vh',
          display: 'flex',
          flexDirection: 'column',
        },
        content: {
          background: surfaceBg,
          maxHeight: isFullScreen ? undefined : '70vh',
          borderRadius: isFullScreen ? 0 : 'var(--mantine-radius-lg)',
        },
        title: { flex: 1 },
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
              {
                value: 'personal',
                label: (
                  <Group gap={6} justify="center">
                    <IconUser size={14} />
                    <Text size="xs" fw={500}>
                      Kisisel
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

      {/* ── Main Tabs + Global Actions ── */}
      <Box px="lg" py="sm" style={{ borderBottom: `1px solid ${borderSubtl}` }}>
        <Group gap="sm" wrap="nowrap">
          <SegmentedControl
            value={mainTab}
            onChange={(v) => {
              setMainTab(v as MainTab);
              setSearchQuery('');
              setTagFilter(null);
              setComposerOpen(false);
            }}
            size="sm"
            radius="md"
            style={{ flex: 1 }}
            data={[
              {
                value: 'plan',
                label: (
                  <Group gap={6} justify="center">
                    <IconNotes size={15} />
                    <Text size="xs" fw={600}>
                      Takip Plani
                    </Text>
                  </Group>
                ),
              },
              {
                value: 'tracker',
                label: (
                  <Group gap={6} justify="center">
                    <IconNotebook size={15} />
                    <Text size="xs" fw={600}>
                      Takip Defteri
                    </Text>
                  </Group>
                ),
              },
            ]}
          />
          <Group gap={4} wrap="nowrap">
            <Tooltip label="Hesap Makinasi">
              <ActionIcon
                variant={calcOpen ? 'light' : 'subtle'}
                color={calcOpen ? 'teal' : 'gray'}
                size="sm"
                radius="md"
                onClick={() => setCalcOpen((p) => !p)}
              >
                <IconCalculator size={15} />
              </ActionIcon>
            </Tooltip>
            {notes.length > 0 && (
              <Menu position="bottom-end" withArrow>
                <Menu.Target>
                  <Tooltip label="Disa aktar">
                    <ActionIcon variant="subtle" color="gray" size="sm" radius="md">
                      <IconDownload size={15} />
                    </ActionIcon>
                  </Tooltip>
                </Menu.Target>
                <Menu.Dropdown>
                  <CopyButton value={allNotesText}>
                    {({ copied, copy }) => (
                      <Menu.Item
                        leftSection={copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                        onClick={copy}
                        color={copied ? 'green' : undefined}
                      >
                        {copied ? 'Kopyalandi' : 'Tumunu kopyala'}
                      </Menu.Item>
                    )}
                  </CopyButton>
                  <CopyButton value={allNotesMarkdown}>
                    {({ copied, copy }) => (
                      <Menu.Item
                        leftSection={copied ? <IconCheck size={14} /> : <IconFileText size={14} />}
                        onClick={copy}
                        color={copied ? 'green' : undefined}
                      >
                        {copied ? 'Kopyalandi' : 'Markdown'}
                      </Menu.Item>
                    )}
                  </CopyButton>
                  <Menu.Divider />
                  <Menu.Item leftSection={<IconPrinter size={14} />} onClick={handlePrint}>
                    Yazdir
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            )}
          </Group>
        </Group>
      </Box>

      {/* ── Folder Bar (tum sekmeler) ── */}
      <FolderBar
        folders={folders}
        activeFolderId={activeFolderId}
        onFolderSelect={setActiveFolderId}
        createFolder={createFolder}
        deleteFolder={deleteFolder}
        unlockFolder={unlockFolder}
        unlockedFolders={unlockedFolders}
        onUnlockFolder={(id) => setUnlockedFolders((prev) => new Set([...prev, id]))}
        borderColor={borderSubtl}
      />

      {/* ── Sub Tabs (Takip Plani) ── */}
      {mainTab === 'plan' && (
        <Box px="lg" py={8} style={{ borderBottom: `1px solid ${borderSubtl}` }}>
          <SegmentedControl
            value={subTab}
            onChange={(v) => {
              setSubTab(v as SubTab);
              setSearchQuery('');
              setTagFilter(null);
              setComposerOpen(false);
            }}
            size="sm"
            radius="md"
            fullWidth
            data={[
              {
                value: 'notes',
                label: (
                  <Group gap={4} justify="center">
                    <IconNotes size={13} />
                    <Text size="xs" fw={500}>
                      Notlar{stats.total > 0 ? ` (${stats.total})` : ''}
                    </Text>
                  </Group>
                ),
              },
              {
                value: 'tasks',
                label: (
                  <Group gap={4} justify="center">
                    <IconListCheck size={13} />
                    <Text size="xs" fw={500}>
                      Gorevler{stats.pending > 0 ? ` (${stats.pending})` : ''}
                    </Text>
                  </Group>
                ),
              },
              {
                value: 'agenda',
                label: (
                  <Group gap={4} justify="center">
                    <IconCalendar size={13} />
                    <Text size="xs" fw={500}>
                      Ajanda
                    </Text>
                  </Group>
                ),
              },
            ]}
          />
        </Box>
      )}

      {/* ── Content Area ── */}
      <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, position: 'relative' }}>
        <CalcPopup open={calcOpen} onClose={() => setCalcOpen(false)} />

        {activeTab === 'tracker' ? (
          <ScrollArea style={{ flex: 1 }} p="lg">
            <Box className="ws-tool-fade-in">
              <TrackerTool />
            </Box>
          </ScrollArea>
        ) : activeTab === 'agenda' ? (
          <AgendaView notes={filteredNotes} onEdit={handleEditNote} onToggleComplete={handleToggleComplete} />
        ) : (
          <>
            <NotesToolbar
              activeTab={activeTab}
              stats={stats}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              tagFilter={tagFilter}
              onTagFilterChange={setTagFilter}
              tagOptions={tagOptions}
              onDeleteCompleted={handleDeleteCompleted}
              borderColor={borderSubtl}
            />

            <NoteComposer
              isOpen={composerOpen}
              onOpen={() => {
                setEditingNote(null);
                setComposerOpen(true);
              }}
              onClose={() => setComposerOpen(false)}
              onSave={handleCreateNote}
              isTaskView={isTaskView}
            />

            <NotesList
              notes={filteredNotes}
              allNotes={notes}
              isLoading={isLoading}
              activeTab={activeTab}
              searchQuery={searchQuery}
              pinnedCount={pinnedCount}
              folders={folders}
              composerOpen={composerOpen}
              onOpenComposer={() => setComposerOpen(true)}
              onToggleComplete={handleToggleComplete}
              onTogglePin={handleTogglePin}
              onDelete={handleDeleteNote}
              onEdit={handleEditNote}
              onColorChange={handleColorChange}
              onReorder={reorderNotes}
              onMoveToFolder={moveNoteToFolder}
              onRefresh={refresh}
            />
          </>
        )}
      </Box>

      {/* ── Edit Note Modal ── */}
      <EditNoteModal
        note={editingNote}
        checklist={editChecklist}
        onSave={handleUpdateNote}
        onClose={() => {
          setEditingNote(null);
          setEditChecklist([]);
        }}
        onRefresh={refresh}
      />
    </Modal>
  );
}

export default UnifiedNotesModal;
