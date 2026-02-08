'use client';

import {
  ActionIcon,
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  Collapse,
  Divider,
  Group,
  Paper,
  Rating,
  ScrollArea,
  Skeleton,
  Stack,
  Text,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconBookmark,
  IconBookmarkFilled,
  IconBrain,
  IconChevronDown,
  IconChevronUp,
  IconExternalLink,
  IconMapPin,
  IconSpy,
  IconTrophy,
  IconX,
} from '@tabler/icons-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getApiUrl } from '@/lib/config';
import type { YukleniciDetay } from '@/types/yuklenici';
import { formatCurrency } from '@/types/yuklenici';
import { IstihbaratMerkezi } from './istihbarat';

/** Relative zaman formatlama */
function formatZaman(isoStr: string | null | undefined): string {
  if (!isoStr) return '';
  const now = Date.now();
  const then = new Date(isoStr).getTime();
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 60) return 'Az once';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} dk once`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} saat once`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 30) return `${diffDay} gun once`;
  return new Date(isoStr).toLocaleDateString('tr-TR');
}

export function ProfilModal({
  id,
  onClose,
  isDark,
  onIstihbaratToggle,
  onTakipToggle,
}: {
  id: number;
  onClose: () => void;
  isDark: boolean;
  onIstihbaratToggle: (id: number) => Promise<void>;
  onTakipToggle: (id: number) => Promise<void>;
}) {
  const [data, setData] = useState<YukleniciDetay | null>(null);
  const [loading, setLoading] = useState(true);
  const [scrapingHistory, setScrapingHistory] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // AI profil ozeti
  const [aiOzet, setAiOzet] = useState<string | null>(null);
  const [aiOzetLoading, setAiOzetLoading] = useState(false);

  // Genel bilgiler expand/collapse — default ACIK
  const [genelAcik, { toggle: toggleGenel }] = useDisclosure(true);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const mFetch = useCallback((url: string, opts?: RequestInit) => {
    return fetch(url, { credentials: 'include' as RequestCredentials, headers: { 'Content-Type': 'application/json' }, ...opts });
  }, []);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    try {
      const res = await mFetch(getApiUrl(`/contractors/${id}`));
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      }
    } catch (err) {
      console.error('Detail fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [id, mFetch]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  // AI profil ozeti cek
  const fetchAiOzet = useCallback(async () => {
    setAiOzetLoading(true);
    try {
      const res = await mFetch(getApiUrl(`/contractors/${id}/ai-ozet`));
      const json = await res.json();
      if (json.success && json.data?.ozet) {
        setAiOzet(json.data.ozet);
      } else {
        notifications.show({ title: 'Uyari', message: json.error || 'AI ozeti olusturulamadi', color: 'orange' });
      }
    } catch (err) {
      console.error('AI ozet error:', err);
      notifications.show({ title: 'Hata', message: 'AI ozeti olusturulurken hata', color: 'red' });
    } finally {
      setAiOzetLoading(false);
    }
  }, [id, mFetch]);

  // Puan guncelle
  const handlePuanChange = async (newPuan: number) => {
    try {
      await mFetch(getApiUrl(`/contractors/${id}`), {
        method: 'PATCH',
        body: JSON.stringify({ puan: newPuan }),
      });
      fetchDetail();
      notifications.show({ title: 'Kaydedildi', message: `Puan ${newPuan} olarak guncellendi`, color: 'green' });
    } catch (err) {
      console.error('Puan update error:', err);
    }
  };

  const handleTakipToggle = async () => {
    await onTakipToggle(id);
    fetchDetail();
  };

  const handleIstihbaratToggle = async () => {
    await onIstihbaratToggle(id);
    setScrapingHistory(true);
    pollRef.current = setInterval(async () => {
      try {
        const statusRes = await mFetch(getApiUrl('/contractors/scrape/status'));
        const status = await statusRes.json();
        if (!status.running) {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setScrapingHistory(false);
          fetchDetail();
          notifications.show({ title: 'Istihbarat Tamamlandi', message: 'Ihale gecmisi guncellendi', color: 'green' });
        }
      } catch { /* ignore */ }
    }, 3000);
    setTimeout(async () => {
      try {
        const statusRes = await mFetch(getApiUrl('/contractors/scrape/status'));
        const status = await statusRes.json();
        if (!status.running) {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setScrapingHistory(false);
          fetchDetail();
        }
      } catch { /* ignore */ }
    }, 1500);
  };

  if (loading || !data) {
    return (
      <Box p="lg">
        <Group justify="space-between" mb="md">
          <Group gap="sm">
            <Skeleton height={40} width={40} circle />
            <Skeleton height={28} width={300} />
          </Group>
          <ActionIcon variant="subtle" onClick={onClose} aria-label="Kapat"><IconX size={18} /></ActionIcon>
        </Group>
        <Stack gap="sm">
          <Group grow>
            {['sk1','sk2','sk3','sk4','sk5'].map((k) => <Skeleton key={k} height={60} />)}
          </Group>
          <Skeleton height={200} />
        </Stack>
      </Box>
    );
  }

  const yk = data.yuklenici;
  // veri_kaynaklari normalization
  const rawVeriKaynaklari = yk.veri_kaynaklari || ['ihalebul'];
  const veriKaynaklari: string[] = rawVeriKaynaklari.map((vk: unknown) => {
    if (typeof vk === 'string') return vk;
    if (typeof vk === 'object' && vk !== null && 'kaynak' in vk) return String((vk as { kaynak: string }).kaynak);
    return String(vk);
  });

  const firmaAdi = yk.kisa_ad || yk.unvan;
  const avatarChar = firmaAdi?.[0]?.toUpperCase() || 'Y';

  return (
    <Box style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'linear-gradient(180deg, #0f1015 0%, #16171c 100%)' }}>
      {/* ─── Sticky Header — Premium Dark + Gold ─── */}
      <Paper
        p="md"
        className="yk-sticky-header"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <Group justify="space-between">
          <Group gap="sm">
            <Avatar
              radius="xl"
              size="md"
              style={{
                background: 'linear-gradient(135deg, var(--yk-gold), var(--yk-gold-light))',
                color: '#000',
                fontWeight: 700,
              }}
            >
              {avatarChar}
            </Avatar>
            <div>
              <Group gap="xs">
                <Text fw={700} size="xl" id="yuklenici-modal-title" style={{ color: 'var(--yk-text-primary)' }}>{firmaAdi}</Text>
                {yk.istihbarat_takibi && (
                  <Badge className="yk-badge-gold" size="sm" leftSection={<IconSpy size={12} />}>
                    {scrapingHistory ? 'Cekiliyor...' : 'Istihbarat'}
                  </Badge>
                )}
              </Group>
              {yk.kisa_ad && <Text size="sm" c="dimmed" lineClamp={1}>{yk.unvan}</Text>}
              <Group gap={6} mt={2}>
                {veriKaynaklari.map((vk) => (
                  <Badge key={`vk-${vk}`} size="xs" variant="light" style={{ background: 'var(--yk-gold-dim)', color: 'var(--yk-gold)', border: '1px solid var(--yk-border)' }}>{vk}</Badge>
                ))}
                {yk.scraped_at && (
                  <Text size="xs" c="dimmed">Son tarama: {formatZaman(yk.scraped_at)}</Text>
                )}
              </Group>
            </div>
          </Group>
          <Group>
            <Tooltip label={yk.takipte ? 'Takipten cikar' : 'Takibe al'}>
              <ActionIcon
                variant={yk.takipte ? 'filled' : 'light'}
                onClick={handleTakipToggle}
                aria-label={yk.takipte ? 'Takipten cikar' : 'Takibe al'}
                style={yk.takipte
                  ? { background: 'linear-gradient(135deg, var(--yk-gold), #B8963F)', color: '#000' }
                  : { background: 'var(--yk-gold-dim)', color: 'var(--yk-gold)', border: '1px solid var(--yk-border)' }
                }
              >
                {yk.takipte ? <IconBookmarkFilled size={18} /> : <IconBookmark size={18} />}
              </ActionIcon>
            </Tooltip>
            <Tooltip label={yk.istihbarat_takibi ? 'Istihbarattan cikar' : 'Istihbarata al'}>
              <ActionIcon
                variant={yk.istihbarat_takibi ? 'filled' : 'light'}
                color="red"
                onClick={handleIstihbaratToggle}
                loading={scrapingHistory}
                aria-label="Istihbarat toggle"
              >
                <IconSpy size={18} />
              </ActionIcon>
            </Tooltip>
            <ActionIcon
              variant="subtle"
              onClick={onClose}
              aria-label="Kapat"
              style={{ color: 'var(--yk-text-secondary)' }}
            >
              <IconX size={18} />
            </ActionIcon>
          </Group>
        </Group>

        {/* ─── Stats Row — Premium gold stat cards ─── */}
        <Group grow mt="sm">
          <Card p="xs" radius="md" className="yk-stat-card">
            <Text size="xs" c="dimmed" style={{ letterSpacing: '0.03em', textTransform: 'uppercase', fontSize: 10 }}>Katildigi</Text>
            <Text fw={700} size="lg" style={{ color: 'var(--yk-text-primary)' }}>{yk.katildigi_ihale_sayisi}</Text>
          </Card>
          <Card p="xs" radius="md" className="yk-stat-card">
            <Text size="xs" c="dimmed" style={{ letterSpacing: '0.03em', textTransform: 'uppercase', fontSize: 10 }}>Kazanma</Text>
            <Text fw={700} size="lg" c="green">%{Number(yk.kazanma_orani || 0).toFixed(1)}</Text>
          </Card>
          <Card p="xs" radius="md" className="yk-stat-card">
            <Text size="xs" c="dimmed" style={{ letterSpacing: '0.03em', textTransform: 'uppercase', fontSize: 10 }}>Toplam Sozlesme</Text>
            <Text fw={700} size="lg" style={{ color: 'var(--yk-gold)' }}>{formatCurrency(yk.toplam_sozlesme_bedeli)}</Text>
          </Card>
          <Card p="xs" radius="md" className="yk-stat-card">
            <Text size="xs" c="dimmed" style={{ letterSpacing: '0.03em', textTransform: 'uppercase', fontSize: 10 }}>Ort. Indirim</Text>
            <Text fw={700} size="lg" c="teal">
              {yk.ortalama_indirim_orani ? `%${Number(yk.ortalama_indirim_orani).toFixed(1)}` : '-'}
            </Text>
          </Card>
          <Card p="xs" radius="md" className="yk-stat-card">
            <Text size="xs" c="dimmed" style={{ letterSpacing: '0.03em', textTransform: 'uppercase', fontSize: 10 }}>Devam Eden</Text>
            <Text fw={700} size="lg" style={{ color: yk.devam_eden_is_sayisi > 0 ? 'var(--yk-gold-light)' : undefined }}>
              {yk.devam_eden_is_sayisi}
            </Text>
          </Card>
        </Group>
      </Paper>

      {/* ─── Scrollable Content ─── */}
      <Box style={{ flex: 1, overflowY: 'auto' }}>
        {/* ─── Puan + Etiketler + Genel Bilgiler (Collapsible) ─── */}
        <Box px="md" pt="sm">
          <Group justify="space-between" mb="xs">
            <Group gap="sm">
              {/* Puan */}
              <Group gap={4}>
                <Text size="xs" fw={600} c="dimmed">Puan:</Text>
                <Rating value={yk.puan} size="sm" onChange={handlePuanChange} />
              </Group>

              {/* Etiketler */}
              {yk.etiketler && yk.etiketler.length > 0 && (
                <Group gap={4}>
                  {yk.etiketler.map((e) => (
                    <Badge key={`etk-${e}`} size="xs" variant="light">{e}</Badge>
                  ))}
                </Group>
              )}

              {/* ihalebul link */}
              {yk.ihalebul_url && (
                <Button
                  variant="subtle"
                  size="compact-xs"
                  leftSection={<IconExternalLink size={12} />}
                  onClick={() => window.open(yk.ihalebul_url ?? '', '_blank')}
                >
                  ihalebul.com
                </Button>
              )}
            </Group>

            {/* Genel bilgileri ac/kapa */}
            <Button
              variant="subtle"
              size="compact-xs"
              color="gray"
              rightSection={genelAcik ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
              onClick={toggleGenel}
            >
              {genelAcik ? 'Gizle' : 'Detaylar'}
            </Button>
          </Group>

          <Collapse in={genelAcik}>
            <Stack gap="sm" pb="sm">
              {/* AI Profil Ozeti — Premium gold CTA */}
              {aiOzet ? (
                <Card
                  radius="md"
                  p="sm"
                  style={{
                    background: 'linear-gradient(135deg, rgba(201, 168, 76, 0.06) 0%, rgba(201, 168, 76, 0.02) 100%)',
                    border: '1px solid var(--yk-border)',
                  }}
                >
                  <Group justify="space-between" mb="xs">
                    <Group gap="xs">
                      <ThemeIcon size="sm" variant="light" radius="sm" style={{ background: 'var(--yk-gold-dim)', color: 'var(--yk-gold)' }}>
                        <IconBrain size={14} />
                      </ThemeIcon>
                      <Text size="sm" fw={600} style={{ color: 'var(--yk-gold)' }}>AI Profil Ozeti</Text>
                    </Group>
                    <Button
                      size="compact-xs"
                      leftSection={<IconBrain size={14} />}
                      onClick={fetchAiOzet}
                      loading={aiOzetLoading}
                      style={{ background: 'var(--yk-gold-dim)', color: 'var(--yk-gold)', border: '1px solid var(--yk-border)' }}
                    >
                      Yenile
                    </Button>
                  </Group>
                  <Text size="sm" style={{ whiteSpace: 'pre-line', color: 'var(--yk-text-primary)' }}>{aiOzet}</Text>
                </Card>
              ) : (
                <Card
                  radius="md"
                  p="md"
                  className={`yk-ai-cta ${!aiOzetLoading ? 'ai-cta-pulse' : ''}`}
                  style={{ cursor: 'pointer', textAlign: 'center' }}
                  onClick={!aiOzetLoading ? fetchAiOzet : undefined}
                >
                  <Stack align="center" gap={4}>
                    <ThemeIcon size="lg" variant="light" radius="xl" style={{ background: 'var(--yk-gold-dim)', color: 'var(--yk-gold)' }}>
                      <IconBrain size={20} />
                    </ThemeIcon>
                    <Text size="sm" fw={600} style={{ color: 'var(--yk-gold)' }}>AI Profil Ozeti</Text>
                    <Text size="xs" c="dimmed">
                      {aiOzetLoading ? 'Olusturuluyor...' : 'Tikla — AI destekli firma profili olustur'}
                    </Text>
                  </Stack>
                </Card>
              )}

              {/* Sehir Dagilimi */}
              {((yk.aktif_sehirler && yk.aktif_sehirler.length > 0) || data.sehirDagilimi.length > 0) && (
                <div>
                  <Text size="sm" fw={600} mb="xs">
                    <IconMapPin size={14} style={{ verticalAlign: 'middle' }} /> Aktif Sehirler ({data.sehirDagilimi.length || yk.aktif_sehirler?.length || 0})
                  </Text>
                  {data.sehirDagilimi.length > 0 ? (
                    <ScrollArea.Autosize mah={160}>
                      <Stack gap={4}>
                        {data.sehirDagilimi.slice(0, 10).map((s, idx) => (
                          <Group key={`${s.sehir}-${idx}`} justify="space-between">
                            <Text size="sm">{s.sehir}</Text>
                            <Group gap={8}>
                              <Badge size="xs" variant="light">{s.ihale_sayisi} ihale</Badge>
                              {parseFloat(s.toplam_bedel) > 0 && (
                                <Text size="xs" c="orange" fw={500}>{formatCurrency(parseFloat(s.toplam_bedel))}</Text>
                              )}
                            </Group>
                          </Group>
                        ))}
                      </Stack>
                    </ScrollArea.Autosize>
                  ) : (
                    <Group gap={4} wrap="wrap">
                      {(yk.aktif_sehirler || []).slice(0, 10).map((s: string | { sehir: string }, idx: number) => (
                        <Badge key={`${typeof s === 'string' ? s : s.sehir}-${idx}`} size="sm" variant="light">
                          {typeof s === 'string' ? s : s.sehir}
                        </Badge>
                      ))}
                    </Group>
                  )}
                </div>
              )}

              {/* Son Kazanilan Ihaleler — Premium */}
              {data.kazanilanIhaleler.length > 0 && (
                <div>
                  <Group gap="xs" mb="xs">
                    <ThemeIcon size="sm" variant="light" radius="sm" style={{ background: 'var(--yk-gold-dim)', color: 'var(--yk-gold)' }}>
                      <IconTrophy size={12} />
                    </ThemeIcon>
                    <Text size="sm" fw={600} style={{ color: 'var(--yk-gold)', letterSpacing: '0.02em' }}>Son Kazanilan Ihaleler</Text>
                    <Badge size="xs" className="yk-badge-gold">{data.kazanilanIhaleler.length}</Badge>
                  </Group>
                  <Stack gap={4}>
                    {data.kazanilanIhaleler.slice(0, 5).map((ihale) => (
                      <Paper
                        key={`son-${ihale.id}`}
                        p="xs"
                        radius="md"
                        style={{
                          cursor: ihale.url ? 'pointer' : undefined,
                          transition: 'all 0.15s ease',
                          background: 'var(--yk-surface-glass)',
                          border: '1px solid var(--yk-border-subtle)',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--yk-border)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--yk-border-subtle)'; }}
                        onClick={() => { if (ihale.url) window.open(ihale.url, '_blank'); }}
                      >
                        <Group justify="space-between" wrap="nowrap">
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <Text size="xs" fw={600} lineClamp={1}>{ihale.title}</Text>
                            <Group gap="xs" mt={2}>
                              {ihale.city && <Badge size="xs" variant="light" style={{ background: 'var(--yk-gold-dim)', color: 'var(--yk-gold)', border: 'none' }}>{ihale.city}</Badge>}
                              {ihale.organization_name && (
                                <Text size="xs" c="dimmed" lineClamp={1}>{ihale.organization_name}</Text>
                              )}
                            </Group>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            {ihale.sozlesme_bedeli && (
                              <Text size="xs" fw={600} style={{ color: 'var(--yk-gold)' }}>{formatCurrency(ihale.sozlesme_bedeli)}</Text>
                            )}
                            {(ihale.sozlesme_tarihi || ihale.tender_date) && (
                              <Text size="xs" c="dimmed">
                                {new Date(ihale.sozlesme_tarihi || ihale.tender_date).toLocaleDateString('tr-TR')}
                              </Text>
                            )}
                          </div>
                        </Group>
                      </Paper>
                    ))}
                  </Stack>
                </div>
              )}
            </Stack>
          </Collapse>
        </Box>

        <Divider />

        {/* ─── Istihbarat Merkezi (Ana Icerik) ─── */}
        <IstihbaratMerkezi
          yukleniciId={yk.id}
          yukleniciAdi={yk.kisa_ad || yk.unvan}
          isDark={isDark}
          yuklenici={yk}
        />
      </Box>
    </Box>
  );
}
