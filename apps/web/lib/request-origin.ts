import type { NextRequest } from "next/server";
import { getSiteUrl } from "@/lib/seo";

const DEFAULT_APP_ORIGIN = "https://app.rapidcortex.us";

function configuredPublicOrigin(): string | null {
  for (const key of ["NEXT_PUBLIC_APP_ORIGIN", "NEXT_PUBLIC_SITE_URL", "APP_URL"] as const) {
    const raw = process.env[key]?.trim();
    if (!raw) continue;
    try {
      return new URL(raw).origin;
    } catch {
      continue;
    }
  }
  return null;
}

function originFromRequestHeaders(request: NextRequest): string | null {
  const host =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    request.headers.get("host")?.split(":")[0]?.trim();
  if (!host || host.includes(".internal") || host.startsWith("ip-")) {
    return null;
  }
  const proto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    (request.nextUrl.protocol.replace(":", "") || "https");
  return `${proto}://${host}`;
}

/** Public origin for redirects — never the ECS container private hostname. */
export function getPublicRequestOrigin(request?: NextRequest): string {
  return (
    configuredPublicOrigin() ??
    (request ? originFromRequestHeaders(request) : null) ??
    getSiteUrl() ??
    DEFAULT_APP_ORIGIN
  );
}

/** Build an absolute URL for middleware / route-handler redirects. */
export function publicAbsoluteUrl(path: string, request?: NextRequest): URL {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return new URL(normalized, getPublicRequestOrigin(request));
}

/** Build redirect target from a relative path or absolute URL. */
export function resolveRedirectUrl(pathOrUrl: string, request?: NextRequest): URL {
  if (/^https?:\/\//i.test(pathOrUrl)) {
    return new URL(pathOrUrl);
  }
  return publicAbsoluteUrl(pathOrUrl, request);
}
