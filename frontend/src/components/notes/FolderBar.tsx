'use client';

/**
 * FolderBar - Folder chips, create popover, unlock modal
 */

import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  Modal,
  PasswordInput,
  Popover,
  ScrollArea,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconFolder, IconFolderPlus, IconLock, IconLockOpen, IconX } from '@tabler/icons-react';
import { useCallback, useState } from 'react';
import type { NoteFolder } from '@/types/notes';

const FOLDER_COLORS = ['red', 'orange', 'yellow', 'teal', 'green', 'cyan', 'blue', 'violet', 'grape', 'pink', 'gray'];

interface FolderBarProps {
  folders: NoteFolder[];
  activeFolderId: number | null;
  onFolderSelect: (id: number | null) => void;
  createFolder: (data: { name: string; color: string; password: string | null }) => Promise<NoteFolder | null>;
  deleteFolder: (id: number) => Promise<boolean | undefined>;
  unlockFolder: (id: number, password: string) => Promise<boolean | undefined>;
  borderColor: string;
}

export function FolderBar({
  folders,
  activeFolderId,
  onFolderSelect,
  createFolder,
  deleteFolder,
  unlockFolder,
  borderColor,
}: FolderBarProps) {
  const [unlockedFolders, setUnlockedFolders] = useState<Set<number>>(new Set());
  const [unlockingFolderId, setUnlockingFolderId] = useState<number | null>(null);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState('blue');
  const [newFolderPassword, setNewFolderPassword] = useState('');

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

  const handleFolderClick = useCallback(
    (folder: NoteFolder) => {
      if (folder.is_locked && !unlockedFolders.has(folder.id)) {
        setUnlockingFolderId(folder.id);
        setUnlockPassword('');
        return;
      }
      onFolderSelect(activeFolderId === folder.id ? null : folder.id);
    },
    [activeFolderId, unlockedFolders, onFolderSelect]
  );

  const handleUnlockFolder = useCallback(async () => {
    if (!unlockingFolderId || !unlockPassword) return;
    const ok = await unlockFolder(unlockingFolderId, unlockPassword);
    if (ok) {
      setUnlockedFolders((prev) => new Set([...prev, unlockingFolderId]));
      onFolderSelect(unlockingFolderId);
      setUnlockingFolderId(null);
      setUnlockPassword('');
    } else {
      notifications.show({ message: 'Yanlis sifre', color: 'red' });
    }
  }, [unlockingFolderId, unlockPassword, unlockFolder, onFolderSelect]);

  return (
    <Box px="lg" py="xs" style={{ borderBottom: `1px solid ${borderColor}` }}>
      <ScrollArea type="never">
        <Group gap={6} wrap="nowrap">
          <Badge
            size="md"
            variant={activeFolderId === null ? 'filled' : 'light'}
            color={activeFolderId === null ? 'blue' : 'gray'}
            style={{ cursor: 'pointer', flexShrink: 0 }}
            onClick={() => onFolderSelect(null)}
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
                rightSection={
                  isActive ? (
                    <ActionIcon
                      size={14}
                      variant="transparent"
                      color="white"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`"${f.name}" klasorunu silmek istediginize emin misiniz?`)) {
                          deleteFolder(f.id);
                          onFolderSelect(null);
                        }
                      }}
                      style={{ marginLeft: -4 }}
                    >
                      <IconX size={10} />
                    </ActionIcon>
                  ) : undefined
                }
                style={{ cursor: 'pointer', flexShrink: 0 }}
                onClick={() => handleFolderClick(f)}
              >
                {f.name}
                {f.note_count > 0 ? ` (${f.note_count})` : ''}
              </Badge>
            );
          })}
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
                <Text size="xs" fw={700}>
                  Yeni Klasor
                </Text>
                <TextInput
                  placeholder="Klasor adi"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.currentTarget.value)}
                  size="xs"
                  radius="md"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                />
                <Group gap={4}>
                  {FOLDER_COLORS.map((c) => (
                    <Box
                      key={c}
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: '50%',
                        cursor: 'pointer',
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
                  size="xs"
                  radius="md"
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
        onClose={() => {
          setUnlockingFolderId(null);
          setUnlockPassword('');
        }}
        title={
          <Group gap="xs">
            <IconLock size={16} />
            <Text size="sm" fw={600}>
              Klasor Sifresi
            </Text>
          </Group>
        }
        size="xs"
        centered
        radius="lg"
      >
        <Stack gap="sm">
          <Text size="xs" c="dimmed">
            Bu klasor sifre ile korunuyor.
          </Text>
          <PasswordInput
            placeholder="Sifre girin"
            value={unlockPassword}
            onChange={(e) => setUnlockPassword(e.currentTarget.value)}
            size="sm"
            radius="md"
            autoFocus
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
  );
}
