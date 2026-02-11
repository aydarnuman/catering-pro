'use client';

/**
 * SheetList - Sayfa listesi, preset kartlari, AI olusturucu, CSV import, sayfa kopyalama/renk
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
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  Tooltip,
  useMantineColorScheme,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconCheck,
  IconCopy,
  IconDotsVertical,
  IconFilePlus,
  IconFileUpload,
  IconSparkles,
  IconTrash,
} from '@tabler/icons-react';
import { useCallback, useRef, useState } from 'react';
import { aiAPI } from '@/lib/api/services/ai';
import { importCSV, mkCol, uid } from './helpers';
import { AI_ENHANCE_PROMPT, AI_PROMPT_TEMPLATE, PRESETS, type PresetDef } from './presets';
import type { ColumnType, TrackerSheet } from './types';
import { SHEET_COLORS } from './types';

interface SheetListProps {
  sheets: TrackerSheet[];
  onCreate: (sheet: TrackerSheet) => void;
  onSelect: (id: string) => void;
  onDeleteSheet: (id: string) => void;
  onUpdateSheet: (updated: TrackerSheet) => void;
}

export function SheetList({
  sheets,
  onCreate,
  onSelect,
  onDeleteSheet,
  onUpdateSheet,
}: SheetListProps) {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';
  const csvInputRef = useRef<HTMLInputElement>(null);

  // ─── Create from preset ───
  const createFromPreset = useCallback(
    (preset: PresetDef) => {
      onCreate({
        id: uid(),
        name: preset.name,
        color: preset.color,
        columns: preset.columnDefs.map((d) => mkCol(d.name, d.type, d.options)),
        rows: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    },
    [onCreate]
  );

  // ─── Create blank ───
  const createBlank = useCallback(() => {
    onCreate({
      id: uid(),
      name: 'Yeni Sayfa',
      color: 'gray',
      columns: [mkCol('Baslik'), mkCol('Deger', 'number'), mkCol('Not')],
      rows: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }, [onCreate]);

  // ─── Copy sheet ───
  const copySheet = useCallback(
    (sheetId: string, withData: boolean) => {
      const src = sheets.find((s) => s.id === sheetId);
      if (!src) return;
      // Build column ID mapping
      const colIdMap: Record<string, string> = {};
      const newCols = src.columns.map((c) => {
        const newId = uid();
        colIdMap[c.id] = newId;
        return { ...c, id: newId };
      });
      const newRows = withData
        ? src.rows.map((r) => {
            const newCells: Record<string, string | number> = {};
            for (const [oldId, val] of Object.entries(r.cells)) {
              newCells[colIdMap[oldId] ?? oldId] = val;
            }
            return { id: uid(), cells: newCells };
          })
        : [];
      onCreate({
        id: uid(),
        name: `${src.name} (kopya)`,
        color: src.color,
        columns: newCols,
        rows: newRows,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      notifications.show({ message: `"${src.name}" kopyalandi`, color: 'green' });
    },
    [sheets, onCreate]
  );

  // ─── Change sheet color ───
  const changeColor = useCallback(
    (sheetId: string, color: string) => {
      const src = sheets.find((s) => s.id === sheetId);
      if (!src) return;
      onUpdateSheet({ ...src, color, updatedAt: new Date().toISOString() });
    },
    [sheets, onUpdateSheet]
  );

  // ─── CSV import ───
  const handleCSVImport = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const text = ev.target?.result as string;
          const { columns, rows } = importCSV(text);
          if (columns.length === 0) {
            notifications.show({ message: 'CSV dosyasi bos veya okunamadi', color: 'orange' });
            return;
          }
          onCreate({
            id: uid(),
            name: file.name.replace(/\.csv$/i, ''),
            color: 'blue',
            columns,
            rows,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          notifications.show({ message: `${rows.length} satir import edildi`, color: 'green' });
        } catch {
          notifications.show({ message: 'CSV parse hatasi', color: 'red' });
        }
      };
      reader.readAsText(file, 'utf-8');
      // Reset input so same file can be re-imported
      e.target.value = '';
    },
    [onCreate]
  );

  return (
    <Stack gap="md">
      {/* ── Presets ── */}
      <Stack gap="xs">
        <Text size="xs" fw={600} c="dimmed" tt="uppercase" style={{ letterSpacing: '0.05em' }}>
          Hizli Olustur
        </Text>
        <SimpleGrid cols={3} spacing="xs">
          {PRESETS.map((p) => (
            <Paper
              key={p.name}
              p="sm"
              radius="md"
              className="ws-template-card"
              style={{
                cursor: 'pointer',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                textAlign: 'center',
              }}
              onClick={() => createFromPreset(p)}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = `var(--mantine-color-${p.color}-${isDark ? '6' : '3'})`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = isDark
                  ? 'rgba(255,255,255,0.06)'
                  : 'rgba(0,0,0,0.06)';
              }}
            >
              <Stack gap={6} align="center">
                <Box
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: `var(--mantine-color-${p.color}-${isDark ? '9' : '0'})`,
                    color: `var(--mantine-color-${p.color}-${isDark ? '4' : '6'})`,
                  }}
                >
                  {p.icon}
                </Box>
                <Text size="xs" fw={600}>
                  {p.name}
                </Text>
                <Text size="10px" c="dimmed" lineClamp={1}>
                  {p.description}
                </Text>
              </Stack>
            </Paper>
          ))}
        </SimpleGrid>
      </Stack>

      {/* ── Existing sheets ── */}
      {sheets.length > 0 && (
        <Stack gap="xs">
          <Group justify="space-between">
            <Text size="xs" fw={600} c="dimmed" tt="uppercase" style={{ letterSpacing: '0.05em' }}>
              Sayfalarim ({sheets.length})
            </Text>
            {sheets.length > 1 && (
              <Button
                variant="subtle"
                color="red"
                size="xs"
                leftSection={<IconTrash size={12} />}
                onClick={() => {
                  if (
                    window.confirm(
                      `${sheets.length} sayfanin tumunu silmek istediginize emin misiniz?`
                    )
                  ) {
                    for (const s of sheets) onDeleteSheet(s.id);
                  }
                }}
                styles={{ root: { padding: '2px 8px', height: 24 } }}
              >
                Tumunu sil
              </Button>
            )}
          </Group>
          <Stack gap={4}>
            {sheets.map((s) => (
              <Paper
                key={s.id}
                p="xs"
                px="sm"
                radius="md"
                className="ws-note-card"
                style={{
                  cursor: 'pointer',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                }}
                onClick={() => onSelect(s.id)}
              >
                <Group justify="space-between" wrap="nowrap">
                  <Group gap="xs" style={{ minWidth: 0 }}>
                    <Box
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: `var(--mantine-color-${s.color}-5)`,
                        flexShrink: 0,
                      }}
                    />
                    <Text size="sm" fw={600} lineClamp={1}>
                      {s.name}
                    </Text>
                  </Group>
                  <Group gap={6} wrap="nowrap" style={{ flexShrink: 0 }}>
                    <Text size="xs" c="dimmed">
                      {s.rows.length} satir
                    </Text>
                    {/* Sheet actions menu */}
                    <Menu position="bottom-end" withArrow>
                      <Menu.Target>
                        <ActionIcon
                          variant="subtle"
                          size="xs"
                          color="gray"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <IconDotsVertical size={12} />
                        </ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown onClick={(e) => e.stopPropagation()}>
                        <Menu.Item
                          leftSection={<IconCopy size={12} />}
                          onClick={() => copySheet(s.id, true)}
                        >
                          Kopyala (veri ile)
                        </Menu.Item>
                        <Menu.Item
                          leftSection={<IconCopy size={12} />}
                          onClick={() => copySheet(s.id, false)}
                        >
                          Yapiyi kopyala (bos)
                        </Menu.Item>
                        <Menu.Divider />
                        <Menu.Label>Renk</Menu.Label>
                        <Box px="xs" pb="xs">
                          <Group gap={4}>
                            {SHEET_COLORS.map((color) => (
                              <Tooltip key={color} label={color}>
                                <Box
                                  style={{
                                    width: 16,
                                    height: 16,
                                    borderRadius: '50%',
                                    cursor: 'pointer',
                                    background: `var(--mantine-color-${color}-5)`,
                                    border:
                                      s.color === color
                                        ? '2px solid white'
                                        : '2px solid transparent',
                                    boxShadow:
                                      s.color === color
                                        ? `0 0 4px var(--mantine-color-${color}-5)`
                                        : 'none',
                                  }}
                                  onClick={() => changeColor(s.id, color)}
                                />
                              </Tooltip>
                            ))}
                          </Group>
                        </Box>
                        <Menu.Divider />
                        <Menu.Item
                          color="red"
                          leftSection={<IconTrash size={12} />}
                          onClick={() => onDeleteSheet(s.id)}
                        >
                          Sil
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  </Group>
                </Group>
              </Paper>
            ))}
          </Stack>
        </Stack>
      )}

      {/* ── Action buttons ── */}
      <Group gap="xs">
        <Button
          variant="light"
          color="gray"
          size="sm"
          radius="md"
          leftSection={<IconFilePlus size={16} />}
          onClick={createBlank}
          style={{ flex: 1 }}
        >
          Bos sayfa
        </Button>
        <Button
          variant="light"
          color="gray"
          size="sm"
          radius="md"
          leftSection={<IconFileUpload size={16} />}
          onClick={() => csvInputRef.current?.click()}
          style={{ flex: 1 }}
        >
          CSV yukle
        </Button>
        <input
          ref={csvInputRef}
          type="file"
          accept=".csv,.txt"
          style={{ display: 'none' }}
          onChange={handleCSVImport}
        />
      </Group>

      {/* ── AI ile olustur ── */}
      <AISheetCreator onCreate={onCreate} isDark={isDark} />
    </Stack>
  );
}

