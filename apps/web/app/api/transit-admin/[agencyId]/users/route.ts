import { NextResponse } from "next/server";
import type { AdminUserRow } from "@/lib/api";
import { requireTransitAdminApiAccess } from "@/lib/transit/transit-api-auth";
import { isTransitAssignableRole } from "@/lib/transit/transit-access";
import { transitAdminUpstreamFetch } from "@/lib/transit/transit-upstream";

type Ctx = { params: Promise<{ agencyId: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const { agencyId } = await ctx.params;
  const auth = await requireTransitAdminApiAccess(agencyId);
  if (!auth.ok) return auth.response;

  const res = await transitAdminUpstreamFetch("/api/admin/users");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return NextResponse.json(
      { error: (err as { error?: string }).error ?? "Failed to load transit users" },
      { status: res.status },
    );
  }

  const data = (await res.json()) as { items?: AdminUserRow[] };
  const users = (data.items ?? [])
    .filter((row) => row.agencyId === agencyId && isTransitAssignableRole(row.role))
    .map((row) => ({
      userId: row.username,
      email: row.email,
      displayName: null,
      role: row.role,
      status: row.enabled ? ("active" as const) : ("inactive" as const),
      lastActiveAt: null,
      createdAt: new Date().toISOString(),
    }));

  return NextResponse.json({ users });
}
