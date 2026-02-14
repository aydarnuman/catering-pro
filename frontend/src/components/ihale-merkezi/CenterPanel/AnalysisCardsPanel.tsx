'use client';

import { Box, Checkbox, Group as MantineGroup, Paper, SegmentedControl, Stack, Text, ThemeIcon } from '@mantine/core';
import { IconBuildingBank, IconClipboardList, IconFolder, IconSettings } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import type { AnalysisData } from '../types';
import { getAnalysisCardsForCategory } from '../utils/selection-helpers';
import {
  BenzerIsTanimiCard,
  BirimFiyatlarCard,
  CateringDetayKartlari,
  CezaKosullariCard,
  EksikBilgilerCard,
  FiyatFarkiCard,
  GerekliBelgelerCard,
  GramajBilgileriCard,
  IletisimCard,
  IsYerleriCard,
  MaliKriterlerCard,
  OgunBilgileriCard,
  OnemliNotlarCard,
  PersonelCard,
  ServisSaatleriCard,
  TakvimCard,
  TeknikSartlarCard,
  TeminatOranlariCard,
} from './cards';
import { normalizeAnalysisData } from './normalizeAnalysis';

// ─── Category Types ────────────────────────────────────────────
type CategoryTab = 'tumu' | 'operasyonel' | 'mali' | 'teknik' | 'belgeler';

interface AnalysisCardsPanelProps {
  analysisSummary?: AnalysisData;
  // HITL correction system
  editingCards: Set<string>;
  toggleCardEdit: (cardName: string) => void;
  saveCorrection: (data: { field_path: string; old_value: unknown; new_value: unknown }) => Promise<boolean>;
  getCorrectionForField: (field: string) => unknown;
  onRefreshData?: () => void;
  // Checkbox selection system
  selectedCards?: Set<string>;
  onToggleCard?: (fieldPath: string) => void;
  onToggleCategory?: (category: string) => void;
  showCheckboxes?: boolean;
}

/**
 * Eksik bilgiler listesinden, aslında mevcut olan alanları filtrele.
 * AI bazen bir alanı hem çıkarır hem de eksik diye işaretler.
 */
function filterEksikBilgiler(eksikBilgiler: string[], summary: AnalysisData): string[] {
  const normalize = (s: string) =>
    s
      .replace(/İ/g, 'i')
      .replace(/I/g, 'ı')
      .toLowerCase()
      .replace(/[^a-zçğıöşü0-9]/g, '');

  const fieldChecks: Array<{ keywords: string[]; check: () => boolean }> = [
    {
      keywords: ['iletişim', 'iletisim', 'telefon', 'eposta', 'e-posta', 'adres'],
      check: () => {
        const c = summary.iletisim;
        return !!(c && (c.telefon || c.email || c.adres || c.yetkili));
      },
    },
    {
      keywords: ['servis saat', 'servis_saat', 'öğün saat', 'yemek saat'],
      check: () => {
        const s = summary.servis_saatleri;
        return !!(s && Object.keys(s).length > 0);
      },
    },
    {
      keywords: ['personel', 'aşçı', 'asci', 'diyetisyen', 'gıda mühendis', 'gida muhendis', 'personel detay'],
      check: () => {
        const p = summary.personel_detaylari;
        return !!(p && Array.isArray(p) && p.length > 0);
      },
    },
    {
      keywords: ['kişi sayı', 'kisi sayi', 'günlük öğün', 'gunluk ogun', 'öğün sayı', 'ogun sayi'],
      check: () => {
        const o = summary.ogun_bilgileri;
        return !!(o && Array.isArray(o) && o.length > 0);
      },
    },
    {
      keywords: ['iş yeri', 'is yeri', 'lokasyon', 'teslim yer'],
      check: () => {
        const iy = summary.is_yerleri;
        return !!(iy && Array.isArray(iy) && iy.length > 0);
      },
    },
    {
      keywords: ['mali kriter', 'mali yeterli', 'bilanço', 'bilanco', 'ciro'],
      check: () => {
        const mk = summary.mali_kriterler;
        return !!(mk && (mk.cari_oran || mk.ozkaynak_orani || mk.is_deneyimi || mk.ciro_orani));
      },
    },
    {
      keywords: ['gerekli belge', 'belgeler listesi', 'istenen belge'],
      check: () => {
        const gb = summary.gerekli_belgeler;
        return !!(gb && Array.isArray(gb) && gb.length > 0);
      },
    },
    {
      keywords: ['teminat', 'geçici teminat', 'kesin teminat'],
      check: () => {
        const t = summary.teminat_oranlari;
        return !!(t && (t.gecici || t.kesin || t.ek_kesin));
      },
    },
    {
      keywords: ['birim fiyat'],
      check: () => {
        const bf = summary.birim_fiyatlar;
        return !!(bf && Array.isArray(bf) && bf.length > 0);
      },
    },
    {
      keywords: ['teknik şart', 'teknik sart'],
      check: () => {
        const ts = summary.teknik_sartlar;
        return !!(ts && Array.isArray(ts) && ts.length > 0);
      },
    },
    {
      keywords: ['ceza', 'ceza koşul', 'ceza kosul'],
      check: () => {
        const ck = summary.ceza_kosullari;
        return !!(ck && Array.isArray(ck) && ck.length > 0);
      },
    },
    {
      keywords: ['fiyat fark', 'fiyat_fark'],
      check: () => {
        const ff = summary.fiyat_farki;
        return !!(ff && (ff.formul || ff.katsayilar));
      },
    },
  ];

  return eksikBilgiler.filter((item) => {
    const normalizedItem = normalize(item);
    for (const fc of fieldChecks) {
      const matches = fc.keywords.some((kw) => normalizedItem.includes(normalize(kw)));
      if (matches && fc.check()) {
        return false;
      }
    }
    return true;
  });
}

