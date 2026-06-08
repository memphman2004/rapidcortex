import { NextResponse } from "next/server";
import { isHospitalPortalEnabled } from "@/lib/runtime-flags";
import {
  analyticsSummaryFromHistory,
  historyEntryFromCapacity,
} from "@/lib/hospital/hospital-bff-mappers";
import { requireHospitalPortalApiAccess } from "@/lib/hospital/hospital-api-auth";
import { canExportHospitalAnalytics } from "@/lib/hospital/hospital-access";
import { getHospitalRoutingConfig } from "@/lib/hospital/hospital-routing-config-store";
import { fetchHospitalCapacityHistory } from "@/lib/hospital/hospital-upstream";

type Ctx = { params: Promise<{ agencyId: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  if (!isHospitalPortalEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const { agencyId } = await ctx.params;
  const auth = await requireHospitalPortalApiAccess(agencyId);
  if (!auth.ok) return auth.response;
  if (!canExportHospitalAnalytics(auth.user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const items = await fetchHospitalCapacityHistory(60);
  const thresholds = getHospitalRoutingConfig(agencyId);
  const summary = analyticsSummaryFromHistory(items, thresholds);
  const rows = items.map((item) => historyEntryFromCapacity(item, thresholds));

  const header = "timestamp,bedsAvailable,diversionStatus,updatedByName,notes";
  const lines = rows.map(
    (r) =>
      `${r.timestamp},${r.bedsAvailable},${r.diversionStatus},"${r.updatedByName.replace(/"/g, '""')}","${(r.notes ?? "").replace(/"/g, '""')}"`,
  );
  const csv = [
    `# avgBedsAvailable7d,${summary.avgBedsAvailable7d}`,
    `# diversionHours7d,${summary.diversionHours7d}`,
    header,
    ...lines,
  ].join("\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="hospital-analytics-${agencyId}.csv"`,
    },
  });
}
