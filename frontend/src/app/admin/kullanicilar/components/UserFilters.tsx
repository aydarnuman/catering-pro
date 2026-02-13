'use client';

import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Menu,
  Paper,
  SegmentedControl,
  Select,
  Text,
  TextInput,
} from '@mantine/core';
import { IconCheck, IconChevronDown, IconFilter, IconSearch, IconTrash, IconX } from '@tabler/icons-react';

interface UserFiltersProps {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  roleFilter: string | null;
  setRoleFilter: (value: string | null) => void;
  statusFilter: string;
  setStatusFilter: (value: string) => void;
  selectedCount: number;
  filteredCount: number;
  totalCount: number;
  onBulkActivate: () => void;
  onBulkDeactivate: () => void;
  onBulkDelete: () => void;
  onClearSelection: () => void;
}

export function UserFilters({
  searchQuery,
  setSearchQuery,
  roleFilter,
  setRoleFilter,
  statusFilter,
  setStatusFilter,
  selectedCount,
  filteredCount,
  totalCount,
  onBulkActivate,
  onBulkDeactivate,
  onBulkDelete,
  onClearSelection,
}: UserFiltersProps) {
  return (
    <Paper p="md" radius="md" withBorder>
      <Group justify="space-between" wrap="wrap">
        <Group>
          <TextInput
            placeholder="Ad veya email ara..."
            leftSection={<IconSearch size={16} />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            w={250}
          />
          <Select
            placeholder="Rol filtrele"
            leftSection={<IconFilter size={16} />}
            data={[
              { value: 'super_admin', label: 'Süper Admin' },
              { value: 'admin', label: 'Yönetici' },
              { value: 'user', label: 'Kullanıcı' },
            ]}
            value={roleFilter}
            onChange={setRoleFilter}
            clearable
            w={160}
          />
          <SegmentedControl
            value={statusFilter}
            onChange={setStatusFilter}
            data={[
              { value: 'all', label: 'Tümü' },
              { value: 'active', label: 'Aktif' },
              { value: 'inactive', label: 'Pasif' },
              { value: 'locked', label: 'Kilitli' },
            ]}
          />
        </Group>

        {selectedCount > 0 && (
          <Group>
            <Badge variant="light" size="lg">
              {selectedCount} seçili
            </Badge>
            <Menu shadow="md" width={200}>
              <Menu.Target>
                <Button variant="light" rightSection={<IconChevronDown size={16} />}>
                  Toplu İşlem
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item leftSection={<IconCheck size={16} />} onClick={onBulkActivate}>
                  Aktif Et
                </Menu.Item>
                <Menu.Item leftSection={<IconX size={16} />} onClick={onBulkDeactivate}>
                  Pasif Et
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item color="red" leftSection={<IconTrash size={16} />} onClick={onBulkDelete}>
                  Sil
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
            <ActionIcon variant="subtle" color="gray" onClick={onClearSelection} title="Seçimi Temizle">
              <IconX size={16} />
            </ActionIcon>
          </Group>
        )}
      </Group>

      {(searchQuery || roleFilter || statusFilter !== 'all') && (
        <Text size="sm" c="dimmed" mt="sm">
          {filteredCount} / {totalCount} kullanıcı gösteriliyor
        </Text>
      )}
    </Paper>
  );
}
