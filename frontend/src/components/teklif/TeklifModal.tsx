'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Modal,
  Box,
  Text,
  Button,
  TextInput,
  NumberInput,
  Group,
  Stack,
  Paper,
  ScrollArea,
  ActionIcon,
  Table,
  Divider,
  Badge,
  LoadingOverlay,
  Switch,
  Select,
  SegmentedControl,
  Checkbox,
  Tooltip,
  ThemeIcon,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconPlus,
  IconTrash,
  IconFileSpreadsheet,
  IconCalculator,
  IconDeviceFloppy,
  IconDownload,
  IconCheck,
  IconAlertTriangle,
  IconUsers,
  IconTruck,
  IconPackage,
  IconTool,
  IconBuilding,
  IconScale,
  IconShieldCheck,
} from '@tabler/icons-react';
import type {
  TeklifData,
  MaliyetKalemKey,
  CetvelKalemi,
  OgunDetay,
  PozisyonKalem,
  AracKalem,
  SarfKalem,
  EkipmanKalem,
  GenelGiderKalem,
  YasalGiderKalem,
  RiskKategori,
} from './types';
import {
  MALIYET_KALEMLERI,
  DEFAULT_TEKLIF_DATA,
  POZISYON_SABLONLARI,
  ARAC_TIPLERI,
  EKIPMAN_SABLONLARI,
  YASAL_GIDER_SABLONLARI,
} from './types';
import {
  hesaplaTumMaliyetler,
  hesaplaToplam,
  hesaplaKarVeTeklif,
  hesaplaCetvelToplami,
  formatPara,
  formatParaKisa,
  formatSayi,
  hesaplaPersonelOzet,
  hesaplaNakliyeOzet,
  hesaplaSarfOzet,
  hesaplaEkipmanOzet,
  hesaplaGenelGiderOzet,
  hesaplaYasalGiderOzet,
  hesaplaRiskOzet,
} from './hesaplamalar';

interface TeklifModalProps {
  opened: boolean;
  onClose: () => void;
  ihaleBasligi: string;
  ihaleBedeli?: number;
  ihaleId?: number;
  ihaleKayitNo?: string;
  birimFiyatlar?: Array<{ kalem: string; birim: string; miktar: number }>;
}

type ViewMode = 'maliyet' | 'cetvel';

