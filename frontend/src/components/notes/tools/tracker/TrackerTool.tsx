'use client';

/**
 * TrackerTool - Takip Defteri ana component
 * localStorage ile state yonetimi, SheetList / SheetView arasinda routing
 */

import { Box, Group, Stack, Text, useMantineColorScheme } from '@mantine/core';
import { useLocalStorage } from '@mantine/hooks';
import { IconNotebook } from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';
import { uid } from './helpers';
import { SheetList } from './SheetList';
import { SheetView } from './SheetView';
import type { TrackerSheet } from './types';

export function TrackerTool() {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';
  const [sheets, setSheets] = useLocalStorage<TrackerSheet[]>({
    key: 'ws-tracker-sheets',
    defaultValue: [],
  });
  const [activeSheetId, setActiveSheetId] = useState<string | null>(null);

  // Fix corrupted localStorage data (duplicate IDs from old bug) -- runs once on mount
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional one-time migration
  useEffect(() => {
    let raw: TrackerSheet[] | null = null;
    try {
      const stored = localStorage.getItem('ws-tracker-sheets');
      if (stored) raw = JSON.parse(stored) as TrackerSheet[];
    } catch {
      /* ignore */
    }
    if (!raw || !Array.isArray(raw) || raw.length === 0) return;

    const allIds: string[] = [];
    for (const s of raw) {
      allIds.push(s.id);
      for (const c of s.columns) allIds.push(c.id);
      for (const r of s.rows) allIds.push(r.id);
    }
    if (allIds.length === new Set(allIds).size) return;

    const fixed = raw.map((s) => {
      const colIdMap: Record<string, string> = {};
      const newCols = s.columns.map((c) => {
        const newId = uid();
        colIdMap[c.id] = newId;
        return { ...c, id: newId };
      });
      const newRows = s.rows.map((r) => {
        const newCells: Record<string, string | number> = {};
        for (const [oldColId, val] of Object.entries(r.cells))
          newCells[colIdMap[oldColId] ?? oldColId] = val;
        return { ...r, id: uid(), cells: newCells };
      });
      return { ...s, id: uid(), columns: newCols, rows: newRows };
    });
    localStorage.setItem('ws-tracker-sheets', JSON.stringify(fixed));
    setSheets(fixed);
  }, []);

  const activeSheet = sheets.find((s) => s.id === activeSheetId) ?? null;

  const handleCreate = useCallback(
    (sheet: TrackerSheet) => {
      setSheets((prev) => [...prev, sheet]);
      setActiveSheetId(sheet.id);
    },
    [setSheets]
  );

  const handleUpdate = useCallback(
    (updated: TrackerSheet) => {
      setSheets((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    },
    [setSheets]
  );

  const handleDelete = useCallback(
    (id?: string) => {
      const targetId = id ?? activeSheetId;
      if (!targetId) return;
      setSheets((prev) => prev.filter((s) => s.id !== targetId));
      if (targetId === activeSheetId) setActiveSheetId(null);
    },
    [activeSheetId, setSheets]
  );

  return (
    <Stack gap="sm">
      <Group gap="sm">
        <Box
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: isDark
              ? 'linear-gradient(135deg, rgba(139,92,246,0.15) 0%, rgba(139,92,246,0.08) 100%)'
              : 'linear-gradient(135deg, rgba(139,92,246,0.1) 0%, rgba(139,92,246,0.05) 100%)',
            color: 'var(--mantine-color-violet-5)',
          }}
        >
          <IconNotebook size={18} />
        </Box>
        <Box>
          <Text size="lg" fw={700} style={{ letterSpacing: '-0.02em' }}>
            Takip Defteri
          </Text>
          <Text size="xs" c="dimmed">
            Tablolarla her seyi kayit altina alin
          </Text>
        </Box>
      </Group>

      {activeSheet ? (
        <SheetView
          sheet={activeSheet}
          onUpdate={handleUpdate}
          onBack={() => setActiveSheetId(null)}
          onDelete={() => handleDelete()}
        />
      ) : (
        <SheetList
          sheets={sheets}
          onCreate={handleCreate}
          onSelect={setActiveSheetId}
          onDeleteSheet={handleDelete}
          onUpdateSheet={handleUpdate}
        />
      )}
    </Stack>
  );
}
