import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { COOKIE_ID_TOKEN } from "@/lib/auth/cookies";
import { resolveUpstreamApiBase } from "@/lib/comms-api-path";
import { proxyQrNfc } from "@/lib/server/qr-nfc-proxy";

/**
 * Explicit route so GET /api/qr-nfc/global cannot 404 behind the optional catch-all
 * or be forwarded as GET /api/qr-nfc/{qrId} with qrId=global.
 *
 * If the live QR Lambda still treats `global` as a missing code, fall back to
 * listing each agency (works without an API redeploy).
 */
export async function GET(request: NextRequest) {
  const primary = await proxyQrNfc(request, ["global"]);
  if (primary.status !== 404) return primary;
  return listGlobalByAgencyFallback(request);
}

async function listGlobalByAgencyFallback(request: NextRequest): Promise<NextResponse> {
  const token = request.cookies.get(COOKIE_ID_TOKEN)?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const agenciesBase = resolveUpstreamApiBase("/api/agencies");
  const qrBase = resolveUpstreamApiBase("/api/qr-nfc");
  if (!agenciesBase || !qrBase) {
    return NextResponse.json({ error: "API upstream not configured" }, { status: 503 });
  }

  const agencyRes = await fetch(`${agenciesBase}/api/agencies`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!agencyRes.ok) {
    return NextResponse.json({ error: "Failed to load codes" }, { status: agencyRes.status });
  }

  const agencyBody = (await agencyRes.json()) as { items?: Array<{ agencyId?: string; id?: string }> };
  const agencyIds = (agencyBody.items ?? [])
    .map((row) => row.agencyId ?? row.id)
    .filter((id): id is string => Boolean(id))
    .slice(0, 40);

  const filters = request.nextUrl.searchParams;
  const items: unknown[] = [];
  for (const agencyId of agencyIds) {
    const url = new URL(`${qrBase}/api/qr-nfc`);
    url.searchParams.set("agencyId", agencyId);
    const vertical = filters.get("vertical");
    const active = filters.get("active");
    if (vertical) url.searchParams.set("vertical", vertical);
    if (active) url.searchParams.set("active", active);
    const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
    if (!res.ok) continue;
    const body = (await res.json()) as { items?: unknown[] };
    if (Array.isArray(body.items)) items.push(...body.items);
  }

  return NextResponse.json({ items });
}
