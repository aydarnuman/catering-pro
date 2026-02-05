'use client';

import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Divider,
  Grid,
  Group,
  Modal,
  NumberInput,
  Paper,
  Progress,
  RingProgress,
  ScrollArea,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  ThemeIcon,
  Title,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconAlertTriangle,
  IconCalculator,
  IconCheck,
  IconCurrencyLira,
  IconInfoCircle,
  IconPercentage,
  IconPlus,
  IconShieldCheck,
  IconSparkles,
  IconTrash,
} from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { tendersAPI } from '@/lib/api/services/tenders';
import type { SavedTender } from './types';

interface CalculationModalProps {
  opened: boolean;
  onClose: () => void;
  tender: SavedTender;
  onRefresh?: () => void;
}

interface TeklifItem {
  firma: string;
  tutar: number;
}

type ActiveTool = 'temel' | 'sinir' | 'asiri' | 'teminat';

// İhale türleri için R ve N katsayıları (KİK 2025-2026)
type IhaleTuru = 'hizmet' | 'yapim_ustyapi' | 'yapim_altyapi';

const IHALE_KATSAYILARI: Record<IhaleTuru, { katsayi: number; aciklama: string }> = {
  hizmet: {
    katsayi: 0.9, // R katsayısı - KİK tarafından yıllık güncellenir
    aciklama: 'Hizmet Alımı (R=0.90)',
  },
  yapim_ustyapi: {
    katsayi: 1.0, // N katsayısı - B,C,D,E grupları
    aciklama: 'Yapım İşi - Üstyapı (N=1.00)',
  },
  yapim_altyapi: {
    katsayi: 1.2, // N katsayısı - A grubu
    aciklama: 'Yapım İşi - Altyapı (N=1.20)',
  },
};

