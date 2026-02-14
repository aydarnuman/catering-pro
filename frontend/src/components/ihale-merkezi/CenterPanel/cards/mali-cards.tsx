'use client';

import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import {
  IconCurrencyLira,
  IconGavel,
  IconMathFunction,
  IconPlus,
  IconShield,
  IconTrash,
  IconWallet,
} from '@tabler/icons-react';
import { useState } from 'react';
import type {
  BirimFiyat,
  CezaKosulu,
  FiyatFarki,
  MaliKriterler,
  TeminatOranlari,
} from '../../types';
import { AnalysisDetailModal } from './AnalysisDetailModal';
import { ExpandableCardShell, useExpandableItems } from './ExpandableCardShell';
import { useCardEditState } from './useCardEditState';

// ═══════════════════════════════════════════════════════════════
// 1. BirimFiyatlarCard
// ═══════════════════════════════════════════════════════════════

interface BirimFiyatlarCardProps {
  birimFiyatlar: BirimFiyat[];
  isEditing?: boolean;
  onToggleEdit?: () => void;
  onSave?: (fieldPath: string, oldValue: unknown, newValue: unknown) => void;
  onDelete?: () => void;
  isCorrected?: boolean;
}

export function BirimFiyatlarCard({
  birimFiyatlar,
  isEditing = false,
  onToggleEdit,
  onSave,
  onDelete,
  isCorrected,
}: BirimFiyatlarCardProps) {
  const [detailOpen, setDetailOpen] = useState(false);

  const { displayItems } = useExpandableItems(birimFiyatlar, 5, isEditing);

  const {
    editData,
    setEditData,
    handleSave,
  } = useCardEditState<Array<{ kalem: string; birim: string; miktar: string; fiyat: string; tutar: string }>>({
    originalData: birimFiyatlar.map((item) => ({
      kalem: item.kalem || item.aciklama || item.text || '',
      birim: item.birim || '',
      miktar: String(item.miktar || ''),
      fiyat: String(item.fiyat || ''),
      tutar: String(item.tutar || ''),
    })),
    isEditing,
    fieldPath: 'birim_fiyatlar',
    onSave,
    onToggleEdit,
    transform: (data) => data.filter((item) => item.kalem.trim()),
  });

  const handleAddItem = () => {
    setEditData((prev) => [...prev, { kalem: '', birim: '', miktar: '', fiyat: '', tutar: '' }]);
  };

  const handleRemoveItem = (index: number) => {
    setEditData((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFieldChange = (index: number, field: string, value: string) => {
    setEditData((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  return (
    <>
      <ExpandableCardShell
        title="Birim Fiyatlar"
        icon={<IconCurrencyLira size={12} />}
        color="green"
        badge={birimFiyatlar.length}
        expandable
        totalCount={birimFiyatlar.length}
        initialShowCount={5}
        isEditing={isEditing}
        onToggleEdit={onToggleEdit}
        onSave={handleSave}
        onDelete={onDelete}
        isCorrected={isCorrected}
        onOpenDetail={() => setDetailOpen(true)}
      >
        <Stack gap={4}>
          {isEditing
            ? editData.map((item, idx) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: Edit mode için geçici key
                <Group key={`bf-edit-${idx}`} gap="xs" wrap="nowrap">
                  <Badge size="xs" variant="filled" color="green" circle style={{ flexShrink: 0, marginTop: 8 }}>
                    {idx + 1}
                  </Badge>
                  <TextInput
                    size="xs"
                    value={item.kalem}
                    placeholder="Kalem adı"
                    onChange={(e) => handleFieldChange(idx, 'kalem', e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <TextInput
                    size="xs"
                    value={item.birim}
                    placeholder="Birim"
                    onChange={(e) => handleFieldChange(idx, 'birim', e.target.value)}
                    w={80}
                  />
                  <TextInput
                    size="xs"
                    value={item.miktar}
                    placeholder="Miktar"
                    onChange={(e) => handleFieldChange(idx, 'miktar', e.target.value)}
                    w={70}
                  />
                  <TextInput
                    size="xs"
                    value={item.fiyat}
                    placeholder="Fiyat"
                    onChange={(e) => handleFieldChange(idx, 'fiyat', e.target.value)}
                    w={80}
                  />
                  <ActionIcon
                    size="xs"
                    variant="subtle"
                    color="red"
                    onClick={() => handleRemoveItem(idx)}
                  >
                    <IconTrash size={10} />
                  </ActionIcon>
                </Group>
              ))
            : displayItems.map((item, idx) => {
                const itemText = item.kalem || item.aciklama || item.text || 'Bilinmeyen';
                return (
                  <Group key={`bf-${idx}-${itemText.substring(0, 15)}`} gap="xs" wrap="nowrap">
                    <Badge size="xs" variant="filled" color="green" circle style={{ flexShrink: 0 }}>
                      {idx + 1}
                    </Badge>
                    <Text size="xs" lineClamp={1} style={{ flex: 1, minWidth: 0 }}>
                      {itemText}
                    </Text>
                    {item.miktar && (
                      <Badge size="xs" variant="light" color="blue" style={{ flexShrink: 0 }}>
                        {item.miktar} {item.birim || ''}
                      </Badge>
                    )}
                    {!item.miktar && item.birim && (
                      <Badge size="xs" variant="outline" color="gray" style={{ flexShrink: 0 }}>
                        {item.birim}
                      </Badge>
                    )}
                    {(item.fiyat || item.tutar) && (
                      <Badge size="xs" variant="light" color="green" style={{ flexShrink: 0 }}>
                        {Number(item.fiyat || item.tutar).toLocaleString('tr-TR')} ₺
                      </Badge>
                    )}
                  </Group>
                );
              })}
        </Stack>
        {isEditing && (
          <Button
            size="compact-xs"
            variant="light"
            color="green"
            mt="xs"
            leftSection={<IconPlus size={12} />}
            onClick={handleAddItem}
          >
            Yeni Kalem Ekle
          </Button>
        )}
      </ExpandableCardShell>

      <AnalysisDetailModal
        opened={detailOpen}
        onClose={() => setDetailOpen(false)}
        cardType="birim_fiyatlar"
        title="Birim Fiyatlar"
        icon={<IconCurrencyLira size={16} />}
        color="green"
        data={birimFiyatlar}
        onSave={onSave}
        isCorrected={isCorrected}
      />
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// 2. TeminatOranlariCard
// ═══════════════════════════════════════════════════════════════

interface TeminatOranlariCardProps {
  teminat: TeminatOranlari;
  isEditing?: boolean;
  onToggleEdit?: () => void;
  onSave?: (fieldPath: string, oldValue: unknown, newValue: unknown) => void;
  onDelete?: () => void;
  isCorrected?: boolean;
}

const TEMINAT_LABELS: Record<string, string> = {
  gecici: 'Geçici Teminat',
  kesin: 'Kesin Teminat',
  ek_kesin: 'Ek Kesin Teminat',
};

export function TeminatOranlariCard({
  teminat,
  isEditing = false,
  onToggleEdit,
  onSave,
  onDelete,
  isCorrected,
}: TeminatOranlariCardProps) {
  const [detailOpen, setDetailOpen] = useState(false);

  const entries = Object.entries(teminat).filter(([, v]) => v?.trim());

  const {
    editData,
    setEditData,
    handleSave,
  } = useCardEditState<Record<string, string>>({
    originalData: { ...teminat } as Record<string, string>,
    isEditing,
    fieldPath: 'teminat_oranlari',
    onSave,
    onToggleEdit,
  });

  if (entries.length === 0 && !isEditing) return null;

  return (
    <>
      <ExpandableCardShell
        title="Teminat Oranları"
        icon={<IconShield size={12} />}
        color="violet"
        isEditing={isEditing}
        onToggleEdit={onToggleEdit}
        onSave={handleSave}
        onDelete={onDelete}
        isCorrected={isCorrected}
        onOpenDetail={() => setDetailOpen(true)}
      >
        {isEditing ? (
          <Stack gap="xs">
            {['gecici', 'kesin', 'ek_kesin'].map((key) => (
              <Group key={key} gap="xs">
                <Text size="xs" w={100} c="dimmed">
                  {TEMINAT_LABELS[key]}:
                </Text>
                <TextInput
                  size="xs"
                  value={editData[key] || ''}
                  placeholder="ör: %3"
                  onChange={(e) => setEditData((prev) => ({ ...prev, [key]: e.target.value }))}
                  style={{ flex: 1 }}
                />
              </Group>
            ))}
          </Stack>
        ) : (
          <Group gap="md">
            {entries.map(([key, value]) => (
              <Box key={key}>
                <Text size="xs" c="dimmed">
                  {TEMINAT_LABELS[key] || key}
                </Text>
                <Text size="lg" fw={700} c="violet">
                  {value}
                </Text>
              </Box>
            ))}
          </Group>
        )}
      </ExpandableCardShell>

      <AnalysisDetailModal
        opened={detailOpen}
        onClose={() => setDetailOpen(false)}
        cardType="teminat_oranlari"
        title="Teminat Oranları"
        icon={<IconShield size={16} />}
        color="violet"
        data={teminat}
        onSave={onSave}
        isCorrected={isCorrected}
      />
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// 3. MaliKriterlerCard
// ═══════════════════════════════════════════════════════════════

interface MaliKriterlerCardProps {
  kriterler: MaliKriterler;
  isEditing?: boolean;
  onToggleEdit?: () => void;
  onSave?: (fieldPath: string, oldValue: unknown, newValue: unknown) => void;
  onDelete?: () => void;
  isCorrected?: boolean;
}

const MALI_LABELS: Record<string, string> = {
  cari_oran: 'Cari Oran',
  ozkaynak_orani: 'Öz Kaynak Oranı',
  is_deneyimi: 'İş Deneyimi',
  ciro_orani: 'Ciro Oranı',
  banka_borc_orani: 'Banka Borcu / Özkaynak',
  toplam_ciro_orani: 'Toplam Ciro Gereksinimi',
  hizmet_ciro_orani: 'Hizmet Cirosu Gereksinimi',
};

export function MaliKriterlerCard({
  kriterler,
  isEditing = false,
  onToggleEdit,
  onSave,
  onDelete,
  isCorrected,
}: MaliKriterlerCardProps) {
  const [detailOpen, setDetailOpen] = useState(false);

  const entries = Object.entries(kriterler).filter(([, v]) => v?.trim());

  const {
    editData,
    setEditData,
    handleSave,
  } = useCardEditState<Record<string, string>>({
    originalData: { ...kriterler } as Record<string, string>,
    isEditing,
    fieldPath: 'mali_kriterler',
    onSave,
    onToggleEdit,
  });

  if (entries.length === 0 && !isEditing) return null;

  return (
    <>
      <ExpandableCardShell
        title="Mali Yeterlilik Kriterleri"
        icon={<IconWallet size={12} />}
        color="grape"
        isEditing={isEditing}
        onToggleEdit={onToggleEdit}
        onSave={handleSave}
        onDelete={onDelete}
        isCorrected={isCorrected}
        onOpenDetail={() => setDetailOpen(true)}
      >
        {isEditing ? (
          <Stack gap="xs">
            {['cari_oran', 'ozkaynak_orani', 'is_deneyimi', 'ciro_orani', 'banka_borc_orani', 'toplam_ciro_orani', 'hizmet_ciro_orani'].map((key) => (
              <Group key={key} gap="xs">
                <Text size="xs" w={100} c="dimmed">
                  {MALI_LABELS[key]}:
                </Text>
                <TextInput
                  size="xs"
                  value={editData[key] || ''}
                  onChange={(e) => setEditData((prev) => ({ ...prev, [key]: e.target.value }))}
                  style={{ flex: 1 }}
                />
              </Group>
            ))}
          </Stack>
        ) : (
          <SimpleGrid cols={2} spacing="xs">
            {entries.map(([key, value]) => (
              <Box key={key}>
                <Text size="xs" c="dimmed">
                  {MALI_LABELS[key] || key}
                </Text>
                <Text size="sm" fw={600}>
                  {value}
                </Text>
              </Box>
            ))}
          </SimpleGrid>
        )}
      </ExpandableCardShell>

      <AnalysisDetailModal
        opened={detailOpen}
        onClose={() => setDetailOpen(false)}
        cardType="mali_kriterler"
        title="Mali Yeterlilik Kriterleri"
        icon={<IconWallet size={16} />}
        color="grape"
        data={kriterler}
        onSave={onSave}
        isCorrected={isCorrected}
      />
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// 4. CezaKosullariCard
// ═══════════════════════════════════════════════════════════════

interface CezaKosullariCardProps {
  cezalar: CezaKosulu[];
}

export function CezaKosullariCard({ cezalar }: CezaKosullariCardProps) {
  const [detailOpen, setDetailOpen] = useState(false);

  const { displayItems } = useExpandableItems(cezalar, 4);

  if (!cezalar || cezalar.length === 0) return null;

  return (
    <>
      <ExpandableCardShell
        title="Ceza Koşulları"
        icon={<IconGavel size={12} />}
        color="red"
        badge={cezalar.length}
        expandable
        totalCount={cezalar.length}
        initialShowCount={4}
        onOpenDetail={() => setDetailOpen(true)}
      >
        <Stack gap={4}>
          {displayItems.map((c) => (
            <Box key={`ceza-${c.tur}-${c.oran}`}>
              <Group justify="space-between" gap="xs" wrap="nowrap">
                <Text size="xs" style={{ flex: 1 }}>
                  {c.tur}
                </Text>
                <Badge size="xs" variant="outline" color="red">
                  {c.oran}
                </Badge>
              </Group>
              {c.aciklama && (
                <Text size="xs" c="dimmed" mt={2} lineClamp={2}>
                  {c.aciklama}
                </Text>
              )}
            </Box>
          ))}
        </Stack>
      </ExpandableCardShell>

      <AnalysisDetailModal
        opened={detailOpen}
        onClose={() => setDetailOpen(false)}
        cardType="ceza_kosullari"
        title="Ceza Koşulları"
        icon={<IconGavel size={16} />}
        color="red"
        data={cezalar}
      />
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// 5. FiyatFarkiCard
// ═══════════════════════════════════════════════════════════════

interface FiyatFarkiCardProps {
  fiyatFarki: FiyatFarki;
}

export function FiyatFarkiCard({ fiyatFarki }: FiyatFarkiCardProps) {
  const [detailOpen, setDetailOpen] = useState(false);

  if (!fiyatFarki || (!fiyatFarki.formul && !fiyatFarki.katsayilar)) return null;

  const katsayilar = fiyatFarki.katsayilar ? Object.entries(fiyatFarki.katsayilar) : [];

  return (
    <>
      <ExpandableCardShell
        title="Fiyat Farkı"
        icon={<IconMathFunction size={12} />}
        color="pink"
        onOpenDetail={() => setDetailOpen(true)}
      >
        {fiyatFarki.formul && (
          <Text size="xs" c="dimmed" mb="xs" style={{ fontFamily: 'monospace' }}>
            {fiyatFarki.formul}
          </Text>
        )}
        {katsayilar.length > 0 && (
          <Group gap="xs">
            {katsayilar.map(([key, value]) => (
              <Badge key={key} size="xs" variant="outline" color="pink">
                {key}={value}
              </Badge>
            ))}
          </Group>
        )}
      </ExpandableCardShell>

      <AnalysisDetailModal
        opened={detailOpen}
        onClose={() => setDetailOpen(false)}
        cardType="fiyat_farki"
        title="Fiyat Farkı"
        icon={<IconMathFunction size={16} />}
        color="pink"
        data={fiyatFarki}
      />
    </>
  );
}
