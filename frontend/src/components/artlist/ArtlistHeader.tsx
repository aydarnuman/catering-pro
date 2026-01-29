'use client';

import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  Text,
  TextInput,
  Tooltip,
  useMantineColorScheme,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import {
  IconSearch,
  IconSparkles,
  IconUser,
} from '@tabler/icons-react';
import Link from 'next/link';

export function ArtlistHeader() {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';
  const isMobile = useMediaQuery('(max-width: 768px)');

  return (
    <Box
      component="header"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        width: '100%',
        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
        backgroundColor: isDark ? 'rgba(26, 27, 30, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Duyuru Barı */}
      <Box
        py={8}
        px="md"
        ta="center"
        style={{
          backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
        }}
      >
        <Group gap={8} justify="center">
          <IconSparkles size={16} color={isDark ? '#a78bfa' : '#7c3aed'} />
          <Text size="sm" c="dimmed">
            Yeni! İhtiyaç duyduğunuz tüm yapay zeka araçları tek bir araç setinde bir araya getirildi.
          </Text>
          <Text
            size="sm"
            c={isDark ? 'violet.4' : 'violet.6'}
            style={{ cursor: 'pointer' }}
            className="hover-underline"
          >
            →
          </Text>
        </Group>
      </Box>

      {/* Ana Navigasyon */}
      <Group
        h={64}
        px={{ base: 'md', md: 'xl' }}
        justify="space-between"
      >
        {/* Logo + Arama */}
        <Group gap="xl">
          <Text
            size="xl"
            fw={700}
            c={isDark ? 'white' : 'dark'}
            style={{ letterSpacing: '-0.5px' }}
          >
            ∆rtlist
          </Text>

          {/* Arama - Desktop */}
          {!isMobile && (
            <Box style={{ position: 'relative' }}>
              <TextInput
                placeholder="Aramak"
                leftSection={<IconSearch size={16} />}
                radius="xl"
                size="sm"
                w={200}
                styles={{
                  input: {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                  },
                }}
              />
            </Box>
          )}
        </Group>

        {/* Orta Navigasyon - Desktop */}
        {!isMobile && (
          <Group gap={4}>
            <Button
              variant="light"
              color="gray"
              size="sm"
              radius="xl"
              styles={{
                root: {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                  color: isDark ? 'white' : 'black',
                },
              }}
            >
              Ev
            </Button>
            <Button variant="subtle" color="gray" size="sm" radius="xl" c="dimmed">
              Yapay Zeka Araç Kiti
            </Button>
            <Button variant="subtle" color="gray" size="sm" radius="xl" c="dimmed">
              Stok Kataloğu
            </Button>
            <Button
              variant="subtle"
              color="gray"
              size="sm"
              radius="xl"
              c="dimmed"
              rightSection={
                <Badge size="xs" variant="light" color="gray" radius="xl">
                  Yakında
                </Badge>
              }
            >
              Stüdyo
            </Button>
          </Group>
        )}

        {/* Sağ Taraf */}
        <Group gap="sm">
          {!isMobile && (
            <>
              <Button variant="subtle" color="gray" size="sm" c="dimmed">
                İşletme
              </Button>
              <Button variant="subtle" color="gray" size="sm" c="dimmed">
                Fiyatlandırma
              </Button>
            </>
          )}
          <Button
            size="sm"
            radius="xl"
            variant="gradient"
            gradient={{ from: 'violet', to: 'grape', deg: 135 }}
            fw={500}
          >
            Şimdi Abone Olun
          </Button>
          <Tooltip label="Profil" withArrow>
            <ActionIcon variant="subtle" color="gray" size="lg" radius="xl">
              <IconUser size={20} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>
    </Box>
  );
}
