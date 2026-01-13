'use client';
import { API_BASE_URL } from '@/lib/config';

import { useState, useEffect } from 'react';
import {
  Modal,
  Text,
  Group,
  Stack,
  Button,
  Select,
  Badge,
  Paper,
  SimpleGrid,
  Divider,
  Alert,
  NumberInput,
  Textarea,
  Checkbox,
  Accordion,
  ThemeIcon,
  Table,
  Tooltip,
  ActionIcon,
  Loader,
  Center,
  Box
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import {
  IconInfoCircle,
  IconAlertTriangle,
  IconCheck,
  IconCash,
  IconCalendar,
  IconUser,
  IconBriefcase,
  IconScale,
  IconDownload,
  IconMail,
  IconCalculator,
  IconExternalLink
} from '@tabler/icons-react';
import 'dayjs/locale/tr';

const API_URL = `${API_BASE_URL}/api`;

// Çıkış sebepleri tip tanımı
interface CikisSebebi {
  kod: string;
  ad: string;
  kidem: boolean;
  ihbar: boolean;
  izin: boolean;
  aciklama: string;
  kanun: string;
}

// Personel tip tanımı
interface Personel {
  id: number;
  ad: string;
  soyad: string;
  maas: number;
  ise_giris_tarihi: string;
  kalan_izin_gun?: number;
  pozisyon?: string;
  departman?: string;
}

// Hesaplama sonucu tip tanımı
interface TazminatHesap {
  personel: {
    id: number;
    ad: string;
    soyad: string;
    tam_ad: string;
    tc_kimlik: string;
    pozisyon: string;
    departman: string;
    ise_giris_tarihi: string;
    brut_maas: number;
    kalan_izin_gun: number;
  };
  cikis: {
    tarih: string;
    sebep: CikisSebebi;
  };
  calisma_suresi: {
    yil: number;
    ay: number;
    gun: number;
    toplam_yil: number;
    toplam_ay: number;
    toplam_gun: number;
    metin: string;
  };
  hesaplama: {
    gunluk_brut: number;
    kidem_tavani: number;
    tavan_asimi: boolean;
    kidem_matrahi: number;
  };
  kidem: {
    hak_var: boolean;
    gun: number;
    tutar: number;
    aciklama: string;
    kanun_ref: KanunRef;
  };
  ihbar: {
    hak_var: boolean;
    gun: number;
    tutar: number;
    aciklama: string;
    kanun_ref: KanunRef;
  };
  izin: {
    hak_var: boolean;
    gun: number;
    tutar: number;
    aciklama: string;
    kanun_ref: KanunRef;
  };
  toplam: {
    tutar: number;
    metin: string;
  };
  yasal_bilgiler: {
    kidem: KanunRef;
    ihbar: KanunRef;
    izin: KanunRef;
  };
}

interface KanunRef {
  kanun: string;
  baslik: string;
  ozet: string;
  detay: string[];
  link: string;
}

interface TazminatModalProps {
  opened: boolean;
  onClose: () => void;
  personel: Personel | null;
  onSuccess?: () => void;
}

export function TazminatModal({ opened, onClose, personel, onSuccess }: TazminatModalProps) {
  const [cikisSebepler, setCikisSebepler] = useState<Record<string, CikisSebebi>>({});
  const [selectedSebep, setSelectedSebep] = useState<string | null>(null);
  const [cikisTarihi, setCikisTarihi] = useState<Date | null>(new Date());
  const [kalanIzinGun, setKalanIzinGun] = useState<number | string>(0);
  const [notlar, setNotlar] = useState('');
  const [istenCikar, setIstenCikar] = useState(false);
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [hesap, setHesap] = useState<TazminatHesap | null>(null);

  // Çıkış sebeplerini yükle
  useEffect(() => {
    if (opened) {
      fetchCikisSebepler();
      // Personelin kalan izin günü
      if (personel?.kalan_izin_gun !== undefined) {
        setKalanIzinGun(personel.kalan_izin_gun);
      }
    }
  }, [opened, personel]);

  // Sebep veya tarih değişince hesapla
  useEffect(() => {
    if (selectedSebep && cikisTarihi && personel) {
      hesaplaTazminat();
    }
  }, [selectedSebep, cikisTarihi, kalanIzinGun]);

  const fetchCikisSebepler = async () => {
    try {
      const res = await fetch(`${API_URL}/personel/tazminat/sebepler`);
      const data = await res.json();
      setCikisSebepler(data);
    } catch (error) {
      console.error('Çıkış sebepleri yüklenemedi:', error);
    }
  };

  const hesaplaTazminat = async () => {
    if (!personel || !selectedSebep || !cikisTarihi) return;

    setCalculating(true);
    try {
      const res = await fetch(`${API_URL}/personel/tazminat/hesapla`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personelId: personel.id,
          cikisSebebi: selectedSebep,
          cikisTarihi: cikisTarihi.toISOString().split('T')[0],
          kalanIzinGun: Number(kalanIzinGun) || 0
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }

      const data = await res.json();
      setHesap(data);
    } catch (error: any) {
      notifications.show({
        title: 'Hesaplama Hatası',
        message: error.message,
        color: 'red'
      });
    } finally {
      setCalculating(false);
    }
  };

  const handleKaydet = async () => {
    if (!hesap) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/personel/tazminat/kaydet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personelId: personel!.id,
          cikisSebebi: selectedSebep,
          cikisTarihi: cikisTarihi!.toISOString().split('T')[0],
          kalanIzinGun: Number(kalanIzinGun) || 0,
          notlar,
          istenCikar
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }

      notifications.show({
        title: 'Tazminat Kaydedildi',
        message: istenCikar ? 'Personel işten çıkarıldı ve tazminat hesabı kaydedildi.' : 'Tazminat hesabı kaydedildi.',
        color: 'teal'
      });

      onSuccess?.();
      handleClose();
    } catch (error: any) {
      notifications.show({
        title: 'Kayıt Hatası',
        message: error.message,
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedSebep(null);
    setCikisTarihi(new Date());
    setKalanIzinGun(0);
    setNotlar('');
    setIstenCikar(false);
    setHesap(null);
    onClose();
  };

  const formatMoney = (val: number) => {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val || 0);
  };

  const formatDate = (date: string) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('tr-TR');
  };

  const sebepOptions = Object.values(cikisSebepler).map(s => ({
    value: s.kod,
    label: s.ad
  }));

  const selectedSebepData = selectedSebep ? cikisSebepler[selectedSebep] : null;

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={
        <Group gap="xs">
          <ThemeIcon color="orange" variant="light" size="lg">
            <IconCalculator size={20} />
          </ThemeIcon>
          <div>
            <Text fw={600}>Tazminat Hesaplama</Text>
            {personel && (
              <Text size="xs" c="dimmed">{personel.ad} {personel.soyad}</Text>
            )}
          </div>
        </Group>
      }
      size="xl"
      centered
    >
      <Stack gap="md">
        {/* Personel Bilgileri */}
        {personel && (
          <Paper withBorder p="md" radius="md" bg="gray.0">
            <SimpleGrid cols={3}>
              <div>
                <Text size="xs" c="dimmed">Personel</Text>
                <Text fw={600}>{personel.ad} {personel.soyad}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">Brüt Maaş</Text>
                <Text fw={600} c="teal">{formatMoney(personel.maas)}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">İşe Giriş</Text>
                <Text fw={600}>{formatDate(personel.ise_giris_tarihi)}</Text>
              </div>
            </SimpleGrid>
          </Paper>
        )}

        {/* Giriş Alanları */}
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <Select
            label="Çıkış Sebebi"
            placeholder="Çıkış sebebi seçin"
            data={sebepOptions}
            value={selectedSebep}
            onChange={setSelectedSebep}
            required
          />
          <DatePickerInput
            label="Çıkış Tarihi"
            placeholder="Tarih seçin"
            value={cikisTarihi}
            onChange={setCikisTarihi}
            locale="tr"
            required
          />
        </SimpleGrid>

        <NumberInput
          label="Kalan İzin Günü"
          description="Kullanılmayan yıllık izin günleri"
          value={kalanIzinGun}
          onChange={setKalanIzinGun}
          min={0}
          max={100}
        />

        {/* Çıkış Sebebi Açıklaması */}
        {selectedSebepData && (
          <Alert 
            icon={<IconInfoCircle size={16} />} 
            color={selectedSebepData.kidem ? 'teal' : 'gray'}
            variant="light"
          >
            <Text size="sm" fw={500}>{selectedSebepData.ad}</Text>
            <Text size="xs" mt="xs">{selectedSebepData.aciklama}</Text>
            <Group gap="xs" mt="xs">
              {selectedSebepData.kidem && <Badge size="xs" color="teal">Kıdem ✓</Badge>}
              {selectedSebepData.ihbar && <Badge size="xs" color="blue">İhbar ✓</Badge>}
              {selectedSebepData.izin && <Badge size="xs" color="orange">İzin ✓</Badge>}
              {!selectedSebepData.kidem && <Badge size="xs" color="gray">Kıdem ✗</Badge>}
              {!selectedSebepData.ihbar && <Badge size="xs" color="gray">İhbar ✗</Badge>}
            </Group>
          </Alert>
        )}

        <Divider />

        {/* Hesaplama Sonucu */}
        {calculating ? (
          <Center p="xl">
            <Loader size="lg" />
          </Center>
        ) : hesap ? (
          <Stack gap="md">
            {/* Çalışma Süresi */}
            <Paper withBorder p="md" radius="md">
              <Group justify="space-between">
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase">Çalışma Süresi</Text>
                  <Text fw={700} size="xl">{hesap.calisma_suresi.metin}</Text>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <Text size="xs" c="dimmed">Günlük Brüt</Text>
                  <Text fw={600}>{formatMoney(hesap.hesaplama.gunluk_brut)}</Text>
                </div>
              </Group>
              {hesap.hesaplama.tavan_asimi && (
                <Alert icon={<IconAlertTriangle size={14} />} color="yellow" variant="light" mt="sm">
                  <Text size="xs">
                    Kıdem tazminatı tavanı ({formatMoney(hesap.hesaplama.kidem_tavani)}) aşıldı. 
                    Hesaplama tavan üzerinden yapılmıştır.
                  </Text>
                </Alert>
              )}
            </Paper>

            {/* Tazminat Detayları */}
            <SimpleGrid cols={3}>
              {/* Kıdem */}
              <Paper 
                withBorder 
                p="md" 
                radius="md" 
                style={{ 
                  borderColor: hesap.kidem.hak_var ? 'var(--mantine-color-teal-5)' : undefined,
                  opacity: hesap.kidem.hak_var ? 1 : 0.6
                }}
              >
                <Group justify="space-between" mb="xs">
                  <Text size="xs" c="dimmed" tt="uppercase">Kıdem Tazminatı</Text>
                  <Tooltip label={hesap.kidem.kanun_ref.ozet} multiline w={300}>
                    <ActionIcon variant="subtle" size="xs" color="gray">
                      <IconInfoCircle size={14} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
                <Text fw={700} size="xl" c={hesap.kidem.hak_var ? 'teal' : 'dimmed'}>
                  {formatMoney(hesap.kidem.tutar)}
                </Text>
                <Text size="xs" c="dimmed" mt="xs">{hesap.kidem.gun} gün</Text>
                {!hesap.kidem.hak_var && (
                  <Badge size="xs" color="gray" mt="xs">Hak yok</Badge>
                )}
              </Paper>

              {/* İhbar */}
              <Paper 
                withBorder 
                p="md" 
                radius="md"
                style={{ 
                  borderColor: hesap.ihbar.hak_var ? 'var(--mantine-color-blue-5)' : undefined,
                  opacity: hesap.ihbar.hak_var ? 1 : 0.6
                }}
              >
                <Group justify="space-between" mb="xs">
                  <Text size="xs" c="dimmed" tt="uppercase">İhbar Tazminatı</Text>
                  <Tooltip label={hesap.ihbar.kanun_ref.ozet} multiline w={300}>
                    <ActionIcon variant="subtle" size="xs" color="gray">
                      <IconInfoCircle size={14} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
                <Text fw={700} size="xl" c={hesap.ihbar.hak_var ? 'blue' : 'dimmed'}>
                  {formatMoney(hesap.ihbar.tutar)}
                </Text>
                <Text size="xs" c="dimmed" mt="xs">{hesap.ihbar.gun} gün</Text>
                {!hesap.ihbar.hak_var && (
                  <Badge size="xs" color="gray" mt="xs">Hak yok</Badge>
                )}
              </Paper>

              {/* İzin */}
              <Paper 
                withBorder 
                p="md" 
                radius="md"
                style={{ 
                  borderColor: hesap.izin.hak_var ? 'var(--mantine-color-orange-5)' : undefined,
                  opacity: hesap.izin.hak_var ? 1 : 0.6
                }}
              >
                <Group justify="space-between" mb="xs">
                  <Text size="xs" c="dimmed" tt="uppercase">İzin Ücreti</Text>
                  <Tooltip label={hesap.izin.kanun_ref.ozet} multiline w={300}>
                    <ActionIcon variant="subtle" size="xs" color="gray">
                      <IconInfoCircle size={14} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
                <Text fw={700} size="xl" c={hesap.izin.hak_var ? 'orange' : 'dimmed'}>
                  {formatMoney(hesap.izin.tutar)}
                </Text>
                <Text size="xs" c="dimmed" mt="xs">{hesap.izin.gun} gün</Text>
                {!hesap.izin.hak_var && (
                  <Badge size="xs" color="gray" mt="xs">İzin yok</Badge>
                )}
              </Paper>
            </SimpleGrid>

            {/* Toplam */}
            <Paper withBorder p="lg" radius="md" bg="teal.0">
              <Group justify="space-between">
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase">Toplam Tazminat</Text>
                  <Text fw={700} size="2rem" c="teal">{formatMoney(hesap.toplam.tutar)}</Text>
                </div>
                <ThemeIcon size={50} color="teal" variant="light" radius="xl">
                  <IconCash size={28} />
                </ThemeIcon>
              </Group>
            </Paper>

            {/* Yasal Bilgiler Accordion */}
            <Accordion variant="contained">
              <Accordion.Item value="yasal">
                <Accordion.Control icon={<IconScale size={16} />}>
                  <Text size="sm" fw={500}>Yasal Bilgiler</Text>
                </Accordion.Control>
                <Accordion.Panel>
                  <Stack gap="sm">
                    {[hesap.yasal_bilgiler.kidem, hesap.yasal_bilgiler.ihbar, hesap.yasal_bilgiler.izin].map((yb, i) => (
                      <Paper key={i} withBorder p="sm" radius="md">
                        <Group justify="space-between" mb="xs">
                          <Text size="sm" fw={600}>{yb.baslik}</Text>
                          <Badge size="xs" variant="light">{yb.kanun}</Badge>
                        </Group>
                        <Text size="xs" c="dimmed">{yb.ozet}</Text>
                        <Divider my="xs" />
                        <Stack gap={4}>
                          {yb.detay.map((d, j) => (
                            <Text key={j} size="xs">• {d}</Text>
                          ))}
                        </Stack>
                        <Button
                          variant="subtle"
                          size="xs"
                          mt="xs"
                          rightSection={<IconExternalLink size={12} />}
                          component="a"
                          href={yb.link}
                          target="_blank"
                        >
                          Mevzuata Git
                        </Button>
                      </Paper>
                    ))}
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>
            </Accordion>
          </Stack>
        ) : (
          <Alert icon={<IconInfoCircle size={16} />} color="gray">
            Çıkış sebebi ve tarihini seçin, tazminat otomatik hesaplanacaktır.
          </Alert>
        )}

        {/* Notlar ve Kaydetme */}
        {hesap && (
          <>
            <Textarea
              label="Notlar"
              placeholder="Ek notlar (isteğe bağlı)"
              value={notlar}
              onChange={(e) => setNotlar(e.target.value)}
              minRows={2}
            />

            <Checkbox
              label="Personeli işten çıkar ve tazminatı kaydet"
              description="Bu seçenek işaretlenirse personel pasif duruma alınır"
              checked={istenCikar}
              onChange={(e) => setIstenCikar(e.target.checked)}
              color="orange"
            />

            <Group justify="space-between" mt="md">
              <Group>
                <Button variant="light" leftSection={<IconDownload size={16} />}>
                  PDF İndir
                </Button>
                <Button variant="light" leftSection={<IconMail size={16} />}>
                  E-posta Gönder
                </Button>
              </Group>
              <Group>
                <Button variant="subtle" onClick={handleClose}>İptal</Button>
                <Button
                  color="teal"
                  leftSection={<IconCheck size={16} />}
                  onClick={handleKaydet}
                  loading={loading}
                >
                  {istenCikar ? 'Kaydet ve İşten Çıkar' : 'Sadece Kaydet'}
                </Button>
              </Group>
            </Group>
          </>
        )}
      </Stack>
    </Modal>
  );
}

export default TazminatModal;

