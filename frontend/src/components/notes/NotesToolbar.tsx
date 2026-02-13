'use client';

/**
 * NotesToolbar - Stats badges, search, tag filter, export menu, calc toggle
 */

import { ActionIcon, Badge, Box, CopyButton, Group, Menu, Select, TextInput, Tooltip } from '@mantine/core';
import {
  IconCalculator,
  IconCheck,
  IconCopy,
  IconDownload,
  IconFileText,
  IconPin,
  IconPrinter,
  IconSearch,
  IconTrash,
  IconX,
} from '@tabler/icons-react';

interface NotesToolbarProps {
  activeTab: 'notes' | 'tasks';
  stats: { total: number; pending: number; completed: number; pinned: number };
  searchQuery: string;
  onSearchChange: (query: string) => void;
  tagFilter: string | null;
  onTagFilterChange: (tag: string | null) => void;
  tagOptions: Array<{ value: string; label: string }>;
  calcOpen: boolean;
  onCalcToggle: () => void;
  notesCount: number;
  allNotesText: string;
  allNotesMarkdown: string;
  onPrint: () => void;
  onDeleteCompleted: () => void;
  borderColor: string;
}

export function NotesToolbar({
  activeTab,
  stats,
  searchQuery,
  onSearchChange,
  tagFilter,
  onTagFilterChange,
  tagOptions,
  calcOpen,
  onCalcToggle,
  notesCount,
  allNotesText,
  allNotesMarkdown,
  onPrint,
  onDeleteCompleted,
  borderColor,
}: NotesToolbarProps) {
  const isTaskView = activeTab === 'tasks';

  return (
    <Box px="lg" py="sm" style={{ borderBottom: `1px solid ${borderColor}` }}>
      <Group justify="space-between" mb="xs">
        <Group gap="md">
          {activeTab === 'notes' && stats.pinned > 0 && (
            <Badge variant="light" color="violet" size="sm" leftSection={<IconPin size={10} />}>
              {stats.pinned} sabitli
            </Badge>
          )}
          {activeTab === 'tasks' && stats.completed > 0 && (
            <Badge variant="light" color="green" size="sm">
              {stats.completed} tamamlanan
            </Badge>
          )}
        </Group>
        <Group gap={4}>
          <Tooltip label="Hesap Makinasi">
            <ActionIcon
              variant={calcOpen ? 'light' : 'subtle'}
              color={calcOpen ? 'teal' : 'gray'}
              size="sm"
              radius="md"
              onClick={onCalcToggle}
            >
              <IconCalculator size={15} />
            </ActionIcon>
          </Tooltip>
          {notesCount > 0 && (
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
                <Menu.Item leftSection={<IconPrinter size={14} />} onClick={onPrint}>
                  Yazdir
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          )}
          {stats.completed > 0 && (
            <Tooltip label="Tamamlananlari sil">
              <ActionIcon variant="subtle" color="red" size="sm" radius="md" onClick={onDeleteCompleted}>
                <IconTrash size={15} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      </Group>
      <Group gap="xs">
        <TextInput
          placeholder={isTaskView ? 'Gorevlerde ara...' : 'Notlarda ara...'}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.currentTarget.value)}
          leftSection={<IconSearch size={16} />}
          rightSection={
            searchQuery ? (
              <ActionIcon variant="subtle" size="xs" onClick={() => onSearchChange('')}>
                <IconX size={14} />
              </ActionIcon>
            ) : null
          }
          size="sm"
          radius="md"
          className="ws-search-input"
          style={{ flex: 1 }}
        />
        {tagOptions.length > 0 && (
          <Select
            placeholder="Etiket"
            data={tagOptions}
            value={tagFilter}
            onChange={onTagFilterChange}
            size="sm"
            radius="md"
            clearable
            style={{ width: 140 }}
            leftSection={<IconPin size={12} />}
          />
        )}
      </Group>
    </Box>
  );
}
