'use client';

import {
  Box,
  CloseButton,
  Drawer,
  Group,
  Modal,
  type ModalProps,
  ScrollArea,
  Text,
  Title,
  useMantineColorScheme,
} from '@mantine/core';
import type { ReactNode } from 'react';
import { useResponsive } from '@/hooks/useResponsive';

interface ResponsiveModalProps extends Omit<ModalProps, 'size'> {
  // Desktop modal boyutu
  desktopSize?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '100%' | number;
  // Mobilde fullscreen mi?
  mobileFullscreen?: boolean;
  // Custom header
  customHeader?: ReactNode;
  // Header gradient renkleri
  headerGradient?: { from: string; to: string };
  // İkon
  icon?: ReactNode;
}

/**
 * Responsive Modal Bileşeni
 * - Desktop: Normal modal
 * - Mobile: Fullscreen drawer (daha iyi UX)
 */
export function ResponsiveModal({
  opened,
  onClose,
  title,
  children,
  desktopSize = 'lg',
  mobileFullscreen = true,
  customHeader,
  headerGradient,
  icon,
  ...props
}: ResponsiveModalProps) {
  const { isMobile } = useResponsive();
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';

  // Mobile: Drawer kullan
  if (isMobile && mobileFullscreen) {
    return (
      <Drawer
        opened={opened}
        onClose={onClose}
        position="bottom"
        size="100%"
        padding={0}
        withCloseButton={false}
        styles={{
          body: {
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
          },
          content: {
            borderRadius: '16px 16px 0 0',
          },
        }}
        {...(props as Record<string, unknown>)}
      >
        {/* Custom Header */}
        {customHeader ? (
          customHeader
        ) : (
          <Box
            p="md"
            style={{
              background: headerGradient
                ? `linear-gradient(135deg, ${headerGradient.from} 0%, ${headerGradient.to} 100%)`
                : isDark
                  ? 'rgba(255,255,255,0.05)'
                  : 'rgba(0,0,0,0.03)',
              borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
            }}
          >
            <Group justify="space-between" align="center">
              <Group gap="sm">
                {icon}
                <Title order={4} c={headerGradient ? 'white' : undefined}>
                  {title}
                </Title>
              </Group>
              <CloseButton
                onClick={onClose}
                variant={headerGradient ? 'transparent' : 'subtle'}
                c={headerGradient ? 'white' : undefined}
                size="lg"
              />
            </Group>
          </Box>
        )}

        {/* Content */}
        <ScrollArea style={{ flex: 1 }} offsetScrollbars>
          <Box p="md">{children}</Box>
        </ScrollArea>
      </Drawer>
    );
  }

  // Desktop: Normal modal
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        customHeader ? undefined : (
          <Group gap="sm">
            {icon}
            <Text fw={600}>{title}</Text>
          </Group>
        )
      }
      size={desktopSize}
      centered
      {...props}
    >
      {customHeader && <Box mb="md">{customHeader}</Box>}
      {children}
    </Modal>
  );
}

/**
 * Responsive Drawer
 * - Mobile: Tam ekran, alttan açılır
 * - Desktop: Sağdan açılır, belirli genişlik
 */
interface ResponsiveDrawerProps {
  opened: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  desktopWidth?: number | string;
  position?: 'left' | 'right' | 'top' | 'bottom';
}

export function ResponsiveDrawer({
  opened,
  onClose,
  title,
  children,
  desktopWidth = 500,
  position = 'right',
}: ResponsiveDrawerProps) {
  const { isMobile } = useResponsive();
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title={title}
      position={isMobile ? 'bottom' : position}
      size={isMobile ? '95%' : desktopWidth}
      styles={{
        content: {
          borderRadius: isMobile ? '16px 16px 0 0' : 0,
        },
        header: {
          background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
          borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
        },
      }}
    >
      {children}
    </Drawer>
  );
}
