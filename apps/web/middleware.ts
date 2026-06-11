/**
 * Edge middleware: auth/session gates, CSRF on auth APIs, and **`parsePath()`**
 * classification for workspace vs public routes. Marketing roots (`/downloads`, `/rc-lite`, …)
 * are reserved via `RESERVED_PUBLIC_ROUTE_FIRST_SEGMENTS` so they are **not** treated as
 * `{jurisdiction}` slugs (see `@/lib/reserved-public-route-segments`).
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  COOKIE_ID_TOKEN,
  COOKIE_PASSWORD_ROTATION_NAV_BYPASS,
  COOKIE_REFRESH_TOKEN,
} from "@/lib/auth/cookies";
import { ensureCsrfOnAuthApiRequest } from "@/lib/csrf";
import { isAdminRole, isAuthConfigured, isSupervisorOrAdmin } from "@/lib/auth/roles";
import { verifyCognitoIdToken } from "@/lib/auth/verify-cognito";
import {
  resolvePostAuthenticationHomeHref,
  resolveProductDashboardFromRoleAndAgency,
} from "@/lib/auth/post-login-redirect";
import {
  dashboardRouteFromRole,
  pathMatchesRoleDashboard,
  verticalFromRole,
} from "rapid-cortex-shared";
import type { UserContext } from "rapid-cortex-shared/types";
import {
  hasRapidCortexDashboardAccess,
  hasRcLitePortalAccess,
} from "rapid-cortex-shared/auth/session-product";
import { isHospitalOperatorRole } from "rapid-cortex-shared/auth/rapid-cortex-roles";
import { isRcInternalOperator, isRcsuperadmin } from "rapid-cortex-shared/tenancy/principal";
import {
  dashboardPrefixFromPathname,
  type DashboardPrefix,
  userMayAccessDashboardPrefix,
} from "@/lib/dashboards/dashboard-access";
import {
  isDispatchLiveWorkspaceSubpath,
  roleMayAccessDispatchLiveWorkspace,
} from "@/lib/dashboards/dispatch-workspace-access";
import {
  ANALYST_SUPERVISOR_PATHS,
  AUDITOR_READ_ADMIN_PATHS,
  resolvePsapRole,
} from "@/lib/dashboards/psap-role-nav";
import { isDemoScriptedContentEnabled } from "@/lib/deployment-environment";
import { defaultJurisdictionSlug, marketingLoginPath } from "@/lib/marketing-links";
import { mapJurisdictionPlatformPathToRcAdmin } from "@/lib/platform-command-nav";
import { RESERVED_PUBLIC_ROUTE_FIRST_SEGMENTS } from "@/lib/reserved-public-route-segments";
import { getMobileOperationalAuthMiddlewareResponse } from "@/lib/device/middleware-mobile-auth";
import { isAppHostRequest, maybeRedirectAppHostAwayFromMarketing } from "@/lib/app-host-routing";
import { maybeRedirectReportHost } from "@/lib/report-host-routing";
import { requiresOperationalPasswordRenewal } from "rapid-cortex-shared/auth/password-policy";
import { isHospitalPortalEnabled, isNetworkAccessGateEnabled } from "@/lib/runtime-flags";

function isHospitalDashboardPrefix(prefix: DashboardPrefix): boolean {
  return prefix === "hospital-admin" || prefix === "hospital-staff";
}

function passwordRotationNavBypassActive(request: NextRequest): boolean {
  return request.cookies.get(COOKIE_PASSWORD_ROTATION_NAV_BYPASS)?.value === "1";
}

function splashViewerHostname(request: NextRequest): string | null {
  const forwarded = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = request.headers.get("host")?.split(":")[0]?.trim();
  return (forwarded || host)?.toLowerCase() ?? null;
}

/** Desktop marketing visitors without `cortex_entered` see `/enter` once per 24h session. */
function maybeRedirectToSplash(request: NextRequest): NextResponse | null {
  if (isAppHostRequest(request)) return null;

  const { pathname } = request.nextUrl;
  if (pathname !== "/") return null;

  if (request.cookies.get("cortex_entered")?.value === "1") return null;

  const ua = request.headers.get("user-agent") ?? "";
  if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
    return null;
  }

  const host = splashViewerHostname(request);
  const isMarketingHost =
    host === "rapidcortex.us" ||
    host === "www.rapidcortex.us" ||
    (host?.startsWith("localhost") ?? false);
  if (!isMarketingHost) return null;

  return NextResponse.redirect(new URL("/enter", request.url));
}

/** Next.js RSC / router prefetch must not receive HTML redirects (breaks client navigation). */
function isNextFlightOrPrefetchRequest(request: NextRequest): boolean {
  if (request.headers.get("RSC") === "1") return true;
  if (request.headers.get("Next-Router-Prefetch") === "1") return true;
  if (request.headers.get("Purpose") === "prefetch") return true;
  if (request.nextUrl.searchParams.has("_rsc")) return true;
  return false;
}

