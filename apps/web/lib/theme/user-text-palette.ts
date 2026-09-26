/**
 * Per-user typography colors for normal UI text only.
 *
 * Operational / safety / incident colors (--rc-red, --rc-amber, --rc-green,
 * priority, badges, maps, alerts) are never written by this module.
 */

export const USER_TEXT_ROLES = ["primary", "secondary", "labels", "transcript"] as const;
export type UserTextRole = (typeof USER_TEXT_ROLES)[number];

export type UserTextMode = "dark" | "light";

export type UserTextRoleColors = Partial<Record<UserTextRole, string>>;

export type UserTextColorPrefs = {
  dark: UserTextRoleColors;
  light: UserTextRoleColors;
};

export const USER_TEXT_ROLE_LABELS: Record<UserTextRole, string> = {
  primary: "Primary text",
  secondary: "Secondary text",
  labels: "Labels",
  transcript: "Transcript text",
};

export const USER_TEXT_ROLE_HELP: Record<UserTextRole, string> = {
  primary: "Headings, incident titles, and primary information.",
  secondary: "Supporting copy and descriptions.",
  labels: "Field names, timestamps, and metadata.",
  transcript: "Normal caller and dispatcher transcription.",
};

/** Factory NexCort iQ tokens — Default / Reset restore these (no override). */
export const USER_TEXT_FACTORY: Record<UserTextMode, Record<UserTextRole, string>> = {
  dark: {
    primary: "#e4dff5",
    secondary: "#7c6fa0",
    labels: "#5a4d7a",
    transcript: "#e4dff5",
  },
  light: {
    primary: "#0f0e1a",
    secondary: "#2f2d45",
    labels: "#3f3d56",
    transcript: "#0f0e1a",
  },
};

export const USER_TEXT_BG: Record<UserTextMode, string> = {
  dark: "#0a0812",
  light: "#ffffff",
};

/** WCAG AA normal-text contrast. */
export const USER_TEXT_MIN_CONTRAST = 4.5;

/**
 * CSS custom properties this feature is allowed to write.
 * Keep this list exhaustive — tests fail if apply logic touches operational vars.
 */
export const USER_TEXT_WRITABLE_VARS = [
  "--rc-user-text-primary-dark",
  "--rc-user-text-secondary-dark",
  "--rc-user-text-labels-dark",
  "--rc-user-text-transcript-dark",
  "--rc-user-text-primary-light",
  "--rc-user-text-secondary-light",
  "--rc-user-text-labels-light",
  "--rc-user-text-transcript-light",
  "--rc-ui-font-scale",
] as const;

export const OPERATIONAL_COLOR_VARS = [
  "--rc-red",
  "--rc-red-dim",
  "--rc-red-border",
  "--rc-red-light",
  "--rc-amber",
  "--rc-amber-dim",
  "--rc-amber-border",
  "--rc-orange",
  "--rc-green",
  "--rc-green-dim",
  "--rc-green-border",
  "--rc-blue",
  "--p1-color",
  "--p2-color",
  "--p3-color",
  "--rc-yellow",
] as const;

export type PaletteSwatch = {
  id: string;
  hex: string;
  family: string;
};

/**
 * Curated NexCort iQ accessibility palette (~60 shades).
 * Rows follow the iOS-style family grouping; contrast filtering hides
 * unreadable shades per Light / Dark background.
 */
