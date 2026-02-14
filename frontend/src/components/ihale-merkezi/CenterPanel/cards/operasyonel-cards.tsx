'use client';

import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  NumberInput,
  Paper,
  ScrollArea,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import {
  IconBuilding,
  IconCalendar,
  IconChevronDown,
  IconChevronUp,
  IconClock,
  IconMapPin,
  IconPlus,
  IconScale,
  IconToolsKitchen2,
  IconTrash,
  IconUsers,
} from '@tabler/icons-react';
import { useState } from 'react';

import type { GramajGrubu, OgunBilgisi, PersonelDetay, ServisSaatleri } from '../../types';
import { AnalysisDetailModal } from './AnalysisDetailModal';
import { isRealPersonelPosition } from './card-utils';
import { ExpandableCardShell, useExpandableItems } from './ExpandableCardShell';
import { useCardEditState } from './useCardEditState';

// ═══════════════════════════════════════════════════════════════
// Paylaşılan edit props arayüzü
// ═══════════════════════════════════════════════════════════════

interface EditableCardProps {
  isEditing?: boolean;
  onToggleEdit?: () => void;
  onSave?: (fieldPath: string, oldValue: unknown, newValue: unknown) => void;
  onDelete?: () => void;
  isCorrected?: boolean;
  showCheckbox?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  tenderId?: number;
}

