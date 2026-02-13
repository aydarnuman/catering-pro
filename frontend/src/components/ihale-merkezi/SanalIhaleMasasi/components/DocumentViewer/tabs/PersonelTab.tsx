import { Stack, Table, Text } from '@mantine/core';
import type { AnalysisData } from '../../../../types';
import { DARK_TABLE_STYLES } from '../helpers';
import { DataRow, EmptyTab, OgunSection, SectionBlock, ServisSaatleriSection } from '../shared';

export function PersonelTabExpanded({ data }: { data?: AnalysisData }) {
  if (!data) return <EmptyTab />;

  const hasPersonel = !!data.personel_detaylari?.length;
  const hasKisiSayisi = !!data.kisi_sayisi;
  const hasOgun = !!data.ogun_bilgileri?.length;
  const hasServis = !!(data.servis_saatleri?.kahvalti || data.servis_saatleri?.ogle || data.servis_saatleri?.aksam);
  const hasIsYerleri = !!data.is_yerleri?.length;
  const hasKurallar = !!data.operasyonel_kurallar?.personel_kurallari?.length;

  if (!hasPersonel && !hasKisiSayisi && !hasOgun && !hasIsYerleri) {
    return <EmptyTab message="Personel verisi bulunamadi" />;
  }

  const personelFiltered = data.personel_detaylari?.filter((p) => p.adet > 0) ?? [];
  const toplamPersonel = personelFiltered.reduce((s, p) => s + p.adet, 0);

  return (
    <Stack gap="lg">
      {(personelFiltered.length > 0 || hasKisiSayisi) && (
        <SectionBlock
          title="Personel Gereksinimleri"
          count={personelFiltered.length || undefined}
          badge={
            toplamPersonel > 0
              ? `Toplam: ${toplamPersonel} kisi`
              : data.kisi_sayisi
                ? String(data.kisi_sayisi)
                : undefined
          }
        >
          {personelFiltered.length > 0 ? (
            <Table withTableBorder withColumnBorders highlightOnHover styles={DARK_TABLE_STYLES}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Pozisyon</Table.Th>
                  <Table.Th ta="center">Adet</Table.Th>
                  <Table.Th>Ucret Orani</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {personelFiltered.map((p) => (
                  <Table.Tr key={`${p.pozisyon}-${p.adet}`}>
                    <Table.Td>{p.pozisyon}</Table.Td>
                    <Table.Td ta="center">{p.adet}</Table.Td>
                    <Table.Td>{p.ucret_orani || '—'}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          ) : (
            <DataRow label="Kisi Sayisi" value={data.kisi_sayisi != null ? String(data.kisi_sayisi) : ''} />
          )}
        </SectionBlock>
      )}

      {hasOgun && <OgunSection data={data} />}
      {hasServis && <ServisSaatleriSection data={data} />}

      {hasIsYerleri && (
        <SectionBlock title="Is Yerleri" count={data.is_yerleri?.length}>
          <Stack gap={4}>
            {(data.is_yerleri ?? []).map((yer, idx) => (
              <Text key={yer} size="xs" c="gray.3" style={{ lineHeight: 1.5 }}>
                {idx + 1}. {yer}
              </Text>
            ))}
          </Stack>
        </SectionBlock>
      )}

      {hasKurallar && (
        <SectionBlock title="Personel Kurallari" count={data.operasyonel_kurallar?.personel_kurallari?.length}>
          <Stack gap={4}>
            {(data.operasyonel_kurallar?.personel_kurallari ?? []).map((kural) => (
              <Text key={kural.slice(0, 80)} size="xs" c="gray.3" style={{ lineHeight: 1.5 }}>
                {kural}
              </Text>
            ))}
          </Stack>
        </SectionBlock>
      )}
    </Stack>
  );
}
