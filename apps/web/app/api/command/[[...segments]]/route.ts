import type { NextRequest } from "next/server";
import { withFeatureContract } from "@/lib/rapid-cortex/contract-response";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

type Ctx = { params: Promise<{ segments?: string[] }> };

function resolveFeatureId(segments: string[]): string {
  if (segments[0] === "war-room") return "war_rooms";
  if (segments[0] === "runbooks") return "runbooks_playbooks";
  if (segments[0] === "timeline-event") return "incident_timeline_reconstruction";
  if (segments[0] === "post-incident-review") return "post_incident_reviews";
  if (segments[0] === "status-page") return "stakeholder_status_pages";
  return "command_dashboard";
}

async function handle(request: NextRequest, ctx: Ctx) {
  const { segments = [] } = await ctx.params;
  const endpoint = `/api/command/${segments.join("/")}`.replace(/\/$/, "") || "/api/command";
  return withFeatureContract(resolveFeatureId(segments), async () =>
    proxyToAuthUpstream(request, endpoint),
  );
}

export async function GET(request: NextRequest, ctx: Ctx) {
  return handle(request, ctx);
}

export async function POST(request: NextRequest, ctx: Ctx) {
  return handle(request, ctx);
}

export async function PUT(request: NextRequest, ctx: Ctx) {
  return handle(request, ctx);
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  return handle(request, ctx);
}
