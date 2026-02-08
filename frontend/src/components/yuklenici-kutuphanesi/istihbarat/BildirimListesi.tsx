'use client';

/**
 * Bildirim Listesi — Rakip Alarm Sistemi UI
 * ──────────────────────────────────────────
 * Takipteki yüklenicilerdeki değişiklikleri gösteren bildirim paneli.
 * Header'daki bildirim zili butonu ile açılır.
 */

import {
  ActionIcon,
  Badge,
  Button,
  Center,
  Group,
  Indicator,
  Loader,
  Paper,
  Popover,
  ScrollArea,
  Stack,
  Text,
  ThemeIcon,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconBell,
  IconBuildingBank,
  IconCheck,
  IconMapPin,
  IconShieldOff,
  IconTrendingUp,
  IconTrophy,
} from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';
import { getApiUrl } from '@/lib/config';
import type { YukleniciBildirim } from '@/types/yuklenici';

// Bildirim tipine göre ikon ve renk
const TIP_GORSELLER: Record<string, { ikon: React.ReactNode; renk: string }> = {
  yeni_ihale_kazanim: { ikon: <IconTrophy size={14} />, renk: 'green' },
  yeni_sehir: { ikon: <IconMapPin size={14} />, renk: 'blue' },
  kik_sikayet: { ikon: <IconBuildingBank size={14} />, renk: 'orange' },
  yasaklama: { ikon: <IconShieldOff size={14} />, renk: 'red' },
  fesih: { ikon: <IconAlertTriangle size={14} />, renk: 'red' },
  fiyat_degisim: { ikon: <IconTrendingUp size={14} />, renk: 'violet' },
  genel: { ikon: <IconBell size={14} />, renk: 'gray' },
};

export function BildirimListesi() {
  const [bildirimler, setBildirimler] = useState<YukleniciBildirim[]>([]);
  const [okunmamisSayisi, setOkunmamisSayisi] = useState(0);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [acik, setAcik] = useState(false);

  const mFetch = useCallback((url: string, opts?: RequestInit) => {
    return fetch(url, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...opts });
  }, []);

  const fetchBildirimler = useCallback(async () => {
    setYukleniyor(true);
    try {
      const res = await mFetch(getApiUrl('/contractors/bildirimler/liste?limit=30'));
      const json = await res.json();
      if (json.success) {
        setBildirimler(json.data.bildirimler);
        setOkunmamisSayisi(json.data.okunmamis_sayisi);
      }
    } catch (err) {
      console.error('Bildirim çekme hatası:', err);
    } finally {
      setYukleniyor(false);
    }
  }, [mFetch]);

  const okunduIsaretle = async (bildirimId: number) => {
    try {
      await mFetch(getApiUrl(`/contractors/bildirimler/${bildirimId}/oku`), { method: 'PATCH' });
      setBildirimler(prev => prev.map(b => b.id === bildirimId ? { ...b, okundu: true } : b));
      setOkunmamisSayisi(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Okundu işaretleme hatası:', err);
    }
  };

  const tumunuOkunduYap = async () => {
    try {
      await mFetch(getApiUrl('/contractors/bildirimler/tumunu-oku'), { method: 'POST' });
      setBildirimler(prev => prev.map(b => ({ ...b, okundu: true })));
      setOkunmamisSayisi(0);
    } catch (err) {
      console.error('Toplu okundu hatası:', err);
    }
  };

  // Popover açılınca bildirimleri çek
  useEffect(() => {
    if (acik) fetchBildirimler();
  }, [acik, fetchBildirimler]);

  // İlk yüklemede sadece sayıyı çek
  useEffect(() => {
    fetchBildirimler();
    // Her 60 saniyede bir kontrol et
    const interval = setInterval(fetchBildirimler, 60000);
    return () => clearInterval(interval);
  }, [fetchBildirimler]);

  return (
    <Popover
      opened={acik}
      onChange={setAcik}
      position="bottom-end"
      width={380}
      shadow="lg"
      withArrow
    >
      <Popover.Target>
        <Indicator
          inline
          label={okunmamisSayisi > 0 ? String(okunmamisSayisi) : undefined}
          size={16}
          color="red"
          disabled={okunmamisSayisi === 0}
          processing={okunmamisSayisi > 0}
        >
          <ActionIcon
            variant="light"
            color={okunmamisSayisi > 0 ? 'red' : 'gray'}
            size="lg"
            onClick={() => setAcik(!acik)}
          >
            <IconBell size={20} />
          </ActionIcon>
        </Indicator>
      </Popover.Target>

      <Popover.Dropdown p={0}>
        {/* Başlık */}
        <Group justify="space-between" p="sm" style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}>
          <Text size="sm" fw={700}>Yüklenici Bildirimleri</Text>
          {okunmamisSayisi > 0 && (
            <Button size="xs" variant="subtle" onClick={tumunuOkunduYap} leftSection={<IconCheck size={12} />}>
              Tümünü oku
            </Button>
          )}
        </Group>

        {/* Bildirim Listesi */}
        <ScrollArea h={350} scrollbarSize={6}>
          {yukleniyor ? (
            <Center py="xl"><Loader size="sm" /></Center>
          ) : bildirimler.length === 0 ? (
            <Center py="xl">
              <Stack align="center" gap="xs">
                <IconBell size={32} color="gray" />
                <Text size="sm" c="dimmed">Henüz bildirim yok</Text>
              </Stack>
            </Center>
          ) : (
            <Stack gap={0}>
              {bildirimler.map((b) => {
                const gorsel = TIP_GORSELLER[b.tip] || TIP_GORSELLER.genel;
                return (
                  <Paper
                    key={b.id}
                    p="sm"
                    radius={0}
                    bg={b.okundu ? undefined : 'blue.0'}
                    style={{
                      borderBottom: '1px solid var(--mantine-color-gray-2)',
                      cursor: b.okundu ? undefined : 'pointer',
                    }}
                    onClick={() => { if (!b.okundu) okunduIsaretle(b.id); }}
                  >
                    <Group gap="xs" wrap="nowrap">
                      <ThemeIcon size="sm" variant="light" color={gorsel.renk} radius="xl">
                        {gorsel.ikon}
                      </ThemeIcon>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Group gap={4} mb={2}>
                          <Text size="xs" fw={600} lineClamp={1}>{b.baslik}</Text>
                          {!b.okundu && <Badge size="xs" variant="filled" color="blue">Yeni</Badge>}
                        </Group>
                        {b.kisa_ad && <Text size="xs" c="dimmed">{b.kisa_ad || b.unvan}</Text>}
                        {b.icerik && <Text size="xs" c="dimmed" lineClamp={2}>{b.icerik}</Text>}
                        <Text size="xs" c="dimmed" mt={2}>
                          {new Date(b.created_at).toLocaleString('tr-TR')}
                        </Text>
                      </div>
                    </Group>
                  </Paper>
                );
              })}
            </Stack>
          )}
        </ScrollArea>
      </Popover.Dropdown>
    </Popover>
  );
}
