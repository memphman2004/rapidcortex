export { demoJurisdictionSlug, isDemoJurisdictionSlug } from "./deployment-environment";

/**
 * Primary workspace slug in URLs for dashboards (`/{slug}/dashboard`). Sign-in is canonical `/login`.
 * Set per deployment to your operational tenant — see `demoJurisdictionSlug()` for academy-only slugs.
 */
export function defaultJurisdictionSlug(): string {
  return process.env.NEXT_PUBLIC_DEFAULT_JURISDICTION_SLUG?.trim() || "example-city";
}

/**
 * SSR app origin when marketing is hosted separately (e.g. `https://app.rapidcortex.us`).
 * Empty on same-host deployments — paths stay relative.
 */
export function marketingAppOrigin(): string {
  return process.env.NEXT_PUBLIC_APP_ORIGIN?.trim().replace(/\/$/, "") ?? "";
}

function withAppOrigin(path: string): string {
  const origin = marketingAppOrigin();
  if (!origin) return path;
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Canonical product sign-in — app subdomain when {@link marketingAppOrigin} is set. */
export function marketingLoginPath(): string {
  return withAppOrigin("/login");
}

export function marketingDashboardPath(): string {
  return withAppOrigin(`/${defaultJurisdictionSlug()}/dashboard`);
}

/** Marketing site routes (same origin as the Next.js app). */
export function marketingHomePath(): string {
  return "/";
}

export function marketingSignupPath(): string {
  return withAppOrigin("/signup");
}

export function marketingPricingPath(): string {
  return "/pricing";
}

/** Public product demo (embedded video + live demo request). */
export function marketingDemoPath(): string {
  return "/demo";
}

/** Venue safety product page. */
export function marketingVenuePath(): string {
  return "/venue";
}

/** Press & media resources (footer-linked). */
export function marketingPressPath(): string {
  return "/press";
}

/** Public information page for native desktop apps (no installers linked). */
export function marketingDesktopPath(): string {
  return "/desktop";
}

export function marketingCadPath(): string {
  return "/cad";
}

export function marketingSecurityPath(): string {
  return "/security";
}

export function marketingContactPath(): string {
  return "/contact";
}

/** Sales-qualified conversations (pricing, integrations, pilots). */
export function marketingContactSalesPath(): string {
  return "/contact-sales";
}

/**
 * Calendly is sent manually after a demo/sales form submission is reviewed — not linked from public CTAs.
 * @internal
 */
export const MARKETING_CALENDLY_DEMO_URL = "https://calendly.com/rapidcortex/demo";

/** Public demo / sales intake form (same-origin). */
export function marketingDemoRequestPath(interest?: string): string {
  const base = marketingContactSalesPath();
  if (!interest?.trim()) return base;
  return `${base}?interest=${encodeURIComponent(interest.trim())}`;
}

/** @deprecated Use {@link marketingDemoRequestPath} — kept for incremental import renames. */
export function marketingCalendlyDemoUrl(): string {
  return marketingDemoRequestPath("demo");
}

/** `/book-demo` redirects here in `next.config.mjs`. */
export function marketingBookDemoPath(): string {
  return marketingDemoRequestPath("demo");
}

export function marketingRcLitePath(): string {
  return "/rc-lite";
}

export function marketingSolutionsAgenciesPath(): string {
  return "/solutions/agencies";
}

export function marketingSolutionsVendorsPath(): string {
  return "/solutions/vendors";
}

export function marketingDevelopersApiPath(): string {
  return "/developers";
}

/** Embedded REST/OpenAPI-facing landing page (marketing). */
export function marketingDevelopersRestApiDocsPath(): string {
  return "/developers/api";
}

/** Public downloads hub (marketing). */
export function marketingDownloadsPath(): string {
  return "/downloads";
}

/** Ops status page shipped with the web app. */
export function marketingOperationsStatusPath(): string {
  return "/status";
}

export function marketingPrivacyPath(): string {
  return "/privacy";
}

export function marketingTermsPath(): string {
  return "/terms";
}

export function marketingCookiePolicyPath(): string {
  return "/cookies";
}

export function marketingAcceptableUsePath(): string {
  return "/acceptable-use";
}

/** Public SMS consent disclosure (toll-free / carrier verification). */
export function marketingSmsConsentPath(): string {
  return "/sms-consent";
}

/** Complete operations manual (`public/docs/`) — requires signed-in subscriber access (middleware). */
export function marketingCompleteManualPath(): string {
  return "/docs/rapidcortex-complete-manual.html";
}
