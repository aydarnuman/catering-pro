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
import { IconListCheck, IconNotes, IconPin, IconSearch, IconX } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import type { NoteTag, UnifiedNote } from '@/types/notes';

interface NotesSidebarProps {
  notes: UnifiedNote[];
  activeFilter: SidebarFilter;
  onFilterChange: (filter: SidebarFilter) => void;
  tags: NoteTag[];
}

export type ToolType = 'calculator' | 'tracker';

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

  const sidebarItems: Array<{
    type: 'all' | 'pinned' | 'tasks';
    label: string;
    icon: React.ReactNode;
    color: string;
    count: number;
  }> = [
    {
      type: 'all',
      label: 'Tum Notlar',
      icon: <IconNotes size={16} />,
      color: 'blue',
      count: stats.total,
    },
    {
      type: 'pinned',
      label: 'Sabitlenen',
      icon: <IconPin size={16} />,
      color: 'violet',
      count: stats.pinned,
    },
    {
      type: 'tasks',
      label: 'Gorevler',
      icon: <IconListCheck size={16} />,
      color: 'orange',
      count: stats.tasks,
    },
  ];

  return (
    <Box
      style={{
        width: 220,
        borderRight: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: isDark ? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0.015)',
      }}
    >
      <ScrollArea style={{ flex: 1 }} p="xs">
        <Stack gap={2}>
          {/* Main filters */}
          {sidebarItems.map((item) => {
            const isActive = activeFilter.type === item.type;
            return (
              <NavLink
                key={item.type}
                label={
                  <Text size="sm" fw={isActive ? 600 : 500}>
                    {item.label}
                  </Text>
                }
                leftSection={
                  <Box
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: isActive
                        ? `var(--mantine-color-${item.color}-${isDark ? '8' : '0'})`
                        : isDark
                          ? 'rgba(255,255,255,0.04)'
                          : 'rgba(0,0,0,0.03)',
                      color: isActive
                        ? `var(--mantine-color-${item.color}-${isDark ? '4' : '6'})`
                        : isDark
                          ? 'rgba(255,255,255,0.5)'
                          : 'rgba(0,0,0,0.4)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {item.icon}
                  </Box>
                }
                rightSection={
                  item.count > 0 ? (
                    <Badge size="xs" variant={isActive ? 'filled' : 'light'} color={item.color}>
                      {item.count}
                    </Badge>
                  ) : undefined
                }
                active={isActive}
                onClick={() => onFilterChange({ type: item.type })}
                variant="light"
                className="ws-sidebar-item"
                style={{
                  borderRadius: 10,
                  borderLeft: isActive
                    ? `3px solid var(--mantine-color-${item.color}-5)`
                    : '3px solid transparent',
                  transition: 'all 0.15s ease',
                }}
              />
            );
          })}

          {/* Tags section */}
          {tags.length > 0 && (
            <>
              <Divider
                my="sm"
                label={
                  <Text
                    size="xs"
                    fw={600}
                    c="dimmed"
                    tt="uppercase"
                    style={{ letterSpacing: '0.05em' }}
                  >
                    Etiketler
                  </Text>
                }
                labelPosition="left"
              />

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
                  radius="md"
                />
              )}

              {filteredTags.map((tag) => {
                const isTagActive = activeFilter.type === 'tag' && activeFilter.tagId === tag.id;
                return (
                  <NavLink
                    key={tag.id}
                    label={
                      <Text size="xs" fw={isTagActive ? 600 : 400}>
                        {tag.name}
                      </Text>
                    }
                    leftSection={
                      <Box
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          background: `var(--mantine-color-${tag.color || 'gray'}-5)`,
                          boxShadow: isTagActive
                            ? `0 0 6px var(--mantine-color-${tag.color || 'gray'}-5)`
                            : 'none',
                          transition: 'box-shadow 0.15s ease',
                        }}
                      />
                    }
                    rightSection={
                      tag.usage_count ? (
                        <Text size="xs" c="dimmed">
                          {tag.usage_count}
                        </Text>
                      ) : undefined
                    }
                    active={isTagActive}
                    onClick={() =>
                      onFilterChange({ type: 'tag', tagId: tag.id, tagName: tag.name })
                    }
                    variant="light"
                    className="ws-sidebar-item"
                    style={{ borderRadius: 8, transition: 'all 0.15s ease' }}
                  />
                );
              })}
            </>
          )}
        </Stack>
      </ScrollArea>
    </Box>
  );
}

export default NotesSidebar;
