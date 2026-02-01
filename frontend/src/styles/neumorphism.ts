/**
 * Neumorphism / Soft UI Style System
 * 
 * Provides consistent shadows, colors, spacing, and animations
 * for the toolbar components (Navbar, MobileSidebar, GenerationToolbar)
 */

// =============================================================================
// SHADOWS
// =============================================================================

/**
 * Neumorphic shadow presets
 * - raised: Element appears lifted from surface
 * - inset: Element appears pressed into surface
 * - subtle: Lighter version for small elements
 */
export const neuShadow = {
  raised: {
    dark: `
      6px 6px 12px rgba(0, 0, 0, 0.3),
      -6px -6px 12px rgba(255, 255, 255, 0.05)
    `.trim(),
    light: `
      6px 6px 12px rgba(0, 0, 0, 0.08),
      -6px -6px 12px rgba(255, 255, 255, 0.9)
    `.trim(),
  },
  inset: {
    dark: `
      inset 4px 4px 8px rgba(0, 0, 0, 0.35),
      inset -4px -4px 8px rgba(255, 255, 255, 0.05)
    `.trim(),
    light: `
      inset 4px 4px 8px rgba(0, 0, 0, 0.06),
      inset -4px -4px 8px rgba(255, 255, 255, 0.95)
    `.trim(),
  },
  subtle: {
    dark: `
      3px 3px 6px rgba(0, 0, 0, 0.25),
      -3px -3px 6px rgba(255, 255, 255, 0.04)
    `.trim(),
    light: `
      3px 3px 6px rgba(0, 0, 0, 0.05),
      -3px -3px 6px rgba(255, 255, 255, 0.8)
    `.trim(),
  },
  // For pressed/active states
  pressed: {
    dark: `
      inset 2px 2px 4px rgba(0, 0, 0, 0.4),
      inset -2px -2px 4px rgba(255, 255, 255, 0.03)
    `.trim(),
    light: `
      inset 2px 2px 4px rgba(0, 0, 0, 0.08),
      inset -2px -2px 4px rgba(255, 255, 255, 0.9)
    `.trim(),
  },
  // For floating elements (FAB, modals)
  floating: {
    dark: `
      0 8px 32px rgba(0, 0, 0, 0.4),
      0 4px 12px rgba(0, 0, 0, 0.3),
      6px 6px 16px rgba(0, 0, 0, 0.25),
      -6px -6px 16px rgba(255, 255, 255, 0.03)
    `.trim(),
    light: `
      0 8px 32px rgba(0, 0, 0, 0.12),
      0 4px 12px rgba(0, 0, 0, 0.08),
      6px 6px 16px rgba(0, 0, 0, 0.06),
      -6px -6px 16px rgba(255, 255, 255, 0.9)
    `.trim(),
  },
};

// Helper function to get shadow based on theme
export const getShadow = (
  type: keyof typeof neuShadow,
  isDark: boolean
): string => {
  return isDark ? neuShadow[type].dark : neuShadow[type].light;
};

// =============================================================================
// COLORS
// =============================================================================

export const neuColors = {
  dark: {
    // Glassmorphism backgrounds (transparent with blur)
    bgPrimary: 'rgba(18, 18, 18, 0.25)',
    bgSecondary: 'rgba(12, 12, 12, 0.35)',
    bgGradient: 'rgba(18, 18, 18, 0.25)',
    
    // Surface colors (glass-like transparency)
    surface: 'rgba(255, 255, 255, 0.03)',
    surfaceElevated: 'rgba(255, 255, 255, 0.05)',
    surfaceHover: 'rgba(255, 255, 255, 0.08)',
    surfaceActive: 'rgba(255, 255, 255, 0.10)',
    
    // Border colors
    border: 'rgba(255, 255, 255, 0.06)',
    borderSubtle: 'rgba(255, 255, 255, 0.04)',
    borderHover: 'rgba(255, 255, 255, 0.12)',
    
    // Text colors
    textPrimary: 'rgba(255, 255, 255, 0.95)',
    textSecondary: 'rgba(255, 255, 255, 0.7)',
    textMuted: 'rgba(255, 255, 255, 0.5)',
    
    // Accent colors
    accent: '#e6c530',
    accentHover: '#f0d050',
    accentMuted: 'rgba(230, 197, 48, 0.2)',
    
    // Status colors (softened for neumorphism)
    success: '#22c55e',
    successMuted: 'rgba(34, 197, 94, 0.15)',
    warning: '#f59e0b',
    warningMuted: 'rgba(245, 158, 11, 0.15)',
    error: '#ef4444',
    errorMuted: 'rgba(239, 68, 68, 0.15)',
    info: '#3b82f6',
    infoMuted: 'rgba(59, 130, 246, 0.15)',
  },
  light: {
    // Glassmorphism backgrounds (transparent with blur)
    bgPrimary: 'rgba(255, 255, 255, 0.35)',
    bgSecondary: 'rgba(255, 255, 255, 0.45)',
    bgGradient: 'rgba(255, 255, 255, 0.35)',
    
    // Surface colors (glass-like transparency)
    surface: 'rgba(255, 255, 255, 0.4)',
    surfaceElevated: 'rgba(255, 255, 255, 0.6)',
    surfaceHover: 'rgba(255, 255, 255, 0.75)',
    surfaceActive: 'rgba(255, 255, 255, 0.85)',
    
    // Border colors
    border: 'rgba(0, 0, 0, 0.06)',
    borderSubtle: 'rgba(0, 0, 0, 0.04)',
    borderHover: 'rgba(0, 0, 0, 0.1)',
    
    // Text colors
    textPrimary: 'rgba(0, 0, 0, 0.9)',
    textSecondary: 'rgba(0, 0, 0, 0.65)',
    textMuted: 'rgba(0, 0, 0, 0.45)',
    
    // Accent colors
    accent: '#ca8a04',
    accentHover: '#b47d04',
    accentMuted: 'rgba(202, 138, 4, 0.15)',
    
    // Status colors
    success: '#16a34a',
    successMuted: 'rgba(22, 163, 74, 0.12)',
    warning: '#d97706',
    warningMuted: 'rgba(217, 119, 6, 0.12)',
    error: '#dc2626',
    errorMuted: 'rgba(220, 38, 38, 0.12)',
    info: '#2563eb',
    infoMuted: 'rgba(37, 99, 235, 0.12)',
  },
};