// Tarih formatla (ISO -> TR format)
function formatDisplayDate(value: string): string {
  if (!value) return '-';
  // ISO format: 2024-01-15 veya 2024-01-15T10:30:00
  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${day}.${month}.${year}`;
  }
  return value;
}

// ═══════════════════════════════════════════════════════════════
// 1. TakvimCard
// ═══════════════════════════════════════════════════════════════

export function TakvimCard({
  takvim,
  showCheckbox,
  isSelected,
  onToggleSelect,
  tenderId,
  onSave,
}: {
  takvim: Array<{ olay: string; tarih: string; gun?: string }>;
} & Pick<EditableCardProps, 'showCheckbox' | 'isSelected' | 'onToggleSelect' | 'tenderId' | 'onSave'>) {
  const [detailOpen, setDetailOpen] = useState(false);
  const { displayItems } = useExpandableItems(takvim, 6);

  return (
    <>
      <ExpandableCardShell
        title="Takvim"
        icon={<IconCalendar size={12} />}
        color="cyan"
        badge={takvim.length}
        expandable
        totalCount={takvim.length}
        initialShowCount={6}
        maxExpandedHeight={400}
        onOpenDetail={() => setDetailOpen(true)}
        showCheckbox={showCheckbox}
        isSelected={isSelected}
        onToggleSelect={onToggleSelect}
      >
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
          {displayItems.map((item, idx) => (
            <Group key={`takvim-${item.olay}-${idx}`} gap="xs" wrap="nowrap">
              <ThemeIcon size="xs" variant="light" color="cyan" radius="xl">
                <IconClock size={10} />
              </ThemeIcon>
              <Box style={{ flex: 1, minWidth: 0 }}>
                <Text size="xs" fw={500} lineClamp={1}>
                  {item.olay}
                </Text>
                <Group gap={4}>
                  <Text size="xs" c="dimmed">
                    {formatDisplayDate(item.tarih)}
                  </Text>
                  {item.gun && (
                    <Badge size="xs" variant="outline" color="cyan">
                      {item.gun} gün
                    </Badge>
                  )}
                </Group>
              </Box>
            </Group>
          ))}
        </SimpleGrid>
      </ExpandableCardShell>

      <AnalysisDetailModal
        opened={detailOpen}
        onClose={() => setDetailOpen(false)}
        cardType="takvim"
        title="Takvim"
        icon={<IconCalendar size={16} />}
        color="cyan"
        data={takvim}
        tenderId={tenderId}
        onSave={onSave}
      />
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// 2. ServisSaatleriCard
// ═══════════════════════════════════════════════════════════════

export function ServisSaatleriCard({
  saatler,
  isEditing,
  onToggleEdit,
  onSave,
  onDelete,
  isCorrected,
  showCheckbox,
  isSelected,
  onToggleSelect,
  tenderId,
}: { saatler: ServisSaatleri } & EditableCardProps) {
  const [detailOpen, setDetailOpen] = useState(false);

  const { editData, setEditData, handleSave } = useCardEditState<Record<string, string>>({
    originalData: { ...saatler } as Record<string, string>,
    isEditing: !!isEditing,
    fieldPath: 'servis_saatleri',
    onSave,
    onToggleEdit,
  });

  const entries = Object.entries(saatler).filter(([, v]) => v?.trim());
  if (entries.length === 0 && !isEditing) return null;

  const labels: Record<string, string> = {
    kahvalti: 'Kahvaltı',
    ogle: 'Öğle',
    aksam: 'Akşam',
  };

  return (
    <>
      <ExpandableCardShell
        title="Servis Saatleri"
        icon={<IconClock size={12} />}
        color="cyan"
        isEditing={isEditing}
        onToggleEdit={onToggleEdit}
        onSave={isEditing ? handleSave : undefined}
        onDelete={onDelete}
        isCorrected={isCorrected}
        onOpenDetail={() => setDetailOpen(true)}
        showCheckbox={showCheckbox}
        isSelected={isSelected}
        onToggleSelect={onToggleSelect}
      >
        {isEditing ? (
          <Stack gap="xs">
            {['kahvalti', 'ogle', 'aksam'].map((key) => (
              <Group key={key} gap="xs">
                <Text size="xs" w={70} c="dimmed">
                  {labels[key] || key}:
                </Text>
                <TextInput
                  size="xs"
                  value={editData[key] || ''}
                  placeholder="ör: 07:00 - 09:00"
                  onChange={(e) => setEditData({ ...editData, [key]: e.target.value })}
                  style={{ flex: 1 }}
                />
              </Group>
            ))}
          </Stack>
        ) : (
          <Stack gap={4}>
            {entries.map(([key, value]) => {
              const isLong = (value || '').length > 30;
              return isLong ? (
                <Group key={key} gap="xs" wrap="nowrap">
                  <ThemeIcon size="xs" variant="light" color="cyan" radius="xl" style={{ flexShrink: 0 }}>
                    <IconClock size={10} />
                  </ThemeIcon>
                  <Text size="xs" fw={500} style={{ minWidth: 55 }}>
                    {labels[key] || key}:
                  </Text>
                  <Text size="xs" c="dimmed" lineClamp={2} style={{ flex: 1 }}>
                    {value}
                  </Text>
                </Group>
              ) : (
                <Badge key={key} size="lg" variant="light" color="cyan" leftSection={<IconClock size={12} />}>
                  {labels[key] || key}: {value}
                </Badge>
              );
            })}
          </Stack>
        )}
      </ExpandableCardShell>

      <AnalysisDetailModal
        opened={detailOpen}
        onClose={() => setDetailOpen(false)}
        cardType="servis_saatleri"
        title="Servis Saatleri"
        icon={<IconClock size={16} />}
        color="cyan"
        data={saatler}
        onSave={onSave}
        isCorrected={isCorrected}
        tenderId={tenderId}
      />
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// 3. PersonelCard
// ═══════════════════════════════════════════════════════════════

export function PersonelCard({
  personel,
  isEditing,
  onToggleEdit,
  onSave,
  onDelete,
  isCorrected,
  showCheckbox,
  isSelected,
  onToggleSelect,
  tenderId,
}: { personel: PersonelDetay[] } & EditableCardProps) {
  const [detailOpen, setDetailOpen] = useState(false);

  const realPersonel = personel.filter((p) => isRealPersonelPosition(p.pozisyon));

  type EditItem = { pozisyon: string; adet: string; ucret_orani: string };

  const { editData, setEditData, handleSave } = useCardEditState<EditItem[]>({
    originalData: personel.map((p) => ({
      pozisyon: p.pozisyon,
      adet: String(p.adet || 0),
      ucret_orani: p.ucret_orani || '',
    })),
    isEditing: !!isEditing,
    fieldPath: 'personel_detaylari',
    onSave,
    onToggleEdit,
    transform: (items) =>
      items
        .filter((p) => p.pozisyon.trim())
        .map((p) => ({
          pozisyon: p.pozisyon,
          adet: String(Number(p.adet) || 0),
          ucret_orani: p.ucret_orani || '',
        })),
  });

  const { displayItems } = useExpandableItems(realPersonel, 5, isEditing);

  if (!personel || personel.length === 0) return null;
  if (realPersonel.length === 0) return null;

  const toplamPersonel = realPersonel.reduce((sum, p) => sum + (Number(p.adet) || 0), 0);

  return (
    <>
      <ExpandableCardShell
        title="Personel Detayları"
        icon={<IconUsers size={12} />}
        color="indigo"
        badge={`${toplamPersonel} kişi`}
        expandable
        totalCount={realPersonel.length}
        initialShowCount={5}
        maxExpandedHeight={300}
        isEditing={isEditing}
        onToggleEdit={onToggleEdit}
        onSave={isEditing ? handleSave : undefined}
        onDelete={onDelete}
        isCorrected={isCorrected}
        onOpenDetail={() => setDetailOpen(true)}
        showCheckbox={showCheckbox}
        isSelected={isSelected}
        onToggleSelect={onToggleSelect}
      >
        {isEditing ? (
          <Stack gap={4}>
            {editData.map((p, idx) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: Edit mode için geçici key
              <Group key={`personel-edit-${idx}`} gap="xs" wrap="nowrap">
                <TextInput
                  size="xs"
                  value={p.pozisyon}
                  placeholder="Pozisyon"
                  onChange={(e) => {
                    const updated = [...editData];
                    updated[idx] = { ...updated[idx], pozisyon: e.target.value };
                    setEditData(updated);
                  }}
                  style={{ flex: 1 }}
                />
                <NumberInput
                  size="xs"
                  value={Number(p.adet) || 0}
                  min={0}
                  onChange={(val) => {
                    const updated = [...editData];
                    updated[idx] = { ...updated[idx], adet: String(val) };
                    setEditData(updated);
                  }}
                  w={70}
                  suffix=" kişi"
                />
                <TextInput
                  size="xs"
                  value={p.ucret_orani}
                  placeholder="Ücret oranı"
                  onChange={(e) => {
                    const updated = [...editData];
                    updated[idx] = { ...updated[idx], ucret_orani: e.target.value };
                    setEditData(updated);
                  }}
                  w={90}
                />
                <ActionIcon
                  size="xs"
                  variant="subtle"
                  color="red"
                  onClick={() => setEditData(editData.filter((_, i) => i !== idx))}
                >
                  <IconTrash size={10} />
                </ActionIcon>
              </Group>
            ))}
            <Button
              size="compact-xs"
              variant="light"
              color="indigo"
              mt="xs"
              leftSection={<IconPlus size={12} />}
              onClick={() => setEditData([...editData, { pozisyon: '', adet: '1', ucret_orani: '' }])}
            >
              Yeni Pozisyon Ekle
            </Button>
          </Stack>
        ) : (
          <Stack gap={4}>
            {displayItems.map((p) => (
              <Group key={`personel-${p.pozisyon}-${p.adet}`} justify="space-between" gap="xs" wrap="nowrap">
                <Text size="xs" style={{ flex: 1, minWidth: 0 }} lineClamp={1}>
                  {p.pozisyon}
                </Text>
                <Group gap={4} wrap="nowrap">
                  <Badge size="xs" variant="outline" color="indigo">
                    {p.adet} kişi
                  </Badge>
                  {p.ucret_orani && (
                    <Tooltip label={p.ucret_orani} disabled={p.ucret_orani.length <= 20}>
                      <Badge size="xs" variant="light" color="green" style={{ maxWidth: 100 }}>
                        <Text size="xs" truncate>
                          {p.ucret_orani
                            .replace(/Brüt Asgari Ücretin\s*/gi, '')
                            .replace(/Fazlası/gi, '')
                            .trim()}
                        </Text>
                      </Badge>
                    </Tooltip>
                  )}
                  {p.sure && (
                    <Badge size="xs" variant="light" color="gray">
                      {p.sure}
                    </Badge>
                  )}
                </Group>
              </Group>
            ))}
          </Stack>
        )}
      </ExpandableCardShell>

      <AnalysisDetailModal
        opened={detailOpen}
        onClose={() => setDetailOpen(false)}
        cardType="personel_detaylari"
        title="Personel Detayları"
        icon={<IconUsers size={16} />}
        color="indigo"
        data={personel}
        onSave={onSave}
        isCorrected={isCorrected}
        tenderId={tenderId}
      />
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// 4. OgunBilgileriCard
// ═══════════════════════════════════════════════════════════════

type OgunEditItem = { tur: string; miktar: string; birim: string };

export function OgunBilgileriCard({
  ogunler,
  toplamOgunSayisi,
  isEditing,
  onToggleEdit,
  onSave,
  onDelete,
  isCorrected,
  showCheckbox,
  isSelected,
  onToggleSelect,
  tenderId,
}: { ogunler: OgunBilgisi[]; toplamOgunSayisi?: number } & EditableCardProps) {
  const [detailOpen, setDetailOpen] = useState(false);

  const safeOgunler = ogunler || [];
  const tabloOgunler = safeOgunler.filter((o) => o.rows && o.headers);
  const flatOgunler = safeOgunler.filter((o) => o.tur);

  const { editData, setEditData, handleSave } = useCardEditState<OgunEditItem[]>({
    originalData: flatOgunler.map((o) => ({
      tur: o.tur || '',
      miktar: String(o.miktar || 0),
      birim: o.birim || 'adet',
    })),
    isEditing: !!isEditing,
    fieldPath: 'ogun_bilgileri',
    onSave,
    onToggleEdit,
    transform: (items) =>
      items
        .filter((o) => o.tur.trim())
        .map((o) => ({
          tur: o.tur,
          miktar: String(Number(o.miktar) || 0),
          birim: o.birim || 'adet',
        })),
  });

  if (safeOgunler.length === 0) return null;

  const toplamOgun = toplamOgunSayisi || flatOgunler.reduce((sum, o) => sum + (Number(o.miktar) || 0), 0);
  const badgeText = toplamOgun > 0 ? `${toplamOgun.toLocaleString('tr-TR')} öğün` : `${ogunler.length} tablo`;

  const showExpandButton = tabloOgunler.length > 0 || flatOgunler.length > 6;

  return (
    <>
      <ExpandableCardShell
        title="Öğün Bilgileri"
        icon={<IconToolsKitchen2 size={12} />}
        color="orange"
        badge={badgeText}
        expandable={showExpandButton}
        totalCount={flatOgunler.length}
        initialShowCount={6}
        maxExpandedHeight={400}
        isEditing={isEditing}
        onToggleEdit={onToggleEdit}
        onSave={isEditing ? handleSave : undefined}
        onDelete={onDelete}
        isCorrected={isCorrected}
        onOpenDetail={() => setDetailOpen(true)}
        showCheckbox={showCheckbox}
        isSelected={isSelected}
        onToggleSelect={onToggleSelect}
      >
        {/* Tablo formatı - Azure'dan gelen öğün dağılım tabloları */}
        {tabloOgunler.length > 0 && !isEditing && (
          <Stack gap="xs">
            {tabloOgunler.map((tablo, tIdx) => {
              const headers = tablo.headers || [];
              const rows = tablo.rows || [];
              const displayRows = rows.slice(0, 5);
              const hasMoreRows = rows.length > 5;

              return (
                <Box key={`tablo-${tablo.index ?? tIdx}`}>
                  <ScrollArea type="auto">
                    <Table
                      striped
                      highlightOnHover
                      withTableBorder
                      withColumnBorders
                      fz="xs"
                      styles={{
                        th: { padding: '4px 8px', fontSize: '10px', wordBreak: 'keep-all', overflowWrap: 'normal' },
                        td: { padding: '3px 8px', fontSize: '10px' },
                      }}
                    >
                      <Table.Thead>
                        <Table.Tr>
                          {headers.map((h, colIndex) => {
                            const cleanHeader = h.replace(/\n.*$/g, '').trim();
                            const displayHeader =
                              cleanHeader.length > 20 ? `${cleanHeader.substring(0, 18)}..` : cleanHeader;
                            return (
                              <Table.Th
                                key={`th-${tIdx}-${h.slice(0, 20)}-col${colIndex}`}
                                style={
                                  colIndex === 0
                                    ? { minWidth: 140 }
                                    : { textAlign: 'right', minWidth: 75, whiteSpace: 'nowrap' }
                                }
                                title={cleanHeader.length > 20 ? cleanHeader : undefined}
                              >
                                {displayHeader}
                              </Table.Th>
                            );
                          })}
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {displayRows.map((row, rIdx) => {
                          const firstCol = String(row[0] || '').trim();
                          const isToplam = firstCol.toUpperCase() === 'TOPLAM';
                          const rowKey = `tr-${tIdx}-${firstCol || rIdx}`;
                          return (
                            <Table.Tr key={rowKey} fw={isToplam ? 700 : undefined}>
                              {row.map((cell, cIdx) => (
                                <Table.Td
                                  key={`td-${rowKey}-${cIdx}-${String(cell).slice(0, 10)}`}
                                  style={cIdx === 0 ? undefined : { textAlign: 'right' }}
                                  fw={isToplam ? 700 : undefined}
                                >
                                  {String(cell || '')
                                    .replace(/\n:unselected:/g, '')
                                    .replace(/:unselected:/g, '')
                                    .trim()}
                                </Table.Td>
                              ))}
                            </Table.Tr>
                          );
                        })}
                      </Table.Tbody>
                    </Table>
                  </ScrollArea>
                  {hasMoreRows && (
                    <Text size="xs" c="dimmed" ta="center" mt={4}>
                      +{rows.length - 5} satır daha...
                    </Text>
                  )}
                </Box>
              );
            })}
          </Stack>
        )}

        {/* Edit Mode */}
        {isEditing ? (
          <Stack gap="xs">
            {editData.map((item, idx) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: Edit mode için geçici key
              <Group key={`edit-ogun-${idx}`} gap="xs" align="flex-end">
                <TextInput
                  size="xs"
                  placeholder="Öğün türü"
                  value={item.tur}
                  onChange={(e) => {
                    const newItems = [...editData];
                    newItems[idx] = { ...newItems[idx], tur: e.target.value };
                    setEditData(newItems);
                  }}
                  style={{ flex: 2 }}
                />
                <NumberInput
                  size="xs"
                  placeholder="Miktar"
                  value={Number(item.miktar) || 0}
                  onChange={(val) => {
                    const newItems = [...editData];
                    newItems[idx] = { ...newItems[idx], miktar: String(val || 0) };
                    setEditData(newItems);
                  }}
                  min={0}
                  thousandSeparator="."
                  decimalSeparator=","
                  style={{ flex: 1 }}
                />
                <TextInput
                  size="xs"
                  placeholder="Birim"
                  value={item.birim}
                  onChange={(e) => {
                    const newItems = [...editData];
                    newItems[idx] = { ...newItems[idx], birim: e.target.value };
                    setEditData(newItems);
                  }}
                  style={{ width: 70 }}
                />
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  color="red"
                  onClick={() => setEditData(editData.filter((_, i) => i !== idx))}
                >
                  <IconTrash size={12} />
                </ActionIcon>
              </Group>
            ))}
            <Button
              size="compact-xs"
              variant="light"
              color="orange"
              leftSection={<IconPlus size={12} />}
              onClick={() => setEditData([...editData, { tur: '', miktar: '0', birim: 'adet' }])}
            >
              Öğün Ekle
            </Button>
          </Stack>
        ) : (
          /* Read Mode - flat öğünler */
          flatOgunler.length > 0 && (
            <SimpleGrid cols={2} spacing="xs">
              {flatOgunler.slice(0, 6).map((o) => (
                <Group key={`ogun-${o.tur}-${o.miktar}`} gap="xs" wrap="nowrap">
                  <Box style={{ flex: 1 }}>
                    <Text size="xs" fw={500}>
                      {o.tur}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {o.miktar?.toLocaleString('tr-TR')} {o.birim || 'öğün'}
                    </Text>
                  </Box>
                </Group>
              ))}
            </SimpleGrid>
          )
        )}
      </ExpandableCardShell>

      <AnalysisDetailModal
        opened={detailOpen}
        onClose={() => setDetailOpen(false)}
        cardType="ogun_bilgileri"
        title="Öğün Bilgileri"
        icon={<IconToolsKitchen2 size={16} />}
        color="orange"
        data={ogunler}
        onSave={onSave}
        isCorrected={isCorrected}
        tenderId={tenderId}
      />
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// 5. IsYerleriCard
// ═══════════════════════════════════════════════════════════════

export function IsYerleriCard({
  yerler,
  showCheckbox,
  isSelected,
  onToggleSelect,
  tenderId,
  onSave,
}: {
  yerler: string[];
} & Pick<EditableCardProps, 'showCheckbox' | 'isSelected' | 'onToggleSelect' | 'tenderId' | 'onSave'>) {
  const [detailOpen, setDetailOpen] = useState(false);
  const { displayItems } = useExpandableItems(yerler, 4);

  if (!yerler || yerler.length === 0) return null;

  return (
    <>
      <ExpandableCardShell
        title="İş Yerleri"
        icon={<IconMapPin size={12} />}
        color="teal"
        badge={`${yerler.length} yer`}
        expandable
        totalCount={yerler.length}
        initialShowCount={4}
        maxExpandedHeight={250}
        onOpenDetail={() => setDetailOpen(true)}
        showCheckbox={showCheckbox}
        isSelected={isSelected}
        onToggleSelect={onToggleSelect}
      >
        <Stack gap={4}>
          {displayItems.map((yer, index) => (
            <Group key={`yer-${index}-${yer.substring(0, 20)}`} gap="xs" wrap="nowrap">
              <ThemeIcon size="xs" variant="light" color="teal" radius="xl">
                <IconBuilding size={10} />
              </ThemeIcon>
              <Text size="xs">{yer}</Text>
            </Group>
          ))}
        </Stack>
      </ExpandableCardShell>

      <AnalysisDetailModal
        opened={detailOpen}
        onClose={() => setDetailOpen(false)}
        cardType="is_yerleri"
        title="İş Yerleri"
        icon={<IconMapPin size={16} />}
        color="teal"
        data={yerler}
        tenderId={tenderId}
        onSave={onSave}
      />
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// 6. GramajBilgileriCard
// ═══════════════════════════════════════════════════════════════

export function GramajBilgileriCard({
  gramajlar,
  isEditing,
  onToggleEdit,
  onSave,
  onDelete,
  isCorrected,
  showCheckbox,
  isSelected,
  onToggleSelect,
  tenderId,
}: { gramajlar: GramajGrubu[] } & EditableCardProps) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  if (!gramajlar || gramajlar.length === 0) return null;

  const INITIAL_SHOW = 3;
  const visibleGramajlar = expanded ? gramajlar : gramajlar.slice(0, INITIAL_SHOW);
  const hasMore = gramajlar.length > INITIAL_SHOW;

  return (
    <>
      <ExpandableCardShell
        title="Gramaj Bilgileri"
        icon={<IconScale size={12} />}
        color="lime"
        badge={`${gramajlar.length} yemek`}
        isEditing={isEditing}
        onToggleEdit={onToggleEdit}
        onDelete={onDelete}
        isCorrected={isCorrected}
        onOpenDetail={() => setDetailOpen(true)}
        showCheckbox={showCheckbox}
        isSelected={isSelected}
        onToggleSelect={onToggleSelect}
      >
        <ScrollArea.Autosize mah={400}>
          <Stack gap="xs">
            {visibleGramajlar.map((grup) => (
              <Paper key={`gramaj-${grup.yemek_adi}`} p="xs" withBorder radius="sm" bg="var(--mantine-color-dark-7)">
                <Group justify="space-between" mb="xs">
                  <Group gap="xs">
                    <Text size="xs" fw={600}>
                      {grup.yemek_adi}
                    </Text>
                    {grup.kategori && (
                      <Badge size="xs" variant="light" color="gray">
                        {grup.kategori}
                      </Badge>
                    )}
                  </Group>
                  {grup.toplam_gramaj && (
                    <Badge size="sm" variant="filled" color="lime">
                      Toplam: {grup.toplam_gramaj}g
                    </Badge>
                  )}
                </Group>

                {grup.malzemeler && grup.malzemeler.length > 0 && (
                  <Table.ScrollContainer minWidth={200}>
                    <Table fz="xs" striped highlightOnHover withTableBorder>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Malzeme</Table.Th>
                          <Table.Th style={{ textAlign: 'right' }}>Miktar</Table.Th>
                          <Table.Th>Birim</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {grup.malzemeler.map((m) => (
                          <Table.Tr key={`${grup.yemek_adi}-${m.item}-${m.weight}`}>
                            <Table.Td>{m.item}</Table.Td>
                            <Table.Td style={{ textAlign: 'right' }}>{m.weight ?? '-'}</Table.Td>
                            <Table.Td>{m.unit}</Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </Table.ScrollContainer>
                )}

                {grup.porsiyon_notu && (
                  <Text size="xs" c="dimmed" mt="xs" fs="italic">
                    Not: {grup.porsiyon_notu}
                  </Text>
                )}
              </Paper>
            ))}
          </Stack>
        </ScrollArea.Autosize>

        {hasMore && (
          <Button
            variant="subtle"
            size="compact-xs"
            mt="xs"
            fullWidth
            onClick={() => setExpanded(!expanded)}
            leftSection={expanded ? <IconChevronUp size={12} /> : <IconChevronDown size={12} />}
          >
            {expanded ? 'Daralt' : `+${gramajlar.length - INITIAL_SHOW} daha göster`}
          </Button>
        )}
      </ExpandableCardShell>

      <AnalysisDetailModal
        opened={detailOpen}
        onClose={() => setDetailOpen(false)}
        cardType="gramaj_gruplari"
        title="Gramaj Bilgileri"
        icon={<IconScale size={16} />}
        color="lime"
        data={gramajlar}
        onSave={onSave}
        isCorrected={isCorrected}
        tenderId={tenderId}
      />
    </>
  );
}
