import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getConfiguredMarketingSiteOrigin } from "@/lib/app-host-routing";

const DEFAULT_REPORT_HOSTNAME = "report.rapidcortex.us";

export function getConfiguredReportHostname(): string {
  const origin = process.env.NEXT_PUBLIC_REPORT_ORIGIN?.trim();
  if (origin) {
    try {
      return new URL(origin).hostname.toLowerCase();
    } catch {
      /* fall through */
    }
  }
  return DEFAULT_REPORT_HOSTNAME;
}

function viewerHostname(request: NextRequest): string | null {
  const forwarded = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = request.headers.get("host")?.split(":")[0]?.trim();
  return (forwarded || host)?.toLowerCase() ?? null;
}

export function isReportHostRequest(request: NextRequest): boolean {
  const host = viewerHostname(request);
  if (!host) return false;
  const configured = getConfiguredReportHostname();
  return host === configured || host.startsWith("report.");
}

function isReportHostAllowedPath(pathname: string): boolean {
  return (
    pathname === "/r" ||
    pathname.startsWith("/r/") ||
    pathname.startsWith("/api/r/") ||
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname === "/icon.png" ||
    pathname === "/apple-icon.png"
  );
}

/**
 * Public QR intake host — allow /r/* only; never send to /login.
 */
export function maybeRedirectReportHost(request: NextRequest): NextResponse | null {
  if (!isReportHostRequest(request)) return null;

  const pathname = request.nextUrl.pathname;
  if (isReportHostAllowedPath(pathname)) {
    return NextResponse.next();
  }

  const marketingRoot = new URL("/", getConfiguredMarketingSiteOrigin());
  return NextResponse.redirect(marketingRoot, 307);
}
