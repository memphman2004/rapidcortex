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

/**
 * Public marketing pages live on www when {@link marketingAppOrigin} is set.
 * On the app host, `/` middleware-redirects to `/login`, so relative home links loop.
 */
function withMarketingOrigin(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (!marketingAppOrigin()) return normalized === "/" ? "/" : normalized;
  const origin = marketingSiteOrigin();
  return normalized === "/" ? `${origin}/` : `${origin}${normalized}`;
}

/** Canonical product sign-in — app subdomain when {@link marketingAppOrigin} is set. */
export function marketingLoginPath(): string {
  return withAppOrigin("/login");
}

export function marketingDashboardPath(): string {
  return withAppOrigin(`/${defaultJurisdictionSlug()}/dashboard`);
}

/** Marketing homepage (www when app/marketing hosts are split). */
export function marketingHomePath(): string {
  return withMarketingOrigin("/");
}

/** Marketing site origin when app runs on `app.*` (defaults to www). */
export function marketingSiteOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_MARKETING_SITE_URL?.trim().replace(/\/$/, "");
  if (explicit) return explicit;
  return "https://www.rapidcortex.us";
}

/** Ring Device Owners — public Connect enrollment (not agency login). */
export function marketingRingCustomersPath(): string {
  return `${marketingSiteOrigin()}/connect/ring/start`;
}

export function marketingSignupPath(): string {
  return withAppOrigin("/signup");
}

export function marketingPricingPath(): string {
  return withMarketingOrigin("/pricing");
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

export function marketingTrustPath(): string {
  return "/trust";
}

export function marketingContactPath(): string {
  /** All “Contact us” CTAs land on the CRM sales form. */
  return marketingDemoRequestPath("demo");
}

/** Sales-qualified conversations (pricing, integrations, pilots). */
export function marketingContactSalesPath(): string {
  // Absolute URL avoids Next `trailingSlash` rewriting to `/contact-sales/?…`
  // (CloudFront/S3 serves the homepage error document for that path).
  return `${marketingSiteOrigin()}/contact-sales`;
}

/** Public demo / sales intake form. Defaults to `interest=demo` for CRM. */
export function marketingDemoRequestPath(interest = "demo"): string {
  const base = marketingContactSalesPath();
  const q = interest.trim() || "demo";
  return `${base}?interest=${encodeURIComponent(q)}`;
}

/** Demo / appointment CTA — contact-sales form (not external calendaring). */
export const MARKETING_BOOK_APPOINTMENT_URL = marketingDemoRequestPath("demo");

/** @deprecated Use {@link MARKETING_BOOK_APPOINTMENT_URL}. */
export const MARKETING_CALENDLY_DEMO_URL = MARKETING_BOOK_APPOINTMENT_URL;

export function marketingBookAppointmentUrl(): string {
  return MARKETING_BOOK_APPOINTMENT_URL;
}

/** @deprecated Use {@link marketingBookAppointmentUrl}. */
export function marketingCalendlyDemoUrl(): string {
  return marketingBookAppointmentUrl();
}

/** `/book-demo` redirects here in `next.config.mjs`. */
export function marketingBookDemoPath(): string {
  return marketingBookAppointmentUrl();
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

/** Public SMS consent disclosure (marketing host: rapidcortex.us / www). */
export function marketingSmsConsentPath(): string {
  return "/sms-consent";
}

/** RC Lite developer guides — app host, session required (middleware). */
export function marketingDevelopersDocsPath(suffix = ""): string {
  const path = suffix ? `/developers/docs/${suffix.replace(/^\//, "")}` : "/developers/docs";
  return withAppOrigin(path);
}

/** Complete operations manual (`public/docs/`) — requires signed-in subscriber access (middleware). */
export function marketingCompleteManualPath(): string {
  return "/docs/rapidcortex-complete-manual.html";
}
