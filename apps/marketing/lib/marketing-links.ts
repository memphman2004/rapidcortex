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

export function marketingContactPath(): string {
  return "/contact";
}

export function marketingContactSalesPath(): string {
  return "/contact-sales";
}

export const MARKETING_CALENDLY_DEMO_URL = "https://calendly.com/rapidcortex/demo";

export function marketingDemoRequestPath(interest?: string): string {
  const base = marketingContactSalesPath();
  if (!interest?.trim()) return base;
  return `${base}?interest=${encodeURIComponent(interest.trim())}`;
}

export function marketingCalendlyDemoUrl(): string {
  return marketingDemoRequestPath("demo");
}

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
  return withAppOrigin("/sms-consent");
}

export function marketingCompleteManualPath(): string {
  return "/docs/rapidcortex-complete-manual.html";
}
