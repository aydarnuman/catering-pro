import { Badge, Group, Stack, Text } from '@mantine/core';
import type { AnalysisData } from '../../../../types';
import { getTeknikSartText } from '../helpers';
import { DataRow, EmptyTab, OgunSection, SectionBlock, ServisSaatleriSection } from '../shared';

export function TeknikTabExpanded({ data }: { data?: AnalysisData }) {
  if (!data) return <EmptyTab />;

  const hasTeknik = !!data.teknik_sartlar?.length;
  const hasEkipman = !!data.ekipman_listesi;
  const hasKalite = !!data.kalite_standartlari;
  const hasOgun = !!data.ogun_bilgileri?.length;
  const hasServis = !!(data.servis_saatleri?.kahvalti || data.servis_saatleri?.ogle || data.servis_saatleri?.aksam);
  const hasSure = !!(data.sure || data.teslim_suresi);

  if (!hasTeknik && !hasEkipman && !hasKalite && !hasOgun && !hasServis && !hasSure) {
    return <EmptyTab message="Teknik veri bulunamadi" />;
  }

  return (
    <Stack gap="lg">
      {hasTeknik && (
        <SectionBlock title="Teknik Sartlar" count={data.teknik_sartlar?.length}>
          <Stack gap={6}>
            {(data.teknik_sartlar ?? []).map((item, idx) => {
              const text = getTeknikSartText(item);
              if (!text) return null;
              const isZorunlu = text.toLowerCase().includes('zorunlu');
              return (
                <Group key={`ts-${text.slice(0, 60)}`} gap="xs" wrap="nowrap" align="flex-start">
                  <Text size="xs" c="dimmed" w={24} ta="right" style={{ flexShrink: 0 }}>
                    {idx + 1}.
                  </Text>
                  <Text size="xs" c="gray.3" style={{ lineHeight: 1.6, flex: 1 }}>
                    {text}
                  </Text>
                  {isZorunlu && (
                    <Badge size="xs" variant="light" color="red" style={{ flexShrink: 0 }}>
                      Zorunlu
                    </Badge>
                  )}
                </Group>
              );
            })}
          </Stack>
        </SectionBlock>
      )}

      {(hasEkipman || hasKalite) && (
        <SectionBlock title="Ekipman & Kalite">
          <Stack gap={8}>
            {hasEkipman && <DataRow label="Ekipman Listesi" value={data.ekipman_listesi ?? ''} />}
            {hasKalite && <DataRow label="Kalite Standartlari" value={data.kalite_standartlari ?? ''} />}
          </Stack>
        </SectionBlock>
      )}

      {hasOgun && <OgunSection data={data} />}
      {hasServis && <ServisSaatleriSection data={data} />}

      {hasSure && (
        <SectionBlock title="Sure / Teslim">
          <DataRow label="Sure" value={data.sure || data.teslim_suresi || ''} />
        </SectionBlock>
      )}
    </Stack>
  );
}
