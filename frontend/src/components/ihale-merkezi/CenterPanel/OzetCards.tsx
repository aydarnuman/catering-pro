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
  Textarea,
  TextInput,
  ThemeIcon,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconAlertTriangle,
  IconBuilding,
  IconCalendar,
  IconCertificate,
  IconCheck,
  IconChevronDown,
  IconClipboardList,
  IconClock,
  IconCurrencyLira,
  IconDeviceFloppy,
  IconEdit,
  IconExclamationMark,
  IconGavel,
  IconInfoCircle,
  IconMapPin,
  IconMathFunction,
  IconPhone,
  IconPlus,
  IconShield,
  IconToolsKitchen2,
  IconTrash,
  IconUsers,
  IconWallet,
} from '@tabler/icons-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import type {
  AnalysisData,
  CezaKosulu,
  FiyatFarki,
  GerekliBelge,
  IletisimBilgileri,
  MaliKriterler,
  OgunBilgisi,
  PersonelDetay,
  ServisSaatleri,
  TeminatOranlari,
} from '../types';

// ========== YARDIMCI FONKSİYONLAR ==========

/** Gerçek personel pozisyonu mu, yoksa iş yeri/lokasyon mu ayırt et */
export function isRealPersonelPosition(pozisyon: string): boolean {
  if (!pozisyon) return false;
  const lower = pozisyon.toLowerCase();
  const personelKeywords = [
    'aşçı', 'asci', 'aşçıbaşı', 'ascibaşi', 'aşçı başı',
    'garson', 'bulaşıkçı', 'bulasikci', 'temizlik', 'şoför', 'sofor',
    'diyetisyen', 'gıda mühendis', 'gida muhendis', 'gıda teknik', 'gida teknik',
    'kasap', 'fırıncı', 'firinci', 'pastacı', 'pastaci',
    'müdür', 'mudur', 'sorumlu', 'yardımcı', 'yardimci',
    'kalfa', 'usta', 'çamaşırcı', 'camasirci',
    'toplam', 'personel', 'işçi', 'isci', 'eleman',
    'diyet aşçı', 'diyet asci', 'kumanyacı', 'kumanyaci',
    'depocu', 'ambar',
  ];
  const locationKeywords = [
    'hastane', 'hospital', 'eah', 'üniversite', 'universite', 'okul', 'lise',
    'ilkokul', 'ortaokul', 'fakülte', 'fakulte', 'enstitü', 'enstitu',
    'müdürlüğü', 'mudurlugu', 'başkanlığı', 'baskanligi',
    'merkez', 'bina', 'lojman', 'kışla', 'kisla', 'karakol',
    'cezaevi', 'tesis', 'kampüs', 'kampus', 'şube', 'sube',
    'ilçe', 'ilce', 'il ', 'prof.', 'prof ', 'dr.', 'şehit',
    'fizik tedavi', 'rehabilitasyon', 'devlet', 'eğitim ve araştırma',
    'acil durum', 'sağlık', 'saglik', 'poliklinik', 'dispanser',
    'adsm', 'asm', 'tsm', 'trsm',
  ];
  if (locationKeywords.some(kw => lower.includes(kw))) return false;
  if (personelKeywords.some(kw => lower.includes(kw))) return true;
  return true;
}

// ========== ÖZET KARTLARİ (Expandable) ==========

// Teknik şart metnini çıkar
export function getTeknikSartTextFromItem(sart: unknown): string {
  if (!sart) return '';
  if (typeof sart === 'string') return sart;
  if (typeof sart === 'object') {
    const obj = sart as Record<string, unknown>;
    return String(obj.madde || obj.text || obj.description || JSON.stringify(sart));
  }
  return String(sart);
}

