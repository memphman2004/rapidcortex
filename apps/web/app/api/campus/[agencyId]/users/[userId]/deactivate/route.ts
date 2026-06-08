import { NextResponse } from "next/server";
import { requireCampusAdminApiAccess } from "@/lib/campus/campus-api-auth";
import { campusUpstreamFetch } from "@/lib/campus/campus-upstream";

type Ctx = { params: Promise<{ agencyId: string; userId: string }> };

export async function PATCH(_request: Request, ctx: Ctx) {
  const { agencyId, userId } = await ctx.params;
  const auth = await requireCampusAdminApiAccess(agencyId);
  if (!auth.ok) return auth.response;

  const res = await campusUpstreamFetch("/api/admin/users/deactivate", {
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
