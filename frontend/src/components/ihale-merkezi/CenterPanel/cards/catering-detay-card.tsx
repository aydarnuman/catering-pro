'use client';

import { Badge, Box, Button, Group, Stack, Text } from '@mantine/core';
import { IconChevronDown, IconToolsKitchen2 } from '@tabler/icons-react';
import { useState } from 'react';
import type { AnalysisData } from '../../types';
import { AnalysisDetailModal } from './AnalysisDetailModal';
import { ExpandableCardShell } from './ExpandableCardShell';

// ─── Kategori Tanimlari ─────────────────────────────────────────

const SECTION_LABELS: Record<string, { label: string; color: string }> = {
  kisi: { label: 'Kişi Dağılımı', color: 'blue' },
  hizmet: { label: 'Hizmet & Mutfak', color: 'orange' },
  lojistik: { label: 'Lojistik', color: 'teal' },
  kalite: { label: 'Kalite & Standartlar', color: 'green' },
  menu: { label: 'Menü & Fiyat', color: 'grape' },
};

type InfoItem = {
  label: string;
  value: string | number;
  section: string;
  fieldKey: string;
  isLong: boolean;
};

function summarizeValue(value: string | number): string {
  const str = String(value);
  if (str.length <= 80) return str;
  const items = str.split(/[,;\n]/).filter((s) => s.trim());
  if (items.length >= 3) return `${items.length} kalem`;
  return `${str.substring(0, 75)}...`;
}

// ─── CateringDetayKartlari ──────────────────────────────────────

