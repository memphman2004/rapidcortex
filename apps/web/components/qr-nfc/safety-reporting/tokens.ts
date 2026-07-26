/** Shared brand tokens for QR/NFC public safety reporting landings. */
export const SAFETY_BRAND = {
  navy: "#0B162C",
  navyDeep: "#101B33",
  deepBlue: "#123B73",
  rapidRed: "#E11D2E",
  white: "#FFFFFF",
  lightBg: "#F5F8FC",
  actionGreen: "#14B87A",
  actionGreenHover: "#0FA66C",
  textDark: "#1E2A44",
  muted: "#64748B",
  border: "#E2E8F0",
  cardShadow: "0 10px 40px rgba(11, 22, 44, 0.08)",
} as const;

export type SafetyBrand = typeof SAFETY_BRAND;
