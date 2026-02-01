'use client';

import {
  ActionIcon,
  Badge,
  Button,
  Divider,
  Group,
  Loader,
  Modal,
  NumberInput,
  Paper,
  Select,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import {
  IconAlertTriangle,
  IconCheck,
  IconEdit,
  IconEye,
  IconPlus,
  IconRefresh,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { API_BASE_URL } from '@/lib/config';

interface Sozlesme {
  cari_id: number;
  tedarikci_adi: string;
  urun_sayisi: number;
  en_yakin_bitis: string | null;
  aktif_sayisi: number;
  son_guncelleme: string;
}

interface SozlesmeDetay {
  tedarikci: {
    id: number;
    unvan: string;
    vergi_no: string;
  };
  fiyatlar: Array<{
    id: number;
    urun_kart_id: number;
    urun_kod: string;
    urun_ad: string;
    fiyat: number;
    birim: string;
    aktif: boolean;
    gecerlilik_bitis: string;
    gecerlilik_baslangic?: string;
    kategori_ad: string;
    sozlesme_no?: string;
    min_siparis_miktar?: number;
    teslim_suresi_gun?: number;
    kdv_dahil?: boolean;
  }>;
}

interface Tedarikci {
  id: number;
  unvan: string;
  vergi_no?: string;
}

interface UrunKarti {
  id: number;
  kod: string;
  ad: string;
  varsayilan_birim: string;
  kategori_ad?: string;
}

interface SozlesmeForm {
  urun_kart_id: string;
  cari_id: string;
  fiyat: number | '';
  birim: string;
  kdv_dahil: boolean;
  min_siparis_miktar: number | '';
  teslim_suresi_gun: number | '';
  gecerlilik_baslangic: Date | null;
  gecerlilik_bitis: Date | null;
  sozlesme_no: string;
}

const BIRIMLER = [
  { value: 'kg', label: 'Kilogram (kg)' },
  { value: 'gr', label: 'Gram (gr)' },
  { value: 'lt', label: 'Litre (lt)' },
  { value: 'adet', label: 'Adet' },
  { value: 'paket', label: 'Paket' },
  { value: 'kutu', label: 'Kutu' },
];

const initialForm: SozlesmeForm = {
  urun_kart_id: '',
  cari_id: '',
  fiyat: '',
  birim: 'kg',
  kdv_dahil: false,
  min_siparis_miktar: '',
  teslim_suresi_gun: '',
  gecerlilik_baslangic: null,
  gecerlilik_bitis: null,
  sozlesme_no: '',
};

export function TedarikciSozlesme() {
  const { isAuthenticated } = useAuth();
  const [sozlesmeler, setSozlesmeler] = useState<Sozlesme[]>([]);
  const [loading, setLoading] = useState(true);
  const [detayModal, setDetayModal] = useState<number | null>(null);
  const [detayData, setDetayData] = useState<SozlesmeDetay | null>(null);
  const [detayLoading, setDetayLoading] = useState(false);

  // Yeni sözleşme modal
  const [yeniModal, setYeniModal] = useState(false);
  const [tedarikciListesi, setTedarikciListesi] = useState<Tedarikci[]>([]);
  const [urunListesi, setUrunListesi] = useState<UrunKarti[]>([]);
  const [form, setForm] = useState<SozlesmeForm>(initialForm);
  const [kaydetLoading, setKaydetLoading] = useState(false);
  const [listelerLoading, setListelerLoading] = useState(false);

  // Düzenleme modal
  const [duzenleModal, setDuzenleModal] = useState<number | null>(null);
  const [duzenleForm, setDuzenleForm] = useState<SozlesmeForm>(initialForm);
  const [silmeOnay, setSilmeOnay] = useState<number | null>(null);

  const fetchSozlesmeler = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/fiyat-yonetimi/sozlesmeler`);
      const data = await res.json();
      if (data.success) {
        setSozlesmeler(data.data);
      }
    } catch (error) {
      console.error('Sözleşme listesi hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDetay = async (cariId: number) => {
    setDetayLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/fiyat-yonetimi/sozlesmeler/${cariId}`);
      const data = await res.json();
      if (data.success) {
        setDetayData(data.data);
      }
    } catch (error) {
      console.error('Sözleşme detay hatası:', error);
    } finally {
      setDetayLoading(false);
    }
  };

  const fetchTedarikciVeUrunler = async () => {
    setListelerLoading(true);
    try {
      const [tedarikciRes, urunRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/cariler?tip=tedarikci&aktif=true&limit=500`),
        fetch(`${API_BASE_URL}/api/menu-planlama/urun-kartlari?aktif=true`),
      ]);

      const tedarikciData = await tedarikciRes.json();
      const urunData = await urunRes.json();

      if (tedarikciData.success) {
        setTedarikciListesi(tedarikciData.data || []);
      }
      if (urunData.success) {
        setUrunListesi(urunData.data || []);
      }
    } catch (error) {
      console.error('Listeler yükleme hatası:', error);
    } finally {
      setListelerLoading(false);
    }
  };

  useEffect(() => {
    fetchSozlesmeler();
  }, []);

  useEffect(() => {
    if (detayModal) {
      fetchDetay(detayModal);
    } else {
      setDetayData(null);
    }
  }, [detayModal]);

  useEffect(() => {
    if (yeniModal && tedarikciListesi.length === 0) {
      fetchTedarikciVeUrunler();
    }
  }, [yeniModal]);

  const handleYeniSozlesmeAc = () => {
    setForm(initialForm);
    setYeniModal(true);
  };

  const handleSozlesmeKaydet = async () => {
    if (!isAuthenticated) {
      notifications.show({ title: 'Hata', message: 'Giriş yapmalısınız', color: 'red' });
      return;
    }

    if (!form.urun_kart_id || !form.cari_id || !form.fiyat) {
      notifications.show({ title: 'Hata', message: 'Tedarikçi, ürün ve fiyat zorunludur', color: 'red' });
      return;
    }

    setKaydetLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/fiyat-yonetimi/sozlesmeler/fiyat`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urun_kart_id: parseInt(form.urun_kart_id, 10),
          cari_id: parseInt(form.cari_id, 10),
          fiyat: form.fiyat,
          birim: form.birim,
          kdv_dahil: form.kdv_dahil,
          min_siparis_miktar: form.min_siparis_miktar || null,
          teslim_suresi_gun: form.teslim_suresi_gun || null,
          gecerlilik_baslangic: form.gecerlilik_baslangic?.toISOString().split('T')[0] || null,
          gecerlilik_bitis: form.gecerlilik_bitis?.toISOString().split('T')[0] || null,
          sozlesme_no: form.sozlesme_no || null,
        }),
      });

      const data = await res.json();

      if (data.success) {
        notifications.show({ title: 'Başarılı', message: 'Sözleşme fiyatı kaydedildi', color: 'green' });
        setYeniModal(false);
        setForm(initialForm);
        fetchSozlesmeler();
        if (detayModal) {
          fetchDetay(detayModal);
        }
      } else {
        throw new Error(data.error);
      }
    } catch (error: unknown) {
      notifications.show({
        title: 'Hata',
        message: error instanceof Error ? error.message : 'Kaydetme başarısız',
        color: 'red',
      });
    } finally {
      setKaydetLoading(false);
    }
  };

  const handleDuzenleAc = (fiyat: SozlesmeDetay['fiyatlar'][0]) => {
    setDuzenleForm({
      urun_kart_id: fiyat.urun_kart_id.toString(),
      cari_id: detayData?.tedarikci.id.toString() || '',
      fiyat: fiyat.fiyat,
      birim: fiyat.birim || 'kg',
      kdv_dahil: fiyat.kdv_dahil || false,
      min_siparis_miktar: fiyat.min_siparis_miktar || '',
      teslim_suresi_gun: fiyat.teslim_suresi_gun || '',
      gecerlilik_baslangic: fiyat.gecerlilik_baslangic ? new Date(fiyat.gecerlilik_baslangic) : null,
      gecerlilik_bitis: fiyat.gecerlilik_bitis ? new Date(fiyat.gecerlilik_bitis) : null,
      sozlesme_no: fiyat.sozlesme_no || '',
    });
    setDuzenleModal(fiyat.id);
  };

  const handleDuzenleKaydet = async () => {
    if (!isAuthenticated) return;

    setKaydetLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/fiyat-yonetimi/sozlesmeler/fiyat`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urun_kart_id: parseInt(duzenleForm.urun_kart_id, 10),
          cari_id: parseInt(duzenleForm.cari_id, 10),
          fiyat: duzenleForm.fiyat,
          birim: duzenleForm.birim,
          kdv_dahil: duzenleForm.kdv_dahil,
          min_siparis_miktar: duzenleForm.min_siparis_miktar || null,
          teslim_suresi_gun: duzenleForm.teslim_suresi_gun || null,
          gecerlilik_baslangic: duzenleForm.gecerlilik_baslangic?.toISOString().split('T')[0] || null,
          gecerlilik_bitis: duzenleForm.gecerlilik_bitis?.toISOString().split('T')[0] || null,
          sozlesme_no: duzenleForm.sozlesme_no || null,
        }),
      });

      const data = await res.json();

      if (data.success) {
        notifications.show({ title: 'Başarılı', message: 'Sözleşme güncellendi', color: 'green' });
        setDuzenleModal(null);
        if (detayModal) {
          fetchDetay(detayModal);
        }
        fetchSozlesmeler();
      } else {
        throw new Error(data.error);
      }
    } catch (error: unknown) {
      notifications.show({
        title: 'Hata',
        message: error instanceof Error ? error.message : 'Güncelleme başarısız',
        color: 'red',
      });
    } finally {
      setKaydetLoading(false);
    }
  };

  const handleSil = async (id: number) => {
    if (!isAuthenticated) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/fiyat-yonetimi/sozlesmeler/fiyat/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const data = await res.json();

      if (data.success) {
        notifications.show({ title: 'Başarılı', message: 'Sözleşme fiyatı silindi', color: 'green' });
        setSilmeOnay(null);
        if (detayModal) {
          fetchDetay(detayModal);
        }
        fetchSozlesmeler();
      } else {
        throw new Error(data.error);
      }
    } catch (error: unknown) {
      notifications.show({
        title: 'Hata',
        message: error instanceof Error ? error.message : 'Silme başarısız',
        color: 'red',
      });
    }
  };

  const getDurumBadge = (enYakinBitis: string | null) => {
    if (!enYakinBitis) {
      return <Badge color="gray">Belirsiz</Badge>;
    }

    const bitis = new Date(enYakinBitis);
    const bugun = new Date();
    const gunFarki = Math.ceil((bitis.getTime() - bugun.getTime()) / (1000 * 60 * 60 * 24));

    if (gunFarki < 0) {
      return (
        <Badge color="red" leftSection={<IconX size={10} />}>
          Süresi Dolmuş
        </Badge>
      );
    }
    if (gunFarki <= 15) {
      return (
        <Badge color="yellow" leftSection={<IconAlertTriangle size={10} />}>
          {gunFarki} gün kaldı
        </Badge>
      );
    }
    return (
      <Badge color="green" leftSection={<IconCheck size={10} />}>
        Aktif
      </Badge>
    );
  };

  const formatTarih = (tarih: string | null) => {
    if (!tarih) return '-';
    return new Date(tarih).toLocaleDateString('tr-TR');
  };

  // Seçilen ürünün birimini otomatik ayarla
  const handleUrunSecimi = (urunId: string | null) => {
    setForm((prev) => ({ ...prev, urun_kart_id: urunId || '' }));
    if (urunId) {
      const seciliUrun = urunListesi.find((u) => u.id.toString() === urunId);
      if (seciliUrun?.varsayilan_birim) {
        setForm((prev) => ({ ...prev, birim: seciliUrun.varsayilan_birim }));
      }
    }
  };

  return (
    <Stack gap="md">
      {/* Başlık */}
      <Group justify="space-between">
        <Text fw={500}>Tedarikçi Sözleşmeleri</Text>
        <Group gap="xs">
          <ActionIcon variant="subtle" onClick={fetchSozlesmeler}>
            <IconRefresh size={18} />
          </ActionIcon>
          <Button variant="light" leftSection={<IconPlus size={16} />} onClick={handleYeniSozlesmeAc}>
            Yeni Sözleşme
          </Button>
        </Group>
      </Group>

      {/* Sözleşme Listesi */}
      <Paper withBorder>
        {loading ? (
          <Group p="xl" justify="center">
            <Loader size="sm" />
          </Group>
        ) : sozlesmeler.length > 0 ? (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Tedarikçi</Table.Th>
                <Table.Th style={{ textAlign: 'center' }}>Ürün Sayısı</Table.Th>
                <Table.Th>En Yakın Bitiş</Table.Th>
                <Table.Th>Durum</Table.Th>
                <Table.Th></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {sozlesmeler.map((s) => (
                <Table.Tr key={s.cari_id}>
                  <Table.Td>
                    <Text fw={500}>{s.tedarikci_adi}</Text>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'center' }}>
                    <Badge variant="light">{s.urun_sayisi} ürün</Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{formatTarih(s.en_yakin_bitis)}</Text>
                  </Table.Td>
                  <Table.Td>{getDurumBadge(s.en_yakin_bitis)}</Table.Td>
                  <Table.Td>
                    <Tooltip label="Detay ve Düzenle">
                      <ActionIcon variant="subtle" onClick={() => setDetayModal(s.cari_id)}>
                        <IconEye size={18} />
                      </ActionIcon>
                    </Tooltip>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        ) : (
          <Paper p="xl" ta="center">
            <Text c="dimmed">Henüz tedarikçi sözleşmesi yok</Text>
            <Button variant="light" mt="md" leftSection={<IconPlus size={16} />} onClick={handleYeniSozlesmeAc}>
              İlk Sözleşmeyi Ekle
            </Button>
          </Paper>
        )}
      </Paper>

      {/* Yeni Sözleşme Modal */}
      <Modal opened={yeniModal} onClose={() => setYeniModal(false)} title="Yeni Sözleşme Fiyatı" size="lg">
        {listelerLoading ? (
          <Group p="xl" justify="center">
            <Loader />
            <Text c="dimmed">Listeler yükleniyor...</Text>
          </Group>
        ) : (
          <Stack gap="md">
            <Select
              label="Tedarikçi"
              placeholder="Tedarikçi seçin"
              data={tedarikciListesi.map((t) => ({
                value: t.id.toString(),
                label: `${t.unvan}${t.vergi_no ? ` (${t.vergi_no})` : ''}`,
              }))}
              value={form.cari_id}
              onChange={(v) => setForm((prev) => ({ ...prev, cari_id: v || '' }))}
              searchable
              required
            />

            <Select
              label="Ürün"
              placeholder="Ürün seçin"
              data={urunListesi.map((u) => ({
                value: u.id.toString(),
                label: `${u.ad} (${u.kod})${u.kategori_ad ? ` - ${u.kategori_ad}` : ''}`,
              }))}
              value={form.urun_kart_id}
              onChange={handleUrunSecimi}
              searchable
              required
            />

            <Group grow>
              <NumberInput
                label="Fiyat (TL)"
                placeholder="0.00"
                value={form.fiyat}
                onChange={(v) => setForm((prev) => ({ ...prev, fiyat: v as number }))}
                min={0}
                decimalScale={2}
                required
              />
              <Select
                label="Birim"
                data={BIRIMLER}
                value={form.birim}
                onChange={(v) => setForm((prev) => ({ ...prev, birim: v || 'kg' }))}
              />
            </Group>

            <Switch
              label="KDV Dahil"
              checked={form.kdv_dahil}
              onChange={(e) => setForm((prev) => ({ ...prev, kdv_dahil: e.currentTarget.checked }))}
            />

            <Group grow>
              <DatePickerInput
                label="Geçerlilik Başlangıç"
                placeholder="Tarih seçin"
                value={form.gecerlilik_baslangic}
                onChange={(v) => setForm((prev) => ({ ...prev, gecerlilik_baslangic: v }))}
                clearable
              />
              <DatePickerInput
                label="Geçerlilik Bitiş"
                placeholder="Tarih seçin"
                value={form.gecerlilik_bitis}
                onChange={(v) => setForm((prev) => ({ ...prev, gecerlilik_bitis: v }))}
                clearable
              />
            </Group>

            <Group grow>
              <NumberInput
                label="Min. Sipariş Miktarı"
                placeholder="Opsiyonel"
                value={form.min_siparis_miktar}
                onChange={(v) => setForm((prev) => ({ ...prev, min_siparis_miktar: v as number }))}
                min={0}
              />
              <NumberInput
                label="Teslim Süresi (gün)"
                placeholder="Opsiyonel"
                value={form.teslim_suresi_gun}
                onChange={(v) => setForm((prev) => ({ ...prev, teslim_suresi_gun: v as number }))}
                min={0}
              />
            </Group>

            <TextInput
              label="Sözleşme No"
              placeholder="Opsiyonel"
              value={form.sozlesme_no}
              onChange={(e) => setForm((prev) => ({ ...prev, sozlesme_no: e.target.value }))}
            />

            <Divider />

            <Group justify="flex-end">
              <Button variant="light" onClick={() => setYeniModal(false)}>
                İptal
              </Button>
              <Button
                onClick={handleSozlesmeKaydet}
                loading={kaydetLoading}
                disabled={!form.cari_id || !form.urun_kart_id || !form.fiyat}
              >
                Kaydet
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      {/* Detay Modal */}
      <Modal
        opened={!!detayModal}
        onClose={() => setDetayModal(null)}
        title={
          <Group>
            <Text fw={600}>{detayData?.tedarikci.unvan}</Text>
            {detayData?.tedarikci.vergi_no && (
              <Badge variant="light" size="sm">
                VKN: {detayData.tedarikci.vergi_no}
              </Badge>
            )}
          </Group>
        }
        size="xl"
      >
        {detayLoading ? (
          <Group p="xl" justify="center">
            <Loader />
          </Group>
        ) : detayData ? (
          <Stack gap="md">
            <Group justify="flex-end">
              <Button
                variant="light"
                size="xs"
                leftSection={<IconPlus size={14} />}
                onClick={() => {
                  setForm({ ...initialForm, cari_id: detayData.tedarikci.id.toString() });
                  fetchTedarikciVeUrunler();
                  setYeniModal(true);
                }}
              >
                Ürün Ekle
              </Button>
            </Group>

            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Ürün</Table.Th>
                  <Table.Th>Kategori</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>Fiyat</Table.Th>
                  <Table.Th>Geçerlilik</Table.Th>
                  <Table.Th>Durum</Table.Th>
                  <Table.Th style={{ width: 80 }}></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {detayData.fiyatlar.map((f) => (
                  <Table.Tr key={f.id}>
                    <Table.Td>
                      <div>
                        <Text size="sm" fw={500}>
                          {f.urun_ad}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {f.urun_kod}
                        </Text>
                      </div>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed">
                        {f.kategori_ad}
                      </Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      <Text fw={500}>
                        {f.fiyat.toLocaleString('tr-TR')} /{f.birim || 'kg'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{formatTarih(f.gecerlilik_bitis)}</Text>
                    </Table.Td>
                    <Table.Td>
                      {f.aktif ? (
                        <Badge color="green" size="sm">
                          Aktif
                        </Badge>
                      ) : (
                        <Badge color="gray" size="sm">
                          Pasif
                        </Badge>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4}>
                        <Tooltip label="Düzenle">
                          <ActionIcon variant="subtle" size="sm" onClick={() => handleDuzenleAc(f)}>
                            <IconEdit size={14} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Sil">
                          <ActionIcon variant="subtle" size="sm" color="red" onClick={() => setSilmeOnay(f.id)}>
                            <IconTrash size={14} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Stack>
        ) : null}
      </Modal>

      {/* Düzenleme Modal */}
      <Modal
        opened={!!duzenleModal}
        onClose={() => setDuzenleModal(null)}
        title="Sözleşme Fiyatı Düzenle"
        size="md"
      >
        <Stack gap="md">
          <Group grow>
            <NumberInput
              label="Fiyat (TL)"
              value={duzenleForm.fiyat}
              onChange={(v) => setDuzenleForm((prev) => ({ ...prev, fiyat: v as number }))}
              min={0}
              decimalScale={2}
              required
            />
            <Select
              label="Birim"
              data={BIRIMLER}
              value={duzenleForm.birim}
              onChange={(v) => setDuzenleForm((prev) => ({ ...prev, birim: v || 'kg' }))}
            />
          </Group>

          <Switch
            label="KDV Dahil"
            checked={duzenleForm.kdv_dahil}
            onChange={(e) => setDuzenleForm((prev) => ({ ...prev, kdv_dahil: e.currentTarget.checked }))}
          />

          <Group grow>
            <DatePickerInput
              label="Geçerlilik Başlangıç"
              value={duzenleForm.gecerlilik_baslangic}
              onChange={(v) => setDuzenleForm((prev) => ({ ...prev, gecerlilik_baslangic: v }))}
              clearable
            />
            <DatePickerInput
              label="Geçerlilik Bitiş"
              value={duzenleForm.gecerlilik_bitis}
              onChange={(v) => setDuzenleForm((prev) => ({ ...prev, gecerlilik_bitis: v }))}
              clearable
            />
          </Group>

          <Group grow>
            <NumberInput
              label="Min. Sipariş"
              value={duzenleForm.min_siparis_miktar}
              onChange={(v) => setDuzenleForm((prev) => ({ ...prev, min_siparis_miktar: v as number }))}
              min={0}
            />
            <NumberInput
              label="Teslim (gün)"
              value={duzenleForm.teslim_suresi_gun}
              onChange={(v) => setDuzenleForm((prev) => ({ ...prev, teslim_suresi_gun: v as number }))}
              min={0}
            />
          </Group>

          <TextInput
            label="Sözleşme No"
            value={duzenleForm.sozlesme_no}
            onChange={(e) => setDuzenleForm((prev) => ({ ...prev, sozlesme_no: e.target.value }))}
          />

          <Divider />

          <Group justify="flex-end">
            <Button variant="light" onClick={() => setDuzenleModal(null)}>
              İptal
            </Button>
            <Button onClick={handleDuzenleKaydet} loading={kaydetLoading}>
              Güncelle
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Silme Onay Modal */}
      <Modal opened={!!silmeOnay} onClose={() => setSilmeOnay(null)} title="Silme Onayı" size="sm">
        <Stack gap="md">
          <Text>Bu sözleşme fiyatını silmek istediğinize emin misiniz?</Text>
          <Group justify="flex-end">
            <Button variant="light" onClick={() => setSilmeOnay(null)}>
              İptal
            </Button>
            <Button color="red" onClick={() => silmeOnay && handleSil(silmeOnay)}>
              Sil
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
