'use client';

/**
 * Istihbarat Merkezi — Floating Dock Layout
 * ──────────────────────────────────────────
 * Yuklenici detay modali icinde gosterilir.
 * Ust: Baslik + Arac Cubugu
 * Orta: Icerik Alani (secili modul detayi VEYA placeholder)
 * Alt: Floating Dock Bar — 8 modul ikonu yan yana, hover'da buyur
 */

import {
  Box,
  Button,
  Divider,
  Drawer,
  Group,
  Modal,
  Paper,
  Text,
  ThemeIcon,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconAlertTriangle,
  IconArrowsExchange,
  IconChartLine,
  IconLink,
  IconMap,
  IconPlayerPlay,
  IconRadar,
  IconRefresh,
} from '@tabler/icons-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getApiUrl } from '@/lib/config';
import type { IstihbaratModul, IstihbaratModulAdi, Yuklenici } from '@/types/yuklenici';
import { ModulDetay } from './ModulDetay';
import { MODUL_LISTESI } from './modul-meta';
import { IstihbaratDock } from './IstihbaratDock';
import { KarsilastirmaPaneli } from './KarsilastirmaPaneli';
import { FiyatTahminPaneli } from './FiyatTahminPaneli';
import { IliskiAgiPaneli } from './IliskiAgiPaneli';
import { BolgeselHaritaPaneli } from './BolgeselHaritaPaneli';
import { PdfRaporButonu } from './PdfRaporButonu';
import { RiskNotlarTab } from '../RiskNotlarTab';

interface IstihbaratMerkeziProps {
  yukleniciId: number;
  yukleniciAdi?: string;
  isDark: boolean;
  yuklenici?: Yuklenici;
}

