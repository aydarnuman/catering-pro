import { Stack, Table } from '@mantine/core';
import type { AnalysisData } from '../../../../types';
import { DARK_TABLE_STYLES, isMaliKriterValid } from '../helpers';
import { DataRow, EmptyTab, SectionBlock } from '../shared';

export function MaliTabExpanded({ data }: { data?: AnalysisData }) {
  if (!data) return <EmptyTab />;

  const hasBedel = !!data.tahmini_bedel;
  const hasIscilik = !!data.iscilik_orani;
  const hasBirimFiyat = !!data.birim_fiyatlar?.length;
  const hasMali = !!(
    isMaliKriterValid(data.mali_kriterler?.cari_oran) ||
    isMaliKriterValid(data.mali_kriterler?.ozkaynak_orani) ||
    isMaliKriterValid(data.mali_kriterler?.is_deneyimi) ||
    isMaliKriterValid(data.mali_kriterler?.ciro_orani)
  );
  const hasTeminat = !!(
    data.teminat_oranlari?.gecici ||
    data.teminat_oranlari?.kesin ||
    data.teminat_oranlari?.ek_kesin
  );
  const hasOdeme = !!(
    data.odeme_kosullari?.odeme_suresi ||
    data.odeme_kosullari?.avans ||
    data.odeme_kosullari?.odeme_periyodu
  );
  const hasFiyatFarki = !!data.fiyat_farki?.formul;

  if (!hasBedel && !hasBirimFiyat && !hasMali && !hasTeminat && !hasOdeme) {
    return <EmptyTab message="Mali veri bulunamadi" />;
  }

  return (
    <Stack gap="lg">
      {(hasBedel || hasIscilik) && (
        <SectionBlock title="Genel Mali Bilgiler">
          <Stack gap={8}>
            {hasBedel && <DataRow label="Tahmini Bedel" value={data.tahmini_bedel ?? ''} highlight />}
            {hasIscilik && <DataRow label="Iscilik Orani" value={data.iscilik_orani ?? ''} />}
          </Stack>
        </SectionBlock>
      )}

      {hasBirimFiyat && (
        <SectionBlock title="Birim Fiyat Cetveli" count={data.birim_fiyatlar?.length}>
          <Table withTableBorder withColumnBorders highlightOnHover styles={DARK_TABLE_STYLES}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>#</Table.Th>
                <Table.Th>Kalem</Table.Th>
                <Table.Th>Birim</Table.Th>
                <Table.Th ta="right">Miktar</Table.Th>
                <Table.Th ta="right">Fiyat</Table.Th>
                <Table.Th ta="right">Tutar</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {(data.birim_fiyatlar ?? []).map((bf, idx) => {
                const kalem = bf.kalem || bf.aciklama || bf.text || '—';
                return (
                  <Table.Tr key={`bf-${kalem}-${bf.birim || ''}-${bf.miktar ?? ''}`}>
                    <Table.Td>{idx + 1}</Table.Td>
                    <Table.Td style={{ maxWidth: 240, wordBreak: 'break-word' }}>{kalem}</Table.Td>
                    <Table.Td>{bf.birim || '—'}</Table.Td>
                    <Table.Td ta="right">{bf.miktar ?? '—'}</Table.Td>
                    <Table.Td ta="right">{bf.fiyat ?? '—'}</Table.Td>
                    <Table.Td ta="right">{bf.tutar ?? '—'}</Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </SectionBlock>
      )}

      {hasMali && (
        <SectionBlock title="Mali Yeterlilik Kriterleri">
          <Stack gap={6}>
            {isMaliKriterValid(data.mali_kriterler?.cari_oran) && (
              <DataRow label="Cari Oran" value={data.mali_kriterler?.cari_oran ?? ''} />
            )}
            {isMaliKriterValid(data.mali_kriterler?.ozkaynak_orani) && (
              <DataRow label="Ozkaynak Orani" value={data.mali_kriterler?.ozkaynak_orani ?? ''} />
            )}
            {isMaliKriterValid(data.mali_kriterler?.is_deneyimi) && (
              <DataRow label="Is Deneyimi" value={data.mali_kriterler?.is_deneyimi ?? ''} />
            )}
            {isMaliKriterValid(data.mali_kriterler?.ciro_orani) && (
              <DataRow label="Ciro Orani" value={data.mali_kriterler?.ciro_orani ?? ''} />
            )}
          </Stack>
        </SectionBlock>
      )}

      {hasTeminat && (
        <SectionBlock title="Teminat Oranlari">
          <Stack gap={6}>
            {data.teminat_oranlari?.gecici && <DataRow label="Gecici Teminat" value={data.teminat_oranlari.gecici} />}
            {data.teminat_oranlari?.kesin && <DataRow label="Kesin Teminat" value={data.teminat_oranlari.kesin} />}
            {data.teminat_oranlari?.ek_kesin && (
              <DataRow label="Ek Kesin Teminat" value={data.teminat_oranlari.ek_kesin} />
            )}
          </Stack>
        </SectionBlock>
      )}

      {hasOdeme && (
        <SectionBlock title="Odeme Kosullari">
          <Stack gap={6}>
            {data.odeme_kosullari?.odeme_suresi && (
              <DataRow label="Odeme Suresi" value={data.odeme_kosullari.odeme_suresi} />
            )}
            {data.odeme_kosullari?.avans && <DataRow label="Avans" value={data.odeme_kosullari.avans} />}
            {data.odeme_kosullari?.odeme_periyodu && (
              <DataRow label="Periyot" value={data.odeme_kosullari.odeme_periyodu} />
            )}
            {data.odeme_kosullari?.hakedis_suresi && (
              <DataRow label="Hakedis Suresi" value={data.odeme_kosullari.hakedis_suresi} />
            )}
          </Stack>
        </SectionBlock>
      )}

      {hasFiyatFarki && (
        <SectionBlock title="Fiyat Farki">
          <DataRow label="Formul" value={data.fiyat_farki?.formul ?? ''} />
        </SectionBlock>
      )}
    </Stack>
  );
}
