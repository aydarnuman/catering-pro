'use client';

import {
  ActionIcon,
  Badge,
  Button,
  ColorInput,
  Divider,
  Group,
  Loader,
  Modal,
  Paper,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconArrowLeft,
  IconBuilding,
  IconCash,
  IconPencil,
  IconPlus,
  IconTrash,
  IconUsers,
} from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { API_BASE_URL } from '@/lib/config';

interface Proje {
  id: number;
  kod: string;
  ad: string;
  aciklama?: string;
  firma_id?: number;
  firma_unvani?: string;
  // İşveren/Lokasyon
  musteri?: string;
  lokasyon?: string;
  adres?: string;
  il?: string;
  ilce?: string;
  // Sözleşme
  sozlesme_no?: string;
  sozlesme_tarihi?: string;
  sozlesme_bitis_tarihi?: string;
  sozlesme_bedeli?: number;
  teminat_mektubu_tutari?: number;
  teminat_iade_tarihi?: string;
  // Kapasite
  gunluk_kisi_sayisi?: number;
  ogun_sayisi?: number;
  // Fatura
  fatura_unvani?: string;
  fatura_vergi_no?: string;
  fatura_vergi_dairesi?: string;
  fatura_kesim_gunu?: number;
  kdv_orani?: number;
  // Hakediş
  hakedis_tipi?: string;
  aylik_hakedis?: number;
  hakedis_gun?: number;
  // Yetkili
  yetkili?: string;
  yetkili_unvan?: string;
  telefon?: string;
  email?: string;
  // Diğer
  proje_tipi?: string;
  renk: string;
  durum: string;
  aktif: boolean;
  butce?: number;
  baslangic_tarihi?: string;
  bitis_tarihi?: string;
  notlar?: string;
  // Hesaplanan
  personel_sayisi?: number;
  toplam_maas?: number;
  siparis_sayisi?: number;
  toplam_harcama?: number;
}

