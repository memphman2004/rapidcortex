import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { logMobileAuthBlocked } from "@/lib/audit/log-mobile-auth-blocked";
import {
  isMobileOperationalAuthBlockingEnabled,
  shouldBlockAuthOnDevice,
} from "@/lib/device/isMobileRequest";
import {
  isMobilePublicApiPath,
  pathnameIsMobileOperationalBlockedPage,
} from "@/lib/device/operations-mobile-blocklist";

/** Used by middleware and tests — returns a ready response when the request must be blocked. */
export function getMobileOperationalAuthMiddlewareResponse(request: NextRequest): NextResponse | null {
  if (!isMobileOperationalAuthBlockingEnabled()) return null;

  const pathname = request.nextUrl.pathname;
  const ua = request.headers.get("user-agent");

  if (!shouldBlockAuthOnDevice(ua)) return null;

  if (pathname.startsWith("/api/")) {
    if (isMobilePublicApiPath(pathname)) return null;
    logMobileAuthBlocked(pathname, request.headers as unknown as Headers, ua);
    return NextResponse.json(
      {
        error: "mobile_auth_blocked",
        message: "Rapid Cortex console login is restricted to approved desktop workstations.",
      },
      { status: 403 },
    );
  }

  if (!pathnameIsMobileOperationalBlockedPage(pathname)) return null;

  logMobileAuthBlocked(pathname, request.headers as unknown as Headers, ua);

  const to = new URL("/mobile-access-restricted", request.url);
  return NextResponse.redirect(to);
}
