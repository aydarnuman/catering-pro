'use client';

import { useState, useEffect } from 'react';
import {
  Modal,
  Text,
  Group,
  Stack,
  Badge,
  Button,
  Paper,
  TextInput,
  Textarea,
  Select,
  ColorInput,
  SimpleGrid,
  Tabs,
  ActionIcon,
  Tooltip,
  Loader,
  Alert,
  ThemeIcon,
  Divider,
  Table,
  ScrollArea,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconBuilding,
  IconPlus,
  IconPencil,
  IconTrash,
  IconUsers,
  IconCash,
  IconShoppingCart,
  IconChartBar,
  IconCheck,
  IconX,
  IconInfoCircle,
  IconEye,
  IconArrowLeft,
} from '@tabler/icons-react';
import { API_BASE_URL } from '@/lib/config';

interface Proje {
  id: number;
  kod: string;
  ad: string;
  aciklama?: string;
  musteri?: string;
  lokasyon?: string;
  adres?: string;
  yetkili?: string;
  telefon?: string;
  renk: string;
  durum: string;
  aktif: boolean;
  butce?: number;
  baslangic_tarihi?: string;
  bitis_tarihi?: string;
  personel_sayisi?: number;
  toplam_maas?: number;
  siparis_sayisi?: number;
  toplam_harcama?: number;
}

interface TamOzet {
  proje: Proje;
  personel: {
    aktif_sayisi: number;
    toplam_net_maas: number;
    toplam_bordro_maas: number;
    toplam_elden_fark: number;
  };
  bordro: {
    yil: number;
    ay: number;
    bu_ay_tahakkuk: number;
    net_ucretler: number;
    sgk_vergi_toplam: number;
    odeme_durumu: {
      toplam_personel: number;
      banka_odenen: number;
      elden_odenen: number;
      odenen_banka: number;
      odenen_elden: number;
    };
    sgk_odendi: boolean;
    vergi_odendi: boolean;
  };
  satin_alma: {
    toplam_siparis: number;
    bekleyen: number;
    tamamlanan: number;
    toplam_harcama: number;
  };
  finans: {
    bu_ay: {
      gelir: number;
      gider: number;
      net: number;
      odenen_gider: number;
    };
    toplam: {
      gelir: number;
      gider: number;
      net: number;
    };
  };
  faturalar: {
    alis_toplam: number;
    satis_toplam: number;
    bekleyen: number;
    not: string;
  };
  demirbas: {
    toplam_adet: number;
    toplam_deger: number;
    not: string;
  };
  cek_senet: {
    toplam_cek: number;
    toplam_senet: number;
    bekleyen_tutar: number;
    not: string;
  };
  _meta: {
    tarih: string;
    yil: number;
    ay: number;
  };
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
  yetkili: '',
  telefon: '',
  renk: '#6366f1',
  durum: 'aktif',
  butce: 0,
};

