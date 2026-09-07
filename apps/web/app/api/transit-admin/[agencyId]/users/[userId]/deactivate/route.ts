import { NextResponse } from "next/server";
import { requireTransitAdminApiAccess } from "@/lib/transit/transit-api-auth";
import { transitAdminUpstreamFetch } from "@/lib/transit/transit-upstream";

type Ctx = { params: Promise<{ agencyId: string; userId: string }> };

export async function PATCH(_request: Request, ctx: Ctx) {
  const { agencyId, userId } = await ctx.params;
  const auth = await requireTransitAdminApiAccess(agencyId);
  if (!auth.ok) return auth.response;

  const res = await transitAdminUpstreamFetch("/api/admin/users/deactivate", {
    method: "POST",
    body: JSON.stringify({ username: userId }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return NextResponse.json(
      { error: (err as { error?: string }).error ?? "Deactivate failed" },
      { status: res.status },
    );
  }

  return NextResponse.json({ ok: true });
}
