'use client';

/**
 * İhale Geçmişi Detay Paneli
 * ───────────────────────────
 * Yüklenicinin ihalebul.com'dan çekilen ihale geçmişi listesi.
 * Her ihalenin yanında "Rakip Analizi" butonu ile AI destekli
 * ihale bazlı rakip analizi tetiklenebilir.
 */

import { Alert, Badge, Button, Center, Group, Loader, Modal, Paper, ScrollArea, Stack, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconRobot, IconUsers } from '@tabler/icons-react';
import { useCallback, useState } from 'react';
import { getApiUrl } from '@/lib/config';
import { formatCurrency } from '@/types/yuklenici';

interface Props {
  veri: Record<string, unknown> | null;
}

export function IhaleGecmisiDetay({ veri }: Props) {
  const [rakipAnaliz, setRakipAnaliz] = useState<Record<string, unknown> | null>(null);
  const [rakipYukleniyor, setRakipYukleniyor] = useState(false);
  const [modalAcik, { open: openModal, close: closeModal }] = useDisclosure(false);

  const fetchRakipAnaliz = useCallback(async (tenderId: number) => {
    setRakipYukleniyor(true);
    setRakipAnaliz(null);
    openModal();
    try {
      const res = await fetch(getApiUrl(`/contractors/tender/${tenderId}/ai-rakip-analiz`), {
        credentials: 'include',
      });
      const json = await res.json();
      if (json.success) {
        setRakipAnaliz(json.data);
      } else {
        setRakipAnaliz({ hata: json.error || 'Analiz yapılamadı' });
      }
    } catch (err) {
      setRakipAnaliz({ hata: err instanceof Error ? err.message : 'Bağlantı hatası' });
    } finally {
      setRakipYukleniyor(false);
    }
  }, [openModal]);

  if (!veri) return <Text c="dimmed">Veri bulunamadı.</Text>;

  const ihaleler = (veri.ihaleler as Array<Record<string, unknown>>) || [];
  const toplam = (veri.toplam as number) || ihaleler.length;

  if (ihaleler.length === 0) {
    return <Text c="dimmed">İhale geçmişi verisi henüz yok. Modülü çalıştırarak veri toplayabilirsiniz.</Text>;
  }

  return (
    <>
      <Stack gap="xs">
        <Text size="sm" c="dimmed" mb="xs">
          Toplam {toplam} ihale kaydı bulundu
        </Text>

        {ihaleler.slice(0, 30).map((ihale) => (
          <Paper key={`ihale-${ihale.tender_id || ihale.ihale_basligi || Math.random()}`} withBorder p="xs" radius="sm">
            <Group justify="space-between" wrap="nowrap">
              <div style={{ flex: 1, minWidth: 0 }}>
                <Text size="xs" fw={600} lineClamp={1}>
                  {(ihale.ihale_basligi as string) || (ihale.ihale_adi as string) || 'İsimsiz İhale'}
                </Text>
                <Group gap={4} mt={2}>
                  {ihale.kurum_adi && <Text size="xs" c="dimmed" lineClamp={1}>{ihale.kurum_adi as string}</Text>}
                  {ihale.sehir && <Badge size="xs" variant="light" color="blue">{ihale.sehir as string}</Badge>}
                  {ihale.rol && <Badge size="xs" variant="light" color={ihale.rol === 'yuklenici' ? 'green' : 'gray'}>{ihale.rol as string}</Badge>}
                  {ihale.durum && <Badge size="xs" variant="light" color={ihale.durum === 'tamamlandi' ? 'teal' : ihale.durum === 'iptal' ? 'red' : 'blue'}>{ihale.durum as string}</Badge>}
                </Group>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                {ihale.sozlesme_bedeli && (
                  <Text size="xs" fw={600} c="orange">{formatCurrency(ihale.sozlesme_bedeli as number)}</Text>
                )}
                {ihale.indirim_orani && (
                  <Text size="xs" c="teal">%{Number(ihale.indirim_orani).toFixed(1)} indirim</Text>
                )}
                {ihale.sozlesme_tarihi && (
                  <Text size="xs" c="dimmed">{new Date(ihale.sozlesme_tarihi as string).toLocaleDateString('tr-TR')}</Text>
                )}
                {ihale.tender_id && (
                  <Button
                    size="compact-xs"
                    variant="subtle"
                    color="violet"
                    mt={4}
                    leftSection={<IconUsers size={12} />}
                    onClick={(e) => {
                      e.stopPropagation();
                      fetchRakipAnaliz(ihale.tender_id as number);
                    }}
                  >
                    Rakip Analizi
                  </Button>
                )}
              </div>
            </Group>
          </Paper>
        ))}

        {ihaleler.length > 30 && (
          <Text size="xs" c="dimmed" ta="center">+{ihaleler.length - 30} daha...</Text>
        )}
      </Stack>

      {/* Rakip Analizi Modal */}
      <Modal
        opened={modalAcik}
        onClose={closeModal}
        title={
          <Group gap="xs">
            <IconRobot size={18} />
            <Text fw={600}>AI Rakip Analizi</Text>
          </Group>
        }
        size="lg"
      >
        {rakipYukleniyor ? (
          <Center py="xl">
            <Stack align="center" gap="xs">
              <Loader size="md" />
              <Text size="sm" c="dimmed">AI analiz yapıyor...</Text>
            </Stack>
          </Center>
        ) : rakipAnaliz?.hata ? (
          <Alert color="red" title="Hata">{String(rakipAnaliz.hata)}</Alert>
        ) : rakipAnaliz ? (
          <ScrollArea mah={500}>
            <Stack gap="sm">
              {rakipAnaliz.katilimcilar && (
                <div>
                  <Text size="sm" fw={600} mb="xs">Katılımcılar</Text>
                  {(rakipAnaliz.katilimcilar as Array<Record<string, unknown>>).map((k) => (
                    <Paper key={`rk-${k.yuklenici_id || k.unvan}`} withBorder p="xs" mb={4} radius="sm">
                      <Group justify="space-between">
                        <Text size="xs" fw={500}>{k.unvan as string}</Text>
                        <Group gap={4}>
                          {k.sozlesme_bedeli && <Text size="xs" c="orange">{formatCurrency(k.sozlesme_bedeli as number)}</Text>}
                          {k.indirim_orani && <Text size="xs" c="teal">%{Number(k.indirim_orani).toFixed(1)}</Text>}
                        </Group>
                      </Group>
                    </Paper>
                  ))}
                </div>
              )}
              {rakipAnaliz.aiAnaliz && (
                <div>
                  <Text size="sm" fw={600} mb="xs">AI Değerlendirmesi</Text>
                  <Paper withBorder p="sm" radius="sm" bg="gray.0">
                    <Text size="xs" style={{ whiteSpace: 'pre-wrap' }}>
                      {String(rakipAnaliz.aiAnaliz)}
                    </Text>
                  </Paper>
                </div>
              )}
              {rakipAnaliz.bolgeselRakipler && (
                <div>
                  <Text size="sm" fw={600} mb="xs">Bölgesel Rakipler</Text>
                  {(rakipAnaliz.bolgeselRakipler as Array<Record<string, unknown>>).map((r) => (
                    <Group key={`br-${r.yuklenici_id || r.unvan}`} justify="space-between" mb={2}>
                      <Text size="xs">{r.unvan as string}</Text>
                      <Badge size="xs" variant="light">{r.ihale_sayisi as number} ihale</Badge>
                    </Group>
                  ))}
                </div>
              )}
            </Stack>
          </ScrollArea>
        ) : null}
      </Modal>
    </>
  );
}
