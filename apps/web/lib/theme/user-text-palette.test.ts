import { describe, expect, it } from "vitest";
import {
  OPERATIONAL_COLOR_VARS,
  USER_TEXT_MIN_CONTRAST,
  USER_TEXT_PALETTE,
  USER_TEXT_WRITABLE_VARS,
  contrastRatio,
  emptyUserTextPrefs,
  parseUserTextPrefs,
  paletteForMode,
  swatchMeetsContrast,
} from "./user-text-palette";

describe("user text palette", () => {
  it("curates 50–70 accessibility shades", () => {
    expect(USER_TEXT_PALETTE.length).toBeGreaterThanOrEqual(50);
    expect(USER_TEXT_PALETTE.length).toBeLessThanOrEqual(70);
  });

  it("never writes operational or incident-status CSS variables", () => {
    const writable = new Set<string>(USER_TEXT_WRITABLE_VARS);
    for (const operational of OPERATIONAL_COLOR_VARS) {
      expect(writable.has(operational)).toBe(false);
    }
  });

  it("hides shades that fail WCAG AA against the active background", () => {
    const dark = paletteForMode("dark");
    const light = paletteForMode("light");
    expect(dark.length).toBeGreaterThanOrEqual(20);
    expect(light.length).toBeGreaterThanOrEqual(20);
    for (const swatch of dark) {
      expect(contrastRatio(swatch.hex, "#0a0812")).toBeGreaterThanOrEqual(USER_TEXT_MIN_CONTRAST);
    }
    for (const swatch of light) {
      expect(contrastRatio(swatch.hex, "#ffffff")).toBeGreaterThanOrEqual(USER_TEXT_MIN_CONTRAST);
    }
  });

  it("rejects stored colors that fail contrast for that mode", () => {
    const parsed = parseUserTextPrefs({
      dark: { primary: "#111111", secondary: "#F8FAFC" },
      light: { primary: "#FFFFFF", secondary: "#0F172A" },
    });
    expect(parsed.dark.primary).toBeUndefined();
    expect(parsed.dark.secondary).toBe("#F8FAFC");
    expect(parsed.light.primary).toBeUndefined();
    expect(parsed.light.secondary).toBe("#0F172A");
  });

  it("starts empty so factory NexCort iQ tokens remain until the user picks", () => {
    expect(emptyUserTextPrefs()).toEqual({ dark: {}, light: {} });
    expect(swatchMeetsContrast("#F8FAFC", "dark")).toBe(true);
    expect(swatchMeetsContrast("#0F172A", "light")).toBe(true);
  });
});
