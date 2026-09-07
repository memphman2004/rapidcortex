export const Spacing = {
  /** 2px */
  '0.5': 2,
  /** 4px */
  '1': 4,
  /** 6px */
  '1.5': 6,
  /** 8px */
  '2': 8,
  /** 10px */
  '2.5': 10,
  /** 12px */
  '3': 12,
  /** 14px */
  '3.5': 14,
  /** 16px */
  '4': 16,
  /** 20px */
  '5': 20,
  /** 24px */
  '6': 24,
  /** 28px */
  '7': 28,
  /** 32px */
  '8': 32,
  /** 36px */
  '9': 36,
  /** 40px */
  '10': 40,
  /** 44px — minimum touch target */
  '11': 44,
  /** 48px */
  '12': 48,
  /** 56px */
  '14': 56,
  /** 64px */
  '16': 64,
  /** 80px — emergency cancel button height */
  '20': 80,
  /** 96px */
  '24': 96,
} as const;

export const BorderRadius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 20,
  full: 9999,
} as const;

export const IconSize = {
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
  '2xl': 40,
} as const;

export const Layout = {
  screenPaddingHorizontal: Spacing['4'],
  screenPaddingVertical: Spacing['6'],
  cardPadding: Spacing['4'],
  sectionGap: Spacing['6'],
  listItemGap: Spacing['3'],
  minTouchTarget: Spacing['11'],
  mapPreviewHeight: 200,
  emergencyCancelButtonHeight: Spacing['20'],
} as const;
