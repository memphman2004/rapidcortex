import { NextRequest, NextResponse } from "next/server";
import { canAccessRcFinancePortal } from "rapid-cortex-shared";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";
import { serverPricingJson } from "@/lib/server/server-pricing-fetch";

/** Reject empty / sentinel timestamps (e.g. Unix epoch → Dec 31, 1969). */
function isUsablePriceDate(raw?: string | null): raw is string {
  if (!raw?.trim()) return false;
  const t = Date.parse(raw);
  if (!Number.isFinite(t)) return false;
  return t > 86_400_000;
}

export async function GET(request: NextRequest) {
  const user = await getDashboardSessionUser();
  if (!user || !canAccessRcFinancePortal(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const upstream = await proxyToAuthUpstream(request, "/api/rc-admin/pricing/catalog");
  if (!upstream.ok) return upstream;

  const data = (await upstream.json()) as {
    items?: unknown;
    counts?: unknown;
    version?: number;
    updatedAt?: string;
  };

  // Prefer Pricing configuration last-change time over catalog META (often epoch when unset).
  const global = await serverPricingJson<{ lastModifiedAt?: string }>("/api/admin/pricing/global");
  const fromConfig = global?.lastModifiedAt?.trim() ?? "";
  const updatedAt = isUsablePriceDate(fromConfig)
    ? fromConfig
    : isUsablePriceDate(data.updatedAt)
      ? data.updatedAt
      : undefined;

  return NextResponse.json({ ...data, updatedAt });
}
