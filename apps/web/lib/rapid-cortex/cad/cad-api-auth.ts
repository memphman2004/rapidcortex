import { NextResponse } from "next/server";
import { isAdminRole, isSupervisorOrAdmin } from "@/lib/auth/roles";
import { requireApiUser } from "@/lib/rapid-cortex/server-auth";

type CadApiRole = "dispatcher" | "supervisor" | "agencyadmin" | "agencyit" | "rcsuperadmin";

const WRITEBACK_APPROVER_ROLES: CadApiRole[] = ["supervisor", "agencyadmin", "rcsuperadmin"];
const CAD_ALLOWED_ROLES: CadApiRole[] = [
  "dispatcher",
  "supervisor",
  "agencyadmin",
  "agencyit",
  "rcsuperadmin",
];

export function parseJsonBody<T>(raw: unknown): T | null {
  if (!raw || typeof raw !== "object") return null;
  return raw as T;
}

export async function requireCadApiUser(opts?: { mustApprove?: boolean }) {
  const user = await requireApiUser();
  if (!user) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  if (!CAD_ALLOWED_ROLES.includes(user.role as CadApiRole)) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  if (opts?.mustApprove) {
    const canApprove = isSupervisorOrAdmin(user.role) || isAdminRole(user.role);
    if (!canApprove) {
      return {
        ok: false as const,
        response: NextResponse.json({ error: "Approval role required" }, { status: 403 }),
      };
    }
  }

  return { ok: true as const, user };
}

export function ensureAgencyAccess(userAgencyId: string, payloadAgencyId: unknown): string | null {
  if (typeof payloadAgencyId !== "string" || !payloadAgencyId.trim()) {
    return "agencyId is required.";
  }
  if (userAgencyId !== payloadAgencyId) {
    return "agencyId mismatch.";
  }
  return null;
}