export function CateringDetayKartlari({ analysisSummary }: { analysisSummary?: AnalysisData | null }) {
  const [expanded, setExpanded] = useState(false);
  const [modalField, setModalField] = useState<{ key: string; value: string } | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

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

  const allItems: InfoItem[] = [
    {
      label: 'Kahvaltı',
      value: kahvalti_kisi_sayisi ?? '',
      section: 'kisi',
      fieldKey: 'kahvalti_kisi_sayisi',
      isLong: false,
    },
    { label: 'Öğle', value: ogle_kisi_sayisi ?? '', section: 'kisi', fieldKey: 'ogle_kisi_sayisi', isLong: false },
    { label: 'Akşam', value: aksam_kisi_sayisi ?? '', section: 'kisi', fieldKey: 'aksam_kisi_sayisi', isLong: false },
    { label: 'Diyet', value: diyet_kisi_sayisi ?? '', section: 'kisi', fieldKey: 'diyet_kisi_sayisi', isLong: false },
    {
      label: 'Mutfak Tipi',
      value: mutfak_tipi ?? '',
      section: 'hizmet',
      fieldKey: 'mutfak_tipi',
      isLong: String(mutfak_tipi || '').length > 80,
    },
    {
      label: 'Servis Tipi',
      value: servis_tipi ?? '',
      section: 'hizmet',
      fieldKey: 'servis_tipi',
      isLong: String(servis_tipi || '').length > 80,
    },
    {
      label: 'Et Tipi',
      value: et_tipi ?? '',
      section: 'hizmet',
      fieldKey: 'et_tipi',
      isLong: String(et_tipi || '').length > 80,
    },
    {
      label: 'Pişirme Yeri',
      value: yemek_pisirilecek_yer ?? '',
      section: 'hizmet',
      fieldKey: 'yemek_pisirilecek_yer',
      isLong: String(yemek_pisirilecek_yer || '').length > 80,
    },
    {
      label: 'Çeşit Sayısı',
      value: yemek_cesit_sayisi ?? '',
      section: 'hizmet',
      fieldKey: 'yemek_cesit_sayisi',
      isLong: false,
    },
    {
      label: 'Hizmet Günü',
      value: hizmet_gun_sayisi ?? '',
      section: 'hizmet',
      fieldKey: 'hizmet_gun_sayisi',
      isLong: false,
    },
    {
      label: 'Dağıtım Saati',
      value: dagitim_saatleri ?? '',
      section: 'lojistik',
      fieldKey: 'dagitim_saatleri',
      isLong: String(dagitim_saatleri || '').length > 80,
    },
    {
      label: 'Dağıtım Noktaları',
      value: dagitim_noktalari ?? '',
      section: 'lojistik',
      fieldKey: 'dagitim_noktalari',
      isLong: String(dagitim_noktalari || '').length > 80,
    },
    {
      label: 'Ekipman',
      value: ekipman_listesi ?? '',
      section: 'lojistik',
      fieldKey: 'ekipman_listesi',
      isLong: String(ekipman_listesi || '').length > 80,
    },
    {
      label: 'Kalite Std.',
      value: kalite_standartlari ?? '',
      section: 'kalite',
      fieldKey: 'kalite_standartlari',
      isLong: String(kalite_standartlari || '').length > 80,
    },
    {
      label: 'Gıda Güv.',
      value: gida_guvenligi_belgeleri ?? '',
      section: 'kalite',
      fieldKey: 'gida_guvenligi_belgeleri',
      isLong: String(gida_guvenligi_belgeleri || '').length > 80,
    },
    { label: 'İşçilik Oranı', value: iscilik_orani ?? '', section: 'kalite', fieldKey: 'iscilik_orani', isLong: false },
    {
      label: 'Öğün Dağılımı',
      value: ogun_dagilimi ?? '',
      section: 'menu',
      fieldKey: 'ogun_dagilimi',
      isLong: String(ogun_dagilimi || '').length > 80,
    },
    {
      label: 'Malzeme Listesi',
      value: malzeme_listesi ?? '',
      section: 'menu',
      fieldKey: 'malzeme_listesi',
      isLong: String(malzeme_listesi || '').length > 80,
    },
    {
      label: 'Birim Fiyat',
      value: birim_fiyat_cetveli ?? '',
      section: 'menu',
      fieldKey: 'birim_fiyat_cetveli',
      isLong: String(birim_fiyat_cetveli || '').length > 80,
    },
    {
      label: 'Menü Tablosu',
      value: menu_tablosu ?? '',
      section: 'menu',
      fieldKey: 'menu_tablosu',
      isLong: String(menu_tablosu || '').length > 80,
    },
  ];

  const filledItems = allItems.filter((item) => item.value !== null && item.value !== undefined && item.value !== '');
  if (filledItems.length === 0) return null;

  const sections = ['kisi', 'hizmet', 'lojistik', 'kalite', 'menu'];
  const groupedSections = sections
    .map((s) => ({ key: s, ...SECTION_LABELS[s], items: filledItems.filter((i) => i.section === s) }))
    .filter((s) => s.items.length > 0);

  const totalFilled = filledItems.length;
  const hasMore = totalFilled > 8;
  const kisiSection = groupedSections.find((s) => s.key === 'kisi');
  const otherSections = groupedSections.filter((s) => s.key !== 'kisi');

  return (
    <>
      <ExpandableCardShell
        title="Catering Detayları"
        icon={<IconToolsKitchen2 size={12} />}
        color="orange"
        badge={`${totalFilled} alan`}
        onOpenDetail={() => setDetailOpen(true)}
      >
        <Stack gap="xs">
          {/* Kisi Dagilimi - badge olarak */}
          {kisiSection && kisiSection.items.length > 0 && (
            <Group gap="xs" wrap="wrap">
              {kisiSection.items.map((item) => (
                <Badge key={`kisi-${item.label}`} size="sm" variant="light" color="blue">
                  {item.label}:{' '}
                  {typeof item.value === 'number' ? Number(item.value).toLocaleString('tr-TR') : item.value} kişi
                </Badge>
              ))}
            </Group>
          )}

          {/* Diger kategoriler */}
          {(expanded ? otherSections : otherSections.slice(0, 2)).map((section) => (
            <Box key={section.key}>
              <Text size="xs" c="dimmed" fw={600} mb={4} tt="uppercase" style={{ letterSpacing: 0.5 }}>
                {section.label}
              </Text>
              <Stack gap={0}>
                {(expanded ? section.items : section.items.slice(0, 3)).map((item) => {
                  const strValue = String(item.value);
                  const clickable = item.isLong;
                  return (
                    <Group
                      key={`cd-${item.fieldKey}`}
                      gap="xs"
                      wrap="nowrap"
                      py={3}
                      style={clickable ? { cursor: 'pointer', borderRadius: 4 } : undefined}
                      className={clickable ? 'catering-detail-row-hover' : undefined}
                      onClick={clickable ? () => setModalField({ key: item.fieldKey, value: strValue }) : undefined}
                    >
                      <Text size="xs" c="dimmed" style={{ minWidth: 95, flexShrink: 0 }}>
                        {item.label}
                      </Text>
                      <Text size="xs" fw={500} style={{ flex: 1 }} lineClamp={2}>
                        {clickable ? summarizeValue(item.value) : strValue}
                      </Text>
                      {clickable && (
                        <IconChevronDown
                          size={10}
                          style={{ transform: 'rotate(-90deg)', flexShrink: 0, opacity: 0.5 }}
                        />
                      )}
                    </Group>
                  );
                })}
              </Stack>
            </Box>
          ))}

          {hasMore && (
            <Button
              size="xs"
              variant="subtle"
              color="orange"
              onClick={() => setExpanded(!expanded)}
              rightSection={<IconChevronDown size={12} style={{ transform: expanded ? 'rotate(180deg)' : 'none' }} />}
            >
              {expanded ? 'Daralt' : `Tümü (${totalFilled})`}
            </Button>
          )}
        </Stack>
      </ExpandableCardShell>

      {/* Tek alan detay modal */}
      {modalField && (
        <AnalysisDetailModal
          opened={!!modalField}
          onClose={() => setModalField(null)}
          cardType="catering_detay"
          title={modalField.key.replace(/_/g, ' ')}
          icon={<IconToolsKitchen2 size={16} />}
          color="orange"
          data={modalField.value}
        />
      )}

      {/* Tum veri detay modal */}
      <AnalysisDetailModal
        opened={detailOpen}
        onClose={() => setDetailOpen(false)}
        cardType="catering_detay"
        title="Catering Detayları"
        icon={<IconToolsKitchen2 size={16} />}
        color="orange"
        data={filledItems.reduce(
          (acc, item) => {
            acc[item.label] = item.value;
            return acc;
          },
          {} as Record<string, string | number>
        )}
      />
    </>
  );
}