export default function TeklifModal({
  opened,
  onClose,
  ihaleBasligi,
  ihaleBedeli,
  ihaleId,
  ihaleKayitNo,
  birimFiyatlar,
}: TeklifModalProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('maliyet');
  const [selectedKalem, setSelectedKalem] = useState<MaliyetKalemKey>('malzeme');
  const [teklifData, setTeklifData] = useState<TeklifData>(() => ({
    ...JSON.parse(JSON.stringify(DEFAULT_TEKLIF_DATA)),
    ihale_adi: ihaleBasligi,
    ihale_kayit_no: ihaleKayitNo,
  }));
  const [loading, setLoading] = useState(false);
  const [existingTeklifId, setExistingTeklifId] = useState<number | null>(null);

  // İhale değiştiğinde verileri sıfırla
  useEffect(() => {
    if (opened) {
      setTeklifData(prev => ({
        ...prev,
        ihale_adi: ihaleBasligi,
        ihale_kayit_no: ihaleKayitNo,
      }));

      // Mevcut teklif var mı kontrol et
      if (ihaleId) {
        fetchExistingTeklif(ihaleId);
      }

      // Birim fiyatları cetvele ekle
      if (birimFiyatlar && birimFiyatlar.length > 0) {
        const cetvel: CetvelKalemi[] = birimFiyatlar.map((item, idx) => ({
          sira: idx + 1,
          isKalemi: item.kalem,
          birim: item.birim,
          miktar: item.miktar,
          birimFiyat: 0,
          tutar: 0,
        }));
        setTeklifData(prev => ({ ...prev, birim_fiyat_cetveli: cetvel }));
      }
    }
  }, [opened, ihaleBasligi, ihaleKayitNo, ihaleId, birimFiyatlar]);

  const fetchExistingTeklif = async (ihaleId: number) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/teklifler/ihale/${ihaleId}`);
      const data = await res.json();
      if (data.success && data.data) {
        setTeklifData(data.data);
        setExistingTeklifId(data.data.id);
      }
    } catch (error) {
      console.error('Mevcut teklif getirme hatası:', error);
    }
  };

  // Otomatik hesaplama - her değer değiştiğinde
  const hesaplanmisTeklifData = useMemo(() => {
    const yeniDetay = hesaplaTumMaliyetler(teklifData.maliyet_detay);
    const maliyetToplam = hesaplaToplam(yeniDetay);
    const { karTutari, teklifFiyati } = hesaplaKarVeTeklif(maliyetToplam, teklifData.kar_orani);
    
    return {
      ...teklifData,
      maliyet_detay: yeniDetay,
      maliyet_toplam: maliyetToplam,
      kar_tutari: karTutari,
      teklif_fiyati: teklifFiyati,
    };
  }, [teklifData]);

  // Kar oranı değiştiğinde
  const handleKarOraniChange = (value: number | string) => {
    const oran = typeof value === 'number' ? value : parseFloat(value) || 0;
    setTeklifData(prev => ({ ...prev, kar_orani: oran }));
  };

  // Cetvel kalem birim fiyat değişikliği
  const handleCetvelBirimFiyatChange = (index: number, birimFiyat: number) => {
    const yeniCetvel = [...teklifData.birim_fiyat_cetveli];
    yeniCetvel[index] = {
      ...yeniCetvel[index],
      birimFiyat,
      tutar: yeniCetvel[index].miktar * birimFiyat,
    };
    const cetvelToplami = hesaplaCetvelToplami(yeniCetvel);
    setTeklifData(prev => ({
      ...prev,
      birim_fiyat_cetveli: yeniCetvel,
      cetvel_toplami: cetvelToplami,
    }));
  };

  // Cetvele yeni kalem ekle
  const handleCetvelKalemEkle = () => {
    const yeniKalem: CetvelKalemi = {
      sira: teklifData.birim_fiyat_cetveli.length + 1,
      isKalemi: '',
      birim: 'Öğün',
      miktar: 0,
      birimFiyat: 0,
      tutar: 0,
    };
    setTeklifData(prev => ({
      ...prev,
      birim_fiyat_cetveli: [...prev.birim_fiyat_cetveli, yeniKalem],
    }));
  };

  // Cetvel kalemi sil
  const handleCetvelKalemSil = (index: number) => {
    const yeniCetvel = teklifData.birim_fiyat_cetveli.filter((_, i) => i !== index);
    yeniCetvel.forEach((k, i) => (k.sira = i + 1));
    const cetvelToplami = hesaplaCetvelToplami(yeniCetvel);
    setTeklifData(prev => ({
      ...prev,
      birim_fiyat_cetveli: yeniCetvel,
      cetvel_toplami: cetvelToplami,
    }));
  };

  // Kaydet
  const handleKaydet = async () => {
    setLoading(true);
    try {
      const payload = {
        ...hesaplanmisTeklifData,
        ihale_id: ihaleId,
      };

      const url = existingTeklifId
        ? `${process.env.NEXT_PUBLIC_API_URL}/api/teklifler/${existingTeklifId}`
        : `${process.env.NEXT_PUBLIC_API_URL}/api/teklifler`;

      const method = existingTeklifId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.success) {
        notifications.show({
          title: 'Başarılı',
          message: existingTeklifId ? 'Teklif güncellendi' : 'Teklif kaydedildi',
          color: 'green',
        });
        if (!existingTeklifId && data.data?.id) {
          setExistingTeklifId(data.data.id);
        }
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      notifications.show({
        title: 'Hata',
        message: error.message || 'Teklif kaydedilemedi',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  // Generic maliyet detay güncelleme
  const updateMaliyetDetay = useCallback((kalem: MaliyetKalemKey, path: string, value: any) => {
    setTeklifData(prev => {
      const yeniDetay = JSON.parse(JSON.stringify(prev.maliyet_detay));
      const keys = path.split('.');
      let obj: any = yeniDetay[kalem].detay;
      
      for (let i = 0; i < keys.length - 1; i++) {
        obj = obj[keys[i]];
      }
      obj[keys[keys.length - 1]] = value;
      
      return { ...prev, maliyet_detay: yeniDetay };
    });
  }, []);

  // ========== MALZEME FORMU ==========
  const renderMalzemeForm = () => {
    const detay = teklifData.maliyet_detay.malzeme.detay;
    const tutar = hesaplanmisTeklifData.maliyet_detay.malzeme.tutar;

    return (
      <Stack>
        <Group justify="space-between">
          <Text fw={600} size="lg">💰 Malzeme Maliyeti</Text>
          <Badge size="xl" color="green" variant="light">{formatPara(tutar)}</Badge>
        </Group>

        <SegmentedControl
          value={detay.hesaplamaYontemi}
          onChange={(v) => updateMaliyetDetay('malzeme', 'hesaplamaYontemi', v)}
          data={[
            { label: 'Öğün Bazlı', value: 'ogun_bazli' },
            { label: 'Toplam', value: 'toplam' },
          ]}
        />

        {detay.hesaplamaYontemi === 'ogun_bazli' ? (
          <Stack gap="xs">
            <Text size="sm" fw={500}>Öğün Detayları</Text>
            <Table withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th w={40}></Table.Th>
                  <Table.Th>Öğün</Table.Th>
                  <Table.Th w={100}>Kişi</Table.Th>
                  <Table.Th w={80}>Gün</Table.Th>
                  <Table.Th w={100}>₺/Kişi</Table.Th>
                  <Table.Th w={120}>Toplam</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {detay.ogunler.map((ogun, idx) => {
                  const ogunToplam = ogun.aktif ? ogun.kisiSayisi * ogun.gunSayisi * ogun.kisiBasiMaliyet : 0;
                  return (
                    <Table.Tr key={idx} style={{ opacity: ogun.aktif ? 1 : 0.5 }}>
                      <Table.Td>
                        <Checkbox
                          checked={ogun.aktif}
                          onChange={(e) => {
                            const yeniOgunler = [...detay.ogunler];
                            yeniOgunler[idx] = { ...yeniOgunler[idx], aktif: e.currentTarget.checked };
                            updateMaliyetDetay('malzeme', 'ogunler', yeniOgunler);
                          }}
                        />
                      </Table.Td>
                      <Table.Td>
                        <Text fw={500}>
                          {idx === 0 && '🍳'} {idx === 1 && '🍝'} {idx === 2 && '🍖'} {idx === 3 && '🥪'} {ogun.ad}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <NumberInput
                          size="xs"
                          variant="unstyled"
                          value={ogun.kisiSayisi}
                          onChange={(v) => {
                            const yeniOgunler = [...detay.ogunler];
                            yeniOgunler[idx] = { ...yeniOgunler[idx], kisiSayisi: Number(v) || 0 };
                            updateMaliyetDetay('malzeme', 'ogunler', yeniOgunler);
                          }}
                          thousandSeparator="."
                          decimalSeparator=","
                          disabled={!ogun.aktif}
                        />
                      </Table.Td>
                      <Table.Td>
                        <NumberInput
                          size="xs"
                          variant="unstyled"
                          value={ogun.gunSayisi}
                          onChange={(v) => {
                            const yeniOgunler = [...detay.ogunler];
                            yeniOgunler[idx] = { ...yeniOgunler[idx], gunSayisi: Number(v) || 0 };
                            updateMaliyetDetay('malzeme', 'ogunler', yeniOgunler);
                          }}
                          disabled={!ogun.aktif}
                        />
                      </Table.Td>
                      <Table.Td>
                        <NumberInput
                          size="xs"
                          variant="unstyled"
                          value={ogun.kisiBasiMaliyet}
                          onChange={(v) => {
                            const yeniOgunler = [...detay.ogunler];
                            yeniOgunler[idx] = { ...yeniOgunler[idx], kisiBasiMaliyet: Number(v) || 0 };
                            updateMaliyetDetay('malzeme', 'ogunler', yeniOgunler);
                          }}
                          decimalScale={2}
                          disabled={!ogun.aktif}
                        />
                      </Table.Td>
                      <Table.Td>
                        <Text fw={600} c={ogunToplam > 0 ? 'green' : 'dimmed'}>
                          {formatParaKisa(ogunToplam)}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Stack>
        ) : (
          <Stack gap="sm">
            <NumberInput
              label="Günlük Kişi Sayısı"
              value={detay.gunlukKisi}
              onChange={(v) => updateMaliyetDetay('malzeme', 'gunlukKisi', Number(v) || 0)}
              thousandSeparator="."
              decimalSeparator=","
            />
            <NumberInput
              label="Gün Sayısı"
              value={detay.gunSayisi}
              onChange={(v) => updateMaliyetDetay('malzeme', 'gunSayisi', Number(v) || 0)}
            />
            <NumberInput
              label="Öğün Sayısı"
              value={detay.ogunSayisi}
              onChange={(v) => updateMaliyetDetay('malzeme', 'ogunSayisi', Number(v) || 0)}
              min={1}
              max={5}
            />
            <NumberInput
              label="Kişi Başı Öğün Maliyeti (₺)"
              value={detay.kisiBasiMaliyet}
              onChange={(v) => updateMaliyetDetay('malzeme', 'kisiBasiMaliyet', Number(v) || 0)}
              decimalScale={2}
            />
          </Stack>
        )}
      </Stack>
    );
  };

  // ========== PERSONEL FORMU ==========
  const renderPersonelForm = () => {
    const detay = teklifData.maliyet_detay.personel.detay;
    const tutar = hesaplanmisTeklifData.maliyet_detay.personel.tutar;
    const ozet = hesaplaPersonelOzet(detay);

    return (
      <Stack>
        <Group justify="space-between">
          <Text fw={600} size="lg">👷 Personel Maliyeti</Text>
          <Badge size="xl" color="green" variant="light">{formatPara(tutar)}</Badge>
        </Group>

        <Group>
          <NumberInput
            label="Süre (Ay)"
            value={detay.aySayisi}
            onChange={(v) => updateMaliyetDetay('personel', 'aySayisi', Number(v) || 12)}
            min={1}
            max={60}
            w={100}
          />
          <NumberInput
            label="SGK Oranı (%)"
            value={detay.sgkOrani}
            onChange={(v) => updateMaliyetDetay('personel', 'sgkOrani', Number(v) || 22.5)}
            decimalScale={1}
            w={100}
          />
        </Group>

        <Text size="sm" fw={500}>Personel Listesi</Text>
        {detay.pozisyonlar.map((poz, idx) => (
          <Paper key={idx} withBorder p="xs">
            <Group align="end">
              <Select
                label="Pozisyon"
                value={poz.pozisyon}
                onChange={(v) => {
                  const yeniPoz = [...detay.pozisyonlar];
                  const sablon = POZISYON_SABLONLARI.find(s => s.pozisyon === v);
                  yeniPoz[idx] = {
                    ...yeniPoz[idx],
                    pozisyon: v || '',
                    brutMaas: sablon?.varsayilanMaas || yeniPoz[idx].brutMaas,
                  };
                  updateMaliyetDetay('personel', 'pozisyonlar', yeniPoz);
                }}
                data={POZISYON_SABLONLARI.map(s => s.pozisyon)}
                searchable
                allowDeselect={false}
                style={{ flex: 2 }}
              />
              <NumberInput
                label="Adet"
                value={poz.adet}
                onChange={(v) => {
                  const yeniPoz = [...detay.pozisyonlar];
                  yeniPoz[idx] = { ...yeniPoz[idx], adet: Number(v) || 0 };
                  updateMaliyetDetay('personel', 'pozisyonlar', yeniPoz);
                }}
                min={0}
                style={{ flex: 1 }}
              />
              <NumberInput
                label="Brüt Maaş (₺)"
                value={poz.brutMaas}
                onChange={(v) => {
                  const yeniPoz = [...detay.pozisyonlar];
                  yeniPoz[idx] = { ...yeniPoz[idx], brutMaas: Number(v) || 0 };
                  updateMaliyetDetay('personel', 'pozisyonlar', yeniPoz);
                }}
                thousandSeparator="."
                decimalSeparator=","
                style={{ flex: 1 }}
              />
              <ActionIcon
                color="red"
                variant="light"
                onClick={() => {
                  const yeniPoz = detay.pozisyonlar.filter((_, i) => i !== idx);
                  updateMaliyetDetay('personel', 'pozisyonlar', yeniPoz);
                }}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Group>
          </Paper>
        ))}

        <Button
          variant="light"
          leftSection={<IconPlus size={16} />}
          onClick={() => {
            const yeniPoz: PozisyonKalem = { pozisyon: '', adet: 1, brutMaas: 30000 };
            updateMaliyetDetay('personel', 'pozisyonlar', [...detay.pozisyonlar, yeniPoz]);
          }}
        >
          Pozisyon Ekle
        </Button>

        {detay.pozisyonlar.length > 0 && (
          <Paper withBorder p="sm" bg="blue.0">
            <Group justify="space-between">
              <div>
                <Text size="xs" c="dimmed">Toplam Kişi</Text>
                <Text fw={600}>{ozet.toplamKisi}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">Aylık Brüt</Text>
                <Text fw={600}>{formatPara(ozet.aylikBrut)}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">Aylık SGK</Text>
                <Text fw={600}>{formatPara(ozet.aylikSgk)}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">{detay.aySayisi} Aylık Toplam</Text>
                <Text fw={700} c="green">{formatPara(ozet.yillikToplam)}</Text>
              </div>
            </Group>
          </Paper>
        )}
      </Stack>
    );
  };

  // ========== NAKLİYE FORMU ==========
  const renderNakliyeForm = () => {
    const detay = teklifData.maliyet_detay.nakliye.detay;
    const tutar = hesaplanmisTeklifData.maliyet_detay.nakliye.tutar;
    const ozet = hesaplaNakliyeOzet(detay);

    return (
      <Stack>
        <Group justify="space-between">
          <Text fw={600} size="lg">🚚 Nakliye Maliyeti</Text>
          <Badge size="xl" color="green" variant="light">{formatPara(tutar)}</Badge>
        </Group>

        <Group>
          <NumberInput
            label="Yakıt Fiyatı (₺/lt)"
            value={detay.yakitFiyati}
            onChange={(v) => updateMaliyetDetay('nakliye', 'yakitFiyati', Number(v) || 42)}
            decimalScale={2}
            w={120}
          />
          <NumberInput
            label="Süre (Ay)"
            value={detay.aySayisi}
            onChange={(v) => updateMaliyetDetay('nakliye', 'aySayisi', Number(v) || 12)}
            min={1}
            w={100}
          />
        </Group>

        <Text size="sm" fw={500}>Araç Listesi</Text>
        {detay.araclar.map((arac, idx) => (
          <Paper key={idx} withBorder p="xs">
            <Group align="end" wrap="nowrap">
              <Select
                label="Araç Tipi"
                value={arac.tip}
                onChange={(v) => {
                  const yeniAraclar = [...detay.araclar];
                  const sablon = ARAC_TIPLERI.find(a => a.tip === v);
                  yeniAraclar[idx] = {
                    ...yeniAraclar[idx],
                    tip: v || '',
                    aylikKira: sablon?.varsayilanKira || yeniAraclar[idx].aylikKira,
                    yakitTuketimi: sablon?.varsayilanTuketim || yeniAraclar[idx].yakitTuketimi,
                  };
                  updateMaliyetDetay('nakliye', 'araclar', yeniAraclar);
                }}
                data={ARAC_TIPLERI.map(a => a.tip)}
                allowDeselect={false}
                style={{ flex: 2 }}
              />
              <NumberInput
                label="Adet"
                value={arac.adet}
                onChange={(v) => {
                  const yeniAraclar = [...detay.araclar];
                  yeniAraclar[idx] = { ...yeniAraclar[idx], adet: Number(v) || 0 };
                  updateMaliyetDetay('nakliye', 'araclar', yeniAraclar);
                }}
                min={0}
                w={60}
              />
              <NumberInput
                label="Aylık Kira (₺)"
                value={arac.aylikKira}
                onChange={(v) => {
                  const yeniAraclar = [...detay.araclar];
                  yeniAraclar[idx] = { ...yeniAraclar[idx], aylikKira: Number(v) || 0 };
                  updateMaliyetDetay('nakliye', 'araclar', yeniAraclar);
                }}
                thousandSeparator="."
                decimalSeparator=","
                w={100}
              />
              <NumberInput
                label="Aylık KM"
                value={arac.aylikKm}
                onChange={(v) => {
                  const yeniAraclar = [...detay.araclar];
                  yeniAraclar[idx] = { ...yeniAraclar[idx], aylikKm: Number(v) || 0 };
                  updateMaliyetDetay('nakliye', 'araclar', yeniAraclar);
                }}
                thousandSeparator="."
                decimalSeparator=","
                w={80}
              />
              <NumberInput
                label="lt/100km"
                value={arac.yakitTuketimi}
                onChange={(v) => {
                  const yeniAraclar = [...detay.araclar];
                  yeniAraclar[idx] = { ...yeniAraclar[idx], yakitTuketimi: Number(v) || 0 };
                  updateMaliyetDetay('nakliye', 'araclar', yeniAraclar);
                }}
                decimalScale={1}
                w={70}
              />
              <ActionIcon
                color="red"
                variant="light"
                onClick={() => {
                  const yeniAraclar = detay.araclar.filter((_, i) => i !== idx);
                  updateMaliyetDetay('nakliye', 'araclar', yeniAraclar);
                }}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Group>
          </Paper>
        ))}

        <Button
          variant="light"
          leftSection={<IconPlus size={16} />}
          onClick={() => {
            const yeniArac: AracKalem = {
              tip: 'Soğutuculu Kamyonet',
              adet: 1,
              aylikKira: 45000,
              aylikKm: 3000,
              yakitTuketimi: 12,
            };
            updateMaliyetDetay('nakliye', 'araclar', [...detay.araclar, yeniArac]);
          }}
        >
          Araç Ekle
        </Button>

        {detay.araclar.length > 0 && (
          <Paper withBorder p="sm" bg="blue.0">
            <Group justify="space-between">
              <div>
                <Text size="xs" c="dimmed">Toplam Araç</Text>
                <Text fw={600}>{ozet.toplamArac}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">Aylık Kira</Text>
                <Text fw={600}>{formatPara(ozet.aylikKiraToplam)}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">Aylık Yakıt</Text>
                <Text fw={600}>{formatPara(ozet.aylikYakitToplam)}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">{detay.aySayisi} Aylık Toplam</Text>
                <Text fw={700} c="green">{formatPara(ozet.yillikToplam)}</Text>
              </div>
            </Group>
          </Paper>
        )}
      </Stack>
    );
  };

  // ========== SARF MALZEME FORMU ==========
  const renderSarfMalzemeForm = () => {
    const detay = teklifData.maliyet_detay.sarf_malzeme.detay;
    const tutar = hesaplanmisTeklifData.maliyet_detay.sarf_malzeme.tutar;
    const ozet = hesaplaSarfOzet(detay);

    return (
      <Stack>
        <Group justify="space-between">
          <Text fw={600} size="lg">🧴 Sarf Malzeme Maliyeti</Text>
          <Badge size="xl" color="green" variant="light">{formatPara(tutar)}</Badge>
        </Group>

        <SegmentedControl
          value={detay.hesaplamaYontemi}
          onChange={(v) => updateMaliyetDetay('sarf_malzeme', 'hesaplamaYontemi', v)}
          data={[
            { label: 'Kişi Başı', value: 'kisi_basi' },
            { label: 'Aylık Toplam', value: 'toplam' },
          ]}
        />

        {detay.hesaplamaYontemi === 'kisi_basi' ? (
          <Stack gap="sm">
            <Group>
              <NumberInput
                label="Günlük Kişi"
                value={detay.gunlukKisi}
                onChange={(v) => updateMaliyetDetay('sarf_malzeme', 'gunlukKisi', Number(v) || 0)}
                thousandSeparator="."
                decimalSeparator=","
                style={{ flex: 1 }}
              />
              <NumberInput
                label="Gün Sayısı"
                value={detay.gunSayisi}
                onChange={(v) => updateMaliyetDetay('sarf_malzeme', 'gunSayisi', Number(v) || 0)}
                style={{ flex: 1 }}
              />
            </Group>

            <Table withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Kalem</Table.Th>
                  <Table.Th w={120}>₺/Kişi/Gün</Table.Th>
                  <Table.Th w={120}>Toplam</Table.Th>
                  <Table.Th w={40}></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {detay.kalemler.map((kalem, idx) => {
                  const kalemToplam = detay.gunlukKisi * detay.gunSayisi * kalem.miktar;
                  return (
                    <Table.Tr key={idx}>
                      <Table.Td>
                        <TextInput
                          variant="unstyled"
                          value={kalem.ad}
                          onChange={(e) => {
                            const yeniKalemler = [...detay.kalemler];
                            yeniKalemler[idx] = { ...yeniKalemler[idx], ad: e.target.value };
                            updateMaliyetDetay('sarf_malzeme', 'kalemler', yeniKalemler);
                          }}
                        />
                      </Table.Td>
                      <Table.Td>
                        <NumberInput
                          variant="unstyled"
                          value={kalem.miktar}
                          onChange={(v) => {
                            const yeniKalemler = [...detay.kalemler];
                            yeniKalemler[idx] = { ...yeniKalemler[idx], miktar: Number(v) || 0 };
                            updateMaliyetDetay('sarf_malzeme', 'kalemler', yeniKalemler);
                          }}
                          decimalScale={2}
                        />
                      </Table.Td>
                      <Table.Td>
                        <Text fw={500}>{formatParaKisa(kalemToplam)}</Text>
                      </Table.Td>
                      <Table.Td>
                        <ActionIcon
                          color="red"
                          variant="subtle"
                          size="sm"
                          onClick={() => {
                            const yeniKalemler = detay.kalemler.filter((_, i) => i !== idx);
                            updateMaliyetDetay('sarf_malzeme', 'kalemler', yeniKalemler);
                          }}
                        >
                          <IconTrash size={14} />
                        </ActionIcon>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>

            <Button
              variant="light"
              size="xs"
              leftSection={<IconPlus size={14} />}
              onClick={() => {
                const yeniKalem: SarfKalem = { ad: '', birim: '₺/kişi/gün', miktar: 0 };
                updateMaliyetDetay('sarf_malzeme', 'kalemler', [...detay.kalemler, yeniKalem]);
              }}
            >
              Kalem Ekle
            </Button>

            <Paper withBorder p="sm" bg="blue.0">
              <Group justify="space-between">
                <div>
                  <Text size="xs" c="dimmed">Kişi Başı/Gün</Text>
                  <Text fw={600}>{ozet.kisiBasiGunluk.toFixed(2)} ₺</Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed">Günlük Toplam</Text>
                  <Text fw={600}>{formatPara(ozet.gunlukToplam)}</Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed">Yıllık Toplam</Text>
                  <Text fw={700} c="green">{formatPara(ozet.yillikToplam)}</Text>
                </div>
              </Group>
            </Paper>
          </Stack>
        ) : (
          <Stack gap="sm">
            <NumberInput
              label="Aylık Tutar (₺)"
              value={detay.aylikTutar}
              onChange={(v) => updateMaliyetDetay('sarf_malzeme', 'aylikTutar', Number(v) || 0)}
              thousandSeparator="."
              decimalSeparator=","
            />
            <NumberInput
              label="Ay Sayısı"
              value={detay.aySayisi}
              onChange={(v) => updateMaliyetDetay('sarf_malzeme', 'aySayisi', Number(v) || 12)}
              min={1}
            />
          </Stack>
        )}
      </Stack>
    );
  };

  // ========== EKİPMAN FORMU ==========
  const renderEkipmanForm = () => {
    const detay = teklifData.maliyet_detay.ekipman_bakim.detay;
    const tutar = hesaplanmisTeklifData.maliyet_detay.ekipman_bakim.tutar;
    const ozet = hesaplaEkipmanOzet(detay);

    return (
      <Stack>
        <Group justify="space-between">
          <Text fw={600} size="lg">🍽️ Ekipman & Bakım</Text>
          <Badge size="xl" color="green" variant="light">{formatPara(tutar)}</Badge>
        </Group>

        <NumberInput
          label="Süre (Ay)"
          value={detay.aySayisi}
          onChange={(v) => updateMaliyetDetay('ekipman_bakim', 'aySayisi', Number(v) || 12)}
          min={1}
          w={100}
        />

        <Text size="sm" fw={500}>Ekipman Listesi</Text>
        {detay.ekipmanlar.map((ekp, idx) => (
          <Paper key={idx} withBorder p="xs">
            <Group align="end">
              <Select
                label="Ekipman"
                value={ekp.ad}
                onChange={(v) => {
                  const yeniEkipmanlar = [...detay.ekipmanlar];
                  const sablon = EKIPMAN_SABLONLARI.find(e => e.ad === v);
                  const fiyat = ekp.tip === 'kira' ? sablon?.varsayilanKira : sablon?.varsayilanSatin;
                  yeniEkipmanlar[idx] = {
                    ...yeniEkipmanlar[idx],
                    ad: v || '',
                    birimFiyat: fiyat || yeniEkipmanlar[idx].birimFiyat,
                  };
                  updateMaliyetDetay('ekipman_bakim', 'ekipmanlar', yeniEkipmanlar);
                }}
                data={EKIPMAN_SABLONLARI.map(e => e.ad)}
                searchable
                allowDeselect={false}
                style={{ flex: 2 }}
              />
              <SegmentedControl
                value={ekp.tip}
                onChange={(v) => {
                  const yeniEkipmanlar = [...detay.ekipmanlar];
                  const sablon = EKIPMAN_SABLONLARI.find(e => e.ad === ekp.ad);
                  const fiyat = v === 'kira' ? sablon?.varsayilanKira : sablon?.varsayilanSatin;
                  yeniEkipmanlar[idx] = {
                    ...yeniEkipmanlar[idx],
                    tip: v as 'kira' | 'satin_alma',
                    birimFiyat: fiyat || 0,
                  };
                  updateMaliyetDetay('ekipman_bakim', 'ekipmanlar', yeniEkipmanlar);
                }}
                data={[
                  { label: 'Kira', value: 'kira' },
                  { label: 'Satın Al', value: 'satin_alma' },
                ]}
                size="xs"
              />
              <NumberInput
                label="Adet"
                value={ekp.adet}
                onChange={(v) => {
                  const yeniEkipmanlar = [...detay.ekipmanlar];
                  yeniEkipmanlar[idx] = { ...yeniEkipmanlar[idx], adet: Number(v) || 0 };
                  updateMaliyetDetay('ekipman_bakim', 'ekipmanlar', yeniEkipmanlar);
                }}
                min={0}
                w={60}
              />
              <NumberInput
                label={ekp.tip === 'kira' ? 'Aylık (₺)' : 'Fiyat (₺)'}
                value={ekp.birimFiyat}
                onChange={(v) => {
                  const yeniEkipmanlar = [...detay.ekipmanlar];
                  yeniEkipmanlar[idx] = { ...yeniEkipmanlar[idx], birimFiyat: Number(v) || 0 };
                  updateMaliyetDetay('ekipman_bakim', 'ekipmanlar', yeniEkipmanlar);
                }}
                thousandSeparator="."
                decimalSeparator=","
                w={100}
              />
              <ActionIcon
                color="red"
                variant="light"
                onClick={() => {
                  const yeniEkipmanlar = detay.ekipmanlar.filter((_, i) => i !== idx);
                  updateMaliyetDetay('ekipman_bakim', 'ekipmanlar', yeniEkipmanlar);
                }}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Group>
          </Paper>
        ))}

        <Button
          variant="light"
          leftSection={<IconPlus size={16} />}
          onClick={() => {
            const yeniEkipman: EkipmanKalem = { ad: '', tip: 'kira', adet: 1, birimFiyat: 0 };
            updateMaliyetDetay('ekipman_bakim', 'ekipmanlar', [...detay.ekipmanlar, yeniEkipman]);
          }}
        >
          Ekipman Ekle
        </Button>

        <Divider />

        <NumberInput
          label="Aylık Bakım Tutarı (₺)"
          value={detay.aylikBakimTutar}
          onChange={(v) => updateMaliyetDetay('ekipman_bakim', 'aylikBakimTutar', Number(v) || 0)}
          thousandSeparator="."
          decimalSeparator=","
        />

        {(detay.ekipmanlar.length > 0 || detay.aylikBakimTutar > 0) && (
          <Paper withBorder p="sm" bg="blue.0">
            <Group justify="space-between">
              <div>
                <Text size="xs" c="dimmed">Aylık Kira</Text>
                <Text fw={600}>{formatPara(ozet.aylikKiraToplam)}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">Satın Alma</Text>
                <Text fw={600}>{formatPara(ozet.satinAlmaToplam)}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">{detay.aySayisi} Ay Bakım</Text>
                <Text fw={600}>{formatPara(ozet.yillikBakim)}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">Toplam</Text>
                <Text fw={700} c="green">{formatPara(ozet.toplam)}</Text>
              </div>
            </Group>
          </Paper>
        )}
      </Stack>
    );
  };

  // ========== GENEL GİDER FORMU ==========
  const renderGenelGiderForm = () => {
    const detay = teklifData.maliyet_detay.genel_gider.detay;
    const tutar = hesaplanmisTeklifData.maliyet_detay.genel_gider.tutar;
    const ozet = hesaplaGenelGiderOzet(detay);

    return (
      <Stack>
        <Group justify="space-between">
          <Text fw={600} size="lg">🏢 Genel Giderler</Text>
          <Badge size="xl" color="green" variant="light">{formatPara(tutar)}</Badge>
        </Group>

        <NumberInput
          label="Süre (Ay)"
          value={detay.aySayisi}
          onChange={(v) => updateMaliyetDetay('genel_gider', 'aySayisi', Number(v) || 12)}
          min={1}
          w={100}
        />

        <Text size="sm" fw={500}>Gider Kalemleri (Aylık)</Text>
        {detay.kalemler.map((kalem, idx) => (
          <Group key={idx}>
            <TextInput
              value={kalem.ad}
              onChange={(e) => {
                const yeniKalemler = [...detay.kalemler];
                yeniKalemler[idx] = { ...yeniKalemler[idx], ad: e.target.value };
                updateMaliyetDetay('genel_gider', 'kalemler', yeniKalemler);
              }}
              style={{ flex: 2 }}
            />
            <NumberInput
              value={kalem.aylikTutar}
              onChange={(v) => {
                const yeniKalemler = [...detay.kalemler];
                yeniKalemler[idx] = { ...yeniKalemler[idx], aylikTutar: Number(v) || 0 };
                updateMaliyetDetay('genel_gider', 'kalemler', yeniKalemler);
              }}
              thousandSeparator="."
              decimalSeparator=","
              rightSection="₺"
              style={{ flex: 1 }}
            />
            <ActionIcon
              color="red"
              variant="light"
              onClick={() => {
                const yeniKalemler = detay.kalemler.filter((_, i) => i !== idx);
                updateMaliyetDetay('genel_gider', 'kalemler', yeniKalemler);
              }}
            >
              <IconTrash size={16} />
            </ActionIcon>
          </Group>
        ))}

        <Button
          variant="light"
          leftSection={<IconPlus size={16} />}
          onClick={() => {
            const yeniKalem: GenelGiderKalem = { ad: '', aylikTutar: 0 };
            updateMaliyetDetay('genel_gider', 'kalemler', [...detay.kalemler, yeniKalem]);
          }}
        >
          Kalem Ekle
        </Button>

        <Paper withBorder p="sm" bg="blue.0">
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed">Aylık Toplam</Text>
              <Text fw={600}>{formatPara(ozet.aylikToplam)}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">{detay.aySayisi} Aylık Toplam</Text>
              <Text fw={700} c="green">{formatPara(ozet.yillikToplam)}</Text>
            </div>
          </Group>
        </Paper>
      </Stack>
    );
  };

  // ========== YASAL GİDERLER FORMU ==========
  const renderYasalGiderlerForm = () => {
    const detay = teklifData.maliyet_detay.yasal_giderler.detay;
    const tutar = hesaplanmisTeklifData.maliyet_detay.yasal_giderler.tutar;
    const ozet = hesaplaYasalGiderOzet(detay);

    const renderKategori = (
      kategoriKey: 'sigortalar' | 'belgeler' | 'isg' | 'ihaleGiderleri',
      baslik: string,
      icon: React.ReactNode
    ) => (
      <Paper withBorder p="sm">
        <Group mb="xs">
          {icon}
          <Text fw={500}>{baslik}</Text>
        </Group>
        {detay[kategoriKey].map((item, idx) => (
          <Group key={idx} mb="xs">
            <TextInput
              size="xs"
              value={item.ad}
              onChange={(e) => {
                const yeniList = [...detay[kategoriKey]];
                yeniList[idx] = { ...yeniList[idx], ad: e.target.value };
                updateMaliyetDetay('yasal_giderler', kategoriKey, yeniList);
              }}
              style={{ flex: 2 }}
            />
            <NumberInput
              size="xs"
              value={item.tutar}
              onChange={(v) => {
                const yeniList = [...detay[kategoriKey]];
                yeniList[idx] = { ...yeniList[idx], tutar: Number(v) || 0 };
                updateMaliyetDetay('yasal_giderler', kategoriKey, yeniList);
              }}
              thousandSeparator="."
              decimalSeparator=","
              rightSection="₺"
              style={{ flex: 1 }}
            />
            <ActionIcon
              color="red"
              variant="subtle"
              size="sm"
              onClick={() => {
                const yeniList = detay[kategoriKey].filter((_, i) => i !== idx);
                updateMaliyetDetay('yasal_giderler', kategoriKey, yeniList);
              }}
            >
              <IconTrash size={14} />
            </ActionIcon>
          </Group>
        ))}
        <Button
          variant="subtle"
          size="xs"
          leftSection={<IconPlus size={14} />}
          onClick={() => {
            const yeniItem: YasalGiderKalem = { ad: '', tutar: 0 };
            updateMaliyetDetay('yasal_giderler', kategoriKey, [...detay[kategoriKey], yeniItem]);
          }}
        >
          Ekle
        </Button>
      </Paper>
    );

    return (
      <Stack>
        <Group justify="space-between">
          <Text fw={600} size="lg">📜 Yasal Giderler</Text>
          <Badge size="xl" color="green" variant="light">{formatPara(tutar)}</Badge>
        </Group>

        {renderKategori('sigortalar', 'Sigortalar', <IconShieldCheck size={16} />)}
        {renderKategori('belgeler', 'Belgeler & Sertifikalar', <IconScale size={16} />)}
        {renderKategori('isg', 'İş Sağlığı & Güvenliği', <IconAlertTriangle size={16} />)}
        {renderKategori('ihaleGiderleri', 'İhale Giderleri', <IconFileSpreadsheet size={16} />)}

        <Paper withBorder p="sm" bg="blue.0">
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed">Sigortalar</Text>
              <Text fw={600}>{formatPara(ozet.sigortaToplam)}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">Belgeler</Text>
              <Text fw={600}>{formatPara(ozet.belgeToplam)}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">İSG</Text>
              <Text fw={600}>{formatPara(ozet.isgToplam)}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">İhale</Text>
              <Text fw={600}>{formatPara(ozet.ihaleToplam)}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">Toplam</Text>
              <Text fw={700} c="green">{formatPara(ozet.toplam)}</Text>
            </div>
          </Group>
        </Paper>
      </Stack>
    );
  };

  // ========== RİSK PAYI FORMU ==========
  const renderRiskPayiForm = () => {
    const detay = teklifData.maliyet_detay.risk_payi.detay;
    const riskHaricToplam =
      hesaplanmisTeklifData.maliyet_detay.malzeme.tutar +
      hesaplanmisTeklifData.maliyet_detay.personel.tutar +
      hesaplanmisTeklifData.maliyet_detay.nakliye.tutar +
      hesaplanmisTeklifData.maliyet_detay.sarf_malzeme.tutar +
      hesaplanmisTeklifData.maliyet_detay.ekipman_bakim.tutar +
      hesaplanmisTeklifData.maliyet_detay.genel_gider.tutar +
      hesaplanmisTeklifData.maliyet_detay.yasal_giderler.tutar;
    const ozet = hesaplaRiskOzet(riskHaricToplam, detay);

    return (
      <Stack>
        <Group justify="space-between">
          <Text fw={600} size="lg">⚠️ Risk Payı</Text>
          <Badge size="xl" color="green" variant="light">{formatPara(ozet.riskTutari)}</Badge>
        </Group>

        <Switch
          label="Manuel oran gir"
          checked={detay.kullanManuel}
          onChange={(e) => updateMaliyetDetay('risk_payi', 'kullanManuel', e.currentTarget.checked)}
        />

        {detay.kullanManuel ? (
          <NumberInput
            label="Risk Oranı (%)"
            value={detay.manuelOran}
            onChange={(v) => updateMaliyetDetay('risk_payi', 'manuelOran', Number(v) || 0)}
            min={0}
            max={50}
            decimalScale={1}
          />
        ) : (
          <Stack gap="xs">
            <Text size="sm" fw={500}>Risk Kategorileri</Text>
            {detay.kategoriler.map((kat, idx) => (
              <Paper key={idx} withBorder p="xs">
                <Group justify="space-between">
                  <Checkbox
                    label={kat.ad}
                    checked={kat.aktif}
                    onChange={(e) => {
                      const yeniKategoriler = [...detay.kategoriler];
                      yeniKategoriler[idx] = { ...yeniKategoriler[idx], aktif: e.currentTarget.checked };
                      updateMaliyetDetay('risk_payi', 'kategoriler', yeniKategoriler);
                    }}
                  />
                  <NumberInput
                    value={kat.oran}
                    onChange={(v) => {
                      const yeniKategoriler = [...detay.kategoriler];
                      yeniKategoriler[idx] = { ...yeniKategoriler[idx], oran: Number(v) || 0 };
                      updateMaliyetDetay('risk_payi', 'kategoriler', yeniKategoriler);
                    }}
                    disabled={!kat.aktif}
                    min={0}
                    max={20}
                    decimalScale={1}
                    rightSection="%"
                    w={80}
                    size="xs"
                  />
                </Group>
              </Paper>
            ))}
          </Stack>
        )}

        <Paper withBorder p="sm" bg="orange.0">
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed">Alt Toplam (Risk Hariç)</Text>
              <Text fw={600}>{formatPara(riskHaricToplam)}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">Risk Oranı</Text>
              <Text fw={600}>%{ozet.toplamOran.toFixed(1)}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">Risk Tutarı</Text>
              <Text fw={700} c="orange">{formatPara(ozet.riskTutari)}</Text>
            </div>
          </Group>
        </Paper>
      </Stack>
    );
  };

  // Form render
  const renderMaliyetForm = () => {
    switch (selectedKalem) {
      case 'malzeme':
        return renderMalzemeForm();
      case 'personel':
        return renderPersonelForm();
      case 'nakliye':
        return renderNakliyeForm();
      case 'sarf_malzeme':
        return renderSarfMalzemeForm();
      case 'ekipman_bakim':
        return renderEkipmanForm();
      case 'genel_gider':
        return renderGenelGiderForm();
      case 'yasal_giderler':
        return renderYasalGiderlerForm();
      case 'risk_payi':
        return renderRiskPayiForm();
      default:
        return null;
    }
  };

  // Maliyet görünümü
  const renderMaliyetView = () => (
    <Box style={{ display: 'flex', height: 'calc(100vh - 280px)', minHeight: 500 }}>
      {/* Sol Panel - Kalemler */}
      <Paper
        withBorder
        p="xs"
        style={{ width: 200, flexShrink: 0, display: 'flex', flexDirection: 'column' }}
      >
        <ScrollArea style={{ flex: 1 }}>
          <Stack gap={4}>
            {MALIYET_KALEMLERI.map((kalem) => {
              const tutar = hesaplanmisTeklifData.maliyet_detay[kalem.key]?.tutar || 0;
              const isSelected = selectedKalem === kalem.key;
              return (
                <Paper
                  key={kalem.key}
                  p="xs"
                  withBorder
                  style={{
                    cursor: 'pointer',
                    backgroundColor: isSelected ? 'var(--mantine-color-blue-light)' : undefined,
                    borderColor: isSelected ? 'var(--mantine-color-blue-filled)' : undefined,
                  }}
                  onClick={() => setSelectedKalem(kalem.key)}
                >
                  <Group justify="space-between" wrap="nowrap">
                    <Group gap="xs" wrap="nowrap">
                      <Text size="lg">{kalem.icon}</Text>
                      <Text size="sm" fw={500} lineClamp={1}>
                        {kalem.label}
                      </Text>
                    </Group>
                    {isSelected && <Text size="xs">◄</Text>}
                  </Group>
                  <Text
                    size="sm"
                    c={tutar > 0 ? 'green' : 'dimmed'}
                    ta="right"
                    fw={700}
                  >
                    {formatParaKisa(tutar)}
                  </Text>
                </Paper>
              );
            })}
          </Stack>
        </ScrollArea>
      </Paper>

      {/* Sağ Panel - Form */}
      <Paper withBorder p="md" ml="md" style={{ flex: 1, overflow: 'auto' }}>
        <ScrollArea style={{ height: '100%' }}>{renderMaliyetForm()}</ScrollArea>
      </Paper>
    </Box>
  );

  // Cetvel görünümü
  const renderCetvelView = () => (
    <Box style={{ height: 'calc(100vh - 280px)', minHeight: 500, display: 'flex', flexDirection: 'column' }}>
      <Paper withBorder p="md" style={{ flex: 1, overflow: 'auto' }}>
        <Stack>
          <Group justify="space-between">
            <div>
              <Text fw={600} size="lg">📜 BİRİM FİYAT TEKLİF CETVELİ</Text>
              <Text size="sm" c="dimmed">İhale Adı: {ihaleBasligi}</Text>
              {ihaleKayitNo && <Text size="sm" c="dimmed">İhale Kayıt No: {ihaleKayitNo}</Text>}
            </div>
          </Group>

          <ScrollArea>
            <Table striped highlightOnHover withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th w={60}>Sıra</Table.Th>
                  <Table.Th>İş Kalemi</Table.Th>
                  <Table.Th w={100}>Birim</Table.Th>
                  <Table.Th w={100}>Miktar</Table.Th>
                  <Table.Th w={140}>Birim Fiyat (₺)</Table.Th>
                  <Table.Th w={140}>Tutar (₺)</Table.Th>
                  <Table.Th w={50}></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {teklifData.birim_fiyat_cetveli.map((kalem, idx) => (
                  <Table.Tr key={idx}>
                    <Table.Td>{kalem.sira}</Table.Td>
                    <Table.Td>
                      <TextInput
                        variant="unstyled"
                        value={kalem.isKalemi}
                        onChange={(e) => {
                          const yeniCetvel = [...teklifData.birim_fiyat_cetveli];
                          yeniCetvel[idx].isKalemi = e.target.value;
                          setTeklifData((prev) => ({ ...prev, birim_fiyat_cetveli: yeniCetvel }));
                        }}
                        placeholder="Kalem adı"
                      />
                    </Table.Td>
                    <Table.Td>
                      <TextInput
                        variant="unstyled"
                        value={kalem.birim}
                        onChange={(e) => {
                          const yeniCetvel = [...teklifData.birim_fiyat_cetveli];
                          yeniCetvel[idx].birim = e.target.value;
                          setTeklifData((prev) => ({ ...prev, birim_fiyat_cetveli: yeniCetvel }));
                        }}
                        placeholder="Öğün"
                      />
                    </Table.Td>
                    <Table.Td>
                      <NumberInput
                        variant="unstyled"
                        value={kalem.miktar}
                        onChange={(v) => {
                          const miktar = typeof v === 'number' ? v : 0;
                          const yeniCetvel = [...teklifData.birim_fiyat_cetveli];
                          yeniCetvel[idx].miktar = miktar;
                          yeniCetvel[idx].tutar = miktar * yeniCetvel[idx].birimFiyat;
                          const cetvelToplami = hesaplaCetvelToplami(yeniCetvel);
                          setTeklifData((prev) => ({
                            ...prev,
                            birim_fiyat_cetveli: yeniCetvel,
                            cetvel_toplami: cetvelToplami,
                          }));
                        }}
                        min={0}
                        thousandSeparator="."
                        decimalSeparator=","
                      />
                    </Table.Td>
                    <Table.Td>
                      <NumberInput
                        variant="unstyled"
                        value={kalem.birimFiyat}
                        onChange={(v) => handleCetvelBirimFiyatChange(idx, typeof v === 'number' ? v : 0)}
                        min={0}
                        decimalScale={2}
                        thousandSeparator="."
                        decimalSeparator=","
                      />
                    </Table.Td>
                    <Table.Td>
                      <Text fw={500}>{formatPara(kalem.tutar)}</Text>
                    </Table.Td>
                    <Table.Td>
                      <ActionIcon color="red" variant="subtle" onClick={() => handleCetvelKalemSil(idx)}>
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Table.Td>
                  </Table.Tr>
                ))}
                <Table.Tr>
                  <Table.Td colSpan={5} ta="right">
                    <Text fw={700}>TOPLAM</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text fw={700}>{formatPara(teklifData.cetvel_toplami)}</Text>
                  </Table.Td>
                  <Table.Td></Table.Td>
                </Table.Tr>
              </Table.Tbody>
            </Table>
          </ScrollArea>

          <Button variant="light" leftSection={<IconPlus size={16} />} onClick={handleCetvelKalemEkle}>
            Kalem Ekle
          </Button>

          {/* Karşılaştırma */}
          <Paper withBorder p="md" bg="gray.0">
            <Text fw={600} mb="xs">Karşılaştırma</Text>
            <Group justify="space-between">
              <div>
                <Text size="sm" c="dimmed">Hesaplanan Teklif:</Text>
                <Text fw={600}>{formatPara(hesaplanmisTeklifData.teklif_fiyati)}</Text>
              </div>
              <div>
                <Text size="sm" c="dimmed">Cetvel Toplamı:</Text>
                <Text fw={600}>{formatPara(teklifData.cetvel_toplami)}</Text>
              </div>
              <div>
                <Text size="sm" c="dimmed">Fark:</Text>
                <Text
                  fw={600}
                  c={hesaplanmisTeklifData.teklif_fiyati - teklifData.cetvel_toplami > 0 ? 'red' : 'green'}
                >
                  {formatPara(teklifData.cetvel_toplami - hesaplanmisTeklifData.teklif_fiyati)}
                  {Math.abs(hesaplanmisTeklifData.teklif_fiyati - teklifData.cetvel_toplami) > 1000 && ' ⚠️'}
                </Text>
              </div>
            </Group>
          </Paper>
        </Stack>
      </Paper>
    </Box>
  );

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group>
          <Text fw={600}>📄 TEKLİF OLUŞTUR</Text>
          {existingTeklifId && (
            <Badge color="blue" variant="light">
              Kayıtlı #{existingTeklifId}
            </Badge>
          )}
        </Group>
      }
      size="90%"
      styles={{
        body: { padding: 0 },
        header: { padding: '12px 16px' },
      }}
    >
      <LoadingOverlay visible={loading} />

      <Box p="md">
        {/* Tab Butonları */}
        <Group mb="md">
          <Button
            variant={viewMode === 'maliyet' ? 'filled' : 'light'}
            leftSection={<IconCalculator size={16} />}
            onClick={() => setViewMode('maliyet')}
          >
            Maliyet Hesaplama
          </Button>
          <Button
            variant={viewMode === 'cetvel' ? 'filled' : 'light'}
            leftSection={<IconFileSpreadsheet size={16} />}
            onClick={() => setViewMode('cetvel')}
          >
            Teklif Cetveli
          </Button>
        </Group>

        {/* İçerik */}
        {viewMode === 'maliyet' ? renderMaliyetView() : renderCetvelView()}

        {/* Alt Bar */}
        <Paper withBorder p="sm" mt="md" bg="gray.1">
          <Group justify="space-between">
            <Group gap="xl">
              <div>
                <Text size="xs" c="dimmed">MALİYET</Text>
                <Text fw={700} size="lg">{formatPara(hesaplanmisTeklifData.maliyet_toplam)}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">KAR</Text>
                <Group gap="xs">
                  <NumberInput
                    value={teklifData.kar_orani}
                    onChange={handleKarOraniChange}
                    min={0}
                    max={100}
                    w={60}
                    size="xs"
                    rightSection="%"
                    styles={{ input: { textAlign: 'center' } }}
                  />
                </Group>
              </div>
              <div>
                <Text size="xs" c="dimmed">KAR TUTARI</Text>
                <Text fw={700} size="lg" c="green">{formatPara(hesaplanmisTeklifData.kar_tutari)}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">TEKLİF FİYATI</Text>
                <Text fw={700} size="xl" c="blue">{formatPara(hesaplanmisTeklifData.teklif_fiyati)}</Text>
              </div>
            </Group>
            <Group>
              <Button variant="default" onClick={onClose}>
                İptal
              </Button>
              <Button
                variant="light"
                leftSection={<IconDownload size={16} />}
                disabled
              >
                PDF
              </Button>
              <Button
                color="green"
                leftSection={<IconDeviceFloppy size={16} />}
                onClick={handleKaydet}
                loading={loading}
              >
                Kaydet
              </Button>
            </Group>
          </Group>
        </Paper>
      </Box>
    </Modal>
  );
}
