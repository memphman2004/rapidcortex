import type { NextRequest } from "next/server";
import { withRcFinanceAgency } from "@/lib/server/rc-admin-agency-route";
import {
  createInvoiceHandler,
  listInvoicesHandler,
} from "@/lib/server/rc-admin-agency-billing-handlers";

export const GET = withRcFinanceAgency((request: NextRequest, ctx) =>
  listInvoicesHandler(request, ctx),
);

export const POST = withRcFinanceAgency((request: NextRequest, ctx) =>
  createInvoiceHandler(request, ctx),
);
