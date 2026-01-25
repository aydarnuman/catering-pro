'use client';

import { Anchor, Breadcrumbs as MantineBreadcrumbs, Group, Text } from '@mantine/core';
import { IconChevronRight, IconHome } from '@tabler/icons-react';
import Link from 'next/link';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: React.ReactNode;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  /** Home icon gösterilsin mi? */
  showHome?: boolean;
  /** Home href (default: '/') */
  homeHref?: string;
}

/**
 * Standart Breadcrumb Component
 * 
 * Kullanım örnekleri:
 * 
 * // Basit kullanım
 * <Breadcrumbs 
 *   items={[
 *     { label: 'Muhasebe', href: '/muhasebe' },
 *     { label: 'Stok', href: '/muhasebe/stok' },
 *     { label: 'Ürün Detay' }
 *   ]}
 * />
 * 
 * // Home icon ile
 * <Breadcrumbs 
 *   items={[
 *     { label: 'İhaleler', href: '/tenders' },
 *     { label: 'İhale Detay' }
 *   ]}
 *   showHome
 * />
 */
export function Breadcrumbs({ items, showHome = true, homeHref = '/' }: BreadcrumbsProps) {
  const allItems: BreadcrumbItem[] = showHome
    ? [{ label: 'Ana Sayfa', href: homeHref, icon: <IconHome size={16} /> }, ...items]
    : items;

  return (
    <MantineBreadcrumbs
      separator={<IconChevronRight size={14} />}
      separatorMargin="xs"
      styles={{
        root: {
          marginBottom: 'var(--mantine-spacing-md)',
        },
        breadcrumb: {
          fontSize: 'var(--mantine-font-size-sm)',
        },
      }}
    >
      {allItems.map((item, index) => {
        const isLast = index === allItems.length - 1;

        if (isLast || !item.href) {
          return (
            <Group key={index} gap="xs">
              {item.icon}
              <Text size="sm" fw={500} c="dimmed">
                {item.label}
              </Text>
            </Group>
          );
        }

        return (
          <Anchor
            key={index}
            component={Link}
            href={item.href}
            size="sm"
            style={{ display: 'flex', alignItems: 'center', gap: 4 }}
          >
            {item.icon}
            {item.label}
          </Anchor>
        );
      })}
    </MantineBreadcrumbs>
  );
}
