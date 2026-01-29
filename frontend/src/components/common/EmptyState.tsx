'use client';

import { Box, Button, Paper, Stack, Text, ThemeIcon, useMantineColorScheme } from '@mantine/core';
import { IconInbox, IconPlus } from '@tabler/icons-react';
import type { ReactNode } from 'react';

export interface EmptyStateProps {
  /** Başlık */
  title?: string;
  /** Açıklama */
  description?: string;
  /** İkon (default: Inbox) */
  icon?: ReactNode;
  /** İkon rengi */
  iconColor?: string;
  /** Aksiyon butonu */
  action?: {
    label: string;
    onClick: () => void;
    icon?: ReactNode;
  };
  /** Custom içerik */
  children?: ReactNode;
  /** Kompakt görünüm */
  compact?: boolean;
  /** Full height container */
  fullHeight?: boolean;
}

/**
 * Standart Empty State Component
 *
 * Kullanım örnekleri:
 *
 * // Basit kullanım
 * <EmptyState
 *   title="Henüz veri yok"
 *   description="İlk kaydınızı oluşturun"
 * />
 *
 * // Aksiyon butonu ile
 * <EmptyState
 *   title="Henüz ürün yok"
 *   description="Yeni ürün eklemek için butona tıklayın"
 *   action={{
 *     label: "Ürün Ekle",
 *     onClick: () => handleAdd(),
 *     icon: <IconPlus />
 *   }}
 * />
 *
 * // Custom icon
 * <EmptyState
 *   title="Henüz fatura yok"
 *   icon={<IconReceipt size={48} />}
 *   iconColor="blue"
 * />
 */
export function EmptyState({
  title = 'Veri bulunamadı',
  description,
  icon,
  iconColor = 'gray',
  action,
  children,
  compact = false,
  fullHeight = false,
}: EmptyStateProps) {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';

  const defaultIcon = icon || <IconInbox size={compact ? 32 : 48} />;

  return (
    <Box
      style={{
        minHeight: fullHeight ? '100vh' : 'auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: compact ? 'md' : 'xl',
      }}
    >
      <Paper
        p={compact ? 'md' : 'xl'}
        radius="lg"
        ta="center"
        style={{
          background: isDark ? 'var(--surface-elevated)' : 'rgba(0,0,0,0.02)',
          border: `2px dashed ${isDark ? 'var(--surface-border)' : 'rgba(0,0,0,0.1)'}`,
          maxWidth: 500,
          width: '100%',
        }}
      >
        <Stack align="center" gap={compact ? 'sm' : 'md'}>
          {/* İkon */}
          <ThemeIcon
            size={compact ? 64 : 96}
            radius="xl"
            variant="light"
            color={iconColor}
            style={{
              opacity: 0.6,
            }}
          >
            {defaultIcon}
          </ThemeIcon>

          {/* Başlık */}
          <Text size={compact ? 'sm' : 'md'} c="dimmed" fw={500}>
            {title}
          </Text>

          {/* Açıklama */}
          {description && (
            <Text size={compact ? 'xs' : 'sm'} c="dimmed" mt={compact ? 0 : 4}>
              {description}
            </Text>
          )}

          {/* Custom içerik */}
          {children}

          {/* Aksiyon butonu */}
          {action && (
            <Button
              variant="light"
              leftSection={action.icon || <IconPlus size={16} />}
              onClick={action.onClick}
              size={compact ? 'sm' : 'md'}
              mt="md"
            >
              {action.label}
            </Button>
          )}
        </Stack>
      </Paper>
    </Box>
  );
}

/**
 * Önceden tanımlı empty state'ler
 */

/** Genel "veri yok" mesajı */
export function EmptyData({
  message,
  action,
}: {
  message?: string;
  action?: EmptyStateProps['action'];
}) {
  return (
    <EmptyState
      title={message || 'Veri bulunamadı'}
      description="Henüz kayıt eklenmemiş"
      action={action}
    />
  );
}

/** Liste boş */
export function EmptyList({
  itemName,
  action,
}: {
  itemName?: string;
  action?: EmptyStateProps['action'];
}) {
  return (
    <EmptyState
      title={`Henüz ${itemName || 'kayıt'} yok`}
      description={`İlk ${itemName || 'kaydınızı'} oluşturun`}
      action={action}
      icon={<IconInbox size={48} />}
    />
  );
}

/** Arama sonucu bulunamadı */
export function EmptySearch({
  query,
  action,
}: {
  query?: string;
  action?: EmptyStateProps['action'];
}) {
  return (
    <EmptyState
      title={query ? `"${query}" için sonuç bulunamadı` : 'Arama sonucu bulunamadı'}
      description="Farklı bir arama terimi deneyin"
      icon={<IconInbox size={48} />}
      iconColor="blue"
      action={action}
    />
  );
}

/** Filtre sonucu bulunamadı */
export function EmptyFilter({ action }: { action?: EmptyStateProps['action'] }) {
  return (
    <EmptyState
      title="Filtreye uygun kayıt bulunamadı"
      description="Filtre kriterlerini değiştirip tekrar deneyin"
      icon={<IconInbox size={48} />}
      iconColor="orange"
      action={action}
    />
  );
}
