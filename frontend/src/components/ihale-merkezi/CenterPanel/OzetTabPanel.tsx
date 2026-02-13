'use client';

import {
  Badge,
  Box,
  Button,
  Group,
  Paper,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import {
  IconBookmark,
  IconBrain,
  IconBuildingBank,
  IconCheck,
  IconClipboardList,
  IconClock,
  IconCurrencyLira,
  IconEdit,
  IconFile,
  IconFileText,
  IconFolder,
  IconHash,
  IconMathFunction,
  IconScale,
  IconSettings,
  IconSparkles,
  IconTable,
  IconToolsKitchen2,
  IconUsers,
} from '@tabler/icons-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { tendersAPI } from '@/lib/api/services/tenders';
import type { Tender } from '@/types/api';
import type { AnalysisData, SavedTender } from '../types';
import { normalizeAnalysisData } from './normalizeAnalysis';
import {
  BenzerIsTanimiCard,
  BirimFiyatlarCard,
  CateringDetayKartlari,
  CezaKosullariCard,
  EksikBilgilerCard,
  FiyatFarkiCard,
  GerekliBelgelerCard,
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
} from './OzetCards';
import { RakipAnalizi } from './RakipAnalizi';

// ─── Category Types ────────────────────────────────────────────
type CategoryTab = 'tumu' | 'operasyonel' | 'mali' | 'teknik' | 'belgeler';

interface OzetTabPanelProps {
  selectedTender: Tender | SavedTender;
  savedTender: SavedTender | null;
  isSaved: boolean;
  hasAnalysis: boolean;
  analysisSummary?: AnalysisData;
  // HITL correction system
  editingCards: Set<string>;
  toggleCardEdit: (cardName: string) => void;
  correctionCount: number;
  isConfirmed: boolean;
  correctionSaving: boolean;
  saveCorrection: (data: { field_path: string; old_value: unknown; new_value: unknown }) => Promise<boolean>;
  confirmAnalysis: () => Promise<boolean>;
  getCorrectionForField: (field: string) => unknown;
  // Actions
  onRefreshData?: () => void;
  onOpenTeknikModal: () => void;
  onOpenBirimModal: () => void;
  onOpenTamMetinModal: () => void;
  onOpenSartnameModal: () => void;
  onOpenDocumentWizard: () => void;
}

/**
 * Eksik bilgiler listesinden, aslında mevcut olan alanları filtrele.
 * AI bazen bir alanı hem çıkarır hem de eksik diye işaretler.
 */
function filterEksikBilgiler(eksikBilgiler: string[], summary: AnalysisData): string[] {
  // Normalize: küçük harf, türkçe i/ı düzelt, alfanumerik olmayan kaldır
  const normalize = (s: string) =>
    s
      .replace(/İ/g, 'i')
      .replace(/I/g, 'ı')
      .toLowerCase()
      .replace(/[^a-zçğıöşü0-9]/g, '');

  // Alan -> varlık kontrolü eşleştirmesi
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
        return false; // Alan mevcut, eksik listesinden çıkar
      }
    }
    return true; // Eşleşme yok veya alan gerçekten eksik
  });
}

