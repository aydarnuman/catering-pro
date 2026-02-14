'use client';

import { Badge, Box, Button, Group, Paper, SimpleGrid, Stack, Text, ThemeIcon, Tooltip } from '@mantine/core';
import {
  IconBookmark,
  IconBrain,
  IconCheck,
  IconClipboardList,
  IconClock,
  IconCurrencyLira,
  IconEdit,
  IconFile,
  IconFileSearch,
  IconHash,
  IconScale,
  IconSparkles,
  IconTable,
  IconToolsKitchen2,
  IconUsers,
} from '@tabler/icons-react';
import Link from 'next/link';
import { useMemo } from 'react';
import { tendersAPI } from '@/lib/api/services/tenders';
import type { Tender } from '@/types/api';
import type { AnalysisData, SavedTender } from '../types';
import { normalizeAnalysisData } from './normalizeAnalysis';
import { RakipAnalizi } from './RakipAnalizi';

interface OzetTabPanelProps {
  selectedTender: Tender | SavedTender;
  savedTender: SavedTender | null;
  isSaved: boolean;
  hasAnalysis: boolean;
  analysisSummary?: AnalysisData;
  // HITL (simplified - only confirmation, editing moved to AnalysisCardsPanel)
  correctionCount: number;
  isConfirmed: boolean;
  correctionSaving: boolean;
  confirmAnalysis: () => Promise<boolean>;
  // Actions
  onRefreshData?: () => void;
  onOpenTeknikModal: () => void;
  onOpenBirimModal: () => void;
  onOpenSartnameModal: () => void;
  onOpenDocumentWizard: () => void;
  onSwitchToAnaliz: () => void;
  onSwitchToDokumanlar: () => void;
}

export function OzetTabPanel({
  selectedTender,
  savedTender,
  isSaved,
  hasAnalysis,
  analysisSummary: rawAnalysisSummary,
  correctionCount,
  isConfirmed,
  correctionSaving,
  confirmAnalysis,
  onRefreshData,
  onOpenTeknikModal,
  onOpenBirimModal,
  onOpenSartnameModal,
  onOpenDocumentWizard,
  onSwitchToAnaliz,
  onSwitchToDokumanlar,
}: OzetTabPanelProps) {
  // ─── Normalize analysis data ────────────────────────────────
  const analysisSummary = useMemo(() => normalizeAnalysisData(rawAnalysisSummary), [rawAnalysisSummary]);

  return (
    <Stack gap="md" style={{ maxWidth: 820, margin: '0 auto', width: '100%' }}>
      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* Takip Edilmemişse - Takip Et Kartı                             */}
      {/* ═══════════════════════════════════════════════════════════════ */}
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

      {/* Takip Edilmiş ama Analiz Yok */}
      {isSaved && !hasAnalysis && (
        <Paper p="sm" withBorder radius="md" bg="dark.7">
          <Group gap="xs">
            <ThemeIcon size="sm" variant="light" color="yellow" radius="xl">
              <IconSparkles size={14} />
            </ThemeIcon>
            <Text size="xs" c="dimmed">
              Döküman indirme ve AI analizi için{' '}
              <Text
                component="span"
                size="xs"
                fw={600}
                c="blue"
                style={{ cursor: 'pointer' }}
                onClick={onOpenDocumentWizard}
              >
                Döküman Yönetimi
              </Text>
              'ni kullanın
            </Text>
          </Group>
        </Paper>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* Analiz Özeti - 4lü Kompakt Kartlar                            */}
      {/* ═══════════════════════════════════════════════════════════════ */}
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

          {/* Doküman Doğrulama (eski Tam Metin yerine) */}
          <Paper
            p="sm"
            withBorder
            radius="md"
            style={{
              background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(139, 92, 246, 0.05))',
              borderColor: 'var(--mantine-color-violet-6)',
              cursor: 'pointer',
            }}
            onClick={onSwitchToDokumanlar}
          >
            <Group gap="xs">
              <ThemeIcon size="lg" variant="light" color="violet" radius="xl">
                <IconFileSearch size={18} />
              </ThemeIcon>
              <Box>
                <Text size="xl" fw={700} c="violet">
                  {savedTender?.dokuman_sayisi || 0}
                </Text>
                <Text size="xs" c="dimmed">
                  Doğrulama
                </Text>
              </Box>
            </Group>
          </Paper>

          {/* Analiz Edildi */}
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

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* AI Özeti                                                       */}
      {/* ═══════════════════════════════════════════════════════════════ */}
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

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* HITL: Düzeltme ve Onay Bar                                    */}
      {/* ═══════════════════════════════════════════════════════════════ */}
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
                    Analiz kartlarındaki verileri{' '}
                    <Text
                      component="span"
                      size="xs"
                      c="blue"
                      fw={500}
                      style={{ cursor: 'pointer' }}
                      onClick={onSwitchToAnaliz}
                    >
                      Analiz
                    </Text>{' '}
                    sekmesinden düzeltebilir,{' '}
                    <Text
                      component="span"
                      size="xs"
                      c="violet"
                      fw={500}
                      style={{ cursor: 'pointer' }}
                      onClick={onSwitchToDokumanlar}
                    >
                      Doğrulama
                    </Text>{' '}
                    sekmesinden dökümanları inceleyebilirsiniz.
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

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* Hesaplama Özeti                                               */}
      {/* ═══════════════════════════════════════════════════════════════ */}
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

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* Sanal İhale Masası Linki                                      */}
      {/* ═══════════════════════════════════════════════════════════════ */}
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
