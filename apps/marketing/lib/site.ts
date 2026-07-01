export const SITE_NAME = "Rapid Cortex";

/** Brand slogan — use in hero, footer, and high-visibility marketing surfaces. */
export const SITE_SLOGAN = "Intelligence When Every Second Matters";

/**
 * Full mission — homepage and footer; not necessarily every meta tag (see {@link SITE_DESCRIPTION}).
 * Rapid Cortex enhances existing systems of record; it does not replace CAD, telephony, or policy.
 */
export const SITE_MISSION =
  "Rapid Cortex's mission is to help public safety agencies respond faster, communicate clearer, and make better decisions with real-time intelligent software that supports dispatchers, supervisors, and emergency response teams without replacing the systems they already trust.";

/**
 * Default `<meta name="description">` / OG description — short, scannable, SEO-friendly.
 * Uses the slogan plus a one-line value prop.
 */
export const SITE_DESCRIPTION = `${SITE_SLOGAN} — Real-time decision support for public safety: dispatch, supervision, and emergency response. Does not replace CAD, telephony, or your agency's systems of record.`;
/** Canonical static brand directory (`apps/web/public/Logo/`). */
export const SITE_BRAND_ASSETS_BASE = "/Logo";

/**
 * Primary Rapid Cortex web mark used on marketing/header surfaces.
 * File: `public/Logo/rapid-cortex-logo-2.png` (1041×276 wordmark + tagline).
 */
export const SITE_BRAND_MARK_PATH = `${SITE_BRAND_ASSETS_BASE}/rapid-cortex-logo-2.png`;
export const SITE_BRAND_MARK_WIDTH = 1041;
export const SITE_BRAND_MARK_HEIGHT = 276;

/** Primary web mark (same as brand mark). */
export const SITE_LOGO_PATH = SITE_BRAND_MARK_PATH;
export const SITE_LOGO_WIDTH = SITE_BRAND_MARK_WIDTH;
export const SITE_LOGO_HEIGHT = SITE_BRAND_MARK_HEIGHT;

/** Hero / centered watermark behind neural traces (same asset). */
export const SITE_HERO_LOGO_PATH = SITE_BRAND_MARK_PATH;
export const SITE_HERO_LOGO_WIDTH = SITE_BRAND_MARK_WIDTH;
export const SITE_HERO_LOGO_HEIGHT = SITE_BRAND_MARK_HEIGHT;

/** Square mark for sidebars and compact chrome (192×192 PNG). */
export const SITE_SQUARE_ICON_PATH = `${SITE_BRAND_ASSETS_BASE}/icon.png`;
export const SITE_SQUARE_ICON_WIDTH = 192;
export const SITE_SQUARE_ICON_HEIGHT = 192;

/** @deprecated Prefer {@link SITE_SQUARE_ICON_PATH} for tab/sidebar marks. */
export const SITE_ICON_PATH = SITE_SQUARE_ICON_PATH;

/** PWA/installable chrome — align with globals.css slate-950 / slate-900. */
export const SITE_PWA_THEME_COLOR = "#0f172a";
export const SITE_PWA_BACKGROUND_COLOR = "#020617";

/**
 * Hosted paths for supplementary icons (`public/Logo/`). Source artwork: Rapid Cortex square marks.
 * See `app/icon.png`, `app/apple-icon.png`, and root layout `metadata.icons`.
 */
export const SITE_PUBLIC_ICON_PATHS = {
  tab: SITE_SQUARE_ICON_PATH,
  /** 180×180 for legacy `apple-touch-icon-precomposed` and some clients */
  appleTouch180: `${SITE_BRAND_ASSETS_BASE}/apple-touch-icon.png`,
  appleIcon: `${SITE_BRAND_ASSETS_BASE}/apple-touch-icon.png`,
  pwa192: `${SITE_BRAND_ASSETS_BASE}/icon-192.png`,
  pwa512: `${SITE_BRAND_ASSETS_BASE}/icon-512.png`,
} as const;

/** Shown in marketing footer (© line). */
export const SITE_COPYRIGHT_YEAR = 2026;

export const SITE_LEGAL_TAGLINE =
  "Decision support for emergency communications — not a replacement for CAD, telephony, or medical direction.";

/** Site build / operations credit. */
export const SITE_OPERATOR_NAME = "Apps on Demand";
export const SITE_OPERATOR_URL = "https://www.appsondemand.net";