/** After a successful password change, JWT `custom:pwdChangedAt` may lag; short-lived bypass cookie (see apply-password cookie TTL). */
function handleOperationalPasswordRenewalGate(
  request: NextRequest,
  user: UserContext,
  changePasswordUrl: URL,
): NextResponse | null {
  if (!requiresOperationalPasswordRenewal(user)) return null;
  if (passwordRotationNavBypassActive(request)) {
    return NextResponse.next();
  }
  if (isNextFlightOrPrefetchRequest(request)) {
    return NextResponse.next();
  }
  return NextResponse.redirect(changePasswordUrl);
}

/**
 * When the network-access gate is on, asks the API (authoritative) whether this session may load
 * protected HTML. Does not duplicate CIDR or schedule logic in the edge bundle.
 */
async function maybeBlockNetworkAccess(
  request: NextRequest,
  user: UserContext,
): Promise<NextResponse | null> {
  if (!isNetworkAccessGateEnabled()) return null;
  if (isRcsuperadmin(user) || isRcInternalOperator(user.role)) return null;
  if (isNextFlightOrPrefetchRequest(request)) return null;
  const pathname = request.nextUrl.pathname;
  if (pathname === "/access-restricted" || pathname.startsWith("/access-restricted/")) {
    return null;
  }

  try {
    const check = new URL("/api/backend/api/agency/network-policy-check", request.url);
    const cookie = request.headers.get("cookie") ?? "";
    const res = await fetch(check, {
      headers: { cookie },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      data?: {
        allowed?: boolean;
        blockedBy?: string;
        retryAfter?: string;
      };
    };
    if (json?.data?.allowed !== false) return null;
    const dest = new URL("/access-restricted", request.url);
    dest.searchParams.set("reason", json.data.blockedBy ?? "ip_allowlist");
    if (json.data.retryAfter) dest.searchParams.set("retryAfter", json.data.retryAfter);
    return NextResponse.redirect(dest);
  } catch {
    return null;
  }
}

const protectedSubpaths = [
  "/dashboard",
  "/history",
  "/demo",
  "/admin",
  "/rc-admin",
  "/staff",
  "/dispatcher",
  "/review",
  "/supervisor",
  "/analytics",
  "/audit",
  "/shared-incoming",
  "/settings",
  "/incidents",
  "/calls",
  "/console",
] as const;

function jurisdictionSubpathIsPasswordChangeAllowed(subpath: string): boolean {
  return (
    subpath === "/settings/security" ||
    subpath === "/settings/security/" ||
    subpath.startsWith("/settings/security/")
  );
}

function isRcLitePortalPath(pathname: string): boolean {
  return pathname === "/rc-lite/portal" || pathname.startsWith("/rc-lite/portal/");
}

function isCampusDashboardPath(pathname: string): boolean {
  return pathname === "/app/campus" || pathname.startsWith("/app/campus/");
}

function isVenueDashboardPath(pathname: string): boolean {
  return (
    pathname === "/app/venue" ||
    pathname.startsWith("/app/venue/") ||
    pathname === "/venue" ||
    pathname.startsWith("/venue/")
  );
}

function isHospitalDashboardPath(pathname: string): boolean {
  return pathname === "/app/hospital" || pathname.startsWith("/app/hospital/");
}

function isTransitDashboardPath(pathname: string): boolean {
  return pathname === "/app/transit" || pathname.startsWith("/app/transit/");
}

function isAppVerticalDashboardPath(pathname: string): boolean {
  return (
    isCampusDashboardPath(pathname) ||
    isVenueDashboardPath(pathname) ||
    isHospitalDashboardPath(pathname) ||
    isTransitDashboardPath(pathname) ||
    pathname === "/app/dashboard" ||
    pathname.startsWith("/app/dashboard/")
  );
}

function isVenueRole(role: string | undefined): boolean {
  return verticalFromRole(role ?? "dispatcher") === "venue";
}

function isCampusRole(role: string | undefined): boolean {
  return verticalFromRole(role ?? "dispatcher") === "campus";
}

function isHospitalRole(role: string | undefined): boolean {
  const vertical = verticalFromRole(role ?? "dispatcher");
  return vertical === "hospital" || isHospitalOperatorRole(role);
}

function isTransitRole(role: string | undefined): boolean {
  return verticalFromRole(role ?? "dispatcher") === "transit";
}

function isProductRole(role: string | undefined): boolean {
  const vertical = verticalFromRole(role ?? "dispatcher");
  return vertical === "campus" || vertical === "venue" || vertical === "hospital" || vertical === "transit";
}

function redirectToRoleAwareHome(request: NextRequest, user: UserContext, jurisdictionSlug: string) {
  const path = resolvePostAuthenticationHomeHref(user, jurisdictionSlug);
  return NextResponse.redirect(new URL(path, request.url));
}

function redirectToRoleDashboard(request: NextRequest, user: UserContext): NextResponse {
  const home = dashboardRouteFromRole(user.role, user.agencyId);
  return NextResponse.redirect(new URL(home, request.url));
}

function ensureRoleDashboardPath(
  request: NextRequest,
  user: UserContext,
): NextResponse | null {
  if (isRcInternalOperator(user.role)) return null;
  const pathname = request.nextUrl.pathname;
  const vertical = verticalFromRole(user.role);

  if (vertical === "platform") {
    if (isAppVerticalDashboardPath(pathname)) {
      return redirectToRoleDashboard(request, user);
    }
    return null;
  }

  if (vertical !== "911") {
    if (!pathMatchesRoleDashboard(pathname, user.role, user.agencyId)) {
      return redirectToRoleDashboard(request, user);
    }
    return null;
  }

  if (isAppVerticalDashboardPath(pathname)) {
    return redirectToRoleDashboard(request, user);
  }

  return null;
}

/** Jurisdiction-path segments that imply the Rapid Cortex web dashboards (subscriber + entitlement gated). */
function jurisdictionSubpathRequiresDashboardEntitlement(subpath: string): boolean {
  const prefixes = [
    "/dashboard",
    "/admin",
    "/supervisor",
    "/dispatcher",
    "/review",
    "/staff",
    "/rc-admin",
    "/analytics",
    "/audit",
    "/shared-incoming",
  ] as const;
  return prefixes.some((p) => subpath === p || subpath.startsWith(`${p}/`));
}

/** First URL segment skipped for marketing/jurisdiction routing. */
const RESERVED_FIRST_SEGMENTS = new Set<string>([
  "_next",
  "api",
  "docs",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
  "video-assist",
  "silent-text",
  "locate",
  "developers",
  /** Canonical sign-in lives at `/login`, not `/{jurisdiction}/login`. */
  "login",
  /** Network / shift restriction messaging (reserved slug — not a jurisdiction). */
  "access-restricted",
  /** Standalone operational password renewal — not `{jurisdiction}/change-password`. */
  "change-password",
  /** Session load failure / incomplete profile fallback (avoid `[jurisdiction]` collision). */
  "unauthorized",
  /** Native OAuth bridge + return-to-app (Hosted UI handoff). */
  "auth",
  /** Public SMS consent proof (toll-free verification). */
  "sms-consent",
  /** Hospital capacity portal (legacy URL — redirects to role dashboards). */
  "hospital-portal",
  /**
   * PWA metadata route — first segment is literally `manifest.webmanifest`. If we treat it as a
   * `{jurisdiction}` slug and the browser requests `/manifest.webmanifest/dashboard` (bad href or
   * query glue), middleware would see `subpath` `/dashboard` and redirect to `/login?from=…`,
   * breaking manifest fetch and causing redirect / client errors.
   */
  "manifest.webmanifest",
  ...RESERVED_PUBLIC_ROUTE_FIRST_SEGMENTS,
]);

function parsePath(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) {
    return { kind: "root" as const };
  }
  const first = segments[0];
  if (RESERVED_FIRST_SEGMENTS.has(first)) {
    return { kind: "system" as const };
  }
  const rolePrefix = dashboardPrefixFromPathname(pathname);
  if (rolePrefix) {
    const subpath =
      segments.length === 1 ? "/" : `/${segments.slice(1).join("/")}`;
    return {
      kind: "role_dashboard" as const,
      prefix: rolePrefix,
      subpath,
    };
  }
  const jurisdiction = first;
  const subpath =
    segments.length === 1 ? "/" : `/${segments.slice(1).join("/")}`;
  return { kind: "jurisdiction" as const, jurisdiction, subpath };
}