// Helper function to get colors based on theme
export const getColors = (isDark: boolean) => {
  return isDark ? neuColors.dark : neuColors.light;
};

// =============================================================================
// SPACING
// =============================================================================

/**
 * 8px base spacing scale
 * Consistent spacing throughout all components
 */
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

// =============================================================================
// BORDER RADIUS
// =============================================================================

/**
 * Rounded corners for neumorphism
 * Larger values for softer appearance
 */
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999,
} as const;

// =============================================================================
// TYPOGRAPHY
// =============================================================================

export const typography = {
  // Font weights
  weight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  // Letter spacing
  letterSpacing: {
    tight: '-0.01em',
    normal: '0',
    wide: '0.02em',
    wider: '0.05em',
    widest: '0.1em',
  },
  // Line heights
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
} as const;

// =============================================================================
// ANIMATIONS
// =============================================================================

export const animations = {
  // Timing functions
  easing: {
    default: 'cubic-bezier(0.4, 0, 0.2, 1)',
    smooth: 'cubic-bezier(0.16, 1, 0.3, 1)',
    bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    spring: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
  },
  // Durations
  duration: {
    fast: '0.15s',
    normal: '0.2s',
    slow: '0.3s',
    slower: '0.4s',
  },
  // Common transitions
  transition: {
    fast: '0.15s cubic-bezier(0.4, 0, 0.2, 1)',
    normal: '0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    slow: '0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    spring: '0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
  },
} as const;

// =============================================================================
// COMPONENT SIZES
// =============================================================================

export const sizes = {
  // Touch targets (WCAG compliant)
  touchTarget: {
    min: 44,
    comfortable: 48,
    large: 56,
  },
  // Navbar heights
  navbar: {
    mobile: 56,
    tablet: 60,
    desktop: 64,
  },
  // Icon sizes
  icon: {
    xs: 14,
    sm: 16,
    md: 20,
    lg: 24,
    xl: 28,
  },
  // Avatar sizes
  avatar: {
    sm: 28,
    md: 36,
    lg: 44,
  },
} as const;

// =============================================================================
// BREAKPOINTS
// =============================================================================

export const breakpoints = {
  xs: 480,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
} as const;

// =============================================================================
// Z-INDEX
// =============================================================================

export const zIndex = {
  dropdown: 50,
  sticky: 60,
  fixed: 70,
  modalBackdrop: 80,
  modal: 90,
  navbar: 100,
  tooltip: 110,
  toast: 120,
} as const;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Creates a complete neumorphic style object for a raised element
 */
export const neuRaisedStyle = (isDark: boolean) => ({
  backgroundColor: isDark ? neuColors.dark.surfaceElevated : neuColors.light.surfaceElevated,
  boxShadow: getShadow('raised', isDark),
  border: `1px solid ${isDark ? neuColors.dark.border : neuColors.light.border}`,
  borderRadius: radius.lg,
  transition: `all ${animations.transition.normal}`,
});

/**
 * Creates a complete neumorphic style object for an inset element
 */
export const neuInsetStyle = (isDark: boolean) => ({
  backgroundColor: isDark ? neuColors.dark.surface : neuColors.light.surface,
  boxShadow: getShadow('inset', isDark),
  border: `1px solid ${isDark ? neuColors.dark.borderSubtle : neuColors.light.borderSubtle}`,
  borderRadius: radius.md,
  transition: `all ${animations.transition.normal}`,
});

/**
 * Creates hover state styles
 */
export const neuHoverStyle = (isDark: boolean) => ({
  backgroundColor: isDark ? neuColors.dark.surfaceHover : neuColors.light.surfaceHover,
  boxShadow: getShadow('subtle', isDark),
  borderColor: isDark ? neuColors.dark.borderHover : neuColors.light.borderHover,
  transform: 'translateY(-1px)',
});

/**
 * Creates pressed/active state styles
 */
export const neuPressedStyle = (isDark: boolean) => ({
  backgroundColor: isDark ? neuColors.dark.surfaceActive : neuColors.light.surfaceActive,
  boxShadow: getShadow('pressed', isDark),
  transform: 'translateY(0) scale(0.98)',
});
