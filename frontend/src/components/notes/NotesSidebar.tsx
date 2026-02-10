'use client';

/**
 * NotesSidebar - Sol panel: etiket filtreleme + context gruplari
 */

import {
  ActionIcon,
  Badge,
  Box,
  Divider,
  NavLink,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  useMantineColorScheme,
} from '@mantine/core';
import {
  IconListCheck,
  IconNotes,
  IconPin,
  IconSearch,
  IconX,
} from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import type { NoteTag, UnifiedNote } from '@/types/notes';

interface NotesSidebarProps {
  notes: UnifiedNote[];
  activeFilter: SidebarFilter;
  onFilterChange: (filter: SidebarFilter) => void;
  tags: NoteTag[];
}

export interface SidebarFilter {
  type: 'all' | 'pinned' | 'tasks' | 'tag';
  tagId?: number;
  tagName?: string;
}

export function NotesSidebar({ notes, activeFilter, onFilterChange, tags }: NotesSidebarProps) {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';
  const [tagSearch, setTagSearch] = useState('');

  // Compute stats
  const stats = useMemo(() => {
    const pinned = notes.filter((n) => n.pinned).length;
    const tasks = notes.filter((n) => n.is_task).length;
    return { total: notes.length, pinned, tasks };
  }, [notes]);

  // Filter tags by search
  const filteredTags = useMemo(() => {
    if (!tagSearch.trim()) return tags;
    const q = tagSearch.toLowerCase();
    return tags.filter((t) => t.name.toLowerCase().includes(q));
  }, [tags, tagSearch]);

  return (
    <Box
      style={{
        width: 220,
        borderRight: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      <ScrollArea style={{ flex: 1 }} p="xs">
        <Stack gap={2}>
          {/* Main filters */}
          <NavLink
            label="Tum Notlar"
            leftSection={<IconNotes size={16} />}
            rightSection={<Badge size="xs" variant="light">{stats.total}</Badge>}
            active={activeFilter.type === 'all'}
            onClick={() => onFilterChange({ type: 'all' })}
            variant="light"
            style={{ borderRadius: 8 }}
          />
          <NavLink
            label="Sabitlenen"
            leftSection={<IconPin size={16} />}
            rightSection={stats.pinned > 0 ? <Badge size="xs" variant="light" color="violet">{stats.pinned}</Badge> : undefined}
            active={activeFilter.type === 'pinned'}
            onClick={() => onFilterChange({ type: 'pinned' })}
            variant="light"
            style={{ borderRadius: 8 }}
          />
          <NavLink
            label="Gorevler"
            leftSection={<IconListCheck size={16} />}
            rightSection={stats.tasks > 0 ? <Badge size="xs" variant="light" color="orange">{stats.tasks}</Badge> : undefined}
            active={activeFilter.type === 'tasks'}
            onClick={() => onFilterChange({ type: 'tasks' })}
            variant="light"
            style={{ borderRadius: 8 }}
          />

          {/* Tags section */}
          {tags.length > 0 && (
            <>
              <Divider my="xs" label="Etiketler" labelPosition="left" />

              {tags.length > 5 && (
                <TextInput
                  placeholder="Etiket ara..."
                  size="xs"
                  value={tagSearch}
                  onChange={(e) => setTagSearch(e.currentTarget.value)}
                  leftSection={<IconSearch size={12} />}
                  rightSection={
                    tagSearch ? (
                      <ActionIcon size="xs" variant="subtle" onClick={() => setTagSearch('')}>
                        <IconX size={10} />
                      </ActionIcon>
                    ) : null
                  }
                  mb={4}
                />
              )}

              {filteredTags.map((tag) => (
                <NavLink
                  key={tag.id}
                  label={tag.name}
                  leftSection={
                    <Box
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        background: `var(--mantine-color-${tag.color || 'gray'}-5)`,
                      }}
                    />
                  }
                  rightSection={
                    tag.usage_count ? (
                      <Text size="xs" c="dimmed">{tag.usage_count}</Text>
                    ) : undefined
                  }
                  active={activeFilter.type === 'tag' && activeFilter.tagId === tag.id}
                  onClick={() => onFilterChange({ type: 'tag', tagId: tag.id, tagName: tag.name })}
                  variant="light"
                  style={{ borderRadius: 8 }}
                />
              ))}
            </>
          )}
        </Stack>
      </ScrollArea>
    </Box>
  );
}

export default NotesSidebar;
