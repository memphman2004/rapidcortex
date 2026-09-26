import { NextResponse } from "next/server";
import type { CatalogItem } from "rapid-cortex-shared";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { canViewPipeline } from "@/lib/sales/sales-authz";
import { serverPricingJson } from "@/lib/server/server-pricing-fetch";

/** Strip monetary fields so sales never receives list prices. */
function stripPrices(item: CatalogItem): CatalogItem {
  return {
    ...item,
    unitPrice: null,
    priceMin: null,
    priceMax: null,
    priceType: item.priceType === "included" ? "included" : "custom",
  };
}

export async function GET() {
  const user = await getDashboardSessionUser();
  if (!user || !canViewPipeline(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const data = await serverPricingJson<{
    items?: CatalogItem[];
    counts?: unknown;
    version?: number;
    updatedAt?: string;
  }>("/api/rc-admin/pricing/catalog");

  if (!data) {
    return NextResponse.json({ error: "Catalog unavailable" }, { status: 502 });
  }

  return NextResponse.json({
    ...data,
    items: (data.items ?? []).map(stripPrices),
  });
}
