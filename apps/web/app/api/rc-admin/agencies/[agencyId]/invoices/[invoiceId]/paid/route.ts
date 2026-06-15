import type { NextRequest } from "next/server";
import { requireRcFinanceAccess } from "@/lib/server/rc-admin-finance-guard";
import { markPaidHandler } from "@/lib/server/rc-admin-agency-billing-handlers";

type Ctx = { params: Promise<{ agencyId: string; invoiceId: string }> };

export async function POST(request: NextRequest, ctx: Ctx) {
  const guard = await requireRcFinanceAccess(request);
  if (guard.error) return guard.error;
  return markPaidHandler(request, ctx);
}
