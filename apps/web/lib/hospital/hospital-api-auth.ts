import { NextResponse } from "next/server";
import type { UserContext } from "rapid-cortex-shared/types";
import { isRcInternalOperator } from "rapid-cortex-shared/tenancy/principal";
import { requireApiUser } from "@/lib/rapid-cortex/server-auth";
import {
  canAccessHospitalAdminPortal,
  canEditRoutingConfig,
  canUpdateHospitalCapacity,
} from "./hospital-access";

type HospitalApiAuthOk = { ok: true; user: UserContext };
type HospitalApiAuthFail = { ok: false; response: NextResponse };

function userMayAccessAgency(user: UserContext, agencyId: string): boolean {
  if (isRcInternalOperator(user.role)) return true;
  return user.agencyId === agencyId;
}

export async function requireHospitalPortalApiAccess(
  agencyId: string,
): Promise<HospitalApiAuthOk | HospitalApiAuthFail> {
  const user = await requireApiUser();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (!canAccessHospitalAdminPortal(user) || !userMayAccessAgency(user, agencyId)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { ok: true, user };
}

export async function requireHospitalCapacityUpdateAccess(
  agencyId: string,
): Promise<HospitalApiAuthOk | HospitalApiAuthFail> {
  const user = await requireApiUser();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (!canUpdateHospitalCapacity(user) || !userMayAccessAgency(user, agencyId)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { ok: true, user };
}

export async function requireHospitalRoutingConfigEditAccess(
  agencyId: string,
): Promise<HospitalApiAuthOk | HospitalApiAuthFail> {
  const user = await requireApiUser();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (!canEditRoutingConfig(user) || !userMayAccessAgency(user, agencyId)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { ok: true, user };
}
