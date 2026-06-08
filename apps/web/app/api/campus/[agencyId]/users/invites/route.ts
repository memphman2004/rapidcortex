import { NextResponse } from "next/server";
import type { InviteRecord } from "rapid-cortex-shared";
import { requireCampusAdminApiAccess } from "@/lib/campus/campus-api-auth";
import { isCampusAssignableRole } from "@/lib/campus/campus-access";
import { campusUpstreamFetch } from "@/lib/campus/campus-upstream";

type Ctx = { params: Promise<{ agencyId: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const { agencyId } = await ctx.params;
  const auth = await requireCampusAdminApiAccess(agencyId);
  if (!auth.ok) return auth.response;

  const res = await campusUpstreamFetch(`/api/agencies/${encodeURIComponent(agencyId)}/invites`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return NextResponse.json(
      { error: (err as { error?: string }).error ?? "Failed to load invites" },
      { status: res.status },
    );
  }

  const data = (await res.json()) as { items?: InviteRecord[] };
  const invites = (data.items ?? [])
    .filter((row) => isCampusAssignableRole(row.role))
    .map((row) => ({
      inviteId: row.inviteId,
      email: row.email,
      role: row.role,
      sentAt: row.createdAt,
      expiresAt: row.expiresAt,
    }));

  return NextResponse.json({ invites });
}
