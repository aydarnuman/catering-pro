'use client';

/**
 * ModulDetay — Seçili Modülün Detay Paneli
 * ──────────────────────────────────────────
 * Modül adına göre doğru detay komponentini render eder.
 * Veriyi API'den çeker ve ilgili alt komponente iletir.
 */

import { Alert, Box, Center, Loader, Stack, Text, Title } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';
import { getApiUrl } from '@/lib/config';
import type { IstihbaratModulAdi } from '@/types/yuklenici';
import { getModulMeta } from './modul-meta';

// Modül detay panelleri (lazy import yerine direkt import — daha basit)
import { IhaleGecmisiDetay } from './moduller/IhaleGecmisiDetay';
import { ProfilAnaliziDetay } from './moduller/ProfilAnaliziDetay';
import { KatilimcilarDetay } from './moduller/KatilimcilarDetay';
import { KikKararlariDetay } from './moduller/KikKararlariDetay';
import { KikYasaklilarDetay } from './moduller/KikYasaklilarDetay';
import { SirketBilgileriDetay } from './moduller/SirketBilgileriDetay';
import { HaberlerDetay } from './moduller/HaberlerDetay';
import { AiRaporDetay } from './moduller/AiRaporDetay';

interface ModulDetayProps {
  yukleniciId: number;
  modul: IstihbaratModulAdi;
  durum: string;
}

export function ModulDetay({ yukleniciId, modul, durum }: ModulDetayProps) {
  const [veri, setVeri] = useState<Record<string, unknown> | null>(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  const meta = getModulMeta(modul);

  const fetchVeri = useCallback(async () => {
    setYukleniyor(true);
    setHata(null);
    try {
      const res = await fetch(getApiUrl(`/contractors/${yukleniciId}/modul/${modul}/veri`), {
        credentials: 'include',
      });
      const json = await res.json();
      if (json.success) {
        setVeri(json.data);
      } else {
        setHata(json.error || 'Veri yüklenemedi');
      }
    } catch (err) {
      setHata(err instanceof Error ? err.message : 'Bağlantı hatası');
    } finally {
      setYukleniyor(false);
    }
  }, [yukleniciId, modul]);

  // Modül değiştiğinde veya durum "tamamlandi" olduğunda veriyi çek
  useEffect(() => {
    if (durum === 'tamamlandi' || durum === 'bekliyor') {
      fetchVeri();
    }
  }, [modul, durum, fetchVeri]);

  // Çalışıyor durumu
  if (durum === 'calisiyor') {
    return (
      <Center py="xl">
        <Stack align="center" gap="md">
          <Loader size="lg" color={meta?.renk || 'blue'} />
          <Text c="dimmed" size="sm">{meta?.baslik || modul} verileri toplanıyor...</Text>
          <Text c="dimmed" size="xs">Bu işlem birkaç dakika sürebilir</Text>
        </Stack>
      </Center>
    );
  }

  // Yükleniyor
  if (yukleniyor) {
    return (
      <Center py="xl">
        <Loader size="md" />
      </Center>
    );
  }

  // Hata
  if (hata) {
    return (
      <Alert icon={<IconInfoCircle size={16} />} title="Veri yüklenemedi" color="red" variant="light">
        {hata}
      </Alert>
    );
  }

  // Henüz çalıştırılmamış
  if (!veri && durum === 'bekliyor') {
    return (
      <Center py="xl">
        <Stack align="center" gap="md">
          <Text size="lg" fw={600}>{meta?.baslik}</Text>
          <Text c="dimmed" size="sm" ta="center">
            Bu modül henüz çalıştırılmadı.<br />
            Modül kartındaki başlat butonuna tıklayarak veri toplama işlemini başlatabilirsiniz.
          </Text>
        </Stack>
      </Center>
    );
  }

  // Modüle göre doğru paneli render et
  return (
    <Box>
      <Title order={5} mb="md">{meta?.baslik || modul}</Title>
      {renderModulPaneli(modul, veri)}
    </Box>
  );
}

/** Modül adına göre doğru detay komponentini seçer */
function renderModulPaneli(modul: IstihbaratModulAdi, veri: Record<string, unknown> | null) {
  switch (modul) {
    case 'ihale_gecmisi':
      return <IhaleGecmisiDetay veri={veri} />;
    case 'profil_analizi':
      return <ProfilAnaliziDetay veri={veri} />;
    case 'katilimcilar':
      return <KatilimcilarDetay veri={veri} />;
    case 'kik_kararlari':
      return <KikKararlariDetay veri={veri} />;
    case 'kik_yasaklilar':
      return <KikYasaklilarDetay veri={veri} />;
    case 'sirket_bilgileri':
      return <SirketBilgileriDetay veri={veri} />;
    case 'haberler':
      return <HaberlerDetay veri={veri} />;
    case 'ai_arastirma':
      return <AiRaporDetay veri={veri} />;
    default:
      return <Text c="dimmed">Bu modül için detay paneli henüz hazır değil.</Text>;
  }
}