export default function ProjeYonetimModal({ opened, onClose }: ProjeYonetimModalProps) {
  const [projeler, setProjeler] = useState<Proje[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'form' | 'detail'>('list');
  const [selectedProje, setSelectedProje] = useState<Proje | null>(null);
  const [tamOzet, setTamOzet] = useState<TamOzet | null>(null);
  const [form, setForm] = useState<Partial<Proje>>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (opened) {
      loadProjeler();
    }
  }, [opened]);

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

  const loadTamOzet = async (projeId: number) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/projeler/${projeId}/tam-ozet`);
      if (res.ok) {
        const data = await res.json();
        setTamOzet(data);
      }
    } catch (error) {
      console.error('Proje özeti yüklenemedi:', error);
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

  const handleDetay = async (proje: Proje) => {
    setSelectedProje(proje);
    setTamOzet(null);
    setView('detail');
    await loadTamOzet(proje.id);
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
    } catch (error) {
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
        <Button 
          size="sm" 
          leftSection={<IconPlus size={16} />}
          onClick={handleYeniProje}
        >
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
              <Paper key={proje.id} p="sm" radius="sm" withBorder>
                <Group justify="space-between">
                  <Group gap="sm">
                    <div 
                      style={{ 
                        width: 12, 
                        height: 12, 
                        borderRadius: '50%', 
                        backgroundColor: proje.renk 
                      }} 
                    />
                    <div>
                      <Group gap="xs">
                        <Text fw={500}>{proje.ad}</Text>
                        {proje.kod && <Badge size="xs" variant="outline">{proje.kod}</Badge>}
                        <Badge size="xs" color={durumRenkleri[proje.durum]}>
                          {proje.durum}
                        </Badge>
                      </Group>
                      <Group gap="md" mt={4}>
                        {proje.lokasyon && <Text size="xs" c="dimmed">{proje.lokasyon}</Text>}
                        <Text size="xs" c="dimmed">
                          <IconUsers size={12} style={{ verticalAlign: 'middle' }} /> {proje.personel_sayisi || 0}
                        </Text>
                        <Text size="xs" c="dimmed">
                          <IconCash size={12} style={{ verticalAlign: 'middle' }} /> {formatCurrency(proje.toplam_maas || 0)}
                        </Text>
                      </Group>
                    </div>
                  </Group>
                  <Group gap="xs">
                    <Tooltip label="Detay">
                      <ActionIcon variant="light" color="blue" onClick={() => handleDetay(proje)}>
                        <IconEye size={16} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Düzenle">
                      <ActionIcon variant="light" color="orange" onClick={() => handleDuzenle(proje)}>
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
    <Stack gap="md">
      <Group gap="xs">
        <ActionIcon variant="subtle" onClick={() => setView('list')}>
          <IconArrowLeft size={16} />
        </ActionIcon>
        <Text fw={500}>{selectedProje ? 'Proje Düzenle' : 'Yeni Proje'}</Text>
      </Group>

      <SimpleGrid cols={2} spacing="md">
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

      <Textarea
        label="Açıklama"
        placeholder="Proje açıklaması"
        value={form.aciklama || ''}
        onChange={(e) => setForm({ ...form, aciklama: e.target.value })}
        rows={2}
      />

      <SimpleGrid cols={2} spacing="md">
        <TextInput
          label="Müşteri"
          placeholder="Müşteri adı"
          value={form.musteri || ''}
          onChange={(e) => setForm({ ...form, musteri: e.target.value })}
        />
        <TextInput
          label="Lokasyon"
          placeholder="Şehir"
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

      <SimpleGrid cols={2} spacing="md">
        <TextInput
          label="Yetkili"
          placeholder="Yetkili kişi"
          value={form.yetkili || ''}
          onChange={(e) => setForm({ ...form, yetkili: e.target.value })}
        />
        <TextInput
          label="Telefon"
          placeholder="0532 xxx xx xx"
          value={form.telefon || ''}
          onChange={(e) => setForm({ ...form, telefon: e.target.value })}
        />
      </SimpleGrid>

      <SimpleGrid cols={3} spacing="md">
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
        <TextInput
          label="Bütçe (TL)"
          type="number"
          placeholder="0"
          value={form.butce || ''}
          onChange={(e) => setForm({ ...form, butce: parseFloat(e.target.value) || 0 })}
        />
        <ColorInput
          label="Renk"
          value={form.renk || '#6366f1'}
          onChange={(v) => setForm({ ...form, renk: v })}
        />
      </SimpleGrid>

      <Group justify="flex-end" mt="md">
        <Button variant="subtle" onClick={() => setView('list')}>İptal</Button>
        <Button loading={saving} onClick={handleSave}>
          {selectedProje ? 'Güncelle' : 'Oluştur'}
        </Button>
      </Group>
    </Stack>
  );

  const renderDetailView = () => {
    if (!selectedProje) return null;

    const ayAdi = tamOzet 
      ? ['', 'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 
         'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'][tamOzet._meta.ay]
      : '';

    return (
      <Stack gap="md">
        <Group gap="xs">
          <ActionIcon variant="subtle" onClick={() => setView('list')}>
            <IconArrowLeft size={16} />
          </ActionIcon>
          <div 
            style={{ 
              width: 12, 
              height: 12, 
              borderRadius: '50%', 
              backgroundColor: selectedProje.renk 
            }} 
          />
          <Text fw={600} size="lg">{selectedProje.ad}</Text>
          <Badge color={durumRenkleri[selectedProje.durum]}>{selectedProje.durum}</Badge>
        </Group>

        {!tamOzet ? (
          <Group justify="center" py="xl">
            <Loader size="sm" />
            <Text c="dimmed">Yükleniyor...</Text>
          </Group>
        ) : (
          <ScrollArea h={450}>
            <Stack gap="md">
              {/* Genel Bilgiler */}
              <Paper p="sm" radius="sm" withBorder>
                <Text size="sm" fw={500} mb="xs">📋 Genel Bilgiler</Text>
                <SimpleGrid cols={2} spacing="xs">
                  <Text size="xs"><b>Kod:</b> {tamOzet.proje.kod || '-'}</Text>
                  <Text size="xs"><b>Lokasyon:</b> {tamOzet.proje.lokasyon || '-'}</Text>
                  <Text size="xs"><b>Yetkili:</b> {tamOzet.proje.yetkili || '-'}</Text>
                  <Text size="xs"><b>Telefon:</b> {tamOzet.proje.telefon || '-'}</Text>
                </SimpleGrid>
                {tamOzet.proje.adres && (
                  <Text size="xs" mt="xs"><b>Adres:</b> {tamOzet.proje.adres}</Text>
                )}
              </Paper>

              {/* Personel & Bordro */}
              <SimpleGrid cols={2} spacing="md">
                <Paper p="sm" radius="sm" withBorder>
                  <Group gap="xs" mb="xs">
                    <IconUsers size={16} color="var(--mantine-color-blue-6)" />
                    <Text size="sm" fw={500}>Personel</Text>
                  </Group>
                  <Stack gap={4}>
                    <Group justify="space-between">
                      <Text size="xs" c="dimmed">Aktif:</Text>
                      <Text size="sm" fw={600}>{tamOzet.personel.aktif_sayisi} kişi</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="xs" c="dimmed">Net Maaş:</Text>
                      <Text size="sm" fw={600}>{formatCurrency(tamOzet.personel.toplam_net_maas)}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="xs" c="dimmed">Bordro Maaş:</Text>
                      <Text size="sm" fw={600}>{formatCurrency(tamOzet.personel.toplam_bordro_maas)}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="xs" c="dimmed">Elden Fark:</Text>
                      <Text size="sm" fw={600} c="orange">{formatCurrency(tamOzet.personel.toplam_elden_fark)}</Text>
                    </Group>
                  </Stack>
                </Paper>

                <Paper p="sm" radius="sm" withBorder>
                  <Group gap="xs" mb="xs">
                    <IconCash size={16} color="var(--mantine-color-green-6)" />
                    <Text size="sm" fw={500}>Bordro ({ayAdi})</Text>
                  </Group>
                  <Stack gap={4}>
                    <Group justify="space-between">
                      <Text size="xs" c="dimmed">Tahakkuk:</Text>
                      <Text size="sm" fw={600}>{formatCurrency(tamOzet.bordro.bu_ay_tahakkuk)}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="xs" c="dimmed">SGK+Vergi:</Text>
                      <Text size="sm" fw={600}>{formatCurrency(tamOzet.bordro.sgk_vergi_toplam)}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="xs" c="dimmed">SGK Ödendi:</Text>
                      <Badge size="xs" color={tamOzet.bordro.sgk_odendi ? 'green' : 'red'}>
                        {tamOzet.bordro.sgk_odendi ? 'Evet' : 'Hayır'}
                      </Badge>
                    </Group>
                    <Group justify="space-between">
                      <Text size="xs" c="dimmed">Vergi Ödendi:</Text>
                      <Badge size="xs" color={tamOzet.bordro.vergi_odendi ? 'green' : 'red'}>
                        {tamOzet.bordro.vergi_odendi ? 'Evet' : 'Hayır'}
                      </Badge>
                    </Group>
                  </Stack>
                </Paper>
              </SimpleGrid>

              {/* Satın Alma & Finans */}
              <SimpleGrid cols={2} spacing="md">
                <Paper p="sm" radius="sm" withBorder>
                  <Group gap="xs" mb="xs">
                    <IconShoppingCart size={16} color="var(--mantine-color-orange-6)" />
                    <Text size="sm" fw={500}>Satın Alma</Text>
                  </Group>
                  <Stack gap={4}>
                    <Group justify="space-between">
                      <Text size="xs" c="dimmed">Toplam Sipariş:</Text>
                      <Text size="sm" fw={600}>{tamOzet.satin_alma.toplam_siparis}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="xs" c="dimmed">Bekleyen:</Text>
                      <Badge size="xs" color="orange">{tamOzet.satin_alma.bekleyen}</Badge>
                    </Group>
                    <Group justify="space-between">
                      <Text size="xs" c="dimmed">Tamamlanan:</Text>
                      <Badge size="xs" color="green">{tamOzet.satin_alma.tamamlanan}</Badge>
                    </Group>
                    <Group justify="space-between">
                      <Text size="xs" c="dimmed">Harcama:</Text>
                      <Text size="sm" fw={600}>{formatCurrency(tamOzet.satin_alma.toplam_harcama)}</Text>
                    </Group>
                  </Stack>
                </Paper>

                <Paper p="sm" radius="sm" withBorder>
                  <Group gap="xs" mb="xs">
                    <IconChartBar size={16} color="var(--mantine-color-grape-6)" />
                    <Text size="sm" fw={500}>Finans ({ayAdi})</Text>
                  </Group>
                  <Stack gap={4}>
                    <Group justify="space-between">
                      <Text size="xs" c="dimmed">Gelir:</Text>
                      <Text size="sm" fw={600} c="green">{formatCurrency(tamOzet.finans.bu_ay.gelir)}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="xs" c="dimmed">Gider:</Text>
                      <Text size="sm" fw={600} c="red">{formatCurrency(tamOzet.finans.bu_ay.gider)}</Text>
                    </Group>
                    <Divider />
                    <Group justify="space-between">
                      <Text size="xs" c="dimmed">Bu Ay Net:</Text>
                      <Text size="sm" fw={700} c={tamOzet.finans.bu_ay.net >= 0 ? 'green' : 'red'}>
                        {formatCurrency(tamOzet.finans.bu_ay.net)}
                      </Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="xs" c="dimmed">Toplam Net:</Text>
                      <Text size="sm" fw={700} c={tamOzet.finans.toplam.net >= 0 ? 'green' : 'red'}>
                        {formatCurrency(tamOzet.finans.toplam.net)}
                      </Text>
                    </Group>
                  </Stack>
                </Paper>
              </SimpleGrid>

              {/* Gelecek Modüller */}
              <Paper p="sm" radius="sm" bg="gray.0">
                <Text size="xs" c="dimmed" mb="xs">🔮 Gelecek Entegrasyonlar</Text>
                <SimpleGrid cols={3} spacing="xs">
                  <Alert variant="light" color="gray" p="xs">
                    <Text size="xs">📄 Faturalar</Text>
                    <Text size="xs" c="dimmed">{tamOzet.faturalar.not}</Text>
                  </Alert>
                  <Alert variant="light" color="gray" p="xs">
                    <Text size="xs">🏢 Demirbaş</Text>
                    <Text size="xs" c="dimmed">{tamOzet.demirbas.not}</Text>
                  </Alert>
                  <Alert variant="light" color="gray" p="xs">
                    <Text size="xs">📝 Çek/Senet</Text>
                    <Text size="xs" c="dimmed">{tamOzet.cek_senet.not}</Text>
                  </Alert>
                </SimpleGrid>
              </Paper>
            </Stack>
          </ScrollArea>
        )}
      </Stack>
    );
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="sm">
          <ThemeIcon size="lg" radius="md" variant="gradient" gradient={{ from: 'indigo', to: 'violet' }}>
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