// ─── AI oneri chip'leri ───
const AI_SUGGESTIONS = [
  {
    icon: '💰',
    label: 'Aylik butce takibi',
    prompt: 'Aylik butce ve harcama takip tablosu, kategori bazli',
  },
  {
    icon: '🛒',
    label: 'Alisveris listesi',
    prompt: 'Haftalik market alisveris listesi, urun, miktar, birim fiyat, toplam',
  },
  {
    icon: '📅',
    label: 'Gorev takibi',
    prompt: 'Proje gorev takibi: gorev, sorumlu, bitis tarihi, durum, oncelik',
  },
  {
    icon: '🍽️',
    label: 'Menu plani',
    prompt: 'Haftalik yemek menusu plani, gun, ogün, yemek, porsiyon, maliyet',
  },
  {
    icon: '📦',
    label: 'Stok sayimi',
    prompt: 'Depo stok sayim tablosu: urun, mevcut, sayilan, fark, birim',
  },
  {
    icon: '👥',
    label: 'Personel listesi',
    prompt: 'Personel takip tablosu: ad, pozisyon, baslama tarihi, maas, durum',
  },
  {
    icon: '🧾',
    label: 'Fatura takibi',
    prompt: 'Fatura odeme takibi: firma, tutar, vade, odeme durumu',
  },
  {
    icon: '📊',
    label: 'Satis raporu',
    prompt: 'Gunluk satis raporu: tarih, musteri, urun, adet, tutar',
  },
];

