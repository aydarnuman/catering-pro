'use client';

import {
  ActionIcon,
  Badge,
  Button,
  Checkbox,
  Group,
  Loader,
  Paper,
  SegmentedControl,
  Select,
  Stack,
  Table,
  Text,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconAlertTriangle,
  IconCheck,
  IconClock,
  IconEye,
  IconFilter,
  IconRefresh,
  IconX,
} from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { API_BASE_URL } from '@/lib/config';

interface Uyari {
  id: number;
  urun_kart_id: number;
  urun_kod: string;
  urun_ad: string;
  uyari_tipi: string;
  uyari_mesaji: string;
  onceki_fiyat: number | null;
  yeni_fiyat: number | null;
  degisim_orani: number | null;
  onem_derecesi: string;
  okundu: boolean;
  cozuldu: boolean;
  created_at: string;
}

interface UyariMerkeziProps {
  onUrunSec: (urunId: number) => void;
}

const UYARI_TIPLERI = [
  { value: '', label: 'Tüm Tipler' },
  { value: 'ANOMALI', label: 'Anomali' },
  { value: 'ESKIMIS', label: 'Eskimiş' },
];

const ONEM_DERECELERI = [
  { value: '', label: 'Tüm Önemler' },
  { value: 'kritik', label: 'Kritik' },
  { value: 'yuksek', label: 'Yüksek' },
  { value: 'orta', label: 'Orta' },
  { value: 'dusuk', label: 'Düşük' },
];

