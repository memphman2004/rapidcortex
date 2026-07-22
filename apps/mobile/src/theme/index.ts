import { createContext, createElement, useContext, useMemo, type ReactNode } from 'react';
import {
  Colors,
  type CampusColors,
  type EmergencyColors,
  type ProductTheme,
  type SafeSoundColors,
  type VenueColors,
} from './colors';
import { BorderRadius, IconSize, Layout, Spacing } from './spacing';
import { Typography } from './typography';

export interface ThemeContextValue {
  product: ProductTheme;
  colors: VenueColors | CampusColors | SafeSoundColors | EmergencyColors;
  typography: typeof Typography;
  spacing: typeof Spacing;
  borderRadius: typeof BorderRadius;
  iconSize: typeof IconSize;
  layout: typeof Layout;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveColors(
  product: ProductTheme,
): VenueColors | CampusColors | SafeSoundColors | EmergencyColors {
  switch (product) {
    case 'venue':
      return Colors.venue;
    case 'campus':
      return Colors.campus;
    case 'safeSound':
      return Colors.safeSound;
    case 'emergency':
      return Colors.emergency;
    default: {
      const exhaustive: never = product;
      return exhaustive;
    }
  }
}

export interface ThemeProviderProps {
  product: ProductTheme;
  children: ReactNode;
}

export function ThemeProvider({ product, children }: ThemeProviderProps) {
  const value = useMemo<ThemeContextValue>(
    () => ({
      product,
      colors: resolveColors(product),
      typography: Typography,
      spacing: Spacing,
      borderRadius: BorderRadius,
      iconSize: IconSize,
      layout: Layout,
    }),
    [product],
  );

  return createElement(ThemeContext.Provider, { value }, children);
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

/** Primary accent — venue amber, campus slate, Safe & Sound blue. */
export function getAccentColor(theme: ThemeContextValue): string {
  if (theme.product === 'venue' || theme.product === 'campus') {
    return (theme.colors as VenueColors | CampusColors).amber;
  }
  if (theme.product === 'safeSound') return (theme.colors as SafeSoundColors).blue;
  return (theme.colors as EmergencyColors).cancelButton;
}

/** Secondary accent — venue/campus emerald, Safe & Sound green. */
export function getSuccessColor(theme: ThemeContextValue): string {
  if (theme.product === 'venue' || theme.product === 'campus') {
    return (theme.colors as VenueColors | CampusColors).emerald;
  }
  if (theme.product === 'safeSound') return (theme.colors as SafeSoundColors).green;
  return (theme.colors as EmergencyColors).cancelButton;
}

/** Danger/critical accent. */
export function getDangerColor(theme: ThemeContextValue): string {
  if (theme.product === 'emergency') return (theme.colors as EmergencyColors).countdown;
  return (theme.colors as VenueColors | CampusColors | SafeSoundColors).red;
}

export { Colors, Typography, Spacing, BorderRadius, IconSize, Layout };
export type { ProductTheme, VenueColors, CampusColors, SafeSoundColors, EmergencyColors };