export function IstihbaratMerkezi({ yukleniciId, yukleniciAdi, isDark, yuklenici }: IstihbaratMerkeziProps) {
  // Tum modullerin durumu
  const [moduller, setModuller] = useState<IstihbaratModul[]>([]);
  const [, setYukleniyor] = useState(true);

  // Secili modul (detay paneli icin)
  const [seciliModul, setSeciliModul] = useState<IstihbaratModulAdi | null>(null);

  // Polling ref — calisan moduller icin
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── API Cagrilari ────────────────────────────────────────────

  const mFetch = useCallback((url: string, opts?: RequestInit) => {
    return fetch(url, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...opts });
  }, []);

  /** Tum modullerin durumunu cek */
  const fetchModuller = useCallback(async () => {
    try {
      const res = await mFetch(getApiUrl(`/contractors/${yukleniciId}/istihbarat`));
      const json = await res.json();
      if (json.success) {
        setModuller(json.data.moduller);
      }
    } catch (err) {
      console.error('Istihbarat durum cekme hatasi:', err);
    } finally {
      setYukleniyor(false);
    }
  }, [yukleniciId, mFetch]);

  // ─── Polling ─────────────────────────────────────────────────

  const startPolling = useCallback(() => {
    if (pollRef.current) return;

    pollRef.current = setInterval(async () => {
      try {
        const res = await mFetch(getApiUrl(`/contractors/${yukleniciId}/istihbarat`));
        const json = await res.json();
        if (json.success) {
          setModuller(json.data.moduller);

          const calisan = json.data.moduller.filter((m: IstihbaratModul) => m.durum === 'calisiyor');
          if (calisan.length === 0 && pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
        }
      } catch {
        // Polling hatasi sessiz gecilir
      }
    }, 3000);
  }, [yukleniciId, mFetch]);

  /** Tek bir modulu calistir */
  const calistirModul = useCallback(async (modul: IstihbaratModulAdi) => {
    try {
      const res = await mFetch(getApiUrl(`/contractors/${yukleniciId}/modul/${modul}/calistir`), {
        method: 'POST',
      });
      const json = await res.json();
      if (json.success) {
        notifications.show({ title: 'Baslatildi', message: json.message, color: 'blue' });
        setModuller(prev => prev.map(m =>
          m.modul === modul ? { ...m, durum: 'calisiyor' } : m
        ));
        startPolling();
      } else {
        notifications.show({ title: 'Hata', message: json.error, color: 'red' });
      }
    } catch (err) {
      console.error('Modul calistirma hatasi:', err);
      notifications.show({ title: 'Baglanti Hatasi', message: 'Sunucuya baglanilmadi', color: 'red' });
    }
  }, [yukleniciId, mFetch, startPolling]);

  /** Tum modulleri calistir */
  const tumunuCalistir = useCallback(async () => {
    try {
      const res = await mFetch(getApiUrl(`/contractors/${yukleniciId}/modul/tumunu-calistir`), {
        method: 'POST',
      });
      const json = await res.json();
      if (json.success) {
        notifications.show({ title: 'Tumu Baslatildi', message: 'Tum istihbarat modulleri calismaya basladi', color: 'blue' });
        setModuller(prev => prev.map(m => ({ ...m, durum: 'calisiyor' as const })));
        startPolling();
      }
    } catch (err) {
      console.error('Toplu calistirma hatasi:', err);
    }
  }, [yukleniciId, mFetch, startPolling]);

  // Confirmation dialog state
  const [confirmAcik, { open: openConfirm, close: closeConfirm }] = useDisclosure(false);

  // ─── Yasam Dongusu ──────────────────────────────────────────

  useEffect(() => {
    fetchModuller();
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [fetchModuller]);

  useEffect(() => {
    const calisanVar = moduller.some(m => m.durum === 'calisiyor');
    if (calisanVar && !pollRef.current) {
      startPolling();
    }
  }, [moduller, startPolling]);

  // ─── Ek Panel State'leri ─────────────────────────────────────

  const [karsilastirmaAcik, { open: openKarsilastirma, close: closeKarsilastirma }] = useDisclosure(false);
  const [fiyatAcik, { open: openFiyat, close: closeFiyat }] = useDisclosure(false);
  const [iliskiAcik, { open: openIliski, close: closeIliski }] = useDisclosure(false);
  const [haritaAcik, { open: openHarita, close: closeHarita }] = useDisclosure(false);
  const [riskAcik, { open: openRisk, close: closeRisk }] = useDisclosure(false);

  // ─── Render ──────────────────────────────────────────────────

  const seciliDurum = seciliModul
    ? moduller.find(m => m.modul === seciliModul)
    : null;

  const tamamlananSayisi = moduller.filter(m => m.durum === 'tamamlandi').length;
  const calisanSayisi = moduller.filter(m => m.durum === 'calisiyor').length;

  return (
    <Box style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* ─── Baslik + Arac Cubugu ──────────────────────────────── */}
      <Box px="md" pt="md" pb={0} style={{ flexShrink: 0 }}>
        {/* Baslik Satiri — Premium */}
        <Group justify="space-between" mb="md">
          <div>
            <Text fw={700} size="lg" style={{ color: 'var(--yk-gold)', letterSpacing: '0.02em' }}>Istihbarat Merkezi</Text>
            <Text size="xs" c="dimmed">
              <Text span style={{ color: 'var(--yk-gold)' }} fw={600}>{tamamlananSayisi}</Text>/{MODUL_LISTESI.length} modul tamamlandi
              {calisanSayisi > 0 && <Text span style={{ color: 'var(--yk-gold-light)' }}> — {calisanSayisi} modul calisiyor</Text>}
            </Text>
          </div>
          <Button
            size="sm"
            leftSection={calisanSayisi > 0 ? <IconRefresh size={16} /> : <IconPlayerPlay size={16} />}
            loading={calisanSayisi > 0}
            onClick={openConfirm}
            disabled={calisanSayisi > 0}
            style={{
              background: 'linear-gradient(135deg, var(--yk-gold), #B8963F)',
              color: '#000',
              border: 'none',
              fontWeight: 600,
            }}
          >
            {calisanSayisi > 0 ? 'Calisiyor...' : 'Tumunu Baslat'}
          </Button>
        </Group>

        {/* Arac Cubugu — Premium dark toolbar */}
        <Group gap="xs" mb="md">
          {[
            { label: 'Karsilastir', icon: <IconArrowsExchange size={14} />, onClick: openKarsilastirma },
            { label: 'Fiyat Tahmini', icon: <IconChartLine size={14} />, onClick: openFiyat },
            { label: 'Iliski Agi', icon: <IconLink size={14} />, onClick: openIliski },
            { label: 'Bolgesel Harita', icon: <IconMap size={14} />, onClick: openHarita },
          ].map((btn) => (
            <Button
              key={btn.label}
              size="xs"
              leftSection={btn.icon}
              onClick={btn.onClick}
              style={{
                background: 'var(--yk-surface-glass)',
                color: 'var(--yk-text-secondary)',
                border: '1px solid var(--yk-border-subtle)',
              }}
            >
              {btn.label}
            </Button>
          ))}
          {yuklenici && (
            <Button
              size="xs"
              leftSection={<IconAlertTriangle size={14} />}
              onClick={openRisk}
              style={{
                background: 'var(--yk-surface-glass)',
                color: 'var(--yk-text-secondary)',
                border: '1px solid var(--yk-border-subtle)',
              }}
            >
              Risk / Notlar
            </Button>
          )}

          <Divider orientation="vertical" style={{ borderColor: 'var(--yk-border-subtle)' }} />

          <PdfRaporButonu yukleniciId={yukleniciId} yukleniciAdi={yukleniciAdi || `Yuklenici #${yukleniciId}`} />
        </Group>

        <Divider style={{ borderColor: 'var(--yk-border)' }} />
      </Box>

      {/* ─── Icerik Alani — flex:1, scroll ─────────────────────── */}
      <Box
        px="md"
        py="md"
        style={{
          flex: 1,
          overflowY: 'auto',
          minHeight: 0,
        }}
      >
        {seciliModul && seciliDurum ? (
          <Paper
            withBorder
            radius="md"
            p="md"
            bg={isDark ? 'dark.7' : 'gray.0'}
            className="yk-dock-content-enter"
            key={seciliModul}
            style={{ minHeight: 300 }}
          >
            <ModulDetay
              yukleniciId={yukleniciId}
              modul={seciliModul}
              durum={seciliDurum.durum}
            />
          </Paper>
        ) : (
          /* ─── Premium Placeholder ──────────────────────────── */
          <div className="yk-dock-placeholder">
            <div className="yk-dock-placeholder-icon">
              <ThemeIcon size={36} variant="transparent" style={{ color: 'var(--yk-gold)' }}>
                <IconRadar size={36} />
              </ThemeIcon>
            </div>
            <Text fw={600} size="lg" style={{ color: 'var(--yk-gold)', letterSpacing: '0.02em' }}>
              Modül Seçin
            </Text>
            <Text size="sm" c="dimmed" maw={320}>
              Aşağıdaki dock&apos;tan bir istihbarat modülü seçerek detaylı analizleri görüntüleyin.
            </Text>
            <Text size="xs" c="dimmed" mt={4} style={{ opacity: 0.5 }}>
              İkona çift tıklayarak modülü doğrudan başlatabilirsiniz
            </Text>
          </div>
        )}
      </Box>

      {/* ─── Floating Dock ─────────────────────────────────────── */}
      <IstihbaratDock
        modulListesi={MODUL_LISTESI}
        moduller={moduller}
        seciliModul={seciliModul}
        onModulSec={(modul) => setSeciliModul(seciliModul === modul ? null : modul)}
        onCalistir={calistirModul}
      />

      {/* ─── Ek Panel Modalleri ─────────────────────────────────── */}

      <Modal opened={karsilastirmaAcik} onClose={closeKarsilastirma} title="Yuklenici Karsilastirma" size="xl">
        <KarsilastirmaPaneli yukleniciId={yukleniciId} />
      </Modal>

      <Drawer opened={fiyatAcik} onClose={closeFiyat} title="Fiyat Tahmin Analizi" position="right" size="md">
        <FiyatTahminPaneli yukleniciId={yukleniciId} />
      </Drawer>

      <Modal opened={iliskiAcik} onClose={closeIliski} title="Iliski Agi — Ortak Girisim & Rakipler" size="xl">
        <IliskiAgiPaneli yukleniciId={yukleniciId} yukleniciAdi={yukleniciAdi} />
      </Modal>

      <Modal opened={haritaAcik} onClose={closeHarita} title="Bolgesel Rekabet Haritasi" size="xl">
        <BolgeselHaritaPaneli yukleniciId={yukleniciId} />
      </Modal>

      {yuklenici && (
        <Drawer opened={riskAcik} onClose={closeRisk} title="Risk Analizi & Notlar" position="right" size="lg">
          <RiskNotlarTab yuklenici={yuklenici} isDark={isDark} initialNotlar={yuklenici.notlar || ''} />
        </Drawer>
      )}

      {/* Tumunu Baslat Confirmation */}
      <Modal opened={confirmAcik} onClose={closeConfirm} title="Tum Modulleri Baslat" size="sm" centered>
        <Text size="sm" mb="md">
          {MODUL_LISTESI.length} istihbarat modulu sirayla calistirilacak.
          Bu islem birkac dakika surebilir. Devam etmek istiyor musunuz?
        </Text>
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={closeConfirm}>Iptal</Button>
          <Button color="blue" onClick={() => { closeConfirm(); tumunuCalistir(); }}>Evet, Baslat</Button>
        </Group>
      </Modal>
    </Box>
  );
}