export function OzetTabPanel({
  selectedTender,
  savedTender,
  isSaved,
  hasAnalysis,
  analysisSummary: rawAnalysisSummary,
  editingCards,
  toggleCardEdit,
  correctionCount,
  isConfirmed,
  correctionSaving,
  saveCorrection,
  confirmAnalysis,
  getCorrectionForField,
  onRefreshData,
  onOpenTeknikModal,
  onOpenBirimModal,
  onOpenTamMetinModal,
  onOpenSartnameModal,
  onOpenDocumentWizard,
}: OzetTabPanelProps) {
  const [activeCategory, setActiveCategory] = useState<CategoryTab>('tumu');

  // ─── Normalize analysis data (savunmacı katman) ───────────────
  const analysisSummary = useMemo(
    () => normalizeAnalysisData(rawAnalysisSummary),
    [rawAnalysisSummary]
  );

  // ─── Count cards per category ──────────────────────────────────
  const categoryCounts = useMemo(() => {
    if (!analysisSummary) return { operasyonel: 0, mali: 0, teknik: 0, belgeler: 0 };

    let operasyonel = 0;
    let mali = 0;
    let teknik = 0;
    let belgeler = 0;

    // Operasyonel
    if (analysisSummary.takvim?.length) operasyonel++;
    if (analysisSummary.servis_saatleri && Object.keys(analysisSummary.servis_saatleri).length > 0) operasyonel++;
    if (analysisSummary.personel_detaylari?.length) operasyonel++;
    if (analysisSummary.ogun_bilgileri?.length) operasyonel++;
    if (analysisSummary.is_yerleri?.length) operasyonel++;
    // CateringDetayKartlari check
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

    // Mali & Hukuki
    if (analysisSummary.birim_fiyatlar?.length) mali++;
    if (analysisSummary.teminat_oranlari && Object.keys(analysisSummary.teminat_oranlari).length > 0) mali++;
    if (analysisSummary.mali_kriterler && Object.keys(analysisSummary.mali_kriterler).length > 0) mali++;
    if (analysisSummary.fiyat_farki && (analysisSummary.fiyat_farki.formul || analysisSummary.fiyat_farki.katsayilar))
      mali++;
    if (analysisSummary.ceza_kosullari?.length) mali++;
    if (analysisSummary.odeme_kosullari) mali++;
    if (analysisSummary.is_artisi) mali++;

    // Teknik
    if (analysisSummary.teknik_sartlar?.length) teknik++;
    if (analysisSummary.benzer_is_tanimi) teknik++;
    if (analysisSummary.onemli_notlar?.length) teknik++;
    if (analysisSummary.operasyonel_kurallar) teknik++;

    // Belgeler & İletişim
    if (analysisSummary.gerekli_belgeler?.length) belgeler++;
    if (analysisSummary.iletisim && Object.keys(analysisSummary.iletisim).length > 0) belgeler++;
    if (analysisSummary.eksik_bilgiler?.length) {
      const filtered = filterEksikBilgiler(analysisSummary.eksik_bilgiler, analysisSummary);
      if (filtered.length > 0) belgeler++;
    }

    return { operasyonel, mali, teknik, belgeler };
  }, [analysisSummary]);

  // ─── Helper: Should show category tab ──────────────────────────
  const showCategory = (cat: CategoryTab) => activeCategory === 'tumu' || activeCategory === cat;

  // ─── Shared card render helpers ────────────────────────────────
  const makeSaveHandler = (_fieldName: string) => async (fieldPath: string, oldValue: unknown, newValue: unknown) => {
    await saveCorrection({
      field_path: fieldPath,
      old_value: oldValue,
      new_value: newValue,
    });
    onRefreshData?.();
  };

  return (
    <Stack gap="md" style={{ maxWidth: 820, margin: '0 auto', width: '100%' }}>
      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* PINNED SECTION - Always visible above tabs                    */}
      {/* ═══════════════════════════════════════════════════════════════ */}

      {/* Takip Edilmemişse - Takip Et Kartı */}
      {!isSaved && (
        <Paper
          p="lg"
          withBorder
          radius="lg"
          style={{
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(59, 130, 246, 0.02))',
            borderColor: 'var(--mantine-color-blue-5)',
          }}
        >
          <Stack gap="md" align="center">
            <ThemeIcon size={50} variant="light" color="blue" radius="xl">
              <IconBookmark size={24} />
            </ThemeIcon>
            <Box ta="center">
              <Text size="md" fw={600}>
                İhaleyi Takip Et
              </Text>
              <Text size="sm" c="dimmed">
                Döküman indirmek ve analiz yapmak için önce ihaleyi takip listesine ekleyin
              </Text>
            </Box>
            <Button
              variant="filled"
              color="blue"
              size="md"
              leftSection={<IconBookmark size={18} />}
              onClick={async () => {
                try {
                  await tendersAPI.addTracking(Number(selectedTender.id));
                  onRefreshData?.();
                } catch (error) {
                  console.error('Takibe ekleme hatası:', error);
                }
              }}
            >
              Takip Listesine Ekle
            </Button>
          </Stack>
        </Paper>
      )}

      {/* Takip Edilmiş ama Analiz Yok - Bilgi Mesajı */}
      {isSaved && !hasAnalysis && (
        <Paper p="sm" withBorder radius="md" bg="dark.7">
          <Group gap="xs">
            <ThemeIcon size="sm" variant="light" color="yellow" radius="xl">
              <IconSparkles size={14} />
            </ThemeIcon>
            <Text size="xs" c="dimmed">
              Döküman indirme ve AI analizi için <strong>Dökümanlar</strong> sekmesini kullanın
            </Text>
          </Group>
        </Paper>
      )}

      {/* Analiz Özeti - Kompakt Kartlar (sadece analiz varsa) */}
      {hasAnalysis && (
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="xs">
          {/* Teknik Şartlar */}
          <Paper
            p="sm"
            withBorder
            radius="md"
            style={{
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(59, 130, 246, 0.05))',
              borderColor: 'var(--mantine-color-blue-6)',
              cursor: (selectedTender.teknik_sart_sayisi || 0) > 0 ? 'pointer' : 'default',
            }}
            onClick={() => (selectedTender.teknik_sart_sayisi || 0) > 0 && onOpenTeknikModal()}
          >
            <Group gap="xs">
              <ThemeIcon size="lg" variant="light" color="blue" radius="xl">
                <IconClipboardList size={18} />
              </ThemeIcon>
              <Box>
                <Text size="xl" fw={700} c="blue">
                  {selectedTender.teknik_sart_sayisi || 0}
                </Text>
                <Text size="xs" c="dimmed">
                  Teknik Şart
                </Text>
              </Box>
            </Group>
          </Paper>

          {/* Birim Fiyatlar */}
          <Paper
            p="sm"
            withBorder
            radius="md"
            style={{
              background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(34, 197, 94, 0.05))',
              borderColor: 'var(--mantine-color-green-6)',
              cursor: (selectedTender.birim_fiyat_sayisi || 0) > 0 ? 'pointer' : 'default',
            }}
            onClick={() => (selectedTender.birim_fiyat_sayisi || 0) > 0 && onOpenBirimModal()}
          >
            <Group gap="xs">
              <ThemeIcon size="lg" variant="light" color="green" radius="xl">
                <IconCurrencyLira size={18} />
              </ThemeIcon>
              <Box>
                <Text size="xl" fw={700} c="green">
                  {selectedTender.birim_fiyat_sayisi || 0}
                </Text>
                <Text size="xs" c="dimmed">
                  Birim Fiyat
                </Text>
              </Box>
            </Group>
          </Paper>

          {/* Tam Metin */}
          <Paper
            p="sm"
            withBorder
            radius="md"
            style={{
              background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(139, 92, 246, 0.05))',
              borderColor: 'var(--mantine-color-violet-6)',
              cursor: analysisSummary?.tam_metin ? 'pointer' : 'default',
            }}
            onClick={() => analysisSummary?.tam_metin && onOpenTamMetinModal()}
          >
            <Group gap="xs">
              <ThemeIcon size="lg" variant="light" color="violet" radius="xl">
                <IconFileText size={18} />
              </ThemeIcon>
              <Box>
                <Text size="xl" fw={700} c="violet">
                  {analysisSummary?.tam_metin ? '📄' : '-'}
                </Text>
                <Text size="xs" c="dimmed">
                  Tam Metin
                </Text>
              </Box>
            </Group>
          </Paper>

          {/* Analiz Edildi - Tıklayınca modal açılır */}
          <Tooltip label="Döküman Yönetimi">
            <Paper
              p="sm"
              withBorder
              radius="md"
              style={{
                background: 'linear-gradient(135deg, rgba(201, 162, 39, 0.15), rgba(201, 162, 39, 0.05))',
                borderColor: '#C9A227',
                cursor: 'pointer',
              }}
              onClick={onOpenDocumentWizard}
            >
              <Group gap="xs">
                <ThemeIcon size="lg" variant="light" color="orange" radius="xl">
                  <IconFile size={18} />
                </ThemeIcon>
                <Box>
                  <Text size="xl" fw={700} c="orange">
                    {savedTender?.analiz_edilen_dokuman || 0}/{savedTender?.dokuman_sayisi || 0}
                  </Text>
                  <Text size="xs" c="dimmed">
                    Analiz
                  </Text>
                </Box>
              </Group>
            </Paper>
          </Tooltip>
        </SimpleGrid>
      )}

      {/* AI Özeti */}
      {analysisSummary?.ozet && (
        <Paper p="sm" withBorder radius="md" className="glassy-card-nested">
          <Group gap="xs" mb="xs">
            <ThemeIcon size="sm" variant="light" color="violet">
              <IconBrain size={12} />
            </ThemeIcon>
            <Text size="sm" fw={600}>
              AI Özeti
            </Text>
            {analysisSummary.ihale_turu && (
              <Badge size="xs" variant="light" color="grape">
                {analysisSummary.ihale_turu}
              </Badge>
            )}
          </Group>
          <Text size="sm" c="dimmed" style={{ lineHeight: 1.6 }}>
            {analysisSummary.ozet}
          </Text>
          {(analysisSummary.teslim_suresi || analysisSummary.tahmini_bedel) && (
            <Group gap="md" mt="xs">
              {analysisSummary.teslim_suresi && (
                <Badge variant="outline" color="blue" size="sm" leftSection={<IconClock size={10} />}>
                  {analysisSummary.teslim_suresi}
                </Badge>
              )}
              {analysisSummary.tahmini_bedel && analysisSummary.tahmini_bedel !== 'Belirtilmemiş' && (
                <Badge variant="outline" color="green" size="sm" leftSection={<IconCurrencyLira size={10} />}>
                  {analysisSummary.tahmini_bedel}
                </Badge>
              )}
            </Group>
          )}
        </Paper>
      )}

      {/* Temel Bilgiler Mini-Grid */}
      {analysisSummary &&
        (analysisSummary.ikn ||
          analysisSummary.kisi_sayisi ||
          analysisSummary.gunluk_ogun_sayisi ||
          analysisSummary.toplam_ogun_sayisi ||
          analysisSummary.toplam_personel ||
          analysisSummary.sinir_deger_katsayisi) && (
          <Group gap="xs" wrap="wrap">
            {analysisSummary.ikn && (
              <Badge variant="light" color="gray" size="sm" leftSection={<IconHash size={10} />}>
                IKN: {analysisSummary.ikn}
              </Badge>
            )}
            {analysisSummary.kisi_sayisi && analysisSummary.kisi_sayisi !== 'Belirtilmemiş' && (
              <Badge variant="light" color="blue" size="sm" leftSection={<IconUsers size={10} />}>
                {analysisSummary.kisi_sayisi} kişi
              </Badge>
            )}
            {analysisSummary.toplam_personel && (
              <Badge variant="light" color="indigo" size="sm" leftSection={<IconUsers size={10} />}>
                {Number(analysisSummary.toplam_personel).toLocaleString('tr-TR')} personel
              </Badge>
            )}
            {analysisSummary.gunluk_ogun_sayisi && analysisSummary.gunluk_ogun_sayisi !== 'Belirtilmemiş' && (
              <Badge variant="light" color="orange" size="sm" leftSection={<IconToolsKitchen2 size={10} />}>
                Günlük {Number(analysisSummary.gunluk_ogun_sayisi).toLocaleString('tr-TR')} öğün
              </Badge>
            )}
            {analysisSummary.toplam_ogun_sayisi && (
              <Badge variant="light" color="orange" size="sm" leftSection={<IconToolsKitchen2 size={10} />}>
                Toplam {Number(analysisSummary.toplam_ogun_sayisi).toLocaleString('tr-TR')} öğün
              </Badge>
            )}
            {analysisSummary.sinir_deger_katsayisi && (
              <Badge variant="light" color="violet" size="sm" leftSection={<IconScale size={10} />}>
                Sınır Değer (R): {analysisSummary.sinir_deger_katsayisi}
              </Badge>
            )}
            {analysisSummary.ihale_usulu && (
              <Badge variant="light" color="indigo" size="sm">
                {analysisSummary.ihale_usulu}
              </Badge>
            )}
            {analysisSummary.teklif_turu && (
              <Badge variant="light" color="cyan" size="sm">
                {analysisSummary.teklif_turu === 'birim_fiyat'
                  ? 'Birim Fiyat'
                  : analysisSummary.teklif_turu === 'goturu_bedel'
                    ? 'Götürü Bedel'
                    : analysisSummary.teklif_turu}
              </Badge>
            )}
            {analysisSummary.kapasite_gereksinimi && (
              <Badge variant="light" color="orange" size="sm">
                Kapasite: {analysisSummary.kapasite_gereksinimi}
              </Badge>
            )}
          </Group>
        )}

      {/* Potansiyel Rakip Analizi */}
      <RakipAnalizi
        tenderId={
          isSaved
            ? (savedTender?.tender_id ?? null)
            : (selectedTender as Tender)?.id
              ? Number((selectedTender as Tender).id)
              : null
        }
      />

      {/* HITL: Düzeltme ve Onay Bar */}
      {analysisSummary && isSaved && (
        <Paper
          p="xs"
          withBorder
          radius="md"
          style={{
            background: isConfirmed
              ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(34, 197, 94, 0.05))'
              : correctionCount > 0
                ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(59, 130, 246, 0.05))'
                : 'transparent',
            borderColor: isConfirmed ? 'var(--mantine-color-green-5)' : undefined,
          }}
        >
          <Group justify="space-between">
            <Group gap="xs">
              {isConfirmed ? (
                <Badge variant="filled" color="green" size="sm" leftSection={<IconCheck size={10} />}>
                  Analiz Onaylandı
                </Badge>
              ) : (
                <>
                  {correctionCount > 0 && (
                    <Badge variant="light" color="blue" size="sm" leftSection={<IconEdit size={10} />}>
                      {correctionCount} düzeltme
                    </Badge>
                  )}
                  <Text size="xs" c="dimmed">
                    Kartlardaki kalem ikonlarına tıklayarak düzeltme yapabilirsiniz
                  </Text>
                </>
              )}
            </Group>
            {!isConfirmed && (
              <Button
                size="compact-xs"
                variant="light"
                color="green"
                leftSection={<IconCheck size={12} />}
                loading={correctionSaving}
                onClick={async () => {
                  await confirmAnalysis();
                  onRefreshData?.();
                }}
              >
                Tüm Analiz Doğru
              </Button>
            )}
          </Group>
        </Paper>
      )}

      {/* Hesaplama özeti */}
      {(selectedTender.yaklasik_maliyet || selectedTender.sinir_deger || selectedTender.bizim_teklif) && (
        <Paper p="sm" withBorder radius="md" className="glassy-card-nested">
          <Text size="sm" fw={600} mb="xs">
            Hesaplama Özeti
          </Text>
          <SimpleGrid cols={3}>
            <Box>
              <Text size="xs" c="dimmed">
                Yaklaşık Maliyet
              </Text>
              <Text size="sm" fw={600}>
                {selectedTender.yaklasik_maliyet?.toLocaleString('tr-TR')} ₺
              </Text>
            </Box>
            <Box>
              <Text size="xs" c="dimmed">
                Sınır Değer
              </Text>
              <Text size="sm" fw={600}>
                {selectedTender.sinir_deger?.toLocaleString('tr-TR')} ₺
              </Text>
            </Box>
            <Box>
              <Text size="xs" c="dimmed">
                Bizim Teklif
              </Text>
              <Text size="sm" fw={600} c="green">
                {selectedTender.bizim_teklif?.toLocaleString('tr-TR')} ₺
              </Text>
            </Box>
          </SimpleGrid>
        </Paper>
      )}

      {/* Sanal Ihale Masasi — Bagimsiz Sayfa Linki */}
      {isSaved && savedTender && hasAnalysis && (
        <Button
          component={Link}
          href={`/ihale-merkezi/masa/${savedTender.tender_id}`}
          variant="gradient"
          gradient={{ from: 'violet', to: 'indigo', deg: 135 }}
          leftSection={<IconTable size={16} />}
          fullWidth
          size="md"
          style={{
            boxShadow: '0 2px 12px rgba(139, 92, 246, 0.2)',
            transition: 'all 0.2s ease',
          }}
        >
          Sanal Ihale Masasi
        </Button>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* CATEGORY TABS - Only shown when analysis exists               */}
      {/* ═══════════════════════════════════════════════════════════════ */}

      {hasAnalysis && (
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
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* CATEGORIZED CARDS                                             */}
      {/* ═══════════════════════════════════════════════════════════════ */}

      {/* ─── OPERASYONEL ──────────────────────────────────────────── */}
      {showCategory('operasyonel') && (
        <>
          {/* Takvim */}
          {analysisSummary?.takvim && analysisSummary.takvim.length > 0 && (
            <TakvimCard takvim={analysisSummary.takvim} />
          )}

          {/* Servis Saatleri */}
          {analysisSummary?.servis_saatleri && Object.keys(analysisSummary.servis_saatleri).length > 0 && (
            <ServisSaatleriCard
              saatler={analysisSummary.servis_saatleri}
              isEditing={editingCards.has('servis_saatleri')}
              onToggleEdit={() => toggleCardEdit('servis_saatleri')}
              onSave={makeSaveHandler('servis_saatleri')}
              isCorrected={!!getCorrectionForField('servis_saatleri')}
            />
          )}

          {/* Personel Detayları */}
          {analysisSummary?.personel_detaylari && analysisSummary.personel_detaylari.length > 0 && (
            <PersonelCard
              personel={analysisSummary.personel_detaylari}
              isEditing={editingCards.has('personel_detaylari')}
              onToggleEdit={() => toggleCardEdit('personel_detaylari')}
              onSave={makeSaveHandler('personel_detaylari')}
              isCorrected={!!getCorrectionForField('personel_detaylari')}
            />
          )}

          {/* Öğün Bilgileri */}
          {analysisSummary?.ogun_bilgileri && analysisSummary.ogun_bilgileri.length > 0 && (
            <OgunBilgileriCard
              ogunler={analysisSummary.ogun_bilgileri}
              toplamOgunSayisi={analysisSummary.toplam_ogun_sayisi}
            />
          )}

          {/* Catering Detay Kartları (Azure v5) */}
          <CateringDetayKartlari analysisSummary={analysisSummary} />

          {/* İş Yerleri */}
          {analysisSummary?.is_yerleri && analysisSummary.is_yerleri.length > 0 && (
            <IsYerleriCard yerler={analysisSummary.is_yerleri} />
          )}

          {/* Empty state for Operasyonel */}
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
          {/* Birim Fiyatlar */}
          {analysisSummary?.birim_fiyatlar && analysisSummary.birim_fiyatlar.length > 0 && (
            <BirimFiyatlarCard
              birimFiyatlar={analysisSummary.birim_fiyatlar}
              isEditing={editingCards.has('birim_fiyatlar')}
              onToggleEdit={() => toggleCardEdit('birim_fiyatlar')}
              onSave={makeSaveHandler('birim_fiyatlar')}
              isCorrected={!!getCorrectionForField('birim_fiyatlar')}
            />
          )}

          {/* Teminat Oranları */}
          {analysisSummary?.teminat_oranlari && Object.keys(analysisSummary.teminat_oranlari).length > 0 && (
            <TeminatOranlariCard
              teminat={analysisSummary.teminat_oranlari}
              isEditing={editingCards.has('teminat_oranlari')}
              onToggleEdit={() => toggleCardEdit('teminat_oranlari')}
              onSave={makeSaveHandler('teminat_oranlari')}
              isCorrected={!!getCorrectionForField('teminat_oranlari')}
            />
          )}

          {/* Mali Kriterler */}
          {analysisSummary?.mali_kriterler && Object.keys(analysisSummary.mali_kriterler).length > 0 && (
            <MaliKriterlerCard
              kriterler={analysisSummary.mali_kriterler}
              isEditing={editingCards.has('mali_kriterler')}
              onToggleEdit={() => toggleCardEdit('mali_kriterler')}
              onSave={makeSaveHandler('mali_kriterler')}
              isCorrected={!!getCorrectionForField('mali_kriterler')}
            />
          )}

          {/* Fiyat Farkı */}
          {analysisSummary?.fiyat_farki &&
            (analysisSummary.fiyat_farki.formul || analysisSummary.fiyat_farki.katsayilar) && (
              <FiyatFarkiCard fiyatFarki={analysisSummary.fiyat_farki} />
            )}

          {/* Ceza Koşulları */}
          {analysisSummary?.ceza_kosullari && analysisSummary.ceza_kosullari.length > 0 && (
            <CezaKosullariCard cezalar={analysisSummary.ceza_kosullari} />
          )}

          {/* Ödeme Koşulları */}
          {analysisSummary?.odeme_kosullari && (
            <Paper p="sm" withBorder radius="md" className="glassy-card-nested">
              <Group gap="xs" mb="xs">
                <ThemeIcon size="sm" variant="light" color="green">
                  <IconCurrencyLira size={12} />
                </ThemeIcon>
                <Text size="sm" fw={600}>
                  Ödeme Koşulları
                </Text>
              </Group>
              <Stack gap={4}>
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

          {/* İş Artışı */}
          {analysisSummary?.is_artisi && (
            <Paper p="sm" withBorder radius="md" className="glassy-card-nested">
              <Group gap="xs" mb="xs">
                <ThemeIcon size="sm" variant="light" color="yellow">
                  <IconMathFunction size={12} />
                </ThemeIcon>
                <Text size="sm" fw={600}>
                  İş Artışı / Eksilişi
                </Text>
              </Group>
              <Stack gap={4}>
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

          {/* Empty state for Mali */}
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
          {/* Teknik Şartlar */}
          {analysisSummary?.teknik_sartlar && analysisSummary.teknik_sartlar.length > 0 && (
            <TeknikSartlarCard
              teknikSartlar={analysisSummary.teknik_sartlar}
              isEditing={editingCards.has('teknik_sartlar')}
              onToggleEdit={() => toggleCardEdit('teknik_sartlar')}
              onSave={makeSaveHandler('teknik_sartlar')}
              isCorrected={!!getCorrectionForField('teknik_sartlar')}
            />
          )}

          {/* Benzer İş Tanımı */}
          {analysisSummary?.benzer_is_tanimi && <BenzerIsTanimiCard tanim={analysisSummary.benzer_is_tanimi} />}

          {/* Önemli Notlar */}
          {analysisSummary?.onemli_notlar && analysisSummary.onemli_notlar.length > 0 && (
            <OnemliNotlarCard
              notlar={
                analysisSummary.onemli_notlar as Array<{ not: string; tur?: 'bilgi' | 'uyari' | 'gereklilik' } | string>
              }
            />
          )}

          {/* Operasyonel Kurallar */}
          {analysisSummary?.operasyonel_kurallar && (
            <Paper p="sm" withBorder radius="md" className="glassy-card-nested">
              <Group gap="xs" mb="xs">
                <ThemeIcon size="sm" variant="light" color="teal">
                  <IconClipboardList size={12} />
                </ThemeIcon>
                <Text size="sm" fw={600}>
                  Operasyonel Kurallar
                </Text>
              </Group>
              <Stack gap={4}>
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

          {/* Empty state for Teknik */}
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
          {/* Gerekli Belgeler */}
          {analysisSummary?.gerekli_belgeler && analysisSummary.gerekli_belgeler.length > 0 && (
            <GerekliBelgelerCard belgeler={analysisSummary.gerekli_belgeler} />
          )}

          {/* İletişim Bilgileri */}
          {analysisSummary?.iletisim && Object.keys(analysisSummary.iletisim).length > 0 && (
            <IletisimCard
              iletisim={analysisSummary.iletisim}
              isEditing={editingCards.has('iletisim')}
              onToggleEdit={() => toggleCardEdit('iletisim')}
              onSave={makeSaveHandler('iletisim')}
              isCorrected={!!getCorrectionForField('iletisim')}
            />
          )}

          {/* Eksik Bilgiler */}
          {analysisSummary?.eksik_bilgiler &&
            analysisSummary.eksik_bilgiler.length > 0 &&
            (() => {
              const filtered = filterEksikBilgiler(analysisSummary.eksik_bilgiler, analysisSummary);
              return filtered.length > 0 ? <EksikBilgilerCard eksikBilgiler={filtered} /> : null;
            })()}

          {/* Empty state for Belgeler */}
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

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* BOTTOM SECTION - Always visible below tabs                    */}
      {/* ═══════════════════════════════════════════════════════════════ */}

      {/* Şartname/Gramaj Detayları Butonu */}
      {analysisSummary && (
        <Button
          variant="light"
          color="orange"
          leftSection={<IconScale size={16} />}
          onClick={onOpenSartnameModal}
          fullWidth
        >
          Şartname/Gramaj Detayları
        </Button>
      )}

      {/* Analiz yoksa mesaj */}
      {!analysisSummary?.teknik_sartlar?.length &&
        !analysisSummary?.birim_fiyatlar?.length &&
        !selectedTender.yaklasik_maliyet && (
          <Paper p="md" withBorder radius="md" ta="center">
            <Text size="sm" c="dimmed">
              Bu ihale için henüz analiz yapılmamış.
            </Text>
            <Text size="xs" c="dimmed" mt="xs">
              Dökümanlar sekmesinden dökümanları indirip analiz edebilirsiniz.
            </Text>
          </Paper>
        )}
    </Stack>
  );
}