export function UyariMerkezi({ onUrunSec }: UyariMerkeziProps) {
  const { isAuthenticated } = useAuth();
  const [uyarilar, setUyarilar] = useState<Uyari[]>([]);
  const [loading, setLoading] = useState(true);
  const [tip, setTip] = useState<string>('');
  const [onemDerecesi, setOnemDerecesi] = useState<string>('');
  const [durumFiltre, setDurumFiltre] = useState<string>('cozulmemis');
  const [seciliIds, setSeciliIds] = useState<Set<number>>(new Set());
  const [islemYapiliyor, setIslemYapiliyor] = useState(false);

  const fetchUyarilar = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (durumFiltre === 'cozulmemis') params.append('cozulmemis', 'true');
      if (tip) params.append('tip', tip);

      const res = await fetch(`${API_BASE_URL}/api/fiyat-yonetimi/uyarilar?${params}`);
      const data = await res.json();
      if (data.success) {
        let filtrelenmis = data.data;
        // Client-side önem derecesi filtreleme
        if (onemDerecesi) {
          filtrelenmis = filtrelenmis.filter((u: Uyari) => u.onem_derecesi === onemDerecesi);
        }
        setUyarilar(filtrelenmis);
        setSeciliIds(new Set());
      }
    } catch (error) {
      console.error('Uyarı listesi hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUyarilar();
  }, [tip, onemDerecesi, durumFiltre]);

  const handleOkunduIsaretle = async (id: number) => {
    if (!isAuthenticated) return;
    try {
      await fetch(`${API_BASE_URL}/api/fiyat-yonetimi/uyarilar/${id}/okundu`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      fetchUyarilar();
    } catch (error) {
      console.error('Okundu işaretleme hatası:', error);
    }
  };

  const handleCozulduIsaretle = async (id: number) => {
    if (!isAuthenticated) return;
    try {
      await fetch(`${API_BASE_URL}/api/fiyat-yonetimi/uyarilar/${id}/cozuldu`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      notifications.show({
        title: 'Başarılı',
        message: 'Uyarı çözüldü işaretlendi',
        color: 'green',
      });
      fetchUyarilar();
    } catch (error) {
      console.error('Çözüldü işaretleme hatası:', error);
    }
  };

  const handleTopluOkundu = async () => {
    if (!isAuthenticated || seciliIds.size === 0) return;
    setIslemYapiliyor(true);
    try {
      await fetch(`${API_BASE_URL}/api/fiyat-yonetimi/uyarilar/toplu-okundu`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(seciliIds) }),
      });
      notifications.show({
        title: 'Başarılı',
        message: `${seciliIds.size} uyarı okundu işaretlendi`,
        color: 'green',
      });
      setSeciliIds(new Set());
      fetchUyarilar();
    } catch (error) {
      console.error('Toplu okundu hatası:', error);
    } finally {
      setIslemYapiliyor(false);
    }
  };

  const handleTopluCozuldu = async () => {
    if (!isAuthenticated || seciliIds.size === 0) return;
    setIslemYapiliyor(true);
    try {
      // Her uyarıyı tek tek çözüldü işaretle (API toplu endpoint yoksa)
      for (const id of seciliIds) {
        await fetch(`${API_BASE_URL}/api/fiyat-yonetimi/uyarilar/${id}/cozuldu`, {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });
      }
      notifications.show({
        title: 'Başarılı',
        message: `${seciliIds.size} uyarı çözüldü işaretlendi`,
        color: 'green',
      });
      setSeciliIds(new Set());
      fetchUyarilar();
    } catch (error) {
      console.error('Toplu çözüldü hatası:', error);
      notifications.show({ title: 'Hata', message: 'İşlem başarısız', color: 'red' });
    } finally {
      setIslemYapiliyor(false);
    }
  };

  const handleEskimeKontrolu = async () => {
    if (!isAuthenticated) return;
    setIslemYapiliyor(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/fiyat-yonetimi/raporlar/eskime-kontrolu`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.success) {
        notifications.show({
          title: 'Tamamlandı',
          message: data.message,
          color: 'green',
        });
        fetchUyarilar();
      }
    } catch (error) {
      console.error('Eskime kontrolü hatası:', error);
    } finally {
      setIslemYapiliyor(false);
    }
  };

  const handleSecimiTemizle = () => {
    setSeciliIds(new Set());
  };

  const toggleSecim = (id: number) => {
    setSeciliIds((prev) => {
      const yeni = new Set(prev);
      if (yeni.has(id)) {
        yeni.delete(id);
      } else {
        yeni.add(id);
      }
      return yeni;
    });
  };

  const tumunuSec = () => {
    if (seciliIds.size === uyarilar.length) {
      setSeciliIds(new Set());
    } else {
      setSeciliIds(new Set(uyarilar.map((u) => u.id)));
    }
  };

  const getTipIcon = (tip: string) => {
    switch (tip) {
      case 'ANOMALI':
        return <IconAlertTriangle size={16} color="orange" />;
      case 'ESKIMIS':
        return <IconClock size={16} color="gray" />;
      default:
        return null;
    }
  };

  const getOnemBadge = (onem: string) => {
    const colors: Record<string, string> = {
      kritik: 'red',
      yuksek: 'orange',
      orta: 'yellow',
      dusuk: 'gray',
    };
    const labels: Record<string, string> = {
      kritik: 'Kritik',
      yuksek: 'Yüksek',
      orta: 'Orta',
      dusuk: 'Düşük',
    };
    return (
      <Badge color={colors[onem] || 'gray'} size="xs">
        {labels[onem] || onem}
      </Badge>
    );
  };

  const formatTarih = (tarih: string) => {
    return new Date(tarih).toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const tumSeciliMi = uyarilar.length > 0 && seciliIds.size === uyarilar.length;
  const bazilariSeciliMi = seciliIds.size > 0 && seciliIds.size < uyarilar.length;

  // İstatistikler
  const kritikSayisi = uyarilar.filter((u) => u.onem_derecesi === 'kritik').length;
  const anomaliSayisi = uyarilar.filter((u) => u.uyari_tipi === 'ANOMALI').length;
  const eskimisSayisi = uyarilar.filter((u) => u.uyari_tipi === 'ESKIMIS').length;

  return (
    <Stack gap="md">
      {/* Durum Segmented Control */}
      <SegmentedControl
        value={durumFiltre}
        onChange={setDurumFiltre}
        data={[
          { value: 'cozulmemis', label: 'Çözülmemişler' },
          { value: 'tumuu', label: 'Tümü' },
        ]}
        fullWidth
      />

      {/* Filtreler */}
      <Paper p="sm" withBorder>
        <Group justify="space-between">
          <Group gap="xs">
            <IconFilter size={16} color="gray" />
            <Select
              placeholder="Uyarı Tipi"
              data={UYARI_TIPLERI}
              value={tip}
              onChange={(v) => setTip(v || '')}
              clearable
              size="xs"
              w={130}
            />
            <Select
              placeholder="Önem"
              data={ONEM_DERECELERI}
              value={onemDerecesi}
              onChange={(v) => setOnemDerecesi(v || '')}
              clearable
              size="xs"
              w={130}
            />
            <ActionIcon variant="subtle" onClick={fetchUyarilar} size="sm">
              <IconRefresh size={16} />
            </ActionIcon>
          </Group>
          <Group gap="xs">
            {kritikSayisi > 0 && (
              <Badge color="red" variant="light">
                {kritikSayisi} Kritik
              </Badge>
            )}
            {anomaliSayisi > 0 && (
              <Badge color="orange" variant="light">
                {anomaliSayisi} Anomali
              </Badge>
            )}
            {eskimisSayisi > 0 && (
              <Badge color="gray" variant="light">
                {eskimisSayisi} Eskimiş
              </Badge>
            )}
          </Group>
        </Group>
      </Paper>

      {/* Toplu İşlem Bar */}
      {seciliIds.size > 0 && (
        <Paper p="sm" withBorder bg="blue.0">
          <Group justify="space-between">
            <Group gap="xs">
              <Badge size="lg" variant="filled">
                {seciliIds.size} uyarı seçili
              </Badge>
              <Button variant="subtle" size="xs" leftSection={<IconX size={14} />} onClick={handleSecimiTemizle}>
                Temizle
              </Button>
            </Group>
            <Group gap="xs">
              <Button
                variant="light"
                size="xs"
                onClick={handleTopluOkundu}
                loading={islemYapiliyor}
              >
                Okundu İşaretle
              </Button>
              <Button
                variant="light"
                color="green"
                size="xs"
                leftSection={<IconCheck size={14} />}
                onClick={handleTopluCozuldu}
                loading={islemYapiliyor}
              >
                Toplu Çözüldü
              </Button>
            </Group>
          </Group>
        </Paper>
      )}

      {/* Aksiyonlar */}
      {seciliIds.size === 0 && (
        <Group justify="flex-end">
          <Button
            variant="outline"
            size="xs"
            leftSection={<IconClock size={14} />}
            onClick={handleEskimeKontrolu}
            loading={islemYapiliyor}
          >
            Eskime Kontrolü
          </Button>
        </Group>
      )}

      {/* Uyarı Tablosu */}
      <Paper withBorder>
        {loading ? (
          <Group p="xl" justify="center">
            <Loader size="sm" />
          </Group>
        ) : uyarilar.length > 0 ? (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={40}>
                  <Checkbox
                    checked={tumSeciliMi}
                    indeterminate={bazilariSeciliMi}
                    onChange={tumunuSec}
                  />
                </Table.Th>
                <Table.Th>Tip</Table.Th>
                <Table.Th>Ürün</Table.Th>
                <Table.Th>Mesaj</Table.Th>
                <Table.Th>Önem</Table.Th>
                <Table.Th>Tarih</Table.Th>
                <Table.Th w={80}></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {uyarilar.map((u) => (
                <Table.Tr
                  key={u.id}
                  style={{
                    backgroundColor: u.okundu ? undefined : 'var(--mantine-color-yellow-0)',
                    cursor: 'pointer',
                  }}
                >
                  <Table.Td onClick={(e) => e.stopPropagation()}>
                    <Checkbox checked={seciliIds.has(u.id)} onChange={() => toggleSecim(u.id)} />
                  </Table.Td>
                  <Table.Td onClick={() => onUrunSec(u.urun_kart_id)}>
                    <Group gap={4}>
                      {getTipIcon(u.uyari_tipi)}
                      <Badge variant="light" size="sm">
                        {u.uyari_tipi === 'ANOMALI' ? 'Anomali' : 'Eskimiş'}
                      </Badge>
                    </Group>
                  </Table.Td>
                  <Table.Td onClick={() => onUrunSec(u.urun_kart_id)}>
                    <div>
                      <Text size="sm" fw={500}>
                        {u.urun_ad}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {u.urun_kod}
                      </Text>
                    </div>
                  </Table.Td>
                  <Table.Td onClick={() => onUrunSec(u.urun_kart_id)}>
                    <Text size="sm">{u.uyari_mesaji}</Text>
                    {u.degisim_orani != null && (
                      <Text size="xs" c={Number(u.degisim_orani) > 0 ? 'red' : 'green'} fw={500}>
                        {Number(u.degisim_orani) > 0 ? '+' : ''}
                        {Number(u.degisim_orani).toFixed(1)}%
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td onClick={() => onUrunSec(u.urun_kart_id)}>{getOnemBadge(u.onem_derecesi)}</Table.Td>
                  <Table.Td onClick={() => onUrunSec(u.urun_kart_id)}>
                    <Text size="xs" c="dimmed">
                      {formatTarih(u.created_at)}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      <Tooltip label="Ürün Detayı">
                        <ActionIcon variant="subtle" onClick={() => onUrunSec(u.urun_kart_id)}>
                          <IconEye size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Çözüldü İşaretle">
                        <ActionIcon variant="subtle" color="green" onClick={() => handleCozulduIsaretle(u.id)}>
                          <IconCheck size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        ) : (
          <Paper p="xl" ta="center">
            <IconCheck size={40} color="green" style={{ opacity: 0.5 }} />
            <Text c="dimmed" mt="sm">
              {durumFiltre === 'cozulmemis' ? 'Çözülmemiş uyarı yok' : 'Uyarı bulunamadı'}
            </Text>
          </Paper>
        )}
      </Paper>

      {/* Bilgi */}
      {uyarilar.length > 0 && (
        <Text size="sm" c="dimmed" ta="center">
          {uyarilar.length} uyarı gösteriliyor
        </Text>
      )}
    </Stack>
  );
}