export const USER_TEXT_PALETTE: readonly PaletteSwatch[] = [
  // Neutrals
  { id: "snow-1", hex: "#FFFFFF", family: "Snow" },
  { id: "snow-2", hex: "#F8FAFC", family: "Snow" },
  { id: "snow-3", hex: "#E2E8F0", family: "Snow" },
  { id: "snow-4", hex: "#CBD5E1", family: "Snow" },
  { id: "charcoal-1", hex: "#64748B", family: "Charcoal" },
  { id: "charcoal-2", hex: "#475569", family: "Charcoal" },
  { id: "charcoal-3", hex: "#334155", family: "Charcoal" },
  { id: "charcoal-4", hex: "#1E293B", family: "Charcoal" },
  { id: "charcoal-5", hex: "#0F172A", family: "Charcoal" },
  // Sky / light blue
  { id: "sky-1", hex: "#E0F2FE", family: "Sky" },
  { id: "sky-2", hex: "#BAE6FD", family: "Sky" },
  { id: "sky-3", hex: "#7DD3FC", family: "Sky" },
  { id: "sky-4", hex: "#38BDF8", family: "Sky" },
  { id: "sky-5", hex: "#0284C7", family: "Sky" },
  // Cyan
  { id: "cyan-1", hex: "#CFFAFE", family: "Cyan" },
  { id: "cyan-2", hex: "#A5F3FC", family: "Cyan" },
  { id: "cyan-3", hex: "#67E8F9", family: "Cyan" },
  { id: "cyan-4", hex: "#22D3EE", family: "Cyan" },
  { id: "cyan-5", hex: "#0E7490", family: "Cyan" },
  // Soft green / mint
  { id: "mint-1", hex: "#ECFDF5", family: "Mint" },
  { id: "mint-2", hex: "#A7F3D0", family: "Mint" },
  { id: "mint-3", hex: "#6EE7B7", family: "Mint" },
  { id: "mint-4", hex: "#34D399", family: "Mint" },
  { id: "mint-5", hex: "#047857", family: "Mint" },
  // Lime
  { id: "lime-1", hex: "#F7FEE7", family: "Lime" },
  { id: "lime-2", hex: "#D9F99D", family: "Lime" },
  { id: "lime-3", hex: "#A3E635", family: "Lime" },
  { id: "lime-4", hex: "#65A30D", family: "Lime" },
  { id: "lime-5", hex: "#3F6212", family: "Lime" },
  // Gold
  { id: "gold-1", hex: "#FEFCE8", family: "Gold" },
  { id: "gold-2", hex: "#FDE68A", family: "Gold" },
  { id: "gold-4", hex: "#B45309", family: "Gold" },
  { id: "gold-5", hex: "#78350F", family: "Gold" },
  // Peach
  { id: "peach-1", hex: "#FFF7ED", family: "Peach" },
  { id: "peach-2", hex: "#FED7AA", family: "Peach" },
  { id: "peach-3", hex: "#FB923C", family: "Peach" },
  { id: "peach-4", hex: "#C2410C", family: "Peach" },
  { id: "peach-5", hex: "#7C2D12", family: "Peach" },
  // Rose (not emergency red — lighter/darker personalization only)
  { id: "rose-1", hex: "#FFF1F2", family: "Rose" },
  { id: "rose-2", hex: "#FECDD3", family: "Rose" },
  { id: "rose-3", hex: "#FDA4AF", family: "Rose" },
  { id: "rose-4", hex: "#E11D48", family: "Rose" },
  { id: "rose-5", hex: "#9F1239", family: "Rose" },
  // Lilac
  { id: "lilac-1", hex: "#FAF5FF", family: "Lilac" },
  { id: "lilac-2", hex: "#E9D5FF", family: "Lilac" },
  { id: "lilac-3", hex: "#D8B4FE", family: "Lilac" },
  { id: "lilac-4", hex: "#A855F7", family: "Lilac" },
  { id: "lilac-5", hex: "#6B21A8", family: "Lilac" },
  // Periwinkle
  { id: "peri-1", hex: "#EEF2FF", family: "Periwinkle" },
  { id: "peri-2", hex: "#C7D2FE", family: "Periwinkle" },
  { id: "peri-3", hex: "#A5B4FC", family: "Periwinkle" },
  { id: "peri-4", hex: "#6366F1", family: "Periwinkle" },
  { id: "peri-5", hex: "#3730A3", family: "Periwinkle" },
  // Navy
  { id: "navy-1", hex: "#DBEAFE", family: "Navy" },
  { id: "navy-2", hex: "#93C5FD", family: "Navy" },
  { id: "navy-3", hex: "#3B82F6", family: "Navy" },
  { id: "navy-4", hex: "#1D4ED8", family: "Navy" },
  { id: "navy-5", hex: "#1E3A8A", family: "Navy" },
  // Slate blue
  { id: "slateblue-1", hex: "#F1F5F9", family: "Slate" },
  { id: "slateblue-2", hex: "#94A3B8", family: "Slate" },
  { id: "slateblue-3", hex: "#64748B", family: "Slate" },
  { id: "slateblue-4", hex: "#334155", family: "Slate" },
  { id: "ink-1", hex: "#0F0E1A", family: "Ink" },
  { id: "ink-2", hex: "#111827", family: "Ink" },
  { id: "ink-3", hex: "#1F2937", family: "Ink" },
  { id: "ink-4", hex: "#1E3A5F", family: "Ink" },
  { id: "ink-5", hex: "#1E40AF", family: "Ink" },
  { id: "ink-6", hex: "#134E4A", family: "Ink" },
  { id: "ink-7", hex: "#14532D", family: "Ink" },
  { id: "ink-8", hex: "#312E81", family: "Ink" },
];

