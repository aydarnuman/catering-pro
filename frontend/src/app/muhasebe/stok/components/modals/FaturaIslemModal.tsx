/**
 * FaturaIslemModal - Faturadan Stok Girişi Modalı
 * En karmaşık modal - akıllı eşleştirme, fatura listesi, kalem işlemleri
 */

'use client';

import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Divider,
  Group,
  LoadingOverlay,
  Modal,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  ThemeIcon,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconCheck,
  IconCurrencyLira,
  IconFileInvoice,
  IconLink,
  IconLinkOff,
  IconPackages,
  IconPlus,
  IconTrendingUp,
  IconX,
} from '@tabler/icons-react';
import { EmptyState } from '@/components/common';
import { useResponsive } from '@/hooks/useResponsive';
import type { AkilliKalem, AkilliKalemlerResponse } from '@/lib/api/services/stok';

import type { Depo, Fatura, StokItem } from '../../types';

// Miktar formatı
const formatMiktar = (value: number | string) => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (Number.isNaN(num)) return '0';
  if (Number.isInteger(num)) {
    return num.toLocaleString('tr-TR');
  }
  return num.toLocaleString('tr-TR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
};

interface FaturaIslemModalProps {
  opened: boolean;
  onClose: () => void;
  // Fatura listesi
  faturalar: Fatura[];
  selectedFatura: Fatura | null;
  setSelectedFatura: (fatura: Fatura | null) => void;
  // Fatura kalemleri
  faturaKalemler: AkilliKalem[];
  faturaOzet: AkilliKalemlerResponse['ozet'] | null;
  faturaInfo: AkilliKalemlerResponse['fatura'] | null;
  // Eşleştirme
  kalemEslestirme: { [key: number]: number | null };
  setKalemEslestirme: (
    eslestirme:
      | { [key: number]: number | null }
      | ((prev: { [key: number]: number | null }) => { [key: number]: number | null })
  ) => void;
  tumUrunler: StokItem[];
  // Depo
  depolar: Depo[];
  faturaGirisDepo: number | null;
  setFaturaGirisDepo: (id: number | null) => void;
  // İşlemler
  onFaturaSelect: (ettn: string) => Promise<void>;
  onFaturaStokGirisi: () => Promise<void>;
  onTopluFaturaIsle: () => Promise<void>;
  onFiyatGuncelle: (urunKartId: number, birimFiyat: number, urunAdi: string) => Promise<void>;
  onYeniUrunOlustur: (kalem: any, anaUrunId?: number) => Promise<void>;
  onManuelGirisAc: () => void;
  // Loading
  faturaLoading?: boolean;
  topluIslemLoading?: boolean;
}

