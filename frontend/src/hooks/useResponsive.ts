import { useMediaQuery } from '@mantine/hooks';
import { useEffect, useMemo, useState } from 'react';

export interface ResponsiveBreakpoints {
  isMobile: boolean; // < 768px
  isTablet: boolean; // 768px - 1024px
  isDesktop: boolean; // > 1024px
  isSmallMobile: boolean; // < 480px
  isTouchDevice: boolean;
  /** Client tarafında mı? (SSR için) */
  isMounted: boolean;
}

/**
 * Responsive breakpoint hook
 * Mobil/tablet/desktop cihazları tespit eder
 * SSR-safe: İlk render'da desktop varsayar
 */
export function useResponsive(): ResponsiveBreakpoints {
  const [isMounted, setIsMounted] = useState(false);

  const isSmallMobile = useMediaQuery('(max-width: 480px)') ?? false;
  const isMobile = useMediaQuery('(max-width: 768px)') ?? false;
  const isTablet = useMediaQuery('(min-width: 769px) and (max-width: 1024px)') ?? false;
  const isDesktop = useMediaQuery('(min-width: 1025px)') ?? true;
  const isTouchDevice = useMediaQuery('(pointer: coarse)') ?? false;

  // Client tarafında mount olduktan sonra true yap
  useEffect(() => {
    setIsMounted(true);
  }, []);

  return useMemo(
    () => ({
      // SSR sırasında desktop varsay (hydration mismatch önleme)
      isSmallMobile: isMounted ? isSmallMobile : false,
      isMobile: isMounted ? isMobile : false,
      isTablet: isMounted ? isTablet : false,
      isDesktop: isMounted ? isDesktop : true,
      isTouchDevice: isMounted ? isTouchDevice : false,
      isMounted,
    }),
    [isSmallMobile, isMobile, isTablet, isDesktop, isTouchDevice, isMounted]
  );
}

/**
 * Responsive değer seçici
 * Breakpoint'e göre farklı değerler döndürür
 */
export function useResponsiveValue<T>(values: { mobile?: T; tablet?: T; desktop: T }): T {
  const { isMobile, isTablet } = useResponsive();

  if (isMobile && values.mobile !== undefined) return values.mobile;
  if (isTablet && values.tablet !== undefined) return values.tablet;
  return values.desktop;
}

/**
 * Grid column sayısı için responsive hook
 */
export function useResponsiveColumns(config?: { mobile?: number; tablet?: number; desktop?: number }): number {
  const defaults = { mobile: 1, tablet: 2, desktop: 4 };
  const merged = { ...defaults, ...config };

  return useResponsiveValue({
    mobile: merged.mobile,
    tablet: merged.tablet,
    desktop: merged.desktop,
  });
}

/**
 * Spacing için responsive hook
 */
export function useResponsiveSpacing(): {
  containerPadding: string;
  cardPadding: string;
  gap: string;
  sectionGap: string;
} {
  const { isMobile, isTablet } = useResponsive();

  if (isMobile) {
    return {
      containerPadding: '12px',
      cardPadding: '12px',
      gap: '8px',
      sectionGap: '16px',
    };
  }

  if (isTablet) {
    return {
      containerPadding: '16px',
      cardPadding: '16px',
      gap: '12px',
      sectionGap: '20px',
    };
  }

  return {
    containerPadding: '24px',
    cardPadding: '20px',
    gap: '16px',
    sectionGap: '24px',
  };
}
