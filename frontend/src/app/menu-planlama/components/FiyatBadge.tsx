'use client';

import { Badge, Group, Text } from '@mantine/core';

// Fiyat Badge Komponenti
export const FiyatBadge = ({
  fatura,
  piyasa,
  faturaGuncel = true,
  piyasaGuncel = true,
}: {
  fatura?: number;
  piyasa?: number;
  faturaGuncel?: boolean;
  piyasaGuncel?: boolean;
}) => {
  const fark = fatura && piyasa ? ((piyasa - fatura) / fatura) * 100 : 0;

  return (
    <Group gap={4}>
      {fatura !== undefined && fatura > 0 && (
        <Badge
          size="xs"
          variant="light"
          color={faturaGuncel ? 'blue' : 'yellow'}
          leftSection={<Text size="10px">📄</Text>}
        >
          ₺{fatura.toFixed(2)}
        </Badge>
      )}
      {piyasa !== undefined && piyasa > 0 && (
        <Badge
          size="xs"
          variant="light"
          color={piyasaGuncel ? 'teal' : 'orange'}
          leftSection={<Text size="10px">🏪</Text>}
        >
          ₺{piyasa.toFixed(2)}
        </Badge>
      )}
      {fatura && piyasa && Math.abs(fark) > 5 && (
        <Badge size="xs" variant="filled" color={fark > 0 ? 'red' : 'green'}>
          {fark > 0 ? '↑' : '↓'}
          {Math.abs(fark).toFixed(0)}%
        </Badge>
      )}
    </Group>
  );
};
