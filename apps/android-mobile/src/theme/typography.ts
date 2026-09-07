/**
 * Typography tokens for Rapid Cortex mobile.
 * Load Inter via @expo-google-fonts/inter and expo-font at app root.
 *
 * @example
 * import {
 *   useFonts,
 *   Inter_400Regular,
 *   Inter_500Medium,
 *   Inter_600SemiBold,
 *   Inter_700Bold,
 *   Inter_800ExtraBold,
 * } from '@expo-google-fonts/inter';
 */
export const FontFamily = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semiBold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extraBold: 'Inter_800ExtraBold',
} as const;

export const FontWeight = {
  regular: '400',
  medium: '500',
  semiBold: '600',
  bold: '700',
  extraBold: '800',
} as const;

export const FontSize = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 24,
  '2xl': 28,
  '3xl': 34,
  '4xl': 40,
  emergencyCountdown: 72,
} as const;

export const LineHeight = {
  xs: 14,
  sm: 18,
  base: 20,
  md: 24,
  lg: 28,
  xl: 32,
  '2xl': 36,
  '3xl': 42,
  '4xl': 48,
  emergencyCountdown: 80,
} as const;

export const LetterSpacing = {
  tight: -0.5,
  normal: 0,
  wide: 0.5,
  wider: 1,
} as const;

export const Typography = {
  fontFamily: FontFamily,
  fontWeight: FontWeight,
  fontSize: FontSize,
  lineHeight: LineHeight,
  letterSpacing: LetterSpacing,

  display: {
    fontFamily: FontFamily.extraBold,
    fontSize: FontSize['3xl'],
    lineHeight: LineHeight['3xl'],
    letterSpacing: LetterSpacing.tight,
  },
  h1: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize['2xl'],
    lineHeight: LineHeight['2xl'],
    letterSpacing: LetterSpacing.tight,
  },
  h2: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.xl,
    lineHeight: LineHeight.xl,
    letterSpacing: LetterSpacing.normal,
  },
  h3: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.lg,
    lineHeight: LineHeight.lg,
    letterSpacing: LetterSpacing.normal,
  },
  body: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    lineHeight: LineHeight.base,
    letterSpacing: LetterSpacing.normal,
  },
  bodyMedium: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.base,
    lineHeight: LineHeight.base,
    letterSpacing: LetterSpacing.normal,
  },
  caption: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    lineHeight: LineHeight.sm,
    letterSpacing: LetterSpacing.normal,
  },
  label: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    lineHeight: LineHeight.sm,
    letterSpacing: LetterSpacing.wide,
  },
  button: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.md,
    lineHeight: LineHeight.md,
    letterSpacing: LetterSpacing.normal,
  },
  emergencyCountdown: {
    fontFamily: FontFamily.extraBold,
    fontSize: FontSize.emergencyCountdown,
    lineHeight: LineHeight.emergencyCountdown,
    letterSpacing: LetterSpacing.tight,
  },
} as const;

export type TypographyStyle = keyof typeof Typography;
