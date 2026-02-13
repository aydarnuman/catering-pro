'use client';

import { ActionIcon, Select, Table, Text, TextInput } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconPlus } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { menuPlanlamaAPI } from '@/lib/api/services/menu-planlama';
import type { GramajNewRowProps, UrunKartiOption } from './types';

export const GramajNewRow = ({ sartnameId, onAdd }: GramajNewRowProps) => {
  const [searchValue, setSearchValue] = useState('');
  const [selectedUrun, setSelectedUrun] = useState<UrunKartiOption | null>(null);
  const [miktar, setMiktar] = useState('');
  const [birim, setBirim] = useState('g');
  const [debouncedSearch] = useDebouncedValue(searchValue, 300);

  // Ürün kartlarını API'den ara
  const { data: urunler = [] } = useQuery<UrunKartiOption[]>({
    queryKey: ['urun-kartlari-arama', debouncedSearch],
    queryFn: async () => {
      if (!debouncedSearch || debouncedSearch.length < 2) return [];
      const res = await menuPlanlamaAPI.getStokKartlariListesi(debouncedSearch);
      return res.success ? (res.data as UrunKartiOption[]) : [];
    },
    enabled: debouncedSearch.length >= 2,
  });

  const handleSelectUrun = (urunId: string | null) => {
    if (!urunId) {
      setSelectedUrun(null);
      return;
    }
    const urun = urunler.find((u) => u.id.toString() === urunId);
    if (urun) {
      setSelectedUrun(urun);
      setSearchValue(urun.ad);
      // Birim otomatik ayarla
      if (urun.birim) {
        const normalizedBirim = urun.birim.toLowerCase();
        if (['kg', 'g', 'gr'].includes(normalizedBirim)) setBirim('g');
        else if (['l', 'lt', 'ml'].includes(normalizedBirim)) setBirim('ml');
        else if (['adet', 'ad'].includes(normalizedBirim)) setBirim('adet');
      }
    }
  };

  const handleAdd = () => {
    const numMiktar = parseFloat(miktar);
    const malzemeAdi = selectedUrun?.ad || searchValue.trim();
    if (malzemeAdi && !Number.isNaN(numMiktar) && numMiktar > 0) {
      onAdd(sartnameId, malzemeAdi, numMiktar, birim, selectedUrun?.son_alis_fiyat);
      setSearchValue('');
      setSelectedUrun(null);
      setMiktar('');
      setBirim('g');
    }
  };

  return (
    <Table.Tr style={{ background: 'var(--mantine-color-dark-7)' }}>
      <Table.Td>
        <Select
          size="xs"
          variant="unstyled"
          placeholder="+ Ürün ara..."
          searchable
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          value={selectedUrun?.id.toString() || null}
          onChange={handleSelectUrun}
          data={urunler.map((u) => ({
            value: u.id.toString(),
            label: `${u.ad}${u.son_alis_fiyat ? ` • ₺${Number(u.son_alis_fiyat).toFixed(2)}` : ''}`,
          }))}
          nothingFoundMessage={debouncedSearch.length >= 2 ? 'Ürün bulunamadı' : 'En az 2 karakter yazın'}
          comboboxProps={{ withinPortal: true }}
          clearable
        />
      </Table.Td>
      <Table.Td>
        <TextInput
          size="xs"
          variant="unstyled"
          value={miktar}
          onChange={(e) => setMiktar(e.target.value)}
          placeholder="0"
          ta="center"
          styles={{ input: { textAlign: 'center' } }}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
      </Table.Td>
      <Table.Td>
        <Select
          size="xs"
          variant="unstyled"
          value={birim}
          onChange={(v) => setBirim(v || 'g')}
          data={['g', 'kg', 'ml', 'L', 'adet']}
          comboboxProps={{ withinPortal: true }}
          styles={{ input: { textAlign: 'center' } }}
        />
      </Table.Td>
      <Table.Td ta="right">
        {selectedUrun?.son_alis_fiyat ? (
          <Text size="xs" c="dimmed">
            ₺{Number(selectedUrun.son_alis_fiyat).toFixed(2)}/kg
          </Text>
        ) : (
          <Text size="xs" c="dimmed">
            -
          </Text>
        )}
      </Table.Td>
      <Table.Td>
        <ActionIcon
          size="xs"
          variant="light"
          color="teal"
          onClick={handleAdd}
          disabled={!(selectedUrun?.ad || searchValue.trim()) || !miktar}
        >
          <IconPlus size={14} />
        </ActionIcon>
      </Table.Td>
    </Table.Tr>
  );
};