export function CalculationModal({ opened, onClose, tender, onRefresh }: CalculationModalProps) {
  const [activeTool, setActiveTool] = useState<ActiveTool>('temel');
  const [saving, setSaving] = useState(false);

  // Temel veriler
  const [yaklasikMaliyet, setYaklasikMaliyet] = useState<number>(tender.yaklasik_maliyet || 0);
  const [bizimTeklif, setBizimTeklif] = useState<number>(tender.bizim_teklif || 0);

  // İhale türü (KİK sınır değer hesabı için)
  const [ihaleTuru, setIhaleTuru] = useState<IhaleTuru>('hizmet');

  // KİK Sınır Değer için teklif listesi - veritabanı ile senkron
  const [teklifListesi, setTeklifListesi] = useState<TeklifItem[]>([]);
  const [kikSinirDeger, setKikSinirDeger] = useState<number | null>(null);

  // Modal açıldığında veritabanından rakip teklifleri yükle
  useEffect(() => {
    if (opened && tender) {
      const hesaplamaVerileri = (tender as any).hesaplama_verileri || {};

      // Önce rakipTeklifler formatını kontrol et (yeni format)
      if (hesaplamaVerileri.rakipTeklifler?.length > 0) {
        const yuklenenTeklifler = hesaplamaVerileri.rakipTeklifler.map((r: any) => ({
          firma: r.firma_adi || r.firma || '',
          tutar: r.teklif_tutari || r.tutar || 0,
        }));
        setTeklifListesi(
          yuklenenTeklifler.length >= 3
            ? yuklenenTeklifler
            : [
                ...yuklenenTeklifler,
                ...Array(3 - yuklenenTeklifler.length)
                  .fill({ firma: '', tutar: 0 })
                  .map((_, i) => ({
                    firma: `Firma ${yuklenenTeklifler.length + i + 1}`,
                    tutar: 0,
                  })),
              ]
        );
      }
      // Eski format (teklifListesi)
      else if (hesaplamaVerileri.teklifListesi?.length > 0) {
        const eskiTeklifler = hesaplamaVerileri.teklifListesi;
        setTeklifListesi(
          eskiTeklifler.length >= 3
            ? eskiTeklifler
            : [
                ...eskiTeklifler,
                ...Array(3 - eskiTeklifler.length)
                  .fill(null)
                  .map((_, i) => ({
                    firma: `Firma ${eskiTeklifler.length + i + 1}`,
                    tutar: 0,
                  })),
              ]
        );
      }
      // Hiç veri yoksa varsayılan
      else {
        setTeklifListesi([
          { firma: 'Firma 1', tutar: 0 },
          { firma: 'Firma 2', tutar: 0 },
          { firma: 'Firma 3', tutar: 0 },
        ]);
      }

      // Diğer verileri de yükle
      setYaklasikMaliyet(tender.yaklasik_maliyet || 0);
      setBizimTeklif(tender.bizim_teklif || 0);
    }
  }, [opened, tender]);

  // Aşırı düşük maliyet bileşenleri
  const [maliyetler, setMaliyetler] = useState({
    hammadde: 0,
    iscilik: 0,
    enerji: 0,
    nakliye: 0,
    ambalaj: 0,
    diger: 0,
  });

  // Tespit edilen veriler
  const hesaplamaVerileri = (tender as any).hesaplama_verileri || {};
  const analysisSummary = tender.analysis_summary;

  const isSuresi =
    hesaplamaVerileri.is_suresi || analysisSummary?.teslim_suresi || analysisSummary?.sure;
  const toplamOgun =
    hesaplamaVerileri.toplam_ogun_sayisi ||
    analysisSummary?.ogun_bilgileri?.reduce(
      (sum: number, o: any) => sum + (Number(o.miktar) || 0),
      0
    ) ||
    0;
  const teknikSartSayisi =
    hesaplamaVerileri.teknik_sart_sayisi || analysisSummary?.teknik_sartlar?.length || 0;
  const birimFiyatSayisi =
    hesaplamaVerileri.birim_fiyat_sayisi || analysisSummary?.birim_fiyatlar?.length || 0;

  // İş süresini ay olarak parse et
  const parseIsSuresiAy = (sure: string | undefined): number => {
    if (!sure) return 0;
    const match = sure.match(/(\d+)/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (sure.toLowerCase().includes('yıl') || sure.toLowerCase().includes('yil')) {
        return num * 12;
      }
      return num;
    }
    return 0;
  };

  const isSuresiAy = parseIsSuresiAy(isSuresi);

  // Otomatik hesaplamalar
  const basitSinirDeger = yaklasikMaliyet > 0 ? Math.round(yaklasikMaliyet * 0.85) : 0;
  const aktifSinirDeger = kikSinirDeger || basitSinirDeger;
  const ogunBasiMaliyet = yaklasikMaliyet && toplamOgun ? yaklasikMaliyet / toplamOgun : 0;
  const ogunBasiTeklif = bizimTeklif && toplamOgun ? bizimTeklif / toplamOgun : 0;
  const aylikMaliyet = yaklasikMaliyet && isSuresiAy ? yaklasikMaliyet / isSuresiAy : 0;
  const gunlukOgun = toplamOgun && isSuresiAy ? Math.round(toplamOgun / (isSuresiAy * 30)) : 0;

  // Risk analizi
  const isAsiriDusuk = bizimTeklif > 0 && aktifSinirDeger > 0 && bizimTeklif < aktifSinirDeger;
  const fark = bizimTeklif > 0 && aktifSinirDeger > 0 ? bizimTeklif - aktifSinirDeger : 0;
  const farkYuzde =
    aktifSinirDeger > 0 && bizimTeklif > 0
      ? ((bizimTeklif - aktifSinirDeger) / aktifSinirDeger) * 100
      : 0;

  // Teminat hesaplamaları
  const geciciTeminat = bizimTeklif > 0 ? bizimTeklif * 0.03 : 0;
  const kesinTeminat = bizimTeklif > 0 ? bizimTeklif * 0.06 : 0;

  // Toplam maliyet (aşırı düşük için)
  const toplamMaliyet = Object.values(maliyetler).reduce((a, b) => a + b, 0);
  const karMarji =
    bizimTeklif > 0 && toplamMaliyet > 0 ? ((bizimTeklif - toplamMaliyet) / bizimTeklif) * 100 : 0;

  // KİK Formülü ile sınır değer hesapla
  // Güncel Mevzuat: SD = ((YM + ∑Tn) / (n+1)) × R (veya N yapım işlerinde)
  const hesaplaKikSinirDeger = () => {
    const gecerliTeklifler = teklifListesi.filter((t) => t.tutar > 0).map((t) => t.tutar);

    if (gecerliTeklifler.length < 3) {
      notifications.show({
        title: 'Yetersiz Veri',
        message: 'En az 3 geçerli teklif girmelisiniz',
        color: 'yellow',
      });
      return;
    }

    if (yaklasikMaliyet <= 0) {
      notifications.show({
        title: 'Yaklaşık Maliyet Gerekli',
        message: 'Önce Temel Hesaplama sekmesinde yaklaşık maliyeti girin',
        color: 'yellow',
      });
      return;
    }

    const n = gecerliTeklifler.length;
    const toplam = gecerliTeklifler.reduce((a, b) => a + b, 0);

    // Geçerli teklifler: YM'nin %60'ından düşük ve YM'den yüksek olanlar hariç
    const gecerliTekliflerFiltreli = gecerliTeklifler.filter(
      (t) => t >= yaklasikMaliyet * 0.6 && t <= yaklasikMaliyet
    );

    const nFiltreli = gecerliTekliflerFiltreli.length;
    const toplamFiltreli = gecerliTekliflerFiltreli.reduce((a, b) => a + b, 0);

    // Katsayıyı al (R veya N)
    const katsayi = IHALE_KATSAYILARI[ihaleTuru].katsayi;

    // KİK Formülü: SD = ((YM + ∑Tn) / (n+1)) × R
    // n = geçerli teklif sayısı, R/N = katsayı
    const sinir = ((yaklasikMaliyet + toplamFiltreli) / (nFiltreli + 1)) * katsayi;

    // Alt sınır: YM'nin %40'ından düşük olamaz
    const sonuc = Math.max(Math.round(sinir), Math.round(yaklasikMaliyet * 0.4));
    setKikSinirDeger(sonuc);

    const filtreUyarisi =
      n !== nFiltreli ? ` (${n - nFiltreli} teklif YM kriterleri dışında kaldı)` : '';

    notifications.show({
      title: 'Sınır Değer Hesaplandı',
      message: `${nFiltreli} geçerli teklif, ${IHALE_KATSAYILARI[ihaleTuru].aciklama}${filtreUyarisi}`,
      color: 'green',
    });
  };

  // Kaydet - rakipTeklifler formatını da kaydet (FirmsPanel ile senkron)
  const handleSave = async () => {
    setSaving(true);
    try {
      // Rakip teklifleri her iki formatta da kaydet (geriye uyumluluk)
      const filtreliTeklifler = teklifListesi.filter((t) => t.firma || t.tutar > 0);
      const rakipTekliflerFormati = filtreliTeklifler.map((t) => ({
        firma_adi: t.firma,
        teklif_tutari: t.tutar,
      }));

      await tendersAPI.updateTracking(Number(tender.id), {
        yaklasik_maliyet: yaklasikMaliyet || null,
        sinir_deger: aktifSinirDeger || null,
        bizim_teklif: bizimTeklif || null,
        hesaplama_verileri: {
          ...(tender as any).hesaplama_verileri,
          // Yeni format - FirmsPanel ile uyumlu
          rakipTeklifler: rakipTekliflerFormati,
          // Eski format - geriye uyumluluk
          teklifListesi: filtreliTeklifler,
          maliyetler,
          kikSinirDeger,
          ihaleTuru,
        },
      });
      notifications.show({
        title: 'Kaydedildi',
        message: 'Tüm hesaplama verileri güncellendi',
        color: 'green',
      });
      onRefresh?.();
      onClose();
    } catch {
      notifications.show({
        title: 'Hata',
        message: 'Kayıt sırasında bir hata oluştu',
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  };

  // Maliyetler için ayrı yükleme (modal açıldığında)
  useEffect(() => {
    if (opened && tender) {
      const saved = (tender as any).hesaplama_verileri || {};
      if (saved.maliyetler) setMaliyetler(saved.maliyetler);
      if (saved.kikSinirDeger) setKikSinirDeger(saved.kikSinirDeger);
      if (saved.ihaleTuru) setIhaleTuru(saved.ihaleTuru);
    }
  }, [opened, tender]);

  // Tool content renderers
  const renderTemelHesaplama = () => (
    <Grid gutter="lg">
      <Grid.Col span={6}>
        <Stack gap="md">
          <NumberInput
            label="Yaklaşık Maliyet (İhale Bedeli)"
            description="İhale ilanındaki tahmini bedel"
            placeholder="0"
            value={yaklasikMaliyet || ''}
            onChange={(val) => setYaklasikMaliyet(Number(val) || 0)}
            min={0}
            max={999999999999}
            thousandSeparator="."
            decimalSeparator=","
            suffix=" ₺"
            size="md"
            leftSection={<IconCurrencyLira size={18} />}
            styles={{ input: { fontWeight: 600 } }}
          />

          <NumberInput
            label="Bizim Teklif"
            description="Vereceğiniz teklif tutarı"
            placeholder="0"
            value={bizimTeklif || ''}
            onChange={(val) => setBizimTeklif(Number(val) || 0)}
            min={0}
            max={999999999999}
            thousandSeparator="."
            decimalSeparator=","
            suffix=" ₺"
            size="md"
            leftSection={<IconCurrencyLira size={18} />}
            styles={{ input: { fontWeight: 600 } }}
          />

          <Paper p="md" bg="dark.7" radius="md">
            <Group justify="space-between" mb="xs">
              <Text size="sm" c="dimmed">
                Sınır Değer (×0.85)
              </Text>
              <Badge size="sm" variant="light" color="blue">
                Otomatik
              </Badge>
            </Group>
            <Text size="xl" fw={700} c="blue">
              {basitSinirDeger > 0 ? `${basitSinirDeger.toLocaleString('tr-TR')} ₺` : '—'}
            </Text>
            <Text size="xs" c="dimmed" mt={4}>
              Bu değerin altı "aşırı düşük" sorgulamasına tabi
            </Text>
          </Paper>
        </Stack>
      </Grid.Col>

      <Grid.Col span={6}>
        <Paper
          p="xl"
          radius="md"
          h="100%"
          style={{
            background:
              yaklasikMaliyet === 0
                ? 'var(--mantine-color-dark-6)'
                : isAsiriDusuk
                  ? 'linear-gradient(135deg, rgba(255,107,107,0.15) 0%, rgba(255,107,107,0.05) 100%)'
                  : 'linear-gradient(135deg, rgba(81,207,102,0.15) 0%, rgba(81,207,102,0.05) 100%)',
            border:
              yaklasikMaliyet > 0
                ? `2px solid var(--mantine-color-${isAsiriDusuk ? 'red' : 'green'}-6)`
                : '1px solid var(--mantine-color-dark-4)',
          }}
        >
          <Stack align="center" justify="center" h="100%" gap="md">
            {yaklasikMaliyet === 0 ? (
              <>
                <RingProgress
                  size={100}
                  thickness={8}
                  sections={[{ value: 0, color: 'gray' }]}
                  label={
                    <Text ta="center" size="sm" c="dimmed">
                      ?
                    </Text>
                  }
                />
                <Text c="dimmed" ta="center">
                  Yaklaşık Maliyet girin
                </Text>
              </>
            ) : bizimTeklif === 0 ? (
              <>
                <RingProgress
                  size={100}
                  thickness={8}
                  sections={[{ value: 50, color: 'blue' }]}
                  label={
                    <Text ta="center" fw={700}>
                      50%
                    </Text>
                  }
                />
                <Text c="dimmed" ta="center">
                  Bizim Teklif girin
                </Text>
              </>
            ) : (
              <>
                <ThemeIcon
                  size={80}
                  radius="xl"
                  variant="gradient"
                  gradient={
                    isAsiriDusuk ? { from: 'red', to: 'orange' } : { from: 'teal', to: 'green' }
                  }
                >
                  {isAsiriDusuk ? <IconAlertTriangle size={40} /> : <IconCheck size={40} />}
                </ThemeIcon>

                <Text size="xl" fw={700} c={isAsiriDusuk ? 'red' : 'green'} ta="center">
                  {isAsiriDusuk ? 'AŞIRI DÜŞÜK RİSKİ' : 'UYGUN TEKLİF'}
                </Text>

                <Text size="sm" c="dimmed" ta="center">
                  {isAsiriDusuk
                    ? 'Açıklama hazırlamanız gerekebilir'
                    : 'Aşırı düşük sorgusu riski düşük'}
                </Text>

                <Paper p="sm" bg="dark.8" radius="md" w="100%">
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">
                      Sınır Değerden Fark
                    </Text>
                    <Text size="sm" fw={600} c={fark >= 0 ? 'green' : 'red'}>
                      {fark >= 0 ? '+' : ''}
                      {fark.toLocaleString('tr-TR')} ₺ ({farkYuzde >= 0 ? '+' : ''}
                      {farkYuzde.toFixed(1)}%)
                    </Text>
                  </Group>
                </Paper>
              </>
            )}
          </Stack>
        </Paper>
      </Grid.Col>
    </Grid>
  );

  const renderKikSinirDeger = () => (
    <Stack gap="md">
      <Paper
        p="md"
        bg="rgba(201, 162, 39, 0.1)"
        radius="md"
        style={{ border: '1px solid var(--mantine-color-yellow-6)' }}
      >
        <Group gap="xs" mb="xs">
          <IconInfoCircle size={16} color="var(--mantine-color-yellow-6)" />
          <Text size="sm" fw={600} c="yellow">
            KİK Sınır Değer Formülü (Güncel Mevzuat)
          </Text>
          <Tooltip
            label="Katsayılar KİK tarafından her yıl 1 Şubat'ta güncellenir. Güncel değerler için ekap.kik.gov.tr adresini kontrol edin."
            multiline
            w={280}
          >
            <IconInfoCircle size={14} style={{ cursor: 'help', opacity: 0.7 }} />
          </Tooltip>
        </Group>
        <Text size="xs" c="dimmed">
          <strong>Formül:</strong> SD = ((YM + ∑Tn) / (n+1)) × R{' '}
          <Text span c="yellow" fw={500}>
            (Hizmet: R, Yapım: N katsayısı)
          </Text>
        </Text>
        <Text size="xs" c="dimmed" mt={4}>
          YM = Yaklaşık Maliyet, Tn = Geçerli teklifler (YM'nin %60-100'ü arasında), n = Teklif
          sayısı
        </Text>
      </Paper>

      {/* İhale Türü Seçici */}
      <Select
        label="İhale Türü"
        description="Katsayı ihale türüne göre değişir"
        value={ihaleTuru}
        onChange={(val) => val && setIhaleTuru(val as IhaleTuru)}
        data={[
          { value: 'hizmet', label: '🏢 Hizmet Alımı (R = 0.90)' },
          { value: 'yapim_ustyapi', label: '🏗️ Yapım İşi - Üstyapı/Bina (N = 1.00)' },
          { value: 'yapim_altyapi', label: '🛤️ Yapım İşi - Altyapı (N = 1.20)' },
        ]}
        allowDeselect={false}
      />

      <SimpleGrid cols={2} spacing="md">
        <Stack gap="xs">
          <Group justify="space-between">
            <Text size="sm" fw={600}>
              Rakip Teklifler
            </Text>
            <Button
              size="compact-xs"
              variant="light"
              leftSection={<IconPlus size={12} />}
              onClick={() =>
                setTeklifListesi((prev) => [
                  ...prev,
                  { firma: `Firma ${prev.length + 1}`, tutar: 0 },
                ])
              }
            >
              Ekle
            </Button>
          </Group>

          <ScrollArea h={250}>
            <Stack gap="xs">
              {teklifListesi.map((teklif, index) => (
                <Group key={`teklif-${teklif.firma}-${index}`} gap="xs">
                  <TextInput
                    placeholder="Firma"
                    value={teklif.firma}
                    onChange={(e) =>
                      setTeklifListesi((prev) =>
                        prev.map((t, i) => (i === index ? { ...t, firma: e.target.value } : t))
                      )
                    }
                    size="xs"
                    style={{ flex: 1 }}
                  />
                  <NumberInput
                    placeholder="Tutar"
                    value={teklif.tutar || ''}
                    onChange={(val) =>
                      setTeklifListesi((prev) =>
                        prev.map((t, i) => (i === index ? { ...t, tutar: Number(val) || 0 } : t))
                      )
                    }
                    min={0}
                    thousandSeparator="."
                    decimalSeparator=","
                    suffix=" ₺"
                    size="xs"
                    style={{ width: 150 }}
                  />
                  {teklifListesi.length > 3 && (
                    <ActionIcon
                      size="sm"
                      variant="subtle"
                      color="red"
                      onClick={() => setTeklifListesi((prev) => prev.filter((_, i) => i !== index))}
                    >
                      <IconTrash size={14} />
                    </ActionIcon>
                  )}
                </Group>
              ))}
            </Stack>
          </ScrollArea>

          <Button
            fullWidth
            variant="gradient"
            gradient={{ from: 'yellow', to: 'orange' }}
            leftSection={<IconCalculator size={16} />}
            onClick={hesaplaKikSinirDeger}
          >
            KİK Formülü ile Hesapla
          </Button>
        </Stack>

        <Paper p="lg" bg="dark.7" radius="md">
          <Stack align="center" justify="center" h="100%" gap="md">
            <Text size="sm" c="dimmed">
              KİK Sınır Değer
            </Text>
            <Text size="2rem" fw={700} c="yellow">
              {kikSinirDeger ? `${kikSinirDeger.toLocaleString('tr-TR')} ₺` : '—'}
            </Text>

            {kikSinirDeger && bizimTeklif > 0 && (
              <Badge
                size="lg"
                color={bizimTeklif < kikSinirDeger ? 'red' : 'green'}
                variant="light"
              >
                {bizimTeklif < kikSinirDeger ? 'Sınırın Altında' : 'Sınırın Üstünde'}
              </Badge>
            )}

            <Divider w="100%" />

            <Group justify="space-between" w="100%">
              <Text size="xs" c="dimmed">
                Basit Hesap (×0.85)
              </Text>
              <Text size="xs" fw={500}>
                {basitSinirDeger.toLocaleString('tr-TR')} ₺
              </Text>
            </Group>
            <Group justify="space-between" w="100%">
              <Text size="xs" c="dimmed">
                Teklif Sayısı
              </Text>
              <Text size="xs" fw={500}>
                {teklifListesi.filter((t) => t.tutar > 0).length}
              </Text>
            </Group>
          </Stack>
        </Paper>
      </SimpleGrid>
    </Stack>
  );

  const renderAsiriDusuk = () => (
    <Stack gap="md">
      <Paper
        p="md"
        bg="rgba(255, 107, 107, 0.1)"
        radius="md"
        style={{ border: '1px solid var(--mantine-color-red-6)' }}
      >
        <Group gap="xs" mb="xs">
          <IconAlertTriangle size={16} color="var(--mantine-color-red-6)" />
          <Text size="sm" fw={600} c="red">
            Aşırı Düşük Teklif Açıklaması
          </Text>
        </Group>
        <Text size="xs" c="dimmed">
          Teklifiniz sınır değerin altındaysa, maliyet bileşenlerinizi detaylı şekilde açıklamanız
          gerekir. Toplam maliyetiniz teklifinizi karşılamalıdır.
        </Text>
      </Paper>

      <SimpleGrid cols={2} spacing="md">
        <Stack gap="xs">
          <Text size="sm" fw={600}>
            Maliyet Bileşenleri
          </Text>

          {Object.entries({
            hammadde: 'Hammadde / Gıda',
            iscilik: 'İşçilik',
            enerji: 'Enerji',
            nakliye: 'Nakliye',
            ambalaj: 'Ambalaj',
            diger: 'Diğer Giderler',
          }).map(([key, label]) => (
            <NumberInput
              key={key}
              label={label}
              value={maliyetler[key as keyof typeof maliyetler] || ''}
              onChange={(val) => setMaliyetler((prev) => ({ ...prev, [key]: Number(val) || 0 }))}
              min={0}
              thousandSeparator="."
              decimalSeparator=","
              suffix=" ₺"
              size="xs"
            />
          ))}
        </Stack>

        <Paper p="lg" bg="dark.7" radius="md">
          <Stack gap="md">
            <div>
              <Text size="xs" c="dimmed" mb={4}>
                Toplam Maliyet
              </Text>
              <Text size="xl" fw={700}>
                {toplamMaliyet.toLocaleString('tr-TR')} ₺
              </Text>
            </div>

            <div>
              <Text size="xs" c="dimmed" mb={4}>
                Bizim Teklif
              </Text>
              <Text size="lg" fw={600} c="blue">
                {bizimTeklif.toLocaleString('tr-TR')} ₺
              </Text>
            </div>

            <Divider />

            <div>
              <Text size="xs" c="dimmed" mb={4}>
                Kar Marjı
              </Text>
              <Group gap="xs">
                <Text
                  size="lg"
                  fw={700}
                  c={karMarji < 0 ? 'red' : karMarji < 5 ? 'yellow' : 'green'}
                >
                  %{karMarji.toFixed(1)}
                </Text>
                {karMarji < 0 && (
                  <Badge color="red" size="sm">
                    ZARAR
                  </Badge>
                )}
              </Group>
            </div>

            <Progress
              value={Math.min(100, (toplamMaliyet / bizimTeklif) * 100) || 0}
              color={
                toplamMaliyet > bizimTeklif
                  ? 'red'
                  : toplamMaliyet > bizimTeklif * 0.95
                    ? 'yellow'
                    : 'green'
              }
              size="lg"
              radius="xl"
            />

            <Text size="xs" c="dimmed" ta="center">
              {toplamMaliyet > bizimTeklif
                ? '⚠️ Maliyet tekliften yüksek!'
                : toplamMaliyet > bizimTeklif * 0.95
                  ? '⚠️ Kar marjı çok düşük'
                  : '✓ Açıklama kabul edilebilir'}
            </Text>
          </Stack>
        </Paper>
      </SimpleGrid>
    </Stack>
  );

  const renderTeminat = () => (
    <Stack gap="md">
      <Paper
        p="md"
        bg="rgba(81, 207, 102, 0.1)"
        radius="md"
        style={{ border: '1px solid var(--mantine-color-green-6)' }}
      >
        <Group gap="xs" mb="xs">
          <IconShieldCheck size={16} color="var(--mantine-color-green-6)" />
          <Text size="sm" fw={600} c="green">
            Teminat Hesaplamaları
          </Text>
        </Group>
        <Text size="xs" c="dimmed">
          4734 sayılı Kamu İhale Kanunu'na göre geçici teminat %3, kesin teminat %6 oranında alınır.
        </Text>
      </Paper>

      <SimpleGrid cols={3} spacing="md">
        <Card padding="lg" radius="md" withBorder>
          <Stack align="center" gap="md">
            <ThemeIcon size={50} radius="xl" variant="light" color="blue">
              <IconPercentage size={24} />
            </ThemeIcon>
            <Text size="xs" c="dimmed">
              Geçici Teminat (%3)
            </Text>
            <Text size="xl" fw={700} c="blue">
              {geciciTeminat > 0
                ? `${geciciTeminat.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺`
                : '—'}
            </Text>
            <Text size="xs" c="dimmed">
              Teklif ile birlikte
            </Text>
          </Stack>
        </Card>

        <Card padding="lg" radius="md" withBorder>
          <Stack align="center" gap="md">
            <ThemeIcon size={50} radius="xl" variant="light" color="green">
              <IconShieldCheck size={24} />
            </ThemeIcon>
            <Text size="xs" c="dimmed">
              Kesin Teminat (%6)
            </Text>
            <Text size="xl" fw={700} c="green">
              {kesinTeminat > 0
                ? `${kesinTeminat.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺`
                : '—'}
            </Text>
            <Text size="xs" c="dimmed">
              Sözleşme imzasında
            </Text>
          </Stack>
        </Card>

        <Card padding="lg" radius="md" withBorder>
          <Stack align="center" gap="md">
            <ThemeIcon size={50} radius="xl" variant="light" color="orange">
              <IconCurrencyLira size={24} />
            </ThemeIcon>
            <Text size="xs" c="dimmed">
              Toplam Teminat
            </Text>
            <Text size="xl" fw={700} c="orange">
              {geciciTeminat + kesinTeminat > 0
                ? `${(geciciTeminat + kesinTeminat).toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺`
                : '—'}
            </Text>
            <Text size="xs" c="dimmed">
              (%9 toplam)
            </Text>
          </Stack>
        </Card>
      </SimpleGrid>

      {bizimTeklif > 0 && (
        <Paper p="md" bg="dark.7" radius="md">
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Kalem</Table.Th>
                <Table.Th ta="right">Oran</Table.Th>
                <Table.Th ta="right">Tutar</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              <Table.Tr>
                <Table.Td>Geçici Teminat</Table.Td>
                <Table.Td ta="right">%3</Table.Td>
                <Table.Td ta="right" fw={600}>
                  {geciciTeminat.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺
                </Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>Kesin Teminat</Table.Td>
                <Table.Td ta="right">%6</Table.Td>
                <Table.Td ta="right" fw={600}>
                  {kesinTeminat.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺
                </Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>Damga Vergisi</Table.Td>
                <Table.Td ta="right">‰9.48</Table.Td>
                <Table.Td ta="right" fw={600}>
                  {(bizimTeklif * 0.00948).toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺
                </Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>KİK Payı</Table.Td>
                <Table.Td ta="right">‰0.5</Table.Td>
                <Table.Td ta="right" fw={600}>
                  {(bizimTeklif * 0.0005).toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺
                </Table.Td>
              </Table.Tr>
              <Table.Tr style={{ background: 'var(--mantine-color-dark-6)' }}>
                <Table.Td fw={700}>TOPLAM MALİYET</Table.Td>
                <Table.Td ta="right">—</Table.Td>
                <Table.Td ta="right" fw={700} c="orange">
                  {(
                    geciciTeminat +
                    kesinTeminat +
                    bizimTeklif * 0.00948 +
                    bizimTeklif * 0.0005
                  ).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}{' '}
                  ₺
                </Table.Td>
              </Table.Tr>
            </Table.Tbody>
          </Table>
        </Paper>
      )}
    </Stack>
  );

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="sm">
          <ThemeIcon size="lg" variant="gradient" gradient={{ from: 'blue', to: 'cyan' }}>
            <IconCalculator size={20} />
          </ThemeIcon>
          <div>
            <Title order={4}>İhale Hesaplama Merkezi</Title>
            <Text size="xs" c="dimmed">
              Profesyonel teklif analizi ve risk değerlendirmesi
            </Text>
          </div>
        </Group>
      }
      size="900px"
      centered
      overlayProps={{ backgroundOpacity: 0.55, blur: 3 }}
    >
      <Stack gap="md">
        {/* İhale Bilgisi + Tespit Edilen Veriler */}
        {(isSuresi || toplamOgun > 0) && (
          <Paper
            p="sm"
            bg="rgba(20, 184, 166, 0.08)"
            radius="md"
            style={{ border: '1px solid var(--mantine-color-teal-6)' }}
          >
            <Group gap="xs" mb="xs">
              <IconSparkles size={14} color="var(--mantine-color-teal-6)" />
              <Text size="xs" fw={600} c="teal">
                Döküman Analizinden Tespit Edildi
              </Text>
            </Group>
            <SimpleGrid cols={4} spacing="md">
              {isSuresi && (
                <Box>
                  <Text size="xs" c="dimmed">
                    Süre
                  </Text>
                  <Text size="sm" fw={600}>
                    {isSuresi}
                  </Text>
                </Box>
              )}
              {toplamOgun > 0 && (
                <Box>
                  <Text size="xs" c="dimmed">
                    Toplam Öğün
                  </Text>
                  <Text size="sm" fw={600}>
                    {toplamOgun.toLocaleString('tr-TR')}
                  </Text>
                </Box>
              )}
              {gunlukOgun > 0 && (
                <Box>
                  <Text size="xs" c="dimmed">
                    Günlük Öğün
                  </Text>
                  <Text size="sm" fw={600}>
                    ~{gunlukOgun.toLocaleString('tr-TR')}
                  </Text>
                </Box>
              )}
              {(teknikSartSayisi > 0 || birimFiyatSayisi > 0) && (
                <Box>
                  <Text size="xs" c="dimmed">
                    Döküman
                  </Text>
                  <Text size="sm" fw={600}>
                    {teknikSartSayisi} şart, {birimFiyatSayisi} kalem
                  </Text>
                </Box>
              )}
            </SimpleGrid>
          </Paper>
        )}

        {/* Tool Selector */}
        <SegmentedControl
          fullWidth
          value={activeTool}
          onChange={(v) => setActiveTool(v as ActiveTool)}
          data={[
            { label: '💰 Temel Hesaplama', value: 'temel' },
            { label: '📊 KİK Sınır Değer', value: 'sinir' },
            { label: '⚠️ Aşırı Düşük', value: 'asiri' },
            { label: '🛡️ Teminat', value: 'teminat' },
          ]}
          styles={{
            root: { background: 'var(--mantine-color-dark-7)' },
          }}
        />

        {/* Tool Content */}
        <ScrollArea h={400}>
          {activeTool === 'temel' && renderTemelHesaplama()}
          {activeTool === 'sinir' && renderKikSinirDeger()}
          {activeTool === 'asiri' && renderAsiriDusuk()}
          {activeTool === 'teminat' && renderTeminat()}
        </ScrollArea>

        {/* Detaylı Analiz - Alt kısım */}
        {yaklasikMaliyet > 0 && bizimTeklif > 0 && (
          <>
            <Divider label="Detaylı Analiz" labelPosition="center" />
            <SimpleGrid cols={4} spacing="sm">
              <Paper p="sm" bg="dark.7" radius="md" ta="center">
                <Text size="xs" c="dimmed">
                  Öğün Başı Maliyet
                </Text>
                <Text size="md" fw={700} c="blue">
                  {ogunBasiMaliyet > 0 ? `${ogunBasiMaliyet.toFixed(2)} ₺` : '—'}
                </Text>
              </Paper>
              <Paper p="sm" bg="dark.7" radius="md" ta="center">
                <Text size="xs" c="dimmed">
                  Öğün Başı Teklif
                </Text>
                <Text size="md" fw={700} c="green">
                  {ogunBasiTeklif > 0 ? `${ogunBasiTeklif.toFixed(2)} ₺` : '—'}
                </Text>
              </Paper>
              <Paper p="sm" bg="dark.7" radius="md" ta="center">
                <Text size="xs" c="dimmed">
                  Aylık Maliyet
                </Text>
                <Text size="md" fw={700}>
                  {aylikMaliyet > 0 ? `${(aylikMaliyet / 1000000).toFixed(1)}M ₺` : '—'}
                </Text>
              </Paper>
              <Paper p="sm" bg="dark.7" radius="md" ta="center">
                <Text size="xs" c="dimmed">
                  Geçici Teminat
                </Text>
                <Text size="md" fw={700} c="orange">
                  {geciciTeminat > 0 ? `${(geciciTeminat / 1000000).toFixed(1)}M ₺` : '—'}
                </Text>
              </Paper>
            </SimpleGrid>
          </>
        )}

        {/* Aksiyon Butonları */}
        <Group justify="flex-end" mt="md">
          <Button variant="subtle" onClick={onClose}>
            İptal
          </Button>
          <Button
            onClick={handleSave}
            loading={saving}
            leftSection={<IconCheck size={16} />}
            variant="gradient"
            gradient={{ from: 'blue', to: 'cyan' }}
          >
            Kaydet ve Kapat
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
