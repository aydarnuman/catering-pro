'use client';

/**
 * ModulDetay — Seçili Dock Grubunun Detay Paneli
 * ────────────────────────────────────────────────
 * Dock'taki grup adına göre doğru detay komponentini render eder.
 * Tek modüllü gruplar → eski davranış (tek API call)
 * Çoklu modül grupları → paralel API call, birleşik panel
 */

import { Alert, Box, Center, Loader, Stack, Text, Title } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';
import { getApiUrl } from '@/lib/config';
import type { DockGrupAdi, IstihbaratModulAdi, ModulDurum } from '@/types/yuklenici';
import { getDockGrupMeta } from './modul-meta';
import { AiRaporDetay } from './moduller/AiRaporDetay';
import { HaberlerDetay } from './moduller/HaberlerDetay';
import { HukukiDurumDetay } from './moduller/HukukiDurumDetay';
import { IhalePerformansiDetay } from './moduller/IhalePerformansiDetay';
import { SirketBilgileriDetay } from './moduller/SirketBilgileriDetay';

interface ModulDetayProps {
  yukleniciId: number;
  /** Dock grup adı (5 adet) */
  grup: DockGrupAdi;
  /** Grubun birleşik durumu */
  durum: ModulDurum;
}

/** Veri havuzundan zenginleştirilmiş ek veri (Tavily + çapraz kontrol) */
export interface HavuzVeri {
  web_istihbarat: {
    ihale_sonuclari?: Array<{ url: string; title: string; content: string }>;
    kik_sonuclari?: Array<{ url: string; title: string; content: string }>;
    haber_sonuclari?: Array<{ url: string; title: string; content: string }>;
    sicil_sonuclari?: Array<{ url: string; title: string; content: string }>;
    ai_ozet?: string;
    haber_ozet?: string;
  } | null;
  tam_metinler?: Array<{ url: string; domain: string; metin: string }>;
  capraz_kontrol?: {
    coopetition?: Array<{ firma: string; rakip_ihale_sayisi: number; rakip_sozlesme: number; ortak_sozlesme: number }>;
    rakip_ihale_eslesmeler?: Array<{ rakip: string; ihaleler: string[] }>;
  };
  meta?: {
    toplama_tarihi: string;
    sonuc_toplam: number;
    sure_ms: number;
  };
}

/** Gruplar için veri_havuzu'ndan zenginleştirme gerekli mi? */
const HAVUZ_ZENGINLESTIR: DockGrupAdi[] = ['ihale_performansi', 'hukuki_durum', 'haberler', 'sirket_bilgileri'];

export function ModulDetay({ yukleniciId, grup, durum }: ModulDetayProps) {
  // Çoklu modül verisi: { ihale_gecmisi: {...}, profil_analizi: {...}, ... }
  const [veriler, setVeriler] = useState<Record<string, Record<string, unknown> | null>>({});
  const [havuzVeri, setHavuzVeri] = useState<HavuzVeri | null>(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  const meta = getDockGrupMeta(grup);
  const altModuller = meta?.moduller ?? [];

  /** Grubun tüm alt modüllerinin verisini paralel çek + veri_havuzu zenginleştirmesi */
  const fetchVeriler = useCallback(async () => {
    if (altModuller.length === 0) return;
    setYukleniyor(true);
    setHata(null);
    try {
      // Alt modül verileri
      const modulPromises = altModuller.map(async (modulAdi: IstihbaratModulAdi) => {
        try {
          const res = await fetch(
            getApiUrl(`/contractors/${yukleniciId}/modul/${modulAdi}/veri`),
            { credentials: 'include' }
          );
          const json = await res.json();
          return { modul: modulAdi, veri: json.success ? json.data : null };
        } catch {
          return { modul: modulAdi, veri: null };
        }
      });

      // Havuz verisi (zenginleştirme gereken gruplar için paralel çek)
      const havuzPromise = HAVUZ_ZENGINLESTIR.includes(grup)
        ? fetch(
            getApiUrl(`/contractors/${yukleniciId}/modul/veri_havuzu/veri`),
            { credentials: 'include' }
          )
            .then((r) => r.json())
            .then((json) => (json.success ? json.data : null))
            .catch(() => null)
        : Promise.resolve(null);

      const [results, hv] = await Promise.all([Promise.all(modulPromises), havuzPromise]);

      const map: Record<string, Record<string, unknown> | null> = {};
      for (const r of results) {
        map[r.modul] = r.veri;
      }
      setVeriler(map);
      setHavuzVeri(hv as HavuzVeri | null);
    } catch (err) {
      setHata(err instanceof Error ? err.message : 'Bağlantı hatası');
    } finally {
      setYukleniyor(false);
    }
  }, [yukleniciId, altModuller, grup]);

  // Grup veya durum değiştiğinde veriyi çek
  useEffect(() => {
    if (durum === 'tamamlandi' || durum === 'bekliyor') {
      fetchVeriler();
    }
  }, [durum, fetchVeriler]);

  // Çalışıyor durumu
  if (durum === 'calisiyor') {
    return (
      <Center py="xl">
        <Stack align="center" gap="md">
          <Loader size="lg" color={meta?.renk || 'blue'} />
          <Text c="dimmed" size="sm">
            {meta?.baslik || grup} verileri toplanıyor...
          </Text>
          <Text c="dimmed" size="xs">
            Bu işlem birkaç dakika sürebilir
          </Text>
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

  // Henüz çalıştırılmamış — hiçbir alt modülde veri yok
  const hicVeriYok = Object.values(veriler).every((v) => v === null);
  if (hicVeriYok && durum === 'bekliyor') {
    return (
      <Center py="xl">
        <Stack align="center" gap="md">
          <Text size="lg" fw={600}>{meta?.baslik}</Text>
          <Text c="dimmed" size="sm" ta="center">
            Bu modül henüz çalıştırılmadı.
            <br />
            Dock&apos;tan ikona çift tıklayarak veri toplama işlemini başlatabilirsiniz.
          </Text>
        </Stack>
      </Center>
    );
  }

  // Gruba göre doğru paneli render et
  return (
    <Box>
      <Title order={5} mb="md">{meta?.baslik || grup}</Title>
      {renderGrupPaneli(grup, veriler, yukleniciId, havuzVeri)}
    </Box>
  );
}

/** Grup adına göre doğru birleşik paneli seçer */
function renderGrupPaneli(
  grup: DockGrupAdi,
  veriler: Record<string, Record<string, unknown> | null>,
  yukleniciId: number,
  havuzVeri: HavuzVeri | null
) {
  switch (grup) {
    case 'ihale_performansi':
      return <IhalePerformansiDetay veriler={veriler} havuzVeri={havuzVeri} />;
    case 'hukuki_durum':
      return <HukukiDurumDetay veriler={veriler} havuzVeri={havuzVeri} />;
    case 'sirket_bilgileri':
      return <SirketBilgileriDetay veri={veriler.sirket_bilgileri ?? null} havuzVeri={havuzVeri} />;
    case 'haberler':
      return <HaberlerDetay veri={veriler.haberler ?? null} havuzVeri={havuzVeri} />;
    case 'ai_arastirma':
      return <AiRaporDetay veri={veriler.ai_arastirma ?? null} yukleniciId={yukleniciId} />;
    default:
      return <Text c="dimmed">Bu grup için detay paneli henüz hazır değil.</Text>;
  }
}
