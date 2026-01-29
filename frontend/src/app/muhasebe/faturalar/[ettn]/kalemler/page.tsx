'use client';

import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Container,
  Divider,
  Group,
  Loader,
  Modal,
  NumberInput,
  Paper,
  ScrollArea,
  Select,
  Skeleton,
  Stack,
  Table,
  Text,
  TextInput,
  ThemeIcon,
  Title,
  Tooltip,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconAlertCircle,
  IconArrowLeft,
  IconCalculator,
  IconCheck,
  IconCircleCheck,
  IconCircleDashed,
  IconLink,
  IconPackage,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconTag,
  IconWand,
  IconX,
} from '@tabler/icons-react';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  type UrunArama as APIUrunArama,
  type FiyatGuncelleme,
  faturaKalemleriAPI,
} from '@/lib/api/services/fatura-kalemleri';
import { formatDate, formatMoney } from '@/lib/formatters';

// Tip tanımları (sayfa görünümü; API kaleminden map edilir)
interface FaturaKalem {
  id: number;
  kalem_sira: number;
  fatura_urun_adi: string;
  fatura_urun_kodu: string | null;
  miktar: number;
  birim: string;
  birim_fiyat: number;
  tutar: number;
  kdv_orani: number;
  urun_id: number | null;
  urun_kod: string | null;
  urun_ad: string | null;
  kategori_id: number | null;
  kategori_ad: string | null;
  kategori_renk: string | null;
  eslestirme_tarihi: string | null;
  birim_carpani?: number;
  standart_birim?: string;
  standart_birim_fiyat?: number;
  mapping_id?: number;
}

interface UrunOneri {
  urun_id: number;
  urun_kod: string;
  urun_ad: string;
  eslestirme_sayisi: number;
  son_fiyat: number | null;
  kaynak: string;
}

interface FaturaBilgi {
  ettn: string;
  tedarikci: string;
  tedarikci_vkn: string;
  tarih: string;
  toplam: number;
}

