import type { NextRequest } from "next/server";
import { withRcFinanceAgency } from "@/lib/server/rc-admin-agency-route";
import { billingSummaryHandler } from "@/lib/server/rc-admin-agency-billing-handlers";

export const GET = withRcFinanceAgency((request: NextRequest, ctx) =>
  billingSummaryHandler(request, ctx),
);