// Teknik Şartlar Kartı
export function TeknikSartlarCard({
  teknikSartlar,
  isEditing,
  onToggleEdit,
  onSave,
  isCorrected,
}: {
  teknikSartlar: unknown[];
  onViewAll?: () => void;
  isEditing?: boolean;
  onToggleEdit?: () => void;
  onSave?: (fieldPath: string, oldValue: unknown, newValue: unknown) => void;
  isCorrected?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editItems, setEditItems] = useState<string[]>([]);

  // Edit moduna girildiğinde mevcut değerleri kopyala
  useEffect(() => {
    if (isEditing) {
      setEditItems(teknikSartlar.map((s) => getTeknikSartTextFromItem(s)));
    }
  }, [isEditing, teknikSartlar]);

  const displayItems = expanded || isEditing ? teknikSartlar : teknikSartlar.slice(0, 5);
  const hasMore = teknikSartlar.length > 5;

  const handleSave = () => {
    if (onSave) {
      const newValue = editItems.filter((s) => s.trim());
      onSave(
        'teknik_sartlar',
        teknikSartlar.map((s) => getTeknikSartTextFromItem(s)),
        newValue
      );
    }
    onToggleEdit?.();
  };

  return (
    <Paper
      p="sm"
      withBorder
      radius="md"
      className="glassy-card-nested"
      style={isCorrected ? { borderColor: 'var(--mantine-color-green-5)' } : undefined}
    >
      <Group justify="space-between" mb="xs">
        <Group gap="xs">
          <ThemeIcon size="sm" variant="light" color="blue">
            <IconClipboardList size={12} />
          </ThemeIcon>
          <Text size="sm" fw={600}>
            Teknik Şartlar
          </Text>
          <Badge size="xs" variant="light" color="blue">
            {teknikSartlar.length}
          </Badge>
          {isCorrected && (
            <Badge size="xs" variant="filled" color="green">
              Düzeltildi
            </Badge>
          )}
        </Group>
        <Group gap={4}>
          {onToggleEdit && !isEditing && (
            <ActionIcon size="xs" variant="subtle" color="gray" onClick={onToggleEdit}>
              <IconEdit size={12} />
            </ActionIcon>
          )}
          {isEditing ? (
            <Group gap={4}>
              <Button size="compact-xs" variant="light" color="gray" onClick={onToggleEdit}>
                İptal
              </Button>
              <Button
                size="compact-xs"
                variant="filled"
                color="green"
                onClick={handleSave}
                leftSection={<IconDeviceFloppy size={12} />}
              >
                Kaydet
              </Button>
            </Group>
          ) : (
            hasMore && (
              <Button
                size="xs"
                variant="subtle"
                onClick={() => setExpanded(!expanded)}
                rightSection={
                  expanded ? (
                    <IconChevronDown size={12} style={{ transform: 'rotate(180deg)' }} />
                  ) : (
                    <IconChevronDown size={12} />
                  )
                }
              >
                {expanded ? 'Daralt' : `Tümü (${teknikSartlar.length})`}
              </Button>
            )
          )}
        </Group>
      </Group>
      <ScrollArea.Autosize mah={expanded || isEditing ? 400 : undefined}>
        <Stack gap={4}>
          {isEditing
            ? editItems.map((text, idx) => (
                <Group key={`ts-edit-${idx}`} gap="xs" wrap="nowrap" align="flex-start">
                  <Badge
                    size="xs"
                    variant="filled"
                    color="blue"
                    circle
                    style={{ flexShrink: 0, marginTop: 8 }}
                  >
                    {idx + 1}
                  </Badge>
                  <Textarea
                    size="xs"
                    value={text}
                    onChange={(e) => {
                      const updated = [...editItems];
                      updated[idx] = e.target.value;
                      setEditItems(updated);
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
                    onClick={() => setEditItems(editItems.filter((_, i) => i !== idx))}
                    style={{ marginTop: 6 }}
                  >
                    <IconTrash size={10} />
                  </ActionIcon>
                </Group>
              ))
            : displayItems.map((sart, idx) => {
                const sartText = getTeknikSartTextFromItem(sart);
                const onem =
                  typeof sart === 'object' && sart !== null
                    ? (sart as Record<string, unknown>).onem
                    : null;
                const onemColor = onem === 'kritik' ? 'red' : onem === 'normal' ? 'blue' : 'gray';
                return (
                  <Group
                    key={`ts-${idx}-${sartText.substring(0, 20)}`}
                    gap="xs"
                    wrap="nowrap"
                    align="flex-start"
                  >
                    <Badge
                      size="xs"
                      variant="filled"
                      color={onemColor}
                      circle
                      style={{ flexShrink: 0, marginTop: 2 }}
                    >
                      {idx + 1}
                    </Badge>
                    <Text size="xs" style={{ flex: 1 }} lineClamp={expanded ? undefined : 2}>
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
            onClick={() => setEditItems([...editItems, ''])}
          >
            Yeni Madde Ekle
          </Button>
        )}
      </ScrollArea.Autosize>
    </Paper>
  );
}

// Birim Fiyatlar Kartı
export function BirimFiyatlarCard({
  birimFiyatlar,
  isEditing,
  onToggleEdit,
  onSave,
  isCorrected,
}: {
  birimFiyatlar: Array<{
    kalem?: string;
    aciklama?: string;
    text?: string;
    birim?: string;
    miktar?: string | number;
    fiyat?: string | number;
    tutar?: string | number;
  }>;
  onViewAll?: () => void;
  isEditing?: boolean;
  onToggleEdit?: () => void;
  onSave?: (fieldPath: string, oldValue: unknown, newValue: unknown) => void;
  isCorrected?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editItems, setEditItems] = useState<
    Array<{ kalem: string; birim: string; miktar: string }>
  >([]);

  useEffect(() => {
    if (isEditing) {
      setEditItems(
        birimFiyatlar.map((item) => ({
          kalem: item.kalem || item.aciklama || item.text || '',
          birim: item.birim || '',
          miktar: String(item.miktar || ''),
        }))
      );
    }
  }, [isEditing, birimFiyatlar]);

  const displayItems = expanded || isEditing ? birimFiyatlar : birimFiyatlar.slice(0, 5);
  const hasMore = birimFiyatlar.length > 5;

  const handleSave = () => {
    if (onSave) {
      const newValue = editItems
        .filter((item) => item.kalem.trim())
        .map((item) => ({ kalem: item.kalem, birim: item.birim, miktar: item.miktar }));
      onSave('birim_fiyatlar', birimFiyatlar, newValue);
    }
    onToggleEdit?.();
  };

  return (
    <Paper
      p="sm"
      withBorder
      radius="md"
      className="glassy-card-nested"
      style={isCorrected ? { borderColor: 'var(--mantine-color-green-5)' } : undefined}
    >
      <Group justify="space-between" mb="xs">
        <Group gap="xs">
          <ThemeIcon size="sm" variant="light" color="green">
            <IconCurrencyLira size={12} />
          </ThemeIcon>
          <Text size="sm" fw={600}>
            Birim Fiyatlar
          </Text>
          <Badge size="xs" variant="light" color="green">
            {birimFiyatlar.length}
          </Badge>
          {isCorrected && (
            <Badge size="xs" variant="filled" color="green">
              Düzeltildi
            </Badge>
          )}
        </Group>
        <Group gap={4}>
          {onToggleEdit && !isEditing && (
            <ActionIcon size="xs" variant="subtle" color="gray" onClick={onToggleEdit}>
              <IconEdit size={12} />
            </ActionIcon>
          )}
          {isEditing ? (
            <Group gap={4}>
              <Button size="compact-xs" variant="light" color="gray" onClick={onToggleEdit}>
                İptal
              </Button>
              <Button
                size="compact-xs"
                variant="filled"
                color="green"
                onClick={handleSave}
                leftSection={<IconDeviceFloppy size={12} />}
              >
                Kaydet
              </Button>
            </Group>
          ) : (
            hasMore && (
              <Button
                size="xs"
                variant="subtle"
                color="green"
                onClick={() => setExpanded(!expanded)}
                rightSection={
                  expanded ? (
                    <IconChevronDown size={12} style={{ transform: 'rotate(180deg)' }} />
                  ) : (
                    <IconChevronDown size={12} />
                  )
                }
              >
                {expanded ? 'Daralt' : `Tümü (${birimFiyatlar.length})`}
              </Button>
            )
          )}
        </Group>
      </Group>
      <ScrollArea.Autosize mah={expanded || isEditing ? 400 : undefined}>
        <Stack gap={4}>
          {isEditing
            ? editItems.map((item, idx) => (
                <Group key={`bf-edit-${idx}`} gap="xs" wrap="nowrap">
                  <Badge
                    size="xs"
                    variant="filled"
                    color="green"
                    circle
                    style={{ flexShrink: 0, marginTop: 8 }}
                  >
                    {idx + 1}
                  </Badge>
                  <TextInput
                    size="xs"
                    value={item.kalem}
                    placeholder="Kalem adı"
                    onChange={(e) => {
                      const updated = [...editItems];
                      updated[idx] = { ...updated[idx], kalem: e.target.value };
                      setEditItems(updated);
                    }}
                    style={{ flex: 1 }}
                  />
                  <TextInput
                    size="xs"
                    value={item.birim}
                    placeholder="Birim"
                    onChange={(e) => {
                      const updated = [...editItems];
                      updated[idx] = { ...updated[idx], birim: e.target.value };
                      setEditItems(updated);
                    }}
                    w={80}
                  />
                  <ActionIcon
                    size="xs"
                    variant="subtle"
                    color="red"
                    onClick={() => setEditItems(editItems.filter((_, i) => i !== idx))}
                  >
                    <IconTrash size={10} />
                  </ActionIcon>
                </Group>
              ))
            : displayItems.map((item, idx) => {
                const itemText = item.kalem || item.aciklama || item.text || 'Bilinmeyen';
                return (
                  <Group
                    key={`bf-${idx}-${itemText.substring(0, 15)}`}
                    gap="xs"
                    wrap="nowrap"
                  >
                    <Badge
                      size="xs"
                      variant="filled"
                      color="green"
                      circle
                      style={{ flexShrink: 0 }}
                    >
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
            onClick={() => setEditItems([...editItems, { kalem: '', birim: '', miktar: '' }])}
          >
            Yeni Kalem Ekle
          </Button>
        )}
      </ScrollArea.Autosize>
    </Paper>
  );
}

// Önemli Notlar Kartı
export function OnemliNotlarCard({
  notlar,
}: {
  notlar: Array<{ not: string; tur?: 'bilgi' | 'uyari' | 'gereklilik' } | string>;
  onViewAll?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const displayItems = expanded ? notlar : notlar.slice(0, 5);
  const hasMore = notlar.length > 5;

  return (
    <Paper p="sm" withBorder radius="md" className="glassy-card-nested">
      <Group justify="space-between" mb="xs">
        <Group gap="xs">
          <ThemeIcon size="sm" variant="light" color="orange">
            <IconAlertCircle size={12} />
          </ThemeIcon>
          <Text size="sm" fw={600}>
            Önemli Notlar
          </Text>
          <Badge size="xs" variant="light" color="orange">
            {notlar.length}
          </Badge>
        </Group>
        {hasMore && (
          <Button
            size="xs"
            variant="subtle"
            color="orange"
            onClick={() => setExpanded(!expanded)}
            rightSection={
              expanded ? (
                <IconChevronDown size={12} style={{ transform: 'rotate(180deg)' }} />
              ) : (
                <IconChevronDown size={12} />
              )
            }
          >
            {expanded ? 'Daralt' : `Tümü (${notlar.length})`}
          </Button>
        )}
      </Group>
      <ScrollArea.Autosize mah={expanded ? 400 : undefined}>
        <Stack gap={4}>
          {displayItems.map((not, idx) => {
            const notItem = typeof not === 'string' ? { not, tur: 'bilgi' as const } : not;
            const turColor =
              notItem.tur === 'uyari' ? 'red' : notItem.tur === 'gereklilik' ? 'blue' : 'gray';
            const TurIcon =
              notItem.tur === 'uyari'
                ? IconAlertTriangle
                : notItem.tur === 'gereklilik'
                  ? IconExclamationMark
                  : IconInfoCircle;
            return (
              <Group
                key={`not-${idx}-${notItem.not.substring(0, 20)}`}
                gap="xs"
                wrap="nowrap"
                align="flex-start"
              >
                <ThemeIcon
                  size="xs"
                  variant="light"
                  color={turColor}
                  radius="xl"
                  mt={2}
                  style={{ flexShrink: 0 }}
                >
                  <TurIcon size={10} />
                </ThemeIcon>
                <Text size="xs" style={{ flex: 1 }}>
                  {notItem.not}
                </Text>
              </Group>
            );
          })}
        </Stack>
      </ScrollArea.Autosize>
    </Paper>
  );
}

// Eksik Bilgiler Kartı
export function EksikBilgilerCard({ eksikBilgiler }: { eksikBilgiler: string[] }) {
  const [expanded, setExpanded] = useState(false);
  const displayItems = expanded ? eksikBilgiler : eksikBilgiler.slice(0, 8);
  const hasMore = eksikBilgiler.length > 8;

  return (
    <Paper
      p="sm"
      withBorder
      radius="md"
      className="glassy-card-nested"
      style={{
        borderColor: 'var(--mantine-color-yellow-6)',
        background: 'rgba(234, 179, 8, 0.05)',
      }}
    >
      <Group justify="space-between" mb="xs">
        <Group gap="xs">
          <ThemeIcon size="sm" variant="light" color="yellow">
            <IconAlertTriangle size={12} />
          </ThemeIcon>
          <Text size="sm" fw={600}>
            Eksik Bilgiler
          </Text>
          <Badge size="xs" variant="light" color="yellow">
            {eksikBilgiler.length}
          </Badge>
        </Group>
        {hasMore && (
          <Button
            size="xs"
            variant="subtle"
            color="yellow"
            onClick={() => setExpanded(!expanded)}
            rightSection={
              expanded ? (
                <IconChevronDown size={12} style={{ transform: 'rotate(180deg)' }} />
              ) : (
                <IconChevronDown size={12} />
              )
            }
          >
            {expanded ? 'Daralt' : `Tümü (${eksikBilgiler.length})`}
          </Button>
        )}
      </Group>
      <ScrollArea.Autosize mah={expanded ? 300 : undefined}>
        <Group gap={6}>
          {displayItems.map((eksik, idx) => (
            <Badge
              key={`eksik-${eksik.substring(0, 15)}-${idx}`}
              size="xs"
              variant="outline"
              color="yellow"
            >
              {eksik}
            </Badge>
          ))}
        </Group>
      </ScrollArea.Autosize>
    </Paper>
  );
}

// Takvim Kartı
export function TakvimCard({
  takvim,
}: {
  takvim: Array<{ olay: string; tarih: string; gun?: string }>;
  onViewAll?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const displayItems = expanded ? takvim : takvim.slice(0, 6);
  const hasMore = takvim.length > 6;

  return (
    <Paper p="sm" withBorder radius="md" className="glassy-card-nested">
      <Group justify="space-between" mb="xs">
        <Group gap="xs">
          <ThemeIcon size="sm" variant="light" color="cyan">
            <IconCalendar size={12} />
          </ThemeIcon>
          <Text size="sm" fw={600}>
            Takvim
          </Text>
          <Badge size="xs" variant="light" color="cyan">
            {takvim.length}
          </Badge>
        </Group>
        {hasMore && (
          <Button
            size="xs"
            variant="subtle"
            color="cyan"
            onClick={() => setExpanded(!expanded)}
            rightSection={
              expanded ? (
                <IconChevronDown size={12} style={{ transform: 'rotate(180deg)' }} />
              ) : (
                <IconChevronDown size={12} />
              )
            }
          >
            {expanded ? 'Daralt' : `Tümü (${takvim.length})`}
          </Button>
        )}
      </Group>
      <ScrollArea.Autosize mah={expanded ? 400 : undefined}>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
          {displayItems.map((item, idx) => (
            <Group key={`takvim-${item.olay}-${idx}`} gap="xs" wrap="nowrap">
              <ThemeIcon size="xs" variant="light" color="cyan" radius="xl">
                <IconClock size={10} />
              </ThemeIcon>
              <Box style={{ flex: 1, minWidth: 0 }}>
                <Text size="xs" fw={500} lineClamp={expanded ? undefined : 1}>
                  {item.olay}
                </Text>
                <Group gap={4}>
                  <Text size="xs" c="dimmed">
                    {item.tarih}
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
      </ScrollArea.Autosize>
    </Paper>
  );
}

// ═══════════════════════════════════════════════════════════════
// YENİ KARTLAR - Detaylı Analiz Bilgileri
// ═══════════════════════════════════════════════════════════════

// İletişim Bilgileri Kartı
export function IletisimCard({
  iletisim,
  isEditing,
  onToggleEdit,
  onSave,
  isCorrected,
}: {
  iletisim: IletisimBilgileri;
  isEditing?: boolean;
  onToggleEdit?: () => void;
  onSave?: (fieldPath: string, oldValue: unknown, newValue: unknown) => void;
  isCorrected?: boolean;
}) {
  const entries = Object.entries(iletisim).filter(([, v]) => v?.trim());
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isEditing) {
      setEditValues({ ...iletisim } as Record<string, string>);
    }
  }, [isEditing, iletisim]);

  if (entries.length === 0 && !isEditing) return null;

  const labels: Record<string, string> = {
    telefon: 'Telefon',
    email: 'E-posta',
    adres: 'Adres',
    yetkili: 'Yetkili',
  };

  const handleSave = () => {
    if (onSave) {
      onSave('iletisim', iletisim, editValues);
    }
    onToggleEdit?.();
  };

  return (
    <Paper
      p="sm"
      withBorder
      radius="md"
      className="glassy-card-nested"
      style={isCorrected ? { borderColor: 'var(--mantine-color-green-5)' } : undefined}
    >
      <Group justify="space-between" mb="xs">
        <Group gap="xs">
          <ThemeIcon size="sm" variant="light" color="blue">
            <IconPhone size={12} />
          </ThemeIcon>
          <Text size="sm" fw={600}>
            İletişim Bilgileri
          </Text>
          {isCorrected && (
            <Badge size="xs" variant="filled" color="green">
              Düzeltildi
            </Badge>
          )}
        </Group>
        <Group gap={4}>
          {onToggleEdit && !isEditing && (
            <ActionIcon size="xs" variant="subtle" color="gray" onClick={onToggleEdit}>
              <IconEdit size={12} />
            </ActionIcon>
          )}
          {isEditing && (
            <Group gap={4}>
              <Button size="compact-xs" variant="light" color="gray" onClick={onToggleEdit}>
                İptal
              </Button>
              <Button
                size="compact-xs"
                variant="filled"
                color="green"
                onClick={handleSave}
                leftSection={<IconDeviceFloppy size={12} />}
              >
                Kaydet
              </Button>
            </Group>
          )}
        </Group>
      </Group>
      <Stack gap={4}>
        {isEditing
          ? ['telefon', 'email', 'adres', 'yetkili'].map((key) => (
              <Group key={key} gap="xs" wrap="nowrap">
                <Text size="xs" c="dimmed" w={70}>
                  {labels[key] || key}:
                </Text>
                <TextInput
                  size="xs"
                  value={editValues[key] || ''}
                  onChange={(e) => setEditValues({ ...editValues, [key]: e.target.value })}
                  style={{ flex: 1 }}
                />
              </Group>
            ))
          : entries.map(([key, value]) => (
              <Group key={key} gap="xs" wrap="nowrap">
                <Text size="xs" c="dimmed" w={70}>
                  {labels[key] || key}:
                </Text>
                <Text size="xs" style={{ flex: 1 }}>
                  {value}
                </Text>
              </Group>
            ))}
      </Stack>
    </Paper>
  );
}

// Personel Detayları Kartı
export function PersonelCard({
  personel,
  isEditing,
  onToggleEdit,
  onSave,
  isCorrected,
}: {
  personel: PersonelDetay[];
  isEditing?: boolean;
  onToggleEdit?: () => void;
  onSave?: (fieldPath: string, oldValue: unknown, newValue: unknown) => void;
  isCorrected?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editItems, setEditItems] = useState<
    Array<{ pozisyon: string; adet: string; ucret_orani: string }>
  >([]);

  useEffect(() => {
    if (isEditing) {
      setEditItems(
        personel.map((p) => ({
          pozisyon: p.pozisyon,
          adet: String(p.adet || 0),
          ucret_orani: p.ucret_orani || '',
        }))
      );
    }
  }, [isEditing, personel]);

  if (!personel || personel.length === 0) return null;

  // Lokasyonları filtrele, sadece gerçek personel pozisyonlarını göster
  const realPersonel = personel.filter(p => isRealPersonelPosition(p.pozisyon));
  if (realPersonel.length === 0) return null;

  const displayItems = expanded || isEditing ? realPersonel : realPersonel.slice(0, 5);
  const hasMore = realPersonel.length > 5;
  const toplamPersonel = realPersonel.reduce((sum, p) => sum + (Number(p.adet) || 0), 0);

  const handleSave = () => {
    if (onSave) {
      const newValue = editItems
        .filter((p) => p.pozisyon.trim())
        .map((p) => ({
          pozisyon: p.pozisyon,
          adet: Number(p.adet) || 0,
          ucret_orani: p.ucret_orani || undefined,
        }));
      onSave('personel_detaylari', personel, newValue);
    }
    onToggleEdit?.();
  };

  return (
    <Paper
      p="sm"
      withBorder
      radius="md"
      className="glassy-card-nested"
      style={isCorrected ? { borderColor: 'var(--mantine-color-green-5)' } : undefined}
    >
      <Group justify="space-between" mb="xs">
        <Group gap="xs">
          <ThemeIcon size="sm" variant="light" color="indigo">
            <IconUsers size={12} />
          </ThemeIcon>
          <Text size="sm" fw={600}>
            Personel Detayları
          </Text>
          <Badge size="xs" variant="light" color="indigo">
            {toplamPersonel} kişi
          </Badge>
          {isCorrected && (
            <Badge size="xs" variant="filled" color="green">
              Düzeltildi
            </Badge>
          )}
        </Group>
        <Group gap={4}>
          {onToggleEdit && !isEditing && (
            <ActionIcon size="xs" variant="subtle" color="gray" onClick={onToggleEdit}>
              <IconEdit size={12} />
            </ActionIcon>
          )}
          {isEditing ? (
            <Group gap={4}>
              <Button size="compact-xs" variant="light" color="gray" onClick={onToggleEdit}>
                İptal
              </Button>
              <Button
                size="compact-xs"
                variant="filled"
                color="green"
                onClick={handleSave}
                leftSection={<IconDeviceFloppy size={12} />}
              >
                Kaydet
              </Button>
            </Group>
          ) : (
            hasMore && (
              <Button
                size="xs"
                variant="subtle"
                color="indigo"
                onClick={() => setExpanded(!expanded)}
                rightSection={
                  <IconChevronDown
                    size={12}
                    style={{ transform: expanded ? 'rotate(180deg)' : 'none' }}
                  />
                }
              >
                {expanded ? 'Daralt' : `Tümü (${realPersonel.length})`}
              </Button>
            )
          )}
        </Group>
      </Group>
      <ScrollArea.Autosize mah={expanded || isEditing ? 300 : undefined}>
        <Stack gap={4}>
          {isEditing
            ? editItems.map((p, idx) => (
                <Group key={`personel-edit-${idx}`} gap="xs" wrap="nowrap">
                  <TextInput
                    size="xs"
                    value={p.pozisyon}
                    placeholder="Pozisyon"
                    onChange={(e) => {
                      const updated = [...editItems];
                      updated[idx] = { ...updated[idx], pozisyon: e.target.value };
                      setEditItems(updated);
                    }}
                    style={{ flex: 1 }}
                  />
                  <NumberInput
                    size="xs"
                    value={Number(p.adet) || 0}
                    min={0}
                    onChange={(val) => {
                      const updated = [...editItems];
                      updated[idx] = { ...updated[idx], adet: String(val) };
                      setEditItems(updated);
                    }}
                    w={70}
                    suffix=" kişi"
                  />
                  <TextInput
                    size="xs"
                    value={p.ucret_orani}
                    placeholder="Ücret oranı"
                    onChange={(e) => {
                      const updated = [...editItems];
                      updated[idx] = { ...updated[idx], ucret_orani: e.target.value };
                      setEditItems(updated);
                    }}
                    w={90}
                  />
                  <ActionIcon
                    size="xs"
                    variant="subtle"
                    color="red"
                    onClick={() => setEditItems(editItems.filter((_, i) => i !== idx))}
                  >
                    <IconTrash size={10} />
                  </ActionIcon>
                </Group>
              ))
            : displayItems.map((p) => (
                <Group key={`personel-${p.pozisyon}-${p.adet}`} justify="space-between" gap="xs">
                  <Text size="xs">{p.pozisyon}</Text>
                  <Group gap="xs">
                    <Badge size="xs" variant="outline" color="indigo">
                      {p.adet} kişi
                    </Badge>
                    {p.ucret_orani && (
                      <Badge size="xs" variant="light" color="green">
                        {p.ucret_orani}
                      </Badge>
                    )}
                  </Group>
                </Group>
              ))}
        </Stack>
        {isEditing && (
          <Button
            size="compact-xs"
            variant="light"
            color="indigo"
            mt="xs"
            leftSection={<IconPlus size={12} />}
            onClick={() =>
              setEditItems([...editItems, { pozisyon: '', adet: '1', ucret_orani: '' }])
            }
          >
            Yeni Pozisyon Ekle
          </Button>
        )}
      </ScrollArea.Autosize>
    </Paper>
  );
}

// Öğün Bilgileri Kartı
export function OgunBilgileriCard({
  ogunler,
  toplamOgunSayisi,
}: {
  ogunler: OgunBilgisi[];
  toplamOgunSayisi?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  if (!ogunler || ogunler.length === 0) return null;

  // Tablo formatı olan öğünleri tespit et
  const tabloOgunler = ogunler.filter((o) => o.rows && o.headers);
  const flatOgunler = ogunler.filter((o) => o.tur);

  // Toplam hesapla - flat format veya props'tan gelen
  const toplamOgun =
    toplamOgunSayisi ||
    flatOgunler.reduce((sum, o) => sum + (o.miktar || 0), 0);

  // Badge metni
  const badgeText = toplamOgun > 0 ? `${toplamOgun.toLocaleString('tr-TR')} öğün` : `${ogunler.length} tablo`;

  return (
    <Paper p="sm" withBorder radius="md" className="glassy-card-nested">
      <Group justify="space-between" mb="xs">
        <Group gap="xs">
          <ThemeIcon size="sm" variant="light" color="orange">
            <IconToolsKitchen2 size={12} />
          </ThemeIcon>
          <Text size="sm" fw={600}>
            Öğün Bilgileri
          </Text>
          <Badge size="xs" variant="light" color="orange">
            {badgeText}
          </Badge>
        </Group>
        {(tabloOgunler.length > 0 || flatOgunler.length > 6) && (
          <Button
            size="xs"
            variant="subtle"
            color="orange"
            onClick={() => setExpanded(!expanded)}
            rightSection={
              <IconChevronDown
                size={12}
                style={{ transform: expanded ? 'rotate(180deg)' : 'none' }}
              />
            }
          >
            {expanded ? 'Daralt' : 'Detay'}
          </Button>
        )}
      </Group>

      {/* Tablo formatı - Azure'dan gelen öğün dağılım tabloları */}
      {tabloOgunler.length > 0 && (
        <ScrollArea.Autosize mah={expanded ? 400 : 200}>
          <Stack gap="xs">
            {tabloOgunler.map((tablo, tIdx) => {
              const headers = tablo.headers || [];
              const rows = tablo.rows || [];
              const displayRows = expanded ? rows : rows.slice(0, 5);
              const hasMoreRows = rows.length > 5 && !expanded;

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
                        th: { padding: '4px 6px', fontSize: '10px', whiteSpace: 'nowrap' },
                        td: { padding: '3px 6px', fontSize: '10px' },
                      }}
                    >
                      <Table.Thead>
                        <Table.Tr>
                          {headers.map((h, hIdx) => (
                            <Table.Th
                              key={`th-${tIdx}-${hIdx}`}
                              style={hIdx === 0 ? { minWidth: 120 } : { textAlign: 'right', minWidth: 60 }}
                            >
                              {h.replace(/\n.*$/g, '')}
                            </Table.Th>
                          ))}
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {displayRows.map((row, rIdx) => {
                          const firstCol = String(row[0] || '').trim();
                          const isToplam = firstCol.toUpperCase() === 'TOPLAM';
                          return (
                            <Table.Tr
                              key={`tr-${tIdx}-${rIdx}`}
                              fw={isToplam ? 700 : undefined}
                            >
                              {row.map((cell, cIdx) => (
                                <Table.Td
                                  key={`td-${tIdx}-${rIdx}-${cIdx}`}
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
        </ScrollArea.Autosize>
      )}

      {/* Flat format - basit öğün listesi */}
      {flatOgunler.length > 0 && (
        <ScrollArea.Autosize mah={expanded ? 300 : undefined}>
          <SimpleGrid cols={2} spacing="xs">
            {(expanded ? flatOgunler : flatOgunler.slice(0, 6)).map((o) => (
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
        </ScrollArea.Autosize>
      )}
    </Paper>
  );
}

// ═══════════════════════════════════════════════════════════════
// CATERİNG DETAY KARTLARI (Azure v5 - Kategorize)
// ═══════════════════════════════════════════════════════════════

function CateringInfoRow({ label, value, icon }: { label: string; value: string | null | undefined; icon?: React.ReactNode }) {
  if (!value) return null;
  return (
    <Group gap="xs" wrap="nowrap" py={3}>
      {icon && (
        <ThemeIcon size="xs" variant="light" color="gray" radius="xl">
          {icon}
        </ThemeIcon>
      )}
      <Text size="xs" c="dimmed" style={{ minWidth: 100 }}>
        {label}
      </Text>
      <Text size="xs" fw={500} style={{ flex: 1 }}>
        {value}
      </Text>
    </Group>
  );
}

export function CateringDetayKartlari({ analysisSummary }: { analysisSummary?: AnalysisData | null }) {
  if (!analysisSummary) return null;

  const {
    kahvalti_kisi_sayisi,
    ogle_kisi_sayisi,
    aksam_kisi_sayisi,
    diyet_kisi_sayisi,
    hizmet_gun_sayisi,
    mutfak_tipi,
    servis_tipi,
    et_tipi,
    yemek_cesit_sayisi,
    yemek_pisirilecek_yer,
    iscilik_orani,
    dagitim_saatleri,
    dagitim_noktalari,
    ekipman_listesi,
    kalite_standartlari,
    gida_guvenligi_belgeleri,
    malzeme_listesi,
    ogun_dagilimi,
    birim_fiyat_cetveli,
    menu_tablosu,
  } = analysisSummary;

  // Kategori 1: Kişi Dağılımı
  const kisiFields = [kahvalti_kisi_sayisi, ogle_kisi_sayisi, aksam_kisi_sayisi, diyet_kisi_sayisi];
  const hasKisiDagilimi = kisiFields.some(Boolean);

  // Kategori 2: Hizmet & Mutfak
  const hizmetFields = [mutfak_tipi, servis_tipi, et_tipi, yemek_pisirilecek_yer, yemek_cesit_sayisi, hizmet_gun_sayisi];
  const hasHizmetMutfak = hizmetFields.some(Boolean);

  // Kategori 3: Lojistik & Dağıtım
  const lojistikFields = [dagitim_saatleri, dagitim_noktalari, ekipman_listesi];
  const hasLojistik = lojistikFields.some(Boolean);

  // Kategori 4: Kalite & Belgeler
  const kaliteFields = [kalite_standartlari, gida_guvenligi_belgeleri, iscilik_orani];
  const hasKalite = kaliteFields.some(Boolean);

  // Kategori 5: Menü & Fiyat
  const menuFields = [menu_tablosu, malzeme_listesi, birim_fiyat_cetveli, ogun_dagilimi];
  const hasMenuFiyat = menuFields.some(Boolean);

  // Hiçbir kategori dolmamışsa gösterme
  if (!hasKisiDagilimi && !hasHizmetMutfak && !hasLojistik && !hasKalite && !hasMenuFiyat) return null;

  return (
    <>
      {/* Üst Sıra: Kişi Dağılımı + Hizmet & Mutfak */}
      {(hasKisiDagilimi || hasHizmetMutfak) && (
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          {/* Kişi Dağılımı */}
          {hasKisiDagilimi && (
            <Paper p="sm" withBorder radius="md" className="glassy-card-nested">
              <Group gap="xs" mb="xs">
                <ThemeIcon size="sm" variant="light" color="blue">
                  <IconUsers size={12} />
                </ThemeIcon>
                <Text size="sm" fw={600}>
                  Kişi Dağılımı
                </Text>
              </Group>
              <Stack gap={0}>
                <CateringInfoRow label="Kahvaltı" value={kahvalti_kisi_sayisi} />
                <CateringInfoRow label="Öğle" value={ogle_kisi_sayisi} />
                <CateringInfoRow label="Akşam" value={aksam_kisi_sayisi} />
                <CateringInfoRow label="Diyet" value={diyet_kisi_sayisi} />
              </Stack>
            </Paper>
          )}

          {/* Hizmet & Mutfak */}
          {hasHizmetMutfak && (
            <Paper p="sm" withBorder radius="md" className="glassy-card-nested">
              <Group gap="xs" mb="xs">
                <ThemeIcon size="sm" variant="light" color="orange">
                  <IconToolsKitchen2 size={12} />
                </ThemeIcon>
                <Text size="sm" fw={600}>
                  Hizmet & Mutfak
                </Text>
              </Group>
              <Stack gap={0}>
                <CateringInfoRow label="Mutfak Tipi" value={mutfak_tipi} />
                <CateringInfoRow label="Servis Tipi" value={servis_tipi} />
                <CateringInfoRow label="Et Tipi" value={et_tipi} />
                <CateringInfoRow label="Pişirme Yeri" value={yemek_pisirilecek_yer} />
                <CateringInfoRow label="Çeşit Sayısı" value={yemek_cesit_sayisi} />
                <CateringInfoRow label="Hizmet Günü" value={hizmet_gun_sayisi} />
              </Stack>
            </Paper>
          )}
        </SimpleGrid>
      )}

      {/* Orta Sıra: Lojistik + Kalite */}
      {(hasLojistik || hasKalite) && (
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          {/* Lojistik & Dağıtım */}
          {hasLojistik && (
            <Paper p="sm" withBorder radius="md" className="glassy-card-nested">
              <Group gap="xs" mb="xs">
                <ThemeIcon size="sm" variant="light" color="teal">
                  <IconMapPin size={12} />
                </ThemeIcon>
                <Text size="sm" fw={600}>
                  Lojistik & Dağıtım
                </Text>
              </Group>
              <Stack gap={0}>
                <CateringInfoRow label="Dağıtım Saati" value={dagitim_saatleri} />
                <CateringInfoRow label="Dağıtım Noktaları" value={dagitim_noktalari} />
                <CateringInfoRow label="Ekipman" value={ekipman_listesi} />
              </Stack>
            </Paper>
          )}

          {/* Kalite & Belgeler */}
          {hasKalite && (
            <Paper p="sm" withBorder radius="md" className="glassy-card-nested">
              <Group gap="xs" mb="xs">
                <ThemeIcon size="sm" variant="light" color="green">
                  <IconCertificate size={12} />
                </ThemeIcon>
                <Text size="sm" fw={600}>
                  Kalite & Belgeler
                </Text>
              </Group>
              <Stack gap={0}>
                <CateringInfoRow label="Kalite Std." value={kalite_standartlari} />
                <CateringInfoRow label="Gıda Güv." value={gida_guvenligi_belgeleri} />
                <CateringInfoRow label="İşçilik Oranı" value={iscilik_orani} />
              </Stack>
            </Paper>
          )}
        </SimpleGrid>
      )}

      {/* Alt Sıra: Menü & Fiyat (tam genişlik) */}
      {hasMenuFiyat && (
        <Paper p="sm" withBorder radius="md" className="glassy-card-nested">
          <Group gap="xs" mb="xs">
            <ThemeIcon size="sm" variant="light" color="violet">
              <IconClipboardList size={12} />
            </ThemeIcon>
            <Text size="sm" fw={600}>
              Menü & Fiyat Bilgileri
            </Text>
          </Group>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
            <Stack gap={0}>
              <CateringInfoRow label="Öğün Dağılımı" value={ogun_dagilimi} />
              <CateringInfoRow label="Malzeme Listesi" value={malzeme_listesi} />
            </Stack>
            <Stack gap={0}>
              <CateringInfoRow label="Birim Fiyat" value={birim_fiyat_cetveli} />
              <CateringInfoRow label="Menü Tablosu" value={menu_tablosu} />
            </Stack>
          </SimpleGrid>
        </Paper>
      )}
    </>
  );
}

// İş Yerleri Kartı
export function IsYerleriCard({ yerler }: { yerler: string[] }) {
  const [expanded, setExpanded] = useState(false);
  if (!yerler || yerler.length === 0) return null;

  const displayItems = expanded ? yerler : yerler.slice(0, 4);
  const hasMore = yerler.length > 4;

  return (
    <Paper p="sm" withBorder radius="md" className="glassy-card-nested">
      <Group justify="space-between" mb="xs">
        <Group gap="xs">
          <ThemeIcon size="sm" variant="light" color="teal">
            <IconMapPin size={12} />
          </ThemeIcon>
          <Text size="sm" fw={600}>
            İş Yerleri
          </Text>
          <Badge size="xs" variant="light" color="teal">
            {yerler.length} yer
          </Badge>
        </Group>
        {hasMore && (
          <Button
            size="xs"
            variant="subtle"
            color="teal"
            onClick={() => setExpanded(!expanded)}
            rightSection={
              <IconChevronDown
                size={12}
                style={{ transform: expanded ? 'rotate(180deg)' : 'none' }}
              />
            }
          >
            {expanded ? 'Daralt' : `Tümü (${yerler.length})`}
          </Button>
        )}
      </Group>
      <ScrollArea.Autosize mah={expanded ? 250 : undefined}>
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
      </ScrollArea.Autosize>
    </Paper>
  );
}

// Mali Kriterler Kartı
export function MaliKriterlerCard({
  kriterler,
  isEditing,
  onToggleEdit,
  onSave,
  isCorrected,
}: {
  kriterler: MaliKriterler;
  isEditing?: boolean;
  onToggleEdit?: () => void;
  onSave?: (fieldPath: string, oldValue: unknown, newValue: unknown) => void;
  isCorrected?: boolean;
}) {
  const entries = Object.entries(kriterler).filter(([, v]) => v?.trim());
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isEditing) {
      setEditValues({ ...kriterler } as Record<string, string>);
    }
  }, [isEditing, kriterler]);

  if (entries.length === 0 && !isEditing) return null;

  const labels: Record<string, string> = {
    cari_oran: 'Cari Oran',
    ozkaynak_orani: 'Öz Kaynak Oranı',
    is_deneyimi: 'İş Deneyimi',
    ciro_orani: 'Ciro Oranı',
    banka_borc_orani: 'Banka Borcu / Özkaynak',
    toplam_ciro_orani: 'Toplam Ciro Gereksinimi',
    hizmet_ciro_orani: 'Hizmet Cirosu Gereksinimi',
  };

  const handleSave = () => {
    if (onSave) {
      onSave('mali_kriterler', kriterler, editValues);
    }
    onToggleEdit?.();
  };

  return (
    <Paper
      p="sm"
      withBorder
      radius="md"
      className="glassy-card-nested"
      style={isCorrected ? { borderColor: 'var(--mantine-color-green-5)' } : undefined}
    >
      <Group justify="space-between" mb="xs">
        <Group gap="xs">
          <ThemeIcon size="sm" variant="light" color="grape">
            <IconWallet size={12} />
          </ThemeIcon>
          <Text size="sm" fw={600}>
            Mali Yeterlilik Kriterleri
          </Text>
          {isCorrected && (
            <Badge size="xs" variant="filled" color="green">
              Düzeltildi
            </Badge>
          )}
        </Group>
        <Group gap={4}>
          {onToggleEdit && !isEditing && (
            <ActionIcon size="xs" variant="subtle" color="gray" onClick={onToggleEdit}>
              <IconEdit size={12} />
            </ActionIcon>
          )}
          {isEditing && (
            <Group gap={4}>
              <Button size="compact-xs" variant="light" color="gray" onClick={onToggleEdit}>
                İptal
              </Button>
              <Button
                size="compact-xs"
                variant="filled"
                color="green"
                onClick={handleSave}
                leftSection={<IconDeviceFloppy size={12} />}
              >
                Kaydet
              </Button>
            </Group>
          )}
        </Group>
      </Group>
      {isEditing ? (
        <Stack gap="xs">
          {['cari_oran', 'ozkaynak_orani', 'is_deneyimi', 'ciro_orani'].map((key) => (
            <Group key={key} gap="xs">
              <Text size="xs" w={100} c="dimmed">
                {labels[key]}:
              </Text>
              <TextInput
                size="xs"
                value={editValues[key] || ''}
                onChange={(e) => setEditValues({ ...editValues, [key]: e.target.value })}
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
                {labels[key] || key}
              </Text>
              <Text size="sm" fw={600}>
                {value}
              </Text>
            </Box>
          ))}
        </SimpleGrid>
      )}
    </Paper>
  );
}

// Ceza Koşulları Kartı
export function CezaKosullariCard({ cezalar }: { cezalar: CezaKosulu[] }) {
  const [expanded, setExpanded] = useState(false);
  if (!cezalar || cezalar.length === 0) return null;

  const displayItems = expanded ? cezalar : cezalar.slice(0, 4);
  const hasMore = cezalar.length > 4;

  return (
    <Paper
      p="sm"
      withBorder
      radius="md"
      className="glassy-card-nested"
      style={{ borderColor: 'var(--mantine-color-red-6)', background: 'rgba(239, 68, 68, 0.05)' }}
    >
      <Group justify="space-between" mb="xs">
        <Group gap="xs">
          <ThemeIcon size="sm" variant="light" color="red">
            <IconGavel size={12} />
          </ThemeIcon>
          <Text size="sm" fw={600}>
            Ceza Koşulları
          </Text>
          <Badge size="xs" variant="light" color="red">
            {cezalar.length}
          </Badge>
        </Group>
        {hasMore && (
          <Button
            size="xs"
            variant="subtle"
            color="red"
            onClick={() => setExpanded(!expanded)}
            rightSection={
              <IconChevronDown
                size={12}
                style={{ transform: expanded ? 'rotate(180deg)' : 'none' }}
              />
            }
          >
            {expanded ? 'Daralt' : `Tümü (${cezalar.length})`}
          </Button>
        )}
      </Group>
      <ScrollArea.Autosize mah={expanded ? 250 : undefined}>
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
      </ScrollArea.Autosize>
    </Paper>
  );
}

// Fiyat Farkı Kartı
export function FiyatFarkiCard({ fiyatFarki }: { fiyatFarki: FiyatFarki }) {
  if (!fiyatFarki || (!fiyatFarki.formul && !fiyatFarki.katsayilar)) return null;

  const katsayilar = fiyatFarki.katsayilar ? Object.entries(fiyatFarki.katsayilar) : [];

  return (
    <Paper p="sm" withBorder radius="md" className="glassy-card-nested">
      <Group gap="xs" mb="xs">
        <ThemeIcon size="sm" variant="light" color="pink">
          <IconMathFunction size={12} />
        </ThemeIcon>
        <Text size="sm" fw={600}>
          Fiyat Farkı
        </Text>
      </Group>
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
    </Paper>
  );
}

// Gerekli Belgeler Kartı
export function GerekliBelgelerCard({ belgeler }: { belgeler: GerekliBelge[] }) {
  const [expanded, setExpanded] = useState(false);
  if (!belgeler || belgeler.length === 0) return null;

  const displayItems = expanded ? belgeler : belgeler.slice(0, 5);
  const hasMore = belgeler.length > 5;

  return (
    <Paper p="sm" withBorder radius="md" className="glassy-card-nested">
      <Group justify="space-between" mb="xs">
        <Group gap="xs">
          <ThemeIcon size="sm" variant="light" color="lime">
            <IconCertificate size={12} />
          </ThemeIcon>
          <Text size="sm" fw={600}>
            Gerekli Belgeler
          </Text>
          <Badge size="xs" variant="light" color="lime">
            {belgeler.length}
          </Badge>
        </Group>
        {hasMore && (
          <Button
            size="xs"
            variant="subtle"
            color="lime"
            onClick={() => setExpanded(!expanded)}
            rightSection={
              <IconChevronDown
                size={12}
                style={{ transform: expanded ? 'rotate(180deg)' : 'none' }}
              />
            }
          >
            {expanded ? 'Daralt' : `Tümü (${belgeler.length})`}
          </Button>
        )}
      </Group>
      <ScrollArea.Autosize mah={expanded ? 300 : undefined}>
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
      </ScrollArea.Autosize>
    </Paper>
  );
}

// Teminat Oranları Kartı
export function TeminatOranlariCard({
  teminat,
  isEditing,
  onToggleEdit,
  onSave,
  isCorrected,
}: {
  teminat: TeminatOranlari;
  isEditing?: boolean;
  onToggleEdit?: () => void;
  onSave?: (fieldPath: string, oldValue: unknown, newValue: unknown) => void;
  isCorrected?: boolean;
}) {
  const entries = Object.entries(teminat).filter(([, v]) => v?.trim());
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isEditing) {
      setEditValues({ ...teminat } as Record<string, string>);
    }
  }, [isEditing, teminat]);

  if (entries.length === 0 && !isEditing) return null;

  const labels: Record<string, string> = {
    gecici: 'Geçici Teminat',
    kesin: 'Kesin Teminat',
    ek_kesin: 'Ek Kesin Teminat',
  };

  const handleSave = () => {
    if (onSave) {
      onSave('teminat_oranlari', teminat, editValues);
    }
    onToggleEdit?.();
  };

  return (
    <Paper
      p="sm"
      withBorder
      radius="md"
      className="glassy-card-nested"
      style={isCorrected ? { borderColor: 'var(--mantine-color-green-5)' } : undefined}
    >
      <Group justify="space-between" mb="xs">
        <Group gap="xs">
          <ThemeIcon size="sm" variant="light" color="violet">
            <IconShield size={12} />
          </ThemeIcon>
          <Text size="sm" fw={600}>
            Teminat Oranları
          </Text>
          {isCorrected && (
            <Badge size="xs" variant="filled" color="green">
              Düzeltildi
            </Badge>
          )}
        </Group>
        <Group gap={4}>
          {onToggleEdit && !isEditing && (
            <ActionIcon size="xs" variant="subtle" color="gray" onClick={onToggleEdit}>
              <IconEdit size={12} />
            </ActionIcon>
          )}
          {isEditing && (
            <Group gap={4}>
              <Button size="compact-xs" variant="light" color="gray" onClick={onToggleEdit}>
                İptal
              </Button>
              <Button
                size="compact-xs"
                variant="filled"
                color="green"
                onClick={handleSave}
                leftSection={<IconDeviceFloppy size={12} />}
              >
                Kaydet
              </Button>
            </Group>
          )}
        </Group>
      </Group>
      {isEditing ? (
        <Stack gap="xs">
          {['gecici', 'kesin', 'ek_kesin'].map((key) => (
            <Group key={key} gap="xs">
              <Text size="xs" w={100} c="dimmed">
                {labels[key]}:
              </Text>
              <TextInput
                size="xs"
                value={editValues[key] || ''}
                placeholder="ör: %3"
                onChange={(e) => setEditValues({ ...editValues, [key]: e.target.value })}
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
                {labels[key] || key}
              </Text>
              <Text size="lg" fw={700} c="violet">
                {value}
              </Text>
            </Box>
          ))}
        </Group>
      )}
    </Paper>
  );
}

// Servis Saatleri Kartı
export function ServisSaatleriCard({
  saatler,
  isEditing,
  onToggleEdit,
  onSave,
  isCorrected,
}: {
  saatler: ServisSaatleri;
  isEditing?: boolean;
  onToggleEdit?: () => void;
  onSave?: (fieldPath: string, oldValue: unknown, newValue: unknown) => void;
  isCorrected?: boolean;
}) {
  const entries = Object.entries(saatler).filter(([, v]) => v?.trim());
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isEditing) {
      setEditValues({ ...saatler } as Record<string, string>);
    }
  }, [isEditing, saatler]);

  if (entries.length === 0 && !isEditing) return null;

  const labels: Record<string, string> = {
    kahvalti: 'Kahvaltı',
    ogle: 'Öğle',
    aksam: 'Akşam',
  };

  const handleSave = () => {
    if (onSave) {
      onSave('servis_saatleri', saatler, editValues);
    }
    onToggleEdit?.();
  };

  return (
    <Paper
      p="sm"
      withBorder
      radius="md"
      className="glassy-card-nested"
      style={isCorrected ? { borderColor: 'var(--mantine-color-green-5)' } : undefined}
    >
      <Group justify="space-between" mb="xs">
        <Group gap="xs">
          <ThemeIcon size="sm" variant="light" color="cyan">
            <IconClock size={12} />
          </ThemeIcon>
          <Text size="sm" fw={600}>
            Servis Saatleri
          </Text>
          {isCorrected && (
            <Badge size="xs" variant="filled" color="green">
              Düzeltildi
            </Badge>
          )}
        </Group>
        <Group gap={4}>
          {onToggleEdit && !isEditing && (
            <ActionIcon size="xs" variant="subtle" color="gray" onClick={onToggleEdit}>
              <IconEdit size={12} />
            </ActionIcon>
          )}
          {isEditing && (
            <Group gap={4}>
              <Button size="compact-xs" variant="light" color="gray" onClick={onToggleEdit}>
                İptal
              </Button>
              <Button
                size="compact-xs"
                variant="filled"
                color="green"
                onClick={handleSave}
                leftSection={<IconDeviceFloppy size={12} />}
              >
                Kaydet
              </Button>
            </Group>
          )}
        </Group>
      </Group>
      {isEditing ? (
        <Stack gap="xs">
          {['kahvalti', 'ogle', 'aksam'].map((key) => (
            <Group key={key} gap="xs">
              <Text size="xs" w={70} c="dimmed">
                {labels[key] || key}:
              </Text>
              <TextInput
                size="xs"
                value={editValues[key] || ''}
                placeholder="ör: 07:00 - 09:00"
                onChange={(e) => setEditValues({ ...editValues, [key]: e.target.value })}
                style={{ flex: 1 }}
              />
            </Group>
          ))}
        </Stack>
      ) : (
        <Group gap="md">
          {entries.map(([key, value]) => (
            <Badge
              key={key}
              size="lg"
              variant="light"
              color="cyan"
              leftSection={<IconClock size={12} />}
            >
              {labels[key] || key}: {value}
            </Badge>
          ))}
        </Group>
      )}
    </Paper>
  );
}

// Benzer İş Tanımı Kartı
export function BenzerIsTanimiCard({ tanim }: { tanim: string }) {
  if (!tanim || !tanim.trim()) return null;

  return (
    <Paper p="sm" withBorder radius="md" className="glassy-card-nested">
      <Group gap="xs" mb="xs">
        <ThemeIcon size="sm" variant="light" color="gray">
          <IconInfoCircle size={12} />
        </ThemeIcon>
        <Text size="sm" fw={600}>
          Benzer İş Tanımı
        </Text>
      </Group>
      <Text size="xs" c="dimmed" style={{ lineHeight: 1.6 }}>
        {tanim}
      </Text>
    </Paper>
  );
}