export function AnalysisCardsPanel({
  analysisSummary: rawAnalysisSummary,
  editingCards,
  toggleCardEdit,
  saveCorrection,
  getCorrectionForField,
  onRefreshData,
  selectedCards,
  onToggleCard,
  onToggleCategory,
  showCheckboxes = false,
}: AnalysisCardsPanelProps) {
  const [activeCategory, setActiveCategory] = useState<CategoryTab>('tumu');

  const analysisSummary = useMemo(() => normalizeAnalysisData(rawAnalysisSummary), [rawAnalysisSummary]);

  // ─── Count cards per category ──────────────────────────────────
  const categoryCounts = useMemo(() => {
    if (!analysisSummary) return { operasyonel: 0, mali: 0, teknik: 0, belgeler: 0 };

    let operasyonel = 0;
    let mali = 0;
    let teknik = 0;
    let belgeler = 0;

    if (analysisSummary.takvim?.length) operasyonel++;
    if (analysisSummary.servis_saatleri && Object.keys(analysisSummary.servis_saatleri).length > 0) operasyonel++;
    if (analysisSummary.personel_detaylari?.length) operasyonel++;
    if (analysisSummary.ogun_bilgileri?.length) operasyonel++;
    if (analysisSummary.is_yerleri?.length) operasyonel++;
    if (analysisSummary.gramaj_gruplari?.length) operasyonel++;
    if (
      analysisSummary.kahvalti_kisi_sayisi ||
      analysisSummary.ogle_kisi_sayisi ||
      analysisSummary.aksam_kisi_sayisi ||
      analysisSummary.mutfak_tipi ||
      analysisSummary.dagitim_saatleri ||
      analysisSummary.kalite_standartlari ||
      analysisSummary.ogun_dagilimi
    )
      operasyonel++;

    if (analysisSummary.birim_fiyatlar?.length) mali++;
    if (analysisSummary.teminat_oranlari && Object.keys(analysisSummary.teminat_oranlari).length > 0) mali++;
    if (analysisSummary.mali_kriterler && Object.keys(analysisSummary.mali_kriterler).length > 0) mali++;
    if (analysisSummary.fiyat_farki && (analysisSummary.fiyat_farki.formul || analysisSummary.fiyat_farki.katsayilar))
      mali++;
    if (analysisSummary.ceza_kosullari?.length) mali++;
    if (analysisSummary.odeme_kosullari) mali++;
    if (analysisSummary.is_artisi) mali++;

    if (analysisSummary.teknik_sartlar?.length) teknik++;
    if (analysisSummary.benzer_is_tanimi) teknik++;
    if (analysisSummary.onemli_notlar?.length) teknik++;
    if (analysisSummary.operasyonel_kurallar) teknik++;

    if (analysisSummary.gerekli_belgeler?.length) belgeler++;
    if (analysisSummary.iletisim && Object.keys(analysisSummary.iletisim).length > 0) belgeler++;
    if (analysisSummary.eksik_bilgiler?.length) {
      const filtered = filterEksikBilgiler(analysisSummary.eksik_bilgiler, analysisSummary);
      if (filtered.length > 0) belgeler++;
    }

    return { operasyonel, mali, teknik, belgeler };
  }, [analysisSummary]);

  const showCategory = (cat: CategoryTab) => activeCategory === 'tumu' || activeCategory === cat;

  // Category header with optional master checkbox
  const CategoryHeader = ({ category, icon, label }: { category: string; icon: React.ReactNode; label: string }) => {
    if (!showCheckboxes || !onToggleCategory) return null;

    const categoryCards = getAnalysisCardsForCategory(analysisSummary, category);
    if (categoryCards.length === 0) return null;

    const allSelected = selectedCards ? categoryCards.every((path) => selectedCards.has(path)) : false;
    const someSelected = selectedCards ? categoryCards.some((path) => selectedCards.has(path)) : false;

    return (
      <Paper p="xs" mb="sm" withBorder style={{ background: 'rgba(255, 255, 255, 0.02)' }}>
        <MantineGroup gap="xs">
          <Checkbox
            checked={allSelected}
            indeterminate={someSelected && !allSelected}
            onChange={() => onToggleCategory(category)}
          />
          <ThemeIcon size="sm" variant="light" color={getCategoryColor(category)}>
            {icon}
          </ThemeIcon>
          <Text size="sm" fw={600}>
            {label} ({categoryCards.length})
          </Text>
        </MantineGroup>
      </Paper>
    );
  };

  function getCategoryColor(category: string) {
    const colors: Record<string, string> = {
      operasyonel: 'blue',
      mali: 'green',
      teknik: 'yellow',
      belgeler: 'violet',
    };
    return colors[category] || 'gray';
  }

  const makeSaveHandler = (_fieldName: string) => async (fieldPath: string, oldValue: unknown, newValue: unknown) => {
    await saveCorrection({
      field_path: fieldPath,
      old_value: oldValue,
      new_value: newValue,
    });
    onRefreshData?.();
  };

  // Delete handler: Kartın verisini temizlemek için saveCorrection'ı null/boş değer ile çağırır
  const makeDeleteHandler = (fieldPath: string, currentValue: unknown) => async () => {
    // Array ise boş array, object ise null ile temizle
    const emptyValue = Array.isArray(currentValue) ? [] : null;
    await saveCorrection({
      field_path: fieldPath,
      old_value: currentValue,
      new_value: emptyValue,
    });
    onRefreshData?.();
  };

  if (!analysisSummary) {
    return (
      <Paper p="md" withBorder radius="md" ta="center">
        <Text size="sm" c="dimmed">
          Bu ihale için henüz analiz yapılmamış.
        </Text>
        <Text size="xs" c="dimmed" mt="xs">
          Dökümanlar sekmesinden dökümanları indirip analiz edebilirsiniz.
        </Text>
      </Paper>
    );
  }

  return (
    <Stack gap="md" style={{ maxWidth: 820, margin: '0 auto', width: '100%' }}>
      {/* Category Filter */}
      <Box
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: 'rgba(24, 24, 27, 0.95)',
          backdropFilter: 'blur(8px)',
          marginLeft: -12,
          marginRight: -12,
          paddingLeft: 12,
          paddingRight: 12,
          paddingTop: 4,
          paddingBottom: 8,
        }}
      >
        <SegmentedControl
          value={activeCategory}
          onChange={(val) => setActiveCategory(val as CategoryTab)}
          fullWidth
          size="xs"
          data={[
            { label: 'Tümü', value: 'tumu' },
            {
              label: `Operasyonel${categoryCounts.operasyonel > 0 ? ` (${categoryCounts.operasyonel})` : ''}`,
              value: 'operasyonel',
            },
            {
              label: `Mali${categoryCounts.mali > 0 ? ` (${categoryCounts.mali})` : ''}`,
              value: 'mali',
            },
            {
              label: `Teknik${categoryCounts.teknik > 0 ? ` (${categoryCounts.teknik})` : ''}`,
              value: 'teknik',
            },
            {
              label: `Belgeler${categoryCounts.belgeler > 0 ? ` (${categoryCounts.belgeler})` : ''}`,
              value: 'belgeler',
            },
          ]}
          styles={{
            root: {
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid var(--mantine-color-default-border)',
              borderRadius: 8,
            },
            label: {
              fontSize: 11,
              fontWeight: 500,
              padding: '4px 6px',
            },
          }}
        />
      </Box>

      {/* ─── OPERASYONEL ──────────────────────────────────────────── */}
      {showCategory('operasyonel') && (
        <>
          <CategoryHeader category="operasyonel" icon={<IconSettings size={14} />} label="Operasyonel" />
          {analysisSummary?.takvim && analysisSummary.takvim.length > 0 && (
            <TakvimCard
              takvim={analysisSummary.takvim}
              showCheckbox={showCheckboxes}
              isSelected={selectedCards?.has('takvim')}
              onToggleSelect={() => onToggleCard?.('takvim')}
            />
          )}

          {analysisSummary?.servis_saatleri && Object.keys(analysisSummary.servis_saatleri).length > 0 && (
            <ServisSaatleriCard
              saatler={analysisSummary.servis_saatleri}
              isEditing={editingCards.has('servis_saatleri')}
              onToggleEdit={() => toggleCardEdit('servis_saatleri')}
              onSave={makeSaveHandler('servis_saatleri')}
              onDelete={makeDeleteHandler('servis_saatleri', analysisSummary.servis_saatleri)}
              isCorrected={!!getCorrectionForField('servis_saatleri')}
              showCheckbox={showCheckboxes}
              isSelected={selectedCards?.has('servis_saatleri')}
              onToggleSelect={() => onToggleCard?.('servis_saatleri')}
            />
          )}

          {analysisSummary?.personel_detaylari && analysisSummary.personel_detaylari.length > 0 && (
            <PersonelCard
              personel={analysisSummary.personel_detaylari}
              isEditing={editingCards.has('personel_detaylari')}
              onToggleEdit={() => toggleCardEdit('personel_detaylari')}
              onSave={makeSaveHandler('personel_detaylari')}
              onDelete={makeDeleteHandler('personel_detaylari', analysisSummary.personel_detaylari)}
              isCorrected={!!getCorrectionForField('personel_detaylari')}
              showCheckbox={showCheckboxes}
              isSelected={selectedCards?.has('personel_detaylari')}
              onToggleSelect={() => onToggleCard?.('personel_detaylari')}
            />
          )}

          {analysisSummary?.ogun_bilgileri && analysisSummary.ogun_bilgileri.length > 0 && (
            <OgunBilgileriCard
              ogunler={analysisSummary.ogun_bilgileri}
              toplamOgunSayisi={analysisSummary.toplam_ogun_sayisi}
              isEditing={editingCards.has('ogun_bilgileri')}
              onToggleEdit={() => toggleCardEdit('ogun_bilgileri')}
              onSave={makeSaveHandler('ogun_bilgileri')}
              onDelete={makeDeleteHandler('ogun_bilgileri', analysisSummary.ogun_bilgileri)}
              isCorrected={!!getCorrectionForField('ogun_bilgileri')}
              showCheckbox={showCheckboxes}
              isSelected={selectedCards?.has('ogun_bilgileri')}
              onToggleSelect={() => onToggleCard?.('ogun_bilgileri')}
            />
          )}

          <CateringDetayKartlari analysisSummary={analysisSummary} />

          {analysisSummary?.is_yerleri && analysisSummary.is_yerleri.length > 0 && (
            <IsYerleriCard
              yerler={analysisSummary.is_yerleri}
              showCheckbox={showCheckboxes}
              isSelected={selectedCards?.has('is_yerleri')}
              onToggleSelect={() => onToggleCard?.('is_yerleri')}
            />
          )}

          {analysisSummary?.gramaj_gruplari && analysisSummary.gramaj_gruplari.length > 0 && (
            <GramajBilgileriCard
              gramajlar={analysisSummary.gramaj_gruplari}
              isEditing={editingCards.has('gramaj_gruplari')}
              onToggleEdit={() => toggleCardEdit('gramaj_gruplari')}
              onSave={makeSaveHandler('gramaj_gruplari')}
              onDelete={makeDeleteHandler('gramaj_gruplari', analysisSummary.gramaj_gruplari)}
              isCorrected={!!getCorrectionForField('gramaj_gruplari')}
              showCheckbox={showCheckboxes}
              isSelected={selectedCards?.has('gramaj_gruplari')}
              onToggleSelect={() => onToggleCard?.('gramaj_gruplari')}
            />
          )}

          {activeCategory === 'operasyonel' && categoryCounts.operasyonel === 0 && (
            <Paper p="md" withBorder radius="md" ta="center">
              <ThemeIcon size="lg" variant="light" color="gray" radius="xl" mx="auto" mb="xs">
                <IconSettings size={18} />
              </ThemeIcon>
              <Text size="sm" c="dimmed">
                Bu kategoride henüz veri yok.
              </Text>
            </Paper>
          )}
        </>
      )}

      {/* ─── MALİ & HUKUKİ ────────────────────────────────────────── */}
      {showCategory('mali') && (
        <>
          <CategoryHeader category="mali" icon={<IconBuildingBank size={14} />} label="Mali" />
          {analysisSummary?.birim_fiyatlar && analysisSummary.birim_fiyatlar.length > 0 && (
            <BirimFiyatlarCard
              birimFiyatlar={analysisSummary.birim_fiyatlar}
              isEditing={editingCards.has('birim_fiyatlar')}
              onToggleEdit={() => toggleCardEdit('birim_fiyatlar')}
              onSave={makeSaveHandler('birim_fiyatlar')}
              onDelete={makeDeleteHandler('birim_fiyatlar', analysisSummary.birim_fiyatlar)}
              isCorrected={!!getCorrectionForField('birim_fiyatlar')}
              showCheckbox={showCheckboxes}
              isSelected={selectedCards?.has('birim_fiyatlar')}
              onToggleSelect={() => onToggleCard?.('birim_fiyatlar')}
            />
          )}

          {analysisSummary?.teminat_oranlari && Object.keys(analysisSummary.teminat_oranlari).length > 0 && (
            <TeminatOranlariCard
              teminat={analysisSummary.teminat_oranlari}
              isEditing={editingCards.has('teminat_oranlari')}
              onToggleEdit={() => toggleCardEdit('teminat_oranlari')}
              onSave={makeSaveHandler('teminat_oranlari')}
              onDelete={makeDeleteHandler('teminat_oranlari', analysisSummary.teminat_oranlari)}
              isCorrected={!!getCorrectionForField('teminat_oranlari')}
              showCheckbox={showCheckboxes}
              isSelected={selectedCards?.has('teminat_oranlari')}
              onToggleSelect={() => onToggleCard?.('teminat_oranlari')}
            />
          )}

          {analysisSummary?.mali_kriterler && Object.keys(analysisSummary.mali_kriterler).length > 0 && (
            <MaliKriterlerCard
              kriterler={analysisSummary.mali_kriterler}
              isEditing={editingCards.has('mali_kriterler')}
              onToggleEdit={() => toggleCardEdit('mali_kriterler')}
              onSave={makeSaveHandler('mali_kriterler')}
              onDelete={makeDeleteHandler('mali_kriterler', analysisSummary.mali_kriterler)}
              isCorrected={!!getCorrectionForField('mali_kriterler')}
              showCheckbox={showCheckboxes}
              isSelected={selectedCards?.has('mali_kriterler')}
              onToggleSelect={() => onToggleCard?.('mali_kriterler')}
            />
          )}

          {analysisSummary?.fiyat_farki &&
            (analysisSummary.fiyat_farki.formul || analysisSummary.fiyat_farki.katsayilar) && (
              <FiyatFarkiCard
                fiyatFarki={analysisSummary.fiyat_farki}
                showCheckbox={showCheckboxes}
                isSelected={selectedCards?.has('fiyat_farki')}
                onToggleSelect={() => onToggleCard?.('fiyat_farki')}
              />
            )}

          {analysisSummary?.ceza_kosullari && analysisSummary.ceza_kosullari.length > 0 && (
            <CezaKosullariCard
              cezalar={analysisSummary.ceza_kosullari}
              showCheckbox={showCheckboxes}
              isSelected={selectedCards?.has('ceza_kosullari')}
              onToggleSelect={() => onToggleCard?.('ceza_kosullari')}
            />
          )}

          {analysisSummary?.odeme_kosullari && (
            <Paper p="sm" withBorder radius="md" className="glassy-card-nested">
              <Stack gap={4}>
                <Text size="sm" fw={600}>
                  Ödeme Koşulları
                </Text>
                {analysisSummary.odeme_kosullari.hakedis_suresi && (
                  <Text size="xs" c="dimmed">
                    Hakediş Süresi: {analysisSummary.odeme_kosullari.hakedis_suresi}
                  </Text>
                )}
                {analysisSummary.odeme_kosullari.odeme_suresi && (
                  <Text size="xs" c="dimmed">
                    Ödeme Süresi: {analysisSummary.odeme_kosullari.odeme_suresi}
                  </Text>
                )}
                {analysisSummary.odeme_kosullari.avans && (
                  <Text size="xs" c="dimmed">
                    Avans: {analysisSummary.odeme_kosullari.avans}
                  </Text>
                )}
                {analysisSummary.odeme_kosullari.odeme_periyodu && (
                  <Text size="xs" c="dimmed">
                    Periyot: {analysisSummary.odeme_kosullari.odeme_periyodu}
                  </Text>
                )}
              </Stack>
            </Paper>
          )}

          {analysisSummary?.is_artisi && (
            <Paper p="sm" withBorder radius="md" className="glassy-card-nested">
              <Stack gap={4}>
                <Text size="sm" fw={600}>
                  İş Artışı / Eksilişi
                </Text>
                {analysisSummary.is_artisi.oran && (
                  <Text size="xs" c="dimmed">
                    Maks. İş Artışı: {analysisSummary.is_artisi.oran}
                  </Text>
                )}
                {analysisSummary.is_artisi.kosullar && (
                  <Text size="xs" c="dimmed">
                    {analysisSummary.is_artisi.kosullar}
                  </Text>
                )}
                {analysisSummary.is_artisi.is_eksilisi && (
                  <Text size="xs" c="dimmed">
                    İş Eksilişi: {analysisSummary.is_artisi.is_eksilisi}
                  </Text>
                )}
              </Stack>
            </Paper>
          )}

          {activeCategory === 'mali' && categoryCounts.mali === 0 && (
            <Paper p="md" withBorder radius="md" ta="center">
              <ThemeIcon size="lg" variant="light" color="gray" radius="xl" mx="auto" mb="xs">
                <IconBuildingBank size={18} />
              </ThemeIcon>
              <Text size="sm" c="dimmed">
                Bu kategoride henüz veri yok.
              </Text>
            </Paper>
          )}
        </>
      )}

      {/* ─── TEKNİK ──────────────────────────────────────────────── */}
      {showCategory('teknik') && (
        <>
          <CategoryHeader category="teknik" icon={<IconClipboardList size={14} />} label="Teknik" />
          {analysisSummary?.teknik_sartlar && analysisSummary.teknik_sartlar.length > 0 && (
            <TeknikSartlarCard
              teknikSartlar={analysisSummary.teknik_sartlar}
              isEditing={editingCards.has('teknik_sartlar')}
              onToggleEdit={() => toggleCardEdit('teknik_sartlar')}
              onSave={makeSaveHandler('teknik_sartlar')}
              onDelete={makeDeleteHandler('teknik_sartlar', analysisSummary.teknik_sartlar)}
              isCorrected={!!getCorrectionForField('teknik_sartlar')}
              showCheckbox={showCheckboxes}
              isSelected={selectedCards?.has('teknik_sartlar')}
              onToggleSelect={() => onToggleCard?.('teknik_sartlar')}
            />
          )}

          {analysisSummary?.benzer_is_tanimi && (
            <BenzerIsTanimiCard
              tanim={analysisSummary.benzer_is_tanimi}
              showCheckbox={showCheckboxes}
              isSelected={selectedCards?.has('benzer_is_tanimi')}
              onToggleSelect={() => onToggleCard?.('benzer_is_tanimi')}
            />
          )}

          {analysisSummary?.onemli_notlar && analysisSummary.onemli_notlar.length > 0 && (
            <OnemliNotlarCard
              notlar={
                analysisSummary.onemli_notlar as Array<{ not: string; tur?: 'bilgi' | 'uyari' | 'gereklilik' } | string>
              }
              showCheckbox={showCheckboxes}
              isSelected={selectedCards?.has('onemli_notlar')}
              onToggleSelect={() => onToggleCard?.('onemli_notlar')}
            />
          )}

          {analysisSummary?.operasyonel_kurallar && (
            <Paper p="sm" withBorder radius="md" className="glassy-card-nested">
              <Stack gap={4}>
                <Text size="sm" fw={600}>
                  Operasyonel Kurallar
                </Text>
                {analysisSummary.operasyonel_kurallar.alt_yuklenici && (
                  <Text size="xs" c="dimmed">
                    Alt Yüklenici: {analysisSummary.operasyonel_kurallar.alt_yuklenici}
                  </Text>
                )}
                {analysisSummary.operasyonel_kurallar.personel_kurallari?.map((k) => (
                  <Text key={`pk-${k.slice(0, 30)}`} size="xs" c="dimmed">
                    - {k}
                  </Text>
                ))}
                {analysisSummary.operasyonel_kurallar.yemek_kurallari?.map((k) => (
                  <Text key={`yk-${k.slice(0, 30)}`} size="xs" c="dimmed">
                    - {k}
                  </Text>
                ))}
              </Stack>
            </Paper>
          )}

          {activeCategory === 'teknik' && categoryCounts.teknik === 0 && (
            <Paper p="md" withBorder radius="md" ta="center">
              <ThemeIcon size="lg" variant="light" color="gray" radius="xl" mx="auto" mb="xs">
                <IconClipboardList size={18} />
              </ThemeIcon>
              <Text size="sm" c="dimmed">
                Bu kategoride henüz veri yok.
              </Text>
            </Paper>
          )}
        </>
      )}

      {/* ─── BELGELER & İLETİŞİM ─────────────────────────────────── */}
      {showCategory('belgeler') && (
        <>
          <CategoryHeader category="belgeler" icon={<IconFolder size={14} />} label="Belgeler" />
          {analysisSummary?.gerekli_belgeler && analysisSummary.gerekli_belgeler.length > 0 && (
            <GerekliBelgelerCard
              belgeler={analysisSummary.gerekli_belgeler}
              showCheckbox={showCheckboxes}
              isSelected={selectedCards?.has('gerekli_belgeler')}
              onToggleSelect={() => onToggleCard?.('gerekli_belgeler')}
            />
          )}

          {analysisSummary?.iletisim && Object.keys(analysisSummary.iletisim).length > 0 && (
            <IletisimCard
              iletisim={analysisSummary.iletisim}
              isEditing={editingCards.has('iletisim')}
              onToggleEdit={() => toggleCardEdit('iletisim')}
              onSave={makeSaveHandler('iletisim')}
              onDelete={makeDeleteHandler('iletisim', analysisSummary.iletisim)}
              isCorrected={!!getCorrectionForField('iletisim')}
              showCheckbox={showCheckboxes}
              isSelected={selectedCards?.has('iletisim')}
              onToggleSelect={() => onToggleCard?.('iletisim')}
            />
          )}

          {analysisSummary?.eksik_bilgiler &&
            analysisSummary.eksik_bilgiler.length > 0 &&
            (() => {
              const filtered = filterEksikBilgiler(analysisSummary.eksik_bilgiler, analysisSummary);
              return filtered.length > 0 ? (
                <EksikBilgilerCard
                  eksikBilgiler={filtered}
                  showCheckbox={showCheckboxes}
                  isSelected={selectedCards?.has('eksik_bilgiler')}
                  onToggleSelect={() => onToggleCard?.('eksik_bilgiler')}
                />
              ) : null;
            })()}

          {activeCategory === 'belgeler' && categoryCounts.belgeler === 0 && (
            <Paper p="md" withBorder radius="md" ta="center">
              <ThemeIcon size="lg" variant="light" color="gray" radius="xl" mx="auto" mb="xs">
                <IconFolder size={18} />
              </ThemeIcon>
              <Text size="sm" c="dimmed">
                Bu kategoride henüz veri yok.
              </Text>
            </Paper>
          )}
        </>
      )}
    </Stack>
  );
}
