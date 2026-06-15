import type { NextRequest } from "next/server";
import { requireRcFinanceAccess } from "@/lib/server/rc-admin-finance-guard";

type Handler = (request: NextRequest, ctx: { params: Promise<{ agencyId: string }> }) => Promise<Response>;

export function withRcFinanceAgency(handler: Handler) {
  return async (request: NextRequest, ctx: { params: Promise<{ agencyId: string }> }) => {
    const guard = await requireRcFinanceAccess(request);
    if (guard.error) return guard.error;
    return handler(request, ctx);
  };
}
