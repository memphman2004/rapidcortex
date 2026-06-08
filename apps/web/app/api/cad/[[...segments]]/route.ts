import { NextResponse } from "next/server";
import { withFeatureContract } from "@/lib/rapid-cortex/contract-response";
import { resolveCadAdapter, resolveCadReadProvider } from "@/lib/rapid-cortex/cad";
import { cadWritebackEnvBlockedResponse } from "@/lib/rapid-cortex/cad/cad-writeback-gate";
import { serviceNotConfiguredPilotResponse } from "@/lib/rapid-cortex/pilot-service-disabled-response";

type Ctx = { params: Promise<{ segments?: string[] }> };

function resolveFeatureId(segments: string[]): string {
  if (segments[0] === "health") return "cad_disabled_mode";
  if (segments[0] === "incidents") return "cad_read_only_integration";
  if (segments[0] === "active-incidents") return "cad_read_only_integration";
  if (segments[0] === "units") return "cad_read_only_integration";
  if (segments[0] === "events" && segments[1] === "recent") return "cad_read_only_integration";
  if (segments[0] === "draft-update") return "cad_assisted_writeback";
  if (segments[0] === "submit-approved-update") return "cad_assisted_writeback";
  if (segments[0] === "rollback-test") return "cad_rollback_plan";
  return "cad_discovery_workshop";
}

function isCadWritebackPostRoute(segments: string[]): boolean {
  const head = segments[0]?.trim().toLowerCase() ?? "";
  return head === "draft-update" || head === "submit-approved-update" || head === "rollback-test";
}

export async function GET(_request: Request, ctx: Ctx) {
  const { segments = [] } = await ctx.params;

  if (segments[0] === "health") {
    const adapter = resolveCadAdapter();
    const health = await adapter.healthCheck();
    return NextResponse.json({ health });
  }

  const readProvider = resolveCadReadProvider();

  if (segments[0] === "units" && segments[1]) {
    return withFeatureContract("cad_read_only_integration", async () => {
      const unit = await readProvider.getUnitStatus(segments[1] ?? "");
      if (!unit) {
        return NextResponse.json({ unit: null, mode: "read_only_preview" }, { status: 404 });
      }
      return NextResponse.json({ unit, mode: "read_only_preview" });
    });
  }

  if (segments[0] === "units" && segments.length === 1) {
    return withFeatureContract("cad_read_only_integration", async () => {
      const units = await readProvider.listUnits();
      return NextResponse.json({ units, mode: "read_only_preview" });
    });
  }

  if (segments[0] === "events" && segments[1] === "recent") {
    return withFeatureContract("cad_read_only_integration", async () => {
      const events = await readProvider.getRecentCadEvents();
      return NextResponse.json({ events, mode: "read_only_preview" });
    });
  }

  if (segments[0] === "active-incidents" && segments.length === 1) {
    return withFeatureContract("cad_read_only_integration", async () => {
      const incidents = await readProvider.listActiveIncidents();
      return NextResponse.json({ incidents, mode: "read_only_preview" });
    });
  }

  if (segments[0] === "incidents" && segments[1]) {
    return withFeatureContract("cad_read_only_integration", async () => {
      const incident = await readProvider.getIncidentById(segments[1] ?? "");
      if (!incident) {
        return NextResponse.json({ incident: null, mode: "read_only_preview" }, { status: 404 });
      }
      return NextResponse.json({ incident, mode: "read_only_preview" });
    });
  }

  if (segments[0] === "incidents" && segments.length === 1) {
    return withFeatureContract("cad_read_only_integration", async () => {
      const canonical = await readProvider.listActiveIncidents();
      return NextResponse.json({ incidents: canonical, mode: "read_only_preview" });
    });
  }

  const featureId = resolveFeatureId(segments);
  return serviceNotConfiguredPilotResponse({
    endpoint: `/api/cad/${segments.join("/")}`,
    featureHint: featureId,
  });
}

export async function POST(request: Request, ctx: Ctx) {
  const { segments = [] } = await ctx.params;

  if (isCadWritebackPostRoute(segments)) {
    const envBlocked = cadWritebackEnvBlockedResponse();
    if (envBlocked) return envBlocked;
  }

  const featureId = resolveFeatureId(segments);

  return withFeatureContract(featureId, async () => {
    return NextResponse.json(
      {
        ok: false,
        message:
          "CAD write-back adapters are intentionally not wired in this repository build — contact Rapid Cortex integrations before attempting enablement.",
      },
      { status: 501 },
    );
  });
}