// ─── AI Sheet Creator (v0-tarzi enhance ikonu) ───
function AISheetCreator({
  onCreate,
  isDark,
}: {
  onCreate: (sheet: TrackerSheet) => void;
  isDark: boolean;
}) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [enhanced, setEnhanced] = useState(false);

  // v0-tarzi: Ikon tiklaninca prompt'u zenginlestir, input'a geri yaz
  const handleEnhance = useCallback(async () => {
    if (!prompt.trim() || enhancing) return;
    setEnhancing(true);
    try {
      const res = await aiAPI.sendAgentMessage({
        message: AI_ENHANCE_PROMPT.replace('{INPUT}', prompt.trim()),
        department: 'GENEL',
        systemContext: 'Tek satirlik temiz Turkce tablo talebi uret. Baska bir sey yazma.',
      });
      const result = res.data?.response ?? (res as unknown as { response?: string }).response;
      if (result) {
        setPrompt(result.trim().replace(/^["']|["']$/g, ''));
        setEnhanced(true);
      }
    } catch {
      notifications.show({
        message: 'Prompt zenginlestirilemedi',
        color: 'orange',
      });
    } finally {
      setEnhancing(false);
    }
  }, [prompt, enhancing]);

  // Tablo olustur (zenginlestirilmis veya ham prompt ile)
  const handleCreate = useCallback(async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    try {
      const response = await aiAPI.sendAgentMessage({
        message: AI_PROMPT_TEMPLATE.replace('{INPUT}', prompt.trim()),
        department: 'GENEL',
        systemContext:
          'Kullanici Takip Defteri tablo olusturma araci kullaniyor. Sadece istenen JSON formatinda yanit ver.',
      });

      const aiText =
        response.data?.response ?? (response as unknown as { response?: string }).response;
      if (!aiText) {
        notifications.show({ message: 'AI yanit veremedi', color: 'red' });
        return;
      }

      let jsonStr = aiText.trim();
      if (jsonStr.startsWith('```'))
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');

      const parsed = JSON.parse(jsonStr) as {
        name?: string;
        color?: string;
        columns?: Array<{
          name: string;
          type: string;
          options?: string[];
        }>;
      };
      if (!parsed.columns || !Array.isArray(parsed.columns) || parsed.columns.length === 0) {
        notifications.show({
          message: 'AI gecerli tablo yapisi olusturamadi',
          color: 'orange',
        });
        return;
      }

      const validTypes: ColumnType[] = ['text', 'number', 'date', 'select'];
      const sheet: TrackerSheet = {
        id: uid(),
        name: parsed.name || 'AI Tablo',
        color: parsed.color || 'blue',
        columns: parsed.columns.slice(0, 20).map((c) => {
          const type = validTypes.includes(c.type as ColumnType) ? (c.type as ColumnType) : 'text';
          return mkCol(c.name, type, type === 'select' ? c.options : undefined);
        }),
        rows: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      onCreate(sheet);
      setPrompt('');
      setEnhanced(false);
      notifications.show({
        message: `"${sheet.name}" olusturuldu`,
        color: 'green',
      });
    } catch {
      notifications.show({
        message: 'AI ile tablo olusturulamadi',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  }, [prompt, onCreate]);

  const busy = loading || enhancing;

  return (
    <Paper
      p="sm"
      radius="md"
      style={{
        border: `1px solid ${isDark ? 'rgba(139,92,246,0.15)' : 'rgba(139,92,246,0.1)'}`,
        background: isDark ? 'rgba(139,92,246,0.04)' : 'rgba(139,92,246,0.02)',
      }}
    >
      <Stack gap="xs">
        <Group gap={6}>
          <IconSparkles size={14} color="var(--mantine-color-violet-5)" />
          <Text size="xs" fw={600} c="violet">
            AI ile Olustur
          </Text>
        </Group>

        {/* Oneri chip'leri */}
        <Box style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {AI_SUGGESTIONS.map((s) => (
            <Badge
              key={s.label}
              size="sm"
              variant="light"
              color="violet"
              radius="xl"
              style={{
                cursor: busy ? 'default' : 'pointer',
                transition: 'all 0.15s ease',
                fontWeight: prompt === s.prompt ? 600 : 400,
                opacity: busy ? 0.5 : prompt === s.prompt ? 1 : 0.8,
              }}
              onClick={() => {
                if (!busy) {
                  setPrompt(s.prompt);
                  setEnhanced(false);
                }
              }}
            >
              {s.icon} {s.label}
            </Badge>
          ))}
        </Box>

        {/* Input + Enhance ikonu (v0 tarzi) */}
        <Box style={{ position: 'relative' }}>
          <Textarea
            placeholder="Ne tur tablo istediginizi yazin... Sonra ✨ ile iyilestirin"
            value={prompt}
            onChange={(e) => {
              setPrompt(e.currentTarget.value);
              setEnhanced(false);
            }}
            minRows={2}
            maxRows={4}
            autosize
            size="xs"
            radius="md"
            disabled={busy}
            styles={{
              input: {
                paddingRight: 40,
                borderColor: enhanced ? 'var(--mantine-color-violet-4)' : undefined,
                boxShadow: enhanced
                  ? `0 0 0 1px var(--mantine-color-violet-4), 0 0 8px ${isDark ? 'rgba(139,92,246,0.2)' : 'rgba(139,92,246,0.1)'}`
                  : undefined,
              },
            }}
          />
          {/* Enhance ikonu - input'un sag ust kosesinde */}
          {prompt.trim() && !loading && (
            <Tooltip
              label={
                enhancing
                  ? 'Zenginlestiriliyor...'
                  : enhanced
                    ? 'Zenginlestirildi!'
                    : "Prompt'u iyilestir"
              }
              withArrow
              position="left"
            >
              <ActionIcon
                size={28}
                radius="md"
                variant={enhanced ? 'filled' : 'light'}
                color={enhanced ? 'green' : 'violet'}
                loading={enhancing}
                onClick={handleEnhance}
                disabled={enhancing}
                style={{
                  position: 'absolute',
                  top: 6,
                  right: 6,
                  zIndex: 1,
                  transition: 'all 0.2s ease',
                  boxShadow: enhanced
                    ? '0 0 8px rgba(34,197,94,0.3)'
                    : enhancing
                      ? 'none'
                      : '0 0 6px rgba(139,92,246,0.2)',
                }}
              >
                {enhanced ? <IconCheck size={14} /> : <IconSparkles size={14} />}
              </ActionIcon>
            </Tooltip>
          )}
        </Box>

        {/* Enhanced badge */}
        {enhanced && (
          <Text size="10px" c="green" fw={500} style={{ marginTop: -4 }}>
            Prompt zenginlestirildi - duzenleyebilir veya direkt olusturabilirsiniz
          </Text>
        )}

        <Button
          size="xs"
          radius="md"
          color="violet"
          leftSection={loading ? <Loader size={12} color="white" /> : <IconSparkles size={14} />}
          onClick={handleCreate}
          disabled={!prompt.trim() || busy}
        >
          {loading ? 'Tablo olusturuluyor...' : 'Olustur'}
        </Button>
      </Stack>
    </Paper>
  );
}
