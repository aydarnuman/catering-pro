'use client';

import {
  ActionIcon,
  Box,
  type BoxProps,
  Drawer,
  Group,
  type GroupProps,
  Paper,
  ScrollArea,
  Stack,
  type StackProps,
  Text,
  Title,
  Transition,
  UnstyledButton,
  useMantineColorScheme,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconChevronDown, IconX } from '@tabler/icons-react';
import { type ReactNode, useEffect, useState } from 'react';
import { useResponsive } from '@/hooks/useResponsive';

// ============================================
// MobileWrapper - Responsive padding/margin
// ============================================
interface MobileWrapperProps extends BoxProps {
  children: ReactNode;
  /** Mobilde padding */
  mobilePadding?: string | number;
  /** Tablette padding */
  tabletPadding?: string | number;
  /** Desktop'ta padding */
  desktopPadding?: string | number;
}

export function MobileWrapper({
  children,
  mobilePadding = 'xs',
  tabletPadding = 'md',
  desktopPadding = 'lg',
  ...props
}: MobileWrapperProps) {
  const { isMobile, isTablet } = useResponsive();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // SSR sırasında desktop varsayalım
  const padding = !mounted
    ? desktopPadding
    : isMobile
      ? mobilePadding
      : isTablet
        ? tabletPadding
        : desktopPadding;

  return (
    <Box p={padding} {...props}>
      {children}
    </Box>
  );
}

// ============================================
// MobileStack - Mobilde dikey, desktop yatay
// ============================================
interface MobileStackProps extends Omit<GroupProps, 'wrap'> {
  children: ReactNode;
  /** Mobilde Stack mi kullan? (default: true) */
  stackOnMobile?: boolean;
  /** Tablette Stack mi kullan? */
  stackOnTablet?: boolean;
  /** Stack gap */
  stackGap?: StackProps['gap'];
  /** Group gap */
  groupGap?: GroupProps['gap'];
}

export function MobileStack({
  children,
  stackOnMobile = true,
  stackOnTablet = false,
  stackGap = 'sm',
  groupGap = 'md',
  ...props
}: MobileStackProps) {
  const { isMobile, isTablet } = useResponsive();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // SSR sırasında Group kullan
  if (!mounted) {
    return (
      <Group gap={groupGap} {...props}>
        {children}
      </Group>
    );
  }

  const shouldStack = (isMobile && stackOnMobile) || (isTablet && stackOnTablet);

  if (shouldStack) {
    return <Stack gap={stackGap}>{children}</Stack>;
  }

  return (
    <Group gap={groupGap} {...props}>
      {children}
    </Group>
  );
}

// ============================================
// MobileHide - Breakpoint'e göre gizle
// ============================================
interface MobileHideProps {
  children: ReactNode;
  /** Mobilde gizle */
  hideOnMobile?: boolean;
  /** Tablette gizle */
  hideOnTablet?: boolean;
  /** Desktop'ta gizle */
  hideOnDesktop?: boolean;
}

export function MobileHide({
  children,
  hideOnMobile = true,
  hideOnTablet = false,
  hideOnDesktop = false,
}: MobileHideProps) {
  const { isMobile, isTablet, isDesktop } = useResponsive();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // SSR sırasında göster
  if (!mounted) {
    return <>{children}</>;
  }

  const shouldHide =
    (isMobile && hideOnMobile) || (isTablet && hideOnTablet) || (isDesktop && hideOnDesktop);

  if (shouldHide) {
    return null;
  }

  return <>{children}</>;
}

// ============================================
// MobileShow - Breakpoint'e göre göster
// ============================================
interface MobileShowProps {
  children: ReactNode;
  /** Sadece mobilde göster */
  showOnMobile?: boolean;
  /** Sadece tablette göster */
  showOnTablet?: boolean;
  /** Sadece desktop'ta göster */
  showOnDesktop?: boolean;
}

export function MobileShow({
  children,
  showOnMobile = true,
  showOnTablet = false,
  showOnDesktop = false,
}: MobileShowProps) {
  const { isMobile, isTablet, isDesktop } = useResponsive();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // SSR sırasında gizle (mobile-first değilsek)
  if (!mounted) {
    return null;
  }

  const shouldShow =
    (isMobile && showOnMobile) || (isTablet && showOnTablet) || (isDesktop && showOnDesktop);

  if (!shouldShow) {
    return null;
  }

  return <>{children}</>;
}

