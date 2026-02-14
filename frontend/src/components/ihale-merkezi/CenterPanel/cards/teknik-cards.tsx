'use client';

import { ActionIcon, Badge, Button, Group, Stack, Text, Textarea, ThemeIcon } from '@mantine/core';
import {
  IconAlertCircle,
  IconAlertTriangle,
  IconClipboardList,
  IconExclamationMark,
  IconInfoCircle,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react';
import { useState } from 'react';
import { type AnalysisCardType, AnalysisDetailModal } from './AnalysisDetailModal';
import { getTeknikSartTextFromItem } from './card-utils';
import { ExpandableCardShell, useExpandableItems } from './ExpandableCardShell';
import { useCardEditState } from './useCardEditState';

// ═══════════════════════════════════════════════════════════════
// TeknikSartlarCard
// ═══════════════════════════════════════════════════════════════

interface TeknikSartlarCardProps {
  teknikSartlar: unknown[];
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

export function TeknikSartlarCard({
  teknikSartlar,
  isEditing = false,
  onToggleEdit,
  onSave,
  onDelete,
  isCorrected,
  showCheckbox,
  isSelected,
  onToggleSelect,
  tenderId,
}: TeknikSartlarCardProps) {
  const [detailOpen, setDetailOpen] = useState(false);

  const { editData, setEditData, handleSave } = useCardEditState<string[]>({
    originalData: teknikSartlar.map((s) => getTeknikSartTextFromItem(s)),
    isEditing,
    fieldPath: 'teknik_sartlar',
    onSave,
    onToggleEdit,
    transform: (items) => items.filter((s) => s.trim()),
  });

  const { displayItems } = useExpandableItems(teknikSartlar, 5, isEditing);

  return (
    <>
      <ExpandableCardShell
        title="Teknik Şartlar"
        icon={<IconClipboardList size={12} />}
        color="blue"
        badge={teknikSartlar.length}
        expandable
        totalCount={teknikSartlar.length}
        initialShowCount={5}
        isEditing={isEditing}
        onToggleEdit={onToggleEdit}
        onSave={handleSave}
        onDelete={onDelete}
        isCorrected={isCorrected}
        onOpenDetail={() => setDetailOpen(true)}
        showCheckbox={showCheckbox}
        isSelected={isSelected}
        onToggleSelect={onToggleSelect}
      >
        <Stack gap={4}>
          {isEditing
            ? editData.map((text, idx) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: Edit mode için geçici key
                <Group key={`ts-edit-${idx}`} gap="xs" wrap="nowrap" align="flex-start">
                  <Badge size="xs" variant="filled" color="blue" circle style={{ flexShrink: 0, marginTop: 8 }}>
                    {idx + 1}
                  </Badge>
                  <Textarea
                    size="xs"
                    value={text}
                    onChange={(e) => {
                      const updated = [...editData];
                      updated[idx] = e.target.value;
                      setEditData(updated);
                    }}
                    autosize
                    minRows={1}
                    maxRows={4}
                    style={{ flex: 1 }}
                  />
                  <ActionIcon
                    size="xs"
                    variant="subtle"
                    color="red"
                    onClick={() => setEditData(editData.filter((_, i) => i !== idx))}
                    style={{ marginTop: 6 }}
                  >
                    <IconTrash size={10} />
                  </ActionIcon>
                </Group>
              ))
            : displayItems.map((sart, idx) => {
                const sartText = getTeknikSartTextFromItem(sart);
                const onem = typeof sart === 'object' && sart !== null ? (sart as Record<string, unknown>).onem : null;
                const onemColor = onem === 'kritik' ? 'red' : onem === 'normal' ? 'blue' : 'gray';
                return (
                  <Group key={`ts-${idx}-${sartText.substring(0, 20)}`} gap="xs" wrap="nowrap" align="flex-start">
                    <Badge size="xs" variant="filled" color={onemColor} circle style={{ flexShrink: 0, marginTop: 2 }}>
                      {idx + 1}
                    </Badge>
                    <Text size="xs" style={{ flex: 1 }} lineClamp={2}>
                      {sartText}
                    </Text>
                  </Group>
                );
              })}
        </Stack>
        {isEditing && (
          <Button
            size="compact-xs"
            variant="light"
            color="blue"
            mt="xs"
            leftSection={<IconPlus size={12} />}
            onClick={() => setEditData([...editData, ''])}
          >
            Yeni Madde Ekle
          </Button>
        )}
      </ExpandableCardShell>

      <AnalysisDetailModal
        opened={detailOpen}
        onClose={() => setDetailOpen(false)}
        cardType={'teknik_sartlar' as AnalysisCardType}
        title="Teknik Şartlar"
        icon={<IconClipboardList size={16} />}
        color="blue"
        data={teknikSartlar}
        onSave={onSave}
        isCorrected={isCorrected}
        tenderId={tenderId}
      />
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// BenzerIsTanimiCard
// ═══════════════════════════════════════════════════════════════

interface BenzerIsTanimiCardProps {
  tanim: string;
  showCheckbox?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}

export function BenzerIsTanimiCard({ tanim, showCheckbox, isSelected, onToggleSelect }: BenzerIsTanimiCardProps) {
  if (!tanim || !tanim.trim()) return null;

  return (
    <ExpandableCardShell
      title="Benzer İş Tanımı"
      icon={<IconInfoCircle size={12} />}
      color="gray"
      badge={undefined}
      showCheckbox={showCheckbox}
      isSelected={isSelected}
      onToggleSelect={onToggleSelect}
    >
      <Text size="xs" c="dimmed" style={{ lineHeight: 1.6 }}>
        {tanim}
      </Text>
    </ExpandableCardShell>
  );
}

// ═══════════════════════════════════════════════════════════════
// OnemliNotlarCard
// ═══════════════════════════════════════════════════════════════

interface OnemliNotlarCardProps {
  notlar: Array<{ not: string; tur?: 'bilgi' | 'uyari' | 'gereklilik' } | string>;
  showCheckbox?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  tenderId?: number;
  onSave?: (cardType: string, originalData: unknown, newData: unknown) => void;
}

export function OnemliNotlarCard({
  notlar,
  showCheckbox,
  isSelected,
  onToggleSelect,
  tenderId,
  onSave,
}: OnemliNotlarCardProps) {
  const [detailOpen, setDetailOpen] = useState(false);

  const { displayItems } = useExpandableItems(notlar, 5);

  if (!notlar || notlar.length === 0) return null;

  return (
    <>
      <ExpandableCardShell
        title="Önemli Notlar"
        icon={<IconAlertCircle size={12} />}
        color="orange"
        badge={notlar.length}
        expandable
        totalCount={notlar.length}
        initialShowCount={5}
        onOpenDetail={() => setDetailOpen(true)}
        showCheckbox={showCheckbox}
        isSelected={isSelected}
        onToggleSelect={onToggleSelect}
      >
        <Stack gap={4}>
          {displayItems.map((not, idx) => {
            const notItem = typeof not === 'string' ? { not, tur: 'bilgi' as const } : not;
            const turColor = notItem.tur === 'uyari' ? 'red' : notItem.tur === 'gereklilik' ? 'blue' : 'gray';
            const TurIcon =
              notItem.tur === 'uyari'
                ? IconAlertTriangle
                : notItem.tur === 'gereklilik'
                  ? IconExclamationMark
                  : IconInfoCircle;
            return (
              <Group key={`not-${idx}-${notItem.not.substring(0, 20)}`} gap="xs" wrap="nowrap" align="flex-start">
                <ThemeIcon size="xs" variant="light" color={turColor} radius="xl" mt={2} style={{ flexShrink: 0 }}>
                  <TurIcon size={10} />
                </ThemeIcon>
                <Text size="xs" style={{ flex: 1 }}>
                  {notItem.not}
                </Text>
              </Group>
            );
          })}
        </Stack>
      </ExpandableCardShell>

      <AnalysisDetailModal
        opened={detailOpen}
        onClose={() => setDetailOpen(false)}
        cardType={'onemli_notlar' as AnalysisCardType}
        title="Önemli Notlar"
        icon={<IconAlertCircle size={16} />}
        color="orange"
        data={notlar}
        tenderId={tenderId}
        onSave={onSave}
      />
    </>
  );
}
