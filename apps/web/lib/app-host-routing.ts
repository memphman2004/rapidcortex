import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { dashboardPrefixFromPathname } from "@/lib/dashboards/dashboard-access";
import { publicAbsoluteUrl } from "@/lib/request-origin";
import { RESERVED_PUBLIC_ROUTE_FIRST_SEGMENTS } from "@/lib/reserved-public-route-segments";

/** Production app hostname when marketing is hosted separately (static www). */
const DEFAULT_APP_HOSTNAME = "app.rapidcortex.us";
const DEFAULT_MARKETING_SITE_ORIGIN = "https://www.rapidcortex.us";

const MARKETING_ROOT_SEGMENTS = new Set<string>([
  ...RESERVED_PUBLIC_ROUTE_FIRST_SEGMENTS,
  "demo",
  "venue",
  "product",
  "press",
  "legal",
  "developers",
  "integrations",
  "911-call-transcription",
  "911-dispatch-software",
  "ng911-software",
  "psap-software",
  "public-safety-intelligence",
  "free-60-day-pilot",
  "request-demo",
  "book-demo",
  "supervisor-dashboard",
]);

const APP_OPERATIONAL_ROOT_SEGMENTS = new Set<string>([
  "login",
  "auth",
  "api",
  "change-password",
  "unauthorized",
  "access-restricted",
  "hospital-portal",
  "sms-consent",
  "manifest.webmanifest",
  "_next",
  "docs",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
  "video-assist",
  "silent-text",
]);

export function getConfiguredAppHostname(): string {
  const origin = process.env.NEXT_PUBLIC_APP_ORIGIN?.trim();
  if (origin) {
    try {
      return new URL(origin).hostname.toLowerCase();
    } catch {
      /* fall through */
    }
  }
  return DEFAULT_APP_HOSTNAME;
}

export function getConfiguredMarketingSiteOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_MARKETING_SITE_URL?.trim().replace(/\/$/, "");
  if (explicit) return explicit;
  return DEFAULT_MARKETING_SITE_ORIGIN;
}

/** SSR prod task sets SITE_URL to the app host; APP_ORIGIN may exist only at image build time. */
function isAppOnlySsrDeployment(): boolean {
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const app = process.env.NEXT_PUBLIC_APP_ORIGIN?.trim();
  const configuredApp = getConfiguredAppHostname();
  try {
    if (site && app) {
      return new URL(site).hostname.toLowerCase() === new URL(app).hostname.toLowerCase();
    }
    if (site) {
      return new URL(site).hostname.toLowerCase() === configuredApp;
    }
  } catch {
    return false;
  }
  return false;
}

function viewerHostname(request: NextRequest): string | null {
  const forwarded = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = request.headers.get("host")?.split(":")[0]?.trim();
  return (forwarded || host)?.toLowerCase() ?? null;
}

export function isAppHostRequest(request: NextRequest): boolean {
  const configuredApp = getConfiguredAppHostname();
  if (isAppOnlySsrDeployment()) return true;
  const host = viewerHostname(request);
  return Boolean(host && host === configuredApp);
}

/** True when the path is the public marketing site, not workspace/auth/API routes. */
export function isMarketingPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;

  if (dashboardPrefixFromPathname(pathname)) return false;

  const segments = pathname.split("/").filter(Boolean);
  const first = segments[0];
  if (!first) return false;

  if (first === "rc-lite" && segments[1] === "portal") return false;

  if (APP_OPERATIONAL_ROOT_SEGMENTS.has(first)) return false;

  // Public intake routes (also in RESERVED_PUBLIC_ROUTE_FIRST_SEGMENTS for jurisdiction slug guards).
  if (first === "report" || first === "locate" || first === "r") return false;

  if (MARKETING_ROOT_SEGMENTS.has(first)) return true;

  // `/{jurisdiction}/…` workspace routes stay on the app host.
  return false;
}

/**
 * On the app subdomain, send marketing pages to www and `/` to sign-in.
 * Returns null when no redirect applies.
 */
export function maybeRedirectAppHostAwayFromMarketing(
  request: NextRequest,
): NextResponse | null {
  if (!isAppHostRequest(request)) return null;

  const pathname = request.nextUrl.pathname;
  if (!isMarketingPublicPath(pathname)) return null;

  if (pathname === "/") {
    const login = publicAbsoluteUrl("/login", request);
    login.search = request.nextUrl.search;
    return NextResponse.redirect(login);
  }

  const marketing = new URL(pathname, getConfiguredMarketingSiteOrigin());
  marketing.search = request.nextUrl.search;
  return NextResponse.redirect(marketing);
}
