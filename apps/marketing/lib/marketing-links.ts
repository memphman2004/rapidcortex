export { demoJurisdictionSlug, isDemoJurisdictionSlug } from "./deployment-environment";

const DEFAULT_APP_ORIGIN = "https://app.rapidcortex.us";

export function defaultJurisdictionSlug(): string {
  return process.env.NEXT_PUBLIC_DEFAULT_JURISDICTION_SLUG?.trim() || "example-city";
}

/** SSR app origin — marketing static host always links to the app subdomain. */
export function marketingAppOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_APP_ORIGIN?.trim().replace(/\/$/, "") || DEFAULT_APP_ORIGIN
  );
}

function withAppOrigin(path: string): string {
  const origin = marketingAppOrigin();
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}

export function marketingLoginPath(): string {
  return withAppOrigin("/login");
}

export function marketingDashboardPath(): string {
  return withAppOrigin(`/${defaultJurisdictionSlug()}/dashboard`);
}

export function marketingHomePath(): string {
  return "/";
}

/** Marketing site origin (www). */
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
  return "/pricing";
}

export function marketingDemoPath(): string {
  return "/demo";
}

export function marketingVenuePath(): string {
  return "/venue";
}

export function marketingPressPath(): string {
  return "/press";
}

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

export function marketingContactSalesPath(): string {
  // Absolute URL avoids Next `trailingSlash` rewriting to `/contact-sales/?…`
  // (CloudFront/S3 serves the homepage error document for that path).
  return `${marketingSiteOrigin()}/contact-sales`;
}

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

export function marketingDevelopersRestApiDocsPath(): string {
  return "/developers/api";
}

export function marketingDownloadsPath(): string {
  return "/downloads";
}

export function marketingOperationsStatusPath(): string {
  return withAppOrigin("/status");
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

export function marketingSmsConsentPath(): string {
  return "/sms-consent";
}

/** RC Lite developer guides — app host, session required. */
export function marketingDevelopersDocsPath(suffix = ""): string {
  const path = suffix ? `/developers/docs/${suffix.replace(/^\//, "")}` : "/developers/docs";
  return withAppOrigin(path);
}

export function marketingCompleteManualPath(): string {
  return "/docs/rapidcortex-complete-manual.html";
}
