import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isSam3ApiPath, isSam4ApiPath, isSam5ApiPath, isStack2ApiPath, resolveUpstreamApiBase } from "@/lib/comms-api-path";
import { applyRotatedAuthCookies, resolveBffBearerToken } from "@/lib/server/bff-auth-token";

type ProxyOptions = {
  allowAnonymous?: boolean;
};

export async function proxyToAuthUpstream(
  request: NextRequest,
  upstreamPath: string,
  options: ProxyOptions = {},
): Promise<NextResponse> {
  const base = resolveUpstreamApiBase(upstreamPath);
  if (!base) {
    const needsStack4 = isSam4ApiPath(upstreamPath);
    const needsStack5 = isSam5ApiPath(upstreamPath);
    const needsStack3 = isSam3ApiPath(upstreamPath);
    const needsStack2 = isStack2ApiPath(upstreamPath);
    return NextResponse.json(
      {
        error: needsStack4
          ? "API_UPSTREAM_BASE_4 is not configured for billing/ring routes"
          : needsStack5
            ? "API_UPSTREAM_BASE_5 is not configured for campus/venue/media/stream routes"
            : needsStack3
              ? "API_UPSTREAM_BASE_3 is not configured for media/admin/platform routes"
              : needsStack2
                ? "API_UPSTREAM_BASE_2 is not configured for comms / call-intelligence routes"
                : "API_UPSTREAM_BASE is not configured",
        hint: needsStack4
          ? "Set API_UPSTREAM_BASE_4 to the stack-4 API Gateway URL (see scripts/print-stack-outputs-for-web.sh)."
          : needsStack5
            ? "Set API_UPSTREAM_BASE_5 to the stack-5 API Gateway URL (see scripts/print-stack-outputs-for-web.sh)."
            : needsStack3
              ? "Set API_UPSTREAM_BASE_3 to the stack-3 API Gateway URL (see scripts/print-stack-outputs-for-web.sh)."
              : needsStack2
                ? "Set API_UPSTREAM_BASE_2 to the stack-2 API Gateway URL (see scripts/print-stack-outputs-for-web.sh)."
                : "Set API_UPSTREAM_BASE on the web container.",
      },
      { status: 503 },
    );
  }

  const auth = await resolveBffBearerToken(request);
  if (!options.allowAnonymous && !auth.token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const target = new URL(`${base}${upstreamPath}`);
  target.search = request.nextUrl.search;

  const headers = new Headers();
  const incomingCt = request.headers.get("content-type");
  if (incomingCt) headers.set("content-type", incomingCt);
  if (auth.token) headers.set("authorization", `Bearer ${auth.token}`);

  const method = request.method;
  const body =
    method === "GET" || method === "HEAD" ? undefined : await request.arrayBuffer();

  const upstream = await fetch(target, {
    method,
    headers,
    body: body && body.byteLength ? body : undefined,
    cache: "no-store",
  });

  const responseHeaders = new Headers();
  const contentType = upstream.headers.get("content-type");
  if (contentType) responseHeaders.set("content-type", contentType);

  const response = new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
  if (auth.token && "rotated" in auth && auth.rotated) {
    applyRotatedAuthCookies(response, auth.rotated);
  }
  return response;
}
