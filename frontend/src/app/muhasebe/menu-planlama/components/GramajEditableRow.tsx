'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ActionIcon, Select, Table, Text, TextInput } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconX } from '@tabler/icons-react';
import type { GramajEditableRowProps } from './types';

export const GramajEditableRow = ({
  gramaj,
  sartnameId,
  onUpdate,
  onDelete,
}: GramajEditableRowProps) => {
  const [malzeme, setMalzeme] = useState(gramaj.yemek_turu || '');
  const [miktar, setMiktar] = useState(gramaj.porsiyon_gramaj?.toString() || '');
  const [birim, setBirim] = useState(gramaj.birim || 'g');
  const [debouncedMalzeme] = useDebouncedValue(malzeme, 2000);
  const [debouncedMiktar] = useDebouncedValue(miktar, 2000);
  const [debouncedBirim] = useDebouncedValue(birim, 2000);
  const initialRef = useRef({
    malzeme: gramaj.yemek_turu,
    miktar: gramaj.porsiyon_gramaj?.toString(),
    birim: gramaj.birim,
  });

  // Debounce sonrası otomatik kaydet
  useEffect(() => {
    const hasChanged =
      debouncedMalzeme !== initialRef.current.malzeme ||
      debouncedMiktar !== initialRef.current.miktar ||
      debouncedBirim !== initialRef.current.birim;

    if (hasChanged && debouncedMalzeme && debouncedMiktar) {
      const numMiktar = parseFloat(debouncedMiktar);
      if (!Number.isNaN(numMiktar) && numMiktar > 0) {
        onUpdate(gramaj.id, sartnameId, {
          yemek_turu: debouncedMalzeme,
          porsiyon_gramaj: numMiktar,
          birim: debouncedBirim,
        });
        initialRef.current = {
          malzeme: debouncedMalzeme,
          miktar: debouncedMiktar,
          birim: debouncedBirim,
        };
      }
    }
  }, [debouncedMalzeme, debouncedMiktar, debouncedBirim, gramaj.id, sartnameId, onUpdate]);

  // Fiyat hesapla (gramaj × birim fiyat / 1000 eğer birim gram ise)
  const hesaplananFiyat = useMemo(() => {
    if (!gramaj.birim_fiyat || !gramaj.porsiyon_gramaj) return null;
    const carpan = birim === 'kg' || birim === 'L' ? 1 : 0.001; // g ve ml için 1000'e böl
    return gramaj.porsiyon_gramaj * gramaj.birim_fiyat * carpan;
  }, [gramaj.birim_fiyat, gramaj.porsiyon_gramaj, birim]);

  return (
    <Table.Tr>
      <Table.Td>
        <TextInput
          size="xs"
          variant="unstyled"
          value={malzeme}
          onChange={(e) => setMalzeme(e.target.value)}
          placeholder="Malzeme adı..."
          styles={{ input: { fontWeight: 500 } }}
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
          styles={{ input: { textAlign: 'center', fontWeight: 600 } }}
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
        {hesaplananFiyat ? (
          <Text size="xs" c="teal" fw={500}>
            ₺{hesaplananFiyat.toFixed(2)}
          </Text>
        ) : gramaj.birim_fiyat ? (
          <Text size="xs" c="dimmed">
            ₺{gramaj.birim_fiyat.toFixed(2)}/kg
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
          variant="subtle"
          color="red"
          onClick={() => onDelete(gramaj.id, sartnameId)}
        >
          <IconX size={14} />
        </ActionIcon>
      </Table.Td>
    </Table.Tr>
  );
};