export default function FaturaIslemModal({
  opened,
  onClose,
  faturalar,
  selectedFatura,
  setSelectedFatura,
  faturaKalemler,
  faturaOzet,
  faturaInfo,
  kalemEslestirme,
  setKalemEslestirme,
  tumUrunler,
  depolar,
  faturaGirisDepo,
  setFaturaGirisDepo,
  onFaturaSelect,
  onFaturaStokGirisi,
  onTopluFaturaIsle,
  onFiyatGuncelle,
  onYeniUrunOlustur,
  onManuelGirisAc,
  faturaLoading = false,
  topluIslemLoading = false,
}: FaturaIslemModalProps) {
  const { isMobile } = useResponsive();

  const handleClose = () => {
    setSelectedFatura(null);
    onClose();
  };

  const handleBack = () => {
    setSelectedFatura(null);
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={
        selectedFatura ? (
          `${selectedFatura.sender_name}`
        ) : (
          <Group gap="sm">
            <ThemeIcon
              size="lg"
              radius="xl"
              variant="gradient"
              gradient={{ from: 'green', to: 'teal' }}
            >
              <IconTrendingUp size={18} />
            </ThemeIcon>
            <Text fw={600}>Stok Girişi</Text>
          </Group>
        )
      }
      size="xl"
      styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}
    >
      <LoadingOverlay visible={faturaLoading} />

      {!selectedFatura ? (
        // === ANA MENÜ - Fatura Listesi ===
        <Stack>
          <SimpleGrid cols={2} spacing="md" mb="lg">
            <Paper
              p="lg"
              withBorder
              radius="md"
              style={{ cursor: 'pointer', transition: 'all 0.2s' }}
              onClick={onManuelGirisAc}
            >
              <Stack align="center" gap="sm">
                <ThemeIcon size={50} radius="xl" variant="light" color="grape">
                  <IconPlus size={24} />
                </ThemeIcon>
                <Text fw={600}>Manuel Giriş</Text>
                <Text size="xs" c="dimmed" ta="center">
                  Tek tek ürün ekle, miktar ve fiyat gir
                </Text>
              </Stack>
            </Paper>
            <Paper p="lg" withBorder radius="md" bg="teal.0" style={{ cursor: 'default' }}>
              <Stack align="center" gap="sm">
                <ThemeIcon
                  size={50}
                  radius="xl"
                  variant="gradient"
                  gradient={{ from: 'teal', to: 'green' }}
                >
                  <IconFileInvoice size={24} />
                </ThemeIcon>
                <Text fw={600}>Faturadan Ekle</Text>
                <Text size="xs" c="dimmed" ta="center">
                  Uyumsoft faturalarından otomatik aktar
                </Text>
              </Stack>
            </Paper>
          </SimpleGrid>

          <Divider label="Fatura Listesi" labelPosition="center" />

          <Group justify="space-between" mb="md" wrap="wrap">
            <Text size="sm" c="dimmed">
              Son 3 ayın gelen faturaları. İşlemek istediğiniz faturayı seçin.
            </Text>
            <Group wrap="wrap" style={isMobile ? { width: '100%' } : undefined}>
              <Select
                placeholder="Toplu işlem için depo seçin"
                data={depolar.map((d) => ({ value: d.id.toString(), label: d.ad }))}
                value={faturaGirisDepo?.toString() || null}
                onChange={(val) => setFaturaGirisDepo(val ? parseInt(val, 10) : null)}
                size="xs"
                style={{ width: isMobile ? '100%' : 200 }}
              />
              <Button
                size="xs"
                variant="gradient"
                gradient={{ from: 'violet', to: 'blue' }}
                leftSection={<IconPackages size={14} />}
                loading={topluIslemLoading}
                disabled={!faturaGirisDepo || faturalar.filter((f) => !f.stok_islendi).length === 0}
                onClick={onTopluFaturaIsle}
              >
                Tümünü İşle ({faturalar.filter((f) => !f.stok_islendi).length})
              </Button>
            </Group>
          </Group>

          <Alert color="blue" variant="light" mb="sm">
            <Text size="xs">
              <strong>Toplu İşlem:</strong> Depo seçip "Tümünü İşle" butonuna basarsanız, %90+ güven
              skorlu tüm kalemler otomatik stok girişi yapılır. Düşük güvenli olanlar manuel onay
              için bekletilir.
            </Text>
          </Alert>

          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Tarih</Table.Th>
                <Table.Th>Gönderen</Table.Th>
                <Table.Th>Tutar</Table.Th>
                <Table.Th>Durum</Table.Th>
                <Table.Th></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {faturalar.map((fatura) => (
                <Table.Tr key={fatura.ettn}>
                  <Table.Td>{new Date(fatura.invoice_date).toLocaleDateString('tr-TR')}</Table.Td>
                  <Table.Td>
                    <Text size="sm" lineClamp={1} style={{ maxWidth: 300 }}>
                      {fatura.sender_name}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text fw={500}>
                      {parseFloat(fatura.payable_amount).toLocaleString('tr-TR', {
                        minimumFractionDigits: 2,
                      })}{' '}
                      ₺
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    {fatura.stok_islendi ? (
                      <Badge color="green" variant="light">
                        İşlendi
                      </Badge>
                    ) : (
                      <Badge color="gray" variant="light">
                        Bekliyor
                      </Badge>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Button
                      size="xs"
                      variant="light"
                      disabled={fatura.stok_islendi}
                      onClick={() => {
                        setSelectedFatura(fatura);
                        onFaturaSelect(fatura.ettn);
                      }}
                    >
                      Seç
                    </Button>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>

          {faturalar.length === 0 && (
            <EmptyState
              title="Henüz işlenecek fatura bulunmuyor"
              compact
              icon={<IconFileInvoice size={32} />}
              iconColor="blue"
            />
          )}
        </Stack>
      ) : (
        // === FATURA KALEMLERİ VE EŞLEŞTİRME ===
        <Stack>
          <Group justify="space-between">
            <Button
              variant="subtle"
              size="xs"
              leftSection={<IconX size={14} />}
              onClick={handleBack}
            >
              Geri Dön
            </Button>
            <Badge size="lg">
              {new Date(selectedFatura.invoice_date).toLocaleDateString('tr-TR')} -{' '}
              {parseFloat(selectedFatura.payable_amount).toLocaleString('tr-TR')} ₺
            </Badge>
          </Group>

          <Select
            label="Hedef Depo"
            placeholder="Stok girişi yapılacak depoyu seçin"
            data={depolar.map((d) => ({ value: d.id.toString(), label: d.ad }))}
            value={faturaGirisDepo?.toString() || null}
            onChange={(val) => setFaturaGirisDepo(val ? parseInt(val, 10) : null)}
            required
          />

          {/* Özet Kartları */}
          {faturaKalemler.length > 0 && (
            <SimpleGrid cols={3} mb="md">
              <Paper p="xs" withBorder>
                <Text size="xs" c="dimmed">
                  Toplam Kalem
                </Text>
                <Text size="lg" fw={700}>
                  {faturaKalemler.length}
                </Text>
              </Paper>
              <Paper p="xs" withBorder style={{ borderColor: 'var(--mantine-color-green-5)' }}>
                <Text size="xs" c="green">
                  Seçilen
                </Text>
                <Text size="lg" fw={700} c="green">
                  {Object.values(kalemEslestirme).filter((v) => v !== null).length}
                </Text>
              </Paper>
              <Paper p="xs" withBorder style={{ borderColor: 'var(--mantine-color-yellow-5)' }}>
                <Text size="xs" c="yellow.7">
                  Seçilmemiş
                </Text>
                <Text size="lg" fw={700} c="yellow.7">
                  {Object.values(kalemEslestirme).filter((v) => v === null).length}
                </Text>
              </Paper>
            </SimpleGrid>
          )}

          {/* Akıllı Eşleştirme Özeti */}
          {faturaOzet && (
            <Paper p="sm" withBorder radius="md" bg="blue.0" mb="sm">
              <Group justify="space-between">
                <Group gap="lg">
                  <Box>
                    <Text size="xs" c="dimmed">
                      Otomatik Eşleşen
                    </Text>
                    <Text fw={600} c="green">
                      {faturaOzet.otomatik_onay} / {faturaOzet.toplam_kalem}
                    </Text>
                  </Box>
                  <Box>
                    <Text size="xs" c="dimmed">
                      Manuel Gerekli
                    </Text>
                    <Text fw={600} c="yellow.7">
                      {faturaOzet.manuel_gereken}
                    </Text>
                  </Box>
                  {faturaOzet.anomali_sayisi > 0 && (
                    <Box>
                      <Text size="xs" c="dimmed">
                        Fiyat Anomalisi
                      </Text>
                      <Text fw={600} c="red">
                        {faturaOzet.anomali_sayisi}
                      </Text>
                    </Box>
                  )}
                </Group>
                <Group gap="sm">
                  {faturaKalemler.filter((k) => k.eslesme && !kalemEslestirme[k.sira]).length >
                    0 && (
                    <Button
                      size="xs"
                      variant="light"
                      color="orange"
                      leftSection={<IconCheck size={14} />}
                      onClick={() => {
                        const yeniEslestirme = { ...kalemEslestirme };
                        faturaKalemler.forEach((k) => {
                          if (k.eslesme && !kalemEslestirme[k.sira]) {
                            yeniEslestirme[k.sira] = k.eslesme.stok_kart_id;
                          }
                        });
                        setKalemEslestirme(yeniEslestirme);
                      }}
                    >
                      Tüm Önerileri Kabul Et (
                      {faturaKalemler.filter((k) => k.eslesme && !kalemEslestirme[k.sira]).length})
                    </Button>
                  )}
                  {faturaOzet.tum_otomatik && (
                    <Badge color="green" size="lg">
                      Tüm kalemler eşleşti
                    </Badge>
                  )}
                </Group>
              </Group>
            </Paper>
          )}

          <Divider my="sm" label="Fatura Kalemleri" labelPosition="center" />

          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Ürün</Table.Th>
                <Table.Th>Miktar</Table.Th>
                <Table.Th>Fiyat</Table.Th>
                <Table.Th>Eşleştirme</Table.Th>
                <Table.Th>İşlem</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {faturaKalemler.map((kalem) => {
                const secilenUrunId = kalemEslestirme[kalem.sira];
                const secilenUrun = secilenUrunId
                  ? tumUrunler.find((u) => u.id === secilenUrunId)
                  : null;
                const guvenSkoru = kalem.eslesme?.guven_skoru || 0;
                const otomatikEslesti = kalem.eslesme?.otomatik_onay && !kalem.anomali?.var;

                return (
                  <Table.Tr
                    key={kalem.sira}
                    style={{
                      backgroundColor: kalem.anomali?.var
                        ? 'rgba(255, 107, 107, 0.1)'
                        : otomatikEslesti
                          ? 'rgba(64, 192, 87, 0.05)'
                          : undefined,
                    }}
                  >
                    <Table.Td>
                      <Stack gap={2}>
                        <Group gap="xs">
                          <Text size="sm" fw={500}>
                            {kalem.urun_adi}
                          </Text>
                          {kalem.anomali?.var && (
                            <ThemeIcon
                              size="xs"
                              color="red"
                              variant="light"
                              title={kalem.anomali.aciklama}
                            >
                              <IconAlertTriangle size={12} />
                            </ThemeIcon>
                          )}
                          {otomatikEslesti && (
                            <Badge size="xs" color="green" variant="light">
                              AI
                            </Badge>
                          )}
                        </Group>
                        <Text size="xs" c="dimmed">
                          Kod: {kalem.urun_kodu || '-'}
                        </Text>
                        {kalem.anomali?.var && (
                          <Text size="xs" c="red">
                            {kalem.anomali.aciklama}
                          </Text>
                        )}
                      </Stack>
                    </Table.Td>
                    <Table.Td>
                      <Stack gap={0}>
                        <Text>
                          {formatMiktar(kalem.miktar)} {kalem.birim || 'Ad'}
                        </Text>
                        {kalem.birim_donusturuldu && (
                          <Text size="xs" c="blue">
                            ({formatMiktar(kalem.orijinal_miktar)} {kalem.orijinal_birim})
                          </Text>
                        )}
                      </Stack>
                    </Table.Td>
                    <Table.Td>
                      <Stack gap={0}>
                        <Text>{(kalem.birim_fiyat || 0).toLocaleString('tr-TR')} ₺</Text>
                        {kalem.anomali?.var && kalem.anomali.onceki_fiyat && (
                          <Group gap={4}>
                            <Text size="xs" c="dimmed" style={{ textDecoration: 'line-through' }}>
                              {kalem.anomali.onceki_fiyat.toLocaleString('tr-TR')} ₺
                            </Text>
                            <Badge size="xs" color="red" variant="light">
                              {kalem.anomali.degisim_yuzde > 0 ? '+' : ''}
                              {kalem.anomali.degisim_yuzde.toFixed(0)}%
                            </Badge>
                          </Group>
                        )}
                      </Stack>
                    </Table.Td>
                    <Table.Td style={{ minWidth: 280 }}>
                      <Stack gap={4}>
                        <Select
                          placeholder={
                            kalem.eslesme && !secilenUrunId
                              ? `Öneri: ${kalem.eslesme.stok_adi?.substring(0, 20)}...`
                              : 'Ürün kartı ara ve seç...'
                          }
                          data={tumUrunler.map((s) => ({
                            value: s.id.toString(),
                            label: `${s.kod} - ${s.ad}`,
                          }))}
                          value={secilenUrunId?.toString() || null}
                          onChange={(val) =>
                            setKalemEslestirme((prev) => ({
                              ...prev,
                              [kalem.sira]: val ? parseInt(val, 10) : null,
                            }))
                          }
                          searchable
                          clearable
                          nothingFoundMessage="Ürün kartı bulunamadı"
                          leftSection={
                            secilenUrunId ? (
                              <IconLink size={14} color="green" />
                            ) : kalem.eslesme ? (
                              <IconLink size={14} color="orange" />
                            ) : (
                              <IconLinkOff size={14} color="gray" />
                            )
                          }
                          size="xs"
                          styles={
                            !secilenUrunId && kalem.eslesme
                              ? {
                                  input: { borderColor: 'orange', borderWidth: 2 },
                                }
                              : undefined
                          }
                        />
                        {/* Eşleşme Önerisi */}
                        {kalem.eslesme && !secilenUrunId && (
                          <Group gap={4}>
                            <Badge
                              size="xs"
                              color="orange"
                              variant="light"
                              style={{ cursor: 'pointer' }}
                              onClick={() =>
                                setKalemEslestirme((prev) => ({
                                  ...prev,
                                  [kalem.sira]: kalem.eslesme?.stok_kart_id ?? null,
                                }))
                              }
                              title="Tıklayarak öneriyi kabul et"
                            >
                              Öneri: %{guvenSkoru.toFixed(0)}
                            </Badge>
                            <Text size="xs" c="dimmed">
                              {kalem.eslesme.eslestirme_yontemi === 'tedarikci_gecmisi' &&
                                'Öğrenilmiş'}
                              {kalem.eslesme.eslestirme_yontemi === 'kod_eslesmesi' &&
                                'Kod eşleşti'}
                              {kalem.eslesme.eslestirme_yontemi === 'isim_benzerlik' &&
                                'İsim benzerliği'}
                              {kalem.eslesme.eslestirme_yontemi === 'normalize_eslesmesi' &&
                                'Normalize'}
                            </Text>
                            <Button
                              size="compact-xs"
                              variant="light"
                              color="orange"
                              onClick={() =>
                                setKalemEslestirme((prev) => ({
                                  ...prev,
                                  [kalem.sira]: kalem.eslesme?.stok_kart_id ?? null,
                                }))
                              }
                            >
                              Kabul Et
                            </Button>
                          </Group>
                        )}
                        {/* Eşleşme Onaylandı */}
                        {secilenUrunId && kalem.eslesme && (
                          <Group gap={4}>
                            <Badge size="xs" color="green" variant="filled">
                              Eşleşti
                            </Badge>
                            <Text size="xs" c="dimmed">
                              {kalem.eslesme.eslestirme_yontemi === 'tedarikci_gecmisi' &&
                                'Öğrenilmiş'}
                              {kalem.eslesme.eslestirme_yontemi === 'kod_eslesmesi' &&
                                'Kod eşleşti'}
                              {kalem.eslesme.eslestirme_yontemi === 'isim_benzerlik' &&
                                'İsim benzerliği'}
                              {kalem.eslesme.eslestirme_yontemi === 'normalize_eslesmesi' &&
                                'Normalize'}
                            </Text>
                          </Group>
                        )}
                        {/* Alternatif Öneriler */}
                        {!secilenUrunId &&
                          !kalem.eslesme &&
                          kalem.alternatif_eslesmeler &&
                          kalem.alternatif_eslesmeler.length > 0 && (
                            <Group gap={4}>
                              <Text size="xs" c="dimmed">
                                Öneriler:
                              </Text>
                              {kalem.alternatif_eslesmeler
                                .slice(0, 2)
                                .map((alt: any, idx: number) => (
                                  <Badge
                                    key={idx}
                                    size="xs"
                                    variant="outline"
                                    color="blue"
                                    style={{ cursor: 'pointer' }}
                                    onClick={() =>
                                      setKalemEslestirme((prev) => ({
                                        ...prev,
                                        [kalem.sira]: alt.stok_kart_id,
                                      }))
                                    }
                                  >
                                    {alt.stok_adi?.substring(0, 15)}...
                                  </Badge>
                                ))}
                            </Group>
                          )}
                      </Stack>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4}>
                        {/* Fiyat Güncelle */}
                        {secilenUrunId && kalem.birim_fiyat > 0 && (
                          <ActionIcon
                            variant="filled"
                            color="green"
                            size="sm"
                            title={`${kalem.birim_fiyat}₺ fiyatını güncelle`}
                            onClick={() => {
                              if (secilenUrun) {
                                onFiyatGuncelle(secilenUrun.id, kalem.birim_fiyat, secilenUrun.ad);
                              }
                            }}
                          >
                            <IconCurrencyLira size={14} />
                          </ActionIcon>
                        )}
                        {/* Yeni Ürün Kartı */}
                        {!secilenUrunId && (
                          <ActionIcon
                            variant="filled"
                            color="violet"
                            size="sm"
                            title={`"${kalem.urun_adi}" için yeni ürün kartı`}
                            onClick={() => onYeniUrunOlustur(kalem)}
                          >
                            <IconPlus size={14} />
                          </ActionIcon>
                        )}
                        {/* Seçimi Kaldır */}
                        {secilenUrunId && (
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            size="sm"
                            title="Seçimi kaldır"
                            onClick={() => {
                              setKalemEslestirme((prev) => ({
                                ...prev,
                                [kalem.sira]: null,
                              }));
                            }}
                          >
                            <IconX size={14} />
                          </ActionIcon>
                        )}
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>

          <Group justify="space-between" mt="md">
            <Text size="sm" c="dimmed">
              Eşleştirilen: {Object.values(kalemEslestirme).filter((v) => v).length} /{' '}
              {faturaKalemler.length} kalem
            </Text>
            <Button
              onClick={onFaturaStokGirisi}
              loading={faturaLoading}
              disabled={
                !faturaGirisDepo || Object.values(kalemEslestirme).filter((v) => v).length === 0
              }
              leftSection={<IconCheck size={16} />}
            >
              Stok Girişi Yap
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}
