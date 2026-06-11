/**
 * First URL segment for marketing/auth/static paths that must not be interpreted as a
 * workspace jurisdiction slug (`/{jurisdiction}/…`) in middleware.
 *
 * Never include role dashboard prefixes (`dispatcher`, `rc-admin`, …) — those are
 * handled separately by `dashboardPrefixFromPathname`.
 */
export const RESERVED_PUBLIC_ROUTE_FIRST_SEGMENTS: readonly string[] = [
  /** Desktop splash — marketing host only; not a jurisdiction slug. */
  "enter",
  "downloads",
  "rc-lite",
  "about",
  "contact",
  "pricing",
  "security",
  "solutions",
  "integrations",
  "cad",
  "cad-integration",
  "privacy",
  "terms",
  "careers",
  "support",
  "training",
  "signup",
  "logout",
  "desktop",
  "trust",
  "acceptable-use",
  "cookies",
  "contact-sales",
  /** Root checkout/billing UX (marketing), not `{jurisdiction}/billing`. */
  "billing",
  /** Public tooling root (`/status`, etc.). */
  "status",
  /** CDN-backed public media entrypoints at site root (not `{jurisdiction}/media`). */
  "media",
  /** Public QR/NFC citizen intake — no auth (`/report/{qrId}`). */
  "report",
  /** Public SMS GPS location share — no auth (`/locate/{token}`). */
  "locate",
  /** Legacy RCLI intake (`/r/{rcli}`). */
  "r",
];

export function isReservedPublicJurisdictionSlug(slug: string): boolean {
  return RESERVED_PUBLIC_ROUTE_FIRST_SEGMENTS.some(
    (s) => s.toLowerCase() === slug.toLowerCase(),
  );
}
