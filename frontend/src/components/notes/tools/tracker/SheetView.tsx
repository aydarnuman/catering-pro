'use client';

/**
 * SheetView - Tablo gorunumu
 * Features: inline edit, sort, search, select filter, row copy, tab-new-row,
 *           mini bar chart, aggregate row (sum/avg/min/max), percentage row, AI analyze
 */

import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  Loader,
  Menu,
  Paper,
  Popover,
  ScrollArea,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip,
  useMantineColorScheme,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconArrowDown,
  IconArrowLeft,
  IconArrowUp,
  IconChevronDown,
  IconCopy,
  IconDownload,
  IconEdit,
  IconFilter,
  IconPercentage,
  IconPlus,
  IconSearch,
  IconSparkles,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import { useCallback, useMemo, useState } from 'react';
import { aiAPI } from '@/lib/api/services/ai';
import { EditableCell } from './EditableCell';
import { computeAgg, exportCSV, fmtNum, getColumnMax, mkCol, uid } from './helpers';
import { AI_ANALYZE_PROMPT } from './presets';
import type { AggFunc, ColumnType, TrackerColumn, TrackerRow, TrackerSheet } from './types';
import { AGG_LABELS } from './types';

// ─── Add Column Popover ───
function AddColumnButton({
  onAdd,
}: {
  onAdd: (name: string, type: ColumnType, options?: string[]) => void;
}) {
  const [opened, setOpened] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<ColumnType>('text');
  const [optionsStr, setOptionsStr] = useState('');

  const handleAdd = () => {
    if (!name.trim()) return;
    const opts =
      type === 'select'
        ? optionsStr
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;
    onAdd(name.trim(), type, opts);
    setName('');
    setType('text');
    setOptionsStr('');
    setOpened(false);
  };

  return (
    <Popover opened={opened} onChange={setOpened} position="bottom-end" withArrow>
      <Popover.Target>
        <Tooltip label="Kolon ekle">
          <ActionIcon variant="subtle" size="sm" color="gray" onClick={() => setOpened(true)}>
            <IconPlus size={14} />
          </ActionIcon>
        </Tooltip>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap="xs" style={{ width: 220 }}>
          <Text size="xs" fw={600}>
            Yeni Kolon
          </Text>
          <TextInput
            placeholder="Kolon adi"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            size="xs"
            radius="md"
            onKeyDown={(e) => e.key === 'Enter' && type !== 'select' && handleAdd()}
            autoFocus
          />
          <Select
            data={[
              { value: 'text', label: 'Metin' },
              { value: 'number', label: 'Sayi' },
              { value: 'date', label: 'Tarih' },
              { value: 'select', label: 'Secenekli (dropdown)' },
            ]}
            value={type}
            onChange={(v) => v && setType(v as ColumnType)}
            size="xs"
            radius="md"
          />
          {type === 'select' && (
            <TextInput
              placeholder="Secenekler (virgul ile): Odendi, Odenmedi"
              value={optionsStr}
              onChange={(e) => setOptionsStr(e.currentTarget.value)}
              size="xs"
              radius="md"
            />
          )}
          <Button
            size="xs"
            radius="md"
            onClick={handleAdd}
            disabled={!name.trim() || (type === 'select' && !optionsStr.trim())}
          >
            Ekle
          </Button>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}

// ─── Rename Popover ───
function RenamePopover({
  currentName,
  onRename,
  children,
}: {
  currentName: string;
  onRename: (name: string) => void;
  children: React.ReactNode;
}) {
  const [opened, setOpened] = useState(false);
  const [name, setName] = useState(currentName);
  const handleSave = () => {
    if (name.trim() && name.trim() !== currentName) onRename(name.trim());
    setOpened(false);
  };

  return (
    <Popover opened={opened} onChange={setOpened} position="bottom" withArrow>
      <Popover.Target>
        <Box
          onClick={() => {
            setName(currentName);
            setOpened(true);
          }}
          style={{ cursor: 'pointer' }}
        >
          {children}
        </Box>
      </Popover.Target>
      <Popover.Dropdown>
        <Group gap="xs">
          <TextInput
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            size="xs"
            radius="md"
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            autoFocus
            style={{ width: 160 }}
          />
          <ActionIcon size="sm" color="blue" variant="light" radius="md" onClick={handleSave}>
            <IconEdit size={12} />
          </ActionIcon>
        </Group>
      </Popover.Dropdown>
    </Popover>
  );
}

// ─── Main SheetView ───
interface SheetViewProps {
  sheet: TrackerSheet;
  onUpdate: (updated: TrackerSheet) => void;
  onBack: () => void;
  onDelete: () => void;
}

export function SheetView({ sheet, onUpdate, onBack, onDelete }: SheetViewProps) {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';

  // Local UI state
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectFilter, setSelectFilter] = useState<Record<string, string | null>>({});
  const [showPercentRow, setShowPercentRow] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState('');

  // Helper to update sheet
  const touch = useCallback(
    (partial: Partial<TrackerSheet>) =>
      onUpdate({ ...sheet, ...partial, updatedAt: new Date().toISOString() }),
    [sheet, onUpdate]
  );

  // ─── Cell operations ───
  const updateCell = useCallback(
    (rowId: string, colId: string, value: string | number) => {
      touch({
        rows: sheet.rows.map((r) =>
          r.id === rowId ? { ...r, cells: { ...r.cells, [colId]: value } } : r
        ),
      });
    },
    [sheet, touch]
  );

  const addRow = useCallback(() => {
    if (sheet.rows.length >= 200) return;
    const newRow: TrackerRow = {
      id: uid(),
      cells: Object.fromEntries(sheet.columns.map((c) => [c.id, c.type === 'number' ? 0 : ''])),
    };
    touch({ rows: [...sheet.rows, newRow] });
  }, [sheet, touch]);

  const deleteRow = useCallback(
    (rowId: string) => touch({ rows: sheet.rows.filter((r) => r.id !== rowId) }),
    [sheet, touch]
  );

  const copyRow = useCallback(
    (rowId: string) => {
      if (sheet.rows.length >= 200) return;
      const src = sheet.rows.find((r) => r.id === rowId);
      if (!src) return;
      const idx = sheet.rows.indexOf(src);
      const newRow: TrackerRow = { id: uid(), cells: { ...src.cells } };
      const newRows = [...sheet.rows];
      newRows.splice(idx + 1, 0, newRow);
      touch({ rows: newRows });
    },
    [sheet, touch]
  );

  // ─── Column operations ───
  const addColumn = useCallback(
    (name: string, type: ColumnType, options?: string[]) => {
      if (sheet.columns.length >= 20) return;
      const newCol = mkCol(name, type, options);
      const newRows = sheet.rows.map((r) => ({
        ...r,
        cells: { ...r.cells, [newCol.id]: type === 'number' ? 0 : '' },
      }));
      touch({ columns: [...sheet.columns, newCol], rows: newRows });
    },
    [sheet, touch]
  );

  const deleteColumn = useCallback(
    (colId: string) => {
      if (sheet.columns.length <= 1) return;
      const newRows = sheet.rows.map((r) => {
        const cells = { ...r.cells };
        delete cells[colId];
        return { ...r, cells };
      });
      touch({ columns: sheet.columns.filter((c) => c.id !== colId), rows: newRows });
    },
    [sheet, touch]
  );

  const renameColumn = useCallback(
    (colId: string, newName: string) => {
      touch({ columns: sheet.columns.map((c) => (c.id === colId ? { ...c, name: newName } : c)) });
    },
    [sheet, touch]
  );

  const renameSheet = useCallback((newName: string) => touch({ name: newName }), [touch]);

  const setAggFunc = useCallback(
    (colId: string, fn: AggFunc) => {
      touch({ columns: sheet.columns.map((c) => (c.id === colId ? { ...c, aggFunc: fn } : c)) });
    },
    [sheet, touch]
  );

  const cycleAgg = useCallback(
    (colId: string) => {
      const order: AggFunc[] = ['sum', 'avg', 'min', 'max'];
      const col = sheet.columns.find((c) => c.id === colId);
      if (!col || col.type !== 'number') return;
      const idx = order.indexOf(col.aggFunc || 'sum');
      setAggFunc(colId, order[(idx + 1) % order.length]);
    },
    [sheet, setAggFunc]
  );

  // ─── Sort ───
  const handleSort = useCallback(
    (colId: string) => {
      if (sortCol === colId) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      else {
        setSortCol(colId);
        setSortDir('asc');
      }
    },
    [sortCol]
  );

  // ─── Filter + Search + Sort pipeline ───
  const filteredSortedRows = useMemo(() => {
    let rows = [...sheet.rows];

    // Text search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      rows = rows.filter((r) =>
        sheet.columns.some((c) =>
          String(r.cells[c.id] ?? '')
            .toLowerCase()
            .includes(q)
        )
      );
    }

    // Select column filters
    for (const [colId, filterVal] of Object.entries(selectFilter)) {
      if (filterVal) rows = rows.filter((r) => String(r.cells[colId]) === filterVal);
    }

    // Sort
    if (sortCol) {
      const col = sheet.columns.find((c) => c.id === sortCol);
      if (col) {
        rows.sort((a, b) => {
          const va = a.cells[sortCol] ?? '';
          const vb = b.cells[sortCol] ?? '';
          let cmp = 0;
          if (typeof va === 'number' && typeof vb === 'number') cmp = va - vb;
          else cmp = String(va).localeCompare(String(vb), 'tr');
          return sortDir === 'asc' ? cmp : -cmp;
        });
      }
    }

    return rows;
  }, [sheet, searchQuery, selectFilter, sortCol, sortDir]);

  // Column max values for bar charts
  const colMaxes = useMemo(() => {
    const maxes: Record<string, number> = {};
    for (const c of sheet.columns) {
      if (c.type === 'number') maxes[c.id] = getColumnMax(sheet.rows, c.id);
    }
    return maxes;
  }, [sheet]);

  const hasNumberCols = sheet.columns.some((c) => c.type === 'number');
  const selectColumns = sheet.columns.filter((c) => c.type === 'select' && c.options);
  const hasActiveFilter = searchQuery.trim() || Object.values(selectFilter).some(Boolean);
  const lastRowId =
    filteredSortedRows.length > 0 ? filteredSortedRows[filteredSortedRows.length - 1].id : null;
  const lastColId = sheet.columns.length > 0 ? sheet.columns[sheet.columns.length - 1].id : null;

  // ─── AI Analyze ───
  const handleAiAnalyze = useCallback(async () => {
    if (sheet.rows.length === 0) {
      notifications.show({ message: 'Analiz icin veri yok', color: 'orange' });
      return;
    }
    setAiLoading(true);
    setAiResult('');
    try {
      const colNames = sheet.columns.map((c) => `${c.name} (${c.type})`).join(', ');
      const dataRows = sheet.rows
        .slice(0, 50)
        .map((r) => sheet.columns.map((c) => `${c.name}: ${r.cells[c.id] ?? ''}`).join(' | '))
        .join('\n');

      const prompt = AI_ANALYZE_PROMPT.replace('{NAME}', sheet.name)
        .replace('{COLUMNS}', colNames)
        .replace('{ROW_COUNT}', String(sheet.rows.length))
        .replace('{DATA}', dataRows);

      const response = await aiAPI.sendAgentMessage({
        message: prompt,
        department: 'GENEL',
        systemContext:
          'Kullanici Takip Defteri tablo analizi istiyor. Turkce, kisa ve faydali yanit ver.',
      });

      const text =
        response.data?.response ?? (response as unknown as { response?: string }).response;
      if (text) setAiResult(text);
      else notifications.show({ message: 'AI analiz yapilamadi', color: 'orange' });
    } catch {
      notifications.show({ message: 'AI servisi ile baglanti kurulamadi', color: 'red' });
    } finally {
      setAiLoading(false);
    }
  }, [sheet]);

  return (
    <Stack gap="sm">
      {/* ── Header ── */}
      <Group justify="space-between">
        <Group gap="xs">
          <ActionIcon variant="subtle" size="sm" onClick={onBack} radius="md">
            <IconArrowLeft size={16} />
          </ActionIcon>
          <RenamePopover currentName={sheet.name} onRename={renameSheet}>
            <Tooltip label="Tikla: adi degistir">
              <Badge size="sm" variant="light" color={sheet.color} style={{ cursor: 'pointer' }}>
                {sheet.name}
              </Badge>
            </Tooltip>
          </RenamePopover>
          <Text size="xs" c="dimmed">
            {sheet.rows.length} satir / {sheet.columns.length} kolon
          </Text>
        </Group>
        <Group gap={4}>
          <Tooltip label="AI ile analiz et">
            <ActionIcon
              variant="subtle"
              size="sm"
              color="violet"
              onClick={handleAiAnalyze}
              loading={aiLoading}
              radius="md"
            >
              <IconSparkles size={14} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="CSV indir">
            <ActionIcon
              variant="subtle"
              size="sm"
              color="gray"
              onClick={() => exportCSV(sheet)}
              radius="md"
            >
              <IconDownload size={14} />
            </ActionIcon>
          </Tooltip>
          <Menu position="bottom-end" withArrow>
            <Menu.Target>
              <ActionIcon variant="subtle" size="sm" color="gray">
                <IconChevronDown size={14} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                leftSection={<IconSparkles size={14} />}
                onClick={handleAiAnalyze}
                disabled={aiLoading || sheet.rows.length === 0}
              >
                AI ile analiz et
              </Menu.Item>
              <Menu.Item leftSection={<IconDownload size={14} />} onClick={() => exportCSV(sheet)}>
                CSV olarak indir
              </Menu.Item>
              {hasNumberCols && (
                <Menu.Item
                  leftSection={<IconPercentage size={14} />}
                  onClick={() => setShowPercentRow((p) => !p)}
                >
                  {showPercentRow ? 'Yuzde satirini gizle' : 'Yuzde satirini goster'}
                </Menu.Item>
              )}
              <Menu.Divider />
              <Menu.Item color="red" leftSection={<IconTrash size={14} />} onClick={onDelete}>
                Sayfayi sil
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Group>

      {/* ── AI Result ── */}
      {aiResult && (
        <Paper
          p="sm"
          radius="md"
          style={{
            border: `1px solid ${isDark ? 'rgba(139,92,246,0.2)' : 'rgba(139,92,246,0.15)'}`,
            background: isDark ? 'rgba(139,92,246,0.05)' : 'rgba(139,92,246,0.02)',
          }}
        >
          <Group justify="space-between" mb={4}>
            <Group gap={4}>
              <IconSparkles size={12} color="var(--mantine-color-violet-5)" />
              <Text size="xs" fw={600} c="violet">
                AI Analiz
              </Text>
            </Group>
            <ActionIcon variant="subtle" size="xs" onClick={() => setAiResult('')}>
              <IconX size={12} />
            </ActionIcon>
          </Group>
          <Text size="xs" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
            {aiResult}
          </Text>
        </Paper>
      )}

      {/* ── Search + Filter Bar ── */}
      <Group gap="xs">
        <TextInput
          placeholder="Tabloda ara..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.currentTarget.value)}
          leftSection={<IconSearch size={14} />}
          rightSection={
            searchQuery ? (
              <ActionIcon variant="subtle" size="xs" onClick={() => setSearchQuery('')}>
                <IconX size={12} />
              </ActionIcon>
            ) : null
          }
          size="xs"
          radius="md"
          style={{ flex: 1 }}
        />
        {selectColumns.map((c) => (
          <Select
            key={c.id}
            placeholder={c.name}
            data={[
              { value: '', label: `Tumu (${c.name})` },
              ...(c.options || []).map((o) => ({ value: o, label: o })),
            ]}
            value={selectFilter[c.id] ?? ''}
            onChange={(v) => setSelectFilter((prev) => ({ ...prev, [c.id]: v || null }))}
            size="xs"
            radius="md"
            style={{ width: 130 }}
            leftSection={<IconFilter size={12} />}
            clearable
          />
        ))}
        {hasActiveFilter && (
          <Tooltip label="Filtreleri temizle">
            <ActionIcon
              variant="light"
              size="sm"
              color="gray"
              radius="md"
              onClick={() => {
                setSearchQuery('');
                setSelectFilter({});
              }}
            >
              <IconX size={14} />
            </ActionIcon>
          </Tooltip>
        )}
      </Group>

      {/* ── Table ── */}
      <ScrollArea>
        <Table
          striped
          highlightOnHover
          withTableBorder
          withColumnBorders
          style={{ tableLayout: 'fixed', minWidth: sheet.columns.length * 130 + 80 }}
        >
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ width: 36, textAlign: 'center' }}>
                <Text size="xs" c="dimmed">
                  #
                </Text>
              </Table.Th>
              {sheet.columns.map((c) => (
                <Table.Th key={c.id} style={{ minWidth: 110, padding: '4px 6px' }}>
                  <Group gap={2} justify="space-between" wrap="nowrap">
                    <Group
                      gap={4}
                      wrap="nowrap"
                      style={{ cursor: 'pointer', flex: 1, minWidth: 0 }}
                      onClick={() => handleSort(c.id)}
                    >
                      <RenamePopover currentName={c.name} onRename={(n) => renameColumn(c.id, n)}>
                        <Text size="xs" fw={600} lineClamp={1} style={{ cursor: 'pointer' }}>
                          {c.name}
                        </Text>
                      </RenamePopover>
                      {sortCol === c.id &&
                        (sortDir === 'asc' ? (
                          <IconArrowUp size={10} style={{ flexShrink: 0, opacity: 0.6 }} />
                        ) : (
                          <IconArrowDown size={10} style={{ flexShrink: 0, opacity: 0.6 }} />
                        ))}
                    </Group>
                    <Menu position="bottom-end" withArrow>
                      <Menu.Target>
                        <ActionIcon
                          variant="subtle"
                          size="xs"
                          color="gray"
                          style={{ opacity: 0.4, flexShrink: 0 }}
                        >
                          <IconChevronDown size={10} />
                        </ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Label>
                          {c.type === 'number'
                            ? 'Sayi'
                            : c.type === 'date'
                              ? 'Tarih'
                              : c.type === 'select'
                                ? 'Secenekli'
                                : 'Metin'}
                        </Menu.Label>
                        <Menu.Item
                          leftSection={<IconArrowUp size={12} />}
                          onClick={() => {
                            setSortCol(c.id);
                            setSortDir('asc');
                          }}
                        >
                          Artan sirala
                        </Menu.Item>
                        <Menu.Item
                          leftSection={<IconArrowDown size={12} />}
                          onClick={() => {
                            setSortCol(c.id);
                            setSortDir('desc');
                          }}
                        >
                          Azalan sirala
                        </Menu.Item>
                        {c.type === 'number' && (
                          <>
                            <Menu.Divider />
                            <Menu.Label>Hesap fonksiyonu</Menu.Label>
                            {(['sum', 'avg', 'min', 'max'] as AggFunc[]).map((fn) => (
                              <Menu.Item
                                key={fn}
                                onClick={() => setAggFunc(c.id, fn)}
                                style={{ fontWeight: c.aggFunc === fn ? 700 : 400 }}
                              >
                                {AGG_LABELS[fn]}
                              </Menu.Item>
                            ))}
                          </>
                        )}
                        {sheet.columns.length > 1 && (
                          <>
                            <Menu.Divider />
                            <Menu.Item
                              color="red"
                              leftSection={<IconTrash size={12} />}
                              onClick={() => deleteColumn(c.id)}
                            >
                              Kolonu sil
                            </Menu.Item>
                          </>
                        )}
                      </Menu.Dropdown>
                    </Menu>
                  </Group>
                </Table.Th>
              ))}
              <Table.Th style={{ width: 52 }}>
                <AddColumnButton onAdd={addColumn} />
              </Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filteredSortedRows.map((row, rowIdx) => (
              <Table.Tr key={row.id}>
                <Table.Td style={{ textAlign: 'center', padding: '2px 4px' }}>
                  <Text size="xs" c="dimmed">
                    {rowIdx + 1}
                  </Text>
                </Table.Td>
                {sheet.columns.map((c) => (
                  <Table.Td key={c.id} style={{ padding: '1px 2px' }}>
                    <EditableCell
                      value={row.cells[c.id] ?? (c.type === 'number' ? 0 : '')}
                      column={c}
                      onChange={(val) => updateCell(row.id, c.id, val)}
                      columnMax={colMaxes[c.id] || 0}
                      showBar={c.type === 'number'}
                      isLastCell={row.id === lastRowId && c.id === lastColId}
                      onTabAtEnd={addRow}
                    />
                  </Table.Td>
                ))}
                <Table.Td style={{ padding: '2px 4px' }}>
                  <Group gap={2} wrap="nowrap">
                    <ActionIcon
                      variant="subtle"
                      size="xs"
                      color="gray"
                      onClick={() => copyRow(row.id)}
                      style={{ opacity: 0.3 }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.opacity = '0.8';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.opacity = '0.3';
                      }}
                    >
                      <IconCopy size={11} />
                    </ActionIcon>
                    <ActionIcon
                      variant="subtle"
                      size="xs"
                      color="red"
                      onClick={() => deleteRow(row.id)}
                      style={{ opacity: 0.3 }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.opacity = '1';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.opacity = '0.3';
                      }}
                    >
                      <IconX size={11} />
                    </ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}

            {/* ── Aggregate row ── */}
            {hasNumberCols && sheet.rows.length > 0 && (
              <Table.Tr
                style={{
                  borderTop: `2px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                }}
              >
                <Table.Td />
                {sheet.columns.map((c) => (
                  <Table.Td key={c.id} style={{ padding: '4px 6px' }}>
                    {c.type === 'number' ? (
                      <Tooltip label={'Tikla: fonksiyon degistir'}>
                        <Box onClick={() => cycleAgg(c.id)} style={{ cursor: 'pointer' }}>
                          <Text size="9px" c="dimmed" fw={500} mb={1}>
                            {AGG_LABELS[c.aggFunc || 'sum']}
                          </Text>
                          <Text size="xs" fw={700} c="violet">
                            {fmtNum(computeAgg(sheet.rows, c.id, c.aggFunc || 'sum'))}
                          </Text>
                        </Box>
                      </Tooltip>
                    ) : c === sheet.columns[0] ? (
                      <Text size="xs" fw={600} c="dimmed">
                        Hesap
                      </Text>
                    ) : null}
                  </Table.Td>
                ))}
                <Table.Td />
              </Table.Tr>
            )}

            {/* ── Percentage row ── */}
            {showPercentRow && hasNumberCols && sheet.rows.length > 0 && (
              <Table.Tr>
                <Table.Td />
                {sheet.columns.map((c) => {
                  if (c.type !== 'number') {
                    return (
                      <Table.Td key={c.id}>
                        {c === sheet.columns[0] ? (
                          <Text size="9px" c="dimmed">
                            Yuzde
                          </Text>
                        ) : null}
                      </Table.Td>
                    );
                  }
                  const total = computeAgg(sheet.rows, c.id, 'sum');
                  return (
                    <Table.Td key={c.id} style={{ padding: '2px 6px' }}>
                      {filteredSortedRows.slice(0, 10).map((r) => {
                        const v = typeof r.cells[c.id] === 'number' ? (r.cells[c.id] as number) : 0;
                        const pct = total > 0 ? (v / total) * 100 : 0;
                        return (
                          <Text key={r.id} size="9px" c="dimmed" ff="monospace">
                            %{pct.toFixed(1)}
                          </Text>
                        );
                      })}
                      {filteredSortedRows.length > 10 && (
                        <Text size="9px" c="dimmed">
                          ...
                        </Text>
                      )}
                    </Table.Td>
                  );
                })}
                <Table.Td />
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </ScrollArea>

      {/* ── Add row ── */}
      <Button
        variant="subtle"
        size="xs"
        color="gray"
        leftSection={<IconPlus size={14} />}
        onClick={addRow}
        radius="md"
        disabled={sheet.rows.length >= 200}
      >
        Satir ekle
      </Button>
    </Stack>
  );
}
