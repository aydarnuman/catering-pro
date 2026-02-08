'use client';

import {
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
  Textarea,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconAlertTriangle, IconFileAlert, IconShieldCheck } from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';
import { getApiUrl } from '@/lib/config';
import type { Yuklenici } from '@/types/yuklenici';
import { formatCurrency } from '@/types/yuklenici';

interface RiskData {
  fesihler: Array<{ ihale_basligi: string; kurum_adi: string; sehir: string; sozlesme_bedeli: number; sozlesme_tarihi: string; fesih_durumu: string; ikn: string }>;
  kikKararlari: Array<{ ihale_basligi: string; kurum_adi: string; sehir: string; sozlesme_bedeli: number; sozlesme_tarihi: string; durum: string; ikn: string; tender_url?: string }>;
  riskNotlari: Array<{ id: number; content: string; created_at: string }>;
}

export function RiskNotlarTab({
  yuklenici,
  isDark,
  initialNotlar,
}: {
  yuklenici: Yuklenici;
  isDark: boolean;
  initialNotlar: string;
}) {
  const yk = yuklenici;
  const [notlar, setNotlar] = useState(initialNotlar);
  const [riskData, setRiskData] = useState<RiskData | null>(null);
  const [riskLoading, setRiskLoading] = useState(false);

  const mFetch = useCallback((url: string, opts?: RequestInit) => {
    return fetch(url, { credentials: 'include' as RequestCredentials, headers: { 'Content-Type': 'application/json' }, ...opts });
  }, []);

  const fetchRiskData = useCallback(async () => {
    setRiskLoading(true);
    try {
      const res = await mFetch(getApiUrl(`/contractors/${yk.id}/risk`));
      const json = await res.json();
      if (json.success) {
        setRiskData({
          fesihler: json.data.fesihler || [],
          kikKararlari: json.data.kikKararlari || [],
          riskNotlari: json.data.riskNotlari || [],
        });
      }
    } catch (err) {
      console.error('Risk data fetch error:', err);
    } finally {
      setRiskLoading(false);
    }
  }, [yk.id, mFetch]);

  useEffect(() => {
    fetchRiskData();
  }, [fetchRiskData]);

  const saveNotlar = async () => {
    try {
      await mFetch(getApiUrl(`/contractors/${yk.id}`), {
        method: 'PATCH',
        body: JSON.stringify({ notlar }),
      });
      notifications.show({ title: 'Kaydedildi', message: 'Notlar guncellendi', color: 'green' });
    } catch (err) {
      console.error('Save notes error:', err);
    }
  };

  return (
    <Stack gap="md" pb="md">
      {/* Risk Ozet Kartlari */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <Card withBorder radius="sm">
          <Group gap="xs" mb="xs">
            <IconAlertTriangle size={16} color="var(--mantine-color-red-6)" />
            <Text size="sm" fw={600}>Fesih / Tasfiye</Text>
          </Group>
          {(yk.fesih_sayisi || 0) > 0 ? (
            <Badge color="red" variant="light" size="lg">{yk.fesih_sayisi} fesih kaydi</Badge>
          ) : (
            <Text size="sm" c="green">Fesih kaydi bulunmuyor</Text>
          )}
        </Card>

        <Card withBorder radius="sm">
          <Group gap="xs" mb="xs">
            <IconShieldCheck size={16} color="var(--mantine-color-orange-6)" />
            <Text size="sm" fw={600}>KIK Sikayet</Text>
          </Group>
          {(yk.kik_sikayet_sayisi || 0) > 0 ? (
            <Badge color="orange" variant="light" size="lg">{yk.kik_sikayet_sayisi} sikayet kaydi</Badge>
          ) : (
            <Text size="sm" c="dimmed">Sikayet verisi henuz yok</Text>
          )}
        </Card>

        <Card withBorder radius="sm" bg={yk.risk_notu ? (isDark ? 'dark.6' : 'red.0') : undefined}>
          <Group gap="xs" mb="xs">
            <IconFileAlert size={16} color="var(--mantine-color-grape-6)" />
            <Text size="sm" fw={600}>Risk Notu</Text>
          </Group>
          {yk.risk_notu ? (
            <Text size="sm">{yk.risk_notu}</Text>
          ) : (
            <Text size="sm" c="dimmed">Risk notu girilmemis</Text>
          )}
        </Card>
      </div>

      {/* Fesih Detaylari */}
      {(yk.fesih_sayisi || 0) > 0 && (
        <Card withBorder radius="sm">
          <Group gap="xs" mb="sm">
            <IconAlertTriangle size={16} color="var(--mantine-color-red-6)" />
            <Text size="sm" fw={600}>Fesih Detaylari ({riskData?.fesihler.length || '...'})</Text>
            {riskLoading && <Loader size="xs" />}
          </Group>
          {riskData && riskData.fesihler.length > 0 ? (
            <Stack gap={6}>
              {riskData.fesihler.map((f, idx) => (
                <Paper key={`fesih-${idx}-${f.ikn || ''}`} withBorder p="sm" radius="sm" bg={isDark ? 'dark.7' : 'red.0'}>
                  <Group justify="space-between" wrap="nowrap">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text size="sm" fw={600} lineClamp={1}>{f.ihale_basligi}</Text>
                      <Group gap="xs" mt={4}>
                        {f.sehir && <Badge size="xs" variant="light" color="blue">{f.sehir}</Badge>}
                        {f.kurum_adi && <Text size="xs" c="dimmed" lineClamp={1}>{f.kurum_adi}</Text>}
                      </Group>
                      {f.fesih_durumu && f.fesih_durumu !== 'Var' && (
                        <Text size="xs" c="red" mt={4}>Durum: {f.fesih_durumu}</Text>
                      )}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      {f.sozlesme_bedeli && (
                        <Text size="sm" fw={600} c="orange">{formatCurrency(f.sozlesme_bedeli)}</Text>
                      )}
                      {f.sozlesme_tarihi && (
                        <Text size="xs" c="dimmed">{new Date(f.sozlesme_tarihi).toLocaleDateString('tr-TR')}</Text>
                      )}
                      {f.ikn && <Text size="xs" c="dimmed">IKN: {f.ikn}</Text>}
                    </div>
                  </Group>
                </Paper>
              ))}
            </Stack>
          ) : riskData && riskData.fesihler.length === 0 ? (
            <Text size="sm" c="dimmed">Fesih detay bilgisi bulunamadi</Text>
          ) : null}
        </Card>
      )}

      {/* KIK Karar Detaylari */}
      {(yk.kik_sikayet_sayisi || 0) > 0 && (
        <Card withBorder radius="sm">
          <Group gap="xs" mb="sm">
            <IconShieldCheck size={16} color="var(--mantine-color-orange-6)" />
            <Text size="sm" fw={600}>KIK Karar Detaylari ({riskData?.kikKararlari.length || '...'})</Text>
            {riskLoading && <Loader size="xs" />}
          </Group>
          {riskData && riskData.kikKararlari.length > 0 ? (
            <Stack gap={6}>
              {riskData.kikKararlari.map((k, idx) => (
                <Paper key={`kik-${idx}-${k.ikn || ''}`} withBorder p="sm" radius="sm" bg={isDark ? 'dark.7' : 'orange.0'}>
                  <Group justify="space-between" wrap="nowrap">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text size="sm" fw={600} lineClamp={1}>{k.ihale_basligi}</Text>
                      <Group gap="xs" mt={4}>
                        {k.sehir && <Badge size="xs" variant="light" color="blue">{k.sehir}</Badge>}
                        {k.kurum_adi && <Text size="xs" c="dimmed" lineClamp={1}>{k.kurum_adi}</Text>}
                      </Group>
                      {k.durum && <Badge size="xs" variant="light" color="orange" mt={4}>{k.durum}</Badge>}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      {k.sozlesme_bedeli && (
                        <Text size="sm" fw={600} c="orange">{formatCurrency(k.sozlesme_bedeli)}</Text>
                      )}
                      {k.sozlesme_tarihi && (
                        <Text size="xs" c="dimmed">{new Date(k.sozlesme_tarihi).toLocaleDateString('tr-TR')}</Text>
                      )}
                      {k.ikn && <Text size="xs" c="dimmed">IKN: {k.ikn}</Text>}
                    </div>
                  </Group>
                </Paper>
              ))}
            </Stack>
          ) : riskData && riskData.kikKararlari.length === 0 ? (
            <Text size="sm" c="dimmed">KIK karar detayi bulunamadi</Text>
          ) : null}
        </Card>
      )}

      <Divider />

      {/* Notlar */}
      <div>
        <Text size="sm" fw={600} mb="xs">Notlar</Text>
        <Textarea
          value={notlar}
          onChange={(e) => setNotlar(e.currentTarget.value)}
          placeholder="Bu yuklenici hakkinda notlariniz..."
          minRows={3}
          maxRows={6}
          autosize
        />
        <Button variant="light" size="xs" mt="xs" onClick={saveNotlar}>
          Notlari Kaydet
        </Button>
      </div>
    </Stack>
  );
}
