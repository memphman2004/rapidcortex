import { NextRequest, NextResponse } from "next/server";
import { SignatureV4 } from "@smithy/signature-v4";
import { HttpRequest } from "@smithy/protocol-http";
import { Sha256 } from "@aws-crypto/sha256-js";
import { defaultProvider } from "@aws-sdk/credential-provider-node";

/**
 * Same-origin proxy for Amazon Location Maps (V1 named + V2).
 * Browser Cognito Identity is blocked in Safari Private / strict ITP;
 * the ECS task role signs requests so MapLibre tiles load reliably.
 */

const ALLOWED_HOST =
  /^maps\.geo(?:-fips)?\.[a-z0-9-]+\.(?:amazonaws\.com|api\.aws)$/i;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function serviceForUrl(url: URL): string {
  // Maps API v2 lives under /v2/; named maps use /maps/v0/.
  return url.pathname.includes("/v2/") ? "geo-maps" : "geo";
}

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("url")?.trim() ?? "";
  if (!raw) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  if (target.protocol !== "https:" || !ALLOWED_HOST.test(target.hostname)) {
    return NextResponse.json({ error: "Host not allowed" }, { status: 400 });
  }

  const region =
    process.env.AWS_REGION?.trim() ||
    process.env.NEXT_PUBLIC_ALS_REGION?.trim() ||
    "us-east-1";
  const service = serviceForUrl(target);

  try {
    const signer = new SignatureV4({
      credentials: defaultProvider(),
      region,
      service,
      sha256: Sha256,
    });

    const unsigned = new HttpRequest({
      method: "GET",
      protocol: "https:",
      hostname: target.hostname,
      path: `${target.pathname}${target.search}`,
      headers: {
        host: target.hostname,
      },
    });

    const signed = await signer.sign(unsigned);
    const upstream = await fetch(target.toString(), {
      method: "GET",
      headers: signed.headers as Record<string, string>,
      cache: "no-store",
    });

    const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";
    const body = await upstream.arrayBuffer();
    return new NextResponse(body, {
      status: upstream.status,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (err) {
    console.error("[als-proxy] signed fetch failed", err);
    return NextResponse.json({ error: "Map upstream failed" }, { status: 502 });
  }
}
