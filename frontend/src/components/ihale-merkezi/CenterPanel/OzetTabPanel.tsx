'use client';

import {
  Badge,
  Box,
  Button,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import {
  IconBookmark,
  IconBrain,
  IconCheck,
  IconClipboardList,
  IconClock,
  IconCurrencyLira,
  IconEdit,
  IconFile,
  IconFileText,
  IconScale,
  IconSparkles,
} from '@tabler/icons-react';
import { tendersAPI } from '@/lib/api/services/tenders';
import type { Tender } from '@/types/api';
import type { AnalysisData, SavedTender } from '../types';
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
  saveCorrection: (data: {
    field_path: string;
    old_value: unknown;
    new_value: unknown;
  }) => Promise<boolean>;
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

export function OzetTabPanel({
  selectedTender,
  savedTender,
  isSaved,
  hasAnalysis,
  analysisSummary,
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
  return (
    <Stack gap="md">
      {/* Takip Edilmemişse - Takip Et Kartı */}
      {!isSaved && (
        <Paper
          p="lg"
          withBorder
          radius="lg"
          style={{
            background:
              'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(59, 130, 246, 0.02))',
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
              background:
                'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(59, 130, 246, 0.05))',
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
              background:
                'linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(34, 197, 94, 0.05))',
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
              background:
                'linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(139, 92, 246, 0.05))',
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
                background:
                  'linear-gradient(135deg, rgba(201, 162, 39, 0.15), rgba(201, 162, 39, 0.05))',
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
                <Badge
                  variant="outline"
                  color="blue"
                  size="sm"
                  leftSection={<IconClock size={10} />}
                >
                  {analysisSummary.teslim_suresi}
                </Badge>
              )}
              {analysisSummary.tahmini_bedel &&
                analysisSummary.tahmini_bedel !== 'Belirtilmemiş' && (
                  <Badge
                    variant="outline"
                    color="green"
                    size="sm"
                    leftSection={<IconCurrencyLira size={10} />}
                  >
                    {analysisSummary.tahmini_bedel}
                  </Badge>
                )}
            </Group>
          )}
        </Paper>
      )}

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
                <Badge
                  variant="filled"
                  color="green"
                  size="sm"
                  leftSection={<IconCheck size={10} />}
                >
                  Analiz Onaylandı
                </Badge>
              ) : (
                <>
                  {correctionCount > 0 && (
                    <Badge
                      variant="light"
                      color="blue"
                      size="sm"
                      leftSection={<IconEdit size={10} />}
                    >
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

      {/* Takvim */}
      {analysisSummary?.takvim && analysisSummary.takvim.length > 0 && (
        <TakvimCard takvim={analysisSummary.takvim} />
      )}

      {/* Önemli Notlar */}
      {analysisSummary?.onemli_notlar && analysisSummary.onemli_notlar.length > 0 && (
        <OnemliNotlarCard
          notlar={
            analysisSummary.onemli_notlar as Array<
              { not: string; tur?: 'bilgi' | 'uyari' | 'gereklilik' } | string
            >
          }
        />
      )}

      {/* Teknik Şartlar */}
      {analysisSummary?.teknik_sartlar && analysisSummary.teknik_sartlar.length > 0 && (
        <TeknikSartlarCard
          teknikSartlar={analysisSummary.teknik_sartlar}
          isEditing={editingCards.has('teknik_sartlar')}
          onToggleEdit={() => toggleCardEdit('teknik_sartlar')}
          onSave={async (fieldPath, oldValue, newValue) => {
            await saveCorrection({
              field_path: fieldPath,
              old_value: oldValue,
              new_value: newValue,
            });
            onRefreshData?.();
          }}
          isCorrected={!!getCorrectionForField('teknik_sartlar')}
        />
      )}

      {/* Birim Fiyatlar */}
      {analysisSummary?.birim_fiyatlar && analysisSummary.birim_fiyatlar.length > 0 && (
        <BirimFiyatlarCard
          birimFiyatlar={analysisSummary.birim_fiyatlar}
          isEditing={editingCards.has('birim_fiyatlar')}
          onToggleEdit={() => toggleCardEdit('birim_fiyatlar')}
          onSave={async (fieldPath, oldValue, newValue) => {
            await saveCorrection({
              field_path: fieldPath,
              old_value: oldValue,
              new_value: newValue,
            });
            onRefreshData?.();
          }}
          isCorrected={!!getCorrectionForField('birim_fiyatlar')}
        />
      )}

      {/* Eksik Bilgiler */}
      {analysisSummary?.eksik_bilgiler && analysisSummary.eksik_bilgiler.length > 0 && (
        <EksikBilgilerCard eksikBilgiler={analysisSummary.eksik_bilgiler} />
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* YENİ DETAY KARTLARI - Tüm analiz bilgileri */}
      {/* ═══════════════════════════════════════════════════════════════ */}

      {/* Dashboard Grid - Kritik bilgiler yan yana */}
      {(analysisSummary?.iletisim && Object.keys(analysisSummary.iletisim).length > 0) ||
      (analysisSummary?.servis_saatleri &&
        Object.keys(analysisSummary.servis_saatleri).length > 0) ||
      (analysisSummary?.teminat_oranlari &&
        Object.keys(analysisSummary.teminat_oranlari).length > 0) ? (
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          {/* İletişim Bilgileri */}
          {analysisSummary?.iletisim && Object.keys(analysisSummary.iletisim).length > 0 && (
            <IletisimCard
              iletisim={analysisSummary.iletisim}
              isEditing={editingCards.has('iletisim')}
              onToggleEdit={() => toggleCardEdit('iletisim')}
              onSave={async (fieldPath, oldValue, newValue) => {
                await saveCorrection({
                  field_path: fieldPath,
                  old_value: oldValue,
                  new_value: newValue,
                });
                onRefreshData?.();
              }}
              isCorrected={!!getCorrectionForField('iletisim')}
            />
          )}

          {/* Servis Saatleri */}
          {analysisSummary?.servis_saatleri &&
            Object.keys(analysisSummary.servis_saatleri).length > 0 && (
              <ServisSaatleriCard
                saatler={analysisSummary.servis_saatleri}
                isEditing={editingCards.has('servis_saatleri')}
                onToggleEdit={() => toggleCardEdit('servis_saatleri')}
                onSave={async (fieldPath, oldValue, newValue) => {
                  await saveCorrection({
                    field_path: fieldPath,
                    old_value: oldValue,
                    new_value: newValue,
                  });
                  onRefreshData?.();
                }}
                isCorrected={!!getCorrectionForField('servis_saatleri')}
              />
            )}

          {/* Teminat Oranları */}
          {analysisSummary?.teminat_oranlari &&
            Object.keys(analysisSummary.teminat_oranlari).length > 0 && (
              <TeminatOranlariCard
                teminat={analysisSummary.teminat_oranlari}
                isEditing={editingCards.has('teminat_oranlari')}
                onToggleEdit={() => toggleCardEdit('teminat_oranlari')}
                onSave={async (fieldPath, oldValue, newValue) => {
                  await saveCorrection({
                    field_path: fieldPath,
                    old_value: oldValue,
                    new_value: newValue,
                  });
                  onRefreshData?.();
                }}
                isCorrected={!!getCorrectionForField('teminat_oranlari')}
              />
            )}

          {/* Mali Kriterler */}
          {analysisSummary?.mali_kriterler &&
            Object.keys(analysisSummary.mali_kriterler).length > 0 && (
              <MaliKriterlerCard
                kriterler={analysisSummary.mali_kriterler}
                isEditing={editingCards.has('mali_kriterler')}
                onToggleEdit={() => toggleCardEdit('mali_kriterler')}
                onSave={async (fieldPath, oldValue, newValue) => {
                  await saveCorrection({
                    field_path: fieldPath,
                    old_value: oldValue,
                    new_value: newValue,
                  });
                  onRefreshData?.();
                }}
                isCorrected={!!getCorrectionForField('mali_kriterler')}
              />
            )}
        </SimpleGrid>
      ) : null}

      {/* Personel ve Öğün Bilgileri */}
      {((analysisSummary?.personel_detaylari && analysisSummary.personel_detaylari.length > 0) ||
        (analysisSummary?.ogun_bilgileri && analysisSummary.ogun_bilgileri.length > 0)) && (
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          {/* Personel Detayları */}
          {analysisSummary?.personel_detaylari && analysisSummary.personel_detaylari.length > 0 && (
            <PersonelCard
              personel={analysisSummary.personel_detaylari}
              isEditing={editingCards.has('personel_detaylari')}
              onToggleEdit={() => toggleCardEdit('personel_detaylari')}
              onSave={async (fieldPath, oldValue, newValue) => {
                await saveCorrection({
                  field_path: fieldPath,
                  old_value: oldValue,
                  new_value: newValue,
                });
                onRefreshData?.();
              }}
              isCorrected={!!getCorrectionForField('personel_detaylari')}
            />
          )}

          {/* Öğün Bilgileri */}
          {analysisSummary?.ogun_bilgileri && analysisSummary.ogun_bilgileri.length > 0 && (
            <OgunBilgileriCard ogunler={analysisSummary.ogun_bilgileri} />
          )}
        </SimpleGrid>
      )}

      {/* ═══ CATERING DETAY KARTLARI (Azure v5) ═══ */}
      <CateringDetayKartlari analysisSummary={analysisSummary} />

      {/* İş Yerleri */}
      {analysisSummary?.is_yerleri && analysisSummary.is_yerleri.length > 0 && (
        <IsYerleriCard yerler={analysisSummary.is_yerleri} />
      )}

      {/* Ceza Koşulları ve Fiyat Farkı */}
      {((analysisSummary?.ceza_kosullari && analysisSummary.ceza_kosullari.length > 0) ||
        (analysisSummary?.fiyat_farki &&
          (analysisSummary.fiyat_farki.formul || analysisSummary.fiyat_farki.katsayilar))) && (
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          {/* Ceza Koşulları */}
          {analysisSummary?.ceza_kosullari && analysisSummary.ceza_kosullari.length > 0 && (
            <CezaKosullariCard cezalar={analysisSummary.ceza_kosullari} />
          )}

          {/* Fiyat Farkı */}
          {analysisSummary?.fiyat_farki &&
            (analysisSummary.fiyat_farki.formul || analysisSummary.fiyat_farki.katsayilar) && (
              <FiyatFarkiCard fiyatFarki={analysisSummary.fiyat_farki} />
            )}
        </SimpleGrid>
      )}

      {/* Gerekli Belgeler */}
      {analysisSummary?.gerekli_belgeler && analysisSummary.gerekli_belgeler.length > 0 && (
        <GerekliBelgelerCard belgeler={analysisSummary.gerekli_belgeler} />
      )}

      {/* Benzer İş Tanımı */}
      {analysisSummary?.benzer_is_tanimi && (
        <BenzerIsTanimiCard tanim={analysisSummary.benzer_is_tanimi} />
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

      {/* Hesaplama özeti */}
      {(selectedTender.yaklasik_maliyet ||
        selectedTender.sinir_deger ||
        selectedTender.bizim_teklif) && (
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
