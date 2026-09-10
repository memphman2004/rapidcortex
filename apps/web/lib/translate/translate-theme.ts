import type { TranslateVertical } from "rapid-cortex-shared";

export interface TranslateTheme {
  bg: string;
  surface: string;
  border: string;
  primaryColor: string;
  secondaryColor: string;
  primaryBubbleBg: string;
  primaryBubbleBorder: string;
  secondaryBubbleBg: string;
  secondaryBubbleBorder: string;
  textPrimary: string;
  textMuted: string;
  sweepPrimary: string;
  sweepSecondary: string;
  navAccent: string;
  fontFamily: string;
}

export const TRANSLATE_THEMES: Record<TranslateVertical, TranslateTheme> = {
  law_enforcement: {
    bg: "#080B10",
    surface: "#0C1219",
    border: "#111820",
    primaryColor: "#2563EB",
    secondaryColor: "#0A9070",
    primaryBubbleBg: "#0B1A3C",
    primaryBubbleBorder: "rgba(37,99,235,.32)",
    secondaryBubbleBg: "#062820",
    secondaryBubbleBorder: "rgba(10,144,112,.32)",
    textPrimary: "#DDE4EE",
    textMuted: "#3E5068",
    sweepPrimary: "#2563EB",
    sweepSecondary: "#0A9070",
    navAccent: "#2563EB",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  venue: {
    bg: "#0c0b14",
    surface: "#100e1a",
    border: "#1e1a30",
    primaryColor: "#8b5cf6",
    secondaryColor: "#10b981",
    primaryBubbleBg: "#1a1528",
    primaryBubbleBorder: "rgba(139,92,246,.32)",
    secondaryBubbleBg: "#0a1810",
    secondaryBubbleBorder: "rgba(16,185,129,.32)",
    textPrimary: "#e4dff5",
    textMuted: "#5a4d7a",
    sweepPrimary: "#8b5cf6",
    sweepSecondary: "#10b981",
    navAccent: "#8b5cf6",
    fontFamily: "Inter, -apple-system, sans-serif",
  },
  campus: {
    bg: "#080c10",
    surface: "#0c1118",
    border: "#111d26",
    primaryColor: "#3b82f6",
    secondaryColor: "#f59e0b",
    primaryBubbleBg: "#0a1a30",
    primaryBubbleBorder: "rgba(59,130,246,.32)",
    secondaryBubbleBg: "#1a1200",
    secondaryBubbleBorder: "rgba(245,158,11,.32)",
    textPrimary: "#dce8f4",
    textMuted: "#3a4d62",
    sweepPrimary: "#3b82f6",
    sweepSecondary: "#f59e0b",
    navAccent: "#3b82f6",
    fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
  },
  hospital: {
    bg: "#060c10",
    surface: "#0a1218",
    border: "#0f1d26",
    primaryColor: "#0ea5e9",
    secondaryColor: "#10b981",
    primaryBubbleBg: "#051422",
    primaryBubbleBorder: "rgba(14,165,233,.32)",
    secondaryBubbleBg: "#041410",
    secondaryBubbleBorder: "rgba(16,185,129,.32)",
    textPrimary: "#d8eaf6",
    textMuted: "#2d4a5e",
    sweepPrimary: "#0ea5e9",
    sweepSecondary: "#10b981",
    navAccent: "#0ea5e9",
    fontFamily: "Inter, system-ui, sans-serif",
  },
};

export function getTranslateTheme(vertical: TranslateVertical): TranslateTheme {
  return TRANSLATE_THEMES[vertical];
}