const HEX_RE = /^#([0-9a-fA-F]{6})$/;

export function isUserTextHex(value: string): boolean {
  return HEX_RE.test(value.trim());
}

function channelToLinear(channel: number): number {
  const s = channel / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const raw = hex.trim().replace("#", "");
  const r = Number.parseInt(raw.slice(0, 2), 16);
  const g = Number.parseInt(raw.slice(2, 4), 16);
  const b = Number.parseInt(raw.slice(4, 6), 16);
  return 0.2126 * channelToLinear(r) + 0.7152 * channelToLinear(g) + 0.0722 * channelToLinear(b);
}

export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const light = Math.max(a, b);
  const dark = Math.min(a, b);
  return (light + 0.05) / (dark + 0.05);
}

export function swatchMeetsContrast(hex: string, mode: UserTextMode): boolean {
  return contrastRatio(hex, USER_TEXT_BG[mode]) >= USER_TEXT_MIN_CONTRAST;
}

export function paletteForMode(mode: UserTextMode): PaletteSwatch[] {
  return USER_TEXT_PALETTE.filter((swatch) => swatchMeetsContrast(swatch.hex, mode));
}

export function emptyUserTextPrefs(): UserTextColorPrefs {
  return { dark: {}, light: {} };
}

export function normalizeHex(value: string): string | null {
  const trimmed = value.trim();
  if (!isUserTextHex(trimmed)) return null;
  return `#${trimmed.slice(1).toUpperCase()}`;
}

export function parseUserTextPrefs(raw: unknown): UserTextColorPrefs {
  const empty = emptyUserTextPrefs();
  if (!raw || typeof raw !== "object") return empty;
  const record = raw as Record<string, unknown>;
  const parseMode = (mode: UserTextMode): UserTextRoleColors => {
    const block = record[mode];
    if (!block || typeof block !== "object") return {};
    const src = block as Record<string, unknown>;
    const out: UserTextRoleColors = {};
    for (const role of USER_TEXT_ROLES) {
      const hex = typeof src[role] === "string" ? normalizeHex(src[role]) : null;
      if (hex && swatchMeetsContrast(hex, mode)) out[role] = hex;
    }
    return out;
  };
  return { dark: parseMode("dark"), light: parseMode("light") };
}

export function resolvedRoleColor(
  prefs: UserTextColorPrefs,
  mode: UserTextMode,
  role: UserTextRole,
): string {
  return prefs[mode][role] ?? USER_TEXT_FACTORY[mode][role];
}

export function cssVarForRole(mode: UserTextMode, role: UserTextRole): string {
  return `--rc-user-text-${role}-${mode}`;
}
