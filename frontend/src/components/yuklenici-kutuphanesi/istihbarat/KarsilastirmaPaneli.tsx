'use client';

/**
 * Karşılaştırma Paneli — Yüklenici Kıyaslama Modu
 * ─────────────────────────────────────────────────
 * 2-5 arası yükleniciyi yan yana karşılaştırır:
 *  - Temel metrikler tablosu (sözleşme, kazanma oranı, indirim oranı)
 *  - Ortak katıldıkları ihaleler
 *  - Şehir dağılımı karşılaştırması
 *
 * Backend endpoint: GET /contractors/karsilastir?ids=1,2,3
 */

import {
  Alert,
  Badge,
  Card,
  Center,
  Group,
  Loader,
  Paper,
  ScrollArea,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  ThemeIcon,
} from '@mantine/core';
import {
  IconArrowsExchange,
  IconInfoCircle,
  IconMapPin,
  IconSearch,
  IconTrophy,
  IconX,
} from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';
import { getApiUrl } from '@/lib/config';
import { formatCurrency } from '@/types/yuklenici';
import type { Yuklenici } from '@/types/yuklenici';

interface Props {
  /** Mevcut yüklenici ID'si (karşılaştırmaya otomatik eklenir) */
  yukleniciId: number;
}

interface OrtakIhale {
  tender_id: number;
  ihale_basligi: string;
  sehir: string;
  kurum_adi: string;
  sozlesme_tarihi: string;
  katilimcilar: {
    yuklenici_id: number;
    unvan: string;
    rol: string;
    sozlesme_bedeli: number;
    indirim_orani: number;
    durum: string;
  }[];
}

interface SehirDagilimi {
  sehir: string;
  ihale_sayisi: number;
  toplam_bedel: number;
}

interface KarsilastirmaVerisi {
  yukleniciler: Yuklenici[];
  ortakIhaleler: OrtakIhale[];
  sehirDagilimi: Record<number, SehirDagilimi[]>;
  karsilastirma: {
    toplamSozlesme: { id: number; unvan: string; deger: number }[];
    kazanmaOrani: { id: number; unvan: string; deger: number }[];
    ihaleSayisi: { id: number; unvan: string; deger: number }[];
    ortIndirim: { id: number; unvan: string; deger: number }[];
  };
}

// Renk havuzu — karşılaştırma tablosunda her yükleniciye farklı renk
const RENKLER = ['blue', 'orange', 'teal', 'grape', 'red'];

