'use client';

/**
 * KİK Yasaklılar Detay Paneli
 * EKAP yasaklı firma sorgu sonucu.
 */

import { Alert, Badge, Paper, Stack, Text, ThemeIcon, Group } from '@mantine/core';
import { IconShieldCheck, IconShieldOff } from '@tabler/icons-react';

interface Props {
  veri: Record<string, unknown> | null;
}

export function KikYasaklilarDetay({ veri }: Props) {
  if (!veri) return <Text c="dimmed">Veri bulunamadı. Modülü çalıştırarak sorgu yapabilirsiniz.</Text>;

  const yasakliMi = veri.yasakli_mi as boolean;
  const sonuclar = (veri.sonuclar as Array<Record<string, string>>) || [];
  const sorgulamaTarihi = veri.sorgulama_tarihi as string;
  const not = veri.not as string | undefined;

  return (
    <Stack gap="md">
      {/* Ana durum göstergesi */}
      <Alert
        variant="light"
        color={yasakliMi ? 'red' : 'green'}
        title={yasakliMi ? 'DİKKAT: Yasaklı Firma!' : 'Yasaklı Değil'}
        icon={yasakliMi ? <IconShieldOff size={20} /> : <IconShieldCheck size={20} />}
      >
        {yasakliMi
          ? `Bu firma EKAP yasaklılar listesinde ${sonuclar.length} kayıtla tespit edildi.`
          : 'Bu firma EKAP yasaklılar listesinde bulunamadı. Herhangi bir kamu ihalesinden men durumu yok.'}
      </Alert>

      {not && (
        <Text size="xs" c="dimmed">{not}</Text>
      )}

      {/* Yasaklı kayıtları */}
      {sonuclar.length > 0 && (
        <div>
          <Text size="sm" fw={600} mb="xs">
            {yasakliMi ? 'Yasaklama Kayıtları' : 'Genel Sonuçlar'}
          </Text>
          <Stack gap="xs">
            {sonuclar.map((s, idx) => (
              <Paper key={`yasak-${idx}`} withBorder p="xs" radius="sm">
                <Text size="xs" fw={600}>{s.firma_adi}</Text>
                <Group gap={4} mt={4}>
                  {s.yasaklama_tarihi && <Badge size="xs" variant="light" color="red">Tarih: {s.yasaklama_tarihi}</Badge>}
                  {s.yasaklama_suresi && <Badge size="xs" variant="light" color="orange">Süre: {s.yasaklama_suresi}</Badge>}
                </Group>
                {s.yasaklama_nedeni && <Text size="xs" c="dimmed" mt={2}>{s.yasaklama_nedeni}</Text>}
              </Paper>
            ))}
          </Stack>
        </div>
      )}

      {sorgulamaTarihi && (
        <Text size="xs" c="dimmed" ta="right">
          Son sorgulama: {new Date(sorgulamaTarihi).toLocaleString('tr-TR')}
        </Text>
      )}
    </Stack>
  );
}
