'use client';

import { Box, Center, Loader, LoadingOverlay, Skeleton, Stack, Text } from '@mantine/core';
import { ReactNode } from 'react';

export type LoadingStateVariant = 'spinner' | 'skeleton' | 'overlay' | 'inline';

interface LoadingStateProps {
  /** Loading durumu */
  loading: boolean;
  /** Loading tipi */
  variant?: LoadingStateVariant;
  /** Loading mesajı */
  message?: string;
  /** Skeleton için satır sayısı (skeleton variant için) */
  skeletonLines?: number;
  /** Skeleton yüksekliği (skeleton variant için) */
  skeletonHeight?: number | string;
  /** Overlay için z-index */
  zIndex?: number;
  /** Çocuk içerik (overlay variant için) */
  children?: ReactNode;
  /** Full height container */
  fullHeight?: boolean;
  /** Custom loader size */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

/**
 * Standart Loading State Component
 * 
 * Kullanım örnekleri:
 * 
 * // Spinner (default)
 * <LoadingState loading={isLoading} message="Yükleniyor..." />
 * 
 * // Skeleton
 * <LoadingState loading={isLoading} variant="skeleton" skeletonLines={3} />
 * 
 * // Overlay (içerik üzerinde)
 * <LoadingState loading={isLoading} variant="overlay">
 *   <YourContent />
 * </LoadingState>
 * 
 * // Inline (küçük spinner)
 * <LoadingState loading={isLoading} variant="inline" size="sm" />
 */
export function LoadingState({
  loading,
  variant = 'spinner',
  message,
  skeletonLines = 3,
  skeletonHeight = 20,
  zIndex = 1000,
  children,
  fullHeight = false,
  size = 'md',
}: LoadingStateProps) {
  if (!loading) {
    return <>{children}</>;
  }

  // Overlay variant - içerik üzerinde loading göster
  if (variant === 'overlay') {
    return (
      <Box style={{ position: 'relative' }}>
        <LoadingOverlay
          visible={loading}
          zIndex={zIndex}
          overlayProps={{ radius: 'sm', blur: 2 }}
          loaderProps={{ size, type: 'dots' }}
        />
        {children}
      </Box>
    );
  }

  // Skeleton variant - placeholder göster
  if (variant === 'skeleton') {
    return (
      <Stack gap="xs">
        {Array.from({ length: skeletonLines }).map((_, i) => (
          <Skeleton key={i} height={skeletonHeight} radius="sm" />
        ))}
      </Stack>
    );
  }

  // Inline variant - küçük spinner
  if (variant === 'inline') {
    return (
      <Center inline>
        <Loader size={size} type="dots" />
        {message && (
          <Text size="sm" c="dimmed" ml="sm">
            {message}
          </Text>
        )}
      </Center>
    );
  }

  // Default: Spinner variant - merkezi spinner
  return (
    <Center
      style={{
        minHeight: fullHeight ? '100vh' : '200px',
        width: '100%',
      }}
    >
      <Stack align="center" gap="md">
        <Loader size={size} type="dots" />
        {message && (
          <Text size="sm" c="dimmed">
            {message}
          </Text>
        )}
      </Stack>
    </Center>
  );
}

/**
 * Hızlı kullanım için wrapper component'ler
 */

/** Spinner loading - merkezi */
export function LoadingSpinner({
  loading,
  message,
  fullHeight,
  size,
}: {
  loading: boolean;
  message?: string;
  fullHeight?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}) {
  return (
    <LoadingState
      loading={loading}
      variant="spinner"
      message={message}
      fullHeight={fullHeight}
      size={size}
    />
  );
}

/** Skeleton loading - placeholder */
export function LoadingSkeleton({
  loading,
  lines = 3,
  height = 20,
}: {
  loading: boolean;
  lines?: number;
  height?: number | string;
}) {
  return (
    <LoadingState
      loading={loading}
      variant="skeleton"
      skeletonLines={lines}
      skeletonHeight={height}
    />
  );
}

/** Overlay loading - içerik üzerinde */
export function LoadingOverlayWrapper({
  loading,
  children,
  zIndex,
}: {
  loading: boolean;
  children: ReactNode;
  zIndex?: number;
}) {
  return (
    <LoadingState loading={loading} variant="overlay" zIndex={zIndex}>
      {children}
    </LoadingState>
  );
}
