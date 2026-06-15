import type { NextRequest } from "next/server";
import { withRcFinanceAgency } from "@/lib/server/rc-admin-agency-route";
import {
  listAddOnsHandler,
  updateAddOnsHandler,
} from "@/lib/server/rc-admin-agency-billing-handlers";

export const GET = withRcFinanceAgency((request: NextRequest, ctx) =>
  listAddOnsHandler(request, ctx),
);

export const PATCH = withRcFinanceAgency((request: NextRequest, ctx) =>
  updateAddOnsHandler(request, ctx),
);