/** HTML manuals under `public/docs/` — same session as app routes. */
async function guardAuthenticatedDocs(request: NextRequest): Promise<NextResponse> {
  const pathname = request.nextUrl.pathname;
  if (!isAuthConfigured()) {
    return NextResponse.next();
  }
  const loginPath = marketingLoginPath();
  const redirectToLogin = () => {
    const login = new URL(loginPath, request.url);
    login.searchParams.set("from", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(login);
  };

  const token = request.cookies.get(COOKIE_ID_TOKEN)?.value;
  const refresh = request.cookies.get(COOKIE_REFRESH_TOKEN)?.value;
  if (!token && !refresh) {
    return redirectToLogin();
  }

  const user = token ? await verifyCognitoIdToken(token) : null;
  if (!user && refresh) {
    const bounce = new URL("/api/auth/refresh-cookies", request.url);
    bounce.searchParams.set(
      "redirect_to",
      `${pathname}${request.nextUrl.search}`,
    );
    return NextResponse.redirect(bounce);
  }

  if (!user) {
    return redirectToLogin();
  }
  const docsRenewal = handleOperationalPasswordRenewalGate(
    request,
    user,
    new URL("/change-password", request.url),
  );
  if (docsRenewal) return docsRenewal;
  if (!hasRapidCortexDashboardAccess(user)) {
    if (hasRcLitePortalAccess(user)) {
      const portal = new URL("/rc-lite/portal", request.url);
      portal.searchParams.set("from", `${pathname}${request.nextUrl.search}`);
      return NextResponse.redirect(portal);
    }
    const denied = new URL(`/${defaultJurisdictionSlug()}/no-access`, request.url);
    denied.searchParams.set("reason", "dashboard_subscription_required");
    return NextResponse.redirect(denied);
  }

  const docsNetwork = await maybeBlockNetworkAccess(request, user);
  if (docsNetwork) return docsNetwork;

  return NextResponse.next();
}

async function guardStandaloneChangePasswordPage(request: NextRequest): Promise<NextResponse> {
  if (!isAuthConfigured()) {
    return NextResponse.next();
  }
  const pathname = request.nextUrl.pathname;
  const loginPath = marketingLoginPath();
  const redirectToLogin = () => {
    const login = new URL(loginPath, request.url);
    login.searchParams.set("from", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(login);
  };
  const token = request.cookies.get(COOKIE_ID_TOKEN)?.value;
  const refresh = request.cookies.get(COOKIE_REFRESH_TOKEN)?.value;
  if (!token && !refresh) {
    return redirectToLogin();
  }
  const user = token ? await verifyCognitoIdToken(token) : null;
  if (!user && refresh) {
    const bounce = new URL("/api/auth/refresh-cookies", request.url);
    bounce.searchParams.set("redirect_to", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(bounce);
  }
  if (!user) {
    return redirectToLogin();
  }
  return NextResponse.next();
}

async function guardRoleDashboard(
  request: NextRequest,
  prefix: DashboardPrefix,
  subpath: string,
): Promise<NextResponse> {
  if (!isAuthConfigured()) {
    return NextResponse.next();
  }
  const slug = defaultJurisdictionSlug();
  const loginPath = marketingLoginPath();
  const pathname = request.nextUrl.pathname;

  const redirectToLogin = () => {
    const login = new URL(loginPath, request.url);
    login.searchParams.set("from", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(login);
  };

  if (subpath === "/" || subpath === "") {
    return NextResponse.redirect(new URL(`/${prefix}/dashboard`, request.url));
  }

  /** All role-dashboard routes under `/{prefix}/…` require a session (not only `/dashboard`). */
  const needsAuth = true;

  const token = request.cookies.get(COOKIE_ID_TOKEN)?.value;
  const refresh = request.cookies.get(COOKIE_REFRESH_TOKEN)?.value;
  if (!token && !refresh) {
    return redirectToLogin();
  }

  const user = token ? await verifyCognitoIdToken(token) : null;
  if (!user && refresh) {
    const bounce = new URL("/api/auth/refresh-cookies", request.url);
    bounce.searchParams.set(
      "redirect_to",
      `${pathname}${request.nextUrl.search}`,
    );
    return NextResponse.redirect(bounce);
  }
  if (!user) {
    return redirectToLogin();
  }

  const roleDashRenewal = handleOperationalPasswordRenewalGate(
    request,
    user,
    new URL("/change-password", request.url),
  );
  if (roleDashRenewal) return roleDashRenewal;

  if (isHospitalDashboardPrefix(prefix)) {
    if (!isHospitalPortalEnabled()) {
      return new NextResponse(null, { status: 404 });
    }
    if (!userMayAccessDashboardPrefix(user, prefix)) {
      return redirectToRoleAwareHome(request, user, slug);
    }
    const hospitalNet = await maybeBlockNetworkAccess(request, user);
    if (hospitalNet) return hospitalNet;
    return NextResponse.next();
  }

  if (!hasRapidCortexDashboardAccess(user)) {
    if (hasRcLitePortalAccess(user)) {
      const portal = new URL("/rc-lite/portal", request.url);
      portal.searchParams.set("from", `${pathname}${request.nextUrl.search}`);
      return NextResponse.redirect(portal);
    }
    const denied = new URL(`/${defaultJurisdictionSlug()}/no-access`, request.url);
    denied.searchParams.set("reason", "dashboard_subscription_required");
    return NextResponse.redirect(denied);
  }

  if (!userMayAccessDashboardPrefix(user, prefix)) {
    return redirectToRoleAwareHome(request, user, slug);
  }

  const roleDashNetwork = await maybeBlockNetworkAccess(request, user);
  if (roleDashNetwork) return roleDashNetwork;

  return NextResponse.next();
}

async function guardRcLitePortal(request: NextRequest): Promise<NextResponse> {
  if (!isAuthConfigured()) {
    return NextResponse.next();
  }
  const pathname = request.nextUrl.pathname;
  const loginUrl = new URL(marketingLoginPath(), request.url);
  loginUrl.searchParams.set("from", `${pathname}${request.nextUrl.search}`);

  const token = request.cookies.get(COOKIE_ID_TOKEN)?.value;
  const refresh = request.cookies.get(COOKIE_REFRESH_TOKEN)?.value;
  if (!token && !refresh) {
    return NextResponse.redirect(loginUrl);
  }

  const user = token ? await verifyCognitoIdToken(token) : null;
  if (!user && refresh) {
    const bounce = new URL("/api/auth/refresh-cookies", request.url);
    bounce.searchParams.set("redirect_to", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(bounce);
  }

  if (!user) {
    return NextResponse.redirect(loginUrl);
  }

  const portalRenewal = handleOperationalPasswordRenewalGate(
    request,
    user,
    new URL("/change-password", request.url),
  );
  if (portalRenewal) return portalRenewal;

  if (!hasRcLitePortalAccess(user)) {
    if (hasRapidCortexDashboardAccess(user)) {
      return NextResponse.redirect(new URL("/agency-admin/api-access", request.url));
    }
    const marketing = new URL("/rc-lite", request.url);
    marketing.searchParams.set("reason", "api_subscription_required");
    return NextResponse.redirect(marketing);
  }

  const rcLiteNetwork = await maybeBlockNetworkAccess(request, user);
  if (rcLiteNetwork) return rcLiteNetwork;

  return NextResponse.next();
}

async function guardCampusDashboard(request: NextRequest): Promise<NextResponse> {
  if (!isAuthConfigured()) {
    return NextResponse.next();
  }
  const pathname = request.nextUrl.pathname;
  const loginUrl = new URL(marketingLoginPath(), request.url);
  loginUrl.searchParams.set("from", `${pathname}${request.nextUrl.search}`);

  const token = request.cookies.get(COOKIE_ID_TOKEN)?.value;
  const refresh = request.cookies.get(COOKIE_REFRESH_TOKEN)?.value;
  if (!token && !refresh) {
    return NextResponse.redirect(loginUrl);
  }

  const user = token ? await verifyCognitoIdToken(token) : null;
  if (!user && refresh) {
    const bounce = new URL("/api/auth/refresh-cookies", request.url);
    bounce.searchParams.set("redirect_to", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(bounce);
  }

  if (!user) {
    return NextResponse.redirect(loginUrl);
  }

  const campusRenewal = handleOperationalPasswordRenewalGate(
    request,
    user,
    new URL("/change-password", request.url),
  );
  if (campusRenewal) return campusRenewal;

  if (!isCampusRole(user.role) && !isRcInternalOperator(user.role)) {
    return redirectToRoleAwareHome(request, user, defaultJurisdictionSlug());
  }

  const campusRoute = ensureRoleDashboardPath(request, user);
  if (campusRoute) return campusRoute;

  const campusNetwork = await maybeBlockNetworkAccess(request, user);
  if (campusNetwork) return campusNetwork;

  return NextResponse.next();
}

async function guardVenueDashboard(request: NextRequest): Promise<NextResponse> {
  if (!isAuthConfigured()) {
    return NextResponse.next();
  }
  const pathname = request.nextUrl.pathname;
  const loginUrl = new URL(marketingLoginPath(), request.url);
  loginUrl.searchParams.set("from", `${pathname}${request.nextUrl.search}`);

  const token = request.cookies.get(COOKIE_ID_TOKEN)?.value;
  const refresh = request.cookies.get(COOKIE_REFRESH_TOKEN)?.value;
  if (!token && !refresh) {
    return NextResponse.redirect(loginUrl);
  }

  const user = token ? await verifyCognitoIdToken(token) : null;
  if (!user && refresh) {
    const bounce = new URL("/api/auth/refresh-cookies", request.url);
    bounce.searchParams.set("redirect_to", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(bounce);
  }

  if (!user) {
    return NextResponse.redirect(loginUrl);
  }

  const venueRenewal = handleOperationalPasswordRenewalGate(
    request,
    user,
    new URL("/change-password", request.url),
  );
  if (venueRenewal) return venueRenewal;

  if (!isVenueRole(user.role) && !isRcInternalOperator(user.role)) {
    return redirectToRoleAwareHome(request, user, defaultJurisdictionSlug());
  }

  const venueRoute = ensureRoleDashboardPath(request, user);
  if (venueRoute) return venueRoute;

  const venueNetwork = await maybeBlockNetworkAccess(request, user);
  if (venueNetwork) return venueNetwork;

  return NextResponse.next();
}

async function guardHospitalDashboard(request: NextRequest): Promise<NextResponse> {
  if (!isAuthConfigured()) {
    return NextResponse.next();
  }
  const pathname = request.nextUrl.pathname;
  const loginUrl = new URL(marketingLoginPath(), request.url);
  loginUrl.searchParams.set("from", `${pathname}${request.nextUrl.search}`);

  const token = request.cookies.get(COOKIE_ID_TOKEN)?.value;
  const refresh = request.cookies.get(COOKIE_REFRESH_TOKEN)?.value;
  if (!token && !refresh) {
    return NextResponse.redirect(loginUrl);
  }

  const user = token ? await verifyCognitoIdToken(token) : null;
  if (!user && refresh) {
    const bounce = new URL("/api/auth/refresh-cookies", request.url);
    bounce.searchParams.set("redirect_to", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(bounce);
  }

  if (!user) {
    return NextResponse.redirect(loginUrl);
  }

  const hospitalRenewal = handleOperationalPasswordRenewalGate(
    request,
    user,
    new URL("/change-password", request.url),
  );
  if (hospitalRenewal) return hospitalRenewal;

  if (!isHospitalRole(user.role) && !isRcInternalOperator(user.role)) {
    return redirectToRoleAwareHome(request, user, defaultJurisdictionSlug());
  }

  if (pathname === "/app/hospital" || pathname === "/app/hospital/") {
    return redirectToRoleDashboard(request, user);
  }

  const hospitalRoute = ensureRoleDashboardPath(request, user);
  if (hospitalRoute) return hospitalRoute;

  const hospitalNetwork = await maybeBlockNetworkAccess(request, user);
  if (hospitalNetwork) return hospitalNetwork;

  return NextResponse.next();
}

async function guardTransitDashboard(request: NextRequest): Promise<NextResponse> {
  if (!isAuthConfigured()) {
    return NextResponse.next();
  }
  const pathname = request.nextUrl.pathname;
  const loginUrl = new URL(marketingLoginPath(), request.url);
  loginUrl.searchParams.set("from", `${pathname}${request.nextUrl.search}`);

  const token = request.cookies.get(COOKIE_ID_TOKEN)?.value;
  const refresh = request.cookies.get(COOKIE_REFRESH_TOKEN)?.value;
  if (!token && !refresh) {
    return NextResponse.redirect(loginUrl);
  }

  const user = token ? await verifyCognitoIdToken(token) : null;
  if (!user && refresh) {
    const bounce = new URL("/api/auth/refresh-cookies", request.url);
    bounce.searchParams.set("redirect_to", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(bounce);
  }

  if (!user) {
    return NextResponse.redirect(loginUrl);
  }

  const transitRenewal = handleOperationalPasswordRenewalGate(
    request,
    user,
    new URL("/change-password", request.url),
  );
  if (transitRenewal) return transitRenewal;

  if (!isTransitRole(user.role) && !isRcInternalOperator(user.role)) {
    return redirectToRoleAwareHome(request, user, defaultJurisdictionSlug());
  }

  if (pathname === "/app/transit" || pathname === "/app/transit/") {
    return redirectToRoleDashboard(request, user);
  }

  const transitRoute = ensureRoleDashboardPath(request, user);
  if (transitRoute) return transitRoute;

  const transitNetwork = await maybeBlockNetworkAccess(request, user);
  if (transitNetwork) return transitNetwork;

  return NextResponse.next();
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // ALB/ECS probes must not load the edge middleware graph (see matcher + node:crypto note below).
  if (pathname === "/api/health" || pathname.startsWith("/api/health/")) {
    return NextResponse.next();
  }

  const mobileOperationalBlock = getMobileOperationalAuthMiddlewareResponse(request);
  if (mobileOperationalBlock) return mobileOperationalBlock;

  const reportHostRedirect = maybeRedirectReportHost(request);
  if (reportHostRedirect) return reportHostRedirect;

  const splashRedirect = maybeRedirectToSplash(request);
  if (splashRedirect) return splashRedirect;

  const appHostMarketingRedirect = maybeRedirectAppHostAwayFromMarketing(request);
  if (appHostMarketingRedirect) return appHostMarketingRedirect;

  /**
   * If cookies already identify a signed-in user, never keep them on a login route (avoids
   * stale client state + middleware fighting over dashboard entry).
   */
  if (isAuthConfigured()) {
    const atStaticLogin = pathname === "/login";
    const atJurisdictionLogin = /^\/[^/]+\/login$/.test(pathname);
    if (atStaticLogin || atJurisdictionLogin) {
      const token = request.cookies.get(COOKIE_ID_TOKEN)?.value;
      const refresh = request.cookies.get(COOKIE_REFRESH_TOKEN)?.value;
      if (token || refresh) {
        const user = token ? await verifyCognitoIdToken(token) : null;
        if (!user && refresh) {
          const bounce = new URL("/api/auth/refresh-cookies", request.url);
          bounce.searchParams.set("redirect_to", `${pathname}${request.nextUrl.search}`);
          return NextResponse.redirect(bounce);
        }
        if (user) {
          const loginRenewal = handleOperationalPasswordRenewalGate(
            request,
            user,
            new URL("/change-password", request.url),
          );
          if (loginRenewal) return loginRenewal;
          const slug =
            pathname === "/login"
              ? defaultJurisdictionSlug()
              : pathname.split("/").filter(Boolean)[0] ?? defaultJurisdictionSlug();
          return redirectToRoleAwareHome(request, user, slug);
        }
      }
    }
  }

  if (isRcLitePortalPath(pathname)) {
    return guardRcLitePortal(request);
  }
  if (isVenueDashboardPath(pathname)) {
    return guardVenueDashboard(request);
  }
  if (isCampusDashboardPath(pathname)) {
    return guardCampusDashboard(request);
  }
  if (isHospitalDashboardPath(pathname)) {
    return guardHospitalDashboard(request);
  }
  if (isTransitDashboardPath(pathname)) {
    return guardTransitDashboard(request);
  }
  if (pathname.startsWith("/api/auth/")) {
    return ensureCsrfOnAuthApiRequest(request);
  }
  if (pathname === "/change-password" || pathname.startsWith("/change-password/")) {
    return guardStandaloneChangePasswordPage(request);
  }
  if (pathname === "/docs" || pathname.startsWith("/docs/")) {
    return guardAuthenticatedDocs(request);
  }

  const parsed = parsePath(pathname);

  if (parsed.kind === "role_dashboard") {
    return guardRoleDashboard(request, parsed.prefix, parsed.subpath);
  }

  if (parsed.kind === "root" || parsed.kind === "system") {
    return NextResponse.next();
  }

  const { jurisdiction, subpath } = parsed;

  if (!isAuthConfigured()) {
    return NextResponse.next();
  }

  const loginPath = marketingLoginPath();
  if (subpath.startsWith("/login")) {
    return NextResponse.next();
  }

  if (subpath === "/demo" || subpath.startsWith("/demo/")) {
    if (!isDemoScriptedContentEnabled()) {
      return new NextResponse(null, { status: 404 });
    }
  }

  const needsAuth = protectedSubpaths.some(
    (p) => subpath === p || subpath.startsWith(`${p}/`),
  );
  if (!needsAuth) {
    return NextResponse.next();
  }

  const token = request.cookies.get(COOKIE_ID_TOKEN)?.value;
  const refresh = request.cookies.get(COOKIE_REFRESH_TOKEN)?.value;

  const redirectToLogin = () => {
    const login = new URL(loginPath, request.url);
    login.searchParams.set("from", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(login);
  };

  if (!token && !refresh) {
    return redirectToLogin();
  }

  const user = token ? await verifyCognitoIdToken(token) : null;
  if (!user && refresh) {
    const bounce = new URL("/api/auth/refresh-cookies", request.url);
    bounce.searchParams.set(
      "redirect_to",
      `${pathname}${request.nextUrl.search}`,
    );
    return NextResponse.redirect(bounce);
  }

  if (!user) {
    return redirectToLogin();
  }

  const roleVertical = verticalFromRole(user.role);

  // Platform roles must not enter vertical product shells.
  if (roleVertical === "platform" && isAppVerticalDashboardPath(pathname)) {
    return redirectToRoleDashboard(request, user);
  }

  // Product-role users should never land in jurisdiction/core dispatcher routes.
  if (isProductRole(user.role)) {
    if (!pathMatchesRoleDashboard(pathname, user.role, user.agencyId)) {
      return redirectToRoleDashboard(request, user);
    }
    return NextResponse.next();
  }

  // 911 roles must not enter vertical product shells.
  if (roleVertical === "911" && isAppVerticalDashboardPath(pathname)) {
    return redirectToRoleDashboard(request, user);
  }

  const passwordStale = requiresOperationalPasswordRenewal(user);
  if (
    passwordStale &&
    needsAuth &&
    !jurisdictionSubpathIsPasswordChangeAllowed(subpath)
  ) {
    const jurRenewal = handleOperationalPasswordRenewalGate(
      request,
      user,
      new URL("/change-password", request.url),
    );
    if (jurRenewal) return jurRenewal;
  }

  if (
    needsAuth &&
    jurisdictionSubpathRequiresDashboardEntitlement(subpath) &&
    !hasRapidCortexDashboardAccess(user)
  ) {
    if (hasRcLitePortalAccess(user)) {
      const portal = new URL("/rc-lite/portal", request.url);
      portal.searchParams.set("from", `${pathname}${request.nextUrl.search}`);
      return NextResponse.redirect(portal);
    }
    const denied = new URL(`/${defaultJurisdictionSlug()}/no-access`, request.url);
    denied.searchParams.set("reason", "dashboard_subscription_required");
    return NextResponse.redirect(denied);
  }

  if (subpath.startsWith("/admin") && !isAdminRole(user.role)) {
    const effective = resolvePsapRole(user.role);
    const auditorReadAllowed =
      effective === "auditor" &&
      AUDITOR_READ_ADMIN_PATHS.some((p) => subpath === p || subpath.startsWith(`${p}/`));
    if (!auditorReadAllowed) {
      return redirectToRoleAwareHome(request, user, jurisdiction);
    }
  }
  if (
    subpath === "/admin/security/deception-shield" ||
    subpath.startsWith("/admin/security/deception-shield/")
  ) {
    if (!isRcsuperadmin(user) && user.role !== "agencyit" && user.role !== "rcitadmin") {
      const denied = new URL(`/${jurisdiction}/dashboard`, request.url);
      denied.searchParams.set("toast", "access_denied");
      return NextResponse.redirect(denied);
    }
  }
  if (isRcInternalOperator(user.role)) {
    if (subpath.startsWith("/admin/platform")) {
      const target = mapJurisdictionPlatformPathToRcAdmin(`/${jurisdiction}${subpath}`);
      if (target) {
        return NextResponse.redirect(new URL(target, request.url));
      }
    }
    const dispatchWorkstationPrefixes = [
      "/dashboard",
      "/dispatcher",
      "/history",
      "/demo",
      "/caller",
      "/transcription",
      "/translation",
      "/media",
      "/cad",
      "/incidents",
      "/ai-summary",
      "/alerts",
      "/calls",
      "/notes",
      "/shared-incoming",
      "/review",
      "/supervisor",
    ];
    if (
      dispatchWorkstationPrefixes.some((p) => subpath === p || subpath.startsWith(`${p}/`))
    ) {
      return redirectToRoleAwareHome(request, user, jurisdiction);
    }
  }
  if (isRcsuperadmin(user)) {
    return NextResponse.next();
  }
  if (subpath.startsWith("/review") && !isSupervisorOrAdmin(user.role)) {
    return redirectToRoleAwareHome(request, user, jurisdiction);
  }
  if (subpath.startsWith("/supervisor") && !isSupervisorOrAdmin(user.role)) {
    const analystScorecards =
      resolvePsapRole(user.role) === "analyst" &&
      ANALYST_SUPERVISOR_PATHS.some((p) => subpath === p || subpath.startsWith(`${p}/`));
    if (!analystScorecards) {
      return redirectToRoleAwareHome(request, user, jurisdiction);
    }
  }
  if (subpath === "/rc-admin" || subpath.startsWith("/rc-admin/")) {
    if (!isRcInternalOperator(user.role)) {
      return redirectToRoleAwareHome(request, user, jurisdiction);
    }
  } else if (subpath === "/staff" || subpath.startsWith("/staff/")) {
    if (user.role !== "auditor") {
      return redirectToRoleAwareHome(request, user, jurisdiction);
    }
  } else if (subpath === "/dispatcher" || subpath.startsWith("/dispatcher/")) {
    if (user.role !== "dispatcher") {
      return redirectToRoleAwareHome(request, user, jurisdiction);
    }
  } else if (isDispatchLiveWorkspaceSubpath(subpath) && !roleMayAccessDispatchLiveWorkspace(user.role)) {
    return redirectToRoleAwareHome(request, user, jurisdiction);
  } else if (subpath === "/analytics" || subpath.startsWith("/analytics/")) {
    if (user.role !== "analyst" && !isAdminRole(user.role)) {
      return redirectToRoleAwareHome(request, user, jurisdiction);
    }
  } else if (subpath === "/audit" || subpath.startsWith("/audit/")) {
    if (user.role !== "auditor" && !isAdminRole(user.role)) {
      return redirectToRoleAwareHome(request, user, jurisdiction);
    }
  }

  const jurisdictionNetwork = await maybeBlockNetworkAccess(request, user);
  if (jurisdictionNetwork) return jurisdictionNetwork;

  return NextResponse.next();
}

/**
 * Middleware runs on the Edge runtime only (Next.js does not expose `runtime: "nodejs"` on
 * `export const config` for middleware in Next 16). Do not pull `node:crypto` / `crypto` /
 * Node-only dependencies into this module graph — use Web Crypto (`crypto.getRandomValues`, etc.,
 * already used under `@/lib/csrf`), and Edge-safe **`rapid-cortex-shared` subpath imports**.
 */
export const config = {
  matcher: [
    // Run for `/docs/*.html` so manuals can require auth; still skip most static file extensions.
    "/((?!_next/static|_next/image|favicon.ico|api/health|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|webmanifest)$).*)",
  ],
};