// ============================================
// MobileBottomSheet - Alt açılır panel
// ============================================
interface MobileBottomSheetProps {
  opened: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** Yükseklik (% olarak) */
  height?: number | string;
  /** Padding */
  padding?: string | number;
}

export function MobileBottomSheet({
  opened,
  onClose,
  title,
  children,
  height = '70%',
  padding = 'md',
}: MobileBottomSheetProps) {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="bottom"
      size={height}
      padding={0}
      withCloseButton={false}
      styles={{
        content: {
          borderRadius: '20px 20px 0 0',
          boxShadow: '0 -10px 40px rgba(0,0,0,0.2)',
        },
        body: {
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
        },
      }}
    >
      {/* Handle Bar */}
      <Box
        pt="sm"
        pb="xs"
        style={{
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <Box
          style={{
            width: 40,
            height: 4,
            borderRadius: 2,
            backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)',
          }}
        />
      </Box>

      {/* Header */}
      {title && (
        <Group justify="space-between" px="md" pb="sm">
          <Title order={5}>{title}</Title>
          <ActionIcon variant="subtle" onClick={onClose} size="lg" radius="xl">
            <IconX size={18} />
          </ActionIcon>
        </Group>
      )}

      {/* Content */}
      <ScrollArea style={{ flex: 1 }} offsetScrollbars>
        <Box p={padding}>{children}</Box>
      </ScrollArea>
    </Drawer>
  );
}

// ============================================
// MobileActionSheet - Aksiyon menüsü
// ============================================
interface ActionItem {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  color?: string;
  disabled?: boolean;
  destructive?: boolean;
}

interface MobileActionSheetProps {
  opened: boolean;
  onClose: () => void;
  title?: string;
  actions: ActionItem[];
}

export function MobileActionSheet({ opened, onClose, title, actions }: MobileActionSheetProps) {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <MobileBottomSheet opened={opened} onClose={onClose} title={title} height="auto" padding={0}>
      <Stack gap={0}>
        {actions.map((action, index) => (
          <UnstyledButton
            key={action.label}
            onClick={() => {
              action.onClick();
              onClose();
            }}
            disabled={action.disabled}
            style={{
              padding: '16px 20px',
              borderBottom:
                index < actions.length - 1
                  ? `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`
                  : 'none',
              opacity: action.disabled ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              transition: 'background 0.15s ease',
            }}
            className="action-sheet-item"
          >
            {action.icon && (
              <Box
                style={{
                  color: action.destructive
                    ? '#ef4444'
                    : action.color || (isDark ? '#9ca3af' : '#6b7280'),
                }}
              >
                {action.icon}
              </Box>
            )}
            <Text fw={500} c={action.destructive ? 'red' : action.color} style={{ flex: 1 }}>
              {action.label}
            </Text>
          </UnstyledButton>
        ))}

        {/* Cancel Button */}
        <Box
          p="sm"
          style={{
            borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
            marginTop: 8,
          }}
        >
          <UnstyledButton
            onClick={onClose}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: 12,
              backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
              textAlign: 'center',
            }}
          >
            <Text fw={600}>İptal</Text>
          </UnstyledButton>
        </Box>
      </Stack>
    </MobileBottomSheet>
  );
}

// ============================================
// MobileFilterDrawer - Filtre çekmecesi
// ============================================
interface MobileFilterDrawerProps {
  opened: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  onApply?: () => void;
  onReset?: () => void;
}

export function MobileFilterDrawer({
  opened,
  onClose,
  title = 'Filtreler',
  children,
  onApply,
  onReset,
}: MobileFilterDrawerProps) {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="bottom"
      size="85%"
      padding={0}
      withCloseButton={false}
      styles={{
        content: {
          borderRadius: '20px 20px 0 0',
        },
        body: {
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      {/* Header */}
      <Group
        justify="space-between"
        p="md"
        style={{
          borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
        }}
      >
        <Group gap="sm">
          <Title order={5}>{title}</Title>
        </Group>
        <Group gap="xs">
          {onReset && (
            <UnstyledButton onClick={onReset}>
              <Text size="sm" c="dimmed">
                Temizle
              </Text>
            </UnstyledButton>
          )}
          <ActionIcon variant="subtle" onClick={onClose} size="lg" radius="xl">
            <IconX size={18} />
          </ActionIcon>
        </Group>
      </Group>

      {/* Content */}
      <ScrollArea style={{ flex: 1 }} offsetScrollbars>
        <Box p="md">{children}</Box>
      </ScrollArea>

      {/* Footer */}
      {onApply && (
        <Box
          p="md"
          style={{
            borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
            paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
          }}
        >
          <UnstyledButton
            onClick={() => {
              onApply();
              onClose();
            }}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: 12,
              background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
              textAlign: 'center',
            }}
          >
            <Text fw={600} c="white">
              Filtreleri Uygula
            </Text>
          </UnstyledButton>
        </Box>
      )}
    </Drawer>
  );
}

