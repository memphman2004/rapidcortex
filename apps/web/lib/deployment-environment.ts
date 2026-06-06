/**
 * Separates **scripted academy / sales demo** surfaces from **production operations**.
 *
 * - `NEXT_PUBLIC_DEFAULT_JURISDICTION_SLUG` — primary workspace slug for `/{slug}/dashboard` and the `/login` page context.
 *   On a live PSAP site this should be your operational slug (often not `demo`).
 * - `NEXT_PUBLIC_DEMO_JURISDICTION_SLUG` — reserved label for the academy demo workspace (default `demo`).
 * - `NEXT_PUBLIC_ENABLE_DEMO_SCRIPTED_CONTENT` — toggles `/[slug]/demo`, side-nav Demo link, and related copy.
 *   Production builds default to **off** unless explicitly set to `true`.
 */

export function demoJurisdictionSlug(): string {
  return process.env.NEXT_PUBLIC_DEMO_JURISDICTION_SLUG?.trim() || "demo";
}

export function isDemoJurisdictionSlug(slug: string): boolean {
  return slug.trim().toLowerCase() === demoJurisdictionSlug().toLowerCase();
}

/**
 * Scripted scenarios, `/…/demo` runner, and nav entry — not live CAD traffic.
 * Set `NEXT_PUBLIC_ENABLE_DEMO_SCRIPTED_CONTENT=false` on production customer deployments.
 */
export function isDemoScriptedContentEnabled(): boolean {
  const raw = process.env.NEXT_PUBLIC_ENABLE_DEMO_SCRIPTED_CONTENT?.trim().toLowerCase();
  if (raw === "true" || raw === "1") return true;
  if (raw === "false" || raw === "0") return false;
  return process.env.NODE_ENV !== "production";
}
