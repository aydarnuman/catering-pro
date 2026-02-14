'use client';

import {
  Badge,
  Group,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconCertificate,
  IconCheck,
  IconPhone,
} from '@tabler/icons-react';
import { useState } from 'react';
import type { GerekliBelge, IletisimBilgileri } from '../../types';
import { AnalysisDetailModal, type AnalysisCardType } from './AnalysisDetailModal';
import { ExpandableCardShell, useExpandableItems } from './ExpandableCardShell';
import { useCardEditState } from './useCardEditState';

// ═══════════════════════════════════════════════════════════════
// Gerekli Belgeler Kartı
// ═══════════════════════════════════════════════════════════════

export function GerekliBelgelerCard({ belgeler }: { belgeler: GerekliBelge[] }) {
  const [detailOpen, setDetailOpen] = useState(false);
  const { displayItems } = useExpandableItems(belgeler, 5);

  if (!belgeler || belgeler.length === 0) return null;

  return (
    <>
      <ExpandableCardShell
        title="Gerekli Belgeler"
        icon={<IconCertificate size={12} />}
        color="lime"
        badge={belgeler.length}
        expandable
        totalCount={belgeler.length}
        initialShowCount={5}
        maxExpandedHeight={300}
        onOpenDetail={() => setDetailOpen(true)}
      >
        <Stack gap={4}>
          {displayItems.map((b) => {
            const belgeAdi = typeof b === 'string' ? b : b.belge;
            const zorunlu = typeof b === 'object' ? b.zorunlu : true;
            const puan = typeof b === 'object' ? (b.puan ?? 0) : 0;
            return (
              <Group key={`belge-${belgeAdi.substring(0, 30)}`} gap="xs" wrap="nowrap">
                <ThemeIcon
                  size="xs"
                  variant={zorunlu ? 'filled' : 'light'}
                  color={zorunlu ? 'lime' : 'gray'}
                  radius="xl"
                >
                  <IconCheck size={10} />
                </ThemeIcon>
                <Text size="xs" style={{ flex: 1 }}>
                  {belgeAdi}
                </Text>
                {puan > 0 && (
                  <Badge size="xs" variant="light" color="blue">
                    +{puan} puan
                  </Badge>
                )}
              </Group>
            );
          })}
        </Stack>
      </ExpandableCardShell>

      <AnalysisDetailModal
        opened={detailOpen}
        onClose={() => setDetailOpen(false)}
        cardType={'gerekli_belgeler' as AnalysisCardType}
        title="Gerekli Belgeler"
        icon={<IconCertificate size={14} />}
        color="lime"
        data={belgeler}
      />
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// İletişim Bilgileri Kartı
// ═══════════════════════════════════════════════════════════════

const ILETISIM_LABELS: Record<string, string> = {
  telefon: 'Telefon',
  email: 'E-posta',
  adres: 'Adres',
  yetkili: 'Yetkili',
};

const ILETISIM_KEYS = ['telefon', 'email', 'adres', 'yetkili'] as const;

export function IletisimCard({
  iletisim,
  isEditing,
  onToggleEdit,
  onSave,
  onDelete,
  isCorrected,
}: {
  iletisim: IletisimBilgileri;
  isEditing?: boolean;
  onToggleEdit?: () => void;
  onSave?: (fieldPath: string, oldValue: unknown, newValue: unknown) => void;
  onDelete?: () => void;
  isCorrected?: boolean;
}) {
  const [detailOpen, setDetailOpen] = useState(false);

  const { editData, setEditData, handleSave } = useCardEditState<Record<string, string>>({
    originalData: { ...iletisim } as Record<string, string>,
    isEditing: !!isEditing,
    fieldPath: 'iletisim',
    onSave,
    onToggleEdit,
  });

  const entries = Object.entries(iletisim).filter(([, v]) => v?.trim());

  if (entries.length === 0 && !isEditing) return null;

  return (
    <>
      <ExpandableCardShell
        title="İletişim Bilgileri"
        icon={<IconPhone size={12} />}
        color="blue"
        isEditing={isEditing}
        onToggleEdit={onToggleEdit}
        onSave={handleSave}
        onDelete={onDelete}
        isCorrected={isCorrected}
        onOpenDetail={() => setDetailOpen(true)}
      >
        <Stack gap={4}>
          {isEditing
            ? ILETISIM_KEYS.map((key) => (
                <Group key={key} gap="xs" wrap="nowrap">
                  <Text size="xs" c="dimmed" w={70}>
                    {ILETISIM_LABELS[key] || key}:
                  </Text>
                  <TextInput
                    size="xs"
                    value={editData[key] || ''}
                    onChange={(e) => setEditData({ ...editData, [key]: e.target.value })}
                    style={{ flex: 1 }}
                  />
                </Group>
              ))
            : entries.map(([key, value]) => (
                <Group key={key} gap="xs" wrap="nowrap">
                  <Text size="xs" c="dimmed" w={70}>
                    {ILETISIM_LABELS[key] || key}:
                  </Text>
                  <Text size="xs" style={{ flex: 1 }}>
                    {value}
                  </Text>
                </Group>
              ))}
        </Stack>
      </ExpandableCardShell>

      <AnalysisDetailModal
        opened={detailOpen}
        onClose={() => setDetailOpen(false)}
        cardType={'iletisim' as AnalysisCardType}
        title="İletişim Bilgileri"
        icon={<IconPhone size={14} />}
        color="blue"
        data={iletisim}
        onSave={onSave}
        isCorrected={isCorrected}
      />
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// Eksik Bilgiler Kartı
// ═══════════════════════════════════════════════════════════════

export function EksikBilgilerCard({ eksikBilgiler }: { eksikBilgiler: string[] }) {
  const [detailOpen, setDetailOpen] = useState(false);
  const { displayItems } = useExpandableItems(eksikBilgiler, 8);

  if (!eksikBilgiler || eksikBilgiler.length === 0) return null;

  return (
    <>
      <ExpandableCardShell
        title="Eksik Bilgiler"
        icon={<IconAlertTriangle size={12} />}
        color="yellow"
        badge={eksikBilgiler.length}
        expandable
        totalCount={eksikBilgiler.length}
        initialShowCount={8}
        maxExpandedHeight={300}
        onOpenDetail={() => setDetailOpen(true)}
      >
        <Group gap={6}>
          {displayItems.map((eksik, idx) => (
            <Badge key={`eksik-${eksik.substring(0, 15)}-${idx}`} size="xs" variant="outline" color="yellow">
              {eksik}
            </Badge>
          ))}
        </Group>
      </ExpandableCardShell>

      <AnalysisDetailModal
        opened={detailOpen}
        onClose={() => setDetailOpen(false)}
        cardType={'eksik_bilgiler' as AnalysisCardType}
        title="Eksik Bilgiler"
        icon={<IconAlertTriangle size={14} />}
        color="yellow"
        data={eksikBilgiler}
      />
    </>
  );
}