// ============================================
// MobileCard - Mobil uyumlu kart
// ============================================
interface MobileCardProps extends BoxProps {
  children: ReactNode;
  /** Sol kenarda accent rengi */
  accentColor?: string;
  /** Tıklanabilir mi? */
  clickable?: boolean;
  /** Tıklama eventi */
  onClick?: () => void;
}

export function MobileCard({
  children,
  accentColor,
  clickable = false,
  onClick,
  ...props
}: MobileCardProps) {
  const { colorScheme } = useMantineColorScheme();
  const _isDark = colorScheme === 'dark';

  return (
    <Paper
      shadow="sm"
      p="sm"
      radius="md"
      withBorder
      onClick={clickable ? onClick : undefined}
      style={{
        borderLeft: accentColor ? `3px solid ${accentColor}` : undefined,
        cursor: clickable ? 'pointer' : undefined,
        transition: 'all 0.2s ease',
        ...(clickable && {
          ':active': {
            transform: 'scale(0.98)',
          },
        }),
      }}
      {...props}
    >
      {children}
    </Paper>
  );
}

// ============================================
// MobileExpandableCard - Genişletilebilir kart
// ============================================
interface MobileExpandableCardProps {
  children: ReactNode;
  /** Genişletilmiş içerik */
  expandedContent: ReactNode;
  /** Sol accent rengi */
  accentColor?: string;
  /** Varsayılan açık mı? */
  defaultExpanded?: boolean;
}

export function MobileExpandableCard({
  children,
  expandedContent,
  accentColor,
  defaultExpanded = false,
}: MobileExpandableCardProps) {
  const [expanded, { toggle }] = useDisclosure(defaultExpanded);
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Paper
      shadow="sm"
      radius="md"
      withBorder
      style={{
        borderLeft: accentColor ? `3px solid ${accentColor}` : undefined,
        overflow: 'hidden',
      }}
    >
      {/* Main Content */}
      <Group justify="space-between" p="sm" onClick={toggle} style={{ cursor: 'pointer' }}>
        <Box style={{ flex: 1 }}>{children}</Box>
        <ActionIcon variant="subtle" size="sm">
          <IconChevronDown
            size={16}
            style={{
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease',
            }}
          />
        </ActionIcon>
      </Group>

      {/* Expanded Content */}
      <Transition mounted={expanded} transition="slide-down" duration={200}>
        {(styles) => (
          <Box
            style={{
              ...styles,
              borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
            }}
            p="sm"
            bg={isDark ? 'var(--surface-elevated)' : 'rgba(0,0,0,0.02)'}
          >
            {expandedContent}
          </Box>
        )}
      </Transition>
    </Paper>
  );
}

// ============================================
// useMobileBottomSheet - Hook
// ============================================
export function useMobileBottomSheet() {
  const [opened, { open, close, toggle }] = useDisclosure(false);
  return { opened, open, close, toggle };
}

// ============================================
// CSS for action sheet hover
// ============================================
const actionSheetStyles = `
.action-sheet-item:hover {
  background-color: rgba(0, 0, 0, 0.03);
}

[data-mantine-color-scheme='dark'] .action-sheet-item:hover {
  background-color: rgba(255, 255, 255, 0.05);
}

.action-sheet-item:active {
  background-color: rgba(0, 0, 0, 0.06);
}

[data-mantine-color-scheme='dark'] .action-sheet-item:active {
  background-color: rgba(255, 255, 255, 0.08);
}
`;

// Add styles to document
if (typeof document !== 'undefined') {
  const styleId = 'mobile-utils-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = actionSheetStyles;
    document.head.appendChild(style);
  }
}
