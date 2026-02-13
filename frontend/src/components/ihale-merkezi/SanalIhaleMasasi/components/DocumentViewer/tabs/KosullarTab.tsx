import { Badge, Box, Group, Stack, Text } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import type { AnalysisData } from '../../../../types';
import { getBelgeInfo, getCezaText, getNotText } from '../helpers';
import { DataRow, EmptyTab, SectionBlock } from '../shared';

export function KosullarTabExpanded({ data }: { data?: AnalysisData }) {
  if (!data) return <EmptyTab />;

  const hasGenel = !!(data.ihale_usulu || data.ihale_turu || data.teklif_turu || data.sinir_deger_katsayisi);
  const hasBenzerIs = !!data.benzer_is_tanimi;
  const hasCeza = !!data.ceza_kosullari?.length;
  const hasBelge = !!data.gerekli_belgeler?.length;
  const hasIsArtisi = !!data.is_artisi?.oran;
  const hasOp = !!(
    data.operasyonel_kurallar?.alt_yuklenici ||
    data.operasyonel_kurallar?.muayene_kabul ||
    data.operasyonel_kurallar?.denetim
  );
  const hasEksik = !!data.eksik_bilgiler?.length;
  const hasNotlar = !!data.onemli_notlar?.length;
  const hasYemekKural = !!data.operasyonel_kurallar?.yemek_kurallari?.length;

  if (!hasGenel && !hasCeza && !hasBelge && !hasEksik && !hasNotlar) {
    return <EmptyTab message="Kosul verisi bulunamadi" />;
  }

  return (
    <Stack gap="lg">
      {hasGenel && (
        <SectionBlock title="Genel Ihale Bilgileri">
          <Stack gap={6}>
            {data.ihale_usulu && <DataRow label="Ihale Usulu" value={data.ihale_usulu} />}
            {data.ihale_turu && <DataRow label="Ihale Turu" value={data.ihale_turu} />}
            {data.teklif_turu && <DataRow label="Teklif Turu" value={data.teklif_turu} />}
            {data.sinir_deger_katsayisi && <DataRow label="Sinir Deger Katsayisi" value={data.sinir_deger_katsayisi} />}
          </Stack>
        </SectionBlock>
      )}

      {hasBenzerIs && (
        <SectionBlock title="Benzer Is Tanimi">
          <Text size="xs" c="gray.3" style={{ lineHeight: 1.6 }}>
            {data.benzer_is_tanimi}
          </Text>
        </SectionBlock>
      )}

      {hasCeza && (
        <SectionBlock title="Ceza Kosullari" count={data.ceza_kosullari?.length}>
          <Stack gap={6}>
            {(data.ceza_kosullari ?? []).map((item) => {
              const text = getCezaText(item);
              if (!text) return null;
              return (
                <Group key={`ceza-${text.slice(0, 60)}`} gap="xs" wrap="nowrap" align="flex-start">
                  <IconAlertTriangle size={14} color="rgba(244,63,94,0.7)" style={{ flexShrink: 0, marginTop: 2 }} />
                  <Text size="xs" c="gray.3" style={{ lineHeight: 1.6 }}>
                    {text}
                  </Text>
                </Group>
              );
            })}
          </Stack>
        </SectionBlock>
      )}

      {hasBelge && (
        <SectionBlock title="Gerekli Belgeler" count={data.gerekli_belgeler?.length}>
          <Stack gap={4}>
            {(data.gerekli_belgeler ?? []).map((item) => {
              const belge = getBelgeInfo(item);
              if (!belge.text) return null;
              return (
                <Group key={`belge-${belge.text.slice(0, 60)}`} gap="xs" wrap="nowrap">
                  <Badge size="xs" variant="light" color={belge.zorunlu ? 'red' : 'gray'} style={{ flexShrink: 0 }}>
                    {belge.zorunlu ? 'Zorunlu' : 'Opsiyonel'}
                  </Badge>
                  <Text size="xs" c="gray.3" style={{ lineHeight: 1.5 }}>
                    {belge.text}
                  </Text>
                </Group>
              );
            })}
          </Stack>
        </SectionBlock>
      )}

      {hasIsArtisi && (
        <SectionBlock title="Is Artisi">
          <Stack gap={6}>
            <DataRow label="Oran" value={data.is_artisi?.oran ?? ''} />
            {data.is_artisi?.kosullar && <DataRow label="Kosullar" value={data.is_artisi.kosullar} />}
            {data.is_artisi?.is_eksilisi && <DataRow label="Is Eksilisi" value={data.is_artisi.is_eksilisi} />}
          </Stack>
        </SectionBlock>
      )}

      {hasOp && (
        <SectionBlock title="Operasyonel Kurallar">
          <Stack gap={6}>
            {data.operasyonel_kurallar?.alt_yuklenici && (
              <DataRow label="Alt Yuklenici" value={data.operasyonel_kurallar.alt_yuklenici} />
            )}
            {data.operasyonel_kurallar?.muayene_kabul && (
              <DataRow label="Muayene & Kabul" value={data.operasyonel_kurallar.muayene_kabul} />
            )}
            {data.operasyonel_kurallar?.denetim && (
              <DataRow label="Denetim" value={data.operasyonel_kurallar.denetim} />
            )}
          </Stack>
        </SectionBlock>
      )}

      {hasYemekKural && (
        <SectionBlock title="Yemek Kurallari" count={data.operasyonel_kurallar?.yemek_kurallari?.length}>
          <Stack gap={4}>
            {(data.operasyonel_kurallar?.yemek_kurallari ?? []).map((kural) => (
              <Text key={kural.slice(0, 80)} size="xs" c="gray.3" style={{ lineHeight: 1.5 }}>
                {kural}
              </Text>
            ))}
          </Stack>
        </SectionBlock>
      )}

      {hasEksik && (
        <SectionBlock title="Eksik Bilgiler" count={data.eksik_bilgiler?.length}>
          <Box
            p="sm"
            style={{
              background: 'rgba(244, 63, 94, 0.06)',
              borderRadius: 8,
              border: '1px solid rgba(244, 63, 94, 0.15)',
            }}
          >
            <Stack gap={4}>
              {(data.eksik_bilgiler ?? []).map((e) => (
                <Group key={e.slice(0, 80)} gap="xs" wrap="nowrap">
                  <IconAlertTriangle size={12} color="rgba(244,63,94,0.8)" style={{ flexShrink: 0 }} />
                  <Text size="xs" c="red.3" style={{ lineHeight: 1.5 }}>
                    {e}
                  </Text>
                </Group>
              ))}
            </Stack>
          </Box>
        </SectionBlock>
      )}

      {hasNotlar && (
        <SectionBlock title="Onemli Notlar" count={data.onemli_notlar?.length}>
          <Stack gap={6}>
            {(data.onemli_notlar ?? []).map((item) => {
              const not = getNotText(item);
              if (!not.text) return null;
              const turColor =
                not.tur === 'uyari' ? 'yellow' : not.tur === 'kritik' || not.tur === 'gereklilik' ? 'red' : 'gray';
              return (
                <Group key={`not-${not.text.slice(0, 60)}`} gap="xs" wrap="nowrap" align="flex-start">
                  {not.tur && (
                    <Badge size="xs" variant="light" color={turColor} style={{ flexShrink: 0 }}>
                      {not.tur}
                    </Badge>
                  )}
                  <Text size="xs" c="gray.3" style={{ lineHeight: 1.6, flex: 1 }}>
                    {not.text}
                  </Text>
                </Group>
              );
            })}
          </Stack>
        </SectionBlock>
      )}
    </Stack>
  );
}
