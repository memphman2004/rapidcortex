import { NextResponse } from "next/server";
import { requireTransitAdminApiAccess } from "@/lib/transit/transit-api-auth";
import {
  TRANSIT_ASSIGNABLE_ROLES,
  type TransitAssignableRole,
} from "@/lib/transit/transit-access";
import { transitAdminUpstreamFetch } from "@/lib/transit/transit-upstream";

type Ctx = { params: Promise<{ agencyId: string }> };

const ASSIGNABLE = new Set(TRANSIT_ASSIGNABLE_ROLES.map((r) => r.value));

function randomTempPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
  let s = "";
  for (let i = 0; i < 14; i++) s += chars[Math.floor(Math.random() * chars.length)] ?? "x";
  return s;
}

export async function POST(request: Request, ctx: Ctx) {
  const { agencyId } = await ctx.params;
  const auth = await requireTransitAdminApiAccess(agencyId);
  if (!auth.ok) return auth.response;

  let body: { email?: string; role?: string } = {};
  try {
    body = (await request.json()) as { email?: string; role?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = body.email?.trim() ?? "";
  const role = body.role?.trim() ?? "";
  if (!email) return NextResponse.json({ error: "email is required" }, { status: 400 });
  if (!ASSIGNABLE.has(role as TransitAssignableRole)) {
    return NextResponse.json({ error: "role is invalid for transit tenants" }, { status: 400 });
  }

  const res = await transitAdminUpstreamFetch("/api/admin/users", {
    method: "POST",
    body: JSON.stringify({
      email,
      agencyId,
      role,
      temporaryPassword: randomTempPassword(),
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return NextResponse.json(
      { error: (err as { error?: string }).error ?? "Invite failed" },
      { status: res.status },
    );
  }

  const row = (await res.json()) as { email: string; username: string };
  return NextResponse.json({
    ok: true,
    email: row.email,
    userId: row.username,
    message: "Transit user provisioned. Share the temporary password through your agency process.",
  });
}