interface ProjeYonetimModalProps {
  opened: boolean;
  onClose: () => void;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const durumRenkleri: Record<string, string> = {
  aktif: 'green',
  beklemede: 'orange',
  pasif: 'gray',
  tamamlandi: 'blue',
};

const emptyForm: Partial<Proje> = {
  kod: '',
  ad: '',
  aciklama: '',
  musteri: '',
  lokasyon: '',
  adres: '',
  il: '',
  ilce: '',
  sozlesme_no: '',
  sozlesme_bedeli: undefined,
  gunluk_kisi_sayisi: undefined,
  ogun_sayisi: 3,
  fatura_unvani: '',
  fatura_vergi_no: '',
  fatura_vergi_dairesi: '',
  fatura_kesim_gunu: undefined,
  kdv_orani: 10,
  aylik_hakedis: undefined,
  hakedis_gun: undefined,
  yetkili: '',
  yetkili_unvan: '',
  telefon: '',
  email: '',
  proje_tipi: 'yemek',
  renk: '#6366f1',
  durum: 'aktif',
  butce: 0,
  notlar: '',
};

export default function ProjeYonetimModal({
  opened,
  onClose,
  initialProjeId,
}: ProjeYonetimModalProps & { initialProjeId?: number }) {
  const [projeler, setProjeler] = useState<Proje[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'form' | 'detail'>('list');
  const [selectedProje, setSelectedProje] = useState<Proje | null>(null);
  const [form, setForm] = useState<Partial<Proje>>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (opened) {
      loadProjeler();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened]);

  // initialProjeId varsa o projeyi detayda aç
  useEffect(() => {
    if (opened && initialProjeId && projeler.length > 0) {
      const proje = projeler.find((p) => p.id === initialProjeId);
      if (proje) {
        setSelectedProje(proje);
        setView('detail');
      }
    }
  }, [opened, initialProjeId, projeler]);

  const loadProjeler = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/projeler`);
      if (res.ok) {
        const data = await res.json();
        setProjeler(data);
      }
    } catch (error) {
      console.error('Projeler yüklenemedi:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleYeniProje = () => {
    setForm(emptyForm);
    setSelectedProje(null);
    setView('form');
  };

  const handleDuzenle = (proje: Proje) => {
    setForm(proje);
    setSelectedProje(proje);
    setView('form');
  };

  const handleDetay = (proje: Proje) => {
    setSelectedProje(proje);
    setView('detail');
  };

  const handleSave = async () => {
    if (!form.ad) {
      notifications.show({
        title: 'Hata',
        message: 'Proje adı zorunludur',
        color: 'red',
      });
      return;
    }

    setSaving(true);
    try {
      const url = selectedProje
        ? `${API_BASE_URL}/api/projeler/${selectedProje.id}`
        : `${API_BASE_URL}/api/projeler`;
      const method = selectedProje ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        notifications.show({
          title: 'Başarılı',
          message: selectedProje ? 'Proje güncellendi' : 'Proje oluşturuldu',
          color: 'green',
        });
        loadProjeler();
        setView('list');
      } else {
        const error = await res.json();
        throw new Error(error.error);
      }
    } catch (error: any) {
      notifications.show({
        title: 'Hata',
        message: error.message || 'İşlem başarısız',
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (proje: Proje) => {
    if (!confirm(`"${proje.ad}" projesini pasif yapmak istediğinize emin misiniz?`)) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/projeler/${proje.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        notifications.show({
          title: 'Başarılı',
          message: 'Proje pasif yapıldı',
          color: 'green',
        });
        loadProjeler();
      }
    } catch (_error) {
      notifications.show({
        title: 'Hata',
        message: 'İşlem başarısız',
        color: 'red',
      });
    }
  };

  const renderListView = () => (
    <Stack gap="md">
      <Group justify="space-between">
        <Text fw={500}>Tüm Projeler ({projeler.length})</Text>
        <Button size="sm" leftSection={<IconPlus size={16} />} onClick={handleYeniProje}>
          Yeni Proje
        </Button>
      </Group>

      {loading ? (
        <Group justify="center" py="xl">
          <Loader size="sm" />
        </Group>
      ) : (
        <ScrollArea h={400}>
          <Stack gap="xs">
            {projeler.map((proje) => (
              <Paper
                key={proje.id}
                p="sm"
                radius="sm"
                withBorder
                style={{ cursor: 'pointer' }}
                onClick={() => handleDetay(proje)}
              >
                <Group justify="space-between">
                  <Group gap="sm">
                    <div
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        backgroundColor: proje.renk,
                      }}
                    />
                    <div>
                      <Group gap="xs">
                        <Text fw={500}>{proje.ad}</Text>
                        {proje.kod && (
                          <Badge size="xs" variant="outline">
                            {proje.kod}
                          </Badge>
                        )}
                        <Badge size="xs" color={durumRenkleri[proje.durum]}>
                          {proje.durum}
                        </Badge>
                      </Group>
                      <Group gap="md" mt={4}>
                        {proje.lokasyon && (
                          <Text size="xs" c="dimmed">
                            {proje.lokasyon}
                          </Text>
                        )}
                        <Text size="xs" c="dimmed">
                          <IconUsers size={12} style={{ verticalAlign: 'middle' }} />{' '}
                          {proje.personel_sayisi || 0}
                        </Text>
                        <Text size="xs" c="dimmed">
                          <IconCash size={12} style={{ verticalAlign: 'middle' }} />{' '}
                          {formatCurrency(proje.toplam_maas || 0)}
                        </Text>
                      </Group>
                    </div>
                  </Group>
                  <Group gap="xs" onClick={(e) => e.stopPropagation()}>
                    <Tooltip label="Düzenle">
                      <ActionIcon
                        variant="light"
                        color="orange"
                        onClick={() => handleDuzenle(proje)}
                      >
                        <IconPencil size={16} />
                      </ActionIcon>
                    </Tooltip>
                    {proje.aktif && (
                      <Tooltip label="Pasif Yap">
                        <ActionIcon variant="light" color="red" onClick={() => handleDelete(proje)}>
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </Group>
                </Group>
              </Paper>
            ))}
          </Stack>
        </ScrollArea>
      )}
    </Stack>
  );

  const renderFormView = () => (
    <ScrollArea h={500}>
      <Stack gap="md" pr="sm">
        <Group gap="xs">
          <ActionIcon variant="subtle" onClick={() => setView('list')}>
            <IconArrowLeft size={16} />
          </ActionIcon>
          <Text fw={500}>{selectedProje ? 'Proje Düzenle' : 'Yeni Proje'}</Text>
        </Group>

        {/* Temel Bilgiler */}
        <Divider label="TEMEL BİLGİLER" labelPosition="center" />

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <TextInput
            label="Proje Kodu"
            placeholder="KYK-01"
            value={form.kod || ''}
            onChange={(e) => setForm({ ...form, kod: e.target.value })}
          />
          <TextInput
            label="Proje Adı"
            placeholder="Proje adı"
            required
            value={form.ad || ''}
            onChange={(e) => setForm({ ...form, ad: e.target.value })}
          />
        </SimpleGrid>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <TextInput
            label="Müşteri/İşveren"
            placeholder="Kurum adı"
            value={form.musteri || ''}
            onChange={(e) => setForm({ ...form, musteri: e.target.value })}
          />
          <TextInput
            label="Lokasyon"
            placeholder="Proje yeri"
            value={form.lokasyon || ''}
            onChange={(e) => setForm({ ...form, lokasyon: e.target.value })}
          />
        </SimpleGrid>

        <TextInput
          label="Adres"
          placeholder="Tam adres"
          value={form.adres || ''}
          onChange={(e) => setForm({ ...form, adres: e.target.value })}
        />

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <TextInput
            label="İl"
            placeholder="İl"
            value={form.il || ''}
            onChange={(e) => setForm({ ...form, il: e.target.value })}
          />
          <TextInput
            label="İlçe"
            placeholder="İlçe"
            value={form.ilce || ''}
            onChange={(e) => setForm({ ...form, ilce: e.target.value })}
          />
        </SimpleGrid>

        {/* Sözleşme Bilgileri */}
        <Divider label="SÖZLEŞME BİLGİLERİ" labelPosition="center" />

        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
          <TextInput
            label="Sözleşme No"
            placeholder="2024/001"
            value={form.sozlesme_no || ''}
            onChange={(e) => setForm({ ...form, sozlesme_no: e.target.value })}
          />
          <TextInput
            label="Sözleşme Tarihi"
            type="date"
            value={form.sozlesme_tarihi || ''}
            onChange={(e) => setForm({ ...form, sozlesme_tarihi: e.target.value })}
          />
          <TextInput
            label="Bitiş Tarihi"
            type="date"
            value={form.sozlesme_bitis_tarihi || ''}
            onChange={(e) => setForm({ ...form, sozlesme_bitis_tarihi: e.target.value })}
          />
        </SimpleGrid>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <TextInput
            label="Sözleşme Bedeli (TL)"
            type="number"
            placeholder="0"
            value={form.sozlesme_bedeli || ''}
            onChange={(e) =>
              setForm({ ...form, sozlesme_bedeli: parseFloat(e.target.value) || undefined })
            }
          />
          <TextInput
            label="Teminat Tutarı (TL)"
            type="number"
            placeholder="0"
            value={form.teminat_mektubu_tutari || ''}
            onChange={(e) =>
              setForm({ ...form, teminat_mektubu_tutari: parseFloat(e.target.value) || undefined })
            }
          />
        </SimpleGrid>

        {/* Kapasite Bilgileri */}
        <Divider label="KAPASİTE BİLGİLERİ" labelPosition="center" />

        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
          <TextInput
            label="Günlük Kişi Sayısı"
            type="number"
            placeholder="100"
            value={form.gunluk_kisi_sayisi || ''}
            onChange={(e) =>
              setForm({ ...form, gunluk_kisi_sayisi: parseInt(e.target.value, 10) || undefined })
            }
          />
          <Select
            label="Öğün Sayısı"
            data={[
              { value: '1', label: '1 Öğün' },
              { value: '2', label: '2 Öğün' },
              { value: '3', label: '3 Öğün' },
              { value: '4', label: '4 Öğün' },
            ]}
            value={String(form.ogun_sayisi || 3)}
            onChange={(v) => setForm({ ...form, ogun_sayisi: parseInt(v || '3', 10) })}
          />
          <TextInput
            label="Aylık Hakediş (TL)"
            type="number"
            placeholder="0"
            value={form.aylik_hakedis || ''}
            onChange={(e) =>
              setForm({ ...form, aylik_hakedis: parseFloat(e.target.value) || undefined })
            }
          />
        </SimpleGrid>

        {/* Fatura Bilgileri */}
        <Divider label="FATURA BİLGİLERİ" labelPosition="center" />

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <TextInput
            label="Fatura Unvanı"
            placeholder="Kurum fatura unvanı"
            value={form.fatura_unvani || ''}
            onChange={(e) => setForm({ ...form, fatura_unvani: e.target.value })}
          />
          <TextInput
            label="Vergi No"
            placeholder="1234567890"
            value={form.fatura_vergi_no || ''}
            onChange={(e) => setForm({ ...form, fatura_vergi_no: e.target.value })}
          />
        </SimpleGrid>

        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
          <TextInput
            label="Vergi Dairesi"
            placeholder="Vergi dairesi"
            value={form.fatura_vergi_dairesi || ''}
            onChange={(e) => setForm({ ...form, fatura_vergi_dairesi: e.target.value })}
          />
          <TextInput
            label="Fatura Kesim Günü"
            type="number"
            placeholder="1-31"
            value={form.fatura_kesim_gunu || ''}
            onChange={(e) =>
              setForm({ ...form, fatura_kesim_gunu: parseInt(e.target.value, 10) || undefined })
            }
          />
          <Select
            label="KDV Oranı"
            data={[
              { value: '0', label: '%0' },
              { value: '1', label: '%1' },
              { value: '8', label: '%8' },
              { value: '10', label: '%10' },
              { value: '18', label: '%18' },
              { value: '20', label: '%20' },
            ]}
            value={String(form.kdv_orani || 10)}
            onChange={(v) => setForm({ ...form, kdv_orani: parseInt(v || '10', 10) })}
          />
        </SimpleGrid>

        {/* Yetkili Bilgileri */}
        <Divider label="YETKİLİ BİLGİLERİ" labelPosition="center" />

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <TextInput
            label="Yetkili Adı"
            placeholder="Yetkili kişi"
            value={form.yetkili || ''}
            onChange={(e) => setForm({ ...form, yetkili: e.target.value })}
          />
          <TextInput
            label="Yetkili Unvanı"
            placeholder="Müdür, Koordinatör vb."
            value={form.yetkili_unvan || ''}
            onChange={(e) => setForm({ ...form, yetkili_unvan: e.target.value })}
          />
        </SimpleGrid>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <TextInput
            label="Telefon"
            placeholder="0532 xxx xx xx"
            value={form.telefon || ''}
            onChange={(e) => setForm({ ...form, telefon: e.target.value })}
          />
          <TextInput
            label="E-posta"
            placeholder="email@kurum.gov.tr"
            value={form.email || ''}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </SimpleGrid>

        {/* Durum */}
        <Divider label="DURUM" labelPosition="center" />

        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
          <Select
            label="Durum"
            data={[
              { value: 'aktif', label: 'Aktif' },
              { value: 'beklemede', label: 'Beklemede' },
              { value: 'tamamlandi', label: 'Tamamlandı' },
              { value: 'pasif', label: 'Pasif' },
            ]}
            value={form.durum || 'aktif'}
            onChange={(v) => setForm({ ...form, durum: v || 'aktif' })}
          />
          <Select
            label="Proje Tipi"
            data={[
              { value: 'yemek', label: 'Yemek Hizmeti' },
              { value: 'temizlik', label: 'Temizlik' },
              { value: 'guvenlik', label: 'Güvenlik' },
              { value: 'diger', label: 'Diğer' },
            ]}
            value={form.proje_tipi || 'yemek'}
            onChange={(v) => setForm({ ...form, proje_tipi: v || 'yemek' })}
          />
          <ColorInput
            label="Renk"
            value={form.renk || '#6366f1'}
            onChange={(v) => setForm({ ...form, renk: v })}
          />
        </SimpleGrid>

        <Textarea
          label="Notlar"
          placeholder="Proje ile ilgili notlar"
          value={form.notlar || ''}
          onChange={(e) => setForm({ ...form, notlar: e.target.value })}
          rows={2}
        />

        <Group justify="flex-end" mt="md">
          <Button variant="subtle" onClick={() => setView('list')}>
            İptal
          </Button>
          <Button loading={saving} onClick={handleSave}>
            {selectedProje ? 'Güncelle' : 'Oluştur'}
          </Button>
        </Group>
      </Stack>
    </ScrollArea>
  );

  const renderDetailView = () => {
    if (!selectedProje) return null;

    const formatCurrencyLocal = (val: number | undefined | null) => {
      if (!val) return '₺0';
      return new Intl.NumberFormat('tr-TR', {
        style: 'currency',
        currency: 'TRY',
        maximumFractionDigits: 0,
      }).format(val);
    };

    const formatDate = (date: string | undefined | null) => {
      if (!date) return '-';
      return new Date(date).toLocaleDateString('tr-TR');
    };

    return (
      <Stack gap="md">
        {/* Başlık */}
        <Group justify="space-between">
          <Group gap="xs">
            <ActionIcon variant="subtle" onClick={() => setView('list')}>
              <IconArrowLeft size={16} />
            </ActionIcon>
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                backgroundColor: selectedProje.renk,
              }}
            />
            <Text fw={600} size="lg">
              {selectedProje.ad}
            </Text>
            {selectedProje.kod && (
              <Badge size="sm" variant="outline">
                {selectedProje.kod}
              </Badge>
            )}
            <Badge color={durumRenkleri[selectedProje.durum]}>{selectedProje.durum}</Badge>
          </Group>
          <Button
            variant="light"
            color="orange"
            size="sm"
            leftSection={<IconPencil size={14} />}
            onClick={() => handleDuzenle(selectedProje)}
          >
            Düzenle
          </Button>
        </Group>

        <ScrollArea h={450}>
          <Stack gap="md">
            {/* Temel Bilgiler */}
            <Paper p="md" radius="md" withBorder>
              <Text size="sm" fw={600} mb="sm" c="blue">
                📋 Temel Bilgiler
              </Text>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
                <Text size="sm">
                  <b>Müşteri/İşveren:</b> {selectedProje.musteri || '-'}
                </Text>
                <Text size="sm">
                  <b>Lokasyon:</b> {selectedProje.lokasyon || '-'}
                </Text>
                <Text size="sm">
                  <b>İl:</b> {selectedProje.il || '-'}
                </Text>
                <Text size="sm">
                  <b>İlçe:</b> {selectedProje.ilce || '-'}
                </Text>
              </SimpleGrid>
              {selectedProje.adres && (
                <Text size="sm" mt="xs">
                  <b>Adres:</b> {selectedProje.adres}
                </Text>
              )}
            </Paper>

            {/* Sözleşme Bilgileri */}
            <Paper p="md" radius="md" withBorder>
              <Text size="sm" fw={600} mb="sm" c="green">
                📄 Sözleşme Bilgileri
              </Text>
              <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="xs">
                <Text size="sm">
                  <b>Sözleşme No:</b> {selectedProje.sozlesme_no || '-'}
                </Text>
                <Text size="sm">
                  <b>Başlangıç:</b> {formatDate(selectedProje.sozlesme_tarihi)}
                </Text>
                <Text size="sm">
                  <b>Bitiş:</b> {formatDate(selectedProje.sozlesme_bitis_tarihi)}
                </Text>
                <Text size="sm">
                  <b>Sözleşme Bedeli:</b> {formatCurrencyLocal(selectedProje.sozlesme_bedeli)}
                </Text>
                <Text size="sm">
                  <b>Teminat Tutarı:</b> {formatCurrencyLocal(selectedProje.teminat_mektubu_tutari)}
                </Text>
                <Text size="sm">
                  <b>Teminat İade:</b> {formatDate(selectedProje.teminat_iade_tarihi)}
                </Text>
              </SimpleGrid>
            </Paper>

            {/* Kapasite & Fatura Bilgileri */}
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <Paper p="md" radius="md" withBorder>
                <Text size="sm" fw={600} mb="sm" c="orange">
                  🍽️ Kapasite Bilgileri
                </Text>
                <Stack gap={4}>
                  <Text size="sm">
                    <b>Günlük Kişi:</b> {selectedProje.gunluk_kisi_sayisi || '-'}
                  </Text>
                  <Text size="sm">
                    <b>Öğün Sayısı:</b> {selectedProje.ogun_sayisi || '-'}
                  </Text>
                  <Text size="sm">
                    <b>Hakediş Tipi:</b> {selectedProje.hakedis_tipi || '-'}
                  </Text>
                  <Text size="sm">
                    <b>Aylık Hakediş:</b> {formatCurrencyLocal(selectedProje.aylik_hakedis)}
                  </Text>
                </Stack>
              </Paper>

              <Paper p="md" radius="md" withBorder>
                <Text size="sm" fw={600} mb="sm" c="violet">
                  🧾 Fatura Bilgileri
                </Text>
                <Stack gap={4}>
                  <Text size="sm">
                    <b>Fatura Ünvanı:</b> {selectedProje.fatura_unvani || '-'}
                  </Text>
                  <Text size="sm">
                    <b>Vergi No:</b> {selectedProje.fatura_vergi_no || '-'}
                  </Text>
                  <Text size="sm">
                    <b>Vergi Dairesi:</b> {selectedProje.fatura_vergi_dairesi || '-'}
                  </Text>
                  <Text size="sm">
                    <b>Kesim Günü:</b>{' '}
                    {selectedProje.fatura_kesim_gunu
                      ? `Her ayın ${selectedProje.fatura_kesim_gunu}. günü`
                      : '-'}
                  </Text>
                </Stack>
              </Paper>
            </SimpleGrid>

            {/* Yetkili Bilgileri */}
            <Paper p="md" radius="md" withBorder>
              <Text size="sm" fw={600} mb="sm" c="cyan">
                👤 Yetkili Bilgileri
              </Text>
              <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="xs">
                <Text size="sm">
                  <b>Yetkili:</b> {selectedProje.yetkili || '-'}
                </Text>
                <Text size="sm">
                  <b>Ünvan:</b> {selectedProje.yetkili_unvan || '-'}
                </Text>
                <Text size="sm">
                  <b>Telefon:</b> {selectedProje.telefon || '-'}
                </Text>
                <Text size="sm">
                  <b>E-posta:</b> {selectedProje.email || '-'}
                </Text>
              </SimpleGrid>
            </Paper>

            {/* Notlar */}
            {selectedProje.notlar && (
              <Paper p="md" radius="md" withBorder bg="gray.0">
                <Text size="sm" fw={600} mb="sm">
                  📝 Notlar
                </Text>
                <Text size="sm" c="dimmed">
                  {selectedProje.notlar}
                </Text>
              </Paper>
            )}
          </Stack>
        </ScrollArea>
      </Stack>
    );
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="sm">
          <ThemeIcon
            size="lg"
            radius="md"
            variant="gradient"
            gradient={{ from: 'indigo', to: 'violet' }}
          >
            <IconBuilding size={20} />
          </ThemeIcon>
          <Text fw={600}>Proje Yönetimi</Text>
        </Group>
      }
      size="lg"
      centered
    >
      {view === 'list' && renderListView()}
      {view === 'form' && renderFormView()}
      {view === 'detail' && renderDetailView()}
    </Modal>
  );
}
