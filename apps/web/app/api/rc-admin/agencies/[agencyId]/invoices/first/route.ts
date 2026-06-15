import type { NextRequest } from "next/server";
import { withRcFinanceAgency } from "@/lib/server/rc-admin-agency-route";
import { createFirstInvoiceHandler } from "@/lib/server/rc-admin-agency-billing-handlers";

export const POST = withRcFinanceAgency((request: NextRequest, ctx) =>
  createFirstInvoiceHandler(request, ctx),
);
