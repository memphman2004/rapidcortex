/**
 * Rapid Cortex — theme token constants for inline styles.
 *
 * Values are CSS variable references. Hex lives in `app/globals.css` and swaps
 * when the shell sets `data-theme="light" | "dark"`.
 *
 * Never define a local `const V = { bg: "#080710" }` — those hex strings do not
 * flip with the theme toggle.
 *
 *   import { V } from "@/lib/theme/rc-theme-tokens";
 *   <div style={{ background: V.surface, color: V.text }} />
 */

export const V = {
  // Backgrounds
  bgDeep: "var(--rc-bg-deep)",
  bg: "var(--rc-bg)",
  surface: "var(--rc-surface)",
  surfaceAlt: "var(--rc-surface-alt)",
  surfaceHover: "var(--rc-surface-hover)",
  surfaceInput: "var(--rc-input-bg)",
  overlay: "var(--rc-overlay)",

  // Console glass / cards
  card: "var(--rc-card)",
  border: "var(--rc-border)",
  borderGlass: "var(--rc-border-glass)",
  borderHard: "var(--rc-border-hard)",
  borderHover: "var(--rc-border-hover)",
  borderSoft: "var(--rc-border-soft)",
  borderStrong: "var(--rc-border-strong)",
  borderFocus: "var(--rc-border-focus)",

  // Text
  text: "var(--rc-text-primary)",
  textPrimary: "var(--rc-text-primary)",
  textSecondary: "var(--rc-text-secondary)",
  textSub: "var(--rc-text-secondary)",
  textMuted: "var(--rc-text-muted)",
  muted: "var(--rc-text-muted)",
  faint: "var(--rc-text-faint)",
  placeholder: "var(--rc-text-placeholder)",
  silver: "var(--rc-silver)",
  dim: "var(--rc-text-muted)",

  // Accents
  violet: "var(--rc-violet)",
  violetDim: "var(--rc-violet-dim)",
  violetMid: "var(--rc-violet-mid)",
  violetBorder: "var(--rc-violet-border)",
  violetText: "var(--rc-violet-text)",
  violetHover: "var(--rc-violet-mid)",
  violetSoft: "var(--rc-violet-soft)",
  purple: "var(--rc-violet)",
  purpleDim: "var(--rc-violet-soft)",
  cardHover: "var(--rc-surface-alt)",

  red: "var(--rc-red)",
  redDim: "var(--rc-red-dim)",
  redBorder: "var(--rc-red-border)",
  redLight: "var(--rc-red-light)",

  amber: "var(--rc-amber)",
  amberDim: "var(--rc-amber-dim)",
  amberBorder: "var(--rc-amber-border)",
  orange: "var(--rc-orange)",

  green: "var(--rc-green)",
  greenDim: "var(--rc-green-dim)",
  greenBorder: "var(--rc-green-border)",
  successBg: "var(--rc-green-dim)",
  successBorder: "var(--rc-green-border)",
  successText: "var(--rc-green)",

  blue: "var(--rc-blue)",
  blueDim: "var(--rc-blue-dim)",
  blueBorder: "var(--rc-blue-border)",
  sky: "var(--rc-sky)",
  cyan: "var(--rc-cyan)",

  // Misc
  handle: "var(--rc-border-strong)",
  crest: "var(--rc-crest)",
  scrollbar: "var(--rc-scrollbar)",
  inputBg: "var(--rc-input-bg)",
  inputBorder: "var(--rc-input-border)",
} as const;

export type VTokenKey = keyof typeof V;

/** Console palette alias used by PSAP / Campus / Venue / RC Admin homes. */
export const C = {
  bg: V.bg,
  surface: V.surface,
  card: V.card,
  border: V.borderGlass,
  borderHard: V.borderHard,
  text: V.text,
  textSub: V.textSub,
  textMuted: V.textMuted,
  blue: V.blue,
  red: V.red,
  green: V.green,
  amber: V.amber,
  purple: V.purple,
  orange: V.orange,
  cyan: V.cyan,
} as const;
