'use client';

import {
  Badge,
  Box,
  Card,
  Paper,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  ThemeIcon,
  UnstyledButton,
} from '@mantine/core';
import { IconFileText } from '@tabler/icons-react';
import { useState } from 'react';
import type { PBCategory } from './types';

interface CategorySelectorProps {
  categories: PBCategory[];
  isLoading?: boolean;
  onSelect: (slug: string) => void;
}

export function CategorySelector({
  categories,
  isLoading,
  onSelect,
}: CategorySelectorProps) {
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

  if (isLoading) {
    return (
      <SimpleGrid cols={{ base: 2, sm: 3, md: 4, lg: 6 }} spacing="md">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} height={100} radius="lg" />
        ))}
      </SimpleGrid>
    );
  }

  if (!categories.length) {
    return (
      <Card p="lg" radius="lg" withBorder ta="center">
        <Stack align="center" gap="sm">
          <ThemeIcon size={40} radius="xl" variant="light" color="gray">
            <IconFileText size={20} />
          </ThemeIcon>
          <Text c="dimmed" size="sm">
            Henüz kategori eklenmemiş
          </Text>
        </Stack>
      </Card>
    );
  }

  // Serbest prompt kategorisini öne al
  const sortedCategories = [...categories].sort((a, b) => {
    if (a.slug === 'serbest') return -1;
    if (b.slug === 'serbest') return 1;
    return (a.sort_order || 0) - (b.sort_order || 0);
  });

  return (
    <SimpleGrid cols={{ base: 2, sm: 3, md: 4, lg: 6 }} spacing="md">
      {sortedCategories.map((category) => {
        const isHovered = hoveredCategory === category.slug;

        return (
          <Box key={category.slug}>
            <UnstyledButton
              onClick={() => onSelect(category.slug)}
              style={{ width: '100%', height: '100%' }}
              onMouseEnter={() => setHoveredCategory(category.slug)}
              onMouseLeave={() => setHoveredCategory(null)}
            >
              <Paper
                p="md"
                radius="lg"
                withBorder
                bg={isHovered ? `${category.color}.0` : undefined}
                style={{
                  borderColor: isHovered
                    ? `var(--mantine-color-${category.color}-4)`
                    : 'var(--mantine-color-gray-3)',
                  transition: 'all 0.2s ease',
                  transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
                  boxShadow: isHovered
                    ? '0 8px 16px rgba(0,0,0,0.08)'
                    : '0 2px 4px rgba(0,0,0,0.04)',
                  cursor: 'pointer',
                  height: '100%',
                }}
              >
                <Stack gap="xs" align="center" ta="center">
                  <Text size="2rem">{category.icon}</Text>
                  <Text fw={600} size="sm" lineClamp={1}>
                    {category.name.replace(/^[^\s]+\s/, '')}
                  </Text>
                  {(Number(category.question_count) > 0 || Number(category.template_count) > 0) && (
                    <Badge size="xs" variant="light" color={category.color}>
                      {category.question_count || 0} soru
                    </Badge>
                  )}
                </Stack>
              </Paper>
            </UnstyledButton>
          </Box>
        );
      })}
    </SimpleGrid>
  );
}
