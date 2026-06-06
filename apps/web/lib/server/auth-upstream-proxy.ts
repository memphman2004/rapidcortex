import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { COOKIE_ID_TOKEN } from "@/lib/auth/cookies";
import { isCommsPlatformApiPath, resolveUpstreamApiBase } from "@/lib/comms-api-path";

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
    const needsStack2 = isCommsPlatformApiPath(upstreamPath);
    return NextResponse.json(
      {
        error: needsStack2
          ? "API_UPSTREAM_BASE_2 is not configured for comms / call-intelligence routes"
          : "API_UPSTREAM_BASE is not configured",
        hint: needsStack2
          ? "Set API_UPSTREAM_BASE_2 to the stack-2 API Gateway URL (see scripts/print-stack-outputs-for-web.sh)."
          : "Set API_UPSTREAM_BASE on the web container.",
      },
      { status: 503 },
    );
  }

  const token = request.cookies.get(COOKIE_ID_TOKEN)?.value;
  if (!options.allowAnonymous && !token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const target = new URL(`${base}${upstreamPath}`);
  target.search = request.nextUrl.search;

  const headers = new Headers();
  const incomingCt = request.headers.get("content-type");
  if (incomingCt) headers.set("content-type", incomingCt);
  if (token) headers.set("authorization", `Bearer ${token}`);

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

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}