export function KarsilastirmaPaneli({ yukleniciId }: Props) {
  const [arama, setArama] = useState('');
  const [aramaListesi, setAramaListesi] = useState<Yuklenici[]>([]);
  const [aramYukleniyor, setAramYukleniyor] = useState(false);
  const [secilenIdler, setSecilenIdler] = useState<number[]>([yukleniciId]);
  const [veri, setVeri] = useState<KarsilastirmaVerisi | null>(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  const mFetch = useCallback((url: string) => {
    return fetch(url, { credentials: 'include', headers: { 'Content-Type': 'application/json' } });
  }, []);

  // Yüklenici ara (seçim için)
  const araYuklenici = useCallback(async (q: string) => {
    if (q.length < 2) { setAramaListesi([]); return; }
    setAramYukleniyor(true);
    try {
      const res = await mFetch(getApiUrl(`/contractors?search=${encodeURIComponent(q)}&limit=10`));
      const json = await res.json();
      if (json.success) {
        setAramaListesi((json.data as Yuklenici[]).filter(y => !secilenIdler.includes(y.id)));
      }
    } catch { /* sessiz */ }
    finally { setAramYukleniyor(false); }
  }, [mFetch, secilenIdler]);

  // Arama input debounce
  useEffect(() => {
    const timer = setTimeout(() => araYuklenici(arama), 400);
    return () => clearTimeout(timer);
  }, [arama, araYuklenici]);

  // Karşılaştırma verisini çek
  const fetchKarsilastirma = useCallback(async () => {
    if (secilenIdler.length < 2) { setVeri(null); return; }
    setYukleniyor(true);
    setHata(null);
    try {
      const res = await mFetch(getApiUrl(`/contractors/karsilastir?ids=${secilenIdler.join(',')}`));
      const json = await res.json();
      if (json.success) {
        setVeri(json.data);
      } else {
        setHata(json.error);
      }
    } catch (err) {
      setHata(err instanceof Error ? err.message : 'Bağlantı hatası');
    } finally {
      setYukleniyor(false);
    }
  }, [secilenIdler, mFetch]);

  // ID'ler değişince karşılaştırmayı çek
  useEffect(() => {
    if (secilenIdler.length >= 2) fetchKarsilastirma();
  }, [secilenIdler, fetchKarsilastirma]);

  const ekle = (id: number) => {
    if (secilenIdler.length >= 5) return;
    setSecilenIdler(prev => [...prev, id]);
    setArama('');
    setAramaListesi([]);
  };

  const cikar = (id: number) => {
    // Ana yükleniciyi çıkarma
    if (id === yukleniciId) return;
    setSecilenIdler(prev => prev.filter(i => i !== id));
  };

  // En yüksek değeri bul (karşılaştırma tablosunda vurgulamak için)
  const enYuksek = (arr: { deger: number }[]) => {
    if (!arr.length) return 0;
    return Math.max(...arr.map(a => Number(a.deger) || 0));
  };

  return (
    <Stack gap="md">
      {/* Yüklenici Seçimi */}
      <Card withBorder p="sm">
        <Text size="sm" fw={600} mb="xs">Karşılaştırılacak Yüklenicileri Seçin (2-5 arası)</Text>

        {/* Seçilmiş yükleniciler */}
        <Group gap="xs" mb="sm">
          {secilenIdler.map((id, idx) => {
            const yk = veri?.yukleniciler.find(y => y.id === id);
            return (
              <Badge
                key={`sel-${id}`}
                size="lg"
                variant="light"
                color={RENKLER[idx % RENKLER.length]}
                rightSection={id !== yukleniciId ? (
                  <IconX size={12} style={{ cursor: 'pointer' }} onClick={() => cikar(id)} />
                ) : undefined}
              >
                {yk?.kisa_ad || yk?.unvan || `#${id}`}
              </Badge>
            );
          })}
        </Group>

        {/* Arama */}
        {secilenIdler.length < 5 && (
          <div style={{ position: 'relative' }}>
            <TextInput
              placeholder="Yüklenici adı ile ara..."
              leftSection={<IconSearch size={14} />}
              rightSection={aramYukleniyor ? <Loader size={14} /> : undefined}
              value={arama}
              onChange={(e) => setArama(e.currentTarget.value)}
              size="xs"
            />
            {aramaListesi.length > 0 && (
              <Paper
                withBorder
                shadow="md"
                p={0}
                style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, maxHeight: 200, overflow: 'auto' }}
              >
                {aramaListesi.map(y => (
                  <Group
                    key={`srch-${y.id}`}
                    p="xs"
                    gap="xs"
                    style={{ cursor: 'pointer', borderBottom: '1px solid var(--mantine-color-gray-2)' }}
                    onClick={() => ekle(y.id)}
                  >
                    <Text size="xs" fw={500}>{y.kisa_ad || y.unvan}</Text>
                    <Text size="xs" c="dimmed">{y.aktif_sehirler?.[0] || ''}</Text>
                  </Group>
                ))}
              </Paper>
            )}
          </div>
        )}
      </Card>

      {/* Yükleme / Hata / Yetersiz Seçim */}
      {secilenIdler.length < 2 && (
        <Alert icon={<IconInfoCircle size={16} />} color="gray" variant="light" title="Seçim Gerekli">
          Karşılaştırma için en az 2 yüklenici seçin. Arama kutusundan yeni yüklenici ekleyebilirsiniz.
        </Alert>
      )}

      {yukleniyor && <Center py="xl"><Loader size="md" /></Center>}

      {hata && <Alert color="red" title="Hata">{hata}</Alert>}

      {/* Karşılaştırma Sonuçları */}
      {veri && !yukleniyor && (
        <>
          {/* Metrik Tablosu */}
          <Card withBorder p="sm">
            <Group gap="xs" mb="sm">
              <ThemeIcon size="sm" variant="light" color="blue" radius="md">
                <IconArrowsExchange size={14} />
              </ThemeIcon>
              <Text size="sm" fw={600}>Temel Metrikler Karşılaştırması</Text>
            </Group>
            <ScrollArea>
              <Table striped withTableBorder withColumnBorders>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Metrik</Table.Th>
                    {veri.yukleniciler.map((yk, idx) => (
                      <Table.Th key={`th-${yk.id}`}>
                        <Text size="xs" fw={600} c={RENKLER[idx % RENKLER.length]}>{yk.kisa_ad || yk.unvan}</Text>
                      </Table.Th>
                    ))}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {/* Toplam Sözleşme */}
                  <Table.Tr>
                    <Table.Td><Text size="xs" fw={500}>Toplam Sözleşme</Text></Table.Td>
                    {veri.karsilastirma.toplamSozlesme.map((item) => {
                      const max = enYuksek(veri.karsilastirma.toplamSozlesme);
                      return (
                        <Table.Td key={`ts-${item.id}`}>
                          <Text size="xs" fw={Number(item.deger) === max ? 700 : 400} c={Number(item.deger) === max ? 'orange' : undefined}>
                            {formatCurrency(item.deger)}
                          </Text>
                        </Table.Td>
                      );
                    })}
                  </Table.Tr>
                  {/* Kazanma Oranı */}
                  <Table.Tr>
                    <Table.Td><Text size="xs" fw={500}>Kazanma Oranı</Text></Table.Td>
                    {veri.karsilastirma.kazanmaOrani.map((item) => {
                      const max = enYuksek(veri.karsilastirma.kazanmaOrani);
                      return (
                        <Table.Td key={`ko-${item.id}`}>
                          <Text size="xs" fw={Number(item.deger) === max ? 700 : 400} c={Number(item.deger) === max ? 'green' : undefined}>
                            %{Number(item.deger || 0).toFixed(1)}
                          </Text>
                        </Table.Td>
                      );
                    })}
                  </Table.Tr>
                  {/* İhale Sayısı */}
                  <Table.Tr>
                    <Table.Td><Text size="xs" fw={500}>İhale Sayısı</Text></Table.Td>
                    {veri.karsilastirma.ihaleSayisi.map((item) => {
                      const max = enYuksek(veri.karsilastirma.ihaleSayisi);
                      return (
                        <Table.Td key={`is-${item.id}`}>
                          <Text size="xs" fw={Number(item.deger) === max ? 700 : 400} c={Number(item.deger) === max ? 'blue' : undefined}>
                            {item.deger}
                          </Text>
                        </Table.Td>
                      );
                    })}
                  </Table.Tr>
                  {/* Ortalama İndirim */}
                  <Table.Tr>
                    <Table.Td><Text size="xs" fw={500}>Ort. İndirim</Text></Table.Td>
                    {veri.karsilastirma.ortIndirim.map((item) => {
                      const max = enYuksek(veri.karsilastirma.ortIndirim);
                      return (
                        <Table.Td key={`oi-${item.id}`}>
                          <Text size="xs" fw={Number(item.deger) === max ? 700 : 400} c={Number(item.deger) === max ? 'teal' : undefined}>
                            %{Number(item.deger || 0).toFixed(1)}
                          </Text>
                        </Table.Td>
                      );
                    })}
                  </Table.Tr>
                </Table.Tbody>
              </Table>
            </ScrollArea>
          </Card>

          {/* Ortak İhaleler */}
          {veri.ortakIhaleler.length > 0 && (
            <Card withBorder p="sm">
              <Group gap="xs" mb="sm">
                <ThemeIcon size="sm" variant="light" color="green" radius="md">
                  <IconTrophy size={14} />
                </ThemeIcon>
                <Text size="sm" fw={600}>Ortak Katıldıkları İhaleler ({veri.ortakIhaleler.length})</Text>
              </Group>
              <Stack gap="xs">
                {veri.ortakIhaleler.slice(0, 20).map((ihale) => (
                  <Paper key={`oi-${ihale.tender_id}`} withBorder p="xs" radius="sm">
                    <Text size="xs" fw={600} lineClamp={1}>{ihale.ihale_basligi}</Text>
                    <Group gap={4} mt={2}>
                      {ihale.sehir && <Badge size="xs" variant="light" color="blue">{ihale.sehir}</Badge>}
                      {ihale.kurum_adi && <Text size="xs" c="dimmed" lineClamp={1}>{ihale.kurum_adi}</Text>}
                    </Group>
                    <Group gap="md" mt={4}>
                      {ihale.katilimcilar.map((k) => (
                        <Group key={`k-${k.yuklenici_id}-${ihale.tender_id}`} gap={4}>
                          <Badge size="xs" variant="dot" color={RENKLER[veri.yukleniciler.findIndex(y => y.id === k.yuklenici_id) % RENKLER.length]}>
                            {k.unvan?.substring(0, 25)}
                          </Badge>
                          {k.sozlesme_bedeli > 0 && <Text size="xs" c="orange">{formatCurrency(k.sozlesme_bedeli)}</Text>}
                          {k.indirim_orani > 0 && <Text size="xs" c="teal">%{Number(k.indirim_orani).toFixed(1)}</Text>}
                        </Group>
                      ))}
                    </Group>
                  </Paper>
                ))}
              </Stack>
            </Card>
          )}

          {/* Şehir Dağılımı */}
          {Object.keys(veri.sehirDagilimi).length > 0 && (
            <Card withBorder p="sm">
              <Group gap="xs" mb="sm">
                <ThemeIcon size="sm" variant="light" color="violet" radius="md">
                  <IconMapPin size={14} />
                </ThemeIcon>
                <Text size="sm" fw={600}>Şehir Dağılımı Karşılaştırması</Text>
              </Group>
              <SimpleGrid cols={{ base: 1, sm: Math.min(veri.yukleniciler.length, 3) }} spacing="sm">
                {veri.yukleniciler.map((yk, idx) => {
                  const sehirler = veri.sehirDagilimi[yk.id] || [];
                  return (
                    <Card key={`sd-${yk.id}`} withBorder p="xs" radius="sm">
                      <Text size="xs" fw={600} c={RENKLER[idx % RENKLER.length]} mb="xs">
                        {yk.kisa_ad || yk.unvan}
                      </Text>
                      {sehirler.length === 0 ? (
                        <Text size="xs" c="dimmed">Şehir verisi yok</Text>
                      ) : (
                        <Stack gap={2}>
                          {sehirler.slice(0, 8).map((s) => (
                            <Group key={`s-${yk.id}-${s.sehir}`} justify="space-between">
                              <Text size="xs">{s.sehir}</Text>
                              <Group gap={4}>
                                <Badge size="xs" variant="light">{s.ihale_sayisi}</Badge>
                                <Text size="xs" c="orange">{formatCurrency(s.toplam_bedel)}</Text>
                              </Group>
                            </Group>
                          ))}
                        </Stack>
                      )}
                    </Card>
                  );
                })}
              </SimpleGrid>
            </Card>
          )}
        </>
      )}
    </Stack>
  );
}
