'use client';

import { Badge, Group, Menu, Text, UnstyledButton } from '@mantine/core';
import { IconBuilding, IconCheck, IconChevronDown } from '@tabler/icons-react';
import { useFirma } from '@/context/FirmaContext';

export function FirmaSwitcher() {
  const { selectedFirma, availableFirmalar, switchFirma } = useFirma();

  if (!selectedFirma) return null;

  const displayName = selectedFirma.kisa_ad || selectedFirma.unvan;

  // Tek firma — sadece badge göster
  if ((availableFirmalar ?? []).length <= 1) {
    return (
      <Badge
        variant="light"
        color="blue"
        size="lg"
        radius="md"
        leftSection={<IconBuilding size={14} />}
        styles={{
          root: {
            textTransform: 'none',
            fontWeight: 500,
            cursor: 'default',
          },
        }}
      >
        {displayName}
      </Badge>
    );
  }

  // Çoklu firma — dropdown
  const handleSwitch = async (firmaId: number) => {
    if (firmaId === selectedFirma.id) return;
    if (!window.confirm('Firma değiştirilecek. Kaydedilmemiş veriler kaybolabilir. Devam etmek istiyor musunuz?')) {
      return;
    }
    await switchFirma(firmaId);
  };

  return (
    <Menu shadow="md" width={260} position="bottom-end">
      <Menu.Target>
        <UnstyledButton
          style={{
            padding: '6px 12px',
            borderRadius: 8,
            backgroundColor: 'rgba(59, 130, 246, 0.08)',
            border: '1px solid rgba(59, 130, 246, 0.15)',
            transition: 'all 0.2s ease',
          }}
        >
          <Group gap={8} wrap="nowrap">
            <IconBuilding size={16} style={{ color: '#3b82f6', flexShrink: 0 }} />
            <Text size="sm" fw={500} truncate style={{ maxWidth: 160 }}>
              {displayName}
            </Text>
            <IconChevronDown size={14} style={{ opacity: 0.5, flexShrink: 0 }} />
          </Group>
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Firma Değiştir</Menu.Label>
        {(availableFirmalar ?? []).map((firma) => (
          <Menu.Item
            key={firma.id}
            onClick={() => handleSwitch(firma.id)}
            rightSection={firma.id === selectedFirma.id ? <IconCheck size={16} color="#3b82f6" /> : null}
            style={firma.id === selectedFirma.id ? { backgroundColor: 'rgba(59, 130, 246, 0.06)' } : undefined}
          >
            <Text size="sm" fw={firma.id === selectedFirma.id ? 600 : 400}>
              {firma.kisa_ad || firma.unvan}
            </Text>
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}