export default function FaturaKalemlerPage() {
  const params = useParams();
  const router = useRouter();
  const ettn = (params?.ettn as string) ?? '';

  // State
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [kalemler, setKalemler] = useState<FaturaKalem[]>([]);
  const [fatura, setFatura] = useState<FaturaBilgi | null>(null);
  const [seciliKalem, setSeciliKalem] = useState<FaturaKalem | null>(null);
  const [aramaMetni, setAramaMetni] = useState('');
  const [aramaLoading, setAramaLoading] = useState(false);
  const [aramaSonuclari, setAramaSonuclari] = useState<APIUrunArama[]>([]);
  const [oneriler, setOneriler] = useState<UrunOneri[]>([]);
  const [otomatikLoading, setOtomatikLoading] = useState(false);

  // Modal
  const [modalAcik, { open: modalAc, close: modalKapat }] = useDisclosure(false);
  const [yeniUrunModalAcik, { open: yeniUrunModalAc, close: yeniUrunModalKapat }] =
    useDisclosure(false);
  const [birimCarpaniModalAcik, { open: birimCarpaniModalAc, close: birimCarpaniModalKapat }] =
    useDisclosure(false);
  const [yeniUrunAdi, setYeniUrunAdi] = useState('');

  // Birim çarpanı state'leri
  const [seciliUrun, setSeciliUrun] = useState<{ id: number; ad: string; kod: string } | null>(
    null
  );
  const [birimCarpani, setBirimCarpani] = useState<number>(1);
  const [standartBirim, setStandartBirim] = useState<string>('KG');
  // Mini hesaplayıcı (ör: 48 × 250 gr → 12 KG)
  const [calcAdet, setCalcAdet] = useState<number | ''>('');
  const [calcBirimDeger, setCalcBirimDeger] = useState<number | ''>('');
  const [calcHedefBirim, setCalcHedefBirim] = useState<'KG' | 'LT'>('KG');

  // Verileri yükle (TEK KAYNAK: faturaKalemleriAPI)
  const verileriYukle = useCallback(async () => {
    try {
      setLoading(true);
      const data = await faturaKalemleriAPI.getKalemler(ettn);
      if (process.env.NODE_ENV === 'development') {
        console.log('[FaturaKalemler] getKalemler yanıtı:', {
          ettn,
          kaynak: data.kaynak,
          kalemSayisi: data.kalemler?.length,
          fatura: !!data.fatura,
        });
      }
      setKalemler(
        (data.kalemler ?? []).map((k) => {
          const raw = k as unknown as Record<string, unknown>;
          return {
            id: k.id,
            kalem_sira: k.kalem_sira,
            fatura_urun_adi: k.orijinal_urun_adi,
            fatura_urun_kodu: k.orijinal_urun_kodu,
            miktar: k.miktar,
            birim: k.birim,
            birim_fiyat: k.birim_fiyat,
            tutar: k.tutar,
            kdv_orani: k.kdv_orani,
            urun_id: k.urun_id,
            urun_kod: k.urun_kod,
            urun_ad: k.urun_ad,
            kategori_id: null,
            kategori_ad: k.kategori_ad,
            kategori_renk: null,
            eslestirme_tarihi: k.eslestirme_tarihi,
            birim_carpani: raw.birim_carpani != null ? Number(raw.birim_carpani) : undefined,
            standart_birim: raw.standart_birim != null ? String(raw.standart_birim) : undefined,
            standart_birim_fiyat:
              raw.standart_birim_fiyat != null ? Number(raw.standart_birim_fiyat) : undefined,
            mapping_id: raw.mapping_id != null ? Number(raw.mapping_id) : undefined,
          };
        })
      );
      if (data.fatura) {
        const f = data.fatura as Record<string, unknown>;
        setFatura({
          ettn: String(f.ettn ?? ettn),
          tedarikci: String(f.sender_name ?? f.tedarikci ?? ''),
          tedarikci_vkn: String(f.sender_vkn ?? f.tedarikci_vkn ?? ''),
          tarih: String(f.invoice_date ?? f.tarih ?? ''),
          toplam: Number(f.total_amount ?? f.toplam ?? 0),
        });
      } else {
        setFatura(null);
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string }; status?: number } };
      const msg =
        err?.response?.data?.error ??
        (error instanceof Error ? error.message : 'Kalemler yüklenemedi');
      if (process.env.NODE_ENV === 'development') {
        console.error('[FaturaKalemler] getKalemler hatası:', {
          ettn,
          status: err?.response?.status,
          message: msg,
          error,
        });
      }
      notifications.show({
        title: 'Hata',
        message: msg,
        color: 'red',
        icon: <IconAlertCircle size={18} />,
      });
    } finally {
      setLoading(false);
    }
  }, [ettn]);

  useEffect(() => {
    if (ettn) {
      verileriYukle();
    }
  }, [ettn, verileriYukle]);

  // Birim Dönüşümü modalı her açıldığında mini hesaplayıcıyı temizle (başka ürüne geçince eski 48/250 vb. kalmasın)
  useEffect(() => {
    if (birimCarpaniModalAcik) {
      setCalcAdet('');
      setCalcBirimDeger('');
      setCalcHedefBirim('KG');
    }
  }, [birimCarpaniModalAcik]);

  // Ürün ara (TEK KAYNAK: faturaKalemleriAPI)
  const urunAra = useCallback(async (aramaMetni: string) => {
    if (!aramaMetni || aramaMetni.length < 2) {
      setAramaSonuclari([]);
      return;
    }
    try {
      setAramaLoading(true);
      const sonuclar = await faturaKalemleriAPI.urunAra(aramaMetni, 15);
      setAramaSonuclari(sonuclar);
    } catch (error) {
      console.error('Ürün araması hatası:', error);
    } finally {
      setAramaLoading(false);
    }
  }, []);

  // Öneri getir (TEK KAYNAK: faturaKalemleriAPI)
  const oneriGetir = useCallback(async (urunAdi: string, tedarikciVkn?: string) => {
    try {
      const sonuclar = await faturaKalemleriAPI.getOneriler(urunAdi, tedarikciVkn);
      setOneriler(sonuclar as unknown as UrunOneri[]);
    } catch (error) {
      console.error('Öneri getirme hatası:', error);
      setOneriler([]);
    }
  }, []);

  // Kalem seç ve modal aç
  const kalemSec = (kalem: FaturaKalem) => {
    setSeciliKalem(kalem);
    setAramaMetni('');
    setAramaSonuclari([]);
    oneriGetir(kalem.fatura_urun_adi, fatura?.tedarikci_vkn);
    modalAc();
  };

  // Eşleştir veya kaldır (TEK KAYNAK: faturaKalemleriAPI)
  const eslesdir = async (kalemSira: number, urunId: number | null) => {
    try {
      setSaving(true);
      const updated = urunId
        ? await faturaKalemleriAPI.eslesdir(ettn, kalemSira, urunId)
        : await faturaKalemleriAPI.eslesmeKaldir(ettn, kalemSira);

      // Fiyat güncelleme bilgisi (eşleştirme yapıldıysa)
      const fiyatGuncelleme = (updated as { fiyat_guncelleme?: FiyatGuncelleme | null })
        .fiyat_guncelleme;

      // Notification mesajını oluştur
      let mesaj = urunId ? 'Kalem eşleştirildi' : 'Eşleştirme kaldırıldı';
      if (fiyatGuncelleme?.guncellendi) {
        const eskiFiyat = fiyatGuncelleme.eski_fiyat ?? 0;
        const yeniFiyat = fiyatGuncelleme.yeni_fiyat ?? 0;
        mesaj = `${fiyatGuncelleme.urun_ad || 'Ürün'} fiyatı güncellendi: ${eskiFiyat.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}₺ → ${yeniFiyat.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}₺`;
      }

      notifications.show({
        title: fiyatGuncelleme?.guncellendi ? 'Fiyat Güncellendi' : 'Başarılı',
        message: mesaj,
        color: 'green',
        icon: <IconCheck size={18} />,
        autoClose: fiyatGuncelleme?.guncellendi ? 5000 : 3000, // Fiyat güncellendiyse daha uzun göster
      });

      setKalemler((prev) =>
        prev.map((k) =>
          k.kalem_sira === kalemSira
            ? {
                ...k,
                urun_id: urunId ?? null,
                urun_kod: updated.urun_kod ?? null,
                urun_ad: updated.urun_ad ?? null,
                kategori_ad: updated.kategori_ad ?? null,
                eslestirme_tarihi: updated.eslestirme_tarihi ?? null,
              }
            : k
        )
      );
      modalKapat();
    } catch (error: unknown) {
      const msg =
        error instanceof Error
          ? error.message
          : ((error as { response?: { data?: { error?: string } } })?.response?.data?.error ??
            'Eşleştirme başarısız');
      notifications.show({ title: 'Hata', message: msg, color: 'red' });
    } finally {
      setSaving(false);
    }
  };

  // Otomatik eşleştir: Eşleşmemiş kalemleri geçmiş eşleşmelere göre toplu eşleştir
  const otomatikEslesdir = async () => {
    try {
      setOtomatikLoading(true);
      const result = await faturaKalemleriAPI.topluOtomatikEslesdir(ettn);
      if (result.data.basarili > 0) {
        notifications.show({
          title: 'Başarılı',
          message: `${result.data.basarili} kalem otomatik eşleştirildi`,
          color: 'green',
        });
        verileriYukle();
      } else {
        notifications.show({
          title: 'Bilgi',
          message: 'Otomatik eşleştirilebilecek kalem bulunamadı',
          color: 'yellow',
        });
      }
    } catch {
      notifications.show({
        title: 'Hata',
        message: 'Otomatik eşleştirme başarısız',
        color: 'red',
      });
    } finally {
      setOtomatikLoading(false);
    }
  };

  // Yeni ürün oluştur (TEK KAYNAK: faturaKalemleriAPI)
  const yeniUrunOlustur = async () => {
    if (!yeniUrunAdi.trim()) return;
    try {
      setSaving(true);
      const created = (await faturaKalemleriAPI.hizliUrunOlustur({ ad: yeniUrunAdi.trim() })) as {
        id?: number;
        kod?: string;
        ad?: string;
      };
      if (created?.id) {
        notifications.show({
          title: 'Başarılı',
          message: 'Ürün kartı oluşturuldu',
          color: 'green',
          icon: <IconCheck size={18} />,
        });
        // Yeni ürün için birim çarpanı modalini aç
        setSeciliUrun({
          id: created.id,
          ad: created.ad || yeniUrunAdi.trim(),
          kod: created.kod || '',
        });
        setBirimCarpani(1);
        setStandartBirim('KG');
        yeniUrunModalKapat();
        setYeniUrunAdi('');
        birimCarpaniModalAc();
      }
    } catch (error: unknown) {
      const msg =
        error instanceof Error
          ? error.message
          : ((error as { response?: { data?: { error?: string } } })?.response?.data?.error ??
            'Ürün oluşturulamadı');
      notifications.show({ title: 'Hata', message: msg, color: 'red' });
    } finally {
      setSaving(false);
    }
  };

  // Birim çarpanı ile eşleştir
  const birimCarpaniIleEslesdir = async () => {
    if (!seciliKalem || !seciliUrun) return;
    try {
      setSaving(true);

      // Birim çarpanı ve st. birim ürün kartına + fatura kalemine yazılsın (yenileyince 204,12/KG kalsın)
      const updated = await faturaKalemleriAPI.eslesdir(
        ettn,
        seciliKalem.kalem_sira,
        seciliUrun.id,
        {
          birim_carpani:
            typeof birimCarpani === 'number' ? birimCarpani : Number(birimCarpani) || 1,
          standart_birim:
            standartBirim && String(standartBirim).trim() ? String(standartBirim).trim() : 'KG',
        }
      );

      // Fiyat güncelleme bilgisi
      const fiyatGuncelleme = (updated as { fiyat_guncelleme?: FiyatGuncelleme | null })
        .fiyat_guncelleme;

      // Hesaplanan standart fiyat
      const hesaplananStdFiyat = seciliKalem.birim_fiyat / (birimCarpani || 1);

      notifications.show({
        title: fiyatGuncelleme?.guncellendi ? 'Fiyat Güncellendi' : 'Başarılı',
        message: `Eşleştirildi. ₺/St.Birim: ${formatMoney(hesaplananStdFiyat)}/${standartBirim}`,
        color: 'green',
        icon: <IconCheck size={18} />,
        autoClose: 5000,
      });

      // State'ı güncelle
      setKalemler((prev) =>
        prev.map((k) =>
          k.kalem_sira === seciliKalem.kalem_sira
            ? {
                ...k,
                urun_id: seciliUrun.id,
                urun_kod: updated.urun_kod ?? seciliUrun.kod,
                urun_ad: updated.urun_ad ?? seciliUrun.ad,
                kategori_ad: updated.kategori_ad ?? null,
                eslestirme_tarihi: updated.eslestirme_tarihi ?? null,
                birim_carpani: birimCarpani,
                standart_birim: standartBirim,
                standart_birim_fiyat: hesaplananStdFiyat,
              }
            : k
        )
      );

      birimCarpaniModalKapat();
      modalKapat();
      setSeciliUrun(null);
    } catch (error: unknown) {
      const msg =
        error instanceof Error
          ? error.message
          : ((error as { response?: { data?: { error?: string } } })?.response?.data?.error ??
            'Eşleştirme başarısız');
      notifications.show({ title: 'Hata', message: msg, color: 'red' });
    } finally {
      setSaving(false);
    }
  };

  // Ürün seç ve birim çarpanı modalini aç
  const urunSecVeCarpanSor = (urun: { id: number; ad: string; kod: string }) => {
    setSeciliUrun(urun);
    setBirimCarpani(1);
    setStandartBirim('KG');
    setCalcAdet('');
    setCalcBirimDeger('');
    setCalcHedefBirim('KG');
    birimCarpaniModalAc();
  };

  // Ürün adından "250 GR *48" tarzı ifadeyi parse et, mini hesaplayıcıya doldur
  const urunAdindanDoldur = () => {
    if (!seciliKalem?.fatura_urun_adi) return;
    const s = seciliKalem.fatura_urun_adi;
    const adetMatch = s.match(/\*(\d+)/);
    const grMatch = s.match(/(\d+(?:[.,]\d+)?)\s*GR/i);
    const mlMatch = s.match(/(\d+(?:[.,]\d+)?)\s*ML/i);
    if (adetMatch) setCalcAdet(parseInt(adetMatch[1], 10));
    if (grMatch) {
      setCalcBirimDeger(parseFloat(grMatch[1].replace(',', '.')));
      setCalcHedefBirim('KG');
    }
    if (mlMatch) {
      setCalcBirimDeger(parseFloat(mlMatch[1].replace(',', '.')));
      setCalcHedefBirim('LT');
    }
  };

  // Mini hesaplayıcı sonucunu Birim Çarpanı / Standart Birim'e uygula
  const calcUygula = () => {
    const adet = typeof calcAdet === 'number' ? calcAdet : 0;
    const deger = typeof calcBirimDeger === 'number' ? calcBirimDeger : 0;
    if (!adet || !deger) return;
    const sonuc = adet * (deger / 1000);
    setBirimCarpani(Math.round(sonuc * 1000) / 1000);
    setStandartBirim(calcHedefBirim);
  };

  // İstatistikler
  const eslesmis = kalemler.filter((k) => k.urun_id !== null).length;
  const eslesmemis = kalemler.length - eslesmis;
  const eslesmeYuzdesi = kalemler.length > 0 ? Math.round((eslesmis / kalemler.length) * 100) : 0;

  // Birim formatla (UBL kod → okunaklı; NPL = koli)
  const birimFormatla = (birim: string | null | undefined) => {
    const kod = (birim ?? '').toUpperCase();
    const birimler: Record<string, string> = {
      KGM: 'KG',
      LTR: 'LT',
      C62: 'Adet',
      NPL: 'Koli',
      MTR: 'M',
      MTK: 'M²',
      MTQ: 'M³',
      GRM: 'GR',
      MLT: 'ML',
    };
    return birimler[kod] || birim || 'Adet';
  };

  // ETTN yoksa (yanlış URL) faturalar listesine yönlendir
  if (!ettn) {
    return (
      <Container size="xl" py="md">
        <Alert color="red" title="Fatura bulunamadı">
          <Text size="sm" mb="md">
            Geçerli bir fatura seçmediniz. Lütfen faturalar listesinden bir faturayı açıp
            &quot;Kalemler &amp; Eşleştir&quot; ile bu sayfaya girin.
          </Text>
          <Button
            variant="light"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => router.push('/muhasebe/faturalar')}
          >
            Faturalara Dön
          </Button>
        </Alert>
      </Container>
    );
  }

  if (loading) {
    return (
      <Container size="xl" py="md">
        <Stack gap="md">
          <Skeleton height={60} />
          <Skeleton height={400} />
        </Stack>
      </Container>
    );
  }

  return (
    <Container size="xl" py="md">
      <Stack gap="md">
        {/* Header */}
        <Paper p="md" withBorder>
          <Group justify="space-between" align="flex-start">
            <Group>
              <ActionIcon variant="light" size="lg" onClick={() => router.back()}>
                <IconArrowLeft size={20} />
              </ActionIcon>
              <Box>
                <Title order={4}>Fatura Kalemleri</Title>
                {fatura && (
                  <Text size="sm" c="dimmed">
                    {fatura.tedarikci} • {formatDate(fatura.tarih)} • {formatMoney(fatura.toplam)}
                  </Text>
                )}
              </Box>
            </Group>

            <Group>
              <Badge
                size="lg"
                variant="light"
                color={eslesmeYuzdesi === 100 ? 'green' : eslesmeYuzdesi > 50 ? 'yellow' : 'red'}
                leftSection={<IconLink size={14} />}
              >
                {eslesmis}/{kalemler.length} Eşleştirildi ({eslesmeYuzdesi}%)
              </Badge>
              <Button
                leftSection={<IconWand size={16} />}
                variant="light"
                color="green"
                onClick={otomatikEslesdir}
                loading={otomatikLoading}
                disabled={eslesmis === kalemler.length}
              >
                Otomatik Eşleştir
              </Button>
              <Button
                leftSection={<IconRefresh size={16} />}
                variant="light"
                onClick={verileriYukle}
                loading={loading}
              >
                Yenile
              </Button>
            </Group>
          </Group>
        </Paper>

        {/* Kalemler Tablosu */}
        <Card withBorder>
          <ScrollArea>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ width: 50 }}>#</Table.Th>
                  <Table.Th>Fatura Ürün Adı</Table.Th>
                  <Table.Th style={{ width: 100, textAlign: 'right' }}>Miktar</Table.Th>
                  <Table.Th
                    style={{ width: 100, textAlign: 'right' }}
                    title="Fatura birim fiyatı (koli/kutu vb.)"
                  >
                    B. Fiyat
                  </Table.Th>
                  <Table.Th style={{ width: 120, textAlign: 'right' }}>Tutar</Table.Th>
                  <Table.Th
                    style={{ width: 120, textAlign: 'right' }}
                    title="Stok birimine (KG, LT vb.) dönüştürülmüş birim fiyatı"
                  >
                    ₺/St.Birim
                  </Table.Th>
                  <Table.Th style={{ width: 250 }}>Ürün Kartı</Table.Th>
                  <Table.Th style={{ width: 100 }}>İşlem</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {kalemler.map((kalem) => (
                  <Table.Tr key={kalem.id ?? `kalem-${kalem.kalem_sira}`}>
                    <Table.Td>
                      <Text size="sm" c="dimmed">
                        {kalem.kalem_sira}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" fw={500}>
                        {kalem.fatura_urun_adi}
                      </Text>
                      {kalem.fatura_urun_kodu && (
                        <Text size="xs" c="dimmed">
                          Kod: {kalem.fatura_urun_kodu}
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      <Text size="sm">
                        {kalem.miktar} {birimFormatla(kalem.birim)}
                      </Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      <Text size="sm">{formatMoney(kalem.birim_fiyat)}</Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      <Text size="sm" fw={500}>
                        {formatMoney(kalem.tutar)}
                      </Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      {kalem.urun_id && kalem.standart_birim_fiyat ? (
                        <Tooltip
                          label={
                            <Stack gap={4}>
                              <Text size="xs" fw={500}>
                                Hesaplama Detayı
                              </Text>
                              <Text size="xs">Fatura Fiyatı: {formatMoney(kalem.birim_fiyat)}</Text>
                              <Text size="xs">Birim Çarpanı: {kalem.birim_carpani || 1}</Text>
                              <Divider my={4} />
                              <Text size="xs" fw={500}>
                                {formatMoney(kalem.birim_fiyat)} / {kalem.birim_carpani || 1} ={' '}
                                {formatMoney(kalem.standart_birim_fiyat)}/
                                {kalem.standart_birim || 'KG'}
                              </Text>
                            </Stack>
                          }
                          position="left"
                          withArrow
                          multiline
                          w={220}
                        >
                          <Group gap={4} justify="flex-end" style={{ cursor: 'help' }}>
                            <Text size="sm" fw={500} c="blue">
                              {formatMoney(kalem.standart_birim_fiyat)}
                            </Text>
                            <Text size="xs" c="dimmed">
                              /{kalem.standart_birim || 'KG'}
                            </Text>
                          </Group>
                        </Tooltip>
                      ) : (
                        <Text size="sm" c="dimmed">
                          -
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      {kalem.urun_id ? (
                        <Group gap="xs">
                          <ThemeIcon size="sm" color="green" variant="light">
                            <IconCircleCheck size={14} />
                          </ThemeIcon>
                          <Box>
                            <Text size="sm" fw={500}>
                              {kalem.urun_ad}
                            </Text>
                            {kalem.kategori_ad && (
                              <Badge
                                size="xs"
                                variant="light"
                                color={kalem.kategori_renk || 'gray'}
                              >
                                {kalem.kategori_ad}
                              </Badge>
                            )}
                          </Box>
                        </Group>
                      ) : (
                        <Group gap="xs">
                          <ThemeIcon size="sm" color="gray" variant="light">
                            <IconCircleDashed size={14} />
                          </ThemeIcon>
                          <Text size="sm" c="dimmed">
                            Eşleştirilmedi
                          </Text>
                        </Group>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Button
                        size="xs"
                        variant={kalem.urun_id ? 'subtle' : 'filled'}
                        color={kalem.urun_id ? 'gray' : 'blue'}
                        leftSection={<IconTag size={14} />}
                        onClick={() => kalemSec(kalem)}
                      >
                        {kalem.urun_id ? 'Değiştir' : 'Eşleştir'}
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Card>

        {/* Özet */}
        {eslesmemis > 0 && (
          <Alert color="yellow" icon={<IconAlertCircle size={18} />}>
            <Text size="sm">
              <strong>{eslesmemis} kalem</strong> henüz bir ürün kartına eşleştirilmedi. Maliyet
              hesaplaması için tüm kalemleri eşleştirmeniz önerilir.
            </Text>
          </Alert>
        )}
      </Stack>

      {/* Eşleştirme Modal */}
      <Modal
        opened={modalAcik}
        onClose={modalKapat}
        title={
          <Group gap="xs">
            <IconTag size={20} />
            <Text fw={600}>Ürün Eşleştir</Text>
          </Group>
        }
        size="lg"
      >
        {seciliKalem && (
          <Stack gap="md">
            {/* Seçili kalem bilgisi */}
            <Paper p="sm" className="nested-card">
              <Text size="sm" fw={600}>
                {seciliKalem.fatura_urun_adi}
              </Text>
              <Text size="xs" c="dimmed">
                {seciliKalem.miktar} {birimFormatla(seciliKalem.birim)} ×{' '}
                {formatMoney(seciliKalem.birim_fiyat)} = {formatMoney(seciliKalem.tutar)}
              </Text>
            </Paper>

            {/* Öneriler */}
            {oneriler.length > 0 && (
              <Box>
                <Text size="sm" fw={500} mb="xs">
                  Önerilen Eşleştirmeler
                </Text>
                <Stack gap="xs">
                  {oneriler.map((oneri, idx) => (
                    <Paper
                      key={`oneri-${oneri.urun_id}-${idx}`}
                      p="sm"
                      withBorder
                      style={{ cursor: 'pointer' }}
                      onClick={() =>
                        urunSecVeCarpanSor({
                          id: oneri.urun_id,
                          ad: oneri.urun_ad,
                          kod: oneri.urun_kod,
                        })
                      }
                    >
                      <Group justify="space-between">
                        <Box>
                          <Text size="sm" fw={500}>
                            {oneri.urun_ad}
                          </Text>
                          <Group gap="xs">
                            <Badge size="xs" variant="dot">
                              {oneri.urun_kod}
                            </Badge>
                            <Text size="xs" c="dimmed">
                              {oneri.eslestirme_sayisi}× eşleştirilmiş
                            </Text>
                          </Group>
                        </Box>
                        {oneri.son_fiyat && (
                          <Text size="sm" c="dimmed">
                            Son: {formatMoney(oneri.son_fiyat)}
                          </Text>
                        )}
                      </Group>
                    </Paper>
                  ))}
                </Stack>
              </Box>
            )}

            <Divider label="veya" labelPosition="center" />

            {/* Ürün Arama */}
            <Box>
              <TextInput
                placeholder="Ürün ara (kod veya ad)..."
                leftSection={<IconSearch size={16} />}
                rightSection={aramaLoading && <Loader size="xs" />}
                value={aramaMetni}
                onChange={(e) => {
                  setAramaMetni(e.target.value);
                  urunAra(e.target.value);
                }}
              />

              {aramaSonuclari.length > 0 && (
                <Paper withBorder mt="xs" mah={200} style={{ overflow: 'auto' }}>
                  {aramaSonuclari.map((urun, idx) => (
                    <Box
                      key={`aranan-${urun.id ?? idx}`}
                      p="sm"
                      style={{
                        cursor: 'pointer',
                        borderBottom: '1px solid var(--mantine-color-gray-2)',
                      }}
                      onClick={() =>
                        urunSecVeCarpanSor({ id: urun.id, ad: urun.ad, kod: urun.kod })
                      }
                    >
                      <Group justify="space-between">
                        <Box>
                          <Text size="sm" fw={500}>
                            {urun.ad}
                          </Text>
                          <Group gap="xs">
                            <Badge size="xs" variant="dot">
                              {urun.kod}
                            </Badge>
                            {urun.kategori_ad && (
                              <Badge size="xs" variant="light" color="gray">
                                {urun.kategori_ad}
                              </Badge>
                            )}
                          </Group>
                        </Box>
                        {(urun.son_fiyat != null || urun.ortalama_fiyat != null) && (
                          <Text size="xs" c="dimmed">
                            {formatMoney(urun.son_fiyat ?? urun.ortalama_fiyat ?? 0)}
                          </Text>
                        )}
                      </Group>
                    </Box>
                  ))}
                </Paper>
              )}
            </Box>

            <Divider label="veya" labelPosition="center" />

            {/* Yeni Ürün Oluştur */}
            <Button
              variant="light"
              leftSection={<IconPlus size={16} />}
              onClick={() => {
                setYeniUrunAdi(seciliKalem.fatura_urun_adi);
                yeniUrunModalAc();
              }}
            >
              Yeni Ürün Kartı Oluştur
            </Button>

            {/* Eşleştirmeyi Kaldır */}
            {seciliKalem.urun_id && (
              <>
                <Divider />
                <Button
                  variant="subtle"
                  color="red"
                  leftSection={<IconX size={16} />}
                  onClick={() => eslesdir(seciliKalem.kalem_sira, null)}
                >
                  Eşleştirmeyi Kaldır
                </Button>
              </>
            )}
          </Stack>
        )}
      </Modal>

      {/* Yeni Ürün Modal */}
      <Modal
        opened={yeniUrunModalAcik}
        onClose={yeniUrunModalKapat}
        title={
          <Group gap="xs">
            <IconPackage size={20} />
            <Text fw={600}>Yeni Ürün Kartı</Text>
          </Group>
        }
        size="md"
      >
        <Stack gap="md">
          <TextInput
            label="Ürün Adı"
            placeholder="Ürün adını girin"
            value={yeniUrunAdi}
            onChange={(e) => setYeniUrunAdi(e.target.value)}
            required
          />

          <Alert color="blue" icon={<IconAlertCircle size={18} />}>
            <Text size="sm">
              Ürün kartı oluşturulduğunda kategori otomatik olarak tahmin edilecektir. Daha sonra
              ürün kartları sayfasından düzenleyebilirsiniz.
            </Text>
          </Alert>

          <Group justify="flex-end">
            <Button variant="light" onClick={yeniUrunModalKapat}>
              İptal
            </Button>
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={yeniUrunOlustur}
              loading={saving}
              disabled={!yeniUrunAdi.trim()}
            >
              Oluştur ve Eşleştir
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Birim Çarpanı Modal */}
      <Modal
        opened={birimCarpaniModalAcik}
        onClose={birimCarpaniModalKapat}
        title={
          <Group gap="xs">
            <IconCalculator size={20} />
            <Text fw={600}>Birim Dönüşümü</Text>
          </Group>
        }
        size="md"
      >
        {seciliKalem && seciliUrun && (
          <Stack gap="md">
            {/* Seçili ürün bilgisi */}
            <Paper p="sm" bg="blue.0" withBorder>
              <Group gap="xs">
                <ThemeIcon size="sm" color="blue" variant="light">
                  <IconCheck size={14} />
                </ThemeIcon>
                <Box>
                  <Text size="sm" fw={600}>
                    {seciliUrun.ad}
                  </Text>
                  {seciliUrun.kod && (
                    <Badge size="xs" variant="dot">
                      {seciliUrun.kod}
                    </Badge>
                  )}
                </Box>
              </Group>
            </Paper>

            {/* Fatura kalem bilgisi */}
            <Paper p="sm" className="nested-card">
              <Text size="xs" c="dimmed" mb={4}>
                Fatura Kalemi:
              </Text>
              <Text size="sm" fw={500}>
                {seciliKalem.fatura_urun_adi}
              </Text>
              <Text size="xs" c="dimmed" mt={4}>
                Birim Fiyat: {formatMoney(seciliKalem.birim_fiyat)}
              </Text>
              {/* Mini hesaplayıcı: Kolide X adet × Y gr/ml → Z KG/LT */}
              <Box mt="sm" p="xs" bg="gray.1" style={{ borderRadius: 6 }}>
                <Text size="xs" fw={500} mb={6} c="dimmed">
                  Çarpan hesapla
                </Text>
                <Group grow wrap="nowrap" gap="xs" align="flex-end">
                  <NumberInput
                    size="xs"
                    placeholder="Adet"
                    value={calcAdet}
                    onChange={(v) => setCalcAdet(v === '' ? '' : Number(v))}
                    min={1}
                    max={9999}
                    hideControls
                  />
                  <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
                    ×
                  </Text>
                  <NumberInput
                    size="xs"
                    placeholder="gr/ml"
                    value={calcBirimDeger}
                    onChange={(v) => setCalcBirimDeger(v === '' ? '' : Number(v))}
                    min={0.1}
                    max={99999}
                    decimalScale={1}
                    hideControls
                  />
                  <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
                    →
                  </Text>
                  <Select
                    size="xs"
                    data={[
                      { value: 'KG', label: 'KG' },
                      { value: 'LT', label: 'LT' },
                    ]}
                    value={calcHedefBirim}
                    onChange={(v) => setCalcHedefBirim((v as 'KG' | 'LT') || 'KG')}
                    style={{ flex: '0 0 64px' }}
                  />
                </Group>
                <Group gap="xs" mt={6}>
                  <Button variant="subtle" size="compact-xs" onClick={urunAdindanDoldur}>
                    Ürün adından doldur
                  </Button>
                  <Button
                    size="compact-xs"
                    variant="light"
                    leftSection={<IconCalculator size={12} />}
                    onClick={calcUygula}
                    disabled={!calcAdet || !calcBirimDeger}
                  >
                    Uygula
                  </Button>
                  {typeof calcAdet === 'number' &&
                    typeof calcBirimDeger === 'number' &&
                    calcAdet > 0 &&
                    calcBirimDeger > 0 && (
                      <Text size="xs" c="dimmed">
                        = {(calcAdet * (calcBirimDeger / 1000)).toFixed(2)} {calcHedefBirim}
                      </Text>
                    )}
                </Group>
              </Box>
            </Paper>

            <Divider label="Birim Dönüşüm Ayarları" labelPosition="center" />

            {/* Birim çarpanı ve standart birim */}
            <Group grow>
              <NumberInput
                label="Birim Çarpanı"
                description="Faturadaki 1 birim (koli, kutu vb.) kaç standart birime denk? Örn: 1 koli margarin = 12 KG ise 12 yazın."
                placeholder="Örn: 12"
                value={birimCarpani}
                onChange={(val) => setBirimCarpani(Number(val) || 1)}
                min={0.001}
                step={0.1}
                decimalScale={3}
                required
              />
              <Select
                label="Standart Birim"
                description="Stok birimi fiyatı ve stok hangi birimde tutulacak? (KG, LT, Adet vb.)"
                data={[
                  { value: 'KG', label: 'Kilogram (KG)' },
                  { value: 'LT', label: 'Litre (LT)' },
                  { value: 'ADET', label: 'Adet' },
                  { value: 'GR', label: 'Gram (GR)' },
                  { value: 'ML', label: 'Mililitre (ML)' },
                  { value: 'M', label: 'Metre (M)' },
                ]}
                value={standartBirim}
                onChange={(val) => setStandartBirim(val || 'KG')}
              />
            </Group>

            {/* Hesaplama önizleme */}
            <Paper p="md" bg="green.0" withBorder>
              <Text size="sm" fw={500} mb="xs">
                Hesaplama Önizleme:
              </Text>
              <Group justify="space-between">
                <Stack gap={4}>
                  <Text size="xs" c="dimmed">
                    Fatura Birim Fiyatı:
                  </Text>
                  <Text size="sm" fw={500}>
                    {formatMoney(seciliKalem.birim_fiyat)}
                  </Text>
                </Stack>
                <Text size="lg" c="dimmed">
                  ÷
                </Text>
                <Stack gap={4}>
                  <Text size="xs" c="dimmed">
                    Çarpan:
                  </Text>
                  <Text size="sm" fw={500}>
                    {birimCarpani}
                  </Text>
                </Stack>
                <Text size="lg" c="dimmed">
                  =
                </Text>
                <Stack gap={4}>
                  <Text size="xs" c="dimmed">
                    Standart Fiyat:
                  </Text>
                  <Text size="lg" fw={700} c="green">
                    {formatMoney(seciliKalem.birim_fiyat / (birimCarpani || 1))}/{standartBirim}
                  </Text>
                </Stack>
              </Group>
            </Paper>

            {/* Örnek açıklama */}
            <Alert color="blue" icon={<IconAlertCircle size={18} />}>
              <Text size="xs">
                <strong>Örnek:</strong> 48×250gr margarin kolisi için çarpan = 12 (48×250gr = 12
                KG). Böylece koli fiyatını 12&apos;ye bölünce KG fiyatı bulunur.
              </Text>
            </Alert>

            <Group justify="flex-end" mt="md">
              <Button variant="light" onClick={birimCarpaniModalKapat}>
                İptal
              </Button>
              <Button
                leftSection={<IconCheck size={16} />}
                onClick={birimCarpaniIleEslesdir}
                loading={saving}
                disabled={!birimCarpani || birimCarpani <= 0}
              >
                Eşleştir
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Container>
  );
}
