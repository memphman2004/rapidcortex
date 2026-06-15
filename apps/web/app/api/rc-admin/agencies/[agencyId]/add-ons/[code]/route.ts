import type { NextRequest } from "next/server";
import { requireRcFinanceAccess } from "@/lib/server/rc-admin-finance-guard";
import { disableAddOnHandler } from "@/lib/server/rc-admin-agency-billing-handlers";

type Ctx = { params: Promise<{ agencyId: string; code: string }> };

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const guard = await requireRcFinanceAccess(request);
  if (guard.error) return guard.error;
  return disableAddOnHandler(request, ctx);
}
