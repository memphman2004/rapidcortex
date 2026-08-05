import { NextRequest, NextResponse } from "next/server";
import { canAccessRcFinancePortal } from "rapid-cortex-shared";
import { isSam3ApiPath, resolveUpstreamApiBase } from "@/lib/comms-api-path";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isPsapProspectsUiEnabled } from "@/lib/runtime-flags";
import { applyRotatedAuthCookies, resolveBffBearerToken } from "@/lib/server/bff-auth-token";

/**
 * CSV export proxy. Forwards content-type + content-disposition when present.
 * Note: generic `proxyToAuthUpstream` only copies content-type; this route
 * preserves Content-Disposition so browsers download as attachment.
 */
export async function GET(request: NextRequest) {
  const user = await getDashboardSessionUser();
  if (!user || !canAccessRcFinancePortal(user.role) || !isPsapProspectsUiEnabled()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const role = String(user.role ?? "").toLowerCase();
  if (role !== "rcsuperadmin" && role !== "rcadmin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const upstreamPath = "/api/rc-admin/psap-prospects/export";
  const base = resolveUpstreamApiBase(upstreamPath);
  if (!base) {
    return NextResponse.json(
      {
        error: isSam3ApiPath(upstreamPath)
          ? "API_UPSTREAM_BASE_3 is not configured for media/admin/platform routes"
          : "API_UPSTREAM_BASE is not configured",
      },
      { status: 503 },
    );
  }

  const auth = await resolveBffBearerToken(request);
  if (!auth.token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const target = new URL(`${base}${upstreamPath}`);
  target.search = request.nextUrl.search;

  const upstream = await fetch(target, {
    method: "GET",
    headers: { authorization: `Bearer ${auth.token}` },
    cache: "no-store",
  });

  const responseHeaders = new Headers();
  const contentType = upstream.headers.get("content-type");
  if (contentType) responseHeaders.set("content-type", contentType);
  const disposition = upstream.headers.get("content-disposition");
  if (disposition) responseHeaders.set("content-disposition", disposition);

  const response = new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
  if ("rotated" in auth && auth.rotated) {
    applyRotatedAuthCookies(response, auth.rotated);
  }
  return response;
}
